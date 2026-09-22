import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@/generated/prisma/client";
import { admin, username } from "better-auth/plugins";
import { sendMail } from "./email";

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
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Confirm your dashboard account",
        html: `<p>Click to confirm: <a href="${url}">${url}</a></p>`,
      });
    },
  },
  plugins: [username(), admin()]
});
