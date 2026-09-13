import { apiResponse, parseInput, parseJson, resolveProjectWorkspace } from "@/lib/api";
import { themeInput, uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { createTheme, listThemes } from "@/lib/repositories/research-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await listThemes(user.id, workspace.workspaceId, projectId));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const input = parseInput(themeInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await createTheme(user.id, workspace.workspaceId, projectId, input), { status: 201 });
  });
}
