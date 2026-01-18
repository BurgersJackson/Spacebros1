/**
 * EnvironmentAsteroid.js
 * Destructible and indestructible asteroids in the game world.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import {
    // Layers and pools
    pixiAsteroidLayer,
    pixiAsteroidSpritePool,
    // Sprite utilities
    allocPixiSprite,
    releasePixiSprite,
    // Textures
    pixiTextures,
    pixiTextureAnchors,
    // State getters
    getRenderAlpha,
    getAsteroidImages,
    getAsteroidIndestructibleImage,
    isAsteroidTexturesReady,
    isAsteroidIndestructibleTextureReady
} from '../../rendering/pixi-context.js';

// Dependency injection for main.js-specific functions that can't be extracted
let _checkDespawn = null;
let _pixiCleanupObject = null;
let _spawnAsteroidExplosion = null;

/**
 * Register dependencies from main.js.
 * These are functions that are tightly coupled to main.js game logic.
 */
export function registerAsteroidDependencies(deps) {
    if (deps.checkDespawn) _checkDespawn = deps.checkDespawn;
    if (deps.pixiCleanupObject) _pixiCleanupObject = deps.pixiCleanupObject;
    if (deps.spawnAsteroidExplosion) _spawnAsteroidExplosion = deps.spawnAsteroidExplosion;
}

/**
 * Provided for backwards compatibility - no longer needed with pixi-context.
 * @deprecated Use pixi-context.js imports instead
 */
export function updateAsteroidRenderState(alpha, resources) {
    // No-op - state now comes from pixi-context
}

/**
 * Environment asteroid that can be destroyed or act as indestructible obstacles.
 */
export class EnvironmentAsteroid extends Entity {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} r - Radius
     * @param {number} sizeLevel - Size tier (3=large, 2=medium, 1=small)
     * @param {boolean} indestructible - Whether the asteroid can be destroyed
     */
    constructor(x, y, r, sizeLevel = 3, indestructible = false) {
        super(x, y);
        this._pixiPool = 'asteroid';
        this.radius = r;
        this.sizeLevel = sizeLevel;
        this.indestructible = indestructible;
        this.unbreakable = indestructible;
        this.sprite = null;
        this._pixiAsteroidIndex = Math.floor(Math.random() * 12);

        const speed = (Math.random() * 0.4) + 0.2;
        const angle = Math.random() * Math.PI * 2;
        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;
        this.rotSpeed = (Math.random() - 0.5) * 0.04;

        this.vertices = [];
        const points = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < points; i++) {
            const vertAngle = (i / points) * Math.PI * 2;
            const rad = r * (0.8 + Math.random() * 0.4);
            this.vertices.push({ x: Math.cos(vertAngle) * rad, y: Math.sin(vertAngle) * rad });
        }

        // Contract reference for persistent wall asteroids
        this.contractId = null;
    }

    /**
     * Update asteroid position and rotation.
     * @param {number} deltaTime - Time elapsed in ms
     */
    update(deltaTime = SIM_STEP_MS) {
        // Save previous angle for interpolation
        this.prevAngle = this.angle;

        const dtFactor = deltaTime / 16.67;
        
        // In vertical scrolling mode, move asteroids downward to match parallax background (continue during boss intro and boss fight)
        if (typeof GameContext !== 'undefined' && GameContext.verticalScrollingMode && GameContext.verticalScrollingZone && (GameContext.verticalScrollingZone.state === 'scrolling' || GameContext.verticalScrollingZone.state === 'boss_intro' || GameContext.verticalScrollingZone.state === 'boss_battle')) {
            // Move downward at scroll speed * parallax multiplier to match background visual speed
            // Parallax multiplier is 11.0x, reduced by 50% for asteroid movement
            const parallaxMultiplier = 11.0;
            this.pos.y += GameContext.scrollSpeed * parallaxMultiplier * 0.5 * dtFactor;
            this.prevPos.y = this.pos.y;
        }

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        this.angle += this.rotSpeed * dtFactor;

        // Contract / maze walls should persist until cleaned up
        const persistentContractWall = !!(this.unbreakable && this.contractId && String(this.contractId).startsWith('C'));

        if (!persistentContractWall && _checkDespawn) {
            _checkDespawn(this, 5000);
        }
    }

    /**
     * Break the asteroid, spawning smaller pieces.
     * @param {boolean} noSound - Skip sound effect
     */
    break(noSound = false) {
        if (this.dead) return;
        if (this.unbreakable) return;
        this.dead = true;

        if (_pixiCleanupObject) {
            _pixiCleanupObject(this);
        }

        if (!noSound) {
            playSound('asteroid_destroy');
        }

        const boomScale = Math.max(0.7, Math.min(2.4, (this.radius || 50) / 60));
        if (_spawnAsteroidExplosion) {
            _spawnAsteroidExplosion(this.pos.x, this.pos.y, boomScale);
        }

        if (this.sizeLevel > 2) {
            const newSize = this.sizeLevel - 1;
            const newR = this.radius * 0.6;
            const pieces = 3;
            const pieceChance = 0.5;
            let spawned = 0;

            for (let i = 0; i < pieces; i++) {
                if (Math.random() > pieceChance) continue;
                const a = new EnvironmentAsteroid(this.pos.x, this.pos.y, newR, newSize);
                a.vel.x = this.vel.x + (Math.random() - 0.5) * 2;
                a.vel.y = this.vel.y + (Math.random() - 0.5) * 2;
                GameContext.environmentAsteroids.push(a);
                spawned++;
            }

            // Ensure at least 1 child when splitting
            if (spawned === 0) {
                const a = new EnvironmentAsteroid(this.pos.x, this.pos.y, newR, newSize);
                a.vel.x = this.vel.x + (Math.random() - 0.5) * 2;
                a.vel.y = this.vel.y + (Math.random() - 0.5) * 2;
                GameContext.environmentAsteroids.push(a);
            }
        }
    }

    /**
     * Draw the asteroid.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        if (this.dead) {
            if (this.sprite && pixiAsteroidSpritePool) {
                releasePixiSprite(pixiAsteroidSpritePool, this.sprite);
                this.sprite = null;
            }
            return;
        }

        const renderAlpha = getRenderAlpha();
        const rPos = this.getRenderPos(renderAlpha);
        const prevAng = (this.prevAngle !== undefined) ? this.prevAngle : this.angle;
        const rAngle = prevAng + (this.angle - prevAng) * renderAlpha;

        // Get texture state from pixi-context
        const asteroidImages = getAsteroidImages();
        const asteroidIndestructibleImage = getAsteroidIndestructibleImage();
        const texturesReady = isAsteroidTexturesReady();
        const indestructibleTextureReady = isAsteroidIndestructibleTextureReady();

        // Try PixiJS rendering
        if (pixiAsteroidLayer && pixiTextures?.asteroids?.length > 0) {
            let tex;
            let anchor;

            // Use indestructible texture if available
            if (this.indestructible && indestructibleTextureReady && pixiTextures.asteroidIndestructible) {
                tex = pixiTextures.asteroidIndestructible;
                anchor = pixiTextureAnchors?.asteroidIndestructible || 0.5;
            } else {
                let idx = 0;
                if (texturesReady && pixiTextures.asteroids.length >= 3) {
                    idx = (this.sizeLevel >= 3) ? 0 : (this.sizeLevel === 2 ? 1 : 2);
                } else {
                    idx = (this._pixiAsteroidIndex >>> 0) % pixiTextures.asteroids.length;
                }
                tex = pixiTextures.asteroids[idx] || pixiTextures.asteroids[0];
                anchor = pixiTextureAnchors?.[`asteroid_${idx}`] || 0.5;
            }

            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiAsteroidSpritePool, pixiAsteroidLayer, tex, null, anchor);
                this.sprite = spr;
            }
            if (spr) {
                spr.texture = tex;
                try {
                    if (typeof anchor === 'number') spr.anchor.set(anchor);
                    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') {
                        spr.anchor.set(anchor.x, anchor.y);
                    }
                } catch (e) { }
                if (!spr.parent) pixiAsteroidLayer.addChild(spr);
                spr.visible = true;
                spr.position.set(rPos.x, rPos.y);
                spr.rotation = rAngle;
                const s = (this.radius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(s);
                const tint = this.indestructible ? 0x00aaff : 0xffffff;
                spr.tint = tint;
                spr.alpha = 1;
                spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                return;
            }
        }

        // Canvas fallback
        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.rotate(rAngle);

        // Canvas fallback: use external asteroid art if present
        if (this.indestructible && asteroidIndestructibleImage?.naturalWidth > 0) {
            const img = asteroidIndestructibleImage;
            const denom = Math.max(1, Math.max(img.naturalWidth, img.naturalHeight));
            const scale = (this.radius * 2) / denom;
            ctx.save();
            ctx.scale(scale, scale);
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            ctx.restore();
            ctx.restore();
            return;
        } else if (!this.unbreakable && asteroidImages && texturesReady) {
            const img = (this.sizeLevel >= 3)
                ? asteroidImages[0]
                : (this.sizeLevel === 2 ? asteroidImages[1] : asteroidImages[2]);
            if (img && img.naturalWidth > 0) {
                const denom = Math.max(1, Math.max(img.naturalWidth, img.naturalHeight));
                const scale = (this.radius * 2) / denom;
                ctx.save();
                ctx.scale(scale, scale);
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                ctx.restore();
                ctx.restore();
                return;
            }
        }

        // Procedural fallback
        if (this.unbreakable) {
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
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
