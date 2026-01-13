import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from '../../core/constants.js';
import { Coin } from '../pickups/Coin.js';
import { playSound } from '../../audio/audio-manager.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import {
    allocPixiSprite,
    pixiCleanupObject,
    pixiVectorLayer,
    getRenderAlpha
} from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _getSimNowMs = null;

/**
 * @param {object} deps
 * @returns {void}
 */
export function registerPoiDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
}

export class SectorPOI extends Entity {
    constructor(x, y, name, color = '#0ff', radius = 170) {
        super(x, y);
        this.kind = 'poi';
        this.name = name;
        this.color = color;
        this.radius = radius;
        this.claimed = false;
        this.t = 0;
        this.rewardXp = 20;
        this.rewardCoins = 30;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiNameText = null;
    }
    kill() {
        if (this.dead) {
            if (!this._pixiIsCleaning) {
                pixiCleanupObject(this);
            }
            return;
        }
        this.dead = true;
        pixiCleanupObject(this);
    }
    canClaim() {
        if (!GameContext.player || GameContext.player.dead) return false;
        if (this.claimed) return false;
        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        return d <= this.radius + GameContext.player.radius;
    }
    claim() {
        if (this.claimed) return;
        this.claimed = true;
        showOverlayMessage(`POI CLEARED: ${this.name}`, '#0ff', 1600, 1);
        playSound('powerup');
        if (GameContext.player) GameContext.player.addXp(this.rewardXp);
        const coinsToSpawn = Math.max(1, Math.floor(this.rewardCoins / 8));
        for (let i = 0; i < coinsToSpawn; i++) {
            GameContext.coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 220, this.pos.y + (Math.random() - 0.5) * 220, 8));
        }
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 30, this.color);
        this.dead = true;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (this.canClaim()) this.claim();
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            if (this._pixiGfx) this._pixiGfx.visible = false;
            if (this._pixiNameText) this._pixiNameText.visible = false;
            return;
        }

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            if (!this._pixiNameText) {
                const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;
                this._pixiNameText = new PIXI.Text(this.name, { fontFamily: 'Courier New', fontSize: 42, fill: c, fontWeight: 'bold' });
                this._pixiNameText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiNameText);
            }
            this._pixiGfx.visible = true;
            this._pixiNameText.visible = true;

            const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
            const rPos = this.getRenderPos(getRenderAlpha());
            this._pixiGfx.position.set(rPos.x, rPos.y);
            this._pixiNameText.position.set(rPos.x, rPos.y - this.radius - 18);

            this._pixiGfx.clear();
            const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;

            this._pixiGfx.lineStyle(5 / (GameContext.currentZoom || 1), c, 0.35 + pulse * 0.15);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            this._pixiGfx.lineStyle(2 / (GameContext.currentZoom || 1), 0xffffff, 1.0);
            this._pixiGfx.beginFill(c, 1.0);
            this._pixiGfx.moveTo(0, -18);
            this._pixiGfx.lineTo(16, 0);
            this._pixiGfx.lineTo(0, 18);
            this._pixiGfx.lineTo(-16, 0);
            this._pixiGfx.closePath();
            this._pixiGfx.endFill();
            return;
        }

        const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.35 + pulse * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.font = 'bold 42px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 0, -this.radius - 18);
        ctx.restore();
    }
}

export class DerelictShipPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DERELICT SHIP', '#0ff', 160);
        this.rewardXp = 25;
        this.rewardCoins = 32;
    }
}

export class DebrisFieldPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DEBRIS FIELD', '#fa0', 220);
        this.rewardXp = 20;
        this.rewardCoins = 40;
        this.captureMsRequired = 3000;
        this.captureMs = 0;
        this.captureActive = false;
        const now = _getSimNowMs ? _getSimNowMs() : Date.now();
        this.lastUpdateAt = now;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead || this.claimed) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.player || GameContext.player.dead) return;
        const now = _getSimNowMs ? _getSimNowMs() : Date.now();
        const dt = Math.min(120, Math.max(0, now - (this.lastUpdateAt || now)));
        this.lastUpdateAt = now;

        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        const inside = d <= this.radius + GameContext.player.radius;
        if (inside) {
            if (!this.captureActive) {
                this.captureActive = true;
                this.captureMs = 0;
            }
            this.captureMs += dt;
            if (this.captureMs >= this.captureMsRequired) this.claim();
        } else {
            this.captureActive = false;
            this.captureMs = 0;
        }
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            if (this._pixiProgressGfx) {
                this._pixiProgressGfx.visible = false;
            }
            if (this._pixiGfx) {
                this._pixiGfx.visible = false;
            }
            if (this._pixiNameText) {
                this._pixiNameText.visible = false;
            }
            return;
        }
        super.draw(ctx);

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiProgressGfx) {
                this._pixiProgressGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiProgressGfx);
            }
            const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
            this._pixiProgressGfx.clear();
            if (pct > 0) {
                this._pixiProgressGfx.visible = true;
                this._pixiProgressGfx.position.set(this.pos.x, this.pos.y);
                this._pixiProgressGfx.lineStyle(10 / (GameContext.currentZoom || 1), 0x00ff00, 0.65);
                this._pixiProgressGfx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            } else {
                this._pixiProgressGfx.visible = false;
            }
            return;
        }

        const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
        if (pct <= 0) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.65)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    kill() {
        if (this.dead) {
            if (!this._pixiIsCleaning) {
                if (this._pixiProgressGfx) {
                    try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) { }
                    this._pixiProgressGfx = null;
                }
                if (this._pixiGfx) {
                    try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
                    this._pixiGfx = null;
                }
                if (this._pixiNameText) {
                    try { this._pixiNameText.destroy(); } catch (e) { }
                    this._pixiNameText = null;
                }
            }
            return;
        }
        super.kill();
        if (this._pixiProgressGfx) {
            try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) { }
            this._pixiProgressGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(); } catch (e) { }
            this._pixiNameText = null;
        }
    }
}

export class ExplorationCache extends Entity {
    constructor(x, y, contractId = null) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.contractId = contractId;
        this.radius = 12;
        this.vel.x = (Math.random() - 0.5) * 0.3;
        this.vel.y = (Math.random() - 0.5) * 0.3;
        this.magnetized = false;
        this.flash = 0;
        this.value = 2 + Math.floor(Math.random() * 3);
        this.sprite = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        pixiCleanupObject(this);
    }
    update(deltaTime = SIM_STEP_MS) {
        if (!GameContext.player || GameContext.player.dead) return;
        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist < GameContext.player.magnetRadius) this.magnetized = true;
        if (this.magnetized) {
            const a = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
            const speed = 8 + (800 / Math.max(10, dist));
            this.vel.x = Math.cos(a) * speed;
            this.vel.y = Math.sin(a) * speed;
        } else {
            this.vel.mult(0.99);
        }
        this.pos.add(this.vel);
        this.flash++;
    }
    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        if (pixiResources?.layer && pixiResources?.textures?.nugget) {
            const tex = pixiResources.textures.nugget;
            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
                this.sprite = spr;
            }
            if (spr) {
                if (!spr.parent) pixiResources.layer.addChild(spr);
                spr.visible = true;
                spr.position.set(this.pos.x, this.pos.y);
                const pulse = 1.0 + Math.sin(this.flash * 0.1) * 0.15;
                const targetRadius = 25;
                const base = (targetRadius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(base * pulse);
                spr.rotation = this.flash * 0.05;
                spr.tint = 0xffffff;
                spr.alpha = 1;
                if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                return;
            }
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = (1.0 + Math.sin(this.flash * 0.1) * 0.15) * 0.5;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        const grad = ctx.createLinearGradient(-12, -12, 12, 12);
        grad.addColorStop(0, '#ff0');
        grad.addColorStop(0.5, '#ffa500');
        grad.addColorStop(1, '#0ff');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
