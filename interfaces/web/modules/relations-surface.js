export function createRelationsSurfaceController(params) {
  const {
    state,
    els,
    api,
    getConfiguredVaultRoot,
    renderBacklinksList,
    refreshGlobalGraph,
    refreshAfterVaultChange,
    escapeHtml,
    fileLabel,
    prettyPath
  } = params;

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
    if (!state.selectedFile) {
      els.linkSuggestionsList.innerHTML = '<div class="empty-inline">Selecione uma nota para ver sugestões de links.</div>';
      return;
    }

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
    if (!state.selectedFile) {
      els.linkPreviewPanel.innerHTML = '<div class="empty-inline">Selecione uma nota para inspecionar previews de link.</div>';
      return;
    }

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

  async function refreshRelationsSurface() {
    await loadRelatedData();
    await loadLinkSuggestions();
    await refreshGlobalGraph();
  }

  return {
    applyPreviewLink,
    loadLinkPreview,
    loadLinkSuggestions,
    loadRelatedData,
    refreshRelationsSurface,
    renderLinkPreview,
    renderLinkSuggestions,
    renderRelatedPanels
  };
}
