// ===== lib/games/tetris.ts — controlador imperativo de TETRABYTE (tetris) =====
//
// Port TS de `references/started-games/03-claude-tetris/game.js` a un controlador
// con ciclo de vida (crear / pausar / reanudar / reiniciar / destruir) y dos
// callbacks hacia la plataforma: `onGameOver(finalScore)` y `onStats(stats)`.
//
// No importa React ni JSX. Solo toca `window`/DOM a través de los dos `canvas`
// (tablero + preview NEXT) que se le pasan a `createTetrisGame`. El estado del
// juego —a nivel de módulo en el original— vive en el cierre de la factory.
//
// Diferencias respecto al original:
//   - Sin skins, sin toggle de tema claro/oscuro, sin selector de nivel inicial
//     (`startLevel` fijo a 1). El marco CRT de la plataforma es la estética.
//   - Sin reinicio propio (botón Reiniciar, pantalla de inicio, tabla de
//     highscores en el DOM): el modal de la plataforma es dueño del reinicio.
//   - Sin pausa interna con `P` / `Esc`: solo el botón PAUSA de la plataforma.
//   - El HUD escalar (`score` / `lines` / `level` / power-up) se emite por
//     `onStats`; solo tablero, ghost, preview y popups van al canvas.
//   - `dt` del loop se capa a 50 ms (el original no lo capaba).
//   - Al entrar en game over se llama `opts.onGameOver(score)` una sola vez.

export interface TetrisStats {
  score: number;
  lines: number;
  level: number;
  /** Texto del indicador de power-up: cuenta atrás de freeze, power-up en NEXT o líneas restantes. */
  powerupLabel: string;
}

export interface TetrisOptions {
  /** Segundo canvas para la preview de la siguiente pieza (120×120). */
  nextCanvas: HTMLCanvasElement;
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
  /** Se invoca tras cada cambio de score / lines / level / estado de power-up. */
  onStats: (stats: TetrisStats) => void;
}

export interface TetrisHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`initGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente, quita el listener de teclado y cierra el AudioContext. */
  destroy: () => void;
}

// Coordenadas internas fijas (no responsive); se escalan por CSS en el componente.
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600
const NEXT_W = 120;
const NEXT_H = 120;

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function createTetrisGame(canvas: HTMLCanvasElement, opts: TetrisOptions): TetrisHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createTetrisGame: opts.onGameOver debe ser una función");
  }
  if (typeof opts.onStats !== "function") {
    throw new TypeError("createTetrisGame: opts.onStats debe ser una función");
  }
  if (!opts.nextCanvas) {
    throw new Error("createTetrisGame: opts.nextCanvas es obligatorio");
  }

  canvas.width = BOARD_W;
  canvas.height = BOARD_H;
  opts.nextCanvas.width = NEXT_W;
  opts.nextCanvas.height = NEXT_H;

  const maybeCtx = canvas.getContext("2d");
  const maybeNextCtx = opts.nextCanvas.getContext("2d");
  if (!maybeCtx || !maybeNextCtx) {
    throw new Error("createTetrisGame: contexto 2d no disponible");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const nextCtx: CanvasRenderingContext2D = maybeNextCtx;

  // ── Audio ──────────────────────────────────────────────────────────────────
  // WebAudio sintetizado (sin assets). El AudioContext se abre en el primer
  // `keydown` para cumplir la política de autoplay (pasos 6).
  let audioCtx: AudioContext | null = null;

  // ── Input ──────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    // El manejo real de teclas se añade en los pasos 5–6.
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Estado de la partida ───────────────────────────────────────────────────
  // Se rellena en los pasos 4–6 (board, wildcard, current, next, score, …).

  function initGame() {
    // Reset completo de la partida; implementación en los pasos 4–6.
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = "#0b0e13";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    nextCtx.clearRect(0, 0, NEXT_W, NEXT_H);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;

  const loop = () => {
    // La física (gravedad, freeze) con `dt` capado a 50 ms se añade en los pasos 5–6.
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

  initGame();
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
      if (audioCtx) {
        void audioCtx.close();
        audioCtx = null;
      }
    },
  };
}
