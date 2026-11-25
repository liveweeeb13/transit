/* Fais par liveweeeb.dev github.com/liveweeeb13 */
const DEFAULT_LINES = {
  "T1": {
    "type": "tram",
    "parcours": 1, // Allé retour
    "Direction-1": "Hôtel de Ville",
    "Direction-2": "Plage du Moulin",
    "temps": 12,
    "tempsPause": 5,
    "color": "#0080c8",
    "icon": "assets/img/T1.png"
  },
  "40": {
    "type": "bus",
    "parcours": 2, // Boucle
    "Direction-1": "Les Écluses",
    "Direction-2": "Gare Routière",
    "temps": 7,
    "tempsPause": 3,
    "color": "#e87700",
    "icon": "assets/img/bus40.png"
  }
};

let linesData = {};
let selectedLines = new Set();
let generatedSchedule = [];
let shiftStart = 0;
let shiftEnd = 0;
let firstTerminus = "";
let lastTerminus = "";

function getLineKind(code, item) {
  if (item && item.type && typeof item.type === "string") {
    const t = item.type.toLowerCase();
    if (t.includes("tram")) return "tram";
    if (t.includes("bus")) return "bus";
  }
  if (item && item.vehicle) return item.vehicle;
  return String(code).toUpperCase().startsWith("T") ? "tram" : "bus";
}

function getLineRouteType(item) { // Allé retour ou boucle
  if (!item) return 1;
  const val = item.parcours ?? item.circuit ?? item.forme ?? item.rotation ?? item.mode ?? item.ligne_type ?? item.routeType;
  if (val === 2 || val === "2" || val === "boucle") {
    return 2;
  }
  if (item.type === 2 || item.type === "2") {
    return 2;
  }
  return 1;
}

const getDir1 = (l) => (l && (l["Direction-1"] || l["Direction 1"] || l.direction1)) || "Terminus 1";
const getDir2 = (l) => (l && (l["Direction-2"] || l["Direction 2"] || l.direction2)) || "";

document.addEventListener("DOMContentLoaded", async () => {
  await loadLines();
  loadPreferences();

  initDate();
  renderSelector();
  setupEvents();
  startClock();

  generate();
});

// Sauvegarde et chargement des préférences (localStorage)
function savePreferences() {
  try {
    const activeArr = Array.from(selectedLines);
    localStorage.setItem("transit_lignes_actives", JSON.stringify(activeArr));

    const params = {
      departure: document.getElementById("opt-departure")?.value || "2",
      mode: document.getElementById("opt-mode")?.value || "mixed",
      length: document.getElementById("opt-length")?.value || "medium",
      meal: document.getElementById("opt-meal")?.checked ?? true
    };
    localStorage.setItem("transit_parametres", JSON.stringify(params));
  } catch (e) {
    // Tolérance si localStorage inaccessible
  }
}

function loadPreferences() {
  try {
    const savedLines = localStorage.getItem("transit_lignes_actives");
    if (savedLines) {
      const parsed = JSON.parse(savedLines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(code => linesData[code]);
        if (valid.length > 0) {
          selectedLines = new Set(valid);
        } else {
          selectedLines = new Set(Object.keys(linesData));
        }
      } else {
        selectedLines = new Set(Object.keys(linesData));
      }
    } else {
      selectedLines = new Set(Object.keys(linesData));
    }

    const savedParams = localStorage.getItem("transit_parametres");
    if (savedParams) {
      const p = JSON.parse(savedParams);
      if (p.departure !== undefined && document.getElementById("opt-departure")) {
        document.getElementById("opt-departure").value = p.departure;
      }
      if (p.mode !== undefined && document.getElementById("opt-mode")) {
        document.getElementById("opt-mode").value = p.mode;
      }
      if (p.length !== undefined && document.getElementById("opt-length")) {
        document.getElementById("opt-length").value = p.length;
      }
      if (p.meal !== undefined && document.getElementById("opt-meal")) {
        document.getElementById("opt-meal").checked = Boolean(p.meal);
      }
    }
  } catch (e) {
    selectedLines = new Set(Object.keys(linesData));
  }
}

async function loadLines() {
  try {
    let res = await fetch("/api/lines");
    if (!res.ok) res = await fetch("lines.json");
    if (!res.ok) throw new Error();
    linesData = await res.json();
  } catch (e) {
    linesData = DEFAULT_LINES;
  }
}

function initDate() {
  const d = new Date();
  const dateStr = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("nav-date").textContent = dateStr;
}

function startClock() {
  const tick = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("nav-clock").textContent = `${h}:${m}`;

    updateProgress();
    checkActiveNode();
  };
  tick();
  setInterval(tick, 1000);
}

function renderSelector() {
  const box = document.getElementById("lines-selector");
  box.innerHTML = "";

  Object.entries(linesData).forEach(([code, item]) => {
    const active = selectedLines.has(code);
    const color = item.color || "#6366f1";
    const dir1 = getDir1(item);
    const dir2 = getDir2(item);
    const isTram = getLineKind(code, item) === "tram";
    const routeType = getLineRouteType(item);
    const iconSrc = item.icon || "";

    const routeText = routeType === 2
      ? (dir2 ? `${dir1} ↺ par ${dir2}` : `${dir1} ↺`)
      : (dir2 ? `${dir1} ⇄ ${dir2}` : `${dir1}`);

    const el = document.createElement("div");
    el.className = `element-ligne ${active ? "est-actif" : "est-desactive"}`;
    el.id = `line-item-${code}`;
    el.onclick = () => toggleLine(code);

    const iconHtml = iconSrc 
      ? `<img src="${iconSrc}" alt="${code}" class="image-icone-ligne" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="pastille-ligne" style="background:${color}; display:none;">${code}</span>`
      : `<span class="pastille-ligne" style="background:${color}">${code}</span>`;

    el.innerHTML = `
      <div class="bloc-visuel-ligne">
        ${iconHtml}
        <div class="textes-ligne">
          <span class="directions-ligne">${routeText}</span>
        </div>
      </div>
      <span class="etat-interrupteur-ligne">${active ? "OUI" : "NON"}</span>
    `;

    box.appendChild(el);
  });

  document.getElementById("lines-count").textContent = `${selectedLines.size} / ${Object.keys(linesData).length}`;
}

function toggleLine(code) {
  if (selectedLines.has(code)) {
    if (selectedLines.size <= 1) return;
    selectedLines.delete(code);
  } else {
    selectedLines.add(code);
  }

  const el = document.getElementById(`line-item-${code}`);
  if (el) {
    const active = selectedLines.has(code);
    el.classList.toggle("est-actif", active);
    el.classList.toggle("est-desactive", !active);
    const badge = el.querySelector(".etat-interrupteur-ligne");
    if (badge) badge.textContent = active ? "OUI" : "NON";
  }

  document.getElementById("lines-count").textContent = `${selectedLines.size} / ${Object.keys(linesData).length}`;
  savePreferences();
}

function setupEvents() {
  document.getElementById("btn-reroll").onclick = () => generate(true);
  document.getElementById("btn-copy").onclick = copySchedule;

  document.getElementById("btn-all-lines").onclick = () => {
    selectedLines = new Set(Object.keys(linesData));
    setActiveChip("btn-all-lines");
    renderSelector();
    savePreferences();
  };

  document.getElementById("btn-tram-lines").onclick = () => {
    selectedLines = new Set(Object.keys(linesData).filter(k => getLineKind(k, linesData[k]) === "tram"));
    setActiveChip("btn-tram-lines");
    renderSelector();
    savePreferences();
  };

  document.getElementById("btn-bus-lines").onclick = () => {
    selectedLines = new Set(Object.keys(linesData).filter(k => getLineKind(k, linesData[k]) === "bus"));
    setActiveChip("btn-bus-lines");
    renderSelector();
    savePreferences();
  };

  // Sauvegarde automatique des paramètres au changement
  ["opt-departure", "opt-mode", "opt-length", "opt-meal"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      savePreferences();
      generate();
    });
  });

  const fsBtn = document.getElementById("btn-fullscreen");
  if (fsBtn) {
    fsBtn.onclick = toggleFullscreen;
  }
}

function toggleFullscreen() {
  const target = document.getElementById("timeline") || document.querySelector(".piste-chronologique");
  if (!target) return;

  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function updateFullscreenButton() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const btn = document.getElementById("btn-fullscreen");
  if (!btn) return;
  const label = document.getElementById("label-plein-ecran");
  const icon = btn.querySelector("svg");
  if (isFs) {
    if (label) label.textContent = "Quitter le plein écran";
    btn.setAttribute("title", "Quitter le plein écran");
    if (icon) {
      icon.innerHTML = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>`;
    }
  } else {
    if (label) label.textContent = "Plein écran";
    btn.setAttribute("title", "Plein écran");
    if (icon) {
      icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
    }
  }
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

function setActiveChip(activeId) {
  document.querySelectorAll(".onglets-filtres .onglet-filtre").forEach(c => c.classList.remove("actif"));
  document.getElementById(activeId)?.classList.add("actif");
}

function minutesToTime(m) {
  const norm = ((m % 1440) + 1440) % 1440;
  const hh = Math.floor(norm / 60);
  const mm = norm % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return null;
  const parts = timeStr.split(":");
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
}

function getDiffMinutes(actualMin, scheduledMin) {
  let diff = actualMin - scheduledMin;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function savePointages() {
  try {
    const map = {};
    generatedSchedule.forEach((item, idx) => {
      if (item.realStart || item.realEnd || item.completed) {
        map[idx] = {
          realStart: item.realStart || null,
          realEnd: item.realEnd || null,
          completed: Boolean(item.completed)
        };
      }
    });
    localStorage.setItem("transit_pointages_reels", JSON.stringify(map));
  } catch (e) {}
}

function loadPointages() {
  try {
    const saved = localStorage.getItem("transit_pointages_reels");
    if (!saved) return;
    const map = JSON.parse(saved);
    if (map && typeof map === "object") {
      generatedSchedule.forEach((item, idx) => {
        if (map[idx]) {
          item.realStart = map[idx].realStart || null;
          item.realEnd = map[idx].realEnd || null;
          item.completed = Boolean(map[idx].completed);
        }
      });
    }
  } catch (e) {}
}

window.finirSection = function(idx) {
  const item = generatedSchedule[idx];
  if (!item) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (!item.realStart) {
    item.realStart = minutesToTime(item.start);
  }
  item.realEnd = timeStr;
  item.completed = true;

  // Démarre directement la section suivante à la même heure
  const nextItem = generatedSchedule[idx + 1];
  if (nextItem && !nextItem.completed) {
    nextItem.realStart = timeStr;
  }

  savePointages();
  renderTimeline(generatedSchedule);
  updateMeta(generatedSchedule.filter(i => i.type === "drive").length);
};

window.annulerSection = function(idx) {
  const item = generatedSchedule[idx];
  if (!item) return;

  item.realEnd = null;
  item.completed = false;

  // Réinitialise le départ automatique de la section suivante si elle n'est pas encore terminée
  const nextItem = generatedSchedule[idx + 1];
  if (nextItem && !nextItem.completed) {
    nextItem.realStart = null;
  }

  savePointages();
  renderTimeline(generatedSchedule);
  updateMeta(generatedSchedule.filter(i => i.type === "drive").length);
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generate(isNewReroll = false) {
  const activeKeys = Array.from(selectedLines);
  if (activeKeys.length === 0) return;

  if (isNewReroll) {
    try {
      localStorage.removeItem("transit_pointages_reels");
    } catch (e) {}
  }

  const offset = parseInt(document.getElementById("opt-departure").value, 10);
  const now = new Date();
  const startTime = new Date(now.getTime() + offset * 60 * 1000);
  let cur = startTime.getHours() * 60 + startTime.getMinutes();
  shiftStart = cur;

  const mode = document.getElementById("opt-mode").value;
  const len = document.getElementById("opt-length").value;
  const hasMeal = document.getElementById("opt-meal").checked;

  let tripsCount = 6;
  if (len === "short") tripsCount = getRandomInt(3, 4);
  else if (len === "medium") tripsCount = getRandomInt(5, 7);
  else if (len === "long") tripsCount = getRandomInt(8, 10);

  const locked = mode === "single" ? activeKeys[Math.floor(Math.random() * activeKeys.length)] : null;
  const mealIdx = Math.floor(tripsCount / 2);

  const list = [];

  let curKey = locked || activeKeys[Math.floor(Math.random() * activeKeys.length)];
  let line = linesData[curKey] || DEFAULT_LINES[curKey];
  let routeType = getLineRouteType(line);
  let dir = Math.random() < 0.5 ? 1 : 2;

  if (routeType === 2) {
    firstTerminus = getDir1(line);
  } else {
    firstTerminus = dir === 1 ? (getDir2(line) || getDir1(line)) : getDir1(line);
  }

  for (let i = 1; i <= tripsCount; i++) {
    if (mode === "mixed" && i > 1 && Math.random() < 0.45 && activeKeys.length > 1) {
      const rest = activeKeys.filter(k => k !== curKey);
      curKey = rest[Math.floor(Math.random() * rest.length)];
      line = linesData[curKey] || DEFAULT_LINES[curKey];
      routeType = getLineRouteType(line);
      dir = Math.random() < 0.5 ? 1 : 2;
    }

    line = linesData[curKey] || DEFAULT_LINES[curKey];
    routeType = getLineRouteType(line);

    let target = "";
    let origin = "";
    let subtitleText = "";

    if (routeType === 2) { // Boucle
      const baseStation = getDir1(line);
      const viaStation = getDir2(line);
      target = baseStation;
      origin = baseStation;
      subtitleText = viaStation ? `Boucle par ${viaStation}` : `Départ et retour : ${baseStation}`;
      lastTerminus = baseStation;
    } else { // Allé retour 
      const d1 = getDir1(line);
      const d2 = getDir2(line) || d1;
      target = dir === 1 ? d1 : d2;
      origin = dir === 1 ? d2 : d1;
      subtitleText = `Départ de ${origin}`;
      lastTerminus = target;  // Retour
      dir = dir === 1 ? 2 : 1;
    }

    const dur = Math.max(0, Number(line.temps !== undefined && line.temps !== null ? line.temps : 12));
    list.push({
      start: cur,
      end: cur + dur,
      duration: dur,
      type: "drive",
      routeType: routeType,
      line: curKey,
      icon: line.icon || "",
      color: line.color || "#0080c8",
      title: target,
      subtitle: subtitleText,
      index: i,
      total: tripsCount
    });

    cur += dur;

    if (i === tripsCount) break;

    if (hasMeal && i === mealIdx) {
      const mealDur = 30;
      list.push({
        start: cur,
        end: cur + mealDur,
        duration: mealDur,
        type: "pause",
        title: "Pause",
        subtitle: ``
      });
      cur += mealDur;
    } else {
      const pauseDur = Math.max(0, Number(line.tempsPause !== undefined && line.tempsPause !== null ? line.tempsPause : 5));
      if (pauseDur > 0) {
        list.push({
          start: cur,
          end: cur + pauseDur,
          duration: pauseDur,
          type: "pause",
          title: "Pause",
          subtitle: ""
        });
        cur += pauseDur;
      }
    }
  }

  shiftEnd = cur;
  generatedSchedule = list;

  if (!isNewReroll) {
    loadPointages();
  }

  renderTimeline(list);
  updateMeta(tripsCount);
  updateProgress();
}

function updateMeta(trips) {
  document.getElementById("meta-start").textContent = `${minutesToTime(shiftStart)} (${firstTerminus})`;
  document.getElementById("meta-end").textContent = `${minutesToTime(shiftEnd)} (${lastTerminus})`;
  document.getElementById("meta-trips").textContent = `${trips} courses`;
  document.getElementById("service-summary").textContent = `Service planifié de ${minutesToTime(shiftStart)} à ${minutesToTime(shiftEnd)}`;

  const metaPunctuality = document.getElementById("meta-punctuality");
  if (metaPunctuality) {
    let latestDiff = null;
    for (let i = generatedSchedule.length - 1; i >= 0; i--) {
      const it = generatedSchedule[i];
      if (it.realEnd) {
        latestDiff = getDiffMinutes(timeToMinutes(it.realEnd), it.end);
        break;
      } else if (it.realStart) {
        latestDiff = getDiffMinutes(timeToMinutes(it.realStart), it.start);
        break;
      }
    }

    if (latestDiff !== null) {
      if (latestDiff > 0) {
        metaPunctuality.textContent = `+${latestDiff} min (Retard)`;
        metaPunctuality.style.color = "#f87171";
      } else if (latestDiff < 0) {
        metaPunctuality.textContent = `-${Math.abs(latestDiff)} min (Avance)`;
        metaPunctuality.style.color = "#38bdf8";
      } else {
        metaPunctuality.textContent = "À l'heure";
        metaPunctuality.style.color = "#34d399";
      }
    } else {
      metaPunctuality.textContent = "À l'heure";
      metaPunctuality.style.color = "#34d399";
    }
  }
}

function updateProgress() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const diff = shiftEnd - cur;

  const h = Math.floor(diff / 60);
  const m = diff % 60;

  if (diff > 0) {
    document.getElementById("kpi-remaining").textContent = h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
    document.getElementById("kpi-end-target").textContent = `restant jusqu'à ${minutesToTime(shiftEnd)}`;

    const total = shiftEnd - shiftStart;
    const elapsed = Math.max(0, cur - shiftStart);
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    document.getElementById("progress-fill").style.width = `${pct}%`;
  } else {
    document.getElementById("kpi-remaining").textContent = "Terminé";
    document.getElementById("kpi-end-target").textContent = `Fin de service à ${minutesToTime(shiftEnd)}`;
    document.getElementById("progress-fill").style.width = "100%";
  }
}

function renderTimeline(list) {
  const stream = document.getElementById("timeline");
  stream.innerHTML = "";

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "bouton-discret bouton-flottant-plein-ecran";
  exitBtn.id = "btn-exit-fullscreen";
  exitBtn.title = "Quitter le plein écran";
  exitBtn.innerHTML = `
    <svg class="icone-bouton" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
    </svg>
  `;
  exitBtn.onclick = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };
  stream.appendChild(exitBtn);

  const activeStepIndex = list.findIndex(it => !it.completed);
  let cumulativeDelay = 0;

  list.forEach((item, idx) => {
    const el = document.createElement("div");
    const typeClass = item.type === "drive" ? "type-trajet" : "type-pause";
    const isCompleted = Boolean(item.completed);
    const isActive = (idx === activeStepIndex);

    el.className = `etape-planning ${typeClass}${isCompleted ? " etape-terminee" : ""}${isActive ? " etape-en-cours" : ""}`;
    el.id = `timeline-item-${idx}`;

    let ecartBadgeHtml = "";
    let actionHtml = "";

    if (isCompleted) {
      const actualEndMin = timeToMinutes(item.realEnd);
      const endDiff = getDiffMinutes(actualEndMin, item.end);
      cumulativeDelay = endDiff;

      if (endDiff > 0) {
        ecartBadgeHtml = `<span class="pastille-ecart ecart-retard">Retard +${endDiff} min</span>`;
      } else if (endDiff < 0) {
        ecartBadgeHtml = `<span class="pastille-ecart ecart-avance">Avance ${Math.abs(endDiff)} min</span>`;
      } else {
        ecartBadgeHtml = `<span class="pastille-ecart ecart-a-l-heure">À l'heure</span>`;
      }

      actionHtml = `
        <div class="recap-pointage-termine">
          <div class="texte-pointage-termine">
            <span>Terminé à ${item.realEnd}</span>
            ${ecartBadgeHtml}
          </div>
          <button type="button" class="bouton-annuler-section" onclick="annulerSection(${idx})" title="Rouvrir et modifier cette étape">Modifier</button>
        </div>
      `;
    } else if (isActive) {
      const nextLabel = idx === list.length - 1 ? "Finir le service" : "Finir / Suivant";
      if (!item.realStart) {
        item.realStart = minutesToTime(item.start);
      }

      actionHtml = `
        <div class="zone-action-etape">
          <button type="button" class="bouton-finir-section" onclick="finirSection(${idx})">
            <span>${nextLabel}</span>
            <svg class="icone-bouton" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14m-7-7 7 7-7 7"/>
            </svg>
          </button>
        </div>
      `;
    }

    let estimationHtml = "";
    if (!isCompleted && cumulativeDelay !== 0) {
      const estStart = item.start + cumulativeDelay;
      const estEnd = item.end + cumulativeDelay;
      const sign = cumulativeDelay > 0 ? "+" : "";
      const cls = cumulativeDelay > 0 ? "retard" : "avance";
      estimationHtml = `<span class="indication-estimee ${cls}">${sign}${cumulativeDelay} min</span>`;
    }

    let mainHtml = "";
    if (item.type === "drive") {
      const lineIconHtml = item.icon
        ? `<img src="${item.icon}" alt="${item.line}" class="image-icone-etape" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="pastille-ligne" style="background:${item.color}; display:none;">${item.line}</span>`
        : `<span class="pastille-ligne" style="background:${item.color}">${item.line}</span>`;

      mainHtml = `
        <div class="ligne-titre-etape">
          ${lineIconHtml}
          <span class="titre-etape">${item.title}</span>
          <span class="pastille-en-cours" style="${isActive ? 'display:inline-block;' : 'display:none;'}">En cours</span>
        </div>
        <div class="sous-titre-etape">${item.subtitle}</div>
      `;
    } else {
      mainHtml = `
        <div class="ligne-titre-etape">
          <span class="titre-etape">${item.title}</span>
          <span class="pastille-en-cours" style="${isActive ? 'display:inline-block;' : 'display:none;'}">En cours</span>
        </div>
        <div class="sous-titre-etape">${item.subtitle}</div>
      `;
    }

    el.innerHTML = `
      <div class="point-etape"></div>
      <div class="carte-etape">
        <div class="haut-de-carte">
          <div>
            <span class="plage-horaire">${minutesToTime(item.start)} - ${minutesToTime(item.end)}</span>
            ${estimationHtml}
          </div>
          <span class="duree-bulle">${item.duration} min</span>
        </div>
        ${mainHtml}
        ${actionHtml}
      </div>
    `;

    stream.appendChild(el);
  });

  checkActiveNode();
}

window.toggleDetail = function(btn) {
  btn.classList.toggle("est-deplie");
  const exp = btn.nextElementSibling;
  if (exp) exp.classList.toggle("est-ouvert");
};

function checkActiveNode() {
  if (!generatedSchedule.length) return;
  const activeStepIndex = generatedSchedule.findIndex(it => !it.completed);

  generatedSchedule.forEach((item, idx) => {
    const el = document.getElementById(`timeline-item-${idx}`);
    if (!el) return;
    const isCompleted = Boolean(item.completed);
    const isActive = (idx === activeStepIndex);

    el.classList.toggle("etape-terminee", isCompleted);
    el.classList.toggle("etape-en-cours", isActive);

    const liveTag = el.querySelector(".pastille-en-cours");
    if (liveTag) {
      liveTag.style.display = isActive ? "inline-block" : "none";
    }
  });
}

function copySchedule() {
  if (!generatedSchedule.length) return;

  let text = `SERVICE DU ${document.getElementById("nav-date").textContent.toUpperCase()}\n`;
  text += `Début : ${minutesToTime(shiftStart)} | Fin : ${minutesToTime(shiftEnd)}\n\n`;

  generatedSchedule.forEach(it => {
    text += `${minutesToTime(it.start)} - ${minutesToTime(it.end)} (${it.duration} min) : `;
    if (it.line) text += `[${it.line}] `;
    text += `${it.title}`;
    if (it.subtitle) text += ` - ${it.subtitle}`;
    if (it.realStart || it.realEnd) {
      text += ` [Réel : ${it.realStart || '--:--'} -> ${it.realEnd || '--:--'}]`;
    }
    text += `\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    alert("Déroulé copié dans le presse-papier");
  });
}
