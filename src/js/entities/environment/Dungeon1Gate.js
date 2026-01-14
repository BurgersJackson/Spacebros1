/**
 * Dungeon1Gate.js
 * Portal that transports player to Dungeon 1.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiCleanupObject } from '../../utils/cleanup-utils.js';
import { pixiWorldRoot } from '../../rendering/pixi-context.js';

/**
 * Dungeon 1 gate portal entry point.
 */
export class Dungeon1Gate extends Entity {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    constructor(x, y) {
        super(x, y);
        this.radius = 140;
        this.t = 0;
        this.mode = 'entry';
    }

    /**
     * Update dungeon gate state.
     * @param {number} deltaTime - Time elapsed in ms
     * @param {Object} options - Update options
     * @param {function} options.showMessage - Show overlay message
     * @param {function} options.enterDungeon - Enter dungeon callback
     */
    update(deltaTime = SIM_STEP_MS, options = {}) {
        if (!GameContext.player || GameContext.player.dead) return;

        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        const dist = Math.hypot(
            GameContext.player.pos.x - this.pos.x,
            GameContext.player.pos.y - this.pos.y
        );
        if (dist > this.radius + GameContext.player.radius) return;

        if (GameContext.dungeon1CompletedOnce) {
            if (options.showMessage) {
                options.showMessage("DUNGEON ALREADY CLEARED", '#f80', 1200, 2);
            }
            return;
        }

        if (GameContext.dungeon1Zone && GameContext.dungeon1Zone.active) return;

        if (options.showMessage) {
            options.showMessage("ENTERING DUNGEON 1...", '#f80', 1400, 3);
        }
        playSound('contract');

        if (options.enterDungeon) {
            options.enterDungeon();
        }
    }

    /**
     * Draw the dungeon gate.
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
            t.text = 'DUNGEON';

            return;
        }
    }
}
