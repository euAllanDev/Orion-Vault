export function createVaultBootstrapController(params) {
  const {
    state,
    els,
    bootstrapState,
    isDesktopShell,
    startupVaultRoot,
    api,
    sendDebugState,
    showError,
    updateVault,
    setDesktopReady,
    setView,
    syncWorkspaceState,
    refreshWorkspace,
    loadPinnedPaths,
    loadTemplates,
    loadAgenda,
    ensureAgendaReminderPolling,
    getConfiguredVaultRoot,
    getDefaultVaultPath,
    getActiveVaultPath,
    getDesktopBridge,
    markDesktopReady,
    onBootstrapFinished
  } = params;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function loadDesktopBootstrap() {
    const attempts = isDesktopShell ? 20 : 1;
    let lastError = null;

    for (let index = 0; index < attempts; index += 1) {
      try {
        const bootstrap = await api('/api/bootstrap');
        const vaultRoot = String(bootstrap.vaultRoot ?? '').trim();
        if (vaultRoot) return bootstrap;
        lastError = new Error('Vault padrão não configurado');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Falha ao carregar bootstrap');
      }

      if (index < attempts - 1) {
        await delay(150);
      }
    }

    throw lastError ?? new Error('Falha ao carregar bootstrap');
  }

  async function getDesktopBootstrapVaultRoot() {
    if (!isDesktopShell) return '';

    try {
      const bootstrap = await api('/api/bootstrap');
      return String(bootstrap.vaultRoot ?? '').trim();
    } catch {
      return '';
    }
  }

  async function syncDesktopActiveVaultRoot(vaultRoot) {
    const bridge = getDesktopBridge();
    if (!isDesktopShell || !bridge || typeof bridge.setActiveVaultRoot !== 'function') return;
    await bridge.setActiveVaultRoot(vaultRoot);
  }

  function applyActiveVaultRoot(vaultRoot) {
    const normalizedVaultRoot = String(vaultRoot ?? '').trim();
    state.defaultVaultPath = normalizedVaultRoot;
    state.vaultPath = normalizedVaultRoot;
    els.vaultPathInput.value = normalizedVaultRoot;
    document.body.dataset.activeVaultRoot = normalizedVaultRoot;
    updateVault(normalizedVaultRoot);
    sendDebugState('applyActiveVaultRoot', { appliedVaultRoot: normalizedVaultRoot });
  }

  function resetActiveVaultRoot(vaultRoot = '') {
    const normalizedVaultRoot = String(vaultRoot ?? '').trim();
    state.vaultPath = '';
    state.defaultVaultPath = normalizedVaultRoot;
    els.vaultPathInput.value = normalizedVaultRoot;
    document.body.dataset.activeVaultRoot = normalizedVaultRoot;
    updateVault(normalizedVaultRoot);
    syncWorkspaceState();
    sendDebugState('resetActiveVaultRoot', { appliedVaultRoot: normalizedVaultRoot });
  }

  async function resolveSetupAction(vaultRoot) {
    const workspace = await api(`/api/workspace?vaultRoot=${encodeURIComponent(vaultRoot)}`);
    return workspace?.exists === false ? 'create' : 'open';
  }

  async function setupVault(vaultRoot) {
    const requestedVaultRoot = String(vaultRoot ?? '').trim();
    if (!requestedVaultRoot) {
      throw new Error('Informe um caminho de vault antes de continuar.');
    }

    const action = await resolveSetupAction(requestedVaultRoot);
    return api('/api/setup', {
      method: 'POST',
      body: JSON.stringify({ action, vaultRoot: requestedVaultRoot })
    });
  }

  async function openVaultFromBootstrap(vaultRoot, { autoOpenFirstNote = true } = {}) {
    applyActiveVaultRoot(vaultRoot);
    await syncDesktopActiveVaultRoot(vaultRoot);
    setDesktopReady(false);
    setView('workspace');
    syncWorkspaceState();

    try {
      await refreshWorkspace('', autoOpenFirstNote);
      await loadPinnedPaths();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Falha ao carregar vault ativo');
      console.error('Falha ao iniciar vault', error);
    }

    try {
      await loadTemplates();
    } catch (error) {
      console.error('Falha ao carregar modelos', error);
    }

    try {
      await loadAgenda();
    } catch (error) {
      console.error('Falha ao carregar agenda', error);
      showError(error instanceof Error ? error.message : 'Falha ao carregar agenda');
    } finally {
      setDesktopReady(true);
      markDesktopReady();
    }

    ensureAgendaReminderPolling();
  }

  async function openDesktopDefaultVault(autoOpenFirstNote = true) {
    sendDebugState('desktopBootstrap.start');
    const bootstrap = await loadDesktopBootstrap();
    const vaultRoot = String(bootstrap.vaultRoot ?? startupVaultRoot ?? '').trim();

    if (!vaultRoot) {
      throw new Error('Vault padrão não configurado');
    }

    const result = await setupVault(vaultRoot);

    sendDebugState('desktopBootstrap.open', {
      bootstrapVaultRoot: vaultRoot,
      responseVaultRoot: String(result.vaultRoot ?? vaultRoot)
    });

    await openVaultFromBootstrap(String(result.vaultRoot ?? vaultRoot), { autoOpenFirstNote });
  }

  async function startVault() {
    const activeVaultRoot = getConfiguredVaultRoot();
    if (bootstrapState.promise && !bootstrapState.complete) {
      await bootstrapState.promise.catch(() => null);
      const resolvedVaultRoot = getConfiguredVaultRoot();
      if (resolvedVaultRoot) return;
    }

    if (isDesktopShell) {
      const requestedVaultRoot = els.vaultPathInput.value.trim() || getConfiguredVaultRoot() || getDefaultVaultPath();
      const result = await setupVault(requestedVaultRoot);
      await openVaultFromBootstrap(String(result.vaultRoot ?? requestedVaultRoot), { autoOpenFirstNote: true });
      const operationLabel = result.created ? 'criado' : 'aberto';
      els.setupHint.textContent = `Vault ${operationLabel} em ${getConfiguredVaultRoot()}.`;
      return;
    }

    const bootstrap = await loadDesktopBootstrap();
    const requestedVaultRoot = els.vaultPathInput.value.trim();
    const currentVaultRoot = activeVaultRoot || String(bootstrap.vaultRoot ?? '').trim() || state.defaultVaultPath || '';
    const vaultRoot = isDesktopShell
      ? String(bootstrap.vaultRoot ?? currentVaultRoot).trim()
      : (activeVaultRoot ? currentVaultRoot : (requestedVaultRoot || currentVaultRoot));

    if (!vaultRoot) {
      throw new Error('Vault padrão ainda não carregado');
    }

    const result = await setupVault(vaultRoot);

    await openVaultFromBootstrap(String(result.vaultRoot ?? vaultRoot));
    const operationLabel = result.created ? 'criado' : 'aberto';
    els.setupHint.textContent = `Vault ${operationLabel} em ${vaultRoot}.`;
  }

  async function ensureActiveVaultReady(actionLabel) {
    const activeVaultRoot = getConfiguredVaultRoot();
    if (activeVaultRoot) return activeVaultRoot;

    if (isDesktopShell) {
      await startVault();
      const resolvedVaultRoot = getConfiguredVaultRoot();
      if (resolvedVaultRoot) return resolvedVaultRoot;
    }

    throw new Error(`Aguarde o vault padrao terminar de abrir antes de ${actionLabel}.`);
  }

  function beginDesktopBootstrap() {
    if (!isDesktopShell || bootstrapState.promise) return;

    bootstrapState.promise = (async () => {
      try {
        await openDesktopDefaultVault(true);
      } catch (error) {
        const bootstrapVaultRoot = startupVaultRoot || getDefaultVaultPath() || '';
        resetActiveVaultRoot(bootstrapVaultRoot);
        setDesktopReady(true);
        setView('setup');
        showError(error instanceof Error ? error.message : 'Falha ao iniciar interface');
        sendDebugState('desktopBootstrap.error', {
          message: error instanceof Error ? error.message : 'Falha ao iniciar interface'
        });
        markDesktopReady();
      } finally {
        bootstrapState.complete = true;
        onBootstrapFinished();
      }
    })();
  }

  return {
    applyActiveVaultRoot,
    beginDesktopBootstrap,
    ensureActiveVaultReady,
    getActiveVaultPath,
    getConfiguredVaultRoot,
    getDefaultVaultPath,
    getDesktopBootstrapVaultRoot,
    loadDesktopBootstrap,
    openDesktopDefaultVault,
    openVaultFromBootstrap,
    resetActiveVaultRoot,
    startVault,
    syncDesktopActiveVaultRoot
  };
}
