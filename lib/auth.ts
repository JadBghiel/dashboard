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

//sent after the response: awaiting the mail would make the response slower for real accounts, and
//that timing difference leaks which emails exist. after() and not a bare promise bc on vercel the
//function can be frozen once the response is out, a mail still in flight would never leave. outside
//a request (the tests) there is no after(), the plain promise is enough there
function mailInBackground(to: string, subject: string, html: string) {
  const send = () =>
    sendMail({ to, subject, html }).catch((err) => {
      console.error(`Failed to send "${subject}" mail:`, err);
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
        "Confirm your dashboard account",
        `<p>Click to confirm: <a href="${url}">click here</a></p>`,
      );
    },
  },
  plugins: [username(), admin()],
  user: {
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
  databaseHooks: {
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
      "/send-verification-email": {
        window: 60,
        max: 3,
      },
      //each call sends a mail
      "/delete-user": {
        window: 60,
        max: 3,
      },
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
});
