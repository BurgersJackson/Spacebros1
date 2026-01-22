import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import {
  pixiTextures,
  pixiBossLayer,
  pixiVectorLayer,
  pixiCleanupObject,
  getRenderAlpha
} from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _spawnLargeExplosion = null;

export function registerWarpShieldDroneDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
}

export class WarpShieldDrone extends Entity {
  constructor(parentBoss, angle) {
    // Position based on angle and radius (2000 = 1600 + 400 further away)
    const orbitRadius = 2000;
    const x = parentBoss.pos.x + Math.cos(angle) * orbitRadius;
    const y = parentBoss.pos.y + Math.sin(angle) * orbitRadius;
    super(x, y);

    this.parentBoss = parentBoss;
    this.orbitRadius = orbitRadius;
    this.orbitAngle = angle; // Fixed position, no orbiting
    this.orbitSpeed = 0; // No movement around boss
    this.hp = 300;
    this.maxHp = 300;
    // Sprite scale is 1.125, so visual size is larger than base radius
    // Base visual radius is ~58px, scaled to ~65px, collision doubled to 130
    this.radius = 58;
    this.collisionRadius = 130;
    this.isWarpShieldDrone = true;
    this.t = 0;
    this.rotationAngle = 0; // Rotation angle for spinning in place
    this.rotationSpeed = 0.03; // Rotation speed (radians per frame at 60fps)
    // Force updates even when off-screen (boss-related entities need to stay synchronized)
    this.alwaysUpdate = true;
    this._pixiSprite = null;
    this._pixiHealthBar = null;
    this._pixiLightningGfx = null;
    this._pixiDebugGfx = null;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (!this.parentBoss || this.parentBoss.dead) {
      if (!this.dead) this.kill();
    }

    if (this.dead) {
      this.hideLightning();
      return;
    }

    // Drones stay in fixed world positions - do NOT update position based on boss
    // Position is set at spawn time and remains fixed

    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;

    // Rotate in place
    this.rotationAngle += this.rotationSpeed * dtFactor;
    if (this.rotationAngle > Math.PI * 2) this.rotationAngle -= Math.PI * 2;

    // Update lightning bolt graphics (must be done in update since draw may not be called when off-screen)
    this.updateLightning();
  }

  hideLightning() {
    if (this._pixiLightningGfx) {
      this._pixiLightningGfx.clear();
      this._pixiLightningGfx.visible = false;
    }
  }

  updateLightning() {
    if (!pixiVectorLayer) return;

    let lightningGfx = this._pixiLightningGfx;
    if (!lightningGfx) {
      lightningGfx = new PIXI.Graphics();
      pixiVectorLayer.addChild(lightningGfx);
      this._pixiLightningGfx = lightningGfx;
    } else if (!lightningGfx.parent) {
      pixiVectorLayer.addChild(lightningGfx);
    }

    if (!this.parentBoss || this.parentBoss.dead || this.dead) {
      lightningGfx.clear();
      lightningGfx.visible = false;
      return;
    }

    lightningGfx.clear();
    lightningGfx.visible = true;
    lightningGfx.position.set(0, 0);

    const flicker = Math.sin(this.t * 0.8) * 0.3 + 0.7;

    const droneX = this.pos.x;
    const droneY = this.pos.y;
    const bossX = this.parentBoss.pos.x;
    const bossY = this.parentBoss.pos.y;

    const distToBoss = Math.hypot(bossX - droneX, bossY - droneY);
    const safeDist = Math.max(distToBoss, 1);

    const droneSeed = this.orbitAngle * 1000;
    const timeSeed = Math.floor(this.t * 10);

    lightningGfx.lineStyle(2, 0x88ddff, flicker);
    lightningGfx.moveTo(droneX, droneY);

    const segments = Math.max(8, Math.floor(distToBoss / 200));
    let currentX = droneX;
    let currentY = droneY;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const targetX = droneX + (bossX - droneX) * t;
      const targetY = droneY + (bossY - droneY) * t;

      const perpX = -(bossY - droneY) / safeDist;
      const perpY = (bossX - droneX) / safeDist;

      const jitterSeed = (droneSeed + timeSeed + i * 17) % 1000;
      const jitterAmount = 25 * (1 - Math.abs(t - 0.5) * 2);
      const jitter = (jitterSeed / 1000 - 0.5) * jitterAmount;

      currentX = targetX + perpX * jitter;
      currentY = targetY + perpY * jitter;
      lightningGfx.lineTo(currentX, currentY);
    }
    lightningGfx.lineTo(bossX, bossY);
    lightningGfx.endFill();

    lightningGfx.lineStyle(4, 0x44aaff, flicker * 0.5);
    lightningGfx.moveTo(droneX, droneY);
    currentX = droneX;
    currentY = droneY;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const targetX = droneX + (bossX - droneX) * t;
      const targetY = droneY + (bossY - droneY) * t;
      const perpX = -(bossY - droneY) / safeDist;
      const perpY = (bossX - droneX) / safeDist;
      const jitterSeed = (droneSeed + timeSeed + i * 17) % 1000;
      const jitterAmount = 25 * (1 - Math.abs(t - 0.5) * 2);
      const jitter = (jitterSeed / 1000 - 0.5) * jitterAmount;
      currentX = targetX + perpX * jitter;
      currentY = targetY + perpY * jitter;
      lightningGfx.lineTo(currentX, currentY);
    }
    lightningGfx.lineTo(bossX, bossY);
    lightningGfx.endFill();
  }

  draw(ctx) {
    if (this.dead) {
      // Ensure all graphics are hidden when dead
      if (this._pixiSprite) {
        try {
          this._pixiSprite.visible = false;
        } catch (e) {}
      }
      if (this._pixiHealthBar) {
        try {
          this._pixiHealthBar.visible = false;
        } catch (e) {}
      }
      // Note: Lightning is hidden by update() via hideLightning()
      if (this._pixiDebugGfx) {
        try {
          this._pixiDebugGfx.visible = false;
        } catch (e) {}
      }
      return;
    }

    // Drones stay in fixed world positions - no position updates needed
    // Position was set at spawn time and remains fixed
    // CRITICAL: For fixed-position entities, always keep prevPos = pos to prevent interpolation jitter
    // This prevents the "double frame" shake effect from getRenderPos() interpolation
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    // Since prevPos = pos, getRenderPos() will always return pos (no interpolation)
    const rPos = this.getRenderPos(getRenderAlpha());

    if (pixiBossLayer && pixiTextures.shield_drone && pixiTextures.shield_drone.valid) {
      let sprite = this._pixiSprite;
      if (!sprite) {
        sprite = new PIXI.Sprite(pixiTextures.shield_drone);
        sprite.anchor.set(0.5);
        this._pixiSprite = sprite;
      }
      
      // Ensure sprite is in the correct layer (only add if not already there)
      if (!sprite.parent) {
        pixiBossLayer.addChild(sprite);
      } else if (sprite.parent !== pixiBossLayer) {
        // If sprite is in wrong parent, remove and re-add
        try {
          sprite.parent.removeChild(sprite);
        } catch (e) {}
        pixiBossLayer.addChild(sprite);
      }

      sprite.visible = true;
      // Use render position for smooth interpolation (matches boss pattern)
      // Since prevPos is synced with pos above, rPos should be stable
      sprite.position.set(rPos.x, rPos.y);
      sprite.scale.set(1.125);
      sprite.rotation = Math.PI / 2 + this.rotationAngle; // Rotate in place

      // Draw HP bar above the drone
      if (pixiVectorLayer) {
        const hpBarWidth = 120; // 4x larger (30 * 4)
        const hpBarHeight = 16; // 4x larger (4 * 4)
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        const healthColor = hpPercent > 0.6 ? 0x00ff00 : hpPercent > 0.3 ? 0xffff00 : 0xff0000;

        let hpBar = this._pixiHealthBar;
        if (!hpBar) {
          hpBar = new PIXI.Graphics();
          pixiVectorLayer.addChild(hpBar);
          this._pixiHealthBar = hpBar;
        }

        hpBar.clear();
        hpBar.visible = true;
        hpBar.position.set(rPos.x, rPos.y - 50);

        // Background
        hpBar.beginFill(0x330000);
        hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);
        hpBar.endFill();

        // Health fill
        hpBar.beginFill(healthColor);
        hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth * hpPercent, hpBarHeight);
        hpBar.endFill();

        // Border (thicker for larger bar)
        hpBar.lineStyle(2, 0xffffff);
        hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);
      }

      if (
        typeof GameContext.DEBUG_COLLISION !== "undefined" &&
        GameContext.DEBUG_COLLISION &&
        pixiVectorLayer
      ) {
        let debugGfx = this._pixiDebugGfx;
        if (!debugGfx) {
          debugGfx = new PIXI.Graphics();
          pixiVectorLayer.addChild(debugGfx);
          this._pixiDebugGfx = debugGfx;
        } else if (!debugGfx.parent) {
          pixiVectorLayer.addChild(debugGfx);
        }

        debugGfx.visible = true;
        debugGfx.clear();
        debugGfx.position.set(rPos.x, rPos.y);
        debugGfx.lineStyle(2, 0x00ff00, 1);
        debugGfx.drawCircle(0, 0, this.collisionRadius);
      } else if (this._pixiDebugGfx) {
        this._pixiDebugGfx.visible = false;
      }

      // Note: Lightning bolt drawing moved to updateLightning() method in update()
      // This ensures lightning updates correctly even when drone is off-screen
      return;

      return;
    }

    // Fallback rendering if texture not loaded
    ctx.save();
    ctx.translate(rPos.x, rPos.y);
    ctx.rotate(this.rotationAngle); // Rotate in place
    ctx.fillStyle = "#0af";
    ctx.strokeStyle = "#08f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;

    if (this._pixiSprite) {
      try {
        this._pixiSprite.visible = false;
        if (this._pixiSprite.parent) {
          this._pixiSprite.parent.removeChild(this._pixiSprite);
        }
        this._pixiSprite.destroy();
      } catch (e) {}
      this._pixiSprite = null;
    }

    // Clean up HP bar
    if (this._pixiHealthBar) {
      try {
        this._pixiHealthBar.clear();
        if (this._pixiHealthBar.parent) {
          this._pixiHealthBar.parent.removeChild(this._pixiHealthBar);
        }
        this._pixiHealthBar.destroy();
      } catch (e) {}
      this._pixiHealthBar = null;
    }

    // Clean up lightning graphics FIRST (before standard cleanup)
    if (this._pixiLightningGfx) {
      try {
        this._pixiLightningGfx.visible = false;
        this._pixiLightningGfx.clear();
        if (this._pixiLightningGfx.parent) {
          this._pixiLightningGfx.parent.removeChild(this._pixiLightningGfx);
        }
        this._pixiLightningGfx.destroy(true);
      } catch (e) {}
      this._pixiLightningGfx = null;
    }

    if (this._pixiDebugGfx) {
      try {
        this._pixiDebugGfx.visible = false;
        if (this._pixiDebugGfx.parent) {
          this._pixiDebugGfx.parent.removeChild(this._pixiDebugGfx);
        }
        this._pixiDebugGfx.destroy(true);
      } catch (e) {}
      this._pixiDebugGfx = null;
    }

    // Hide lightning before cleanup
    this.hideLightning();

    pixiCleanupObject(this);

    // Use pinwheel-style explosion
    playSound("base_explode");
    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);

    // Notify parent boss that this drone was destroyed
    if (
      this.parentBoss &&
      !this.parentBoss.dead &&
      typeof this.parentBoss.onShieldDroneDestroyed === "function"
    ) {
      this.parentBoss.onShieldDroneDestroyed();
    }
  }
}
