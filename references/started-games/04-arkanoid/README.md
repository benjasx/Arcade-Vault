# Arkanoid

Juego tipo Arkanoid/Breakout hecho con **HTML, CSS y JavaScript puros, cero dependencias**:
sin npm, sin paso de build, sin framework ni bundler. Todo el juego vive en un único `game.js`
sobre un `<canvas>` de 800×600.

## Cómo jugar

Como `assets/spritesheet.js` carga el spritesheet por HTTP, hay que servir la carpeta (no vale
abrir el archivo con `file://`):

```bash
python -m http.server
```

Luego abre `http://localhost:8000` en el navegador.

### Controles

| Acción | Teclado | Ratón |
| --- | --- | --- |
| Mover paddle | Flechas ← / → | Mover el cursor |
| Lanzar la bola | Espacio | Click |
| Continuar / reiniciar | Cualquier tecla | Click |

El ratón y el teclado conviven; el teclado toma el control hasta que se vuelve a mover el ratón.

## Características

- **Paddle y bola** con rebote de ángulo según el punto de impacto (estilo clásico).
- **Stages infinitos con dificultad progresiva**: cada nivel tiene una forma de rejilla
  distinta (patrones `pyramid`, `diamond`, `checker`, `frame`, `zigzag`…) más relleno
  procedural, más bloques blindados y la bola algo más rápida.
- **Bloques blindados** de 2 a 5 golpes, con textura y grietas según el daño acumulado.
- **Habilidades por hitos** de bloques destruidos: multibola (+4 bolas) o buff temporal de
  velocidad (lenta o rápida), alternando.
- **Vidas extra**: +1 vida cada 1.000 puntos, con tope de 10.
- **Feedback de rotura**: animación de 4 frames + sonido + partículas con gravedad + destello
  + popup de puntos flotante.
- **Sonido** de rebote de pared/paddle y de rotura de bloque.

## Estructura del proyecto

```
index.html              Canvas 800×600; carga spritesheet.js y game.js
style.css               Fondo de página y centrado del canvas
game.js                 Todo el juego: bucle, input, física, colisiones, estados y render
assets/
  spritesheet.js        Helper de render: loadSpritesheet(), drawSprite(), drawFrame()
  spritesheet-breakout.png
  sounds/               ball-bounce.mp3, break-sound.mp3
specs/                  Especificaciones del flujo spec-driven (SPEC 01–05)
```

## Desarrollo guiado por specs

El repo usa un flujo spec-driven con dos skills (`/spec` y `/spec-impl`). Cada feature se
describe primero en `specs/NN-slug.md` (objetivo, alcance, plan de implementación, criterios de
aceptación) y se aprueba antes de escribir código. El estado actual:

| Spec | Descripción | Estado |
| --- | --- | --- |
| SPEC 01 | MVP jugable (paddle, bola, un nivel, vidas, game over/victoria) | Implementado |
| SPEC 02 | Efectos de rotura de bloques (sonido, partículas, destello, popup) | Implementado |
| SPEC 03 | Sonido de rebote de la bola | Implementado |
| SPEC 04 | Niveles infinitos con dificultad progresiva | Implementado |
| SPEC 05 | Stages con forma propia y habilidades por hitos | Implementado |

Ver `CLAUDE.md` para la arquitectura de `game.js` y las convenciones de código.
</content>
