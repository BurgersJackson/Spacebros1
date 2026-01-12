import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { pixiVectorLayer, pixiCleanupObject } from '../../rendering/pixi-context.js';

let _applyAOEDamageToPlayer = null;
let _emitParticle = null;

export function registerNapalmZoneDependencies(deps) {
    if (deps.applyAOEDamageToPlayer) _applyAOEDamageToPlayer = deps.applyAOEDamageToPlayer;
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
}

export class NapalmZone extends Entity {
    constructor(x, y, radius = 180, lifeMs = 4000, damagePerTick = 0.5) {
        super(x, y);
        this.radius = radius;
        this.lifeMs = lifeMs;
        this.maxLifeMs = lifeMs;
        this.damagePerTick = damagePerTick;
        this.damageCooldown = 200;
        this.damageInterval = 200;
        this.dead = false;
        this._pixiGfx = null;
        this._poolType = 'napalm';
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        this.lifeMs -= deltaTime;
        if (this.lifeMs <= 0) {
            this.kill();
            return;
        }

        if (this.damageCooldown > 0) {
            this.damageCooldown -= deltaTime;
        } else if (GameContext.player && !GameContext.player.dead && GameContext.player.invulnerable <= 0) {
            const dx = GameContext.player.pos.x - this.pos.x;
            const dy = GameContext.player.pos.y - this.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius) {
                if (_applyAOEDamageToPlayer) {
                    _applyAOEDamageToPlayer(this.pos.x, this.pos.y, this.radius, this.damagePerTick);
                }
                this.damageCooldown = this.damageInterval;
                if (_emitParticle && Math.random() < 0.3) {
                    _emitParticle(GameContext.player.pos.x, GameContext.player.pos.y, 0, 0, '#f50', 15);
                }
            }
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiVectorLayer) {
            let gfx = this._pixiGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(gfx);
                this._pixiGfx = gfx;
            } else if (!gfx.parent) {
                pixiVectorLayer.addChild(gfx);
            }

            gfx.clear();
            const lifeRatio = this.lifeMs / this.maxLifeMs;
            const alpha = 0.3 + (lifeRatio * 0.3);
            const pulse = 0.9 + Math.sin(Date.now() * 0.01) * 0.1;

            gfx.beginFill(0xff4400, alpha * 0.3);
            gfx.drawCircle(this.pos.x, this.pos.y, this.radius * pulse);
            gfx.endFill();

            gfx.beginFill(0xff6600, alpha * 0.5);
            gfx.drawCircle(this.pos.x, this.pos.y, this.radius * 0.6 * pulse);
            gfx.endFill();

            gfx.lineStyle(3, 0xff8800, alpha);
            gfx.drawCircle(this.pos.x, this.pos.y, this.radius * pulse);
        }

        if (ctx && !pixiVectorLayer) {
            const lifeRatio = this.lifeMs / this.maxLifeMs;
            const alpha = 0.2 + (lifeRatio * 0.3);
            const pulse = 0.9 + Math.sin(Date.now() * 0.01) * 0.1;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius * 0.5 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
