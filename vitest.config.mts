import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig } from "vitest/config";

// the files prisma.config.ts reads, a var already set in the shell or ci wins. only read here, the
// rest of the dev env (api keys, the dev db) stays out of the tests
const fileEnv = Object.assign(
  {},
  ...[".env", ".env.local"].filter(existsSync).map((f) => parseEnv(readFileSync(f, "utf8"))),
) as Record<string, string | undefined>;
// the db-test container of docker-compose.dev.yml when unset, an .env.local older than the var works
const testDb =
  process.env.TEST_DATABASE_URL ??
  fileEnv.TEST_DATABASE_URL ??
  "postgresql://dashboard:dashboard@localhost:55434/dashboard_test";
process.env.TEST_DATABASE_URL = testDb;
// the suite truncates every table, pointed at the dev db it would wipe your accounts
if (testDb === (process.env.DATABASE_URL ?? fileEnv.DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL is the dev DATABASE_URL, the tests would wipe it");
}

export default defineConfig({
  // same @/ alias as tsconfig, done by hand so the setup doesnt need another plugin
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // the test db is 1 container, 2 files truncating at the same time would fight
    fileParallelism: false,
    // migrates the test db once per run
    globalSetup: ["tests/global-setup.ts"],
    env: {
      // the app's own db client, so lib/auth.ts and server/db.ts run untouched against the test db
      DATABASE_URL: testDb,
      // known values: the auth suite signs its own (expired, forged) verification links
      BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-else",
      BETTER_AUTH_URL: "http://localhost:3000",
      // never a real mail from a test run
      SENDGRID_API_KEY: "",
    },
    typecheck: {
      // the front/back contract is a type, so it gets checked like any other assertion
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "tsconfig.json",
    },
  },
});
