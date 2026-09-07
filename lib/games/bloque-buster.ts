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

  // ── Input ──────────────────────────────────────────────────────────────────
  // El objeto `input` se convierte en parte de `state` en el paso 4.
  const input = { left: false, right: false, mouseX: null as number | null };

  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    if (e.code === "ArrowLeft") input.left = true;
    if (e.code === "ArrowRight") input.right = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") input.left = false;
    if (e.code === "ArrowRight") input.right = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  };
  const onClick = () => {
    /* paso 4: launchBall / advanceStage */
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("click", onClick);

  // ── Loop ───────────────────────────────────────────────────────────────────
  // El paso 4 añade `lastTime` y `now` (acumulador de tiempo de juego,
  // `now += min(dt, 0.05) * 1000`, no el timestamp de rAF) para que `pause()`
  // congele buff, partículas, destellos, popups y animación de rotura.
  let rafId: number | null = null;

  const loop = () => {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // paso 4: update(dt) · paso 5: render()
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

  startLoop();

  return {
    pause: stopLoop,
    resume: startLoop,
    restart: () => {
      // paso 4: resetGame()
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
