/**
 * FLAPPY_ATLAS — mapa reutilizable de sprites para el clon de Flappy Bird.
 * 
 * Coordenadas estimadas según la hoja de sprites generada.
 * Estructura: { x, y, w, h } — recorte dentro del archivo fuente.
 *
 * Uso:
 *   const a = window.FLAPPY_ATLAS;
 *   ctx.drawImage(img, a.birds.yellow.flapping.x, a.birds.yellow.flapping.y,
 *                      a.birds.yellow.flapping.w, a.birds.yellow.flapping.h,
 *                      dx, dy, dw, dh);
 */
window.FLAPPY_ATLAS = {

  sources: {
    main: 'flappy-assets/sprite_sheet.png',  // Ruta a tu imagen descargada
  },

  // ── Pájaros (Animaciones de 64x64 aprox) ─────────────────────────────────
  birds: {
    yellow: {
      flapping: { x: 35, y: 70, w: 65, h: 65 },
      resting: { x: 135, y: 70, w: 65, h: 65 },
      gliding: { x: 235, y: 70, w: 65, h: 65 },
    },
    blue: {
      flapping: { x: 35, y: 165, w: 65, h: 65 },
      resting: { x: 135, y: 165, w: 65, h: 65 },
      gliding: { x: 235, y: 165, w: 65, h: 65 },
    },
    red: {
      flapping: { x: 35, y: 260, w: 65, h: 65 },
      resting: { x: 135, y: 260, w: 65, h: 65 },
      gliding: { x: 235, y: 260, w: 65, h: 65 },
    }
  },

  // ── Tuberías (Verdes y Naranjas) ──────────────────────────────────────────
  pipes: {
    green: {
      bottom: { x: 30, y: 460, w: 85, h: 160 }, // Tubería que sale desde abajo (boca arriba)
      top: { x: 140, y: 460, w: 85, h: 160 },    // Tubería que sale desde arriba (boca abajo)
      broken: { x: 250, y: 460, w: 85, h: 160 }
    },
    orange: {
      bottom: { x: 380, y: 460, w: 85, h: 160 },
      top: { x: 490, y: 460, w: 85, h: 160 }
    }
  },

  // ── Fondos y Terreno ──────────────────────────────────────────────────────
  environment: {
    backgroundDay: { x: 800, y: 90, w: 1080, h: 220 },
    backgroundNight: { x: 800, y: 350, w: 1080, h: 220 },
    ground: { x: 800, y: 640, w: 680, h: 100 }
  },

  // ── Elementos de UI, Puntuación y Botones ─────────────────────────────────
  ui: {
    states: {
      getReady: { x: 570, y: 840, w: 260, h: 50 },
      gameOver: { x: 570, y: 900, w: 260, h: 50 },
      scoreBoard: { x: 860, y: 840, w: 180, h: 110 }
    },
    medals: {
      bronze: { x: 1100, y: 840, w: 60, h: 70 },
      silver: { x: 1180, y: 840, w: 60, h: 70 },
      gold: { x: 1260, y: 840, w: 60, h: 70 }
    },
    buttons: {
      start: { x: 1420, y: 850, w: 130, h: 45 },
      restart: { x: 1570, y: 850, w: 140, h: 45 },
      quit: { x: 1730, y: 850, w: 100, h: 45 }
    },
    // Números individuales para dibujar la puntuación en vivo (ancho aprox 30px)
    numbers: {
      '0': { x: 30, y: 840, w: 32, h: 45 },
      '1': { x: 75, y: 840, w: 32, h: 45 },
      '2': { x: 120, y: 840, w: 32, h: 45 },
      '3': { x: 165, y: 840, w: 32, h: 45 },
      '4': { x: 210, y: 840, w: 32, h: 45 },
      '5': { x: 255, y: 840, w: 32, h: 45 },
      '6': { x: 300, y: 840, w: 32, h: 45 },
      '7': { x: 345, y: 840, w: 32, h: 45 },
      '8': { x: 120, y: 900, w: 32, h: 45 },
      '9': { x: 165, y: 900, w: 32, h: 45 }
    }
  }
};