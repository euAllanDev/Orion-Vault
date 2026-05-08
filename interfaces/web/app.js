const state = {
  view: 'setup',
  vaultPath: '',
  selectedFile: '',
  selectedFolder: '',
  tree: null,
  pinnedPaths: [],
  backlinks: [],
  templates: [],
  selectedTemplate: null,
  summaryMode: 'overview',
  graphContext: { kind: 'note', path: '' },
  graph: { scope: 'note', nodes: [], edges: [] }
};

const setupHints = {
  valid: 'O vault está pronto para inspeção e organização.',
  invalid: 'O caminho informado não é seguro ou está fora da fronteira.'
};

const els = {
  viewButtons: [...document.querySelectorAll('.rail-btn')],
  setupView: document.getElementById('setupView'),
  workspaceView: document.getElementById('workspaceView'),
  pageTitle: document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  vaultPathInput: document.getElementById('vaultPathInput'),
  desktopCommandsButton: document.getElementById('desktopCommandsButton'),
  templatesButton: document.getElementById('templatesButton'),
  dailyNoteButton: document.getElementById('dailyNoteButton'),
  desktopSearchButton: document.getElementById('desktopSearchButton'),
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
  createVaultButton: document.getElementById('createVaultButton'),
  openVaultButton: document.getElementById('openVaultButton'),
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
  setupHint: document.getElementById('setupHint'),
  folderBreadcrumb: document.getElementById('folderBreadcrumb'),
  tree: document.getElementById('tree'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  noteTitle: document.getElementById('noteTitle'),
  editorMeta: document.querySelector('.editor-meta'),
  noteEditor: document.getElementById('noteEditor'),
  editorStatus: document.getElementById('editorStatus'),
  workspaceEmpty: document.getElementById('workspaceEmpty'),
  emptyCreateVaultButton: document.getElementById('emptyCreateVaultButton'),
  emptyOpenVaultButton: document.getElementById('emptyOpenVaultButton'),
  quickMenu: document.getElementById('quickMenu'),
  folderContextMenu: document.getElementById('folderContextMenu'),
  inputDialog: document.getElementById('inputDialog'),
  inputDialogEyebrow: document.getElementById('inputDialogEyebrow'),
  inputDialogTitle: document.getElementById('inputDialogTitle'),
  inputDialogMessage: document.getElementById('inputDialogMessage'),
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
  templatesDialog: document.getElementById('templatesDialog'),
  templatesDialogClose: document.getElementById('templatesDialogClose'),
  templatesDialogList: document.getElementById('templatesDialogList'),
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
  aiLauncher: document.getElementById('aiLauncher'),
  pinnedList: document.getElementById('pinnedList'),
  backlinksList: document.getElementById('backlinksList'),
  projectSlideTag: document.getElementById('projectSlideTag'),
  projectSlideTitle: document.getElementById('projectSlideTitle'),
  projectSlideBody: document.getElementById('projectSlideBody'),
  projectSlideDots: document.getElementById('projectSlideDots')
};

const desktopCommands = [
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

function pathDirectory(relativePath) {
  const parts = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function containerForSelection() {
  if (state.selectedFolder) return state.selectedFolder;
  if (state.selectedFile) return pathDirectory(state.selectedFile);
  return '';
}

function prettyPath(relativePath) {
  return normalizeRelativePath(relativePath).replace(/\//g, ' / ');
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
  els.workspaceView.classList.toggle('active', view === 'workspace');
  document.body.dataset.view = view;

  if (view === 'setup') {
    els.pageTitle.textContent = 'Overview';
    els.pageSubtitle.textContent = 'Welcome back to your vault.';
    els.vaultPathInput.placeholder = 'Search vault...';
  } else {
    els.pageTitle.textContent = 'Workspace';
    els.pageSubtitle.textContent = 'Árvore de arquivos, editor central e painel auxiliar.';
    els.vaultPathInput.placeholder = 'C:\\MarikaVault';
  }

  syncWorkspaceState();
}

function updateVault(value) {
  state.vaultPath = value;
  const valid = isValidVaultPath(value);
  els.vaultName.textContent = vaultNameFromPath(value);
  els.vaultRootDisplay.textContent = value || 'Não selecionado';
  els.vaultStateText.textContent = valid ? 'válido' : 'inválido';
  els.setupHint.textContent = valid ? setupHints.valid : setupHints.invalid;
}

function showError(message) {
  els.setupHint.textContent = message;
  els.editorStatus.textContent = message;
  if (els.aiDialogStatus) {
    els.aiDialogStatus.textContent = message;
  }
}

function closeAiDialog() {
  els.aiDialog.classList.add('hidden');
  els.aiDialog.setAttribute('aria-hidden', 'true');
  els.aiDialogCommandsPanel.classList.add('hidden');
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
  localStorage.setItem('marika-ai-popup-seen', 'true');
  closeAiDialog();
  els.aiDialogCommand.textContent = [
    '/guide',
    `/context ${vault}`,
    `/search "arquitetura local"`,
    '/plan',
    '/preview',
    '/apply'
  ].join('\n');
  els.aiDialogStatus.textContent = 'Comece por /guide para ver os comandos e /context para ler o vault ativo.';
  els.aiDialog.classList.remove('hidden');
  els.aiDialog.setAttribute('aria-hidden', 'false');
}

function getActiveVaultPath() {
  return state.vaultPath || els.vaultPathInput.value.trim() || 'C:\\MarikaVault';
}

async function openAiTerminal() {
  const vaultRoot = getActiveVaultPath();
  const bridge = window.marikaDesktop;
  if (!bridge || typeof bridge.openAiTerminal !== 'function') {
    throw new Error('Bridge do desktop indisponível');
  }

  els.aiDialogStatus.textContent = `Abrindo terminal do app com vault ${vaultRoot}...`;
  await bridge.openAiTerminal(vaultRoot);
  els.aiDialogStatus.textContent = `Terminal aberto na raiz do app com vault ${vaultRoot}.`;
  els.setupHint.textContent = `Terminal da IA aberto na raiz do app com vault ${vaultRoot}. Use /guide, /context, /search, /plan, /preview e /apply.`;
}

function applyAiLauncherPosition(left, top) {
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
  const current = nodes.find((node) => node.kind === 'current' || node.kind === 'folder') ?? nodes[0];
  const centerParts = current.path ? current.path.split('/').filter(Boolean) : [];
  const positions = new Map([[current.id, center]]);
  const levels = new Map();

  const getLevel = (node) => {
    if (node.id === current.id) return 0;
    if (graph.scope === 'folder') {
      const nodeFolderDepth = node.kind === 'folder'
        ? node.path.split('/').filter(Boolean).length - centerParts.length
        : Math.max(1, node.path.split('/').filter(Boolean).length - centerParts.length);
      return Math.max(1, nodeFolderDepth);
    }
    return 1;
  };

  for (const node of nodes) {
    const level = getLevel(node);
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level).push(node);
  }

  const sortedLevels = [...levels.keys()].sort((left, right) => left - right);

  for (const level of sortedLevels) {
    if (level === 0) continue;
    const ringNodes = levels.get(level) ?? [];
    const baseRadius = graph.scope === 'folder' ? 70 + ((level - 1) * 54) : 112;
    const arranged = ringNodes.sort((left, right) => {
      if (left.kind === right.kind) return left.label.localeCompare(right.label, 'pt-BR');
      return left.kind === 'folder' ? -1 : 1;
    });

    arranged.forEach((node, index) => {
      const angle = (index / Math.max(1, arranged.length)) * Math.PI * 2 - Math.PI / 2 + (level * 0.22);
      const wobble = level % 2 === 0 ? 14 : -10;
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * (baseRadius + wobble),
        y: center.y + Math.sin(angle) * (baseRadius - wobble)
      });
    });
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

  await loadNote(relativePath);
}

async function loadPinnedPaths() {
  const data = await api('/api/pins');
  state.pinnedPaths = (data.pinnedPaths ?? []).map((value) => normalizeRelativePath(String(value)));
  renderPinnedList();
  updatePinButton();
}

async function refreshBacklinks() {
  if (!state.vaultPath || !state.selectedFile) {
    state.backlinks = [];
    renderBacklinksList();
    return;
  }

  const params = new URLSearchParams({ vaultRoot: state.vaultPath, path: state.selectedFile });
  const data = await api(`/api/backlinks?${params.toString()}`);
  state.backlinks = data.backlinks ?? [];
  renderBacklinksList();
}

async function refreshGraph() {
  if (!state.vaultPath) {
    state.graph = { scope: 'note', nodes: [], edges: [] };
    renderGraph(state.graph);
    return;
  }

  const params = new URLSearchParams({ vaultRoot: state.vaultPath });
  if (state.graphContext.kind === 'folder') {
    params.set('folderPath', state.graphContext.path);
  } else if (state.selectedFile) {
    params.set('path', state.selectedFile);
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

async function loadTemplates() {
  if (!state.vaultPath) {
    state.templates = [];
    return;
  }

  const params = new URLSearchParams({ vaultRoot: state.vaultPath });
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
  if (!state.vaultPath) {
    showError('Abra ou crie um vault antes de buscar.');
    return;
  }

  const query = els.searchQueryInput.value.trim();
  const phrase = els.searchPhraseInput.value.trim();
  const tags = els.searchTagsInput.value.trim();

  searchState.query = query;
  searchState.phrase = phrase;
  searchState.tags = tags;

  const searchParams = new URLSearchParams({ vaultRoot: state.vaultPath });
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
}

function renderProjectSlide() {
  const slide = projectSlides[projectSlideIndex % projectSlides.length];
  els.projectSlideTag.textContent = slide.tag;
  els.projectSlideTitle.textContent = slide.title;
  els.projectSlideBody.textContent = slide.body;
  els.projectSlideDots.innerHTML = projectSlides.map((_, index) => `<span class="${index === projectSlideIndex ? 'active' : ''}"></span>`).join('');
}

function startProjectSlide() {
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
    els.inputDialogEyebrow.textContent = eyebrow;
    els.inputDialogTitle.textContent = title;
    els.inputDialogMessage.textContent = message;
    els.inputDialogFieldLabel.textContent = label;
    els.inputDialogInput.value = value;
    els.inputDialogTextarea.value = value;
    els.inputDialogInput.hidden = multiline;
    els.inputDialogTextarea.hidden = !multiline;

    const cleanup = () => {
      els.inputDialog.removeEventListener('cancel', onCancel);
      els.inputDialogConfirm.removeEventListener('click', onConfirm);
      els.inputDialogCancel.removeEventListener('click', onCancelClick);
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

    els.inputDialog.addEventListener('cancel', onCancel, { once: true });
    els.inputDialogConfirm.addEventListener('click', onConfirm, { once: true });
    els.inputDialogCancel.addEventListener('click', onCancelClick, { once: true });
    els.inputDialog.showModal();
    if (multiline) {
      els.inputDialogTextarea.focus();
    } else {
      els.inputDialogInput.focus();
    }
  });
}

async function openVaultFromBootstrap(vaultRoot) {
  state.vaultPath = vaultRoot;
  els.vaultPathInput.value = vaultRoot;
  updateVault(vaultRoot);
  setView('workspace');
  syncWorkspaceState();

  try {
    await refreshWorkspace();
    await loadPinnedPaths();
    await loadTemplates();
  } catch (error) {
    setView('setup');
    state.vaultPath = '';
    showError(error instanceof Error ? error.message : 'Falha ao carregar vault ativo');
  }
}

async function openSearchResult(relativePath) {
  closeSearchDialog();
  setView('workspace');
  try {
    await loadNote(relativePath);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Falha ao abrir resultado');
  }
}

function closeMenus() {
  els.quickMenu.classList.remove('open');
  els.folderContextMenu.classList.remove('open');
  els.noteOptionsMenu?.classList.add('hidden');
  els.noteOptionsButton?.setAttribute('aria-expanded', 'false');
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
  const active = Boolean(state.vaultPath);
  els.workspaceEmpty.classList.toggle('active', state.view === 'workspace' && !active);
  els.workspaceView.querySelector('.workspace-layout').classList.toggle('active', state.view === 'workspace' && active);

  const disabled = !active;
  [els.newNoteButton, els.newFolderButton, els.saveButton, els.templatesButton, els.dailyNoteButton, els.desktopSearchButton, els.summaryOverviewButton, els.summaryGraphButton, els.noteOptionsButton].forEach((button) => {
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

  const renderEntry = (entry, container) => {
    if (entry.kind === 'folder') {
      const folder = folderTemplate.content.firstElementChild.cloneNode(true);
      const folderPath = normalizeRelativePath(entry.relativePath);
      folder.dataset.path = folderPath;
      const nameSpan = folder.querySelector('.folder-name');
      const countSpan = folder.querySelector('.folder-count');
      nameSpan.textContent = entry.name;
      countSpan.textContent = `${entry.children?.length ?? 0} itens`;

      const summary = folder.querySelector('summary');
      const caret = document.createElement('span');
      caret.className = 'folder-caret';
      caret.textContent = '▸';
      const nameWrap = document.createElement('span');
      nameWrap.className = 'folder-name-wrap';
      nameWrap.append(caret, nameSpan);
      summary.textContent = '';
      summary.append(nameWrap, countSpan);

      const items = folder.querySelector('.folder-items');
      folder.querySelector('summary').addEventListener('click', () => selectFolder(folderPath));
      folder.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showFolderContextMenu(folderPath, event.clientX, event.clientY);
      });
      const children = sortEntries(entry.children ?? []);
      const childFolders = children.filter((child) => child.kind === 'folder');
      const childFiles = children.filter((child) => child.kind === 'file' && child.name.toLowerCase().endsWith('.md'));

      if (childFolders.length > 0) {
        const section = document.createElement('div');
        section.className = 'folder-section';
        section.innerHTML = '<span class="folder-section-label">Pastas</span>';
        const sectionList = document.createElement('div');
        sectionList.className = 'folder-section-list';

        for (const child of childFolders) {
          renderEntry(child, sectionList);
        }

        section.appendChild(sectionList);
        items.appendChild(section);
      }

      if (childFolders.length > 0 && childFiles.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'folder-divider';
        items.appendChild(divider);
      }

      if (childFiles.length > 0) {
        const section = document.createElement('div');
        section.className = 'folder-section';
        section.innerHTML = '<span class="folder-section-label">Notas</span>';
        const sectionList = document.createElement('div');
        sectionList.className = 'folder-section-list';

        for (const child of childFiles) {
          renderEntry(child, sectionList);
        }

        section.appendChild(sectionList);
        items.appendChild(section);
      }

      for (const child of children) {
        if (child.kind === 'folder' || (child.kind === 'file' && child.name.toLowerCase().endsWith('.md'))) {
          continue;
        }
        renderEntry(child, items);
      }

      container.appendChild(folder);
      return;
    }

    if (!entry.name.toLowerCase().endsWith('.md')) return;

    const filePath = normalizeRelativePath(entry.relativePath);
    const file = fileTemplate.content.firstElementChild.cloneNode(true);
    file.dataset.path = filePath;
    file.querySelector('.file-name').textContent = fileLabel(filePath);
    file.querySelector('.file-meta').textContent = '';
    file.classList.toggle('active', filePath === state.selectedFile);
    file.title = filePath;
    file.addEventListener('click', () => loadNote(filePath));
    container.appendChild(file);
  };

  for (const child of tree?.children ?? []) {
    renderEntry(child, els.tree);
  }
}

async function refreshWorkspace(preferredPath = state.selectedFile, autoOpenFirstNote = true) {
  if (!state.vaultPath) {
    els.tree.innerHTML = '';
    state.selectedFile = '';
    state.selectedFolder = '';
    els.noteTitle.textContent = 'Nenhuma nota';
    els.breadcrumbs.textContent = 'Vault / vazio';
    els.editorMeta.textContent = 'Vault · vazio · markdown';
    els.noteEditor.value = '';
    els.editorStatus.textContent = 'Selecione ou crie um vault primeiro.';
    els.folderBreadcrumb.textContent = 'Nenhuma pasta selecionada';
    return;
  }

  const data = await api(`/api/workspace?vaultRoot=${encodeURIComponent(state.vaultPath)}`);
  state.tree = data.tree;
  renderTree(data.tree);

  if (preferredPath) {
    state.selectedFolder = pathDirectory(preferredPath) || state.selectedFolder;
  } else if (!state.selectedFolder) {
    state.selectedFolder = '';
  }

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
      els.noteTitle.textContent = 'Nenhuma nota';
      els.breadcrumbs.textContent = 'Vault / vazio';
      els.editorMeta.textContent = 'Vault · vazio · markdown';
      els.noteEditor.value = '';
      els.editorStatus.textContent = 'Nenhuma nota Markdown encontrada.';
    }
  } else {
    state.selectedFile = '';
    els.noteTitle.textContent = 'Nenhuma nota';
    els.breadcrumbs.textContent = 'Vault / vazio';
    els.editorMeta.textContent = 'Vault · vazio · markdown';
    els.noteEditor.value = '';
    els.editorStatus.textContent = 'Nenhuma nota Markdown encontrada.';
  }

  if (data.summary) {
    els.setupHint.textContent = `${data.summary.fileCount} arquivos, ${data.summary.folderCount} pastas.`;
    updateVaultSummary(data.summary);
  }
}

async function loadNote(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const data = await api(`/api/file?vaultRoot=${encodeURIComponent(state.vaultPath)}&path=${encodeURIComponent(normalizedPath)}`);
  state.selectedFile = normalizeRelativePath(data.path);
  state.selectedFolder = pathDirectory(state.selectedFile);
  els.noteTitle.textContent = fileLabel(state.selectedFile);
  els.breadcrumbs.textContent = prettyPath(state.selectedFile);
  els.editorMeta.textContent = `${pathDirectory(state.selectedFile).replace(/\//g, ' · ')} · markdown`;
  els.noteEditor.value = data.content;
  els.editorStatus.textContent = `Editando ${state.selectedFile}`;
  selectFolder(state.selectedFolder, 'note');

  document.querySelectorAll('.file-item').forEach((node) => {
    node.classList.toggle('active', node.dataset.path === state.selectedFile);
  });

  updatePinButton();
  await refreshBacklinks();
  await refreshGraph();
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

async function activateVault(mode) {
  let vaultRoot = els.vaultPathInput.value.trim();

  if (!vaultRoot) {
    vaultRoot = 'C:\\MarikaVault';
    els.vaultPathInput.value = vaultRoot;
    els.setupHint.textContent = 'Usando o caminho padrão do vault.';
  }

  const valid = isValidVaultPath(vaultRoot);
  updateVault(vaultRoot);
  if (!valid) return;

  const result = await api('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot, action: mode })
  });

  state.vaultPath = result.vaultRoot;
  els.setupHint.textContent = mode === 'create'
    ? `Vault preparado em ${result.vaultRoot}.`
    : `Vault aberto em ${result.vaultRoot}.`;
  setView('workspace');
  syncWorkspaceState();
  await refreshWorkspace();
  await loadPinnedPaths();
  await loadTemplates();
}

async function createFolder() {
  const base = containerForSelection();
  const name = await askRelativePath('Nova pasta', 'Nova Pasta');
  if (!name) return;
  const value = joinRelativePath(base, name);

  await api('/api/folder', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, path: value })
  });

  state.selectedFolder = normalizeRelativePath(value);
  await refreshWorkspace('', false);
}

async function createNote() {
  const base = containerForSelection();
  const name = await askRelativePath('Nova nota', 'nova-nota');
  if (!name) return;
  const fileName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
  const pathValue = joinRelativePath(base, fileName);

  const fallbackContent = state.selectedTemplate?.content ?? '# Nova nota\n\n';
  const content = await askMultiline(
    state.selectedTemplate ? `Conteúdo inicial a partir de ${state.selectedTemplate.title}` : 'Conteúdo inicial',
    fallbackContent
  );
  if (content === null) return;
  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, path: pathValue, content, operation: 'create' })
  });

  state.selectedFolder = pathDirectory(pathValue);
  await refreshWorkspace(pathValue);
}

async function saveCurrentAsTemplate() {
  if (!state.selectedFile) return;

  await openTemplatePickerDialog();
}

async function confirmTemplateSave() {
  const templateName = els.templatePickerInput.value.trim();
  if (!templateName) return;

  const baseIndex = els.templatePickerSelect.value.trim();
  const baseTemplate = baseIndex === '' ? null : state.templates[Number(baseIndex)] ?? null;
  const templatePath = joinRelativePath('Templates', templateName.toLowerCase().endsWith('.md') ? templateName : `${templateName}.md`);
  const content = els.templatePickerContent.value || baseTemplate?.content || els.noteEditor.value || '';

  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, path: templatePath, content, operation: 'create' })
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
  if (!state.vaultPath) return;

  const data = await api(`/api/daily?vaultRoot=${encodeURIComponent(state.vaultPath)}`);
  setView('workspace');
  await refreshWorkspace(data.path);
}

async function saveNote() {
  if (!state.selectedFile) return;

  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, path: state.selectedFile, content: els.noteEditor.value, operation: 'edit' })
  });

  els.editorStatus.textContent = `Salvo em ${state.selectedFile}`;
  await refreshWorkspace(state.selectedFile);
}

async function renameNote() {
  if (!state.selectedFile) return;
  const nextPath = await askRelativePath('Renomear', state.selectedFile);
  if (!nextPath) return;

  await api('/api/rename', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, source: state.selectedFile, destination: normalizeRelativePath(nextPath) })
  });

  await refreshWorkspace(normalizeRelativePath(nextPath));
}

async function moveNote() {
  if (!state.selectedFile) return;
  const nextPath = await askRelativePath('Mover', state.selectedFile);
  if (!nextPath) return;

  await api('/api/move', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, source: state.selectedFile, destination: normalizeRelativePath(nextPath) })
  });

  await refreshWorkspace(normalizeRelativePath(nextPath));
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

    setView(button.dataset.view === 'setup' ? 'setup' : 'workspace');
  });
});

els.vaultPathInput.addEventListener('input', (event) => updateVault(event.target.value));
document.getElementById('sidebarNewNoteButton')?.addEventListener('click', () => {
  void createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota'));
});
els.aiLauncher.addEventListener('click', onAiLauncherActivate);
els.aiLauncher.addEventListener('pointerdown', (event) => {
  aiLauncherState.dragging = true;
  aiLauncherState.moved = false;
  aiLauncherState.startX = event.clientX;
  aiLauncherState.startY = event.clientY;
  els.aiLauncher.setPointerCapture(event.pointerId);
});
els.aiLauncher.addEventListener('pointermove', (event) => {
  if (!aiLauncherState.dragging) return;
  const dx = event.clientX - aiLauncherState.startX;
  const dy = event.clientY - aiLauncherState.startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    aiLauncherState.moved = true;
    applyAiLauncherPosition(aiLauncherState.offsetX + dx, aiLauncherState.offsetY + dy);
  }
});
els.aiLauncher.addEventListener('pointerup', () => {
  if (aiLauncherState.dragging && aiLauncherState.moved) {
    persistAiLauncherPosition();
    aiLauncherState.suppressClick = true;
  }
  aiLauncherState.dragging = false;
});
els.aiLauncher.addEventListener('pointercancel', () => {
  aiLauncherState.dragging = false;
  aiLauncherState.moved = false;
  aiLauncherState.suppressClick = false;
});
els.desktopCommandsButton.addEventListener('click', openCommandsDialog);
els.templatesButton.addEventListener('click', () => { openTemplatesDialog().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir modelos')); });
els.dailyNoteButton.addEventListener('click', () => { openDailyNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota diária')); });
els.desktopSearchButton.addEventListener('click', openSearchDialog);
els.createVaultButton.addEventListener('click', () => { activateVault('create').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar vault')); });
els.openVaultButton.addEventListener('click', () => { activateVault('open').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir vault')); });
els.openWorkspaceButton.addEventListener('click', () => setView('workspace'));
els.emptyCreateVaultButton.addEventListener('click', () => { activateVault('create').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar vault')); });
els.emptyOpenVaultButton.addEventListener('click', () => { activateVault('open').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir vault')); });
document.querySelectorAll('[data-quick-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-quick-action');
    if (action === 'create-note') {
      void createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota'));
      return;
    }
    if (action === 'graph') {
      setView('workspace');
      setSummaryMode('graph');
      return;
    }
    if (action === 'commands') {
      openCommandsDialog();
    }
  });
});
els.newNoteButton.addEventListener('click', () => { createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota')); });
els.newFolderButton.addEventListener('click', () => { createFolder().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar pasta')); });
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
document.addEventListener('click', () => closeMenus());
document.addEventListener('contextmenu', (event) => {
  if (!els.folderContextMenu.classList.contains('open')) return;
  if (event.target instanceof Node && !els.folderContextMenu.contains(event.target)) {
    closeMenus();
  }
});
els.saveButton.addEventListener('click', () => { saveNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao salvar nota')); });
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
  if (path) void loadNote(path);
});
els.backlinksList.addEventListener('click', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
  if (!(target instanceof HTMLElement)) return;
  const path = target.dataset.path;
  if (path) void loadNote(path);
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
els.templateSelectionClear.addEventListener('click', () => setSelectedTemplate(null));
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
els.noteEditor.addEventListener('input', () => {
  els.editorStatus.textContent = 'Alterações não salvas.';
});

updateVault(state.vaultPath);
setView('setup');
syncWorkspaceState();
setSummaryMode('overview');
startProjectSlide();
updateVaultSummary(null);
restoreAiLauncherPosition();
window.addEventListener('resize', () => {
  applyAiLauncherPosition(aiLauncherState.offsetX, aiLauncherState.offsetY);
});

if (!localStorage.getItem('marika-ai-popup-seen')) {
  setTimeout(() => {
    if (state.view === 'setup') {
      openAiDialog();
      localStorage.setItem('marika-ai-popup-seen', 'true');
    }
  }, 400);
}

api('/api/bootstrap')
  .then((bootstrap) => {
    if (bootstrap.vaultRoot) {
      void openVaultFromBootstrap(String(bootstrap.vaultRoot));
    }
  })
  .catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar interface'));
