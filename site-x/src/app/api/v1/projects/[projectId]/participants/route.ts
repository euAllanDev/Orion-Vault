import { apiResponse, parseInput, resolveProjectWorkspace } from "@/lib/api";
import { uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listParticipants } from "@/lib/repositories/research-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await listParticipants(user.id, workspace.workspaceId, projectId));
  });
}
