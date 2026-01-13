// --- Module Imports ---
import { Vector, SpatialHash, _tempVec1, _tempVec2 } from './core/math.js';
import { GameContext } from './core/game-context.js';
import { globalProfiler } from './core/profiler.js';
import { globalJitterMonitor } from './core/jitter-monitor.js';
import { globalStaggeredCleanup, immediateCompactArray } from './core/staggered-cleanup.js';
import {
    updateViewBounds, viewBounds, isInView, isInViewRadius, entityInView,
    bulletGrid, rebuildBulletGrid, distSq, distLessThan
} from './core/performance.js';
import { colorToPixi } from './rendering/colors.js';
import { initCanvasSetup } from './rendering/canvas-setup.js';
import { initPixiOverlay } from './rendering/pixi-init.js';
import {
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureRotOffsets,
    pixiTextureBaseScales,
    pixiTextureScaleToRadius
} from './rendering/texture-loader.js';
import {
    initTextureAssets,
    getPlayerHullExternalReady,
    getSlackerHullExternalReady
} from './rendering/texture-manager.js';
import {
    initStars,
    updatePixiBackground,
    updatePixiCaveGrid,
    getStarTiles,
    getNebulaTiles,
    setStarTiles,
    setNebulaTiles
} from './rendering/background-renderer.js';
import { drawMinimap } from './rendering/minimap-renderer.js';
import { Entity } from './entities/Entity.js';
import {
    ZOOM_LEVEL, SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME,
    PIXI_SPRITE_POOL_MAX, USE_PIXI_OVERLAY, BACKGROUND_MUSIC_URL,
    ENABLE_NEBULA, NEBULA_ALPHA, ENABLE_PROJECTILE_IMPACT_SOUNDS,
    PLAYER_SHIELD_RADIUS_SCALE
} from './core/constants.js';
import { Particle, SmokeParticle, Explosion, WarpParticle, Coin, FloatingText, HealthPowerUp, SpaceNugget, getOrCreateFloatingText, LightningArc } from './entities/index.js';
import * as Cave from './entities/cave/index.js';
import {
    initAudio, startMusic, stopMusic, setMusicMode, playSound, playMp3Sfx,
    toggleMusic as audioToggleMusic, isMusicEnabled, setProjectileImpactSoundContext,
    musicEnabled, setMusicVolume, setSfxVolume, musicVolume, sfxVolume
} from './audio/audio-manager.js';
import {
    pixiBulletSpritePool, pixiParticleSpritePool, pixiEnemySpritePools,
    pixiPickupSpritePool, pixiAsteroidSpritePool, pixiStarSpritePool
} from './rendering/pixi-setup.js';
import {
    setRenderAlpha,
    setAsteroidImages,
    setAsteroidIndestructibleImage,
    setAsteroidTexturesReady,
    setAsteroidIndestructibleTextureReady,
    setPixiContext
} from './rendering/pixi-context.js';
import { findSpawnPointRelative as findSpawnPointRelativeHelper } from './utils/spawn-utils.js';
import {
    clearArrayWithPixiCleanup as clearArrayWithPixiCleanupHelper,
    destroyBulletSprite as destroyBulletSpriteHelper,
    pixiCleanupObject as pixiCleanupObjectHelper
} from './utils/cleanup-utils.js';
import {
    clearOverlayMessageTimeout,
    formatTime,
    showOverlayMessage
} from './utils/ui-helpers.js';
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
} from './systems/save-manager.js';
import {
    applyMetaUpgrades as applyMetaUpgradesSystem,
    depositMetaNuggets as depositMetaNuggetsSystem,
    getReturningFromModal as getReturningFromModalSystem,
    loadMetaProfile as loadMetaProfileSystem,
    resetMetaProfile as resetMetaProfileSystem,
    saveMetaProfile as saveMetaProfileSystem,
    setReturningFromModal as setReturningFromModalSystem
} from './systems/meta-manager.js';
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
} from './systems/event-scheduler.js';
import {
    completeContract as completeContractSystem,
    registerContractHandlers,
    updateContract as updateContractSystem,
    updateContractUI as updateContractUISystem
} from './systems/contract-manager.js';
import {
    applyUpgrade as applyUpgradeSystem
} from './systems/upgrade-manager.js';
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
    drawMiniEventIndicator,
    drawSlackerMouseLine,
    updateHealthUI,
    updateXpUI,
    updateWarpUI,
    updateTurboUI,
    updateContractUI,
    updateNuggetUI,
    showLevelUpMenu,
    updateMetaUI
} from './ui/index.js';
import {
    registerSettingsManagerDependencies,
    showAbortConfirmDialog,
    showSaveMenu,
    autoSaveToCurrentProfile,
    wipeProfiles,
    selectProfile,
    initProfileSystem,
    initSettingsMenu
} from './ui/settings-manager.js';
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
} from './systems/index.js';
import {
    EnvironmentAsteroid,
    registerAsteroidDependencies,
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
    Dungeon1Zone,
    registerDungeon1ZoneDependencies,
    RadiationStorm,
    registerRadiationStormDependencies,
    AnomalyZone,
    registerAnomalyZoneDependencies,
    Spaceship,
    registerSpaceshipDependencies
} from './entities/index.js';

// --- Performance Debug (load after other modules) ---
import './core/perf-debug.js';

// --- Globals ---
const mouseState = GameContext.mouseState;

// Pixi Textures (Global)
let pixiParticleSmokeTexture;
let pixiParticleWarpTexture;

// --- Base Classes (Vector and Entity imported from modules) ---

// Particle, SmokeParticle, Explosion, WarpParticle imported from ./entities/index.js
// Coin, FloatingText, HealthPowerUp, SpaceNugget imported from ./entities/index.js
// getOrCreateFloatingText imported from ./entities/index.js

// Audio functions imported from ./audio/audio-manager.js
// initAudio, startMusic, stopMusic, setMusicMode, playSound, playMp3Sfx,
// audioToggleMusic, isMusicEnabled, setProjectileImpactSoundContext

// DEBUG: Spawn cruiser instantly from console with window.spawnCruiser()
window.spawnCruiser = function () {
    if (typeof GameContext.bossActive !== 'undefined' && GameContext.bossActive) {
        console.log('[DEBUG] Boss already active');
        return;
    }
    GameContext.cruiserEncounterCount++;
    if (GameContext.destroyer) {
        const idx = GameContext.enemies.indexOf(GameContext.destroyer);
        if (idx !== -1) GameContext.enemies.splice(idx, 1);
        if (GameContext.destroyer.pixiCleanupObject && typeof GameContext.destroyer.pixiCleanupObject === 'function') {
            GameContext.destroyer.pixiCleanupObject();
        }
        GameContext.destroyer = null;
    }
    clearArrayWithPixiCleanup(GameContext.enemies);
    clearArrayWithPixiCleanup(GameContext.pinwheels);
    GameContext.baseRespawnTimers = [];
    GameContext.roamerRespawnQueue = [];
    clearArrayWithPixiCleanup(GameContext.bullets);
    clearArrayWithPixiCleanup(GameContext.bossBombs);
    clearArrayWithPixiCleanup(GameContext.guidedMissiles);
    GameContext.boss = new Cruiser(GameContext.cruiserEncounterCount);
    GameContext.bossActive = true;
    GameContext.bossArena.x = (GameContext.player.pos.x + GameContext.boss.pos.x) / 2;
    GameContext.bossArena.y = (GameContext.player.pos.y + GameContext.boss.pos.y) / 2;
    GameContext.bossArena.radius = 2500;
    GameContext.bossArena.active = true;
    GameContext.bossArena.growing = false;
    GameContext.radiationStorm = null;
    clearMiniEvent();
    GameContext.dreadManager.timerActive = false;
    GameContext.dreadManager.firstSpawnDone = true;
    showOverlayMessage("DEBUG: CRUISER SPAWNED", '#ff0', 2000);
    playSound('boss_spawn');
    if (musicEnabled) setMusicMode('cruiser');
};

// DEBUG: Ctrl+Shift+3 to spawn cruiser
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.code === 'Digit3' || e.code === 'Numpad3')) {
        e.preventDefault();
        window.spawnCruiser();
    } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit4' || e.code === 'Numpad4')) {
        e.preventDefault();
        window.spawnStation();
    } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit5' || e.code === 'Numpad5')) {
        e.preventDefault();
        window.spawnFinalBoss();
    } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit6' || e.code === 'Numpad6')) {
        e.preventDefault();
        window.enterDungeon1Debug();
    } else if (e.ctrlKey && e.shiftKey && e.key === 'd') {
        // Dungeon boss spawning with Ctrl+Shift+D + number
        // The number key will be read separately
    } else if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        // Same for uppercase D
    } else if (e.ctrlKey && e.shiftKey && e.code === 'Digit7') {
        // Spawn random dungeon boss
        e.preventDefault();
        const bosses = ['NecroticHive', 'CerebralPsion', 'Fleshforge', 'VortexMatriarch', 'ChitinusPrime', 'PsyLich'];
        const randomBoss = bosses[Math.floor(Math.random() * bosses.length)];
        window.spawnDungeonBoss(randomBoss);
    } else if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        GameContext.DEBUG_COLLISION = !GameContext.DEBUG_COLLISION;
        showOverlayMessage(`HITBOX DEBUG: ${GameContext.DEBUG_COLLISION ? "ON" : "OFF"}`, GameContext.DEBUG_COLLISION ? '#0f0' : '#f00', 1500);
    }
});

// Dungeon boss number shortcuts (Ctrl+Shift+D + 4-9)
document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || !e.shiftKey) return;
    const key = e.key;
    if (key === '4') { e.preventDefault(); window.spawnNecroticHive(); }
    if (key === '5') { e.preventDefault(); window.spawnCerebralPsion(); }
    if (key === '6') { e.preventDefault(); window.spawnFleshforge(); }
    if (key === '7') { e.preventDefault(); window.spawnVortexMatriarch(); }
    if (key === '8') { e.preventDefault(); window.spawnChitinusPrime(); }
    if (key === '9') { e.preventDefault(); window.spawnPsyLich(); }
});

// DEBUG: Spawn station instantly (Ctrl+Shift+4)
window.spawnStation = function () {
    if (GameContext.spaceStation) {
        console.log('[DEBUG] Station already active');
        return;
    }
    GameContext.spaceStation = new SpaceStation();
    // Only decrement if there are pending stations (debug bypass)
    if (GameContext.pendingStations > 0) GameContext.pendingStations--;
    GameContext.stationArena.x = GameContext.spaceStation.pos.x;
    GameContext.stationArena.y = GameContext.spaceStation.pos.y;
    GameContext.stationArena.radius = 2800;
    GameContext.stationArena.active = false;
    showOverlayMessage("DEBUG: SPACE STATION SPAWNED", '#ff0', 2000);
    playSound('station_spawn');
    console.log('[DEBUG] Station spawned at', GameContext.spaceStation.pos.x.toFixed(0), GameContext.spaceStation.pos.y.toFixed(0));
};

// DEBUG: Spawn final boss instantly (Ctrl+Shift+5)
window.spawnFinalBoss = function () {
    console.log('[DEBUG] Attempting to spawn Final Boss...');
    try {
        if (typeof GameContext.bossActive !== 'undefined' && GameContext.bossActive) {
            console.log('[DEBUG] Boss already active');
            showOverlayMessage("BOSS ALREADY ACTIVE", '#f00', 1000);
            return;
        }

        console.log('[DEBUG] Clearing existing entities...');
        clearArrayWithPixiCleanup(GameContext.enemies);
        clearArrayWithPixiCleanup(GameContext.pinwheels);
        GameContext.baseRespawnTimers = [];
        GameContext.roamerRespawnQueue = [];
        clearArrayWithPixiCleanup(GameContext.bullets);
        clearArrayWithPixiCleanup(GameContext.bossBombs);
        clearArrayWithPixiCleanup(GameContext.guidedMissiles);

        // Position boss away from player
        const dist = 1000;
        const angle = Math.random() * Math.PI * 2;
        const x = GameContext.player.pos.x + Math.cos(angle) * dist;
        const y = GameContext.player.pos.y + Math.sin(angle) * dist;

        console.log('[DEBUG] Creating FinalBoss instance at', x, y);
        if (typeof FinalBoss === 'undefined') {
            throw new Error('FinalBoss class is not defined!');
        }
        GameContext.boss = new FinalBoss(x, y, null);
        GameContext.bossActive = true;

        console.log('[DEBUG] Setting up boss arena...');
        GameContext.bossArena.x = (GameContext.player.pos.x + GameContext.boss.pos.x) / 2;
        GameContext.bossArena.y = (GameContext.player.pos.y + GameContext.boss.pos.y) / 2;
        GameContext.bossArena.radius = 2500;
        GameContext.bossArena.active = true;
        GameContext.bossArena.growing = false;

        showOverlayMessage("DEBUG: FINAL BOSS SPAWNED", '#ff0', 2000);
        playSound('boss_spawn');
        if (musicEnabled) setMusicMode('warp_boss');
        console.log('[DEBUG] Final Boss spawned successfully.');
    } catch (err) {
        console.error('[DEBUG] Failed to spawn Final Boss:', err);
        showOverlayMessage("ERROR SPAWNING BOSS: " + err.message, '#f00', 3000);
    }
};

// DEBUG: Enter Dungeon1 instantly (Ctrl+Shift+6)
window.enterDungeon1Debug = function () {
    console.log('[DEBUG] Attempting to enter Dungeon1...');
    try {
        if (typeof _enterDungeon1Internal === 'function') {
            _enterDungeon1Internal();
            console.log('[DEBUG] Dungeon1 entered successfully');
        } else {
            console.error('[DEBUG] _enterDungeon1Internal function not found');
            showOverlayMessage("ERROR: _enterDungeon1Internal not defined", '#f00', 2000);
        }
    } catch (err) {
        console.error('[DEBUG] Failed to enter Dungeon1:', err);
        showOverlayMessage("ERROR: " + err.message, '#f00', 3000);
    }
};

// DEBUG: Spawn Dungeon Bosses (Ctrl+Shift+D4-9)
window.spawnDungeonBoss = function (bossType) {
    console.log(`[DEBUG] Attempting to spawn ${bossType}...`);
    try {
        if (typeof GameContext.bossActive !== 'undefined' && GameContext.bossActive) {
            console.log('[DEBUG] Boss already active');
            showOverlayMessage("BOSS ALREADY ACTIVE", '#f00', 1000);
            return;
        }

        clearArrayWithPixiCleanup(GameContext.enemies);
        clearArrayWithPixiCleanup(GameContext.pinwheels);
        GameContext.baseRespawnTimers = [];
        GameContext.roamerRespawnQueue = [];
        clearArrayWithPixiCleanup(GameContext.bullets);
        clearArrayWithPixiCleanup(GameContext.bossBombs);
        clearArrayWithPixiCleanup(GameContext.guidedMissiles);
        clearArrayWithPixiCleanup(GameContext.warpBioPods);

        let newBoss;
        const dist = 2000;
        const angle = Math.random() * Math.PI * 2;
        const x = GameContext.player.pos.x + Math.cos(angle) * dist;
        const y = GameContext.player.pos.y + Math.sin(angle) * dist;

        switch (bossType) {
            case 'NecroticHive':
                newBoss = new NecroticHive(1);
                GameContext.necroticHive = newBoss;
                break;
            case 'CerebralPsion':
                newBoss = new CerebralPsion(1);
                GameContext.cerebralPsion = newBoss;
                break;
            case 'Fleshforge':
                newBoss = new Fleshforge(1);
                GameContext.fleshforge = newBoss;
                break;
            case 'VortexMatriarch':
                newBoss = new VortexMatriarch(1);
                GameContext.vortexMatriarch = newBoss;
                break;
            case 'ChitinusPrime':
                newBoss = new ChitinusPrime(1);
                GameContext.chitinusPrime = newBoss;
                break;
            case 'PsyLich':
                newBoss = new PsyLich(1);
                GameContext.psyLich = newBoss;
                break;
            default:
                console.error('[DEBUG] Unknown boss type:', bossType);
                return;
        }

        GameContext.boss = newBoss;
        GameContext.bossActive = true;
        GameContext.bossArena.x = (GameContext.player.pos.x + GameContext.boss.pos.x) / 2;
        GameContext.bossArena.y = (GameContext.player.pos.y + GameContext.boss.pos.y) / 2;
        GameContext.bossArena.radius = 3000;
        GameContext.bossArena.active = true;
        GameContext.bossArena.growing = false;

        showOverlayMessage(`DEBUG: ${bossType.toUpperCase()} SPAWNED`, '#ff0', 2000);
        playSound('boss_spawn');
        if (musicEnabled) setMusicMode('cruiser');
        console.log(`[DEBUG] ${bossType} spawned successfully at`, GameContext.boss.pos.x.toFixed(0), GameContext.boss.pos.y.toFixed(0));
    } catch (err) {
        console.error(`[DEBUG] Failed to spawn ${bossType}:`, err);
        showOverlayMessage("ERROR SPAWNING BOSS: " + err.message, '#f00', 3000);
    }
};

// Individual spawn functions for convenience
window.spawnNecroticHive = function () { window.spawnDungeonBoss('NecroticHive'); };
window.spawnCerebralPsion = function () { window.spawnDungeonBoss('CerebralPsion'); };
window.spawnFleshforge = function () { window.spawnDungeonBoss('Fleshforge'); };
window.spawnVortexMatriarch = function () { window.spawnDungeonBoss('VortexMatriarch'); };
window.spawnChitinusPrime = function () { window.spawnDungeonBoss('ChitinusPrime'); };
window.spawnPsyLich = function () { window.spawnDungeonBoss('PsyLich'); };


// toggleMusic wrapper that updates DOM button
function toggleMusic() {
    // Uses audioToggleMusic from module (imported as audioToggleMusic)
    const enabled = audioToggleMusic(GameContext.gameActive, GameContext.gamePaused);
    const btn = document.getElementById('music-btn');
    if (btn) btn.innerText = enabled ? "MUSIC: ON" : "MUSIC: OFF";
}

let width = 1920;
let height = 1080;
let internalWidth = 1920;
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
        width = w;
        height = h;
        internalWidth = w;
        internalHeight = h;
    },
    getSize: () => ({ width, height })
});

// PixiJS overlay (optional; falls back to Canvas if unavailable)
// Note: Pixi is rendered manually inside our main loop to avoid running a second render/ticker.
// USE_PIXI_OVERLAY imported from ./core/constants.js
// ENABLE_NEBULA and NEBULA_ALPHA imported from ./core/constants.js
let pixiApp = null;
let pixiWorldRoot = null;   // camera-transformed world space
let pixiScreenRoot = null;  // screen space (no camera transform)

// Screen-space background layers
let pixiNebulaLayer = null;
let pixiStarLayer = null;
let pixiStarTilingLayer = null; // preferred GameContext.starfield (1-2 tiling sprites)

// UI overlay layers (screen-space, for minimap and directional arrows)
let pixiUiOverlayLayer = null;    // Container for all UI graphics
let pixiMinimapGraphics = null;   // Graphics object for minimap
let pixiArrowsGraphics = null;    // Graphics object for directional arrows

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
let pixiCaveGridLayer = null;   // screen-space
let pixiCaveGridSprite = null;  // TilingSprite
let pixiParticleGlowTexture = null;

// PIXI_SPRITE_POOL_MAX imported from ./core/constants.js
// Sprite pools imported from ./rendering/pixi-setup.js (see imports at top)

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


// colorToPixi is now imported from ./rendering/colors.js

function allocPixiSprite(pool, layer, texture = pixiTextureWhite, size = 2, anchor = 0.5) {
    if (!texture || !layer) return null;
    let spr = pool && pool.length > 0 ? pool.pop() : null;
    if (!spr) spr = new PIXI.Sprite(texture);
    spr.texture = texture;
    spr.tint = 0xffffff;
    spr.alpha = 1;
    spr.rotation = 0;
    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
    spr.scale.set(1);
    if (typeof anchor === 'number') spr.anchor.set(anchor);
    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') spr.anchor.set(anchor.x, anchor.y);
    else if (Array.isArray(anchor) && anchor.length >= 2) spr.anchor.set(anchor[0], anchor[1]);
    else spr.anchor.set(0.5);
    spr.visible = true;
    if (size != null) spr.width = spr.height = size;
    if (!spr.parent) layer.addChild(spr);
    return spr;
}

function releasePixiSprite(pool, spr) {
    if (!spr) return;
    if (spr.parent) spr.parent.removeChild(spr);
    spr.visible = false;
    if (pool && pool.length < PIXI_SPRITE_POOL_MAX) pool.push(spr);
}

function destroyBulletSprite(bullet) {
    destroyBulletSpriteHelper(bullet);
}

function pixiCleanupObject(obj) {
    pixiCleanupObjectHelper(obj);
}

function clearArrayWithPixiCleanup(arr) {
    clearArrayWithPixiCleanupHelper(arr);
}

function filterArrayWithPixiCleanup(arr, keepFn) {
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

function resetPixiOverlaySprites() {
    // Nebula is a persistent screen-space backdrop; keep it mounted.
    const nebulaTiles = getNebulaTiles();
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
    pixiBulletSpritePool.length = 0;
    pixiParticleSpritePool.length = 0;
    try {
        const keys = pixiEnemySpritePools ? Object.keys(pixiEnemySpritePools) : [];
        for (const k of keys) pixiEnemySpritePools[k].length = 0;
    } catch (e) { }
    pixiPickupSpritePool.length = 0;
    pixiAsteroidSpritePool.length = 0;
    pixiStarSpritePool.length = 0;
}

function cleanupPixiWorldRootExtras() {
    if (!pixiWorldRoot) return;
    const keep = new Set();
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
const overlayMessage = document.getElementById('overlay-message');
const fpsCounterEl = document.getElementById('fps-counter');

// Fixed-timestep simulation (decouple simulation from render FPS)
// SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME imported from ./core/constants.js
let simAccMs = 0;
let simNowMs = 0;
let simLastPerfAt = 0;
const getGameNowMs = () => (typeof simNowMs === 'number' && simNowMs > 0) ? simNowMs : Date.now();
let renderAlpha = 1.0; // Global render interpolation alpha (0-1)
let suppressWarpGateUntil = 0;
let suppressWarpInputUntil = 0;

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



function resize() {
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

function startSectorTransition() {
    GameContext.sectorTransitionActive = true;
    GameContext.warpCountdownAt = Date.now() + 10000;
    showOverlayMessage("WARPING TO NEW SECTOR IN 10s", '#0ff', 10000);
    clearOverlayMessageTimeout();
    GameContext.pendingStations = 0;
    GameContext.nextSpaceStationTime = null;
    GameContext.radiationStorm = null;
    clearMiniEvent();
    GameContext.gamePaused = false;
    GameContext.gameActive = true;
    GameContext.pendingTransitionClear = true; // clear arrays safely next frame
    GameContext.dreadManager.timerActive = false;
}

function completeSectorWarp() {
    GameContext.gameActive = true;
    GameContext.gamePaused = false;
    GameContext.sectorTransitionActive = false;
    GameContext.warpCountdownAt = null;
    GameContext.sectorIndex++;
    // Heal player
    GameContext.player.hp = GameContext.player.maxHp;
    GameContext.player.invulnerable = 180;
    GameContext.player.shieldSegments = GameContext.player.shieldSegments.map(() => 2);
    if (GameContext.player.maxOuterShieldSegments && GameContext.player.maxOuterShieldSegments > 0) {
        GameContext.player.outerShieldSegments = new Array(GameContext.player.maxOuterShieldSegments).fill(1);
    }
    updateHealthUI();

    // Warp effect
    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 40, '#0ff');
    GameContext.player.pos.x = 0;
    GameContext.player.pos.y = 0;
    GameContext.player.vel.x = 0;
    GameContext.player.vel.y = 0;
    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 40, '#0ff');

    // Reset world for new sector
    resetPixiOverlaySprites();
    clearArrayWithPixiCleanup(GameContext.bullets);
    clearArrayWithPixiCleanup(GameContext.bossBombs);
    clearArrayWithPixiCleanup(GameContext.guidedMissiles);
    clearArrayWithPixiCleanup(GameContext.enemies);
    clearArrayWithPixiCleanup(GameContext.pinwheels);
    clearArrayWithPixiCleanup(GameContext.coins);
    clearArrayWithPixiCleanup(GameContext.nuggets);
    clearArrayWithPixiCleanup(GameContext.environmentAsteroids);
    GameContext.asteroidRespawnTimers = [];
    GameContext.baseRespawnTimers = [];
    GameContext.roamerRespawnQueue = [];
    clearArrayWithPixiCleanup(GameContext.caches);
    clearArrayWithPixiCleanup(GameContext.powerups);
    clearArrayWithPixiCleanup(GameContext.shootingStars);
    clearArrayWithPixiCleanup(GameContext.drones);
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.activeContract = null;
    GameContext.nextContractAt = Date.now() + 30000;
    GameContext.radiationStorm = null;
    scheduleNextRadiationStorm(Date.now() + 15000);
    clearMiniEvent();
    GameContext.nextMiniEventAt = Date.now() + 120000;
    scheduleNextMiniEvent(Date.now() + 20000);
    clearArrayWithPixiCleanup(GameContext.pois);
    GameContext.warpCompletedOnce = false;
    GameContext.caveMode = false;
    GameContext.caveLevel = null;
    GameContext.warpGateUnlocked = false;

    // Avoid rebuilding stars/nebula when entering Sector 2 cave (background is hidden there).
    if (GameContext.sectorIndex !== 2) initStars(width, height); // update nebula palette

    // Sector 2: long cave run instead of open space.
    if (GameContext.sectorIndex === 2) {
        startCaveSector2();
        GameContext.dreadManager.timerActive = false;
        GameContext.dreadManager.timerAt = null;
        GameContext.cruiserTimerPausedAt = null;
        stopArenaCountdown();
        return;
    }

    generateMap();
    for (let i = 0; i < 3; i++) spawnNewPinwheelRelative(true);
    GameContext.gunboatRespawnAt = Date.now() + 5000;
    GameContext.gunboatLevel2Unlocked = true; // level 2 gunboats allowed after warp
    // Restart cruiser timer for the new sector
    GameContext.dreadManager.timerActive = true;
    GameContext.cruiserTimerPausedAt = null;
    const firstCruiserGraceMs = 180000; // 3 minutes breathing room after entering a new sector
    const baseDelay = GameContext.dreadManager.minDelayMs + Math.floor(Math.random() * (GameContext.dreadManager.maxDelayMs - GameContext.dreadManager.minDelayMs + 1));
    GameContext.dreadManager.timerAt = Date.now() + Math.max(firstCruiserGraceMs, baseDelay);

    // Stations for new sector
    GameContext.pendingStations = 0;
    if (GameContext.spaceStation) pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    GameContext.nextSpaceStationTime = null;
    if (GameContext.destroyer) pixiCleanupObject(GameContext.destroyer);
    GameContext.destroyer = null;
    GameContext.nextDestroyerSpawnTime = null;
    scheduleNextShootingStar();
    showOverlayMessage("NEW SECTOR ENTERED", '#0ff', 3000);
}

function endGame(elapsedMs) {
    if (GameContext.gameEnded) return;
    GameContext.gameEnded = true;
    GameContext.gameActive = false;
    GameContext.gamePaused = false;
    GameContext.canResumeGame = false; // Game ended - can't resume
    stopMusic();
    try {
        depositMetaNuggetsSystem();
    } catch (e) { console.warn('meta deposit failed', e); }
    // Save both game profile and meta profile (store upgrades)
    if (GameContext.currentProfileName) {
        try {
            autoSaveToCurrentProfile(); // Saves game state
            saveMetaProfileSystem();          // Saves meta shop upgrades
        } catch (e) { console.warn('save on end game failed', e); }
    }
    const endEl = document.getElementById('end-screen');
    if (endEl) endEl.style.display = 'block';
    const startEl = document.getElementById('start-screen');
    if (startEl) startEl.style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    const t = document.getElementById('end-time');
    const sc = document.getElementById('end-score');
    const ng = document.getElementById('end-nuggets');
    if (t) t.innerText = formatTime(elapsedMs);
    if (sc) sc.innerText = GameContext.score;
    if (ng) ng.innerText = GameContext.spaceNuggets;
    setTimeout(() => {
        const btn = document.getElementById('restart-btn');
        if (btn) btn.focus();
    }, 100);

    // Update resume button state
    if (window.updateResumeButtonState) {
        window.updateResumeButtonState();
    }
}

function handleSpaceStationDestroyed() {
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

window.addEventListener('resize', resize);
resize();

function checkDespawn(entity, range = 6000) {
    if (!GameContext.player) return;
    const dist = Math.hypot(entity.pos.x - GameContext.player.pos.x, entity.pos.y - GameContext.player.pos.y);
    if (dist > range) {
        entity.dead = true;
    }
}


// --- Map Entities ---
// EnvironmentAsteroid class imported from entities/environment/EnvironmentAsteroid.js

function generateMap() {
    clearArrayWithPixiCleanup(GameContext.environmentAsteroids);
    GameContext.asteroidRespawnTimers = [];
    clearArrayWithPixiCleanup(GameContext.caches);
    clearArrayWithPixiCleanup(GameContext.pois);
    for (let i = 0; i < 60; i++) {
        spawnOneAsteroidRelative(true);
    }
    spawnExplorationCaches();
    spawnSectorPOIs();
}









function rayCast(x1, y1, angle, maxDist) {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    let closest = { hit: false, dist: maxDist, x: x1 + vx * maxDist, y: y1 + vy * maxDist };

    for (let ast of GameContext.environmentAsteroids) {
        const cx = ast.pos.x;
        const cy = ast.pos.y;
        const r = ast.radius;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = vx * vx + vy * vy;
        const b = 2 * (fx * vx + fy * vy);
        const c = (fx * fx + fy * fy) - r * r;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
            let t = -1;
            if (t1 >= 0 && t1 <= maxDist) t = t1;
            else if (t2 >= 0 && t2 <= maxDist) t = t2;
            if (t >= 0 && t < closest.dist) {
                closest.hit = true;
                closest.dist = t;
                closest.x = x1 + vx * t;
                closest.y = y1 + vy * t;
                closest.obj = ast;
            }
        }
    }
    return closest;
}

// Player sprite is rendered larger than its physics radius; scale shield radii to match visuals.

function applyAOEDamageToPlayer(aoeX, aoeY, aoeRadius, totalDamage) {
    if (!GameContext.player || GameContext.player.dead) return;

    let remainingDamage = Math.max(0, Math.ceil(totalDamage));
    const playerAngleToAOE = Math.atan2(aoeY - GameContext.player.pos.y, aoeX - GameContext.player.pos.x);

    // Check outer shields first
    if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.some(s => s > 0)) {
        const shieldAngle = playerAngleToAOE - GameContext.player.outerShieldRotation;
        const normalizedAngle = (shieldAngle + Math.PI * 2) % (Math.PI * 2);
        const segCount = GameContext.player.outerShieldSegments.length;

        // Calculate the arc of shield segments hit by the AOE
        const arcWidth = Math.atan2(aoeRadius, GameContext.player.outerShieldRadius) * 2;
        const startAngle = normalizedAngle - arcWidth / 2;
        const endAngle = normalizedAngle + arcWidth / 2;

        // Damage all segments within the AOE arc
        for (let i = 0; i < segCount && remainingDamage > 0; i++) {
            const segAngle = (i / segCount) * Math.PI * 2;
            // Check if this segment is within the AOE arc
            let angleDiff = Math.abs(segAngle - startAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff <= arcWidth / 2 && GameContext.player.outerShieldSegments[i] > 0) {
                const absorb = Math.min(remainingDamage, GameContext.player.outerShieldSegments[i]);
                GameContext.player.outerShieldSegments[i] -= absorb;
                remainingDamage -= absorb;
                GameContext.player.shieldsDirty = true;
            }
        }
    }

    // Check inner shields
    if (GameContext.player.shieldSegments && remainingDamage > 0) {
        const shieldAngle = playerAngleToAOE - GameContext.player.shieldRotation;
        const normalizedAngle = (shieldAngle + Math.PI * 2) % (Math.PI * 2);
        const segCount = GameContext.player.shieldSegments.length;

        const arcWidth = Math.atan2(aoeRadius, GameContext.player.shieldRadius) * 2;
        const startAngle = normalizedAngle - arcWidth / 2;
        const endAngle = normalizedAngle + arcWidth / 2;

        for (let i = 0; i < segCount && remainingDamage > 0; i++) {
            const segAngle = (i / segCount) * Math.PI * 2;
            let angleDiff = Math.abs(segAngle - startAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff <= arcWidth / 2 && GameContext.player.shieldSegments[i] > 0) {
                const absorb = Math.min(remainingDamage, GameContext.player.shieldSegments[i]);
                GameContext.player.shieldSegments[i] -= absorb;
                remainingDamage -= absorb;
                GameContext.player.shieldsDirty = true;
            }
        }
    }

    // Apply remaining damage to player (shields already handled, don't pierce)
    if (remainingDamage > 0) {
        GameContext.player.takeHit(remainingDamage);
    }
}

class ShootingStar extends Entity {
    constructor() {
        super(0, 0);
        this.isShootingStar = true;
        const angle = Math.random() * Math.PI * 2;
        const dist = 2500; // Start far out
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;

        // Aim somewhat near the player
        const targetX = GameContext.player.pos.x + (Math.random() - 0.5) * 1000;
        const targetY = GameContext.player.pos.y + (Math.random() - 0.5) * 1000;
        const travelAngle = Math.atan2(targetY - this.pos.y, targetX - this.pos.x);

        this.vel.x = Math.cos(travelAngle) * 15; // 50% slower
        this.vel.y = Math.sin(travelAngle) * 15;

        this.radius = 40;
        this.damage = 10;
        this.hp = 3;
        this.life = 300; // 5 seconds at 60fps
        this._pixiGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        // Use Entity.update for scaled movement
        super.update(deltaTime);
        const dtFactor = deltaTime / 16.67;
        this.life -= dtFactor;
        if (this.life <= 0) this.kill(false);

        // Trail
        for (let i = 0; i < 5; i++) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 20,
                this.pos.y + (Math.random() - 0.5) * 20,
                -this.vel.x * 0.2 + (Math.random() - 0.5) * 2,
                -this.vel.y * 0.2 + (Math.random() - 0.5) * 2,
                '#ffaa00',
                30
            );
        }
    }

    takeHit(dmg = 1) {
        if (this.dead) return;
        this.hp -= dmg;
        if (this.hp <= 0) this.kill(true);
    }

    kill(dropNugz = false) {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        if (dropNugz) {
            spawnAsteroidExplosion(this.pos.x, this.pos.y, 1.4);
            const count = Math.floor(Math.random() * 7);
            for (let i = 0; i < count; i++) {
                GameContext.nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 80, this.pos.y + (Math.random() - 0.5) * 80, 1));
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const rPos = this.getRenderPos(renderAlpha);

        if (pixiBulletLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                // Simple glowing ball
                g.beginFill(0xffffff, 0.2); // Outer
                g.drawCircle(0, 0, 40);
                g.beginFill(0xffaa00, 0.4); // Mid
                g.drawCircle(0, 0, 25);
                g.beginFill(0xffffff, 0.8); // Core
                g.drawCircle(0, 0, 10);

                pixiBulletLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.position.set(rPos.x, rPos.y);
            return;
        }
    }
}

// SpaceNugget imported from ./entities/index.js

class WarpGate extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 140;
        this.t = 0;
        this.mode = 'entry';
    }
    update(deltaTime = SIM_STEP_MS) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (suppressWarpGateUntil && getGameNowMs() < suppressWarpGateUntil) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist > this.radius + GameContext.player.radius) return;

        if (GameContext.warpCompletedOnce) {
            showOverlayMessage("WARP ALREADY USED THIS SECTOR", '#f80', 1200, 2);
            return;
        }
        if (GameContext.warpZone && GameContext.warpZone.active) return;
        showOverlayMessage("WARP INITIATED", '#0ff', 1400, 3);
        playSound('contract');
        enterWarpMaze();
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiWorldRoot) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiWorldRoot.addChildAt(container, 1); // Add behind players/enemies ideally

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center',
                    dropShadow: true,
                    dropShadowColor: '#000000',
                    dropShadowBlur: 4,
                    dropShadowDistance: 0
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const g = this._pixiGfx;
            g.clear();
            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.45;
            const gateColor = 0xff8800;

            // Glow Ring
            g.lineStyle(6, gateColor, 0.35 + pulse);
            g.drawCircle(0, 0, this.radius);

            // Inner Fill
            g.beginFill(gateColor, 0.08);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Text
            const t = this._pixiText;
            t.text = this.mode === 'exit' ? 'EXIT' : 'WARP';

            return;
        }
    }
}

class Dungeon1Gate extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 140;
        this.t = 0;
        this.mode = 'entry';
    }
    update(deltaTime = SIM_STEP_MS) {
        if (!GameContext.player || GameContext.player.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist > this.radius + GameContext.player.radius) return;

        if (GameContext.dungeon1CompletedOnce) {
            showOverlayMessage("DUNGEON ALREADY CLEARED", '#f80', 1200, 2);
            return;
        }
        if (GameContext.dungeon1Zone && GameContext.dungeon1Zone.active) return;
        showOverlayMessage("ENTERING DUNGEON 1...", '#f80', 1400, 3);
        playSound('contract');
        _enterDungeon1Internal();
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiWorldRoot) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiWorldRoot.addChildAt(container, 1);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center',
                    dropShadow: true,
                    dropShadowColor: '#000000',
                    dropShadowBlur: 4,
                    dropShadowDistance: 0
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const g = this._pixiGfx;
            g.clear();
            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.45;
            const gateColor = 0xff8800; // Orange/gold for dungeon

            // Glow Ring
            g.lineStyle(6, gateColor, 0.35 + pulse);
            g.drawCircle(0, 0, this.radius);

            // Inner Fill
            g.beginFill(gateColor, 0.08);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Text
            const t = this._pixiText;
            t.text = 'DUNGEON';

            return;
        }
    }
}

function beginFlagshipFight(cx, cy, radius = 1875) {
    if (GameContext.bossActive || GameContext.sectorTransitionActive) return;

    // Start the fight without wiping the whole world (regular asteroids + roaming enemies remain).
    boss = new Flagship({ x: cx, y: cy - 2200 });
    GameContext.bossActive = true;
    GameContext.bossArena.x = cx;
    GameContext.bossArena.y = cy;
    GameContext.bossArena.radius = radius;
    GameContext.bossArena.active = true;
    GameContext.bossArena.growing = false;

    // Don't let the cruiser timer trigger during a flagship boss.
    try { GameContext.dreadManager.timerActive = false; GameContext.dreadManager.timerAt = null; } catch (e) { }
    stopArenaCountdown();

    showOverlayMessage("WARNING: FLAGSHIP ENGAGED - ARENA LOCKED", '#f0f', 4500, 2);
    playSound('boss_spawn');
    if (musicEnabled) setMusicMode('cruiser');
}

function startCaveSector2() {
    // Ensure no world-mode carryover. 
    resetWarpState();
    GameContext.caveMode = true;
    GameContext.caveLevel = new Cave.CaveLevel();
    GameContext.caveLevel.generate();
    clearArrayWithPixiCleanup(GameContext.coins);

    // Disable contracts/events for the cave run.
    GameContext.activeContract = null;
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.nextContractAt = Date.now() + 999999999;
    GameContext.radiationStorm = null;
    GameContext.nextRadiationStormAt = null;
    clearMiniEvent();
    GameContext.nextMiniEventAt = Date.now() + 999999999;
    GameContext.nextShootingStarTime = Date.now() + 999999999;
    GameContext.intensityBreakActive = false;
    GameContext.nextIntensityBreakAt = Date.now() + 999999999;

    // Keep bases in the cave (Sector 1 feel), but no stations/contracts. 
    clearArrayWithPixiCleanup(GameContext.pinwheels);
    GameContext.baseRespawnTimers = [];
    GameContext.roamerRespawnQueue = [];
    GameContext.maxRoamers = 0;
    GameContext.initialSpawnDone = true;
    GameContext.initialSpawnDelayAt = null;
    GameContext.pendingStations = 0;
    if (GameContext.spaceStation) pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    GameContext.nextSpaceStationTime = null;

    // Ensure no destroyers in cave mode
    if (GameContext.destroyer) pixiCleanupObject(GameContext.destroyer);
    GameContext.destroyer = null;
    GameContext.nextDestroyerSpawnTime = null;

    // Place player at the cave start (bottom), facing upward.
    GameContext.player.pos.x = GameContext.caveLevel.startX;
    GameContext.player.pos.y = GameContext.caveLevel.startY + 600;
    GameContext.player.vel.x = 0;
    GameContext.player.vel.y = 0;
    GameContext.player.angle = -Math.PI / 2;
    GameContext.player.turretAngle = -Math.PI / 2;

    GameContext.caveLevel.resetFireWall(GameContext.player.pos.y);

    // Seed a few pinwheels up the tunnel (they'll also respawn via the normal pinwheel timer loop).
    for (let i = 0; i < 3; i++) spawnNewPinwheelRelative(true);

    showOverlayMessage("SECTOR 2: CAVE RUN - FLY UPWARD", '#0ff', 3200, 2);
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    let t = 0;
    if (abLenSq > 0.000001) t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return { x: ax + abx * t, y: ay + aby * t, t };
}

function resolveCircleSegment(entity, ax, ay, bx, by, elasticity = 0.7) {
    const cp = closestPointOnSegment(entity.pos.x, entity.pos.y, ax, ay, bx, by);
    let dx = entity.pos.x - cp.x;
    let dy = entity.pos.y - cp.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
        // Fallback: choose a stable normal.
        const sx = bx - ax;
        const sy = by - ay;
        const nLen = Math.hypot(sx, sy) || 1;
        dx = -sy / nLen;
        dy = sx / nLen;
        dist = 1;
    }
    const pad = 0.5;
    const minDist = (entity.radius || 0) + pad;
    if (dist >= minDist) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    entity.pos.x += nx * overlap;
    entity.pos.y += ny * overlap;

    if (entity.vel) {
        const vn = entity.vel.x * nx + entity.vel.y * ny;
        if (vn < 0) {
            entity.vel.x -= nx * vn * (1 + elasticity);
            entity.vel.y -= ny * vn * (1 + elasticity);
        }
    }
    return true;
}

class WarpTurret extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 24;
        this.hp = 7;
        this.maxHp = 7;
        this.reload = 35 + Math.floor(Math.random() * 25);
        this.t = 0;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.warpZone || !GameContext.warpZone.active) return;
        if (!GameContext.player || GameContext.player.dead) return;
        // Keep maze turrets as "obstacles", not part of the boss arena phase.
        if (GameContext.warpZone.state === 'boss') return;

        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist > 4200) return;

        this.reload -= dtFactor;
        if (this.reload > 0) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
        const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
        GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#0ff' }));
        if (Math.random() < 0.18) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.10, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#0ff' }));
        if (Math.random() < 0.18) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.10, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#0ff' }));
        this.reload = 48 + Math.floor(Math.random() * 35);
    }
    draw(ctx) {
        if (this.dead) return;
        const z = GameContext.currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;
        ctx.rotate(aim);

        ctx.fillStyle = '#061018';
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2 / z;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0ff';
        ctx.shadowBlur = 0;
        ctx.fillRect(this.radius * 0.2, -4 / z, this.radius * 1.35, 8 / z);

        // HP ring
        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#ff6';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + (8 / z), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.restore();
    }
    kill() {
        if (this.dead) return;
        this.dead = true;
        // No coin drops in the cave; award instantly instead. 
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) awardCoinsInstant(6);
        else for (let i = 0; i < 3; i++) GameContext.coins.push(new Coin(this.pos.x, this.pos.y, 2));
        spawnParticles(this.pos.x, this.pos.y, 18, '#0ff');
        playSound('explode');
    }
}

class MiniEventDefendCache extends Entity {
    constructor(x, y) {
        super(x, y);
        this.kind = 'defend_cache';
        this.radius = 520;
        this.requiredMs = 5000;
        this.progressMs = 0;
        this.expiresAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now()) + 75000;
        this.lastUpdateAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        this.nextWaveAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now()) + 1500;
        this.activated = false;
        this.t = 0;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiProgressGfx = null;
        this._pixiLabelText = null;
        this._pixiTimerText = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        // Ensure all Pixi graphics are hidden before cleanup to prevent visual artifacts
        if (this._pixiGfx && this._pixiGfx.visible !== false) {
            this._pixiGfx.visible = false;
        }
        if (this._pixiProgressGfx && this._pixiProgressGfx.visible !== false) {
            this._pixiProgressGfx.visible = false;
        }
        if (this._pixiLabelText && this._pixiLabelText.visible !== false) {
            this._pixiLabelText.visible = false;
        }
        if (this._pixiTimerText && this._pixiTimerText.visible !== false) {
            this._pixiTimerText.visible = false;
        }
        pixiCleanupObject(this);
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        // Save previous position for interpolation (required for fixed timestep rendering)
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        if (!GameContext.player || GameContext.player.dead) { this.fail(); return; }
        const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        const dt = Math.min(120, Math.max(0, now - this.lastUpdateAt));
        this.lastUpdateAt = now;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (!this.activated && d < 900) {
            this.activated = true;
            showOverlayMessage("DEFEND THE CACHE - HOLD POSITION", '#ff0', 1500, 1);
        }

        if (now >= this.expiresAt) {
            this.fail();
            return;
        }

        if (d < this.radius) {
            this.progressMs += dt;
        }

        if (this.activated && now >= this.nextWaveAt) {
            this.spawnWave();
            this.nextWaveAt = now + 2600 + Math.floor(Math.random() * 1600);
        }

        if (this.progressMs >= this.requiredMs) {
            this.success();
        }
    }
    spawnWave() {
        const cap = 22;
        if (GameContext.enemies.length >= cap) return;
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            if (GameContext.enemies.length >= cap) break;
            const a = Math.random() * Math.PI * 2;
            const dist = 900 + Math.random() * 600;
            const sx = this.pos.x + Math.cos(a) * dist;
            const sy = this.pos.y + Math.sin(a) * dist;
            GameContext.enemies.push(new Enemy('roamer', { x: sx, y: sy }));
        }
    }
    success() {
        if (this.dead) return;
        this.kill();
        showOverlayMessage("EVENT COMPLETE - CACHE SECURED", '#0f0', 2200, 1);
        playSound('powerup');
        GameContext.player.addXp(60);
        spawnParticles(this.pos.x, this.pos.y, 40, '#ff0');
        for (let i = 0; i < 10; i++) GameContext.coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 220, this.pos.y + (Math.random() - 0.5) * 220, 8));
    }
    fail() {
        if (this.dead) return;
        this.kill();
        showOverlayMessage("EVENT FAILED", '#f00', 2000, 1);
    }
    getUiText() {
        const pct = Math.max(0, Math.min(100, Math.floor((this.progressMs / this.requiredMs) * 100)));
        return `EVENT: DEFEND CACHE ${pct}%`;
    }
    draw(ctx) {
        if (this.dead) return;

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            if (!this._pixiProgressGfx) {
                this._pixiProgressGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiProgressGfx);
            }
            if (!this._pixiLabelText) {
                this._pixiLabelText = new PIXI.Text("DEFEND", { fontFamily: 'Courier New', fontSize: 48, fill: 0xffff00, fontWeight: 'bold' });
                this._pixiLabelText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiLabelText);
            }
            if (!this._pixiTimerText) {
                this._pixiTimerText = new PIXI.Text("", { fontFamily: 'Courier New', fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
                this._pixiTimerText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiTimerText);
            }

            const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
            const remain = Math.max(0, this.expiresAt - now);
            const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
            const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;

            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiProgressGfx.position.set(this.pos.x, this.pos.y);
            this._pixiLabelText.position.set(this.pos.x, this.pos.y - this.radius - 64);
            this._pixiTimerText.position.set(this.pos.x, this.pos.y - this.radius - 26);

            this._pixiGfx.clear();
            // boundary
            this._pixiGfx.lineStyle(6 / (GameContext.currentZoom || 1), 0xffdc00, 0.45);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            // central area
            this._pixiGfx.beginFill(0xffff00, 0.35 * pulse);
            this._pixiGfx.drawCircle(0, 0, 54);
            this._pixiGfx.endFill();

            // progress
            this._pixiProgressGfx.clear();
            this._pixiProgressGfx.lineStyle(8 / (GameContext.currentZoom || 1), 0x00ff00, 0.6);
            this._pixiProgressGfx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);

            this._pixiTimerText.text = `${(remain / 1000).toFixed(0)}s`;
            return;
        }

        const now = Date.now();
        const remain = Math.max(0, this.expiresAt - now);
        const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
        const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 6;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = 'rgba(255, 220, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();

        ctx.globalAlpha = 0.35 * pulse;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("DEFEND", 0, -this.radius - 64);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Courier New';
        ctx.fillText(`${(remain / 1000).toFixed(0)}s`, 0, -this.radius - 26);

        ctx.restore();
    }
}

class SectorPOI extends Entity {
    constructor(x, y, name, color = '#0ff', radius = 170) {
        super(x, y);
        this.kind = 'poi';
        this.name = name;
        this.color = color;
        this.radius = radius;
        this.claimed = false;
        this.t = 0;
        this.rewardXp = 20;
        this.rewardCoins = 30;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiNameText = null;
    }
    kill() {
        if (this.dead) {
            // Already dead, but still need to clean up Pixi graphics
            // Check if cleanup has already been done to avoid double-cleanup
            if (!this._pixiIsCleaning) {
                pixiCleanupObject(this);
            }
            return;
        }
        this.dead = true;
        pixiCleanupObject(this);
    }
    canClaim() {
        if (!GameContext.player || GameContext.player.dead) return false;
        if (this.claimed) return false;
        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        return d <= this.radius + GameContext.player.radius;
    }
    claim() {
        if (this.claimed) return;
        this.claimed = true;
        showOverlayMessage(`POI CLEARED: ${this.name}`, '#0ff', 1600, 1);
        playSound('powerup');
        if (GameContext.player) GameContext.player.addXp(this.rewardXp);
        const coinsToSpawn = Math.max(1, Math.floor(this.rewardCoins / 8));
        for (let i = 0; i < coinsToSpawn; i++) {
            GameContext.coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 220, this.pos.y + (Math.random() - 0.5) * 220, 8));
        }
        spawnParticles(this.pos.x, this.pos.y, 30, this.color);
        this.dead = true;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        // Save previous position for interpolation (required for fixed timestep rendering)
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (this.canClaim()) this.claim();
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            // Hide all Pixi graphics when dead or claimed
            if (this._pixiGfx) this._pixiGfx.visible = false;
            if (this._pixiNameText) this._pixiNameText.visible = false;
            return;
        }

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            if (!this._pixiNameText) {
                const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;
                this._pixiNameText = new PIXI.Text(this.name, { fontFamily: 'Courier New', fontSize: 42, fill: c, fontWeight: 'bold' });
                this._pixiNameText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiNameText);
            }
            this._pixiGfx.visible = true;
            this._pixiNameText.visible = true;

            const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
            const rPos = this.getRenderPos(renderAlpha);
            this._pixiGfx.position.set(rPos.x, rPos.y);
            this._pixiNameText.position.set(rPos.x, rPos.y - this.radius - 18);

            this._pixiGfx.clear();
            const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;

            // boundary
            this._pixiGfx.lineStyle(5 / (GameContext.currentZoom || 1), c, 0.35 + pulse * 0.15);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            // center diamond
            this._pixiGfx.lineStyle(2 / (GameContext.currentZoom || 1), 0xffffff, 1.0);
            this._pixiGfx.beginFill(c, 1.0);
            this._pixiGfx.moveTo(0, -18);
            this._pixiGfx.lineTo(16, 0);
            this._pixiGfx.lineTo(0, 18);
            this._pixiGfx.lineTo(-16, 0);
            this._pixiGfx.closePath();
            this._pixiGfx.endFill();
            return;
        }

        const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.35 + pulse * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.font = 'bold 42px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 0, -this.radius - 18);
        ctx.restore();
    }
}

class DerelictShipPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DERELICT SHIP', '#0ff', 160);
        this.rewardXp = 25;
        this.rewardCoins = 32;
    }
}

class DebrisFieldPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DEBRIS FIELD', '#fa0', 220);
        this.rewardXp = 20;
        this.rewardCoins = 40;
        this.captureMsRequired = 3000;
        this.captureMs = 0;
        this.captureActive = false;
        this.lastUpdateAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead || this.claimed) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.player || GameContext.player.dead) return;
        const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        const dt = Math.min(120, Math.max(0, now - (this.lastUpdateAt || now)));
        this.lastUpdateAt = now;

        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        const inside = d <= this.radius + GameContext.player.radius;
        if (inside) {
            if (!this.captureActive) {
                this.captureActive = true;
                this.captureMs = 0;
            }
            this.captureMs += dt;
            if (this.captureMs >= this.captureMsRequired) this.claim();
        } else {
            this.captureActive = false;
            this.captureMs = 0;
        }
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            // Hide and cleanup all Pixi graphics when dead or claimed
            if (this._pixiProgressGfx) {
                this._pixiProgressGfx.visible = false;
            }
            if (this._pixiGfx) {
                this._pixiGfx.visible = false;
            }
            if (this._pixiNameText) {
                this._pixiNameText.visible = false;
            }
            return;
        }
        super.draw(ctx);

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiProgressGfx) {
                this._pixiProgressGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiProgressGfx);
            }
            const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
            this._pixiProgressGfx.clear();
            if (pct > 0) {
                this._pixiProgressGfx.visible = true;
                this._pixiProgressGfx.position.set(this.pos.x, this.pos.y);
                this._pixiProgressGfx.lineStyle(10 / (GameContext.currentZoom || 1), 0x00ff00, 0.65);
                this._pixiProgressGfx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            } else {
                this._pixiProgressGfx.visible = false;
            }
            return;
        }

        const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
        if (pct <= 0) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.65)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    kill() {
        if (this.dead) {
            // Already dead, but still need to clean up DebrisFieldPOI-specific graphics
            if (!this._pixiIsCleaning) {
                // Clean up ALL Pixi graphics
                if (this._pixiProgressGfx) {
                    try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) { }
                    this._pixiProgressGfx = null;
                }
                if (this._pixiGfx) {
                    try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
                    this._pixiGfx = null;
                }
                if (this._pixiNameText) {
                    try { this._pixiNameText.destroy(); } catch (e) { }
                    this._pixiNameText = null;
                }
            }
            return;
        }
        super.kill();
        // Clean up ALL Pixi graphics
        if (this._pixiProgressGfx) {
            try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) { }
            this._pixiProgressGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(); } catch (e) { }
            this._pixiNameText = null;
        }
    }
}

class ExplorationCache extends Entity {
    constructor(x, y, contractId = null) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.contractId = contractId;
        this.radius = 12;
        this.vel.x = (Math.random() - 0.5) * 0.3;
        this.vel.y = (Math.random() - 0.5) * 0.3;
        this.magnetized = false;
        this.flash = 0;
        this.value = 2 + Math.floor(Math.random() * 3); // 2-4 nuggets
        this.sprite = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        pixiCleanupObject(this);
    }
    update(deltaTime = SIM_STEP_MS) {
        if (!GameContext.player || GameContext.player.dead) return;
        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist < GameContext.player.magnetRadius) this.magnetized = true;
        if (this.magnetized) {
            const a = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
            const speed = 8 + (800 / Math.max(10, dist));
            this.vel.x = Math.cos(a) * speed;
            this.vel.y = Math.sin(a) * speed;
        } else {
            this.vel.mult(0.99);
        }
        this.pos.add(this.vel);
        this.flash++;
    }
    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        if (pixiResources?.layer && pixiResources?.textures?.nugget) {
            const tex = pixiResources.textures.nugget;
            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
                this.sprite = spr;
            }
            if (spr) {
                if (!spr.parent) pixiResources.layer.addChild(spr);
                spr.visible = true;
                spr.position.set(this.pos.x, this.pos.y);
                const pulse = 1.0 + Math.sin(this.flash * 0.1) * 0.15;
                const targetRadius = 25; // 50% smaller cache nugz.
                const base = (targetRadius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(base * pulse);
                spr.rotation = this.flash * 0.05;
                spr.tint = 0xffffff;
                spr.alpha = 1;
                if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                return;
            }
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = (1.0 + Math.sin(this.flash * 0.1) * 0.15) * 0.5;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        const grad = ctx.createLinearGradient(-12, -12, 12, 12);
        grad.addColorStop(0, '#ff0');
        grad.addColorStop(0.5, '#ffa500');
        grad.addColorStop(1, '#0ff');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

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

function compactArray(arr) {
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

// NOTE: snapshotWorldForWarp removed - we no longer save/restore level 1 state
// Level 1 is deleted when entering warp zone
// Level 1 is deleted when entering warp zone

function enterWarpMaze() {
    if (GameContext.warpZone && GameContext.warpZone.active) return;
    if (GameContext.warpCompletedOnce) {
        showOverlayMessage("WARP ALREADY USED THIS SECTOR", '#f80', 1200, 2);
        return;
    }
    GameContext.warpCompletedOnce = true;

    // Clear world to make a controlled encounter space - NO SNAPSHOT, level 1 is deleted
    resetPixiOverlaySprites();
    const detach = (arr) => {
        if (!arr || arr.length === 0) return;
        for (let i = 0; i < arr.length; i++) pixiCleanupObject(arr[i]);
    };
    detach(GameContext.bullets);
    detach(GameContext.bossBombs);
    detach(GameContext.warpBioPods);
    detach(GameContext.guidedMissiles);
    detach(GameContext.enemies);
    detach(GameContext.pinwheels);
    detach(GameContext.particles);
    detach(GameContext.explosions);
    detach(GameContext.floatingTexts);
    detach(GameContext.coins);
    detach(GameContext.nuggets);
    detach(GameContext.powerups);
    detach(GameContext.shootingStars);
    detach(GameContext.drones);
    detach(GameContext.caches);
    detach(GameContext.pois);
    detach(GameContext.environmentAsteroids);

    GameContext.bullets = [];
    GameContext.bossBombs = [];
    GameContext.warpBioPods = [];
    GameContext.staggeredBombExplosions = [];
    GameContext.staggeredParticleBursts = [];
    GameContext.guidedMissiles = [];
    GameContext.enemies = [];
    GameContext.pinwheels = [];
    GameContext.particles = [];
    GameContext.explosions = [];
    GameContext.floatingTexts = [];
    GameContext.coins = [];
    GameContext.nuggets = [];
    GameContext.powerups = [];
    GameContext.shootingStars = [];
    GameContext.drones = [];
    GameContext.caches = [];
    GameContext.pois = [];
    GameContext.environmentAsteroids = [];
    GameContext.asteroidRespawnTimers = [];
    GameContext.baseRespawnTimers = [];

    GameContext.radiationStorm = null;
    clearMiniEvent();

    // Reset cave state so cave walls don't persist in warp level
    resetCaveState();

    GameContext.activeContract = null;
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.nextContractAt = Date.now() + 999999999;

    if (GameContext.destroyer) {
        if (GameContext.destroyer.pixiCleanupObject && typeof GameContext.destroyer.pixiCleanupObject === 'function') {
            GameContext.destroyer.pixiCleanupObject();
        }
        GameContext.destroyer = null;
    }

    if (GameContext.boss) pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;
    GameContext.bossActive = false;
    GameContext.bossArena.active = false;
    GameContext.bossArena.growing = false;

    if (GameContext.spaceStation) pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    GameContext.pendingStations = 0;
    GameContext.nextSpaceStationTime = null;
    GameContext.roamerRespawnQueue = [];
    GameContext.maxRoamers = 0;
    GameContext.gunboatRespawnAt = null;

    // Spawn warp zone at origin since we're deleting level 1 anyway
    const originX = 0;
    const originY = 0;
    GameContext.warpZone = new WarpMazeZone(originX, originY);
    GameContext.warpZone.generate();
    GameContext.warpZone.state = 'boss_intro';
    GameContext.warpZone.bossIntroAt = Date.now() + 10000;
    GameContext.warpZone.bossIntroLastSec = null;


    // Place the player at the entrance.
    GameContext.player.pos.x = GameContext.warpZone.entrancePos.x;
    GameContext.player.pos.y = GameContext.warpZone.entrancePos.y;
    GameContext.player.vel.x = 0;
    GameContext.player.vel.y = 0;

    // Seed warp asteroids to reduced density (and let runtime spawning maintain it). 
    let seedTries = 0;
    while (GameContext.environmentAsteroids.length < 50 && seedTries < 800) {
        spawnOneWarpAsteroidRelative(true);
        seedTries++;
    }

}

function resetWarpState() {
    // Hard-reset all warp state so a fresh run can't inherit "in-warp" flags. 
    try { if (GameContext.warpZone) GameContext.warpZone.active = false; } catch (e) { }
    GameContext.warpZone = null;
    if (GameContext.warpGate) pixiCleanupObject(GameContext.warpGate);
    GameContext.warpGate = null;
}

function resetCaveState() {
    // Hard-reset all cave state so a fresh run can't inherit cave flags/walls/clipping. 
    try { if (GameContext.caveLevel) GameContext.caveLevel.active = false; } catch (e) { }
    GameContext.caveMode = false;
    GameContext.caveLevel = null;
}

function exitWarpMaze() {
    if (!GameContext.warpZone || !GameContext.warpZone.active) return;
    const completedRun = !!(GameContext.warpZone && GameContext.warpZone.exitUnlocked);
    if (GameContext.warpZone && GameContext.warpZone.active) GameContext.warpZone.active = false;

    // CLEANUP FIX: Properly clean up all warp entities before restoring snapshot
    // This prevents frozen sprites appearing on screen after warp exit
    console.log('[WARP EXIT] Cleaning up warp entities before restoring snapshot...');

    // Clean up warp gate if it exists
    if (GameContext.warpGate) {
        pixiCleanupObject(GameContext.warpGate);
        GameContext.warpGate = null;
        console.log('[WARP EXIT] Cleaned warp gate');
    }

    // Clean up warp zone and its entities
    if (GameContext.warpZone) {
        // Clean up warp turrets
        if (GameContext.warpZone.turrets && GameContext.warpZone.turrets.length > 0) {
            for (let i = 0; i < GameContext.warpZone.turrets.length; i++) {
                const turret = GameContext.warpZone.turrets[i];
                if (turret) {
                    try {
                        pixiCleanupObject(turret);
                    } catch (e) {
                        console.warn('[WARP EXIT] Failed to clean turret:', e);
                    }
                }
            }
            GameContext.warpZone.turrets = [];
            console.log('[WARP EXIT] Cleaned warp turrets');
        }

        // Clean up warp zone graphics
        if (GameContext.warpZone._pixiGfx) {
            try { GameContext.warpZone._pixiGfx.destroy(true); } catch (e) { }
            GameContext.warpZone._pixiGfx = null;
        }
    }

    // Clean up warp particles (separate array from regular particles)
    if (GameContext.warpParticles && GameContext.warpParticles.length > 0) {
        for (let i = 0; i < GameContext.warpParticles.length; i++) {
            const p = GameContext.warpParticles[i];
            if (p && p.sprite) {
                try {
                    releasePixiSprite(pixiParticleSpritePool, p.sprite);
                    p.sprite = null;
                } catch (e) {
                    console.warn('[WARP EXIT] Failed to clean warp particle sprite:', e);
                }
            }
        }
        GameContext.warpParticles.length = 0;
        console.log('[WARP EXIT] Cleaned warp particles');
    }

    // Clean up all current warp entities (these will be replaced by snapshot)
    const cleanupWarpArray = (arr, name) => {
        if (!arr || arr.length === 0) return;
        let cleaned = 0;
        for (let i = 0; i < arr.length; i++) {
            const entity = arr[i];
            if (entity) {
                try {
                    entity.dead = true;
                    pixiCleanupObject(entity);
                    cleaned++;
                } catch (e) {
                    console.warn(`[WARP EXIT] Failed to clean ${name}[${i}]:`, e);
                }
            }
        }
        console.log(`[WARP EXIT] Cleaned ${cleaned} ${name}`);
    };

    // Clean up all warp-specific entities
    cleanupWarpArray(GameContext.bullets, 'warp bullets');
    cleanupWarpArray(GameContext.bossBombs, 'warp boss bombs');
    cleanupWarpArray(GameContext.warpBioPods, 'warp bio pods');
    cleanupWarpArray(GameContext.staggeredBombExplosions, 'staggered bomb explosions');
    cleanupWarpArray(GameContext.staggeredParticleBursts, 'staggered particle bursts');
    cleanupWarpArray(GameContext.guidedMissiles, 'warp guided missiles');
    cleanupWarpArray(GameContext.enemies, 'warp enemies');
    cleanupWarpArray(GameContext.pinwheels, 'warp pinwheels');
    cleanupWarpArray(GameContext.particles, 'warp particles');
    cleanupWarpArray(GameContext.explosions, 'warp explosions');
    cleanupWarpArray(GameContext.floatingTexts, 'warp floating texts');
    cleanupWarpArray(GameContext.coins, 'warp coins');
    cleanupWarpArray(GameContext.nuggets, 'warp nuggets');
    cleanupWarpArray(GameContext.powerups, 'warp powerups');
    cleanupWarpArray(GameContext.shootingStars, 'warp shooting stars');
    cleanupWarpArray(GameContext.drones, 'warp drones');
    cleanupWarpArray(GameContext.caches, 'warp caches');
    cleanupWarpArray(GameContext.pois, 'warp POIs');
    cleanupWarpArray(GameContext.environmentAsteroids, 'warp asteroids');
    if (GameContext.boss && GameContext.boss.isWarpBoss) {
        try {
            GameContext.boss.dead = true;
            pixiCleanupObject(GameContext.boss);
        } catch (e) {
            console.warn('[WARP EXIT] Failed to clean warp boss:', e);
        }
        GameContext.boss = null;
        GameContext.bossActive = false;
    }

    // Clear the arrays
    GameContext.bullets.length = 0;
    GameContext.bossBombs.length = 0;
    GameContext.warpBioPods.length = 0;
    GameContext.staggeredBombExplosions.length = 0;
    GameContext.staggeredParticleBursts.length = 0;
    GameContext.guidedMissiles.length = 0;
    GameContext.napalmZones.length = 0;
    GameContext.enemies.length = 0;
    GameContext.pinwheels.length = 0;
    GameContext.particles.length = 0;
    GameContext.explosions.length = 0;
    GameContext.floatingTexts.length = 0;
    GameContext.coins.length = 0;
    GameContext.nuggets.length = 0;
    GameContext.powerups.length = 0;
    GameContext.shootingStars.length = 0;
    GameContext.drones.length = 0;
    GameContext.caches.length = 0;
    GameContext.pois.length = 0;
    GameContext.environmentAsteroids.length = 0;

    // Clear Pixi overlay sprites (includes warp zone walls/gates)
    resetPixiOverlaySprites();
    cleanupPixiWorldRootExtras();

    // NOTE: No longer restoring snapshots - we transition directly to level 2 after boss defeat
    // This entire function now just cleans up warp entities
    // The actual transition to level 2 is handled by sectorTransitionActive countdown in gameLoopLogic

    GameContext.warpZone = null;
    GameContext.warpGate = null;
}

function _enterDungeon1Internal() {
    if (GameContext.dungeon1Zone && GameContext.dungeon1Zone.active) return;
    if (GameContext.dungeon1CompletedOnce) {
        showOverlayMessage("DUNGEON ALREADY CLEARED", '#f80', 1200, 2);
        return;
    }

    // Store player's original position
    GameContext.dungeon1OriginalPos = { x: GameContext.player.pos.x, y: GameContext.player.pos.y };

    // Clear world to make a controlled encounter space
    resetPixiOverlaySprites();
    const detach = (arr) => {
        if (!arr || arr.length === 0) return;
        for (let i = 0; i < arr.length; i++) pixiCleanupObject(arr[i]);
    };
    detach(GameContext.bullets);
    detach(GameContext.bossBombs);
    detach(GameContext.warpBioPods);
    detach(GameContext.guidedMissiles);
    detach(GameContext.enemies);
    detach(GameContext.pinwheels);
    detach(GameContext.particles);
    detach(GameContext.explosions);
    detach(GameContext.floatingTexts);
    detach(GameContext.coins);
    detach(GameContext.nuggets);
    detach(GameContext.powerups);
    detach(GameContext.shootingStars);
    detach(GameContext.drones);
    detach(GameContext.caches);
    detach(GameContext.pois);
    detach(GameContext.environmentAsteroids);

    GameContext.bullets = [];
    GameContext.bossBombs = [];
    GameContext.warpBioPods = [];
    GameContext.staggeredBombExplosions = [];
    GameContext.staggeredParticleBursts = [];
    GameContext.guidedMissiles = [];
    GameContext.enemies = [];
    GameContext.pinwheels = [];
    GameContext.particles = [];
    GameContext.explosions = [];
    GameContext.floatingTexts = [];
    GameContext.coins = [];
    GameContext.nuggets = [];
    GameContext.powerups = [];
    GameContext.shootingStars = [];
    GameContext.drones = [];
    GameContext.caches = [];
    GameContext.pois = [];
    GameContext.environmentAsteroids = [];
    GameContext.asteroidRespawnTimers = [];
    GameContext.baseRespawnTimers = [];

    GameContext.radiationStorm = null;
    clearMiniEvent();

    // Reset cave state
    resetCaveState();

    GameContext.activeContract = null;
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.nextContractAt = Date.now() + 999999999;

    if (GameContext.destroyer) {
        if (GameContext.destroyer.pixiCleanupObject && typeof GameContext.destroyer.pixiCleanupObject === 'function') {
            GameContext.destroyer.pixiCleanupObject();
        }
        GameContext.destroyer = null;
    }

    if (GameContext.boss) pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;
    GameContext.bossActive = false;
    GameContext.bossArena.active = false;
    GameContext.bossArena.growing = false;

    if (GameContext.spaceStation) pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    GameContext.pendingStations = 0;
    GameContext.nextSpaceStationTime = null;
    GameContext.roamerRespawnQueue = [];
    GameContext.maxRoamers = 0;
    GameContext.gunboatRespawnAt = null;

    // Create dungeon zone at origin
    const originX = 0;
    const originY = 0;
    GameContext.dungeon1Zone = new Dungeon1Zone(originX, originY);
    GameContext.dungeon1Active = true;

    // Place the player at the bottom of the arena
    GameContext.player.pos.x = originX;
    GameContext.player.pos.y = originY + GameContext.dungeon1Arena.radius - 300; // 300 units from bottom edge
    GameContext.player.vel.x = 0;
    GameContext.player.vel.y = 0;

    // Activate dungeon arena
    GameContext.dungeon1Arena.x = originX;
    GameContext.dungeon1Arena.y = originY;
    GameContext.dungeon1Arena.radius = 2500;
    GameContext.dungeon1Arena.active = true;
    GameContext.dungeon1Arena.growing = false;

    showOverlayMessage("ENTERED DUNGEON 1", '#f80', 2000, 2);
}

function exitDungeon1() {
    if (!GameContext.dungeon1Zone || !GameContext.dungeon1Zone.active) return;
    GameContext.dungeon1Zone.active = false;
    GameContext.dungeon1Active = false;

    // Clean up dungeon gate
    if (GameContext.dungeon1Gate) {
        pixiCleanupObject(GameContext.dungeon1Gate);
        GameContext.dungeon1Gate = null;
    }

    // Clean up dungeon zone
    if (GameContext.dungeon1Zone) {
        if (GameContext.dungeon1Zone._pixiGfx) {
            try { GameContext.dungeon1Zone._pixiGfx.destroy(true); } catch (e) { }
            GameContext.dungeon1Zone._pixiGfx = null;
        }
    }

    GameContext.dungeon1Zone = null;
}

// Instead, we transition directly to level 2 via sectorTransitionActive

// --- Performance: particle pooling (render-only, no gameplay impact) ---
const particlePool = [];
const smokeParticlePool = [];

function emitParticle(x, y, vx, vy, color = '#fff', life = 30) {
    let p = particlePool.length > 0 ? particlePool.pop() : null;
    if (!p) p = new Particle(x, y, vx, vy, color, life);
    else p.reset(x, y, vx, vy, color, life);
    GameContext.particles.push(p);
    return p;
}

function emitSmokeParticle(x, y, vx, vy, color = '#aaa') {
    let p = smokeParticlePool.length > 0 ? smokeParticlePool.pop() : null;
    if (!p) p = new SmokeParticle(x, y, vx, vy, color);
    else p.reset(x, y, vx, vy, color);
    GameContext.particles.push(p);
    return p;
}

function compactParticles(arr) {
    immediateCompactArray(arr, (p) => {
        // Release particle sprite back to pool when particle dies
        if (p.sprite && pixiParticleSpritePool) {
            releasePixiSprite(pixiParticleSpritePool, p.sprite);
            p.sprite = null;
        }
    });
}

function spawnParticles(x, y, count = 10, color = '#fff') {
    for (let i = 0; i < count; i++) emitParticle(x, y, null, null, color, 30);
}

/**
 * Spawn a lightning arc visual effect between two points
 * @param {number} x1 - Start X position
 * @param {number} y1 - Start Y position
 * @param {number} x2 - End X position
 * @param {number} y2 - End Y position
 * @param {string} color - Lightning color
 */
function spawnLightningArc(x1, y1, x2, y2, color = '#0ff') {
    // Create LightningArc entity with 12-frame lifetime (200ms at 60fps, scales with dt)
    const arc = new LightningArc(x1, y1, x2, y2, color, 12);
    GameContext.lightningArcs.push(arc);
    return arc;
}

/**
 * Process and render lightning effects (placeholder - handled by particles)
 */
function processLightningEffects() {
    // Lightning is handled by the particle system, nothing to do here
}

/**
 * Schedule particle bursts to be spread across multiple frames
 * This prevents sprite pool exhaustion when many particles need to spawn at once
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} totalCount - Total particles to spawn
 * @param {string} color - Particle color
 * @param {number} spreadFrames - Number of frames to spread the spawn over
 */
function scheduleParticleBursts(x, y, totalCount, color, spreadFrames = 10) {
    const particlesPerFrame = Math.max(1, Math.floor(totalCount / spreadFrames));

    for (let frame = 0; frame < spreadFrames; frame++) {
        GameContext.staggeredParticleBursts.push({
            x: x + (Math.random() - 0.5) * 100, // Add some position variation
            y: y + (Math.random() - 0.5) * 100,
            count: particlesPerFrame + (frame === spreadFrames - 1 ? totalCount % spreadFrames : 0),
            color: color,
            delayFrames: frame * 2, // Spawn every 2 frames
            processed: false
        });
    }
}

/**
 * Process staggered particle bursts
 * Call this every frame to handle queued particle spawning
 */
function processStaggeredParticleBursts() {
    if (GameContext.staggeredParticleBursts.length === 0) return;

    for (let i = GameContext.staggeredParticleBursts.length - 1; i >= 0; i--) {
        const burst = GameContext.staggeredParticleBursts[i];

        if (burst.processed) {
            GameContext.staggeredParticleBursts.splice(i, 1);
            continue;
        }

        if (burst.delayFrames <= 0) {
            burst.processed = true;
            spawnParticles(burst.x, burst.y, burst.count, burst.color);
        } else {
            burst.delayFrames--;
        }
    }
}

/**
 * Schedule bomb explosions to be spread across multiple frames
 * This prevents sprite pool exhaustion and frame spikes when many bombs explode at once
 * @param {number} sourceX - X position to spawn effects at
 * @param {number} sourceY - Y position to spawn effects at
 */
function scheduleStaggeredBombExplosions(sourceX, sourceY) {
    const bombCount = GameContext.bossBombs.length;
    if (bombCount === 0) {
        clearArrayWithPixiCleanup(GameContext.bossBombs);
        return;
    }

    console.log(`[BOSS KILL] Scheduling ${bombCount} bomb explosions over multiple frames`);

    // Clear the bombs array but keep the explosion queue
    const bombsToExplode = [...GameContext.bossBombs];
    GameContext.bossBombs.length = 0;

    // Schedule explosions spread across frames
    // Explode up to 3 bombs per frame to prevent sprite pool exhaustion
    const bombsPerFrame = Math.min(3, Math.ceil(bombCount / 10)); // Spread over at least 10 frames

    for (let i = 0; i < bombCount; i++) {
        const bomb = bombsToExplode[i];
        // Calculate delay in frames
        const delayFrames = Math.floor(i / bombsPerFrame);

        GameContext.staggeredBombExplosions.push({
            bomb: bomb,
            pos: { x: bomb.pos.x, y: bomb.pos.y },
            delayFrames: delayFrames,
            processed: false
        });
    }
}

/**
 * Process staggered bomb explosions
 * Call this every frame to handle queued bomb explosions
 */
function processStaggeredBombExplosions() {
    if (GameContext.staggeredBombExplosions.length === 0) return;

    const frameTime = performance.now();
    const explosionsThisFrame = [];

    for (let i = GameContext.staggeredBombExplosions.length - 1; i >= 0; i--) {
        const queued = GameContext.staggeredBombExplosions[i];

        if (queued.processed) {
            GameContext.staggeredBombExplosions.splice(i, 1);
            continue;
        }

        if (queued.delayFrames <= 0) {
            // Explode this bomb now
            queued.processed = true;
            explosionsThisFrame.push(queued);
        } else {
            queued.delayFrames--;
        }
    }

    // Execute explosions for this frame
    // Limit to prevent overwhelming the system
    const maxPerFrame = 4;
    const actualExplosions = explosionsThisFrame.slice(0, maxPerFrame);

    for (const queued of actualExplosions) {
        const bomb = queued.bomb;
        if (bomb && !bomb.dead) {
            bomb.dead = true;
            pixiCleanupObject(bomb);
            playSound('explode');
            spawnParticles(bomb.pos.x, bomb.pos.y, 40, '#fa0');
            GameContext.shockwaves.push(new Shockwave(bomb.pos.x, bomb.pos.y, bomb.damage, bomb.blastRadius, {
                damagePlayer: true,
                damageBases: true,
                ignoreEntity: bomb.owner,
                color: '#fa0'
            }));
        }
    }

    // If we couldn't process all explosions this frame, keep them for next frame
    // (they're already marked as processed, so they won't be re-exploded)
}

// Replaces spawnGunboatExplosion with a more generic large explosion
function spawnLargeExplosion(x, y, scale = 2.0) {
    const s = scale;
    const spriteSize = 250 * (s / 2.0); // Base size 250 at scale 2.0
    GameContext.explosions.push(new Explosion(x, y, spriteSize));

    // Standard fiery particles (glowy)
    const count = Math.floor(25 * (s / 1.5));
    const colors = ['#ff8', '#fa0', '#f40', '#f00'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (2.0 + Math.random() * 3.0) * (s / 2.0);
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 30 + Math.floor(Math.random() * 20);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.glow = true;
        p.size = (6 + Math.random() * 8) * (s / 2.0); // Scale size
    }

    // EXTRA LARGE debris particles (explode in all directions)
    const bigCount = Math.floor(12 * (s / 2.0));
    for (let i = 0; i < bigCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 3.5) * (s / 2.0);
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const life = 40 + Math.floor(Math.random() * 25);
        // Use enemy bullet colors (Red/Orange) to match request
        const color = (Math.random() < 0.5) ? '#f00' : '#f80';

        const p = emitParticle(x, y, vx, vy, color, life);
        p.size = (20 + Math.random() * 12) * (s / 2.0); // Large particles scaled
        p.glow = true;
    }

    spawnSmoke(x, y, Math.ceil(6 * (s / 2.0)));
    playSound('base_explode');
}

function spawnFieryExplosion(x, y, scale = 1) {
    const s = Math.max(0.6, Math.min(3, scale || 1));
    const spriteSize = Math.max(90, Math.round(140 * s));
    GameContext.explosions.push(new Explosion(x, y, spriteSize));

    const count = Math.max(10, Math.round(12 * s));
    const colors = ['#ff6', '#fa0', '#f80', '#f00'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (0.8 + Math.random() * 1.8) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 20 + Math.floor(Math.random() * 16);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.glow = true;
    }
    spawnSmoke(x, y, Math.max(1, Math.round(2 * s)));
}

function spawnBossExplosion(x, y, scale = 2.5, chunkCount = 18) {
    const s = Math.max(1.2, Math.min(5, scale || 1));
    spawnFieryExplosion(x, y, s);

    const colors = ['#888', '#777', '#666'];
    const count = Math.max(8, Math.round(chunkCount * (0.6 + s * 0.15)));
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (2.5 + Math.random() * 4.5) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const life = 40 + Math.floor(Math.random() * 35);
        const p = emitParticle(x, y, vx, vy, colors[(Math.random() * colors.length) | 0], life);
        p.size = 4 + Math.random() * 6;
        p.glow = false;
    }

    const smokeCount = Math.max(2, Math.round(2 * s));
    for (let i = 0; i < smokeCount; i++) {
        const sp = emitSmokeParticle(x, y, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s, '#777');
        if (sp) {
            sp.size *= 1.8;
            sp.life = Math.round(sp.life * 1.3);
            sp.maxLife = sp.life;
        }
    }
}

function spawnAsteroidExplosion(x, y, scale = 1) {
    const s = Math.max(0.5, Math.min(2.6, scale || 1)) * 2;
    const count = Math.max(8, Math.round(10 * s));
    const colors = ['#fff'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (0.6 + Math.random() * 1.6) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 18 + Math.floor(Math.random() * 16);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.size = (p.size || 2) * 3;
        p.glow = true;
    }
    const smokeCount = Math.max(2, Math.round(4 * s));
    for (let i = 0; i < smokeCount; i++) {
        const sp = emitSmokeParticle(x, y, null, null, '#fff');
        if (sp) {
            sp.size *= 3;
            sp.life = Math.round(sp.life * 1.4);
            sp.maxLife = sp.life;
        }
    }
}

function spawnSmoke(x, y, count = 1, color = '#aaa') {
    for (let i = 0; i < count; i++) emitSmokeParticle(x, y, null, null, color);
}

function spawnBarrelSmoke(x, y, angle) {
    for (let i = 0; i < 3; i++) {
        const speed = 2 + Math.random() * 2;
        const spread = (Math.random() - 0.5) * 0.5;
        const vx = Math.cos(angle + spread) * speed;
        const vy = Math.sin(angle + spread) * speed;
        emitSmokeParticle(x, y, vx, vy);
    }
}

// Companion Drones




function updateMiniEventUI() {
    const el = document.getElementById('event-display');
    if (!el) return;
    if (!GameContext.miniEvent || GameContext.miniEvent.dead) {
        el.style.display = 'none';
        el.innerText = 'EVENT: NONE';
        return;
    }
    el.style.display = 'block';
    if (typeof GameContext.miniEvent.getUiText === 'function') el.innerText = GameContext.miniEvent.getUiText();
    else el.innerText = 'EVENT: ACTIVE';
}

function clearMiniEvent() {
    if (!GameContext.miniEvent) return;
    if (typeof GameContext.miniEvent.kill === 'function') {
        GameContext.miniEvent.kill();
    } else {
        GameContext.miniEvent.dead = true;
    }
    pixiCleanupObject(GameContext.miniEvent);
    GameContext.miniEvent = null;
}

function completeContract(success = true) {
    completeContractSystem(success);
}

registerContractHandlers({
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
    SAVE_LAST_KEY
});




function setupGameWorld() {
    GameContext.player.respawn();
    resetPixiOverlaySprites();
    clearArrayWithPixiCleanup(GameContext.bullets);
    clearArrayWithPixiCleanup(GameContext.bossBombs);
    clearArrayWithPixiCleanup(GameContext.guidedMissiles);
    clearArrayWithPixiCleanup(GameContext.enemies);
    clearArrayWithPixiCleanup(GameContext.pinwheels);
    clearArrayWithPixiCleanup(GameContext.particles);
    clearArrayWithPixiCleanup(GameContext.explosions);
    clearArrayWithPixiCleanup(GameContext.floatingTexts);
    clearArrayWithPixiCleanup(GameContext.coins);
    clearArrayWithPixiCleanup(GameContext.nuggets);
    GameContext.spaceNuggets = 0;
    clearArrayWithPixiCleanup(GameContext.powerups);
    clearArrayWithPixiCleanup(GameContext.shootingStars);
    clearArrayWithPixiCleanup(GameContext.drones);
    clearArrayWithPixiCleanup(GameContext.caches);
    GameContext.radiationStorm = null;
    GameContext.nextRadiationStormAt = null;
    clearMiniEvent();
    GameContext.nextMiniEventAt = Date.now() + 120000;
    clearArrayWithPixiCleanup(GameContext.pois);
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.activeContract = null;
    GameContext.nextContractAt = Date.now() + 30000; // first contract after ~30s
    scheduleNextShootingStar();
    scheduleNextRadiationStorm();
    scheduleNextMiniEvent();
    GameContext.nextIntensityBreakAt = Date.now() + 120000; // first break at 2 minutes
    GameContext.intensityBreakActive = false;
    GameContext.warpParticles = [];
    GameContext.shockwaves = [];
    GameContext.roamerRespawnQueue = [];
    GameContext.baseRespawnTimers = [];
    GameContext.pinwheelsDestroyed = 0;
    GameContext.pinwheelsDestroyedTotal = 0;
    if (GameContext.boss) pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;
    if (GameContext.spaceStation) pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    if (GameContext.destroyer) {
        pixiCleanupObject(GameContext.destroyer);
        GameContext.destroyer = null;
    }
    GameContext.nextDestroyerSpawnTime = null;
    GameContext.currentDestroyerType = 1;
    GameContext.bossActive = false;
    GameContext.bossArena.active = false;
    GameContext.stationArena.active = false;
    GameContext.pendingStations = 0;
    GameContext.sectorIndex = 1;
    GameContext.sectorTransitionActive = false;
    GameContext.warpCountdownAt = null;
    GameContext.warpGateUnlocked = false;
    // nextSpaceStationTime = Date.now() + 180000; // disabled, after second cruiser
    GameContext.gunboatRespawnAt = null;
    GameContext.gunboatLevel2Unlocked = false;
    GameContext.initialSpawnDone = false;
    GameContext.gameStartTime = getGameNowMs();
    GameContext.pauseStartTime = null;
    GameContext.pausedAccumMs = 0;

    GameContext.initialSpawnDelayAt = GameContext.gameStartTime + 5000;

    generateMap();
    // Ensure the nebula palette matches Sector 1 when restarting after a Sector 2 cave run. 
    initStars(width, height);

    GameContext.maxRoamers = 3;
    document.getElementById('bases-display').innerText = `0`;
    GameContext.shakeMagnitude = 0;
    updateWarpUI();
    updateTurboUI();
    updateXpUI();
    updateNuggetUI();
}

function showFloatingText(x, y, amount, color = '#ff0', key = null) {
    if (key) {
        getOrCreateFloatingText(GameContext.floatingTexts, key, x, y, amount, color, {
            prefix: '+',
            life: 70
        });
    } else {
        GameContext.floatingTexts.push(new FloatingText(x, y, `+${amount}`, color, 70, { prefix: '+' }));
    }
}

function addPickupFloatingText(key, amount, color = '#ff0') {
    if (!GameContext.player || GameContext.player.dead) return;
    const x = GameContext.player.pos.x;
    const y = GameContext.player.pos.y - GameContext.player.radius - 10;
    showFloatingText(x, y, amount, color, key);
}

function awardCoinsInstant(amount, opts = {}) {
    const v = Math.max(0, Math.floor(amount || 0));
    if (v <= 0) return;
    GameContext.score += v;
    if (GameContext.player && !GameContext.player.dead && typeof GameContext.player.addXp === 'function') GameContext.player.addXp(v);
    if (!opts.noSound) playSound(opts.sound || 'coin');
    addPickupFloatingText('gold', v, opts.color || '#ff0');
}



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
    getViewportSize: () => ({ width, height })
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
    setProjectileImpactSoundContext
});

registerGameLoopDependencies({
    updateGamepad,
    gameLoopLogic,
    getSimNowMs: () => simNowMs,
    setSimNowMs: (value) => { simNowMs = value; },
    getSimAccMs: () => simAccMs,
    setSimAccMs: (value) => { simAccMs = value; },
    getSimLastPerfAt: () => simLastPerfAt,
    setSimLastPerfAt: (value) => { simLastPerfAt = value; },
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
    setRenderAlphaLocal: (value) => { renderAlpha = value; },
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
    drawMiniEventIndicator,
    clearPixiUiText,
    processStaggeredBombExplosions,
    processStaggeredParticleBursts,
    processLightningEffects,
    compactArray,
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

registerEnemyDependencies({
    spawnLargeExplosion,
    spawnFieryExplosion,
    awardCoinsInstant,
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
    spawnLargeExplosion
});

registerCruiserDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles,
    spawnBarrelSmoke,
    canvas
});

registerFlagshipDependencies({
    spawnParticles,
    spawnLargeExplosion
});

registerSuperFlagshipDependencies({
    spawnParticles,
    spawnLargeExplosion,
    awardCoinsInstant,
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
    killPlayer,
    showLevelUpMenu,
    startSectorTransition,
    resetWarpState,
    clearMiniEvent,
    showOverlayMessage,
    updateHealthUI
});

registerWarpBioPodDependencies({
    spawnParticles
});

registerDungeonDroneDependencies({
    spawnParticles
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
    spawnBarrelSmoke
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
    canvas
});

registerNecroticHiveDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
});

registerCerebralPsionDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
});

registerFleshforgeDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
});

registerVortexMatriarchDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
});

registerChitinusPrimeDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
});

registerPsyLichDependencies({
    spawnBossExplosion,
    spawnLargeExplosion,
    spawnParticles
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
    spawnParticles
});

registerWarpMazeZoneDependencies({
    clearArrayWithPixiCleanup,
    filterArrayWithPixiCleanup
});

registerDungeon1ZoneDependencies({
    clearArrayWithPixiCleanup,
    filterArrayWithPixiCleanup
});

registerRadiationStormDependencies({
    spawnParticles,
    getSimNowMs: () => simNowMs
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
    showLevelUpMenu,
    killPlayer,
    checkWallCollision,
    rayCast,
    getGameNowMs,
    getSuppressWarpInputUntil: () => suppressWarpInputUntil,
    getViewportSize: () => ({ width, height }),
    getPlayerHullExternalReady,
    getSlackerHullExternalReady
});

function killPlayer() {
    GameContext.player.dead = true;
    if (GameContext.metaExtraLifeCount > 0) {
        GameContext.metaExtraLifeCount--;
        GameContext.player.dead = false;
        GameContext.player.hp = Math.max(1, Math.floor(GameContext.player.maxHp * 0.5));
        GameContext.player.invulnerable = 180;
        spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 20, '#0f0');
        showOverlayMessage(`SECOND CHANCE! (${GameContext.metaExtraLifeCount} remaining)`, '#0f0', 1500);
        updateHealthUI();
        return;
    }
    playSound('explode');
    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 30, '#0ff');
    setTimeout(() => {
        GameContext.gameActive = false;
        resetWarpState();
        stopMusic();
        try { depositMetaNuggetsSystem(); } catch (e) { console.warn('meta deposit failed', e); }
        if (GameContext.currentProfileName) {
            autoSaveToCurrentProfile(); // Saves game state
            saveMetaProfileSystem();          // Saves meta shop upgrades
        }
        document.getElementById('start-screen').style.display = 'block';
        document.querySelector('#start-screen h1').innerText = "BETTER LUCK NEXT TIME";
        document.querySelector('#start-screen h1').style.color = "#f00";
        document.getElementById('start-btn').innerText = "REBOOT SYSTEM";
        setTimeout(() => {
            document.getElementById('start-btn').focus();
            GameContext.menuSelectionIndex = 0; // Reset for start menu
        }, 100);
    }, 2000);
}

function startGame() {
    console.log('[DEBUG] startGame() called');

    // Auto-create profile if none exists (e.g. after deleting all profiles)
    if (!GameContext.currentProfileName) {
        console.log('[START] No profile selected, checking for auto-create');
        const existing = listSaveSlotsSystem();
        if (existing.length === 0) {
            console.log('[START] Auto-creating default profile');
            const newName = 'profile1';
            const template = {
                version: 1,
                timestamp: Date.now(),
                lastSavedAt: Date.now(),
                score: 0,
                sectorIndex: 1,
                totalKills: 0,
                highScore: 0,
                totalPlayTimeMs: 0,
                player: null
            };
            try {
                localStorage.setItem(SAVE_PREFIX + newName, JSON.stringify(template));
                const newMetaProfile = {
                    bank: 0,
                    purchases: {
                        startDamage: 0, passiveHp: 0, rerollTokens: 0, hullPlating: 0, shieldCore: 0,
                        staticBlueprint: 0, missilePrimer: 0, magnetBooster: 0, nukeCapacitor: 0,
                        speedTuning: 0, bankMultiplier: 0, shopDiscount: 0, extraLife: 0, droneFabricator: 0,
                        piercingRounds: 0, explosiveRounds: 0, criticalStrike: 0, splitShot: 0,
                        thornArmor: 0, lifesteal: 0, evasionBoost: 0, shieldRecharge: 0,
                        dashCooldown: 0, dashDuration: 0, xpMagnetPlus: 0, autoReroll: 0,
                        nuggetMagnet: 0, contractSpeed: 0, startingRerolls: 0, luckyDrop: 0,
                        bountyHunter: 0, comboMeter: 0, startingWeapon: 0, secondWind: 0, batteryCapacitor: 0
                    }
                };
                localStorage.setItem(`meta_profile_v1_${newName}`, JSON.stringify(newMetaProfile));
                selectProfile(newName);
            } catch (e) {
                console.warn('[START] Auto-create failed', e);
            }
        }
    }

    try {
        // Reset fromPauseMenu flag for fresh start
        fromPauseMenu = false;

        resetWarpState();
        resetCaveState();
        GameContext.warpCompletedOnce = false;
        // Always reset audio state to normal before a new run
        setMusicMode('normal');
        GameContext.gameMode = 'normal';
        simNowMs = 0; // Reset simulation clock for new game logic
        GameContext.arcadeBoss = null;
        GameContext.arcadeWave = 0;
        GameContext.arcadeWaveNextAt = 0;
        GameContext.currentZoom = ZOOM_LEVEL;
        stopMusic();
        if (GameContext.player) pixiCleanupObject(GameContext.player);
        GameContext.player = new Spaceship(selectedShipType || 'standard');

        // Load current profile data if available
        if (GameContext.currentProfileName) {
            const raw = localStorage.getItem(SAVE_PREFIX + GameContext.currentProfileName);
            if (raw) {
                try {
                    const profile = JSON.parse(raw);
                    // Restore ONLY career statistics
                    if (typeof profile.totalKills === 'number') GameContext.totalKills = profile.totalKills;
                    if (typeof profile.highScore === 'number') GameContext.highScore = profile.highScore;
                    if (typeof profile.totalPlayTimeMs === 'number') GameContext.totalPlayTimeMs = profile.totalPlayTimeMs;

                    // FIXED: Do NOT restore player state (applyProfile) when starting a new game.
                    // This ensures in-game upgrades are reset while store upgrades are re-applied below.
                    // applyProfile(profile); 
                } catch (e) {
                    console.warn('Failed to load profile on start', e);
                }
            }
        } else {
            // Reset stats if no profile
            resetProfileStats();
        }

        GameContext.score = 0;
        GameContext.difficultyTier = 1;
        GameContext.pinwheelsDestroyedTotal = 0;
        GameContext.bossActive = false;
        if (GameContext.boss) pixiCleanupObject(GameContext.boss);
        GameContext.boss = null;
        GameContext.bossArena.active = false;
        GameContext.bossArena.growing = false;
        stopArenaCountdown();
        GameContext.cruiserEncounterCount = 0;
        GameContext.cruiserTimerPausedAt = null;
        GameContext.dreadManager.upgradesChosen = 0;
        GameContext.dreadManager.firstSpawnDone = false;
        GameContext.dreadManager.timerActive = true;
        GameContext.dreadManager.timerAt = Date.now() + GameContext.dreadManager.minDelayMs + Math.floor(Math.random() * (GameContext.dreadManager.maxDelayMs - GameContext.dreadManager.minDelayMs + 1));
        GameContext.rerollTokens = GameContext.metaProfile.purchases.rerollTokens || 0;
        GameContext.metaExtraLifeCount = GameContext.metaProfile.purchases.extraLife || 0;

        // Reset player stats/inventory
        GameContext.player.fireDelay = 24;

        GameContext.player.turretLevel = 1;
        GameContext.player.canWarp = false;
        GameContext.player.shieldSegments = new Array(8).fill(2);
        GameContext.player.outerShieldSegments = new Array(12).fill(2);
        GameContext.player.hp = GameContext.player.maxHp;
        GameContext.player.inventory = {};
        GameContext.player.reactiveShieldCoins = 0;
        GameContext.shownUpgradesThisRun = new Set(); // Reset upgrade tracking for new game
        GameContext.player.xp = 0;
        GameContext.player.level = 1;
        GameContext.player.nextLevelXp = 100;
        GameContext.player.stats = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            shotgunFireRateMult: 1.0,
            rangeMult: 1.0,
            multiShot: 1,
            homing: 0,
            shieldRegenRate: 8, // seconds per segment baseline
            hpRegenAmount: 1,
            hpRegenRate: 10,
            speedMult: 1.0,
            slowField: 0,
            slowFieldDuration: 0,
            // New upgrade stats
            critChance: 0,
            critDamage: 2.0,
            lifestealAmount: 0,
            lifestealThreshold: 100,
            thornArmor: 0,
            evasion: 0,
            piercing: 0,
            explosiveRounds: 0,
            explosiveDamage: 30,
            explosiveRadius: 200,
            splitShot: 0,
            comboMeter: 0,
            comboMaxBonus: 0,
            secondWindFrames: 0,
            secondWindCooldown: 0,
            secondWindActive: 0
        };
        GameContext.player.comboStacks = 0;
        GameContext.player.comboMaxStacks = 100;
        GameContext.player.lastHitTime = Date.now();
        GameContext.player.lastDamageTakenTime = 0;
        GameContext.player.lastHpRegenTime = Date.now();
        GameContext.player.staticWeapons = [];
        GameContext.player.nukeMaxCooldown = 600;
        GameContext.player.magnetRadius = 150;
        GameContext.player.nukeUnlocked = false;
        // Volley shot initialization
        GameContext.player.volleyShotUnlocked = false;
        GameContext.player.volleyShotCount = 0;
        GameContext.player.volleyCooldown = 0;
        GameContext.player.lastF = false;
        GameContext.gameEnded = false;

        // Setup game world (clear all entities)
        setupGameWorld();

        applyMetaUpgradesSystem(spawnDrone);

        applyPendingProfileSystem();
        updateHealthUI();

        document.getElementById('score').innerText = GameContext.score;
        document.getElementById('start-screen').style.display = 'none';
        const endScreen = document.getElementById('end-screen');
        if (endScreen) endScreen.style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        GameContext.gameActive = true;
        GameContext.gamePaused = false;
        GameContext.canResumeGame = false; // New game - can't resume yet

        // Update resume button state
        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }

        setupGameWorld();
        updateContractUI();

        if (musicEnabled) {
            initAudio();
            startMusic();
        }
    } catch (e) {
        console.error('[STARTGAME ERROR]', e);
    }
}

function shiftPausedTimers(pauseMs) {
    if (!pauseMs || pauseMs <= 0) return;
    const shiftIfNumber = (val) => (typeof val === 'number' && isFinite(val) && val > 0) ? (val + pauseMs) : val;
    const shiftArrayNumbers = (arr) => {
        if (!Array.isArray(arr)) return arr;
        for (let i = 0; i < arr.length; i++) {
            if (typeof arr[i] === 'number' && isFinite(arr[i]) && arr[i] > 0) arr[i] += pauseMs;
        }
        return arr;
    };

    GameContext.warpCountdownAt = shiftIfNumber(GameContext.warpCountdownAt);
    GameContext.nextContractAt = shiftIfNumber(GameContext.nextContractAt);
    GameContext.nextSpaceStationTime = shiftIfNumber(GameContext.nextSpaceStationTime);
    GameContext.gunboatRespawnAt = shiftIfNumber(GameContext.gunboatRespawnAt);
    GameContext.nextShootingStarTime = shiftIfNumber(GameContext.nextShootingStarTime);
    GameContext.nextRadiationStormAt = shiftIfNumber(GameContext.nextRadiationStormAt);
    GameContext.nextMiniEventAt = shiftIfNumber(GameContext.nextMiniEventAt);
    GameContext.nextIntensityBreakAt = shiftIfNumber(GameContext.nextIntensityBreakAt);
    GameContext.initialSpawnDelayAt = shiftIfNumber(GameContext.initialSpawnDelayAt);

    GameContext.asteroidRespawnTimers = shiftArrayNumbers(GameContext.asteroidRespawnTimers);
    GameContext.baseRespawnTimers = shiftArrayNumbers(GameContext.baseRespawnTimers);

    if (GameContext.dreadManager && GameContext.dreadManager.timerActive && typeof GameContext.dreadManager.timerAt === 'number') {
        GameContext.dreadManager.timerAt += pauseMs;
    }
    if (GameContext.cruiserTimerPausedAt !== null && typeof GameContext.cruiserTimerPausedAt === 'number') {
        GameContext.cruiserTimerPausedAt += pauseMs;
    }
    if (GameContext.radiationStorm && typeof GameContext.radiationStorm.endsAt === 'number') {
        GameContext.radiationStorm.endsAt += pauseMs;
    }
    if (GameContext.miniEvent) {
        if (typeof GameContext.miniEvent.expiresAt === 'number') GameContext.miniEvent.expiresAt += pauseMs;
        if (typeof GameContext.miniEvent.nextWaveAt === 'number') GameContext.miniEvent.nextWaveAt += pauseMs;
        if (typeof GameContext.miniEvent.lastUpdateAt === 'number') GameContext.miniEvent.lastUpdateAt += pauseMs;
    }
    if (GameContext.activeContract && typeof GameContext.activeContract.endsAt === 'number') {
        GameContext.activeContract.endsAt += pauseMs;
    }
}

// Global function to update resume button state
// This is defined globally so it can be called from anywhere in the code
const updateResumeButtonState = () => {
    const resumeBtn = document.getElementById('resume-btn-start');
    if (resumeBtn) {
        if (GameContext.canResumeGame) {
            resumeBtn.disabled = false;
            resumeBtn.style.opacity = '1';
            resumeBtn.style.cursor = 'pointer';
        } else {
            resumeBtn.disabled = true;
            resumeBtn.style.opacity = '0.5';
            resumeBtn.style.cursor = 'not-allowed';
        }
    }
};

// Store globally so it can be called from anywhere in the code
window.updateResumeButtonState = updateResumeButtonState;

function togglePause() {
    if (!GameContext.gameActive) return;

    // If debug menu is open, close it first
    if (document.getElementById('debug-menu').style.display === 'block') {
        hideDebugMenu();
        return;
    }

    // Return to pause menu from start screen
    if (fromPauseMenu && GameContext.gamePaused && document.getElementById('start-screen').style.display === 'block') {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'block';
        fromPauseMenu = false;
        return;
    }

    const wasPaused = GameContext.gamePaused;
    GameContext.gamePaused = !GameContext.gamePaused;
    document.getElementById('pause-menu').style.display = GameContext.gamePaused ? 'block' : 'none';
    // Pause timer bookkeeping
    if (GameContext.gamePaused) {
        GameContext.pauseStartTime = getGameNowMs();
        if (isArenaCountdownActive()) stopArenaCountdown();
    } else {
        if (GameContext.pauseStartTime) {
            const pauseMs = Math.max(0, getGameNowMs() - GameContext.pauseStartTime);
            if (pauseMs > 0) {
                GameContext.pausedAccumMs += pauseMs;
                shiftPausedTimers(pauseMs);
            }
            GameContext.pauseStartTime = null;
        }
    }
    if (GameContext.gamePaused) {
        setTimeout(() => {
            document.getElementById('resume-btn').focus();
            GameContext.menuSelectionIndex = 0;
        }, 100);
    }
    else if (musicEnabled) startMusic();
}

function quitGame() {
    // Deposit nuggets and save before aborting
    try {
        depositMetaNuggetsSystem();
    } catch (e) { console.warn('meta deposit failed on abort', e); }

    // Save game state and meta profile
    if (GameContext.currentProfileName) {
        try {
            autoSaveToCurrentProfile();
            saveMetaProfileSystem();
        } catch (e) { console.warn('save failed on abort', e); }
    }

    // End the game properly
    GameContext.gameActive = false;
    GameContext.gameEnded = true;
    stopArenaCountdown();
    stopMusic();

    // Reset sector index so new game starts at level 1
    GameContext.sectorIndex = 1;

    // Show start screen with ABORTED message
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    const endScreen = document.getElementById('end-screen');
    if (endScreen) endScreen.style.display = 'none';
    document.querySelector('#start-screen h1').innerText = "ABORTED";
    document.getElementById('start-btn').innerText = "INITIATE LAUNCH";
    setTimeout(() => document.getElementById('resume-btn-start').focus(), 100);
    GameContext.menuSelectionIndex = 0;

    // Cannot resume an aborted run
    GameContext.canResumeGame = false;

    // Update resume button state
    const updateResumeButtonState = () => {
        const resumeBtn = document.getElementById('resume-btn-start');
        if (resumeBtn) {
            resumeBtn.disabled = true;
            resumeBtn.style.opacity = '0.5';
            resumeBtn.style.cursor = 'not-allowed';
        }
    };
    updateResumeButtonState();

    // Store the update function so it can be called when game starts/stops
    window.updateResumeButtonState = updateResumeButtonState;
}

const SHIP_SELECTION_KEY = 'neon_space_ship_selection';
let selectedShipType = localStorage.getItem(SHIP_SELECTION_KEY) || 'standard';

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
    toggleMusic,
    getMusicEnabled: () => musicEnabled,
    getSelectedShipType: () => selectedShipType,
    setSelectedShipType: (value) => { selectedShipType = value; },
    shipSelectionKey: SHIP_SELECTION_KEY,
    getDebugMenuVisible: () => debugMenuVisible,
    setDebugMenuVisible: (value) => { debugMenuVisible = value; }
});
initMenuUi();

initSettingsMenu();

// Robust menu initialization for start screen
document.getElementById('levelup-screen').style.display = 'none';
document.getElementById('upgrades-menu').style.display = 'none';
document.getElementById('start-screen').style.display = 'block';

const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
allMenuElements.forEach(el => {
    el.classList.remove('selected');
    if (el.tagName === 'BUTTON') el.blur();
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

startMainLoop();
