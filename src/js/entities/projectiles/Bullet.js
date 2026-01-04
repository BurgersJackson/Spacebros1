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

    update(deltaTime = 16.67) {
        const scale = deltaTime / 16.67;
        this.pos.x += this.vel.x * scale;
        this.pos.y += this.vel.y * scale;
        this.life -= scale;
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

    update(deltaTime = 16.67) {
        const scale = deltaTime / 16.67;

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

            // Turn toward target (scaled by deltaTime)
            const turnAmount = this.turnRate * scale;
            if (Math.abs(angleDiff) < turnAmount) {
                this.angle = targetAngle;
            } else {
                this.angle += Math.sign(angleDiff) * turnAmount;
            }

            // Accelerate (scaled by deltaTime)
            this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * scale);
        }

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
        this.pos.x += this.vel.x * scale;
        this.pos.y += this.vel.y * scale;

        this.life -= scale;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        // Use same graphics as turret guided missiles
        const z = currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Glow effect
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#fa0';

        // Main missile body - larger diamond shape like turret missiles
        ctx.fillStyle = '#f80';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(-18, 9);
        ctx.lineTo(-26, 0);
        ctx.lineTo(-18, -9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Flickering exhaust trail
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = `rgba(255, 120, 0, ${0.35 + Math.random() * 0.45})`;
        ctx.fillRect(-32, -4, 10, 8);
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}
