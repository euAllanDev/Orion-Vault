const shellMode = new URLSearchParams(window.location.search).get('shell');
const isDesktopShell = shellMode === 'desktop' || Boolean(window.marikaDesktop);
const startupView = isDesktopShell ? 'workspace' : 'setup';
const startupVaultRoot = isDesktopShell ? (new URLSearchParams(window.location.search).get('vaultRoot') ?? '').trim() : '';

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDesktopBootstrap() {
  const attempts = isDesktopShell ? 20 : 1;
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      const bootstrap = await api('/api/bootstrap');
      const vaultRoot = String(bootstrap.vaultRoot ?? '').trim();
      if (vaultRoot) return bootstrap;
      lastError = new Error('Vault padrão não configurado');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Falha ao carregar bootstrap');
    }

    if (index < attempts - 1) {
      await delay(150);
    }
  }

  throw lastError ?? new Error('Falha ao carregar bootstrap');
}

async function getDesktopBootstrapVaultRoot() {
  if (!isDesktopShell) return '';

  try {
    const bootstrap = await api('/api/bootstrap');
    return String(bootstrap.vaultRoot ?? '').trim();
  } catch {
    return '';
  }
}

async function syncDesktopActiveVaultRoot(vaultRoot) {
  const bridge = window.marikaDesktop;
  if (!isDesktopShell || !bridge || typeof bridge.setActiveVaultRoot !== 'function') return;

  await bridge.setActiveVaultRoot(vaultRoot);
}

const setupHints = {
  valid: 'A fronteira do vault está pronta para inspeção e organização.',
  invalid: 'O caminho informado não é seguro ou está fora da fronteira do vault.'
};

const uiStorageKeys = {
  railCollapsed: 'marika-rail-collapsed',
  editorDraftPrefix: 'marika-editor-draft:'
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
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
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
  aiDialogOpenTerminal: document.getElementById('aiDialogOpenTerminal'),
  aiDialogShowCommands: document.getElementById('aiDialogShowCommands'),
  aiDialogCommandsPanel: document.getElementById('aiDialogCommandsPanel'),
  aiDialogCommandsGroups: document.getElementById('aiDialogCommandsGroups'),
  aiDialogCommandsClose: document.getElementById('aiDialogCommandsClose'),
  aiDialogCommand: document.getElementById('aiDialogCommand'),
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

const desktopCommands = [
  {
    group: 'Bridge IA',
    items: [
      ['/start', 'Abre a orientacao inicial da IA para este app', '/start'],
      ['/guide', 'Abre o guia completo de comandos do app', '/guide'],
      ['/context', 'Lê o contexto estruturado do vault ativo', '/context --vault <path> [--path <note>]'],
      ['/search', 'Amplia o contexto com busca local estruturada', '/search --vault <path> --query <text>'],
      ['/plan', 'Gera plano estruturado sem escrever', '/plan --vault <path>'],
      ['/preview', 'Gera preview determinístico antes da escrita', '/preview --vault <path>'],
      ['/apply', 'Aplica somente um preview confirmado', '/apply --vault <path> --preview-id <id>']
    ]
  },
  {
    group: 'Observação',
    items: [
      ['inspect', 'Inspeciona o vault ativo', 'inspect --vault <path>'],
      ['validate', 'Valida a fronteira e a estrutura', 'validate --vault <path>'],
      ['scan', 'Escaneia entradas e pastas', 'scan --vault <path>'],
      ['context', 'Mostra o contexto do vault', 'context --vault <path>'],
      ['doctor', 'Checa saúde e configuração', 'doctor --vault <path>']
    ]
  },
  {
    group: 'Planejamento',
    items: [
      ['organize', 'Gera plano de organização', 'organize --vault <path> --dry-run'],
      ['plan', 'Mostra plano de ações', 'plan --vault <path>'],
      ['diff', 'Exibe diferenças planejadas', 'diff --vault <path>']
    ]
  },
  {
    group: 'Workspace',
    items: [
      ['mkdir', 'Cria pasta no vault', 'mkdir --vault <path> --path <folder>'],
      ['touch', 'Cria nota markdown', 'touch --vault <path> --path <file.md>'],
      ['edit', 'Edita nota existente', 'edit --vault <path> --path <file.md>'],
      ['rename', 'Renomeia arquivo ou pasta', 'rename --vault <path> --source <path> --destination <path>'],
      ['move', 'Move arquivo ou pasta', 'move --vault <path> --source <path> --destination <path>']
    ]
  },
  {
    group: 'Utilidades',
    items: [
      ['search', 'Busca por texto e tags', 'search --vault <path> --query <text>'],
      ['sync', 'Sincroniza configurações locais', 'sync']
    ]
  }
];

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
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
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

function renderInlineMarkdownPreview(text) {
  return escapeHtml(String(text ?? ''))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="editor-preview-link" data-path="$1">@$2</span>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="editor-preview-link" data-path="$1">@$1</span>');
}

function renderEditorSurface() {
  if (!els.noteEditorSurface) return;

  const html = buildEditorPresentationMarkup();
  els.noteEditorSurface.innerHTML = html || '<div class="editor-surface-line is-empty" data-line-index="0"><br></div>';
  syncEditorLinkFocus();
  updateEditorCurrentLine();
}

function buildEditorPresentationMarkup() {
  const rawContent = String(els.noteEditor.value ?? '');
  const lines = rawContent.split(/\r?\n/);
  return lines.map((line, index) => renderEditorSurfaceLine(line, index)).join('');
}

function renderEditorSurfaceLine(line, index) {
  const source = String(line ?? '');
  if (!source) {
    return `<div class="editor-surface-line is-empty" data-line-index="${index}"><br></div>`;
  }

  if (/^```/.test(source.trim())) {
    const fenceLabel = source.trim().slice(3).trim() || 'codigo';
    return `<div class="editor-surface-line code-fence" data-line-index="${index}"><span class="editor-surface-token hidden-token">\`\`\`</span><span class="editor-surface-badge code">{ }</span><span class="editor-surface-content code">Bloco de ${renderInlineMarkdownPreview(fenceLabel)}</span></div>`;
  }

  if (/^---+$/.test(source.trim())) {
    return `<div class="editor-surface-line divider" data-line-index="${index}"><span class="editor-surface-token hidden-token">---</span><span class="editor-surface-divider"></span></div>`;
  }

  const headingMatch = source.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return `<div class="editor-surface-line heading level-${level}" data-line-index="${index}"><span class="editor-surface-token hidden-token" aria-hidden="true">${escapeHtml(headingMatch[1])}</span><span class="editor-surface-token hidden-space" aria-hidden="true"> </span><span class="editor-surface-content heading-content">${renderInlineMarkdownPreview(headingMatch[2])}</span></div>`;
  }

  const checklistMatch = source.match(/^(\s*)([-*+])\s+\[( |x|X)\]\s*(.*)$/);
  if (checklistMatch) {
    const checked = String(checklistMatch[3] ?? ' ').toLowerCase() === 'x';
    return `<div class="editor-surface-line checklist" data-line-index="${index}"><span class="editor-surface-indent">${escapeHtml(checklistMatch[1] ?? '')}</span><span class="editor-surface-token hidden-token" aria-hidden="true">${escapeHtml(checklistMatch[2] ?? '-')} [${escapeHtml(checklistMatch[3] ?? ' ')}]</span><span class="editor-surface-badge">${checked ? '☑' : '☐'}</span><span class="editor-surface-content">${renderInlineMarkdownPreview(checklistMatch[4] ?? '') || '&nbsp;'}</span></div>`;
  }

  const unorderedMatch = source.match(/^(\s*)([-*+])\s+(.*)$/);
  if (unorderedMatch) {
    return `<div class="editor-surface-line list" data-line-index="${index}"><span class="editor-surface-indent">${escapeHtml(unorderedMatch[1] ?? '')}</span><span class="editor-surface-token hidden-token" aria-hidden="true">${escapeHtml(unorderedMatch[2] ?? '-')}</span><span class="editor-surface-badge">•</span><span class="editor-surface-content">${renderInlineMarkdownPreview(unorderedMatch[3] ?? '') || '&nbsp;'}</span></div>`;
  }

  const orderedMatch = source.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (orderedMatch) {
    return `<div class="editor-surface-line list ordered" data-line-index="${index}"><span class="editor-surface-indent">${escapeHtml(orderedMatch[1] ?? '')}</span><span class="editor-surface-token hidden-token" aria-hidden="true">${escapeHtml(orderedMatch[2] ?? '1')}.</span><span class="editor-surface-badge ordered">${escapeHtml(orderedMatch[2] ?? '1')}.</span><span class="editor-surface-content">${renderInlineMarkdownPreview(orderedMatch[3] ?? '') || '&nbsp;'}</span></div>`;
  }

  const quoteMatch = source.match(/^(\s*)>\s+(.*)$/);
  if (quoteMatch) {
    return `<div class="editor-surface-line quote" data-line-index="${index}"><span class="editor-surface-indent">${escapeHtml(quoteMatch[1] ?? '')}</span><span class="editor-surface-token hidden-token" aria-hidden="true">&gt;</span><span class="editor-surface-badge quote">|</span><span class="editor-surface-content">${renderInlineMarkdownPreview(quoteMatch[2] ?? '') || '&nbsp;'}</span></div>`;
  }

  return `<div class="editor-surface-line paragraph" data-line-index="${index}"><span class="editor-surface-content">${renderInlineMarkdownPreview(source) || '&nbsp;'}</span></div>`;
}

function renderEditorPresentation() {
  renderEditorPreview();
  renderEditorSurface();
}

function renderEditorPreview() {
  if (!els.editorPreview) return;

  const rawContent = String(els.noteEditor.value ?? '').trimEnd();
  if (!rawContent.trim()) {
    els.editorPreview.innerHTML = '<p class="editor-preview-empty">Comece a escrever para ver titulos, negrito, listas e links com mais contraste.</p>';
    return;
  }

  els.editorPreview.innerHTML = `<div class="editor-preview-surface" aria-hidden="true">${buildEditorPresentationMarkup()}</div>`;
}

function setEditorPreviewExpanded(expanded) {
  editorPreviewState.expanded = expanded;
  if (!els.editorPreview || !els.editorPreviewToggle) return;
  els.editorPreview.classList.toggle('hidden', !expanded);
  els.editorPreviewToggle.textContent = expanded ? 'Ocultar' : 'Mostrar';
  els.editorPreviewToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
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

function closeEditorAssistMenu() {
  editorAssistState.kind = '';
  editorAssistState.query = '';
  editorAssistState.tokenStart = 0;
  editorAssistState.tokenEnd = 0;
  editorAssistState.activeIndex = 0;
  editorAssistState.items = [];
  els.editorAssistMenu?.classList.add('hidden');
  if (els.editorAssistList) {
    els.editorAssistList.innerHTML = '';
  }
}

function renderEditorAssistMenu() {
  if (!els.editorAssistMenu || !els.editorAssistList || editorAssistState.items.length === 0) {
    closeEditorAssistMenu();
    return;
  }

  els.editorAssistLabel.textContent = editorAssistState.kind === 'mention' ? 'Mencoes' : 'Comandos';
  els.editorAssistMeta.textContent = editorAssistState.kind === 'mention' ? 'Enter para mencionar' : 'Enter para aplicar';
  els.editorAssistList.innerHTML = editorAssistState.items.map((item, index) => `
    <button class="editor-assist-item ${index === editorAssistState.activeIndex ? 'active' : ''}" type="button" data-index="${index}">
      <strong>${escapeHtml(item.label)}</strong>
      <small>${escapeHtml(item.description)}</small>
    </button>
  `).join('');
  els.editorAssistMenu.classList.remove('hidden');
}

function updateEditorAssistItems(kind, query, items, tokenStart, tokenEnd) {
  if (items.length === 0) {
    closeEditorAssistMenu();
    return;
  }

  if (editorAssistState.kind !== kind || editorAssistState.query !== query) {
    editorAssistState.activeIndex = 0;
  }

  editorAssistState.kind = kind;
  editorAssistState.query = query;
  editorAssistState.tokenStart = tokenStart;
  editorAssistState.tokenEnd = tokenEnd;
  editorAssistState.activeIndex = Math.min(editorAssistState.activeIndex, items.length - 1);
  editorAssistState.items = items;
  renderEditorAssistMenu();
}

function normalizeEditorText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\u00a0/g, '');
}

function editorDraftStorageKey(pathValue) {
  const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
  return `${uiStorageKeys.editorDraftPrefix}${normalizedPath}`;
}

function readEditorDraft(pathValue) {
  const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
  if (!normalizedPath) return '';
  try {
    return String(localStorage.getItem(editorDraftStorageKey(normalizedPath)) ?? '');
  } catch {
    return '';
  }
}

function writeEditorDraft(pathValue, content) {
  const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
  if (!normalizedPath) return;
  try {
    const value = normalizeEditorText(content);
    if (!value.trim()) {
      localStorage.removeItem(editorDraftStorageKey(normalizedPath));
      return;
    }
    localStorage.setItem(editorDraftStorageKey(normalizedPath), value);
  } catch {
    // Draft persistence is best-effort only.
  }
}

function clearEditorDraft(pathValue) {
  const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
  if (!normalizedPath) return;
  try {
    localStorage.removeItem(editorDraftStorageKey(normalizedPath));
  } catch {
    // Draft cleanup is best-effort only.
  }
}

function updateEditorDraftIndicator(label = '', mode = '') {
  if (!els.editorDraftIndicator) return;
  const text = label || 'Sincronizado';
  els.editorDraftIndicator.textContent = text;
  els.editorDraftIndicator.classList.remove('is-dirty', 'is-saving', 'is-saved');
  if (mode) {
    els.editorDraftIndicator.classList.add(`is-${mode}`);
  }
}

function clearEditorAutoSaveTimer() {
  if (!editorSaveState.autoSaveTimer) return;
  clearTimeout(editorSaveState.autoSaveTimer);
  editorSaveState.autoSaveTimer = null;
}

function markEditorDirty() {
  editorSaveState.dirty = true;
  updateEditorDraftIndicator('Rascunho local', 'dirty');
}

function resetEditorSaveState(value = '') {
  clearEditorAutoSaveTimer();
  editorSaveState.dirty = false;
  editorSaveState.saving = false;
  editorSaveState.lastSavedValue = normalizeEditorText(value);
  updateEditorDraftIndicator('Sincronizado', 'saved');
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

function snapshotEditorState() {
  const selection = getEditorSelection();
  return {
    value: String(els.noteEditor.value ?? ''),
    selectionStart: selection.start,
    selectionEnd: selection.end
  };
}

function pushEditorUndoState(snapshot) {
  const previous = editorHistoryState.undoStack.at(-1);
  if (previous && previous.value === snapshot.value && previous.selectionStart === snapshot.selectionStart && previous.selectionEnd === snapshot.selectionEnd) {
    return;
  }
  editorHistoryState.undoStack.push(snapshot);
  if (editorHistoryState.undoStack.length > editorHistoryState.limit) {
    editorHistoryState.undoStack.shift();
  }
}

function resetEditorHistory(initialSnapshot = null) {
  editorHistoryState.undoStack = initialSnapshot ? [initialSnapshot] : [];
  editorHistoryState.redoStack = [];
}

function applyEditorSnapshot(snapshot) {
  if (!snapshot) return;
  editorHistoryState.applying = true;
  try {
    els.noteEditor.value = String(snapshot.value ?? '');
    renderEditorPresentation();
    editorPendingSelection.start = Number(snapshot.selectionStart ?? 0);
    editorPendingSelection.end = Number(snapshot.selectionEnd ?? editorPendingSelection.start);
    setEditorSurfaceSelection(editorPendingSelection.start, editorPendingSelection.end);
    els.noteEditorSurface?.focus();
    editorPendingSelection.start = null;
    editorPendingSelection.end = null;
  } finally {
    editorHistoryState.applying = false;
  }
}

function undoEditorChange() {
  if (editorHistoryState.undoStack.length <= 1) return false;
  const currentSnapshot = snapshotEditorState();
  editorHistoryState.redoStack.push(currentSnapshot);
  editorHistoryState.undoStack.pop();
  applyEditorSnapshot(editorHistoryState.undoStack.at(-1));
  els.editorStatus.textContent = 'Desfeito.';
  return true;
}

function redoEditorChange() {
  const nextSnapshot = editorHistoryState.redoStack.pop();
  if (!nextSnapshot) return false;
  pushEditorUndoState(snapshotEditorState());
  applyEditorSnapshot(nextSnapshot);
  els.editorStatus.textContent = 'Refeito.';
  return true;
}

function replaceEditorRange(start, end, text, { selectionStart = null, selectionEnd = null } = {}) {
  const value = String(els.noteEditor.value ?? '');
  if (!editorHistoryState.applying) {
    pushEditorUndoState(snapshotEditorState());
    editorHistoryState.redoStack = [];
  }
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

function transformSelectedLines(transformLine) {
  const selection = getEditorSelectedLineRange();
  const lines = selection.block.split('\n');
  const nextLines = lines.map((line, index) => transformLine(line, index, lines));
  const nextBlock = nextLines.join('\n');
  replaceEditorRange(selection.rangeStart, selection.rangeEnd, nextBlock, {
    selectionStart: selection.rangeStart,
    selectionEnd: selection.rangeStart + nextBlock.length
  });
}

function splitLineIndent(line) {
  const match = String(line ?? '').match(/^(\s*)(.*)$/);
  return {
    indent: match?.[1] ?? '',
    content: match?.[2] ?? ''
  };
}

function toggleHeadingOnSelectedLines(prefix) {
  transformSelectedLines((line) => {
    if (!line.trim()) return line;
    const { indent, content } = splitLineIndent(line);
    const withoutHeading = content.replace(/^#{1,6}\s+/, '');
    if (content.startsWith(prefix)) {
      return `${indent}${withoutHeading}`;
    }
    return `${indent}${prefix}${withoutHeading}`;
  });
}

function togglePrefixOnSelectedLines(prefix) {
  const selection = getEditorSelectedLineRange();
  const lines = selection.block.split('\n').filter((line) => line.trim());
  const allHavePrefix = lines.length > 0 && lines.every((line) => splitLineIndent(line).content.startsWith(prefix));
  transformSelectedLines((line) => {
    if (!line.trim()) return line;
    const { indent, content } = splitLineIndent(line);
    return allHavePrefix && content.startsWith(prefix) ? `${indent}${content.slice(prefix.length)}` : `${indent}${prefix}${content}`;
  });
}

function toggleChecklistOnSelectedLines() {
  const selection = getEditorSelectedLineRange();
  const lines = selection.block.split('\n').filter((line) => line.trim());
  const allChecklist = lines.length > 0 && lines.every((line) => /^[-*+]\s+\[( |x|X)\]\s+/.test(line));
  transformSelectedLines((line) => {
    if (!line.trim()) return line;
    if (allChecklist && /^[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      return line.replace(/^([-*+])\s+\[( |x|X)\]\s+/, '');
    }
    if (/^[-*+]\s+/.test(line)) {
      return line.replace(/^([-*+])\s+/, '- [ ] ');
    }
    return `- [ ] ${line}`;
  });
}

function toggleListOnSelectedLines() {
  const selection = getEditorSelectedLineRange();
  const lines = selection.block.split('\n').filter((line) => line.trim());
  const allListed = lines.length > 0 && lines.every((line) => /^[-*+]\s+/.test(line) && !/^[-*+]\s+\[( |x|X)\]\s+/.test(line));
  transformSelectedLines((line) => {
    if (!line.trim()) return line;
    if (allListed && /^[-*+]\s+/.test(line)) {
      return line.replace(/^[-*+]\s+/, '');
    }
    if (/^[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      return line.replace(/^[-*+]\s+\[( |x|X)\]\s+/, '- ');
    }
    return /^[-*+]\s+/.test(line) ? line : `- ${line}`;
  });
}

function toggleCodeFenceOnSelection() {
  const { value, start, end } = getEditorSelection();
  const selectedText = value.slice(start, end);
  const lineSelection = getEditorSelectedLineRange();
  const selectedBlock = lineSelection.block;
  if (selectedBlock.startsWith('```\n') && selectedBlock.endsWith('\n```')) {
    replaceEditorRange(lineSelection.rangeStart, lineSelection.rangeEnd, selectedBlock.slice(4, -4), {
      selectionStart: lineSelection.rangeStart,
      selectionEnd: lineSelection.rangeStart + selectedBlock.length - 8
    });
    return;
  }

  if (selectedText.includes('\n') || selectedText.length === 0) {
    const content = selectedBlock || selectedText || '';
    replaceEditorRange(lineSelection.rangeStart, lineSelection.rangeEnd, `\`\`\`\n${content}\n\`\`\``, {
      selectionStart: lineSelection.rangeStart + 4,
      selectionEnd: lineSelection.rangeStart + 4 + content.length
    });
    return;
  }

  replaceEditorRange(start, end, `\`\`${selectedText}\`\``, {
    selectionStart: start + 2,
    selectionEnd: start + 2 + selectedText.length
  });
}

function getMentionCandidates(query) {
  return collectLinkCandidates(state.tree)
    .filter((item) => item.path && item.path !== state.selectedFile)
    .filter((item) => {
      if (!query) return true;
      return `${item.label} ${item.path}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((left, right) => `${left.label} ${left.path}`.localeCompare(`${right.label} ${right.path}`, 'pt-BR'))
    .slice(0, 7)
    .map((item) => ({
      type: 'mention',
      label: item.label,
      description: item.path,
      path: item.path
    }));
}

function getSlashCommandCandidates(query) {
  return editorSlashCommands
    .filter((item) => {
      if (!query) return true;
      return `${item.id} ${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    })
    .slice(0, 7)
    .map((item) => ({
      type: 'command',
      label: `/${item.id}`,
      description: item.description,
      command: item
    }));
}

function updateEditorAssistMenu() {
  if (!state.selectedFile || document.activeElement !== els.noteEditorSurface) {
    closeEditorAssistMenu();
    return;
  }

  const { start, end, lineStart, beforeCursor, value } = getCurrentEditorLine();
  if (start !== end) {
    closeEditorAssistMenu();
    return;
  }

  const slashMatch = beforeCursor.match(/^(\s*)\/([a-z0-9-]*)$/i);
  if (slashMatch) {
    const indent = slashMatch[1] ?? '';
    const query = slashMatch[2] ?? '';
    const tokenStart = lineStart + indent.length;
    updateEditorAssistItems('command', query, getSlashCommandCandidates(query), tokenStart, start);
    return;
  }

  const mentionMatch = value.slice(0, start).match(/(^|[\s([{])@([^\s@]*)$/i);
  if (mentionMatch) {
    const query = mentionMatch[2] ?? '';
    const tokenStart = start - query.length - 1;
    updateEditorAssistItems('mention', query, getMentionCandidates(query), tokenStart, start);
    return;
  }

  closeEditorAssistMenu();
}

function applyMarkdownWrap(prefix, suffix = prefix) {
  const { value, start, end } = getEditorSelection();
  const selectedText = value.slice(start, end);
  const content = selectedText || '';
  const nextText = `${prefix}${content}${suffix}`;
  const nextSelectionStart = start + prefix.length;
  const nextSelectionEnd = selectedText ? end + prefix.length : start + prefix.length;
  replaceEditorRange(start, end, nextText, { selectionStart: nextSelectionStart, selectionEnd: nextSelectionEnd });
}

function applyEditorMention(item) {
  const mentionText = `[[${item.path}|${item.label}]]\n`;
  const insertionStart = editorAssistState.tokenStart;
  replaceEditorRange(insertionStart, editorAssistState.tokenEnd, mentionText, {
    selectionStart: insertionStart + mentionText.length,
    selectionEnd: insertionStart + mentionText.length
  });
  closeEditorAssistMenu();
}

function applySlashCommand(item) {
  const command = item.command;
  const output = typeof command.insertText === 'function' ? command.insertText() : command.insertText;
  const insertionStart = editorAssistState.tokenStart;
  const cursorOffset = Number.isFinite(command.cursorOffset) ? command.cursorOffset : output.length;
  replaceEditorRange(insertionStart, editorAssistState.tokenEnd, output, {
    selectionStart: insertionStart + cursorOffset,
    selectionEnd: insertionStart + cursorOffset
  });
  closeEditorAssistMenu();
}

function applyActiveEditorAssistItem() {
  const item = editorAssistState.items[editorAssistState.activeIndex];
  if (!item) return false;
  if (item.type === 'mention') {
    applyEditorMention(item);
    return true;
  }
  if (item.type === 'command') {
    applySlashCommand(item);
    return true;
  }
  return false;
}

function moveEditorAssistSelection(step) {
  if (editorAssistState.items.length === 0) return;
  const size = editorAssistState.items.length;
  editorAssistState.activeIndex = (editorAssistState.activeIndex + step + size) % size;
  renderEditorAssistMenu();
}

function continueMarkdownList(event) {
  const line = getCurrentEditorLine();
  if (line.start !== line.end || line.start !== line.lineEnd) return false;

  const checklistMatch = line.lineText.match(/^(\s*)([-*+])\s+\[(?: |x|X)\]\s*(.*)$/);
  if (checklistMatch) {
    event.preventDefault();
    const indent = checklistMatch[1] ?? '';
    const marker = checklistMatch[2] ?? '-';
    const content = String(checklistMatch[3] ?? '').trim();
    if (!content) {
      replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
      return true;
    }
    const nextPrefix = `\n${indent}${marker} [ ] `;
    replaceEditorRange(line.start, line.end, nextPrefix);
    return true;
  }

  const unorderedMatch = line.lineText.match(/^(\s*)([-*+])\s+(.*)$/);
  if (unorderedMatch) {
    event.preventDefault();
    const indent = unorderedMatch[1] ?? '';
    const marker = unorderedMatch[2] ?? '-';
    const content = String(unorderedMatch[3] ?? '').trim();
    if (!content) {
      replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
      return true;
    }
    replaceEditorRange(line.start, line.end, `\n${indent}${marker} `);
    return true;
  }

  const orderedMatch = line.lineText.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (orderedMatch) {
    event.preventDefault();
    const indent = orderedMatch[1] ?? '';
    const order = Number(orderedMatch[2] ?? '1');
    const content = String(orderedMatch[3] ?? '').trim();
    if (!content) {
      replaceEditorRange(line.lineStart, line.lineEnd, '', { selectionStart: line.lineStart, selectionEnd: line.lineStart });
      return true;
    }
    replaceEditorRange(line.start, line.end, `\n${indent}${order + 1}. `);
    return true;
  }

  return false;
}

function indentSelectedListLines(direction) {
  const selection = getEditorSelectedLineRange();
  const lines = selection.block.split('\n');
  const singleLine = !selection.block.includes('\n');
  const hasNonListLine = lines.some((line) => line.trim() && !/^(\s*)([-*+]\s+(?:\[(?: |x|X)\]\s+)?|\d+\.\s+|>\s+)/.test(line));

  if (singleLine && hasNonListLine && selection.start === selection.end) {
    if (direction > 0) {
      replaceEditorRange(selection.start, selection.end, '  ', {
        selectionStart: selection.start + 2,
        selectionEnd: selection.start + 2
      });
      return;
    }

    const removalStart = Math.max(selection.start - 2, selection.rangeStart);
    const removable = selection.value.slice(removalStart, selection.start);
    if (removable === '  ') {
      replaceEditorRange(removalStart, selection.start, '', {
        selectionStart: removalStart,
        selectionEnd: removalStart
      });
    }
    return;
  }

  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (direction > 0) return `  ${line}`;
    return line.startsWith('  ') ? line.slice(2) : line.replace(/^\s{1,2}/, '');
  });
  const nextBlock = nextLines.join('\n');
  replaceEditorRange(selection.rangeStart, selection.rangeEnd, nextBlock, {
    selectionStart: selection.rangeStart,
    selectionEnd: selection.rangeStart + nextBlock.length
  });
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

  if (editorAssistState.items.length > 0) {
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

function closeLinkPickerDialog() {
  if (els.linkPickerDialog?.open) {
    els.linkPickerDialog.close();
  }
}

function renderLinkPickerDialog() {
  if (!els.linkPickerDialogList) return;

  const query = String(els.linkPickerDialogQuery?.value ?? '').trim().toLowerCase();
  const candidates = collectLinkCandidates(state.tree)
    .filter((item) => item.path && item.path !== state.selectedFile)
    .filter((item) => {
      if (!query) return true;
      return `${item.label} ${item.path}`.toLowerCase().includes(query);
    })
    .sort((left, right) => `${left.label} ${left.path}`.localeCompare(`${right.label} ${right.path}`, 'pt-BR'));

  els.linkPickerDialogList.innerHTML = candidates.length === 0
    ? '<div class="empty-inline">Nenhuma nota encontrada.</div>'
    : candidates.map((item) => `
      <button class="template-item" type="button" data-path="${escapeHtml(item.path)}" data-label="${escapeHtml(item.label)}">
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.path)}</small>
      </button>
    `).join('');
}

async function insertLinkToCurrentNote(targetPath, targetLabel) {
  if (!state.selectedFile) {
    showError('Abra uma nota antes de linkar outra.');
    return;
  }

  const selectedText = String(linkPickerSelection.text ?? '').trim();
  const label = selectedText || String(targetLabel ?? '').trim() || fileLabel(targetPath);
  const linkText = `[[${targetPath}|${label}]]`;
  const selection = getEditorSelection();
  const start = Number.isFinite(linkPickerSelection.start) ? linkPickerSelection.start : selection.start;
  const end = Number.isFinite(linkPickerSelection.end) ? linkPickerSelection.end : selection.end;

  replaceEditorRange(start, end, linkText);
  await saveNote();
  els.noteEditorSurface?.focus();
}

async function openLinkPickerDialog() {
  if (!getConfiguredVaultRoot()) {
    await ensureActiveVaultReady('linkar notas');
  }

  if (!state.tree) {
    await refreshWorkspace(state.selectedFile || '', false);
  }

  linkPickerSelection = {
    start: getEditorSelection().start,
    end: getEditorSelection().end,
    text: String(els.noteEditor.value ?? '').slice(getEditorSelection().start, getEditorSelection().end)
  };

  if (els.linkPickerDialogQuery) {
    els.linkPickerDialogQuery.value = '';
  }

  renderLinkPickerDialog();
  els.linkPickerDialog.showModal();
  els.linkPickerDialogQuery?.focus();
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

function formatAgendaInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseAgendaDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function agendaStatusClass(status) {
  if (status === 'done') return 'done';
  if (status === 'overdue') return 'overdue';
  return 'pending';
}

function agendaStatusLabel(status) {
  if (status === 'done') return 'Concluída';
  if (status === 'overdue') return 'Em atraso';
  return 'Pendente';
}

function agendaFilterLabel(filter) {
  if (filter === 'pending') return 'Pendentes';
  if (filter === 'done') return 'Concluídas';
  if (filter === 'overdue') return 'Em atraso';
  return 'Todos';
}

function agendaStatusKey(status) {
  return status === 'done' ? 'done' : 'pending';
}

function agendaDateLabel(value) {
  const date = parseAgendaDate(value);
  if (!date) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function agendaSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

function buildAgendaFilePath(title, dueValue) {
  const date = parseAgendaDate(dueValue) ?? new Date();
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const slug = agendaSlug(title || 'nova-nota') || 'nova-nota';
  return `Agenda/${isoDate}-${slug}.md`;
}

function buildAgendaMarkdown({ vaultRoot, title, dueValue, status, body }) {
  const safeTitle = title.trim() || 'Nota com data';
  const safeBody = body.trim();
  const lines = [
    '---',
    `vaultRoot: ${vaultRoot}`,
    `due: ${dueValue}`,
    `status: ${agendaStatusKey(status)}`,
    '---',
    `# ${safeTitle}`,
    ''
  ];

  if (safeBody) {
    lines.push(safeBody, '');
  }

  return lines.join('\n');
}

function updateAgendaMarkdownStatus(content, nextStatus) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return [
      '---',
      `status: ${agendaStatusKey(nextStatus)}`,
      '---',
      '',
      content
    ].join('\n');
  }

  const output = [...lines];
  let cursor = 1;
  let matched = false;

  for (; cursor < output.length; cursor += 1) {
    const line = output[cursor].trim();
    if (line === '---') break;

    if (/^status\s*:/i.test(line)) {
      output[cursor] = `status: ${agendaStatusKey(nextStatus)}`;
      matched = true;
      break;
    }
  }

  if (!matched) {
    output.splice(cursor, 0, `status: ${agendaStatusKey(nextStatus)}`);
  }

  return output.join('\n');
}

function agendaNotificationKey(item, windowKey) {
  return `${item.path}|${windowKey}|${item.due}`;
}

function loadAgendaReminderKeys() {
  try {
    const raw = localStorage.getItem('marika-agenda-reminders');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistAgendaReminderKeys() {
  localStorage.setItem('marika-agenda-reminders', JSON.stringify([...state.agendaReminderKeys]));
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

function agendaStoredStatus(item) {
  return item.status === 'overdue' ? 'overdue' : item.status;
}

function loadRecentActivity() {
  try {
    const raw = localStorage.getItem('marika-overview-activity');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const at = Number(item.at);
        return {
          kind: String(item.kind ?? 'other'),
          title: String(item.title ?? ''),
          path: normalizeRelativePath(String(item.path ?? '')),
          at: Number.isFinite(at) ? at : Date.now(),
          meta: item.meta && typeof item.meta === 'object' ? item.meta : {}
        };
      })
      .filter((item) => Boolean(item.title || item.path));
  } catch {
    return [];
  }
}

function persistRecentActivity() {
  localStorage.setItem('marika-overview-activity', JSON.stringify(state.recentActivity));
}

function formatRelativeTime(timestamp) {
  const safeTimestamp = Number(timestamp);
  if (!Number.isFinite(safeTimestamp)) return 'agora';

  const delta = Date.now() - safeTimestamp;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function activityIcon(kind) {
  if (kind === 'save') return 'S';
  if (kind === 'create') return 'N';
  if (kind === 'rename') return 'R';
  if (kind === 'move') return 'M';
  if (kind === 'agenda') return 'A';
  if (kind === 'daily') return 'D';
  return 'O';
}

function recordActivity(kind, title, path, meta = {}) {
  const entry = {
    kind,
    title,
    path: normalizeRelativePath(path || ''),
    at: Date.now(),
    meta
  };

  state.recentActivity = [entry, ...state.recentActivity].slice(0, 8);
  persistRecentActivity();
  renderOverviewDashboard();
}

function buildAgendaStatusData() {
  const counts = state.agendaItems.reduce((acc, item) => {
    if (item.status === 'done') acc.done += 1;
    else if (item.status === 'overdue') acc.overdue += 1;
    else acc.pending += 1;
    return acc;
  }, { pending: 0, done: 0, overdue: 0 });

  const total = counts.pending + counts.done + counts.overdue;
  return { ...counts, total };
}

function renderOverviewDashboard() {
  const summary = state.overviewSummary ?? { fileCount: 0, folderCount: 0, markdownFileCount: 0, totalBytes: 0, issues: [] };
  const agenda = [...state.agendaItems]
    .filter((item) => item.status !== 'done')
    .sort((left, right) => new Date(left.due).getTime() - new Date(right.due).getTime())
    .slice(0, 3);
  const recent = state.recentActivity
    .filter((item) => Number.isFinite(Number(item.at)))
    .slice(0, 4);
  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (6 - index));
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const count = state.recentActivity.filter((item) => {
      const at = Number(item.at);
      return Number.isFinite(at) && at >= dayStart.getTime() && at < nextDay.getTime();
    }).length;
    return count;
  });
  const peak = Math.max(1, ...activityByDay.map((value) => (Number.isFinite(value) ? value : 0)));
  const agendaData = buildAgendaStatusData();

  if (els.metricAgenda) els.metricAgenda.textContent = String(agendaData.total);
  if (els.metricOverdue) els.metricOverdue.textContent = String(agendaData.overdue);
  if (els.overviewDueCount) els.overviewDueCount.textContent = String(agenda.length);
  if (els.overviewActivityCount) els.overviewActivityCount.textContent = String(recent.length);
  if (els.overviewActivityPeak) els.overviewActivityPeak.textContent = `${peak} ação${peak === 1 ? '' : 'es'}`;
  if (els.overviewAgendaRingLabel) els.overviewAgendaRingLabel.textContent = `${agendaData.total} itens`;

  if (els.overviewDueList) {
    els.overviewDueList.innerHTML = agenda.length === 0
      ? ''
      : agenda.map((item) => `
        <button class="overview-list-item" type="button" data-path="${escapeHtml(item.path)}">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(prettyPath(item.path))}</p>
          </div>
          <span class="pill ${item.status === 'overdue' ? '' : 'subtle'}">${escapeHtml(agendaDateLabel(item.due))}</span>
        </button>
      `).join('');
  }

  if (els.overviewDueEmpty) {
    els.overviewDueEmpty.classList.toggle('hidden', agenda.length > 0);
  }

  if (els.overviewRecentList) {
    els.overviewRecentList.innerHTML = recent.length === 0
      ? ''
      : recent.map((item) => `
        <button class="recent-item" type="button" data-path="${escapeHtml(item.path)}">
          <span class="recent-icon">${escapeHtml(activityIcon(item.kind))}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(formatRelativeTime(item.at))}</p>
          </div>
        </button>
      `).join('');
  }

  if (els.overviewRecentEmpty) {
    els.overviewRecentEmpty.classList.toggle('hidden', recent.length > 0);
  }

  if (els.overviewActivityBars) {
    const bars = [...els.overviewActivityBars.querySelectorAll('span')];
    bars.forEach((bar, index) => {
      const ratio = Math.max(0, Number(activityByDay[index] ?? 0) / peak);
      const height = 18 + (Number.isFinite(ratio) ? ratio : 0) * 82;
      bar.style.setProperty('--bar-height', `${height}%`);
    });
  }

  if (els.overviewAgendaRing) {
    const pending = agendaData.pending / Math.max(1, agendaData.total) * 360;
    const overdue = agendaData.overdue / Math.max(1, agendaData.total) * 360;
    const done = agendaData.done / Math.max(1, agendaData.total) * 360;
    els.overviewAgendaRing.style.background = `conic-gradient(#c8b7ff 0deg ${pending}deg, #ff9ca6 ${pending}deg ${pending + overdue}deg, #7ee1b5 ${pending + overdue}deg ${pending + overdue + done}deg, rgba(255,255,255,0.06) ${pending + overdue + done}deg 360deg)`;
  }

  if (els.overviewAgendaLegend) {
    els.overviewAgendaLegend.innerHTML = [
      ['Pendente', agendaData.pending, 'pending'],
      ['Concluída', agendaData.done, 'done'],
      ['Em atraso', agendaData.overdue, 'overdue']
    ].map(([label, value, key]) => `
      <div class="overview-legend-item">
        <span class="overview-legend-dot ${key}"></span>
        <strong>${label}</strong>
        <small>${value}</small>
      </div>
    `).join('');
  }
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
  const nextPath = String(payload?.path ?? '');
  const bootstrapVaultRoot = isDesktopShell ? await getDesktopBootstrapVaultRoot() : '';
  const nextVaultRoot = String(payload?.vaultRoot ?? bootstrapVaultRoot ?? getConfiguredVaultRoot()).trim();
  const isAgendaNote = nextPath.startsWith('Agenda/') || payload?.kind === 'agenda';

  if (isAgendaNote) {
    await loadAgenda(nextVaultRoot);
  }

  await refreshWorkspace(state.selectedFile || '', Boolean(state.selectedFile));
  if (state.view === 'relations' || state.selectedFile) {
    await refreshRelationsSurface().catch(() => null);
  }
}

function updateVault(value) {
  const draftValue = String(value ?? '').trim();
  const activeVault = getConfiguredVaultRoot() || getDefaultVaultPath();
  const activeValid = isValidVaultPath(activeVault);

  document.body.dataset.activeVaultRoot = activeVault;

  els.vaultName.textContent = vaultNameFromPath(activeVault);
  els.vaultRootDisplay.textContent = activeVault || 'Não selecionado';
  els.vaultStateText.textContent = activeValid ? 'válido' : 'inválido';
  els.setupHint.textContent = draftValue
    ? (isValidVaultPath(draftValue) ? setupHints.valid : setupHints.invalid)
    : `O vault padrão deste app é ${activeVault || 'não selecionado'}.`;
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

function setAgendaStatus(message) {
  if (els.agendaStatusMessage) {
    els.agendaStatusMessage.textContent = message;
  }
}

function hideDesktopNotification() {
  if (state.desktopNotificationTimer) {
    clearTimeout(state.desktopNotificationTimer);
    state.desktopNotificationTimer = null;
  }

  if (!els.desktopNotification) return;
  els.desktopNotification.classList.remove('visible');
  els.desktopNotification.setAttribute('aria-hidden', 'true');
}

function showDesktopNotification({ title, body, timeLabel = 'agora', actionLabel = 'Abrir agenda' }) {
  if (!isDesktopShell || !els.desktopNotification) return;

  els.desktopNotificationTitle.textContent = String(title ?? 'Marika');
  els.desktopNotificationText.textContent = String(body ?? '');
  els.desktopNotificationTime.textContent = String(timeLabel ?? 'agora');
  els.desktopNotificationAction.textContent = String(actionLabel ?? 'Ver agenda');
  els.desktopNotification.classList.add('visible');
  els.desktopNotification.setAttribute('aria-hidden', 'false');

  if (state.desktopNotificationTimer) {
    clearTimeout(state.desktopNotificationTimer);
  }

  state.desktopNotificationTimer = setTimeout(() => {
    hideDesktopNotification();
  }, 6500);
}

function closeAiDialog() {
  els.aiDialog.classList.add('hidden');
  els.aiDialog.setAttribute('aria-hidden', 'true');
  els.aiDialogCommandsPanel.classList.add('hidden');
  document.body.classList.remove('ai-dialog-open');
}

function closeGuideDialog() {
  els.guideDialog.close();
}

async function openGuideDialog() {
  els.guideDialogStatus.textContent = 'Carregando guia local...';
  els.guideDialogContent.textContent = '';
  els.guideDialog.showModal();

  try {
    const data = await api('/api/guide');
    els.guideDialogStatus.textContent = `Arquivo: ${data.path ?? 'comandos.md'}`;
    els.guideDialogContent.textContent = String(data.content ?? '');
  } catch (error) {
    els.guideDialogStatus.textContent = 'Não foi possível carregar comandos.md.';
    els.guideDialogContent.textContent = error instanceof Error ? error.message : 'Falha ao carregar guia';
  }
}

function openAiDialog() {
  const vault = getActiveVaultPath();
  if (!vault) {
    els.aiDialogStatus.textContent = 'Abra ou crie um vault antes de usar a IA.';
    els.aiDialog.classList.remove('hidden');
    els.aiDialog.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ai-dialog-open');
    return;
  }

  localStorage.setItem('marika-ai-popup-seen', 'true');
  closeAiDialog();
  els.aiDialogCommand.textContent = [
    'marika /start',
    'marika /guide',
    'marika /context',
    'marika /search --query "arquitetura local"',
    'marika /plan',
    'marika /preview',
    'marika /apply --preview-id <id>'
  ].join('\n');
  els.aiDialogStatus.textContent = 'Comece por marika /start, depois marika /guide, e confirme o previewId antes de usar marika /apply.';
  els.aiDialog.classList.remove('hidden');
  els.aiDialog.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ai-dialog-open');
}

function getActiveVaultPath() {
  return state.vaultPath || state.defaultVaultPath || '';
}

function getConfiguredVaultRoot() {
  return state.vaultPath || state.defaultVaultPath || '';
}

async function openAiTerminal() {
  const vaultRoot = getActiveVaultPath();
  if (!vaultRoot) {
    throw new Error('Abra ou crie um vault antes de iniciar o terminal da IA');
  }

  const bridge = window.marikaDesktop;
  if (!bridge || typeof bridge.openAiTerminal !== 'function') {
    throw new Error('Bridge do desktop indisponível');
  }

  els.aiDialogStatus.textContent = `Abrindo terminal da IA no vault ${vaultRoot}...`;
  await bridge.openAiTerminal(vaultRoot);
  els.aiDialogStatus.textContent = `Terminal aberto no vault ativo ${vaultRoot}.`;
  els.setupHint.textContent = `Terminal da IA aberto no vault ativo ${vaultRoot}. Comece por marika /start, depois marika /guide, marika /context, marika /search, marika /plan, marika /preview e marika /apply --preview-id <id>.`;
}

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
  const saved = localStorage.getItem('marika-ai-launcher-position');
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

  openAiDialog();
}

function persistAiLauncherPosition() {
  localStorage.setItem('marika-ai-launcher-position', JSON.stringify({ left: aiLauncherState.offsetX, top: aiLauncherState.offsetY }));
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
    ? '<div class="empty-inline">Sem backlinks.</div>'
    : state.backlinks.map((item) => `
      <button class="backlink-item" type="button" data-path="${escapeHtml(item.path)}">
        <span>${escapeHtml(item.title || getNoteNameFromPath(item.path))}</span>
        <small>${escapeHtml(prettyPath(item.path))}</small>
      </button>
    `).join('');
}

function renderLinkList(container, items, emptyLabel, kind = 'note-link-item') {
  if (!container) return;
  container.innerHTML = items.length === 0
    ? `<div class="empty-inline">${escapeHtml(emptyLabel)}</div>`
    : items.map((item) => `
      <button class="${kind}" type="button" data-path="${escapeHtml(item.path)}"${item.targetPath ? ` data-target-path="${escapeHtml(item.targetPath)}"` : ''}${item.applicationMode ? ` data-application-mode="${escapeHtml(item.applicationMode)}"` : ''}>
        <strong>${escapeHtml(item.title || fileLabel(item.path || item.targetPath || ''))}</strong>
        <small>${escapeHtml(item.path || item.targetPath || '')}</small>
        ${item.score !== undefined ? `<small>${escapeHtml(`${Number(item.score).toFixed(3)}${item.intensity ? ` · ${item.intensity}` : ''}`)}</small>` : ''}
      </button>
    `).join('');
}

function renderRelatedPanels() {
  renderLinkList(els.manualLinksList, (state.related.manualLinks ?? []).map((item) => ({
    path: item.targetPath || '',
    title: item.label,
    targetPath: item.targetPath
  })).filter((item) => item.path), 'Sem links manuais.');

  renderLinkList(els.relatedList, (state.related.related ?? []).map((item) => ({
    path: item.path,
    title: item.title,
    score: item.score,
    intensity: item.intensity
  })), 'Sem relações inferidas.');

  renderLinkList(els.relationsManualLinksList, (state.related.manualLinks ?? []).map((item) => ({
    path: item.targetPath || '',
    title: item.label,
    targetPath: item.targetPath
  })).filter((item) => item.path), 'Sem links manuais.', 'note-link-item');

  renderLinkList(els.relationsRelatedList, (state.related.related ?? []).map((item) => ({
    path: item.path,
    title: item.title,
    score: item.score,
    intensity: item.intensity
  })), 'Sem relações inferidas.', 'relation-item');

  if (els.relationsNoteTitle) {
    els.relationsNoteTitle.textContent = state.selectedFile ? fileLabel(state.selectedFile) : 'Nenhuma nota';
  }
  if (els.relationsNoteSummary) {
    const current = state.related.related?.[0] ?? null;
    els.relationsNoteSummary.textContent = state.selectedFile
      ? (current ? current.reasons.join(' · ') : 'Sem relações inferidas acima do limiar.')
      : 'Selecione uma nota para ver os relacionamentos.';
  }
  if (els.relationsNoteScore) {
    els.relationsNoteScore.textContent = state.related.related?.[0] ? state.related.related[0].score.toFixed(3) : '0.000';
  }
}

function renderLinkSuggestions() {
  if (!els.linkSuggestionsList) return;
  els.linkSuggestionsList.innerHTML = (state.linkSuggestions ?? []).length === 0
    ? '<div class="empty-inline">Nenhuma sugestão disponível.</div>'
    : state.linkSuggestions.map((item) => `
      <article class="suggestion-item" data-path="${escapeHtml(item.targetPath)}" data-application-mode="${escapeHtml(item.applicationMode)}">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.targetPath)} · ${escapeHtml(item.score.toFixed(3))} · ${escapeHtml(item.intensity)}</small>
        <small>${escapeHtml(item.reasons.join(' · '))}</small>
        <div class="link-preview-actions">
          <button class="action" type="button" data-action="preview-link" data-target-path="${escapeHtml(item.targetPath)}" data-application-mode="${escapeHtml(item.applicationMode)}">Preview</button>
          <button class="action primary" type="button" data-action="apply-link" data-target-path="${escapeHtml(item.targetPath)}" data-application-mode="${escapeHtml(item.applicationMode)}">Aplicar</button>
        </div>
      </article>
    `).join('');
}

function renderLinkPreview() {
  if (!els.linkPreviewPanel) return;
  const preview = state.linkPreview;
  if (!preview) {
    els.linkPreviewPanel.innerHTML = '<div class="empty-inline">Escolha uma sugestão para ver o preview.</div>';
    return;
  }

  els.linkPreviewPanel.innerHTML = `
    <div class="empty-inline">
      <strong>${escapeHtml(preview.title)}</strong><br />
      <small>${escapeHtml(preview.reason)}</small>
    </div>
    <div class="link-preview-actions">
      <span class="pill subtle">${escapeHtml(preview.applicationMode)}</span>
      <span class="pill subtle">${escapeHtml(preview.targetPath)}</span>
    </div>
    <pre><strong>Antes</strong>\n${escapeHtml(preview.diff.before.join('\n'))}\n\n<strong>Depois</strong>\n${escapeHtml(preview.diff.after.join('\n'))}</pre>
    <div class="link-preview-actions">
      <button class="action primary" type="button" data-action="apply-preview-link" data-target-path="${escapeHtml(preview.targetPath)}" data-application-mode="${escapeHtml(preview.applicationMode)}">Aplicar preview</button>
    </div>
  `;
}

function renderAgendaList() {
  els.agendaOptionsLabel.textContent = agendaFilterLabel(state.agendaFilter);
  const items = state.agendaItems.filter((item) => {
    if (state.agendaFilter === 'all') return true;
    if (state.agendaFilter === 'overdue') return item.status === 'overdue';
    return agendaStoredStatus(item) === state.agendaFilter;
  });

  const counts = state.agendaItems.reduce((acc, item) => {
    acc.total += 1;
    if (item.status === 'done') acc.done += 1;
    else if (item.status === 'overdue') acc.overdue += 1;
    else acc.pending += 1;
    return acc;
  }, { total: 0, pending: 0, done: 0, overdue: 0 });

  els.agendaCount.textContent = `${counts.total} itens`;
  els.agendaPendingCount.textContent = `${counts.pending} pendentes`;
  els.agendaDoneCount.textContent = `${counts.done} concluídas`;
  els.agendaOverdueCount.textContent = `${counts.overdue} em atraso`;

  els.agendaEmpty.classList.toggle('hidden', items.length > 0);
  els.agendaList.innerHTML = items.length === 0
    ? ''
    : items.map((item) => `
      <article class="agenda-item" data-path="${escapeHtml(item.path)}">
        <div class="agenda-item-head">
          <div>
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(prettyPath(item.path))}</p>
          </div>
          <span class="pill agenda-status ${agendaStatusClass(item.status)}">${agendaStatusLabel(item.status)}</span>
        </div>
        <div class="agenda-item-meta">
          <span class="pill subtle">${escapeHtml(agendaDateLabel(item.due))}</span>
          <span class="pill subtle">${item.isAgendaFolder ? 'Agenda/' : 'meta'}</span>
        </div>
        ${item.excerpt ? `<p>${escapeHtml(item.excerpt)}</p>` : ''}
        <div class="agenda-item-actions">
          <button class="action" type="button" data-action="open">Abrir</button>
          <button class="action" type="button" data-action="toggle">${item.status === 'done' ? 'Reabrir' : 'Concluir'}</button>
        </div>
      </article>
    `).join('');
}

async function notifyAgendaItem(item, windowKey, title, body) {
  const bridge = window.marikaDesktop;
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

async function loadAgenda(vaultRoot = '') {
  const fallbackVaultRoot = isDesktopShell ? await getDesktopBootstrapVaultRoot() : getConfiguredVaultRoot();
  const resolvedVaultRoot = String(vaultRoot ?? '').trim();
  const vaultRootValue = resolvedVaultRoot || fallbackVaultRoot || getConfiguredVaultRoot();
  if (!vaultRootValue) {
    state.agendaItems = [];
    renderAgendaList();
    renderOverviewDashboard();
    return;
  }

  const data = await api(`/api/agenda?vaultRoot=${encodeURIComponent(vaultRootValue)}`);
  state.agendaItems = data.items ?? [];
  renderAgendaList();
  renderOverviewDashboard();
  if (!isDesktopShell) {
    await checkAgendaReminders(state.agendaItems);
  }
}

function ensureAgendaReminderPolling() {
  if (isDesktopShell || state.agendaReminderTimer) return;

  state.agendaReminderTimer = setInterval(() => {
    if (!getConfiguredVaultRoot()) return;
    void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar agenda'));
  }, 60_000);
}

function closeAgendaOptionsMenu() {
  els.agendaOptionsButton?.setAttribute('aria-expanded', 'false');
  els.agendaOptionsPanel?.classList.add('is-closed');
  els.agendaOptionsPanel?.setAttribute('aria-hidden', 'true');
}

function closeOverviewOptionsMenu() {
  els.overviewOptionsButton?.setAttribute('aria-expanded', 'false');
  els.overviewOptionsPanel?.classList.add('is-closed');
  els.overviewOptionsPanel?.setAttribute('aria-hidden', 'true');
}

function closeRelationsDetailsMenu() {
  els.relationsDetailsButton?.setAttribute('aria-expanded', 'false');
  els.relationsDetailsPanel?.classList.add('is-closed');
  els.relationsDetailsPanel?.setAttribute('aria-hidden', 'true');
}

function openAgendaOptionsMenu() {
  els.agendaOptionsButton?.setAttribute('aria-expanded', 'true');
  els.agendaOptionsPanel?.classList.remove('is-closed');
  els.agendaOptionsPanel?.setAttribute('aria-hidden', 'false');
}

function openOverviewOptionsMenu() {
  els.overviewOptionsButton?.setAttribute('aria-expanded', 'true');
  els.overviewOptionsPanel?.classList.remove('is-closed');
  els.overviewOptionsPanel?.setAttribute('aria-hidden', 'false');
}

function openRelationsDetailsMenu() {
  els.relationsDetailsButton?.setAttribute('aria-expanded', 'true');
  els.relationsDetailsPanel?.classList.remove('is-closed');
  els.relationsDetailsPanel?.setAttribute('aria-hidden', 'false');
}

function toggleAgendaOptionsMenu() {
  if (els.agendaOptionsPanel?.classList.contains('is-closed')) {
    openAgendaOptionsMenu();
  } else {
    closeAgendaOptionsMenu();
  }
}

function toggleOverviewOptionsMenu() {
  if (els.overviewOptionsPanel?.classList.contains('is-closed')) {
    openOverviewOptionsMenu();
  } else {
    closeOverviewOptionsMenu();
  }
}

function toggleRelationsDetailsMenu() {
  if (els.relationsDetailsPanel?.classList.contains('is-closed')) {
    openRelationsDetailsMenu();
  } else {
    closeRelationsDetailsMenu();
  }
}

async function createAgendaNote() {
  const title = els.agendaTitleInput.value.trim() || 'Nova nota';
  const dueValue = els.agendaDueInput.value.trim();
  const status = els.agendaStatusInput.value === 'done' ? 'done' : 'pending';
  const body = els.agendaBodyInput.value.trim();

  if (!dueValue) {
    showError('Informe o prazo para criar a nota da agenda.');
    return;
  }

  const vaultRoot = (await getDesktopBootstrapVaultRoot()) || await ensureActiveVaultReady('criar notas com prazo');
  await syncDesktopActiveVaultRoot(vaultRoot);

  setAgendaStatus('Salvando nota com data...');
  const filePath = makeUniqueVaultPathForTarget(buildAgendaFilePath(title, dueValue));
  const content = buildAgendaMarkdown({ vaultRoot, title, dueValue, status, body });

  sendDebugState('createAgenda.before', { vaultRoot, path: filePath });

  state.agendaReminderKeys = new Set([...state.agendaReminderKeys].filter((key) => !key.startsWith(`${filePath}|`)));
  persistAgendaReminderKeys();

  const bridge = window.marikaDesktop;
  if (bridge && typeof bridge.createAgendaNote === 'function') {
    await bridge.createAgendaNote({ vaultRoot, path: filePath, content });
  } else {
    await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot, path: filePath, content, operation: 'create' })
    });
  }

  sendDebugState('createAgenda.after', { vaultRoot, path: filePath });

  recordActivity('agenda', `Criada ${fileLabel(filePath)}`, filePath);

  els.agendaTitleInput.value = '';
  els.agendaBodyInput.value = '';
  els.agendaStatusInput.value = 'pending';
  els.agendaDueInput.value = formatAgendaInputValue(new Date(Date.now() + (60 * 60 * 1000)));

  setView('agenda');
  try {
    await refreshAfterVaultChange({ path: filePath, kind: 'agenda' });
    setAgendaStatus(`Salvo em ${filePath}`);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Falha ao atualizar agenda');
  }
}

async function toggleAgendaItemStatus(pathValue, currentStatus) {
  const vaultRoot = (await getDesktopBootstrapVaultRoot()) || getConfiguredVaultRoot();
  if (!vaultRoot) return;

  await syncDesktopActiveVaultRoot(vaultRoot);

  const data = await api(`/api/file?vaultRoot=${encodeURIComponent(vaultRoot)}&path=${encodeURIComponent(pathValue)}`);
  const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
  const content = updateAgendaMarkdownStatus(String(data.content ?? ''), nextStatus);

  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: pathValue, content, operation: 'edit' })
  });

  if (nextStatus === 'pending') {
    state.agendaReminderKeys = new Set([...state.agendaReminderKeys].filter((key) => !key.startsWith(`${pathValue}|`)));
    persistAgendaReminderKeys();
  }

  if (state.view === 'workspace' && state.selectedFile === pathValue) {
    await loadNote(pathValue);
  }
  recordActivity('agenda', `${nextStatus === 'done' ? 'Concluída' : 'Reaberta'} ${fileLabel(pathValue)}`, pathValue);
  await loadAgenda(vaultRoot);
}

async function openAgendaItem(pathValue) {
  setView('workspace');
  await loadNote(pathValue, { recordActivity: true, kind: 'agenda' });
}

function setSummaryMode(mode) {
  state.summaryMode = mode;
  els.summaryOverviewButton.classList.toggle('active', mode === 'overview');
  els.summaryGraphButton.classList.toggle('active', mode === 'graph');
  els.summaryOverview.classList.toggle('hidden', mode !== 'overview');
  els.graphPanel.classList.toggle('hidden', mode !== 'graph');
  if (mode === 'graph') {
    resetGraphViewport();
    renderGraph(state.graph);
  }
}

function renderGraph(graph) {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  els.graphCount.textContent = `${nodes.length} nós`;

  if (nodes.length === 0) {
    els.graphSvg.innerHTML = '<text x="180" y="180" text-anchor="middle" class="graph-node-label">Sem conexões</text>';
    return;
  }

  const center = { x: 180, y: 180 };
  const current = nodes.find((node) => node.kind === 'current') ?? nodes[0];
  const positions = new Map([[current.id, center]]);

  const sortNodes = (items) => [...items].sort((left, right) => {
    if (left.kind === right.kind) {
      return left.label.localeCompare(right.label, 'pt-BR');
    }

    if (left.kind === 'folder') return -1;
    if (right.kind === 'folder') return 1;
    if (left.kind === 'current') return -1;
    if (right.kind === 'current') return 1;
    return left.label.localeCompare(right.label, 'pt-BR');
  });

  const placeRing = (items, radius, offset = 0) => {
    const arranged = sortNodes(items);
    arranged.forEach((node, index) => {
      const angle = (index / Math.max(1, arranged.length)) * Math.PI * 2 - Math.PI / 2 + offset;
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    });
  };

  const folders = nodes.filter((node) => node.id !== current.id && node.kind === 'folder');
  const linkedNotes = nodes.filter((node) => node.id !== current.id && node.kind !== 'folder');

  if (graph.scope === 'folder') {
    placeRing(folders, 92, 0.15);
    placeRing(linkedNotes, 150, -0.1);
  } else {
    const folderChain = folders.filter((node) => String(node.path ?? '').includes('/'));
    const siblingFolders = folders.filter((node) => !String(node.path ?? '').includes('/'));
    placeRing(folderChain.length > 0 ? folderChain : siblingFolders, 92, 0.12);
    placeRing(linkedNotes, 150, -0.12);
  }

  const lines = edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return '';
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = from.x + dx / 2;
    const midY = from.y + dy / 2;
    const curve = 0.22;
    const c1x = from.x + dx * curve;
    const c1y = from.y + dy * curve - 18;
    const c2x = from.x + dx * (1 - curve);
    const c2y = from.y + dy * (1 - curve) + 18;
    return `<path d="M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}" class="graph-edge" />`;
  }).join('');

  const nodesMarkup = nodes.map((node) => {
    const position = positions.get(node.id) ?? center;
    const isCurrent = node.kind === 'current';
    const kind = node.kind === 'folder' || (graph.scope === 'folder' && node.kind === 'current') ? 'folder' : 'note';
    return `
      <g class="graph-node" data-path="${escapeHtml(node.path)}" data-kind="${kind}" data-current="${isCurrent ? 'true' : 'false'}" transform="translate(${position.x}, ${position.y})">
        <circle r="${isCurrent ? 28 : 18}" class="${isCurrent ? 'graph-node-current' : 'graph-node-linked'}" />
        <text y="${isCurrent ? 42 : 30}" text-anchor="middle" class="graph-node-label">${escapeHtml(node.label)}</text>
      </g>
    `;
  }).join('');

  els.graphSvg.innerHTML = `
    <defs>
      <filter id="graphGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <g class="graph-stage" transform="translate(${graphViewport.x} ${graphViewport.y}) scale(${graphViewport.scale})">
      <g>${lines}</g>
      <g>${nodesMarkup}</g>
    </g>
  `;
}

function resetGraphViewport() {
  graphViewport.scale = 1;
  graphViewport.x = 0;
  graphViewport.y = 0;
}

function zoomGraph(delta, originX = 180, originY = 180) {
  const nextScale = Math.min(2.4, Math.max(0.6, graphViewport.scale + delta));
  const ratio = nextScale / graphViewport.scale;
  graphViewport.x = originX - ((originX - graphViewport.x) * ratio);
  graphViewport.y = originY - ((originY - graphViewport.y) * ratio);
  graphViewport.scale = nextScale;
}

function startGraphDrag(clientX, clientY) {
  graphViewport.dragging = true;
  graphViewport.lastX = clientX;
  graphViewport.lastY = clientY;
}

function moveGraphDrag(clientX, clientY) {
  if (!graphViewport.dragging) return;
  graphViewport.x += clientX - graphViewport.lastX;
  graphViewport.y += clientY - graphViewport.lastY;
  graphViewport.lastX = clientX;
  graphViewport.lastY = clientY;
  renderGraph(state.graph);
}

function stopGraphDrag() {
  graphViewport.dragging = false;
}

async function openGraphNode(relativePath, kind) {
  if (!relativePath) return;

  if (kind === 'folder') {
    state.graphContext = { kind: 'folder', path: normalizeRelativePath(relativePath) };
    state.selectedFolder = normalizeRelativePath(relativePath);
    state.selectedFile = '';
    setView('workspace');
    syncWorkspaceState();
    selectFolder(relativePath, 'folder');
    await refreshGraph();
    return;
  }

  await loadNote(relativePath, { recordActivity: true, kind: 'open' });
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

async function loadRelatedData() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot || !state.selectedFile) {
    state.related = { manualLinks: [], backlinks: [], related: [] };
    state.backlinks = [];
    state.linkPreview = null;
    renderBacklinksList();
    renderRelatedPanels();
    return;
  }

  const params = new URLSearchParams({ vaultRoot, path: state.selectedFile, limit: '10' });
  const data = await api(`/api/related?${params.toString()}`);
  state.related = {
    manualLinks: data.manualLinks ?? [],
    backlinks: data.backlinks ?? [],
    related: data.related ?? []
  };
  state.backlinks = (data.backlinks ?? []).map((item) => ({
    path: item.targetPath || item.path || '',
    title: item.label || item.title || item.targetPath || item.path || ''
  })).filter((item) => Boolean(item.path));
  renderBacklinksList();
  renderRelatedPanels();
}

async function loadLinkSuggestions() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot || !state.selectedFile) {
    state.linkSuggestions = [];
    state.linkPreview = null;
    renderLinkSuggestions();
    renderLinkPreview();
    return;
  }

  const params = new URLSearchParams({ vaultRoot, path: state.selectedFile, limit: '8' });
  const data = await api(`/api/link-suggestions?${params.toString()}`);
  state.linkSuggestions = data.suggestions ?? [];
  renderLinkSuggestions();
}

async function loadLinkPreview(targetPath, applicationMode = 'section') {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot || !state.selectedFile || !targetPath) return;

  const data = await api('/api/link-preview', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: state.selectedFile, targetPath, mode: applicationMode })
  });

  state.linkPreview = data;
  renderLinkPreview();
}

async function applyPreviewLink(targetPath, applicationMode = 'section') {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot || !state.selectedFile || !targetPath) return;

  await api('/api/link-apply', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: state.selectedFile, targetPath, mode: applicationMode })
  });

  state.linkPreview = null;
  await refreshAfterVaultChange({ path: state.selectedFile });
  await loadRelatedData();
  await loadLinkSuggestions();
}

async function refreshGraph() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    state.graph = { scope: 'note', nodes: [], edges: [] };
    renderGraph(state.graph);
    return;
  }

  const params = new URLSearchParams({ vaultRoot });
  if (state.graphContext.kind === 'folder') {
    params.set('folderPath', state.graphContext.path);
  } else if (state.selectedFile) {
    params.set('path', state.selectedFile);
  } else if (state.selectedFolder) {
    params.set('folderPath', state.selectedFolder);
  }

  if (!params.has('path') && !params.has('folderPath')) {
    state.graph = { scope: 'note', nodes: [], edges: [] };
    renderGraph(state.graph);
    return;
  }

  const data = await api(`/api/graph?${params.toString()}`);
  state.graph = data;
  renderGraph(state.graph);
}

function normalizeGraphGlobalNodes(graph) {
  const nodes = [...(graph?.nodes ?? [])];
  return nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      if (left.kind === 'folder') return -1;
      if (right.kind === 'folder') return 1;
      return left.label.localeCompare(right.label, 'pt-BR');
    }

    if (left.kind === 'note') {
      return right.score - left.score || left.label.localeCompare(right.label, 'pt-BR');
    }

    return left.label.localeCompare(right.label, 'pt-BR');
  });
}

function graphGlobalClusterKeyForNode(node) {
  const source = node.kind === 'folder' ? node.path : (node.folderPath || node.path);
  const normalized = normalizeRelativePath(source);
  const [first = ''] = normalized.split('/').filter(Boolean);
  return first;
}

function hashGraphPath(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function graphGlobalClusterLabel(key) {
  return key ? fileLabel(key) : 'Raiz';
}

function graphGlobalPalette(index) {
  const palettes = [
    {
      blob: 'rgba(109, 40, 217, 0.14)',
      stroke: 'rgba(167, 139, 250, 0.28)',
      glow: 'rgba(167, 139, 250, 0.38)',
      node: 'rgba(216, 180, 254, 0.96)',
      nodeStrong: 'rgba(250, 245, 255, 0.98)',
      folder: 'rgba(196, 181, 253, 0.74)'
    },
    {
      blob: 'rgba(30, 64, 175, 0.14)',
      stroke: 'rgba(96, 165, 250, 0.26)',
      glow: 'rgba(96, 165, 250, 0.34)',
      node: 'rgba(147, 197, 253, 0.95)',
      nodeStrong: 'rgba(239, 246, 255, 0.98)',
      folder: 'rgba(148, 163, 184, 0.76)'
    },
    {
      blob: 'rgba(88, 28, 135, 0.16)',
      stroke: 'rgba(232, 121, 249, 0.22)',
      glow: 'rgba(216, 180, 254, 0.32)',
      node: 'rgba(233, 213, 255, 0.94)',
      nodeStrong: 'rgba(250, 245, 255, 0.98)',
      folder: 'rgba(192, 132, 252, 0.72)'
    },
    {
      blob: 'rgba(14, 116, 144, 0.14)',
      stroke: 'rgba(103, 232, 249, 0.22)',
      glow: 'rgba(125, 211, 252, 0.28)',
      node: 'rgba(165, 243, 252, 0.92)',
      nodeStrong: 'rgba(236, 254, 255, 0.98)',
      folder: 'rgba(148, 163, 184, 0.7)'
    },
    {
      blob: 'rgba(91, 33, 182, 0.16)',
      stroke: 'rgba(196, 181, 253, 0.26)',
      glow: 'rgba(192, 132, 252, 0.34)',
      node: 'rgba(221, 214, 254, 0.96)',
      nodeStrong: 'rgba(255, 255, 255, 0.98)',
      folder: 'rgba(196, 181, 253, 0.74)'
    }
  ];

  return palettes[index % palettes.length];
}

function graphGlobalBlobPath(cx, cy, rx, ry, seed) {
  const points = [];
  const steps = 18;
  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const wobble = 1 + (Math.sin((index * 1.7) + seed) * 0.07) + (Math.cos((index * 2.4) + seed) * 0.055);
    points.push([cx + (Math.cos(angle) * rx * wobble), cy + (Math.sin(angle) * ry * wobble)]);
  }

  let pathValue = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const middleX = (current[0] + next[0]) / 2;
    const middleY = (current[1] + next[1]) / 2;
    pathValue += ` Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${middleX.toFixed(2)} ${middleY.toFixed(2)}`;
  }

  return `${pathValue} Z`;
}

function buildGlobalGraphSlots(count, width, height) {
  if (count <= 0) return [];
  if (count === 1) return [{ x: width / 2, y: height / 2 }];

  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = Math.max(220, width * 0.31);
  const radiusY = Math.max(170, height * 0.25);
  const includeCenter = count >= 5 && count % 2 === 1;
  const ringCount = includeCenter ? count - 1 : count;
  const slots = [];

  for (let index = 0; index < ringCount; index += 1) {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / ringCount);
    slots.push({
      x: centerX + (Math.cos(angle) * radiusX),
      y: centerY + (Math.sin(angle) * radiusY)
    });
  }

  if (includeCenter) {
    slots.splice(Math.floor(slots.length / 2), 0, { x: centerX, y: centerY + (height * 0.12) });
  }

  return slots;
}

function buildGlobalGraphStars(width, height) {
  const stars = [];
  for (let index = 0; index < 120; index += 1) {
    const seed = hashGraphPath(`star:${index}`);
    const x = seed % width;
    const y = Math.floor(seed / Math.max(1, width)) % height;
    const radius = 0.55 + ((seed % 100) / 110);
    const opacity = 0.18 + ((seed % 70) / 120);
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" opacity="${opacity.toFixed(2)}"></circle>`);
  }
  return stars.join('');
}


function getGlobalNodeColor(node) {
  if (node.kind === 'folder') return 'rgba(88, 164, 255, 0.92)';
  const score = Math.max(0, Math.min(1, Number(node.score ?? 0)));
  const warm = Math.round(255 - (score * 72));
  const cool = Math.round(150 + (score * 90));
  return `rgba(${warm}, ${cool}, 255, 0.92)`;
}

function renderLegacyGlobalGraph(graph) {
  graphGlobalScene.lastGraph = graph;
  const stage = els.graphGlobalStage;
  const sphere = els.graphGlobalSphere;
  if (!stage || !sphere) return;

  const rect = stage.getBoundingClientRect();
  const width = Math.max(640, Math.round(rect.width || 920));
  const height = Math.max(520, Math.round(rect.height || 760));

  const nodes = normalizeGraphGlobalNodes(graph);
  const edges = [...(graph?.edges ?? [])].sort((left, right) => {
    const weight = { strong: 3, medium: 2, weak: 1, hidden: 0 };
    return (weight[right.intensity] ?? 0) - (weight[left.intensity] ?? 0) || Number(right.score ?? 0) - Number(left.score ?? 0);
  });

  if (els.graphGlobalCount) {
    els.graphGlobalCount.textContent = `${nodes.length} nós`;
  }

  sphere.style.transform = `rotateX(${graphGlobalViewport.pitch * 24}deg) rotateY(${graphGlobalViewport.yaw * 24}deg) rotateZ(${graphGlobalViewport.roll * 18}deg)`;

  if (nodes.length === 0) {
    sphere.innerHTML = '<div class="empty-inline graph-global-empty">Sem relações</div>';
    if (els.graphGlobalOverlayTitle) els.graphGlobalOverlayTitle.textContent = 'Nenhuma nota';
    if (els.graphGlobalOverlaySummary) els.graphGlobalOverlaySummary.textContent = 'Abra uma nota ou clique em um nó para ver o resumo.';
    if (els.graphGlobalOverlayBadge) els.graphGlobalOverlayBadge.textContent = 'Nó selecionado';
    if (els.graphGlobalOverlayStatus) els.graphGlobalOverlayStatus.textContent = '--';
    if (els.graphGlobalOverlayLinks) els.graphGlobalOverlayLinks.textContent = '--';
    if (els.graphGlobalOverlayLayer) els.graphGlobalOverlayLayer.textContent = '--';
    return;
  }

  const vectors = nodes.map((node, index) => {
    if (node.path === graph?.focusPath) {
      return { node, base: { x: 0, y: 0, z: 1 } };
    }

    const sphereIndex = index + (graph?.focusPath ? 1 : 0);
    const total = nodes.length + (graph?.focusPath ? 1 : 0);
    return { node, base: fibonacciSpherePoint(sphereIndex, Math.max(1, total)) };
  });

  const projectedNodes = vectors.map(({ node, base }) => {
    const rotated = rotateGlobalPoint(base);
    const projected = projectGlobalPoint(rotated, width, height);
    return { node, rotated, projected };
  });

  const centerX = width / 2;
  const centerY = height / 2;

  const activePath = graphGlobalScene.hoverPath || graph?.focusPath || '';
  const activeNode = activePath
    ? projectedNodes.find((entry) => entry.node.path === activePath) ?? null
    : null;

  graphGlobalScene.activePath = activePath;
  const connectionCounts = new Map();
  for (const edge of edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }

  const connectedPaths = new Set(graphGlobalScene.activePath ? [graphGlobalScene.activePath] : []);
  const activeEdges = new Set();
  for (const edge of edges) {
    if (!graphGlobalScene.activePath) continue;
    if (edge.from === graphGlobalScene.activePath || edge.to === graphGlobalScene.activePath) {
      connectedPaths.add(edge.from);
      connectedPaths.add(edge.to);
      activeEdges.add(`${edge.from}->${edge.to}:${edge.kind}`);
    }
  }

  const projectedByPath = new Map(projectedNodes.map((entry) => [entry.node.path, entry]));
  const linesMarkup = edges.map((edge) => {
    const from = projectedByPath.get(edge.from);
    const to = projectedByPath.get(edge.to);
    if (!from || !to) return '';

    const isConnected = !graphGlobalScene.activePath || connectedPaths.has(edge.from) || connectedPaths.has(edge.to);
    const isFeatured = activeEdges.has(`${edge.from}->${edge.to}:${edge.kind}`);
    const depth = (from.projected.z + to.projected.z) / 2;
    const opacity = graphGlobalScene.activePath
      ? (isConnected ? Math.max(0.15, 0.2 + ((depth + 1) / 2) * 0.48) : 0.06)
      : Math.max(0.12, 0.18 + ((depth + 1) / 2) * 0.48);
    const width = edge.kind === 'manual' ? 2.1 : edge.kind === 'folder' ? 1.25 : 1.45;
    return `
      <line
        class="graph-global-connection ${escapeHtml(edge.kind)}${isFeatured ? ' featured' : ''}"
        x1="${(from.projected.x + centerX).toFixed(2)}"
        y1="${(from.projected.y + centerY).toFixed(2)}"
        x2="${(to.projected.x + centerX).toFixed(2)}"
        y2="${(to.projected.y + centerY).toFixed(2)}"
        style="--opacity:${opacity.toFixed(3)}; stroke-width:${width};"
      />
    `;
  }).join('');

  const nodesMarkup = projectedNodes.map(({ node, projected }) => {
    const active = node.path === graphGlobalScene.activePath;
    const connected = !graphGlobalScene.activePath || connectedPaths.has(node.path);
    const kindClass = node.kind === 'folder' ? 'gray' : 'blue';
    const pathHash = hashGraphPath(node.path);
    const floatPhase = (graphGlobalScene.motionTime / 1200) + (pathHash % 360) * 0.0174533;
    const floatLift = Math.sin(floatPhase) * (node.kind === 'folder' ? 1.4 : 2.2);
    const floatScale = 1 + (Math.sin(floatPhase * 0.85) * (active ? 0.024 : 0.012));
    const opacity = active
      ? 1
      : connected
        ? Math.max(0.24, Math.min(1, projected.opacity))
        : Math.max(0.14, Math.min(0.4, projected.opacity * 0.34));
    const scale = node.kind === 'folder'
      ? 0.82 + (projected.depth * 0.16)
      : Math.max(0.64, Math.min(1.55, projected.scale));
    const connections = connectionCounts.get(node.path) ?? 0;
    return `
      <button
        type="button"
        class="graph-global-node ${kindClass}${active ? ' active' : ''}${connected ? '' : ' dimmed'}"
        data-path="${escapeHtml(node.path)}"
        data-kind="${escapeHtml(node.kind)}"
        data-title="${escapeHtml(node.label)}"
        data-connections="${connections}"
        data-active="${active ? 'true' : 'false'}"
        aria-label="Abrir ${escapeHtml(node.label)}"
        title="${escapeHtml(node.label)} · ${connections} conexões"
        style="--x:${projected.x.toFixed(2)}px; --y:${projected.y.toFixed(2)}px; --float-y:${floatLift.toFixed(2)}px; --scale:${(scale * floatScale).toFixed(3)}; opacity:${opacity.toFixed(3)}; z-index:${Math.round((projected.z + 1) * 100)};"
      ></button>
    `;
  }).join('');

  sphere.innerHTML = `
    <svg class="graph-global-connections" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${linesMarkup}
    </svg>
    <div class="graph-global-nodes">${nodesMarkup}</div>
  `;

  if (els.graphGlobalOverlayTitle) {
    els.graphGlobalOverlayTitle.textContent = activeNode?.node.label || 'Nenhuma nota selecionada';
  }
  if (els.graphGlobalOverlaySummary) {
    els.graphGlobalOverlaySummary.textContent = activeNode?.node.summary || 'Passe o mouse ou clique em um nó para ver o resumo.';
  }
  if (els.graphGlobalOverlayBadge) {
    els.graphGlobalOverlayBadge.textContent = activeNode?.node.kind === 'folder' ? 'Nó de pasta' : activeNode ? 'Nó de nota' : 'Nó selecionado';
  }
  if (els.graphGlobalOverlayStatus) {
    els.graphGlobalOverlayStatus.textContent = activeNode?.node.kind === 'folder' ? 'Pasta' : activeNode ? 'Core' : '--';
  }
  if (els.graphGlobalOverlayLinks) {
    els.graphGlobalOverlayLinks.textContent = activeNode ? String(connectionCounts.get(activeNode.node.path) ?? 0) : '--';
  }
  if (els.graphGlobalOverlayLayer) {
    els.graphGlobalOverlayLayer.textContent = activeNode ? (activeNode.projected.z > 0 ? 'Frente' : 'Fundo') : '--';
  }
}

function resetGlobalGraphViewport() {
  graphGlobalViewport.scale = 1;
  graphGlobalViewport.yaw = 0.65;
  graphGlobalViewport.pitch = -0.22;
  graphGlobalViewport.roll = 0;
}

function zoomGlobalGraph(delta) {
  graphGlobalViewport.scale = Math.min(2.3, Math.max(0.72, graphGlobalViewport.scale + delta));
}

function startGlobalGraphDrag(clientX, clientY) {
  graphGlobalViewport.dragging = true;
  graphGlobalViewport.lastX = clientX;
  graphGlobalViewport.lastY = clientY;
}

function moveGlobalGraphDrag(clientX, clientY) {
  if (!graphGlobalViewport.dragging) return;
  const dx = clientX - graphGlobalViewport.lastX;
  const dy = clientY - graphGlobalViewport.lastY;
  graphGlobalViewport.lastX = clientX;
  graphGlobalViewport.lastY = clientY;
  graphGlobalViewport.yaw += dx * 0.006;
  graphGlobalViewport.pitch += dy * 0.005;
  graphGlobalViewport.pitch = Math.max(-1.2, Math.min(1.2, graphGlobalViewport.pitch));
  graphGlobalViewport.roll += dx * 0.0012;
  renderGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
}

function stopGlobalGraphDrag() {
  graphGlobalViewport.dragging = false;
}

function getGlobalGraphNode(target) {
  return target instanceof HTMLElement ? target.closest('.graph-global-node') : null;
}

function openGlobalGraphNode(node) {
  if (!node) return;

  if (node.kind === 'folder') {
    state.selectedFolder = node.path;
    state.selectedFile = '';
    state.graphContext = { kind: 'folder', path: node.path };
    setView('workspace');
    syncWorkspaceState();
    void refreshWorkspace('', false).then(() => refreshGraph()).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir pasta'));
    return;
  }

  setView('workspace');
  void loadNote(node.path, { recordActivity: true, kind: 'open' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota do graph'));
}

function renderGlobalGraphFrame() {
  graphGlobalScene.animationFrame = null;
  if (state.view !== 'relations' && !graphGlobalViewport.dragging) return;
  graphGlobalScene.motionTime = performance.now();
  renderGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);

  if (state.view === 'relations' || graphGlobalViewport.dragging) {
    graphGlobalScene.animationFrame = window.requestAnimationFrame(renderGlobalGraphFrame);
  }
}

function startGlobalGraphAnimation() {
  if (graphGlobalScene.animationFrame !== null) return;
  graphGlobalScene.animationFrame = window.requestAnimationFrame(renderGlobalGraphFrame);
}

function stopGlobalGraphAnimation() {
  if (graphGlobalScene.animationFrame !== null) {
    window.cancelAnimationFrame(graphGlobalScene.animationFrame);
    graphGlobalScene.animationFrame = null;
  }
}

function buildGlobalGraphLayout(graph, width, height) {
  const rawNodes = normalizeGraphGlobalNodes(graph);
  const sortedEdges = [...(graph?.edges ?? [])].sort((left, right) => {
    const weight = { strong: 3, medium: 2, weak: 1, hidden: 0 };
    return (weight[right.intensity] ?? 0) - (weight[left.intensity] ?? 0) || Number(right.score ?? 0) - Number(left.score ?? 0);
  });

  const connectionCounts = new Map();
  for (const edge of sortedEdges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }

  let visibleNodes = rawNodes.filter((node) => {
    if (node.kind !== 'folder') return true;
    const clusterKey = graphGlobalClusterKeyForNode(node);
    return normalizeRelativePath(node.path) !== clusterKey;
  });
  if (visibleNodes.length === 0) {
    visibleNodes = rawNodes;
  }

  const clusterMap = new Map();
  for (const node of visibleNodes) {
    const key = graphGlobalClusterKeyForNode(node);
    const current = clusterMap.get(key) ?? {
      key,
      label: graphGlobalClusterLabel(key),
      nodes: [],
      noteCount: 0,
      folderCount: 0,
      connectionCount: 0,
      palette: null,
      x: 0,
      y: 0,
      rx: 0,
      ry: 0
    };
    current.nodes.push(node);
    if (node.kind === 'folder') current.folderCount += 1;
    else current.noteCount += 1;
    clusterMap.set(key, current);
  }

  const clusters = [...clusterMap.values()].sort((left, right) => right.nodes.length - left.nodes.length || left.label.localeCompare(right.label, 'pt-BR'));
  const slots = buildGlobalGraphSlots(clusters.length, width, height);
  const positions = new Map();
  const nodeOrder = [];

  clusters.forEach((cluster, clusterIndex) => {
    const slot = slots[clusterIndex] ?? { x: width / 2, y: height / 2 };
    cluster.palette = graphGlobalPalette(clusterIndex);
    cluster.x = slot.x;
    cluster.y = slot.y;
    cluster.rx = Math.min(width * 0.19, 150 + (cluster.nodes.length * 10));
    cluster.ry = Math.min(height * 0.16, 112 + (cluster.nodes.length * 7));

    const rankedNodes = [...cluster.nodes].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
      return (connectionCounts.get(right.path) ?? 0) - (connectionCounts.get(left.path) ?? 0) || right.score - left.score || left.label.localeCompare(right.label, 'pt-BR');
    });

    rankedNodes.forEach((node, index) => {
      const seed = hashGraphPath(node.path);
      const angle = ((seed % 360) * (Math.PI / 180)) + (index * 2.399963229728653);
      const radiusRatio = rankedNodes.length <= 1 ? 0 : Math.sqrt((index + 0.65) / (rankedNodes.length + 0.35));
      const radialX = cluster.rx * (0.16 + (radiusRatio * 0.74));
      const radialY = cluster.ry * (0.16 + (radiusRatio * 0.72));
      const baseX = cluster.x + (Math.cos(angle) * radialX * 0.82);
      const baseY = cluster.y + (Math.sin(angle) * radialY * 0.8);
      const floatX = Math.sin((graphGlobalScene.motionTime / 1200) + (seed * 0.009)) * (node.kind === 'folder' ? 1.2 : 2.4);
      const floatY = Math.cos((graphGlobalScene.motionTime / 1380) + (seed * 0.007)) * (node.kind === 'folder' ? 1.2 : 2.8);
      const isHub = node.kind === 'note' && index < Math.max(1, Math.min(2, Math.ceil(cluster.noteCount * 0.12)));
      const size = node.kind === 'folder'
        ? 12 + (Math.min(1, node.score) * 3)
        : 10 + (Math.min(1, node.score) * 6) + (isHub ? 5 : 0);
      const entry = {
        node,
        cluster,
        x: baseX + floatX,
        y: baseY + floatY,
        size,
        isHub
      };
      positions.set(node.path, entry);
      nodeOrder.push(entry);
    });
  });

  const visiblePaths = new Set(nodeOrder.map((entry) => entry.node.path));
  const edges = sortedEdges.filter((edge) => visiblePaths.has(edge.from) && visiblePaths.has(edge.to));
  const clusterByKey = new Map(clusters.map((cluster) => [cluster.key, cluster]));

  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    from.cluster.connectionCount += 1;
    if (from.cluster.key !== to.cluster.key) {
      to.cluster.connectionCount += 1;
    }
  }

  return { clusters, clusterByKey, positions, nodeOrder, edges, connectionCounts };
}

function ensureGlobalGraphSelection(layout, graph) {
  if (graphGlobalScene.activePath && layout.positions.has(graphGlobalScene.activePath)) {
    graphGlobalScene.activeCluster = layout.positions.get(graphGlobalScene.activePath)?.cluster.key ?? graphGlobalScene.activeCluster;
    return;
  }

  if (graphGlobalScene.activeCluster && layout.clusterByKey.has(graphGlobalScene.activeCluster)) {
    graphGlobalScene.activePath = '';
    return;
  }

  graphGlobalScene.activePath = '';
  graphGlobalScene.activeCluster = '';
}

function buildGlobalGraphHighlights(layout) {
  const displayPath = graphGlobalScene.hoverPath || graphGlobalScene.activePath;
  const fallbackCluster = graphGlobalScene.hoverCluster || graphGlobalScene.activeCluster;
  const displayCluster = displayPath
    ? layout.positions.get(displayPath)?.cluster.key ?? fallbackCluster
    : fallbackCluster;

  const highlightedPaths = new Set();
  const featuredEdges = new Set();

  if (displayPath && layout.positions.has(displayPath)) {
    highlightedPaths.add(displayPath);
    for (const edge of layout.edges) {
      if (edge.from === displayPath || edge.to === displayPath) {
        highlightedPaths.add(edge.from);
        highlightedPaths.add(edge.to);
        featuredEdges.add(`${edge.from}->${edge.to}:${edge.kind}`);
      }
    }
  } else if (displayCluster && layout.clusterByKey.has(displayCluster)) {
    for (const entry of layout.nodeOrder) {
      if (entry.cluster.key === displayCluster) {
        highlightedPaths.add(entry.node.path);
      }
    }
    for (const edge of layout.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (from?.cluster.key === displayCluster && to?.cluster.key === displayCluster) {
        featuredEdges.add(`${edge.from}->${edge.to}:${edge.kind}`);
      }
    }
  }

  return { displayPath, displayCluster, highlightedPaths, featuredEdges };
}

function updateGlobalGraphOverlay(layout, displayPath, displayCluster) {
  const setOverlayVisible = (visible) => {
    if (!els.graphGlobalOverlay) return;
    els.graphGlobalOverlay.classList.toggle('hidden', !visible);
    els.graphGlobalOverlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) {
      els.graphGlobalOverlay.dataset.path = '';
      els.graphGlobalOverlay.dataset.kind = '';
    }
  };

  if (displayPath && layout.positions.has(displayPath)) {
    const current = layout.positions.get(displayPath);
    const node = current?.node;
    if (!node) return;
    const isFolder = node.kind === 'folder';
    const clusterLabel = current.cluster.label;
    const summary = node.summary || (isFolder
      ? `Pasta de navegação dentro do assunto ${clusterLabel}. Use este nó para refocar a malha e abrir esse contexto no workspace.`
      : `Nota dentro do assunto ${clusterLabel}. Use este ponto para inspecionar o contexto e abrir a nota direto no workspace.`);

    setOverlayVisible(true);
    if (els.graphGlobalOverlay) {
      els.graphGlobalOverlay.dataset.path = node.path;
      els.graphGlobalOverlay.dataset.kind = node.kind;
    }
    if (els.graphGlobalOverlayTitle) els.graphGlobalOverlayTitle.textContent = node.label;
    if (els.graphGlobalOverlaySummary) els.graphGlobalOverlaySummary.textContent = summary;
    if (els.graphGlobalOverlayBadge) els.graphGlobalOverlayBadge.textContent = isFolder ? 'Pasta focada' : 'Nota focada';
    if (els.graphGlobalOverlayKicker) els.graphGlobalOverlayKicker.textContent = `Assunto ${clusterLabel}`;
    if (els.graphGlobalOverlayPath) {
      const pathLabel = prettyPath(node.path);
      els.graphGlobalOverlayPath.textContent = pathLabel;
      els.graphGlobalOverlayPath.setAttribute('title', pathLabel);
    }
    if (els.graphGlobalOverlayStatus) els.graphGlobalOverlayStatus.textContent = isFolder ? 'Pasta' : 'Nota';
    if (els.graphGlobalOverlayLinks) els.graphGlobalOverlayLinks.textContent = String(layout.connectionCounts.get(node.path) ?? 0);
    if (els.graphGlobalOverlayLayer) els.graphGlobalOverlayLayer.textContent = clusterLabel;
    if (els.graphGlobalOverlayHint) {
      els.graphGlobalOverlayHint.textContent = isFolder
        ? 'Clique para manter o contexto visual. Duplo clique abre a pasta no workspace.'
        : 'Clique para manter o foco visual. Duplo clique abre a nota no workspace.';
    }
    if (els.graphGlobalOverlayOpenButton) {
      els.graphGlobalOverlayOpenButton.textContent = isFolder ? 'Abrir pasta' : 'Abrir nota';
    }
    if (els.graphGlobalOverlayFocusButton) {
      els.graphGlobalOverlayFocusButton.textContent = isFolder ? 'Manter contexto' : 'Manter foco';
    }
    return;
  }

  if (displayCluster && layout.clusterByKey.has(displayCluster)) {
    setOverlayVisible(false);
    return;
  }

  setOverlayVisible(false);
}

function renderIslandGlobalGraph(graph) {
  graphGlobalScene.lastGraph = graph;
  const stage = els.graphGlobalStage;
  const sphere = els.graphGlobalSphere;
  if (!stage || !sphere) return;

  const rect = stage.getBoundingClientRect();
  const width = Math.max(700, Math.round(rect.width || 920));
  const height = Math.max(560, Math.round(rect.height || 760));
  const layout = buildGlobalGraphLayout(graph, width, height);

  if (els.graphGlobalCount) {
    els.graphGlobalCount.textContent = `${layout.nodeOrder.length} nós · ${layout.clusters.length} ilhas`;
  }

  if (layout.nodeOrder.length === 0) {
    sphere.innerHTML = '<div class="empty-inline graph-global-empty">Sem relações</div>';
    updateGlobalGraphOverlay(layout, '', '');
    return;
  }

  ensureGlobalGraphSelection(layout, graph);
  const { displayPath, displayCluster, highlightedPaths, featuredEdges } = buildGlobalGraphHighlights(layout);
  const starsMarkup = buildGlobalGraphStars(width, height);
  const blobMarkup = layout.clusters.map((cluster, index) => `<path class="graph-global-blob${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}" d="${graphGlobalBlobPath(cluster.x, cluster.y, cluster.rx, cluster.ry, index * 2.17)}" style="--blob-fill:${cluster.palette.blob}; --blob-stroke:${cluster.palette.stroke}; --blob-glow:${cluster.palette.glow};"></path>`).join('');
  const clusterLabelMarkup = layout.clusters.map((cluster) => `<g class="graph-global-cluster-meta${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}"><circle class="graph-global-cluster-beacon" cx="${(cluster.x - (cluster.rx * 0.5)).toFixed(2)}" cy="${(cluster.y - (cluster.ry * 0.58)).toFixed(2)}" r="7"></circle><text class="graph-global-cluster-label" x="${(cluster.x - (cluster.rx * 0.42)).toFixed(2)}" y="${(cluster.y - (cluster.ry * 0.52)).toFixed(2)}">${escapeHtml(cluster.label)}</text></g>`).join('');
  const edgeMarkup = layout.edges.map((edge) => {
    const from = layout.positions.get(edge.from);
    const to = layout.positions.get(edge.to);
    if (!from || !to) return '';

    const sameCluster = from.cluster.key === to.cluster.key;
    const featureKey = `${edge.from}->${edge.to}:${edge.kind}`;
    const isFeatured = featuredEdges.has(featureKey);
    const clusterVisible = !displayCluster || from.cluster.key === displayCluster || to.cluster.key === displayCluster;
    const opacity = displayPath
      ? (isFeatured ? 0.96 : clusterVisible ? (sameCluster ? 0.34 : 0.18) : 0.06)
      : displayCluster
        ? (sameCluster && clusterVisible ? 0.48 : clusterVisible ? 0.14 : 0.05)
        : (sameCluster ? 0.34 : 0.18);
    const strokeWidth = edge.kind === 'manual' ? 1.8 : edge.kind === 'folder' ? 1.1 : 1.35;
    return `<line class="graph-global-connection ${escapeHtml(edge.kind)}${isFeatured ? ' featured' : ''}${displayCluster && !clusterVisible ? ' dimmed' : ''}" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" style="--opacity:${opacity.toFixed(3)}; stroke-width:${strokeWidth};"></line>`;
  }).join('');
  const haloMarkup = layout.nodeOrder.map((entry) => entry.node.path === displayPath ? `<circle class="graph-global-halo active" cx="${entry.x.toFixed(2)}" cy="${entry.y.toFixed(2)}" r="${(entry.size + 8).toFixed(2)}"></circle>` : '').join('');
  const clusterHitsMarkup = layout.clusters.map((cluster) => `<button type="button" class="graph-global-cluster-hit${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}" data-cluster="${escapeHtml(cluster.key)}" aria-label="Focar assunto ${escapeHtml(cluster.label)}" title="${escapeHtml(cluster.label)}" style="left:${(cluster.x - cluster.rx).toFixed(2)}px; top:${(cluster.y - cluster.ry).toFixed(2)}px; width:${(cluster.rx * 2).toFixed(2)}px; height:${(cluster.ry * 2).toFixed(2)}px;"></button>`).join('');
  const nodeMarkup = layout.nodeOrder.map((entry) => {
    const active = entry.node.path === displayPath;
    const dimmed = displayCluster ? entry.cluster.key !== displayCluster : false;
    const fill = entry.node.kind === 'folder' ? entry.cluster.palette.folder : entry.isHub ? entry.cluster.palette.nodeStrong : entry.cluster.palette.node;
    const glow = entry.isHub ? entry.cluster.palette.glow : 'rgba(255,255,255,0.16)';
    return `<button type="button" class="graph-global-node ${escapeHtml(entry.node.kind)}${entry.isHub ? ' hub' : ''}${active ? ' active' : ''}${dimmed ? ' dimmed' : ''}" data-path="${escapeHtml(entry.node.path)}" data-kind="${escapeHtml(entry.node.kind)}" data-cluster="${escapeHtml(entry.cluster.key)}" data-title="${escapeHtml(entry.node.label)}" title="${escapeHtml(entry.node.label)}" style="left:${entry.x.toFixed(2)}px; top:${entry.y.toFixed(2)}px; --size:${entry.size.toFixed(2)}px; --node-fill:${fill}; --node-glow:${glow};"></button>`;
  }).join('');

  sphere.innerHTML = `<div class="graph-global-canvas" style="transform: translate(${graphGlobalViewport.x.toFixed(2)}px, ${graphGlobalViewport.y.toFixed(2)}px) scale(${graphGlobalViewport.scale.toFixed(3)}); width:${width}px; height:${height}px;"><svg class="graph-global-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="globalBlobGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs><g class="graph-global-stars">${starsMarkup}</g><g class="graph-global-blobs">${blobMarkup}</g><g class="graph-global-links">${edgeMarkup}</g><g class="graph-global-halos">${haloMarkup}</g><g class="graph-global-labels">${clusterLabelMarkup}</g></svg><div class="graph-global-hitlayer">${clusterHitsMarkup}${nodeMarkup}</div></div>`;

  updateGlobalGraphOverlay(layout, displayPath, displayCluster);
}

function resetIslandGlobalGraphViewport() {
  graphGlobalViewport.scale = 1;
  graphGlobalViewport.x = 0;
  graphGlobalViewport.y = 0;
}

function zoomIslandGlobalGraph(delta) {
  graphGlobalViewport.scale = Math.min(1.95, Math.max(0.76, graphGlobalViewport.scale + delta));
}

function startIslandGlobalGraphDrag(clientX, clientY) {
  graphGlobalViewport.dragging = true;
  graphGlobalViewport.lastX = clientX;
  graphGlobalViewport.lastY = clientY;
}

function moveIslandGlobalGraphDrag(clientX, clientY) {
  if (!graphGlobalViewport.dragging) return;
  const dx = clientX - graphGlobalViewport.lastX;
  const dy = clientY - graphGlobalViewport.lastY;
  graphGlobalViewport.lastX = clientX;
  graphGlobalViewport.lastY = clientY;
  graphGlobalViewport.x += dx;
  graphGlobalViewport.y += dy;
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
}

function stopIslandGlobalGraphDrag() {
  graphGlobalViewport.dragging = false;
}

function getIslandGlobalGraphNode(target) {
  return target instanceof HTMLElement ? target.closest('.graph-global-node') : null;
}

function getIslandGlobalGraphCluster(target) {
  return target instanceof HTMLElement ? target.closest('.graph-global-cluster-hit') : null;
}

function getGraphGlobalOverlayNode() {
  const overlay = els.graphGlobalOverlay;
  if (!overlay) return null;

  const pathValue = String(overlay.dataset.path ?? '').trim();
  if (!pathValue) return null;
  return (graphGlobalScene.lastGraph?.nodes ?? []).find((entry) => entry.path === pathValue) ?? null;
}

function focusIslandGlobalGraphNode(pathValue) {
  const normalizedPath = normalizeRelativePath(pathValue);
  graphGlobalScene.activePath = normalizedPath;
  const node = graphGlobalScene.lastGraph?.nodes?.find((entry) => normalizeRelativePath(entry.path) === normalizedPath);
  graphGlobalScene.activeCluster = node ? graphGlobalClusterKeyForNode(node) : graphGlobalScene.activeCluster;
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
}

function focusIslandGlobalGraphCluster(clusterKey) {
  graphGlobalScene.activePath = '';
  graphGlobalScene.activeCluster = clusterKey;
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
}

function renderIslandGlobalGraphFrame() {
  graphGlobalScene.animationFrame = null;
  if (state.view !== 'relations' && !graphGlobalViewport.dragging) return;
  graphGlobalScene.motionTime = performance.now();
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);

  if (state.view === 'relations' || graphGlobalViewport.dragging) {
    graphGlobalScene.animationFrame = window.requestAnimationFrame(renderIslandGlobalGraphFrame);
  }
}

function startIslandGlobalGraphAnimation() {
  if (graphGlobalScene.animationFrame !== null) return;
  graphGlobalScene.animationFrame = window.requestAnimationFrame(renderIslandGlobalGraphFrame);
}

function stopIslandGlobalGraphAnimation() {
  if (graphGlobalScene.animationFrame !== null) {
    window.cancelAnimationFrame(graphGlobalScene.animationFrame);
    graphGlobalScene.animationFrame = null;
  }
}

async function refreshGlobalGraph() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    state.graphGlobal = { vaultRoot: '', nodes: [], edges: [] };
    renderIslandGlobalGraph(state.graphGlobal);
    return;
  }

  const params = new URLSearchParams({ vaultRoot });
  if (state.selectedFile) params.set('focusPath', state.selectedFile);
  else if (state.selectedFolder) params.set('focusPath', state.selectedFolder);
  const data = await api(`/api/graph-global?${params.toString()}`);
  state.graphGlobal = data;
  renderIslandGlobalGraph(state.graphGlobal);
}

async function refreshRelationsSurface() {
  await loadRelatedData();
  await loadLinkSuggestions();
  await refreshGlobalGraph();
}

async function openRelationsView() {
  if (!getConfiguredVaultRoot()) {
    if (isDesktopShell) {
      await startVault().catch(() => null);
    }

    if (!getConfiguredVaultRoot()) {
      setView('setup');
      showError('Abra ou crie um vault antes de ver relações.');
      return;
    }
  }

  setView('relations');
  closeRelationsDetailsMenu();
  resetIslandGlobalGraphViewport();
  graphGlobalScene.activePath = '';
  graphGlobalScene.activeCluster = '';
  graphGlobalScene.hoverPath = '';
  graphGlobalScene.hoverCluster = '';
  await refreshRelationsSurface();
  startIslandGlobalGraphAnimation();
}

async function loadTemplates() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    state.templates = [];
    return;
  }

  const params = new URLSearchParams({ vaultRoot });
  const data = await api(`/api/templates?${params.toString()}`);
  state.templates = data.templates ?? [];
}

function renderTemplatesDialog() {
  els.templatesDialogList.innerHTML = state.templates.length === 0
    ? '<div class="empty-inline">Nenhum modelo encontrado em <code>Templates/</code>.</div>'
    : state.templates.map((template, index) => `
      <button class="template-item ${state.selectedTemplate?.path === template.path ? 'active' : ''}" type="button" data-index="${index}">
        <strong>${escapeHtml(template.title)}</strong>
        <small>${escapeHtml(template.path)}</small>
      </button>
    `).join('');
}

async function openTemplatesDialog() {
  await loadTemplates();
  renderTemplatesDialog();
  els.templatesDialog.showModal();
}

async function openTemplatePickerDialog() {
  await loadTemplates();
  els.templatePickerSelect.innerHTML = ['<option value="">Base vazia</option>', ...state.templates.map((template, index) => `<option value="${index}">${escapeHtml(template.title)}</option>`)].join('');
  els.templatePickerInput.value = state.selectedFile ? fileLabel(state.selectedFile) : 'novo-modelo';
  els.templatePickerContent.value = els.noteEditor.value || '';
  els.templatePickerDialog.showModal();
}

function applyTemplateSelection(index) {
  const template = state.templates[index] ?? null;
  setSelectedTemplate(template);
  els.templatesDialog.close();
}

function closeSearchDialog() {
  if (els.searchDialog.open) {
    els.searchDialog.close();
  }
}

function renderSearchResults(matches) {
  els.searchResultsCount.textContent = String(matches.length);
  els.searchResultsList.innerHTML = matches.length === 0
    ? '<div class="search-empty">Nenhum resultado encontrado.</div>'
    : matches.map((match) => `
      <button class="search-result" type="button" data-path="${escapeHtml(match.path)}">
        <div class="search-result-main">
          <div class="search-result-head">
            <strong>${escapeHtml(match.title || fileLabel(match.path))}</strong>
            <span>${escapeHtml(match.score)}</span>
          </div>
          <p>${escapeHtml(prettyPath(match.path))}</p>
          ${match.snippet ? `<div class="search-snippet">${formatSearchSnippet(escapeHtml(match.snippet))}</div>` : ''}
        </div>
        <div class="search-result-tags">${(match.tags ?? []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
      </button>
    `).join('');
}

async function runSearch() {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    showError('Abra ou crie um vault antes de buscar.');
    return;
  }

  const query = els.searchQueryInput.value.trim();
  const phrase = els.searchPhraseInput.value.trim();
  const tags = els.searchTagsInput.value.trim();

  searchState.query = query;
  searchState.phrase = phrase;
  searchState.tags = tags;

  const searchParams = new URLSearchParams({ vaultRoot });
  if (query) searchParams.set('query', query);
  if (phrase) searchParams.set('phrase', phrase);
  if (tags) searchParams.set('tags', tags);

  const data = await api(`/api/search?${searchParams.toString()}`);
  renderSearchResults(data.matches ?? []);
}

function openSearchDialog() {
  els.searchQueryInput.value = searchState.query;
  els.searchPhraseInput.value = searchState.phrase;
  els.searchTagsInput.value = searchState.tags;
  els.searchDialog.showModal();
  void runSearch().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao buscar'));
}

function closeCommandsDialog() {
  els.aiDialogCommandsPanel.classList.add('hidden');
}

function renderCommandsDialog() {
  const host = els.aiDialogCommandsGroups ?? els.commandsDialogGroups;
  host.innerHTML = desktopCommands.map((group) => {
    const items = group.items.map(([name, description, usage]) => `
      <article class="command-row">
        <div>
          <strong>${name}</strong>
          <p>${description}</p>
        </div>
        <code>${usage}</code>
      </article>
    `).join('');

    return `
      <section class="command-group">
        <div class="command-group-head">
          <span class="eyebrow">${group.group}</span>
        </div>
        <div class="command-group-list">${items}</div>
      </section>
    `;
  }).join('');
}

function openCommandsDialog() {
  renderCommandsDialog();
  els.aiDialogCommandsPanel.classList.remove('hidden');
}

window.marikaAiActions = {
  openTerminal: () => {
    closeAiDialog();
    setTimeout(() => {
      void openAiTerminal().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir terminal da IA'));
    }, 50);
  },
  showCommands: () => openCommandsDialog(),
  closeCommands: () => closeCommandsDialog(),
  openDialog: () => openAiDialog(),
  closeDialog: () => closeAiDialog()
};

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

function closeInputDialog() {
  if (els.inputDialog.open) {
    els.inputDialog.close();
  }
}

function openInputDialog({ eyebrow, title, message, label, value = '', multiline = false }) {
  return new Promise((resolve) => {
    if (inputDialogSession) {
      inputDialogSession.finish(null);
    }

    els.inputDialogEyebrow.textContent = eyebrow;
    els.inputDialogTitle.textContent = title;
    els.inputDialogMessage.textContent = message;
    els.inputDialogFieldWrap.hidden = false;
    els.inputDialogFieldLabel.textContent = label;
    els.inputDialogInput.value = value;
    els.inputDialogTextarea.value = value;
    els.inputDialogInput.hidden = multiline;
    els.inputDialogTextarea.hidden = !multiline;
    els.inputDialogCancel.textContent = 'Cancelar';
    els.inputDialogConfirm.textContent = 'Confirmar';

    const cleanup = () => {
      if (inputDialogSession?.cleanup === cleanup) {
        inputDialogSession = null;
      }

      els.inputDialog.oncancel = null;
      els.inputDialogConfirm.onclick = null;
      els.inputDialogCancel.onclick = null;
    };

    const finish = (result) => {
      cleanup();
      closeInputDialog();
      resolve(result);
    };

    const onConfirm = () => {
      const output = multiline ? els.inputDialogTextarea.value : els.inputDialogInput.value;
      finish(output.trim());
    };

    const onCancel = (event) => {
      event.preventDefault();
      finish(null);
    };

    const onCancelClick = () => finish(null);

    inputDialogSession = { cleanup, finish };

    els.inputDialog.oncancel = onCancel;
    els.inputDialogConfirm.onclick = onConfirm;
    els.inputDialogCancel.onclick = onCancelClick;
    els.inputDialog.showModal();
    if (multiline) {
      els.inputDialogTextarea.focus();
    } else {
      els.inputDialogInput.focus();
    }
  });
}

function openConfirmDialog({ eyebrow, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
  return new Promise((resolve) => {
    if (inputDialogSession) {
      inputDialogSession.finish(false);
    }

    els.inputDialogEyebrow.textContent = eyebrow;
    els.inputDialogTitle.textContent = title;
    els.inputDialogMessage.textContent = message;
    els.inputDialogFieldWrap.hidden = true;
    els.inputDialogInput.hidden = true;
    els.inputDialogTextarea.hidden = true;
    els.inputDialogCancel.textContent = cancelLabel;
    els.inputDialogConfirm.textContent = confirmLabel;

    const cleanup = () => {
      if (inputDialogSession?.cleanup === cleanup) {
        inputDialogSession = null;
      }

      els.inputDialog.oncancel = null;
      els.inputDialogConfirm.onclick = null;
      els.inputDialogCancel.onclick = null;
      els.inputDialogFieldWrap.hidden = false;
      els.inputDialogCancel.textContent = 'Cancelar';
      els.inputDialogConfirm.textContent = 'Confirmar';
    };

    const finish = (result) => {
      cleanup();
      closeInputDialog();
      resolve(result);
    };

    const onCancel = (event) => {
      event.preventDefault();
      finish(false);
    };

    inputDialogSession = { cleanup, finish };

    els.inputDialog.oncancel = onCancel;
    els.inputDialogConfirm.onclick = () => finish(true);
    els.inputDialogCancel.onclick = () => finish(false);
    els.inputDialog.showModal();
    els.inputDialogConfirm.focus();
  });
}

function applyActiveVaultRoot(vaultRoot) {
  const normalizedVaultRoot = String(vaultRoot ?? '').trim();
  state.defaultVaultPath = normalizedVaultRoot;
  state.vaultPath = normalizedVaultRoot;
  els.vaultPathInput.value = normalizedVaultRoot;
  document.body.dataset.activeVaultRoot = normalizedVaultRoot;
  updateVault(normalizedVaultRoot);
  sendDebugState('applyActiveVaultRoot', { appliedVaultRoot: normalizedVaultRoot });
}

async function openVaultFromBootstrap(vaultRoot, { autoOpenFirstNote = true } = {}) {
  applyActiveVaultRoot(vaultRoot);
  await syncDesktopActiveVaultRoot(vaultRoot);
  setDesktopReady(false);
  setView('workspace');
  syncWorkspaceState();

  try {
    await refreshWorkspace('', autoOpenFirstNote);
    await loadPinnedPaths();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Falha ao carregar vault ativo');
    console.error('Falha ao iniciar vault', error);
  }

  try {
    await loadTemplates();
  } catch (error) {
    console.error('Falha ao carregar modelos', error);
  }

  try {
    await loadAgenda();
  } catch (error) {
    console.error('Falha ao carregar agenda', error);
    showError(error instanceof Error ? error.message : 'Falha ao carregar agenda');
  } finally {
    setDesktopReady(true);
    if (window.marikaDesktop && typeof window.marikaDesktop.markDesktopReady === 'function') {
      window.marikaDesktop.markDesktopReady();
    }
  }

  ensureAgendaReminderPolling();
}

async function openDesktopDefaultVault(autoOpenFirstNote = true) {
  sendDebugState('desktopBootstrap.start');
  const bootstrap = await loadDesktopBootstrap();
  const vaultRoot = String(bootstrap.vaultRoot ?? startupVaultRoot ?? '').trim();

  if (!vaultRoot) {
    throw new Error('Vault padrão não configurado');
  }

  const result = await api('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ action: 'open', vaultRoot })
  });

  sendDebugState('desktopBootstrap.open', {
    bootstrapVaultRoot: vaultRoot,
    responseVaultRoot: String(result.vaultRoot ?? vaultRoot)
  });

  await openVaultFromBootstrap(String(result.vaultRoot ?? vaultRoot), { autoOpenFirstNote });
}

async function openSearchResult(relativePath) {
  closeSearchDialog();
  setView('workspace');
  try {
    await loadNote(relativePath, { recordActivity: true, kind: 'open' });
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Falha ao abrir resultado');
  }
}

function closeMenus() {
  els.quickMenu.classList.remove('open');
  els.folderContextMenu.classList.remove('open');
  els.noteOptionsMenu?.classList.add('hidden');
  els.noteOptionsButton?.setAttribute('aria-expanded', 'false');
  closeAgendaOptionsMenu();
  closeOverviewOptionsMenu();
  closeRelationsDetailsMenu();
}

function openMenu(menu, x, y) {
  closeMenus();
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('open');
}

function selectFolder(relativePath, source = 'folder') {
  state.selectedFolder = normalizeRelativePath(relativePath);
  state.graphContext = { kind: source === 'note' ? 'note' : 'folder', path: state.selectedFolder };
  els.folderBreadcrumb.textContent = state.selectedFolder ? prettyPath(state.selectedFolder) : 'Nenhuma pasta selecionada';
  document.querySelectorAll('.folder').forEach((node) => {
    node.classList.toggle('active-folder', node.dataset.path === state.selectedFolder);
  });
  if (source === 'folder' && state.summaryMode === 'graph') {
    void refreshGraph();
  }
}

function clearFolderSelection() {
  if (!state.selectedFolder) return;
  state.selectedFolder = '';
  state.graphContext = { kind: 'folder', path: '' };
  els.folderBreadcrumb.textContent = 'Nenhuma pasta selecionada';
  document.querySelectorAll('.folder').forEach((node) => {
    node.classList.remove('active-folder');
  });

  if (state.tree) {
    renderTree(state.tree);
  }

  syncWorkspaceState();
}

function shouldClearFolderSelection(event) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) return false;

  if (target.closest('button, input, textarea, select, label, a, summary, dialog, menu, .folder, .file-item, .note-options, .quick-menu')) {
    return false;
  }

  return target.matches('#workspaceView, .workspace-layout, .tree-pane, .tree, .editor-pane, .editor-body, .summary-pane, .summary-overview, #graphPanel');
}

function handleFolderSelectionBackgroundClick(event) {
  if (state.view !== 'workspace') return;
  if (!shouldClearFolderSelection(event)) return;
  clearFolderSelection();
}

function showQuickMenu(button) {
  const rect = button.getBoundingClientRect();
  openMenu(els.quickMenu, rect.left, rect.bottom + 8);
}

function toggleNoteOptionsMenu() {
  if (!els.noteOptionsMenu || !els.noteOptionsButton) return;
  const isHidden = els.noteOptionsMenu.classList.contains('hidden');
  closeMenus();
  if (!isHidden) return;

  els.noteOptionsMenu.classList.remove('hidden');
  els.noteOptionsButton.setAttribute('aria-expanded', 'true');
}

function showFolderContextMenu(relativePath, x, y) {
  state.selectedFolder = normalizeRelativePath(relativePath);
  selectFolder(state.selectedFolder);
  els.folderContextMenu.innerHTML = '';

  const actions = [
    ['create-note', 'Nova nota'],
    ['create-folder', 'Nova pasta'],
    ['rename', 'Renomear'],
    ['move', 'Mover']
  ];

  for (const [action, label] of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.action = action;
    item.textContent = label;
    item.addEventListener('click', () => {
      closeMenus();
      if (action === 'create-note') void createNote();
      if (action === 'create-folder') void createFolder();
      if (action === 'rename') void renameNote();
      if (action === 'move') void moveNote();
    });
    els.folderContextMenu.appendChild(item);
  }

  openMenu(els.folderContextMenu, x, y);
}

function syncWorkspaceState() {
  const active = Boolean(getConfiguredVaultRoot());
  const bootingDesktopVault = isDesktopShell && !active && !desktopBootstrapComplete;
  els.workspaceEmpty.classList.toggle('active', state.view === 'workspace' && !active);
  els.workspaceView.querySelector('.workspace-layout').classList.toggle('active', state.view === 'workspace' && active);

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
    els.saveButton,
    els.templatesButton,
    els.dailyNoteButton,
    els.desktopSearchButton,
    els.summaryOverviewButton,
    els.summaryGraphButton,
    els.noteOptionsButton,
    els.agendaOptionsButton,
  ].forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
  });
  els.desktopCommandsButton.disabled = false;
}

function firstMarkdown(entry) {
  if (!entry) return null;
  if (entry.kind === 'file') {
    return entry.name.toLowerCase().endsWith('.md') ? entry : null;
  }

  for (const child of entry.children ?? []) {
    const found = firstMarkdown(child);
    if (found) return found;
  }

  return null;
}

function renderTree(tree) {
  const folderTemplate = document.getElementById('folderTemplate');
  const fileTemplate = document.getElementById('fileTemplate');
  els.tree.innerHTML = '';

  const renderEntry = (entry, container, level = 0) => {
    if (entry.kind === 'folder') {
      const folder = folderTemplate.content.firstElementChild.cloneNode(true);
      const folderPath = normalizeRelativePath(entry.relativePath);
      folder.dataset.path = folderPath;
      folder.style.setProperty('--tree-level', String(level));
      const nameSpan = folder.querySelector('.folder-name');
      const countSpan = folder.querySelector('.folder-count');
      nameSpan.textContent = entry.name;
      countSpan.textContent = String((entry.children ?? []).length);

      const items = folder.querySelector('.folder-items');
      folder.querySelector('summary').addEventListener('click', () => selectFolder(folderPath));
      folder.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showFolderContextMenu(folderPath, event.clientX, event.clientY);
      });
      const children = sortEntries(entry.children ?? []);
      for (const child of children) {
        renderEntry(child, items, level + 1);
      }

      container.appendChild(folder);
      return;
    }

    if (!entry.name.toLowerCase().endsWith('.md')) return;

    const filePath = normalizeRelativePath(entry.relativePath);
    const file = fileTemplate.content.firstElementChild.cloneNode(true);
    file.dataset.path = filePath;
    file.style.setProperty('--tree-level', String(level));
    file.querySelector('.file-name').textContent = entry.name;
    file.classList.toggle('active', filePath === state.selectedFile);
    file.classList.toggle('linked-open', filePath === linkedNoteState.highlightedPath);
    file.title = filePath;
    file.addEventListener('click', () => loadNote(filePath, { recordActivity: true, kind: 'open' }));
    container.appendChild(file);
  };

  for (const child of tree?.children ?? []) {
    renderEntry(child, els.tree);
  }
}

async function refreshWorkspace(preferredPath = state.selectedFile, autoOpenFirstNote = true) {
  const vaultRoot = getConfiguredVaultRoot();
  if (!vaultRoot) {
    els.tree.innerHTML = '';
    state.selectedFile = '';
    state.selectedFolder = '';
    closeEditorAssistMenu();
    setEditorTitleValue('Nenhuma nota', { enabled: false });
    els.breadcrumbs.textContent = 'Vault / vazio';
    els.editorMeta.textContent = 'Vault · vazio · markdown';
    els.noteEditor.value = '';
    resetEditorHistory({ value: '', selectionStart: 0, selectionEnd: 0 });
    resetEditorSaveState('');
    renderEditorPresentation();
    els.editorStatus.textContent = 'Selecione ou crie um vault primeiro.';
    els.folderBreadcrumb.textContent = 'Nenhuma pasta selecionada';
    return;
  }

  const data = await api(`/api/workspace?vaultRoot=${encodeURIComponent(vaultRoot)}`);
  if (data?.vaultRoot) {
    applyActiveVaultRoot(data.vaultRoot);
  }
  state.tree = data.tree;
  renderTree(data.tree);
  reconcileVaultScopedState(data.tree);
  sendDebugState('refreshWorkspace.response', {
    requestedVaultRoot: vaultRoot,
    responseVaultRoot: data?.vaultRoot ?? '',
    responseChildCount: data?.tree?.children?.length ?? null,
    preferredPath
  });

  if (state.selectedFolder) {
    selectFolder(state.selectedFolder);
  } else {
    els.folderBreadcrumb.textContent = 'Nenhuma pasta selecionada';
  }

  if (preferredPath) {
    await loadNote(preferredPath);
  } else if (autoOpenFirstNote) {
    const first = firstMarkdown(data.tree)?.relativePath || '';
    if (first) {
      await loadNote(first);
    } else {
      state.selectedFile = '';
      setEditorTitleValue('Nenhuma nota', { enabled: false });
      els.breadcrumbs.textContent = 'Vault / vazio';
      els.editorMeta.textContent = 'Vault · vazio · markdown';
      els.noteEditor.value = '';
      resetEditorHistory({ value: '', selectionStart: 0, selectionEnd: 0 });
      resetEditorSaveState('');
      renderEditorPresentation();
      els.editorStatus.textContent = 'Nenhuma nota Markdown encontrada.';
    }
  } else {
    state.selectedFile = '';
    setEditorTitleValue('Nenhuma nota', { enabled: false });
    els.breadcrumbs.textContent = 'Vault / vazio';
    els.editorMeta.textContent = 'Vault · vazio · markdown';
    els.noteEditor.value = '';
    resetEditorHistory({ value: '', selectionStart: 0, selectionEnd: 0 });
    resetEditorSaveState('');
    renderEditorPresentation();
    els.editorStatus.textContent = 'Nenhuma nota Markdown encontrada.';
  }

  if (data.summary) {
    els.setupHint.textContent = `${data.summary.fileCount} arquivos, ${data.summary.folderCount} pastas.`;
    updateVaultSummary(data.summary);
  }
}

async function loadNote(relativePath, options = {}) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const vaultRoot = getConfiguredVaultRoot();
  const data = await api(`/api/file?vaultRoot=${encodeURIComponent(vaultRoot)}&path=${encodeURIComponent(normalizedPath)}`);
  state.selectedFile = normalizeRelativePath(data.path);
  closeEditorAssistMenu();
  setEditorTitleValue(fileLabel(state.selectedFile), { enabled: true });
  els.breadcrumbs.textContent = prettyPath(state.selectedFile);
  els.editorMeta.textContent = `${pathDirectory(state.selectedFile).replace(/\//g, ' · ')} · markdown`;
  const persistedContent = String(data.content ?? '');
  const draftContent = readEditorDraft(state.selectedFile);
  const nextContent = draftContent || persistedContent;
  els.noteEditor.value = nextContent;
  resetEditorHistory({ value: nextContent, selectionStart: 0, selectionEnd: 0 });
  resetEditorSaveState(persistedContent);
  renderEditorPresentation();
  els.editorStatus.textContent = draftContent ? `Editando ${state.selectedFile} com rascunho local.` : `Editando ${state.selectedFile}`;
  if (draftContent) {
    markEditorDirty();
  }

  document.querySelectorAll('.file-item').forEach((node) => {
    node.classList.toggle('active', node.dataset.path === state.selectedFile);
  });

  updatePinButton();
  await refreshBacklinks();
  await refreshGraph();
  await loadRelatedData();
  await loadLinkSuggestions();
  state.linkPreview = null;
  renderLinkPreview();

  if (state.view === 'relations') {
    await refreshGlobalGraph();
  }

  if (options.recordActivity) {
    recordActivity(options.kind || 'open', options.title || fileLabel(state.selectedFile), state.selectedFile);
  }
}

async function askRelativePath(message, fallback = '') {
  const value = await openInputDialog({
    eyebrow: 'Workspace',
    title: message,
    message: 'Digite um caminho relativo dentro do vault ativo.',
    label: 'Caminho',
    value: fallback,
    multiline: false
  });

  if (!value) return null;
  return String(value).replace(/\\/g, '/');
}

async function askMultiline(message, fallback = '') {
  const value = await openInputDialog({
    eyebrow: 'Conteúdo',
    title: message,
    message: 'Escreva o conteúdo inicial da nota.',
    label: 'Texto',
    value: fallback,
    multiline: true
  });

  if (value === null) return null;
  return String(value);
}

async function startVault() {
  const activeVaultRoot = getConfiguredVaultRoot();
  if (desktopBootstrapPromise && !desktopBootstrapComplete) {
    await desktopBootstrapPromise.catch(() => null);
    const resolvedVaultRoot = getConfiguredVaultRoot();
    if (resolvedVaultRoot) return;
  }

  if (isDesktopShell) {
    const requestedVaultRoot = els.vaultPathInput.value.trim() || getConfiguredVaultRoot() || getDefaultVaultPath();
    const result = await api('/api/setup', {
      method: 'POST',
      body: JSON.stringify({ action: 'open', vaultRoot: requestedVaultRoot })
    });
    await openVaultFromBootstrap(String(result.vaultRoot ?? requestedVaultRoot), { autoOpenFirstNote: true });
    els.setupHint.textContent = `Vault padrão aberto em ${getConfiguredVaultRoot()}.`;
    return;
  }

  const bootstrap = await loadDesktopBootstrap();
  const requestedVaultRoot = els.vaultPathInput.value.trim();
  const currentVaultRoot = activeVaultRoot || String(bootstrap.vaultRoot ?? '').trim() || state.defaultVaultPath || '';
  const vaultRoot = isDesktopShell
    ? String(bootstrap.vaultRoot ?? currentVaultRoot).trim()
    : (activeVaultRoot ? currentVaultRoot : (requestedVaultRoot || currentVaultRoot));

  if (!vaultRoot) {
    throw new Error('Vault padrão ainda não carregado');
  }

  const result = await api('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ action: 'open', vaultRoot })
  });

  await openVaultFromBootstrap(String(result.vaultRoot ?? vaultRoot));
  els.setupHint.textContent = `Vault padrão aberto em ${vaultRoot}.`;
}

async function ensureActiveVaultReady(actionLabel) {
  const activeVaultRoot = getConfiguredVaultRoot();
  if (activeVaultRoot) return activeVaultRoot;

  if (isDesktopShell) {
    await startVault();
    const resolvedVaultRoot = getConfiguredVaultRoot();
    if (resolvedVaultRoot) return resolvedVaultRoot;
  }

  throw new Error(`Aguarde o vault padrao terminar de abrir antes de ${actionLabel}.`);
}

function beginDesktopBootstrap() {
  if (!isDesktopShell || desktopBootstrapPromise) return;

  desktopBootstrapPromise = (async () => {
    try {
      await openDesktopDefaultVault(true);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Falha ao iniciar interface');
      sendDebugState('desktopBootstrap.error', {
        message: error instanceof Error ? error.message : 'Falha ao iniciar interface'
      });
    } finally {
      desktopBootstrapComplete = true;
      syncWorkspaceState();
    }
  })();
}

async function createFolder() {
  const vaultRoot = await ensureActiveVaultReady('criar uma pasta');
  const base = containerForSelection();
  const name = await askRelativePath('Nova pasta', 'Nova Pasta');
  if (!name) return;
  const value = makeUniqueVaultPath(base, name);
  sendDebugState('createFolder.before', { vaultRoot, path: value, base });

  await api('/api/folder', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: value })
  });

  state.selectedFolder = normalizeRelativePath(value);
  await refreshWorkspace('', false);
}

async function createNote() {
  const vaultRoot = await ensureActiveVaultReady('criar uma nota');
  const base = containerForSelection();
  const name = await askRelativePath('Nova nota', 'nova-nota');
  if (!name) return;
  const fileName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
  const pathValue = makeUniqueVaultPath(base, fileName);
  sendDebugState('createNote.before', { vaultRoot, path: pathValue, base });

  const fallbackContent = state.selectedTemplate?.content ?? '# Nova nota\n\n';
  const content = await askMultiline(
    state.selectedTemplate ? `Conteúdo inicial a partir de ${state.selectedTemplate.title}` : 'Conteúdo inicial',
    fallbackContent
  );
  if (content === null) return;
  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, path: pathValue, content, operation: 'create' })
  });

  state.selectedFolder = pathDirectory(pathValue);
  recordActivity('create', `Criada ${fileLabel(pathValue)}`, pathValue);
  await refreshWorkspace(pathValue);
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
    await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot, path: savedPath, content: submittedContent, operation: 'edit' })
    });

    const editorUnchanged = state.selectedFile === savedPath && normalizeEditorText(els.noteEditor.value) === submittedContent;

    if (editorUnchanged) {
      clearEditorDraft(savedPath);
      resetEditorHistory({ value: submittedContent, selectionStart: getEditorSelection().start, selectionEnd: getEditorSelection().end });
      resetEditorSaveState(submittedContent);
    } else if (state.selectedFile === savedPath) {
      writeEditorDraft(savedPath, els.noteEditor.value);
      markEditorDirty();
      scheduleEditorAutoSave();
    }

    if (source !== 'auto') {
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
      updateEditorToolbarPosition();
    }
  } finally {
    editorSaveState.saving = false;
  }
}

function scheduleEditorAutoSave() {
  if (!state.selectedFile) return;
  clearEditorAutoSaveTimer();
  const currentValue = normalizeEditorText(els.noteEditor.value);
  if (!currentValue.trim() || currentValue === editorSaveState.lastSavedValue) {
    editorSaveState.dirty = false;
    updateEditorDraftIndicator('Sincronizado', 'saved');
    return;
  }

  editorSaveState.autoSaveTimer = setTimeout(() => {
    if (editorAssistState.items.length > 0) {
      scheduleEditorAutoSave();
      return;
    }
    void saveNote({ source: 'auto' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha no autosave'));
  }, 2200);
}

async function renameCurrentNoteToPath(nextPath) {
  if (!state.selectedFile) return;

  const vaultRoot = getConfiguredVaultRoot();
  const destination = normalizeRelativePath(nextPath);

  await api('/api/rename', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, source: state.selectedFile, destination })
  });

  recordActivity('rename', `Renomeada ${fileLabel(destination)}`, destination);
  await refreshWorkspace(destination);
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

async function renameNote() {
  if (!state.selectedFile) return;
  const nextPath = await askRelativePath('Renomear', state.selectedFile);
  if (!nextPath) return;
  await renameCurrentNoteToPath(nextPath);
}

async function moveNote() {
  if (!state.selectedFile) return;
  const nextPath = await askRelativePath('Mover', state.selectedFile);
  if (!nextPath) return;
  const vaultRoot = getConfiguredVaultRoot();

  await api('/api/move', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, source: state.selectedFile, destination: normalizeRelativePath(nextPath) })
  });

  recordActivity('move', `Movida ${fileLabel(nextPath)}`, nextPath);
  await refreshWorkspace(normalizeRelativePath(nextPath));
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

async function deleteSelectedWorkspaceEntry() {
  const target = getWorkspaceDeleteTarget();
  if (!target) return;

  if (target.kind === 'folder' && isProtectedAgendaFolderPath(target.path)) {
    showError('A pasta Agenda e fixa e nao pode ser apagada.');
    return;
  }

  const confirmed = await openConfirmDialog({
    eyebrow: 'Excluir',
    title: target.kind === 'folder' ? 'Apagar pasta' : 'Apagar nota',
    message: target.kind === 'folder'
      ? `Tem certeza que quer apagar ${prettyPath(target.path)}? Todo o conteudo dentro dessa pasta tambem sera apagado.`
      : `Tem certeza que quer apagar ${prettyPath(target.path)}?`,
    confirmLabel: 'Apagar'
  });
  if (!confirmed) return;

  const vaultRoot = await ensureActiveVaultReady('apagar um item');
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
  openAiDialog();
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
els.desktopCommandsButton.addEventListener('click', openCommandsDialog);
els.templatesButton.addEventListener('click', () => { openTemplatesDialog().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir modelos')); });
els.dailyNoteButton.addEventListener('click', () => { openDailyNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota diária')); });
els.desktopSearchButton.addEventListener('click', openSearchDialog);
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
      openCommandsDialog();
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
  if (action === 'move-note') void moveNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao mover'));
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
els.editorAssistList?.addEventListener('mousedown', (event) => {
  event.preventDefault();
});
els.editorAssistList?.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-index]') : null;
  if (!(target instanceof HTMLElement)) return;
  const index = Number(target.dataset.index ?? '-1');
  if (!Number.isInteger(index) || index < 0) return;
  editorAssistState.activeIndex = index;
  applyActiveEditorAssistItem();
});
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
els.commandsDialogClose.addEventListener('click', closeCommandsDialog);
els.commandsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeCommandsDialog();
});
els.guideDialogClose.addEventListener('click', closeGuideDialog);
els.guideDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeGuideDialog();
});
els.searchDialogClose.addEventListener('click', closeSearchDialog);
els.searchDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeSearchDialog();
});
els.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runSearch().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao buscar'));
});
els.searchClearButton.addEventListener('click', () => {
  els.searchQueryInput.value = '';
  els.searchPhraseInput.value = '';
  els.searchTagsInput.value = '';
  renderSearchResults([]);
});
els.searchResultsList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void openSearchResult(path);
});
els.linkPickerDialogClose.addEventListener('click', closeLinkPickerDialog);
els.linkPickerDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeLinkPickerDialog();
});
els.linkPickerDialogQuery.addEventListener('input', () => renderLinkPickerDialog());
els.linkPickerDialogList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;

  const targetPath = target.dataset.path;
  const targetLabel = target.dataset.label ?? '';
  if (!targetPath) return;

  closeLinkPickerDialog();
  void insertLinkToCurrentNote(targetPath, targetLabel).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao linkar nota'));
});
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
els.graphGlobalStage.addEventListener('pointerdown', (event) => {
  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  if (node || cluster) return;

  graphGlobalScene.hoverPath = '';
  graphGlobalScene.hoverCluster = '';
  graphGlobalScene.dragging = true;
  graphGlobalScene.moved = false;
  graphGlobalScene.startX = event.clientX;
  graphGlobalScene.startY = event.clientY;
  startIslandGlobalGraphDrag(event.clientX, event.clientY);
  els.graphGlobalStage.setPointerCapture(event.pointerId);
});
els.graphGlobalStage.addEventListener('pointermove', (event) => {
  if (graphGlobalViewport.dragging) {
    const dx = Math.abs(event.clientX - graphGlobalScene.startX);
    const dy = Math.abs(event.clientY - graphGlobalScene.startY);
    if (dx > 2 || dy > 2) {
      graphGlobalScene.moved = true;
    }
    moveIslandGlobalGraphDrag(event.clientX, event.clientY);
    return;
  }

  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  const path = node?.dataset.path || '';
  const clusterKey = node ? '' : (cluster?.dataset.cluster || '');
  if (path !== graphGlobalScene.hoverPath || clusterKey !== graphGlobalScene.hoverCluster) {
    graphGlobalScene.hoverPath = path;
    graphGlobalScene.hoverCluster = clusterKey;
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }
});
els.graphGlobalStage.addEventListener('pointerleave', () => {
  graphGlobalScene.hoverPath = '';
  graphGlobalScene.hoverCluster = '';
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
});
els.graphGlobalStage.addEventListener('pointerup', () => {
  graphGlobalScene.dragging = false;
  graphGlobalScene.moved = false;
  stopIslandGlobalGraphDrag();
});
els.graphGlobalStage.addEventListener('pointercancel', () => {
  graphGlobalScene.dragging = false;
  graphGlobalScene.moved = false;
  stopIslandGlobalGraphDrag();
});
els.graphGlobalStage.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  zoomIslandGlobalGraph(delta);
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
}, { passive: false });
els.graphGlobalStage.addEventListener('dblclick', (event) => {
  if (getIslandGlobalGraphNode(event.target) || getIslandGlobalGraphCluster(event.target)) return;
  resetIslandGlobalGraphViewport();
  renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
});
els.graphGlobalSphere.addEventListener('click', (event) => {
  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  if (graphGlobalScene.moved) return;

  if (node?.dataset.path) {
    focusIslandGlobalGraphNode(node.dataset.path);
    return;
  }

  if (cluster?.dataset.cluster !== undefined) {
    focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
  }
});
els.graphGlobalSphere.addEventListener('pointerover', (event) => {
  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  const path = node?.dataset.path || '';
  const clusterKey = node ? '' : (cluster?.dataset.cluster || '');
  if (path !== graphGlobalScene.hoverPath || clusterKey !== graphGlobalScene.hoverCluster) {
    graphGlobalScene.hoverPath = path;
    graphGlobalScene.hoverCluster = clusterKey;
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }
});
els.graphGlobalSphere.addEventListener('pointerout', (event) => {
  const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.graph-global-node') : null;
  const relatedCluster = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.graph-global-cluster-hit') : null;
  if (related || relatedCluster) return;
  if (!graphGlobalViewport.dragging && (graphGlobalScene.hoverPath || graphGlobalScene.hoverCluster)) {
    graphGlobalScene.hoverPath = '';
    graphGlobalScene.hoverCluster = '';
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }
});
els.graphGlobalSphere.addEventListener('dblclick', (event) => {
  const node = getIslandGlobalGraphNode(event.target);
  if (!node || graphGlobalScene.moved) return;

  const selected = (graphGlobalScene.lastGraph?.nodes ?? []).find((entry) => entry.path === node.dataset.path);
  openGlobalGraphNode(selected ?? null);
});
els.graphGlobalSphere.addEventListener('contextmenu', (event) => {
  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  if (!node && !cluster) return;

  event.preventDefault();
  if (node?.dataset.path) {
    focusIslandGlobalGraphNode(node.dataset.path);
    return;
  }
  if (cluster?.dataset.cluster !== undefined) {
    focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
  }
});
els.graphGlobalSphere.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const node = getIslandGlobalGraphNode(event.target);
  const cluster = getIslandGlobalGraphCluster(event.target);
  if (!node && !cluster) return;

  event.preventDefault();
  if (node?.dataset.path) {
    focusIslandGlobalGraphNode(node.dataset.path);
    return;
  }

  if (cluster?.dataset.cluster !== undefined) {
    focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
  }
});
els.graphGlobalOverlay?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (event.target instanceof HTMLElement && event.target.closest('button')) return;
  const node = getGraphGlobalOverlayNode();
  if (!node?.path) return;
  focusIslandGlobalGraphNode(node.path);
});
els.graphGlobalOverlay?.addEventListener('dblclick', (event) => {
  event.stopPropagation();
  const node = getGraphGlobalOverlayNode();
  if (!node) return;
  openGlobalGraphNode(node);
});
els.graphGlobalOverlayOpenButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const node = getGraphGlobalOverlayNode();
  if (!node) return;
  openGlobalGraphNode(node);
});
els.graphGlobalOverlayFocusButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const node = getGraphGlobalOverlayNode();
  if (!node?.path) return;
  focusIslandGlobalGraphNode(node.path);
});
els.templatesDialogClose.addEventListener('click', () => els.templatesDialog.close());
els.templatesDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  els.templatesDialog.close();
});
els.templatesDialogList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-index]') : null;
  if (!(target instanceof HTMLElement)) return;
  applyTemplateSelection(Number(target.dataset.index ?? '0'));
});
els.templateSelectionClear?.addEventListener('click', () => setSelectedTemplate(null));
els.templatePickerClose.addEventListener('click', () => els.templatePickerDialog.close());
els.templatePickerConfirm.addEventListener('click', () => { confirmTemplateSave().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao salvar modelo')); });
els.templatePickerDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  els.templatePickerDialog.close();
});
els.templatePickerSelect.addEventListener('change', () => {
  const index = els.templatePickerSelect.value.trim();
  const baseTemplate = index === '' ? null : state.templates[Number(index)] ?? null;
  els.templatePickerContent.value = baseTemplate?.content ?? els.noteEditor.value ?? '';
});
els.aiDialogClose.addEventListener('click', closeAiDialog);
els.overviewOptionsButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleOverviewOptionsMenu();
});
els.agendaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopPropagation();
  sendDebugState('agenda.submit', {
    title: String(els.agendaTitleInput.value ?? ''),
    due: String(els.agendaDueInput.value ?? ''),
    status: String(els.agendaStatusInput.value ?? '')
  });
  void createAgendaNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota com data'));
});
els.desktopNotificationClose?.addEventListener('click', hideDesktopNotification);
els.desktopNotificationAction?.addEventListener('click', () => {
  hideDesktopNotification();
  setView('agenda');
  void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
});
els.agendaCreateButton.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  sendDebugState('agenda.button.click', {
    title: String(els.agendaTitleInput.value ?? ''),
    due: String(els.agendaDueInput.value ?? ''),
    status: String(els.agendaStatusInput.value ?? '')
  });
  void createAgendaNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota com data'));
});
document.addEventListener('keydown', (event) => {
  if (!canHandleWorkspaceDeleteShortcut(event)) return;
  if (!getWorkspaceDeleteTarget()) return;
  event.preventDefault();
  void deleteSelectedWorkspaceEntry().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao apagar item'));
});
els.agendaResetButton.addEventListener('click', () => {
  els.agendaTitleInput.value = '';
  els.agendaBodyInput.value = '';
  els.agendaStatusInput.value = 'pending';
  els.agendaDueInput.value = formatAgendaInputValue(new Date(Date.now() + (60 * 60 * 1000)));
});
els.agendaOptionsButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleAgendaOptionsMenu();
});
els.agendaOptionsPanel.addEventListener('click', (event) => {
  event.stopPropagation();
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-agenda-action], [data-agenda-filter]') : null;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.agendaAction;
  const filter = target.dataset.agendaFilter;

  if (action === 'refresh') {
    closeAgendaOptionsMenu();
    void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar agenda'));
    return;
  }

  if (action === 'focus-form') {
    closeAgendaOptionsMenu();
    els.agendaTitleInput.focus();
    return;
  }

  if (filter) {
    state.agendaFilter = filter;
    closeAgendaOptionsMenu();
    renderAgendaList();
  }
});
els.agendaList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  const item = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(item instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
  const pathValue = item.dataset.path;
  const action = target.dataset.action;
  const agendaItem = state.agendaItems.find((entry) => entry.path === pathValue);
  if (!pathValue || !agendaItem) return;
  if (action === 'open') void openAgendaItem(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota da agenda'));
  if (action === 'toggle') void toggleAgendaItemStatus(pathValue, agendaItem.status).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar status'));
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
  if (state.selectedFile && !editorHistoryState.applying) {
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
state.agendaReminderKeys = loadAgendaReminderKeys();
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
window.addEventListener('resize', () => {
  applyAiLauncherPosition(aiLauncherState.offsetX, aiLauncherState.offsetY);
  if (state.view === 'relations') {
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }
});

window.addEventListener('marika:agenda-saved', (event) => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (detail?.path) {
    void refreshAfterVaultChange(detail).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  }
});

if (window.marikaDesktop && typeof window.marikaDesktop.onAgendaSaved === 'function') {
  window.marikaDesktop.onAgendaSaved((payload) => {
    if (!payload?.path) return;
    void refreshAfterVaultChange(payload).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  });
}

if (window.marikaDesktop && typeof window.marikaDesktop.onVaultChanged === 'function') {
  window.marikaDesktop.onVaultChanged((payload) => {
    void refreshAfterVaultChange(payload).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar vault'));
  });
}

if (window.marikaDesktop && typeof window.marikaDesktop.onOpenAgendaFromNotification === 'function') {
  window.marikaDesktop.onOpenAgendaFromNotification(() => {
    setView('agenda');
    void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar agenda'));
  });
}


if (!localStorage.getItem('marika-ai-popup-seen')) {
  setTimeout(() => {
    if (state.view === 'setup') {
      openAiDialog();
      localStorage.setItem('marika-ai-popup-seen', 'true');
    }
  }, 400);
}
