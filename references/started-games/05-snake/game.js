// Snake — MVP retro/neon. Vanilla JS, cero dependencias.

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const hiscoreEl = document.getElementById("hiscore");
const speedEl = document.getElementById("speed");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayScore = document.getElementById("overlay-score");
const startBtn = document.getElementById("start-btn");

// ---- Constantes ----
const GRID = 24; // celdas por lado
const CELL = canvas.width / GRID; // 22 px
const START_LEN = 4;
const BASE_SPEED = 7; // pasos por segundo
const SPEED_STEP = 0.35; // aceleración por comida
const MAX_SPEED = 18;
const POINTS_PER_FOOD = 10;
const HI_KEY = "snake_hi";

const COLORS = {
  head: "#5cffe4",
  body: "#16f5e6",
  bodyAlt: "#12c6bd",
  food: "#ff2fb9",
  grid: "rgba(22, 245, 230, 0.06)",
};

// ---- Estado ----
/** @type {"menu"|"playing"|"paused"|"dead"} */
let phase = "menu";
let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let hiscore = Number(localStorage.getItem(HI_KEY) || 0);
let stepMs = 1000 / BASE_SPEED;
let acc = 0;
let lastTime = 0;
let deathFlash = 0;

hiscoreEl.textContent = hiscore;

// ---- Ciclo de vida ----
function resetGame() {
  const mid = Math.floor(GRID / 2);
  snake = [];
  for (let i = 0; i < START_LEN; i++) {
    snake.push({ x: mid - i, y: mid });
  }
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  stepMs = 1000 / BASE_SPEED;
  acc = 0;
  placeFood();
  updateHud();
}

function startGame() {
  resetGame();
  phase = "playing";
  hideOverlay();
}

function gameOver() {
  phase = "dead";
  deathFlash = 1;
  const isRecord = score > hiscore && score > 0;
  if (isRecord) {
    hiscore = score;
    localStorage.setItem(HI_KEY, String(hiscore));
  }
  updateHud();
  showOverlay({
    title: "GAME OVER",
    dead: true,
    msg: isRecord ? "¡Nuevo récord!" : "Te has mordido... o el muro.",
    score: `SCORE ${score}   ·   HI ${hiscore}`,
    btn: "REINTENTAR",
  });
}

function togglePause() {
  if (phase === "playing") {
    phase = "paused";
    showOverlay({ title: "PAUSA", msg: "Respira.", score: "", btn: "SEGUIR" });
  } else if (phase === "paused") {
    phase = "playing";
    hideOverlay();
    lastTime = performance.now();
  }
}

// ---- Lógica ----
function placeFood() {
  const free = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
}

function step() {
  // aplicar dirección encolada (sin giro de 180º)
  if (nextDir.x !== -dir.x || nextDir.y !== -dir.y) dir = nextDir;

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += POINTS_PER_FOOD;
    stepMs = 1000 / Math.min(MAX_SPEED, BASE_SPEED + score / POINTS_PER_FOOD * SPEED_STEP);
    placeFood();
    updateHud();
  } else {
    snake.pop();
  }
}

// ---- Render ----
function drawGrid() {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < GRID; i++) {
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
  }
  ctx.stroke();
}

function drawCell(x, y, color, glow, inset) {
  const p = inset || 0;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  roundRect(x * CELL + p, y * CELL + p, CELL - p * 2, CELL - p * 2, 4);
  ctx.fill();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // comida pulsante
  const pulse = 8 + Math.sin(time / 150) * 5;
  drawCell(food.x, food.y, COLORS.food, pulse, 4);

  // serpiente
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    if (i === 0) {
      drawCell(seg.x, seg.y, COLORS.head, 20, 1);
      drawEyes(seg);
    } else {
      drawCell(seg.x, seg.y, i % 2 ? COLORS.bodyAlt : COLORS.body, 10, 2);
    }
  }

  if (deathFlash > 0) {
    ctx.fillStyle = `rgba(255, 47, 185, ${deathFlash * 0.4})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    deathFlash = Math.max(0, deathFlash - 0.05);
  }
}

function drawEyes(head) {
  const cx = head.x * CELL;
  const cy = head.y * CELL;
  const r = CELL * 0.11;
  const off = CELL * 0.28;
  const fx = dir.x, fy = dir.y;
  ctx.fillStyle = "#04040a";
  const eyes = fx !== 0
    ? [[off, off * 0.7], [off, CELL - off * 0.7]]
    : [[off * 0.7, off], [CELL - off * 0.7, off]];
  // desplazar hacia la dirección de avance
  const push = CELL * 0.12;
  for (const [ex, ey] of eyes) {
    ctx.beginPath();
    ctx.arc(cx + ex + fx * push, cy + ey + fy * push, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- HUD / overlay ----
function updateHud() {
  scoreEl.textContent = score;
  hiscoreEl.textContent = hiscore;
  speedEl.textContent = (1000 / stepMs / BASE_SPEED).toFixed(1);
}

function showOverlay({ title, msg, score: sc, btn, dead }) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle("dead", !!dead);
  overlayMsg.textContent = msg || "";
  overlayScore.textContent = sc || "";
  startBtn.textContent = btn || "JUGAR";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

// ---- Loop ----
function frame(time) {
  const dt = Math.min(100, time - lastTime);
  lastTime = time;

  if (phase === "playing") {
    acc += dt;
    while (acc >= stepMs) {
      acc -= stepMs;
      step();
      if (phase !== "playing") break;
    }
  }

  render(time);
  requestAnimationFrame(frame);
}

// ---- Input ----
const KEYS = {
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
};

window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (k === "p" || k === " ") {
    e.preventDefault();
    if (phase === "playing" || phase === "paused") togglePause();
    return;
  }

  if (k === "Enter") {
    if (phase === "dead" || phase === "menu") startGame();
    return;
  }

  const d = KEYS[k];
  if (d) {
    e.preventDefault();
    if (phase === "menu" || phase === "dead") startGame();
    if (phase === "playing" && (d.x !== -dir.x || d.y !== -dir.y)) nextDir = d;
  }
});

startBtn.addEventListener("click", () => {
  if (phase === "paused") togglePause();
  else startGame();
});

// ---- Arranque ----
resetGame();
phase = "menu";
showOverlay({
  title: "SNAKE",
  msg: "Come, crece, no te muerdas.",
  score: hiscore ? `HI-SCORE ${hiscore}` : "",
  btn: "JUGAR",
});
lastTime = performance.now();
requestAnimationFrame(frame);
