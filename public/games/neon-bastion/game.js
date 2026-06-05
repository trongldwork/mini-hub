// ============================================
// Neon Bastion — game.js
// Tower Defense — 50 Waves, 5 Maps
// ============================================

const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';

// ─── CONSTANTS ───────────────────────────────
const COLS = 20, ROWS = 14;
const MAX_WAVE = 50;
const START_GOLD = 150;
const START_LIVES = 20;
const BUILD_RATIO_MIN = 0.70;
const BUILD_RATIO_MAX = 0.85;

// ─── TOWER DEFS ──────────────────────────────
const TOWER_DEFS = {
  blaster: { name: 'Blaster', cost: 50, dmg: 10, range: 3, speed: 0.8, color: '#E63946', special: 'none' },
  frost: { name: 'Frost Beam', cost: 75, dmg: 5, range: 3, speed: 1.2, color: '#5bcefa', special: 'slow' },
  plasma: { name: 'Plasma Cannon', cost: 150, dmg: 35, range: 4, speed: 2.5, color: '#ff8c00', special: 'splash' },
  sniper: { name: 'Sniper Turret', cost: 200, dmg: 80, range: 6, speed: 3.5, color: '#ff4466', special: 'none' },
  tesla: { name: 'Tesla Coil', cost: 300, dmg: 15, range: 2.5, speed: 0.9, color: '#a855f7', special: 'chain' },
};

// ─── MAP DATA ────────────────────────────────
// 0 = empty (potential build), 1 = path, 2 = wall/decoration
// Each map: { name, grid (ROWS x COLS), waypoints [[x,y]...] }
const MAPS = [
  { // Map 1: Neon Grid (waves 1-10) — S-curve
    name: 'Neon Grid', waves: '1–10',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [[0, 1], [5, 1], [5, 4], [14, 4], [14, 8], [5, 8], [5, 11], [19, 11]],
  },
  { // Map 2: Void Canyon (waves 11-20) — zigzag
    name: 'Void Canyon', waves: '11–20',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [[0, 1], [3, 1], [3, 3], [16, 3], [16, 6], [3, 6], [3, 8], [16, 8], [16, 11], [19, 11]],
  },
  { // Map 3: Circuit Board (waves 21-30)
    name: 'Circuit Board', waves: '21–30',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [[0, 1], [4, 1], [4, 5], [14, 5], [14, 1], [19, 1]], // top entrance
    waypoints2: [[19, 11], [9, 11], [9, 5]], // merges at center
  },
  { // Map 4: Plasma Core (waves 31-40) — spiral
    name: 'Plasma Core', waves: '31–40',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [[0, 1], [17, 1], [17, 2], [2, 2], [2, 3], [15, 3], [15, 4], [4, 4], [4, 5], [12, 5], [12, 8], [4, 8], [4, 9], [15, 9], [15, 10], [2, 10], [2, 11], [17, 11], [17, 12], [19, 12]],
  },
  { // Map 5: The Abyss (waves 41-50) — complex winding
    name: 'The Abyss', waves: '41–50',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [[0, 1], [2, 1], [2, 3], [7, 3], [7, 1], [11, 1], [11, 3], [16, 3], [16, 6], [2, 6], [2, 9], [6, 9], [6, 11], [10, 11], [10, 9], [17, 9], [17, 11], [19, 11]],
  },
];

// ─── DOM ─────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hudWave = document.getElementById('hud-wave');
const hudLives = document.getElementById('hud-lives');
const hudGold = document.getElementById('hud-gold');
const hudMap = document.getElementById('hud-map');
const btnStart = document.getElementById('btn-start');
const btnNextWave = document.getElementById('btn-next-wave');
const btnHelp = document.getElementById('btn-help');
const btnHelpClose = document.getElementById('btn-help-close');
const startOverlay = document.getElementById('start-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const victoryOverlay = document.getElementById('victory-overlay');
const helpModal = document.getElementById('help-modal');
const mapSplash = document.getElementById('map-splash');
const splashMapName = document.getElementById('splash-map-name');
const splashMapWaves = document.getElementById('splash-map-waves');
const goWave = document.getElementById('go-wave');
const towerAction = document.getElementById('tower-action');
const taName = document.getElementById('ta-name');
const taStats = document.getElementById('ta-stats');
const taUpgradeCost = document.getElementById('ta-upgrade-cost');
const taSellValue = document.getElementById('ta-sell-value');
const btnUpgrade = document.getElementById('btn-upgrade');
const btnSell = document.getElementById('btn-sell');

// ─── GAME STATE ──────────────────────────────
let tileSize = 0;
let offsetX = 0, offsetY = 0;
let gold = START_GOLD;
let lives = START_LIVES;
let wave = 0;
let currentMapIdx = 0;
let currentMap = null;
let buildableTiles = new Set(); // "col,row" strings
let towers = [];   // { col, row, type, level, angle, cooldown, totalInvested }
let enemies = [];  // { x, y, hp, maxHp, speed, baseSpeed, gold, wpIdx, type, animT, dead, deathT, slowT }
let projectiles = []; // { x, y, tx, ty, speed, dmg, type, target, life }
let particles = [];  // { x, y, vx, vy, life, maxLife, color, size }
let notifications = [];

let selectedTowerType = null; // tower type to place
let selectedTower = null;     // existing tower being inspected
let mouseCol = -1, mouseRow = -1;
let isPlaying = false;
let isPaused = false;
let isWaveActive = false;
let waveCountdown = 0;
let spawnQueue = [];
let spawnTimer = 0;
let lastTime = 0;
let animFrame = 0;

// ─── SEEDED RNG ──────────────────────────────
function seededRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── RESIZE ──────────────────────────────────
function resize() {
  const hudH = 48, barH = 70;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - hudH - barH;
  tileSize = Math.floor(Math.min(canvas.width / COLS, canvas.height / ROWS));
  offsetX = Math.floor((canvas.width - tileSize * COLS) / 2);
  offsetY = Math.floor((canvas.height - tileSize * ROWS) / 2);
}
window.addEventListener('resize', resize);
resize();

// ─── MAP SYSTEM ──────────────────────────────
function getMapForWave(w) {
  if (w <= 10) return 0;
  if (w <= 20) return 1;
  if (w <= 30) return 2;
  if (w <= 40) return 3;
  return 4;
}

function loadMap(idx) {
  currentMapIdx = idx;
  currentMap = MAPS[idx];
  hudMap.textContent = currentMap.name;
}

function generateBuildSpots(waveNum) {
  const rng = seededRng(waveNum * 7919 + currentMapIdx * 1301);
  const allEmpty = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap.grid[r][c] === 0) allEmpty.push(`${c},${r}`);
    }
  }
  // Shuffle
  for (let i = allEmpty.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allEmpty[i], allEmpty[j]] = [allEmpty[j], allEmpty[i]];
  }
  const ratio = BUILD_RATIO_MIN + rng() * (BUILD_RATIO_MAX - BUILD_RATIO_MIN);
  const count = Math.max(8, Math.floor(allEmpty.length * ratio));
  const selected = new Set(allEmpty.slice(0, count));

  // Ensure ≥2 spots near each path tile
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap.grid[r][c] !== 1) continue;
      const neighbors = [];
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && currentMap.grid[nr][nc] === 0)
          neighbors.push(`${nc},${nr}`);
      }
      let adj = neighbors.filter(k => selected.has(k)).length;
      for (const k of neighbors) {
        if (adj >= 2) break;
        if (!selected.has(k)) { selected.add(k); adj++; }
      }
    }
  }
  return selected;
}

function applyBuildSpots(newSpots) {
  // Auto-sell displaced towers at 100% refund
  let displaced = 0;
  towers = towers.filter(t => {
    const key = `${t.col},${t.row}`;
    if (!newSpots.has(key)) {
      gold += t.totalInvested;
      displaced++;
      return false;
    }
    return true;
  });
  buildableTiles = newSpots;
  if (displaced > 0) {
    showNotification(`⚠ Ground shifted! ${displaced} tower${displaced > 1 ? 's' : ''} refunded.`);
  }
}

// ─── NOTIFICATIONS ───────────────────────────
function showNotification(text) {
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = text;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ─── WAVE SYSTEM ─────────────────────────────
function getWaveConfig(w) {
  const isBoss = (w % 10 === 0);
  const hp = 20 + w * 8 + Math.floor(w / 10) * 40;
  const speed = Math.min(2.5, 1.0 + w * 0.015);
  const count = isBoss ? 1 : 5 + Math.floor(w * 1.2);
  const gld = isBoss ? (5 + Math.floor(w * 0.5)) * 5 : 5 + Math.floor(w * 0.5);
  const type = isBoss ? 'boss' : (w > 30 ? 'tank' : (w > 15 ? 'runner' : 'grunt'));
  return { hp: isBoss ? hp * 10 : hp, speed: isBoss ? speed * 0.6 : speed, count, gold: gld, type, isBoss };
}

function startWave() {
  wave++;
  isWaveActive = true;
  waveCountdown = 0;
  btnNextWave.disabled = true;

  // Map transition was already handled in onWaveComplete().
  // Build spots were already shifted in onWaveComplete().

  updateHUD();

  // Spawn queue
  const cfg = getWaveConfig(wave);
  spawnQueue = [];
  for (let i = 0; i < cfg.count; i++) {
    spawnQueue.push({ ...cfg });
  }
  spawnTimer = 0;
}

// Called when a wave finishes — prepare the board for the NEXT wave
// so the player can rebuild/adapt before pressing "Next Wave"
function onWaveComplete() {
  isWaveActive = false;
  btnNextWave.disabled = false;

  if (wave >= MAX_WAVE) {
    victory();
    return;
  }

  const nextWave = wave + 1;
  const nextMapIdx = getMapForWave(nextWave);

  if (nextMapIdx !== currentMapIdx) {
    // MAP CHANGE — refund all towers, load new map, show splash
    for (const t of towers) {
      gold += t.totalInvested;
    }
    showNotification(`🗺️ New sector! ${towers.length} tower${towers.length !== 1 ? 's' : ''} refunded.`);
    towers = [];
    loadMap(nextMapIdx);
    const newSpots = generateBuildSpots(nextWave);
    applyBuildSpots(newSpots);
    showMapSplash();
  } else {
    // Same map — just shift build spots
    const newSpots = generateBuildSpots(nextWave);
    applyBuildSpots(newSpots);
  }
  updateHUD();
}

function showMapSplash() {
  splashMapName.textContent = currentMap.name;
  splashMapWaves.textContent = `Waves ${currentMap.waves}`;
  mapSplash.classList.remove('hidden');
  setTimeout(() => mapSplash.classList.add('hidden'), 1800);
}

// ─── ENEMY SYSTEM ────────────────────────────
function spawnEnemy(cfg) {
  const wp = currentMap.waypoints;
  enemies.push({
    x: wp[0][0] * tileSize + tileSize / 2 + offsetX,
    y: wp[0][1] * tileSize + tileSize / 2 + offsetY,
    hp: cfg.hp, maxHp: cfg.hp,
    speed: cfg.speed, baseSpeed: cfg.speed,
    gold: cfg.gold,
    wpIdx: 1,
    type: cfg.type,
    animT: Math.random() * Math.PI * 2,
    dead: false, deathT: 0,
    slowT: 0,
    flashT: 0,
  });
}

function updateEnemies(dt) {
  const wp = currentMap.waypoints;
  for (const e of enemies) {
    if (e.dead) { e.deathT += dt; continue; }

    // Slow decay
    if (e.slowT > 0) {
      e.slowT -= dt;
      e.speed = e.baseSpeed * 0.6;
    } else {
      e.speed = e.baseSpeed;
    }

    // Flash decay
    if (e.flashT > 0) e.flashT -= dt;

    // Move toward next waypoint
    if (e.wpIdx >= wp.length) {
      // Reached exit
      lives--;
      e.dead = true;
      e.deathT = 99;
      if (lives <= 0) gameOver();
      continue;
    }

    const tx = wp[e.wpIdx][0] * tileSize + tileSize / 2 + offsetX;
    const ty = wp[e.wpIdx][1] * tileSize + tileSize / 2 + offsetY;
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = e.speed * tileSize * dt;

    if (dist <= step) {
      e.x = tx; e.y = ty;
      e.wpIdx++;
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
    e.animT += dt * e.speed * 8;
  }
  // Remove fully dead
  enemies = enemies.filter(e => !(e.dead && e.deathT > 0.5));
}

// ─── TOWER SYSTEM ────────────────────────────
function placeTower(col, row, type) {
  const def = TOWER_DEFS[type];
  if (gold < def.cost) return false;
  gold -= def.cost;
  towers.push({
    col, row, type, level: 1,
    angle: 0, cooldown: 0,
    totalInvested: def.cost,
  });
  updateHUD();
  return true;
}

function upgradeTower(tower) {
  const def = TOWER_DEFS[tower.type];
  if (tower.level >= 3) return false;
  const cost = Math.ceil(def.cost * 0.6);
  if (gold < cost) return false;
  gold -= cost;
  tower.level++;
  tower.totalInvested += cost;
  updateHUD();
  return true;
}

function sellTower(tower) {
  const refund = Math.floor(tower.totalInvested * 0.6);
  gold += refund;
  towers = towers.filter(t => t !== tower);
  updateHUD();
  return refund;
}

function getTowerDamage(tower) {
  const def = TOWER_DEFS[tower.type];
  return def.dmg * (1 + (tower.level - 1) * 0.5);
}

function getTowerRange(tower) {
  return TOWER_DEFS[tower.type].range * tileSize;
}

function updateTowers(dt) {
  for (const t of towers) {
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;

    const def = TOWER_DEFS[t.type];
    const tx = t.col * tileSize + tileSize / 2 + offsetX;
    const ty = t.row * tileSize + tileSize / 2 + offsetY;
    const range = getTowerRange(t);

    // Find nearest enemy
    let target = null, minDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - tx, e.y - ty);
      if (d <= range && d < minDist) {
        target = e; minDist = d;
      }
    }

    if (target) {
      t.angle = Math.atan2(target.y - ty, target.x - tx);
      t.cooldown = def.speed;
      fireProjectile(t, target, tx, ty);
    }
  }
}

// ─── PROJECTILE SYSTEM ───────────────────────
function fireProjectile(tower, target, fromX, fromY) {
  const def = TOWER_DEFS[tower.type];
  const dmg = getTowerDamage(tower);

  if (def.special === 'slow') {
    // Frost: instant beam effect
    dealDamage(target, dmg, tower);
    target.slowT = 2;
    projectiles.push({ x: fromX, y: fromY, tx: target.x, ty: target.y, type: 'beam', life: 0.2, maxLife: 0.2, color: def.color });
  } else if (def.special === 'chain') {
    // Tesla: chain to up to 3
    const range = getTowerRange(tower);
    const hit = [target];
    dealDamage(target, dmg, tower);
    for (let i = 1; i < 3; i++) {
      const last = hit[hit.length - 1];
      let best = null, bestD = Infinity;
      for (const e of enemies) {
        if (e.dead || hit.includes(e)) continue;
        const d = Math.hypot(e.x - last.x, e.y - last.y);
        if (d < range * 0.6 && d < bestD) { best = e; bestD = d; }
      }
      if (best) { hit.push(best); dealDamage(best, dmg * 0.7, tower); }
    }
    for (let i = 0; i < hit.length - 1; i++) {
      projectiles.push({ x: hit[i].x, y: hit[i].y, tx: hit[i + 1].x, ty: hit[i + 1].y, type: 'arc', life: 0.25, maxLife: 0.25, color: def.color });
    }
    projectiles.push({ x: fromX, y: fromY, tx: target.x, ty: target.y, type: 'arc', life: 0.25, maxLife: 0.25, color: def.color });
  } else {
    // Bullet projectile
    projectiles.push({
      x: fromX, y: fromY,
      tx: target.x, ty: target.y,
      speed: 400, dmg, type: def.special === 'splash' ? 'splash' : 'bullet',
      target, life: 2, maxLife: 2, color: def.color,
      tower,
    });
  }
}

function dealDamage(enemy, dmg, tower) {
  if (enemy.dead) return;
  enemy.hp -= dmg;
  enemy.flashT = 0.1;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.deathT = 0;
    gold += enemy.gold;
    // Death particles
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 / 8) * i;
      particles.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(ang) * (40 + Math.random() * 40),
        vy: Math.sin(ang) * (40 + Math.random() * 40),
        life: 0.5, maxLife: 0.5,
        color: TOWER_DEFS[tower.type].color,
        size: 3,
      });
    }
    updateHUD();
  }
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.life -= dt;
    if (p.type === 'beam' || p.type === 'arc') continue; // instant visual

    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * dt;

    if (dist <= step) {
      // Hit
      if (p.type === 'splash') {
        // Splash damage
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.tx, e.y - p.ty) <= tileSize) {
            dealDamage(e, p.dmg, p.tower);
          }
        }
        // Splash ring particle
        particles.push({ x: p.tx, y: p.ty, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: p.color, size: tileSize, isRing: true });
      } else {
        dealDamage(p.target, p.dmg, p.tower);
      }
      p.life = -1;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }
  projectiles = projectiles.filter(p => p.life > 0);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter(p => p.life > 0);
}

// ─── DRAWING ─────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPathGlow();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawPlacementGhost();
}

// ── MAP ──────────────────────────────────────
function drawGrid() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * tileSize + offsetX;
      const y = r * tileSize + offsetY;
      const tile = currentMap.grid[r][c];
      const key = `${c},${r}`;

      // Base fill
      if (tile === 2) {
        // Wall: very dark, heavy industrial
        const g = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
        g.addColorStop(0, '#0a0a0a');
        g.addColorStop(1, '#0f0f0f');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
        // Corner rivets (brighter for contrast)
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x + 2, y + 2, 3, 3);
        ctx.fillRect(x + tileSize - 5, y + 2, 3, 3);
        ctx.fillRect(x + 2, y + tileSize - 5, 3, 3);
        ctx.fillRect(x + tileSize - 5, y + tileSize - 5, 3, 3);
        // Inner border
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      } else if (tile === 1) {
        // Path: lighter base so it stands out clearly
        const g = ctx.createLinearGradient(x, y, x, y + tileSize);
        g.addColorStop(0, '#2c2222');
        g.addColorStop(1, '#302525');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
      } else if (buildableTiles.has(key)) {
        // Buildable: strong green tint
        const g = ctx.createRadialGradient(x + tileSize / 2, y + tileSize / 2, 0, x + tileSize / 2, y + tileSize / 2, tileSize * 0.7);
        g.addColorStop(0, '#1a3a1a');
        g.addColorStop(1, '#152a15');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
        // Pulsing border (stronger)
        const pulse = 0.15 + Math.sin(animFrame * 2 + c * 0.3 + r * 0.5) * 0.08;
        ctx.strokeStyle = `rgba(61, 220, 132, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        // Center dot marker
        ctx.fillStyle = `rgba(61, 220, 132, ${pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(x + tileSize / 2, y + tileSize / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Unbuildable: reddish-brown tint to contrast with buildable green
        ctx.fillStyle = '#1a1414';
        ctx.fillRect(x, y, tileSize, tileSize);
        // Crack lines (more visible)
        ctx.strokeStyle = 'rgba(255,100,80,0.06)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x + tileSize * 0.15, y + tileSize * 0.85);
        ctx.lineTo(x + tileSize * 0.5, y + tileSize * 0.25);
        ctx.lineTo(x + tileSize * 0.75, y + tileSize * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + tileSize * 0.6, y + tileSize * 0.15);
        ctx.lineTo(x + tileSize * 0.35, y + tileSize * 0.55);
        ctx.stroke();
      }

      // Grid lines
      ctx.strokeStyle = tile === 2 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, tileSize, tileSize);
    }
  }
}

function drawPathGlow() {
  // Draw path neon glow edges and animated center line
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap.grid[r][c] !== 1) continue;
      const x = c * tileSize + offsetX;
      const y = r * tileSize + offsetY;
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;

      // Radial inner glow (brighter for contrast)
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, tileSize * 0.7);
      glow.addColorStop(0, 'rgba(230, 57, 70, 0.2)');
      glow.addColorStop(0.5, 'rgba(230, 57, 70, 0.08)');
      glow.addColorStop(1, 'rgba(230, 57, 70, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, tileSize, tileSize);

      // Edge glow on sides that border non-path
      const edges = [
        [c, r - 1, x, y, x + tileSize, y],           // top
        [c, r + 1, x, y + tileSize, x + tileSize, y + tileSize], // bottom
        [c - 1, r, x, y, x, y + tileSize],           // left
        [c + 1, r, x + tileSize, y, x + tileSize, y + tileSize], // right
      ];
      for (const [nc, nr, x1, y1, x2, y2] of edges) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || currentMap.grid[nr][nc] !== 1) {
          const pulse = 0.4 + Math.sin(animFrame * 1.5 + c * 0.7 + r * 0.4) * 0.15;
          ctx.strokeStyle = `rgba(230, 57, 70, ${pulse})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }
  }
}

// ── TOWERS ───────────────────────────────────
function drawTowers() {
  for (const t of towers) {
    const cx = t.col * tileSize + tileSize / 2 + offsetX;
    const cy = t.row * tileSize + tileSize / 2 + offsetY;
    const def = TOWER_DEFS[t.type];
    const s = tileSize * 0.4;

    ctx.save();
    ctx.translate(cx, cy);

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.5, s * 0.9, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Level glow rings
    for (let lv = 1; lv < t.level; lv++) {
      const r = s + 3 + lv * 4 + Math.sin(animFrame * 2.5 + lv) * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hexToRgb(def.color)}, ${0.12 + lv * 0.06})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- BASE ---
    const baseGrad = ctx.createRadialGradient(0, -s * 0.2, 0, 0, 0, s);
    baseGrad.addColorStop(0, '#444');
    baseGrad.addColorStop(0.7, '#2a2a2a');
    baseGrad.addColorStop(1, '#1a1a1a');

    if (t.type === 'blaster') {
      ctx.fillStyle = baseGrad;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      drawHexagon(ctx, 0, 0, s);
      // Inner detail ring
      ctx.strokeStyle = 'rgba(230,57,70,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (t.type === 'frost') {
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Ice shards around base
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + animFrame * 0.3;
        ctx.fillStyle = 'rgba(91,206,250,0.25)';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7);
        ctx.lineTo(Math.cos(a + 0.15) * s * 1.1, Math.sin(a + 0.15) * s * 1.1);
        ctx.lineTo(Math.cos(a + 0.3) * s * 0.7, Math.sin(a + 0.3) * s * 0.7);
        ctx.fill();
      }
    } else if (t.type === 'plasma') {
      ctx.fillStyle = baseGrad;
      roundRect(ctx, -s, -s, s * 2, s * 2, 4);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Warning stripes
      ctx.fillStyle = 'rgba(255,140,0,0.15)';
      ctx.fillRect(-s * 0.6, -s * 0.8, s * 1.2, 3);
      ctx.fillRect(-s * 0.6, s * 0.6, s * 1.2, 3);
    } else if (t.type === 'sniper') {
      // Tripod legs
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
        const lg = ctx.createLinearGradient(0, 0, Math.cos(a) * s, Math.sin(a) * s);
        lg.addColorStop(0, '#666');
        lg.addColorStop(1, '#333');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.stroke();
        // Foot
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(Math.cos(a) * s, Math.sin(a) * s, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke();
      // Scope lens glow
      ctx.fillStyle = 'rgba(255,68,102,0.4)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2); ctx.fill();
    } else if (t.type === 'tesla') {
      // Base platform
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke();
      // Coil rings
      for (let i = 0; i < 3; i++) {
        const yy = -s * 0.1 - i * s * 0.22;
        const rr = s * (0.5 - i * 0.08);
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.5 - i * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, yy, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Top spark ball
      const sparkGlow = ctx.createRadialGradient(0, -s * 0.6, 0, 0, -s * 0.6, s * 0.3);
      sparkGlow.addColorStop(0, 'rgba(168,85,247,0.9)');
      sparkGlow.addColorStop(0.5, 'rgba(168,85,247,0.3)');
      sparkGlow.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = sparkGlow;
      ctx.fillRect(-s * 0.5, -s * 0.9, s, s * 0.6);
      ctx.fillStyle = '#d8b4fe';
      ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.18, 0, Math.PI * 2); ctx.fill();
    }

    // --- BARREL/WEAPON (rotated) ---
    ctx.rotate(t.angle);

    if (t.type === 'blaster') {
      // Metallic barrel
      const barrelGrad = ctx.createLinearGradient(0, -3, 0, 3);
      barrelGrad.addColorStop(0, '#ff6b75');
      barrelGrad.addColorStop(0.5, def.color);
      barrelGrad.addColorStop(1, '#991122');
      ctx.fillStyle = barrelGrad;
      ctx.fillRect(s * 0.2, -3, s * 0.9, 6);
      // Muzzle
      ctx.fillStyle = '#ffaaaa';
      ctx.fillRect(s * 1.05, -2, 3, 4);
    } else if (t.type === 'frost') {
      // Crystal weapon
      const crystalGrad = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
      crystalGrad.addColorStop(0, '#8ae8ff');
      crystalGrad.addColorStop(0.5, '#5bcefa');
      crystalGrad.addColorStop(1, '#2a8aaa');
      ctx.fillStyle = crystalGrad;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, 0);
      ctx.lineTo(0, -s * 0.55);
      ctx.lineTo(-s * 0.3, 0);
      ctx.lineTo(0, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    } else if (t.type === 'plasma') {
      // Heavy barrel
      const pGrad = ctx.createLinearGradient(0, -5, 0, 5);
      pGrad.addColorStop(0, '#ffaa44');
      pGrad.addColorStop(0.5, def.color);
      pGrad.addColorStop(1, '#884400');
      ctx.fillStyle = pGrad;
      roundRect(ctx, s * 0.1, -4, s * 0.9, 8, 2);
      ctx.fill();
      // Muzzle flare
      ctx.fillStyle = '#ffdd88';
      roundRect(ctx, s * 0.95, -6, 5, 12, 1);
      ctx.fill();
    } else if (t.type === 'sniper') {
      // Long thin barrel
      const sGrad = ctx.createLinearGradient(0, -2, 0, 2);
      sGrad.addColorStop(0, '#ff6688');
      sGrad.addColorStop(0.5, def.color);
      sGrad.addColorStop(1, '#882233');
      ctx.fillStyle = sGrad;
      ctx.fillRect(s * 0.1, -2, s * 1.6, 4);
      // Scope
      ctx.fillStyle = '#ff4466';
      ctx.beginPath(); ctx.arc(s * 0.8, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // Show range if selected
    if (selectedTower === t) {
      const range = getTowerRange(t);
      const rangeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range);
      rangeGrad.addColorStop(0, 'rgba(0, 212, 255, 0.08)');
      rangeGrad.addColorStop(0.8, 'rgba(0, 212, 255, 0.03)');
      rangeGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI * 2);
      ctx.fillStyle = rangeGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawHexagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── ENEMIES ──────────────────────────────────
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead && e.deathT < 0.5) {
      const scale = 1 - e.deathT * 2;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = scale;
      drawEnemyBody(e, 0, 0);
      ctx.restore();
      continue;
    }
    if (e.dead) continue;

    ctx.save();
    ctx.translate(e.x, e.y);

    const bob = Math.sin(e.animT) * 2;

    // Runner motion trail
    if (e.type === 'runner' && e.slowT <= 0) {
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.08 * (4 - i);
        drawEnemyBody(e, -i * 3, bob);
      }
    }

    ctx.globalAlpha = e.slowT > 0 ? 0.85 : 1;

    if (e.flashT > 0) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
    }

    drawEnemyBody(e, 0, bob);
    ctx.shadowBlur = 0;

    ctx.restore();

    // HP bar (rounded with border)
    if (!e.dead) {
      const barW = tileSize * 0.65;
      const barH = 4;
      const bx = e.x - barW / 2;
      const by = e.y - tileSize * 0.48;
      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, bx - 1, by - 1, barW + 2, barH + 2, 2);
      ctx.fill();
      // Bar
      const ratio = Math.max(0, e.hp / e.maxHp);
      if (ratio > 0) {
        const hpGrad = ctx.createLinearGradient(bx, by, bx + barW, by);
        if (ratio > 0.5) {
          hpGrad.addColorStop(0, '#3ddc84');
          hpGrad.addColorStop(1, '#2ab864');
        } else if (ratio > 0.25) {
          hpGrad.addColorStop(0, '#ffd700');
          hpGrad.addColorStop(1, '#e6a800');
        } else {
          hpGrad.addColorStop(0, '#ff4444');
          hpGrad.addColorStop(1, '#E63946');
        }
        ctx.fillStyle = hpGrad;
        roundRect(ctx, bx, by, barW * ratio, barH, 1.5);
        ctx.fill();
      }
    }
  }
}

function drawEnemyBody(e, x, bob) {
  const s = tileSize * (e.type === 'boss' ? 0.45 : (e.type === 'tank' ? 0.35 : (e.type === 'runner' ? 0.2 : 0.22)));
  const legPhase = Math.sin(e.animT);
  const legLen = s * 0.65;
  const slowColor = '#5bcefa';

  // Shadow under enemy
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, bob + s * 0.7 + legLen, s * 0.5, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs with joints
  const legColor = e.slowT > 0 ? slowColor : (e.type === 'boss' ? '#992233' : '#999');
  ctx.strokeStyle = legColor;
  ctx.lineWidth = e.type === 'tank' || e.type === 'boss' ? 3 : 2;
  ctx.lineCap = 'round';

  // Left leg (2-segment)
  const lkx = x - s * 0.25 + legPhase * 2;
  const lky = bob + s * 0.3 + legLen * 0.5;
  const lfx = x - s * 0.3 + legPhase * 5;
  const lfy = bob + s * 0.3 + legLen;
  ctx.beginPath(); ctx.moveTo(x - s * 0.2, bob + s * 0.25); ctx.lineTo(lkx, lky); ctx.lineTo(lfx, lfy); ctx.stroke();
  // Right leg
  const rkx = x + s * 0.25 - legPhase * 2;
  const rky = bob + s * 0.3 + legLen * 0.5;
  const rfx = x + s * 0.3 - legPhase * 5;
  const rfy = bob + s * 0.3 + legLen;
  ctx.beginPath(); ctx.moveTo(x + s * 0.2, bob + s * 0.25); ctx.lineTo(rkx, rky); ctx.lineTo(rfx, rfy); ctx.stroke();

  // Body
  if (e.type === 'grunt') {
    const g = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.3, 0, x, bob, s);
    g.addColorStop(0, e.slowT > 0 ? '#8ae8ff' : '#e8e8e8');
    g.addColorStop(0.6, e.slowT > 0 ? slowColor : '#bbb');
    g.addColorStop(1, e.slowT > 0 ? '#2a8aaa' : '#777');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, bob, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.slowT > 0 ? '#2a8aaa' : '#666';
    ctx.lineWidth = 1.5; ctx.stroke();
    // Eyes
    const eyeY = bob - s * 0.15;
    ctx.fillStyle = '#1D1D1D';
    ctx.beginPath(); ctx.arc(x - s * 0.25, eyeY, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.25, eyeY, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - s * 0.22, eyeY - 1, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.28, eyeY - 1, s * 0.06, 0, Math.PI * 2); ctx.fill();

  } else if (e.type === 'runner') {
    const g = ctx.createLinearGradient(x, bob - s, x, bob + s);
    g.addColorStop(0, e.slowT > 0 ? '#8ae8ff' : '#ffe066');
    g.addColorStop(0.5, e.slowT > 0 ? slowColor : '#ffcc00');
    g.addColorStop(1, e.slowT > 0 ? '#2a8aaa' : '#cc8800');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, bob - s);
    ctx.lineTo(x + s * 0.7, bob);
    ctx.lineTo(x, bob + s * 0.8);
    ctx.lineTo(x - s * 0.7, bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = e.slowT > 0 ? '#2a8aaa' : '#aa7700';
    ctx.lineWidth = 1; ctx.stroke();
    // Eye
    ctx.fillStyle = '#1D1D1D';
    ctx.beginPath(); ctx.arc(x, bob - s * 0.2, s * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(x + 1, bob - s * 0.2, s * 0.07, 0, Math.PI * 2); ctx.fill();

  } else if (e.type === 'tank') {
    // Shield aura
    ctx.fillStyle = 'rgba(100,150,255,0.12)';
    drawHexagonSimple(ctx, x, bob, s * 1.25);
    ctx.strokeStyle = 'rgba(100,150,255,0.3)';
    ctx.lineWidth = 1;
    drawHexagonStroke(ctx, x, bob, s * 1.25);
    // Body
    const g = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.2, 0, x, bob, s);
    g.addColorStop(0, e.slowT > 0 ? '#8ae8ff' : '#aaccee');
    g.addColorStop(0.7, e.slowT > 0 ? slowColor : '#6688aa');
    g.addColorStop(1, e.slowT > 0 ? '#2a8aaa' : '#334455');
    ctx.fillStyle = g;
    drawHexagonSimple(ctx, x, bob, s);
    ctx.strokeStyle = e.slowT > 0 ? '#2a8aaa' : '#445566';
    ctx.lineWidth = 2;
    drawHexagonStroke(ctx, x, bob, s);
    // Visor
    ctx.fillStyle = 'rgba(200,220,255,0.7)';
    ctx.fillRect(x - s * 0.4, bob - s * 0.15, s * 0.8, s * 0.2);
    ctx.fillStyle = '#1D1D1D';
    ctx.fillRect(x - s * 0.1, bob - s * 0.1, s * 0.06, s * 0.1);
    ctx.fillRect(x + s * 0.1, bob - s * 0.1, s * 0.06, s * 0.1);

  } else if (e.type === 'boss') {
    // Outer aura
    const aura = ctx.createRadialGradient(x, bob, s * 0.5, x, bob, s * 1.6);
    aura.addColorStop(0, 'rgba(230,57,70,0.25)');
    aura.addColorStop(0.6, 'rgba(230,57,70,0.08)');
    aura.addColorStop(1, 'rgba(230,57,70,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(x - s * 1.8, bob - s * 1.8, s * 3.6, s * 3.6);

    // Rotating spikes
    ctx.fillStyle = '#E63946';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i + animFrame * 0.4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.85, bob + Math.sin(a) * s * 0.85);
      ctx.lineTo(x + Math.cos(a) * s * 1.4, bob + Math.sin(a) * s * 1.4);
      ctx.lineTo(x + Math.cos(a + 0.15) * s * 0.85, bob + Math.sin(a + 0.15) * s * 0.85);
      ctx.closePath();
      ctx.fill();
    }

    // Main body
    const bossGrad = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.2, 0, x, bob, s);
    bossGrad.addColorStop(0, '#ff6b75');
    bossGrad.addColorStop(0.5, '#E63946');
    bossGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = bossGrad;
    ctx.beginPath(); ctx.arc(x, bob, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff8888';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dark core
    const coreGrad = ctx.createRadialGradient(x, bob, 0, x, bob, s * 0.6);
    coreGrad.addColorStop(0, '#1D1D1D');
    coreGrad.addColorStop(0.7, '#1D1D1D');
    coreGrad.addColorStop(1, 'rgba(29,29,29,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(x, bob, s * 0.6, 0, Math.PI * 2); ctx.fill();

    // Glowing eye
    const eyeGlow = ctx.createRadialGradient(x, bob, 0, x, bob, s * 0.25);
    eyeGlow.addColorStop(0, '#fff');
    eyeGlow.addColorStop(0.4, '#ff4444');
    eyeGlow.addColorStop(1, 'rgba(230,57,70,0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath(); ctx.arc(x, bob, s * 0.25, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHexagonSimple(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

function drawHexagonStroke(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.stroke();
}

// ── PROJECTILES & PARTICLES ──────────────────
function drawProjectiles() {
  for (const p of projectiles) {
    if (p.type === 'beam') {
      const alpha = p.life / p.maxLife;
      // Outer glow
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * alpha;
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
      // Inner core
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.type === 'arc') {
      const alpha = p.life / p.maxLife;
      // Multiple jagged arcs for thickness
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = j === 0 ? p.color : '#e0d0ff';
        ctx.lineWidth = j === 0 ? 2.5 : 1;
        ctx.globalAlpha = alpha * (j === 0 ? 1 : 0.6);
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        for (let i = 1; i <= 6; i++) {
          const t = i / 6;
          ctx.lineTo(
            p.x + (p.tx - p.x) * t + (Math.random() - 0.5) * 14,
            p.y + (p.ty - p.y) * t + (Math.random() - 0.5) * 14
          );
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // Bullet with trail
      const alpha = Math.min(1, p.life / p.maxLife * 4);
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    if (p.isRing) {
      const radius = p.size * (1 - alpha);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
      // Inner ring
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 * alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      const sz = p.size * (0.5 + alpha * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawPlacementGhost() {
  if (!selectedTowerType || mouseCol < 0 || mouseRow < 0) return;
  const key = `${mouseCol},${mouseRow}`;
  const valid = currentMap.grid[mouseRow]?.[mouseCol] === 0
    && buildableTiles.has(key)
    && !towers.some(t => t.col === mouseCol && t.row === mouseRow);

  const cx = mouseCol * tileSize + tileSize / 2 + offsetX;
  const cy = mouseRow * tileSize + tileSize / 2 + offsetY;
  const def = TOWER_DEFS[selectedTowerType];

  // Range preview with gradient
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, def.range * tileSize);
  rg.addColorStop(0, valid ? 'rgba(61,220,132,0.08)' : 'rgba(230,57,70,0.08)');
  rg.addColorStop(0.8, valid ? 'rgba(61,220,132,0.03)' : 'rgba(230,57,70,0.03)');
  rg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, def.range * tileSize, 0, Math.PI * 2);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.strokeStyle = valid ? 'rgba(61,220,132,0.3)' : 'rgba(230,57,70,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ghost tower body
  ctx.globalAlpha = 0.55;
  const ghostGrad = ctx.createRadialGradient(cx, cy - tileSize * 0.1, 0, cx, cy, tileSize * 0.38);
  ghostGrad.addColorStop(0, valid ? '#aaffcc' : '#ffaaaa');
  ghostGrad.addColorStop(1, valid ? def.color : '#E63946');
  ctx.fillStyle = ghostGrad;
  ctx.beginPath(); ctx.arc(cx, cy, tileSize * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = valid ? 'rgba(61,220,132,0.6)' : 'rgba(230,57,70,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}


// ─── HUD ─────────────────────────────────────
function updateHUD() {
  hudWave.textContent = `${wave} / ${MAX_WAVE}`;
  hudLives.textContent = lives;
  hudGold.textContent = gold;
  // Update tower bar affordability
  document.querySelectorAll('.tower-btn').forEach(btn => {
    const type = btn.dataset.tower;
    btn.classList.toggle('locked', gold < TOWER_DEFS[type].cost);
  });
}

// ─── GAME FLOW ───────────────────────────────
function gameOver() {
  isPlaying = false;
  goWave.textContent = wave;
  gameoverOverlay.classList.remove('hidden');
}

function victory() {
  isPlaying = false;
  victoryOverlay.classList.remove('hidden');
}

function resetGame() {
  gold = START_GOLD; lives = START_LIVES; wave = 0;
  towers = []; enemies = []; projectiles = []; particles = [];
  selectedTowerType = null; selectedTower = null;
  isWaveActive = false; isPaused = false;
  towerAction.classList.add('hidden');
  loadMap(0);
  buildableTiles = generateBuildSpots(1);
  updateHUD();
}

function submitScore(finalWave) {
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: finalWave,
    metadata: { lives, gold }
  }, '*');
  setTimeout(() => {
    window.parent.postMessage({ type: 'GAME_EXIT' }, '*');
  }, 400);
}

// ─── HELPERS ─────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function screenToGrid(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const col = Math.floor((mx - offsetX) / tileSize);
  const row = Math.floor((my - offsetY) / tileSize);
  return { col, row };
}

// ─── INPUT ───────────────────────────────────
canvas.addEventListener('mousemove', (e) => {
  const { col, row } = screenToGrid(e.clientX, e.clientY);
  mouseCol = col; mouseRow = row;
});

canvas.addEventListener('mouseleave', () => { mouseCol = -1; mouseRow = -1; });

canvas.addEventListener('click', (e) => {
  if (!isPlaying || isPaused) return;
  const { col, row } = screenToGrid(e.clientX, e.clientY);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  // Check if clicking existing tower
  const existing = towers.find(t => t.col === col && t.row === row);
  if (existing) {
    selectExistingTower(existing, e.clientX, e.clientY);
    return;
  }

  // Place tower
  if (selectedTowerType) {
    const key = `${col},${row}`;
    if (currentMap.grid[row][col] === 0 && buildableTiles.has(key)
      && !towers.some(t => t.col === col && t.row === row)) {
      if (placeTower(col, row, selectedTowerType)) {
        // Keep type selected for rapid placement
      }
    }
    return;
  }

  // Deselect
  selectedTower = null;
  towerAction.classList.add('hidden');
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  selectedTowerType = null;
  selectedTower = null;
  towerAction.classList.add('hidden');
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
});

function selectExistingTower(tower, screenX, screenY) {
  selectedTower = tower;
  selectedTowerType = null;
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));

  const def = TOWER_DEFS[tower.type];
  taName.textContent = `${def.name} Lv${tower.level}`;
  taStats.textContent = `DMG: ${Math.floor(getTowerDamage(tower))} | RNG: ${def.range}`;

  if (tower.level >= 3) {
    btnUpgrade.disabled = true;
    taUpgradeCost.textContent = 'MAX';
  } else {
    const cost = Math.ceil(def.cost * 0.6);
    btnUpgrade.disabled = gold < cost;
    taUpgradeCost.textContent = cost;
  }
  taSellValue.textContent = Math.floor(tower.totalInvested * 0.6);

  towerAction.style.left = Math.min(screenX + 10, window.innerWidth - 200) + 'px';
  towerAction.style.top = Math.min(screenY + 10, window.innerHeight - 120) + 'px';
  towerAction.classList.remove('hidden');
}

// Tower bar buttons
document.querySelectorAll('.tower-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.tower;
    if (gold < TOWER_DEFS[type].cost) return;
    selectedTower = null;
    towerAction.classList.add('hidden');

    if (selectedTowerType === type) {
      selectedTowerType = null;
      btn.classList.remove('active');
    } else {
      selectedTowerType = type;
      document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
});

// Upgrade / Sell
btnUpgrade.addEventListener('click', () => {
  if (!selectedTower) return;
  upgradeTower(selectedTower);
  selectExistingTower(selectedTower, parseInt(towerAction.style.left), parseInt(towerAction.style.top));
});

btnSell.addEventListener('click', () => {
  if (!selectedTower) return;
  sellTower(selectedTower);
  selectedTower = null;
  towerAction.classList.add('hidden');
});

// Next wave
btnNextWave.addEventListener('click', () => {
  if (!isPlaying || isPaused) return;
  if (!isWaveActive) startWave();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && isPlaying && !isPaused && !isWaveActive) {
    e.preventDefault();
    startWave();
  }
  if (e.code === 'Escape') {
    selectedTowerType = null;
    selectedTower = null;
    towerAction.classList.add('hidden');
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
  }
});

// Help
btnHelp.addEventListener('click', () => {
  isPaused = true;
  helpModal.classList.remove('hidden');
});
btnHelpClose.addEventListener('click', () => {
  isPaused = false;
  helpModal.classList.add('hidden');
});

// Help tabs
document.querySelectorAll('.help-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.help-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.help-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
  });
});

// Start
btnStart.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  isPlaying = true;
  resetGame();
  showMapSplash();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
});

// Game over buttons
document.getElementById('btn-go-submit').addEventListener('click', () => submitScore(wave));
document.getElementById('btn-go-retry').addEventListener('click', () => {
  gameoverOverlay.classList.add('hidden');
  isPlaying = true;
  resetGame();
  showMapSplash();
});
document.getElementById('btn-vic-submit').addEventListener('click', () => submitScore(wave));
document.getElementById('btn-vic-retry').addEventListener('click', () => {
  victoryOverlay.classList.add('hidden');
  isPlaying = true;
  resetGame();
  showMapSplash();
});

// ─── HUB MESSAGES ────────────────────────────
window.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'PAUSE') isPaused = true;
  else if (type === 'RESUME') isPaused = false;
});

// ─── GAME LOOP ───────────────────────────────
function gameLoop(timestamp) {
  if (!isPlaying) return;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  animFrame += dt;

  if (!isPaused) {
    // Spawn enemies
    if (spawnQueue.length > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy(spawnQueue.shift());
        spawnTimer = 0.6;
      }
    }

    // Check wave complete
    if (isWaveActive && spawnQueue.length === 0 && enemies.filter(e => !e.dead).length === 0) {
      onWaveComplete();
    }

    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateHUD();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ─── INIT ────────────────────────────────────
loadMap(0);
buildableTiles = generateBuildSpots(1);
updateHUD();
window.parent.postMessage({ type: 'GAME_READY' }, '*');
