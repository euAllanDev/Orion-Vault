import { MembershipRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const roleRank = {
  VIEWER: 0,
  RESEARCHER: 1,
  ADMIN: 2,
  OWNER: 3,
} satisfies Record<MembershipRole, number>;

export class AccessDeniedError extends Error {
  constructor() {
    super("Access denied");
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
  }
}

export async function requireAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new AuthenticationRequiredError();

  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, email: true } });
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export async function requireWorkspaceRole(userId: string, workspaceId: string, minimumRole: MembershipRole) {
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!membership || roleRank[membership.role] < roleRank[minimumRole]) throw new AccessDeniedError();
  return membership;
}

export function denyIfMissing<T>(resource: T | null): T {
  if (!resource) throw new AccessDeniedError();
  return resource;
}
