# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Un juego tipo Arkanoid/Breakout hecho con **HTML, CSS y JavaScript puros, cero dependencias**
(ver `README.md`). Ya está implementado y jugable: `index.html` + `style.css` + `game.js` en la
raíz, más los assets de arte/sonido. Mantener la restricción de cero dependencias es un
requisito duro: nada de paquetes npm, sin paso de build, sin framework, sin bundler.

## Ejecutar

No hay sistema de build, ni runner de tests, ni linter. El juego se ejecuta abriendo
`index.html` en el navegador. Como `assets/spritesheet.js` carga `assets/spritesheet-breakout.png`
por HTTP, hay que servir la carpeta en vez de usar `file://` (por ejemplo `python -m http.server`
desde la raíz del repo) o fallará la carga de la imagen.

## Arquitectura de `game.js`

Un único archivo, sin módulos. De arriba abajo:

- **Bloque de constantes** (`CANVAS_W`, `PADDLE`, `BALL`, curvas de dificultad, tuning de
  partículas/audio…). Cambiar el balance del juego es tocar estas constantes, no la lógica.
- **`PATTERNS`** — catálogo de formas de rejilla (`full`, `pyramid`, `checker`, `diamond`,
  `columns`, `frame`, `zigzag`, `funnel`); `buildBricks( stage )` elige patrón por stage y añade
  relleno procedural.
- **`state`** — objeto mutable único con todo el estado de la partida (`phase`, `stage`, `lives`,
  `score`, `paddle`, `balls` (array; multibola), `bricks`, `buff`, `particles`, `flashes`,
  `popups`, `input`). `resetGame()` y `advanceStage()` lo reinician.
- **Pools de audio** (`breakSfxPool`, `bounceSfxPool`) — viven fuera de `state`, no se resetean.
- **`update( dt )` / `render()`** — separados. `update` no hace nada si `state.phase !== "playing"`.
  Fases: `playing` | `gameover` | `stageclear`.
- **Bucle** — `frame( ts )` con `requestAnimationFrame`; `now` y `lastTime` son globales de
  módulo, `dt` va topado a 50 ms. Las colisiones de la bola hacen substepping (varios pasos por
  frame según la velocidad) para no atravesar bloques.
- **Input** — listeners de `mousemove` / `click` / `keydown` / `keyup` al final; ratón y flechas
  conviven, el teclado toma el control hasta que el ratón se vuelve a mover.

## Flujo de trabajo: desarrollo guiado por specs

Este repo usa dos skills vendored (fijadas en `skills-lock.json`, con origen en
`Klerith/fernando-skills`, symlinkeadas dentro de `.claude/skills/` desde `.agents/skills/`):

- `/spec <descripción de la feature>` — aclara requisitos mediante bloques de preguntas y luego
  escribe `specs/NN-slug.md`. **No** escribe código. También creó `specs/.spec-config.yml` en la
  primera ejecución.
- `/spec-impl <NN-slug>` — solo corre si el estado del spec significa "Aprobado"; crea y cambia
  a la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`, por
  defecto `true`), luego implementa el plan paso a paso, pausando tras cada paso para revisar el
  diff. Nunca hace commit automáticamente.

Los archivos de spec (`specs/`) siguen `.agents/skills/spec/template.md`: blockquote de cabecera
(Estado / Depende de / Fecha / Objetivo en una frase), Alcance (Dentro + Fuera), Modelo de datos,
Plan de implementación (cada paso commiteable y ejecutable por separado), Criterios de aceptación
booleanos, Decisiones tomadas/descartadas, Riesgos opcionales. Ciclo de estados:
`Borrador → En revisión → Aprobado → Implementado → Obsoleto`. Quien pasa un spec a `Aprobado`
es una persona, no el agente.

### Specs existentes

Todos en estado **implementado**. Cada spec puede sustituir o levantar bullets de uno anterior;
leer siempre el spec más reciente que toque un área antes de cambiarla.

- **SPEC 01 — MVP jugable**: `index.html` / `style.css` / `game.js`, paddle (ratón + flechas),
  bola pegada que se lanza con click/Espacio, rebotes, un nivel de bloques, vidas, game over y
  victoria.
- **SPEC 02 — Efectos de rotura**: sustituye la rotura de SPEC 01 por sonido + partículas con
  gravedad + destello blanco + popup de puntos, encima de la animación de 4 frames.
- **SPEC 03 — Sonido de rebote**: `ball-bounce.mp3` en cada rebote de pared o paddle.
- **SPEC 04 — Niveles progresivos**: sustituye la pantalla de victoria por stages infinitos con
  más filas, bloques blindados y bola más rápida; multibola por bloques destruidos.
- **SPEC 05 — Stages con forma propia y habilidades**: `PATTERNS` + relleno procedural en vez de
  rejilla rectangular, recalibra las tres curvas de dificultad de SPEC 04, escalona el HP del
  blindaje por stage, alterna multibola / buff de velocidad en los hitos, y añade +1 vida cada
  1.000 puntos (tope 10). Modifica SPEC 04.

El repo **es** un repositorio git; `main` es la rama principal y `/spec-impl` crea las ramas
`spec-NN-slug`.

## Assets

- `assets/spritesheet.js` — el helper de renderizado. Cárgalo, llama a `loadSpritesheet( cb )`
  una vez y luego usa `drawSprite( ctx, name, x, y, w, h )` y `drawFrame( ctx, frame, x, y, w, h )`.
  Dibuja el PNG de origen en un canvas offscreen antes de usarlo. Nombres de sprites: `paddle`,
  `ball` y `block_<skin>` donde skin es uno de
  `gray red yellow cyan magenta hotpink green` (colores de fila) más las texturas de bloque
  blindado `wood brick slate`. En `game.js`, `ARMOR_SKIN` mapea HP → skin
  (`2:wood, 3:brick, 4:gray, 5:slate`). `EXPLOSION_FRAMES[color]` contiene animaciones de rotura
  de 4 frames (claves: `red cyan green magenta yellow hotpink gray`), y también sirve de overlay
  de grietas en bloques dañados; `EXPLOSION_DURATION` son 150 ms.
- `assets/spritesheet-breakout.png` — spritesheet de origen (coordenadas hardcodeadas en
  `spritesheet.js`).
- `assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3` — los dos únicos efectos de
  sonido.

## Convenciones

- Respuestas y preguntas de aclaración al usuario: en español. Código, identificadores,
  comentarios y mensajes de commit: en inglés.
- Estilo de `spritesheet.js` y `game.js`: espacios dentro de paréntesis/corchetes
  (`drawImage( ssImg, ... )`), indentación de 2 espacios, `const`/`let`. Mantenlo en los archivos
  nuevos del juego.
</content>
</invoke>
