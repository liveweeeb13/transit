function loadAdminData() {
  try {
    const saved = localStorage.getItem('transit_custom_map');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return { stops: [], shapes: [] };
}

const adminData = loadAdminData();

const LINES = [];
const seenLines = new Set();
adminData.shapes.filter(s => s.type === 'line').forEach(s => {
  const id = s.label || 'Ligne';
  if (!seenLines.has(id)) {
    seenLines.add(id);
    LINES.push({ id, name: id, category: 'Ligne', color: s.color, width: s.width, dashed: s.dashed });
  }
});

const STOPS = {};
adminData.stops.forEach((st, idx) => {
  STOPS[`stop_${idx}`] = {
    name: st.name,
    x: st.x,
    y: st.y,
    lines: st.lines || [],
    pole: !!st.pole
  };
});

const state = {
  activeLines: new Set(LINES.map(l => l.id)),
  focusedStop: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
};

const svg = document.getElementById('transit-map');
const mapWorld = document.getElementById('map-world');
const layerGeo = document.getElementById('layer-geo');
const layerLines = document.getElementById('layer-lines');
const layerStops = document.getElementById('layer-stops');
const layerLabels = document.getElementById('layer-labels');
const viewport = document.getElementById('map-viewport');
const zoomIndicator = document.getElementById('zoom-indicator');
const linesListEl = document.getElementById('lines-list');
const stopSearchInput = document.getElementById('stop-search');
const searchResultsEl = document.getElementById('search-results');
const stopDetailsEl = document.getElementById('stop-details');

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function renderGeo() {
  layerGeo.innerHTML = '';
  const geoOrder = { land: 0, water: 1, building: 2, road: 3 };
  adminData.shapes
    .filter(s => s.type !== 'line')
    .sort((a, b) => (geoOrder[a.type] ?? 4) - (geoOrder[b.type] ?? 4))
    .forEach(s => {
    const pts = s.points.map(p => `${p[0]},${p[1]}`).join(' ');
    const isSurface = s.type === 'water' || s.type === 'land' || s.type === 'building';
    const el = createSvgEl(isSurface ? 'polygon' : 'polyline', {
      points: pts,
      fill: isSurface ? s.color : 'none',
      stroke: isSurface ? 'rgba(0,0,0,0.15)' : s.color,
      'stroke-width': isSurface ? 1.5 : s.width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    });
    if (s.dashed && !isSurface) el.setAttribute('stroke-dasharray', '10,8');
    layerGeo.appendChild(el);

    if (s.type === 'building' && s.label && s.label !== 'building' && s.points.length > 0) {
      const cx = s.points.reduce((sum, p) => sum + p[0], 0) / s.points.length;
      const cy = s.points.reduce((sum, p) => sum + p[1], 0) / s.points.length;
      const bLabel = createSvgEl('text', {
        x: cx,
        y: cy,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'stop-label'
      });
      bLabel.textContent = s.label;
      layerGeo.appendChild(bLabel);
    }
  });
}

function renderLines() {
  layerLines.innerHTML = '';

  adminData.shapes.filter(s => s.type === 'line').forEach(s => {
    const lineId = s.label || 'Ligne';
    if (!state.activeLines.has(lineId)) return;

    const pts = s.points.map(p => `${p[0]},${p[1]}`).join(' ');
    const path = createSvgEl('polyline', {
      points: pts,
      stroke: s.color,
      'stroke-width': s.width,
      class: 'line-path',
      filter: 'url(#glow)',
      'data-line': lineId
    });

    if (s.dashed) {
      path.setAttribute('stroke-dasharray', '10,8');
    }

    const title = createSvgEl('title');
    title.textContent = `Ligne ${lineId}`;
    path.appendChild(title);

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLine(lineId);
    });

    layerLines.appendChild(path);
  });
}

function isTerminus(stop) {
  return adminData.shapes.some(s => {
    if (s.type !== 'line' || !s.points || s.points.length < 2) return false;
    const first = s.points[0];
    const last = s.points[s.points.length - 1];
    const near = (p) => Math.hypot(p[0] - stop.x, p[1] - stop.y) <= 6;
    return near(first) || near(last);
  });
}

function renderStops() {
  layerStops.innerHTML = '';
  layerLabels.innerHTML = '';

  Object.entries(STOPS).forEach(([id, stop]) => {
    const isFocused = state.focusedStop === id;
    const hasActiveLine = stop.lines.length === 0 || stop.lines.some(l => state.activeLines.has(l));
    const terminus = isTerminus(stop);

    const g = createSvgEl('g', {
      class: 'stop-node',
      'data-stop': id,
      opacity: hasActiveLine ? '1' : '0.15'
    });

    if (isFocused) {
      g.appendChild(createSvgEl('circle', {
        cx: stop.x,
        cy: stop.y,
        r: 20,
        fill: 'rgba(56, 189, 248, 0.35)',
        stroke: '#38bdf8',
        'stroke-width': 3
      }));
    }

    const circle = createSvgEl('circle', {
      cx: stop.x,
      cy: stop.y,
      r: isFocused ? 8 : (terminus || stop.pole ? 7 : 5.5),
      class: 'stop-hit',
      fill: isFocused ? '#38bdf8' : '#ffffff',
      stroke: isFocused ? '#ffffff' : '#0f172a',
      'stroke-width': terminus || stop.pole ? 2.5 : 2
    });
    g.appendChild(circle);
 
 const label = createSvgEl('text', {
      x: stop.x + 11,
      y: stop.y + 4,
      class: `stop-label ${terminus || isFocused ? '' : 'hover-only'}`
    });
    label.textContent = stop.name;
    g.appendChild(label);

    const title = createSvgEl('title');
    title.textContent = `${stop.name}${stop.lines.length ? ' (' + stop.lines.join(', ') + ')' : ''}`;
    g.appendChild(title);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      focusStop(id);
    });

    layerStops.appendChild(g);
  });
}

const LINE_META = {
  TER: { cat: 'TER', desc: 'Hauts-de-France', color: '#64748b', icon: 'TER.png' },
  T1: { cat: 'Tram', desc: 'Hôtel de Ville ↔ Plage du Moulin', color: '#f97316', icon: 'T1.png' },
  T2: { cat: 'Tram', desc: 'Vosges ↔ Stade', color: '#ef4444', icon: 'T2.png' },
  T3: { cat: 'Tram', desc: 'Gare SNCF - Yelle sur Mer ↔ Les Écluses', color: '#22c55e', icon: 'T3.png' },
  T4: { cat: 'Tram', desc: 'Hôtel de Ville ↔ Gare Routière', color: '#06b6d4', icon: 'T4.png' },
  C1: { cat: 'Express', desc: 'Gare Routière ↔ Stade', color: '#eab308', icon: 'C1.png' },
  C2: { cat: 'Express', desc: 'Gare Routière ↔ Gare SNCF - Yelle sur Mer', color: '#eab308', icon: 'C2.png' },
  '15': { cat: 'Bus urbains', desc: 'Hôtel de Ville ↔ Hôpital Saint-Martin', color: '#16a34a', icon: 'bus15.png' },
  '80': { cat: 'Bus urbains', desc: 'Hôtel de Ville ↔ Tour Panoramique', color: '#16a34a', icon: 'bus80.png' },
  '20': { cat: 'Bus périurbains', desc: 'Gare Routière ↔ Les Écluses', color: '#0284c7', icon: 'bus20.png' },
  '40': { cat: 'Bus de proximité', desc: 'Le Belvédère • Boucle', color: '#ec4899', icon: 'bus40.png' }
};

const CAT_COLORS = {
  'TER': '#64748b',
  'Tram': '#0f172a',
  'Express': '#eab308',
  'Bus urbains': '#16a34a',
  'Bus périurbains': '#0284c7',
  'Bus de proximité': '#ec4899'
};

function renderLinesSidebar() {
  linesListEl.innerHTML = '';
  const groups = {};
  LINES.forEach(line => {
    const meta = LINE_META[line.id] || { cat: 'Autres', desc: line.name, color: line.color, icon: `${line.id}.png` };
    if (!groups[meta.cat]) groups[meta.cat] = [];
    groups[meta.cat].push({ ...line, ...meta });
  });

  Object.entries(groups).forEach(([cat, items]) => {
    const catHeader = document.createElement('div');
    catHeader.className = 'legend-cat-header';
    const catColor = CAT_COLORS[cat] || '#64748b';
    catHeader.innerHTML = `
      <span class="legend-cat-pill" style="background:${catColor}">${cat}</span>
      <span class="legend-cat-bar" style="background:${catColor}"></span>
    `;
    linesListEl.appendChild(catHeader);

    items.forEach(line => {
      const isActive = state.activeLines.has(line.id);
      const item = document.createElement('div');
      item.className = `line-toggle ${isActive ? '' : 'inactive'}`;
      item.innerHTML = `
        <img class="line-logo-img" src="/assets/img/${line.icon}" alt="${line.id}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';">
        <span class="line-badge" style="background:${line.color};display:none;">${line.id}</span>
        <div class="line-info">
          <div class="line-name">${line.desc}</div>
        </div>
        <div class="line-check">${isActive ? '✓' : ''}</div>
      `;
      item.addEventListener('click', () => toggleLine(line.id));
      linesListEl.appendChild(item);
    });
  });
}

function toggleLine(lineId) {
  if (state.activeLines.has(lineId)) {
    state.activeLines.delete(lineId);
  } else {
    state.activeLines.add(lineId);
  }
  renderLinesSidebar();
  renderLines();
  renderStops();
}

document.getElementById('btn-all-lines').addEventListener('click', () => {
  state.activeLines = new Set(LINES.map(l => l.id));
  renderLinesSidebar();
  renderLines();
  renderStops();
});

document.getElementById('btn-no-lines').addEventListener('click', () => {
  state.activeLines.clear();
  renderLinesSidebar();
  renderLines();
  renderStops();
});

function focusStop(stopId) {
  const stop = STOPS[stopId];
  if (!stop) return;

  state.focusedStop = stopId;
  state.zoom = 2.2;
  state.panX = 600 - stop.x * state.zoom;
  state.panY = 500 - stop.y * state.zoom;

  applyTransform();
  renderStops();
  showStopDetails(stopId);
}

function showStopDetails(stopId) {
  const stop = STOPS[stopId];
  document.getElementById('detail-type').textContent = stop.pole ? 'Pôle de mobilité' : 'Arrêt';
  document.getElementById('detail-name').textContent = stop.name;

  const detailLinesEl = document.getElementById('detail-lines');
  detailLinesEl.innerHTML = '';
  stop.lines.forEach(lineId => {
    const line = LINES.find(l => l.id === lineId);
    if (!line) return;
    const badge = document.createElement('span');
    badge.className = 'line-badge';
    badge.style.background = line.color;
    badge.textContent = line.id;
    detailLinesEl.appendChild(badge);
  });

  stopDetailsEl.classList.remove('hidden');
}

document.getElementById('btn-close-details').addEventListener('click', () => {
  state.focusedStop = null;
  stopDetailsEl.classList.add('hidden');
  renderStops();
});

document.getElementById('btn-refocus').addEventListener('click', () => {
  if (state.focusedStop) focusStop(state.focusedStop);
});

stopSearchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    searchResultsEl.classList.add('hidden');
    return;
  }

  const matches = Object.entries(STOPS)
    .filter(([, s]) => s.name.toLowerCase().includes(q))
    .slice(0, 8);

  if (matches.length === 0) {
    searchResultsEl.classList.add('hidden');
    return;
  }

  searchResultsEl.innerHTML = matches.map(([id, s]) => `
    <div class="search-item" data-id="${id}">
      <span>${s.name}</span>
      <small style="color:var(--text-muted)">${s.lines.join(', ')}</small>
    </div>
  `).join('');

  searchResultsEl.querySelectorAll('.search-item').forEach(el => {
    el.addEventListener('click', () => {
      focusStop(el.dataset.id);
      searchResultsEl.classList.add('hidden');
      stopSearchInput.value = '';
    });
  });

  searchResultsEl.classList.remove('hidden');
});

function applyTransform() {
  mapWorld.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);
  zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
}

function zoomAt(factor) {
  const newZoom = Math.min(5, Math.max(0.5, state.zoom * factor));
  const ratio = newZoom / state.zoom;
  state.panX = 600 - (600 - state.panX) * ratio;
  state.panY = 500 - (500 - state.panY) * ratio;
  state.zoom = newZoom;
  applyTransform();
}

document.getElementById('btn-zoom-in').addEventListener('click', () => zoomAt(1.25));
document.getElementById('btn-zoom-out').addEventListener('click', () => zoomAt(0.8));
document.getElementById('btn-zoom-reset').addEventListener('click', () => {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.deltaY < 0 ? 1.15 : 0.87);
}, { passive: false });

viewport.addEventListener('mousedown', (e) => {
  state.isDragging = true;
  mapWorld.classList.add('dragging');
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!state.isDragging) return;
  const rect = svg.getBoundingClientRect();
  const scaleX = 1200 / rect.width;
  const scaleY = 1000 / rect.height;
  state.panX += (e.clientX - state.dragStartX) * scaleX;
  state.panY += (e.clientY - state.dragStartY) * scaleY;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  applyTransform();
});

window.addEventListener('mouseup', () => {
  state.isDragging = false;
  mapWorld.classList.remove('dragging');
});

async function initMap() {
  try {
    const res = await fetch('/api/map');
    if (res.ok) {
      const data = await res.json();
      if ((data.stops && data.stops.length) || (data.shapes && data.shapes.length)) {
        adminData.stops = data.stops || [];
        adminData.shapes = data.shapes || [];
        LINES.length = 0;
        seenLines.clear();
        adminData.shapes.filter(s => s.type === 'line').forEach(s => {
          const id = s.label || 'Ligne';
          if (!seenLines.has(id)) {
            seenLines.add(id);
            LINES.push({ id, name: id, category: 'Ligne', color: s.color, width: s.width, dashed: s.dashed });
            state.activeLines.add(id);
          }
        });
        Object.keys(STOPS).forEach(k => delete STOPS[k]);
        adminData.stops.forEach((st, idx) => {
          STOPS[`stop_${idx}`] = { name: st.name, x: st.x, y: st.y, lines: st.lines || [], pole: !!st.pole };
        });
      }
    }
  } catch (_) {}

  renderGeo();
  renderLinesSidebar();
  renderLines();
  renderStops();
  applyTransform();
}

initMap();
