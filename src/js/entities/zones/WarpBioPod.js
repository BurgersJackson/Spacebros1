import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { Bullet } from "../projectiles/Bullet.js";
import { Particle } from "../particles/Particle.js";
import { pixiVectorLayer, getRenderAlpha } from "../../rendering/pixi-context.js";

let _spawnParticles = null;

/**
 * Spawns larger particles (3x size) but fewer (1/3 count) for warp boss effects
 */
function _spawnLargeParticles(x, y, count = 10, color = "#fff") {
  // Spawn 1/3 as many particles (round to nearest int, minimum 1)
  const actualCount = Math.max(1, Math.round(count / 3));
  // Create particles manually with 3x size
  for (let i = 0; i < actualCount; i++) {
    const p = new Particle(x, y, null, null, color);
    p.size = 6; // 3x normal size (2 * 3 = 6)
    GameContext.particles.push(p);
  }
}

export function registerWarpBioPodDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
}

export class WarpBioPod extends Entity {
  constructor(x, y, angle, owner = null) {
    super(x, y);
    this.radius = 22;
    this.hp = 3;
    this.life = 180;
    this.angle = angle || 0;
    this.owner = owner;
    const speed = 2.5;
    this.vel.x = Math.cos(this.angle) * speed;
    this.vel.y = Math.sin(this.angle) * speed;
    this._pixiGfx = null;
    this.alwaysUpdate = true;
  }
  takeHit(damage) {
    if (this.dead) return;
    this.hp -= damage;
    if (_spawnParticles) _spawnLargeParticles(this.pos.x, this.pos.y, 6, "#f6f");
    if (this.hp <= 0) this.explode();
  }
  explode() {
    if (this.dead) return;
    this.dead = true;
    if (this._pixiGfx) {
      try {
        this._pixiGfx.destroy(true);
      } catch (e) {}
      this._pixiGfx = null;
    }
    playSound("warp_pod_pop");
    if (_spawnParticles) _spawnLargeParticles(this.pos.x, this.pos.y, 18, "#f0f");
    const pelletCount = Math.round(10 / 3); // 1/3 of original 10 pellets
    for (let i = 0; i < pelletCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = new Bullet(this.pos.x, this.pos.y, a, 6, {
        owner: "enemy",
        damage: 1,
        radius: 12, // 3x larger (4 * 3 = 12)
        color: "#f0f",
        life: 180,
        ignoreShields: true
      });
      b.owner = this.owner;
      GameContext.bullets.push(b);
    }
  }
  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;

    if (this.owner && this.owner.dead) {
      this.explode();
      return;
    }

    const dtFactor = deltaTime / 16.67;

    if (GameContext.player && !GameContext.player.dead) {
      const dx = GameContext.player.pos.x - this.pos.x;
      const dy = GameContext.player.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      const homingRange = 750;

      if (distSq < homingRange * homingRange && this.life > 20) {
        const dist = Math.sqrt(distSq);
        const ax = (dx / dist) * 0.18 * dtFactor;
        const ay = (dy / dist) * 0.18 * dtFactor;
        this.vel.x += ax;
        this.vel.y += ay;
        this.angle += 0.1 * dtFactor;
      } else {
        this.vel.x *= Math.pow(0.98, dtFactor);
        this.vel.y *= Math.pow(0.98, dtFactor);
      }
    } else {
      this.vel.x *= Math.pow(0.98, dtFactor);
      this.vel.y *= Math.pow(0.98, dtFactor);
    }

    super.update(deltaTime);
    this.life -= dtFactor;

    const speed = Math.hypot(this.vel.x, this.vel.y);
    const maxSpeed = 6.0;
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      this.vel.x *= s;
      this.vel.y *= s;
    }

    if (this.life <= 0) this.explode();
  }
  draw(ctx) {
    if (this.dead) return;
    const rPos = this.getRenderPos(getRenderAlpha());
    if (USE_PIXI_OVERLAY && pixiVectorLayer) {
      let g = this._pixiGfx;
      if (!g) {
        g = new PIXI.Graphics();
        pixiVectorLayer.addChild(g);
        this._pixiGfx = g;
      }
      g.clear();
      g.position.set(rPos.x, rPos.y);
      g.beginFill(0xff00ff, 0.5);
      g.lineStyle(2, 0xff99ff, 0.9);
      g.drawCircle(0, 0, this.radius);
      g.endFill();
      return;
    }
    ctx.save();
    ctx.translate(rPos.x, rPos.y);
    ctx.fillStyle = "#f0f";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
