import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { Bullet } from "../projectiles/Bullet.js";
import { getRenderAlpha } from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _updateHealthUI = null;
let _spawnBarrelSmoke = null;

export function registerDroneDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
  if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
}

export class Drone extends Entity {
  constructor(type) {
    super(0, 0);
    this.type = type; // 'heal' | 'shield' | 'shooter'

    const existingDrones = GameContext.drones.filter(d => d.type === type);
    const totalDrones = existingDrones.length + 1;
    const positionIndex = existingDrones.length;

    this.orbitAngle = (positionIndex * Math.PI * 2) / totalDrones;
    this.orbitRadius = 80 + Math.random() * 20;
    this.dead = false;
    this.shootTimer = 0;
    this.shootDelay = 20; // Fire every 20 frames (3 shots/second at 60fps) - matches base turret rate
    this.timer = 0; // Timer for orbit angle (not used for shooting anymore)
    this.lastShieldTick = Date.now();
    this.lastHealTick = Date.now();
  }
  update(deltaTime = SIM_STEP_MS) {
    if (!GameContext.player || GameContext.player.dead) return;

    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;

    const now = Date.now();
    this.orbitAngle += 0.04; // Orbit rotation speed (doubled for 60Hz)
    this.timer++; // Keep timer for potential future use
    const baseX = GameContext.player.pos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const baseY = GameContext.player.pos.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.pos.x = baseX;
    this.pos.y = baseY;

    if (this.type === "heal") {
      // 1 HP per 5 seconds
      if (now - this.lastHealTick >= 5000) {
        if (GameContext.player.hp < GameContext.player.maxHp) {
          GameContext.player.hp = Math.min(GameContext.player.maxHp, GameContext.player.hp + 1);
          if (_updateHealthUI) _updateHealthUI();
          if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, "#0f0");
        }
        this.lastHealTick = now;
      }
    } else if (this.type === "shield") {
      // Time-gated to 1 segment per ~3 seconds
      if (now - this.lastShieldTick >= 3000) {
        const idx = GameContext.player.shieldSegments.findIndex(s => s < 2);
        if (idx !== -1) {
          GameContext.player.shieldSegments[idx] = 2;
          if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 6, "#0ff");
        }
        this.lastShieldTick = now;
      }
    } else if (this.type === "shooter") {
      // Fire rate uses time-based timer (not affected by player fireRateMult upgrades)
      const dtScale = deltaTime / 16.67; // Normalize to 60fps reference
      this.shootTimer -= dtScale;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.shootDelay; // Reset timer (consistent fire rate)

        // Shooter drone now fires where the player's turret aims
        const aimAngle = GameContext.player ? GameContext.player.turretAngle : 0;
        const droneBullet = new Bullet(this.pos.x, this.pos.y, aimAngle, 14, {
          damage: 15,
          radius: 4,
          color: "#ff0"
        });
        droneBullet.weaponType = "drone";
        GameContext.bullets.push(droneBullet);
        if (_spawnBarrelSmoke) _spawnBarrelSmoke(this.pos.x, this.pos.y, aimAngle);
      }
    }
  }
  draw(ctx) {
    if (!GameContext.player || GameContext.player.dead) return;
    const rPos = this.getRenderPos(getRenderAlpha());
    ctx.save();
    ctx.translate(rPos.x, rPos.y);
    ctx.rotate(this.orbitAngle);
    ctx.lineWidth = 2;
    if (this.type === "heal") {
      ctx.fillStyle = "#0f0";
      ctx.strokeStyle = "#0b0";
    } else if (this.type === "shield") {
      ctx.fillStyle = "#0ff";
      ctx.strokeStyle = "#08f";
    } else {
      ctx.fillStyle = "#ff0";
      ctx.strokeStyle = "#aa0";
    }
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
