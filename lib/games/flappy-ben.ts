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

  // ── Atlas ──────────────────────────────────────────────────────────────────
  // El loop no arranca hasta que la imagen está lista (evita `drawImage` sobre
  // una imagen sin decodificar).
  const img = new Image();
  let imgReady = false;
  img.onload = () => {
    imgReady = true;
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
    /* placeholder: la física de aleteo se implementa en el paso "Lógica de partida" */
  }

  // ── Draw (placeholder) ────────────────────────────────────────────────────
  function draw() {
    if (imgReady) {
      ctx.drawImage(
        img,
        ATLAS.background.x,
        ATLAS.background.y,
        ATLAS.background.w,
        ATLAS.background.h,
        0,
        0,
        W,
        H,
      );
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;

  const loop = () => {
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null) return;
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
