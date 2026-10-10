/** the 1 prisma client the server uses. on neon every client is a connection pool, so 2 of them
 * would burn connections for nothing, lib/auth.ts should import this 1 too. kept on globalThis in
 * dev, next reloads modules on every save and would open a new pool each time */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db =
  globalForDb.db ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
