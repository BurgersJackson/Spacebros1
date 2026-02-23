/**
 * Enemy.js
 * Core enemy class for spacebros (roamers, hunters, elites, gunboats).
 */

import { Entity } from "../Entity.js";
import { Vector } from "../../core/math.js";
import { GameContext, getEnemyHpScaling, getLevelHpScaling } from "../../core/game-context.js";
import { SIM_STEP_MS, SIM_FPS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { findSpawnPointRelative } from "../../utils/spawn-utils.js";
import { Bullet } from "../projectiles/Bullet.js";
import { Coin } from "../pickups/Coin.js";
import { SpaceNugget } from "../pickups/SpaceNugget.js";

import {
  pixiEnemyLayer,
  pixiVectorLayer,
  pixiEnemySpritePools,
  pixiTextures,
  pixiTextureAnchors,
  pixiTextureRotOffsets,
  pixiTextureBaseScales,
  pixiTextureScaleToRadius,
  allocPixiSprite,
  releasePixiEnemySprite,
  pixiCleanupObject,
  getRenderAlpha
} from "../../rendering/pixi-context.js";
import { isInViewRadius } from "../../core/performance.js";

// Dependency placeholders for main.js functions
let _spawnLargeExplosion = null;
let _spawnFieryExplosion = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;
let _spawnParticles = null;
let _spawnSmoke = null;
let _checkDespawn = null;
let _checkWallCollision = null;
let _rayCast = null;
let _spawnBarrelSmoke = null;

/**
 * Register dependencies from main.js logic.
 */
export function registerEnemyDependencies(deps) {
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnSmoke) _spawnSmoke = deps.spawnSmoke;
  if (deps.checkDespawn) _checkDespawn = deps.checkDespawn;
  if (deps.checkWallCollision) _checkWallCollision = deps.checkWallCollision;
  if (deps.rayCast) _rayCast = deps.rayCast;
  if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
}

export class Enemy extends Entity {
  constructor(type = "roamer", startPos = null, assignedBase = null, opts = {}) {
    super(0, 0);
    this._pixiPool = "enemy";
    this.type = type;
    this.assignedBase = assignedBase;
    this.shieldSegments = [];
    this._cachedRenderPos = null;
    this.shieldRadius = 0;
    this.shieldRotation = 0;
    this.modifier = null;
    this.nameTag = null;
    this.sprite = null;
    this._pixiGfx = null;
    this._pixiInnerGfx = null;
    this.shieldsDirty = true;
    this._pixiNameText = null;
    this.freezeTimer = 0;
    this.freezeCooldown = 0;
    this.useL2Graphics = GameContext.currentLevel === 3 && Math.random() < 0.5;

    if (startPos) {
      this.pos.x = startPos.x;
      this.pos.y = startPos.y;
    } else {
      const start = findSpawnPointRelative(GameContext, true);
      this.pos.x = start.x;
      this.pos.y = start.y;
    }

    this.radius = 20;
    const speedMult = 1 + (GameContext.difficultyTier - 1) * 0.1;
    this.thrustPower = 0.72 * speedMult; // quadrupled (0.18 * 4) for 60Hz
    this.maxSpeed = 13.6 * speedMult; // doubled (6.8 * 2) for 60Hz
    this.rotationSpeed = 0.1; // 0.05 * 2
    this.friction = 0.94; // 0.97^2 approx 0.941

    const scale = getEnemyHpScaling();
    const levelScale = getLevelHpScaling();

    const l2FireRateMult = 1;

    if (this.type === "roamer") {
      const elapsedMs = Date.now() - GameContext.gameStartTime - (GameContext.pausedAccumMs || 0);
      const elapsedMinutes = elapsedMs / 60000;
      const baseHp = elapsedMinutes < 5 ? 200 : 250;
      this.hp = (baseHp + GameContext.difficultyTier * 15) * scale * levelScale;
      this.shootTimer = 26 * l2FireRateMult;
    } else if (this.type === "elite_roamer") {
      this.hp = (350 + GameContext.difficultyTier * 25) * scale * levelScale;
      this.shieldRadius = 38;
      this.shieldSegments = new Array(6).fill(10);
      this.radius = 19;
      this.maxSpeed *= 1.05;
      this.shootTimer = 20 * l2FireRateMult;
    } else if (this.type === "hunter") {
      this.hp = (400 + GameContext.difficultyTier * 35) * scale * levelScale;
      this.radius = 22;
      this.maxSpeed = 13.0 + GameContext.difficultyTier * 0.5;
      this.thrustPower = 1.2;
      this.shieldSegments = new Array(4).fill(10);
      this.shieldRadius = 45;
      this.shootTimer = 14 * l2FireRateMult;
    } else if (this.type === "defender") {
      this.hp = (250 + (GameContext.difficultyTier - 1) * 25) * scale * levelScale;
      this.radius = 20;
      this.shootTimer = 26 * l2FireRateMult;
    }

    // Named elite modifiers
    if (this.type === "elite_roamer" || this.type === "hunter") {
      const mods = ["explosive", "split", "stealth"];
      if (Math.random() < 0.12) {
        this.modifier = mods[Math.floor(Math.random() * mods.length)];
        const names = ["NOVA", "SHADE", "VIPER", "TITAN", "EMBER", "PHANTOM", "ION"];
        this.nameTag = names[Math.floor(Math.random() * names.length)];
        this.hp += 20; // slight buff for named elites (scaled 10x)
      }
    }

    // Apply size multiplier for small enemy types (roamer, elite_roamer, hunter, defender)
    // This must happen before gunboat initialization to ensure correct sizing
    if (
      this.type === "roamer" ||
      this.type === "elite_roamer" ||
      this.type === "hunter" ||
      this.type === "defender"
    ) {
      const sizeMult = 3;
      // Ensure radius is set before multiplying (safety check)
      if (!this.radius || this.radius < 10) {
        this.radius =
          this.type === "roamer" || this.type === "defender"
            ? 20
            : this.type === "elite_roamer"
              ? 19
              : 22;
      }
      this.radius = Math.round(this.radius * sizeMult);
      if (this.shieldRadius) this.shieldRadius = Math.round(this.shieldRadius * sizeMult);
    }

    const baseTurnSpeed = (Math.PI * 2) / (4 * SIM_FPS);
    if (
      this.type === "roamer" ||
      this.type === "elite_roamer" ||
      this.type === "defender" ||
      this.type === "hunter" ||
      this.type === "cave_gunboat1" ||
      this.type === "cave_gunboat2"
    ) {
      this.turnSpeed = baseTurnSpeed * 1.5;
    } else {
      this.turnSpeed = baseTurnSpeed;
    }
    this.smoothDir = new Vector(Math.random(), Math.random());

    this.aiState = "SEEK";
    this.aiTimer = 0;
    this.freezeTimer = 0;
    this.freezeCooldown = 0;
    this.flankSide = 1;
    // Check if this is a gunboat (either by type string or by being a Gunboat instance)
    // Gunboat class will override these properties, so we only initialize if not already a Gunboat instance
    this.isGunboat = type === "gunboat" || type === "cave_gunboat1" || type === "cave_gunboat2";
    this.gunboatLevel = 1;
    // Check if this instance is already a Gunboat subclass (to avoid duplicate initialization)
    // We check constructor name since instanceof check would require importing Gunboat here (circular dependency)
    const isGunboatClass =
      this.constructor.name === "Gunboat" ||
      this.constructor.name === "CaveGunboat1" ||
      this.constructor.name === "CaveGunboat2";
    if (this.isGunboat && !isGunboatClass) {
      // Only initialize gunboat properties if this is not already a Gunboat instance
      // (Gunboat class will handle its own initialization)
      // Determine gunboat level: cave_gunboat2 is level 2, others use difficulty/level check
      if (type === "cave_gunboat2") {
        this.gunboatLevel = 2;
      } else if (type === "cave_gunboat1") {
        this.gunboatLevel = 1;
      } else {
        const overrideLevel = opts.gunboatLevel;
        this.gunboatLevel = overrideLevel
          ? overrideLevel
          : GameContext.difficultyTier >= 4 || (GameContext.player && GameContext.player.level >= 6)
            ? 2
            : 1;
      }
      this.radius = 30;
      const baseHp = this.gunboatLevel === 1 ? 200 : 260;
      this.hp = (baseHp + GameContext.difficultyTier * 10) * getEnemyHpScaling() * levelScale;
      this.maxSpeed = 8.0;
      this.thrustPower = 0.88; // quadrupled (0.22 * 4)
      this.shootTimer = this.gunboatLevel === 1 ? 22 : 18; // ~half

      // Shield scaling based on difficulty tier (same as Pinwheel)
      let outerCount = 10;
      let outerHp = 10;
      let innerCount = 0;
      let innerHp = 0;

      if (GameContext.difficultyTier === 1) {
        outerCount = 8;
        outerHp = 10;
      } else if (GameContext.difficultyTier === 2) {
        outerCount = 10;
        outerHp = 10;
      } else if (GameContext.difficultyTier === 3) {
        outerCount = 12;
        outerHp = 10;
      } else if (GameContext.difficultyTier === 4) {
        outerCount = 12;
        outerHp = 20;
        innerCount = 4;
        innerHp = 10;
      } else if (GameContext.difficultyTier === 5) {
        outerCount = 12;
        outerHp = 20;
        innerCount = 6;
        innerHp = 20;
      } else if (GameContext.difficultyTier >= 6) {
        outerCount = 12;
        outerHp = 30 + (GameContext.difficultyTier - 6) * 10;
        innerCount = 8 + (GameContext.difficultyTier - 6);
        innerHp = 20 + Math.floor((GameContext.difficultyTier - 6) / 2) * 10;
      }

      // Gunboats get slightly weaker shields than pinwheels (80% scaling)
      outerHp = Math.max(10, Math.floor(outerHp * 0.8));
      innerHp = Math.max(10, Math.floor(innerHp * 0.8));

      // Store max shield HP for regeneration
      this.maxShieldHp = outerHp;
      this.maxInnerShieldHp = innerHp;

      this.shieldSegments = new Array(outerCount).fill(outerHp);
      this.shieldRadius = 130; // Same as Pinwheel
      this.innerShieldSegments = [];
      if (innerCount > 0) {
        this.innerShieldSegments = new Array(innerCount).fill(innerHp);
      }
      this.innerShieldRadius = innerCount > 0 ? 95 : 0; // Same as Pinwheel

      this.gunboatShieldRecharge = 90; // halved for 60Hz (approx 1.5s)

      // Use Pinwheel's exact sizes
      this.radius = 84; // Pinwheel collision radius
    }
    // Named elite modifiers
    if (this.type === "elite_roamer" || this.type === "hunter") {
      // Circle-strafe preference flags (set after gunboat init so all gunboats orbit)
      this.circleStrafePreferred = false;
      if (this.isGunboat) this.circleStrafePreferred = true;
      else if (this.type === "roamer") this.circleStrafePreferred = Math.random() < 0.3;
      else if (this.type === "elite_roamer" || this.type === "hunter")
        this.circleStrafePreferred = Math.random() < 0.5;
    }
  }

  getAimAngle() {
    if (!GameContext.player || GameContext.player.dead) return 0;
    const dx = GameContext.player.pos.x - this.pos.x;
    const dy = GameContext.player.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    if ((this.type === "elite_roamer" || this.type === "hunter") && dist < 600) {
      const lead = Math.min(30, dist / 10);
      return Math.atan2(
        GameContext.player.pos.y + GameContext.player.vel.y * lead - this.pos.y,
        GameContext.player.pos.x + GameContext.player.vel.x * lead - this.pos.x
      );
    }
    return angle;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;

    // Track enemy kills (not bosses)
    // Check if this is a boss: Cruiser, dungeon boss, or stored in GameContext.boss
    const isBoss =
      this.isCruiser ||
      this.isDungeonBoss ||
      GameContext.boss === this ||
      GameContext.spaceStation === this ||
      GameContext.destroyer === this;

    if (!isBoss) {
      GameContext.enemyKills++;
    } else {
      GameContext.bossKills++;
    }

    // FIX: Clean up shield graphics BEFORE calling pixiCleanupObject
    // This prevents pixiCleanupObject from missing these
    // Clean up base graphics (shield circles) BEFORE calling pixiCleanupObject
    // This prevents pixiCleanupObject from missing these
    if (this._pixiInnerGfx) {
      try {
        if (this._pixiInnerGfx.parent) this._pixiInnerGfx.parent.removeChild(this._pixiInnerGfx);
        this._pixiInnerGfx.destroy(true);
      } catch (e) {}
      this._pixiInnerGfx = null;
    }
    if (this._pixiGfx) {
      try {
        if (this._pixiGfx.parent) this._pixiGfx.parent.removeChild(this._pixiGfx);
        this._pixiGfx.destroy(true);
      } catch (e) {}
      this._pixiGfx = null;
    }
    if (this._pixiNameText) {
      try {
        this._pixiNameText.destroy(true);
      } catch (e) {}
      this._pixiNameText = null;
    }
    if (this._pixiDebugGfx) {
      try {
        if (this._pixiDebugGfx.parent) this._pixiDebugGfx.parent.removeChild(this._pixiDebugGfx);
        this._pixiDebugGfx.destroy(true);
      } catch (e) {}
      this._pixiDebugGfx = null;
    }

    // FIX: Ensure sprite is removed from its parent layer before cleanup
    // This prevents sprites from being left behind if the pool cleanup fails
    if (this.sprite && this.sprite.parent) {
      try {
        this.sprite.parent.removeChild(this.sprite);
      } catch (e) {
        console.warn("Failed to remove sprite from parent:", e);
      }
    }

    pixiCleanupObject(this);

    if (this.isGunboat) playSound("base_explode");
    else playSound("explode");

    // FIX: Mark as dead FIRST before doing anything else
    // This prevents draw() from trying to recreate graphics after cleanup
    if (this.isGunboat) {
      if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);
    } else {
      playSound("explode");
      const boomScale = Math.max(0.9, Math.min(2.6, (this.radius || 30) / 40));
      if (_spawnFieryExplosion) _spawnFieryExplosion(this.pos.x, this.pos.y, boomScale);
    }

    // AWARD COINS DIRECTLY (increased by 25%)
    let val = 2;
    let count = 4; // was 3
    if (this.type === "elite_roamer") {
      val = 3;
      count = 5;
    } // was 4
    if (this.type === "hunter") {
      val = 4;
      count = 7;
    } // was 5
    if (this.type === "defender") {
      val = 3;
      count = 4;
    } // was 3
    if (this.nameTag) {
      val += 1;
      count += 2;
    }
    const caveActive =
      GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active;

    let total = count * val;
    if (this.isGunboat) total += 10 + 5 * 2;
    total = Math.ceil(total * 1.1); // 10% bonus since fewer enemies now

    // Spawn physical coins instead of awarding instantly
    if (total > 0 && !this.noDrops && !this.noCoins) {
      // Determine coin values (prefer higher value coins when possible)
      let remaining = total;
      while (remaining > 0) {
        const coinValue = Math.min(10, remaining);
        const coin = new Coin(this.pos.x, this.pos.y, coinValue);
        // Add random spread
        coin.vel.x = (Math.random() - 0.5) * 3;
        coin.vel.y = (Math.random() - 0.5) * 3;
        GameContext.coins.push(coin);
        remaining -= coinValue;
      }
      playSound("coin");
    }

    // Drop nuggets for player to pick up (elites with nameTag)
    if (this.nameTag && !this.noDrops) {
      let nuggetCount = 1;
      if (
        GameContext.player &&
        GameContext.player.stats &&
        GameContext.player.stats.bountyEliteBonus
      ) {
        nuggetCount += GameContext.player.stats.bountyEliteBonus;
      }
      for (let i = 0; i < nuggetCount; i++) {
        const n = new SpaceNugget(this.pos.x, this.pos.y, 1, 1.5);
        n.vel.x = (Math.random() - 0.5) * 2;
        n.vel.y = (Math.random() - 0.5) * 2;
        GameContext.nuggets.push(n);
      }
      playSound("coin");
    }

    // Sector 2: random chance to drop nuggets (cave / gunboat)
    if (caveActive && !this.noDrops) {
      let p = 0.08;
      if (this.type === "defender") p = 0.14;
      else if (this.type === "elite_roamer") p = 0.12;
      else if (this.type === "hunter") p = 0.16;
      if (this.isGunboat) p = 0.25;

      if (Math.random() < p) {
        const nuggetCount = this.isGunboat ? 2 : 1;
        for (let i = 0; i < nuggetCount; i++) {
          const n = new SpaceNugget(this.pos.x, this.pos.y, 1, 1.5);
          n.vel.x = (Math.random() - 0.5) * 2;
          n.vel.y = (Math.random() - 0.5) * 2;
          GameContext.nuggets.push(n);
        }
        playSound("coin");
      }
    }

    if (this.type === "roamer" || this.type === "elite_roamer" || this.type === "hunter")
      GameContext.roamerRespawnQueue.push(4000 + Math.floor(Math.random() * 4000));
    if (this.isGunboat) {
      // Track gunboat deaths for difficulty tier system (all gunboats, cave and regular)
      GameContext.gunboatsDestroyed++;
      GameContext.gunboatsDestroyedTotal++;
      // Update difficulty tier based on total pinwheels and gunboats destroyed
      const totalDestroyed =
        GameContext.pinwheelsDestroyedTotal + GameContext.gunboatsDestroyedTotal;
      GameContext.difficultyTier = 1 + Math.floor(totalDestroyed / 6);
      GameContext.gunboatRespawnAt = Date.now() + 40000;
    }

    if (this.modifier === "explosive") {
      for (let i = 0; i < 8; i++) {
        const a = ((Math.PI * 2) / 8) * i;
        GameContext.bullets.push(
          new Bullet(this.pos.x, this.pos.y, a, 10, {
            owner: "enemy",
            damage: 2,
            life: 240,
            color: "#f80"
          })
        );
      }
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 20, "#f80");
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    if (!this.despawnImmune && _checkDespawn) _checkDespawn(this, 5000);
    if (this.dead) return;

    const dtFactor = deltaTime / 16.67;

    // Stasis Field Logic (Freeze)
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dtFactor;
      this.vel.x = 0;
      this.vel.y = 0;
      // Skip AI movement when frozen
    } else if (GameContext.player.stats.slowField > 0 && !this.isCruiser && !this.isDungeonBoss) {
      if (this.freezeCooldown > 0) this.freezeCooldown -= dtFactor;

      const dist = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (dist < GameContext.player.stats.slowField && this.freezeCooldown <= 0) {
        this.freezeTimer = GameContext.player.stats.slowFieldDuration;
        this.freezeCooldown = this.freezeTimer + 120; // 2s immunity after freeze
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#0ff");
      }
    }

    if (this.shieldSegments.length > 0) this.shieldRotation += 0.05 * dtFactor;
    if (this.isGunboat && this.shieldSegments.length > 0 && !this.disableShieldRegen) {
      this.gunboatShieldRecharge -= dtFactor;
      if (this.gunboatShieldRecharge <= 0) {
        // Recharge outer shield segments to max
        const idx = this.shieldSegments.findIndex(s => s < this.maxShieldHp);
        if (idx !== -1) {
          this.shieldSegments[idx] = this.maxShieldHp;
          this.shieldsDirty = true;
        }
        // Recharge inner shield segments if present
        if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
          const innerIdx = this.innerShieldSegments.findIndex(s => s < this.maxInnerShieldHp);
          if (innerIdx !== -1) {
            this.innerShieldSegments[innerIdx] = this.maxInnerShieldHp;
            this.shieldsDirty = true;
          }
        }
        // Dungeon bosses regenerate shields every 2 seconds (120 frames), regular gunboats every 3 seconds (180 frames)
        this.gunboatShieldRecharge = this.isDungeonBoss ? 120 : 180;
      }
    }

    if (this.hp <= 2 && this.type !== "roamer") {
      if (Math.random() < 0.1 * dtFactor && _spawnSmoke) _spawnSmoke(this.pos.x, this.pos.y, 1);
    }

    this.aiTimer -= dtFactor;
    if (this.aiTimer <= 0) this.updateAIState();

    // Only calculate movement if not frozen
    if (this.freezeTimer <= 0) {
      const desiredVel = new Vector(0, 0);
      const wantsStandoff =
        this.type === "roamer" ||
        this.type === "elite_roamer" ||
        this.type === "hunter" ||
        this.type === "defender";
      if (this.circleStrafePreferred && this.aiState === "CIRCLE") {
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          const angleToPlayer = Math.atan2(dy, dx);
          const orbitDir = 1; // clockwise
          const targetAngle = angleToPlayer + (orbitDir * Math.PI) / 2;
          desiredVel.x = Math.cos(targetAngle);
          desiredVel.y = Math.sin(targetAngle);
          // keep preferred distance
          const preferred = 700;
          if (dist > preferred + 150) {
            desiredVel.x += dx * 0.001;
            desiredVel.y += dy * 0.001;
          }
          if (dist < preferred - 150) {
            desiredVel.x -= dx * 0.001;
            desiredVel.y -= dy * 0.001;
          }
        }
      } else if (this.aiState === "SEEK") {
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          if (wantsStandoff) {
            // Don't kamikaze: keep space and shoot from range.
            const keepOut = this.type === "hunter" ? 360 : 320;
            if (dist < keepOut) {
              desiredVel.x = -dx;
              desiredVel.y = -dy;
            } else {
              desiredVel.x = dx;
              desiredVel.y = dy;
            }
          } else {
            desiredVel.x = dx;
            desiredVel.y = dy;
          }
        }
      } else if (this.aiState === "ORBIT") {
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) + (this.type === "elite_roamer" ? 0.05 : 0.02);
          desiredVel.x = Math.cos(angle);
          desiredVel.y = Math.sin(angle);
          // More aggressive orbiting - closer range
          if (dist > 500) {
            desiredVel.x += dx * 0.002;
            desiredVel.y += dy * 0.002;
          }
          if (dist < 350) {
            desiredVel.x -= dx * 0.002;
            desiredVel.y -= dy * 0.002;
          }
        }
      } else if (this.aiState === "ATTACK_RUN") {
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          if (wantsStandoff) {
            // "Attack run" becomes a strafe + maintain-range behavior (no ramming).
            const preferred = this.type === "hunter" ? 620 : 560;
            const band = 140;
            if (dist > preferred + band) {
              desiredVel.x = dx;
              desiredVel.y = dy;
            } else if (dist < preferred - band) {
              desiredVel.x = -dx;
              desiredVel.y = -dy;
            } else {
              const inv = dist > 0.001 ? 1 / dist : 0;
              const strafe = this.flankSide || 1;
              desiredVel.x = -dy * inv * strafe;
              desiredVel.y = dx * inv * strafe;
            }
          } else {
            desiredVel.x = dx;
            desiredVel.y = dy;
          }
        }
      } else if (this.aiState === "RETREAT") {
        if (this.assignedBase && !this.assignedBase.dead) {
          desiredVel.x = this.assignedBase.pos.x - this.pos.x;
          desiredVel.y = this.assignedBase.pos.y - this.pos.y;
        } else if (GameContext.player) {
          desiredVel.x = this.pos.x - GameContext.player.pos.x;
          desiredVel.y = this.pos.y - GameContext.player.pos.y;
        }
      } else if (this.aiState === "FLANK") {
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const angleToPlayer = Math.atan2(dy, dx);
          // Break off at ~60-90 degrees relative to player direction
          const targetAngle = angleToPlayer + this.flankSide * (Math.PI / 2.5);
          desiredVel.x = Math.cos(targetAngle);
          desiredVel.y = Math.sin(targetAngle);
        }
      } else if (this.aiState === "EVADE") {
        if (GameContext.player) {
          const dx = this.pos.x - GameContext.player.pos.x;
          const dy = this.pos.y - GameContext.player.pos.y;
          desiredVel.x = -dy;
          desiredVel.y = dx;
        }
      }

      if (desiredVel.mag() > 0) desiredVel.normalize();

      if (this.type === "elite_roamer" || GameContext.difficultyTier >= 4) {
        const dodgeForce = this.calculateDodge();
        desiredVel.add(dodgeForce);
      }

      const sepForce = new Vector(0, 0);
      let count = 0;
      for (let other of GameContext.enemies) {
        if (other === this || other.dead) continue;
        let odx = this.pos.x - other.pos.x;
        let ody = this.pos.y - other.pos.y;
        const distSq = odx * odx + ody * ody;
        if (distSq < 22500) {
          const dist = Math.sqrt(distSq);
          const force = (150 - dist) / 150;
          if (dist > 0) {
            sepForce.x += (odx / dist) * force;
            sepForce.y += (ody / dist) * force;
          }
          count++;
        }
      }
      if (count > 0) {
        sepForce.mult(2.0);
        desiredVel.add(sepForce);
      }

      // Avoid pinwheels/stations/fortresses so we don't rely on collision pushing.
      // Note: Cave bosses are NOT in this list - enemies can fly through them freely.
      const avoid = new Vector(0, 0);
      const obstacles = [];
      for (let b of GameContext.pinwheels)
        if (b && !b.dead) obstacles.push({ e: b, r: b.radius + 420 });
      if (GameContext.spaceStation && !GameContext.spaceStation.dead)
        obstacles.push({ e: GameContext.spaceStation, r: GameContext.spaceStation.radius + 520 });
      if (GameContext.contractEntities && GameContext.contractEntities.fortresses) {
        for (let f of GameContext.contractEntities.fortresses)
          if (f && !f.dead) obstacles.push({ e: f, r: f.radius + 420 });
      }

      for (let o of obstacles) {
        // Defenders can be assigned to a base; only repel strongly if they get too close.
        const dx = this.pos.x - o.e.pos.x;
        const dy = this.pos.y - o.e.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) continue;
        const r = o.r;
        if (dist < r) {
          const t = (r - dist) / r;
          avoid.x += (dx / dist) * (t * 1.6);
          avoid.y += (dy / dist) * (t * 1.6);
        }
      }
      if (avoid.mag() > 0) {
        avoid.normalize();
        avoid.mult(0.9);
        desiredVel.add(avoid);
      }

      // Anti-ram spacing: roamers/defenders should avoid colliding with the player.
      if (wantsStandoff && GameContext.player && !GameContext.player.dead) {
        const dx = this.pos.x - GameContext.player.pos.x;
        const dy = this.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        const keepOut = this.type === "hunter" ? 300 : 260;
        if (dist > 0.001 && dist < keepOut) {
          const t = (keepOut - dist) / keepOut;
          desiredVel.x += (dx / dist) * (2.2 * t);
          desiredVel.y += (dy / dist) * (2.2 * t);
          // Brake a bit so existing momentum doesn't carry into a collision.
          this.vel.mult(0.92);
        }
      }

      if (desiredVel.mag() > 0) desiredVel.normalize();

      this.smoothDir.x = this.smoothDir.x * 0.92 + desiredVel.x * 0.08;
      this.smoothDir.y = this.smoothDir.y * 0.92 + desiredVel.y * 0.08;

      if (this.smoothDir.mag() > 0.1) {
        const targetAngle = Math.atan2(this.smoothDir.y, this.smoothDir.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnStep = this.turnSpeed * dtFactor;
        if (Math.abs(angleDiff) < turnStep) {
          this.angle = targetAngle;
        } else {
          this.angle += Math.sign(angleDiff) * turnStep;
        }
        const forwardX = Math.cos(this.angle);
        const forwardY = Math.sin(this.angle);
        const dirMag = Math.sqrt(
          this.smoothDir.x * this.smoothDir.x + this.smoothDir.y * this.smoothDir.y
        );
        const dot = (forwardX * this.smoothDir.x + forwardY * this.smoothDir.y) / (dirMag || 1);
        if (dot > 0.3) {
          const thrust = this.thrustPower * dtFactor;
          this.vel.x += forwardX * thrust;
          this.vel.y += forwardY * thrust;
        }
      }

      let currentMaxSpeed = this.maxSpeed;
      if (this.circleStrafePreferred && this.aiState === "CIRCLE") {
        currentMaxSpeed *= 1.15;
      } else if (this.aiState === "FLANK") {
        currentMaxSpeed *= 1.6; // Speed boost when flanking
        if (Math.random() < 0.3 && _spawnParticles)
          _spawnParticles(this.pos.x, this.pos.y, 1, "#fa0"); // Engine flare
      }

      const speed = this.vel.mag();
      if (speed > currentMaxSpeed) this.vel.mult(currentMaxSpeed / speed);
    } // End freeze check

    // friction^dtFactor
    this.vel.mult(Math.pow(this.friction, dtFactor));
    super.update(deltaTime);
    if (_checkWallCollision)
      _checkWallCollision(
        this,
        typeof this.wallElasticity === "number" ? this.wallElasticity : 0.8
      );

    let distToPlayer = Infinity;
    if (GameContext.player && !GameContext.player.dead)
      distToPlayer = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
    const attackRange = this.type === "elite_roamer" || this.type === "hunter" ? 800 : 600;

    const gunboatRange = this.isGunboat ? this.gunboatRange || 900 : attackRange;
    let roamerAsteroidBlocked = false;
    if (
      !this.isGunboat &&
      (this.type === "roamer" ||
        this.type === "elite_roamer" ||
        this.type === "hunter" ||
        this.type === "defender") &&
      GameContext.player &&
      !GameContext.player.dead &&
      this.freezeTimer <= 0
    ) {
      const angleToPlayer = this.getAimAngle();
      let hit = null;
      if (_rayCast) hit = _rayCast(this.pos.x, this.pos.y, angleToPlayer, distToPlayer);
      if (hit && hit.hit && hit.obj) {
        const buffer = (GameContext.player.radius || 0) + 10;
        if (hit.dist < distToPlayer - buffer) roamerAsteroidBlocked = true;
      }
    }

    const shouldRoamerClear = roamerAsteroidBlocked && distToPlayer < attackRange * 1.8;
    if (
      !this.disableAutoFire &&
      (distToPlayer < gunboatRange || shouldRoamerClear) &&
      !GameContext.player.dead &&
      this.freezeTimer <= 0
    ) {
      this.shootTimer -= dtFactor;
      if (this.shootTimer <= 0) {
        const angle = this.getAimAngle();
        if (this.isGunboat) {
          const muzzle = this.gunboatMuzzleDist || 28;
          const bx = this.pos.x + Math.cos(angle) * muzzle;
          const by = this.pos.y + Math.sin(angle) * muzzle;
          const dmg = this.isCruiser
            ? this.cruiserBaseDamage || 1
            : this.gunboatLevel === 1
              ? 2
              : 3;
          const bulletSpeed = this.isCruiser ? 18 : 22;
          GameContext.bullets.push(
            new Bullet(bx, by, angle, bulletSpeed, {
              owner: "enemy",
              damage: dmg,
              life: 240,
              color: "#0ff"
            })
          );
          if (this.isCruiser) {
            // Cruiser twin barrels
            const a2 = angle + 0.08;
            GameContext.bullets.push(
              new Bullet(bx, by, a2, bulletSpeed, {
                owner: "enemy",
                damage: dmg,
                life: 240,
                color: "#0ff"
              })
            );
          } else if (this.gunboatLevel === 2) {
            const a2 = angle + 0.08;
            GameContext.bullets.push(
              new Bullet(bx, by, a2, 22, { owner: "enemy", damage: 3, life: 240, color: "#0ff" })
            );
          } else {
            // Gunboat level 1 single shot
          }
          if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, angle);
          this.shootTimer = this.isCruiser
            ? this.cruiserFireDelay || 24
            : this.gunboatLevel === 1
              ? 22
              : 18;
        } else if (this.type === "elite_roamer" || this.type === "hunter") {
          const bx = this.pos.x + Math.cos(angle) * 25;
          const by = this.pos.y + Math.sin(angle) * 25;
          GameContext.bullets.push(
            new Bullet(bx, by, angle, 11, { owner: "enemy", damage: 2, life: 300, color: "#f0f" })
          );
          if (this.modifier === "split") {
            const a2 = angle + (Math.random() - 0.5) * 0.2;
            GameContext.bullets.push(
              new Bullet(bx, by, a2, 11, { owner: "enemy", damage: 2, life: 300, color: "#f0f" })
            );
          }
          if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, angle);
          const l2FireRateMult = 1;
          this.shootTimer = (this.type === "hunter" ? 14 : 20) * l2FireRateMult;
        } else if (GameContext.difficultyTier >= 5 && this.type === "roamer") {
          for (let i = -1; i <= 1; i++) {
            const a = angle + i * 0.2;
            const bx = this.pos.x + Math.cos(a) * 20;
            const by = this.pos.y + Math.sin(a) * 20;
            GameContext.bullets.push(
              new Bullet(bx, by, a, 16, { owner: "enemy", damage: 2, life: 180 })
            );
            if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, a);
          }
          const l2FireRateMult = 1;
          this.shootTimer = 26 * l2FireRateMult;
        } else {
          const bx = this.pos.x + Math.cos(angle) * 20;
          const by = this.pos.y + Math.sin(angle) * 20;
          GameContext.bullets.push(
            new Bullet(bx, by, angle, 16, { owner: "enemy", damage: 2, life: 180 })
          );
          if (_spawnBarrelSmoke) _spawnBarrelSmoke(bx, by, angle);
          const l2FireRateMult = 1;
          this.shootTimer = 26 * l2FireRateMult;
        }
        playSound("shoot");
      }
    }
  }

  updateAIState() {
    if (!GameContext.player || GameContext.player.dead) {
      this.aiState = "IDLE";
      this.aiTimer = 30;
      return;
    }
    const dist = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );

    // All roamers (elite/hunter included) should be actively seeking, not waiting
    if (this.circleStrafePreferred) {
      this.aiState = "CIRCLE";
      this.aiTimer = 45;
    } else if (this.type === "roamer" || this.type === "elite_roamer" || this.type === "hunter") {
      // Check for bunching/crowding
      let neighbors = 0;
      for (let e of GameContext.enemies) {
        if (
          e !== this &&
          !e.dead &&
          (e.type === "roamer" || e.type === "elite_roamer" || e.type === "defender")
        ) {
          const dSq = (e.pos.x - this.pos.x) ** 2 + (e.pos.y - this.pos.y) ** 2;
          if (dSq < 40000) neighbors++; // within 200px
        }
      }

      // More aggressive behavior: flanking and attacking instead of just orbiting
      const roll = Math.random();
      if (neighbors >= 2) {
        // Flank from 2+ neighbors instead of 3
        this.aiState = "FLANK";
        this.aiTimer = 30 + Math.random() * 20;
        this.flankSide = Math.random() < 0.5 ? 1 : -1;
      } else if (dist > 700) {
        this.aiState = "SEEK";
        this.aiTimer = 20 + Math.random() * 10;
      } else if (roll < 0.4) {
        // Attack runs more often instead of orbiting
        this.aiState = "ATTACK_RUN";
        this.aiTimer = 60 + Math.random() * 30;
      } else if (roll < 0.65) {
        this.aiState = "SEEK";
        this.aiTimer = 30 + Math.random() * 15;
      } else {
        this.aiState = "ORBIT";
        this.aiTimer = 90 + Math.random() * 30;
      }
    } else if (this.type === "defender") {
      // More aggressive defenders
      if (this.assignedBase && !this.assignedBase.dead) {
        const distBase = Math.hypot(
          GameContext.player.pos.x - this.assignedBase.pos.x,
          GameContext.player.pos.y - this.assignedBase.pos.y
        );
        const roll = Math.random();
        if (this.hp < 2) {
          this.aiState = "RETREAT";
          this.aiTimer = 80;
        } else if (distBase < 900) {
          if (roll < 0.5) {
            // Attack player more often instead of orbiting base
            this.aiState = "ATTACK_RUN";
            this.aiTimer = 50 + Math.random() * 20;
          } else if (roll < 0.75) {
            this.aiState = "SEEK";
            this.aiTimer = 40 + Math.random() * 15;
          } else {
            this.aiState = "ORBIT";
            this.aiTimer = 60 + Math.random() * 25;
          }
        } else {
          this.aiState = "SEEK";
          this.aiTimer = 30 + Math.random() * 15;
        }
      } else {
        this.aiState = "SEEK";
        this.aiTimer = 30 + Math.random() * 15;
      }
    }
  }

  calculateDodge() {
    const dodgeVec = new Vector(0, 0);
    for (let b of GameContext.bullets) {
      if (b.isEnemy) continue;
      const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
      if (dist < 200) {
        const toMeX = this.pos.x - b.pos.x;
        const toMeY = this.pos.y - b.pos.y;
        const dot = toMeX * b.vel.x + toMeY * b.vel.y;
        if (dot > 0) {
          const perpX = -b.vel.y;
          const perpY = b.vel.x;
          dodgeVec.x += perpX;
          dodgeVec.y += perpY;
        }
      }
    }
    if (dodgeVec.mag() > 0) {
      dodgeVec.normalize();
      dodgeVec.mult(3.0);
    }
    return dodgeVec;
  }

  draw(ctx) {
    if (this.dead) {
      pixiCleanupObject(this);
      return;
    }

    // Interpolate position for smooth rendering on high refresh displays
    // Use global renderAlpha from pixi-context
    const currentAlpha = getRenderAlpha();
    const rPos = this.getRenderPos(currentAlpha);
    // FIX: Cache render position for subclasses (e.g., Cruiser hardpoints)
    this._cachedRenderPos = rPos;

    // Pixi fast path for the hot enemy rendering (hulls + shields + name tags).
    if (pixiEnemyLayer && pixiTextures) {
      // Defensive: some bosses change `type` strings (e.g. flagship) but should always render as cruisers.
      if (
        this.isCruiser ||
        this.type === "cruiser" ||
        this.type === "flagship" ||
        this.isFlagship
      ) {
        this.isGunboat = true;
        this.gunboatLevel = 2;
      }
      // Gunboat/dungeon boss: hide Pixi when out of view to avoid ghost at stale position (draw is always called for isDungeonBoss)
      const inView =
        this.isGunboat || this.isDungeonBoss
          ? isInViewRadius(
              this.pos.x,
              this.pos.y,
              this.visualRadius || this.shieldRadius || this.radius || 50
            )
          : true;
      let tex = null;
      let anchor = 0.5;
      let modelScale = 1;
      let key = null;

      if (this.isGunboat) {
        modelScale = (this.gunboatScale || 1.4) / 1.4;
        if (this.isCruiser) {
          tex = pixiTextures.enemy_cruiser;
          anchor = pixiTextureAnchors.enemy_cruiser || 0.5;
          key = "enemy_cruiser";
        } else if (this.isDungeonBoss && this.dungeonAsset) {
          // Dungeon boss sprites
          const dungeonKey = "enemy_" + this.dungeonAsset.replace(".png", "");
          tex = pixiTextures[dungeonKey];
          anchor = pixiTextureAnchors[dungeonKey] || 0.5;
          key = dungeonKey;
        } else if (this.type === "cave_gunboat2") {
          tex = pixiTextures.cave_gunboat_2;
          anchor = pixiTextureAnchors.cave_gunboat_2 || 0.5;
          key = "cave_gunboat_2";
        } else if (this.type === "cave_gunboat1") {
          tex = pixiTextures.cave_gunboat_1;
          anchor = pixiTextureAnchors.cave_gunboat_1 || 0.5;
          key = "cave_gunboat_1";
        } else if (this.gunboatLevel === 2) {
          tex = pixiTextures.enemy_gunboat_2;
          anchor = pixiTextureAnchors.enemy_gunboat_2 || 0.5;
          key = "enemy_gunboat_2";
        } else {
          tex = pixiTextures.enemy_gunboat_1;
          anchor = pixiTextureAnchors.enemy_gunboat_1 || 0.5;
          key = "enemy_gunboat_1";
        }
      } else if (this.type === "elite_roamer") {
        const useL2 =
          (GameContext.currentLevel === 2 || this.useL2Graphics) &&
          pixiTextures.enemy_elite_roamer_l2;
        tex = useL2 ? pixiTextures.enemy_elite_roamer_l2 : pixiTextures.enemy_elite_roamer;
        anchor = useL2
          ? pixiTextureAnchors.enemy_elite_roamer_l2 || 0.5
          : pixiTextureAnchors.enemy_elite_roamer || 0.5;
        key = useL2 ? "enemy_elite_roamer_l2" : "enemy_elite_roamer";
      } else if (this.type === "hunter") {
        const useL2 =
          (GameContext.currentLevel === 2 || this.useL2Graphics) && pixiTextures.enemy_hunter_l2;
        tex = useL2 ? pixiTextures.enemy_hunter_l2 : pixiTextures.enemy_hunter;
        anchor = useL2
          ? pixiTextureAnchors.enemy_hunter_l2 || 0.5
          : pixiTextureAnchors.enemy_hunter || 0.5;
        key = useL2 ? "enemy_hunter_l2" : "enemy_hunter";
      } else if (this.type === "defender") {
        const useL2 =
          (GameContext.currentLevel === 2 || this.useL2Graphics) && pixiTextures.enemy_defender_l2;
        tex = useL2 ? pixiTextures.enemy_defender_l2 : pixiTextures.enemy_defender;
        anchor = useL2
          ? pixiTextureAnchors.enemy_defender_l2 || 0.5
          : pixiTextureAnchors.enemy_defender || 0.5;
        key = useL2 ? "enemy_defender_l2" : "enemy_defender";
      } else {
        const useL2 =
          (GameContext.currentLevel === 2 || this.useL2Graphics) && pixiTextures.enemy_roamer_l2;
        tex = useL2 ? pixiTextures.enemy_roamer_l2 : pixiTextures.enemy_roamer;
        anchor = useL2
          ? pixiTextureAnchors.enemy_roamer_l2 || 0.5
          : pixiTextureAnchors.enemy_roamer || 0.5;
        key = useL2 ? "enemy_roamer_l2" : "enemy_roamer";
      }

      const stealthAlpha =
        this.modifier === "stealth" ? 0.4 + Math.abs(Math.sin(Date.now() * 0.003)) * 0.4 : 1;

      if (!tex) {
        // Avoid leaving a stale sprite visible (e.g. roamer sprite on a cruiser) if the texture is missing.
        if (this.sprite) {
          releasePixiEnemySprite(this.sprite);
          this.sprite = null;
        }
        if (this._pixiGfx) {
          try {
            this._pixiGfx.destroy(true);
          } catch (e) {}
          this._pixiGfx = null;
        }
        if (this._pixiInnerGfx) {
          try {
            this._pixiInnerGfx.destroy(true);
          } catch (e) {}
          this._pixiInnerGfx = null;
        }
        if (this._pixiNameText) {
          try {
            this._pixiNameText.destroy(true);
          } catch (e) {}
          this._pixiNameText = null;
        }
      } else {
        let spr = this.sprite;
        if (spr && key && spr._pixiKey !== key) {
          releasePixiEnemySprite(spr);
          spr = null;
          this.sprite = null;
        }
        if (!spr) {
          if (!pixiEnemySpritePools[key]) pixiEnemySpritePools[key] = [];
          spr = allocPixiSprite(pixiEnemySpritePools[key], pixiEnemyLayer, tex, null, anchor);
          if (spr) spr._pixiKey = key;
          this.sprite = spr;
        }
        if (spr) {
          spr.texture = tex;
          if (!spr.parent) pixiEnemyLayer.addChild(spr);
          if (typeof anchor === "number") spr.anchor.set(anchor);
          else if (anchor && typeof anchor.x === "number" && typeof anchor.y === "number")
            spr.anchor.set(anchor.x, anchor.y);
          spr.visible = inView;
          spr.position.set(rPos.x, rPos.y);
          spr.rotation = (this.angle || 0) + (pixiTextureRotOffsets[key] || 0);
          let effectiveScale = modelScale;
          if (pixiTextureScaleToRadius[key]) {
            const denom = Math.max(1, Math.max(tex.width || 1, tex.height || 1));
            effectiveScale = (this.radius * 2) / denom;
          }
          effectiveScale *= pixiTextureBaseScales[key] || 1;
          spr.scale.set(effectiveScale);
          spr.alpha = stealthAlpha;
          spr.tint = this.freezeTimer > 0 ? 0x00ffff : 0xffffff;
          spr.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
      }

      // Shields + freeze indicator (Graphics)
      const hasOuter = this.shieldSegments && this.shieldSegments.length > 0;
      const hasInner = this.innerShieldSegments && this.innerShieldSegments.length > 0;
      const needsGfx = !!(hasOuter || hasInner || (this.freezeTimer > 0 && hasOuter));

      if (needsGfx && pixiVectorLayer) {
        // --- Outer Shield & Freeze Highlight ---
        let gfx = this._pixiGfx;
        if (!gfx) {
          gfx = new PIXI.Graphics();
          gfx.pivot.set(0, 0); // Arc is drawn at (0,0); position = world center of shield
          pixiVectorLayer.addChild(gfx);
          this._pixiGfx = gfx;
          this.shieldsDirty = true;
        } else if (!gfx.parent) {
          pixiVectorLayer.addChild(gfx);
        }

        // FIX: Ensure shield graphics position is always fresh (matches boss center)
        const shieldX = rPos.x;
        const shieldY = rPos.y;
        gfx.position.set(shieldX, shieldY);
        gfx.visible = inView;
        gfx.alpha = stealthAlpha;

        // --- Inner Shield ---
        let innerGfx = this._pixiInnerGfx;
        if (hasInner) {
          if (!innerGfx) {
            innerGfx = new PIXI.Graphics();
            innerGfx.pivot.set(0, 0); // Arc drawn at (0,0); position = world center
            pixiVectorLayer.addChild(innerGfx);
            this._pixiInnerGfx = innerGfx;
            this.shieldsDirty = true;
          } else if (!innerGfx.parent) {
            pixiVectorLayer.addChild(innerGfx);
          }
          innerGfx.position.set(shieldX, shieldY);
          innerGfx.visible = inView;
          innerGfx.alpha = stealthAlpha;
        } else if (innerGfx) {
          try {
            innerGfx.destroy(true);
          } catch (e) {}
          this._pixiInnerGfx = null;
          innerGfx = null;
        }

        if (this.shieldsDirty) {
          // OUTER SHIELD REBUILD
          gfx.clear();

          if (hasOuter) {
            const segCount = this.shieldSegments.length;
            const segAngle = (Math.PI * 2) / segCount;
            const shieldColor = this.isCruiser
              ? 0x88ffff
              : this.isGunboat
                ? this.gunboatLevel === 1
                  ? 0xff5555
                  : 0xffaa00
                : this.type === "hunter"
                  ? 0xffaa00
                  : 0xff5555;

            // Draw at rotation 0; container rotation handles the spin
            gfx.lineStyle(2, shieldColor, 1);
            for (let i = 0; i < segCount; i++) {
              if (this.shieldSegments[i] > 0) {
                const a0 = i * segAngle;
                const a1 = (i + 1) * segAngle - 0.2;
                gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                gfx.arc(0, 0, this.shieldRadius, a0, a1);
              }
            }
          }

          // INNER SHIELD REBUILD
          if (hasInner && innerGfx) {
            innerGfx.clear();
            const innerCount = this.innerShieldSegments.length;
            const innerAngle = (Math.PI * 2) / innerCount;
            const innerRadius = this.innerShieldRadius || Math.max(10, this.shieldRadius - 20);
            const innerColor = this.isCruiser
              ? 0x88ffff
              : this.isGunboat
                ? this.gunboatLevel === 1
                  ? 0xff8888
                  : 0xffff00
                : this.type === "hunter"
                  ? 0xffdd55
                  : 0xff8888;

            innerGfx.lineStyle(2, innerColor, 1);
            for (let i = 0; i < innerCount; i++) {
              if (this.innerShieldSegments[i] > 0) {
                const a0 = i * innerAngle + 0.05;
                const a1 = (i + 1) * innerAngle - 0.15;
                innerGfx.moveTo(Math.cos(a0) * innerRadius, Math.sin(a0) * innerRadius);
                innerGfx.arc(0, 0, innerRadius, a0, a1);
              }
            }
          } else if (innerGfx) {
            innerGfx.clear();
          }

          this.shieldsDirty = false;
        }

        // UPDATE ROTATIONS
        if (hasOuter) gfx.rotation = this.shieldRotation;
        else gfx.rotation = 0;

        if (hasInner && innerGfx) {
          const innerRot =
            typeof this.innerShieldRotation === "number"
              ? this.innerShieldRotation
              : -this.shieldRotation;
          innerGfx.rotation = innerRot;
        }
      } else {
        if (this._pixiGfx) {
          try {
            this._pixiGfx.destroy(true);
          } catch (e) {}
          this._pixiGfx = null;
        }
        if (this._pixiInnerGfx) {
          try {
            this._pixiInnerGfx.destroy(true);
          } catch (e) {}
          this._pixiInnerGfx = null;
        }
      }

      // Name tag (rare; only named elites)
      if (this.nameTag && pixiVectorLayer) {
        let t = this._pixiNameText;
        if (!t) {
          t = new PIXI.Text(this.nameTag, {
            fontFamily: "Courier New",
            fontSize: 14,
            fontWeight: "bold",
            fill: 0xffff00
          });
          t.anchor.set(0.5);
          t.resolution = 2;
          pixiVectorLayer.addChild(t);
          this._pixiNameText = t;
        } else if (t.text !== this.nameTag) {
          t.text = this.nameTag;
        }
        if (t && !t.parent) {
          pixiVectorLayer.addChild(t);
        }
        t.visible = inView;
        t.position.set(rPos.x, rPos.y - this.radius - 15);
        t.alpha = stealthAlpha;
      } else if (this._pixiNameText) {
        try {
          this._pixiNameText.destroy(true);
        } catch (e) {}
        this._pixiNameText = null;
      }

      // Debug visualization for Ctrl+H (gunboats only)
      if (
        this.isGunboat &&
        pixiVectorLayer &&
        typeof GameContext.DEBUG_COLLISION !== "undefined" &&
        GameContext.DEBUG_COLLISION
      ) {
        let debugGfx = this._pixiDebugGfx;
        if (!debugGfx) {
          debugGfx = new PIXI.Graphics();
          pixiVectorLayer.addChild(debugGfx);
          this._pixiDebugGfx = debugGfx;
        } else if (!debugGfx.parent) {
          pixiVectorLayer.addChild(debugGfx);
        }

        debugGfx.visible = inView;
        debugGfx.clear();
        debugGfx.position.set(rPos.x, rPos.y);

        // Draw hull collision radius (green)
        debugGfx.lineStyle(3, 0x00ff00, 0.8);
        debugGfx.drawCircle(0, 0, this.radius);

        // Draw outer shield radius (cyan) if shields exist
        if (this.shieldSegments && this.shieldSegments.length > 0) {
          const hasActiveOuter = this.shieldSegments.some(s => s > 0);
          debugGfx.lineStyle(2, hasActiveOuter ? 0x00ffff : 0x888888, hasActiveOuter ? 0.6 : 0.3);
          debugGfx.drawCircle(0, 0, this.shieldRadius);
        }

        // Draw inner shield radius (magenta) if inner shields exist
        if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
          const hasActiveInner = this.innerShieldSegments.some(s => s > 0);
          debugGfx.lineStyle(2, hasActiveInner ? 0xff00ff : 0x888888, hasActiveInner ? 0.6 : 0.3);
          debugGfx.drawCircle(0, 0, this.innerShieldRadius);
        }
      } else if (this._pixiDebugGfx) {
        if (this._pixiDebugGfx.parent) {
          this._pixiDebugGfx.visible = false;
        }
      }
    }
  }
}
