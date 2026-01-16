import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { FlagshipGuidedMissile } from '../projectiles/FlagshipGuidedMissile.js';
import { ClusterBomb } from '../projectiles/ClusterBomb.js';
import { NapalmZone } from '../projectiles/NapalmZone.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import {
    pixiBossLayer,
    pixiVectorLayer,
    pixiTextures,
    pixiTextureAnchors,
    pixiCleanupObject,
    getRenderAlpha
} from '../../rendering/pixi-context.js';

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _spawnBarrelSmoke = null;
let _awardNuggetsInstant = null;

export function registerDestroyerDependencies(deps) {
    if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class Destroyer extends Entity {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 4000;
        super(GameContext.player.pos.x + Math.cos(angle) * dist, GameContext.player.pos.y + Math.sin(angle) * dist);
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        this.displayName = "DESTROYER";

        this.visualRadius = Math.floor(520 * 0.65) * 2 * 1.5;
        this.radius = Math.round(this.visualRadius * 0.5);
        this.collisionRadius = this.radius;
        this.hp = 300;
        this.maxHp = 300;

        this.roamSpeed = 1.5;
        this.roamAngle = Math.random() * Math.PI * 2;
        this.angle = this.roamAngle;
        this.roamInterval = 900 + Math.floor(Math.random() * 600);
        this.roamTimer = this.roamInterval;
        this.turnSpeed = 0.008;
        this.baseTurnSpeed = 0.008;
        this.farTurnSpeed = 0.05;
        this.chaseDistance = 8000;

        this.maxShieldHp = 999;
        this.shieldSegments = new Array(60).fill(0);
        this.innerShieldSegments = new Array(50).fill(0);
        for (let i = 0; i < 60; i += 2) {
            this.shieldSegments[i] = 999;
        }
        for (let i = 0; i < 50; i += 2) {
            this.innerShieldSegments[i] = 999;
        }
        this.shieldRadius = Math.round(this.visualRadius * 0.85);
        this.innerShieldRadius = Math.round(this.visualRadius * 0.78);
        this.shieldRotation = 0;
        this.innerShieldRotation = 0;
        this.shieldsDirty = true;
        this.invulnerable = 0;
        this.invincibilityCycle = {
            unlocked: true,
            state: 'ready',
            timer: 0,
            stats: { duration: 180, cooldown: 600, regen: false }
        };

        this.turretReload = 1000;
        this.t = 0;

        this.turretLocalOffsets = [
            { x: 0, y: -0.35 }
        ];

        this.ringAttackTimer = 5000;
        this.guidedMissileTimer = 2000;

        this.tractorBeamActive = false;
        this.tractorBeamRadius = 3000;
        this.tractorBeamTextShown = false;

        this.hullDefinition = [
            { x: -110, y: 0, r: 120 },
            { x: 0, y: 0, r: 120 },
            { x: 110, y: 0, r: 120 }
        ];
        this.hullScale = (this.visualRadius / 340);

        this.battleStartTime = Date.now();
        this.escalationPhase = 1;
        this.escalationMultiplier = 1.0;

        // this._firstDraw = true; // No longer needed with prevPos init
    }

    getEscalationPhase() {
        if (this.dead) return 1;
        const elapsed = Date.now() - this.battleStartTime;
        if (elapsed >= 120000) return 3;
        if (elapsed >= 60000) return 2;
        return 1;
    }

    getEscalationMultiplier() {
        return this.getEscalationPhase() === 3 ? 1.6 : (this.getEscalationPhase() === 2 ? 1.3 : 1.0);
    }

    hitTestCircle(x, y, r) {
        if (this.dead) return false;
        const dx = x - this.pos.x;
        const dy = y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        const broadRadius = this.radius + r;
        if (distSq > broadRadius * broadRadius) return false;

        const angle = -this.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        for (const circle of this.hullDefinition) {
            const cx = circle.x * this.hullScale;
            const cy = circle.y * this.hullScale;
            const cr = circle.r * this.hullScale;
            const cdx = localX - cx;
            const cdy = localY - cy;
            if (cdx * cdx + cdy * cdy < (cr + r) * (cr + r)) return true;
        }
        return false;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        const playerAlive = GameContext.player && !GameContext.player.dead;
        const distToPlayer = playerAlive ? Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y) : 0;
        if (playerAlive && distToPlayer > this.chaseDistance) {
            this.roamAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
            this.turnSpeed = this.farTurnSpeed;
        } else {
            this.turnSpeed = this.baseTurnSpeed;
            if (this.roamTimer <= 0) {
                const drift = (Math.random() - 0.5) * 0.35;
                this.roamAngle = (this.angle || 0) + drift;
                this.roamTimer = this.roamInterval;
            }
        }

        let angleDiff = this.roamAngle - (this.angle || 0);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const turnStep = this.turnSpeed * dtFactor;
        if (Math.abs(angleDiff) < turnStep) this.angle = this.roamAngle;
        else this.angle += Math.sign(angleDiff) * turnStep;

        this.vel.x = Math.cos(this.angle || 0) * this.roamSpeed;
        this.vel.y = Math.sin(this.angle || 0) * this.roamSpeed;
        super.update(deltaTime);

        const distFromCenter = Math.hypot(this.pos.x, this.pos.y);
        if (distFromCenter > 15000) {
            this.roamAngle = Math.atan2(-this.pos.y, -this.pos.x);
        }

        this.shieldRotation += 0.003 * dtFactor;
        this.innerShieldRotation -= 0.0036 * dtFactor;

        if (this.invincibilityCycle && this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtFactor;

            if (this.invincibilityCycle.state === 'ready') {
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2;
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'cooldown';
                    this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
                }
            } else if (this.invincibilityCycle.state === 'cooldown') {
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'ready';
                }
            }
        }

        const phase = this.getEscalationPhase();
        const mult = this.getEscalationMultiplier();
        if (playerAlive) {
            const dist = distToPlayer;

            if (dist < 3200) {
                this.turretReload -= deltaTime * mult;
                if (this.turretReload <= 0) {
                    this.fireTurrets();
                    this.turretReload = 1000;
                }

                this.ringAttackTimer -= deltaTime * mult;
                if (this.ringAttackTimer <= 0) {
                    this.fireRing(16, 8.0, 8, '#ff0');
                    this.ringAttackTimer = (this.hp < this.maxHp * 0.5) ? 2000 : 5000;
                    if (phase >= 3) {
                        this.spawnNapalmZone();
                    }
                }
            }

            this.guidedMissileTimer -= deltaTime * mult;
            if (this.guidedMissileTimer <= 0) {
                if (phase >= 2) {
                    this.fireClusterBomb();
                } else {
                    GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
                }
                this.guidedMissileTimer = 2000;
            }
        }

        if (!this.tractorBeamActive && this.hp < this.maxHp * 0.8) {
            this.tractorBeamActive = true;
            if (!this.tractorBeamTextShown) {
                showOverlayMessage("You are caught in Tractor Beam", '#0ff', 3000);
                this.tractorBeamTextShown = true;
            }
        }

        if (this.tractorBeamActive && playerAlive) {
            const dx = GameContext.player.pos.x - this.pos.x;
            const dy = GameContext.player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            if (dist > this.tractorBeamRadius) {
                const angle = Math.atan2(dy, dx);
                GameContext.player.pos.x = this.pos.x + Math.cos(angle) * (this.tractorBeamRadius - 5);
                GameContext.player.pos.y = this.pos.y + Math.sin(angle) * (this.tractorBeamRadius - 5);

                const dot = GameContext.player.vel.x * Math.cos(angle) + GameContext.player.vel.y * Math.sin(angle);
                if (dot > 0) {
                    GameContext.player.vel.x *= 0.1;
                    GameContext.player.vel.y *= 0.1;
                }
            }
        }

        if (this.invulnerable > 0) {
            this.invulnerable -= dtFactor;
        }
    }

    fireTurrets() {
        const baseAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        const muzzle = this.visualRadius * 0.45;
        const tx = this.pos.x + Math.cos(baseAngle) * muzzle;
        const ty = this.pos.y + Math.sin(baseAngle) * muzzle;
        const spread = 0.18;
        const bulletSpeed = 14.96 * 0.7;
        const bulletRadius = 15 * 0.5;

        let angles;
        if (this.hp < this.maxHp * 0.5) {
            angles = [baseAngle - spread * 2, baseAngle - spread, baseAngle, baseAngle + spread, baseAngle + spread * 2];
        } else {
            angles = [baseAngle - spread, baseAngle, baseAngle + spread];
        }

        for (const a of angles) {
            const b = new Bullet(tx, ty, a, bulletSpeed, { owner: 'enemy', damage: 10, radius: bulletRadius, color: '#f80' });
            b.life = Math.round(b.life * 1.25);
            GameContext.bullets.push(b);
        }
        if (_spawnBarrelSmoke) _spawnBarrelSmoke(tx, ty, baseAngle);
        playSound('rapid_shoot');
    }

    fireRing(n, speed, dmg, color) {
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const b = new Bullet(this.pos.x, this.pos.y, a, speed, { owner: 'enemy', damage: dmg, radius: 6, color });
            b.life = 140;
            GameContext.bullets.push(b);
        }
        playSound('shotgun');
    }

    fireClusterBomb() {
        const angle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        const bomb = new ClusterBomb(this.pos.x, this.pos.y, angle, this, 4, 350);
        GameContext.bullets.push(bomb);
        playSound('rapid_shoot');
    }

    spawnNapalmZone() {
        const zone = new NapalmZone(GameContext.player.pos.x, GameContext.player.pos.y, 180, 4500, 0.6);
        GameContext.napalmZones.push(zone);
    }

    takeHit(dmg = 1) {
        if (this.dead || this.invulnerable > 0) return false;
        const hpBefore = this.hp;
        this.hp -= dmg;
        console.log(`[DESTROYER DEBUG] takeHit(): ${dmg} damage | HP: ${hpBefore} -> ${this.hp} | Invulnerable: ${this.invulnerable}`);
        console.trace('takeHit() call stack:');
        playSound('hit');
        if (this.hp <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiTractorGfx) {
            try { this._pixiTractorGfx.destroy(true); } catch (e) { }
            this._pixiTractorGfx = null;
        }
        // Clean up health bar and name text
        if (this._pixiHealthBar) {
            try { this._pixiHealthBar.destroy(); } catch (e) { }
            this._pixiHealthBar = null;
        }
        if (this._pixiHealthText) {
            try { this._pixiHealthText.destroy(); } catch (e) { }
            this._pixiHealthText = null;
        }
        if (this._pixiDebugGfx) {
            try { this._pixiDebugGfx.destroy(); } catch (e) { }
            this._pixiDebugGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(); } catch (e) { }
            this._pixiNameText = null;
        }

        if (this.tractorBeamActive) {
            GameContext.cruiserTimerResumeAt = Date.now() + 20000;
            showOverlayMessage("TRACTOR BEAM DOWN - SYSTEM REBOOTING (20s)", '#0ff', 4000);
        }

        // Award nuggets directly: 20 nuggets
        if (_awardNuggetsInstant) _awardNuggetsInstant(20, { noSound: false, sound: 'coin' });

        const boomScale = Math.max(2.8, Math.min(5, (this.visualRadius || this.radius || 400) / 250));
        if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 22);
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 80, '#0ff');
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 18);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 20);
        showOverlayMessage("DESTROYER DESTROYED - 20 NUGGETS DROPPED", '#ff0', 2000, 2);

        GameContext.currentDestroyerType = (GameContext.currentDestroyerType === 1) ? 2 : 1;
        GameContext.nextDestroyerSpawnTime = Date.now() + 60000;
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiBossLayer && pixiTextures && pixiTextures.destroyer_hull) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures.destroyer_hull);
                const ha = pixiTextureAnchors.destroyer_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;
            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;

            const rPos = this.getRenderPos(getRenderAlpha());

            if (this._firstDraw) {
                container.position.set(this.pos.x, this.pos.y);
                this._firstDraw = false;
            } else {
                container.position.set(rPos.x, rPos.y);
            }
            container.rotation = this.angle || 0;

            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 340) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            if (pixiVectorLayer && this.shieldSegments && this.shieldSegments.length > 0) {
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.position.set(rPos.x, rPos.y);
                gfx.rotation = this.shieldRotation || 0;
                if (this.shieldsDirty) {
                    gfx.clear();
                    const count = this.shieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.1 * (36 / count);
                    const gap = arcLen * Math.min(0.12, gapPct);
                    for (let i = 0; i < count; i++) {
                        const v = this.shieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            gfx.lineStyle(6, 0x00ffff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                            gfx.arc(0, 0, this.shieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiGfx) {
                try { this._pixiGfx.destroy(true); } catch (e) { }
                this._pixiGfx = null;
            }

            if (pixiVectorLayer && this.innerShieldSegments && this.innerShieldSegments.length > 0) {
                let innerGfx = this._pixiInnerGfx;
                if (!innerGfx) {
                    innerGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(innerGfx);
                    this._pixiInnerGfx = innerGfx;
                    this.shieldsDirty = true;
                } else if (!innerGfx.parent) {
                    pixiVectorLayer.addChild(innerGfx);
                }

                innerGfx.position.set(rPos.x, rPos.y);
                innerGfx.rotation = this.innerShieldRotation || 0;
                if (this.shieldsDirty) {
                    innerGfx.clear();
                    const count = this.innerShieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.05 * (24 / count);
                    const gap = arcLen * Math.min(0.08, gapPct);
                    for (let i = 0; i < count; i++) {
                        const v = this.innerShieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            innerGfx.lineStyle(5, 0xff00ff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                            innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }

            if (this.shieldsDirty) this.shieldsDirty = false;

            if (pixiVectorLayer && this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
                let phaseGfx = this._pixiPhaseGfx;
                if (!phaseGfx) {
                    phaseGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(phaseGfx);
                    this._pixiPhaseGfx = phaseGfx;
                } else if (!phaseGfx.parent) {
                    pixiVectorLayer.addChild(phaseGfx);
                }
                phaseGfx.clear();
                phaseGfx.position.set(rPos.x, rPos.y);
                phaseGfx.lineStyle(3, 0xffdc00, 0.6);
                phaseGfx.drawCircle(0, 0, (this.shieldRadius || this.radius || 0) + 14);
            } else if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }

            if (this.displayName && pixiVectorLayer) {
                let txt = this._pixiNameText;
                if (!txt) {
                    txt = new PIXI.Text(this.displayName, {
                        fontFamily: 'Courier New',
                        fontSize: 18,
                        fontWeight: 'bold',
                        fill: 0xff8000
                    });
                    txt.anchor.set(0.5);
                    txt.resolution = 2;
                    pixiVectorLayer.addChild(txt);
                    this._pixiNameText = txt;
                } else if (txt.text !== this.displayName) {
                    txt.text = this.displayName;
                }
                if (!txt.parent) pixiVectorLayer.addChild(txt);
                txt.visible = true;
                txt.position.set(rPos.x, rPos.y - this.visualRadius - 20);
            }

            if (pixiVectorLayer) {
                let hpBarGfx = this._pixiHealthBar;
                if (!hpBarGfx) {
                    hpBarGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(hpBarGfx);
                    this._pixiHealthBar = hpBarGfx;
                } else if (!hpBarGfx.parent) {
                    pixiVectorLayer.addChild(hpBarGfx);
                }

                const hpBarWidth = 80;
                const hpBarHeight = 6;
                const hpPercent = Math.max(0, this.hp / this.maxHp);
                const healthColor = hpPercent > 0.6 ? 0x00ff00 : (hpPercent > 0.3 ? 0xffff00 : 0xff0000);

                hpBarGfx.clear();
                hpBarGfx.position.set(rPos.x, rPos.y - this.visualRadius - 45);

                hpBarGfx.beginFill(0x330000);
                hpBarGfx.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);
                hpBarGfx.endFill();

                hpBarGfx.beginFill(healthColor);
                hpBarGfx.drawRect(-hpBarWidth / 2, 0, hpBarWidth * hpPercent, hpBarHeight);
                hpBarGfx.endFill();

                hpBarGfx.lineStyle(1, 0xffffff);
                hpBarGfx.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);

                let hpText = this._pixiHealthText;
                if (!hpText) {
                    hpText = new PIXI.Text('', {
                        fontFamily: 'Courier New',
                        fontSize: 10,
                        fill: 0xffffff
                    });
                    hpText.anchor.set(0.5, 1);
                    pixiVectorLayer.addChild(hpText);
                    this._pixiHealthText = hpText;
                } else if (!hpText.parent) {
                    pixiVectorLayer.addChild(hpText);
                }
                hpText.text = `${this.hp}/${this.maxHp}`;
                hpText.position.set(rPos.x, rPos.y - this.visualRadius - 48);
            }

            if (pixiVectorLayer) {
                let debugGfx = this._pixiDebugGfx;
                if (!debugGfx) {
                    debugGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(debugGfx);
                    this._pixiDebugGfx = debugGfx;
                } else if (!debugGfx.parent) {
                    pixiVectorLayer.addChild(debugGfx);
                }

                if (typeof GameContext.DEBUG_COLLISION !== 'undefined' && GameContext.DEBUG_COLLISION) {
                    debugGfx.visible = true;
                    debugGfx.clear();
                    debugGfx.position.set(rPos.x, rPos.y);
                    debugGfx.rotation = this.angle || 0;

                    debugGfx.lineStyle(3, 0x00FF00, 0.8);
                    if (this.hullDefinition) {
                        for (const circle of this.hullDefinition) {
                            const cx = circle.x * this.hullScale;
                            const cy = circle.y * this.hullScale;
                            const cr = circle.r * this.hullScale;
                            debugGfx.drawCircle(cx, cy, cr);
                        }
                    } else {
                        debugGfx.drawCircle(0, 0, this.radius);
                    }

                    if (this.shieldSegments && this.shieldSegments.some(s => s > 0)) {
                        debugGfx.lineStyle(2, 0x00FFFF, 0.4);
                        debugGfx.drawCircle(0, 0, this.shieldRadius);
                    }
                } else {
                    debugGfx.visible = false;
                }
            }

            // Tractor beam circle
            if (this.tractorBeamActive && pixiVectorLayer) {
                let tractorGfx = this._pixiTractorGfx;
                if (!tractorGfx) {
                    tractorGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(tractorGfx);
                    this._pixiTractorGfx = tractorGfx;
                } else if (!tractorGfx.parent) {
                    pixiVectorLayer.addChild(tractorGfx);
                }

                const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
                tractorGfx.clear();
                tractorGfx.position.set(rPos.x, rPos.y);
                tractorGfx.lineStyle(10 / (GameContext.currentZoom || 1), 0x00ffff, 0.4 + pulse * 0.2);
                tractorGfx.drawCircle(0, 0, this.tractorBeamRadius);
                tractorGfx.endFill();
            } else if (this._pixiTractorGfx) {
                try { this._pixiTractorGfx.visible = false; } catch (e) { }
            }

            return;
        }

        if (this.shieldSegments && this.shieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.shieldRotation || 0);
            ctx.lineWidth = 6;
            const count = this.shieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.1 * (36 / count);
            const gap = arcLen * Math.min(0.12, gapPct);
            for (let i = 0; i < count; i++) {
                const v = this.shieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.shieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.innerShieldRotation || 0);
            ctx.lineWidth = 5;
            const count = this.innerShieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.05 * (24 / count);
            const gap = arcLen * Math.min(0.08, gapPct);
            for (let i = 0; i < count; i++) {
                const v = this.innerShieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(255, 0, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.innerShieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.strokeStyle = 'rgba(255, 220, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (this.shieldRadius || this.radius || 0) + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle || 0);

        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#ff8000';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff8000';
        ctx.beginPath();
        ctx.arc(0, 0, this.visualRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();

        const hpBarWidth = 80;
        const hpBarHeight = 6;
        const hpBarY = this.pos.y - this.visualRadius - 45;
        const hpPercent = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = '#300';
        ctx.fillRect(this.pos.x - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight);

        const healthColor = hpPercent > 0.6 ? '#0f0' : (hpPercent > 0.3 ? '#ff0' : '#f00');
        ctx.fillStyle = healthColor;
        ctx.fillRect(this.pos.x - hpBarWidth / 2, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.pos.x - hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.hp}/${this.maxHp}`, this.pos.x, hpBarY - 3);

        if (this.displayName) {
            ctx.fillStyle = '#ff8000';
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000';
            ctx.fillText(this.displayName, this.pos.x, this.pos.y - this.visualRadius - 20);
            ctx.shadowBlur = 0;
        }
    }
}
