/**
 * FloatingText
 * Animated text that floats up and fades (for damage numbers, pickups, etc.)
 */

import { Entity } from "./Entity.js";

/**
 * Floating text effect for feedback (damage, pickups, etc.)
 */
export class FloatingText extends Entity {
  constructor(x, y, text, color = "#ff0", life = 45, opts = {}) {
    super(x, y);
    this.text = text;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.vel.y = -0.7;
    this.vel.x = (Math.random() - 0.5) * 0.25;
    this.key = opts.key || null;
    this.amount = typeof opts.amount === "number" ? opts.amount : null;
    this.prefix = opts.prefix || "";
    this.suffix = opts.suffix || "";
    this.age = 0;
  }

  /**
   * Bump the text value (for stacking numbers).
   * @param {number} deltaAmount - Amount to add
   * @param {number} x - New X position
   * @param {number} y - New Y position
   */
  bump(deltaAmount, x, y) {
    if (typeof deltaAmount === "number") {
      if (typeof this.amount !== "number") this.amount = 0;
      this.amount += deltaAmount;
      this.text = `${this.prefix}${this.amount}${this.suffix}`;
    }
    if (typeof x === "number") {
      this.pos.x = x;
      this.prevPos.x = x;
    }
    if (typeof y === "number") {
      this.pos.y = y;
      this.prevPos.y = y;
    }
    this.life = this.maxLife;
    this.age = 0;
  }

  update() {
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.pos.add(this.vel);
    this.vel.mult(0.98);
    this.life--;
    this.age++;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, alpha = 1.0) {
    if (this.dead) return;
    const rPos =
      this.getRenderPos && typeof alpha === "number" ? this.getRenderPos(alpha) : this.pos;
    const t = Math.max(0, this.life / this.maxLife);
    const a = Math.min(1, t * t);
    ctx.save();
    ctx.translate(rPos.x, rPos.y);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.font = "bold 90px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Use stroke instead of shadowBlur for performance
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(this.text, 0, 0);
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/**
 * Find or create a floating text for stacking.
 * @param {Array} floatingTexts - Array of floating texts
 * @param {string} key - Unique key for stacking
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} amount - Amount to display/add
 * @param {string} color - Text color
 * @param {Object} opts - Additional options
 * @returns {FloatingText}
 */
export function getOrCreateFloatingText(
  floatingTexts,
  key,
  x,
  y,
  amount,
  color = "#ff0",
  opts = {}
) {
  const maxAge = opts.maxAge || 600;
  // Look for existing text with same key
  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    // Stack if key matches, not dead, and "young" enough (wait ~0.3s or 20 frames)
    if (ft.key === key && !ft.dead && ft.age < 20) {
      ft.bump(amount, x, y);
      return ft;
    }
  }

  // Create new floating text
  const ft = new FloatingText(
    x,
    y,
    `${opts.prefix || ""}${amount}${opts.suffix || ""}`,
    color,
    opts.life || 45,
    {
      key,
      amount,
      prefix: opts.prefix || "",
      suffix: opts.suffix || ""
    }
  );
  floatingTexts.push(ft);
  return ft;
}
