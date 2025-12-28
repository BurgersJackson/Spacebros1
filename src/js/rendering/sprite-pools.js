/**
 * Sprite Pool Management
 * Efficient sprite allocation and recycling for PixiJS.
 */

import { PIXI_SPRITE_POOL_MAX } from '../core/constants.js';
import {
    pixiBulletSpritePool,
    pixiParticleSpritePool,
    pixiEnemySpritePools,
    pixiPickupSpritePool,
    pixiAsteroidSpritePool,
    pixiTextureWhite
} from './pixi-setup.js';

/**
 * Allocate a sprite from a pool or create a new one.
 * @param {Array} pool - Sprite pool to allocate from
 * @param {PIXI.Container} layer - Layer to add sprite to
 * @param {PIXI.Texture} texture - Texture to use
 * @param {number|null} size - Size to set (width/height)
 * @param {number|Object} anchor - Anchor point
 * @returns {PIXI.Sprite|null}
 */
export function allocPixiSprite(pool, layer, texture = null, size = 2, anchor = 0.5) {
    if (!texture || !layer || !window.PIXI) return null;

    let spr = pool && pool.length > 0 ? pool.pop() : null;
    if (!spr) {
        spr = new PIXI.Sprite(texture);
    }

    spr.texture = texture;
    spr.tint = 0xffffff;
    spr.alpha = 1;
    spr.rotation = 0;
    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
    spr.scale.set(1);

    if (typeof anchor === 'number') {
        spr.anchor.set(anchor);
    } else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') {
        spr.anchor.set(anchor.x, anchor.y);
    } else if (Array.isArray(anchor) && anchor.length >= 2) {
        spr.anchor.set(anchor[0], anchor[1]);
    } else {
        spr.anchor.set(0.5);
    }

    spr.visible = true;
    if (size != null) spr.width = spr.height = size;
    if (!spr.parent) layer.addChild(spr);

    return spr;
}

/**
 * Release a sprite back to its pool.
 * @param {Array} pool - Pool to return sprite to
 * @param {PIXI.Sprite} spr - Sprite to release
 */
export function releasePixiSprite(pool, spr) {
    if (!spr) return;
    if (spr.parent) spr.parent.removeChild(spr);
    spr.visible = false;
    if (pool && pool.length < PIXI_SPRITE_POOL_MAX) {
        pool.push(spr);
    } else if (!pool) {
        console.warn('[PIXI] releasePixiSprite called with null pool!');
    }
}

/**
 * Destroy a bullet's sprite and return to pool.
 * @param {Object} bullet - Bullet object with sprite property
 */
export function destroyBulletSprite(bullet) {
    if (bullet && bullet.sprite && pixiBulletSpritePool) {
        releasePixiSprite(pixiBulletSpritePool, bullet.sprite);
        bullet.sprite = null;
    }
}

/**
 * Release an enemy sprite to its type-specific pool.
 * @param {PIXI.Sprite} spr - Enemy sprite
 */
export function releasePixiEnemySprite(spr) {
    if (!spr) return;
    const key = spr._pixiKey;
    const pool = (key && pixiEnemySpritePools && pixiEnemySpritePools[key])
        ? pixiEnemySpritePools[key]
        : null;
    if (pool) {
        releasePixiSprite(pool, spr);
    } else {
        releasePixiSprite(null, spr);
    }
}

/**
 * Clean up PixiJS resources for an object.
 * Handles containers, pooled sprites, and various entity types.
 * @param {Object} obj - Object to clean up
 */
export function pixiCleanupObject(obj) {
    if (!obj) return;

    // Non-pooled containers (player/bases/stations/etc)
    if (obj._pixiContainer) {
        try {
            obj._pixiContainer.destroy({ children: true });
        } catch (e) { }
        obj._pixiContainer = null;
    }

    // Common sprite cleanup (pooled sprites)
    if (obj.sprite) {
        if (obj._pixiPool === 'enemy') {
            releasePixiEnemySprite(obj.sprite);
        } else if (obj._pixiPool === 'pickup' && pixiPickupSpritePool) {
            releasePixiSprite(pixiPickupSpritePool, obj.sprite);
        } else if (obj._pixiPool === 'asteroid' && pixiAsteroidSpritePool) {
            releasePixiSprite(pixiAsteroidSpritePool, obj.sprite);
        } else if (obj._poolType === 'bullet' && pixiBulletSpritePool) {
            releasePixiSprite(pixiBulletSpritePool, obj.sprite);
        } else if (obj._poolType === 'particle' && pixiParticleSpritePool) {
            releasePixiSprite(pixiParticleSpritePool, obj.sprite);
        }
        obj.sprite = null;
    }

    // Enemy extras
    if (obj._shieldGraphics) {
        try { obj._shieldGraphics.destroy(); } catch (e) { }
        obj._shieldGraphics = null;
    }

    if (obj._healthBar) {
        try { obj._healthBar.destroy(); } catch (e) { }
        obj._healthBar = null;
    }
}

/**
 * Clear an array and cleanup PixiJS resources for each item.
 * @param {Array} arr - Array to clear
 */
export function clearArrayWithPixiCleanup(arr) {
    for (let i = 0; i < arr.length; i++) {
        pixiCleanupObject(arr[i]);
    }
    arr.length = 0;
}

/**
 * Get or create an enemy sprite pool for a specific key.
 * @param {string} key - Pool key (enemy type)
 * @returns {Array} Sprite pool
 */
export function getEnemySpritePool(key) {
    if (!pixiEnemySpritePools[key]) {
        pixiEnemySpritePools[key] = [];
    }
    return pixiEnemySpritePools[key];
}
