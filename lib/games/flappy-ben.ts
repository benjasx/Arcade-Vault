// ===== lib/games/flappy-ben.ts — controlador imperativo de Flappy-Ben =====
//
// Juego escrito desde cero (SPEC 10). `references/started-games/06-FlappyBer/`
// no trae `game.js`; solo traía un atlas de sprites (`map.js` + `spritesheets.jpg`)
// cuyas coordenadas resultaron "estimadas" (según su propia cabecera) y no
// correspondían al archivo real — recortaban trozos ilegibles de una hoja de
// referencia. Por eso el juego se dibuja con formas vectoriales en canvas
// (mismo enfoque que `lib/games/asteroids.ts`), no con sprites.
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
// Paisaje 4:3 (igual que asteroides): más ancho que alto, reutiliza el
// `.crt-screen` por defecto sin letterbox lateral.
const W = 800;
const H = 600;

// ── Paleta neón del portal (app/globals.css :root) ───────────────────────────
const COLOR_CYAN = "#00f5ff";
const COLOR_MAGENTA = "#ff006e";
const COLOR_YELLOW = "#f5ff00";
const COLOR_GREEN = "#00ff88";

// ── Física y mundo ────────────────────────────────────────────────────────────
const GRAVITY = 1500; // px/s²
const FLAP_IMPULSE = -430; // px/s, impulso instantáneo (no acumulativo)
const MAX_FALL_SPEED = 650; // px/s, velocidad terminal
const FLAP_POSE_DURATION = 0.12; // s que se muestra el ala en alto tras aletear

const BIRD_X = W * 0.22; // posición horizontal fija; el mundo se desplaza, no el pájaro
const BIRD_RADIUS = 20; // radio del cuerpo dibujado
const BIRD_HITBOX = 34; // hitbox más pequeña que el sprite: colisión menos injusta

const GROUND_H = 70; // alto de la franja de suelo dibujada y línea de colisión inferior
const PIPE_WIDTH = 70; // ancho de tubería
const PIPE_GAP = 170; // hueco vertical del par de tuberías
const PIPE_MARGIN = 70; // separación mínima del hueco respecto a techo/suelo
const PIPE_SPEED = 200; // px/s (algo más rápido: hay más ancho de pantalla que recorrer)
const PIPE_SPAWN_INTERVAL = 1.3; // s entre pares de tuberías
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
  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#140a24");
    grad.addColorStop(1, "#0a0a18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // rejilla de fondo con parallax lento, solo de adorno
    const spacing = 60;
    const offset = bgOffset % spacing;
    ctx.strokeStyle = COLOR_CYAN;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 1;
    for (let x = -offset; x < W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Cuerpo de tubería con un labio más ancho pegado al borde del hueco. */
  function drawPipeSegment(x: number, y: number, w: number, h: number, lipAtBottom: boolean) {
    if (h <= 0) return;
    ctx.fillStyle = "rgba(0, 255, 136, 0.16)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOR_GREEN;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLOR_GREEN;
    ctx.shadowBlur = 8;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    const lipH = 14;
    const lipY = lipAtBottom ? y + h - lipH : y;
    ctx.fillStyle = "rgba(0, 255, 136, 0.28)";
    ctx.fillRect(x - 6, lipY, w + 12, lipH);
    ctx.strokeRect(x - 5, lipY + 1, w + 10, lipH - 2);
    ctx.shadowBlur = 0;
  }

  function drawPipes() {
    for (const p of pipes) {
      const gapTop = p.gapY - PIPE_GAP / 2;
      const gapBottom = p.gapY + PIPE_GAP / 2;
      drawPipeSegment(p.x, 0, PIPE_WIDTH, gapTop, true);
      drawPipeSegment(p.x, gapBottom, PIPE_WIDTH, floorY - gapBottom, false);
    }
  }

  function drawGround() {
    ctx.fillStyle = "#141428";
    ctx.fillRect(0, floorY, W, GROUND_H);

    ctx.strokeStyle = COLOR_GREEN;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLOR_GREEN;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // marcas diagonales que se desplazan para dar sensación de movimiento
    const tick = 26;
    const offset = groundOffset % tick;
    ctx.strokeStyle = "rgba(0, 255, 136, 0.35)";
    ctx.lineWidth = 2;
    for (let x = -offset; x < W + tick; x += tick) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 10);
      ctx.lineTo(x - 10, floorY + GROUND_H - 6);
      ctx.stroke();
    }
  }

  function drawBird() {
    const flapping = flapTimer > 0;
    ctx.save();
    ctx.translate(bird.x, bird.y);

    ctx.shadowColor = COLOR_YELLOW;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLOR_YELLOW;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ala
    ctx.fillStyle = "#c98a00";
    ctx.beginPath();
    ctx.ellipse(-4, flapping ? -6 : 4, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // pico
    ctx.fillStyle = "#ff8c1a";
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 4, -4);
    ctx.lineTo(BIRD_RADIUS + 9, 0);
    ctx.lineTo(BIRD_RADIUS - 4, 4);
    ctx.closePath();
    ctx.fill();

    // ojo
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(6, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(8, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawScore() {
    ctx.textAlign = "center";
    ctx.font = "bold 30px monospace";
    ctx.shadowColor = COLOR_MAGENTA;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fff";
    ctx.fillText(String(score), W / 2, 48);
    ctx.shadowBlur = 0;
  }

  function draw() {
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
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
    if (rafId !== null) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

  draw();
  startLoop();

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
