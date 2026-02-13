import { CaveMonsterBase } from "./CaveMonsterBase.js";
import { GameContext } from "../../core/game-context.js";
import { Bullet } from "../projectiles/Bullet.js";
import { playSound } from "../../audio/audio-manager.js";
import { caveDeps } from "./cave-dependencies.js";
import { SIM_STEP_MS } from "../../core/constants.js";

export class CaveMonster2 extends CaveMonsterBase {
  constructor(x, y) {
    super(x, y, 2);
    this.displayName = "HOLLOW HORROR";
    this.charging = false;
    this.chargeTimer = 0;
    this.attackType = 0;
  }

  fireAttack(phase) {
    const attacks = ["hornArc", "bellowShockwave", "bloodRain", "goreCharge"];
    const attack = attacks[this.attackType % attacks.length];
    this.attackType++;

    switch (attack) {
      case "goreCharge":
        this.goreCharge(phase);
        break;
      case "hornArc":
        this.hornArc(phase);
        break;
      case "bellowShockwave":
        this.bellowShockwave(phase);
        break;
      case "bloodRain":
        this.bloodRain(phase);
        break;
    }
  }

  goreCharge(phase) {
    // Dash with trail
    this.charging = true;
    this.chargeTimer = 45;

    const baseAngle = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );
    const speed = phase === 3 ? 12 : phase === 2 ? 10 : 8;
    this.vel.x = Math.cos(baseAngle) * speed;
    this.vel.y = Math.sin(baseAngle) * speed;

    // Trail
    const trailInterval = setInterval(() => {
      if (this.dead || !this.charging) {
        clearInterval(trailInterval);
        return;
      }
      if (caveDeps.spawnParticles) caveDeps.spawnParticles(this.pos.x, this.pos.y, 5, "#f00");
    }, 50);

    setTimeout(() => {
      this.charging = false;
      this.vel.x *= 0.3;
      this.vel.y *= 0.3;
    }, 500);
    playSound("shotgun");
  }

  hornArc(phase) {
    // Wide crescent spread
    const count = phase === 3 ? 15 : phase === 2 ? 12 : 9;
    const spread = Math.PI * 0.6;
    const baseAngle = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );

    for (let i = 0; i < count; i++) {
      const a = baseAngle - spread / 2 + (spread / (count - 1)) * i;
      // new Bullet(x, y, angle, speed, opts)
      const b = new Bullet(this.pos.x, this.pos.y, a, 10, {
        damage: 11,
        life: 70,
        color: "#f00",
        isEnemy: true,
        radius: 10
      });
      GameContext.bullets.push(b);
    }
    playSound("rapid_shoot");
  }

  bellowShockwave(phase) {
    playSound("explosion");

    // Visual ring - 30 orange bullets that travel 2000px
    for (let i = 0; i < 30; i++) {
      const a = ((Math.PI * 2) / 30) * i;
      // new Bullet(x, y, angle, speed, opts)
      const b = new Bullet(this.pos.x, this.pos.y, a, 5, {
        damage: 6,
        life: 400,
        color: "#f80",
        isEnemy: true,
        radius: 5
      });
      GameContext.bullets.push(b);
    }
  }

  bloodRain(phase) {
    // Localized falling shots
    const count = phase === 3 ? 20 : phase === 2 ? 15 : 10;
    const targetX = GameContext.player ? GameContext.player.pos.x : this.pos.x;
    const targetY = GameContext.player ? GameContext.player.pos.y : this.pos.y;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (this.dead) return;
        const offsetX = (Math.random() - 0.5) * 400;
        const offsetY = (Math.random() - 0.5) * 400;
        const x = targetX + offsetX;
        const y = targetY + offsetY - 300;

        // Falling bullet
        // new Bullet(x, y, angle, speed, opts)
        const b = new Bullet(x, y, Math.PI / 2, 12, {
          damage: 8,
          life: 60,
          color: "#f00",
          isEnemy: true,
          radius: 8
        });
        GameContext.bullets.push(b);
      }, i * 50);
    }
    playSound("rapid_shoot");
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.charging) {
      this.chargeTimer -= deltaTime / 16.67;
      if (this.chargeTimer <= 0) {
        this.charging = false;
      }
    }
    super.update(deltaTime);
  }
}
