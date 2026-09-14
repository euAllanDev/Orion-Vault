import { apiResponse, parseInput, parseJson, requireSameOriginMutation, resolveEvidenceWorkspace } from "@/lib/api";
import { updateEvidenceInput, uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { deleteEvidence, updateEvidence } from "@/lib/repositories/research-repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  return apiResponse(async () => {
    requireSameOriginMutation(request);
    const evidenceId = parseInput(uuid, (await params).evidenceId);
    const input = parseInput(updateEvidenceInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveEvidenceWorkspace(evidenceId);
    return Response.json(await updateEvidence(user.id, workspace.session.project.workspaceId, evidenceId, input));
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  return apiResponse(async () => {
    requireSameOriginMutation(request);
    const evidenceId = parseInput(uuid, (await params).evidenceId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveEvidenceWorkspace(evidenceId);
    await deleteEvidence(user.id, workspace.session.project.workspaceId, evidenceId);
    return new Response(null, { status: 204 });
  });
}
