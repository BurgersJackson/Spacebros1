import { state } from "./constants.js";
import { Vector } from "./utils.js";
import { releasePixiSprite } from "./rendering/pixi-context.js";

export class Entity {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.radius = 10;
    this.angle = 0;
    this.dead = false;
    this.visible = true;
  }
  update() {
    this.pos.add(this.vel);
  }
  draw(_ctx) {
    // Base implementation
  }
}

export class Particle extends Entity {
  constructor(x, y, vx, vy, color = "#fff", life = 30) {
    super(x, y);
    this._poolType = "particle";
    this.sprite = null;
    this.vel.x = vx || (Math.random() - 0.5) * 3;
    this.vel.y = vy || (Math.random() - 0.5) * 3;
    this.life = life + Math.random() * 10;
    this.maxLife = this.life;
    this.color = color;
  }
  reset(x, y, vx, vy, color = "#fff", life = 30) {
    this.pos.x = x;
    this.pos.y = y;
    this.vel.x = vx || (Math.random() - 0.5) * 3;
    this.vel.y = vy || (Math.random() - 0.5) * 3;
    this.life = life + Math.random() * 10;
    this.maxLife = this.life;
    this.color = color;
    this.dead = false;
    this.sprite = null;
  }
  update() {
    super.update();
    this.life--;
    if (this.life <= 0) {
      this.dead = true;
    }
  }
  draw(ctx) {
    // Pixi logic here (simplified for now but using allocPixiSprite)
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.pos.x, this.pos.y, 2, 2);
    ctx.globalAlpha = 1.0;
  }
}

export class SmokeParticle extends Entity {
  constructor(x, y, vx, vy) {
    super(x, y);
    this._poolType = "smoke";
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
    if (this.life <= 0) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = (this.life / this.maxLife) * 0.5;
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.life * 0.1);
    ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

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
    const colors = ["#ff6", "#fa0", "#f80", "#f00", "#ff8"];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 2.5) * (this.size / 100);
      this.particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.floor(Math.random() * 20),
        maxLife: 40,
        color: colors[Math.floor(Math.random() * colors.length)],
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
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life--;
      p.vy += 0.05;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    for (const p of this.particles) {
      if (p.life <= 0) {
        continue;
      }
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class WarpParticle extends Entity {
  constructor(x, y, angle, speed) {
    super(x, y);
    this.vel.x = Math.cos(angle) * speed;
    this.vel.y = Math.sin(angle) * speed;
    this.life = 20;
    this.maxLife = 20;
    this.length = 20;
    this.color = "#aff";
  }
  update() {
    this.pos.add(this.vel);
    this.life--;
    this.length += 5;
    if (this.life <= 0) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    const mag = Math.hypot(this.vel.x, this.vel.y);
    const tailX = this.pos.x - (this.vel.x / mag) * this.length;
    const tailY = this.pos.y - (this.vel.y / mag) * this.length;
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.restore();
  }
}

export class Coin extends Entity {
  constructor(x, y, value) {
    super(x, y);
    this._pixiPool = "pickup";
    this.value = value;
    this.radius = 8;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 1.0; // doubled
    this.vel.y = (Math.random() - 0.5) * 1.0; // doubled
    this.magnetized = false;
    this.flash = 0;
  }
  update(player) {
    if (!player || player.dead) {
      return;
    }
    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }
    if (this.magnetized) {
      const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      const speed = 12 + 1000 / Math.max(10, dist);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(0.98);
    }
    this.pos.add(this.vel);
    this.flash++;
  }
  draw(ctx) {
    if (this.dead) {
      if (this.sprite) {
        releasePixiSprite(state.pools.pickup, this.sprite);
      }
      this.sprite = null;
      return;
    }
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.2;
    ctx.scale(scale, scale);
    ctx.rotate(Math.PI / 4);
    let color = "#ff0";
    if (this.value >= 5) {
      color = "#f0f";
    }
    if (this.value >= 10) {
      color = "#0ff";
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-4, -4, 8, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

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
    this.fontSize = opts.fontSize || 60;
    this.lastBumpAt = Date.now();
  }
  bump(deltaAmount, x, y) {
    if (typeof deltaAmount === "number") {
      if (typeof this.amount !== "number") {
        this.amount = 0;
      }
      this.amount += deltaAmount;
      this.text = `${this.prefix}${this.amount}${this.suffix}`;
    }
    if (typeof x === "number") {
      this.pos.x = x;
    }
    if (typeof y === "number") {
      this.pos.y = y;
    }
    this.life = this.maxLife;
    this.lastBumpAt = Date.now();
  }
  update() {
    this.pos.add(this.vel);
    this.vel.mult(0.98);
    this.life--;
    if (this.life <= 0) {
      this.dead = true;
    }
  }
  draw(ctx) {
    if (this.dead) {
      return;
    }
    const t = Math.max(0, this.life / this.maxLife);
    const alpha = Math.min(1, t * t);
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.fontSize}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#000";
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

export class EnvironmentAsteroid extends Entity {
  constructor(x, y, r, sizeLevel = 3) {
    super(x, y);
    this.radius = r;
    this.sizeLevel = sizeLevel;
    const speed = Math.random() * 0.4 + 0.2; // doubled
    const angle = Math.random() * Math.PI * 2;
    this.vel.x = Math.cos(angle) * speed;
    this.vel.y = Math.sin(angle) * speed;
    this.rotSpeed = (Math.random() - 0.5) * 0.02; // doubled
    this.unbreakable = false;
    this.contractId = null;

    this.vertices = [];
    const points = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const rad = r * (0.8 + Math.random() * 0.4);
      this.vertices.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad });
    }
  }

  update() {
    this.pos.add(this.vel);
    this.angle += this.rotSpeed;
    const persistentContractWall = !!(
      this.unbreakable &&
      this.contractId &&
      String(this.contractId).startsWith("C")
    );
    if (!persistentContractWall) {
      const player = state.player;
      if (player) {
        const dist = Math.hypot(this.pos.x - player.pos.x, this.pos.y - player.pos.y);
        if (dist > 5000) {
          this.dead = true;
        }
      }
    }
  }

  break() {
    if (this.dead || this.unbreakable) {
      return;
    }
    this.dead = true;
    if (this.sizeLevel > 1) {
      const newSize = this.sizeLevel - 1;
      const newR = this.radius * 0.6;
      for (let i = 0; i < 3; i++) {
        const a = new EnvironmentAsteroid(this.pos.x, this.pos.y, newR, newSize);
        a.vel.x = this.vel.x + (Math.random() - 0.5) * 2;
        a.vel.y = this.vel.y + (Math.random() - 0.5) * 2;
        if (state.entities && state.entities.asteroids) {
          state.entities.asteroids.push(a);
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    if (this.unbreakable) {
      ctx.strokeStyle = "#00aaff";
      ctx.shadowColor = "#0077ff";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 14;
    } else {
      if (state.sectorIndex >= 2) {
        ctx.strokeStyle = "#ccc";
        ctx.shadowColor = "#bbb";
      } else {
        if (this.sizeLevel === 3) {
          ctx.strokeStyle = "#005500";
        } else if (this.sizeLevel === 2) {
          ctx.strokeStyle = "#006600";
        } else {
          ctx.strokeStyle = "#008800";
        }
        ctx.shadowColor = "#003300";
      }
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i++) {
      ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export class SpaceNugget extends Entity {
  constructor(x, y, value = 1) {
    super(x, y);
    this._pixiPool = "pickup";
    this.value = value;
    this.radius = 10;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 1.2; // doubled
    this.vel.y = (Math.random() - 0.5) * 1.2; // doubled
    this.magnetized = false;
    this.flash = 0;
  }

  update() {
    const player = state.player;
    if (!player || player.dead) {
      return;
    }
    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const angle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      const speed = 11 + 900 / Math.max(10, dist);
      this.vel.x = Math.cos(angle) * speed;
      this.vel.y = Math.sin(angle) * speed;
    } else {
      this.vel.mult(0.98);
    }

    this.pos.add(this.vel);
    this.flash++;
  }

  draw(ctx) {
    if (this.dead) {
      if (this.sprite) {
        releasePixiSprite(state.pools.pickup, this.sprite);
      }
      this.sprite = null;
      return;
    }
    // Simplified Canvas fallback (Pixi handled by renderer)
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 1.0 + Math.sin(this.flash * 0.12) * 0.25;
    ctx.scale(scale, scale);
    ctx.rotate(Math.PI / 6);
    const gradient = ctx.createLinearGradient(-10, -10, 10, 10);
    gradient.addColorStop(0, "#ff0");
    gradient.addColorStop(0.5, "#f90");
    gradient.addColorStop(1, "#0ff");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export class GateKey extends Entity {
  constructor(x, y) {
    super(x, y);
    this._pixiPool = "pickup";
    this.radius = 14;
    this.sprite = null;
    this.vel.x = (Math.random() - 0.5) * 0.8;
    this.vel.y = (Math.random() - 0.5) * 0.8;
    this.magnetized = false;
    this.t = 0;
  }
  update() {
    const player = state.player;
    if (!player || player.dead) {
      return;
    }
    this.t++;
    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }
    if (this.magnetized) {
      const a = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      const speed = 9 + 900 / Math.max(10, dist);
      this.vel.x = Math.cos(a) * speed;
      this.vel.y = Math.sin(a) * speed;
    } else {
      this.vel.mult(0.985);
    }
    this.pos.add(this.vel);
  }
  draw(ctx) {
    if (this.dead) {
      if (this.sprite) {
        releasePixiSprite(state.pools.pickup, this.sprite);
      }
      this.sprite = null;
      return;
    }
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.t * 0.08);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff0";
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#ff0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(22, 0);
    ctx.lineTo(22, 6);
    ctx.lineTo(18, 6);
    ctx.lineTo(18, 2);
    ctx.lineTo(8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export class WarpGate extends Entity {
  constructor(x, y, mode = "entry") {
    super(x, y);
    this.mode = mode; // 'entry' | 'exit'
    this.radius = 140;
    this.t = 0;
  }
  update() {
    if (!state.player || state.player.dead) {
      return;
    }
    this.t++;
  }
  draw(ctx) {
    if (this.dead) {
      return;
    }
    const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.45;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.shadowBlur = 24;
    ctx.shadowColor = this.mode === "exit" ? "#0ff" : "#b0f";
    ctx.strokeStyle =
      this.mode === "exit" ? `rgba(0,255,255,${0.35 + pulse})` : `rgba(180,0,255,${0.35 + pulse})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = this.mode === "exit" ? "#0ff" : "#b0f";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(this.mode === "exit" ? "EXIT" : "WARP", 0, 0);
    ctx.restore();
  }
}

export class FlagshipWarpZone extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 3200;
    this.t = 0;
    this.activated = false;
  }
  update() {
    if (this.dead || !state.player || state.player.dead) {
      return;
    }
    this.t++;
    const d = Math.hypot(state.player.pos.x - this.pos.x, state.player.pos.y - this.pos.y);
    if (!this.activated && d < this.radius + 900) {
      this.activated = true;
      // Note: showOverlayMessage should be imported or globally available
    }
  }
  draw(ctx) {
    if (this.dead) {
      return;
    }
    const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.02)) * 0.35;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.lineWidth = 8;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#f0f";
    ctx.strokeStyle = `rgba(255,0,255,${0.25 + pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("FLAGSHIP", 0, -this.radius - 48);
    ctx.restore();
  }
}

export class SectorPOI extends Entity {
  constructor(x, y, name, color = "#0ff", radius = 170) {
    super(x, y);
    this.kind = "poi";
    this.name = name;
    this.color = color;
    this.radius = radius;
    this.claimed = false;
    this.t = 0;
    this.rewardXp = 20;
    this.rewardCoins = 30;
  }
  update() {
    if (this.dead || this.claimed) {
      return;
    }
    this.t++;
    // Claim logic handled by state manager or collision loop
  }
  draw(ctx) {
    if (this.dead || this.claimed) {
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
    ctx.fillStyle = this.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = "bold 42px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(this.name, 0, -this.radius - 18);
    ctx.restore();
  }
}

export class DerelictShipPOI extends SectorPOI {
  constructor(x, y) {
    super(x, y, "DERELICT SHIP", "#0ff", 160);
    this.rewardXp = 25;
    this.rewardCoins = 32;
  }
}

export class DebrisFieldPOI extends SectorPOI {
  constructor(x, y) {
    super(x, y, "DEBRIS FIELD", "#fa0", 220);
    this.rewardXp = 20;
    this.rewardCoins = 40;
    this.captureMsRequired = 3000;
    this.captureMs = 0;
    this.captureActive = false;
  }
  update() {
    if (this.dead || this.claimed) {
      return;
    }
    this.t++;
    // Capture logic will be handled externally or using state.lastUpdateAt
  }
}

export class ExplorationCache extends Entity {
  constructor(x, y, contractId = null) {
    super(x, y);
    this.contractId = contractId;
    this.radius = 12;
    this.vel.x = (Math.random() - 0.5) * 0.3;
    this.vel.y = (Math.random() - 0.5) * 0.3;
    this.magnetized = false;
    this.flash = 0;
    this.value = 2 + Math.floor(Math.random() * 3);
  }
  update() {
    const player = state.player;
    if (!player || player.dead) {
      return;
    }
    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
    if (dist < player.magnetRadius) {
      this.magnetized = true;
    }
    if (this.magnetized) {
      const a = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
      const speed = 8 + 800 / Math.max(10, dist);
      this.vel.x = Math.cos(a) * speed;
      this.vel.y = Math.sin(a) * speed;
    } else {
      this.vel.mult(0.99);
    }
    this.pos.add(this.vel);
    this.flash++;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const scale = 1.0 + Math.sin(this.flash * 0.1) * 0.15;
    ctx.scale(scale, scale);
    ctx.rotate(this.flash * 0.05);
    const grad = ctx.createLinearGradient(-12, -12, 12, 12);
    grad.addColorStop(0, "#ff0");
    grad.addColorStop(0.5, "#ffa500");
    grad.addColorStop(1, "#0ff");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#fff";
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
