import { Entity } from "../Entity.js";
import { allocPixiSprite, releasePixiSprite } from "../../rendering/sprite-pools.js";
import { pixiPickupSpritePool } from "../../rendering/pixi-setup.js";

export class GoldNugget extends Entity {
  constructor(x, y, nuggetMin = 3, nuggetMax = 5, coinMin = 25, coinMax = 75) {
    super(x, y);
    this._pixiPool = "pickup";
    this.nuggetMin = nuggetMin;
    this.nuggetMax = nuggetMax;
    this.coinMin = coinMin;
    this.coinMax = coinMax;
    this.radius = 21;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 0.4;
    this.vel.y = (Math.random() - 0.5) * 0.4;
    this.magnetized = false;
    this.flash = 0;
    this.pulseSpeed = 0.08;
    this.baseScale = 1.0;
  }

  update(player, deltaTime = 16.67) {
    if (!player || player.dead) return;
    const scale = deltaTime / 16.67;

    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      const speed = 10 + 800 / Math.max(10, dist);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(Math.pow(0.985, scale));
    }

    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.flash += scale;
  }

  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    if (pixiResources?.layer && pixiResources?.textures?.nugget) {
      const tex = pixiResources.textures.nugget;
      let spr = this.sprite;
      if (!spr) {
        spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
      }
      if (spr) {
        if (!spr.parent) pixiResources.layer.addChild(spr);
        spr.visible = true;
        spr.position.set(this.pos.x, this.pos.y);
        const pulse = 1.0 + Math.sin(this.flash * this.pulseSpeed) * 0.3;
        const base = (this.radius * 2) / Math.max(1, tex.width, tex.height);
        spr.scale.set(base * pulse * 1.2);
        spr.rotation = this.flash * 0.02;
        spr.tint = 0xff8800;
        spr.alpha = 1;
        if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.ADD;
        this.sprite = spr;
        return;
      }
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const pulse = 1.0 + Math.sin(this.flash * this.pulseSpeed) * 0.3;
    ctx.scale(pulse, pulse);
    ctx.rotate(this.flash * 0.02);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    gradient.addColorStop(0, "#ffcc88");
    gradient.addColorStop(0.5, "#ff8800");
    gradient.addColorStop(1, "#cc6600");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ff8800";
    ctx.shadowBlur = 15;

    ctx.beginPath();
    const spikes = 8;
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? this.radius : this.radius * 0.5;
      const angle = (Math.PI * 2 * i) / (spikes * 2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  cull() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  kill(pool = null) {
    if (this.dead) return;
    this.dead = true;

    if (this.sprite) {
      this.sprite.visible = false;
      const targetPool = pool || pixiPickupSpritePool;
      if (targetPool) {
        try {
          releasePixiSprite(targetPool, this.sprite);
        } catch (e) {
          console.warn("[GoldNugget] Failed to release sprite:", e);
        }
      }
      this.sprite = null;
    }
  }
}
