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

    if (!active) {
      if (this._pixiGfx) this._pixiGfx.visible = false;
      if (this._pixiText) this._pixiText.visible = false;
      return;
    }

    const pulse = 0.7 + Math.abs(Math.sin(this.t * 0.08)) * 0.3;
    const rotation = this.t * 0.05;

    if (pixiVectorLayer) {
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);
      }
      if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);

      this._pixiGfx.clear();
      this._pixiGfx.position.set(this.pos.x, this.pos.y);

      this._pixiGfx.lineStyle(4, 0xff6600, 1.0);
      this._pixiGfx.drawCircle(0, 0, this.radius);

      this._pixiGfx.lineStyle(2, 0xff8800, 0.8);
      this._pixiGfx.drawCircle(0, 0, this.radius - 8);

      this._pixiGfx.lineStyle(3, 0xffaa00, 0.6);
      this._pixiGfx.drawCircle(0, 0, this.radius + 10);

      const numSpokes = 8;
      const swirlTightness = 0.15;
      for (let i = 0; i < numSpokes; i++) {
        const angle = (i / numSpokes) * Math.PI * 2 + rotation;
        const innerR = 20;
        const outerR = this.radius - 15;

        this._pixiGfx.lineStyle(2, 0xff9900, 0.7);
        this._pixiGfx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);

        const steps = 20;
        for (let s = 1; s <= steps; s++) {
          const progress = s / steps;
          const r = innerR + (outerR - innerR) * progress;
          const spiralAngle = angle + progress * Math.PI * 2 * swirlTightness;
          this._pixiGfx.lineTo(Math.cos(spiralAngle) * r, Math.sin(spiralAngle) * r);
        }
      }

      this._pixiGfx.beginFill(0xff6600, 0.15);
      this._pixiGfx.drawCircle(0, 0, this.radius - 15);
      this._pixiGfx.endFill();

      this._pixiGfx.alpha = pulse;
      this._pixiGfx.visible = true;

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
      this._pixiText.tint = 0xffcc00;
      this._pixiText.visible = true;

      return;
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    ctx.strokeStyle = `rgba(255,136,0,${pulse})`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#f80";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,170,0,${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,102,0,${pulse * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,100,0,${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 10, 0, Math.PI * 2);
    ctx.fill();

    const numSpokes = 8;
    const swirlTightness = 0.15;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2 + rotation;
      const innerR = 20;
      const outerR = this.radius - 15;

      ctx.strokeStyle = `rgba(255,150,0,${0.7 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);

      const steps = 20;
      for (let s = 1; s <= steps; s++) {
        const progress = s / steps;
        const r = innerR + (outerR - innerR) * progress;
        const spiralAngle = angle + progress * Math.PI * 2 * swirlTightness;
        ctx.lineTo(Math.cos(spiralAngle) * r, Math.sin(spiralAngle) * r);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fa0";
    ctx.font = "bold 16px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${this.index + 1}/${this.total}`, 0, 0);
    ctx.restore();
  }
}
