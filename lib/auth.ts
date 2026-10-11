import { betterAuth } from "better-auth";
import { after } from "next/server";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { db } from "@/server/db";
import { sendMail } from "./email";
import { weakPasswordReason } from "./common-passwords";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"; //localhost fallback

//localhost and 127.0.0.1 are the same server, but a browser sends a different origin for each. trust
//both, or the graded stack opened at 127.0.0.1:8080 fails every login once it has a cookie
const appOrigins = [appUrl];
if (new URL(appUrl).hostname === "localhost") {
  appOrigins.push(appUrl.replace("//localhost", "//127.0.0.1"));
}

// google sign in only when both values are set, so the docker stack (no oauth client) starts clean
// and the auth pages hide the button instead of showing one that fails
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

// github is linked from the services page for its widgets, never a way to sign in or sign up. w/o
// the 2 values the connect btn says github isnt set up on this server
export const githubEnabled = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
);

//sent after the response: awaiting the mail would make the response slower for real accounts, and
//that timing difference leaks which emails exist. after() and not a bare promise bc on vercel the
//function can be frozen once the response is out, a mail still in flight would never leave. outside
//a request (the tests) there is no after(), the plain promise is enough there
//only what explains the failure. the raw error of the sendgrid client carries the request config,
//its Authorization header included, logging it as is would print the api key in the logs
function mailError(err: unknown) {
  const e = err as { code?: number | string; message?: string; response?: { body?: unknown } };
  const detail = e.response?.body ? ` ${JSON.stringify(e.response.body)}` : "";
  return `${e.code ?? ""} ${e.message ?? String(err)}${detail}`.trim();
}

function mailInBackground(to: string, subject: string, html: string) {
  const send = () =>
    sendMail({ to, subject, html }).catch((err) => {
      console.error(`Failed to send "${subject}" mail: ${mailError(err)}`);
    });
  try {
    after(send);
  } catch {
    void send();
  }
}

//admin plugin endpoints that can take the admin role away from someone. the admin page hides the
//buttons on your own row, but only in the browser: anyone w/ an admin session can call these directly
const ADMIN_ROLE_CHANGES = new Set(["/admin/set-role", "/admin/update-user"]);

//an admin can't demote themselves. banning or removing yourself is already refused by the plugin.
//so every admin action targets another admin, and the app can never end up w/o one
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
const ACCOUNT_LIMITS: Record<
  string,
  { field: string; bucket: string; max: number; window: number }
> = {
  "/sign-in/email": { field: "email", bucket: "sign-in", max: 10, window: 15 * 60 },
  "/sign-in/username": { field: "username", bucket: "sign-in", max: 10, window: 15 * 60 },
  //each 1 sends a mail, the inbox shouldn't get flooded from many ips either
  "/send-verification-email": { field: "email", bucket: "verify", max: 5, window: 15 * 60 },
};
const accountWindows = new Map<string, { count: number; resetAt: number }>();

async function accountLimited(path: string, body: Record<string, unknown> | undefined) {
  const rule = ACCOUNT_LIMITS[path];
  const value = body?.[rule?.field ?? ""];
  if (!rule || typeof value !== "string") return false;
  let id = value.trim().toLowerCase();
  if (rule.field === "username") {
    const user = await db.user.findUnique({ where: { username: id }, select: { email: true } });
    if (user) id = user.email;
  }
  const key = `${rule.bucket}:${id}`;
  const now = Date.now();
  let w = accountWindows.get(key);
  if (!w || w.resetAt <= now) {
    if (accountWindows.size >= 10_000) accountWindows.clear();
    w = { count: 0, resetAt: now + rule.window * 1000 };
    accountWindows.set(key, w);
  }
  return ++w.count > rule.max;
}

//the new email is typed by the user and goes into a mail's html
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** the "picture" claim of google's id token, only if it's an https url on google's own image host. the
 * token came straight from google in the oauth exchange, the server never got it from the browser */
function googlePicture(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    const url = new URL(payload.picture);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

//never replaces a picture the user already has, only fills an empty one
async function fillPictureFromGoogle(account: {
  providerId?: string;
  userId?: string;
  idToken?: string | null;
}) {
  if (account.providerId !== "google" || !account.userId || !account.idToken) return;
  const image = googlePicture(account.idToken);
  if (!image) return;
  await db.user.updateMany({ where: { id: account.userId, image: null }, data: { image } });
}

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: appOrigins,
  secret: process.env.BETTER_AUTH_SECRET, //we obviously don't use appUrl for the secret
  //the same prisma client as the rest of the server, a 2nd one would open a 2nd connection pool
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
  },
  emailVerification: {
    sendOnSignUp: true,
    //an unverified login (right password only) gets a fresh link, so a lost or expired mail is never
    //a dead end. the sign in rate limit keeps it from being used to spam
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      mailInBackground(
        user.email,
        //also the 2nd step of an email change, sent to the new address, so worded for both
        "Confirm your email address",
        `<p>Click to confirm this email address for your dashboard account: <a href="${url}">click here</a></p>`,
      );
    },
  },
  plugins: [username(), admin()],
  user: {
    //#47 edit profile: a new email takes 2 clicks. the current address approves first, so a stolen
    //session alone can't move the account to another inbox, then the new address proves it's real
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        mailInBackground(
          user.email,
          "Approve your new dashboard email",
          `<p>Someone asked to change your dashboard account's email to ${escapeHtml(newEmail)}.</p>` +
            `<p>If it was you, <a href="${url}">click here to approve it</a>. We'll then send a link to ` +
            `the new address to finish.</p><p>If it wasn't you, ignore this mail and change your password.</p>`,
        );
      },
    },
    deleteUser: {
      enabled: true,
      //deleting needs a click on a link sent to the account email. works the same for password and
      //google accounts, and a stolen session alone can't wipe the account
      sendDeleteAccountVerification: async ({ user, url }) => {
        mailInBackground(
          user.email,
          "Confirm your dashboard account deletion",
          `<p>Someone asked to delete your dashboard account and all its data.</p>` +
            `<p>If it was you, <a href="${url}">click here to delete it</a>. The link works for 24 hours, ` +
            `in the browser you asked from.</p><p>If it wasn't you, ignore this mail.</p>`,
        );
      },
    },
  },
  account: {
    //the github token reads the user's notifications, sealed in the db like the api keys are
    encryptOAuthTokens: true,
    accountLinking: {
      //google signing in w/ the email of an account that was never confirmed: google just proved
      //the email is theirs, so the account is linked instead of refused. the hijack this default
      //protects against (someone pre-registering your email w/ their password) is closed by the
      //account hook below, which drops that password on the link
      requireLocalEmailVerified: false,
      //github is linked by a signed in user on purpose, their github email can be another one
      allowDifferentEmails: true,
    },
  },
  databaseHooks: {
    //google's profile picture for accounts that had none: a google sign up already gets it, these
    //cover a password account that links google later, on the link and on each google login after
    account: {
      update: { after: async (account) => fillPictureFromGoogle(account) },
      create: {
        after: async (account) => {
          await fillPictureFromGoogle(account);
          //github is linked on purpose from the services page, only google proves the email
          if (account.providerId !== "google") return;
          const user = await db.user.findUnique({
            where: { id: account.userId },
            select: { emailVerified: true },
          });
          //linked to an unconfirmed account: whoever set its password never proved the email,
          //their password goes, the owner logs in w/ google (better-auth marks the email verified)
          if (user && !user.emailVerified) {
            await db.account.deleteMany({
              where: { userId: account.userId, providerId: "credential" },
            });
          }
        },
      },
    },
    //this runs before better-auth inserts a new user row
    user: {
      create: {
        before: async (user) => {
          //it receives incoming user data
          return {
            data: {
              //and returns the original fields with a lowercase overriden email
              ...user,
              email: user.email.toLowerCase(),
            },
          };
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ADMIN_ROLE_CHANGES.has(ctx.path)) await refuseSelfDemotion(ctx);
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
      //same rules for a new password, w/ the username and email of the signed in user
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
    }),
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/username": {
        window: 60,
        max: 5,
      },
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      //it checks the current password, so it's a login attempt too
      "/change-password": {
        window: 60,
        max: 5,
      },
      "/send-verification-email": {
        window: 60,
        max: 3,
      },
      //each call sends a mail
      "/delete-user": {
        window: 60,
        max: 3,
      },
      "/change-email": {
        window: 60,
        max: 3,
      },
    },
  },
  socialProviders: {
    ...(googleEnabled && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(githubEnabled && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        //on top of the defaults (read:user, user:email). public data only, no repo scope
        scope: ["notifications"],
        //linking only: a github sign in can't create an account
        disableSignUp: true,
      },
    }),
  },
});
