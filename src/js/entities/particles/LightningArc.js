/**
 * Lightning Arc Visual Effect
 * Draws a jagged lightning line between two points using PixiJS Graphics.
 * Fades out over time with variable timestep support.
 */

import { Entity } from '../Entity.js';
import { colorToPixi } from '../../rendering/colors.js';
import { SIM_STEP_MS } from '../../core/constants.js';

export class LightningArc extends Entity {
    /**
     * @param {number} x1 - Start X position
     * @param {number} y1 - Start Y position
     * @param {number} x2 - End X position
     * @param {number} y2 - End Y position
     * @param {string} color - Lightning color (hex string)
     * @param {number} lifeFrames - Lifetime in reference frames (at SIM_FPS)
     */
    constructor(x1, y1, x2, y2, color = '#0ff', lifeFrames = 12) {
        super(x1, y1);  // Store start pos in Entity base
        this.endX = x2;
        this.endY = y2;
        this.color = color;
        // Life in frames at reference framerate (SIM_FPS = 60)
        this.life = lifeFrames;
        this.maxLife = lifeFrames;
        this._pixiGfx = null;

        // Generate random jagged offsets once (persist for lifetime)
        this.segments = 8;
        this.offsets = [];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = len > 0 ? -dy / len : 0;
        const perpY = len > 0 ? dx / len : 0;

        for (let i = 0; i < this.segments; i++) {
            this.offsets.push((Math.random() - 0.5) * 40);  // Jagged offset
        }
    }

    update(deltaTime = SIM_STEP_MS) {
        super.update(deltaTime);
        // Use dtScale for variable timestep - decrements life proportional to frame time
        // Normalized to 60Hz reference frame (16.67ms)
        const dtScale = deltaTime / 16.67;
        this.life -= dtScale;
        if (this.life <= 0) {
            this.dead = true;
        }
    }

    draw(ctx, pixiResources = null, alpha = 1.0) {
        if (pixiResources?.vectorLayer) {
            let gfx = this._pixiGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiResources.vectorLayer.addChild(gfx);
                this._pixiGfx = gfx;
            }

            gfx.clear();
            // Calculate alpha based on remaining life
            const lifeAlpha = Math.max(0, this.life / this.maxLife);
            gfx.lineStyle(3, colorToPixi(this.color), lifeAlpha);

            // Draw jagged line from start to end
            gfx.moveTo(this.pos.x, this.pos.y);

            const dx = this.endX - this.pos.x;
            const dy = this.endY - this.pos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = len > 0 ? -dy / len : 0;
            const perpY = len > 0 ? dx / len : 0;

            for (let i = 0; i < this.segments; i++) {
                const t = (i + 1) / (this.segments + 1);
                const midX = this.pos.x + dx * t;
                const midY = this.pos.y + dy * t;
                const offset = this.offsets[i];
                gfx.lineTo(midX + perpX * offset, midY + perpY * offset);
            }

            gfx.lineTo(this.endX, this.endY);
        }
    }

    cull() {
        // Hide graphics when off-screen
        if (this._pixiGfx) {
            this._pixiGfx.visible = false;
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        if (this._pixiGfx) {
            try {
                this._pixiGfx.clear();
                if (this._pixiGfx.parent) {
                    this._pixiGfx.parent.removeChild(this._pixiGfx);
                }
                this._pixiGfx.destroy();
            } catch (e) { }
            this._pixiGfx = null;
        }
    }
}
