// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, valor base
const STAGE_SPEED_STEP = 0.05; // +5% de rapidez de bola por stage
const STAGE_SPEED_CAP = 1.75; // multiplicador maximo sobre BALL.speed

const MULTIBALL_EVERY = 30; // bloques realmente rotos entre hitos de bloque
const MULTIBALL_ADD = 4; // bolas que se anaden en cada activacion
const MULTIBALL_SPREAD = 0.5; // rad de abanico al repartir la direccion de las bolas nuevas
const MAX_LAUNCH_ANGLE = 50 * Math.PI / 180; // desde la vertical
const MAX_BOUNCE_ANGLE = 60 * Math.PI / 180; // rebote en el paddle, desde la vertical

const BUFF_DURATION = 10000; // ms que dura el buff de velocidad
const BUFF_SLOW = 0.7; // multiplicador de velocidad del buff lento
const BUFF_FAST = 1.35; // multiplicador de velocidad del buff rapido
const LIFE_EVERY = 1000; // puntos acumulados entre vidas extra
const MAX_LIVES = 10; // tope duro de vidas

const START_ROWS = 5; // filas en el stage 1 (igual que SPEC 01)
const MAX_ROWS = 9; // tope de filas; por encima solo escala el blindaje
const FILL_STEP = 0.05; // +5% de relleno fuera de patron por stage
const FILL_CAP = 0.4; // tope de relleno procedural
const MIN_BRICKS = 14; // salvaguarda: por debajo de esto el stage usa el patron "full"

const ARMOR_START_STAGE = 2; // primer stage con bloques de varios golpes
const ARMOR_MAX_HP = 5; // golpes maximos de un bloque blindado
const ARMOR_SKIN = { 2: "wood", 3: "brick", 4: "gray", 5: "slate" }; // sprite por nivel de dureza

const GRID = {
  cols: 10,
  rows: 5,
  marginX: 40, // margen lateral dentro del canvas
  top: 60, // offset superior
  gapX: 8,
  gapY: 4,
  rowColors: [ "red", "hotpink", "magenta", "cyan", "yellow" ], // color por fila (indice 0 = fila superior)
};
const BRICK_H = 24; // alto de bloque (el spec no lo fija; el sprite es 32x16)
const START_LIVES = 5;

const BREAK_SFX_SRC = "assets/sounds/break-sound.mp3";
const BREAK_SFX_POOL_SIZE = 8;

const BOUNCE_SFX_SRC = "assets/sounds/ball-bounce.mp3";
const BOUNCE_SFX_POOL_SIZE = 4;

const PARTICLES_PER_BRICK = 10; // fragmentos por bloque roto
const PARTICLE_MAX = 200; // tope global de particulas vivas
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

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

const PATTERNS = [
  { name: "full",    cell: () => true },
  { name: "pyramid", cell: ( r, rows, c, cols ) => Math.abs( c - ( cols - 1 ) / 2 ) <= ( cols - 1 ) / 2 * ( r + 1 ) / rows },
  { name: "checker", cell: ( r, rows, c ) => ( r + c ) % 2 === 0 },
  { name: "diamond", cell: ( r, rows, c, cols ) => Math.abs( c - ( cols - 1 ) / 2 ) + Math.abs( r - ( rows - 1 ) / 2 ) <= Math.max( rows, cols ) / 2 },
  { name: "columns", cell: ( r, rows, c ) => c % 3 !== 1 },
  { name: "frame",   cell: ( r, rows, c, cols ) => r === 0 || r === rows - 1 || c === 0 || c === cols - 1 },
  { name: "zigzag",  cell: ( r, rows, c ) => ( r + c ) % 4 < 2 },
  { name: "funnel",  cell: ( r, rows, c, cols ) => Math.abs( c - ( cols - 1 ) / 2 ) >= ( cols - 1 ) / 2 * r / rows },
];

function armorChance( stage ) {
  return Math.min( 0.08 * ( stage - 1 ), 0.75 );
}

function fillChance( stage ) {
  return Math.min( FILL_STEP * ( stage - 1 ), FILL_CAP );
}

function maxArmorHp( stage ) {
  return clamp( 2 + Math.floor( ( stage - 1 ) / 3 ), 2, ARMOR_MAX_HP );
}

function layoutBricks( stage, rows, bw, pattern ) {
  const bricks = [];
  for ( let row = 0; row < rows; row++ ) {
    const color = GRID.rowColors[ row % GRID.rowColors.length ];
    const y = GRID.top + row * ( BRICK_H + GRID.gapY );
    for ( let col = 0; col < GRID.cols; col++ ) {
      const inPattern = pattern.cell( row, rows, col, GRID.cols );
      if ( !inPattern && Math.random() >= fillChance( stage ) ) continue;
      const x = GRID.marginX + col * ( bw + GRID.gapX );
      let maxHp = 1;
      if ( stage >= ARMOR_START_STAGE && Math.random() < armorChance( stage ) ) {
        maxHp = 2 + Math.floor( Math.random() * ( maxArmorHp( stage ) - 1 ) );
      }
      const skin = maxHp > 1 ? ARMOR_SKIN[ maxHp ] : null;
      bricks.push( { x, y, w: bw, h: BRICK_H, color, skin, hp: maxHp, maxHp, alive: true, breaking: false, breakStart: 0 } );
    }
  }
  return bricks;
}

function buildBricks( stage ) {
  const bw = ( CANVAS_W - 2 * GRID.marginX - ( GRID.cols - 1 ) * GRID.gapX ) / GRID.cols;
  const rows = Math.min( START_ROWS + Math.floor( stage / 2 ), MAX_ROWS );
  const pattern = PATTERNS[ ( stage - 1 ) % PATTERNS.length ];
  let bricks = layoutBricks( stage, rows, bw, pattern );
  if ( bricks.length < MIN_BRICKS ) {
    bricks = layoutBricks( stage, rows, bw, PATTERNS[ 0 ] );
  }
  return bricks;
}

function makeBall() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: BALL.size / 2, stuck: true };
}

const state = {
  phase: "playing", // 'playing' | 'gameover' | 'stageclear'
  stage: 1,
  stageSpeed: BALL.speed, // rapidez base de la bola en el stage actual (sin buff)
  buff: null, // { kind: 'slow' | 'fast', mult, until } o null
  lives: START_LIVES,
  score: 0,
  bricksDestroyed: 0, // bloques con hp === 0 en toda la partida
  blockMilestones: 0, // hitos de MULTIBALL_EVERY bloques cruzados (alterna multibola / buff)
  paddle: { x: ( CANVAS_W - PADDLE.w ) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
  balls: [ makeBall() ], // SPEC 01 pasa de state.ball unica a este array
  bricks: buildBricks( 1 ),
  input: { left: false, right: false, mouseX: null },
  particles: [], // { x, y, vx, vy, size, color, born }
  flashes: [], // { x, y, w, h, born }
  popups: [], // { x, y, text, born, life?, size? }
};

// Pool de audio de rotura (fuera de state, no se resetea)
const breakSfxPool = [];
let breakSfxIndex = 0;
for ( let i = 0; i < BREAK_SFX_POOL_SIZE; i++ ) {
  breakSfxPool.push( new Audio( BREAK_SFX_SRC ) );
}

function playBreakSfx() {
  const sfx = breakSfxPool[ breakSfxIndex ];
  sfx.currentTime = 0;
  sfx.play().catch( () => {} );
  breakSfxIndex = ( breakSfxIndex + 1 ) % BREAK_SFX_POOL_SIZE;
}

// Pool de audio de rebote (fuera de state, no se resetea)
const bounceSfxPool = [];
let bounceSfxIndex = 0;
for ( let i = 0; i < BOUNCE_SFX_POOL_SIZE; i++ ) {
  bounceSfxPool.push( new Audio( BOUNCE_SFX_SRC ) );
}

function playBounceSfx() {
  const sfx = bounceSfxPool[ bounceSfxIndex ];
  sfx.currentTime = 0;
  sfx.play().catch( () => {} );
  bounceSfxIndex = ( bounceSfxIndex + 1 ) % BOUNCE_SFX_POOL_SIZE;
}

function clamp( v, min, max ) {
  return v < min ? min : ( v > max ? max : v );
}

function updatePaddle( dt ) {
  const p = state.paddle;
  const maxX = CANVAS_W - p.w;

  if ( state.input.mouseX !== null ) {
    p.x = state.input.mouseX - p.w / 2;
  }

  let dir = 0;
  if ( state.input.left ) dir -= 1;
  if ( state.input.right ) dir += 1;
  if ( dir !== 0 ) {
    p.x += dir * PADDLE.speed * dt;
    state.input.mouseX = null; // keyboard takes over until the mouse moves again
  }

  p.x = clamp( p.x, 0, maxX );
}

function stickBallToPaddle( ball ) {
  const p = state.paddle;
  ball.x = p.x + p.w / 2;
  ball.y = p.y - ball.r;
  ball.vx = 0;
  ball.vy = 0;
  ball.stuck = true;
}

function stageBallSpeed() {
  return BALL.speed * Math.min( 1 + STAGE_SPEED_STEP * ( state.stage - 1 ), STAGE_SPEED_CAP );
}

function effectiveSpeed() {
  return state.stageSpeed * ( state.buff ? state.buff.mult : 1 );
}

function rescaleBalls() {
  const target = effectiveSpeed();
  for ( let i = 0; i < state.balls.length; i++ ) {
    const b = state.balls[ i ];
    if ( b.stuck ) continue;
    const mag = Math.hypot( b.vx, b.vy );
    if ( mag === 0 ) continue;
    b.vx = b.vx / mag * target;
    b.vy = b.vy / mag * target;
  }
}

function activateBuff() {
  const slow = Math.random() < 0.5;
  state.buff = {
    kind: slow ? "slow" : "fast",
    mult: slow ? BUFF_SLOW : BUFF_FAST,
    until: now + BUFF_DURATION,
  };
  rescaleBalls();
  spawnNotice( slow ? "SLOW BALL" : "FAST BALL" );
}

function launchBall() {
  const speed = effectiveSpeed();
  for ( let i = 0; i < state.balls.length; i++ ) {
    const b = state.balls[ i ];
    if ( !b.stuck ) continue;
    b.stuck = false;
    const angle = ( Math.random() * 2 - 1 ) * MAX_LAUNCH_ANGLE;
    b.vx = speed * Math.sin( angle );
    b.vy = -speed * Math.cos( angle );
  }
}

function collideBallWall( b ) {
  if ( b.x - b.r < 0 ) {
    b.x = b.r;
    b.vx = -b.vx;
    playBounceSfx();
  } else if ( b.x + b.r > CANVAS_W ) {
    b.x = CANVAS_W - b.r;
    b.vx = -b.vx;
    playBounceSfx();
  }

  if ( b.y - b.r < 0 ) {
    b.y = b.r;
    b.vy = -b.vy;
    playBounceSfx();
  }
}

function updateBalls( dt ) {
  const count = state.balls.length; // bolas de multibola nacen dentro del bucle; se mueven el frame siguiente
  for ( let i = 0; i < count; i++ ) {
    const b = state.balls[ i ];

    if ( b.stuck ) {
      stickBallToPaddle( b );
      continue;
    }

    const dist = Math.hypot( b.vx, b.vy ) * dt;
    const steps = Math.max( 1, Math.ceil( dist / b.r ) );
    const sdt = dt / steps;
    for ( let s = 0; s < steps; s++ ) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      collideBallWall( b );
      collideBallPaddle( b );
      collideBallBricks( b );
    }
  }
}

function loseBallsOffscreen() {
  for ( let i = state.balls.length - 1; i >= 0; i-- ) {
    if ( state.balls[ i ].y - state.balls[ i ].r > CANVAS_H ) {
      state.balls.splice( i, 1 );
    }
  }
  if ( state.balls.length > 0 ) return;

  state.lives--;
  if ( state.lives > 0 ) {
    state.balls.push( makeBall() );
    stickBallToPaddle( state.balls[ 0 ] );
  }
}

function spawnMultiball( ref ) {
  if ( !ref ) return;
  const speed = effectiveSpeed();
  const baseAngle = Math.atan2( ref.vy, ref.vx );
  for ( let i = 0; i < MULTIBALL_ADD; i++ ) {
    const t = MULTIBALL_ADD === 1 ? 0 : ( i / ( MULTIBALL_ADD - 1 ) ) * 2 - 1; // [ -1, 1 ]
    const angle = baseAngle + t * MULTIBALL_SPREAD;
    state.balls.push( {
      x: ref.x,
      y: ref.y,
      vx: speed * Math.cos( angle ),
      vy: speed * Math.sin( angle ),
      r: BALL.size / 2,
      stuck: false,
    } );
  }
}

function collideBallPaddle( b ) {
  const p = state.paddle;
  if ( b.vy <= 0 ) return;
  if ( b.x + b.r <= p.x || b.x - b.r >= p.x + p.w ) return;
  if ( b.y + b.r < p.y || b.y - b.r > p.y + p.h ) return;

  const offset = clamp( ( b.x - ( p.x + p.w / 2 ) ) / ( p.w / 2 ), -1, 1 );
  const angle = offset * MAX_BOUNCE_ANGLE;
  const speed = effectiveSpeed();
  b.vx = speed * Math.sin( angle );
  b.vy = -speed * Math.cos( angle );
  b.y = p.y - b.r;
  playBounceSfx();
}

function collideBallBricks( b ) {
  const left = b.x - b.r;
  const right = b.x + b.r;
  const top = b.y - b.r;
  const bottom = b.y + b.r;

  for ( let i = 0; i < state.bricks.length; i++ ) {
    const br = state.bricks[ i ];
    if ( !br.alive ) continue;
    if ( right <= br.x || left >= br.x + br.w || bottom <= br.y || top >= br.y + br.h ) continue;

    const overlapX = Math.min( right - br.x, br.x + br.w - left );
    const overlapY = Math.min( bottom - br.y, br.y + br.h - top );

    if ( overlapX < overlapY ) {
      b.x += ( b.x < br.x + br.w / 2 ) ? -overlapX : overlapX;
      b.vx = -b.vx;
    } else {
      b.y += ( b.y < br.y + br.h / 2 ) ? -overlapY : overlapY;
      b.vy = -b.vy;
    }

    br.hp--;
    if ( br.hp > 0 ) {
      br.breaking = false;
      playBreakSfx();
      spawnFlash( br );
      return; // golpe no letal: solo sonido + destello
    }

    br.alive = false;
    br.breaking = true;
    br.breakStart = now;
    playBreakSfx();
    spawnParticles( br );
    spawnFlash( br );
    const points = 10 * br.maxHp;
    spawnPopup( br, points );
    const scoreBefore = state.score;
    state.score += points;
    state.bricksDestroyed++;

    if ( Math.floor( ( state.bricksDestroyed - 1 ) / MULTIBALL_EVERY ) !== Math.floor( state.bricksDestroyed / MULTIBALL_EVERY ) ) {
      state.blockMilestones++;
      if ( state.blockMilestones % 2 === 1 ) {
        spawnMultiball( b );
        spawnNotice( "MULTIBALL!" );
      } else {
        activateBuff();
      }
    }

    if ( Math.floor( scoreBefore / LIFE_EVERY ) !== Math.floor( state.score / LIFE_EVERY ) ) {
      if ( state.lives < MAX_LIVES ) {
        state.lives++;
        spawnNotice( "+1 VIDA" );
      } else {
        spawnNotice( "VIDAS AL MAXIMO" );
      }
    }

    return; // resolver como maximo un bloque por frame
  }
}

function spawnParticles( br ) {
  if ( state.particles.length >= PARTICLE_MAX ) return;
  const cx = br.x + br.w / 2;
  const cy = br.y + br.h / 2;
  for ( let i = 0; i < PARTICLES_PER_BRICK; i++ ) {
    state.particles.push( {
      x: cx,
      y: cy,
      vx: ( Math.random() * 2 - 1 ) * PARTICLE_VX_MAX,
      vy: PARTICLE_VY_MIN + Math.random() * ( PARTICLE_VY_MAX - PARTICLE_VY_MIN ),
      size: PARTICLE_SIZE_MIN + Math.random() * ( PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN ),
      color: br.color,
      born: now,
    } );
  }
}

function updateParticles( dt ) {
  for ( let i = state.particles.length - 1; i >= 0; i-- ) {
    const p = state.particles[ i ];
    if ( now - p.born >= PARTICLE_LIFE ) {
      state.particles.splice( i, 1 );
      continue;
    }
    p.vy += PARTICLE_GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function spawnFlash( br ) {
  state.flashes.push( { x: br.x, y: br.y, w: br.w, h: br.h, born: now } );
}

function spawnPopup( br, points ) {
  state.popups.push( { x: br.x + br.w / 2, y: br.y + br.h / 2, text: "+" + points, born: now } );
}

function spawnNotice( text ) {
  state.popups.push( { x: CANVAS_W / 2, y: CANVAS_H / 2 - 80, text, born: now, life: 1000, size: 34 } );
}

function updatePopups( dt ) {
  for ( let i = state.popups.length - 1; i >= 0; i-- ) {
    const life = state.popups[ i ].life || POPUP_LIFE;
    if ( now - state.popups[ i ].born >= life ) state.popups.splice( i, 1 );
  }
}

function advanceStage() {
  state.stage++;
  state.bricks = buildBricks( state.stage );
  state.stageSpeed = stageBallSpeed();
  state.buff = null;
  state.balls = [ makeBall() ];
  state.phase = "playing";
  stickBallToPaddle( state.balls[ 0 ] );
}

function resetGame() {
  state.phase = "playing";
  state.stage = 1;
  state.stageSpeed = BALL.speed;
  state.buff = null;
  state.lives = START_LIVES;
  state.score = 0;
  state.bricksDestroyed = 0;
  state.blockMilestones = 0;
  state.balls = [ makeBall() ];
  state.bricks = buildBricks( state.stage );
  state.particles.length = 0;
  state.popups.length = 0;
  state.flashes.length = 0;
  state.paddle.x = ( CANVAS_W - PADDLE.w ) / 2;
  stickBallToPaddle( state.balls[ 0 ] );
}

function update( dt ) {
  if ( state.phase !== "playing" ) return;

  if ( state.buff && now >= state.buff.until ) {
    state.buff = null;
    rescaleBalls();
  }

  updatePaddle( dt );
  updateBalls( dt );
  loseBallsOffscreen();
  updateParticles( dt );
  updatePopups( dt );

  if ( state.lives <= 0 ) {
    state.phase = "gameover";
  } else if ( !state.bricks.some( br => br.alive ) ) {
    state.phase = "stageclear";
  }
}

function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

  for ( let i = 0; i < state.bricks.length; i++ ) {
    const br = state.bricks[ i ];
    if ( br.alive ) {
      drawSprite( ctx, "block_" + ( br.skin || br.color ), br.x, br.y, br.w, br.h );
      if ( br.hp < br.maxHp ) {
        const crackFrames = EXPLOSION_FRAMES[ br.color ];
        const idx = clamp( br.maxHp - br.hp - 1, 0, crackFrames.length - 1 );
        drawFrame( ctx, crackFrames[ idx ], br.x, br.y, br.w, br.h );
      }
    } else if ( br.breaking ) {
      const elapsed = now - br.breakStart;
      if ( elapsed >= EXPLOSION_DURATION ) {
        br.breaking = false;
      } else {
        const frames = EXPLOSION_FRAMES[ br.color ];
        const idx = clamp( Math.floor( elapsed / EXPLOSION_DURATION * frames.length ), 0, frames.length - 1 );
        drawFrame( ctx, frames[ idx ], br.x, br.y, br.w, br.h );
      }
    }
  }

  for ( let i = 0; i < state.particles.length; i++ ) {
    const pt = state.particles[ i ];
    ctx.globalAlpha = clamp( 1 - ( now - pt.born ) / PARTICLE_LIFE, 0, 1 );
    ctx.fillStyle = pt.color;
    ctx.fillRect( pt.x, pt.y, pt.size, pt.size );
  }
  ctx.globalAlpha = 1;

  for ( let i = state.flashes.length - 1; i >= 0; i-- ) {
    const fl = state.flashes[ i ];
    const age = now - fl.born;
    if ( age >= FLASH_DURATION ) {
      state.flashes.splice( i, 1 );
      continue;
    }
    ctx.globalAlpha = 1 - age / FLASH_DURATION;
    ctx.fillStyle = "#fff";
    ctx.fillRect( fl.x, fl.y, fl.w, fl.h );
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for ( let i = 0; i < state.popups.length; i++ ) {
    const pop = state.popups[ i ];
    const life = pop.life || POPUP_LIFE;
    const age = now - pop.born;
    ctx.font = ( pop.size || 18 ) + "px monospace";
    ctx.globalAlpha = 1 - age / life;
    ctx.fillText( pop.text, pop.x, pop.y - POPUP_RISE * ( age / life ) );
  }
  ctx.globalAlpha = 1;

  const p = state.paddle;
  drawSprite( ctx, "paddle", p.x, p.y, p.w, p.h );

  for ( let i = 0; i < state.balls.length; i++ ) {
    const b = state.balls[ i ];
    drawSprite( ctx, "ball", b.x - b.r, b.y - b.r, BALL.size, BALL.size );
  }

  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const livesLabel = "Vidas: ";
  ctx.fillText( livesLabel, 12, 12 );

  const lifeIcon = 16;
  const lifeGap = 6;
  const lifeIconX = 12 + ctx.measureText( livesLabel ).width;
  for ( let i = 0; i < state.lives; i++ ) {
    drawSprite( ctx, "ball", lifeIconX + i * ( lifeIcon + lifeGap ), 12, lifeIcon, lifeIcon );
  }

  ctx.textAlign = "center";
  ctx.fillText( "Nivel: " + state.stage, CANVAS_W / 2, 12 );

  ctx.textAlign = "right";
  ctx.fillText( "Score: " + state.score, CANVAS_W - 12, 12 );

  if ( state.buff ) {
    const remain = clamp( ( state.buff.until - now ) / BUFF_DURATION, 0, 1 );
    const label = state.buff.kind === "slow" ? "SLOW BALL" : "FAST BALL";
    const col = state.buff.kind === "slow" ? "#44aadd" : "#ee5555";
    const chipX = 12;
    const chipY = 40;
    const barX = chipX + 84;
    const barW = 80;
    const barH = 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "13px monospace";
    ctx.fillStyle = col;
    ctx.fillText( label, chipX, chipY + barH / 2 );
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect( barX, chipY, barW, barH );
    ctx.fillRect( barX, chipY, barW * remain, barH );
  }

  if ( state.phase !== "playing" ) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "48px monospace";
    if ( state.phase === "stageclear" ) {
      ctx.fillText( "Nivel " + ( state.stage + 1 ), CANVAS_W / 2, CANVAS_H / 2 - 20 );
      ctx.font = "20px monospace";
      ctx.fillText( "Pulsa una tecla o haz click para continuar", CANVAS_W / 2, CANVAS_H / 2 + 30 );
    } else {
      ctx.fillText( "Game Over", CANVAS_W / 2, CANVAS_H / 2 - 20 );
      ctx.font = "20px monospace";
      ctx.fillText( "Pulsa una tecla o haz click para reiniciar", CANVAS_W / 2, CANVAS_H / 2 + 30 );
    }
  }
}

let lastTime = 0;
let now = 0;

function frame( ts ) {
  now = ts;
  const dt = Math.min( ( ts - lastTime ) / 1000, 0.05 );
  lastTime = ts;
  update( dt );
  render();
  requestAnimationFrame( frame );
}

canvas.addEventListener( "mousemove", ( e ) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = ( e.clientX - rect.left ) * ( CANVAS_W / rect.width );
} );

canvas.addEventListener( "click", () => {
  if ( state.phase === "stageclear" ) {
    advanceStage();
    return;
  }
  if ( state.phase !== "playing" ) {
    resetGame();
    return;
  }
  launchBall();
} );

window.addEventListener( "keydown", ( e ) => {
  if ( state.phase === "stageclear" ) {
    e.preventDefault();
    advanceStage();
    return;
  }
  if ( state.phase !== "playing" ) {
    e.preventDefault();
    resetGame();
    return;
  }
  if ( e.code === "ArrowLeft" ) state.input.left = true;
  if ( e.code === "ArrowRight" ) state.input.right = true;
  if ( e.code === "Space" ) {
    e.preventDefault();
    launchBall();
  }
} );

window.addEventListener( "keyup", ( e ) => {
  if ( e.code === "ArrowLeft" ) state.input.left = false;
  if ( e.code === "ArrowRight" ) state.input.right = false;
} );

loadSpritesheet( () => {
  lastTime = performance.now();
  requestAnimationFrame( frame );
} );
