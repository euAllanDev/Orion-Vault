import { EvidenceKind, MembershipRole, SessionMethod, SessionStatus, ThemeConfidence } from "@prisma/client";
import { AccessDeniedError, denyIfMissing, requireWorkspaceRole } from "@/lib/authorization";
import { db } from "@/lib/db";

async function requireProjectRead(userId: string, workspaceId: string, projectId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.VIEWER);
  return denyIfMissing(await db.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } }));
}

async function requireProjectWrite(userId: string, workspaceId: string, projectId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  return denyIfMissing(await db.project.findFirst({ where: { id: projectId, workspaceId, status: "ACTIVE" }, select: { id: true } }));
}

async function requireSessionRead(userId: string, workspaceId: string, sessionId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.VIEWER);
  return denyIfMissing(await db.session.findFirst({ where: { id: sessionId, project: { workspaceId } }, select: { id: true } }));
}

export async function listSessions(userId: string, workspaceId: string, projectId: string) {
  await requireProjectRead(userId, workspaceId, projectId);
  return db.session.findMany({ where: { projectId } });
}

export async function listParticipants(userId: string, workspaceId: string, projectId: string) {
  await requireProjectRead(userId, workspaceId, projectId);
  return db.participant.findMany({ where: { projectId }, select: { id: true, displayName: true, consentStatus: true } });
}

export async function createSession(userId: string, workspaceId: string, projectId: string, input: {
  participantId?: string | null;
  scheduledAt: Date;
  method: SessionMethod;
  status: SessionStatus;
  guide?: string | null;
}) {
  await requireProjectWrite(userId, workspaceId, projectId);
  if (input.participantId) {
    denyIfMissing(await db.participant.findFirst({ where: { id: input.participantId, projectId }, select: { id: true } }));
  }
  return db.session.create({ data: { ...input, projectId } });
}

export async function listEvidence(userId: string, workspaceId: string, sessionId: string) {
  await requireSessionRead(userId, workspaceId, sessionId);
  return db.evidence.findMany({ where: { sessionId } });
}

export async function createEvidence(userId: string, workspaceId: string, sessionId: string, input: {
  text: string;
  kind: EvidenceKind;
  timestampSeconds?: number | null;
  tags: string[];
}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  denyIfMissing(await db.session.findFirst({ where: { id: sessionId, project: { workspaceId, status: "ACTIVE" } }, select: { id: true } }));
  return db.evidence.create({ data: { ...input, sessionId } });
}

export async function createEvidenceIdempotently(userId: string, workspaceId: string, sessionId: string, key: string, input: {
  text: string;
  kind: EvidenceKind;
  timestampSeconds?: number | null;
  tags: string[];
}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  denyIfMissing(await db.session.findFirst({ where: { id: sessionId, project: { workspaceId, status: "ACTIVE" } }, select: { id: true } }));
  const previous = await db.evidenceRequest.findUnique({ where: { workspaceId_userId_key: { workspaceId, userId, key } }, include: { evidence: true } });
  if (previous) return { evidence: previous.evidence, created: false };

  try {
    return await db.$transaction(async (tx) => {
      const evidence = await tx.evidence.create({ data: { ...input, sessionId } });
      await tx.evidenceRequest.create({ data: { workspaceId, userId, key, evidenceId: evidence.id } });
      return { evidence, created: true };
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("EvidenceRequest_pkey")) throw error;
    const existing = await db.evidenceRequest.findUniqueOrThrow({ where: { workspaceId_userId_key: { workspaceId, userId, key } }, include: { evidence: true } });
    return { evidence: existing.evidence, created: false };
  }
}

export async function updateEvidence(userId: string, workspaceId: string, evidenceId: string, input: {
  text?: string;
  kind?: EvidenceKind;
  timestampSeconds?: number | null;
  tags?: string[];
}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  const result = await db.evidence.updateMany({ where: { id: evidenceId, session: { project: { workspaceId, status: "ACTIVE" } } }, data: input });
  if (result.count !== 1) throw new AccessDeniedError();
  return denyIfMissing(await db.evidence.findFirst({ where: { id: evidenceId, session: { project: { workspaceId } } } }));
}

export async function deleteEvidence(userId: string, workspaceId: string, evidenceId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  const result = await db.evidence.deleteMany({ where: { id: evidenceId, session: { project: { workspaceId, status: "ACTIVE" } } } });
  if (result.count !== 1) throw new AccessDeniedError();
}

export async function updateTheme(userId: string, workspaceId: string, themeId: string, input: {
  title?: string;
  summary?: string;
  confidence?: ThemeConfidence;
}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  const result = await db.theme.updateMany({ where: { id: themeId, project: { workspaceId, status: "ACTIVE" } }, data: input });
  if (result.count !== 1) throw new AccessDeniedError();
}

export class InvalidThemeEvidenceError extends Error {
  constructor() { super("Theme evidence must belong to the project"); }
}

export async function listThemes(userId: string, workspaceId: string, projectId: string) {
  await requireProjectRead(userId, workspaceId, projectId);
  return db.theme.findMany({ where: { projectId }, include: { evidences: { select: { evidenceId: true } } } });
}

export async function createTheme(userId: string, workspaceId: string, projectId: string, input: { title: string; summary: string; confidence: ThemeConfidence; evidenceIds: string[] }) {
  await requireProjectWrite(userId, workspaceId, projectId);
  const evidenceCount = await db.evidence.count({ where: { id: { in: input.evidenceIds }, session: { projectId } } });
  if (evidenceCount !== input.evidenceIds.length) throw new InvalidThemeEvidenceError();
  return db.theme.create({ data: { projectId, title: input.title, summary: input.summary, confidence: input.confidence, evidences: { create: input.evidenceIds.map((evidenceId) => ({ evidenceId })) } }, include: { evidences: { select: { evidenceId: true } } } });
}
