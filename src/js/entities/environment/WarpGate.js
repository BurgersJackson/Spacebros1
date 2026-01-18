/**
 * WarpGate.js
 * Portal that transports player to warp dimension.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiCleanupObject } from '../../utils/cleanup-utils.js';
import { pixiWorldRoot, getRenderAlpha } from '../../rendering/pixi-context.js';

/**
 * Warp gate portal entry/exit point.
 */
export class WarpGate extends Entity {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    constructor(x, y) {
        super(x, y);
        this.radius = 140;
        this.t = 0;
        this.mode = 'entry';
        this._warpTriggered = false; // Prevent multiple triggers
    }

    /**
     * Update warp gate state.
     * @param {number} deltaTime - Time elapsed in ms
     * @param {Object} options - Update options
     * @param {function} options.getGameNowMs - Get current game time
     * @param {number} options.suppressUntil - Suppress gate until this time
     * @param {function} options.showMessage - Show overlay message
     * @param {function} options.enterWarp - Enter warp maze callback
     */
    update(deltaTime = SIM_STEP_MS, options = {}) {
        if (!GameContext.player || GameContext.player.dead) return;

        if (options.suppressUntil && options.getGameNowMs) {
            if (options.getGameNowMs() < options.suppressUntil) return;
        }

        // Update previous position for interpolation (warp gate doesn't move, but still need this for rendering)
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        const dist = Math.hypot(
            GameContext.player.pos.x - this.pos.x,
            GameContext.player.pos.y - this.pos.y
        );
        
        const threshold = this.radius + GameContext.player.radius;
        
        // Reset trigger flag if player moves away
        if (dist > threshold + 50) {
            this._warpTriggered = false;
            return;
        }

        // Only proceed if player is within range
        if (dist > threshold) return;

        if (GameContext.warpCompletedOnce) {
            if (options.showMessage && !this._warpTriggered) {
                options.showMessage("WARP ALREADY USED THIS SECTOR", '#f80', 1200, 2);
            }
            return;
        }

        if (GameContext.warpZone && GameContext.warpZone.active) return;
        if (GameContext.verticalScrollingZone && GameContext.verticalScrollingZone.active) return;

        // Only trigger once
        if (this._warpTriggered) return;

        this._warpTriggered = true;

        if (options.showMessage) {
            options.showMessage("WARP INITIATED", '#0ff', 1400, 3);
        }
        playSound('contract');

        if (options.enterWarp) {
            options.enterWarp();
        }
    }

    /**
     * Draw the warp gate.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiWorldRoot) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiWorldRoot.addChildAt(container, 1);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center',
                    dropShadow: true,
                    dropShadowColor: '#000000',
                    dropShadowBlur: 4,
                    dropShadowDistance: 0
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const g = this._pixiGfx;
            g.clear();
            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.45;
            const gateColor = 0xff8800;

            // Glow Ring
            g.lineStyle(6, gateColor, 0.35 + pulse);
            g.drawCircle(0, 0, this.radius);

            // Inner Fill
            g.beginFill(gateColor, 0.08);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Text
            const t = this._pixiText;
            if (t) {
                if (this.mode === 'vertical_scrolling') {
                    t.text = 'SCROLL';
                } else {
                    t.text = this.mode === 'exit' ? 'EXIT' : 'WARP';
                }
            }

            return;
        }
    }
}
