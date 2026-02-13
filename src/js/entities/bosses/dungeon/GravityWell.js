import { Entity } from "../../Entity.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from "../../../core/constants.js";
import { pixiVectorLayer, getRenderAlpha } from "../../../rendering/pixi-context.js";

export class GravityWell extends Entity {
  constructor(x, y, owner = null) {
    super(x, y);
    this.owner = owner;
    this.radius = 80;
    this.pullRadius = 600;
    this.strength = 0.35;
    this.life = 180;
    this.t = 0;
    this._pixiGfx = null;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;

    if (GameContext.player && !GameContext.player.dead) {
      const dx = this.pos.x - GameContext.player.pos.x;
      const dy = this.pos.y - GameContext.player.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.pullRadius && dist > 10) {
        const force = this.strength * (1 - dist / this.pullRadius) * dtFactor;
        GameContext.player.vel.x += (dx / dist) * force;
        GameContext.player.vel.y += (dy / dist) * force;
      }
    }

    for (let i = 0; i < GameContext.bullets.length; i++) {
      const b = GameContext.bullets[i];
      if (!b || b.dead || b.isEnemy) continue;
      const dx = this.pos.x - b.pos.x;
      const dy = this.pos.y - b.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.pullRadius * 0.7 && dist > 10) {
        const force = this.strength * 0.5 * (1 - dist / (this.pullRadius * 0.7)) * dtFactor;
        b.vel.x += (dx / dist) * force;
        b.vel.y += (dy / dist) * force;
      }
    }

    this.life -= dtFactor;
    if (this.life <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const rPos = this.getRenderPos(getRenderAlpha());
    const pulse = 0.5 + Math.sin(this.t * 0.1) * 0.3;

    if (USE_PIXI_OVERLAY && pixiVectorLayer) {
      let g = this._pixiGfx;
      if (!g) {
        g = new PIXI.Graphics();
        pixiVectorLayer.addChild(g);
        this._pixiGfx = g;
      }
      g.clear();
      g.position.set(rPos.x, rPos.y);
      g.lineStyle(2 / (GameContext.currentZoom || 1), 0x00aaff, 0.3 * pulse);
      g.drawCircle(0, 0, this.pullRadius);
      g.lineStyle(3 / (GameContext.currentZoom || 1), 0x00ffff, 0.8);
      g.beginFill(0x0044aa, 0.5 * pulse);
      g.drawCircle(0, 0, this.radius);
      g.endFill();
      return;
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(rPos.x, rPos.y);
    ctx.strokeStyle = "rgba(0, 170, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.pullRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 68, 170, 0.5)";
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this._pixiGfx) {
      try {
        this._pixiGfx.destroy(true);
      } catch (e) {}
      this._pixiGfx = null;
    }
  }
}
