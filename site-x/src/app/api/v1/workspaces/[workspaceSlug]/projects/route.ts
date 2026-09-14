import { apiResponse, parseInput, parseJson, requireSameOriginMutation, resolveWorkspace } from "@/lib/api";
import { createProjectInput, projectListQuery, workspaceSlug } from "@/lib/api-schemas";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { createProject, listProjectsPage } from "@/lib/repositories/project-repository";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  return apiResponse(async () => {
    const slug = parseInput(workspaceSlug, (await params).workspaceSlug);
    const query = parseInput(projectListQuery, Object.fromEntries(new URL(request.url).searchParams));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveWorkspace(slug);
    return Response.json(await listProjectsPage(user.id, workspace.id, query));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  return apiResponse(async () => {
    requireSameOriginMutation(request);
    const slug = parseInput(workspaceSlug, (await params).workspaceSlug);
    const input = parseInput(createProjectInput, await parseJson(request));
    const user = await requireAuthenticatedUser();
    const workspace = await resolveWorkspace(slug);
    return Response.json(await createProject(user.id, workspace.id, input), { status: 201 });
  });
}
