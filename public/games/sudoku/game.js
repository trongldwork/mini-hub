// game.js

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
const theme = urlParams.get('theme') || 'dark';

// DOM Elements
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const playerNameEl = document.getElementById('player-name');
const timeDisplay = document.getElementById('time-display');
const boardEl = document.getElementById('sudoku-board');
const btnCheck = document.getElementById('btn-check');
const btnHint = document.getElementById('btn-hint');

// State
let solutionBoard = [];
let puzzleBoard = [];
let playerBoard = [];
let givenCells = [];
let selectedCellIndex = null;
let hintsUsed = 0;
let timeElapsed = 0; // seconds
let timerInterval = null;
let isGameOver = false;

// Config
const DIFFICULTY_LEVELS = {
  easy: 36,
  medium: 30,
  hard: 24
};

// Initialization
function init() {
  playerNameEl.textContent = playerName;

  // Add click listeners to difficulty buttons
  document.querySelectorAll('.difficulty-buttons button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const difficulty = e.target.getAttribute('data-difficulty');
      startGame(difficulty);
    });
  });

  // Controls
  btnCheck.addEventListener('click', checkBoard);
  btnHint.addEventListener('click', useHint);

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') {
      handleNumberInput(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      handleNumberInput(0);
    }
  });

  // Listen to Hub
  window.addEventListener('message', (event) => {
    const { type } = event.data;
    if (type === 'PAUSE') {
      clearInterval(timerInterval);
    } else if (type === 'RESUME' && !isGameOver && !startOverlay.classList.contains('active')) {
      startTimer();
    }
  });

  // Tell Hub we are ready to show the UI (Difficulty Selector)
  window.parent.postMessage({ type: 'GAME_READY' }, '*');
}

function startGame(difficulty) {
  startOverlay.classList.remove('active');
  startOverlay.classList.add('hidden');
  const targetCells = DIFFICULTY_LEVELS[difficulty] || 36;

  generatePuzzle(targetCells);
  renderBoard();

  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeElapsed++;
    updateTimeDisplay();
  }, 1000);
}

function updateTimeDisplay() {
  const m = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
  const s = (timeElapsed % 60).toString().padStart(2, '0');
  timeDisplay.textContent = `${m}:${s}`;
}

// --- Sudoku Generation ---
function generatePuzzle(targetCells) {
  // Create empty 9x9
  solutionBoard = Array(9).fill().map(() => Array(9).fill(0));

  // Fill diagonal 3x3 boxes first for randomness
  for (let i = 0; i < 9; i += 3) {
    fillBox(i, i);
  }

  // Solve the rest to get a complete board
  solveSudoku(solutionBoard);

  // Copy to puzzle and player boards
  puzzleBoard = solutionBoard.map(row => [...row]);

  // Remove cells
  let cellsToRemove = 81 - targetCells;
  while (cellsToRemove > 0) {
    let r = Math.floor(Math.random() * 9);
    let c = Math.random() * 9 | 0;
    if (puzzleBoard[r][c] !== 0) {
      puzzleBoard[r][c] = 0;
      cellsToRemove--;
    }
  }

  playerBoard = puzzleBoard.map(row => [...row]);

  givenCells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzleBoard[r][c] !== 0) {
        givenCells.push(r * 9 + c);
      }
    }
  }
}

function fillBox(rowStart, colStart) {
  let num;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      do {
        num = Math.floor(Math.random() * 9) + 1;
      } while (!isSafeInBox(rowStart, colStart, num));
      solutionBoard[rowStart + i][colStart + j] = num;
    }
  }
}

function isSafeInBox(rowStart, colStart, num) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (solutionBoard[rowStart + i][colStart + j] === num) return false;
    }
  }
  return true;
}

function isSafe(board, row, col, num) {
  for (let x = 0; x <= 8; x++) {
    if (board[row][x] === num) return false;
    if (board[x][col] === num) return false;
  }
  let startRow = row - row % 3, startCol = col - col % 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
}

function solveSudoku(board) {
  let emptyCell = findEmpty(board);
  if (!emptyCell) return true;
  let [row, col] = emptyCell;

  for (let num = 1; num <= 9; num++) {
    if (isSafe(board, row, col, num)) {
      board[row][col] = num;
      if (solveSudoku(board)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

function findEmpty(board) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j] === 0) return [i, j];
    }
  }
  return null;
}

// --- UI Interaction ---
function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;

    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;

    if (givenCells.includes(i)) {
      cell.classList.add('prefilled');
      cell.textContent = playerBoard[r][c];
    } else {
      if (playerBoard[r][c] !== 0) {
        cell.textContent = playerBoard[r][c];
      }
      cell.addEventListener('click', () => selectCell(i));
    }

    boardEl.appendChild(cell);
  }
}

function selectCell(index) {
  if (givenCells.includes(index) || isGameOver) return;
  selectedCellIndex = index;

  document.querySelectorAll('.cell').forEach(c => c.classList.remove('selected'));
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  if (cell) cell.classList.add('selected');
}

function handleNumberInput(val) {
  if (selectedCellIndex === null || isGameOver) return;

  const r = Math.floor(selectedCellIndex / 9);
  const c = selectedCellIndex % 9;

  playerBoard[r][c] = val;

  const cell = document.querySelector(`.cell[data-index="${selectedCellIndex}"]`);
  if (val === 0) {
    cell.textContent = '';
  } else {
    cell.textContent = val;
  }

  cell.classList.remove('error');
  checkWinCondition();
}

function checkBoard() {
  if (isGameOver) return;
  for (let i = 0; i < 81; i++) {
    if (givenCells.includes(i)) continue;

    const r = Math.floor(i / 9);
    const c = i % 9;
    const val = playerBoard[r][c];

    if (val !== 0 && val !== solutionBoard[r][c]) {
      const cell = document.querySelector(`.cell[data-index="${i}"]`);
      cell.classList.remove('error');
      void cell.offsetWidth;
      cell.classList.add('error');
    }
  }
}

function useHint() {
  if (isGameOver) return;

  let emptyIndices = [];
  for (let i = 0; i < 81; i++) {
    if (givenCells.includes(i)) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    if (playerBoard[r][c] === 0 || playerBoard[r][c] !== solutionBoard[r][c]) {
      emptyIndices.push(i);
    }
  }

  if (emptyIndices.length === 0) return;

  hintsUsed++;
  const penalty = 30;
  timeElapsed += penalty; // Add penalty to timer immediately
  updateTimeDisplay();

  const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  const r = Math.floor(randomIdx / 9);
  const c = randomIdx % 9;

  const correctVal = solutionBoard[r][c];
  playerBoard[r][c] = correctVal;

  givenCells.push(randomIdx);

  const cell = document.querySelector(`.cell[data-index="${randomIdx}"]`);
  cell.textContent = correctVal;
  cell.classList.add('prefilled');
  cell.classList.remove('selected', 'error');
  if (selectedCellIndex === randomIdx) {
    selectedCellIndex = null;
  }

  checkWinCondition();
}

function checkWinCondition() {
  let isWin = true;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (playerBoard[r][c] !== solutionBoard[r][c]) {
        isWin = false;
        break;
      }
    }
    if (!isWin) break;
  }

  if (isWin) {
    handleGameOver();
  }
}

function handleGameOver() {
  isGameOver = true;
  clearInterval(timerInterval);

  const penaltyTotal = hintsUsed * 30;
  const finalScore = timeElapsed; // penalty already added during hints
  const rawTime = timeElapsed - penaltyTotal;

  document.getElementById('final-time').textContent = timeDisplay.textContent;
  document.getElementById('final-hints').textContent = hintsUsed;
  document.getElementById('final-penalty').textContent = penaltyTotal;
  document.getElementById('final-score').textContent = finalScore;
  gameOverOverlay.classList.remove('hidden');

  window.parent.postMessage({
    type: 'GAME_OVER',
    score: finalScore,
    metadata: {
      hintsUsed: hintsUsed,
      rawTime: rawTime
    }
  }, '*');
}

init();
