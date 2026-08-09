import { createAiDevModeController } from './modules/ai-dev-mode.js';
import { createEditorAssistController } from './modules/editor-assist.js';
import { createEditorFormattingController } from './modules/editor-formatting.js';
import { createEditorHistoryController } from './modules/editor-history.js';
import { createGlobalGraphController } from './modules/global-graph.js';
import { createAgendaController } from './modules/agenda.js';
import { createEditorPresentationController } from './modules/editor-presentation.js';
import { createOverviewDashboardController } from './modules/overview-dashboard.js';
import { createRelationsSurfaceController } from './modules/relations-surface.js';
import { createResourceBrowserController } from './modules/resource-browser.js';
import { createUiShellController } from './modules/ui-shell.js';
import { createVaultBootstrapController } from './modules/vault-bootstrap.js';
import { createWorkspaceGraphController } from './modules/workspace-graph.js';
import { createWorkspaceTreeController } from './modules/workspace-tree.js';
import { createWorkspaceCoreController } from './modules/workspace-core.js';

const shellMode = new URLSearchParams(window.location.search).get('shell');
const isDesktopShell = shellMode === 'desktop' || Boolean(window.orionDesktop);
const startupView = isDesktopShell ? 'workspace' : 'setup';
const startupVaultRoot = isDesktopShell ? (new URLSearchParams(window.location.search).get('vaultRoot') ?? '').trim() : '';
const desktopApiTokenPromise = isDesktopShell && typeof window.orionDesktop?.getApiToken === 'function'
  ? window.orionDesktop.getApiToken()
  : Promise.resolve('');

const state = {
  view: startupView,
  vaultPath: isDesktopShell ? '' : startupVaultRoot,
  defaultVaultPath: isDesktopShell ? '' : startupVaultRoot,
  selectedFile: '',
  selectedFolder: '',
  tree: null,
  pinnedPaths: [],
  backlinks: [],
  related: { manualLinks: [], backlinks: [], related: [] },
  linkSuggestions: [],
  linkPreview: null,
  templates: [],
  selectedTemplate: null,
  summaryMode: 'overview',
  graphContext: { kind: 'note', path: '' },
  graph: { scope: 'note', nodes: [], edges: [] },
  graphGlobal: { vaultRoot: '', nodes: [], edges: [] },
  agendaItems: [],
  agendaFilter: 'all',
  agendaReminderTimer: null,
  agendaReminderKeys: new Set(),
  recentActivity: [],
  overviewSummary: null,
  desktopNotificationTimer: null
};

let desktopBootstrapPromise = null;
let desktopBootstrapComplete = false;
let setupStateRequestId = 0;
let inputDialogSession = null;
let linkPickerSelection = { start: 0, end: 0, text: '' };
let noteTitleRenamePromise = null;
const editorAssistState = {
  kind: '',
  query: '',
  tokenStart: 0,
  tokenEnd: 0,
  activeIndex: 0,
  items: []
};

const editorSlashCommands = [
  { id: 'h1', label: 'Heading 1', description: 'Insere titulo principal', insertText: '# ' },
  { id: 'h2', label: 'Heading 2', description: 'Insere subtitulo', insertText: '## ' },
  { id: 'h3', label: 'Heading 3', description: 'Insere secao menor', insertText: '### ' },
  { id: 'todo', label: 'Checklist', description: 'Insere item de checklist', insertText: '- [ ] ' },
  { id: 'list', label: 'Lista', description: 'Insere item de lista', insertText: '- ' },
  { id: 'quote', label: 'Citacao', description: 'Insere bloco de citacao', insertText: '> ' },
  { id: 'code', label: 'Codigo', description: 'Insere bloco de codigo', insertText: '```\n\n```', cursorOffset: 4 },
  { id: 'divider', label: 'Divisor', description: 'Insere separador visual', insertText: '---' },
  { id: 'date', label: 'Data', description: 'Insere a data local de hoje', insertText: () => new Intl.DateTimeFormat('sv-SE').format(new Date()) }
];

const editorSurfaceState = {
  currentLineIndex: 0
};

const editorPendingSelection = {
  start: null,
  end: null
};

const editorPreviewState = {
  expanded: false
};

const editorLinkState = {
  activeIndex: -1
};

const linkedNoteState = {
  highlightedPath: '',
  clearTimer: null
};

const editorHistoryState = {
  undoStack: [],
  redoStack: [],
  applying: false,
  limit: 120
};

const editorSaveState = {
  autoSaveTimer: null,
  dirty: false,
  saving: false,
  lastSavedValue: ''
};
const localVaultWriteExpiryByPath = new Map();

function rememberLocalVaultWrite(pathValue) {
  const path = normalizeRelativePath(String(pathValue ?? ''));
  if (!path) return;
  localVaultWriteExpiryByPath.set(path, Date.now() + 3000);
}

function consumeLocalVaultWrite(pathValue) {
  const path = normalizeRelativePath(String(pathValue ?? ''));
  const expiresAt = localVaultWriteExpiryByPath.get(path);
  if (!expiresAt) return false;

  localVaultWriteExpiryByPath.delete(path);
  return expiresAt >= Date.now();
}

async function getDesktopBootstrapVaultRoot() {
  return vaultBootstrap.getDesktopBootstrapVaultRoot();
}

async function syncDesktopActiveVaultRoot(vaultRoot) {
  await vaultBootstrap.syncDesktopActiveVaultRoot(vaultRoot);
}

const setupHints = {
  valid: 'A fronteira do vault está pronta para inspeção e organização.',
  invalid: 'O caminho informado não é seguro ou está fora da fronteira do vault.',
  missing: 'Esse caminho ainda não existe. O app pode criar o vault local para você.',
  existing: 'Esse vault já existe e pode ser aberto com segurança.'
};

const uiStorageKeys = {
  railCollapsed: 'orion-vault-rail-collapsed',
  editorDraftPrefix: 'orion-vault-editor-draft:',
  betaDataNoticeAcknowledged: 'orion-vault-beta-data-notice-acknowledged'
};

const els = {
  viewButtons: [...document.querySelectorAll('.rail-btn')],
  setupView: document.getElementById('setupView'),
  workspaceView: document.getElementById('workspaceView'),
  relationsView: document.getElementById('relationsView'),
  agendaView: document.getElementById('agendaView'),
  pageTitle: document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  vaultPathInput: document.getElementById('vaultPathInput'),
  desktopCommandsButton: document.getElementById('desktopCommandsButton'),
  templatesButton: document.getElementById('templatesButton'),
  dailyNoteButton: document.getElementById('dailyNoteButton'),
  desktopSearchButton: document.getElementById('desktopSearchButton'),
  openVaultFolderButton: document.getElementById('openVaultFolderButton'),
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
  windowMinimizeButton: document.getElementById('windowMinimizeButton'),
  windowMaximizeButton: document.getElementById('windowMaximizeButton'),
  windowCloseButton: document.getElementById('windowCloseButton'),
  agendaForm: document.getElementById('agendaForm'),
  agendaList: document.getElementById('agendaList'),
  agendaEmpty: document.getElementById('agendaEmpty'),
  agendaCount: document.getElementById('agendaCount'),
  agendaPendingCount: document.getElementById('agendaPendingCount'),
  agendaDoneCount: document.getElementById('agendaDoneCount'),
  agendaOverdueCount: document.getElementById('agendaOverdueCount'),
  agendaOptionsButton: document.getElementById('agendaOptionsButton'),
  agendaOptionsPanel: document.getElementById('agendaOptionsPanel'),
  agendaOptionsLabel: document.getElementById('agendaOptionsLabel'),
  overviewOptionsButton: document.getElementById('overviewOptionsButton'),
  overviewOptionsPanel: document.getElementById('overviewOptionsPanel'),
  agendaTitleInput: document.getElementById('agendaTitleInput'),
  agendaDueInput: document.getElementById('agendaDueInput'),
  agendaStatusInput: document.getElementById('agendaStatusInput'),
  agendaBodyInput: document.getElementById('agendaBodyInput'),
  agendaCreateButton: document.getElementById('agendaCreateButton'),
  agendaResetButton: document.getElementById('agendaResetButton'),
  agendaStatusMessage: document.getElementById('agendaStatusMessage'),
  startVaultButton: document.getElementById('startVaultButton'),
  sidebarNewNoteButton: document.getElementById('sidebarNewNoteButton'),
  railCollapseButton: document.getElementById('railCollapseButton'),
  feedbackButton: document.getElementById('feedbackButton'),
  aiModeButton: document.getElementById('aiModeButton'),
  newNoteButton: document.getElementById('newNoteButton'),
  newFolderButton: document.getElementById('newFolderButton'),
  saveButton: document.getElementById('saveButton'),
  noteOptionsButton: document.getElementById('noteOptionsButton'),
  noteOptionsMenu: document.getElementById('noteOptionsMenu'),
  noteOptionPinLabel: document.getElementById('noteOptionPinLabel'),
  vaultName: document.getElementById('vaultName'),
  vaultRootDisplay: document.getElementById('vaultRootDisplay'),
  vaultStateText: document.getElementById('vaultStateText'),
  vaultHealthPill: document.getElementById('vaultHealthPill'),
  metricNotes: document.getElementById('metricNotes'),
  metricFolders: document.getElementById('metricFolders'),
  metricMarkdown: document.getElementById('metricMarkdown'),
  metricBytes: document.getElementById('metricBytes'),
  metricAgenda: document.getElementById('metricAgenda'),
  metricOverdue: document.getElementById('metricOverdue'),
  overviewDueCount: document.getElementById('overviewDueCount'),
  overviewDueList: document.getElementById('overviewDueList'),
  overviewDueEmpty: document.getElementById('overviewDueEmpty'),
  overviewActivityCount: document.getElementById('overviewActivityCount'),
  overviewRecentList: document.getElementById('overviewRecentList'),
  overviewRecentEmpty: document.getElementById('overviewRecentEmpty'),
  overviewActivityBars: document.getElementById('overviewActivityBars'),
  overviewActivityPeak: document.getElementById('overviewActivityPeak'),
  overviewAgendaRing: document.getElementById('overviewAgendaRing'),
  overviewAgendaRingLabel: document.getElementById('overviewAgendaRingLabel'),
  overviewAgendaLegend: document.getElementById('overviewAgendaLegend'),
  setupHint: document.getElementById('setupHint'),
  folderBreadcrumb: document.getElementById('folderBreadcrumb'),
  tree: document.getElementById('tree'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  noteTitle: document.getElementById('noteTitle'),
  editorMeta: document.querySelector('.editor-meta'),
  editorPreview: document.getElementById('editorPreview'),
  editorPreviewToggle: document.getElementById('editorPreviewToggle'),
  noteEditorSurface: document.getElementById('noteEditorSurface'),
  editorLinkTooltip: document.getElementById('editorLinkTooltip'),
  noteEditor: document.getElementById('noteEditor'),
  editorDraftIndicator: document.getElementById('editorDraftIndicator'),
  editorAssistMenu: document.getElementById('editorAssistMenu'),
  editorAssistLabel: document.getElementById('editorAssistLabel'),
  editorAssistMeta: document.getElementById('editorAssistMeta'),
  editorAssistList: document.getElementById('editorAssistList'),
  editorStatus: document.getElementById('editorStatus'),
  workspaceEmpty: document.getElementById('workspaceEmpty'),
  workspaceEmptyTitle: document.getElementById('workspaceEmptyTitle'),
  workspaceEmptyBody: document.getElementById('workspaceEmptyBody'),
  emptyStartVaultButton: document.getElementById('emptyStartVaultButton'),
  quickMenu: document.getElementById('quickMenu'),
  folderContextMenu: document.getElementById('folderContextMenu'),
  inputDialog: document.getElementById('inputDialog'),
  inputDialogEyebrow: document.getElementById('inputDialogEyebrow'),
  inputDialogTitle: document.getElementById('inputDialogTitle'),
  inputDialogMessage: document.getElementById('inputDialogMessage'),
  inputDialogFieldWrap: document.getElementById('inputDialogFieldWrap'),
  inputDialogFieldLabel: document.getElementById('inputDialogFieldLabel'),
  inputDialogInput: document.getElementById('inputDialogInput'),
  inputDialogTextarea: document.getElementById('inputDialogTextarea'),
  inputDialogCancel: document.getElementById('inputDialogCancel'),
  inputDialogConfirm: document.getElementById('inputDialogConfirm'),
  commandsDialog: document.getElementById('commandsDialog'),
  commandsDialogClose: document.getElementById('commandsDialogClose'),
  commandsDialogGroups: document.getElementById('commandsDialogGroups'),
  guideDialog: document.getElementById('guideDialog'),
  guideDialogClose: document.getElementById('guideDialogClose'),
  guideDialogStatus: document.getElementById('guideDialogStatus'),
  guideDialogContent: document.getElementById('guideDialogContent'),
  searchDialog: document.getElementById('searchDialog'),
  searchDialogClose: document.getElementById('searchDialogClose'),
  searchForm: document.getElementById('searchForm'),
  searchQueryInput: document.getElementById('searchQueryInput'),
  searchPhraseInput: document.getElementById('searchPhraseInput'),
  searchTagsInput: document.getElementById('searchTagsInput'),
  searchClearButton: document.getElementById('searchClearButton'),
  searchResultsCount: document.getElementById('searchResultsCount'),
  searchResultsList: document.getElementById('searchResultsList'),
  summaryOverviewButton: document.getElementById('summaryOverviewButton'),
  summaryGraphButton: document.getElementById('summaryGraphButton'),
  summaryOverview: document.getElementById('summaryOverview'),
  graphPanel: document.getElementById('graphPanel'),
  graphSvg: document.getElementById('graphSvg'),
  graphCount: document.getElementById('graphCount'),
  relationsRefreshButton: document.getElementById('relationsRefreshButton'),
  relationsDetailsButton: document.getElementById('relationsDetailsButton'),
  relationsDetailsPanel: document.getElementById('relationsDetailsPanel'),
  graphGlobalStage: document.getElementById('graphGlobalStage'),
  graphGlobalSphere: document.getElementById('graphGlobalSphere'),
  graphGlobalCount: document.getElementById('graphGlobalCount'),
  graphGlobalOverlay: document.getElementById('graphGlobalOverlay'),
  graphGlobalOverlayTitle: document.getElementById('graphGlobalOverlayTitle'),
  graphGlobalOverlaySummary: document.getElementById('graphGlobalOverlaySummary'),
  graphGlobalOverlayBadge: document.getElementById('graphGlobalOverlayBadge'),
  graphGlobalOverlayKicker: document.getElementById('graphGlobalOverlayKicker'),
  graphGlobalOverlayPath: document.getElementById('graphGlobalOverlayPath'),
  graphGlobalOverlayStatus: document.getElementById('graphGlobalOverlayStatus'),
  graphGlobalOverlayLinks: document.getElementById('graphGlobalOverlayLinks'),
  graphGlobalOverlayLayer: document.getElementById('graphGlobalOverlayLayer'),
  graphGlobalOverlayHint: document.getElementById('graphGlobalOverlayHint'),
  graphGlobalOverlayCloseButton: document.getElementById('graphGlobalOverlayCloseButton'),
  graphGlobalOverlayOpenButton: document.getElementById('graphGlobalOverlayOpenButton'),
  graphGlobalOverlayFocusButton: document.getElementById('graphGlobalOverlayFocusButton'),
  relationsNoteTitle: document.getElementById('relationsNoteTitle'),
  relationsNoteSummary: document.getElementById('relationsNoteSummary'),
  relationsNoteScore: document.getElementById('relationsNoteScore'),
  relationsOpenSelectedButton: document.getElementById('relationsOpenSelectedButton'),
  manualLinksList: document.getElementById('manualLinksList'),
  relatedList: document.getElementById('relatedList'),
  relationsManualLinksList: document.getElementById('relationsManualLinksList'),
  relationsRelatedList: document.getElementById('relationsRelatedList'),
  linkSuggestionsList: document.getElementById('linkSuggestionsList'),
  linkPreviewPanel: document.getElementById('linkPreviewPanel'),
  templatesDialog: document.getElementById('templatesDialog'),
  templatesDialogClose: document.getElementById('templatesDialogClose'),
  templatesDialogList: document.getElementById('templatesDialogList'),
  linkPickerDialog: document.getElementById('linkPickerDialog'),
  linkPickerDialogClose: document.getElementById('linkPickerDialogClose'),
  linkPickerDialogQuery: document.getElementById('linkPickerDialogQuery'),
  linkPickerDialogList: document.getElementById('linkPickerDialogList'),
  templateSelectionLabel: document.getElementById('templateSelectionLabel'),
  templateSelectionClear: document.getElementById('templateSelectionClear'),
  templateSelectionBody: document.getElementById('templateSelectionBody'),
  templateSelectionHint: document.getElementById('templateSelectionHint'),
  templatePickerDialog: document.getElementById('templatePickerDialog'),
  templatePickerClose: document.getElementById('templatePickerClose'),
  templatePickerSelect: document.getElementById('templatePickerSelect'),
  templatePickerInput: document.getElementById('templatePickerInput'),
  templatePickerContent: document.getElementById('templatePickerContent'),
  templatePickerConfirm: document.getElementById('templatePickerConfirm'),
  aiDialog: document.getElementById('aiDialog'),
  aiDialogClose: document.getElementById('aiDialogClose'),
  aiDialogOpenOpenCode: document.getElementById('aiDialogOpenOpenCode'),
  aiDialogOpenClaudeCode: document.getElementById('aiDialogOpenClaudeCode'),
  aiDialogOpenTerminal: document.getElementById('aiDialogOpenTerminal'),
  aiDialogShowCommands: document.getElementById('aiDialogShowCommands'),
  aiDialogCommandsPanel: document.getElementById('aiDialogCommandsPanel'),
  aiDialogCommandsGroups: document.getElementById('aiDialogCommandsGroups'),
  aiDialogCommandsClose: document.getElementById('aiDialogCommandsClose'),
  aiDialogCommand: document.getElementById('aiDialogCommand'),
  aiDialogVaultContext: document.getElementById('aiDialogVaultContext'),
  aiDialogStatus: document.getElementById('aiDialogStatus'),
  pinnedList: document.getElementById('pinnedList'),
  backlinksList: document.getElementById('backlinksList'),
  projectSlideTag: document.getElementById('projectSlideTag'),
  projectSlideTitle: document.getElementById('projectSlideTitle'),
  projectSlideBody: document.getElementById('projectSlideBody'),
  projectSlideDots: document.getElementById('projectSlideDots'),
  desktopNotification: document.getElementById('desktopNotification'),
  desktopNotificationClose: document.getElementById('desktopNotificationClose'),
  desktopNotificationTitle: document.getElementById('desktopNotificationTitle'),
  desktopNotificationText: document.getElementById('desktopNotificationText'),
  desktopNotificationTime: document.getElementById('desktopNotificationTime'),
  desktopNotificationAction: document.getElementById('desktopNotificationAction')
};

const projectSlides = [
  { tag: 'announcement', title: 'Local AI Improvements & New Plugin API', body: 'Version 2.4 introduces faster local embeddings for semantic search and a stable API for community plugins. No internet required.' },
  { tag: 'vault', title: 'Setup guiado', body: 'Criação e abertura agora usam a própria interface interna, sem depender do navegador.' },
  { tag: 'ui', title: 'Visual mais premium', body: 'Ícones, cards e modais estão recebendo um acabamento mais discreto e mais sólido.' }
];

let projectSlideIndex = 0;
let projectSlideTimer = null;
const graphViewport = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  lastX: 0,
  lastY: 0
};

const graphGlobalViewport = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  lastX: 0,
  lastY: 0
};

const graphGlobalScene = {
  animationFrame: null,
  lastGraph: null,
  activePath: '',
  activeCluster: '',
  hoverPath: '',
  hoverCluster: '',
  dragging: false,
  moved: false,
  startX: 0,
  startY: 0,
  motionTime: 0
};

const aiLauncherState = {
  dragging: false,
  moved: false,
  suppressClick: false,
  startX: 0,
  startY: 0,
  offsetX: 20,
  offsetY: 20
};

const searchState = {
  query: '',
  phrase: '',
  tags: ''
};

window.addEventListener('error', (event) => {
  sendDebugState('window.error', {
    message: String(event.message ?? ''),
    filename: String(event.filename ?? ''),
    lineno: Number(event.lineno ?? 0),
    colno: Number(event.colno ?? 0)
  });
});

window.addEventListener('unhandledrejection', (event) => {
  sendDebugState('window.unhandledrejection', {
    message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
  });
});

async function api(url, options = {}) {
  const desktopApiToken = await desktopApiTokenPromise;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(desktopApiToken ? { 'X-Orion-Session-Token': desktopApiToken } : {}),
      ...(options.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.error ?? 'Request failed'));
  }

  return payload;
}

function sendDebugState(label, extra = {}) {
  if (!isDesktopShell) return;

  void api('/api/debug/client-state', {
    method: 'POST',
    body: JSON.stringify({
      label,
      state: {
        vaultPath: state.vaultPath,
        defaultVaultPath: state.defaultVaultPath,
        selectedFile: state.selectedFile,
        selectedFolder: state.selectedFolder,
        activeVaultRoot: document.body.dataset.activeVaultRoot || '',
        treeChildren: state.tree?.children?.length ?? null,
        ...extra
      }
    })
  }).catch(() => {
    // Debug logging is best-effort only.
  });
}

function formatSearchSnippet(snippet) {
  return String(snippet ?? '').replace(/\[\[(.*?)\]\]/g, '<mark>$1</mark>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidVaultPath(value) {
  const path = value.trim();
  if (!path) return false;
  if (path.includes('..')) return false;
  if (/[<>"|?*]/.test(path)) return false;
  return true;
}

function vaultNameFromPath(value) {
  const normalized = value.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || 'Vault';
}

function normalizeRelativePath(value) {
   return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function fileLabel(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized.split('/').filter(Boolean).at(-1)?.replace(/\.md$/i, '') ?? normalized;
}

function setEditorTitleValue(value, { enabled = true } = {}) {
  els.noteTitle.value = String(value ?? '');
  els.noteTitle.dataset.originalValue = els.noteTitle.value;
  els.noteTitle.disabled = !enabled;
}

function currentEditorTitleValue() {
  return String(els.noteTitle.value ?? '').trim();
}

async function openLinkedNoteFromPath(pathValue) {
  const normalizedPath = normalizeRelativePath(String(pathValue ?? ''));
  if (!normalizedPath) return;
  linkedNoteState.highlightedPath = normalizedPath;
  if (linkedNoteState.clearTimer) {
    clearTimeout(linkedNoteState.clearTimer);
    linkedNoteState.clearTimer = null;
  }
  await loadNote(normalizedPath, { recordActivity: true, kind: 'open', title: `Link ${fileLabel(normalizedPath)}` });
  linkedNoteState.clearTimer = setTimeout(() => {
    linkedNoteState.highlightedPath = '';
    if (state.selectedFile) {
      renderTree(state.tree);
    }
  }, 2200);
}

function getEditorLinkNodes() {
  return [...(els.noteEditorSurface?.querySelectorAll('.editor-preview-link[data-path]') ?? [])];
}

function syncEditorLinkFocus() {
  const nodes = getEditorLinkNodes();
  nodes.forEach((node, index) => {
    node.classList.toggle('is-active', index === editorLinkState.activeIndex);
  });
  updateEditorLinkTooltip();
}

function moveEditorLinkFocus(step) {
  const nodes = getEditorLinkNodes();
  if (nodes.length === 0) return false;
  const size = nodes.length;
  editorLinkState.activeIndex = editorLinkState.activeIndex < 0 ? 0 : (editorLinkState.activeIndex + step + size) % size;
  syncEditorLinkFocus();
  return true;
}

function openActiveEditorLink() {
  const nodes = getEditorLinkNodes();
  const node = nodes[editorLinkState.activeIndex] ?? null;
  const pathValue = node?.getAttribute('data-path') ?? '';
  if (!pathValue) return false;
  void openLinkedNoteFromPath(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota linkada'));
  return true;
}

function updateEditorLinkTooltip() {
  if (!els.editorLinkTooltip || !els.noteEditorSurface) return;
  const nodes = getEditorLinkNodes();
  const node = nodes[editorLinkState.activeIndex] ?? null;
  if (!node) {
    els.editorLinkTooltip.classList.add('hidden');
    els.editorLinkTooltip.setAttribute('aria-hidden', 'true');
    return;
  }

  const nodeRect = node.getBoundingClientRect();
  const hostRect = els.noteEditorSurface.getBoundingClientRect();
  const left = Math.max(8, Math.min(hostRect.width - 170, nodeRect.left - hostRect.left));
  const top = Math.max(4, nodeRect.top - hostRect.top - 34);
  els.editorLinkTooltip.style.left = `${left}px`;
  els.editorLinkTooltip.style.top = `${top}px`;
  els.editorLinkTooltip.classList.remove('hidden');
  els.editorLinkTooltip.setAttribute('aria-hidden', 'false');
}

function clearEditorLinkFocus() {
  editorLinkState.activeIndex = -1;
  updateEditorLinkTooltip();
}

function syncHoveredEditorLink(target) {
  const link = target instanceof HTMLElement ? target.closest('.editor-preview-link[data-path]') : null;
  if (!(link instanceof HTMLElement)) {
    clearEditorLinkFocus();
    return;
  }

  const nodes = getEditorLinkNodes();
  editorLinkState.activeIndex = nodes.indexOf(link);
  syncEditorLinkFocus();
}

function applyRailCollapsed(collapsed, { persist = true } = {}) {
  document.body.classList.toggle('rail-collapsed', collapsed);

  if (els.railCollapseButton) {
    const label = collapsed ? 'Expandir menu' : 'Recolher menu';
    els.railCollapseButton.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    els.railCollapseButton.setAttribute('aria-label', label);
    els.railCollapseButton.title = label;
  }

  if (persist) {
    localStorage.setItem(uiStorageKeys.railCollapsed, collapsed ? 'true' : 'false');
  }
}

function restoreRailCollapsedPreference() {
  try {
    applyRailCollapsed(localStorage.getItem(uiStorageKeys.railCollapsed) === 'true', { persist: false });
  } catch {
    applyRailCollapsed(false, { persist: false });
  }
}

function collectMarkdownPaths(entry, paths = new Set()) {
  if (!entry) return paths;

  if (entry.kind === 'file') {
    if (String(entry.name ?? '').toLowerCase().endsWith('.md')) {
      paths.add(normalizeRelativePath(entry.relativePath));
    }
    return paths;
  }

  for (const child of entry.children ?? []) {
    collectMarkdownPaths(child, paths);
  }

  return paths;
}

function reconcileVaultScopedState(tree = state.tree) {
  const markdownPaths = collectMarkdownPaths(tree);

  state.pinnedPaths = state.pinnedPaths.filter((path) => markdownPaths.has(normalizeRelativePath(path)));
  state.recentActivity = state.recentActivity.filter((item) => item.path && markdownPaths.has(normalizeRelativePath(item.path)));

  persistRecentActivity();
  renderPinnedList();
  updatePinButton();
  renderOverviewDashboard();
}

function pathDirectory(relativePath) {
  const parts = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function collectVaultPaths(entry, paths = new Set()) {
  if (!entry) return paths;

  const relativePath = normalizeRelativePath(entry.relativePath ?? '').replace(/\/+$/g, '');
  if (relativePath) {
    paths.add(relativePath);
  }

  for (const child of entry.children ?? []) {
    collectVaultPaths(child, paths);
  }

  return paths;
}

function collectLinkCandidates(entry, items = []) {
  if (!entry) return items;

  if (entry.kind === 'file' && String(entry.name ?? '').toLowerCase().endsWith('.md')) {
    items.push({
      path: normalizeRelativePath(entry.relativePath),
      label: String(entry.title ?? fileLabel(entry.relativePath))
    });
    return items;
  }

  for (const child of entry.children ?? []) {
    collectLinkCandidates(child, items);
  }

  return items;
}

function normalizeEditorText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\u00a0/g, '');
}

function getEditorSurfaceSelectionOffsets() {
  const selection = window.getSelection();
  const root = els.noteEditorSurface;
  if (!selection || selection.rangeCount === 0 || !root) {
    return { start: 0, end: 0 };
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }

  const computeOffset = (container, offset) => {
    const lineNode = container instanceof Element
      ? container.closest('.editor-surface-line')
      : container.parentElement?.closest('.editor-surface-line');
    const lineIndex = Number(lineNode?.dataset.lineIndex ?? '0');
    const lines = String(els.noteEditor.value ?? '').split('\n');
    const baseOffset = lines.slice(0, lineIndex).reduce((total, line) => total + line.length + 1, 0);
    if (!lineNode) return baseOffset;
    const localRange = document.createRange();
    localRange.selectNodeContents(lineNode);
    localRange.setEnd(container, offset);
    return baseOffset + normalizeEditorText(localRange.toString()).length;
  };

  return {
    start: computeOffset(range.startContainer, range.startOffset),
    end: computeOffset(range.endContainer, range.endOffset)
  };
}

function setEditorSurfaceSelection(start, end = start) {
  const root = els.noteEditorSurface;
  if (!root) return;

  const selection = window.getSelection();
  if (!selection) return;

  const clamp = (value) => Math.max(0, Math.min(String(els.noteEditor.value ?? '').length, value));
  const lines = String(els.noteEditor.value ?? '').split('\n');
  const resolvePoint = (globalOffset) => {
    let remaining = clamp(globalOffset);
    let lineIndex = 0;
    while (lineIndex < lines.length - 1 && remaining > lines[lineIndex].length) {
      remaining -= lines[lineIndex].length + 1;
      lineIndex += 1;
    }

    const lineNode = root.querySelector(`.editor-surface-line[data-line-index="${lineIndex}"]`) ?? root.lastChild ?? root;
    const walker = document.createTreeWalker(lineNode, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    let localRemaining = remaining;
    while (current) {
      const textLength = normalizeEditorText(current.nodeValue ?? '').length;
      if (localRemaining <= textLength) {
        return { node: current, offset: Math.min((current.nodeValue ?? '').length, localRemaining) };
      }
      localRemaining -= textLength;
      current = walker.nextNode();
    }

    const fallbackTextNode = lineNode.lastChild instanceof Text ? lineNode.lastChild : null;
    return { node: fallbackTextNode ?? lineNode, offset: fallbackTextNode ? (fallbackTextNode.nodeValue ?? '').length : lineNode.childNodes.length };
  };

  const startPoint = resolvePoint(start);
  const endPoint = resolvePoint(end);
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  updateEditorCurrentLine();
}

function updateEditorCurrentLine() {
  const root = els.noteEditorSurface;
  if (!root) return;
  const { start } = getEditorSelection();
  const before = String(els.noteEditor.value ?? '').slice(0, start);
  editorSurfaceState.currentLineIndex = before ? before.split('\n').length - 1 : 0;
}

function getEditorSelection() {
  return {
    value: String(els.noteEditor.value ?? ''),
    ...getEditorSurfaceSelectionOffsets()
  };
}


function replaceEditorRange(start, end, text, { selectionStart = null, selectionEnd = null } = {}) {
  const value = String(els.noteEditor.value ?? '');
  editorHistory.beginTrackedEditorChange();
  els.noteEditor.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const nextSelectionStart = selectionStart === null ? start + text.length : selectionStart;
  const nextSelectionEnd = selectionEnd === null ? nextSelectionStart : selectionEnd;
  editorPendingSelection.start = nextSelectionStart;
  editorPendingSelection.end = nextSelectionEnd;
  els.noteEditor.dispatchEvent(new Event('input', { bubbles: true }));
}

function getCurrentEditorLine() {
  const { value, start, end } = getEditorSelection();
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lineText = value.slice(lineStart, lineEnd);
  const beforeCursor = value.slice(lineStart, start);
  return { value, start, end, lineStart, lineEnd, lineText, beforeCursor };
}

function getEditorSelectedLineRange() {
  const { value, start, end } = getEditorSelection();
  const normalizedEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const rangeStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf('\n', normalizedEnd);
  const rangeEnd = nextBreak === -1 ? value.length : nextBreak;
  return {
    value,
    start,
    end,
    rangeStart,
    rangeEnd,
    block: value.slice(rangeStart, rangeEnd)
  };
}

function handleEditorKeydown(event) {
  const shortcutKey = event.ctrlKey || event.metaKey;

  if (shortcutKey && !event.altKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redoEditorChange();
      return;
    }
    undoEditorChange();
    return;
  }

  if (shortcutKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redoEditorChange();
    return;
  }

  if (hasEditorAssistItems()) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveEditorAssistSelection(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveEditorAssistSelection(-1);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applyActiveEditorAssistItem();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditorAssistMenu();
      return;
    }
  }

  if (shortcutKey && !event.shiftKey && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    applyMarkdownWrap('**');
    return;
  }

  if (shortcutKey && !event.shiftKey && event.key.toLowerCase() === 'i') {
    event.preventDefault();
    applyMarkdownWrap('*');
    return;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowRight') {
    event.preventDefault();
    moveEditorLinkFocus(1);
    return;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowLeft') {
    event.preventDefault();
    moveEditorLinkFocus(-1);
    return;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'Enter') {
    if (openActiveEditorLink()) {
      event.preventDefault();
      return;
    }
  }

  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    indentSelectedListLines(event.shiftKey ? -1 : 1);
    return;
  }

  if (shortcutKey && event.altKey && !event.shiftKey && event.key === '1') {
    event.preventDefault();
    toggleHeadingOnSelectedLines('# ');
    return;
  }

  if (shortcutKey && event.altKey && !event.shiftKey && event.key === '2') {
    event.preventDefault();
    toggleHeadingOnSelectedLines('## ');
    return;
  }

  if (shortcutKey && event.altKey && !event.shiftKey && event.key === '3') {
    event.preventDefault();
    toggleHeadingOnSelectedLines('### ');
    return;
  }

  if (event.key === 'Enter' && continueMarkdownList(event)) {
    return;
  }
}

function handleEditorBeforeInput(event) {
  if (!state.selectedFile) return;

  const selection = getEditorSelection();
  if (event.inputType === 'insertText') {
    event.preventDefault();
    replaceEditorRange(selection.start, selection.end, event.data ?? '');
    return;
  }

  if (event.inputType === 'deleteContentBackward') {
    event.preventDefault();
    if (selection.start !== selection.end) {
      replaceEditorRange(selection.start, selection.end, '');
      return;
    }
    if (selection.start === 0) return;
    replaceEditorRange(selection.start - 1, selection.end, '');
    return;
  }

  if (event.inputType === 'deleteContentForward') {
    event.preventDefault();
    if (selection.start !== selection.end) {
      replaceEditorRange(selection.start, selection.end, '');
      return;
    }
    replaceEditorRange(selection.start, Math.min(selection.end + 1, selection.value.length), '');
    return;
  }

  if (event.inputType === 'insertParagraph') {
    event.preventDefault();
    replaceEditorRange(selection.start, selection.end, '\n');
    return;
  }

  if (event.inputType === 'insertFromPaste') {
    event.preventDefault();
    const pasted = event.dataTransfer?.getData('text/plain') ?? event.data ?? '';
    replaceEditorRange(selection.start, selection.end, normalizeEditorText(pasted));
  }
}

function splitRelativeLeaf(relativePath) {
  const normalized = normalizeRelativePath(relativePath).replace(/\/+$/g, '');
  const parts = normalized.split('/').filter(Boolean);
  const leaf = parts.pop() ?? '';
  return { parent: parts.join('/'), leaf };
}

function suffixRelativeLeaf(relativePath, suffix) {
  const { parent, leaf } = splitRelativeLeaf(relativePath);
  const dotIndex = leaf.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const stem = hasExtension ? leaf.slice(0, dotIndex) : leaf;
  const extension = hasExtension ? leaf.slice(dotIndex) : '';
  const nextLeaf = `${stem}-${suffix}${extension}`;
  return parent ? `${parent}/${nextLeaf}` : nextLeaf;
}

function makeUniqueVaultPath(base, name) {
  const candidate = joinRelativePath(base, name);
  const existingPaths = collectVaultPaths(state.tree);

  if (!existingPaths.has(candidate)) {
    return candidate;
  }

  for (let index = 1; index < 1000; index += 1) {
    const nextCandidate = suffixRelativeLeaf(candidate, index);
    if (!existingPaths.has(nextCandidate)) {
      return nextCandidate;
    }
  }

  return candidate;
}

function makeUniqueVaultPathForTarget(targetPath) {
  const candidate = normalizeRelativePath(targetPath);
  const existingPaths = collectVaultPaths(state.tree);

  if (!existingPaths.has(candidate)) {
    return candidate;
  }

  for (let index = 1; index < 1000; index += 1) {
    const nextCandidate = suffixRelativeLeaf(candidate, index);
    if (!existingPaths.has(nextCandidate)) {
      return nextCandidate;
    }
  }

  return candidate;
}

async function openLinkPickerDialog() {
  await resourceBrowser.openLinkPickerDialog();
}

function containerForSelection() {
  if (state.selectedFolder) return state.selectedFolder;
  return '';
}

function prettyPath(relativePath) {
  return normalizeRelativePath(relativePath).replace(/\//g, ' / ');
}

function isWithinRelativePath(parentPath, candidatePath) {
  const parent = normalizeRelativePath(parentPath).replace(/\/+$/g, '');
  const candidate = normalizeRelativePath(candidatePath).replace(/\/+$/g, '');
  if (!parent || !candidate) return false;
  return candidate === parent || candidate.startsWith(`${parent}/`);
}

function isProtectedAgendaFolderPath(relativePath) {
  return normalizeRelativePath(relativePath).replace(/\/+$/g, '') === 'Agenda';
}

function parseAgendaDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function agendaDateLabel(value) {
  const date = parseAgendaDate(value);
  if (!date) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function agendaNotificationKey(item, windowKey) {
  return `${item.path}|${windowKey}|${item.due}`;
}

function loadAgendaReminderKeys() {
  try {
    const raw = localStorage.getItem('orion-vault-agenda-reminders');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistAgendaReminderKeys() {
  localStorage.setItem('orion-vault-agenda-reminders', JSON.stringify([...state.agendaReminderKeys]));
}

function agendaShouldNotify(item, now = Date.now()) {
  if (item.status === 'done') return [];

  const due = parseAgendaDate(item.due);
  if (!due) return [];

  const diff = due.getTime() - now;
  const windows = [];
  if (diff <= 24 * 60 * 60 * 1000 && diff > 60 * 60 * 1000) windows.push({ key: '1d', title: 'Lembrete em 1 dia', body: `${item.title} vence em ${agendaDateLabel(item.due)}` });
  if (diff <= 60 * 60 * 1000 && diff > 0) windows.push({ key: '1h', title: 'Lembrete em 1 hora', body: `${item.title} vence em ${agendaDateLabel(item.due)}` });
  if (diff <= 0 && diff > -60 * 60 * 1000) windows.push({ key: 'now', title: 'Prazo agora', body: `${item.title} venceu em ${agendaDateLabel(item.due)}` });
  return windows;
}

function suppressImmediateAgendaReminders(item, now = Date.now()) {
  for (const reminder of agendaShouldNotify(item, now)) {
    state.agendaReminderKeys.add(agendaNotificationKey(item, reminder.key));
  }
  persistAgendaReminderKeys();
}

function joinRelativePath(base, name) {
  const cleanBase = normalizeRelativePath(base || '').replace(/\/+$/g, '');
  const cleanName = normalizeRelativePath(name || '').replace(/^\/+/, '');
  if (!cleanBase) return cleanName;
  return `${cleanBase}/${cleanName}`;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });
}

function setView(view) {
  state.view = view;
  els.viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  els.setupView.classList.toggle('active', view === 'setup');
  els.agendaView.classList.toggle('active', view === 'agenda');
  els.relationsView.classList.toggle('active', view === 'relations');
  els.workspaceView.classList.toggle('active', view === 'workspace');
  document.body.dataset.view = view;

  if (view === 'setup') {
    els.pageTitle.textContent = 'Overview';
    els.pageSubtitle.textContent = 'Fronteira explícita, prazos, atividade recente e métricas do vault.';
    els.vaultPathInput.placeholder = getDefaultVaultPath();
  } else if (view === 'agenda') {
    els.pageTitle.textContent = 'Agenda';
    els.pageSubtitle.textContent = 'Notas com prazo, status e alertas locais.';
    els.vaultPathInput.placeholder = getDefaultVaultPath();
  } else if (view === 'relations') {
    els.pageTitle.textContent = 'Relações';
    els.pageSubtitle.textContent = 'Links manuais, relações inferidas e graph global do vault.';
    els.vaultPathInput.placeholder = getDefaultVaultPath();
  } else {
    els.pageTitle.textContent = 'Workspace';
    els.pageSubtitle.textContent = 'Árvore de notas, editor central e painéis auxiliares.';
    els.vaultPathInput.placeholder = getDefaultVaultPath();
  }

  if (view === 'relations') {
    startIslandGlobalGraphAnimation();
  } else {
    stopIslandGlobalGraphAnimation();
  }

  syncWorkspaceState();
}

function setDesktopReady(isReady) {
  if (!isDesktopShell) return;
  document.body.dataset.desktopReady = isReady ? 'true' : 'false';
}

async function refreshAfterVaultChange(payload) {
  const nextPath = normalizeRelativePath(String(payload?.path ?? ''));
  const isExternalChange = payload?.kind === 'external';
  if (isExternalChange && consumeLocalVaultWrite(nextPath)) return;

  const bootstrapVaultRoot = isDesktopShell ? await getDesktopBootstrapVaultRoot() : '';
  const nextVaultRoot = String(payload?.vaultRoot ?? bootstrapVaultRoot ?? getConfiguredVaultRoot()).trim();
  const isAgendaNote = nextPath.startsWith('Agenda/') || payload?.kind === 'agenda';
  const isCurrentNoteChange = nextPath === normalizeRelativePath(state.selectedFile || '');
  const shouldOpenChangedNote = isExternalChange
    && /\.(md|markdown)$/i.test(nextPath)
    && !isCurrentNoteChange;

  if (isExternalChange && isCurrentNoteChange && editorSaveState.dirty) {
    const shouldReloadExternalContent = window.confirm(
      `A nota ${nextPath} foi alterada fora do Orion Vault. Recarregar e descartar o rascunho local?`
    );
    if (!shouldReloadExternalContent) {
      els.editorStatus.textContent = 'Alteração externa detectada. Seu rascunho local foi preservado.';
      updateEditorDraftIndicator('Rascunho local preservado', 'dirty');
      return;
    }
    clearEditorDraft(nextPath);
    resetEditorSaveState(els.noteEditor.value);
  }

  if (isAgendaNote) {
    await loadAgenda(nextVaultRoot);
  }

  await refreshWorkspace(shouldOpenChangedNote ? nextPath : (state.selectedFile || ''), Boolean(state.selectedFile || shouldOpenChangedNote));
  if (state.view === 'relations' || state.selectedFile) {
    await refreshRelationsSurface().catch(() => null);
  }
}

function updateVault(value) {
  const draftValue = String(value ?? '').trim();
  const activeVault = getConfiguredVaultRoot() || getDefaultVaultPath();
  const activeValid = isValidVaultPath(activeVault);
  const draftValid = draftValue ? isValidVaultPath(draftValue) : activeValid;

  document.body.dataset.activeVaultRoot = activeVault;

  els.vaultName.textContent = vaultNameFromPath(activeVault);
  els.vaultRootDisplay.textContent = activeVault || 'Não selecionado';
  if (draftValue && !draftValid) {
    els.vaultStateText.textContent = 'invalido';
    els.vaultHealthPill.textContent = 'review';
  } else if (!getConfiguredVaultRoot() && (draftValue || getDefaultVaultPath())) {
    els.vaultStateText.textContent = 'pendente';
    els.vaultHealthPill.textContent = 'idle';
  } else {
    els.vaultStateText.textContent = activeValid ? 'ativo' : 'invalido';
  }
  els.setupHint.textContent = draftValue
    ? (isValidVaultPath(draftValue) ? setupHints.valid : setupHints.invalid)
    : `O vault padrão deste app é ${activeVault || 'não selecionado'}.`;

  void refreshSetupState(draftValue || activeVault);
}

async function refreshSetupState(candidateVaultRoot = '') {
  const requestedVaultRoot = String(candidateVaultRoot ?? '').trim();
  const requestId = ++setupStateRequestId;

  const applyButtonState = (label) => {
    if (els.startVaultButton) {
      els.startVaultButton.textContent = label;
    }
    if (els.emptyStartVaultButton) {
      els.emptyStartVaultButton.textContent = label;
    }
  };

  if (!requestedVaultRoot) {
    applyButtonState('Iniciar');
    els.openWorkspaceButton.textContent = 'Abrir workspace';
    return;
  }

  if (!isValidVaultPath(requestedVaultRoot)) {
    applyButtonState('Corrigir caminho');
    els.openWorkspaceButton.textContent = 'Abrir workspace';
    return;
  }

  try {
    const workspace = await api(`/api/workspace?vaultRoot=${encodeURIComponent(requestedVaultRoot)}`);
    if (requestId !== setupStateRequestId) {
      return;
    }

    const exists = workspace?.exists !== false;
    applyButtonState(exists ? 'Abrir vault' : 'Criar vault');
    els.openWorkspaceButton.textContent = getConfiguredVaultRoot() ? 'Abrir workspace' : (exists ? 'Abrir workspace' : 'Criar workspace');

    if (!String(els.vaultPathInput.value ?? '').trim() || String(els.vaultPathInput.value ?? '').trim() === requestedVaultRoot) {
      els.setupHint.textContent = exists ? setupHints.existing : setupHints.missing;
    }
  } catch {
    if (requestId !== setupStateRequestId) {
      return;
    }

    applyButtonState('Iniciar');
    els.openWorkspaceButton.textContent = 'Abrir workspace';
  }
}

function getDefaultVaultPath() {
  return state.defaultVaultPath || '';
}

function showError(message) {
  els.setupHint.textContent = message;
  els.editorStatus.textContent = message;
  if (els.agendaStatusMessage) {
    els.agendaStatusMessage.textContent = message;
  }
  if (els.aiDialogStatus) {
    els.aiDialogStatus.textContent = message;
  }
}

function hideDesktopNotification() {
  uiShell.hideDesktopNotification();
}

function closeGuideDialog() {
  uiShell.closeGuideDialog();
}

async function openGuideDialog() {
  await uiShell.openGuideDialog();
}

function getActiveVaultPath() {
  return state.vaultPath || '';
}

function getConfiguredVaultRoot() {
  return state.vaultPath || '';
}

const aiDevMode = createAiDevModeController({
  api,
  els,
  getActiveVaultPath,
  showError,
  updateSetupHint: (text) => {
    els.setupHint.textContent = text;
  },
  bridgeProvider: () => window.orionDesktop,
  body: document.body,
  storage: window.localStorage
});

let overviewDashboard = null;
let agendaController = null;

overviewDashboard = createOverviewDashboardController({
  state,
  els,
  storage: window.localStorage,
  normalizeRelativePath,
  escapeHtml,
  prettyPath,
  buildAgendaStatusData: () => agendaController.buildAgendaStatusData()
});

agendaController = createAgendaController({
  state,
  els,
  api,
  isDesktopShell,
  getDesktopBootstrapVaultRoot,
  getConfiguredVaultRoot,
  showError,
  renderOverviewDashboard: () => overviewDashboard.renderOverviewDashboard(),
  syncDesktopActiveVaultRoot,
  ensureActiveVaultReady,
  makeUniqueVaultPathForTarget,
  sendDebugState,
  recordActivity: (...args) => overviewDashboard.recordActivity(...args),
  loadAgendaReminderKeys,
  persistAgendaReminderKeys,
  suppressImmediateAgendaReminders,
  openNote: async (pathValue) => loadNote(pathValue, { recordActivity: true, kind: 'open' }),
  setView,
  checkAgendaReminders,
  bridgeProvider: () => window.orionDesktop,
  prettyPath
});

const relationsSurface = createRelationsSurfaceController({
  state,
  els,
  api,
  getConfiguredVaultRoot,
  renderBacklinksList,
  refreshGlobalGraph: async () => refreshGlobalGraph(),
  refreshAfterVaultChange,
  escapeHtml,
  fileLabel,
  prettyPath
});

let workspaceCore = null;
let workspaceGraph = null;
let globalGraph = null;
let resourceBrowser = null;
let uiShell = null;
let vaultBootstrap = null;

const workspaceTree = createWorkspaceTreeController({
  state,
  els,
  normalizeRelativePath,
  prettyPath,
  sortEntries,
  refreshGraph: async () => refreshGraph(),
  syncWorkspaceState,
  renderPinnedList,
  updatePinButton,
  linkedNoteState,
  loadNote: async (pathValue, options) => workspaceCore.loadNote(pathValue, options),
  showFolderContextMenu,
  showNoteContextMenu: (...args) => uiShell.showNoteContextMenu(...args)
});

workspaceCore = createWorkspaceCoreController({
  state,
  els,
  api,
  getConfiguredVaultRoot,
  applyActiveVaultRoot,
  reconcileVaultScopedState,
  renderTree: workspaceTree.renderTree,
  loadPinnedPaths,
  setEditorTitleValue,
  resetEditorHistory: (...args) => editorHistory.resetEditorHistory(...args),
  resetEditorSaveState: (...args) => editorHistory.resetEditorSaveState(...args),
  renderEditorPresentation: () => editorPresentation.renderEditorPresentation(),
  closeEditorAssistMenu: () => editorAssist.closeEditorAssistMenu(),
  syncWorkspaceState,
  updateVaultSummary,
  updatePinButton,
  refreshBacklinks,
  refreshGraph,
  loadRelatedData: relationsSurface.loadRelatedData,
  loadLinkSuggestions: relationsSurface.loadLinkSuggestions,
  renderLinkPreview: relationsSurface.renderLinkPreview,
  refreshGlobalGraph,
  recordActivity: (...args) => overviewDashboard.recordActivity(...args),
  fileLabel,
  prettyPath,
  pathDirectory,
  readEditorDraft: (...args) => editorHistory.readEditorDraft(...args),
  markEditorDirty: () => editorHistory.markEditorDirty(),
  ensureActiveVaultReady,
  containerForSelection,
  openInputDialog,
  makeUniqueVaultPath,
  normalizeRelativePath,
  makeUniqueVaultPathForTarget,
  setView,
  updatePinButtonAndPinnedList: () => {
    renderPinnedList();
    updatePinButton();
  },
  refreshOverviewAfterSave: () => overviewDashboard.renderOverviewDashboard(),
  sendDebugState
});

workspaceGraph = createWorkspaceGraphController({
  state,
  els,
  graphViewport,
  escapeHtml,
  api,
  getConfiguredVaultRoot,
  normalizeRelativePath,
  setView,
  syncWorkspaceState,
  selectFolder: workspaceTree.selectFolder,
  loadNote: async (pathValue, options) => workspaceCore.loadNote(pathValue, options)
});

globalGraph = createGlobalGraphController({
  state,
  els,
  graphGlobalScene,
  graphGlobalViewport,
  normalizeRelativePath,
  fileLabel,
  prettyPath,
  escapeHtml,
  api,
  getConfiguredVaultRoot,
  refreshRelationsSurface: async () => refreshRelationsSurface(),
  isDesktopShell,
  startVault,
  setView,
  showError,
  refreshWorkspace: async (...args) => workspaceCore.refreshWorkspace(...args),
  refreshGraph: async () => workspaceGraph.refreshGraph(),
  loadNote: async (pathValue, options) => workspaceCore.loadNote(pathValue, options),
  syncWorkspaceState,
  closeRelationsDetailsMenu: () => workspaceGraph.closeRelationsDetailsMenu()
});

resourceBrowser = createResourceBrowserController({
  state,
  els,
  searchState,
  linkPickerSelectionRef: linkPickerSelection,
  api,
  getConfiguredVaultRoot,
  ensureActiveVaultReady,
  refreshWorkspace: async (...args) => workspaceCore.refreshWorkspace(...args),
  getEditorSelection,
  getEditorValue: () => els.noteEditor.value,
  replaceEditorRange,
  saveNote: async (options) => saveNote(options),
  focusEditorSurface: () => els.noteEditorSurface?.focus(),
  collectLinkCandidates,
  escapeHtml,
  fileLabel,
  prettyPath,
  formatSearchSnippet,
  setSelectedTemplate,
  loadNote: async (pathValue, options) => workspaceCore.loadNote(pathValue, options),
  showError
});

uiShell = createUiShellController({
  state,
  els,
  isDesktopShell,
  sessionRef: {
    get current() {
      return inputDialogSession;
    },
    set current(value) {
      inputDialogSession = value;
    }
  },
  api,
  normalizeRelativePath,
  selectFolder: workspaceTree.selectFolder,
  closeAgendaOptionsMenu: () => agendaController.closeAgendaOptionsMenu(),
  closeOverviewOptionsMenu: () => overviewDashboard.closeOverviewOptionsMenu(),
  closeRelationsDetailsMenu: () => workspaceGraph.closeRelationsDetailsMenu(),
  createNote: async () => workspaceCore.createNote(),
  createFolder: async () => workspaceCore.createFolder(),
  renameEntry: async (...args) => workspaceCore.renameEntry(...args),
  moveEntry: async (...args) => workspaceCore.moveEntry(...args),
  deleteEntry: async (target) => deleteSelectedWorkspaceEntry(target),
  openNote: async (...args) => workspaceCore.loadNote(...args),
  showError
});

vaultBootstrap = createVaultBootstrapController({
  state,
  els,
  bootstrapState: {
    get promise() {
      return desktopBootstrapPromise;
    },
    set promise(value) {
      desktopBootstrapPromise = value;
    },
    get complete() {
      return desktopBootstrapComplete;
    },
    set complete(value) {
      desktopBootstrapComplete = value;
    }
  },
  isDesktopShell,
  startupVaultRoot,
  api,
  sendDebugState,
  showError,
  updateVault,
  setDesktopReady,
  setView,
  syncWorkspaceState,
  refreshWorkspace: async (...args) => workspaceCore.refreshWorkspace(...args),
  loadPinnedPaths,
  loadTemplates,
  loadAgenda: async (...args) => agendaController.loadAgenda(...args),
  ensureAgendaReminderPolling,
  getConfiguredVaultRoot: () => state.vaultPath || '',
  getDefaultVaultPath: () => state.defaultVaultPath || '',
  getActiveVaultPath: () => state.vaultPath || '',
  getDesktopBridge: () => window.orionDesktop,
  markDesktopReady: () => {
    if (window.orionDesktop && typeof window.orionDesktop.markDesktopReady === 'function') {
      window.orionDesktop.markDesktopReady();
    }
  },
  onBootstrapFinished: () => {
    syncWorkspaceState();
  }
});

const loadRecentActivity = overviewDashboard.loadRecentActivity;
const persistRecentActivity = overviewDashboard.persistRecentActivity;
const recordActivity = overviewDashboard.recordActivity;
const renderOverviewDashboard = overviewDashboard.renderOverviewDashboard;
const toggleOverviewOptionsMenu = overviewDashboard.toggleOverviewOptionsMenu;
const editorPresentation = createEditorPresentationController({
  els,
  editorPreviewState,
  escapeHtml,
  getEditorValue: () => els.noteEditor.value,
  syncEditorLinkFocus,
  updateEditorCurrentLine
});
const editorAssist = createEditorAssistController({
  state,
  els,
  editorAssistState,
  editorSlashCommands,
  escapeHtml,
  collectLinkCandidates,
  getCurrentEditorLine,
  replaceEditorRange,
  isEditorFocused: () => document.activeElement === els.noteEditorSurface
});
const editorFormatting = createEditorFormattingController({
  getEditorSelection,
  getCurrentEditorLine,
  getEditorSelectedLineRange,
  replaceEditorRange
});
const closeEditorAssistMenu = editorAssist.closeEditorAssistMenu;
const updateEditorAssistMenu = editorAssist.updateEditorAssistMenu;
const moveEditorAssistSelection = editorAssist.moveEditorAssistSelection;
const applyActiveEditorAssistItem = editorAssist.applyActiveEditorAssistItem;
const hasEditorAssistItems = editorAssist.hasEditorAssistItems;
const applyMarkdownWrap = editorFormatting.applyMarkdownWrap;
const continueMarkdownList = editorFormatting.continueMarkdownList;
const indentSelectedListLines = editorFormatting.indentSelectedListLines;
const toggleHeadingOnSelectedLines = editorFormatting.toggleHeadingOnSelectedLines;
const renderEditorPresentation = editorPresentation.renderEditorPresentation;
const setEditorPreviewExpanded = editorPresentation.setEditorPreviewExpanded;
const editorHistory = createEditorHistoryController({
  state,
  els,
  storage: window.localStorage,
  uiStorageKeys,
  editorHistoryState,
  editorSaveState,
  normalizeRelativePath,
  normalizeEditorText,
  getEditorSelection,
  getEditorValue: () => els.noteEditor.value,
  renderEditorPresentation,
  setEditorSurfaceSelection,
  focusEditorSurface: () => els.noteEditorSurface?.focus(),
  getPendingSelection: () => ({
    start: editorPendingSelection.start ?? 0,
    end: editorPendingSelection.end ?? editorPendingSelection.start ?? 0
  }),
  setPendingSelection: (start, end) => {
    editorPendingSelection.start = start;
    editorPendingSelection.end = end;
  },
  clearPendingSelection: () => {
    editorPendingSelection.start = null;
    editorPendingSelection.end = null;
  },
  hasEditorAssistItems,
  saveNote: (options) => saveNote(options),
  showError
});
const writeEditorDraft = editorHistory.writeEditorDraft;
const clearEditorDraft = editorHistory.clearEditorDraft;
const markEditorDirty = editorHistory.markEditorDirty;
const resetEditorHistory = editorHistory.resetEditorHistory;
const resetEditorSaveState = editorHistory.resetEditorSaveState;
const undoEditorChange = editorHistory.undoEditorChange;
const redoEditorChange = editorHistory.redoEditorChange;
const updateEditorDraftIndicator = editorHistory.updateEditorDraftIndicator;
const scheduleEditorAutoSave = editorHistory.scheduleEditorAutoSave;
const isApplyingEditorHistory = editorHistory.isApplyingEditorHistory;
const formatAgendaInputValue = agendaController.formatAgendaInputValue;
const loadAgenda = agendaController.loadAgenda;
const openAgendaItem = agendaController.openAgendaItem;
const loadLinkPreview = relationsSurface.loadLinkPreview;
const applyPreviewLink = relationsSurface.applyPreviewLink;
const refreshRelationsSurface = relationsSurface.refreshRelationsSurface;
const handleFolderSelectionBackgroundClick = workspaceTree.handleFolderSelectionBackgroundClick;
const renderTree = workspaceTree.renderTree;
const refreshWorkspace = workspaceCore.refreshWorkspace;
const loadNote = workspaceCore.loadNote;
const createFolder = workspaceCore.createFolder;
const createNote = workspaceCore.createNote;
const renameCurrentNoteToPath = workspaceCore.renameCurrentNoteToPath;
const renameNote = workspaceCore.renameNote;
const moveNote = workspaceCore.moveNote;

function applyAiLauncherPosition(left, top) {
  if (!els.aiLauncher) return;
  const clampedLeft = Math.max(12, Math.min(window.innerWidth - 72, left));
  const clampedTop = Math.max(72, Math.min(window.innerHeight - 72, top));
  aiLauncherState.offsetX = clampedLeft;
  aiLauncherState.offsetY = clampedTop;
  els.aiLauncher.style.left = `${clampedLeft}px`;
  els.aiLauncher.style.top = `${clampedTop}px`;
  els.aiLauncher.style.right = 'auto';
  els.aiLauncher.style.bottom = 'auto';
}

function restoreAiLauncherPosition() {
  if (!els.aiLauncher) return;
  const saved = localStorage.getItem('orion-vault-ai-launcher-position');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        applyAiLauncherPosition(parsed.left, parsed.top);
        return;
      }
    } catch {
      // ignore malformed state
    }
  }

  applyAiLauncherPosition((window.innerWidth / 2) - 55, window.innerHeight - 92);
}

function onAiLauncherActivate() {
  if (aiLauncherState.suppressClick) {
    aiLauncherState.suppressClick = false;
    return;
  }

  aiDevMode.openDialog();
}

function persistAiLauncherPosition() {
  localStorage.setItem('orion-vault-ai-launcher-position', JSON.stringify({ left: aiLauncherState.offsetX, top: aiLauncherState.offsetY }));
}

function getNoteNameFromPath(relativePath) {
  return fileLabel(relativePath);
}

function setSelectedTemplate(template) {
  state.selectedTemplate = template;
  if (template) {
    els.templateSelectionLabel.textContent = template.title;
    els.templateSelectionBody.textContent = template.path;
    els.templateSelectionHint.textContent = 'Será usada como base na próxima nota.';
  } else {
    els.templateSelectionLabel.textContent = 'Nenhum modelo';
    els.templateSelectionBody.textContent = 'A próxima nota começa vazia.';
    els.templateSelectionHint.textContent = 'Escolha um modelo para acelerar a criação.';
  }
}

function updatePinButton() {
  const isPinned = state.selectedFile && state.pinnedPaths.includes(state.selectedFile);
  if (els.noteOptionPinLabel) {
    els.noteOptionPinLabel.textContent = isPinned ? 'Desafixar' : 'Fixar';
  }
}

function renderPinnedList() {
  els.pinnedList.innerHTML = state.pinnedPaths.length === 0
    ? '<div class="empty-inline">Nenhuma nota fixada.</div>'
    : state.pinnedPaths.map((path) => `
      <button class="pin-item" type="button" data-path="${escapeHtml(path)}">
        <span>${escapeHtml(getNoteNameFromPath(path))}</span>
        <small>${escapeHtml(prettyPath(path))}</small>
      </button>
    `).join('');
}

function renderBacklinksList() {
  els.backlinksList.innerHTML = state.backlinks.length === 0
    ? `<div class="empty-inline">${state.selectedFile ? 'Sem backlinks.' : 'Selecione uma nota para ver backlinks.'}</div>`
    : state.backlinks.map((item) => `
      <button class="backlink-item" type="button" data-path="${escapeHtml(item.path)}">
        <span>${escapeHtml(item.title || getNoteNameFromPath(item.path))}</span>
        <small>${escapeHtml(prettyPath(item.path))}</small>
      </button>
    `).join('');
}

async function notifyAgendaItem(item, windowKey, title, body) {
  const bridge = window.orionDesktop;
  if (!bridge || typeof bridge.notifyAgendaReminder !== 'function') return;

  const reminderKey = agendaNotificationKey(item, windowKey);
  if (state.agendaReminderKeys.has(reminderKey)) return;

  state.agendaReminderKeys.add(reminderKey);
  persistAgendaReminderKeys();
  await bridge.notifyAgendaReminder({ title, body });
}

async function checkAgendaReminders(items = state.agendaItems) {
  const now = Date.now();
  for (const item of items) {
    if (item.status === 'done') continue;

    for (const reminder of agendaShouldNotify(item, now)) {
      await notifyAgendaItem(item, reminder.key, reminder.title, reminder.body);
    }
  }
}

function ensureAgendaReminderPolling() {
  if (isDesktopShell || state.agendaReminderTimer) return;

  state.agendaReminderTimer = setInterval(() => {
    if (!getConfiguredVaultRoot()) return;
    void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar agenda'));
  }, 60_000);
}

function closeRelationsDetailsMenu() {
  workspaceGraph.closeRelationsDetailsMenu();
}

function toggleRelationsDetailsMenu() {
  workspaceGraph.toggleRelationsDetailsMenu();
}

function setSummaryMode(mode) {
  workspaceGraph.setSummaryMode(mode);
}

function renderGraph(graph) {
  workspaceGraph.renderGraph(graph);
}

function resetGraphViewport() {
  workspaceGraph.resetGraphViewport();
}

function zoomGraph(delta, originX = 180, originY = 180) {
  workspaceGraph.zoomGraph(delta, originX, originY);
}

function startGraphDrag(clientX, clientY) {
  workspaceGraph.startGraphDrag(clientX, clientY);
}

function moveGraphDrag(clientX, clientY) {
  workspaceGraph.moveGraphDrag(clientX, clientY);
}

function stopGraphDrag() {
  workspaceGraph.stopGraphDrag();
}

async function openGraphNode(relativePath, kind) {
  await workspaceGraph.openGraphNode(relativePath, kind);
}

async function loadPinnedPaths() {
  const data = await api('/api/pins');
  state.pinnedPaths = (data.pinnedPaths ?? []).map((value) => normalizeRelativePath(String(value)));
  if (state.tree) {
    reconcileVaultScopedState(state.tree);
    return;
  }
  renderPinnedList();
  updatePinButton();
}

async function refreshBacklinks() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot || !state.selectedFile) {
    state.backlinks = [];
    renderBacklinksList();
    return;
  }

  const params = new URLSearchParams({ vaultRoot, path: state.selectedFile });
  const data = await api(`/api/backlinks?${params.toString()}`);
  state.backlinks = data.backlinks ?? [];
  renderBacklinksList();
}

async function refreshGraph() {
  await workspaceGraph.refreshGraph();
}

function startIslandGlobalGraphAnimation() {
  globalGraph.startIslandGlobalGraphAnimation();
}

function stopIslandGlobalGraphAnimation() {
  globalGraph.stopIslandGlobalGraphAnimation();
}

async function refreshGlobalGraph() {
  await globalGraph.refreshGlobalGraph();
}

async function openRelationsView() {
  await globalGraph.openRelationsView();
}

async function loadTemplates() {
  await resourceBrowser.loadTemplates();
}

async function openTemplatesDialog() {
  await resourceBrowser.openTemplatesDialog();
}

async function openTemplatePickerDialog() {
  await resourceBrowser.openTemplatePickerDialog();
}

function openSearchDialog() {
  resourceBrowser.openSearchDialog();
}

window.orionAiActions = aiDevMode.buildWindowActions();

function bytesToCompactLabel(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function updateVaultSummary(summary) {
  state.overviewSummary = summary ?? { fileCount: 0, folderCount: 0, markdownFileCount: 0, totalBytes: 0, issues: [] };
  const data = summary ?? { fileCount: 0, folderCount: 0, markdownFileCount: 0, totalBytes: 0, issues: [] };
  els.metricNotes.textContent = String(data.fileCount ?? 0);
  els.metricFolders.textContent = String(data.folderCount ?? 0);
  els.metricMarkdown.textContent = String(data.markdownFileCount ?? 0);
  els.metricBytes.textContent = bytesToCompactLabel(Number(data.totalBytes ?? 0));
  els.vaultHealthPill.textContent = (data.issues?.length ?? 0) > 0 ? 'review' : 'healthy';

  const bars = document.querySelectorAll('.mini-chart span');
  const values = [data.folderCount ?? 0, data.fileCount ?? 0, data.markdownFileCount ?? 0, Math.ceil(Number(data.totalBytes ?? 0) / 1024), data.issues?.length ?? 0];
  bars.forEach((bar, index) => {
    const height = Math.max(16, Math.min(100, ((values[index] ?? 0) * 14) + 16));
    bar.style.setProperty('--bar-height', `${height}%`);
  });

  renderOverviewDashboard();
}

function renderProjectSlide() {
  if (!els.projectSlideTag || !els.projectSlideTitle || !els.projectSlideBody || !els.projectSlideDots) return;
  const slide = projectSlides[projectSlideIndex % projectSlides.length];
  els.projectSlideTag.textContent = slide.tag;
  els.projectSlideTitle.textContent = slide.title;
  els.projectSlideBody.textContent = slide.body;
  els.projectSlideDots.innerHTML = projectSlides.map((_, index) => `<span class="${index === projectSlideIndex ? 'active' : ''}"></span>`).join('');
}

function startProjectSlide() {
  if (!els.projectSlideTag || !els.projectSlideTitle || !els.projectSlideBody || !els.projectSlideDots) return;
  renderProjectSlide();
  if (projectSlideTimer) clearInterval(projectSlideTimer);
  projectSlideTimer = setInterval(() => {
    projectSlideIndex = (projectSlideIndex + 1) % projectSlides.length;
    renderProjectSlide();
  }, 4500);
}

function openInputDialog({ eyebrow, title, message, label, value = '', multiline = false }) {
  return uiShell.openInputDialog({ eyebrow, title, message, label, value, multiline });
}

function openConfirmDialog({ eyebrow, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
  return uiShell.openConfirmDialog({ eyebrow, title, message, confirmLabel, cancelLabel });
}

function applyActiveVaultRoot(vaultRoot) {
  vaultBootstrap.applyActiveVaultRoot(vaultRoot);
}

function closeMenus() {
  uiShell.closeMenus();
}

function toggleNoteOptionsMenu() {
  uiShell.toggleNoteOptionsMenu();
}

function showFolderContextMenu(relativePath, x, y) {
  uiShell.showFolderContextMenu(relativePath, x, y);
}

function syncWorkspaceState() {
  const active = Boolean(getConfiguredVaultRoot());
  const noteSelected = Boolean(state.selectedFile);
  const bootingDesktopVault = isDesktopShell && !active && !desktopBootstrapComplete;
  els.workspaceEmpty.classList.toggle('active', state.view === 'workspace' && !active);
  els.workspaceView.querySelector('.workspace-layout').classList.toggle('active', state.view === 'workspace' && active);

  if (!active) {
    if (bootingDesktopVault) {
      els.workspaceEmptyTitle.textContent = 'Carregando o vault padrao...';
      els.workspaceEmptyBody.textContent = 'A interface vai liberar a arvore, o editor e o painel auxiliar assim que o vault ativo terminar de abrir.';
      els.emptyStartVaultButton.textContent = 'Aguarde';
      els.emptyStartVaultButton.disabled = true;
    } else if (getDefaultVaultPath()) {
      els.workspaceEmptyTitle.textContent = 'Abra ou crie este vault para continuar.';
      els.workspaceEmptyBody.textContent = `O caminho atual e ${getDefaultVaultPath()}. Quando esse vault estiver ativo, o workspace volta a mostrar notas, editor e paineis.`;
      els.emptyStartVaultButton.textContent = 'Abrir ou criar vault';
      els.emptyStartVaultButton.disabled = false;
    } else {
      els.workspaceEmptyTitle.textContent = 'Inicie o vault padrao para comecar.';
      els.workspaceEmptyBody.textContent = 'A visualizacao vai permanecer limpa ate o vault padrao ser aberto. Depois disso, a arvore, a nota e o painel auxiliar aparecem aqui.';
      els.emptyStartVaultButton.textContent = 'Iniciar';
      els.emptyStartVaultButton.disabled = false;
    }
  }

  if (state.view === 'workspace' && bootingDesktopVault) {
    els.editorStatus.textContent = 'Carregando vault padrao...';
  }

  const disabled = !active;
  [
    els.sidebarNewNoteButton,
    els.newNoteButton,
    els.newFolderButton,
    els.agendaCreateButton,
    els.agendaResetButton,
    els.agendaTitleInput,
    els.agendaDueInput,
    els.agendaStatusInput,
    els.agendaBodyInput,
    els.templatesButton,
    els.dailyNoteButton,
    els.desktopSearchButton,
    els.openVaultFolderButton,
    els.summaryOverviewButton,
    els.agendaOptionsButton,
  ].forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
  });
  if (els.saveButton) {
    els.saveButton.disabled = disabled || !noteSelected;
  }
  if (els.noteOptionsButton) {
    els.noteOptionsButton.disabled = disabled || !noteSelected;
  }
  if (els.summaryGraphButton) {
    els.summaryGraphButton.disabled = disabled || !noteSelected;
  }
  els.desktopCommandsButton.disabled = false;
}

async function showBetaDataNoticeIfNeeded() {
  if (!isDesktopShell || localStorage.getItem(uiStorageKeys.betaDataNoticeAcknowledged) === 'true') return;

  const acknowledged = await openConfirmDialog({
    eyebrow: 'Beta fechada',
    title: 'Você está mexendo em arquivos de verdade',
    message: 'Este app ainda está em teste. Faça uma cópia das suas notas ou tenha um backup. Apagar e renomear aqui muda os arquivos da pasta do vault.',
    confirmLabel: 'Entendi',
    cancelLabel: 'Lembrar depois'
  });
  if (acknowledged) {
    localStorage.setItem(uiStorageKeys.betaDataNoticeAcknowledged, 'true');
  }
}

function openVaultFolder() {
  if (!isDesktopShell || typeof window.orionDesktop?.openVaultFolder !== 'function') return;
  void window.orionDesktop.openVaultFolder().catch((error) => {
    showError(error instanceof Error ? error.message : 'Não foi possível abrir a pasta do vault');
  });
}

async function startVault() {
  await vaultBootstrap.startVault();
}

async function ensureActiveVaultReady(actionLabel) {
  return vaultBootstrap.ensureActiveVaultReady(actionLabel);
}

function beginDesktopBootstrap() {
  vaultBootstrap.beginDesktopBootstrap();
}

beginDesktopBootstrap();

async function saveCurrentAsTemplate() {
  if (!state.selectedFile) return;

  await openTemplatePickerDialog();
}

async function confirmTemplateSave() {
  const templateName = els.templatePickerInput.value.trim();
  if (!templateName) return;

  const baseIndex = els.templatePickerSelect.value.trim();
  const baseTemplate = baseIndex === '' ? null : state.templates[Number(baseIndex)] ?? null;
  const templatePath = makeUniqueVaultPathForTarget(
    joinRelativePath('Templates', templateName.toLowerCase().endsWith('.md') ? templateName : `${templateName}.md`)
  );
  const content = els.templatePickerContent.value || baseTemplate?.content || els.noteEditor.value || '';
  const vaultRoot = getConfiguredVaultRoot();

  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: templatePath, content, operation: 'create' })
  });

  els.templatePickerDialog.close();
  await loadTemplates();
  await openTemplatesDialog();
}

async function togglePinSelectedNote() {
  if (!state.selectedFile) return;

  const data = await api('/api/pins', {
    method: 'POST',
    body: JSON.stringify({ path: state.selectedFile })
  });

  state.pinnedPaths = (data.pinnedPaths ?? []).map((value) => normalizeRelativePath(String(value)));
  renderPinnedList();
  updatePinButton();
}

async function openDailyNote() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) return;

  const data = await api(`/api/daily?vaultRoot=${encodeURIComponent(vaultRoot)}`);
  setView('workspace');
  recordActivity('daily', 'Nota diária aberta', String(data.path ?? ''));
  await refreshWorkspace(data.path);
}

async function saveNote({ source = 'manual' } = {}) {
  if (!state.selectedFile) return;

  const shouldRefreshEditorAssist = document.activeElement === els.noteEditorSurface;
  const editorScrollHost = els.noteEditorSurface?.closest('.editor-pane');
  const savedScrollTop = editorScrollHost instanceof HTMLElement ? editorScrollHost.scrollTop : 0;
  const savedPath = state.selectedFile;

  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    showError('Abra um vault antes de salvar notas.');
    return;
  }

  if (editorSaveState.saving) return;

  const submittedContent = normalizeEditorText(els.noteEditor.value);
  els.noteEditor.value = submittedContent;
  editorSaveState.saving = true;
  updateEditorDraftIndicator(source === 'auto' ? 'Autosave...' : 'Salvando...', 'saving');

  try {
    rememberLocalVaultWrite(savedPath);
    await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot, path: savedPath, content: submittedContent, operation: 'edit' })
    });

    const editorUnchanged = state.selectedFile === savedPath && normalizeEditorText(els.noteEditor.value) === submittedContent;

    if (editorUnchanged) {
      clearEditorDraft(savedPath);
      resetEditorHistory({ value: submittedContent, selectionStart: getEditorSelection().start, selectionEnd: getEditorSelection().end });
      resetEditorSaveState(submittedContent);
      updateEditorDraftIndicator(source === 'auto' ? 'Autosave concluido' : 'Sincronizado', 'saved');
    } else if (state.selectedFile === savedPath) {
      writeEditorDraft(savedPath, els.noteEditor.value);
      markEditorDirty();
      scheduleEditorAutoSave();
    }

    if (source === 'auto') {
      els.editorStatus.textContent = editorUnchanged
        ? `Autosave concluido em ${savedPath}.`
        : `Autosave parcial em ${savedPath}. Alteracoes novas continuam no rascunho.`;
    } else {
      els.editorStatus.textContent = editorUnchanged ? `Salvo em ${savedPath}` : `Salvo em ${savedPath}. Novas alteracoes continuam no rascunho.`;
    }
    recordActivity('save', `Salva ${fileLabel(savedPath)}`, savedPath);

    if (source !== 'auto') {
      if (savedPath.startsWith('Agenda/')) {
        await loadAgenda();
      } else {
        renderOverviewDashboard();
      }
    }

    if (shouldRefreshEditorAssist && state.selectedFile === savedPath) {
      if (editorScrollHost instanceof HTMLElement) {
        editorScrollHost.scrollTop = savedScrollTop;
      }
      updateEditorAssistMenu();
    }
  } finally {
    editorSaveState.saving = false;
  }
}

async function renameCurrentNoteFromEditor() {
  if (!state.selectedFile) return;

  const titleValue = currentEditorTitleValue().replace(/[\\/]+/g, ' ').trim();
  const fallbackTitle = fileLabel(state.selectedFile);

  if (!titleValue) {
    setEditorTitleValue(fallbackTitle, { enabled: true });
    return;
  }

  const fileName = titleValue.toLowerCase().endsWith('.md') ? titleValue : `${titleValue}.md`;
  const nextPath = joinRelativePath(pathDirectory(state.selectedFile), fileName);

  if (normalizeRelativePath(nextPath) === normalizeRelativePath(state.selectedFile)) {
    setEditorTitleValue(fileLabel(state.selectedFile), { enabled: true });
    return;
  }

  try {
    await renameCurrentNoteToPath(nextPath);
  } catch (error) {
    setEditorTitleValue(fallbackTitle, { enabled: true });
    throw error;
  }
}

async function commitEditorTitleRename() {
  if (noteTitleRenamePromise) return noteTitleRenamePromise;

  noteTitleRenamePromise = renameCurrentNoteFromEditor().finally(() => {
    noteTitleRenamePromise = null;
  });

  return noteTitleRenamePromise;
}

function getWorkspaceDeleteTarget() {
  if (state.selectedFolder) {
    return {
      kind: 'folder',
      path: normalizeRelativePath(state.selectedFolder).replace(/\/+$/g, '')
    };
  }

  if (state.selectedFile) {
    return {
      kind: 'note',
      path: normalizeRelativePath(state.selectedFile)
    };
  }

  return null;
}

async function deleteSelectedWorkspaceEntry(requestedTarget = null) {
  const target = requestedTarget ?? getWorkspaceDeleteTarget();
  if (!target) return;

  if (target.kind === 'folder' && isProtectedAgendaFolderPath(target.path)) {
    showError('A pasta Agenda e fixa e nao pode ser apagada.');
    return;
  }

  const vaultRoot = await ensureActiveVaultReady('apagar um item');
  const absoluteTargetPath = `${vaultRoot.replace(/[\\/]+$/, '')}\\${target.path.replace(/\//g, '\\')}`;
  const confirmed = await openConfirmDialog({
    eyebrow: 'Excluir',
    title: target.kind === 'folder' ? 'Apagar esta pasta?' : 'Apagar esta nota?',
    message: target.kind === 'folder'
      ? `Tudo dentro desta pasta vai ser apagado. Isso não dá para desfazer.\n\n${absoluteTargetPath}`
      : `Esta nota vai ser apagada. Isso não dá para desfazer.\n\n${absoluteTargetPath}`,
    confirmLabel: target.kind === 'folder' ? 'Apagar pasta' : 'Apagar nota'
  });
  if (!confirmed) return;

  sendDebugState('delete.before', { vaultRoot, targetKind: target.kind, targetPath: target.path });

  await api('/api/delete', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: target.path })
  });
  sendDebugState('delete.after', { vaultRoot, targetKind: target.kind, targetPath: target.path });

  const deletedAgendaContent = target.path === 'Agenda' || target.path.startsWith('Agenda/');

  if (state.selectedFile && isWithinRelativePath(target.path, state.selectedFile)) {
    state.selectedFile = '';
  }

  if (state.selectedFolder && isWithinRelativePath(target.path, state.selectedFolder)) {
    state.selectedFolder = '';
  }

  closeMenus();
  await refreshWorkspace('', false);
  if (deletedAgendaContent) {
    await loadAgenda();
  }
}

function canHandleWorkspaceDeleteShortcut(event) {
  if (event.key !== 'Delete') return false;
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
  if (state.view !== 'workspace') return false;
  if (document.querySelector('dialog[open]')) return false;

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) return true;

  return !target.closest('input, textarea, select, [contenteditable="true"]');
}

els.viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view === 'search') {
      openSearchDialog();
      return;
    }

    if (button.dataset.view === 'guide') {
      void openGuideDialog();
      return;
    }

    if (button.dataset.view === 'agenda') {
      setView('agenda');
      void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
      ensureAgendaReminderPolling();
      return;
    }

    if (button.dataset.view === 'relations') {
      void openRelationsView().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar relações'));
      return;
    }

    if (button.dataset.view === 'settings') {
      setView('setup');
      return;
    }

    if (button.dataset.view === 'workspace' && !getConfiguredVaultRoot()) {
      void startVault()
        .catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault'))
        .then(() => {
          if (!getConfiguredVaultRoot()) {
            setView('setup');
          }
        });
      return;
    }

    setView(button.dataset.view === 'setup' ? 'setup' : 'workspace');
  });
});

els.vaultPathInput.addEventListener('input', (event) => updateVault(event.target.value));
document.getElementById('sidebarNewNoteButton')?.addEventListener('click', () => {
  void createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota'));
});
els.aiModeButton?.addEventListener('click', () => {
  aiDevMode.openDialog();
});
els.aiLauncher?.addEventListener('click', onAiLauncherActivate);
els.aiLauncher?.addEventListener('pointerdown', (event) => {
  aiLauncherState.dragging = true;
  aiLauncherState.moved = false;
  aiLauncherState.startX = event.clientX;
  aiLauncherState.startY = event.clientY;
  els.aiLauncher.setPointerCapture(event.pointerId);
});
els.aiLauncher?.addEventListener('pointermove', (event) => {
  if (!aiLauncherState.dragging) return;
  const dx = event.clientX - aiLauncherState.startX;
  const dy = event.clientY - aiLauncherState.startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    aiLauncherState.moved = true;
    applyAiLauncherPosition(aiLauncherState.offsetX + dx, aiLauncherState.offsetY + dy);
  }
});
els.aiLauncher?.addEventListener('pointerup', () => {
  if (aiLauncherState.dragging && aiLauncherState.moved) {
    persistAiLauncherPosition();
    aiLauncherState.suppressClick = true;
  }
  aiLauncherState.dragging = false;
});
els.aiLauncher?.addEventListener('pointercancel', () => {
  aiLauncherState.dragging = false;
  aiLauncherState.moved = false;
  aiLauncherState.suppressClick = false;
});
els.desktopCommandsButton.addEventListener('click', () => {
  void aiDevMode.openCommandsDialog({ inline: false }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar catalogo da IA'));
});
els.dailyNoteButton.addEventListener('click', () => { openDailyNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota diária')); });
els.startVaultButton.addEventListener('click', () => { startVault().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault')); });
els.openWorkspaceButton.addEventListener('click', () => {
  if (!getConfiguredVaultRoot()) {
    void startVault().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault'));
    return;
  }

  setView('workspace');
});
els.emptyStartVaultButton.addEventListener('click', () => { startVault().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault')); });
document.querySelectorAll('[data-quick-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-quick-action');
    if (action === 'create-note') {
      void createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota'));
      return;
    }
    if (action === 'create-agenda') {
      if (!getConfiguredVaultRoot()) {
        void startVault().then(() => {
          setView('agenda');
          els.agendaTitleInput.focus();
        }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault'));
        return;
      }

      setView('agenda');
      els.agendaTitleInput.focus();
      return;
    }
    if (action === 'agenda') {
      if (!getConfiguredVaultRoot()) {
        void startVault().then(() => {
          setView('agenda');
          void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
          ensureAgendaReminderPolling();
        }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault'));
        return;
      }

      setView('agenda');
      void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
      ensureAgendaReminderPolling();
      return;
    }
    if (action === 'relations') {
      if (!getConfiguredVaultRoot()) {
        void startVault().then(() => openRelationsView()).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar vault'));
        return;
      }

      void openRelationsView().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar relações'));
      return;
    }
    if (action === 'graph') {
      void openRelationsView().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir graph'));
      return;
    }
    if (action === 'commands') {
      void aiDevMode.openCommandsDialog({ inline: false }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar catalogo da IA'));
    }
  });
});
els.newNoteButton.addEventListener('click', () => { createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota')); });
els.newFolderButton.addEventListener('click', () => { createFolder().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar pasta')); });
els.relationsDetailsButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleRelationsDetailsMenu();
});
els.relationsDetailsPanel?.addEventListener('click', (event) => {
  event.stopPropagation();
});
els.relationsRefreshButton?.addEventListener('click', () => { refreshRelationsSurface().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar relações')); });
els.relationsOpenSelectedButton?.addEventListener('click', () => {
  if (state.selectedFile) {
    closeRelationsDetailsMenu();
    void loadNote(state.selectedFile, { recordActivity: true, kind: 'open' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota'));
  }
});
els.noteOptionsButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleNoteOptionsMenu();
});
els.noteOptionsMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  closeMenus();
  if (action === 'toggle-pin') void togglePinSelectedNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao fixar nota'));
  if (action === 'save-template') void saveCurrentAsTemplate().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao salvar modelo'));
  if (action === 'rename-note') void renameNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao renomear'));
  if (action === 'link-note') void openLinkPickerDialog().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir seletor de links'));
});
els.noteTitle.addEventListener('focus', () => {
  if (!state.selectedFile || els.noteTitle.disabled) return;
  els.noteTitle.select();
});
els.noteTitle.addEventListener('keydown', (event) => {
  if (!state.selectedFile || els.noteTitle.disabled) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    els.noteTitle.blur();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    setEditorTitleValue(fileLabel(state.selectedFile), { enabled: true });
    els.noteTitle.blur();
  }
});
els.noteTitle.addEventListener('blur', () => {
  if (!state.selectedFile || els.noteTitle.disabled) return;
  void commitEditorTitleRename().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao renomear nota'));
});
els.noteEditorSurface?.addEventListener('keydown', handleEditorKeydown);
els.noteEditorSurface?.addEventListener('beforeinput', handleEditorBeforeInput);
els.noteEditorSurface?.addEventListener('paste', (event) => {
  event.preventDefault();
  const selection = getEditorSelection();
  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  replaceEditorRange(selection.start, selection.end, normalizeEditorText(pasted));
});
els.noteEditorSurface?.addEventListener('keyup', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(event.key)) {
    updateEditorCurrentLine();
    updateEditorAssistMenu();
  }
});
els.noteEditorSurface?.addEventListener('click', () => {
  updateEditorCurrentLine();
  updateEditorAssistMenu();
  updateEditorLinkTooltip();
});
els.noteEditorSurface?.addEventListener('focus', () => {
  updateEditorCurrentLine();
  updateEditorAssistMenu();
  updateEditorLinkTooltip();
});
els.noteEditorSurface?.addEventListener('blur', () => {
  setTimeout(() => {
    updateEditorLinkTooltip();
  }, 0);
});
els.editorPreviewToggle?.addEventListener('click', () => {
  setEditorPreviewExpanded(!editorPreviewState.expanded);
});
els.editorPreview?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const pathValue = target.dataset.path;
  if (pathValue) void openLinkedNoteFromPath(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota linkada'));
});
els.editorPreview?.addEventListener('pointerleave', clearEditorLinkFocus);
els.noteEditorSurface?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const pathValue = target.dataset.path;
  if (!pathValue) return;
  event.preventDefault();
  void openLinkedNoteFromPath(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota linkada'));
});
els.noteEditorSurface?.addEventListener('pointerover', (event) => {
  syncHoveredEditorLink(event.target);
});
els.noteEditorSurface?.addEventListener('pointermove', (event) => {
  syncHoveredEditorLink(event.target);
});
els.noteEditorSurface?.addEventListener('pointerout', (event) => {
  const currentTarget = event.target instanceof HTMLElement ? event.target.closest('.editor-preview-link[data-path]') : null;
  if (!(currentTarget instanceof HTMLElement)) return;
  const nextTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.editor-preview-link[data-path]') : null;
  if (nextTarget instanceof HTMLElement) return;
  clearEditorLinkFocus();
});
els.noteEditorSurface?.addEventListener('pointerleave', clearEditorLinkFocus);
editorAssist.bindEvents();
els.quickMenu.addEventListener('click', (event) => {
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  closeMenus();
  if (action === 'create-note') void createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota'));
  if (action === 'create-folder') void createFolder().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar pasta'));
  if (action === 'rename') void renameNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao renomear'));
  if (action === 'move') void moveNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao mover'));
});
document.addEventListener('click', (event) => {
  closeMenus();
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) {
    closeEditorAssistMenu();
    return;
  }

  if (target.closest('#noteEditorSurface') || target.closest('#editorAssistMenu')) {
    return;
  }

  closeEditorAssistMenu();
});
document.addEventListener('contextmenu', (event) => {
  if (!els.folderContextMenu.classList.contains('open')) return;
  if (event.target instanceof Node && !els.folderContextMenu.contains(event.target)) {
    closeMenus();
  }
});
els.saveButton.addEventListener('click', () => { saveNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao salvar nota')); });
els.railCollapseButton?.addEventListener('click', () => {
  applyRailCollapsed(!document.body.classList.contains('rail-collapsed'));
});
els.commandsDialogClose.addEventListener('click', () => aiDevMode.closeCommandsDialog());
els.commandsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  aiDevMode.closeCommandsDialog();
});
els.guideDialogClose.addEventListener('click', closeGuideDialog);
els.guideDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeGuideDialog();
});
resourceBrowser.bindEvents();
els.summaryOverviewButton.addEventListener('click', () => setSummaryMode('overview')); 
els.summaryGraphButton.addEventListener('click', () => setSummaryMode('graph'));
els.graphSvg.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-path]') : null;
  if (!(target instanceof Element)) return;
  const path = target.getAttribute('data-path');
  const kind = target.getAttribute('data-kind') || 'note';
  if (path) void openGraphNode(path, kind).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nó do grafo'));
});
els.graphSvg.addEventListener('pointerdown', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-path]')) return;
  els.graphSvg.setPointerCapture(event.pointerId);
  startGraphDrag(event.clientX, event.clientY);
});
els.graphSvg.addEventListener('pointermove', (event) => {
  moveGraphDrag(event.clientX, event.clientY);
});
els.graphSvg.addEventListener('pointerup', () => {
  stopGraphDrag();
});
els.graphSvg.addEventListener('pointerleave', () => {
  stopGraphDrag();
});
els.graphSvg.addEventListener('wheel', (event) => {
  if (state.summaryMode !== 'graph') return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  const rect = els.graphSvg.getBoundingClientRect();
  zoomGraph(delta, event.clientX - rect.left, event.clientY - rect.top);
  renderGraph(state.graph);
}, { passive: false });
els.graphSvg.addEventListener('dblclick', () => {
  resetGraphViewport();
  renderGraph(state.graph);
});
els.pinnedList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void loadNote(path, { recordActivity: true, kind: 'open' });
});
els.backlinksList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void loadNote(path, { recordActivity: true, kind: 'open' });
});
els.manualLinksList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void loadNote(path, { recordActivity: true, kind: 'open' });
});
els.relatedList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void loadNote(path, { recordActivity: true, kind: 'open' });
});
els.relationsManualLinksList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) {
    closeRelationsDetailsMenu();
    setView('workspace');
    void loadNote(path, { recordActivity: true, kind: 'open' });
  }
});
els.relationsRelatedList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) {
    closeRelationsDetailsMenu();
    setView('workspace');
    void loadNote(path, { recordActivity: true, kind: 'open' });
  }
});
els.linkSuggestionsList.addEventListener('click', (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!(button instanceof HTMLElement)) return;
  const targetPath = button.dataset.targetPath;
  const applicationMode = button.dataset.applicationMode === 'inline' ? 'inline' : 'section';

  if (button.dataset.action === 'preview-link' && targetPath) {
    void loadLinkPreview(targetPath, applicationMode).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao gerar preview'));
    return;
  }

  if (button.dataset.action === 'apply-link' && targetPath) {
    closeRelationsDetailsMenu();
    void applyPreviewLink(targetPath, applicationMode).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao aplicar link'));
    return;
  }

  if (button.dataset.action === 'apply-preview-link' && targetPath) {
    closeRelationsDetailsMenu();
    void applyPreviewLink(targetPath, applicationMode).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao aplicar preview'));
  }
});
globalGraph.bindEvents();
els.templateSelectionClear?.addEventListener('click', () => setSelectedTemplate(null));
els.templatePickerConfirm.addEventListener('click', () => { confirmTemplateSave().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao salvar modelo')); });
els.aiDialogClose.addEventListener('click', () => aiDevMode.closeDialog());
els.overviewOptionsButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleOverviewOptionsMenu();
});
function controlDesktopWindow(action) {
  if (!isDesktopShell || typeof window.orionDesktop?.controlWindow !== 'function') return;
  void window.orionDesktop.controlWindow(action).catch((error) => {
    showError(error instanceof Error ? error.message : 'Falha ao controlar janela');
  });
}
els.windowMinimizeButton?.addEventListener('click', () => controlDesktopWindow('minimize'));
els.windowMaximizeButton?.addEventListener('click', () => controlDesktopWindow('toggle-maximize'));
els.windowCloseButton?.addEventListener('click', () => controlDesktopWindow('close'));
els.openVaultFolderButton?.addEventListener('click', openVaultFolder);
els.feedbackButton?.addEventListener('click', () => {
  if (isDesktopShell && typeof window.orionDesktop?.openFeedback === 'function') {
    void window.orionDesktop.openFeedback().catch((error) => {
      showError(error instanceof Error ? error.message : 'Não foi possível abrir a página de feedback');
    });
    return;
  }
  window.location.assign('https://orionvault.onrender.com/#feedback');
});
els.desktopNotificationClose?.addEventListener('click', hideDesktopNotification);
els.desktopNotificationAction?.addEventListener('click', () => {
  hideDesktopNotification();
  setView('agenda');
  void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
});
document.addEventListener('keydown', (event) => {
  if (!canHandleWorkspaceDeleteShortcut(event)) return;
  if (!getWorkspaceDeleteTarget()) return;
  event.preventDefault();
  void deleteSelectedWorkspaceEntry().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao apagar item'));
});
els.overviewDueList?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const pathValue = target.dataset.path;
  if (pathValue) void openAgendaItem(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir prazo'));
});
els.overviewRecentList?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const pathValue = target.dataset.path;
  if (pathValue) void loadNote(pathValue, { recordActivity: true, kind: 'open' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir atividade'));
});
els.noteEditor.addEventListener('input', () => {
  renderEditorPresentation();
  if (editorPendingSelection.start !== null) {
    setEditorSurfaceSelection(editorPendingSelection.start, editorPendingSelection.end ?? editorPendingSelection.start);
    els.noteEditorSurface?.focus();
    editorPendingSelection.start = null;
    editorPendingSelection.end = null;
  }
  if (state.selectedFile && !isApplyingEditorHistory()) {
    writeEditorDraft(state.selectedFile, els.noteEditor.value);
    markEditorDirty();
    scheduleEditorAutoSave();
  }
  els.editorStatus.textContent = 'Alterações não salvas.';
  updateEditorAssistMenu();
});
document.addEventListener('selectionchange', () => {
  if (document.activeElement === els.noteEditorSurface) {
    updateEditorCurrentLine();
    updateEditorLinkTooltip();
  }
});
window.addEventListener('resize', () => {
  updateEditorLinkTooltip();
});

els.workspaceView.addEventListener('click', handleFolderSelectionBackgroundClick, true);
els.workspaceView.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  handleFolderSelectionBackgroundClick(event);
}, true);

state.recentActivity = loadRecentActivity();
els.agendaDueInput.value = formatAgendaInputValue(new Date(Date.now() + (60 * 60 * 1000)));
agendaController.initializeReminderKeys();
agendaController.bindEvents();
restoreRailCollapsedPreference();
setEditorTitleValue('Nenhuma nota', { enabled: false });
setEditorPreviewExpanded(false);
renderEditorPresentation();

updateVault(getConfiguredVaultRoot());
setView(startupView);
setDesktopReady(false);
syncWorkspaceState();
setSummaryMode('overview');
startProjectSlide();
updateVaultSummary(null);
renderOverviewDashboard();
restoreAiLauncherPosition();
void showBetaDataNoticeIfNeeded();
window.addEventListener('resize', () => {
  applyAiLauncherPosition(aiLauncherState.offsetX, aiLauncherState.offsetY);
  if (state.view === 'relations') {
    globalGraph.handleResize();
  }
});

window.addEventListener('orion-vault:agenda-saved', (event) => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (detail?.path) {
    void refreshAfterVaultChange(detail).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  }
});

if (window.orionDesktop && typeof window.orionDesktop.onAgendaSaved === 'function') {
  window.orionDesktop.onAgendaSaved((payload) => {
    if (!payload?.path) return;
    void refreshAfterVaultChange(payload).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  });
}

if (window.orionDesktop && typeof window.orionDesktop.onVaultChanged === 'function') {
  window.orionDesktop.onVaultChanged((payload) => {
    void refreshAfterVaultChange(payload).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  });
}

if (window.orionDesktop && typeof window.orionDesktop.onOpenMarkdown === 'function') {
  window.orionDesktop.onOpenMarkdown((payload) => {
    const vaultRoot = String(payload?.vaultRoot ?? '').trim();
    const filePath = normalizeRelativePath(String(payload?.path ?? ''));
    if (!vaultRoot || !filePath) return;

    void vaultBootstrap.openVaultFromBootstrap(vaultRoot, { autoOpenFirstNote: false })
      .then(() => workspaceCore.loadNote(filePath, { recordActivity: true, kind: 'open' }))
      .catch((error) => showError(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo Markdown'));
  });
}

if (window.orionDesktop && typeof window.orionDesktop.onOpenAgendaFromNotification === 'function') {
  window.orionDesktop.onOpenAgendaFromNotification(() => {
    setView('agenda');
    void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
  });
}


if (!localStorage.getItem('orion-vault-ai-popup-seen')) {
  setTimeout(() => {
    if (state.view === 'setup') {
      aiDevMode.openDialog();
      localStorage.setItem('orion-vault-ai-popup-seen', 'true');
    }
  }, 400);
}
