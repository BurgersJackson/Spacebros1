import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import {
  SIM_STEP_MS,
  SIM_FPS,
  PLAYER_SHIELD_RADIUS_SCALE,
  PLAYER_HULL_ROT_OFFSET,
  PLAYER_HULL_RENDER_SCALE
} from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { Bullet } from "../projectiles/Bullet.js";
import { Shockwave } from "../projectiles/Shockwave.js";
import {
  pixiApp,
  pixiPlayerLayer,
  pixiVectorLayer,
  pixiTextures,
  pixiTextureAnchors,
  pixiTextureWhite,
  pixiCleanupObject
} from "../../rendering/pixi-context.js";

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
let _updateInputSpeedUI = null;
let _updateTurboUI = null;
let _showLevelUpMenu = null;
let _killPlayer = null;
let _checkWallCollision = null;
let _rayCast = null;
let _getGameNowMs = null;
let _getSuppressWarpInputUntil = null;
let _getViewportSize = null;
let _getInternalSize = null;
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
  if (deps.updateInputSpeedUI) _updateInputSpeedUI = deps.updateInputSpeedUI;
  if (deps.updateTurboUI) _updateTurboUI = deps.updateTurboUI;
  if (deps.showLevelUpMenu) _showLevelUpMenu = deps.showLevelUpMenu;
  if (deps.killPlayer) _killPlayer = deps.killPlayer;
  if (deps.checkWallCollision) _checkWallCollision = deps.checkWallCollision;
  if (deps.rayCast) _rayCast = deps.rayCast;
  if (deps.getGameNowMs) _getGameNowMs = deps.getGameNowMs;
  if (deps.getSuppressWarpInputUntil) _getSuppressWarpInputUntil = deps.getSuppressWarpInputUntil;
  if (deps.getViewportSize) _getViewportSize = deps.getViewportSize;
  if (deps.getInternalSize) _getInternalSize = deps.getInternalSize;
  if (deps.getPlayerHullExternalReady)
    _getPlayerHullExternalReady = deps.getPlayerHullExternalReady;
  if (deps.getSlackerHullExternalReady)
    _getSlackerHullExternalReady = deps.getSlackerHullExternalReady;
}

export class Spaceship extends Entity {
  constructor(shipType = "standard") {
    super(0, 0);
    this.shipType = shipType; // 'standard' or 'slacker'
    this.radius = 30;
    this.angle = -Math.PI / 2;
    this.turretAngle = -Math.PI / 2;
    this.baseThrust = 0.6; // quadrupled (0.15 * 4) for 60Hz
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
    this.maxHp = 25; // starting health hp
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
    this.outerShieldRadius = this.shieldRadius + 26 * PLAYER_SHIELD_RADIUS_SCALE;
    this.maxOuterShieldSegments = 0;
    this.outerShieldSegments = [];
    this.outerShieldRotation = 0;

    this.baseFireDelay = 20;
    this.fireDelay = 20;
    this.autofireTimer = 0;
    this.baseShotgunDelay = 30; // shotgun fire rate (lower = faster)
    this.shotgunDelay = this.baseShotgunDelay;
    this.shotgunTimer = 0;
    this.turretLevel = 1;

    // Forward laser (fires independently for all ship types)
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
    this.nukeDamage = 50;
    this.nukeRange = 5000;

    // Global Defense Ring
    this.defenseRingTier = 0;
    this.defenseOrbs = [];
    this.defenseOrbAngle = 0;
    this.defenseOrbRadius = 500;
    this.defenseOrbDamage = 10;
    this.defenseOrbSpeed = ((Math.PI * 2) / 360) * 1.25; // 25% faster - 1.25 rotations per 6 seconds

    this.slowField = 0; // 0 or radius

    this.missileTimer = 0;

    // Invincibility Phase Shield
    this.invincibilityCycle = {
      unlocked: false,
      state: "ready", // ready, active, cooldown
      timer: 0,
      stats: { duration: 0, cooldown: 0, regen: false }
    };

    // Turbo boost (activated by E / gamepad X)
    // Apply Dash Duration meta upgrade (turboDurationBonus)
    const turboDurationBonus = this.stats.turboDurationBonus || 0;
    // Apply Dash Cooldown meta upgrade (turboCooldownReduction)
    const turboCooldownReduction = (this.stats.turboCooldownReduction || 0) * 60; // Convert seconds to frames

    this.turboBoost = {
      // Stock ship has a small turbo (upgrades extend duration).
      unlocked: true,
      activeFrames: 0,
      cooldownFrames: 0,
      lastCooldownFrames: 0,
      durationFrames: 60 + turboDurationBonus * 60, // 1.0s + upgrade bonus
      cooldownTotalFrames: Math.max(0, 600 - turboCooldownReduction), // 10s - upgrade reduction
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
    this.batteryDamage = 5000;
    this.batteryRange = 8000;
    this.batteryDischarging = false;

    // Volley Shot Ability
    this.volleyShotUnlocked = false;
    this.volleyShotCount = 0; // Number of shots in volley (3/5/7 based on tier)
    this.volleyCooldown = 0; // Timer until next auto-fire (180 frames = 3 seconds)
    this.lastF = false; // Track F key state transitions (for Battery)

    // CIWS (Close-In Weapon System)
    this.ciwsUnlocked = false;
    this.ciwsDamage = 10; // Damage per bullet (tier 1=10, tier 2=20, tier 3=30, tier 4=40, tier 5=50)
    this.ciwsRange = 400; // Target acquisition range
    this.ciwsCooldown = 0; // Frames until next shot (6 = 2x player fire rate)
    this.ciwsMaxCooldown = 6; // Fire rate: every 6 frames at 60fps

    // Homing Missiles - track sources separately for stacking
    this.stats.homingFromUpgrade = 0; // Tier from in-game upgrade (0-5)
    this.stats.homingFromMeta = 0; // Tier from meta shop (0-3)

    // Slacker mouse input smoothing (used only in certain modes)
    this._slackerMouseMoveX = 0;
    this._slackerMouseMoveY = 0;
  }

  respawn() {
    this.pos.x = 0;
    this.pos.y = 0;
    if (this.prevPos) {
      this.prevPos.x = 0;
      this.prevPos.y = 0;
    }
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
    this.outerShieldSegments =
      this.maxOuterShieldSegments > 0 ? new Array(this.maxOuterShieldSegments).fill(1) : [];
    this.warpCooldown = 0;
    this.nukeCooldown = 0;
    this.defenseOrbAngle = 0;
    this.invincibilityCycle.state = "ready";
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
    playSound("levelup");
    // Release mouse lock immediately so the player can use the level-up UI in windowed mode.
    const canvas = document.getElementById("gameCanvas");
    if (canvas && document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
    GameContext.gameActive = false; // Soft pause logic required
    if (_showLevelUpMenu) _showLevelUpMenu();
  }

  takeHit(damage, ignoreShields = false) {
    if (this.dead || this.invulnerable > 0) return;

    // Evasion Boost - chance to completely avoid damage
    if (this.stats.evasionChance > 0 && Math.random() < this.stats.evasionChance) {
      if (_addPickupFloatingText) {
        _addPickupFloatingText(this.pos.x, this.pos.y, "EVADED!", "#0f0", 20, 0, -30);
      }
      return; // Completely avoid the hit
    }

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
      _spawnParticles(this.pos.x, this.pos.y, 14, "#f00");
      playSound("hit");
      _updateHealthUI();

      // Screen shake (global variables)
      if (typeof GameContext.shakeMagnitude !== "undefined") GameContext.shakeMagnitude = 10;
      if (typeof GameContext.shakeTimer !== "undefined") GameContext.shakeTimer = 10;

      // Second Wind - grant invulnerability after damage (if cooldown is ready)
      if (
        this.stats.secondWindDuration > 0 &&
        this.stats.secondWindReady &&
        this.stats.secondWindTimer <= 0
      ) {
        this.invulnerable = this.stats.secondWindDuration; // Already in frames from meta-manager
        this.stats.secondWindActive = this.stats.secondWindDuration;
        this.stats.secondWindTimer = this.stats.secondWindCooldown;
        this.stats.secondWindReady = false;
        if (_addPickupFloatingText) {
          _addPickupFloatingText(this.pos.x, this.pos.y, "SECOND WIND!", "#0ff", 24, 0, -60);
        }
      }

      if (this.hp <= 0) {
        _killPlayer();
      } else {
        this.invulnerable = 0;
      }
    } else {
      // Shield absorbed all damage
      playSound("shield_hit");
      _spawnParticles(this.pos.x, this.pos.y, 10, "#0ff");
      this.invulnerable = 0;
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;

    const dtScale = deltaTime / 16.67;

    if (_updateInputSpeedUI) _updateInputSpeedUI();

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
      const turboPressed = keys.e || gpState.turbo || mouseState.rightDown;

      // Trigger on press (not press -> press transition)
      if (turboPressed && !this.turboBoost.buttonHeld) {
        if (this.turboBoost.activeFrames <= 0 && this.turboBoost.cooldownFrames <= 0) {
          this.turboBoost.activeFrames = this.turboBoost.durationFrames;
          this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
          playSound("powerup");
        }
      }
      // Re-trigger if button is still held and cooldown just expired
      else if (turboPressed && cooldownJustExpired) {
        if (this.turboBoost.activeFrames <= 0) {
          this.turboBoost.activeFrames = this.turboBoost.durationFrames;
          this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
          playSound("powerup");
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

    // NEW: Slacker ship mouse movement - gamepad-style joystick
    // Move when left mouse button is NOT held (reverse of normal behavior)
    // When left mouse button released: ship stops
    if (this.shipType === "slacker" && !GameContext.usingGamepad) {
      if (!mouseState.leftDown) {
        // Gamepad-style: screen center is joystick center, mouse position determines stick direction/magnitude
        if (_getInternalSize && mouseScreen) {
          const internal = _getInternalSize();
          const centerX = internal.width / 2;
          const centerY = internal.height / 2;

          // Calculate mouse offset from screen center (-1 to +1 range per axis)
          const rawX = (mouseScreen.x - centerX) / centerX;
          const rawY = (mouseScreen.y - centerY) / centerY;

          // Vector deadzone: once outside deadzone, snap to full-strength input (mag=1)
          // while preserving exact direction. This makes Slacker hit full speed almost instantly.
          const deadzone = 0.03;
          const mag = Math.sqrt(rawX * rawX + rawY * rawY);
          let targetX = 0;
          let targetY = 0;
          if (mag > deadzone) {
            // Full-strength stick in the direction of the mouse
            targetX = rawX / mag;
            targetY = rawY / mag;
          }

          // In the vertical scrolling level, the locked/static camera means the ship can drift,
          // and instant full-strength direction flips feel too jarring. Add a small ramp/smoothing
          // only in that mode.
          if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
            // Frame-rate independent smoothing (approx: reach ~80% in ~6-8 frames at 60fps)
            const response = 0.18;
            const t = 1 - Math.pow(1 - response, dtScale);
            this._slackerMouseMoveX += (targetX - this._slackerMouseMoveX) * t;
            this._slackerMouseMoveY += (targetY - this._slackerMouseMoveY) * t;

            // Clamp to unit magnitude (avoid any numerical drift)
            const sm = Math.sqrt(this._slackerMouseMoveX ** 2 + this._slackerMouseMoveY ** 2);
            if (sm > 1) {
              this._slackerMouseMoveX /= sm;
              this._slackerMouseMoveY /= sm;
            }

            moveX = this._slackerMouseMoveX;
            moveY = this._slackerMouseMoveY;
          } else {
            // Normal levels: instant response
            moveX = targetX;
            moveY = targetY;
            this._slackerMouseMoveX = targetX;
            this._slackerMouseMoveY = targetY;
          }
        }
      } else {
        // Left mouse button IS held: ship stops
        moveX = 0;
        moveY = 0;
        this._slackerMouseMoveX = 0;
        this._slackerMouseMoveY = 0;
      }
    }

    // In vertical scrolling mode, allow normal rotation (no lock)

    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    let thrusting = false;

    const aimMag = Math.sqrt(gpState.aim.x * gpState.aim.x + gpState.aim.y * gpState.aim.y);
    const aimThresh = 0.08;
    const moveAimThresh = 0.08;
    if (this.shipType === "slacker") {
      // SLACKER SPECIAL: Auto-target nearest enemy (prioritizes bosses)
      // Works in both normal and vertical scrolling mode
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
      // If no target and in vertical scrolling mode, default to straight up
      else if (GameContext.verticalScrollingMode) {
        this.turretAngle = -Math.PI / 2;
      }
      // If no target in normal mode, keep last turretAngle (don't reset)
    } else {
      // STANDARD: Manual turret control (works in all modes including vertical scrolling)
      // Only update aim when left mouse button is held
      if (GameContext.usingGamepad) {
        // In gamepad mode, never snap aim back to mouse when sticks go idle.
        if (aimMag > aimThresh) {
          this.turretAngle = Math.atan2(gpState.aim.y, gpState.aim.x);
        } else if (moveMag > moveAimThresh) {
          this.turretAngle = Math.atan2(moveY, moveX);
        }
      } else if (!mouseState.leftDown) {
        // Mouse mode: only aim when left mouse button is held
        this.turretAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
      }
      // If left mouse not held, keep last turretAngle (don't update)
    }

    // Removed acceleration stat multiplier, using base or 1.0 implicitly
    const turboMult =
      this.turboBoost && this.turboBoost.activeFrames > 0 ? this.turboBoost.speedMult || 1.5 : 1.0;
    // Slacker ship with mouse: reach top speed very quickly
    const slackerThrustMult = this.shipType === "slacker" && !GameContext.usingGamepad ? 2.6 : 1.0;
    const currentThrust = this.thrustPower * turboMult * slackerThrustMult * dtScale; // Scale thrust by time
    if (this.caveSlowFrames === undefined) this.caveSlowFrames = 0;
    if (this.caveSlowMult === undefined) this.caveSlowMult = 1.0;
    if (this.caveSlowFrames > 0) this.caveSlowFrames -= dtScale;
    const slowMult =
      this.caveSlowFrames > 0 ? Math.max(0.4, Math.min(1.0, this.caveSlowMult || 0.62)) : 1.0;
    const currentMaxSpeed =
      this.maxSpeed *
      this.stats.speedMult *
      (this.stats.speedBonusFromMit || 1.0) *
      turboMult *
      slowMult;

    if (moveMag > 0.06) {
      // For slacker with mouse, don't update angle based on movement (rotation is handled separately)
      // This prevents the ship from rotating away from the mouse when moving
      if (!(this.shipType === "slacker" && !GameContext.usingGamepad)) {
        // Update angle based on movement direction (for keyboard/gamepad)
        const targetAngle = Math.atan2(moveY, moveX);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > 0.05) {
          this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
        }
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
    if (this.shipType === "slacker" && !GameContext.usingGamepad) {
      let targetAngle;
      let distToMouse = 0;
      // In vertical scrolling mode the camera is static, so the ship can drift off-screen-center.
      // For Slacker controls we want the same "joystick deflection from screen center" feel as normal
      // levels (where the camera follows the player and the ship is centered).
      if (
        GameContext.verticalScrollingMode &&
        GameContext.verticalScrollingZone &&
        _getInternalSize &&
        mouseScreen
      ) {
        const internal = _getInternalSize();
        const centerX = internal.width / 2;
        const centerY = internal.height / 2;

        const dx = mouseScreen.x - centerX;
        const dy = mouseScreen.y - centerY;
        distToMouse = Math.sqrt(dx * dx + dy * dy);

        // Only update rotation if mouse is far enough away (deadzone to prevent spinning)
        const rotationDeadzone = 40; // pixels in screen space
        if (distToMouse > rotationDeadzone) {
          targetAngle = Math.atan2(dy, dx);
        } else {
          targetAngle = this.angle;
        }
      }
      // Calculate angle the same way the line does - in canvas coordinates
      // This ensures the rotation matches the visual line direction
      else if (_getViewportSize && _getInternalSize && mouseScreen) {
        const viewport = _getViewportSize();
        const internal = _getInternalSize();
        const z = GameContext.currentZoom || 0.4;

        // Use correct camera calculation for vertical scrolling mode (static camera) vs normal mode (follows player)
        let camX, camY;
        if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
          // Static camera in vertical scrolling mode
          camX = GameContext.verticalScrollingZone.levelCenterX - viewport.width / (2 * z);
          camY = GameContext.scrollProgress - viewport.height / (2 * z);
        } else {
          // Normal mode: camera follows player
          camX = this.pos.x - viewport.width / (2 * z);
          camY = this.pos.y - viewport.height / (2 * z);
        }

        // Calculate ship position in canvas coordinates (same as line code)
        const viewportShipX = (this.pos.x - camX) * z;
        const viewportShipY = (this.pos.y - camY) * z;
        const renderScaleX = internal.width / viewport.width;
        const renderScaleY = internal.height / viewport.height;
        const screenShipX = viewportShipX * renderScaleX;
        const screenShipY = viewportShipY * renderScaleY;

        // Calculate distance to mouse in screen space
        const dx = mouseScreen.x - screenShipX;
        const dy = mouseScreen.y - screenShipY;
        distToMouse = Math.sqrt(dx * dx + dy * dy);

        // Only update rotation if mouse is far enough away (deadzone to prevent spinning)
        const rotationDeadzone = 40; // pixels in screen space
        if (distToMouse > rotationDeadzone) {
          // Calculate angle in canvas coordinates (same as line code)
          targetAngle = Math.atan2(mouseScreen.y - screenShipY, mouseScreen.x - screenShipX);
        } else {
          // Mouse too close - keep current angle (don't rotate)
          targetAngle = this.angle;
        }
      } else {
        // Fallback to world coordinates if dependencies not available
        const dx = mouseWorld.x - this.pos.x;
        const dy = mouseWorld.y - this.pos.y;
        distToMouse = Math.sqrt(dx * dx + dy * dy);
        const rotationDeadzone = 30; // pixels in world space
        if (distToMouse > rotationDeadzone) {
          targetAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
        } else {
          // Mouse too close - keep current angle (don't rotate)
          targetAngle = this.angle;
        }
      }
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

    // Forward laser (fires independently for all ship types)
    this.forwardLaserTimer -= dtScale;
    if (this.forwardLaserTimer <= 0) {
      this.fireForwardLaser();
      this.forwardLaserTimer = Math.max(4, this.forwardLaserDelay);
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
          playSound("powerup"); // Soft sound
        } else if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
          const outerIdx = this.outerShieldSegments.findIndex(s => s <= 0);
          if (outerIdx !== -1) {
            this.outerShieldSegments[outerIdx] = 1;
            this.shieldsDirty = true;
            playSound("powerup"); // Soft sound
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
          _spawnParticles(this.pos.x, this.pos.y, 4, "#0f0");
        }
        this.lastHpRegenTime = now;
      }
    }

    // Auto-Cycling Invincibility Phase Shield
    if (this.invincibilityCycle.unlocked) {
      this.invincibilityCycle.timer -= dtScale;

      if (this.invincibilityCycle.state === "ready") {
        // Start active phase immediately if ready
        this.invincibilityCycle.state = "active";
        this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
        playSound("powerup");
        // _showOverlayMessage("PHASE SHIELD ACTIVE", '#ff0', 1000);
      } else if (this.invincibilityCycle.state === "active") {
        this.invulnerable = 2; // Sustain invulnerability each frame
        // Tier 3 Regen - check every ~1 second (SIM_FPS frames at 60fps reference)
        if (
          this.invincibilityCycle.stats.regen &&
          Math.floor(this.invincibilityCycle.timer / SIM_FPS) !==
            Math.floor((this.invincibilityCycle.timer + dtScale) / SIM_FPS)
        ) {
          const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
          if (emptyIdx !== -1) {
            this.shieldSegments[emptyIdx] = 2;
          }
        }

        if (this.invincibilityCycle.timer <= 0) {
          this.invincibilityCycle.state = "cooldown";
          this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
        }
      } else if (this.invincibilityCycle.state === "cooldown") {
        if (this.invincibilityCycle.timer <= 0) {
          this.invincibilityCycle.state = "ready";
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
          const hitDist = 25 + target.radius; // Orb radius approx 25

          if (distSq < hitDist * hitDist) {
            // HIT!
            orb.hitCooldowns.set(target, now);
            _spawnParticles(target.pos.x, target.pos.y, 5, "#f80"); // Fire particles

            if (typeof target.break === "function") {
              target.break();
            } else if (typeof target.hp === "number") {
              target.hp -= this.defenseOrbDamage;
              if (target.hp <= 0) {
                if (typeof target.kill === "function") target.kill();
                else if (typeof target.explode === "function") target.explode();
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
    if (
      this.stats.shieldRechargeRate > 0 &&
      this.shieldSegments &&
      this.shieldSegments.length > 0
    ) {
      const now = Date.now();
      const rechargeInterval = this.stats.shieldRechargeRate * 1000;
      if (now - (this.lastShieldRegenTime || 0) >= rechargeInterval) {
        const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
        if (emptyIdx !== -1) {
          this.shieldSegments[emptyIdx] = 2;
          this.shieldsDirty = true;
          _spawnParticles(this.pos.x, this.pos.y, 4, "#0ff");
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

    // Second Wind cooldown timer update
    if (this.stats.secondWindTimer > 0) {
      this.stats.secondWindTimer -= dtScale;
      if (this.stats.secondWindTimer <= 0) {
        this.stats.secondWindTimer = 0;
        this.stats.secondWindReady = true;
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
      this.batteryCharge = Math.min(
        this.batteryMaxCharge,
        this.batteryCharge + this.batteryChargeRate * dtScale
      );
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
      const batteryUi = document.getElementById("battery-ui");
      const batteryText = document.getElementById("battery-text");
      const batteryFill = document.getElementById("battery-fill");
      if (batteryUi) batteryUi.style.display = "flex";
      const chargePercent = Math.floor(this.batteryCharge);
      if (batteryText) batteryText.textContent = `${chargePercent}%`;
      if (batteryFill) {
        batteryFill.style.width = `${chargePercent}%`;
        batteryFill.style.background = this.batteryCharge >= 100 ? "#fff" : "#0ff";
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
      if (Math.random() > 0.5) _spawnParticles(bx, bx2, 1, "#0aa");
    }

    // Time-scaled friction
    // Slacker ship: apply braking when mouse button released (stops movement)
    const slackerBrake =
      this.shipType === "slacker" && !GameContext.usingGamepad && mouseState.leftDown ? 0.85 : 1.0;
    this.vel.mult(Math.pow(this.friction * slackerBrake, dtScale));

    super.update(deltaTime);

    // Soft boundary constraints in vertical scrolling mode (only push back when outside, don't interfere with normal movement)
    if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
      const viewportWidth = GameContext.verticalScrollingZone.viewportWidth;
      const viewportHeight = GameContext.verticalScrollingZone.viewportHeight;
      const levelCenterX = GameContext.verticalScrollingZone.levelCenterX;
      const z = GameContext.currentZoom || 0.4;

      // Calculate viewport bounds (camera is centered at levelCenterX horizontally)
      const leftBound = levelCenterX - viewportWidth / (2 * z);
      const rightBound = levelCenterX + viewportWidth / (2 * z);

      // Camera is static, so use fixed camera position for bounds
      const staticCamY = GameContext.scrollProgress; // Static camera center Y
      const topBound = staticCamY - viewportHeight / (2 * z);
      const bottomBound = staticCamY + viewportHeight / (2 * z);

      // Only clamp position if actually outside bounds (soft push-back, don't interfere with normal movement)
      if (this.pos.x < leftBound) {
        this.pos.x = leftBound;
        // Only reduce velocity if moving further out
        if (this.vel.x < 0) this.vel.x *= 0.5;
      } else if (this.pos.x > rightBound) {
        this.pos.x = rightBound;
        if (this.vel.x > 0) this.vel.x *= 0.5;
      }

      if (this.pos.y < topBound) {
        this.pos.y = topBound;
        if (this.vel.y < 0) this.vel.y *= 0.5;
      } else if (this.pos.y > bottomBound) {
        this.pos.y = bottomBound;
        if (this.vel.y > 0) this.vel.y *= 0.5;
      }
    }

    _checkWallCollision(this, 0.0);

    if (this.invulnerable > 0) {
      this.invulnerable -= dtScale;
      if (this.invincibilityCycle.state === "active") {
        this.visible = true;
      } else {
        this.visible = true;
      }
    } else {
      this.visible = true;
    }
  }

  fireNuke() {
    GameContext.shockwaves.push(
      new Shockwave(this.pos.x, this.pos.y, this.nukeDamage, this.nukeRange, {
        damageAsteroids: true,
        damageMissiles: true,
        damageBases: true,
        followPlayer: true,
        damageType: "area_nuke"
      })
    );
    this.nukeCooldown = this.nukeMaxCooldown;
    //    _showOverlayMessage("NUKE DEPLOYED", '#ff0', 1000);
  }

  warp() {
    _spawnParticles(this.pos.x, this.pos.y, 30, "#0ff");
    playSound("warp");
    const angle = Math.random() * Math.PI * 2;
    const dist = 3000 + Math.random() * 2000;
    this.pos.x += Math.cos(angle) * dist;
    this.pos.y += Math.sin(angle) * dist;
    this.vel.x = 0;
    this.vel.y = 0;
    _spawnParticles(this.pos.x, this.pos.y, 30, "#0ff");
    this.warpCooldown = this.maxWarpCooldown;
    _updateWarpUI();
  }

  dischargeBattery() {
    if (!this.batteryUnlocked || this.batteryCharge < 100 || this.batteryDischarging) return;

    this.batteryDischarging = true;
    this.batteryCharge = 0;

    // Primary blast
    GameContext.shockwaves.push(
      new Shockwave(this.pos.x, this.pos.y, this.batteryDamage, this.batteryRange, {
        damageAsteroids: true,
        damageMissiles: true,
        color: "#0ff",
        travelSpeed: 15,
        followPlayer: true
      })
    );

    // Secondary ring effect (delayed)
    setTimeout(() => {
      if (!this.dead) {
        GameContext.shockwaves.push(
          new Shockwave(this.pos.x, this.pos.y, this.batteryDamage * 0.3, this.batteryRange * 1.2, {
            damageAsteroids: true,
            damageMissiles: true,
            color: "#08f",
            travelSpeed: 10,
            followPlayer: true
          })
        );
      }
    }, 200);

    _showOverlayMessage("BATTERY DISCHARGED!", "#0ff", 1000);

    setTimeout(() => {
      this.batteryDischarging = false;
    }, 500);
  }

  createBullet(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape, pierceCount) {
    const opts = {};
    if (typeof damage === "number") opts.damage = damage;
    if (typeof radius === "number") opts.radius = radius;
    if (color) opts.color = color;
    else opts.color = isEnemy ? "#f00" : "#ff0";
    if (typeof homing === "number") opts.homing = homing;
    if (shape) opts.shape = shape;
    if (typeof pierceCount === "number") opts.pierceCount = pierceCount;
    opts.owner = isEnemy ? "enemy" : "player";
    return new Bullet(x, y, angle, speed, opts);
  }

  fireMissiles() {
    const hasUpgrade = this.stats.homingFromUpgrade > 0;
    const hasMeta = this.stats.homingFromMeta > 0;
    const bothOwned = hasUpgrade && hasMeta;

    // Calculate damage: tier × 10 (tier 1 = 10, tier 2 = 20, etc.)
    const upgradeDamage = (this.stats.homingFromUpgrade || 0) * 10;
    const metaDamage = (this.stats.homingFromMeta || 0) * 10;

    // Fire 2 missiles normally, or 4 if both upgrades owned
    const missilePairs = bothOwned ? 2 : 1;

    for (let pair = 0; pair < missilePairs; pair++) {
      // Each pair fires 2 missiles
      const count = 2;
      // Determine damage for this pair
      const damage = pair === 0 ? upgradeDamage : metaDamage;

      for (let i = 0; i < count; i++) {
        const angleOffset = (i - (count - 1) / 2) * 0.3;
        // Add slight spread between pairs if firing 4 missiles
        const pairSpread = bothOwned ? 0.15 : 0;
        const spreadOffset = (pair - 0.5) * pairSpread;
        const angle = this.turretAngle + angleOffset + spreadOffset + (Math.random() - 0.5) * 0.2;
        const b = this.createBullet(
          this.pos.x,
          this.pos.y,
          angle,
          false,
          damage,
          12,
          3,
          "#f80",
          2,
          null,
          0,
          this.stats.pierceCount || 0
        );
        b.ignoreShields = false;
        b.isMissile = true;
        b.weaponType = "homing_missile";
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
      let damage = 20 * this.stats.damageMult;

      // Combo Meter bonus to damage
      if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
        const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
        damage *= comboBonus;
      }

      const b = this.createBullet(
        this.pos.x,
        this.pos.y,
        angle,
        false,
        damage,
        14,
        4,
        "#ff0",
        null,
        0,
        this.stats.pierceCount || 0
      );
      b.weaponType = "volley_shot";
      GameContext.bullets.push(b);
    }

    // Visual feedback
    _spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
    playSound("rapid_shoot");
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
    if (typeof GameContext.guidedMissiles !== "undefined") {
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

    // First priority: Warp Shield Drones (protector ships that shield the boss)
    // These should be targeted before the boss itself
    for (let e of GameContext.enemies) {
      if (e.dead) continue;
      if (e.isWarpShieldDrone) {
        const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
        if (dist <= range && dist < minDist) {
          minDist = dist;
          nearestTarget = e;
        }
      }
    }
    // If we found shield drones, target them immediately
    if (nearestTarget) return nearestTarget;

    // Next priority: Boss ships (Cruiser or Destroyer)
    // Check global boss variable (Cruiser)
    if (GameContext.boss && !GameContext.boss.dead) {
      const dist = Math.hypot(
        GameContext.boss.pos.x - this.pos.x,
        GameContext.boss.pos.y - this.pos.y
      );
      if (dist <= range) {
        return GameContext.boss; // Always target boss if in range
      }
    }

    // Check global destroyer variable (Destroyer boss)
    if (
      typeof GameContext.destroyer !== "undefined" &&
      GameContext.destroyer &&
      !GameContext.destroyer.dead
    ) {
      const dist = Math.hypot(
        GameContext.destroyer.pos.x - this.pos.x,
        GameContext.destroyer.pos.y - this.pos.y
      );
      if (dist <= range) {
        return GameContext.destroyer; // Always target destroyer if in range
      }
    }

    // Check space station (high priority target)
    if (
      typeof GameContext.spaceStation !== "undefined" &&
      GameContext.spaceStation &&
      !GameContext.spaceStation.dead
    ) {
      const dist = Math.hypot(
        GameContext.spaceStation.pos.x - this.pos.x,
        GameContext.spaceStation.pos.y - this.pos.y
      );
      if (dist <= range) {
        return GameContext.spaceStation; // Always target space station if in range
      }
    }

    // Check enemies for boss types (Cruiser, Destroyer, Destroyer2)
    for (let e of GameContext.enemies) {
      if (e.dead) continue;
      if (
        e.constructor.name === "Cruiser" ||
        e.constructor.name === "Destroyer" ||
        e.constructor.name === "Destroyer2"
      ) {
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
    if (typeof GameContext.pinwheels !== "undefined") {
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
    if (typeof GameContext.cavePinwheels !== "undefined") {
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
    if (
      GameContext.caveMode &&
      GameContext.caveLevel &&
      GameContext.caveLevel.active &&
      GameContext.caveLevel.wallTurrets
    ) {
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
    if (typeof GameContext.guidedMissiles !== "undefined") {
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
    const ciwsBullet = this.createBullet(
      this.pos.x,
      this.pos.y,
      angle,
      false,
      damage,
      bulletSpeed,
      3,
      "#fff",
      null,
      0,
      this.stats.pierceCount || 0
    );
    ciwsBullet.weaponType = "ciws";
    GameContext.bullets.push(ciwsBullet);
  }

  shoot() {
    let damage = 20 * this.stats.damageMult; //turret damage (scaled 10x from 2)

    // Combo Meter bonus to damage
    if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
      const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
      damage *= comboBonus;
    }

    const bulletSpeed = 15;
    const shots = this.stats.multiShot;

    // DEBUG: Validation
    if (GameContext.bullets.length > 500)
      console.warn("[WARN] Bullet count high:", GameContext.bullets.length);

    // Fire all shots in a fan pattern
    const anglePerShot = 0.05;
    const totalAngleSpread = anglePerShot * (shots - 1);
    const startAngle = this.turretAngle - totalAngleSpread / 2;

    for (let i = 0; i < shots; i++) {
      const angle = startAngle + i * anglePerShot;
      const bx = this.pos.x + Math.cos(angle) * 25;
      const by = this.pos.y + Math.sin(angle) * 25;

      const bullet = this.createBullet(
        bx,
        by,
        angle,
        false,
        damage,
        bulletSpeed,
        4,
        null,
        0,
        this.stats.pierceCount || 0
      );
      bullet.weaponType = "turret";
      GameContext.bullets.push(bullet);
      _spawnBarrelSmoke(bx, by, angle);

      // Split Shot - chance to fire additional projectile at angle
      if (this.stats.splitShot > 0 && Math.random() < this.stats.splitShot) {
        const splitAngle = angle + (Math.random() - 0.5) * 0.5;
        const splitBullet = this.createBullet(
          bx,
          by,
          splitAngle,
          false,
          damage,
          bulletSpeed,
          4,
          "#f80",
          null,
          0,
          this.stats.pierceCount || 0
        );
        splitBullet.isSplitShot = true;
        splitBullet.weaponType = "split_shot";
        GameContext.bullets.push(splitBullet);
      }
    }
    // Player shooting SFX (MP3), rate-limited.
    const now = Date.now();
    if (!this._lastShootSfxAt || now - this._lastShootSfxAt >= 100) {
      playSound("shoot", 0.5);
      this._lastShootSfxAt = now;
    }

    // Static Weapons
    this.staticWeapons.forEach(w => {
      // Calculate effectiveness penalty
      const weaponEffectiveness = w.effectiveness || 1.0;

      // Calculate same-type penalty (for multiple weapons of the same type)
      const sameTypeCount = this.staticWeapons.filter(sw => sw.type === w.type).length;
      const typePenalty = sameTypeCount > 1 ? 1 - (sameTypeCount - 1) * 0.2 : 1.0;

      // Combined effectiveness (min 20%)
      const finalEffectiveness = Math.max(0.2, weaponEffectiveness * typePenalty);
      const weaponDamage = damage * finalEffectiveness;

      if (w.type === "side") {
        const sideBullet1 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI / 2,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        sideBullet1.weaponType = "static_side";
        GameContext.bullets.push(sideBullet1);
        const sideBullet2 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle - Math.PI / 2,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        sideBullet2.weaponType = "static_side";
        GameContext.bullets.push(sideBullet2);
      } else if (w.type === "rear") {
        const rearBullet = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        rearBullet.weaponType = "static_rear";
        GameContext.bullets.push(rearBullet);
      } else if (w.type === "dual_rear") {
        // Dual stream to the rear at angles
        const dualRearBullet1 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI - Math.PI / 6,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualRearBullet1.weaponType = "static_rear";
        GameContext.bullets.push(dualRearBullet1);
        const dualRearBullet2 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI + Math.PI / 6,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualRearBullet2.weaponType = "static_rear";
        GameContext.bullets.push(dualRearBullet2);
      } else if (w.type === "dual_side") {
        // Dual side lasers with 5° spread on each side (4 bullets total)
        // Left side: 90° ± 2.5°
        const dualSideBullet1 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI / 2 - Math.PI / 72,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualSideBullet1.weaponType = "static_side";
        GameContext.bullets.push(dualSideBullet1);
        const dualSideBullet2 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle + Math.PI / 2 + Math.PI / 72,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualSideBullet2.weaponType = "static_side";
        GameContext.bullets.push(dualSideBullet2);
        // Right side: -90° ± 2.5°
        const dualSideBullet3 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle - Math.PI / 2 - Math.PI / 72,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualSideBullet3.weaponType = "static_side";
        GameContext.bullets.push(dualSideBullet3);
        const dualSideBullet4 = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle - Math.PI / 2 + Math.PI / 72,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        dualSideBullet4.weaponType = "static_side";
        GameContext.bullets.push(dualSideBullet4);
      } else {
        // Forward
        const forwardBullet = this.createBullet(
          this.pos.x,
          this.pos.y,
          this.angle,
          false,
          weaponDamage,
          bulletSpeed,
          4,
          "#0f0",
          null,
          0,
          this.stats.pierceCount || 0
        );
        forwardBullet.weaponType = "static_forward";
        GameContext.bullets.push(forwardBullet);
      }
    });
  }

  shootShotgun() {
    const shotgunTier = this.inventory["shotgun"] || 0;
    if (shotgunTier <= 0) return;

    const count = shotgunTier === 1 ? 5 : shotgunTier === 2 ? 8 : 12;
    const dmg = 10 * this.stats.damageMult * 0.7;
    const spread = 0.5;
    const baseShotgunLife = 23;
    const tierRangeMult = 1 + 0.1 * Math.max(0, shotgunTier - 1);

    for (let i = 0; i < count; i++) {
      const a = this.turretAngle + (Math.random() - 0.5) * spread;
      const s = 12 + (Math.random() - 0.5) * 4;
      const b = this.createBullet(
        this.pos.x,
        this.pos.y,
        a,
        false,
        dmg,
        s,
        3,
        "#ff0",
        null,
        0,
        "square",
        this.stats.pierceCount || 0
      );
      b.weaponType = "shotgun";
      b.life = baseShotgunLife * tierRangeMult * this.stats.rangeMult;
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
      // Use ship facing angle for all ship types
      const forwardAngle = this.angle;
      
      // Forward laser: +50% range, +25% speed
      const laserSpeed = 15 * 1.25; // 18.75 (25% faster)
      const laserRange = 50 * 1.5; // 75 (50% more range)
      
      const forwardBullet = this.createBullet(
         this.pos.x,
         this.pos.y,
         forwardAngle,
         false,
         damage,
         laserSpeed,
         4,
         "#0f0",
         null,
         0,
         this.stats.pierceCount || 0
      );
      forwardBullet.life = laserRange * (this.stats.rangeMult || 1); // Apply range multiplier
      forwardBullet.weaponType = "turret"; // Forward laser counts as turret damage
      GameContext.bullets.push(forwardBullet);
    }
  drawLaser(ctx) {
    if (!this.visible || this.dead) {
      if (this._pixiLaserGfx) {
        try {
          this._pixiLaserGfx.clear();
        } catch (e) {}
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
      for (let t = 0; t < dist; t += dashLen + gapLen) {
        const a0 = t;
        const a1 = Math.min(dist, t + dashLen);
        gfx.moveTo(startX + ux * a0, startY + uy * a0);
        gfx.lineTo(startX + ux * a1, startY + uy * a1);
      }
      gfx.endFill(); // Properly close the path to prevent ghosting

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
        try {
          this._pixiLaserGfx.clear();
        } catch (e) {}
        this._pixiLaserGfx.visible = false;
        try {
          this._pixiLaserGfx.clear();
        } catch (e) {}
        this._pixiLaserGfx.visible = false;
      }
      if (this._pixiOuterShieldGfx) {
        try {
          this._pixiOuterShieldGfx.destroy(true);
        } catch (e) {}
        this._pixiOuterShieldGfx = null;
      }
      if (this._pixiInnerShieldGfx) {
        try {
          this._pixiInnerShieldGfx.destroy(true);
        } catch (e) {}
        this._pixiInnerShieldGfx = null;
      }
      if (this.dead) pixiCleanupObject(this);
      return;
    }

    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;

    // Pixi fast path (player hull/turret/shields)
    if (pixiPlayerLayer) {
      let container = this._pixiContainer;
      if (!container) {
        container = new PIXI.Container();
        this._pixiContainer = container;
        pixiPlayerLayer.addChild(container);

        const hullTexture =
          this.shipType === "slacker"
            ? pixiTextures.slacker_hull || pixiTextures.player_hull
            : pixiTextures.player_hull;
        const hullAnchorKey =
          this.shipType === "slacker" && pixiTextures.slacker_hull ? "slacker_hull" : "player_hull";
        const hull = new PIXI.Sprite(hullTexture);
        const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
        hull.anchor.set(hA && hA.x != null ? hA.x : 0.5, hA && hA.y != null ? hA.y : 0.5);
        hull.position.set(0, 0);
        container.addChild(hull);
        this._pixiHullSpr = hull;

        // Calculate thruster/turbo position (behind the ship)
        // Ship faces at `this.angle + PLAYER_HULL_ROT_OFFSET`, so exhaust is opposite
        const exhaustOffset = 45; // Distance behind hull center
        const thrusterX = Math.cos(this.angle + Math.PI) * exhaustOffset;
        const thrusterY = Math.sin(this.angle + Math.PI) * exhaustOffset;

        // Turbo flame sprite (only create if texture exists)
        if (pixiTextures.player_turbo_flame) {
          const turbo = new PIXI.Sprite(pixiTextures.player_turbo_flame);
          const tfA = pixiTextureAnchors.player_turbo_flame || { x: 0.5, y: 0.5 };
          turbo.anchor.set(tfA && tfA.x != null ? tfA.x : 0.5, tfA && tfA.y != null ? tfA.y : 0.5);
          turbo.position.set(thrusterX, thrusterY); // Positioned behind ship
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
        thr.anchor.set(tA && tA.x != null ? tA.x : 0.5, tA && tA.y != null ? tA.y : 0.5);
        thr.position.set(thrusterX, thrusterY); // Positioned behind ship
        thr.visible = false;
        container.addChild(thr);
        this._pixiThrusterSpr = thr;

        const turret = new PIXI.Container();
        turret.position.set(0, 0);
        container.addChild(turret);
        this._pixiTurretContainer = turret;

        const turretBase = new PIXI.Sprite(pixiTextures.player_turret_base);
        const tbA = pixiTextureAnchors.player_turret_base || { x: 0.5, y: 0.5 };
        turretBase.anchor.set(
          tbA && tbA.x != null ? tbA.x : 0.5,
          tbA && tbA.y != null ? tbA.y : 0.5
        );
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
        const useSlackerHull = this.shipType === "slacker" && pixiTextures.slacker_hull;
        this._pixiHullSpr.texture = useSlackerHull
          ? pixiTextures.slacker_hull
          : pixiTextures.player_hull;
        const hullAnchorKey = useSlackerHull ? "slacker_hull" : "player_hull";
        const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
        this._pixiHullSpr.anchor.set(
          hA && hA.x != null ? hA.x : 0.5,
          hA && hA.y != null ? hA.y : 0.5
        );
        const playerHullReady = _getPlayerHullExternalReady ? _getPlayerHullExternalReady() : false;
        const slackerHullReady = _getSlackerHullExternalReady
          ? _getSlackerHullExternalReady()
          : false;
        this._pixiHullSpr.rotation =
          (this.angle || 0) + (playerHullReady ? PLAYER_HULL_ROT_OFFSET : 0);
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
      const thrusting = !!(
        keys.w ||
        Math.abs(gpState.move.x) > 0.1 ||
        Math.abs(gpState.move.y) > 0.1
      );
      const turboActive = !!(this.turboBoost && this.turboBoost.activeFrames > 0);

      // Update thruster/turbo position to be behind the ship as it rotates
      const exhaustOffset = 45; // Increased from 20 for turbo flame
      const thrusterX = Math.cos(this.angle + Math.PI) * exhaustOffset;
      const thrusterY = Math.sin(this.angle + Math.PI) * exhaustOffset;

      if (this._pixiTurboFlameSpr) {
        this._pixiTurboFlameSpr.visible = turboActive;
        this._pixiTurboFlameSpr.position.set(thrusterX, thrusterY); // Update position dynamically
        this._pixiTurboFlameSpr.rotation = this.angle;
        if (turboActive) {
          const t =
            typeof GameContext.frameNow === "number" && GameContext.frameNow > 0
              ? GameContext.frameNow
              : Date.now();
          const flicker = 1.8 + Math.abs(Math.sin(t * 0.03)) * 0.4; // Scale 1.8-2.2 for larger flame
          this._pixiTurboFlameSpr.scale.set(flicker);
        }
      }
      if (this._pixiThrusterSpr) {
        this._pixiThrusterSpr.visible = thrusting && !turboActive;
        this._pixiThrusterSpr.position.set(thrusterX, thrusterY); // Update position dynamically
        this._pixiThrusterSpr.rotation = this.angle;
        this._pixiThrusterSpr.alpha = 0.9;
      }

      // Turret + barrels
      const turret = this._pixiTurretContainer;
      if (turret) turret.rotation = this.turretAngle;
      const barrels = this._pixiBarrelSprs || (this._pixiBarrelSprs = []);
      const shots = Math.max(
        1,
        Math.floor(this.stats && this.stats.multiShot ? this.stats.multiShot : 1)
      );
      while (barrels.length < shots) {
        const spr = new PIXI.Sprite(pixiTextures.player_barrel);
        const bA = pixiTextureAnchors.player_barrel || { x: 0, y: 0.5 };
        spr.anchor.set(bA && bA.x != null ? bA.x : 0, bA && bA.y != null ? bA.y : 0.5);
        turret.addChild(spr);
        barrels.push(spr);
      }
      const spacing = 12 * 1.2;
      for (let i = 0; i < barrels.length; i++) {
        const spr = barrels[i];
        if (!spr) continue;
        if (i < shots) {
          spr.visible = true;
          const offset = shots >= 2 ? (i - (shots - 1) / 2) * spacing : 0;
          spr.position.set(0, offset);
        } else {
          spr.visible = false;
        }
      }

      // Shields / slow field / phase ring
      if (pixiVectorLayer) {
        const hasOuter = this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0);
        const hasInner = this.shieldSegments && this.shieldSegments.length > 0;
        const needs = !!(
          hasOuter ||
          hasInner ||
          (this.stats && this.stats.slowField > 0) ||
          (this.invincibilityCycle &&
            this.invincibilityCycle.unlocked &&
            this.invincibilityCycle.state === "active")
        );

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

          if (
            this.invincibilityCycle &&
            this.invincibilityCycle.unlocked &&
            this.invincibilityCycle.state === "active"
          ) {
            const outerR = hasOuter ? this.outerShieldRadius : 0;
            const r = Math.max(this.shieldRadius || 0, outerR || 0) + 14;
            gfx.lineStyle(3, 0xffdc00, 0.6);
            gfx.drawCircle(0, 0, r);
            gfx.endFill(); // Clear lineStyle to prevent ghosting
          }

          if (this.stats && this.stats.slowField > 0) {
            gfx.lineStyle(2, 0x00c8ff, 0.3);
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
            try {
              defGfx.destroy(true);
            } catch (e) {}
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
            try {
              outerGfx.destroy(true);
            } catch (e) {}
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
            try {
              innerGfx.destroy(true);
            } catch (e) {}
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
                  outerGfx.moveTo(
                    Math.cos(a0) * this.outerShieldRadius,
                    Math.sin(a0) * this.outerShieldRadius
                  );
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
                  innerGfx.moveTo(
                    Math.cos(a0) * this.shieldRadius,
                    Math.sin(a0) * this.shieldRadius
                  );
                  innerGfx.arc(0, 0, this.shieldRadius, a0, a1);
                }
              }
            }

            this.shieldsDirty = false;
          }
        } else {
          if (this._pixiGfx) {
            try {
              this._pixiGfx.destroy(true);
            } catch (e) {}
            this._pixiGfx = null;
          }
          if (this._pixiOuterShieldGfx) {
            try {
              this._pixiOuterShieldGfx.destroy(true);
            } catch (e) {}
            this._pixiOuterShieldGfx = null;
          }
          if (this._pixiInnerShieldGfx) {
            try {
              this._pixiInnerShieldGfx.destroy(true);
            } catch (e) {}
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







