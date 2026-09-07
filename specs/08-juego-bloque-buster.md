# SPEC 08 — Tercer juego real: Arkanoid en la entrada "bloque-buster"

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-06
> **Objective:** Portar el juego canvas de `references/started-games/04-arkanoid/` (`game.js` + `assets/spritesheet.js`) a un controlador imperativo TypeScript montado en un componente cliente nuevo que sustituye la partida simulada para la entrada existente `bloque-buster`, conservando su HUD y sus overlays en canvas y guardando la puntuación final por el modal de fin de la plataforma.

---

## Por qué existe esta spec

SPEC 05 portó el primer juego real (asteroides) a `lib/games/asteroids.ts` + `components/asteroids-player.tsx`. SPEC 06 dejó el leaderboard real (`submit_score`, `registerPlay`, modal con sesión / CTA sin sesión). SPEC 07 portó el segundo juego (tetris) e introdujo el registro central `lib/games/registry.ts` que sustituyó al ternario hardcodeado y al `Set` `PLAYABLE_GAME_IDS`. El resto del catálogo sigue con el `GamePlayer` simulado.

El tercer juego real es el arkanoid de `references/started-games/04-arkanoid/`. Su forma actual:

- **Dos archivos JS acoplados por globals**, sin ES modules: `game.js` (683 líneas) y `assets/spritesheet.js` (69). `index.html` los carga con dos `<script>` al final del body y el juego se auto-arranca (`loadSpritesheet(cb)` → `requestAnimationFrame(frame)`).
- **Un único canvas** `#game` de **800×600 fijo** (4:3).
- **HUD en canvas** (`fillText`): "Vidas:" con iconos de bola, "Nivel: N", "Score: N", y un chip de buff con barra de tiempo. Los overlays de "Game Over" y "Nivel N" (stage clear) también se dibujan en el canvas.
- **Listeners**: `window` `keydown` / `keyup` (`ArrowLeft`, `ArrowRight`, `Space`); `canvas` `mousemove` (el paddle sigue al ratón) y `canvas` `click` (lanzar bola / avanzar de stage / reiniciar). El teclado y el ratón conviven: el teclado toma el control hasta que el ratón se vuelve a mover.
- **Assets con ruta relativa** (rompen bajo Next): `assets/spritesheet-breakout.png` (lo pide `spritesheet.js`), `assets/sounds/break-sound.mp3`, `assets/sounds/ball-bounce.mp3`.
- **`localStorage` propio**: ninguno.
- **Máquina de estados**: `state.phase` = `"playing" | "gameover" | "stageclear"`. `update(dt)` no hace nada si `phase !== "playing"`.
- **Mecánicas sobre el Breakout clásico**: stages infinitos con 8 patrones de rejilla (`PATTERNS`) más relleno procedural; bloques blindados de 2 a 5 HP con skin por dureza (`wood` / `brick` / `gray` / `slate`); rampa de velocidad de bola por stage (+5%, tope ×1,75); **multibola** cada 30 bloques rotos alternando con **buff de velocidad** (slow ×0,7 o fast ×1,35, 10 s); **+1 vida** cada 1.000 puntos (tope 10); partículas con gravedad + destello blanco + popup de puntos al romper; colisión de bola con substepping. Arranque: 5 vidas, 5 filas. La bola sale pegada al paddle y se lanza con `Space` o click con ángulo aleatorio.

Esta spec adapta ese juego a Next.js 16 / React 19 sin reescribir su lógica: se encapsula en un controlador imperativo con ciclo de vida (`crear` / `pausar` / `reanudar` / `reiniciar` / `destruir`) y un solo callback hacia la plataforma, `onGameOver(finalScore)`. Un componente cliente nuevo lo monta dentro del marco CRT y, al morir, abre el modal "FIN DEL JUEGO" para guardar la puntuación con `submitScore` (mismo flujo que `asteroids-player.tsx`). Como el registro central ya existe (SPEC 07), esta spec solo añade una entrada más al mapa.

Decisiones ya cerradas con el usuario (no reabrir):

- El juego se asocia a la entrada **existente** `bloque-buster` de `public.games`. Ya está descrita como este juego ("Rebota la pelota y destruye muros de neón", `cover-bricks`, `cyan`, `ARCADE`). **No** se crea id nuevo ni migración ni portada.
- Port a **controlador imperativo TS** (`lib/games/bloque-buster.ts`), no reescritura en hooks ni carga de `game.js` casi literal.
- Se **conserva el spritesheet**: `assets/spritesheet-breakout.png` se copia a `public/bloque-buster/` y `spritesheet.js` se porta a TS dentro del módulo del motor, con la animación de rotura de 4 frames (`EXPLOSION_FRAMES`) intacta. Se descartó redibujar con primitivas neón.
- El PNG y los dos `.mp3` se tratan como **Kenney (CC0)**, con un `LICENSE.txt` al lado en `public/bloque-buster/`. Pendiente de que el usuario lo confirme.
- **Audio**: se portan los dos `.mp3` originales (rebote y rotura) con pools de `<audio>` y las rutas reescritas a `/bloque-buster/...`.
- HUD (vidas, nivel, score, chip de buff) y overlays de "Game Over" / "Nivel N" se siguen dibujando **en el canvas**; la plataforma solo aporta marco CRT y botones. El motor **no** emite `onStats`.
- Se **conservan** el control por ratón (`mousemove`) y el `click` del canvas, además del teclado y el pad táctil.
- El overlay de **stage clear** se cierra con tecla, click o el botón de acción del pad (llama a `advanceStage()`); no es fin de partida, el modal de la plataforma no interviene.
- En **game over** se quita el reinicio por tecla/click del original y la línea "pulsa para reiniciar"; el modal de la plataforma es el dueño del reinicio.
- El contador de tiempo del juego (`now`, hoy `= ts` del `requestAnimationFrame`) pasa a ser un **acumulador de tiempo de juego** (`now += dt * 1000`, con `dt` ya capado a 50 ms), para que `pause()` congele buff, partículas, destellos, popups y animación de rotura sin reajustar timestamps al reanudar.
- Se **conservan todas las mecánicas** y el balance del original sin cambios (patrones, relleno procedural, blindaje escalado, multibola / buff alternados, +1 vida cada 1.000).
- El canvas mantiene **coordenadas internas 800×600** y se escala por CSS reutilizando `.asteroids-canvas` (4:3, `object-fit: contain`).
- Como es el primer juego con pad táctil, esta spec **añade** el bloque `.touch-controls` / `.touch-btn` a `app/globals.css`.

---

## Scope

**In:**

- **Fuente de referencia**: los archivos de `references/started-games/04-arkanoid/` ya existen como archivos planos en `main` (no es gitlink de submódulo). **No hay paso de materialización.** Quedan como referencia de lectura; no entran en el build de Next ni se importan desde `app/`.
- **Assets** `public/bloque-buster/`: copiar `spritesheet-breakout.png`, `break-sound.mp3` y `ball-bounce.mp3` desde `references/started-games/04-arkanoid/assets/`, más un `LICENSE.txt` (Kenney CC0). Las rutas relativas del original (`assets/spritesheet-breakout.png`, `assets/sounds/*.mp3`) se reescriben a `/bloque-buster/...`.
- **Controlador** `lib/games/bloque-buster.ts` (módulo TS puro, sin JSX ni React):
  - `createBloqueBusterGame(canvas: HTMLCanvasElement, opts: BloqueBusterOptions): BloqueBusterHandle`.
  - Port tipado de `game.js`: constantes de balance (`CANVAS_W`, `CANVAS_H`, `PADDLE`, `BALL`, `STAGE_SPEED_STEP`, `STAGE_SPEED_CAP`, `MULTIBALL_*`, `MAX_LAUNCH_ANGLE`, `MAX_BOUNCE_ANGLE`, `BUFF_*`, `LIFE_EVERY`, `MAX_LIVES`, `START_ROWS`, `MAX_ROWS`, `FILL_STEP`, `FILL_CAP`, `MIN_BRICKS`, `ARMOR_*`, `GRID`, `BRICK_H`, `START_LIVES`, tuning de partículas / flash / popup); `PATTERNS`; `armorChance`, `fillChance`, `maxArmorHp`, `clamp`, `layoutBricks`, `buildBricks`, `makeBall`; el objeto `state` (hoy a nivel de módulo) movido al cierre; `updatePaddle`, `stickBallToPaddle`, `stageBallSpeed`, `effectiveSpeed`, `rescaleBalls`, `activateBuff`, `launchBall`, `collideBallWall`, `collideBallPaddle`, `collideBallBricks`, `updateBalls` (con substepping), `loseBallsOffscreen`, `spawnMultiball`, `spawnParticles`, `updateParticles`, `spawnFlash`, `spawnPopup`, `spawnNotice`, `updatePopups`, `advanceStage`, `resetGame`, `update(dt)`, `render()`.
  - Port tipado de `assets/spritesheet.js` **dentro del mismo módulo**: `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet` (con el canvas offscreen), `drawSprite`, `drawFrame`.
  - `create` valida que `opts.onGameOver` es función, fija `canvas.width = 800` / `canvas.height = 600`, obtiene el `2d` (lanza si es null), monta `keydown` / `keyup` en `window` (con `preventDefault` para `Space` y flechas) y `mousemove` / `click` en el `canvas`, espera a `loadSpritesheet` y arranca el bucle `requestAnimationFrame`.
  - `now` pasa de `now = ts` a acumulador de tiempo de juego: `now += Math.min((ts - lastTime) / 1000, 0.05) * 1000`.
  - En `phase === "gameover"`: **no** se reinicia con tecla ni click. Al entrar en `gameover` se llama `opts.onGameOver(state.score)` una sola vez, con flag `gameOverNotified` reseteada en `resetGame()`. El overlay de game over pierde la línea "Pulsa una tecla o haz click para reiniciar".
  - En `phase === "stageclear"`: se conserva avanzar de stage con cualquier tecla, click o el `Space` sintético del pad.
  - `pause()` detiene el scheduling de `requestAnimationFrame`. `resume()` lo reanuda reseteando `lastTime` para evitar salto de `dt`. `restart()` llama `resetGame()` y reanuda. `destroy()` cancela el rAF pendiente y quita los cuatro listeners (`keydown`, `keyup`, `mousemove`, `click`).
- **Componente** `components/bloque-buster-player.tsx` (`"use client"`), copia de `components/asteroids-player.tsx`:
  - Marco CRT reutilizando clases de `app/globals.css` (`.av-player`, `.crt`, `.crt-screen`, `.crt-bottom`), con `<canvas ref>` de clase `asteroids-canvas`, `width={800}` / `height={600}`.
  - Fila `.player-hud`: título del juego + botones `PAUSA` / `REANUDAR` (alterna `handle.pause()` / `handle.resume()` + estado local) y `SALIR` → `router.push('/juego/' + game.id)`. Sin `.hud-stat` de stats (el HUD va en canvas).
  - `useEffect(() => { const h = createBloqueBusterGame(canvasRef.current!, { onGameOver }); handleRef.current = h; return () => { h.destroy(); handleRef.current = null; }; }, [game.id])`.
  - `onGameOver(finalScore)` → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`, y abre el modal "FIN DEL JUEGO" con el mismo marcado y clases que `asteroids-player.tsx` (`.modal-bd`, `.modal`, `.final`, `.final-label`, `.toast-saved`, `.actions`, `.spinner`): con sesión `await submitScore(game.id, finalScore)` + toast `▸ PUNTUACIÓN GUARDADA_`; sin sesión CTA "INICIA SESIÓN PARA GUARDAR" → `/login`; `JUGAR DE NUEVO` → `handle.restart()` + cierra modal + resetea `saved`; `VOLVER AL VAULT` → `/juegos`.
- **Controles táctiles** en `components/bloque-buster-player.tsx`: constante de módulo `TOUCH_CONTROLS` (`{ label, code, mode }[]`) y un bloque `<div className="touch-controls">` hermano de `.crt`, después del marco CRT. `press(code)` / `release(code)` despachan `keydown` / `keyup` sintéticos en `window` con `bubbles: true`. Botones `◀` (`ArrowLeft`, `hold`) y `▶` (`ArrowRight`, `hold`) con `onPointerDown` → `preventDefault()` + `press` y `onPointerUp` / `onPointerCancel` / `onPointerLeave` → `release`; botón `LANZAR` (`Space`, `tap`) con `press` en `onPointerDown` y `release` en el siguiente `requestAnimationFrame`. `heldRef: Set<string>` registra los `code` mantenidos; el cleanup del `useEffect` hace `release` de todo. `<button type="button">`, `onContextMenu` con `preventDefault`. El motor **no** se toca.
- **Registro** `lib/games/registry.ts`: añadir `"bloque-buster": BloqueBusterPlayer` a `GAME_REGISTRY`. El mapa, `playerFor(id)`, el enrutado de `app/juego/[id]/jugar/page.tsx` e `isPlayable()` ya existen desde SPEC 07 y no se tocan.
- **CSS** `app/globals.css`: bloque nuevo `.touch-controls` / `.touch-btn` junto a `.asteroids-canvas` (~línea 1150):
  - `.touch-controls` — `display: none` por defecto; visible solo dentro de `@media (pointer: coarse)` como fila flex (d-pad a la izquierda, acción a la derecha), `margin-top: 14px`, `touch-action: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`.
  - `.touch-btn` — cuadrado ~64px, glifo `var(--pixel)`, `1px solid var(--line)`, `background: var(--bg-2)`, `:active` con borde neón (`var(--cyan)` + `box-shadow`). Solo variables de la paleta existente; sin colores ni `<img>` nuevos.
  - El `<canvas>` reutiliza `.asteroids-canvas` tal cual. `.cover-bricks` ya existe y no se toca.

**Out of scope (para futuras specs):**

- Motor real para los otros juegos simulados; siguen con `GamePlayer`.
- Nueva entrada de juego, ficha, portada (`cover-*`) o textos para este juego; se reusa `bloque-buster` intacto.
- Redibujar el tablero con primitivas neón en vez del spritesheet.
- Responsive real del canvas (recalcular tamaño y física); solo se escala por CSS.
- Vibración / haptics, entrada por gestos o swipe (el pad táctil es solo de botones), `prefers-reduced-motion`.
- Cambios de balance, patrones de rejilla nuevos, power-ups nuevos o tipos de bloque nuevos.
- Persistir el nivel alcanzado o los bloques rotos en el leaderboard; `submit_score` guarda solo `score`.
- Leaderboards con más columnas o realtime.
- Audio de más eventos (lanzamiento, vida extra, game over) o música.
- Actualizar `best` o `plays` de `bloque-buster` a mano en la BD (se derivan de las vistas).
- Tests automatizados (no hay framework configurado).

---

## Data model

Esta feature no introduce estructuras persistentes nuevas. La persistencia de puntuaciones sigue en `public.scores` de Supabase vía el RPC `submit_score` (SPEC 06), una fila por `(user_id, game_id)` = mejor marca.

**No hay migración.** El id `bloque-buster` ya está sembrado en `public.games` (`20260905213521_games_catalog.sql`) y ya tiene fila en `public.game_plays` (`20260906120000_play_counter.sql`). Sin cambios de esquema: no se regenera `lib/supabase/database.types.ts`. Las vistas `games_with_stats`, `leaderboard` y `game_stats` recogen las puntuaciones nuevas sin tocarlas.

Formas nuevas en memoria, en `lib/games/bloque-buster.ts`:

```ts
interface BloqueBusterOptions {
  onGameOver: (finalScore: number) => void;
}

interface BloqueBusterHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  opts: BloqueBusterOptions,
): BloqueBusterHandle;
```

El HUD va en canvas, así que `BloqueBusterOptions` no lleva `onStats` (igual que `AsteroidsOptions` de SPEC 05).

Tipos del port (las estructuras de `game.js` no están tipadas):

```ts
type Phase = "playing" | "gameover" | "stageclear";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  stuck: boolean;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  skin: string | null;
  hp: number;
  maxHp: number;
  alive: boolean;
  breaking: boolean;
  breakStart: number;
}

interface Buff {
  kind: "slow" | "fast";
  mult: number;
  until: number;
}
```

Estado interno del juego (portado de `game.js`, ahora en el cierre, sin cambios de semántica):

```ts
// phase: Phase
// stage, stageSpeed
// buff: Buff | null
// lives, score, bricksDestroyed, blockMilestones
// paddle: { x, y, w, h }
// balls: Ball[]
// bricks: Brick[]
// input: { left: boolean, right: boolean, mouseX: number | null }
// particles[], flashes[], popups[]
// gameOverNotified  (nuevo; reseteado en resetGame())
// now  (acumulador de tiempo de juego, ya no `= ts`), lastTime, rafId
// CANVAS_W = 800, CANVAS_H = 600  (constantes; no responsive)
```

Estado local de `components/bloque-buster-player.tsx`:

```ts
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [saved, setSaved] = useState(false);
const [busy, setBusy] = useState(false);
const [saveErr, setSaveErr] = useState<string | null>(null);
const [pending, setPending] = useState<"again" | "vault" | "login" | "exit" | null>(null);
const heldRef = useRef<Set<string>>(new Set()); // codes con keydown sintético pendiente de keyup
```

Pad táctil (constante de módulo en `components/bloque-buster-player.tsx`):

```ts
type TouchMode = "hold" | "tap";

interface TouchControl {
  label: string; // glifo/etiqueta del botón
  code: string; // KeyboardEvent.code que lee el motor
  mode: TouchMode; // "hold" = tecla mantenida; "tap" = un flanco por pulsación
}

const TOUCH_CONTROLS: TouchControl[] = [
  { label: "◀", code: "ArrowLeft", mode: "hold" },
  { label: "▶", code: "ArrowRight", mode: "hold" },
  { label: "LANZAR", code: "Space", mode: "tap" },
];
```

Convenciones (heredadas de SPEC 01 / 05 / 07):

- `lib/games/bloque-buster.ts` no importa React y solo toca `window` / DOM cuando se le pasa el `canvas`.
- `components/bloque-buster-player.tsx` lleva `"use client"` (usa `ref`, estado, `useEffect`, `useRouter`, `useAuth`).
- `lib/games/registry.ts` importa los componentes player y el tipo `Game` (`import type`, borrado en build); se mantiene separado de `lib/games.ts`.
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component que resuelve `params` y lee el juego de la tabla `games`; no cambia.
- Alias `@/*` para imports (`@/lib/games/bloque-buster`, `@/lib/games/registry`, `@/lib/leaderboard`).

---

## Implementation plan

1. **Assets a `public/`.** Copiar `spritesheet-breakout.png`, `break-sound.mp3` y `ball-bounce.mp3` de `references/started-games/04-arkanoid/assets/` a `public/bloque-buster/`, más un `LICENSE.txt` (Kenney CC0). Verificación: los tres ficheros se sirven en `http://localhost:3000/bloque-buster/<archivo>`; `npm run build` sigue compilando.

2. **Esqueleto del controlador.** Crear `lib/games/bloque-buster.ts` con `createBloqueBusterGame(canvas, opts)`: valida `opts.onGameOver`, fija `canvas.width = 800` / `canvas.height = 600`, obtiene el `2d` (lanza si es null), pinta el fondo `#0a0a12`, monta `keydown` / `keyup` en `window` (con `preventDefault` para `Space` y flechas) y `mousemove` / `click` en el `canvas`, y un bucle `requestAnimationFrame` vacío. Devuelve `{ pause, resume, restart, destroy }` con `destroy` quitando los cuatro listeners y cancelando el rAF. Verificación: `npm run lint` limpio; montado en prueba manual el canvas se ve; `destroy()` no deja listeners ni rAF colgando.

3. **Constantes, patrones, sprites y utilidades.** Portar a TS tipado dentro del módulo: los tipos (`Phase`, `Ball`, `Brick`, `Buff`), todas las constantes de balance, `PATTERNS`, `armorChance`, `fillChance`, `maxArmorHp`, `clamp`, `layoutBricks`, `buildBricks`, `makeBall`; y los helpers de sprites de `assets/spritesheet.js` (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet` con el canvas offscreen y `rawImg.src = "/bloque-buster/spritesheet-breakout.png"`, `drawSprite`, `drawFrame`). Verificación: `npm run build` sin errores de tipos; sin uso todavía en el bucle.

4. **Lógica de partida.** Portar el `state` al cierre y `updatePaddle`, `stickBallToPaddle`, `stageBallSpeed`, `effectiveSpeed`, `rescaleBalls`, `activateBuff`, `launchBall`, `collideBallWall`, `collideBallPaddle`, `collideBallBricks`, `updateBalls` (con substepping), `loseBallsOffscreen`, `spawnMultiball`, `spawnParticles`, `updateParticles`, `spawnFlash`, `spawnPopup`, `spawnNotice`, `updatePopups`, `advanceStage`, `resetGame`, `update(dt)`. Cambios respecto al original: `now` pasa a acumulador (`now += min(dt, 0.05) * 1000`); en `phase === "gameover"` **no** se llama `resetGame()` por tecla ni click, y al entrar en `gameover` se invoca `opts.onGameOver(state.score)` una sola vez (flag `gameOverNotified`, reseteada en `resetGame()`); en `phase === "stageclear"` se conserva `advanceStage()` por tecla / click. Verificación: montado en prueba manual el juego es jugable de principio a fin; al morir dispara `onGameOver` con el score correcto y el canvas no se reinicia solo.

5. **Render, audio y ciclo de vida.** Portar `render()` (bloques con `drawSprite` + grietas / animación de rotura de 4 frames, partículas, flashes, popups, paddle, bolas, HUD en canvas — "Vidas:" con iconos, "Nivel:", "Score:", chip de buff con barra —, overlays de "Game Over" y "Nivel N" sin la línea de reinicio) y los pools de `<audio>` (`break-sound.mp3` ×8, `ball-bounce.mp3` ×4) sobre `/bloque-buster/...`. Implementar `pause()` (deja de programar rAF), `resume()` (`lastTime = null` y reanuda), `restart()` (`resetGame()` + `resume()`). Verificación: partida completa con multibola, buff, blindaje y +1 vida funcionando; `PAUSA` congela sin salto de `dt` ni expiración de golpe del buff / partículas al reanudar; los `.mp3` suenan.

6. **Componente cliente.** Crear `components/bloque-buster-player.tsx` (`"use client"`) copiando `components/asteroids-player.tsx`: marco `.av-player` / `.crt` / `.crt-screen` / `.crt-bottom` con `<canvas ref className="asteroids-canvas">`, fila `.player-hud` con título + botones `PAUSA` / `REANUDAR` y `SALIR`, `useEffect([game.id])` que crea el juego (`onGameOver`) y limpia con `destroy()`. `onGameOver` → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`. Modal "FIN DEL JUEGO" con el marcado de `asteroids-player.tsx` (`submitScore` con sesión, CTA a `/login` sin sesión, toast, `JUGAR DE NUEVO` → `handle.restart()` + cerrar modal + `setSaved(false)`, `VOLVER AL VAULT` → `/juegos`). Añadir `"bloque-buster": BloqueBusterPlayer` a `GAME_REGISTRY`. Verificación: `/juego/bloque-buster/jugar` muestra el canvas real (paddle, bola, bloques con sprites); el ratón mueve el paddle; morir abre el modal; con sesión, guardar añade la marca a `public.scores`.

7. **Pad táctil.** En `components/bloque-buster-player.tsx`: `TOUCH_CONTROLS` (`◀` / `▶` `hold`, `LANZAR` `tap`) y un bloque `<div className="touch-controls">` hermano de `.crt`. `press(code)` / `release(code)` = `window.dispatchEvent(new KeyboardEvent("keydown" | "keyup", { code, bubbles: true }))`. `◀` / `▶`: `onPointerDown` → `preventDefault()` + `press`; `onPointerUp` / `onPointerCancel` / `onPointerLeave` → `release`. `LANZAR`: `press` en `onPointerDown`, `release` en el siguiente `requestAnimationFrame`. `heldRef` registra lo mantenido; el cleanup del `useEffect` hace `release` de todo. `<button type="button">`, `onContextMenu` con `preventDefault`. Verificación: en emulación móvil (pointer coarse) el pad se ve y mueve / lanza igual que el teclado; en escritorio no se ve; al desmontar no queda ninguna tecla sintética "pegada".

8. **CSS del pad.** Añadir a `app/globals.css`, junto a `.asteroids-canvas`, los bloques `.touch-controls` (`display: none`; visible solo en `@media (pointer: coarse)`, `touch-action: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`) y `.touch-btn` (~64px, glifo `var(--pixel)`, `1px solid var(--line)`, `background: var(--bg-2)`, `:active` con borde neón). Solo variables de la paleta existente. Verificación: en `@media (pointer: coarse)` el pad aparece bajo el marco CRT; en escritorio no se muestra y el layout no cambia; el `<canvas>` sigue escalando 4:3 sin deformar ni scroll horizontal en los breakpoints existentes.

9. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos; consola sin warnings de hidratación en `/juego/bloque-buster/jugar`; al pulsar `SALIR` no quedan listeners `keydown` / `keyup` / `mousemove` / `click` ni `requestAnimationFrame` activos, ni teclas sintéticas mantenidas. Confirmar que el bloque regenerado de `AGENTS.md` va junto al commit.

---

## Acceptance criteria

- [ ] `/juego/bloque-buster/jugar` renderiza un `<canvas>` con el juego real (paddle, bola y bloques dibujados con el spritesheet), no la arena simulada de `div`.
- [ ] Flecha izquierda / derecha mueve el paddle; mover el ratón sobre el canvas también lo mueve; `Space` o click con la bola pegada la lanza con un ángulo aleatorio; `Space` y las flechas no hacen scroll de la página.
- [ ] Romper un bloque de 1 HP suma 10 puntos; un bloque blindado suma `10 × maxHp` al romperse del todo; un golpe no letal solo reproduce sonido y destello y deja el overlay de grietas. _(port literal: `points = 10 * br.maxHp`, `collideBallBricks`.)_
- [ ] Al quedar 0 bloques vivos aparece el overlay "Nivel N+1"; pulsar cualquier tecla, hacer click o el botón `LANZAR` del pad avanza de stage; el stage nuevo trae más filas (5 → 9) y la bola base más rápida (+5% por stage, tope ×1,75). _(port literal: `advanceStage`, `buildBricks`, `stageBallSpeed`.)_
- [ ] Cada 30 bloques rotos se alterna un hito: multibola (+4 bolas en abanico desde una bola viva) o un buff de velocidad (slow ×0,7 o fast ×1,35, 10 s con barra de tiempo en el HUD). _(port literal: `MULTIBALL_EVERY`, `blockMilestones % 2`, `spawnMultiball`, `activateBuff`.)_
- [ ] Al cruzar cada 1.000 puntos acumulados se suma +1 vida con aviso, hasta un tope de 10. _(port literal: `LIFE_EVERY`, `MAX_LIVES`.)_
- [ ] Perder todas las bolas por el borde inferior resta una vida y repega una bola nueva al paddle; con 0 vidas el juego pasa a game over.
- [ ] Al llegar a game over se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final; ninguna tecla ni click reinicia el canvas.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` llama a `submit_score` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`; una segunda partida solo actualiza la fila si el score sube.
- [ ] Sin sesión, el modal no tiene input de guardado; aparece el CTA "INICIA SESIÓN PARA GUARDAR" que lleva a `/login`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, stage 1, 5 vidas, paddle centrado, un bloque de bolas pegado) y cierra el modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle y cambia a `REANUDAR`; al reanudar no hay salto de `dt` ni expiran de golpe el buff, las partículas, los destellos ni la animación de rotura.
- [ ] `SALIR` navega a `/juego/bloque-buster`; tras salir no quedan listeners `keydown` / `keyup` / `mousemove` / `click` ni `requestAnimationFrame` en marcha, ni teclas sintéticas mantenidas.
- [ ] Los efectos de sonido suenan en sus eventos: `ball-bounce.mp3` en cada rebote de pared o paddle, `break-sound.mp3` en cada golpe a un bloque; los `.mp3` se sirven desde `/bloque-buster/` y el spritesheet desde `/bloque-buster/spritesheet-breakout.png`.
- [ ] En un dispositivo táctil (`@media (pointer: coarse)`) aparece el pad `.touch-controls` bajo el marco CRT: `◀` / `▶` mantienen el movimiento del paddle mientras se pulsan y `LANZAR` dispara un solo flanco de `Space` (lanza la bola y sirve para continuar tras stage clear).
- [ ] En escritorio (pointer fino) el pad no se muestra y el layout no cambia; pulsar un botón no roba el foco ni abre el menú contextual de long-press.
- [ ] `bloque-buster` aparece como jugable en `/juegos`, en la preview de la home y en `/salon` (filtro `isPlayable`); el resto de juegos simulados sigue con `GamePlayer` sin cambios.
- [ ] La portada `.cover-bricks` se ve en el grid; el `<canvas>` (800×600) escala a la pantalla CRT manteniendo proporción 4:3, sin deformación ni scroll horizontal en los breakpoints existentes.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos; sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** reusar la entrada `bloque-buster` de `public.games`. Ya está descrita como este juego ("Rebota la pelota y destruye muros de neón", `cover-bricks`, `cyan`, `ARCADE`); un id nuevo duplicaría ficha y portada. Elegido por el usuario.
- **Sí:** port a un controlador imperativo (`lib/games/bloque-buster.ts`, `createBloqueBusterGame(canvas, opts) → handle`). Mantiene la lógica de `game.js` casi intacta y aísla el bucle de 60 fps del ciclo de render de React. Heredado de SPEC 05.
- **No:** reescritura idiomática en React (estado en refs / hooks). Más trabajo y más superficie de bugs sin beneficio para un canvas.
- **No:** cargar `game.js` + `spritesheet.js` casi literales con `<Script>` o dynamic import. El scope global, el `getElementById("game")` fijo y el auto-arranque chocan con montaje / desmontaje repetido en el App Router.
- **Sí:** conservar `spritesheet-breakout.png` y portar `spritesheet.js` a TS dentro del módulo del motor, con `EXPLOSION_FRAMES` de 4 frames. Elegido por el usuario.
- **No:** redibujar bloques / paddle / bola con primitivas neón. Encajaba mejor con la estética vectorial del portal y evitaba el asset, pero perdía el arte y la animación de rotura; el usuario prefiere conservar el spritesheet.
- **Sí:** tratar el PNG y los dos `.mp3` como Kenney CC0, con un `LICENSE.txt` en `public/bloque-buster/`. A confirmar por el usuario; si no se confirma, es una decisión pendiente antes de publicar (ver Riesgos).
- **Sí:** portar los dos `.mp3` originales (rebote y rotura) con pools de `<audio>` y rutas reescritas a `/bloque-buster/...`. Elegido por el usuario. Coherente con el audio de `asteroids.ts`. Audio de más eventos queda fuera.
- **Sí:** HUD (vidas, nivel, score, chip de buff) y overlays de "Game Over" / "Nivel N" siguen dibujándose en el canvas. Es como está escrito el juego; el buff con barra de tiempo no encaja en el formato `.hud-stat`. El motor no emite `onStats`. Elegido por el usuario.
- **Sí:** conservar el control por ratón (`mousemove`) y el `click` del canvas además del teclado y el pad. Elegido por el usuario. En game over se quita el reinicio por click; en stage clear se conserva avanzar por click.
- **Sí:** el overlay de stage clear se cierra con tecla, click o el botón `LANZAR` del pad, llamando a `advanceStage()`. No es fin de partida, así que el modal de la plataforma no interviene. Elegido por el usuario.
- **No:** auto-avanzar de stage tras una pausa. Se planteó; el usuario prefiere el input explícito del original.
- **Sí:** desactivar el reinicio por tecla / click del original en game over, y quitar la línea "pulsa para reiniciar" del overlay. El modal de la plataforma es el dueño del reinicio; mantener ambos duplicaría la acción y descoordinaría el estado de React.
- **Sí:** `now` pasa de `now = ts` (timestamp de `requestAnimationFrame`) a un acumulador de tiempo de juego (`now += min(dt, 0.05) * 1000`). El original mide el buff, las partículas, los destellos, los popups y la animación de rotura con `now` absoluto; con el acumulador, `pause()` (no programar rAF) los congela sin reajustar timestamps al reanudar.
- **Sí:** `pause()` detiene el `requestAnimationFrame` y `resume()` resetea `lastTime`. El loop ya capa `dt` a 0,05 s, pero congelar el scheduling es más limpio que confiar en el cap.
- **Sí:** conservar todas las mecánicas del original sin cambios de balance (8 patrones + relleno procedural, blindaje escalado por stage, multibola / buff alternados en los hitos, +1 vida cada 1.000). Menos edición y menos riesgo que podar. Precedente SPEC 05 (power-ups "tal cual").
- **Sí:** coordenadas internas 800×600 fijas y escalado del `<canvas>` por CSS, reutilizando `.asteroids-canvas` (4:3, `object-fit: contain`). No hay que tocar el tamaño ni la física; solo la presentación.
- **No:** renombrar `.asteroids-canvas` a `.game-canvas`. Es una edición de dos sitios sin beneficio ahora; asteroides y este juego son ambos 4:3.
- **No:** responsive real (recalcular el tamaño interno y la física). El original fija 800×600 y toda la física lo asume; escalar por CSS basta para el MVP.
- **Sí:** pad táctil que despacha `KeyboardEvent` sintéticos en `window`, no una API de input nueva en `BloqueBusterHandle`. El motor ya escucha `window` por `e.code`, así que el pad no le añade superficie ni un segundo camino de código.
- **Sí:** mapa del pad como espejo 1:1 del teclado (`◀` / `▶` = flechas en `hold`, `LANZAR` = `Space` en `tap`). Sin desviaciones: todas las teclas del juego tienen sentido como botón.
- **Sí:** el pad se muestra por `@media (pointer: coarse)`, no por ancho. Una ventana estrecha de escritorio sigue teniendo teclado.
- **Sí:** el registro `lib/games/registry.ts` ya existe (SPEC 07); esta spec solo añade `"bloque-buster": BloqueBusterPlayer`. No se toca `app/juego/[id]/jugar/page.tsx` ni `isPlayable()`.

---

## Riesgos

| Riesgo                                                                                                               | Mitigación                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` o los cuatro listeners (`keydown` / `keyup` / `mousemove` / `click`) sobreviven al desmontar | `createBloqueBusterGame` guarda el id de rAF y las referencias de los handlers en el cierre; `destroy()` cancela y desregistra los cuatro. Un criterio lo verifica con `SALIR`.       |
| Una pausa larga hace expirar de golpe el buff, las partículas y la animación de rotura al reanudar                   | `now` pasa a ser tiempo de juego acumulado (`now += min(dt, 0.05) * 1000`), no reloj de pared; no avanza mientras no se programa rAF. Un criterio lo verifica con `PAUSA`.            |
| TypeScript strict sobre `game.js` + `spritesheet.js` sin tipos (matrices, `state` mutable, frames de sprite)         | El port tipa `state`, `Ball`, `Brick`, `Buff`, `Phase` y los frames de sprite; el paso 3–5 no cierra hasta que `npm run build` pasa sin errores de tipos.                             |
| Las rutas relativas de assets (`assets/spritesheet-breakout.png`, `assets/sounds/*.mp3`) rompen bajo Next            | Se copian a `public/bloque-buster/` y se reescribe el prefijo a `/bloque-buster/...` en `loadSpritesheet` y en los pools de `<audio>`.                                                |
| La licencia del PNG y los `.mp3` no está verificada (la carpeta no trae fichero de licencia)                         | Se asume Kenney CC0 y se añade un `LICENSE.txt`. Si el usuario no lo confirma, queda como decisión pendiente de resolver antes de publicar; no bloquea el resto de la implementación. |
| `Space` / flechas hacen scroll de la página o activan un botón enfocado                                              | El listener hace `preventDefault` para `Space` y flechas; `PAUSA` / `SALIR` no roban el foco al canvas en uso normal.                                                                 |
| El ratón queda desalineado con el paddle por el letterbox de `object-fit: contain`                                   | El canvas 4:3 dentro de un contenedor ~4:3 deja letterbox mínimo; el cálculo del original usa `rect.width`, así que el desfase es despreciable. Aceptable para el MVP.                |
| Audio bloqueado por la política de autoplay del navegador                                                            | Los `<audio>` solo se disparan desde rebotes / roturas, siempre posteriores a un gesto del usuario; `play()` va con `.catch(() => {})`.                                               |
| Una tecla sintética del pad se queda "pegada" si se pierde el `pointerup` (dedo fuera del botón, desmontaje)         | `heldRef: Set<string>` registra cada `keydown` sintético; `onPointerCancel` / `onPointerLeave` y el cleanup del `useEffect` hacen `release` de todo lo pendiente.                     |
| El menú contextual de long-press o el zoom por doble-tap interfieren con el pad                                      | `onContextMenu` con `preventDefault`, `touch-action: none` y `user-select: none` en `.touch-controls`; botones `type="button"`.                                                       |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render                         | El `<canvas>` se monta vacío; `createBloqueBusterGame` solo toca `window` / DOM dentro de `useEffect`. Un criterio lo verifica.                                                       |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                                                | Se commitea junto al trabajo; borrarlo del diff solo lo regenera (documentado en `CLAUDE.md` / `AGENTS.md`).                                                                          |

---

## Qué **no** entra en esta spec

- Motor real para los otros juegos simulados; siguen con `GamePlayer`.
- Nueva entrada de juego, ficha, portada o textos para este juego (se reusa `bloque-buster`).
- Redibujar el tablero con primitivas neón en vez del spritesheet.
- Responsive real del canvas (recalcular tamaño y física).
- Vibración / haptics, entrada por gestos o swipe, `prefers-reduced-motion`.
- Cambios de balance, patrones de rejilla nuevos, power-ups nuevos o tipos de bloque nuevos.
- Persistir el nivel alcanzado o los bloques rotos en el leaderboard; leaderboards con más columnas o realtime.
- Audio de más eventos (lanzamiento, vida extra, game over) o música.
- Actualizar `best` o `plays` de `bloque-buster` a mano en la BD.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
