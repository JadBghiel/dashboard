import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// prisma 7 stopped loading .env on its own. node's loadEnvFile never overwrites a var thats
// already set, so a DATABASE_URL from the shell or ci wins, then .env.local, then .env
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // tsx bc the generated client is plain ts and node 20 cant run it on its own
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // only the prisma cli reads this (migrate, studio). left undefined when unset instead of
    // using env() which throws, so prisma generate still works in a build w/o a db
    url: process.env.DATABASE_URL,
  },
});
