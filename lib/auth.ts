import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "@/server/db";
import { sendMail } from "./email";
import { COMMON_PASSWORDS } from "./common-passwords";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"; //localhost fallback

// google sign in only when both values are set, so the docker stack (no oauth client) starts clean
// and the auth pages hide the button instead of showing one that fails
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

//fire and forget: awaiting the mail would make the response slower for real accounts, and that
//timing difference leaks which emails exist
function mailInBackground(to: string, subject: string, html: string) {
  void sendMail({ to, subject, html }).catch((err) => {
    console.error(`Failed to send "${subject}" mail:`, err);
  });
}

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl],
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
      //we check if the password they used to register is in the common-passwords
      if (ctx.path === "/sign-up/email") {
        //we can't put it in the databaseHooks cuz they only see the password hash
        const password = ctx.body?.password as string | undefined;
        if (password && COMMON_PASSWORDS.has(password.toLowerCase())) {
          throw new APIError("UNPROCESSABLE_ENTITY", {
            //error 422 means that the syntax is correct, but the contained data is not
            message: "This password is too common. Please choose a different one.",
          });
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
