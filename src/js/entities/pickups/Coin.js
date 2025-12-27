/**
 * Coin Pickup
 * Collectible currency with magnetization toward player.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';

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
     */
    update(player) {
        if (!player || player.dead) return;

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
            this.vel.mult(0.98);
        }

        this.pos.add(this.vel);
        this.flash++;
    }

    /**
     * Draw coin with PixiJS or Canvas fallback.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} pixiResources - PixiJS resources { pickupLayer, textures, pool }
     */
    draw(ctx, pixiResources = null) {
        if (this.dead) {
            if (this.sprite && pixiResources?.pool) {
                releasePixiSprite(pixiResources.pool, this.sprite);
                this.sprite = null;
            }
            return;
        }

        // Try PixiJS rendering
        if (pixiResources?.layer && pixiResources?.textures) {
            const tex = this._getTexture(pixiResources.textures);
            if (tex) {
                let spr = this.sprite;
                if (!spr) {
                    spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
                    this.sprite = spr;
                }
                if (spr) {
                    spr.texture = tex;
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
                    return;
                }
            }
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
        ctx.scale(scale, scale);
        ctx.rotate(Math.PI / 4);

        let color = '#ff0';
        if (this.value >= 5) color = '#f0f';
        if (this.value >= 10) color = '#0ff';

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Glow Halo
        ctx.globalAlpha = 0.3;
        ctx.rect(-12, -12, 24, 24);
        ctx.fill();

        // Inner Core
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.rect(-4, -4, 8, 8);
        ctx.fill();
        ctx.stroke(); // White outline

        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
    }

    _getTexture(textures) {
        if (this.value >= 10) return textures.coin10 || textures.coin1;
        if (this.value >= 5) return textures.coin5 || textures.coin1;
        return textures.coin1;
    }

    cull() {
        if (this.sprite) this.sprite.visible = false;
    }
}
