/**
 * Health PowerUp
 * Restores player health when collected.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';
import { pixiPickupSpritePool } from '../../rendering/pixi-setup.js';

/**
 * Health pickup with magnetization.
 */
export class HealthPowerUp extends Entity {
    constructor(x, y) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.radius = 15;
        this.sprite = null;
        this.vel.x = (Math.random() - 0.5) * 2;
        this.vel.y = (Math.random() - 0.5) * 2;
        this.magnetized = false;
        this.flash = 0;
    }

    /**
     * Update health pickup with magnetization toward player.
     * @param {Entity} player - Player entity
     */
    update(player) {
        if (!player || player.dead) return;

        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

        if (dist < player.magnetRadius) {
            this.magnetized = true;
        }

        if (this.magnetized) {
            const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
            const speed = 10 + (1000 / Math.max(10, dist));
            this.vel.x = Math.cos(angle) * speed;
            this.vel.y = Math.sin(angle) * speed;
        } else {
            this.vel.mult(0.95);
        }

        this.pos.add(this.vel);
        this.flash++;
    }

    /**
     * Draw health pickup with PixiJS or Canvas fallback.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} pixiResources - PixiJS resources
     */
    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        // Try PixiJS rendering
        if (pixiResources?.layer && pixiResources?.textures?.health) {
            const tex = pixiResources.textures.health;
            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
            }
            if (spr) {
                if (!spr.parent) pixiResources.layer.addChild(spr);
                spr.visible = true;
                spr.position.set(this.pos.x, this.pos.y);
                const pulse = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
                const base = (this.radius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(base * pulse);
                spr.rotation = 0;
                spr.tint = 0xffffff;
                spr.alpha = 1;
                if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.ADD;
                this.sprite = spr;
                return;
            }
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        // Draw plus
        ctx.fillStyle = '#0f0';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Cull health pickup sprite if entity is culled from view.
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
                    console.warn('[HealthPowerUp] Failed to release sprite:', e);
                }
            }
            this.sprite = null;
        }
    }
}
