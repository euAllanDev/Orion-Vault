import { existsSync, readFileSync } from "node:fs";

export function loadLocalEnv() {
  if (!existsSync(".env")) {
    throw new Error("Missing .env. Copy .env.example to .env before database commands.");
  }

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator > 0) process.env[trimmed.slice(0, separator)] ??= trimmed.slice(separator + 1);
  }
}
