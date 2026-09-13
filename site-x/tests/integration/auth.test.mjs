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
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, AUTH_URL: origin, NEXTAUTH_URL: origin },
  stdio: "pipe",
});

function createClient() {
  const cookies = new Map();

  return {
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers);
      if (cookies.size) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
      const response = await fetch(path.startsWith("http") ? path : `${origin}${path}`, { ...options, headers, redirect: "manual" });
      const cookieHeader = response.headers.get("set-cookie");

      if (cookieHeader) {
        for (const match of cookieHeader.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;]*)/g)) cookies.set(match[1], match[2]);
      }

      return response;
    },
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/auth/providers`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Auth test server did not start.");
}

async function clearMailpit() {
  const response = await fetch(`${mailpitOrigin}/api/v1/messages`, { method: "DELETE" });
  assert.ok(response.ok, "Mailpit must clear messages before auth test.");
}

async function mailpitMessages() {
  const response = await fetch(`${mailpitOrigin}/api/v1/messages`);
  assert.ok(response.ok, "Mailpit message API must be reachable.");
  return (await response.json()).messages;
}

async function requestMagicLink(client, email) {
  const csrfResponse = await client.fetch("/api/auth/csrf");
  assert.equal(csrfResponse.status, 200);
  const { csrfToken } = await csrfResponse.json();
  const response = await client.fetch("/api/auth/signin/email", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, callbackUrl: "/w/fieldnote-demo/dashboard" }),
  });
  assert.equal(response.status, 302);
}

async function latestMagicLink() {
  const messages = await mailpitMessages();
  assert.ok(messages.length > 0, "Mailpit must receive a magic-link email.");
  const message = messages.at(-1);
  const response = await fetch(`${mailpitOrigin}/api/v1/message/${message.ID}`);
  assert.ok(response.ok, "Mailpit must expose received email content.");
  const content = JSON.stringify(await response.json()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
  const link = content.match(/http:\/\/127\.0\.0\.1:3010\/api\/auth\/callback\/email\?[^\s"<\\]+/)?.[0];
  assert.ok(link, "Magic-link email must contain Auth.js callback URL.");
  return link;
}

async function expectVerificationFailure(link) {
  const client = createClient();
  const response = await client.fetch(link);
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") ?? "", /error=Verification/);
}

test("Auth.js magic link persists and validates real local auth flow", async (t) => {
  await waitForServer();
  await clearMailpit();

  await t.test("rejects access without authentication", async () => {
    const response = await createClient().fetch("/api/benchmark/authenticated");
    assert.equal(response.status, 401);
  });

  const client = createClient();
  let validLink;

  await t.test("requests magic link and Mailpit receives it", async () => {
    await requestMagicLink(client, "owner@benchmark.test");
    validLink = await latestMagicLink();
    const token = await prisma.verificationToken.findFirst({ where: { identifier: "owner@benchmark.test" } });
    assert.ok(token, "Auth.js must persist a verification token in PostgreSQL.");
  });

  await t.test("valid link creates JWT session and grants authenticated access", async () => {
    const response = await client.fetch(validLink);
    assert.equal(response.status, 302);
    assert.match(response.headers.get("location") ?? "", /\/w\/fieldnote-demo\/dashboard$/);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);

    const session = await client.fetch("/api/auth/session");
    assert.equal(session.status, 200);
    const sessionBody = await session.json();
    assert.equal(sessionBody.user.email, "owner@benchmark.test");
    assert.ok(!JSON.stringify(sessionBody).includes("token"), "Session JSON must not expose magic-link token.");

    const protectedResponse = await client.fetch("/api/benchmark/authenticated");
    assert.equal(protectedResponse.status, 200);
    assert.deepEqual(await protectedResponse.json(), { authenticated: true, email: "owner@benchmark.test" });
  });

  await t.test("rejects a reused token", async () => {
    await expectVerificationFailure(validLink);
  });

  await t.test("rejects invalid token", async () => {
    await expectVerificationFailure(`${origin}/api/auth/callback/email?callbackUrl=%2Fw%2Ffieldnote-demo%2Fdashboard&token=not-a-real-token&email=owner%40benchmark.test`);
  });

  await t.test("rejects expired token", async () => {
    await requestMagicLink(createClient(), "owner@benchmark.test");
    const expiredLink = await latestMagicLink();
    const token = await prisma.verificationToken.findFirst({ where: { identifier: "owner@benchmark.test" }, orderBy: { expires: "desc" } });
    await prisma.verificationToken.update({ where: { identifier_token: { identifier: token.identifier, token: token.token } }, data: { expires: new Date(Date.now() - 1_000) } });
    await expectVerificationFailure(expiredLink);
  });

  await t.test("logs out and revokes authenticated access", async () => {
    const csrfResponse = await client.fetch("/api/auth/csrf");
    const { csrfToken } = await csrfResponse.json();
    const response = await client.fetch("/api/auth/signout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl: "/" }),
    });
    assert.equal(response.status, 302);
    const protectedResponse = await client.fetch("/api/benchmark/authenticated");
    assert.equal(protectedResponse.status, 401);
  });

  await t.test("limits repeated magic-link requests", async () => {
    const before = (await mailpitMessages()).length;
    for (let attempt = 0; attempt < 6; attempt += 1) await requestMagicLink(createClient(), "viewer@benchmark.test");
    const after = (await mailpitMessages()).length;
    assert.equal(after - before, 5, "Sixth request must not send another email.");
  });
});

after(async () => {
  server.kill();
  await prisma.$disconnect();
});
