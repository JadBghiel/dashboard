import { betterAuth } from "better-auth";
import { after } from "next/server";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";
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
    account: {
      create: {
        after: async (account) => {
          if (account.providerId === "credential") return;
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
