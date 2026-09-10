// ===== lib/games/snake.ts — controlador imperativo del juego NEONSNAKE =====
//
// Port TS de `references/started-games/05-snake/game.js` a un controlador con
// ciclo de vida (crear / pausar / reanudar / reiniciar / destruir) y dos
// callbacks hacia la plataforma: `onGameOver(finalScore)` y `onStats(stats)`.
//
// No importa React ni JSX. Solo toca `window`/DOM a través del `canvas` que se le
// pasa a `createSnakeGame`. El estado del juego —a nivel de módulo en el
// original— vive en el cierre de `createSnakeGame`.
//
// Diferencias respecto al original:
//   - El input lee `e.code` en vez de `e.key` (alinea con el resto de motores
//     de la plataforma y con el pad táctil, que despacha `code`).
//   - Sin fase `menu` ni `paused`: `phase` es `"playing" | "dead"`. El juego
//     arranca en `playing` al montar.
//   - Sin pausa interna (`P` / `Espacio`) ni reinicio interno (`Enter`): los
//     botones de la plataforma y el modal de fin son los únicos puntos de
//     pausa y reinicio.
//   - Sin `localStorage` (`snake_hi`); la mejor marca vive en `public.scores`.

export interface SnakeStats {
  score: number;
  speed: number;
}

export interface SnakeOptions {
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
  /** Se invoca tras cada cambio de puntuación o velocidad. */
  onStats: (stats: SnakeStats) => void;
}

export interface SnakeHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`resetGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente y quita los listeners de teclado. */
  destroy: () => void;
}

type Phase = "playing" | "dead";

interface Vec {
  x: number;
  y: number;
}

interface Cell {
  x: number;
  y: number;
}

// Coordenadas internas fijas 1:1 (no responsive); se escala por CSS en el componente.
const W = 528;
const H = 528;

// ---- Constantes (port literal del balance original) ----
const GRID = 24; // celdas por lado
const CELL = W / GRID; // 22 px
const START_LEN = 4;
const BASE_SPEED = 7; // pasos por segundo
const SPEED_STEP = 0.35; // aceleración por nivel
const MAX_SPEED = 18;
const POINTS_PER_FOOD = 10;
const FOOD_PER_LEVEL = 5; // comidas necesarias para subir de nivel

const COLORS = {
  head: "#5cffe4",
  body: "#16f5e6",
  bodyAlt: "#12c6bd",
  food: "#ff2fb9",
  grid: "rgba(22, 245, 230, 0.06)",
};

// Fuera de la spec: sprites de fruta a pedido del usuario. Atlas port de
// `references/started-games/05-snake/snake-assets/snake-assets/sprites.js`
// (recortes detectados por análisis de píxeles sobre `fruits.png`, fondo
// transparente). La imagen vive en `public/snake/fruits.png`.
interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRUITS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} satisfies Record<string, SpriteFrame>;

type FruitName = keyof typeof FRUITS;
const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];
const randomFruit = (): FruitName => FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];

// Carga perezosa y compartida entre partidas: se pinta a un canvas offscreen
// (mismo patrón que `lib/games/bloque-buster.ts`) para que `drawImage` no
// pague el coste de decodificación en cada frame. No bloquea el arranque de
// la partida: mientras no esté lista, `drawFood` cae al círculo de la comida.
let fruitsImg: HTMLCanvasElement | null = null;
let fruitsLoading = false;

function loadFruits() {
  if (fruitsImg || fruitsLoading) return;
  fruitsLoading = true;
  const rawImg = new Image();
  rawImg.onload = () => {
    const oc = document.createElement("canvas");
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    const octx = oc.getContext("2d");
    if (octx) octx.drawImage(rawImg, 0, 0);
    fruitsImg = oc;
  };
  rawImg.onerror = () => {
    fruitsLoading = false;
  };
  rawImg.src = "/snake/fruits.png";
}

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// Mapa de dirección por `KeyboardEvent.code` (antes leía `e.key`).
const KEY_DIRS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

export function createSnakeGame(canvas: HTMLCanvasElement, opts: SnakeOptions): SnakeHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createSnakeGame: opts.onGameOver debe ser una función");
  }
  if (typeof opts.onStats !== "function") {
    throw new TypeError("createSnakeGame: opts.onStats debe ser una función");
  }

  canvas.width = W;
  canvas.height = H;
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("createSnakeGame: contexto 2d no disponible");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // ── Estado de la partida ───────────────────────────────────────────────────
  let phase: Phase = "playing";
  let snake: Cell[] = [];
  let dir: Vec = { x: 1, y: 0 };
  let nextDir: Vec = { x: 1, y: 0 };
  let food: Cell = { x: 0, y: 0 };
  let foodFruit: FruitName = randomFruit();
  let score = 0;
  let level = 0;
  let stepMs = 1000 / BASE_SPEED;
  let acc = 0;
  let deathFlash = 0;
  // Garantiza una única llamada a `opts.onGameOver` por partida.
  let gameOverNotified = false;

  function currentSpeed(): number {
    return +(1000 / stepMs / BASE_SPEED).toFixed(1);
  }

  function placeFood() {
    const free: Cell[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
    foodFruit = randomFruit();
  }

  function resetGame() {
    const mid = Math.floor(GRID / 2);
    snake = [];
    for (let i = 0; i < START_LEN; i++) {
      snake.push({ x: mid - i, y: mid });
    }
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    level = 0;
    stepMs = 1000 / BASE_SPEED;
    acc = 0;
    deathFlash = 0;
    gameOverNotified = false;
    phase = "playing";
    placeFood();
    opts.onStats({ score, speed: currentSpeed() });
  }

  function die() {
    phase = "dead";
    deathFlash = 1;
    if (!gameOverNotified) {
      gameOverNotified = true;
      opts.onGameOver(score);
    }
  }

  function step() {
    // aplicar dirección encolada (sin giro de 180º)
    if (nextDir.x !== -dir.x || nextDir.y !== -dir.y) dir = nextDir;

    const head: Cell = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      die();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += POINTS_PER_FOOD;
      const newLevel = Math.floor(score / POINTS_PER_FOOD / FOOD_PER_LEVEL);
      if (newLevel !== level) {
        level = newLevel;
        stepMs = 1000 / Math.min(MAX_SPEED, BASE_SPEED + level * SPEED_STEP);
      }
      placeFood();
      opts.onStats({ score, speed: currentSpeed() });
    } else {
      snake.pop();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
    }
    ctx.stroke();
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCell(x: number, y: number, color: string, glow: number, inset = 0) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    roundRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2, 4);
    ctx.fill();
    ctx.restore();
  }

  // Fuera de la spec: marco neón sobre el borde real del tablero (0,0)-(W,H)
  // para que se vea dónde están los límites de movilidad, a pedido del usuario.
  function drawBounds() {
    ctx.save();
    ctx.shadowColor = COLORS.head;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = COLORS.head;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    ctx.restore();
  }

  function drawFood(time: number) {
    const pulse = 8 + Math.sin(time / 150) * 5;
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;

    // halo magenta pulsante detrás de la fruta (o único elemento si aún no cargó)
    ctx.save();
    ctx.shadowColor = COLORS.food;
    ctx.shadowBlur = pulse;
    ctx.fillStyle = "rgba(255, 47, 185, 0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (fruitsImg) {
      const frame = FRUITS[foodFruit];
      const box = CELL * 1.15;
      const scale = Math.min(box / frame.w, box / frame.h);
      const dw = frame.w * scale;
      const dh = frame.h * scale;
      ctx.drawImage(
        fruitsImg,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
    } else {
      drawCell(food.x, food.y, COLORS.food, pulse, 4);
    }
  }

  function drawEyes(head: Cell) {
    const cx = head.x * CELL;
    const cy = head.y * CELL;
    const r = CELL * 0.11;
    const off = CELL * 0.28;
    const fx = dir.x;
    const fy = dir.y;
    ctx.fillStyle = "#04040a";
    const eyes =
      fx !== 0
        ? [
            [off, off * 0.7],
            [off, CELL - off * 0.7],
          ]
        : [
            [off * 0.7, off],
            [CELL - off * 0.7, off],
          ];
    // desplazar hacia la dirección de avance
    const push = CELL * 0.12;
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      ctx.arc(cx + ex + fx * push, cy + ey + fy * push, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(time: number) {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawBounds();

    drawFood(time);

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
      ctx.fillRect(0, 0, W, H);
      deathFlash = Math.max(0, deathFlash - 0.05);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    if (phase !== "playing") return;
    const d = KEY_DIRS[e.code];
    if (d && (d.x !== -dir.x || d.y !== -dir.y)) nextDir = d;
  };
  const onKeyUp = () => {};
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const loop = (time: number) => {
    const dt = lastTime === null ? 0 : Math.min(100, time - lastTime);
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
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

  loadFruits();
  resetGame();
  render(performance.now());
  startLoop();

  return {
    pause: stopLoop,
    resume: startLoop,
    restart: () => {
      resetGame();
      startLoop();
    },
    destroy: () => {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
