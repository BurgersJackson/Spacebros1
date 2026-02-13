import { GameContext } from "../core/game-context.js";
import { immediateCompactArray } from "../core/staggered-cleanup.js";
import { Particle, SmokeParticle, Explosion, Shockwave, LightningArc } from "../entities/index.js";
import {
  pixiParticleSpritePool,
  releasePixiSprite,
  pixiCleanupObject,
  clearArrayWithPixiCleanup
} from "../rendering/pixi-context.js";
import { playSound } from "../audio/audio-manager.js";

const particlePool = [];
const smokeParticlePool = [];

export function emitParticle(x, y, vx, vy, color = "#fff", life = 30) {
  let p = particlePool.length > 0 ? particlePool.pop() : null;
  if (!p) p = new Particle(x, y, vx, vy, color, life);
  else p.reset(x, y, vx, vy, color, life);
  GameContext.particles.push(p);
  return p;
}

export function emitSmokeParticle(x, y, vx, vy, color = "#aaa") {
  let p = smokeParticlePool.length > 0 ? smokeParticlePool.pop() : null;
  if (!p) p = new SmokeParticle(x, y, vx, vy, color);
  else p.reset(x, y, vx, vy, color);
  GameContext.particles.push(p);
  return p;
}

export function compactParticles(arr) {
  immediateCompactArray(arr, p => {
    // Release sprite from pool
    if (p.sprite && pixiParticleSpritePool) {
      releasePixiSprite(pixiParticleSpritePool, p.sprite);
      p.sprite = null;
    }
    // Clean up any custom PixiJS graphics
    if (p._pixiCustomGfx) {
      try {
        p._pixiCustomGfx.destroy({ children: true });
      } catch (e) {}
      p._pixiCustomGfx = null;
    }
    if (p._pixiText) {
      try {
        p._pixiText.destroy();
      } catch (e) {}
      p._pixiText = null;
    }
    if (p._pixiGfx) {
      try {
        p._pixiGfx.destroy({ children: true });
      } catch (e) {}
      p._pixiGfx = null;
    }
  });
}

export function spawnParticles(x, y, count = 10, color = "#fff") {
  for (let i = 0; i < count; i++) emitParticle(x, y, null, null, color, 30);
}

export function spawnLightningArc(x1, y1, x2, y2, color = "#0ff") {
  const arc = new LightningArc(x1, y1, x2, y2, color, 12);
  GameContext.lightningArcs.push(arc);
  return arc;
}

export function processLightningEffects() {}

export function scheduleParticleBursts(x, y, totalCount, color, spreadFrames = 10) {
  const particlesPerFrame = Math.max(1, Math.floor(totalCount / spreadFrames));

  for (let frame = 0; frame < spreadFrames; frame++) {
    GameContext.staggeredParticleBursts.push({
      x: x + (Math.random() - 0.5) * 100,
      y: y + (Math.random() - 0.5) * 100,
      count: particlesPerFrame + (frame === spreadFrames - 1 ? totalCount % spreadFrames : 0),
      color: color,
      delayFrames: frame * 2,
      processed: false
    });
  }
}

export function processStaggeredParticleBursts() {
  if (GameContext.staggeredParticleBursts.length === 0) return;

  for (let i = GameContext.staggeredParticleBursts.length - 1; i >= 0; i--) {
    const burst = GameContext.staggeredParticleBursts[i];

    // Remove invalid or processed entries
    if (!burst || burst.processed) {
      GameContext.staggeredParticleBursts.splice(i, 1);
      continue;
    }

    if (burst.delayFrames <= 0) {
      try {
        burst.processed = true;
        spawnParticles(burst.x, burst.y, burst.count, burst.color);
      } catch (e) {
        console.warn("[processStaggeredParticleBursts] Error spawning particles:", e);
        // Mark as processed even on error to prevent infinite retries
        burst.processed = true;
      }
    } else {
      burst.delayFrames--;
    }
  }
}

export function scheduleStaggeredBombExplosions(sourceX, sourceY) {
  const bombCount = GameContext.bossBombs.length;
  if (bombCount === 0) {
    clearArrayWithPixiCleanup(GameContext.bossBombs);
    return;
  }

  console.log(`[BOSS KILL] Scheduling ${bombCount} bomb explosions over multiple frames`);

  const bombsToExplode = [...GameContext.bossBombs];
  GameContext.bossBombs.length = 0;

  const bombsPerFrame = Math.min(3, Math.ceil(bombCount / 10));

  for (let i = 0; i < bombCount; i++) {
    const bomb = bombsToExplode[i];
    const delayFrames = Math.floor(i / bombsPerFrame);

    GameContext.staggeredBombExplosions.push({
      bomb: bomb,
      pos: { x: bomb.pos.x, y: bomb.pos.y },
      delayFrames: delayFrames,
      processed: false
    });
  }
}

export function processStaggeredBombExplosions() {
  if (GameContext.staggeredBombExplosions.length === 0) return;

  const explosionsThisFrame = [];

  for (let i = GameContext.staggeredBombExplosions.length - 1; i >= 0; i--) {
    const queued = GameContext.staggeredBombExplosions[i];

    // Remove invalid or processed entries
    if (!queued || queued.processed) {
      GameContext.staggeredBombExplosions.splice(i, 1);
      continue;
    }

    // Remove entries with dead or null bombs
    if (!queued.bomb || queued.bomb.dead) {
      GameContext.staggeredBombExplosions.splice(i, 1);
      continue;
    }

    if (queued.delayFrames <= 0) {
      queued.processed = true;
      explosionsThisFrame.push(queued);
    } else {
      queued.delayFrames--;
    }
  }

  const maxPerFrame = 4;
  const actualExplosions = explosionsThisFrame.slice(0, maxPerFrame);

  for (const queued of actualExplosions) {
    const bomb = queued.bomb;
    if (bomb && !bomb.dead) {
      try {
        bomb.dead = true;
        pixiCleanupObject(bomb);
        playSound("explode");
        spawnParticles(bomb.pos.x, bomb.pos.y, 40, "#fa0");
        GameContext.shockwaves.push(
          new Shockwave(bomb.pos.x, bomb.pos.y, bomb.damage, bomb.blastRadius, {
            damagePlayer: true,
            damageBases: true,
            ignoreEntity: bomb.owner,
            color: "#fa0"
          })
        );
      } catch (e) {
        console.warn("[processStaggeredBombExplosions] Error processing bomb:", e);
      }
    }
    // Mark as processed even if bomb was already dead
    queued.processed = true;
  }
}

export function spawnLargeExplosion(x, y, scale = 2.0) {
  const s = scale;
  const spriteSize = 250 * (s / 2.0);
  GameContext.explosions.push(new Explosion(x, y, spriteSize));

  const count = Math.floor(25 * (s / 1.5));
  const colors = ["#ff8", "#fa0", "#f40", "#f00"];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (2.0 + Math.random() * 3.0) * (s / 2.0);
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const color = colors[(Math.random() * colors.length) | 0];
    const life = 30 + Math.floor(Math.random() * 20);
    const p = emitParticle(x, y, vx, vy, color, life);
    p.glow = true;
    p.size = (6 + Math.random() * 8) * (s / 2.0);
  }

  const bigCount = Math.floor(12 * (s / 2.0));
  for (let i = 0; i < bigCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (1.5 + Math.random() * 3.5) * (s / 2.0);
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const life = 40 + Math.floor(Math.random() * 25);
    const color = Math.random() < 0.5 ? "#f00" : "#f80";

    const p = emitParticle(x, y, vx, vy, color, life);
    p.size = (20 + Math.random() * 12) * (s / 2.0);
    p.glow = true;
  }

  spawnSmoke(x, y, Math.ceil(6 * (s / 2.0)));
  playSound("base_explode");
}

export function spawnFieryExplosion(x, y, scale = 1) {
  const s = Math.max(0.6, Math.min(3, scale || 1));
  const spriteSize = Math.max(90, Math.round(140 * s));
  GameContext.explosions.push(new Explosion(x, y, spriteSize));

  const count = Math.max(10, Math.round(12 * s));
  const colors = ["#ff6", "#fa0", "#f80", "#f00"];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (0.8 + Math.random() * 1.8) * s;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const color = colors[(Math.random() * colors.length) | 0];
    const life = 20 + Math.floor(Math.random() * 16);
    const p = emitParticle(x, y, vx, vy, color, life);
    p.glow = true;
  }
  spawnSmoke(x, y, Math.max(1, Math.round(2 * s)));
}

export function spawnBossExplosion(x, y, scale = 2.5, chunkCount = 18) {
  const s = Math.max(1.2, Math.min(5, scale || 1));
  spawnFieryExplosion(x, y, s);

  const colors = ["#888", "#777", "#666"];
  const count = Math.max(8, Math.round(chunkCount * (0.6 + s * 0.15)));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (2.5 + Math.random() * 4.5) * s;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const life = 40 + Math.floor(Math.random() * 35);
    const p = emitParticle(x, y, vx, vy, colors[(Math.random() * colors.length) | 0], life);
    p.size = 4 + Math.random() * 6;
    p.glow = false;
  }

  const smokeCount = Math.max(2, Math.round(2 * s));
  for (let i = 0; i < smokeCount; i++) {
    const sp = emitSmokeParticle(
      x,
      y,
      (Math.random() - 0.5) * s,
      (Math.random() - 0.5) * s,
      "#777"
    );
    if (sp) {
      sp.size *= 1.8;
      sp.life = Math.round(sp.life * 1.3);
      sp.maxLife = sp.life;
    }
  }
}

export function spawnAsteroidExplosion(x, y, scale = 1) {
  const s = Math.max(0.5, Math.min(2.6, scale || 1)) * 2;
  const count = Math.max(8, Math.round(10 * s));
  const colors = ["#fff"];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (0.6 + Math.random() * 1.6) * s;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const color = colors[(Math.random() * colors.length) | 0];
    const life = 18 + Math.floor(Math.random() * 16);
    const p = emitParticle(x, y, vx, vy, color, life);
    p.size = (p.size || 2) * 3;
    p.glow = true;
  }
  const smokeCount = Math.max(2, Math.round(4 * s));
  for (let i = 0; i < smokeCount; i++) {
    const sp = emitSmokeParticle(x, y, null, null, "#fff");
    if (sp) {
      sp.size *= 3;
      sp.life = Math.round(sp.life * 1.4);
      sp.maxLife = sp.life;
    }
  }
}

export function spawnSmoke(x, y, count = 1, color = "#aaa") {
  for (let i = 0; i < count; i++) emitSmokeParticle(x, y, null, null, color);
}

export function spawnBarrelSmoke(x, y, angle) {
  for (let i = 0; i < 3; i++) {
    const speed = 2 + Math.random() * 2;
    const spread = (Math.random() - 0.5) * 0.5;
    const vx = Math.cos(angle + spread) * speed;
    const vy = Math.sin(angle + spread) * speed;
    emitSmokeParticle(x, y, vx, vy);
  }
}
