function formatRelativeDate(timestampMs) {
  if (!timestampMs) return '';
  const now = Date.now();
  const diff = now - timestampMs;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'ontem';
  if (days < 7) return `${days}d`;
  const date = new Date(timestampMs);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function normalizeFilterText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

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

    const folderFilterTerms = normalizeFilterText(state.treeFilter).trim().split(/\s+/).filter(Boolean);
    const isFilteringFolders = folderFilterTerms.length > 0;
    const noteFilterPath = normalizeRelativePath(state.noteFilter?.folderPath ?? '');
    const noteFilterTerms = normalizeFilterText(state.noteFilter?.query).trim().split(/\s+/).filter(Boolean);
    const isFilteringNotes = Boolean(noteFilterPath && noteFilterTerms.length);
    let matchedFolderCount = 0;
    let matchedFileCount = 0;

    const isFolderInNoteScope = (folderPath) => !isFilteringNotes
      || folderPath === noteFilterPath
      || folderPath.startsWith(`${noteFilterPath}/`)
      || noteFilterPath.startsWith(`${folderPath}/`);

    const matchesFolderFilter = (entry) => {
      const haystack = normalizeFilterText(`${entry.name} ${entry.relativePath}`);
      return folderFilterTerms.every((term) => haystack.includes(term));
    };

    // Returns true if at least one child was rendered (for hiding empty filtered folders)
    const renderEntry = (entry, container, level = 0, parentMatchesFolder = false) => {
      if (entry.kind === 'folder') {
        const folderPath = normalizeRelativePath(entry.relativePath);
        if (!isFolderInNoteScope(folderPath)) return false;

        const matchesFolder = parentMatchesFolder || matchesFolderFilter(entry);
        const folder = folderTemplate.content.firstElementChild.cloneNode(true);
        folder.dataset.path = folderPath;
        folder.style.setProperty('--tree-level', String(level));
        const nameSpan = folder.querySelector('.folder-name');
        const countSpan = folder.querySelector('.folder-count');
        nameSpan.textContent = entry.name;

        const items = folder.querySelector('.folder-items');
        folder.querySelector('summary').addEventListener('click', () => selectFolder(folderPath));
        folder.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          showFolderContextMenu(folderPath, event.clientX, event.clientY);
        });

        const children = sortEntries(entry.children ?? []);
        let visibleCount = 0;
        for (const child of children) {
          if (renderEntry(child, items, level + 1, matchesFolder)) visibleCount++;
        }

        countSpan.textContent = String(visibleCount);

        // Folder filtering shows matching folders with their complete descendant tree.
        if (isFilteringFolders && !matchesFolder && visibleCount === 0) return false;
        if (isFilteringFolders && matchesFolderFilter(entry)) matchedFolderCount++;

        // When filtering, auto-expand folders so matches are visible
        if (isFilteringFolders || isFilteringNotes) {
          folder.setAttribute('open', '');
        }

        container.appendChild(folder);
        return true;
      }

      if (!entry.name.toLowerCase().endsWith('.md')) return false;

      const filePath = normalizeRelativePath(entry.relativePath);
      if (isFilteringFolders && !parentMatchesFolder) return false;

      // Note filtering exists only inside selected folder context.
      if (isFilteringNotes) {
        if (!filePath.startsWith(`${noteFilterPath}/`)) return false;
        const title = entry.name.replace(/\.md$/i, '');
        const haystack = normalizeFilterText(`${title} ${entry.relativePath}`);
        if (!noteFilterTerms.every((term) => haystack.includes(term))) return false;
      }

      const file = fileTemplate.content.firstElementChild.cloneNode(true);
      file.dataset.path = filePath;
      file.style.setProperty('--tree-level', String(level));
      file.querySelector('.file-name').textContent = entry.name;
      file.classList.toggle('active', filePath === state.selectedFile);
      file.classList.toggle('linked-open', filePath === linkedNoteState.highlightedPath);
      file.title = filePath;

      // Show relative modification date
      if (entry.modifiedAt) {
        const metaEl = document.createElement('span');
        metaEl.className = 'file-meta-date';
        metaEl.textContent = formatRelativeDate(entry.modifiedAt);
        file.appendChild(metaEl);
      }

      file.addEventListener('click', () => loadNote(filePath, { recordActivity: true, kind: 'open' }));
      file.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectFolder(parentFolderPath(filePath), 'note');
        showNoteContextMenu(filePath, event.clientX, event.clientY);
      });
      container.appendChild(file);
      matchedFileCount++;
      return true;
    };

    for (const child of tree?.children ?? []) {
      renderEntry(child, els.tree);
    }

    if (els.treeFilterResultCount) {
      if (isFilteringNotes) {
        els.treeFilterResultCount.textContent = `${matchedFileCount} ${matchedFileCount === 1 ? 'nota' : 'notas'}`;
      } else if (isFilteringFolders) {
        els.treeFilterResultCount.textContent = `${matchedFolderCount} ${matchedFolderCount === 1 ? 'pasta' : 'pastas'}`;
      } else {
        els.treeFilterResultCount.textContent = '';
      }
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
