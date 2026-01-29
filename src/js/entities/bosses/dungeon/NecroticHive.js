import { Enemy } from "../../enemies/Enemy.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_FPS, SIM_STEP_MS } from "../../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../../audio/audio-manager.js";
import { Bullet } from "../../projectiles/Bullet.js";
import { FlagshipGuidedMissile } from "../../projectiles/FlagshipGuidedMissile.js";
import { WarpBioPod } from "../../zones/WarpBioPod.js";
import { DungeonDrone } from "./DungeonDrone.js";
import { HealthPowerUp } from "../../pickups/HealthPowerUp.js";
import { showOverlayMessage } from "../../../utils/ui-helpers.js";
import { pixiCleanupObject, getRenderAlpha } from "../../../rendering/pixi-context.js";

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _spawnNapalmZone = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerNecroticHiveDependencies(deps) {
  if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnNapalmZone) _spawnNapalmZone = deps.spawnNapalmZone;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class NecroticHive extends Enemy {
  constructor(encounterIndex = 1) {
    super("gunboat", null, null, { gunboatLevel: 2 });
    const boost = Math.max(0, encounterIndex - 1);
    const hpScale = 1 + boost * 0.35;

    this.type = "necroticHive";
    this.isDungeonBoss = true;
    this.isGunboat = true;
    this.gunboatLevel = 2;
    this.dungeonAsset = "dungeon4.png";

    // Visual scale - organic, insect-like appearance
    this.cruiserHullScale = 6.5;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);

    const baseHp = 5500;
    this.hp = Math.round(baseHp * hpScale);
    this.maxHp = this.hp;

    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
    // Player collides with outer shield, bullets with inner shield - 3px
    this.hullCollisionRadius = this.innerShieldRadius - 3;
    this.shieldSegments = new Array(14).fill(20);
    this.innerShieldSegments = new Array(20).fill(20);
    this.innerShieldRotation = 0;
    this.gunboatShieldRecharge = 90;
    this.gunboatMuzzleDist = Math.round(6 * this.cruiserHullScale);
    this.baseGunboatRange = 950;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = 2;
    this.cruiserFireDelay = 14;
    this.despawnImmune = true;
    this.turretAngle = 0;
    this.shootTimer = this.cruiserFireDelay;
    this.encounterIndex = encounterIndex;
    this.visualAngleOffset = Math.PI;

    this.disableAutoFire = true;
    this.vulnerableDurationFrames = 90;
    this.vulnerableTimer = 0;
    this.phaseName = "INTRO";
    this.phaseTimer = 60;
    this.phaseIndex = 0;
    this.phaseTick = 0;

    // Drone swarm system
    this.drones = [];
    this.maxDrones = 8;
    this.droneRespawnCooldown = 180;
    this.hiveResurgenceTriggered = false;

    // Phase sequence
    this.phaseSeq = [
      { name: "SWARM_SUMMON", duration: 120 },
      { name: "PROTECTIVE_RING", duration: 180 },
      { name: "PARASITE_BURST", duration: 150 },
      { name: "FRENZY", duration: 100 },
      { name: "HIVE_MIND", duration: 200 }
    ];

    const angle = Math.random() * Math.PI * 2;
    const dist = 2800;
    this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
    this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    this.turnSpeed = (Math.PI * 2) / (16 * SIM_FPS);
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
    this.vulnerableTimer -= dtFactor;
    this.droneRespawnCooldown -= dtFactor;

    // Hive Resurgence at 30% HP
    if (!this.hiveResurgenceTriggered && this.hp / this.maxHp <= 0.3) {
      this.hiveResurgenceTriggered = true;
      for (let i = 0; i < this.maxDrones; i++) {
        this.spawnDrone();
      }
      showOverlayMessage("HIVE RESURGENCE!", "#f80", 2000);
    }

    // Phase progression
    if (this.phaseTimer <= 0) {
      if (this.phaseName === "HIVE_MIND") {
        this.vulnerableTimer = this.vulnerableDurationFrames;
      }
      const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
      this.phaseIndex++;
      this.phaseName = next.name;
      this.phaseTimer = next.duration;
      this.phaseTick = 0;
      showOverlayMessage(`NECROTIC HIVE: ${this.phaseName}`, "#f80", 900);
    }

    // Movement style per phase - Cruiser-based
    const charging = this.phaseName === "FRENZY";
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

    this.innerShieldRotation -= 0.08 * dtFactor;
    super.update(deltaTime);

    // Phase attacks
    if (typeof this.phaseTickAccum === "undefined") this.phaseTickAccum = 0;
    this.phaseTickAccum += dtFactor;
    while (this.phaseTickAccum >= 1) {
      this.phaseTickAccum -= 1;
      this.phaseTick++;
      this.runPhaseAttacks();
    }

    // Drone management
    this.updateDrones(dtFactor);
  }

  runPhaseAttacks() {
    if (!GameContext.player || GameContext.player.dead) return;

    const aim = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );

    if (this.phaseName === "SWARM_SUMMON") {
      if (this.phaseTick % 20 === 0) {
        this.spawnDrone();
      }
      if (this.phaseTick % 60 === 0) {
        // Chitin barrage arc
        for (let i = 0; i < 16; i++) {
          const a = aim - 0.8 + (i / 15) * 1.6;
          const b = new Bullet(this.pos.x, this.pos.y, a, 11, {
            owner: "enemy",
            damage: 1,
            radius: 3,
            color: "#f6f"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
    } else if (this.phaseName === "PROTECTIVE_RING") {
      if (this.phaseTick % 30 === 0) {
        // Guided missiles
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
      if (this.phaseTick % 45 === 0) {
        // Ring attack from drones
        for (let i = 0; i < 12; i++) {
          const a = ((Math.PI * 2) / 12) * i;
          const b = new Bullet(this.pos.x, this.pos.y, a, 13, {
            owner: "enemy",
            damage: 1,
            radius: 4,
            color: "#f80"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
    } else if (this.phaseName === "PARASITE_BURST") {
      if (this.phaseTick % 40 === 0) {
        // Bio-pods
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          GameContext.warpBioPods.push(new WarpBioPod(this.pos.x, this.pos.y, a, this));
        }
        playSound("warp_pod_pop");
      }
      if (this.phaseTick % 60 === 0) {
        // Napalm zone
        if (_spawnNapalmZone) {
          _spawnNapalmZone(
            this.pos.x + (Math.random() - 0.5) * 200,
            this.pos.y + (Math.random() - 0.5) * 200,
            3,
            80
          );
        }
      }
    } else if (this.phaseName === "FRENZY") {
      if (this.phaseTick % 8 === 0) {
        // Rapid triple spread
        for (let i = -1; i <= 1; i++) {
          const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.15, 12, {
            owner: "enemy",
            damage: 1,
            radius: 3,
            color: "#f44"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("rapid_shoot");
      }
      if (this.phaseTick % 50 === 0) {
        // Ring attack
        for (let i = 0; i < 16; i++) {
          const a = ((Math.PI * 2) / 16) * i;
          const b = new Bullet(this.pos.x, this.pos.y, a, 8, {
            owner: "enemy",
            damage: 1,
            radius: 4,
            color: "#f80"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
      // Drones kamikaze
      if (this.phaseTick % 100 === 0) {
        this.drones.forEach(d => {
          if (d && !d.dead) d.maxSpeed = 12;
        });
      }
    } else if (this.phaseName === "HIVE_MIND") {
      if (this.phaseTick % 5 === 0) {
        // Mega barrage
        const a = aim + Math.sin(this.phaseTick * 0.1) * 0.5;
        const b = new Bullet(this.pos.x, this.pos.y, a, 21, {
          owner: "enemy",
          damage: 1,
          radius: 3,
          color: "#f80"
        });
        b.owner = this;
        GameContext.bullets.push(b);
      }
      if (this.phaseTick === 60) {
        // All drones return to heal
        let healAmount = this.drones.filter(d => d && !d.dead).length;
        this.hp = Math.min(this.maxHp, this.hp + healAmount);
      }
    }
  }

  spawnDrone() {
    if (this.drones.length >= this.maxDrones) return;
    const drone = new DungeonDrone(this);
    this.drones.push(drone);
    GameContext.enemies.push(drone);
  }

  updateDrones(dtFactor) {
    // Clean up dead drones
    this.drones = this.drones.filter(d => d && !d.dead);

    // Respawn dead drones
    if (this.drones.length < this.maxDrones && this.droneRespawnCooldown <= 0) {
      this.spawnDrone();
      this.droneRespawnCooldown = 180;
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
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#f80");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.kill();
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

    // Kill all drones
    this.drones.forEach(d => {
      if (d && !d.dead) d.kill();
    });
    this.drones = [];

    pixiCleanupObject(this);
    if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 3.5, 26);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 120, "#f80");
    playSound("base_explode");
    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 22);
    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 24);

    // Rewards - Award coins directly: 16 coins * 10 value = 160 total
    if (_awardCoinsInstant) _awardCoinsInstant(160, { noSound: false, sound: "coin" });
    // Award nuggets directly: 6 nuggets
    let nuggetCount = 6;
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
    if (GameContext.necroticHive === this) GameContext.necroticHive = null;
    if (GameContext.boss === this) GameContext.boss = null;

    showOverlayMessage("NECROTIC HIVE DESTROYED", "#f80", 3000);
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
    ctx.strokeStyle = "#f80";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
    ctx.fillStyle = "#f80";
    ctx.fillRect(x, y, barW * pct, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const phaseText = this.phaseName || "ACTIVE";
    ctx.fillText(`NECROTIC HIVE  (PHASE: ${phaseText})`, w / 2, y + 12);
    ctx.restore();
  }

  draw(ctx) {
    super.draw(ctx);
    if (this.dead) return;

    // Draw vulnerability indicator
    if (this.vulnerableTimer > 0) {
      const rPos = this.getRenderPos(getRenderAlpha());
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.3;
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rPos.x, rPos.y, this.radius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
