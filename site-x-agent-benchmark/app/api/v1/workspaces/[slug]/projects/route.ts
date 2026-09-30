import { NextRequest, NextResponse } from "next/server";
import { ProjectStatus, Role } from "@prisma/client";
import { apiError, projectInput } from "@/lib/api";
import { requireUser, requireWorkspaceBySlug } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try { const user = await requireUser(); const workspace = await requireWorkspaceBySlug(user.id, (await params).slug); const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 20), 50); if (!Number.isInteger(limit) || limit < 1) throw new Error("invalid limit"); const status = request.nextUrl.searchParams.get("status") as ProjectStatus | null; if (status && !Object.values(ProjectStatus).includes(status)) throw new Error("invalid status"); const items = await db.project.findMany({ where: { workspaceId: workspace.id, ...(status ? { status } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit }); return NextResponse.json({ items, nextCursor: null }); } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try { const user = await requireUser(); const workspace = await requireWorkspaceBySlug(user.id, (await params).slug, Role.RESEARCHER); const input = projectInput.parse(await request.json()); return NextResponse.json(await db.project.create({ data: { ...input, workspaceId: workspace.id, createdBy: user.id } }), { status: 201 }); } catch (error) { return apiError(error); }
}
