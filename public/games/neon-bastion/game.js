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

// Enhancement tuning
const SPEED_LEVELS = [1, 2, 3];        // simulation speed multipliers
const INTEREST_RATE = 0.05;            // +5% banked gold each wave clear
const INTEREST_CAP = 50;               // capped so it can't trivialize economy
const STREAK_WINDOW = 1.2;             // seconds between kills to keep a streak alive
const LOW_LIVES = 5;                   // threshold for the alarm vignette
const MAX_PARTICLES = 260;             // hard cap for stability
const MAX_DMGNUMS = 70;

// localStorage keys
const LS_MUTE = 'nb_muted';
const LS_SPEED = 'nb_speed';

// ─── SAFE STORAGE (iframe storage can throw) ──
function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; }
  catch { return fallback; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, String(val)); } catch { /* ignore */ }
}

// ─── TOWER DEFS ──────────────────────────────
// dmgType drives the resistance (rock-paper-scissors) system.
const TOWER_DEFS = {
  blaster: { name: 'Blaster', cost: 50, dmg: 10, range: 3, speed: 0.8, color: '#E63946', special: 'none', dmgType: 'single' },
  frost: { name: 'Frost Beam', cost: 75, dmg: 5, range: 3, speed: 1.2, color: '#5bcefa', special: 'slow', dmgType: 'single' },
  plasma: { name: 'Plasma Cannon', cost: 150, dmg: 35, range: 4, speed: 2.5, color: '#ff8c00', special: 'splash', dmgType: 'splash' },
  sniper: { name: 'Sniper Turret', cost: 200, dmg: 80, range: 6, speed: 3.5, color: '#ff4466', special: 'none', dmgType: 'single' },
  tesla: { name: 'Tesla Coil', cost: 300, dmg: 15, range: 2.5, speed: 0.9, color: '#a855f7', special: 'chain', dmgType: 'chain' },
};

const TARGET_MODES = ['nearest', 'first', 'last', 'strongest'];
const TARGET_LABELS = { nearest: 'Nearest', first: 'First', last: 'Last', strongest: 'Strongest' };

// ─── ENEMY RESISTANCE PROFILES ───────────────
// Multipliers applied per damage type, plus slow behaviour.
// badge: small readable on-canvas marker so the player can see the resistance.
const RESIST = {
  grunt:  { single: 1.0,  splash: 1.0, chain: 1.0, slowDur: 1.0, slowFactor: 0.6,  badge: null },
  runner: { single: 1.0,  splash: 1.0, chain: 1.0, slowDur: 0.5, slowFactor: 0.8,  badge: 'speed' }, // shrugs off slow
  tank:   { single: 0.55, splash: 1.3, chain: 1.3, slowDur: 1.0, slowFactor: 0.6,  badge: 'armor' }, // armored vs single hits, weak to AoE
  boss:   { single: 0.8,  splash: 0.9, chain: 0.9, slowDur: 0.5, slowFactor: 0.75, badge: 'boss' },
};

// ─── MAP DATA ────────────────────────────────
// 0 = empty (potential build), 1 = path, 2 = wall/decoration
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
  { // Map 3: Circuit Board (waves 21-30) — TWO branching entrances that merge
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
    // Two full paths. They share the [14,5] → top-right exit tail so they "merge".
    waypoints: [[0, 1], [4, 1], [4, 5], [14, 5], [14, 1], [19, 1]],
    waypoints2: [[19, 11], [9, 11], [9, 5], [14, 5], [14, 1], [19, 1]],
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
const hudSpots = document.getElementById('hud-spots');
const btnStart = document.getElementById('btn-start');
const btnNextWave = document.getElementById('btn-next-wave');
const btnHelp = document.getElementById('btn-help');
const btnHelpClose = document.getElementById('btn-help-close');
const btnMute = document.getElementById('btn-mute');
const btnSpeed = document.getElementById('btn-speed');
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
const btnTarget = document.getElementById('btn-target');
const taTargetMode = document.getElementById('ta-target-mode');
const vignette = document.getElementById('vignette');
const sellConfirm = document.getElementById('sell-confirm');
const sellConfirmText = document.getElementById('sell-confirm-text');
const btnSellYes = document.getElementById('btn-sell-yes');
const btnSellNo = document.getElementById('btn-sell-no');

// ─── GAME STATE ──────────────────────────────
let tileSize = 0;
let offsetX = 0, offsetY = 0;
let gold = START_GOLD;
let lives = START_LIVES;
let wave = 0;
let currentMapIdx = 0;
let currentMap = null;
let currentPaths = [];        // array of full waypoint paths (1 normally, 2 on Circuit Board)
let buildableTiles = new Set(); // "col,row" strings
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let damageNumbers = [];

let selectedTowerType = null;
let selectedTower = null;
let mouseCol = -1, mouseRow = -1;
let hoverTower = null;        // tower under the cursor (for hover range ring)
let isPlaying = false;
let isPaused = false;
let isWaveActive = false;
let spawnQueue = [];
let spawnTimer = 0;
let lastTime = 0;
let animFrame = 0;

// Enhancement state
let gameSpeed = 1;
let pendingSpots = null;      // next wave's build spots, staged for telegraphing
let groundShiftPending = false;
let killStreak = 0;
let streakTimer = 0;
let shakeT = 0, shakeMag = 0; // screen shake
let exitFlash = [];           // [{x,y,t}] flash where an enemy escaped
const pauseReasons = new Set();

// Object pools (reduce per-frame allocation / GC churn)
const particlePool = [];
const projPool = [];
const dmgPool = [];
const enemyPool = [];

// ─── SEEDED RNG ──────────────────────────────
function seededRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ============================================
// AUDIO SYSTEM — self-contained Web Audio synth
// ============================================
const Audio2 = (() => {
  let ctxA = null, master = null, sfxGain = null, ambGain = null;
  let started = false, muted = storageGet(LS_MUTE, '0') === '1';
  let ambOsc = [], ambLfo = null, ambLfoGain = null, ambFilter = null;
  let noiseBuf = null;
  const lastPlay = {};

  function ready() { return started && ctxA && !muted && ctxA.state === 'running'; }

  function makeNoiseBuffer() {
    const len = ctxA.sampleRate * 0.5;
    noiseBuf = ctxA.createBuffer(1, len, ctxA.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function init() {
    if (started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxA = new AC();
      master = ctxA.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctxA.destination);
      sfxGain = ctxA.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      ambGain = ctxA.createGain(); ambGain.gain.value = 0.0; ambGain.connect(master);
      makeNoiseBuffer();
      startAmbient();
      started = true;
    } catch { /* audio unavailable — game continues silently */ }
  }

  function resume() { if (ctxA && ctxA.state === 'suspended') ctxA.resume().catch(() => {}); }

  function startAmbient() {
    try {
      ambFilter = ctxA.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 320;
      ambFilter.connect(ambGain);
      [55, 82.5].forEach((f, i) => {
        const o = ctxA.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = i === 0 ? 0 : 6;
        const g = ctxA.createGain(); g.gain.value = i === 0 ? 0.6 : 0.3;
        o.connect(g).connect(ambFilter);
        o.start();
        ambOsc.push(o);
      });
      // slow tremolo
      ambLfo = ctxA.createOscillator(); ambLfo.frequency.value = 0.08;
      ambLfoGain = ctxA.createGain(); ambLfoGain.gain.value = 60;
      ambLfo.connect(ambLfoGain).connect(ambFilter.frequency);
      ambLfo.start();
    } catch { /* ignore */ }
  }

  // Generic short tone with envelope
  function tone(o) {
    if (!ready()) return;
    const t = ctxA.currentTime + (o.when || 0);
    const dur = o.dur || 0.1;
    const osc = ctxA.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t + dur);
    const g = ctxA.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfxGain);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  function noise(o) {
    if (!ready() || !noiseBuf) return;
    const t = ctxA.currentTime + (o.when || 0);
    const dur = o.dur || 0.08;
    const src = ctxA.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctxA.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.value = o.freq || 1200;
    const g = ctxA.createGain();
    g.gain.setValueAtTime(o.gain || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // throttle to avoid machine-gun stacking when many towers fire at once
  function throttled(key, ms) {
    const now = performance.now();
    if (lastPlay[key] && now - lastPlay[key] < ms) return false;
    lastPlay[key] = now;
    return true;
  }

  const api = {
    init,
    resume,
    isMuted: () => muted,
    setMuted(m) {
      muted = m;
      storageSet(LS_MUTE, m ? '1' : '0');
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctxA.currentTime, 0.02);
    },
    toggleMute() { this.setMuted(!muted); return muted; },
    // Respect pause / hub PAUSE: silence ambient while paused.
    onPause(paused) {
      if (!ambGain || !ctxA) return;
      const target = paused ? 0 : this._ambTarget;
      ambGain.gain.setTargetAtTime(target, ctxA.currentTime, 0.1);
    },
    _ambTarget: 0,
    setAmbient(on, intense) {
      this._ambTarget = on ? (intense ? 0.16 : 0.07) : 0;
      if (ambGain && ctxA && !isPaused) ambGain.gain.setTargetAtTime(this._ambTarget, ctxA.currentTime, 0.4);
      if (ambFilter && ctxA) ambFilter.frequency.setTargetAtTime(intense ? 520 : 320, ctxA.currentTime, 0.5);
    },
    fire(type) {
      if (!throttled('fire_' + type, 45)) return;
      switch (type) {
        case 'blaster': tone({ freq: 420, slideTo: 180, type: 'square', dur: 0.07, gain: 0.14 }); break;
        case 'frost': tone({ freq: 880, slideTo: 1100, type: 'sine', dur: 0.12, gain: 0.1 }); noise({ freq: 2600, dur: 0.1, gain: 0.05 }); break;
        case 'plasma': tone({ freq: 170, slideTo: 60, type: 'square', dur: 0.18, gain: 0.16 }); noise({ freq: 600, filter: 'lowpass', dur: 0.12, gain: 0.08 }); break;
        case 'sniper': tone({ freq: 1300, slideTo: 320, type: 'triangle', dur: 0.1, gain: 0.16 }); noise({ freq: 3000, dur: 0.04, gain: 0.1 }); break;
        case 'tesla': tone({ freq: 240, type: 'sawtooth', dur: 0.12, gain: 0.12 }); noise({ freq: 1800, dur: 0.12, gain: 0.07 }); break;
      }
    },
    impact() { if (throttled('impact', 35)) noise({ freq: 1500, dur: 0.05, gain: 0.06 }); },
    enemyDeath() { if (throttled('death', 30)) { tone({ freq: 300, slideTo: 70, type: 'triangle', dur: 0.16, gain: 0.12 }); noise({ freq: 900, filter: 'lowpass', dur: 0.1, gain: 0.06 }); } },
    bossSpawn() { tone({ freq: 110, type: 'sawtooth', dur: 0.7, gain: 0.18 }); tone({ freq: 146, type: 'sine', dur: 0.7, gain: 0.12, when: 0.08 }); tone({ freq: 90, slideTo: 200, type: 'square', dur: 0.5, gain: 0.1, when: 0.2 }); },
    lifeLost() { tone({ freq: 880, slideTo: 200, type: 'square', dur: 0.25, gain: 0.18 }); },
    build() { tone({ freq: 300, slideTo: 620, type: 'sine', dur: 0.12, gain: 0.16 }); },
    upgrade() { [400, 600, 820].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.1, gain: 0.14, when: i * 0.06 })); },
    sell() { tone({ freq: 520, slideTo: 240, type: 'sine', dur: 0.14, gain: 0.14 }); },
    deny() { tone({ freq: 140, type: 'square', dur: 0.14, gain: 0.13 }); },
    waveStart() { tone({ freq: 220, slideTo: 520, type: 'sawtooth', dur: 0.25, gain: 0.16 }); },
    interest() { tone({ freq: 660, slideTo: 990, type: 'sine', dur: 0.18, gain: 0.12 }); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.18, when: i * 0.14 })); },
    defeat() { [330, 262, 196, 130].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.35, gain: 0.16, when: i * 0.16 })); },
  };
  return api;
})();

// ─── RESIZE ──────────────────────────────────
function resize() {
  const hudH = 48, barH = 78;
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
  // Build the list of full paths enemies can travel (supports branching maps).
  currentPaths = [currentMap.waypoints];
  if (currentMap.waypoints2) currentPaths.push(currentMap.waypoints2);
}

function generateBuildSpots(waveNum) {
  const rng = seededRng(waveNum * 7919 + currentMapIdx * 1301);
  const allEmpty = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap.grid[r][c] === 0) allEmpty.push(`${c},${r}`);
    }
  }
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
    t.doomed = false;
    return true;
  });
  buildableTiles = newSpots;
  if (displaced > 0) {
    showNotification(`⚠ Ground shifted! ${displaced} tower${displaced > 1 ? 's' : ''} refunded.`);
  }
}

// Mark which currently-placed towers / buildable tiles will vanish next wave.
function telegraphShift() {
  if (!pendingSpots) return;
  for (const t of towers) {
    t.doomed = !pendingSpots.has(`${t.col},${t.row}`);
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
// Base scaling (HP / speed / reward) — unchanged formulas, now per-type tuned.
function getWaveConfig(w) {
  const isBoss = (w % 10 === 0);
  const hp = 20 + w * 8 + Math.floor(w / 10) * 40;
  const speed = Math.min(2.5, 1.0 + w * 0.015);
  const count = isBoss ? 1 : 5 + Math.floor(w * 1.2);
  // Base per-kill reward; boss bonus comes from TYPE_MOD so it isn't double-counted.
  const gld = 5 + Math.floor(w * 0.5);
  return { baseHp: hp, baseSpeed: speed, count, baseGold: gld, isBoss };
}

// Per-type stat shaping (keeps overall scaling but gives each type a role).
const TYPE_MOD = {
  grunt:  { hp: 1.0, speed: 1.0, gold: 1.0 },
  runner: { hp: 0.6, speed: 1.5, gold: 1.0 },
  tank:   { hp: 2.2, speed: 0.7, gold: 1.6 },
  boss:   { hp: 10,  speed: 0.6, gold: 5.0 },
};

function makeEnemyCfg(type, base) {
  const m = TYPE_MOD[type];
  return {
    type,
    hp: Math.round(base.baseHp * m.hp),
    speed: Math.min(3.0, base.baseSpeed * m.speed),
    gold: Math.round(base.baseGold * m.gold),
  };
}

// Compose a mixed spawn list for the wave (replaces single-type waves).
function getWaveSpawnList(w) {
  const base = getWaveConfig(w);
  if (base.isBoss) return [makeEnemyCfg('boss', base)];

  // Weighted composition that shifts across the 50 waves.
  let weights;
  if (w <= 8) weights = { grunt: 1.0, runner: 0.0, tank: 0.0 };
  else if (w <= 18) weights = { grunt: 0.75, runner: 0.25, tank: 0.0 };
  else if (w <= 30) weights = { grunt: 0.55, runner: 0.30, tank: 0.15 };
  else if (w <= 40) weights = { grunt: 0.35, runner: 0.30, tank: 0.35 };
  else weights = { grunt: 0.2, runner: 0.30, tank: 0.5 };

  const rng = seededRng(w * 131 + 7);
  const types = Object.keys(weights);
  const total = types.reduce((s, t) => s + weights[t], 0);
  const list = [];
  for (let i = 0; i < base.count; i++) {
    let r = rng() * total, pick = types[0];
    for (const t of types) { r -= weights[t]; if (r <= 0) { pick = t; break; } }
    list.push(makeEnemyCfg(pick, base));
  }
  // Shuffle so types interleave
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function startWave() {
  // Apply the telegraphed ground shift now (player had the lull to re-plan).
  if (groundShiftPending && pendingSpots) {
    applyBuildSpots(pendingSpots);
    pendingSpots = null;
    groundShiftPending = false;
  }

  wave++;
  isWaveActive = true;
  btnNextWave.disabled = true;

  updateHUD();
  Audio2.waveStart();
  Audio2.setAmbient(true, wave % 10 === 0); // intensify on boss waves

  spawnQueue = getWaveSpawnList(wave);
  spawnTimer = 0;
  if (wave % 10 === 0) Audio2.bossSpawn();
}

// Prepare the board for the NEXT wave during the lull.
function onWaveComplete() {
  isWaveActive = false;
  btnNextWave.disabled = false;

  // End-of-wave interest on banked gold + reset kill streak.
  const interest = Math.min(INTEREST_CAP, Math.floor(gold * INTEREST_RATE));
  if (interest > 0) {
    gold += interest;
    showNotification(`💰 Interest +${interest}g`);
    spawnDamageNumber(canvas.width / 2, 40, `+${interest}g`, '#ffd700', 16);
    Audio2.interest();
  }
  killStreak = 0;

  if (wave >= MAX_WAVE) { victory(); return; }

  const nextWave = wave + 1;
  const nextMapIdx = getMapForWave(nextWave);

  if (nextMapIdx !== currentMapIdx) {
    // MAP CHANGE — refund all towers, load new map immediately, show splash.
    for (const t of towers) gold += t.totalInvested;
    showNotification(`🗺️ New sector! ${towers.length} tower${towers.length !== 1 ? 's' : ''} refunded.`);
    towers = [];
    loadMap(nextMapIdx);
    applyBuildSpots(generateBuildSpots(nextWave));
    pendingSpots = null;
    groundShiftPending = false;
    showMapSplash();
  } else {
    // Same map — stage the next spots and telegraph them (don't apply yet).
    pendingSpots = generateBuildSpots(nextWave);
    groundShiftPending = true;
    telegraphShift();
  }
  Audio2.setAmbient(true, false);
  updateHUD();
}

function showMapSplash() {
  splashMapName.textContent = currentMap.name;
  splashMapWaves.textContent = `Waves ${currentMap.waves}`;
  mapSplash.classList.remove('hidden');
  setTimeout(() => mapSplash.classList.add('hidden'), 1800);
}

// ─── ENEMY SYSTEM ────────────────────────────
let pathRotator = 0; // distributes spawns across branching paths

function spawnEnemy(cfg) {
  // Pick a path (branching maps alternate entrances).
  const path = currentPaths[pathRotator % currentPaths.length];
  pathRotator++;
  const e = enemyPool.pop() || {};
  e.path = path;
  e.x = path[0][0] * tileSize + tileSize / 2 + offsetX;
  e.y = path[0][1] * tileSize + tileSize / 2 + offsetY;
  e.hp = cfg.hp; e.maxHp = cfg.hp;
  e.speed = cfg.speed; e.baseSpeed = cfg.speed;
  e.gold = cfg.gold;
  e.wpIdx = 1;
  e.type = cfg.type;
  e.animT = Math.random() * Math.PI * 2;
  e.dead = false; e.deathT = 0;
  e.slowT = 0; e.slowFactor = 0.6;
  e.flashT = 0;
  e.prog = 0;
  enemies.push(e);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) { e.deathT += dt; continue; }

    if (e.slowT > 0) { e.slowT -= dt; e.speed = e.baseSpeed * e.slowFactor; }
    else e.speed = e.baseSpeed;

    if (e.flashT > 0) e.flashT -= dt;

    const wp = e.path;
    if (e.wpIdx >= wp.length) {
      // Reached exit
      lives--;
      e.dead = true;
      e.deathT = 99;
      onEnemyEscaped(e);
      if (lives <= 0) { gameOver(); }
      continue;
    }

    const tx = wp[e.wpIdx][0] * tileSize + tileSize / 2 + offsetX;
    const ty = wp[e.wpIdx][1] * tileSize + tileSize / 2 + offsetY;
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = e.speed * tileSize * dt;

    if (dist <= step) { e.x = tx; e.y = ty; e.wpIdx++; }
    else { e.x += (dx / dist) * step; e.y += (dy / dist) * step; }
    // progress metric for First/Last targeting (higher = closer to exit)
    e.prog = e.wpIdx * 1000 - dist;
    e.animT += dt * e.speed * 8;
  }
  // Compact in place + recycle (no new array per frame)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead && e.deathT > 0.5) { enemyPool.push(e); enemies.splice(i, 1); }
  }
}

function onEnemyEscaped(e) {
  // Exit flash + screen shake + alarm
  const wp = e.path;
  const last = wp[wp.length - 1];
  exitFlash.push({ x: last[0] * tileSize + tileSize / 2 + offsetX, y: last[1] * tileSize + tileSize / 2 + offsetY, t: 0.6 });
  addShake(7, 0.3);
  Audio2.lifeLost();
  updateHUD();
}

// ─── TOWER SYSTEM ────────────────────────────
function placeTower(col, row, type) {
  const def = TOWER_DEFS[type];
  if (gold < def.cost) { denyFeedback('Not enough gold'); return false; }
  gold -= def.cost;
  towers.push({
    col, row, type, level: 1,
    angle: 0, cooldown: 0,
    targeting: 'nearest',
    totalInvested: def.cost,
    doomed: pendingSpots ? !pendingSpots.has(`${col},${row}`) : false,
  });
  Audio2.build();
  spawnDamageNumber(col * tileSize + tileSize / 2 + offsetX, row * tileSize + offsetY + 4, `-${def.cost}g`, '#ffd700', 12);
  updateHUD();
  return true;
}

function upgradeTower(tower) {
  const def = TOWER_DEFS[tower.type];
  if (tower.level >= 3) return false;
  const cost = Math.ceil(def.cost * 0.6);
  if (gold < cost) { denyFeedback('Not enough gold'); return false; }
  gold -= cost;
  tower.level++;
  tower.totalInvested += cost;
  Audio2.upgrade();
  updateHUD();
  return true;
}

function sellTower(tower) {
  const refund = Math.floor(tower.totalInvested * 0.6);
  gold += refund;
  towers = towers.filter(t => t !== tower);
  Audio2.sell();
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

// Targeting-mode aware acquisition.
function pickTarget(t, tx, ty, range) {
  let best = null, bestMetric = -Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tx, e.y - ty);
    if (d > range) continue;
    let metric;
    switch (t.targeting) {
      case 'first': metric = e.prog; break;
      case 'last': metric = -e.prog; break;
      case 'strongest': metric = e.hp; break;
      default: metric = -d; // nearest
    }
    if (metric > bestMetric) { bestMetric = metric; best = e; }
  }
  return best;
}

function updateTowers(dt) {
  for (const t of towers) {
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;

    const def = TOWER_DEFS[t.type];
    const tx = t.col * tileSize + tileSize / 2 + offsetX;
    const ty = t.row * tileSize + tileSize / 2 + offsetY;
    const range = getTowerRange(t);

    const target = pickTarget(t, tx, ty, range);
    if (target) {
      t.angle = Math.atan2(target.y - ty, target.x - tx);
      t.cooldown = def.speed;
      fireProjectile(t, target, tx, ty);
      Audio2.fire(t.type);
    }
  }
}

// ─── RESISTANCE ──────────────────────────────
function resistedDamage(enemy, dmg, dmgType) {
  const r = RESIST[enemy.type] || RESIST.grunt;
  return dmg * (r[dmgType] != null ? r[dmgType] : 1);
}

// ─── PROJECTILE SYSTEM ───────────────────────
function spawnProjectile(fields) {
  const p = projPool.pop() || {};
  Object.assign(p, fields);
  projectiles.push(p);
}

function fireProjectile(tower, target, fromX, fromY) {
  const def = TOWER_DEFS[tower.type];
  const dmg = getTowerDamage(tower);

  if (def.special === 'slow') {
    dealDamage(target, dmg, tower, 'single');
    const r = RESIST[target.type] || RESIST.grunt;
    target.slowFactor = r.slowFactor;
    target.slowT = 2 * r.slowDur;
    spawnProjectile({ x: fromX, y: fromY, tx: target.x, ty: target.y, type: 'beam', life: 0.2, maxLife: 0.2, color: def.color });
  } else if (def.special === 'chain') {
    const range = getTowerRange(tower);
    const hit = [target];
    dealDamage(target, dmg, tower, 'chain');
    for (let i = 1; i < 3; i++) {
      const last = hit[hit.length - 1];
      let best = null, bestD = Infinity;
      for (const e of enemies) {
        if (e.dead || hit.includes(e)) continue;
        const d = Math.hypot(e.x - last.x, e.y - last.y);
        if (d < range * 0.6 && d < bestD) { best = e; bestD = d; }
      }
      if (best) { hit.push(best); dealDamage(best, dmg * 0.7, tower, 'chain'); }
    }
    for (let i = 0; i < hit.length - 1; i++) {
      spawnProjectile({ x: hit[i].x, y: hit[i].y, tx: hit[i + 1].x, ty: hit[i + 1].y, type: 'arc', life: 0.25, maxLife: 0.25, color: def.color });
    }
    spawnProjectile({ x: fromX, y: fromY, tx: target.x, ty: target.y, type: 'arc', life: 0.25, maxLife: 0.25, color: def.color });
  } else {
    spawnProjectile({
      x: fromX, y: fromY, tx: target.x, ty: target.y,
      speed: 400, dmg, type: def.special === 'splash' ? 'splash' : 'bullet',
      target, life: 2, maxLife: 2, color: def.color, tower,
    });
  }
}

function dealDamage(enemy, dmg, tower, dmgType) {
  if (enemy.dead) return;
  const final = resistedDamage(enemy, dmg, dmgType || TOWER_DEFS[tower.type].dmgType);
  enemy.hp -= final;
  enemy.flashT = 0.1;
  spawnDamageNumber(enemy.x, enemy.y - tileSize * 0.3, String(Math.round(final)), '#fff', enemy.type === 'boss' ? 15 : 11);
  Audio2.impact();
  if (enemy.hp <= 0) killEnemy(enemy, tower);
}

function killEnemy(enemy, tower) {
  enemy.dead = true;
  enemy.deathT = 0;

  // Kill-streak coin bonus (small, balanced)
  killStreak++;
  streakTimer = STREAK_WINDOW;
  let bonus = killStreak >= 5 ? Math.min(5, Math.floor((killStreak - 4) / 2)) : 0;
  gold += enemy.gold + bonus;
  if (bonus > 0) spawnDamageNumber(enemy.x, enemy.y - tileSize * 0.55, `+${enemy.gold + bonus}g 🔥${killStreak}`, '#ffd700', 11);

  Audio2.enemyDeath();

  // Punchier disintegration
  const col = TOWER_DEFS[tower.type].color;
  for (let i = 0; i < 12; i++) {
    const ang = (Math.PI * 2 / 12) * i + Math.random() * 0.4;
    spawnParticle({ x: enemy.x, y: enemy.y, vx: Math.cos(ang) * (50 + Math.random() * 70), vy: Math.sin(ang) * (50 + Math.random() * 70), life: 0.5, maxLife: 0.5, color: col, size: 3 });
  }
  // shard streaks
  for (let i = 0; i < 5; i++) {
    const ang = Math.random() * Math.PI * 2;
    spawnParticle({ x: enemy.x, y: enemy.y, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, life: 0.35, maxLife: 0.35, color: '#fff', size: 6, shard: true, ang });
  }
  // flash ring
  spawnParticle({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: col, size: tileSize * 0.7, isRing: true });
  updateHUD();
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.life -= dt;
    if (p.type === 'beam' || p.type === 'arc') continue;

    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * dt;

    if (dist <= step) {
      if (p.type === 'splash') {
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.tx, e.y - p.ty) <= tileSize) dealDamage(e, p.dmg, p.tower, 'splash');
        }
        spawnParticle({ x: p.tx, y: p.ty, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: p.color, size: tileSize, isRing: true });
      } else if (p.target && !p.target.dead) {
        dealDamage(p.target, p.dmg, p.tower, 'single');
      }
      p.life = -1;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].life <= 0) { projPool.push(projectiles[i]); projectiles.splice(i, 1); }
  }
}

// ─── PARTICLES (pooled) ──────────────────────
function spawnParticle(fields) {
  if (particles.length >= MAX_PARTICLES) {
    // recycle oldest to keep a hard cap
    particlePool.push(particles.shift());
  }
  const p = particlePool.pop() || {};
  p.isRing = false; p.shard = false;
  Object.assign(p, fields);
  particles.push(p);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].life <= 0) { particlePool.push(particles[i]); particles.splice(i, 1); }
  }
}

// ─── FLOATING DAMAGE NUMBERS (pooled) ────────
function spawnDamageNumber(x, y, text, color, size) {
  if (damageNumbers.length >= MAX_DMGNUMS) damageNumbers.shift();
  const d = dmgPool.pop() || {};
  d.x = x; d.y = y; d.vy = -34; d.text = text; d.color = color; d.size = size || 11; d.life = 0.8; d.maxLife = 0.8;
  damageNumbers.push(d);
}

function updateDamageNumbers(dt) {
  for (const d of damageNumbers) { d.life -= dt; d.y += d.vy * dt; }
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    if (damageNumbers[i].life <= 0) { dmgPool.push(damageNumbers[i]); damageNumbers.splice(i, 1); }
  }
}

// ─── SCREEN SHAKE ────────────────────────────
function addShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }

// ─── DRAWING ─────────────────────────────────
function draw() {
  ctx.save();
  if (shakeT > 0) {
    const k = shakeT > 0 ? shakeMag * (shakeT) : 0;
    ctx.translate((Math.random() - 0.5) * k * 2, (Math.random() - 0.5) * k * 2);
  }
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
  drawGrid();
  drawPathGlow();
  drawTelegraph();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawExitFlash();
  drawHoverRange();
  drawPlacementGhost();
  drawDamageNumbers();
  ctx.restore();
}

// ── MAP ──────────────────────────────────────
function drawGrid() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * tileSize + offsetX;
      const y = r * tileSize + offsetY;
      const tile = currentMap.grid[r][c];
      const key = `${c},${r}`;

      if (tile === 2) {
        const g = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
        g.addColorStop(0, '#0a0a0a');
        g.addColorStop(1, '#0f0f0f');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x + 2, y + 2, 3, 3);
        ctx.fillRect(x + tileSize - 5, y + 2, 3, 3);
        ctx.fillRect(x + 2, y + tileSize - 5, 3, 3);
        ctx.fillRect(x + tileSize - 5, y + tileSize - 5, 3, 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      } else if (tile === 1) {
        const g = ctx.createLinearGradient(x, y, x, y + tileSize);
        g.addColorStop(0, '#2c2222');
        g.addColorStop(1, '#302525');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
      } else if (buildableTiles.has(key)) {
        const g = ctx.createRadialGradient(x + tileSize / 2, y + tileSize / 2, 0, x + tileSize / 2, y + tileSize / 2, tileSize * 0.7);
        g.addColorStop(0, '#1a3a1a');
        g.addColorStop(1, '#152a15');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, tileSize, tileSize);
        const pulse = 0.15 + Math.sin(animFrame * 2 + c * 0.3 + r * 0.5) * 0.08;
        ctx.strokeStyle = `rgba(61, 220, 132, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        ctx.fillStyle = `rgba(61, 220, 132, ${pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(x + tileSize / 2, y + tileSize / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#1a1414';
        ctx.fillRect(x, y, tileSize, tileSize);
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

      ctx.strokeStyle = tile === 2 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, tileSize, tileSize);
    }
  }
}

function drawPathGlow() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap.grid[r][c] !== 1) continue;
      const x = c * tileSize + offsetX;
      const y = r * tileSize + offsetY;
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, tileSize * 0.7);
      glow.addColorStop(0, 'rgba(230, 57, 70, 0.2)');
      glow.addColorStop(0.5, 'rgba(230, 57, 70, 0.08)');
      glow.addColorStop(1, 'rgba(230, 57, 70, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, tileSize, tileSize);

      const edges = [
        [c, r - 1, x, y, x + tileSize, y],
        [c, r + 1, x, y + tileSize, x + tileSize, y + tileSize],
        [c - 1, r, x, y, x, y + tileSize],
        [c + 1, r, x + tileSize, y, x + tileSize, y + tileSize],
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

// ── TELEGRAPH (which ground vanishes next wave) ──
function drawTelegraph() {
  if (!groundShiftPending || !pendingSpots) return;
  const blink = 0.4 + Math.sin(animFrame * 4) * 0.3;
  for (const key of buildableTiles) {
    if (pendingSpots.has(key)) continue; // this tile survives
    const [c, r] = key.split(',').map(Number);
    const x = c * tileSize + offsetX, y = r * tileSize + offsetY;
    // vanishing tile — red hazard hatch
    ctx.strokeStyle = `rgba(230, 57, 70, ${blink})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
    ctx.setLineDash([]);
  }
  // Strong warning on doomed towers
  for (const t of towers) {
    if (!t.doomed) continue;
    const x = t.col * tileSize + offsetX, y = t.row * tileSize + offsetY;
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.5 + blink * 0.5})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
    ctx.fillStyle = `rgba(255,60,60,${blink})`;
    ctx.font = `bold ${Math.floor(tileSize * 0.5)}px Outfit, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x + tileSize / 2, y + tileSize * 0.28);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.5, s * 0.9, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let lv = 1; lv < t.level; lv++) {
      const r = s + 3 + lv * 4 + Math.sin(animFrame * 2.5 + lv) * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hexToRgb(def.color)}, ${0.12 + lv * 0.06})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const baseGrad = ctx.createRadialGradient(0, -s * 0.2, 0, 0, 0, s);
    baseGrad.addColorStop(0, '#444');
    baseGrad.addColorStop(0.7, '#2a2a2a');
    baseGrad.addColorStop(1, '#1a1a1a');

    if (t.type === 'blaster') {
      ctx.fillStyle = baseGrad;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      drawHexagon(ctx, 0, 0, s);
      ctx.strokeStyle = 'rgba(230,57,70,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (t.type === 'frost') {
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.stroke();
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
      ctx.fillStyle = 'rgba(255,140,0,0.15)';
      ctx.fillRect(-s * 0.6, -s * 0.8, s * 1.2, 3);
      ctx.fillRect(-s * 0.6, s * 0.6, s * 1.2, 3);
    } else if (t.type === 'sniper') {
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
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(Math.cos(a) * s, Math.sin(a) * s, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,68,102,0.4)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2); ctx.fill();
    } else if (t.type === 'tesla') {
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const yy = -s * 0.1 - i * s * 0.22;
        const rr = s * (0.5 - i * 0.08);
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.5 - i * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, yy, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const sparkGlow = ctx.createRadialGradient(0, -s * 0.6, 0, 0, -s * 0.6, s * 0.3);
      sparkGlow.addColorStop(0, 'rgba(168,85,247,0.9)');
      sparkGlow.addColorStop(0.5, 'rgba(168,85,247,0.3)');
      sparkGlow.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = sparkGlow;
      ctx.fillRect(-s * 0.5, -s * 0.9, s, s * 0.6);
      ctx.fillStyle = '#d8b4fe';
      ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.18, 0, Math.PI * 2); ctx.fill();
    }

    ctx.rotate(t.angle);

    if (t.type === 'blaster') {
      const barrelGrad = ctx.createLinearGradient(0, -3, 0, 3);
      barrelGrad.addColorStop(0, '#ff6b75');
      barrelGrad.addColorStop(0.5, def.color);
      barrelGrad.addColorStop(1, '#991122');
      ctx.fillStyle = barrelGrad;
      ctx.fillRect(s * 0.2, -3, s * 0.9, 6);
      ctx.fillStyle = '#ffaaaa';
      ctx.fillRect(s * 1.05, -2, 3, 4);
    } else if (t.type === 'frost') {
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
      const pGrad = ctx.createLinearGradient(0, -5, 0, 5);
      pGrad.addColorStop(0, '#ffaa44');
      pGrad.addColorStop(0.5, def.color);
      pGrad.addColorStop(1, '#884400');
      ctx.fillStyle = pGrad;
      roundRect(ctx, s * 0.1, -4, s * 0.9, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#ffdd88';
      roundRect(ctx, s * 0.95, -6, 5, 12, 1);
      ctx.fill();
    } else if (t.type === 'sniper') {
      const sGrad = ctx.createLinearGradient(0, -2, 0, 2);
      sGrad.addColorStop(0, '#ff6688');
      sGrad.addColorStop(0.5, def.color);
      sGrad.addColorStop(1, '#882233');
      ctx.fillStyle = sGrad;
      ctx.fillRect(s * 0.1, -2, s * 1.6, 4);
      ctx.fillStyle = '#ff4466';
      ctx.beginPath(); ctx.arc(s * 0.8, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // Show range if selected
    if (selectedTower === t) drawRangeRing(cx, cy, getTowerRange(t), 'rgba(0, 212, 255, 0.3)', 'rgba(0, 212, 255, 0.08)');
  }
}

function drawRangeRing(cx, cy, range, stroke, fill0) {
  const rangeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range);
  rangeGrad.addColorStop(0, fill0);
  rangeGrad.addColorStop(0.8, 'rgba(0, 212, 255, 0.02)');
  rangeGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, range, 0, Math.PI * 2);
  ctx.fillStyle = rangeGrad;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Hover range ring (when not placing / not selected)
function drawHoverRange() {
  if (selectedTowerType || !hoverTower || hoverTower === selectedTower) return;
  const cx = hoverTower.col * tileSize + tileSize / 2 + offsetX;
  const cy = hoverTower.row * tileSize + tileSize / 2 + offsetY;
  drawRangeRing(cx, cy, getTowerRange(hoverTower), 'rgba(0, 212, 255, 0.18)', 'rgba(0, 212, 255, 0.05)');
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

    if (e.type === 'runner' && e.slowT <= 0) {
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.08 * (4 - i);
        drawEnemyBody(e, -i * 3, bob);
      }
    }

    ctx.globalAlpha = e.slowT > 0 ? 0.85 : 1;
    if (e.flashT > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; }
    drawEnemyBody(e, 0, bob);
    ctx.shadowBlur = 0;
    ctx.restore();

    if (!e.dead) {
      const barW = tileSize * 0.65;
      const barH = 4;
      const bx = e.x - barW / 2;
      const by = e.y - tileSize * 0.48;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, bx - 1, by - 1, barW + 2, barH + 2, 2);
      ctx.fill();
      const ratio = Math.max(0, e.hp / e.maxHp);
      if (ratio > 0) {
        const hpGrad = ctx.createLinearGradient(bx, by, bx + barW, by);
        if (ratio > 0.5) { hpGrad.addColorStop(0, '#3ddc84'); hpGrad.addColorStop(1, '#2ab864'); }
        else if (ratio > 0.25) { hpGrad.addColorStop(0, '#ffd700'); hpGrad.addColorStop(1, '#e6a800'); }
        else { hpGrad.addColorStop(0, '#ff4444'); hpGrad.addColorStop(1, '#E63946'); }
        ctx.fillStyle = hpGrad;
        roundRect(ctx, bx, by, barW * ratio, barH, 1.5);
        ctx.fill();
      }
      drawResistBadge(e, bx - 7, by + 1);
    }
  }
}

// Small readable marker showing an enemy's resistance class.
function drawResistBadge(e, x, y) {
  const badge = (RESIST[e.type] || {}).badge;
  if (!badge) return;
  ctx.save();
  if (badge === 'armor') {        // tank: blue shield chip
    ctx.fillStyle = '#6aa9ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 3); ctx.lineTo(x + 4, y - 1); ctx.lineTo(x + 4, y + 2);
    ctx.lineTo(x + 2, y + 5); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill();
  } else if (badge === 'speed') { // runner: cyan slow-resist dash
    ctx.fillStyle = '#5bcefa';
    ctx.fillRect(x, y - 1, 5, 2.5);
  } else if (badge === 'boss') {  // boss: red diamond
    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 3); ctx.lineTo(x + 5, y + 1); ctx.lineTo(x + 2, y + 5); ctx.lineTo(x - 1, y + 1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBody(e, x, bob) {
  const s = tileSize * (e.type === 'boss' ? 0.45 : (e.type === 'tank' ? 0.35 : (e.type === 'runner' ? 0.2 : 0.22)));
  const legPhase = Math.sin(e.animT);
  const legLen = s * 0.65;
  const slowColor = '#5bcefa';

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, bob + s * 0.7 + legLen, s * 0.5, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  const legColor = e.slowT > 0 ? slowColor : (e.type === 'boss' ? '#992233' : '#999');
  ctx.strokeStyle = legColor;
  ctx.lineWidth = e.type === 'tank' || e.type === 'boss' ? 3 : 2;
  ctx.lineCap = 'round';

  const lkx = x - s * 0.25 + legPhase * 2;
  const lky = bob + s * 0.3 + legLen * 0.5;
  const lfx = x - s * 0.3 + legPhase * 5;
  const lfy = bob + s * 0.3 + legLen;
  ctx.beginPath(); ctx.moveTo(x - s * 0.2, bob + s * 0.25); ctx.lineTo(lkx, lky); ctx.lineTo(lfx, lfy); ctx.stroke();
  const rkx = x + s * 0.25 - legPhase * 2;
  const rky = bob + s * 0.3 + legLen * 0.5;
  const rfx = x + s * 0.3 - legPhase * 5;
  const rfy = bob + s * 0.3 + legLen;
  ctx.beginPath(); ctx.moveTo(x + s * 0.2, bob + s * 0.25); ctx.lineTo(rkx, rky); ctx.lineTo(rfx, rfy); ctx.stroke();

  if (e.type === 'grunt') {
    const g = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.3, 0, x, bob, s);
    g.addColorStop(0, e.slowT > 0 ? '#8ae8ff' : '#e8e8e8');
    g.addColorStop(0.6, e.slowT > 0 ? slowColor : '#bbb');
    g.addColorStop(1, e.slowT > 0 ? '#2a8aaa' : '#777');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, bob, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.slowT > 0 ? '#2a8aaa' : '#666';
    ctx.lineWidth = 1.5; ctx.stroke();
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
    ctx.fillStyle = '#1D1D1D';
    ctx.beginPath(); ctx.arc(x, bob - s * 0.2, s * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(x + 1, bob - s * 0.2, s * 0.07, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'tank') {
    ctx.fillStyle = 'rgba(100,150,255,0.12)';
    drawHexagonSimple(ctx, x, bob, s * 1.25);
    ctx.strokeStyle = 'rgba(100,150,255,0.3)';
    ctx.lineWidth = 1;
    drawHexagonStroke(ctx, x, bob, s * 1.25);
    const g = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.2, 0, x, bob, s);
    g.addColorStop(0, e.slowT > 0 ? '#8ae8ff' : '#aaccee');
    g.addColorStop(0.7, e.slowT > 0 ? slowColor : '#6688aa');
    g.addColorStop(1, e.slowT > 0 ? '#2a8aaa' : '#334455');
    ctx.fillStyle = g;
    drawHexagonSimple(ctx, x, bob, s);
    ctx.strokeStyle = e.slowT > 0 ? '#2a8aaa' : '#445566';
    ctx.lineWidth = 2;
    drawHexagonStroke(ctx, x, bob, s);
    ctx.fillStyle = 'rgba(200,220,255,0.7)';
    ctx.fillRect(x - s * 0.4, bob - s * 0.15, s * 0.8, s * 0.2);
    ctx.fillStyle = '#1D1D1D';
    ctx.fillRect(x - s * 0.1, bob - s * 0.1, s * 0.06, s * 0.1);
    ctx.fillRect(x + s * 0.1, bob - s * 0.1, s * 0.06, s * 0.1);
  } else if (e.type === 'boss') {
    const aura = ctx.createRadialGradient(x, bob, s * 0.5, x, bob, s * 1.6);
    aura.addColorStop(0, 'rgba(230,57,70,0.25)');
    aura.addColorStop(0.6, 'rgba(230,57,70,0.08)');
    aura.addColorStop(1, 'rgba(230,57,70,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(x - s * 1.8, bob - s * 1.8, s * 3.6, s * 3.6);
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
    const bossGrad = ctx.createRadialGradient(x - s * 0.2, bob - s * 0.2, 0, x, bob, s);
    bossGrad.addColorStop(0, '#ff6b75');
    bossGrad.addColorStop(0.5, '#E63946');
    bossGrad.addColorStop(1, '#8b0000');
    ctx.fillStyle = bossGrad;
    ctx.beginPath(); ctx.arc(x, bob, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff8888';
    ctx.lineWidth = 2;
    ctx.stroke();
    const coreGrad = ctx.createRadialGradient(x, bob, 0, x, bob, s * 0.6);
    coreGrad.addColorStop(0, '#1D1D1D');
    coreGrad.addColorStop(0.7, '#1D1D1D');
    coreGrad.addColorStop(1, 'rgba(29,29,29,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(x, bob, s * 0.6, 0, Math.PI * 2); ctx.fill();
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
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * alpha;
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.type === 'arc') {
      const alpha = p.life / p.maxLife;
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
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 * alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2); ctx.stroke();
    } else if (p.shard) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * alpha;
      ctx.lineCap = 'round';
      const len = p.size * (0.5 + alpha * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(p.ang) * len, p.y - Math.sin(p.ang) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      const sz = p.size * (0.5 + alpha * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawExitFlash() {
  for (const f of exitFlash) {
    const a = f.t / 0.6;
    const r = tileSize * (0.6 + (1 - a) * 0.8);
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,60,60,${0.5 * a})`);
    g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawDamageNumbers() {
  ctx.textAlign = 'center';
  for (const d of damageNumbers) {
    const a = Math.min(1, d.life / d.maxLife * 1.5);
    ctx.globalAlpha = a;
    ctx.font = `bold ${d.size}px Outfit, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(d.text, d.x, d.y);
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, d.x, d.y);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
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
let goldFlashT = 0;
function flashGold() { goldFlashT = 0.4; hudGold.classList.add('flash'); setTimeout(() => hudGold.classList.remove('flash'), 350); }

function countBuildableSpots() {
  let n = 0;
  for (const key of buildableTiles) {
    if (towers.some(t => `${t.col},${t.row}` === key)) continue;
    n++;
  }
  return n;
}

function updateHUD() {
  hudWave.textContent = `${wave} / ${MAX_WAVE}`;
  hudLives.textContent = lives;
  hudGold.textContent = gold;
  if (hudSpots) hudSpots.textContent = countBuildableSpots();
  document.querySelectorAll('.tower-btn').forEach(btn => {
    const type = btn.dataset.tower;
    btn.classList.toggle('locked', gold < TOWER_DEFS[type].cost);
  });
  // Low-lives alarm vignette
  if (vignette) vignette.classList.toggle('active', isPlaying && lives <= LOW_LIVES && lives > 0);
}

// ─── GAME FLOW ───────────────────────────────
function gameOver() {
  isPlaying = false;
  goWave.textContent = wave;
  gameoverOverlay.classList.remove('hidden');
  if (vignette) vignette.classList.remove('active');
  Audio2.setAmbient(false, false);
  Audio2.defeat();
}

function victory() {
  isPlaying = false;
  victoryOverlay.classList.remove('hidden');
  if (vignette) vignette.classList.remove('active');
  Audio2.setAmbient(false, false);
  Audio2.victory();
}

function resetGame() {
  gold = START_GOLD; lives = START_LIVES; wave = 0;
  towers = []; enemies = []; projectiles = []; particles = []; damageNumbers = []; exitFlash = [];
  selectedTowerType = null; selectedTower = null; hoverTower = null;
  isWaveActive = false;
  pauseReasons.clear(); isPaused = false;
  pendingSpots = null; groundShiftPending = false;
  killStreak = 0; streakTimer = 0; shakeT = 0; pathRotator = 0;
  towerAction.classList.add('hidden');
  loadMap(0);
  buildableTiles = generateBuildSpots(1);
  Audio2.setAmbient(true, false);
  updateHUD();
}

function submitScore(finalWave) {
  window.parent.postMessage({ type: 'GAME_OVER', score: finalWave, metadata: { lives, gold } }, '*');
  setTimeout(() => { window.parent.postMessage({ type: 'GAME_EXIT' }, '*'); }, 400);
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

function denyFeedback(msg) {
  flashGold();
  showNotification(`✋ ${msg}`);
  Audio2.deny();
}

// ─── PAUSE MANAGEMENT (reasons set) ──────────
function setPause(reason, on) {
  if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
  isPaused = pauseReasons.size > 0;
  Audio2.onPause(isPaused);
}

// ─── INPUT (pointer events = mouse + touch) ──
canvas.style.touchAction = 'none';

canvas.addEventListener('pointermove', (e) => {
  const { col, row } = screenToGrid(e.clientX, e.clientY);
  mouseCol = col; mouseRow = row;
  hoverTower = towers.find(t => t.col === col && t.row === row) || null;
});

canvas.addEventListener('pointerleave', () => { mouseCol = -1; mouseRow = -1; hoverTower = null; });

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button === 2) return; // contextmenu handles right-click
  e.preventDefault();
  if (!isPlaying || isPaused) return;
  const { col, row } = screenToGrid(e.clientX, e.clientY);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  const existing = towers.find(t => t.col === col && t.row === row);
  if (existing) { selectExistingTower(existing, e.clientX, e.clientY); return; }

  if (selectedTowerType) {
    const key = `${col},${row}`;
    if (currentMap.grid[row][col] === 0 && buildableTiles.has(key)
      && !towers.some(t => t.col === col && t.row === row)) {
      placeTower(col, row, selectedTowerType);
    } else if (currentMap.grid[row][col] === 0 && !buildableTiles.has(key)) {
      denyFeedback('Tile not buildable');
    }
    return;
  }

  selectedTower = null;
  towerAction.classList.add('hidden');
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  cancelSelection();
});

function cancelSelection() {
  selectedTowerType = null;
  selectedTower = null;
  towerAction.classList.add('hidden');
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
}

function selectExistingTower(tower, screenX, screenY) {
  selectedTower = tower;
  selectedTowerType = null;
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));

  const def = TOWER_DEFS[tower.type];
  taName.textContent = `${def.name} Lv${tower.level}`;
  taStats.textContent = `DMG: ${Math.floor(getTowerDamage(tower))} | RNG: ${def.range}`;
  if (taTargetMode) taTargetMode.textContent = TARGET_LABELS[tower.targeting];

  if (tower.level >= 3) { btnUpgrade.disabled = true; taUpgradeCost.textContent = 'MAX'; }
  else {
    const cost = Math.ceil(def.cost * 0.6);
    btnUpgrade.disabled = gold < cost;
    taUpgradeCost.textContent = cost;
  }
  taSellValue.textContent = Math.floor(tower.totalInvested * 0.6);

  towerAction.style.left = Math.min(screenX + 10, window.innerWidth - 210) + 'px';
  towerAction.style.top = Math.min(screenY + 10, window.innerHeight - 150) + 'px';
  towerAction.classList.remove('hidden');
}

// Tower bar buttons
document.querySelectorAll('.tower-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.tower;
    if (gold < TOWER_DEFS[type].cost) { denyFeedback('Not enough gold'); return; }
    selectedTower = null;
    towerAction.classList.add('hidden');

    if (selectedTowerType === type) { selectedTowerType = null; btn.classList.remove('active'); }
    else {
      selectedTowerType = type;
      document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
});

// Upgrade
btnUpgrade.addEventListener('click', () => {
  if (!selectedTower) return;
  upgradeTower(selectedTower);
  selectExistingTower(selectedTower, parseInt(towerAction.style.left), parseInt(towerAction.style.top));
});

// Sell (with confirmation for upgraded towers)
btnSell.addEventListener('click', () => {
  if (!selectedTower) return;
  if (selectedTower.level > 1) {
    const refund = Math.floor(selectedTower.totalInvested * 0.6);
    sellConfirmText.textContent = `Sell ${TOWER_DEFS[selectedTower.type].name} Lv${selectedTower.level} for ${refund}g?`;
    sellConfirm.classList.remove('hidden');
  } else {
    sellTower(selectedTower);
    selectedTower = null;
    towerAction.classList.add('hidden');
  }
});
btnSellYes.addEventListener('click', () => {
  if (selectedTower) sellTower(selectedTower);
  selectedTower = null;
  towerAction.classList.add('hidden');
  sellConfirm.classList.add('hidden');
});
btnSellNo.addEventListener('click', () => sellConfirm.classList.add('hidden'));

// Targeting-mode cycle
if (btnTarget) btnTarget.addEventListener('click', () => {
  if (!selectedTower) return;
  const i = TARGET_MODES.indexOf(selectedTower.targeting);
  selectedTower.targeting = TARGET_MODES[(i + 1) % TARGET_MODES.length];
  taTargetMode.textContent = TARGET_LABELS[selectedTower.targeting];
});

// Next wave
btnNextWave.addEventListener('click', () => {
  if (!isPlaying || isPaused) return;
  if (!isWaveActive) startWave();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && isPlaying && !isPaused && !isWaveActive) { e.preventDefault(); startWave(); }
  if (e.code === 'Escape') cancelSelection();
  if (e.key === 'f' || e.key === 'F') cycleSpeed();
  if (e.key === 'm' || e.key === 'M') toggleMute();
});

// Speed toggle
function cycleSpeed() {
  const i = SPEED_LEVELS.indexOf(gameSpeed);
  gameSpeed = SPEED_LEVELS[(i + 1) % SPEED_LEVELS.length];
  storageSet(LS_SPEED, gameSpeed);
  if (btnSpeed) btnSpeed.textContent = `${gameSpeed}×`;
}
if (btnSpeed) btnSpeed.addEventListener('click', cycleSpeed);

// Mute toggle
function toggleMute() {
  const m = Audio2.toggleMute();
  if (btnMute) btnMute.textContent = m ? '🔇' : '🔊';
}
if (btnMute) btnMute.addEventListener('click', toggleMute);

// Help
btnHelp.addEventListener('click', () => { setPause('help', true); helpModal.classList.remove('hidden'); });
btnHelpClose.addEventListener('click', () => { setPause('help', false); helpModal.classList.add('hidden'); });

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

// Game over / victory buttons
document.getElementById('btn-go-submit').addEventListener('click', () => submitScore(wave));
document.getElementById('btn-go-retry').addEventListener('click', () => {
  gameoverOverlay.classList.add('hidden');
  isPlaying = true; resetGame(); showMapSplash();
});
document.getElementById('btn-vic-submit').addEventListener('click', () => submitScore(wave));
document.getElementById('btn-vic-retry').addEventListener('click', () => {
  victoryOverlay.classList.add('hidden');
  isPlaying = true; resetGame(); showMapSplash();
});

// ─── HUB MESSAGES ────────────────────────────
window.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'PAUSE') setPause('hub', true);
  else if (type === 'RESUME') setPause('hub', false);
});

// ─── VISIBILITY / FOCUS PAUSE ────────────────
document.addEventListener('visibilitychange', () => setPause('visibility', document.hidden));
window.addEventListener('blur', () => setPause('visibility', true));
window.addEventListener('focus', () => setPause('visibility', false));

// ─── FIRST-GESTURE AUDIO UNLOCK ──────────────
function unlockAudio() {
  Audio2.init();
  Audio2.resume();
  if (btnMute) btnMute.textContent = Audio2.isMuted() ? '🔇' : '🔊';
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// ─── GAME LOOP ───────────────────────────────
function stepSimulation(dt) {
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEnemy(spawnQueue.shift()); spawnTimer = 0.6; }
  }
  if (isWaveActive && spawnQueue.length === 0 && enemies.filter(e => !e.dead).length === 0) {
    onWaveComplete();
  }
  updateEnemies(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateDamageNumbers(dt);

  // streak timeout
  if (streakTimer > 0) { streakTimer -= dt; if (streakTimer <= 0) killStreak = 0; }
  // decay shake & exit flashes
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  for (let i = exitFlash.length - 1; i >= 0; i--) { exitFlash[i].t -= dt; if (exitFlash[i].t <= 0) exitFlash.splice(i, 1); }
}

function gameLoop(timestamp) {
  if (!isPlaying) return;
  const rawDt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  animFrame += rawDt;

  if (!isPaused) {
    // Apply speed multiplier via fixed sub-steps for stability.
    const simDt = rawDt * gameSpeed;
    const steps = Math.max(1, Math.ceil(simDt / 0.034));
    const sub = simDt / steps;
    for (let i = 0; i < steps && isPlaying; i++) stepSimulation(sub);
    updateHUD();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ─── INIT ────────────────────────────────────
gameSpeed = SPEED_LEVELS.includes(parseInt(storageGet(LS_SPEED, '1'))) ? parseInt(storageGet(LS_SPEED, '1')) : 1;
if (btnSpeed) btnSpeed.textContent = `${gameSpeed}×`;
if (btnMute) btnMute.textContent = (storageGet(LS_MUTE, '0') === '1') ? '🔇' : '🔊';
loadMap(0);
buildableTiles = generateBuildSpots(1);
updateHUD();
window.parent.postMessage({ type: 'GAME_READY' }, '*');
