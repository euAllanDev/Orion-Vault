import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceProvider } from "@/components/workspace-context";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/authorization";
import { db } from "@/lib/db";
import { MembershipRole } from "@prisma/client";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspaceSlug: string }> }) {
  const user = await requireAuthenticatedUser();
  const workspace = await db.workspace.findUnique({ where: { slug: (await params).workspaceSlug }, select: { id: true, slug: true, name: true } });
  if (!workspace) notFound();
  const membership = await requireWorkspaceRole(user.id, workspace.id, MembershipRole.VIEWER);
  return <WorkspaceProvider value={{ slug: workspace.slug, name: workspace.name, role: membership.role, userName: user.email, email: user.email }}>{children}</WorkspaceProvider>;
}
