import { CaveMonsterBase } from "./CaveMonsterBase.js";
import { GameContext, getEnemyHpScaling } from "../../core/game-context.js";
import { playSound } from "../../audio/audio-manager.js";
import { caveDeps } from "./cave-dependencies.js";
import { pixiVectorLayer, getRenderAlpha } from "../../rendering/pixi-context.js";
import { ZOOM_LEVEL } from "../../core/constants.js";
import { FlagshipGuidedMissile } from "../projectiles/FlagshipGuidedMissile.js";

export class CaveMonster1 extends CaveMonsterBase {
  constructor(x, y) {
    super(x, y, 1);
    this.displayName = "CAVE CRYPTID";
    this.pulseActive = false;
    this.pulseRadius = 0;
    this.pulseMaxRadius = 1500;
    this.pulseExpansionSpeed = 10;
    this.pulseHit = false;
    this.artillerySpeed = 3.0;
    this.attackType = 0;
    this.attackCooldown = 80;
    this.mortars = [];
  }

  fireAttack(phase) {
    const attacks = ["bioMortars", "neuralPulse", "guidedMissiles"];
    const attack = attacks[this.attackType % attacks.length];
    this.attackType++;

    switch (attack) {
      case "bioMortars":
        this.bioMortars(phase);
        break;
      case "neuralPulse":
        this.neuralPulse(phase);
        break;
      case "guidedMissiles":
        this.guidedMissiles(phase);
        break;
    }
  }

  bioMortars(phase) {
    const count = phase === 3 ? 8 : phase === 2 ? 6 : 4;
    const targetX = GameContext.player ? GameContext.player.pos.x : this.pos.x;
    const targetY = GameContext.player ? GameContext.player.pos.y : this.pos.y;

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 1200;
      const offsetY = (Math.random() - 0.5) * 1200;
      const targetAngle = Math.atan2(
        targetY + offsetY - this.pos.y,
        targetX + offsetX - this.pos.x
      );

      const mortar = {
        x: this.pos.x,
        y: this.pos.y,
        vx: Math.cos(targetAngle) * 10,
        vy: Math.sin(targetAngle) * 10,
        radius: 8,
        maxRange: 1500,
        distTraveled: 0,
        proximityRadius: 100,
        explosionRadius: 150,
        damage: 20,
        explosionDamage: 10,
        dead: false
      };
      this.mortars.push(mortar);
    }
    playSound("shotgun");
  }

  neuralPulse(phase) {
    if (this.dead) return;
    this.pulseActive = true;
    this.pulseRadius = 0;
    this.pulseHit = false;
    playSound("heavy_shoot");
  }

  guidedMissiles(phase) {
    const count = phase === 3 ? 3 : phase === 2 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const missile = new FlagshipGuidedMissile(this);
      missile.hp = 15;
      missile.maxHp = 15;
      missile.speed = 12;
      missile.turnRate = 0.07;
      GameContext.guidedMissiles.push(missile);
    }
    playSound("heavy_shoot");
  }

  update(deltaTime) {
    if (this.dead) return;
    const dtFactor = (deltaTime || 16.67) / 16.67;

    for (let i = this.mortars.length - 1; i >= 0; i--) {
      const m = this.mortars[i];
      if (m.dead) {
        this.mortars.splice(i, 1);
        continue;
      }

      const moveSpeed = 10 * dtFactor;
      m.x += m.vx * dtFactor;
      m.y += m.vy * dtFactor;
      m.distTraveled += moveSpeed;

      if (GameContext.player && !GameContext.player.dead) {
        const dist = Math.hypot(GameContext.player.pos.x - m.x, GameContext.player.pos.y - m.y);
        if (dist < m.proximityRadius) {
          this.explodeMortar(m);
          continue;
        }
      }

      if (m.distTraveled >= m.maxRange) {
        this.explodeMortar(m);
      }
    }

    if (this.pulseActive) {
      this.pulseRadius += this.pulseExpansionSpeed * dtFactor;

      if (GameContext.player && !GameContext.player.dead && !this.pulseHit) {
        const dist = Math.hypot(
          GameContext.player.pos.x - this.pos.x,
          GameContext.player.pos.y - this.pos.y
        );

        if (dist <= this.pulseRadius) {
          this.pulseHit = true;
          const damage = dist < 300 ? 5 : 3;
          if (GameContext.player && !GameContext.player.dead) {
            GameContext.player.takeHit(damage, true);
          }
        }
      }

      if (this.pulseRadius >= this.pulseMaxRadius) {
        this.pulseActive = false;
        this.pulseRadius = 0;
        this.pulseHit = false;
      }
    }

    super.update(deltaTime);
  }

  explodeMortar(m) {
    m.dead = true;
    if (caveDeps.spawnFieryExplosion) caveDeps.spawnFieryExplosion(m.x, m.y, 1.5);
    playSound("explosion");

    if (GameContext.player && !GameContext.player.dead) {
      const dist = Math.hypot(GameContext.player.pos.x - m.x, GameContext.player.pos.y - m.y);
      if (dist < m.explosionRadius) {
        GameContext.player.takeHit(m.explosionDamage);
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);

    if (this.dead) return;

    const rPos = this.getRenderPos ? this.getRenderPos(getRenderAlpha()) : this.pos;

    if (pixiVectorLayer) {
      let mortarGfx = this._pixiMortarGfx;
      if (!mortarGfx) {
        mortarGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(mortarGfx);
        this._pixiMortarGfx = mortarGfx;
      } else if (!mortarGfx.parent) {
        pixiVectorLayer.addChild(mortarGfx);
      }

      mortarGfx.clear();
      const z = GameContext.currentZoom || ZOOM_LEVEL;
      for (const m of this.mortars) {
        if (m.dead) continue;
        mortarGfx.lineStyle(2 / z, 0x00aa00, 0.9);
        mortarGfx.beginFill(0x00ff00, 0.7);
        mortarGfx.drawCircle(m.x, m.y, m.radius);
        mortarGfx.endFill();
      }
    }

    if (this.pulseActive && pixiVectorLayer) {
      let gfx = this._pixiPulseGfx;
      if (!gfx) {
        gfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(gfx);
        this._pixiPulseGfx = gfx;
      } else if (!gfx.parent) {
        pixiVectorLayer.addChild(gfx);
      }

      gfx.clear();
      const z = GameContext.currentZoom || ZOOM_LEVEL;
      gfx.lineStyle(4 / z, 0xff0088, 0.8);
      gfx.drawCircle(rPos.x, rPos.y, this.pulseRadius);
      gfx.endFill();
    } else if (this._pixiPulseGfx) {
      try {
        this._pixiPulseGfx.clear();
      } catch (e) {}
    }
  }

  kill() {
    if (this.dead) return;
    if (this._pixiPulseGfx) {
      try {
        this._pixiPulseGfx.destroy({ children: true });
      } catch (e) {}
      this._pixiPulseGfx = null;
    }
    if (this._pixiMortarGfx) {
      try {
        this._pixiMortarGfx.destroy({ children: true });
      } catch (e) {}
      this._pixiMortarGfx = null;
    }
    this.mortars = [];

    for (let i = GameContext.enemies.length - 1; i >= 0; i--) {
      const e = GameContext.enemies[i];
      if (e && !e.dead && e.owner === this) {
        e.dead = true;
        if (caveDeps.spawnParticles) caveDeps.spawnParticles(e.pos.x, e.pos.y, 15, "#0f0");
      }
    }

    super.kill();
  }
}
