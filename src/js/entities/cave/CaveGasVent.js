import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiCleanupObject } from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _updateHealthUI = null;
let _killPlayer = null;

export function registerCaveGasVentDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
}

export class CaveGasVent extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 1260;
        this.t = 0;
        this.state = 'off'; // off | warn | on 
        this.timer = 180 + Math.floor(Math.random() * 120);
        this.damageCd = 0;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.timer -= dtFactor;
        if (this.timer <= 0) {
            if (this.state === 'off') { this.state = 'warn'; this.timer = 60; }
            else if (this.state === 'warn') { this.state = 'on'; this.timer = 140; }
            else { this.state = 'off'; this.timer = 220 + Math.floor(Math.random() * 160); }
        }
        if (this.damageCd > 0) this.damageCd -= deltaTime / 16.67;
        if (!GameContext.player || GameContext.player.dead) return;
        if (this.state !== 'on') return;
        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (d > this.radius + GameContext.player.radius) return;
        // Slow the ship and tick damage (forces movement). 
        player.caveSlowFrames = Math.max(GameContext.player.caveSlowFrames || 0, 18);
        GameContext.player.caveSlowMult = 0.62;
        if (this.damageCd <= 0 && GameContext.player.invulnerable <= 0) {
            GameContext.player.hp -= 1;
            this.damageCd = 40;
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#6f6');
            playSound('hit');
            if (_updateHealthUI) _updateHealthUI();
            if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
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

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0x78ff78, 0.35);
                // Dashed? Simulate with dots or low alpha solid
                g.drawCircle(0, 0, this.radius);
            } else if (this.state === 'on') {
                g.beginFill(0x50ff50, 0.08 + pulse * 0.10);
                g.drawCircle(0, 0, this.radius);
                g.endFill();
            } else {
                container.visible = false;
            }

            return;
        }
    }
}
