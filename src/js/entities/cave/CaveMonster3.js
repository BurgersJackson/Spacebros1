
import { CaveMonsterBase } from './CaveMonsterBase.js';
import { GameContext } from '../../core/game-context.js';
import { Bullet } from '../projectiles/Bullet.js';
import { Enemy } from '../enemies/Enemy.js';
import { playSound } from '../../audio/audio-manager.js';
import { caveDeps } from './cave-dependencies.js';
import { closestPointOnSegment } from '../../core/math.js';
import { pixiVectorLayer, getRenderAlpha } from '../../rendering/pixi-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';

export class CaveMonster3 extends CaveMonsterBase {
    constructor(x, y) {
        super(x, y, 3);
        this.displayName = 'VOID TERROR';
        this.beamAngles = []; // Array for multiple beam angles (3-beam arc)
        this.beamCharge = 0;
        this.beamChargeTotal = 60;
        this.beamFire = 0;
        this.beamFireTotal = 12;
        this.beamAngle = 0;
        this.beamLen = 4500;
        this.beamWidth = 35;
        this.beamHitThisShot = false;
        this.attackType = 0;
        this.shieldDrone = null;
    }

    fireAttack(phase) {
        const attacks = ['spineSalvo', 'plasmaMortar', 'beamCannon', 'shieldDrone', 'tendrilMines'];
        const attack = attacks[this.attackType % attacks.length];
        this.attackType++;

        switch (attack) {
            case 'spineSalvo':
                this.spineSalvo(phase);
                break;
            case 'plasmaMortar':
                this.plasmaMortar(phase);
                break;
            case 'beamCannon':
                this.beamCannon(phase);
                break;
            case 'shieldDrone':
                this.shieldDroneAttack(phase);
                break;
            case 'tendrilMines':
                this.tendrilMines(phase);
                break;
        }
    }

    spineSalvo(phase) {
        // Sequential hardpoint fire
        const count = phase === 3 ? 8 : (phase === 2 ? 6 : 4);
        const baseAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.dead) return;
                const spread = (Math.random() - 0.5) * 0.3;
                const a = baseAngle + spread;
                // new Bullet(x, y, angle, speed, opts)
                const b = new Bullet(this.pos.x, this.pos.y, a, 12, { damage: 14, life: 90, color: '#80f', isEnemy: true, radius: 10 });
                GameContext.bullets.push(b);
                playSound('rapid_shoot');
            }, i * 100);
        }
    }

    plasmaMortar(phase) {
        // Lobbed explosive shells
        const count = phase === 3 ? 6 : (phase === 2 ? 4 : 3);
        const targetX = GameContext.player ? GameContext.player.pos.x : this.pos.x;
        const targetY = GameContext.player ? GameContext.player.pos.y : this.pos.y;

        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 500;
            const offsetY = (Math.random() - 0.5) * 500;
            const targetAngle = Math.atan2(targetY + offsetY - this.pos.y, targetX + offsetX - this.pos.x);

            // Slow, heavy projectile
            const opts = {
                damage: 6,
                life: 120,
                color: '#f0f',
                isEnemy: true,
                radius: 15, // from main.js code
                isBomb: true,
                explosionRadius: 250,
                explosionDamage: 6,
                directHitDamage: 15
            };
            const b = new Bullet(this.pos.x, this.pos.y, targetAngle, 20, opts);
            GameContext.bullets.push(b);
        }
        playSound('shotgun');
    }

    beamCannon(phase) {
        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : this.angle;
        const arcSpread = Math.PI / 12; // 15 degrees in radians
        this.beamAngles = [
            aim - arcSpread,  // -15 degrees
            aim,              // Center
            aim + arcSpread   // +15 degrees
        ];
        this.beamAngle = aim;
        this.beamCharge = this.beamChargeTotal;
        this.beamFire = 0;
        this.beamHitThisShot = false;
        playSound('powerup');
    }

    shieldDroneAttack(phase) {
        // Spawn orbiting blocker drone
        if (this.shieldDrone && !this.shieldDrone.dead) {
            // Drone already exists, boost its power
            this.shieldDrone.hp = Math.min(this.shieldDrone.hp + 2, 10);
            return;
        }

        // Create shield drone
        const droneAngle = Math.random() * Math.PI * 2;
        const droneDist = 250;

        this.shieldDrone = {
            pos: { x: this.pos.x + Math.cos(droneAngle) * droneDist, y: this.pos.y + Math.sin(droneAngle) * droneDist },
            vel: { x: 0, y: 0 },
            angle: droneAngle,
            orbitDist: droneDist,
            orbitSpeed: 0.02,
            hp: 5,
            maxHp: 5,
            radius: 40, // Increased from 30 for better visibility
            dead: false,
            owner: this,
            update: function (dt) {
                if (this.dead || this.owner.dead) {
                    this.dead = true;
                    return;
                }
                // Orbit owner
                const dtScale = (dt || 16.67) / 16.67;
                this.angle += this.orbitSpeed * dtScale;
                this.pos.x = this.owner.pos.x + Math.cos(this.angle) * this.orbitDist;
                this.pos.y = this.owner.pos.y + Math.sin(this.angle) * this.orbitDist;

                // Block player bullets
                for (const bullet of GameContext.bullets) {
                    if (bullet.isEnemy) continue;
                    const r = this.radius || 40;
                    const dist = Math.hypot(bullet.pos.x - this.pos.x, bullet.pos.y - this.pos.y);
                    if (dist < r + bullet.radius) {
                        this.hp--;
                        bullet.dead = true;
                        if (caveDeps.spawnParticles) caveDeps.spawnParticles(this.pos.x, this.pos.y, 5, '#80f');
                        if (this.hp <= 0) {
                            this.dead = true;
                            if (caveDeps.spawnParticles) caveDeps.spawnParticles(this.pos.x, this.pos.y, 30, '#80f');
                            playSound('explosion');
                        }
                    }
                }
            },
            draw: function (ctx) {
                if (this.dead) return;
                ctx.save();
                ctx.translate(this.pos.x, this.pos.y);
                const r = this.radius || 40;
                ctx.fillStyle = '#80f';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#80f';
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        // Add to a special array for drones
        if (!window.monsterDrones) window.monsterDrones = [];
        window.monsterDrones.push(this.shieldDrone);
        playSound('powerup');
    }

    tendrilMines(phase) {
        // Same as Monster1, implementation duplicated or reused?
        // Reuse:
        // Ideally share mixin or something, but duplicating for now as per extraction rules.
        const count = phase === 3 ? 5 : (phase === 2 ? 4 : 3);
        const self = this;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 600 + Math.random() * 1400;
            const mx = this.pos.x + Math.cos(angle) * dist;
            const my = this.pos.y + Math.sin(angle) * dist;

            const mine = new Enemy('turret', { x: mx, y: my }, null);
            mine.hp = 1;
            mine.maxHp = 1;
            mine.radius = 30;
            mine.despawnImmune = true;
            mine.owner = this;
            mine.noDrops = true;
            mine.t = 0;
            mine.pulsePhase = Math.random() * Math.PI * 2;

            mine.update = function () {
                this.t += 1;

                if (GameContext.player && !GameContext.player.dead) {
                    const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
                    if (dist < 100) {
                        this.dead = true;
                        if (caveDeps.spawnFieryExplosion) caveDeps.spawnFieryExplosion(this.pos.x, this.pos.y, 2.0);
                        playSound('explosion');

                        const explosionRadius = 200;
                        if (Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y) < explosionRadius) {
                            if (caveDeps.applyAOEDamageToPlayer) caveDeps.applyAOEDamageToPlayer(this.pos.x, this.pos.y, explosionRadius, 15);
                        }
                    }
                }
            };
            mine.draw = function (ctx) {
                // Canvas drawing backup
                ctx.save();
                ctx.translate(this.pos.x, this.pos.y);
                const pulseScale = 1.0 + Math.sin(this.t * 0.1 + this.pulsePhase) * 0.15;
                const pulseAlpha = 0.5 + Math.sin(this.t * 0.1 + this.pulsePhase) * 0.3;
                ctx.fillStyle = `rgba(0, 255, 0, ${pulseAlpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(0, 0, 25 * pulseScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0f0';
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            GameContext.enemies.push(mine);
        }
        playSound('powerup');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;

        if (this.beamFire > 0) {
            this.beamFire -= dtFactor;
            if (!this.beamHitThisShot && this.beamAngles.length > 0) {
                if (GameContext.player && !GameContext.player.dead) {
                    // Check all 3 beams for collision
                    for (const beamAngle of this.beamAngles) {
                        const ex = this.pos.x + Math.cos(beamAngle) * this.beamLen;
                        const ey = this.pos.y + Math.sin(beamAngle) * this.beamLen;
                        const cp = closestPointOnSegment(GameContext.player.pos.x, GameContext.player.pos.y, this.pos.x, this.pos.y, ex, ey);
                        const d = Math.hypot(GameContext.player.pos.x - cp.x, GameContext.player.pos.y - cp.y);
                        const hitDist = (this.beamWidth * 0.5) + (GameContext.player.radius * 0.55);
                        if (d <= hitDist) {
                            this.beamHitThisShot = true;
                            // Use AOE damage that respects shield penetration (wide AOE as requested)
                            if (caveDeps.applyAOEDamageToPlayer) caveDeps.applyAOEDamageToPlayer(GameContext.player.pos.x, GameContext.player.pos.y, 100, 15);
                            GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 8);
                            GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 8);
                            break; // Only damage once per volley
                        }
                    }
                }
            }
        } else if (this.beamCharge > 0) {
            this.beamCharge -= dtFactor;
            if (this.beamCharge <= 0) {
                this.beamFire = this.beamFireTotal;
                this.beamHitThisShot = false;
                playSound('heavy_shoot');
            }
        }

        super.update(deltaTime);
    }

    draw(ctx) {
        super.draw(ctx);

        if (this.dead) return;

        // Get interpolated position for smooth rendering
        const rPos = this.getRenderPos ? this.getRenderPos(getRenderAlpha()) : this.pos;

        if (this.beamCharge > 0 || this.beamFire > 0) {
            if (pixiVectorLayer) {
                let gfx = this._pixiBeamGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiBeamGfx = gfx;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.clear();
                gfx.position.set(rPos.x, rPos.y);
                const z = GameContext.currentZoom || ZOOM_LEVEL;
                const charging = (this.beamCharge > 0);
                const firing = (this.beamFire > 0);

                // Loop through all 3 beam angles
                if (this.beamAngles.length > 0) {
                    for (const beamAngle of this.beamAngles) {
                        const ex = Math.cos(beamAngle) * this.beamLen;
                        const ey = Math.sin(beamAngle) * this.beamLen;

                        if (charging) {
                            const pct = 1 - (this.beamCharge / (this.beamChargeTotal || 1));
                            gfx.lineStyle(3, 0xffff00, 0.15 + pct * 0.3);
                            gfx.moveTo(0, 0);
                            gfx.lineTo(ex, ey);
                        } else if (firing) {
                            gfx.lineStyle(this.beamWidth / z, 0xffff00, 0.95);
                            gfx.moveTo(0, 0);
                            gfx.lineTo(ex, ey);
                            gfx.beginFill(0xffff00, 0.85);
                            gfx.drawCircle(ex, ey, 10 / z);
                            gfx.endFill();
                        }
                    }
                }
            }
        } else if (this._pixiBeamGfx) {
            try { this._pixiBeamGfx.clear(); } catch (e) { }
        }
    }

    kill() {
        if (this.dead) return;
        if (this._pixiBeamGfx) {
            try { this._pixiBeamGfx.destroy({ children: true }); } catch (e) { }
            this._pixiBeamGfx = null;
        }
        if (this.shieldDrone) {
            this.shieldDrone.dead = true;
        }
        super.kill();
    }
}
