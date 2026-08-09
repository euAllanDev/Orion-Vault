# Orion Vault Desktop

This folder contains the Electron desktop shell for Orion Vault.

## Current state
- boots the local web UI inside Electron
- opens and persists the active vault root
- keeps the runtime local-first
- exposes desktop bridges through `preload.ts`
- supports the dev-mode terminal launcher inside the active vault
- wires agenda notifications and vault change refresh events

- keeps the window available through the tray until explicit exit
- supports opening `.md` and `.markdown` files registered by the Windows installer

## Main files
- `main.ts`: Electron bootstrap, window lifecycle, desktop IPC and vault watcher
- `preload.ts`: safe bridge between renderer and desktop capabilities
- `ai-terminal.ts`: helper for opening the AI terminal in the active vault

## Direction
The desktop shell should keep reusing the existing TypeScript core instead of duplicating product rules in Electron-specific code.
