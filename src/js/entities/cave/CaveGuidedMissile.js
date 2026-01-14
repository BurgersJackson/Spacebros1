import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';

let _spawnFieryExplosion = null;
let _spawnParticles = null;
let _emitParticle = null;
let _checkWallCollision = null;
let _updateHealthUI = null;
let _killPlayer = null;

export function registerCaveGuidedMissileDependencies(deps) {
    if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
    if (deps.checkWallCollision) _checkWallCollision = deps.checkWallCollision;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
}

export class CaveGuidedMissile extends Entity {
    constructor(owner, opts = {}) {
        super(owner && owner.pos ? owner.pos.x : 0, owner && owner.pos ? owner.pos.y : 0);
        this.owner = owner || null;
        this.t = 0;
        this.radius = opts.radius || 18;
        this.hp = opts.hp || 4;
        this.maxHp = this.hp;
        this.maxDamage = (typeof opts.maxDamage === 'number') ? opts.maxDamage : null;
        // Removed multiplier for 60Hz scaling transparency.
        this.speed = (opts.speed || 11.0);
        this.turnRate = opts.turnRate || 0.11;
        this.life = opts.life || 720;
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
        if (_spawnFieryExplosion) _spawnFieryExplosion(this.pos.x, this.pos.y, 1.0);
    }

    takeHit(damage) {
        if (this.dead) return;
        const d = Math.max(0, damage || 0);
        this.hp -= d;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 4, '#ff0');
        playSound('shield_hit');
        if (this.hp <= 0) this.explode('#ff0');
    }

    applyDamageToPlayer(amount) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (GameContext.player.invulnerable > 0) return;

        // Second Wind - check if invulnerability is active
        if (GameContext.player.stats.secondWindActive > 0) {
            // Already in second wind, skip damage
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#80f');
            return;
        }

        // Evasion Boost - chance to avoid damage entirely
        if (GameContext.player.stats.evasion > 0 && Math.random() < GameContext.player.stats.evasion) {
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#0ff');
            playSound('shield_hit');
            // Reset combo on dodge (optional - can be removed if we want to keep combo on dodge)
            return;
        }

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

            // Thorn Armor - reflect damage back to attacker
            if (GameContext.player.stats.thornArmor > 0 && this.hp) {
                const reflectDamage = Math.ceil(remaining * GameContext.player.stats.thornArmor);
                if (this === GameContext.destroyer || (this.displayName && this.displayName.includes('DESTROYER'))) {
                    const hpBefore = this.hp;
                    this.hp -= reflectDamage;
                    console.log(`[DESTROYER DEBUG] THORN ARMOR REFLECT: ${reflectDamage} damage | HP: ${hpBefore} -> ${this.hp}`);
                } else {
                    this.hp -= reflectDamage;
                }
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, '#f80');
                if (this.hp <= 0 && typeof this.kill === 'function') {
                    this.kill();
                }
            }

            // Second Wind - grant invulnerability after taking damage
            if (GameContext.player.stats.secondWindFrames > 0) {
                GameContext.player.stats.secondWindActive = GameContext.player.stats.secondWindFrames;
                if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#80f');
            }

            // Reset combo meter when taking damage
            if (GameContext.player.stats.comboMeter > 0) {
                GameContext.player.comboStacks = 0;
            }
            GameContext.player.lastDamageTakenTime = Date.now();

            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#f00');
            playSound('hit');
            if (_updateHealthUI) _updateHealthUI();
            if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
        } else {
            playSound('shield_hit');
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#0ff');
        }
        GameContext.player.invulnerable = 5;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        this.life -= dtFactor;
        if (this.life <= 0) { this.explode(); return; }
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

        if (_checkWallCollision) _checkWallCollision(this, 0.12);

        // Collide with asteroids / ships: explode and deal damage (splash) to enemies. 
        const splashDamageEnemies = () => {
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            if (dmg <= 0) return;
            const splashR = 160;
            for (let i = 0; i < GameContext.enemies.length; i++) {
                const e = GameContext.enemies[i];
                if (!e || e.dead) continue;
                const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (d < splashR + (e.radius || 0)) {
                    e.hp -= dmg;
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 8, '#fa0');
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
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            this.explode('#fa0');
            this.applyDamageToPlayer(dmg);
            GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 8);
            GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 8);
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const z = GameContext.currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#fa0';
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

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = `rgba(255, 120, 0, ${0.35 + Math.random() * 0.45})`;
        ctx.fillRect(-32, -4, 10, 8);
        ctx.globalAlpha = 1;

        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.save();
        ctx.rotate(-this.angle);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = 'rgba(255,255,0,0.55)';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}
