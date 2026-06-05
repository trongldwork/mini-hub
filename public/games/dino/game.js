// Read parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameWrapper = document.getElementById('game-wrapper');

// Game state variables
let gameActive = false;
let gameOverState = false;
let gamePaused = false;
let score = 0;
let speed = 8;
const gravity = 0.6;

// Entity states
let dino = {
  x: 60,
  y: 0,
  width: 40,
  height: 44,
  velocityY: 0,
  jumping: false,
  groundY: 280
};

let isDucking = false;
let obstacles = [];
let nextObstacleTimer = 0;
let particles = [];
let clouds = [];
let mountains = [];
let stars = [];

// Set up dino initial Y position
dino.y = dino.groundY;

// UI elements
const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const gameSubtitle = document.getElementById('game-subtitle');
const scoreDisplay = document.getElementById('score-display');
const finalScore = document.getElementById('final-score');
const btnAction = document.getElementById('btn-action');

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

// Inputs
function triggerJump() {
  if (!gameActive || gamePaused || gameOverState) return;
  if (!dino.jumping && !isDucking) {
    dino.velocityY = -11.5;
    dino.jumping = true;
  }
}

// Event listeners for keyboard
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    triggerJump();
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    if (gameActive && !gamePaused && !gameOverState) {
      isDucking = true;
      if (dino.jumping) {
        // Fast drop
        dino.velocityY = Math.max(dino.velocityY, 12);
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    isDucking = false;
  }
});

// Touch and mouse inputs
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const touchY = touch.clientY - rect.top;
  const relativeY = touchY / rect.height;

  if (relativeY > 0.6) {
    if (gameActive && !gamePaused && !gameOverState) {
      isDucking = true;
      if (dino.jumping) {
        dino.velocityY = Math.max(dino.velocityY, 12);
      }
    }
  } else {
    triggerJump();
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  isDucking = false;
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickY = e.clientY - rect.top;
  const relativeY = clickY / rect.height;

  if (relativeY > 0.6) {
    if (gameActive && !gamePaused && !gameOverState) {
      isDucking = true;
      if (dino.jumping) {
        dino.velocityY = Math.max(dino.velocityY, 12);
      }
    }
  } else {
    triggerJump();
  }
});

canvas.addEventListener('mouseup', () => {
  isDucking = false;
});

canvas.addEventListener('mouseleave', () => {
  isDucking = false;
});

btnAction.addEventListener('click', () => {
  if (gameOverState) {
    window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
  }
  startGame();
});

// Initialize background elements
function initBackground() {
  clouds = [
    { x: 100, y: 50, speed: 0.3, size: 40 },
    { x: 350, y: 80, speed: 0.15, size: 50 },
    { x: 550, y: 40, speed: 0.4, size: 35 }
  ];
  mountains = [
    { x: 50, y: dino.groundY + 44, width: 120, height: 60 },
    { x: 250, y: dino.groundY + 44, width: 180, height: 90 },
    { x: 480, y: dino.groundY + 44, width: 140, height: 50 }
  ];
  stars = [];
  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * 150,
      size: Math.random() * 1.5 + 0.5,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
      alpha: Math.random()
    });
  }
  particles = [];
}

// Spawn run dust particle
function spawnRunParticle() {
  if (!dino.jumping && Math.random() > 0.4) {
    particles.push({
      x: dino.x + 4,
      y: dino.groundY + dino.height - 2,
      vx: -speed * 0.4 - Math.random() * 2,
      vy: -Math.random() * 1,
      size: Math.random() * 2 + 1,
      color: '#8b5cf6', // neon purple dust
      alpha: 0.6
    });
  }
}

// Spawn crash particle explosion
function spawnCrashExplosion() {
  for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speedPower = Math.random() * 8 + 2;
    particles.push({
      x: dino.x + dino.width / 2,
      y: dino.y + dino.height / 2,
      vx: Math.cos(angle) * speedPower,
      vy: Math.sin(angle) * speedPower - 2,
      size: Math.random() * 4 + 2,
      color: '#4ade80',
      alpha: 1
    });
  }
}

// Start game
function startGame() {
  gameActive = true;
  gameOverState = false;
  gamePaused = false;
  score = 0;
  speed = 8;
  obstacles = [];
  nextObstacleTimer = 50;
  isDucking = false;
  dino.width = 40;
  dino.height = 44;
  dino.y = dino.groundY;
  dino.velocityY = 0;
  dino.jumping = false;

  initBackground();
  overlay.classList.add('hidden');
  
  requestAnimationFrame(gameLoop);
}

// Game Loop
function gameLoop() {
  if (!gameActive || gamePaused) return;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  update();
  draw();

  if (!gameOverState) {
    requestAnimationFrame(gameLoop);
  } else {
    handleGameOver();
  }
}

// Helper to check collision with custom hitboxes
function checkCollision(dino, obs) {
  let dBox = {
    x: dino.x + 6,
    y: dino.y + 4,
    w: dino.width - 12,
    h: dino.height - 6
  };
  
  if (isDucking && !dino.jumping) {
    dBox = {
      x: dino.x + 4,
      y: dino.y + 8,
      w: dino.width - 8,
      h: dino.height - 10
    };
  }

  let oBox = {
    x: obs.x + 4,
    y: obs.y + 4,
    w: obs.width - 8,
    h: obs.height - 8
  };

  if (obs.type === 'meteor') {
    oBox = {
      x: obs.x + 3,
      y: obs.y + 3,
      w: obs.width - 6,
      h: obs.height - 6
    };
  } else if (obs.type === 'bird') {
    oBox = {
      x: obs.x + 4,
      y: obs.y + 6,
      w: obs.width - 8,
      h: obs.height - 10
    };
  }

  return (
    dBox.x < oBox.x + oBox.w &&
    dBox.x + dBox.w > oBox.x &&
    dBox.y < oBox.y + oBox.h &&
    dBox.y + dBox.h > oBox.y
  );
}

// Update game physics & entities
function update() {
  score += 0.15;
  speed += 0.003;

  // 1. Dino jumping physics first (resolves landing state instantly)
  dino.velocityY += gravity;
  dino.y += dino.velocityY;

  if (dino.y >= dino.groundY) {
    dino.y = dino.groundY;
    dino.velocityY = 0;
    dino.jumping = false;
  }

  // 2. Handle ducking size adjustments based on accurate dino.jumping state
  if (isDucking && !dino.jumping) {
    dino.width = 48;
    dino.height = 24;
    dino.y = dino.groundY + 20;
  } else {
    dino.width = 40;
    dino.height = 44;
    if (!dino.jumping) {
      dino.y = dino.groundY;
    }
  }

  // Running dust particles
  spawnRunParticle();

  // Scroll background clouds
  clouds.forEach(c => {
    c.x -= c.speed;
    if (c.x + c.size * 2 < 0) {
      c.x = canvas.width + Math.random() * 100;
      c.y = Math.random() * 80 + 20;
    }
  });

  // Scroll stars
  stars.forEach(s => {
    s.x -= speed * 0.05;
    if (s.x < 0) {
      s.x = canvas.width;
      s.y = Math.random() * 150;
    }
    s.alpha += s.twinkleSpeed;
    if (s.alpha > 1 || s.alpha < 0) {
      s.twinkleSpeed = -s.twinkleSpeed;
    }
  });

  // Scroll background mountains (parallax)
  mountains.forEach(m => {
    m.x -= speed * 0.15;
    if (m.x + m.width < 0) {
      m.x = canvas.width + Math.random() * 100;
    }
  });

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Generate obstacles
  nextObstacleTimer--;
  if (nextObstacleTimer <= 0) {
    const rand = Math.random();
    let obstacleType = 'small';

    if (score > 300 && rand > 0.8) {
      obstacleType = 'meteor';
    } else if (score > 150 && rand > 0.65) {
      obstacleType = 'bird';
    } else if (rand > 0.45) {
      obstacleType = 'cluster';
    } else if (rand > 0.25) {
      obstacleType = 'large';
    }

    if (obstacleType === 'bird') {
      const flyHeight = Math.random() > 0.5 ? dino.groundY - 14 : dino.groundY + 12;
      obstacles.push({
        type: 'bird',
        x: canvas.width,
        y: flyHeight,
        width: 32,
        height: 20,
        color: '#f59e0b',
        wingFrame: 0
      });
    } else if (obstacleType === 'meteor') {
      obstacles.push({
        type: 'meteor',
        x: canvas.width,
        y: dino.groundY - 5,
        width: 25,
        height: 25,
        color: '#ef4444',
        speedMult: 1.35
      });
    } else if (obstacleType === 'cluster') {
      obstacles.push({
        type: 'cluster',
        x: canvas.width,
        y: dino.groundY - 4,
        width: 38,
        height: 48,
        color: '#10b981'
      });
    } else {
      obstacles.push({
        type: obstacleType,
        x: canvas.width,
        y: obstacleType === 'large' ? dino.groundY - 12 : dino.groundY + 8,
        width: obstacleType === 'large' ? 24 : 16,
        height: obstacleType === 'large' ? 56 : 36,
        color: obstacleType === 'large' ? '#059669' : '#10b981'
      });
    }
    nextObstacleTimer = Math.floor(Math.random() * 50) + Math.max(35, 100 - Math.floor(speed * 3.5));
  }

  // Move and check obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    const currentSpeed = obs.speedMult ? speed * obs.speedMult : speed;
    obs.x -= currentSpeed;

    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
      continue;
    }

    // Meteor trail particles
    if (obs.type === 'meteor' && Math.random() > 0.3) {
      particles.push({
        x: obs.x + obs.width,
        y: obs.y + obs.height / 2 + (Math.random() - 0.5) * 8,
        vx: currentSpeed * 0.3 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
        alpha: 0.8
      });
    }

    if (checkCollision(dino, obs)) {
      gameOverState = true;
      spawnCrashExplosion();
    }
  }
}

// Drawing Helper: Round Rect
function roundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = {tl: radius, tr: radius, br: radius, bl: radius};
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  ctx.fill();
}

function drawNeonDino(ctx, x, y, w, h, isDucking, score) {
  ctx.save();
  ctx.fillStyle = '#4ade80';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 12;

  if (isDucking) {
    // Ducking Dino Body
    roundRect(ctx, x, y + 4, w - 8, h - 8, 6);
    // Head (extending forward)
    roundRect(ctx, x + w - 16, y, 16, 12, 4);
    // Tail
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.quadraticCurveTo(x - 12, y + 12, x - 6, y + 2);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#121212';
    ctx.fillRect(x + w - 8, y + 3, 3, 3);

    // Legs running animation (ducking)
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 12;
    const legFrame = Math.floor(score * 0.5) % 2;
    if (legFrame === 0) {
      ctx.fillRect(x + 12, y + h - 4, 4, 4);
      ctx.fillRect(x + 28, y + h - 8, 4, 4);
    } else {
      ctx.fillRect(x + 12, y + h - 8, 4, 4);
      ctx.fillRect(x + 28, y + h - 4, 4, 4);
    }
  } else {
    // Standing Dino Body
    roundRect(ctx, x + 4, y + 12, 28, 22, 6);
    // Head & Snout
    roundRect(ctx, x + 16, y, 22, 14, 4);
    // Neck
    roundRect(ctx, x + 18, y + 10, 12, 8, 2);
    // Tail
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 24);
    ctx.quadraticCurveTo(x - 12, y + 16, x - 4, y + 10);
    ctx.lineTo(x + 4, y + 16);
    ctx.closePath();
    ctx.fill();

    // Arm
    roundRect(ctx, x + 30, y + 18, 8, 4, 1);

    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#121212';
    ctx.fillRect(x + 28, y + 4, 3, 3);

    // Legs (normal / jump)
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 12;
    if (dino.jumping) {
      ctx.fillRect(x + 10, y + h - 10, 4, 8);
      ctx.fillRect(x + 22, y + h - 10, 4, 8);
    } else {
      const legFrame = Math.floor(score * 0.5) % 2;
      if (legFrame === 0) {
        ctx.fillRect(x + 10, y + h - 10, 4, 10);
        ctx.fillRect(x + 22, y + h - 8, 4, 6);
      } else {
        ctx.fillRect(x + 10, y + h - 8, 4, 6);
        ctx.fillRect(x + 22, y + h - 10, 4, 10);
      }
    }
  }
  ctx.restore();
}

function drawNeonCactus(ctx, obs) {
  ctx.save();
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = 12;

  const x = obs.x;
  const y = obs.y;
  const w = obs.width;
  const h = obs.height;

  // Main vertical trunk
  roundRect(ctx, x + w / 2 - 3, y, 6, h, 3);

  if (obs.type === 'large') {
    // Left branch
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 3, y + h * 0.4);
    ctx.lineTo(x + 2, y + h * 0.4);
    ctx.lineTo(x + 2, y + h * 0.15);
    ctx.strokeStyle = obs.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Right branch
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 3, y + h * 0.5);
    ctx.lineTo(x + w - 2, y + h * 0.5);
    ctx.lineTo(x + w - 2, y + h * 0.25);
    ctx.stroke();
  } else {
    // Small branches
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 3, y + h * 0.45);
    ctx.lineTo(x + 1, y + h * 0.45);
    ctx.lineTo(x + 1, y + h * 0.25);
    ctx.strokeStyle = obs.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 3, y + h * 0.55);
    ctx.lineTo(x + w - 1, y + h * 0.55);
    ctx.lineTo(x + w - 1, y + h * 0.35);
    ctx.stroke();
  }

  ctx.restore();
}

function drawNeonBird(ctx, obs) {
  ctx.save();
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = 12;

  const x = obs.x;
  const y = obs.y;
  const w = obs.width;
  const h = obs.height;

  // Draw bird body
  roundRect(ctx, x, y + 4, w, 10, 4);

  // Beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(x + w, y + 4);
  ctx.lineTo(x + w + 6, y + 7);
  ctx.lineTo(x + w, y + 10);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#121212';
  ctx.fillRect(x + w - 6, y + 6, 2, 2);

  // Wings
  ctx.fillStyle = '#d97706';
  obs.wingFrame = (obs.wingFrame + 0.12) % 2;
  const frame = Math.floor(obs.wingFrame);

  if (frame === 0) {
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 4, y + 4);
    ctx.lineTo(x + w / 2, y - 8);
    ctx.lineTo(x + w / 2 + 4, y + 4);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 4, y + 10);
    ctx.lineTo(x + w / 2, y + 20);
    ctx.lineTo(x + w / 2 + 4, y + 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
function drawNeonCluster(ctx, obs) {
  ctx.save();
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = 12;

  const x = obs.x;
  const y = obs.y;
  const w = obs.width;
  const h = obs.height;

  // Draw first cactus (medium)
  roundRect(ctx, x + 4, y + 12, 6, h - 12, 3);
  ctx.beginPath();
  ctx.moveTo(x + 7, y + h - 18);
  ctx.lineTo(x + 1, y + h - 18);
  ctx.lineTo(x + 1, y + h - 26);
  ctx.strokeStyle = obs.color;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Draw second cactus (tall)
  roundRect(ctx, x + w - 12, y, 7, h, 3.5);
  ctx.beginPath();
  ctx.moveTo(x + w - 9, y + h - 26);
  ctx.lineTo(x + w - 2, y + h - 26);
  ctx.lineTo(x + w - 2, y + h - 36);
  ctx.strokeStyle = obs.color;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

function drawNeonMeteor(ctx, obs) {
  ctx.save();
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = 15;

  const x = obs.x;
  const y = obs.y;
  const w = obs.width;
  const h = obs.height;

  // Main fireball circle
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // Inner hot core
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 2, y + h / 2, w / 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Draw flame tail
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(x + w, y + 3);
  ctx.lineTo(x + w + 16, y + h / 2);
  ctx.lineTo(x + w, y + h - 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Draw entities
function draw() {
  // Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#0a0813');
  skyGrad.addColorStop(0.75, '#191528');
  skyGrad.addColorStop(1, '#2c223e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Twinkling stars
  stars.forEach(s => {
    ctx.save();
    ctx.globalAlpha = Math.max(0.1, Math.min(1, s.alpha));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    ctx.restore();
  });

  // 1. Draw mountains
  mountains.forEach((m, idx) => {
    const grad = ctx.createLinearGradient(0, m.y - m.height, 0, m.y);
    grad.addColorStop(0, 'rgba(45, 34, 76, 0.4)');
    grad.addColorStop(1, 'rgba(15, 12, 28, 0.8)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x + m.width / 2, m.y - m.height);
    ctx.lineTo(m.x + m.width, m.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(139, 92, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 2. Draw clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  clouds.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size * 0.5, 0, Math.PI * 2);
    ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.1, c.size * 0.4, 0, Math.PI * 2);
    ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  });

  // 3. Draw particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  });

  // 4. Draw neon ground line
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, dino.groundY + 44);
  ctx.lineTo(canvas.width, dino.groundY + 44);
  ctx.stroke();
  ctx.restore();

  // 5. Draw Obstacles
  obstacles.forEach(obs => {
    if (obs.type === 'bird') {
      drawNeonBird(ctx, obs);
    } else if (obs.type === 'meteor') {
      drawNeonMeteor(ctx, obs);
    } else if (obs.type === 'cluster') {
      drawNeonCluster(ctx, obs);
    } else {
      drawNeonCactus(ctx, obs);
    }
  });

  // 6. Draw Dino
  drawNeonDino(ctx, dino.x, dino.y, dino.width, dino.height, isDucking, score);

  // 7. Draw Score Overlay
  ctx.fillStyle = '#F1FAEE';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Meters: ${Math.floor(score)}m`, canvas.width - 20, 30);
  ctx.fillStyle = '#E63946';
  ctx.fillText(`Speed: ${speed.toFixed(1)}x`, canvas.width - 20, 50);
}

// Handle Game Over
function handleGameOver() {
  gameActive = false;
  const finalMeters = Math.floor(score);
  
  gameTitle.innerText = 'GAME OVER';
  gameTitle.style.color = '#E63946';
  gameSubtitle.innerText = 'Ouch! The dino crashed.';
  finalScore.innerText = finalMeters;
  scoreDisplay.style.display = 'block';
  btnAction.innerText = 'PLAY AGAIN';
  
  overlay.classList.remove('hidden');

  window.parent.postMessage({
    type: 'GAME_OVER',
    score: finalMeters,
    metadata: {
      speedReached: Number(speed.toFixed(2)),
      durationSeconds: Math.floor(finalMeters / 10)
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
