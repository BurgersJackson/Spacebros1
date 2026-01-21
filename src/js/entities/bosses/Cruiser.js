import { Enemy } from '../enemies/Enemy.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_FPS, SIM_STEP_MS } from '../../core/constants.js';
import { playSound, setMusicMode, musicEnabled } from '../../audio/audio-manager.js';
import { Bullet, CruiserMineBomb, FlagshipGuidedMissile } from '../projectiles/index.js';
import { HealthPowerUp } from '../pickups/index.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import { stopArenaCountdown } from '../../systems/event-scheduler.js';
import { pixiCleanupObject, clearArrayWithPixiCleanup, getRenderAlpha, pixiTextureRotOffsets, pixiVectorLayer } from '../../rendering/pixi-context.js';

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _spawnBarrelSmoke = null;
let _canvas = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerCruiserDependencies(deps) {
    if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
    if (deps.canvas) _canvas = deps.canvas;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class Cruiser extends Enemy {
    constructor(encounterIndex = 1) {
        super('gunboat', null, null, { gunboatLevel: 2 });
        const boost = Math.max(0, encounterIndex - 1);
        const hpScale = 1 + boost * 0.35;
        // Shield segment HP: 2 + (encounterIndex - 1) = increases by 1 per level
        let shieldStrength = 2 + boost;
        const baseCruiserHp = 150;
        this.type = 'cruiser';
        this.isCruiser = true;
        this.isGunboat = true;
        this.gunboatLevel = 2;

        this.cruiserHullScale = 6.2 * 1.25; // 25% larger (7.75)
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);
        let hp = Math.round(baseCruiserHp * hpScale);
        if (encounterIndex === 2) {
            hp = Math.round(hp * 1.25);
        }
        this.hp = hp;
        this.maxHp = this.hp;
        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
        this.shieldSegments = new Array(22).fill(shieldStrength);
        this.innerShieldSegments = new Array(18).fill(shieldStrength);
        this.innerShieldRotation = 0;
        this.gunboatShieldRecharge = 90;
        this.gunboatMuzzleDist = Math.round(6 * this.cruiserHullScale);
        this.cruiserWeaponRangeMult = 1.05625;
        this.baseGunboatRange = (900 + boost * 150) * this.cruiserWeaponRangeMult;
        this.gunboatRange = this.baseGunboatRange;
        this.cruiserBaseDamage = 1 + boost;
        this.cruiserFireDelay = Math.round(16 / 1.3);
        this.circleStrafePreferred = true;
        this.despawnImmune = true;
        this.disableShieldRegen = true;
        this.turretAngle = 0;
        this.shootTimer = this.cruiserFireDelay;
        this.encounterIndex = encounterIndex;
        this.visualAngleOffset = Math.PI;

        this.disableAutoFire = true;

        this.shieldStrength = shieldStrength;
        
        // Invulnerability after CHARGE phase: 120 frames + 30 per level
        this.invulnerableDurationFrames = 120 + boost * 30;
        this.invulnerableTimer = 0;
        
        // Charge attack system
        this.chargeTelegraphDuration = 60; // 1 second at 60fps
        this.chargeTelegraphTimer = 0;
        this.chargeDuration = 160; // 2.67 seconds charging (full charge distance)
        this.chargeTimer = 0;
        this.chargeState = 'none'; // 'telegraph', 'charging', 'none'
        this.chargeDirection = 0;
        this.chargeStartPos = { x: 0, y: 0 };
        this.chargeTargetPos = { x: 0, y: 0 };
        
        this.phaseName = 'INTRO';
        this.phaseTimer = 45;
        this.phaseIndex = 0;
        this.phaseTick = 0;
        this.helperScale = 0.5 * hpScale;
        this.helperHpMult = this.helperScale;
        this.helperMax = Math.max(2, Math.round(6 * this.helperScale));
        this.helperCall70 = Math.max(1, Math.round(2 * this.helperScale));
        this.helperCall40 = Math.max(1, Math.round(3 * this.helperScale));
        this.helperBurst = Math.max(1, Math.round(2 * this.helperScale));
        this.helperCooldownBase = Math.round(210 / Math.max(0.25, this.helperScale));
        this.helperCooldown = Math.round(90 / Math.max(0.25, this.helperScale));
        this.helperStrengthTier = (encounterIndex <= 1) ? 0 : (encounterIndex === 2 ? 1 : 2);
        this.called70 = false;
        this.called40 = false;
        this.lastShieldGenAt = 0;

        this.guidedMissileEnabled = (encounterIndex === 2);
        this.guidedMissileCd = 90;
        this.guidedMissileInterval = 90;
        this.guidedMissileCap = 2;

        this.turnSpeed = (Math.PI * 2) / (18 * SIM_FPS);
        this.wallElasticity = 0.25;

        const hardHp = Math.round((18 + boost * 6) * hpScale);
        const hs = this.cruiserHullScale;
        this.hardpointMaxHp = 5;
        this.hardpointHpRegenMs = 3000;
        this.lastHpRegenTime = Date.now();
        this.fightDuration = 0;
        this.hardpoints = [
            { id: 'LC', type: 'cannon', off: { x: -20 * hs, y: -4 * hs }, r: 3.2 * hs, hp: hardHp, maxHp: hardHp, cd: 0 },
            { id: 'RC', type: 'cannon', off: { x: 20 * hs, y: -4 * hs }, r: 3.2 * hs, hp: hardHp, maxHp: hardHp, cd: 0 },
            { id: 'SP', type: 'sprayer', off: { x: 0, y: -12 * hs }, r: 3.7 * hs, hp: Math.round(hardHp * 1.1), maxHp: Math.round(hardHp * 1.1), cd: 0 },
            { id: 'MB', type: 'bay', off: { x: 0, y: 12 * hs }, r: 3.7 * hs, hp: Math.round(hardHp * 1.1), maxHp: Math.round(hardHp * 1.1), cd: 0 },
            { id: 'SG', type: 'shieldgen', off: { x: 0, y: 3 * hs }, r: 3.4 * hs, hp: Math.round(hardHp * 1.2), maxHp: Math.round(hardHp * 1.2), cd: 0 }
        ];

        this.phaseSeq = [
            { name: 'SALVO', duration: 180 },
            { name: 'CURTAIN', duration: 150 },
            { name: 'MINEFIELD', duration: 150 },
            { name: 'SWEEP', duration: 150 },
            { name: 'CHARGE', duration: 110 }
        ];
        const rot = encounterIndex % this.phaseSeq.length;
        this.phaseSeq = this.phaseSeq.slice(rot).concat(this.phaseSeq.slice(0, rot));

        const angle = Math.random() * Math.PI * 2;
        const dist = 3000;
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
    }

    hardpointWorld(hp) {
        const ang = this.angle + (this.visualAngleOffset || 0);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const ox = hp.off.x;
        const oy = hp.off.y;
        return { x: this.pos.x + ox * ca - oy * sa, y: this.pos.y + ox * sa + oy * ca };
    }

    hasHardpoint(type) {
        return this.hardpoints.some(h => h.hp > 0 && h.type === type);
    }

    livingHardpoints() {
        return this.hardpoints.filter(h => h.hp > 0);
    }

    updateAIState() {
        this.aiTimer = 999999;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        
        if (this._pixiInvulGfx) {
            try {
                if (this._pixiInvulGfx.parent) this._pixiInvulGfx.parent.removeChild(this._pixiInvulGfx);
                this._pixiInvulGfx.destroy(true);
            } catch (e) { }
            this._pixiInvulGfx = null;
        }
        if (this._pixiInnerGfx) {
            try {
                if (this._pixiInnerGfx.parent) this._pixiInnerGfx.parent.removeChild(this._pixiInnerGfx);
                this._pixiInnerGfx.destroy(true);
            } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try {
                if (this._pixiGfx.parent) this._pixiGfx.parent.removeChild(this._pixiGfx);
                this._pixiGfx.destroy(true);
            } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiHardpointsGfx) {
            try {
                if (this._pixiHardpointsGfx.parent) this._pixiHardpointsGfx.parent.removeChild(this._pixiHardpointsGfx);
                this._pixiHardpointsGfx.destroy(true);
            } catch (e) { }
            this._pixiHardpointsGfx = null;
        }
        if (this._pixiTelegraphGfx) {
            try {
                if (this._pixiTelegraphGfx.parent) this._pixiTelegraphGfx.parent.removeChild(this._pixiTelegraphGfx);
                this._pixiTelegraphGfx.destroy(true);
            } catch (e) { }
            this._pixiTelegraphGfx = null;
        }
        if (this._pixiNameText) {
            try {
                this._pixiNameText.destroy(true);
            } catch (e) { }
            this._pixiNameText = null;
        }

        // FIX: Ensure sprite is removed from its parent layer before cleanup
        // This prevents sprites from being left behind if the pool cleanup fails
        if (this.sprite && this.sprite.parent) {
            try {
                this.sprite.parent.removeChild(this.sprite);
            } catch (e) {
                console.warn('Failed to remove Cruiser sprite from parent:', e);
            }
        }

        pixiCleanupObject(this);
        const boomScale = Math.max(2.6, Math.min(5, (this.radius || 160) / 40));
        if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 26);
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 4.0);
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 120, '#f00');
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 22);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 24);
        clearArrayWithPixiCleanup(GameContext.bossBombs);
        // Award coins directly: 13 coins * 10 value = 130 total
        if (_awardCoinsInstant) _awardCoinsInstant(130, { noSound: false, sound: 'coin' });
        // Award nuggets directly: 5 nuggets
        if (_awardNuggetsInstant) _awardNuggetsInstant(5, { noSound: false, sound: 'coin' });
        GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));
        GameContext.bossActive = false;
        if (GameContext.cruiserEncounterCount === 2) {
            GameContext.pendingStations = 1;
            GameContext.nextSpaceStationTime = Date.now() + 30000;
            showOverlayMessage("CRUISER DESTROYED - SPACE STATION IN 30s", '#f80', 4000);
        } else {
            showOverlayMessage("CRUISER DESTROYED", '#0f0', 3000);
        }
        if (musicEnabled) setMusicMode('normal');
        try {
            const delay = GameContext.dreadManager.minDelayMs + Math.floor(Math.random() * (GameContext.dreadManager.maxDelayMs - GameContext.dreadManager.minDelayMs + 1));
            GameContext.dreadManager.timerAt = Date.now() + delay;
            GameContext.dreadManager.timerActive = true;
            GameContext.dreadManager.firstSpawnDone = true;
        } catch (e) { console.warn('failed to start cruiser timer', e); }
        GameContext.boss = null;
        stopArenaCountdown();
    }

    update(deltaTime = SIM_STEP_MS) {
        const now = Date.now();
        const dtFactor = deltaTime / 16.67;

        this.phaseTimer -= dtFactor;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dtFactor;

        if (this.phaseTimer <= 0) {
            const prev = this.phaseName;
            if (prev === 'CHARGE') {
                this.invulnerableTimer = this.invulnerableDurationFrames;
            }
            // Reset charge state when leaving CHARGE phase
            if (this.phaseName === 'CHARGE') {
                this.chargeState = 'none';
                this.chargeTelegraphTimer = 0;
                this.chargeTimer = 0;
            }

            for (let attempts = 0; attempts < this.phaseSeq.length; attempts++) {
                const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
                this.phaseIndex++;
                if (next.name === 'SALVO' && !this.hasHardpoint('cannon')) continue;
                if ((next.name === 'CURTAIN' || next.name === 'SWEEP') && !this.hasHardpoint('sprayer')) continue;
                if ((next.name === 'MINEFIELD') && !this.hasHardpoint('bay')) continue;
                this.phaseName = next.name;
                this.phaseTimer = next.duration;
                this.phaseTick = 0;
                showOverlayMessage(`BOSS: ${this.phaseName}`, '#f0f', 900);
                
                // Initialize charge telegraph when entering CHARGE phase
                if (this.phaseName === 'CHARGE') {
                    this.chargeState = 'telegraph';
                    this.chargeTelegraphTimer = this.chargeTelegraphDuration;
                    // Calculate charge direction toward player
                    this.chargeDirection = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
                    // Store start position for telegraphic box
                    this.chargeStartPos = { x: this.pos.x, y: this.pos.y };
                    // Calculate target position (far in charge direction)
                    const chargeDistance = 4000;
                    this.chargeTargetPos = {
                        x: this.pos.x + Math.cos(this.chargeDirection) * chargeDistance,
                        y: this.pos.y + Math.sin(this.chargeDirection) * chargeDistance
                    };
                    // Face the charge direction
                    this.angle = this.chargeDirection + (this.visualAngleOffset || 0);
                }
                break;
            }
        }

        // Handle charge states
        if (this.phaseName === 'CHARGE') {
            if (this.chargeState === 'telegraph') {
                this.chargeTelegraphTimer -= dtFactor;
                // Stop movement during telegraph (don't accumulate slowdown)
                this.vel.x = 0;
                this.vel.y = 0;
                this.aiState = 'IDLE';
                
                if (this.chargeTelegraphTimer <= 0) {
                    this.chargeState = 'charging';
                    this.chargeTimer = this.chargeDuration;
                }
            } else if (this.chargeState === 'charging') {
                this.chargeTimer -= dtFactor;
                // Move straight in charge direction
                const chargeSpeed = 25;
                this.vel.x = Math.cos(this.chargeDirection) * chargeSpeed;
                this.vel.y = Math.sin(this.chargeDirection) * chargeSpeed;
                // Override position interpolation for smooth movement
                this.pos.x += this.vel.x * dtFactor;
                this.pos.y += this.vel.y * dtFactor;
                
                if (this.chargeTimer <= 0) {
                    // Charge complete
                    this.chargeState = 'none';
                    this.chargeTimer = 0;
                }
            }
        } else {
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
                this.thrustPower = 0.92;
                this.maxSpeed = 13.8;
            } else if (this.moveMode === 'ORBIT') {
                this.circleStrafePreferred = false;
                this.aiState = 'ORBIT';
                this.thrustPower = 0.8625;
                this.maxSpeed = 11.5;
            } else if (this.moveMode === 'FLANK') {
                this.circleStrafePreferred = false;
                this.aiState = 'FLANK';
                this.thrustPower = 0.9775;
                this.maxSpeed = 14.95;
            } else {
                this.circleStrafePreferred = true;
                this.aiState = 'CIRCLE';
                this.thrustPower = 0.7475;
                this.maxSpeed = 10.35;
            }
            this.gunboatRange = this.baseGunboatRange;
        }

        this.innerShieldRotation -= 0.08 * (deltaTime / 16.67);
        super.update(deltaTime);

        if (!this.lastShieldGenAt) this.lastShieldGenAt = now;
        if (now - this.lastShieldGenAt >= 1500) {
            const idx1 = this.shieldSegments.findIndex(s => s < this.shieldStrength);
            if (idx1 !== -1) this.shieldSegments[idx1] = Math.min(this.shieldStrength, this.shieldSegments[idx1] + 1);
            const idx2 = this.innerShieldSegments.findIndex(s => s < this.shieldStrength);
            if (idx2 !== -1) this.innerShieldSegments[idx2] = Math.min(this.shieldStrength, this.innerShieldSegments[idx2] + 1);
            this.lastShieldGenAt = now;
            if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, '#0ff');
        }

        if (typeof this.phaseTickAccum === 'undefined') this.phaseTickAccum = 0;
        this.phaseTickAccum += dtFactor;
        while (this.phaseTickAccum >= 1) {
            this.phaseTickAccum -= 1;
            this.phaseTick++;
            this.runPhaseAttacks();
        }

        this.maybeCallHelpers();

        if (this.guidedMissileEnabled && GameContext.bossActive && GameContext.boss === this) {
            this.guidedMissileCd -= (deltaTime / 16.67);
            if (this.guidedMissileCd <= 0) {
                const alive = GameContext.guidedMissiles.filter(m => m && !m.dead).length;
                if (alive < this.guidedMissileCap) {
                    GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
                    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, '#fa0');
                    playSound('heavy_shoot');
                }
                this.guidedMissileCd = this.guidedMissileInterval;
            }
        }
    }

    runPhaseAttacks() {
        if (!GameContext.player || GameContext.player.dead) return;

        for (let i = 0; i < this.hardpoints.length; i++) this.hardpoints[i].cd--;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (this.phaseName === 'SALVO') {
            if (this.phaseTick % 11 === 0) {
                this.fireCannons(aim, 3, 0.18, 18, this.cruiserBaseDamage, '#f44');
            }
        } else if (this.phaseName === 'CURTAIN') {
            if (this.phaseTick % 5 === 0) {
                this.fireSprayerFan(aim, 11, 1.1, 10, 1, '#f0f');
            }
            if (this.phaseTick % 35 === 0 && this.hasHardpoint('cannon')) {
                this.fireCannons(aim, 2, 0.12, 20, this.cruiserBaseDamage, '#ff0');
            }
        } else if (this.phaseName === 'MINEFIELD') {
            if (this.phaseTick % 45 === 1) {
                this.launchMinefieldBombs();
            }
        } else if (this.phaseName === 'SWEEP') {
            if (this.phaseTick % 2 === 0) {
                const t = (this.phaseTick % 120) / 120;
                const a = (Math.PI / 2 - 1.1) + t * 2.2;
                this.fireSprayerSingle(a, 12, 1, '#0ff');
            }
            if (this.phaseTick % 40 === 0) {
                this.fireRing(14, 8.4, 1, '#ff0');
            }
        }
        // CHARGE phase now uses telegraph/charge system instead of projectile attacks
    }

    fireCannons(baseAngle, shots, spread, speed, dmg, color) {
        const cannons = this.hardpoints.filter(h => h.hp > 0 && h.type === 'cannon');
        const life = Math.round(100 * this.cruiserWeaponRangeMult);
        for (let c = 0; c < cannons.length; c++) {
            const hp = cannons[c];
            const p = this.hardpointWorld(hp);
            for (let i = 0; i < shots; i++) {
                const t = shots === 1 ? 0 : (i / (shots - 1) - 0.5);
                const a = baseAngle + t * spread;
                const shot = new Bullet(p.x, p.y, a, speed, { owner: 'enemy', damage: dmg, radius: 4, color, life });
                GameContext.bullets.push(shot);
                if (_spawnBarrelSmoke) _spawnBarrelSmoke(p.x, p.y, a);
            }
        }
        playSound('rapid_shoot');
    }

    fireSprayerFan(baseAngle, count, spread, speed, dmg, color) {
        const spr = this.hardpoints.find(h => h.hp > 0 && h.type === 'sprayer');
        if (!spr) return;
        const life = Math.round(120 * 0.75 * this.cruiserWeaponRangeMult); // 25% reduced range
        const p = this.hardpointWorld(spr);
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
            const a = baseAngle + t * spread;
            const b = new Bullet(p.x, p.y, a, speed, { owner: 'enemy', damage: dmg, radius: 4, color, life });
            GameContext.bullets.push(b);
        }
        playSound('shoot');
    }

    fireSprayerSingle(angle, speed, dmg, color) {
        const spr = this.hardpoints.find(h => h.hp > 0 && h.type === 'sprayer');
        if (!spr) return;
        const life = Math.round(110 * 0.75 * this.cruiserWeaponRangeMult); // 25% reduced range
        const p = this.hardpointWorld(spr);
        const b = new Bullet(p.x, p.y, angle, speed, { owner: 'enemy', damage: dmg, radius: 4, color, life });
        GameContext.bullets.push(b);
    }

    dropMine(angle, speed, dmg, color) {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        if (!bay) return;
        const life = Math.round(220 * this.cruiserWeaponRangeMult);
        const p = this.hardpointWorld(bay);
        const b = new Bullet(p.x, p.y, angle, speed, { owner: 'enemy', damage: dmg, radius: 11, color, life, style: 'square' });
        GameContext.bullets.push(b);
        playSound('heavy_shoot');
    }

    launchMinefieldBombs() {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        if (!bay) return;
        const count = 5;
        const base = Math.random() * Math.PI * 2;
        const maxTravel = this.baseGunboatRange;
        const blastRadius = this.radius * 1.3 * 1.5;
        const dmg = Math.max(2, Math.round(this.cruiserBaseDamage));
        for (let i = 0; i < count; i++) {
            const a = base + (Math.PI * 2 / count) * i;
            GameContext.bossBombs.push(new CruiserMineBomb(this, a, maxTravel, dmg, blastRadius));
        }
        playSound('heavy_shoot');
    }

    fireRing(n, speed, dmg, color) {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        const p = bay ? this.hardpointWorld(bay) : { x: this.pos.x, y: this.pos.y };
        const life = Math.round(226 * this.cruiserWeaponRangeMult);
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const b = new Bullet(p.x, p.y, a, speed, { owner: 'enemy', damage: dmg, radius: 4, color, life });
            GameContext.bullets.push(b);
        }
        playSound('shotgun');
    }

    maybeCallHelpers() {
        if (!GameContext.bossActive) return;
        if (!GameContext.player || GameContext.player.dead) return;

        const aliveHelpers = GameContext.enemies.filter(e => e && !e.dead).length;
        const maxHelpers = this.helperMax;

        const hpPct = this.hp / this.maxHp;
        if (!this.called70 && hpPct <= 0.7) {
            this.called70 = true;
            this.spawnHelpers(this.helperCall70);
        }
        if (!this.called40 && hpPct <= 0.4) {
            this.called40 = true;
            this.spawnHelpers(this.helperCall40);
        }

        this.helperCooldown--;
        if (this.helperCooldown <= 0 && aliveHelpers < maxHelpers) {
            const burst = Math.min(this.helperBurst, maxHelpers - aliveHelpers);
            this.spawnHelpers(burst);
            this.helperCooldown = this.helperCooldownBase;
        }
    }

    spawnHelpers(count) {
        const aliveHelpers = GameContext.enemies.filter(e => e && !e.dead).length;
        const slots = Math.max(0, this.helperMax - aliveHelpers);
        if (slots <= 0) return;
        count = Math.min(count, slots);
        let types = ['roamer', 'roamer', 'elite_roamer'];
        if (this.helperStrengthTier <= 0) types = ['roamer', 'roamer', 'roamer'];
        else if (this.helperStrengthTier >= 2) types = ['roamer', 'elite_roamer', 'hunter'];
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const a = Math.random() * Math.PI * 2;
            const d = 260 + Math.random() * 260;
            const e = new Enemy(type, { x: this.pos.x + Math.cos(a) * d, y: this.pos.y + Math.sin(a) * d });
            e.hp = Math.max(1, Math.round(e.hp * this.helperHpMult));
            if (e.shieldSegments && e.shieldSegments.length > 0) {
                const segMult = this.helperHpMult;
                e.shieldSegments = e.shieldSegments.map(s => Math.max(0, Math.round(s * segMult)));
            }
            GameContext.enemies.push(e);
        }
        showOverlayMessage("BOSS CALLED REINFORCEMENTS", '#f00', 1100);
    }

    applyPlayerBulletHit(b) {
        if (!b || b.isEnemy) return false;
        if (this.invulnerableTimer > 0) return false;
        for (let i = 0; i < this.hardpoints.length; i++) {
            const hp = this.hardpoints[i];
            if (hp.hp <= 0) continue;
            const p = this.hardpointWorld(hp);
            const dist = Math.hypot(b.pos.x - p.x, b.pos.y - p.y);
            if (dist < hp.r + b.radius) {
                hp.hp -= b.damage;
                if (_spawnParticles) _spawnParticles(p.x, p.y, 6, '#fff');
                playSound('hit');
                if (hp.hp <= 0) {
                    if (_spawnParticles) _spawnParticles(p.x, p.y, 40, '#ff0');
                    showOverlayMessage(`HARDPOINT ${hp.id} DESTROYED`, '#ff0', 1200);
                }
                return true;
            }
        }
        return false;
    }

    drawBossHud(ctx) {
        if (!GameContext.bossActive || this.dead) return;
        const w = _canvas ? _canvas.width : GameContext.width;
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = this.invulnerableTimer > 0 ? '#ff0' : '#f00';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const phaseText = this.invulnerableTimer > 0 ? `${this.phaseName} (INVULNERABLE)` : this.phaseName;
        const bossName = this.isFlagship ? 'FLAGSHIP' : 'CRUISER';
        ctx.fillText(`${bossName}  (PHASE: ${phaseText})`, w / 2, y + 12);

        ctx.font = 'bold 11px Courier New';
        ctx.fillStyle = '#ff0';
        const hpStr = this.hardpoints.map(h => `${h.id}:${h.hp > 0 ? 'ON' : 'OFF'}`).join('  ');
        ctx.fillText(hpStr, w / 2, y + 26);
        ctx.restore();
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.dead) {
            // Ensure all graphics are cleaned up if draw is called after death
            if (this._pixiHardpointsGfx) {
                try {
                    if (this._pixiHardpointsGfx.parent) this._pixiHardpointsGfx.parent.removeChild(this._pixiHardpointsGfx);
                    this._pixiHardpointsGfx.destroy(true);
                } catch (e) { }
                this._pixiHardpointsGfx = null;
            }
            if (this._pixiInvulGfx) {
                try {
                    if (this._pixiInvulGfx.parent) this._pixiInvulGfx.parent.removeChild(this._pixiInvulGfx);
                    this._pixiInvulGfx.destroy(true);
                } catch (e) { }
                this._pixiInvulGfx = null;
            }
            if (this._pixiTelegraphGfx) {
                try {
                    if (this._pixiTelegraphGfx.parent) this._pixiTelegraphGfx.parent.removeChild(this._pixiTelegraphGfx);
                    this._pixiTelegraphGfx.destroy(true);
                } catch (e) { }
                this._pixiTelegraphGfx = null;
            }
            return;
        }

        // FIX: Use cached render position from Enemy.draw() to ensure sync with sprite/shields
        const rPos = this._cachedRenderPos || this.pos;
        // FIX: Account for texture rotation offset in hardpoint positioning
        // The hardpoint offsets are defined in the sprite's local coordinate system (with texture rotation baked in)
        // So we need to rotate the offsets by the texture rotation offset before applying the ship's angle
        const textureRotOffset = pixiTextureRotOffsets?.enemy_cruiser || 0;
        const ang = this.angle + (this.visualAngleOffset || 0);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        // Pre-compute texture rotation sin/cos for offset transformation
        const troCos = Math.cos(textureRotOffset);
        const troSin = Math.sin(textureRotOffset);

        // Hardpoints - use PIXI Graphics for consistent positioning with sprite/shields
        if (pixiVectorLayer) {
            let hpGfx = this._pixiHardpointsGfx;
            if (!hpGfx) {
                hpGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(hpGfx);
                this._pixiHardpointsGfx = hpGfx;
            } else if (!hpGfx.parent) {
                pixiVectorLayer.addChild(hpGfx);
            }

            // Position at rPos and rotate with ship angle + texture offset
            hpGfx.position.set(rPos.x, rPos.y);
            hpGfx.rotation = ang + textureRotOffset;
            hpGfx.clear();

            for (let i = 0; i < this.hardpoints.length; i++) {
                const hp = this.hardpoints[i];
                const alive = hp.hp > 0;

                // Draw hardpoint at local offset (rotation is handled by container)
                const fillColor = alive ? 0x222222 : 0x004400;
                const strokeColor = alive ? 0xffff00 : 0x00ff00;
                const alpha = alive ? 1 : 0.35;

                hpGfx.beginFill(fillColor, alpha);
                hpGfx.lineStyle(2, strokeColor, alpha);
                hpGfx.drawCircle(hp.off.x, hp.off.y, hp.r);
                hpGfx.endFill();
            }
            hpGfx.visible = true;
        }

        // Invulnerable shield indicator - cyan pulsing ring
        if (this.invulnerableTimer > 0 && pixiVectorLayer) {
            let invulGfx = this._pixiInvulGfx;
            if (!invulGfx) {
                invulGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(invulGfx);
                this._pixiInvulGfx = invulGfx;
            } else if (!invulGfx.parent) {
                pixiVectorLayer.addChild(invulGfx);
            }

            invulGfx.position.set(rPos.x, rPos.y);
            invulGfx.clear();

            // Pulsing alpha effect
            const alpha = 0.35 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.25;
            invulGfx.lineStyle(4, 0xffff00, alpha);
            invulGfx.drawCircle(0, 0, this.shieldRadius + 5);
            invulGfx.visible = true;
        } else if (this._pixiInvulGfx) {
            this._pixiInvulGfx.visible = false;
        }

        // Charge telegraphic visualization - hollow box showing charge path
        if (this.chargeState === 'telegraph' && pixiVectorLayer) {
            let teleGfx = this._pixiTelegraphGfx;
            if (!teleGfx) {
                teleGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(teleGfx);
                this._pixiTelegraphGfx = teleGfx;
            } else if (!teleGfx.parent) {
                pixiVectorLayer.addChild(teleGfx);
            }

            teleGfx.clear();
            teleGfx.lineStyle(3, 0xff0066, 0.8);
            
            // Position at ship start position
            teleGfx.position.set(this.chargeStartPos.x, this.chargeStartPos.y);
            
            // Draw hollow box from start to target position
            const boxWidth = this.radius * 1.8;
            const halfW = boxWidth / 2;
            
            // Calculate perpendicular offset for box sides
            const perpAngle = this.chargeDirection + Math.PI / 2;
            const perpX = Math.cos(perpAngle) * halfW;
            const perpY = Math.sin(perpAngle) * halfW;
            
            // Calculate box target relative to start
            const chargeDistance = 4000;
            const tx = Math.cos(this.chargeDirection) * chargeDistance;
            const ty = Math.sin(this.chargeDirection) * chargeDistance;
            
            // Draw rectangle outline
            teleGfx.moveTo(0 + perpX, 0 + perpY);
            teleGfx.lineTo(tx + perpX, ty + perpY);
            teleGfx.lineTo(tx - perpX, ty - perpY);
            teleGfx.lineTo(0 - perpX, 0 - perpY);
            teleGfx.closePath();
            
            // Draw arrow head at target
            const arrowSize = 30;
            const arrowX = Math.cos(this.chargeDirection) * arrowSize;
            const arrowY = Math.sin(this.chargeDirection) * arrowSize;
            
            teleGfx.moveTo(tx - arrowX, ty - arrowY);
            teleGfx.lineTo(tx + arrowX, ty + arrowY);
            teleGfx.moveTo(tx - arrowX - perpX, ty - arrowY - perpY);
            teleGfx.lineTo(tx + arrowX, ty + arrowY);
            
            teleGfx.visible = true;
        } else if (this._pixiTelegraphGfx) {
            this._pixiTelegraphGfx.visible = false;
        }

        // Debug visualization for Ctrl+H
        this.drawDebug(ctx, rPos);
    }

    // Debug visualization for Ctrl+H
    drawDebug(ctx, rPos) {
        if (!GameContext.DEBUG_COLLISION) return;

        // Draw a bright yellow circle showing where we think the ship center is
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, this.shieldRadius + 15, 0, Math.PI * 2);
        ctx.stroke();

        // Draw crosshairs at the center
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rPos.x - 20, rPos.y);
        ctx.lineTo(rPos.x + 20, rPos.y);
        ctx.moveTo(rPos.x, rPos.y - 20);
        ctx.lineTo(rPos.x, rPos.y + 20);
        ctx.stroke();

        // Draw where each hardpoint is
        ctx.fillStyle = '#00FF00';
        for (let i = 0; i < this.hardpoints.length; i++) {
            const hp = this.hardpoints[i];

            // Recalculate the same position as in draw()
            const textureRotOffset = pixiTextureRotOffsets?.enemy_cruiser || 0;
            const ang = this.angle + (this.visualAngleOffset || 0);
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            const troCos = Math.cos(textureRotOffset);
            const troSin = Math.sin(textureRotOffset);

            const ox = hp.off.x * troCos - hp.off.y * troSin;
            const oy = hp.off.x * troSin + hp.off.y * troCos;
            const px = rPos.x + ox * ca - oy * sa;
            const py = rPos.y + ox * sa + oy * ca;

            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw a circle showing the shield radius
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, this.shieldRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

