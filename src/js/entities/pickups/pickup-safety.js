/**
 * Pickup Safety Cleanup Module
 * Ensures pickup entities properly clean up their Pixi graphics
 * Prevents visual artifacts when pickups are collected
 */

import { pixiCleanupObject } from '../../rendering/sprite-pools.js';

/**
 * Force cleanup of a pickup entity
 * Ensures sprite is hidden and released properly
 * 
 * @param {Object} pickup - The pickup entity
 * @param {string} poolName - Name of the sprite pool (for logging)
 */
export function forcePickupCleanup(pickup, poolName) {
    if (!pickup) {
        console.warn(`[${poolName} SAFETY] Attempting to cleanup null pickup`);
        return false;
    }
    
    // Set dead flag
    pickup.dead = true;
    
    // Hide sprite if exists
    if (pickup.sprite) {
        pickup.sprite.visible = false;
    }
    
    // Release sprite to pool
    if (pickup.sprite) {
        const poolName = pickup._pixiPool || 'unknown';
        try {
            if (poolName === 'pickup' && typeof pixiPickupSpritePool !== 'undefined') {
                pixiPickupSpritePool.push(pickup.sprite);
            } else if (poolName === 'particle' && typeof pixiParticleSpritePool !== 'undefined') {
                pixiParticleSpritePool.push(pickup.sprite);
            } else if (poolName === 'enemy' && typeof pixiEnemySpritePools !== 'undefined') {
                const enemyPool = pixiEnemySpritePools[pickup._enemyType] || pixiEnemySpritePools.default;
                releasePixiSprite(null, pickup.sprite);
            }
            console.log(`[${poolName}] Released sprite at (${Math.round(pickup.pos.x)}, ${Math.round(pickup.pos.y)})`);
        } catch (e) {
            console.warn(`[${poolName}] Failed to release sprite:`, e);
        }
        pickup.sprite = null;
    }
    
    // Try fallback cleanup
    try {
        pixiCleanupObject(pickup);
    } catch (e) {
        console.warn(`[${poolName}] Fallback cleanup failed:`, e);
    }
    
    return true;
}

/**
 * Check health of all pickup arrays
 * Returns statistics about pickup system state
 * 
 * @param {Array} coins - Coin array
 * @param {Array} nuggets - SpaceNugget array
 * @param {Array} powerups - PowerUp array
 */
export function checkPickupHealth(coins, nuggets, powerups) {
    const deadCoins = coins.filter(c => c.dead).length;
    const deadNuggets = nuggets.filter(n => n.dead).length;
    const deadPowerups = powerups.filter(p => p.dead).length;
    
    const totalDead = deadCoins + deadNuggets + deadPowerups;
    const totalAlive = coins.length + nuggets.length + powerups.length - totalDead;
    
    const issues = [];
    
    // Check for accumulation of dead items
    if (deadCoins > 10) {
        issues.push(`⚠️ ${deadCoins} dead coins (potential leak)`);
    }
    if (deadNuggets > 10) {
        issues.push(`⚠️ ${deadNuggets} dead nuggets (potential leak)`);
    }
    if (deadPowerups > 10) {
        issues.push(`⚠️ ${deadPowerups} dead powerups (potential leak)`);
    }
    
    // Check for total pickup count
    const totalPickups = coins.length + nuggets.length + powerups.length;
    if (totalPickups > 100) {
        issues.push(`⚠️ ${totalPickups} total pickups (high count)`);
    }
    
    return {
        healthy: issues.length === 0,
        totalDead,
        totalAlive,
        deadCoins,
        deadNuggets,
        deadPowerups,
        totalPickups,
        issues
    };
}

/**
 * Force cleanup of all dead pickups
 * Similar to aggressive explosion cleanup
 * 
 * @param {Array} coins - Coin array
 * @param {Array} nuggets - SpaceNugget array
 * @param {Array} powerups - PowerUp array
 */
export function forcePickupCleanupAll(coins, nuggets, powerups) {
    let totalCleaned = 0;
    
    const cleanupArray = (arr, name) => {
        for (let i = arr.length - 1; i >= 0; i--) {
            const item = arr[i];
            if (item && item.dead) {
                const removed = forcePickupCleanup(item, name);
                if (removed) {
                    arr.splice(i, 1);
                    i--; // Adjust index
                    totalCleaned++;
                }
            }
        }
    };
    
    cleanupArray(coins, 'Coin');
    cleanupArray(nuggets, 'SpaceNugget');
    cleanupArray(powerups, 'HealthPowerUp');
    
    console.log(`[PICKUP SAFETY] Cleaned ${totalCleaned} dead pickups`);
    return totalCleaned;
}

/**
 * Check if pickup arrays have leaks
 * Returns diagnostic information
 */
export function detectPickupLeaks(coins, nuggets, powerups) {
    const result = checkPickupHealth(coins, nuggets, powerups);
    
    return {
        hasLeak: !result.healthy,
        totalDead: result.totalDead,
        totalAlive: result.totalAlive,
        totalPickups: result.totalPickups,
        issues: result.issues,
        recommendations: result.issues.length > 0 ? 'Run forcePickupCleanupAll()' : 'No issues detected'
    };
}









