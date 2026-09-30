import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const rank: Record<Role, number> = { VIEWER: 0, RESEARCHER: 1, ADMIN: 2, OWNER: 3 };

export class AccessDeniedError extends Error {}

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) throw new AccessDeniedError();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new AccessDeniedError();
  return user;
}

export async function requireWorkspaceRole(userId: string, workspaceId: string, minimum: Role = Role.VIEWER) {
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!membership || rank[membership.role] < rank[minimum]) throw new AccessDeniedError();
  return membership;
}

export async function requireWorkspaceBySlug(userId: string, slug: string, minimum: Role = Role.VIEWER) {
  const workspace = await db.workspace.findUnique({ where: { slug } });
  if (!workspace) throw new AccessDeniedError();
  await requireWorkspaceRole(userId, workspace.id, minimum);
  return workspace;
}

export async function requireProject(userId: string, projectId: string, minimum: Role = Role.VIEWER) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AccessDeniedError();
  await requireWorkspaceRole(userId, project.workspaceId, minimum);
  return project;
}

export async function requireSession(userId: string, sessionId: string, minimum: Role = Role.VIEWER) {
  const session = await db.session.findUnique({ where: { id: sessionId }, include: { project: true } });
  if (!session) throw new AccessDeniedError();
  await requireWorkspaceRole(userId, session.project.workspaceId, minimum);
  return session;
}

export async function requireEvidence(userId: string, evidenceId: string, minimum: Role = Role.RESEARCHER) {
  const evidence = await db.evidence.findUnique({ where: { id: evidenceId }, include: { session: { include: { project: true } } } });
  if (!evidence) throw new AccessDeniedError();
  await requireWorkspaceRole(userId, evidence.session.project.workspaceId, minimum);
  return evidence;
}
