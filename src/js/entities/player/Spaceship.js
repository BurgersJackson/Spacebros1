import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, SIM_FPS, PLAYER_SHIELD_RADIUS_SCALE, PLAYER_HULL_ROT_OFFSET, PLAYER_HULL_RENDER_SCALE } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { Shockwave } from '../projectiles/Shockwave.js';
import {
    pixiApp,
    pixiPlayerLayer,
    pixiVectorLayer,
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureWhite,
    pixiCleanupObject
} from '../../rendering/pixi-context.js';

let keys = null;
let gpState = null;
let mouseState = null;
let mouseScreen = null;
let mouseWorld = null;
let _spawnParticles = null;
let _spawnSmoke = null;
let _spawnBarrelSmoke = null;
let _showOverlayMessage = null;
let _updateHealthUI = null;
let _updateWarpUI = null;
let _updateXpUI = null;
let _updateTurboUI = null;
let _showLevelUpMenu = null;
let _killPlayer = null;
let _checkWallCollision = null;
let _rayCast = null;
let _getGameNowMs = null;
let _getSuppressWarpInputUntil = null;
let _getViewportSize = null;
let _getPlayerHullExternalReady = null;
let _getSlackerHullExternalReady = null;

export function registerSpaceshipDependencies(deps) {
    if (deps.keys) keys = deps.keys;
    if (deps.gpState) gpState = deps.gpState;
    if (deps.mouseState) mouseState = deps.mouseState;
    if (deps.mouseScreen) mouseScreen = deps.mouseScreen;
    if (deps.mouseWorld) mouseWorld = deps.mouseWorld;
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnSmoke) _spawnSmoke = deps.spawnSmoke;
    if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
    if (deps.showOverlayMessage) _showOverlayMessage = deps.showOverlayMessage;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.updateWarpUI) _updateWarpUI = deps.updateWarpUI;
    if (deps.updateXpUI) _updateXpUI = deps.updateXpUI;
    if (deps.updateTurboUI) _updateTurboUI = deps.updateTurboUI;
    if (deps.showLevelUpMenu) _showLevelUpMenu = deps.showLevelUpMenu;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.checkWallCollision) _checkWallCollision = deps.checkWallCollision;
    if (deps.rayCast) _rayCast = deps.rayCast;
    if (deps.getGameNowMs) _getGameNowMs = deps.getGameNowMs;
    if (deps.getSuppressWarpInputUntil) _getSuppressWarpInputUntil = deps.getSuppressWarpInputUntil;
    if (deps.getViewportSize) _getViewportSize = deps.getViewportSize;
    if (deps.getPlayerHullExternalReady) _getPlayerHullExternalReady = deps.getPlayerHullExternalReady;
    if (deps.getSlackerHullExternalReady) _getSlackerHullExternalReady = deps.getSlackerHullExternalReady;
}

export class Spaceship extends Entity {
    constructor(shipType = 'standard') {
        super(0, 0);
        this.shipType = shipType; // 'standard' or 'slacker'
        this.radius = 30;
        this.angle = -Math.PI / 2;
        this.turretAngle = -Math.PI / 2;
        this.baseThrust = 0.60; // quadrupled (0.15 * 4) for 60Hz
        this.baseMaxSpeed = 13.8; // 15% increase (12.0 * 1.15 = 13.8)

        // Progression
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 100;
        this.inventory = {}; // Track upgrade tiers

        // Stats
        this.stats = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            shotgunFireRateMult: 1.0,
            rangeMult: 1.0,
            multiShot: 1,
            homing: 0, // 0=none, 1=weak, 2=strong
            shieldRegenRate: 8, // seconds per segment
            hpRegenAmount: 1, // HP per tick
            hpRegenRate: 10, // seconds per tick
            speedMult: 1.0,
            // accelMult and rotMult removed
            slowField: 0, // Radius
            slowFieldDuration: 0
        };

        this.magnetRadius = 150;

        this.thrustPower = this.baseThrust;
        this.rotationSpeed = 0.12; // doubled for 60Hz
        this.friction = 0.98; // 0.99^2 for 60Hz logic to stay same real-time speed
        this.maxSpeed = this.baseMaxSpeed; // Correctly uses 12.0 now

        this.invulnerable = 90; // halved for 60Hz
        this.visible = true;
        this.maxHp = 25;  // starting health hp
        this.hp = this.maxHp;

        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.lastHpRegenTime = Date.now();

        this.shieldRadius = 45 * PLAYER_SHIELD_RADIUS_SCALE;
        this.maxShieldSegments = 8;
        this.shieldSegments = new Array(8).fill(2);
        this.shieldRotation = 0;
        this.shieldsDirty = true;
        this._pixiInnerShieldGfx = null;
        this._pixiOuterShieldGfx = null;

        // Optional outer shield ring (separate from the main shield)
        this.outerShieldRadius = this.shieldRadius + (26 * PLAYER_SHIELD_RADIUS_SCALE);
        this.maxOuterShieldSegments = 0;
        this.outerShieldSegments = [];
        this.outerShieldRotation = 0;

        this.baseFireDelay = 12;
        this.fireDelay = 12;
        this.autofireTimer = 0;
        this.baseShotgunDelay = 30;  // shotgun fire rate (lower = faster)
        this.shotgunDelay = this.baseShotgunDelay;
        this.shotgunTimer = 0;
        this.turretLevel = 1;

        // Multishot stagger system - fires multishot bullets with delay between each
        this.multishotStagger = {
            currentShot: 0,
            totalShots: 1,
            staggerDelay: 4,  // frames between shots (will be adjusted based on bullet count)
            staggerTimer: 0,
            lastAimAngle: 0,
            lastDamage: 0,
            active: false
        };

        // NEW: Forward laser for Slacker Special (fires independently)
        this.forwardLaserDelay = 20; // Fire rate between shots
        this.forwardLaserTimer = 0;

        this.staticWeapons = []; // Array of objects {type: 'forward'|'side'|'rear'}

        this.canWarp = false;
        this.warpCooldown = 0;
        this.maxWarpCooldown = 180;

        // Special CDs
        this.nukeUnlocked = false;
        this.nukeCooldown = 0;
        this.nukeMaxCooldown = 600; // Default 10s
        this.nukeDamage = 5;
        this.nukeRange = 500;

        // Global Defense Ring
        this.defenseRingTier = 0;
        this.defenseOrbs = [];
        this.defenseOrbAngle = 0;
        this.defenseOrbRadius = 500;
        this.defenseOrbDamage = 5;
        this.defenseOrbSpeed = (Math.PI * 2) / 360; // 1 rotation per 6 seconds (360 frames @ 60fps)

        this.slowField = 0; // 0 or radius

        this.missileTimer = 0;

        // Invincibility Phase Shield
        this.invincibilityCycle = {
            unlocked: false,
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 0, cooldown: 0, regen: false }
        };

        // Turbo boost (activated by E / gamepad X)
        this.turboBoost = {
            // Stock ship has a small turbo (upgrades extend duration).
            unlocked: true,
            activeFrames: 0,
            cooldownFrames: 0,
            lastCooldownFrames: 0,
            durationFrames: 60, // 1.0s
            cooldownTotalFrames: 600, // fixed 10s cooldown
            speedMult: 1.25, // +25% speed
            buttonHeld: false
        };

        // Battery Ability
        this.batteryUnlocked = false;
        this.batteryCharge = 0; // 0-100
        this.batteryMaxCharge = 100;
        // Charge rate: 100 units over 60 seconds, independent of framerate
        // deltaTime is in ms, dtScale = deltaTime / 16.67
        // chargeRate is the amount to add per Reference Frame (16.67ms)
        this.batteryChargeRate = (100 / 60000) * 16.67;
        this.batteryDamage = 500;
        this.batteryRange = 800;
        this.batteryDischarging = false;

        // Volley Shot Ability
        this.volleyShotUnlocked = false;
        this.volleyShotCount = 0;        // Number of shots in volley (3/5/7 based on tier)
        this.volleyCooldown = 0;        // Timer until next auto-fire (180 frames = 3 seconds)
        this.lastF = false;             // Track F key state transitions (for Battery)

        // CIWS (Close-In Weapon System)
        this.ciwsUnlocked = false;
        this.ciwsDamage = 1;            // Damage per bullet (1-5 based on tier)
        this.ciwsRange = 400;            // Target acquisition range
        this.ciwsCooldown = 0;          // Frames until next shot (6 = 2x player fire rate)
        this.ciwsMaxCooldown = 6;        // Fire rate: every 6 frames at 60fps

        // Homing Missiles - track sources separately for stacking
        this.stats.homingFromUpgrade = 0;   // Tier from in-game upgrade (0-5)
        this.stats.homingFromMeta = 0;      // Tier from meta shop (0-3)
    }

    respawn() {
        this.pos.x = 0;
        this.pos.y = 0;
        if (this.prevPos) { this.prevPos.x = 0; this.prevPos.y = 0; }
        this.vel.x = 0;
        this.vel.y = 0;
        this.angle = -Math.PI / 2;
        this.invulnerable = 90; // halved for 60Hz
        this.dead = false;
        this.visible = true;
        this.hp = this.maxHp;
        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.shieldSegments = new Array(this.maxShieldSegments).fill(2);
        this.shieldsDirty = true;
        this.outerShieldSegments = (this.maxOuterShieldSegments > 0) ? new Array(this.maxOuterShieldSegments).fill(1) : [];
        this.warpCooldown = 0;
        this.nukeCooldown = 0;
        this.defenseOrbAngle = 0;
        this.invincibilityCycle.state = 'ready';
        this.invincibilityCycle.timer = 0;
        this.turboBoost.activeFrames = 0;
        this.turboBoost.cooldownFrames = 0;
        this.turboBoost.lastCooldownFrames = 0;
        this.turboBoost.buttonHeld = false;
        this.shotgunTimer = 0;
        _updateHealthUI();
        _updateWarpUI();
        _updateXpUI();
    }

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
        _updateXpUI();
    }

    levelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);

        // Pause and Show Menu
        playSound('levelup');
        GameContext.gameActive = false; // Soft pause logic required
        if (_showLevelUpMenu) _showLevelUpMenu();
    }

    takeHit(damage, ignoreShields = false) {
        if (this.dead || this.invulnerable > 0) return;

        let remaining = Math.max(0, Math.ceil(damage));

        if (!ignoreShields) {
            // Apply damage to outer shields first
            if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                for (let i = 0; i < this.outerShieldSegments.length && remaining > 0; i++) {
                    if (this.outerShieldSegments[i] > 0) {
                        this.outerShieldSegments[i] = 0;
                        remaining -= 1;
                        this.shieldsDirty = true;
                    }
                }
            }

            // Apply damage to main inner shields
            if (this.shieldSegments && this.shieldSegments.length > 0) {
                for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
                    const absorb = Math.min(remaining, this.shieldSegments[i]);
                    this.shieldSegments[i] -= absorb;
                    remaining -= absorb;
                    this.shieldsDirty = true;
                }
            }
        }

        // Hull damage only happens when shields cannot absorb the full hit.
        if (remaining > 0) {
            this.hp -= remaining;
            _spawnParticles(this.pos.x, this.pos.y, 14, '#f00');
            playSound('hit');
            _updateHealthUI();

            // Screen shake (global variables)
            if (typeof GameContext.shakeMagnitude !== 'undefined') GameContext.shakeMagnitude = 10;
            if (typeof GameContext.shakeTimer !== 'undefined') GameContext.shakeTimer = 10;

            if (this.hp <= 0) {
                _killPlayer();
            } else {
                this.invulnerable = 5;
            }
        } else {
            // Shield absorbed all damage
            playSound('shield_hit');
            _spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
            this.invulnerable = 5;
        }
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        const dtScale = deltaTime / 16.67;

        this.shieldRotation += 0.02 * dtScale;
        if (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0)) {
            this.outerShieldRotation -= 0.026 * dtScale;
        }

        // Turbo boost timers + activation (E / gamepad X / right mouse button)
        if (this.turboBoost && this.turboBoost.unlocked) {
            if (this.turboBoost.activeFrames > 0) this.turboBoost.activeFrames -= dtScale;

            // Track if cooldown just expired this frame
            const wasOnCooldown = this.turboBoost.lastCooldownFrames > 0;
            const nowOnCooldown = this.turboBoost.cooldownFrames > 0;
            const cooldownJustExpired = wasOnCooldown && !nowOnCooldown;
            this.turboBoost.lastCooldownFrames = this.turboBoost.cooldownFrames;
            if (this.turboBoost.cooldownFrames > 0) this.turboBoost.cooldownFrames -= dtScale;

            // Check if turbo button is pressed
            const turboPressed = (keys.e || gpState.turbo || mouseState.rightDown);

            // Trigger on press (not press -> press transition)
            if (turboPressed && !this.turboBoost.buttonHeld) {
                if (this.turboBoost.activeFrames <= 0 && this.turboBoost.cooldownFrames <= 0) {
                    this.turboBoost.activeFrames = this.turboBoost.durationFrames;
                    this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
                    playSound('powerup');
                }
            }
            // Re-trigger if button is still held and cooldown just expired
            else if (turboPressed && cooldownJustExpired) {
                if (this.turboBoost.activeFrames <= 0) {
                    this.turboBoost.activeFrames = this.turboBoost.durationFrames;
                    this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
                    playSound('powerup');
                }
            }

            this.turboBoost.buttonHeld = turboPressed;
            _updateTurboUI();
        }

        let moveX = gpState.move.x;
        let moveY = gpState.move.y;

        if (!GameContext.usingGamepad) {
            if (keys.w) moveY -= 1;
            if (keys.s) moveY += 1;
            if (keys.a) moveX -= 1;
            if (keys.d) moveX += 1;
        }

        // NEW: Slacker ship mouse movement
        if (this.shipType === 'slacker' && !GameContext.usingGamepad) {
            // Calculate direction from screen center to mouse cursor (Virtual Joystick)
            const viewport = _getViewportSize ? _getViewportSize() : { width: 0, height: 0 };
            const screenCenterX = viewport.width / 2;
            const screenCenterY = viewport.height / 2;

            // Vector from center of screen to mouse pointer
            const rawDx = mouseScreen.x - screenCenterX;
            const rawDy = mouseScreen.y - screenCenterY;
            const distSq = rawDx * rawDx + rawDy * rawDy;

            // Rotation mode: if left mouse button is held, stop movement
            // and only rotate to face mouse cursor
            const isRotationMode = mouseState.leftDown;

            if (!isRotationMode) {
                // Deadzone of 50 pixels from center
                if (distSq > 50 * 50) {
                    const dist = Math.sqrt(distSq);
                    const mouseMoveX = rawDx / dist;
                    const mouseMoveY = rawDy / dist;

                    // Add to existing keyboard input (allows combining mouse + keyboard)
                    moveX += mouseMoveX;
                    moveY += mouseMoveY;
                }

                // Clamp to prevent overshoot when combining inputs
                moveX = Math.max(-1, Math.min(1, moveX));
                moveY = Math.max(-1, Math.min(1, moveY));
            }
            // In rotation mode, only rotate toward mouse (don't add to movement)
        }

        const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
        let thrusting = false;

        const aimMag = Math.sqrt(gpState.aim.x * gpState.aim.x + gpState.aim.y * gpState.aim.y);
        const aimThresh = 0.08;
        const moveAimThresh = 0.08;
        if (this.shipType === 'slacker') {
            // SLACKER SPECIAL: Auto-target nearest enemy (prioritizes bosses)
            const target = this.findAutoTurretTarget();
            if (target) {
                // Aim at the target, but slightly toward its front based on facing angle
                let targetX = target.pos.x;
                let targetY = target.pos.y;

                // Add lead offset based on target's facing direction
                if (target.angle !== undefined) {
                    const leadOffset = 80; // Aim 80 units ahead of target
                    targetX += Math.cos(target.angle) * leadOffset;
                    targetY += Math.sin(target.angle) * leadOffset;
                }

                this.turretAngle = Math.atan2(targetY - this.pos.y, targetX - this.pos.x);
            }
            // If no target, keep last turretAngle (don't reset)
        } else {
            // STANDARD: Manual turret control (existing behavior)
            if (GameContext.usingGamepad) {
                // In gamepad mode, never snap aim back to mouse when sticks go idle.
                if (aimMag > aimThresh) {
                    this.turretAngle = Math.atan2(gpState.aim.y, gpState.aim.x);
                } else if (moveMag > moveAimThresh) {
                    this.turretAngle = Math.atan2(moveY, moveX);
                }
            } else {
                this.turretAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
            }
        }

        // Removed acceleration stat multiplier, using base or 1.0 implicitly
        const turboMult = (this.turboBoost && this.turboBoost.activeFrames > 0) ? (this.turboBoost.speedMult || 1.5) : 1.0;
        const currentThrust = this.thrustPower * turboMult * dtScale; // Scale thrust by time
        if (this.caveSlowFrames === undefined) this.caveSlowFrames = 0;
        if (this.caveSlowMult === undefined) this.caveSlowMult = 1.0;
        if (this.caveSlowFrames > 0) this.caveSlowFrames -= dtScale;
        const slowMult = (this.caveSlowFrames > 0) ? Math.max(0.4, Math.min(1.0, this.caveSlowMult || 0.62)) : 1.0;
        const currentMaxSpeed = this.maxSpeed * this.stats.speedMult * turboMult * slowMult;

        if (moveMag > 0.06) {
            const targetAngle = Math.atan2(moveY, moveX);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
            }
            // Use normalized components for thrust calculation
            const normMoveX = moveX / moveMag;
            const normMoveY = moveY / moveMag;
            const finalMag = Math.min(1.0, moveMag);

            this.vel.x += normMoveX * (currentThrust * finalMag);
            this.vel.y += normMoveY * (currentThrust * finalMag);
            thrusting = true;
        }

        // Slacker ship always rotates toward mouse (when not using gamepad)
        if (this.shipType === 'slacker' && !GameContext.usingGamepad) {
            const targetAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
            }
        }

        this.fireDelay = this.baseFireDelay / this.stats.fireRateMult;
        this.shotgunDelay = this.baseShotgunDelay / this.stats.shotgunFireRateMult;

        this.autofireTimer -= dtScale;
        this.shotgunTimer -= dtScale;
        if (this.autofireTimer <= 0) {
            this.shoot();
            this.autofireTimer = Math.max(4, this.fireDelay);
        }
        if (this.shotgunTimer <= 0) {
            this.shootShotgun();
            this.shotgunTimer = Math.max(4, this.shotgunDelay);
        }

        // Multishot stagger - handle delayed shots
        if (this.multishotStagger.active) {
            this.multishotStagger.staggerTimer -= dtScale;
            if (this.multishotStagger.staggerTimer <= 0) {
                this.fireMultishotStaggered();
                // Reset timer for next shot if more shots remaining
                if (this.multishotStagger.active && this.multishotStagger.currentShot < this.multishotStagger.totalShots) {
                    this.multishotStagger.staggerTimer = this.multishotStagger.staggerDelay;
                }
            }
        }

        // NEW: Slacker Special forward laser (fires independently)
        if (this.shipType === 'slacker') {
            this.forwardLaserTimer -= dtScale;
            if (this.forwardLaserTimer <= 0) {
                this.fireForwardLaser();
                this.forwardLaserTimer = Math.max(4, this.forwardLaserDelay);
            }
        }

        // Shield Regen
        if (this.stats.shieldRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastShieldRegenTime > this.stats.shieldRegenRate * 1000) {
                // Regen prioritizes main (inner) shield; once full, it repairs outer shield (if owned).
                const innerIdx = this.shieldSegments.findIndex(s => s < 2);
                if (innerIdx !== -1) {
                    this.shieldSegments[innerIdx] = 2;
                    this.shieldsDirty = true;
                    playSound('powerup'); // Soft sound
                } else if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                    const outerIdx = this.outerShieldSegments.findIndex(s => s <= 0);
                    if (outerIdx !== -1) {
                        this.outerShieldSegments[outerIdx] = 1;
                        this.shieldsDirty = true;
                        playSound('powerup'); // Soft sound
                    }
                }
                this.lastShieldRegenTime = now;
            }
        }

        // Hull HP Regen
        if (this.stats.hpRegenAmount > 0 && this.stats.hpRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastHpRegenTime > this.stats.hpRegenRate * 1000) {
                if (this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegenAmount);
                    _updateHealthUI();
                    _spawnParticles(this.pos.x, this.pos.y, 4, '#0f0');
                }
                this.lastHpRegenTime = now;
            }
        }

        // Auto-Cycling Invincibility Phase Shield
        if (this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtScale;

            if (this.invincibilityCycle.state === 'ready') {
                // Start active phase immediately if ready
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
                // _showOverlayMessage("PHASE SHIELD ACTIVE", '#ff0', 1000);
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2; // Sustain invulnerability each frame
                // Tier 3 Regen - check every ~1 second (SIM_FPS frames at 60fps reference)
                if (this.invincibilityCycle.stats.regen && Math.floor(this.invincibilityCycle.timer / SIM_FPS) !== Math.floor((this.invincibilityCycle.timer + dtScale) / SIM_FPS)) {
                    const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
                    if (emptyIdx !== -1) {
                        this.shieldSegments[emptyIdx] = 2;
                    }
                }

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



        // Homing Missiles (Separate System)
        if (this.stats.homing > 0) {
            this.missileTimer -= dtScale;
            if (this.missileTimer <= 0) {
                this.fireMissiles();
                this.missileTimer = 30 / this.stats.fireRateMult;
            }
        }

        // Global Defense Ring
        if (this.defenseRingTier > 0) {
            this.defenseOrbAngle += this.defenseOrbSpeed * dtScale;
            const orbs = this.defenseOrbs;
            const now = Date.now();

            for (let i = 0; i < orbs.length; i++) {
                const orb = orbs[i];
                const angle = this.defenseOrbAngle + orb.angleOffset;
                const ox = this.pos.x + Math.cos(angle) * this.defenseOrbRadius;
                const oy = this.pos.y + Math.sin(angle) * this.defenseOrbRadius;

                // Collision targets via Spatial Hash for performance
                // targetGrid includes: enemies, pinwheels, bosses, turrets
                const queryRadius = 150;
                const targets = [
                    ...GameContext.targetGrid.query(ox, oy, queryRadius),
                    ...GameContext.asteroidGrid.query(ox, oy, queryRadius),
                    ...GameContext.guidedMissiles,
                    ...GameContext.bossBombs
                ];

                for (const target of targets) {
                    if (target.dead) continue;
                    if (target.unbreakable) continue; // Skip indestructible objects

                    // Check cooldown
                    const lastHit = orb.hitCooldowns.get(target);
                    if (lastHit && now - lastHit < 500) continue; // 0.5s cooldown per orb per target

                    const distSq = (ox - target.pos.x) ** 2 + (oy - target.pos.y) ** 2;
                    const hitDist = (25 + target.radius); // Orb radius approx 25

                    if (distSq < hitDist * hitDist) {
                        // HIT!
                        orb.hitCooldowns.set(target, now);
                        _spawnParticles(target.pos.x, target.pos.y, 5, '#f80'); // Fire particles

                        if (typeof target.break === 'function') {
                            target.break();
                        } else if (typeof target.hp === 'number') {
                            target.hp -= this.defenseOrbDamage;
                            if (target.hp <= 0) {
                                if (typeof target.kill === 'function') target.kill();
                                else if (typeof target.explode === 'function') target.explode();
                                else target.dead = true;
                            }
                        }
                    }
                }
            }
        }

        // Auto Nuke Trigger
        if (this.nukeCooldown > 0) this.nukeCooldown -= dtScale;
        if (this.nukeUnlocked && this.nukeCooldown <= 0) {
            this.fireNuke();
        }

        // Volley Shot Auto-Fire (every 3 seconds = 180 frames at 60fps)
        if (this.volleyShotUnlocked) {
            if (this.volleyCooldown > 0) {
                this.volleyCooldown -= dtScale;
            } else {
                // Fire the volley!
                this.fireVolleyShot();
                this.volleyCooldown = 120; // 2 seconds at 60fps
            }
        }

        // CIWS Auto-Fire (rapid-fire defense system)
        if (this.ciwsUnlocked) {
            if (this.ciwsCooldown > 0) {
                this.ciwsCooldown -= dtScale;
            } else {
                // Find target (missiles first, then nearest enemy)
                const target = this.findCIWSTarget();
                if (target) {
                    this.fireCIWS(target);
                    this.ciwsCooldown = this.ciwsMaxCooldown;
                }
            }
        }

        if (this.canWarp) {
            if (this.warpCooldown > 0) {
                this.warpCooldown -= dtScale;
                _updateWarpUI();
            } else if (keys.shift || gpState.warp) {
                const suppressWarpUntil = _getSuppressWarpInputUntil ? _getSuppressWarpInputUntil() : 0;
                if (!suppressWarpUntil || _getGameNowMs() >= suppressWarpUntil) {
                    this.warp();
                }
            }
        }

        // Shield Recharge (meta upgrade)
        if (this.stats.shieldRechargeRate > 0 && this.shieldSegments && this.shieldSegments.length > 0) {
            const now = Date.now();
            const rechargeInterval = this.stats.shieldRechargeRate * 1000;
            if (now - (this.lastShieldRegenTime || 0) >= rechargeInterval) {
                const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
                if (emptyIdx !== -1) {
                    this.shieldSegments[emptyIdx] = 2;
                    this.shieldsDirty = true;
                    _spawnParticles(this.pos.x, this.pos.y, 4, '#0ff');
                }
                this.lastShieldRegenTime = now;
            }
        }

        // Second Wind timer update
        if (this.stats.secondWindActive > 0) {
            this.stats.secondWindActive -= dtScale;
            if (this.stats.secondWindActive <= 0) {
                this.stats.secondWindActive = 0;
            }
        }

        // Combo Meter decay (resets after 5 seconds of no hits)
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const now = Date.now();
            if (now - (this.lastHitTime || 0) > 5000) {
                this.comboStacks = 0;
            }
        }

        // Battery charging logic
        if (this.batteryUnlocked && !this.batteryDischarging) {
            this.batteryCharge = Math.min(this.batteryMaxCharge, this.batteryCharge + this.batteryChargeRate * dtScale);
        }

        // F key / Battery button handling (Battery discharge)
        const fPressed = keys.f || gpState.battery || mouseState.middleDown;
        const batteryReady = this.batteryUnlocked && this.batteryCharge >= this.batteryMaxCharge;

        // Track F key state transitions
        if (fPressed && !this.lastF) {
            // F key just pressed (keydown)
            if (batteryReady) {
                // Battery discharge immediately
                this.dischargeBattery();
                // Reset input to prevent continuous battery discharge
                keys.f = false;
                gpState.battery = false;
            }
        }
        this.lastF = fPressed;

        // Update battery UI
        if (this.batteryUnlocked) {
            const batteryUi = document.getElementById('battery-ui');
            const batteryText = document.getElementById('battery-text');
            const batteryFill = document.getElementById('battery-fill');
            if (batteryUi) batteryUi.style.display = 'flex';
            const chargePercent = Math.floor(this.batteryCharge);
            if (batteryText) batteryText.textContent = `${chargePercent}%`;
            if (batteryFill) {
                batteryFill.style.width = `${chargePercent}%`;
                batteryFill.style.background = this.batteryCharge >= 100 ? '#fff' : '#0ff';
            }
        }

        if (this.hp <= 3 && Math.random() < 0.1 * dtScale) {
            _spawnSmoke(this.pos.x, this.pos.y, 1);
        }

        const speed = this.vel.mag();
        if (speed > currentMaxSpeed) this.vel.mult(currentMaxSpeed / speed);

        if (thrusting) {
            const bx = this.pos.x - Math.cos(this.angle) * 35;
            const bx2 = this.pos.y - Math.sin(this.angle) * 35;
            if (Math.random() > 0.5) _spawnParticles(bx, bx2, 1, '#0aa');
        }

        // Time-scaled friction
        // friction^dtScale
        // NEW: Slacker rotation mode - apply stronger braking when left mouse button held
        const rotationModeBrake = (this.shipType === 'slacker' && !GameContext.usingGamepad && mouseState.leftDown) ? 0.85 : 1.0;
        this.vel.mult(Math.pow(this.friction * rotationModeBrake, dtScale));

        super.update(deltaTime);
        _checkWallCollision(this, 0.0);

        if (this.invulnerable > 0) {
            this.invulnerable -= dtScale;
            if (this.invincibilityCycle.state === 'active') {
                this.visible = true;
            } else {
                this.visible = true;
            }
        } else {
            this.visible = true;
        }
    }

    fireNuke() {
        GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.nukeDamage, this.nukeRange, {
            damageAsteroids: true,
            damageMissiles: true,
            damageBases: true,
            followPlayer: true
        }));
        this.nukeCooldown = this.nukeMaxCooldown;
        //    _showOverlayMessage("NUKE DEPLOYED", '#ff0', 1000);
    }

    warp() {
        _spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        playSound('warp');
        const angle = Math.random() * Math.PI * 2;
        const dist = 3000 + Math.random() * 2000;
        this.pos.x += Math.cos(angle) * dist;
        this.pos.y += Math.sin(angle) * dist;
        this.vel.x = 0;
        this.vel.y = 0;
        _spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        this.warpCooldown = this.maxWarpCooldown;
        _updateWarpUI();
    }

    dischargeBattery() {
        if (!this.batteryUnlocked || this.batteryCharge < 100 || this.batteryDischarging) return;

        this.batteryDischarging = true;
        this.batteryCharge = 0;

        // Primary blast
        GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.batteryDamage, this.batteryRange, {
            damageAsteroids: true,
            damageMissiles: true,
            color: '#0ff',
            travelSpeed: 15,
            followPlayer: true
        }));

        // Secondary ring effect (delayed)
        setTimeout(() => {
            if (!this.dead) {
                GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.batteryDamage * 0.3, this.batteryRange * 1.2, {
                    damageAsteroids: true,
                    damageMissiles: true,
                    color: '#08f',
                    travelSpeed: 10,
                    followPlayer: true
                }));
            }
        }, 200);

        _showOverlayMessage("BATTERY DISCHARGED!", '#0ff', 1000);

        setTimeout(() => {
            this.batteryDischarging = false;
        }, 500);
    }

    createBullet(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape) {
        const opts = {};
        if (typeof damage === 'number') opts.damage = damage;
        if (typeof radius === 'number') opts.radius = radius;
        if (color) opts.color = color;
        else opts.color = isEnemy ? '#f00' : '#ff0';
        if (typeof homing === 'number') opts.homing = homing;
        if (shape) opts.shape = shape;
        opts.owner = isEnemy ? 'enemy' : 'player';
        return new Bullet(x, y, angle, speed, opts);
    }

    fireMissiles() {
        const hasUpgrade = this.stats.homingFromUpgrade > 0;
        const hasMeta = this.stats.homingFromMeta > 0;
        const bothOwned = hasUpgrade && hasMeta;

        const upgradeDamage = this.stats.homingFromUpgrade || 1;
        const metaDamage = this.stats.homingFromMeta || 1;

        // Fire 2 missiles normally, or 4 if both upgrades owned
        const missilePairs = bothOwned ? 2 : 1;

        for (let pair = 0; pair < missilePairs; pair++) {
            // Each pair fires 2 missiles
            const count = 2;
            // Determine damage for this pair
            const damage = (pair === 0) ? upgradeDamage : metaDamage;

            for (let i = 0; i < count; i++) {
                const angleOffset = (i - (count - 1) / 2) * 0.3;
                // Add slight spread between pairs if firing 4 missiles
                const pairSpread = bothOwned ? 0.15 : 0;
                const spreadOffset = (pair - 0.5) * pairSpread;
                const angle = this.turretAngle + angleOffset + spreadOffset + (Math.random() - 0.5) * 0.2;
                const b = this.createBullet(this.pos.x, this.pos.y, angle, false, damage, 12, 3, '#f80', 2);
                b.ignoreShields = false;
                b.isMissile = true;
                GameContext.bullets.push(b);
                _spawnSmoke(this.pos.x, this.pos.y, 1);
            }
        }
    }

    fireVolleyShot() {
        const shots = this.volleyShotCount || 3;
        const spread = 0.15; // Slight spread between shots

        for (let i = 0; i < shots; i++) {
            // Stagger the angle for spread effect
            const angleOffset = (i - (shots - 1) / 2) * spread;
            const angle = this.turretAngle + angleOffset;

            // Use player's damage multiplier
            let damage = 2 * this.stats.damageMult;

            // Combo Meter bonus to damage
            if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
                const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
                damage *= comboBonus;
            }

            const b = this.createBullet(this.pos.x, this.pos.y, angle, false, damage, 14, 4, '#ff0');

            GameContext.bullets.push(b);
        }

        // Visual feedback
        _spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
        playSound('rapid_shoot');
    }

    findCIWSTarget() {
        let nearestTarget = null;
        let minDist = Infinity;
        const range = this.ciwsRange;

        // Check all enemy bullets (including missiles, pinwheels, etc.)
        for (let b of GameContext.bullets) {
            if (b.isEnemy && !b.dead) {
                const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = b;
                }
            }
        }

        // Check guided missiles array (destroyer missiles)
        if (typeof GameContext.guidedMissiles !== 'undefined') {
            for (let m of GameContext.guidedMissiles) {
                if (!m.dead) {
                    const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                    if (dist <= range && dist < minDist) {
                        minDist = dist;
                        nearestTarget = m;
                    }
                }
            }
        }

        // Also check enemies array
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (dist <= range && dist < minDist) {
                minDist = dist;
                nearestTarget = e;
            }
        }

        return nearestTarget;
    }

    // Auto-targeting for Slacker Special ship - prioritizes boss ships
    findAutoTurretTarget() {
        let nearestTarget = null;
        let minDist = Infinity;
        const range = 2000; // Same as main turret range with rangeMult

        // First priority: Boss ships (Cruiser or Destroyer)
        // Check global boss variable (Cruiser)
        if (GameContext.boss && !GameContext.boss.dead) {
            const dist = Math.hypot(GameContext.boss.pos.x - this.pos.x, GameContext.boss.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.boss; // Always target boss if in range
            }
        }

        // Check global destroyer variable (Destroyer boss)
        if (typeof GameContext.destroyer !== 'undefined' && GameContext.destroyer && !GameContext.destroyer.dead) {
            const dist = Math.hypot(GameContext.destroyer.pos.x - this.pos.x, GameContext.destroyer.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.destroyer; // Always target destroyer if in range
            }
        }

        // Check space station (high priority target)
        if (typeof GameContext.spaceStation !== 'undefined' && GameContext.spaceStation && !GameContext.spaceStation.dead) {
            const dist = Math.hypot(GameContext.spaceStation.pos.x - this.pos.x, GameContext.spaceStation.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.spaceStation; // Always target space station if in range
            }
        }

        // Check enemies for boss types (Cruiser, Destroyer, Destroyer2)
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            if (e.constructor.name === 'Cruiser' || e.constructor.name === 'Destroyer' ||
                e.constructor.name === 'Destroyer2') {
                const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = e;
                }
            }
        }

        // If no boss found, fall back to nearest enemy of any type
        if (!nearestTarget) {
            for (let e of GameContext.enemies) {
                if (e.dead) continue;
                const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = e;
                }
            }
        }

        // Check pinwheels array
        if (typeof GameContext.pinwheels !== 'undefined') {
            for (let p of GameContext.pinwheels) {
                if (p.dead) continue;
                const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = p;
                }
            }
        }

        // Check cave pinwheels array
        if (typeof GameContext.cavePinwheels !== 'undefined') {
            for (let p of GameContext.cavePinwheels) {
                if (p.dead) continue;
                const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = p;
                }
            }
        }

        // Check cave wall turrets
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.wallTurrets) {
            for (let t of GameContext.caveLevel.wallTurrets) {
                if (!t || t.dead) continue;
                const dist = Math.hypot(t.pos.x - this.pos.x, t.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = t;
                }
            }
        }

        // Check guided missiles array (destroyer missiles)
        if (typeof GameContext.guidedMissiles !== 'undefined') {
            for (let m of GameContext.guidedMissiles) {
                if (m.dead) continue;
                const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = m;
                }
            }
        }

        return nearestTarget;
    }

    fireCIWS(target) {
        const angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
        const bulletSpeed = 18; // Same as player turret
        const damage = this.ciwsDamage;
        // White bullets for visibility (#fff, 3px)
        GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, angle, false, damage, bulletSpeed, 3, '#fff'));
    }

    shoot() {
        let damage = 2 * this.stats.damageMult; //turret damage

        // Combo Meter bonus to damage
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
            damage *= comboBonus;
        }

        const bulletSpeed = 15;
        const shots = this.stats.multiShot;

        // DEBUG: Validation
        if (GameContext.bullets.length > 500) console.warn('[WARN] Bullet count high:', GameContext.bullets.length);

        // Calculate firing vectors for parallel multi-shot
        const aimX = Math.cos(this.turretAngle);
        const aimY = Math.sin(this.turretAngle);
        const perpX = -aimY; // Right vector
        const perpY = aimX;
        const spacing = 12; // Gap between projectiles

        // Start multishot stagger sequence
        if (shots > 1) {
            this.multishotStagger.currentShot = 0;
            this.multishotStagger.totalShots = shots;
            // More delay for fewer bullets to prevent visual merging
            // 2 bullets: 8 frames, 3 bullets: 6 frames, 4+ bullets: 4 frames
            if (shots === 2) {
                this.multishotStagger.staggerDelay = 8;
            } else if (shots === 3) {
                this.multishotStagger.staggerDelay = 6;
            } else {
                this.multishotStagger.staggerDelay = 4;
            }
            this.multishotStagger.staggerTimer = 0;
            this.multishotStagger.lastAimAngle = this.turretAngle;
            this.multishotStagger.lastDamage = damage;
            this.multishotStagger.active = true;
            // Fire first shot immediately
            this.fireMultishotStaggered();
        } else {
            // Single shot - fire normally
            const offset = 0;
            const bx = this.pos.x + aimX * 25 + perpX * offset;
            const by = this.pos.y + aimY * 25 + perpY * offset;

            GameContext.bullets.push(this.createBullet(bx, by, this.turretAngle, false, damage, bulletSpeed, 4, null, 0));
            _spawnBarrelSmoke(bx, by, this.turretAngle);

            // Split Shot - chance to fire additional projectile at angle
            if (this.stats.splitShot > 0 && Math.random() < this.stats.splitShot) {
                const splitAngle = this.turretAngle + (Math.random() - 0.5) * 0.5;
                const splitBullet = this.createBullet(bx, by, splitAngle, false, damage, bulletSpeed, 4, '#f80', 0);
                splitBullet.isSplitShot = true;
                GameContext.bullets.push(splitBullet);
            }
        }
        // Player shooting SFX (MP3), rate-limited.
        const now = Date.now();
        if (!this._lastShootSfxAt || (now - this._lastShootSfxAt) >= 100) {
            playSound('shoot', 0.5);
            this._lastShootSfxAt = now;
        }

        // Static Weapons
        this.staticWeapons.forEach(w => {
            // Calculate effectiveness penalty
            const weaponEffectiveness = w.effectiveness || 1.0;

            // Calculate same-type penalty (for multiple weapons of the same type)
            const sameTypeCount = this.staticWeapons.filter(sw => sw.type === w.type).length;
            const typePenalty = sameTypeCount > 1 ? 1 - ((sameTypeCount - 1) * 0.2) : 1.0;

            // Combined effectiveness (min 20%)
            const finalEffectiveness = Math.max(0.2, weaponEffectiveness * typePenalty);
            const weaponDamage = damage * finalEffectiveness;

            if (w.type === 'side') {
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle + Math.PI / 2, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle - Math.PI / 2, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'rear') {
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle + Math.PI, false, weaponDamage, bulletSpeed, 4, '#0f0')); // Rear laser
            } else if (w.type === 'dual_rear') {
                // Dual stream to the rear at angles
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle + Math.PI - Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle + Math.PI + Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'dual_front') {
                // Dual stream to the front at angles
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle - Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle + Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else { // Forward
                GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, this.angle, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            }
        });
    }

    fireMultishotStaggered() {
        if (!this.multishotStagger.active || this.multishotStagger.currentShot >= this.multishotStagger.totalShots) {
            this.multishotStagger.active = false;
            return;
        }

        const shot = this.multishotStagger.currentShot;
        const totalShots = this.multishotStagger.totalShots;
        const turretAngle = this.multishotStagger.lastAimAngle;
        const damage = this.multishotStagger.lastDamage;
        const bulletSpeed = 15;

        // Calculate firing vectors for parallel multi-shot
        const aimX = Math.cos(turretAngle);
        const aimY = Math.sin(turretAngle);
        const perpX = -aimY; // Right vector
        const perpY = aimX;
        // Increase spacing for low bullet counts to prevent visual merging
        const spacing = totalShots <= 2 ? 20 : 12; // 20 for 1-2 shots, 12 for 3+

        // Parallel offset logic
        const offset = (shot - (totalShots - 1) / 2) * spacing;

        const bx = this.pos.x + aimX * 25 + perpX * offset;
        const by = this.pos.y + aimY * 25 + perpY * offset;

        GameContext.bullets.push(this.createBullet(bx, by, turretAngle, false, damage, bulletSpeed, 4, null, 0));
        _spawnBarrelSmoke(bx, by, turretAngle);

        // Split Shot - chance to fire additional projectile at angle
        if (this.stats.splitShot > 0 && Math.random() < this.stats.splitShot) {
            const splitAngle = turretAngle + (Math.random() - 0.5) * 0.5;
            const splitBullet = this.createBullet(bx, by, splitAngle, false, damage, bulletSpeed, 4, '#f80', 0);
            splitBullet.isSplitShot = true;
            GameContext.bullets.push(splitBullet);
        }

        this.multishotStagger.currentShot++;

        // If all shots fired, deactivate stagger
        if (this.multishotStagger.currentShot >= this.multishotStagger.totalShots) {
            this.multishotStagger.active = false;
        }
    }

    shootShotgun() {
        const shotgunTier = this.inventory['shotgun'] || 0;
        if (shotgunTier <= 0) return;

        const count = shotgunTier === 1 ? 5 : (shotgunTier === 2 ? 8 : 12);
        const dmg = this.stats.damageMult * 0.7;
        const spread = 0.5;
        const baseShotgunLife = 23;
        const tierRangeMult = 1 + (0.1 * Math.max(0, shotgunTier - 1));

        for (let i = 0; i < count; i++) {
            const a = this.turretAngle + (Math.random() - 0.5) * spread;
            const s = 12 + (Math.random() - 0.5) * 4;
            const b = this.createBullet(this.pos.x, this.pos.y, a, false, dmg, s, 3, '#ff0', 0, 'square');
            b.life = (baseShotgunLife * tierRangeMult) * this.stats.rangeMult;
            GameContext.bullets.push(b);
        }
        _spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
    }

    fireForwardLaser() {
        const damage = 2 * this.stats.damageMult;
        // Combo Meter bonus
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
            damage *= comboBonus;
        }
        const forwardAngle = this.angle; // Forward in facing direction
        GameContext.bullets.push(this.createBullet(this.pos.x, this.pos.y, forwardAngle, false, damage, 15, 4, '#0f0'));
    }

    drawLaser(ctx) {
        if (!this.visible || this.dead) {
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            return;
        }

        // Pixi path (dashed aim laser)
        if (pixiVectorLayer && pixiApp && pixiApp.renderer) {
            const startX = this.pos.x + Math.cos(this.turretAngle) * 25;
            const startY = this.pos.y + Math.sin(this.turretAngle) * 25;
            const hit = _rayCast(startX, startY, this.turretAngle, 2000 * this.stats.rangeMult);

            let gfx = this._pixiLaserGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(gfx);
                this._pixiLaserGfx = gfx;
            } else if (!gfx.parent) {
                pixiVectorLayer.addChild(gfx);
            }
            gfx.visible = true;
            gfx.clear();

            const dx = hit.x - startX;
            const dy = hit.y - startY;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const ux = dx / dist;
            const uy = dy / dist;
            const dashLen = 10;
            const gapLen = 20;

            gfx.lineStyle(2, 0x88ffff, 0.5);
            for (let t = 0; t < dist; t += (dashLen + gapLen)) {
                const a0 = t;
                const a1 = Math.min(dist, t + dashLen);
                gfx.moveTo(startX + ux * a0, startY + uy * a0);
                gfx.lineTo(startX + ux * a1, startY + uy * a1);
            }
            gfx.endFill();  // Properly close the path to prevent ghosting

            gfx.beginFill(0xaaffff, 0.8);
            gfx.drawCircle(hit.x, hit.y, 4);
            gfx.endFill();
            return;
        }
    }

    draw(ctx, alpha = 1.0) {
        if (!this.visible || this.dead) {
            if (this._pixiContainer) this._pixiContainer.visible = false;
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            if (this._pixiOuterShieldGfx) {
                try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                this._pixiOuterShieldGfx = null;
            }
            if (this._pixiInnerShieldGfx) {
                try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                this._pixiInnerShieldGfx = null;
            }
            if (this.dead) pixiCleanupObject(this);
            return;
        }

        const rPos = (this.getRenderPos && typeof alpha === 'number') ? this.getRenderPos(alpha) : this.pos;

        // Pixi fast path (player hull/turret/shields)
        if (pixiPlayerLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiPlayerLayer.addChild(container);

                const hullTexture = (this.shipType === 'slacker') ? (pixiTextures.slacker_hull || pixiTextures.player_hull) : pixiTextures.player_hull;
                const hullAnchorKey = (this.shipType === 'slacker' && pixiTextures.slacker_hull) ? 'slacker_hull' : 'player_hull';
                const hull = new PIXI.Sprite(hullTexture);
                const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
                hull.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;

                // Calculate thruster/turbo position (behind the ship)
                // Ship faces at `this.angle + PLAYER_HULL_ROT_OFFSET`, so exhaust is opposite
                const exhaustOffset = 45;  // Distance behind hull center
                const thrusterX = Math.cos(this.angle + Math.PI) * exhaustOffset;
                const thrusterY = Math.sin(this.angle + Math.PI) * exhaustOffset;

                // Turbo flame sprite (only create if texture exists)
                if (pixiTextures.player_turbo_flame) {
                    const turbo = new PIXI.Sprite(pixiTextures.player_turbo_flame);
                    const tfA = pixiTextureAnchors.player_turbo_flame || { x: 0.5, y: 0.5 };
                    turbo.anchor.set((tfA && tfA.x != null) ? tfA.x : 0.5, (tfA && tfA.y != null) ? tfA.y : 0.5);
                    turbo.position.set(thrusterX, thrusterY);  // Positioned behind ship
                    turbo.visible = false;
                    turbo.alpha = 1.0;
                    turbo.blendMode = PIXI.BLEND_MODES.ADD;
                    container.addChild(turbo);
                    this._pixiTurboFlameSpr = turbo;
                } else {
                    this._pixiTurboFlameSpr = null;
                }

                const thr = new PIXI.Sprite(pixiTextures.player_thruster);
                const tA = pixiTextureAnchors.player_thruster || { x: 0.5, y: 0.5 };
                thr.anchor.set((tA && tA.x != null) ? tA.x : 0.5, (tA && tA.y != null) ? tA.y : 0.5);
                thr.position.set(thrusterX, thrusterY);  // Positioned behind ship
                thr.visible = false;
                container.addChild(thr);
                this._pixiThrusterSpr = thr;

                const turret = new PIXI.Container();
                turret.position.set(0, 0);
                container.addChild(turret);
                this._pixiTurretContainer = turret;

                const turretBase = new PIXI.Sprite(pixiTextures.player_turret_base);
                const tbA = pixiTextureAnchors.player_turret_base || { x: 0.5, y: 0.5 };
                turretBase.anchor.set((tbA && tbA.x != null) ? tbA.x : 0.5, (tbA && tbA.y != null) ? tbA.y : 0.5);
                turret.addChild(turretBase);
                this._pixiTurretBaseSpr = turretBase;

                this._pixiBarrelSprs = [];
            } else if (!container.parent) {
                pixiPlayerLayer.addChild(container);
            }
            container.visible = true;
            container.position.set(rPos.x, rPos.y);

            // Hull
            if (this._pixiHullSpr) {
                // Keep hull texture synced (important for late-loaded external image).
                const useSlackerHull = (this.shipType === 'slacker') && pixiTextures.slacker_hull;
                this._pixiHullSpr.texture = useSlackerHull ? pixiTextures.slacker_hull : pixiTextures.player_hull;
                const hullAnchorKey = useSlackerHull ? 'slacker_hull' : 'player_hull';
                const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                const playerHullReady = _getPlayerHullExternalReady ? _getPlayerHullExternalReady() : false;
                const slackerHullReady = _getSlackerHullExternalReady ? _getSlackerHullExternalReady() : false;
                this._pixiHullSpr.rotation = (this.angle || 0) + (playerHullReady ? PLAYER_HULL_ROT_OFFSET : 0);
                const externalReady = useSlackerHull ? slackerHullReady : playerHullReady;
                if (externalReady) {
                    const tex = useSlackerHull ? pixiTextures.slacker_hull : pixiTextures.player_hull;
                    const denom = Math.max(1, Math.max(tex.width || 1, tex.height || 1));
                    const s = (this.radius * 2 * PLAYER_HULL_RENDER_SCALE) / denom;
                    this._pixiHullSpr.scale.set(s);
                } else {
                    this._pixiHullSpr.scale.set(1);
                }
            }

            // Thruster (simple)
            const thrusting = !!(keys.w || (Math.abs(gpState.move.x) > 0.1 || Math.abs(gpState.move.y) > 0.1));
            const turboActive = !!(this.turboBoost && this.turboBoost.activeFrames > 0);

            // Update thruster/turbo position to be behind the ship as it rotates
            const exhaustOffset = 45;  // Increased from 20 for turbo flame
            const thrusterX = Math.cos(this.angle + Math.PI) * exhaustOffset;
            const thrusterY = Math.sin(this.angle + Math.PI) * exhaustOffset;

            if (this._pixiTurboFlameSpr) {
                this._pixiTurboFlameSpr.visible = turboActive;
                this._pixiTurboFlameSpr.position.set(thrusterX, thrusterY);  // Update position dynamically
                this._pixiTurboFlameSpr.rotation = this.angle;
                if (turboActive) {
                    const t = (typeof GameContext.frameNow === 'number' && GameContext.frameNow > 0) ? GameContext.frameNow : Date.now();
                    const flicker = 1.8 + Math.abs(Math.sin(t * 0.03)) * 0.4;  // Scale 1.8-2.2 for larger flame
                    this._pixiTurboFlameSpr.scale.set(flicker);
                }
            }
            if (this._pixiThrusterSpr) {
                this._pixiThrusterSpr.visible = thrusting && !turboActive;
                this._pixiThrusterSpr.position.set(thrusterX, thrusterY);  // Update position dynamically
                this._pixiThrusterSpr.rotation = this.angle;
                this._pixiThrusterSpr.alpha = 0.9;
            }

            // Turret + barrels
            const turret = this._pixiTurretContainer;
            if (turret) turret.rotation = this.turretAngle;
            const barrels = this._pixiBarrelSprs || (this._pixiBarrelSprs = []);
            const shots = Math.max(1, Math.floor(this.stats && this.stats.multiShot ? this.stats.multiShot : 1));
            while (barrels.length < shots) {
                const spr = new PIXI.Sprite(pixiTextures.player_barrel);
                const bA = pixiTextureAnchors.player_barrel || { x: 0, y: 0.5 };
                spr.anchor.set((bA && bA.x != null) ? bA.x : 0, (bA && bA.y != null) ? bA.y : 0.5);
                turret.addChild(spr);
                barrels.push(spr);
            }
            const spacing = 12 * 1.2;
            for (let i = 0; i < barrels.length; i++) {
                const spr = barrels[i];
                if (!spr) continue;
                if (i < shots) {
                    spr.visible = true;
                    const offset = (shots >= 2) ? ((i - (shots - 1) / 2) * spacing) : 0;
                    spr.position.set(0, offset);
                } else {
                    spr.visible = false;
                }
            }

            // Shields / slow field / phase ring
            if (pixiVectorLayer) {
                const hasOuter = (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0));
                const hasInner = (this.shieldSegments && this.shieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner || (this.stats && this.stats.slowField > 0) || (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active'));

                if (needs) {
                    // --- STATIC EFFECTS (Phase & Slow Field) ---
                    // Re-drawn every frame as they are simple circles and might pulse/chang size.
                    let gfx = this._pixiGfx;
                    if (!gfx) {
                        gfx = new PIXI.Graphics();
                        pixiVectorLayer.addChild(gfx);
                        this._pixiGfx = gfx;
                    } else if (!gfx.parent) {
                        pixiVectorLayer.addChild(gfx);
                    }
                    gfx.clear();
                    gfx.position.set(rPos.x, rPos.y);

                    if (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active') {
                        const outerR = (hasOuter ? this.outerShieldRadius : 0);
                        const r = Math.max(this.shieldRadius || 0, outerR || 0) + 14;
                        gfx.lineStyle(3, 0xffdc00, 0.6);
                        gfx.drawCircle(0, 0, r);
                        gfx.endFill(); // Clear lineStyle to prevent ghosting
                    }

                    if (this.stats && this.stats.slowField > 0) {
                        gfx.lineStyle(2, 0x00c8ff, 0.30);
                        gfx.drawCircle(0, 0, this.stats.slowField);
                        gfx.endFill(); // Clear lineStyle to prevent ghosting
                    }

                    // --- GLOBAL DEFENSE RING ---
                    let defGfx = this._pixiDefenseGfx;
                    if (this.defenseRingTier > 0) {
                        if (!defGfx) {
                            defGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(defGfx);
                            this._pixiDefenseGfx = defGfx;
                        } else if (!defGfx.parent) pixiVectorLayer.addChild(defGfx);

                        defGfx.clear();
                        defGfx.position.set(rPos.x, rPos.y);

                        // Ring Visual (White, 50% opacity)
                        defGfx.lineStyle(2, 0xffffff, 0.5);
                        defGfx.drawCircle(0, 0, this.defenseOrbRadius);

                        const orbs = this.defenseOrbs;
                        for (let i = 0; i < orbs.length; i++) {
                            const angle = this.defenseOrbAngle + orbs[i].angleOffset;
                            const ox = Math.cos(angle) * this.defenseOrbRadius;
                            const oy = Math.sin(angle) * this.defenseOrbRadius;

                            // Orb Core (Hot White/Yellow)
                            defGfx.beginFill(0xffffaa, 1);
                            defGfx.drawCircle(ox, oy, 10);
                            defGfx.endFill();

                            // Inner Fire (Orange)
                            defGfx.beginFill(0xffaa00, 0.8);
                            defGfx.drawCircle(ox, oy, 16);
                            defGfx.endFill();

                            // Outer Glow (Red/Transparent)
                            defGfx.beginFill(0xff4400, 0.3);
                            defGfx.drawCircle(ox, oy, 24);
                            defGfx.endFill();
                        }
                    } else if (defGfx) {
                        try { defGfx.destroy(true); } catch (e) { }
                        this._pixiDefenseGfx = null;
                    }

                    // --- OUTER SHIELD ---
                    let outerGfx = this._pixiOuterShieldGfx;
                    if (hasOuter) {
                        if (!outerGfx) {
                            outerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(outerGfx);
                            this._pixiOuterShieldGfx = outerGfx;
                            this.shieldsDirty = true;
                        } else if (!outerGfx.parent) pixiVectorLayer.addChild(outerGfx);

                        outerGfx.position.set(rPos.x, rPos.y);
                        outerGfx.rotation = this.outerShieldRotation || 0;
                    } else if (outerGfx) {
                        try { outerGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                        outerGfx = null;
                    }

                    // --- INNER SHIELD ---
                    let innerGfx = this._pixiInnerShieldGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerShieldGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(rPos.x, rPos.y);
                        innerGfx.rotation = this.shieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                        innerGfx = null;
                    }

                    // --- GEOMETRY REBUILD ---
                    if (this.shieldsDirty) {
                        if (outerGfx && hasOuter) {
                            outerGfx.clear();
                            const outerCount = this.outerShieldSegments.length;
                            const outerAngle = (Math.PI * 2) / outerCount;
                            outerGfx.lineStyle(4, 0xb000ff, 0.9);
                            for (let i = 0; i < outerCount; i++) {
                                if (this.outerShieldSegments[i] > 0) {
                                    // Draw at base angle 0
                                    const a0 = i * outerAngle + 0.08;
                                    const a1 = (i + 1) * outerAngle - 0.08;
                                    outerGfx.moveTo(Math.cos(a0) * this.outerShieldRadius, Math.sin(a0) * this.outerShieldRadius);
                                    outerGfx.arc(0, 0, this.outerShieldRadius, a0, a1);
                                }
                            }
                        }

                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;

                            // Iterate segments once to group by alpha if needed, or just multiple lineStyles?
                            // PIXI lineStyle applies to subsequent drawing.
                            // To optimize batches, we can draw all full segments then all damaged ones, but simpler is loop.
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const a0 = i * segAngle + 0.1;
                                    const a1 = (i + 1) * segAngle - 0.1;
                                    const alpha = Math.max(0.15, Math.min(1, v / 2));
                                    innerGfx.lineStyle(3, 0x00ffff, alpha);
                                    innerGfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    innerGfx.arc(0, 0, this.shieldRadius, a0, a1);
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
                    if (this._pixiOuterShieldGfx) {
                        try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                    }
                    if (this._pixiInnerShieldGfx) {
                        try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                    }
                }
            }

            return;
        }
    }
}

// AOE damage function that respects shield penetration mechanics
// Damages shield shards hit by the AOE, overflow penetrates to player
