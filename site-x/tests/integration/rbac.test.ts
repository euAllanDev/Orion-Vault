import assert from "node:assert/strict";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { AccessDeniedError } from "../../src/lib/authorization";
import { archiveProject, createProject, getProject, listProjects, updateProject } from "../../src/lib/repositories/project-repository";
import { createEvidence, createSession, listEvidence, listSessions, updateTheme } from "../../src/lib/repositories/research-repository";

const prisma = new PrismaClient();
const ids = {
  ownerA: "11111111-1111-4111-8111-111111111111",
  viewerA: "22222222-2222-4222-8222-222222222222",
  researcherA: "33333333-3333-4333-8333-333333333333",
  adminA: "44444444-4444-4444-8444-444444444444",
  workspaceA: "55555555-5555-4555-8555-555555555555",
  projectA: "66666666-6666-4666-8666-666666666666",
  sessionA: "88888888-8888-4888-8888-888888888888",
  themeA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outsider: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  workspaceB: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  projectB: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sessionB: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  themeB: "13131313-1313-4131-8131-131313131313",
};

function denied(operation: () => Promise<unknown>) {
  return assert.rejects(operation, AccessDeniedError);
}

test("RBAC repositories enforce membership, role, workspace scope, and client-input isolation", async (t) => {
  await t.test("authorized member reads only its workspace projects", async () => {
    const projects = await listProjects(ids.ownerA, ids.workspaceA);
    assert.deepEqual(projects.map((project) => project.id), [ids.projectA]);
    assert.equal((await listSessions(ids.ownerA, ids.workspaceA, ids.projectA)).length, 1);
    assert.equal((await listEvidence(ids.ownerA, ids.workspaceA, ids.sessionA)).length, 1);
    assert.equal((await getProject(ids.ownerB, ids.workspaceB, ids.projectB)).name, "Isolated project B");
  });

  await t.test("researcher can create and update, while viewer cannot write", async () => {
    const project = await createProject(ids.researcherA, ids.workspaceA, { name: "Researcher project", objective: "Authorized write." });
    await updateProject(ids.researcherA, ids.workspaceA, project.id, { name: "Updated by researcher" });
    assert.equal((await prisma.project.findUnique({ where: { id: project.id } }))?.name, "Updated by researcher");
    const evidence = await createEvidence(ids.researcherA, ids.workspaceA, ids.sessionA, { text: "Authorized workspace A evidence.", kind: "NOTE", tags: ["rbac"] });
    assert.equal(evidence.sessionId, ids.sessionA);
    const session = await createSession(ids.researcherA, ids.workspaceA, ids.projectA, { scheduledAt: new Date("2026-09-16T10:00:00.000Z"), method: "INTERVIEW", status: "PLANNED" });
    assert.equal(session.projectId, ids.projectA);
    await denied(() => createProject(ids.viewerA, ids.workspaceA, { name: "Denied", objective: "Viewer write." }));
    await denied(() => updateProject(ids.viewerA, ids.workspaceA, ids.projectA, { name: "Denied viewer update" }));
  });

  await t.test("only admin or owner archives project", async () => {
    await denied(() => archiveProject(ids.researcherA, ids.workspaceA, ids.projectA));
    await archiveProject(ids.adminA, ids.workspaceA, ids.projectA);
    assert.equal((await prisma.project.findUnique({ where: { id: ids.projectA } }))?.status, "ARCHIVED");
    await denied(() => updateProject(ids.adminA, ids.workspaceA, ids.projectA, { name: "Archived projects are read-only" }));
  });

  await t.test("missing membership, unknown resource, and cross-workspace IDs deny without data", async () => {
    await denied(() => listProjects(ids.outsider, ids.workspaceA));
    await denied(() => getProject(ids.ownerA, ids.workspaceA, "00000000-0000-4000-8000-000000000000"));
    await denied(() => getProject(ids.ownerA, ids.workspaceA, ids.projectB));
    await denied(() => listSessions(ids.ownerA, ids.workspaceA, ids.projectB));
    await denied(() => listEvidence(ids.ownerA, ids.workspaceA, ids.sessionB));
  });

  await t.test("tampered resource IDs cannot create evidence or alter themes across workspaces", async () => {
    await denied(() => createEvidence(ids.researcherA, ids.workspaceA, ids.sessionB, { text: "Cross-workspace write", kind: "NOTE", tags: [] }));
    await denied(() => updateTheme(ids.researcherA, ids.workspaceA, ids.themeB, { title: "Tampered by A" }));
    assert.equal((await prisma.theme.findUnique({ where: { id: ids.themeB } }))?.title, "Private B theme");
  });

  await t.test("workspace B remains writable only by its own membership", async () => {
    await updateTheme(ids.ownerB, ids.workspaceB, ids.themeB, { title: "Updated by B owner" });
    assert.equal((await prisma.theme.findUnique({ where: { id: ids.themeB } }))?.title, "Updated by B owner");
    await denied(() => updateProject(ids.ownerB, ids.workspaceB, ids.projectA, { name: "Cross-workspace project update" }));
    assert.equal((await prisma.project.findUnique({ where: { id: ids.projectA } }))?.name, "Onboarding mobile");
  });
});

after(async () => prisma.$disconnect());
