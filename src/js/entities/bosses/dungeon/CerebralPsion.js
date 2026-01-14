import { Enemy } from '../../enemies/Enemy.js';
import { GameContext } from '../../../core/game-context.js';
import { SIM_FPS, SIM_STEP_MS } from '../../../core/constants.js';
import { playSound, setMusicMode, musicEnabled } from '../../../audio/audio-manager.js';
import { Bullet } from '../../projectiles/Bullet.js';
import { FlagshipGuidedMissile } from '../../projectiles/FlagshipGuidedMissile.js';
import { PsychicEcho } from './PsychicEcho.js';
import { Coin } from '../../pickups/Coin.js';
import { SpaceNugget } from '../../pickups/SpaceNugget.js';
import { HealthPowerUp } from '../../pickups/HealthPowerUp.js';
import { showOverlayMessage } from '../../../utils/ui-helpers.js';
import { pixiCleanupObject } from '../../../rendering/pixi-context.js';

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;

export function registerCerebralPsionDependencies(deps) {
    if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
}

export class CerebralPsion extends Enemy {
    constructor(encounterIndex = 1) {
        super('gunboat', null, null, { gunboatLevel: 2 });
        const boost = Math.max(0, encounterIndex - 1);
        const hpScale = 1 + boost * 0.15;

        this.type = 'cerebralPsion';
        this.isDungeonBoss = true;
        this.isGunboat = true;
        this.gunboatLevel = 2;
        this.dungeonAsset = 'dungeon5.png';

        this.cruiserHullScale = 6.0;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);

        const baseHp = 140;
        this.hp = Math.round(baseHp * hpScale);
        this.maxHp = this.hp;

        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
        // Player collides with outer shield, bullets with inner shield - 3px
        this.hullCollisionRadius = this.innerShieldRadius - 3;
        this.shieldSegments = new Array(12).fill(4);
        this.innerShieldSegments = new Array(16).fill(4);
        this.innerShieldRotation = 0;
        this.baseGunboatRange = 1000;
        this.gunboatRange = this.baseGunboatRange;
        this.cruiserBaseDamage = 2;
        this.despawnImmune = true;
        this.visualAngleOffset = Math.PI;

        this.disableAutoFire = true;
        this.phaseName = 'INTRO';
        this.phaseTimer = 60;
        this.phaseIndex = 0;
        this.phaseTick = 0;

        // Psionic abilities
        this.echoes = [];
        this.teleportCooldown = 0;
        this.realityFractureTriggered = false;
        this.inRealityFracture = false;

        this.phaseSeq = [
            { name: 'TELEPORT_STRIKE', duration: 140 },
            { name: 'PSYCHIC_FIELD', duration: 180 },
            { name: 'ECHO_SUMMON', duration: 160 },
            { name: 'MIND_CRUSH', duration: 120 },
            { name: 'PSIONIC_STORM', duration: 200 }
        ];

        const angle = Math.random() * Math.PI * 2;
        const dist = 2800;
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        this.turnSpeed = (Math.PI * 2) / (12 * SIM_FPS);
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
        this.teleportCooldown -= dtFactor;

        // Reality Fracture at 40% HP
        if (!this.realityFractureTriggered && this.hp / this.maxHp <= 0.4) {
            this.realityFractureTriggered = true;
            this.inRealityFracture = true;
            this.spawnEchoes(3); // Spawn 3 fake echoes
            showOverlayMessage("REALITY FRACTURE!", '#f0f', 2000);
            setTimeout(() => { this.inRealityFracture = false; }, 10000);
        }

        // Phase progression
        if (this.phaseTimer <= 0) {
            const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
            this.phaseIndex++;
            this.phaseName = next.name;
            this.phaseTimer = next.duration;
            this.phaseTick = 0;
            showOverlayMessage(`CEREBRAL PSION: ${this.phaseName}`, '#f0f', 900);

            // Teleport on phase change
            if (this.phaseName !== 'INTRO' && this.teleportCooldown <= 0) {
                this.teleport();
            }
        }

        // Movement style per phase - Cruiser-based
        const charging = false;
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

        this.innerShieldRotation -= 0.06 * dtFactor;
        super.update(deltaTime);

        // Phase attacks
        if (typeof this.phaseTickAccum === 'undefined') this.phaseTickAccum = 0;
        this.phaseTickAccum += dtFactor;
        while (this.phaseTickAccum >= 1) {
            this.phaseTickAccum -= 1;
            this.phaseTick++;
            this.runPhaseAttacks();
        }

        // Update echoes
        this.updateEchoes();
    }

    runPhaseAttacks() {
        if (!GameContext.player || GameContext.player.dead) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (this.phaseName === 'TELEPORT_STRIKE') {
            if (this.phaseTick % 40 === 0) {
                // Teleport near player
                const teleportDist = 500;
                const a = Math.random() * Math.PI * 2;
                this.pos.x = GameContext.player.pos.x + Math.cos(a) * teleportDist;
                this.pos.y = GameContext.player.pos.y + Math.sin(a) * teleportDist;
                this.prevPos.x = this.pos.x;
                this.prevPos.y = this.pos.y;
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 20, '#f0f');
            }
            if (this.phaseTick % 30 === 0) {
                // Flame breath cone
                this.fireFlameBreath(aim);
            }
            if (this.phaseTick % 50 === 0) {
                // Chitin spread
                for (let i = 0; i < 12; i++) {
                    const a = aim - 0.6 + (i / 11) * 1.2;
                    const b = new Bullet(this.pos.x, this.pos.y, a, 8, { owner: 'enemy', damage: 1, radius: 4, color: '#f6f' });
                    b.owner = this;
                    GameContext.bullets.push(b);
                }
                playSound('shotgun');
            }
        } else if (this.phaseName === 'PSYCHIC_FIELD') {
            if (this.phaseTick % 60 === 0) {
                // Homing missiles
                GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
                playSound('heavy_shoot');
            }
            // Psychic field - distorts player controls (visual only)
            if (this.phaseTick % 10 === 0) {
                if (_spawnParticles) _spawnParticles(this.pos.x + (Math.random() - 0.5) * 300, this.pos.y + (Math.random() - 0.5) * 300, 2, '#a0f');
            }
        } else if (this.phaseName === 'ECHO_SUMMON') {
            if (this.phaseTick % 80 === 0) {
                this.spawnEchoes(1);
            }
            // All echoes fire curtain pattern
            if (this.phaseTick % 15 === 0) {
                for (let i = -2; i <= 2; i++) {
                    const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.2, 10, { owner: 'enemy', damage: 1, radius: 3, color: '#f0f' });
                    b.owner = this;
                    GameContext.bullets.push(b);
                }
                playSound('rapid_shoot');
            }
        } else if (this.phaseName === 'MIND_CRUSH') {
            if (this.phaseTick % 20 === 0) {
                // Radial shockwave
                if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, '#f0f');
                // Push player away
                if (GameContext.player && !GameContext.player.dead) {
                    const dx = GameContext.player.pos.x - this.pos.x;
                    const dy = GameContext.player.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 800 && dist > 0) {
                        const pushForce = 15;
                        GameContext.player.vel.x += (dx / dist) * pushForce;
                        GameContext.player.vel.y += (dy / dist) * pushForce;
                    }
                }
            }
            // Tractor beam effect (pull player in)
            if (this.phaseTick % 5 === 0 && GameContext.player && !GameContext.player.dead) {
                const dx = this.pos.x - GameContext.player.pos.x;
                const dy = this.pos.y - GameContext.player.pos.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 1000 && dist > 0) {
                    GameContext.player.vel.x += (dx / dist) * 0.5;
                    GameContext.player.vel.y += (dy / dist) * 0.5;
                }
            }
        } else if (this.phaseName === 'PSIONIC_STORM') {
            if (this.phaseTick % 8 === 0) {
                // Teleport randomly
                const teleportDist = 600 + Math.random() * 400;
                const a = Math.random() * Math.PI * 2;
                this.pos.x = GameContext.player.pos.x + Math.cos(a) * teleportDist;
                this.pos.y = GameContext.player.pos.y + Math.sin(a) * teleportDist;
                this.prevPos.x = this.pos.x;
                this.prevPos.y = this.pos.y;
            }
            if (this.phaseTick % 12 === 0) {
                // All attacks rapid fire
                const b = new Bullet(this.pos.x, this.pos.y, aim, 12, { owner: 'enemy', damage: 1, radius: 3, color: '#f0f' });
                b.owner = this;
                GameContext.bullets.push(b);
                playSound('rapid_shoot');
            }
        }
    }

    fireFlameBreath(aim) {
        // Create flame breath area (damage zone)
        const range = 700;
        const cone = Math.PI / 4;
        // Visual indicator
        if (_spawnParticles) _spawnParticles(this.pos.x + Math.cos(aim) * 200, this.pos.y + Math.sin(aim) * 200, 10, '#f84');
        // Damage applied through collision in main loop
    }

    teleport() {
        const dist = 400 + Math.random() * 600;
        const angle = Math.random() * Math.PI * 2;
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        this.teleportCooldown = 90;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 25, '#f0f');
        playSound('warp_in');
    }

    spawnEchoes(count) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const echo = new PsychicEcho(this, angle);
            this.echoes.push(echo);
        }
    }

    updateEchoes() {
        this.echoes = this.echoes.filter(e => e && !e.dead);
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        // Clean up echoes
        this.echoes.forEach(e => { if (e && !e.dead) e.kill(); });
        this.echoes = [];

        pixiCleanupObject(this);
        if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 3.5, 26);
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 120, '#f0f');
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 22);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 24);

        for (let i = 0; i < 16; i++) {
            GameContext.coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 120, this.pos.y + (Math.random() - 0.5) * 120, 10));
        }
        for (let i = 0; i < 6; i++) {
            GameContext.nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 140, this.pos.y + (Math.random() - 0.5) * 140, 1));
        }
        GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

        GameContext.bossActive = false;
        if (GameContext.cerebralPsion === this) GameContext.cerebralPsion = null;
        if (GameContext.boss === this) GameContext.boss = null;

        showOverlayMessage("CEREBRAL PSION DESTROYED", '#f0f', 3000);
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
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = '#f0f';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const phaseText = this.phaseName || 'ACTIVE';
        ctx.fillText(`CEREBRAL PSION  (PHASE: ${phaseText})`, w / 2, y + 12);
        ctx.restore();
    }
}
