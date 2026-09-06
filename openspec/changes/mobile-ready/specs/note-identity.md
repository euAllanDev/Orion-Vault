# Note Identity Specification

## Purpose

Definir como uma nota é identificada independentemente do sistema operacional e como
essa identidade é convertida em um caminho físico dentro do Vault.

## Requirement: Relative Identity

O sistema MUST representar a identidade lógica de uma nota através de um caminho
relativo ao Vault.

### Scenario: Note inside nested directory

Given a Vault containing:

    Financas/orcamento.md

When the note identity is requested

Then its logical identity MUST be:

    Financas/orcamento.md

And it MUST NOT depend on the absolute filesystem path.

---

## Requirement: Root Note

Uma nota localizada diretamente na raiz do Vault MUST possuir uma identidade relativa
válida.

### Scenario: Note at Vault root

Given:

    README.md

When its logical identity is requested

Then the identity MUST be:

    README.md

---

## Requirement: Platform Independence

A identidade lógica MUST be independent of the host operating system.

### Scenario: Same note on Linux and Windows

Given the same logical note:

    Projetos/Orion.md

When the Vault is opened on Linux

Then its logical identity MUST remain:

    Projetos/Orion.md

When the same Vault is opened on Windows

Then its logical identity MUST remain:

    Projetos/Orion.md

---

## Requirement: Canonical Separator

Persisted logical paths MUST use `/` as the path separator.

### Scenario: Windows path separator

Given a physical Windows path representing:

    Projetos\Orion.md

When converted to a logical identity

Then the result MUST be:

    Projetos/Orion.md

---

## Requirement: Absolute Paths

Absolute filesystem paths MUST NOT be accepted as logical note identities.

### Scenario: Linux absolute path

Given:

    /home/user/vault/Projetos/Orion.md

When interpreted as a logical note identity

Then the operation MUST reject the value or normalize it only when the VaultRoot is
explicitly available and the relative path can be safely derived.

---

## Requirement: Windows Absolute Paths

Windows drive-qualified paths MUST NOT be used as logical identities.

### Scenario: Windows drive path

Given:

    C:\Users\User\vault\Projetos\Orion.md

When interpreted as a logical identity

Then the logical identity MUST NOT contain:

    C:\Users\User\vault\

The resulting identity, when safely derived using the VaultRoot, MUST be:

    Projetos/Orion.md

---

## Requirement: Path Traversal

A logical note identity MUST NOT escape the Vault.

### Scenario: Parent traversal

Given:

    ../outside.md

When resolving the identity against VaultRoot

Then the operation MUST be rejected.

---

## Requirement: Nested Traversal

### Scenario: Nested parent traversal

Given:

    Projetos/../../outside.md

When resolving the identity against VaultRoot

Then the operation MUST be rejected.

---

## Requirement: Physical Resolution

The system MUST be able to resolve a valid logical identity to a physical file.

### Scenario: Resolve note

Given:

    VaultRoot = /workspace/vault

And:

    relativePath = Projetos/Orion.md

When the note is resolved

Then the physical target MUST be:

    /workspace/vault/Projetos/Orion.md

---

## Requirement: Reverse Resolution

The system SHOULD be able to derive a logical identity from a physical path when
the corresponding VaultRoot is known.

### Scenario: Physical path to identity

Given:

    VaultRoot = /workspace/vault

And:

    physicalPath = /workspace/vault/Financas/orcamento.md

When the logical identity is calculated

Then it MUST be:

    Financas/orcamento.md

---

## Requirement: Vault Boundary

Resolved note paths MUST remain inside the configured VaultRoot.

### Scenario: Symlink or traversal boundary

Given a note identity that resolves outside the VaultRoot

When the filesystem target is validated

Then the operation MUST be rejected.

---

## Requirement: Modification Time

File metadata used by the note infrastructure MUST be able to expose the observed
modification time when available.

### Scenario: Existing note

Given a note stored in the Vault

When its metadata is loaded

Then the metadata MAY include:

    mtime

And `mtime` MUST represent the filesystem modification time.

---

## Requirement: mtime Is Not Identity

The system MUST NOT use `mtime` as the identity of a note.

### Scenario: Note modified

Given:

    relativePath = Projetos/Orion.md

When the file is modified

Then its logical identity MUST remain:

    Projetos/Orion.md

And only its metadata such as `mtime` may change.

---

## Requirement: Existing Vault Compatibility

Existing Vault structures MUST remain valid.

### Scenario: Existing Vault

Given a Vault containing:

    Financas/orcamento.md
    Projetos/Orion.md

When the updated Orion loads the Vault

Then both notes MUST remain discoverable.

The user MUST NOT be required to move or rename the files.

---

## Requirement: Desktop Compatibility

Existing Desktop operations MUST continue working.

### Scenario: Read existing note

Given an existing Vault

When the Desktop reads a note

Then the note MUST open normally.

---

## Requirement: Search Compatibility

### Scenario: Search existing note

Given an existing Vault containing:

    Projetos/Orion.md

When a search matches that note

Then the result MUST continue identifying the correct note.

---

## Requirement: MCP Compatibility

Existing MCP tools MUST continue operating.

### Scenario: MCP read

Given an existing Vault

When `orion_read` reads a valid note

Then it MUST continue returning the note content.

---

## Requirement: MCP Public Schema Stability

The change MUST NOT expose absolute Vault filesystem paths through public MCP schemas.

### Scenario: MCP tool schema

When MCP tools are registered

Then no public input field MUST require:

    VaultRoot

or an absolute filesystem path.

---

## Requirement: Index Compatibility

Existing indexes MUST NOT require manual deletion solely because note identity becomes
relative.

### Scenario: Existing index

Given an existing Vault with an existing semantic index

When the updated application starts

Then the application MUST either reuse, safely migrate, or safely rebuild the required
index data without requiring destructive manual intervention.

---

## Requirement: No Synchronization

This specification MUST NOT introduce synchronization behavior.

### Scenario: Two devices

Given the same relative note identity on two devices

When both applications are running

Then no automatic synchronization MUST occur as a consequence of this change.

---

## Requirement: No Conflict Resolution

This specification MUST NOT implement merge or synchronization conflict resolution.

Future synchronization behavior MUST be specified separately.