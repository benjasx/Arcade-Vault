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

// Coordenadas internas fijas 1:1 (no responsive); se escala por CSS en el componente.
const W = 528;
const H = 528;

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

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

  // ── Input ──────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (_e: KeyboardEvent) => {};
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function resetGame() {
    // TODO (paso 3): inicializar snake, dir, food, score, stepMs, acc.
  }

  function render() {
    ctx.fillStyle = "#04040a";
    ctx.fillRect(0, 0, W, H);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const loop = (time: number) => {
    lastTime = time;
    render();
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

  resetGame();
  render();
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
