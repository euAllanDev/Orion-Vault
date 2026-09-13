import { apiResponse, parseInput, parseJson, resolveProjectWorkspace } from "@/lib/api";
import { updateProjectInput, uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getProject, updateProject } from "@/lib/repositories/project-repository";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await getProject(user.id, workspace.workspaceId, projectId));
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const input = parseInput(updateProjectInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await updateProject(user.id, workspace.workspaceId, projectId, input));
  });
}
