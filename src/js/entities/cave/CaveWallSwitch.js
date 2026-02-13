import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { pixiCleanupObject } from "../../rendering/pixi-context.js";

let _spawnParticles = null;

export function registerCaveWallSwitchDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
}

export class CaveWallSwitch extends Entity {
  constructor(x, y, doorIds = []) {
    super(x, y);
    this.radius = 18;
    this.hp = 30;
    this.maxHp = 3;
    this.doorIds = Array.isArray(doorIds) ? doorIds : [];
    this.t = 0;
  }
  hitByPlayerBullet(b) {
    if (this.dead) return false;
    if (!b || b.isEnemy) return false;
    const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
    if (d > this.radius + b.radius) return false;
    this.hp -= b.damage;
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, "#0ff");
    playSound("hit");
    if (this.hp <= 0) {
      this.dead = true;
      pixiCleanupObject(this);
      for (let i = 0; i < this.doorIds.length; i++) {
        try {
          if (GameContext.caveLevel) GameContext.caveLevel.toggleDoor(this.doorIds[i]);
        } catch (e) {}
      }
      showOverlayMessage("SWITCH ACTIVATED", "#0ff", 900, 1);
      playSound("powerup");
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

        const text = new PIXI.Text("SW", {
          fontFamily: "Courier New",
          fontSize: 16,
          fontWeight: "bold",
          fill: "#000000",
          align: "center"
        });
        text.anchor.set(0.5);
        container.addChild(text);
        this._pixiText = text;
      }
      container.visible = true;
      container.position.set(this.pos.x, this.pos.y);

      const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
      const g = this._pixiGfx;
      g.clear();

      // Halo
      g.beginFill(0x00ffff, 0.25 + pulse);
      g.lineStyle(2, 0x00ffff, 1);
      g.drawCircle(0, 0, this.radius);
      g.endFill();

      return;
    }
  }
}
