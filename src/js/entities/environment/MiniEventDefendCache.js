import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from "../../core/constants.js";
import { Enemy } from "../enemies/Enemy.js";
import { playSound } from "../../audio/audio-manager.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import {
  pixiCleanupObject,
  pixiVectorLayer,
  getRenderAlpha
} from "../../rendering/pixi-context.js";
import { pixiTextures } from "../../rendering/texture-loader.js";
let _spawnParticles = null;
let _getSimNowMs = null;
let _showLevelUpMenu = null;

export function registerMiniEventDefendCacheDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
  if (deps.showLevelUpMenu) _showLevelUpMenu = deps.showLevelUpMenu;
}

export class MiniEventDefendCache extends Entity {
  constructor(x, y) {
    super(x, y);
    const now = _getSimNowMs ? _getSimNowMs() : Date.now();
    this.kind = "defend_cache";
    this.radius = 520;
    this.requiredMs = 5000;
    this.progressMs = 0;
    this.expiresAt = now + 75000;
    this.lastUpdateAt = now;
    this.nextWaveAt = now + 1500;
    this.activated = false;
    this.t = 0;
    this.shieldsDirty = true;
    this.nuggetAngle = 0;
    this._pixiGfx = null;
    this._pixiProgressGfx = null;
    this._pixiNuggetSprite = null;
    this._pixiLabelText = null;
    this._pixiTimerText = null;
  }
  kill() {
    if (this.dead) return;
    super.kill();
    if (this._pixiGfx && this._pixiGfx.visible !== false) {
      this._pixiGfx.visible = false;
    }
    if (this._pixiProgressGfx && this._pixiProgressGfx.visible !== false) {
      this._pixiProgressGfx.visible = false;
    }
    if (this._pixiNuggetSprite) {
      this._pixiNuggetSprite.visible = false;
      if (this._pixiNuggetSprite.parent) {
        this._pixiNuggetSprite.parent.removeChild(this._pixiNuggetSprite);
      }
      this._pixiNuggetSprite.destroy();
      this._pixiNuggetSprite = null;
    }
    if (this._pixiLabelText && this._pixiLabelText.visible !== false) {
      this._pixiLabelText.visible = false;
    }
    if (this._pixiTimerText && this._pixiTimerText.visible !== false) {
      this._pixiTimerText.visible = false;
    }
    pixiCleanupObject(this);
  }
  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;

    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    if (!GameContext.player || GameContext.player.dead) {
      this.fail();
      return;
    }
    const now = _getSimNowMs ? _getSimNowMs() : Date.now();
    const dt = Math.min(120, Math.max(0, now - this.lastUpdateAt));
    this.lastUpdateAt = now;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    this.nuggetAngle += 0.02 * dtFactor;

    const d = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );
    if (!this.activated && d < 900) {
      this.activated = true;
      showOverlayMessage("DEFEND THE CACHE - HOLD POSITION", "#ff0", 1500, 1);
    }

    if (now >= this.expiresAt) {
      this.fail();
      return;
    }

    if (d < this.radius) {
      this.progressMs += dt;
    } else if (this.progressMs > 0) {
      // Decay progress at 1/3 fill speed (takes 3x as long to decay as it does to complete)
      this.progressMs -= dt * (1 / 3);
      if (this.progressMs < 0) this.progressMs = 0;
    }

    if (this.activated && now >= this.nextWaveAt) {
      this.spawnWave();
      this.nextWaveAt = now + 2600 + Math.floor(Math.random() * 1600);
    }

    if (this.progressMs >= this.requiredMs) {
      this.success();
    }
  }
  spawnWave() {
    const cap = 10;
    if (GameContext.enemies.length >= cap) return;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      if (GameContext.enemies.length >= cap) break;
      const a = Math.random() * Math.PI * 2;
      const dist = 900 + Math.random() * 600;
      const sx = this.pos.x + Math.cos(a) * dist;
      const sy = this.pos.y + Math.sin(a) * dist;
      GameContext.enemies.push(new Enemy("roamer", { x: sx, y: sy }));
    }
  }
  success() {
    if (this.dead) return;
    this.kill();
    playSound("levelup");
    GameContext.player.addXp(60);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 40, "#ff0");
    showOverlayMessage("EVENT COMPLETE - CHOOSE AN UPGRADE!", "#0f0", 2200, 1);
    if (_showLevelUpMenu) _showLevelUpMenu();
  }
  fail() {
    if (this.dead) return;
    this.kill();
    showOverlayMessage("EVENT FAILED", "#f00", 2000, 1);
  }
  getUiText() {
    const pct = Math.max(0, Math.min(100, Math.floor((this.progressMs / this.requiredMs) * 100)));
    return `EVENT: DEFEND CACHE ${pct}%`;
  }
  draw(ctx) {
    if (this.dead) return;

    if (USE_PIXI_OVERLAY && pixiVectorLayer) {
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);
      }
      if (!this._pixiProgressGfx) {
        this._pixiProgressGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiProgressGfx);
      }
      if (!this._pixiNuggetSprite && pixiTextures?.nugget) {
        this._pixiNuggetSprite = new PIXI.Sprite(pixiTextures.nugget);
        this._pixiNuggetSprite.anchor.set(0.5);
        pixiVectorLayer.addChild(this._pixiNuggetSprite);
      }
      if (!this._pixiLabelText) {
        this._pixiLabelText = new PIXI.Text("DEFEND", {
          fontFamily: "Courier New",
          fontSize: 48,
          fill: 0xffff00,
          fontWeight: "bold"
        });
        this._pixiLabelText.anchor.set(0.5);
        pixiVectorLayer.addChild(this._pixiLabelText);
      }
      if (!this._pixiTimerText) {
        this._pixiTimerText = new PIXI.Text("", {
          fontFamily: "Courier New",
          fontSize: 24,
          fill: 0xffffff,
          fontWeight: "bold"
        });
        this._pixiTimerText.anchor.set(0.5);
        pixiVectorLayer.addChild(this._pixiTimerText);
      }

      const now = _getSimNowMs ? _getSimNowMs() : Date.now();
      const remain = Math.max(0, this.expiresAt - now);
      const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
      const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;
      const rPos = this.getRenderPos(getRenderAlpha());

      this._pixiGfx.position.set(rPos.x, rPos.y);
      this._pixiProgressGfx.position.set(rPos.x, rPos.y);
      this._pixiLabelText.position.set(rPos.x, rPos.y - this.radius - 64);
      this._pixiTimerText.position.set(rPos.x, rPos.y - this.radius - 26);

      // Spinning gold nugget sprite in center
      if (this._pixiNuggetSprite) {
        this._pixiNuggetSprite.position.set(rPos.x, rPos.y);
        this._pixiNuggetSprite.rotation = this.nuggetAngle;
        const tex = pixiTextures.nugget;
        if (tex) {
          const nuggetVisualRadius = 50;
          const scale = (nuggetVisualRadius * 2) / Math.max(1, tex.width, tex.height);
          this._pixiNuggetSprite.scale.set(scale * pulse);
        }
        this._pixiNuggetSprite.visible = true;
      }

      // Outer yellow circle - 2 pixels thick
      this._pixiGfx.clear();
      this._pixiGfx.lineStyle(2, 0xffdc00, 0.6);
      this._pixiGfx.drawCircle(0, 0, this.radius);
      this._pixiGfx.endFill();

      // Progress arc
      this._pixiProgressGfx.clear();
      this._pixiProgressGfx.lineStyle(8 / (GameContext.currentZoom || 1), 0x00ff00, 0.6);
      this._pixiProgressGfx.arc(
        0,
        0,
        this.radius + 12,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * pct
      );

      this._pixiTimerText.text = `${(remain / 1000).toFixed(0)}s`;
      return;
    }

    const now = Date.now();
    const remain = Math.max(0, this.expiresAt - now);
    const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
    const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Outer yellow circle - 2 pixels thick
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 220, 0, 0.6)";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Spinning gold nugget in center (simple circle fallback for canvas)
    ctx.save();
    ctx.rotate(this.nuggetAngle);
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillStyle = "#ffaa00";
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#ff0";
    ctx.font = "bold 48px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DEFEND", 0, -this.radius - 64);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Courier New";
    ctx.fillText(`${(remain / 1000).toFixed(0)}s`, 0, -this.radius - 26);

    ctx.restore();
  }
}
