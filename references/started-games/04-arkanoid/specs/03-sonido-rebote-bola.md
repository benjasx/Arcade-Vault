# SPEC 03 — Sonido de rebote de la bola

> **Estado:** implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-30
> **Objetivo:** Reproducir `assets/sounds/ball-bounce.mp3` cada vez que la bola rebota en una pared (izquierda, derecha o superior) o en el paddle, sin tocar el sonido de rotura de bloques.

---

## Por qué este spec

SPEC 01 dejó los efectos de sonido fuera de alcance y SPEC 02 añadió solo el sonido de
rotura de bloques (`break-sound.mp3`), anotando que "el sonido de rebote de pared y paddle
(`ball-bounce.mp3`) va en el spec de sonido completo". Este spec cubre exactamente eso: la
segunda y última pista de audio del juego.

---

## Alcance

**Dentro:**

- Pool de 4 elementos `Audio` precargados de `assets/sounds/ball-bounce.mp3`, reproducidos en
  round-robin (mismo patrón que el pool de rotura de SPEC 02, con menos instancias porque los
  rebotes rara vez se solapan).
- Función `playBounceSfx()`: toma el `Audio` del índice actual, `currentTime = 0`, `play()` con
  `.catch( () => {} )` y avanza el cursor en round-robin.
- Disparo de `playBounceSfx()` en los tres rebotes de pared de `updateBall()` (izquierda,
  derecha, techo).
- Disparo de `playBounceSfx()` al final de `collideBallPaddle()`, tras recalcular la velocidad.
- Referencia cruzada en `specs/02-efectos-rotura-bloques.md` indicando que el sonido de rebote
  pared/paddle queda cubierto aquí.

**Fuera (para specs futuros):**

- Sonido al perder una vida o al caer la bola por debajo del borde inferior.
- Sonido distinto para pared vs paddle (aquí es el mismo clip).
- Sonido de rotura de bloques: sigue siendo solo `break-sound.mp3` como en SPEC 02; un rebote
  contra un bloque **no** dispara `ball-bounce.mp3`.
- Control de volumen, mute o menú de audio.
- Música de fondo.

---

## Modelo de datos

Añade un pool de audio análogo al de SPEC 02; no introduce nada en `state` ni se resetea.

```js
// Constantes nuevas
const BOUNCE_SFX_SRC = "assets/sounds/ball-bounce.mp3";
const BOUNCE_SFX_POOL_SIZE = 4;

// Pool de audio (fuera de state, no se resetea)
const bounceSfxPool = []; // Audio[] de longitud BOUNCE_SFX_POOL_SIZE
let bounceSfxIndex = 0; // cursor round-robin
```

Convenciones: mismo estilo que `assets/spritesheet.js` y que el pool de SPEC 02 (2 espacios,
espacios dentro de `( )` y `[ ]`, `const`/`let`).

---

## Plan de implementación

1. **Pool de sonido de rebote.** Junto al bloque de `breakSfxPool` en `game.js`, crear
   `bounceSfxPool` con `BOUNCE_SFX_POOL_SIZE` instancias `new Audio( BOUNCE_SFX_SRC )` y
   `bounceSfxIndex = 0`. Añadir `playBounceSfx()` con la misma forma que `playBreakSfx()`:
   `currentTime = 0`, `play().catch( () => {} )`, avanzar el índice módulo `BOUNCE_SFX_POOL_SIZE`.
   Verificar: servida la carpeta y abierto `index.html`, la consola no muestra errores al cargar
   ni al primer lanzamiento.

2. **Rebote en paredes.** En `updateBall()`, llamar a `playBounceSfx()` dentro de cada una de
   las tres ramas de rebote de pared (colisión con `x - r < 0`, con `x + r > CANVAS_W` y con
   `y - r < 0`). No llamarla en la rama de `y - r > CANVAS_H` (pérdida de vida). Verificar: la
   bola lanzada suena en cada rebote lateral y en el techo; al caer por abajo no suena.

3. **Rebote en el paddle.** Al final de `collideBallPaddle()`, después de fijar `b.vx`, `b.vy` y
   `b.y`, llamar a `playBounceSfx()`. Verificar: cada impacto de la bola en el paddle suena;
   golpear un bloque sigue sonando solo con `break-sound.mp3` y no con `ball-bounce.mp3`.

4. **Actualizar SPEC 02.** En `specs/02-efectos-rotura-bloques.md`, junto al bullet de "Fuera"
   que menciona `ball-bounce.mp3`, anotar que ese sonido se implementa en SPEC 03. Verificar:
   SPEC 02 apunta a este spec y no deja el sonido de rebote como pendiente sin destino.

---

## Criterios de aceptación

- [x] Cada rebote de la bola en la pared izquierda, derecha o superior reproduce `assets/sounds/ball-bounce.mp3`.
- [x] Cada rebote de la bola en el paddle reproduce `assets/sounds/ball-bounce.mp3`.
- [x] Un rebote de la bola contra un bloque **no** reproduce `ball-bounce.mp3`; la rotura del bloque sigue sonando solo con `break-sound.mp3`.
- [x] Cuando la bola cae por debajo del borde inferior (pérdida de vida) no se reproduce ningún sonido.
- [x] Dos rebotes muy seguidos (p. ej. bola encajada en una esquina) se oyen sin que la consola registre errores de audio.
- [x] Tras el primer lanzamiento, ningún rebote genera errores de autoplay en la consola.
- [x] No se añaden dependencias: sin npm, sin paso de build, sin `<script src>` a CDNs.
- [x] `specs/02-efectos-rotura-bloques.md` referencia a este spec para el sonido de rebote.

---

## Decisiones

- **Sí:** pool de 4 `Audio` en round-robin, mismo patrón que SPEC 02. Coherente con el código ya existente; 4 basta porque los rebotes casi nunca se solapan.
- **No:** un solo `Audio` reutilizado. En una esquina la bola puede rebotar dos veces en pocos ms y el segundo `play()` cortaría el primero.
- **No:** `cloneNode()` por rebote. Mismo motivo que en SPEC 02: crea objetos sin límite.
- **Sí:** el mismo clip para pared y paddle. Solo hay un archivo de rebote en `assets/sounds/`; diferenciarlos sería inventar audio que no existe.
- **Sí:** sin sonido al perder vida. No hay un clip adecuado y no se pidió.
- **Descartado:** archivo `audio.js` aparte. `CLAUDE.md` pide todo el juego en `game.js`; el pool cabe al lado del de rotura.

---

## Riesgos

| Riesgo                                                                    | Mitigación                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| La política de autoplay bloquea el primer `play()`                        | El primer rebote siempre ocurre tras el gesto de lanzamiento (click/Espacio); `play()` lleva `.catch( () => {} )`.    |
| Abrir con `file://` no carga el `.mp3`                                    | Ya documentado en `CLAUDE.md`: servir la carpeta (`python -m http.server`) antes de jugar.                            |
| Rebotes en ráfaga (bola casi horizontal rozando el techo) saturan el pool | Aceptable: se reinicia `currentTime`; a ese ritmo el corte es imperceptible. Subir `BOUNCE_SFX_POOL_SIZE` si molesta. |

---

## Lo que **no** entra en este spec

- Sonido al perder una vida o en Game Over / cambio de stage.
- Clips distintos para pared y paddle.
- Cambios en el sonido de rotura de bloques.
- Control de volumen, mute o música de fondo.

Cada uno de estos, si se hace, va en su propio spec.
