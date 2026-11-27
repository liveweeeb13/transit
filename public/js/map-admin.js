const DEFAULT_COLORS = {
  line: '#ef4444',
  road: '#ffffff',
  water: '#aad3df',
  land: '#cdebb0',
  building: '#d9d0c9',
  connector: '#ffffff'
};

const state = {
  tool: 'stop',
  stops: [],
  shapes: [], // { type: 'line'|'road'|'water'|'land', label, color, width, dashed, points: [[x,y], ...] }
  currentPoints: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  draggingPoint: null, // { shapeIndex, ptIndex }
  hideObjects: false
};

const svg = document.getElementById('admin-svg');
const world = document.getElementById('admin-world');
const viewport = document.getElementById('admin-viewport');
const bgImage = document.getElementById('bg-image');
const coordsEl = document.getElementById('coords-indicator');
const countEl = document.getElementById('elements-count');

const layers = {
  land: document.getElementById('layer-land'),
  water: document.getElementById('layer-water'),
  buildings: document.getElementById('layer-buildings'),
  roads: document.getElementById('layer-roads'),
  lines: document.getElementById('layer-lines'),
  preview: document.getElementById('layer-preview'),
  stops: document.getElementById('layer-stops')
};

const propStop = document.getElementById('prop-stop');
const propDraw = document.getElementById('prop-draw');
const drawColor = document.getElementById('draw-color');
const drawWidth = document.getElementById('draw-width');
const widthVal = document.getElementById('width-val');
const drawDashed = document.getElementById('draw-dashed');
const drawLabel = document.getElementById('draw-label');

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function getSvgCoords(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const transformed = pt.matrixTransform(world.getScreenCTM().inverse());
  return [Math.round(transformed.x), Math.round(transformed.y)];
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    finishCurrentPath();
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;

    propStop.classList.toggle('hidden', state.tool !== 'stop');
    propDraw.classList.toggle('hidden', ['stop', 'pan'].includes(state.tool));
    viewport.classList.toggle('panning', state.tool === 'pan');

    if (DEFAULT_COLORS[state.tool]) {
      drawColor.value = DEFAULT_COLORS[state.tool];
    }
    if (state.tool === 'water' || state.tool === 'land') {
      drawWidth.value = 18;
      widthVal.textContent = '18';
    } else if (state.tool === 'road') {
      drawWidth.value = 8;
      widthVal.textContent = '8';
    } else if (state.tool === 'line') {
      drawWidth.value = 6;
      widthVal.textContent = '6';
    } else if (state.tool === 'connector') {
      drawWidth.value = 2;
      widthVal.textContent = '2';
    }
  });
});

drawWidth.addEventListener('input', () => {
  widthVal.textContent = drawWidth.value;
});

document.getElementById('bg-opacity').addEventListener('input', (e) => {
  document.getElementById('bg-opacity-val').textContent = e.target.value;
  bgImage.setAttribute('opacity', e.target.value / 100);
});

function renderAll() {
  layers.land.innerHTML = '';
  layers.water.innerHTML = '';
  layers.buildings.innerHTML = '';
  layers.roads.innerHTML = '';
  layers.lines.innerHTML = '';
  layers.stops.innerHTML = '';

  state.shapes.forEach((s, idx) => {
    const pts = s.points.map(p => `${p[0]},${p[1]}`).join(' ');
    const isSurface = s.type === 'water' || s.type === 'land' || s.type === 'building';
    const el = createSvgEl(isSurface ? 'polygon' : 'polyline', {
      points: pts,
      fill: isSurface ? s.color : 'none',
      stroke: isSurface ? 'rgba(0,0,0,0.15)' : s.color,
      'stroke-width': isSurface ? 1.5 : s.width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: 'cursor: pointer;'
    });
    if (s.dashed && !isSurface) el.setAttribute('stroke-dasharray', '10,8');

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, 'shape', idx);
    });

    const targetLayer = s.type === 'land' ? layers.land
      : s.type === 'water' ? layers.water
      : s.type === 'building' ? layers.buildings
      : s.type === 'road' ? layers.roads
      : layers.lines;
    targetLayer.appendChild(el);

    if (s.type === 'building' && s.label && s.label !== 'building' && s.points.length > 0) {
      const cx = s.points.reduce((sum, p) => sum + p[0], 0) / s.points.length;
      const cy = s.points.reduce((sum, p) => sum + p[1], 0) / s.points.length;
      const bLabel = createSvgEl('text', {
        x: cx,
        y: cy,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'admin-stop-label'
      });
      bLabel.textContent = s.label;
      layers.buildings.appendChild(bLabel);
    }

    s.points.forEach((pt, ptIdx) => {
      const v = createSvgEl('circle', {
        cx: pt[0],
        cy: pt[1],
        r: 4.5,
        fill: '#ffffff',
        stroke: s.color,
        'stroke-width': 1.5,
        style: 'cursor: grab;',
        opacity: 0.85
      });
      v.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || state.tool !== 'pan') return;
        e.stopPropagation();
        state.draggingPoint = { shapeIndex: idx, ptIndex: ptIdx };
      });
      v.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY, 'point', idx, ptIdx);
      });
      targetLayer.appendChild(v);
    });
  });

  state.stops.forEach((st, idx) => {
    const g = createSvgEl('g', { style: 'cursor: pointer;' });
    g.appendChild(createSvgEl('circle', {
      cx: st.x,
      cy: st.y,
      r: st.pole ? 8 : 5.5,
      fill: '#ffffff',
      stroke: '#0f172a',
      'stroke-width': st.pole ? 3 : 2
    }));
    const label = createSvgEl('text', {
      x: st.x + 10,
      y: st.y + 4,
      class: 'admin-stop-label'
    });
    label.textContent = st.name;
    g.appendChild(label);

    g.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || state.tool !== 'line') return;
      e.stopPropagation();
      state.currentPoints.push([st.x, st.y]);
      renderPreview();
    });

    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, 'stop', idx);
    });

    layers.stops.appendChild(g);
  });

  renderPreview();
  countEl.textContent = `${state.stops.length} arrêts · ${state.shapes.length} tracés`;
  const payload = { stops: state.stops, shapes: state.shapes };
  localStorage.setItem('transit_custom_map', JSON.stringify(payload));
  fetch('/api/map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function findSnapPoint(x, y, excludeShapeIdx = -1, excludePtIdx = -1) {
  const threshold = 12 / state.zoom;
  let best = null;
  let bestDist = threshold;
  state.shapes.forEach((s, sIdx) => {
    s.points.forEach((pt, pIdx) => {
      if (sIdx === excludeShapeIdx && pIdx === excludePtIdx) return;
      const d = Math.hypot(pt[0] - x, pt[1] - y);
      if (d < bestDist) {
        bestDist = d;
        best = [pt[0], pt[1]];
      }
    });
  });
  return best;
}

function renderPreview() {
  layers.preview.innerHTML = '';
  if (state.currentPoints.length > 0) {
    const pts = state.currentPoints.map(p => `${p[0]},${p[1]}`).join(' ');
    const isSurface = state.tool === 'water' || state.tool === 'land' || state.tool === 'building';
    layers.preview.appendChild(createSvgEl(isSurface && state.currentPoints.length >= 3 ? 'polygon' : 'polyline', {
      points: pts,
      fill: isSurface && state.currentPoints.length >= 3 ? drawColor.value : 'none',
      'fill-opacity': 0.5,
      stroke: drawColor.value,
      'stroke-width': isSurface ? 2 : drawWidth.value,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: 0.85
    }));

    state.currentPoints.forEach(p => {
      layers.preview.appendChild(createSvgEl('circle', {
        cx: p[0], cy: p[1], r: 4, fill: '#38bdf8'
      }));
    });
  }

  if (state.snapPoint) {
    layers.preview.appendChild(createSvgEl('circle', {
      cx: state.snapPoint[0], cy: state.snapPoint[1], r: 7,
      fill: 'none', stroke: '#facc15', 'stroke-width': 2
    }));
  }
}

function finishCurrentPath() {
  if (state.currentPoints.length >= 2) {
    state.shapes.push({
      type: state.tool,
      label: drawLabel.value.trim() || state.tool,
      color: drawColor.value,
      width: Number(drawWidth.value),
      dashed: drawDashed.checked,
      points: [...state.currentPoints]
    });
  }
  state.currentPoints = [];
  renderAll();
}

document.getElementById('btn-finish-path').addEventListener('click', finishCurrentPath);
document.getElementById('btn-cancel-path').addEventListener('click', () => {
  state.currentPoints = [];
  renderPreview();
});

viewport.addEventListener('mousedown', (e) => {
  if (e.button === 1 || state.tool === 'pan') {
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    return;
  }

  if (e.button !== 0) return;
  const [x, y] = getSvgCoords(e);

  if (state.tool === 'stop') {
    const nameInput = document.getElementById('stop-name');
    const linesInput = document.getElementById('stop-lines');
    const poleInput = document.getElementById('stop-pole');
    const name = nameInput.value.trim() || `Arrêt ${state.stops.length + 1}`;
    const lines = linesInput.value.split(',').map(s => s.trim()).filter(Boolean);

    state.stops.push({ name, x, y, lines, pole: poleInput.checked });
    nameInput.value = '';
    renderAll();
  } else {
    const snapped = findSnapPoint(x, y);
    state.currentPoints.push(snapped || [x, y]);
    renderPreview();
  }
});

window.addEventListener('mousemove', (e) => {
  const [x, y] = getSvgCoords(e);
  coordsEl.textContent = `X: ${x} · Y: ${y} · ${Math.round(state.zoom * 100)}%`;

  if (state.draggingPoint) {
    const { shapeIndex, ptIndex } = state.draggingPoint;
    const snapped = findSnapPoint(x, y, shapeIndex, ptIndex);
    state.shapes[shapeIndex].points[ptIndex] = snapped || [x, y];
    renderAll();
    return;
  }

  if (!state.isDragging) {
    if (state.tool !== 'stop' && state.tool !== 'pan') {
      state.snapPoint = findSnapPoint(x, y);
      renderPreview();
    }
    return;
  }
  const rect = svg.getBoundingClientRect();
  state.panX += (e.clientX - state.dragStartX) * (1200 / rect.width);
  state.panY += (e.clientY - state.dragStartY) * (1000 / rect.height);
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  applyTransform();
});

window.addEventListener('mouseup', () => {
  state.isDragging = false;
  if (state.draggingPoint) {
    state.draggingPoint = null;
    renderAll();
  }
});

viewport.addEventListener('dblclick', (e) => {
  if (state.tool !== 'stop' && state.tool !== 'pan' && state.currentPoints.length >= 2) {
    e.preventDefault();
    finishCurrentPath();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    state.hideObjects = !state.hideObjects;
    const display = state.hideObjects ? 'none' : 'inline';
    Object.values(layers).forEach(layer => {
      layer.style.display = display;
    });
    return;
  }
  if (e.key === 'Enter') finishCurrentPath();
  if (e.key === 'Escape') {
    state.currentPoints = [];
    renderPreview();
  }
});

function applyTransform() {
  world.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);
}

function zoomAt(factor) {
  const newZoom = Math.min(5, Math.max(0.5, state.zoom * factor));
  const ratio = newZoom / state.zoom;
  state.panX = 600 - (600 - state.panX) * ratio;
  state.panY = 500 - (500 - state.panY) * ratio;
  state.zoom = newZoom;
  applyTransform();
}

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.deltaY < 0 ? 1.15 : 0.87);
}, { passive: false });

document.getElementById('btn-zoom-in').addEventListener('click', () => zoomAt(1.25));
document.getElementById('btn-zoom-out').addEventListener('click', () => zoomAt(0.8));
document.getElementById('btn-zoom-reset').addEventListener('click', () => {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (state.currentPoints.length > 0) {
    state.currentPoints.pop();
  } else if (state.tool === 'stop' && state.stops.length > 0) {
    state.stops.pop();
  } else if (state.shapes.length > 0) {
    state.shapes.pop();
  }
  renderAll();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Tout effacer ?')) return;
  state.stops = [];
  state.shapes = [];
  state.currentPoints = [];
  renderAll();
});

document.getElementById('btn-export').addEventListener('click', async () => {
  const data = JSON.stringify({ stops: state.stops, shapes: state.shapes }, null, 2);
  await navigator.clipboard.writeText(data);
  const btn = document.getElementById('btn-export');
  btn.textContent = '✅ JSON copié !';
  setTimeout(() => { btn.textContent = '📋 Copier JSON'; }, 2000);
});

async function initAdmin() {
  try {
    const res = await fetch('/api/map');
    if (res.ok) {
      const data = await res.json();
      state.stops = data.stops || [];
      state.shapes = data.shapes || [];
    }
  } catch (_) {
    try {
      const saved = JSON.parse(localStorage.getItem('transit_custom_map') || '{}');
      state.stops = saved.stops || [];
      state.shapes = saved.shapes || [];
    } catch (_) {}
  }
  renderAll();
  applyTransform();
}

const ctxMenu = document.getElementById('context-menu');
let ctxTarget = null; // { kind: 'stop'|'shape'|'point', index: number, ptIndex?: number }

function openContextMenu(x, y, kind, index, ptIndex = null) {
  ctxTarget = { kind, index, ptIndex };
  document.getElementById('ctx-add-point').style.display = kind === 'point' ? 'block' : 'none';
  document.getElementById('ctx-edit').style.display = kind === 'point' ? 'none' : 'block';
  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top = `${y}px`;
  ctxMenu.classList.remove('hidden');
}

document.getElementById('ctx-add-point').addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.kind !== 'point') return;
  const sh = state.shapes[ctxTarget.index];
  const i = ctxTarget.ptIndex;
  const nextIdx = (i + 1) % sh.points.length;
  const midX = Math.round((sh.points[i][0] + sh.points[nextIdx][0]) / 2);
  const midY = Math.round((sh.points[i][1] + sh.points[nextIdx][1]) / 2);
  sh.points.splice(i + 1, 0, [midX, midY]);
  ctxMenu.classList.add('hidden');
  renderAll();
});

window.addEventListener('click', () => {
  ctxMenu.classList.add('hidden');
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  if (!ctxTarget) return;
  if (ctxTarget.kind === 'stop') {
    state.stops.splice(ctxTarget.index, 1);
  } else if (ctxTarget.kind === 'point') {
    const sh = state.shapes[ctxTarget.index];
    sh.points.splice(ctxTarget.ptIndex, 1);
    if (sh.points.length < 2) {
      state.shapes.splice(ctxTarget.index, 1);
    }
  } else {
    state.shapes.splice(ctxTarget.index, 1);
  }
  ctxMenu.classList.add('hidden');
  renderAll();
});

document.getElementById('ctx-edit').addEventListener('click', () => {
  if (!ctxTarget) return;
  ctxMenu.classList.add('hidden');
  if (ctxTarget.kind === 'stop') {
    const st = state.stops[ctxTarget.index];
    const newName = prompt("Nom de l'arrêt :", st.name);
    if (newName === null) return;
    const newLines = prompt('Lignes (séparées par des virgules) :', (st.lines || []).join(', '));
    if (newLines === null) return;
    st.name = newName.trim() || st.name;
    st.lines = newLines.split(',').map(s => s.trim()).filter(Boolean);
    st.pole = confirm('Est-ce un Pôle de mobilité ? (OK = Oui, Annuler = Non)');
  } else {
    const sh = state.shapes[ctxTarget.index];
    const newLabel = prompt('Nom / ID du tracé :', sh.label || '');
    if (newLabel === null) return;
    const newColor = prompt('Couleur (hex, ex: #ef4444) :', sh.color);
    if (newColor === null) return;
    sh.label = newLabel.trim() || sh.label;
    sh.color = newColor.trim() || sh.color;
  }
  renderAll();
});

initAdmin();
