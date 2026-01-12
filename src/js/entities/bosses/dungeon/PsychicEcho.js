import { Entity } from '../../Entity.js';
import { GameContext } from '../../../core/game-context.js';
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from '../../../core/constants.js';
import { pixiVectorLayer, getRenderAlpha } from '../../../rendering/pixi-context.js';

export class PsychicEcho extends Entity {
    constructor(parentBoss, offsetAngle) {
        const dist = 200 + Math.random() * 100;
        const x = parentBoss.pos.x + Math.cos(offsetAngle) * dist;
        const y = parentBoss.pos.y + Math.sin(offsetAngle) * dist;
        super(x, y);

        this.parentBoss = parentBoss;
        this.offsetAngle = offsetAngle;
        this.orbitDist = dist;
        this.orbitSpeed = 0.015 + Math.random() * 0.01;
        this.t = 0;
        this.life = 180;
        this.isFake = true;
        this.radius = 50;
        this._pixiGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        if (!this.parentBoss || this.parentBoss.dead) {
            this.dead = true;
            return;
        }

        this.offsetAngle += this.orbitSpeed * dtFactor;
        this.pos.x = this.parentBoss.pos.x + Math.cos(this.offsetAngle) * this.orbitDist;
        this.pos.y = this.parentBoss.pos.y + Math.sin(this.offsetAngle) * this.orbitDist;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        this.life -= dtFactor;
        if (this.life <= 60) {
            this.alpha = this.life / 60;
        }
        if (this.life <= 0) {
            this.dead = true;
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const rPos = this.getRenderPos(getRenderAlpha());
        const alpha = this.alpha !== undefined ? this.alpha : 1;

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                pixiVectorLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.clear();
            g.position.set(rPos.x, rPos.y);
            g.lineStyle(3 / (GameContext.currentZoom || 1), 0xff00ff, 0.7 * alpha);
            g.beginFill(0x8800ff, 0.3 * alpha);
            g.drawCircle(0, 0, this.radius);
            g.endFill();
            return;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(rPos.x, rPos.y);
        ctx.fillStyle = 'rgba(136, 0, 255, 0.3)';
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
    }
}
