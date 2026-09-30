import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

test("deterministic seed persists documented workspace graph", async () => {
  const workspace = await db.workspace.findUnique({ where: { slug: "fieldnote-demo" }, include: { memberships: true, projects: { include: { sessions: { include: { evidences: true } }, themes: true } } } });
  assert.ok(workspace);
  assert.equal(workspace.memberships.length, 3);
  assert.equal(workspace.projects[0]?.sessions[0]?.evidences.length, 1);
  assert.equal(workspace.projects[0]?.themes[0]?.title, "Medo de perder dados");
});

test.after(async () => db.$disconnect());
