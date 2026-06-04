export function createEditorPresentationController(params) {
  const {
    els,
    editorPreviewState,
    escapeHtml,
    getEditorValue,
    syncEditorLinkFocus,
    updateEditorCurrentLine
  } = params;

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
    const rawContent = String(getEditorValue() ?? '');
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

    const rawContent = String(getEditorValue() ?? '').trimEnd();
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

  return {
    renderEditorPresentation,
    renderEditorPreview,
    renderEditorSurface,
    setEditorPreviewExpanded
  };
}
