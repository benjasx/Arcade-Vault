# SPEC 05 — Primer juego real: Asteroides en la entrada "rocas"

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-05
> **Objective:** Portar el juego canvas de `references/started-games/02-asteroides/game.js` a un controlador imperativo TypeScript montado en un componente cliente que sustituye la partida simulada solo para la entrada `rocas`, conservando su HUD en canvas y guardando la puntuación final por el modal de fin de la plataforma.

---

## Por qué existe esta spec

SPEC 01 portó la pantalla Player (`components/game-player.tsx`) con la partida **simulada** del prototipo: el score sube por `setInterval` y la arena CRT son `div` animados. El juego real de asteroides ya existe en `references/started-games/02-asteroides/`: un canvas HTML5 vanilla ES6 en un solo archivo `game.js` (~561 líneas), 800×600 fijo, scope global, que se auto-arranca al cargar, registra los listeners de teclado en `window` y dibuja HUD y "GAME OVER" en el propio canvas. Incluye power-ups (P/B/S/M) y asteroides que se parten por tamaño.

Esta spec adapta ese juego a Next.js 16 / React 19 sin reescribir su lógica: se encapsula en un controlador imperativo con ciclo de vida (`crear` / `pausar` / `reanudar` / `reiniciar` / `destruir`) y un solo callback hacia la plataforma, `onGameOver(finalScore)`. Un componente cliente nuevo lo monta dentro del marco CRT y, al morir, abre el modal "FIN DEL JUEGO" de la plataforma para guardar la puntuación en `localStorage av_scores` (mismo flujo que `game-player.tsx`).

Decisiones ya cerradas con el usuario (no reabrir):

- El juego real se asocia a la entrada **existente** `rocas` de `lib/data.ts`. No se crea un id nuevo.
- Port a **controlador imperativo TS** (`lib/games/asteroids.ts`), no reescritura en hooks ni carga de `game.js` casi literal.
- HUD y pantalla de "GAME OVER" se siguen dibujando **en el canvas**; la plataforma solo aporta marco CRT y botones.
- La puntuación se guarda desde el **modal de la plataforma** al recibir `onGameOver`; el reinicio por Espacio del canvas se desactiva.
- Se conservan **SALIR y PAUSA**; se quitan la fila de stats de React y el botón FIN para este juego.
- El canvas mantiene **coordenadas internas 800×600** y se escala por CSS a la pantalla CRT con proporción fija.
- Se **mantienen los power-ups** tal cual vienen en `game.js`.
- La fuente (`references/started-games/02-asteroides/`) se **copia a la rama de la spec** desde `origin/fix-submodules-netlify`, donde hoy en `main` es un gitlink de submódulo sin checkout.

---

## Scope

**In:**

- **Fuente de referencia**: materializar como archivos planos en la rama los 5 archivos de `references/started-games/02-asteroides/` (`game.js`, `index.html`, `README.md`, `CLAUDE.md`, `favicon.svg`) desde `origin/fix-submodules-netlify`, quitando antes el gitlink de submódulo del índice. Quedan como referencia de lectura; no entran en el build de Next ni se importan desde `app/`.
- **Controlador** `lib/games/asteroids.ts` (módulo TS puro, sin JSX ni React):
  - `createAsteroidsGame(canvas: HTMLCanvasElement, opts: AsteroidsOptions): AsteroidsHandle`.
  - Port tipado de `game.js`: utilidades (`wrap`, `dist`, `rand`, `randInt`), entidades (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`), constantes (`RADII`, `SPEEDS`, `POINTS`, constantes de power-up), estado del juego, `spawnAsteroids`, `initGame`, `spawnPowerUp`, `applyPowerUp`, `nextLevel`, `explode`, `killShip`, `update(dt)`, `draw()`, `drawHUD`, `drawLifeIcon`, `drawOverlay`, bucle `requestAnimationFrame`. El estado, hoy `let` a nivel de módulo, pasa a vivir en el cierre de `createAsteroidsGame`.
  - `create` fija `canvas.width = 800` y `canvas.height = 600`, registra `keydown`/`keyup` en `window` (con `preventDefault` para flechas y `Space`, como el original) y arranca el loop.
  - En estado `gameover`: **no** se reinicia con `Space`. En su lugar, al detectar la transición a `gameover` se llama `opts.onGameOver(score)` una sola vez.
  - `pause()` detiene el scheduling de `requestAnimationFrame`. `resume()` lo reanuda reseteando `lastTime` para evitar salto de `dt`. `restart()` llama `initGame()` y reanuda. `destroy()` cancela el rAF pendiente y quita los listeners de teclado.
  - Se conservan los power-ups (P/B/S/M) y todo el balance del original sin cambios.
- **Componente** `components/asteroids-player.tsx` (`"use client"`):
  - Marco CRT reutilizando clases de `app/globals.css` (`.av-player`, `.crt`, `.crt-screen`, `.crt-bottom`), con `<canvas>` referenciado por `ref`.
  - Botones: `PAUSA` / `REANUDAR` (alterna `handle.pause()` / `handle.resume()` + estado local) y `SALIR` → `router.push('/juego/' + game.id)`. Sin fila de stats ni botón FIN.
  - `useEffect(() => { const h = createAsteroidsGame(canvasRef.current!, { onGameOver }); return () => h.destroy(); }, [])`.
  - `onGameOver(finalScore)` guarda `finalScore` en estado y abre el modal "FIN DEL JUEGO" con el mismo marcado y clases que `game-player.tsx` (`.modal-bd`, `.modal`, `.final`, `.input-row`, `.toast-saved`, `.actions`): input de iniciales (mayúsculas, ≤ 10 chars), `GUARDAR PUNTUACIÓN` → `saveScore({ game: game.id, score: finalScore, name })` + toast `▸ PUNTUACIÓN GUARDADA_`, `JUGAR DE NUEVO` → `handle.restart()` + cierra modal + resetea `saved`, `VOLVER AL VAULT` → `router.push('/juegos')`.
  - Nombre inicial del input: `useAuth().user?.name ?? "INVITADO"`.
- **Enrutado** `app/juego/[id]/jugar/page.tsx`: si `id === "rocas"` renderiza `<AsteroidsPlayer game={game} />`; para el resto de ids sigue renderizando `<GamePlayer game={game} />`. `notFound()` si el juego no existe (sin cambios).
- **CSS** `app/globals.css`: bloque mínimo nuevo para escalar el `<canvas>` de asteroides dentro de `.crt-screen` manteniendo proporción 4:3 (letterbox si sobra espacio), sin overflow horizontal en los breakpoints existentes.

**Out of scope (para futuras specs):**

- Motor real para los otros 7 juegos de `GAMES`; siguen con `GamePlayer` simulado.
- Nueva entrada de juego, ficha, portada (`cover-*`) o textos para asteroides; se reusa `rocas` intacto.
- Leaderboards con datos reales: leer y rankear `av_scores` en `/juego/[id]` o `/salon` (siguen con `seededScores`).
- Puntuaciones en Supabase (SPEC 04 dejó el cliente listo pero sin tablas).
- HUD de la plataforma en React para este juego, o botón "fin forzado".
- Responsive real del canvas (recalcular `W`/`H` y la física); solo se escala por CSS.
- Sonido, vibración, controles táctiles/móviles, `prefers-reduced-motion`.
- Cambios de balance, power-ups nuevos o tipos de asteroide (la "estrella fugaz" que menciona el README).
- Tests automatizados (no hay framework configurado).
- Actualizar `best` o `plays` de `rocas` en `lib/data.ts`.

---

## Data model

Esta feature no introduce estructuras persistentes nuevas. La persistencia sigue en `localStorage` clave `av_scores` con el tipo `SavedScore` ya definido en `lib/scores.ts` (`{ game, score, name, at }`), escrito por `saveScore` desde el modal.

Formas nuevas en memoria, en `lib/games/asteroids.ts`:

```ts
interface AsteroidsOptions {
  onGameOver: (finalScore: number) => void;
}

interface AsteroidsHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

function createAsteroidsGame(canvas: HTMLCanvasElement, opts: AsteroidsOptions): AsteroidsHandle;
```

Estado interno del juego (portado de `game.js`, ahora en el cierre, sin cambios de semántica):

```ts
// ship, bullets, asteroids, particles, powerups
// score, lives, level
// state: "playing" | "dead" | "gameover"
// deadTimer, tripleShotTimer, thrustBoostTimer, shieldTimer, slowMoTimer
// asteroidsDestroyed
// W = 800, H = 600  (constantes; no responsive)
```

Estado local de `components/asteroids-player.tsx`:

```ts
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [name, setName] = useState<string>(() => user?.name ?? "INVITADO");
const [saved, setSaved] = useState(false);
```

Convenciones (heredadas de SPEC 01):

- `lib/games/asteroids.ts` no importa React y solo toca `window`/DOM cuando se le pasa el `canvas`.
- `components/asteroids-player.tsx` lleva `"use client"` (usa `ref`, estado, `useEffect`, `useRouter`, `useAuth`).
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component que resuelve `params`.
- Alias `@/*` para imports (`@/lib/games/asteroids`, `@/lib/scores`, `@/lib/data`).

---

## Implementation plan

1. **Traer la fuente.** Quitar el gitlink de submódulo del índice (`git rm --cached references/started-games/02-asteroides`) y materializar los 5 archivos desde `origin/fix-submodules-netlify` (`git checkout origin/fix-submodules-netlify -- references/started-games/02-asteroides`). Verificación: `references/started-games/02-asteroides/game.js` se lee como archivo plano; `git status` lo muestra como archivos añadidos, no como submódulo; `npm run build` sigue compilando (la carpeta no entra en el build).
2. **Esqueleto del controlador.** Crear `lib/games/asteroids.ts` con `createAsteroidsGame(canvas, opts)`: fija `canvas.width/height` a 800/600, obtiene el `2d` context, pinta el fondo negro, monta `keydown`/`keyup` en `window` (con `preventDefault` para flechas y `Space`) y un bucle `requestAnimationFrame` vacío. Devuelve `{ pause, resume, restart, destroy }` con `destroy` quitando listeners y cancelando el rAF. Verificación: `npm run lint` limpio; montado en una prueba manual, el canvas se ve negro y `destroy()` deja la consola sin listeners colgando.
3. **Entidades y utilidades.** Portar a TS tipado dentro del módulo: `wrap`, `dist`, `rand`, `randInt`; clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`; arrays `RADII`, `SPEEDS`, `POINTS` y las constantes de power-up (`POWERUP_*`, `TRIPLE_SHOT_SPREAD`, `THRUST_BOOST_MULT`, `SLOWMO_FACTOR`, `POWERUP_LABELS`). Verificación: `npm run build` sin errores de tipos; sin uso todavía en `update`/`draw`.
4. **Lógica de partida.** Portar estado + `spawnAsteroids`, `initGame`, `spawnPowerUp`, `applyPowerUp`, `nextLevel`, `explode`, `killShip`, `update(dt)`, `draw()`, `drawHUD`, `drawLifeIcon`, `drawOverlay` y el cálculo de `dt` del loop (cap a 0.05 s). Cambios respecto al original: en `state === "gameover"` **no** se llama `initGame()` con `Space`; al entrar en `gameover` se invoca `opts.onGameOver(score)` una sola vez (flag `gameOverNotified`). `drawOverlay` de game over pierde la línea "ESPACIO PARA REINICIAR". Implementar `pause()` (deja de programar rAF), `resume()` (`lastTime = null` y reanuda), `restart()` (`initGame()` + `resume()`). Verificación: montado en prueba manual, el juego es jugable de principio a fin; al morir se dispara `onGameOver` con el score correcto y el canvas no se reinicia con Espacio.
5. **Componente cliente.** Crear `components/asteroids-player.tsx` (`"use client"`): marco `.av-player` / `.crt` / `.crt-screen` / `.crt-bottom` con `<canvas ref>`, botones `PAUSA`/`REANUDAR` y `SALIR`. `useEffect([])` crea el juego y limpia con `destroy()`. `onGameOver` → `setFinalScore`, `setOver(true)`. Modal "FIN DEL JUEGO" con el marcado de `game-player.tsx` (input iniciales, `saveScore({ game: game.id, score: finalScore, name })`, toast, `JUGAR DE NUEVO` → `handle.restart()` + cerrar modal + `setSaved(false)`, `VOLVER AL VAULT` → `/juegos`). Nombre inicial `user?.name ?? "INVITADO"`. Verificación: renderizado directo del componente muestra el canvas real; `PAUSA` congela; morir abre el modal; guardar añade a `av_scores`.
6. **Enrutado.** En `app/juego/[id]/jugar/page.tsx`, tras resolver `game`, `return game.id === "rocas" ? <AsteroidsPlayer game={game} /> : <GamePlayer game={game} />`. Verificación: `/juego/rocas/jugar` carga el canvas real; `/juego/caida/jugar` y los otros 6 siguen con la simulación sin cambios.
7. **Escalado CSS.** Añadir a `app/globals.css` un bloque para el `<canvas>` de asteroides dentro de `.crt-screen`: proporción 4:3 fija, `max-width`/`max-height` al contenedor, centrado (letterbox). Verificación: en pantalla ancha y en el breakpoint de 720px el canvas escala sin deformar y la página no hace scroll horizontal.
8. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos; consola sin warnings de hidratación en `/juego/rocas/jugar`; al pulsar SALIR no quedan listeners `keydown`/`keyup` ni `requestAnimationFrame` activos. Confirmar que el bloque regenerado de `AGENTS.md` va junto al commit.

---

## Acceptance criteria

- [ ] `references/started-games/02-asteroides/game.js` y los otros 4 archivos existen como archivos planos en la rama; `git status` ya no lo trata como gitlink de submódulo.
- [ ] `/juego/rocas/jugar` renderiza un `<canvas>` con el juego real (nave triangular, asteroides irregulares), no la arena simulada de `div`.
- [ ] Flecha izquierda/derecha rota la nave, flecha arriba propulsa, `Space` dispara; balas, nave y asteroides hacen wrap por los bordes.
- [ ] Disparar a un asteroide grande lo parte en dos medianos; mediano en dos pequeños; pequeño desaparece; el score sube 20 / 50 / 100 según tamaño.
- [ ] El HUD (`SCORE`, `NIVEL`, iconos de vida) se dibuja dentro del canvas; al quedar 0 asteroides sube de nivel y aparecen `3 + nivel` asteroides grandes.
- [ ] Cada 5 asteroides destruidos aparece un power-up (P/B/S/M, máximo 2 en pantalla); recogerlo aplica su efecto con cuenta atrás en el HUD.
- [ ] Chocar con un asteroide sin invencibilidad ni escudo resta una vida; con 0 vidas el juego pasa a game over.
- [ ] Al llegar a game over se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final; pulsar `Space` no reinicia el canvas.
- [ ] En el modal, `GUARDAR PUNTUACIÓN` añade una entrada `{ game: "rocas", score, name, at }` a `localStorage.av_scores` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, 3 vidas, nivel 1) y cierra el modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle del juego y cambia a `REANUDAR`; al reanudar no hay salto de `dt` (la nave y los asteroides no "teletransportan").
- [ ] `SALIR` navega a `/juego/rocas`; tras salir no quedan listeners `keydown`/`keyup` ni `requestAnimationFrame` en marcha.
- [ ] `/juego/caida/jugar` y el resto de juegos siguen usando `GamePlayer` simulado, sin cambios de comportamiento.
- [ ] El nombre inicial del input del modal es el del usuario con sesión, o `INVITADO` sin sesión.
- [ ] El `<canvas>` escala a la pantalla CRT manteniendo proporción 4:3, sin deformación ni scroll horizontal en los breakpoints existentes.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos; sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** reusar la entrada `rocas` de `lib/data.ts`. Ya está descrita como asteroides ("Pulveriza asteroides en gravedad cero", categoría SHOOTER); un id nuevo duplicaría ficha y portada. Elegido por el usuario.
- **Sí:** port a un controlador imperativo (`lib/games/asteroids.ts`, `createAsteroidsGame(canvas, opts) → handle`). Mantiene la lógica de `game.js` casi intacta (menos regresiones) y aísla el bucle de 60 fps del ciclo de render de React. Elegido por el usuario.
- **No:** reescritura idiomática en React (estado en refs/hooks). Más trabajo y más superficie de bugs sin beneficio para un canvas.
- **No:** cargar `game.js` casi literal con `<Script>` o dynamic import. El scope global, el `getElementById("canvas")` fijo y el auto-arranque chocan con montaje/desmontaje repetido en el App Router.
- **Sí:** HUD y título "GAME OVER" siguen dibujándose en el canvas. Es como está escrito el juego; extraerlos a React obligaría a un puente de estado por frame. Elegido por el usuario.
- **Sí:** la puntuación se guarda desde el modal "FIN DEL JUEGO" de la plataforma, disparado por `onGameOver(finalScore)`. Reutiliza el flujo de `game-player.tsx` (iniciales + `saveScore` + toast) y mantiene consistencia con los otros juegos. Elegido por el usuario.
- **Sí:** desactivar el reinicio por `Space` del canvas en game over. El modal es el dueño del reinicio; mantener ambos duplicaría la acción y descoordinaría el estado de React.
- **Sí:** conservar `PAUSA` y `SALIR`, quitar la fila de stats de React y el botón `FIN` para este juego. El HUD ya está en el canvas (stats redundantes) y "fin forzado" no aporta en un Asteroids real. El split se hace en `page.tsx` por `id === "rocas"`, así `game-player.tsx` no se toca. Elegido por el usuario.
- **Sí:** `pause()` detiene el `requestAnimationFrame` y `resume()` resetea `lastTime`. El loop ya capa `dt` a 0.05 s, pero congelar el scheduling es más limpio que confiar en el cap.
- **Sí:** mantener los power-ups (P/B/S/M) tal cual vienen en `game.js`. Menos edición y menos riesgo que podar el sistema. Elegido por el usuario.
- **Sí:** coordenadas internas 800×600 y escalado del `<canvas>` por CSS con proporción fija. No hay que tocar `W`/`H` ni la física; solo el tamaño de presentación. Elegido por el usuario.
- **No:** responsive real (recalcular `W`/`H`). El original fija el tamaño y toda la física asume 800×600; escalar por CSS basta para el MVP.
- **No:** integrar `av_scores` real en los leaderboards de detalle/salón. Siguen con `seededScores`; leer puntuaciones reales es otra spec (ya diferido en SPEC 01).
- **No:** usar Supabase para las puntuaciones. SPEC 04 solo dejó el cliente listo, sin tablas; la persistencia sigue en `localStorage av_scores`.
- **No:** sonido, controles táctiles/móviles y `prefers-reduced-motion`. Fuera de scope, consistente con specs anteriores (el juego no tiene audio).
- **Sí:** copiar los 5 archivos de `02-asteroides` a la rama de la spec desde `origin/fix-submodules-netlify`. En `main` ese path es un gitlink de submódulo sin checkout; sin la fuente no se puede portar. Elegido por el usuario.

---

## Riesgos

| Riesgo                                                                                                                                           | Mitigación                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/started-games/02-asteroides` es un gitlink de submódulo en `main`; añadir archivos planos encima puede dejar el índice inconsistente | El paso 1 quita el gitlink con `git rm --cached` antes de materializar los archivos desde `origin/fix-submodules-netlify`.                                      |
| Divergencia o conflicto con la rama `fix-submodules-netlify`, que hace la misma conversión                                                       | Aceptado: la rama de la spec incluye los archivos; si `fix-submodules-netlify` se mergea antes, se resuelve el conflicto a favor de los archivos planos.        |
| `requestAnimationFrame` o los listeners de teclado sobreviven al desmontar el componente                                                         | `createAsteroidsGame` guarda el id de rAF y las referencias de los handlers en el cierre; `destroy()` cancela y desregistra. Un criterio lo verifica con SALIR. |
| `Space` dispara y además hace scroll de la página o activa un botón enfocado                                                                     | El listener hace `preventDefault` para flechas y `Space` (como el original); PAUSA/SALIR no roban el foco al canvas en uso normal.                              |
| TypeScript strict: `game.js` usa objetos con `dead`, arrays indexados por tamaño y clases sin tipos                                              | El port tipa entidades como clases/`interface`s; el paso 3 no cierra hasta que `npm run build` pasa sin errores de tipos.                                       |
| El canvas escalado por CSS se ve borroso o el input queda desalineado                                                                            | El juego solo usa teclado (no posición de ratón); el escalado mantiene 4:3, así que no hay desalineación de input. La nitidez es aceptable para el MVP.         |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render                                                     | El `<canvas>` se monta vacío; `createAsteroidsGame` solo toca `window`/DOM dentro de `useEffect`. Criterio de aceptación lo verifica.                           |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                                                                            | Se commitea junto al trabajo; borrarlo del diff solo lo regenera (documentado en `CLAUDE.md` / `AGENTS.md`).                                                    |

---

## Qué **no** entra en esta spec

- Motor real para los otros 7 juegos de `GAMES`.
- Nuevo id de juego, ficha, portada o textos para asteroides (se reusa `rocas`).
- Leaderboards con `av_scores` reales en `/juego/[id]` o `/salon`.
- Puntuaciones en Supabase.
- HUD de la plataforma en React para este juego, o botón de "fin forzado".
- Responsive real del canvas (recalcular `W`/`H` y la física).
- Sonido, vibración, controles táctiles/móviles, `prefers-reduced-motion`.
- Cambios de balance, power-ups nuevos o tipos de asteroide (la "estrella fugaz" del README).
- Actualizar `best` o `plays` de `rocas` en `lib/data.ts`.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
