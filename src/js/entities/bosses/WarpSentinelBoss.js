import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, ZOOM_LEVEL } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { Bullet } from "../projectiles/Bullet.js";
import { Shockwave } from "../projectiles/Shockwave.js";
import { Enemy } from "../enemies/Enemy.js";
import { CaveGunboat1 } from "../cave/CaveGunboat1.js";
import { CaveGunboat2 } from "../cave/CaveGunboat2.js";
import { WarpBioPod } from "../zones/WarpBioPod.js";
import { WarpShieldDrone } from "./WarpShieldDrone.js";
import { Particle } from "../particles/Particle.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import {
  pixiBossLayer,
  pixiVectorLayer,
  pixiTextures,
  pixiCleanupObject,
  clearArrayWithPixiCleanup,
  getRenderAlpha
} from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _spawnLargeExplosion = null;
let _spawnFieryExplosion = null;
let _scheduleParticleBursts = null;
let _scheduleStaggeredBombExplosions = null;
let _applyAOEDamageToPlayer = null;
let _updateHealthUI = null;
let _killPlayer = null;
let _canvas = null;

/**
 * Spawns larger particles (3x size) but fewer (1/3 count) for warp boss effects
 */
function _spawnLargeParticles(x, y, count = 10, color = '#fff') {
  // Spawn 1/3 as many particles (round to nearest int, minimum 1)
  const actualCount = Math.max(1, Math.round(count / 3));
  // Create particles manually with 3x size
  for (let i = 0; i < actualCount; i++) {
    const p = new Particle(x, y, null, null, color);
    p.size = 6; // 3x normal size (2 * 3 = 6)
    GameContext.particles.push(p);
  }
}

export function registerWarpSentinelBossDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
  if (deps.scheduleParticleBursts) _scheduleParticleBursts = deps.scheduleParticleBursts;
  if (deps.scheduleStaggeredBombExplosions)
    _scheduleStaggeredBombExplosions = deps.scheduleStaggeredBombExplosions;
  if (deps.applyAOEDamageToPlayer) _applyAOEDamageToPlayer = deps.applyAOEDamageToPlayer;
  if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
  if (deps.killPlayer) _killPlayer = deps.killPlayer;
  if (deps.canvas) _canvas = deps.canvas;
}

export class WarpSentinelBoss extends Entity {
  constructor(x, y, zone) {
    super(x, y);
    this.zone = zone || null;
    this.isWarpBoss = true;
    this.sizeScale = 3;
    this.radius = 110 * this.sizeScale;
    this.hp = 5000;
    this.maxHp = this.hp;

    this.maxShieldHp = 9990;
    this.shieldStrength = this.maxShieldHp;
    this.shieldSegments = new Array(72).fill(9990);
    this.shieldRadius = 950;
    this.shieldRotation = 0; // Stationary shield (doesn't rotate)
    this.lastShieldRegenAt = Date.now();
    this.shieldRegenMs = 500;

    this.t = 0;
    this.phase = 1;
    this.coreRot = 0;

    this.orbitOffset = Math.random() * Math.PI * 2;
    this.orbitCenter = { x: this.pos.x, y: this.pos.y };
    this.maxSpeed = 5.5;
    this.dashCooldown = 240;
    this.dashWarmup = 0;
    this.dashFrames = 0;
    this.baseDashFrames = 60; // Base charge duration
    this.dashDir = { x: 0, y: 0 };
    this.dashSpeed = 11.25;

    this.flameCooldown = 140;
    this.flameCharge = 0;
    this.flameChargeTotal = 50;
    this.flameFire = 0;
    this.flameFireTotal = 120;
    this.flameAngle = 0;
    this.flameRange = 1190;
    this.flameCone = Math.PI / 3;
    this.flameTickCooldown = 0;
    this.flameHitCount = 0;

    this.chitinCooldown = 120;
    this.screamCooldown = 260;
    this.podCooldown = 240;
    this.reinforcementCooldown = 300;
    this.reinforcementTimer = 300;

    this.helperMax = 10;
    this.helperCall70 = 2;
    this.helperCall40 = 3;
    this.helperBurst = 2;
    this.helperCooldownBase = 210;
    this.helperCooldown = 90;
    this.called70 = false;
    this.called50 = false;
    this.called40 = false;
    this.phase2Started = false;
    this.phase3Started = false;
    this.helperStrengthTier = 1;

    this._cachedAliveHelpers = 0;
    this.shieldsDirty = true;
    this.ramInvulnerable = 0;
    this.collisionHull = [
      // Main body - central core
      { x: 0, y: 0, r: 120 * this.sizeScale },
      // Head section (front, facing player)
      { x: 100 * this.sizeScale, y: 0, r: 115 * this.sizeScale },
      // Tail section (back)
      { x: -100 * this.sizeScale, y: 0, r: 115 * this.sizeScale },
      // Upper wings
      { x: 20 * this.sizeScale, y: -80 * this.sizeScale, r: 70 * this.sizeScale },
      { x: -20 * this.sizeScale, y: -80 * this.sizeScale, r: 70 * this.sizeScale },
      // Lower wings
      { x: 20 * this.sizeScale, y: 80 * this.sizeScale, r: 70 * this.sizeScale },
      { x: -20 * this.sizeScale, y: 80 * this.sizeScale, r: 70 * this.sizeScale }
    ];
    // Broad phase radius for quick rejection (covers all circles)
    this.collisionRadius = 250 * this.sizeScale;
    this._pixiSprite = null;
    this.shieldDrones = [];
    this.shieldDronesAlive = 4;
    this.shieldEverDown = false;
    this._pixiFlameGfx = null;

    this.spawnShieldDrones();
  }

  spawnShieldDrones() {
    if (this.shieldDrones.length > 0) return;

    const corners = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    for (const angle of corners) {
      const drone = new WarpShieldDrone(this, angle);
      GameContext.enemies.push(drone);
      this.shieldDrones.push(drone);
    }
  }

  onShieldDroneDestroyed() {
    this.shieldDronesAlive--;

    const prevPhase = this.phase;
    if (this.shieldDronesAlive <= 2 && this.phase < 2) {
      this.phase = 2;
    }
    if (this.shieldDronesAlive <= 0 && this.phase < 3) {
      this.phase = 3;
      this.shieldEverDown = true;
      this.shieldSegments.fill(0);
      this.shieldsDirty = true;

      // Increase charge distance by 50% when all shield drones are destroyed
      this.baseDashFrames = Math.round(this.baseDashFrames * 1.5);
      showOverlayMessage("SENTINEL SHIELD DOWN! CHARGE RANGE INCREASED!", "#f00", 2500, 3);
    }

    if (this.phase === 2 && prevPhase < 2 && !this.phase2Started) {
      this.phase2Started = true;
      this.helperMax = 10;
      this.helperBurst = 3;
      this.helperCooldownBase = 320;
      this.spawnDefenders(6);
      showOverlayMessage("SENTINEL PHASE 2", "#f0f", 1800, 3);
    }
    if (this.phase === 3 && prevPhase < 3 && !this.phase3Started) {
      this.phase3Started = true;
      showOverlayMessage("SENTINEL PHASE 3", "#f0f", 1800, 3);
    }
  }

  hitTestCircle(x, y, r) {
    if (this.dead) return false;

    // Broad phase: quick rejection check against overall radius
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > (this.collisionRadius + r) * (this.collisionRadius + r)) {
      return false;
    }

    // Narrow phase: check each circle in the collision hull
    // The boss rotates to face the player, so we need to transform the bullet position
    // into local coordinates
    const aim =
      GameContext.player && !GameContext.player.dead
        ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x)
        : 0;
    const cos = Math.cos(-aim);
    const sin = Math.sin(-aim);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    for (const circle of this.collisionHull) {
      const cdx = localX - circle.x;
      const cdy = localY - circle.y;
      if (cdx * cdx + cdy * cdy < (circle.r + r) * (circle.r + r)) {
        return true;
      }
    }
    return false;
  }

  drawBossHud(ctx) {
    const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    const w = 360;
    const h = 16;
    const canvasWidth = _canvas ? _canvas.width : GameContext.width;
    const x = canvasWidth / 2 - w / 2;
    const y = 64;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 6, y - 8, w + 12, h + 18);
    ctx.strokeStyle = "#f0f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 8, w + 12, h + 18);
    ctx.fillStyle = "#300";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#f0f";
    ctx.fillRect(x, y, Math.floor(w * pct), h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`WARP SENTINEL ${Math.max(0, Math.floor(pct * 100))}%`, canvasWidth / 2, y - 2);
    ctx.restore();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;

    if (this._pixiInnerGfx) {
      try {
        this._pixiInnerGfx.visible = false;
        if (typeof this._pixiInnerGfx.clear === "function") this._pixiInnerGfx.clear();
        if (this._pixiInnerGfx.parent) this._pixiInnerGfx.parent.removeChild(this._pixiInnerGfx);
        this._pixiInnerGfx.destroy(true);
      } catch (e) {}
      this._pixiInnerGfx = null;
    }
    if (this._pixiGfx) {
      try {
        this._pixiGfx.visible = false;
        if (typeof this._pixiGfx.clear === "function") this._pixiGfx.clear();
        if (this._pixiGfx.parent) this._pixiGfx.parent.removeChild(this._pixiGfx);
        this._pixiGfx.destroy(true);
      } catch (e) {}
      this._pixiGfx = null;
    }
    if (this._pixiDebugGfx) {
      try {
        this._pixiDebugGfx.visible = false;
        if (typeof this._pixiDebugGfx.clear === "function") this._pixiDebugGfx.clear();
        if (this._pixiDebugGfx.parent) this._pixiDebugGfx.parent.removeChild(this._pixiDebugGfx);
        this._pixiDebugGfx.destroy(true);
      } catch (e) {}
      this._pixiDebugGfx = null;
    }
    if (this._pixiFlameGfx) {
      try {
        this._pixiFlameGfx.visible = false;
        if (typeof this._pixiFlameGfx.clear === "function") this._pixiFlameGfx.clear();
        if (this._pixiFlameGfx.parent) this._pixiFlameGfx.parent.removeChild(this._pixiFlameGfx);
        this._pixiFlameGfx.destroy(true);
      } catch (e) {}
      this._pixiFlameGfx = null;
    }
    if (this._pixiContainer) {
      try {
        this._pixiContainer.visible = false;
        if (this._pixiContainer.parent) this._pixiContainer.parent.removeChild(this._pixiContainer);
        this._pixiContainer.destroy({ children: true });
      } catch (e) {}
      this._pixiContainer = null;
      this._pixiSprite = null;
    }

    pixiCleanupObject(this);

    const killStartTime = performance.now();

    if (_scheduleParticleBursts) _scheduleParticleBursts(this.pos.x, this.pos.y, 140, "#f0f", 20);
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 4.5);
    if (_scheduleStaggeredBombExplosions) _scheduleStaggeredBombExplosions(this.pos.x, this.pos.y);

    GameContext.sectorTransitionActive = true;
    GameContext.warpCountdownAt = Date.now() + 15000;
    showOverlayMessage("SENTINEL DOWN - LEVEL 2 IN 15s", "#ff0", 2600, 3);
    GameContext.bossActive = false;
    GameContext.bossArena.active = false;
    GameContext.bossArena.growing = false;
    // FIRE BREATH AUDIO - DISABLED
    // playSound("warp_flame_stop");

    for (let i = GameContext.warpBioPods.length - 1; i >= 0; i--) {
      const pod = GameContext.warpBioPods[i];
      if (pod && !pod.dead) {
        pod.explode();
      }
    }

    clearArrayWithPixiCleanup(GameContext.warpBioPods);
    clearArrayWithPixiCleanup(this.shieldDrones);
    if (GameContext.boss) pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;

    const killDuration = performance.now() - killStartTime;
    if (killDuration > 16.67) {
      console.warn(`[BOSS KILL] Frame time spike detected (${killDuration.toFixed(2)}ms)`);
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    if (!GameContext.player || GameContext.player.dead) return;

    super.update(deltaTime);

    if (this.shieldDrones.length === 0) {
      this.spawnShieldDrones();
    }

    const now = Date.now();
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    this.coreRot += 0.04 * dtFactor;
    if (this.ramInvulnerable > 0) this.ramInvulnerable -= dtFactor;

    const ringMult = 1.0;
    // Shield is stationary - doesn't rotate

    this._cachedAliveHelpers = GameContext.enemies.filter(
      e => e && !e.dead && e.isWarpReinforcement
    ).length;

    if (
      !this.shieldEverDown &&
      this.shieldDronesAlive >= 4 &&
      now - this.lastShieldRegenAt >= this.shieldRegenMs
    ) {
      const idx1 = this.shieldSegments.findIndex(s => s < this.shieldStrength);
      if (idx1 !== -1) {
        this.shieldSegments[idx1] = Math.min(this.shieldStrength, this.shieldSegments[idx1] + 1);
        this.shieldsDirty = true;
      }
      this.lastShieldRegenAt = now;
      if (Math.random() < 0.25 && _spawnParticles)
        _spawnLargeParticles(this.pos.x, this.pos.y, 4, "#0ff");
    }

    if (this.reinforcementTimer > 0) {
      this.reinforcementTimer -= dtFactor;
    } else {
      this.reinforcementTimer = this.reinforcementCooldown;
      this.spawnCaveReinforcements();
    }

    const cx = this.zone ? this.zone.pos.x : this.orbitCenter.x;
    const cy = this.zone ? this.zone.pos.y : this.orbitCenter.y;
    const orbitR = this.phase === 2 ? 560 : 720;
    const orbitSpeed = this.phase === 2 ? 0.01 : 0.0075;
    const orbitAng = this.orbitOffset + this.t * orbitSpeed;
    const targetX = cx + Math.cos(orbitAng) * orbitR;
    const targetY = cy + Math.sin(orbitAng) * orbitR;
    const distToPlayer = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );
    const aimToPlayer = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );

    this.dashCooldown -= dtFactor;
    if (this.dashWarmup > 0) {
      this.dashWarmup -= dtFactor;
      this.vel.mult(Math.pow(0.92, dtFactor));
      if (this.dashWarmup <= 0) {
        this.dashWarmup = 0;
        this.dashFrames = this.baseDashFrames;
      }
    } else if (this.dashFrames > 0) {
      this.dashFrames -= dtFactor;
      const blend = 1 - Math.pow(0.8, dtFactor);
      this.vel.x += (this.dashDir.x * this.dashSpeed - this.vel.x) * blend;
      this.vel.y += (this.dashDir.y * this.dashSpeed - this.vel.y) * blend;

      if (this.dashFrames <= 0) {
        this.dashFrames = 0;
        GameContext.shockwaves.push(
          new Shockwave(this.pos.x, this.pos.y, 2, 650, {
            damagePlayer: true,
            damageEnemies: false,
            color: "#f0f",
            ignoreEntity: this
          })
        );
        playSound("explode");
      }
    } else if (this.dashCooldown <= 0 && distToPlayer > 650 && distToPlayer < 2800) {
      const dx = Math.cos(aimToPlayer);
      const dy = Math.sin(aimToPlayer);
      this.dashDir = { x: dx, y: dy };
      this.dashWarmup = 9;
      this.dashCooldown = this.phase === 2 ? 180 : 240;
      if (_spawnLargeParticles) _spawnLargeParticles(this.pos.x, this.pos.y, 14, "#f0f");
      showOverlayMessage("SENTINEL CHARGING", "#f0f", 700);
    }

    if (this.dashWarmup <= 0 && this.dashFrames <= 0) {
      const dx = targetX - this.pos.x;
      const dy = targetY - this.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const dcx = this.pos.x - cx;
      const dcy = this.pos.y - cy;
      const cd = Math.hypot(dcx, dcy) || 1;
      const tx = (-dcy / cd) * (this.phase === 2 ? 0.75 : 0.55);
      const ty = (dcx / cd) * (this.phase === 2 ? 0.75 : 0.55);
      let desiredX = dx / d + tx;
      let desiredY = dy / d + ty;
      const dd = Math.hypot(desiredX, desiredY) || 1;
      desiredX /= dd;
      desiredY /= dd;

      const desiredVx = desiredX * this.maxSpeed;
      const desiredVy = desiredY * this.maxSpeed;

      const blend = 1 - Math.pow(0.9, dtFactor);
      this.vel.x += (desiredVx - this.vel.x) * blend;
      this.vel.y += (desiredVy - this.vel.y) * blend;

      const sp = Math.hypot(this.vel.x, this.vel.y);
      if (sp > this.maxSpeed) {
        const s = this.maxSpeed / sp;
        this.vel.x *= s;
        this.vel.y *= s;
      }
    }

    // FIRE BREATH ATTACK - DISABLED
    // this.flameCooldown -= dtFactor;
    // this.chitinCooldown -= dtFactor;
    this.chitinCooldown -= dtFactor;
    this.screamCooldown -= dtFactor;
    this.podCooldown -= dtFactor;

    // Fire breath attack logic (commented out)
    /*
    if (this.flameFire > 0) {
      this.flameFire -= dtFactor;
      this.flameTickCooldown -= dtFactor;
      if (this.flameTickCooldown <= 0 && this.flameHitCount < 2) {
        const angleDiff = Math.atan2(
          Math.sin(aimToPlayer - this.flameAngle),
          Math.cos(aimToPlayer - this.flameAngle)
        );
        if (distToPlayer <= this.flameRange && Math.abs(angleDiff) <= this.flameCone * 0.5) {
          GameContext.player.takeHit(5);
          const nx = Math.cos(aimToPlayer);
          const ny = Math.sin(aimToPlayer);
          GameContext.player.vel.x += nx * 6;
          GameContext.player.vel.y += ny * 6;
          this.flameHitCount++;
        }
        this.flameTickCooldown = 12;
      }
      if (this.flameFire <= 0) {
        playSound("warp_flame_stop");
      }
    } else if (this.flameCharge > 0) {
      this.flameCharge -= dtFactor;
      this.flameAngle = aimToPlayer;
      if (this.flameCharge <= 0) {
        this.flameFire = this.flameFireTotal;
        this.flameHitCount = 0;
        this.flameTickCooldown = 0;
        playSound("warp_flame_start");
      }
    } else {
      if (this.flameCooldown <= 0 && distToPlayer < 2200) {
        this.flameCharge = this.flameChargeTotal;
        this.flameCooldown = this.phase === 3 ? 150 : 180;
      }
    }
    */

    if (this.chitinCooldown <= 0 && distToPlayer < 2600) {
      const count = this.phase === 1 ? 16 : this.phase === 2 ? 22 : 28;
      const spread = 1.1;
      // Spawn 1/3 as many bullets (round to nearest int, minimum 1)
      const actualCount = Math.max(1, Math.round(count / 3));
      for (let i = 0; i < actualCount; i++) {
        const t = actualCount === 1 ? 0 : i / (actualCount - 1) - 0.5;
        const a = aimToPlayer + t * spread;
        const bx = this.pos.x + Math.cos(a) * (this.radius + 10);
        const by = this.pos.y + Math.sin(a) * (this.radius + 10);
        const shot = new Bullet(bx, by, a, 12, {
          owner: "enemy",
          damage: 1,
          radius: 12, // 3x larger (4 * 3 = 12)
          color: "#f6f"
        });
        shot.owner = this;
        shot.life = Math.round(shot.life * 1.875);
        GameContext.bullets.push(shot);
      }
      playSound("warp_chitin");
      this.chitinCooldown = this.phase === 3 ? 90 : this.phase === 2 ? 110 : 130;
    }

    if (this.screamCooldown <= 0 && distToPlayer < 2400) {
      GameContext.shockwaves.push(
        new Shockwave(this.pos.x, this.pos.y, 0, 1600, {
          damageAsteroids: true,
          damageEnemies: false,
          color: "#f0f",
          ignoreEntity: this
        })
      );
      if (distToPlayer < 1200) {
        const nx = Math.cos(aimToPlayer);
        const ny = Math.sin(aimToPlayer);
        GameContext.player.vel.x += nx * 12;
        GameContext.player.vel.y += ny * 12;
      }
      playSound("warp_scream");
      this.screamCooldown = this.phase === 3 ? 210 : 260;
    }

    if (this.podCooldown <= 0) {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        GameContext.warpBioPods.push(new WarpBioPod(this.pos.x, this.pos.y, a, this));
      }
      playSound("warp_pod");
      this.podCooldown = this.phase === 3 ? 200 : 260;
    }

    this.maybeCallHelpers();

    const speed = Math.hypot(this.vel.x, this.vel.y);
    const isRamming = this.dashFrames > 0 || speed > 4;
    if (isRamming && distToPlayer < this.radius + GameContext.player.radius + 4) {
      this.ramInvulnerable = Math.max(this.ramInvulnerable, 12);
      if (GameContext.player.invulnerable <= 0) {
        const idx = GameContext.player.shieldSegments
          ? GameContext.player.shieldSegments.findIndex(s => s > 0)
          : -1;
        if (idx !== -1) {
          GameContext.player.shieldSegments[idx] = Math.max(
            0,
            GameContext.player.shieldSegments[idx] - 1
          );
          GameContext.player.shieldsDirty = true;
        } else {
          GameContext.player.hp -= 2;
          if (_spawnLargeParticles)
            _spawnLargeParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, "#f00");
          playSound("hit");
          if (_updateHealthUI) _updateHealthUI();
          if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
        }
      }
    }
  }

  maybeCallHelpers() {
    if (!GameContext.warpZone || !GameContext.warpZone.active) return;
    if (!GameContext.bossActive) return;
    if (!GameContext.player || GameContext.player.dead) return;

    const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const aliveHelpers = this._cachedAliveHelpers;
    const maxHelpers = this.helperMax;

    if (!this.called70 && hpPct <= 0.7) {
      this.called70 = true;
      this.spawnHelpers(this.helperCall70);
    }
    if (!this.called40 && hpPct <= 0.4) {
      this.called40 = true;
      this.spawnHelpers(this.helperCall40);
    }

    this.helperCooldown--;
    if (this.helperCooldown <= 0 && aliveHelpers < maxHelpers) {
      const burst = Math.min(this.helperBurst, maxHelpers - aliveHelpers);
      this.spawnHelpers(burst);
      this.helperCooldown = this.helperCooldownBase;
    }
  }

  spawnHelpers(count) {
    const aliveHelpers = this._cachedAliveHelpers;
    const slots = Math.max(0, this.helperMax - aliveHelpers);
    if (slots <= 0) return;
    count = Math.min(count, slots);

    const phase2 = this.phase >= 2;
    let types;
    if (phase2) {
      types = ["defender", "defender", "hunter", "elite_roamer", "hunter"];
    } else if (this.helperStrengthTier <= 0) {
      types = ["roamer", "roamer", "defender"];
    } else {
      types = ["roamer", "defender", "roamer", "elite_roamer"];
    }

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      for (let attempt = 0; attempt < 25; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const d = 900 + Math.random() * 700;
        const x = this.pos.x + Math.cos(a) * d;
        const y = this.pos.y + Math.sin(a) * d;
        const distP = Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y);
        if (distP < 650) continue;
        const e = new Enemy(type, { x, y }, null);
        e.despawnImmune = true;
        e.isWarpReinforcement = true;
        GameContext.enemies.push(e);
        if (_spawnLargeParticles) _spawnLargeParticles(x, y, 10, "#f0f");
        break;
      }
    }
    showOverlayMessage("SENTINEL SUMMONED REINFORCEMENTS", "#f0f", 1200);
  }

  spawnDefenders(count) {
    const aliveHelpers = this._cachedAliveHelpers;
    const slots = Math.max(0, this.helperMax - aliveHelpers);
    if (slots <= 0) return;
    count = Math.min(count, slots);

    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 25; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const d = 900 + Math.random() * 700;
        const x = this.pos.x + Math.cos(a) * d;
        const y = this.pos.y + Math.sin(a) * d;
        const distP = Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y);
        if (distP < 650) continue;
        const e = new Enemy("defender", { x, y }, null);
        e.despawnImmune = true;
        e.isWarpReinforcement = true;
        GameContext.enemies.push(e);
        if (_spawnLargeParticles) _spawnLargeParticles(x, y, 10, "#f0f");
        break;
      }
    }
    showOverlayMessage("DEFENDERS DEPLOYED", "#f0f", 1200);
  }

  draw(ctx) {
    if (this.dead) {
      if (this._pixiGfx) {
        try {
          this._pixiGfx.visible = false;
          if (this._pixiGfx.parent) this._pixiGfx.parent.removeChild(this._pixiGfx);
        } catch (e) {}
      }
      if (this._pixiDebugGfx) {
        try {
          this._pixiDebugGfx.visible = false;
          if (this._pixiDebugGfx.parent) this._pixiDebugGfx.parent.removeChild(this._pixiDebugGfx);
        } catch (e) {}
      }
      if (this._pixiContainer) {
        try {
          this._pixiContainer.visible = false;
          if (this._pixiContainer.parent)
            this._pixiContainer.parent.removeChild(this._pixiContainer);
        } catch (e) {}
      }
      return;
    }

    const rPos = this.getRenderPos(getRenderAlpha());
    const aim =
      GameContext.player && !GameContext.player.dead
        ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x)
        : 0;
    const z = GameContext.currentZoom || ZOOM_LEVEL;

    if (pixiBossLayer && pixiTextures && pixiTextures.warp_boss) {
      let container = this._pixiContainer;
      if (!container) {
        container = new PIXI.Container();
        this._pixiContainer = container;
        pixiBossLayer.addChild(container);

        const spr = new PIXI.Sprite(pixiTextures.warp_boss);
        spr.anchor.set(0.5);
        container.addChild(spr);
        this._pixiSprite = spr;
      } else if (!container.parent) {
        pixiBossLayer.addChild(container);
      }

      container.visible = true;
      container.position.set(rPos.x, rPos.y);
      container.rotation = aim;

      if (this._pixiSprite) {
        const hullScale = this.sizeScale;
        this._pixiSprite.scale.set(hullScale);
      }

      // FIRE BREATH RENDERING - DISABLED
      /*
      // Update fire breath rendering using PixiJS graphics attached to container
      if ((this.flameCharge > 0 || this.flameFire > 0) && pixiBossLayer) {
        let flameGfx = this._pixiFlameGfx;
        if (!flameGfx) {
          flameGfx = new PIXI.Graphics();
          this._pixiFlameGfx = flameGfx;
          container.addChild(flameGfx);
        }

        flameGfx.clear();
        flameGfx.visible = true;
        // Position flame at the boss's mouth, offset forward 200 pixels
        // Head is at x=100 * sizeScale = 300, plus 200 offset = 500
        flameGfx.position.set(500, 0);
        flameGfx.rotation = this.flameAngle - aim; // Rotate relative to container's aim rotation

        const alpha = this.flameFire > 0 ? 0.35 : 0.2;
        const coneHalf = this.flameCone * 0.5;

        flameGfx.beginFill(0xff7828, alpha);
        flameGfx.moveTo(0, 0);
        flameGfx.arc(0, 0, this.flameRange, -coneHalf, coneHalf);
        flameGfx.lineTo(0, 0);
        flameGfx.endFill();
      } else if (this._pixiFlameGfx) {
        this._pixiFlameGfx.visible = false;
      }
      */

      if (pixiVectorLayer) {
        let gfx = this._pixiGfx;
        if (!gfx) {
          gfx = new PIXI.Graphics();
          pixiVectorLayer.addChild(gfx);
          this._pixiGfx = gfx;
          this.shieldsDirty = true;
        } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

        gfx.position.set(rPos.x, rPos.y);
        // Shield is stationary - no rotation

        if (this.shieldsDirty) {
          gfx.clear();
          // Check if shield is active (any segments > 0)
          const hasShield = this.shieldSegments.some(s => s > 0);
          if (hasShield) {
            // Draw glowing shield matching shield drone lightning color (0x88ddff)
            const shieldRadius = this.shieldRadius;

            // Outer glow layer
            gfx.lineStyle(16 / z, 0x88ddff, 0.3);
            gfx.drawCircle(0, 0, shieldRadius + 20);
            gfx.endFill();

            // Main shield ring - bright cyan with glow
            gfx.lineStyle(12 / z, 0x88ddff, 0.9);
            gfx.drawCircle(0, 0, shieldRadius);
            gfx.endFill();

            // Inner glow for extra radiance
            gfx.lineStyle(6 / z, 0xaaffff, 0.5);
            gfx.drawCircle(0, 0, shieldRadius - 10);
            gfx.endFill();
          }
          this.shieldsDirty = false;
        }

        gfx.visible = true;
      }

      if (pixiVectorLayer) {
        let debugGfx = this._pixiDebugGfx;
        if (!debugGfx) {
          debugGfx = new PIXI.Graphics();
          pixiVectorLayer.addChild(debugGfx);
          this._pixiDebugGfx = debugGfx;
        } else if (!debugGfx.parent) {
          pixiVectorLayer.addChild(debugGfx);
        }

        if (typeof GameContext.DEBUG_COLLISION !== "undefined" && GameContext.DEBUG_COLLISION) {
          debugGfx.visible = true;
          debugGfx.clear();
          debugGfx.position.set(rPos.x, rPos.y);
          debugGfx.rotation = aim;

          debugGfx.lineStyle(2, 0xffff00, 0.5);
          debugGfx.drawCircle(0, 0, this.collisionRadius);

          debugGfx.lineStyle(2, 0x00ff00, 1);
          if (this.collisionHull) {
            for (const circle of this.collisionHull) {
              debugGfx.drawCircle(circle.x, circle.y, circle.r);
            }
          }
        } else {
          debugGfx.visible = false;
        }
      }

      return;
    }

    ctx.save();
    ctx.translate(rPos.x, rPos.y);
    ctx.rotate(aim);

    const drawShieldRing = (segments, radius, color) => {
      if (!segments || segments.length === 0) return;
      ctx.lineWidth = 8 / z;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      const count = segments.length;
      const arcLen = (Math.PI * 2) / count;
      for (let i = 0; i < count; i++) {
        if (segments[i] <= 0) continue;
        const a0 = i * arcLen + 0.03;
        const a1 = (i + 1) * arcLen - 0.03;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
        ctx.arc(0, 0, radius, a0, a1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    drawShieldRing(this.shieldSegments, this.shieldRadius, "#0ff");
    drawShieldRing(this.innerShieldSegments, this.innerShieldRadius, "#f0f");

    ctx.shadowBlur = 26;
    ctx.shadowColor = "#f0f";
    ctx.strokeStyle = "#f0f";
    ctx.lineWidth = 4 / z;
    ctx.fillStyle = "rgba(20,0,20,0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // FIRE BREATH RENDERING (CANVAS 2D FALLBACK) - DISABLED
    /*
    if ((this.flameCharge && this.flameCharge > 0) || (this.flameFire && this.flameFire > 0)) {
      const a = (this.flameAngle || aim) - aim;
      const alpha = this.flameFire && this.flameFire > 0 ? 0.35 : 0.2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255, 120, 40, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, this.flameRange, -this.flameCone * 0.5, this.flameCone * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    */

    ctx.rotate(this.coreRot);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff6";
    ctx.fillStyle = "#ff6";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  spawnCaveReinforcements() {
    const totalEnemies = GameContext.enemies.filter(e => e && !e.dead).length;
    const maxEnemies = 10;

    const aliveGunboats = GameContext.enemies.filter(
      e => e && !e.dead && (e.type === "cave_gunboat1" || e.type === "cave_gunboat2")
    ).length;
    const maxGunboats = 3;

    if (totalEnemies >= maxEnemies) {
      return;
    }

    const enemyTypes = ["roamer", "hunter", "cave_gunboat1", "cave_gunboat2"];
    const count = Math.min(2 + Math.floor(Math.random() * 2), maxEnemies - totalEnemies);

    for (let i = 0; i < count; i++) {
      let type;
      let attempts = 0;

      do {
        type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        attempts++;
      } while (
        attempts < 10 &&
        (type === "cave_gunboat1" || type === "cave_gunboat2") &&
        aliveGunboats >= maxGunboats
      );

      if ((type === "cave_gunboat1" || type === "cave_gunboat2") && aliveGunboats >= maxGunboats) {
        continue;
      }

      const angle = Math.random() * Math.PI * 2;
      const dist = 400 + Math.random() * 200;
      const ex = this.pos.x + Math.cos(angle) * dist;
      const ey = this.pos.y + Math.sin(angle) * dist;
      let enemy;
      if (type === "cave_gunboat1") {
        enemy = new CaveGunboat1(ex, ey);
      } else if (type === "cave_gunboat2") {
        enemy = new CaveGunboat2(ex, ey);
      } else {
        enemy = new Enemy(type, { x: ex, y: ey }, null);
      }
      enemy.isWarpReinforcement = true;
      enemy.despawnImmune = true;
      GameContext.enemies.push(enemy);
    }
    playSound("powerup");
  }
}

