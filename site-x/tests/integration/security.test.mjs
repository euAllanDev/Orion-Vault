import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test, { after } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { loadLocalEnv } from "../../prisma/local-env.mjs";

loadLocalEnv();
const port = 3012;
const origin = `http://127.0.0.1:${port}`;
const mailpit = `http://${process.env.MAILPIT_SMTP_HOST}:${process.env.MAILPIT_UI_PORT}`;
const ids = {
  projectA: "66666666-6666-4666-8666-666666666666",
  projectB: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sessionB: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  evidenceB: "12121212-1212-4121-8121-121212121212",
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, AUTH_URL: origin, NEXTAUTH_URL: origin }, stdio: "pipe",
});

function client() {
  const cookies = new Map();
  return {
    cookie() { return [...cookies].map(([name, value]) => `${name}=${value}`).join("; "); },
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers);
      if (["POST", "PATCH", "DELETE"].includes(options.method) && !headers.has("origin")) headers.set("origin", origin);
      if (cookies.size) headers.set("cookie", this.cookie());
      const response = await fetch(path.startsWith("http") ? path : `${origin}${path}`, { ...options, headers, redirect: "manual" });
      const cookie = response.headers.get("set-cookie");
      if (cookie) for (const match of cookie.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;]*)/g)) cookies.set(match[1], match[2]);
      return response;
    },
  };
}

const json = (body, headers = {}) => ({ headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${origin}/api/auth/providers`)).ok) return; } catch {}
    await delay(250);
  }
  throw new Error("Security server did not start.");
}

async function login(email) {
  const user = client();
  const before = new Set((await (await fetch(`${mailpit}/api/v1/messages`)).json()).messages.map((message) => message.ID));
  const csrf = await user.fetch("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  const response = await user.fetch("/api/auth/signin/email", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, email, callbackUrl: "/w/fieldnote-demo/dashboard" }) });
  assert.equal(response.status, 302);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = (await (await fetch(`${mailpit}/api/v1/messages`)).json()).messages;
    const message = messages.find((candidate) => !before.has(candidate.ID) && JSON.stringify(candidate).includes(email));
    if (message) {
      const content = JSON.stringify(await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
      const link = content.match(new RegExp(`http://127\\.0\\.0\\.1:${port}/api/auth/callback/email\\?[^\\s"<\\\\]+`))?.[0];
      assert.ok(link);
      await user.fetch(link);
      return user;
    }
    await delay(250);
  }
  throw new Error(`Magic link not delivered for ${email}.`);
}

test("security boundaries reject adversarial HTTP input", async () => {
  await waitForServer();
  await fetch(`${mailpit}/api/v1/messages`, { method: "DELETE" });

  const unknownUser = client();
  const unknownCsrf = await unknownUser.fetch("/api/auth/csrf");
  const { csrfToken: unknownCsrfToken } = await unknownCsrf.json();
  const unknownResponse = await unknownUser.fetch("/api/auth/signin/email", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: unknownCsrfToken, email: "missing@benchmark.test", callbackUrl: "/w/fieldnote-demo/dashboard" }) });
  assert.equal(unknownResponse.status, 302);
  assert.doesNotMatch(unknownResponse.headers.get("location") ?? "", /error=/);
  assert.equal((await (await fetch(`${mailpit}/api/v1/messages`)).json()).messages.length, 0);

  const publicResponse = await fetch(`${origin}/`);
  assert.match(publicResponse.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'/);
  assert.equal(publicResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(publicResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(publicResponse.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(publicResponse.headers.get("strict-transport-security"), null, "HSTS is deployment-dependent and absent on local HTTP.");

  const anonymous = client();
  assert.equal((await anonymous.fetch(`/api/v1/projects/${ids.projectA}`)).status, 401);
  assert.equal((await anonymous.fetch(`/api/v1/projects/${ids.projectA}`, { method: "PATCH", ...json({ name: "Denied" }) })).status, 401);
  assert.equal((await fetch(`${origin}/api/benchmark/authenticated`, { headers: { cookie: "next-auth.session-token=altered.jwt.value" } })).status, 401);

  const owner = await login("owner@benchmark.test");
  const researcher = await login("researcher@benchmark.test");
  const before = await owner.fetch(`/api/v1/projects/${ids.projectA}`);
  const beforeProject = await before.json();

  const csrfAttempt = await researcher.fetch(`/api/v1/projects/${ids.projectA}`, {
    method: "PATCH", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ name: "Cross-site" }),
  });
  assert.equal(csrfAttempt.status, 403);
  assert.equal((await (await owner.fetch(`/api/v1/projects/${ids.projectA}`)).json()).name, beforeProject.name);

  for (const path of [`/api/v1/projects/${ids.projectB}`, `/api/v1/projects/${ids.projectB}/sessions`, `/api/v1/projects/${ids.projectB}/themes`, `/api/v1/sessions/${ids.sessionB}/evidences`]) {
    const response = await owner.fetch(path);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: { code: "FORBIDDEN", message: "Access denied" } });
  }
  assert.equal((await owner.fetch(`/api/v1/evidences/${ids.evidenceB}`, { method: "PATCH", ...json({ text: "IDOR" }) })).status, 403);
  assert.equal((await owner.fetch(`/api/v1/projects/${ids.projectB}/archive`, { method: "POST" })).status, 403);

  const invalidBodies = [
    {}, { name: "x".repeat(101), objective: "x" }, { name: "x", objective: "x", workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", role: "OWNER", ownerId: "x", createdAt: "2020-01-01" },
    { name: null, objective: [] }, { name: "x", objective: "x", membership: { role: "OWNER" } },
  ];
  for (const body of invalidBodies) assert.equal((await researcher.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json(body) })).status, 422);
  assert.equal((await researcher.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{" })).status, 422);
  assert.equal((await researcher.fetch(`/api/v1/sessions/${ids.projectA}/evidences`, { method: "POST", ...json({ text: "x".repeat(5001), kind: "NOTE", tags: Array(11).fill("tag") }, { "idempotency-key": "oversized" }) })).status, 422);

  const injection = "<script>alert(1)</script> ' OR 1=1 -- javascript:alert(1)";
  const created = await researcher.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json({ name: injection, objective: injection }) });
  assert.equal(created.status, 201);
  const project = await created.json();
  assert.equal(project.name, injection);
  assert.equal((await (await researcher.fetch(`/api/v1/projects/${project.id}`)).json()).objective, injection);

  const stolenCookie = owner.cookie();
  const csrf = await owner.fetch("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  assert.equal((await owner.fetch("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: "/" }) })).status, 302);
  assert.equal((await fetch(`${origin}/api/benchmark/authenticated`, { headers: { cookie: stolenCookie } })).status, 401);
});

after(() => server.kill());
