# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A clone of the classic arcade game **Asteroids**, implemented in pure HTML5 Canvas with vanilla JavaScript (ES6+). No frameworks, no bundler, no dependencies, no package.json — the entire game lives in a single file: `game.js`.

## Running the game

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

There is no build step, no test suite, and no linter configured in this repo — changes to `game.js` take effect on page reload.

## Architecture

Everything is in `game.js`, organized top-to-bottom into clear sections (marked with `── Section ──` comments):

- **Input** — `keys` (held state) and `justPressed` (edge-triggered, consumed via `pressed(code)`) are populated by `keydown`/`keyup` listeners.
- **Utils** — `wrap` (toroidal position wrapping), `dist`, `rand`, `randInt`.
- **Entity classes** — `Bullet`, `Asteroid`, `Ship`, `Particle`. Each has `update(dt)` and `draw()`, and self-marks `dead = true` when it should be removed. Coordinates and canvas size (`W = 800`, `H = 600`) are fixed, not responsive.
- **Game state** — module-level `let` variables (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state`, `deadTimer`) instead of a state object/class. `state` is one of `'playing' | 'dead' | 'gameover'`.
- **`update(dt)` / `draw()`** — the two top-level functions called every frame. `update` branches on `state` first, then does: input → per-entity `update` → dead-array filtering → collision detection (bullet-vs-asteroid, ship-vs-asteroid) → level-completion check.
- **Main loop** — a single `requestAnimationFrame(loop)` recursion at the bottom of the file, computing `dt` in seconds (capped at 0.05 to avoid spiral-of-death on tab-switch).

### Key mechanics to know before editing

- **Toroidal space**: all moving entities wrap position via `wrap(v, max)` — the ship, asteroids, and bullets all reappear on the opposite edge.
- **Asteroid sizes**: `size` is 3 (large) → 2 (medium) → 1 (small); `RADII`, `SPEEDS`, `POINTS` arrays are indexed by size. `Asteroid.split()` produces two smaller asteroids at size - 1, or none at size 1.
- **Collision detection** is plain circle-radius distance checks (`dist(a, b) < a.radius + b.radius`), not polygon-based — asteroid draw shape is irregular but its hitbox is circular.
- **Ship invincibility**: `ship.invincible` counts down from 3s on spawn/respawn; the ship blinks (skips drawing on alternating frames) and is immune to collisions while `> 0`.
- **Game flow**: `initGame()` resets everything and calls `spawnAsteroids(4)`; when `asteroids.length === 0`, `nextLevel()` increments `level` and spawns `3 + level` new large asteroids; `killShip()` decrements `lives` and transitions to `'dead'` (brief respawn delay) or `'gameover'`.

## Notes

- `README.md` describes power-ups and a "shooting star" asteroid type — these were removed from the code (see git history) and the README is currently out of date relative to `game.js`.
- Text/UI strings (HUD labels, game-over message) are in Spanish.
