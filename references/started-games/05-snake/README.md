# Snake

MVP de Snake con estética retro-arcade y neón, hecho con **HTML, CSS y JavaScript puros,
cero dependencias**: sin npm, sin build, sin framework. Todo el juego vive en `game.js`
sobre un `<canvas>` de 528×528 (rejilla 24×24).

## Cómo jugar

Abre `index.html` en el navegador (no necesita servidor; la fuente `Press Start 2P` se carga
desde Google Fonts).

### Controles

| Acción | Teclas |
| --- | --- |
| Mover | Flechas ← ↑ ↓ → o `W` `A` `S` `D` |
| Pausa | `P` o `Espacio` |
| Reiniciar | `Enter` |

## Características (MVP)

- Serpiente sobre rejilla con brillo neón, cabeza con ojos que miran hacia el avance.
- Comida magenta pulsante; +10 puntos y +velocidad por cada pieza.
- Colisión con muro o con el propio cuerpo = game over, con flash de pantalla.
- HI-SCORE persistente en `localStorage` (`snake_hi`).
- Overlays de inicio, pausa y game over; efecto CRT (scanlines + viñeta).

## Estructura

```
index.html   Shell: HUD, canvas, overlays; carga style.css y game.js
style.css    Tema neón, CRT, layout responsive
game.js      Todo el juego: estado, lógica de pasos, colisiones, render y input
```
