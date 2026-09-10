# SPEC 09 — Cuarto juego real: NEONSNAKE (snake) en la nueva entrada "snake"

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-06
> **Objective:** Portar el juego canvas de `references/started-games/05-snake/game.js` a un controlador imperativo TypeScript montado en un componente cliente nuevo, asociado a una entrada de catálogo nueva `snake` (título visible NEONSNAKE), con el HUD escalar en la fila `.player-hud` de la plataforma y la puntuación final guardada por el modal de fin de juego.

---

## Por qué existe esta spec

SPEC 05 portó el primer juego real (asteroides) a `lib/games/asteroids.ts` + `components/asteroids-player.tsx`. SPEC 06 dejó el leaderboard real (`submit_score`, `registerPlay`, modal con sesión / CTA sin sesión). SPEC 07 portó el segundo juego (tetris) e introdujo el registro central `lib/games/registry.ts` que sustituyó al ternario hardcodeado y al `Set` `PLAYABLE_GAME_IDS`. SPEC 08 portó el tercero (arkanoid, entrada `bloque-buster`) y añadió el pad táctil `.touch-controls` / `.touch-btn` a `app/globals.css`. El resto del catálogo sigue con el `GamePlayer` simulado.

El cuarto juego real es el snake de `references/started-games/05-snake/`. Su forma actual:

- **Un único `game.js`** (298 líneas), vanilla, sin ES modules, estado en `let` a nivel de módulo. Se carga con `<script src="game.js">` al final del body y **se auto-arranca** al cargar (`resetGame()` → `phase = "menu"` → `requestAnimationFrame(frame)`, con el bucle ya corriendo).
- **Un único canvas** `#board` de **528×528 fijo** (proporción 1:1), rejilla 24×24 (`CELL = canvas.width / GRID = 22px`). En canvas solo se dibuja el tablero: rejilla tenue, serpiente con brillo neón (cabeza con ojos que miran hacia la dirección de avance), comida magenta pulsante y un flash de pantalla al morir.
- **HUD en el DOM** (`textContent`): `#score`, `#hiscore`, `#speed`. Los overlays de **menú / pausa / game over** también son DOM: `#overlay`, `#overlay-title`, `#overlay-msg`, `#overlay-score`, `#start-btn`. No hay HUD ni overlays dibujados en canvas.
- **Listeners**: `keydown` en `window`; un `click` en `#start-btn`. El input lee **`e.key`** (no `e.code`): `KEYS` tiene claves `"ArrowUp"`, `"w"`, `"a"`, `"s"`, `"d"`, etc., y normaliza con `e.key.length === 1 ? e.key.toLowerCase() : e.key`.
- **`localStorage` propio**: `snake_hi` (récord). Sin otros.
- **Máquina de estados**: `phase` = `"menu" | "playing" | "paused" | "dead"`.
- **Controles**: flechas + `WASD` mueven (dirección encolada en `nextDir`, sin giro de 180°); `P` / `Espacio` pausa; `Enter` reinicia; cualquier tecla de movimiento desde `menu` / `dead` arranca partida.
- **Mecánica**: longitud inicial 4, velocidad base 7 pasos/s (`BASE_SPEED`), `+0.35` pasos/s por comida (`SPEED_STEP`), tope 18 (`MAX_SPEED`); `+10` puntos por comida (`POINTS_PER_FOOD`); chocar con muro o con el propio cuerpo = game over. La comida se coloca en una celda libre al azar. Bucle de paso fijo con acumulador (`acc += dt`, `dt` capado a 100 ms, `while (acc >= stepMs) step()`).
- **Assets externos**: ninguno (la fuente `Press Start 2P` viene de Google Fonts; se ignora).

Esta spec adapta ese juego a Next.js 16 / React 19 sin reescribir su lógica: se encapsula en un controlador imperativo con ciclo de vida (`crear` / `pausar` / `reanudar` / `reiniciar` / `destruir`) y dos callbacks hacia la plataforma, `onGameOver(finalScore)` y `onStats(stats)`. Un componente cliente nuevo lo monta dentro del marco CRT y, al morir, abre el modal "FIN DEL JUEGO" para guardar la puntuación con `submitScore` (mismo flujo que `asteroids-player.tsx`). Como el registro central ya existe (SPEC 07), esta spec solo añade una entrada más al mapa.

Decisiones ya cerradas con el usuario (no reabrir):

- El juego se asocia a una entrada de catálogo **nueva** `snake`, título visible **NEONSNAKE**, categoría `ARCADE`, color `cyan`, portada `cover-neonsnake`. **No** se reusa `serpentina`, que se queda con el `GamePlayer` simulado (igual que `caida` cuando `tetris` se llevó id nuevo en SPEC 07). Coste: una migración y una portada `.cover-neonsnake` nuevas.
- Título inventado NEONSNAKE; el `id` interno, el módulo del motor y el componente usan `snake`.
- Port a **controlador imperativo TS** (`lib/games/snake.ts`), no reescritura en hooks ni carga de `game.js` casi literal.
- El HUD escalar (`Puntuación` / `Velocidad`) se pinta en la fila `.player-hud` de la plataforma vía `onStats`; el tablero, la serpiente, la comida y el flash de muerte se siguen dibujando **en canvas**.
- `onStats` tiene forma `{ score, speed }`, sin `lives` ni `level`: snake no tiene vidas y su "nivel" es la velocidad continua (multiplicador con un decimal, como el `#speed` del original).
- El input del motor pasa de `e.key` a **`e.code`** (`ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`, `KeyW` / `KeyA` / `KeyS` / `KeyD`), para que el pad táctil (que despacha `KeyboardEvent` con `code` y `key` vacío) funcione y para alinear con el resto de motores de la plataforma.
- Se quita la fase `menu` y sus overlays DOM: el juego arranca en `playing` al montar (como asteroides / tetris / arkanoid).
- Se quitan la pausa interna (`P` / `Espacio`) y el reinicio interno (`Enter`): los botones `PAUSA` / `REANUDAR` y el modal de fin son los únicos puntos de pausa y reinicio (precedente TETRABYTE).
- Se quita `snake_hi` de `localStorage`; la mejor marca vive en `public.scores` vía `submit_score` (SPEC 06).
- Se conservan flechas + `WASD` y el balance del original sin cambios (long. inicial 4, base 7 pasos/s, `+0.35` por comida, tope 18, `+10` pts).
- El canvas mantiene **coordenadas internas 528×528** y se escala por CSS reutilizando `.asteroids-canvas` (`object-fit: contain` letterboxea el 1:1 dentro del CRT 4:3). No se crea bloque CSS de escalado propio.
- El pad táctil es un **d-pad de 4 botones en cruz**, todos en modo `tap` (la dirección de snake es discreta y encolada: un flanco por giro), sin botón de acción. Esta spec añade un modificador CSS `.touch-controls.dpad` para el layout en cruz.

---

## Scope

**In:**

- **Fuente de referencia**: los 4 archivos de `references/started-games/05-snake/` (`game.js`, `index.html`, `style.css`, `README.md`) ya existen como archivos planos en `main` (no es gitlink de submódulo, como `03-claude-tetris` y `04-arkanoid`). **No hay paso de materialización.** Quedan como referencia de lectura; no entran en el build de Next ni se importan desde `app/`.
- **Migración** `supabase/migrations/<timestamp>_snake.sql` (posterior a `20260906130000_tetris.sql`, aplicada también por MCP `apply_migration` al proyecto `mrimkuambtxtoycyfxyh`):
  - `insert into public.games (id, title, short, long, cat, cover, color, sort)` con `id = 'snake'`, `title = 'NEONSNAKE'`, `cat = 'ARCADE'`, `cover = 'cover-neonsnake'`, `color = 'cyan'`, `sort = 10`, y textos `short` / `long` en el estilo del seed existente (`20260905213521_games_catalog.sql`).
  - `insert into public.game_plays (game_id) values ('snake') on conflict do nothing`.
  - Sin cambios de esquema: **no** se regenera `lib/supabase/database.types.ts`.
- **Controlador** `lib/games/snake.ts` (módulo TS puro, sin JSX ni React):
  - `createSnakeGame(canvas: HTMLCanvasElement, opts: SnakeOptions): SnakeHandle`.
  - Port tipado de `game.js`: tipos (`Phase`, `Vec`, `Cell`); constantes (`GRID = 24`, `CELL = canvas.width / GRID`, `START_LEN = 4`, `BASE_SPEED = 7`, `SPEED_STEP = 0.35`, `MAX_SPEED = 18`, `POINTS_PER_FOOD = 10`) — se elimina `HI_KEY`; `COLORS`; el estado (hoy `let` a nivel de módulo) movido al cierre; `resetGame`, `placeFood`, `step`, `drawGrid`, `drawCell`, `roundRect`, `render`, `drawEyes`, y el bucle `frame` con acumulador de paso fijo (`dt` capado a 100 ms).
  - `create` valida que `opts.onGameOver` y `opts.onStats` son funciones, fija `canvas.width = 528` / `canvas.height = 528`, obtiene el `2d` (lanza si es null), monta `keydown` / `keyup` en `window` (con `preventDefault` para flechas y `Space`), llama `resetGame()`, pone `phase = "playing"` y arranca el bucle `requestAnimationFrame`.
  - Cambios respecto al original:
    - El input lee `e.code` en vez de `e.key`; mapa de direcciones con claves `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` y `KeyW` / `KeyA` / `KeyS` / `KeyD`.
    - No hay fase `menu` ni `paused`: `phase` es `"playing" | "dead"`. Se eliminan `startGame`, `togglePause`, `showOverlay`, `hideOverlay`, `updateHud` (DOM) y el `click` de `#start-btn`; también el manejo de `P` / `Espacio` (pausa) y `Enter` (reinicio).
    - No se lee ni escribe `snake_hi`.
    - Al chocar con muro o cuerpo: `phase = "dead"`, se activa `deathFlash` y, con flag `gameOverNotified` (reseteada en `resetGame()`), se llama `opts.onGameOver(score)` una sola vez.
    - Tras cada cambio de `score` / `stepMs` se llama `opts.onStats({ score, speed })` con `speed = +(1000 / stepMs / BASE_SPEED).toFixed(1)`.
    - El flash de muerte (`deathFlash` en `render()`) se conserva.
  - `pause()` detiene el scheduling de `requestAnimationFrame`. `resume()` lo reanuda reseteando `lastTime` para evitar salto de `dt`. `restart()` llama `resetGame()` y reanuda. `destroy()` cancela el rAF pendiente y quita los listeners `keydown` / `keyup`.
- **Componente** `components/snake-player.tsx` (`"use client"`), copia de `components/asteroids-player.tsx`:
  - Marco CRT reutilizando clases de `app/globals.css` (`.av-player`, `.crt`, `.crt-screen`, `.crt-bottom`), con `<canvas ref className="asteroids-canvas" width={528} height={528}>`.
  - Fila `.player-hud`: título del juego + `.hud-stat` para `Puntuación` y `Velocidad` alimentados por `onStats` (sin bloque de vidas ni de nivel); botones `PAUSA` / `REANUDAR` (alterna `handle.pause()` / `handle.resume()` + estado local) y `SALIR` → `router.push('/juego/' + game.id)`.
  - `useEffect(() => { const h = createSnakeGame(canvasRef.current!, { onGameOver, onStats }); handleRef.current = h; return () => { h.destroy(); handleRef.current = null; }; }, [game.id])`.
  - `onGameOver(finalScore)` → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`, y abre el modal "FIN DEL JUEGO" con el mismo marcado y clases que `asteroids-player.tsx` (`.modal-bd`, `.modal`, `.final`, `.final-label`, `.toast-saved`, `.actions`, `.spinner`): con sesión `await submitScore(game.id, finalScore)` + toast `▸ PUNTUACIÓN GUARDADA_`; sin sesión CTA "INICIA SESIÓN PARA GUARDAR" → `/login`; `JUGAR DE NUEVO` → `handle.restart()` + cierra modal + resetea `saved`; `VOLVER AL VAULT` → `/juegos`.
- **Controles táctiles** en `components/snake-player.tsx`: constante de módulo `TOUCH_CONTROLS` (`{ label, code, mode }[]`) con `▲` / `◀` / `▼` / `▶` → `ArrowUp` / `ArrowLeft` / `ArrowDown` / `ArrowRight`, todos `mode: "tap"`; y un bloque `<div className="touch-controls dpad">` hermano de `.crt`, después del marco CRT. `press(code)` / `release(code)` despachan `keydown` / `keyup` sintéticos en `window` con `bubbles: true`. Cada botón: `onPointerDown` → `preventDefault()` + `press(code)` + `requestAnimationFrame(() => release(code))` (un flanco por pulsación). `heldRef: Set<string>` registra los `code` con `keydown` sintético pendiente; el cleanup del `useEffect` hace `release` de todo. `<button type="button">`, `onContextMenu` con `preventDefault`. El motor **no** se toca.
- **Registro** `lib/games/registry.ts`: añadir `"snake": SnakePlayer` a `GAME_REGISTRY`. El mapa, `playerFor(id)`, el enrutado de `app/juego/[id]/jugar/page.tsx` e `isPlayable()` ya existen desde SPEC 07 y no se tocan.
- **CSS** `app/globals.css`:
  - Bloque nuevo `.cover-neonsnake` (base oscura + `::after` con gradientes que dibujan una serpiente segmentada cyan y un núcleo de comida magenta + opcional `::before` con glifo unicode), junto a `.cover-snake` (~línea 723). Solo variables de la paleta existente (`--cyan`, `--magenta`, `--ink`, `--line`); sin `<img>`.
  - Modificador nuevo `.touch-controls.dpad` junto a `.touch-controls` (~línea 1150): layout en cruz de 4 botones (grid de 3 columnas, `▲` arriba centrado, `◀` / `▼` / `▶` en la fila central), que anula la regla heredada `.touch-controls .touch-btn:last-child { margin-left: auto }`. `.touch-btn` se reutiliza tal cual. Solo variables de la paleta.
  - El `<canvas>` reutiliza `.asteroids-canvas` sin cambios.

**Out of scope (para futuras specs):**

- Motor real para los otros juegos simulados; siguen con `GamePlayer`.
- Reusar o poblar la entrada `serpentina` con este motor.
- Responsive real del canvas (recalcular `GRID` / `CELL` y la física); solo se escala por CSS.
- Bloque CSS de escalado propio para el canvas 1:1 (se reutiliza `.asteroids-canvas`).
- Vibración / haptics, entrada por gestos o swipe (el pad táctil es solo de botones), `prefers-reduced-motion`.
- Cambios de balance (velocidad, longitud inicial, puntos por comida), obstáculos, comida especial o modos nuevos.
- Persistir la longitud alcanzada o la velocidad máxima en el leaderboard; `submit_score` guarda solo `score`.
- Leaderboards con más columnas o realtime.
- Audio (el original no tiene).
- Actualizar `best` o `plays` de `snake` a mano en la BD (se derivan de las vistas).
- Tests automatizados (no hay framework configurado).

---

## Data model

Esta feature no introduce estructuras persistentes nuevas de frontend. La persistencia de puntuaciones sigue en `public.scores` de Supabase vía el RPC `submit_score` (SPEC 06), una fila por `(user_id, game_id)` = mejor marca.

La migración añade **una fila** a `public.games` (`id = 'snake'`) y **una fila** a `public.game_plays` (`game_id = 'snake'`). Sin cambios de esquema. Las vistas `games_with_stats`, `leaderboard` y `game_stats` recogen la fila nueva sin tocarlas.

Formas nuevas en memoria, en `lib/games/snake.ts`:

```ts
interface SnakeOptions {
  onGameOver: (finalScore: number) => void;
  onStats: (stats: { score: number; speed: number }) => void;
}

interface SnakeHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

function createSnakeGame(canvas: HTMLCanvasElement, opts: SnakeOptions): SnakeHandle;
```

`onStats` de snake lleva `{ score, speed }` en vez de la forma genérica `{ score, lives, level }` de la referencia del skill: no hay vidas y el "nivel" es la velocidad continua (multiplicador con un decimal, como el `#speed` del original).

Tipos internos del port (estructuras sin tipo en `game.js`):

```ts
type Phase = "playing" | "dead";

interface Vec {
  x: number;
  y: number;
}

interface Cell {
  x: number;
  y: number;
}
```

Estado interno del juego (portado de `game.js`, ahora en el cierre, sin cambios de semántica salvo lo indicado en Scope):

```ts
// phase: Phase                       (se elimina "menu" y "paused")
// snake: Cell[]
// dir: Vec, nextDir: Vec
// food: Cell
// score: number
// stepMs: number                     (1000 / velocidad actual)
// acc: number, lastTime: number
// deathFlash: number                 (se conserva)
// gameOverNotified: boolean          (nuevo; reseteado en resetGame())
// rafId: number | null
// GRID = 24, CELL = canvas.width / GRID = 22   (constantes; no responsive)
// (se elimina hiscore y la lectura/escritura de snake_hi)
```

Estado local de `components/snake-player.tsx`:

```ts
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [saved, setSaved] = useState(false);
const [busy, setBusy] = useState(false);
const [saveErr, setSaveErr] = useState<string | null>(null);
const [pending, setPending] = useState<"again" | "vault" | "login" | "exit" | null>(null);
const [stats, setStats] = useState({ score: 0, speed: 1 });
const heldRef = useRef<Set<string>>(new Set()); // codes con keydown sintético pendiente de keyup
```

Pad táctil (constante de módulo en `components/snake-player.tsx`):

```ts
type TouchMode = "hold" | "tap";

interface TouchControl {
  label: string; // glifo/etiqueta del botón
  code: string; // KeyboardEvent.code que lee el motor
  mode: TouchMode; // "hold" = tecla mantenida; "tap" = un flanco por pulsación
}

const TOUCH_CONTROLS: TouchControl[] = [
  { label: "▲", code: "ArrowUp", mode: "tap" },
  { label: "◀", code: "ArrowLeft", mode: "tap" },
  { label: "▼", code: "ArrowDown", mode: "tap" },
  { label: "▶", code: "ArrowRight", mode: "tap" },
];
```

Convenciones (heredadas de SPEC 01 / 05 / 07):

- `lib/games/snake.ts` no importa React y solo toca `window` / DOM cuando se le pasa el `canvas`.
- `components/snake-player.tsx` lleva `"use client"` (usa `ref`, estado, `useEffect`, `useRouter`, `useAuth`).
- `lib/games/registry.ts` importa los componentes player y el tipo `Game` (`import type`, borrado en build); se mantiene separado de `lib/games.ts`.
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component que resuelve `params` y lee el juego de la tabla `games`; no cambia.
- Alias `@/*` para imports (`@/lib/games/snake`, `@/lib/games/registry`, `@/lib/leaderboard`).

---

## Implementation plan

1. **Migración `snake`.** Crear `supabase/migrations/<timestamp>_snake.sql` con el `insert` en `public.games` (id `snake`, title `NEONSNAKE`, cat `ARCADE`, cover `cover-neonsnake`, color `cyan`, sort `10`, textos `short` / `long` en el estilo del seed) y el `insert ... on conflict do nothing` en `public.game_plays`. Aplicar con MCP `apply_migration`. Verificación: `select` anónimo sobre `games` devuelve la fila `snake`; `games_with_stats` la incluye con `best = 0`, `plays = 0`; un `insert` anónimo directo se rechaza por RLS.

2. **Esqueleto del controlador.** Crear `lib/games/snake.ts` con `createSnakeGame(canvas, opts)`: valida `opts.onGameOver` y `opts.onStats`, fija `canvas.width = 528` / `canvas.height = 528`, obtiene el `2d` (lanza si es null), pinta el fondo, monta `keydown` / `keyup` en `window` (con `preventDefault` para flechas y `Space`) y un bucle `requestAnimationFrame` vacío. Devuelve `{ pause, resume, restart, destroy }` con `destroy` quitando los dos listeners y cancelando el rAF. Verificación: `npm run lint` limpio; montado en prueba manual el canvas se ve; `destroy()` no deja listeners ni rAF colgando.

3. **Lógica y render.** Portar a TS tipado dentro del módulo: tipos (`Phase`, `Vec`, `Cell`), constantes (sin `HI_KEY`), `COLORS`, el estado al cierre, y `resetGame`, `placeFood`, `step` (dirección encolada, sin giro de 180°, colisión con muro / cuerpo → game over), `drawGrid`, `drawCell`, `roundRect`, `render` (rejilla + comida pulsante + serpiente + ojos + flash de muerte) y el bucle `frame` con acumulador de paso fijo (`dt` capado a 100 ms, `while (acc >= stepMs) step()`). Cambios respecto al original: input por `e.code` (`ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`, `KeyW` / `KeyA` / `KeyS` / `KeyD`); `create` llama `resetGame()`, pone `phase = "playing"` y arranca (sin fase `menu`); no se lee ni escribe `snake_hi`; al chocar, `phase = "dead"` + `deathFlash = 1` y, con `gameOverNotified` (reseteada en `resetGame()`), `opts.onGameOver(score)` una sola vez; tras cada cambio de `score` / `stepMs`, `opts.onStats({ score, speed })` con `speed = +(1000 / stepMs / BASE_SPEED).toFixed(1)`; se eliminan `togglePause`, los overlays DOM, `updateHud`, el `click` de `#start-btn` y el manejo de `P` / `Espacio` / `Enter`. Implementar `pause()` (deja de programar rAF), `resume()` (`lastTime = null` y reanuda), `restart()` (`resetGame()` + `resume()`). Verificación: montado en prueba manual el juego es jugable de principio a fin; comer un núcleo suma 10 y acelera; chocar con muro o cuerpo dispara `onGameOver` con el score correcto y el canvas no se reinicia solo.

4. **Componente cliente.** Crear `components/snake-player.tsx` (`"use client"`) copiando `components/asteroids-player.tsx`: marco `.av-player` / `.crt` / `.crt-screen` / `.crt-bottom` con `<canvas ref className="asteroids-canvas" width={528} height={528}>`, fila `.player-hud` con título + `.hud-stat` para `Puntuación` y `Velocidad` desde `stats`, botones `PAUSA` / `REANUDAR` y `SALIR`. `useEffect([game.id])` crea el juego (`onGameOver`, `onStats`) y limpia con `destroy()`. `onGameOver` → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`. Modal "FIN DEL JUEGO" con el marcado de `asteroids-player.tsx` (`submitScore` con sesión + toast `▸ PUNTUACIÓN GUARDADA_`, CTA "INICIA SESIÓN PARA GUARDAR" → `/login` sin sesión, `JUGAR DE NUEVO` → `handle.restart()` + cerrar modal + `setSaved(false)`, `VOLVER AL VAULT` → `/juegos`). Añadir `"snake": SnakePlayer` a `GAME_REGISTRY`. Verificación: `/juego/snake/jugar` muestra el canvas real (rejilla, serpiente neón, comida magenta); el HUD de la fila superior se actualiza al comer; morir abre el modal; con sesión, guardar añade la marca a `public.scores`.

5. **Pad táctil.** En `components/snake-player.tsx`: `TOUCH_CONTROLS` (`▲` / `◀` / `▼` / `▶` → flechas, todos `tap`) y un bloque `<div className="touch-controls dpad">` hermano de `.crt`. `press(code)` / `release(code)` = `window.dispatchEvent(new KeyboardEvent("keydown" | "keyup", { code, bubbles: true }))`. Cada botón: `onPointerDown` → `preventDefault()` + `press(code)` + `requestAnimationFrame(() => release(code))`. `heldRef: Set<string>` registra lo pendiente; el cleanup del `useEffect` hace `release` de todo. `<button type="button">`, `onContextMenu` con `preventDefault`. El motor no se toca. Verificación: en emulación móvil (pointer coarse) el pad se ve en cruz y cada botón gira la serpiente igual que su flecha; en escritorio no se ve; al desmontar no queda ninguna tecla sintética "pegada".

6. **CSS: portada y d-pad.** En `app/globals.css`: bloque `.cover-neonsnake` (base + `::after` con gradientes de serpiente cyan y núcleo magenta + opcional `::before` con glifo) junto a `.cover-snake` (~línea 723); modificador `.touch-controls.dpad` junto a `.touch-controls` (~línea 1150) con el layout en cruz de 4 botones (grid de 3 columnas) que anula `.touch-controls .touch-btn:last-child { margin-left: auto }`. Solo variables de la paleta existente. El `<canvas>` sigue usando `.asteroids-canvas` tal cual. Verificación: la portada se ve en el grid de `/juegos`; en `@media (pointer: coarse)` el pad aparece en cruz bajo el marco CRT; en escritorio no se muestra y el layout no cambia; el `<canvas>` 528×528 escala 1:1 con letterbox, sin deformación ni scroll horizontal en los breakpoints existentes.

7. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos; consola sin warnings de hidratación en `/juego/snake/jugar`; al pulsar `SALIR` no quedan listeners `keydown` / `keyup` ni `requestAnimationFrame` activos, ni teclas sintéticas mantenidas. Confirmar que el bloque regenerado de `AGENTS.md` va junto al commit.

---

## Acceptance criteria

- [ ] `public.games` tiene una fila `id = 'snake'`, `title = 'NEONSNAKE'`, `cat = 'ARCADE'`, `cover = 'cover-neonsnake'`, `color = 'cyan'`; `select` anónimo funciona; `insert` anónimo se rechaza; `games_with_stats` la devuelve con `best = 0` / `plays = 0` si nadie ha jugado.
- [ ] `/juego/snake/jugar` renderiza un `<canvas>` con el juego real (rejilla tenue, serpiente con brillo neón y cabeza con ojos, comida magenta pulsante), no la arena simulada de `div`.
- [ ] Flecha izquierda / derecha / arriba / abajo y `W` / `A` / `S` / `D` giran la serpiente; la dirección se encola (`nextDir`) y no se permite el giro de 180°; `Space` y las flechas no hacen scroll de la página.
- [ ] Comer un núcleo magenta suma 10 puntos, alarga la serpiente en un segmento y sube la velocidad de paso (`+0.35` pasos/s por comida, tope 18). _(port literal: `POINTS_PER_FOOD`, `SPEED_STEP`, `MAX_SPEED`, `step`.)_
- [ ] La comida nunca aparece sobre una celda ocupada por la serpiente. _(port literal: `placeFood`.)_
- [ ] Chocar con un muro o con el propio cuerpo termina la partida con un flash de pantalla en el canvas.
- [ ] El HUD de la fila `.player-hud` muestra `Puntuación` y `Velocidad` (multiplicador con un decimal) correctos durante la partida; no se dibuja HUD en el canvas.
- [ ] Al llegar a game over se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final; ninguna tecla reinicia el canvas.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` llama a `submit_score` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`; una segunda partida solo actualiza la fila si el score sube.
- [ ] Sin sesión, el modal no tiene input de guardado; aparece el CTA "INICIA SESIÓN PARA GUARDAR" que lleva a `/login`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, longitud 4, velocidad base, serpiente centrada) y cierra el modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle y cambia a `REANUDAR`; al reanudar no hay salto de `dt` (la serpiente no salta celdas).
- [ ] `SALIR` navega a `/juego/snake`; tras salir no quedan listeners `keydown` / `keyup` ni `requestAnimationFrame` en marcha, ni teclas sintéticas mantenidas.
- [ ] En un dispositivo táctil (`@media (pointer: coarse)`) aparece el pad `.touch-controls.dpad` en cruz bajo el marco CRT; cada botón (`▲` / `◀` / `▼` / `▶`) produce un solo giro, igual que su flecha.
- [ ] En escritorio (pointer fino) el pad no se muestra y el layout no cambia; pulsar un botón no roba el foco ni abre el menú contextual de long-press.
- [ ] `snake` aparece como jugable en `/juegos`, en la preview de la home y en `/salon` (filtro `isPlayable`); el resto de juegos simulados sigue con `GamePlayer` sin cambios; `serpentina` sigue con `GamePlayer`.
- [ ] La portada `.cover-neonsnake` se ve en el grid; el `<canvas>` (528×528) escala a la pantalla CRT manteniendo proporción 1:1 con letterbox, sin deformación ni scroll horizontal en los breakpoints existentes.
- [ ] El motor no lee ni escribe la clave `snake_hi` de `localStorage`.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos; sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** entrada de catálogo nueva `snake` (título NEONSNAKE, `ARCADE`, `cyan`). Elegido por el usuario. `serpentina` se reserva como slot ARCADE distinto y se queda con el `GamePlayer` simulado, igual que `caida` con TETRABYTE en SPEC 07. Coste: una migración y una portada `.cover-neonsnake` nuevas.
- **Sí:** título inventado NEONSNAKE. Coherente con los nombres inventados del seed; el `id` interno, el módulo del motor (`lib/games/snake.ts`) y el componente (`snake-player.tsx`) usan `snake`.
- **Sí:** port a un controlador imperativo (`lib/games/snake.ts`, `createSnakeGame(canvas, opts) → handle`). Mantiene la lógica de `game.js` casi intacta y aísla el bucle de 60 fps del ciclo de render de React. Heredado de SPEC 05.
- **No:** reescritura idiomática en React (estado en refs / hooks). Más trabajo y más superficie de bugs sin beneficio para un canvas.
- **No:** cargar `game.js` casi literal con `<Script>` o dynamic import. El scope global, el `getElementById("board")` fijo y el auto-arranque chocan con montaje / desmontaje repetido en el App Router.
- **Sí:** HUD escalar (`Puntuación` / `Velocidad`) a la fila `.player-hud` vía `onStats`; el tablero, la serpiente, la comida y el flash de muerte se siguen dibujando en canvas. El HUD del original ya vivía en el DOM (`#score` / `#hiscore` / `#speed`); replicar ese markup metería estructura ajena al tema de la plataforma. Precedente TETRABYTE.
- **Sí:** `onStats` de snake con forma `{ score, speed }`, sin `lives` ni `level`. El juego no tiene vidas y su "nivel" es la velocidad continua; forzar la forma genérica `{ score, lives, level }` obligaría a campos muertos. Precedente: TETRABYTE desvió `onStats` a `{ score, lines, level, powerupLabel }`.
- **Sí:** el input del motor pasa de `e.key` a `e.code` (`ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`, `KeyW` / `KeyA` / `KeyS` / `KeyD`). El original leía `e.key`; el pad táctil despacha `KeyboardEvent` con `code` y `key` vacío, y el resto de motores de la plataforma (asteroides, tetris, arkanoid) ya usan `e.code`.
- **Sí:** quitar la fase `menu` y sus overlays DOM (`#overlay`, `#start-btn`); el juego arranca en `playing` al montar. Como asteroides / tetris / arkanoid; la plataforma no tiene pantalla de inicio por juego.
- **Sí:** quitar la pausa interna (`P` / `Espacio`) y el reinicio interno (`Enter`). Los botones `PAUSA` / `REANUDAR` y el modal de fin son los únicos puntos de pausa y reinicio, para no desincronizar `paused` de React con el estado del motor. Precedente TETRABYTE ("No pausa interna").
- **Sí:** quitar `snake_hi` de `localStorage`. La mejor marca vive en `public.scores` vía `submit_score`. Precedente SPEC 06.
- **Sí:** conservar flechas + `WASD`. El alias no añade coste; el pad táctil es espejo de las flechas.
- **Sí:** conservar el balance del original sin cambios (longitud inicial 4, base 7 pasos/s, `+0.35` por comida, tope 18, `+10` pts). Menos edición y menos riesgo que retocarlo. Precedente SPEC 05 (power-ups "tal cual").
- **Sí:** conservar el flash de muerte en canvas. Es un efecto de `render()`, no depende del DOM.
- **Sí:** coordenadas internas 528×528 fijas y escalado del `<canvas>` por CSS reutilizando `.asteroids-canvas` (`object-fit: contain`, que letterboxea el 1:1 dentro del CRT 4:3). No hay que tocar `GRID` / `CELL` ni la física; solo la presentación.
- **No:** bloque CSS de escalado propio `.snake-stage` (1:1). El letterbox de `.asteroids-canvas` basta; TETRABYTE necesitó `.tetris-stage` por ser 3:4 con la preview NEXT aparte, aquí no.
- **No:** responsive real (recalcular `GRID` / `CELL` según viewport). El original fija 528×528 / 24×24 y la física lo asume; escalar por CSS basta para el MVP.
- **Sí:** el registro `lib/games/registry.ts` ya existe (SPEC 07); esta spec solo añade `"snake": SnakePlayer`. No se toca `app/juego/[id]/jugar/page.tsx` ni `isPlayable()`.
- **Sí:** pad táctil como d-pad de 4 botones en cruz, todos `tap`. La dirección de snake es discreta y encolada (un flanco por giro), no una tecla mantenida; no hay acción extra que mapear.
- **Sí:** el pad despacha `KeyboardEvent` sintéticos en `window`, no una API de input nueva en `SnakeHandle`. El motor ya escucha `window` por `e.code`, así que el pad no le añade superficie ni un segundo camino de código.
- **Sí:** esta spec añade el modificador CSS `.touch-controls.dpad` para el layout en cruz. El `.touch-controls` existente (SPEC 08) es "d-pad a la izquierda + acción a la derecha" y empuja el 4º botón con `.touch-btn:last-child { margin-left: auto }`, que no sirve para un d-pad de 4 direcciones.
- **Sí:** el pad se muestra por `@media (pointer: coarse)`, no por ancho. Una ventana estrecha de escritorio sigue teniendo teclado.

---

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` o los listeners `keydown` / `keyup` sobreviven al desmontar el componente            | `createSnakeGame` guarda el id de rAF y las referencias de los handlers en el cierre; `destroy()` cancela y desregistra. Un criterio lo verifica con `SALIR`.                             |
| El original lee `e.key`; el pad táctil despacha `KeyboardEvent` con `code` y `key` vacío, así que no giraría | El port migra el input a `e.code` (`ArrowUp` … `KeyW` …). Un criterio verifica que cada botón del pad gira la serpiente igual que su flecha.                                              |
| TypeScript strict sobre un `game.js` sin tipos (vectores mutables, `snake` como array de objetos)            | El port tipa `Phase`, `Vec`, `Cell` y el estado del cierre; el paso 3 no cierra hasta que `npm run build` pasa sin errores de tipos.                                                      |
| `Space` / flechas hacen scroll de la página o activan un botón enfocado                                      | El listener hace `preventDefault` para flechas y `Space`; `PAUSA` / `SALIR` no roban el foco al canvas en uso normal.                                                                     |
| Una tecla sintética del pad se queda "pegada" si se pierde el `pointerup` (dedo fuera del botón, desmontaje) | `heldRef: Set<string>` registra cada `keydown` sintético; para `tap` el `release` va en el `requestAnimationFrame` siguiente y el cleanup del `useEffect` hace `release` de lo pendiente. |
| El menú contextual de long-press o el zoom por doble-tap interfieren con el pad                              | `onContextMenu` con `preventDefault`, `touch-action: none` y `user-select: none` en `.touch-controls`; botones `type="button"`.                                                           |
| Una pausa larga hace saltar `dt` al reanudar y la serpiente salta celdas                                     | `pause()` no programa rAF y `resume()` resetea `lastTime`; el bucle capa `dt` a 100 ms y usa acumulador de paso fijo. Un criterio lo verifica con `PAUSA`.                                |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render                 | El `<canvas>` se monta vacío; `createSnakeGame` solo toca `window` / DOM dentro de `useEffect`. Un criterio lo verifica.                                                                  |
| El canvas 1:1 dentro del CRT 4:3 deja bandas laterales grandes                                               | Aceptado: `object-fit: contain` centra el cuadrado sin deformarlo; es coherente con el marco CRT. Bloque CSS propio queda fuera de scope.                                                 |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                                        | Se commitea junto al trabajo; borrarlo del diff solo lo regenera (documentado en `CLAUDE.md` / `AGENTS.md`).                                                                              |

---

## Qué **no** entra en esta spec

- Motor real para los otros juegos simulados; siguen con `GamePlayer`.
- Reusar o poblar `serpentina` con este motor.
- Responsive real del canvas (recalcular `GRID` / `CELL` y la física).
- Bloque CSS de escalado propio para el canvas 1:1.
- Vibración / haptics, entrada por gestos o swipe, `prefers-reduced-motion`.
- Cambios de balance, obstáculos, comida especial o modos de juego nuevos.
- Persistir la longitud o la velocidad máxima en el leaderboard; leaderboards con más columnas o realtime.
- Audio.
- Actualizar `best` o `plays` de `snake` a mano en la BD.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
