// --- Module Imports ---
import { Vector, SpatialHash, _tempVec1, _tempVec2, closestPointOnSegment, resolveCircleSegment } from './core/math.js';
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
    USE_PIXI_OVERLAY, BACKGROUND_MUSIC_URL,
    ENABLE_NEBULA, NEBULA_ALPHA, ENABLE_PROJECTILE_IMPACT_SOUNDS,
    PLAYER_SHIELD_RADIUS_SCALE
} from './core/constants.js';
import { Explosion, WarpParticle, Coin, FloatingText, HealthPowerUp, SpaceNugget, getOrCreateFloatingText } from './entities/index.js';
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
    clearArrayWithPixiCleanup,
    destroyBulletSprite,
    pixiCleanupObject
} from './utils/cleanup-utils.js';
import {
    clearOverlayMessageTimeout,
    formatTime,
    showOverlayMessage
} from './utils/ui-helpers.js';
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
} from './systems/particle-manager.js';
import {
    registerGameFlowDependencies,
    initGameFlow,
    endGame,
    killPlayer,
    startGame,
    shiftPausedTimers,
    togglePause,
    quitGame
} from './systems/game-flow.js';
import {
    registerWorldHelperDependencies,
    checkDespawn,
    generateMap,
    rayCast,
    applyAOEDamageToPlayer
} from './systems/world-helpers.js';
import {
    registerSectorFlowDependencies,
    startSectorTransition,
    completeSectorWarp,
    startCaveSector2,
    enterWarpMaze,
    resetWarpState,
    resetCaveState,
    enterDungeon1Internal as _enterDungeon1Internal
} from './systems/sector-flow.js';
import {
    registerWorldSetupDependencies,
    setupGameWorld
} from './systems/world-setup.js';
import {
    registerMiniEventDependencies,
    updateMiniEventUI,
    clearMiniEvent,
    completeContract
} from './systems/mini-event-manager.js';
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
    resetProfileStats,
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

// Instead, we transition directly to level 2 via sectorTransitionActive

// Companion Drones




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

registerGameFlowDependencies({
    applyMetaUpgrades: applyMetaUpgradesSystem,
    applyPendingProfile: applyPendingProfileSystem,
    autoSaveToCurrentProfile,
    depositMetaNuggets: depositMetaNuggetsSystem,
    formatTime,
    getFromPauseMenu: () => fromPauseMenu,
    setFromPauseMenu: (value) => { fromPauseMenu = value; },
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
    resetProfileStats,
    resetWarpState,
    saveMetaProfile: saveMetaProfileSystem,
    savePrefix: SAVE_PREFIX,
    selectProfile,
    setMusicMode,
    setSimNowMs: (value) => { simNowMs = value; },
    setupGameWorld,
    showOverlayMessage,
    spawnDrone,
    spawnParticles,
    startMusic,
    stopArenaCountdown,
    stopMusic,
    updateContractUI,
    updateHealthUI,
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
    clearArrayWithPixiCleanup,
    clearMiniEvent,
    clearOverlayMessageTimeout,
    generateMap,
    getHeight: () => height,
    getWidth: () => width,
    initStars,
    pixiCleanupObject,
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

registerPoiDependencies({
    spawnParticles,
    getSimNowMs: getGameNowMs
});

registerMiniEventDefendCacheDependencies({
    spawnParticles,
    getSimNowMs: getGameNowMs
});

registerShootingStarDependencies({
    emitParticle,
    spawnAsteroidExplosion
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
