/**
 * Nuke Pickup
 * When collected, destroys all on-screen entities except bosses.
 * Damages bosses on screen by 50% of their current health.
 * Spawns every 6 minutes (max 1 at a time).
 */

import { Entity } from "../Entity.js";

export class NukePickup extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 36;
    this.visualRadius = 24;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 2;
    this.vel.y = (Math.random() - 0.5) * 2;
    this.magnetized = false;
    this.flash = 0;
    this.pulsePhase = 0;
  }

  update(player, deltaTime = 16.67) {
    if (!player || player.dead) return;
    const scale = deltaTime / 16.67;

    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      // Cap speed to prevent overshooting when very close
      const rawSpeed = 10 + 1000 / Math.max(10, dist);
      const maxSpeed = dist * 0.8;
      const speed = Math.min(rawSpeed, maxSpeed);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(Math.pow(0.95, scale));
    }

    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.flash += scale;
    this.pulsePhase += scale * 0.1;
  }

  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    const pulse = 1.0 + Math.sin(this.flash * 0.12) * 0.35;
    ctx.scale(pulse, pulse);
    ctx.rotate(this.flash * 0.02);

    // Outer glow (orange-red)
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 40;

    // Outer ring
    ctx.fillStyle = "#ff4400";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.visualRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Inner dark circle
    ctx.fillStyle = "#661100";
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.visualRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw radiation trefoil symbol (nuclear symbol)
    ctx.fillStyle = "#ff6600";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    const symbolSize = this.visualRadius * 0.35;
    const innerRadius = symbolSize * 0.3;

    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Three blades of the trefoil
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.save();
      ctx.rotate(angle);

      // Draw blade shape
      ctx.beginPath();
      ctx.moveTo(0, -innerRadius);
      ctx.lineTo(-symbolSize * 0.5, -symbolSize);
      ctx.arc(0, -symbolSize * 0.65, symbolSize * 0.45, Math.PI * 1.2, Math.PI * 1.8, false);
      ctx.lineTo(symbolSize * 0.5, -symbolSize);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  cull() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  kill(pool = null) {
    if (this.dead) return;
    this.dead = true;

    if (this.sprite) {
      this.sprite.visible = false;
      this.sprite = null;
    }
  }
}
