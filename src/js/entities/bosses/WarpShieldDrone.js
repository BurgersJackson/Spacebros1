import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import {
    pixiTextures,
    pixiBossLayer,
    pixiVectorLayer,
    pixiCleanupObject,
    getRenderAlpha
} from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _spawnLargeExplosion = null;

export function registerWarpShieldDroneDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
}

export class WarpShieldDrone extends Entity {
    constructor(parentBoss, angle) {
        // Position based on angle and radius (1600 = 1200 + 400 further away)
        const orbitRadius = 1600;
        const x = parentBoss.pos.x + Math.cos(angle) * orbitRadius;
        const y = parentBoss.pos.y + Math.sin(angle) * orbitRadius;
        super(x, y);

        this.parentBoss = parentBoss;
        this.orbitRadius = orbitRadius;
        this.orbitAngle = angle;  // Fixed position, no orbiting
        this.orbitSpeed = 0;  // No movement around boss
        this.hp = 300;
        this.maxHp = 300;
        // Sprite scale is 1.125, so visual size is larger than base radius
        // Calculate collision radius to match visual size: 30 * 1.125 = 33.75
        this.radius = 34;  // Visual radius to match scaled sprite
        this.collisionRadius = 34;  // Collision radius for bullets and player collisions
        this.isWarpShieldDrone = true;
        this.t = 0;
        this.rotationAngle = 0;  // Rotation angle for spinning in place
        this.rotationSpeed = 0.03;  // Rotation speed (radians per frame at 60fps)
        this._pixiSprite = null;
        this._pixiHealthBar = null;
        this._pixiLightningGfx = null;  // Lightning bolt effect (individual per drone)
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        
        // Rotate in place
        this.rotationAngle += this.rotationSpeed * dtFactor;
        if (this.rotationAngle > Math.PI * 2) this.rotationAngle -= Math.PI * 2;

        if (!this.parentBoss || this.parentBoss.dead) {
            this.kill();
            return;
        }

        // Stay in fixed position relative to boss (no orbiting)
        this.pos.x = this.parentBoss.pos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.pos.y = this.parentBoss.pos.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
    }

    draw(ctx) {
        if (this.dead) {
            // Ensure all graphics are hidden when dead
            if (this._pixiSprite) {
                try { this._pixiSprite.visible = false; } catch (e) { }
            }
            if (this._pixiHealthBar) {
                try { this._pixiHealthBar.visible = false; } catch (e) { }
            }
            if (this._pixiLightningGfx) {
                try { this._pixiLightningGfx.visible = false; } catch (e) { }
            }
            return;
        }
        const rPos = this.getRenderPos(getRenderAlpha());

        if (pixiBossLayer && pixiTextures.shield_drone && pixiTextures.shield_drone.valid) {
            let sprite = this._pixiSprite;
            if (!sprite) {
                sprite = new PIXI.Sprite(pixiTextures.shield_drone);
                sprite.anchor.set(0.5);
                pixiBossLayer.addChild(sprite);
                this._pixiSprite = sprite;
            } else if (!sprite.parent) {
                pixiBossLayer.addChild(sprite);
            }

            sprite.visible = true;
            sprite.position.set(rPos.x, rPos.y);
            sprite.scale.set(1.125);
            sprite.rotation = Math.PI / 2 + this.rotationAngle;  // Rotate in place

            // Draw HP bar above the drone
            if (pixiVectorLayer) {
                const hpBarWidth = 120;  // 4x larger (30 * 4)
                const hpBarHeight = 16;  // 4x larger (4 * 4)
                const hpPercent = Math.max(0, this.hp / this.maxHp);
                const healthColor = hpPercent > 0.6 ? 0x00ff00 : (hpPercent > 0.3 ? 0xffff00 : 0xff0000);

                let hpBar = this._pixiHealthBar;
                if (!hpBar) {
                    hpBar = new PIXI.Graphics();
                    pixiVectorLayer.addChild(hpBar);
                    this._pixiHealthBar = hpBar;
                }

                hpBar.clear();
                hpBar.visible = true;
                hpBar.position.set(rPos.x, rPos.y - 50);

                // Background
                hpBar.beginFill(0x330000);
                hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);
                hpBar.endFill();

                // Health fill
                hpBar.beginFill(healthColor);
                hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth * hpPercent, hpBarHeight);
                hpBar.endFill();

                // Border (thicker for larger bar)
                hpBar.lineStyle(2, 0xffffff);
                hpBar.drawRect(-hpBarWidth / 2, 0, hpBarWidth, hpBarHeight);
            }

            // Draw lightning bolt effect from drone to boss (only if drone is alive)
            if (pixiVectorLayer && this.parentBoss && !this.parentBoss.dead && !this.dead) {
                let lightningGfx = this._pixiLightningGfx;
                if (!lightningGfx) {
                    lightningGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(lightningGfx);
                    this._pixiLightningGfx = lightningGfx;
                } else if (!lightningGfx.parent) {
                    pixiVectorLayer.addChild(lightningGfx);
                }

                // Always clear before redrawing to prevent ghosting
                lightningGfx.clear();
                lightningGfx.visible = true;

                // Animate lightning: flicker effect using time (deterministic, not random)
                const flicker = Math.sin(this.t * 0.8) * 0.3 + 0.7;  // 0.4 to 1.0 alpha

                // Use world positions for both drone and boss (pixiVectorLayer is in world space)
                const droneX = this.pos.x;
                const droneY = this.pos.y;
                const bossX = this.parentBoss.pos.x;
                const bossY = this.parentBoss.pos.y;

                // Calculate angle to boss
                const angle = Math.atan2(bossY - droneY, bossX - droneX);

                // Distance from boss to drone (in render space)
                const distToBoss = Math.hypot(bossX - droneX, bossY - droneY);
                // Boss shield radius (approximate, 950 is the outer shield radius)
                const bossShieldRadius = 950;
                // Start point: at drone
                const startX = droneX;
                const startY = droneY;
                // End point: at boss shield edge (full length)
                const fullEndX = bossX + Math.cos(angle) * bossShieldRadius;
                const fullEndY = bossY + Math.sin(angle) * bossShieldRadius;
                // Make lightning 50% shorter by going halfway from drone to full end point
                const endX = startX + (fullEndX - startX) * 0.5;
                const endY = startY + (fullEndY - startY) * 0.5;

                // Use deterministic jitter based on time and drone index to prevent flickering
                const droneSeed = this.orbitAngle * 1000;  // Use orbit angle as seed
                const timeSeed = Math.floor(this.t * 10);  // Change every 0.1 seconds

                // Draw main lightning bolt with jagged path
                lightningGfx.lineStyle(2, 0x88ddff, flicker);
                lightningGfx.moveTo(startX, startY);

                // Create jagged lightning path with deterministic jitter
                const segments = 6;
                let currentX = startX;
                let currentY = startY;
                for (let i = 1; i < segments; i++) {
                    const t = i / segments;
                    const targetX = startX + (endX - startX) * t;
                    const targetY = startY + (endY - startY) * t;
                    // Add perpendicular offset for jagged effect (deterministic)
                    const perpX = -(endY - startY) / distToBoss;
                    const perpY = (endX - startX) / distToBoss;
                    // Use deterministic pseudo-random based on time and position
                    const jitterSeed = (droneSeed + timeSeed + i * 17) % 1000;
                    const jitter = ((jitterSeed / 1000) - 0.5) * 20 * (1 - Math.abs(t - 0.5) * 2);
                    currentX = targetX + perpX * jitter;
                    currentY = targetY + perpY * jitter;
                    lightningGfx.lineTo(currentX, currentY);
                }
                lightningGfx.lineTo(endX, endY);
                lightningGfx.endFill();  // CRITICAL: prevents ghosting

                // Draw second arc for glow effect
                lightningGfx.lineStyle(4, 0x44aaff, flicker * 0.5);
                lightningGfx.moveTo(startX, startY);
                currentX = startX;
                currentY = startY;
                for (let i = 1; i < segments; i++) {
                    const t = i / segments;
                    const targetX = startX + (endX - startX) * t;
                    const targetY = startY + (endY - startY) * t;
                    const perpX = -(endY - startY) / distToBoss;
                    const perpY = (endX - startX) / distToBoss;
                    // Use same deterministic jitter for consistency
                    const jitterSeed = (droneSeed + timeSeed + i * 17) % 1000;
                    const jitter = ((jitterSeed / 1000) - 0.5) * 20 * (1 - Math.abs(t - 0.5) * 2);
                    currentX = targetX + perpX * jitter;
                    currentY = targetY + perpY * jitter;
                    lightningGfx.lineTo(currentX, currentY);
                }
                lightningGfx.lineTo(endX, endY);
                lightningGfx.endFill();  // CRITICAL: prevents ghosting
            } else {
                // Hide lightning if drone is dead or boss is dead
                if (this._pixiLightningGfx) {
                    this._pixiLightningGfx.clear();
                    this._pixiLightningGfx.visible = false;
                }
            }

            return;
        }

        // Fallback rendering if texture not loaded
        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.rotate(this.rotationAngle);  // Rotate in place
        ctx.fillStyle = '#0af';
        ctx.strokeStyle = '#08f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        if (this._pixiSprite) {
            try {
                this._pixiSprite.visible = false;
                if (this._pixiSprite.parent) {
                    this._pixiSprite.parent.removeChild(this._pixiSprite);
                }
                this._pixiSprite.destroy();
            } catch (e) { }
            this._pixiSprite = null;
        }

        // Clean up HP bar
        if (this._pixiHealthBar) {
            try {
                this._pixiHealthBar.clear();
                if (this._pixiHealthBar.parent) {
                    this._pixiHealthBar.parent.removeChild(this._pixiHealthBar);
                }
                this._pixiHealthBar.destroy();
            } catch (e) { }
            this._pixiHealthBar = null;
        }

        // Clean up lightning graphics FIRST (before standard cleanup)
        if (this._pixiLightningGfx) {
            try {
                this._pixiLightningGfx.visible = false;
                this._pixiLightningGfx.clear();
                if (this._pixiLightningGfx.parent) {
                    this._pixiLightningGfx.parent.removeChild(this._pixiLightningGfx);
                }
                this._pixiLightningGfx.destroy(true);
            } catch (e) { }
            this._pixiLightningGfx = null;
        }

        pixiCleanupObject(this);

        // Use pinwheel-style explosion
        playSound('base_explode');
        if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);

        // Notify parent boss that this drone was destroyed
        if (this.parentBoss && !this.parentBoss.dead && typeof this.parentBoss.onShieldDroneDestroyed === 'function') {
            this.parentBoss.onShieldDroneDestroyed();
        }
    }
}
