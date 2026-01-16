/**
 * Gunboat.js
 * Fast-moving enemy ship with shields and rapid fire.
 * Base class for regular and cave gunboats.
 */

import { Enemy } from './Enemy.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';

export class Gunboat extends Enemy {
    constructor(x, y, level = 1, opts = {}) {
        // Call parent constructor with gunboat type
        // Position must be an object for Enemy constructor
        const startPos = (x != null && y != null) ? { x, y } : null;
        super('gunboat', startPos, null, opts);
        
        // Override gunboat-specific properties
        this.isGunboat = true;
        this.gunboatLevel = level;
        
        // Gunboat stats based on level
        this.radius = 30; // match player size
        this.hp = this.gunboatLevel === 1 ? 10 : 16;
        this.maxSpeed = 8.0; // doubled
        this.thrustPower = 0.88; // quadrupled (0.22 * 4)
        this.shootTimer = this.gunboatLevel === 1 ? 11 : 9; // ~half
        this.shieldSegments = new Array(10).fill(2);
        this.shieldRadius = 45;
        this.gunboatShieldRecharge = 90; // halved for 60Hz (approx 1.5s)
        this.gunboatRange = 900;
        
        const gunboatSizeMult = 3;
        this.radius = Math.round(this.radius * gunboatSizeMult);
        this.shieldRadius = Math.round(this.shieldRadius * gunboatSizeMult);
        
        // Circle-strafe preference
        this.circleStrafePreferred = true;
    }

    update(deltaTime = SIM_STEP_MS) {
        // Call parent update to get all base Enemy behavior
        super.update(deltaTime);
        
        // Gunboat-specific shield regeneration
        if (this.shieldSegments.length > 0 && !this.dead && !this.disableShieldRegen) {
            const dtFactor = deltaTime / 16.67;
            this.gunboatShieldRecharge -= dtFactor;
            if (this.gunboatShieldRecharge <= 0) {
                const idx = this.shieldSegments.findIndex(s => s < 2);
                if (idx !== -1) {
                    this.shieldSegments[idx] = 2;
                    this.shieldsDirty = true;
                }
                this.gunboatShieldRecharge = 180;
            }
        }
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
