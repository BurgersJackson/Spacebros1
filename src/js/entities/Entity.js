/**
 * Base Entity Class
 * Foundation for all game objects with position, velocity, and rendering.
 */

import { Vector } from '../core/math.js';

/**
 * Base entity class for all game objects.
 */
export class Entity {
    constructor(x = 0, y = 0) {
        this.pos = new Vector(x, y);
        this.prevPos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.radius = 10;
        this.angle = 0;
        this.dead = false;
        this.visible = true;

        // Pixi sprite reference
        this.sprite = null;
        this._pixiContainer = null;
        this._pixiPool = null;
        this._poolType = null;
    }

    /**
     * Update entity position based on velocity.
     * @param {number} deltaTime - Time elapsed since last update in milliseconds
     */
    update(deltaTime = 16.67) {
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        // Scale velocity by deltaTime to maintain consistent movement across different frame rates
        const scale = deltaTime / 16.67; // 16.67ms = 1/60th second
        this.pos.x += this.vel.x * scale;
        this.pos.y += this.vel.y * scale;
    }

    /**
     * Get interpolated render position.
     * @param {number} alpha - Interpolation factor (0..1)
     * @returns {Object} {x, y}
     */
    getRenderPos(alpha) {
        // Always return a plain object for consistency (never return Vector references)
        // This prevents issues where PixiJS or other code might modify the Vector object
        if (alpha <= 0) return { x: this.prevPos.x, y: this.prevPos.y };
        if (alpha >= 1) return { x: this.pos.x, y: this.pos.y };
        return {
            x: this.prevPos.x + (this.pos.x - this.prevPos.x) * alpha,
            y: this.prevPos.y + (this.pos.y - this.prevPos.y) * alpha
        };
    }

    /**
     * Draw entity (override in subclasses).
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Override in subclasses
    }

    /**
     * Check if this entity collides with another.
     * @param {Entity} other - Other entity
     * @returns {boolean}
     */
    collidesWith(other) {
        if (!other) return false;
        const dx = other.pos.x - this.pos.x;
        const dy = other.pos.y - this.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (this.radius + other.radius);
    }

    /**
     * Get squared distance to another entity (faster than distance).
     * @param {Entity} other 
     * @returns {number}
     */
    distSqTo(other) {
        const dx = other.pos.x - this.pos.x;
        const dy = other.pos.y - this.pos.y;
        return dx * dx + dy * dy;
    }

    /**
     * Get distance to another entity.
     * @param {Entity} other 
     * @returns {number}
     */
    distTo(other) {
        return Math.sqrt(this.distSqTo(other));
    }

    /**
     * Get angle to another entity.
     * @param {Entity} other 
     * @returns {number}
     */
    angleTo(other) {
        return Math.atan2(other.pos.y - this.pos.y, other.pos.x - this.pos.x);
    }

    /**
     * Mark entity as dead for removal.
     */
    kill() {
        this.dead = true;
    }

    /**
     * Check if entity is within view bounds.
     * @param {number} camX - Camera X
     * @param {number} camY - Camera Y
     * @param {number} viewWidth - View width
     * @param {number} viewHeight - View height
     * @param {number} margin - Extra margin
     * @returns {boolean}
     */
    isInView(camX, camY, viewWidth, viewHeight, margin = 100) {
        const halfW = viewWidth / 2 + margin;
        const halfH = viewHeight / 2 + margin;
        return (
            this.pos.x > camX - halfW &&
            this.pos.x < camX + halfW &&
            this.pos.y > camY - halfH &&
            this.pos.y < camY + halfH
        );
    }
}
