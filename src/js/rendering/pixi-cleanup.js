// ============================================================================
// PIXI CLEANUP FUNCTIONS
// Functions for cleaning up PixiJS sprites and layers
// ============================================================================

// Dependencies that will be injected
let pixiLayers = {};
let pixiPools = {};
let bgTileGetters = {};

export function registerPixiCleanupDependencies(dependencies) {
    pixiLayers = { ...pixiLayers, ...dependencies.layers };
    pixiPools = { ...pixiPools, ...dependencies.pools };
    bgTileGetters = { ...bgTileGetters, ...dependencies.bgTileGetters };
}

/**
 * Filter array with Pixi cleanup
 * Removes elements that don't pass the keep function and properly cleans up their Pixi sprites
 */
export function filterArrayWithPixiCleanup(arr, keepFn) {
    if (!arr || arr.length === 0) return arr;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        if (!obj) continue;
        if (keepFn(obj)) arr[w++] = obj;
        else pixiCleanupObject(obj);
    }
    arr.length = w;
    return arr;
}

// Import pixiCleanupObject from cleanup-utils - circular dependency workaround
// We'll inject it as a dependency
let pixiCleanupObject;

export function setPixiCleanupObject(fn) {
    pixiCleanupObject = fn;
}

/**
 * Reset all Pixi overlay sprites and pools
 * Clears all layers and resets sprite pools for a fresh game state
 */
export function resetPixiOverlaySprites() {
    const {
        pixiNebulaLayer,
        pixiCaveGridLayer,
        pixiCaveGridSprite,
        pixiStarLayer,
        pixiAsteroidLayer,
        pixiPickupLayer,
        pixiPlayerLayer,
        pixiBaseLayer,
        pixiEnemyLayer,
        pixiBossLayer,
        pixiVectorLayer,
        pixiBulletLayer,
        pixiParticleLayer
    } = pixiLayers;

    const { pixiBulletSpritePool, pixiParticleSpritePool, pixiEnemySpritePools, pixiPickupSpritePool, pixiAsteroidSpritePool, pixiStarSpritePool } = pixiPools;

    const { getNebulaTiles } = bgTileGetters;

    // Nebula is a persistent screen-space backdrop; keep it mounted.
    const nebulaTiles = getNebulaTiles ? getNebulaTiles() : null;
    if (pixiNebulaLayer && nebulaTiles && nebulaTiles.length) {
        for (const t of nebulaTiles) {
            if (t && t.spr && !t.spr.parent) pixiNebulaLayer.addChild(t.spr);
        }
    }
    // Cave grid is a persistent screen-space layer; keep it mounted.
    if (pixiCaveGridLayer && pixiCaveGridSprite && !pixiCaveGridSprite.parent) pixiCaveGridLayer.addChild(pixiCaveGridSprite);
    if (pixiStarLayer) pixiStarLayer.removeChildren();
    if (pixiAsteroidLayer) pixiAsteroidLayer.removeChildren();
    if (pixiPickupLayer) pixiPickupLayer.removeChildren();
    if (pixiPlayerLayer) pixiPlayerLayer.removeChildren();
    if (pixiBaseLayer) pixiBaseLayer.removeChildren();
    if (pixiEnemyLayer) pixiEnemyLayer.removeChildren();
    if (pixiBossLayer) pixiBossLayer.removeChildren();
    if (pixiVectorLayer) pixiVectorLayer.removeChildren();
    if (pixiBulletLayer) pixiBulletLayer.removeChildren();
    if (pixiParticleLayer) pixiParticleLayer.removeChildren();
    if (pixiBulletSpritePool) pixiBulletSpritePool.length = 0;
    if (pixiParticleSpritePool) pixiParticleSpritePool.length = 0;
    try {
        const keys = pixiEnemySpritePools ? Object.keys(pixiEnemySpritePools) : [];
        for (const k of keys) pixiEnemySpritePools[k].length = 0;
    } catch (e) { }
    if (pixiPickupSpritePool) pixiPickupSpritePool.length = 0;
    if (pixiAsteroidSpritePool) pixiAsteroidSpritePool.length = 0;
    if (pixiStarSpritePool) pixiStarSpritePool.length = 0;
}

/**
 * Cleanup extra children from Pixi world root
 * Removes any children from the world root that aren't in the keep set
 */
export function cleanupPixiWorldRootExtras() {
    const { pixiWorldRoot } = pixiLayers;

    if (!pixiWorldRoot) return;
    const keep = new Set();
    const {
        pixiAsteroidLayer,
        pixiPickupLayer,
        pixiPlayerLayer,
        pixiBaseLayer,
        pixiEnemyLayer,
        pixiBossLayer,
        pixiVectorLayer,
        pixiBulletLayer,
        pixiParticleLayer
    } = pixiLayers;

    if (pixiAsteroidLayer) keep.add(pixiAsteroidLayer);
    if (pixiPickupLayer) keep.add(pixiPickupLayer);
    if (pixiPlayerLayer) keep.add(pixiPlayerLayer);
    if (pixiBaseLayer) keep.add(pixiBaseLayer);
    if (pixiEnemyLayer) keep.add(pixiEnemyLayer);
    if (pixiBossLayer) keep.add(pixiBossLayer);
    if (pixiVectorLayer) keep.add(pixiVectorLayer);
    if (pixiBulletLayer) keep.add(pixiBulletLayer);
    if (pixiParticleLayer) keep.add(pixiParticleLayer);

    for (let i = pixiWorldRoot.children.length - 1; i >= 0; i--) {
        const child = pixiWorldRoot.children[i];
        if (!keep.has(child)) {
            try { if (child.parent) child.parent.removeChild(child); } catch (e) { }
            try { if (typeof child.destroy === 'function') child.destroy({ children: true }); } catch (e) { }
        }
    }
}
