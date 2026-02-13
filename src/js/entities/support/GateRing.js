import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { pixiVectorLayer, pixiCleanupObject } from "../../rendering/pixi-context.js";

let _completeContract = null;

export function registerGateRingDependencies(deps) {
  if (deps.completeContract) _completeContract = deps.completeContract;
}

export class GateRing extends Entity {
  constructor(x, y, index, total) {
    super(x, y);
    this.radius = 140;
    this.index = index;
    this.total = total;
    this.t = 0;
    this.shieldsDirty = true;
    this._pixiGfx = null;
    this._pixiText = null;
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
    if (!GameContext.activeContract || GameContext.activeContract.type !== "gate_run") return;
    if (GameContext.activeContract.gateIndex !== this.index) return;
    const d = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );
    if (d < this.radius) {
      // advance
      GameContext.activeContract.gateIndex++;
      playSound("powerup");
      showOverlayMessage(`GATE ${this.index + 1} CLEARED`, "#0f0", 700);
      if (GameContext.activeContract.gateIndex >= GameContext.activeContract.gateCount) {
        if (_completeContract) _completeContract(true);
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;

    const active =
      GameContext.activeContract &&
      GameContext.activeContract.type === "gate_run" &&
      GameContext.activeContract.gateIndex === this.index;
    const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.08)) * 0.35;

    if (pixiVectorLayer) {
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);
        this.shieldsDirty = true;
      }
      if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);

      // Track active state changes to trigger visual update
      if (this._wasActive !== active) {
        this._wasActive = active;
        this.shieldsDirty = true;
      }

      if (this.shieldsDirty) {
        this._pixiGfx.clear();
        const col = active ? 0x00ff00 : 0x005000;
        const lw = active ? 6 : 3;
        this._pixiGfx.lineStyle(lw, col, 1.0);
        this._pixiGfx.drawCircle(0, 0, this.radius);
        this.shieldsDirty = false;
      }
      this._pixiGfx.position.set(this.pos.x, this.pos.y);
      this._pixiGfx.alpha = active ? pulse : 0.6;

      if (!this._pixiText) {
        this._pixiText = new PIXI.Text(`${this.index + 1}/${this.total}`, {
          fontFamily: "Courier New",
          fontSize: 16,
          fontWeight: "bold",
          fill: 0xffffff,
          align: "center"
        });
        this._pixiText.anchor.set(0.5);
        pixiVectorLayer.addChild(this._pixiText);
      }
      if (!this._pixiText.parent) pixiVectorLayer.addChild(this._pixiText);
      this._pixiText.position.set(this.pos.x, this.pos.y);
      this._pixiText.tint = active ? 0x00ff00 : 0x005500;
      this._pixiText.visible = true;

      return;
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.strokeStyle = active ? `rgba(0,255,0,${pulse})` : "rgba(0,80,0,0.6)";
    ctx.lineWidth = active ? 6 : 3;
    ctx.shadowBlur = active ? 18 : 0;
    ctx.shadowColor = "#0f0";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = active ? "#0f0" : "#050";
    ctx.font = "bold 16px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${this.index + 1}/${this.total}`, 0, 0);
    ctx.restore();
  }
}
