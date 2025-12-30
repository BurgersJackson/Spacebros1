/**
 * Coin Pickup
 * Collectible currency with magnetization toward player.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';
import { pixiPickupSpritePool } from '../../rendering/pixi-setup.js';

/**
 * Coin pickup with magnetization and value-based coloring.
 */
export class Coin extends Entity {
    constructor(x, y, value = 1) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.value = value;
        this.radius = 8;
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
            const speed = 12 + (1000 / Math.max(10, dist));
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

        // Try PixiJS rendering
        if (pixiResources?.layer && pixiResources?.textures) {
            const tex = this._getTexture(pixiResources.textures);
            if (tex) {
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
                }
                this.sprite = spr;
            }
            return;
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        const color = this.value >= 10 ? '#ff0' : '#ffff00';
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Get appropriate texture based on coin value.
     */
    _getTexture(textures) {
        if (this.value >= 10) return textures.coin10 || textures.coin1;
        if (this.value >= 5) return textures.coin5 || textures.coin1;
        return textures.coin1;
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
                    console.warn('[Coin] Failed to release sprite:', e);
                }
            }
            this.sprite = null;
        }
    }
}
