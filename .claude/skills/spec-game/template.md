# Template for an Arcade Vault game spec

This is the shape `/spec-game` produces. It is **not text to copy verbatim** — it
is the structure the generated spec must respect. The generated spec is written in
**Spanish** (like `specs/05-juego-asteroides.md` and `specs/06-...md`), with the
blockquote header in English labels + Spanish values, and Spanish section names.

Read `specs/05-juego-asteroides.md` before writing — it is the canonical example
of this exact template applied to a real game.

---

## Header

```markdown
# SPEC NN — Primer/segundo/… juego real: <NOMBRE> en la entrada "<id>"

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06
> **Date:** YYYY-MM-DD
> **Objective:** Una sola frase: portar <fuente> a un controlador imperativo TS montado en un componente cliente que sustituye la partida simulada para la entrada <id>, guardando la puntuación por el modal de fin de la plataforma.
```

- State is always `Borrador` on creation. Never `Aprobado`.
- `Depends on: SPEC 05, SPEC 06` always — the engine contract comes from 05, the
  leaderboard/`submitScore`/session flow from 06.
- Date comes only from the skill's session context. Never invent it.

---

## Por qué existe esta spec

Two or three short paragraphs: what the game is, where its source lives
(`references/started-games/<dir>/` or "escrito desde cero"), its structural shape
(single `game.js` vs multi-file, canvas size, HUD in canvas vs DOM, listeners,
assets, own `localStorage`), and why it is being ported now.

Then a bullet list **`Decisiones ya cerradas con el usuario (no reabrir):`** —
every choice locked in Phase 3 of the skill. Mirror the style of
`specs/05-juego-asteroides.md:16-25`.

---

## Scope

```markdown
## Scope

**In:**

- **Fuente de referencia**: … (only if the game comes from `references/`)
- **Registro** `lib/games/registry.ts`: crear el mapa `id → componente player` …
  (only in the FIRST game spec after asteroids; later specs just add an entry)
- **Migración** `supabase/migrations/<ts>_<slug>.sql`: fila en `public.games` …
  (only if the id is new; skip if reusing a seeded id)
- **Controlador** `lib/games/<slug>.ts`: port tipado de <fuente> …
- **Componente** `components/<slug>-player.tsx` (`"use client"`): …
- **Enrutado** `app/juego/[id]/jugar/page.tsx`: leer del registro …
- **CSS** `app/globals.css`: `.cover-<slug>` … y escalado del `<canvas>` …
- **Assets** `public/<slug>/`: … (only if the game has audio/sprites)

**Out of scope (para futuras specs):**

- Motor real para los otros juegos de `GAMES`.
- Responsive real del canvas (recalcular `W`/`H` y la física).
- Sonido/vibración/controles táctiles/móviles, `prefers-reduced-motion`.
- Cambios de balance, mecánicas nuevas o tipos de entidad nuevos.
- Leaderboards con más columnas o realtime.
- Tests automatizados (no hay framework configurado).
```

The **Out** list must capture everything the user mentioned in Phase 3 and chose
to defer.

---

## Data model

State the persistence: none new — `public.scores` via `submit_score` (SPEC 06),
one row per `(user_id, game_id)` = best mark.

Then the in-memory shapes in `lib/games/<slug>.ts`:

```markdown
\`\`\`ts
interface <X>Options {
onGameOver: (finalScore: number) => void;
onStats?: (stats: { score: number; lives: number; level: number }) => void;
}
interface <X>Handle {
pause: () => void;
resume: () => void;
restart: () => void;
destroy: () => void;
}
function create<X>Game(canvas: HTMLCanvasElement, opts: <X>Options): <X>Handle;
\`\`\`
```

Then the internal game state ported from the original (entities, score/lives/level,
state machine, `W`/`H` constants), and the local state of
`components/<slug>-player.tsx` (`paused`, `over`, `finalScore`, `saved`, `busy`,
`saveErr`, `pending`).

Conventions block (inherited from SPEC 05):

- `lib/games/<slug>.ts` no importa React; solo toca `window`/DOM vía el `canvas`.
- `components/<slug>-player.tsx` lleva `"use client"`.
- `app/juego/[id]/jugar/page.tsx` sigue siendo Server Component.
- Alias `@/*` para imports.

---

## Implementation plan

Pre-structured in the order SPEC 05 validated. Particularize each step; drop the
ones that do not apply (e.g. no source step for a from-scratch game, no migration
step for a reused id, no registry step after the first game).

```markdown
## Implementation plan

1. **Traer la fuente.** (solo si viene de `references/`) Materializar los N
   archivos de `references/started-games/<dir>/` como archivos planos en la rama.
   Verificación: se leen como texto; `git status` los muestra añadidos; `npm run
build` sigue compilando (la carpeta no entra en el build).

2. **Registro central.** (solo en la primera spec de juego tras asteroides) Crear
   `lib/games/registry.ts` con `GAME_REGISTRY: Record<string, ComponentType<{game:
Game}>>` y `playerFor(id)`. Reescribir `app/juego/[id]/jugar/page.tsx` para
   `const Player = playerFor(game.id) ?? GamePlayer; return <Player game={game} />`.
   Cambiar `isPlayable()` en `lib/games.ts` a `id in GAME_REGISTRY` y borrar
   `PLAYABLE_GAME_IDS`. Verificación: `/juego/rocas/jugar` sigue montando
   `AsteroidsPlayer`; el resto sigue con `GamePlayer`; `npm run build` limpio.

3. **Migración.** (solo si el id es nuevo) `supabase/migrations/<ts>_<slug>.sql`
   con `insert into public.games (...)` respetando los `check` de `cat`/`color`, un
   `sort` libre, `cover` = nombre exacto de la clase CSS, y `insert into
public.game_plays (game_id) values ('<slug>') on conflict do nothing`. Aplicar
   con MCP `apply_migration`. Verificación: `select` anónimo devuelve la fila;
   `games_with_stats` la incluye con `best = 0`, `plays = 0`.

4. **Esqueleto del controlador.** Crear `lib/games/<slug>.ts` con
   `create<X>Game(canvas, opts)`: valida `opts.onGameOver`, fija
   `canvas.width/height`, obtiene el `2d`, pinta el fondo, monta `keydown`/`keyup`
   en `window` con `preventDefault` para las teclas de juego, y un bucle
   `requestAnimationFrame` vacío. Devuelve `{ pause, resume, restart, destroy }`.
   Verificación: `npm run lint` limpio; el canvas se ve; `destroy()` no deja
   listeners.

5. **Lógica de partida.** Portar a TS tipado: utilidades, clases de entidad,
   constantes, estado en el cierre, `initGame`, `update(dt)`, `draw()`, HUD, y el
   bucle con `dt` acotado a 0.05 s. Al entrar en game over, `opts.onGameOver(score)`
   una sola vez (flag `gameOverNotified` reseteada en `initGame()`); se quita el
   reinicio por tecla del original. Si el HUD del original vive en el DOM, emitir
   `opts.onStats({score, lives, level})` en vez de replicar el markup. `pause()`
   deja de programar rAF; `resume()` resetea `lastTime`; `restart()` = `initGame()`
   - `resume()`. Verificación: jugable de principio a fin; al morir dispara
     `onGameOver` con el score correcto y el canvas no se reinicia solo.

6. **Componente cliente.** Crear `components/<slug>-player.tsx` (`"use client"`)
   copiando `components/asteroids-player.tsx`: marco `.av-player`/`.crt`/
   `.crt-screen`/`.crt-bottom` con `<canvas ref>`, botones PAUSA/REANUDAR y SALIR,
   `useEffect([game.id])` que crea el juego y limpia con `destroy()`. `onGameOver`
   → `setFinalScore`, `setOver(true)`, `void registerPlay(game.id)`. Modal "FIN DEL
   JUEGO": con sesión `await submitScore(game.id, finalScore)` + toast `▸
PUNTUACIÓN GUARDADA_`; sin sesión CTA "INICIA SESIÓN PARA GUARDAR" → `/login`.
   "JUGAR DE NUEVO" → `handle.restart()` + cerrar modal. "VOLVER AL VAULT" →
   `/juegos`. (Si hay `onStats`: pintar score/vidas/nivel en filas `.hud-stat`.)
   Añadir la entrada del juego a `GAME_REGISTRY`. Verificación: `/juego/<id>/jugar`
   muestra el canvas real; PAUSA congela; morir abre el modal; guardar con sesión
   añade la marca en `public.scores`.

7. **Escalado y portada CSS.** En `app/globals.css`: bloque `.cover-<slug>`
   (base + `::after` con gradientes + `::before` con glifo unicode) junto a las
   demás portadas (~línea 823); reutilizar `.asteroids-canvas` o renombrarla a
   `.game-canvas` para el `<canvas>`. Verificación: la portada se ve en `/juegos`;
   el canvas escala sin deformar ni scroll horizontal en los breakpoints
   existentes.

8. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos;
   consola sin warnings de hidratación en `/juego/<id>/jugar`; al pulsar SALIR no
   quedan listeners `keydown`/`keyup` ni `requestAnimationFrame` activos. Confirmar
   que el bloque regenerado de `AGENTS.md` va junto al commit.
```

Rules: each step commitable on its own; if a step passes ~30–50 lines, split it;
the last step is cleanup/verification, not "probar todo".

---

## Acceptance criteria

Boolean checklist. Every game spec inherits this base set (particularize the
mechanic-specific ones from Phase 2/3):

```markdown
## Acceptance criteria

- [ ] `/juego/<id>/jugar` renderiza un `<canvas>` con el juego real, no la arena
      simulada de `div`.
- [ ] Los controles acordados responden: <lista concreta de teclas → efecto>.
- [ ] <criterio de mecánica 1: p. ej. "romper una línea suma 100 puntos">.
- [ ] <criterio de mecánica 2>.
- [ ] El HUD (<en canvas | en la fila `.player-hud`>) muestra score, vidas y nivel
      correctos durante la partida.
- [ ] Al llegar a game over se abre el modal "FIN DEL JUEGO" con la puntuación
      final; ninguna tecla reinicia el canvas por su cuenta.
- [ ] Con sesión, "GUARDAR PUNTUACIÓN" llama a `submit_score` y muestra el toast
      `▸ PUNTUACIÓN GUARDADA_`; una segunda partida solo actualiza la fila si el
      score sube.
- [ ] Sin sesión, el modal no tiene input de guardado; aparece el CTA a `/login`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (score 0, estado inicial) y cierra el
      modal; `VOLVER AL VAULT` navega a `/juegos`.
- [ ] `PAUSA` detiene el bucle y cambia a `REANUDAR`; al reanudar no hay salto de
      `dt`.
- [ ] `SALIR` navega a `/juego/<id>`; tras salir no quedan listeners `keydown`/
      `keyup` ni `requestAnimationFrame` en marcha.
- [ ] El juego aparece en `/juegos`, en la preview de la home y en `/salon`
      (filtro `isPlayable`); el resto de juegos sigue con `GamePlayer` sin cambios.
- [ ] La portada `.cover-<slug>` se ve en el grid; el `<canvas>` escala sin
      deformación ni scroll horizontal en los breakpoints existentes.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos;
      sin warnings de hidratación de React en consola.
```

Anti-patterns: ❌ "que funcione bien", ❌ "buena UX", ❌ "sin bugs". Every item
must be answerable yes/no.

---

## Decisions

Format `- **Sí:** … porque …` / `- **No:** … porque …`. Capture what was
considered, not only what was chosen. Typical entries for a game spec:

- **Sí/No:** reusar un id sembrado (`<id>`) vs. crear uno nuevo — porque …
- **Sí:** port a controlador imperativo TS (`create<X>Game(canvas, opts) →
handle`), no reescritura en hooks — mantiene la lógica del original y aísla el
  bucle de 60 fps del render de React. (Heredado de SPEC 05.)
- **No:** cargar el `game.js` original con `<Script>` o dynamic import — el scope
  global y el auto-arranque chocan con montaje/desmontaje del App Router.
- **Sí/No:** HUD en canvas vs. en `.player-hud` vía `onStats` — porque …
- **Sí:** la puntuación se guarda desde el modal con `submitScore` (SPEC 06).
- **Sí:** desactivar el reinicio por tecla del original en game over — el modal es
  el dueño del reinicio.
- **Sí:** `pause()` detiene el rAF y `resume()` resetea `lastTime`.
- **Sí/No:** conservar/podar mecánicas del original (power-ups, skins, temas) —
  porque …
- **Sí:** coordenadas internas `W`×`H` fijas y escalado por CSS — no se toca la
  física.
- **Sí:** registro central `lib/games/registry.ts` en vez del ternario
  hardcodeado. (Solo en la primera spec de juego.)

---

## Riesgos

Table, only non-obvious risks. Common ones:

| Riesgo                                                                                       | Mitigación                                                                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` o los listeners sobreviven al desmontar                              | `create<X>Game` guarda el id de rAF y las referencias de los handlers; `destroy()` las limpia. Un criterio lo verifica con SALIR. |
| TypeScript strict sobre un `game.js` sin tipos                                               | El port tipa entidades como clases/`interface`s; el paso de lógica no cierra hasta que `npm run build` pasa.                      |
| Assets con rutas relativas hardcodeadas rompen bajo Next                                     | Se copian los usados a `public/<slug>/` y se reescribe el prefijo a `/<slug>/`.                                                   |
| `<Space>`/flechas hacen scroll o activan un botón enfocado                                   | El listener hace `preventDefault` para las teclas de juego; PAUSA/SALIR no roban el foco.                                         |
| Warnings de hidratación si el canvas o el modal derivan algo de `window` en el primer render | El `<canvas>` se monta vacío; `create<X>Game` solo toca `window`/DOM dentro de `useEffect`.                                       |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                        | Se commitea junto al trabajo (documentado en `CLAUDE.md` / `AGENTS.md`).                                                          |

---

## Qué **no** entra en esta spec

Explicit repetition of the Out-of-scope list at the end of the document, phrased as
short bullets, closing with: _"Cada uno, si llega, va en su propia spec."_

---

## Global rules about the whole document

- Una idea por frase.
- Nombres concretos de fichero y strings exactos, no "el módulo de niveles".
- Sin TODOs — una decisión no tomada se anota como decisión pendiente con su razón.
- Sin código ejecutable largo — snippets de estructura sí, funciones completas no.
- Markdown estándar, renderiza en GitHub sin sorpresas.
- Español, con el wording de `specs/05` y `specs/06`.
