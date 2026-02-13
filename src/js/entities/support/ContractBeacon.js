import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { pixiVectorLayer, pixiCleanupObject } from "../../rendering/pixi-context.js";

let _completeContract = null;

export function registerContractBeaconDependencies(deps) {
  if (deps.completeContract) _completeContract = deps.completeContract;
}

export class ContractBeacon extends Entity {
  constructor(x, y, label = "SCAN") {
    super(x, y);
    this.radius = 135;
    this.label = label;
    this.t = 0;
    this.scanStartAt = null;
    this.scanMsRequired = 2000;
    this.shieldsDirty = true;
    this._pixiGfx = null;
    this._pixiLabelText = null;
    this._pixiProgressText = null;
    this._pixiProgressGfx = null;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    pixiCleanupObject(this);
  }
  update(deltaTime = SIM_STEP_MS) {
    if (!GameContext.player || GameContext.player.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    if (!GameContext.activeContract || GameContext.activeContract.type !== "scan_beacon") return;
    const d = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );
    if (d < this.radius) {
      GameContext.activeContract.state = "active";
      if (!this.scanStartAt) this.scanStartAt = Date.now();
      GameContext.activeContract.progress = Math.min(
        1,
        (Date.now() - this.scanStartAt) / this.scanMsRequired
      );
      if (GameContext.activeContract.progress >= 1 && _completeContract) _completeContract(true);
    } else {
      if (GameContext.activeContract.state === "active")
        GameContext.activeContract.state = "travel";
      this.scanStartAt = null;
      GameContext.activeContract.progress = 0;
    }
  }
  draw(ctx) {
    if (this.dead) return;

    const pulse = 0.6 + Math.sin(this.t * 0.1) * 0.2;

    if (pixiVectorLayer) {
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);
        this.shieldsDirty = true;
      }
      if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);

      if (this.shieldsDirty) {
        this._pixiGfx.clear();
        // Outer ring
        this._pixiGfx.lineStyle(3, 0x00ff00, 1.0);
        this._pixiGfx.drawCircle(0, 0, this.radius);
        // Crosshair
        this._pixiGfx.lineStyle(2, 0x00ff00, 1.0);
        this._pixiGfx.moveTo(-18, 0);
        this._pixiGfx.lineTo(18, 0);
        this._pixiGfx.moveTo(0, -18);
        this._pixiGfx.lineTo(0, 18);
        this.shieldsDirty = false;
      }
      this._pixiGfx.position.set(this.pos.x, this.pos.y);
      this._pixiGfx.alpha = pulse;

      // Label
      if (!this._pixiLabelText) {
        this._pixiLabelText = new PIXI.Text(this.label, {
          fontFamily: "Courier New",
          fontSize: 14,
          fontWeight: "bold",
          fill: 0x00ff00,
          align: "center"
        });
        this._pixiLabelText.anchor.set(0.5, 1);
        pixiVectorLayer.addChild(this._pixiLabelText);
      }
      if (!this._pixiLabelText.parent) pixiVectorLayer.addChild(this._pixiLabelText);
      this._pixiLabelText.position.set(this.pos.x, this.pos.y - this.radius - 10);
      this._pixiLabelText.visible = true;

      // Progress
      if (
        GameContext.player &&
        !GameContext.player.dead &&
        GameContext.activeContract &&
        GameContext.activeContract.type === "scan_beacon"
      ) {
        const d = Math.hypot(
          GameContext.player.pos.x - this.pos.x,
          GameContext.player.pos.y - this.pos.y
        );
        if (d < this.radius) {
          const progress = Math.max(0, Math.min(1, GameContext.activeContract.progress || 0));

          if (!this._pixiProgressGfx) {
            this._pixiProgressGfx = new PIXI.Graphics();
            pixiVectorLayer.addChild(this._pixiProgressGfx);
          }
          if (!this._pixiProgressGfx.parent) pixiVectorLayer.addChild(this._pixiProgressGfx);

          this._pixiProgressGfx.clear();
          const w = 140,
            h = 10;
          const x = this.pos.x - w / 2,
            y = this.pos.y + this.radius + 18;
          this._pixiProgressGfx.beginFill(0x000000, 0.65);
          this._pixiProgressGfx.lineStyle(2, 0x00ff00, 1.0);
          this._pixiProgressGfx.drawRect(x, y, w, h);
          this._pixiProgressGfx.endFill();
          this._pixiProgressGfx.beginFill(0x00ff00, 1.0);
          this._pixiProgressGfx.drawRect(x, y, w * progress, h);
          this._pixiProgressGfx.endFill();
          this._pixiProgressGfx.visible = true;

          if (!this._pixiProgressText) {
            this._pixiProgressText = new PIXI.Text("STAY IN ZONE 2s", {
              fontFamily: "Courier New",
              fontSize: 13,
              fontWeight: "bold",
              fill: 0xffffff,
              align: "center"
            });
            this._pixiProgressText.anchor.set(0.5, 0);
            pixiVectorLayer.addChild(this._pixiProgressText);
          }
          if (!this._pixiProgressText.parent) pixiVectorLayer.addChild(this._pixiProgressText);
          this._pixiProgressText.position.set(this.pos.x, y + h + 6);
          this._pixiProgressText.visible = true;
        } else {
          if (this._pixiProgressGfx) this._pixiProgressGfx.visible = false;
          if (this._pixiProgressText) this._pixiProgressText.visible = false;
        }
      } else {
        if (this._pixiProgressGfx) this._pixiProgressGfx.visible = false;
        if (this._pixiProgressText) this._pixiProgressText.visible = false;
      }

      return;
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.strokeStyle = `rgba(0,255,0,${pulse})`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0f0";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // small crosshair
    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 18);
    ctx.stroke();

    // label
    ctx.fillStyle = "#0f0";
    ctx.font = "bold 14px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.label, 0, -this.radius - 10);

    // contextual prompt + progress bar (works with keyboard + gamepad)
    if (
      GameContext.player &&
      !GameContext.player.dead &&
      GameContext.activeContract &&
      GameContext.activeContract.type === "scan_beacon"
    ) {
      const d = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (d < this.radius) {
        const progress = Math.max(0, Math.min(1, GameContext.activeContract.progress || 0));
        const w = 140;
        const h = 10;
        const x = -w / 2;
        const y = this.radius + 18;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.strokeStyle = "#0f0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0f0";
        ctx.fillRect(x, y, w * progress, h);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Courier New";
        ctx.textBaseline = "top";
        ctx.fillText("STAY IN ZONE 2s", 0, y + h + 6);
      }
    }
    ctx.restore();
  }
}
