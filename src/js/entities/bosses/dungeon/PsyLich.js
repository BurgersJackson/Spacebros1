import { Enemy } from "../../enemies/Enemy.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_FPS, SIM_STEP_MS } from "../../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../../audio/audio-manager.js";
import { Bullet } from "../../projectiles/Bullet.js";
import { FlagshipGuidedMissile } from "../../projectiles/FlagshipGuidedMissile.js";
import { DungeonDrone } from "./DungeonDrone.js";
import { SoulDrainTether } from "./SoulDrainTether.js";
import { WarpBioPod } from "../../zones/WarpBioPod.js";
import { HealthPowerUp, Coin, SpaceNugget } from "../../pickups/index.js";
import { showOverlayMessage } from "../../../utils/ui-helpers.js";
import { pixiCleanupObject, getRenderAlpha } from "../../../rendering/pixi-context.js";

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerPsyLichDependencies(deps) {
  if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class PsyLich extends Enemy {
  constructor(encounterIndex = 1) {
    super("gunboat", null, null, { gunboatLevel: 2 });
    const boost = Math.max(0, encounterIndex - 1);
    const hpScale = 1 + boost * 0.35;

    this.type = "psyLich";
    this.isDungeonBoss = true;
    this.isGunboat = true;
    this.gunboatLevel = 2;
    this.dungeonAsset = "dungeon9.png";

    this.cruiserHullScale = 5.8;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);

    const baseHp = 5625; // Increased by 25% from 4500
    this.hp = Math.round(baseHp * hpScale);
    this.maxHp = this.hp;
    this.livesRemaining = 2; // Has 3 lives total

    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
    // Player collides with outer shield, bullets with inner shield - 3px
    this.hullCollisionRadius = this.innerShieldRadius - 3;
    this.shieldSegments = new Array(10).fill(20);
    this.innerShieldSegments = new Array(14).fill(20);
    this.innerShieldRotation = 0;
    this.baseGunboatRange = 1500;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = 2;
    this.despawnImmune = true;
    this.visualAngleOffset = Math.PI;

    this.disableAutoFire = true;
    this.phaseName = "INTRO";
    this.phaseTimer = 60;
    this.phaseIndex = 0;
    this.phaseTick = 0;

    // Phase shift abilities
    this.isIntangible = false;
    this.phaseShiftCooldown = 0;
    this.soulDrainActive = false;
    this.soulDrainTether = null;
    // Frame-based timer for post-respawn intangibility (replaces setTimeout)
    this.intangibleTimer = 0;
    // Prevent multiple death sequence triggers
    this.deathSequenceTriggered = false;

    this.phaseSeq = [
      { name: "PHASE_IN", duration: 120 },
      { name: "INTANGIBLE", duration: 100 },
      { name: "PSYCHIC_ASSAULT", duration: 160 },
      { name: "LIFE_DRAIN", duration: 140 }
    ];

    const angle = Math.random() * Math.PI * 2;
    const dist = 2800;
    this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
    this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    this.turnSpeed = (Math.PI * 2) / (12.5 * SIM_FPS);
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
    this.phaseShiftCooldown -= dtFactor;

    // Frame-based timer for post-respawn intangibility (replaces setTimeout)
    if (this.intangibleTimer > 0) {
      this.intangibleTimer -= dtFactor;
      if (this.intangibleTimer <= 0) {
        this.isIntangible = false;
        this.intangibleTimer = 0;
      }
    }

    // Phase progression
    if (this.phaseTimer <= 0) {
      const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
      this.phaseIndex++;
      this.phaseName = next.name;
      this.phaseTimer = next.duration;
      this.phaseTick = 0;

      // Handle intangible state
      if (this.phaseName === "INTANGIBLE") {
        this.isIntangible = true;
        showOverlayMessage("PHASE SHIFT - INVULNERABLE", "#a0f", 1200);
      } else if (this.isIntangible) {
        this.isIntangible = false;
      }

      showOverlayMessage(`PSYLICH: ${this.phaseName}`, "#a0f", 900);
    }

    // Movement style per phase - Cruiser-based
    const charging = false;
    if (charging) {
      this.circleStrafePreferred = false;
      this.aiState = "SEEK";
      this.thrustPower = 0.8;
      this.maxSpeed = 10.5;
      this.gunboatRange = this.baseGunboatRange + 525;
    } else {
      // More varied movement: alternates between circling, orbiting, flanking, and direct approaches
      const dx = GameContext.player.pos.x - this.pos.x;
      const dy = GameContext.player.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (typeof this.moveModeTimer !== "number") this.moveModeTimer = 0;
      if (!this.moveMode) this.moveMode = "CIRCLE";
      this.moveModeTimer -= deltaTime / 16.67;
      if (this.moveModeTimer <= 0) {
        const r = Math.random();
        if (dist > 1700) this.moveMode = r < 0.55 ? "SEEK" : r < 0.8 ? "CIRCLE" : "ORBIT";
        else this.moveMode = r < 0.38 ? "CIRCLE" : r < 0.6 ? "ORBIT" : r < 0.82 ? "SEEK" : "FLANK";
        this.flankSide = Math.random() < 0.5 ? 1 : -1;
        this.moveModeTimer = 22 + Math.floor(Math.random() * 45);
      }

      if (this.moveMode === "SEEK") {
        this.circleStrafePreferred = false;
        this.aiState = "SEEK";
        this.thrustPower = 0.65;
        this.maxSpeed = 9.75;
      } else if (this.moveMode === "ORBIT") {
        this.circleStrafePreferred = false;
        this.aiState = "ORBIT";
        this.thrustPower = 0.6;
        this.maxSpeed = 8.25;
      } else if (this.moveMode === "FLANK") {
        this.circleStrafePreferred = false;
        this.aiState = "FLANK";
        this.thrustPower = 0.7;
        this.maxSpeed = 10.25;
      } else {
        this.circleStrafePreferred = true;
        this.aiState = "CIRCLE";
        this.thrustPower = 0.5;
        this.maxSpeed = 7.25;
      }
      this.gunboatRange = this.baseGunboatRange;
    }

    this.innerShieldRotation -= 0.08 * dtFactor;
    super.update(deltaTime);

    // Update soul drain tether
    if (this.soulDrainTether && this.soulDrainTether.dead) {
      this.soulDrainTether = null;
      this.soulDrainActive = false;
    }

    // Phase attacks
    if (typeof this.phaseTickAccum === "undefined") this.phaseTickAccum = 0;
    this.phaseTickAccum += dtFactor;
    while (this.phaseTickAccum >= 1) {
      this.phaseTickAccum -= 1;
      this.phaseTick++;
      this.runPhaseAttacks();
    }
  }

  runPhaseAttacks() {
    if (!GameContext.player || GameContext.player.dead) return;

    const aim = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );

    if (this.phaseName === "PHASE_IN") {
      if (this.phaseTick === 1) {
        // Materialize effect
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 25, "#a0f");
      }
      if (this.phaseTick % 30 === 0) {
        // Activate soul drain
        if (!this.soulDrainActive) {
          this.soulDrainTether = new SoulDrainTether(this);
          GameContext.enemies.push(this.soulDrainTether);
          this.soulDrainActive = true;
        }
      }
      if (this.phaseTick % 40 === 0) {
        // Flame breath
        if (_spawnParticles)
          _spawnParticles(
            this.pos.x + Math.cos(aim) * 200,
            this.pos.y + Math.sin(aim) * 200,
            10,
            "#f84"
          );
      }
    } else if (this.phaseName === "INTANGIBLE") {
      // Invulnerable - move through player
      if (this.phaseTick % 60 === 0) {
        // Teleport around player
        const dist = 300;
        const a = Math.random() * Math.PI * 2;
        this.pos.x = GameContext.player.pos.x + Math.cos(a) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(a) * dist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#a0f");
      }
      if (this.phaseTick % 40 === 0) {
        // Drop bio-pods while intangible
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          GameContext.warpBioPods.push(new WarpBioPod(this.pos.x, this.pos.y, a, this));
        }
      }
    } else if (this.phaseName === "PSYCHIC_ASSAULT") {
      if (this.phaseTick % 25 === 0) {
        // Homing missiles
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
      if (this.phaseTick % 15 === 0) {
        // Mind-warp zone particles
        if (_spawnParticles)
          _spawnParticles(
            this.pos.x + (Math.random() - 0.5) * 300,
            this.pos.y + (Math.random() - 0.5) * 300,
            3,
            "#a0f"
          );
      }
    } else if (this.phaseName === "LIFE_DRAIN") {
      if (this.phaseTick === 1) {
        // Massive soul drain
        if (!this.soulDrainActive) {
          this.soulDrainTether = new SoulDrainTether(this);
          GameContext.enemies.push(this.soulDrainTether);
          this.soulDrainActive = true;
          // Extend duration for massive drain
          if (this.soulDrainTether) {
            this.soulDrainTether.life = 180;
            this.soulDrainTether.damagePerSecond = 8;
            this.soulDrainTether.healPerSecond = 8;
          }
        }
      }
      if (this.phaseTick % 10 === 0) {
        // Rapid fire
        const b = new Bullet(this.pos.x, this.pos.y, aim, 27, {
          owner: "enemy",
          damage: 1,
          radius: 3,
          color: "#f0a",
          life: 38
        });
        b.owner = this;
        GameContext.bullets.push(b);
        playSound("rapid_shoot");
      }
    } else if (this.phaseName === "DEATH_THROES") {
      if (this.phaseTick === 1) {
        // Fade out effect
        this.alpha = 0.5;
      }
      if (this.phaseTick === 40) {
        // Shockwave then check for respawn
        this.triggerDeathOrRespawn();
      }
    }
  }

  triggerDeathOrRespawn() {
    // Create shockwave
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 30, "#a0f");
    if (GameContext.player && !GameContext.player.dead) {
      const dx = GameContext.player.pos.x - this.pos.x;
      const dy = GameContext.player.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 800 && dist > 0) {
        const pushForce = 20;
        GameContext.player.vel.x += (dx / dist) * pushForce;
        GameContext.player.vel.y += (dy / dist) * pushForce;
      }
    }

    if (this.livesRemaining > 0) {
      // Respawn
      this.livesRemaining--;
      this.hp = this.maxHp;
      this.isIntangible = true;
      this.dead = false;
      this.deathSequenceTriggered = false;
      this.phaseName = "PHASE_IN";
      this.phaseTimer = 120;
      this.phaseTick = 0;
      this.phaseIndex = 0;
      this.alpha = 1;

      // Teleport to new position
      const dist = 2000 + Math.random() * 800;
      const angle = Math.random() * Math.PI * 2;
      this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
      this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
      this.prevPos.x = this.pos.x;
      this.prevPos.y = this.pos.y;

      showOverlayMessage(
        `PSYLICH RESURRECTS! ${this.livesRemaining + 1} LIVES REMAINING`,
        "#a0f",
        2500
      );
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 50, "#a0f");
      playSound("warp_in");

      // Frame-based timer for intangibility expiry (replaces setTimeout)
      this.intangibleTimer = 180; // 3 seconds at 60fps
    } else {
      // Final death
      this.kill();
    }
  }

  takeDamage(amount, source) {
    if (this.dead) return;
    if (this.phaseName === "DEATH_THROES") return; // No damage during death sequence
    if (this.isIntangible) {
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 3, "#a0f");
      return; // No damage while intangible
    }

    let remaining = Math.ceil(amount);

    // Apply damage to outer shields first
    if (this.shieldSegments && this.shieldSegments.length > 0) {
      for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.shieldSegments[i]);
        this.shieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    // Apply damage to inner shields
    if (this.innerShieldSegments && this.innerShieldSegments.length > 0 && remaining > 0) {
      for (let i = 0; i < this.innerShieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.innerShieldSegments[i]);
        this.innerShieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    // Only apply HP damage after shields are depleted
    if (remaining > 0) {
      this.hp -= remaining;
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#a0f");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      // Trigger death sequence through phase system
      if (this.phaseName !== "DEATH_THROES" && !this.deathSequenceTriggered) {
        this.deathSequenceTriggered = true;
        // Don't set dead=true yet - wait for DEATH_THROES phase to complete
        this.phaseName = "DEATH_THROES";
        this.phaseTimer = 80;
        this.phaseTick = 0;
      }
    }
  }

  kill() {
    if (this.dead) return;
    this.dead = true;

    // Clear shield segments to prevent visuals from persisting
    if (this.shieldSegments && this.shieldSegments.length > 0) {
      this.shieldSegments = [];
    }
    if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
      this.innerShieldSegments = [];
    }

    // Destroy shield graphics (pixiCleanupObject does not clean _pixiGfx / _pixiInnerGfx)
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

    // Clean up soul drain tether
    if (this.soulDrainTether && !this.soulDrainTether.dead) {
      this.soulDrainTether.kill();
    }
    this.soulDrainTether = null;

    pixiCleanupObject(this);
    if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 4.0, 26);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 4.0);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 150, "#a0f");
    playSound("base_explode");
    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 26);
    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 28);

    // Spawn coins: 22 coins * 10 value = 220 total
    const coinCount = 22;
    const coinValue = 10;
    for (let i = 0; i < coinCount; i++) {
      const coin = new Coin(this.pos.x, this.pos.y, coinValue);
      coin.vel.x = (Math.random() - 0.5) * 5;
      coin.vel.y = (Math.random() - 0.5) * 5;
      GameContext.coins.push(coin);
    }
    playSound("coin");
    // Award nuggets directly: 10 nuggets
    let nuggetCount = 10;
    // Bounty Hunter meta upgrade - bonus nuggets for boss kills
    if (
      GameContext.player &&
      GameContext.player.stats &&
      GameContext.player.stats.bountyBossBonus
    ) {
      nuggetCount += GameContext.player.stats.bountyBossBonus;
    }
    for (let i = 0; i < nuggetCount; i++) {
      const n = new SpaceNugget(this.pos.x, this.pos.y, 1);
      n.vel.x = (Math.random() - 0.5) * 2;
      n.vel.y = (Math.random() - 0.5) * 2;
      GameContext.nuggets.push(n);
    }
    playSound("coin");
    GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

    GameContext.bossActive = false;
    if (GameContext.psyLich === this) GameContext.psyLich = null;
    // Leave GameContext.boss set so game-loop can count arena fight and spawn space station

    showOverlayMessage("PSYLICH FOREVER VANQUISHED", "#a0f", 4000);
    if (musicEnabled) setMusicMode("normal");
  }

  drawBossHud(ctx) {
    if (!GameContext.bossActive || this.dead) return;
    const w = ctx.canvas ? ctx.canvas.width : GameContext.width;
    const barW = Math.min(560, w - 40);
    const x = (w - barW) / 2;
    const y = 14;
    const pct = Math.max(0, this.hp / this.maxHp);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 4, y - 4, barW + 8, 20);
    ctx.strokeStyle = "#a0f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
    ctx.fillStyle = "#a0f";
    ctx.fillRect(x, y, barW * pct, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const phaseText = this.phaseName || "ACTIVE";
    const livesText =
      this.livesRemaining !== undefined ? ` (${this.livesRemaining + 1} LIVES)` : "";
    ctx.fillText(`PSYLICH  (PHASE: ${phaseText})${livesText}`, w / 2, y + 12);
    ctx.restore();
  }

  draw(ctx) {
    super.draw(ctx);
    if (this.dead) return;

    // Draw intangible effect
    if (this.isIntangible) {
      const rPos = this.getRenderPos(getRenderAlpha());
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
      ctx.strokeStyle = "#a0f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rPos.x, rPos.y, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw soul drain tether effect
    if (this.soulDrainActive && this.soulDrainTether && !this.soulDrainTether.dead) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.015) * 0.3;
      ctx.strokeStyle = "#f08";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      if (GameContext.player && !GameContext.player.dead) {
        ctx.lineTo(GameContext.player.pos.x, GameContext.player.pos.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
