/**
 * PixiJS Rendering Context
 *
 * This module provides a centralized access point for all PixiJS rendering resources.
 * Entity classes can import from this module to get access to layers, pools, textures,
 * and utility functions without needing complex dependency injection.
 */

// ============================================================================
// RE-EXPORTS FROM PIXI-SETUP (Pools only)
// Note: Layers are defined locally here because main.js uses its own internal
// initialization instead of pixi-setup.js's initPixi().
// ============================================================================

export {
  // Sprite pools
  pixiBulletSpritePool,
  pixiParticleSpritePool,
  pixiEnemySpritePools,
  pixiPickupSpritePool,
  pixiAsteroidSpritePool,
  pixiStarSpritePool,

  // Functions
  initPixi,
  updatePixiCamera,
  renderPixi,
  clearPixiPools,
  isPixiReady
} from "./pixi-setup.js";

// ============================================================================
// RE-EXPORTS FROM SPRITE-POOLS (Sprite allocation/cleanup utilities)
// ============================================================================

export {
  allocPixiSprite,
  releasePixiSprite,
  destroyBulletSprite,
  releasePixiEnemySprite,
  pixiCleanupObject,
  clearArrayWithPixiCleanup,
  getEnemySpritePool
} from "./sprite-pools.js";

// ============================================================================
// RE-EXPORTS FROM TEXTURE-LOADER (Textures & Anchors)
// ============================================================================

export {
  pixiTextures,
  pixiTextureAnchors,
  pixiTextureRotOffsets,
  pixiTextureBaseScales,
  pixiTextureScaleToRadius,
  loadAllTextures
} from "./texture-loader.js";

// ============================================================================
// MUTABLE RENDERING STATE (Updated each frame by main.js)
// ============================================================================

/** Current interpolation alpha (0-1) for smooth rendering between physics ticks */
let _renderAlpha = 1;

/** Asteroid images for canvas fallback */
let _asteroidImages = [];

/** Indestructible asteroid image for canvas fallback */
let _asteroidIndestructibleImage = null;

/** Whether external asteroid textures are loaded */
let _asteroidTexturesExternalReady = false;

/** Whether indestructible asteroid texture is loaded */
let _asteroidIndestructibleTextureReady = false;

// ============================================================================
// MUTABLE LAYERS & APP (Set by main.js initialization)
// ============================================================================

export let pixiApp = null;
export let pixiWorldRoot = null;
export let pixiScreenRoot = null;

export let pixiNebulaLayer = null;
export let pixiStarLayer = null;
export let pixiStarTilingLayer = null;
export let pixiCaveGridLayer = null;
export let pixiCaveGridSprite = null;

export let pixiAsteroidLayer = null;
export let pixiPickupLayer = null;
export let pixiPlayerLayer = null;
export let pixiBaseLayer = null;
export let pixiEnemyLayer = null;
export let pixiBossLayer = null;
export let pixiVectorLayer = null;
export let pixiBulletLayer = null;
export let pixiParticleLayer = null;
export let pixiTextureWhite = null;

export let pixiParticleSmokeTexture = null;
export let pixiParticleWarpTexture = null;

// ============================================================================
// GETTERS
// ============================================================================

export function getRenderAlpha() {
  return _renderAlpha;
}

export function getAsteroidImages() {
  return _asteroidImages;
}

export function getAsteroidIndestructibleImage() {
  return _asteroidIndestructibleImage;
}

export function isAsteroidTexturesReady() {
  return _asteroidTexturesExternalReady;
}

export function isAsteroidIndestructibleTextureReady() {
  return _asteroidIndestructibleTextureReady;
}

// ============================================================================
// SETTERS - Called by main.js to update state
// ============================================================================

/**
 * Update the render interpolation alpha.
 */
export function setRenderAlpha(alpha) {
  _renderAlpha = alpha;
}

/**
 * Set asteroid canvas fallback images.
 */
export function setAsteroidImages(images) {
  _asteroidImages = images;
}

/**
 * Set indestructible asteroid canvas fallback image.
 */
export function setAsteroidIndestructibleImage(image) {
  _asteroidIndestructibleImage = image;
}

/**
 * Set asteroid textures ready flag.
 */
export function setAsteroidTexturesReady(ready) {
  _asteroidTexturesExternalReady = ready;
}

/**
 * Set indestructible asteroid texture ready flag.
 */
export function setAsteroidIndestructibleTextureReady(ready) {
  _asteroidIndestructibleTextureReady = ready;
}

/**
 * Bulk set PixiJS application and layers from main.js
 * @param {Object} ctx - Object containing all layers and app refs
 */
export function setPixiContext(ctx) {
  if (ctx.pixiApp !== undefined) pixiApp = ctx.pixiApp;
  if (ctx.pixiWorldRoot !== undefined) pixiWorldRoot = ctx.pixiWorldRoot;
  if (ctx.pixiScreenRoot !== undefined) pixiScreenRoot = ctx.pixiScreenRoot;

  if (ctx.pixiAsteroidLayer !== undefined) pixiAsteroidLayer = ctx.pixiAsteroidLayer;
  if (ctx.pixiPickupLayer !== undefined) pixiPickupLayer = ctx.pixiPickupLayer;
  if (ctx.pixiPlayerLayer !== undefined) pixiPlayerLayer = ctx.pixiPlayerLayer;
  if (ctx.pixiBaseLayer !== undefined) pixiBaseLayer = ctx.pixiBaseLayer;
  if (ctx.pixiEnemyLayer !== undefined) pixiEnemyLayer = ctx.pixiEnemyLayer;
  if (ctx.pixiBossLayer !== undefined) pixiBossLayer = ctx.pixiBossLayer;
  if (ctx.pixiVectorLayer !== undefined) pixiVectorLayer = ctx.pixiVectorLayer;
  if (ctx.pixiBulletLayer !== undefined) pixiBulletLayer = ctx.pixiBulletLayer;
  if (ctx.pixiParticleLayer !== undefined) pixiParticleLayer = ctx.pixiParticleLayer;

  if (ctx.pixiNebulaLayer !== undefined) pixiNebulaLayer = ctx.pixiNebulaLayer;
  if (ctx.pixiStarLayer !== undefined) pixiStarLayer = ctx.pixiStarLayer;
  if (ctx.pixiStarTilingLayer !== undefined) pixiStarTilingLayer = ctx.pixiStarTilingLayer;
  if (ctx.pixiCaveGridLayer !== undefined) pixiCaveGridLayer = ctx.pixiCaveGridLayer;
  if (ctx.pixiCaveGridSprite !== undefined) pixiCaveGridSprite = ctx.pixiCaveGridSprite;

  if (ctx.pixiTextureWhite !== undefined) pixiTextureWhite = ctx.pixiTextureWhite;
  if (ctx.pixiParticleSmokeTexture !== undefined)
    pixiParticleSmokeTexture = ctx.pixiParticleSmokeTexture;
  if (ctx.pixiParticleWarpTexture !== undefined)
    pixiParticleWarpTexture = ctx.pixiParticleWarpTexture;
}
