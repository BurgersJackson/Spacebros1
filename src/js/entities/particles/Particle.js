/**
 * Particle Systems
 * Visual effect particles for explosions, smoke, and warp effects.
 * 
 * NOTE: The basic Particle class with PixiJS dependencies remains in main.js
 * Only canvas-based particle classes are exported from this module.
 */

import { Entity } from '../Entity.js';

/**
 * Smoke particle with rotation and size growth.
 * Canvas-only rendering - no PixiJS dependencies.
 */
export class SmokeParticle extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y);
        this._poolType = 'smoke';
        this.vel.x = vx || (Math.random() - 0.5) * 1;
        this.vel.y = vy || (Math.random() - 0.5) * 1;
        this.life = 60 + Math.random() * 30;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
    }

    reset(x, y, vx, vy) {
        this.pos.x = x;
        this.pos.y = y;
        this.vel.x = vx || (Math.random() - 0.5) * 1;
        this.vel.y = vy || (Math.random() - 0.5) * 1;
        this.life = 60 + Math.random() * 30;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
        this.dead = false;
    }

    update() {
        this.pos.add(this.vel);
        this.size += 0.1;
        this.life--;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = (this.life / this.maxLife) * 0.5;
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.life * 0.1);
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

/**
 * Explosion effect with multiple internal particles.
 * Canvas-only rendering - no PixiJS dependencies.
 */
export class Explosion extends Entity {
    constructor(x, y, size = 140) {
        super(x, y);
        this.size = size;
        this.particles = [];
        this.life = 30; // frames duration
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
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96; // friction
            p.vy *= 0.96;
            p.life--;

            // Add gravity effect
            p.vy += 0.05;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Draw particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.life <= 0) continue;

            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}

/**
 * Warp effect particle with trailing line.
 * Canvas-only rendering - no PixiJS dependencies.
 */
export class WarpParticle extends Entity {
    constructor(x, y, angle, speed) {
        super(x, y);
        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;
        this.life = 20;
        this.maxLife = 20;
        this.length = 20;
        this.color = '#aff';
    }

    update() {
        this.pos.add(this.vel);
        this.life--;
        this.length += 5;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y);
        const mag = this.vel.mag();
        if (mag > 0) {
            const tailX = this.pos.x - (this.vel.x / mag) * this.length;
            const tailY = this.pos.y - (this.vel.y / mag) * this.length;
            ctx.lineTo(tailX, tailY);
        }
        ctx.stroke();
        ctx.restore();
    }
}
