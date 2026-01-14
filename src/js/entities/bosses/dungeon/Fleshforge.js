import { Enemy } from '../../enemies/Enemy.js';
import { GameContext } from '../../../core/game-context.js';
import { SIM_FPS, SIM_STEP_MS } from '../../../core/constants.js';
import { playSound, setMusicMode, musicEnabled } from '../../../audio/audio-manager.js';
import { Bullet } from '../../projectiles/Bullet.js';
import { ClusterBomb } from '../../projectiles/ClusterBomb.js';
import { Coin } from '../../pickups/Coin.js';
import { SpaceNugget } from '../../pickups/SpaceNugget.js';
import { HealthPowerUp } from '../../pickups/HealthPowerUp.js';
import { showOverlayMessage } from '../../../utils/ui-helpers.js';
import { pixiCleanupObject } from '../../../rendering/pixi-context.js';

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _spawnNapalmZone = null;

export function registerFleshforgeDependencies(deps) {
    if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnNapalmZone) _spawnNapalmZone = deps.spawnNapalmZone;
}

export class Fleshforge extends Enemy {
    constructor(encounterIndex = 1) {
        super('gunboat', null, null, { gunboatLevel: 2 });
        const boost = Math.max(0, encounterIndex - 1);
        const hpScale = 1 + boost * 0.25;

        this.type = 'fleshforge';
        this.isDungeonBoss = true;
        this.isGunboat = true;
        this.gunboatLevel = 2;
        this.dungeonAsset = 'dungeon6.png';

        this.cruiserHullScale = 7.0;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);

        const baseHp = 180;
        this.hp = Math.round(baseHp * hpScale);
        this.maxHp = this.hp;

        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
        // Player collides with outer shield, bullets with inner shield - 3px
        this.hullCollisionRadius = this.innerShieldRadius - 3;
        this.shieldSegments = new Array(16).fill(3);
        this.innerShieldSegments = new Array(22).fill(3);
        this.innerShieldRotation = 0;
        this.baseGunboatRange = 900;
        this.gunboatRange = this.baseGunboatRange;
        this.cruiserBaseDamage = 2;
        this.despawnImmune = true;
        this.visualAngleOffset = Math.PI;

        this.disableAutoFire = true;
        this.phaseName = 'INTRO';
        this.phaseTimer = 60;
        this.phaseIndex = 0;
        this.phaseTick = 0;

        // Regen chambers
        this.regenChambers = [
            { active: true, hp: 20, maxHp: 20, angle: 0, dist: 100 },
            { active: true, hp: 20, maxHp: 20, angle: (Math.PI * 2 / 3), dist: 100 },
            { active: true, hp: 20, maxHp: 20, angle: (Math.PI * 4 / 3), dist: 100 }
        ];
        this.regenCooldown = 90;
        this.emergencyRebuildTriggered = false;

        this.phaseSeq = [
            { name: 'FORGE_ACTIVATE', duration: 160 },
            { name: 'CONSUME', duration: 140 },
            { name: 'ASSEMBLY_LINE', duration: 180 },
            { name: 'MELTDOWN', duration: 120 }
        ];

        const angle = Math.random() * Math.PI * 2;
        const dist = 2800;
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        this.turnSpeed = (Math.PI * 2) / (20 * SIM_FPS);
        this.wallElasticity = 0.3;
        this.t = 0;
    }

    updateAIState() {
        this.aiTimer = 999999;
    }

    update(deltaTime = SIM_STEP_MS) {
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.phaseTimer -= dtFactor;
        this.regenCooldown -= dtFactor;

        // Emergency Rebuild at 20% HP if chambers intact
        if (!this.emergencyRebuildTriggered && this.hp / this.maxHp <= 0.2) {
            const activeChambers = this.regenChambers.filter(c => c.active).length;
            if (activeChambers > 0) {
                this.emergencyRebuildTriggered = true;
                this.invulnerable = true;
                showOverlayMessage("EMERGENCY REBUILD!", '#0f0', 1500);
                setTimeout(() => {
                    this.hp = Math.round(this.maxHp * 0.5);
                    this.invulnerable = false;
                    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 50, '#0f0');
                }, 5000);
            }
        }

        // Phase progression
        if (this.phaseTimer <= 0) {
            const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
            this.phaseIndex++;
            this.phaseName = next.name;
            this.phaseTimer = next.duration;
            this.phaseTick = 0;
            showOverlayMessage(`FLESHFORGE: ${this.phaseName}`, '#0f0', 900);
        }

        // Movement style per phase - Cruiser-based
        const charging = (this.phaseName === 'MELTDOWN');
        if (charging) {
            this.circleStrafePreferred = false;
            this.aiState = 'SEEK';
            this.thrustPower = 0.64;
            this.maxSpeed = 8.4;
            this.gunboatRange = this.baseGunboatRange + 350;
        } else {
            // More varied movement: alternates between circling, orbiting, flanking, and direct approaches
            const dx = GameContext.player.pos.x - this.pos.x;
            const dy = GameContext.player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            if (typeof this.moveModeTimer !== 'number') this.moveModeTimer = 0;
            if (!this.moveMode) this.moveMode = 'CIRCLE';
            this.moveModeTimer -= deltaTime / 16.67;
            if (this.moveModeTimer <= 0) {
                const r = Math.random();
                if (dist > 1700) this.moveMode = (r < 0.55) ? 'SEEK' : (r < 0.80 ? 'CIRCLE' : 'ORBIT');
                else this.moveMode = (r < 0.38) ? 'CIRCLE' : (r < 0.60 ? 'ORBIT' : (r < 0.82 ? 'SEEK' : 'FLANK'));
                this.flankSide = Math.random() < 0.5 ? 1 : -1;
                this.moveModeTimer = 22 + Math.floor(Math.random() * 45);
            }

            if (this.moveMode === 'SEEK') {
                this.circleStrafePreferred = false;
                this.aiState = 'SEEK';
                this.thrustPower = 0.52;
                this.maxSpeed = 7.8;
            } else if (this.moveMode === 'ORBIT') {
                this.circleStrafePreferred = false;
                this.aiState = 'ORBIT';
                this.thrustPower = 0.48;
                this.maxSpeed = 6.6;
            } else if (this.moveMode === 'FLANK') {
                this.circleStrafePreferred = false;
                this.aiState = 'FLANK';
                this.thrustPower = 0.56;
                this.maxSpeed = 8.2;
            } else {
                this.circleStrafePreferred = true;
                this.aiState = 'CIRCLE';
                this.thrustPower = 0.40;
                this.maxSpeed = 5.8;
            }
            this.gunboatRange = this.baseGunboatRange;
        }

        this.innerShieldRotation -= 0.05 * dtFactor;
        super.update(deltaTime);

        // Regen chambers heal boss
        if (this.regenCooldown <= 0) {
            const activeChambers = this.regenChambers.filter(c => c.active).length;
            if (activeChambers > 0 && this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + activeChambers);
                this.regenCooldown = 90;
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, activeChambers * 3, '#0f0');
            }
        }

        // Phase attacks
        if (typeof this.phaseTickAccum === 'undefined') this.phaseTickAccum = 0;
        this.phaseTickAccum += dtFactor;
        while (this.phaseTickAccum >= 1) {
            this.phaseTickAccum -= 1;
            this.phaseTick++;
            this.runPhaseAttacks();
        }
    }

    runPhaseAttacks() {
        if (!GameContext.player || GameContext.player.dead) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (this.phaseName === 'FORGE_ACTIVATE') {
            if (this.phaseTick % 20 === 0) {
                // Cannon salvos from chambers
                for (let i = 0; i < 3; i++) {
                    const chamber = this.regenChambers[i];
                    if (chamber.active) {
                        const wx = this.pos.x + Math.cos(this.angle + chamber.angle) * chamber.dist * 7;
                        const wy = this.pos.y + Math.sin(this.angle + chamber.angle) * chamber.dist * 7;
                        const b = new Bullet(wx, wy, aim, 11, { owner: 'enemy', damage: 2, radius: 4, color: '#0f0' });
                        b.owner = this;
                        GameContext.bullets.push(b);
                    }
                }
                playSound('shoot');
            }
        } else if (this.phaseName === 'CONSUME') {
            // Leave napalm trails
            if (this.phaseTick % 30 === 0) {
                if (_spawnNapalmZone) {
                    _spawnNapalmZone(this.pos.x, this.pos.y, 2, 60);
                }
            }
            if (this.phaseTick % 40 === 0) {
                // Cannon fire
                const b = new Bullet(this.pos.x, this.pos.y, aim, 12, { owner: 'enemy', damage: 2, radius: 4, color: '#0f0' });
                b.owner = this;
                GameContext.bullets.push(b);
                playSound('heavy_shoot');
            }
        } else if (this.phaseName === 'ASSEMBLY_LINE') {
            if (this.phaseTick % 60 === 0) {
                // Cluster bombs
                const bomb = new ClusterBomb(this.pos.x, this.pos.y, aim, this);
                bomb.damage = 3;
                GameContext.bullets.push(bomb);
                playSound('heavy_shoot');
            }
            if (this.phaseTick % 25 === 0) {
                // Curtain fire
                for (let i = -3; i <= 3; i++) {
                    const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.15, 9, { owner: 'enemy', damage: 1, radius: 3, color: '#0f0' });
                    b.owner = this;
                    GameContext.bullets.push(b);
                }
                playSound('rapid_shoot');
            }
        } else if (this.phaseName === 'MELTDOWN') {
            if (this.phaseTick % 6 === 0) {
                // Rapid fire all weapons
                const b = new Bullet(this.pos.x, this.pos.y, aim + (Math.random() - 0.5) * 0.3, 14, { owner: 'enemy', damage: 2, radius: 3, color: '#0f0' });
                b.owner = this;
                GameContext.bullets.push(b);
                playSound('rapid_shoot');
            }
            if (this.phaseTick % 40 === 0) {
                // Ring attack
                for (let i = 0; i < 16; i++) {
                    const a = (Math.PI * 2 / 16) * i;
                    const b = new Bullet(this.pos.x, this.pos.y, a, 9, { owner: 'enemy', damage: 1, radius: 4, color: '#0f0' });
                    b.owner = this;
                    GameContext.bullets.push(b);
                }
                playSound('shotgun');
            }
        }
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        pixiCleanupObject(this);
        if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 4.0, 26);
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 4.0);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 140, '#0f0');
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 24);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 26);

        for (let i = 0; i < 18; i++) {
            GameContext.coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 120, this.pos.y + (Math.random() - 0.5) * 120, 10));
        }
        for (let i = 0; i < 7; i++) {
            GameContext.nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 140, this.pos.y + (Math.random() - 0.5) * 140, 1));
        }
        GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

        GameContext.bossActive = false;
        if (GameContext.fleshforge === this) GameContext.fleshforge = null;
        if (GameContext.boss === this) GameContext.boss = null;

        showOverlayMessage("FLESHFORGE DESTROYED", '#0f0', 3000);
        if (musicEnabled) setMusicMode('normal');
    }

    drawBossHud(ctx) {
        if (!GameContext.bossActive || this.dead) return;
        const w = ctx.canvas ? ctx.canvas.width : GameContext.width;
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const phaseText = this.phaseName || 'ACTIVE';
        ctx.fillText(`FLESHFORGE  (PHASE: ${phaseText})`, w / 2, y + 12);
        ctx.restore();
    }
}
