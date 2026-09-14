import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(request: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const response = await handler(request, context);
  const location = response.headers.get("location");
  if (!new URL(request.url).pathname.endsWith("/signin/email") || !location?.includes("error=AccessDenied")) return response;

  const headers = new Headers(response.headers);
  headers.set("location", new URL("/api/auth/verify-request?provider=email&type=email", request.url).toString());
  return new Response(null, { status: response.status, headers });
}
