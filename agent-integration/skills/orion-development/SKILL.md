---
name: orion-development
description: Use when a user explicitly asks to create, implement, build, develop, modify, fix, refactor, or add a feature based on Orion, their Vault, saved notes, project documentation, or existing documented decisions. Consult Orion knowledge before implementation, then validate implementation against it. Do not use for questions that only seek knowledge.
metadata:
  orion-skill-type: development-workflow
  mcp-tools: orion_search, orion_context, orion_related, orion_read
---

# Orion Development Skill v0.1

## Purpose

Before implementing, discover what Orion already knows.

Use Orion Vault as read-only project knowledge when the user explicitly asks to develop from Orion, their Vault, notes, saved context, project documentation, or documented decisions. Orion supplies evidence; normal agent development tools implement and validate code.

This skill specializes `orion-agent` retrieval for execution work. It does not replace that skill for knowledge-only requests and never writes to Orion.

## Intent and authorization

Use this skill for explicit development intent combined with explicit Orion consultation intent. Strong development signals include:

- implement, create, build, develop, modify, fix, refactor, or add a feature
- transform documentation into code
- implement according to a specification
- build from notes or existing decisions

Questions that only seek information remain knowledge requests. For example, `Which framework do we use?` uses Orion knowledge retrieval; `Implement project using documented framework` uses this skill.

Selecting this skill does not authorize Vault access. Follow `orion-agent` read authorization: do not call Orion unless current request clearly authorizes consulting Orion, Vault, notes, saved context, or persistent knowledge. If source or authorization is materially ambiguous, ask one short question before reading Orion or local files.

Before first authorized Orion read, briefly state that Orion documentation will be consulted. Never call `orion_remember` or any write operation in this workflow.

## Workflow

Adapt depth to task. Do not turn a trivial targeted change into a large investigation, and do not read the whole Vault.

### 1. Discover

Identify project, affected area, requested outcome, relevant documentation, architecture, requirements, decisions, and constraints. Prefer a small focused `orion_search` when topic or location is unknown.

Use evidence from request and retrieval results to expand. Do not use broad synonym bags or assume first result is complete.

### 2. Context

Use `orion_context` after initial discovery when cross-note structure, continuation context, or a concrete gap needs it. Seek only context needed for task, especially:

- product vision and requirements
- architecture and technical decisions
- design system, pages, and components
- APIs, security, tests, and constraints

Do not call context merely to repeat search paths or snippets already understood.

### 3. Related

For an important document with likely dependencies, call `orion_related` using its available source reference to find connected knowledge. Follow relationships only when they can affect implementation, such as architecture to authentication, API, security, or session decisions.

Do not call related indiscriminately or explore every connected note.

### 4. Read

Read documents needed to establish requirements or support an implementation decision. Prefer `orion_read` with `sourceRef` returned by Orion; use a relative path only when no source reference is available.

Search finds candidates. Context structures evidence. Related finds relevant dependencies. Read establishes specific source-of-truth details. Avoid rereading information already sufficient for task.

### 5. Identify gaps

Before implementation, classify material information:

- **Known:** explicitly defined in Orion.
- **Inferred:** necessary decision reasonably deduced from known information.
- **Unknown:** information genuinely absent from retrieved Orion evidence.

Do not turn inference or personal preference into a documented requirement. Do not invent credentials, infrastructure, major architecture decisions, or other unknowns. Preserve current behavior when possible. Ask user only when an unknown is necessary to proceed safely; consult Orion first if that answer may exist there.

### 6. Plan

Before substantial changes, create a concise implementation plan grounded in retrieved requirements, architecture, decisions, dependencies, components, and tests. For a small, isolated task, keep plan short and proceed.

### 7. Implement

Use normal agent tools for filesystem, terminal, IDE, code, tests, and Git. Orion is read-only knowledge, not an execution environment. Keep implementation aligned with known Orion decisions and avoid unrelated refactors.

### 8. Validate and correct

Validate code with relevant project checks. For sufficiently complex work, perform a second Orion comparison: use focused `orion_search`, `orion_context`, `orion_related`, or `orion_read` to confirm important requirements and decisions.

Ask: `Does implementation match Orion knowledge?`

If comparison finds inconsistency, correct implementation, validate again, then recheck relevant Orion evidence. Compilation or passing tests alone does not prove documented alignment.

## Task modes

### Greenfield

Discover project and desired outcome, retrieve overview, requirements, architecture, design system, pages, components, and decisions as relevant; identify gaps; plan; implement; validate; compare with Orion.

### Feature

Discover affected area, locate requirements and architecture, inspect evidence-backed dependencies through related notes, implement, then validate against relevant decisions.

### Bug

Discover expected behavior from requirements or decisions, investigate local cause, implement minimal correction, and validate code plus documented behavior.

### Refactor

Discover current architecture and applicable decisions, inspect related constraints, plan change, refactor without changing undefined behavior, and validate against architecture.

## Completion report

Report implementation, validation performed, and material unknowns or assumptions. Distinguish documented Orion requirements from local inferences. Do not claim Orion coverage is exhaustive unless a tool guarantees it.

## Core rules

- Orion remains closed without explicit current read authorization.
- Start discovery with focused search when task knowledge is not already located.
- Prefer `sourceRef` for specific reads when available.
- Use related notes for concrete dependencies, not ritual exploration.
- Retrieve enough evidence before significant implementation; do not load whole Vault.
- Preserve undefined choices and existing behavior where possible.
- Use Orion knowledge before asking user for information Orion may contain.
- Recheck complex implementations against Orion and correct mismatches.
- Never write to Orion or invent MCP APIs.
