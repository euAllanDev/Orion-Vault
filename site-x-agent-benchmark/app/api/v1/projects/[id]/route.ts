import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { apiError, projectInput } from "@/lib/api";
import { requireProject, requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); return NextResponse.json(await requireProject(user.id, (await params).id)); } catch (error) { return apiError(error); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id, Role.RESEARCHER); if (project.status === "ARCHIVED") return NextResponse.json({ error: { code: "CONFLICT", message: "Archived projects are read-only." } }, { status: 409 }); return NextResponse.json(await db.project.update({ where: { id: project.id }, data: projectInput.partial().parse(await request.json()) })); } catch (error) { return apiError(error); } }
