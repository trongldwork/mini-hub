// Read parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
document.getElementById('player-name').innerText = playerName;

// Game constants
const ROWS = 25;
const COLS = 30;
const MINES = 136;

// Game state variables
let board = [];
let minesSet = false;
let gameOverState = false;
let gameStarted = false;
let timeElapsed = 0;
let timerInterval = null;
let timerPaused = false;
let flagModeActive = false; // Toggle between 'dig' and 'flag' for easy touch interaction

// Elements
const boardEl = document.getElementById('board');
const timerEl = document.getElementById('timer');
const minesCountEl = document.getElementById('mines-count');
const statusBannerEl = document.getElementById('game-status');
const btnFlagMode = document.getElementById('btn-flag-mode');
const btnRestart = document.getElementById('btn-restart');

// Send GAME_READY to Hub
window.addEventListener('load', () => {
  window.parent.postMessage({ type: 'GAME_READY' }, '*');
});

// Setup Control message listeners from Hub Shell
window.addEventListener('message', (event) => {
  const { type } = event.data;
  if (type === 'PAUSE') {
    timerPaused = true;
  } else if (type === 'RESUME') {
    timerPaused = false;
  }
});

// Toggle flag mode (especially useful on mobile touch screens)
btnFlagMode.addEventListener('click', () => {
  flagModeActive = !flagModeActive;
  btnFlagMode.innerText = flagModeActive ? 'Mode: 🚩 Flag' : 'Mode: ⛏️ Dig';
  btnFlagMode.classList.toggle('flag-active', flagModeActive);
});

btnRestart.addEventListener('click', () => {
  window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
  initGame();
});

// Initialize game
function initGame() {
  // Clear any existing timer
  clearInterval(timerInterval);
  timerInterval = null;
  timeElapsed = 0;
  timerEl.innerText = '0s';
  minesCountEl.innerText = MINES;
  statusBannerEl.innerText = '';
  statusBannerEl.className = 'status-banner';
  minesSet = false;
  gameOverState = false;
  gameStarted = false;
  timerPaused = false;

  // Clear board DOM
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateRows = `repeat(${ROWS}, 24px)`;
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 24px)`;
  board = [];

  // Generate board grid state
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      // Create DOM element
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell');
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;
      boardEl.appendChild(cellEl);

      // Event listener for tap/click
      cellEl.addEventListener('click', (e) => handleCellClick(r, c));

      // Event listener for right-click (flagging)
      cellEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      row.push({
        r,
        c,
        isMine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0,
        element: cellEl
      });
    }
    board.push(row);
  }
}

// Start game timer
function startTimer() {
  timerInterval = setInterval(() => {
    if (!timerPaused && !gameOverState) {
      timeElapsed++;
      timerEl.innerText = `${timeElapsed}s`;
    }
  }, 1000);
}

// Generate mines avoiding the first clicked cell
function layMines(firstRow, firstCol) {
  let minesLaid = 0;
  while (minesLaid < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);

    // Don't place mine on first clicked cell or its immediate neighbors
    const isTooClose = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;

    if (!board[r][c].isMine && !isTooClose) {
      board[r][c].isMine = true;
      minesLaid++;
    }
  }

  // Calculate neighbor mine numbers
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (board[nr][nc].isMine) count++;
          }
        }
      }
      board[r][c].neighborMines = count;
    }
  }

  minesSet = true;
}

// Handle clicking a cell
function handleCellClick(r, c) {
  if (gameOverState) return;

  const cell = board[r][c];
  if (cell.revealed) return;

  // If flag mode is active, toggle flag instead of digging
  if (flagModeActive) {
    toggleFlag(r, c);
    return;
  }

  if (cell.flagged) return;

  if (!gameStarted) {
    gameStarted = true;
    layMines(r, c);
    startTimer();
  }

  revealCell(r, c);
}

// Reveal a cell recursively
function revealCell(r, c) {
  const cell = board[r][c];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  cell.element.classList.add('revealed');

  if (cell.isMine) {
    triggerLoss(r, c);
    return;
  }

  if (cell.neighborMines > 0) {
    cell.element.innerText = cell.neighborMines;
    cell.element.classList.add(`cell-${cell.neighborMines}`);
  } else {
    // Reveal neighbors for 0-neighbor cell
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          revealCell(nr, nc);
        }
      }
    }
  }

  checkWinCondition();
}

// Toggle flag
function toggleFlag(r, c) {
  if (gameOverState) return;
  const cell = board[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  cell.element.classList.toggle('flagged', cell.flagged);
  cell.element.innerText = cell.flagged ? '🚩' : '';

  // Calculate flags left
  const flaggedCount = board.flat().filter(c => c.flagged).length;
  minesCountEl.innerText = Math.max(0, MINES - flaggedCount);
}

// Win validation
function checkWinCondition() {
  // If all non-mine cells are revealed, player wins!
  const allSafeCellsRevealed = board.flat().every(c => c.isMine || c.revealed);
  if (allSafeCellsRevealed) {
    triggerWin();
  }
}

function triggerWin() {
  gameOverState = true;
  clearInterval(timerInterval);
  statusBannerEl.innerText = 'Victory!';
  statusBannerEl.classList.add('win');

  // Flag all remaining mines
  board.flat().forEach(c => {
    if (c.isMine && !c.flagged) {
      c.flagged = true;
      c.element.classList.add('flagged');
      c.element.innerText = '🚩';
    }
  });

  // Post scores to parent shell
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: timeElapsed,
    metadata: {
      gridSize: '30x30',
      mines: MINES,
      durationSeconds: timeElapsed
    }
  }, '*');
}

function triggerLoss(hitR, hitC) {
  gameOverState = true;
  clearInterval(timerInterval);
  statusBannerEl.innerText = 'Boom! Defeat.';
  statusBannerEl.classList.add('lose');

  // Reveal all mines
  board.flat().forEach(c => {
    if (c.isMine) {
      c.element.classList.add('mine');
      c.element.innerText = '💣';
      if (c.r === hitR && c.c === hitC) {
        c.element.style.backgroundColor = '#FF0000';
      }
    } else if (c.flagged) {
      // Wrong flag
      c.element.innerText = '❌';
      c.element.style.color = '#FF0000';
    }
  });
}

// Init game on load
initGame();

// Auto-resize iframe frame according to game height
function sendResize() {
  const wrapper = document.querySelector('.game-container');
  if (wrapper) {
    window.parent.postMessage({
      type: 'GAME_RESIZE',
      height: wrapper.offsetHeight + 10
    }, '*');
  }
}
window.addEventListener('load', sendResize);
window.addEventListener('resize', sendResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(sendResize).observe(document.body);
}
