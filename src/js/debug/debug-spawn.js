// ============================================================================
// DEBUG SPAWN FUNCTIONS
// Development tools for spawning bosses, stations, and entering dungeons
// ============================================================================

import { GameContext } from '../core/game-context.js';
import { clearArrayWithPixiCleanup } from '../utils/cleanup-utils.js';
import { showOverlayMessage } from '../utils/ui-helpers.js';
import { playSound, musicEnabled, setMusicMode } from '../audio/audio-manager.js';
import {
    Cruiser,
    FinalBoss,
    SpaceStation,
    NecroticHive,
    CerebralPsion,
    Fleshforge,
    VortexMatriarch,
    ChitinusPrime,
    PsyLich
} from '../entities/index.js';

// Dependencies that need to be injected
let deps = {};

export function registerDebugSpawnDependencies(dependencies) {
    deps = {
        ...deps,
        ...dependencies
    };
}

// ============================================================================
// CRUISER SPAWN (Ctrl+Shift+3)
// ============================================================================

export function spawnCruiser() {
    if (typeof GameContext.bossActive !== 'undefined' && GameContext.bossActive) {
        console.log('[DEBUG] Boss already active');
        return;
    }
    GameContext.cruiserEncounterCount++;
    if (deps.destroyer) {
        const idx = GameContext.enemies.indexOf(deps.destroyer);
        if (idx !== -1) GameContext.enemies.splice(idx, 1);
        if (deps.destroyer.pixiCleanupObject && typeof deps.destroyer.pixiCleanupObject === 'function') {
            deps.destroyer.pixiCleanupObject();
        }
        deps.destroyer = null;
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
    deps.clearMiniEvent();
    GameContext.dreadManager.timerActive = false;
    GameContext.dreadManager.firstSpawnDone = true;
    showOverlayMessage("DEBUG: CRUISER SPAWNED", '#ff0', 2000);
    playSound('boss_spawn');
    if (musicEnabled) setMusicMode('cruiser');
}

// ============================================================================
// SPACE STATION SPAWN (Ctrl+Shift+4)
// ============================================================================

export function spawnStation() {
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
}

// ============================================================================
// FINAL BOSS SPAWN (Ctrl+Shift+5)
// ============================================================================

export function spawnFinalBoss() {
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
}

// ============================================================================
// DUNGEON BOSS SPAWN (Ctrl+Shift+D + 4-9, or Ctrl+Shift+7 for random)
// ============================================================================

export function spawnDungeonBoss(bossType) {
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
}

export function spawnNecroticHive() { spawnDungeonBoss('NecroticHive'); }
export function spawnCerebralPsion() { spawnDungeonBoss('CerebralPsion'); }
export function spawnFleshforge() { spawnDungeonBoss('Fleshforge'); }
export function spawnVortexMatriarch() { spawnDungeonBoss('VortexMatriarch'); }
export function spawnChitinusPrime() { spawnDungeonBoss('ChitinusPrime'); }
export function spawnPsyLich() { spawnDungeonBoss('PsyLich'); }

// ============================================================================
// DUNGEON ENTRY (Ctrl+Shift+6)
// ============================================================================

export function enterDungeon1Debug() {
    console.log('[DEBUG] Attempting to enter Dungeon1...');
    try {
        if (typeof deps.enterDungeon1Internal === 'function') {
            deps.enterDungeon1Internal();
            console.log('[DEBUG] Dungeon1 entered successfully');
        } else {
            console.error('[DEBUG] enterDungeon1Internal function not found');
            showOverlayMessage("ERROR: _enterDungeon1Internal not defined", '#f00', 2000);
        }
    } catch (err) {
        console.error('[DEBUG] Failed to enter Dungeon1:', err);
        showOverlayMessage("ERROR: " + err.message, '#f00', 3000);
    }
}

// ============================================================================
// DEBUG KEYBOARD SHORTCUTS
// ============================================================================

export function initDebugKeyboardShortcuts() {
    // Ctrl+Shift+3: Spawn Cruiser
    // Ctrl+Shift+4: Spawn Space Station
    // Ctrl+Shift+5: Spawn Final Boss
    // Ctrl+Shift+6: Enter Dungeon1
    // Ctrl+Shift+7: Spawn Random Dungeon Boss
    // Ctrl+Shift+H: Toggle collision debug
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && (e.code === 'Digit3' || e.code === 'Numpad3')) {
            e.preventDefault();
            spawnCruiser();
        } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit4' || e.code === 'Numpad4')) {
            e.preventDefault();
            spawnStation();
        } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit5' || e.code === 'Numpad5')) {
            e.preventDefault();
            spawnFinalBoss();
        } else if (e.ctrlKey && e.shiftKey && (e.code === 'Digit6' || e.code === 'Numpad6')) {
            e.preventDefault();
            enterDungeon1Debug();
        } else if (e.ctrlKey && e.shiftKey && e.code === 'Digit7') {
            // Spawn random dungeon boss
            e.preventDefault();
            const bosses = ['NecroticHive', 'CerebralPsion', 'Fleshforge', 'VortexMatriarch', 'ChitinusPrime', 'PsyLich'];
            const randomBoss = bosses[Math.floor(Math.random() * bosses.length)];
            spawnDungeonBoss(randomBoss);
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
        if (key === '4') { e.preventDefault(); spawnNecroticHive(); }
        if (key === '5') { e.preventDefault(); spawnCerebralPsion(); }
        if (key === '6') { e.preventDefault(); spawnFleshforge(); }
        if (key === '7') { e.preventDefault(); spawnVortexMatriarch(); }
        if (key === '8') { e.preventDefault(); spawnChitinusPrime(); }
        if (key === '9') { e.preventDefault(); spawnPsyLich(); }
    });

    // Attach all spawn functions to window for console access
    window.spawnCruiser = spawnCruiser;
    window.spawnStation = spawnStation;
    window.spawnFinalBoss = spawnFinalBoss;
    window.spawnDungeonBoss = spawnDungeonBoss;
    window.spawnNecroticHive = spawnNecroticHive;
    window.spawnCerebralPsion = spawnCerebralPsion;
    window.spawnFleshforge = spawnFleshforge;
    window.spawnVortexMatriarch = spawnVortexMatriarch;
    window.spawnChitinusPrime = spawnChitinusPrime;
    window.spawnPsyLich = spawnPsyLich;
    window.enterDungeon1Debug = enterDungeon1Debug;
}
