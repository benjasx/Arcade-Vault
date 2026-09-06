---
name: spec-game
description: Designs the spec for a new playable game with leaderboard in Arcade Vault. Inventories the source (a folder under references/started-games, or a game written from scratch), asks the game-specific questions, and writes specs/NN-juego-<slug>.md ready for /spec-impl. Does not write app code.
disable-model-invocation: true
argument-hint: "game name, or a folder under references/started-games/"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*)
---

# /spec-game — Spec designer for playable games

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Reference games available to port:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ not found"`

Current playable-game wiring:
!`cat lib/games.ts 2>/dev/null || echo "lib/games.ts not found"`

---

This skill produces the spec for **one** new playable game with its leaderboard,
following the spec-driven method of this repo. **You do not write app code here.**
Your only output is the `.md` file in `specs/` at the end.

It is a **specialization of `/spec`, not a replacement.** The base skill
`.claude/skills/spec/SKILL.md` and its `.claude/skills/spec/template.md` are the
authority for everything general: the philosophy, the phase flow, how the spec is
numbered and named, the blockquote header format, the valid states, the
section-by-section fallback, and the hard rules. **You read both of those files in
Phase 1 and follow them.** This skill only _adds_ on top: the source-inventory
phase, a game-specific question set, and a pre-shaped implementation plan — all
derived from what SPEC 05 (`specs/05-juego-asteroides.md`) and SPEC 06
(`specs/06-leaderboard-y-tabla-de-juegos.md`) had to decide when `rocas` was
ported. Where this skill is silent, `/spec` governs. Where they conflict, this
skill's game-specific rule wins for game specs only.

- Follow the four phases in order. **Never skip Phase 3** (the questions) — it is
  `/spec`'s Phase 2 renumbered.
- Your replies and the final spec are in **Spanish** — that is the language of every
  spec in this repo. Match the wording of specs 05 and 06.

---

## Phase 1 — Context

1. **Read the base `/spec` skill first.** Read `.claude/skills/spec/SKILL.md` and
   `.claude/skills/spec/template.md` in full. Those define the method you are
   specializing: the four-phase philosophy, the numbering rule (`max(specs/) + 1`,
   zero-padded), the blockquote header, the valid state set (`Draft`/`Borrador`,
   `Approved`/`Aprobado`, …), the mandatory `**In:**` / `**Out of scope:**`
   sub-blocks, the acceptance-criteria anti-patterns, and the hard rules
   (never write code, never mark `Approved`, never propose implementing). You obey
   all of it; the sections below only add game-specific detail on top.
2. Read `CLAUDE.md`, then `AGENTS.md`. Note the mandatory rule: before any Next.js
   code, the relevant guide in `node_modules/next/dist/docs/` must be read — but
   that is the implementer's job, not this skill's. Just carry it into the spec.
3. Read `reference.md` in this skill's directory. It is the integration map: the 7
   places a new game touches, the engine contract, the player contract, the DB
   schema, the CSS. Everything in it was verified against the repo.
4. Read `specs/05-juego-asteroides.md` in full and skim `specs/06-...md`. They are
   `/spec`'s "read the two most recent specs" step applied to game specs: they fix
   the Spanish wording of the header labels and the section names
   (`## Por qué existe esta spec`, `## Scope`, `## Data model`,
   `## Implementation plan`, `## Acceptance criteria`, `## Decisions`, `## Riesgos`,
   `## Qué **no** entra en esta spec`) and the level of concreteness.
5. Read `template.md` in this skill's directory — the game-spec shape, layered on
   top of `/spec`'s generic `template.md`.

If `$ARGUMENTS` is empty, ask which game: a folder name under
`references/started-games/`, or a one-sentence description of a game to build from
scratch. If the description does not fit in one sentence, the game is too big —
say so before continuing.

---

## Phase 2 — Inventory the source

**If `$ARGUMENTS` resolves to a folder under `references/started-games/`:**

List its files (`ls`, `wc -l`). Then read the code — never rely on memory or on the
folder's own `README.md`/`CLAUDE.md`, which the explorers found to be stale in at
least one case — and record:

- entry point and number of JS files (one `game.js`, or several coupled by
  globals with no `import`/`export`);
- every `<canvas>`: its id and fixed pixel size;
- **where the HUD lives**: canvas (`fillText` calls) or the DOM
  (`textContent` / `innerHTML` / `classList` on fixed ids) — this decides the
  `onStats` question;
- keyboard/mouse listeners and which object they attach to (`window`,
  `document`, the canvas, DOM buttons);
- whether it auto-starts on load;
- external assets (sprites, audio) and their **relative** paths (these break
  under Next and must be rewritten);
- `localStorage` keys the game uses on its own;
- the game's state machine (`playing` / `dead` / `gameover` / `paused` / …).

Summarize this back to the user in a short block before moving to questions —
it is the raw material for `## Por qué existe esta spec`.

**If the game is written from scratch:** replace this phase with a tight
description of the mechanic, the entities, the win/lose condition and the
controls. Get that in the user's own words.

`references/started-games/04-arkanoid/` carries its own `specs/`, `.agents/`,
`skills-lock.json` — ignore those, they are the game's prior repo history.

---

## Phase 3 — Clarify through questions

Blocks of 3–5 questions. Use `AskUserQuestion`, recommendation first and labeled.
Wait for answers between blocks. Categories, all derived from real SPEC 05/06
decisions:

1. **Catalog entry.** Reuse one of the 8 ids already seeded in `public.games`
   (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`,
   `ranaria`, `duelo-pixel`) or create a new id? A reused id means **no migration**
   (the row exists, like SPEC 05 reused `rocas`). A new id needs a migration file
   and values for `title` / `short` / `long` / `cat` / `cover` / `color` / `sort`.
   `cat` is limited to `ARCADE|PUZZLE|SHOOTER|VERSUS`, `color` to
   `cyan|magenta|yellow|green` — a value outside those is its own decision
   (touch the two `CHECK`s + `GameCategory`/`NeonColor`/`CATS` in `lib/data.ts`).
2. **Engine port.** Confirm the fixed internal canvas size (`W`×`H`, not
   responsive). What is kept and what is pruned from the original (power-ups,
   skins, themes, sound synthesis, extra screens)? Any mechanic the port drops is
   a `## Decisions` line.
3. **HUD.** Canvas (engine draws it, `onStats` omitted) or the platform
   `.player-hud` row (engine emits `onStats({score, lives, level})`, component
   renders `.hud-stat` blocks)? Default follows Phase 2: canvas-HUD games stay in
   canvas, DOM-HUD games move to `onStats`.
4. **Controls.** Exact keys → effect. Which keys get `preventDefault` (game keys
   always; at least `Space` + arrows if used). Mouse or touch? (Touch is
   out-of-scope by default, consistent with SPEC 05.)
5. **Assets.** If the game has audio/sprites: which files, copied to
   `public/<slug>/`, paths rewritten to absolute `/<slug>/...`, licence file
   alongside. Follow the "copy only what is used" pattern (`public/sounds/` has 5
   of the pack's 74 samples).
6. **The original's own state.** Its `localStorage` keys (`snake_hi`,
   `tetris-skin`, …) are **removed** — the best mark lives in Supabase via
   `submit_score`. Confirm nothing else depends on them.
7. **Registry.** If this is the first game spec after asteroids, its plan creates
   `lib/games/registry.ts` and rewires `app/juego/[id]/jugar/page.tsx` +
   `isPlayable()`. If `lib/games/registry.ts` already exists (check the session
   context / repo), the plan just adds an entry to `GAME_REGISTRY`. State which
   case applies.
8. **Out of scope.** Confirm the deferrals: real responsive canvas, mobile/touch,
   `prefers-reduced-motion`, balance changes, new mechanics, realtime leaderboards,
   automated tests.

**Stop asking when** you can answer, without assuming:

1. Which files appear or change?
2. What is the first executable step and the last one?
3. How is "done" verified?

---

## Phase 4 — Write and save

This is `/spec`'s Phase 3 + Phase 4. Apply them as written in
`.claude/skills/spec/SKILL.md` — the fast path (write the whole spec at once when
Phase 3 is genuinely complete), the section-by-section fallback for vague answers,
and every save rule below come from there. This skill only pins the game-specific
content.

Once Phase 3 is closed and you can answer those three questions without inventing
anything, **write the whole spec at once** — do not go section by section, do not
show a draft for approval first. Section-by-section is the fallback only when an
answer was vague.

Content follows this skill's `template.md` (which itself respects `/spec`'s
`template.md`):

- **Header** — `# SPEC NN — …`, blockquote with `**Status:** Borrador`,
  `**Depends on:** SPEC 05, SPEC 06`, `**Date:**` from the session context,
  one-sentence `**Objective:**`.
- **Por qué existe esta spec** — the game, its source shape (from Phase 2), why
  now, and a `Decisiones ya cerradas con el usuario (no reabrir):` bullet list.
- **Scope** — `**In:**` / `**Out of scope (para futuras specs):**`, both
  mandatory. Include the registry bullet only if this spec creates it; the
  migration bullet only if the id is new; the assets bullet only if there are
  assets.
- **Data model** — no new persistence (Supabase `scores` via `submit_score`);
  then the `<X>Options` / `<X>Handle` / `create<X>Game` signatures, the ported
  internal state, and the component's local state.
- **Implementation plan** — the pre-structured steps from `template.md`,
  particularized. Drop steps that do not apply (source step for a from-scratch
  game; migration step for a reused id; registry step if the registry exists).
  Each step commitable; last step is cleanup + verification, not "test everything".
- **Acceptance criteria** — the base boolean checklist from `template.md` plus the
  mechanic-specific items from Phase 2/3. No aspirational items.
- **Decisions** — `- **Sí:** … porque …` / `- **No:** … porque …`, what was
  considered, not only what was chosen.
- **Riesgos** — the table from `template.md`, trimmed to what actually applies.
- **Qué **no** entra en esta spec** — repeat the Out list, close with "Cada uno,
  si llega, va en su propia spec."

Then save, using `/spec`'s Phase 4 save procedure with these game-spec specifics:

1. Next number = highest in `specs/` + 1, zero-padded to two digits.
2. File name `specs/NN-juego-<slug>.md`, slug in kebab-case from the game name.
3. Date only from the session context. Never write a date you did not read there.
4. Write the file directly. Do not ask permission for the path; announce it. Only
   ask if the file already exists.
5. State `Borrador`. Never `Aprobado` automatically.
6. Verify `SPEC 05` and `SPEC 06` exist in `specs/` before writing the dependency
   line (they do, but check).
7. `specs/.spec-config.yml` already exists — do not touch it.
8. Confirm to the user: the path, that the state is `Borrador` (change to
   `Aprobado` after re-reading), and that the next step is `/spec-impl NN-juego-<slug>`.
   **Stop there.** Do not propose implementing, do not write code.

---

## Hard rules

- **Every hard rule in `.claude/skills/spec/SKILL.md` applies here too.** The list
  below is additive, not a replacement.
- **Never write app code.** Only the spec `.md` at the end. Not the engine, not the
  component, not the migration, not the registry — those are the implementer's job.
- **Never touch `references/`.** Reading only.
- **Never propose implementing the spec.** Your job ends when the file is written.
- **Never invent Next.js 16 APIs or conventions.** The spec tells the implementer
  to read `node_modules/next/dist/docs/`; it does not itself assert how the
  App Router works.
- **Never assume a decision the user did not confirm.** Missing info → ask, in
  Phase 3.
- **If the game is too big** (does not fit one sentence, or bundles several games,
  or needs a new engine plus a schema change plus new platform screens), propose
  splitting it before continuing.
- The `.claude/settings.json` hooks run prettier over any `.md` you write — expect
  the file to come back reformatted.

## Arguments

`$ARGUMENTS` is the game: either a folder name under `references/started-games/`
(e.g. `03-claude-tetris`, or just `tetris`) or a short description of a game to
build from scratch. Derive the spec slug from the game's display name, not from the
folder number. If invoked with no argument, ask in Phase 1.
