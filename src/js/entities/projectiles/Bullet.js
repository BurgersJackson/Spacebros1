/**
 * Bullet/Projectile
 * Base projectile class for player and enemy bullets.
 */

import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { colorToPixi } from "../../rendering/colors.js";
import { allocPixiSprite, releasePixiSprite } from "../../rendering/sprite-pools.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { Shockwave } from "./Shockwave.js";

let _spawnFieryExplosion = null;

export function registerBulletDependencies(deps) {
  if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
}

/**
 * Bullet projectile with damage and owner tracking.
 */
export class Bullet extends Entity {
  constructor(x, y, angle, speed, opts = {}) {
    super(x, y);
    this._poolType = "bullet";
    this.sprite = null;

    this.vel.x = Math.cos(angle) * speed * 2;
    this.vel.y = Math.sin(angle) * speed * 2;
    this.angle = angle;
    this.speed = speed * 2;

    this.damage = typeof opts.damage === "number" ? opts.damage : 10;
    this.radius = typeof opts.radius === "number" ? opts.radius : 4;
    this.owner = opts.owner !== undefined ? opts.owner : opts.isEnemy ? "enemy" : "player";
    this.isEnemy = typeof opts.isEnemy === "boolean" ? opts.isEnemy : this.owner === "enemy";
    this.life =
      typeof opts.life === "number"
        ? opts.life
        : this.isEnemy
          ? 50
          : GameContext.player && GameContext.player.stats
            ? 50 * (GameContext.player.stats.rangeMult || 1)
            : 50;
    this.maxLife = this.life;
    this.color = opts.color || (this.isEnemy ? "#f00" : "#ff0");
    this.piercing = opts.piercing || false;
    this.hitCount = 0;
    this.maxHits = opts.maxHits || 1;
    this.ignoreShields = !!opts.ignoreShields;
    this.homing = typeof opts.homing === "number" ? opts.homing : 0;
    this.pierceCount = typeof opts.pierceCount === "number" ? opts.pierceCount : 0;
    this.isExplosive = !!opts.isExplosive;
    this.isBomb = !!opts.isBomb;
    this.explosionRadius = typeof opts.explosionRadius === "number" ? opts.explosionRadius : 0;
    this.explosionDamage = typeof opts.explosionDamage === "number" ? opts.explosionDamage : 0;
    this.useShockwave = !!opts.useShockwave;
    this.isMissile = !!opts.isMissile;
    this.isSplitShot = !!opts.isSplitShot;
    this.hasCrit = !!opts.hasCrit;
    this.shape = opts.shape || null;

    if (opts.style) {
      this.style = opts.style;
    } else if (this.isMissile) {
      this.style = "missile";
    } else if (this.shape === "square") {
      this.style = "square";
    } else if (!this.isEnemy) {
      this.style = "laser";
    } else {
      this.style = "glow";
    }
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    if (this.homing > 0 && !this.isEnemy) {
      let target = null;
      let minDist = Infinity;
      const acquireRange = 8000;

      const consider = obj => {
        if (!obj || obj.dead || !obj.pos) return;
        const d = Math.hypot(obj.pos.x - this.pos.x, obj.pos.y - this.pos.y);
        if (d < minDist && d <= acquireRange) {
          minDist = d;
          target = obj;
        }
      };

      for (let e of GameContext.enemies) consider(e);
      if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead)
        consider(GameContext.boss);
      if (GameContext.pinwheels && GameContext.pinwheels.length > 0)
        for (let b of GameContext.pinwheels) consider(b);
      if (GameContext.spaceStation && !GameContext.spaceStation.dead)
        consider(GameContext.spaceStation);
      if (GameContext.destroyer && !GameContext.destroyer.dead) consider(GameContext.destroyer);
      if (
        GameContext.contractEntities &&
        GameContext.contractEntities.wallTurrets &&
        GameContext.contractEntities.wallTurrets.length > 0
      ) {
        for (let t of GameContext.contractEntities.wallTurrets) consider(t);
      }
      if (
        GameContext.warpZone &&
        GameContext.warpZone.active &&
        GameContext.warpZone.turrets &&
        GameContext.warpZone.turrets.length > 0
      ) {
        for (let t of GameContext.warpZone.turrets) {
          if (t && !t.dead) consider(t);
        }
      }
      if (
        GameContext.caveMode &&
        GameContext.caveLevel &&
        GameContext.caveLevel.active &&
        GameContext.caveLevel.wallTurrets &&
        GameContext.caveLevel.wallTurrets.length > 0
      ) {
        for (let t of GameContext.caveLevel.wallTurrets) consider(t);
      }

      if (GameContext.necroticHive && !GameContext.necroticHive.dead)
        consider(GameContext.necroticHive);
      if (GameContext.cerebralPsion && !GameContext.cerebralPsion.dead)
        consider(GameContext.cerebralPsion);
      if (GameContext.fleshforge && !GameContext.fleshforge.dead) consider(GameContext.fleshforge);
      if (GameContext.vortexMatriarch && !GameContext.vortexMatriarch.dead)
        consider(GameContext.vortexMatriarch);
      if (GameContext.chitinusPrime && !GameContext.chitinusPrime.dead)
        consider(GameContext.chitinusPrime);
      if (GameContext.psyLich && !GameContext.psyLich.dead) consider(GameContext.psyLich);

      if (target) {
        const targetAngle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const dtFactor = deltaTime / 16.67;
        const turnRate = (this.homing === 2 ? 0.4 : 0.1) * dtFactor;
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
      }
    }

    super.update(deltaTime);
    const scale = deltaTime / 16.67;
    this.life -= scale;
    if (this.life <= 0) {
      if (this.isBomb && this.explosionRadius > 0) {
        if (_spawnFieryExplosion) _spawnFieryExplosion(this.pos.x, this.pos.y, 1.5);
        if (this.useShockwave) {
          GameContext.shockwaves.push(
            new Shockwave(
              this.pos.x,
              this.pos.y,
              this.explosionDamage || 10,
              this.explosionRadius || 150,
              { color: "#f80", damagePlayer: true }
            )
          );
        }
        playSound("explode");
        if (GameContext.player && !GameContext.player.dead) {
          const dist = Math.hypot(
            GameContext.player.pos.x - this.pos.x,
            GameContext.player.pos.y - this.pos.y
          );
          if (dist < this.explosionRadius) {
            const dmg = this.explosionDamage || 5;
            GameContext.player.takeHit(dmg);
          }
        }
      }
      this.dead = true;
    }
  }

  /**
   * Draw bullet with PixiJS or Canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} pixiResources - { layer, textures, pool }
   */
  draw(ctx, pixiResources = null) {
    if (this.dead) {
      if (this.sprite) {
        this.sprite.visible = false;
        if (pixiResources?.pool) {
          releasePixiSprite(pixiResources.pool, this.sprite);
          this.sprite = null;
        }
      }
      return;
    }

    // Try PixiJS
    if (pixiResources?.layer && pixiResources?.textures) {
      const tex = pixiResources.textures[this.style] || pixiResources.textures.glow;
      if (tex) {
        let spr = this.sprite;
        if (!spr) {
          spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
          this.sprite = spr;
        }
        if (spr) {
          spr.texture = tex;
          if (!spr.parent) pixiResources.layer.addChild(spr);
          spr.visible = true;
          spr.position.set(this.pos.x, this.pos.y);
          spr.rotation = this.angle;
          spr.blendMode = PIXI.BLEND_MODES.ADD;

          const size = (this.radius || 4) * 2;
          if (this.style === "missile") {
            spr.width = 32;
            spr.height = 32;
            spr.tint = 0xffffff;
          } else if (this.style === "laser") {
            spr.width = size * 10;
            spr.height = size * 6;
            spr.tint = colorToPixi(this.color);
          } else {
            spr.width = size * 8;
            spr.height = size * 8;
            spr.tint = colorToPixi(this.color);
          }

          spr.alpha = 1;
          return;
        }
      }
    }

    // Canvas fallback
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;

    if (this.style === "laser") {
      ctx.fillRect(-10, -2, 20, 4);
    } else if (this.style === "square") {
      ctx.fillRect(-3, -3, 6, 6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Record a hit. Returns true if bullet should be destroyed.
   */
  recordHit() {
    this.hitCount++;
    if (!this.piercing || this.hitCount >= this.maxHits) {
      this.dead = true;
      return true;
    }
    return false;
  }
}

/**
 * Homing Missile projectile.
 */
export class Missile extends Entity {
  constructor(x, y, angle, speed, target, opts = {}) {
    super(x, y);
    this._poolType = "bullet";
    this.sprite = null;

    this.vel.x = Math.cos(angle) * speed;
    this.vel.y = Math.sin(angle) * speed;
    this.angle = angle;
    this.speed = speed;
    this.target = target;

    this.damage = opts.damage || 5;
    this.radius = opts.radius || 6;
    this.life = opts.life ? opts.life / 2 : 90;
    this.maxLife = this.life;
    this.color = opts.color || "#f80";
    this.owner = opts.owner || "player";

    this.turnRate = opts.turnRate ? opts.turnRate * 2 : 0.16;
    this.acceleration = opts.acceleration ? opts.acceleration * 2 : 1.0;
    this.maxSpeed = opts.maxSpeed ? opts.maxSpeed : speed * 1.5; // maxSpeed is already correctly set or scaled elsewhere if needed
  }

  update(deltaTime = SIM_STEP_MS) {
    const scale = deltaTime / 16.67;

    // Home toward target
    if (this.target && !this.target.dead) {
      const targetAngle = Math.atan2(
        this.target.pos.y - this.pos.y,
        this.target.pos.x - this.pos.x
      );

      // Calculate angle difference
      let angleDiff = targetAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Turn toward target (scaled by deltaTime)
      const turnAmount = this.turnRate * scale;
      if (Math.abs(angleDiff) < turnAmount) {
        this.angle = targetAngle;
      } else {
        this.angle += Math.sign(angleDiff) * turnAmount;
      }

      // Accelerate (scaled by deltaTime)
      this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * scale);
    }

    this.vel.x = Math.cos(this.angle) * this.speed;
    this.vel.y = Math.sin(this.angle) * this.speed;
    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;

    this.life -= scale;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    // Use same graphics as turret guided missiles
    const z = currentZoom || ZOOM_LEVEL;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    // Glow effect
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#fa0";

    // Main missile body - larger diamond shape like turret missiles
    ctx.fillStyle = "#f80";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-18, 9);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-18, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Flickering exhaust trail
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = `rgba(255, 120, 0, ${0.35 + Math.random() * 0.45})`;
    ctx.fillRect(-32, -4, 10, 8);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
