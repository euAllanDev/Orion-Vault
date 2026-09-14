import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test, { after } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { loadLocalEnv } from '../../prisma/local-env.mjs';

loadLocalEnv();
const port = 3011;
const origin = `http://127.0.0.1:${port}`;
const mailpit = `http://${process.env.MAILPIT_SMTP_HOST}:${process.env.MAILPIT_UI_PORT}`;
const projectA = '66666666-6666-4666-8666-666666666666';
const sessionA = '88888888-8888-4888-8888-888888888888';
const projectB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const participantA = '77777777-7777-4777-8777-777777777777';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', String(port)],
  {
    env: { ...process.env, AUTH_URL: origin, NEXTAUTH_URL: origin },
    stdio: 'pipe'
  }
);

function client() {
  const cookies = new Map();
  return {
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers);
      if (['POST', 'PATCH', 'DELETE'].includes(options.method) && !headers.has('origin')) headers.set('origin', origin);
      if (cookies.size)
        headers.set(
          'cookie',
          [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
        );
      const response = await fetch(
        path.startsWith('http') ? path : `${origin}${path}`,
        { ...options, headers, redirect: 'manual' }
      );
      const cookie = response.headers.get('set-cookie');
      if (cookie)
        for (const match of cookie.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;]*)/g))
          cookies.set(match[1], match[2]);
      return response;
    }
  };
}
async function waitFor(path) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${origin}${path}`)).ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Frontend server did not start.');
}
async function login(email) {
  const user = client();
  const before = new Set(
    (await (await fetch(`${mailpit}/api/v1/messages`)).json()).messages.map(
      (message) => message.ID
    )
  );
  const csrf = await user.fetch('/api/auth/csrf');
  const { csrfToken } = await csrf.json();
  await user.fetch('/api/auth/signin/email', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      email,
      callbackUrl: '/w/fieldnote-demo/dashboard'
    })
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = (await (await fetch(`${mailpit}/api/v1/messages`)).json())
      .messages;
    const message = messages.find(
      (candidate) =>
        !before.has(candidate.ID) && JSON.stringify(candidate).includes(email)
    );
    if (message) {
      const body = JSON.stringify(
        await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json()
      )
        .replaceAll('\\u0026', '&')
        .replaceAll('&amp;', '&');
      const link = body.match(
        new RegExp(
          `http://127\\.0\\.0\\.1:${port}/api/auth/callback/email\\?[^\\s\"<\\\\]+`
        )
      )?.[0];
      assert.ok(link);
      await user.fetch(link);
      return user;
    }
    await delay(250);
  }
  throw new Error('Magic link not delivered.');
}
const json = (body, headers = {}) => ({
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

test('frontend routes use authenticated API state and preserve RBAC', async () => {
  await waitFor('/api/auth/providers');
  assert.equal(
    (await fetch(`${origin}/w/fieldnote-demo/projects`, { redirect: 'manual' }))
      .status,
    307
  );
  const researcher = await login('researcher@benchmark.test');
  const owner = await login('owner@benchmark.test');
  const page = await researcher.fetch('/w/fieldnote-demo/projects');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Carregando projetos/);
  const created = await researcher.fetch(
    '/api/v1/workspaces/fieldnote-demo/projects',
    {
      method: 'POST',
      ...json({
        name: 'Frontend project',
        objective: 'Persisted frontend flow.'
      })
    }
  );
  assert.equal(created.status, 201);
  const project = await created.json();
  assert.equal(
    (
      await researcher.fetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        ...json({ name: 'Updated frontend project' })
      })
    ).status,
    200
  );
  assert.equal(
    (
      await owner.fetch(`/api/v1/projects/${project.id}/archive`, {
        method: 'POST'
      })
    ).status,
    204
  );
  assert.equal(
    (await researcher.fetch(`/api/v1/projects/${projectA}/sessions`)).status,
    200
  );
  const participants = await researcher.fetch(
    `/api/v1/projects/${projectA}/participants`
  );
  assert.equal(participants.status, 200);
  assert.deepEqual(await participants.json(), [
    { id: participantA, displayName: 'Participant A', consentStatus: 'GRANTED' }
  ]);
  const selectedSession = await researcher.fetch(
    `/api/v1/projects/${projectA}/sessions`,
    {
      method: 'POST',
      ...json({
        participantId: participantA,
        scheduledAt: '2026-09-21T10:00:00.000Z',
        method: 'INTERVIEW',
        status: 'PLANNED'
      })
    }
  );
  assert.equal(selectedSession.status, 201);
  assert.equal((await selectedSession.json()).participantId, participantA);
  const unselectedSession = await researcher.fetch(
    `/api/v1/projects/${projectA}/sessions`,
    {
      method: 'POST',
      ...json({
        scheduledAt: '2026-09-22T10:00:00.000Z',
        method: 'INTERVIEW',
        status: 'PLANNED'
      })
    }
  );
  assert.equal(unselectedSession.status, 201);
  assert.equal((await unselectedSession.json()).participantId, null);
  const workspaceSource = await readFile(
    new URL('../../src/components/project-workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.match(
    workspaceSource,
    /\/api\/v1\/projects\/\$\{projectId\}\/participants/
  );
  assert.match(workspaceSource, /Carregando participantes/);
  assert.match(workspaceSource, /participantError/);
  assert.match(workspaceSource, /participantId \? \{ participantId \} : \{\}/);
  const evidence = await researcher.fetch(
    `/api/v1/sessions/${sessionA}/evidences`,
    {
      method: 'POST',
      ...json(
        { text: 'Frontend evidence', kind: 'NOTE', tags: ['frontend'] },
        { 'idempotency-key': 'frontend-evidence' }
      )
    }
  );
  assert.equal(evidence.status, 201);
  const createdEvidence = await evidence.json();
  assert.equal(
    (
      await researcher.fetch(`/api/v1/evidences/${createdEvidence.id}`, {
        method: 'PATCH',
        ...json({ text: 'Edited frontend evidence' })
      })
    ).status,
    200
  );
  assert.equal(
    (
      await researcher.fetch(`/api/v1/projects/${projectA}/themes`, {
        method: 'POST',
        ...json({
          title: 'Frontend theme',
          summary: 'Persisted source selection.',
          confidence: 'MEDIUM',
          evidenceIds: [createdEvidence.id]
        })
      })
    ).status,
    201
  );
  assert.equal(
    (
      await researcher.fetch(`/api/v1/evidences/${createdEvidence.id}`, {
        method: 'DELETE'
      })
    ).status,
    204
  );
  assert.equal(
    (await researcher.fetch(`/api/v1/projects/${projectB}`)).status,
    403
  );
});

after(() => server.kill());
