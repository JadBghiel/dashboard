import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";
import { db } from "@/server/db";
import { escapeHtml, mailInBackground } from "./auth-mail";
import { beforeAuthRequest, isGooglePicture } from "./auth-hooks";

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

/** the "picture" claim of google's id token, only if it's an https url on google's own image host. the
 * token came straight from google in the oauth exchange, the server never got it from the browser */
function googlePicture(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return isGooglePicture(payload.picture) ? new URL(payload.picture).toString() : null;
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
    //forgot password: a link to the account email, valid 1h (the default), then every device is
    //signed out, whoever knew the old password included
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      mailInBackground(
        user.email,
        "Reset your dashboard password",
        `<p>Someone asked to reset the password of your dashboard account.</p>` +
          `<p>If it was you, <a href="${url}">click here to choose a new one</a>. The link works for ` +
          `1 hour.</p><p>If it wasn't you, ignore this mail, your password stays the same.</p>`,
      );
    },
    //the link was opened from the account's inbox, that proves the email like the confirmation does
    onPasswordReset: async ({ user }) => {
      await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    },
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
    //a new user's email is saved lowercase, before better-auth inserts the row, so "Bob@x.com" and
    //"bob@x.com" are 1 account
    user: {
      create: {
        before: async (user) => ({ data: { ...user, email: user.email.toLowerCase() } }),
      },
    },
  },
  hooks: {
    before: beforeAuthRequest,
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
      "/request-password-reset": {
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
