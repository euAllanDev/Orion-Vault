export function createEditorAssistController(params) {
  const {
    state,
    els,
    editorAssistState,
    editorSlashCommands,
    escapeHtml,
    collectLinkCandidates,
    getCurrentEditorLine,
    replaceEditorRange,
    isEditorFocused
  } = params;

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
    if (!state.selectedFile || !isEditorFocused()) {
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

  function hasEditorAssistItems() {
    return editorAssistState.items.length > 0;
  }

  function activateEditorAssistIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= editorAssistState.items.length) return false;
    editorAssistState.activeIndex = index;
    return applyActiveEditorAssistItem();
  }

  function bindEvents() {
    els.editorAssistList?.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    els.editorAssistList?.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-index]') : null;
      if (!(target instanceof HTMLElement)) return;
      const index = Number(target.dataset.index ?? '-1');
      if (!Number.isInteger(index) || index < 0) return;
      activateEditorAssistIndex(index);
    });
  }

  return {
    activateEditorAssistIndex,
    applyActiveEditorAssistItem,
    bindEvents,
    closeEditorAssistMenu,
    hasEditorAssistItems,
    moveEditorAssistSelection,
    updateEditorAssistMenu
  };
}
