// ============================================================================
// GAME HELPER FUNCTIONS
// Miscellaneous helper functions for game logic
// ============================================================================

import { GameContext } from "../core/game-context.js";
import { Explosion } from "../entities/index.js";
import { getElapsedGameTime } from "../core/game-context.js";

// Dependencies that will be injected
let deps = {};
let unlockLevelRef = null;
let endGameRef = null;

export function registerGameHelperDependencies(dependencies) {
  deps = { ...deps, ...dependencies };
  if (dependencies.unlockLevel) unlockLevelRef = dependencies.unlockLevel;
  if (dependencies.endGame) endGameRef = dependencies.endGame;
}

/**
 * Toggle music and update the DOM button
 */
export function toggleMusic(audioToggleMusic) {
  const enabled = audioToggleMusic(GameContext.gameActive, GameContext.gamePaused);
  const btn = document.getElementById("music-btn");
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

  // Update background sprites to viewport size (1920x1080), not internal resolution
  // They will be scaled to internal resolution by pixiScreenRoot.scale in the game loop
  // This ensures the game world viewport is always 1920x1080 regardless of internal resolution
  const viewportW = 1920; // Fixed viewport size
  const viewportH = 1080;

  if (pixiCaveGridSprite) {
    pixiCaveGridSprite.width = viewportW;
    pixiCaveGridSprite.height = viewportH;
  }
  const starTiles = getStarTiles();
  if (starTiles && starTiles.length) {
    for (const t of starTiles) {
      if (!t || !t.spr) continue;
      t.spr.width = viewportW;
      t.spr.height = viewportH;
    }
  }
  const nebulaTiles = getNebulaTiles();
  if (nebulaTiles && nebulaTiles.length) {
    for (const t of nebulaTiles) {
      if (!t || !t.spr) continue;
      t.spr.width = viewportW;
      t.spr.height = viewportH;
    }
  }
  initStars(width, height);
}

/**
 * Handle space station destroyed
 * Triggers explosion, awards coins/nuggets directly, unlocks warp gate
 */
export function handleSpaceStationDestroyed() {
  const {
    playSound,
    spawnLargeExplosion,
    spawnParticles,
    showOverlayMessage,
    pixiCleanupObject,
    awardCoinsInstant,
    awardNuggetsInstant,
    stopMusic
  } = deps;

  if (!GameContext.spaceStation) return;
  const sx = GameContext.spaceStation.pos.x;
  const sy = GameContext.spaceStation.pos.y;
  playSound("base_explode");

  spawnLargeExplosion(sx, sy, 3.5);
  spawnParticles(sx, sy, 200, "#fff");
  // Award coins directly: 50 coins * 10 value = 500 total
  if (awardCoinsInstant) awardCoinsInstant(500, { noSound: false, sound: "coin" });
  // Award nuggets directly: 25 nuggets
  if (awardNuggetsInstant) awardNuggetsInstant(25, { noSound: false, sound: "coin" });
  pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;

  // Level 1: don't end level; warp opens in 2 minutes, player goes to warp boss
  if (GameContext.currentLevel === 1) {
    GameContext.caveWarpCountdownAt = Date.now() + 120000; // 2 minutes
    showOverlayMessage("WARP OPENING IN 2 MINUTES - BOSS AHEAD", "#f80", 5000);
    GameContext.score += 50000;
    return;
  }

  showOverlayMessage("SPACE STATION DESTROYED - WARP SIGNAL IN 30s", "#f80", 5000);
  setTimeout(() => {
    GameContext.warpGateUnlocked = true;
    // Reset suppression when warp gate unlocks to ensure it's usable
    GameContext.suppressWarpGateUntil = 0;
  }, 30000);
  GameContext.score += 50000;
  if (GameContext.pendingStations > 0 && !GameContext.sectorTransitionActive) {
    GameContext.nextSpaceStationTime = Date.now() + 7000;
  }
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
    if (obj instanceof Explosion && typeof obj.cleanup === "function") {
      obj.cleanup(window.cachedParticleRes);
    } else if (obj._poolType === "bullet" && obj.sprite && pixiBulletSpritePool) {
      destroyBulletSprite(obj);
    } else {
      pixiCleanupObject(obj);
    }
  }
  arr.length = alive;
}
