import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import { pixiCleanupObject } from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _emitParticle = null;

export function registerCaveRockfallDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
}

export class CaveRockfall extends Entity {
    constructor(x, y, width = 1600, closeSide = 'left') {
        super(x, y);
        this.width = width;
        this.closeSide = closeSide; // left | right | center 
        this.radius = 1;
        this.state = 'idle'; // idle | warn | fallen 
        this.t = 0;
        this.timer = 0;
        this.segments = [];
    }
    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'warn';
        this.timer = 90;
        showOverlayMessage("ROCKFALL INCOMING", '#ff0', 900, 1);
    }
    fall() {
        if (this.state === 'fallen') return;
        this.state = 'fallen';
        this.timer = 0;
        this.segments = [];
        if (!GameContext.caveLevel) return;
        const b = GameContext.caveLevel.boundsAt(this.pos.y);
        const cx = (b.left + b.right) * 0.5;
        let left = b.left + 60;
        let right = b.right - 60;
        if (this.closeSide === 'left') right = Math.min(right, cx - 260);
        else if (this.closeSide === 'right') left = Math.max(left, cx + 260);
        else { left = cx - this.width * 0.5; right = cx + this.width * 0.5; }
        left = Math.max(b.left + 60, left);
        right = Math.min(b.right - 60, right);
        const n = 18;
        const step = (right - left) / n;
        for (let i = 0; i < n; i++) {
            const x0 = left + i * step;
            const x1 = left + (i + 1) * step;
            const j0 = (Math.random() - 0.5) * 70;
            const j1 = (Math.random() - 0.5) * 70;
            this.segments.push({ x0, y0: this.pos.y + j0, x1, y1: this.pos.y + j1, kind: 'rockfall' });
        }
        if (_spawnParticles) _spawnParticles(cx, this.pos.y, 50, '#888');
        playSound('explode');
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.player || GameContext.player.dead) return;
        if (this.state === 'idle') {
            const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
            if (d < 2200) this.trigger();
        } else if (this.state === 'warn') {
            this.timer -= dtFactor;
            if (this.timer <= 0) this.fall();
            // Falling debris visuals
            if (Math.floor(this.t) % 3 === 0) {
                if (_emitParticle) _emitParticle(this.pos.x + (Math.random() - 0.5) * 700, this.pos.y - 800 + Math.random() * 400, (Math.random() - 0.5) * 0.8, 3 + Math.random() * 2, '#888', 50);
            }
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const z = GameContext.currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0xffff00, 0.25 + Math.abs(Math.sin(this.t * 0.2)) * 0.25);
                // Simulate dashed line
                // g.moveTo(-900, 0); g.lineTo(900, 0);
                // Manual dash
                let dx = -900;
                while (dx < 900) {
                    g.moveTo(dx, 0);
                    g.lineTo(Math.min(900, dx + 20), 0);
                    dx += 40;
                }
            }
            else if (this.state === 'fallen' && this.segments && this.segments.length) {
                // Thick blue background
                g.lineStyle(16, 0x003764, 0.9);
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    // Segments coordinates are world space (x0, y0).
                    // Container is at this.pos.x, this.pos.y.
                    // Need to transform to local.
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }

                // Neon glow
                // Pixi allows multiple line styles on one path? No.
                // Re-iterate for glow pass.
                g.lineStyle(3, 0x8cf0ff, 0.75); // rgba(140, 240, 255, 0.75)
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }
            } else {
                container.visible = false;
            }

            return;
        }
    }
}
