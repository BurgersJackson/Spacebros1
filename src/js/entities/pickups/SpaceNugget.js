/**
 * SpaceNugget Pickup
 * Premium currency for meta-progression.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';
import { pixiPickupSpritePool } from '../../rendering/pixi-setup.js';

/**
 * Premium currency pickup with magnetization.
 */
export class SpaceNugget extends Entity {
    constructor(x, y, value = 1) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.value = value;
        this.radius = 10;
        this.sprite = null;
        this.vel.x = (Math.random() - 0.5) * 0.6;
        this.vel.y = (Math.random() - 0.5) * 0.6;
        this.magnetized = false;
        this.flash = 0;
    }

    /**
     * Update space nugget position with magnetization toward player.
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
            const speed = 11 + (900 / Math.max(10, dist));
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
     * Draw space nugget with PixiJS or Canvas fallback.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} pixiResources - PixiJS resources { layer, textures, pool }
     */
    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        // Try PixiJS rendering
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
                const pulse = 1.0 + Math.sin(this.flash * 0.12) * 0.25;
                const base = (this.radius * 2) / Math.max(1, tex.width, tex.height);
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
        const scale = 1.0 + Math.sin(this.flash * 0.12) * 0.25;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        // Create gradient
        const grad = ctx.createLinearGradient(-10, -10, 10, 10);
        grad.addColorStop(0, '#ff0');
        grad.addColorStop(0.5, '#ffa500');
        grad.addColorStop(1, '#0ff');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Cull nugget sprite if entity is culled from view.
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
                    console.warn('[SpaceNugget] Failed to release sprite:', e);
                }
            }
            this.sprite = null;
        }
    }
}
