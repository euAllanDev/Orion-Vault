import { AccessDeniedError, AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/authorization";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return Response.json({ authenticated: true, email: user.email });
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    throw error;
  }
}
