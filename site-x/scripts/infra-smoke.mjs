import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const envPath = ".env";

if (!existsSync(envPath)) {
  throw new Error("Missing .env. Copy .env.example to .env before running infra:smoke.");
}

const localEnv = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const composeArgs = ["compose", "--env-file", envPath, "-f", "docker-compose.benchmark.yml"];
const compose = (...args) => execFileSync("docker", [...composeArgs, ...args], { encoding: "utf8" }).trim();

const services = compose("ps", "--status", "running", "--services").split(/\r?\n/).filter(Boolean);
for (const service of ["postgres", "mailpit"]) {
  if (!services.includes(service)) {
    throw new Error(`${service} is not running.`);
  }
}

for (const service of ["postgres", "mailpit"]) {
  const containerId = compose("ps", "-q", service);
  const health = execFileSync("docker", ["inspect", "--format", "{{.State.Health.Status}}", containerId], { encoding: "utf8" }).trim();
  if (health !== "healthy") {
    throw new Error(`${service} health is ${health}.`);
  }
}

compose("exec", "-T", "postgres", "pg_isready", "-U", localEnv.POSTGRES_USER, "-d", localEnv.POSTGRES_DB);
const databaseCheck = compose("exec", "-T", "postgres", "psql", "-U", localEnv.POSTGRES_USER, "-d", localEnv.POSTGRES_DB, "-tAc", "SELECT current_database()");
if (databaseCheck !== localEnv.POSTGRES_DB) {
  throw new Error(`Expected database ${localEnv.POSTGRES_DB}, received ${databaseCheck}.`);
}

const response = await fetch(`http://127.0.0.1:${localEnv.MAILPIT_UI_PORT}/api/v1/info`);
if (!response.ok) {
  throw new Error(`Mailpit API returned ${response.status}.`);
}

console.log(`PostgreSQL healthy and connected to ${databaseCheck}.`);
console.log(`Mailpit healthy at http://127.0.0.1:${localEnv.MAILPIT_UI_PORT}.`);
