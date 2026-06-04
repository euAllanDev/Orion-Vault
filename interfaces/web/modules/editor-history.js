export function createEditorHistoryController(params) {
  const {
    state,
    els,
    storage,
    uiStorageKeys,
    editorHistoryState,
    editorSaveState,
    normalizeRelativePath,
    normalizeEditorText,
    getEditorSelection,
    getEditorValue,
    renderEditorPresentation,
    setEditorSurfaceSelection,
    focusEditorSurface,
    getPendingSelection,
    setPendingSelection,
    clearPendingSelection,
    hasEditorAssistItems,
    saveNote,
    showError
  } = params;

  function editorDraftStorageKey(pathValue) {
    const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
    return `${uiStorageKeys.editorDraftPrefix}${normalizedPath}`;
  }

  function readEditorDraft(pathValue) {
    const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
    if (!normalizedPath) return '';
    try {
      return String(storage.getItem(editorDraftStorageKey(normalizedPath)) ?? '');
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
        storage.removeItem(editorDraftStorageKey(normalizedPath));
        return;
      }
      storage.setItem(editorDraftStorageKey(normalizedPath), value);
    } catch {
      // Draft persistence is best-effort only.
    }
  }

  function clearEditorDraft(pathValue) {
    const normalizedPath = normalizeRelativePath(String(pathValue ?? '')).replace(/\/+$/g, '');
    if (!normalizedPath) return;
    try {
      storage.removeItem(editorDraftStorageKey(normalizedPath));
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

  function snapshotEditorState() {
    const selection = getEditorSelection();
    return {
      value: String(getEditorValue() ?? ''),
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

  function clearRedoHistory() {
    editorHistoryState.redoStack = [];
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
      setPendingSelection(Number(snapshot.selectionStart ?? 0), Number(snapshot.selectionEnd ?? snapshot.selectionStart ?? 0));
      const pending = getPendingSelection();
      setEditorSurfaceSelection(pending.start, pending.end);
      focusEditorSurface();
      clearPendingSelection();
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

  function beginTrackedEditorChange() {
    if (editorHistoryState.applying) return;
    pushEditorUndoState(snapshotEditorState());
    clearRedoHistory();
  }

  function isApplyingEditorHistory() {
    return editorHistoryState.applying;
  }

  function scheduleEditorAutoSave() {
    if (!state.selectedFile) return;
    clearEditorAutoSaveTimer();
    const currentValue = normalizeEditorText(getEditorValue());
    if (!currentValue.trim() || currentValue === editorSaveState.lastSavedValue) {
      editorSaveState.dirty = false;
      updateEditorDraftIndicator('Sincronizado', 'saved');
      return;
    }

    editorSaveState.autoSaveTimer = setTimeout(() => {
      if (hasEditorAssistItems()) {
        scheduleEditorAutoSave();
        return;
      }
      void saveNote({ source: 'auto' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha no autosave'));
    }, 2200);
  }

  return {
    beginTrackedEditorChange,
    clearEditorDraft,
    isApplyingEditorHistory,
    markEditorDirty,
    readEditorDraft,
    redoEditorChange,
    resetEditorHistory,
    resetEditorSaveState,
    scheduleEditorAutoSave,
    undoEditorChange,
    updateEditorDraftIndicator,
    writeEditorDraft
  };
}
