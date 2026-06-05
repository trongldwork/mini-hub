// Read parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
document.getElementById('player-display').innerText = playerName;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Grid sizing
const GRID_SIZE = 15; // 15x15 grid
const TILE_COUNT = canvas.width / GRID_SIZE; // 300 / 15 = 20 tiles

// Game state variables
let snake = [];
let food = { x: 0, y: 0 };
let dx = 1; // horizontal velocity
let dy = 0; // vertical velocity
let score = 0;
let gameActive = false;
let gameOverState = false;
let gamePaused = false;
let nextDirection = { x: 1, y: 0 };

// Game loop timer
let gameInterval = null;
const GAME_SPEED = 120; // ms per frame

// UI elements
const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const gameSubtitle = document.getElementById('game-subtitle');
const finalScoreContainer = document.getElementById('final-score-container');
const finalScore = document.getElementById('final-score');
const btnAction = document.getElementById('btn-action');
const scoreDisplay = document.getElementById('score-display');

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
  }
});

// Direction controls mapping
function changeDirection(newDx, newDy) {
  if (!gameActive || gamePaused || gameOverState) return;

  // Prevent moving directly backwards
  if (newDx !== 0 && dx === -newDx) return;
  if (newDy !== 0 && dy === -newDy) return;

  nextDirection = { x: newDx, y: newDy };
}

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault(); // Prevent scrolling
  }

  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      changeDirection(0, -1);
      break;
    case 'KeyS':
    case 'ArrowDown':
      changeDirection(0, 1);
      break;
    case 'KeyA':
    case 'ArrowLeft':
      changeDirection(-1, 0);
      break;
    case 'KeyD':
    case 'ArrowRight':
      changeDirection(1, 0);
      break;
  }
});

// Mobile D-Pad button listeners
document.getElementById('dpad-up').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
document.getElementById('dpad-up').addEventListener('mousedown', () => changeDirection(0, -1));

document.getElementById('dpad-down').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
document.getElementById('dpad-down').addEventListener('mousedown', () => changeDirection(0, 1));

document.getElementById('dpad-left').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
document.getElementById('dpad-left').addEventListener('mousedown', () => changeDirection(-1, 0));

document.getElementById('dpad-right').addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });
document.getElementById('dpad-right').addEventListener('mousedown', () => changeDirection(1, 0));

btnAction.addEventListener('click', () => {
  if (gameOverState) {
    window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
  }
  startGame();
});

// Start Game
function startGame() {
  gameActive = true;
  gameOverState = false;
  gamePaused = false;
  score = 0;
  dx = 1;
  dy = 0;
  nextDirection = { x: 1, y: 0 };
  scoreDisplay.innerText = '0';

  // Initialize Snake (starting size 3, middle of grid)
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];

  spawnFood();
  overlay.classList.add('hidden');

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameStep, GAME_SPEED);
}

// Single step of game logic
function gameStep() {
  if (!gameActive || gamePaused || gameOverState) return;

  update();
  draw();

  if (gameOverState) {
    handleGameOver();
  }
}

// Spawns food at random position not occupied by snake
function spawnFood() {
  let foodX, foodY;
  let onSnake = true;

  while (onSnake) {
    foodX = Math.floor(Math.random() * TILE_COUNT);
    foodY = Math.floor(Math.random() * TILE_COUNT);
    
    // Check if food coordinates land on the snake
    onSnake = snake.some(segment => segment.x === foodX && segment.y === foodY);
  }

  food = { x: foodX, y: foodY };
}

// Update game physics & check collisions
function update() {
  // Commit the next direction change
  dx = nextDirection.x;
  dy = nextDirection.y;

  // Calculate new head position
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // Collision with walls
  if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
    gameOverState = true;
    return;
  }

  // Collision with self
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    gameOverState = true;
    return;
  }

  // Add new head
  snake.unshift(head);

  // Check if eating food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.innerText = score;
    spawnFood();
  } else {
    // Remove tail segment if not growing
    snake.pop();
  }
}

// Draw entities
function draw() {
  // Clear canvas
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines (subtle details)
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = 1;
  for (let i = 0; i <= TILE_COUNT; i++) {
    ctx.beginPath();
    ctx.moveTo(i * GRID_SIZE, 0);
    ctx.lineTo(i * GRID_SIZE, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * GRID_SIZE);
    ctx.lineTo(canvas.width, i * GRID_SIZE);
    ctx.stroke();
  }

  // Draw Food (red apple with shiny center)
  ctx.fillStyle = '#E63946';
  ctx.shadowColor = '#E63946';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc((food.x * GRID_SIZE) + GRID_SIZE / 2, (food.y * GRID_SIZE) + GRID_SIZE / 2, GRID_SIZE / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // reset shadow

  // Draw Snake 🐍 (yellow segments, head is styled differently)
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? '#f39c12' : '#f1c40f';
    ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);

    if (isHead) {
      // Draw eyes on head based on direction
      ctx.fillStyle = '#000';
      if (dx === 1) { // moving right
        ctx.fillRect(segment.x * GRID_SIZE + 10, segment.y * GRID_SIZE + 3, 2, 2);
        ctx.fillRect(segment.x * GRID_SIZE + 10, segment.y * GRID_SIZE + 10, 2, 2);
      } else if (dx === -1) { // moving left
        ctx.fillRect(segment.x * GRID_SIZE + 3, segment.y * GRID_SIZE + 3, 2, 2);
        ctx.fillRect(segment.x * GRID_SIZE + 3, segment.y * GRID_SIZE + 10, 2, 2);
      } else if (dy === 1) { // moving down
        ctx.fillRect(segment.x * GRID_SIZE + 3, segment.y * GRID_SIZE + 10, 2, 2);
        ctx.fillRect(segment.x * GRID_SIZE + 10, segment.y * GRID_SIZE + 10, 2, 2);
      } else if (dy === -1) { // moving up
        ctx.fillRect(segment.x * GRID_SIZE + 3, segment.y * GRID_SIZE + 3, 2, 2);
        ctx.fillRect(segment.x * GRID_SIZE + 10, segment.y * GRID_SIZE + 3, 2, 2);
      }
    }
  });
}

// Handle Game Over
function handleGameOver() {
  if (gameInterval) clearInterval(gameInterval);

  gameActive = false;
  finalScore.innerText = score;
  finalScoreContainer.style.display = 'block';
  gameTitle.innerText = 'GAME OVER';
  gameTitle.style.color = '#E63946';
  gameSubtitle.innerText = 'The snake crashed!';
  btnAction.innerText = 'PLAY AGAIN';
  
  overlay.classList.remove('hidden');

  // Submit score to parent shell
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: score,
    metadata: {
      snakeLength: snake.length,
      durationSeconds: Math.floor(score / 5)
    }
  }, '*');
}

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
