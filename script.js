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
let isAllOpen = false;

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
  document.getElementById("btn-reroll").onclick = () => generate();
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

  document.getElementById("btn-toggle-all").onclick = () => {
    isAllOpen = !isAllOpen;
    document.getElementById("btn-toggle-all").textContent = isAllOpen ? "Tout réduire" : "Tout dérouler";
    document.querySelectorAll(".bouton-details-etape").forEach(trig => {
      trig.classList.toggle("est-deplie", isAllOpen);
    });
    document.querySelectorAll(".contenu-details-etape").forEach(el => {
      el.classList.toggle("est-ouvert", isAllOpen);
    });
  };
}

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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generate() {
  const activeKeys = Array.from(selectedLines);
  if (activeKeys.length === 0) return;

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

  renderTimeline(list);
  updateMeta(tripsCount);
  updateProgress();
}

function updateMeta(trips) {
  document.getElementById("meta-start").textContent = `${minutesToTime(shiftStart)} (${firstTerminus})`;
  document.getElementById("meta-end").textContent = `${minutesToTime(shiftEnd)} (${lastTerminus})`;
  document.getElementById("meta-trips").textContent = `${trips} courses`;
  document.getElementById("service-summary").textContent = `Service planifié de ${minutesToTime(shiftStart)} à ${minutesToTime(shiftEnd)}`;
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

  list.forEach((item, idx) => {
    const el = document.createElement("div");
    const typeClass = item.type === "drive" ? "type-trajet" : "type-pause";
    el.className = `etape-planning ${typeClass}`;
    el.id = `timeline-item-${idx}`;

    let mainHtml = "";
    if (item.type === "drive") {
      const lineIconHtml = item.icon
        ? `<img src="${item.icon}" alt="${item.line}" class="image-icone-etape" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="pastille-ligne" style="background:${item.color}; display:none;">${item.line}</span>`
        : `<span class="pastille-ligne" style="background:${item.color}">${item.line}</span>`;

      mainHtml = `
        <div class="ligne-titre-etape">
          ${lineIconHtml}
          <span class="titre-etape">${item.title}</span>
          <span class="pastille-en-cours" style="display:none;">En cours</span>
        </div>
        <div class="sous-titre-etape">${item.subtitle}</div>
      `;
    } else {
      mainHtml = `
        <div class="ligne-titre-etape">
          <span class="titre-etape">${item.title}</span>
          <span class="pastille-en-cours" style="display:none;">En cours</span>
        </div>
        <div class="sous-titre-etape">${item.subtitle}</div>
      `;
    }

    el.innerHTML = `
      <div class="point-etape"></div>
      <div class="carte-etape">
        <div class="haut-de-carte">
          <span class="plage-horaire">${minutesToTime(item.start)} - ${minutesToTime(item.end)}</span>
          <span class="duree-bulle">${item.duration} min</span>
        </div>
        ${mainHtml}
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
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();

  generatedSchedule.forEach((item, idx) => {
    const el = document.getElementById(`timeline-item-${idx}`);
    if (!el) return;
    const isActive = cur >= item.start && cur < item.end;
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
    text += `\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    alert("Déroulé copié dans le presse-papier");
  });
}
