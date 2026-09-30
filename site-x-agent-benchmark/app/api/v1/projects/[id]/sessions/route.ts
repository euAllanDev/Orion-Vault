import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { apiError, sessionInput } from "@/lib/api";
import { requireProject, requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id); return NextResponse.json(await db.session.findMany({ where: { projectId: project.id } })); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const project = await requireProject(user.id, (await params).id, Role.RESEARCHER); const input = sessionInput.parse(await request.json()); if (input.participantId && !await db.participant.findFirst({ where: { id: input.participantId, projectId: project.id } })) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Participant must belong to project." } }, { status: 422 }); return NextResponse.json(await db.session.create({ data: { ...input, scheduledAt: new Date(input.scheduledAt), projectId: project.id } }), { status: 201 }); } catch (error) { return apiError(error); } }
