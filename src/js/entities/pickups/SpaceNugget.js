/**
 * SpaceNugget Pickup
 * Premium currency for meta-progression.
 */

import { Entity } from '../Entity.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';

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
     */
    update(player) {
        if (!player || player.dead) return;
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dist < player.magnetRadius) this.magnetized = true;

        if (this.magnetized) {
            const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
            const speed = 11 + (900 / Math.max(10, dist));
            this.vel.x = Math.cos(angle) * speed;
            this.vel.y = Math.sin(angle) * speed;
        } else {
            this.vel.mult(0.98);
        }

        this.pos.add(this.vel);
        this.flash++;
    }

    /**
     * Draw space nugget with PixiJS or Canvas fallback.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} pixiResources - PixiJS resources { layer, textures, pool }
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
        if (pixiResources?.layer && pixiResources?.textures?.nugget) {
            const tex = pixiResources.textures.nugget;
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
                const pulse = 1.0 + Math.sin(this.flash * 0.12) * 0.25;
                const base = (this.radius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(base * pulse);
                spr.rotation = 0;
                spr.tint = 0xffffff;
                spr.alpha = 1;
                if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.ADD;
                return;
            }
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = 1.0 + Math.sin(this.flash * 0.12) * 0.25;
        ctx.scale(scale, scale);
        ctx.rotate(Math.PI / 6);

        const gradient = ctx.createLinearGradient(-10, -10, 10, 10);
        gradient.addColorStop(0, '#ff0');
        gradient.addColorStop(0.5, '#f90');
        gradient.addColorStop(1, '#0ff');

        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = Math.cos(angle) * 8;
            const y = Math.sin(angle) * 8;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
