import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, ZOOM_LEVEL } from "../../core/constants.js";
import { pixiCleanupObject } from "../../utils/cleanup-utils.js";

export class CaveCritter extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 14;
    this.t = 0;
    this.vel.x = (Math.random() - 0.5) * 2.2;
    this.vel.y = (Math.random() - 0.5) * 2.2;
  }
  scatter(fromX, fromY) {
    const a = Math.atan2(this.pos.y - fromY, this.pos.x - fromX);
    this.vel.x += Math.cos(a) * 4.2;
    this.vel.y += Math.sin(a) * 4.2;
  }
  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    if (GameContext.player && !GameContext.player.dead) {
      const d = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (d < 520) this.scatter(GameContext.player.pos.x, GameContext.player.pos.y);
    }
    this.vel.x *= 0.98;
    this.vel.y *= 0.98;
    this.pos.add(this.vel);

    // Use CaveLevel's wall collision logic directly
    if (GameContext.caveLevel && GameContext.caveLevel.active) {
      GameContext.caveLevel.applyWallCollisions(this);
    }
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

      const z = GameContext.currentZoom || ZOOM_LEVEL;
      const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;

      const g = this._pixiGfx;
      g.clear();

      // Fill
      g.beginFill(0x33cc33);
      g.lineStyle(2, 0x00aa00);
      g.drawCircle(0, 0, this.radius);
      g.endFill();
    }
  }
}
