# SPEC 10 — Quinto juego real: Flappy-Ben en la entrada "flappy-ben"

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-09
> **Objective:** Escribir desde cero un clon de Flappy Bird como controlador imperativo TypeScript montado en un componente cliente para la nueva entrada de catálogo `flappy-ben`, usando el spritesheet de `references/started-games/06-FlappyBer/` para pájaro, tuberías, fondo y dígitos de score, y guardando la puntuación por el modal de fin de la plataforma.

---

## Por qué existe esta spec

A diferencia de `rocas`, `tetris`, `bloque-buster` y `snake`, `references/started-games/06-FlappyBer/` no trae un `game.js` que portar: solo `map.js` (91 líneas, expone `window.FLAPPY_ATLAS`, un mapa de coordenadas `{x,y,w,h}` hacia un spritesheet) y `spritesheets.jpg` (2816×1536, sin archivo de licencia). No hay lógica de juego, canvas, HUD, listeners ni estado que leer — es un juego **escrito desde cero**, guiado por el atlas de assets visuales que sí viene preparado (pájaros en 3 colores × 3 poses, tuberías verdes/naranjas, fondos día/noche, suelo, dígitos de score, medallas y botones de UI que en esta plataforma no se usan porque el modal "FIN DEL JUEGO" ya cumple ese rol).

Esta spec añade Flappy-Ben como quinto juego con motor real, siguiendo el mismo patrón imperativo que `lib/games/asteroids.ts` pero sin fuente literal que copiar: la mecánica (gravedad + aleteo, tuberías que se desplazan, colisión con suelo/techo/tubería, +1 punto por tubería superada) se implementa directamente en TypeScript.

Decisiones ya cerradas con el usuario (no reabrir):

- Id de catálogo **nuevo**: `flappy-ben` (ninguno de los 8 ids sembrados encaja temáticamente). Requiere migración.
- Categoría `ARCADE`, color de acento `magenta` (el menos saturado del catálogo actual).
- Pájaro `birds.yellow`, tuberías `pipes.green`, fondo `environment.backgroundDay` del atlas. Variantes azul/rojo, tuberías naranjas y fondo noche quedan sin usar.
- Canvas interno **480×720** (retrato), distinto del 800×600 4:3 de asteroides/tetris — los assets del atlas (fondo 1080×220, suelo 680×100) están pensados para una franja de vuelo vertical, no un canvas ancho.
- HUD de score **en canvas**, con los dígitos sprite `ui.numbers` del atlas. Se omite `onStats` por completo: Flappy Bird no tiene vidas ni nivel, y forzar ese contrato obligaría a inventar valores.
- Se descartan `ui.states.getReady`/`gameOver`, `ui.medals` y `ui.buttons` (start/restart/quit) del atlas — el modal de la plataforma ya es el dueño de inicio y fin de partida, igual que en asteroides/tetris/snake.
- Controles: `Space` y click/tap sobre el canvas aletean (tap-to-flap, fiel al original). Pad táctil de un único botón "ALETEAR".
- Tocar el suelo, el techo o una tubería termina la partida.
- Las coordenadas de `map.js` se portan a un `const ATLAS` tipado dentro de `lib/games/flappy-ben.ts`; `map.js` no se importa tal cual porque depende de un global `window.FLAPPY_ATLAS`, incompatible con un módulo TS puro.
- Se procede sin archivo de licencia para `spritesheets.jpg` — asumido por el usuario.

---

## Scope

**In:**

- **Fuente de referencia**: trackear con `git add` los 2 archivos nuevos de `references/started-games/06-FlappyBer/` (`map.js`, `spritesheets.jpg`), hoy sin versionar. Quedan como referencia de lectura del atlas de coordenadas; no entran al build de Next ni se importan desde `app/`.
- **Migración** `supabase/migrations/<ts>_flappy_ben.sql`: fila en `public.games` (`id: 'flappy-ben'`, `title: 'FLAPPY-BEN'`, `cat: 'ARCADE'`, `color: 'magenta'`, `cover: 'cover-flappy-ben'`, `sort` siguiente libre) + `insert into public.game_plays (game_id) values ('flappy-ben') on conflict do nothing`.
- **Controlador** `lib/games/flappy-ben.ts` (módulo TS puro, sin JSX ni React):
  - `createFlappyBenGame(canvas: HTMLCanvasElement, opts: FlappyBenOptions): FlappyBenHandle`.
  - `const ATLAS` tipado con las coordenadas portadas de `map.js` que se usan: `birds.yellow.{flapping,resting,gliding}`, `pipes.green.{top,bottom}`, `environment.backgroundDay`, `environment.ground`, `ui.numbers['0'..'9']`.
  - Física: gravedad constante, cada aleteo fija la velocidad vertical a un impulso negativo fijo (mecánica clásica, sin física acumulativa por tecla mantenida).
  - Tuberías: se generan a intervalo horizontal fijo, con un hueco vertical de posición aleatoria por par; se desplazan a velocidad constante hacia la izquierda; se descartan al salir del canvas por la izquierda; +1 punto la primera vez que el pájaro supera la coordenada `x` de un par sin colisionar.
  - Fondo y suelo se recortan del atlas y se dibujan con desplazamiento horizontal en bucle (offset módulo el ancho de la fuente) para dar sensación de scroll; el suelo además actúa como línea de colisión inferior.
  - HUD: score dibujado en canvas con los dígitos sprite de `ui.numbers`, centrado arriba.
  - Colisión bird↔tubería, bird↔suelo, bird↔techo (`y < 0`): cualquiera termina la partida.
  - Auto-arranca en estado `"playing"` al montar (sin pantalla "listo"): el pájaro cae por gravedad desde el primer frame.
  - En transición a `"gameover"`, invoca `opts.onGameOver(score)` una sola vez (flag `gameOverNotified`, reseteado en `initGame()`).
  - `pause()` detiene el scheduling de `requestAnimationFrame`; `resume()` lo reanuda reseteando `lastTime`; `restart()` = `initGame()` + `resume()`; `destroy()` cancela el rAF pendiente y quita los listeners de `window` (`keydown`/`keyup`) y del `canvas` (`mousedown`/`click`).
- **Componente** `components/flappy-ben-player.tsx` (`"use client"`), copia de `components/asteroids-player.tsx` con el engine intercambiado; sin fila de stats adicional en `.player-hud` (solo título + PAUSA/SALIR, igual que asteroides).
- **Controles táctiles**: `TOUCH_CONTROLS` de un único botón `{ label: "▲ ALETEAR", code: "Space", mode: "tap" }` + bloque `.touch-controls` que despacha `keydown`/`keyup` sintéticos en `window` (el motor no cambia).
- **Registro**: añadir `"flappy-ben": FlappyBenPlayer` a `GAME_REGISTRY` en `lib/games/registry.ts` (ya existe desde SPEC 05; no se crea de nuevo).
- **Enrutado**: sin cambios en `app/juego/[id]/jugar/page.tsx` — ya resuelve por `playerFor(game.id)`.
- **CSS** `app/globals.css`: bloque `.cover-flappy-ben` (junto a las demás portadas, base + `::after` con gradientes + `::before` con glifo); el `<canvas>` reutiliza la clase existente `.asteroids-canvas` (ya genérica, usada también por tetris/bloque-buster/snake) — sin renombrar.
- **Assets** `public/flappy-ben/sprite-sheet.jpg`: copia de `spritesheets.jpg` (único archivo de imagen usado).

**Out of scope (para futuras specs):**

- Motor real para los demás juegos aún simulados (`caida`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Variantes del atlas sin usar: pájaros azul/rojo, tuberías naranjas, fondo noche, medallas, pantalla "listo" y botones sprite de start/restart/quit.
- Responsive real del canvas (recalcular `W`/`H` y la física).
- Vibración/haptics, entrada por gestos o swipe (el pad táctil es solo de botones), `prefers-reduced-motion`.
- Dificultad progresiva (velocidad de tuberías o tamaño del hueco variando con el score); la partida usa parámetros fijos.
- Sonido.
- Leaderboards con más columnas o realtime.
- Archivo de licencia para `spritesheets.jpg` (no existe; se asume el derecho de uso).
- Tests automatizados (no hay framework configurado).

---

## Data model

Esta feature no introduce persistencia nueva: reusa `public.scores` vía `submit_score` (SPEC 06), una fila por `(user_id, game_id)` = mejor marca.

Formas nuevas en memoria, en `lib/games/flappy-ben.ts`:

```ts
interface FlappyBenOptions {
  onGameOver: (finalScore: number) => void;
}

interface FlappyBenHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

function createFlappyBenGame(canvas: HTMLCanvasElement, opts: FlappyBenOptions): FlappyBenHandle;
```

Estado interno (en el cierre de `createFlappyBenGame`):

```ts
// bird: { x, y, vy }
// pipes: { x, gapY, passed }[]
// score
// state: "playing" | "dead" | "gameover"
// bgOffset, groundOffset  (para el scroll en bucle)
// gameOverNotified
// W = 480, H = 720  (constantes; no responsive)
```

`ATLAS` (subconjunto de `map.js`, tipado):

```ts
const ATLAS = {
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
  numbers: {/* '0'..'9' → {x,y,w,h}, tal cual map.js */},
};
```

Estado local de `components/flappy-ben-player.tsx`: `paused`, `over`, `finalScore`, `saved`, `busy`, `saveErr`, `pending` (`"again" | "vault" | "login" | "exit" | null`), `locked = pending !== null || busy`, `heldRef: Set<string>` (codes con `keydown` sintético pendiente de `keyup`; con un único botón `tap` queda casi siempre vacío, pero se mantiene por consistencia con el resto de players).

Touch-pad:

```ts
type TouchMode = "hold" | "tap";
interface TouchControl {
  label: string;
  code: string;
  mode: TouchMode;
}
const TOUCH_CONTROLS: TouchControl[] = [{ label: "▲ ALETEAR", code: "Space", mode: "tap" }];
```

Convenciones (heredadas de SPEC 05):

- `lib/games/flappy-ben.ts` no importa React; solo toca `window`/DOM vía el `canvas`.
- `components/flappy-ben-player.tsx` lleva `"use client"`.
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component.
- Alias `@/*` para imports.

---

## Implementation plan

1. **Trackear la fuente y preparar el asset.** `git add` de `references/started-games/06-FlappyBer/map.js` y `spritesheets.jpg` (hoy sin versionar). Copiar `spritesheets.jpg` a `public/flappy-ben/sprite-sheet.jpg`. Verificación: `git status` muestra ambos archivos de `references/` como añadidos; `public/flappy-ben/sprite-sheet.jpg` existe; `npm run build` sigue compilando.
2. **Migración.** `supabase/migrations/<ts>_flappy_ben.sql` con `insert into public.games (...)` (`id: 'flappy-ben'`, `cat: 'ARCADE'`, `color: 'magenta'`, `cover: 'cover-flappy-ben'`, `sort` libre) + `insert into public.game_plays (game_id) values ('flappy-ben') on conflict do nothing`. Aplicar con MCP `apply_migration`. Verificación: `select` anónimo devuelve la fila; `games_with_stats` la incluye con `best = 0`, `plays = 0`.
3. **Esqueleto del controlador.** Crear `lib/games/flappy-ben.ts` con `createFlappyBenGame(canvas, opts)`: valida `opts.onGameOver`, fija `canvas.width = 480`/`canvas.height = 720`, obtiene el `2d`, carga la imagen de `ATLAS.src`, monta `keydown`/`keyup` en `window` (`preventDefault` en `Space`) y `mousedown`/`click` en el `canvas`, y un bucle `requestAnimationFrame` vacío. Devuelve `{ pause, resume, restart, destroy }`. Verificación: `npm run lint` limpio; el canvas muestra el fondo estático; `destroy()` no deja listeners.
4. **Lógica de partida.** Implementar gravedad + aleteo, generación/movimiento/descarte de tuberías, colisión (tubería, suelo, techo), score (+1 por tubería superada), scroll en bucle de fondo/suelo, HUD con dígitos sprite, y el bucle con `dt` acotado a 0.05 s. Al entrar en game over, `opts.onGameOver(score)` una sola vez (`gameOverNotified`, reseteada en `initGame()`). `pause()` deja de programar rAF; `resume()` resetea `lastTime`; `restart()` = `initGame()` + `resume()`. Verificación: jugable de principio a fin; aletear con `Space` o click sube al pájaro; morir contra tubería/suelo/techo dispara `onGameOver` con el score correcto.
5. **Componente cliente.** Crear `components/flappy-ben-player.tsx` (`"use client"`) copiando `components/asteroids-player.tsx`: marco `.av-player`/`.crt`/`.crt-screen`/`.crt-bottom` con `<canvas ref>` 480×720, botones PAUSA/REANUDAR y SALIR, `useEffect([game.id])` que crea el juego y limpia con `destroy()`. `onGameOver` → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`. Modal "FIN DEL JUEGO": con sesión `await submitScore(game.id, finalScore)` + toast; sin sesión CTA "INICIA SESIÓN PARA GUARDAR" → `/login`. "JUGAR DE NUEVO" → `handle.restart()` + cerrar modal; "VOLVER AL VAULT" → `/juegos`. Añadir `"flappy-ben": FlappyBenPlayer` a `GAME_REGISTRY`. Verificación: `/juego/flappy-ben/jugar` muestra el canvas real; PAUSA congela; morir abre el modal; guardar con sesión añade la marca en `public.scores`.
6. **Pad táctil.** En `components/flappy-ben-player.tsx`: `TOUCH_CONTROLS` de un botón, bloque `<div className="touch-controls">` hermano de `.crt`. `press`/`release` = `window.dispatchEvent(new KeyboardEvent("keydown"|"keyup", { code: "Space", bubbles: true }))`. `onPointerDown` → `preventDefault()` + `press`; `mode: "tap"` → `release` en el siguiente `requestAnimationFrame`. `heldRef` registra lo pendiente; el cleanup del `useEffect` hace `release` de todo. `<button type="button">`, `onContextMenu` con `preventDefault`. Verificación: en emulación móvil (pointer coarse) el botón se ve y aletea igual que `Space`/click; en escritorio no se ve; al desmontar no queda ninguna tecla sintética "pegada".
7. **Portada CSS.** En `app/globals.css`: bloque `.cover-flappy-ben` (base + `::after` con gradientes + `::before` con glifo, p. ej. `▲` o un pico estilizado) junto a las demás portadas. El `<canvas>` reutiliza `.asteroids-canvas` sin cambios. Verificación: la portada se ve en `/juegos`; el canvas 480×720 escala sin deformar ni scroll horizontal en los breakpoints existentes.
8. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos; consola sin warnings de hidratación en `/juego/flappy-ben/jugar`; al pulsar SALIR no quedan listeners `keydown`/`keyup`/`mousedown`/`click` ni `requestAnimationFrame` activos. Confirmar que el bloque regenerado de `AGENTS.md` va junto al commit.

---

## Acceptance criteria

- [x] `/juego/flappy-ben/jugar` renderiza un `<canvas>` 800×600 (paisaje, ver Enmienda 2) con el juego real, no la arena simulada de `div`.
- [ ] `Space` y click/tap sobre el canvas aletean: el pájaro recibe un impulso vertical hacia arriba instantáneo.
- [ ] La gravedad tira del pájaro hacia abajo constantemente cuando no se aletea.
- [ ] Las tuberías se generan a intervalo horizontal fijo, se desplazan hacia la izquierda y desaparecen al salir del canvas.
- [ ] Superar una tubería sin colisionar suma exactamente 1 punto.
- [ ] Tocar una tubería, el suelo o el techo (`y < 0`) termina la partida.
- [x] El HUD (score) se dibuja en el canvas como texto vectorial (`ctx.fillText`), no con un atlas de sprites (ver enmienda: `map.js` traía coordenadas "estimadas" inservibles).
- [ ] Al llegar a game over se abre el modal "FIN DEL JUEGO" con la puntuación final; ninguna tecla reinicia el canvas por su cuenta.
- [ ] Con sesión, "GUARDAR PUNTUACIÓN" llama a `submit_score` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`; una segunda partida solo actualiza la fila si el score sube.
- [ ] Sin sesión, el modal no tiene input de guardado; aparece el CTA a `/login`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, pájaro en posición inicial, sin tuberías) y cierra el modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle y cambia a `REANUDAR`; al reanudar no hay salto de `dt` (el pájaro no "teletransporta").
- [ ] `SALIR` navega a `/juego/flappy-ben`; tras salir no quedan listeners `keydown`/`keyup`/`mousedown`/`click` ni `requestAnimationFrame` en marcha, ni teclas sintéticas mantenidas.
- [ ] En un dispositivo táctil (`@media (pointer: coarse)`) aparece el pad `.touch-controls` con un único botón "ALETEAR" que aletea igual que `Space`.
- [ ] En escritorio (pointer fino) el pad no se muestra y el layout no cambia; pulsar el botón no roba el foco ni abre el menú contextual de long-press.
- [ ] El juego aparece en `/juegos`, en la preview de la home y en `/salon` (filtro `isPlayable`); el resto de juegos sigue con su player actual sin cambios.
- [ ] La portada `.cover-flappy-ben` se ve en el grid; el `<canvas>` escala sin deformación ni scroll horizontal en los breakpoints existentes.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos; sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** id de catálogo nuevo `flappy-ben` — ninguno de los 8 ids sembrados (bloque-buster, caida, serpentina, gloton, invasores, rocas, ranaria, duelo-pixel) encaja temáticamente. Elegido por el usuario.
- **Sí:** categoría `ARCADE`, color `magenta` — es el color menos saturado del catálogo actual (solo `caida` lo usa hoy). Elegido por el usuario.
- **Sí:** juego escrito desde cero guiado por el atlas de sprites, no port de código — `references/started-games/06-FlappyBer/` no trae `game.js`, solo el mapa de coordenadas y la imagen. Verificado leyendo ambos archivos.
- ~~**Sí:** canvas interno 480×720 (retrato).~~ Revertido en la Enmienda 2: pasa a 800×600 paisaje, igual que asteroides.
- **Sí:** HUD de score en canvas con los dígitos sprite `ui.numbers`; se omite `onStats`. Flappy Bird no tiene vidas ni nivel — forzar ese contrato obligaría a inventar valores sin sentido en la fila `.player-hud`. Elegido por el usuario.
- **No:** usar `ui.states.getReady`/`gameOver`, `ui.medals` o `ui.buttons` (start/restart/quit) del atlas. El modal "FIN DEL JUEGO" de la plataforma ya es el dueño de inicio y fin de partida, igual que en asteroides/tetris/snake; duplicar esa UI en el canvas descoordinaría el estado. Elegido por el usuario.
- **Sí:** pájaro `birds.yellow`, tuberías `pipes.green`, fondo `environment.backgroundDay`. Variantes azul/rojo, tuberías naranjas y fondo noche quedan sin usar en esta spec. Elegido por el usuario.
- **Sí:** las coordenadas de `map.js` se portan a un `const ATLAS` tipado dentro de `lib/games/flappy-ben.ts`; no se importa `map.js` tal cual. `map.js` depende de un global `window.FLAPPY_ATLAS`, incompatible con un módulo TS puro sin scope global. (Heredado del patrón de `asteroids.ts`: sin `<Script>` ni dynamic import de código con auto-arranque global.)
- **Sí:** `Space` y click/tap sobre el canvas aletean (tap-to-flap, fiel al gesto original). Pad táctil de un único botón "ALETEAR" (`code: "Space"`, `mode: "tap"`). Elegido por el usuario.
- **Sí:** tocar suelo, techo o tubería termina la partida — fiel a la mecánica clásica de Flappy Bird. Elegido por el usuario.
- **Sí:** auto-arranque en `"playing"` al montar, sin pantalla "listo" previa — coherente con descartar `ui.states.getReady` y con que los demás juegos portados también arrancan la partida al montar el componente.
- **No:** dificultad progresiva (velocidad de tuberías o hueco variando con el score). Parámetros fijos para el MVP; balance queda fuera de scope.

### Enmienda durante la implementación: se descarta el atlas de sprites

Al probar el Paso 7 en navegador, el fondo/pájaro/tuberías se veían como recortes
aleatorios de una hoja de referencia con grid y texto ("GLIDING"), no como un
spritesheet limpio. Causa: `map.js` dice literalmente en su cabecera
"Coordenadas **estimadas** según la hoja de sprites generada" — nunca fueron
coordenadas verificadas contra el archivo real, y no coinciden con
`spritesheets.jpg`. Esto invalida las decisiones "Sí" de arriba sobre
`birds.yellow`/`pipes.green`/`environment.backgroundDay`, `ui.numbers` y el
`const ATLAS` tipado.

- **No (revierte la decisión de arriba):** dibujar con el atlas de sprites.
  `map.js` es inservible tal cual; usarlo exigiría medir manualmente cada recorte
  sobre `spritesheets.jpg`, fuera de proporción con un MVP. Decisión del usuario,
  con capturas de pantalla como evidencia.
- **Sí:** pájaro, tuberías, fondo y HUD se dibujan como **vectores neón en
  canvas** (`ctx.fillStyle`/`strokeStyle` + `shadowBlur` para el glow), en el
  mismo estilo que `asteroids.ts` y el resto de motores del portal (ninguno de
  los otros usa spritesheets). Paleta: pájaro amarillo (`--yellow #f5ff00`),
  tuberías verdes (`--green #00ff88`), acentos cian/magenta (`--cyan #00f5ff`,
  `--magenta #ff006e`) para fondo y HUD. Elegido por el usuario.
- **Sí:** el HUD de score pasa a `ctx.fillText` con fuente monoespaciada (como
  `drawHUD` en `asteroids.ts`), no dígitos sprite — ya no hay imagen de la que
  recortarlos.
- **No:** `public/flappy-ben/sprite-sheet.jpg` y el `const ATLAS`. Se eliminan
  del controlador; `references/started-games/06-FlappyBer/{map.js,spritesheets.jpg}`
  quedan solo como referencia histórica de por qué se descartó ese camino.
- ~~**Sí:** el `<canvas>` pasa a ocupar todo el ancho disponible del `.crt-screen`
  vía `.crt-screen.flappy-ben { aspect-ratio: 2/3 }`, manteniendo 480×720
  retrato.~~ Superado por la siguiente enmienda: se cambia directamente el
  formato interno a paisaje, sin necesidad de override de CSS.
- ~~**Sí:** proceder sin archivo de licencia para `spritesheets.jpg`.~~ Sin objeto tras la enmienda: la imagen ya no se usa en el juego.
- **Sí (heredado SPEC 05/06):** port a controlador imperativo TS (`createFlappyBenGame(canvas, opts) → handle`), guardado desde el modal de plataforma con `submitScore`, `pause()`/`resume()` con reset de `lastTime`, registro central `GAME_REGISTRY` (ya existente, solo se añade una entrada), y pad táctil que despacha `KeyboardEvent` sintéticos en `window` sin tocar el contrato del `Handle`.

### Enmienda 2: canvas en paisaje (800×600), no retrato

Con el render vectorial ya en pantalla, el usuario pidió explícitamente un área
de juego más ancha que alta ("ESTA MUY LARGO... QUIERO QUE ESTE MAS ANCHO NO
LARGO"). Se cambian las coordenadas internas de 480×720 (2:3 retrato) a
**800×600 (4:3 paisaje)** — el mismo formato que `asteroids.ts` — con lo que
`.crt-screen` vuelve a usar su `aspect-ratio: 4/3` por defecto y se retira el
override `.crt-screen.flappy-ben` de la Enmienda 1 (ya no hace falta).

- **Sí:** `W = 800`, `H = 600`. Reescala proporcionalmente `BIRD_X` (`W * 0.22`),
  `GROUND_H` (70), `PIPE_GAP` (170), `PIPE_MARGIN` (70), y sube ligeramente
  `PIPE_SPEED` (200 px/s) y baja `PIPE_SPAWN_INTERVAL` (1.3 s) para que el ritmo
  de tuberías se sienta similar con más ancho de pantalla que recorrer. Elegido
  por el usuario.
- **No:** mantener `.crt-screen.flappy-ben` con `aspect-ratio: 2/3`. Ya no
  aplica: el nuevo 800×600 encaja en el `.crt-screen` 4:3 por defecto sin
  letterbox, igual que asteroides.

---

## Riesgos

| Riesgo                                                                                                           | Mitigación                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~`spritesheets.jpg` sin licencia~~ / ~~carga asíncrona de la imagen~~                                           | Sin objeto tras la enmienda: el motor ya no carga ninguna imagen, todo se dibuja como vectores.                                                              |
| `map.js` traía coordenadas "estimadas" que no correspondían al spritesheet real (recortes ilegibles en pantalla) | Se descartó el atlas por completo; pájaro/tuberías/fondo/HUD se dibujan con formas vectoriales en la paleta neón del portal. Ver enmienda en `## Decisions`. |
| Colisión pájaro↔tubería por bounding box exacto del sprite se siente injusta (hitbox más grande que el ave)      | El motor usa una hitbox ligeramente menor que el sprite (margen fijo en píxeles), documentado como constante en el código, no ajustable desde fuera.         |
| El array de tuberías crece sin límite si no se descartan al salir de pantalla                                    | `update(dt)` filtra las tuberías con `x + w < 0` en cada frame antes de dibujar.                                                                             |
| `requestAnimationFrame` o los listeners (`window` y `canvas`) sobreviven al desmontar                            | `createFlappyBenGame` guarda el id de rAF y las referencias de los handlers; `destroy()` las limpia. Un criterio lo verifica con SALIR.                      |
| `Space` o el click activan scroll de página o un botón enfocado                                                  | El listener hace `preventDefault` en `Space`; el `click`/`mousedown` se registra solo sobre el `canvas`, no en `window`.                                     |
| Una tecla sintética del pad se queda "pegada" si el `pointerup` se pierde                                        | `heldRef` registra el `keydown` sintético pendiente; el cleanup del `useEffect` hace `release` de todo lo pendiente al desmontar.                            |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render                     | El `<canvas>` se monta vacío; `createFlappyBenGame` solo toca `window`/DOM dentro de `useEffect`.                                                            |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                                            | Se commitea junto al trabajo (documentado en `CLAUDE.md` / `AGENTS.md`).                                                                                     |

---

## Qué **no** entra en esta spec

- Motor real para los demás juegos aún simulados (`caida`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Variantes del atlas sin usar: pájaros azul/rojo, tuberías naranjas, fondo noche, medallas y botones sprite de start/restart/quit.
- Responsive real del canvas (recalcular `W`/`H` y la física).
- Vibración/haptics, entrada por gestos o swipe, `prefers-reduced-motion`.
- Dificultad progresiva (velocidad o hueco de tuberías variando con el score).
- Sonido.
- Leaderboards con más columnas o realtime.
- Archivo de licencia para `spritesheets.jpg`.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
