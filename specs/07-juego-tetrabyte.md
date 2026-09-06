# SPEC 07 — Segundo juego real: TETRABYTE (tetris) en la nueva entrada "tetris"

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-06
> **Objective:** Portar el tetris canvas de `references/started-games/03-claude-tetris/game.js` a un controlador imperativo TypeScript montado en un componente cliente nuevo, asociado a una entrada de catálogo nueva `tetris` (título visible TETRABYTE), con el HUD escalar en la fila `.player-hud` de la plataforma y la puntuación final guardada por el modal de fin de juego.

---

## Por qué existe esta spec

SPEC 05 portó el primer juego real (asteroides) a `lib/games/asteroids.ts` +
`components/asteroids-player.tsx`, y lo cableó a la entrada existente `rocas` con un
ternario `game.id === "rocas"` en `app/juego/[id]/jugar/page.tsx`. SPEC 06 dejó el
leaderboard real (`submit_score`, `registerPlay`, modal con sesión / CTA sin
sesión). El resto de los 8 juegos del catálogo sigue con el `GamePlayer` simulado.

El segundo juego real es el tetris de `references/started-games/03-claude-tetris/`.
Su forma actual:

- **Un único `game.js`** (983 líneas; el `CLAUDE.md` de la carpeta dice "~300",
  está desactualizado), `'use strict'`, todo el estado en variables globales de
  módulo, sin ES modules. Se carga con `<script src="game.js">` al final del body y
  se auto-arranca (`applyTheme` + `applySkin` + `showStartScreen`); el bucle
  empieza al pulsar "Jugar".
- **Dos canvas**: `#board` 300×600 (`COLS 10 × ROWS 20 × BLOCK 30`) y
  `#next-canvas` 120×120 (preview de la siguiente pieza).
- **HUD en el DOM**: ~25 ids. `#score` / `#lines` / `#level` / `#powerup-status`
  por `textContent`; `#combo-popup`, `#overlay` (game over), `#pause-overlay`,
  `#start-screen`, tabla de highscores, `#skin-select`, `#start-level`,
  `#theme-toggle` por `innerHTML` / `classList` / `style.display`. En canvas solo
  se dibujan tablero, ghost y preview.
- **Listeners** en `document` (keydown del juego) y ~10 `click` / `change` sobre
  botones del DOM. Ninguno en `window`.
- **Sin assets**: el audio es WebAudio sintetizado (`AudioContext` + `playTone`
  con osciladores). `pieza-L.png` existe en la carpeta pero no se referencia.
- **`localStorage`** propio: `theme`, `tetris-skin`, `tetris-start-level`,
  `tetris-highscores` (JSON top-5), `tetris-records-best` (JSON `{maxCombo,
maxLines}`).
- **Bucle** `loop(ts)`: `dt = ts - lastTime` en ms, **sin cap**; acumulador
  `dropAccum` vs `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Mecánicas sobre el tetris clásico**: 12 tipos de pieza (7 tetrominós +
  pentominós `+` / `U` / `Y` + pieza 1×1 de recompensa + pieza 3×3 hueca de reto),
  5 power-ups (`bomb` / `lightning` / `dye` / `gravity` / `freeze`), detección de
  T-spin con su tabla de puntuación, bonus back-to-back tetris, multiplicador de
  combo, perfect clear, celdas comodín "tinte" que completan filas con huecos, 4
  skins visuales, tema claro/oscuro y nivel inicial 1–15.

Esta spec adapta ese juego a Next.js 16 / React 19 sin reescribir su lógica: se
encapsula en un controlador imperativo con ciclo de vida (`crear` / `pausar` /
`reanudar` / `reiniciar` / `destruir`) y dos callbacks hacia la plataforma,
`onGameOver(finalScore)` y `onStats(stats)`. Un componente cliente nuevo lo monta
dentro del marco CRT y, al morir, abre el modal "FIN DEL JUEGO" para guardar la
puntuación con `submitScore` (mismo flujo que `asteroids-player.tsx`).

Como es el **segundo** juego real, esta spec introduce además el registro central
`lib/games/registry.ts` que sustituye el ternario hardcodeado y el `Set`
`PLAYABLE_GAME_IDS`, para que el tercer juego sea solo una entrada más en el mapa.

Decisiones ya cerradas con el usuario (no reabrir):

- El juego se asocia a una entrada de catálogo **nueva** `tetris`, título visible
  **TETRABYTE**, categoría `PUZZLE`, color `cyan`. **No** se reusa `caida`, que se
  queda con el `GamePlayer` simulado.
- Port a **controlador imperativo TS** (`lib/games/tetris.ts`), no reescritura en
  hooks ni carga de `game.js` casi literal.
- Se **conservan las mecánicas** (pentominós, 1×1, 3×3 hueco, los 5 power-ups,
  T-spin, back-to-back, combo, perfect clear, comodín tinte) y el balance del
  original sin cambios.
- Se **podan** las 4 skins, el toggle de tema claro/oscuro y el selector de nivel
  inicial: el marco CRT de la plataforma ya es la estética; `startLevel` queda fijo
  a 1.
- El HUD escalar (`score` / `lines` / `level` / estado de power-up) se pinta en la
  fila `.player-hud` de la plataforma vía `onStats`; tablero, ghost y preview NEXT
  se siguen dibujando **en canvas**; los popups de combo / T-spin se dibujan en la
  franja superior del canvas del tablero.
- La preview NEXT va en un **segundo `<canvas>`** (`opts.nextCanvas`), como el
  `#next-canvas` del original.
- Se **conserva el audio** WebAudio sintetizado; cero assets nuevos.
- Se **quita** el reinicio propio del juego (botón Reiniciar, pantalla de inicio,
  tabla de highscores DOM): el modal de la plataforma es el dueño del reinicio y
  del guardado.
- **No** hay pausa interna con `P` / `Esc`; el botón PAUSA de la plataforma es el
  único punto de pausa.
- El canvas mantiene **coordenadas internas 300×600** (tablero) y **120×120**
  (next) y se escala por CSS. Tetris es 1:2, no 4:3: lleva su propio bloque CSS.

---

## Scope

**In:**

- **Fuente de referencia**: los 6 archivos de
  `references/started-games/03-claude-tetris/` (`game.js`, `index.html`,
  `style.css`, `README.md`, `CLAUDE.md`, `pieza-L.png`) ya existen como archivos
  planos en `main` (no es gitlink de submódulo, a diferencia de `02-asteroides` en
  SPEC 05). **No hay paso de materialización.** Quedan como referencia de lectura;
  no entran en el build de Next ni se importan desde `app/`.
- **Registro central** `lib/games/registry.ts` (módulo nuevo):
  - `GAME_REGISTRY: Record<string, ComponentType<{ game: Game }>>` con las entradas
    `rocas: AsteroidsPlayer` y `tetris: TetrisPlayer`.
  - `playerFor(id: string): ComponentType<{ game: Game }> | null` → `GAME_REGISTRY[id] ?? null`.
  - `app/juego/[id]/jugar/page.tsx` deja de usar el ternario
    `game.id === "rocas" ? … : …` y pasa a
    `const Player = playerFor(game.id) ?? GamePlayer; return <Player game={game} />`.
  - `lib/games.ts`: `isPlayable(id)` pasa a `id in GAME_REGISTRY`; se elimina
    `PLAYABLE_GAME_IDS`.
- **Migración** `supabase/migrations/<timestamp>_tetris.sql` (aplicada también por
  MCP `apply_migration` al proyecto `mrimkuambtxtoycyfxyh`):
  - `insert into public.games (id, title, short, long, cat, cover, color, sort)`
    con `id = 'tetris'`, `title = 'TETRABYTE'`, `cat = 'PUZZLE'`,
    `cover = 'cover-tetris'`, `color = 'cyan'`, `sort = 9`, y textos `short` / `long`
    en el estilo del seed existente.
  - `insert into public.game_plays (game_id) values ('tetris') on conflict do nothing`.
  - Sin cambios de esquema: no se regenera `lib/supabase/database.types.ts`.
- **Controlador** `lib/games/tetris.ts` (módulo TS puro, sin JSX ni React):
  - `createTetrisGame(canvas: HTMLCanvasElement, opts: TetrisOptions): TetrisHandle`.
  - Port tipado de `game.js`: constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`,
    `PIECES` con los 12 tipos, `SINGLE_TYPE`, `HOLLOW_TYPE`, `PENTOMINO_TYPES`,
    `CHALLENGE_CHANCE`, `PENTOMINO_CHANCE`, `LINE_SCORES`, `TSPIN_SCORES`,
    `TSPIN_LABELS`, `PERFECT_CLEAR_SCORES`, `B2B_TETRIS_BONUS`, `POWERUP_TYPES`,
    `POWERUP_INFO`, `POWERUP_INTERVAL`, `POWERUP_SCORE`, `FREEZE_MS`); utilidades y
    lógica (`createBoard`, `createWildcardGrid`, `randomPiece`, `collide`,
    `rotateCW`, `tryRotate`, `merge`, `countWildcards`, `consumeWildcards`,
    `removeRow`, `isFilledOrWall`, `detectTSpin`, `isBoardEmpty`, `clearLines`,
    `ghostY`, `hardDrop`, `softDrop`, `powerupCenter`, `clearCell`, `applyBomb`,
    `applyLightning`, `applyDye`, `applyGravityPowerup`, `applyFreeze`,
    `applyPowerup`, `lockPiece`, `spawn`); render (`drawBlock` con un único
    renderizador de bloque, `drawGrid`, `draw`, `drawNext`, franja de popups); el
    audio (`getAudioCtx`, `playTone`, `playComboSound`, `playTSpinSound`,
    `playB2BSound`, `playPerfectClearSound`); el bucle `loop` y `initGame`.
  - El estado, hoy `let` a nivel de módulo, pasa a vivir en el cierre de
    `createTetrisGame`.
  - `create` fija `canvas.width = 300` / `canvas.height = 600` y
    `opts.nextCanvas.width = 120` / `height = 120`, valida ambos contextos 2d,
    registra `keydown` en `window` (con `preventDefault` para flechas y `Space`),
    llama `initGame()` y arranca el loop.
  - `dt` del loop se capa a 50 ms (el original no lo capaba).
  - Al entrar en game over (pieza que colisiona al aparecer): `state = "gameover"`,
    se para el rAF, y con flag `gameOverNotified` (reseteada en `initGame()`) se
    llama `opts.onGameOver(score)` una sola vez.
  - Tras cada cambio de `score` / `lines` / `level` / estado de power-up se llama
    `opts.onStats({ score, lines, level, powerupLabel })`.
  - `pause()` detiene el scheduling de rAF. `resume()` lo reanuda reseteando
    `lastTime` para evitar salto de `dt` y del contador de `freeze`. `restart()`
    llama `initGame()` y reanuda. `destroy()` cancela el rAF pendiente, quita el
    listener de teclado y cierra el `AudioContext` si se abrió.
- **Componente** `components/tetris-player.tsx` (`"use client"`):
  - Marco CRT reutilizando clases de `app/globals.css` (`.av-player`, `.crt`,
    `.crt-screen`, `.crt-bottom`), con dos `<canvas>` referenciados por `ref`
    (tablero + next).
  - Fila `.player-hud`: título del juego + `.hud-stat` para `Puntuación` /
    `Líneas` / `Nivel` / `Power-up` alimentados por `onStats`; botones
    `PAUSA` / `REANUDAR` (alterna `handle.pause()` / `handle.resume()` + estado
    local) y `SALIR` → `router.push('/juego/' + game.id)`.
  - `useEffect(() => { const h = createTetrisGame(boardRef.current!, { nextCanvas: nextRef.current!, onGameOver, onStats }); handleRef.current = h; return () => { h.destroy(); handleRef.current = null; }; }, [game.id])`.
  - `onGameOver(finalScore)` → `setFinalScore`, `setOver(true)`,
    `void registerPlay(game.id)`, y abre el modal "FIN DEL JUEGO" con el mismo
    marcado y clases que `asteroids-player.tsx` (`.modal-bd`, `.modal`, `.final`,
    `.final-label`, `.toast-saved`, `.actions`, `.spinner`): con sesión
    `await submitScore(game.id, finalScore)` + toast `▸ PUNTUACIÓN GUARDADA_`; sin
    sesión CTA "INICIA SESIÓN PARA GUARDAR" → `/login`; `JUGAR DE NUEVO` →
    `handle.restart()` + cierra modal + resetea `saved`; `VOLVER AL VAULT` →
    `/juegos`.
  - Añadir `tetris: TetrisPlayer` a `GAME_REGISTRY`.
- **Enrutado** `app/juego/[id]/jugar/page.tsx`: usa `playerFor(game.id)` del
  registro; `notFound()` si el juego no existe (sin cambios).
- **CSS** `app/globals.css`:
  - Bloque `.cover-tetris` (base oscura + `::after` con gradientes que dibujan
    tetrominós cayendo en cyan/magenta/yellow + `::before` con glifo unicode),
    junto a las demás portadas.
  - Bloque para el escalado del tablero 1:2 dentro de `.crt-screen`: fila centrada
    con el `<canvas>` del tablero a `height: 100%; width: auto` (aspect-ratio 1/2)
    y el `<canvas>` de next pequeño al lado; sin overflow horizontal en los
    breakpoints existentes. **No** se reusa `.asteroids-canvas` (es 4:3).

**Out of scope (para futuras specs):**

- Motor real para los otros 6 juegos simulados; siguen con `GamePlayer`.
- Reusar o poblar la entrada `caida` con este motor.
- Skins, toggle de tema claro/oscuro y selector de nivel inicial del original.
- Pausa interna con `P` / `Esc` (necesitaría un callback `onPause` para no
  desincronizar el estado React).
- Persistir `líneas` y `mejor combo` en el leaderboard; `submit_score` guarda solo
  `score`.
- Leaderboards con más columnas o realtime.
- Responsive real del canvas (recalcular `COLS` / `ROWS` / `BLOCK` y la física);
  solo se escala por CSS.
- Controles táctiles / móviles, vibración, `prefers-reduced-motion`.
- Cambios de balance, power-ups nuevos o tipos de pieza nuevos.
- Actualizar `best` o `plays` de `tetris` a mano en la BD (se derivan de las
  vistas).
- Tests automatizados (no hay framework configurado).

---

## Data model

Esta feature no introduce estructuras persistentes nuevas de frontend. La
persistencia de puntuaciones sigue en `public.scores` de Supabase vía el RPC
`submit_score` (SPEC 06), una fila por `(user_id, game_id)` = mejor marca.

La migración añade **una fila** a `public.games` (`id = 'tetris'`) y **una fila** a
`public.game_plays` (`game_id = 'tetris'`). Sin cambios de esquema. Las vistas
`games_with_stats`, `leaderboard` y `game_stats` recogen la fila nueva sin
tocarlas.

Formas nuevas en memoria, en `lib/games/tetris.ts`:

```ts
interface TetrisOptions {
  nextCanvas: HTMLCanvasElement;
  onGameOver: (finalScore: number) => void;
  onStats: (stats: { score: number; lines: number; level: number; powerupLabel: string }) => void;
}

interface TetrisHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

function createTetrisGame(canvas: HTMLCanvasElement, opts: TetrisOptions): TetrisHandle;
```

`onStats` de tetris no lleva `lives` (el juego no tiene vidas), a diferencia de la
forma genérica `{ score, lives, level }` de la referencia del skill.

Tipos internos del port (matrices sin tipo en `game.js`):

```ts
type Cell = number; // 0 vacía; 1–12 índice en COLORS/PIECES
type Board = Cell[][]; // ROWS × COLS
type WildcardGrid = boolean[][];
type PowerupType = "bomb" | "lightning" | "dye" | "gravity" | "freeze";
interface Piece {
  type: number; // 0 si es pieza de power-up
  powerup?: PowerupType;
  shape: number[][];
  x: number;
  y: number;
}
```

Estado interno del juego (portado de `game.js`, ahora en el cierre, sin cambios de
semántica):

```ts
// board, wildcard, current, next
// score, lines, level, startLevel (= 1, fijo)
// paused, gameOver, gameOverNotified
// lastTime, dropAccum, dropInterval
// freezeRemaining, linesSincePowerup, pendingPowerup, pendingSingle
// combo, b2bTetrisActive, lastActionWasRotate, maxCombo
// audioCtx, rafId
// COLS = 10, ROWS = 20, BLOCK = 30  (constantes; no responsive)
```

Estado local de `components/tetris-player.tsx`:

```ts
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [saved, setSaved] = useState(false);
const [busy, setBusy] = useState(false);
const [saveErr, setSaveErr] = useState<string | null>(null);
const [pending, setPending] = useState<"again" | "vault" | "login" | "exit" | null>(null);
const [stats, setStats] = useState({ score: 0, lines: 0, level: 1, powerupLabel: "" });
```

Convenciones (heredadas de SPEC 01 / 05):

- `lib/games/tetris.ts` no importa React y solo toca `window` / DOM cuando se le
  pasan los `canvas`.
- `components/tetris-player.tsx` lleva `"use client"` (usa `ref`, estado,
  `useEffect`, `useRouter`, `useAuth`).
- `lib/games/registry.ts` importa los componentes player y el tipo `Game`
  (`import type`, borrado en build); se mantiene separado de `lib/games.ts`.
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component que resuelve
  `params` y lee el juego de la tabla `games`.
- Alias `@/*` para imports (`@/lib/games/tetris`, `@/lib/games/registry`,
  `@/lib/leaderboard`).

---

## Implementation plan

1. **Registro central.** Crear `lib/games/registry.ts` con `GAME_REGISTRY`
   (`rocas: AsteroidsPlayer`) y `playerFor(id)`. Reescribir
   `app/juego/[id]/jugar/page.tsx`: quitar el ternario y el `import` de
   `AsteroidsPlayer`, usar `const Player = playerFor(game.id) ?? GamePlayer;
return <Player game={game} />`. En `lib/games.ts`, cambiar `isPlayable(id)` a
   `id in GAME_REGISTRY` y borrar `PLAYABLE_GAME_IDS`. Verificación:
   `npm run build` y `npm run lint` limpios; `/juego/rocas/jugar` sigue montando
   `AsteroidsPlayer`; `/juego/caida/jugar` y los demás siguen con `GamePlayer`;
   `/juegos`, `/` y `/salon` siguen mostrando solo `rocas`.

2. **Migración `tetris`.** Crear `supabase/migrations/<timestamp>_tetris.sql` con
   el `insert` en `public.games` (id `tetris`, title `TETRABYTE`, cat `PUZZLE`,
   cover `cover-tetris`, color `cyan`, sort `9`, textos `short` / `long` en el
   estilo del seed) y el `insert ... on conflict do nothing` en
   `public.game_plays`. Aplicar con MCP `apply_migration`. Verificación: `select`
   anónimo sobre `games` devuelve la fila `tetris`; `games_with_stats` la incluye
   con `best = 0`, `plays = 0`; un `insert` anónimo directo se rechaza por RLS.

3. **Esqueleto del controlador.** Crear `lib/games/tetris.ts` con
   `createTetrisGame(canvas, opts)`: valida `opts.onGameOver` / `opts.onStats` /
   `opts.nextCanvas`, fija `width` / `height` de ambos canvas, obtiene los dos
   contextos 2d, pinta el fondo, monta `keydown` en `window` con `preventDefault`
   para flechas y `Space`, y un bucle `requestAnimationFrame` vacío. Devuelve
   `{ pause, resume, restart, destroy }` con `destroy` quitando el listener,
   cancelando el rAF y cerrando el `AudioContext`. Verificación: `npm run lint`
   limpio; montado en prueba manual el canvas se ve; `destroy()` no deja listeners
   ni rAF colgando.

4. **Constantes, tipos y utilidades.** Portar a TS tipado dentro del módulo: los
   tipos (`Cell`, `Board`, `WildcardGrid`, `PowerupType`, `Piece`), todas las
   constantes listadas en Scope, y `createBoard`, `createWildcardGrid`,
   `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `countWildcards`,
   `consumeWildcards`, `removeRow`, `isFilledOrWall`, `detectTSpin`,
   `isBoardEmpty`, `ghostY`, `powerupCenter`, `clearCell`. Verificación:
   `npm run build` sin errores de tipos; sin uso todavía en el loop.

5. **Lógica de partida y power-ups.** Portar `clearLines` (con T-spin, B2B, combo,
   perfect clear, comodín tinte), `hardDrop`, `softDrop`, `applyBomb`,
   `applyLightning`, `applyDye`, `applyGravityPowerup`, `applyFreeze`,
   `applyPowerup`, `lockPiece`, `spawn`, e `initGame` (antes `init`; resetea
   `gameOverNotified = false`, `startLevel = 1` fijo). Cambios respecto al
   original: `endGame` → `state = "gameover"`, para el rAF, y con
   `gameOverNotified` llama `opts.onGameOver(score)` una sola vez; se eliminan
   toda la manipulación del DOM y las funciones de highscores
   (`loadHighscores` … `saveCurrentScore`, `resetRecords`, `showStartScreen`,
   `showGameOverRecords`). Tras cada mutación de HUD se llama `opts.onStats(...)`.
   Verificación: montado en prueba manual el juego es jugable de principio a fin;
   al morir dispara `onGameOver` con el score correcto y el canvas no se reinicia
   con ninguna tecla.

6. **Render, audio y loop.** Portar `drawBlock` (un único renderizador de bloque,
   sin `SKINS`), `drawGrid`, `draw`, `drawNext` (sobre `opts.nextCanvas`), la
   franja superior de popups de combo / T-spin (fondo semitransparente, fade
   ~900 ms), el audio (`getAudioCtx` creado en el primer `keydown`, `playTone` y
   los cuatro sonidos), y el `loop` con `dt` capado a 50 ms y el decremento de
   `freezeRemaining`. Implementar `pause()` (deja de programar rAF), `resume()`
   (`lastTime = null` y reanuda), `restart()` (`initGame()` + `resume()`).
   Verificación: partida completa con power-ups, T-spin, combo y perfect clear
   funcionando; `PAUSA` congela sin salto de `dt` ni del contador de freeze.

7. **Componente cliente.** Crear `components/tetris-player.tsx` (`"use client"`)
   copiando `components/asteroids-player.tsx`: marco `.av-player` / `.crt` /
   `.crt-screen` / `.crt-bottom` con `<canvas ref>` de tablero y de next, fila
   `.player-hud` con `.hud-stat` para Puntuación / Líneas / Nivel / Power-up desde
   `stats`, botones `PAUSA` / `REANUDAR` y `SALIR`. `useEffect([game.id])` crea el
   juego (`onGameOver`, `onStats`) y limpia con `destroy()`. Modal "FIN DEL JUEGO"
   con el marcado de `asteroids-player.tsx` (`submitScore` con sesión, CTA a
   `/login` sin sesión, toast, `JUGAR DE NUEVO` → `handle.restart()` + cerrar
   modal + `setSaved(false)`, `VOLVER AL VAULT` → `/juegos`). `void
registerPlay(game.id)` en `onGameOver`. Añadir `tetris: TetrisPlayer` a
   `GAME_REGISTRY`. Verificación: `/juego/tetris/jugar` muestra el tablero real y
   la preview NEXT; el HUD de la fila superior se actualiza; morir abre el modal;
   con sesión, guardar añade la marca a `public.scores`.

8. **Portada y escalado CSS.** Añadir a `app/globals.css` el bloque
   `.cover-tetris` (base + `::after` + `::before`) junto a las demás portadas, y
   el bloque de escalado del tablero 1:2 dentro de `.crt-screen` (fila centrada
   tablero + next, sin overflow horizontal). Verificación: la portada se ve en el
   grid de `/juegos`; en pantalla ancha y en el breakpoint de 720px el tablero
   escala sin deformar y la página no hace scroll horizontal.

9. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos;
   consola sin warnings de hidratación en `/juego/tetris/jugar`; al pulsar SALIR
   no quedan listeners `keydown` ni `requestAnimationFrame` activos ni
   `AudioContext` abierto. Confirmar que el bloque regenerado de `AGENTS.md` va
   junto al commit.

---

## Acceptance criteria

- [ ] `lib/games/registry.ts` existe con `GAME_REGISTRY` y `playerFor`;
      `app/juego/[id]/jugar/page.tsx` ya no contiene el ternario
      `game.id === "rocas"`; `lib/games.ts` ya no exporta `PLAYABLE_GAME_IDS`.
- [ ] `/juego/rocas/jugar` sigue montando `AsteroidsPlayer` a través del registro;
      `/juego/caida/jugar` y los otros 5 simulados siguen con `GamePlayer`.
- [ ] `public.games` tiene una fila `id = 'tetris'`, `title = 'TETRABYTE'`,
      `cat = 'PUZZLE'`, `cover = 'cover-tetris'`, `color = 'cyan'`; `select`
      anónimo funciona; `insert` anónimo se rechaza; `games_with_stats` la
      devuelve con `best = 0` / `plays = 0` si nadie ha jugado.
- [ ] `/juego/tetris/jugar` renderiza un `<canvas>` con el tablero real (piezas,
      grid, ghost) y un segundo `<canvas>` con la pieza siguiente, no la arena
      simulada de `div`.
- [ ] Flecha izquierda/derecha mueve la pieza, flecha arriba o `X` la rota (con
      wall kicks `[0,-1,1,-2,2]`), flecha abajo es soft drop, `Space` es hard drop;
      `Space` y las flechas no hacen scroll de la página.
- [ ] Limpiar 1 / 2 / 3 / 4 líneas suma `100 / 300 / 500 / 800 × nivel`; hard drop
      suma 2 pts por celda recorrida, soft drop 1 pt por fila. _(port literal:
      `LINE_SCORES`, `hardDrop`, `softDrop`.)_
- [ ] Un tetris (4 líneas) encadenado con otro tetris o T-spin activa el bonus
      back-to-back (+50%); limpiar líneas en turnos consecutivos aplica el
      multiplicador de combo; vaciar el tablero suma el bonus de perfect clear.
      _(port literal: `clearLines`, `B2B_TETRIS_BONUS`, `PERFECT_CLEAR_SCORES`.)_
- [ ] Un T-spin (pieza T, última acción rotar, ≥3 esquinas ocupadas) puntúa con
      `TSPIN_SCORES` y muestra el popup `T-SPIN SINGLE/DOUBLE/TRIPLE`.
- [ ] Cada 5 líneas limpiadas la pieza siguiente es un power-up (`bomb` /
      `lightning` / `dye` / `gravity` / `freeze`); recogerlo aplica su efecto y
      suma 250 pts; `freeze` detiene la gravedad 5 s con cuenta atrás en el HUD.
      _(port literal: `POWERUP_INTERVAL`, `applyPowerup`, `FREEZE_MS`.)_
- [ ] Aparecen pentominós (`+` / `U` / `Y`, ~12%) y la pieza 3×3 hueca (~5%); tras
      un tetris aparece la pieza de recompensa 1×1. _(port literal:
      `PENTOMINO_CHANCE`, `CHALLENGE_CHANCE`, `pendingSingle`.)_
- [ ] Las celdas comodín "tinte" completan filas con huecos gastando comodines.
      _(port literal: `applyDye`, `wildcardAssist` en `clearLines`.)_
- [ ] El nivel sube cada 10 líneas y `dropInterval = max(100, 1000 - (nivel-1)*90)`;
      el HUD (`Puntuación` / `Líneas` / `Nivel` / `Power-up`) se pinta en la fila
      `.player-hud`, no en el canvas.
- [ ] Al aparecer una pieza que colisiona se llega a game over y se abre el modal
      "FIN DEL JUEGO" con la puntuación final; ninguna tecla reinicia el canvas.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` llama a `submit_score` y muestra el toast
      `▸ PUNTUACIÓN GUARDADA_`; una segunda partida solo actualiza la fila si el
      score sube.
- [ ] Sin sesión, el modal no tiene input de guardado; aparece el CTA
      "INICIA SESIÓN PARA GUARDAR" que lleva a `/login`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, tablero vacío, nivel 1) y
      cierra el modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle y cambia a `REANUDAR`; al reanudar no hay salto de
      `dt` ni del contador de `freeze` (la pieza no "teletransporta").
- [ ] `SALIR` navega a `/juego/tetris`; tras salir no quedan listeners `keydown`
      ni `requestAnimationFrame` en marcha ni `AudioContext` abierto.
- [ ] `tetris` aparece en `/juegos`, en la preview de la home y en `/salon`; el
      resto de juegos sigue con `GamePlayer` sin cambios de comportamiento.
- [ ] El nombre inicial del input del modal es el del usuario con sesión, o
      `INVITADO` sin sesión. _(igual que `asteroids-player.tsx`.)_
- [ ] La portada `.cover-tetris` se ve en el grid; el `<canvas>` del tablero
      escala manteniendo proporción 1:2, sin deformación ni scroll horizontal en
      los breakpoints existentes.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos;
      sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** entrada de catálogo nueva `tetris` (título TETRABYTE, `PUZZLE`, `cyan`).
  Elegido por el usuario. `caida` se reserva como slot de puzzle distinto y se
  queda con el `GamePlayer` simulado. Coste: una migración y una portada
  `.cover-tetris` nuevas.
- **Sí:** título inventado TETRABYTE en vez de "TETRIS". Los 8 juegos del seed usan
  nombres inventados y "Tetris" es marca registrada. El `id` interno sigue siendo
  `tetris`.
- **Sí:** port a un controlador imperativo (`lib/games/tetris.ts`,
  `createTetrisGame(canvas, opts) → handle`). Mantiene la lógica de `game.js` casi
  intacta y aísla el bucle de 60 fps del ciclo de render de React. Heredado de
  SPEC 05.
- **No:** reescritura idiomática en React (estado en refs/hooks). Más trabajo y más
  superficie de bugs sin beneficio para un canvas.
- **No:** cargar `game.js` casi literal con `<Script>` o dynamic import. El scope
  global, los ~10 listeners sobre ids del DOM, el `getElementById` fijo y el
  auto-arranque chocan con montaje/desmontaje repetido en el App Router.
- **Sí:** registro central `lib/games/registry.ts` en esta spec. Es el segundo
  juego real; un tercer ternario y un tercer id en un `Set` literal se degradan.
  El mapa deja el tercer juego como una entrada más.
- **Sí:** HUD escalar (`score` / `lines` / `level` / power-up) a la fila
  `.player-hud` vía `onStats`; tablero, ghost y preview NEXT en canvas. El HUD del
  original ya vivía en el DOM (~25 ids); replicar ese markup metería estructura
  ajena al tema de la plataforma. Elegido por el usuario.
- **Sí:** `onStats` de tetris sin `lives`. El juego no tiene vidas; forzar la forma
  genérica `{ score, lives, level }` obligaría a un campo muerto.
- **Sí:** preview NEXT en un segundo `<canvas>` (`opts.nextCanvas`), como el
  `#next-canvas` del original. Recrearla en React con divs duplicaría la lógica de
  dibujo de piezas.
- **Sí:** popups de combo / T-spin dibujados en la franja superior del canvas del
  tablero. Son texto transitorio; puentearlos a React obligaría a un estado por
  frame.
- **Sí:** conservar mecánicas (pentominós, 1×1, 3×3 hueco, 5 power-ups, T-spin,
  B2B, combo, perfect clear, comodín tinte) y el balance sin cambios. Menos edición
  y menos riesgo que podar el sistema. Precedente SPEC 05 (power-ups "tal cual").
  Elegido por el usuario.
- **No:** skins, toggle de tema claro/oscuro, selector de nivel inicial. El marco
  CRT de la plataforma ya fija la estética; `startLevel` queda fijo a 1. Elegido
  por el usuario.
- **Sí:** conservar el audio WebAudio sintetizado. Cero assets, solo código. El
  `AudioContext` se crea en el primer `keydown` para cumplir la política de
  autoplay. Elegido por el usuario.
- **Sí:** quitar el reinicio propio del juego (botón Reiniciar, pantalla de inicio,
  tabla de highscores DOM). El modal de la plataforma es el dueño del reinicio y
  del guardado; mantener ambos duplicaría la acción y descoordinaría el estado de
  React.
- **No:** pausa interna con `P` / `Esc`. El botón PAUSA de la plataforma es el
  único punto de pausa, para no desincronizar `paused` de React con el estado del
  motor. Reconsiderable con un callback `onPause` en otra spec.
- **Sí:** `pause()` detiene el `requestAnimationFrame` y `resume()` resetea
  `lastTime`. El original no capaba `dt`; el port lo capa a 50 ms y congela el
  scheduling, más limpio que confiar en el cap.
- **No:** persistir `líneas` y `mejor combo` en el leaderboard. `submit_score`
  guarda solo `score`, como el resto de juegos. Otra spec si se quiere.
- **Sí:** coordenadas internas 300×600 (tablero) y 120×120 (next) fijas, escaladas
  por CSS. No se toca `COLS` / `ROWS` / `BLOCK` ni la física.
- **No:** responsive real (recalcular `COLS` / `ROWS` / `BLOCK`). El original fija
  el tamaño y toda la física asume 10×20; escalar por CSS basta para el MVP.
- **Sí:** bloque CSS propio para el tablero 1:2, no reusar `.asteroids-canvas` (es
  4:3 con `object-fit: contain`).

---

## Riesgos

| Riesgo                                                                                                   | Mitigación                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` o el listener de teclado sobreviven al desmontar el componente                   | `createTetrisGame` guarda el id de rAF y la referencia del handler en el cierre; `destroy()` cancela, desregistra y cierra el `AudioContext`. Un criterio lo verifica con SALIR. |
| TypeScript strict: `game.js` usa matrices `number[][]` sin tipo, piezas con `powerup?` opcional y `type` | El port tipa `Cell` / `Board` / `Piece` / `PowerupType`; el paso 4–5 no cierra hasta que `npm run build` pasa sin errores de tipos.                                              |
| El segundo canvas (`nextCanvas`) llega `null` o en orden de refs inesperado en el primer render          | `createTetrisGame` valida ambos canvas y sus contextos 2d antes de arrancar, y solo se llama dentro de `useEffect`.                                                              |
| `Space` / flechas hacen scroll de la página o activan un botón enfocado                                  | El listener hace `preventDefault` para `Space` y flechas; PAUSA / SALIR no roban el foco al canvas en uso normal.                                                                |
| `AudioContext` bloqueado por la política de autoplay del navegador                                       | `getAudioCtx` se llama en el primer `keydown`, no en el montaje; si `state === 'suspended'` se hace `resume()`.                                                                  |
| El tablero 1:2 deja mucho letterbox horizontal dentro de `.crt-screen`                                   | Bloque CSS propio: fila centrada con tablero (`height:100%`, aspect-ratio 1/2) + next pequeño al lado; no se reusa el `object-fit: contain` de asteroides.                       |
| Los popups de combo dibujados en canvas tapan el tablero                                                 | Se dibujan en la franja superior con fondo semitransparente y fade corto (~900 ms), como el `#combo-popup` DOM del original.                                                     |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render             | Ambos `<canvas>` se montan vacíos; `createTetrisGame` solo toca `window` / DOM dentro de `useEffect`. Un criterio lo verifica.                                                   |
| Borrar `PLAYABLE_GAME_IDS` rompe algún consumidor no detectado                                           | El paso 1 hace `grep` de `PLAYABLE_GAME_IDS` e `isPlayable` antes de borrar; `isPlayable` conserva su firma (`id in GAME_REGISTRY`).                                             |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                                    | Se commitea junto al trabajo; borrarlo del diff solo lo regenera (documentado en `CLAUDE.md` / `AGENTS.md`).                                                                     |

---

## Qué **no** entra en esta spec

- Motor real para los otros 6 juegos simulados.
- Reusar o poblar `caida` con este motor.
- Skins, toggle de tema claro/oscuro y selector de nivel inicial del original.
- Pausa interna con `P` / `Esc`.
- Persistir líneas y mejor combo en el leaderboard; realtime en los rankings.
- Responsive real del canvas (recalcular `COLS` / `ROWS` / `BLOCK` y la física).
- Controles táctiles / móviles, vibración, `prefers-reduced-motion`.
- Cambios de balance, power-ups nuevos o tipos de pieza nuevos.
- Actualizar `best` o `plays` de `tetris` a mano en la BD.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
