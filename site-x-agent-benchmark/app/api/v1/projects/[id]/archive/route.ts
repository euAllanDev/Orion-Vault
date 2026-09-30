import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { apiError } from "@/lib/api";
import { requireProject, requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id, Role.ADMIN); if (project.status === "ARCHIVED") return NextResponse.json({ error: { code: "CONFLICT", message: "Project already archived." } }, { status: 409 }); await db.project.update({ where: { id: project.id }, data: { status: "ARCHIVED" } }); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error); } }
