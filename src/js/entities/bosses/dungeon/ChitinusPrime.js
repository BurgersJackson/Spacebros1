import { Enemy } from "../../enemies/Enemy.js";
import { GameContext } from "../../../core/game-context.js";
import { SIM_FPS, SIM_STEP_MS } from "../../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../../audio/audio-manager.js";
import { Bullet } from "../../projectiles/Bullet.js";
import { ClusterBomb } from "../../projectiles/ClusterBomb.js";
import { CruiserMineBomb } from "../../projectiles/CruiserMineBomb.js";
import { HealthPowerUp } from "../../pickups/HealthPowerUp.js";
import { showOverlayMessage } from "../../../utils/ui-helpers.js";
import { pixiCleanupObject } from "../../../rendering/pixi-context.js";

let _spawnBossExplosion = null;
let _spawnLargeExplosion = null;
let _spawnParticles = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerChitinusPrimeDependencies(deps) {
  if (deps.spawnBossExplosion) _spawnBossExplosion = deps.spawnBossExplosion;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class ChitinusPrime extends Enemy {
  constructor(encounterIndex = 1) {
    super("gunboat", null, null, { gunboatLevel: 2 });
    const boost = Math.max(0, encounterIndex - 1);
    const hpScale = 1 + boost * 0.35;

    this.type = "chitinusPrime";
    this.isDungeonBoss = true;
    this.isGunboat = true;
    this.gunboatLevel = 2;
    this.dungeonAsset = "dungeon8.png";

    this.cruiserHullScale = 7.5;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);

    const baseHp = 7000;
    this.hp = Math.round(baseHp * hpScale);
    this.maxHp = this.hp;

    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
    // Player collides with outer shield, bullets with inner shield - 3px
    this.hullCollisionRadius = this.innerShieldRadius - 3;
    // Chitin armor - segmented with more coverage
    this.shieldSegments = new Array(20).fill(20);
    this.innerShieldSegments = new Array(24).fill(20);
    this.innerShieldRotation = 0;
    this.baseGunboatRange = 850;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = 3;
    this.despawnImmune = true;
    this.visualAngleOffset = Math.PI;

    this.disableAutoFire = true;
    this.phaseName = "INTRO";
    this.phaseTimer = 60;
    this.phaseIndex = 0;
    this.phaseTick = 0;

    // Chitin abilities
    this.inRampageMode = false;
    this.absorbedDamage = 0;
    this.absorptionPhase = false;
    this.revengeBurstTriggered = false;

    this.phaseSeq = [
      { name: "ARMED_ASSAULT", duration: 180 },
      { name: "BOMBARDMENT", duration: 140 },
      { name: "ABSORPTION", duration: 160 },
      { name: "RAMPAGE", duration: 200 }
    ];

    const angle = Math.random() * Math.PI * 2;
    const dist = 2800;
    this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
    this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    this.turnSpeed = (Math.PI * 2) / (27.5 * SIM_FPS);
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

    // Phase progression
    if (this.phaseTimer <= 0) {
      const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
      this.phaseIndex++;
      this.phaseName = next.name;
      this.phaseTimer = next.duration;
      this.phaseTick = 0;

      if (this.phaseName === "ABSORPTION") {
        this.absorptionPhase = true;
        this.absorbedDamage = 0;
        showOverlayMessage("ABSORBING DAMAGE!", "#ff0", 1200);
      } else if (this.absorptionPhase) {
        this.absorptionPhase = false;
        // Release revenge burst
        this.releaseRevengeBurst();
      }

      showOverlayMessage(`CHITINUS PRIME: ${this.phaseName}`, "#ff0", 900);
    }

    // Movement style per phase - Cruiser-based
    const charging = this.phaseName === "RAMPAGE";
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

    this.innerShieldRotation -= 0.04 * dtFactor;
    super.update(deltaTime);

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

    if (this.phaseName === "ARMED_ASSAULT") {
      if (this.phaseTick % 12 === 0) {
        // Triple fire
        for (let i = -1; i <= 1; i++) {
          const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.12, 19, {
            owner: "enemy",
            damage: 2,
            radius: 4,
            color: "#ff0"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("shoot");
      }
      if (this.phaseTick % 50 === 0) {
        // Sweep laser
        for (let i = 0; i < 8; i++) {
          const a = aim - 0.5 + (i / 7) * 1.0;
          const b = new Bullet(this.pos.x, this.pos.y, a, 22, {
            owner: "enemy",
            damage: 1,
            radius: 3,
            color: "#fc0"
          });
          b.owner = this;
          GameContext.bullets.push(b);
        }
        playSound("rapid_shoot");
      }
    } else if (this.phaseName === "BOMBARDMENT") {
      if (this.phaseTick % 45 === 0) {
        // Cluster bombs
        for (let i = 0; i < 5; i++) {
          const a = aim - 0.6 + (i / 4) * 1.2;
          const bomb = new ClusterBomb(this.pos.x, this.pos.y, a, this);
          bomb.damage = 2;
          GameContext.bullets.push(bomb);
        }
        playSound("heavy_shoot");
      }
      if (this.phaseTick % 60 === 0) {
        // Minefield
        for (let i = 0; i < 6; i++) {
          const a = ((Math.PI * 2) / 6) * i;
          GameContext.bossBombs.push(new CruiserMineBomb(this, a, 650, 2, this.radius * 1.4));
        }
        playSound("heavy_shoot");
      }
    } else if (this.phaseName === "ABSORPTION") {
      // Store damage during this phase
      // Damage absorption handled in takeHit override
      if (this.phaseTick % 30 === 0) {
        // Wide chitin arc
        for (let i = 0; i < 20; i++) {
          const a = aim - 1.0 + (i / 19) * 2.0;
          const b = new Bullet(this.pos.x, this.pos.y, a, 9, {
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
    } else if (this.phaseName === "RAMPAGE") {
      if (this.phaseTick % 8 === 0) {
        // Rapid fire all weapons
        const b = new Bullet(this.pos.x, this.pos.y, aim + (Math.random() - 0.5) * 0.2, 14, {
          owner: "enemy",
          damage: 2,
          radius: 3,
          color: "#f80"
        });
        b.owner = this;
        GameContext.bullets.push(b);
        playSound("rapid_shoot");
      }
      if (this.phaseTick % 60 === 0) {
        // Dash attack
        const dashDir = { x: Math.cos(aim), y: Math.sin(aim) };
        this.vel.x += dashDir.x * 3;
        this.vel.y += dashDir.y * 3;
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#f80");
      }
      if (this.revengeBurstTriggered && this.phaseTick % 80 === 0) {
        // Extra revenge bursts during rampage
        this.releaseRevengeBurst();
      }
    }
  }

  takeDamage(amount, source) {
    if (this.dead) return;

    // Chitin armor reduces damage by 25%
    const reducedDamage = amount * 0.75;
    let remaining = Math.ceil(reducedDamage);

    // Check outer shield segments
    if (this.shieldSegments && this.shieldSegments.length > 0) {
      for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.shieldSegments[i]);
        this.shieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    // Check inner shield segments
    if (this.innerShieldSegments && this.innerShieldSegments.length > 0 && remaining > 0) {
      for (let i = 0; i < this.innerShieldSegments.length && remaining > 0; i++) {
        const absorb = Math.min(remaining, this.innerShieldSegments[i]);
        this.innerShieldSegments[i] -= absorb;
        remaining -= absorb;
      }
    }

    // Apply remaining damage to HP
    if (remaining > 0) {
      if (this.absorptionPhase) {
        // Store 50% of damage for revenge burst, take 50% damage
        this.absorbedDamage += remaining * 0.5;
        this.hp -= remaining * 0.5;
      } else {
        // Normal phase: take full remaining damage
        this.hp -= remaining;
      }
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 5, "#ff0");
    }

    if (this.hp <= 0) {
      this.kill();
    }
  }

  releaseRevengeBurst() {
    if (this.absorbedDamage <= 0) return;

    const damagePerProjectile = Math.max(1, Math.round(this.absorbedDamage / 24));
    showOverlayMessage("REVENGE BURST!", "#f00", 1200);

    for (let i = 0; i < 24; i++) {
      const a = ((Math.PI * 2) / 24) * i;
      const b = new Bullet(this.pos.x, this.pos.y, a, 10, {
        owner: "enemy",
        damage: damagePerProjectile,
        radius: 4,
        color: "#f00"
      });
      b.owner = this;
      b.life = 120;
      GameContext.bullets.push(b);
    }
    playSound("shotgun");
    this.absorbedDamage = 0;
    this.revengeBurstTriggered = true;
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

    pixiCleanupObject(this);
    if (_spawnBossExplosion) _spawnBossExplosion(this.pos.x, this.pos.y, 4.5, 26);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 4.5);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 150, "#ff0");
    playSound("base_explode");
    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 25);
    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 27);

    // Award coins directly: 20 coins * 10 value = 200 total
    if (_awardCoinsInstant) _awardCoinsInstant(200, { noSound: false, sound: "coin" });
    // Award nuggets directly: 8 nuggets
    let nuggetCount = 8;
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
    if (GameContext.chitinusPrime === this) GameContext.chitinusPrime = null;
    if (GameContext.boss === this) GameContext.boss = null;

    showOverlayMessage("CHITINUS PRIME DESTROYED", "#ff0", 3000);
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
    ctx.strokeStyle = "#ff0";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
    ctx.fillStyle = "#ff0";
    ctx.fillRect(x, y, barW * pct, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const phaseText = this.phaseName || "ACTIVE";
    ctx.fillText(`CHITINUS PRIME  (PHASE: ${phaseText})`, w / 2, y + 12);
    ctx.restore();
  }
}
