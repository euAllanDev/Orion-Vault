import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { loadLocalEnv } from "../../prisma/local-env.mjs";

loadLocalEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const testWorkspaceIds = [];
const testUserIds = [];

async function createWorkspace(label) {
  const user = await prisma.user.create({
    data: { id: randomUUID(), email: `${label}-${randomUUID()}@benchmark.test`, name: "Benchmark User" },
  });
  const workspace = await prisma.workspace.create({
    data: { slug: `${label}-${randomUUID()}`, name: "Benchmark Workspace", plan: "FREE" },
  });
  await prisma.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
  testWorkspaceIds.push(workspace.id);
  testUserIds.push(user.id);
  return { user, workspace };
}

async function createProjectGraph(label) {
  const { user, workspace } = await createWorkspace(label);
  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      name: "Persistence project",
      objective: "Verify PostgreSQL persistence.",
      status: "ACTIVE",
    },
  });
  const participant = await prisma.participant.create({
    data: { projectId: project.id, displayName: "Participant Test", consentStatus: "GRANTED", metadata: {} },
  });
  const session = await prisma.session.create({
    data: {
      projectId: project.id,
      participantId: participant.id,
      scheduledAt: new Date("2026-09-15T09:00:00.000Z"),
      method: "INTERVIEW",
      status: "PLANNED",
    },
  });
  return { user, workspace, project, participant, session };
}

test("deterministic seed persists documented benchmark graph", async () => {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: "fieldnote-demo" },
    include: { projects: { include: { sessions: { include: { evidences: true } }, themes: { include: { evidences: true } } } } },
  });

  assert.equal(workspace?.name, "Fieldnote Demo");
  assert.equal(workspace?.projects.length, 1);
  assert.equal(workspace?.projects[0].sessions.length, 1);
  assert.equal(workspace?.projects[0].sessions[0].evidences.length, 1);
  assert.equal(workspace?.projects[0].themes[0].evidences.length, 1);
});

test("creates, reads, updates, and scopes projects by workspace", async () => {
  const first = await createProjectGraph("scope-first");
  const second = await createProjectGraph("scope-second");

  await prisma.project.update({ where: { id: first.project.id }, data: { name: "Updated persistence project" } });
  const scopedProjects = await prisma.project.findMany({ where: { workspaceId: first.workspace.id } });

  assert.deepEqual(scopedProjects.map((project) => project.id), [first.project.id]);
  assert.equal(scopedProjects[0].name, "Updated persistence project");
  assert.notEqual(first.workspace.id, second.workspace.id);
});

test("enforces membership and evidence database constraints", async () => {
  const graph = await createProjectGraph("constraints");

  await assert.rejects(
    prisma.membership.create({ data: { workspaceId: graph.workspace.id, userId: graph.user.id, role: "VIEWER" } }),
  );
  await assert.rejects(
    prisma.evidence.create({
      data: { sessionId: graph.session.id, text: "x".repeat(5001), kind: "NOTE", tags: [] },
    }),
  );
  await assert.rejects(
    prisma.evidence.create({
      data: { sessionId: graph.session.id, text: "Too many tags", kind: "NOTE", tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`) },
    }),
  );
});

test("rejects a ThemeEvidence relation across projects", async () => {
  const first = await createProjectGraph("theme-first");
  const second = await createProjectGraph("theme-second");
  const evidence = await prisma.evidence.create({
    data: { sessionId: second.session.id, text: "Second project evidence", kind: "QUOTE", tags: ["scope"] },
  });
  const theme = await prisma.theme.create({
    data: { projectId: first.project.id, title: "First theme", summary: "Project-local only.", confidence: "LOW" },
  });

  await assert.rejects(prisma.themeEvidence.create({ data: { themeId: theme.id, evidenceId: evidence.id } }));
});

after(async () => {
  await prisma.themeEvidence.deleteMany({ where: { theme: { project: { workspaceId: { in: testWorkspaceIds } } } } });
  await prisma.themeEvidence.deleteMany({ where: { evidence: { session: { project: { workspaceId: { in: testWorkspaceIds } } } } } });
  await prisma.evidence.deleteMany({ where: { session: { project: { workspaceId: { in: testWorkspaceIds } } } } });
  await prisma.theme.deleteMany({ where: { project: { workspaceId: { in: testWorkspaceIds } } } });
  await prisma.session.deleteMany({ where: { project: { workspaceId: { in: testWorkspaceIds } } } });
  await prisma.participant.deleteMany({ where: { project: { workspaceId: { in: testWorkspaceIds } } } });
  await prisma.project.deleteMany({ where: { workspaceId: { in: testWorkspaceIds } } });
  await prisma.membership.deleteMany({ where: { workspaceId: { in: testWorkspaceIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: testWorkspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.$disconnect();
});
