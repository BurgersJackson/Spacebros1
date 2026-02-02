/**
 * FlagshipGuidedMissile.js
 * Homig missile fired by bosses.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiBulletLayer, pixiCleanupObject, getRenderAlpha } from '../../rendering/pixi-context.js';
import { colorToPixi } from '../../rendering/colors.js';

// Dependency placeholders
let _spawnFieryExplosion = null;
let _spawnParticles = null;
let _updateHealthUI = null;
let _killPlayer = null;
let _emitParticle = null;
let _checkWallCollision = null;

/**
 * Register dependencies from main.js logic.
 */
export function registerFlagshipGuidedMissileDependencies(deps) {
    if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
    if (deps.checkWallCollision) _checkWallCollision = deps.checkWallCollision;
}

export class FlagshipGuidedMissile extends Entity {
    constructor(owner) {
        super(owner.pos.x, owner.pos.y);
        this.owner = owner || null;
        this.t = 0;
        this.radius = 28;
        this.hp = 10;
        this.maxHp = 10;
        // Updated for 60Hz: player speed is ~12, so missiles must be faster. +25% speed.
        this.speed = 13.75;
        this.turnRate = 0.085;
        this.lifeMs = 5000;
        this.angle = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;

        const off = (owner && owner.radius) ? (owner.radius * 0.85 + 14) : 60;
        this.pos.x += Math.cos(this.angle) * off;
        this.pos.y += Math.sin(this.angle) * off;

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
    }

    explode(color = '#fa0') {
        if (this._exploded) return;
        this._exploded = true;
        this.dead = true;
        playSound('explode');
        if (_spawnFieryExplosion) _spawnFieryExplosion(this.pos.x, this.pos.y, 1.2);
    }

    applyDamageToPlayer(amount) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (GameContext.player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                if (GameContext.player.outerShieldSegments[i] > 0) {
                    const absorb = Math.min(remaining, GameContext.player.outerShieldSegments[i]);
                    GameContext.player.outerShieldSegments[i] -= absorb;
                    remaining -= absorb;
                }
            }
        }

        if (GameContext.player.shieldSegments && GameContext.player.shieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.shieldSegments.length && remaining > 0; i++) {
                const absorb = Math.min(remaining, GameContext.player.shieldSegments[i]);
                GameContext.player.shieldSegments[i] -= absorb;
                remaining -= absorb;
            }
        }

        if (remaining > 0) {
            GameContext.player.hp -= remaining;
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 14, '#f00');
            playSound('hit');
            if (_updateHealthUI) _updateHealthUI();
            if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
        } else {
            playSound('shield_hit');
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#0ff');
        }
        GameContext.player.invulnerable = 0;
    }

    takeHit(damage) {
        if (this.dead) return;
        const d = Math.max(0, damage || 0);
        this.hp -= d;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, '#ff0');
        playSound('shield_hit');
        if (this.hp <= 0) this.explode('#ff0');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.lifeMs -= deltaTime;
        if (this.lifeMs <= 0) { this.explode(); return; }
        if (!GameContext.player || GameContext.player.dead) { this.explode(); return; }

        const targetAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate * dtFactor);

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        if (Math.floor(this.t) % 2 === 0) {
            if (_emitParticle) {
                _emitParticle(
                    this.pos.x + (Math.random() - 0.5) * 6,
                    this.pos.y + (Math.random() - 0.5) * 6,
                    -this.vel.x * 0.08 + (Math.random() - 0.5) * 0.6,
                    -this.vel.y * 0.08 + (Math.random() - 0.5) * 0.6,
                    '#fa0',
                    30
                );
            }
        }

        if (_checkWallCollision) _checkWallCollision(this, 0.15);

        // Collide with asteroids / ships: explode and deal damage (splash) to enemies. 
        const splashDamageEnemies = () => {
            const dmg = Math.max(0, Math.ceil(this.hp));
            if (dmg <= 0) return;
            const splashR = 180;
            for (let i = 0; i < GameContext.enemies.length; i++) {
                const e = GameContext.enemies[i];
                if (!e || e.dead) continue;
                const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (d < splashR + (e.radius || 0)) {
                    e.hp -= dmg;
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 10, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                }
            }
        };

        try {
            const nearby = GameContext.asteroidGrid ? GameContext.asteroidGrid.query(this.pos.x, this.pos.y) : [];
            for (let i = 0; i < nearby.length; i++) {
                const ast = nearby[i];
                if (!ast || ast.dead) continue;
                const d = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (d < (ast.radius || 0) + this.radius) {
                    if (typeof ast.break === 'function') ast.break();
                    this.explode('#fa0');
                    splashDamageEnemies();
                    return;
                }
            }
        } catch (e) { }

        for (let i = 0; i < GameContext.enemies.length; i++) {
            const e = GameContext.enemies[i];
            if (!e || e.dead) continue;
            const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (d < (e.radius || 0) + this.radius) {
                this.explode('#fa0');
                splashDamageEnemies();
                return;
            }
        }

        const dP = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dP < GameContext.player.radius + this.radius) {
            const dmg = Math.max(0, Math.ceil(this.hp));
            this.explode('#fa0');
            this.applyDamageToPlayer(dmg);
            GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 10);
            GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 10);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }
            return;
        }

        const rPos = this.getRenderPos(getRenderAlpha());

        if (pixiBulletLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBulletLayer.addChild(container);

                // Setup graphics (One-time)
                const g = new PIXI.Graphics();
                const len = 64;
                const w = 18;

                // Glow Halo
                g.beginFill(0xffaa00, 0.4);
                g.drawEllipse(0, 0, len * 1.2 / 2, w * 1.4 / 2); // Approximate
                g.endFill();

                // Main Body (Gradient approximation)
                g.beginFill(0xffaa00); // Solid color as gradient is hard in Graphics
                g.lineStyle(2, 0x111111);
                g.moveTo(len / 2, 0);
                g.lineTo(-len / 2 + 10, w / 2);
                g.lineTo(-len / 2, 0);
                g.lineTo(-len / 2 + 10, -w / 2);
                g.closePath();
                g.endFill();

                // Fins
                g.lineStyle(0);
                g.beginFill(0xcc3333);
                // Fin 1
                g.moveTo(-len / 2 + 14, w / 2);
                g.lineTo(-len / 2 - 2, w / 2 + 8);
                g.lineTo(-len / 2 + 8, w / 2 - 2);
                g.closePath();
                // Fin 2
                g.moveTo(-len / 2 + 14, -w / 2);
                g.lineTo(-len / 2 - 2, -w / 2 - 8);
                g.lineTo(-len / 2 + 8, -w / 2 + 2);
                g.closePath();
                g.endFill();

                // Engine Glow
                g.beginFill(0xff7800, 0.8);
                g.drawRect(-len / 2 - 10, -5, 14, 10);
                g.endFill();

                container.addChild(g);
                this._pixiGfx = g; // Keep ref if needed
            }

            container.position.set(rPos.x, rPos.y);
            container.rotation = this.angle;
            // No easy HP ring update in this structure without redraw, skipping or could add another Gfx
            return;
        }
    }
}
