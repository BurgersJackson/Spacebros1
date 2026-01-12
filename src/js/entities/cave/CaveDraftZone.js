
import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { pixiCleanupObject } from '../../utils/cleanup-utils.js';

export class CaveDraftZone extends Entity {
    constructor(x, y, w, h, forceY = -0.08) {
        super(x, y);
        this.w = w;
        this.h = h;
        this.forceY = forceY;
        this.t = 0;
    }
    contains(entity) {
        if (!entity || entity.dead) return false;
        return (entity.pos.x > this.pos.x - this.w / 2 && entity.pos.x < this.pos.x + this.w / 2 && entity.pos.y > this.pos.y - this.h / 2 && entity.pos.y < this.pos.y + this.h / 2);
    }
    update(deltaTime = SIM_STEP_MS) {
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        const apply = (e) => {
            if (!this.contains(e)) return;
            e.vel.y += this.forceY;
            // Slight stabilization so it feels like a current. 
            e.vel.x *= 0.995;
        };
        if (GameContext.player) apply(GameContext.player);
        for (let i = 0; i < GameContext.enemies.length; i++) apply(GameContext.enemies[i]);
    }
    draw(ctx) {
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

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Background Fill (Simulate Gradient with solid color)
            const aFill = 0.08 + pulse * 0.06;
            g.beginFill(0x0078ff, aFill);
            g.drawRect(-this.w / 2, -this.h / 2, this.w, this.h);
            g.endFill();

            // Outline
            g.lineStyle(2, 0x00ffff, 0.10 + pulse * 0.12);
            g.drawRect(-this.w / 2, -this.h / 2, this.w, this.h);

            // Wavy lines
            g.lineStyle(1, 0xffffff, 0.10 + pulse * 0.10);
            for (let i = -2; i <= 2; i++) {
                // Draw wavy line. Since Pixi Gfx path building is fast, we can calc points.
                // 5 lines spaced 120px apart (vertical offset).
                // x goes from -w/2+20 to w/2-20.
                const basePathY = (i * 120);
                const startX = -this.w / 2 + 20;
                const endX = this.w / 2 - 20;

                // Draw sine wave? Original used single lineTo:
                // ctx.moveTo(-this.w / 2 + 20, y); ctx.lineTo(this.w / 2 - 20, y);
                // The 'y' was modulated by sin(t + i). So it's a moving horizontal line.
                const y = basePathY + Math.sin(this.t * 0.06 + i) * 30;
                g.moveTo(startX, y);
                g.lineTo(endX, y);
            }

            return;
        }
    }
}
