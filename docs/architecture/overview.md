# Architecture Overview

## Layers
- Domain: rules and invariants
- Application: orchestration and use cases
- Infra: technical implementations
- Interfaces: protocol adapters

## Module map
- notes
- organization
- ai
- shared
- workspace

## Interface Notes
- Visual style: dark, premium, calm, minimal, with a clay/glass feel. Use deep zinc surfaces, soft shadows, subtle highlights, and rounded geometry.
- Sidebar: narrower left rail, with `Home` as the first item and `Vault` as the workspace entry. Keep the rail compact, tactile, and visually quiet.
- Sidebar icons: glass-style buttons are allowed only in the rail, using a compact 3D/glass treatment without animated hover motion.
- Workspace header: keep it short and understated. Prioritize content width and reduce decorative framing.
- Note actions: use a single `Opções` control that opens a compact glass dropdown menu for pin, template, rename, and move actions.
- Tree: render as a plain nested outline. Show folder names and note names only, with no cards, counters, file icons, or extra labels.
- Tree hierarchy: make parent/child depth obvious through indentation only. Notes should read like `- Note.md` under each folder.
- Tree behavior: no persistent hover-like state on folders. Selection should be subtle and mostly typographic.
- Editor: flat, understated, and wide. No card-like container. Use only light separators, small metadata, and restrained spacing.
- Summary panel: keep it minimal and non-cluttered, aligned with the same quiet dark language.
- Responsive behavior: stack cleanly on smaller screens and preserve readability before decorative depth.
