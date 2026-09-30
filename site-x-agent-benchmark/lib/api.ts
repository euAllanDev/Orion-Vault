import { ZodError, z } from "zod";
import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/lib/authorization";

export const projectInput = z.object({ name: z.string().trim().min(1).max(100), objective: z.string().trim().min(10).max(1000) }).strict();
export const sessionInput = z.object({ participantId: z.string().uuid().optional(), scheduledAt: z.string().datetime(), method: z.enum(["INTERVIEW", "OBSERVATION", "USABILITY_TEST"]), status: z.enum(["PLANNED", "COMPLETED", "CANCELLED"]).default("PLANNED"), guide: z.string().trim().max(10000).optional() }).strict();
export const evidenceInput = z.object({ text: z.string().trim().min(1).max(5000), kind: z.enum(["QUOTE", "OBSERVATION", "NOTE"]), timestampSeconds: z.number().int().min(0).optional(), tags: z.array(z.string().trim().min(1).max(100)).max(10).default([]) }).strict();
export const themeInput = z.object({ title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(5000), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]), evidenceIds: z.array(z.string().uuid()).min(1) }).strict();

export function apiError(error: unknown) {
  if (error instanceof AccessDeniedError) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Resource unavailable." } }, { status: 403 });
  if (error instanceof ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", fieldErrors: error.flatten().fieldErrors } }, { status: 422 });
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } }, { status: 500 });
}

export function unauthenticated() {
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
}
