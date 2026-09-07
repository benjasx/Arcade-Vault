# Integration map — adding a playable game to Arcade Vault

This file is the ground truth the `/spec-game` skill consults while drafting a game
spec. Every path, signature and line number below was read from the repo, not from
memory. If the code has drifted, re-verify before trusting a detail here.

The reference port is **`rocas`** (asteroids): engine `lib/games/asteroids.ts`,
player `components/asteroids-player.tsx`, wired by SPEC 05 (`specs/05-juego-asteroides.md`)
and SPEC 06 (`specs/06-leaderboard-y-tabla-de-juegos.md`). A new game repeats that
shape.

---

## The 7 integration points

Adding one game `X` with id `<slug>` touches exactly these places. Nothing else.

| #   | File                                               | Change                                                               |
| --- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `references/started-games/<dir>/` (if used)        | Materialize source as flat files; stays read-only, out of the build. |
| 2   | `lib/games/registry.ts` (**new**, first game only) | Central map `id → { player, playable }`.                             |
| 3   | `app/juego/[id]/jugar/page.tsx`                    | Read the registry instead of the `game.id === "rocas"` ternary.      |
| 4   | `lib/games.ts`                                     | `isPlayable()` reads the registry instead of the literal `Set`.      |
| 5   | `supabase/migrations/<ts>_<slug>.sql` (**new**)    | One row in `public.games` (+ `public.game_plays`).                   |
| 6   | `lib/games/<slug>.ts` (**new**)                    | Imperative engine controller, TS, no React.                          |
| 7   | `components/<slug>-player.tsx` (**new**)           | Client component, copy of `asteroids-player.tsx`.                    |

Plus `app/globals.css` for the `.cover-<slug>` art, and `public/<slug>/` for assets
if the game has any.

**Do NOT touch:** `lib/leaderboard.ts`, `lib/supabase/*` (unless the DB schema
changes), `components/game-player.tsx` (the simulated player for games without an
engine), `app/page.tsx`, `app/juegos/page.tsx`, `app/salon/page.tsx`. Those already
filter by `isPlayable(g.id)` and pick up a new game for free once the registry
knows about it.

---

## Engine contract — `lib/games/<slug>.ts`

Pure TS module. Does not import React or JSX. Touches `window`/DOM only through the
`canvas` it receives. Model everything on `lib/games/asteroids.ts` (738 lines).

```ts
export interface <X>Options {
  /** Called exactly once when the game enters game over, with the final score. */
  onGameOver: (finalScore: number) => void;
  /** Optional. Called each frame (or on change) with HUD values, so the React
   *  component can paint them in the platform `.player-hud` row. Omit it when the
   *  engine draws its own HUD inside the canvas (asteroids does exactly that). */
  onStats?: (stats: { score: number; lives: number; level: number }) => void;
}

export interface <X>Handle {
  pause: () => void;    // stops scheduling requestAnimationFrame
  resume: () => void;   // resumes, resetting lastTime to avoid a dt jump
  restart: () => void;  // initGame() + resume()
  destroy: () => void;  // cancels the pending rAF and removes the key listeners
}

export function create<X>Game(
  canvas: HTMLCanvasElement,
  opts: <X>Options,
): <X>Handle
```

Mandatory patterns lifted from `asteroids.ts`:

- **State lives in the closure** of `create<X>Game`, never at module level. That is
  what lets the component mount/unmount repeatedly and lets `restart()` be clean.
- **Input validation up front** (`asteroids.ts:79-89`): throw `TypeError` if
  `opts.onGameOver` is not a function; set `canvas.width`/`canvas.height`; throw if
  `getContext("2d")` returns null.
- **Fixed internal size** `const W = ...; const H = ...;` — not responsive. CSS
  scales the presented `<canvas>`.
- **Entity classes** inside the closure, each with `update(dt)` / `draw()` and a
  `dead` flag.
- **Keyboard via `window` listeners** with the edge-trigger pattern
  (`asteroids.ts:132-151`): `keys` + `justPressed` records, an `onKeyDown` /
  `onKeyUp` pair, and `PREVENT_DEFAULT_KEYS` (`["Space","ArrowUp","ArrowDown",
"ArrowLeft","ArrowRight"]`) calling `e.preventDefault()`.
- **rAF loop with a capped dt** (`asteroids.ts:697-719`):
  `const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);`
  `startLoop()` guards against double-scheduling and sets `lastTime = null`;
  `stopLoop()` cancels and nulls `rafId`.
- **Game-over notification** (`asteroids.ts:518-534`): when lives hit 0, set state
  to `"gameover"` and, guarded by a `gameOverNotified` flag, call
  `opts.onGameOver(score)` once. `gameOverNotified` is reset in `initGame()` so
  `restart()` can notify again. The original's "press Space to restart" is
  **removed** — the platform modal owns restart.
- **Return the handle** last (`asteroids.ts:721-737`), after `initGame(); draw();
startLoop();`. `destroy()` calls `stopLoop()` then
  `window.removeEventListener` for both key handlers.

### Audio

`asteroids.ts:94-129` builds a pool of `<audio>` elements whose `src` points at
`/sounds/<file>.ogg` — an **absolute path** served from `public/sounds/`. A game
ported from `references/` has relative paths (`sonidos/...`, `assets/sounds/...`)
that break under Next; they must be rewritten to `/<slug>/...` and the used files
copied into `public/<slug>/` with their licence file alongside.

---

## Player contract — `components/<slug>-player.tsx`

`"use client"`. Copy `components/asteroids-player.tsx` (187 lines) almost verbatim
and swap the engine import. Fixed shape:

- **Single prop:** `{ game }: { game: Game }` — the `Game` is already resolved by
  the server page.
- **Session:** `const { user } = useAuth()` from `@/components/auth-provider`.
- **Score save:** `await submitScore(game.id, finalScore)` from `@/lib/leaderboard`,
  inside `try/catch`, error into `saveErr`.
- **Play counter:** `void registerPlay(game.id)` inside `onGameOver`, best-effort,
  no `await`.
- **Local state:** `paused`, `over`, `finalScore`, `saved`, `busy`, `saveErr`,
  `pending` (`"again" | "vault" | "login" | "exit" | null`), `locked = pending !== null || busy`.
- **Effect:** `useEffect(() => { const h = create<X>Game(canvasRef.current!, { onGameOver });
handleRef.current = h; return () => { h.destroy(); handleRef.current = null; }; }, [game.id])`.
- **Modal "FIN DEL JUEGO":** if `!user` → button "INICIA SESIÓN PARA GUARDAR" →
  `/login`; else if `saved` → toast `▸ PUNTUACIÓN GUARDADA_`; else → "GUARDAR
  PUNTUACIÓN" button. Actions row: "JUGAR DE NUEVO" (`handle.restart()` + close
  modal + reset `saved`), "VOLVER AL VAULT" → `/juegos`.
- **CSS classes already in `app/globals.css`** (do not reinvent): `av-player`,
  `fade-in`, `player-hud`, `hud-stat` (`.l`, `.v`, `.lives`, `.level`),
  `hud-actions`, `btn` (`.yellow` `.magenta` `.ghost` `.lg` `.xl`), `crt`,
  `crt-screen`, `crt-content`, `crt-bottom`, `led`, `asteroids-canvas`, `pixel`,
  `mono`, `neon-yellow`, `neon-magenta`, `modal-bd`, `modal`, `final`,
  `final-label`, `actions`, `toast-saved`, `spinner`.

### HUD in canvas vs HUD in `.player-hud`

- **HUD in canvas** (asteroids, arkanoid): the engine draws score/lives/level with
  `fillText`. The engine omits `onStats`. The component's `.player-hud` only shows
  the game title + PAUSA/SALIR, like `asteroids-player.tsx` today.
- **HUD in DOM** (tetris, snake in `references/`): the original writes to ~25 DOM
  ids. Do **not** replicate that markup. The engine calls `opts.onStats({ score,
lives, level })`; the component keeps those in React state and renders them in
  extra `.hud-stat` blocks (see `components/game-player.tsx:` for the exact
  markup of a 4-stat HUD row: Jugador / Puntuación / Vidas / Nivel).

### Touch controls — on-screen buttons for mobile

**Every game player component ships an on-screen control pad.** `rocas` and
`tetris` predate this rule; from the next game spec on it is part of the base
shape, added to the `asteroids-player.tsx` copy.

**The engine is not touched.** Both engines already listen for `keydown` /
`keyup` on `window` and key off `e.code` (`asteroids.ts:132-144`,
`tetris.ts` input block), with `keys` (held) + `justPressed` (edge) records. The
pad **synthesizes those same events** — it is purely a component + CSS concern,
no new engine method, no change to `<X>Handle`.

Fixed shape in `components/<slug>-player.tsx`:

- A module-level `TOUCH_CONTROLS` array, one entry per button:
  `{ label: string; code: string; mode: "hold" | "tap" }`. `code` is the exact
  `KeyboardEvent.code` the engine reads (`"ArrowLeft"`, `"Space"`, `"KeyX"`, …).
  `mode: "hold"` = movement / thrust / soft-drop (key stays down while the finger
  is down); `mode: "tap"` = rotate / shoot / hard-drop (one edge per press).
- Default map: mirror the keyboard controls 1:1 — arrows → a d-pad of `hold`
  buttons, each action key → one `tap` button. A game only deviates when a key
  makes no sense as a button (rare).
- Emit helpers on `window`:
  `press(code)` → `window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }))`;
  `release(code)` → same with `"keyup"`.
- Button events: `onPointerDown` → `e.preventDefault()`, `press(code)`; for
  `mode: "hold"` also `onPointerUp` / `onPointerCancel` / `onPointerLeave` →
  `release(code)`; for `mode: "tap"`, `release(code)` on the next frame
  (`requestAnimationFrame`) so the engine's `justPressed` edge is seen once.
- Track held codes in a `Set<string>` ref; on unmount / SALIR, `release()` every
  still-held code so a synthetic key never sticks.
- No focus theft: `<button type="button">`,
  `onContextMenu={(e) => e.preventDefault()}` (kills the long-press menu). The pad
  never calls `handleRef.current` directly — one code path (synthetic keys).
- PAUSA / SALIR stay as real buttons in `.player-hud`; they are **not** in the pad.
- Placement: a `.touch-controls` block, sibling of `.crt`, inside `.av-player`,
  **after** the CRT bezel.

### CSS for the pad — add to `app/globals.css`

New classes, next to `.asteroids-canvas` (~line 1150). Not yet in the file — the
game spec adds them:

- `.touch-controls` — `display: none` by default; shown only inside
  `@media (pointer: coarse)` as a grid/flex row (d-pad left, actions right),
  `margin-top: 14px`, `touch-action: none`, `user-select: none`,
  `-webkit-tap-highlight-color: transparent`. **Gate on `pointer: coarse`, not a
  width breakpoint** — a narrow desktop window still has a keyboard.
- `.touch-btn` — square ~64px, `var(--pixel)` glyph, `1px solid var(--line)`,
  `background: var(--bg-2)`, `:active` swaps to a neon border
  (`var(--cyan)` / `box-shadow`). Size mods `.wide` / `.tall` for a d-pad.
- Reuse palette vars only (`--cyan`, `--magenta`, `--yellow`, `--line`, `--bg-2`,
  `--ink`). No new colours, no `<img>`.

---

## Central registry — `lib/games/registry.ts` (created by the first game spec)

Replaces two fragile edits:

- the ternary `return game.id === "rocas" ? <AsteroidsPlayer game={game} /> : <GamePlayer game={game} />`
  in `app/juego/[id]/jugar/page.tsx:17`;
- the literal `export const PLAYABLE_GAME_IDS = new Set<string>(["rocas"]);` in
  `lib/games.ts:24`.

Shape:

```ts
import type { ComponentType } from "react";
import type { Game } from "@/lib/games";
import { AsteroidsPlayer } from "@/components/asteroids-player";

type PlayerComponent = ComponentType<{ game: Game }>;

export const GAME_REGISTRY: Record<string, PlayerComponent> = {
  rocas: AsteroidsPlayer,
  // <slug>: <X>Player,
};

export function playerFor(id: string): PlayerComponent | null {
  return GAME_REGISTRY[id] ?? null;
}
```

`isPlayable(id)` becomes `id in GAME_REGISTRY`. `app/juego/[id]/jugar/page.tsx`
becomes: resolve `game`, `const Player = playerFor(game.id) ?? GamePlayer;`,
`return <Player game={game} />`.

Watch for the import cycle: `registry.ts` imports player components, which import
`@/lib/games` for the `Game` type (`import type`, so erased at build — safe). Keep
`registry.ts` separate from `lib/games.ts` to keep it obvious.

---

## Database — `supabase/migrations/`

Real schema of `public.games` (`20260905213521_games_catalog.sql:1-20`):

```sql
create table public.games (
  id    text primary key,
  title text not null,
  short text not null,
  long  text not null,
  cat   text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover text not null,                     -- exact CSS class name, e.g. 'cover-rocas'
  color text not null check (color in ('cyan','magenta','yellow','green')),
  sort  int  not null default 0
);
```

- The two `CHECK`s must stay in sync with `GameCategory` and `NeonColor` in
  `lib/data.ts` and with `CATS`. A category outside the four means editing all
  three plus the check — call it out as its own decision.
- **No INSERT policy** for `anon`/`authenticated`. A new row enters only via a
  migration (or the service role). So the game spec always includes a migration
  file, applied with the Supabase MCP `apply_migration` against project
  `mrimkuambtxtoycyfxyh`, and versioned in `supabase/migrations/`.
- Seed pattern: `insert into public.games (id, title, short, long, cat, cover, color, sort) values (...)`.
  See `20260905213521_games_catalog.sql:22-55` for the 8 existing rows and their
  Spanish `short`/`long` copy style.
- `public.game_plays` (`20260906120000_play_counter.sql`) is seeded per game that
  existed at that migration. A new game has no row; `increment_play` creates it on
  the fly and `games_with_stats` `coalesce`s to 0, so nothing breaks — but the
  migration should still `insert into public.game_plays (game_id) values ('<slug>')
on conflict do nothing` for consistency.
- FK `scores.game_id references public.games(id)` — the game row must exist before
  anyone can save a score.
- RPCs already in place, no change needed: `submit_score(p_game_id text, p_score
int)` (upsert, only if it improves) and `increment_play(p_game_id text)`.
- **Do NOT regenerate** `lib/supabase/database.types.ts` for a plain data row — the
  schema does not change. Only regenerate if the migration alters the schema.

If a reused id already exists in the seed (`bloque-buster`, `caida`, `serpentina`,
`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`), there is **no
migration** — the row is already there, like SPEC 05 reused `rocas`.

---

## CSS

### Cover art `.cover-<slug>` — pure CSS, no images

Section in `app/globals.css:664-823` (`/* Cover art generators (pure CSS) */`).
Applied as `<div className={"cover-bg " + game.cover} />` inside `.card .cover`
(aspect-ratio 4/3). Each cover is:

- a base class with a `background` of stacked gradients
  (`linear-gradient` / `radial-gradient` / `repeating-linear-gradient`);
- an `::after` with `content: ""; position: absolute; inset: 0;` stacking more
  gradients to draw shapes, sometimes with `clip-path` and
  `filter: drop-shadow(0 0 8px ...)` for the neon glow;
- an optional `::before` with a single unicode glyph (`▲`, `•••`, …) and
  `text-shadow` for glow.

No emoji, no `<img>`. Palette vars: `--cyan`, `--magenta`, `--yellow`, `--green`,
`--ink`, `--line`. Copy the structure of `.cover-rocas` (`:771-794`) or
`.cover-glot` (`:725-749`) and restyle for the new game. Add the block around
line 823, right after the last existing cover.

### Canvas scaling

`app/globals.css:1089-1098`:

```css
.asteroids-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain; /* letterbox if the aspect ratio does not match */
}
```

The class name is tied to asteroids but the rule is generic. Two options for a new
game, to be decided in the spec:

- reuse `.asteroids-canvas` as-is (fine for any 4:3-ish canvas);
- rename it to `.game-canvas` — a 2-site edit (`globals.css:1091` and
  `asteroids-player.tsx:123`) plus using the new name in the new component.

### Touch-pad classes

`.touch-controls` / `.touch-btn` — see **Touch controls** under the player
contract above. Gated on `@media (pointer: coarse)`, `display: none` otherwise.
Not in `globals.css` yet; each game spec adds the block near `.asteroids-canvas`.

---

## References source shapes (`references/started-games/`)

All four dirs are **flat files, not submodule gitlinks** (no `.gitmodules`,
`git ls-files -s` shows mode `100644`). Structural variation the spec must handle:

| Trait        | 02-asteroides           | 03-claude-tetris                                              | 04-arkanoid                                                      | 05-snake                    |
| ------------ | ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| JS files     | 1 `game.js`             | 1 `game.js`                                                   | **2**: `assets/spritesheet.js` + `game.js` (globals, no imports) | 1 `game.js`                 |
| Canvas       | `#canvas` 800×600       | `#board` 300×600 + `#next-canvas` 120×120                     | `#game` 800×600                                                  | `#board` 528×528            |
| HUD          | canvas (`fillText`)     | **DOM** (~16 nodes)                                           | canvas (`fillText`)                                              | **DOM** (0 `fillText`)      |
| Listeners    | `window` keys           | `document` keys + ~10 click/change on DOM buttons             | `window` keys + `canvas` mousemove/click                         | `window` keys + one button  |
| Audio        | 74 `.ogg` files, 3 used | WebAudio synth (no assets)                                    | 2 `.mp3` files                                                   | none                        |
| localStorage | none                    | `theme`, `tetris-skin`, `tetris-start-level`, highscores JSON | none                                                             | `snake_hi`                  |
| CSS          | inline `<style>`        | `style.css` 548 lines (themes, skins, CRT)                    | `style.css` 16 lines (trivial)                                   | `style.css` 243 lines (CRT) |
| Own state    | module `let`            | module globals                                                | single `state` object                                            | module `let`                |

`references/started-games/04-arkanoid/` also carries its own `specs/`, `.agents/`,
`skills-lock.json` — ignore those; they are the game's own repo history, not part
of Arcade Vault.

Kenney Sci-Fi audio: full pack in
`references/started-games/02-asteroides/sonidos/` (74 `.ogg` + `.zip` + `License.txt`,
CC0); the 5 used samples already ported to `public/sounds/`. That copy-only-what-is-used
pattern is the one to follow.
