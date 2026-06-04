export function createOverviewDashboardController(params) {
  const {
    state,
    els,
    storage,
    normalizeRelativePath,
    escapeHtml,
    prettyPath,
    buildAgendaStatusData
  } = params;

  function agendaDateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data inválida';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function loadRecentActivity() {
    try {
      const raw = storage.getItem('orion-vault-overview-activity');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const at = Number(item.at);
          return {
            kind: String(item.kind ?? 'other'),
            title: String(item.title ?? ''),
            path: normalizeRelativePath(String(item.path ?? '')),
            at: Number.isFinite(at) ? at : Date.now(),
            meta: item.meta && typeof item.meta === 'object' ? item.meta : {}
          };
        })
        .filter((item) => Boolean(item.title || item.path));
    } catch {
      return [];
    }
  }

  function persistRecentActivity() {
    storage.setItem('orion-vault-overview-activity', JSON.stringify(state.recentActivity));
  }

  function formatRelativeTime(timestamp) {
    const safeTimestamp = Number(timestamp);
    if (!Number.isFinite(safeTimestamp)) return 'agora';

    const delta = Date.now() - safeTimestamp;
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `há ${days} d`;
  }

  function activityIcon(kind) {
    if (kind === 'save') return 'S';
    if (kind === 'create') return 'N';
    if (kind === 'rename') return 'R';
    if (kind === 'move') return 'M';
    if (kind === 'agenda') return 'A';
    if (kind === 'daily') return 'D';
    return 'O';
  }

  function recordActivity(kind, title, path, meta = {}) {
    const entry = {
      kind,
      title,
      path: normalizeRelativePath(path || ''),
      at: Date.now(),
      meta
    };

    state.recentActivity = [entry, ...state.recentActivity].slice(0, 8);
    persistRecentActivity();
    renderOverviewDashboard();
  }

  function renderOverviewDashboard() {
    const summary = state.overviewSummary ?? { fileCount: 0, folderCount: 0, markdownFileCount: 0, totalBytes: 0, issues: [] };
    const agenda = [...state.agendaItems]
      .filter((item) => item.status !== 'done')
      .sort((left, right) => new Date(left.due).getTime() - new Date(right.due).getTime())
      .slice(0, 3);
    const recent = state.recentActivity
      .filter((item) => Number.isFinite(Number(item.at)))
      .slice(0, 4);
    const activityByDay = Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - (6 - index));
      const nextDay = new Date(dayStart);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = state.recentActivity.filter((item) => {
        const at = Number(item.at);
        return Number.isFinite(at) && at >= dayStart.getTime() && at < nextDay.getTime();
      }).length;
      return count;
    });
    const peak = Math.max(1, ...activityByDay.map((value) => (Number.isFinite(value) ? value : 0)));
    const agendaData = buildAgendaStatusData();

    if (els.metricNotes) els.metricNotes.textContent = String(summary.fileCount ?? 0);
    if (els.metricFolders) els.metricFolders.textContent = String(summary.folderCount ?? 0);
    if (els.metricMarkdown) els.metricMarkdown.textContent = String(summary.markdownFileCount ?? 0);
    if (els.metricBytes) els.metricBytes.textContent = Intl.NumberFormat('pt-BR').format(Number(summary.totalBytes ?? 0));
    if (els.metricAgenda) els.metricAgenda.textContent = String(agendaData.total);
    if (els.metricOverdue) els.metricOverdue.textContent = String(agendaData.overdue);
    if (els.overviewDueCount) els.overviewDueCount.textContent = String(agenda.length);
    if (els.overviewActivityCount) els.overviewActivityCount.textContent = String(recent.length);
    if (els.overviewActivityPeak) els.overviewActivityPeak.textContent = `${peak} ação${peak === 1 ? '' : 'es'}`;
    if (els.overviewAgendaRingLabel) els.overviewAgendaRingLabel.textContent = `${agendaData.total} itens`;

    if (els.overviewDueList) {
      els.overviewDueList.innerHTML = agenda.length === 0
        ? ''
        : agenda.map((item) => `
          <button class="overview-list-item" type="button" data-path="${escapeHtml(item.path)}">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(prettyPath(item.path))}</p>
            </div>
            <span class="pill ${item.status === 'overdue' ? '' : 'subtle'}">${escapeHtml(agendaDateLabel(item.due))}</span>
          </button>
        `).join('');
    }

    if (els.overviewDueEmpty) {
      els.overviewDueEmpty.classList.toggle('hidden', agenda.length > 0);
    }

    if (els.overviewRecentList) {
      els.overviewRecentList.innerHTML = recent.length === 0
        ? ''
        : recent.map((item) => `
          <button class="recent-item" type="button" data-path="${escapeHtml(item.path)}">
            <span class="recent-icon">${escapeHtml(activityIcon(item.kind))}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(formatRelativeTime(item.at))}</p>
            </div>
          </button>
        `).join('');
    }

    if (els.overviewRecentEmpty) {
      els.overviewRecentEmpty.classList.toggle('hidden', recent.length > 0);
    }

    if (els.overviewActivityBars) {
      const bars = [...els.overviewActivityBars.querySelectorAll('span')];
      bars.forEach((bar, index) => {
        const ratio = Math.max(0, Number(activityByDay[index] ?? 0) / peak);
        const height = 18 + (Number.isFinite(ratio) ? ratio : 0) * 82;
        bar.style.setProperty('--bar-height', `${height}%`);
      });
    }

    if (els.overviewAgendaRing) {
      const pending = agendaData.pending / Math.max(1, agendaData.total) * 360;
      const overdue = agendaData.overdue / Math.max(1, agendaData.total) * 360;
      const done = agendaData.done / Math.max(1, agendaData.total) * 360;
      els.overviewAgendaRing.style.background = `conic-gradient(#c8b7ff 0deg ${pending}deg, #ff9ca6 ${pending}deg ${pending + overdue}deg, #7ee1b5 ${pending + overdue}deg ${pending + overdue + done}deg, rgba(255,255,255,0.06) ${pending + overdue + done}deg 360deg)`;
    }

    if (els.overviewAgendaLegend) {
      els.overviewAgendaLegend.innerHTML = [
        ['Pendente', agendaData.pending, 'pending'],
        ['Concluída', agendaData.done, 'done'],
        ['Em atraso', agendaData.overdue, 'overdue']
      ].map(([label, value, key]) => `
        <div class="overview-legend-item">
          <span class="overview-legend-dot ${key}"></span>
          <strong>${label}</strong>
          <small>${value}</small>
        </div>
      `).join('');
    }
  }

  function closeOverviewOptionsMenu() {
    els.overviewOptionsButton?.setAttribute('aria-expanded', 'false');
    els.overviewOptionsPanel?.classList.add('is-closed');
    els.overviewOptionsPanel?.setAttribute('aria-hidden', 'true');
  }

  function openOverviewOptionsMenu() {
    els.overviewOptionsButton?.setAttribute('aria-expanded', 'true');
    els.overviewOptionsPanel?.classList.remove('is-closed');
    els.overviewOptionsPanel?.setAttribute('aria-hidden', 'false');
  }

  function toggleOverviewOptionsMenu() {
    if (els.overviewOptionsPanel?.classList.contains('is-closed')) {
      openOverviewOptionsMenu();
    } else {
      closeOverviewOptionsMenu();
    }
  }

  return {
    closeOverviewOptionsMenu,
    loadRecentActivity,
    openOverviewOptionsMenu,
    persistRecentActivity,
    recordActivity,
    renderOverviewDashboard,
    toggleOverviewOptionsMenu
  };
}
