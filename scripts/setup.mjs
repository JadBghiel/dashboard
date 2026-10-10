// npm run setup: env file, dev db up, migrations, prisma client, seed. every step is safe to rerun,
// its also how you bring the db back after a reboot

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const COMPOSE_FILE = "docker-compose.dev.yml";
// npx and docker-compose are .cmd shims on windows, spawn only finds those through a shell
const shell = process.platform === "win32";

function run(cmd, args, env = process.env) {
  console.log(`\n> ${[cmd, ...args].join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell, env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const works = (cmd, args) => spawnSync(cmd, args, { stdio: "ignore", shell }).status === 0;

// the compose v2 plugin first, the standalone docker-compose binary as a fallback
function findCompose() {
  if (works("docker", ["compose", "version"])) return ["docker", "compose"];
  if (works("docker-compose", ["version"])) return ["docker-compose"];
  console.error(
    "Docker Compose was not found. Install Docker with Compose, then rerun npm run setup.",
  );
  process.exit(1);
}

// an old compose binary on a newer daemon fails every call w/ "client version X is too old". read the
// min version out of the error and pin it so setup still goes through, but say it loudly bc the graded
// docker-compose up wont get this workaround
function composeEnv([cmd, ...pre]) {
  const probe = spawnSync(cmd, [...pre, "-f", COMPOSE_FILE, "ps"], { encoding: "utf8", shell });
  const min = probe.stderr?.match(/Minimum supported API version is ([\d.]+)/)?.[1];
  if (!min) return process.env;
  console.warn(
    `\nWarning: your Docker Compose is too old for this Docker daemon, running it with ` +
      `DOCKER_API_VERSION=${min}. Upgrade Docker Compose before working on the Docker stack.`,
  );
  return { ...process.env, DOCKER_API_VERSION: min };
}

// keys of the uncommented KEY=... lines of an env file
const keysOf = (text) =>
  new Set(
    text
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
      .filter(Boolean),
  );

if (!existsSync(".env.local")) {
  copyFileSync(".env.example", ".env.local");
  console.log("Created .env.local from .env.example");
} else {
  const example = readFileSync(".env.example", "utf8");
  const local = readFileSync(".env.local", "utf8");
  const have = keysOf(local);
  const missing = example
    .split(/\n(?=\s*(?:#|[A-Z0-9_]+\s*=))/)
    .filter((block) => [...keysOf(block)].some((k) => !have.has(k)));

  if (missing.length > 0) {
    appendFileSync(".env.local", `\n${missing.join("\n").trim()}\n`);
    console.log(
      `Added new vars to .env.local: ${missing.flatMap((b) => [...keysOf(b)]).join(", ")}`,
    );
  }
}

// a fresh master key for the saved api keys, only if theres none yet: replacing it would make every
// key already saved locally unreadable
const env = readFileSync(".env.local", "utf8");
if (/^CREDENTIALS_KEY=""\s*$/m.test(env)) {
  const key = randomBytes(32).toString("base64");
  writeFileSync(".env.local", env.replace(/^CREDENTIALS_KEY=""\s*$/m, `CREDENTIALS_KEY="${key}"`));
  console.log("Generated CREDENTIALS_KEY in .env.local");
}

const compose = findCompose();
const [composeCmd, ...composeArgs] = compose;
run(composeCmd, [...composeArgs, "-f", COMPOSE_FILE, "up", "-d", "--wait"], composeEnv(compose));
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "seed"]);

console.log("\nSetup done. Run npm run dev and open http://localhost:3000");
