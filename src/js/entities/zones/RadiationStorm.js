import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, USE_PIXI_OVERLAY, ZOOM_LEVEL } from "../../core/constants.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { playSound } from "../../audio/audio-manager.js";
import { pixiVectorLayer, pixiCleanupObject } from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _getSimNowMs = null;
let _awardCoinsInstant = null;

export function registerRadiationStormDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
}

function getNowMs() {
  if (_getSimNowMs) {
    const now = _getSimNowMs();
    if (typeof now === "number") return now;
  }
  return Date.now();
}

export class RadiationStorm extends Entity {
  constructor(x, y, radius = 900, durationMs = 45000) {
    super(x, y);
    this.radius = radius;
    this.endsAt = getNowMs() + durationMs;
    this.t = 0;
    this.tick = 0;
    this.wasInside = false;
    this.shieldsDirty = true;
    this._pixiGfx = null;
  }
  kill() {
    if (this.dead) return;
    super.kill();
    pixiCleanupObject(this);
  }
  update(deltaTime = SIM_STEP_MS) {
    if (!GameContext.player || GameContext.player.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    const now = getNowMs();
    if (now >= this.endsAt) {
      this.kill();
      return;
    }

    // FIX: Ensure storm is nullified after kill to prevent drawing dead storm
    if (this.dead) {
      if (GameContext.radiationStorm === this) {
        GameContext.radiationStorm = null;
      }
      return;
    }

    const d = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );
    const inside = d < this.radius;
    if (inside) {
      if (!this.wasInside) {
        showOverlayMessage("RADIATION STORM - HIGH RISK ZONE", "#ff0", 1800);
      }
      this.tick++;
      if (this.tick % 60 === 0) {
        // Reward: XP + small gold drip
        GameContext.player.addXp(4);
        // Award coin directly: 1 coin * 2 value = 2 total
        if (_awardCoinsInstant) _awardCoinsInstant(2, { noSound: false, sound: "coin" });

        // Cost: drains shields (main shield first, then outer shield)
        let drained = false;
        const idx = GameContext.player.shieldSegments.findIndex(s => s > 0);
        if (idx !== -1) {
          GameContext.player.shieldSegments[idx] = Math.max(
            0,
            GameContext.player.shieldSegments[idx] - 1
          );
          drained = true;
        } else if (
          GameContext.player.outerShieldSegments &&
          GameContext.player.outerShieldSegments.some(s => s > 0)
        ) {
          const o = GameContext.player.outerShieldSegments.findIndex(s => s > 0);
          if (o !== -1) {
            GameContext.player.outerShieldSegments[o] = 0;
            drained = true;
          }
        }
        if (drained) {
          if (_spawnParticles)
            _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 6, "#ff0");
          playSound("shield_hit");
        }
      }
    } else {
      this.tick = 0;
    }
    this.wasInside = inside;
  }
  draw(ctx) {
    if (this.dead) return;

    if (USE_PIXI_OVERLAY && pixiVectorLayer) {
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);
      }
      this._pixiGfx.clear();
      const now = getNowMs();
      const remaining = Math.max(0, this.endsAt - now);
      const lifeT = Math.min(1, remaining / 45000);
      const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.03)) * 0.25;

      this._pixiGfx.position.set(this.pos.x, this.pos.y);

      // Outer Ring
      const innerColor = 0xffdc00;
      const alpha = 0.35 + pulse;
      const lineWidth = 6 / Math.max(0.5, GameContext.currentZoom || ZOOM_LEVEL);
      this._pixiGfx.lineStyle(lineWidth, innerColor, alpha);
      this._pixiGfx.drawCircle(0, 0, this.radius);

      // Haze Fill
      const hazeAlpha = 0.08 + (1 - lifeT) * 0.08;
      this._pixiGfx.beginFill(0xffff00, hazeAlpha);
      this._pixiGfx.drawCircle(0, 0, this.radius);
      this._pixiGfx.endFill();

      // Sparks
      for (let i = 0; i < 8; i++) {
        const a = this.t * 0.02 + i * ((Math.PI * 2) / 8);
        const r = this.radius * (0.65 + 0.35 * Math.sin(this.t * 0.02 + i));
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const sparkAlpha = 0.55;
        const sparkColor = 0xffa000 + ((i * 8) % 80) * 256; // approximation
        this._pixiGfx.beginFill(0xffaa00, sparkAlpha);
        this._pixiGfx.drawCircle(x, y, 4 + (i % 3));
        this._pixiGfx.endFill();
      }
      return;
    }

    const now = Date.now();
    const remaining = Math.max(0, this.endsAt - now);
    const lifeT = Math.min(1, remaining / 45000);
    const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.03)) * 0.25;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.lineWidth = 6;
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#ff0";
    ctx.strokeStyle = `rgba(255, 220, 0, ${0.35 + pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // subtle haze fill
    ctx.globalAlpha = 0.08 + (1 - lifeT) * 0.08;
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // sparks
    for (let i = 0; i < 8; i++) {
      const a = this.t * 0.02 + i * ((Math.PI * 2) / 8);
      const r = this.radius * (0.65 + 0.35 * Math.sin(this.t * 0.02 + i));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      ctx.fillStyle = `rgba(255, ${160 + ((i * 8) % 80)}, 0, 0.55)`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
