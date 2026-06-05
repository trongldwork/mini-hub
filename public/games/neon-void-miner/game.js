// ============================================
// Neon Void Miner — game.js
// SDK: GAME_READY → PAUSE/RESUME → GAME_OVER
// ============================================

// --- URL Params ---
const urlParams  = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';

// --- DOM ---
const dmDisplay      = document.getElementById('dm-display');
const gpsDisplay     = document.getElementById('gps-display');
const playerNameEl   = document.getElementById('player-name');
const singularity    = document.getElementById('singularity');
const clickPowerEl   = document.getElementById('click-power');
const upgradesList   = document.getElementById('upgrades-list');
const retireModal    = document.getElementById('retire-modal');
const modalDmValue   = document.getElementById('modal-dm-value');
const btnRetire      = document.getElementById('btn-retire');
const btnRetireConfirm = document.getElementById('btn-retire-confirm');
const btnRetireCancel  = document.getElementById('btn-retire-cancel');

// --- Game State ---
let darkMatter   = 0;  // total accumulated (also used as score)
let gps          = 0;  // generation per second
let clickPower   = 1;  // DM per click
let isPaused     = false;
let isRetired    = false;
let lastTick     = null;
let rafId        = null;

// --- Upgrade Definitions ---
// cost grows by costMult each purchase; gpsAdd per second added
const UPGRADES = [
  {
    id:      'drone',
    icon:    '🤖',
    name:    'Mining Drone',
    desc:    'A small autonomous drone that extracts DM.',
    gpsAdd:  0.1,
    baseCost: 10,
    costMult: 1.15,
    count:   0,
    cost:    10,
  },
  {
    id:      'drill',
    icon:    '⚡',
    name:    'Plasma Drill',
    desc:    'High-powered beam that penetrates void layers.',
    gpsAdd:  0.5,
    baseCost: 75,
    costMult: 1.15,
    count:   0,
    cost:    75,
  },
  {
    id:      'well',
    icon:    '🌀',
    name:    'Gravity Well',
    desc:    'Bends spacetime to funnel Dark Matter passively.',
    gpsAdd:  3,
    baseCost: 500,
    costMult: 1.15,
    count:   0,
    cost:    500,
  },
  {
    id:      'reactor',
    icon:    '☢️',
    name:    'Void Reactor',
    desc:    'Quantum fission of singularities at scale.',
    gpsAdd:  20,
    baseCost: 3000,
    costMult: 1.15,
    count:   0,
    cost:    3000,
  },
  {
    id:      'beacon',
    icon:    '📡',
    name:    'Dark Signal Beacon',
    desc:    'Broadcasts coordinates to autonomous mining fleets.',
    gpsAdd:  100,
    baseCost: 20000,
    costMult: 1.15,
    count:   0,
    cost:    20000,
  },
  {
    id:      'click-amp',
    icon:    '👆',
    name:    'Click Amplifier',
    desc:    'Doubles the DM gained per click.',
    gpsAdd:  0,
    baseCost: 50,
    costMult: 2,
    count:   0,
    cost:    50,
    isClickUpgrade: true,
  },
];

// --- Helpers ---
function formatDM(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + ' M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + ' K';
  return Math.floor(n).toString();
}

// GPS needs to show decimals (e.g. 0.1 not 0)
function formatGPS(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + ' M';
  if (n >= 1e3)  return (n / 1e3).toFixed(2)  + ' K';
  if (n >= 100)  return Math.floor(n).toString();
  return parseFloat(n.toFixed(1)).toString(); // shows 0.1, 1.5, 12.3 etc.
}

// --- Render ---
function updateHUD() {
  dmDisplay.textContent    = formatDM(darkMatter);
  gpsDisplay.textContent   = formatGPS(gps) + '/s';
  clickPowerEl.textContent = formatDM(clickPower);
}

// Create card DOM elements once — never destroys them (prevents missed clicks)
function renderUpgrades() {
  upgradesList.innerHTML = '';
  UPGRADES.forEach((upg, idx) => {
    const card = document.createElement('div');
    card.className = 'upgrade-card locked';
    card.id = 'upgrade-' + upg.id;

    const staticGPS = upg.isClickUpgrade ? '' : `+${upg.gpsAdd}/s each`;

    card.innerHTML = `
      <div class="upgrade-icon">${upg.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${upg.name}</div>
        <div class="upgrade-desc">${upg.desc}</div>
        <div class="upgrade-gps" data-id="gps-${upg.id}">${staticGPS}</div>
      </div>
      <div class="upgrade-right">
        <div class="upgrade-count" data-id="count-${upg.id}">0</div>
        <div class="upgrade-cost" data-id="cost-${upg.id}">⚛ ${formatDM(upg.cost)}</div>
      </div>
    `;

    card.addEventListener('click', () => buyUpgrade(idx));
    upgradesList.appendChild(card);
  });
  refreshUpgradeStates();
}

// Update only classes + dynamic text — no DOM recreation, so clicks always register
function refreshUpgradeStates() {
  UPGRADES.forEach((upg) => {
    const card = document.getElementById('upgrade-' + upg.id);
    if (!card) return;

    const canAfford = darkMatter >= upg.cost;
    card.className = 'upgrade-card' + (canAfford ? ' can-afford' : ' locked');

    card.querySelector(`[data-id="count-${upg.id}"]`).textContent = upg.count;
    card.querySelector(`[data-id="cost-${upg.id}"]`).textContent = '⚛ ' + formatDM(upg.cost);

    if (upg.isClickUpgrade) {
      card.querySelector(`[data-id="gps-${upg.id}"]`).textContent =
        `+${formatDM(clickPower)} DM/click (×2)`;
    }
  });
}

// --- Upgrade Purchase ---
function buyUpgrade(idx) {
  if (isRetired || isPaused) return;
  const upg = UPGRADES[idx];
  if (darkMatter < upg.cost) return;

  darkMatter -= upg.cost;
  upg.count++;
  upg.cost = Math.ceil(upg.baseCost * Math.pow(upg.costMult, upg.count));

  if (upg.isClickUpgrade) {
    clickPower *= 2;
  } else {
    gps += upg.gpsAdd;
  }

  updateHUD();
  refreshUpgradeStates(); // update existing cards, no DOM reset
}

// --- Click Mechanic & Floating Text ---
function spawnFloatText(x, y, amount) {
  const el = document.createElement('span');
  el.className = 'float-text';
  el.textContent = '+' + formatDM(amount);
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

singularity.addEventListener('click', () => {
  if (isPaused || isRetired) return;
  darkMatter += clickPower;

  // Spawn floating text near cursor
  const rect = singularity.getBoundingClientRect();
  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 60;
  const y = rect.top  + rect.height / 2 + (Math.random() - 0.5) * 30;
  spawnFloatText(x, y, clickPower);

  updateHUD();
  // NOTE: do NOT call renderUpgrades() here — the affordability
  // ticker (setInterval below) handles this at a safe 500ms cadence.
});

// --- Passive Generation Loop ---
// RAF only handles DM accumulation + HUD text updates.
// renderUpgrades() is deliberately NOT called here to avoid destroying
// card DOM elements 60x/sec, which blocks click events on the cards.
function gameLoop(timestamp) {
  if (!isPaused && !isRetired) {
    if (lastTick === null) lastTick = timestamp;
    const delta = (timestamp - lastTick) / 1000;
    lastTick = timestamp;

    if (gps > 0) {
      darkMatter += gps * delta;
      updateHUD();
    }
  } else {
    lastTick = timestamp;
  }
  rafId = requestAnimationFrame(gameLoop);
}

// Refresh affordability every 500ms — updates classes/text only, never destroys cards
setInterval(() => {
  if (!isRetired) refreshUpgradeStates();
}, 500);

// --- Retire Modal ---
btnRetire.addEventListener('click', () => {
  if (isRetired) return;
  modalDmValue.textContent = formatDM(darkMatter);
  retireModal.classList.remove('hidden');
});

document.getElementById('btn-retire-cancel').addEventListener('click', () => {
  retireModal.classList.add('hidden');
});

// Submit score and let Hub navigate away
btnRetireConfirm.addEventListener('click', () => {
  if (isRetired) return;
  isRetired = true;
  retireModal.classList.add('hidden');
  cancelAnimationFrame(rafId);

  // Submit score
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: Math.floor(darkMatter),
    metadata: {
      gps:        parseFloat(gps.toFixed(2)),
      clickPower: clickPower,
    }
  }, '*');

  // Give Hub ~400ms to process the score, then navigate to home
  setTimeout(() => {
    window.parent.postMessage({ type: 'GAME_EXIT' }, '*');
  }, 400);
});

// Reset all state and start a fresh run
document.getElementById('btn-retire-reset').addEventListener('click', () => {
  retireModal.classList.add('hidden');
  resetGame();
});

function resetGame() {
  darkMatter = 0;
  gps        = 0;
  clickPower = 1;
  isPaused   = false;
  isRetired  = false;
  lastTick   = null;

  UPGRADES.forEach(upg => {
    upg.count = 0;
    upg.cost  = upg.baseCost;
  });

  updateHUD();
  renderUpgrades();

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(gameLoop);
}

// --- Hub Message Listener (PAUSE / RESUME) ---
window.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'PAUSE') {
    isPaused = true;
  } else if (type === 'RESUME') {
    isPaused = false;
    lastTick = null; // reset so no DM burst
  }
});

// --- Init ---
function init() {
  playerNameEl.textContent = playerName;
  renderUpgrades();
  updateHUD();
  rafId = requestAnimationFrame(gameLoop);

  // Signal Hub we are ready
  window.parent.postMessage({ type: 'GAME_READY' }, '*');
}

init();
