import {
  pixiAsteroidSpritePool,
  pixiBulletSpritePool,
  pixiHealthSpritePool,
  pixiParticleSpritePool,
  pixiPickupSpritePool
} from "../rendering/pixi-setup.js";
import { releasePixiEnemySprite, releasePixiSprite } from "../rendering/sprite-pools.js";

/**
 * @param {Object} bullet
 * @returns {void}
 */
export function destroyBulletSprite(bullet) {
  if (bullet && bullet.sprite && pixiBulletSpritePool) {
    releasePixiSprite(pixiBulletSpritePool, bullet.sprite);
    bullet.sprite = null;
  }
}

/**
 * @param {Object} obj
 * @returns {void}
 */
export function pixiCleanupObject(obj) {
  if (!obj) return;
  if (obj._pixiIsCleaning) return;
  obj._pixiIsCleaning = true;

  if (obj._pixiContainer) {
    try {
      obj._pixiContainer.destroy({ children: true });
    } catch (e) {}
    obj._pixiContainer = null;
  }
  if (obj.sprite) {
    if (obj._pixiPool === "enemy") releasePixiEnemySprite(obj.sprite);
    else if (obj._pixiPool === "pickup" && pixiPickupSpritePool)
      releasePixiSprite(pixiPickupSpritePool, obj.sprite);
    else if (obj._pixiPool === "health" && pixiHealthSpritePool)
      releasePixiSprite(pixiHealthSpritePool, obj.sprite);
    else if (obj._pixiPool === "asteroid" && pixiAsteroidSpritePool)
      releasePixiSprite(pixiAsteroidSpritePool, obj.sprite);
    else if (obj._poolType === "bullet" && pixiBulletSpritePool)
      releasePixiSprite(pixiBulletSpritePool, obj.sprite);
    else if (obj._poolType === "particle" && pixiParticleSpritePool)
      releasePixiSprite(pixiParticleSpritePool, obj.sprite);
    obj.sprite = null;
  }

  const keys = Object.keys(obj);
  for (let k of keys) {
    if (k.startsWith("_pixi") && obj[k] && k !== "_pixiIsCleaning") {
      const val = obj[k];
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item && typeof item.destroy === "function") {
            try {
              if (!item.destroyed) {
                item.visible = false;
                if (typeof item.clear === "function") item.clear();
                if (item.parent) item.parent.removeChild(item);
                item.destroy(true);
              }
            } catch (e) {
              console.warn("[CLEANUP] Error destroying item:", e);
            }
          }
        });
      } else if (val && typeof val.destroy === "function") {
        try {
          if (!val.destroyed) {
            val.visible = false;
            if (typeof val.clear === "function") val.clear();
            if (val.parent) val.parent.removeChild(val);
            val.destroy(true);
          }
        } catch (e) {
          console.warn("[CLEANUP] Error destroying val:", e);
        }
      }
      obj[k] = null;
    }
  }

  obj._pixiIsCleaning = false;
}

/**
 * @param {Array} arr
 * @returns {void}
 */
export function clearArrayWithPixiCleanup(arr) {
  if (!arr || arr.length === 0) return;
  for (let i = 0; i < arr.length; i++) {
    const obj = arr[i];
    if (obj) {
      obj.dead = true;
      pixiCleanupObject(obj);
    }
  }
  arr.length = 0;
}
