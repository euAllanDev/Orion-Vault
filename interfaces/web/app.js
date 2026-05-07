const state = {
  view: 'setup',
  vaultPath: '',
  selectedFile: '',
  selectedFolder: '',
  tree: null
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
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
  createVaultButton: document.getElementById('createVaultButton'),
  openVaultButton: document.getElementById('openVaultButton'),
  newNoteButton: document.getElementById('newNoteButton'),
  newFolderButton: document.getElementById('newFolderButton'),
  saveButton: document.getElementById('saveButton'),
  renameButton: document.getElementById('renameButton'),
  moveButton: document.getElementById('moveButton'),
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
  projectSlideTag: document.getElementById('projectSlideTag'),
  projectSlideTitle: document.getElementById('projectSlideTitle'),
  projectSlideBody: document.getElementById('projectSlideBody'),
  projectSlideDots: document.getElementById('projectSlideDots')
};

const projectSlides = [
  { tag: 'desktop', title: 'Shell local-first', body: 'A experiência desktop está sendo refinada para manter o vault local e a navegação limpa.' },
  { tag: 'vault', title: 'Setup guiado', body: 'Criação e abertura agora usam a própria interface interna, sem depender do navegador.' },
  { tag: 'ui', title: 'Visual mais premium', body: 'Ícones, cards e modais estão recebendo um acabamento mais discreto e mais sólido.' }
];

let projectSlideIndex = 0;
let projectSlideTimer = null;

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

  if (view === 'setup') {
    els.pageTitle.textContent = 'Vault Setup';
    els.pageSubtitle.textContent = 'Crie ou abra um vault local com fronteira explícita.';
  } else {
    els.pageTitle.textContent = 'Workspace';
    els.pageSubtitle.textContent = 'Árvore de arquivos, editor central e painel auxiliar.';
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
}

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
  } catch (error) {
    setView('setup');
    state.vaultPath = '';
    showError(error instanceof Error ? error.message : 'Falha ao carregar vault ativo');
  }
}

function closeMenus() {
  els.quickMenu.classList.remove('open');
  els.folderContextMenu.classList.remove('open');
}

function openMenu(menu, x, y) {
  closeMenus();
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('open');
}

function selectFolder(relativePath) {
  state.selectedFolder = normalizeRelativePath(relativePath);
  els.folderBreadcrumb.textContent = state.selectedFolder ? prettyPath(state.selectedFolder) : 'Nenhuma pasta selecionada';
  document.querySelectorAll('.folder').forEach((node) => {
    node.classList.toggle('active-folder', node.dataset.path === state.selectedFolder);
  });
}

function showQuickMenu(button) {
  const rect = button.getBoundingClientRect();
  openMenu(els.quickMenu, rect.left, rect.bottom + 8);
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
  [els.newNoteButton, els.newFolderButton, els.saveButton, els.renameButton, els.moveButton].forEach((button) => {
    button.disabled = disabled;
  });
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

  document.querySelectorAll('.file-item').forEach((node) => {
    node.classList.toggle('active', node.dataset.path === state.selectedFile);
  });
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

  const content = await askMultiline('Conteúdo inicial', '# Nova nota\n\n');
  if (content === null) return;
  await api('/api/file', {
    method: 'POST',
    body: JSON.stringify({ vaultRoot: state.vaultPath, path: pathValue, content, operation: 'create' })
  });

  state.selectedFolder = pathDirectory(pathValue);
  await refreshWorkspace(pathValue);
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
    setView(button.dataset.view === 'setup' ? 'setup' : 'workspace');
  });
});

els.vaultPathInput.addEventListener('input', (event) => updateVault(event.target.value));
els.createVaultButton.addEventListener('click', () => { activateVault('create').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar vault')); });
els.openVaultButton.addEventListener('click', () => { activateVault('open').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir vault')); });
els.openWorkspaceButton.addEventListener('click', () => setView('workspace'));
els.emptyCreateVaultButton.addEventListener('click', () => { activateVault('create').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar vault')); });
els.emptyOpenVaultButton.addEventListener('click', () => { activateVault('open').catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir vault')); });
els.newNoteButton.addEventListener('click', () => { createNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota')); });
els.newFolderButton.addEventListener('click', () => { createFolder().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar pasta')); });
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
els.renameButton.addEventListener('click', () => { renameNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao renomear')); });
els.moveButton.addEventListener('click', () => { moveNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao mover')); });
els.noteEditor.addEventListener('input', () => {
  els.editorStatus.textContent = 'Alterações não salvas.';
});

updateVault(state.vaultPath);
setView('setup');
syncWorkspaceState();
startProjectSlide();
updateVaultSummary(null);

api('/api/bootstrap')
  .then((bootstrap) => {
    if (bootstrap.vaultRoot) {
      void openVaultFromBootstrap(String(bootstrap.vaultRoot));
    }
  })
  .catch((error) => showError(error instanceof Error ? error.message : 'Falha ao iniciar interface'));
