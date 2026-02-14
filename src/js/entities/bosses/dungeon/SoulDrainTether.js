import { Entity } from "../../Entity.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from "../../../core/constants.js";
import { pixiVectorLayer, getRenderAlpha } from "../../../rendering/pixi-context.js";

export class SoulDrainTether extends Entity {
  constructor(owner) {
    super(owner.pos.x, owner.pos.y);
    this.owner = owner;
    this.radius = 10;
    this.range = 900;
    this.damagePerSecond = 1;
    this.healPerSecond = 10; // 10 heal per 1 damage to player
    this.life = 120;
    this.t = 0;
    this._pixiGfx = null;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;

    if (!this.owner || this.owner.dead) {
      this.dead = true;
      return;
    }

    this.pos.x = this.owner.pos.x;
    this.pos.y = this.owner.pos.y;

    if (GameContext.player && !GameContext.player.dead) {
      const dx = GameContext.player.pos.x - this.pos.x;
      const dy = GameContext.player.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.range) {
        const damage = (this.damagePerSecond / 60) * dtFactor;
        const heal = (this.healPerSecond / 60) * dtFactor;

        if (GameContext.player.hp > 0) {
          GameContext.player.hp = Math.max(0, GameContext.player.hp - damage);
          if (this.owner.hp < this.owner.maxHp) {
            this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + heal);
          }
        }
      }
    }

    this.life -= dtFactor;
    if (this.life <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    if (!GameContext.player || GameContext.player.dead) return;

    const rPos = this.getRenderPos(getRenderAlpha());
    const dx = GameContext.player.pos.x - rPos.x;
    const dy = GameContext.player.pos.y - rPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= this.range) return;

    const pulse = 0.3 + Math.sin(this.t * 0.15) * 0.2;

    if (USE_PIXI_OVERLAY && pixiVectorLayer) {
      let g = this._pixiGfx;
      if (!g) {
        g = new PIXI.Graphics();
        pixiVectorLayer.addChild(g);
        this._pixiGfx = g;
      }
      g.clear();
      g.moveTo(rPos.x, rPos.y);
      g.lineTo(GameContext.player.pos.x, GameContext.player.pos.y);
      g.lineStyle(4 / (GameContext.currentZoom || 1), 0xff0088, pulse);
      return;
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#f08";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rPos.x, rPos.y);
    ctx.lineTo(GameContext.player.pos.x, GameContext.player.pos.y);
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
