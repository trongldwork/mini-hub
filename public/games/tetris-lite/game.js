// Read parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
document.getElementById('player-name').innerText = playerName;

// Canvas setup
const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const BLOCK_SIZE = 24;
const COLS = 10;
const ROWS = 20;

// Game stats
let score = 0;
let lines = 0;
let level = 1;
let gameOverState = false;
let gameActive = false;
let gamePaused = false;

// Board representation (0 = empty, string = color hex)
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

// Tetromino pieces
const SHAPES = {
  'I': { matrix: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], color: '#00f0f0' },
  'O': { matrix: [[1,1], [1,1]], color: '#f0f000' },
  'T': { matrix: [[0,1,0], [1,1,1], [0,0,0]], color: '#a000f0' },
  'S': { matrix: [[0,1,1], [1,1,0], [0,0,0]], color: '#00f000' },
  'Z': { matrix: [[1,1,0], [0,1,1], [0,0,0]], color: '#f00000' },
  'J': { matrix: [[1,0,0], [1,1,1], [0,0,0]], color: '#0000f0' },
  'L': { matrix: [[0,0,1], [1,1,1], [0,0,0]], color: '#f0a000' }
};

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
let pieceBag = [];

// Current piece and next piece
let currentPiece = null;
let nextPiece = null;

// Timer and tick speed
let dropCounter = 0;
let lastTime = 0;

// Get dynamic drop interval based on level
function getDropInterval() {
  return Math.max(50, 1000 - (level - 1) * 90);
}

// Sound effects simulation or UI overlays
const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const gameSubtitle = document.getElementById('game-subtitle');
const scoreDisplay = document.getElementById('score-display');
const finalScore = document.getElementById('final-score');
const btnAction = document.getElementById('btn-action');

const scoreValEl = document.getElementById('score-val');
const levelValEl = document.getElementById('level-val');
const linesValEl = document.getElementById('lines-val');

// Send GAME_READY to Hub Shell
window.addEventListener('load', () => {
  window.parent.postMessage({ type: 'GAME_READY' }, '*');
});

// Control commands from Hub Shell
window.addEventListener('message', (event) => {
  const { type } = event.data;
  if (type === 'PAUSE') {
    gamePaused = true;
  } else if (type === 'RESUME') {
    gamePaused = false;
    // Resume loop
    requestAnimationFrame(updateLoop);
  }
});

// Generate next piece using standard 7-bag randomizer
function getRandomPiece() {
  if (pieceBag.length === 0) {
    pieceBag = [...PIECE_TYPES];
    // Shuffle
    for (let i = pieceBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
    }
  }
  const type = pieceBag.pop();
  const shape = SHAPES[type];
  return {
    matrix: JSON.parse(JSON.stringify(shape.matrix)),
    color: shape.color,
    x: Math.floor((COLS - shape.matrix[0].length) / 2),
    y: 0,
    type: type
  };
}

// Reset board and start new game
function startGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  lines = 0;
  level = 1;
  gameOverState = false;
  gameActive = true;
  gamePaused = false;
  pieceBag = [];

  currentPiece = getRandomPiece();
  nextPiece = getRandomPiece();

  updateStatsDisplay();
  drawNextPiece();
  
  overlay.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(updateLoop);
}

// Stats UI updates
function updateStatsDisplay() {
  scoreValEl.innerText = score;
  levelValEl.innerText = level;
  linesValEl.innerText = lines;
}

// Update game loops
function updateLoop(time = 0) {
  if (!gameActive || gamePaused) return;

  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > getDropInterval()) {
    moveDown();
  }

  draw();

  if (!gameOverState) {
    requestAnimationFrame(updateLoop);
  } else {
    handleGameOver();
  }
}

// Check collision
function collide(offsetX, offsetY, matrix = currentPiece.matrix) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] !== 0) {
        const boardX = currentPiece.x + c + offsetX;
        const boardY = currentPiece.y + r + offsetY;

        // Check walls and floor
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }

        // Check existing pieces on board
        if (boardY >= 0 && board[boardY][boardX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// Lock current piece into board
function mergePiece() {
  currentPiece.matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) {
        const boardY = currentPiece.y + r;
        const boardX = currentPiece.x + c;
        if (boardY >= 0) {
          board[boardY][boardX] = currentPiece.color;
        }
      }
    });
  });
}

// Rotate matrix clockwise
function rotateMatrix(matrix) {
  const n = matrix.length;
  const rotated = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = matrix[r][c];
    }
  }
  return rotated;
}

// Handle Rotate action
function rotate() {
  if (!gameActive || gamePaused || gameOverState) return;
  const prevMatrix = currentPiece.matrix;
  currentPiece.matrix = rotateMatrix(currentPiece.matrix);

  // Kick back from wall if collision occurs
  let offset = 1;
  while (collide(0, 0)) {
    currentPiece.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > currentPiece.matrix[0].length) {
      // Rotate failed, revert
      currentPiece.matrix = prevMatrix;
      return;
    }
  }
}

// Move horizontally
function move(dir) {
  if (!gameActive || gamePaused || gameOverState) return;
  currentPiece.x += dir;
  if (collide(0, 0)) {
    currentPiece.x -= dir;
  }
}

// Move down
function moveDown() {
  if (!gameActive || gamePaused || gameOverState) return;
  currentPiece.y += 1;
  dropCounter = 0;

  if (collide(0, 0)) {
    currentPiece.y -= 1;
    mergePiece();
    clearLines();

    // Spawn new piece
    currentPiece = nextPiece;
    nextPiece = getRandomPiece();
    drawNextPiece();

    // Check game over
    if (collide(0, 0)) {
      gameOverState = true;
    }
  }
}

// Hard drop piece instantly
function hardDrop() {
  if (!gameActive || gamePaused || gameOverState) return;
  let droppedLines = 0;
  while (!collide(0, 1)) {
    currentPiece.y += 1;
    droppedLines++;
  }
  score += droppedLines * 2; // Extra points for hard drop
  moveDown(); // locks the piece
}

// Clear completed lines and update stats
function clearLines() {
  let clearedCount = 0;
  outer: for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) {
        continue outer;
      }
    }
    // Row is full, remove it
    board.splice(r, 1);
    board.unshift(Array(COLS).fill(0));
    clearedCount++;
    r++; // inspect the same index again since it has new values
  }

  if (clearedCount > 0) {
    lines += clearedCount;
    // Score scaling matching standard guidelines
    const lineScores = [0, 100, 300, 500, 800];
    score += (lineScores[clearedCount] || 800) * level;

    // Level up every 10 lines
    level = Math.floor(lines / 10) + 1;
    updateStatsDisplay();
  }
}

// Draw game canvas
function draw() {
  // Clear canvas
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines (subtle grid feel)
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, 0);
    ctx.lineTo(c * BLOCK_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK_SIZE);
    ctx.lineTo(canvas.width, r * BLOCK_SIZE);
    ctx.stroke();
  }

  // Draw board blocks
  board.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) {
        drawBlock(ctx, c, r, value);
      }
    });
  });

  // Draw current falling piece
  if (currentPiece) {
    currentPiece.matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) {
          drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, currentPiece.color);
        }
      });
    });
  }
}

// Draw next piece in sidebar preview canvas
function drawNextPiece() {
  nextCtx.fillStyle = '#111';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) return;

  const matrix = nextPiece.matrix;
  const color = nextPiece.color;
  const shapeSize = matrix.length;
  
  // Center alignments
  const size = 16;
  const offsetX = (nextCanvas.width - shapeSize * size) / 2;
  const offsetY = (nextCanvas.height - shapeSize * size) / 2;

  matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) {
        nextCtx.fillStyle = color;
        nextCtx.fillRect(offsetX + c * size, offsetY + r * size, size - 1, size - 1);
        nextCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        nextCtx.strokeRect(offsetX + c * size, offsetY + r * size, size - 1, size - 1);
      }
    });
  });
}

// Drawing helper block
function drawBlock(context, x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

  // Subtle interior glow for a retro arcade look
  context.fillStyle = 'rgba(255, 255, 255, 0.25)';
  context.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 3, 2);
  context.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 3, 2, BLOCK_SIZE - 5);

  context.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
}

// Game Over handler
function handleGameOver() {
  gameActive = false;
  
  gameTitle.innerText = 'GAME OVER';
  gameTitle.style.color = '#e63946';
  gameSubtitle.innerText = 'Blocks stacked to the top!';
  finalScore.innerText = score;
  scoreDisplay.style.display = 'block';
  btnAction.innerText = 'PLAY AGAIN';
  
  overlay.classList.remove('hidden');

  // Submit final score back to shell
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: score,
    metadata: {
      linesCleared: lines,
      levelReached: level
    }
  }, '*');
}

// Keyboard input listeners
window.addEventListener('keydown', (e) => {
  if (!gameActive || gamePaused || gameOverState) return;

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      e.preventDefault();
      move(-1);
      break;
    case 'ArrowRight':
    case 'KeyD':
      e.preventDefault();
      move(1);
      break;
    case 'ArrowDown':
    case 'KeyS':
      e.preventDefault();
      moveDown();
      break;
    case 'ArrowUp':
    case 'KeyW':
      e.preventDefault();
      rotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
});

// Touch controls virtual keyboard actions
document.getElementById('btn-left').addEventListener('click', () => move(-1));
document.getElementById('btn-right').addEventListener('click', () => move(1));
document.getElementById('btn-rot').addEventListener('click', () => rotate());
document.getElementById('btn-down').addEventListener('click', () => moveDown());
document.getElementById('btn-drop').addEventListener('click', () => hardDrop());

// Action buttons triggers
btnAction.addEventListener('click', () => {
  if (gameOverState) {
    window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
  }
  startGame();
});

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
