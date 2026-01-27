import { Enemy } from "../../enemies/Enemy.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_FPS, SIM_STEP_MS } from "../../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../../audio/audio-manager.js";
import { Bullet } from "../../projectiles/Bullet.js";
import { CruiserMineBomb } from "../../projectiles/CruiserMineBomb.js";
import { FlagshipGuidedMissile } from "../../projectiles/FlagshipGuidedMissile.js";
import { GravityWell } from "./GravityWell.js";
import { HealthPowerUp } from "../../pickups/HealthPowerUp.js";
import { showOverlayMessage } from "../../../utils/ui-helpers.js";
import { pixiCleanupObject } from "../../../rendering/pixi-context.js";

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerVortexMatriarchDependencies(deps) {
  if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class VortexMatriarch extends Enemy {
  constructor(encounterIndex = 1) {
    super("gunboat", null, null, { gunboatLevel: 2 });
    const boost = Math.max(0, encounterIndex - 1);
    const hpScale = 1 + boost * 0.35;

    this.type = "vortexMatriarch";
    this.isDungeonBoss = true;
    this.isGunboat = true;
    this.gunboatLevel = 2;
    this.dungeonAsset = "dungeon7.png";

    this.cruiserHullScale = 6.3;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);

    const baseHp = 225;
    this.hp = Math.round(baseHp * hpScale);
    this.maxHp = this.hp;

    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
    // Player collides with outer shield, bullets with inner shield - 3px
    this.hullCollisionRadius = this.innerShieldRadius - 3;
    this.shieldSegments = new Array(14).fill(4);
    this.innerShieldSegments = new Array(18).fill(4);
    this.innerShieldRotation = 0;
    this.baseGunboatRange = 950;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = 2;
    this.despawnImmune = true;
    this.visualAngleOffset = Math.PI;

    this.disableAutoFire = true;
    this.phaseName = "INTRO";
    this.phaseTimer = 60;
    this.phaseIndex = 0;
    this.phaseTick = 0;

    // Gravity abilities
    this.gravityWells = [];
    this.gravityWellCooldown = 0;
    this.graviticShieldActive = false;
    this.graviticShieldCooldown = 0;
    this.eventHorizonTriggered = false;
    // Frame-based timer for Event Horizon damage (replaces setTimeout)
    this.eventHorizonTimer = 0;
    this.eventHorizonDamagePending = false;
    this.eventHorizonPullRadius = 1500;
    this.eventHorizonDamage = 30;

    this.phaseSeq = [
      { name: "GRAVITY_WELL", duration: 140 },
      { name: "DEFENDERS_CALL", duration: 160 },
      { name: "REFLECTION", duration: 130 },
      { name: "ORBITAL_BOMBARDMENT", duration: 180 },
      { name: "SINGULARITY", duration: 150 }
    ];

    const angle = Math.random() * Math.PI * 2;
    const dist = 2800;
    this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
    this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    this.turnSpeed = (Math.PI * 2) / (14 * SIM_FPS);
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
    this.gravityWellCooldown -= dtFactor;
    this.graviticShieldCooldown -= dtFactor;

    // Frame-based timer for Event Horizon damage (replaces setTimeout)
    if (this.eventHorizonTimer > 0) {
      this.eventHorizonTimer -= dtFactor;
      if (this.eventHorizonTimer <= 0 && this.eventHorizonDamagePending) {
        this.applyEventHorizonDamage();
        this.eventHorizonTimer = 0;
        this.eventHorizonDamagePending = false;
      }
    }

    // Event Horizon at 35% HP
    if (!this.eventHorizonTriggered && this.hp / this.maxHp <= 0.35) {
      this.eventHorizonTriggered = true;
      this.activateEventHorizon();
    }

    // Phase progression
    if (this.phaseTimer <= 0) {
      const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
      this.phaseIndex++;
      this.phaseName = next.name;
      this.phaseTimer = next.duration;
      this.phaseTick = 0;
      showOverlayMessage(`VORTEX MATRIARCH: ${this.phaseName}`, "#0af", 900);
    }

    // Movement style per phase - Cruiser-based
    const charging = false;
    if (charging) {
      this.circleStrafePreferred = false;
      this.aiState = "SEEK";
      this.thrustPower = 0.64;
      this.maxSpeed = 8.4;
      this.gunboatRange = this.baseGunboatRange + 350;
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
        this.thrustPower = 0.52;
        this.maxSpeed = 7.8;
      } else if (this.moveMode === "ORBIT") {
        this.circleStrafePreferred = false;
        this.aiState = "ORBIT";
        this.thrustPower = 0.48;
        this.maxSpeed = 6.6;
      } else if (this.moveMode === "FLANK") {
        this.circleStrafePreferred = false;
        this.aiState = "FLANK";
        this.thrustPower = 0.56;
        this.maxSpeed = 8.2;
      } else {
        this.circleStrafePreferred = true;
        this.aiState = "CIRCLE";
        this.thrustPower = 0.4;
        this.maxSpeed = 5.8;
      }
      this.gunboatRange = this.baseGunboatRange;
    }

    this.innerShieldRotation -= 0.07 * dtFactor;
    super.update(deltaTime);

    // Update gravity wells
    this.gravityWells = this.gravityWells.filter(w => w && !w.dead);

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

    if (this.phaseName === "GRAVITY_WELL") {
      if (this.phaseTick % 50 === 0 && this.gravityWellCooldown <= 0) {
        // Spawn gravity wells
        for (let i = 0; i < 2; i++) {
          const offset = (Math.random() - 0.5) * 400;
          const well = new GravityWell(this.pos.x + offset, this.pos.y + offset, this);
          this.gravityWells.push(well);
        }
        this.gravityWellCooldown = 120;
      }
      if (this.phaseTick % 30 === 0) {
        // Ring attack
        for (let i = 0; i < 14; i++) {
          const a = ((Math.PI * 2) / 14) * i;
          const b = new Bullet(this.pos.x, this.pos.y, a, 9, {
            owner: "enemy",
            damage: 1,
            radius: 4,
            color: "#0af"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
    } else if (this.phaseName === "DEFENDERS_CALL") {
      if (this.phaseTick % 40 === 0) {
        // Spawn hive defenders
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 600 + Math.random() * 300;
          const e = new Enemy("defender", {
            x: this.pos.x + Math.cos(a) * d,
            y: this.pos.y + Math.sin(a) * d
          });
          e.despawnImmune = true;
          GameContext.enemies.push(e);
        }
        showOverlayMessage("DEFENDERS DEPLOYED", "#0af", 1200);
      }
      // Tractor beam pull
      if (this.phaseTick % 5 === 0 && GameContext.player && !GameContext.player.dead) {
        const dx = this.pos.x - GameContext.player.pos.x;
        const dy = this.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1200 && dist > 0) {
          GameContext.player.vel.x += (dx / dist) * 0.6;
          GameContext.player.vel.y += (dy / dist) * 0.6;
        }
      }
    } else if (this.phaseName === "REFLECTION") {
      if (this.phaseTick === 1) {
        this.graviticShieldActive = true;
        showOverlayMessage("GRAVITIC SHIELD ACTIVE", "#0af", 1500);
      }
      if (this.phaseTick === this.phaseSeq[2].duration - 30) {
        this.graviticShieldActive = false;
      }
      if (this.phaseTick % 45 === 0) {
        // Minefield
        for (let i = 0; i < 5; i++) {
          const a = ((Math.PI * 2) / 5) * i;
          GameContext.bossBombs.push(new CruiserMineBomb(this, a, 700, 2, this.radius * 1.5));
        }
        playSound("heavy_shoot");
      }
    } else if (this.phaseName === "ORBITAL_BOMBARDMENT") {
      if (this.phaseTick % 35 === 0) {
        // Guided missiles
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
      if (this.phaseTick % 25 === 0) {
        // Spread shots
        for (let i = -2; i <= 2; i++) {
          const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.2, 11, {
            owner: "enemy",
            damage: 1,
            radius: 4,
            color: "#0af"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shoot");
      }
    } else if (this.phaseName === "SINGULARITY") {
      if (this.phaseTick % 15 === 0) {
        // Massive gravity pull
        if (GameContext.player && !GameContext.player.dead) {
          const dx = this.pos.x - GameContext.player.pos.x;
          const dy = this.pos.y - GameContext.player.pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1500 && dist > 0) {
            GameContext.player.vel.x += (dx / dist) * 1.5;
            GameContext.player.vel.y += (dy / dist) * 1.5;
          }
        }
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 8, "#0af");
      }
      if (this.phaseTick % 40 === 0) {
        // Ring attacks
        for (let i = 0; i < 20; i++) {
          const a = ((Math.PI * 2) / 20) * i;
          const b = new Bullet(this.pos.x, this.pos.y, a, 10, {
            owner: "enemy",
            damage: 1,
            radius: 4,
            color: "#0cf"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
    }
  }

  activateEventHorizon() {
    showOverlayMessage("EVENT HORIZON!", "#0af", 2000);
    // Frame-based timer: 3 seconds at 60fps = 180 frames
    this.eventHorizonTimer = 180;
    this.eventHorizonDamagePending = true;
  }

  applyEventHorizonDamage() {
    if (GameContext.player && !GameContext.player.dead) {
      const dist = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (dist < this.eventHorizonPullRadius) {
        GameContext.player.hp = Math.max(0, GameContext.player.hp - this.eventHorizonDamage);
        showOverlayMessage("EVENT HORIZON DAMAGE!", "#f00", 1500);
      }
    }
  }

  takeDamage(amount, source) {
    if (this.dead) return;

    let remaining = Math.ceil(amount);

    if (this.shieldSegments && this.shieldSegments.length > 0) {
      for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.shieldSegments[i]);
        this.shieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    if (this.innerShieldSegments && this.innerShieldSegments.length > 0 && remaining > 0) {
      for (let i = 0; i < this.innerShieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.innerShieldSegments[i]);
        this.innerShieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    if (remaining > 0) {
      this.hp -= remaining;
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#0af");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.kill();
    }
  }

  kill() {
    if (this.dead) return;
    this.dead = true;

    // Clean up gravity wells
    this.gravityWells.forEach(w => {
      if (w && !w.dead) w.kill();
    });
    this.gravityWells = [];

    pixiCleanupObject(this);
    if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 3.8, 26);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.8);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 130, "#0af");
    playSound("base_explode");
    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 23);
    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 25);

    // Award coins directly: 17 coins * 10 value = 170 total
    if (_awardCoinsInstant) _awardCoinsInstant(170, { noSound: false, sound: "coin" });
    // Award nuggets directly: 7 nuggets
    let nuggetCount = 7;
    // Bounty Hunter meta upgrade - bonus nuggets for boss kills
    if (
      GameContext.player &&
      GameContext.player.stats &&
      GameContext.player.stats.bountyBossBonus
    ) {
      nuggetCount += GameContext.player.stats.bountyBossBonus;
    }
    if (_awardNuggetsInstant) _awardNuggetsInstant(nuggetCount, { noSound: false, sound: "coin" });
    GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

    GameContext.bossActive = false;
    if (GameContext.vortexMatriarch === this) GameContext.vortexMatriarch = null;
    if (GameContext.boss === this) GameContext.boss = null;

    showOverlayMessage("VORTEX MATRIARCH DESTROYED", "#0af", 3000);
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
    ctx.strokeStyle = "#0af";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
    ctx.fillStyle = "#0af";
    ctx.fillRect(x, y, barW * pct, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const phaseText = this.phaseName || "ACTIVE";
    ctx.fillText(`VORTEX MATRIARCH  (PHASE: ${phaseText})`, w / 2, y + 12);
    ctx.restore();
  }
}
