import { ZodError, type ZodType } from "zod";
import { AccessDeniedError, AuthenticationRequiredError, denyIfMissing } from "@/lib/authorization";
import { db } from "@/lib/db";
import { InvalidThemeEvidenceError } from "@/lib/repositories/research-repository";
import { ProjectArchivedError } from "@/lib/repositories/project-repository";

export class InputValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string[]>) {
    super("Invalid input");
  }
}

function fieldErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const path = issue.path.join(".") || "input";
    (result[path] ??= []).push(issue.message);
    return result;
  }, {});
}

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InputValidationError(fieldErrors(parsed.error));
  return parsed.data;
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new InputValidationError({ body: ["Expected JSON body"] });
  }
}

export function requireSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!origin || !expectedOrigin || origin !== expectedOrigin) throw new AccessDeniedError();
}

export async function resolveWorkspace(slug: string) {
  return denyIfMissing(await db.workspace.findUnique({ where: { slug }, select: { id: true, slug: true } }));
}

export async function resolveProjectWorkspace(projectId: string) {
  return denyIfMissing(await db.project.findUnique({ where: { id: projectId }, select: { workspaceId: true } }));
}

export async function resolveSessionWorkspace(sessionId: string) {
  return denyIfMissing(await db.session.findUnique({ where: { id: sessionId }, select: { project: { select: { workspaceId: true } } } }));
}

export async function resolveEvidenceWorkspace(evidenceId: string) {
  return denyIfMissing(await db.evidence.findUnique({ where: { id: evidenceId }, select: { session: { select: { project: { select: { workspaceId: true } } } } } }));
}

export async function apiResponse(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return errorResponse(401, "UNAUTHENTICATED", "Authentication required");
    if (error instanceof AccessDeniedError) return errorResponse(403, "FORBIDDEN", "Access denied");
    if (error instanceof InputValidationError) return errorResponse(422, "VALIDATION_ERROR", "Invalid input", error.fieldErrors);
    if (error instanceof InvalidThemeEvidenceError) return errorResponse(422, "VALIDATION_ERROR", "Invalid input", { evidenceIds: [error.message] });
    if (error instanceof ProjectArchivedError) return errorResponse(409, "CONFLICT", "Project already archived");
    throw error;
  }
}

export function errorResponse(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
  return Response.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, { status });
}
