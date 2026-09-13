import { MembershipRole, ProjectStatus } from "@prisma/client";
import { AccessDeniedError, denyIfMissing, requireWorkspaceRole } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function listProjects(userId: string, workspaceId: string, input: { cursor?: string; limit?: number; status?: ProjectStatus } = {}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.VIEWER);
  return db.project.findMany({
    where: { workspaceId, ...(input.status ? { status: input.status } : {}) },
    include: { _count: { select: { sessions: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: (input.limit ?? 50) + 1,
  });
}

export async function listProjectsPage(userId: string, workspaceId: string, input: { cursor?: string; limit?: number; status?: ProjectStatus }) {
  const projects = await listProjects(userId, workspaceId, input);
  const limit = input.limit ?? 50;
  return { items: projects.slice(0, limit), nextCursor: projects.length > limit ? projects[limit].id : null };
}

export async function getProject(userId: string, workspaceId: string, projectId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.VIEWER);
  return denyIfMissing(await db.project.findFirst({ where: { id: projectId, workspaceId } }));
}

export async function createProject(userId: string, workspaceId: string, input: {
  name: string;
  objective: string;
}) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  return db.project.create({ data: { ...input, workspaceId, createdById: userId, status: ProjectStatus.ACTIVE } });
}

export async function updateProject(userId: string, workspaceId: string, projectId: string, input: { name?: string; objective?: string }) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.RESEARCHER);
  const result = await db.project.updateMany({ where: { id: projectId, workspaceId, status: ProjectStatus.ACTIVE }, data: input });
  if (result.count !== 1) throw new AccessDeniedError();
  return getProject(userId, workspaceId, projectId);
}

export class ProjectArchivedError extends Error {
  constructor() { super("Project already archived"); }
}

export async function archiveProject(userId: string, workspaceId: string, projectId: string) {
  await requireWorkspaceRole(userId, workspaceId, MembershipRole.ADMIN);
  const project = denyIfMissing(await db.project.findFirst({ where: { id: projectId, workspaceId }, select: { status: true } }));
  if (project.status === ProjectStatus.ARCHIVED) throw new ProjectArchivedError();
  await db.project.update({ where: { id: projectId }, data: { status: ProjectStatus.ARCHIVED } });
}
