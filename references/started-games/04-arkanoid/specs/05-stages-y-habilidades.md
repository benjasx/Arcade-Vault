# SPEC 05 — Stages con forma propia y habilidades por hitos

> **Estado:** implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 04
> **Fecha:** 2026-08-30
> **Objetivo:** Que cada stage se vea y se juegue distinto con una curva de dificultad gradual, y añadir dos habilidades nuevas: un buff temporal de velocidad (lenta o rápida) y una vida extra cada 1.000 puntos con tope de 10.

---

## Por qué este spec

SPEC 04 dejó los stages "infinitos" pero no distintos: `buildBricks( stage )` siempre generaba
una rejilla rectangular llena de 10 columnas y las tres palancas de dificultad topaban muy
pronto (filas en el stage 5, blindaje en el stage 5, velocidad en el stage 8). Del stage 8 en
adelante todos los niveles eran estadísticamente idénticos y lo único que cambiaba era dónde
caía el RNG de los bloques blindados. Además la única habilidad era la multibola cada 30
bloques, y el HP de un bloque blindado (`2 + random()*4`, es decir 2–5) no dependía del stage,
así que en el stage 2 ya podían salir bloques de 5 golpes.

Este spec sustituye la generación por fórmula plana por un **catálogo de patrones de forma +
densificación procedural**, recalibra las tres curvas para que suban más despacio y con techo
más lejano, escalona el HP del blindaje por stage, y amplía las habilidades.

---

## Alcance

**Dentro:**

- `PATTERNS`: catálogo de 8 patrones de forma (`full`, `pyramid`, `checker`, `diamond`,
  `columns`, `frame`, `zigzag`, `funnel`). Cada uno es
  `cell( row, rows, col, cols ) => boolean`. El stage `N` usa `PATTERNS[ ( N - 1 ) % 8 ]`.
- `layoutBricks( stage, rows, bw, pattern )`: recorre la rejilla y crea un brick si la celda
  está dentro del patrón **o** si `Math.random() < fillChance( stage )` (relleno procedural que
  hace que el mismo patrón se juegue más denso en la siguiente vuelta del catálogo).
- `buildBricks( stage )` elige patrón y llama a `layoutBricks`; si el resultado tiene menos de
  `MIN_BRICKS` (14) bloques, reconstruye con `PATTERNS[ 0 ]` (`full`).
- Recalibración de curvas:
  - Filas: `Math.min( START_ROWS + Math.floor( stage / 2 ), MAX_ROWS )` (tope en el stage 8).
  - `armorChance( stage ) = Math.min( 0.08 * ( stage - 1 ), 0.75 )` (tope en el stage 10).
  - Velocidad: `STAGE_SPEED_STEP = 0.05`, `STAGE_SPEED_CAP = 1.75` (tope en el stage 16).
- `maxArmorHp( stage ) = clamp( 2 + Math.floor( ( stage - 1 ) / 3 ), 2, ARMOR_MAX_HP )`. El HP
  de un bloque blindado pasa a `2 + Math.floor( Math.random() * ( maxArmorHp( stage ) - 1 ) )`:
  stages 2–3 solo generan blindados de 2 golpes (`wood`); los de 5 (`slate`) no aparecen antes
  del stage 10.
- Separar velocidad base y efectiva: `state.ballSpeed` se renombra a `state.stageSpeed`;
  `effectiveSpeed()` devuelve `state.stageSpeed * ( state.buff ? state.buff.mult : 1 )`.
  `launchBall()`, `collideBallPaddle()` y `spawnMultiball()` usan `effectiveSpeed()`.
- `state.buff`: `{ kind: "slow" | "fast", mult, until }` o `null`. `activateBuff()` tira una
  moneda 50/50: `slow` (`BUFF_SLOW = 0.7`) o `fast` (`BUFF_FAST = 1.35`), fija
  `until = now + BUFF_DURATION` (10.000 ms), llama a `rescaleBalls()` y lanza un notice. Un buff
  nuevo reemplaza al anterior (no acumula tiempo). En `update()`, si `now >= state.buff.until`
  se pone a `null` y se llama a `rescaleBalls()`.
- `rescaleBalls()`: renormaliza `( vx, vy )` de cada bola no pegada al módulo `effectiveSpeed()`
  conservando la dirección, para que un buff afecte también a las bolas ya en vuelo sin esperar
  al siguiente rebote.
- Sub-pasos de colisión: `updateBalls()` parte el desplazamiento del frame en
  `steps = Math.max( 1, Math.ceil( Math.hypot( vx, vy ) * dt / r ) )` y ejecuta movimiento +
  `collideBallWall` + `collideBallPaddle` + `collideBallBricks` por sub-paso. Las llamadas de
  colisión salen del bucle propio de `update()`. `updateBalls()` fija el límite del bucle con
  `count` capturado al entrar, para que las bolas de multibola nazcan y no se muevan hasta el
  frame siguiente (comportamiento de SPEC 04).
- Hitos:
  - Hito de bloques (cada `MULTIBALL_EVERY = 30` bloques realmente rotos): `state.blockMilestones++`;
    si el contador es impar → multibola + notice `"MULTIBALL!"`; si es par → `activateBuff()`.
    Es decir 30 → multibola, 60 → buff, 90 → multibola…
  - Hito de puntos (`LIFE_EVERY = 1000`): al cruzar un múltiplo de 1.000 (comparando el score
    antes y después de sumar los puntos del bloque), si `state.lives < MAX_LIVES` (10) →
    `state.lives++` + notice `"+1 VIDA"`; si ya está al tope → notice `"VIDAS AL MAXIMO"` y no
    sube.
- HUD del buff: chip en `( 12, 40 )` visible solo con `state.buff`, con el texto
  `SLOW BALL` / `FAST BALL` y una barra de tiempo restante
  (`( state.buff.until - now ) / BUFF_DURATION`), en azul `#44aadd` o rojo `#ee5555`.
- Notices centrales: `spawnNotice( text )` reutiliza `state.popups` con campos opcionales
  `life` (1.000 ms) y `size` (34 px) y se dibuja centrado en `( CANVAS_W / 2, CANVAS_H / 2 - 80 )`.
  `updatePopups()` y el render de popups usan `pop.life || POPUP_LIFE` y `pop.size || 18`.
- `advanceStage()` limpia `state.buff` y recalcula `state.stageSpeed`. `resetGame()` limpia
  `state.buff` y pone `state.blockMilestones = 0`. El buff sobrevive a perder una bola.

**Fuera (para specs futuros):**

- Layouts de nivel hechos a mano celda a celda: aquí todo sale de `PATTERNS` + relleno.
- Más patrones, patrones asimétricos o rotación aleatoria del catálogo (ahora es determinista
  por stage).
- Drops/cápsulas que caen y hay que recoger con el paddle: las habilidades se activan solas al
  cruzar un hito.
- Otras habilidades (paddle más ancho, láser, imán, bola pegajosa).
- Cooldown, icono o cola de "habilidad disponible" en el HUD.
- Sonido propio del buff o del cambio de stage.
- Bonus de score por limpiar un stage, por combo o por rapidez.
- Persistencia del stage máximo o del score.
- Tope de bolas simultáneas.
- Aumentar columnas o tamaño del canvas.

---

## Modelo de datos

Reutiliza `state` de SPEC 04. Cambios:

```js
// Constantes nuevas
const BUFF_DURATION = 10000; // ms
const BUFF_SLOW = 0.7;
const BUFF_FAST = 1.35;
const LIFE_EVERY = 1000; // puntos entre vidas extra
const MAX_LIVES = 10;
const FILL_STEP = 0.05;
const FILL_CAP = 0.4;
const MIN_BRICKS = 14;

// Constantes cambiadas
const STAGE_SPEED_STEP = 0.05; // era 0.08
const STAGE_SPEED_CAP = 1.75; // era 1.6

// state: renombrado y campos nuevos
state.stageSpeed = BALL.speed; // era state.ballSpeed
state.buff = null;             // { kind: "slow" | "fast", mult, until } o null
state.blockMilestones = 0;     // hitos de 30 bloques cruzados

// popup: campos opcionales
// { x, y, text, born, life?, size? }
```

`PATTERNS` es un array de `{ name, cell }`. `cell( row, rows, col, cols )` devuelve `true` si esa
celda pertenece a la forma. `cell` no consulta `state`; toda la variación por stage entra por
`fillChance( stage )` y por el HP del blindaje.

Convenciones: mismo estilo que `assets/spritesheet.js` (2 espacios, espacios dentro de `( )` y
`[ ]`, `const`/`let`, identificadores en inglés).

---

## Plan de implementación

1. **Constantes.** Añadir `BUFF_*`, `LIFE_EVERY`, `MAX_LIVES`, `FILL_STEP`, `FILL_CAP`,
   `MIN_BRICKS`. Cambiar `STAGE_SPEED_STEP` a `0.05` y `STAGE_SPEED_CAP` a `1.75`. Verificar:
   el juego sigue cargando sin errores.

2. **Catálogo de patrones y generación.** Añadir `PATTERNS`, `fillChance()`, `maxArmorHp()`,
   `layoutBricks()`. Reescribir `buildBricks( stage )` para elegir patrón por stage, delegar en
   `layoutBricks` y caer a `full` si hay menos de `MIN_BRICKS` bloques. Ajustar `armorChance` a
   `0.08 * ( stage - 1 )`, tope `0.75`, y `rows` a `START_ROWS + Math.floor( stage / 2 )`.
   Verificar: el stage 1 es idéntico a SPEC 04 (rejilla llena de 50, sin blindaje); los stages
   2–8 tienen formas simétricas distintas; ningún stage sale vacío.

3. **Velocidad base vs efectiva.** Renombrar `state.ballSpeed` → `state.stageSpeed`. Añadir
   `state.buff = null`, `effectiveSpeed()` y `rescaleBalls()`. Sustituir el escalar en
   `launchBall()`, `collideBallPaddle()` y `spawnMultiball()` por `effectiveSpeed()`. Limpiar
   `state.buff` en `advanceStage()` y `resetGame()`. Verificar: sin buff, el juego se comporta
   igual que SPEC 04.

4. **Sub-pasos de colisión.** En `updateBalls()`, partir el desplazamiento del frame en
   sub-pasos de como mucho `b.r` px y ejecutar por sub-paso movimiento +
   `collideBallWall` + `collideBallPaddle` + `collideBallBricks`. Quitar el bucle de colisión
   suelto de `update()`. Fijar el límite del bucle de `updateBalls()` con `count` capturado.
   Verificar: con velocidad alta ninguna bola atraviesa un bloque ni la pared; sigue
   resolviéndose como mucho un bloque por sub-paso.

5. **Habilidades por hitos.** Añadir `state.blockMilestones` y `activateBuff()`. En el camino
   `hp === 0` de `collideBallBricks()`, capturar el score previo, y tras sumarlo: al cruzar un
   múltiplo de `MULTIBALL_EVERY` incrementar `blockMilestones` y alternar multibola (impar) /
   `activateBuff()` (par); al cruzar un múltiplo de `LIFE_EVERY` dar `+1` vida si
   `lives < MAX_LIVES`. En `update()`, expirar el buff cuando `now >= state.buff.until` y
   llamar a `rescaleBalls()`. Poner `state.blockMilestones = 0` en `resetGame()`. Verificar: a
   los 30 bloques salen 4 bolas, a los 60 un buff de 10 s, a los 90 otras 4 bolas; a los 1.000
   puntos +1 vida; en 10 vidas ya no sube; con SLOW las bolas en vuelo frenan al instante y a
   los 10 s recuperan la velocidad exacta del stage.

6. **HUD y notices.** Añadir `spawnNotice()`; extender `updatePopups()` y el render de popups
   para respetar `life` y `size` opcionales. Dibujar el chip del buff bajo el HUD con su barra
   de tiempo. Verificar: el chip aparece solo con buff activo y su barra baja a 0 en 10 s; los
   notices se leen en el centro y desaparecen solos; con 10 vidas los iconos no pisan el
   `Nivel: N` centrado.

7. **Specs.** Escribir este archivo y anotar en `specs/04-niveles-progresivos.md` lo que este
   spec sustituye. Verificar: ningún spec describe dos comportamientos contradictorios sin
   enlazarlos.

---

## Criterios de aceptación

- [ ] El juego carga sin errores en consola tras los cambios.
- [ ] El stage 1 es idéntico a SPEC 04: rejilla llena de 50 bloques, 5 filas, sin blindaje.
- [ ] Los stages 2 a 8 usan cada uno un patrón de forma distinto y visible (`pyramid`,
      `checker`, `diamond`, `columns`, `frame`, `zigzag`, `funnel`).
- [ ] El patrón del stage `N` es `PATTERNS[ ( N - 1 ) % 8 ]` (el catálogo se repite cada 8
      stages).
- [ ] Ningún stage genera menos de `MIN_BRICKS` bloques (si el patrón daría menos, se usa
      `full`).
- [ ] Un mismo patrón se ve más denso en una vuelta posterior del catálogo (stage 11 vs 3).
- [ ] En los stages 2 y 3 los bloques blindados solo tienen 2 golpes (skin `wood`).
- [ ] Los bloques de 5 golpes (skin `slate`) no aparecen antes del stage 10.
- [ ] La rapidez de la bola sigue creciendo en el stage 12 y deja de crecer en el stage 16.
- [ ] Sin buff activo, el lanzamiento y los rebotes tienen la misma rapidez que en SPEC 04 para
      el mismo stage.
- [ ] Cada 30 bloques realmente rotos se alterna: 30 → multibola (+4 bolas), 60 → buff, 90 →
      multibola, 120 → buff…
- [ ] `activateBuff()` elige SLOW o FAST con probabilidad ~50/50.
- [ ] Un buff dura 10 s, afecta de inmediato a las bolas ya en vuelo y al expirar devuelve la
      rapidez exacta del stage.
- [ ] Un buff nuevo reemplaza al anterior sin sumar tiempo.
- [ ] Cada vez que el score cruza un múltiplo de 1.000 se suma 1 vida.
- [ ] Las vidas nunca pasan de 10; al estar en 10, el hito de puntos no añade vida.
- [ ] Con el buff FAST en un stage alto ninguna bola atraviesa un bloque ni una pared.
- [ ] El HUD muestra un chip `SLOW BALL` / `FAST BALL` con barra de tiempo solo mientras el buff
      está activo.
- [ ] Al cruzar un hito aparece un texto central efímero (`MULTIBALL!`, `SLOW BALL`,
      `FAST BALL`, `+1 VIDA`) que desaparece solo.
- [ ] Con 10 iconos de vida, el HUD no se solapa con `Nivel: N`.
- [ ] Pasar de stage limpia el buff; el contador de hitos de bloque y el de bloques destruidos
      siguen acumulando de toda la partida.
- [ ] Tras Game Over, reiniciar deja stage 1, 5 vidas, sin buff y los contadores de hito a 0.
- [ ] No se añaden dependencias: sin npm, sin paso de build, sin `<script src>` a CDNs.
- [ ] `specs/04-niveles-progresivos.md` referencia a este spec en los puntos que quedan
      modificados.

---

## Decisiones

- **Sí:** catálogo de patrones como funciones `cell(...)` en vez de arrays de texto. Se adaptan
  solos al número variable de filas y no hay que mantener una rejilla ASCII por stage.
- **Sí:** catálogo determinista por stage (`( N - 1 ) % 8`). El jugador reconoce y aprende los
  patrones; el relleno procedural aporta la variación fina.
- **Sí:** densificación por `fillChance` con tope 0.4. Evita que la segunda vuelta del catálogo
  se sienta igual sin llegar nunca a tapar la forma del patrón.
- **Sí:** `MIN_BRICKS = 14` con fallback a `full`. Barato y garantiza que ningún patrón raro en
  un stage de pocas filas deje la pantalla casi vacía.
- **Sí:** HP de blindaje escalonado por stage (`maxArmorHp`). Corrige el que en SPEC 04 un
  bloque de 5 golpes pudiera salir ya en el stage 2.
- **Sí:** curvas más lentas y con techo más lejano (filas ÷2, blindaje 0.08, velocidad 0.05 /
  1.75). La progresión de SPEC 04 se estancaba entera en el stage 8; así sube hasta el 16.
- **Sí:** buff aleatorio 50/50 SLOW/FAST. Es lo que pidió el usuario ("un poco más despacio o un
  poco más rápido"); la moneda mantiene la tensión.
- **Sí:** `rescaleBalls()` renormaliza las bolas en vuelo al activar y al expirar el buff. Sin
  eso el efecto no se notaría hasta el siguiente rebote.
- **Sí:** el buff nuevo reemplaza al anterior. Más simple que una cola y evita estados raros
  (SLOW y FAST a la vez).
- **Sí:** sub-pasos de colisión en `updateBalls()`. Con `1.75 × 1.35 × 360 ≈ 850 px/s` la bola
  recorre ~14 px/frame (y hasta 42 en frames largos) contra bloques de 24 px: sin sub-pasos
  atraviesa.
- **Sí:** hito de bloques que alterna multibola / buff. Evita amontonar 5 bolas y un buff en el
  mismo instante; cada hito tiene identidad.
- **Sí:** vida extra con tope duro de 10 y aviso `VIDAS AL MAXIMO`. Es lo pedido; el tope evita
  acumular vidas sin límite en partidas largas.
- **Sí:** los notices reutilizan `state.popups` con `life` / `size` opcionales. No hace falta un
  array ni un bucle de render nuevos.
- **Sí:** el buff sobrevive a perder una bola pero no a cambiar de stage. Cambiar de stage ya
  resetea a una sola bola y da un respiro; mantener el buff cruzaría mal con la nueva rapidez
  base.
- **No:** rotación aleatoria del catálogo. Descartado: la progresión determinista se aprende y
  se puede balancear.
- **No:** drops recogibles con el paddle. Fuera de alcance; las habilidades se activan solas.
- **No:** cooldown o HUD de "habilidad lista". Fuera de alcance.
- **No:** más habilidades (paddle ancho, láser, imán). Cada una en su propio spec.
- **No:** layouts hechos a mano celda a celda. El catálogo + relleno basta para dar variedad
  infinita.
- **No:** bonus de score o persistencia. Siguen siendo specs futuros.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un patrón en un stage de pocas filas deja la pantalla casi vacía | `MIN_BRICKS` con fallback a `full`. |
| Con FAST en stages altos la bola atraviesa un bloque (tunneling) | Sub-pasos de colisión de como mucho `b.r` px; `STAGE_SPEED_CAP` acota la base. |
| El buff cambia la rapidez y las bolas en vuelo se quedan a la velocidad vieja | `rescaleBalls()` al activar y al expirar el buff. |
| Muchas bolas × muchos sub-pasos bajan los FPS en stages con multibola | Los sub-pasos escalan con la velocidad, no con el número de bolas; el reset por stage acota el máximo de bolas. |
| El chip del buff o los notices tapan la zona de juego | Chip en una esquina bajo el HUD; notices efímeros (1 s) y en el centro-alto, lejos del paddle. |
| Con 10 iconos de vida el HUD pisa `Nivel: N` | Verificado: 10 iconos terminan en ~x=316 y `Nivel: N` centrado empieza en ~x=352. |

---

## Lo que **no** entra en este spec

- Layouts de nivel hechos a mano celda a celda.
- Rotación aleatoria del catálogo de patrones.
- Drops o cápsulas recogibles con el paddle.
- Otras habilidades (paddle ancho, láser, imán, bola pegajosa).
- Cooldown, icono o cola de habilidad en el HUD.
- Sonido propio del buff o del cambio de stage.
- Bonus de score por stage, combo o rapidez.
- Persistencia del stage máximo o del score.
- Tope de bolas simultáneas.
- Más columnas o un canvas más grande.

Cada uno de estos, si se hace, va en su propio spec.
