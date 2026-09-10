// ===== lib/games/flappy-ben.ts — controlador imperativo de Flappy-Ben =====
//
// Juego escrito desde cero (SPEC 10): `references/started-games/06-FlappyBer/`
// no trae `game.js`, solo un atlas de sprites (`map.js` + `spritesheets.jpg`).
// La mecánica, física y estado se implementan aquí directamente, guiados por
// las coordenadas de ese atlas (portadas a `ATLAS` más abajo).
//
// No importa React ni JSX. Solo toca `window`/DOM a través del `canvas` que se
// le pasa a `createFlappyBenGame`.

export interface FlappyBenOptions {
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
}

export interface FlappyBenHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`initGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente y quita los listeners de teclado/ratón. */
  destroy: () => void;
}

// Coordenadas internas fijas (no responsive); se escala por CSS en el componente.
const W = 480;
const H = 720;

interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Subconjunto de `window.FLAPPY_ATLAS` (references/started-games/06-FlappyBer/map.js)
// portado como const tipada. `map.js` depende de un global de `window`, incompatible
// con un módulo TS puro sin scope global.
const ATLAS: {
  src: string;
  bird: Record<"flapping" | "resting" | "gliding", SpriteRect>;
  pipe: Record<"top" | "bottom", SpriteRect>;
  background: SpriteRect;
  ground: SpriteRect;
  numbers: Record<string, SpriteRect>;
} = {
  src: "/flappy-ben/sprite-sheet.jpg",
  bird: {
    flapping: { x: 35, y: 70, w: 65, h: 65 },
    resting: { x: 135, y: 70, w: 65, h: 65 },
    gliding: { x: 235, y: 70, w: 65, h: 65 },
  },
  pipe: {
    top: { x: 140, y: 460, w: 85, h: 160 },
    bottom: { x: 30, y: 460, w: 85, h: 160 },
  },
  background: { x: 800, y: 90, w: 1080, h: 220 },
  ground: { x: 800, y: 640, w: 680, h: 100 },
  numbers: {
    "0": { x: 30, y: 840, w: 32, h: 45 },
    "1": { x: 75, y: 840, w: 32, h: 45 },
    "2": { x: 120, y: 840, w: 32, h: 45 },
    "3": { x: 165, y: 840, w: 32, h: 45 },
    "4": { x: 210, y: 840, w: 32, h: 45 },
    "5": { x: 255, y: 840, w: 32, h: 45 },
    "6": { x: 300, y: 840, w: 32, h: 45 },
    "7": { x: 345, y: 840, w: 32, h: 45 },
    "8": { x: 120, y: 900, w: 32, h: 45 },
    "9": { x: 165, y: 900, w: 32, h: 45 },
  },
};

// ── Física y mundo ────────────────────────────────────────────────────────────
const GRAVITY = 1500; // px/s²
const FLAP_IMPULSE = -430; // px/s, impulso instantáneo (no acumulativo)
const MAX_FALL_SPEED = 650; // px/s, velocidad terminal
const FLAP_POSE_DURATION = 0.12; // s que se muestra la pose "flapping" tras aletear

const BIRD_X = W * 0.3; // posición horizontal fija; el mundo se desplaza, no el pájaro
const BIRD_DRAW = 56; // tamaño de dibujo del sprite (recorte de 65×65 del atlas)
const BIRD_HITBOX = 40; // hitbox más pequeña que el sprite: colisión menos injusta

const GROUND_H = 90; // alto de la franja de suelo dibujada y línea de colisión inferior
const PIPE_WIDTH = 85; // ancho de tubería (nativo del atlas)
const PIPE_GAP = 190; // hueco vertical del par de tuberías
const PIPE_MARGIN = 90; // separación mínima del hueco respecto a techo/suelo
const PIPE_SPEED = 170; // px/s
const PIPE_SPAWN_INTERVAL = 1.5; // s entre pares de tuberías
const BG_SPEED = PIPE_SPEED * 0.25; // parallax: el fondo se mueve más lento que las tuberías

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface Pipe {
  x: number;
  gapY: number; // centro del hueco
  passed: boolean;
}

type GameState = "playing" | "dead" | "gameover";

export function createFlappyBenGame(
  canvas: HTMLCanvasElement,
  opts: FlappyBenOptions,
): FlappyBenHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createFlappyBenGame: opts.onGameOver debe ser una función");
  }

  canvas.width = W;
  canvas.height = H;
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("createFlappyBenGame: contexto 2d no disponible");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const floorY = H - GROUND_H;

  // ── Atlas ──────────────────────────────────────────────────────────────────
  // El loop no arranca hasta que la imagen está lista (evita `drawImage` sobre
  // una imagen sin decodificar); mientras tanto se pinta un fondo negro.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const img = new Image();
  let imgReady = false;
  img.onload = () => {
    imgReady = true;
    startLoop();
  };
  img.src = ATLAS.src;

  // ── Input ──────────────────────────────────────────────────────────────────
  // Aletear es una acción instantánea (fija la velocidad vertical, no la
  // acumula), así que no hace falta distinguir tecla mantenida de flanco.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      flap();
    }
  };
  const onKeyUp = () => {
    /* aletear no tiene estado que soltar; el listener solo existe para simetría
       con keydown y para que destroy() lo pueda desregistrar */
  };
  const onCanvasFlap = () => flap();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousedown", onCanvasFlap);
  canvas.addEventListener("click", onCanvasFlap);

  function flap() {
    if (state !== "playing") return;
    bird.vy = FLAP_IMPULSE;
    flapTimer = FLAP_POSE_DURATION;
  }

  // ── Estado de la partida ───────────────────────────────────────────────────
  let bird = { x: BIRD_X, y: H / 2, vy: 0 };
  let pipes: Pipe[] = [];
  let score = 0;
  let state: GameState = "playing";
  let spawnTimer = 0;
  let flapTimer = 0;
  let bgOffset = 0;
  let groundOffset = 0;
  // Garantiza una única llamada a `opts.onGameOver` por partida.
  let gameOverNotified = false;

  function spawnPipe() {
    const minCenter = PIPE_MARGIN + PIPE_GAP / 2;
    const maxCenter = floorY - PIPE_MARGIN - PIPE_GAP / 2;
    pipes.push({ x: W, gapY: rand(minCenter, maxCenter), passed: false });
  }

  function initGame() {
    bird = { x: BIRD_X, y: H / 2, vy: 0 };
    pipes = [];
    score = 0;
    state = "playing";
    spawnTimer = 0;
    flapTimer = 0;
    bgOffset = 0;
    groundOffset = 0;
    gameOverNotified = false;
  }

  function collidesWithPipe(p: Pipe): boolean {
    const box: Rect = {
      x: bird.x - BIRD_HITBOX / 2,
      y: bird.y - BIRD_HITBOX / 2,
      w: BIRD_HITBOX,
      h: BIRD_HITBOX,
    };
    const gapTop = p.gapY - PIPE_GAP / 2;
    const gapBottom = p.gapY + PIPE_GAP / 2;
    const top: Rect = { x: p.x, y: 0, w: PIPE_WIDTH, h: gapTop };
    const bottom: Rect = { x: p.x, y: gapBottom, w: PIPE_WIDTH, h: floorY - gapBottom };
    return rectsIntersect(box, top) || rectsIntersect(box, bottom);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") return;

    if (flapTimer > 0) flapTimer = Math.max(0, flapTimer - dt);

    if (state === "playing") {
      bgOffset += BG_SPEED * dt;
      groundOffset += PIPE_SPEED * dt;

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnPipe();
        spawnTimer = PIPE_SPAWN_INTERVAL;
      }

      for (const p of pipes) p.x -= PIPE_SPEED * dt;
      pipes = pipes.filter((p) => p.x + PIPE_WIDTH > 0);

      for (const p of pipes) {
        if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
          p.passed = true;
          score++;
        }
      }
    }

    bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL_SPEED);
    bird.y += bird.vy * dt;

    const hitTop = bird.y - BIRD_HITBOX / 2 <= 0;
    const hitFloor = bird.y + BIRD_HITBOX / 2 >= floorY;

    if (state === "playing" && (hitTop || hitFloor || pipes.some(collidesWithPipe))) {
      state = "dead";
    }

    if (state === "dead" && hitFloor) {
      bird.y = floorY - BIRD_HITBOX / 2;
      state = "gameover";
      if (!gameOverNotified) {
        gameOverNotified = true;
        opts.onGameOver(score);
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  /** Dibuja una tira del atlas escalada a `destH` y repetida para cubrir `W` con scroll. */
  function drawTiledStrip(rect: SpriteRect, offsetPx: number, destY: number, destH: number) {
    const scale = destH / rect.h;
    const destW = rect.w * scale;
    const x = -(((offsetPx % destW) + destW) % destW);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, x, destY, destW, destH);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, x + destW, destY, destW, destH);
  }

  function drawPipes() {
    for (const p of pipes) {
      const gapTop = p.gapY - PIPE_GAP / 2;
      const gapBottom = p.gapY + PIPE_GAP / 2;
      const topRect = ATLAS.pipe.top;
      ctx.drawImage(img, topRect.x, topRect.y, topRect.w, topRect.h, p.x, 0, PIPE_WIDTH, gapTop);
      const bottomRect = ATLAS.pipe.bottom;
      ctx.drawImage(
        img,
        bottomRect.x,
        bottomRect.y,
        bottomRect.w,
        bottomRect.h,
        p.x,
        gapBottom,
        PIPE_WIDTH,
        floorY - gapBottom,
      );
    }
  }

  const NUM_DRAW_W = 26;
  const NUM_DRAW_H = 36;
  const NUM_GAP = 4;

  function drawScore() {
    const digits = String(score).split("");
    const totalW = digits.length * NUM_DRAW_W + (digits.length - 1) * NUM_GAP;
    let x = W / 2 - totalW / 2;
    const y = 28;
    for (const ch of digits) {
      const rect = ATLAS.numbers[ch];
      if (rect) ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, x, y, NUM_DRAW_W, NUM_DRAW_H);
      x += NUM_DRAW_W + NUM_GAP;
    }
  }

  function draw() {
    if (!imgReady) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    drawTiledStrip(ATLAS.background, bgOffset, 0, H);
    drawPipes();
    drawTiledStrip(ATLAS.ground, groundOffset, floorY, GROUND_H);

    const pose = flapTimer > 0 ? "flapping" : "gliding";
    const sprite = ATLAS.bird[pose];
    ctx.drawImage(
      img,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h,
      bird.x - BIRD_DRAW / 2,
      bird.y - BIRD_DRAW / 2,
      BIRD_DRAW,
      BIRD_DRAW,
    );

    drawScore();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const loop = (ts: number) => {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null || !imgReady) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

  return {
    pause: stopLoop,
    resume: startLoop,
    restart: () => {
      initGame();
      startLoop();
    },
    destroy: () => {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onCanvasFlap);
      canvas.removeEventListener("click", onCanvasFlap);
    },
  };
}
