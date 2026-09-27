import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@/generated/prisma/client";
import { admin, username } from "better-auth/plugins";
import { sendMail } from "./email";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";
import { COMMON_PASSWORDS } from "./common-passwords";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl],
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    onExistingUserSignUp: async ({ user }) => {
      console.log(`Duplicate sign-up attempt for existing email: ${user.email}`);
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendMail({ //instead of using it with an await, we do it like this so it doesn't leak info via response timing
        to: user.email,
        subject: "Confirm your dashboard account",
        html: `<p>Click to confirm: <a href="${url}">click here</a></p>`,
      }).catch((err) => {
        console.error("Failed to send verification mail:", err);
      });
    },
  },
  plugins: [username(), admin()],
  databaseHooks: { //this runs before better-auth inserts a new user row
    user: {
      create: {
        before: async (user) => { //it receives incoming user data  
          return {
            data: { //and returns the original fields with a lowercase overriden email
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
      if (ctx.path === "/sign-up/email") {
        const password = ctx.body?.password as string | undefined;
        if (password && COMMON_PASSWORDS.has(password.toLowerCase())) {
          throw new APIError("UNPROCESSABLE_ENTITY", {
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
      "/send-verification-email": {
        window: 60,
        max: 3,
      },
    },
  },
});

