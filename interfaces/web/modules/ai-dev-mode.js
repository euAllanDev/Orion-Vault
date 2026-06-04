export function createAiDevModeController(params) {
  const {
    api,
    els,
    getActiveVaultPath,
    showError,
    updateSetupHint,
    bridgeProvider,
    body,
    storage
  } = params;

  let desktopCommands = [];
  let desktopFlows = [];
  let aiOnboarding = null;

  async function loadAiCatalog() {
    const [skillsData, flowsData] = await Promise.all([
      api('/api/skills'),
      api('/api/flows')
    ]);
    desktopCommands = Array.isArray(skillsData.groups) ? skillsData.groups : [];
    desktopFlows = Array.isArray(flowsData.flows) ? flowsData.flows : [];
  }

  async function loadAiOnboarding() {
    if (aiOnboarding) {
      return aiOnboarding;
    }

    aiOnboarding = await api('/api/ai-onboarding');
    return aiOnboarding;
  }

  function formatOnboardingPreview(onboarding) {
    const preferredCommands = [
      'orion /start',
      'orion /route-intent --query "o que voce quer descobrir?"',
      'orion /skills',
      'orion /flows',
      'orion /product-context',
      'orion /analyze-note --path Estudos/Clean Architecture.md',
      'orion /prepare-edit-task --path Estudos/SDD.md --query "revisar resumo"',
      'orion /prepare-writing-task --path Estudos/SDD.md --query "resumo"'
    ];
    const lines = Array.isArray(onboarding?.commandLines) ? onboarding.commandLines.filter(Boolean) : [];
    if (lines.length === 0) {
      return preferredCommands.join('\n');
    }

    const lineSet = new Set(lines);
    const preview = preferredCommands.filter((command) => lineSet.has(command));
    const fallback = lines.filter((command) => !preview.includes(command));
    return [...preview, ...fallback].slice(0, 7).join('\n');
  }

  function closeDialog() {
    els.aiDialog.classList.add('hidden');
    els.aiDialog.setAttribute('aria-hidden', 'true');
    els.aiDialogCommandsPanel.classList.add('hidden');
    body.classList.remove('ai-dialog-open');
  }

  function closeStandaloneCommandsDialog() {
    if (els.commandsDialog?.open) {
      els.commandsDialog.close();
    }
  }

  function renderCommandsDialog(host) {
    if (!host) return;

    const skillIntentLabels = {
      'analyze-note': 'Entender',
      'prepare-edit-task': 'Revisar',
      'prepare-writing-task': 'Escrever',
      'organize-batch': 'Organizar'
    };
    const completionLabels = {
      read: 'Leitura',
      preview: 'Preview',
      mutation: 'Mutação'
    };
    const quickFlows = `
      <section class="command-group command-group-product-context">
        <div class="command-group-head">
          <span class="eyebrow">O que e este produto</span>
        </div>
        <p>O Orion Vault e um app de notas local-first adaptado para IA e agentes. O foco principal desta sessao sao notas Markdown, agenda, relacoes, busca e organizacao local dentro do vault ativo.</p>
        <p>Use os comandos e skills do produto como caminho principal. Nao trate esta sessao como um terminal generico nem como exploracao livre da raiz do app.</p>
      </section>

      <section class="command-group">
        <div class="command-group-head">
          <span class="eyebrow">Atalhos</span>
        </div>
        <p>Use estes flows quando quiser entrar mais rapido no modo dev.</p>
        <div class="command-group-list quick-flow-list">
          <article class="command-row quick-flow-row"><div><strong>Entrar no fluxo</strong><p>Comeca pelo onboarding curto do produto dentro do vault ativo.</p></div><code>orion /start</code></article>
          <article class="command-row quick-flow-row"><div><strong>Desambiguar o pedido</strong><p>Classifica produto, vault ativo ou codigo do app antes de responder sobre a ferramenta.</p></div><code>orion /route-intent --query "o que voce quer descobrir?"</code></article>
          <article class="command-row quick-flow-row"><div><strong>Descobrir skills</strong><p>Mostra o catalogo de capacidades oficiais antes de improvisar no terminal.</p></div><code>orion /skills</code></article>
          <article class="command-row quick-flow-row"><div><strong>Ver flows</strong><p>Mostra os caminhos compostos recomendados para tarefas reais.</p></div><code>orion /flows</code></article>
          <article class="command-row quick-flow-row"><div><strong>Entender o produto</strong><p>Diferencia o Orion Vault como produto antes de entrar em detalhes da ferramenta.</p></div><code>orion /product-context</code></article>
          <article class="command-row quick-flow-row"><div><strong>Entender uma nota</strong><p>Compreensão rápida antes de responder ou editar.</p></div><code>orion /analyze-note --path Nota.md</code></article>
          <article class="command-row quick-flow-row"><div><strong>Preparar edição</strong><p>Reúne contexto e riscos antes de editar uma nota existente.</p></div><code>orion /prepare-edit-task --path Nota.md --query "revisar"</code></article>
          <article class="command-row quick-flow-row"><div><strong>Preparar escrita</strong><p>Junta retrieval e contexto antes de escrever conteúdo maior.</p></div><code>orion /prepare-writing-task --path Nota.md --query "resumo"</code></article>
          <article class="command-row quick-flow-row"><div><strong>Organizar em lote</strong><p>Gera preview-first para organização do vault ou de um recorte.</p></div><code>orion /organize-batch --path Inbox</code></article>
        </div>
      </section>
    `;
    const noteGroups = desktopCommands.filter((group) => group.category !== 'maintenance');
    const maintenanceGroups = desktopCommands.filter((group) => group.category === 'maintenance');
    const renderGroup = (group) => {
      const items = (group.skills ?? []).map((skill) => `
        <article class="command-row">
          <div>
            <strong>${skill.id}</strong>
            <p>${skill.description}</p>
            <div class="command-badges">
              ${skillIntentLabels[skill.id] ? `<span class="command-badge command-badge-intent">${skillIntentLabels[skill.id]}</span>` : ''}
              <span class="command-badge">${skill.kind}</span>
              <span class="command-badge">${completionLabels[skill.completion] ?? skill.completion}</span>
              ${skill.requiresPreview ? '<span class="command-badge command-badge-warn">Exige preview</span>' : ''}
              ${skill.mutatesVault ? '<span class="command-badge command-badge-risk">Muta vault</span>' : '<span class="command-badge command-badge-safe">Sem mutação</span>'}
            </div>
            <p><small>${skill.whenToUse ?? ''}${Array.isArray(skill.dependsOn) && skill.dependsOn.length > 0 ? ` | depends on: ${skill.dependsOn.join(', ')}` : ''}</small></p>
          </div>
          <code>${skill.examples?.[0] ?? skill.id}</code>
        </article>
      `).join('');

      return `
        <section class="command-group">
          <div class="command-group-head">
            <span class="eyebrow">${group.label}</span>
          </div>
          <p>${group.description ?? ''}</p>
          <div class="command-group-list">${items}</div>
        </section>
      `;
    };
    const skillGroups = noteGroups.map(renderGroup).join('');
    const maintenanceSection = maintenanceGroups.length > 0
      ? `
        <section class="command-group command-group-maintenance">
          <div class="command-group-head">
            <span class="eyebrow">Manutencao do app</span>
          </div>
          <p>Estas capacidades ficam separadas do fluxo normal de notas e nao substituem o vault ativo como contexto padrao.</p>
          ${maintenanceGroups.map(renderGroup).join('')}
        </section>
      `
      : '';
    const flowGroup = desktopFlows.length > 0
      ? `
        <section class="command-group">
          <div class="command-group-head">
            <span class="eyebrow">Flows</span>
          </div>
          <div class="command-group-list">${desktopFlows.map((flow) => `
            <article class="command-row">
              <div>
                <strong>${flow.id}</strong>
                <p>${flow.description}</p>
              </div>
              <code>${(flow.steps ?? []).join(' -> ')}</code>
            </article>
          `).join('')}</div>
        </section>
      `
      : '';
    host.innerHTML = `${quickFlows}${skillGroups}${flowGroup}${maintenanceSection}`;
  }

  async function openCommandsDialog(options = {}) {
    const { inline = false } = options;
    await loadAiCatalog();

    if (inline) {
      closeStandaloneCommandsDialog();
      renderCommandsDialog(els.aiDialogCommandsGroups);
      els.aiDialogCommandsPanel.classList.remove('hidden');
      return;
    }

    els.aiDialogCommandsPanel.classList.add('hidden');
    renderCommandsDialog(els.commandsDialogGroups);
    els.commandsDialog?.showModal();
  }

  async function openDialog() {
    const vault = getActiveVaultPath();
    if (els.aiDialogVaultContext) {
      els.aiDialogVaultContext.textContent = vault
        ? `Vault ativo: ${vault}`
        : 'Vault ativo: indisponivel ate a sessao abrir um vault valido.';
    }

    if (!vault) {
      els.aiDialogStatus.textContent = 'Abra ou crie um vault antes de usar a IA.';
      els.aiDialog.classList.remove('hidden');
      els.aiDialog.setAttribute('aria-hidden', 'false');
      body.classList.add('ai-dialog-open');
      return;
    }

    storage.setItem('orion-vault-ai-popup-seen', 'true');
    closeDialog();
    void loadAiOnboarding().then((data) => {
      els.aiDialogCommand.textContent = formatOnboardingPreview(data);
      els.aiDialogStatus.textContent = String(data.statusText ?? 'Pronto para abrir o terminal local.');
      els.aiDialog.classList.remove('hidden');
      els.aiDialog.setAttribute('aria-hidden', 'false');
      body.classList.add('ai-dialog-open');
    }).catch((error) => {
      els.aiDialogCommand.textContent = formatOnboardingPreview(null);
      els.aiDialogStatus.textContent = error instanceof Error ? error.message : 'Falha ao carregar onboarding da IA';
      els.aiDialog.classList.remove('hidden');
      els.aiDialog.setAttribute('aria-hidden', 'false');
      body.classList.add('ai-dialog-open');
    });
  }

  async function openTerminal() {
    const vaultRoot = getActiveVaultPath();
    if (!vaultRoot) {
      throw new Error('Abra ou crie um vault antes de iniciar o terminal da IA');
    }

    const bridge = bridgeProvider();
    if (!bridge || typeof bridge.openAiTerminal !== 'function') {
      throw new Error('Bridge do desktop indisponível');
    }

    els.aiDialogStatus.textContent = `Abrindo terminal da IA no vault ${vaultRoot}...`;
    await bridge.openAiTerminal(vaultRoot);
    els.aiDialogStatus.textContent = `Terminal aberto no vault ativo ${vaultRoot}.`;
    const onboarding = await loadAiOnboarding().catch(() => null);
    const template = String(onboarding?.setupHintTemplate ?? 'Terminal da IA aberto no vault ativo {{vaultRoot}}.');
    updateSetupHint(template.replace('{{vaultRoot}}', vaultRoot));
  }

  function buildWindowActions() {
    return {
      openTerminal: () => {
        closeDialog();
        setTimeout(() => {
          void openTerminal().catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir terminal da IA'));
        }, 50);
      },
      showCommands: () => {
        void openCommandsDialog({ inline: true }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao carregar catalogo da IA'));
      },
      closeCommands: () => closeCommandsDialog(),
      openDialog: () => openDialog(),
      closeDialog: () => closeDialog()
    };
  }

  function closeCommandsDialog() {
    els.aiDialogCommandsPanel.classList.add('hidden');
    closeStandaloneCommandsDialog();
  }

  return {
    closeDialog,
    closeCommandsDialog,
    openDialog,
    openCommandsDialog,
    openTerminal,
    buildWindowActions
  };
}
