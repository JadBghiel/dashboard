// shared prisma client. a route creating its own "new PrismaClient()" would open a separate
// connection pool per file. this is the 1 instance everything else should import.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
