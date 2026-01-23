import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { playSound } from "../../audio/audio-manager.js";
import { Enemy } from "../enemies/Enemy.js";
import { EnvironmentAsteroid } from "../environment/EnvironmentAsteroid.js";
import { WarpSentinelBoss } from "../bosses/WarpSentinelBoss.js";
import { FinalBoss } from "../bosses/FinalBoss.js";
import { pixiCleanupObject } from "../../utils/cleanup-utils.js";

let _clearArrayWithPixiCleanup = null;
let _filterArrayWithPixiCleanup = null;

export function registerWarpMazeZoneDependencies(deps) {
  if (deps.clearArrayWithPixiCleanup) _clearArrayWithPixiCleanup = deps.clearArrayWithPixiCleanup;
  if (deps.filterArrayWithPixiCleanup)
    _filterArrayWithPixiCleanup = deps.filterArrayWithPixiCleanup;
}

export class WarpMazeZone extends Entity {
  constructor(x, y) {
    super(x, y);
    this.active = true;
    this.state = "maze"; // 'maze' | 'boss' | 'escape'
    this.exitUnlocked = false;
    this.generated = false;
    this.t = 0;
    this.mobWaveBand = null;
    this.mobSpawnCooldown = 0;
    this.mobCap = 10;

    this.boundaryRadius = 6200;
    this.entryAngle = Math.random() * Math.PI * 2;
    this.exitAngle = this.entryAngle + Math.PI;
    this.arenaRadius = 4000;
    this.bossIntroAt = null;
    this.bossIntroLastSec = null;

    // Warp space is open - no maze rings, just the outer boundary.
    this.rings = [];

    this.segments = []; // fixed walls
    this.dynamicSegments = []; // doors/locks
    this.turrets = [];

    this.entrancePos = {
      x: this.pos.x + Math.cos(this.entryAngle) * (this.boundaryRadius - 420),
      y: this.pos.y + Math.sin(this.entryAngle) * (this.boundaryRadius - 420)
    };

    // Put the exit gate on the opposite side so you can't immediately re-trigger it.
    this.exitPos = {
      x: this.pos.x + Math.cos(this.exitAngle) * (this.boundaryRadius - 420),
      y: this.pos.y + Math.sin(this.exitAngle) * (this.boundaryRadius - 420)
    };
  }

  buildRing(r, gaps, width, step = 0.06) {
    const segs = [];
    for (let ang = 0; ang < Math.PI * 2; ang += step) {
      const a0 = ang;
      const a1 = Math.min(Math.PI * 2, ang + step);
      let inGap = false;
      for (const g of gaps) {
        let d = a0 - g;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < width) {
          inGap = true;
          break;
        }
      }
      if (inGap) continue;
      const x0 = this.pos.x + Math.cos(a0) * r;
      const y0 = this.pos.y + Math.sin(a0) * r;
      const x1 = this.pos.x + Math.cos(a1) * r;
      const y1 = this.pos.y + Math.sin(a1) * r;
      segs.push({ x0, y0, x1, y1 });
    }
    return segs;
  }

  generate() {
    if (this.generated) return;
    this.generated = true;
    this.segments = [];
    this.dynamicSegments = [];

    // No maze walls or turrets in the warp arena.
    this.turrets = [];

    // Seed some roamers so the zone isn't empty.
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = this.arenaRadius + 1200 + Math.random() * 1400;
      const x = this.pos.x + Math.cos(a) * rr;
      const y = this.pos.y + Math.sin(a) * rr;
      const e = new Enemy("roamer", { x, y });
      e.despawnImmune = true;
      GameContext.enemies.push(e);
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    if (!this.active) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    if (!this.generated) this.generate();

    // Remove dead turrets from array
    if (this.turrets && this.turrets.length > 0) {
      for (let i = this.turrets.length - 1; i >= 0; i--) {
        const turret = this.turrets[i];
        if (!turret || turret.dead) {
          if (turret) {
            if (typeof turret.kill === "function") {
              try {
                turret.kill();
              } catch (e) {}
            }
            try {
              pixiCleanupObject(turret);
            } catch (e) {}
          }
          this.turrets.splice(i, 1);
        }
      }
    }

    // Spawn roamers in waves as the player moves inward.
    if (this.mobSpawnCooldown > 0) this.mobSpawnCooldown -= dtFactor;
    if (this.state === "maze" && GameContext.player && !GameContext.player.dead) {
      const dist = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      const band =
        dist > this.arenaRadius + 2600
          ? 0
          : dist > this.arenaRadius + 1400
            ? 1
            : dist > this.arenaRadius + 400
              ? 2
              : dist > this.arenaRadius
                ? 3
                : 4;

      if (this.mobWaveBand === null) this.mobWaveBand = band;
      const movedInward = band > this.mobWaveBand;
      this.mobWaveBand = band;

      const living = GameContext.enemies.filter(
        e =>
          e &&
          !e.dead &&
          (e.type === "roamer" ||
            e.type === "elite_roamer" ||
            e.type === "hunter" ||
            e.type === "defender")
      ).length;
      const wantCap = this.mobCap;
      if ((movedInward || this.mobSpawnCooldown === 0) && living < wantCap) {
        const spawnCount = movedInward ? 4 : 2;
        for (let i = 0; i < spawnCount && GameContext.enemies.length < 300; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.max(this.arenaRadius + 220, dist + 900 + Math.random() * 700);
          const x = this.pos.x + Math.cos(a) * rr;
          const y = this.pos.y + Math.sin(a) * rr;
          const distP = Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y);
          if (distP < 650) continue;
          const typeRoll = Math.random();
          const type = band >= 2 && typeRoll < 0.12 ? "elite_roamer" : "roamer";
          const e = new Enemy(type, { x, y });
          e.despawnImmune = true;
          GameContext.enemies.push(e);
        }
        this.mobSpawnCooldown = movedInward ? 120 : 180;
      }
    }

    // Start boss when player reaches the core (inside the arena ring).
    if (this.state === "maze" && GameContext.player && !GameContext.player.dead) {
      const dist = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (dist < this.arenaRadius - 300) {
        // Determine if this is the final battle based on game time
        const gameDuration =
          Date.now() - GameContext.gameStartTime - (GameContext.pausedAccumMs || 0);
        const isFinalRun = gameDuration > 30 * 60 * 1000; // 30 minutes

        if (isFinalRun) {
          this.state = "final_boss_intro";
          showOverlayMessage("FINAL BATTLE INITIATED", "#f00", 3000);
        } else {
          this.state = "boss_intro";
        }
        // Only set bossIntroAt if not already set (prevents race condition with enterWarpMaze)
        if (this.bossIntroAt === null || this.bossIntroAt < Date.now()) {
          this.bossIntroAt = Date.now() + 10000;
        }
        this.bossIntroLastSec = null;
      }
    }

    if (this.state === "boss_intro") {
      const now = Date.now();
      const remainingMs = (this.bossIntroAt || now) - now;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));
      if (this.bossIntroLastSec !== remainingSecs) {
        const el = document.getElementById("arena-countdown");
        if (el) {
          el.innerText = `SOMETHING IS COMING\n${remainingSecs}s`;
          el.style.display = "block";
          el.style.color = "#f0f";
          el.style.textShadow = "0 0 24px #f0f, 0 0 48px #f0f";
          el.style.fontSize = remainingSecs <= 3 ? "44px" : "36px";
        }
        this.bossIntroLastSec = remainingSecs;
      }
      if (remainingMs <= 0) {
        const el = document.getElementById("arena-countdown");
        if (el) el.style.display = "none";
        this.state = "boss";
        // Keep the boss arena readable by clearing asteroids near the core.
        if (_filterArrayWithPixiCleanup) {
          _filterArrayWithPixiCleanup(
            GameContext.environmentAsteroids,
            a =>
              !a.dead &&
              Math.hypot(a.pos.x - this.pos.x, a.pos.y - this.pos.y) > this.arenaRadius + 260
          );
        }
        showOverlayMessage("WARP SENTINEL ENGAGED", "#f0f", 2200, 3);
        playSound("boss_spawn");
        if (_clearArrayWithPixiCleanup) {
          _clearArrayWithPixiCleanup(GameContext.enemies); // keep the fight clean
          _clearArrayWithPixiCleanup(GameContext.pinwheels);
          _clearArrayWithPixiCleanup(GameContext.bossBombs);
        }
        if (_filterArrayWithPixiCleanup) {
          _filterArrayWithPixiCleanup(GameContext.bullets, b => !b.isEnemy);
        }
        GameContext.boss = new WarpSentinelBoss(this.pos.x, this.pos.y, this);
        GameContext.bossActive = true;

        // Spawn cover asteroids in the arena
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = 800 + Math.random() * (this.arenaRadius - 1200);
          const x = this.pos.x + Math.cos(a) * rr;
          const y = this.pos.y + Math.sin(a) * rr;
          if (
            GameContext.player &&
            Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y) < 500
          )
            continue;
          GameContext.environmentAsteroids.push(
            new EnvironmentAsteroid(x, y, 40 + Math.random() * 50, 3, false)
          );
        }
      }
    }

    if (this.state === "final_boss_intro") {
      const now = Date.now();
      const remainingMs = (this.bossIntroAt || now) - now;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));
      if (this.bossIntroLastSec !== remainingSecs) {
        const el = document.getElementById("arena-countdown");
        if (el) {
          el.innerText = `FINAL BATTLE\n${remainingSecs}s`;
          el.style.display = "block";
          el.style.color = "#f00";
          el.style.textShadow = "0 0 24px #f00, 0 0 48px #f00";
          el.style.fontSize = remainingSecs <= 3 ? "50px" : "40px";
        }
        this.bossIntroLastSec = remainingSecs;
      }
      if (remainingMs <= 0) {
        const el = document.getElementById("arena-countdown");
        if (el) el.style.display = "none";
        this.state = "final_boss";

        // Keep the boss arena readable by clearing asteroids near the core.
        if (_filterArrayWithPixiCleanup) {
          _filterArrayWithPixiCleanup(
            GameContext.environmentAsteroids,
            a =>
              !a.dead &&
              Math.hypot(a.pos.x - this.pos.x, a.pos.y - this.pos.y) > this.arenaRadius + 260
          );
        }

        showOverlayMessage("FINAL BOSS ENGAGED", "#f00", 3000, 3);
        playSound("boss_spawn");
        if (_clearArrayWithPixiCleanup) {
          _clearArrayWithPixiCleanup(GameContext.enemies); // keep the fight clean
          _clearArrayWithPixiCleanup(GameContext.pinwheels);
          _clearArrayWithPixiCleanup(GameContext.bossBombs);
        }
        if (_filterArrayWithPixiCleanup) {
          _filterArrayWithPixiCleanup(GameContext.bullets, b => !b.isEnemy);
        }

        GameContext.boss = new FinalBoss(this.pos.x, this.pos.y, this);
        GameContext.bossActive = true;

        // Spawn cover asteroids in the arena
        for (let i = 0; i < 15; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = 800 + Math.random() * (this.arenaRadius - 1200);
          const x = this.pos.x + Math.cos(a) * rr;
          const y = this.pos.y + Math.sin(a) * rr;
          if (
            GameContext.player &&
            Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y) < 500
          )
            continue;
          GameContext.environmentAsteroids.push(
            new EnvironmentAsteroid(x, y, 40 + Math.random() * 50, 3, false)
          );
        }
      }
    }

    if (
      (this.state === "boss" || this.state === "final_boss") &&
      (!GameContext.bossActive || !GameContext.boss || GameContext.boss.dead)
    ) {
      this.state = "escape";
    }
  }

  allSegments() {
    return [];
  }

  applyWallCollisions(entity) {
    if (!this.active || !entity || entity.dead) return;
    return;
  }

  bulletHitsWall(bullet) {
    return false;
  }

  draw(ctx) {
    return;
  }

  /**
   * Clean up all entities and resources in the warp zone
   */
  cleanup() {
    this.active = false;

    // Clean up turrets array
    if (this.turrets && this.turrets.length > 0) {
      for (let i = 0; i < this.turrets.length; i++) {
        const turret = this.turrets[i];
        if (turret) {
          turret.dead = true;
          if (typeof turret.kill === "function") {
            try {
              turret.kill();
            } catch (e) {}
          }
          try {
            pixiCleanupObject(turret);
          } catch (e) {}
        }
      }
      this.turrets.length = 0;
    }

    // Clear other arrays
    this.rings = [];
    this.segments = [];
    this.dynamicSegments = [];
  }
}
