# Closed Beta Readiness Plan

## Objective

Prepare Orion Vault for a closed Windows beta with 5 to 10 participants. The beta must protect real vault data, behave predictably as a desktop application, and provide a privacy-respecting feedback channel.

This is not a public-beta release plan. The initial participants should use copied, backed-up, or versioned vaults.

## Release Gate

The beta can be released only after the following are complete:

- desktop API is restricted to loopback, an active vault root, and a per-session token
- closing the window has an explicit tray-based lifecycle and exit path
- all supported desktop widths preserve a usable workspace layout
- autosave and filesystem watcher do not overwrite or visually revert edits
- a packaged Windows smoke test passes
- beta data-risk guidance and destructive-action confirmations are present
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

The global graph may remain experimental during the closed beta, provided that this status is communicated in the interface and feedback is collected.

## 1. Secure The Desktop API

### Scope

- `interfaces/web/server.ts`
- `interfaces/desktop/main.ts`
- `interfaces/desktop/preload.cjs`

### Work

1. Bind the desktop server to `127.0.0.1` explicitly.
2. Generate a cryptographically secure token every time the desktop process starts.
3. Pass the token to the renderer through the preload bridge only.
4. Require the token for all `/api/` requests in desktop mode.
5. In desktop mode, reject request-provided `vaultRoot` values for regular API routes.
6. Make the Electron main process the authority for changing the active vault root through an explicit IPC flow.
7. Preserve a separately documented development mode for `dev:web` where the server can operate without the desktop-only restrictions when needed.

### Acceptance Criteria

- The desktop server listens only on loopback.
- Requests without the session token return `401`.
- Requests with a valid session token work normally.
- Requests cannot read or mutate a root other than the active desktop vault.
- Existing CRUD workflows still work inside the active vault.

### Tests

- Server bind is loopback-only in desktop mode.
- Missing or invalid token is rejected.
- Valid token grants access.
- A foreign `vaultRoot` is rejected.
- Create, edit, move, rename, and delete operate in the active root.

## 2. Add A Tray Lifecycle

### Scope

- `interfaces/desktop/main.ts`
- `interfaces/desktop/preload.cjs`

### Work

1. Create a Windows tray icon when Orion Vault starts.
2. Make the window close action hide or minimize the application instead of terminating it.
3. Restore and focus the main window on tray click or double-click.
4. Add a tray menu with:
   - Open Orion Vault
   - Open Agenda
   - Status: reminders active
   - Exit Orion Vault
5. Make `Exit Orion Vault` the explicit full shutdown path.
6. During explicit shutdown, stop the vault watcher, close the web server, destroy the tray, and quit Electron.
7. Show a one-time message after the first close action explaining that Orion Vault remains active to deliver reminders.

### Acceptance Criteria

- Closing the main window keeps reminders and watcher behavior active.
- The user can always restore the application through the tray.
- The user can explicitly terminate the application through the tray.
- No watcher, server, or reminder process remains after explicit exit.

## 3. Replace The Default Electron Chrome

### Scope

- `interfaces/desktop/main.ts`
- `interfaces/web/index.html`
- `interfaces/web/styles.css`

### Work

1. Remove the default Electron application menu: `File`, `Edit`, `View`, `Window`, and `Help`.
2. Use Electron `titleBarOverlay` on Windows to retain native window controls.
3. Add a compact custom title bar matching the Orion Vault dark visual language.
4. Include the Orion icon and `Orion Vault` label on the left.
5. Reserve a drag region in the center and a clear non-draggable area for app controls.
6. Use a subtle lower separator instead of a heavy frame.
7. Style the native control area with restrained hover states; only the close action should use a controlled red hover treatment.
8. Validate title-bar appearance and controls on Windows 10 and 11 at 100%, 125%, and 150% display scaling.

### Acceptance Criteria

- The application does not present the standard Electron menu bar.
- Window controls remain functional and keyboard-accessible.
- The app can be dragged using the intended title-bar area.
- The title bar feels visually integrated with the workspace.

## 4. Preserve Desktop Layout At Supported Widths

### Scope

- `interfaces/desktop/main.ts`
- `interfaces/web/styles.css`

### Work

1. Align CSS breakpoints with the supported minimum width of `1120px`.
2. Keep the left rail vertical and keep workspace panels in desktop columns from `1120px` upward.
3. Prefer narrowing or collapsing the summary panel over stacking tree, editor, and summary vertically.
4. Preserve the editor as the primary surface at all supported desktop sizes.
5. Limit stacked layouts to widths below the supported desktop minimum or a future mobile-specific surface.

### Acceptance Criteria

- Tree and editor are visible together at every supported desktop width.
- The workspace remains usable at `1120x760`, `1280x800`, `1366x768`, `1440x900`, and `1920x1080`.
- The editor keeps a practical writing width at the minimum supported size.

## 5. Stabilize Autosave And Filesystem Watching

### Scope

- `interfaces/desktop/main.ts`
- `interfaces/web/app.js`
- `interfaces/web/modules/editor-history.js`
- `interfaces/web/modules/workspace-core.js`

### Work

1. Identify saves initiated by the renderer so the watcher does not treat them as external edits.
2. Coalesce watcher events by path and event type.
3. Avoid a full workspace refresh after an autosave of the note currently being edited.
4. Keep refresh behavior for changes made by an external editor, Git operation, or other process.
5. When an external change affects a note with a local dirty draft, do not overwrite it silently.
6. Show a clear conflict action that lets the user keep local work or reload external content.
7. Add request cancellation or a request identifier to note loading so stale requests cannot update the current note.

### Acceptance Criteria

- Typing and autosave do not reset selection or move the cursor.
- Switching notes rapidly does not display links, graph, or content from a previous selection.
- External file changes refresh correctly.
- Conflicting local and external changes require an explicit user decision.

### Tests

- Autosave event does not trigger a redundant workspace refresh.
- External edit is detected and reflected.
- Dirty local draft is never silently replaced.
- Rapidly selecting notes applies only the last selection's data.
- Long-note editing remains responsive.

## 6. Protect Beta Data

### Scope

- Vault setup and onboarding surfaces
- Workspace destructive-action dialogs
- User documentation

### Work

1. Show a first-use beta notice explaining that Orion Vault operates real Markdown files.
2. Recommend a copied, backed-up, or Git-versioned vault during the beta.
3. Strengthen confirmation for recursive folder deletion.
4. Show the full target path before delete, move, and rename operations.
5. Provide an easy `Open vault folder` action so users can inspect their files in Explorer.
6. Document files and folders the application creates, including `Agenda/` and any app metadata.

### Acceptance Criteria

- Every participant sees data-risk guidance before working with a vault.
- Destructive operations show their full target and require confirmation.
- The vault folder can be opened from the app.

## 7. Restore Quality Gates

### Scope

- `eslint.config.mjs`
- Renderer, Electron, Node, scripts, and test source files
- CI configuration when present

### Work

1. Configure ESLint environments by source type:
   - browser globals for renderer files
   - Node globals for server and scripts
   - Electron/CommonJS support for bootstrap and preload files
2. Remove true dead code and unused variables.
3. Resolve actual lint violations after environment configuration is correct.
4. Keep `lint`, `typecheck`, and `test` as required release checks.
5. Add integration tests for desktop API authentication and active-root restrictions.
6. Add tests for the watcher and autosave behaviors described above.

### Acceptance Criteria

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- New security and data-integrity behavior is covered by automated tests.

## 8. Keep Global Graph Experimental

### Scope

- `interfaces/web/modules/global-graph.js`
- `interfaces/web/styles.css`

### Work

1. Mark the global graph as experimental during the first beta.
2. Stop animation when the document is hidden.
3. Respect `prefers-reduced-motion`.
4. Avoid rebuilding the complete graph DOM on every animation frame.
5. Limit or sample graph rendering for large vaults.
6. Ask beta participants specifically about graph performance and usability.

### Acceptance Criteria

- Graph animation does not run in a hidden window.
- Reduced-motion users do not receive continuous animation.
- Large vaults remain usable without degrading core note editing.

## 9. Collect Feedback Inside The App

### Scope

- Desktop tray menu
- Settings or help surface
- New feedback dialog and optional diagnostic-report generator

### Principles

- Feedback must be opt-in.
- No note content, file names, file paths, session tokens, or vault contents may be included by default.
- The application must not transmit diagnostics automatically.

### Work

1. Add `Send feedback` to the tray menu and a visible in-app help or settings surface.
2. Create a feedback dialog with:
   - category: bug, suggestion, usability, or performance
   - description
   - reproduction steps
   - perceived impact
   - optional consent to include a technical diagnostic report
3. Create a sanitized optional diagnostic report containing:
   - app version
   - Windows version and architecture
   - display resolution and scale
   - note and folder counts only, without content or paths
   - recent sanitized application logs
   - watcher and reminder status
4. Offer `Copy report` and `Open feedback channel` actions.
5. Use a private GitHub Issue Form, dedicated email, or external form as the initial feedback channel.
6. State clearly what information is included before the participant shares a report.

### Acceptance Criteria

- Participants can report a problem without leaving the application blindly.
- Reports contain no vault content or identifying paths by default.
- The user decides whether diagnostics are included and when anything is transmitted.

## 10. Packaged Windows Smoke Test

Run this test against the packaged Windows build, not only the development Electron command.

1. Install the package on a clean or representative Windows environment.
2. Open an existing test vault or create a new vault.
3. Create a note and edit it.
4. Wait for autosave and verify the file on disk.
5. Rename and move the note.
6. Delete a disposable note and a disposable folder.
7. Create an agenda item and verify its state.
8. Close the main window and verify that the tray remains available.
9. Restore the application from the tray.
10. Verify a scheduled reminder while the window is hidden.
11. Exit from the tray and verify that the process, watcher, and local server stop.
12. Reopen the application and verify the active vault and expected state.
13. Submit one feedback report and inspect it for sanitization.

## Execution Order

1. Secure the desktop API.
2. Implement tray lifecycle and explicit exit.
3. Replace default Electron chrome with the Orion title bar.
4. Correct supported desktop breakpoints.
5. Stabilize autosave, watcher, and async note loading.
6. Add beta data protections and warnings.
7. Restore lint quality gates and add automated coverage.
8. Make graph behavior safe enough for experimental use.
9. Add in-app feedback and sanitized diagnostics.
10. Run the packaged Windows smoke test.
11. Invite the closed beta group.

## Closed Beta Operations

- Target: 5 to 10 Windows participants.
- Vault guidance: copied, backed-up, or versioned vaults only.
- Distribution: private build and private feedback channel.
- Triage: review feedback, crash reports, and data-integrity reports daily during the first week.
- Escalation: any report of lost, overwritten, or inaccessible data pauses further invitations until investigated.

## Stage Two: Beta Expansion Readiness

Start this stage after the first closed-beta group has completed the core flows without data-integrity or security incidents. Its goal is to make the desktop experience reliable enough to invite more people.

### 1. Restore Lint As A Quality Gate

1. Configure ESLint by environment: browser for renderer files, Node for server/scripts, and Electron/CommonJS for bootstrap and preload.
2. Remove actual dead code and resolve remaining violations.
3. Require `pnpm lint` to pass alongside typecheck and tests before every beta build.

### 2. Validate The Packaged Windows Build

1. Run the packaged Windows smoke test, not only `pnpm build`.
2. Verify vault open/create, note create/edit/autosave, rename, move, delete, agenda, tray, restore, reminders, explicit exit, and feedback link.
3. Run this test on at least one machine other than the development environment.

### 3. Prove Editing Integrity

1. Test autosave in a real vault and confirm the cursor and text do not reset.
2. Edit the same note externally while a local draft exists and validate both choices: reload external content or keep the local draft.
3. Verify rapid note switching never applies content, backlinks, or graph data from a previously selected note.

### 4. Add Electron End-To-End Coverage

1. Automate the critical desktop flows: start, open vault, create note, edit, autosave, close to tray, restore, and explicit exit.
2. Cover the desktop API token and active-vault boundary in integration tests.
3. Run the E2E suite in CI before expanding the beta.

### 5. Improve Graph And Accessibility

1. Stop graph animation when hidden and honor `prefers-reduced-motion`.
2. Avoid rebuilding the complete graph DOM on every animation frame.
3. Test graph behavior with medium and large vaults.
4. Restore visible keyboard focus and improve dialog and graph keyboard navigation.

### Stage Two Exit Criteria

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- Packaged Windows smoke test passes.
- Critical Electron E2E flows pass.
- No unresolved report of data loss, silent overwrite, or security-boundary failure exists.
- Graph remains usable without affecting normal note editing in representative vaults.

Only then should the beta group grow beyond the initial 5 to 10 participants.
