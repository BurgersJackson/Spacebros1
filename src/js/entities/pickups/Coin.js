/**
 * Coin Pickup
 * Collectible currency with magnetization toward player.
 */

import { Entity } from "../Entity.js";
import { releasePixiSprite } from "../../rendering/sprite-pools.js";
import { pixiPickupSpritePool } from "../../rendering/pixi-setup.js";

const COIN_TEXTURE_URL = "assets/coin1.png";

/**
 * Coin pickup with magnetization and value-based coloring.
 * Loads coin1.png in its own Image and creates a dedicated texture (no shared Pixi cache with nugget).
 */
export class Coin extends Entity {
  constructor(x, y, value = 1) {
    super(x, y);
    this._pixiPool = "pickup";
    this.value = value;
    this.radius = 16;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 0.5;
    this.vel.y = (Math.random() - 0.5) * 0.5;
    this.magnetized = false;
    this.flash = 0;
  }

  /**
   * Update coin position with magnetization toward player.
   * @param {Entity} player - Player entity
   * @param {number} deltaTime - Time elapsed since last update in ms
   */
  update(player, deltaTime = 16.67) {
    if (!player || player.dead) return;
    const scale = deltaTime / 16.67;

    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      // Cap speed to prevent overshooting when very close
      // At dist=10, raw speed would be (12+100)*3=336, cap it to dist*0.8 to prevent overshoot
      const rawSpeed = (12 + 1000 / Math.max(10, dist)) * 3;
      const maxSpeed = dist * 0.8; // Don't move more than 80% of distance per frame
      const speed = Math.min(rawSpeed, maxSpeed);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(Math.pow(0.98, scale));
    }

    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.flash += scale;
  }

  /**
   * Draw coin with PixiJS or Canvas fallback.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} pixiResources - PixiJS resources { pickupLayer, textures, pool }
   */
  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    // Use coin-only texture from URL so we never share state with nugget/pixiTextures
    const tex = Coin._getCoinTexture();
    if (pixiResources?.layer && tex && tex.width > 0 && tex.height > 0) {
      let spr = this.sprite;
      if (!spr) {
        spr = new PIXI.Sprite(tex);
        spr.anchor.set(0.5);
        pixiResources.layer.addChild(spr);
      }
      if (spr) {
        spr.texture = tex;
        spr.visible = true;
        spr.position.set(this.pos.x, this.pos.y);
        const pulse = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
        const base = (this.radius * 2) / Math.max(1, tex.width, tex.height);
        spr.scale.set(base * pulse);
        spr.rotation = this.flash * 0.05;
        spr.tint = 0xffffff;
        spr.alpha = 1;
        this.sprite = spr;
        return;
      }
    }

    // Canvas fallback (when Pixi not ready or texture still loading)
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
    ctx.scale(scale, scale);
    ctx.rotate(this.flash * 0.05);

    const color = this.value >= 10 ? "#ff0" : "#ffff00";
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Get the coin texture. Loads coin1.png in a dedicated Image and creates
   * BaseTexture+Texture so we never share Pixi cache with nugget.
   */
  static _getCoinTexture() {
    if (!window.PIXI) return null;
    if (Coin._coinTexture) return Coin._coinTexture;
    if (Coin._coinImageLoading) return null;
    if (!Coin._coinImage) {
      Coin._coinImage = new Image();
      Coin._coinImage.crossOrigin = "";
      Coin._coinImageLoading = true;
      Coin._coinImage.onload = () => {
        Coin._coinImageLoading = false;
        try {
          const base = new PIXI.BaseTexture(Coin._coinImage);
          Coin._coinTexture = new PIXI.Texture(base);
        } catch (e) {
          console.warn("[Coin] Failed to create texture from image:", e);
        }
      };
      Coin._coinImage.onerror = () => {
        Coin._coinImageLoading = false;
      };
      Coin._coinImage.src = COIN_TEXTURE_URL;
    }
    return Coin._coinTexture || null;
  }

  /**
   * Cleanup sprite when entity is culled from view.
   */
  cull() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  /**
   * Cleanup sprite when entity is removed.
   * Ensures sprite is properly released to pool.
   * @param {Array} pool - Optional sprite pool (uses default if not provided)
   */
  kill(pool = null) {
    if (this.dead) return;
    this.dead = true;

    // Hide and release sprite
    if (this.sprite) {
      this.sprite.visible = false;
      const targetPool = pool || pixiPickupSpritePool;
      if (targetPool) {
        try {
          releasePixiSprite(targetPool, this.sprite);
        } catch (e) {
          console.warn("[Coin] Failed to release sprite:", e);
        }
      }
      this.sprite = null;
    }
  }
}
