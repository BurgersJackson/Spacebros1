import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { Destroyer2GuidedMissile } from '../projectiles/Destroyer2GuidedMissile.js';
import { ClusterBomb } from '../projectiles/ClusterBomb.js';
import { NapalmZone } from '../projectiles/NapalmZone.js';
import { SpaceNugget } from '../pickups/SpaceNugget.js';
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

export function registerDestroyer2Dependencies(deps) {
    if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
}

export class Destroyer2 extends Entity {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 4000; // Spawn somewhat far from player
        super(GameContext.player.pos.x + Math.cos(angle) * dist, GameContext.player.pos.y + Math.sin(angle) * dist);

        this.displayName = "DESTROYER II";

        this.visualRadius = Math.floor(520 * 0.65) * 2 * 1.5; // Match Destroyer size (visual scale)
        this.radius = Math.round(this.visualRadius * 0.5); // Collision trimmed to hull, not PNG bounds
        this.collisionRadius = this.radius;
        this.hp = 300;
        this.maxHp = 300;

        // Movement properties for roaming
        this.roamSpeed = 1.5; // Slow roaming speed
        this.roamAngle = Math.random() * Math.PI * 2;
        this.angle = this.roamAngle;
        this.roamInterval = 900 + Math.floor(Math.random() * 600); // Rare direction changes (15-25s)
        this.roamTimer = this.roamInterval;
        this.turnSpeed = 0.008; // Slow turning per frame at 60fps
        this.baseTurnSpeed = 0.008;
        this.farTurnSpeed = 0.05;
        this.chaseDistance = 8000;

        // Outer + inner shields for destroyer (cave monster style)
        this.maxShieldHp = 999;  // Indestructible like cave monsters
        this.shieldSegments = new Array(60).fill(0);
        this.innerShieldSegments = new Array(50).fill(0);
        // Every other segment active (like cave monsters)
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
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 180, cooldown: 600, regen: false } // 3s active / 10s CD
        };

        // Turrets only (4 turrets like space station)
        this.turretReload = 100; // 3x rate (0.1 seconds)
        this.t = 0;

        this.turretLocalOffsets = [
            { x: -0.42, y: -0.02 },
            { x: 0.42, y: -0.02 },
            { x: -0.42, y: 0.24 },
            { x: 0.42, y: 0.24 }
        ];

        this.ringAttackTimer = 5000;
        this.guidedMissileTimer = 2000;

        // Collision Hull Setup
        // Image is 512x512, visible ship is ~452x206 centered.
        // Scale ~ 3.0.
        this.hullDefinition = [
            { x: -120, y: 0, r: 103 }, // Rear
            { x: 0, y: 0, r: 103 },    // Center
            { x: 120, y: 0, r: 103 }   // Front
        ];
        this.hullScale = (this.visualRadius / 340);

        // Escalation system - tracks battle duration for difficulty scaling
        this.battleStartTime = Date.now();
        this.escalationPhase = 1;
        this.escalationMultiplier = 1.0;
    }

    getEscalationPhase() {
        if (this.dead) return 1;
        const elapsed = Date.now() - this.battleStartTime;
        if (elapsed >= 120000) return 3; // 2+ minutes = Phase 3 (napalm + max fire rate)
        if (elapsed >= 60000) return 2;  // 1-2 minutes = Phase 2 (cluster bombs + increased fire rate)
        return 1; // 0-1 minute = Phase 1 (normal)
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

        const now = Date.now();

        // Roaming movement - slowly move around the map, always moving forward
        this.roamTimer -= dtFactor;

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

        // Smoothly turn toward roamAngle instead of snapping
        let angleDiff = this.roamAngle - (this.angle || 0);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const turnStep = this.turnSpeed * dtFactor;
        if (Math.abs(angleDiff) < turnStep) this.angle = this.roamAngle;
        else this.angle += Math.sign(angleDiff) * turnStep;

        // Apply velocity for roaming (always move forward in the direction we're facing)
        this.vel.x = Math.cos(this.angle || 0) * this.roamSpeed;
        this.vel.y = Math.sin(this.angle || 0) * this.roamSpeed;
        super.update(deltaTime);

        // Keep within reasonable bounds (stay within 15000 of center)
        const distFromCenter = Math.hypot(this.pos.x, this.pos.y);
        if (distFromCenter > 15000) {
            this.roamAngle = Math.atan2(-this.pos.y, -this.pos.x);
        }

        // Outer/inner shield rotation (opposite directions, cave monster style)
        this.shieldRotation += 0.003 * dtFactor;
        this.innerShieldRotation -= 0.0036 * dtFactor;

        // Auto-cycling invincibility phase shield
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

        // Check if player is within range to engage with turrets
        const phase = this.getEscalationPhase();
        const mult = this.getEscalationMultiplier();
        if (playerAlive) {
            const dist = distToPlayer;

            if (dist < 3200) { // Engagement range
                this.turretReload -= deltaTime * mult;
                if (this.turretReload <= 0) {
                    this.fireTurrets();
                    this.turretReload = 100; // 0.1 seconds in ms
                }

                this.ringAttackTimer -= deltaTime * mult;
                if (this.ringAttackTimer <= 0) {
                    this.fireRing(16, 8.0, 8, '#ff0');
                    // Fire more frequently (every 2s) when damaged below 50%
                    this.ringAttackTimer = (this.hp < this.maxHp * 0.5) ? 2000 : 5000;

                    // Phase 3: Spawn napalm zone with ring attack
                    if (phase >= 3) {
                        this.spawnNapalmZone();
                    }
                }
            }

            this.guidedMissileTimer -= deltaTime * mult;
            if (this.guidedMissileTimer <= 0) {
                // Phase 2+: Use cluster bombs instead of standard guided missiles
                if (phase >= 2) {
                    this.fireClusterBomb();
                } else {
                    GameContext.guidedMissiles.push(new Destroyer2GuidedMissile(this));
                }
                this.guidedMissileTimer = 2000;
            }
        }

        if (this.invulnerable > 0) {
            this.invulnerable -= dtFactor;
        }
    }

    fireTurrets() {
        const tx = this.pos.x;
        const ty = this.pos.y;
        const bulletSpeed = 14.96;
        const dx = GameContext.player.pos.x - tx;
        const dy = GameContext.player.pos.y - ty;
        const dist = Math.hypot(dx, dy);
        const leadTime = Math.min(40, dist / bulletSpeed);
        const leadX = GameContext.player.pos.x + GameContext.player.vel.x * leadTime;
        const leadY = GameContext.player.pos.y + GameContext.player.vel.y * leadTime;
        const baseAngle = Math.atan2(leadY - ty, leadX - tx);
        const spread = 0.09;
        const angles = [baseAngle - spread, baseAngle, baseAngle + spread];
        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            const b = new Bullet(tx, ty, angle, bulletSpeed, { owner: 'enemy', damage: 2, radius: 6, color: '#f80' });
            b.life = Math.round(b.life * 1.25);
            GameContext.bullets.push(b);
            if (_spawnBarrelSmoke) _spawnBarrelSmoke(tx, ty, angle);
        }
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

        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiPhaseGfx) {
            try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
            this._pixiPhaseGfx = null;
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

        pixiCleanupObject(this);

        // Drop 20 nuggets
        for (let i = 0; i < 20; i++) {
            GameContext.nuggets.push(new SpaceNugget(
                this.pos.x + (Math.random() - 0.5) * 200,
                this.pos.y + (Math.random() - 0.5) * 200,
                1
            ));
        }

        const boomScale = Math.max(2.8, Math.min(5, (this.visualRadius || this.radius || 400) / 250));
        if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 22);
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 80, '#0ff');
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 18);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 20);
        showOverlayMessage("DESTROYER II DESTROYED - 20 NUGGETS DROPPED", '#ff0', 2000, 2);

        // Set respawn timer - spawn the OTHER destroyer type
        GameContext.currentDestroyerType = (GameContext.currentDestroyerType === 1) ? 2 : 1;
        GameContext.nextDestroyerSpawnTime = Date.now() + 60000; // 1 minute
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        // Pixi fast path (destroyer hull + turrets)
        if (pixiBossLayer && pixiTextures && pixiTextures.destroyer2_hull) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures.destroyer2_hull);
                const ha = pixiTextureAnchors.destroyer2_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;

            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;
            const rPos = this.getRenderPos(getRenderAlpha());
            container.position.set(rPos.x, rPos.y);
            container.rotation = this.angle || 0;

            const now = (typeof GameContext.frameNow === 'number' && GameContext.frameNow > 0) ? GameContext.frameNow : Date.now();
            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 340) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            // Outer + inner shields (vector layer)
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
                    const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
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
                    const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
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

            // Nameplate
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
            const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
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
            const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
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
