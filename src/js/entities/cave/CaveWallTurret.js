import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { CaveGuidedMissile } from './CaveGuidedMissile.js';
import { Coin } from '../pickups/Coin.js';
import { pixiCleanupObject, getRenderAlpha, pixiEnemyLayer } from '../../rendering/pixi-context.js';
import { pixiTextures } from '../../rendering/texture-loader.js';

let _spawnParticles = null;
let _updateHealthUI = null;
let _killPlayer = null;
let _awardCoinsInstant = null;
let _closestPointOnSegment = null;
let _spawnLargeExplosion = null;

export function registerCaveWallTurretDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
    if (deps.closestPointOnSegment) _closestPointOnSegment = deps.closestPointOnSegment;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
}

export class CaveWallTurret extends Entity {
    constructor(x, y, mode = 'rapid', opts = {}) {
        super(x, y);
        this.mode = mode; // 'rapid' | 'beam' | 'missile' 
        this.armored = !!opts.armored;
        this.armorHp = Math.max(0, opts.armorHp || (this.armored ? 10 : 0));
        this.maxArmorHp = this.armorHp;
        this.weakpointHp = Math.max(0, opts.weakpointHp || (this.armored ? 4 : 0));
        this.maxWeakpointHp = this.weakpointHp;
        this._weakOffset = null;
        this.radius = 86;
        this.hp = 6;
        this.maxHp = 6;
        this.t = 0;
        this.reload = 30 + Math.floor(Math.random() * 25);
        this.trackerCharge = 0;
        this.trackerChargeTotal = 75;
        this.trackerLock = 0;
        this.trackerLockTotal = 50;
        this.trackerBurst = 0;
        this.trackerBurstCd = 0;
        this.trackerAngle = 0;

        this.beamCooldown = 220 + Math.floor(Math.random() * 160);
        this.beamCharge = 0;
        this.beamChargeTotal = 55;
        this.beamFire = 0;
        this.beamFireTotal = 14;
        this.beamAngle = 0;
        this.beamLen = 4200;
        this.beamWidth = 20;
        this.beamHitThisShot = false;

        // 12-shard outer shield, 2hp each
        this.outerShieldRadius = this.radius + 56;
        this.outerShieldSegments = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
        this.shieldRotation = Math.random() * Math.PI * 2; // Random start angle
        this.shieldsDirty = true;
        this._pixiShieldGfx = null;
        this._pixiSprite = null;
    }

    weakpointPos() {
        if (!GameContext.caveLevel || !GameContext.caveLevel.active) return { x: this.pos.x, y: this.pos.y };
        if (!this._weakOffset) {
            const cx = GameContext.caveLevel.centerXAt(this.pos.y);
            const nx = (this.pos.x < cx) ? -1 : 1;
            this._weakOffset = { x: nx * (this.radius + 16), y: (Math.random() - 0.5) * 10 };
        }
        return { x: this.pos.x + this._weakOffset.x, y: this.pos.y + this._weakOffset.y };
    }

    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);

        // Check shield collision first (radius slightly smaller than shield visual)
        const shieldRadius = this.outerShieldRadius - 5;
        if (dist <= shieldRadius + b.radius) {
            // Find which shield segment was hit
            const angle = Math.atan2(b.pos.y - this.pos.y, b.pos.x - this.pos.x);
            let normalizedAngle = angle;
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            const segCount = this.outerShieldSegments.length;
            const segAngle = (Math.PI * 2) / segCount;
            const segIndex = Math.floor(normalizedAngle / segAngle) % segCount;

            if (this.outerShieldSegments[segIndex] > 0) {
                // Shield absorbs damage
                const absorbed = Math.min(this.outerShieldSegments[segIndex], b.damage);
                this.outerShieldSegments[segIndex] -= absorbed;
                this.shieldsDirty = true;
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 4, '#0ff');
                playSound('shield_hit');
                return true;
            }
            // If shield at 0, fall through to hull check
        }

        // Hull collision check
        if (dist > this.radius + b.radius) {
            // Weakpoint can be slightly outside the core radius.
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                const wp = this.weakpointPos();
                const d2 = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
                if (d2 > 12 + b.radius) return false;
            } else {
                return false;
            }
        }

        if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
            const wp = this.weakpointPos();
            const dWp = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
            if (dWp < 12 + b.radius && this.weakpointHp > 0) {
                this.weakpointHp -= b.damage;
                if (_spawnParticles) _spawnParticles(wp.x, wp.y, 10, '#0ff');
                playSound('hit');
                if (this.weakpointHp <= 0) {
                    // Cable severed: turret disabled immediately.
                    this.hp = 0;
                    this.kill();
                }
                return true;
            }

            // Armored shell: heavily reduced damage until armor breaks.
            if (this.armorHp > 0) {
                this.armorHp -= Math.max(1, Math.ceil(b.damage * 0.6));
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, '#88f');
                playSound('hit');
                if (this.armorHp < 0) this.armorHp = 0;
                return true;
            }
        }

        this.hp -= b.damage;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, '#ff8');
        playSound('hit');
        if (this.hp <= 0) this.kill();
        return true;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);

        // Remove from wallTurrets array
        if (GameContext.caveLevel && GameContext.caveLevel.wallTurrets) {
            const idx = GameContext.caveLevel.wallTurrets.indexOf(this);
            if (idx > -1) {
                GameContext.caveLevel.wallTurrets.splice(idx, 1);
            }
        }

        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
            if (_awardCoinsInstant) _awardCoinsInstant(6);
        } else {
            // Award coins directly: 3 coins * 2 value = 6 total
            if (_awardCoinsInstant) _awardCoinsInstant(6, { noSound: false, sound: 'coin' });
        }

        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 1.5);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 18, '#88f');
        playSound('base_explode');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.shieldRotation += 0.008 * dtFactor; // Slow rotation like pinwheel
        if (!GameContext.caveMode || !GameContext.caveLevel || !GameContext.caveLevel.active) return;
        if (!GameContext.player || GameContext.player.dead) return;

        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        const engageRange = (this.mode === 'rapid') ? (5200 * 1.25) : 5200;
        if (dist > engageRange) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (this.mode === 'tracker') {
            // Paint -> lock -> burst (fresh gameplay turret). 
            if (this.trackerBurst > 0) {
                this.trackerBurstCd -= dtFactor;
                if (this.trackerBurstCd <= 0) {
                    const leadX = GameContext.player.pos.x + GameContext.player.vel.x * 10;
                    const leadY = GameContext.player.pos.y + GameContext.player.vel.y * 10;
                    const a = Math.atan2(leadY - this.pos.y, leadX - this.pos.x);
                    const muzzleX = this.pos.x + Math.cos(a) * (this.radius + 6);
                    const muzzleY = this.pos.y + Math.sin(a) * (this.radius + 6);
                    GameContext.bullets.push(new Bullet(muzzleX, muzzleY, a, 48, { owner: 'enemy', damage: 1, radius: 4, color: '#0ff', life: 37 }));
                    this.trackerBurst--;
                    this.trackerBurstCd = 6;
                    playSound('rapid_shoot');
                }
            } else if (this.trackerLock > 0) {
                this.trackerLock -= dtFactor;
                this.trackerAngle = aim;
                if (this.trackerLock <= 0) { // Changed to <= 0 for safety with float decrement
                    this.trackerBurst = 10;
                    this.trackerBurstCd = 0;
                    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
                    playSound('heavy_shoot');
                }
            } else {
                this.trackerCharge -= dtFactor;
                if (this.trackerCharge <= 0) {
                    this.trackerLock = this.trackerLockTotal;
                    this.trackerCharge = this.trackerChargeTotal + Math.floor(Math.random() * 40);
                    this.trackerAngle = aim;
                }
            }
            return;
        }

        if (this.mode === 'missile') {
            this.reload -= dtFactor;
            if (this.reload <= 0) {
                GameContext.guidedMissiles.push(new CaveGuidedMissile(this, { hp: 5, maxDamage: 5, radius: 36, speed: 8.2, turnRate: 0.12, life: 540 }));
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 8, '#fa0');
                playSound('heavy_shoot');
                // Slower missile turret cadence. 
                this.reload = 340 + Math.floor(Math.random() * 140);
            }
            return;
        }

        if (this.mode === 'beam') {
            const applyBeamDamageToPlayer = (amount) => {
                if (!GameContext.player || GameContext.player.dead) return;
                if (GameContext.player.invulnerable > 0) return;
                let remaining = Math.max(0, Math.ceil(amount));
                if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
                    for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                        if (GameContext.player.outerShieldSegments[i] > 0) {
                            GameContext.player.outerShieldSegments[i] = 0;
                            remaining -= 1;
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
                    if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#f00');
                    playSound('hit');
                    if (_updateHealthUI) _updateHealthUI();
                    if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
                } else {
                    if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#ff0');
                    playSound('shield_hit');
                }
                GameContext.player.invulnerable = 5;
            };

            if (this.beamFire > 0) {
                this.beamFire -= dtFactor;
                if (!this.beamHitThisShot && _closestPointOnSegment) {
                    const ex = this.pos.x + Math.cos(this.beamAngle) * this.beamLen;
                    const ey = this.pos.y + Math.sin(this.beamAngle) * this.beamLen;
                    const cp = _closestPointOnSegment(GameContext.player.pos.x, GameContext.player.pos.y, this.pos.x, this.pos.y, ex, ey);
                    const d = Math.hypot(GameContext.player.pos.x - cp.x, GameContext.player.pos.y - cp.y);
                    const hitDist = (this.beamWidth * 0.5) + (GameContext.player.radius * 0.55);
                    if (d <= hitDist) {
                        this.beamHitThisShot = true;
                        applyBeamDamageToPlayer(3);
                        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 8);
                        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 8);
                    }
                }
            } else if (this.beamCharge > 0) {
                this.beamCharge -= dtFactor;
                if (this.beamCharge <= 0) {
                    this.beamFire = this.beamFireTotal;
                    this.beamHitThisShot = false;
                    playSound('heavy_shoot');
                }
            } else {
                this.beamCooldown -= dtFactor;
                if (this.beamCooldown <= 0 && dist > 300) {
                    this.beamAngle = aim;
                    this.beamCharge = this.beamChargeTotal;
                    this.beamFire = 0;
                    this.beamCooldown = 260 + Math.floor(Math.random() * 180);
                    this.beamHitThisShot = false;
                }
            }
            return;
        }

        // Rapid-fire lasers
        this.reload -= dtFactor;
        if (this.reload <= 0) {
            const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
            const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
            GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, 42, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff', life: 37 }));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.08, 42, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff', life: 37 }));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.08, 42, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff', life: 37 }));
            this.reload = 26 + Math.floor(Math.random() * 18);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;

        // Pixi Rendering - use pixiEnemyLayer for rendering above asteroids
        if (pixiEnemyLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiEnemyLayer.addChild(container);

                // Sprite for turret
                const sprite = new PIXI.Sprite(pixiTextures.cave_turret);
                sprite.anchor.set(0.5);
                container.addChild(sprite);
                this._pixiSprite = sprite;

                // Shield graphics
                const shieldGfx = new PIXI.Graphics();
                container.addChild(shieldGfx);
                this._pixiShieldGfx = shieldGfx;
            }

            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            // Rotate sprite to face player
            this._pixiSprite.rotation = aim;
            // Rotate shield independently like pinwheel
            this._pixiShieldGfx.rotation = this.shieldRotation;

            // Draw shield shards (only when dirty)
            if (this.shieldsDirty) {
                const g = this._pixiShieldGfx;
                g.clear();
                const segCount = this.outerShieldSegments.length;
                const segAngle = (Math.PI * 2) / segCount;
                for (let i = 0; i < segCount; i++) {
                    const hp = this.outerShieldSegments[i];
                    if (hp > 0) {
                        const a0 = i * segAngle + 0.1;
                        const a1 = (i + 1) * segAngle - 0.1;
                        const alpha = Math.max(0.3, Math.min(1, hp / 2));
                        g.lineStyle(4, 0xff0000, alpha);
                        g.moveTo(Math.cos(a0) * this.outerShieldRadius, Math.sin(a0) * this.outerShieldRadius);
                        g.arc(0, 0, this.outerShieldRadius, a0, a1);
                    }
                }
                this.shieldsDirty = false;
            }

            return;
        }
    }
}
