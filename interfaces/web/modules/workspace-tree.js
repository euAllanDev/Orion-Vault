export function createWorkspaceTreeController(params) {
  const {
    state,
    els,
    normalizeRelativePath,
    prettyPath,
    sortEntries,
    refreshGraph,
    syncWorkspaceState,
    renderPinnedList,
    updatePinButton,
    linkedNoteState,
    loadNote,
    showFolderContextMenu,
    showNoteContextMenu
  } = params;

  function parentFolderPath(relativePath) {
    const normalizedPath = normalizeRelativePath(relativePath);
    const segments = normalizedPath.split('/').filter(Boolean);
    segments.pop();
    return segments.join('/');
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
          event.stopPropagation();
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
      file.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectFolder(parentFolderPath(filePath), 'note');
        showNoteContextMenu(filePath, event.clientX, event.clientY);
      });
      container.appendChild(file);
    };

    for (const child of tree?.children ?? []) {
      renderEntry(child, els.tree);
    }

    renderPinnedList();
    updatePinButton();
  }

  return {
    clearFolderSelection,
    handleFolderSelectionBackgroundClick,
    renderTree,
    selectFolder,
    shouldClearFolderSelection
  };
}
