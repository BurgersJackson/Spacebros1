/**
 * Particle Systems
 * Visual effect particles for explosions, smoke, and warp effects.
 */

import { Entity } from "../Entity.js";
import { colorToPixi } from "../../rendering/colors.js";
import { allocPixiSprite } from "../../rendering/sprite-pools.js";
import { SIM_STEP_MS } from "../../core/constants.js";

/**
 * Basic particle class with PixiJS and Canvas support.
 */
export class Particle extends Entity {
  constructor(x, y, vx, vy, color = "#fff", life = 30) {
    super(x, y);
    this._poolType = "particle";
    this.sprite = null;
    this.vel.x = vx || (Math.random() - 0.5) * 3;
    this.vel.y = vy || (Math.random() - 0.5) * 3;
    this.life = life + Math.random() * 10;
    this.maxLife = this.life;
    this.color = color;
    this.glow = false;
  }

  reset(x, y, vx, vy, color = "#fff", life = 30) {
    this.pos.x = x;
    this.pos.y = y;
    // Reset prevPos for interpolation
    if (this.prevPos) {
      this.prevPos.x = x;
      this.prevPos.y = y;
    }
    this.vel.x = vx || (Math.random() - 0.5) * 3;
    this.vel.y = vy || (Math.random() - 0.5) * 3;
    this.life = life + Math.random() * 10;
    this.maxLife = this.life;
    this.color = color;
    this.glow = false;
    this.dead = false;
    this.sprite = null;
  }

  update(deltaTime = SIM_STEP_MS) {
    super.update(deltaTime);
    const scale = deltaTime / 16.67;
    this.life -= scale;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, pixiResources = null, alpha = 1.0) {
    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;

    // Try PixiJS rendering
    if (pixiResources?.layer && pixiResources?.whiteTexture) {
      let spr = this.sprite;
      if (!spr) {
        const tex =
          this.glow && pixiResources.glowTexture
            ? pixiResources.glowTexture
            : pixiResources.whiteTexture;
        // Use particle size for visibility; glow defaults to a larger base size.
        const baseSize = this.glow ? 8 : 2;
        const size = Math.max(baseSize, this.size || baseSize);
        spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, size);
        this.sprite = spr;
      }
      if (spr) {
        if (!spr.parent) pixiResources.layer.addChild(spr);
        spr.position.set(rPos.x, rPos.y);
        spr.alpha = Math.max(0, this.life / this.maxLife);
        spr.tint = colorToPixi(this.color);
        if (this.glow) {
          spr.blendMode = window.PIXI ? PIXI.BLEND_MODES.ADD : 0;
        } else {
          spr.blendMode = window.PIXI ? PIXI.BLEND_MODES.NORMAL : 0;
        }
        return;
      }
    }
  }

  cull() {
    if (this.sprite) this.sprite.visible = false;
  }
}

/**
 * Smoke particle with rotation and size growth.
 */
export class SmokeParticle extends Entity {
  constructor(x, y, vx, vy, color = "#aaa") {
    super(x, y);
    this._poolType = "smoke";
    this.vel.x = vx || (Math.random() - 0.5) * 1;
    this.vel.y = vy || (Math.random() - 0.5) * 1;
    this.life = 60 + Math.random() * 30;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 4;
    this.color = color;
  }

  reset(x, y, vx, vy, color = "#aaa") {
    this.pos.x = x;
    this.pos.y = y;
    if (this.prevPos) {
      this.prevPos.x = x;
      this.prevPos.y = y;
    }
    this.vel.x = vx || (Math.random() - 0.5) * 1;
    this.vel.y = vy || (Math.random() - 0.5) * 1;
    this.life = 60 + Math.random() * 30;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 4;
    this.color = color;
    this.dead = false;
  }

  update(deltaTime = SIM_STEP_MS) {
    const scale = deltaTime / 16.67;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.size += 0.1 * scale;
    this.life -= scale;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, pixiResources = null, alpha = 1.0) {
    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;

    // Pixi Rendering
    if (pixiResources?.layer && pixiResources?.smokeTexture) {
      let spr = this.sprite;
      if (!spr) {
        // Smoke texture is 32x32, this.size starts small (~4) and grows
        spr = allocPixiSprite(
          pixiResources.pool,
          pixiResources.layer,
          pixiResources.smokeTexture,
          32
        );
        this.sprite = spr;
      }
      if (spr) {
        if (!spr.parent) pixiResources.layer.addChild(spr);
        spr.texture = pixiResources.smokeTexture;
        spr.position.set(rPos.x, rPos.y);
        spr.anchor.set(0.5);
        spr.rotation = this.life * 0.1;
        // Scale sprite to match this.size (which is pixel size of rect)
        // Texture is 32px.
        const s = this.size / 32;
        spr.scale.set(s);
        spr.alpha = (this.life / this.maxLife) * 0.5;
        spr.tint = colorToPixi(this.color);
        spr.blendMode = window.PIXI ? PIXI.BLEND_MODES.NORMAL : 0;
        return;
      }
    }
  }
}

/**
 * Warp effect particle with trailing line.
 */
export class WarpParticle extends Entity {
  constructor(x, y, angle, speed) {
    super(x, y);
    this.vel.x = Math.cos(angle) * speed;
    this.vel.y = Math.sin(angle) * speed;
    this.life = 20;
    this.maxLife = 20;
    this.length = 20;
    this.color = "#aff";
    this._poolType = "warp"; // Assume shared pool or no pool? Particle pool handles generic sprites.
    this.sprite = null;
  }

  update(deltaTime = SIM_STEP_MS) {
    const scale = deltaTime / 16.67;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.life -= scale;
    this.length += 5 * scale;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, pixiResources = null, alpha = 1.0) {
    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;

    // Pixi Rendering
    if (pixiResources?.layer && pixiResources?.warpTexture) {
      let spr = this.sprite;
      if (!spr) {
        spr = allocPixiSprite(
          pixiResources.pool,
          pixiResources.layer,
          pixiResources.warpTexture,
          32
        );
        this.sprite = spr;
      }
      if (spr) {
        if (!spr.parent) pixiResources.layer.addChild(spr);
        spr.texture = pixiResources.warpTexture;
        // Position at head
        spr.position.set(rPos.x, rPos.y);
        // Align with velocity
        const angle = Math.atan2(this.vel.y, this.vel.x);
        spr.rotation = angle + Math.PI; // Texture origin is left, drawing tail backwards?
        // Wait, WarpParticle code: tailX = x - (vx/mag)*len.
        // So line is from Head TO Tail (opposite velocity).
        // If texture origin is (0,0) (left), pointing Right.
        // If we rotate to vel angle + PI, it points backward.
        spr.anchor.set(0, 0.5); // Origin left-center

        // Scale Width to length
        // Texture base width 32.
        const s = this.length / 32;
        spr.scale.set(s, 1); // Stretch X, keep Y (height 4px seems fine)

        spr.alpha = this.life / this.maxLife;
        spr.tint = colorToPixi(this.color);
        spr.blendMode = window.PIXI ? PIXI.BLEND_MODES.ADD : 0;
        return;
      }
    }
  }
}
