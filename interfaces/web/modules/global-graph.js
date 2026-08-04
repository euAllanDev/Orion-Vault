export function createGlobalGraphController(params) {
  const maxVisibleNotes = 220;
  const maxVisibleFolders = 40;
  const {
    state,
    els,
    graphGlobalScene,
    graphGlobalViewport,
    normalizeRelativePath,
    fileLabel,
    prettyPath,
    escapeHtml,
    api,
    getConfiguredVaultRoot,
    refreshRelationsSurface,
    isDesktopShell,
    startVault,
    setView,
    showError,
    refreshWorkspace,
    refreshGraph,
    loadNote,
    syncWorkspaceState,
    closeRelationsDetailsMenu
  } = params;

  function graphGlobalClusterKeyForNode(node) {
    const source = node.kind === 'folder' ? node.path : (node.folderPath || node.path);
    const normalized = normalizeRelativePath(source);
    const [first = ''] = normalized.split('/').filter(Boolean);
    return first;
  }

  function hashGraphPath(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function normalizeGraphGlobalNodes(graph) {
    const nodes = [...(graph?.nodes ?? [])];
    return nodes.sort((left, right) => {
      if (left.kind !== right.kind) {
        if (left.kind === 'folder') return -1;
        if (right.kind === 'folder') return 1;
        return left.label.localeCompare(right.label, 'pt-BR');
      }

      if (left.kind === 'note') {
        return right.score - left.score || left.label.localeCompare(right.label, 'pt-BR');
      }

      return left.label.localeCompare(right.label, 'pt-BR');
    });
  }

  function graphGlobalClusterLabel(key) {
    return key ? fileLabel(key) : 'Raiz';
  }

  function graphGlobalPalette(index) {
    const palettes = [
      { blob: 'rgba(109, 40, 217, 0.14)', stroke: 'rgba(167, 139, 250, 0.28)', glow: 'rgba(167, 139, 250, 0.38)', node: 'rgba(216, 180, 254, 0.96)', nodeStrong: 'rgba(250, 245, 255, 0.98)', folder: 'rgba(196, 181, 253, 0.74)' },
      { blob: 'rgba(30, 64, 175, 0.14)', stroke: 'rgba(96, 165, 250, 0.26)', glow: 'rgba(96, 165, 250, 0.34)', node: 'rgba(147, 197, 253, 0.95)', nodeStrong: 'rgba(239, 246, 255, 0.98)', folder: 'rgba(148, 163, 184, 0.76)' },
      { blob: 'rgba(88, 28, 135, 0.16)', stroke: 'rgba(232, 121, 249, 0.22)', glow: 'rgba(216, 180, 254, 0.32)', node: 'rgba(233, 213, 255, 0.94)', nodeStrong: 'rgba(250, 245, 255, 0.98)', folder: 'rgba(192, 132, 252, 0.72)' },
      { blob: 'rgba(14, 116, 144, 0.14)', stroke: 'rgba(103, 232, 249, 0.22)', glow: 'rgba(125, 211, 252, 0.28)', node: 'rgba(165, 243, 252, 0.92)', nodeStrong: 'rgba(236, 254, 255, 0.98)', folder: 'rgba(148, 163, 184, 0.7)' },
      { blob: 'rgba(91, 33, 182, 0.16)', stroke: 'rgba(196, 181, 253, 0.26)', glow: 'rgba(192, 132, 252, 0.34)', node: 'rgba(221, 214, 254, 0.96)', nodeStrong: 'rgba(255, 255, 255, 0.98)', folder: 'rgba(196, 181, 253, 0.74)' }
    ];
    return palettes[index % palettes.length];
  }

  function graphGlobalBlobPath(cx, cy, rx, ry, seed) {
    const points = [];
    const steps = 18;
    for (let index = 0; index < steps; index += 1) {
      const angle = (Math.PI * 2 * index) / steps;
      const wobble = 1 + (Math.sin((index * 1.7) + seed) * 0.07) + (Math.cos((index * 2.4) + seed) * 0.055);
      points.push([cx + (Math.cos(angle) * rx * wobble), cy + (Math.sin(angle) * ry * wobble)]);
    }

    let pathValue = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const middleX = (current[0] + next[0]) / 2;
      const middleY = (current[1] + next[1]) / 2;
      pathValue += ` Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${middleX.toFixed(2)} ${middleY.toFixed(2)}`;
    }

    return `${pathValue} Z`;
  }

  function buildGlobalGraphSlots(count, width, height) {
    if (count <= 0) return [];
    if (count === 1) return [{ x: width / 2, y: height / 2 }];

    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = Math.max(220, width * 0.31);
    const radiusY = Math.max(170, height * 0.25);
    const includeCenter = count >= 5 && count % 2 === 1;
    const ringCount = includeCenter ? count - 1 : count;
    const slots = [];

    for (let index = 0; index < ringCount; index += 1) {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / ringCount);
      slots.push({ x: centerX + (Math.cos(angle) * radiusX), y: centerY + (Math.sin(angle) * radiusY) });
    }

    if (includeCenter) {
      slots.splice(Math.floor(slots.length / 2), 0, { x: centerX, y: centerY + (height * 0.12) });
    }

    return slots;
  }

  function buildGlobalGraphStars(width, height) {
    const stars = [];
    for (let index = 0; index < 120; index += 1) {
      const seed = hashGraphPath(`star:${index}`);
      const x = seed % width;
      const y = Math.floor(seed / Math.max(1, width)) % height;
      const radius = 0.55 + ((seed % 100) / 110);
      const opacity = 0.18 + ((seed % 70) / 120);
      stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" opacity="${opacity.toFixed(2)}"></circle>`);
    }
    return stars.join('');
  }

  function buildGlobalGraphLayout(graph, width, height) {
    const rawNodes = normalizeGraphGlobalNodes(graph);
    const sortedEdges = [...(graph?.edges ?? [])].sort((left, right) => {
      const weight = { strong: 3, medium: 2, weak: 1, hidden: 0 };
      return (weight[right.intensity] ?? 0) - (weight[left.intensity] ?? 0) || Number(right.score ?? 0) - Number(left.score ?? 0);
    });

    const connectionCounts = new Map();
    for (const edge of sortedEdges) {
      connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
      connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
    }

    let visibleNodes = rawNodes.filter((node) => {
      if (node.kind !== 'folder') return true;
      const clusterKey = graphGlobalClusterKeyForNode(node);
      return normalizeRelativePath(node.path) !== clusterKey;
    });
    if (visibleNodes.length === 0) visibleNodes = rawNodes;

    const totalNodeCount = visibleNodes.length;
    if (visibleNodes.length > maxVisibleNotes + maxVisibleFolders) {
      const folders = visibleNodes.filter((node) => node.kind === 'folder').slice(0, maxVisibleFolders);
      const notes = visibleNodes.filter((node) => node.kind !== 'folder').slice(0, maxVisibleNotes);
      visibleNodes = [...folders, ...notes];
    }

    const clusterMap = new Map();
    for (const node of visibleNodes) {
      const key = graphGlobalClusterKeyForNode(node);
      const current = clusterMap.get(key) ?? { key, label: graphGlobalClusterLabel(key), nodes: [], noteCount: 0, folderCount: 0, connectionCount: 0, palette: null, x: 0, y: 0, rx: 0, ry: 0 };
      current.nodes.push(node);
      if (node.kind === 'folder') current.folderCount += 1;
      else current.noteCount += 1;
      clusterMap.set(key, current);
    }

    const clusters = [...clusterMap.values()].sort((left, right) => right.nodes.length - left.nodes.length || left.label.localeCompare(right.label, 'pt-BR'));
    const slots = buildGlobalGraphSlots(clusters.length, width, height);
    const positions = new Map();
    const nodeOrder = [];

    clusters.forEach((cluster, clusterIndex) => {
      const slot = slots[clusterIndex] ?? { x: width / 2, y: height / 2 };
      cluster.palette = graphGlobalPalette(clusterIndex);
      cluster.x = slot.x;
      cluster.y = slot.y;
      cluster.rx = Math.min(width * 0.19, 150 + (cluster.nodes.length * 10));
      cluster.ry = Math.min(height * 0.16, 112 + (cluster.nodes.length * 7));

      const rankedNodes = [...cluster.nodes].sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
        return (connectionCounts.get(right.path) ?? 0) - (connectionCounts.get(left.path) ?? 0) || right.score - left.score || left.label.localeCompare(right.label, 'pt-BR');
      });

      rankedNodes.forEach((node, index) => {
        const seed = hashGraphPath(node.path);
        const angle = ((seed % 360) * (Math.PI / 180)) + (index * 2.399963229728653);
        const radiusRatio = rankedNodes.length <= 1 ? 0 : Math.sqrt((index + 0.65) / (rankedNodes.length + 0.35));
        const radialX = cluster.rx * (0.16 + (radiusRatio * 0.74));
        const radialY = cluster.ry * (0.16 + (radiusRatio * 0.72));
        const baseX = cluster.x + (Math.cos(angle) * radialX * 0.82);
        const baseY = cluster.y + (Math.sin(angle) * radialY * 0.8);
        const isHub = node.kind === 'note' && index < Math.max(1, Math.min(2, Math.ceil(cluster.noteCount * 0.12)));
        const size = node.kind === 'folder' ? 12 + (Math.min(1, node.score) * 3) : 10 + (Math.min(1, node.score) * 6) + (isHub ? 5 : 0);
        const entry = { node, cluster, x: baseX, y: baseY, size, isHub };
        positions.set(node.path, entry);
        nodeOrder.push(entry);
      });
    });

    const visiblePaths = new Set(nodeOrder.map((entry) => entry.node.path));
    const edges = sortedEdges.filter((edge) => visiblePaths.has(edge.from) && visiblePaths.has(edge.to));
    const clusterByKey = new Map(clusters.map((cluster) => [cluster.key, cluster]));

    for (const edge of edges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;
      from.cluster.connectionCount += 1;
      if (from.cluster.key !== to.cluster.key) to.cluster.connectionCount += 1;
    }

    return { clusters, clusterByKey, positions, nodeOrder, edges, connectionCounts, totalNodeCount };
  }

  function ensureGlobalGraphSelection(layout) {
    if (graphGlobalScene.activePath && layout.positions.has(graphGlobalScene.activePath)) {
      graphGlobalScene.activeCluster = layout.positions.get(graphGlobalScene.activePath)?.cluster.key ?? graphGlobalScene.activeCluster;
      return;
    }
    if (graphGlobalScene.activeCluster && layout.clusterByKey.has(graphGlobalScene.activeCluster)) {
      graphGlobalScene.activePath = '';
      return;
    }
    graphGlobalScene.activePath = '';
    graphGlobalScene.activeCluster = '';
  }

  function buildGlobalGraphHighlights(layout) {
    const displayPath = graphGlobalScene.hoverPath || graphGlobalScene.activePath;
    const fallbackCluster = graphGlobalScene.hoverCluster || graphGlobalScene.activeCluster;
    const displayCluster = displayPath ? layout.positions.get(displayPath)?.cluster.key ?? fallbackCluster : fallbackCluster;
    const highlightedPaths = new Set();
    const featuredEdges = new Set();

    if (displayPath && layout.positions.has(displayPath)) {
      highlightedPaths.add(displayPath);
      for (const edge of layout.edges) {
        if (edge.from === displayPath || edge.to === displayPath) {
          highlightedPaths.add(edge.from);
          highlightedPaths.add(edge.to);
          featuredEdges.add(`${edge.from}->${edge.to}:${edge.kind}`);
        }
      }
    } else if (displayCluster && layout.clusterByKey.has(displayCluster)) {
      for (const entry of layout.nodeOrder) {
        if (entry.cluster.key === displayCluster) highlightedPaths.add(entry.node.path);
      }
      for (const edge of layout.edges) {
        const from = layout.positions.get(edge.from);
        const to = layout.positions.get(edge.to);
        if (from?.cluster.key === displayCluster && to?.cluster.key === displayCluster) featuredEdges.add(`${edge.from}->${edge.to}:${edge.kind}`);
      }
    }

    return { displayPath, displayCluster, highlightedPaths, featuredEdges };
  }

  function updateGlobalGraphOverlay(layout, displayPath, displayCluster) {
    const setOverlayVisible = (visible) => {
      if (!els.graphGlobalOverlay) return;
      els.graphGlobalOverlay.classList.toggle('hidden', !visible);
      els.graphGlobalOverlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!visible) {
        els.graphGlobalOverlay.dataset.path = '';
        els.graphGlobalOverlay.dataset.kind = '';
      }
    };

    if (displayPath && layout.positions.has(displayPath)) {
      const current = layout.positions.get(displayPath);
      const node = current?.node;
      if (!node) return;
      const isFolder = node.kind === 'folder';
      const clusterLabel = current.cluster.label;
      const summary = node.summary || (isFolder ? `Pasta de navegação dentro do assunto ${clusterLabel}. Use este nó para refocar a malha e abrir esse contexto no workspace.` : `Nota dentro do assunto ${clusterLabel}. Use este ponto para inspecionar o contexto e abrir a nota direto no workspace.`);

      setOverlayVisible(true);
      if (els.graphGlobalOverlay) {
        els.graphGlobalOverlay.dataset.path = node.path;
        els.graphGlobalOverlay.dataset.kind = node.kind;
      }
      if (els.graphGlobalOverlayTitle) els.graphGlobalOverlayTitle.textContent = node.label;
      if (els.graphGlobalOverlaySummary) els.graphGlobalOverlaySummary.textContent = summary;
      if (els.graphGlobalOverlayBadge) els.graphGlobalOverlayBadge.textContent = isFolder ? 'Pasta focada' : 'Nota focada';
      if (els.graphGlobalOverlayKicker) els.graphGlobalOverlayKicker.textContent = `Assunto ${clusterLabel}`;
      if (els.graphGlobalOverlayPath) {
        const pathLabel = prettyPath(node.path);
        els.graphGlobalOverlayPath.textContent = pathLabel;
        els.graphGlobalOverlayPath.setAttribute('title', pathLabel);
      }
      if (els.graphGlobalOverlayStatus) els.graphGlobalOverlayStatus.textContent = isFolder ? 'Pasta' : 'Nota';
      if (els.graphGlobalOverlayLinks) els.graphGlobalOverlayLinks.textContent = String(layout.connectionCounts.get(node.path) ?? 0);
      if (els.graphGlobalOverlayLayer) els.graphGlobalOverlayLayer.textContent = clusterLabel;
      if (els.graphGlobalOverlayHint) els.graphGlobalOverlayHint.textContent = isFolder ? 'Clique para manter o contexto visual. Duplo clique abre a pasta no workspace.' : 'Clique para manter o foco visual. Duplo clique abre a nota no workspace.';
      if (els.graphGlobalOverlayOpenButton) els.graphGlobalOverlayOpenButton.textContent = isFolder ? 'Abrir pasta' : 'Abrir nota';
      if (els.graphGlobalOverlayFocusButton) els.graphGlobalOverlayFocusButton.textContent = isFolder ? 'Manter contexto' : 'Manter foco';
      return;
    }

    if (displayCluster && layout.clusterByKey.has(displayCluster)) {
      setOverlayVisible(false);
      return;
    }

    setOverlayVisible(false);
  }

  function renderIslandGlobalGraph(graph) {
    graphGlobalScene.lastGraph = graph;
    const stage = els.graphGlobalStage;
    const sphere = els.graphGlobalSphere;
    if (!stage || !sphere) return;

    const rect = stage.getBoundingClientRect();
    const width = Math.max(700, Math.round(rect.width || 920));
    const height = Math.max(560, Math.round(rect.height || 760));
    const layout = buildGlobalGraphLayout(graph, width, height);
    graphGlobalScene.lastLayout = layout;

    if (els.graphGlobalCount) {
      const nodeLabel = layout.totalNodeCount > layout.nodeOrder.length
        ? `${layout.nodeOrder.length} de ${layout.totalNodeCount} nós`
        : `${layout.nodeOrder.length} nós`;
      els.graphGlobalCount.textContent = `${nodeLabel} · ${layout.clusters.length} ilhas`;
    }

    if (layout.nodeOrder.length === 0) {
      sphere.innerHTML = '<div class="empty-inline graph-global-empty">Sem relações</div>';
      updateGlobalGraphOverlay(layout, '', '');
      return;
    }

    ensureGlobalGraphSelection(layout);
    const { displayPath, displayCluster, featuredEdges } = buildGlobalGraphHighlights(layout);
    const starsMarkup = buildGlobalGraphStars(width, height);
    const blobMarkup = layout.clusters.map((cluster, index) => `<path class="graph-global-blob${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}" d="${graphGlobalBlobPath(cluster.x, cluster.y, cluster.rx, cluster.ry, index * 2.17)}" style="--blob-fill:${cluster.palette.blob}; --blob-stroke:${cluster.palette.stroke}; --blob-glow:${cluster.palette.glow};"></path>`).join('');
    const clusterLabelMarkup = layout.clusters.map((cluster) => `<g class="graph-global-cluster-meta${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}"><circle class="graph-global-cluster-beacon" cx="${(cluster.x - (cluster.rx * 0.5)).toFixed(2)}" cy="${(cluster.y - (cluster.ry * 0.58)).toFixed(2)}" r="7"></circle><text class="graph-global-cluster-label" x="${(cluster.x - (cluster.rx * 0.42)).toFixed(2)}" y="${(cluster.y - (cluster.ry * 0.52)).toFixed(2)}">${escapeHtml(cluster.label)}</text></g>`).join('');
    const edgeMarkup = layout.edges.map((edge) => {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (!from || !to) return '';
      const sameCluster = from.cluster.key === to.cluster.key;
      const featureKey = `${edge.from}->${edge.to}:${edge.kind}`;
      const isFeatured = featuredEdges.has(featureKey);
      const clusterVisible = !displayCluster || from.cluster.key === displayCluster || to.cluster.key === displayCluster;
      const opacity = displayPath ? (isFeatured ? 0.96 : clusterVisible ? (sameCluster ? 0.34 : 0.18) : 0.06) : displayCluster ? (sameCluster && clusterVisible ? 0.48 : clusterVisible ? 0.14 : 0.05) : (sameCluster ? 0.34 : 0.18);
      const strokeWidth = edge.kind === 'manual' ? 1.8 : edge.kind === 'folder' ? 1.1 : 1.35;
      return `<line class="graph-global-connection ${escapeHtml(edge.kind)}${isFeatured ? ' featured' : ''}${displayCluster && !clusterVisible ? ' dimmed' : ''}" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" style="--opacity:${opacity.toFixed(3)}; stroke-width:${strokeWidth};"></line>`;
    }).join('');
    const haloMarkup = layout.nodeOrder.map((entry) => entry.node.path === displayPath ? `<circle class="graph-global-halo active" cx="${entry.x.toFixed(2)}" cy="${entry.y.toFixed(2)}" r="${(entry.size + 8).toFixed(2)}"></circle>` : '').join('');
    const clusterHitsMarkup = layout.clusters.map((cluster) => `<button type="button" class="graph-global-cluster-hit${!displayCluster || displayCluster === cluster.key ? ' active' : ''}${displayCluster && displayCluster !== cluster.key ? ' dimmed' : ''}" data-cluster="${escapeHtml(cluster.key)}" aria-label="Focar assunto ${escapeHtml(cluster.label)}" title="${escapeHtml(cluster.label)}" style="left:${(cluster.x - cluster.rx).toFixed(2)}px; top:${(cluster.y - cluster.ry).toFixed(2)}px; width:${(cluster.rx * 2).toFixed(2)}px; height:${(cluster.ry * 2).toFixed(2)}px;"></button>`).join('');
    const nodeMarkup = layout.nodeOrder.map((entry) => {
      const active = entry.node.path === displayPath;
      const dimmed = displayCluster ? entry.cluster.key !== displayCluster : false;
      const fill = entry.node.kind === 'folder' ? entry.cluster.palette.folder : entry.isHub ? entry.cluster.palette.nodeStrong : entry.cluster.palette.node;
      const glow = entry.isHub ? entry.cluster.palette.glow : 'rgba(255,255,255,0.16)';
      return `<button type="button" class="graph-global-node ${escapeHtml(entry.node.kind)}${entry.isHub ? ' hub' : ''}${active ? ' active' : ''}${dimmed ? ' dimmed' : ''}" data-path="${escapeHtml(entry.node.path)}" data-kind="${escapeHtml(entry.node.kind)}" data-cluster="${escapeHtml(entry.cluster.key)}" data-title="${escapeHtml(entry.node.label)}" title="${escapeHtml(entry.node.label)}" style="left:${entry.x.toFixed(2)}px; top:${entry.y.toFixed(2)}px; --size:${entry.size.toFixed(2)}px; --node-fill:${fill}; --node-glow:${glow};"></button>`;
    }).join('');

    sphere.innerHTML = `<div class="graph-global-canvas" style="transform: translate(${graphGlobalViewport.x.toFixed(2)}px, ${graphGlobalViewport.y.toFixed(2)}px) scale(${graphGlobalViewport.scale.toFixed(3)}); width:${width}px; height:${height}px;"><svg class="graph-global-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="globalBlobGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs><g class="graph-global-stars">${starsMarkup}</g><g class="graph-global-blobs">${blobMarkup}</g><g class="graph-global-links">${edgeMarkup}</g><g class="graph-global-halos">${haloMarkup}</g><g class="graph-global-labels">${clusterLabelMarkup}</g></svg><div class="graph-global-hitlayer">${clusterHitsMarkup}${nodeMarkup}</div></div>`;
    updateGlobalGraphOverlay(layout, displayPath, displayCluster);
  }

  function resetIslandGlobalGraphViewport() {
    graphGlobalViewport.scale = 1;
    graphGlobalViewport.x = 0;
    graphGlobalViewport.y = 0;
  }

  function zoomIslandGlobalGraph(delta) {
    graphGlobalViewport.scale = Math.min(1.95, Math.max(0.76, graphGlobalViewport.scale + delta));
  }

  function startIslandGlobalGraphDrag(clientX, clientY) {
    graphGlobalViewport.dragging = true;
    graphGlobalViewport.lastX = clientX;
    graphGlobalViewport.lastY = clientY;
  }

  function moveIslandGlobalGraphDrag(clientX, clientY) {
    if (!graphGlobalViewport.dragging) return;
    const dx = clientX - graphGlobalViewport.lastX;
    const dy = clientY - graphGlobalViewport.lastY;
    graphGlobalViewport.lastX = clientX;
    graphGlobalViewport.lastY = clientY;
    graphGlobalViewport.x += dx;
    graphGlobalViewport.y += dy;
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }

  function stopIslandGlobalGraphDrag() {
    graphGlobalViewport.dragging = false;
  }

  function getIslandGlobalGraphNode(target) {
    return target instanceof HTMLElement ? target.closest('.graph-global-node') : null;
  }

  function getIslandGlobalGraphCluster(target) {
    return target instanceof HTMLElement ? target.closest('.graph-global-cluster-hit') : null;
  }

  function getGraphGlobalOverlayNode() {
    const overlay = els.graphGlobalOverlay;
    if (!overlay) return null;
    const pathValue = String(overlay.dataset.path ?? '').trim();
    if (!pathValue) return null;
    return (graphGlobalScene.lastGraph?.nodes ?? []).find((entry) => entry.path === pathValue) ?? null;
  }

  function focusIslandGlobalGraphNode(pathValue) {
    const normalizedPath = normalizeRelativePath(pathValue);
    graphGlobalScene.activePath = normalizedPath;
    const node = graphGlobalScene.lastGraph?.nodes?.find((entry) => normalizeRelativePath(entry.path) === normalizedPath);
    graphGlobalScene.activeCluster = node ? graphGlobalClusterKeyForNode(node) : graphGlobalScene.activeCluster;
    refreshGlobalGraphFocus();
  }

  function focusIslandGlobalGraphCluster(clusterKey) {
    graphGlobalScene.activePath = '';
    graphGlobalScene.activeCluster = clusterKey;
    refreshGlobalGraphFocus();
  }

  function openGlobalGraphNode(node) {
    if (!node) return;
    if (node.kind === 'folder') {
      state.selectedFolder = node.path;
      state.selectedFile = '';
      state.graphContext = { kind: 'folder', path: node.path };
      setView('workspace');
      syncWorkspaceState();
      void refreshWorkspace('', false).then(() => refreshGraph()).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir pasta'));
      return;
    }
    setView('workspace');
    void loadNote(node.path, { recordActivity: true, kind: 'open' }).catch((error) => showError(error instanceof Error ? error.message : 'Falha ao abrir nota do graph'));
  }

  function renderIslandGlobalGraphFrame() {
    graphGlobalScene.animationFrame = null;
    if (document.hidden || state.view !== 'relations') return;
    renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
  }

  function closeIslandGlobalGraphOverlay() {
    graphGlobalScene.activePath = '';
    graphGlobalScene.hoverPath = '';
    graphGlobalScene.hoverCluster = '';
    refreshGlobalGraphFocus();
  }

  function refreshGlobalGraphFocus() {
    const layout = graphGlobalScene.lastLayout;
    if (!layout) {
      renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
      return;
    }

    ensureGlobalGraphSelection(layout);
    const { displayPath, displayCluster } = buildGlobalGraphHighlights(layout);
    els.graphGlobalSphere?.querySelectorAll('.graph-global-node').forEach((element) => {
      element.classList.toggle('active', element.dataset.path === displayPath);
      element.classList.toggle('dimmed', Boolean(displayCluster) && element.dataset.cluster !== displayCluster);
    });
    els.graphGlobalSphere?.querySelectorAll('.graph-global-cluster-hit').forEach((element) => {
      element.classList.toggle('active', !displayCluster || element.dataset.cluster === displayCluster);
      element.classList.toggle('dimmed', Boolean(displayCluster) && element.dataset.cluster !== displayCluster);
    });
    updateGlobalGraphOverlay(layout, displayPath, displayCluster);
  }

  function startIslandGlobalGraphAnimation() {
    if (document.hidden || state.view !== 'relations') return;
    renderIslandGlobalGraphFrame();
  }

  function stopIslandGlobalGraphAnimation() {
    if (graphGlobalScene.animationFrame !== null) {
      window.cancelAnimationFrame(graphGlobalScene.animationFrame);
      graphGlobalScene.animationFrame = null;
    }
  }

  async function refreshGlobalGraph() {
    const vaultRoot = getConfiguredVaultRoot();
    if (!vaultRoot) {
      state.graphGlobal = { vaultRoot: '', nodes: [], edges: [] };
      renderIslandGlobalGraph(state.graphGlobal);
      return;
    }
    const params = new URLSearchParams({ vaultRoot });
    if (state.selectedFile) params.set('focusPath', state.selectedFile);
    else if (state.selectedFolder) params.set('focusPath', state.selectedFolder);
    const data = await api(`/api/graph-global?${params.toString()}`);
    state.graphGlobal = data;
    renderIslandGlobalGraph(state.graphGlobal);
  }

  async function openRelationsView() {
    if (!getConfiguredVaultRoot()) {
      if (isDesktopShell) await startVault().catch(() => null);
      if (!getConfiguredVaultRoot()) {
        setView('setup');
        showError('Abra ou crie um vault antes de ver relações.');
        return;
      }
    }

    setView('relations');
    closeRelationsDetailsMenu();
    resetIslandGlobalGraphViewport();
    graphGlobalScene.activePath = '';
    graphGlobalScene.activeCluster = '';
    graphGlobalScene.hoverPath = '';
    graphGlobalScene.hoverCluster = '';
    await refreshRelationsSurface();
    startIslandGlobalGraphAnimation();
  }

  function handleResize() {
    if (state.view === 'relations') {
      renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
    }
  }

  function bindEvents() {
    document.addEventListener('visibilitychange', () => {
      document.body.classList.toggle('graph-motion-paused', document.hidden);
      if (!document.hidden && state.view === 'relations') {
        refreshGlobalGraphFocus();
      }
    });
    els.graphGlobalStage.addEventListener('pointerdown', (event) => {
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      if (node || cluster) return;
      graphGlobalScene.hoverPath = '';
      graphGlobalScene.hoverCluster = '';
      graphGlobalScene.dragging = true;
      graphGlobalScene.moved = false;
      graphGlobalScene.startX = event.clientX;
      graphGlobalScene.startY = event.clientY;
      startIslandGlobalGraphDrag(event.clientX, event.clientY);
      els.graphGlobalStage.setPointerCapture(event.pointerId);
    });
    els.graphGlobalStage.addEventListener('pointermove', (event) => {
      if (graphGlobalViewport.dragging) {
        const dx = Math.abs(event.clientX - graphGlobalScene.startX);
        const dy = Math.abs(event.clientY - graphGlobalScene.startY);
        if (dx > 2 || dy > 2) graphGlobalScene.moved = true;
        moveIslandGlobalGraphDrag(event.clientX, event.clientY);
        return;
      }
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      const path = node?.dataset.path || '';
      const clusterKey = node ? '' : (cluster?.dataset.cluster || '');
      if (path !== graphGlobalScene.hoverPath || clusterKey !== graphGlobalScene.hoverCluster) {
        graphGlobalScene.hoverPath = path;
        graphGlobalScene.hoverCluster = clusterKey;
        refreshGlobalGraphFocus();
      }
    });
    els.graphGlobalStage.addEventListener('pointerleave', () => {
      graphGlobalScene.hoverPath = '';
      graphGlobalScene.hoverCluster = '';
      refreshGlobalGraphFocus();
    });
    els.graphGlobalStage.addEventListener('pointerup', () => {
      graphGlobalScene.dragging = false;
      graphGlobalScene.moved = false;
      stopIslandGlobalGraphDrag();
    });
    els.graphGlobalStage.addEventListener('pointercancel', () => {
      graphGlobalScene.dragging = false;
      graphGlobalScene.moved = false;
      stopIslandGlobalGraphDrag();
    });
    els.graphGlobalStage.addEventListener('wheel', (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      zoomIslandGlobalGraph(delta);
      renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
    }, { passive: false });
    els.graphGlobalStage.addEventListener('dblclick', (event) => {
      if (getIslandGlobalGraphNode(event.target) || getIslandGlobalGraphCluster(event.target)) return;
      resetIslandGlobalGraphViewport();
      renderIslandGlobalGraph(graphGlobalScene.lastGraph || state.graphGlobal);
    });
    els.graphGlobalSphere.addEventListener('click', (event) => {
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      if (graphGlobalScene.moved) return;
      if (node?.dataset.path) {
        focusIslandGlobalGraphNode(node.dataset.path);
        return;
      }
      if (cluster?.dataset.cluster !== undefined) focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
    });
    els.graphGlobalSphere.addEventListener('pointerover', (event) => {
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      const path = node?.dataset.path || '';
      const clusterKey = node ? '' : (cluster?.dataset.cluster || '');
      if (path !== graphGlobalScene.hoverPath || clusterKey !== graphGlobalScene.hoverCluster) {
        graphGlobalScene.hoverPath = path;
        graphGlobalScene.hoverCluster = clusterKey;
        refreshGlobalGraphFocus();
      }
    });
    els.graphGlobalSphere.addEventListener('pointerout', (event) => {
      const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.graph-global-node') : null;
      const relatedCluster = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.graph-global-cluster-hit') : null;
      if (related || relatedCluster) return;
      if (!graphGlobalViewport.dragging && (graphGlobalScene.hoverPath || graphGlobalScene.hoverCluster)) {
        graphGlobalScene.hoverPath = '';
        graphGlobalScene.hoverCluster = '';
        refreshGlobalGraphFocus();
      }
    });
    els.graphGlobalSphere.addEventListener('dblclick', (event) => {
      const node = getIslandGlobalGraphNode(event.target);
      if (!node || graphGlobalScene.moved) return;
      const selected = (graphGlobalScene.lastGraph?.nodes ?? []).find((entry) => entry.path === node.dataset.path);
      openGlobalGraphNode(selected ?? null);
    });
    els.graphGlobalSphere.addEventListener('contextmenu', (event) => {
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      if (!node && !cluster) return;
      event.preventDefault();
      if (node?.dataset.path) {
        focusIslandGlobalGraphNode(node.dataset.path);
        return;
      }
      if (cluster?.dataset.cluster !== undefined) focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
    });
    els.graphGlobalSphere.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const node = getIslandGlobalGraphNode(event.target);
      const cluster = getIslandGlobalGraphCluster(event.target);
      if (!node && !cluster) return;
      event.preventDefault();
      if (node?.dataset.path) {
        focusIslandGlobalGraphNode(node.dataset.path);
        return;
      }
      if (cluster?.dataset.cluster !== undefined) focusIslandGlobalGraphCluster(cluster.dataset.cluster || '');
    });
    els.graphGlobalOverlay?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      const node = getGraphGlobalOverlayNode();
      if (!node?.path) return;
      focusIslandGlobalGraphNode(node.path);
    });
    els.graphGlobalOverlay?.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      const node = getGraphGlobalOverlayNode();
      if (!node) return;
      openGlobalGraphNode(node);
    });
    els.graphGlobalOverlayOpenButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      const node = getGraphGlobalOverlayNode();
      if (!node) return;
      openGlobalGraphNode(node);
    });
    els.graphGlobalOverlayFocusButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      const node = getGraphGlobalOverlayNode();
      if (!node?.path) return;
      focusIslandGlobalGraphNode(node.path);
    });
    els.graphGlobalOverlayCloseButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      closeIslandGlobalGraphOverlay();
    });
  }

  return {
    bindEvents,
    closeIslandGlobalGraphOverlay,
    focusIslandGlobalGraphCluster,
    focusIslandGlobalGraphNode,
    getGraphGlobalOverlayNode,
    getIslandGlobalGraphCluster,
    getIslandGlobalGraphNode,
    handleResize,
    moveIslandGlobalGraphDrag,
    openRelationsView,
    refreshGlobalGraph,
    renderIslandGlobalGraph,
    renderIslandGlobalGraphFrame,
    resetIslandGlobalGraphViewport,
    startIslandGlobalGraphDrag,
    startIslandGlobalGraphAnimation,
    stopIslandGlobalGraphAnimation,
    stopIslandGlobalGraphDrag,
    zoomIslandGlobalGraph
  };
}
