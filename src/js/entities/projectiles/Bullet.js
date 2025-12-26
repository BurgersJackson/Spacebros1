/**
 * Bullet/Projectile
 * Base projectile class for player and enemy bullets.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';

/**
 * Bullet projectile with damage and owner tracking.
 */
export class Bullet extends Entity {
    constructor(x, y, angle, speed, opts = {}) {
        super(x, y);
        this._poolType = 'bullet';
        this.sprite = null;

        this.vel.x = Math.cos(angle) * speed * 2; // Doubled for 60Hz
        this.vel.y = Math.sin(angle) * speed * 2;
        this.angle = angle;
        this.speed = speed * 2;

        this.damage = opts.damage || 1;
        this.radius = opts.radius || 4;
        this.life = opts.life ? opts.life / 2 : 60; // halved
        this.maxLife = this.life;
        this.color = opts.color || '#0ff';
        this.owner = opts.owner || 'player'; // 'player' or 'enemy'
        this.piercing = opts.piercing || false;
        this.hitCount = 0;
        this.maxHits = opts.maxHits || 1;

        // Visual style
        this.style = opts.style || 'glow'; // 'glow', 'laser', 'square'
    }

    update() {
        this.pos.add(this.vel);
        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    /**
     * Draw bullet with PixiJS or Canvas.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} pixiResources - { layer, textures, pool }
     */
    draw(ctx, pixiResources = null) {
        if (this.dead) {
            if (this.sprite && pixiResources?.pool) {
                releasePixiSprite(pixiResources.pool, this.sprite);
                this.sprite = null;
            }
            return;
        }

        // Try PixiJS
        if (pixiResources?.layer && pixiResources?.textures) {
            const tex = pixiResources.textures[this.style] || pixiResources.textures.glow;
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
                    spr.rotation = this.angle;
                    spr.tint = colorToPixi(this.color);
                    spr.alpha = Math.min(1, this.life / 20);
                    if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.ADD;
                    return;
                }
            }
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;

        if (this.style === 'laser') {
            ctx.fillRect(-10, -2, 20, 4);
        } else if (this.style === 'square') {
            ctx.fillRect(-3, -3, 6, 6);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    /**
     * Record a hit. Returns true if bullet should be destroyed.
     */
    recordHit() {
        this.hitCount++;
        if (!this.piercing || this.hitCount >= this.maxHits) {
            this.dead = true;
            return true;
        }
        return false;
    }
}

/**
 * Homing Missile projectile.
 */
export class Missile extends Entity {
    constructor(x, y, angle, speed, target, opts = {}) {
        super(x, y);
        this._poolType = 'bullet';
        this.sprite = null;

        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;
        this.angle = angle;
        this.speed = speed;
        this.target = target;

        this.damage = opts.damage || 5;
        this.radius = opts.radius || 6;
        this.life = opts.life ? opts.life / 2 : 90;
        this.maxLife = this.life;
        this.color = opts.color || '#f80';
        this.owner = opts.owner || 'player';

        this.turnRate = opts.turnRate ? opts.turnRate * 2 : 0.16;
        this.acceleration = opts.acceleration ? opts.acceleration * 2 : 1.0;
        this.maxSpeed = opts.maxSpeed ? opts.maxSpeed : speed * 1.5; // maxSpeed is already correctly set or scaled elsewhere if needed
    }

    update() {
        // Home toward target
        if (this.target && !this.target.dead) {
            const targetAngle = Math.atan2(
                this.target.pos.y - this.pos.y,
                this.target.pos.x - this.pos.x
            );

            // Calculate angle difference
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Turn toward target
            if (Math.abs(angleDiff) < this.turnRate) {
                this.angle = targetAngle;
            } else {
                this.angle += Math.sign(angleDiff) * this.turnRate;
            }

            // Accelerate
            this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration);
        }

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
        this.pos.add(this.vel);

        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        // Canvas rendering (missiles are less common, Canvas is fine)
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Missile body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.6);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.6);
        ctx.closePath();
        ctx.fill();

        // Exhaust
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius * 1.5, this.radius * 0.3);
        ctx.lineTo(-this.radius * 1.5, -this.radius * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}
