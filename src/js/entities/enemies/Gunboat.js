/**
 * Gunboat.js
 * Fast-moving enemy ship with shields and rapid fire.
 * Base class for regular and cave gunboats.
 */

import { Enemy } from "./Enemy.js";
import { GameContext, getEnemyHpScaling } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";

export class Gunboat extends Enemy {
  constructor(x, y, level = 1, opts = {}) {
    // Call parent constructor with gunboat type
    // Position must be an object for Enemy constructor
    const startPos = x != null && y != null ? { x, y } : null;
    super("gunboat", startPos, null, opts);

    // Override gunboat-specific properties
    this.isGunboat = true;
    this.gunboatLevel = level;
    const type = opts.type || "standard";

    // Gunboat HP - similar to pinwheel but slightly lower since they move faster
    const baseHp =
      (150 + (GameContext.difficultyTier - 1) * 40) * (this.gunboatLevel === 1 ? 1 : 1.2);
    this.hp = baseHp * getEnemyHpScaling();
    this.maxSpeed = 8.0;
    this.thrustPower = 0.88;
    this.shootTimer = this.gunboatLevel === 1 ? 11 : 9;

    // Shield scaling - same as Pinwheel
    let outerCount = 12;
    let outerHp = 20;
    let innerCount = 0;
    let innerHp = 0;

    if (GameContext.difficultyTier === 1) {
      outerCount = 12;
      outerHp = 20;
    } else if (GameContext.difficultyTier === 2) {
      outerCount = 16;
      outerHp = 20;
    } else if (GameContext.difficultyTier === 3) {
      outerCount = 24;
      outerHp = 20;
    } else if (GameContext.difficultyTier === 4) {
      outerCount = 24;
      outerHp = 20;
      innerCount = 8;
      innerHp = 20;
    } else if (GameContext.difficultyTier === 5) {
      outerCount = 24;
      outerHp = 20;
      innerCount = 12;
      innerHp = 20;
    } else if (GameContext.difficultyTier >= 6) {
      outerCount = 24;
      outerHp = 30 + (GameContext.difficultyTier - 6) * 10;
      innerCount = 16 + (GameContext.difficultyTier - 6);
      innerHp = 20 + Math.floor((GameContext.difficultyTier - 6) / 2) * 10;
    }

    // Elite variant - stronger HP and shields
    if (type === "elite") {
      this.hp *= 1.5;
      outerHp = Math.ceil(outerHp * 1.5);
      innerHp = Math.ceil(innerHp * 1.5);
      this.shootTimer *= 0.7;
    }

    // Store max shield HP for regeneration
    this.maxShieldHp = outerHp;
    this.maxInnerShieldHp = innerHp;

    this.shieldSegments = new Array(outerCount).fill(outerHp);
    this.shieldRadius = 45;
    this.innerShieldSegments = [];
    if (innerCount > 0) {
      this.innerShieldSegments = new Array(innerCount).fill(innerHp);
    }
    this.innerShieldRadius = innerCount > 0 ? 35 : 0;

    this.gunboatRange = 900;

    const gunboatSizeMult = 3;
    this.radius = Math.round(this.radius * gunboatSizeMult);
    this.shieldRadius = Math.round(this.shieldRadius * gunboatSizeMult);
    if (this.innerShieldRadius > 0) {
      this.innerShieldRadius = Math.round(this.innerShieldRadius * gunboatSizeMult);
    }

    // Circle-strafe preference
    this.circleStrafePreferred = true;
  }

  update(deltaTime = SIM_STEP_MS) {
    // Call parent update to get all base Enemy behavior
    super.update(deltaTime);
  }

  kill() {
    if (this.dead) return;

    // Call parent kill for base cleanup
    super.kill();

    // Gunboat-specific death handling
    // Note: gunboat respawn timer is set in parent Enemy.kill()
    // We'll track gunboat deaths in collision-manager.js
  }
}
