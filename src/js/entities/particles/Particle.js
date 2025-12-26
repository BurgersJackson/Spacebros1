/**
 * Particle Systems
 * Visual effect particles for explosions, smoke, and warp effects.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite } from '../../rendering/sprite-pools.js';

/**
 * Basic particle class with PixiJS and Canvas support.
 */
export class Particle extends Entity {
    constructor(x, y, vx, vy, color = '#fff', life = 30) {
        super(x, y);
        this._poolType = 'particle';
        this.sprite = null;
        this.vel.x = vx || (Math.random() - 0.5) * 3;
        this.vel.y = vy || (Math.random() - 0.5) * 3;
        this.life = life + Math.random() * 10;
        this.maxLife = this.life;
        this.color = color;
    }

    reset(x, y, vx, vy, color = '#fff', life = 30) {
        this.pos.x = x;
        this.pos.y = y;
        this.vel.x = vx || (Math.random() - 0.5) * 3;
        this.vel.y = vy || (Math.random() - 0.5) * 3;
        this.life = life + Math.random() * 10;
        this.maxLife = this.life;
        this.color = color;
        this.dead = false;
        this.sprite = null;
    }

    update() {
        super.update();
        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, pixiResources = null) {
        // Try PixiJS rendering
        if (pixiResources?.layer && pixiResources?.whiteTexture) {
            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, pixiResources.whiteTexture, 2);
                this.sprite = spr;
            }
            if (spr) {
                if (!spr.parent) pixiResources.layer.addChild(spr);
                spr.position.set(this.pos.x, this.pos.y);
                spr.alpha = Math.max(0, this.life / this.maxLife);
                spr.tint = colorToPixi(this.color);
                return;
            }
        }

        // Canvas fallback
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.pos.x, this.pos.y, 2, 2);
        ctx.globalAlpha = 1.0;
    }
}

/**
 * Smoke particle with rotation and size growth.
 */
export class SmokeParticle extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y);
        this._poolType = 'smoke';
        this.vel.x = vx || (Math.random() - 0.5) * 1;
        this.vel.y = vy || (Math.random() - 0.5) * 1;
        this.life = 60 + Math.random() * 30;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
    }

    reset(x, y, vx, vy) {
        this.pos.x = x;
        this.pos.y = y;
        this.vel.x = vx || (Math.random() - 0.5) * 1;
        this.vel.y = vy || (Math.random() - 0.5) * 1;
        this.life = 60 + Math.random() * 30;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
        this.dead = false;
    }

    update() {
        this.pos.add(this.vel);
        this.size += 0.1;
        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = (this.life / this.maxLife) * 0.5;
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.life * 0.1);
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
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
        this.color = '#aff';
    }

    update() {
        this.pos.add(this.vel);
        this.life--;
        this.length += 5;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y);
        const mag = this.vel.mag();
        if (mag > 0) {
            const tailX = this.pos.x - (this.vel.x / mag) * this.length;
            const tailY = this.pos.y - (this.vel.y / mag) * this.length;
            ctx.lineTo(tailX, tailY);
        }
        ctx.stroke();
        ctx.restore();
    }
}
