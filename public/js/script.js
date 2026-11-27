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

function savePreferences() {
  try {
    const activeArr = Array.from(selectedLines);
    localStorage.setItem("transit_lignes_actives", JSON.stringify(activeArr));

    const params = {
      departure: document.getElementById("opt-departure")?.value || "2",
      mode: document.getElementById("opt-mode")?.value || "mixed",
      length: document.getElementById("opt-length")?.value || "medium",
      endDir: document.getElementById("opt-end-dir")?.value || "any",
      meal: document.getElementById("opt-meal")?.checked ?? true,
      optimizedSwitch: document.getElementById("opt-optimized-switch")?.checked ?? true
    };
    localStorage.setItem("transit_parametres", JSON.stringify(params));
  } catch (e) {
    // nothing
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
      if (p.optimizedSwitch !== undefined && document.getElementById("opt-optimized-switch")) {
        document.getElementById("opt-optimized-switch").checked = Boolean(p.optimizedSwitch);
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

  ["opt-departure", "opt-mode", "opt-length", "opt-meal", "opt-optimized-switch"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      savePreferences();
      generate();
    });
  });

  const modalParams = document.getElementById("modal-params");
  const btnOpenParams = document.getElementById("btn-open-params");
  const btnCloseParams = document.getElementById("btn-close-params");

  const closeModal = () => {
    if (modalParams) {
      modalParams.classList.remove("est-ouverte");
      modalParams.setAttribute("aria-hidden", "true");
    }
  };

  if (btnOpenParams && modalParams) {
    btnOpenParams.onclick = () => {
      modalParams.classList.add("est-ouverte");
      modalParams.setAttribute("aria-hidden", "false");
    };
  }
  if (btnCloseParams) {
    btnCloseParams.onclick = closeModal;
  }
  if (modalParams) {
    modalParams.addEventListener("click", (e) => {
      if (e.target === modalParams) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalParams.classList.contains("est-ouverte")) {
        closeModal();
      }
    });
  }

  setupCustomEdtModal(closeModal);

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
  const endDir = document.getElementById("opt-end-dir")?.value || "any";
  const hasMeal = document.getElementById("opt-meal").checked;
  const optimizedSwitch = document.getElementById("opt-optimized-switch")?.checked ?? true;

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

  if (endDir === "principal" && routeType !== 2) {
    const mainDir = Number(line.terminusPrincipal || line.garePrincipale || 1);
    dir = mainDir === 1 ? 2 : 1; // Partir du terminus principal
  }

  if (routeType === 2) {
    firstTerminus = getDir1(line);
  } else {
    firstTerminus = dir === 1 ? (getDir2(line) || getDir1(line)) : getDir1(line);
  }

  for (let i = 1; i <= tripsCount; i++) {
    if (mode === "mixed" && i > 1 && Math.random() < 0.45 && activeKeys.length > 1) {
      const rest = activeKeys.filter(k => k !== curKey);
      const prevStation = list[list.length - 1]?.title || "";
      let pickedKey = null;

      if (optimizedSwitch && prevStation) {
        const matching = rest.filter(k => {
          const cand = linesData[k] || DEFAULT_LINES[k];
          return getDir1(cand) === prevStation || getDir2(cand) === prevStation;
        });
        if (matching.length > 0) {
          pickedKey = matching[Math.floor(Math.random() * matching.length)];
        }
      }

      curKey = pickedKey || rest[Math.floor(Math.random() * rest.length)];
      line = linesData[curKey] || DEFAULT_LINES[curKey];
      routeType = getLineRouteType(line);

      if (optimizedSwitch && pickedKey && routeType !== 2) {
        dir = getDir1(line) === prevStation ? 2 : 1;
      } else if (endDir === "principal" && routeType !== 2) {
        const mainDir = Number(line.terminusPrincipal || line.garePrincipale || 1);
        dir = mainDir === 1 ? 2 : 1;
      } else {
        dir = Math.random() < 0.5 ? 1 : 2;
      }
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
      if (i === tripsCount) {
        if (endDir === "principal") {
          dir = Number(line.terminusPrincipal || line.garePrincipale || 1);
        } else if (endDir === "1" || endDir === "2") {
          dir = Number(endDir);
        }
      }
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
      const nextLabel = idx === list.length - 1 ? "Finir le service" : "Suivant";
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

let customSteps = [];

function setupCustomEdtModal(closeParamsModal) {
  const modalCustom = document.getElementById("modal-custom-edt");
  const btnOpenCustom = document.getElementById("btn-open-custom");
  const btnCloseCustom = document.getElementById("btn-close-custom");
  const lineSelect = document.getElementById("custom-line-select");
  const dirSelect = document.getElementById("custom-dir-select");
  const startInput = document.getElementById("custom-start-time");
  const stepsListEl = document.getElementById("custom-steps-list");

  if (!modalCustom || !btnOpenCustom) return;

  const populateLines = () => {
    if (!lineSelect) return;
    lineSelect.innerHTML = "";
    Object.keys(linesData).forEach(code => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `Ligne ${code}`;
      lineSelect.appendChild(opt);
    });
    updateDirLabels();
  };

  const updateDirLabels = () => {
    if (!lineSelect || !dirSelect) return;
    const line = linesData[lineSelect.value] || DEFAULT_LINES[lineSelect.value];
    if (!line) return;
    const d1 = getDir1(line);
    const d2 = getDir2(line) || d1;
    dirSelect.options[0].textContent = d1;
    dirSelect.options[1].textContent = d2;
  };

  const renderCustomSteps = () => {
    if (!stepsListEl) return;
    if (customSteps.length === 0) {
      stepsListEl.innerHTML = `<div class="custom-etape-vide">Aucune étape ajoutée</div>`;
      return;
    }
    stepsListEl.innerHTML = "";
    customSteps.forEach((st, idx) => {
      const row = document.createElement("div");
      row.className = "custom-etape-ligne";
      const label = st.type === "drive"
        ? `[${st.line}] ${st.title} (${st.duration} min)`
        : `Pause (${st.duration} min)`;
      row.innerHTML = `<span>${idx + 1}. ${label}</span><button type="button" class="bouton-annuler-section" onclick="removeCustomStep(${idx})">Supprimer</button>`;
      stepsListEl.appendChild(row);
    });
  };

  window.removeCustomStep = (idx) => {
    customSteps.splice(idx, 1);
    renderCustomSteps();
  };

  const closeCustom = () => {
    modalCustom.classList.remove("est-ouverte");
    modalCustom.setAttribute("aria-hidden", "true");
  };

  lineSelect?.addEventListener("change", updateDirLabels);

  btnOpenCustom.onclick = () => {
    closeParamsModal();
    populateLines();
    if (startInput && !startInput.value) {
      const now = new Date(Date.now() + 2 * 60 * 1000);
      startInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    renderCustomSteps();
    modalCustom.classList.add("est-ouverte");
    modalCustom.setAttribute("aria-hidden", "false");
  };

  btnCloseCustom?.addEventListener("click", closeCustom);
  modalCustom.addEventListener("click", (e) => {
    if (e.target === modalCustom) closeCustom();
  });

  document.getElementById("btn-custom-add-drive")?.addEventListener("click", () => {
    const code = lineSelect.value;
    const line = linesData[code] || DEFAULT_LINES[code];
    if (!line) return;
    const routeType = getLineRouteType(line);
    const dir = Number(dirSelect.value);
    const d1 = getDir1(line);
    const d2 = getDir2(line) || d1;
    const target = routeType === 2 ? d1 : (dir === 1 ? d1 : d2);
    const origin = routeType === 2 ? d1 : (dir === 1 ? d2 : d1);
    const subtitle = routeType === 2 ? (d2 ? `Boucle par ${d2}` : `Départ et retour : ${d1}`) : `Départ de ${origin}`;
    const dur = Math.max(0, Number(line.temps !== undefined && line.temps !== null ? line.temps : 12));

    customSteps.push({
      type: "drive",
      routeType,
      line: code,
      icon: line.icon || "",
      color: line.color || "#0080c8",
      title: target,
      subtitle,
      duration: dur
    });
    renderCustomSteps();
  });

  document.getElementById("btn-custom-add-pause")?.addEventListener("click", () => {
    const dur = Math.max(1, parseInt(document.getElementById("custom-pause-dur")?.value || "5", 10));
    customSteps.push({ type: "pause", title: "Pause", subtitle: "", duration: dur });
    renderCustomSteps();
  });

  document.getElementById("btn-custom-clear")?.addEventListener("click", () => {
    customSteps = [];
    renderCustomSteps();
  });

  document.getElementById("btn-apply-custom")?.addEventListener("click", () => {
    if (customSteps.length === 0) return;
    try { localStorage.removeItem("transit_pointages_reels"); } catch (e) {}

    let cur = timeToMinutes(startInput?.value) ?? (new Date().getHours() * 60 + new Date().getMinutes());
    shiftStart = cur;
    const list = [];
    let tripsCount = 0;
    firstTerminus = "";
    lastTerminus = "";

    customSteps.forEach(st => {
      if (st.type === "drive") {
        tripsCount++;
        if (!firstTerminus) firstTerminus = st.title;
        lastTerminus = st.title;
      }
      list.push({ ...st, start: cur, end: cur + st.duration });
      cur += st.duration;
    });

    shiftEnd = cur;
    generatedSchedule = list;
    renderTimeline(list);
    updateMeta(tripsCount);
    updateProgress();
    closeCustom();
  });
}
