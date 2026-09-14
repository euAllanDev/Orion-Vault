import { apiResponse, parseInput, parseJson, requireSameOriginMutation, resolveSessionWorkspace } from "@/lib/api";
import { evidenceInput, idempotencyKey, uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { createEvidenceIdempotently, listEvidence } from "@/lib/repositories/research-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return apiResponse(async () => {
    const sessionId = parseInput(uuid, (await params).sessionId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveSessionWorkspace(sessionId);
    return Response.json(await listEvidence(user.id, workspace.project.workspaceId, sessionId));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return apiResponse(async () => {
    requireSameOriginMutation(request);
    const sessionId = parseInput(uuid, (await params).sessionId);
    const key = parseInput(idempotencyKey, request.headers.get("idempotency-key"));
    const input = parseInput(evidenceInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveSessionWorkspace(sessionId);
    const result = await createEvidenceIdempotently(user.id, workspace.project.workspaceId, sessionId, key, input);
    return Response.json({ id: result.evidence.id, sessionId: result.evidence.sessionId, createdAt: result.evidence.createdAt }, { status: result.created ? 201 : 200 });
  });
}
