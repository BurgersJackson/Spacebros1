import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { CaveGuidedMissile } from './CaveGuidedMissile.js';
import { Coin } from '../pickups/Coin.js';
import { pixiCleanupObject } from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _updateHealthUI = null;
let _killPlayer = null;
let _awardCoinsInstant = null;
let _closestPointOnSegment = null;

export function registerCaveWallTurretDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
    if (deps.closestPointOnSegment) _closestPointOnSegment = deps.closestPointOnSegment;
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
        this.radius = 66;
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
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
            if (_awardCoinsInstant) _awardCoinsInstant(6);
        } else {
            for (let i = 0; i < 3; i++) GameContext.coins.push(new Coin(this.pos.x, this.pos.y, 2));
        }
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 18, '#88f');
        playSound('explode');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
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
                    GameContext.bullets.push(new Bullet(muzzleX, muzzleY, a, 16, { owner: 'enemy', damage: 1, radius: 4, color: '#0ff' }));
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
                GameContext.guidedMissiles.push(new CaveGuidedMissile(this, { hp: 5, maxDamage: 5, radius: 18, speed: 8.2, turnRate: 0.12 }));
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
            GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, 14, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff' }));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.08, 14, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff' }));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.08, 14, { owner: 'enemy', damage: 1, radius: 4, color: '#8ff' }));
            this.reload = 26 + Math.floor(Math.random() * 18);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;

        // Pixi Rendering
        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                // Base Gfx (Staticish)
                const g = new PIXI.Graphics();
                g.name = 'base';
                container.addChild(g);
                this._pixiGfx = g;

                // Overlay Gfx (Beams/Trackers)
                const overlay = new PIXI.Graphics();
                overlay.name = 'overlay';
                container.addChild(overlay);
                this._pixiOverlay = overlay;

                // Label/UI if needed (none for turret)
            }

            container.visible = true; // Managed by caller ideally, but ensure true if called
            container.position.set(this.pos.x, this.pos.y);

            const z = GameContext.currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            const overlay = this._pixiOverlay;

            // Redraw every frame for now due to dynamic rotation/state. 
            // Optimization: Cache base, only rotate gun?
            // For now, full redraw is safer for migration.
            g.clear();
            overlay.clear();

            // Turret Base/Gun
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff, 1);
            // Shadow not maintained in Pixi Gfx easily without filters, skipping shadow for perf
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Gun Barrel
            g.beginFill(0x8888ff);
            g.drRect = { x: this.radius * 0.2, y: -4, w: this.radius * 1.35, h: 8 };
            // Rotate manually for barrel? No, rotate Graphics? 
            // Turret rotates to aim.
            // Base is round, so rotating container is fine.
            container.rotation = aim;

            g.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
            g.endFill();

            // Weakpoint (Armored Cable) - drawn in world space relative to turret? 
            // Weakpoint is calculated by weakpointPos(), usually offset.
            // If I rotate container by `aim`, local (0,0) is center.
            // weakpointPos() logic: nx * (radius+16), y random.
            // That logic is constant in *world* space? No, weakpointPos uses `nx` based on `centerXAt`.
            // The turret base (round) is at `pos`.
            // The weakpoint is at `pos + offset`.
            // The gun rotates `aim`.
            // So if I rotate `container` by `aim`, the *weakpoint* (attached to wall) would rotate too!
            // Incorrect.

            // Correction: Container should NOT rotate. Only the Gun Barrel should rotate.
            container.rotation = 0;

            // Redraw Base (Circle) - No rotation needed.
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Draw Gun Barrel (Rotated)
            const barrX = Math.cos(aim);
            const barrY = Math.sin(aim);
            // Rotated rect points
            // Start at offset *0.2
            // Since we are doing geometry, maybe use a sub-container for gun?
            // Let's use drawing matrix or just trig.
            // Gun rect: x:0.2*r, y:-4, w:1.35*r, h:8.
            // It's easier to add a 'gun' child Container.
            if (!this._pixiGun) {
                const gun = new PIXI.Graphics();
                gun.beginFill(0x8888ff);
                gun.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
                gun.endFill();
                container.addChild(gun);
                this._pixiGun = gun;
            }
            this._pixiGun.rotation = aim;

            // Weakpoint
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                // We draw lines from (0,0) to weakpoint offset
                const wp = this.weakpointPos();
                const lx = wp.x - this.pos.x;
                const ly = wp.y - this.pos.y;

                g.lineStyle(2, 0x00ffff, 0.9);
                g.moveTo(0, 0);
                g.lineTo(lx, ly);

                g.beginFill(0x00ffff);
                g.lineStyle(0);
                g.drawCircle(lx, ly, 6);
                g.endFill();
            }

            // Overlay (Beams, Trackers)
            // Tracker
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                // Dashed line from center to aim
                // LineDash not native in v5 Graphics easily without plugins, simulate dots?
                // Or just solid line with low alpha
                overlay.lineStyle(2, 0x00ffff, 0.35);
                // Draw manual dash?
                const angle = this.trackerAngle;
                const tx = Math.cos(angle) * 2600;
                const ty = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(tx, ty);
            }
            // Beam
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                const bx = Math.cos(angle) * 2600;
                const by = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(bx, by);
            }

            // HP Ring
            const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.drawCircle(0, 0, this.radius + 8);
            // drawCircle is full circle. Canvas was partial arc based on pct.
            // Graphics.arc(cx, cy, radius, startAngle, endAngle)
            overlay.clear();
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                overlay.lineStyle(2, 0x00ffff, 0.35);
                const angle = this.trackerAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);

            return;
        }

        // Canvas Fallback Removed
    }
}
