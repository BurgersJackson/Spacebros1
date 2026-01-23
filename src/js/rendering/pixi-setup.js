/**
 * PixiJS Setup & Layer Management
 * Initializes PixiJS application and creates rendering layers.
 */

import { USE_PIXI_OVERLAY, PIXI_SPRITE_POOL_MAX } from "../core/constants.js";

// --- PixiJS Application ---
export let pixiApp = null;
export let pixiWorldRoot = null; // Camera-transformed world space
export let pixiScreenRoot = null; // Screen space (no camera transform)

// --- Screen-space Background Layers ---
export let pixiNebulaLayer = null;
export let pixiStarLayer = null;
export let pixiStarTilingLayer = null;
export let pixiStarTiles = null;
export let pixiNebulaTiles = null;
export let pixiNebulaPaletteIdx = null;
export let pixiCaveGridLayer = null;
export let pixiCaveGridSprite = null;
export let pixiCaveGridTexture = null;

// --- World-space Layers ---
export let pixiAsteroidLayer = null;
export let pixiPickupLayer = null;
export let pixiPlayerLayer = null;
export let pixiBaseLayer = null;
export let pixiEnemyLayer = null;
export let pixiBossLayer = null;
export let pixiVectorLayer = null;
export let pixiBulletLayer = null;
export let pixiParticleLayer = null;

// --- Textures ---
export let pixiTextureWhite = null;
export const pixiBulletTextures = { glow: null, laser: null, square: null };

// --- Sprite Pools ---
export const pixiBulletSpritePool = [];
export const pixiParticleSpritePool = [];
export const pixiEnemySpritePools = Object.create(null);
export const pixiPickupSpritePool = [];
export const pixiAsteroidSpritePool = [];
export const pixiStarSpritePool = [];

/**
 * Initialize PixiJS application and all rendering layers.
 * @param {number} width - Internal render resolution width (fixed)
 * @param {number} height - Internal render resolution height (fixed)
 * @returns {boolean} True if PixiJS was initialized successfully
 */
export function initPixi(width, height) {
  if (!USE_PIXI_OVERLAY || !window.PIXI) {
    return false;
  }

  try {
    PIXI.settings.ROUND_PIXELS = true;
  } catch (e) {}

  // CRITICAL: Use fixed internal resolution, NOT window size
  // This ensures consistent rendering regardless of actual screen size
  pixiApp = new PIXI.Application({
    width: width, // Use internal resolution width
    height: height, // Use internal resolution height
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  });

  try {
    pixiApp.renderer.roundPixels = true;
  } catch (e) {}
  // Render manually in main loop to avoid double work
  try {
    pixiApp.stop();
  } catch (e) {}

  // CRITICAL: Set canvas to fill screen and stretch in fullscreen
  pixiApp.view.style.position = "absolute";
  pixiApp.view.style.top = "0";
  pixiApp.view.style.left = "0";
  pixiApp.view.style.pointerEvents = "none";
  // Pixi canvas renders game objects (asteroids, ships, etc.)
  pixiApp.view.style.zIndex = "20";
  pixiApp.view.style.width = "100vw";
  pixiApp.view.style.height = "100vh";
  pixiApp.view.style.maxWidth = "none";
  pixiApp.view.style.maxHeight = "none";

  document.body.appendChild(pixiApp.view);

  pixiTextureWhite = PIXI.Texture.WHITE;
  try {
    pixiApp.stage.eventMode = "none";
  } catch (e) {}

  // Create root containers
  pixiScreenRoot = new PIXI.Container();
  pixiWorldRoot = new PIXI.Container();
  pixiApp.stage.addChild(pixiScreenRoot);
  pixiApp.stage.addChild(pixiWorldRoot);

  // Create bullet textures
  pixiBulletTextures.glow = makeGlowTexture();
  pixiBulletTextures.laser = makeLaserTexture();
  pixiBulletTextures.square = makeSquareTexture();

  // Create screen-space layers
  pixiNebulaLayer = new PIXI.Container();
  pixiCaveGridLayer = new PIXI.Container();
  pixiStarLayer = new PIXI.ParticleContainer(8000, {
    position: true,
    tint: true,
    scale: true,
    alpha: true
  });
  pixiStarTilingLayer = new PIXI.Container();

  pixiScreenRoot.addChild(pixiNebulaLayer);
  pixiScreenRoot.addChild(pixiCaveGridLayer);
  pixiScreenRoot.addChild(pixiStarTilingLayer);
  pixiScreenRoot.addChild(pixiStarLayer);

  // Create world-space layers
  pixiAsteroidLayer = new PIXI.Container();
  pixiPickupLayer = new PIXI.ParticleContainer(6000, {
    position: true,
    rotation: true,
    tint: true,
    scale: true,
    alpha: true
  });
  pixiPlayerLayer = new PIXI.Container();
  pixiBaseLayer = new PIXI.Container();
  pixiEnemyLayer = new PIXI.Container();
  pixiBossLayer = new PIXI.Container();
  pixiVectorLayer = new PIXI.Container();
  pixiBulletLayer = new PIXI.ParticleContainer(15000, {
    position: true,
    rotation: true,
    tint: true,
    scale: true,
    alpha: true
  });
  pixiParticleLayer = new PIXI.ParticleContainer(20000, {
    position: true,
    tint: true,
    scale: true,
    alpha: true
  });

  pixiWorldRoot.addChild(pixiAsteroidLayer);
  pixiWorldRoot.addChild(pixiPickupLayer);
  pixiWorldRoot.addChild(pixiPlayerLayer);
  pixiWorldRoot.addChild(pixiBaseLayer);
  pixiWorldRoot.addChild(pixiEnemyLayer);
  pixiWorldRoot.addChild(pixiBossLayer);
  pixiWorldRoot.addChild(pixiVectorLayer);
  pixiWorldRoot.addChild(pixiBulletLayer);
  pixiWorldRoot.addChild(pixiParticleLayer);

  // Create cave grid
  initCaveGrid(width, height);

  return true;
}

/**
 * Create glow bullet texture.
 */
function makeGlowTexture() {
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff, 0.16);
  g.drawCircle(0, 0, 12);
  g.beginFill(0xffffff, 0.6);
  g.drawCircle(0, 0, 7);
  g.beginFill(0xffffff, 1);
  g.drawCircle(0, 0, 4);
  const tex = pixiApp.renderer.generateTexture(g);
  g.destroy(true);
  return tex;
}

/**
 * Create laser bullet texture.
 */
function makeLaserTexture() {
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff, 0.18);
  g.drawRoundedRect(-20, -4, 40, 8, 4);
  g.beginFill(0xffffff, 0.65);
  g.drawRoundedRect(-16, -3, 32, 6, 3);
  g.beginFill(0xffffff, 1);
  g.drawRoundedRect(-14, -2, 28, 4, 2);
  const tex = pixiApp.renderer.generateTexture(g);
  g.destroy(true);
  return tex;
}

/**
 * Create square bullet texture.
 */
function makeSquareTexture() {
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff, 0.22);
  g.drawRoundedRect(-6, -6, 12, 12, 2);
  g.beginFill(0xffffff, 0.6);
  g.drawRoundedRect(-5, -5, 10, 10, 2);
  g.beginFill(0xffffff, 1);
  g.drawRoundedRect(-4, -4, 8, 8, 2);
  const tex = pixiApp.renderer.generateTexture(g);
  g.destroy(true);
  return tex;
}

/**
 * Initialize cave grid tiling texture.
 */
function initCaveGrid(width, height) {
  const grid = 420;
  const minor = 210;
  const g = new PIXI.Graphics();

  // Minor grid lines
  g.lineStyle(2, 0x00ffff, 0.05);
  g.moveTo(0, 0);
  g.lineTo(0, grid);
  g.moveTo(minor, 0);
  g.lineTo(minor, grid);
  g.moveTo(0, 0);
  g.lineTo(grid, 0);
  g.moveTo(0, minor);
  g.lineTo(grid, minor);

  // Major lines on tile edges
  g.lineStyle(3, 0x00ffff, 0.1);
  g.moveTo(0, 0);
  g.lineTo(grid, 0);
  g.moveTo(0, 0);
  g.lineTo(0, grid);

  pixiCaveGridTexture = pixiApp.renderer.generateTexture(g);
  try {
    pixiCaveGridTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    pixiCaveGridTexture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
  } catch (e) {}

  try {
    g.destroy(true);
  } catch (e) {}

  pixiCaveGridSprite = new PIXI.TilingSprite(
    pixiCaveGridTexture,
    width > 0 ? width : 1,
    height > 0 ? height : 1
  );
  pixiCaveGridSprite.alpha = 1;
  pixiCaveGridLayer.addChild(pixiCaveGridSprite);
  pixiCaveGridLayer.visible = false;
}

/**
 * Update world root transform for camera.
 */
export function updatePixiCamera(camX, camY, zoom, screenWidth, screenHeight) {
  if (!pixiWorldRoot) return;

  pixiWorldRoot.scale.set(zoom);
  pixiWorldRoot.position.set(screenWidth / 2 - camX * zoom, screenHeight / 2 - camY * zoom);
}

/**
 * Render PixiJS frame.
 */
export function renderPixi() {
  if (pixiApp && pixiApp.renderer) {
    pixiApp.renderer.render(pixiApp.stage);
  }
}

/**
 * Clear all sprite pools and layers.
 */
export function clearPixiPools() {
  if (pixiBulletLayer) pixiBulletLayer.removeChildren();
  if (pixiParticleLayer) pixiParticleLayer.removeChildren();

  pixiBulletSpritePool.length = 0;
  pixiParticleSpritePool.length = 0;

  try {
    const keys = Object.keys(pixiEnemySpritePools);
    for (const k of keys) pixiEnemySpritePools[k].length = 0;
  } catch (e) {}

  pixiPickupSpritePool.length = 0;
  pixiAsteroidSpritePool.length = 0;
  pixiStarSpritePool.length = 0;
}

/**
 * Check if PixiJS is available and initialized.
 */
export function isPixiReady() {
  return pixiApp !== null && pixiWorldRoot !== null;
}
