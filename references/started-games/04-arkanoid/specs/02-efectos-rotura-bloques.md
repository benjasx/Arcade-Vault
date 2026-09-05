# SPEC 02 — Efectos de rotura de bloques

> **Estado:** implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-30
> **Objetivo:** Al romper un bloque, sumar a la animación de 4 frames existente un sonido de rotura, fragmentos con gravedad, un destello blanco y un popup flotante de "+10".

---

## Por qué este spec

SPEC 01 ya elimina el bloque, reproduce `EXPLOSION_FRAMES` y rebota la bola. Este spec
**sustituye la parte de rotura de SPEC 01** (el bullet "Al romper un bloque…" y el paso 5 de su
plan) por una versión con más capas de feedback: sonido + partículas + destello + puntos
flotantes. La animación de 4 frames se mantiene tal cual; todo lo demás se suma encima.

---

## Alcance

**Dentro:**

- Pool de 8 elementos `Audio` precargados de `assets/sounds/break-sound.mp3`, reproducidos en
  round-robin para que roturas seguidas se solapen sin cortarse.
- `state.particles`: fragmentos rectangulares del color del bloque roto, con velocidad inicial
  aleatoria, gravedad y desvanecimiento; tope global de partículas vivas.
- `state.flashes`: destello blanco del tamaño del bloque, alpha que decae a 0 en ~100 ms.
- `state.popups`: texto `+10` que aparece sobre el bloque roto, sube y se desvanece en ~600 ms.
- Disparo de las cuatro capas (sonido, partículas, destello, popup) desde el punto de rotura en
  `collideBallBricks()`. **`specs/04-niveles-progresivos.md` añade un caso previo de golpe no
  letal a un bloque blindado (`hp > 0` tras el impacto): solo sonido + destello, sin partículas,
  popup ni score. El camino de rotura real (`hp === 0`) mantiene las cuatro capas y además
  alimenta el contador `state.bricksDestroyed` que activa la multibola cada 10 bloques.**
- Limpieza de los tres arrays nuevos en `resetGame()`.
- Referencia cruzada en `specs/01-mvp-arkanoid.md` indicando que el detalle de rotura vive ahora
  en este spec.

**Fuera (para specs futuros):**

- Sonido de rebote de pared y paddle (`assets/sounds/ball-bounce.mp3`) — implementado en SPEC 03.
- Screen shake / sacudida del canvas.
- Bloques con resistencia de varios golpes o estado de daño.
- Partículas construidas a partir de recortes del spritesheet.
- Puntos por bloque distintos de 10 o multiplicadores de combo.
- Control de volumen, mute o menú de audio.

---

## Modelo de datos

Añade estructuras nuevas; reutiliza `state`, `GRID` y el bucle de SPEC 01.

```js
// Constantes nuevas
const BREAK_SFX_SRC = "assets/sounds/break-sound.mp3";
const BREAK_SFX_POOL_SIZE = 8;

const PARTICLES_PER_BRICK = 10; // fragmentos por bloque roto
const PARTICLE_MAX = 200; // tope global de partículas vivas
const PARTICLE_LIFE = 500; // ms de vida
const PARTICLE_GRAVITY = 900; // px/s^2 hacia abajo
const PARTICLE_SIZE_MIN = 3; // px
const PARTICLE_SIZE_MAX = 5; // px
const PARTICLE_VX_MAX = 180; // px/s, rango [-max, +max]
const PARTICLE_VY_MIN = -260; // px/s (hacia arriba)
const PARTICLE_VY_MAX = -40; // px/s

const FLASH_DURATION = 100; // ms
const POPUP_LIFE = 600; // ms
const POPUP_RISE = 28; // px que sube en toda su vida

// Pool de audio (fuera de state, no se resetea)
const breakSfxPool = []; // Audio[]  de longitud BREAK_SFX_POOL_SIZE
let breakSfxIndex = 0; // cursor round-robin

// Arrays nuevos dentro de state
state.particles = []; // { x, y, vx, vy, size, color, born }
state.popups = []; // { x, y, text, born }
state.flashes = []; // { x, y, w, h, born }
```

Convenciones:

- `born` guarda `now` (timestamp de `requestAnimationFrame`) al crear el elemento; la edad es
  `now - born`.
- `color` de la partícula es el `br.color` del bloque (`"red"`, `"hotpink"`, `"magenta"`,
  `"cyan"`, `"yellow"`): son keywords CSS válidas, se usan directas en `ctx.fillStyle`.
- Mismo estilo que `assets/spritesheet.js`: 2 espacios, espacios dentro de `( )` y `[ ]`,
  `const`/`let`.

---

## Plan de implementación

1. **Pool de sonido de rotura.** Crear `breakSfxPool` con `BREAK_SFX_POOL_SIZE` instancias
   `new Audio( BREAK_SFX_SRC )` y `breakSfxIndex`. Función `playBreakSfx()`: toma el `Audio` del
   índice actual, hace `currentTime = 0`, llama a `play()` con `.catch( () => {} )` y avanza el
   índice en round-robin. Invocarla en `collideBallBricks()` justo tras marcar el bloque roto.
   Verificar: servida la carpeta, cada rotura suena; dos roturas casi simultáneas se oyen
   solapadas; tras el primer lanzamiento la consola no muestra errores de autoplay.

2. **Sistema de partículas.** Añadir `state.particles` y sus constantes. `spawnParticles( br )`:
   si `state.particles.length >= PARTICLE_MAX` no añade nada; si no, empuja `PARTICLES_PER_BRICK`
   partículas desde el centro de `br` con `vx` aleatorio en `[ -PARTICLE_VX_MAX, PARTICLE_VX_MAX ]`,
   `vy` aleatorio en `[ PARTICLE_VY_MIN, PARTICLE_VY_MAX ]`, `size` en el rango configurado y
   `color = br.color`. `updateParticles( dt )`: integra `x/y`, aplica `PARTICLE_GRAVITY` a `vy` y
   descarta las de edad `>= PARTICLE_LIFE`. En `render()` dibujarlas como `fillRect` con
   `globalAlpha = 1 - edad / PARTICLE_LIFE`. Llamar a `spawnParticles` en la rotura y a
   `updateParticles` desde `update()`. Verificar: al romper un bloque salen ~10 fragmentos de su
   color que caen y se desvanecen en ~0,5 s; rompiendo muchos bloques el total vivo no pasa de
   `PARTICLE_MAX`.

3. **Destello de impacto.** Añadir `state.flashes` y `FLASH_DURATION`. `spawnFlash( br )` empuja
   `{ x: br.x, y: br.y, w: br.w, h: br.h, born: now }`. En `render()`, por cada flash: dibujar
   `fillRect` blanco con `globalAlpha = 1 - edad / FLASH_DURATION` y descartar al llegar a
   `FLASH_DURATION`. Llamar a `spawnFlash` en la rotura. Verificar: cada bloque roto parpadea en
   blanco sobre su rectángulo y el parpadeo desaparece en ~100 ms.

4. **Popup de puntos.** Añadir `state.popups`, `POPUP_LIFE`, `POPUP_RISE`. `spawnPopup( br )`
   empuja `{ x: br.x + br.w / 2, y: br.y + br.h / 2, text: "+10", born: now }`. `updatePopups( dt )`
   descarta los de edad `>= POPUP_LIFE`. En `render()` dibujar cada popup con `textAlign =
"center"`, subiendo `POPUP_RISE * ( edad / POPUP_LIFE )` px y con `globalAlpha = 1 - edad /
POPUP_LIFE`. Llamar a `spawnPopup` en la rotura y a `updatePopups` desde `update()`.
   Verificar: sobre cada bloque roto aparece "+10" que sube y se desvanece en ~600 ms.

5. **Reset y limpieza.** En `resetGame()` vaciar `state.particles`, `state.popups` y
   `state.flashes` (asignar `[]` o `length = 0`). Verificar: tras Game Over o Victoria, al
   reiniciar no queda ninguna partícula, popup ni destello del intento anterior.

6. **Actualizar SPEC 01.** En `specs/01-mvp-arkanoid.md`, anotar junto al bullet "Al romper un
   bloque…" y al paso 5 del plan que el detalle de la rotura queda sustituido por SPEC 02.
   Verificar: SPEC 01 apunta a SPEC 02 para ese detalle y no describe dos comportamientos
   distintos sin relacionarlos.

---

## Criterios de aceptación

- [x] Cada bloque roto reproduce `assets/sounds/break-sound.mp3`.
- [x] Dos roturas separadas por menos de 150 ms se oyen solapadas, sin que la segunda corte a la primera.
- [x] Tras el primer lanzamiento de bola, romper bloques no genera errores de autoplay en la consola.
- [x] Al romper un bloque aparecen entre 8 y 12 fragmentos del color de ese bloque.
- [x] Los fragmentos aceleran hacia abajo (gravedad) y se desvanecen hasta desaparecer en ~500 ms.
- [x] El número total de partículas vivas nunca supera `PARTICLE_MAX`.
- [x] Cada bloque roto muestra un destello blanco de ~100 ms encajado en su rectángulo.
- [x] Sobre cada bloque roto aparece "+10" que sube ~28 px y se desvanece en ~600 ms.
- [x] La animación de sprite de 4 frames (`EXPLOSION_FRAMES` / `EXPLOSION_DURATION`) sigue reproduciéndose en cada rotura.
- [x] Al reiniciar desde Game Over o Victoria no queda ninguna partícula, popup ni destello del intento anterior.
- [x] No se añaden dependencias: sin npm, sin paso de build, sin `<script src>` a CDNs.
- [x] `specs/01-mvp-arkanoid.md` referencia a este spec para el detalle de la rotura.

---

## Decisiones

- **Sí:** pool de 8 `Audio` precargados en round-robin. Permite solapar roturas seguidas sin cortar el sonido; coste de memoria trivial.
- **No:** `cloneNode()` del `Audio` por cada golpe. Crea objetos sin límite en ráfagas de roturas.
- **No:** sonido de rebote (`ball-bounce.mp3`) en pared y paddle. Fuera de este spec; va en el spec de sonido completo.
- **Sí:** mantener la animación de 4 frames y sumar las capas nuevas encima. El objetivo es más feedback, no reemplazar lo que ya funciona.
- **Sí:** partículas como `fillRect` del color del bloque con gravedad. Los colores de bloque son keywords CSS válidas, así que `fillStyle = color` funciona directo; sin recortes de spritesheet.
- **Sí:** tope global `PARTICLE_MAX`. Evita caídas de FPS si se rompen muchos bloques a la vez.
- **Sí:** destello como `fillRect` blanco de ~100 ms. Lectura de impacto inmediata y más barato que un gradiente radial.
- **Sí:** popup con texto fijo `+10`. El único valor por bloque en el MVP es 10 (`game.js:162`); parametrizarlo es trabajo sin uso.
- **Sí:** `particles` / `popups` / `flashes` como arrays propios en `state`, no como campos del brick. Se actualizan y se limpian por separado de la rejilla.
- **No:** screen shake. No se pidió en la definición.
- **Descartado:** archivo `audio.js` aparte. `CLAUDE.md` pide todo el juego en `game.js`; el pool cabe ahí.

---

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| La política de autoplay bloquea el primer `play()` si se dispara sin gesto    | El primer sonido ocurre tras click/Espacio (lanzamiento); `play()` lleva `.catch( () => {} )` para no ensuciar la consola. |
| Ráfaga de roturas (bola rápida recorriendo una fila) genera muchas partículas | Tope global `PARTICLE_MAX`; `spawnParticles` no añade nada si ya se alcanzó.                                               |
| 8 `Audio` no bastan en roturas muy seguidas y se reutiliza uno aún sonando    | Aceptable: se reinicia `currentTime`; el corte es imperceptible a ese ritmo. Subir `BREAK_SFX_POOL_SIZE` si molesta.       |
| Abrir con `file://` no carga los `.mp3` (igual que el PNG del spritesheet)    | Ya documentado en `CLAUDE.md`: servir la carpeta (`python -m http.server`) antes de jugar.                                 |

---

## Lo que **no** entra en este spec

- Sonido de rebote de pared y paddle (`ball-bounce.mp3`) — implementado en SPEC 03.
- Screen shake.
- Bloques con resistencia de varios golpes.
- Partículas a partir de recortes del spritesheet.
- Valores de puntos por bloque distintos de 10 y combos.
- Control de volumen o mute.

Cada uno de estos, si se hace, va en su propio spec.
