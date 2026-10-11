/** brings the db-test container (docker-compose.dev.yml) to the latest schema before any file runs.
 * it lives in tmpfs, so after every restart it starts empty and gets every migration again */

import { execFileSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL isn't set, see .env.example");
  // the unpooled url wins in prisma.config.ts, it must not send the migration somewhere else
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url };
  delete env.DATABASE_URL_UNPOOLED;
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env,
      stdio: "pipe",
    });
  } catch (err) {
    const output = String((err as { stderr?: Buffer }).stderr ?? err);
    throw new Error(
      `couldn't migrate the test db, is it up? docker compose -f docker-compose.dev.yml up -d db-test\n${output}`,
    );
  }
}
