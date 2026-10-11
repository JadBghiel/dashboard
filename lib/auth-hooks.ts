/** the checks better-auth runs before each of its requests: the admin rules, the per account login
 * limit, the profile rules, the weak passwords, and the email change answer */

import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { db } from "@/server/db";

import { escapeHtml, mailInBackground } from "./auth-mail";
import { weakPasswordReason } from "./common-passwords";
import { fixedWindow } from "./fixed-window";

//admin plugin endpoints that can take the admin role away from someone. the admin page hides the
//buttons on your own row, but only in the browser: anyone w/ an admin session can call these directly
const ADMIN_ROLE_CHANGES = new Set(["/admin/set-role", "/admin/update-user"]);

//an admin can't demote themselves. banning or removing yourself is already refused by the plugin.
//so only another admin can take it away
async function refuseSelfDemotion(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]) {
  const role =
    ctx.path === "/admin/set-role"
      ? (ctx.body?.role as string | undefined)
      : (ctx.body?.data as { role?: string } | undefined)?.role;
  if (role === undefined || role === "admin") return;
  //no session = not an admin, the plugin itself answers that
  const session = await getSessionFromCtx(ctx);
  if (session && ctx.body?.userId === session.user.id) {
    throw new APIError("FORBIDDEN", { message: "You can't remove your own admin role." });
  }
}

//the rateLimit rules at the bottom count per ip, so a botnet still gets 5 guesses a minute from each
//of its addresses on 1 account. these count per account, whatever the ip. the identifier the request
//names, a username counted as its account's email so both forms share 1 count. an unknown 1 is
//limited the same, nothing leaks. in memory like better-auth's own, each server copy counts on its own
const SIGN_IN = fixedWindow(10, 15 * 60);
//each 1 sends a mail, the inbox shouldn't get flooded from many ips either
const VERIFY_MAILS = fixedWindow(5, 15 * 60);
const RESET_MAILS = fixedWindow(5, 15 * 60);
const ACCOUNT_LIMITS: Record<string, { field: string; hit: ReturnType<typeof fixedWindow> }> = {
  "/sign-in/email": { field: "email", hit: SIGN_IN },
  "/sign-in/username": { field: "username", hit: SIGN_IN },
  "/send-verification-email": { field: "email", hit: VERIFY_MAILS },
  "/request-password-reset": { field: "email", hit: RESET_MAILS },
};

async function accountLimited(path: string, body: Record<string, unknown> | undefined) {
  const rule = ACCOUNT_LIMITS[path];
  const value = body?.[rule?.field ?? ""];
  if (!rule || typeof value !== "string") return false;
  let id = value.trim().toLowerCase();
  if (rule.field === "username") {
    const user = await db.user.findUnique({ where: { username: id }, select: { email: true } });
    if (user) id = user.email;
  }
  return rule.hit(id).retryAfter > 0;
}

//the admin plugin lets an admin sign in as any user, the admin page never uses it. off, an admin
//session alone shouldn't open every account
const IMPERSONATION = new Set(["/admin/impersonate-user", "/admin/stop-impersonating"]);

const MAX_NAME = 50;

//better-auth takes any string for both, a 5000 char name or a picture from any host (shown as an
//<img> on the admin page, a tracking pixel for whoever opens it). the only picture is google's
function checkProfile(body: Record<string, unknown> | undefined) {
  const name = body?.name;
  if (typeof name === "string" && (!name.trim() || name.trim().length > MAX_NAME)) {
    throw new APIError("BAD_REQUEST", {
      message: `Your name must be 1 to ${MAX_NAME} characters.`,
    });
  }
  const image = body?.image;
  if (image !== undefined && image !== null && !isGooglePicture(image)) {
    throw new APIError("BAD_REQUEST", { message: "Your picture can only come from Google." });
  }
}

/** an https url on google's own image host, the only picture an account can have */
export function isGooglePicture(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export const beforeAuthRequest = createAuthMiddleware(async (ctx) => {
  if (ADMIN_ROLE_CHANGES.has(ctx.path)) await refuseSelfDemotion(ctx);
  if (IMPERSONATION.has(ctx.path)) throw new APIError("NOT_FOUND");
  if (ctx.path === "/update-user" || ctx.path === "/sign-up/email") checkProfile(ctx.body);
  if (await accountLimited(ctx.path, ctx.body)) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Too many attempts on this account. Try again in a few minutes.",
    });
  }
  //we check if the password they used to register is too easy to guess
  if (ctx.path === "/sign-up/email") {
    //we can't put it in the databaseHooks cuz they only see the password hash
    const password = ctx.body?.password as string | undefined;
    const reason =
      password &&
      weakPasswordReason(password, {
        username: ctx.body?.username as string | undefined,
        email: ctx.body?.email as string | undefined,
      });
    if (reason) {
      //error 422 means that the syntax is correct, but the contained data is not
      throw new APIError("UNPROCESSABLE_ENTITY", { message: reason });
    }
  }
  //a reset has no session, the token says whose account it is. the common password list still
  //applies
  if (ctx.path === "/reset-password") {
    const newPassword = ctx.body?.newPassword as string | undefined;
    const reason = newPassword && weakPasswordReason(newPassword, {});
    if (reason) throw new APIError("UNPROCESSABLE_ENTITY", { message: reason });
  }
  //better-auth answers "ok" and sends nothing when the new email already has an account, so the
  //form can't be used to find out who has 1. the owner of this account still gets told why
  //nothing came, in their own inbox
  if (ctx.path === "/change-email") {
    const session = await getSessionFromCtx(ctx);
    const newEmail = (ctx.body?.newEmail as string | undefined)?.trim().toLowerCase();
    if (session && newEmail && newEmail !== session.user.email) {
      const taken = await db.user.findFirst({
        where: { email: { equals: newEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (taken) {
        mailInBackground(
          session.user.email,
          "Your dashboard email wasn't changed",
          `<p>You asked to change your dashboard account's email to ${escapeHtml(newEmail)}, but ` +
            `that address already has an account, so nothing was changed.</p>` +
            `<p>To use it here, delete the other account first or pick another address. If it ` +
            `wasn't you, change your password.</p>`,
        );
      }
    }
  }
  //same rules for a new password, w/ the username and email of the signed in user
  if (ctx.path === "/change-password") {
    const session = await getSessionFromCtx(ctx);
    const newPassword = ctx.body?.newPassword as string | undefined;
    const reason =
      session &&
      newPassword &&
      weakPasswordReason(newPassword, {
        username: session.user.username ?? undefined,
        email: session.user.email,
      });
    if (reason) throw new APIError("UNPROCESSABLE_ENTITY", { message: reason });
    //the other devices are signed out whatever the request asks: the security card sends true,
    //but a direct call w/ false would leave a thief who knew the old password signed in
    return { context: { body: { ...ctx.body, revokeOtherSessions: true } } };
  }
});
