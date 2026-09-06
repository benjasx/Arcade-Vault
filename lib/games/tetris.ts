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

// ── Tipos del port (las matrices de `game.js` no tenían tipo) ─────────────────
/** 0 = celda vacía; 1–12 = índice en COLORS/PIECES. */
type Cell = number;
/** Tablero ROWS × COLS. */
type Board = Cell[][];
/** Rejilla de comodines "tinte" ROWS × COLS. */
type WildcardGrid = boolean[][];
type PowerupType = "bomb" | "lightning" | "dye" | "gravity" | "freeze";
interface Piece {
  /** Tipo 1–12; 0 si es pieza de power-up. */
  type: number;
  powerup?: PowerupType;
  shape: number[][];
  x: number;
  y: number;
}

// ── Constantes (port literal de game.js) ─────────────────────────────────────
const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - blue
  "#ffb74d", // L - orange
  "#f06292", // + (plus) - rosa
  "#aed581", // U - verde claro
  "#9575cd", // Y - violeta
  "#fff59d", // single (1x1) - amarillo claro
  "#78909c", // 3x3 hueco - gris
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [0, 8, 0],
    [8, 8, 8],
    [0, 8, 0],
  ], // + pentominó
  [
    [9, 0, 9],
    [9, 9, 9],
  ], // U pentominó
  [
    [0, 10],
    [10, 10],
    [0, 10],
    [0, 10],
  ], // Y pentominó
  [[11]], // 1x1 (recompensa tras Tetris)
  [
    [12, 12, 12],
    [12, 0, 12],
    [12, 12, 12],
  ], // 3x3 hueco (reto)
];

const SINGLE_TYPE = 11;
const HOLLOW_TYPE = 12;
const PENTOMINO_TYPES = [8, 9, 10];
const CHALLENGE_CHANCE = 0.05; // probabilidad de pieza 3x3 hueca
const PENTOMINO_CHANCE = 0.12; // probabilidad de pentominó (+, U, Y)

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [0, 800, 1200, 1600]; // T-spin single/double/triple × nivel
const TSPIN_LABELS = ["", "SINGLE", "DOUBLE", "TRIPLE"];
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // × nivel
const B2B_TETRIS_BONUS = 0.5; // +50% al encadenar tetris consecutivos

const POWERUP_TYPES: PowerupType[] = ["bomb", "lightning", "dye", "gravity", "freeze"];
const POWERUP_INFO: Record<PowerupType, { symbol: string; color: string; label: string }> = {
  bomb: { symbol: "💣", color: "#ff7043", label: "BOMBA" },
  lightning: { symbol: "⚡", color: "#fff176", label: "RAYO" },
  dye: { symbol: "🎨", color: "#ba68c8", label: "TINTE" },
  gravity: { symbol: "⬇️", color: "#78909c", label: "GRAVEDAD" },
  freeze: { symbol: "❄️", color: "#4fc3f7", label: "CONGELAR" },
};
const POWERUP_INTERVAL = 5; // líneas despejadas entre apariciones de pieza especial
const POWERUP_SCORE = 250;
const FREEZE_MS = 5000;

// ── Utilidades puras (sin estado de partida) ─────────────────────────────────
function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

function createWildcardGrid(): WildcardGrid {
  return Array.from({ length: ROWS }, () => new Array<boolean>(COLS).fill(false));
}

function randomPiece(forcePowerup: boolean, forceSingle: boolean): Piece {
  if (forcePowerup) {
    const powerup = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const shape = [
      [1, 1],
      [1, 1],
    ];
    return { type: 0, powerup, shape, x: Math.floor(COLS / 2) - 1, y: 0 };
  }
  let type: number;
  if (forceSingle) {
    type = SINGLE_TYPE;
  } else {
    const roll = Math.random();
    if (roll < CHALLENGE_CHANCE) {
      type = HOLLOW_TYPE;
    } else if (roll < CHALLENGE_CHANCE + PENTOMINO_CHANCE) {
      type = PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)];
    } else {
      type = Math.floor(Math.random() * 7) + 1;
    }
  }
  const shape = PIECES[type]!.map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// ── Render ──────────────────────────────────────────────────────────────────
const BOARD_BG = "#0b0e13";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const BLOCK_HIGHLIGHT = "rgba(255, 255, 255, 0.3)"; // bisel superior + símbolo (antes CSS `--block-highlight`)

/** Renderizador único de bloque (game.js tenía 4 skins; aquí solo el estilo "retro"). */
function drawBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha: number,
  options?: { color?: string; symbol?: string },
) {
  if (!colorIndex) return;
  const color = options?.color || COLORS[colorIndex] || "#888";
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = BLOCK_HIGHLIGHT;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (options?.symbol) {
    context.fillStyle = BLOCK_HIGHLIGHT;
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(options.symbol, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

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
  // WebAudio sintetizado (sin assets). El AudioContext se abre de forma perezosa
  // en el primer sonido (línea limpiada tras un keydown) para cumplir la política
  // de autoplay.
  let audioCtx: AudioContext | null = null;

  function getAudioCtx(): AudioContext {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    delay = 0,
    gainValue = 0.15,
  ) {
    const ac = getAudioCtx();
    if (ac.state === "suspended") void ac.resume();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const startTime = ac.currentTime + delay;
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function playComboSound(comboCount: number) {
    playTone(440 + Math.min(comboCount, 10) * 60, 0.15);
  }

  function playTSpinSound() {
    playTone(660, 0.1);
    playTone(880, 0.12, "square", 0.08);
  }

  function playB2BSound() {
    playTone(330, 0.12);
    playTone(660, 0.15, "square", 0.1);
  }

  function playPerfectClearSound() {
    [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.18, "triangle", i * 0.09, 0.18));
  }

  // ── Estado de la partida (antes `let` a nivel de módulo en game.js) ─────────
  let board: Board = createBoard();
  let wildcard: WildcardGrid = createWildcardGrid();
  let current: Piece = randomPiece(false, false);
  let next: Piece = randomPiece(false, false);
  let lastActionWasRotate = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  const startLevel = 1; // fijo: se podó el selector de nivel inicial del original
  let paused = false;
  let gameOver = false;
  // Garantiza una única llamada a `opts.onGameOver` por partida.
  let gameOverNotified = false;
  let dropAccum = 0;
  let dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  let freezeRemaining = 0;
  let linesSincePowerup = 0;
  let pendingPowerup = false;
  let pendingSingle = false;
  let combo = 0;
  let b2bTetrisActive = false;

  // Popup transitorio de combo / T-spin: se dibuja en la franja superior del
  // canvas del tablero con fade corto (~900 ms). Detalle de render en el paso 6.
  let popupLines: string[] = [];
  let popupGained = 0;
  let popupShownAt = 0;

  // ── HUD escalar → plataforma ───────────────────────────────────────────────
  function powerupStatusText(): string {
    if (freezeRemaining > 0) return `❄️ ${(freezeRemaining / 1000).toFixed(1)}s`;
    if (next.powerup) {
      const info = POWERUP_INFO[next.powerup];
      return `${info.symbol} ${info.label}`;
    }
    return `${POWERUP_INTERVAL - linesSincePowerup} líneas`;
  }

  function emitStats() {
    opts.onStats({ score, lines, level, powerupLabel: powerupStatusText() });
  }

  function showComboPopup(messages: string[], gained: number) {
    popupLines = messages;
    popupGained = gained;
    popupShownAt = performance.now();
  }

  // ── Utilidades con estado de partida (port literal de game.js) ─────────────
  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        lastActionWasRotate = true;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function countWildcards(): number {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (wildcard[r][c]) n++;
    return n;
  }

  function consumeWildcards(n: number) {
    let remaining = n;
    for (let r = 0; r < ROWS && remaining > 0; r++)
      for (let c = 0; c < COLS && remaining > 0; c++)
        if (wildcard[r][c]) {
          wildcard[r][c] = false;
          remaining--;
        }
  }

  function removeRow(r: number) {
    board.splice(r, 1);
    board.unshift(new Array<Cell>(COLS).fill(0));
    wildcard.splice(r, 1);
    wildcard.unshift(new Array<boolean>(COLS).fill(false));
  }

  function isFilledOrWall(r: number, c: number): boolean {
    return r < 0 || r >= ROWS || c < 0 || c >= COLS || !!board[r][c];
  }

  function detectTSpin(): boolean {
    if (!current || current.type !== 3 || !lastActionWasRotate) return false;
    const cx = current.x + 1;
    const cy = current.y + 1; // centro de la caja 3x3 de la T
    const corners = [
      isFilledOrWall(cy - 1, cx - 1),
      isFilledOrWall(cy - 1, cx + 1),
      isFilledOrWall(cy + 1, cx - 1),
      isFilledOrWall(cy + 1, cx + 1),
    ];
    return corners.filter(Boolean).length >= 3;
  }

  function isBoardEmpty(): boolean {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) return false;
    return true;
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function powerupCenter(): { cx: number; cy: number } {
    const shape = current.shape;
    return {
      cx: current.x + Math.floor(shape[0].length / 2),
      cy: current.y + Math.floor(shape.length / 2),
    };
  }

  function clearCell(r: number, c: number) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    board[r][c] = 0;
    wildcard[r][c] = false;
  }

  // ── Lógica de partida (port literal de game.js) ───────────────────────────
  function clearLines() {
    const wasTSpin = detectTSpin();
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      const emptyCount = board[r].filter((v) => v === 0).length;
      // fila con huecos: se completa gastando comodines "tinte" de cualquier parte del tablero
      const wildcardAssist = emptyCount > 0 && emptyCount < COLS && countWildcards() >= emptyCount;
      if (emptyCount === 0 || wildcardAssist) {
        if (wildcardAssist) consumeWildcards(emptyCount);
        removeRow(r);
        cleared++;
        r++;
      }
    }

    if (!cleared) {
      combo = 0;
      return;
    }

    lines += cleared;
    combo++;
    const messages: string[] = [];
    let gained = wasTSpin ? TSPIN_SCORES[cleared] * level : LINE_SCORES[cleared] * level;

    if (wasTSpin) {
      messages.push(`T-SPIN ${TSPIN_LABELS[cleared]}!`);
      playTSpinSound();
    }

    if (cleared === 4) {
      if (b2bTetrisActive) {
        gained += Math.floor(gained * B2B_TETRIS_BONUS);
        messages.push("B2B TETRIS!");
        playB2BSound();
      }
      b2bTetrisActive = true;
    } else {
      b2bTetrisActive = false;
    }

    if (combo > 1) {
      gained *= combo;
      messages.push(`COMBO x${combo}`);
      playComboSound(combo);
    }

    const perfectClear = isBoardEmpty();
    if (perfectClear) {
      gained += PERFECT_CLEAR_SCORES[cleared] * level;
      messages.push("PERFECT CLEAR!");
      playPerfectClearSound();
    }

    score += gained;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    linesSincePowerup += cleared;
    if (linesSincePowerup >= POWERUP_INTERVAL) {
      linesSincePowerup -= POWERUP_INTERVAL;
      pendingPowerup = true;
    }
    if (cleared === 4) {
      pendingSingle = true;
    }
    if (messages.length) showComboPopup(messages, gained);
    emitStats();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastActionWasRotate = false;
      score += 1;
      emitStats();
    } else {
      lockPiece();
    }
  }

  // ── Power-ups (port literal) ──────────────────────────────────────────────
  function applyBomb() {
    const { cx, cy } = powerupCenter();
    for (let r = cy - 1; r <= cy + 1; r++) for (let c = cx - 1; c <= cx + 1; c++) clearCell(r, c);
  }

  function applyLightning() {
    const { cx, cy } = powerupCenter();
    for (let c = 0; c < COLS; c++) clearCell(cy, c);
    for (let r = 0; r < ROWS; r++) clearCell(r, cx);
  }

  function applyDye() {
    const present = new Set<number>();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (board[r][c]) present.add(board[r][c]);
    if (present.size === 0) return;
    const colors = [...present];
    const target = colors[Math.floor(Math.random() * colors.length)];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (board[r][c] === target) wildcard[r][c] = true;
  }

  function applyGravityPowerup() {
    for (let c = 0; c < COLS; c++) {
      const colorStack: number[] = [];
      const wildStack: boolean[] = [];
      for (let r = 0; r < ROWS; r++) {
        if (board[r][c] !== 0) {
          colorStack.push(board[r][c]);
          wildStack.push(wildcard[r][c]);
        }
      }
      for (let r = 0; r < ROWS; r++) {
        board[r][c] = 0;
        wildcard[r][c] = false;
      }
      const startRow = ROWS - colorStack.length;
      for (let i = 0; i < colorStack.length; i++) {
        board[startRow + i][c] = colorStack[i];
        wildcard[startRow + i][c] = wildStack[i];
      }
    }
  }

  function applyFreeze() {
    freezeRemaining = FREEZE_MS;
  }

  function applyPowerup(type: PowerupType) {
    switch (type) {
      case "bomb":
        applyBomb();
        break;
      case "lightning":
        applyLightning();
        break;
      case "dye":
        applyDye();
        break;
      case "gravity":
        applyGravityPowerup();
        break;
      case "freeze":
        applyFreeze();
        break;
    }
    score += POWERUP_SCORE;
  }

  function lockPiece() {
    if (current.powerup) {
      applyPowerup(current.powerup);
    } else {
      merge();
    }
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece(pendingPowerup, pendingSingle);
    pendingPowerup = false;
    pendingSingle = false;
    lastActionWasRotate = false;
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
    emitStats();
  }

  function endGame() {
    gameOver = true;
    stopLoop();
    draw();
    if (!gameOverNotified) {
      gameOverNotified = true;
      opts.onGameOver(score);
    }
  }

  function initGame() {
    board = createBoard();
    wildcard = createWildcardGrid();
    score = 0;
    lines = 0;
    level = startLevel;
    paused = false;
    gameOver = false;
    gameOverNotified = false;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    dropAccum = 0;
    linesSincePowerup = 0;
    pendingPowerup = false;
    pendingSingle = false;
    freezeRemaining = 0;
    combo = 0;
    b2bTetrisActive = false;
    lastActionWasRotate = false;
    popupLines = [];
    next = randomPiece(false, false);
    spawn();
    emitStats();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  // Franja superior con los mensajes de combo / T-spin; fondo semitransparente y
  // fade de ~900 ms (sustituye al `#combo-popup` del DOM del original).
  const POPUP_MS = 900;
  function drawPopupStrip() {
    if (!popupLines.length) return;
    const elapsed = performance.now() - popupShownAt;
    if (elapsed >= POPUP_MS) {
      popupLines = [];
      return;
    }
    const t = elapsed / POPUP_MS;
    const alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
    const lineH = 20;
    const bandH = 14 + (popupLines.length + 1) * lineH;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, BOARD_W, bandH);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#4dd0e1";
    popupLines.forEach((m, i) => ctx.fillText(m, BOARD_W / 2, 14 + lineH / 2 + i * lineH));
    ctx.fillStyle = "#ffd54f";
    ctx.fillText(
      `+${popupGained.toLocaleString("es-ES")}`,
      BOARD_W / 2,
      14 + lineH / 2 + popupLines.length * lineH,
    );
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK, 1, wildcard[r][c] ? { symbol: "★" } : undefined);

    drawPopupStrip();

    if (gameOver) return;

    const powerupOptions = current.powerup
      ? {
          color: POWERUP_INFO[current.powerup].color,
          symbol: POWERUP_INFO[current.powerup].symbol,
        }
      : undefined;

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2, powerupOptions);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK,
            1,
            powerupOptions,
          );
  }

  function drawNext() {
    const NB = 30;
    nextCtx.fillStyle = BOARD_BG;
    nextCtx.fillRect(0, 0, NEXT_W, NEXT_H);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    const powerupOptions = next.powerup
      ? { color: POWERUP_INFO[next.powerup].color, symbol: POWERUP_INFO[next.powerup].symbol }
      : undefined;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, powerupOptions);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  // Sin pausa interna con `P` / `Esc`: solo el botón PAUSA de la plataforma.
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) {
          current.x--;
          lastActionWasRotate = false;
        }
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) {
          current.x++;
          lastActionWasRotate = false;
        }
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    emitStats();
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const loop = (ts: number) => {
    // `dt` capado a 50 ms (el original no lo capaba).
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (freezeRemaining > 0) {
      const before = freezeRemaining;
      freezeRemaining = Math.max(0, freezeRemaining - dt);
      // re-emite el HUD solo al cambiar las décimas mostradas (o al terminar)
      if (Math.ceil(before / 100) !== Math.ceil(freezeRemaining / 100)) emitStats();
    } else {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
          lastActionWasRotate = false;
        } else {
          lockPiece();
        }
      }
    }

    draw();
    if (gameOver) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null) return;
    lastTime = null; // evita un salto de `dt` (y del contador de freeze) al reanudar
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
    pause: () => {
      paused = true;
      stopLoop();
    },
    resume: () => {
      paused = false;
      startLoop();
    },
    restart: () => {
      initGame();
      paused = false;
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
