export function createWorkspaceGraphController(params) {
  const {
    state,
    els,
    graphViewport,
    escapeHtml,
    api,
    getConfiguredVaultRoot,
    normalizeRelativePath,
    setView,
    syncWorkspaceState,
    selectFolder,
    loadNote
  } = params;

  function closeRelationsDetailsMenu() {
    els.relationsDetailsButton?.setAttribute('aria-expanded', 'false');
    els.relationsDetailsPanel?.classList.add('is-closed');
    els.relationsDetailsPanel?.setAttribute('aria-hidden', 'true');
  }

  function openRelationsDetailsMenu() {
    els.relationsDetailsButton?.setAttribute('aria-expanded', 'true');
    els.relationsDetailsPanel?.classList.remove('is-closed');
    els.relationsDetailsPanel?.setAttribute('aria-hidden', 'false');
  }

  function toggleRelationsDetailsMenu() {
    if (els.relationsDetailsPanel?.classList.contains('is-closed')) {
      openRelationsDetailsMenu();
    } else {
      closeRelationsDetailsMenu();
    }
  }

  function renderGraph(graph) {
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];
    els.graphCount.textContent = `${nodes.length} nós`;

    if (nodes.length === 0) {
      els.graphSvg.innerHTML = '<text x="180" y="180" text-anchor="middle" class="graph-node-label">Sem conexões</text>';
      return;
    }

    const center = { x: 180, y: 180 };
    const current = nodes.find((node) => node.kind === 'current') ?? nodes[0];
    const positions = new Map([[current.id, center]]);

    const sortNodes = (items) => [...items].sort((left, right) => {
      if (left.kind === right.kind) {
        return left.label.localeCompare(right.label, 'pt-BR');
      }

      if (left.kind === 'folder') return -1;
      if (right.kind === 'folder') return 1;
      if (left.kind === 'current') return -1;
      if (right.kind === 'current') return 1;
      return left.label.localeCompare(right.label, 'pt-BR');
    });

    const placeRing = (items, radius, offset = 0) => {
      const arranged = sortNodes(items);
      arranged.forEach((node, index) => {
        const angle = (index / Math.max(1, arranged.length)) * Math.PI * 2 - Math.PI / 2 + offset;
        positions.set(node.id, {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        });
      });
    };

    const folders = nodes.filter((node) => node.id !== current.id && node.kind === 'folder');
    const linkedNotes = nodes.filter((node) => node.id !== current.id && node.kind !== 'folder');

    if (graph.scope === 'folder') {
      placeRing(folders, 92, 0.15);
      placeRing(linkedNotes, 150, -0.1);
    } else {
      const folderChain = folders.filter((node) => String(node.path ?? '').includes('/'));
      const siblingFolders = folders.filter((node) => !String(node.path ?? '').includes('/'));
      placeRing(folderChain.length > 0 ? folderChain : siblingFolders, 92, 0.12);
      placeRing(linkedNotes, 150, -0.12);
    }

    const lines = edges.map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const curve = 0.22;
      const c1x = from.x + dx * curve;
      const c1y = from.y + dy * curve - 18;
      const c2x = from.x + dx * (1 - curve);
      const c2y = from.y + dy * (1 - curve) + 18;
      return `<path d="M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}" class="graph-edge" />`;
    }).join('');

    const nodesMarkup = nodes.map((node) => {
      const position = positions.get(node.id) ?? center;
      const isCurrent = node.kind === 'current';
      const kind = node.kind === 'folder' || (graph.scope === 'folder' && node.kind === 'current') ? 'folder' : 'note';
      return `
        <g class="graph-node" data-path="${escapeHtml(node.path)}" data-kind="${kind}" data-current="${isCurrent ? 'true' : 'false'}" transform="translate(${position.x}, ${position.y})">
          <circle r="${isCurrent ? 28 : 18}" class="${isCurrent ? 'graph-node-current' : 'graph-node-linked'}" />
          <text y="${isCurrent ? 42 : 30}" text-anchor="middle" class="graph-node-label">${escapeHtml(node.label)}</text>
        </g>
      `;
    }).join('');

    els.graphSvg.innerHTML = `
      <defs>
        <filter id="graphGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g class="graph-stage" transform="translate(${graphViewport.x} ${graphViewport.y}) scale(${graphViewport.scale})">
        <g>${lines}</g>
        <g>${nodesMarkup}</g>
      </g>
    `;
  }

  function resetGraphViewport() {
    graphViewport.scale = 1;
    graphViewport.x = 0;
    graphViewport.y = 0;
  }

  function zoomGraph(delta, originX = 180, originY = 180) {
    const nextScale = Math.min(2.4, Math.max(0.6, graphViewport.scale + delta));
    const ratio = nextScale / graphViewport.scale;
    graphViewport.x = originX - ((originX - graphViewport.x) * ratio);
    graphViewport.y = originY - ((originY - graphViewport.y) * ratio);
    graphViewport.scale = nextScale;
  }

  function startGraphDrag(clientX, clientY) {
    graphViewport.dragging = true;
    graphViewport.lastX = clientX;
    graphViewport.lastY = clientY;
  }

  function moveGraphDrag(clientX, clientY) {
    if (!graphViewport.dragging) return;
    graphViewport.x += clientX - graphViewport.lastX;
    graphViewport.y += clientY - graphViewport.lastY;
    graphViewport.lastX = clientX;
    graphViewport.lastY = clientY;
    renderGraph(state.graph);
  }

  function stopGraphDrag() {
    graphViewport.dragging = false;
  }

  async function refreshGraph() {
    const vaultRoot = getConfiguredVaultRoot();
    if (!vaultRoot) {
      state.graph = { scope: 'note', nodes: [], edges: [] };
      renderGraph(state.graph);
      return;
    }

    const params = new URLSearchParams({ vaultRoot });
    if (state.graphContext.kind === 'folder') {
      params.set('folderPath', state.graphContext.path);
    } else if (state.selectedFile) {
      params.set('path', state.selectedFile);
    } else if (state.selectedFolder) {
      params.set('folderPath', state.selectedFolder);
    }

    if (!params.has('path') && !params.has('folderPath')) {
      state.graph = { scope: 'note', nodes: [], edges: [] };
      renderGraph(state.graph);
      return;
    }

    const data = await api(`/api/graph?${params.toString()}`);
    state.graph = data;
    renderGraph(state.graph);
  }

  async function openGraphNode(relativePath, kind) {
    if (!relativePath) return;

    if (kind === 'folder') {
      state.graphContext = { kind: 'folder', path: normalizeRelativePath(relativePath) };
      state.selectedFolder = normalizeRelativePath(relativePath);
      state.selectedFile = '';
      setView('workspace');
      syncWorkspaceState();
      selectFolder(relativePath, 'folder');
      await refreshGraph();
      return;
    }

    await loadNote(relativePath, { recordActivity: true, kind: 'open' });
  }

  function setSummaryMode(mode) {
    state.summaryMode = mode;
    els.summaryOverviewButton.classList.toggle('active', mode === 'overview');
    els.summaryGraphButton.classList.toggle('active', mode === 'graph');
    els.summaryOverview.classList.toggle('hidden', mode !== 'overview');
    els.graphPanel.classList.toggle('hidden', mode !== 'graph');
    if (mode === 'graph') {
      resetGraphViewport();
      renderGraph(state.graph);
    }
  }

  return {
    closeRelationsDetailsMenu,
    openRelationsDetailsMenu,
    toggleRelationsDetailsMenu,
    renderGraph,
    resetGraphViewport,
    zoomGraph,
    startGraphDrag,
    moveGraphDrag,
    stopGraphDrag,
    refreshGraph,
    openGraphNode,
    setSummaryMode
  };
}
