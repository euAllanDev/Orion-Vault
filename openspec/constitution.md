# Constitution

## Purpose
Definir as regras imutaveis do projeto Orion Vault para orientar mudancas, specs e implementacao.

## Principles
- Domain first
- Application orchestrates
- Infrastructure is replaceable
- Interfaces are thin adapters
- AI suggests, system executes
- Development and validation are local-first
- All filesystem effects must be validated
- No action may escape the vault boundary
- Specs are the source of truth for behavior

## Required structure
- `openspec/changes/` for proposals in progress
- `openspec/specs/` for reusable behavior specs
- `docs/` for architecture and SDD guidance

## Non-negotiable rules
1. No direct filesystem access from AI.
2. No mutation without validation.
3. No operation outside the configured vault.
4. No silent overwrite of existing files.
5. No mixing of interface concerns into domain.
6. No required dependency on external services for local development or test execution.
