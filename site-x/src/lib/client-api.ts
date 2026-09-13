export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
  });
  if (response.ok) return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  const payload = await response.json().catch(() => null);
  throw new ApiError(response.status, payload?.error?.message ?? "Request failed", payload?.error?.fieldErrors);
}

export function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Não foi possível concluir a operação. Tente novamente.";
  if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (error.status === 403) return "Você não tem permissão para este recurso.";
  return Object.values(error.fieldErrors ?? {}).flat().join(" ") || error.message;
}
