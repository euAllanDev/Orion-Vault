import { loadLocalEnv } from "./local-env.mjs";

loadLocalEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  viewer: "22222222-2222-4222-8222-222222222222",
  researcher: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
  workspaceA: "55555555-5555-4555-8555-555555555555",
  projectA: "66666666-6666-4666-8666-666666666666",
  participantA: "77777777-7777-4777-8777-777777777777",
  participantB: "14141414-1414-4141-8141-141414141414",
  sessionA: "88888888-8888-4888-8888-888888888888",
  evidenceA: "99999999-9999-4999-8999-999999999999",
  themeA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outsider: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  workspaceB: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  projectB: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  sessionB: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  evidenceB: "12121212-1212-4121-8121-121212121212",
  themeB: "13131313-1313-4131-8131-131313131313",
};

async function main() {
  await prisma.verificationToken.deleteMany();
  await prisma.themeEvidence.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.session.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.project.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { id: ids.owner, email: "owner@benchmark.test", name: "Researcher Demo" },
      { id: ids.viewer, email: "viewer@benchmark.test", name: "Viewer Demo" },
      { id: ids.researcher, email: "researcher@benchmark.test", name: "Researcher Benchmark" },
      { id: ids.admin, email: "admin@benchmark.test", name: "Admin Benchmark" },
      { id: ids.ownerB, email: "owner-b@benchmark.test", name: "Workspace B Owner" },
      { id: ids.outsider, email: "outsider@benchmark.test", name: "No Membership Benchmark" },
    ],
  });

  await prisma.workspace.create({
    data: {
      id: ids.workspaceA,
      slug: "fieldnote-demo",
      name: "Fieldnote Demo",
      plan: "FREE",
      memberships: {
        create: [
          { userId: ids.owner, role: "OWNER" },
          { userId: ids.viewer, role: "VIEWER" },
          { userId: ids.researcher, role: "RESEARCHER" },
          { userId: ids.admin, role: "ADMIN" },
        ],
      },
      projects: {
        create: {
          id: ids.projectA,
          name: "Onboarding mobile",
          objective: "Testar confianca durante troca de dispositivo.",
          status: "ACTIVE",
          createdById: ids.owner,
          participants: {
            create: {
              id: ids.participantA,
              displayName: "Participant A",
              consentStatus: "GRANTED",
              metadata: {},
            },
          },
        },
      },
    },
  });

  await prisma.session.create({
    data: {
      id: ids.sessionA,
      projectId: ids.projectA,
      participantId: ids.participantA,
      scheduledAt: new Date("2026-09-12T10:00:00.000Z"),
      method: "USABILITY_TEST",
      status: "COMPLETED",
      guide: "Benchmark research guide.",
    },
  });

  await prisma.evidence.create({
    data: {
      id: ids.evidenceA,
      sessionId: ids.sessionA,
      text: "Participant requested confirmation before continuing.",
      kind: "OBSERVATION",
      timestampSeconds: 184,
      tags: ["onboarding", "trust"],
    },
  });

  await prisma.theme.create({
    data: {
      id: ids.themeA,
      projectId: ids.projectA,
      title: "Medo de perder dados",
      summary: "Participantes buscam confirmacao antes de trocar de dispositivo.",
      confidence: "MEDIUM",
      evidences: { create: { evidenceId: ids.evidenceA } },
    },
  });

  await prisma.workspace.create({
    data: {
      id: ids.workspaceB,
      slug: "workspace-benchmark-b",
      name: "Workspace Benchmark B",
      plan: "FREE",
      memberships: { create: { userId: ids.ownerB, role: "OWNER" } },
      projects: { create: { id: ids.projectB, name: "Isolated project B", objective: "Verify workspace isolation.", status: "ACTIVE", createdById: ids.ownerB, participants: { create: { id: ids.participantB, displayName: "Participant B", consentStatus: "GRANTED", metadata: {} } } } },
    },
  });

  await prisma.session.create({ data: { id: ids.sessionB, projectId: ids.projectB, scheduledAt: new Date("2026-09-13T10:00:00.000Z"), method: "INTERVIEW", status: "PLANNED" } });
  await prisma.evidence.create({ data: { id: ids.evidenceB, sessionId: ids.sessionB, text: "Private workspace B evidence.", kind: "NOTE", tags: ["private"] } });
  await prisma.theme.create({ data: { id: ids.themeB, projectId: ids.projectB, title: "Private B theme", summary: "Must not leak to workspace A.", confidence: "LOW" } });
}

main()
  .then(() => console.log("Seeded deterministic benchmark fixtures."))
  .finally(() => prisma.$disconnect());
