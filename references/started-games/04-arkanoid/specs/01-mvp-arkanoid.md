# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** implementado
> **Depende de:** —
> **Fecha:** 2026-08-30
> **Objetivo:** Implementar un Arkanoid jugable de principio a fin (paddle, bola, un nivel de bloques, 3 vidas y pantallas de game over y victoria) en HTML/CSS/JS sin dependencias.

---

## Alcance

**Dentro:**

- `index.html` con un `<canvas>` de 800x600 fijo, centrado, que carga `assets/spritesheet.js` y luego `game.js`.
- `style.css` corto: fondo de página, centrado del canvas.
- `game.js` único con todo el juego: bucle, input, física, colisiones, estados y render.
- Paddle controlado a la vez por ratón (sigue la X del cursor) y por flechas ←/→ del teclado, sin salir del área.
- Bola que arranca pegada al paddle; se lanza hacia arriba con click o tecla Espacio. Mismo comportamiento tras perder una vida.
- Rebote de la bola en las paredes izquierda, derecha y superior.
- Rebote en el paddle con ángulo dependiente del punto de impacto (estilo clásico). Rapidez de la bola constante durante toda la partida.
- Un nivel fijo: rejilla de 10 columnas x 5 filas (50 bloques), un color por fila, todos se rompen de un golpe.
- Al romper un bloque: desaparece, se reproduce la animación de rotura de 4 frames (`EXPLOSION_FRAMES` / `EXPLOSION_DURATION`) y la bola cambia de dirección. **El detalle de la rotura (sonido, partículas, destello y popup de puntos) queda sustituido por `specs/02-efectos-rotura-bloques.md`; aquí solo se mantiene la animación de 4 frames y el rebote.**
- 3 vidas. Si la bola cae por debajo del borde inferior se pierde una vida y la bola vuelve a quedar pegada al paddle.
- HUD de texto en el canvas: `Vidas: N`.
- Pantalla de Game Over al llegar a 0 vidas. Pantalla de victoria al limpiar los 50 bloques. **`specs/04-niveles-progresivos.md` sustituye la pantalla de victoria por el avance de stage: limpiar la rejilla ya no gana la partida, sino que carga un stage más difícil, y la única forma de terminar pasa a ser quedarse sin vidas.**
- Desde Game Over o victoria, pulsar una tecla o hacer click reinicia la partida con 3 vidas y el nivel completo.

**Fuera (para specs futuros):**

- Efectos de sonido (`assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3`).
- Menú de título y pausa.
- Puntuación y persistencia de récord en localStorage.
- Power-ups / cápsulas (el spritesheet no incluye sprites de cápsula).
- Múltiples niveles o generación procedural de niveles.
- Bloques con varios golpes de resistencia (todos los del MVP se rompen de un golpe).
- Diseño responsive / escalado del canvas al viewport.

---

## Modelo de datos

```js
// Constantes de configuración
const CANVAS_W = 800;
const CANVAS_H = 600;

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, constante
const START_LIVES = 3;

// Rejilla de bloques del nivel fijo
const GRID = {
  cols: 10,
  rows: 5,
  marginX: 40, // margen lateral dentro del canvas
  top: 60, // offset superior
  gapX: 8,
  gapY: 4,
  rowColors: ["red", "hotpink", "magenta", "cyan", "yellow"], // color por fila (índice 0 = fila superior)
};
// Ancho de bloque derivado: (CANVAS_W - 2*marginX - (cols-1)*gapX) / cols

// Estado en runtime (un objeto vivo, mutado por el bucle)
const state = {
  phase: "playing", // 'playing' | 'gameover' | 'win'
  lives: 3,
  ballStuck: true, // true = pegada al paddle esperando lanzamiento
  paddle: { x: 0, y: 560, w: 96, h: 16 },
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: 7 },
  bricks: [
    // { x, y, w, h, color, alive: true, breaking: false, breakStart: 0 }
  ],
  input: { left: false, right: false, mouseX: null },
};
```

> **`specs/04-niveles-progresivos.md`** sustituye `state.ball` por la colección `state.balls` ("una sola bola" es `state.balls.length === 1`), reemplaza el flag global `state.ballStuck` por `ball.stuck` en cada bola, y mueve la pérdida de vida al momento en que cae la **última** bola de `state.balls` (mientras quede alguna, no se resta vida). La fase `"win"` desaparece.

Convenciones:

- Origen de coordenadas arriba-izquierda.
- Velocidades en píxeles por segundo; el bucle usa delta time (`requestAnimationFrame`).
- Estilo de código igual a `assets/spritesheet.js`: 2 espacios de indentación, espacios dentro de `( )` y `[ ]`, `const`/`let`.

---

## Plan de implementación

1. **Esqueleto.** Crear `index.html` (canvas 800x600 + `<script src="assets/spritesheet.js">` y `<script src="game.js">`) y `style.css` (centrado y fondo). En `game.js`: obtener el contexto 2D, llamar a `loadSpritesheet` y arrancar un bucle `requestAnimationFrame` que solo limpia el canvas con un color de fondo. Verificar: servida la carpeta (`python -m http.server`) y abierto `index.html`, se ve el canvas vacío sin errores en consola.
2. **Paddle + input.** Dibujar el paddle con `drawSprite( ctx, 'paddle', ... )` en `PADDLE.y`. Escuchar `mousemove` sobre el canvas y `keydown`/`keyup` de `ArrowLeft`/`ArrowRight`. Actualizar `state.paddle.x` con ambos, con clamp a `[ 0, CANVAS_W - paddle.w ]`. Verificar: el paddle se mueve con el ratón y con las flechas y no sale del área.
3. **Bola pegada + lanzamiento + paredes.** Renderizar la bola con `drawSprite( ctx, 'ball', ... )`. Mientras `ballStuck`, la bola sigue el centro del paddle. En `click` sobre el canvas o `keydown` de `Space`: pasar `ballStuck` a `false` y fijar `vx/vy` hacia arriba (ángulo aleatorio moderado, ni horizontal ni vertical puro). Integrar posición por delta time y rebotar en las paredes izquierda, derecha y superior. Verificar: la bola sale al pulsar, rebota en 3 paredes y no escapa por arriba ni por los lados.
4. **Rejilla de bloques.** Función que construye `state.bricks` a partir de `GRID` (ancho de bloque derivado, un color por fila). Dibujar cada bloque vivo con `drawSprite( ctx, 'block_' + color, x, y, w, h )`. Verificar: se ven 50 bloques colocados en rejilla 10x5, un color por fila.
5. **Colisión bola-bloque + rotura.** Detección AABB bola vs bloque vivo; al impactar: `alive = false`, marcar `breaking` con `breakStart = now`, reflejar la bola en el eje de menor penetración. Durante `EXPLOSION_DURATION` (150 ms) dibujar el frame correspondiente de `EXPLOSION_FRAMES[ color ]` con `drawFrame`. Resolver como máximo un bloque por frame. Verificar: golpear un bloque lo elimina, muestra la animación de 4 frames y la bola cambia de dirección. **Las capas de feedback añadidas sobre esta rotura (sonido, partículas, destello, popup de puntos) se especifican en `specs/02-efectos-rotura-bloques.md`.**
6. **Rebote en el paddle con ángulo.** Colisión bola vs paddle; calcular offset normalizado `(-1..1)` del punto de impacto respecto al centro del paddle y mapearlo a un ángulo de salida (p. ej. hasta ±60° respecto a la vertical). Mantener la magnitud de velocidad en `BALL.speed` (constante). Verificar: impactos en los bordes del paddle abren el ángulo; impactos centrales devuelven la bola casi vertical; la rapidez no cambia en toda la partida.
7. **Vidas + pérdida.** Si `ball.y - r > CANVAS_H`: `lives--`, volver a `ballStuck = true` y recolocar la bola sobre el paddle. Dibujar el HUD `Vidas: N` con `ctx.fillText`. Verificar: dejar caer la bola decrementa el HUD y la bola vuelve a quedar pegada al paddle.
8. **Game Over + victoria + reinicio.** Si `lives === 0`: `phase = 'gameover'`. Si no queda ningún bloque vivo: `phase = 'win'`. En esas fases, congelar la simulación y dibujar un overlay con el texto correspondiente y "Pulsa una tecla o haz click para reiniciar". Un `keydown` o `click` en esas fases reinicia todo el estado (3 vidas, rejilla completa, bola pegada, `phase = 'playing'`). Verificar: ambas pantallas son alcanzables y el reinicio devuelve la partida al estado inicial. **`specs/04-niveles-progresivos.md` sustituye `phase = 'win'` por la fase `"stageclear"` y el avance a un stage más difícil; deja de existir un estado final de victoria.**

---

## Criterios de aceptación

- [x] Servida la carpeta y abierto `index.html`, aparece un canvas de 800x600 centrado y sin errores en la consola.
- [x] El paddle sigue la X del ratón y también se mueve con las flechas ←/→, y nunca sale del área de juego.
- [x] Al cargar la página la bola está pegada al paddle y se mueve con él.
- [x] Un click en el canvas o la tecla Espacio lanza la bola hacia arriba.
- [x] La bola rebota en las paredes izquierda, derecha y superior y no las atraviesa.
- [x] El nivel muestra 50 bloques en una rejilla de 10x5 con un color distinto por fila.
- [x] Al golpear un bloque, este desaparece, se reproduce una animación de rotura de 4 frames y la bola cambia de dirección.
- [x] El ángulo de rebote en el paddle depende del punto de impacto; la rapidez de la bola es constante durante toda la partida.
- [x] Si la bola cae por debajo del borde inferior se pierde una vida, el HUD `Vidas: N` se actualiza y la bola vuelve a quedar pegada al paddle.
- [x] Con 0 vidas aparece la pantalla de Game Over.
- [x] Al eliminar los 50 bloques aparece la pantalla de victoria.
- [x] Desde Game Over o victoria, pulsar una tecla o hacer click reinicia la partida con 3 vidas y el nivel completo.
- [x] No hay dependencias externas: sin npm, sin paso de build, sin `<script src>` a CDNs; solo `assets/spritesheet.js` y `game.js`.

---

## Decisiones

- **Sí:** MVP de un solo nivel fijo. Reduce el alcance a algo terminable; los niveles múltiples van en otro spec.
- **Sí:** 3 vidas con game over y victoria. Da un ciclo de partida completo sin complicar el estado.
- **Sí:** control mixto ratón + teclado. El coste de código extra es bajo y cubre ambas preferencias.
- **Sí:** `index.html` + `game.js` único + `style.css`. Menos superficie que revisar y trivial de servir; sin módulos.
- **Sí:** bola pegada al paddle con lanzamiento manual (click / Espacio). Evita empezar con la bola ya en movimiento sin que el jugador esté listo, sin necesidad de menú.
- **Sí:** canvas 800x600 fijo. Sin cálculos de escala ni coordenadas relativas.
- **Sí:** rejilla 10x5, un color por fila, bloques de un golpe. Layout predecible y fácil de construir por código.
- **Sí:** rapidez de bola constante; el ángulo lo da el punto de impacto en el paddle. Comportamiento clásico y suficiente para el MVP.
- **Sí:** incluir la animación de rotura (`EXPLOSION_FRAMES`). Es puramente visual y ya está disponible en `spritesheet.js`.
- **Sí:** reinicio con tecla o click, no con `<button>` HTML. Mantiene toda la interacción dentro del canvas.
- **No:** efectos de sonido. Fuera del MVP; se añaden en un spec posterior.
- **No:** menú de título y pausa. Fuera del MVP.
- **No:** puntuación y highscore en localStorage. Spec futuro.
- **No:** power-ups. Spec futuro; además faltan sprites de cápsula.
- **No:** múltiples niveles o generación procedural. Spec futuro.
- **No:** bloques con resistencia de varios golpes. Todos se rompen de un golpe en el MVP.
- **No:** canvas responsive. Fijo para evitar lógica de escalado.

---

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tunneling: a paso grande por frame la bola podría atravesar un bloque o una pared | Velocidad moderada (`BALL.speed = 360`); si aparece, subdividir el desplazamiento del frame en pasos menores. |
| Colisión simultánea con varios bloques en una esquina produce rebotes erráticos   | Resolver como máximo un bloque por frame, eligiendo el de menor penetración.                                  |
| Abrir `index.html` con `file://` no carga `spritesheet-breakout.png`              | Documentado en `CLAUDE.md`: servir la carpeta (`python -m http.server`) antes de jugar.                       |
| El sprite del paddle (162x14) se dibuja escalado a 96x16 y puede verse deformado  | Aceptable para el MVP; ajustar `PADDLE.w/h` a la proporción del sprite si molesta.                            |

---

## Lo que **no** entra en este spec

- Efectos de sonido.
- Menú de título y pausa.
- Puntuación y récord persistente.
- Power-ups.
- Más de un nivel y generación de niveles.
- Bloques con varios golpes de resistencia.
- Escalado responsive del canvas.

Cada uno de estos, si se hace, va en su propio spec.
