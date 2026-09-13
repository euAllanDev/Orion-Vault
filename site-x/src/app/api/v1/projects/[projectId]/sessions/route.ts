import { apiResponse, parseInput, parseJson, resolveProjectWorkspace } from "@/lib/api";
import { sessionInput, uuid } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { createSession, listSessions } from "@/lib/repositories/research-repository";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await listSessions(user.id, workspace.workspaceId, projectId));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return apiResponse(async () => {
    const projectId = parseInput(uuid, (await params).projectId);
    const input = parseInput(sessionInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveProjectWorkspace(projectId);
    return Response.json(await createSession(user.id, workspace.workspaceId, projectId, input), { status: 201 });
  });
}
