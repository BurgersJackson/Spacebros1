/**
 * Shockwave.js
 * Expanding shockwave projectile/effect.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiVectorLayer, pixiCleanupObject, getRenderAlpha } from '../../rendering/pixi-context.js';
import { colorToPixi } from '../../rendering/colors.js';
import { Cruiser } from '../bosses/Cruiser.js';

// Dependency placeholders
let _spawnParticles = null;
let _updateHealthUI = null;

/**
 * Register dependencies from main.js logic.
 */
export function registerShockwaveDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
}

export class Shockwave extends Entity {
    constructor(x, y, damage, maxRadius = 500, opts = {}) {
        super(x, y);
        this.damage = damage;
        this.currentRadius = 10;
        this.maxRadius = maxRadius;
        this.speed = opts.travelSpeed !== undefined ? opts.travelSpeed : 16;
        this.hitList = [];
        this.damagePlayer = !!opts.damagePlayer;
        this.damageBases = !!opts.damageBases;
        this.damageAsteroids = !!opts.damageAsteroids;
        this.damageMissiles = !!opts.damageMissiles;
        this.damageEnemies = opts.damageEnemies !== false; // Default true for backward compatibility
        this.ignoreEntity = opts.ignoreEntity || null;
        this.color = opts.color || '#ff0';
        this.followPlayer = !!opts.followPlayer;
        this.isEnemy = !!opts.isEnemy; // Explicit flag often passed in opts, or derived
        this.damageType = opts.damageType;
        this.isExplosive = opts.isExplosive;
        this.pierceCount = opts.pierceCount || 0;
        this.hasCrit = false;

        this._pixiGfx = null;
        this._pixiPhaseGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        // Calculate time scale for variable framerate support
        const dtFactor = deltaTime / 16.67;

        // Track player position if following
        if (this.followPlayer && GameContext.player && !GameContext.player.dead) {
            this.pos.x = GameContext.player.pos.x;
            this.pos.y = GameContext.player.pos.y;
            // Also update prevPos to prevent interpolation trails
            this.prevPos.x = GameContext.player.pos.x;
            this.prevPos.y = GameContext.player.pos.y;
        }

        // Apply time-scaled expansion
        this.currentRadius += this.speed * dtFactor;
        if (this.currentRadius >= this.maxRadius) this.dead = true;

        const targets = [];
        if (this.damageEnemies) targets.push(...GameContext.enemies);
        if (this.damageBases) targets.push(...GameContext.pinwheels);
        if (GameContext.boss && GameContext.bossActive && !GameContext.boss.dead) targets.push(GameContext.boss);
        if (this.damagePlayer && GameContext.player && !GameContext.player.dead) targets.push(GameContext.player);

        for (let e of targets) {
            if (this.ignoreEntity && e === this.ignoreEntity) continue;
            if (e.dead || this.hitList.includes(e)) continue;
            const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (dist < this.currentRadius + e.radius) {
                if (e === GameContext.player) {
                    if (GameContext.player.takeHit) GameContext.player.takeHit(this.damage);
                    this.hitList.push(e);
                } else {
                    if (e instanceof Cruiser && e.invulnerableTimer > 0) {
                        this.hitList.push(e);
                        continue;
                    }
                    // Critical Strike
                    let damage = this.damage;
                    if (!this.isEnemy && GameContext.player.stats.critChance > 0 && Math.random() < GameContext.player.stats.critChance) {
                        damage *= GameContext.player.stats.critDamage;
                        this.hasCrit = true;
                        if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 8, '#ff0');
                    }

                    e.hp -= damage;
                    // Track area nuke damage if this is from player nuke
                    if (!this.isEnemy && this.damageType === 'area_nuke') {
                        if (!GameContext.damageByWeaponType['area_nuke']) {
                            GameContext.damageByWeaponType['area_nuke'] = 0;
                        }
                        GameContext.damageByWeaponType['area_nuke'] += damage;
                        GameContext.totalDamageDealt += damage;
                    }
                    this.hitList.push(e);
                    playSound('hit');
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 5, this.hasCrit ? '#ffd700' : '#ff0');

                    // Explosive Rounds
                    if (!this.isEnemy && this.isExplosive) {
                        const explodeRadius = GameContext.player.stats.explosiveRadius || 200;
                        const explodeDmg = GameContext.player.stats.explosiveDamage || 30;
                        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 12, '#f80');
                        for (let other of targets) {
                            if (other === e || other.dead || this.hitList.includes(other)) continue;
                            const d = Math.hypot(other.pos.x - this.pos.x, other.pos.y - this.pos.y);
                            if (d < explodeRadius + other.radius) {
                                if (other === GameContext.destroyer) {
                                    const hpBefore = other.hp;
                                    other.hp -= explodeDmg;
                                } else {
                                    other.hp -= explodeDmg;
                                }
                                if (_spawnParticles) _spawnParticles(other.pos.x, other.pos.y, 4, '#f80');
                                if (other.hp <= 0 && typeof other.kill === 'function') other.kill();
                            }
                        }
                    }

                    // Piercing Rounds - allow hitting multiple enemies
                    if (this.pierceCount > 0) {
                        this.pierceCount--;
                        // Don't add to hitList, allowing piercing through enemies
                        // Wait, logic in original was:
                        // if (this.pierceCount > 0) { this.pierceCount--; } else { this.hitList.push(e); }
                        // But I already pushed check logic: "if (e.dead || this.hitList.includes(e)) continue;"
                        // So if I don't add to hit list, I can hit it again next frame?
                        // No, Shockwave expands. If I'm inside the radius, I shouldn't be hit every frame.
                        // The original logic was:
                        // if (this.pierceCount > 0) {
                        //     this.pierceCount--;
                        //     // Don't add to hitList, allowing piercing through enemies
                        // } else {
                        //     this.hitList.push(e);
                        // }
                        // This implies that if pierceCount > 0, we hit this enemy AND continue to hit others?
                        // But if we don't add to hitList, then next frame, we might hit it again?
                        // Actually, the original logic had `this.hitList.push(e);` AFTER the damage block?
                        // Let's re-read the original logic (Step 635).
                        // Line 4502: `this.hitList.push(e);` - Wait, this is called unconditionally before the pierce check?
                        // No, let's look closely at 4502.
                        // Yes, `this.hitList.push(e);` is at 4502.
                        // Then at 4529: `if (this.pierceCount > 0) ...`
                        // AHH, wait.
                        // 4502 is inside the `else` block of `if (e === GameContext.player)`.
                        // So for enemies, it IS added to hitList at 4502.
                        // Then at 4529:
                        // if (this.pierceCount > 0) { this.pierceCount--; } else { this.hitList.push(e); }
                        // This means it's added TWICE? Or was 4502 a mistake in my reading?
                        // Let's re-read lines 4502-4533.
                        // 4502: `this.hitList.push(e);`
                        // ...
                        // 4529: `if (this.pierceCount > 0) { this.pierceCount--; } else { this.hitList.push(e); }`
                        // If it's already in hitList, pushing it again changes nothing (it's an array, not a Set, but duplications don't matter? Wait, `this.hitList.includes(e)` check at top.)
                        // If it is added at 4502, then the check `includes` will return true next frame.
                        // Why the check at 4529?
                        // Maybe the code INTENDED to not add it at 4502?
                        // Or maybe I am misreading where 4502 is.
                        // 4502 is definitely there.
                        // Maybe the "Piercing Rounds" comment logic is flawed in original or I'm misunderstanding.
                        // BUT, I should copy the logic EXACTLY as is to preserve behavior.

                        // Wait, if I add to hitList, it stops hitting THIS enemy.
                        // Piercing usually means the PROJECTILE continues to exist to hit OTHER enemies.
                        // Shockwave hits EVERYTHING in range anyway unless `hitList` excludes them.
                        // So `pierceCount` seems irrelevant for a Shockwave? Shockwaves naturally pierce (they are area of effect).
                        // Maybe this logic was copied from Bullet?
                        // Regardless, I will copy it 1:1.
                        // BUT, there is `this.hitList.push(e)` at 4502.
                        // And another at 4533.
                        // So it gets pushed.
                        // The loop continues to other enemies.
                        // So Shockwave hits everyone once.
                    } else {
                        // Original logic had this block, so I keep it.
                        // this.hitList.push(e); // Added again?
                    }

                    // Combo Meter
                    if (!this.isEnemy && GameContext.player.stats.comboMeter > 0) {
                        GameContext.player.comboStacks = Math.min(GameContext.player.comboStacks + 1, GameContext.player.comboMaxStacks);
                        GameContext.player.lastHitTime = Date.now();
                    }

                    if (e.hp <= 0) {
                        e.kill();
                        // Lifesteal
                        if (!this.isEnemy && GameContext.player.stats.lifestealAmount > 0) {
                            const healAmount = GameContext.player.stats.lifestealAmount;
                            if (GameContext.player.hp < GameContext.player.maxHp) {
                                GameContext.player.hp = Math.min(GameContext.player.maxHp, GameContext.player.hp + healAmount);
                                if (_updateHealthUI) _updateHealthUI();
                                if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#0f0');
                            }
                        }
                    }
                }
            }
        }

        if (this.damageAsteroids) {
            for (let ast of GameContext.environmentAsteroids) {
                if (!ast || ast.dead) continue;
                if (ast.unbreakable) continue;
                if (this.hitList.includes(ast)) continue;
                const dist = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (dist < this.currentRadius + ast.radius) {
                    ast.break();
                    this.hitList.push(ast);
                    if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    playSound('hit');
                }
            }
        }

        if (this.damageMissiles) {
            for (let m of GameContext.guidedMissiles) {
                if (!m || m.dead) continue;
                if (this.hitList.includes(m)) continue;
                const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                if (dist < this.currentRadius + (m.radius || 15)) {
                    if (typeof m.explode === 'function') m.explode('#ff0');
                    m.dead = true;
                    this.hitList.push(m);
                    if (_spawnParticles) _spawnParticles(m.pos.x, m.pos.y, 8, '#f80');
                    playSound('hit');
                }
            }
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

        if (pixiVectorLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                pixiVectorLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.clear();
            const alpha = Math.max(0, 1 - (this.currentRadius / this.maxRadius));
            g.lineStyle(18, colorToPixi(this.color), alpha);
            g.drawCircle(0, 0, this.currentRadius);
            g.endFill(); // Clear lineStyle to prevent ghosting
            g.position.set(rPos.x, rPos.y);
            return;
        }
    }
}
