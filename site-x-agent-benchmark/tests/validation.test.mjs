import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidence, validateProject } from "../lib/validation.mjs";
test("validates project required lengths", () => { assert.ok(validateProject({ name: "", objective: "short" }).name); assert.ok(validateProject({ name: "Research", objective: "short" }).objective); assert.deepEqual(validateProject({ name: "Research", objective: "Learn why people abandon onboarding" }), {}); });
test("validates evidence content and tag limit", () => { assert.ok(validateEvidence({ text: "", kind: "QUOTE", tags: [] }).text); assert.ok(validateEvidence({ text: "note", kind: "NOTE", tags: Array(11).fill("tag") }).tags); assert.deepEqual(validateEvidence({ text: "Useful observation", kind: "OBSERVATION", tags: ["trust"] }), {}); });
