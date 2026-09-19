/** dev seed: 1 admin and 1 verified demo user, written the way better-auth sign up writes them so
 * they can log in once auth lands in #7. safe to rerun, a user that already exists is left alone */

import { PrismaPg } from "@prisma/adapter-pg";
import { generateRandomString, hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../generated/prisma/client";

// the passwords below are in the repo, so the seed only ever writes to a db on this machine
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const USERS = [
  {
    name: "Admin",
    username: "admin",
    email: "admin@dashboard.test",
    password: "dashboard-admin-dev",
    role: "admin",
  },
  {
    name: "Demo",
    username: "demo",
    email: "demo@dashboard.test",
    password: "dashboard-demo-dev",
    role: "user",
  },
];

// same shape as better-auth default ids
const newId = () => generateRandomString(32, "a-z", "A-Z", "0-9");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run npm run setup first.");

  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to seed ${host}: the seed passwords are public, it only runs against a local database.`,
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const u of USERS) {
      if (await prisma.user.findUnique({ where: { email: u.email } })) {
        console.log(`  exists   ${u.email}`);
        continue;
      }
      const id = newId();
      await prisma.user.create({
        data: {
          id,
          name: u.name,
          email: u.email,
          emailVerified: true,
          username: u.username,
          displayUsername: u.username,
          role: u.role,
          // mirrors better-auth sign up: provider "credential", accountId = the user id
          accounts: {
            create: {
              id: newId(),
              accountId: id,
              providerId: "credential",
              password: await hashPassword(u.password),
            },
          },
        },
      });
      console.log(`  created  ${u.email}  password: ${u.password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
