export function createResourceBrowserController(params) {
  const {
    state,
    els,
    searchState,
    linkPickerSelectionRef,
    api,
    getConfiguredVaultRoot,
    ensureActiveVaultReady,
    refreshWorkspace,
    getEditorSelection,
    getEditorValue,
    replaceEditorRange,
    saveNote,
    focusEditorSurface,
    collectLinkCandidates,
    escapeHtml,
    fileLabel,
    prettyPath,
    formatSearchSnippet,
    setSelectedTemplate,
    loadNote,
    showError
  } = params;

  async function loadTemplates() {
    const vaultRoot = getConfiguredVaultRoot();
    if (!vaultRoot) {
      state.templates = [];
      return;
    }

    const templateParams = new URLSearchParams({ vaultRoot });
    const data = await api(`/api/templates?${templateParams.toString()}`);
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
    els.templatePickerContent.value = getEditorValue() || '';
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

  async function openSearchResult(relativePath) {
    closeSearchDialog();
    try {
      await loadNote(relativePath, { recordActivity: true, kind: 'open' });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Falha ao abrir resultado');
    }
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
      .filter((item) => !query || `${item.label} ${item.path}`.toLowerCase().includes(query))
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

    const selectedText = String(linkPickerSelectionRef.text ?? '').trim();
    const label = selectedText || String(targetLabel ?? '').trim() || fileLabel(targetPath);
    const linkText = `[[${targetPath}|${label}]]`;
    const selection = getEditorSelection();
    const start = Number.isFinite(linkPickerSelectionRef.start) ? linkPickerSelectionRef.start : selection.start;
    const end = Number.isFinite(linkPickerSelectionRef.end) ? linkPickerSelectionRef.end : selection.end;

    replaceEditorRange(start, end, linkText);
    await saveNote();
    focusEditorSurface();
  }

  async function openLinkPickerDialog() {
    if (!getConfiguredVaultRoot()) {
      await ensureActiveVaultReady('linkar notas');
    }

    if (!state.tree) {
      await refreshWorkspace(state.selectedFile || '', false);
    }

    const selection = getEditorSelection();
    linkPickerSelectionRef.start = selection.start;
    linkPickerSelectionRef.end = selection.end;
    linkPickerSelectionRef.text = String(getEditorValue() ?? '').slice(selection.start, selection.end);

    if (els.linkPickerDialogQuery) {
      els.linkPickerDialogQuery.value = '';
    }

    renderLinkPickerDialog();
    els.linkPickerDialog.showModal();
    els.linkPickerDialogQuery?.focus();
  }

  function bindEvents() {
    els.templatesButton.addEventListener('click', () => { openTemplatesDialog().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir modelos')); });
    els.desktopSearchButton.addEventListener('click', openSearchDialog);
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
    els.templatePickerClose.addEventListener('click', () => els.templatePickerDialog.close());
    els.templatePickerDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      els.templatePickerDialog.close();
    });
    els.templatePickerSelect.addEventListener('change', () => {
      const index = els.templatePickerSelect.value.trim();
      const baseTemplate = index === '' ? null : state.templates[Number(index)] ?? null;
      els.templatePickerContent.value = baseTemplate?.content ?? getEditorValue() ?? '';
    });
  }

  return {
    applyTemplateSelection,
    bindEvents,
    closeLinkPickerDialog,
    closeSearchDialog,
    insertLinkToCurrentNote,
    loadTemplates,
    openLinkPickerDialog,
    openSearchDialog,
    openSearchResult,
    openTemplatePickerDialog,
    openTemplatesDialog,
    renderLinkPickerDialog,
    renderSearchResults,
    renderTemplatesDialog,
    runSearch
  };
}
