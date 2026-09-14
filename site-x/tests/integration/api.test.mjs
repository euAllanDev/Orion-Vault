import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test, { after } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { loadLocalEnv } from "../../prisma/local-env.mjs";

loadLocalEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const port = 3010;
const origin = `http://127.0.0.1:${port}`;
const mailpitOrigin = `http://${process.env.MAILPIT_SMTP_HOST}:${process.env.MAILPIT_UI_PORT}`;
const ids = {
  projectA: "66666666-6666-4666-8666-666666666666",
  sessionA: "88888888-8888-4888-8888-888888888888",
  projectB: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sessionB: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  evidenceB: "12121212-1212-4121-8121-121212121212",
  participantA: "77777777-7777-4777-8777-777777777777",
  participantB: "14141414-1414-4141-8141-141414141414",
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, AUTH_URL: origin, NEXTAUTH_URL: origin },
  stdio: "pipe",
});

function client() {
  const cookies = new Map();
  return {
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers);
      if (["POST", "PATCH", "DELETE"].includes(options.method) && !headers.has("origin")) headers.set("origin", origin);
      if (cookies.size) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
      const response = await fetch(path.startsWith("http") ? path : `${origin}${path}`, { ...options, headers, redirect: "manual" });
      const cookie = response.headers.get("set-cookie");
      if (cookie) for (const match of cookie.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;]*)/g)) cookies.set(match[1], match[2]);
      return response;
    },
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${origin}/api/auth/providers`)).ok) return; } catch {}
    await delay(250);
  }
  throw new Error("API test server did not start.");
}

async function mailpitMessages() {
  const response = await fetch(`${mailpitOrigin}/api/v1/messages`);
  assert.ok(response.ok, "Mailpit message API must be reachable.");
  return (await response.json()).messages;
}

async function waitForMagicLink(email, existingMessageIds) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = await mailpitMessages();
    const message = messages.find((candidate) => !existingMessageIds.has(candidate.ID) && JSON.stringify(candidate).includes(email));

    if (message) {
      const response = await fetch(`${mailpitOrigin}/api/v1/message/${message.ID}`);
      assert.ok(response.ok, "Mailpit must expose received email content.");
      const content = JSON.stringify(await response.json()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
      const link = content.match(/http:\/\/127\.0\.0\.1:3010\/api\/auth\/callback\/email\?[^\s"<\\]+/)?.[0];
      assert.ok(link, "Mailpit must contain authentication link.");
      return link;
    }

    await delay(250);
  }

  throw new Error(`Mailpit did not receive a new magic link for ${email}.`);
}

async function login(email) {
  const user = client();
  const existingMessageIds = new Set((await mailpitMessages()).map((message) => message.ID));
  const csrf = await user.fetch("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  const signIn = await user.fetch("/api/auth/signin/email", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, email, callbackUrl: "/w/fieldnote-demo/dashboard" }) });
  assert.equal(signIn.status, 302);
  const link = await waitForMagicLink(email, existingMessageIds);
  const callback = await user.fetch(link);
  assert.equal(callback.status, 302);
  assert.doesNotMatch(callback.headers.get("location") ?? "", /error=Verification/);
  const session = await user.fetch("/api/auth/session");
  assert.equal((await session.json()).user.email, email);
  return user;
}

function json(body, headers = {}) {
  return { headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) };
}

test("API v1 crosses HTTP, Auth.js, RBAC, repositories, and PostgreSQL", async (t) => {
  await waitForServer();
  const cleared = await fetch(`${mailpitOrigin}/api/v1/messages`, { method: "DELETE" });
  assert.ok(cleared.ok, "Mailpit must clear messages before API test.");
  const owner = await login("owner@benchmark.test");
  const researcher = await login("researcher@benchmark.test");
  const viewer = await login("viewer@benchmark.test");
  const outsider = await login("outsider@benchmark.test");

  await t.test("rejects unauthenticated and invalid requests with public error envelope", async () => {
    assert.equal((await client().fetch("/api/v1/workspaces/fieldnote-demo/projects")).status, 401);
    const invalid = await owner.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json({ name: "", objective: "x" }) });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
    assert.equal((await owner.fetch("/api/v1/projects/not-a-uuid")).status, 422);
    assert.equal((await owner.fetch("/api/v1/workspaces/fieldnote-demo/projects?limit=51")).status, 422);
    assert.equal((await owner.fetch("/api/v1/projects/00000000-0000-4000-8000-000000000000")).status, 403);
  });

  await t.test("creates, lists with formal filter/pagination, reads, updates, and archives projects", async () => {
    const created = await researcher.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json({ name: "API project", objective: "Persist through HTTP." }) });
    assert.equal(created.status, 201);
    const project = await created.json();
    assert.equal(project.workspaceId, "55555555-5555-4555-8555-555555555555");
    const list = await owner.fetch("/api/v1/workspaces/fieldnote-demo/projects?status=ACTIVE&limit=1");
    const listed = await list.json();
    assert.equal(list.status, 200);
    assert.equal(listed.items.length, 1);
    assert.ok("nextCursor" in listed);
    assert.equal((await owner.fetch(`/api/v1/projects/${project.id}`)).status, 200);
    const updated = await researcher.fetch(`/api/v1/projects/${project.id}`, { method: "PATCH", ...json({ name: "Updated API project" }) });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).name, "Updated API project");
    assert.equal((await owner.fetch(`/api/v1/projects/${project.id}/archive`, { method: "POST" })).status, 204);
    assert.equal((await owner.fetch(`/api/v1/projects/${project.id}/archive`, { method: "POST" })).status, 409);
    assert.equal((await researcher.fetch(`/api/v1/projects/${project.id}`, { method: "PATCH", ...json({ name: "Must fail" }) })).status, 403);
  });

  await t.test("enforces roles and rejects client attempts to grant workspace or role", async () => {
    assert.equal((await viewer.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json({ name: "Denied", objective: "Denied" }) })).status, 403);
    const tampered = await researcher.fetch("/api/v1/workspaces/fieldnote-demo/projects", { method: "POST", ...json({ name: "Tampered", objective: "Denied fields", workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", role: "OWNER" }) });
    assert.equal(tampered.status, 422);
  });

  await t.test("lists project participants only for authenticated workspace members", async () => {
    assert.equal((await client().fetch(`/api/v1/projects/${ids.projectA}/participants`)).status, 401);
    const listed = await owner.fetch(`/api/v1/projects/${ids.projectA}/participants`);
    assert.equal(listed.status, 200);
    assert.deepEqual(await listed.json(), [{ id: ids.participantA, displayName: "Participant A", consentStatus: "GRANTED" }]);
    assert.equal((await viewer.fetch(`/api/v1/projects/${ids.projectA}/participants`)).status, 200);
    assert.equal((await outsider.fetch(`/api/v1/projects/${ids.projectA}/participants`)).status, 403);
    const crossWorkspace = await owner.fetch(`/api/v1/projects/${ids.projectB}/participants`);
    assert.equal(crossWorkspace.status, 403);
    assert.deepEqual(await crossWorkspace.json(), { error: { code: "FORBIDDEN", message: "Access denied" } });
    assert.equal((await owner.fetch("/api/v1/projects/00000000-0000-4000-8000-000000000000/participants")).status, 403);
  });

  await t.test("creates sessions only under authorized active project and validates participant scope", async () => {
    const created = await researcher.fetch(`/api/v1/projects/${ids.projectA}/sessions`, { method: "POST", ...json({ participantId: ids.participantA, scheduledAt: "2026-09-20T10:00:00.000Z", method: "INTERVIEW", status: "PLANNED" }) });
    assert.equal(created.status, 201);
    assert.equal((await owner.fetch(`/api/v1/projects/${ids.projectA}/sessions`)).status, 200);
    assert.equal((await researcher.fetch(`/api/v1/projects/${ids.projectA}/sessions`, { method: "POST", ...json({ participantId: ids.participantB, scheduledAt: "2026-09-20T10:00:00.000Z", method: "INTERVIEW", status: "PLANNED" }) })).status, 403);
  });

  await t.test("creates evidence idempotently, updates and deletes it", async () => {
    const payload = { text: "API evidence", kind: "QUOTE", timestampSeconds: 12, tags: ["api"] };
    const first = await researcher.fetch(`/api/v1/sessions/${ids.sessionA}/evidences`, { method: "POST", ...json(payload, { "idempotency-key": "api-evidence-1" }) });
    const second = await researcher.fetch(`/api/v1/sessions/${ids.sessionA}/evidences`, { method: "POST", ...json(payload, { "idempotency-key": "api-evidence-1" }) });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    const evidence = await first.json();
    assert.equal((await second.json()).id, evidence.id);
    const divergent = await researcher.fetch(`/api/v1/sessions/${ids.sessionA}/evidences`, { method: "POST", ...json({ ...payload, text: "Divergent retry payload" }, { "idempotency-key": "api-evidence-1" }) });
    assert.equal(divergent.status, 200);
    assert.equal((await divergent.json()).id, evidence.id);
    assert.equal((await researcher.fetch(`/api/v1/evidences/${evidence.id}`, { method: "PATCH", ...json({ text: "Edited API evidence" }) })).status, 200);
    assert.equal((await researcher.fetch(`/api/v1/evidences/${evidence.id}`, { method: "DELETE" })).status, 204);
    assert.equal(await prisma.evidenceRequest.findUnique({ where: { workspaceId_userId_key: { workspaceId: "55555555-5555-4555-8555-555555555555", userId: "33333333-3333-4333-8333-333333333333", key: "api-evidence-1" } } }), null);
    assert.equal(await prisma.evidence.findUnique({ where: { id: evidence.id } }), null);
    const retriedAfterDelete = await researcher.fetch(`/api/v1/sessions/${ids.sessionA}/evidences`, { method: "POST", ...json(payload, { "idempotency-key": "api-evidence-1" }) });
    assert.equal(retriedAfterDelete.status, 201);
    const recreated = await retriedAfterDelete.json();
    assert.notEqual(recreated.id, evidence.id);
    assert.equal((await researcher.fetch(`/api/v1/evidences/${recreated.id}`, { method: "DELETE" })).status, 204);
  });

  await t.test("blocks cross-workspace reads and writes without leaking resource data", async () => {
    const read = await owner.fetch(`/api/v1/projects/${ids.projectB}`);
    assert.equal(read.status, 403);
    assert.deepEqual(await read.json(), { error: { code: "FORBIDDEN", message: "Access denied" } });
    assert.equal((await researcher.fetch(`/api/v1/sessions/${ids.sessionB}/evidences`, { method: "POST", ...json({ text: "Cross workspace", kind: "NOTE", tags: [] }, { "idempotency-key": "cross-workspace" }) })).status, 403);
    assert.equal((await researcher.fetch(`/api/v1/evidences/${ids.evidenceB}`, { method: "PATCH", ...json({ text: "Leak attempt" }) })).status, 403);
    assert.equal((await researcher.fetch(`/api/v1/evidences/${ids.evidenceB}`, { method: "DELETE" })).status, 403);
    assert.equal((await researcher.fetch("/api/v1/evidences/00000000-0000-4000-8000-000000000000", { method: "DELETE" })).status, 403);
    assert.equal((await viewer.fetch("/api/v1/evidences/99999999-9999-4999-8999-999999999999", { method: "DELETE" })).status, 403);
  });

  await t.test("creates and lists themes only with same-project evidence IDs", async () => {
    const theme = await researcher.fetch(`/api/v1/projects/${ids.projectA}/themes`, { method: "POST", ...json({ title: "API theme", summary: "Linked source.", confidence: "HIGH", evidenceIds: ["99999999-9999-4999-8999-999999999999"] }) });
    assert.equal(theme.status, 201);
    assert.equal((await owner.fetch(`/api/v1/projects/${ids.projectA}/themes`)).status, 200);
    assert.equal((await researcher.fetch(`/api/v1/projects/${ids.projectA}/themes`, { method: "POST", ...json({ title: "Invalid", summary: "Cross project.", confidence: "LOW", evidenceIds: [ids.evidenceB] }) })).status, 422);
  });
});

after(async () => {
  server.kill();
  await prisma.$disconnect();
});
