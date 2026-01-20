import { Flagship } from './Flagship.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Enemy } from '../enemies/Enemy.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import { clearArrayWithPixiCleanup, pixiCleanupObject } from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _spawnLargeExplosion = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;
let _endGame = null;
let _killPlayer = null;
let _updateHealthUI = null;
let _closestPointOnSegment = null;
let _canvas = null;

/**
 * @param {Object} deps
 * @returns {void}
 */
export function registerSuperFlagshipDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
    if (deps.endGame) _endGame = deps.endGame;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.closestPointOnSegment) _closestPointOnSegment = deps.closestPointOnSegment;
    if (deps.canvas) _canvas = deps.canvas;
}

export class SuperFlagshipBoss extends Flagship {
    constructor(spawnAt = null) {
        super(spawnAt);
        this.type = 'super_flagship';
        this.isSuperFlagship = true;
        this.despawnImmune = true;

        this.cruiserHullScale = 10.4;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);
        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);

        this.hp = Math.round(this.hp * 2.1 + 220);
        this.maxHp = this.hp;

        this.shieldStrength = Math.max(4, this.shieldStrength + 2);
        this.shieldSegments = new Array(18).fill(this.shieldStrength);
        this.innerShieldSegments = new Array(28).fill(this.shieldStrength);

        this.helperScale = 0.55;
        this.helperHpMult = 0.9;
        this.helperMax = 7;
        this.helperBurst = 3;
        this.helperCooldownBase = 520;
        this.helperCooldown = 200;
        this.helperCall70 = 2;
        this.helperCall40 = 3;
        this.helperStrengthTier = 2;

        this.guidedMissileInterval = 340;
        this.guidedMissileCap = 3;

        this.caveLaserCooldown = 260;
        this.caveLaserCharge = 0;
        this.caveLaserChargeTotal = 70;
        this.caveLaserFire = 0;
        this.caveLaserFireTotal = 22;
        this.caveLaserAngle = 0;
        this.caveLaserLen = 6000;
        this.caveLaserWidth = 44;
        this.caveLaserSweep = 1.0;
        this.caveLaserHitThisShot = false;
        this.caveSummonCooldown = 260;
    }

    cavePhase2() {
        return this.hp <= this.maxHp * 0.5;
    }

    applyDamageToPlayer(amount) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (GameContext.player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                if (GameContext.player.outerShieldSegments[i] > 0) {
                    const absorb = Math.min(remaining, GameContext.player.outerShieldSegments[i]);
                    GameContext.player.outerShieldSegments[i] -= absorb;
                    remaining -= absorb;
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
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 14, '#f00');
            playSound('hit');
            if (_updateHealthUI) _updateHealthUI();
            if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
        } else {
            playSound('shield_hit');
            if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#0ff');
        }
        GameContext.player.invulnerable = 0;
    }

    update(deltaTime = SIM_STEP_MS) {
        super.update();
        if (this.dead) return;
        if (!GameContext.bossActive || GameContext.boss !== this) return;
        if (!GameContext.player || GameContext.player.dead) return;

        const phase2 = this.cavePhase2();
        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
            const bounds = GameContext.caveLevel.boundsAt(this.pos.y);
            const pad = this.radius + 220;
            const cx = Math.max(bounds.left + pad, Math.min(bounds.right - pad, GameContext.caveLevel.centerXAt(this.pos.y)));
            this.vel.x += (cx - this.pos.x) * 0.0022;
            this.vel.x *= 0.96;
        }

        if (this.caveLaserFire > 0) {
            this.caveLaserFire--;
            const sweep = this.caveLaserSweep;
            const t = 1 - (this.caveLaserFire / Math.max(1, this.caveLaserFireTotal));
            const a0 = this.caveLaserAngle - sweep * 0.5;
            const a = a0 + sweep * t;

            const applyHit = (angle, damage) => {
                if (this.caveLaserHitThisShot) return;
                const ex = this.pos.x + Math.cos(angle) * this.caveLaserLen;
                const ey = this.pos.y + Math.sin(angle) * this.caveLaserLen;
                const cp = _closestPointOnSegment
                    ? _closestPointOnSegment(GameContext.player.pos.x, GameContext.player.pos.y, this.pos.x, this.pos.y, ex, ey)
                    : { x: this.pos.x, y: this.pos.y };
                const d = Math.hypot(GameContext.player.pos.x - cp.x, GameContext.player.pos.y - cp.y);
                const hitDist = (this.caveLaserWidth * 0.5) + (GameContext.player.radius * 0.55);
                if (d <= hitDist) {
                    this.caveLaserHitThisShot = true;
                    this.applyDamageToPlayer(damage);
                    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 12);
                    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 12);
                }
            };

            applyHit(a, phase2 ? 7 : 6);
            if (phase2) applyHit(a + 0.22, 6);
        } else if (this.caveLaserCharge > 0) {
            this.caveLaserCharge--;
            if (this.caveLaserCharge === 0) {
                this.caveLaserFire = this.caveLaserFireTotal;
                this.caveLaserHitThisShot = false;
                playSound('heavy_shoot');
            }
        } else {
            this.caveLaserCooldown--;
            if (this.caveLaserCooldown <= 0) {
                this.caveLaserAngle = aim;
                this.caveLaserSweep = phase2 ? 1.9 : 1.35;
                this.caveLaserChargeTotal = phase2 ? 55 : 70;
                this.caveLaserFireTotal = phase2 ? 26 : 22;
                this.caveLaserCharge = this.caveLaserChargeTotal;
                this.caveLaserFire = 0;
                this.caveLaserHitThisShot = false;
                this.caveLaserCooldown = (phase2 ? 220 : 320) + Math.floor(Math.random() * 220);
            }
        }

        this.caveSummonCooldown--;
        if (this.caveSummonCooldown <= 0) {
            const count = phase2 ? 4 : 3;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = 420 + Math.random() * 520;
                const type = (phase2 && Math.random() < 0.45) ? 'hunter' : 'defender';
                GameContext.enemies.push(new Enemy(type, { x: this.pos.x + Math.cos(a) * d, y: this.pos.y + Math.sin(a) * d }, null));
            }
            showOverlayMessage("SUPER FLAGSHIP DEPLOYED DEFENDERS", '#f0f', 1200, 2);
            this.caveSummonCooldown = (phase2 ? 240 : 340) + Math.floor(Math.random() * 260);
        }
    }

    drawBossHud(ctx) {
        if (!GameContext.bossActive || this.dead) return;
        const w = _canvas ? _canvas.width : GameContext.width;
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);
        const phase = this.cavePhase2() ? 'PHASE 2' : (this.phaseName || 'PHASE 1');

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = this.vulnerableTimer > 0 ? '#ff0' : '#0ff';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`SUPER FLAGSHIP  (${phase})`, w / 2, y + 12);
        ctx.restore();
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
        pixiCleanupObject(this);
        playSound('base_explode');

        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 6.0);

        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 260, '#0ff');
        clearArrayWithPixiCleanup(GameContext.bossBombs);
        clearArrayWithPixiCleanup(GameContext.guidedMissiles);

        if (_awardCoinsInstant) _awardCoinsInstant(80 * 10, { noSound: false, sound: 'coin', color: '#ff0' });
        // Award nuggets directly: 24 nuggets
        if (_awardNuggetsInstant) _awardNuggetsInstant(24, { noSound: false, sound: 'coin' });

        GameContext.bossActive = false;
        GameContext.bossArena.active = false;
        GameContext.bossArena.growing = false;
        if (GameContext.boss) pixiCleanupObject(GameContext.boss);
        GameContext.boss = null;

        showOverlayMessage("SUPER FLAGSHIP DESTROYED - MISSION COMPLETE", '#0f0', 5000, 5);

        let elapsed = 0;
        const now = Date.now();
        if (GameContext.gameStartTime) {
            elapsed = now - GameContext.gameStartTime - (GameContext.pausedAccumMs || 0);
            if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - (GameContext.pausedAccumMs || 0);
            if (elapsed < 0) elapsed = 0;
        }
        if (_endGame) _endGame(elapsed);
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.dead) return;
        const z = GameContext.currentZoom || ZOOM_LEVEL;
        if (this.caveLaserCharge > 0) {
            const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(aim);
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3 / z;
            ctx.setLineDash([10 / z, 14 / z]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(3600, 0);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }
}
