# Tasks: Mobile-Ready Note Identity

## Phase 1 — Discovery

- [ ] Map all current uses of absolute note paths in the core.
- [ ] Identify the domain/application DTOs that currently represent note paths.
- [ ] Identify filesystem boundaries where `VaultRoot` is required.
- [ ] Identify index structures that persist note paths.
- [ ] Identify MCP tools that consume or return note paths.
- [ ] Identify CLI/Web consumers that depend on current path representations.
- [ ] Confirm which existing contracts must remain unchanged.

## Phase 2 — Tests First

- [ ] Add tests for relative note identity.
- [ ] Add tests for notes at Vault root.
- [ ] Add tests for nested relative paths.
- [ ] Add tests for `/` canonical separator.
- [ ] Add tests for Windows path normalization.
- [ ] Add tests for Linux path normalization.
- [ ] Add tests rejecting absolute logical paths.
- [ ] Add tests rejecting `..` traversal.
- [ ] Add tests ensuring resolved paths remain inside VaultRoot.
- [ ] Add tests for physical path → relative path conversion.
- [ ] Add tests for relative path → physical path conversion.
- [ ] Add tests for `mtime` metadata where applicable.

## Phase 3 — Core Identity

- [ ] Introduce the smallest necessary representation for logical note identity.
- [ ] Normalize logical paths consistently.
- [ ] Keep filesystem paths as physical implementation details.
- [ ] Keep `VaultRoot` responsible for physical resolution.
- [ ] Avoid changing unrelated domain models.
- [ ] Avoid changing public MCP schemas.

## Phase 4 — Filesystem Integration

- [ ] Adapt note resolution to use `VaultRoot + relativePath`.
- [ ] Preserve existing file creation behavior.
- [ ] Preserve existing file reading behavior.
- [ ] Preserve existing file writing behavior.
- [ ] Preserve existing rename behavior.
- [ ] Preserve existing move behavior.
- [ ] Validate Vault boundary before filesystem access.
- [ ] Ensure Linux behavior remains valid.
- [ ] Ensure Windows behavior remains valid.

## Phase 5 — Metadata

- [ ] Add `mtime` only to the metadata structures that need it.
- [ ] Ensure `mtime` comes from the filesystem when available.
- [ ] Do not use `mtime` as note identity.
- [ ] Add tests confirming identity remains stable after modification.

## Phase 6 — Search and Indexes

- [ ] Verify search results continue resolving to the correct notes.
- [ ] Verify semantic retrieval continues resolving to the correct notes.
- [ ] Verify existing index data remains usable.
- [ ] Add migration/rebuild behavior only if actually required.
- [ ] Avoid changing ranking, chunking, embedding, snippet, or budget behavior.
- [ ] Confirm existing Vaults do not require manual index deletion.

## Phase 7 — MCP

- [ ] Verify `orion_search`.
- [ ] Verify `orion_context`.
- [ ] Verify `orion_read`.
- [ ] Verify `orion_remember`.
- [ ] Verify `orion_ping`.
- [ ] Confirm public MCP schemas remain unchanged unless a concrete compatibility
      requirement requires otherwise.
- [ ] Confirm absolute Vault paths are not exposed through public tool schemas.
- [ ] Confirm shared MCP runtime behavior remains unchanged.

## Phase 8 — Desktop Regression

- [ ] Run existing typecheck.
- [ ] Run existing lint.
- [ ] Run existing unit tests.
- [ ] Run MCP tests.
- [ ] Run remember tests.
- [ ] Build Desktop.
- [ ] Open an existing Vault.
- [ ] Read an existing note.
- [ ] Create a note.
- [ ] Edit a note.
- [ ] Rename a note.
- [ ] Move a note.
- [ ] Search for a note.
- [ ] Confirm index/retrieval behavior.
- [ ] Confirm no existing Desktop workflow regressed.

## Phase 9 — Cross-Platform Validation

- [ ] Validate Linux path normalization.
- [ ] Validate Windows path normalization.
- [ ] Validate nested directories.
- [ ] Validate Vault boundary protection.
- [ ] Validate existing Vault compatibility.

## Phase 10 — Documentation

- [ ] Document the distinction between `relativePath` and physical filesystem paths.
- [ ] Document that `VaultRoot` remains a runtime/filesystem concern.
- [ ] Document that this change does not implement synchronization.
- [ ] Document that Mobile support is a future consumer of the identity model.

## Phase 11 — Final Validation

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] Full test suite
- [ ] MCP suite
- [ ] Remember suite
- [ ] Build
- [ ] Desktop smoke test
- [ ] Existing Vault smoke test
- [ ] Verify no unrelated files changed.
- [ ] `git diff --check`
- [ ] Review public MCP schemas.
- [ ] Review persisted index compatibility.

## Commit Gate

Do NOT commit until:

- [ ] Existing Desktop behavior is verified.
- [ ] Existing MCP behavior is verified.
- [ ] Existing Vaults are verified.
- [ ] Relative identity tests pass.
- [ ] Path traversal tests pass.
- [ ] Typecheck passes.
- [ ] Lint passes or any pre-existing failure is explicitly documented.
- [ ] Full relevant test suites pass.
- [ ] Build passes.
- [ ] `git diff --check` passes.
- [ ] No synchronization behavior was accidentally introduced.

## Out of Scope Confirmation

The following MUST remain untouched by this change unless a concrete dependency is
discovered:

- Mobile UI.
- Mobile packaging.
- Cloud backend.
- Sync protocol.
- Authentication for sync.
- Conflict resolution.
- Merge algorithms.
- Content hashing for sync.
- Offline synchronization.
- Push/pull synchronization.