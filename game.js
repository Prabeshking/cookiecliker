/* Star Forge Clicker — maximum-legal closeness (A+B+C)
   - Original names, wording, art
   - Familiar layout & pacing
   - Cost scaling ×1.15, EPS/EPC, upgrades, prestige, autosave
   - Bulk buy x1/x10/x100, selling, price previews
   - Synergy upgrades, settings (format/theme/mute), particles
   - Export/Import + Cloud save stubs (requires backend)
*/

// ---------- Helpers ----------
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAVE_KEY = "starforge-save-v2"; // bump if you change save schema

// number formatting
function fmt(n) {
  const f = S.numberFormat || "compact";
  if (!isFinite(n)) return "∞";
  if (f === "full") return Math.floor(n).toLocaleString();
  if (f === "scientific") {
    if (n === 0) return "0";
    const neg = n < 0;
    n = Math.abs(n);
    const e = Math.floor(Math.log10(n));
    const m = n / Math.pow(10, e);
    return `${neg?"-":""}${m.toFixed(3)}e${e}`;
  }
  // compact
  const units = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","Ud","Dd","Td"];
  const neg = n < 0;
  n = Math.abs(n);
  let u = 0;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${neg?"-":""}${n.toFixed(digits)}${units[u]}`;
}

// batch cost for n items (accounts for floor per step by iterating up to 100)
function bulkCost(b, n) {
  let sum = 0;
  for (let k = 0; k < n; k++) {
    sum += Math.floor(b.baseCost * Math.pow(1.15, b.count + k));
  }
  return sum;
}
function buildingCost(b) {
  return Math.floor(b.baseCost * Math.pow(1.15, b.count));
}

// ---------- Base State ----------
const baseState = {
  energy: 0,
  totalEnergy: 0,
  epcBase: 1,         // per click base
  epcMult: 1,         // multiplicative click mult
  epsMult: 1,         // global EPS multiplier
  starlight: 0,       // prestige currency
  reducedMotion: false,
  autosaveSeconds: 10,
  numberFormat: "compact",
  theme: "dark",
  muted: false,
  buildings: [],
  upgradesBought: {},
  achievements: {},
  version: 2,
  cloudId: "",
};

// ---------- Content (ORIGINAL) ----------
const BUILDINGS = [
  // name, desc, baseCost, eps each
  ["Nano Miner", "Self-replicating bots extract micro‑energy.", 15, 0.1],
  ["Quantum Drone", "Autonomous collectors in low orbit.", 100, 1],
  ["Ion Reactor", "Ionized flow chambers yield steady output.", 500, 5],
  ["Photon Collector", "Solar sails catch stellar photons.", 1_200, 12],
  ["Fusion Lab", "Miniature fusion experiments, big gains.", 5_000, 40],
  ["Stellar Extractor", "Harvests coronal ejections safely.", 15_000, 120],
  ["Asteroid Factory", "Converts rock into raw energy.", 50_000, 300],
  ["Warp Core Plant", "Bent spacetime, straight profits.", 120_000, 700],
  ["Hyperloop Refinery", "Superconducting refineries hum along.", 300_000, 1_500],
  ["Gravity Well Harvester", "Squeezes energy from tidal forces.", 750_000, 3_500],
  ["Antimatter Forge", "Pairs meet, energy greets.", 2_000_000, 9_000],
  ["Void Engine", "Taps vacuum fluctuations responsibly.", 6_000_000, 25_000],
  ["Dimensional Siphon", "Borrowed watts from next door reality.", 12_000_000, 70_000],
  ["Star Core Drill", "Extreme probing, extreme output.", 30_000_000, 150_000],
  ["Nebula Processor", "Gas to gigawatts.", 80_000_000, 400_000],
  ["Galaxy Splitter", "Don’t worry, just metaphorical.", 200_000_000, 1_000_000],
  ["Time Rift Foundry", "Energy from future IOUs.", 500_000_000, 2,500,000],
  ["Singularity Reactor", "Swirls of almost‑forever power.", 1_200_000_000, 6_000_000],
];

const UPGRADE_DEFS = [
  // id, title, desc, cost, condition(state)->bool, effect(state)->void
  ["click-core-1","Harmonic Capacitors","+1 EPC", 100,
    s=>true, s=>{ s.epcBase += 1; }],
  ["click-core-2","Quantum Haptics","+2 EPC", 1_500,
    s=>s.upgradesBought["click-core-1"], s=>{ s.epcBase += 2; }],
  ["global-mult-1","Phase Alignment","+25% global EPS", 3_500,
    s=>totalBuildings(s)>=10, s=>{ s.epsMult *= 1.25; }],
  ["global-mult-2","Zero‑Point Tuning","+50% global EPS", 50_000,
    s=>totalBuildings(s)>=25, s=>{ s.epsMult *= 1.5; }],
  // Building milestone upgrades (10 / 25 / 50)
  ...BUILDINGS.flatMap((b, idx) => ([
    [`b${idx}-x2-10`, `${b[0]} Calibration`, `Doubles ${b[0]} output`, Math.floor(b[2]*8),
      s=>countOf(s, idx)>=10, s=>mulBuilding(idx, 2)],
    [`b${idx}-x2-25`, `${b[0]} Overclock`, `Doubles ${b[0]} output again`, Math.floor(b[2]*32),
      s=>countOf(s, idx)>=25, s=>mulBuilding(idx, 2)],
    [`b${idx}-x2-50`, `${b[0]} Quantum Twin`, `Doubles ${b[0]} output once more`, Math.floor(b[2]*128),
      s=>countOf(s, idx)>=50, s=>mulBuilding(idx, 2)],
  ])),
];

// Synergy upgrades (A boosts B)
const SYNERGIES = [
  { id:"syn-0-1", from:0, to:1, name:"Nano‑Drone Mesh",  desc:"Quantum Drones +2% EPS per Nano Miner",       cost: 50_000,  pct:1.02 },
  { id:"syn-3-6", from:3, to:6, name:"Photon‑Asteroid",  desc:"Asteroid Factories +3% EPS per Photon Collector", cost: 300_000, pct:1.03 },
  { id:"syn-5-9", from:5, to:9, name:"Stellar‑Gravity",  desc:"Gravity Well Harvesters +1.5% per Stellar Extractor", cost: 800_000, pct:1.015 },
  { id:"syn-10-12",from:10,to:12,name:"Antimatter‑Siphon",desc:"Dimensional Siphons +4% per Antimatter Forge", cost: 5_000_000, pct:1.04 },
];
SYNERGIES.forEach(syn=>{
  UPGRADE_DEFS.push([
    syn.id, syn.name, syn.desc, syn.cost,
    s=>totalBuildings(s)>=25, s=>{ s.upgradesBought[syn.id] = true; }
  ]);
});

const ACHIEVEMENTS = [
  // id, title, desc, check(state)->bool
  ["first-click","First Spark","Click once", s=>s.totalEnergy>=1],
  ["ten-clicks","Warming Up","Reach 100 total energy", s=>s.totalEnergy>=100],
  ["builder-1","Getting Crew","Own 10 buildings total", s=>totalBuildings(s)>=10],
  ["builder-2","Factory Floor","Own 50 buildings total", s=>totalBuildings(s)>=50],
  ["builder-3","Industrial Age","Own 200 buildings total", s=>totalBuildings(s)>=200],
  ["eps-1","It’s Moving","Reach 100 EPS", s=>calcEPS(s)>=100],
  ["eps-2","Powerhouse","Reach 5,000 EPS", s=>calcEPS(s)>=5000],
  ["eps-3","Star Foundry","Reach 250,000 EPS", s=>calcEPS(s)>=250000],
]; // Each unlocked = +1% global EPS (multiplicative)

// ---------- Derived helpers & calculations ----------
let S = structuredClone(baseState);
let lastTick = performance.now();
let bulkBuy = 1;
let sellingMode = false;

function ensureBuildings(s) {
  if (!s.buildings || s.buildings.length !== BUILDINGS.length) {
    s.buildings = BUILDINGS.map(([name, desc, baseCost, eps]) => ({
      name, desc, baseCost, epsBase: eps, epsMult: 1, count: 0
    }));
  }
}
function totalBuildings(s){ return s.buildings.reduce((a,b)=>a+b.count,0); }
function countOf(s,i){ return s.buildings[i]?.count||0; }
function mulBuilding(idx, mult){ S.buildings[idx].epsMult *= mult; }
function achievementMult(s){
  const unlockedCount = Object.values(s.achievements).filter(Boolean).length;
  return Math.pow(1.01, unlockedCount);
}
function starlightMultiplier(s){
  return 1 + s.starlight * 0.10; // 10% per starlight
}
function synergyMultFor(s, idx) {
  // product of multipliers affecting building idx
  return SYNERGIES.reduce((m, syn)=>{
    if (!s.upgradesBought[syn.id]) return m;
    if (syn.to !== idx) return m;
    const fromCount = s.buildings[syn.from].count;
    return m * Math.pow(syn.pct, fromCount);
  }, 1);
}
function calcEPS(s) {
  const base = s.buildings.reduce((sum, b, i) =>
    sum + b.count * b.epsBase * b.epsMult * synergyMultFor(s, i), 0);
  return base * s.epsMult * achievementMult(s) * starlightMultiplier(s);
}
function calcEPC(s){
  return s.epcBase * s.epcMult * starlightMultiplier(s);
}

// ---------- UI refs ----------
const energyDisplay = $("#energyDisplay");
const epsDisplay = $("#epsDisplay");
const epcDisplay = $("#epcDisplay");
const prestigeDisplay = $("#prestigeDisplay");
const prestigeGainPreview = $("#prestigeGainPreview");
const clicker = $("#clicker");
const storeDiv = $("#store");
const upgradesDiv = $("#upgrades");
const achvDiv = $("#achievements");
const eventArea = $("#eventArea");
const floatingTexts = $("#floatingTexts");

// ---------- Tabs ----------
for (const tab of $$(".tab")) {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t=>t.classList.remove("active"));
    $$(".tab-content").forEach(c=>c.classList.remove("active"));
    tab.classList.add("active");
    $(`#${tab.dataset.tab}Tab`).classList.add("active");
  });
}

// ---------- Save / Load / Export / Import ----------
function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
}
function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    S = Object.assign(structuredClone(baseState), obj);
    ensureBuildings(S);
  } catch (e) {
    console.warn("Failed to load save", e);
  }
}
function hardReset() {
  if (!confirm("This will erase ALL progress. Continue?")) return;
  localStorage.removeItem(SAVE_KEY);
  S = structuredClone(baseState);
  ensureBuildings(S);
  renderAll();
}

$("#saveBtn").addEventListener("click", save);
$("#hardResetBtn").addEventListener("click", hardReset);

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([btoa(unescape(encodeURIComponent(JSON.stringify(S))))], {type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "starforge-save.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#importBtn").addEventListener("click", () => { $("#importArea").hidden = false; });
$("#cancelImportBtn").addEventListener("click", () => { $("#importArea").hidden = true; });
$("#confirmImportBtn").addEventListener("click", () => {
  const t = $("#importText").value.trim();
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(t))));
    S = Object.assign(structuredClone(baseState), decoded);
    ensureBuildings(S);
    save(); renderAll();
    $("#importArea").hidden = true;
  } catch(e){ alert("Invalid save data."); }
});

// ---------- Settings ----------
$("#autosaveInterval").addEventListener("change", (e)=>{
  S.autosaveSeconds = Number(e.target.value);
});
$("#reducedMotion").addEventListener("change", (e)=>{
  S.reducedMotion = e.target.checked;
});
$("#numberFormat").addEventListener("change", (e)=>{
  S.numberFormat = e.target.value;
  renderAll();
});
$("#themeToggle").addEventListener("change", (e)=>{
  if (e.target.checked) {
    document.body.classList.add("light");
    S.theme = "light";
  } else {
    document.body.classList.remove("light");
    S.theme = "dark";
  }
});
$("#muteToggle").addEventListener("change", (e)=>{ S.muted = e.target.checked; });
$("#cloudSaveBtn").addEventListener("click", cloudSave);
$("#cloudLoadBtn").addEventListener("click", cloudLoad);
$("#sellToggle").addEventListener("click", ()=>{
  sellingMode = !sellingMode;
  $("#sellToggle").classList.toggle("active", sellingMode);
});

$$(".bulkBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    bulkBuy = Number(btn.dataset.bulk);
    sellingMode = false;
    $("#sellToggle").classList.remove("active");
    $$(".bulkBtn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    renderStore(); // update price previews
  });
});

// reflect settings on load
function applySettingsToUI(){
  $("#reducedMotion").checked = !!S.reducedMotion;
  $("#autosaveInterval").value = String(S.autosaveSeconds);
  $("#numberFormat").value = S.numberFormat || "compact";
  $("#themeToggle").checked = S.theme === "light";
  $("#muteToggle").checked = !!S.muted;
  $("#cloudId").value = S.cloudId || "";
  document.body.classList.toggle("light", S.theme === "light");
}

// ---------- Prestige ----------
function starlightGainFor(s){
  // Smooth gain: ~floor((totalEnergy/1e6)^0.5)
  const gain = Math.floor(Math.pow(s.totalEnergy / 1e6, 0.5));
  return Math.max(0, gain);
}
$("#prestigeBtn").addEventListener("click", () => {
  const gain = starlightGainFor(S);
  if (gain <= 0) {
    alert("Not enough progress to gain Starlight yet.");
    return;
  }
  if (!confirm(`Transcend now and gain ${gain} Starlight?\nThis resets buildings, upgrades, and energy.`)) return;

  const keep = {
    starlight: S.starlight + gain,
    reducedMotion: S.reducedMotion,
    autosaveSeconds: S.autosaveSeconds,
    numberFormat: S.numberFormat,
    theme: S.theme,
    muted: S.muted,
    cloudId: S.cloudId,
  };
  S = Object.assign(structuredClone(baseState), keep);
  ensureBuildings(S);
  renderAll(); save();
});

// ---------- Rendering ----------
function renderStore(){
  storeDiv.innerHTML = "";
  S.buildings.forEach((b, i) => {
    const nextCost = buildingCost(b);
    const batchCost = bulkCost(b, bulkBuy);
    const canBuy = S.energy >= (sellingMode ? 0 : batchCost);
    const btnText = sellingMode
      ? (b.count>0 ? `Sell (+${fmt(Math.floor(nextCost*0.5))})` : "Sell")
      : `Buy x${bulkBuy} (${fmt(batchCost)})`;

    const el = document.createElement("div");
    el.className = "store-item";
    el.title = sellingMode
      ? `Refund for next sell: ${fmt(Math.floor(nextCost*0.5))}`
      : `Cost for x${bulkBuy}: ${fmt(batchCost)}`;
    el.innerHTML = `
      <div class="store-left">
        <div class="store-title">${b.name} <span class="store-desc">(${b.desc})</span></div>
        <div class="store-desc">Owned: <strong>${b.count}</strong> • +${fmt(b.epsBase*b.epsMult)} EPS each</div>
        <div class="store-desc">${sellingMode ? `Next refund: <strong>${fmt(Math.floor(nextCost*0.5))}</strong>` : `Next cost: <strong>${fmt(nextCost)}</strong>`}</div>
      </div>
      <div>
        <button class="buy-btn" ${canBuy || sellingMode ? "" : "disabled"} data-idx="${i}">${btnText}</button>
      </div>
    `;
    el.querySelector(".buy-btn").addEventListener("click", ()=>buyOrSellBuilding(i));
    storeDiv.appendChild(el);
  });
}

function renderUpgrades(){
  upgradesDiv.innerHTML = "";
  UPGRADE_DEFS.forEach(u=>{
    const [id, title, desc, cost, cond] = u;
    if (S.upgradesBought[id]) return;
    if (!cond(S)) return;
    const can = S.energy >= cost;
    const el = document.createElement("div");
    el.className = "upgrade-item";
    el.innerHTML = `
      <div class="store-left">
        <div class="store-title">${title}</div>
        <div class="store-desc">${desc}</div>
        <div class="store-desc">Cost: <strong>${fmt(cost)}</strong></div>
      </div>
      <div>
        <button class="upgrade-btn" ${can?"":"disabled"} data-id="${id}">Buy</button>
      </div>
    `;
    el.querySelector(".upgrade-btn").addEventListener("click", ()=>buyUpgrade(id));
    upgradesDiv.appendChild(el);
  });
}

function renderAchievements(){
  achvDiv.innerHTML = "";
  ACHIEVEMENTS.forEach(a=>{
    const unlocked = !!S.achievements[a[0]];
    const el = document.createElement("div");
    el.className = "achv" + (unlocked?" unlocked":"");
    el.innerHTML = `<div><strong>${a[1]}</strong></div><div>${a[2]}</div>`;
    achvDiv.appendChild(el);
  });
}

function renderStats(){
  const eps = calcEPS(S);
  const epc = calcEPC(S);
  energyDisplay.textContent = `Energy: ${fmt(S.energy)}`;
  epsDisplay.textContent = `EPS: ${fmt(eps)}`;
  epcDisplay.textContent = `EPC: ${fmt(epc)}`;
  const starMult = (1 + S.starlight*0.10).toFixed(2);
  prestigeDisplay.textContent = `Starlight: ${S.starlight} (x${starMult})`;
  prestigeGainPreview.textContent = starlightGainFor(S);
}

function renderAll(){
  renderStats();
  renderStore();
  renderUpgrades();
  renderAchievements();
}

// ---------- Purchases ----------
function buyOrSellBuilding(i){
  const b = S.buildings[i];

  if (sellingMode) {
    if (b.count <= 0) return;
    const refund = Math.floor(buildingCost(b) * 0.5);
    b.count -= 1;
    S.energy += refund;
    renderAll();
    return;
    }

  // buying
  // do up to bulkBuy iterations (<=100) to honor per-step floor cost
  let purchased = 0;
  for (let n = 0; n < bulkBuy; n++) {
    const cost = buildingCost(b);
    if (S.energy < cost) break;
    S.energy -= cost;
    b.count++;
    purchased++;
  }
  if (purchased>0 && !S.reducedMotion) clicker.animate([{transform:"scale(1)"},{transform:"scale(1.03)"},{transform:"scale(1)"}], {duration:180});
  renderAll();
}

function buyUpgrade(id){
  const up = UPGRADE_DEFS.find(u=>u[0]===id);
  if (!up) return;
  const cost = up[3];
  if (S.energy < cost) return;
  S.energy -= cost;
  S.upgradesBought[id] = true;
  const effect = up[5];
  effect(S);
  renderAll();
}

// ---------- Achievements check ----------
function checkAchievements(){
  let changed = false;
  ACHIEVEMENTS.forEach(a=>{
    const [id,, , cond] = [a[0], a[1], a[2], a[3]];
    if (!S.achievements[id] && cond(S)) {
      S.achievements[id] = true;
      changed = true;
    }
  });
  if (changed) renderAchievements();
}

// ---------- Click handling: EPC, floating numbers, particles, sound ----------
clicker.addEventListener("click", (e)=>{
  const gain = calcEPC(S);
  S.energy += gain;
  S.totalEnergy += gain;

  // click sound (WebAudio beep)
  if (!S.muted) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, 60);
    } catch {}
  }

  floating(`+${fmt(gain)}`);
  particleBurst(e);

  renderStats();
});

function floating(text){
  if (S.reducedMotion) return;
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  floatingTexts.appendChild(el);
  setTimeout(()=>el.remove(), 900);
}

function particleBurst(e){
  if (S.reducedMotion) return;
  const rect = clicker.getBoundingClientRect();
  const originX = e.clientX - rect.left;
  const originY = e.clientY - rect.top - rect.height/2; // visually centered above
  for (let i=0;i<12;i++){
    const p = document.createElement("div");
    p.className="particle";
    p.style.left = `${originX}px`;
    p.style.top = `${originY}px`;
    floatingTexts.appendChild(p);
    setTimeout(()=>p.remove(), 600);
  }
}

// ---------- Random Event: Solar Surge ----------
let nextEventAt = scheduleEvent();
let surgeUntil = 0;
function scheduleEvent(){
  const now = performance.now();
  return now + (120_000 + Math.random()*180_000); // 2–5 min
}
function maybeSpawnEvent(now){
  if (now < nextEventAt) return;
  if ($("#solarSurge")) return;

  const btn = document.createElement("button");
  btn.id = "solarSurge";
  btn.className = "event-bubble";
  btn.textContent = "☄️ Solar Surge!";
  btn.title = "Click for a 10× boost for 30s (or a small burst early game)";
  btn.addEventListener("click", ()=>{
    const eps = calcEPS(S);
    if (eps > 0) {
      surgeUntil = performance.now() + 30_000;
    } else {
      S.energy += 77; // early-game nudge
    }
    btn.remove();
    nextEventAt = scheduleEvent();
  });
  eventArea.appendChild(btn);
}

// ---------- Game loop ----------
let autosaveTimer = 0;
function loop(now){
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // EPS production (10× during surge)
  let eps = calcEPS(S);
  if (now < surgeUntil) eps *= 10;
  const gained = eps * dt;
  S.energy += gained;
  S.totalEnergy += gained;

  autosaveTimer += dt;
  if (autosaveTimer >= S.autosaveSeconds) {
    save(); autosaveTimer = 0;
  }

  if (Math.floor(now/1000) % 2 === 0) checkAchievements();
  maybeSpawnEvent(now);

  renderStats();
  requestAnimationFrame(loop);
}

// ---------- Cloud Save (optional) ----------
// These stubs expect a tiny backend that exposes:
//   POST /api/save body: { id: string, data: object }
//   POST /api/load body: { id: string } -> { data: object }
// You can implement with Firebase Functions, Supabase edge functions,
// or a simple Node/Express server. Until you add a backend, these
// will no-op gracefully.

async function cloudSave(){
  const id = ($("#cloudId").value || S.cloudId || "").trim();
  if (!id) return alert("Enter a Cloud ID first.");
  S.cloudId = id;
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id, data: S })
    });
    if (!res.ok) throw new Error("Save failed");
    alert("Saved to cloud.");
  } catch (e) {
    console.warn(e);
    alert("Cloud save requires a backend. See comments in game.js.");
  }
}

async function cloudLoad(){
  const id = ($("#cloudId").value || S.cloudId || "").trim();
  if (!id) return alert("Enter a Cloud ID first.");
  try {
    const res = await fetch("/api/load", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error("Load failed");
    const { data } = await res.json();
    if (!data) throw new Error("No data found for that ID");
    S = Object.assign(structuredClone(baseState), data);
    ensureBuildings(S);
    save(); renderAll();
    alert("Loaded from cloud.");
  } catch (e) {
    console.warn(e);
    alert("Cloud load requires a backend. See comments in game.js.");
  }
}

// ---------- Init ----------
function init(){
  ensureBuildings(S);
  load(); ensureBuildings(S);
  applySettingsToUI();
  renderAll();
  lastTick = performance.now();
  requestAnimationFrame(loop);
  // Rebuild available upgrades every ~1s (cheap)
  setInterval(renderUpgrades, 1000);
  // Achievement pass every 2s
  setInterval(checkAchievements, 2000);
}
init();
