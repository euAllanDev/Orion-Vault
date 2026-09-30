import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { apiError, evidenceInput } from "@/lib/api";
import { requireSession, requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const session = await requireSession(user.id, (await params).id, Role.RESEARCHER);
    const key = request.headers.get("idempotency-key"); if (!key || key.length > 128) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Valid Idempotency-Key required." } }, { status: 422 });
    const input = evidenceInput.parse(await request.json()); const workspaceId = session.project.workspaceId;
    const existing = await db.evidenceRequest.findUnique({ where: { workspaceId_userId_key: { workspaceId, userId: user.id, key } }, include: { evidence: true } });
    if (existing) return NextResponse.json({ id: existing.evidence.id, sessionId: existing.evidence.sessionId, createdAt: existing.evidence.createdAt }, { status: 200 });
    const evidence = await db.$transaction(async (tx) => { const created = await tx.evidence.create({ data: { ...input, sessionId: session.id } }); await tx.evidenceRequest.create({ data: { workspaceId, userId: user.id, key, evidenceId: created.id } }); return created; });
    return NextResponse.json({ id: evidence.id, sessionId: evidence.sessionId, createdAt: evidence.createdAt }, { status: 201 });
  } catch (error) { return apiError(error); }
}
