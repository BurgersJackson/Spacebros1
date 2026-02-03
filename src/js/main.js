// --- Module Imports ---
import {
  Vector,
  SpatialHash,
  _tempVec1,
  _tempVec2,
  closestPointOnSegment,
  resolveCircleSegment
} from "./core/math.js";
import { GameContext } from "./core/game-context.js";
import { globalProfiler } from "./core/profiler.js";
import { globalJitterMonitor } from "./core/jitter-monitor.js";
import { globalStaggeredCleanup, immediateCompactArray } from "./core/staggered-cleanup.js";
import {
  updateViewBounds,
  viewBounds,
  isInView,
  isInViewRadius,
  entityInView,
  bulletGrid,
  rebuildBulletGrid,
  distSq,
  distLessThan
} from "./core/performance.js";
import { colorToPixi } from "./rendering/colors.js";
import { initCanvasSetup } from "./rendering/canvas-setup.js";
import { initPixiOverlay } from "./rendering/pixi-init.js";
import {
  pixiTextures,
  pixiTextureAnchors,
  pixiTextureRotOffsets,
  pixiTextureBaseScales,
  pixiTextureScaleToRadius
} from "./rendering/texture-loader.js";
import {
  initTextureAssets,
  getPlayerHullExternalReady,
  getPlayerHullVectrexExternalReady,
  getSlackerHullExternalReady,
  getSlackerHullVectrexExternalReady
} from "./rendering/texture-manager.js";
import {
  initStars,
  updatePixiBackground,
  updatePixiCaveGrid,
  getStarTiles,
  getNebulaTiles,
  setStarTiles,
  setNebulaTiles
} from "./rendering/background-renderer.js";
import { drawMinimap } from "./rendering/minimap-renderer.js";
import {
  filterArrayWithPixiCleanup,
  resetPixiOverlaySprites,
  cleanupPixiWorldRootExtras,
  registerPixiCleanupDependencies,
  setPixiCleanupObject
} from "./rendering/pixi-cleanup.js";
import { Entity } from "./entities/Entity.js";
import {
  ZOOM_LEVEL,
  SIM_FPS,
  SIM_STEP_MS,
  SIM_MAX_STEPS_PER_FRAME,
  USE_PIXI_OVERLAY,
  BACKGROUND_MUSIC_URL,
  ENABLE_NEBULA,
  NEBULA_ALPHA,
  ENABLE_PROJECTILE_IMPACT_SOUNDS,
  PLAYER_SHIELD_RADIUS_SCALE
} from "./core/constants.js";
import {
  Explosion,
  WarpParticle,
  Coin,
  FloatingText,
  GoldNugget,
  HealthPowerUp,
  SpaceNugget,
  getOrCreateFloatingText
} from "./entities/index.js";
import * as Cave from "./entities/cave/index.js";
import {
  initAudio,
  startMusic,
  stopMusic,
  setMusicMode,
  playSound,
  playMp3Sfx,
  toggleMusic as audioToggleMusic,
  isMusicEnabled,
  setProjectileImpactSoundContext,
  musicEnabled,
  setMusicVolume,
  setSfxVolume,
  musicVolume,
  sfxVolume
} from "./audio/audio-manager.js";
import {
  pixiBulletSpritePool,
  pixiParticleSpritePool,
  pixiEnemySpritePools,
  pixiPickupSpritePool,
  pixiAsteroidSpritePool,
  pixiStarSpritePool
} from "./rendering/pixi-setup.js";
import {
  setRenderAlpha,
  setAsteroidImages,
  setAsteroidIndestructibleImage,
  setAsteroidTexturesReady,
  setAsteroidIndestructibleTextureReady,
  setPixiContext
} from "./rendering/pixi-context.js";
import { findSpawnPointRelative as findSpawnPointRelativeHelper } from "./utils/spawn-utils.js";
import {
  clearArrayWithPixiCleanup,
  destroyBulletSprite,
  pixiCleanupObject
} from "./utils/cleanup-utils.js";
import {
  toggleMusic as helperToggleMusic,
  resize as helperResize,
  handleSpaceStationDestroyed as helperHandleSpaceStationDestroyed,
  compactArray as helperCompactArray,
  registerGameHelperDependencies
} from "./utils/game-helpers.js";
import {
  initLevelSelection,
  registerLevelManagerDependencies,
  unlockLevel as levelManagerUnlockLevel,
  updatePauseMenuObjectives
} from "./systems/level-manager.js";
import { clearOverlayMessageTimeout, formatTime, showOverlayMessage } from "./utils/ui-helpers.js";
import {
  emitParticle,
  emitSmokeParticle,
  compactParticles,
  spawnParticles,
  spawnLightningArc,
  processLightningEffects,
  scheduleParticleBursts,
  processStaggeredParticleBursts,
  scheduleStaggeredBombExplosions,
  processStaggeredBombExplosions,
  spawnLargeExplosion,
  spawnFieryExplosion,
  spawnBossExplosion,
  spawnAsteroidExplosion,
  spawnSmoke,
  spawnBarrelSmoke
} from "./systems/particle-manager.js";
import {
  registerGameFlowDependencies,
  initGameFlow,
  endGame,
  killPlayer,
  startGame,
  shiftPausedTimers,
  togglePause,
  quitGame,
  returnToMainMenuFromDeath
} from "./systems/game-flow.js";
import {
  registerWorldHelperDependencies,
  checkDespawn,
  generateMap,
  rayCast,
  applyAOEDamageToPlayer
} from "./systems/world-helpers.js";
import {
  registerSectorFlowDependencies,
  startSectorTransition,
  completeSectorWarp,
  startCaveSector2,
  enterWarpMaze,
  enterVerticalScrollingZone,
  resetWarpState,
  resetCaveState,
  resetDungeon1State,
  resetVerticalScrollingState,
  enterDungeon1Internal as _enterDungeon1Internal
} from "./systems/sector-flow.js";
import { registerWorldSetupDependencies, setupGameWorld } from "./systems/world-setup.js";
import {
  registerMiniEventDependencies,
  updateMiniEventUI,
  clearMiniEvent,
  completeContract
} from "./systems/mini-event-manager.js";
import {
  SAVE_PREFIX,
  SAVE_LAST_KEY,
  applyPendingProfile as applyPendingProfileSystem,
  createNewProfile as createNewProfileRecord,
  deleteProfile as deleteProfileRecord,
  getProfileList as getProfileListSystem,
  listSaveSlots as listSaveSlotsSystem,
  saveGame as saveGameSystem,
  selectProfile as selectProfileRecord
} from "./systems/save-manager.js";
import {
  applyMetaUpgrades as applyMetaUpgradesSystem,
  depositMetaNuggets as depositMetaNuggetsSystem,
  getReturningFromModal as getReturningFromModalSystem,
  loadMetaProfile as loadMetaProfileSystem,
  resetMetaProfile as resetMetaProfileSystem,
  saveMetaProfile as saveMetaProfileSystem,
  setReturningFromModal as setReturningFromModalSystem
} from "./systems/meta-manager.js";
import {
  getArenaCountdownTimeLeft,
  isArenaCountdownActive,
  scheduleNextMiniEvent,
  scheduleNextRadiationStorm,
  scheduleNextShootingStar,
  setArenaCountdownTimeLeft,
  startArenaCountdown,
  stopArenaCountdown,
  updateArenaCountdownDisplay
} from "./systems/event-scheduler.js";
import {
  completeContract as completeContractSystem,
  registerContractHandlers,
  updateContract as updateContractSystem,
  updateContractUI as updateContractUISystem
} from "./systems/contract-manager.js";
import { applyUpgrade as applyUpgradeSystem } from "./systems/upgrade-manager.js";
import {
  registerHudDependencies,
  registerMenuDependencies,
  initMenuUi,
  toggleDebugButton,
  clearPixiUiText,
  hideDebugMenu,
  drawStationIndicator,
  drawDestroyerIndicator,
  drawWarpGateIndicator,
  drawContractIndicator,
  drawHealthPackIndicator,
  drawMiniEventIndicator,
  drawSlackerMouseLine,
  updateHealthUI,
  updateXpUI,
  updateWarpUI,
  updateTurboUI,
  updateContractUI,
  updateNuggetUI,
  updateInputSpeedUI,
  showLevelUpMenu,
  updateMetaUI,
  registerCrtFilterDependencies,
  initCrtFilterUI,
  isCrtFilterEnabled,
  toggleCrtFilter,
  disableCrtFilter,
  registerVectrexFilterDependencies,
  initVectrexFilterUI,
  isVectrexFilterEnabled,
  toggleVectrexFilter,
  disableVectrexFilter,
  showDeathScreen,
  registerDeathScreenDependencies
} from "./ui/index.js";
import { initDebugKeyboardShortcuts, registerDebugSpawnDependencies } from "./debug/index.js";
import {
  registerSettingsManagerDependencies,
  showAbortConfirmDialog,
  showSaveMenu,
  autoSaveToCurrentProfile,
  resetProfileStats,
  wipeProfiles,
  selectProfile,
  initProfileSystem,
  initSettingsMenu
} from "./ui/settings-manager.js";
import {
  registerSpawnManagerDependencies,
  spawnDrone,
  spawnExplorationCaches,
  spawnMiniEventRelative,
  spawnNewPinwheelRelative,
  spawnOneAsteroidRelative,
  spawnOneWarpAsteroidRelative,
  spawnSectorPOIs,
  registerInputDependencies,
  initInputListeners,
  updateGamepad,
  getActiveMenuElements,
  updateMenuVisuals,
  setMenuDebounce,
  registerCollisionDependencies,
  resolveEntityCollision,
  processBulletCollisions,
  checkWallCollision,
  registerGameLoopDependencies,
  registerGameLoopLogicDependencies,
  gameLoopLogic,
  startMainLoop
} from "./systems/index.js";
import {
  EnvironmentAsteroid,
  registerAsteroidDependencies,
  SectorPOI,
  DerelictShipPOI,
  DebrisFieldPOI,
  ExplorationCache,
  registerPoiDependencies,
  MiniEventDefendCache,
  registerMiniEventDefendCacheDependencies,
  ShootingStar,
  registerShootingStarDependencies,
  Enemy,
  registerEnemyDependencies,
  Pinwheel,
  registerPinwheelDependencies,
  Cruiser,
  registerCruiserDependencies,
  Flagship,
  registerFlagshipDependencies,
  SuperFlagshipBoss,
  registerSuperFlagshipDependencies,
  WarpSentinelBoss,
  registerWarpSentinelBossDependencies,
  WarpShieldDrone,
  registerWarpShieldDroneDependencies,
  SpaceStation,
  registerSpaceStationDependencies,
  Destroyer,
  registerDestroyerDependencies,
  Destroyer2,
  registerDestroyer2Dependencies,
  FinalBoss,
  registerFinalBossDependencies,
  Shockwave,
  registerShockwaveDependencies,
  Bullet,
  registerBulletDependencies,
  CruiserMineBomb,
  registerCruiserMineBombDependencies,
  FlagshipGuidedMissile,
  registerFlagshipGuidedMissileDependencies,
  Destroyer2GuidedMissile,
  ClusterBomb,
  registerClusterBombDependencies,
  NapalmZone,
  registerNapalmZoneDependencies,
  WarpBioPod,
  registerWarpBioPodDependencies,
  DungeonDrone,
  registerDungeonDroneDependencies,
  PsychicEcho,
  GravityWell,
  SoulDrainTether,
  NecroticHive,
  registerNecroticHiveDependencies,
  CerebralPsion,
  registerCerebralPsionDependencies,
  Fleshforge,
  registerFleshforgeDependencies,
  VortexMatriarch,
  registerVortexMatriarchDependencies,
  ChitinusPrime,
  registerChitinusPrimeDependencies,
  PsyLich,
  registerPsyLichDependencies,
  Drone,
  registerDroneDependencies,
  ContractBeacon,
  registerContractBeaconDependencies,
  GateRing,
  registerGateRingDependencies,
  WallTurret,
  registerWallTurretDependencies,
  WarpMazeZone,
  registerWarpMazeZoneDependencies,
  VerticalScrollingZone,
  registerVerticalScrollingZoneDependencies,
  Dungeon1Zone,
  registerDungeon1ZoneDependencies,
  RadiationStorm,
  registerRadiationStormDependencies,
  AnomalyZone,
  registerAnomalyZoneDependencies,
  Spaceship,
  registerSpaceshipDependencies
} from "./entities/index.js";

// --- Performance Debug (load after other modules) ---
import "./core/perf-debug.js";

// --- Globals ---
const mouseState = GameContext.mouseState;

// Pixi Textures (Global)
let pixiParticleSmokeTexture;
let pixiParticleWarpTexture;

// --- Base Classes (Vector and Entity imported from modules) ---

// toggleMusic wrapper that updates DOM button
function toggleMusic() {
  helperToggleMusic(audioToggleMusic);
}

// Game viewport size - always 1920x1080 to prevent seeing more game world than intended
const GAME_VIEWPORT_WIDTH = 1920;
const GAME_VIEWPORT_HEIGHT = 1080;

let width = GAME_VIEWPORT_WIDTH; // Game logic viewport (always 1920x1080)
let height = GAME_VIEWPORT_HEIGHT;
let internalWidth = 1920; // Canvas rendering resolution (can be higher for quality)
let internalHeight = 1080;

const {
  canvas,
  ctx,
  uiCanvas,
  uiCtx,
  minimapCanvas,
  setupCanvasResolution,
  initializeCanvasResolution,
  handleWindowResize
} = initCanvasSetup({
  getPixiApp: () => pixiApp,
  getPixiCaveGridSprite: () => pixiCaveGridSprite,
  getStarTiles,
  getNebulaTiles,
  initStars,
  setSize: (w, h) => {
    // Store internal resolution for canvas rendering quality
    internalWidth = w;
    internalHeight = h;
    // But keep game viewport fixed at 1920x1080 to prevent seeing more game world
    width = GAME_VIEWPORT_WIDTH;
    height = GAME_VIEWPORT_HEIGHT;
  },
  getSize: () => ({ width: internalWidth, height: internalHeight }) // Return internal resolution, not viewport
});

// PixiJS overlay (optional; falls back to Canvas if unavailable)
// Note: Pixi is rendered manually inside our main loop to avoid running a second render/ticker.
// USE_PIXI_OVERLAY imported from ./core/constants.js
// ENABLE_NEBULA and NEBULA_ALPHA imported from ./core/constants.js
let pixiApp = null;
let pixiWorldRoot = null; // camera-transformed world space
let pixiScreenRoot = null; // screen space (no camera transform)

// Screen-space background layers
let pixiNebulaLayer = null;
let pixiStarLayer = null;
let pixiStarTilingLayer = null; // preferred GameContext.starfield (1-2 tiling sprites)

// UI overlay layers (screen-space, for minimap and directional arrows)
let pixiUiOverlayLayer = null; // Container for all UI graphics
let pixiMinimapGraphics = null; // Graphics object for minimap
let pixiArrowsGraphics = null; // Graphics object for directional arrows

// World-space layers
let pixiAsteroidLayer = null;
let pixiPickupLayer = null;
let pixiPlayerLayer = null;
let pixiBaseLayer = null;
let pixiEnemyLayer = null;
let pixiBossLayer = null; // stations / non-enemy bosses
let pixiVectorLayer = null; // Graphics (shields/rings/etc)
let pixiBulletLayer = null;
let pixiParticleLayer = null;
let pixiTextureWhite = null;
let pixiCaveGridLayer = null; // screen-space
let pixiCaveGridSprite = null; // TilingSprite
let pixiParticleGlowTexture = null;

let pixiBulletTextures = { glow: null, laser: null, square: null, missile: null };

initTextureAssets();

const pixiInit = initPixiOverlay({
  usePixiOverlay: USE_PIXI_OVERLAY,
  getViewportSize: () => ({ width, height })
});
({
  pixiApp,
  pixiWorldRoot,
  pixiScreenRoot,
  pixiNebulaLayer,
  pixiStarLayer,
  pixiStarTilingLayer,
  pixiCaveGridLayer,
  pixiCaveGridSprite,
  pixiUiOverlayLayer,
  pixiMinimapGraphics,
  pixiArrowsGraphics,
  pixiAsteroidLayer,
  pixiPickupLayer,
  pixiPlayerLayer,
  pixiBaseLayer,
  pixiEnemyLayer,
  pixiBossLayer,
  pixiVectorLayer,
  pixiBulletLayer,
  pixiParticleLayer,
  pixiTextureWhite,
  pixiParticleGlowTexture,
  pixiParticleSmokeTexture,
  pixiParticleWarpTexture,
  pixiBulletTextures
} = pixiInit);

// Register pixi-cleanup dependencies
setPixiCleanupObject(pixiCleanupObject);
registerPixiCleanupDependencies({
  layers: {
    pixiWorldRoot,
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
  },
  pools: {
    pixiBulletSpritePool,
    pixiParticleSpritePool,
    pixiEnemySpritePools,
    pixiPickupSpritePool,
    pixiAsteroidSpritePool,
    pixiStarSpritePool
  },
  bgTileGetters: {
    getNebulaTiles
  }
});

// colorToPixi is now imported from ./rendering/colors.js

// Pixi cleanup functions now imported from ./rendering/pixi-cleanup.js

const overlayMessage = document.getElementById("overlay-message");
const fpsCounterEl = document.getElementById("fps-counter");

// Fixed-timestep simulation (decouple simulation from render FPS)
// SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME imported from ./core/constants.js
let simAccMs = 0;
let simNowMs = 0;
let simLastPerfAt = 0;
const getGameNowMs = () => (typeof simNowMs === "number" && simNowMs > 0 ? simNowMs : Date.now());
let renderAlpha = 1.0; // Global render interpolation alpha (0-1)
const suppressWarpInputUntil = 0;

GameContext.gameActive = false;
GameContext.gamePaused = false;
GameContext.canResumeGame = false; // Only true after quitting to menu from pause menu

// ZOOM_LEVEL imported from ./core/constants.js
GameContext.currentZoom = ZOOM_LEVEL;

// Camera Shake
GameContext.shakeTimer = 0;
GameContext.shakeMagnitude = 0;

// Inputs
const keys = GameContext.keys;

// Debug menu state
let debugMenuVisible = false;
const mouseScreen = GameContext.mouseScreen;
const mouseWorld = GameContext.mouseWorld;

// Gamepad State
const gpState = GameContext.gpState;

// Wrapper for resize function
function resize() {
  helperResize(
    minimapCanvas,
    pixiCaveGridSprite,
    internalWidth,
    internalHeight,
    width,
    height,
    getStarTiles,
    getNebulaTiles,
    initStars
  );
}

function handleSpaceStationDestroyed() {
  helperHandleSpaceStationDestroyed();
}

window.addEventListener("resize", resize);
resize();

// SpaceNugget imported from ./entities/index.js

// ============================================================================
// DUNGEON BOSS HELPER CLASSES
// ============================================================================

// DungeonDrone - Small protective drone for NecroticHive
// Orbits parent boss, fires at player, can be destroyed
// PsychicEcho - Fake sprite decoy for CerebralPsion
// Visual-only copy that cannot be damaged
// ============================================================================
// DUNGEON BOSS CLASSES
// ============================================================================

// --- Game State ---
GameContext.gameEnded = false;
const INTENSITY_BREAK_DURATION = 12000; // 12s
const GAME_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Game timer
GameContext.gameStartTime = null;
GameContext.pauseStartTime = null;
GameContext.pausedAccumMs = 0; // total paused time to subtract

// compactArray now imported from ./utils/game-helpers.js

// NOTE: snapshotWorldForWarp removed - we no longer save/restore level 1 state
// Level 1 is deleted when entering warp zone
// Level 1 is deleted when entering warp zone

// Instead, we transition directly to level 2 via sectorTransitionActive

// Companion Drones

registerContractHandlers({
  awardCoinsInstant,
  awardNuggetsInstant,
  findSpawnPointRelative,
  ContractBeacon,
  GateRing,
  SpaceNugget,
  Coin,
  showOverlayMessage,
  playSound,
  clearArrayWithPixiCleanup,
  filterArrayWithPixiCleanup
});

function findSpawnPointRelative(random = false, min = 1500, max = 2500) {
  return findSpawnPointRelativeHelper(GameContext, random, min, max);
}

let fromPauseMenu = false;

registerSettingsManagerDependencies({
  GameContext,
  gpState,
  setMenuDebounce,
  getActiveMenuElements,
  updateMenuVisuals,
  showOverlayMessage,
  updateMetaUI,
  selectProfileRecord,
  listSaveSlotsSystem,
  getProfileListSystem,
  createNewProfileRecord,
  deleteProfileRecord,
  loadMetaProfileSystem,
  saveGameSystem,
  resetMetaProfileSystem,
  saveMetaProfileSystem,
  setMusicVolume,
  setSfxVolume,
  getMusicVolume: () => musicVolume,
  getSfxVolume: () => sfxVolume,
  setupCanvasResolution,
  initStars,
  getViewportSize: () => ({ width, height }),
  SAVE_PREFIX,
  SAVE_LAST_KEY,
  isCrtFilterEnabled,
  toggleCrtFilter,
  isVectrexFilterEnabled,
  toggleVectrexFilter
});

registerWorldSetupDependencies({
  clearArrayWithPixiCleanup,
  clearMiniEvent,
  generateMap,
  getGameNowMs,
  getHeight: () => height,
  getWidth: () => width,
  initStars,
  pixiCleanupObject,
  resetPixiOverlaySprites,
  scheduleNextMiniEvent,
  scheduleNextRadiationStorm,
  scheduleNextShootingStar,
  updateNuggetUI,
  updateTurboUI,
  updateWarpUI,
  updateXpUI
});

registerMiniEventDependencies({
  completeContractSystem,
  pixiCleanupObject
});

function showFloatingText(x, y, amount, color = "#ff0", key = null) {
  if (key) {
    getOrCreateFloatingText(GameContext.floatingTexts, key, x, y, amount, color, {
      prefix: "+",
      life: 70
    });
  } else {
    GameContext.floatingTexts.push(
      new FloatingText(x, y, `+${amount}`, color, 70, { prefix: "+" })
    );
  }
}

function addPickupFloatingText(key, amount, color = "#ff0") {
  if (!GameContext.player || GameContext.player.dead) {
    return;
  }
  const x = GameContext.player.pos.x;
  const y = GameContext.player.pos.y - GameContext.player.radius - 10;
  showFloatingText(x, y, amount, color, key);
}

function awardCoinsInstant(amount, opts = {}) {
  const v = Math.max(0, Math.floor(amount || 0));
  if (v <= 0) {
    return;
  }
  GameContext.score += v;
  if (
    GameContext.player &&
    !GameContext.player.dead &&
    typeof GameContext.player.addXp === "function"
  ) {
    GameContext.player.addXp(v);
  }
  if (!opts.noSound) {
    playSound(opts.sound || "coin");
  }
  addPickupFloatingText("gold", v, opts.color || "#ff0");
}

function awardNuggetsInstant(amount, opts = {}) {
  const v = Math.max(0, Math.floor(amount || 0));
  if (v <= 0) {
    return;
  }
  GameContext.spaceNuggets += v;
  updateNuggetUI();
  if (!opts.noSound) {
    playSound(opts.sound || "coin");
  }
  addPickupFloatingText("nugs", v, opts.color || "#ff0");
}

registerGameFlowDependencies({
  applyMetaUpgrades: applyMetaUpgradesSystem,
  applyPendingProfile: applyPendingProfileSystem,
  autoSaveToCurrentProfile,
  depositMetaNuggets: depositMetaNuggetsSystem,
  formatTime,
  getFromPauseMenu: () => fromPauseMenu,
  setFromPauseMenu: value => {
    fromPauseMenu = value;
  },
  getGameNowMs,
  getMusicEnabled: () => musicEnabled,
  getSelectedShipType: () => selectedShipType,
  hideDebugMenu,
  initAudio,
  isArenaCountdownActive,
  listSaveSlots: listSaveSlotsSystem,
  pixiCleanupObject,
  playSound,
  resetCaveState,
  resetDungeon1State,
  resetVerticalScrollingState,
  resetProfileStats,
  resetWarpState,
  saveMetaProfile: saveMetaProfileSystem,
  savePrefix: SAVE_PREFIX,
  selectProfile,
  setMusicMode,
  setSimNowMs: value => {
    simNowMs = value;
  },
  setupGameWorld,
  showDeathScreen,
  showOverlayMessage,
  spawnDrone,
  spawnParticles,
  startMusic,
  stopArenaCountdown,
  stopMusic,
  updateContractUI,
  updateHealthUI,
  updatePauseMenuObjectives,
  Spaceship
});
initGameFlow();

registerWorldHelperDependencies({
  clearArrayWithPixiCleanup,
  spawnExplorationCaches,
  spawnOneAsteroidRelative,
  spawnSectorPOIs
});

registerSectorFlowDependencies({
  Cave,
  Dungeon1Zone,
  WarpMazeZone,
  VerticalScrollingZone,
  GoldNugget,
  clearArrayWithPixiCleanup,
  clearMiniEvent,
  clearOverlayMessageTimeout,
  generateMap,
  getHeight: () => height,
  getWidth: () => width,
  initStars,
  pixiCleanupObject,
  playSound,
  resetPixiOverlaySprites,
  scheduleNextMiniEvent,
  scheduleNextRadiationStorm,
  scheduleNextShootingStar,
  showOverlayMessage,
  spawnNewPinwheelRelative,
  spawnOneWarpAsteroidRelative,
  spawnParticles,
  stopArenaCountdown,
  updateHealthUI
});

// --- Core Loop ---

registerInputDependencies({
  canvas,
  getInternalSize: () => ({ width: internalWidth, height: internalHeight }),
  getViewportSize: () => ({ width, height }),
  togglePause,
  toggleDebugButton,
  handleSpaceStationDestroyed,
  startGame,
  completeSectorWarp,
  enterWarpMaze,
  enterVerticalScrollingZone,
  showOverlayMessage,
  getGameNowMs,
  shiftPausedTimers,
  getReturningFromModal: getReturningFromModalSystem,
  setReturningFromModal: setReturningFromModalSystem
});
initInputListeners();

registerHudDependencies({
  canvas,
  pixiArrowsGraphics,
  pixiUiOverlayLayer,
  mouseScreen,
  getViewportSize: () => ({ width, height }),
  getInternalSize: () => ({ width: internalWidth, height: internalHeight })
});

registerCollisionDependencies({
  spawnParticles,
  playSound,
  updateHealthUI,
  updateNuggetUI,
  addPickupFloatingText,
  showOverlayMessage,
  killPlayer,
  handleSpaceStationDestroyed,
  spawnLightningArc,
  spawnLargeExplosion,
  destroyBulletSprite,
  updateContractUI,
  setProjectileImpactSoundContext,
  awardCoinsInstant,
  awardNuggetsInstant,
  FloatingText
});

registerGameLoopDependencies({
  updateGamepad,
  gameLoopLogic,
  getSimNowMs: () => simNowMs,
  setSimNowMs: value => {
    simNowMs = value;
  },
  getSimAccMs: () => simAccMs,
  setSimAccMs: value => {
    simAccMs = value;
  },
  getSimLastPerfAt: () => simLastPerfAt,
  setSimLastPerfAt: value => {
    simLastPerfAt = value;
  },
  fpsCounterEl
});

registerGameLoopLogicDependencies({
  getWidth: () => width,
  getHeight: () => height,
  getPixiApp: () => pixiApp,
  getPixiWorldRoot: () => pixiWorldRoot,
  getPixiScreenRoot: () => pixiScreenRoot,
  getPixiNebulaLayer: () => pixiNebulaLayer,
  getPixiStarLayer: () => pixiStarLayer,
  getPixiStarTilingLayer: () => pixiStarTilingLayer,
  getPixiCaveGridSprite: () => pixiCaveGridSprite,
  getPixiMinimapGraphics: () => pixiMinimapGraphics,
  getPixiArrowsGraphics: () => pixiArrowsGraphics,
  getPixiBulletLayer: () => pixiBulletLayer,
  getPixiParticleLayer: () => pixiParticleLayer,
  getPixiPickupLayer: () => pixiPickupLayer,
  getPixiVectorLayer: () => pixiVectorLayer,
  getPixiBulletTextures: () => pixiBulletTextures,
  getPixiTextures: () => pixiTextures,
  getPixiTextureWhite: () => pixiTextureWhite,
  getPixiParticleGlowTexture: () => pixiParticleGlowTexture,
  getPixiParticleSmokeTexture: () => pixiParticleSmokeTexture,
  getPixiParticleWarpTexture: () => pixiParticleWarpTexture,
  getPixiBulletSpritePool: () => pixiBulletSpritePool,
  getPixiParticleSpritePool: () => pixiParticleSpritePool,
  getPixiPickupSpritePool: () => pixiPickupSpritePool,
  setRenderAlphaLocal: value => {
    renderAlpha = value;
  },
  getGameDurationMs: () => GAME_DURATION_MS,
  intensityBreakDuration: INTENSITY_BREAK_DURATION,
  ctx,
  uiCtx,
  canvas,
  uiCanvas,
  overlayMessage,
  resetPixiOverlaySprites,
  clearArrayWithPixiCleanup,
  clearMiniEvent,
  updateMiniEventUI,
  drawSlackerMouseLine,
  drawStationIndicator,
  drawDestroyerIndicator,
  drawWarpGateIndicator,
  drawContractIndicator,
  drawHealthPackIndicator,
  drawMiniEventIndicator,
  clearPixiUiText,
  processStaggeredBombExplosions,
  processStaggeredParticleBursts,
  processLightningEffects,
  compactArray: helperCompactArray,
  compactParticles,
  immediateCompactArray,
  globalStaggeredCleanup,
  destroyBulletSprite,
  pixiCleanupObject,
  showOverlayMessage,
  playSound,
  setMusicMode,
  isMusicEnabled,
  enterWarpMaze,
  enterVerticalScrollingZone,
  completeSectorWarp,
  findSpawnPointRelative,
  resolveEntityCollision,
  processBulletCollisions,
  ShootingStar
});

// Register dependencies for extracted entity classes
registerAsteroidDependencies({
  checkDespawn,
  pixiCleanupObject,
  spawnAsteroidExplosion
});

registerPoiDependencies({
  spawnParticles,
  getSimNowMs: getGameNowMs,
  awardCoinsInstant
});

registerMiniEventDefendCacheDependencies({
  spawnParticles,
  getSimNowMs: getGameNowMs
});

registerShootingStarDependencies({
  emitParticle,
  spawnAsteroidExplosion,
  awardNuggetsInstant
});

registerSpawnManagerDependencies({
  ExplorationCache,
  DerelictShipPOI,
  DebrisFieldPOI,
  MiniEventDefendCache
});

registerEnemyDependencies({
  spawnLargeExplosion,
  spawnFieryExplosion,
  awardCoinsInstant,
  awardNuggetsInstant,
  spawnParticles,
  spawnSmoke,
  checkDespawn,
  checkWallCollision,
  rayCast,
  spawnBarrelSmoke
});

registerPinwheelDependencies({
  spawnParticles,
  checkDespawn,
  spawnSmoke,
  spawnBarrelSmoke,
  spawnLargeExplosion,
  awardNuggetsInstant
});

registerCruiserDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  spawnBarrelSmoke,
  canvas,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerFlagshipDependencies({
  spawnParticles,
  spawnLargeExplosion,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerSuperFlagshipDependencies({
  spawnParticles,
  spawnLargeExplosion,
  awardCoinsInstant,
  awardNuggetsInstant,
  endGame,
  killPlayer,
  updateHealthUI,
  closestPointOnSegment,
  canvas
});

registerShockwaveDependencies({
  spawnParticles,
  updateHealthUI
});

registerBulletDependencies({
  spawnFieryExplosion
});

registerCruiserMineBombDependencies({
  spawnParticles,
  emitParticle
});

registerFlagshipGuidedMissileDependencies({
  spawnFieryExplosion,
  spawnParticles,
  updateHealthUI,
  killPlayer,
  emitParticle,
  checkWallCollision
});

registerClusterBombDependencies({
  spawnFieryExplosion,
  pixiBulletTextures
});

registerNapalmZoneDependencies({
  applyAOEDamageToPlayer,
  emitParticle
});

Cave.registerCaveDependencies({
  spawnParticles,
  spawnFieryExplosion,
  spawnBossExplosion, // Added globally?
  emitParticle,
  applyAOEDamageToPlayer,
  awardCoinsInstant,
  awardNuggetsInstant,
  killPlayer,
  showLevelUpMenu,
  startSectorTransition,
  resetWarpState,
  clearMiniEvent,
  showOverlayMessage,
  updateHealthUI,
  onBossDefeated: () => {
    if (GameContext.caveLevel) {
      GameContext.caveLevel.bossesDefeated++;
      const bossesDefeated = GameContext.caveLevel.bossesDefeated;

      // Reset arena placement flag so next boss arena can be placed
      GameContext.caveLevel.bossArenaPlaced = false;
      // Deactivate the current arena
      if (GameContext.caveBossArena) {
        GameContext.caveBossArena.active = false;
        GameContext.caveBossArena.bossSpawned = false;
      }

      // Check if all 3 cave bosses are defeated
      if (bossesDefeated >= 3) {
        showOverlayMessage("CAVE CLEARED! WARPING TO SECTOR 3 IN 10s", "#0f0", 10000);
        // Start sector transition after a short delay to let the death animation play
        setTimeout(() => {
          startSectorTransition();
        }, 2000);
      }
    }
  }
});

registerWarpBioPodDependencies({
  spawnParticles
});

Cave.registerCaveWallTurretDependencies({
  spawnParticles,
  updateHealthUI,
  killPlayer,
  awardCoinsInstant,
  closestPointOnSegment,
  spawnLargeExplosion
});

registerDungeonDroneDependencies({
  spawnParticles
});

registerWarpShieldDroneDependencies({
  spawnParticles,
  spawnLargeExplosion
});

registerWarpSentinelBossDependencies({
  spawnParticles,
  spawnLargeExplosion,
  spawnFieryExplosion,
  scheduleParticleBursts,
  scheduleStaggeredBombExplosions,
  applyAOEDamageToPlayer,
  updateHealthUI,
  killPlayer,
  canvas
});

registerSpaceStationDependencies({
  spawnParticles,
  spawnBarrelSmoke,
  updateHealthUI,
  killPlayer,
  closestPointOnSegment,
  canvas
});

registerDestroyerDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  spawnBarrelSmoke,
  canvas,
  awardNuggetsInstant
});

registerDestroyer2Dependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  spawnBarrelSmoke
});

registerFinalBossDependencies({
  spawnParticles,
  spawnLargeExplosion,
  spawnFieryExplosion,
  scheduleParticleBursts,
  scheduleStaggeredBombExplosions,
  applyAOEDamageToPlayer,
  updateHealthUI,
  killPlayer,
  canvas,
  unlockLevel: levelManagerUnlockLevel,
  endGame
});

registerNecroticHiveDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerCerebralPsionDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles
});

registerFleshforgeDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerVortexMatriarchDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerChitinusPrimeDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerPsyLichDependencies({
  spawnBossExplosion,
  spawnLargeExplosion,
  spawnParticles,
  awardCoinsInstant,
  awardNuggetsInstant
});

registerDroneDependencies({
  spawnParticles,
  updateHealthUI,
  spawnBarrelSmoke
});

registerContractBeaconDependencies({
  completeContract
});

registerGateRingDependencies({
  completeContract
});

registerWallTurretDependencies({
  spawnParticles,
  awardCoinsInstant
});

registerWarpMazeZoneDependencies({
  clearArrayWithPixiCleanup,
  filterArrayWithPixiCleanup
});

registerVerticalScrollingZoneDependencies({
  clearArrayWithPixiCleanup,
  filterArrayWithPixiCleanup
});

registerDungeon1ZoneDependencies({
  clearArrayWithPixiCleanup,
  filterArrayWithPixiCleanup
});

registerRadiationStormDependencies({
  spawnParticles,
  getSimNowMs: () => simNowMs,
  awardCoinsInstant
});

registerAnomalyZoneDependencies({
  resolveCircleSegment,
  closestPointOnSegment,
  completeContract,
  ExplorationCache
});

registerSpaceshipDependencies({
  keys,
  gpState,
  mouseState,
  mouseScreen,
  mouseWorld,
  spawnParticles,
  spawnSmoke,
  spawnBarrelSmoke,
  showOverlayMessage,
  updateHealthUI,
  updateWarpUI,
  updateXpUI,
  updateTurboUI,
  updateInputSpeedUI,
  showLevelUpMenu,
  killPlayer,
  checkWallCollision,
  rayCast,
  getGameNowMs,
  getSuppressWarpInputUntil: () => suppressWarpInputUntil,
  getViewportSize: () => ({ width, height }),
  getInternalSize: () => ({ width: internalWidth, height: internalHeight }),
  getPlayerHullExternalReady,
  getPlayerHullVectrexExternalReady,
  getSlackerHullExternalReady,
  getSlackerHullVectrexExternalReady
});

const SHIP_SELECTION_KEY = "neon_space_ship_selection";
let selectedShipType = localStorage.getItem(SHIP_SELECTION_KEY) || "slacker";

registerDeathScreenDependencies({
  startGame,
  formatTime
});

registerMenuDependencies({
  GameContext,
  initAudio,
  startGame,
  getGameNowMs,
  shiftPausedTimers,
  startMusic,
  showOverlayMessage,
  showSaveMenu,
  updateMetaUI,
  getActiveMenuElements,
  updateMenuVisuals,
  setMenuDebounce,
  applyUpgrade: applyUpgradeSystem,
  wipeProfiles,
  togglePause,
  showAbortConfirmDialog,
  quitGame,
  returnToMainMenuFromDeath,
  toggleMusic,
  getMusicEnabled: () => musicEnabled,
  getSelectedShipType: () => selectedShipType,
  setSelectedShipType: value => {
    selectedShipType = value;
  },
  shipSelectionKey: SHIP_SELECTION_KEY,
  getDebugMenuVisible: () => debugMenuVisible,
  setDebugMenuVisible: value => {
    debugMenuVisible = value;
  }
});
initMenuUi();

// Sync MUSIC button label with persisted setting (audio-manager loads it at import time).
try {
  const musicBtn = document.getElementById("music-btn");
  if (musicBtn) {
    musicBtn.innerText = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
  }
} catch (e) {}

initSettingsMenu();

// Initialize CRT filter
registerCrtFilterDependencies({
  GameContext,
  showOverlayMessage,
  getPixiApp: () => pixiApp,
  disableVectrexFilter,
  isVectrexFilterEnabled
});
initCrtFilterUI();

// Initialize Vectrex filter
registerVectrexFilterDependencies({
  GameContext,
  showOverlayMessage,
  getPixiApp: () => pixiApp,
  disableCrtFilter,
  isCrtFilterEnabled
});
initVectrexFilterUI();

// Game helpers system
registerGameHelperDependencies({
  playSound,
  spawnLargeExplosion,
  spawnParticles,
  showOverlayMessage,
  pixiCleanupObject,
  pixiBulletSpritePool,
  destroyBulletSprite,
  awardCoinsInstant,
  awardNuggetsInstant,
  stopMusic,
  endGame,
  unlockLevel: levelManagerUnlockLevel
});

// Level manager system
registerLevelManagerDependencies({
  GameContext,
  startGame,
  getActiveMenuElements,
  updateMenuVisuals,
  initAudio,
  saveGame: saveGameSystem
});
initLevelSelection();

// Debug spawn system
registerDebugSpawnDependencies({
  destroyer: GameContext.destroyer,
  clearMiniEvent,
  enterDungeon1Internal: _enterDungeon1Internal
});
initDebugKeyboardShortcuts();

// Robust menu initialization for start screen
document.getElementById("levelup-screen").style.display = "none";
document.getElementById("upgrades-menu").style.display = "none";
document.getElementById("start-screen").style.display = "block";

const allMenuElements = document.querySelectorAll("button, .upgrade-card, .meta-item");
allMenuElements.forEach(el => {
  el.classList.remove("selected");
  if (el.tagName === "BUTTON") {
    el.blur();
  }
});

requestAnimationFrame(() => {
  GameContext.menuSelectionIndex = 0;
  const initialActiveElements = getActiveMenuElements();
  if (initialActiveElements.length > 0) {
    updateMenuVisuals(initialActiveElements);
    initialActiveElements[0].focus();
  }
});

initProfileSystem();

// Debug function to spawn health powerup at player position
window.spawnHealthPowerUp = function () {
  if (!GameContext || !GameContext.player) {
    console.log("Player not spawned yet. Start game first!");
    return;
  }
  const pickup = new HealthPowerUp(GameContext.player.pos.x + 150, GameContext.player.pos.y);
  GameContext.powerups.push(pickup);
  console.log("✓ HealthPowerUp spawned 150 units from player!");
  console.log("✓ Texture: medkit.png should appear");
};

startMainLoop();
