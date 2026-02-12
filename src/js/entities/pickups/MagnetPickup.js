/**
 * Magnet Pickup
 * When collected, magnetizes all coins on the map toward the player.
 */

import { Entity } from "../Entity.js";

export class MagnetPickup extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 36;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 2;
    this.vel.y = (Math.random() - 0.5) * 2;
    this.magnetized = false;
    this.flash = 0;
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
      const speed = 10 + 1000 / Math.max(10, dist);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(Math.pow(0.95, scale));
    }

    this.pos.x += this.vel.x * scale;
    this.pos.y += this.vel.y * scale;
    this.flash += scale;
  }

  draw(ctx, pixiResources = null) {
    if (this.dead) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 1.0 + Math.sin(this.flash * 0.15) * 0.3;
    ctx.scale(scale, scale);
    ctx.rotate(this.flash * 0.03);

    ctx.fillStyle = "#00ffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 30;

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#004444";
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(0, -18);
    ctx.lineTo(9, -9);
    ctx.moveTo(9, -9);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 0);
    ctx.lineTo(-9, 9);
    ctx.lineTo(-9, -9);
    ctx.fillStyle = "#00ffff";
    ctx.fill();
    ctx.stroke();

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
