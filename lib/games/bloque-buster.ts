// ===== lib/games/bloque-buster.ts — controlador imperativo de BLOQUE BUSTER =====
//
// Port TS de `references/started-games/04-arkanoid/game.js` + `assets/spritesheet.js`
// a un controlador con ciclo de vida (crear / pausar / reanudar / reiniciar /
// destruir) y un único callback hacia la plataforma: `onGameOver(finalScore)`.
//
// No importa React ni JSX. Solo toca `window`/DOM a través del `canvas` que se le
// pasa a `createBloqueBusterGame`. El estado del juego —a nivel de módulo en el
// original— vive en el cierre de la factory.
//
// Diferencias respecto al original:
//   - En `phase === "gameover"` NO se reinicia con tecla ni click; al entrar en
//     game over se invoca `opts.onGameOver(state.score)` una sola vez y el overlay
//     pierde la línea "Pulsa una tecla o haz click para reiniciar".
//   - `now` pasa de `now = ts` (timestamp de rAF) a un acumulador de tiempo de
//     juego (`now += min(dt, 0.05) * 1000`), para que `pause()` congele buff,
//     partículas, destellos, popups y animación de rotura sin reajustar timestamps.
//   - Las rutas de assets se reescriben a `/bloque-buster/...`.

export interface BloqueBusterOptions {
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
}

export interface BloqueBusterHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`resetGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente y quita los cuatro listeners. */
  destroy: () => void;
}

// Coordenadas internas fijas (no responsive); se escala por CSS en el componente.
const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// ═══════════════════════════════════════════════════════════════════════════════
// Port de `game.js`: tipos, constantes de balance, patrones y utilidades puras.
// A nivel de módulo en el original; se mantienen aquí (no tocan `state`).
// ═══════════════════════════════════════════════════════════════════════════════

type Phase = "playing" | "gameover" | "stageclear";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  stuck: boolean;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  skin: string | null;
  hp: number;
  maxHp: number;
  alive: boolean;
  breaking: boolean;
  breakStart: number;
}

interface Buff {
  kind: "slow" | "fast";
  mult: number;
  until: number;
}

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, valor base
const STAGE_SPEED_STEP = 0.05; // +5% de rapidez de bola por stage
const STAGE_SPEED_CAP = 1.75; // multiplicador máximo sobre BALL.speed

const MULTIBALL_EVERY = 30; // bloques realmente rotos entre hitos de bloque
const MULTIBALL_ADD: number = 4; // bolas que se añaden en cada activación
const MULTIBALL_SPREAD = 0.5; // rad de abanico al repartir la dirección de las bolas nuevas
const MAX_LAUNCH_ANGLE = (50 * Math.PI) / 180; // desde la vertical
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // rebote en el paddle, desde la vertical

const BUFF_DURATION = 10000; // ms que dura el buff de velocidad
const BUFF_SLOW = 0.7; // multiplicador de velocidad del buff lento
const BUFF_FAST = 1.35; // multiplicador de velocidad del buff rápido
const LIFE_EVERY = 1000; // puntos acumulados entre vidas extra
const MAX_LIVES = 10; // tope duro de vidas

const START_ROWS = 5; // filas en el stage 1
const MAX_ROWS = 9; // tope de filas; por encima solo escala el blindaje
const FILL_STEP = 0.05; // +5% de relleno fuera de patrón por stage
const FILL_CAP = 0.4; // tope de relleno procedural
const MIN_BRICKS = 14; // salvaguarda: por debajo de esto el stage usa el patrón "full"

const ARMOR_START_STAGE = 2; // primer stage con bloques de varios golpes
const ARMOR_MAX_HP = 5; // golpes máximos de un bloque blindado
const ARMOR_SKIN: Record<number, string> = { 2: "wood", 3: "brick", 4: "gray", 5: "slate" };

const GRID = {
  cols: 10,
  rows: 5,
  marginX: 40, // margen lateral dentro del canvas
  top: 60, // offset superior
  gapX: 8,
  gapY: 4,
  rowColors: ["red", "hotpink", "magenta", "cyan", "yellow"], // color por fila (0 = superior)
};
const BRICK_H = 24; // alto de bloque (el sprite es 32x16)
const START_LIVES = 5;

const BREAK_SFX_SRC = "/bloque-buster/break-sound.mp3";
const BREAK_SFX_POOL_SIZE = 8;
const BOUNCE_SFX_SRC = "/bloque-buster/ball-bounce.mp3";
const BOUNCE_SFX_POOL_SIZE = 4;

const PARTICLES_PER_BRICK = 10; // fragmentos por bloque roto
const PARTICLE_MAX = 200; // tope global de partículas vivas
const PARTICLE_LIFE = 500; // ms de vida
const PARTICLE_GRAVITY = 900; // px/s^2 hacia abajo
const PARTICLE_SIZE_MIN = 3; // px
const PARTICLE_SIZE_MAX = 5; // px
const PARTICLE_VX_MAX = 180; // px/s, rango [-max, +max]
const PARTICLE_VY_MIN = -260; // px/s (hacia arriba)
const PARTICLE_VY_MAX = -40; // px/s

const FLASH_DURATION = 100; // ms
const POPUP_LIFE = 600; // ms
const POPUP_RISE = 28; // px que sube en toda su vida

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface Pattern {
  name: string;
  cell: (r: number, rows: number, c: number, cols: number) => boolean;
}

const PATTERNS: Pattern[] = [
  { name: "full", cell: () => true },
  {
    name: "pyramid",
    cell: (r, rows, c, cols) => Math.abs(c - (cols - 1) / 2) <= (((cols - 1) / 2) * (r + 1)) / rows,
  },
  { name: "checker", cell: (r, rows, c) => (r + c) % 2 === 0 },
  {
    name: "diamond",
    cell: (r, rows, c, cols) =>
      Math.abs(c - (cols - 1) / 2) + Math.abs(r - (rows - 1) / 2) <= Math.max(rows, cols) / 2,
  },
  { name: "columns", cell: (r, rows, c) => c % 3 !== 1 },
  {
    name: "frame",
    cell: (r, rows, c, cols) => r === 0 || r === rows - 1 || c === 0 || c === cols - 1,
  },
  { name: "zigzag", cell: (r, rows, c) => (r + c) % 4 < 2 },
  {
    name: "funnel",
    cell: (r, rows, c, cols) => Math.abs(c - (cols - 1) / 2) >= (((cols - 1) / 2) * r) / rows,
  },
];

function armorChance(stage: number): number {
  return Math.min(0.08 * (stage - 1), 0.75);
}

function fillChance(stage: number): number {
  return Math.min(FILL_STEP * (stage - 1), FILL_CAP);
}

function maxArmorHp(stage: number): number {
  return clamp(2 + Math.floor((stage - 1) / 3), 2, ARMOR_MAX_HP);
}

function layoutBricks(stage: number, rows: number, bw: number, pattern: Pattern): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < rows; row++) {
    const color = GRID.rowColors[row % GRID.rowColors.length];
    const y = GRID.top + row * (BRICK_H + GRID.gapY);
    for (let col = 0; col < GRID.cols; col++) {
      const inPattern = pattern.cell(row, rows, col, GRID.cols);
      if (!inPattern && Math.random() >= fillChance(stage)) continue;
      const x = GRID.marginX + col * (bw + GRID.gapX);
      let maxHp = 1;
      if (stage >= ARMOR_START_STAGE && Math.random() < armorChance(stage)) {
        maxHp = 2 + Math.floor(Math.random() * (maxArmorHp(stage) - 1));
      }
      const skin = maxHp > 1 ? ARMOR_SKIN[maxHp] : null;
      bricks.push({
        x,
        y,
        w: bw,
        h: BRICK_H,
        color,
        skin,
        hp: maxHp,
        maxHp,
        alive: true,
        breaking: false,
        breakStart: 0,
      });
    }
  }
  return bricks;
}

function buildBricks(stage: number): Brick[] {
  const bw = (CANVAS_W - 2 * GRID.marginX - (GRID.cols - 1) * GRID.gapX) / GRID.cols;
  const rows = Math.min(START_ROWS + Math.floor(stage / 2), MAX_ROWS);
  const pattern = PATTERNS[(stage - 1) % PATTERNS.length];
  let bricks = layoutBricks(stage, rows, bw, pattern);
  if (bricks.length < MIN_BRICKS) {
    bricks = layoutBricks(stage, rows, bw, PATTERNS[0]);
  }
  return bricks;
}

function makeBall(): Ball {
  return { x: 0, y: 0, vx: 0, vy: 0, r: BALL.size / 2, stuck: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Port de `assets/spritesheet.js`: helper de render sobre un canvas offscreen.
// `ssImg` es una caché de módulo compartida entre instancias (era global).
// ═══════════════════════════════════════════════════════════════════════════════

interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const EXPLOSION_DURATION = 150;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  born: number;
}

interface Flash {
  x: number;
  y: number;
  w: number;
  h: number;
  born: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  born: number;
  life?: number;
  size?: number;
}

interface GameState {
  phase: Phase;
  stage: number;
  stageSpeed: number; // rapidez base de la bola en el stage actual (sin buff)
  buff: Buff | null;
  lives: number;
  score: number;
  bricksDestroyed: number; // bloques con hp === 0 en toda la partida
  blockMilestones: number; // hitos de MULTIBALL_EVERY cruzados (alterna multibola / buff)
  paddle: { x: number; y: number; w: number; h: number };
  balls: Ball[];
  bricks: Brick[];
  input: { left: boolean; right: boolean; mouseX: number | null };
  particles: Particle[];
  flashes: Flash[];
  popups: Popup[];
}

const SPRITES: {
  paddle: SpriteFrame;
  ball: SpriteFrame;
  blocks: Record<string, SpriteFrame>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
    wood: { sx: 32, sy: 272, sw: 32, sh: 16 },
    brick: { sx: 64, sy: 272, sw: 32, sh: 16 },
    slate: { sx: 64, sy: 288, sw: 32, sh: 16 },
  },
};

let ssImg: HTMLCanvasElement | null = null;
let ssLoaded = false;
const ssCallbacks: Array<() => void> = [];

function loadSpritesheet(cb: () => void): void {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (ssImg) return;

  const rawImg = new Image();
  rawImg.onload = () => {
    const oc = document.createElement("canvas");
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    const octx = oc.getContext("2d");
    if (octx) octx.drawImage(rawImg, 0, 0);
    ssImg = oc;
    ssLoaded = true;
    ssCallbacks.forEach((f) => f());
    ssCallbacks.length = 0;
  };
  rawImg.onerror = () => console.error("Failed to load spritesheet");
  rawImg.src = "/bloque-buster/spritesheet-breakout.png";
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!ssLoaded || !ssImg) return;
  ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!ssLoaded || !ssImg) return;
  const sp = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6)]
    : SPRITES[name as "paddle" | "ball"];
  if (!sp) return;
  ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}

export function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  opts: BloqueBusterOptions,
): BloqueBusterHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createBloqueBusterGame: opts.onGameOver debe ser una función");
  }

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("createBloqueBusterGame: contexto 2d no disponible");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // Fondo inicial mientras carga el spritesheet.
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Tiempo de juego ────────────────────────────────────────────────────────
  // `now` es un acumulador de tiempo de juego (ms), no el timestamp de rAF: no
  // avanza mientras el loop no se programa, así `pause()` congela buff,
  // partículas, destellos, popups y animación de rotura sin reajustar timestamps.
  let now = 0;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  // Garantiza una única llamada a `opts.onGameOver` por partida.
  let gameOverNotified = false;

  // ── Audio ──────────────────────────────────────────────────────────────────
  // Placeholders; el paso 5 los sustituye por pools de <audio> sobre
  // `/bloque-buster/...`.
  const playBreakSfx = () => {};
  const playBounceSfx = () => {};

  // ── Estado de la partida (a nivel de módulo en el original, ahora en cierre) ─
  const state: GameState = {
    phase: "playing",
    stage: 1,
    stageSpeed: BALL.speed,
    buff: null,
    lives: START_LIVES,
    score: 0,
    bricksDestroyed: 0,
    blockMilestones: 0,
    paddle: { x: (CANVAS_W - PADDLE.w) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
    balls: [makeBall()],
    bricks: buildBricks(1),
    input: { left: false, right: false, mouseX: null },
    particles: [],
    flashes: [],
    popups: [],
  };

  // ── Lógica portada de `game.js` (sin cambios de semántica salvo lo indicado) ─
  function updatePaddle(dt: number) {
    const p = state.paddle;
    const maxX = CANVAS_W - p.w;

    if (state.input.mouseX !== null) {
      p.x = state.input.mouseX - p.w / 2;
    }

    let dir = 0;
    if (state.input.left) dir -= 1;
    if (state.input.right) dir += 1;
    if (dir !== 0) {
      p.x += dir * PADDLE.speed * dt;
      state.input.mouseX = null; // el teclado toma el control hasta que se mueve el ratón
    }

    p.x = clamp(p.x, 0, maxX);
  }

  function stickBallToPaddle(ball: Ball) {
    const p = state.paddle;
    ball.x = p.x + p.w / 2;
    ball.y = p.y - ball.r;
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = true;
  }

  function stageBallSpeed(): number {
    return BALL.speed * Math.min(1 + STAGE_SPEED_STEP * (state.stage - 1), STAGE_SPEED_CAP);
  }

  function effectiveSpeed(): number {
    return state.stageSpeed * (state.buff ? state.buff.mult : 1);
  }

  function rescaleBalls() {
    const target = effectiveSpeed();
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.stuck) continue;
      const mag = Math.hypot(b.vx, b.vy);
      if (mag === 0) continue;
      b.vx = (b.vx / mag) * target;
      b.vy = (b.vy / mag) * target;
    }
  }

  function activateBuff() {
    const slow = Math.random() < 0.5;
    state.buff = {
      kind: slow ? "slow" : "fast",
      mult: slow ? BUFF_SLOW : BUFF_FAST,
      until: now + BUFF_DURATION,
    };
    rescaleBalls();
    spawnNotice(slow ? "SLOW BALL" : "FAST BALL");
  }

  function launchBall() {
    const speed = effectiveSpeed();
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (!b.stuck) continue;
      b.stuck = false;
      const angle = (Math.random() * 2 - 1) * MAX_LAUNCH_ANGLE;
      b.vx = speed * Math.sin(angle);
      b.vy = -speed * Math.cos(angle);
    }
  }

  function collideBallWall(b: Ball) {
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = -b.vx;
      playBounceSfx();
    } else if (b.x + b.r > CANVAS_W) {
      b.x = CANVAS_W - b.r;
      b.vx = -b.vx;
      playBounceSfx();
    }

    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = -b.vy;
      playBounceSfx();
    }
  }

  function collideBallPaddle(b: Ball) {
    const p = state.paddle;
    if (b.vy <= 0) return;
    if (b.x + b.r <= p.x || b.x - b.r >= p.x + p.w) return;
    if (b.y + b.r < p.y || b.y - b.r > p.y + p.h) return;

    const offset = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
    const angle = offset * MAX_BOUNCE_ANGLE;
    const speed = effectiveSpeed();
    b.vx = speed * Math.sin(angle);
    b.vy = -speed * Math.cos(angle);
    b.y = p.y - b.r;
    playBounceSfx();
  }

  function collideBallBricks(b: Ball) {
    const left = b.x - b.r;
    const right = b.x + b.r;
    const top = b.y - b.r;
    const bottom = b.y + b.r;

    for (let i = 0; i < state.bricks.length; i++) {
      const br = state.bricks[i];
      if (!br.alive) continue;
      if (right <= br.x || left >= br.x + br.w || bottom <= br.y || top >= br.y + br.h) continue;

      const overlapX = Math.min(right - br.x, br.x + br.w - left);
      const overlapY = Math.min(bottom - br.y, br.y + br.h - top);

      if (overlapX < overlapY) {
        b.x += b.x < br.x + br.w / 2 ? -overlapX : overlapX;
        b.vx = -b.vx;
      } else {
        b.y += b.y < br.y + br.h / 2 ? -overlapY : overlapY;
        b.vy = -b.vy;
      }

      br.hp--;
      if (br.hp > 0) {
        br.breaking = false;
        playBreakSfx();
        spawnFlash(br);
        return; // golpe no letal: solo sonido + destello
      }

      br.alive = false;
      br.breaking = true;
      br.breakStart = now;
      playBreakSfx();
      spawnParticles(br);
      spawnFlash(br);
      const points = 10 * br.maxHp;
      spawnPopup(br, points);
      const scoreBefore = state.score;
      state.score += points;
      state.bricksDestroyed++;

      if (
        Math.floor((state.bricksDestroyed - 1) / MULTIBALL_EVERY) !==
        Math.floor(state.bricksDestroyed / MULTIBALL_EVERY)
      ) {
        state.blockMilestones++;
        if (state.blockMilestones % 2 === 1) {
          spawnMultiball(b);
          spawnNotice("MULTIBALL!");
        } else {
          activateBuff();
        }
      }

      if (Math.floor(scoreBefore / LIFE_EVERY) !== Math.floor(state.score / LIFE_EVERY)) {
        if (state.lives < MAX_LIVES) {
          state.lives++;
          spawnNotice("+1 VIDA");
        } else {
          spawnNotice("VIDAS AL MAXIMO");
        }
      }

      return; // resolver como máximo un bloque por frame
    }
  }

  function updateBalls(dt: number) {
    const count = state.balls.length; // bolas de multibola nacen dentro; se mueven el frame siguiente
    for (let i = 0; i < count; i++) {
      const b = state.balls[i];

      if (b.stuck) {
        stickBallToPaddle(b);
        continue;
      }

      const dist = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / b.r));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        collideBallWall(b);
        collideBallPaddle(b);
        collideBallBricks(b);
      }
    }
  }

  function loseBallsOffscreen() {
    for (let i = state.balls.length - 1; i >= 0; i--) {
      if (state.balls[i].y - state.balls[i].r > CANVAS_H) {
        state.balls.splice(i, 1);
      }
    }
    if (state.balls.length > 0) return;

    state.lives--;
    if (state.lives > 0) {
      state.balls.push(makeBall());
      stickBallToPaddle(state.balls[0]);
    }
  }

  function spawnMultiball(ref: Ball) {
    if (!ref) return;
    const speed = effectiveSpeed();
    const baseAngle = Math.atan2(ref.vy, ref.vx);
    for (let i = 0; i < MULTIBALL_ADD; i++) {
      const t = MULTIBALL_ADD === 1 ? 0 : (i / (MULTIBALL_ADD - 1)) * 2 - 1; // [ -1, 1 ]
      const angle = baseAngle + t * MULTIBALL_SPREAD;
      state.balls.push({
        x: ref.x,
        y: ref.y,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        r: BALL.size / 2,
        stuck: false,
      });
    }
  }

  function spawnParticles(br: Brick) {
    if (state.particles.length >= PARTICLE_MAX) return;
    const cx = br.x + br.w / 2;
    const cy = br.y + br.h / 2;
    for (let i = 0; i < PARTICLES_PER_BRICK; i++) {
      state.particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() * 2 - 1) * PARTICLE_VX_MAX,
        vy: PARTICLE_VY_MIN + Math.random() * (PARTICLE_VY_MAX - PARTICLE_VY_MIN),
        size: PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN),
        color: br.color,
        born: now,
      });
    }
  }

  function updateParticles(dt: number) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      if (now - p.born >= PARTICLE_LIFE) {
        state.particles.splice(i, 1);
        continue;
      }
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function spawnFlash(br: Brick) {
    state.flashes.push({ x: br.x, y: br.y, w: br.w, h: br.h, born: now });
  }

  function spawnPopup(br: Brick, points: number) {
    state.popups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, text: "+" + points, born: now });
  }

  function spawnNotice(text: string) {
    state.popups.push({
      x: CANVAS_W / 2,
      y: CANVAS_H / 2 - 80,
      text,
      born: now,
      life: 1000,
      size: 34,
    });
  }

  function updatePopups() {
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const life = state.popups[i].life || POPUP_LIFE;
      if (now - state.popups[i].born >= life) state.popups.splice(i, 1);
    }
  }

  function advanceStage() {
    state.stage++;
    state.bricks = buildBricks(state.stage);
    state.stageSpeed = stageBallSpeed();
    state.buff = null;
    state.balls = [makeBall()];
    state.phase = "playing";
    stickBallToPaddle(state.balls[0]);
  }

  function resetGame() {
    state.phase = "playing";
    state.stage = 1;
    state.stageSpeed = BALL.speed;
    state.buff = null;
    state.lives = START_LIVES;
    state.score = 0;
    state.bricksDestroyed = 0;
    state.blockMilestones = 0;
    state.balls = [makeBall()];
    state.bricks = buildBricks(state.stage);
    state.particles.length = 0;
    state.popups.length = 0;
    state.flashes.length = 0;
    state.paddle.x = (CANVAS_W - PADDLE.w) / 2;
    gameOverNotified = false; // nuevo: se rearma el aviso de game over
    stickBallToPaddle(state.balls[0]);
  }

  function update(dt: number) {
    if (state.phase !== "playing") return;

    if (state.buff && now >= state.buff.until) {
      state.buff = null;
      rescaleBalls();
    }

    updatePaddle(dt);
    updateBalls(dt);
    loseBallsOffscreen();
    updateParticles(dt);
    updatePopups();

    if (state.lives <= 0) {
      state.phase = "gameover";
      // Cambio respecto al original: la plataforma es la dueña del reinicio.
      if (!gameOverNotified) {
        gameOverNotified = true;
        opts.onGameOver(state.score);
      }
    } else if (!state.bricks.some((br) => br.alive)) {
      state.phase = "stageclear";
    }
  }

  // ── Render provisional (el paso 5 lo sustituye por `render()` con sprites) ───
  function renderDebug() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const br of state.bricks) {
      if (!br.alive) continue;
      ctx.fillStyle = br.color;
      ctx.fillRect(br.x, br.y, br.w, br.h);
    }
    ctx.fillStyle = "#fff";
    const p = state.paddle;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const b of state.balls) ctx.fillRect(b.x - b.r, b.y - b.r, BALL.size, BALL.size);
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `Vidas ${state.lives}  Nivel ${state.stage}  Score ${state.score}  [${state.phase}]`,
      12,
      12,
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    if (state.phase === "stageclear") {
      advanceStage();
      return;
    }
    if (state.phase === "gameover") return; // sin reinicio por tecla: lo hace el modal
    if (e.code === "ArrowLeft") state.input.left = true;
    if (e.code === "ArrowRight") state.input.right = true;
    if (e.code === "Space") launchBall();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") state.input.left = false;
    if (e.code === "ArrowRight") state.input.right = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    state.input.mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  };
  const onClick = () => {
    if (state.phase === "stageclear") {
      advanceStage();
      return;
    }
    if (state.phase === "gameover") return; // sin reinicio por click
    launchBall();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("click", onClick);

  // ── Loop ───────────────────────────────────────────────────────────────────
  const loop = (ts: number) => {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    now += dt * 1000;
    update(dt);
    renderDebug(); // paso 5: render()
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null) return;
    lastTime = null; // evita un salto de `dt` al reanudar
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

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
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    },
  };
}
