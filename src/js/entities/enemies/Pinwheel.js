/**
 * Pinwheel.js
 * Stationary spinning base enemy.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';

import {
    pixiBaseLayer,
    pixiVectorLayer,
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureBaseScales,
    pixiCleanupObject,
    getRenderAlpha
} from '../../rendering/pixi-context.js';

// Dependency placeholders
let _spawnParticles = null;
let _checkDespawn = null;
let _spawnSmoke = null;
let _spawnBarrelSmoke = null;
let _spawnLargeExplosion = null;
let _awardNuggetsInstant = null;

/**
 * Register dependencies from main.js logic.
 */
export function registerPinwheelDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.checkDespawn) _checkDespawn = deps.checkDespawn;
    if (deps.spawnSmoke) _spawnSmoke = deps.spawnSmoke;
    if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class Pinwheel extends Entity {
    constructor(x, y, type = 'standard') {
        super(0, 0);
        this.pos.x = x;
        this.pos.y = y;
        this.type = type;
        this.radius = 84; // 70 * 1.2 (20% increase for collision sphere)
        this.hp = 10 + (GameContext.difficultyTier - 1) * 5;
        this.shootTimer = 75; // 150 / 2
        this.angle = 0;
        this.turretAngle = 0;
        this.shieldRadius = 130; // outer shield (moved out from 110) - unchanged
        const BASE_SHIELD_GAP = 35;
        // Keep inner shield radius unchanged (was 95 = max(70+15, 130-35))
        this.innerShieldRadius = 95;
        this.aggro = false;

        let outerCount = 24;
        let outerHp = 1;
        let innerCount = 0;
        let innerHp = 0;

        if (GameContext.difficultyTier === 1) { outerCount = 12; outerHp = 1; }
        else if (GameContext.difficultyTier === 2) { outerCount = 16; outerHp = 1; }
        else if (GameContext.difficultyTier === 3) { outerCount = 24; outerHp = 1; }
        else if (GameContext.difficultyTier === 4) { outerCount = 24; outerHp = 2; innerCount = 8; innerHp = 1; }
        else if (GameContext.difficultyTier === 5) { outerCount = 24; outerHp = 2; innerCount = 12; innerHp = 2; }
        else if (GameContext.difficultyTier >= 6) {
            outerCount = 24;
            outerHp = 3 + (GameContext.difficultyTier - 6);
            innerCount = 16 + (GameContext.difficultyTier - 6);
            innerHp = 2 + Math.floor((GameContext.difficultyTier - 6) / 2);
        }

        if (type === 'heavy') {
            this.hp *= 1.5;
            outerHp = Math.ceil(outerHp * 1.5);
            innerHp = Math.ceil(innerHp * 1.5);
            this.shootTimer = 60; // 120 / 2
        } else if (type === 'rapid') {
            this.hp *= 0.7;
            outerHp = Math.max(1, Math.floor(outerHp * 0.8));
            this.shootTimer = 15; // 30 / 2
        }

        this.maxShieldHp = outerHp;
        this.shieldSegments = new Array(outerCount).fill(outerHp);
        this.shieldRotation = 0;

        this.innerShieldSegments = [];
        if (innerCount > 0) {
            this.innerShieldSegments = new Array(innerCount).fill(innerHp);
        }
        this.innerShieldRotation = 0;

        const angle = Math.random() * Math.PI * 2;
        let speed = 0.2 + Math.random() * 0.3;
        if (type === 'heavy') speed *= 0.5;
        if (type === 'rapid') speed *= 1.5;

        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;

        this.freezeTimer = 0;
        this.freezeCooldown = 0;
        this.shieldsDirty = true;
        this._pixiInnerGfx = null;
        this._pixiContainer = null;
        this._pixiHullSpr = null;
        this._pixiTurretContainer = null;
        this._pixiTurretBaseSpr = null;
        this._pixiBarrelSpr = null;
        this._pixiGfx = null;
        this._pixiDebugGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        // Save previous position for interpolation (required for fixed timestep rendering)
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        const dtFactor = deltaTime / 16.67;

        // Stasis Field Logic (Freeze)
        if (this.freezeTimer > 0) {
            this.freezeTimer -= dtFactor;
            this.vel.x = 0;
            this.vel.y = 0;
            // Skip logic when frozen
        } else if (GameContext.player.stats.slowField > 0) {
            if (this.freezeCooldown > 0) this.freezeCooldown -= dtFactor;

            const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
            if (dist < GameContext.player.stats.slowField && this.freezeCooldown <= 0) {
                this.freezeTimer = GameContext.player.stats.slowFieldDuration;
                this.freezeCooldown = this.freezeTimer + 120; // 2s immunity after freeze
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
            }
        }

        if (this.freezeTimer > 0) {
            super.update();
            return;
        }

        if (GameContext.player && !GameContext.player.dead) {

            const dx = GameContext.player.pos.x - this.pos.x;
            const dy = GameContext.player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            // Keep distance from active cruiser boss
            let dreadAvoidX = 0, dreadAvoidY = 0;
            if (GameContext.bossActive && GameContext.boss && GameContext.boss.isCruiser && !GameContext.boss.dead) {
                const bdx = GameContext.boss.pos.x - this.pos.x;
                const bdy = GameContext.boss.pos.y - this.pos.y;
                const bdist = Math.hypot(bdx, bdy);
                if (bdist < 200) {
                    dreadAvoidX = -(bdx / (bdist || 1)) * 0.2;
                    dreadAvoidY = -(bdy / (bdist || 1)) * 0.2;
                }
            }

            // Avoid bunching with other bases
            for (let b of GameContext.pinwheels) {
                if (b === this || b.dead) continue;
                const bx = b.pos.x - this.pos.x;
                const by = b.pos.y - this.pos.y;
                const bdist = Math.hypot(bx, by);
                if (bdist > 0 && bdist < 400) {
                    const repulse = (400 - bdist) * 0.0005 * dtFactor;
                    this.vel.x -= (bx / bdist) * repulse;
                    this.vel.y -= (by / bdist) * repulse;
                }
            }

            // Aggression ramp: ease-in early, then match prior behavior.
            let elapsed = Date.now() - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;
            const rampT = Math.max(0, Math.min(1, elapsedMinutes / 10));
            const chaseAccel = (0.12 + 0.08 * rampT) * dtFactor;
            const speedRamp = (0.85 + 0.15 * rampT);

            if (dist > 250) {
                const angle = Math.atan2(dy, dx);
                this.vel.x += Math.cos(angle) * chaseAccel;
                this.vel.y += Math.sin(angle) * chaseAccel;
            }
            this.vel.x += dreadAvoidX * dtFactor;
            this.vel.y += dreadAvoidY * dtFactor;
            const speed = this.vel.mag();
            let maxSpeed = this.type === 'heavy' ? 3.0 : (this.type === 'rapid' ? 6.0 : 5.0); // doubled for 60Hz
            maxSpeed *= speedRamp;
            if (speed > maxSpeed) this.vel.mult(maxSpeed / speed);
        } else {
            // Friction scaled by time
            this.vel.mult(Math.pow(0.99, dtFactor));
        }

        this.pos.add(this.vel);
        if (_checkDespawn) _checkDespawn(this, 6000);
        this.shieldRotation += 0.015 * dtFactor; // 0.01 * 1.5 (50% increase)
        this.innerShieldRotation -= 0.0225 * dtFactor; // 0.015 * 1.5 (50% increase)

        if (this.hp <= 5 && Math.random() < 0.1 && _spawnSmoke) _spawnSmoke(this.pos.x, this.pos.y, 1);

        if (GameContext.player && !GameContext.player.dead) {
            // Start easier: bases ramp up aggression over the first minutes.
            const now = Date.now();
            let elapsed = now - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;
            const rampT = Math.max(0, Math.min(1, elapsedMinutes / 10));
            const cooldownMult = 1.35 - 0.35 * rampT; // slower early, normal later

            let px = GameContext.player.pos.x, py = GameContext.player.pos.y;
            const dx = px - this.pos.x;
            const dy = py - this.pos.y;
            const dist = Math.hypot(dx, dy);
            this.angle = Math.atan2(dy, dx);
            this.turretAngle = Math.atan2(dy, dx);
            this.angle += 0.002;

            const fireRange = 1100 + 400 * rampT;
            if (dist < fireRange) {
                this.shootTimer -= dtFactor;
                if (this.shootTimer <= 0) {
                    const shootAngle = this.turretAngle;
                    if (this.type === 'heavy') {
                        for (let i = -1; i <= 1; i++) {
                            const a = shootAngle + i * 0.15;
                            const bx = this.pos.x + Math.cos(a) * 75;
                            const by = this.pos.y + Math.sin(a) * 75;
                            GameContext.bullets.push(new Bullet(bx, by, a, 8, { owner: 'enemy', damage: 3, life: 480, color: '#fa0' }));
                            if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, a);
                        }
                        playSound('heavy_shoot');
                        this.shootTimer = Math.round(60 * cooldownMult);
                    } else if (this.type === 'rapid') {
                        const spread = (Math.random() - 0.5) * 0.1;
                        const a = shootAngle + spread;
                        const bx = this.pos.x + Math.cos(a) * 75;
                        const by = this.pos.y + Math.sin(a) * 75;
                        GameContext.bullets.push(new Bullet(bx, by, a, 14, { owner: 'enemy', damage: 1, life: 180, color: '#0ff' }));
                        if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, a);
                        playSound('rapid_shoot');
                        this.shootTimer = Math.round(15 * cooldownMult);
                    } else {
                        const damage = 2;
                        // 3-sided star shooting pattern
                        for (let i = 0; i < 3; i++) {
                            const a = this.angle + i * (Math.PI * 2 / 3);
                            const bx = this.pos.x + Math.cos(a) * 70;
                            const by = this.pos.y + Math.sin(a) * 70;
                            GameContext.bullets.push(new Bullet(bx, by, a, 8, { owner: 'enemy', damage: damage, life: 240 }));
                            if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, a);
                        }
                        playSound('shoot');
                        this.shootTimer = Math.round((GameContext.difficultyTier >= 2 ? 40 : 75) * cooldownMult);
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }
            if (this._pixiGfx) {
                try { this._pixiGfx.destroy(true); } catch (e) { }
                this._pixiGfx = null;
            }
            if (this._pixiDebugGfx) {
                try { this._pixiDebugGfx.destroy(true); } catch (e) { }
                this._pixiDebugGfx = null;
            }
            return;
        }

        // Interpolate position for smooth rendering on high refresh displays
        const currentAlpha = getRenderAlpha();
        const rPos = this.getRenderPos(currentAlpha);

        // Pixi fast path (base hull + shields)
        if (pixiBaseLayer && pixiTextures) {
            const baseKey = (this.type === 'heavy') ? 'base_heavy' : (this.type === 'rapid' ? 'base_rapid' : 'base_standard');
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBaseLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures[baseKey]);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;

                // Base turret visuals removed (still shoots, but no turret graphic).
                this._pixiTurretContainer = null;
                this._pixiTurretBaseSpr = null;
                this._pixiBarrelSpr = null;
            } else if (!container.parent) {
                pixiBaseLayer.addChild(container);
            }
            container.visible = true;

            // Clean up any older turret sprites from a previous version.
            if (this._pixiTurretContainer) {
                try { this._pixiTurretContainer.destroy({ children: true }); } catch (e) { }
                this._pixiTurretContainer = null;
            }
            this._pixiTurretBaseSpr = null;
            this._pixiBarrelSpr = null;

            // Keep hull texture/anchor/scale in sync (important for late-loaded external images).
            if (this._pixiHullSpr) {
                const tex = pixiTextures[baseKey];
                const a = pixiTextureAnchors[baseKey] || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.texture = tex;
                this._pixiHullSpr.anchor.set((a && a.x != null) ? a.x : 0.5, (a && a.y != null) ? a.y : 0.5);
                // Apply 20% size increase to sprite graphic (1.2x multiplier)
                const baseScale = pixiTextureBaseScales[baseKey] || 1;
                this._pixiHullSpr.scale.set(baseScale * 1.2);
            }

            const jitter = (this.hp <= 2) ? 2 : 0;
            const jx = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            const jy = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            container.position.set(rPos.x + jx, rPos.y + jy);

            if (this._pixiHullSpr) {
                this._pixiHullSpr.rotation = this.angle || 0;
                this._pixiHullSpr.tint = (this.freezeTimer > 0) ? 0x00ffff : 0xffffff;
            }

            // Shields (Graphics)
            if (pixiVectorLayer) {
                const shieldColor = 0x00ff00; // bright green outer
                const innerColor = 0x006400; // dark green inner
                const hasOuter = (this.shieldSegments && this.shieldSegments.length > 0);
                const hasInner = (this.innerShieldSegments && this.innerShieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner);

                if (needs) {
                    // --- Outer Shield ---
                    let gfx = this._pixiGfx;
                    if (hasOuter) {
                        if (!gfx) {
                            gfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(gfx);
                            this._pixiGfx = gfx;
                            this.shieldsDirty = true;
                        } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

                        gfx.position.set(rPos.x, rPos.y);
                        gfx.rotation = this.shieldRotation || 0;
                    } else if (gfx) {
                        try { gfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                        gfx = null;
                    }

                    // --- Inner Shield ---
                    let innerGfx = this._pixiInnerGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(rPos.x, rPos.y);
                        innerGfx.rotation = this.innerShieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                        innerGfx = null;
                    }

                    if (this.shieldsDirty) {
                        // Outer Rebuild
                        if (gfx && hasOuter) {
                            gfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    gfx.lineStyle(4, shieldColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * segAngle + 0.05;
                                    const a1 = (i + 1) * segAngle - 0.05;
                                    gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    gfx.arc(0, 0, this.shieldRadius, a0, a1);
                                }
                            }
                        }

                        // Inner Rebuild
                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const innerCount = this.innerShieldSegments.length;
                            const innerAngle = (Math.PI * 2) / innerCount;
                            for (let i = 0; i < innerCount; i++) {
                                const v = this.innerShieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    innerGfx.lineStyle(3, innerColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * innerAngle + 0.05;
                                    const a1 = (i + 1) * innerAngle - 0.05;
                                    innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                                    innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                                }
                            }
                        }

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiInnerGfx) {
                        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                    }
                }
            }

            // Debug visualization for Ctrl+H
            if (pixiVectorLayer && typeof GameContext.DEBUG_COLLISION !== 'undefined' && GameContext.DEBUG_COLLISION) {
                let debugGfx = this._pixiDebugGfx;
                if (!debugGfx) {
                    debugGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(debugGfx);
                    this._pixiDebugGfx = debugGfx;
                } else if (!debugGfx.parent) {
                    pixiVectorLayer.addChild(debugGfx);
                }

                debugGfx.visible = true;
                debugGfx.clear();
                debugGfx.position.set(rPos.x, rPos.y);

                // Draw hull collision radius (green)
                debugGfx.lineStyle(3, 0x00FF00, 0.8);
                debugGfx.drawCircle(0, 0, this.radius);

                // Draw outer shield radius (cyan) if shields exist
                if (this.shieldSegments && this.shieldSegments.length > 0) {
                    const hasActiveOuter = this.shieldSegments.some(s => s > 0);
                    debugGfx.lineStyle(2, hasActiveOuter ? 0x00FFFF : 0x888888, hasActiveOuter ? 0.6 : 0.3);
                    debugGfx.drawCircle(0, 0, this.shieldRadius);
                }

                // Draw inner shield radius (magenta) if inner shields exist
                if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
                    const hasActiveInner = this.innerShieldSegments.some(s => s > 0);
                    debugGfx.lineStyle(2, hasActiveInner ? 0xFF00FF : 0x888888, hasActiveInner ? 0.6 : 0.3);
                    debugGfx.drawCircle(0, 0, this.innerShieldRadius);
                }
            } else if (this._pixiDebugGfx) {
                if (this._pixiDebugGfx.parent) {
                    this._pixiDebugGfx.visible = false;
                }
            }

            return;
        }

    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        playSound('base_explode');

        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);

        // Award nuggets directly: 5 nuggets
        if (_awardNuggetsInstant) _awardNuggetsInstant(5, { noSound: false, sound: 'coin' });
    }
}
