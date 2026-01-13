// ============================================================================
// GAME HELPER FUNCTIONS
// Miscellaneous helper functions for game logic
// ============================================================================

import { GameContext } from '../core/game-context.js';
import { Explosion, Coin, SpaceNugget } from '../entities/index.js';

// Dependencies that will be injected
let deps = {};

export function registerGameHelperDependencies(dependencies) {
    deps = { ...deps, ...dependencies };
}

/**
 * Toggle music and update the DOM button
 */
export function toggleMusic(audioToggleMusic) {
    const enabled = audioToggleMusic(GameContext.gameActive, GameContext.gamePaused);
    const btn = document.getElementById('music-btn');
    if (btn) btn.innerText = enabled ? "MUSIC: ON" : "MUSIC: OFF";
}

/**
 * Handle window resize
 * Updates minimap and background sprites
 */
export function resize(
    minimapCanvas,
    pixiCaveGridSprite,
    internalWidth,
    internalHeight,
    width,
    height,
    getStarTiles,
    getNebulaTiles,
    initStars
) {
    // CRITICAL: Do NOT change canvas size - keep internal resolution fixed
    // Canvas size is set via setupCanvasResolution() based on internal resolution
    // CSS scaling (set in setupCanvasResolution) handles visual scaling to window

    // Update minimap (fixed size, unaffected by resolution)
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;

    // CRITICAL: Do NOT resize PixiJS renderer - it stays at internal resolution
    // The CSS scaling (set in pixi-setup.js) handles visual scaling

    // Update background sprites to internal resolution
    if (pixiCaveGridSprite) {
        pixiCaveGridSprite.width = internalWidth;
        pixiCaveGridSprite.height = internalHeight;
    }
    const starTiles = getStarTiles();
    if (starTiles && starTiles.length) {
        for (const t of starTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalWidth;
            t.spr.height = internalHeight;
        }
    }
    const nebulaTiles = getNebulaTiles();
    if (nebulaTiles && nebulaTiles.length) {
        for (const t of nebulaTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalWidth;
            t.spr.height = internalHeight;
        }
    }
    initStars(width, height);
}

/**
 * Handle space station destroyed
 * Triggers explosion, drops coins/nuggets, unlocks warp gate
 */
export function handleSpaceStationDestroyed() {
    const { playSound, spawnLargeExplosion, spawnParticles, showOverlayMessage, pixiCleanupObject } = deps;

    if (!GameContext.spaceStation) return;
    const sx = GameContext.spaceStation.pos.x;
    const sy = GameContext.spaceStation.pos.y;
    playSound('base_explode');

    spawnLargeExplosion(sx, sy, 3.5);
    spawnParticles(sx, sy, 200, '#fff');
    for (let k = 0; k < 50; k++) GameContext.coins.push(new Coin(sx + (Math.random() - 0.5) * 200, sy + (Math.random() - 0.5) * 200, 10));
    for (let k = 0; k < 25; k++) GameContext.nuggets.push(new SpaceNugget(sx + (Math.random() - 0.5) * 220, sy + (Math.random() - 0.5) * 220, 1));
    showOverlayMessage("SPACE STATION DESTROYED - WARP SIGNAL IN 30s", '#f80', 5000);
    pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    setTimeout(() => {
        GameContext.warpGateUnlocked = true;
    }, 30000);
    GameContext.score += 50000;
    if (GameContext.pendingStations > 0 && !GameContext.sectorTransitionActive) GameContext.nextSpaceStationTime = Date.now() + 7000;
}

/**
 * Compact array by removing dead entities
 * Handles cleanup for explosions, bullets, and other entities
 */
export function compactArray(arr) {
    const { pixiBulletSpritePool, destroyBulletSprite, pixiCleanupObject } = deps;

    let alive = 0;
    for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        if (!obj) continue;
        if (!obj.dead) {
            arr[alive++] = obj;
            continue;
        }
        // Explosion-specific cleanup - release particle sprites
        if (obj instanceof Explosion && typeof obj.cleanup === 'function') {
            obj.cleanup(window.cachedParticleRes);
        }
        else if (obj._poolType === 'bullet' && obj.sprite && pixiBulletSpritePool) destroyBulletSprite(obj);
        else pixiCleanupObject(obj);
    }
    arr.length = alive;
}
