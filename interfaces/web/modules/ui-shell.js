export function createUiShellController(params) {
  const {
    state,
    els,
    isDesktopShell,
    sessionRef,
    api,
    normalizeRelativePath,
    selectFolder,
    closeAgendaOptionsMenu,
    closeOverviewOptionsMenu,
    closeRelationsDetailsMenu,
    createNote,
    createFolder,
    renameEntry,
    moveEntry,
    deleteEntry,
    openNote,
    showError
  } = params;

  function normalizeContainerPath(relativePath, kind = 'folder') {
    const normalizedPath = normalizeRelativePath(relativePath);
    if (!normalizedPath) return '';
    if (kind === 'folder') return normalizedPath;
    const segments = normalizedPath.split('/').filter(Boolean);
    segments.pop();
    return segments.join('/');
  }

  function hideDesktopNotification() {
    if (state.desktopNotificationTimer) {
      clearTimeout(state.desktopNotificationTimer);
      state.desktopNotificationTimer = null;
    }

    if (!els.desktopNotification) return;
    els.desktopNotification.classList.remove('visible');
    els.desktopNotification.setAttribute('aria-hidden', 'true');
  }

  function showDesktopNotification({ title, body, timeLabel = 'agora', actionLabel = 'Abrir agenda' }) {
    if (!isDesktopShell || !els.desktopNotification) return;

    els.desktopNotificationTitle.textContent = String(title ?? 'Orion Vault');
    els.desktopNotificationText.textContent = String(body ?? '');
    els.desktopNotificationTime.textContent = String(timeLabel ?? 'agora');
    els.desktopNotificationAction.textContent = String(actionLabel ?? 'Ver agenda');
    els.desktopNotification.classList.add('visible');
    els.desktopNotification.setAttribute('aria-hidden', 'false');

    if (state.desktopNotificationTimer) {
      clearTimeout(state.desktopNotificationTimer);
    }

    state.desktopNotificationTimer = setTimeout(() => {
      hideDesktopNotification();
    }, 6500);
  }

  function closeGuideDialog() {
    els.guideDialog.close();
  }

  async function openGuideDialog() {
    els.guideDialogStatus.textContent = 'Carregando guia local...';
    els.guideDialogContent.textContent = '';
    els.guideDialog.showModal();

    try {
      const data = await api('/api/guide');
      els.guideDialogStatus.textContent = `Fonte: ${data.path ?? 'generated://skills-guide'}`;
      els.guideDialogContent.textContent = String(data.content ?? '');
    } catch (error) {
      els.guideDialogStatus.textContent = 'Não foi possível carregar o guia local.';
      els.guideDialogContent.textContent = error instanceof Error ? error.message : 'Falha ao carregar guia';
    }
  }

  function closeInputDialog() {
    if (els.inputDialog.open) {
      els.inputDialog.close();
    }
  }

  function openInputDialog({ eyebrow, title, message, label, value = '', multiline = false }) {
    return new Promise((resolve) => {
      if (sessionRef.current) {
        sessionRef.current.finish(null);
      }

      els.inputDialogEyebrow.textContent = eyebrow;
      els.inputDialogTitle.textContent = title;
      els.inputDialogMessage.textContent = message;
      els.inputDialogFieldWrap.hidden = false;
      els.inputDialogFieldLabel.textContent = label;
      els.inputDialogInput.value = value;
      els.inputDialogTextarea.value = value;
      els.inputDialogInput.hidden = multiline;
      els.inputDialogTextarea.hidden = !multiline;
      els.inputDialogCancel.textContent = 'Cancelar';
      els.inputDialogConfirm.textContent = 'Confirmar';

      const cleanup = () => {
        if (sessionRef.current?.cleanup === cleanup) {
          sessionRef.current = null;
        }
        els.inputDialog.oncancel = null;
        els.inputDialogConfirm.onclick = null;
        els.inputDialogCancel.onclick = null;
        els.inputDialogInput.onkeydown = null;
      };

      const finish = (result) => {
        cleanup();
        closeInputDialog();
        resolve(result);
      };

      const onConfirm = () => {
        const output = multiline ? els.inputDialogTextarea.value : els.inputDialogInput.value;
        finish(output.trim());
      };

      const onCancel = (event) => {
        event.preventDefault();
        finish(null);
      };

      sessionRef.current = { cleanup, finish };
      els.inputDialog.oncancel = onCancel;
      els.inputDialogConfirm.onclick = onConfirm;
      els.inputDialogCancel.onclick = () => finish(null);
      els.inputDialogInput.onkeydown = (event) => {
        if (multiline) return;
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        event.preventDefault();
        onConfirm();
      };
      els.inputDialog.showModal();
      if (multiline) els.inputDialogTextarea.focus();
      else els.inputDialogInput.focus();
    });
  }

  function openConfirmDialog({ eyebrow, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
    return new Promise((resolve) => {
      if (sessionRef.current) {
        sessionRef.current.finish(false);
      }

      els.inputDialogEyebrow.textContent = eyebrow;
      els.inputDialogTitle.textContent = title;
      els.inputDialogMessage.textContent = message;
      els.inputDialogFieldWrap.hidden = true;
      els.inputDialogInput.hidden = true;
      els.inputDialogTextarea.hidden = true;
      els.inputDialogCancel.textContent = cancelLabel;
      els.inputDialogConfirm.textContent = confirmLabel;

      const cleanup = () => {
        if (sessionRef.current?.cleanup === cleanup) {
          sessionRef.current = null;
        }
        els.inputDialog.oncancel = null;
        els.inputDialogConfirm.onclick = null;
        els.inputDialogCancel.onclick = null;
        els.inputDialogFieldWrap.hidden = false;
        els.inputDialogCancel.textContent = 'Cancelar';
        els.inputDialogConfirm.textContent = 'Confirmar';
      };

      const finish = (result) => {
        cleanup();
        closeInputDialog();
        resolve(result);
      };

      sessionRef.current = { cleanup, finish };
      els.inputDialog.oncancel = (event) => {
        event.preventDefault();
        finish(false);
      };
      els.inputDialogConfirm.onclick = () => finish(true);
      els.inputDialogCancel.onclick = () => finish(false);
      els.inputDialog.showModal();
      els.inputDialogConfirm.focus();
    });
  }

  function closeMenus() {
    els.quickMenu.classList.remove('open');
    els.folderContextMenu.classList.remove('open');
    els.noteOptionsMenu?.classList.add('hidden');
    els.noteOptionsButton?.setAttribute('aria-expanded', 'false');
    closeAgendaOptionsMenu();
    closeOverviewOptionsMenu();
    closeRelationsDetailsMenu();
  }

  function openMenu(menu, x, y) {
    closeMenus();
    menu.classList.add('open');

    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const clampedX = Math.max(margin, Math.min(x, viewportWidth - menuRect.width - margin));
    const clampedY = Math.max(margin, Math.min(y, viewportHeight - menuRect.height - margin));

    menu.style.left = `${clampedX}px`;
    menu.style.top = `${clampedY}px`;
  }

  function showQuickMenu(button) {
    const rect = button.getBoundingClientRect();
    openMenu(els.quickMenu, rect.left, rect.bottom + 8);
  }

  function toggleNoteOptionsMenu() {
    if (!els.noteOptionsMenu || !els.noteOptionsButton) return;
    const isHidden = els.noteOptionsMenu.classList.contains('hidden');
    closeMenus();
    if (!isHidden) return;
    els.noteOptionsMenu.classList.remove('hidden');
    els.noteOptionsButton.setAttribute('aria-expanded', 'true');
  }

  function showTreeContextMenu(relativePath, kind, x, y) {
    const containerPath = normalizeContainerPath(relativePath, kind);
    state.selectedFolder = containerPath;
    selectFolder(state.selectedFolder);
    els.folderContextMenu.innerHTML = '';

    const actions = kind === 'folder'
      ? [
          ['create-note', 'Nova nota'],
          ['create-folder', 'Nova pasta'],
          ['rename-folder', 'Renomear pasta'],
          ['move-folder', 'Mover pasta'],
          ['copy-path', 'Copiar caminho'],
          ['delete-folder', 'Apagar pasta']
        ]
      : [
          ['open-note', 'Abrir nota'],
          ['create-note', 'Nova nota'],
          ['create-folder', 'Nova pasta'],
          ['rename-note', 'Renomear nota'],
          ['move-note', 'Mover nota'],
          ['copy-path', 'Copiar caminho'],
          ['delete-note', 'Apagar nota']
        ];

    for (const [action, label] of actions) {
      if (action.startsWith('delete-')) {
        const separator = document.createElement('li');
        separator.className = 'context-menu-separator';
        els.folderContextMenu.appendChild(separator);
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.action = action;
      item.textContent = label;
      if (action.startsWith('delete-')) item.classList.add('is-danger');
      item.addEventListener('click', async () => {
        closeMenus();
        try {
          if (action === 'open-note') await openNote(relativePath, { recordActivity: true, kind: 'open' });
          if (action === 'create-note') await createNote();
          if (action === 'create-folder') await createFolder();
          if (action === 'rename-folder') await renameEntry(relativePath, 'folder');
          if (action === 'rename-note') await renameEntry(relativePath, 'note');
          if (action === 'move-folder') await moveEntry(relativePath, 'folder');
          if (action === 'move-note') await moveEntry(relativePath, 'note');
          if (action === 'copy-path') {
            await navigator.clipboard.writeText(relativePath);
            els.editorStatus.textContent = `Caminho copiado: ${relativePath}`;
          }
          if (action === 'delete-folder') await deleteEntry({ kind: 'folder', path: relativePath });
          if (action === 'delete-note') await deleteEntry({ kind: 'note', path: relativePath });
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Não foi possível concluir a ação');
        }
      });
      els.folderContextMenu.appendChild(item);
    }

    openMenu(els.folderContextMenu, x, y);
  }

  function showFolderContextMenu(relativePath, x, y) {
    showTreeContextMenu(relativePath, 'folder', x, y);
  }

  function showNoteContextMenu(relativePath, x, y) {
    showTreeContextMenu(relativePath, 'note', x, y);
  }

  return {
    closeGuideDialog,
    closeInputDialog,
    closeMenus,
    hideDesktopNotification,
    openConfirmDialog,
    openGuideDialog,
    openInputDialog,
    openMenu,
    showFolderContextMenu,
    showNoteContextMenu,
    showDesktopNotification,
    showQuickMenu,
    toggleNoteOptionsMenu
  };
}
