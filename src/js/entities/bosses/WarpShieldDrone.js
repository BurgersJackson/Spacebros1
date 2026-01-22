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

export function registerWarpShieldDroneDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
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
        this.radius = 30;
        this.isWarpShieldDrone = true;
        this.t = 0;
        this._pixiSprite = null;
        this._pixiHealthBar = null;
        this._pixiLightningGfx = null;  // Lightning bolt effect
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

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
        if (this.dead) return;
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
            sprite.rotation = Math.PI / 2;  // Fixed rotation, no orbit angle

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

            // Draw lightning bolt effect from drone to boss
            if (pixiVectorLayer && this.parentBoss && !this.parentBoss.dead) {
                let lightningGfx = this._pixiLightningGfx;
                if (!lightningGfx) {
                    lightningGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(lightningGfx);
                    this._pixiLightningGfx = lightningGfx;
                }

                lightningGfx.clear();

                // Animate lightning: flicker effect using time
                const flicker = Math.sin(this.t * 0.8) * 0.3 + 0.7;  // 0.4 to 1.0 alpha
                const offset = (Math.sin(this.t * 0.5) * 10);  // Slight position jitter

                // Draw lightning bolt from drone position to boss shield edge
                const bossX = this.parentBoss.pos.x;
                const bossY = this.parentBoss.pos.y;
                const droneX = rPos.x;
                const droneY = rPos.y;

                // Calculate angle to boss
                const angle = Math.atan2(bossY - droneY, bossX - droneX);

                // Distance from boss to drone
                const distToBoss = Math.hypot(bossX - droneX, bossY - droneY);
                // Boss shield radius (approximate, 950 is the outer shield radius)
                const bossShieldRadius = 950;
                // Start point: at drone
                const startX = droneX;
                const startY = droneY;
                // End point: at boss shield edge
                const endX = bossX + Math.cos(angle) * bossShieldRadius;
                const endY = bossY + Math.sin(angle) * bossShieldRadius;

                // Draw main lightning bolt with jagged path
                lightningGfx.lineStyle(2, 0x88ddff, flicker);
                lightningGfx.moveTo(startX, startY);

                // Create jagged lightning path
                const segments = 6;
                let currentX = startX;
                let currentY = startY;
                for (let i = 1; i < segments; i++) {
                    const t = i / segments;
                    const targetX = startX + (endX - startX) * t;
                    const targetY = startY + (endY - startY) * t;
                    // Add perpendicular offset for jagged effect
                    const perpX = -(endY - startY) / distToBoss;
                    const perpY = (endX - startX) / distToBoss;
                    const jitter = (Math.random() - 0.5) * 20 * (1 - Math.abs(t - 0.5) * 2);
                    currentX = targetX + perpX * jitter;
                    currentY = targetY + perpY * jitter;
                    lightningGfx.lineTo(currentX, currentY);
                }
                lightningGfx.lineTo(endX, endY);

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
                    const jitter = (Math.random() - 0.5) * 20 * (1 - Math.abs(t - 0.5) * 2);
                    currentX = targetX + perpX * jitter;
                    currentY = targetY + perpY * jitter;
                    lightningGfx.lineTo(currentX, currentY);
                }
                lightningGfx.lineTo(endX, endY);
            }

            return;
        }

        // Fallback rendering if texture not loaded
        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        // No rotation, fixed position
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

        // Clean up lightning graphics
        if (this._pixiLightningGfx) {
            try {
                this._pixiLightningGfx.clear();
                if (this._pixiLightningGfx.parent) {
                    this._pixiLightningGfx.parent.removeChild(this._pixiLightningGfx);
                }
                this._pixiLightningGfx.destroy();
            } catch (e) { }
            this._pixiLightningGfx = null;
        }

        pixiCleanupObject(this);

        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, '#0af');
        playSound('hit');

        // Notify parent boss that this drone was destroyed
        if (this.parentBoss && !this.parentBoss.dead && typeof this.parentBoss.onShieldDroneDestroyed === 'function') {
            this.parentBoss.onShieldDroneDestroyed();
        }
    }
}
