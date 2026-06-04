export function createAgendaController(params) {
  const {
    state,
    els,
    api,
    isDesktopShell,
    getDesktopBootstrapVaultRoot,
    getConfiguredVaultRoot,
    showError,
    renderOverviewDashboard,
    syncDesktopActiveVaultRoot,
    ensureActiveVaultReady,
    makeUniqueVaultPathForTarget,
    sendDebugState,
    recordActivity,
    loadAgendaReminderKeys,
    persistAgendaReminderKeys,
    suppressImmediateAgendaReminders,
    openNote,
    setView,
    checkAgendaReminders,
    bridgeProvider,
    prettyPath
  } = params;

  function formatAgendaInputValue(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function parseAgendaDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function agendaStatusClass(status) {
    if (status === 'done') return 'done';
    if (status === 'overdue') return 'overdue';
    return 'pending';
  }

  function agendaStatusLabel(status) {
    if (status === 'done') return 'Concluída';
    if (status === 'overdue') return 'Em atraso';
    return 'Pendente';
  }

  function agendaFilterLabel(filter) {
    if (filter === 'pending') return 'Pendentes';
    if (filter === 'done') return 'Concluídas';
    if (filter === 'overdue') return 'Em atraso';
    return 'Todos';
  }

  function agendaStatusKey(status) {
    return status === 'done' ? 'done' : 'pending';
  }

  function agendaDateLabel(value) {
    const date = parseAgendaDate(value);
    if (!date) return 'Data inválida';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function agendaSlug(value) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-');
  }

  function buildAgendaFilePath(title, dueValue) {
    const date = parseAgendaDate(dueValue) ?? new Date();
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const slug = agendaSlug(title || 'nova-nota') || 'nova-nota';
    return `Agenda/${isoDate}-${slug}.md`;
  }

  function buildAgendaMarkdown({ vaultRoot, title, dueValue, status, body }) {
    const safeTitle = title.trim() || 'Nota com data';
    const safeBody = body.trim();
    const lines = [
      '---',
      `vaultRoot: ${vaultRoot}`,
      `due: ${dueValue}`,
      `status: ${agendaStatusKey(status)}`,
      '---',
      `# ${safeTitle}`,
      ''
    ];

    if (safeBody) {
      lines.push(safeBody, '');
    }

    return lines.join('\n');
  }

  function updateAgendaMarkdownStatus(content, nextStatus) {
    const lines = content.split(/\r?\n/);
    if (lines[0] !== '---') {
      return [
        '---',
        `status: ${agendaStatusKey(nextStatus)}`,
        '---',
        '',
        content
      ].join('\n');
    }

    const output = [...lines];
    let cursor = 1;
    let matched = false;

    for (; cursor < output.length; cursor += 1) {
      const line = output[cursor].trim();
      if (line === '---') break;

      if (/^status\s*:/i.test(line)) {
        output[cursor] = `status: ${agendaStatusKey(nextStatus)}`;
        matched = true;
        break;
      }
    }

    if (!matched) {
      output.splice(cursor, 0, `status: ${agendaStatusKey(nextStatus)}`);
    }

    return output.join('\n');
  }

  function agendaStoredStatus(item) {
    return item.status === 'overdue' ? 'overdue' : item.status;
  }

  function setAgendaStatus(message) {
    if (els.agendaStatusMessage) {
      els.agendaStatusMessage.textContent = message;
    }
  }

  function renderAgendaList() {
    els.agendaOptionsLabel.textContent = agendaFilterLabel(state.agendaFilter);
    const items = state.agendaItems.filter((item) => {
      if (state.agendaFilter === 'all') return true;
      if (state.agendaFilter === 'overdue') return item.status === 'overdue';
      return agendaStoredStatus(item) === state.agendaFilter;
    });

    const counts = state.agendaItems.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === 'done') acc.done += 1;
      else if (item.status === 'overdue') acc.overdue += 1;
      else acc.pending += 1;
      return acc;
    }, { total: 0, pending: 0, done: 0, overdue: 0 });

    els.agendaCount.textContent = `${counts.total} itens`;
    els.agendaPendingCount.textContent = `${counts.pending} pendentes`;
    els.agendaDoneCount.textContent = `${counts.done} concluídas`;
    els.agendaOverdueCount.textContent = `${counts.overdue} em atraso`;

    els.agendaEmpty.classList.toggle('hidden', items.length > 0);
    els.agendaList.innerHTML = items.length === 0
      ? ''
      : items.map((item) => `
        <article class="agenda-item" data-path="${escapeHtml(item.path)}">
          <div class="agenda-item-head">
            <div>
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(prettyPath(item.path))}</p>
            </div>
            <span class="pill agenda-status ${agendaStatusClass(item.status)}">${agendaStatusLabel(item.status)}</span>
          </div>
          <div class="agenda-item-meta">
            <span class="pill subtle">${escapeHtml(agendaDateLabel(item.due))}</span>
            <span class="pill subtle">${item.isAgendaFolder ? 'Agenda/' : 'meta'}</span>
          </div>
          ${item.excerpt ? `<p>${escapeHtml(item.excerpt)}</p>` : ''}
          <div class="agenda-item-actions">
            <button class="action" type="button" data-action="open">Abrir</button>
            <button class="action" type="button" data-action="toggle">${item.status === 'done' ? 'Reabrir' : 'Concluir'}</button>
          </div>
        </article>
      `).join('');
  }

  async function loadAgenda(vaultRoot = '') {
    const fallbackVaultRoot = isDesktopShell ? await getDesktopBootstrapVaultRoot() : getConfiguredVaultRoot();
    const resolvedVaultRoot = String(vaultRoot ?? '').trim();
    const vaultRootValue = resolvedVaultRoot || fallbackVaultRoot || getConfiguredVaultRoot();
    if (!vaultRootValue) {
      state.agendaItems = [];
      renderAgendaList();
      renderOverviewDashboard();
      return;
    }

    const data = await api(`/api/agenda?vaultRoot=${encodeURIComponent(vaultRootValue)}`);
    state.agendaItems = data.items ?? [];
    renderAgendaList();
    renderOverviewDashboard();
    if (!isDesktopShell) {
      await checkAgendaReminders(state.agendaItems);
    }
  }

  function closeAgendaOptionsMenu() {
    els.agendaOptionsButton?.setAttribute('aria-expanded', 'false');
    els.agendaOptionsPanel?.classList.add('is-closed');
    els.agendaOptionsPanel?.setAttribute('aria-hidden', 'true');
  }

  function openAgendaOptionsMenu() {
    els.agendaOptionsButton?.setAttribute('aria-expanded', 'true');
    els.agendaOptionsPanel?.classList.remove('is-closed');
    els.agendaOptionsPanel?.setAttribute('aria-hidden', 'false');
  }

  function toggleAgendaOptionsMenu() {
    if (els.agendaOptionsPanel?.classList.contains('is-closed')) {
      openAgendaOptionsMenu();
    } else {
      closeAgendaOptionsMenu();
    }
  }

  async function createAgendaNote() {
    const title = els.agendaTitleInput.value.trim() || 'Nova nota';
    const dueValue = els.agendaDueInput.value.trim();
    const status = els.agendaStatusInput.value === 'done' ? 'done' : 'pending';
    const body = els.agendaBodyInput.value.trim();

    if (!dueValue) {
      showError('Informe o prazo para criar a nota da agenda.');
      return;
    }

    const vaultRoot = (await getDesktopBootstrapVaultRoot()) || await ensureActiveVaultReady('criar notas com prazo');
    await syncDesktopActiveVaultRoot(vaultRoot);

    setAgendaStatus('Salvando nota com data...');
    const filePath = makeUniqueVaultPathForTarget(buildAgendaFilePath(title, dueValue));
    const content = buildAgendaMarkdown({ vaultRoot, title, dueValue, status, body });

    sendDebugState('createAgenda.before', { vaultRoot, path: filePath });

    state.agendaReminderKeys = new Set([...state.agendaReminderKeys].filter((key) => !key.startsWith(`${filePath}|`)));
    suppressImmediateAgendaReminders({ path: filePath, title: title.trim() || 'Nota com data', due: dueValue, status });
    persistAgendaReminderKeys();

    const bridge = bridgeProvider();
    if (bridge && typeof bridge.createAgendaNote === 'function') {
      await bridge.createAgendaNote({ vaultRoot, path: filePath, content });
    } else {
      await api('/api/file', {
        method: 'POST',
        body: JSON.stringify({ vaultRoot, path: filePath, content, operation: 'create' })
      });
    }

    sendDebugState('createAgenda.after', { vaultRoot, path: filePath });
    recordActivity('agenda', `Criada ${fileLabel(filePath)}`, filePath);

    els.agendaTitleInput.value = '';
    els.agendaBodyInput.value = '';
    els.agendaStatusInput.value = 'pending';
    els.agendaDueInput.value = formatAgendaInputValue(new Date(Date.now() + (60 * 60 * 1000)));
    setAgendaStatus(`Nota ${title.trim() || 'Nova nota'} criada em ${filePath}.`);
    await loadAgenda(vaultRoot);
  }

  async function toggleAgendaItemStatus(pathValue, currentStatus) {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    const data = await api(`/api/file?vaultRoot=${encodeURIComponent(getConfiguredVaultRoot())}&path=${encodeURIComponent(pathValue)}`);
    const content = updateAgendaMarkdownStatus(String(data.content ?? ''), nextStatus);
    await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: getConfiguredVaultRoot(), path: pathValue, content, operation: 'edit' })
    });
    recordActivity('agenda', `${nextStatus === 'done' ? 'Concluída' : 'Reaberta'} ${fileLabel(pathValue)}`, pathValue);
    await loadAgenda(getConfiguredVaultRoot());
  }

  async function openAgendaItem(pathValue) {
    setView('workspace');
    await openNote(pathValue);
  }

  function bindEvents() {
    els.agendaForm.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendDebugState('agenda.submit', {
        title: String(els.agendaTitleInput.value ?? ''),
        due: String(els.agendaDueInput.value ?? ''),
        status: String(els.agendaStatusInput.value ?? '')
      });
      void createAgendaNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota com data'));
    });

    els.agendaCreateButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendDebugState('agenda.button.click', {
        title: String(els.agendaTitleInput.value ?? ''),
        due: String(els.agendaDueInput.value ?? ''),
        status: String(els.agendaStatusInput.value ?? '')
      });
      void createAgendaNote().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao criar nota com data'));
    });

    els.agendaResetButton.addEventListener('click', () => {
      els.agendaTitleInput.value = '';
      els.agendaBodyInput.value = '';
      els.agendaStatusInput.value = 'pending';
      els.agendaDueInput.value = formatAgendaInputValue(new Date(Date.now() + (60 * 60 * 1000)));
    });

    els.agendaOptionsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleAgendaOptionsMenu();
    });

    els.agendaOptionsPanel.addEventListener('click', (event) => {
      event.stopPropagation();
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-agenda-action], [data-agenda-filter]') : null;
      if (!(target instanceof HTMLElement)) return;

      const action = target.dataset.agendaAction;
      const filter = target.dataset.agendaFilter;

      if (action === 'refresh') {
        closeAgendaOptionsMenu();
        void loadAgenda().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar agenda'));
        return;
      }

      if (action === 'focus-form') {
        closeAgendaOptionsMenu();
        els.agendaTitleInput.focus();
        return;
      }

      if (filter) {
        state.agendaFilter = filter;
        closeAgendaOptionsMenu();
        renderAgendaList();
      }
    });

    els.agendaList.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
      const item = event.target instanceof HTMLElement ? event.target.closest('[data-path]') : null;
      if (!(item instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
      const pathValue = item.dataset.path;
      const action = target.dataset.action;
      const agendaItem = state.agendaItems.find((entry) => entry.path === pathValue);
      if (!pathValue || !agendaItem) return;
      if (action === 'open') void openAgendaItem(pathValue).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota da agenda'));
      if (action === 'toggle') void toggleAgendaItemStatus(pathValue, agendaItem.status).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao atualizar status'));
    });
  }

  function initializeReminderKeys() {
    state.agendaReminderKeys = loadAgendaReminderKeys();
  }

  return {
    bindEvents,
    buildAgendaStatusData: () => {
      const counts = state.agendaItems.reduce((acc, item) => {
        if (item.status === 'done') acc.done += 1;
        else if (item.status === 'overdue') acc.overdue += 1;
        else acc.pending += 1;
        return acc;
      }, { pending: 0, done: 0, overdue: 0 });

      const total = counts.pending + counts.done + counts.overdue;
      return { ...counts, total };
    },
    closeAgendaOptionsMenu,
    createAgendaNote,
    formatAgendaInputValue,
    initializeReminderKeys,
    loadAgenda,
    openAgendaItem,
    renderAgendaList,
    setAgendaStatus,
    toggleAgendaItemStatus
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fileLabel(pathValue) {
  const normalized = String(pathValue ?? '').replace(/\\/g, '/').replace(/\/+$/g, '');
  if (!normalized) return 'Sem nome';
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) || normalized;
}
