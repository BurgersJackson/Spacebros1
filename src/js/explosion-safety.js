/**
 * Explosion Safety Cleanup Module
 * Ensures explosions are properly cleaned up even if normal cleanup fails
 */

import { pixiCleanupObject } from './rendering/sprite-pools.js';

/**
 * Safety check that runs every frame to clean up dead explosions
 * This is a failsafe to prevent frozen/stuck particles
 * 
 * Called from main game loop after normal cleanup
 */
export function explosionSafetyCleanup(explosions, particleRes) {
    if (!explosions || !particleRes || !particleRes.pool) {
        return 0;
    }
    
    let cleanedCount = 0;
    let failedCount = 0;
    
    // Process backwards to avoid index issues when removing
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        
        // Skip if not an explosion or already handled
        if (!ex || !ex.dead || ex.cleaned) {
            continue;
        }
        
        // Try to cleanup if it hasn't been done
        if (!ex.cleaned && typeof ex.cleanup === 'function') {
            try {
                ex.cleanup(particleRes);
                cleanedCount++;
            } catch (e) {
                console.error('[EXPLOSION SAFETY] Failed to cleanup explosion:', e);
                failedCount++;
            }
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`[EXPLOSION SAFETY] Force-cleaned ${cleanedCount} dead explosions`);
    }
    
    if (failedCount > 0) {
        console.error(`[EXPLOSION SAFETY] Failed to cleanup ${failedCount} explosions`);
    }
    
    return cleanedCount;
}

/**
 * Aggressive cleanup for when explosion count grows too high
 * This indicates particles are leaking
 */
export function aggressiveExplosionCleanup(explosions, particleRes) {
    if (!explosions || explosions.length < 20) {
        return false; // Only cleanup if we have 20+ explosions
    }
    
    console.warn(`[AGGRESSIVE CLEANUP] Found ${explosions.length} explosions - likely particle leak`);
    
    let totalCleaned = 0;
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        
        if (!ex || ex.dead) {
            // Remove from array and cleanup
            explosions.splice(i, 1);
            
            if (typeof ex.cleanup === 'function') {
                try {
                    ex.cleanup(particleRes);
                    totalCleaned++;
                } catch (e) {
                    console.error('[AGGRESSIVE CLEANUP] Error:', e);
                }
            } else {
                // Fallback to pixiCleanupObject if cleanup method doesn't exist
                try {
                    pixiCleanupObject(ex);
                } catch (e) {
                    console.error('[AGGRESSIVE CLEANUP] Fallback error:', e);
                }
            }
            
            // Re-adjust index since we removed an element
            i--;
        }
    }
    
    console.log(`[AGGRESSIVE CLEANUP] Removed and cleaned ${totalCleaned} explosions`);
    return true;
}

/**
 * Check for explosion particle leaks
 */
export function checkExplosionHealth(explosions, maxSafeCount = 30) {
    if (!explosions) {
        return { healthy: true, count: 0, leaked: 0 };
    }
    
    const count = explosions.length;
    const activeCount = explosions.filter(e => !e.dead).length;
    
    if (count > maxSafeCount) {
        return {
            healthy: false,
            count,
            activeCount,
            leaked: count - activeCount,
            message: `⚠️ TOO MANY EXPLOSIONS (${count}, ${activeCount} active)`
        };
    }
    
    return {
        healthy: true,
        count,
        activeCount,
        leaked: 0,
        message: `✅ Explosion count healthy (${count}, ${activeCount} active)`
    };
}

