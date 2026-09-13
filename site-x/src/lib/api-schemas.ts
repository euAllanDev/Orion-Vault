import { z } from "zod";

export const uuid = z.string().uuid();
export const workspaceSlug = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const projectListQuery = z.object({ cursor: uuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(50), status: z.enum(["ACTIVE", "ARCHIVED"]).optional() }).strict();
export const createProjectInput = z.object({ name: z.string().trim().min(1).max(100), objective: z.string().trim().min(1) }).strict();
export const updateProjectInput = z.object({ name: optionalText(100), objective: optionalText(10_000) }).strict().refine((value) => value.name !== undefined || value.objective !== undefined, "At least one field is required");

export const sessionInput = z.object({ participantId: uuid.nullish(), scheduledAt: z.coerce.date(), method: z.enum(["INTERVIEW", "OBSERVATION", "USABILITY_TEST"]), status: z.enum(["PLANNED", "COMPLETED", "CANCELLED"]), guide: z.string().trim().min(1).max(10_000).nullish() }).strict();
const evidenceFields = { text: z.string().trim().min(1).max(5000), kind: z.enum(["QUOTE", "OBSERVATION", "NOTE"]), timestampSeconds: z.number().int().min(0).nullish(), tags: z.array(z.string().trim().min(1).max(100)).max(10) };
export const evidenceInput = z.object(evidenceFields).strict();
export const updateEvidenceInput = z.object({ text: evidenceFields.text.optional(), kind: evidenceFields.kind.optional(), timestampSeconds: evidenceFields.timestampSeconds, tags: evidenceFields.tags.optional() }).strict().refine((value) => Object.values(value).some((item) => item !== undefined), "At least one field is required");
export const idempotencyKey = z.string().min(1).max(128);

export const themeInput = z.object({ title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(10_000), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]), evidenceIds: z.array(uuid).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Evidence IDs must be unique") }).strict();
