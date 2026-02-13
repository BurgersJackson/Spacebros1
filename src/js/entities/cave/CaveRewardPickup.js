import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { pixiCleanupObject } from "../../rendering/pixi-context.js";

export class CaveRewardPickup extends Entity {
  constructor(x, y, rewardType = "coins", value = 0) {
    super(x, y);
    this.rewardType = rewardType;
    this.value = value;
    this.radius = 26;
    this.t = 0;
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

        const text = new PIXI.Text("", {
          fontFamily: "Courier New",
          fontSize: 14,
          fontWeight: "bold",
          fill: "#ffffff",
          align: "center"
        });
        text.anchor.set(0.5);
        container.addChild(text);
        this._pixiText = text;
      }
      container.visible = true;
      container.position.set(this.pos.x, this.pos.y);

      const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.035)) * 0.35;
      const colorVals = {
        upgrade: 0xff00ff,
        shield: 0x00ffff,
        fragment: 0xffff00,
        nugs: 0xffaa00,
        coins: 0x00ff00
      };
      const col = colorVals[this.rewardType] || 0x00ff00;
      const labelVals = {
        upgrade: "UP",
        shield: "SH",
        fragment: "KF",
        nugs: "NG",
        coins: "$"
      };

      const g = this._pixiGfx;
      g.clear();

      g.lineStyle(4, 0xffffff, 0.15 + pulse);
      g.drawCircle(0, 0, this.radius);

      const txt = this._pixiText;
      txt.text = labelVals[this.rewardType] || "$";
      txt.style.fill = col;

      return;
    }
  }
}
