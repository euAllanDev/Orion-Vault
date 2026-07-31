export function createWorkspaceCoreController(params) {
  const {
    state,
    els,
    api,
    getConfiguredVaultRoot,
    applyActiveVaultRoot,
    reconcileVaultScopedState,
    renderTree,
    loadPinnedPaths,
    setEditorTitleValue,
    resetEditorHistory,
    resetEditorSaveState,
    renderEditorPresentation,
    closeEditorAssistMenu,
    syncWorkspaceState,
    updateVaultSummary,
    updatePinButton,
    refreshBacklinks,
    refreshGraph,
    loadRelatedData,
    loadLinkSuggestions,
    renderLinkPreview,
    refreshGlobalGraph,
    recordActivity,
    fileLabel,
    prettyPath,
    pathDirectory,
    readEditorDraft,
    markEditorDirty,
    ensureActiveVaultReady,
    containerForSelection,
    openInputDialog,
    makeUniqueVaultPath,
    normalizeRelativePath,
    makeUniqueVaultPathForTarget,
    setView,
    updatePinButtonAndPinnedList,
    refreshOverviewAfterSave,
    sendDebugState
  } = params;

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
      syncWorkspaceState();
      return;
    }

    const data = await api(`/api/workspace?vaultRoot=${encodeURIComponent(vaultRoot)}`);
    if (data?.vaultRoot) {
      applyActiveVaultRoot(data.vaultRoot);
    }

    if (data?.exists === false || !data?.tree) {
      state.tree = null;
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
      els.editorStatus.textContent = 'O vault selecionado ainda nao existe. Inicie ou crie esse vault para continuar.';
      els.folderBreadcrumb.textContent = 'Nenhuma pasta selecionada';
      updateVaultSummary(null);
      syncWorkspaceState();
      return;
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
      document.querySelectorAll('.folder').forEach((node) => {
        node.classList.toggle('active-folder', node.dataset.path === state.selectedFolder);
      });
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
        syncWorkspaceState();
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
      syncWorkspaceState();
    }

    if (data.summary) {
      els.setupHint.textContent = `${data.summary.fileCount} arquivos, ${data.summary.folderCount} pastas.`;
      updateVaultSummary(data.summary);
    }

    syncWorkspaceState();
  }

  async function loadNote(relativePath, options = {}) {
    const normalizedPath = normalizeRelativePath(relativePath);
    const vaultRoot = getConfiguredVaultRoot();
    const data = await api(`/api/file?vaultRoot=${encodeURIComponent(vaultRoot)}&path=${encodeURIComponent(normalizedPath)}`);
    const previousSelectedFile = state.selectedFile;
    state.selectedFile = normalizeRelativePath(data.path);
    closeEditorAssistMenu();
    setEditorTitleValue(fileLabel(state.selectedFile), { enabled: true });
    els.breadcrumbs.textContent = prettyPath(state.selectedFile);
    els.editorMeta.textContent = `${pathDirectory(state.selectedFile).replace(/\//g, ' · ')} · markdown`;
    const persistedContent = String(data.content ?? '');
    const draftContent = readEditorDraft(state.selectedFile);
    const nextContent = draftContent || persistedContent;
    const isCurrentContent = normalizedPath === previousSelectedFile && els.noteEditor.value === nextContent;

    // The vault watcher also observes this editor's autosave. Do not recreate the
    // editor surface for identical content, or its native selection returns to zero.
    if (!isCurrentContent) {
      els.noteEditor.value = nextContent;
      resetEditorHistory({ value: nextContent, selectionStart: 0, selectionEnd: 0 });
      resetEditorSaveState(persistedContent);
      renderEditorPresentation();
    }
    els.editorStatus.textContent = draftContent ? `Editando ${state.selectedFile} com rascunho local.` : `Editando ${state.selectedFile}`;
    if (draftContent) {
      markEditorDirty();
    }

    document.querySelectorAll('.file-item').forEach((node) => {
      node.classList.toggle('active', node.dataset.path === state.selectedFile);
    });

    updatePinButtonAndPinnedList();
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

    syncWorkspaceState();
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

  function splitPathParts(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    const segments = normalized.split('/').filter(Boolean);
    const fileName = segments.pop() ?? '';
    return {
      directory: segments.join('/'),
      fileName
    };
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
    setView('workspace');
    await refreshWorkspace('', false);
    els.editorStatus.textContent = `Pasta criada em ${value}.`;
  }

  function noteSlug(value) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-');
  }

  async function createNote() {
    const vaultRoot = await ensureActiveVaultReady('criar uma nota');
    const base = containerForSelection();
    const title = await openInputDialog({
      eyebrow: 'Criar nota',
      title: 'Nova nota',
      message: 'Digite apenas o titulo da nota. O caminho sera gerado automaticamente dentro da pasta atual.',
      label: 'Titulo da nota',
      value: 'Nova nota'
    });
    if (!title) return;

    const safeTitle = title.trim();
    const slug = noteSlug(safeTitle || 'nova-nota') || 'nova-nota';
    const fileName = `${slug}.md`;
    const pathValue = makeUniqueVaultPath(base, fileName);
    sendDebugState('createNote.before', { vaultRoot, path: pathValue, base });

    const content = state.selectedTemplate?.content ?? '';
    await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot, path: pathValue, content, operation: 'create' })
    });

    state.selectedFolder = pathDirectory(pathValue);
    recordActivity('create', `Criada ${fileLabel(pathValue)}`, pathValue);
    setView('workspace');
    await refreshWorkspace(pathValue);
    els.editorStatus.textContent = `Nota criada em ${pathValue}.`;
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
    setView('workspace');
    await refreshWorkspace(destination);
    els.editorStatus.textContent = `Nota renomeada para ${destination}.`;
  }

  async function renameNote() {
    if (!state.selectedFile) return;
    const { directory, fileName } = splitPathParts(state.selectedFile);
    const extensionMatch = fileName.match(/(\.[^.]+)$/);
    const currentExtension = extensionMatch ? extensionMatch[1] : '';
    const nextName = await openInputDialog({
      eyebrow: 'Workspace',
      title: 'Renomear',
      message: 'Digite apenas o novo nome do arquivo atual.',
      label: 'Nome do arquivo',
      value: fileName,
      multiline: false
    });

    if (!nextName) return;
    let cleanedName = String(nextName).trim().replace(/[\\/]+/g, '-');
    if (currentExtension && !cleanedName.toLowerCase().endsWith(currentExtension.toLowerCase())) {
      cleanedName = `${cleanedName}${currentExtension}`;
    }
    if (!cleanedName) return;

    const nextPath = directory ? `${directory}/${cleanedName}` : cleanedName;
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
    setView('workspace');
    await refreshWorkspace(normalizeRelativePath(nextPath));
    els.editorStatus.textContent = `Nota movida para ${normalizeRelativePath(nextPath)}.`;
  }

  return {
    createFolder,
    createNote,
    loadNote,
    moveNote,
    refreshWorkspace,
    renameCurrentNoteToPath,
    renameNote
  };
}
