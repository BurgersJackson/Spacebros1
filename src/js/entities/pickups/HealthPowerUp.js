/**
 * Health PowerUp
 * Restores player health when collected.
 * Uses medkit.png texture (64x64) on the Pixi pickup layer.
 */

import { Entity } from "../Entity.js";
import { allocPixiSprite, releasePixiSprite } from "../../rendering/sprite-pools.js";
import { pixiHealthSpritePool } from "../../rendering/pixi-setup.js";

/**
 * Health pickup with magnetization.
 */
export class HealthPowerUp extends Entity {
  constructor(x, y) {
    super(x, y);
    this._pixiPool = "health";
    this.radius = 32;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 2;
    this.vel.y = (Math.random() - 0.5) * 2;
    this.magnetized = false;
    this.flash = 0;
  }

  /**
   * Update health pickup with magnetization toward player.
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
      const speed = 10 + 1000 / Math.max(10, dist);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(Math.pow(0.95, scale));
    }

    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.flash += scale;
  }

  /**
   * Draw health pickup using canvas rendering (medkit style).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} pixiResources - PixiJS resources { layer, textures, pool } (unused)
   */
  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    // Always use canvas rendering to avoid texture issues
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 3.0 * (1.0 + Math.sin(this.flash * 0.1) * 0.2);
    ctx.scale(scale, scale);
    ctx.rotate(this.flash * 0.05);

    // Draw medkit-style cross
    ctx.fillStyle = "#00ff00";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    // Vertical bar
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.lineTo(-4, 10);
    ctx.lineTo(4, 10);
    ctx.lineTo(4, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Horizontal bar
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(10, -4);
    ctx.lineTo(10, 4);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw outer box
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-12, -12, 24, 24);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Cull health pickup when out of view.
   */
  cull() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  /**
   * Cleanup when entity is removed.
   * @param {Array} pool - Optional sprite pool (uses default if not provided)
   */
  kill(pool = null) {
    if (this.dead) return;
    this.dead = true;

    if (this.sprite) {
      this.sprite.visible = false;
      const targetPool = pool || pixiHealthSpritePool;
      if (targetPool) {
        releasePixiSprite(targetPool, this.sprite);
      }
      this.sprite = null;
    }
  }
}
