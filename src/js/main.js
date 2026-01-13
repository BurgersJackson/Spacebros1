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
import {
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureRotOffsets,
    pixiTextureBaseScales,
    pixiTextureScaleToRadius,
    loadAllTextures
} from './rendering/texture-loader.js';
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

// --- Game Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = (() => {
    try { return canvas.getContext('2d', { desynchronized: true, alpha: false }); }
    catch (e) { return canvas.getContext('2d'); }
})();
// --- UI Canvas Setup ---
const uiCanvas = document.getElementById('uiCanvas');
const uiCtx = (() => {
    try { return uiCanvas.getContext('2d', { alpha: true }); }
    catch (e) { return uiCanvas.getContext('2d'); }
})();

const minimapCanvas = document.getElementById('minimap');
if (ctx) ctx.imageSmoothingEnabled = false;
if (uiCtx) uiCtx.imageSmoothingEnabled = false;

// Handle Canvas Resolution Setup
// Sets up canvas at fixed internal resolution with CSS scaling for letterboxing
function setupCanvasResolution(internalW, internalH) {
    // Set main canvas to internal resolution
    canvas.width = internalW;
    canvas.height = internalH;

    // Set UI canvas to internal resolution
    uiCanvas.width = internalW;
    uiCanvas.height = internalH;

    // Apply CSS scaling for letterboxing/pillarboxing
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    uiCanvas.style.width = '100%';
    uiCanvas.style.height = '100%';
    uiCanvas.style.objectFit = 'contain';
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.top = '0';
    uiCanvas.style.left = '0';
    uiCanvas.style.pointerEvents = 'none';

    // Update local variables
    width = internalW;
    height = internalH;
    internalWidth = internalW;
    internalHeight = internalH;

    // Disable image smoothing for pixel-perfect rendering
    if (ctx) ctx.imageSmoothingEnabled = false;
    if (uiCtx) uiCtx.imageSmoothingEnabled = false;

    // Update PixiJS renderer if it exists
    if (pixiApp && pixiApp.renderer) {
        pixiApp.renderer.resize(internalW, internalH);
    }

    // Update background sprites
    if (pixiCaveGridSprite) {
        pixiCaveGridSprite.width = internalW;
        pixiCaveGridSprite.height = internalH;
    }
    const starTiles = getStarTiles();
    if (starTiles && starTiles.length) {
        for (const t of starTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalW;
            t.spr.height = internalH;
        }
    }
    const nebulaTiles = getNebulaTiles();
    if (nebulaTiles && nebulaTiles.length) {
        for (const t of nebulaTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalW;
            t.spr.height = internalH;
        }
    }
}

// Handle window resize - maintain canvas at internal resolution, CSS handles scaling
function handleWindowResize() {
    // Canvas size stays at internal resolution
    // CSS scaling automatically handles letterboxing
    // Just need to update stars for background
    initStars(width, height);
}
window.addEventListener('resize', handleWindowResize);

// Initialize canvas with internal resolution from settings
async function initializeCanvasResolution() {
    let internalW = 1920;
    let internalH = 1080;

    if (window.SpacebrosApp && window.SpacebrosApp.settings) {
        try {
            const settings = await window.SpacebrosApp.settings.get();
            const internalRes = settings.internalResolution || { width: 1920, height: 1080 };
            internalW = internalRes.width;
            internalH = internalRes.height;
        } catch (e) {
            console.warn("Failed to load internal resolution from settings:", e);
        }
    } else {
        // Browser mode: use window size
        internalW = window.innerWidth;
        internalH = window.innerHeight;
    }

    // Setup canvas with internal resolution
    setupCanvasResolution(internalW, internalH);

    // Listen for resolution changes from main process
    if (window.SpacebrosApp && window.SpacebrosApp.ipcRenderer) {
        window.SpacebrosApp.ipcRenderer.on('internal-resolution-changed', (res) => {
            setupCanvasResolution(res.width, res.height);
            initStars(width, height);
        });
    }
}

// Initialize resolution on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCanvasResolution);
} else {
    initializeCanvasResolution();
}

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
let pixiNebulaPaletteIdx = null;

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
let pixiCaveGridTexture = null;
let pixiParticleGlowTexture = null;

// PIXI_SPRITE_POOL_MAX imported from ./core/constants.js
// Sprite pools imported from ./rendering/pixi-setup.js (see imports at top)

const pixiBulletTextures = { glow: null, laser: null, square: null };

loadAllTextures();
const GUNBOAT1_URL = 'assets/gunboat1.png';
const GUNBOAT2_URL = 'assets/gunboat2.png';
const gunboat1Image = new Image();
const gunboat2Image = new Image();
gunboat1Image.decoding = 'async';
gunboat2Image.decoding = 'async';
gunboat1Image.src = GUNBOAT1_URL;
gunboat2Image.src = GUNBOAT2_URL;
let gunboat1Texture = null;
let gunboat2Texture = null;
let gunboat1Loaded = false;
let gunboat2Loaded = false;

// Space station external sprite
const STATION1_URL = 'assets/station1.png';
const station1Image = new Image();
station1Image.decoding = 'async';
station1Image.src = STATION1_URL;
let station1Texture = null;
let station1Loaded = false;

// Destroyer ship sprite
const DESTROYER1_URL = 'assets/destroyer1.png';
const destroyer1Image = new Image();
destroyer1Image.decoding = 'async';
destroyer1Image.src = DESTROYER1_URL;
let destroyer1Texture = null;
let destroyer1Loaded = false;

// Destroyer 2 ship sprite
const DESTROYER2_URL = 'assets/destroyer2.png';
const destroyer2Image = new Image();
destroyer2Image.decoding = 'async';
destroyer2Image.src = DESTROYER2_URL;
let destroyer2Texture = null;
let destroyer2Loaded = false;

// Dungeon boss sprites
const DUNGEON4_URL = 'assets/dungeon4.png';
const DUNGEON5_URL = 'assets/dungeon5.png';
const DUNGEON6_URL = 'assets/dungeon6.png';
const DUNGEON7_URL = 'assets/dungeon7.png';
const DUNGEON8_URL = 'assets/dungeon8.png';
const DUNGEON9_URL = 'assets/dungeon9.png';
const dungeon4Image = new Image();
const dungeon5Image = new Image();
const dungeon6Image = new Image();
const dungeon7Image = new Image();
const dungeon8Image = new Image();
const dungeon9Image = new Image();
dungeon4Image.decoding = 'async';
dungeon5Image.decoding = 'async';
dungeon6Image.decoding = 'async';
dungeon7Image.decoding = 'async';
dungeon8Image.decoding = 'async';
dungeon9Image.decoding = 'async';
dungeon4Image.src = DUNGEON4_URL;
dungeon5Image.src = DUNGEON5_URL;
dungeon6Image.src = DUNGEON6_URL;
dungeon7Image.src = DUNGEON7_URL;
dungeon8Image.src = DUNGEON8_URL;
dungeon9Image.src = DUNGEON9_URL;
let dungeon4Texture = null;
let dungeon5Texture = null;
let dungeon6Texture = null;
let dungeon7Texture = null;
let dungeon8Texture = null;
let dungeon9Texture = null;
let dungeon4Loaded = false;
let dungeon5Loaded = false;
let dungeon6Loaded = false;
let dungeon7Loaded = false;
let dungeon8Loaded = false;
let dungeon9Loaded = false;

const applyGunboatTextures = () => {
    if (!window.PIXI) return;
    try {
        if (gunboat1Loaded && !gunboat1Texture) {
            const tex = PIXI.Texture.from(gunboat1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat1Texture = tex;
        }
        if (gunboat2Loaded && !gunboat2Texture) {
            const tex = PIXI.Texture.from(gunboat2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat2Texture = tex;
        }

        if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_1 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_1 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_1 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_1 = true;
            pixiTextureBaseScales.enemy_gunboat_1 = 1;
        }

        if (gunboat2Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat2Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        } else if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        }
    } catch (e) {
        // Keep procedural gunboat textures.
    }
};

const applyStationTexture = () => {
    if (!window.PIXI) return;
    try {
        if (station1Loaded && !station1Texture) {
            const tex = PIXI.Texture.from(station1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            station1Texture = tex;
        }

        if (station1Texture) {
            pixiTextures.station_hull = station1Texture;
            pixiTextureAnchors.station_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural station texture.
    }
};

const applyDestroyerTexture = () => {
    if (!window.PIXI) return;
    try {
        if (destroyer1Loaded && !destroyer1Texture) {
            const tex = PIXI.Texture.from(destroyer1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer1Texture = tex;
        }

        if (destroyer1Texture) {
            pixiTextures.destroyer_hull = destroyer1Texture;
            pixiTextureAnchors.destroyer_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural destroyer texture.
    }
};

const applyDestroyer2Texture = () => {
    if (!window.PIXI) return;
    try {
        if (destroyer2Loaded && !destroyer2Texture) {
            const tex = PIXI.Texture.from(destroyer2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer2Texture = tex;
        }

        if (destroyer2Texture) {
            pixiTextures.destroyer2_hull = destroyer2Texture;
            pixiTextureAnchors.destroyer2_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural destroyer texture.
    }
};

const applyDungeonTextures = () => {
    if (!window.PIXI) return;
    try {
        // Process dungeon boss textures
        if (dungeon4Loaded && !dungeon4Texture) {
            const tex = PIXI.Texture.from(dungeon4Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon4Texture = tex;
        }
        if (dungeon5Loaded && !dungeon5Texture) {
            const tex = PIXI.Texture.from(dungeon5Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon5Texture = tex;
        }
        if (dungeon6Loaded && !dungeon6Texture) {
            const tex = PIXI.Texture.from(dungeon6Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon6Texture = tex;
        }
        if (dungeon7Loaded && !dungeon7Texture) {
            const tex = PIXI.Texture.from(dungeon7Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon7Texture = tex;
        }
        if (dungeon8Loaded && !dungeon8Texture) {
            const tex = PIXI.Texture.from(dungeon8Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon8Texture = tex;
        }
        if (dungeon9Loaded && !dungeon9Texture) {
            const tex = PIXI.Texture.from(dungeon9Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon9Texture = tex;
        }

        // Register dungeon boss textures
        if (dungeon4Texture) {
            pixiTextures.enemy_dungeon4 = dungeon4Texture;
            pixiTextureAnchors.enemy_dungeon4 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon4 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon4 = true;
            pixiTextureBaseScales.enemy_dungeon4 = 1;
        }
        if (dungeon5Texture) {
            pixiTextures.enemy_dungeon5 = dungeon5Texture;
            pixiTextureAnchors.enemy_dungeon5 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon5 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon5 = true;
            pixiTextureBaseScales.enemy_dungeon5 = 1;
        }
        if (dungeon6Texture) {
            pixiTextures.enemy_dungeon6 = dungeon6Texture;
            pixiTextureAnchors.enemy_dungeon6 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon6 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon6 = true;
            pixiTextureBaseScales.enemy_dungeon6 = 1;
        }
        if (dungeon7Texture) {
            pixiTextures.enemy_dungeon7 = dungeon7Texture;
            pixiTextureAnchors.enemy_dungeon7 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon7 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon7 = true;
            pixiTextureBaseScales.enemy_dungeon7 = 1;
        }
        if (dungeon8Texture) {
            pixiTextures.enemy_dungeon8 = dungeon8Texture;
            pixiTextureAnchors.enemy_dungeon8 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon8 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon8 = true;
            pixiTextureBaseScales.enemy_dungeon8 = 1;
        }
        if (dungeon9Texture) {
            pixiTextures.enemy_dungeon9 = dungeon9Texture;
            pixiTextureAnchors.enemy_dungeon9 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon9 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon9 = true;
            pixiTextureBaseScales.enemy_dungeon9 = 1;
        }
    } catch (e) {
        console.error('Error loading dungeon textures:', e);
    }
};

gunboat1Image.addEventListener('load', () => {
    gunboat1Loaded = true;
    applyGunboatTextures();
});
gunboat1Image.addEventListener('error', () => {
    gunboat1Loaded = false;
});
gunboat2Image.addEventListener('load', () => {
    gunboat2Loaded = true;
    applyGunboatTextures();
});
gunboat2Image.addEventListener('error', () => {
    gunboat2Loaded = false;
});
station1Image.addEventListener('load', () => {
    station1Loaded = true;
    applyStationTexture();
});
station1Image.addEventListener('error', () => {
    station1Loaded = false;
});
destroyer1Image.addEventListener('load', () => {
    destroyer1Loaded = true;
    applyDestroyerTexture();
});
destroyer1Image.addEventListener('error', () => {
    destroyer1Loaded = false;
});
destroyer2Image.addEventListener('load', () => {
    destroyer2Loaded = true;
    applyDestroyer2Texture();
});
destroyer2Image.addEventListener('error', () => {
    destroyer2Loaded = false;
});

// Dungeon boss sprite load events
dungeon4Image.addEventListener('load', () => {
    dungeon4Loaded = true;
    applyDungeonTextures();
});
dungeon4Image.addEventListener('error', () => {
    dungeon4Loaded = false;
});
dungeon5Image.addEventListener('load', () => {
    dungeon5Loaded = true;
    applyDungeonTextures();
});
dungeon5Image.addEventListener('error', () => {
    dungeon5Loaded = false;
});
dungeon6Image.addEventListener('load', () => {
    dungeon6Loaded = true;
    applyDungeonTextures();
});
dungeon6Image.addEventListener('error', () => {
    dungeon6Loaded = false;
});
dungeon7Image.addEventListener('load', () => {
    dungeon7Loaded = true;
    applyDungeonTextures();
});
dungeon7Image.addEventListener('error', () => {
    dungeon7Loaded = false;
});
dungeon8Image.addEventListener('load', () => {
    dungeon8Loaded = true;
    applyDungeonTextures();
});
dungeon8Image.addEventListener('error', () => {
    dungeon8Loaded = false;
});
dungeon9Image.addEventListener('load', () => {
    dungeon9Loaded = true;
    applyDungeonTextures();
});
dungeon9Image.addEventListener('error', () => {
    dungeon9Loaded = false;
});

// Cave monster sprites
const MONSTER1_URL = 'assets/monster1.png';
const MONSTER2_URL = 'assets/monster2.png';
const MONSTER4_URL = 'assets/monster4.png';
const monster1Image = new Image();
const monster2Image = new Image();
const monster4Image = new Image();
monster1Image.decoding = 'async';
monster2Image.decoding = 'async';
monster4Image.decoding = 'async';
monster1Image.src = MONSTER1_URL;
monster2Image.src = MONSTER2_URL;
monster4Image.src = MONSTER4_URL;
let monster1Texture = null;
let monster2Texture = null;
let monster4Texture = null;
let monster1Loaded = false;
let monster2Loaded = false;
let monster4Loaded = false;

const applyMonsterTextures = () => {
    if (!window.PIXI) return;
    try {
        if (monster1Loaded && !monster1Texture) {
            const tex = PIXI.Texture.from(monster1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster1Texture = tex;
            pixiTextures.cave_monster_1 = monster1Texture;
            pixiTextureAnchors.cave_monster_1 = 0.5;
            pixiTextureScaleToRadius.cave_monster_1 = true;
            pixiTextureBaseScales.cave_monster_1 = 1;
        }
        if (monster2Loaded && !monster2Texture) {
            const tex = PIXI.Texture.from(monster2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster2Texture = tex;
            pixiTextures.cave_monster_2 = monster2Texture;
            pixiTextureAnchors.cave_monster_2 = 0.5;
            pixiTextureScaleToRadius.cave_monster_2 = true;
            pixiTextureBaseScales.cave_monster_2 = 1;
        }
        if (monster4Loaded && !monster4Texture) {
            const tex = PIXI.Texture.from(monster4Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster4Texture = tex;
            pixiTextures.cave_monster_3 = monster4Texture;
            pixiTextureAnchors.cave_monster_3 = 0.5;
            pixiTextureScaleToRadius.cave_monster_3 = true;
            pixiTextureBaseScales.cave_monster_3 = 1;
        }
    } catch (e) {
        // Keep procedural monster textures.
    }
};

monster1Image.addEventListener('load', () => {
    monster1Loaded = true;
    applyMonsterTextures();
});
monster1Image.addEventListener('error', () => {
    monster1Loaded = false;
});
monster2Image.addEventListener('load', () => {
    monster2Loaded = true;
    applyMonsterTextures();
});
monster2Image.addEventListener('error', () => {
    monster2Loaded = false;
});
monster4Image.addEventListener('load', () => {
    monster4Loaded = true;
    applyMonsterTextures();
});
monster4Image.addEventListener('error', () => {
    monster4Loaded = false;
});

// Optional external sprite override for nugget pickups (also used by nugz caches).
const NUGGET_URL = 'assets/nugget.png';
const nuggetImage = new Image();
nuggetImage.decoding = 'async';
nuggetImage.src = NUGGET_URL;
let nuggetTexture = null;
let nuggetLoaded = false;

const applyNuggetTexture = () => {
    if (!nuggetLoaded || nuggetTexture || !window.PIXI || !pixiTextures) return;
    try {
        const tex = PIXI.Texture.from(nuggetImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        nuggetTexture = tex;
        pixiTextures.nugget = tex;
    } catch (e) {
        // Keep procedural nugget texture.
    }
};

nuggetImage.addEventListener('load', () => {
    nuggetLoaded = true;
    applyNuggetTexture();
});
nuggetImage.addEventListener('error', () => {
    nuggetLoaded = false;
});

// Optional external sprite overrides for roamers/defenders/hunters.
const ROAMER_URL = 'assets/roamer1.png';
const ELITE_ROAMER_URL = 'assets/roamer_elite.png';
const HUNTER_URL = 'assets/hunter.png';
const DEFENDER_URL = 'assets/defender.png';
const roamerImage = new Image();
const eliteRoamerImage = new Image();
const hunterImage = new Image();
const defenderImage = new Image();
roamerImage.decoding = 'async';
eliteRoamerImage.decoding = 'async';
hunterImage.decoding = 'async';
defenderImage.decoding = 'async';
roamerImage.src = ROAMER_URL;
eliteRoamerImage.src = ELITE_ROAMER_URL;
hunterImage.src = HUNTER_URL;
defenderImage.src = DEFENDER_URL;

const applyEnemyTexture = (img, key) => {
    if (!img || img.naturalWidth <= 0 || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(img);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        pixiTextures[key] = tex;
        pixiTextureAnchors[key] = 0.5;
        pixiTextureScaleToRadius[key] = true;
        if (key === 'enemy_roamer' || key === 'enemy_elite_roamer' || key === 'enemy_hunter' || key === 'enemy_defender') {
            pixiTextureRotOffsets[key] = Math.PI / 2;
        }
    } catch (e) {
        // Keep procedural enemy textures.
    }
};

roamerImage.addEventListener('load', () => {
    applyEnemyTexture(roamerImage, 'enemy_roamer');
});
eliteRoamerImage.addEventListener('load', () => {
    applyEnemyTexture(eliteRoamerImage, 'enemy_elite_roamer');
});
hunterImage.addEventListener('load', () => {
    applyEnemyTexture(hunterImage, 'enemy_hunter');
});
defenderImage.addEventListener('load', () => {
    applyEnemyTexture(defenderImage, 'enemy_defender');
});

// Optional external sprite override for the standard base.
const BASE1_URL = 'assets/base1.png';
const base1Image = new Image();
base1Image.decoding = 'async';
base1Image.src = BASE1_URL;
let base1Texture = null;
let base1Loaded = false;

const applyBase1Texture = () => {
    if (!base1Loaded || base1Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base1Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base1Texture = tex;
        pixiTextures.base_standard = tex;
        pixiTextureAnchors.base_standard = 0.5;

        // Match the existing base's visual diameter (~2*radius = 140px).
        const desired = 140;
        const denom = Math.max(1, Math.max(base1Image.naturalWidth || 1, base1Image.naturalHeight || 1));
        pixiTextureBaseScales.base_standard = desired / denom;
    } catch (e) {
        // Keep procedural base textures.
    }
};

base1Image.addEventListener('load', () => {
    base1Loaded = true;
    applyBase1Texture();
});
base1Image.addEventListener('error', () => {
    base1Loaded = false;
});

// Optional external sprite override for the heavy base.
const BASE2_URL = 'assets/base2.png';
const base2Image = new Image();
base2Image.decoding = 'async';
base2Image.src = BASE2_URL;
let base2Texture = null;
let base2Loaded = false;

const applyBase2Texture = () => {
    if (!base2Loaded || base2Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base2Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base2Texture = tex;
        pixiTextures.base_heavy = tex;
        pixiTextureAnchors.base_heavy = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base2Image.naturalWidth || 1, base2Image.naturalHeight || 1));
        pixiTextureBaseScales.base_heavy = desired / denom;
    } catch (e) { }
};

base2Image.addEventListener('load', () => {
    base2Loaded = true;
    applyBase2Texture();
});
base2Image.addEventListener('error', () => {
    base2Loaded = false;
});

// Optional external sprite override for the rapid base.
const BASE3_URL = 'assets/base3.png';
const base3Image = new Image();
base3Image.decoding = 'async';
base3Image.src = BASE3_URL;
let base3Texture = null;
let base3Loaded = false;

const applyBase3Texture = () => {
    if (!base3Loaded || base3Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base3Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base3Texture = tex;
        pixiTextures.base_rapid = tex;
        pixiTextureAnchors.base_rapid = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base3Image.naturalWidth || 1, base3Image.naturalHeight || 1));
        pixiTextureBaseScales.base_rapid = desired / denom;
    } catch (e) { }
};

base3Image.addEventListener('load', () => {
    base3Loaded = true;
    applyBase3Texture();
});
base3Image.addEventListener('error', () => {
    base3Loaded = false;
});

// Optional external sprite override for the cruiser.
const CRUISER_URL = 'assets/cruiser.png';
const cruiserImage = new Image();
cruiserImage.decoding = 'async';
cruiserImage.src = CRUISER_URL;
let cruiserTexture = null;
let cruiserLoaded = false;

const applyCruiserTexture = () => {
    if (!cruiserLoaded || cruiserTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(cruiserImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        cruiserTexture = tex;
        pixiTextures.enemy_cruiser = tex;
        pixiTextureAnchors.enemy_cruiser = 0.5;

        // Auto-rotate if the asset is portrait (common for "nose up" sprites).
        const w = cruiserImage.naturalWidth || 0;
        const h = cruiserImage.naturalHeight || 0;
        pixiTextureRotOffsets.enemy_cruiser = (h > w) ? (Math.PI / 2) : 0;

        // For cruisers, scale by in-world radius (better match for boss scaling).
        pixiTextureScaleToRadius.enemy_cruiser = true;
    } catch (e) { }
};

cruiserImage.addEventListener('load', () => {
    cruiserLoaded = true;
    applyCruiserTexture();
});
cruiserImage.addEventListener('error', () => {
    cruiserLoaded = false;
});

// Warp Sentinel Boss sprite override
const WARP_BOSS_URL = 'assets/warp_boss.png';
const warpBossImage = new Image();
warpBossImage.decoding = 'async';
warpBossImage.src = WARP_BOSS_URL;
let warpBossTexture = null;
let warpBossLoaded = false;

const applyWarpBossTexture = () => {
    if (!warpBossLoaded || warpBossTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(warpBossImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        warpBossTexture = tex;
        pixiTextures.warp_boss = tex;
        pixiTextureAnchors.warp_boss = 0.5;
        // Face right by default; rotate to face player
        pixiTextureRotOffsets.warp_boss = 0;
        // Scale to fit the body width (exclude wispy tail)
        pixiTextureScaleToRadius.warp_boss = true;
    } catch (e) { }
};

warpBossImage.addEventListener('load', () => {
    warpBossLoaded = true;
    applyWarpBossTexture();
});
warpBossImage.addEventListener('error', () => {
    warpBossLoaded = false;
});

// Final Boss sprite override
const FINAL_BOSS_URL = 'assets/spaceboss2.png';
const finalBossImage = new Image();
finalBossImage.decoding = 'async';
finalBossImage.src = FINAL_BOSS_URL;
let finalBossTexture = null;
let finalBossLoaded = false;

const applyFinalBossTexture = () => {
    if (!finalBossLoaded || finalBossTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(finalBossImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        finalBossTexture = tex;
        pixiTextures.final_boss = tex;
        pixiTextureAnchors.final_boss = 0.5;
        pixiTextureRotOffsets.final_boss = 0;
        pixiTextureScaleToRadius.final_boss = true;
    } catch (e) { }
};

finalBossImage.addEventListener('load', () => {
    finalBossLoaded = true;
    applyFinalBossTexture();
});
finalBossImage.addEventListener('error', () => {
    finalBossLoaded = false;
});

// Optional external sprite override for asteroid size tiers.
// sizeLevel: 3=large, 2=medium, 1=small.
const ASTEROID1_URL = 'assets/asteroid1.png';
const ASTEROID2_URL = 'assets/asteroid2.png';
const ASTEROID3_URL = 'assets/asteroid3.png';
const ASTEROID2_U_URL = 'assets/asteroid2_U.png'; // Indestructible asteroid
const asteroidImages = [
    new Image(),
    new Image(),
    new Image()
];
const asteroidIndestructibleImage = new Image();
asteroidIndestructibleImage.decoding = 'async';
asteroidIndestructibleImage.src = ASTEROID2_U_URL;
asteroidImages[0].decoding = 'async';
asteroidImages[1].decoding = 'async';
asteroidImages[2].decoding = 'async';
asteroidImages[0].src = ASTEROID1_URL;
asteroidImages[1].src = ASTEROID2_URL;
asteroidImages[2].src = ASTEROID3_URL;

// Update pixi-context with image references for canvas fallback
setAsteroidImages(asteroidImages);
setAsteroidIndestructibleImage(asteroidIndestructibleImage);

let asteroidTexturesExternalReady = false;

const applyAsteroidTextures = () => {
    if (asteroidTexturesExternalReady || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    if (!asteroidImages.every(img => img && img.naturalWidth > 0)) return;
    try {
        const tex1 = PIXI.Texture.from(asteroidImages[0]);
        const tex2 = PIXI.Texture.from(asteroidImages[1]);
        const tex3 = PIXI.Texture.from(asteroidImages[2]);
        for (const t of [tex1, tex2, tex3]) {
            try { t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { t.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        }
        pixiTextures.asteroids = [tex1, tex2, tex3];
        pixiTextureAnchors.asteroid_0 = 0.5;
        pixiTextureAnchors.asteroid_1 = 0.5;
        pixiTextureAnchors.asteroid_2 = 0.5;

        asteroidTexturesExternalReady = true;
        setAsteroidTexturesReady(true);
    } catch (e) {
        // Keep procedural asteroid textures.
    }
};

for (const img of asteroidImages) {
    img.addEventListener('load', applyAsteroidTextures);
    img.addEventListener('error', () => {
        // Any missing asteroid image should leave procedural rendering intact.
    });
}

// Indestructible asteroid texture
asteroidIndestructibleImage.addEventListener('load', () => {
    if (!window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(asteroidIndestructibleImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        pixiTextures.asteroidIndestructible = tex;
        pixiTextureAnchors.asteroidIndestructible = 0.5;

        setAsteroidIndestructibleTextureReady(true);
    } catch (e) {
        console.warn('Failed to load indestructible asteroid texture', e);
    }
});
asteroidIndestructibleImage.addEventListener('error', () => {
    // Indestructible asteroid image is optional
});

// Optional external sprite override for the player hull.
const PLAYER1_URL = 'assets/player1.png';
const playerHullImage = new Image();
playerHullImage.decoding = 'async';
playerHullImage.src = PLAYER1_URL;
let playerHullExternalReady = false; // image loaded (usable by Canvas fallback too)
let playerHullPixiApplied = false;

const applyPlayerHullTexture = () => {
    if (!playerHullImage || playerHullImage.naturalWidth <= 0) return;

    // Player art is authored nose-up; apply an offset to match our world angle convention.
    playerHullExternalReady = true;

    if (playerHullPixiApplied || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(playerHullImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.player_hull = tex;
        pixiTextureAnchors.player_hull = 0.5;
        playerHullPixiApplied = true;
    } catch (e) {
        // Keep procedural hull.
    }
};
playerHullImage.addEventListener('load', applyPlayerHullTexture);
playerHullImage.addEventListener('error', () => {
    playerHullExternalReady = false;
    playerHullPixiApplied = false;
});

// Slacker ship external sprite
const SLACKER_URL = 'assets/slacker.png';
const slackerHullImage = new Image();
slackerHullImage.decoding = 'async';
slackerHullImage.src = SLACKER_URL;
let slackerHullExternalReady = false;
let slackerHullPixiApplied = false;

const applySlackerHullTexture = () => {
    if (!slackerHullImage || slackerHullImage.naturalWidth <= 0) return;

    slackerHullExternalReady = true;

    if (slackerHullPixiApplied || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(slackerHullImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.slacker_hull = tex;
        pixiTextureAnchors.slacker_hull = 0.5;
        slackerHullPixiApplied = true;
    } catch (e) {
        // Keep procedural hull.
    }
};
slackerHullImage.addEventListener('load', applySlackerHullTexture);
slackerHullImage.addEventListener('error', () => {
    slackerHullExternalReady = false;
    slackerHullPixiApplied = false;
});

// Explosion sprite sheet (4 columns x 5 rows, 1024x1024).
const EXPLOSION1_URL = 'assets/explosion1.png';
const explosion1Image = new Image();
explosion1Image.decoding = 'async';
explosion1Image.src = EXPLOSION1_URL;


if (USE_PIXI_OVERLAY && window.PIXI) {
    console.log('[DEBUG] Pixi Block Entered');
    try { PIXI.settings.ROUND_PIXELS = true; } catch (e) { }
    pixiApp = new PIXI.Application({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true
    });
    try { pixiApp.renderer.roundPixels = true; } catch (e) { }
    // We'll render Pixi manually in our main loop to avoid double work.
    try { pixiApp.stop(); } catch (e) { }

    pixiApp.view.style.position = 'absolute';
    pixiApp.view.style.top = '0';
    pixiApp.view.style.left = '0';
    pixiApp.view.style.pointerEvents = 'none';
    pixiApp.view.style.zIndex = '15';  // Higher than uiCanvas (10) to render minimap/arrows on top
    document.body.appendChild(pixiApp.view);
    pixiTextureWhite = PIXI.Texture.WHITE;
    try { pixiApp.stage.eventMode = 'none'; } catch (e) { }

    pixiScreenRoot = new PIXI.Container();
    pixiWorldRoot = new PIXI.Container();
    pixiApp.stage.addChild(pixiScreenRoot);
    pixiApp.stage.addChild(pixiWorldRoot);

    // UI Overlay layer (minimap and directional arrows) - must be added AFTER world root to render on top
    pixiUiOverlayLayer = new PIXI.Container();
    pixiMinimapGraphics = new PIXI.Graphics();
    pixiArrowsGraphics = new PIXI.Graphics();
    pixiUiOverlayLayer.addChild(pixiArrowsGraphics);  // Arrows drawn first (behind minimap)
    pixiUiOverlayLayer.addChild(pixiMinimapGraphics);  // Minimap on top
    pixiApp.stage.addChild(pixiUiOverlayLayer);  // Add to stage (not pixiScreenRoot) so it renders above everything

    const makeGlowTexture = () => {
        const g = new PIXI.Graphics();
        // Large soft outer glow
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 16);
        // Medium glow
        g.beginFill(0xffffff, 0.4);
        g.drawCircle(0, 0, 8);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 4);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeLaserTexture = () => {
        const g = new PIXI.Graphics();
        // Glow
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-24, -8, 48, 16, 8);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-18, -5, 36, 10, 5);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-14, -2, 28, 4, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeSquareTexture = () => {
        const g = new PIXI.Graphics();
        // Glow
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-16, -16, 32, 32, 4);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-10, -10, 20, 20, 3);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-4, -4, 8, 8, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.glow = makeGlowTexture();
    pixiBulletTextures.laser = makeLaserTexture();
    pixiBulletTextures.square = makeSquareTexture();

    const makeMissileTexture = () => {
        const g = new PIXI.Graphics();
        // Shadow / Glow
        g.beginFill(0xffaa00, 0.3);
        g.drawCircle(0, 0, 12);
        g.beginFill(0xffaa00, 0.5);
        g.drawCircle(0, 0, 6);

        // Missile Body (Triangle pointing right)
        g.beginFill(0xff8800, 1);
        g.moveTo(6, 0);
        g.lineTo(-4, 4);
        g.lineTo(-4, -4);
        g.closePath();

        // Engine Glow (Static approximation)
        g.beginFill(0xff6400, 0.8);
        g.drawRect(-6, -2, 4, 4);

        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.missile = makeMissileTexture();

    const makeParticleGlowTexture = () => {
        const g = new PIXI.Graphics();
        // Inner core
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 2);
        // Soft outer halo
        g.beginFill(0xffffff, 0.45);
        g.drawCircle(0, 0, 5);
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 10);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleGlowTexture = makeParticleGlowTexture();

    const makeSmokeTexture = () => {
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0xffffff, 1);
        g.drawRect(-16, -16, 32, 32);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleSmokeTexture = makeSmokeTexture();

    const makeWarpTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1);
        g.drawRect(0, -2, 32, 4); // Origin at left-center
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleWarpTexture = makeWarpTexture();

    // Background (screen-space)
    pixiNebulaLayer = new PIXI.Container();
    pixiCaveGridLayer = new PIXI.Container();
    pixiStarLayer = new PIXI.ParticleContainer(8000, { position: true, tint: true, scale: true, alpha: true });
    pixiStarTilingLayer = new PIXI.Container();
    pixiScreenRoot.addChild(pixiNebulaLayer);
    pixiScreenRoot.addChild(pixiCaveGridLayer);
    pixiScreenRoot.addChild(pixiStarTilingLayer);
    pixiScreenRoot.addChild(pixiStarLayer);

    // World-space layers (camera transformed)
    // Use a regular Container for asteroids because they use multiple textures; ParticleContainer can
    // occasionally show wrong textures under heavy batching, which looks like "shape changing".
    pixiAsteroidLayer = new PIXI.Container();
    pixiPickupLayer = new PIXI.ParticleContainer(6000, { position: true, rotation: true, tint: true, scale: true, alpha: true });
    pixiPlayerLayer = new PIXI.Container();
    pixiBaseLayer = new PIXI.Container();
    // NOTE: ParticleContainer effectively assumes a single texture; enemies use multiple textures (and can now include external images),
    // so use a regular Container to avoid "all enemies show the same sprite" issues.
    pixiEnemyLayer = new PIXI.Container();
    pixiBossLayer = new PIXI.Container();
    pixiVectorLayer = new PIXI.Container();
    // Use regular Container for bullets since they use multiple different generated textures
    // (glow, laser, square, missile). ParticleContainer requires uniform base textures.
    pixiBulletLayer = new PIXI.Container();
    pixiParticleLayer = new PIXI.ParticleContainer(20000, { position: true, tint: true, scale: true, alpha: true });

    pixiWorldRoot.addChild(pixiAsteroidLayer);
    pixiWorldRoot.addChild(pixiPickupLayer);
    pixiWorldRoot.addChild(pixiPlayerLayer);
    pixiWorldRoot.addChild(pixiBaseLayer);
    pixiWorldRoot.addChild(pixiEnemyLayer);
    pixiWorldRoot.addChild(pixiBossLayer);
    pixiWorldRoot.addChild(pixiVectorLayer);
    pixiWorldRoot.addChild(pixiBulletLayer);
    pixiWorldRoot.addChild(pixiParticleLayer);

    // Cave grid background (screen-space tiling texture)
    const makeCaveGridTexture = () => {
        const grid = 420;
        const minor = 210;
        const g = new PIXI.Graphics();
        // Minor grid lines (slightly thicker so they survive low zoom)
        g.lineStyle(2, 0x00ffff, 0.05);
        g.moveTo(0, 0); g.lineTo(0, grid);
        g.moveTo(minor, 0); g.lineTo(minor, grid);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, minor); g.lineTo(grid, minor);
        // Major lines on tile edges
        g.lineStyle(3, 0x00ffff, 0.10);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, 0); g.lineTo(0, grid);
        const tex = pixiApp.renderer.generateTexture(g);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };
    try {
        pixiCaveGridTexture = makeCaveGridTexture();
        pixiCaveGridSprite = new PIXI.TilingSprite(pixiCaveGridTexture, (typeof width === 'number' && width > 0) ? width : 1, (typeof height === 'number' && height > 0) ? height : 1);
        pixiCaveGridSprite.alpha = 1;
        pixiCaveGridLayer.addChild(pixiCaveGridSprite);
        pixiCaveGridLayer.visible = false;
    } catch (e) { }

    // Bridge main.js local layers to the shared pixi-context
    setPixiContext({
        pixiApp,
        pixiWorldRoot,
        pixiScreenRoot,
        pixiAsteroidLayer,
        pixiPickupLayer,
        pixiPlayerLayer,
        pixiBaseLayer,
        pixiEnemyLayer,
        pixiBossLayer,
        pixiVectorLayer,
        pixiBulletLayer,
        pixiParticleLayer,
        pixiNebulaLayer,
        pixiStarLayer,
        pixiStarTilingLayer,
        pixiCaveGridLayer,
        pixiCaveGridSprite,
        pixiTextureWhite,
        pixiParticleSmokeTexture,
        pixiParticleWarpTexture
    });

    // --- Starfield and Nebula Backdrop ---
    // Create procedural textures for parallax star layers and nebula clouds.
    // Uses TilingSprite for GPU-optimized infinite scrolling.
    const STAR_TILE_SIZE = 512;
    const NEBULA_TILE_SIZE = 512;

    // Generate a GameContext.starfield texture with random stars (seamless tile)
    const makeStarfieldTexture = (starCount, minSize, maxSize, minAlpha, maxAlpha) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * STAR_TILE_SIZE;
            const y = Math.random() * STAR_TILE_SIZE;
            const size = minSize + Math.random() * (maxSize - minSize);
            const alpha = minAlpha + Math.random() * (maxAlpha - minAlpha);
            // Slight color variation: white to light blue/yellow
            const colorVar = Math.random();
            let color = 0xffffff;
            if (colorVar < 0.15) color = 0xaaddff; // light blue
            else if (colorVar < 0.25) color = 0xffffaa; // light yellow
            else if (colorVar < 0.3) color = 0xffccaa; // light orange
            // Draw the star and its wrapped copies for seamless tiling
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    g.beginFill(color, alpha);
                    g.drawCircle(x + ox * STAR_TILE_SIZE, y + oy * STAR_TILE_SIZE, size);
                    g.endFill();
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, STAR_TILE_SIZE, STAR_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    // Generate a nebula texture with soft colored clouds (seamless tile)
    // Uses multiple overlapping circles with varying alpha to create soft gradient-like blobs
    const makeNebulaTexture = (blobCount, palette) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < blobCount; i++) {
            const x = Math.random() * NEBULA_TILE_SIZE;
            const y = Math.random() * NEBULA_TILE_SIZE;
            const baseSize = 60 + Math.random() * 140;
            const color = palette[Math.floor(Math.random() * palette.length)];
            const baseAlpha = 0.001 + Math.random() * 0.003; // Very subtle/transparent

            // Draw multiple layered circles to create soft gradient falloff
            const layers = 8;
            for (let layer = layers; layer >= 1; layer--) {
                const ratio = layer / layers;
                const size = baseSize * ratio;
                const layerAlpha = baseAlpha * (1 - ratio * 0.7); // Fade toward edges

                // Draw at the position and wrapped copies for seamless tiling
                for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                        g.beginFill(color, layerAlpha);
                        g.drawCircle(x + ox * NEBULA_TILE_SIZE, y + oy * NEBULA_TILE_SIZE, size);
                        g.endFill();
                    }
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, NEBULA_TILE_SIZE, NEBULA_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    // Color palettes for nebulae (different sectors can use different palettes)
    const nebulaPalettes = [
        [0x4400aa, 0x220066, 0x6622aa, 0x3311aa], // Purple/violet
        [0x004488, 0x002266, 0x006688, 0x003366], // Blue
        [0x440022, 0x660033, 0x880044, 0x330022], // Red/magenta
        [0x224400, 0x336600, 0x448800, 0x113300], // Green (rare)
    ];
    pixiNebulaPaletteIdx = Math.floor(Math.random() * nebulaPalettes.length);

    try {
        // Create 3 parallax star layers (far, mid, near)
        const starTexFar = makeStarfieldTexture(80, 0.5, 1.2, 0.1, 0.25);   // Many dim distant stars
        const starTexMid = makeStarfieldTexture(40, 0.8, 1.8, 0.2, 0.35);   // Medium stars
        const starTexNear = makeStarfieldTexture(15, 1.2, 2.5, 0.3, 0.5); // Fewer bright close stars

        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;

        const starTiles = [
            { sprite: new PIXI.TilingSprite(starTexFar, w, h), parallax: 0.02 },
            { sprite: new PIXI.TilingSprite(starTexMid, w, h), parallax: 0.05 },
            { sprite: new PIXI.TilingSprite(starTexNear, w, h), parallax: 0.10 }
        ];
        setStarTiles(starTiles);
        starTiles.forEach(layer => {
            pixiStarTilingLayer.addChild(layer.sprite);
        });

        // Create 2 nebula layers (far, near)
        const nebulaTexFar = makeNebulaTexture(12, nebulaPalettes[pixiNebulaPaletteIdx]);
        const nebulaTexNear = makeNebulaTexture(8, nebulaPalettes[pixiNebulaPaletteIdx]);
        const nebulaTiles = [
            { sprite: new PIXI.TilingSprite(nebulaTexFar, w, h), parallax: 0.01 },
            { sprite: new PIXI.TilingSprite(nebulaTexNear, w, h), parallax: 0.03 }
        ];
        setNebulaTiles(nebulaTiles);
        nebulaTiles.forEach(layer => {
            layer.sprite.blendMode = PIXI.BLEND_MODES.ADD;
            pixiNebulaLayer.addChild(layer.sprite);
        });
    } catch (e) {
        console.warn('Backdrop initialization failed:', e);
    }

    // --- Prebaked textures (avoid per-frame Canvas2D paths for hot objects) ---
    const genTexture = (graphics) => {
        const b = graphics.getLocalBounds();
        const tex = pixiApp.renderer.generateTexture(graphics);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        const anchor = (b && b.width > 0 && b.height > 0)
            ? { x: (-b.x) / b.width, y: (-b.y) / b.height }
            : { x: 0.5, y: 0.5 };
        try { graphics.destroy(true); } catch (e) { }
        return { tex, anchor };
    };

    const makeGlowStrokedPolyTexture = (points, fillHex, strokeHex, lineWidth = 2) => {
        const g = new PIXI.Graphics();
        g.beginFill(fillHex, 1);
        g.drawPolygon(points);
        g.endFill();
        // Glow-ish outline
        g.lineStyle(lineWidth * 5, strokeHex, 0.12);
        g.drawPolygon(points);
        g.lineStyle(lineWidth * 3, strokeHex, 0.25);
        g.drawPolygon(points);
        g.lineStyle(lineWidth, strokeHex, 1);
        g.drawPolygon(points);
        return genTexture(g);
    };

    // Pickups
    {
        const makeCoin = (fillHex) => {
            const g = new PIXI.Graphics();
            const pts = [0, -8, 8, 0, 0, 8, -8, 0];

            // Outer Glow (Large halo)
            g.lineStyle(24, fillHex, 0.15);
            g.drawPolygon(pts);

            // Inner Glow
            g.lineStyle(12, fillHex, 0.4);
            g.drawPolygon(pts);

            // Core Outline (White)
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(fillHex, 1);
            g.drawPolygon(pts);
            g.endFill();

            return genTexture(g).tex;
        };
        pixiTextures.coin1 = makeCoin(0xffff00);
        pixiTextures.coin5 = makeCoin(0xffff00);  // All coins are gold
        pixiTextures.coin10 = makeCoin(0xffff00); // All coins are gold

        const makeHealth = () => {
            const g = new PIXI.Graphics();
            // glow behind
            g.beginFill(0x00ff00, 0.12);
            g.drawCircle(0, 0, 20);
            g.endFill();
            // plus
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x00ff00, 1);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            g.endFill();
            g.lineStyle(10, 0x00ff00, 0.10);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            return genTexture(g).tex;
        };
        pixiTextures.health = makeHealth();

        const makeNugget = () => {
            const c = document.createElement('canvas');
            c.width = 96;
            c.height = 96;
            const cctx = c.getContext('2d');
            cctx.translate(48, 48);
            cctx.rotate(Math.PI / 6);
            cctx.lineJoin = 'round';
            cctx.lineWidth = 6;
            const grad = cctx.createLinearGradient(-24, -24, 24, 24);
            grad.addColorStop(0, '#ff0');
            grad.addColorStop(0.5, '#f90');
            grad.addColorStop(1, '#0ff');
            cctx.fillStyle = grad;
            cctx.strokeStyle = '#fff';
            cctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const x = Math.cos(a) * 22;
                const y = Math.sin(a) * 22;
                if (i === 0) cctx.moveTo(x, y);
                else cctx.lineTo(x, y);
            }
            cctx.closePath();
            cctx.fill();
            cctx.stroke();
            return PIXI.Texture.from(c);
        };
        pixiTextures.nugget = makeNugget();
        applyNuggetTexture();
    }

    // Enemies (baked colors; per-instance alpha/tint for effects only)
    {
        const roamerPts = [18, 0, -12, 12, -6, 0, -12, -12];
        const elitePts = [25, 0, -15, 18, -5, 0, -15, -18];
        const hunterPts = [30, 0, -15, 12, -10, 0, -15, -12];

        const makeEnemy = (points, fillHex, strokeHex) => {
            const { tex, anchor } = makeGlowStrokedPolyTexture(points, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const r = makeEnemy(roamerPts, 0x441111, 0xff5555);
        pixiTextures.enemy_roamer = r.tex;
        pixiTextureAnchors.enemy_roamer = r.anchor;

        // Elite roamers should stay in the same red family as regular roamers (no purple tinting).
        const er = makeEnemy(elitePts, 0x441111, 0xff5555);
        pixiTextures.enemy_elite_roamer = er.tex;
        pixiTextureAnchors.enemy_elite_roamer = er.anchor;

        const h = makeEnemy(hunterPts, 0x442200, 0xffaa00);
        pixiTextures.enemy_hunter = h.tex;
        pixiTextureAnchors.enemy_hunter = h.anchor;

        const d = makeEnemy(roamerPts, 0x661111, 0xff8888);
        pixiTextures.enemy_defender = d.tex;
        pixiTextureAnchors.enemy_defender = d.anchor;

        // Gunboat silhouette (scaled in draw; base at s=1.4 to match Canvas default)
        const makeGunboat = (fillHex, strokeHex) => {
            const s = 1.4;
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            const { tex, anchor } = makeGlowStrokedPolyTexture(pts, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const gb1 = makeGunboat(0x221111, 0xff5555);
        pixiTextures.enemy_gunboat_1 = gb1.tex;
        pixiTextureAnchors.enemy_gunboat_1 = gb1.anchor;

        const gb2 = makeGunboat(0x332211, 0xffbb00);
        pixiTextures.enemy_gunboat_2 = gb2.tex;
        pixiTextureAnchors.enemy_gunboat_2 = gb2.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyGunboatTextures();

        const makeCruiser = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const L = 28 * s;
            const H = 7.5 * s;
            const nose = 6 * s;
            const tail = 7 * s;
            const podL = 10 * s;
            const podH = 3.2 * s;
            const podX = 16.5 * s;
            const podY = 10.0 * s;

            // Hull
            const hull = [
                L, 0,
                L - nose, H,
                -L + tail, H,
                -L, 0,
                -L + tail, -H,
                L - nose, -H
            ];
            g.beginFill(0x2b2f33, 1);
            g.drawPolygon(hull);
            g.endFill();

            // Pods
            g.beginFill(0x1b1f23, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);
            g.endFill();

            // Deck lines (subtle)
            g.lineStyle(1, 0x8aa0b3, 0.35);
            g.moveTo(-L + tail + 8 * s, 0);
            g.lineTo(L - nose - 10 * s, 0);
            g.moveTo(-L + tail + 8 * s, H * 0.55);
            g.lineTo(L - nose - 14 * s, H * 0.55);
            g.moveTo(-L + tail + 8 * s, -H * 0.55);
            g.lineTo(L - nose - 14 * s, -H * 0.55);

            // Outline glow
            g.lineStyle(10, 0xc7ced6, 0.10);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);

            // Engine glow
            g.beginFill(0x00ffff, 1);
            g.drawCircle(-L + 5 * s, 0, 2.8 * s);
            g.endFill();
            g.beginFill(0x00ffff, 0.20);
            g.drawCircle(-L + 5 * s, 0, 10 * s);
            g.endFill();

            return genTexture(g);
        };

        const cr = makeCruiser();
        pixiTextures.enemy_cruiser = cr.tex;
        pixiTextureAnchors.enemy_cruiser = cr.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyCruiserTexture();
    }

    // Asteroids (few shared variants; tinted per asteroid)
    {
        // If external asteroid art is present, use it and skip procedural generation.
        applyAsteroidTextures();
        if (!asteroidTexturesExternalReady) {
            const makeAsteroidVariant = () => {
                const g = new PIXI.Graphics();
                const points = [];
                // Higher-res base shape reduces "shape shimmer" while rotating at low zoom.
                const baseR = 320;
                const count = 12 + Math.floor(Math.random() * 7);
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2;
                    const r = baseR * (0.75 + Math.random() * 0.35);
                    points.push(Math.cos(a) * r, Math.sin(a) * r);
                }
                // Hollow asteroids: outline-only (no filled interior).
                g.lineStyle(7, 0xffffff, 0.90);
                g.drawPolygon(points);
                const { tex, anchor } = genTexture(g);
                try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF; } catch (e) { }
                return { tex, anchor };
            };
            pixiTextures.asteroids = [];
            for (let i = 0; i < 12; i++) {
                const v = makeAsteroidVariant();
                pixiTextures.asteroids.push(v.tex);
                pixiTextureAnchors[`asteroid_${i}`] = v.anchor;
            }
        } else {
            // Ensure the asteroid texture list exists even if external failed mid-session.
            if (!pixiTextures.asteroids || pixiTextures.asteroids.length === 0) pixiTextures.asteroids = [];
        }
    }

    // Player / Bases / Space station (prebaked textures)
    {
        // Player hull
        const makePlayerHull = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            g.beginFill(0x112222, 1);
            g.drawPolygon(pts);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawPolygon(pts);
            // Cockpit
            g.beginFill(0x001111, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            // Struts
            g.lineStyle(2, 0x00ffff, 1);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, 8 * s);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, -8 * s);
            return genTexture(g);
        };
        const ph = makePlayerHull();
        pixiTextures.player_hull = ph.tex;
        pixiTextureAnchors.player_hull = ph.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyPlayerHullTexture();

        // Player turret base (circle + cyan chevron)
        const makePlayerTurretBase = () => {
            const g = new PIXI.Graphics();
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x003333, 1);
            g.drawCircle(0, 0, 8);
            g.endFill();
            g.beginFill(0x00ffff, 1);
            g.drawPolygon([0, -4, 6, 0, 0, 4]);
            g.endFill();
            return genTexture(g);
        };
        const ptb = makePlayerTurretBase();
        pixiTextures.player_turret_base = ptb.tex;
        pixiTextureAnchors.player_turret_base = ptb.anchor;

        // Player barrel (anchor at left-center)
        const makePlayerBarrel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x000000, 1);
            g.drawRect(0, -3, 25, 6);
            g.endFill();
            g.lineStyle(2, 0xffffff, 1);
            g.drawRect(0, -3, 25, 6);
            return genTexture(g);
        };
        const pb = makePlayerBarrel();
        pixiTextures.player_barrel = pb.tex;
        pixiTextureAnchors.player_barrel = pb.anchor; // expects {x:0,y:0.5}

        // Player thruster (simple triangle, shown when thrusting)
        const makePlayerThruster = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            g.beginFill(0x00ffff, 1);
            g.drawPolygon([-25 * s, 4 * s, -40 * s, 0, -25 * s, -4 * s]);
            g.endFill();
            return genTexture(g);
        };
        const pth = makePlayerThruster();
        pixiTextures.player_thruster = pth.tex;
        pixiTextureAnchors.player_thruster = pth.anchor;

        const makePlayerTurboFlame = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const baseX = -25 * s;

            // Outer red/orange plume
            g.beginFill(0xff2200, 0.45);
            g.drawPolygon([
                baseX, 0,
                baseX - 105 * s, -18 * s,
                baseX - 95 * s, 0,
                baseX - 105 * s, 18 * s
            ]);
            g.endFill();

            // Mid orange
            g.beginFill(0xff6600, 0.65);
            g.drawPolygon([
                baseX, 0,
                baseX - 88 * s, -12 * s,
                baseX - 82 * s, 0,
                baseX - 88 * s, 12 * s
            ]);
            g.endFill();

            // Inner yellow
            g.beginFill(0xffdd00, 0.85);
            g.drawPolygon([
                baseX, 0,
                baseX - 70 * s, -9 * s,
                baseX - 66 * s, 0,
                baseX - 70 * s, 9 * s
            ]);
            g.endFill();

            // White-hot core
            g.beginFill(0xffffff, 0.75);
            g.drawPolygon([
                baseX, 0,
                baseX - 48 * s, -5 * s,
                baseX - 44 * s, 0,
                baseX - 48 * s, 5 * s
            ]);
            g.endFill();

            return genTexture(g);
        };
        const ptf = makePlayerTurboFlame();
        pixiTextures.player_turbo_flame = ptf.tex;
        pixiTextureAnchors.player_turbo_flame = ptf.anchor;

        // Bases
        const makeBase = (strokeHex, fillHex) => {
            const g = new PIXI.Graphics();
            const r = 70;
            g.beginFill(fillHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            g.endFill();
            g.lineStyle(6, strokeHex, 0.10);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(3, strokeHex, 0.85);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(2, strokeHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            return genTexture(g);
        };
        const bs = makeBase(0x00ffff, 0x111111);
        pixiTextures.base_standard = bs.tex;
        pixiTextureAnchors.base_standard = bs.anchor;
        const bh = makeBase(0xffaa00, 0x111111);
        pixiTextures.base_heavy = bh.tex;
        pixiTextureAnchors.base_heavy = bh.anchor;
        const br = makeBase(0x0088ff, 0x111111);
        pixiTextures.base_rapid = br.tex;
        pixiTextureAnchors.base_rapid = br.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyBase1Texture();
        applyBase2Texture();
        applyBase3Texture();
        applyStationTexture();

        // Station hull (procedural - used if external texture not available)
        if (!station1Texture) {
            const makeStationHull = () => {
                const g = new PIXI.Graphics();
                const R = 340;
                // Outer ring
                g.lineStyle(20, 0x333333, 1);
                g.drawCircle(0, 0, R - 30);
                // Main body
                g.beginFill(0x111111, 1);
                g.drawCircle(0, 0, R * 0.75);
                g.endFill();
                g.lineStyle(5, 0x00ffff, 1);
                g.drawCircle(0, 0, R * 0.75);
                // Tech ring + spokes
                g.lineStyle(2, 0x00ffff, 0.30);
                g.drawCircle(0, 0, R * 0.5);
                for (let i = 0; i < 8; i++) {
                    const a = i * (Math.PI / 4);
                    g.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
                    g.lineTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75);
                }
                // Core housing
                g.beginFill(0x000000, 1);
                g.drawCircle(0, 0, R * 0.25);
                g.endFill();
                g.lineStyle(3, 0xff00ff, 1);
                g.drawCircle(0, 0, R * 0.25);
                return genTexture(g);
            };
            const sh = makeStationHull();
            pixiTextures.station_hull = sh.tex;
            pixiTextureAnchors.station_hull = sh.anchor;
        }

        const makeStationCore = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0xff00ff, 1);
            g.drawCircle(0, 0, 60);
            g.endFill();
            g.beginFill(0xff00ff, 0.25);
            g.drawCircle(0, 0, 120);
            g.endFill();
            return genTexture(g);
        };
        const sc = makeStationCore();
        pixiTextures.station_core = sc.tex;
        pixiTextureAnchors.station_core = sc.anchor;

        const makeStationTurret = () => {
            const g = new PIXI.Graphics();
            // Base
            g.beginFill(0x333333, 1);
            g.drawCircle(0, 0, 22);
            g.endFill();
            g.lineStyle(2, 0x888888, 1);
            g.drawCircle(0, 0, 22);
            // Twin barrels (anchor around origin)
            g.beginFill(0xff4444, 1);
            g.drawRect(10, -12, 40, 8);
            g.drawRect(10, 4, 40, 8);
            g.endFill();
            // Center pivot
            g.beginFill(0xaaaaaa, 1);
            g.drawCircle(0, 0, 10);
            g.endFill();
            return genTexture(g);
        };
        const st = makeStationTurret();
        pixiTextures.station_turret = st.tex;
        pixiTextureAnchors.station_turret = st.anchor;
    }
}

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

let width, height;
// Internal resolution (absolute - game renders at this fixed resolution)
let internalWidth = 1920;
let internalHeight = 1080;

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





// --- Profile Save / Load (player stats only) ---
let selectedProfileName = null;
let fromPauseMenu = false;

function showAbortConfirmDialog() {
    return new Promise((resolve) => {
        const modal = document.getElementById('abort-modal');
        const confirmBtn = document.getElementById('abort-confirm');
        const cancelBtn = document.getElementById('abort-cancel');

        if (!modal || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        modal.style.display = 'block';

        // Reset gamepad navigation for this modal
        GameContext.menuSelectionIndex = 0;
        gpState.lastMenuElements = null;

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onYes);
            cancelBtn.removeEventListener('click', onNo);
            window.removeEventListener('keydown', onEscape);
            modal.style.display = 'none';
        };

        const onYes = () => {
            cleanup();
            resolve(true);
        };

        const onNo = () => {
            cleanup();
            resolve(false);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onNo();
            }
        };

        confirmBtn.addEventListener('click', onYes);
        cancelBtn.addEventListener('click', onNo);
        window.addEventListener('keydown', onEscape);

        // Wait one frame to ensure DOM has updated, then setup gamepad navigation
        requestAnimationFrame(() => {
            setMenuDebounce(Date.now() + 300);
            const active = getActiveMenuElements();
            if (active.length > 0) {
                updateMenuVisuals(active);
                // Force focus on the first button (NO/abort-cancel is safer default)
                if (typeof active[0].focus === 'function') {
                    active[0].focus();
                }
            }
        });
    });
}

function showRenamePromptDialog(defaultName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('rename-prompt-modal');
        const input = document.getElementById('rename-input');
        const confirmBtn = document.getElementById('rename-confirm');
        const cancelBtn = document.getElementById('rename-cancel');

        if (!modal || !input || !confirmBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        input.value = defaultName || '';
        modal.style.display = 'block';

        // Reset gamepad navigation for this modal
        GameContext.menuSelectionIndex = 0;
        gpState.lastMenuElements = null;

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('keydown', onEnter);
            modal.style.display = 'none';
        };

        const onConfirm = () => {
            const newName = input.value.trim();
            cleanup();
            resolve(newName || null);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };

        const onEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('keydown', onEnter);

        // Set up gamepad navigation - only the buttons, not the input
        const setupGamepadNav = () => {
            // Create a custom elements array for gamepad navigation (buttons only)
            const navElements = [confirmBtn, cancelBtn];
            gpState.lastMenuElements = navElements;

            // Store the input reference so it doesn't get blurred
            const inputElement = input;

            // Override updateMenuVisuals for this modal to not blur the input
            const originalUpdateMenuVisuals = window.updateMenuVisuals;
            window.updateMenuVisuals = function (elements) {
                elements.forEach((el, idx) => {
                    if (idx === GameContext.menuSelectionIndex) {
                        el.classList.add('selected');
                        if (typeof el.focus === 'function') {
                            el.focus();
                        }
                    } else {
                        el.classList.remove('selected');
                        // Don't blur the input field
                        if (el !== inputElement && typeof el.blur === 'function') {
                            el.blur();
                        }
                    }
                });
            };

            // Restore original function on cleanup
            const originalCleanup = cleanup;
            const newCleanup = () => {
                window.updateMenuVisuals = originalUpdateMenuVisuals;
                originalCleanup();
            };

            // Replace cleanup references
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.addEventListener('click', () => {
                const newName = input.value.trim();
                newCleanup();
                resolve(newName || null);
            });
            cancelBtn.addEventListener('click', () => {
                newCleanup();
                resolve(null);
            });
        };

        // Wait one frame to ensure DOM has updated, then setup
        requestAnimationFrame(() => {
            setMenuDebounce(Date.now() + 300);
            input.focus();
            input.select();
            setupGamepadNav();
            const active = [confirmBtn, cancelBtn];
            updateMenuVisuals(active);
        });
    });
}

function formatPlayTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function updateStartScreenDisplay() {
    const el = document.getElementById('current-profile-display');
    if (el) {
        el.innerText = GameContext.currentProfileName ? `Current: ${GameContext.currentProfileName}` : 'Current: None';
    }
}

function updateProfileSelectionVisuals() {
    document.querySelectorAll('.profile-item').forEach(el => {
        if (el.dataset.name === selectedProfileName) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

function selectProfile(name) {
    // Reset stats when switching profiles to prevent carryover
    resetProfileStats();

    selectProfileRecord(name);

    // Reload meta profile for the selected profile
    GameContext.metaProfile = { purchases: {}, bank: 0 };
    loadMetaProfileSystem();

    updateStartScreenDisplay();
    showOverlayMessage(`SELECTED: ${name}`, '#ff0', 1200);
}

function resetProfileStats() {
    GameContext.totalKills = 0;
    GameContext.highScore = 0;
    GameContext.totalPlayTimeMs = 0;
}

function createNewProfile() {
    const newName = createNewProfileRecord();
    if (!newName) {
        showOverlayMessage("PROFILE CREATE FAILED", '#f00', 1500);
        return;
    }

    selectProfileRecord(newName);
    GameContext.metaProfile = { purchases: {}, bank: 0 };
    loadMetaProfileSystem();
    updateStartScreenDisplay();
    showSaveMenu();
    showOverlayMessage(`CREATED: ${newName}`, '#0f0', 1200);
}

async function renameSelectedProfile() {
    if (!selectedProfileName) {
        showOverlayMessage("NO PROFILE SELECTED", '#f00', 1200);
        return;
    }

    // Close the profile menu first so the rename dialog appears on top
    const menu = document.getElementById('save-menu');
    if (menu) menu.style.display = 'none';

    const oldName = selectedProfileName;
    const newName = await showRenamePromptDialog(oldName);

    // Re-open the profile menu after dialog closes
    showSaveMenu();

    if (!newName || newName === oldName) return;

    // Check if name already exists
    const existingProfiles = listSaveSlotsSystem();
    if (existingProfiles.includes(newName)) {
        showOverlayMessage("PROFILE NAME EXISTS", '#f00', 1500);
        return;
    }

    try {
        // Load profile data
        const profileData = localStorage.getItem(SAVE_PREFIX + oldName);
        const metaData = localStorage.getItem(`meta_profile_v1_${oldName}`);

        // Save under new name
        if (profileData) localStorage.setItem(SAVE_PREFIX + newName, profileData);
        if (metaData) localStorage.setItem(`meta_profile_v1_${newName}`, metaData);

        // Delete old profile
        localStorage.removeItem(SAVE_PREFIX + oldName);
        localStorage.removeItem(`meta_profile_v1_${oldName}`);

        // Update references
        if (GameContext.currentProfileName === oldName) {
            GameContext.currentProfileName = newName;
            localStorage.setItem(SAVE_LAST_KEY, newName);
        }
        if (selectedProfileName === oldName) {
            selectedProfileName = newName;
        }

        showSaveMenu();
        showOverlayMessage(`RENAMED TO: ${newName}`, '#0f0', 1200);
    } catch (e) {
        showOverlayMessage("RENAME FAILED", '#f00', 1500);
    }
}

async function deleteSelectedProfile() {
    if (!selectedProfileName) {
        showOverlayMessage("NO PROFILE SELECTED", '#f00', 1200);
        return;
    }

    // Close the profile menu first so the confirmation dialog appears on top
    const menu = document.getElementById('save-menu');
    if (menu) menu.style.display = 'none';

    const confirmed = await showAbortConfirmDialog();
    if (!confirmed) {
        // If cancelled, re-open the profile menu
        showSaveMenu();
        return;
    }

    deleteProfileRecord(selectedProfileName);
        if (success) {
            updateStartScreenDisplay();
            updateMetaUI();
            if (showOverlayMessage) showOverlayMessage(`DELETED ${nameToDelete}`, '#f00', 1500);
        }

    selectedProfileName = GameContext.currentProfileName;
    showSaveMenu();
    showOverlayMessage("PROFILE DELETED", '#ff0', 1200);
}

function showSaveMenu() {
    const menu = document.getElementById('save-menu');
    const listEl = document.getElementById('profile-list');

    const profiles = getProfileListSystem();
    listEl.innerHTML = '';

    // Auto-select a profile: current profile if it exists and is valid, otherwise first profile
    if (profiles.length > 0) {
        const currentProfileExists = GameContext.currentProfileName && profiles.some(p => p.name === GameContext.currentProfileName);
        selectedProfileName = currentProfileExists ? GameContext.currentProfileName : profiles[0].name;
    } else {
        selectedProfileName = null;
    }

    if (profiles.length === 0) {
        listEl.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No profiles found</div>';
    } else {
        profiles.forEach(p => {
            const date = new Date(p.timestamp);
            const timeStr = date.toLocaleString();
            const playTime = formatPlayTime(p.totalPlayTimeMs);

            const div = document.createElement('div');
            div.className = 'profile-item';
            div.dataset.name = p.name;
            div.innerHTML = `
                <div class="profile-item-name">${p.name}</div>
                <div class="profile-item-detail">Level ${p.level} • XP: ${p.xp}/${p.nextXp}</div>
                <div class="profile-item-detail">HP: ${p.hp}/${p.maxHp} • Kills: ${p.totalKills}</div>
                <div class="profile-item-detail">Sector ${p.sectorIndex} • Score: ${p.score}</div>
                <div class="profile-item-detail">High Score: ${p.highScore}</div>
                <div class="profile-item-detail">Play Time: ${playTime}</div>
                <div class="profile-item-last-saved">Last saved: ${timeStr}</div>
            `;
            div.addEventListener('click', () => {
                selectedProfileName = p.name;
                updateProfileSelectionVisuals();
            });
            listEl.appendChild(div);
        });
    }

    document.getElementById('create-new-profile').onclick = () => createNewProfile();
    document.getElementById('rename-profile').onclick = () => renameSelectedProfile();
    document.getElementById('delete-profile').onclick = () => deleteSelectedProfile();
    document.getElementById('select-profile').onclick = () => {
        if (selectedProfileName) {
            selectProfile(selectedProfileName);
            menu.style.display = 'none';
        } else {
            showOverlayMessage("NO PROFILE SELECTED", '#f00', 1200);
        }
    };
    document.getElementById('close-save-menu').onclick = () => {
        menu.style.display = 'none';
        updateStartScreenDisplay();
    };

    menu.style.display = 'block';
    updateProfileSelectionVisuals();

    GameContext.menuSelectionIndex = 0;
    gpState.lastMenuElements = null;

    // Wait one frame to ensure DOM has updated, then setup gamepad navigation
    requestAnimationFrame(() => {
        setMenuDebounce(Date.now() + 300);
        const active = getActiveMenuElements();
        if (active.length > 0) {
            updateMenuVisuals(active);
            // Force focus on the first element
            if (typeof active[0].focus === 'function') {
                active[0].focus();
            }
        }
    });
}

function autoSaveToCurrentProfile() {
    if (!GameContext.currentProfileName) return;
    saveGameSystem(GameContext.currentProfileName, true);
}

function wipeProfiles() {
    // Remove all stored profiles and meta progression
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(SAVE_PREFIX) || k.startsWith('meta_profile_v1_'))) {
            toDelete.push(k);
        }
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(SAVE_LAST_KEY);
    localStorage.removeItem('meta_profile_v1');
    resetMetaProfileSystem();
    GameContext.rerollTokens = 0;
    GameContext.currentProfileName = null;
    updateMetaUI();
    updateStartScreenDisplay();
    showOverlayMessage("PROFILE RESET - STARTING FRESH", '#0f0', 2000);
}



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
    getPlayerHullExternalReady: () => playerHullExternalReady,
    getSlackerHullExternalReady: () => slackerHullExternalReady
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

// --- Settings Menu Logic ---

const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsApplyBtn = document.getElementById('settings-apply-btn');
const resSelect = document.getElementById('res-select');
const fullscreenCheck = document.getElementById('fullscreen-check');
const vsyncCheck = document.getElementById('vsync-check');
const framelessCheck = document.getElementById('frameless-check');

// Only enable if running in Electron environment with exposed API
const isElectron = window.SpacebrosApp && window.SpacebrosApp.settings;

// Populate resolution selector with supported resolutions
async function populateResolutionSelector() {
    if (!isElectron || !resSelect) return;

    try {
        const resolutions = await window.SpacebrosApp.settings.getSupportedResolutions();
        if (!resolutions || !Array.isArray(resolutions)) {
            // Fallback to default resolution if API fails
            addResolutionOption(1920, 1080, true);
            return;
        }

        // Clear existing options
        resSelect.innerHTML = '';

        // Add each resolution as an option
        resolutions.forEach(res => {
            const isDefault = res.width === 1920 && res.height === 1080;
            addResolutionOption(res.width, res.height, isDefault);
        });
    } catch (e) {
        console.error("Failed to populate resolutions:", e);
        // Fallback to default resolution
        resSelect.innerHTML = '';
        addResolutionOption(1920, 1080, true);
    }
}

function addResolutionOption(width, height, isDefault = false) {
    const option = document.createElement('option');
    option.value = `${width}x${height}`;

    // Generate label with common name
    let label = `${width} x ${height}`;
    if (width === 1280 && height === 720) label += ' (HD)';
    else if (width === 1600 && height === 900) label += ' (HD+)';
    else if (width === 1920 && height === 1080) label += ' (Full HD)';
    else if (width === 2560 && height === 1440) label += ' (QHD)';
    else if (width === 3840 && height === 2160) label += ' (4K UHD)';
    else label += ' (Native)';

    option.textContent = label;
    resSelect.appendChild(option);

    // Set as default if specified
    if (isDefault) {
        resSelect.value = option.value;
    }
}

// Populate selector on initialization
populateResolutionSelector();

if (settingsBtn) {
    if (!isElectron) {
        settingsBtn.style.display = 'none';
    } else {
        settingsBtn.addEventListener('click', async () => {
            openSettingsMenu();
        });
    }
}

// Make settings menu accessible from pause menu
const pauseSettingsBtn = document.getElementById('pause-settings-btn');
if (pauseSettingsBtn) {
    pauseSettingsBtn.addEventListener('click', openSettingsMenu);
}

async function openSettingsMenu() {
    const current = await window.SpacebrosApp.settings.get();
    if (current) {
        // Populate UI
        fullscreenCheck.checked = !!current.fullscreen;

        // Resolution select is now always enabled (applies in both windowed and fullscreen)
        resSelect.disabled = false;

        // Use internalResolution if available, otherwise fall back to width/height
        const internalRes = current.internalResolution || { width: current.width || 1920, height: current.height || 1080 };
        const resString = `${internalRes.width}x${internalRes.height}`;

        // Check if the current resolution exists in the list
        const optionExists = [...resSelect.options].some(o => o.value === resString);
        if (optionExists) {
            resSelect.value = resString;
        } else {
            // If the saved resolution is not in the list (e.g., after monitor change),
            // add it as a custom option and select it
            const customOption = document.createElement('option');
            customOption.value = resString;
            customOption.textContent = `${internalRes.width} x ${internalRes.height} (Custom)`;
            resSelect.appendChild(customOption);
            resSelect.value = resString;
        }

        framelessCheck.checked = !!current.frameless;
        // vsync defaults to true if not set
        vsyncCheck.checked = current.vsync !== false;
    }

    // Set volume sliders to current values
    const musicVolumeSlider = document.getElementById('music-volume');
    const sfxVolumeSlider = document.getElementById('sfx-volume');
    const musicVolumeLabel = document.getElementById('music-volume-label');
    const sfxVolumeLabel = document.getElementById('sfx-volume-label');

    if (musicVolumeSlider && musicVolumeLabel) {
        musicVolumeSlider.value = Math.round(musicVolume * 100);
        musicVolumeLabel.textContent = `${musicVolumeSlider.value}%`;
    }
    if (sfxVolumeSlider && sfxVolumeLabel) {
        sfxVolumeSlider.value = Math.round(sfxVolume * 100);
        sfxVolumeLabel.textContent = `${sfxVolumeSlider.value}%`;
    }

    settingsMenu.style.display = 'block';

    // Disable pointer-events on pause menu when settings is open to prevent click-through
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu && GameContext.gamePaused) {
        pauseMenu.style.pointerEvents = 'none';
    }
}

// Volume slider handlers
const musicVolumeSlider = document.getElementById('music-volume');
const sfxVolumeSlider = document.getElementById('sfx-volume');
const musicVolumeLabel = document.getElementById('music-volume-label');
const sfxVolumeLabel = document.getElementById('sfx-volume-label');

if (musicVolumeSlider) {
    musicVolumeSlider.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        setMusicVolume(value);
        musicVolumeLabel.textContent = `${e.target.value}%`;
    });
}

if (sfxVolumeSlider) {
    sfxVolumeSlider.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        setSfxVolume(value);
        sfxVolumeLabel.textContent = `${e.target.value}%`;
    });
}

if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
        settingsMenu.style.display = 'none';
        // If we were paused when opening settings, return to pause menu
        if (GameContext.gamePaused) {
            const pauseMenu = document.getElementById('pause-menu');
            pauseMenu.style.display = 'block';
            pauseMenu.style.pointerEvents = 'auto';
        }
    });
}

if (settingsApplyBtn && isElectron) {
    settingsApplyBtn.addEventListener('click', async () => {
        const isFullscreen = fullscreenCheck.checked;
        const isVsync = vsyncCheck.checked;
        const isFrameless = framelessCheck.checked;
        const [w, h] = resSelect.value.split('x').map(Number);

        // Get old settings to compare for restart requirement
        const old = await window.SpacebrosApp.settings.get();
        const framelessChanged = old.frameless !== isFrameless;
        const vsyncChanged = old.vsync !== isVsync;
        const oldRes = old.internalResolution || { width: old.width || 1920, height: old.height || 1080 };
        const resolutionChanged = oldRes.width !== w || oldRes.height !== h;

        // Save everything with internalResolution
        await window.SpacebrosApp.settings.save({
            width: w,          // Keep for backwards compatibility
            height: h,         // Keep for backwards compatibility
            internalResolution: { width: w, height: h },
            fullscreen: isFullscreen,
            vsync: isVsync,
            frameless: isFrameless
        });

        // Apply fullscreen changes
        window.SpacebrosApp.settings.setFullscreen(isFullscreen);

        // Apply window size if not fullscreen (for windowed mode convenience)
        if (!isFullscreen) {
            window.SpacebrosApp.settings.setResolution(w, h);
        }

        // CRITICAL: Apply internal resolution change (works in both windowed and fullscreen)
        if (resolutionChanged) {
            setupCanvasResolution(w, h);
            // Reinitialize background sprites
            initStars(width, height);
        }

        // Handle restart if frameless or vsync changed
        if (framelessChanged || vsyncChanged) {
            if (confirm("Changing vsync or window frame style requires a restart. Restart now?")) {
                window.SpacebrosApp.settings.relaunch();
            }
        } else {
            showOverlayMessage("SETTINGS SAVED", '#0f0', 1500);
            settingsMenu.style.display = 'none';
            if (GameContext.gamePaused) {
                const pauseMenu = document.getElementById('pause-menu');
                pauseMenu.style.display = 'block';
                pauseMenu.style.pointerEvents = 'auto';
            }
        }
    });
}

// Resolution select is now always enabled - no need to disable on fullscreen
// The old handler that disabled resSelect in fullscreen has been removed

// Desktop Quit Support
const qStart = document.getElementById('desktop-quit-start-btn');
const qPause = document.getElementById('desktop-quit-pause-btn');

if (qStart) {
    qStart.addEventListener('click', () => window.SpacebrosApp.settings.quit());
}
if (qPause) {
    qPause.addEventListener('click', () => {
        if (confirm("Quit to desktop? Game and upgrades will be auto-saved.")) {
            window.SpacebrosApp.settings.quit();
        }
    });
}

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

// Initialize profile system BEFORE loading meta profile
GameContext.currentProfileName = localStorage.getItem(SAVE_LAST_KEY) || null;

let autoCreated = false;
if (!GameContext.currentProfileName) {
    const existing = listSaveSlotsSystem();
    if (existing.length === 0) {
        console.log('[PROFILE] Auto-creating default profile');
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

            // Use selectProfile to activate it properly (loads meta, updates UI)
            selectProfile(newName);
            autoCreated = true;
        } catch (e) {
            console.warn('[PROFILE] Auto-create failed', e);
        }
    }
}

if (!autoCreated) {
    loadMetaProfileSystem();
}
updateMetaUI();
updateStartScreenDisplay();

// Save on app close (beforeunload event)
window.addEventListener('beforeunload', () => {
    if (GameContext.currentProfileName) {
        try {
            autoSaveToCurrentProfile(); // Saves game state
            saveMetaProfileSystem();          // Saves meta shop upgrades
        } catch (e) {
            // Silent fail on beforeunload - console won't be visible anyway
        }
    }
});

// Electron-specific save handler (more reliable than beforeunload)
if (window.SpacebrosApp && window.SpacebrosApp.ipcRenderer) {
    window.SpacebrosApp.ipcRenderer.on('app-before-quit', () => {
        console.log('[SAVE] App quit detected, saving profiles...');
        if (GameContext.currentProfileName) {
            try {
                autoSaveToCurrentProfile(); // Saves game state
                console.log('[SAVE] Game profile saved');
                saveMetaProfileSystem();          // Saves meta shop upgrades
                console.log('[SAVE] Meta profile saved');
            } catch (e) {
                console.warn('[SAVE] Save on quit failed:', e);
            }
        } else {
            console.log('[SAVE] No profile, skipping save');
        }
    });
}

startMainLoop();
