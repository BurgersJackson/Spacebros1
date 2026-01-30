import { Enemy } from "../../enemies/Enemy.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_FPS, SIM_STEP_MS } from "../../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../../audio/audio-manager.js";
import { Bullet } from "../../projectiles/Bullet.js";
import { FlagshipGuidedMissile } from "../../projectiles/FlagshipGuidedMissile.js";
import { PsychicEcho } from "./PsychicEcho.js";
import { HealthPowerUp } from "../../pickups/HealthPowerUp.js";
import { showOverlayMessage } from "../../../utils/ui-helpers.js";
import { pixiCleanupObject } from "../../../rendering/pixi-context.js";

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerCerebralPsionDependencies(deps) {
  if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class CerebralPsion extends Enemy {
  constructor(encounterIndex = 1) {
    super("gunboat", null, null, { gunboatLevel: 2 });
    const boost = Math.max(0, encounterIndex - 1);
    const hpScale = 1 + boost * 0.35;

    this.type = "cerebralPsion";
    this.isDungeonBoss = true;
    this.isGunboat = true;
    this.gunboatLevel = 2;
    this.dungeonAsset = "dungeon5.png";

    this.cruiserHullScale = 6.0;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);

    const baseHp = 4900;
    this.hp = Math.round(baseHp * hpScale);
    this.maxHp = this.hp;

    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
    // Player collides with outer shield, bullets with inner shield - 3px
    this.hullCollisionRadius = this.innerShieldRadius - 3;
    this.shieldSegments = new Array(12).fill(20);
    this.innerShieldSegments = new Array(16).fill(20);
    this.innerShieldRotation = 0;
    this.baseGunboatRange = 1000;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = 2;
    this.despawnImmune = true;
    this.visualAngleOffset = Math.PI;

    this.disableAutoFire = true;
    this.phaseName = "INTRO";
    this.phaseTimer = 60;
    this.phaseIndex = 0;
    this.phaseTick = 0;

    // Psionic abilities
    this.echoes = [];
    this.mindShacklesActive = false;
    this.mentalBladeCount = 0;
    this.realityTearTriggered = false;

    this.phaseSeq = [
      { name: "PSYCHIC_BARRAGE", duration: 160 },
      { name: "MIND_SHACKLES", duration: 180 },
      { name: "ECHO_SWARM", duration: 160 },
      { name: "MENTAL_BLADE", duration: 140 },
      { name: "REALITY_TEAR", duration: 200 }
    ];

    const angle = Math.random() * Math.PI * 2;
    const dist = 2800;
    this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
    this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    this.turnSpeed = (Math.PI * 2) / (15 * SIM_FPS);
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

    // Reality Tear at 30% HP (one-time trigger)
    if (!this.realityTearTriggered && this.hp / this.maxHp <= 0.3) {
      this.realityTearTriggered = true;
      // Force phase switch to REALITY_TEAR on next cycle
      this.phaseIndex = this.phaseSeq.length - 1;
      showOverlayMessage("REALITY TEAR IMMINENT!", "#f00", 2000);
    }

    // Phase progression
    if (this.phaseTimer <= 0) {
      const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
      this.phaseIndex++;
      this.phaseName = next.name;
      this.phaseTimer = next.duration;
      this.phaseTick = 0;
      showOverlayMessage(`CEREBRAL PSION: ${this.phaseName}`, "#f0f", 900);
    }

    // Movement style per phase - Cruiser-based
    const charging = false;
    if (charging) {
      this.circleStrafePreferred = false;
      this.aiState = "SEEK";
      this.thrustPower = 0.8;
      this.maxSpeed = 10.5;
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

    this.innerShieldRotation -= 0.06 * dtFactor;
    super.update(deltaTime);

    // Phase attacks
    if (typeof this.phaseTickAccum === "undefined") this.phaseTickAccum = 0;
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

    const aim = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );

    if (this.phaseName === "PSYCHIC_BARRAGE") {
      if (this.phaseTick % 60 === 0) {
        // Homing missiles
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
      if (this.phaseTick % 30 === 0) {
        // Psychic shockwave
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#f0f");
        // Push player away
        if (GameContext.player && !GameContext.player.dead) {
          const dx = GameContext.player.pos.x - this.pos.x;
          const dy = GameContext.player.pos.y - this.pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 800 && dist > 0) {
            const pushForce = 12;
            GameContext.player.vel.x += (dx / dist) * pushForce;
            GameContext.player.vel.y += (dy / dist) * pushForce;
          }
        }
        playSound("shockwave");
      }
      if (this.phaseTick % 20 === 0) {
        // Particle burst
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#a0f");
      }
    } else if (this.phaseName === "MIND_SHACKLES") {
      this.mindShacklesActive = true;
      // Tractor beam pulls player in every 5 ticks
      if (this.phaseTick % 5 === 0 && GameContext.player && !GameContext.player.dead) {
        const dx = this.pos.x - GameContext.player.pos.x;
        const dy = this.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1200 && dist > 0) {
          // Gentle but persistent pull
          GameContext.player.vel.x += (dx / dist) * 0.8;
          GameContext.player.vel.y += (dy / dist) * 0.8;
        }
      }
      // Fire homing missile to discourage running away
      if (this.phaseTick % 40 === 0) {
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
      if (_spawnParticles) {
        _spawnParticles(
          this.pos.x + (Math.random() - 0.5) * 200,
          this.pos.y + (Math.random() - 0.5) * 200,
          2,
          "#a0f"
        );
      }
    } else if (this.phaseName === "ECHO_SWARM") {
      // Spawn 3 echoes at start of phase
      if (this.phaseTick === 0) {
        this.spawnEchoes(3);
        showOverlayMessage("ECHO SWARM ACTIVATED", "#f0f", 1500);
      }
      // Echoes fire curtain pattern every 15 ticks
      if (this.phaseTick % 15 === 0) {
        for (let i = -2; i <= 2; i++) {
          const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.2, 15, {
            owner: "enemy",
            damage: 1,
            radius: 3,
            color: "#f0f"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("rapid_shoot");
      }
      // Boss also fires homing missiles
      if (this.phaseTick % 40 === 0) {
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        playSound("heavy_shoot");
      }
    } else if (this.phaseName === "MENTAL_BLADE") {
      this.mindShacklesActive = false;
      // Fire psychic daggers that penetrate shields
      if (this.phaseTick % 12 === 0) {
        const numBlades = 3;
        for (let i = 0; i < numBlades; i++) {
          const spread = -0.3 + (i / (numBlades - 1)) * 0.6;
          const b = new Bullet(this.pos.x, this.pos.y, aim + spread, 14, {
            owner: "enemy",
            damage: 3,
            radius: 6,
            color: "#f0f",
            ignoreShields: true
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("laser");
      }
      // Wide cone attack
      if (this.phaseTick % 50 === 0) {
        for (let i = -6; i <= 6; i++) {
          const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.15, 16, {
            owner: "enemy",
            damage: 1,
            radius: 3,
            color: "#ff0"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shotgun");
      }
    } else if (this.phaseName === "REALITY_TEAR") {
      this.mindShacklesActive = false;
      // Triggered once at 30% HP - final desperate assault
      if (!this.realityTearTriggered) {
        this.realityTearTriggered = true;
        showOverlayMessage("REALITY TEAR! FINAL PHASE!", "#f00", 2000);
      }
      // Rapid fire
      if (this.phaseTick % 8 === 0) {
        const b = new Bullet(this.pos.x, this.pos.y, aim, 18, {
          owner: "enemy",
          damage: 1,
          radius: 3,
          color: "#f0f"
        });
        b.owner = this;
        GameContext.bullets.push(b);
        playSound("rapid_shoot");
      }
      // Spawn echoes randomly
      if (this.phaseTick % 20 === 0) {
        this.spawnEchoes(1);
      }
      // Homing missiles + shockwaves
      if (this.phaseTick % 40 === 0) {
        GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
        // Psychic shockwave
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#f0f");
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
        playSound("heavy_shoot");
      }
    }
  }

  spawnEchoes(count) {
    for (let i = 0; i < count; i++) {
      const angle = ((Math.PI * 2) / count) * i;
      const echo = new PsychicEcho(this, angle);
      this.echoes.push(echo);
    }
  }

  updateEchoes() {
    this.echoes = this.echoes.filter(e => e && !e.dead);
  }

  draw(ctx) {
    super.draw(ctx);

    // Draw mind shackle tether
    if (this.mindShacklesActive && GameContext.player && !GameContext.player.dead) {
      const rPos = this.getRenderPos && this.getRenderPos(1);
      const playerPos = GameContext.player.getRenderPos && GameContext.player.getRenderPos(1);

      if (rPos && playerPos) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rPos.x, rPos.y);
        ctx.lineTo(playerPos.x, playerPos.y);
        ctx.stroke();

        // Pulsing energy effect
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(168, 0, 255, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rPos.x, rPos.y);
        ctx.lineTo(playerPos.x, playerPos.y);
        ctx.stroke();
        ctx.restore();
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

    // Clean up echoes
    this.echoes.forEach(e => {
      if (e && !e.dead) e.kill();
    });
    this.echoes = [];

    pixiCleanupObject(this);
    if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 3.5, 26);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 120, "#f0f");
    playSound("base_explode");
    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 22);
    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 24);

    // Award coins directly: 16 coins * 10 value = 160 total
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
    if (GameContext.cerebralPsion === this) GameContext.cerebralPsion = null;
    if (GameContext.boss === this) GameContext.boss = null;

    showOverlayMessage("CEREBRAL PSION DESTROYED", "#f0f", 3000);
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
    ctx.strokeStyle = "#f0f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
    ctx.fillStyle = "#f0f";
    ctx.fillRect(x, y, barW * pct, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const phaseText = this.phaseName || "ACTIVE";
    ctx.fillText(`CEREBRAL PSION  (PHASE: ${phaseText})`, w / 2, y + 12);
    ctx.restore();
  }
}
