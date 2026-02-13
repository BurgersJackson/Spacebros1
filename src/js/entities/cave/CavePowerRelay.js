import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { pixiCleanupObject } from "../../rendering/pixi-context.js";

let _spawnParticles = null;

export function registerCavePowerRelayDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
}

export class CavePowerRelay extends Entity {
  constructor(x, y, gateIndex = 0) {
    super(x, y);
    this.gateIndex = gateIndex;
    this.radius = 22;
    this.hp = 80;
    this.maxHp = 8;
    this.t = 0;
  }
  hitByPlayerBullet(b) {
    if (this.dead) return false;
    if (!b || b.isEnemy) return false;
    const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
    if (d > this.radius + b.radius) return false;
    this.hp -= b.damage;
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 12, "#ff0");
    playSound("hit");
    if (this.hp <= 0) {
      this.dead = true;
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 40, "#ff0");
      playSound("explode");
      try {
        if (GameContext.caveLevel) GameContext.caveLevel.onRelayDestroyed(this.gateIndex);
      } catch (e) {}
    }
    return true;
  }
  update(deltaTime = SIM_STEP_MS) {
    this.t += deltaTime / 16.67;
  }
  draw(ctx) {
    if (this.dead) {
      pixiCleanupObject(this);
      return;
    }

    if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
      let container = this._pixiContainer;
      if (!container) {
        container = new PIXI.Container();
        this._pixiContainer = container;
        GameContext.caveLevel._pixiContainer.addChild(container);

        const g = new PIXI.Graphics();
        container.addChild(g);
        this._pixiGfx = g;
      }
      container.visible = true;
      container.position.set(this.pos.x, this.pos.y);

      const pulse = 0.5 + Math.abs(Math.sin(this.t * 0.03)) * 0.35;
      const g = this._pixiGfx;
      g.clear();

      // Outer Ring
      g.beginFill(0x111111);
      g.lineStyle(2, 0xffff00);
      g.drawCircle(0, 0, this.radius);
      g.endFill();

      // Inner Core
      g.beginFill(0xffff00, 0.5 + pulse * 0.3);
      g.lineStyle(0);
      g.drawCircle(0, 0, 8);
      g.endFill();

      return;
    }
  }
}
