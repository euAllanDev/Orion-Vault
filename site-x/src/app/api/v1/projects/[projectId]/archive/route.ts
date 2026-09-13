import { apiResponse, parseInput, resolveProjectWorkspace } from "@/lib/api";
import { uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { archiveProject } from "@/lib/repositories/project-repository";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    await archiveProject(user.id, workspace.workspaceId, projectId);
    return new Response(null, { status: 204 });
  });
}
