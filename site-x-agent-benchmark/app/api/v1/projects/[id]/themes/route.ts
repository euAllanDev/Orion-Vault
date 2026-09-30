import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { apiError, themeInput } from "@/lib/api";
import { requireProject, requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id); return NextResponse.json(await db.theme.findMany({ where: { projectId: project.id }, include: { evidences: true } })); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id, Role.RESEARCHER); const input = themeInput.parse(await request.json()); const valid = await db.evidence.count({ where: { id: { in: input.evidenceIds }, session: { projectId: project.id } } }); if (valid !== input.evidenceIds.length) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Evidence must belong to project." } }, { status: 422 }); return NextResponse.json(await db.theme.create({ data: { projectId: project.id, title: input.title, summary: input.summary, confidence: input.confidence, evidences: { create: input.evidenceIds.map((evidenceId) => ({ evidenceId })) } } }), { status: 201 }); } catch (error) { return apiError(error); } }
