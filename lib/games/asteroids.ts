// ===== lib/games/asteroids.ts — controlador imperativo del juego de asteroides =====
//
// Port TS de `references/started-games/02-asteroides/game.js` a un controlador con
// ciclo de vida (crear / pausar / reanudar / reiniciar / destruir) y un único
// callback hacia la plataforma: `onGameOver(finalScore)`.
//
// No importa React ni JSX. Solo toca `window`/DOM a través del `canvas` que se le
// pasa a `createAsteroidsGame`. El estado del juego —a nivel de módulo en el
// original— vive en el cierre de `createAsteroidsGame`.
//
// Diferencias respecto al original:
//   - En `state === "gameover"` NO se reinicia con `Space`; al entrar en game
//     over se invoca `opts.onGameOver(score)` una sola vez.
//   - El overlay de game over pierde la línea "ESPACIO PARA REINICIAR".

export interface AsteroidsOptions {
  /** Se invoca una sola vez al entrar en game over, con la puntuación final. */
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsHandle {
  /** Detiene el scheduling de `requestAnimationFrame`. */
  pause: () => void;
  /** Reanuda el loop reseteando `lastTime` para evitar un salto de `dt`. */
  resume: () => void;
  /** Reinicia la partida (`initGame`) y reanuda el loop. */
  restart: () => void;
  /** Cancela el rAF pendiente y quita los listeners de teclado. */
  destroy: () => void;
}

// Coordenadas internas fijas (no responsive); se escala por CSS en el componente.
const W = 800;
const H = 600;

// Teclas cuyo comportamiento por defecto se cancela (scroll de página, etc.).
const PREVENT_DEFAULT_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// ── Utils ────────────────────────────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

const wrap = (v: number, max: number): number => ((v % max) + max) % max;
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

// ── Constantes de asteroide (indexadas por `size` 1..3) ──────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// ── Constantes de power-up ──────────────────────────────────────────────────
type PowerUpType = "P" | "B" | "S" | "M";

const POWERUP_SPAWN_THRESHOLD = 5; // asteroides destruidos entre power-ups
const MAX_POWERUPS_ON_SCREEN = 2; // límite de power-ups simultáneos
const POWERUP_DURATION = 10; // s que dura P, B y S
const SLOWMO_DURATION = 6; // s que dura M (slow motion)
const POWERUP_TYPES: PowerUpType[] = ["P", "B", "S", "M"]; // Propulsión, Balas, Escudo, Slow Motion
const POWERUP_LABELS: Record<PowerUpType, string> = {
  P: "PROPULSIÓN",
  B: "DISPARO TRIPLE",
  S: "ESCUDO",
  M: "CÁMARA LENTA",
};
const TRIPLE_SHOT_SPREAD = 0.25; // rad entre cada bala del abanico
const THRUST_BOOST_MULT = 1.6;
const SLOWMO_FACTOR = 0.5; // velocidad de los asteroides durante la cámara lenta

type GameState = "playing" | "dead" | "gameover";

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  opts: AsteroidsOptions,
): AsteroidsHandle {
  if (typeof opts.onGameOver !== "function") {
    throw new TypeError("createAsteroidsGame: opts.onGameOver debe ser una función");
  }

  canvas.width = W;
  canvas.height = H;
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("createAsteroidsGame: contexto 2d no disponible");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /** Lee y consume un flanco de subida de tecla (edge-triggered). */
  const pressed = (code: string): boolean => {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  };

  // ── Cronómetros de power-up ────────────────────────────────────────────────
  let tripleShotTimer = 0;
  let thrustBoostTimer = 0;
  let shieldTimer = 0;
  let slowMoTimer = 0;

  // ── Entidades ──────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class PowerUp {
    x: number;
    y: number;
    type: PowerUpType;
    radius = 14;
    vx: number;
    vy: number;
    dead = false;

    constructor(x: number, y: number, type: PowerUpType) {
      this.x = x;
      this.y = y;
      this.type = type;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = "#0ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#0ff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.type, 0, 1);
      ctx.restore();
    }
  }

  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: Array<[number, number]> = [];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  class Ship {
    x!: number;
    y!: number;
    angle!: number;
    vx!: number;
    vy!: number;
    radius!: number;
    thrusting!: boolean;
    invincible!: number;
    shootCooldown!: number;
    dead!: boolean;

    constructor() {
      this.reset();
    }

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = thrustBoostTimer > 0 ? 260 * THRUST_BOOST_MULT : 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const angles =
        tripleShotTimer > 0
          ? [this.angle - TRIPLE_SHOT_SPREAD, this.angle, this.angle + TRIPLE_SHOT_SPREAD]
          : [this.angle];
      return angles.map((a) => {
        const ox = this.x + Math.cos(a) * NOSE;
        const oy = this.y + Math.sin(a) * NOSE;
        return new Bullet(ox, oy, a);
      });
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx.beginPath();
      ctx.moveTo(20, 0); // nariz
      ctx.lineTo(-12, -9); // ala izquierda
      ctx.lineTo(-7, 0); // muesca trasera
      ctx.lineTo(-12, 9); // ala derecha
      ctx.closePath();
      ctx.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
        ctx.stroke();
      }

      // Campo de fuerza (escudo)
      if (shieldTimer > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 255, 255, 0.75)";
        ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  // ── Estado de la partida ───────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerups: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;
  let asteroidsDestroyed = 0;
  // Garantiza una única llamada a `opts.onGameOver` por partida.
  let gameOverNotified = false;

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerups = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    deadTimer = 0;
    tripleShotTimer = 0;
    thrustBoostTimer = 0;
    shieldTimer = 0;
    slowMoTimer = 0;
    asteroidsDestroyed = 0;
    gameOverNotified = false;
    spawnAsteroids(4);
  }

  function spawnPowerUp(x: number, y: number) {
    const type = POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];
    powerups.push(new PowerUp(x, y, type));
  }

  function applyPowerUp(type: PowerUpType) {
    if (type === "P") thrustBoostTimer = POWERUP_DURATION;
    else if (type === "B") tripleShotTimer = POWERUP_DURATION;
    else if (type === "S") shieldTimer = POWERUP_DURATION;
    else if (type === "M") slowMoTimer = SLOWMO_DURATION;
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
      // Cambio respecto al original: la plataforma es la dueña del reinicio.
      if (!gameOverNotified) {
        gameOverNotified = true;
        opts.onGameOver(score);
      }
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      // Sin reinicio por `Space`: el modal de la plataforma es quien reinicia.
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(slowMoTimer > 0 ? dt * SLOWMO_FACTOR : dt));
    particles.forEach((p) => p.update(dt));
    powerups.forEach((p) => p.update(dt));
    if (tripleShotTimer > 0) tripleShotTimer = Math.max(0, tripleShotTimer - dt);
    if (thrustBoostTimer > 0) thrustBoostTimer = Math.max(0, thrustBoostTimer - dt);
    if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
    if (slowMoTimer > 0) slowMoTimer = Math.max(0, slowMoTimer - dt);

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          asteroidsDestroyed++;
          if (
            asteroidsDestroyed >= POWERUP_SPAWN_THRESHOLD &&
            powerups.length < MAX_POWERUPS_ON_SCREEN
          ) {
            spawnPowerUp(a.x, a.y);
            asteroidsDestroyed = 0;
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs power-up
    for (const p of powerups) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        applyPowerUp(p.type);
      }
    }
    powerups = powerups.filter((p) => !p.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0 && shieldTimer <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawLifeIcon(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

    const active: string[] = [];
    if (thrustBoostTimer > 0) active.push(`${POWERUP_LABELS.P} ${thrustBoostTimer.toFixed(1)}s`);
    if (tripleShotTimer > 0) active.push(`${POWERUP_LABELS.B} ${tripleShotTimer.toFixed(1)}s`);
    if (shieldTimer > 0) active.push(`${POWERUP_LABELS.S} ${shieldTimer.toFixed(1)}s`);
    if (slowMoTimer > 0) active.push(`${POWERUP_LABELS.M} ${slowMoTimer.toFixed(1)}s`);
    if (active.length) {
      ctx.textAlign = "center";
      ctx.fillText(active.join("   "), W / 2, H - 16);
    }
  }

  function drawOverlay(title: string, sub: string) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerups.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();

    drawHUD();

    // Cambio respecto al original: sin la línea "ESPACIO PARA REINICIAR".
    if (state === "gameover") drawOverlay("GAME OVER", `PUNTAJE: ${score}`);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const loop = (ts: number) => {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

  initGame();
  draw();
  startLoop();

  return {
    pause: stopLoop,
    resume: startLoop,
    restart: () => {
      initGame();
      startLoop();
    },
    destroy: () => {
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
