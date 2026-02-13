/**
 * Explosion Effect
 * Multi-particle explosion with configurable size.
 */

import { Entity } from "../Entity.js";
import { colorToPixi } from "../../rendering/colors.js";
import { allocPixiSprite, releasePixiSprite } from "../../rendering/sprite-pools.js";
import { SIM_STEP_MS } from "../../core/constants.js";

/**
 * Explosion effect with multiple particles.
 */
export class Explosion extends Entity {
  constructor(x, y, size = 140) {
    super(x, y);
    this.size = size;
    this.particles = [];
    this.life = 30;
    this.maxLife = 30;
    this.cleaned = false; // Track cleanup state to prevent duplicate cleanup
    this.createParticles();
  }

  createParticles() {
    const particleCount = Math.max(15, Math.floor(this.size / 3));
    const colors = ["#ff6", "#fa0", "#f80", "#f00", "#ff8"];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 2.5) * (this.size / 100);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const life = 20 + Math.floor(Math.random() * 20);

      this.particles.push({
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: vx,
        vy: vy,
        life: life,
        maxLife: life,
        color: color,
        size: 2 + Math.random() * (this.size / 30),
        sprite: null
      });
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    const scale = deltaTime / 16.67;
    this.life -= scale;
    // If explosion itself is dead, particles should be cleaned up in draw.
    if (this.life <= 0) {
      this.dead = true;
      return;
    }

    // Update particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * scale;
      p.y += p.vy * scale;
      p.vx *= Math.pow(0.96, scale); // friction scaled
      p.vy *= Math.pow(0.96, scale);
      p.life -= scale;
      // Add gravity effect (visual only)
      p.vy += 0.05 * scale;
    }
  }

  /**
   * Release all particle sprites back to pool.
   * Safe to call multiple times (uses cleaned flag to prevent duplicate cleanup).
   */
  cleanup(pixiResources) {
    if (this.cleaned) return; // Already cleaned, skip
    if (!pixiResources) {
      // FIX: Still try to remove sprites even if pixiResources is null
      // This prevents sprites from being left behind
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.sprite) {
          try {
            p.sprite.visible = false;
            if (p.sprite.parent) {
              p.sprite.parent.removeChild(p.sprite);
            }
          } catch (e) {
            console.warn("[Explosion] Failed to remove particle sprite:", e);
          }
          p.sprite = null;
        }
      }
      this.cleaned = true;
      return;
    }

    let releasedCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.sprite) {
        try {
          // Hide sprite first to prevent ghosting
          p.sprite.visible = false;
          // FIX: Always remove from parent layer first
          if (p.sprite.parent) {
            p.sprite.parent.removeChild(p.sprite);
          }
          // Only return to pool if it exists
          if (pixiResources.pool) {
            releasePixiSprite(pixiResources.pool, p.sprite);
            releasedCount++;
          }
        } catch (e) {
          console.warn("[Explosion] Failed to release particle sprite:", e);
        }
        p.sprite = null;
      }
    }

    this.cleaned = true;
  }

  draw(ctx, pixiResources = null, alpha = 1.0) {
    // Don't draw if already cleaned up
    if (this.cleaned) return;

    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;

    // PixiJS Rendering
    if (pixiResources && pixiResources.layer && pixiResources.pool) {
      const tex = pixiResources.glowTexture || pixiResources.whiteTexture;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        // Skip dead particles - don't allocate new sprites for them
        if (p.life <= 0) {
          // Release sprite if it exists
          if (p.sprite) {
            try {
              p.sprite.visible = false;
              releasePixiSprite(pixiResources.pool, p.sprite);
            } catch (e) {
              // Ignore cleanup errors for individual particles
            }
            p.sprite = null;
          }
          continue;
        }

        if (!p.sprite) {
          p.sprite = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
        }

        const spr = p.sprite;
        if (spr) {
          if (!spr.parent) pixiResources.layer.addChild(spr);
          spr.visible = true;

          const pRX =
            typeof alpha === "number" && p.prevX !== undefined
              ? p.prevX + (p.x - p.prevX) * alpha
              : p.x;
          const pRY =
            typeof alpha === "number" && p.prevY !== undefined
              ? p.prevY + (p.y - p.prevY) * alpha
              : p.y;

          spr.position.set(rPos.x + pRX, rPos.y + pRY);

          const pAlpha = Math.max(0, p.life / p.maxLife);
          const baseSize = 32; // Assuming glowTexture is approx 32x32
          // Canvas drew radius p.size * pAlpha * 2.5 (glow)
          // We want diameter: radius * 2
          // Scale = (radius * 2) / baseSize
          const radius = p.size * pAlpha * 2.5;
          const scale = (radius * 2) / baseSize;

          spr.scale.set(scale);
          spr.tint = colorToPixi(p.color);
          spr.alpha = pAlpha;
          spr.blendMode = window.PIXI ? PIXI.BLEND_MODES.ADD : 0;
        }
      }
      return;
    }
  }
}
