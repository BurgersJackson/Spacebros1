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
    PLAYER_SHIELD_RADIUS_SCALE, UPGRADE_DATA
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
    showOverlayMessage,
    updateHealthUI as updateHealthUIHelper,
    updateTurboUI as updateTurboUIHelper,
    updateWarpUI as updateWarpUIHelper,
    updateXpUI as updateXpUIHelper
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
    registerMetaShopNavigationHandlers,
    resetMetaProfile as resetMetaProfileSystem,
    saveMetaProfile as saveMetaProfileSystem,
    setReturningFromModal as setReturningFromModalSystem,
    updateMetaUI as updateMetaUISystem
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
    applyUpgrade as applyUpgradeSystem,
    registerUpgradeHandlers,
    showLevelUpMenu as showLevelUpMenuSystem
} from './systems/upgrade-manager.js';
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
    registerAnomalyZoneDependencies
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
const minimapCtx = (() => {
    try { return minimapCanvas.getContext('2d', { desynchronized: true, alpha: false }); }
    catch (e) { return minimapCanvas.getContext('2d'); }
})();
if (ctx) ctx.imageSmoothingEnabled = false;
if (uiCtx) uiCtx.imageSmoothingEnabled = false;
if (minimapCtx) minimapCtx.imageSmoothingEnabled = false;

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
    aspectRatio = internalW / internalH;

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
let roamerLoaded = false;
let eliteRoamerLoaded = false;
let hunterLoaded = false;
let defenderLoaded = false;

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
    roamerLoaded = true;
    applyEnemyTexture(roamerImage, 'enemy_roamer');
});
eliteRoamerImage.addEventListener('load', () => {
    eliteRoamerLoaded = true;
    applyEnemyTexture(eliteRoamerImage, 'enemy_elite_roamer');
});
hunterImage.addEventListener('load', () => {
    hunterLoaded = true;
    applyEnemyTexture(hunterImage, 'enemy_hunter');
});
defenderImage.addEventListener('load', () => {
    defenderLoaded = true;
    applyEnemyTexture(defenderImage, 'enemy_defender');
});
roamerImage.addEventListener('error', () => { roamerLoaded = false; });
eliteRoamerImage.addEventListener('error', () => { eliteRoamerLoaded = false; });
hunterImage.addEventListener('error', () => { hunterLoaded = false; });
defenderImage.addEventListener('error', () => { defenderLoaded = false; });

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
let asteroidIndestructibleTextureReady = false;

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

        asteroidIndestructibleTextureReady = true;
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
const PLAYER_HULL_RENDER_SCALE = 2.5;
const PLAYER_HULL_ROT_OFFSET = Math.PI / 2; // world angle 0=right, art is nose-up
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
const EXPLOSION1_COLS = 4;
const EXPLOSION1_ROWS = 5;
const EXPLOSION1_FRAMES = EXPLOSION1_COLS * EXPLOSION1_ROWS;
const EXPLOSION1_FRAME_W = 1024 / EXPLOSION1_COLS;
const EXPLOSION1_FRAME_H = 1024 / EXPLOSION1_ROWS;
let explosion1Ready = false;
explosion1Image.addEventListener('load', () => { explosion1Ready = true; });
explosion1Image.addEventListener('error', () => { explosion1Ready = false; });


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

function releasePixiEnemySprite(spr) {
    if (!spr) return;
    const key = spr._pixiKey;
    const pool = (key && pixiEnemySpritePools && pixiEnemySpritePools[key]) ? pixiEnemySpritePools[key] : null;
    if (pool) releasePixiSprite(pool, spr);
    else releasePixiSprite(null, spr);
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
let fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let fpsSmoothMs = 16.7;
let fpsNextUiAt = 0;
let fpsUiVisible = null;
let posUiNextAt = 0;

// Fixed-timestep simulation (decouple simulation from render FPS)
// SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME imported from ./core/constants.js
let simAccMs = 0;
let simNowMs = 0;
let simLastPerfAt = 0;
const getGameNowMs = () => (typeof simNowMs === 'number' && simNowMs > 0) ? simNowMs : Date.now();
let renderAlpha = 1.0; // Global render interpolation alpha (0-1)
let shakeOffsetX = 0;
let shakeOffsetY = 0;
let suppressWarpGateUntil = 0;
let suppressWarpInputUntil = 0;

let width, height;
// Internal resolution (absolute - game renders at this fixed resolution)
let internalWidth = 1920;
let internalHeight = 1080;
let aspectRatio = internalWidth / internalHeight;

let animationId;
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

// Mouse movement direction for Slacker ship arrow
let mouseMovementDir = { x: 0, y: 0 };  // Normalized direction vector
let mouseLastPos = { x: 0, y: 0 };      // Previous mouse position
// Smoothed direction for Slacker line
let smoothedDir = { x: 0, y: 0 };       // Smoothed direction vector

// Gamepad State
const gpState = GameContext.gpState;
let menuDebounce = 0;

function updateInputMode(now = Date.now()) {
    const preferGamepadMs = 1200;
    const mouseGraceMs = 220; // Allow mouse to take over if it moves significantly

    // Strict priority: if aiming with stick (fresh input < 100ms), ignore mouse jitter entirely
    const strictGamepad = (now - GameContext.lastGamepadInputAt) < 100;

    if (strictGamepad) {
        GameContext.usingGamepad = true;
    } else {
        const gamepadRecent = (now - GameContext.lastGamepadInputAt) < preferGamepadMs;
        const mouseRecent = (now - GameContext.lastMouseInputAt) < mouseGraceMs;
        GameContext.usingGamepad = gamepadRecent && !mouseRecent;
    }

    // Hide cursor for gamepad OR Slacker ship mouse mode
    // But show cursor when menus are open (pause, levelup, etc.) or game is not active
    const levelupScreen = document.getElementById('levelup-screen');
    const isMenuOpen = GameContext.gamePaused || !GameContext.gameActive || (levelupScreen && levelupScreen.style.display === 'flex');

    if ((GameContext.usingGamepad || (GameContext.player && GameContext.player.shipType === 'slacker')) && !isMenuOpen) {
        document.body.classList.add('no-cursor');
    } else {
        document.body.classList.remove('no-cursor');
    }
}

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

function spawnSectorPOIs() {
    if (!GameContext.player) return;
    const constructors = [DerelictShipPOI, DebrisFieldPOI];

    const placed = [];
    for (let i = 0; i < constructors.length; i++) {
        let placedOne = false;
        for (let attempts = 0; attempts < 40; attempts++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1900 + Math.random() * 2600;
            const x = GameContext.player.pos.x + Math.cos(angle) * dist;
            const y = GameContext.player.pos.y + Math.sin(angle) * dist;
            let ok = true;
            for (const p of placed) {
                if (Math.hypot(x - p.x, y - p.y) < 1400) { ok = false; break; }
            }
            if (!ok) continue;
            placed.push({ x, y });
            const C = constructors[i];
            const poi = new C(x, y);
            GameContext.pois.push(poi);
            placedOne = true;
            break;
        }
        if (!placedOne) {
            // fallback: skip
        }
    }
}

function spawnExplorationCaches() {
    if (!GameContext.player) return;
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1200 + Math.random() * 2000;
        const cx = GameContext.player.pos.x + Math.cos(angle) * dist;
        const cy = GameContext.player.pos.y + Math.sin(angle) * dist;
        GameContext.caches.push(new ExplorationCache(cx, cy));
    }
}

function spawnOneAsteroidRelative(initial = false) {
    if (!GameContext.player) return;
    let attempts = 0;
    while (attempts < 50) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const minDist = initial ? 500 : 2000;
        const maxDist = initial ? 3000 : 4000;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const x = GameContext.player.pos.x + Math.cos(angle) * dist;
        const y = GameContext.player.pos.y + Math.sin(angle) * dist;
        const r = 50 + Math.random() * 150;

        let safe = true;
        // Prevent spawning inside firewall in cave mode
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.fireWall) {
            const firewallY = GameContext.caveLevel.fireWall.y;
            // Don't spawn if asteroid would be below the firewall line
            if (y > firewallY) {
                safe = false;
            }
        }
        for (let b of GameContext.pinwheels) {
            if (Math.hypot(x - b.pos.x, y - b.pos.y) < b.shieldRadius + r + 200) safe = false;
        }

        if (safe) {
            // Spawn indestructible asteroids from level 1, 1 for every 20 regular asteroids
            const isIndestructible = Math.random() < 0.20; // 20% indestructible chance
            const sizeLevel = isIndestructible ? 1 : 3; // Small size for indestructible (reduced by 1)
            // Adjust radius for small indestructible asteroids
            const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
            const asteroid = new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible);
            GameContext.environmentAsteroids.push(asteroid);
            break;
        }
    }
}

function spawnOneWarpAsteroidRelative(initial = false) {
    if (!GameContext.player || !GameContext.warpZone || !GameContext.warpZone.active) return false;
    let attempts = 0;
    while (attempts < 60) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const minDist = initial ? 600 : 2000;
        const maxDist = initial ? 5200 : 5600;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const x = GameContext.player.pos.x + Math.cos(angle) * dist;
        const y = GameContext.player.pos.y + Math.sin(angle) * dist;

        const dxC = x - GameContext.warpZone.pos.x;
        const dyC = y - GameContext.warpZone.pos.y;
        const dC = Math.hypot(dxC, dyC);
        const boundary = (GameContext.warpZone.boundaryRadius || 6200) - 220;
        if (dC > boundary) continue;

        // Size mix: include big rocks like the normal space area.
        const roll = Math.random();
        let r;
        if (roll < 0.14) r = 170 + Math.random() * 60; // large 170..230
        else if (roll < 0.46) r = 110 + Math.random() * 70; // medium 110..180
        else r = 50 + Math.random() * 80; // small 50..130

        // Keep within boundary with its own radius.
        if (dC + r > (GameContext.warpZone.boundaryRadius || 6200) - 40) continue;

        // Don't spawn directly on top of the player.
        if (Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y) < r + GameContext.player.radius + 240) continue;

        // Spawn indestructible asteroids from level 1, 1 for every 20 regular asteroids
        const isIndestructible = Math.random() < 0.05; // 1/20 = 0.05
        const sizeLevel = isIndestructible ? 1 : 3; // Small size for indestructible (reduced by 1)
        // Adjust radius for small indestructible asteroids
        const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
        GameContext.environmentAsteroids.push(new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible));
        return true;
    }
    return false;
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

class Spaceship extends Entity {
    constructor(shipType = 'standard') {
        super(0, 0);
        this.shipType = shipType; // 'standard' or 'slacker'
        this.radius = 30;
        this.angle = -Math.PI / 2;
        this.turretAngle = -Math.PI / 2;
        this.baseThrust = 0.60; // quadrupled (0.15 * 4) for 60Hz
        this.baseMaxSpeed = 13.8; // 15% increase (12.0 * 1.15 = 13.8)

        // Progression
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 100;
        this.inventory = {}; // Track upgrade tiers

        // Stats
        this.stats = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            shotgunFireRateMult: 1.0,
            rangeMult: 1.0,
            multiShot: 1,
            homing: 0, // 0=none, 1=weak, 2=strong
            shieldRegenRate: 8, // seconds per segment
            hpRegenAmount: 1, // HP per tick
            hpRegenRate: 10, // seconds per tick
            speedMult: 1.0,
            // accelMult and rotMult removed
            slowField: 0, // Radius
            slowFieldDuration: 0
        };

        this.magnetRadius = 150;

        this.thrustPower = this.baseThrust;
        this.rotationSpeed = 0.12; // doubled for 60Hz
        this.friction = 0.98; // 0.99^2 for 60Hz logic to stay same real-time speed
        this.maxSpeed = this.baseMaxSpeed; // Correctly uses 12.0 now

        this.invulnerable = 90; // halved for 60Hz
        this.visible = true;
        this.maxHp = 25;  // starting health hp
        this.hp = this.maxHp;

        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.lastHpRegenTime = Date.now();

        this.shieldRadius = 45 * PLAYER_SHIELD_RADIUS_SCALE;
        this.maxShieldSegments = 8;
        this.shieldSegments = new Array(8).fill(2);
        this.shieldRotation = 0;
        this.shieldsDirty = true;
        this._pixiInnerShieldGfx = null;
        this._pixiOuterShieldGfx = null;

        // Optional outer shield ring (separate from the main shield)
        this.outerShieldRadius = this.shieldRadius + (26 * PLAYER_SHIELD_RADIUS_SCALE);
        this.maxOuterShieldSegments = 0;
        this.outerShieldSegments = [];
        this.outerShieldRotation = 0;

        this.baseFireDelay = 12;
        this.fireDelay = 12;
        this.autofireTimer = 0;
        this.baseShotgunDelay = 30;  // shotgun fire rate (lower = faster)
        this.shotgunDelay = this.baseShotgunDelay;
        this.shotgunTimer = 0;
        this.turretLevel = 1;

        // NEW: Forward laser for Slacker Special (fires independently)
        this.forwardLaserDelay = 20; // Fire rate between shots
        this.forwardLaserTimer = 0;

        this.staticWeapons = []; // Array of objects {type: 'forward'|'side'|'rear'}

        this.canWarp = false;
        this.warpCooldown = 0;
        this.maxWarpCooldown = 180;

        // Special CDs
        this.nukeUnlocked = false;
        this.nukeCooldown = 0;
        this.nukeMaxCooldown = 600; // Default 10s
        this.nukeDamage = 5;
        this.nukeRange = 500;

        // Global Defense Ring
        this.defenseRingTier = 0;
        this.defenseOrbs = [];
        this.defenseOrbAngle = 0;
        this.defenseOrbRadius = 500;
        this.defenseOrbDamage = 5;
        this.defenseOrbSpeed = (Math.PI * 2) / 360; // 1 rotation per 6 seconds (360 frames @ 60fps)

        this.slowField = 0; // 0 or radius

        this.missileTimer = 0;

        // Invincibility Phase Shield
        this.invincibilityCycle = {
            unlocked: false,
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 0, cooldown: 0, regen: false }
        };

        // Turbo boost (activated by E / gamepad X)
        this.turboBoost = {
            // Stock ship has a small turbo (upgrades extend duration).
            unlocked: true,
            activeFrames: 0,
            cooldownFrames: 0,
            lastCooldownFrames: 0,
            durationFrames: 60, // 1.0s
            cooldownTotalFrames: 600, // fixed 10s cooldown
            speedMult: 1.25, // +25% speed
            buttonHeld: false
        };

        // Battery Ability
        this.batteryUnlocked = false;
        this.batteryCharge = 0; // 0-100
        this.batteryMaxCharge = 100;
        // Charge rate: 100 units over 60 seconds, independent of framerate
        // deltaTime is in ms, dtScale = deltaTime / 16.67
        // chargeRate is the amount to add per Reference Frame (16.67ms)
        this.batteryChargeRate = (100 / 60000) * 16.67;
        this.batteryDamage = 500;
        this.batteryRange = 800;
        this.batteryDischarging = false;

        // Volley Shot Ability
        this.volleyShotUnlocked = false;
        this.volleyShotCount = 0;        // Number of shots in volley (3/5/7 based on tier)
        this.volleyCooldown = 0;        // Timer until next auto-fire (180 frames = 3 seconds)
        this.lastF = false;             // Track F key state transitions (for Battery)

        // CIWS (Close-In Weapon System)
        this.ciwsUnlocked = false;
        this.ciwsDamage = 1;            // Damage per bullet (1-5 based on tier)
        this.ciwsRange = 400;            // Target acquisition range
        this.ciwsCooldown = 0;          // Frames until next shot (6 = 2x player fire rate)
        this.ciwsMaxCooldown = 6;        // Fire rate: every 6 frames at 60fps

        // Homing Missiles - track sources separately for stacking
        this.stats.homingFromUpgrade = 0;   // Tier from in-game upgrade (0-5)
        this.stats.homingFromMeta = 0;      // Tier from meta shop (0-3)
    }

    respawn() {
        this.pos.x = 0;
        this.pos.y = 0;
        if (this.prevPos) { this.prevPos.x = 0; this.prevPos.y = 0; }
        this.vel.x = 0;
        this.vel.y = 0;
        this.angle = -Math.PI / 2;
        this.invulnerable = 90; // halved for 60Hz
        this.dead = false;
        this.visible = true;
        this.hp = this.maxHp;
        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.shieldSegments = new Array(this.maxShieldSegments).fill(2);
        this.shieldsDirty = true;
        this.outerShieldSegments = (this.maxOuterShieldSegments > 0) ? new Array(this.maxOuterShieldSegments).fill(1) : [];
        this.warpCooldown = 0;
        this.nukeCooldown = 0;
        this.defenseOrbAngle = 0;
        this.invincibilityCycle.state = 'ready';
        this.invincibilityCycle.timer = 0;
        this.turboBoost.activeFrames = 0;
        this.turboBoost.cooldownFrames = 0;
        this.turboBoost.lastCooldownFrames = 0;
        this.turboBoost.buttonHeld = false;
        this.shotgunTimer = 0;
        updateHealthUI();
        updateWarpUI();
        updateXpUI();
    }

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
        updateXpUI();
    }

    levelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);

        // Pause and Show Menu
        playSound('levelup');
        GameContext.gameActive = false; // Soft pause logic required
        showLevelUpMenuSystem();
    }

    takeHit(damage, ignoreShields = false) {
        if (this.dead || this.invulnerable > 0) return;

        let remaining = Math.max(0, Math.ceil(damage));

        if (!ignoreShields) {
            // Apply damage to outer shields first
            if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                for (let i = 0; i < this.outerShieldSegments.length && remaining > 0; i++) {
                    if (this.outerShieldSegments[i] > 0) {
                        this.outerShieldSegments[i] = 0;
                        remaining -= 1;
                        this.shieldsDirty = true;
                    }
                }
            }

            // Apply damage to main inner shields
            if (this.shieldSegments && this.shieldSegments.length > 0) {
                for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
                    const absorb = Math.min(remaining, this.shieldSegments[i]);
                    this.shieldSegments[i] -= absorb;
                    remaining -= absorb;
                    this.shieldsDirty = true;
                }
            }
        }

        // Hull damage only happens when shields cannot absorb the full hit.
        if (remaining > 0) {
            this.hp -= remaining;
            spawnParticles(this.pos.x, this.pos.y, 14, '#f00');
            playSound('hit');
            updateHealthUI();

            // Screen shake (global variables)
            if (typeof GameContext.shakeMagnitude !== 'undefined') GameContext.shakeMagnitude = 10;
            if (typeof GameContext.shakeTimer !== 'undefined') GameContext.shakeTimer = 10;

            if (this.hp <= 0) {
                killPlayer();
            } else {
                this.invulnerable = 5;
            }
        } else {
            // Shield absorbed all damage
            playSound('shield_hit');
            spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
            this.invulnerable = 5;
        }
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        const dtScale = deltaTime / 16.67;

        this.shieldRotation += 0.02 * dtScale;
        if (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0)) {
            this.outerShieldRotation -= 0.026 * dtScale;
        }

        // Turbo boost timers + activation (E / gamepad X / right mouse button)
        if (this.turboBoost && this.turboBoost.unlocked) {
            if (this.turboBoost.activeFrames > 0) this.turboBoost.activeFrames -= dtScale;

            // Track if cooldown just expired this frame
            const wasOnCooldown = this.turboBoost.lastCooldownFrames > 0;
            const nowOnCooldown = this.turboBoost.cooldownFrames > 0;
            const cooldownJustExpired = wasOnCooldown && !nowOnCooldown;
            this.turboBoost.lastCooldownFrames = this.turboBoost.cooldownFrames;
            if (this.turboBoost.cooldownFrames > 0) this.turboBoost.cooldownFrames -= dtScale;

            // Check if turbo button is pressed
            const turboPressed = (keys.e || gpState.turbo || mouseState.rightDown);

            // Trigger on press (not press -> press transition)
            if (turboPressed && !this.turboBoost.buttonHeld) {
                if (this.turboBoost.activeFrames <= 0 && this.turboBoost.cooldownFrames <= 0) {
                    this.turboBoost.activeFrames = this.turboBoost.durationFrames;
                    this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
                    playSound('powerup');
                }
            }
            // Re-trigger if button is still held and cooldown just expired
            else if (turboPressed && cooldownJustExpired) {
                if (this.turboBoost.activeFrames <= 0) {
                    this.turboBoost.activeFrames = this.turboBoost.durationFrames;
                    this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
                    playSound('powerup');
                }
            }

            this.turboBoost.buttonHeld = turboPressed;
            updateTurboUI();
        }

        let moveX = gpState.move.x;
        let moveY = gpState.move.y;

        if (!GameContext.usingGamepad) {
            if (keys.w) moveY -= 1;
            if (keys.s) moveY += 1;
            if (keys.a) moveX -= 1;
            if (keys.d) moveX += 1;
        }

        // NEW: Slacker ship mouse movement
        if (this.shipType === 'slacker' && !GameContext.usingGamepad) {
            // Calculate direction from screen center to mouse cursor (Virtual Joystick)
            const screenCenterX = width / 2;
            const screenCenterY = height / 2;

            // Vector from center of screen to mouse pointer
            const rawDx = mouseScreen.x - screenCenterX;
            const rawDy = mouseScreen.y - screenCenterY;
            const distSq = rawDx * rawDx + rawDy * rawDy;

            // Rotation mode: if left mouse button is held, stop movement
            // and only rotate to face mouse cursor
            const isRotationMode = mouseState.leftDown;

            if (!isRotationMode) {
                // Deadzone of 50 pixels from center
                if (distSq > 50 * 50) {
                    const dist = Math.sqrt(distSq);
                    const mouseMoveX = rawDx / dist;
                    const mouseMoveY = rawDy / dist;

                    // Add to existing keyboard input (allows combining mouse + keyboard)
                    moveX += mouseMoveX;
                    moveY += mouseMoveY;
                }

                // Clamp to prevent overshoot when combining inputs
                moveX = Math.max(-1, Math.min(1, moveX));
                moveY = Math.max(-1, Math.min(1, moveY));
            }
            // In rotation mode, only rotate toward mouse (don't add to movement)
        }

        const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
        let thrusting = false;

        const aimMag = Math.sqrt(gpState.aim.x * gpState.aim.x + gpState.aim.y * gpState.aim.y);
        const aimThresh = 0.08;
        const moveAimThresh = 0.08;
        if (this.shipType === 'slacker') {
            // SLACKER SPECIAL: Auto-target nearest enemy (prioritizes bosses)
            const target = this.findAutoTurretTarget();
            if (target) {
                // Aim at the target, but slightly toward its front based on facing angle
                let targetX = target.pos.x;
                let targetY = target.pos.y;

                // Add lead offset based on target's facing direction
                if (target.angle !== undefined) {
                    const leadOffset = 80; // Aim 80 units ahead of target
                    targetX += Math.cos(target.angle) * leadOffset;
                    targetY += Math.sin(target.angle) * leadOffset;
                }

                this.turretAngle = Math.atan2(targetY - this.pos.y, targetX - this.pos.x);
            }
            // If no target, keep last turretAngle (don't reset)
        } else {
            // STANDARD: Manual turret control (existing behavior)
            if (GameContext.usingGamepad) {
                // In gamepad mode, never snap aim back to mouse when sticks go idle.
                if (aimMag > aimThresh) {
                    this.turretAngle = Math.atan2(gpState.aim.y, gpState.aim.x);
                } else if (moveMag > moveAimThresh) {
                    this.turretAngle = Math.atan2(moveY, moveX);
                }
            } else {
                this.turretAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
            }
        }

        // Removed acceleration stat multiplier, using base or 1.0 implicitly
        const turboMult = (this.turboBoost && this.turboBoost.activeFrames > 0) ? (this.turboBoost.speedMult || 1.5) : 1.0;
        const currentThrust = this.thrustPower * turboMult * dtScale; // Scale thrust by time
        if (this.caveSlowFrames === undefined) this.caveSlowFrames = 0;
        if (this.caveSlowMult === undefined) this.caveSlowMult = 1.0;
        if (this.caveSlowFrames > 0) this.caveSlowFrames -= dtScale;
        const slowMult = (this.caveSlowFrames > 0) ? Math.max(0.4, Math.min(1.0, this.caveSlowMult || 0.62)) : 1.0;
        const currentMaxSpeed = this.maxSpeed * this.stats.speedMult * turboMult * slowMult;

        if (moveMag > 0.06) {
            const targetAngle = Math.atan2(moveY, moveX);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
            }
            // Use normalized components for thrust calculation
            const normMoveX = moveX / moveMag;
            const normMoveY = moveY / moveMag;
            const finalMag = Math.min(1.0, moveMag);

            this.vel.x += normMoveX * (currentThrust * finalMag);
            this.vel.y += normMoveY * (currentThrust * finalMag);
            thrusting = true;
        }

        // Slacker ship always rotates toward mouse (when not using gamepad)
        if (this.shipType === 'slacker' && !GameContext.usingGamepad) {
            const targetAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
            }
        }

        this.fireDelay = this.baseFireDelay / this.stats.fireRateMult;
        this.shotgunDelay = this.baseShotgunDelay / this.stats.shotgunFireRateMult;

        this.autofireTimer -= dtScale;
        this.shotgunTimer -= dtScale;
        if (this.autofireTimer <= 0) {
            this.shoot();
            this.autofireTimer = Math.max(4, this.fireDelay);
        }
        if (this.shotgunTimer <= 0) {
            this.shootShotgun();
            this.shotgunTimer = Math.max(4, this.shotgunDelay);
        }

        // NEW: Slacker Special forward laser (fires independently)
        if (this.shipType === 'slacker') {
            this.forwardLaserTimer -= dtScale;
            if (this.forwardLaserTimer <= 0) {
                this.fireForwardLaser();
                this.forwardLaserTimer = Math.max(4, this.forwardLaserDelay);
            }
        }

        // Shield Regen
        if (this.stats.shieldRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastShieldRegenTime > this.stats.shieldRegenRate * 1000) {
                // Regen prioritizes main (inner) shield; once full, it repairs outer shield (if owned).
                const innerIdx = this.shieldSegments.findIndex(s => s < 2);
                if (innerIdx !== -1) {
                    this.shieldSegments[innerIdx] = 2;
                    this.shieldsDirty = true;
                    playSound('powerup'); // Soft sound
                } else if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                    const outerIdx = this.outerShieldSegments.findIndex(s => s <= 0);
                    if (outerIdx !== -1) {
                        this.outerShieldSegments[outerIdx] = 1;
                        this.shieldsDirty = true;
                        playSound('powerup'); // Soft sound
                    }
                }
                this.lastShieldRegenTime = now;
            }
        }

        // Hull HP Regen
        if (this.stats.hpRegenAmount > 0 && this.stats.hpRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastHpRegenTime > this.stats.hpRegenRate * 1000) {
                if (this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegenAmount);
                    updateHealthUI();
                    spawnParticles(this.pos.x, this.pos.y, 4, '#0f0');
                }
                this.lastHpRegenTime = now;
            }
        }

        // Auto-Cycling Invincibility Phase Shield
        if (this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtScale;

            if (this.invincibilityCycle.state === 'ready') {
                // Start active phase immediately if ready
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
                // showOverlayMessage("PHASE SHIELD ACTIVE", '#ff0', 1000);
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2; // Sustain invulnerability each frame
                // Tier 3 Regen - check every ~1 second (SIM_FPS frames at 60fps reference)
                if (this.invincibilityCycle.stats.regen && Math.floor(this.invincibilityCycle.timer / SIM_FPS) !== Math.floor((this.invincibilityCycle.timer + dtScale) / SIM_FPS)) {
                    const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
                    if (emptyIdx !== -1) {
                        this.shieldSegments[emptyIdx] = 2;
                    }
                }

                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'cooldown';
                    this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
                }
            } else if (this.invincibilityCycle.state === 'cooldown') {
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'ready';
                }
            }
        }



        // Homing Missiles (Separate System)
        if (this.stats.homing > 0) {
            this.missileTimer -= dtScale;
            if (this.missileTimer <= 0) {
                this.fireMissiles();
                this.missileTimer = 30 / this.stats.fireRateMult;
            }
        }

        // Global Defense Ring
        if (this.defenseRingTier > 0) {
            this.defenseOrbAngle += this.defenseOrbSpeed * dtScale;
            const orbs = this.defenseOrbs;
            const now = Date.now();

            for (let i = 0; i < orbs.length; i++) {
                const orb = orbs[i];
                const angle = this.defenseOrbAngle + orb.angleOffset;
                const ox = this.pos.x + Math.cos(angle) * this.defenseOrbRadius;
                const oy = this.pos.y + Math.sin(angle) * this.defenseOrbRadius;

                // Collision targets via Spatial Hash for performance
                // targetGrid includes: enemies, pinwheels, bosses, turrets
                const queryRadius = 150;
                const targets = [
                    ...GameContext.targetGrid.query(ox, oy, queryRadius),
                    ...GameContext.asteroidGrid.query(ox, oy, queryRadius),
                    ...GameContext.guidedMissiles,
                    ...GameContext.bossBombs
                ];

                for (const target of targets) {
                    if (target.dead) continue;
                    if (target.unbreakable) continue; // Skip indestructible objects

                    // Check cooldown
                    const lastHit = orb.hitCooldowns.get(target);
                    if (lastHit && now - lastHit < 500) continue; // 0.5s cooldown per orb per target

                    const distSq = (ox - target.pos.x) ** 2 + (oy - target.pos.y) ** 2;
                    const hitDist = (25 + target.radius); // Orb radius approx 25

                    if (distSq < hitDist * hitDist) {
                        // HIT!
                        orb.hitCooldowns.set(target, now);
                        spawnParticles(target.pos.x, target.pos.y, 5, '#f80'); // Fire particles

                        if (typeof target.break === 'function') {
                            target.break();
                        } else if (typeof target.hp === 'number') {
                            target.hp -= this.defenseOrbDamage;
                            if (target.hp <= 0) {
                                if (typeof target.kill === 'function') target.kill();
                                else if (typeof target.explode === 'function') target.explode();
                                else target.dead = true;
                            }
                        }
                    }
                }
            }
        }

        // Auto Nuke Trigger
        if (this.nukeCooldown > 0) this.nukeCooldown -= dtScale;
        if (this.nukeUnlocked && this.nukeCooldown <= 0) {
            this.fireNuke();
        }

        // Volley Shot Auto-Fire (every 3 seconds = 180 frames at 60fps)
        if (this.volleyShotUnlocked) {
            if (this.volleyCooldown > 0) {
                this.volleyCooldown -= dtScale;
            } else {
                // Fire the volley!
                this.fireVolleyShot();
                this.volleyCooldown = 180; // 3 seconds at 60fps
            }
        }

        // CIWS Auto-Fire (rapid-fire defense system)
        if (this.ciwsUnlocked) {
            if (this.ciwsCooldown > 0) {
                this.ciwsCooldown -= dtScale;
            } else {
                // Find target (missiles first, then nearest enemy)
                const target = this.findCIWSTarget();
                if (target) {
                    this.fireCIWS(target);
                    this.ciwsCooldown = this.ciwsMaxCooldown;
                }
            }
        }

        if (this.canWarp) {
            if (this.warpCooldown > 0) {
                this.warpCooldown -= dtScale;
                updateWarpUI();
            } else if (keys.shift || gpState.warp) {
                if (!suppressWarpInputUntil || getGameNowMs() >= suppressWarpInputUntil) {
                    this.warp();
                }
            }
        }

        // Shield Recharge (meta upgrade)
        if (this.stats.shieldRechargeRate > 0 && this.shieldSegments && this.shieldSegments.length > 0) {
            const now = Date.now();
            const rechargeInterval = this.stats.shieldRechargeRate * 1000;
            if (now - (this.lastShieldRegenTime || 0) >= rechargeInterval) {
                const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
                if (emptyIdx !== -1) {
                    this.shieldSegments[emptyIdx] = 2;
                    this.shieldsDirty = true;
                    spawnParticles(this.pos.x, this.pos.y, 4, '#0ff');
                }
                this.lastShieldRegenTime = now;
            }
        }

        // Second Wind timer update
        if (this.stats.secondWindActive > 0) {
            this.stats.secondWindActive -= dtScale;
            if (this.stats.secondWindActive <= 0) {
                this.stats.secondWindActive = 0;
            }
        }

        // Combo Meter decay (resets after 5 seconds of no hits)
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const now = Date.now();
            if (now - (this.lastHitTime || 0) > 5000) {
                this.comboStacks = 0;
            }
        }

        // Battery charging logic
        if (this.batteryUnlocked && !this.batteryDischarging) {
            this.batteryCharge = Math.min(this.batteryMaxCharge, this.batteryCharge + this.batteryChargeRate * dtScale);
        }

        // F key / Battery button handling (Battery discharge)
        const fPressed = keys.f || gpState.battery || mouseState.middleDown;
        const batteryReady = this.batteryUnlocked && this.batteryCharge >= this.batteryMaxCharge;

        // Track F key state transitions
        if (fPressed && !this.lastF) {
            // F key just pressed (keydown)
            if (batteryReady) {
                // Battery discharge immediately
                this.dischargeBattery();
                // Reset input to prevent continuous battery discharge
                keys.f = false;
                gpState.battery = false;
            }
        }
        this.lastF = fPressed;

        // Update battery UI
        if (this.batteryUnlocked) {
            const batteryUi = document.getElementById('battery-ui');
            const batteryText = document.getElementById('battery-text');
            const batteryFill = document.getElementById('battery-fill');
            if (batteryUi) batteryUi.style.display = 'flex';
            const chargePercent = Math.floor(this.batteryCharge);
            if (batteryText) batteryText.textContent = `${chargePercent}%`;
            if (batteryFill) {
                batteryFill.style.width = `${chargePercent}%`;
                batteryFill.style.background = this.batteryCharge >= 100 ? '#fff' : '#0ff';
            }
        }

        // Update volley cooldown UI
        if (this.volleyShotUnlocked) {
            const volleyUi = document.getElementById('volley-ui');
            const volleyText = document.getElementById('volley-text');
            const volleyFill = document.getElementById('volley-fill');

            if (volleyUi) volleyUi.style.display = 'flex';

            // Calculate remaining seconds (180 frames = 3 seconds at 60fps)
            const cooldownSeconds = Math.ceil(this.volleyCooldown / 60);
            if (volleyText) volleyText.textContent = cooldownSeconds > 0 ? `${cooldownSeconds}s` : 'READY';

            // Bar fill: empty when just fired, full when ready
            const fillPercent = ((180 - this.volleyCooldown) / 180) * 100;
            if (volleyFill) {
                volleyFill.style.width = `${fillPercent}%`;
                // White when ready, yellow when charging
                volleyFill.style.background = this.volleyCooldown <= 0 ? '#fff' : '#ff0';
            }
        }

        if (this.hp <= 3 && Math.random() < 0.1 * dtScale) {
            spawnSmoke(this.pos.x, this.pos.y, 1);
        }

        const speed = this.vel.mag();
        if (speed > currentMaxSpeed) this.vel.mult(currentMaxSpeed / speed);

        if (thrusting) {
            const bx = this.pos.x - Math.cos(this.angle) * 35;
            const bx2 = this.pos.y - Math.sin(this.angle) * 35;
            if (Math.random() > 0.5) spawnParticles(bx, bx2, 1, '#0aa');
        }

        // Time-scaled friction
        // friction^dtScale
        // NEW: Slacker rotation mode - apply stronger braking when left mouse button held
        const rotationModeBrake = (this.shipType === 'slacker' && !GameContext.usingGamepad && mouseState.leftDown) ? 0.85 : 1.0;
        this.vel.mult(Math.pow(this.friction * rotationModeBrake, dtScale));

        super.update(deltaTime);
        checkWallCollision(this, 0.0);

        if (this.invulnerable > 0) {
            this.invulnerable -= dtScale;
            if (this.invincibilityCycle.state === 'active') {
                this.visible = true;
            } else {
                this.visible = true;
            }
        } else {
            this.visible = true;
        }
    }

    fireNuke() {
        GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.nukeDamage, this.nukeRange, {
            damageAsteroids: true,
            damageMissiles: true,
            damageBases: true,
            followPlayer: true
        }));
        this.nukeCooldown = this.nukeMaxCooldown;
        //    showOverlayMessage("NUKE DEPLOYED", '#ff0', 1000);
    }

    warp() {
        spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        playSound('warp');
        const angle = Math.random() * Math.PI * 2;
        const dist = 3000 + Math.random() * 2000;
        this.pos.x += Math.cos(angle) * dist;
        this.pos.y += Math.sin(angle) * dist;
        this.vel.x = 0;
        this.vel.y = 0;
        spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        this.warpCooldown = this.maxWarpCooldown;
        updateWarpUI();
    }

    dischargeBattery() {
        if (!this.batteryUnlocked || this.batteryCharge < 100 || this.batteryDischarging) return;

        this.batteryDischarging = true;
        this.batteryCharge = 0;

        // Primary blast
        GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.batteryDamage, this.batteryRange, {
            damageAsteroids: true,
            damageMissiles: true,
            color: '#0ff',
            travelSpeed: 15,
            followPlayer: true
        }));

        // Secondary ring effect (delayed)
        setTimeout(() => {
            if (!this.dead) {
                GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.batteryDamage * 0.3, this.batteryRange * 1.2, {
                    damageAsteroids: true,
                    damageMissiles: true,
                    color: '#08f',
                    travelSpeed: 10,
                    followPlayer: true
                }));
            }
        }, 200);

        showOverlayMessage("BATTERY DISCHARGED!", '#0ff', 1000);

        setTimeout(() => {
            this.batteryDischarging = false;
        }, 500);
    }

    fireMissiles() {
        const hasUpgrade = this.stats.homingFromUpgrade > 0;
        const hasMeta = this.stats.homingFromMeta > 0;
        const bothOwned = hasUpgrade && hasMeta;

        const upgradeDamage = this.stats.homingFromUpgrade || 1;
        const metaDamage = this.stats.homingFromMeta || 1;

        // Fire 2 missiles normally, or 4 if both upgrades owned
        const missilePairs = bothOwned ? 2 : 1;

        for (let pair = 0; pair < missilePairs; pair++) {
            // Each pair fires 2 missiles
            const count = 2;
            // Determine damage for this pair
            const damage = (pair === 0) ? upgradeDamage : metaDamage;

            for (let i = 0; i < count; i++) {
                const angleOffset = (i - (count - 1) / 2) * 0.3;
                // Add slight spread between pairs if firing 4 missiles
                const pairSpread = bothOwned ? 0.15 : 0;
                const spreadOffset = (pair - 0.5) * pairSpread;
                const angle = this.turretAngle + angleOffset + spreadOffset + (Math.random() - 0.5) * 0.2;
                const b = new Bullet(this.pos.x, this.pos.y, angle, false, damage, 12, 3, '#f80', 2);
                b.ignoreShields = false;
                b.isMissile = true;
                GameContext.bullets.push(b);
                spawnSmoke(this.pos.x, this.pos.y, 1);
            }
        }
    }

    fireVolleyShot() {
        const shots = this.volleyShotCount || 3;
        const spread = 0.15; // Slight spread between shots

        for (let i = 0; i < shots; i++) {
            // Stagger the angle for spread effect
            const angleOffset = (i - (shots - 1) / 2) * spread;
            const angle = this.turretAngle + angleOffset;

            // Use player's damage multiplier
            let damage = 2 * this.stats.damageMult;

            // Combo Meter bonus to damage
            if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
                const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
                damage *= comboBonus;
            }

            const b = new Bullet(this.pos.x, this.pos.y, angle, false, damage, 14, 4, '#ff0');

            // Slight damage reduction for volley (balance)
            b.damage *= 0.7;

            GameContext.bullets.push(b);
        }

        // Visual feedback
        spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
        playSound('rapid_shoot');
    }

    findCIWSTarget() {
        let nearestTarget = null;
        let minDist = Infinity;
        const range = this.ciwsRange;

        // Check all enemy bullets (including missiles, pinwheels, etc.)
        for (let b of GameContext.bullets) {
            if (b.isEnemy && !b.dead) {
                const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = b;
                }
            }
        }

        // Check guided missiles array (destroyer missiles)
        if (typeof GameContext.guidedMissiles !== 'undefined') {
            for (let m of GameContext.guidedMissiles) {
                if (!m.dead) {
                    const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                    if (dist <= range && dist < minDist) {
                        minDist = dist;
                        nearestTarget = m;
                    }
                }
            }
        }

        // Also check enemies array
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (dist <= range && dist < minDist) {
                minDist = dist;
                nearestTarget = e;
            }
        }

        return nearestTarget;
    }

    // Auto-targeting for Slacker Special ship - prioritizes boss ships
    findAutoTurretTarget() {
        let nearestTarget = null;
        let minDist = Infinity;
        const range = 2000; // Same as main turret range with rangeMult

        // First priority: Boss ships (Cruiser or Destroyer)
        // Check global boss variable (Cruiser)
        if (GameContext.boss && !GameContext.boss.dead) {
            const dist = Math.hypot(GameContext.boss.pos.x - this.pos.x, GameContext.boss.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.boss; // Always target boss if in range
            }
        }

        // Check global destroyer variable (Destroyer boss)
        if (typeof GameContext.destroyer !== 'undefined' && GameContext.destroyer && !GameContext.destroyer.dead) {
            const dist = Math.hypot(GameContext.destroyer.pos.x - this.pos.x, GameContext.destroyer.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.destroyer; // Always target destroyer if in range
            }
        }

        // Check space station (high priority target)
        if (typeof GameContext.spaceStation !== 'undefined' && GameContext.spaceStation && !GameContext.spaceStation.dead) {
            const dist = Math.hypot(GameContext.spaceStation.pos.x - this.pos.x, GameContext.spaceStation.pos.y - this.pos.y);
            if (dist <= range) {
                return GameContext.spaceStation; // Always target space station if in range
            }
        }

        // Check enemies for boss types (Cruiser, Destroyer, Destroyer2)
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            if (e.constructor.name === 'Cruiser' || e.constructor.name === 'Destroyer' ||
                e.constructor.name === 'Destroyer2') {
                const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = e;
                }
            }
        }

        // If no boss found, fall back to nearest enemy of any type
        if (!nearestTarget) {
            for (let e of GameContext.enemies) {
                if (e.dead) continue;
                const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = e;
                }
            }
        }

        // Check pinwheels array
        if (typeof GameContext.pinwheels !== 'undefined') {
            for (let p of GameContext.pinwheels) {
                if (p.dead) continue;
                const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = p;
                }
            }
        }

        // Check guided missiles array (destroyer missiles)
        if (typeof GameContext.guidedMissiles !== 'undefined') {
            for (let m of GameContext.guidedMissiles) {
                if (m.dead) continue;
                const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                if (dist <= range && dist < minDist) {
                    minDist = dist;
                    nearestTarget = m;
                }
            }
        }

        return nearestTarget;
    }

    fireCIWS(target) {
        const angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
        const bulletSpeed = 18; // Same as player turret
        const damage = this.ciwsDamage;
        // White bullets for visibility (#fff, 3px)
        GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, angle, false, damage, bulletSpeed, 3, '#fff'));
    }

    shoot() {
        let damage = 2 * this.stats.damageMult; //turret damage

        // Combo Meter bonus to damage
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
            damage *= comboBonus;
        }

        const bulletSpeed = 15;
        const shots = this.stats.multiShot;

        // DEBUG: Validation
        if (GameContext.bullets.length > 500) console.warn('[WARN] Bullet count high:', GameContext.bullets.length);

        // Calculate firing vectors for parallel multi-shot
        const aimX = Math.cos(this.turretAngle);
        const aimY = Math.sin(this.turretAngle);
        const perpX = -aimY; // Right vector
        const perpY = aimX;
        const spacing = 12; // Gap between projectiles

        for (let i = 0; i < shots; i++) {
            // Parallel offset logic
            const offset = (i - (shots - 1) / 2) * spacing;

            const bx = this.pos.x + aimX * 25 + perpX * offset;
            const by = this.pos.y + aimY * 25 + perpY * offset;

            GameContext.bullets.push(new Bullet(bx, by, this.turretAngle, false, damage, bulletSpeed, 4, null, 0));
            spawnBarrelSmoke(bx, by, this.turretAngle);

            // Split Shot - chance to fire additional projectile at angle
            if (this.stats.splitShot > 0 && Math.random() < this.stats.splitShot) {
                const splitAngle = this.turretAngle + (Math.random() - 0.5) * 0.5;
                const splitBullet = new Bullet(bx, by, splitAngle, false, damage, bulletSpeed, 4, '#f80', 0);
                splitBullet.isSplitShot = true;
                GameContext.bullets.push(splitBullet);
            }
        }
        // Player shooting SFX (MP3), rate-limited.
        const now = Date.now();
        if (!this._lastShootSfxAt || (now - this._lastShootSfxAt) >= 100) {
            playSound('shoot', 0.5);
            this._lastShootSfxAt = now;
        }

        // Static Weapons
        this.staticWeapons.forEach(w => {
            // Calculate effectiveness penalty
            const weaponEffectiveness = w.effectiveness || 1.0;

            // Calculate same-type penalty (for multiple weapons of the same type)
            const sameTypeCount = this.staticWeapons.filter(sw => sw.type === w.type).length;
            const typePenalty = sameTypeCount > 1 ? 1 - ((sameTypeCount - 1) * 0.2) : 1.0;

            // Combined effectiveness (min 20%)
            const finalEffectiveness = Math.max(0.2, weaponEffectiveness * typePenalty);
            const weaponDamage = damage * finalEffectiveness;

            if (w.type === 'side') {
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI / 2, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle - Math.PI / 2, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'rear') {
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI, false, weaponDamage, bulletSpeed, 4, '#0f0')); // Rear laser
            } else if (w.type === 'dual_rear') {
                // Dual stream to the rear at angles
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI - Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI + Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'dual_front') {
                // Dual stream to the front at angles
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle - Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI / 6, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            } else { // Forward
                GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle, false, weaponDamage, bulletSpeed, 4, '#0f0'));
            }
        });
    }

    shootShotgun() {
        const shotgunTier = this.inventory['shotgun'] || 0;
        if (shotgunTier <= 0) return;

        const count = shotgunTier === 1 ? 5 : (shotgunTier === 2 ? 8 : 12);
        const dmg = this.stats.damageMult * 0.7;
        const spread = 0.5;
        const baseShotgunLife = 23;
        const tierRangeMult = 1 + (0.1 * Math.max(0, shotgunTier - 1));

        for (let i = 0; i < count; i++) {
            const a = this.turretAngle + (Math.random() - 0.5) * spread;
            const s = 12 + (Math.random() - 0.5) * 4;
            const b = new Bullet(this.pos.x, this.pos.y, a, false, dmg, s, 3, '#ff0', 0, 'square');
            b.life = (baseShotgunLife * tierRangeMult) * this.stats.rangeMult;
            GameContext.bullets.push(b);
        }
        spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
    }

    fireForwardLaser() {
        const damage = 2 * this.stats.damageMult;
        // Combo Meter bonus
        if (this.stats.comboMeter > 0 && this.comboStacks > 0) {
            const comboBonus = 1 + (this.comboStacks / this.comboMaxStacks) * this.stats.comboMaxBonus;
            damage *= comboBonus;
        }
        const forwardAngle = this.angle; // Forward in facing direction
        GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, forwardAngle, false, damage, 15, 4, '#0f0'));
    }

    drawLaser(ctx) {
        if (!this.visible || this.dead) {
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            return;
        }

        // Pixi path (dashed aim laser)
        if (pixiVectorLayer && pixiApp && pixiApp.renderer) {
            const startX = this.pos.x + Math.cos(this.turretAngle) * 25;
            const startY = this.pos.y + Math.sin(this.turretAngle) * 25;
            const hit = rayCast(startX, startY, this.turretAngle, 2000 * this.stats.rangeMult);

            let gfx = this._pixiLaserGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(gfx);
                this._pixiLaserGfx = gfx;
            } else if (!gfx.parent) {
                pixiVectorLayer.addChild(gfx);
            }
            gfx.visible = true;
            gfx.clear();

            const dx = hit.x - startX;
            const dy = hit.y - startY;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const ux = dx / dist;
            const uy = dy / dist;
            const dashLen = 10;
            const gapLen = 20;

            gfx.lineStyle(2, 0x88ffff, 0.5);
            for (let t = 0; t < dist; t += (dashLen + gapLen)) {
                const a0 = t;
                const a1 = Math.min(dist, t + dashLen);
                gfx.moveTo(startX + ux * a0, startY + uy * a0);
                gfx.lineTo(startX + ux * a1, startY + uy * a1);
            }
            gfx.endFill();  // Properly close the path to prevent ghosting

            gfx.beginFill(0xaaffff, 0.8);
            gfx.drawCircle(hit.x, hit.y, 4);
            gfx.endFill();
            return;
        }
    }

    draw(ctx, alpha = 1.0) {
        if (!this.visible || this.dead) {
            if (this._pixiContainer) this._pixiContainer.visible = false;
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            if (this._pixiOuterShieldGfx) {
                try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                this._pixiOuterShieldGfx = null;
            }
            if (this._pixiInnerShieldGfx) {
                try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                this._pixiInnerShieldGfx = null;
            }
            if (this.dead) pixiCleanupObject(this);
            return;
        }

        const rPos = (this.getRenderPos && typeof alpha === 'number') ? this.getRenderPos(alpha) : this.pos;

        // Pixi fast path (player hull/turret/shields)
        if (pixiPlayerLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiPlayerLayer.addChild(container);

                const turbo = new PIXI.Sprite(pixiTextures.player_turbo_flame || pixiTextureWhite);
                const tfA = pixiTextureAnchors.player_turbo_flame || { x: 0.5, y: 0.5 };
                turbo.anchor.set((tfA && tfA.x != null) ? tfA.x : 0.5, (tfA && tfA.y != null) ? tfA.y : 0.5);
                turbo.position.set(0, 0);
                turbo.visible = false;
                turbo.alpha = 0.95;
                turbo.blendMode = PIXI.BLEND_MODES.ADD;
                container.addChild(turbo);
                this._pixiTurboFlameSpr = turbo;

                const hullTexture = (this.shipType === 'slacker') ? (pixiTextures.slacker_hull || pixiTextures.player_hull) : pixiTextures.player_hull;
                const hullAnchorKey = (this.shipType === 'slacker' && pixiTextures.slacker_hull) ? 'slacker_hull' : 'player_hull';
                const hull = new PIXI.Sprite(hullTexture);
                const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
                hull.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;

                const thr = new PIXI.Sprite(pixiTextures.player_thruster);
                const tA = pixiTextureAnchors.player_thruster || { x: 0.5, y: 0.5 };
                thr.anchor.set((tA && tA.x != null) ? tA.x : 0.5, (tA && tA.y != null) ? tA.y : 0.5);
                thr.position.set(0, 0);
                thr.visible = false;
                container.addChild(thr);
                this._pixiThrusterSpr = thr;

                const turret = new PIXI.Container();
                turret.position.set(0, 0);
                container.addChild(turret);
                this._pixiTurretContainer = turret;

                const turretBase = new PIXI.Sprite(pixiTextures.player_turret_base);
                const tbA = pixiTextureAnchors.player_turret_base || { x: 0.5, y: 0.5 };
                turretBase.anchor.set((tbA && tbA.x != null) ? tbA.x : 0.5, (tbA && tbA.y != null) ? tbA.y : 0.5);
                turret.addChild(turretBase);
                this._pixiTurretBaseSpr = turretBase;

                this._pixiBarrelSprs = [];
            } else if (!container.parent) {
                pixiPlayerLayer.addChild(container);
            }
            container.visible = true;
            container.position.set(rPos.x, rPos.y);

            // Hull
            if (this._pixiHullSpr) {
                // Keep hull texture synced (important for late-loaded external image).
                const useSlackerHull = (this.shipType === 'slacker') && pixiTextures.slacker_hull;
                this._pixiHullSpr.texture = useSlackerHull ? pixiTextures.slacker_hull : pixiTextures.player_hull;
                const hullAnchorKey = useSlackerHull ? 'slacker_hull' : 'player_hull';
                const hA = pixiTextureAnchors[hullAnchorKey] || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                this._pixiHullSpr.rotation = (this.angle || 0) + (playerHullExternalReady ? PLAYER_HULL_ROT_OFFSET : 0);
                const externalReady = useSlackerHull ? slackerHullExternalReady : playerHullExternalReady;
                if (externalReady) {
                    const tex = useSlackerHull ? pixiTextures.slacker_hull : pixiTextures.player_hull;
                    const denom = Math.max(1, Math.max(tex.width || 1, tex.height || 1));
                    const s = (this.radius * 2 * PLAYER_HULL_RENDER_SCALE) / denom;
                    this._pixiHullSpr.scale.set(s);
                } else {
                    this._pixiHullSpr.scale.set(1);
                }
            }

            // Thruster (simple)
            const thrusting = !!(keys.w || (Math.abs(gpState.move.x) > 0.1 || Math.abs(gpState.move.y) > 0.1));
            const turboActive = !!(this.turboBoost && this.turboBoost.activeFrames > 0);
            if (this._pixiTurboFlameSpr) {
                this._pixiTurboFlameSpr.visible = turboActive;
                if (turboActive) {
                    this._pixiTurboFlameSpr.rotation = this.angle;
                    const t = (typeof GameContext.frameNow === 'number' && GameContext.frameNow > 0) ? GameContext.frameNow : Date.now();
                    const flicker = 0.80 + Math.abs(Math.sin(t * 0.02)) * 0.45;
                    this._pixiTurboFlameSpr.scale.set(flicker);
                }
            }
            if (this._pixiThrusterSpr) {
                this._pixiThrusterSpr.visible = thrusting && !turboActive;
                this._pixiThrusterSpr.rotation = this.angle;
                this._pixiThrusterSpr.alpha = 0.9;
            }

            // Turret + barrels
            const turret = this._pixiTurretContainer;
            if (turret) turret.rotation = this.turretAngle;
            const barrels = this._pixiBarrelSprs || (this._pixiBarrelSprs = []);
            const shots = Math.max(1, Math.floor(this.stats && this.stats.multiShot ? this.stats.multiShot : 1));
            while (barrels.length < shots) {
                const spr = new PIXI.Sprite(pixiTextures.player_barrel);
                const bA = pixiTextureAnchors.player_barrel || { x: 0, y: 0.5 };
                spr.anchor.set((bA && bA.x != null) ? bA.x : 0, (bA && bA.y != null) ? bA.y : 0.5);
                turret.addChild(spr);
                barrels.push(spr);
            }
            const spacing = 12 * 1.2;
            for (let i = 0; i < barrels.length; i++) {
                const spr = barrels[i];
                if (!spr) continue;
                if (i < shots) {
                    spr.visible = true;
                    const offset = (shots >= 2) ? ((i - (shots - 1) / 2) * spacing) : 0;
                    spr.position.set(0, offset);
                } else {
                    spr.visible = false;
                }
            }

            // Shields / slow field / phase ring
            if (pixiVectorLayer) {
                const hasOuter = (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0));
                const hasInner = (this.shieldSegments && this.shieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner || (this.stats && this.stats.slowField > 0) || (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active'));

                if (needs) {
                    // --- STATIC EFFECTS (Phase & Slow Field) ---
                    // Re-drawn every frame as they are simple circles and might pulse/chang size.
                    let gfx = this._pixiGfx;
                    if (!gfx) {
                        gfx = new PIXI.Graphics();
                        pixiVectorLayer.addChild(gfx);
                        this._pixiGfx = gfx;
                    } else if (!gfx.parent) {
                        pixiVectorLayer.addChild(gfx);
                    }
                    gfx.clear();
                    gfx.position.set(rPos.x, rPos.y);

                    if (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active') {
                        const outerR = (hasOuter ? this.outerShieldRadius : 0);
                        const r = Math.max(this.shieldRadius || 0, outerR || 0) + 14;
                        gfx.lineStyle(3, 0xffdc00, 0.6);
                        gfx.drawCircle(0, 0, r);
                    }

                    if (this.stats && this.stats.slowField > 0) {
                        gfx.lineStyle(2, 0x00c8ff, 0.30);
                        gfx.drawCircle(0, 0, this.stats.slowField);
                    }

                    // --- GLOBAL DEFENSE RING ---
                    let defGfx = this._pixiDefenseGfx;
                    if (this.defenseRingTier > 0) {
                        if (!defGfx) {
                            defGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(defGfx);
                            this._pixiDefenseGfx = defGfx;
                        } else if (!defGfx.parent) pixiVectorLayer.addChild(defGfx);

                        defGfx.clear();
                        defGfx.position.set(rPos.x, rPos.y);

                        // Ring Visual (White, 50% opacity)
                        defGfx.lineStyle(2, 0xffffff, 0.5);
                        defGfx.drawCircle(0, 0, this.defenseOrbRadius);

                        const orbs = this.defenseOrbs;
                        for (let i = 0; i < orbs.length; i++) {
                            const angle = this.defenseOrbAngle + orbs[i].angleOffset;
                            const ox = Math.cos(angle) * this.defenseOrbRadius;
                            const oy = Math.sin(angle) * this.defenseOrbRadius;

                            // Orb Core (Hot White/Yellow)
                            defGfx.beginFill(0xffffaa, 1);
                            defGfx.drawCircle(ox, oy, 10);
                            defGfx.endFill();

                            // Inner Fire (Orange)
                            defGfx.beginFill(0xffaa00, 0.8);
                            defGfx.drawCircle(ox, oy, 16);
                            defGfx.endFill();

                            // Outer Glow (Red/Transparent)
                            defGfx.beginFill(0xff4400, 0.3);
                            defGfx.drawCircle(ox, oy, 24);
                            defGfx.endFill();
                        }
                    } else if (defGfx) {
                        try { defGfx.destroy(true); } catch (e) { }
                        this._pixiDefenseGfx = null;
                    }

                    // --- OUTER SHIELD ---
                    let outerGfx = this._pixiOuterShieldGfx;
                    if (hasOuter) {
                        if (!outerGfx) {
                            outerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(outerGfx);
                            this._pixiOuterShieldGfx = outerGfx;
                            this.shieldsDirty = true;
                        } else if (!outerGfx.parent) pixiVectorLayer.addChild(outerGfx);

                        outerGfx.position.set(rPos.x, rPos.y);
                        outerGfx.rotation = this.outerShieldRotation || 0;
                    } else if (outerGfx) {
                        try { outerGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                        outerGfx = null;
                    }

                    // --- INNER SHIELD ---
                    let innerGfx = this._pixiInnerShieldGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerShieldGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(rPos.x, rPos.y);
                        innerGfx.rotation = this.shieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                        innerGfx = null;
                    }

                    // --- GEOMETRY REBUILD ---
                    if (this.shieldsDirty) {
                        if (outerGfx && hasOuter) {
                            outerGfx.clear();
                            const outerCount = this.outerShieldSegments.length;
                            const outerAngle = (Math.PI * 2) / outerCount;
                            outerGfx.lineStyle(4, 0xb000ff, 0.9);
                            for (let i = 0; i < outerCount; i++) {
                                if (this.outerShieldSegments[i] > 0) {
                                    // Draw at base angle 0
                                    const a0 = i * outerAngle + 0.08;
                                    const a1 = (i + 1) * outerAngle - 0.08;
                                    outerGfx.moveTo(Math.cos(a0) * this.outerShieldRadius, Math.sin(a0) * this.outerShieldRadius);
                                    outerGfx.arc(0, 0, this.outerShieldRadius, a0, a1);
                                }
                            }
                        }

                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;

                            // Iterate segments once to group by alpha if needed, or just multiple lineStyles?
                            // PIXI lineStyle applies to subsequent drawing.
                            // To optimize batches, we can draw all full segments then all damaged ones, but simpler is loop.
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const a0 = i * segAngle + 0.1;
                                    const a1 = (i + 1) * segAngle - 0.1;
                                    const alpha = Math.max(0.15, Math.min(1, v / 2));
                                    innerGfx.lineStyle(3, 0x00ffff, alpha);
                                    innerGfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    innerGfx.arc(0, 0, this.shieldRadius, a0, a1);
                                }
                            }
                        }

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiOuterShieldGfx) {
                        try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                    }
                    if (this._pixiInnerShieldGfx) {
                        try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                    }
                }
            }

            return;
        }
    }
}

// AOE damage function that respects shield penetration mechanics
// Damages shield shards hit by the AOE, overflow penetrates to player
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

class Bullet extends Entity {
    constructor(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        super(x, y);
        this._poolType = 'bullet';
        this.sprite = null;
        this.init(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape);
    }
    init(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        this.pos.x = x; this.pos.y = y;
        if (this.prevPos) { this.prevPos.x = x; this.prevPos.y = y; }
        this.speed = speed * 2;
        this.angle = angle;
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = Math.sin(angle) * this.speed;
        this.isEnemy = isEnemy;
        this.damage = damage;
        this.radius = radius;
        this.color = color;
        this.homing = homing;
        this.ignoreShields = false;
        this.isMissile = false;
        this.shape = shape;
        this.dead = false;
        this.sprite = null;
        this.isSplitShot = false;
        this.hasCrit = false;
        if (isEnemy) {
            this.life = 50;
            this.pierceCount = 0;
            this.isExplosive = false;
        } else {
            this.life = 50 * (GameContext.player.stats.rangeMult || 1);
            this.pierceCount = GameContext.player.stats.piercing || 0;
            this.isExplosive = Math.random() < (GameContext.player.stats.explosiveRounds || 0);
        }
    }
    reset(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        return this.init(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape);
    }
    update(deltaTime = SIM_STEP_MS) {
        // Homing Logic
        if (this.homing > 0 && !this.isEnemy) {
            let target = null;
            let minDist = Infinity;
            const acquireRange = 8000;

            const consider = (obj) => {
                if (!obj || obj.dead || !obj.pos) return;
                const d = Math.hypot(obj.pos.x - this.pos.x, obj.pos.y - this.pos.y);
                if (d < minDist && d <= acquireRange) { minDist = d; target = obj; }
            };

            for (let e of GameContext.enemies) consider(e);
            if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) consider(GameContext.boss);
            if (GameContext.pinwheels && GameContext.pinwheels.length > 0) for (let b of GameContext.pinwheels) consider(b);
            if (GameContext.spaceStation && !GameContext.spaceStation.dead) consider(GameContext.spaceStation);
            if (GameContext.destroyer && !GameContext.destroyer.dead) consider(GameContext.destroyer);
            if (GameContext.contractEntities && GameContext.contractEntities.wallTurrets && GameContext.contractEntities.wallTurrets.length > 0) {
                for (let t of GameContext.contractEntities.wallTurrets) consider(t);
            }
            if (GameContext.warpZone && GameContext.warpZone.active && GameContext.warpZone.turrets && GameContext.warpZone.turrets.length > 0) {
                for (let t of GameContext.warpZone.turrets) consider(t);
            }
            if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.wallTurrets && GameContext.caveLevel.wallTurrets.length > 0) {
                for (let t of GameContext.caveLevel.wallTurrets) consider(t);
            }

            if (target) {
                const targetAngle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                const dtFactor = deltaTime / 16.67;
                const turnRate = (this.homing === 2 ? 0.4 : 0.1) * dtFactor;
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);

                this.vel.x = Math.cos(this.angle) * this.speed;
                this.vel.y = Math.sin(this.angle) * this.speed;
            }
        }

        super.update(deltaTime);
        const scale = deltaTime / 16.67;
        this.life -= scale;

        // Bomb explosion when life expires
        if (this.life <= 0) {
            if (this.isBomb && this.explosionRadius > 0) {
                // Create explosion effect
                spawnFieryExplosion(this.pos.x, this.pos.y, 1.5);

                // Create shockwave effect for bio mortars (nuke-style)
                if (this.useShockwave) {
                    GameContext.shockwaves.push(new Shockwave(
                        this.pos.x,
                        this.pos.y,
                        this.explosionDamage || 10,
                        this.explosionRadius || 150,
                        { color: '#f80', damagePlayer: true }
                    ));
                }

                playSound('explode');

                // Damage player if within explosion radius
                if (GameContext.player && !GameContext.player.dead) {
                    const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
                    if (dist < this.explosionRadius) {
                        const dmg = this.explosionDamage || 5;
                        GameContext.player.takeHit(dmg);
                    }
                }
            }
            this.dead = true;
        }
    }
    draw(ctx) {
        if (this.dead) return;

        // Interpolate position for smooth rendering on high refresh displays
        const rPos = this.getRenderPos(renderAlpha);

        // Pixi Rendering
        if (pixiBulletLayer && pixiBulletTextures.glow) {
            let spr = this.sprite;
            let texture = pixiBulletTextures.glow;
            let size = (this.radius || 4) * 2;
            const isLaser = (!this.isEnemy && this.shape !== 'square' && !this.isMissile);

            if (this.isMissile) {
                texture = pixiBulletTextures.missile;
                size = 20; // Fixed size for missile sprite
            } else if (this.shape === 'square') {
                texture = pixiBulletTextures.square;
            } else if (isLaser) {
                texture = pixiBulletTextures.laser;
            }

            if (!spr) {
                // Ensure we have a valid texture before alloc
                if (texture) {
                    spr = allocPixiSprite(pixiBulletSpritePool, pixiBulletLayer, texture, size);
                    this.sprite = spr;
                    this._poolType = 'bullet'; // Tag for cleanup to know which pool to return to
                } else {
                    if (Math.random() < 0.01) console.warn('[BULLET DRAW] No texture selected!', this);
                }
            }
            if (spr) {
                spr.texture = texture;
                if (!spr.parent) pixiBulletLayer.addChild(spr);
                spr.visible = true;
                spr.position.set(rPos.x, rPos.y);
                spr.rotation = this.angle;
                spr.blendMode = PIXI.BLEND_MODES.ADD;

                if (this.isMissile) {
                    spr.width = size;
                    spr.height = size;
                    // Missiles act like they have their own colors usually, but apply tint just in case
                    spr.tint = 0xffffff;
                } else if (isLaser) {
                    spr.width = size * 6;
                    spr.height = size * 3.5;
                    spr.tint = colorToPixi(this.color || (this.isEnemy ? '#f00' : '#ff0'));
                } else {
                    spr.width = size * 4;
                    spr.height = size * 4;
                    spr.tint = colorToPixi(this.color || (this.isEnemy ? '#f00' : '#ff0'));
                }
                spr.alpha = 1;
                return;
            } else {
                if (Math.random() < 0.01) console.error('[BULLET DRAW] Sprite alloc failed or missing!', this);
            }
        }
        // No Canvas fallback intended for final release.
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

class CaveGuidedMissile extends Entity {
    constructor(owner, opts = {}) {
        super(owner && owner.pos ? owner.pos.x : 0, owner && owner.pos ? owner.pos.y : 0);
        this.owner = owner || null;
        this.t = 0;
        this.radius = opts.radius || 18;
        this.hp = opts.hp || 4;
        this.maxHp = this.hp;
        this.maxDamage = (typeof opts.maxDamage === 'number') ? opts.maxDamage : null;
        // Removed multiplier for 60Hz scaling transparency.
        this.speed = (opts.speed || 11.0);
        this.turnRate = opts.turnRate || 0.11;
        this.life = opts.life || 720;
        this.angle = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;

        const off = (owner && owner.radius) ? (owner.radius * 0.85 + 14) : 60;
        this.pos.x += Math.cos(this.angle) * off;
        this.pos.y += Math.sin(this.angle) * off;

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
    }

    explode(color = '#fa0') {
        if (this._exploded) return;
        this._exploded = true;
        this.dead = true;
        playSound('explode');
        spawnFieryExplosion(this.pos.x, this.pos.y, 1.0);
    }

    takeHit(damage) {
        if (this.dead) return;
        const d = Math.max(0, damage || 0);
        this.hp -= d;
        spawnParticles(this.pos.x, this.pos.y, 4, '#ff0');
        playSound('shield_hit');
        if (this.hp <= 0) this.explode('#ff0');
    }

    applyDamageToPlayer(amount) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (GameContext.player.invulnerable > 0) return;

        // Second Wind - check if invulnerability is active
        if (GameContext.player.stats.secondWindActive > 0) {
            // Already in second wind, skip damage
            spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#80f');
            return;
        }

        // Evasion Boost - chance to avoid damage entirely
        if (GameContext.player.stats.evasion > 0 && Math.random() < GameContext.player.stats.evasion) {
            spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#0ff');
            playSound('shield_hit');
            // Reset combo on dodge (optional - can be removed if we want to keep combo on dodge)
            return;
        }

        let remaining = Math.max(0, Math.ceil(amount));

        if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                if (GameContext.player.outerShieldSegments[i] > 0) {
                    const absorb = Math.min(remaining, GameContext.player.outerShieldSegments[i]);
                    GameContext.player.outerShieldSegments[i] -= absorb;
                    remaining -= absorb;
                }
            }
        }

        if (GameContext.player.shieldSegments && GameContext.player.shieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.shieldSegments.length && remaining > 0; i++) {
                const absorb = Math.min(remaining, GameContext.player.shieldSegments[i]);
                GameContext.player.shieldSegments[i] -= absorb;
                remaining -= absorb;
            }
        }

        if (remaining > 0) {
            GameContext.player.hp -= remaining;

            // Thorn Armor - reflect damage back to attacker
            if (GameContext.player.stats.thornArmor > 0 && this.hp) {
                const reflectDamage = Math.ceil(remaining * GameContext.player.stats.thornArmor);
                if (this === GameContext.destroyer || (this.displayName && this.displayName.includes('DESTROYER'))) {
                    const hpBefore = this.hp;
                    this.hp -= reflectDamage;
                    console.log(`[DESTROYER DEBUG] THORN ARMOR REFLECT: ${reflectDamage} damage | HP: ${hpBefore} -> ${this.hp}`);
                } else {
                    this.hp -= reflectDamage;
                }
                spawnParticles(this.pos.x, this.pos.y, 6, '#f80');
                if (this.hp <= 0 && typeof this.kill === 'function') {
                    this.kill();
                }
            }

            // Second Wind - grant invulnerability after taking damage
            if (GameContext.player.stats.secondWindFrames > 0) {
                GameContext.player.stats.secondWindActive = GameContext.player.stats.secondWindFrames;
                spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#80f');
            }

            // Reset combo meter when taking damage
            if (GameContext.player.stats.comboMeter > 0) {
                GameContext.player.comboStacks = 0;
            }
            GameContext.player.lastDamageTakenTime = Date.now();

            spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#f00');
            playSound('hit');
            updateHealthUI();
            if (GameContext.player.hp <= 0) killPlayer();
        } else {
            playSound('shield_hit');
            spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#0ff');
        }
        GameContext.player.invulnerable = 20;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        this.life -= dtFactor;
        if (this.life <= 0) { this.explode(); return; }
        if (!GameContext.player || GameContext.player.dead) { this.explode(); return; }

        const targetAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate * dtFactor);

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        if (Math.floor(this.t) % 2 === 0) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 6,
                this.pos.y + (Math.random() - 0.5) * 6,
                -this.vel.x * 0.08 + (Math.random() - 0.5) * 0.6,
                -this.vel.y * 0.08 + (Math.random() - 0.5) * 0.6,
                '#fa0',
                30
            );
        }

        checkWallCollision(this, 0.12);

        // Collide with asteroids / ships: explode and deal damage (splash) to enemies. 
        const splashDamageEnemies = () => {
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            if (dmg <= 0) return;
            const splashR = 160;
            for (let i = 0; i < GameContext.enemies.length; i++) {
                const e = GameContext.enemies[i];
                if (!e || e.dead) continue;
                const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (d < splashR + (e.radius || 0)) {
                    e.hp -= dmg;
                    spawnParticles(e.pos.x, e.pos.y, 8, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                }
            }
        };

        try {
            const nearby = GameContext.asteroidGrid ? GameContext.asteroidGrid.query(this.pos.x, this.pos.y) : [];
            for (let i = 0; i < nearby.length; i++) {
                const ast = nearby[i];
                if (!ast || ast.dead) continue;
                const d = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (d < (ast.radius || 0) + this.radius) {
                    if (typeof ast.break === 'function') ast.break();
                    this.explode('#fa0');
                    splashDamageEnemies();
                    return;
                }
            }
        } catch (e) { }

        for (let i = 0; i < GameContext.enemies.length; i++) {
            const e = GameContext.enemies[i];
            if (!e || e.dead) continue;
            const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (d < (e.radius || 0) + this.radius) {
                this.explode('#fa0');
                splashDamageEnemies();
                return;
            }
        }

        const dP = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dP < GameContext.player.radius + this.radius) {
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            this.explode('#fa0');
            this.applyDamageToPlayer(dmg);
            GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 8);
            GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 8);
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const z = GameContext.currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#fa0';
        ctx.fillStyle = '#f80';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(-18, 9);
        ctx.lineTo(-26, 0);
        ctx.lineTo(-18, -9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = `rgba(255, 120, 0, ${0.35 + Math.random() * 0.45})`;
        ctx.fillRect(-32, -4, 10, 8);
        ctx.globalAlpha = 1;

        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.save();
        ctx.rotate(-this.angle);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = 'rgba(255,255,0,0.55)';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}

class CaveWallTurret extends Entity {
    constructor(x, y, mode = 'rapid', opts = {}) {
        super(x, y);
        this.mode = mode; // 'rapid' | 'beam' | 'missile' 
        this.armored = !!opts.armored;
        this.armorHp = Math.max(0, opts.armorHp || (this.armored ? 10 : 0));
        this.maxArmorHp = this.armorHp;
        this.weakpointHp = Math.max(0, opts.weakpointHp || (this.armored ? 4 : 0));
        this.maxWeakpointHp = this.weakpointHp;
        this._weakOffset = null;
        this.radius = 66;
        this.hp = 6;
        this.maxHp = 6;
        this.t = 0;
        this.reload = 30 + Math.floor(Math.random() * 25);
        this.trackerCharge = 0;
        this.trackerChargeTotal = 75;
        this.trackerLock = 0;
        this.trackerLockTotal = 50;
        this.trackerBurst = 0;
        this.trackerBurstCd = 0;
        this.trackerAngle = 0;

        this.beamCooldown = 220 + Math.floor(Math.random() * 160);
        this.beamCharge = 0;
        this.beamChargeTotal = 55;
        this.beamFire = 0;
        this.beamFireTotal = 14;
        this.beamAngle = 0;
        this.beamLen = 4200;
        this.beamWidth = 20;
        this.beamHitThisShot = false;
    }

    weakpointPos() {
        if (!GameContext.caveLevel || !GameContext.caveLevel.active) return { x: this.pos.x, y: this.pos.y };
        if (!this._weakOffset) {
            const cx = GameContext.caveLevel.centerXAt(this.pos.y);
            const nx = (this.pos.x < cx) ? -1 : 1;
            this._weakOffset = { x: nx * (this.radius + 16), y: (Math.random() - 0.5) * 10 };
        }
        return { x: this.pos.x + this._weakOffset.x, y: this.pos.y + this._weakOffset.y };
    }

    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (dist > this.radius + b.radius) {
            // Weakpoint can be slightly outside the core radius. 
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                const wp = this.weakpointPos();
                const d2 = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
                if (d2 > 12 + b.radius) return false;
            } else {
                return false;
            }
        }

        if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
            const wp = this.weakpointPos();
            const dWp = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
            if (dWp < 12 + b.radius && this.weakpointHp > 0) {
                this.weakpointHp -= b.damage;
                spawnParticles(wp.x, wp.y, 10, '#0ff');
                playSound('hit');
                if (this.weakpointHp <= 0) {
                    // Cable severed: turret disabled immediately. 
                    this.hp = 0;
                    this.kill();
                }
                return true;
            }

            // Armored shell: heavily reduced damage until armor breaks. 
            if (this.armorHp > 0) {
                this.armorHp -= Math.max(1, Math.ceil(b.damage * 0.6));
                spawnParticles(this.pos.x, this.pos.y, 6, '#88f');
                playSound('hit');
                if (this.armorHp < 0) this.armorHp = 0;
                return true;
            }
        }

        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 6, '#ff8');
        playSound('hit');
        if (this.hp <= 0) this.kill();
        return true;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) awardCoinsInstant(6);
        else for (let i = 0; i < 3; i++) GameContext.coins.push(new Coin(this.pos.x, this.pos.y, 2));
        spawnParticles(this.pos.x, this.pos.y, 18, '#88f');
        playSound('explode');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.caveMode || !GameContext.caveLevel || !GameContext.caveLevel.active) return;
        if (!GameContext.player || GameContext.player.dead) return;

        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        const engageRange = (this.mode === 'rapid') ? (5200 * 1.25) : 5200;
        if (dist > engageRange) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);

        if (this.mode === 'tracker') {
            // Paint -> lock -> burst (fresh gameplay turret). 
            if (this.trackerBurst > 0) {
                this.trackerBurstCd -= dtFactor;
                if (this.trackerBurstCd <= 0) {
                    const leadX = GameContext.player.pos.x + GameContext.player.vel.x * 10;
                    const leadY = GameContext.player.pos.y + GameContext.player.vel.y * 10;
                    const a = Math.atan2(leadY - this.pos.y, leadX - this.pos.x);
                    const muzzleX = this.pos.x + Math.cos(a) * (this.radius + 6);
                    const muzzleY = this.pos.y + Math.sin(a) * (this.radius + 6);
                    GameContext.bullets.push(new Bullet(muzzleX, muzzleY, a, true, 1, 16, 4, '#0ff'));
                    this.trackerBurst--;
                    this.trackerBurstCd = 6;
                    playSound('rapid_shoot');
                }
            } else if (this.trackerLock > 0) {
                this.trackerLock -= dtFactor;
                this.trackerAngle = aim;
                if (this.trackerLock <= 0) { // Changed to <= 0 for safety with float decrement
                    this.trackerBurst = 10;
                    this.trackerBurstCd = 0;
                    spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
                    playSound('heavy_shoot');
                }
            } else {
                this.trackerCharge -= dtFactor;
                if (this.trackerCharge <= 0) {
                    this.trackerLock = this.trackerLockTotal;
                    this.trackerCharge = this.trackerChargeTotal + Math.floor(Math.random() * 40);
                    this.trackerAngle = aim;
                }
            }
            return;
        }

        if (this.mode === 'missile') {
            this.reload -= dtFactor;
            if (this.reload <= 0) {
                GameContext.guidedMissiles.push(new CaveGuidedMissile(this, { hp: 5, maxDamage: 5, radius: 18, speed: 8.2, turnRate: 0.12 }));
                spawnParticles(this.pos.x, this.pos.y, 8, '#fa0');
                playSound('heavy_shoot');
                // Slower missile turret cadence. 
                this.reload = 340 + Math.floor(Math.random() * 140);
            }
            return;
        }

        if (this.mode === 'beam') {
            const applyBeamDamageToPlayer = (amount) => {
                if (!GameContext.player || GameContext.player.dead) return;
                if (GameContext.player.invulnerable > 0) return;
                let remaining = Math.max(0, Math.ceil(amount));
                if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
                    for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                        if (GameContext.player.outerShieldSegments[i] > 0) {
                            GameContext.player.outerShieldSegments[i] = 0;
                            remaining -= 1;
                        }
                    }
                }
                if (GameContext.player.shieldSegments && GameContext.player.shieldSegments.length > 0) {
                    for (let i = 0; i < GameContext.player.shieldSegments.length && remaining > 0; i++) {
                        const absorb = Math.min(remaining, GameContext.player.shieldSegments[i]);
                        GameContext.player.shieldSegments[i] -= absorb;
                        remaining -= absorb;
                    }
                }
                if (remaining > 0) {
                    GameContext.player.hp -= remaining;
                    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#f00');
                    playSound('hit');
                    updateHealthUI();
                    if (GameContext.player.hp <= 0) killPlayer();
                } else {
                    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#ff0');
                    playSound('shield_hit');
                }
                GameContext.player.invulnerable = 20;
            };

            if (this.beamFire > 0) {
                this.beamFire -= dtFactor;
                if (!this.beamHitThisShot) {
                    const ex = this.pos.x + Math.cos(this.beamAngle) * this.beamLen;
                    const ey = this.pos.y + Math.sin(this.beamAngle) * this.beamLen;
                    const cp = closestPointOnSegment(GameContext.player.pos.x, GameContext.player.pos.y, this.pos.x, this.pos.y, ex, ey);
                    const d = Math.hypot(GameContext.player.pos.x - cp.x, GameContext.player.pos.y - cp.y);
                    const hitDist = (this.beamWidth * 0.5) + (GameContext.player.radius * 0.55);
                    if (d <= hitDist) {
                        this.beamHitThisShot = true;
                        applyBeamDamageToPlayer(3);
                        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 8);
                        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 8);
                    }
                }
            } else if (this.beamCharge > 0) {
                this.beamCharge -= dtFactor;
                if (this.beamCharge <= 0) {
                    this.beamFire = this.beamFireTotal;
                    this.beamHitThisShot = false;
                    playSound('heavy_shoot');
                }
            } else {
                this.beamCooldown -= dtFactor;
                if (this.beamCooldown <= 0 && dist > 300) {
                    this.beamAngle = aim;
                    this.beamCharge = this.beamChargeTotal;
                    this.beamFire = 0;
                    this.beamCooldown = 260 + Math.floor(Math.random() * 180);
                    this.beamHitThisShot = false;
                }
            }
            return;
        }

        // Rapid-fire lasers
        this.reload -= dtFactor;
        if (this.reload <= 0) {
            const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
            const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
            GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, true, 1, 14, 4, '#8ff'));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.08, true, 1, 14, 4, '#8ff'));
            if (Math.random() < 0.25) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.08, true, 1, 14, 4, '#8ff'));
            this.reload = 26 + Math.floor(Math.random() * 18);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : 0;

        // Pixi Rendering
        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                // Base Gfx (Staticish)
                const g = new PIXI.Graphics();
                g.name = 'base';
                container.addChild(g);
                this._pixiGfx = g;

                // Overlay Gfx (Beams/Trackers)
                const overlay = new PIXI.Graphics();
                overlay.name = 'overlay';
                container.addChild(overlay);
                this._pixiOverlay = overlay;

                // Label/UI if needed (none for turret)
            }

            container.visible = true; // Managed by caller ideally, but ensure true if called
            container.position.set(this.pos.x, this.pos.y);

            const z = GameContext.currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            const overlay = this._pixiOverlay;

            // Redraw every frame for now due to dynamic rotation/state. 
            // Optimization: Cache base, only rotate gun?
            // For now, full redraw is safer for migration.
            g.clear();
            overlay.clear();

            // Turret Base/Gun
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff, 1);
            // Shadow not maintained in Pixi Gfx easily without filters, skipping shadow for perf
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Gun Barrel
            g.beginFill(0x8888ff);
            g.drRect = { x: this.radius * 0.2, y: -4, w: this.radius * 1.35, h: 8 };
            // Rotate manually for barrel? No, rotate Graphics? 
            // Turret rotates to aim.
            // Base is round, so rotating container is fine.
            container.rotation = aim;

            g.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
            g.endFill();

            // Weakpoint (Armored Cable) - drawn in world space relative to turret? 
            // Weakpoint is calculated by weakpointPos(), usually offset.
            // If I rotate container by `aim`, local (0,0) is center.
            // weakpointPos() logic: nx * (radius+16), y random.
            // That logic is constant in *world* space? No, weakpointPos uses `nx` based on `centerXAt`.
            // The turret base (round) is at `pos`.
            // The weakpoint is at `pos + offset`.
            // The gun rotates `aim`.
            // So if I rotate `container` by `aim`, the *weakpoint* (attached to wall) would rotate too!
            // Incorrect.

            // Correction: Container should NOT rotate. Only the Gun Barrel should rotate.
            container.rotation = 0;

            // Redraw Base (Circle) - No rotation needed.
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Draw Gun Barrel (Rotated)
            const barrX = Math.cos(aim);
            const barrY = Math.sin(aim);
            // Rotated rect points
            // Start at offset *0.2
            // Since we are doing geometry, maybe use a sub-container for gun?
            // Let's use drawing matrix or just trig.
            // Gun rect: x:0.2*r, y:-4, w:1.35*r, h:8.
            // It's easier to add a 'gun' child Container.
            if (!this._pixiGun) {
                const gun = new PIXI.Graphics();
                gun.beginFill(0x8888ff);
                gun.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
                gun.endFill();
                container.addChild(gun);
                this._pixiGun = gun;
            }
            this._pixiGun.rotation = aim;

            // Weakpoint
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                // We draw lines from (0,0) to weakpoint offset
                const wp = this.weakpointPos();
                const lx = wp.x - this.pos.x;
                const ly = wp.y - this.pos.y;

                g.lineStyle(2, 0x00ffff, 0.9);
                g.moveTo(0, 0);
                g.lineTo(lx, ly);

                g.beginFill(0x00ffff);
                g.lineStyle(0);
                g.drawCircle(lx, ly, 6);
                g.endFill();
            }

            // Overlay (Beams, Trackers)
            // Tracker
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                // Dashed line from center to aim
                // LineDash not native in v5 Graphics easily without plugins, simulate dots?
                // Or just solid line with low alpha
                overlay.lineStyle(2, 0x00ffff, 0.35);
                // Draw manual dash?
                const angle = this.trackerAngle;
                const tx = Math.cos(angle) * 2600;
                const ty = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(tx, ty);
            }
            // Beam
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                const bx = Math.cos(angle) * 2600;
                const by = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(bx, by);
            }

            // HP Ring
            const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.drawCircle(0, 0, this.radius + 8);
            // drawCircle is full circle. Canvas was partial arc based on pct.
            // Graphics.arc(cx, cy, radius, startAngle, endAngle)
            overlay.clear();
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                overlay.lineStyle(2, 0x00ffff, 0.35);
                const angle = this.trackerAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);

            return;
        }

        // Canvas Fallback Removed
    }
}

class CaveWallSwitch extends Entity {
    constructor(x, y, doorIds = []) {
        super(x, y);
        this.radius = 18;
        this.hp = 3;
        this.maxHp = 3;
        this.doorIds = Array.isArray(doorIds) ? doorIds : [];
        this.t = 0;
    }
    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (d > this.radius + b.radius) return false;
        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
        playSound('hit');
        if (this.hp <= 0) {
            this.dead = true;
            pixiCleanupObject(this);
            for (let i = 0; i < this.doorIds.length; i++) {
                try { if (GameContext.caveLevel) GameContext.caveLevel.toggleDoor(this.doorIds[i]); } catch (e) { }
            }
            showOverlayMessage("SWITCH ACTIVATED", '#0ff', 900, 1);
            playSound('powerup');
        }
        return true;
    }
    update(deltaTime = SIM_STEP_MS) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('SW', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#000000',
                    align: 'center'
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Halo
            g.beginFill(0x00ffff, 0.25 + pulse);
            g.lineStyle(2, 0x00ffff, 1);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            return;
        }
    }
}

class CavePowerRelay extends Entity {
    constructor(x, y, gateIndex = 0) {
        super(x, y);
        this.gateIndex = gateIndex;
        this.radius = 22;
        this.hp = 8;
        this.maxHp = 8;
        this.t = 0;
    }
    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (d > this.radius + b.radius) return false;
        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 12, '#ff0');
        playSound('hit');
        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.pos.x, this.pos.y, 40, '#ff0');
            playSound('explode');
            try { if (GameContext.caveLevel) GameContext.caveLevel.onRelayDestroyed(this.gateIndex); } catch (e) { }
        }
        return true;
    }
    update(deltaTime = SIM_STEP_MS) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.5 + Math.abs(Math.sin(this.t * 0.03)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Outer Ring
            g.beginFill(0x111111);
            g.lineStyle(2, 0xffff00);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Inner Core
            g.beginFill(0xffff00, 0.5 + pulse * 0.3);
            g.lineStyle(0);
            g.drawCircle(0, 0, 8);
            g.endFill();

            return;
        }
    }
}

class CaveRewardPickup extends Entity {
    constructor(x, y, rewardType = 'coins', value = 0) {
        super(x, y);
        this.rewardType = rewardType;
        this.value = value;
        this.radius = 26;
        this.t = 0;
    }
    update(deltaTime = SIM_STEP_MS) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center'
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.035)) * 0.35;
            const colorVals = {
                'upgrade': 0xff00ff,
                'shield': 0x00ffff,
                'fragment': 0xffff00,
                'nugs': 0xffaa00,
                'coins': 0x00ff00
            };
            const col = colorVals[this.rewardType] || 0x00ff00;
            const labelVals = {
                'upgrade': 'UP',
                'shield': 'SH',
                'fragment': 'KF',
                'nugs': 'NG',
                'coins': '$'
            };

            const g = this._pixiGfx;
            g.clear();

            g.lineStyle(4, 0xffffff, 0.15 + pulse);
            g.drawCircle(0, 0, this.radius);

            const txt = this._pixiText;
            txt.text = labelVals[this.rewardType] || '$';
            txt.style.fill = col;

            return;
        }
    }
}

// Turret attached to an asteroid - follows asteroid position and rotation
class AsteroidTurret extends CaveWallTurret {
    constructor(asteroid, offset, mode, opts) {
        super(asteroid.pos.x + offset.x, asteroid.pos.y + offset.y, mode, opts);
        this.asteroid = asteroid;
        this.offset = offset;
        this.radius = 49; // 25% smaller than 66
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead || !this.asteroid || this.asteroid.dead) {
            this.dead = true;
            return;
        }
        // Follow asteroid position and rotation
        const cos = Math.cos(this.asteroid.angle);
        const sin = Math.sin(this.asteroid.angle);
        this.pos.x = this.asteroid.pos.x + cos * this.offset.x - sin * this.offset.y;
        this.pos.y = this.asteroid.pos.y + sin * this.offset.x + cos * this.offset.y;

        // Call parent update for turret targeting logic
        super.update(deltaTime);
    }
}

class CaveGasVent extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 1260;
        this.t = 0;
        this.state = 'off'; // off | warn | on 
        this.timer = 180 + Math.floor(Math.random() * 120);
        this.damageCd = 0;
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.timer -= dtFactor;
        if (this.timer <= 0) {
            if (this.state === 'off') { this.state = 'warn'; this.timer = 60; }
            else if (this.state === 'warn') { this.state = 'on'; this.timer = 140; }
            else { this.state = 'off'; this.timer = 220 + Math.floor(Math.random() * 160); }
        }
        if (this.damageCd > 0) this.damageCd -= deltaTime / 16.67;
        if (!GameContext.player || GameContext.player.dead) return;
        if (this.state !== 'on') return;
        const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (d > this.radius + GameContext.player.radius) return;
        // Slow the ship and tick damage (forces movement). 
        player.caveSlowFrames = Math.max(GameContext.player.caveSlowFrames || 0, 18);
        GameContext.player.caveSlowMult = 0.62;
        if (this.damageCd <= 0 && GameContext.player.invulnerable <= 0) {
            GameContext.player.hp -= 1;
            this.damageCd = 40;
            spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#6f6');
            playSound('hit');
            updateHealthUI();
            if (GameContext.player.hp <= 0) killPlayer();
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0x78ff78, 0.35);
                // Dashed? Simulate with dots or low alpha solid
                g.drawCircle(0, 0, this.radius);
            } else if (this.state === 'on') {
                g.beginFill(0x50ff50, 0.08 + pulse * 0.10);
                g.drawCircle(0, 0, this.radius);
                g.endFill();
            } else {
                container.visible = false;
            }

            return;
        }
    }
}

class CaveRockfall extends Entity {
    constructor(x, y, width = 1600, closeSide = 'left') {
        super(x, y);
        this.width = width;
        this.closeSide = closeSide; // left | right | center 
        this.radius = 1;
        this.state = 'idle'; // idle | warn | fallen 
        this.t = 0;
        this.timer = 0;
        this.segments = [];
    }
    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'warn';
        this.timer = 90;
        showOverlayMessage("ROCKFALL INCOMING", '#ff0', 900, 1);
    }
    fall() {
        if (this.state === 'fallen') return;
        this.state = 'fallen';
        this.timer = 0;
        this.segments = [];
        if (!GameContext.caveLevel) return;
        const b = GameContext.caveLevel.boundsAt(this.pos.y);
        const cx = (b.left + b.right) * 0.5;
        let left = b.left + 60;
        let right = b.right - 60;
        if (this.closeSide === 'left') right = Math.min(right, cx - 260);
        else if (this.closeSide === 'right') left = Math.max(left, cx + 260);
        else { left = cx - this.width * 0.5; right = cx + this.width * 0.5; }
        left = Math.max(b.left + 60, left);
        right = Math.min(b.right - 60, right);
        const n = 18;
        const step = (right - left) / n;
        for (let i = 0; i < n; i++) {
            const x0 = left + i * step;
            const x1 = left + (i + 1) * step;
            const j0 = (Math.random() - 0.5) * 70;
            const j1 = (Math.random() - 0.5) * 70;
            this.segments.push({ x0, y0: this.pos.y + j0, x1, y1: this.pos.y + j1, kind: 'rockfall' });
        }
        spawnParticles(cx, this.pos.y, 50, '#888');
        playSound('explode');
    }
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.player || GameContext.player.dead) return;
        if (this.state === 'idle') {
            const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
            if (d < 2200) this.trigger();
        } else if (this.state === 'warn') {
            this.timer -= dtFactor;
            if (this.timer <= 0) this.fall();
            // Falling debris visuals
            if (Math.floor(this.t) % 3 === 0) {
                emitParticle(this.pos.x + (Math.random() - 0.5) * 700, this.pos.y - 800 + Math.random() * 400, (Math.random() - 0.5) * 0.8, 3 + Math.random() * 2, '#888', 50);
            }
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (GameContext.caveLevel && GameContext.caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                GameContext.caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const z = GameContext.currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0xffff00, 0.25 + Math.abs(Math.sin(this.t * 0.2)) * 0.25);
                // Simulate dashed line
                // g.moveTo(-900, 0); g.lineTo(900, 0);
                // Manual dash
                let dx = -900;
                while (dx < 900) {
                    g.moveTo(dx, 0);
                    g.lineTo(Math.min(900, dx + 20), 0);
                    dx += 40;
                }
            }
            else if (this.state === 'fallen' && this.segments && this.segments.length) {
                // Thick blue background
                g.lineStyle(16, 0x003764, 0.9);
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    // Segments coordinates are world space (x0, y0).
                    // Container is at this.pos.x, this.pos.y.
                    // Need to transform to local.
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }

                // Neon glow
                // Pixi allows multiple line styles on one path? No.
                // Re-iterate for glow pass.
                g.lineStyle(3, 0x8cf0ff, 0.75); // rgba(140, 240, 255, 0.75)
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }
            } else {
                container.visible = false;
            }

            return;
        }
    }
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
        GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, true, 1, 12, 4, '#0ff'));
        if (Math.random() < 0.18) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.10, true, 1, 12, 4, '#0ff'));
        if (Math.random() < 0.18) GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.10, true, 1, 12, 4, '#0ff'));
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
const PARTICLE_POOL_MAX = 12000;
const SMOKE_POOL_MAX = 6000;
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

// Safety cleanup function to force explosions to clean themselves
function forceExplosionCleanup() {
    if (!particleRes || !particleRes.pool) return;

    let forcedCount = 0;
    for (let i = GameContext.explosions.length - 1; i >= 0; i--) {
        const ex = GameContext.explosions[i];
        if (ex && ex.dead && !ex.cleaned) {
            try {
                ex.cleanup(particleRes);
                forcedCount++;
                console.warn(`[FORCED CLEANUP] Cleaning explosion #${i} at (${Math.round(ex.pos.x)}, ${Math.round(ex.pos.y)})`);
            } catch (e) {
                console.error(`[FORCED CLEANUP ERROR] Failed to clean explosion #${i}:`, e);
            }
        }
    }

    if (forcedCount > 0) {
        console.log(`[FORCED CLEANUP] Cleaned ${forcedCount} explosions`);
    }
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
function spawnDrone(type) {
    GameContext.drones.push(new Drone(type));
}

function updateContractUI() {
    updateContractUISystem();
}

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

function spawnMiniEventRelative() {
    if (!GameContext.player) return;
    const p = findSpawnPointRelative(true, 2400, 4400);
    // Always spawn the Defend Cache event
    GameContext.miniEvent = new MiniEventDefendCache(p.x, p.y);
    showOverlayMessage("MINI-EVENT: DEFEND THE CACHE", '#ff0', 2200, 1);
    playSound('contract');
}

function spawnRadiationStormRelative() {
    return;
}

function findSpawnPointRelative(random = false, min = 1500, max = 2500) {
    return findSpawnPointRelativeHelper(GameContext, random, min, max);
}

function resolveEntityCollision() {
    const allEntities = [GameContext.player, ...GameContext.enemies, ...GameContext.pinwheels, ...(GameContext.contractEntities.fortresses || [])].filter(e => e && !e.dead);
    // Don't include warp boss or space station in collision physics - they should push others but not be pushed
    // if (boss && !boss.dead) allEntities.push(boss);
    // Space station is completely immovable and should not be in collision physics
    // if (spaceStation) allEntities.push(spaceStation);
    if (GameContext.destroyer && !GameContext.destroyer.dead) allEntities.push(GameContext.destroyer);

    const activeAnomalyZone = (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies)
        ? GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id)
        : null;

    const activeCave = (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) ? GameContext.caveLevel : null;

    // Push physics
    for (let i = 0; i < allEntities.length; i++) {
        for (let j = i + 1; j < allEntities.length; j++) {
            const e1 = allEntities[i];
            const e2 = allEntities[j];

            // Pinwheels shouldn't "push" ships around; ships should avoid them instead.
            if ((e1 instanceof Pinwheel && e2 instanceof Enemy) || (e2 instanceof Pinwheel && e1 instanceof Enemy)) {
                continue;
            }
            let r1 = (e1 instanceof Destroyer || e1 instanceof Destroyer2) ? (e1.shieldRadius || e1.radius) : e1.radius;
            let r2 = (e2 instanceof Destroyer || e2 instanceof Destroyer2) ? (e2.shieldRadius || e2.radius) : e2.radius;
            if (e1.isWarpBoss) r1 = e1.shieldRadius || e1.radius;
            if (e2.isWarpBoss) r2 = e2.shieldRadius || e2.radius;


            const isStatic1 = (e1 instanceof Pinwheel) || (e1 instanceof SpaceStation);
            const isStatic2 = (e2 instanceof Pinwheel) || (e2 instanceof SpaceStation);
            const e1IsDestroyer = (e1 instanceof Destroyer || e1 instanceof Destroyer2);
            const e2IsDestroyer = (e2 instanceof Destroyer || e2 instanceof Destroyer2);

            if (isStatic1 && e1.shieldSegments && e1.shieldSegments.some(s => s > 0)) r1 = e1.shieldRadius;
            if (isStatic2 && e2.shieldSegments && e2.shieldSegments.some(s => s > 0)) r2 = e2.shieldRadius;

            const dx = e2.pos.x - e1.pos.x;
            const dy = e2.pos.y - e1.pos.y;
            const distSq = dx * dx + dy * dy;
            const minDist = r1 + r2;
            if (distSq < minDist * minDist && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const push = overlap * 0.5;

                if ((e1IsDestroyer && e2 instanceof Pinwheel) || (e2IsDestroyer && e1 instanceof Pinwheel)) {
                    if (e1IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                    else { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                } else if (isStatic1) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (isStatic2) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else if (e1IsDestroyer && !e2IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (e2IsDestroyer && !e1IsDestroyer) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else {
                    e1.pos.x -= nx * push; e1.pos.y -= ny * push;
                    e2.pos.x += nx * push; e2.pos.y += ny * push;
                }

                if (e1 instanceof Pinwheel) e1.aggro = true;
                if (e2 instanceof Pinwheel) e2.aggro = true;
            }
        }
    }

    // Warp boss collision barrier: keep vehicles outside outer ring (bullets bypass).
    if (GameContext.bossActive && GameContext.boss && GameContext.boss.isWarpBoss && !GameContext.boss.dead) {
        for (let i = 0; i < allEntities.length; i++) {
            const entity = allEntities[i];
            if (!entity || entity.dead || entity === GameContext.boss) continue;
            const dx = entity.pos.x - GameContext.boss.pos.x;
            const dy = entity.pos.y - GameContext.boss.pos.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const barrierRadius = GameContext.boss.shieldRadius;
            const minDist = barrierRadius + entity.radius;
            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const nx = Math.cos(angle);
                const ny = Math.sin(angle);
                entity.pos.x = GameContext.boss.pos.x + nx * minDist;
                entity.pos.y = GameContext.boss.pos.y + ny * minDist;
                const dot = entity.vel.x * nx + entity.vel.y * ny;
                if (dot < 0) {
                    entity.vel.x -= nx * dot * 1.2;
                    entity.vel.y -= ny * dot * 1.2;
                }
                if (entity === GameContext.player) {
                    const now = Date.now();
                    if (!GameContext.player.lastWarpBossBlockAt || now - GameContext.player.lastWarpBossBlockAt > 200) {
                        spawnParticles((GameContext.player.pos.x + GameContext.boss.pos.x) / 2, (GameContext.player.pos.y + GameContext.boss.pos.y) / 2, 5, '#0ff');
                        playSound('shield_hit');
                        GameContext.player.lastWarpBossBlockAt = now;
                    }
                }
            }
        }
    }

    // Collision & Damage
    const damageable = [GameContext.player, ...GameContext.enemies, ...GameContext.pinwheels, ...(GameContext.contractEntities.fortresses || [])];
    if (GameContext.boss && GameContext.bossActive && !GameContext.boss.dead) damageable.push(GameContext.boss);
    if (GameContext.destroyer && !GameContext.destroyer.dead) damageable.push(GameContext.destroyer);

    for (let entity of damageable) {
        if (entity.dead) continue;
        const nearbyAsteroids = GameContext.asteroidGrid.query(entity.pos.x, entity.pos.y);
        for (let ast of nearbyAsteroids) {
            if (ast.dead) continue;
            const dx = entity.pos.x - ast.pos.x;
            const dy = entity.pos.y - ast.pos.y;
            const distSq = dx * dx + dy * dy;
            const entityRadius = (entity instanceof Destroyer || entity instanceof Destroyer2) ? (entity.shieldRadius || entity.radius) : entity.radius;
            const minDist = entityRadius + ast.radius;
            const isIndestructibleWall = !!ast.unbreakable;

            if (distSq < minDist * minDist) {
                let dist = Math.sqrt(distSq);
                if (dist < 0.001) dist = 0.001;
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                // Some large entities can smash normal asteroids, but indestructible contract walls should block everything.
                const isCrasher = (entity instanceof Pinwheel) ||
                    (entity instanceof Cruiser) ||
                    (entity instanceof Enemy && (
                        entity.isGunboat ||
                        entity.type === 'roamer' ||
                        entity.type === 'elite_roamer' ||
                        entity.type === 'hunter' ||
                        entity.type === 'defender'
                    ));
                const isDestroyer = (entity instanceof Destroyer || entity instanceof Destroyer2);

                // Track if we had any valid collision
                let validCollision = false;

                if (isDestroyer && isIndestructibleWall) {
                    // Destroyers blow through indestructible asteroids with particle effects only (no sound)
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    // No collision response - continue to next asteroid
                    continue;
                }

                if (!isIndestructibleWall && isCrasher) {
                    ast.break();
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    validCollision = true;
                }

                // Only apply collision response if we had a valid collision (not indestructible)
                if (validCollision) {
                    entity.pos.x += nx * overlap;
                    entity.pos.y += ny * overlap;

                    if (entity !== GameContext.player) {
                        entity.vel.x += nx * 1;
                        entity.vel.y += ny * 1;
                    }
                }

                if (entity === GameContext.player) {
                    // Bump response: bounce like a rubber wall + push away
                    const vn = GameContext.player.vel.x * nx + GameContext.player.vel.y * ny;
                    if (vn < 0) {
                        const restitution = 1.0; // elastic bounce
                        GameContext.player.vel.x -= nx * vn * (1 + restitution);
                        GameContext.player.vel.y -= ny * vn * (1 + restitution);
                    }
                    // Indestructible walls should feel "tight" (no extra invisible buffer) vs regular asteroids.
                    const outwardKick = isIndestructibleWall ? Math.min(4, overlap * 0.08) : Math.min(10, 3 + overlap * 0.12);
                    GameContext.player.vel.x += nx * outwardKick;
                    GameContext.player.vel.y += ny * outwardKick;
                    GameContext.player.vel.mult(0.98);
                    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, isIndestructibleWall ? 3 : 6);
                    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 10);

                    if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
                        // Invincibility check from upgrade
                        if (GameContext.player.invincibilityOnHit > 0) {
                            // Trigger invuln? For now simpler logic: Just standard shield hit
                        }

                        if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
                            const asteroidDamage = GameContext.sectorIndex >= 2 ? 2 : 1;
                            GameContext.player.takeHit(asteroidDamage);
                            GameContext.player.lastAsteroidHitTime = Date.now();
                            if (!isIndestructibleWall) {
                                ast.break();
                                spawnParticles(ast.pos.x, ast.pos.y, 8, '#aa8');
                                playSound('hit');
                            } else {
                                // Wall sparks (no breaking).
                                spawnParticles(GameContext.player.pos.x - nx * GameContext.player.radius, GameContext.player.pos.y - ny * GameContext.player.radius, 6, '#08f');
                                playSound('hit');
                            }
                        }
                    }
                }
            }
        }
    }

    // (Wall collisions for caves, warp zones, and anomalies are now handled centrally
    //  via checkWallCollision(entity) within each entity's update method).

    // Coin Collection
    if (GameContext.player && !GameContext.player.dead) {
        // Player rams into roamers/defenders: destroy them, take damage equal to remaining HP
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            // Ramming Logic
            const isRoamer = (e.type === 'roamer' || e.type === 'elite_roamer');
            const isDefender = (e.type === 'defender');
            const isHunter = (e.type === 'hunter');

            if (isRoamer || isDefender || isHunter) {
                const dist = Math.hypot(GameContext.player.pos.x - e.pos.x, GameContext.player.pos.y - e.pos.y);
                if (dist < GameContext.player.radius + e.radius) {
                    // Safe Bump for Roamers/Defenders
                    if (isRoamer || isDefender) {
                        const angle = Math.atan2(GameContext.player.pos.y - e.pos.y, GameContext.player.pos.x - e.pos.x);
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);

                        // Push away physically (velocity)
                        const pushForce = 5;
                        GameContext.player.vel.x += nx * pushForce;
                        GameContext.player.vel.y += ny * pushForce;
                        e.vel.x -= nx * pushForce;
                        e.vel.y -= ny * pushForce;

                        // Visuals
                        spawnParticles((GameContext.player.pos.x + e.pos.x) / 2, (GameContext.player.pos.y + e.pos.y) / 2, 5, '#fff');
                        // No damage, no death.
                        continue;
                    }

                    // Original logic for Hunters or others
                    const ramDamage = Math.max(0, Math.ceil(e.hp));
                    // Larger, colorful burst on impact
                    spawnParticles(e.pos.x, e.pos.y, 20, '#f44');
                    spawnParticles(e.pos.x, e.pos.y, 15, '#ff0');
                    spawnParticles(e.pos.x, e.pos.y, 10, '#0ff');
                    e.kill();
                    playSound('hit');

                    GameContext.player.takeHit(ramDamage);
                }
            }

            // Dungeon boss collision - player bounces off and takes damage
            if (e.isDungeonBoss) {
                const dist = Math.hypot(GameContext.player.pos.x - e.pos.x, GameContext.player.pos.y - e.pos.y);
                if (dist < GameContext.player.radius + e.radius) {
                    const angle = Math.atan2(GameContext.player.pos.y - e.pos.y, GameContext.player.pos.x - e.pos.x);
                    const nx = Math.cos(angle);
                    const ny = Math.sin(angle);

                    // Strong pushback
                    const pushForce = 12;
                    GameContext.player.vel.x += nx * pushForce;
                    GameContext.player.vel.y += ny * pushForce;
                    e.vel.x -= nx * pushForce * 0.3;
                    e.vel.y -= ny * pushForce * 0.3;

                    // Ram damage based on boss tier (higher for later bosses)
                    const ramDamage = 3 + Math.floor(GameContext.sectorIndex * 0.5);
                    GameContext.player.takeHit(ramDamage);

                    // Visuals
                    spawnParticles((GameContext.player.pos.x + e.pos.x) / 2, (GameContext.player.pos.y + e.pos.y) / 2, 12, '#f44');
                    playSound('hit');
                }
            }
        }

        for (let c of GameContext.coins) {
            if (c.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - c.pos.x, GameContext.player.pos.y - c.pos.y);
            if (dist < GameContext.player.radius + c.radius) {
                // Collect - call kill() to properly release sprite
                playSound('coin');
                GameContext.score += c.value;
                GameContext.player.addXp(c.value);
                addPickupFloatingText('gold', c.value, '#ff0');

                // Reactive Shield: restore shield segments on collect (50 coins per restore)
                if (GameContext.player.stats.reactiveShield && GameContext.player.stats.reactiveShield > 0) {
                    // Track coins toward next restore
                    if (!GameContext.player.reactiveShieldCoins) GameContext.player.reactiveShieldCoins = 0;
                    GameContext.player.reactiveShieldCoins += c.value;

                    // Every 50 coins, restore segments
                    while (GameContext.player.reactiveShieldCoins >= 50) {
                        GameContext.player.reactiveShieldCoins -= 50;
                        const restoreAmount = GameContext.player.stats.reactiveShield;
                        // Tier 3 bonus: +25% shield HP (2 → 3)
                        const innerShieldMaxHp = GameContext.player.stats.reactiveShieldBonusHp ? 3 : 2;

                        // Restore outer shield segments first
                        for (let i = 0; i < restoreAmount && GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0; i++) {
                            const idx = GameContext.player.outerShieldSegments.findIndex(s => s <= 0);
                            if (idx !== -1) {
                                GameContext.player.outerShieldSegments[idx] = 1;
                                GameContext.player.shieldsDirty = true;
                            } else {
                                // Outer shields full, try inner shields
                                const innerIdx = GameContext.player.shieldSegments.findIndex(s => s < innerShieldMaxHp);
                                if (innerIdx !== -1) {
                                    GameContext.player.shieldSegments[innerIdx] = Math.min(innerShieldMaxHp, GameContext.player.shieldSegments[innerIdx] + 1);
                                    GameContext.player.shieldsDirty = true;
                                }
                            }
                        }
                        // If outer shields were full, restore remaining to inner shields
                        if (restoreAmount > 0 && GameContext.player.shieldSegments) {
                            for (let i = 0; i < restoreAmount; i++) {
                                const innerIdx = GameContext.player.shieldSegments.findIndex(s => s < innerShieldMaxHp);
                                if (innerIdx !== -1) {
                                    GameContext.player.shieldSegments[innerIdx] = Math.min(innerShieldMaxHp, GameContext.player.shieldSegments[innerIdx] + 1);
                                    GameContext.player.shieldsDirty = true;
                                }
                            }
                        }
                    }
                }

                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        for (let n of GameContext.nuggets) {
            if (n.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - n.pos.x, GameContext.player.pos.y - n.pos.y);
            if (dist < GameContext.player.radius + n.radius) {
                playSound('coin');
                GameContext.spaceNuggets += n.value;
                updateNuggetUI();
                addPickupFloatingText('nugs', n.value, '#ff0');
                // Call kill() to properly release sprite
                if (typeof n.kill === 'function') n.kill();
                else n.dead = true;
            }
        }

        for (let p of GameContext.powerups) {
            if (p.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - p.pos.x, GameContext.player.pos.y - p.pos.y);
            if (dist < GameContext.player.radius + p.radius) {
                playSound('powerup');
                GameContext.player.hp = Math.min(GameContext.player.hp + 10, GameContext.player.maxHp);
                updateHealthUI();
                showOverlayMessage("HEALTH RESTORED", '#0f0', 1000);
                // Call kill() to properly release sprite
                if (typeof p.kill === 'function') p.kill();
                else p.dead = true;
            }
        }

        for (let c of GameContext.caches) {
            if (c.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - c.pos.x, GameContext.player.pos.y - c.pos.y);
            if (dist < GameContext.player.radius + c.radius) {
                playSound('coin');
                GameContext.spaceNuggets += c.value;
                updateNuggetUI();
                addPickupFloatingText('nugs', c.value, '#ff0');
                showOverlayMessage(`CACHE +${c.value} NUGS`, '#ff0', 800);

                // Anomaly contract: picking up the cache is step 1; you must escape the ring to finish.
                if (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.activeContract.id && c.contractId === GameContext.activeContract.id) {
                    if (!GameContext.activeContract.coreCollected) {
                        GameContext.activeContract.coreCollected = true;
                        showOverlayMessage("CORE ACQUIRED - ESCAPE ANOMALY", '#0f0', 2000);
                        updateContractUI();
                    }
                }
                // Call kill() to properly clean up PIXI graphics
                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        // Shooting Star Collisions
        for (let s of GameContext.shootingStars) {
            if (s.dead) continue;

            // Vs Player
            if (GameContext.player && !GameContext.player.dead && !GameContext.player.invulnerable) {
                const dist = Math.hypot(s.pos.x - GameContext.player.pos.x, s.pos.y - GameContext.player.pos.y);
                if (dist < s.radius + GameContext.player.radius) {
                    GameContext.player.takeHit(s.damage);
                    updateHealthUI();
                    playSound('explode');
                    spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 20, '#f00');
                    showOverlayMessage("HIT BY SHOOTING STAR!", '#f00', 2000);
                    s.dead = true;
                    if (GameContext.player.hp <= 0) killPlayer();
                    continue;
                }
            }

            // Vs Enemies / Bases / Boss / Station
            let hitEntity = false;
            for (let e of GameContext.enemies) {
                if (!e || e.dead) continue;
                const dist = Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y);
                if (dist < s.radius + e.radius) {
                    e.hp -= s.damage;
                    spawnParticles(e.pos.x, e.pos.y, 14, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                    hitEntity = true;
                    break;
                }
            }
            if (!hitEntity) {
                for (let b of GameContext.pinwheels) {
                    if (!b || b.dead) continue;
                    const dist = Math.hypot(s.pos.x - b.pos.x, s.pos.y - b.pos.y);
                    if (dist < s.radius + b.radius) {
                        b.hp -= s.damage;
                        b.aggro = true;
                        spawnParticles(b.pos.x, b.pos.y, 18, '#fa0');
                        playSound('explode');
                        if (b.hp <= 0) {
                            b.dead = true;
                            playSound('base_explode');
                            spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
                            for (let i = 0; i < 6; i++) GameContext.coins.push(new Coin(b.pos.x + (Math.random() - 0.5) * 50, b.pos.y + (Math.random() - 0.5) * 50, 5));
                            GameContext.nuggets.push(new SpaceNugget(b.pos.x, b.pos.y, 1));
                            GameContext.pinwheelsDestroyed++;
                            GameContext.pinwheelsDestroyedTotal++;
                            GameContext.difficultyTier = 1 + Math.floor(GameContext.pinwheelsDestroyedTotal / 6);
                            GameContext.score += 1000;
                            document.getElementById('bases-display').innerText = `${GameContext.pinwheelsDestroyedTotal}`;
                            GameContext.enemies.forEach(e => { if (e.assignedBase === b) e.type = 'roamer'; });
                            const delay = 5000 + Math.random() * 5000;
                            GameContext.baseRespawnTimers.push(Date.now() + delay);
                        }
                        hitEntity = true;
                        break;
                    }
                }
            }
            if (!hitEntity && GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) {
                if (typeof GameContext.boss.hitTestCircle === 'function' && GameContext.boss.hitTestCircle(s.pos.x, s.pos.y, s.radius)) {
                    if (!(GameContext.boss.isWarpBoss && GameContext.boss.ramInvulnerable > 0)) {
                        GameContext.boss.hp -= s.damage;
                        spawnParticles(GameContext.boss.pos.x, GameContext.boss.pos.y, 22, '#fa0');
                        playSound('explode');
                        if (GameContext.boss.hp <= 0) {
                            GameContext.boss.kill();
                            GameContext.score += 10000;
                        }
                    }
                    hitEntity = true;
                }
            }
            if (!hitEntity && GameContext.spaceStation) {
                const dist = Math.hypot(s.pos.x - GameContext.spaceStation.pos.x, s.pos.y - GameContext.spaceStation.pos.y);
                if (dist < s.radius + GameContext.spaceStation.radius) {
                    GameContext.spaceStation.hp -= s.damage;
                    spawnParticles(GameContext.spaceStation.pos.x, GameContext.spaceStation.pos.y, 22, '#fa0');
                    playSound('explode');
                    if (GameContext.spaceStation.hp <= 0) handleSpaceStationDestroyed();
                    hitEntity = true;
                }
            }
            if (hitEntity) {
                s.dead = true;
                continue;
            }

            // Vs Asteroids
            const nearby = GameContext.asteroidGrid.query(s.pos.x, s.pos.y);
            for (let ast of nearby) {
                if (ast.dead) continue;
                const dist = Math.hypot(s.pos.x - ast.pos.x, s.pos.y - ast.pos.y);
                if (dist < s.radius + ast.radius) {
                    ast.break(true); // No sound when hit by comet
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#fa0');
                    // Star keeps going (pierces)
                }
            }
        }

    }
}

function checkWallCollision(entity, elasticity = 0) {
    // 1. Cave Level Collisions
    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
        GameContext.caveLevel.applyWallCollisions(entity);
    }

    // 2. Warp Zone Collisions
    if (GameContext.warpZone && GameContext.warpZone.active) {
        GameContext.warpZone.applyWallCollisions(entity);
    }

    // 3. Anomaly Maze Collisions
    const activeAnomalyZone = (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies)
        ? GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id)
        : null;
    if (activeAnomalyZone) {
        const dA = Math.hypot(entity.pos.x - activeAnomalyZone.pos.x, entity.pos.y - activeAnomalyZone.pos.y);
        if (dA < activeAnomalyZone.radius + 800) activeAnomalyZone.applyWallCollisions(entity, 0.95);
    }

    // Arena barriers only affect player/bullets (enemies exempt)
    if (GameContext.bossArena.active && entity instanceof Enemy) return;
    if (GameContext.bossArena.active) {
        const dx = entity.pos.x - GameContext.bossArena.x;
        const dy = entity.pos.y - GameContext.bossArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.bossArena.radius) {
            // Player Damage Logic
            if (entity === GameContext.player) {
                const warpBossActive = !!(GameContext.boss && GameContext.bossActive && GameContext.boss.isWarpBoss && !GameContext.boss.dead);
                if (!warpBossActive && Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        playSound('hit');
                        updateHealthUI();
                        spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f00');
                        showOverlayMessage("WARNING: ARENA WALL DAMAGE", '#f00', 1000);
                        if (GameContext.player.hp <= 0) killPlayer();
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.bossArena.x + Math.cos(angle) * GameContext.bossArena.radius;
            entity.pos.y = GameContext.bossArena.y + Math.sin(angle) * GameContext.bossArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    // Station arena barrier
    if (GameContext.stationArena.active && entity instanceof Enemy) return;
    if (GameContext.stationArena.active) {
        const dx = entity.pos.x - GameContext.stationArena.x;
        const dy = entity.pos.y - GameContext.stationArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.stationArena.radius) {
            if (entity === GameContext.player) {
                if (Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        playSound('hit');
                        updateHealthUI();
                        spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f00');
                        showOverlayMessage("STATION FIELD DAMAGE", '#f80', 1000);
                        if (GameContext.player.hp <= 0) killPlayer();
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.stationArena.x + Math.cos(angle) * GameContext.stationArena.radius;
            entity.pos.y = GameContext.stationArena.y + Math.sin(angle) * GameContext.stationArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    // Dungeon1 arena barrier
    if (GameContext.dungeon1Arena.active && entity instanceof Enemy) return;
    if (GameContext.dungeon1Arena.active) {
        const dx = entity.pos.x - GameContext.dungeon1Arena.x;
        const dy = entity.pos.y - GameContext.dungeon1Arena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.dungeon1Arena.radius) {
            if (entity === GameContext.player) {
                if (Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        playSound('hit');
                        updateHealthUI();
                        spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f80');
                        showOverlayMessage("DUNGEON BOUNDARY", '#f80', 1000);
                        if (GameContext.player.hp <= 0) killPlayer();
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.dungeon1Arena.x + Math.cos(angle) * GameContext.dungeon1Arena.radius;
            entity.pos.y = GameContext.dungeon1Arena.y + Math.sin(angle) * GameContext.dungeon1Arena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }
}

function checkBulletWallCollision(bullet) {
    // Warp maze 1px line walls (blocks bullets).
    if (GameContext.warpZone && GameContext.warpZone.active && typeof GameContext.warpZone.bulletHitsWall === 'function') {
        if (GameContext.warpZone.bulletHitsWall(bullet)) return { kind: 'warp_wall', obj: null };
    }
    // Cave 1px line walls.
    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && typeof GameContext.caveLevel.bulletHitsWall === 'function') {
        if (GameContext.caveLevel.bulletHitsWall(bullet)) return { kind: 'cave_wall', obj: null };
    }
    // Anomaly maze 1px line walls.
    if (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies) {
        const az = GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id && typeof a.bulletHitsWall === 'function');
        if (az) {
            const dA = Math.hypot(bullet.pos.x - az.pos.x, bullet.pos.y - az.pos.y);
            if (dA < az.radius + 900 && az.bulletHitsWall(bullet)) return { kind: 'anomaly_wall', obj: null };
        }
    }
    const nearby = GameContext.asteroidGrid.query(bullet.pos.x, bullet.pos.y);
    for (let ast of nearby) {
        if (ast.dead) continue;
        const dx = bullet.pos.x - ast.pos.x;
        const dy = bullet.pos.y - ast.pos.y;
        const distSq = dx * dx + dy * dy;
        const rad = ast.radius + bullet.radius;
        if (distSq < rad * rad) {
            return { kind: 'asteroid', obj: ast };
        }
    }
    return null;
}

function updateHealthUI() {
    updateHealthUIHelper(GameContext);
}

function updateXpUI() {
    updateXpUIHelper(GameContext);
}

function updateNuggetUI() {
    const el = document.getElementById('nugget-count');
    if (el) el.innerText = (GameContext.metaProfile.bank || 0) + GameContext.spaceNuggets;
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
            menuDebounce = Date.now() + 300;
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
            menuDebounce = Date.now() + 300;
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
    if (!GameContext.currentProfileName) {
        resetProfileStats();
        resetMetaProfileSystem(); // Clear in-memory upgrades
        updateMetaUISystem();     // Update UI to show 0 bank/upgrades
        updateStartScreenDisplay();
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
        menuDebounce = Date.now() + 300;
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

function showCustomPrompt(message, defaultValue) {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const input = document.getElementById('prompt-input');
        const msgEl = document.getElementById('prompt-message');
        const confirmBtn = document.getElementById('prompt-confirm');
        const cancelBtn = document.getElementById('prompt-cancel');

        if (!modal || !input || !msgEl) {
            console.error('Prompt modal elements missing');
            resolve(null);
            return;
        }

        msgEl.innerText = message;
        input.value = defaultValue || '';
        modal.style.display = 'block';
        input.focus();
        input.select();

        // Ensure keys don't trigger game actions
        const stopProp = (e) => e.stopPropagation();

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
            input.removeEventListener('keypress', stopProp);
            input.removeEventListener('keyup', stopProp);
            modal.style.display = 'none';
        };

        const onConfirm = () => {
            const val = input.value.trim();
            cleanup();
            resolve(val || null);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        const onKey = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
        input.addEventListener('keypress', stopProp);
        input.addEventListener('keyup', stopProp);
    });
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
    updateMetaUISystem();
    updateStartScreenDisplay();
    showOverlayMessage("PROFILE RESET - STARTING FRESH", '#0f0', 2000);
}

function updateWarpUI() {
    updateWarpUIHelper(GameContext);
}

function updateTurboUI() {
    updateTurboUIHelper(GameContext);
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

function awardNugzInstant(amount, opts = {}) {
    const v = Math.max(0, Math.floor(amount || 0));
    if (v <= 0) return;
    GameContext.spaceNuggets += v;
    updateNuggetUI();
    if (!opts.noSound) playSound(opts.sound || 'coin');
    addPickupFloatingText('nugs', v, opts.color || '#ff0');
}

function spawnNewPinwheelRelative(initial = false) {
    if (!GameContext.player) return;
    const availableTypes = ['standard'];
    if (GameContext.difficultyTier >= 2) availableTypes.push('rapid');
    if (GameContext.difficultyTier >= 3) availableTypes.push('heavy');

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    let angle;
    if (initial) {
        angle = Math.random() * Math.PI * 2;
    } else {
        let baseAngle = GameContext.player.angle;
        if (GameContext.player.vel.mag() > 1) baseAngle = Math.atan2(GameContext.player.vel.y, GameContext.player.vel.x);
        angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2);
    }

    const dist = initial ? (1000 + Math.random() * 2000) : (3500 + Math.random() * 1500);
    let bx, by;
    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
        // Spawn pinwheels "up the tunnel" and inside the cave bounds.
        by = GameContext.player.pos.y - dist * (0.85 + Math.random() * 0.3);
        const bounds = GameContext.caveLevel.boundsAt(by);
        const margin = 420;
        const w = Math.max(200, (bounds.right - bounds.left) - margin * 2);
        bx = bounds.left + margin + Math.random() * w;
    } else {
        bx = GameContext.player.pos.x + Math.cos(angle) * dist;
        by = GameContext.player.pos.y + Math.sin(angle) * dist;
    }

    const b = new Pinwheel(bx, by, type);
    GameContext.pinwheels.push(b);
    // One guard per pinwheel
    const da = Math.random() * Math.PI * 2;
    const defX = b.pos.x + Math.cos(da) * 150;
    const defY = b.pos.y + Math.sin(da) * 150;
    GameContext.enemies.push(new Enemy('defender', { x: defX, y: defY }, b));
}

// --- Core Loop ---

function updateGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[GameContext.gamepadIndex];
    if (!gp) {
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) { GameContext.gamepadIndex = i; break; }
        }
        // If no pads are present, fall back to mouse/keyboard mode.
        if (!pads.some(p => p)) {
            GameContext.gamepadIndex = null;
            GameContext.lastGamepadInputAt = 0;
            updateInputMode(Date.now());
        }
        return;
    }

    const deadzone = 0.12;
    const applyDeadzone = (v) => {
        const a = Math.abs(v);
        if (a <= deadzone) return 0;
        // Rescale so values just outside the deadzone don't feel sluggish.
        const scaled = (a - deadzone) / (1 - deadzone);
        return Math.sign(v) * scaled;
    };

    let gamepadInput = false;
    if (gp.axes.some(axis => Math.abs(axis) > deadzone) || gp.buttons.some(button => button.pressed)) {
        gamepadInput = true;
    }

    if (gamepadInput) {
        GameContext.lastGamepadInputAt = Date.now();
    }

    gpState.move.x = applyDeadzone(gp.axes[0]);
    gpState.move.y = applyDeadzone(gp.axes[1]);
    gpState.aim.x = applyDeadzone(gp.axes[2]);
    gpState.aim.y = applyDeadzone(gp.axes[3]);

    const now = Date.now();
    updateInputMode(now);
    if (gp.buttons[9].pressed && !gpState.pausePressed) { // Start
        togglePause();
        gpState.pausePressed = true;
    } else if (!gp.buttons[9].pressed) {
        gpState.pausePressed = false;
    }

    gpState.warp = gp.buttons[0].pressed;
    gpState.turbo = gp.buttons[2].pressed || gp.buttons[6].pressed; // Button 2 (X) or LT
    gpState.battery = gp.buttons[3].pressed || gp.buttons[7].pressed; // Button 3 (Y) or RT

    // Menu Navigation Support
    if ((!GameContext.gameActive || GameContext.gamePaused) && now - menuDebounce > 150) {
        const activeElements = getActiveMenuElements();
        if (activeElements.length > 0) {
            // Check if menu has changed by comparing first element or length
            const menuChanged = !gpState.lastMenuElements ||
                gpState.lastMenuElements.length !== activeElements.length ||
                gpState.lastMenuElements[0] !== activeElements[0];

            if (menuChanged) {
                // Preserve index when returning from modal to shop
                if (!getReturningFromModalSystem()) {
                    GameContext.menuSelectionIndex = 0;
                }
                gpState.lastMenuElements = activeElements;
                updateMenuVisuals(activeElements);
            }

            // Reset the flag after processing menu change
            if (getReturningFromModalSystem() && menuChanged) {
                setReturningFromModalSystem(false);
            }

            const selectedEl = activeElements[GameContext.menuSelectionIndex];
            const isSlider = selectedEl && selectedEl.tagName === 'INPUT' && selectedEl.type === 'range';
            const isCheckbox = selectedEl && selectedEl.tagName === 'INPUT' && selectedEl.type === 'checkbox';
            const isSelect = selectedEl && selectedEl.tagName === 'SELECT';

            // Check for horizontal input
            const leftPressed = gp.axes[0] < -0.5 || (gp.buttons[14] && gp.buttons[14].pressed);
            const rightPressed = gp.axes[0] > 0.5 || (gp.buttons[15] && gp.buttons[15].pressed);

            // Handle sliders - left/right adjusts value, up/down navigates
            if (isSlider) {
                if (leftPressed || rightPressed) {
                    const changeAmount = 5;
                    if (rightPressed) {
                        selectedEl.value = Math.min(parseInt(selectedEl.max), parseInt(selectedEl.value) + changeAmount);
                    } else {
                        selectedEl.value = Math.max(parseInt(selectedEl.min), parseInt(selectedEl.value) - changeAmount);
                    }
                    selectedEl.dispatchEvent(new Event('input', { bubbles: true }));
                    menuDebounce = now + 100;
                } else {
                    // Vertical navigation for sliders
                    let change = 0;
                    if (gp.axes[1] < -0.5 || (gp.buttons[12] && gp.buttons[12].pressed)) change = -1;
                    if (gp.axes[1] > 0.5 || (gp.buttons[13] && gp.buttons[13].pressed)) change = 1;

                    if (change !== 0) {
                        GameContext.menuSelectionIndex += change;
                        if (GameContext.menuSelectionIndex < 0) GameContext.menuSelectionIndex = activeElements.length - 1;
                        if (GameContext.menuSelectionIndex >= activeElements.length) GameContext.menuSelectionIndex = 0;
                        updateMenuVisuals(activeElements);
                        menuDebounce = now;
                    }
                }
            } else {
                // Non-slider navigation
                // Check for vertical input (navigation)
                let vertChange = 0;
                if (gp.axes[1] < -0.5 || (gp.buttons[12] && gp.buttons[12].pressed)) vertChange = -1;
                if (gp.axes[1] > 0.5 || (gp.buttons[13] && gp.buttons[13].pressed)) vertChange = 1;

                // Check for horizontal input
                let horizChange = 0;
                if (leftPressed) horizChange = -1;
                if (rightPressed) horizChange = 1;

                // Vertical input - always navigate
                if (vertChange !== 0) {
                    GameContext.menuSelectionIndex += vertChange;
                    if (GameContext.menuSelectionIndex < 0) GameContext.menuSelectionIndex = activeElements.length - 1;
                    if (GameContext.menuSelectionIndex >= activeElements.length) GameContext.menuSelectionIndex = 0;
                    updateMenuVisuals(activeElements);
                    menuDebounce = now;
                }
                // Horizontal input - cycle options for selects
                else if (horizChange !== 0 && isSelect) {
                    const options = selectedEl.options;
                    const currentIndex = selectedEl.selectedIndex;
                    const nextIndex = (currentIndex + horizChange + options.length) % options.length;
                    selectedEl.selectedIndex = nextIndex;
                    selectedEl.dispatchEvent(new Event('change', { bubbles: true }));
                    menuDebounce = now;
                }
                // Horizontal input on non-select - navigate
                else if (horizChange !== 0) {
                    GameContext.menuSelectionIndex += horizChange;
                    if (GameContext.menuSelectionIndex < 0) GameContext.menuSelectionIndex = activeElements.length - 1;
                    if (GameContext.menuSelectionIndex >= activeElements.length) GameContext.menuSelectionIndex = 0;
                    updateMenuVisuals(activeElements);
                    menuDebounce = now;
                }

                // A Button / Cross - toggle checkbox or click button
                if (gp.buttons[0].pressed) {
                    if (isCheckbox) {
                        selectedEl.checked = !selectedEl.checked;
                        selectedEl.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        selectedEl.click();
                        gpState.lastMenuElements = null;
                    }
                    menuDebounce = now + 200;
                }

                // B Button / Circle - universal back button for all menus
                if (gp.buttons[1].pressed) {
                    let handled = false;

                    // 1. Check if meta shop modal is open
                    const modal = document.getElementById('meta-shop-modal');
                    if (modal && modal.style.display === 'block') {
                        const backBtn = document.getElementById('meta-modal-back');
                        if (backBtn) backBtn.click();
                        gpState.lastMenuElements = null;
                        handled = true;
                    }

                    // 2. Check if settings menu is open
                    if (!handled) {
                        const settingsMenu = document.getElementById('settings-menu');
                        if (settingsMenu && settingsMenu.style.display === 'block') {
                            const settingsCloseBtn = document.getElementById('settings-close-btn');
                            if (settingsCloseBtn) {
                                settingsCloseBtn.click();
                                handled = true;
                            }
                        }
                    }

                    // 3. Check if meta shop upgrades menu is open
                    if (!handled) {
                        const upgradesMenu = document.getElementById('upgrades-menu');
                        if (upgradesMenu && upgradesMenu.style.display !== 'none') {
                            const upgradesBackBtn = document.getElementById('upgrades-back-btn');
                            if (upgradesBackBtn) {
                                upgradesBackBtn.click();
                                handled = true;
                            }
                        }
                    }

                    // 4. Check if profile select is open
                    if (!handled) {
                        const profileSelect = document.getElementById('profile-select');
                        if (profileSelect && profileSelect.style.display === 'block') {
                            const profileBackBtn = document.getElementById('profile-back-btn');
                            if (profileBackBtn) {
                                profileBackBtn.click();
                                handled = true;
                            }
                        }
                    }

                    // 5. Check if run upgrades screen is open
                    if (!handled) {
                        const runUpgradesScreen = document.getElementById('run-upgrades-screen');
                        if (runUpgradesScreen && runUpgradesScreen.style.display === 'block') {
                            const runUpgradesBackBtn = document.getElementById('run-upgrades-back-btn');
                            if (runUpgradesBackBtn) {
                                runUpgradesBackBtn.click();
                                handled = true;
                            }
                        }
                    }

                    // 6. Check if debug menu is open
                    if (!handled) {
                        const debugMenu = document.getElementById('debug-menu');
                        if (debugMenu && debugMenu.style.display === 'block') {
                            const debugBackBtn = document.getElementById('debug-back-btn');
                            if (debugBackBtn) {
                                debugBackBtn.click();
                                handled = true;
                            }
                        }
                    }

                    // 7. Check if pause menu is open - B button resumes game
                    if (!handled) {
                        const pauseMenu = document.getElementById('pause-menu');
                        if (pauseMenu && pauseMenu.style.display === 'block') {
                            togglePause();
                            handled = true;
                        }
                    }

                    if (handled) {
                        menuDebounce = now + 200;
                    }
                }
            }
        } else {
            gpState.lastMenuElements = null;
        }
    }
}

function getActiveMenuElements() {
    const isVisible = (el) => {
        if (!el) return false;
        if (typeof window === 'undefined' || !window.getComputedStyle) {
            return el.style.display !== 'none' && el.style.visibility !== 'hidden';
        }
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    };

    // Check for meta shop modal FIRST (highest priority)
    const metaShopModal = document.getElementById('meta-shop-modal');
    if (isVisible(metaShopModal)) {
        const buyBtn = document.getElementById('meta-modal-buy');
        const backBtn = document.getElementById('meta-modal-back');
        const result = [];
        if (buyBtn) result.push(buyBtn);
        if (backBtn) result.push(backBtn);
        return result;
    }

    const upgradesMenu = document.getElementById('upgrades-menu');
    if (isVisible(upgradesMenu)) {
        const shopButtons = Array.from(document.querySelectorAll('#meta-shop .meta-item button'));
        const backBtn = document.getElementById('upgrades-back-btn');
        const result = [];
        if (shopButtons.length) {
            result.push(...shopButtons);
        }
        if (backBtn) {
            result.push(backBtn);
        }
        return result.length ? result : (backBtn ? [backBtn] : []);
    }

    // Check for run upgrades screen (pause menu upgrades display)
    const runUpgradesScreen = document.getElementById('run-upgrades-screen');
    if (isVisible(runUpgradesScreen)) {
        const backBtn = document.getElementById('run-upgrades-back-btn');
        return backBtn ? [backBtn] : [];
    }

    // Check for debug menu
    const debugMenu = document.getElementById('debug-menu');
    if (isVisible(debugMenu)) {
        const backBtn = document.getElementById('debug-back-btn');
        const tierButtons = Array.from(document.querySelectorAll('.debug-tier-btn'));
        return backBtn ? [backBtn, ...tierButtons] : tierButtons;
    }

    const levelupScreen = document.getElementById('levelup-screen');
    if (isVisible(levelupScreen)) {
        // Include reroll button first, then upgrade cards
        const elements = [];
        const rerollBtn = document.getElementById('reroll-btn');
        if (rerollBtn) {
            elements.push(rerollBtn);
        }
        const cards = Array.from(document.querySelectorAll('.upgrade-card'));
        return elements.concat(cards);
    }

    // Check settings menu first - it should take priority over pause menu when visible
    const settingsMenu = document.getElementById('settings-menu');
    if (isVisible(settingsMenu)) {
        // Get interactive elements: select, checkboxes, sliders, and buttons
        const elements = [];

        // Add resolution select
        const resSelect = document.getElementById('res-select');
        if (resSelect) {
            elements.push(resSelect);
        }

        // Add checkboxes (fullscreen, vsync, frameless)
        const fullscreenCheck = document.getElementById('fullscreen-check');
        if (fullscreenCheck) {
            elements.push(fullscreenCheck);
        }
        const vsyncCheck = document.getElementById('vsync-check');
        if (vsyncCheck) {
            elements.push(vsyncCheck);
        }
        const framelessCheck = document.getElementById('frameless-check');
        if (framelessCheck) {
            elements.push(framelessCheck);
        }

        // Add volume sliders
        const musicVolume = document.getElementById('music-volume');
        const sfxVolume = document.getElementById('sfx-volume');
        if (musicVolume) {
            elements.push(musicVolume);
        }
        if (sfxVolume) {
            elements.push(sfxVolume);
        }

        // Add buttons
        const settingsCloseBtn = document.getElementById('settings-close-btn');
        const settingsApplyBtn = document.getElementById('settings-apply-btn');
        if (settingsCloseBtn) {
            elements.push(settingsCloseBtn);
        }
        if (settingsApplyBtn) {
            elements.push(settingsApplyBtn);
        }

        return elements;
    }

    // Save menu (profile selection) - check before pause menu
    const saveMenu = document.getElementById('save-menu');
    if (isVisible(saveMenu)) {
        // Get profile items first (the cards that are clickable), then action buttons
        const profileItems = Array.from(document.querySelectorAll('.profile-item'));
        const actionButtons = Array.from(document.querySelectorAll('#save-menu button'));
        // Combine: profile items first, then buttons
        return [...profileItems, ...actionButtons];
    }

    // Abort confirmation modal - highest priority when visible
    const abortModal = document.getElementById('abort-modal');
    if (isVisible(abortModal)) {
        return Array.from(document.querySelectorAll('#abort-modal button'));
    }

    // Rename prompt modal
    const renameModal = document.getElementById('rename-prompt-modal');
    if (isVisible(renameModal)) {
        return Array.from(document.querySelectorAll('#rename-prompt-modal button'));
    }

    const pauseMenu = document.getElementById('pause-menu');
    if (isVisible(pauseMenu)) {
        return Array.from(document.querySelectorAll('#pause-menu button'));
    }

    const startScreen = document.getElementById('start-screen');
    if (isVisible(startScreen)) {
        return Array.from(document.querySelectorAll('#start-screen button'));
    }

    return [];
}

function updateMenuVisuals(elements) {
    elements.forEach((el, idx) => {
        if (idx === GameContext.menuSelectionIndex) {
            el.classList.add('selected');
            // Support focus for all interactive elements, not just buttons
            if (typeof el.focus === 'function') {
                el.focus();
            }
            // For shop buttons, also highlight the parent meta-item and scroll into view
            if (el.tagName === 'BUTTON') {
                const metaItem = el.closest('.meta-item');
                if (metaItem) {
                    metaItem.classList.add('selected');
                    // Scroll the selected item into view
                    metaItem.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            }
            // For profile items, scroll into view when selected
            if (el.classList.contains('profile-item')) {
                el.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            }
        } else {
            el.classList.remove('selected');
            if (typeof el.blur === 'function') {
                el.blur();
            }
            // For shop buttons, also remove highlight from parent meta-item
            if (el.tagName === 'BUTTON') {
                const metaItem = el.closest('.meta-item');
                if (metaItem) {
                    metaItem.classList.remove('selected');
                }
            }
        }
    });
}

registerMetaShopNavigationHandlers({
    getActiveMenuElements,
    updateMenuVisuals,
    getGpState: () => gpState
});

registerUpgradeHandlers({
    playSound,
    showOverlayMessage,
    updateHealthUI,
    updateTurboUI,
    updateNuggetUI,
    getActiveMenuElements,
    updateMenuVisuals,
    startMusic,
    isMusicEnabled: () => musicEnabled,
    saveMetaProfile: saveMetaProfileSystem,
    getGameNowMs,
    setSimAccMs: (value) => { simAccMs = value; },
    setSimLastPerfAt: (value) => { simLastPerfAt = value; },
    setSuppressWarpGateUntil: (value) => { suppressWarpGateUntil = value; },
    setSuppressWarpInputUntil: (value) => { suppressWarpInputUntil = value; },
    spawnDrone
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
    showLevelUpMenuSystem,
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

function mainLoop() {
    const perfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    globalProfiler.update();
    animationId = requestAnimationFrame(mainLoop);
    // FPS counter (render-only).
    if (fpsCounterEl) {
        const shouldShow = !!GameContext.gameActive;
        if (fpsUiVisible !== shouldShow) {
            fpsCounterEl.style.display = shouldShow ? 'block' : 'none';
            fpsUiVisible = shouldShow;
        }

        const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.min(250, t - fpsLastFrameAt));
        fpsLastFrameAt = t;
        fpsSmoothMs = fpsSmoothMs * 0.9 + dt * 0.1;

        if (shouldShow && t >= fpsNextUiAt) {
            const fps = fpsSmoothMs > 0 ? (1000 / fpsSmoothMs) : 0;
            fpsCounterEl.textContent = `FPS ${fps.toFixed(0)}  ${fpsSmoothMs.toFixed(1)}ms`;
            fpsNextUiAt = t + 250;
        }
    }
    updateGamepad();
    if (GameContext.gameActive && !GameContext.gamePaused) {
        // Variable timestep simulation; update and render at display refresh rate.
        const frameStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        if (!simLastPerfAt) {
            console.log('[RESUME] First frame after resume - simLastPerfAt was 0, initializing');
            simLastPerfAt = frameStart;
            // Only init simNowMs if it's 0 (first run or reset), otherwise preserve it (resume)
            if (!simNowMs) simNowMs = Date.now();
            simAccMs = 0;
        }
        let frameDt = frameStart - simLastPerfAt;
        simLastPerfAt = frameStart;
        if (!isFinite(frameDt) || frameDt < 0) frameDt = 0;

        // Record frame time for jitter monitoring
        globalJitterMonitor.recordFrame(frameDt);

        // Drop extremely large frame times (pause/background) but allow high refresh rates
        // 100ms = 10fps minimum
        frameDt = Math.min(100, frameDt);

        // Update simulation time
        simNowMs += frameDt;

        // Fixed timestep with interpolation
        // Accumulate time and run physics at fixed SIM_STEP_MS (16.67ms = 60fps)
        simAccMs += frameDt;

        // Run physics updates at fixed timestep
        let steps = 0;
        const STEP = SIM_STEP_MS;
        while (simAccMs >= STEP && steps < SIM_MAX_STEPS_PER_FRAME) {
            const originalDateNow = Date.now;
            Date.now = () => Math.floor(simNowMs - (simAccMs - STEP));
            gameLoopLogic({ doUpdate: true, doDraw: false, deltaTime: STEP });
            Date.now = originalDateNow;
            simAccMs -= STEP;
            steps++;
        }

        // Calculate render alpha (0-1) for interpolation between last two physics states
        // alpha = 0 means "at previous physics state", alpha = 1 means "at current physics state"
        const alpha = steps > 0 ? Math.min(1, simAccMs / STEP) : 1.0;

        // Render with interpolation
        const originalDateNow2 = Date.now;
        Date.now = () => Math.floor(simNowMs);
        gameLoopLogic({ doUpdate: false, doDraw: true, deltaTime: 0, alpha: alpha });
        Date.now = originalDateNow2;
    } else {
        // Reset timing so we don't "catch up" a large paused interval on resume.
        simLastPerfAt = 0;
        simAccMs = 0;
    }
}

function triggerFinalBattle() {
    console.log('[FINAL BATTLE] 30 minutes reached. Teleporting to warp level.');
    showOverlayMessage("TIME LIMIT REACHED - PREPARE FOR FINAL BATTLE", '#f00', 5000, 5);
    playSound('warp_scream');

    // Teleport to warp level after a short delay
    setTimeout(() => {
        if (!GameContext.gameActive || !GameContext.player || GameContext.player.dead) return;
        enterWarpMaze();
    }, 3000);
}

function gameLoopLogic(opts = null) {
    globalProfiler.start('GameLoopLogic');

    // Safety: deactivate station arena if station gone
    if (GameContext.stationArena.active && (!GameContext.spaceStation || GameContext.spaceStation.dead)) {
        GameContext.stationArena.active = false;
    }
    const doDraw = !(opts && opts.doDraw === false);
    const doUpdate = !(opts && opts.doUpdate === false);
    const deltaTime = (opts && opts.deltaTime) || SIM_STEP_MS; // Default to 60fps step for backwards compatibility
    // Update global render interpolation alpha from opts (used by draw methods for smooth rendering)
    if (opts && typeof opts.alpha === 'number') {
        renderAlpha = opts.alpha;
    } else {
        renderAlpha = 1.0;
    }

    // Update pixi-context render alpha for extracted entity classes
    setRenderAlpha(renderAlpha);

    if (!GameContext.player) return;

    const now = Date.now();
    GameContext.frameNow = now;
    const warpActive = !!(GameContext.warpZone && GameContext.warpZone.active);

    if (doUpdate) {
        globalProfiler.start('Update');
        globalProfiler.start('GameLogic');
        // Safe clears after a station destruction to avoid mid-loop mutation
        if (GameContext.pendingTransitionClear) {
            resetPixiOverlaySprites();
            clearArrayWithPixiCleanup(GameContext.enemies);
            clearArrayWithPixiCleanup(GameContext.pinwheels);
            clearArrayWithPixiCleanup(GameContext.bullets);
            clearArrayWithPixiCleanup(GameContext.bossBombs);
            clearArrayWithPixiCleanup(GameContext.floatingTexts);
            GameContext.bossActive = false;
            if (GameContext.boss) pixiCleanupObject(GameContext.boss);
            GameContext.boss = null;
            GameContext.bossArena.active = false;
            GameContext.roamerRespawnQueue = [];
            GameContext.baseRespawnTimers = [];
            GameContext.pendingTransitionClear = false;
            GameContext.gunboatRespawnAt = null;
        }
        // Delay the first wave to give the player breathing room (not used in cave mode) 
        if (!GameContext.caveMode && !GameContext.initialSpawnDone && GameContext.initialSpawnDelayAt && now >= GameContext.initialSpawnDelayAt) {
            GameContext.initialSpawnDone = true;
            GameContext.initialSpawnDelayAt = null;
            showOverlayMessage("ENEMIES DETECTED", '#f00', 2000);
            GameContext.maxRoamers = 3;
            for (let i = 0; i < 2; i++) {
                const start = findSpawnPointRelative(true, 1200);
                GameContext.enemies.push(new Enemy('roamer', start));
            }
            for (let i = 0; i < 1; i++) spawnNewPinwheelRelative(true);
        }
        // Update HUD timer (exclude paused time)
        try {
            const tEl = document.getElementById('game-timer');
            if (tEl && GameContext.gameStartTime) {
                let elapsed = now - GameContext.gameStartTime - GameContext.pausedAccumMs;
                if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - GameContext.pausedAccumMs;
                if (elapsed < 0) elapsed = 0;
                tEl.innerText = formatTime(elapsed);

                // Final battle teleport at 30 minutes (GAME_DURATION_MS)
                if (!GameContext.gameEnded && elapsed >= GAME_DURATION_MS && !warpActive && !GameContext.bossActive && !GameContext.sectorTransitionActive) {
                    triggerFinalBattle();
                    return;
                }
            }
        } catch (e) { console.warn('timer update failed', e); }

        if (GameContext.player && now >= posUiNextAt) {
            const posEl = document.getElementById('pos-debug');
            if (posEl) {
                posEl.innerText = `POS: ${Math.round(GameContext.player.pos.x)}, ${Math.round(GameContext.player.pos.y)}`;
                posUiNextAt = now + 100;
            }
        }

        // Sector transition countdown
        if (GameContext.sectorTransitionActive && GameContext.warpCountdownAt) {
            const remainingMs = Math.max(0, GameContext.warpCountdownAt - now);
            overlayMessage.style.display = 'block';
            overlayMessage.innerText = `WARPING TO NEW SECTOR IN ${Math.ceil(remainingMs / 1000)}s`;
            overlayMessage.style.color = '#0ff';
            if (remainingMs <= 0) {
                completeSectorWarp();
            }
        }

        // World warp gate (appears after space station is destroyed, once per sector).
        if (!warpActive && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && !GameContext.warpCompletedOnce && !GameContext.caveMode && !GameContext.spaceStation && GameContext.warpGateUnlocked) {
            if (!GameContext.warpGate || GameContext.warpGate.mode !== 'entry') {
                const gx = GameContext.player.pos.x + 900;
                const gy = GameContext.player.pos.y;
                GameContext.warpGate = new WarpGate(gx, gy);
                showOverlayMessage("WARP GATE OPEN", '#f80', 1600);
            }
        } else {
            if (GameContext.warpGate && GameContext.warpGate.mode === 'entry') {
                pixiCleanupObject(GameContext.warpGate);
                GameContext.warpGate = null;
            }
        }

        updateContractSystem(now, warpActive);

        // Pause the cruiser timer while the player is inside (or very near) an anomaly. 
        // (Warp-zone pausing is handled via the warp snapshot so it doesn't count warp time.) 
        let inAnomaly = false;
        try {
            if (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.activeContract.id && GameContext.contractEntities && GameContext.contractEntities.anomalies && GameContext.player && !GameContext.player.dead) {
                const az = GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id);
                if (az) {
                    const d = Math.hypot(GameContext.player.pos.x - az.pos.x, GameContext.player.pos.y - az.pos.y);
                    // Use the same "anomaly vicinity" threshold as collision/bullet-wall checks. 
                    inAnomaly = d < (az.radius + 900);
                }
            }
        } catch (e) { }
        const inStationFight = !!(GameContext.stationArena.active && GameContext.spaceStation && !GameContext.spaceStation.dead);
        const inTractorBeam = !!(GameContext.destroyer && !GameContext.destroyer.dead && GameContext.destroyer.tractorBeamActive);
        const waitingForResume = (GameContext.cruiserTimerResumeAt > now);

        if (inAnomaly || inStationFight || inTractorBeam || waitingForResume) {
            if (GameContext.cruiserTimerPausedAt === null) GameContext.cruiserTimerPausedAt = now;
        } else if (GameContext.cruiserTimerPausedAt !== null) {
            const dt = Math.max(0, now - GameContext.cruiserTimerPausedAt);
            if (GameContext.dreadManager && GameContext.dreadManager.timerActive && typeof GameContext.dreadManager.timerAt === 'number') {
                GameContext.dreadManager.timerAt += dt;
            }
            GameContext.cruiserTimerPausedAt = null;
        }
        // Arena countdown: start 10 seconds before cruiser spawns
        try {
            if (!GameContext.sectorTransitionActive && !warpActive && !GameContext.caveMode && !inAnomaly && !inStationFight && !inTractorBeam && !waitingForResume && GameContext.dreadManager.timerActive && !GameContext.bossActive && GameContext.dreadManager.timerAt) {
                const remainingMs = GameContext.dreadManager.timerAt - now;
                if (remainingMs <= 10000 && remainingMs > 0) {
                    if (!isArenaCountdownActive()) {
                        startArenaCountdown();
                    }
                    const remainingSecs = Math.ceil(remainingMs / 1000);
                    if (remainingSecs > 0 && remainingSecs <= 10) {
                        if (remainingSecs !== getArenaCountdownTimeLeft()) {
                            setArenaCountdownTimeLeft(remainingSecs);
                            updateArenaCountdownDisplay();
                        }
                    }
                } else {
                    if (isArenaCountdownActive()) {
                        stopArenaCountdown();
                    }
                }
            } else {
                if (isArenaCountdownActive()) {
                    stopArenaCountdown();
                }
            }
        } catch (e) { }
        // Cruiser timed spawn: if timer active and no boss present, spawn a cruiser 
        try {
            if (!GameContext.sectorTransitionActive && !warpActive && !GameContext.caveMode && !inAnomaly && !inStationFight && !inTractorBeam && !waitingForResume && GameContext.dreadManager.timerActive && !GameContext.bossActive && GameContext.dreadManager.timerAt && now >= GameContext.dreadManager.timerAt) {
                // Cruisers can spawn even if a station exists
                GameContext.cruiserEncounterCount++;
                // Arena boss fight: clear world threats; boss may call a few helpers.
                // REMOVED: Enemy/Base/Bullet clearing logic to allow them inside arena
                /*
                if (destroyer) {
                    const idx = enemies.indexOf(destroyer);
                    if (idx !== -1) enemies.splice(idx, 1);
                }
                clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
    baseRespawnTimers = [];
                roamerRespawnQueue = [];
                // Clear all bullets to prevent immediate cruiser death
                clearArrayWithPixiCleanup(bullets);
                clearArrayWithPixiCleanup(bossBombs);
                clearArrayWithPixiCleanup(guidedMissiles);
                */
                GameContext.boss = new Cruiser(GameContext.cruiserEncounterCount);
                GameContext.bossActive = true;
                GameContext.bossArena.x = (GameContext.player.pos.x + GameContext.boss.pos.x) / 2;
                GameContext.bossArena.y = (GameContext.player.pos.y + GameContext.boss.pos.y) / 2;
                GameContext.bossArena.radius = 2500;
                GameContext.bossArena.active = true;
                GameContext.bossArena.growing = false;
                // Keep arena fights clean
                GameContext.radiationStorm = null;
                scheduleNextRadiationStorm(Date.now() + 60000);
                clearMiniEvent();
                scheduleNextMiniEvent(Date.now() + 90000);
                GameContext.dreadManager.timerActive = false;
                GameContext.dreadManager.firstSpawnDone = true;
                showOverlayMessage("WARNING: CRUISER APPROACHING - ARENA LOCKED", '#f00', 4000);
                playSound('boss_spawn');
                if (musicEnabled) setMusicMode('cruiser');
            }
        } catch (e) { console.warn('cruiser spawn check failed', e); }

        // Space Station Spawn (timer-driven)
        if (!GameContext.sectorTransitionActive && !warpActive && !GameContext.caveMode && !GameContext.spaceStation && GameContext.pendingStations > 0 && GameContext.nextSpaceStationTime && now >= GameContext.nextSpaceStationTime) {
            GameContext.spaceStation = new SpaceStation();
            GameContext.pendingStations--;
            GameContext.stationArena.x = GameContext.spaceStation.pos.x;
            GameContext.stationArena.y = GameContext.spaceStation.pos.y;
            GameContext.stationArena.radius = 2800;
            GameContext.stationArena.active = false;
            showOverlayMessage("SPACE STATION SPAWNED - DESTROY THE BARRIER?", '#f80', 5000);
            playSound('station_spawn');
            GameContext.nextSpaceStationTime = null;
        }

        // Gunboat respawn (one at a time)
        if (!warpActive && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.gameActive && !GameContext.gamePaused && GameContext.initialSpawnDone) {
            const gunboatAlive = GameContext.enemies.some(e => e.isGunboat);
            const level2Alive = GameContext.enemies.some(e => e.isGunboat && e.gunboatLevel === 2);
            const level1Alive = GameContext.enemies.some(e => e.isGunboat && e.gunboatLevel === 1);
            if (GameContext.gunboatRespawnAt && now >= GameContext.gunboatRespawnAt) {
                // Spawn rules: before warp, only level 1, one at a time. After warp, allow one level 1 and one level 2 simultaneously.
                if (!GameContext.gunboatLevel2Unlocked) {
                    if (!level1Alive) GameContext.enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 1 }));
                    GameContext.gunboatRespawnAt = null;
                } else {
                    if (!level1Alive) {
                        GameContext.enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 1 })); // level decided in constructor
                    } else if (!level2Alive) {
                        GameContext.enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 2 }));
                    }
                    GameContext.gunboatRespawnAt = null;
                }
            }
            if (!GameContext.gunboatRespawnAt) {
                // Only set a timer if we need more according to rules
                if (!GameContext.gunboatLevel2Unlocked) {
                    if (!level1Alive) GameContext.gunboatRespawnAt = now + 20000;
                } else {
                    if (!level1Alive || !level2Alive) GameContext.gunboatRespawnAt = now + 20000;
                }
            }
        }

        // Single destroyer system: only 1 destroyer at a time, alternates between type 1 and 2
        // Destroyers never spawn in sector 2 (cave mode) or in dungeon1
        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && GameContext.sectorIndex !== 2 && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.gameActive && !GameContext.gamePaused && GameContext.initialSpawnDone && !GameContext.warpCompletedOnce) {
            const destroyerAlive = GameContext.destroyer && !GameContext.destroyer.dead;

            if (!destroyerAlive) {
                if (GameContext.destroyer && GameContext.destroyer.dead && GameContext.nextDestroyerSpawnTime && now >= GameContext.nextDestroyerSpawnTime) {
                    // Spawn alternate destroyer type
                    GameContext.destroyer = (GameContext.currentDestroyerType === 1) ? new Destroyer() : new Destroyer2();
                    GameContext.nextDestroyerSpawnTime = null;
                    const typeName = (GameContext.currentDestroyerType === 1) ? "DESTROYER" : "DESTROYER II";
                    showOverlayMessage(`NEW ${typeName} DETECTED`, '#f80', 3000);
                    playSound('boss_spawn');
                } else if (!GameContext.nextDestroyerSpawnTime && GameContext.initialSpawnDone && now - GameContext.gameStartTime - GameContext.pausedAccumMs > 30000) {
                    // First spawn - start with Destroyer type 1
                    GameContext.currentDestroyerType = 1;
                    GameContext.destroyer = new Destroyer();
                    GameContext.nextDestroyerSpawnTime = null;
                    showOverlayMessage("DESTROYER DETECTED", '#f80', 3000);
                    playSound('boss_spawn');
                }
            }
        }

        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && !GameContext.bossActive && Date.now() > GameContext.nextShootingStarTime) {
            // Fire a meteor shower: 10 comets from different directions, 1s apart
            for (let i = 0; i < 10; i++) {
                const delay = i * 1000;
                setTimeout(() => {
                    GameContext.shootingStars.push(new ShootingStar());
                }, delay);
            }
            scheduleNextShootingStar();
            showOverlayMessage("WARNING: COSMIC EVENT DETECTED", '#fa0', 3000);
        }

        // Risk zones: Radiation Storms
        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.gameActive && !GameContext.gamePaused && GameContext.initialSpawnDone) {
            if (GameContext.radiationStorm && GameContext.radiationStorm.dead) GameContext.radiationStorm = null;
            if ((!GameContext.radiationStorm || GameContext.radiationStorm.dead) && GameContext.nextRadiationStormAt && now >= GameContext.nextRadiationStormAt) {
                spawnRadiationStormRelative();
                scheduleNextRadiationStorm(now);
            }
        }

        // Mini-events
        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.gameActive && !GameContext.gamePaused && GameContext.initialSpawnDone) {
            if (GameContext.miniEvent && GameContext.miniEvent.dead) clearMiniEvent();
            if (!GameContext.miniEvent && GameContext.nextMiniEventAt && now >= GameContext.nextMiniEventAt) {
                spawnMiniEventRelative();
                scheduleNextMiniEvent(now);
            }
        }

        // Intensity breaks to let players collect/reposition
        if (!warpActive && !GameContext.sectorTransitionActive && !GameContext.gamePaused && GameContext.gameActive) {
            if (!GameContext.intensityBreakActive && now >= GameContext.nextIntensityBreakAt) {
                GameContext.intensityBreakActive = true;
                GameContext.nextIntensityBreakAt = now + INTENSITY_BREAK_DURATION + 90000; // after break, schedule next in ~90s
            }
            if (GameContext.intensityBreakActive && now >= GameContext.nextIntensityBreakAt - (INTENSITY_BREAK_DURATION)) {
                // during break, stop new roamer spawns
            }
            if (GameContext.intensityBreakActive && now >= GameContext.nextIntensityBreakAt) {
                GameContext.intensityBreakActive = false;
            }
        }

        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.initialSpawnDone) {
            // Time-based pacing for roamer count and strength 
            let elapsed = now - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;

            const baseRoamers = 6;
            GameContext.maxRoamers = 15;
            const rampMinutes = 28; // slower ramp
            const rampT = Math.min(1, elapsedMinutes / rampMinutes);
            const difficultyBonus = Math.max(0, (GameContext.difficultyTier + GameContext.player.level * 0.1) - 1) * 0.3;
            const earlyEnemyFactor = (elapsedMinutes < 4) ? 0.75 : 1.0;
            const targetRoamers = Math.floor((baseRoamers + (GameContext.maxRoamers - baseRoamers) * rampT + difficultyBonus) * earlyEnemyFactor);

            const currentRoamers = GameContext.enemies.filter(e => e.type === 'roamer' || e.type === 'elite_roamer' || e.type === 'hunter').length;
            if (!GameContext.intensityBreakActive && currentRoamers + GameContext.roamerRespawnQueue.length < targetRoamers) {
                // 3000ms delay between new spawns to refill population slower
                GameContext.roamerRespawnQueue.push(3000);
            }

            const eliteUnlocked = elapsedMinutes >= 5 || GameContext.difficultyTier >= 3 || GameContext.player.level >= 4;
            const hunterUnlocked = elapsedMinutes >= 11 || GameContext.difficultyTier >= 5 || GameContext.player.level >= 7;
            // Keep elites/hunters rare and capped
            const eliteChance = eliteUnlocked ? Math.min(0.25, 0.08 + (elapsedMinutes / 25) * 0.2) : 0;
            const hunterChance = hunterUnlocked ? Math.min(0.15, 0.05 + (elapsedMinutes / 35) * 0.12) : 0;
            const eliteSoftCap = 3;
            const hunterSoftCap = 3;

            for (let i = GameContext.roamerRespawnQueue.length - 1; i >= 0; i--) {
                GameContext.roamerRespawnQueue[i] -= deltaTime;
                if (GameContext.roamerRespawnQueue[i] <= 0) {
                    GameContext.roamerRespawnQueue.splice(i, 1);
                    let type = 'roamer';
                    const currentElite = GameContext.enemies.filter(e => e.type === 'elite_roamer').length;
                    const currentHunter = GameContext.enemies.filter(e => e.type === 'hunter').length;
                    if (eliteUnlocked && currentElite < eliteSoftCap && Math.random() < eliteChance) {
                        type = 'elite_roamer';
                        if (hunterUnlocked && currentHunter < hunterSoftCap && Math.random() < hunterChance) {
                            type = 'hunter';
                        }
                    }
                    GameContext.enemies.push(new Enemy(type));
                }
            }
        } else {
            GameContext.roamerRespawnQueue = [];
        }

        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active) {
            while (GameContext.environmentAsteroids.length < 100) spawnOneAsteroidRelative();
        } else if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
            // Keep asteroids present but not overwhelming inside the cave.
            let tries = 0;
            while (GameContext.environmentAsteroids.length < 75 && tries < 300) {
                spawnOneAsteroidRelative(false);
                tries++;
            }
        } else if (GameContext.warpZone && GameContext.warpZone.active) {
            let tries = 0;
            while (GameContext.environmentAsteroids.length < 50 && tries < 300) {
                if (!spawnOneWarpAsteroidRelative(false)) break;
                tries++;
            }
        } else if (GameContext.dungeon1Active && GameContext.dungeon1Zone && GameContext.dungeon1Zone.active) {
            // Spawn asteroids in dungeon1 for cover
            let tries = 0;
            while (GameContext.environmentAsteroids.length < 40 && tries < 300) {
                spawnOneAsteroidRelative(false);
                tries++;
            }
        }

        // Build Spatial Grid for this frame
        globalProfiler.end('GameLogic');
        globalProfiler.start('SpatialHash');
        GameContext.asteroidGrid.clear();
        for (let i = 0; i < GameContext.environmentAsteroids.length; i++) GameContext.asteroidGrid.insert(GameContext.environmentAsteroids[i]);

        GameContext.targetGrid.clear();
        for (let i = 0; i < GameContext.enemies.length; i++) GameContext.targetGrid.insert(GameContext.enemies[i]);
        for (let i = 0; i < GameContext.pinwheels.length; i++) GameContext.targetGrid.insert(GameContext.pinwheels[i]);
        for (let i = 0; i < GameContext.shootingStars.length; i++) GameContext.targetGrid.insert(GameContext.shootingStars[i]);
        if (GameContext.contractEntities) {
            if (GameContext.contractEntities.fortresses) {
                for (let i = 0; i < GameContext.contractEntities.fortresses.length; i++) GameContext.targetGrid.insert(GameContext.contractEntities.fortresses[i]);
            }
            if (GameContext.contractEntities.wallTurrets) {
                for (let i = 0; i < GameContext.contractEntities.wallTurrets.length; i++) GameContext.targetGrid.insert(GameContext.contractEntities.wallTurrets[i]);
            }
        }
        if (GameContext.warpZone && GameContext.warpZone.turrets) {
            for (let i = 0; i < GameContext.warpZone.turrets.length; i++) GameContext.targetGrid.insert(GameContext.warpZone.turrets[i]);
        }
        if (GameContext.boss && !GameContext.boss.dead) GameContext.targetGrid.insert(GameContext.boss);
        if (GameContext.destroyer && !GameContext.destroyer.dead) GameContext.targetGrid.insert(GameContext.destroyer);

        // Build bullet spatial hash for efficient collision detection
        rebuildBulletGrid(GameContext.bullets);
        globalProfiler.end('SpatialHash');
        globalProfiler.start('LevelLogic');

        if (!warpActive && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.initialSpawnDone) {
            // Ramp base count up over the first few minutes (start easier).
            let elapsed = now - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (GameContext.pauseStartTime) elapsed = GameContext.pauseStartTime - GameContext.gameStartTime - GameContext.pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;

            let targetBases = GameContext.caveMode ? 3 : 3;
            if (!GameContext.caveMode) {
                if (elapsedMinutes < 2) targetBases = 1;
                else if (elapsedMinutes < 5) targetBases = 2;
                else if (elapsedMinutes < 10) targetBases = 3;
                else targetBases = 4;
            }

            if (GameContext.pinwheels.length < targetBases) {
                if (GameContext.baseRespawnTimers.length === 0) spawnNewPinwheelRelative();
            }

            for (let i = GameContext.baseRespawnTimers.length - 1; i >= 0; i--) {
                if (now > GameContext.baseRespawnTimers[i]) {
                    if (GameContext.pinwheels.length < targetBases) {
                        spawnNewPinwheelRelative();
                        GameContext.baseRespawnTimers.splice(i, 1);
                    } else {
                        // Delay respawns until the current target count needs them.
                        GameContext.baseRespawnTimers[i] = now + 8000;
                    }
                }
            }
        }

        // Arena ring is now static; no shrinking/growing
    }

    const targetZoom = ZOOM_LEVEL * 0.85;
    if (doUpdate) {
        GameContext.currentZoom += (targetZoom - GameContext.currentZoom) * 0.08;
        if (Math.abs(GameContext.currentZoom - targetZoom) < 0.001) GameContext.currentZoom = targetZoom;
    }
    const zoom = GameContext.currentZoom;

    const alpha = (opts && opts.alpha !== undefined) ? opts.alpha : 1.0;
    renderAlpha = alpha; // Set global for entity draw methods
    const renderPos = GameContext.player.getRenderPos(alpha);
    // Camera always follows player - no arena locking
    let camX = renderPos.x - width / (2 * zoom);
    let camY = renderPos.y - height / (2 * zoom);
    if (GameContext.shakeTimer > 0) {
        if (doUpdate) {
            GameContext.shakeTimer -= deltaTime / 16.67;
            shakeOffsetX = (Math.random() - 0.5) * GameContext.shakeMagnitude * 2;
            shakeOffsetY = (Math.random() - 0.5) * GameContext.shakeMagnitude * 2;
            if (GameContext.shakeTimer <= 0) { shakeOffsetX = 0; shakeOffsetY = 0; }
        }
        // camX += shakeOffsetX;
        // camY += shakeOffsetY;
    } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
    }

    if (isNaN(camX)) camX = 0;
    if (isNaN(camY)) camY = 0;

    // Update view bounds for frustum culling (used throughout this frame)
    const viewW = width / zoom;
    const viewH = height / zoom;
    updateViewBounds(camX + viewW / 2, camY + viewH / 2, viewW, viewH);

    if (doDraw) {
        // Defensive reset: ensure no draw routine can permanently corrupt the main canvas state
        // (e.g. mismatched save/restore). This prevents "invisible world" after warp transitions.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        try { ctx.setLineDash([]); } catch (e) { }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        const caveActiveBg = (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active);
        if (pixiApp && pixiApp.renderer) {
            if (pixiApp.renderer.width !== width || pixiApp.renderer.height !== height) {
                pixiApp.renderer.resize(width, height);
            }
            if (pixiWorldRoot) {
                pixiWorldRoot.scale.set(zoom);
                // Align to pixel grid to reduce shimmer/brightness flicker from subpixel sampling.
                const px = -camX * zoom;
                const py = -camY * zoom;
                pixiWorldRoot.position.set(Math.round(px), Math.round(py));
            }
            if (pixiScreenRoot) {
                pixiScreenRoot.scale.set(1);
                pixiScreenRoot.position.set(0, 0);
                pixiScreenRoot.visible = true;
                // Enable Nebula/Stars in cave mode, disable grid
                if (pixiNebulaLayer) pixiNebulaLayer.visible = !!ENABLE_NEBULA;
                if (pixiStarTilingLayer) pixiStarTilingLayer.visible = true;
                if (pixiStarLayer) pixiStarLayer.visible = false; // legacy particle stars disabled
                updatePixiCaveGrid(camX, camY, zoom, false, width, height);
            }
        }

        // Draw Stars (always enabled)
        // if (!caveActiveBg) { // REMOVED: Enable stars in cave
        if (pixiScreenRoot && pixiStarLayer) {
            updatePixiBackground(camX, camY, width, height);
        } else {
            for (let s of GameContext.starfield) {
                let x = (s.x - camX * s.parallax) % width;
                let y = (s.y - camY * s.parallax) % height;
                if (x < 0) x += width;
                if (y < 0) y += height;

                ctx.fillStyle = s.fillStyle;
                ctx.fillRect(x, y, s.size, s.size);
            }
        }
        // }
    }

    if (doDraw) {
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-camX, -camY);
    }

    // Hoisted resource objects to prevent GC
    if (!window.cachedPickupRes) window.cachedPickupRes = { layer: null, textures: null, pool: null };
    window.cachedPickupRes.layer = pixiPickupLayer; window.cachedPickupRes.textures = pixiTextures; window.cachedPickupRes.pool = pixiPickupSpritePool;
    const pickupRes = window.cachedPickupRes;

    if (!window.cachedParticleRes) window.cachedParticleRes = { layer: null, whiteTexture: null, glowTexture: null, smokeTexture: null, warpTexture: null, pool: null };
    window.cachedParticleRes.layer = pixiParticleLayer;
    window.cachedParticleRes.whiteTexture = pixiTextureWhite;
    window.cachedParticleRes.glowTexture = pixiParticleGlowTexture;
    window.cachedParticleRes.smokeTexture = pixiParticleSmokeTexture;
    window.cachedParticleRes.warpTexture = pixiParticleWarpTexture;
    window.cachedParticleRes.pool = pixiParticleSpritePool;
    // One-time pool identity check
    const particleRes = window.cachedParticleRes;

    const caveActive = (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active);
    // Use local refs in case update() clears the global (prevents null deref on draw()).
    const wz = GameContext.warpZone;
    if (wz && wz.active) { if (doUpdate) wz.update(deltaTime); if (doDraw) wz.draw(ctx); }
    const wg = GameContext.warpGate;
    if (wg && !wg.dead) { if (doUpdate) wg.update(deltaTime); if (doDraw) wg.draw(ctx); }
    if (caveActive) { if (doUpdate) GameContext.caveLevel.update(deltaTime); }

    // Dungeon1 zone and gate
    const dz = GameContext.dungeon1Zone;
    if (dz && dz.active) { if (doUpdate) dz.update(deltaTime); if (doDraw) dz.draw(ctx); }
    const dg = GameContext.dungeon1Gate;
    if (dg && !dg.dead) { if (doUpdate) dg.update(deltaTime); if (doDraw) dg.draw(ctx); }

    // Cave: full-screen grid background (no stars). 
    if (doDraw && caveActive) {
        // Pixi: cached tiling grid; Canvas fallback only if Pixi is unavailable.
        // Disabled grid background for cave mode to match Level 1 style
        /*
        if (!(pixiCaveGridSprite && pixiApp && pixiApp.renderer)) {
            caveLevel.drawGridBackground(ctx, camX, camY, width, height, zoom);
        }
        */
        GameContext.caveLevel.drawFireWall(ctx, camX, camY, width, height, zoom);
    }

    if (doUpdate) globalProfiler.end('LevelLogic');
    // Asteroids should render behind everything else (drops, ships, UI).
    globalProfiler.start('Entities');
    GameContext.environmentAsteroids.forEach(a => { if (doUpdate) a.update(deltaTime); if (doDraw) a.draw(ctx); });

    GameContext.coins.forEach(c => {
        if (doUpdate) c.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(c.pos.x, c.pos.y, 50)) c.draw(ctx, pickupRes);
            else if (typeof c.cull === 'function') c.cull();
        }
    });
    GameContext.nuggets.forEach(n => {
        if (doUpdate) n.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(n.pos.x, n.pos.y, 50)) n.draw(ctx, pickupRes);
            else if (typeof n.cull === 'function') n.cull();
        }
    });
    GameContext.powerups.forEach(p => {
        if (doUpdate) p.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(p.pos.x, p.pos.y, 60)) p.draw(ctx, pickupRes);
            else if (typeof p.cull === 'function') p.cull();
        }
    });
    GameContext.shootingStars.forEach(s => { if (doUpdate) s.update(deltaTime); if (doDraw) s.draw(ctx); });
    GameContext.caches.forEach(c => { if (doUpdate) c.update(deltaTime); if (doDraw) c.draw(ctx, pickupRes); });
    GameContext.pois.forEach(p => { if (doUpdate) p.update(deltaTime); if (doDraw) p.draw(ctx); });
    if (GameContext.radiationStorm && !GameContext.radiationStorm.dead) { if (doUpdate) GameContext.radiationStorm.update(deltaTime); if (doDraw) GameContext.radiationStorm.draw(ctx); }
    if (GameContext.miniEvent && !GameContext.miniEvent.dead) { if (doUpdate) GameContext.miniEvent.update(deltaTime); if (doDraw) GameContext.miniEvent.draw(ctx); }
    GameContext.contractEntities.beacons.forEach(b => { if (doUpdate) b.update(deltaTime); if (doDraw) b.draw(ctx); });
    GameContext.contractEntities.gates.forEach(g => { if (doUpdate) g.update(deltaTime); if (doDraw) g.draw(ctx); });
    GameContext.contractEntities.anomalies.forEach(a => { if (doUpdate) a.update(deltaTime); if (doDraw) a.draw(ctx); });
    GameContext.contractEntities.fortresses.forEach(f => { if (doUpdate) f.update(deltaTime); if (doDraw) f.draw(ctx); });
    GameContext.contractEntities.wallTurrets.forEach(t => { if (doUpdate) t.update(deltaTime); if (doDraw) t.draw(ctx); });

    // Monster shield drones (from CaveMonster3)
    if (window.monsterDrones && window.monsterDrones.length > 0) {
        for (let i = window.monsterDrones.length - 1; i >= 0; i--) {
            const drone = window.monsterDrones[i];
            if (!drone || drone.dead) {
                window.monsterDrones.splice(i, 1);
                continue;
            }
            if (doUpdate) drone.update(deltaTime);
            if (doDraw) drone.draw(ctx);
        }
    }

    // NOTE: we intentionally do not clip in cave mode; walls indicate the bounds. 

    if (doDraw && GameContext.bossArena.active) {
        ctx.save();
        ctx.translate(GameContext.bossArena.x, GameContext.bossArena.y);
        const pulse = 0.5 + Math.sin(now * 0.005) * 0.2;
        if (GameContext.bossArena.growing) ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
        else ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;

        ctx.lineWidth = 10;
        ctx.shadowBlur = 20;
        // ctx.shadowColor = bossArena.growing ? '#0ff' : '#f00';
        ctx.beginPath();
        ctx.arc(0, 0, GameContext.bossArena.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.1;
        // ctx.fillStyle = bossArena.growing ? '#055' : '#500';
        // ctx.fill();
        ctx.restore();
    }

    if (doDraw && GameContext.dungeon1Arena.active) {
        ctx.save();
        ctx.translate(GameContext.dungeon1Arena.x, GameContext.dungeon1Arena.y);
        const pulse = 0.5 + Math.sin(now * 0.005) * 0.2;
        ctx.strokeStyle = `rgba(255, 136, 0, ${pulse})`; // Orange/gold

        ctx.lineWidth = 10;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, GameContext.dungeon1Arena.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.1;
        ctx.restore();
    }

    if (doUpdate) GameContext.player.update(deltaTime);
    if (doDraw) {
        GameContext.player.drawLaser(ctx);
        const alpha = (opts && opts.alpha !== undefined) ? opts.alpha : 1.0;
        GameContext.player.draw(ctx, alpha);
    }

    // FloatingTexts - always update, cull drawing by view
    for (let i = 0, len = GameContext.floatingTexts.length; i < len; i++) {
        const t = GameContext.floatingTexts[i];
        if (doUpdate) t.update(deltaTime);
        if (doDraw && isInView(t.pos.x, t.pos.y)) t.draw(ctx, alpha);
    }

    // Drones - always close to player, no culling needed
    for (let i = 0, len = GameContext.drones.length; i < len; i++) {
        const d = GameContext.drones[i];
        if (doUpdate) d.update(deltaTime);
        if (doDraw) d.draw(ctx);
    }

    // Pinwheels - always update (can fire), cull drawing
    for (let i = 0, len = GameContext.pinwheels.length; i < len; i++) {
        const b = GameContext.pinwheels[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Enemies - always update (AI), cull drawing
    for (let i = 0, len = GameContext.enemies.length; i < len; i++) {
        const e = GameContext.enemies[i];
        if (doUpdate) e.update(deltaTime);
        if (doDraw && isInView(e.pos.x, e.pos.y)) e.draw(ctx);
    }

    if (GameContext.bossActive && GameContext.boss) {
        if (doUpdate) GameContext.boss.update(deltaTime);
        if (GameContext.boss.isWarpBoss) {
            GameContext.bossArena.x = GameContext.boss.pos.x;
            GameContext.bossArena.y = GameContext.boss.pos.y;
            GameContext.bossArena.radius = 4000;
            GameContext.bossArena.active = true;
            GameContext.bossArena.growing = false;
        }
        if (doDraw) GameContext.boss.draw(ctx);
    }

    if (GameContext.spaceStation) {
        if (doUpdate) GameContext.spaceStation.update(deltaTime);
        if (doDraw) GameContext.spaceStation.draw(ctx);

        // Update Station Health Bar (only update display when state changes)
        if (!GameContext.stationHealthBarVisible) {
            const sContainer = document.getElementById('station-health-container');
            if (sContainer) {
                sContainer.style.display = 'flex';
                GameContext.stationHealthBarVisible = true;
            }
        }
        const sFill = document.getElementById('station-health-fill');
        if (doDraw && sFill) {
            const pct = Math.max(0, (GameContext.spaceStation.hp / GameContext.spaceStation.maxHp) * 100);
            sFill.style.width = `${pct}%`;
        }
    } else {
        // Always hide the HP bar when spaceStation is null, regardless of flag state
        const sContainer = document.getElementById('station-health-container');
        if (sContainer) {
            sContainer.style.display = 'none';
        }
        GameContext.stationHealthBarVisible = false;
    }

    // Destroyer update and draw
    if (GameContext.destroyer) {
        if (doUpdate) GameContext.destroyer.update(deltaTime);
        if (doDraw && isInViewRadius(GameContext.destroyer.pos.x, GameContext.destroyer.pos.y, GameContext.destroyer.visualRadius)) GameContext.destroyer.draw(ctx);
    }

    // Bullets - always update (movement), cull drawing
    for (let i = 0, len = GameContext.bullets.length; i < len; i++) {
        const b = GameContext.bullets[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Boss bombs - always update, cull drawing
    for (let i = 0, len = GameContext.bossBombs.length; i < len; i++) {
        const b = GameContext.bossBombs[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Warp bio-pods - always update, cull drawing
    for (let i = 0, len = GameContext.warpBioPods.length; i < len; i++) {
        const p = GameContext.warpBioPods[i];
        if (doUpdate) p.update(deltaTime);
        if (doDraw && isInView(p.pos.x, p.pos.y)) p.draw(ctx);
    }

    // Guided missiles - always update (tracking), cull drawing
    for (let i = 0, len = GameContext.guidedMissiles.length; i < len; i++) {
        const m = GameContext.guidedMissiles[i];
        if (doUpdate) m.update(deltaTime);
        if (doDraw && isInView(m.pos.x, m.pos.y)) m.draw(ctx);
    }

    // Napalm zones - persistent damage zones (always update, cull drawing)
    for (let i = GameContext.napalmZones.length - 1; i >= 0; i--) {
        const z = GameContext.napalmZones[i];
        if (doUpdate) z.update(deltaTime);
        if (doDraw && isInView(z.pos.x, z.pos.y, z.radius + 50)) z.draw(ctx);
        if (z.dead) {
            GameContext.napalmZones.splice(i, 1);
        }
    }

    // Particles - always update, cull drawing (high volume)
    // Particles - always update, cull drawing (high volume)
    for (let i = 0, len = GameContext.particles.length; i < len; i++) {
        const p = GameContext.particles[i];
        try {
            if (doUpdate) p.update(deltaTime);
            if (doDraw) {
                if (isInView(p.pos.x, p.pos.y, 20)) p.draw(ctx, particleRes, alpha);
                else if (typeof p.cull === 'function') p.cull();
            }
        } catch (e) {
            // Particles are cheap, just kill on error
            p.life = 0;
        }
    }

    // Lightning Arcs - always update, cull drawing
    for (let i = 0, len = GameContext.lightningArcs.length; i < len; i++) {
        const arc = GameContext.lightningArcs[i];
        try {
            if (doUpdate) arc.update(deltaTime);
            if (doDraw) {
                // Lightning arcs are always visible even if slightly off-screen
                // Use pixiVectorLayer for drawing
                arc.draw(ctx, { vectorLayer: pixiVectorLayer }, alpha);
            }
            // Kill dead arcs and cleanup their graphics
            if (arc.dead) {
                if (typeof arc.kill === 'function') arc.kill();
            }
        } catch (e) {
            console.error('[LIGHTNING ARC ERROR]', e);
            arc.dead = true;
            if (typeof arc.kill === 'function') arc.kill();
        }
    }

    // Staggered bomb explosions - process queued explosions over multiple frames
    // This prevents sprite pool exhaustion and frame spikes when boss dies
    if (doUpdate) {
        processStaggeredBombExplosions();
        processStaggeredParticleBursts();
        processLightningEffects();
    }

    // Explosions - always update, cull drawing
    // Explosions are always updated and cleaned up even if off-screen
    for (let i = 0, len = GameContext.explosions.length; i < len; i++) {
        const ex = GameContext.explosions[i];
        try {
            if (doUpdate) ex.update();
            if (doDraw && isInView(ex.pos.x, ex.pos.y)) {
                ex.draw(ctx, particleRes, alpha);
            }
            // Always cleanup dead explosions to release sprites back to pool
            // This fixes a bug where sprites accumulated when explosions died while in view
            if (ex.dead && !ex.cleaned && particleRes && particleRes.pool) {
                ex.cleanup(particleRes);
            }
        } catch (e) {
            console.error('[EXPLOSION ERROR]', e);
            ex.dead = true;
            if (typeof ex.cleanup === 'function') ex.cleanup(particleRes);
            else if (typeof pixiCleanupObject === 'function') pixiCleanupObject(ex);
        }
    }

    for (let i = 0; i < GameContext.warpParticles.length; i++) {
        const p = GameContext.warpParticles[i];
        if (doUpdate) p.update();
        if (doDraw) p.draw(ctx, null, alpha);
    }
    if (doUpdate) compactArray(GameContext.warpParticles);

    for (let i = 0; i < GameContext.shockwaves.length; i++) {
        const s = GameContext.shockwaves[i];
        try {
            if (doUpdate) s.update();
            if (doDraw) s.draw(ctx);
        } catch (e) {
            console.error('[SHOCKWAVE ERROR]', e);
            s.dead = true; // Kill corrupted shockwave
        }
    }
    if (doUpdate) compactArray(GameContext.shockwaves);

    globalProfiler.end('Entities');

    // [MOVED] Pixi overlay render moved to end of Draw block


    if (doUpdate) {
        globalProfiler.start('Cleanup');

        // Process staggered cleanup queue (spreads cleanup across frames)
        globalStaggeredCleanup.process();

        // Use immediate cleanup for critical arrays that need per-frame compacting
        // Use staggered cleanup for large arrays that can wait
        immediateCompactArray(GameContext.bullets, (b) => {
            if (b._poolType === 'bullet' && b.sprite && pixiBulletSpritePool) destroyBulletSprite(b);
            else pixiCleanupObject(b);
        });
        immediateCompactArray(GameContext.bossBombs);
        immediateCompactArray(GameContext.warpBioPods, pixiCleanupObject);
        immediateCompactArray(GameContext.guidedMissiles, (m) => {
            if (m && m.dead && typeof m.explode === 'function' && !m._exploded) {
                m.explode('#ff0');
            }
            pixiCleanupObject(m);
        });
        immediateCompactArray(GameContext.enemies, pixiCleanupObject);
        immediateCompactArray(GameContext.pinwheels, pixiCleanupObject);
        immediateCompactArray(GameContext.environmentAsteroids, pixiCleanupObject);

        // Explosion cleanup with safety check for uncleaned sprites
        for (let i = GameContext.explosions.length - 1; i >= 0; i--) {
            const ex = GameContext.explosions[i];
            if (ex && ex.dead && !ex.cleaned && particleRes && particleRes.pool) {
                // Force cleanup of dead explosions that weren't cleaned during draw
                ex.cleanup(particleRes);
            }
        }
        immediateCompactArray(GameContext.explosions);

        immediateCompactArray(GameContext.floatingTexts);
        immediateCompactArray(GameContext.coins);

        // Safety: Force cleanup of dead pickups that didn't clean themselves
        for (let i = GameContext.coins.length - 1; i >= 0; i--) {
            const coin = GameContext.coins[i];
            if (coin && coin.dead && coin.sprite) {
                coin.kill();
            }
        }

        immediateCompactArray(GameContext.nuggets);

        // Safety: Force cleanup of dead nuggets that didn't clean themselves
        for (let i = GameContext.nuggets.length - 1; i >= 0; i--) {
            const nugget = GameContext.nuggets[i];
            if (nugget && nugget.dead && nugget.sprite) {
                nugget.kill();
            }
        }

        immediateCompactArray(GameContext.powerups);

        // Safety: Force cleanup of dead pickups that didn't clean themselves
        for (let i = GameContext.powerups.length - 1; i >= 0; i--) {
            const powerup = GameContext.powerups[i];
            if (powerup && powerup.dead && powerup.sprite) {
                powerup.kill();
            }
        }

        compactParticles(GameContext.particles);
        immediateCompactArray(GameContext.lightningArcs, pixiCleanupObject);
        immediateCompactArray(GameContext.shootingStars, pixiCleanupObject);
        immediateCompactArray(GameContext.drones);

        // Safety: Force cleanup of dead caches that didn't clean themselves
        for (let i = GameContext.caches.length - 1; i >= 0; i--) {
            const cache = GameContext.caches[i];
            if (cache && cache.dead && cache.sprite) {
                if (typeof cache.kill === 'function') cache.kill();
            }
        }
        immediateCompactArray(GameContext.caches);
        immediateCompactArray(GameContext.pois, (poi) => { if (typeof poi.kill === 'function') poi.kill(); });
        immediateCompactArray(GameContext.contractEntities.beacons);
        immediateCompactArray(GameContext.contractEntities.gates);
        immediateCompactArray(GameContext.contractEntities.anomalies);
        immediateCompactArray(GameContext.contractEntities.fortresses);
        immediateCompactArray(GameContext.contractEntities.wallTurrets);

        globalProfiler.end('Cleanup');

        globalProfiler.start('EntityCollision');
        resolveEntityCollision();
        globalProfiler.end('EntityCollision');

        // Bullet Logic Loop
        globalProfiler.start('BulletLogic');
        setProjectileImpactSoundContext(true);
        try {
            for (let i = GameContext.bullets.length - 1; i >= 0; i--) {
                const b = GameContext.bullets[i];
                let hit = false;
                const astCol = checkBulletWallCollision(b);
                if (astCol) {
                    hit = true;
                    b.dead = true;
                    if (astCol.obj) {
                        astCol.obj.break();
                        spawnParticles(b.pos.x, b.pos.y, 8, '#aa8');
                        playSound('hit');
                    } else {
                        // Warp/anomaly line walls: bullets just fizzle.
                        const wallColor = (astCol.kind === 'anomaly_wall') ? '#0f0' : (astCol.kind === 'cave_wall' ? '#88f' : '#0ff');
                        spawnParticles(b.pos.x, b.pos.y, 6, wallColor);
                        playSound('hit');
                    }
                }

                if (!hit) {
                    if (b.isEnemy) {
                        if (!GameContext.player.dead && GameContext.player.invulnerable <= 0) {
                            const dx = b.pos.x - GameContext.player.pos.x;
                            const dy = b.pos.y - GameContext.player.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const dist = Math.sqrt(distSq); // Only calc sqrt if needed for specific range checks, but kept here for logic flow

                            if (!hit && GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.some(s => s > 0) &&
                                dist < GameContext.player.outerShieldRadius + b.radius * 1.5 && dist > GameContext.player.outerShieldRadius - b.radius * 2) {
                                let angle = Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) - GameContext.player.outerShieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const count = GameContext.player.outerShieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                if (GameContext.player.outerShieldSegments[segIndex] > 0) {
                                    const segmentHp = GameContext.player.outerShieldSegments[segIndex];
                                    if (b.damage > segmentHp) {
                                        // Penetrate: bullet breaks through with reduced damage
                                        GameContext.player.outerShieldSegments[segIndex] = 0;
                                        GameContext.player.shieldsDirty = true;
                                        b.damage -= segmentHp;
                                    } else {
                                        // Full absorb: shield stops bullet
                                        GameContext.player.outerShieldSegments[segIndex] -= b.damage;
                                        GameContext.player.shieldsDirty = true;
                                        hit = true;
                                        playSound('shield_hit');
                                        spawnParticles(b.pos.x, b.pos.y, 7, '#b0f');
                                    }
                                }
                            }
                            if (!hit && dist < GameContext.player.shieldRadius + b.radius * 1.5 && dist > GameContext.player.shieldRadius - b.radius * 2) {
                                let angle = Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) - GameContext.player.shieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const count = GameContext.player.shieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                if (GameContext.player.shieldSegments[segIndex] > 0) {
                                    const segmentHp = GameContext.player.shieldSegments[segIndex];
                                    if (b.damage > segmentHp) {
                                        // Penetrate: bullet breaks through with reduced damage
                                        GameContext.player.shieldSegments[segIndex] = 0;
                                        GameContext.player.shieldsDirty = true;
                                        b.damage -= segmentHp;
                                    } else {
                                        // Full absorb: shield stops bullet
                                        GameContext.player.shieldSegments[segIndex] -= b.damage;
                                        GameContext.player.shieldsDirty = true;
                                        hit = true;
                                        playSound('shield_hit');
                                        spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                                    }
                                }
                            }
                            const hitDist = GameContext.player.radius * 1.5 + b.radius * 1.5;
                            if (!hit && distSq < hitDist * hitDist) {
                                // Use directHitDamage if specified (for plasma mortar), otherwise use b.damage
                                const damage = b.directHitDamage !== undefined ? b.directHitDamage : b.damage;
                                GameContext.player.takeHit(damage, true); // Use ignoreShields=true as they were checked above
                                hit = true;
                            }
                        }
                    }
                    else {
                        for (let mi = 0, mlen = GameContext.guidedMissiles.length; mi < mlen; mi++) {
                            const m = GameContext.guidedMissiles[mi];
                            if (!m || m.dead) continue;
                            const dx = b.pos.x - m.pos.x;
                            const dy = b.pos.y - m.pos.y;
                            const hitRad = (m.radius || 0) + (b.radius || 0);
                            if (dx * dx + dy * dy < hitRad * hitRad) {
                                if (typeof m.takeHit === 'function') m.takeHit(b.damage);
                                else if (typeof m.explode === 'function') m.explode('#ff0');
                                else m.dead = true;
                                hit = true;
                                b.dead = true;
                                break;
                            }
                        }

                        if (hit) continue;
                        const nearby = GameContext.targetGrid.query(b.pos.x, b.pos.y, 250);
                        for (let e of nearby) {
                            if (e.dead) continue;
                            if (hit) break;

                            // Shooting Star (Comet) Logic
                            if (e instanceof ShootingStar) {
                                if (b.isEnemy) continue;
                                const dx = b.pos.x - e.pos.x;
                                const dy = b.pos.y - e.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const hitRadius = e.radius + b.radius;
                                if (distSq < hitRadius * hitRadius) {
                                    e.takeHit(b.damage);
                                    hit = true;
                                    b.dead = true;
                                    spawnParticles(b.pos.x, b.pos.y, 4, '#fff');
                                    break;
                                }
                            }
                            // Enemy Logic
                            if (e instanceof Enemy) {
                                // Skip boss entities - they have dedicated collision logic later
                                if (GameContext.bossActive && GameContext.boss && e === GameContext.boss) continue;

                                const dx = b.pos.x - e.pos.x;
                                const dy = b.pos.y - e.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const dist = Math.sqrt(distSq);

                                if (!b.ignoreShields && e.shieldSegments && e.shieldSegments.length > 0 && dist < e.shieldRadius + b.radius && dist > e.shieldRadius - 10) {
                                    const activeIdx = e.shieldSegments.findIndex(s => s > 0);
                                    if (activeIdx !== -1) {
                                        const segmentHp = e.shieldSegments[activeIdx];
                                        if (b.damage > segmentHp) {
                                            // Penetrate: bullet breaks through with reduced damage
                                            e.shieldSegments[activeIdx] = 0;
                                            e.shieldsDirty = true;
                                            b.damage -= segmentHp;
                                        } else {
                                            // Full absorb: shield stops bullet
                                            e.shieldSegments[activeIdx] = 0;
                                            e.shieldsDirty = true;
                                            hit = true;
                                            playSound('enemy_shield_hit');
                                            spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                        }
                                    }
                                }
                                if (!hit && !b.ignoreShields && e.innerShieldSegments && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + b.radius && dist > e.innerShieldRadius - 10) {
                                    const activeIdx = e.innerShieldSegments.findIndex(s => s > 0);
                                    if (activeIdx !== -1) {
                                        const segmentHp = e.innerShieldSegments[activeIdx];
                                        if (b.damage > segmentHp) {
                                            // Penetrate: bullet breaks through with reduced damage
                                            e.innerShieldSegments[activeIdx] = 0;
                                            e.shieldsDirty = true;
                                            b.damage -= segmentHp;
                                        } else {
                                            // Full absorb: shield stops bullet
                                            e.innerShieldSegments[activeIdx] -= b.damage;
                                            e.shieldsDirty = true;
                                            hit = true;
                                            playSound('enemy_shield_hit');
                                            spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                        }
                                    }
                                }

                                const hitRadius = e.radius + b.radius;
                                if (!hit && distSq < hitRadius * hitRadius) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(e.pos.x, e.pos.y, 3, '#fff');

                                    // Chain Lightning: arc to nearby enemies
                                    if (GameContext.player.chainLightningCount && GameContext.player.chainLightningCount > 0 && GameContext.player.chainLightningRange && !b.isEnemy) {
                                        let chainCount = GameContext.player.chainLightningCount;
                                        let chainSource = e;
                                        let chainTargets = new Set();
                                        chainTargets.add(e);

                                        for (let chain = 0; chain < chainCount; chain++) {
                                            let nearestTarget = null;
                                            let nearestDist = GameContext.player.chainLightningRange;

                                            for (let other of nearby) {
                                                if (other.dead) continue;
                                                if (!(other instanceof Enemy) && !(other instanceof Pinwheel)) continue;
                                                if (other === GameContext.boss) continue; // Skip boss
                                                if (chainTargets.has(other)) continue;

                                                const d = Math.hypot(other.pos.x - chainSource.pos.x, other.pos.y - chainSource.pos.y);
                                                if (d < nearestDist) {
                                                    nearestDist = d;
                                                    nearestTarget = other;
                                                }
                                            }

                                            if (nearestTarget) {
                                                // Deal chain damage (reduced with each hop)
                                                const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                                                if (nearestTarget === GameContext.destroyer) {
                                                    const hpBefore = nearestTarget.hp;
                                                    nearestTarget.hp -= chainDamage;
                                                    console.log(`[DESTROYER DEBUG] CHAIN LIGHTNING: ${chainDamage.toFixed(1)} damage | HP: ${hpBefore} -> ${nearestTarget.hp} | Chain: ${chain + 1}`);
                                                } else {
                                                    nearestTarget.hp -= chainDamage;
                                                }
                                                chainTargets.add(nearestTarget);

                                                // Visual lightning effect
                                                spawnLightningArc(chainSource.pos.x, chainSource.pos.y, nearestTarget.pos.x, nearestTarget.pos.y, '#0ff');
                                                spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, '#0ff');
                                                playSound('hit');

                                                if (nearestTarget.hp <= 0) {
                                                    nearestTarget.kill();
                                                    GameContext.score += 100;
                                                }

                                                chainSource = nearestTarget;
                                            } else {
                                                break; // No more targets in range
                                            }
                                        }
                                    }

                                    if (e.hp <= 0) {
                                        e.kill();
                                        GameContext.score += 100;
                                    }
                                    break;
                                }
                            }
                            // Wall Turret Logic (Contracts)
                            else if (e instanceof WallTurret) {
                                const wtDx = b.pos.x - e.pos.x;
                                const wtDy = b.pos.y - e.pos.y;
                                const wtHitRad = e.radius + b.radius;
                                if (wtDx * wtDx + wtDy * wtDy < wtHitRad * wtHitRad) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#ff8');
                                    if (e.hp <= 0) {
                                        if (typeof e.kill === 'function') e.kill();
                                        else e.dead = true;
                                    }
                                    break;
                                }
                            }
                            // Warp Turret Logic
                            else if (e instanceof WarpTurret) {
                                const wpDx = b.pos.x - e.pos.x;
                                const wpDy = b.pos.y - e.pos.y;
                                const wpHitRad = e.radius + b.radius;
                                if (wpDx * wpDx + wpDy * wpDy < wpHitRad * wpHitRad) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#0ff');
                                    if (e.hp <= 0) e.kill();
                                    break;
                                }
                            }
                            // Pinwheel Logic
                            else if (e instanceof Pinwheel) {
                                const dist = Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y);
                                if (!b.ignoreShields && dist < e.shieldRadius + 5 && dist > e.shieldRadius - 15) {
                                    let angle = Math.atan2(b.pos.y - e.pos.y, b.pos.x - e.pos.x) - e.shieldRotation;
                                    while (angle < 0) angle += Math.PI * 2;
                                    const segCount = e.shieldSegments.length;
                                    const segIndex = Math.floor((angle / (Math.PI * 2)) * segCount) % segCount;
                                    if (e.shieldSegments[segIndex] > 0) {
                                        const segmentHp = e.shieldSegments[segIndex];
                                        if (b.damage > segmentHp) {
                                            // Penetrate: bullet breaks through with reduced damage
                                            e.shieldSegments[segIndex] = 0;
                                            e.shieldsDirty = true;
                                            b.damage -= segmentHp;
                                            e.aggro = true;
                                        } else {
                                            // Full absorb: shield stops bullet
                                            e.shieldSegments[segIndex] -= b.damage;
                                            e.shieldsDirty = true;
                                            hit = true;
                                            playSound('enemy_shield_hit');
                                            if (e.shieldSegments[segIndex] === 0) spawnParticles(b.pos.x, b.pos.y, 8, '#0ff');
                                            else spawnParticles(b.pos.x, b.pos.y, 3, '#088');
                                            e.aggro = true;
                                            break;
                                        }
                                    }
                                }
                                if (!b.ignoreShields && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + 5 && dist > e.innerShieldRadius - 15) {
                                    let angle = Math.atan2(b.pos.y - e.pos.y, b.pos.x - e.pos.x) - e.innerShieldRotation;
                                    while (angle < 0) angle += Math.PI * 2;
                                    const count = e.innerShieldSegments.length;
                                    const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                    if (e.innerShieldSegments[segIndex] > 0) {
                                        const segmentHp = e.innerShieldSegments[segIndex];
                                        if (b.damage > segmentHp) {
                                            // Penetrate: bullet breaks through with reduced damage
                                            e.innerShieldSegments[segIndex] = 0;
                                            e.shieldsDirty = true;
                                            b.damage -= segmentHp;
                                            e.aggro = true;
                                        } else {
                                            // Full absorb: shield stops bullet
                                            e.innerShieldSegments[segIndex] -= b.damage;
                                            e.shieldsDirty = true;
                                            hit = true;
                                            playSound('shield_hit');
                                            if (e.innerShieldSegments[segIndex] === 0) spawnParticles(b.pos.x, b.pos.y, 8, '#f0f');
                                            else spawnParticles(b.pos.x, b.pos.y, 3, '#808');
                                            e.aggro = true;
                                            break;
                                        }
                                    }
                                }

                                if (dist < e.radius + b.radius) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    e.aggro = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');

                                    // Chain Lightning: arc to nearby enemies (same logic as for regular enemies)
                                    if (GameContext.player.chainLightningCount && GameContext.player.chainLightningCount > 0 && GameContext.player.chainLightningRange && !b.isEnemy) {
                                        let chainCount = GameContext.player.chainLightningCount;
                                        let chainSource = e;
                                        let chainTargets = new Set();
                                        chainTargets.add(e);

                                        for (let chain = 0; chain < chainCount; chain++) {
                                            let nearestTarget = null;
                                            let nearestDist = GameContext.player.chainLightningRange;

                                            for (let other of nearby) {
                                                if (other.dead) continue;
                                                if (!(other instanceof Enemy) && !(other instanceof Pinwheel)) continue;
                                                if (other === GameContext.boss) continue; // Skip boss
                                                if (chainTargets.has(other)) continue;

                                                const d = Math.hypot(other.pos.x - chainSource.pos.x, other.pos.y - chainSource.pos.y);
                                                if (d < nearestDist) {
                                                    nearestDist = d;
                                                    nearestTarget = other;
                                                }
                                            }

                                            if (nearestTarget) {
                                                // Deal chain damage (reduced with each hop)
                                                const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                                                nearestTarget.hp -= chainDamage;
                                                chainTargets.add(nearestTarget);

                                                // Visual lightning effect
                                                spawnLightningArc(chainSource.pos.x, chainSource.pos.y, nearestTarget.pos.x, nearestTarget.pos.y, '#0ff');
                                                spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, '#0ff');
                                                playSound('hit');

                                                if (nearestTarget.hp <= 0) {
                                                    nearestTarget.kill();
                                                    GameContext.score += 100;
                                                }

                                                chainSource = nearestTarget;
                                            } else {
                                                break; // No more targets in range
                                            }
                                        }
                                    }
                                    if (e.hp <= 0) {
                                        e.dead = true;
                                        playSound('base_explode');
                                        spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);

                                        // DROP COINS
                                        const caveActive = (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active);
                                        if (caveActive) {
                                            const gold = Math.floor((6 * 5) * 0.5);
                                            awardCoinsInstant(gold, { noSound: false, sound: 'coin', color: '#ff0' });
                                            const baseNugCount = 4 + Math.floor(Math.random() * 3);
                                            const nugCount = Math.max(1, Math.floor(baseNugCount * 0.5));
                                            if (typeof awardNugzInstant === 'function') awardNugzInstant(nugCount, { noSound: false, sound: 'coin', color: '#fa0' });
                                        } else {
                                            for (let i = 0; i < 6; i++) {
                                                GameContext.coins.push(new Coin(e.pos.x + (Math.random() - 0.5) * 50, e.pos.y + (Math.random() - 0.5) * 50, 5));
                                            }
                                            GameContext.nuggets.push(new SpaceNugget(e.pos.x, e.pos.y, 1));
                                        }

                                        GameContext.pinwheelsDestroyed++;
                                        GameContext.pinwheelsDestroyedTotal++;
                                        GameContext.difficultyTier = 1 + Math.floor(GameContext.pinwheelsDestroyedTotal / 6);
                                        GameContext.score += 1000;
                                        const bdDisplay = document.getElementById('bases-display');
                                        if (bdDisplay) bdDisplay.innerText = `${GameContext.pinwheelsDestroyedTotal}`;

                                        GameContext.enemies.forEach(en => { if (en.assignedBase === e) en.type = 'roamer'; });

                                        const delay = 5000 + Math.random() * 5000;
                                        GameContext.baseRespawnTimers.push(Date.now() + delay);
                                    }
                                    break;
                                }
                            }
                        }
                    }





                    // Only player bullets can hit cave wall turrets
                    if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.wallTurrets && GameContext.caveLevel.wallTurrets.length > 0) {
                        for (let t of GameContext.caveLevel.wallTurrets) {
                            if (!t || t.dead) continue;
                            if (typeof t.hitByPlayerBullet === 'function') {
                                if (t.hitByPlayerBullet(b)) { hit = true; break; }
                            } else {
                                const dist = Math.hypot(b.pos.x - t.pos.x, b.pos.y - t.pos.y);
                                if (dist < t.radius + b.radius) {
                                    t.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#88f');
                                    if (t.hp <= 0) {
                                        if (typeof t.kill === 'function') t.kill();
                                        else t.dead = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    // Only player bullets can hit cave switches
                    if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.switches && GameContext.caveLevel.switches.length > 0) {
                        for (let s of GameContext.caveLevel.switches) {
                            if (!s || s.dead) continue;
                            if (typeof s.hitByPlayerBullet === 'function' && s.hitByPlayerBullet(b)) { hit = true; break; }
                        }
                    }

                    // Only player bullets can hit cave relays
                    if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.relays && GameContext.caveLevel.relays.length > 0) {
                        for (let r of GameContext.caveLevel.relays) {
                            if (!r || r.dead) continue;
                            if (typeof r.hitByPlayerBullet === 'function' && r.hitByPlayerBullet(b)) { hit = true; break; }
                        }
                    }

                    // Only player bullets can hit cave critters
                    if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.critters && GameContext.caveLevel.critters.length > 0) {
                        for (let c of GameContext.caveLevel.critters) {
                            if (!c || c.dead) continue;
                            const dist = Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y);
                            if (dist < c.radius + b.radius) {
                                c.dead = true;
                                hit = true;
                                spawnParticles(c.pos.x, c.pos.y, 18, '#6f6');
                                playSound('explode');
                                // Disturbance: nearby turrets react. 
                                if (GameContext.caveLevel.wallTurrets && GameContext.caveLevel.wallTurrets.length > 0) {
                                    for (let t of GameContext.caveLevel.wallTurrets) {
                                        if (!t || t.dead) continue;
                                        const dt = Math.hypot(t.pos.x - c.pos.x, t.pos.y - c.pos.y);
                                        if (dt < 900) {
                                            t.reload = Math.min(t.reload || 0, 10);
                                            t.beamCooldown = Math.min(t.beamCooldown || 0, 30);
                                            t.trackerCharge = Math.min(t.trackerCharge || 0, 30);
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }

                    // Only player bullets can hit warp bio-pods
                    if (!hit && !b.isEnemy && GameContext.warpBioPods && GameContext.warpBioPods.length > 0) {
                        for (let p of GameContext.warpBioPods) {
                            if (!p || p.dead) continue;
                            const dist = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
                            if (dist < p.radius + b.radius) {
                                p.takeHit(b.damage);
                                hit = true;
                                break;
                            }
                        }
                    }

                    // Only player bullets can hit the space station
                    if (!hit && !b.isEnemy && GameContext.spaceStation && !GameContext.spaceStation.dead) {
                        const dist = Math.hypot(b.pos.x - GameContext.spaceStation.pos.x, b.pos.y - GameContext.spaceStation.pos.y);

                        // Check if outer shields have any segments up
                        const outerShieldsUp = GameContext.spaceStation.shieldSegments && GameContext.spaceStation.shieldSegments.some(s => s > 0);
                        const innerShieldsUp = GameContext.spaceStation.innerShieldSegments && GameContext.spaceStation.innerShieldSegments.some(s => s > 0);

                        // Outer shield collision - bullet is within or touching the outer shield radius
                        if (!hit && !b.ignoreShields && outerShieldsUp && dist < GameContext.spaceStation.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.spaceStation.pos.y, b.pos.x - GameContext.spaceStation.pos.x) - GameContext.spaceStation.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.spaceStation.shieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.spaceStation.shieldSegments[idx] > 0) {
                                GameContext.spaceStation.shieldSegments[idx]--;
                                GameContext.spaceStation.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                            }
                        }
                        // Inner shield collision - bullet is within or touching the inner shield radius
                        if (!hit && !b.ignoreShields && innerShieldsUp && dist < GameContext.spaceStation.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.spaceStation.pos.y, b.pos.x - GameContext.spaceStation.pos.x) - GameContext.spaceStation.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.spaceStation.innerShieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.spaceStation.innerShieldSegments[idx] > 0) {
                                GameContext.spaceStation.innerShieldSegments[idx]--;
                                GameContext.spaceStation.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                            }
                        }
                        // Hull damage: allowed if shields are bypassed or down
                        if (!hit && dist < GameContext.spaceStation.radius + b.radius) {
                            GameContext.spaceStation.hp -= b.damage;
                            hit = true;
                            playSound('hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#fff');
                            if (GameContext.spaceStation.hp <= 0) {
                                handleSpaceStationDestroyed();
                            }
                        }
                    }

                    // Only player bullets (!b.isEnemy) can hit destroyer
                    if (!hit && !b.isEnemy && GameContext.destroyer && !GameContext.destroyer.dead) {
                        const dist = Math.hypot(b.pos.x - GameContext.destroyer.pos.x, b.pos.y - GameContext.destroyer.pos.y);
                        // Destroy bullet if it hits invulnerable destroyer's shield radius
                        if (GameContext.destroyer.invulnerable > 0 && dist < GameContext.destroyer.shieldRadius + b.radius) {
                            hit = true;
                            playSound('shield_hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                        }
                        const outerUp = GameContext.destroyer.shieldSegments && GameContext.destroyer.shieldSegments.some(s => s > 0);
                        const innerUp = GameContext.destroyer.innerShieldSegments && GameContext.destroyer.innerShieldSegments.some(s => s > 0);
                        if (!hit && !b.ignoreShields && outerUp && dist < GameContext.destroyer.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.destroyer.pos.y, b.pos.x - GameContext.destroyer.pos.x) - GameContext.destroyer.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.destroyer.shieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.destroyer.shieldSegments[idx] > 0) {
                                const segmentHp = GameContext.destroyer.shieldSegments[idx];
                                if (b.damage > segmentHp) {
                                    // Penetrate: bullet breaks through with reduced damage
                                    GameContext.destroyer.shieldSegments[idx] = 0;
                                    GameContext.destroyer.shieldsDirty = true;
                                    b.damage -= segmentHp;
                                } else {
                                    // Full absorb: shield stops bullet
                                    GameContext.destroyer.shieldSegments[idx] -= b.damage;
                                    GameContext.destroyer.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                                }
                            }
                        }
                        if (!hit && !b.ignoreShields && innerUp && dist < GameContext.destroyer.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.destroyer.pos.y, b.pos.x - GameContext.destroyer.pos.x) - GameContext.destroyer.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.destroyer.innerShieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.destroyer.innerShieldSegments[idx] > 0) {
                                const segmentHp = GameContext.destroyer.innerShieldSegments[idx];
                                if (b.damage > segmentHp) {
                                    // Penetrate: bullet breaks through with reduced damage
                                    GameContext.destroyer.innerShieldSegments[idx] = 0;
                                    GameContext.destroyer.shieldsDirty = true;
                                    b.damage -= segmentHp;
                                } else {
                                    // Full absorb: shield stops bullet
                                    GameContext.destroyer.innerShieldSegments[idx] -= b.damage;
                                    GameContext.destroyer.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                                }
                            }
                        }
                        if (!hit && (typeof GameContext.destroyer.hitTestCircle === 'function' ? GameContext.destroyer.hitTestCircle(b.pos.x, b.pos.y, b.radius) : (dist < GameContext.destroyer.radius + b.radius))) {
                            const hpBefore = GameContext.destroyer.hp;
                            GameContext.destroyer.hp -= b.damage;
                            console.log(`[DESTROYER DEBUG] BULLET HIT: ${b.damage} dmg | HP: ${hpBefore} -> ${GameContext.destroyer.hp} | isEnemy=${b.isEnemy} | color=${b.color} | owner=${b.owner?.displayName || b.owner?.constructor?.name || 'none'} | homing=${b.homing}`);
                            hit = true;
                            playSound('hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#ff0');
                            if (GameContext.destroyer.hp <= 0) {
                                GameContext.destroyer.kill();
                            }
                        }
                    }

                    // Only player bullets (!b.isEnemy) can hit the boss
                    if (!hit && !b.isEnemy && GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) {
                        if (b.owner !== GameContext.boss) {
                            const dist = Math.hypot(b.pos.x - GameContext.boss.pos.x, b.pos.y - GameContext.boss.pos.y);

                            if (GameContext.boss.isWarpBoss && GameContext.boss.ramInvulnerable > 0 && dist < GameContext.boss.radius + b.radius + 6) {
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                            }

                            // Check if shields have any segments up
                            const outerShieldsUp = GameContext.boss.shieldSegments && GameContext.boss.shieldSegments.some(s => s > 0);
                            const innerShieldsUp = GameContext.boss.innerShieldSegments && GameContext.boss.innerShieldSegments.length > 0 && GameContext.boss.innerShieldSegments.some(s => s > 0);

                            // Outer shield collision - bullet is within the shield radius
                            if (!hit && !b.ignoreShields && outerShieldsUp && dist < GameContext.boss.shieldRadius + b.radius) {
                                let angle = Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) - GameContext.boss.shieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const segCount = GameContext.boss.shieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * segCount) % segCount;
                                if (GameContext.boss.shieldSegments[segIndex] > 0) {
                                    GameContext.boss.shieldSegments[segIndex]--;
                                    GameContext.boss.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 3, '#0ff');
                                }
                            }
                            // Inner shield collision - bullet is within the inner shield radius
                            if (!hit && !b.ignoreShields && innerShieldsUp && dist < GameContext.boss.innerShieldRadius + b.radius) {
                                let angle = Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) - GameContext.boss.innerShieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const count = GameContext.boss.innerShieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                if (GameContext.boss.innerShieldSegments[segIndex] > 0) {
                                    GameContext.boss.innerShieldSegments[segIndex]--;
                                    GameContext.boss.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                }
                            }

                            // If shields are bypassed or down, allow hardpoints and hull damage
                            if (!hit) {
                                // Hardpoints take damage when shields are down (or bypassed)
                                if (typeof GameContext.boss.applyPlayerBulletHit === 'function') {
                                    if (GameContext.boss.applyPlayerBulletHit(b)) {
                                        hit = true;
                                    }
                                }

                                // Hull damage - use simplified 600px collision for cave monsters
                                if (!hit) {
                                    const hullRadius = (GameContext.boss.hullCollisionRadius) ? GameContext.boss.hullCollisionRadius :
                                        (typeof GameContext.boss.hitTestCircle === 'function' ? 0 : GameContext.boss.radius);
                                    const hitTest = (typeof GameContext.boss.hitTestCircle === 'function' && !GameContext.boss.hullCollisionRadius) ?
                                        GameContext.boss.hitTestCircle(b.pos.x, b.pos.y, b.radius) :
                                        (dist < hullRadius + b.radius);
                                    if (hitTest) {
                                        GameContext.boss.hp -= b.damage;
                                        hit = true;
                                        playSound('hit');
                                        spawnParticles(b.pos.x, b.pos.y, 5, '#fff');
                                        if (GameContext.boss.hp <= 0) {
                                            GameContext.boss.kill();
                                            GameContext.score += 5000;
                                        }
                                    }
                                }
                            }
                        }
                    }





                }

                if (hit) {
                    destroyBulletSprite(b);
                    GameContext.bullets.splice(i, 1);
                }
            }
        } catch (e) {
            console.error('[BULLET LOGIC ERROR]', e);
        } finally {
            setProjectileImpactSoundContext(false);
            globalProfiler.end('BulletLogic');
        }
    }
    if (doUpdate) globalProfiler.end('Update');

    if (doDraw) {
        globalProfiler.start('Draw');
        // Draw cave boundaries on top.
        if (caveActive && GameContext.caveLevel) {
            GameContext.caveLevel.updatePixi();
            GameContext.caveLevel.drawEntities(ctx, camX, camY, height, zoom);
        }

        ctx.restore();

        // Clear UI Canvas for this frame (still used for boss HUD and other elements)
        uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

        // Clear Pixi UI graphics and text objects from previous frame
        if (pixiArrowsGraphics) pixiArrowsGraphics.clear();
        clearPixiUiText();

        drawSlackerMouseLine();
        drawStationIndicator();
        drawDestroyerIndicator();
        drawWarpGateIndicator();
        drawMinimap(pixiMinimapGraphics, canvas);
        drawContractIndicator();
        drawMiniEventIndicator();
        updateMiniEventUI();
        if (GameContext.bossActive && GameContext.boss && typeof GameContext.boss.drawBossHud === 'function') GameContext.boss.drawBossHud(uiCtx);

        // Render Pixi overlay (MOVED from Update loop)
        if (pixiApp && pixiApp.renderer && pixiApp.stage) {
            globalProfiler.start('PixiRender');
            try { pixiApp.renderer.render(pixiApp.stage); } catch (e) { }
            globalProfiler.end('PixiRender');
        }
    }
    if (doDraw) globalProfiler.end('Draw');
    globalProfiler.end('GameLoopLogic');
}

// Helper function to transform polygon vertices
function transformPolygon(vertices, x, y, scale, rotation) {
    const cos = Math.cos(rotation) * scale;
    const sin = Math.sin(rotation) * scale;
    const result = [];
    for (let i = 0; i < vertices.length; i += 2) {
        const vx = vertices[i];
        const vy = vertices[i + 1];
        result.push(
            x + (vx * cos - vy * sin),
            y + (vx * sin + vy * cos)
        );
    }
    return result;
}

// Array to hold temporary text objects for cleanup
let pixiUiTextObjects = [];

function clearPixiUiText() {
    for (const text of pixiUiTextObjects) {
        if (text && text.parent) {
            text.parent.removeChild(text);
            text.destroy({ children: true });
        }
    }
    pixiUiTextObjects = [];
}

function drawStationIndicator() {
    if (!GameContext.spaceStation || !GameContext.player || !pixiArrowsGraphics) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    // Check if on screen (approximate bounds)
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    // If center of station is within view (plus a bit of margin), don't draw arrow
    if (GameContext.spaceStation.pos.x > camX && GameContext.spaceStation.pos.x < camX + viewW &&
        GameContext.spaceStation.pos.y > camY && GameContext.spaceStation.pos.y < camY + viewH) {
        return;
    }

    const dx = GameContext.spaceStation.pos.x - GameContext.player.pos.x;
    const dy = GameContext.spaceStation.pos.y - GameContext.player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;

    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    // Intersect ray from center with screen bounding box inset by margin
    const bx = cx - margin;
    const by = cy - margin;

    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS with manually transformed vertices
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0x00ffff);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ffff,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawDestroyerIndicator() {
    if (!GameContext.destroyer || !GameContext.player || GameContext.destroyer.dead || !pixiArrowsGraphics) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    // Check if on screen (approximate bounds)
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    // If center of destroyer is within view (plus a bit of margin), don't draw arrow
    if (GameContext.destroyer.pos.x > camX && GameContext.destroyer.pos.x < camX + viewW &&
        GameContext.destroyer.pos.y > camY && GameContext.destroyer.pos.y < camY + viewH) {
        return;
    }

    const dx = GameContext.destroyer.pos.x - GameContext.player.pos.x;
    const dy = GameContext.destroyer.pos.y - GameContext.player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;

    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    // Intersect ray from center with screen bounding box inset by margin
    const bx = cx - margin;
    const by = cy - margin;

    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Color based on destroyer type
    const isDestroyer2 = GameContext.destroyer.displayName === "DESTROYER II";
    const indicatorColor = isDestroyer2 ? 0xff0000 : 0xff8000;

    // Draw arrow using PixiJS with manually transformed vertices
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(indicatorColor);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const label = isDestroyer2 ? 'DESTROYER II ' : 'DESTROYER ';
    const text = new PIXI.Text(label + (dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: indicatorColor,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawWarpGateIndicator() {
    if (!GameContext.warpGate || !GameContext.player || GameContext.player.dead || GameContext.warpGate.dead || !pixiArrowsGraphics) return;
    if (GameContext.warpGate.mode !== 'entry') return;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (GameContext.warpGate.pos.x > camX && GameContext.warpGate.pos.x < camX + viewW &&
        GameContext.warpGate.pos.y > camY && GameContext.warpGate.pos.y < camY + viewH) {
        return;
    }

    const dx = GameContext.warpGate.pos.x - GameContext.player.pos.x;
    const dy = GameContext.warpGate.pos.y - GameContext.player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0xff8800);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text (two lines: "WARP" and distance)
    const dist = Math.hypot(dx, dy);
    const text1 = new PIXI.Text("WARP", {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text1.anchor.set(0.5, 1);
    text1.position.set(arrowX, arrowY - 18);
    pixiUiOverlayLayer.addChild(text1);
    pixiUiTextObjects.push(text1);

    const text2 = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text2.anchor.set(0.5, 0);
    text2.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text2);
    pixiUiTextObjects.push(text2);
}

// Flagship warp zone removed - no longer needed
function drawContractIndicator() {
    if (!GameContext.activeContract || !GameContext.player || GameContext.player.dead || !pixiArrowsGraphics) return;
    let tx = null, ty = null;
    if (GameContext.activeContract.type === 'gate_run' && GameContext.contractEntities.gates.length > 0) {
        const idx = GameContext.activeContract.gateIndex || 0;
        const g = GameContext.contractEntities.gates[idx];
        if (g && !g.dead) { tx = g.pos.x; ty = g.pos.y; }
    } else if (GameContext.activeContract.target) {
        tx = GameContext.activeContract.target.x; ty = GameContext.activeContract.target.y;
    } else if (GameContext.contractEntities.beacons.length > 0) {
        tx = GameContext.contractEntities.beacons[0].pos.x; ty = GameContext.contractEntities.beacons[0].pos.y;
    }
    if (tx === null || ty === null) return;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

    const dx = tx - GameContext.player.pos.x;
    const dy = ty - GameContext.player.pos.y;
    const angle = Math.atan2(dy, dx);

    // Match the space-station indicator style/position (edge, pulsing, distance readout).
    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const tEdge = Math.min(txEdge, tyEdge);

    const arrowX = cx + vx * tEdge;
    const arrowY = cy + vy * tEdge;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0x00ff00);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawMiniEventIndicator() {
    if (!GameContext.miniEvent || GameContext.miniEvent.dead || !GameContext.player || GameContext.player.dead || !pixiArrowsGraphics) return;

    let tx = GameContext.miniEvent.pos.x;
    let ty = GameContext.miniEvent.pos.y;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

    const dx = tx - GameContext.player.pos.x;
    const dy = ty - GameContext.player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const tEdge = Math.min(txEdge, tyEdge);

    const arrowX = cx + vx * tEdge;
    const arrowY = cy + vy * tEdge;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
    const blink = (Math.sin(Date.now() * 0.012) > 0.2) ? 1 : 0.55;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0xffff00, blink);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xffff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    text.alpha = blink;
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

// Draw line from Slacker ship to mouse cursor
function drawSlackerMouseLine() {
    if (!GameContext.player || GameContext.player.shipType !== 'slacker' || GameContext.usingGamepad || !pixiArrowsGraphics) return;
    if (GameContext.gamePaused || !GameContext.gameActive) return;

    // Calculate screen positions
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - width / (2 * z);
    const camY = GameContext.player.pos.y - height / (2 * z);

    // Ship screen position (center of view, usually)
    const screenShipX = (GameContext.player.pos.x - camX) * z;
    const screenShipY = (GameContext.player.pos.y - camY) * z;

    // Mouse screen position (raw input)
    const screenMouseX = mouseScreen.x;
    const screenMouseY = mouseScreen.y;

    // Calculate angle from ship to mouse on screen
    const angle = Math.atan2(screenMouseY - screenShipY, screenMouseX - screenShipX);

    // Start point: 10 pixels beyond outer shield (scaled to screen)
    // outerShieldRadius is in world units, so scale by z
    const startDistScreen = (GameContext.player.outerShieldRadius + 10) * z;
    const screenStartX = screenShipX + Math.cos(angle) * startDistScreen;
    const screenStartY = screenShipY + Math.sin(angle) * startDistScreen;

    // Skip if line is too short or off-screen
    // (Additional check to prevent drawing inside the ship)
    const dx = screenMouseX - screenShipX;
    const dy = screenMouseY - screenShipY;
    const distSq = dx * dx + dy * dy;
    if (distSq < startDistScreen * startDistScreen) return;

    // Draw white 50% transparent line
    pixiArrowsGraphics.lineStyle(2, 0xffffff, 0.5);
    pixiArrowsGraphics.moveTo(screenStartX, screenStartY);
    pixiArrowsGraphics.lineTo(screenMouseX, screenMouseY);
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

window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
    if (e.key === ' ') keys.space = true;
    if (e.key === 'e' || e.key === 'E') keys.e = true;
    if (e.key === 'f' || e.key === 'F') keys.f = true;
    if (e.key === 'Shift') keys.shift = true;
    if (e.key === 'Escape') togglePause();
    // Debug menu toggle (F1)
    if (e.key === 'F1') {
        e.preventDefault();
        toggleDebugButton();
    }
    // Debug: instantly destroy space station (Ctrl+Shift+K)
    if (e.ctrlKey && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        handleSpaceStationDestroyed();
    }
    // Debug: jump straight to Sector 2 cave (Ctrl+Shift+2) 
    if (e.ctrlKey && e.shiftKey && (e.code === 'Digit2' || e.code === 'Numpad2')) {
        e.preventDefault();
        const doJump = () => {
            if (!GameContext.gameActive || !GameContext.player || GameContext.player.dead) return;
            // Force a sector warp completion into sector 2. 
            GameContext.sectorTransitionActive = false;
            GameContext.warpCountdownAt = null;
            GameContext.sectorIndex = 1;
            showOverlayMessage("DEBUG: ENTERING SECTOR 2 CAVE", '#0ff', 1200, 5);
            completeSectorWarp();
        };
        if (!GameContext.gameActive) {
            startGame();
            setTimeout(doJump, 60);
        } else {
            if (GameContext.gamePaused) togglePause();
            doJump();
        }
    }
    // Debug: jump directly into the warp maze (Ctrl+Shift+W)
    if (e.ctrlKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (!GameContext.gameActive || GameContext.gamePaused || !GameContext.player || GameContext.player.dead) return;
        if (GameContext.warpZone && GameContext.warpZone.active) {
            showOverlayMessage("ALREADY IN WARP", '#ff0', 900);
        } else {
            enterWarpMaze();
        }
    }
    // Debug: force-exit warp maze back to world (Ctrl+Shift+Q)
    if (e.ctrlKey && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        if (!GameContext.gameActive || !GameContext.player) return;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.key === ' ') keys.space = false;
    if (e.key === 'e' || e.key === 'E') keys.e = false;
    if (e.key === 'f' || e.key === 'F') keys.f = false;
    if (e.key === 'Shift') keys.shift = false;
});

window.addEventListener('mousemove', e => {
    const now = Date.now();

    // Map from screen coordinates to internal resolution
    const rect = canvas.getBoundingClientRect();
    const scaleX = internalWidth / rect.width;
    const scaleY = internalHeight / rect.height;

    let scaledX, scaledY;

    if (document.pointerLockElement === canvas) {
        // Pointer Lock Mode: Accumulate movement
        mouseScreen.x += e.movementX * scaleX;
        mouseScreen.y += e.movementY * scaleY;

        // Clamp to internal resolution
        mouseScreen.x = Math.max(0, Math.min(internalWidth, mouseScreen.x));
        mouseScreen.y = Math.max(0, Math.min(internalHeight, mouseScreen.y));

        scaledX = mouseScreen.x;
        scaledY = mouseScreen.y;
    } else {
        // Standard Mode: Absolute position
        scaledX = (e.clientX - rect.left) * scaleX;
        scaledY = (e.clientY - rect.top) * scaleY;
    }

    const dx = Math.abs(scaledX - (mouseScreen.x || 0));
    const dy = Math.abs(scaledY - (mouseScreen.y || 0));

    // Ignore tiny pointer jitter so it doesn't steal aim from the gamepad.
    if (dx + dy >= 10 || document.pointerLockElement === canvas) GameContext.lastMouseInputAt = now;

    updateInputMode(now);

    if (typeof mouseScreen !== 'undefined') {
        mouseScreen.x = scaledX;
        mouseScreen.y = scaledY;
    }
    if (GameContext.player) {
        const z = GameContext.currentZoom || ZOOM_LEVEL;
        const camX = GameContext.player.pos.x - width / (2 * z);
        const camY = GameContext.player.pos.y - height / (2 * z);
        mouseWorld.x = (scaledX / z) + camX;
        mouseWorld.y = (scaledY / z) + camY;

        // Track mouse movement direction for Slacker line
        const deltaX = scaledX - mouseLastPos.x;
        const deltaY = scaledY - mouseLastPos.y;
        const moveDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Only update direction if mouse moved significantly (avoid jitter)
        if (moveDist > 2) {
            mouseMovementDir.x = deltaX / moveDist;
            mouseMovementDir.y = deltaY / moveDist;
        }
        mouseLastPos.x = scaledX;
        mouseLastPos.y = scaledY;

        // Smooth the direction using lerp (lerp factor 0.15 for smooth response)
        const lerpFactor = 0.15;
        smoothedDir.x = smoothedDir.x + (mouseMovementDir.x - smoothedDir.x) * lerpFactor;
        smoothedDir.y = smoothedDir.y + (mouseMovementDir.y - smoothedDir.y) * lerpFactor;
    }
});

// Request Pointer Lock on click when game is active
canvas.addEventListener('click', () => {
    if (GameContext.gameActive && !GameContext.gamePaused && !document.pointerLockElement) {
        try {
            canvas.requestPointerLock();
        } catch (e) {
            console.warn("Pointer lock failed:", e);
        }
    }
});

// Release Pointer Lock when game ends or is paused
// (This is handled by the browser on Escape, but we can force it on menu open)
function checkPointerLockState() {
    if ((!GameContext.gameActive || GameContext.gamePaused) && document.pointerLockElement === canvas) {
        document.exitPointerLock();
    }
}
setInterval(checkPointerLockState, 1000); // Periodic check or add to pause logic

window.addEventListener('mousedown', (e) => {
    mouseState.down = true;
    if (e.button === 0) mouseState.leftDown = true;
    if (e.button === 1) mouseState.middleDown = true;
    if (e.button === 2) mouseState.rightDown = true;
});

window.addEventListener('mouseup', (e) => {
    mouseState.down = false;
    if (e.button === 0) mouseState.leftDown = false;
    if (e.button === 1) mouseState.middleDown = false;
    if (e.button === 2) mouseState.rightDown = false;
});

window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected");
    GameContext.gamepadIndex = e.gamepad.index;
    initAudio();
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (GameContext.gamepadIndex === e.gamepad.index) GameContext.gamepadIndex = null;
    GameContext.lastGamepadInputAt = 0;
    updateInputMode(Date.now());
});

// Ship Selection System
const SHIP_SELECTION_KEY = 'neon_space_ship_selection';
let selectedShipType = localStorage.getItem(SHIP_SELECTION_KEY) || 'standard';

function updateShipSelectionUI() {
    const standardBtn = document.getElementById('ship-standard-btn');
    const slackerBtn = document.getElementById('ship-slacker-btn');
    const descEl = document.getElementById('ship-description');

    if (selectedShipType === 'slacker') {
        standardBtn.classList.remove('selected');
        slackerBtn.classList.add('selected');
        descEl.textContent = 'Mouse-driven • Click & hold LEFT BUTTON to brake • RIGHT BUTTON activates turbo boost\nShip follows your cursor • Keyboard works too • Perfect for tactical positioning';
    } else {
        standardBtn.classList.add('selected');
        slackerBtn.classList.remove('selected');
        descEl.textContent = 'Manual turret control • Mouse/Gamepad aiming\nClassic combat experience';
    }
    localStorage.setItem(SHIP_SELECTION_KEY, selectedShipType);
}

// Initialize ship selection UI on page load
updateShipSelectionUI();

document.getElementById('ship-standard-btn').addEventListener('click', () => {
    selectedShipType = 'standard';
    updateShipSelectionUI();
});

document.getElementById('ship-slacker-btn').addEventListener('click', () => {
    selectedShipType = 'slacker';
    updateShipSelectionUI();
});

document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    startGame();
});

const resumeStartBtn = document.getElementById('resume-btn-start');
if (resumeStartBtn) {
    resumeStartBtn.addEventListener('click', () => {
        initAudio();
        // Hide start screen and resume the game
        document.getElementById('start-screen').style.display = 'none';

        // Unpause the game (same logic as togglePause)
        if (GameContext.gamePaused && GameContext.pauseStartTime) {
            const pauseMs = Math.max(0, getGameNowMs() - GameContext.pauseStartTime);
            if (pauseMs > 0) {
                GameContext.pausedAccumMs += pauseMs;
                shiftPausedTimers(pauseMs);
            }
            GameContext.pauseStartTime = null;
        }
        GameContext.gamePaused = false;

        if (musicEnabled) startMusic();
        showOverlayMessage("RESUMED", '#0f0', 1500);

        // Once resumed, can't resume again until quitting to menu
        GameContext.canResumeGame = false;

        // Update resume button state
        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }
    });

    // Initialize resume button state on page load
    // It should start disabled until you quit to menu from pause menu
    window.updateResumeButtonState();
}

// Profile selection button
const profileBtn = document.getElementById('profile-btn');
if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        initAudio();
        showSaveMenu();
    });
}

const upgradesBtn = document.getElementById('upgrades-btn');
const upgradesBackBtn = document.getElementById('upgrades-back-btn');
if (upgradesBtn) {
    upgradesBtn.addEventListener('click', () => {
        initAudio();
        // Show upgrades menu (similar to levelup menu but from start menu)
        showUpgradesMenu();
    });
}
if (upgradesBackBtn) {
    upgradesBackBtn.addEventListener('click', () => {
        // Hide upgrades menu
        document.getElementById('upgrades-menu').style.display = 'none';
        document.getElementById('upgrades-menu').style.visibility = 'hidden';

        // Show start screen
        document.getElementById('start-screen').style.display = 'block';
        document.getElementById('start-screen').style.visibility = 'visible';

        // Clear all menu selections
        const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
        allMenuElements.forEach(el => {
            el.classList.remove('selected');
            if (el.tagName === 'BUTTON') el.blur();
        });

        // Wait one frame then setup start screen navigation
        requestAnimationFrame(() => {
            GameContext.menuSelectionIndex = 0;
            const active = getActiveMenuElements();
            if (active.length > 0) {
                updateMenuVisuals(active);
                active[0].focus();
            }
            // Prevent input during menu transition
            menuDebounce = Date.now() + 300;
        });
    });
}

function showUpgradesMenu() {
    // Hide all menus first
    const levelupScreen = document.getElementById('levelup-screen');
    if (levelupScreen) levelupScreen.style.display = 'none';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.style.display = 'none';
        startScreen.style.visibility = 'hidden';
    }
    const upgradesMenu = document.getElementById('upgrades-menu');
    if (upgradesMenu) {
        upgradesMenu.style.display = 'block';
        upgradesMenu.style.visibility = 'visible';
    }

    // Clear any previous menu selections
    const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
    allMenuElements.forEach(el => {
        el.classList.remove('selected');
        if (el.tagName === 'BUTTON') el.blur();
    });

    // Update meta UI to show current values
    updateMetaUISystem();

    GameContext.menuSelectionIndex = 0;
    menuDebounce = Date.now() + 300;

    // Wait one frame to ensure DOM has updated, then setup navigation
    requestAnimationFrame(() => {
        const active = getActiveMenuElements();
        if (active.length > 0) {
            updateMenuVisuals(active);
            // Force focus on the first button
            active[0].focus();
        }
    });
}

function showRunUpgrades() {
    if (!GameContext.player || !GameContext.player.inventory) {
        console.warn('[RUN UPGRADES] Player not initialized');
        return;
    }

    const container = document.getElementById('run-upgrades-container');
    if (!container) return;

    container.innerHTML = '';

    // Get all collected upgrades
    const collectedUpgrades = Object.entries(GameContext.player.inventory).filter(([id, tier]) => tier > 0);

    if (collectedUpgrades.length === 0) {
        container.innerHTML = '<div class="run-upgrades-empty">No upgrades collected yet</div>';
    } else {
        // Group by category
        UPGRADE_DATA.categories.forEach(category => {
            const categoryUpgrades = category.upgrades.filter(u => GameContext.player.inventory[u.id] > 0);
            if (categoryUpgrades.length === 0) return;

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'run-upgrade-category';

            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'run-upgrade-category-title';
            categoryTitle.textContent = category.name;
            categoryDiv.appendChild(categoryTitle);

            categoryUpgrades.forEach(upgrade => {
                const tier = GameContext.player.inventory[upgrade.id];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'run-upgrade-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'run-upgrade-name';
                nameSpan.textContent = upgrade.name;

                const tierSpan = document.createElement('span');
                tierSpan.className = 'run-upgrade-tier';
                tierSpan.textContent = `TIER ${tier}`;

                itemDiv.appendChild(nameSpan);
                itemDiv.appendChild(tierSpan);
                categoryDiv.appendChild(itemDiv);
            });

            container.appendChild(categoryDiv);
        });
    }

    // Hide pause menu, show run upgrades screen
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('run-upgrades-screen').style.display = 'block';

    // Focus on back button for keyboard/gamepad navigation
    setTimeout(() => {
        document.getElementById('run-upgrades-back-btn').focus();
    }, 100);
}

function hideRunUpgrades() {
    document.getElementById('run-upgrades-screen').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'block';

    // Focus back on upgrades button
    setTimeout(() => {
        document.getElementById('pause-upgrades-btn').focus();
    }, 100);
}

// Debug menu functions
function toggleDebugButton() {
    const debugBtn = document.getElementById('debug-btn');
    if (!debugBtn) return;

    debugMenuVisible = !debugMenuVisible;
    debugBtn.style.display = debugMenuVisible ? 'block' : 'none';

    console.log(`[DEBUG] Debug menu button ${debugMenuVisible ? 'ENABLED' : 'DISABLED'}`);
}

function showDebugMenu() {
    if (!GameContext.player || !GameContext.player.inventory) {
        console.warn('[DEBUG] Player not initialized');
        return;
    }

    const container = document.getElementById('debug-upgrades-container');
    if (!container) return;

    container.innerHTML = '';

    import('./core/constants.js').then(({ UPGRADE_DATA }) => {
        UPGRADE_DATA.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'debug-category';

            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'debug-category-title';
            categoryTitle.textContent = category.name;
            categoryDiv.appendChild(categoryTitle);

            category.upgrades.forEach(upgrade => {
                const currentTier = GameContext.player.inventory[upgrade.id] || 0;
                const maxTier = upgrade.tier5 ? 5 : (upgrade.tier4 ? 4 : 3);

                const itemDiv = document.createElement('div');
                itemDiv.className = 'debug-upgrade-item';

                const infoDiv = document.createElement('div');
                infoDiv.className = 'debug-upgrade-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'debug-upgrade-name';
                nameDiv.textContent = `${upgrade.name} (Tier ${currentTier})`;
                infoDiv.appendChild(nameDiv);

                if (upgrade.notes) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'debug-upgrade-notes';
                    notesDiv.textContent = upgrade.notes;
                    infoDiv.appendChild(notesDiv);
                }

                itemDiv.appendChild(infoDiv);

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'debug-tier-buttons';

                for (let tier = 1; tier <= maxTier; tier++) {
                    const btn = document.createElement('button');
                    btn.className = 'debug-tier-btn';
                    btn.textContent = `T${tier}`;
                    btn.dataset.upgrade = upgrade.id;
                    btn.dataset.tier = tier;
                    btn.dataset.name = upgrade.name;

                    if (tier === currentTier) {
                        btn.classList.add('current-tier');
                    }

                    buttonsDiv.appendChild(btn);
                }

                itemDiv.appendChild(buttonsDiv);
                categoryDiv.appendChild(itemDiv);
            });

            container.appendChild(categoryDiv);
        });

        // Attach event listeners to tier buttons
        container.querySelectorAll('.debug-tier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const upgradeId = btn.dataset.upgrade;
                const tier = parseInt(btn.dataset.tier);
                const upgradeName = btn.dataset.name;
                grantDebugUpgrade(upgradeId, tier, upgradeName);
            });
        });

        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('debug-menu').style.display = 'block';

        setTimeout(() => {
            document.getElementById('debug-back-btn').focus();
        }, 100);
    }).catch(err => console.error('[DEBUG] Failed to load UPGRADE_DATA:', err));
}

function hideDebugMenu() {
    document.getElementById('debug-menu').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'block';

    setTimeout(() => {
        document.getElementById('debug-btn').focus();
    }, 100);
}

function grantDebugUpgrade(upgradeId, tier, upgradeName) {
    if (!GameContext.player) {
        console.warn('[DEBUG] No player to grant upgrade to');
        return;
    }

    const prevTier = GameContext.player.inventory[upgradeId] || 0;

    applyUpgradeSystem(upgradeId, tier);

    const action = tier > prevTier ? `UPGRADED to Tier ${tier}` :
        tier < prevTier ? `DOWNGRADED to Tier ${tier}` :
            `RESET to Tier ${tier}`;
    showOverlayMessage(`[DEBUG] ${upgradeName}: ${action}`, '#ff0', 1500, 10);

    console.log(`[DEBUG] Granted upgrade: ${upgradeId} Tier ${tier} (was Tier ${prevTier})`);

    showDebugMenu();
}

const newProfileBtn = document.getElementById('new-profile-btn');
if (newProfileBtn) newProfileBtn.addEventListener('click', () => {
    if (confirm("Reset profile? This clears all nugs/stats and saved profiles.")) {
        wipeProfiles();
    }
});

// Note: Duplicate buy handlers removed - modal system now handles all upgrade purchases

document.getElementById('restart-btn').addEventListener('click', () => {
    initAudio();
    startGame();
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
const pauseRestartBtn = document.getElementById('restart-btn-pause');
if (pauseRestartBtn) pauseRestartBtn.addEventListener('click', () => {
    startGame();
});
// Quit button now shows confirmation dialog
document.getElementById('quit-btn').addEventListener('click', async () => {
    const confirmed = await showAbortConfirmDialog();
    if (confirmed) {
        quitGame();
    }
});
document.getElementById('music-btn').addEventListener('click', toggleMusic);

// Pause menu hover handlers - update GameContext.menuSelectionIndex when hovering
const pauseMenuButtons = [
    'resume-btn',
    'pause-upgrades-btn',
    'pause-settings-btn',
    'restart-btn-pause',
    'music-btn',
    'quit-btn',
    'debug-btn',
    'desktop-quit-pause-btn'
];

pauseMenuButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener('mouseenter', () => {
            const active = getActiveMenuElements();
            const index = active.indexOf(btn);
            if (index >= 0) {
                GameContext.menuSelectionIndex = index;
                updateMenuVisuals(active);
            }
        });

        btn.addEventListener('mouseleave', () => {
            const active = getActiveMenuElements();
            // Default back to resume button (index 0)
            GameContext.menuSelectionIndex = 0;
            updateMenuVisuals(active);
        });
    }
});

// Pause menu upgrades button - shows current run upgrades
const pauseUpgradesBtn = document.getElementById('pause-upgrades-btn');
if (pauseUpgradesBtn) {
    pauseUpgradesBtn.addEventListener('click', showRunUpgrades);
}

// Run upgrades back button
const runUpgradesBackBtn = document.getElementById('run-upgrades-back-btn');
if (runUpgradesBackBtn) {
    runUpgradesBackBtn.addEventListener('click', hideRunUpgrades);
}

// Debug menu event listeners
const debugBtn = document.getElementById('debug-btn');
if (debugBtn) {
    debugBtn.addEventListener('click', showDebugMenu);
}

const debugBackBtn = document.getElementById('debug-back-btn');
if (debugBackBtn) {
    debugBackBtn.addEventListener('click', hideDebugMenu);
}


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
updateMetaUISystem();
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

mainLoop();
