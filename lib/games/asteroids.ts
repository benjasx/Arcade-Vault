// ===== lib/games/asteroids.ts — controlador imperativo del juego de asteroides =====
//
// Port TS de `references/started-games/02-asteroides/game.js` a un controlador con
// ciclo de vida (crear / pausar / reanudar / reiniciar / destruir) y un único
// callback hacia la plataforma: `onGameOver(finalScore)`.
//
// No importa React ni JSX. Solo toca `window`/DOM a través del `canvas` que se le
// pasa a `createAsteroidsGame`. El estado del juego —a nivel de módulo en el
// original— vive en el cierre de `createAsteroidsGame`.

export interface AsteroidsOptions {
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`initGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente y quita los listeners de teclado. */
  destroy: () => void;
}

// Coordenadas internas fijas (no responsive); se escala por CSS en el componente.
const W = 800;
const H = 600;

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  opts: AsteroidsOptions,
): AsteroidsHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createAsteroidsGame: opts.onGameOver debe ser una función");
  }

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createAsteroidsGame: contexto 2d no disponible");
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const update = (dt: number) => {
    // La lógica de partida (entidades, colisiones, niveles, power-ups y la
    // notificación de game over) se porta en pasos posteriores. Por ahora solo
    // se drena el input de borde para no acumular pulsaciones entre frames.
    void dt;
    for (const code of Object.keys(justPressed)) justPressed[code] = false;
  };

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
  };

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
      // `initGame()` se añade en el Paso 4; de momento solo reanuda el loop.
      startLoop();
    },
    destroy: () => {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
