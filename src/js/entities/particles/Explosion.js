/**
 * Explosion Effect
 * Multi-particle explosion with configurable size.
 */

import { Entity } from '../Entity.js';

/**
 * Explosion effect with multiple particles.
 */
export class Explosion extends Entity {
    constructor(x, y, size = 140) {
        super(x, y);
        this.size = size;
        this.particles = [];
        this.life = 30;
        this.maxLife = 30;
        this.createParticles();
    }

    createParticles() {
        const particleCount = Math.max(15, Math.floor(this.size / 3));
        const colors = ['#ff6', '#fa0', '#f80', '#f00', '#ff8'];

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (0.5 + Math.random() * 2.5) * (this.size / 100);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const life = 20 + Math.floor(Math.random() * 20);

            this.particles.push({
                x: 0,
                y: 0,
                prevX: 0,
                prevY: 0,
                vx: vx,
                vy: vy,
                life: life,
                maxLife: life,
                color: color,
                size: 2 + Math.random() * (this.size / 30)
            });
        }
    }

    update() {
        this.life--;
        if (this.life <= 0) {
            this.dead = true;
            return;
        }

        // Update particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96; // friction
            p.vy *= 0.96;
            p.life--;
            // Add gravity effect
            p.vy += 0.05;
        }
    }

    draw(ctx, alpha = 1.0) {
        ctx.save();
        // Explosion center doesn't move, but if it did we'd use getRenderPos here too
        const rPos = (this.getRenderPos && typeof alpha === 'number') ? this.getRenderPos(alpha) : this.pos;
        ctx.translate(rPos.x, rPos.y);

        // Draw particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.life <= 0) continue;

            const renderX = (typeof alpha === 'number' && p.prevX !== undefined) ? (p.prevX + (p.x - p.prevX) * alpha) : p.x;
            const renderY = (typeof alpha === 'number' && p.prevY !== undefined) ? (p.prevY + (p.y - p.prevY) * alpha) : p.y;

            const pAlpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(renderX, renderY, p.size * pAlpha, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}
