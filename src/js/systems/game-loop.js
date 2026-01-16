import { GameContext } from '../core/game-context.js';
import { SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME, ZOOM_LEVEL, ENABLE_NEBULA } from '../core/constants.js';
import { globalProfiler } from '../core/profiler.js';
import { globalJitterMonitor } from '../core/jitter-monitor.js';
import {
    updateViewBounds,
    isInView,
    isInViewRadius,
    rebuildBulletGrid
} from '../core/performance.js';
import { updatePixiBackground, updatePixiCaveGrid } from '../rendering/background-renderer.js';
import { drawMinimap } from '../rendering/minimap-renderer.js';
import { setRenderAlpha } from '../rendering/pixi-context.js';
import { formatTime } from '../utils/ui-helpers.js';
import { updateCrtFilter } from '../ui/crt-filter.js';
import { Enemy, WarpGate, SpaceStation, Destroyer, Destroyer2, Cruiser, Gunboat } from '../entities/index.js';
import { CaveGunboat1, CaveGunboat2 } from '../entities/cave/index.js';
import {
    scheduleNextMiniEvent,
    scheduleNextRadiationStorm,
    scheduleNextShootingStar,
    getArenaCountdownTimeLeft,
    isArenaCountdownActive,
    setArenaCountdownTimeLeft,
    startArenaCountdown,
    stopArenaCountdown,
    updateArenaCountdownDisplay
} from './event-scheduler.js';
import { updateContract as updateContractSystem } from './contract-manager.js';
import {
    spawnMiniEventRelative,
    spawnNewPinwheelRelative,
    spawnOneAsteroidRelative,
    spawnOneWarpAsteroidRelative,
    spawnRadiationStormRelative
} from './spawn-manager.js';

let _updateGamepad = null;
let _gameLoopLogic = null;
let _getSimNowMs = null;
let _setSimNowMs = null;
let _getSimAccMs = null;
let _setSimAccMs = null;
let _getSimLastPerfAt = null;
let _setSimLastPerfAt = null;
let _fpsCounterEl = null;

let fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let fpsSmoothMs = 16.7;
let fpsNextUiAt = 0;
let fpsUiVisible = null;
let animationId = null;

let _getWidth = null;
let _getHeight = null;
let _getPixiApp = null;
let _getPixiWorldRoot = null;
let _getPixiScreenRoot = null;
let _getPixiNebulaLayer = null;
let _getPixiStarLayer = null;
let _getPixiStarTilingLayer = null;
let _getPixiCaveGridSprite = null;
let _getPixiMinimapGraphics = null;
let _getPixiArrowsGraphics = null;
let _getPixiBulletLayer = null;
let _getPixiParticleLayer = null;
let _getPixiPickupLayer = null;
let _getPixiVectorLayer = null;
let _getPixiBulletTextures = null;
let _getPixiTextures = null;
let _getPixiTextureWhite = null;
let _getPixiParticleGlowTexture = null;
let _getPixiParticleSmokeTexture = null;
let _getPixiParticleWarpTexture = null;
let _getPixiBulletSpritePool = null;
let _getPixiParticleSpritePool = null;
let _getPixiPickupSpritePool = null;
let _ShootingStar = null;

let _setRenderAlphaLocal = null;
let _getGameDurationMs = null;
let _intensityBreakDuration = null;

let ctx = null;
let uiCtx = null;
let canvas = null;
let uiCanvas = null;
let overlayMessage = null;

let pixiApp = null;
let pixiWorldRoot = null;
let pixiScreenRoot = null;
let pixiNebulaLayer = null;
let pixiStarLayer = null;
let pixiStarTilingLayer = null;
let pixiCaveGridSprite = null;
let pixiMinimapGraphics = null;
let pixiArrowsGraphics = null;
let pixiBulletLayer = null;
let pixiParticleLayer = null;
let pixiPickupLayer = null;
let pixiVectorLayer = null;
let pixiBulletTextures = null;
let pixiTextures = null;
let pixiTextureWhite = null;
let pixiParticleGlowTexture = null;
let pixiParticleSmokeTexture = null;
let pixiParticleWarpTexture = null;
let pixiBulletSpritePool = null;
let pixiParticleSpritePool = null;
let pixiPickupSpritePool = null;

let width = 0;
let height = 0;

let resetPixiOverlaySprites = null;
let clearArrayWithPixiCleanup = null;
let clearMiniEvent = null;
let updateMiniEventUI = null;
let drawSlackerMouseLine = null;
let drawStationIndicator = null;
let drawDestroyerIndicator = null;
let drawWarpGateIndicator = null;
let drawContractIndicator = null;
let drawMiniEventIndicator = null;
let clearPixiUiText = null;
let processStaggeredBombExplosions = null;
let processStaggeredParticleBursts = null;
let processLightningEffects = null;
let compactArray = null;
let compactParticles = null;
let immediateCompactArray = null;
let globalStaggeredCleanup = null;
let destroyBulletSprite = null;
let pixiCleanupObject = null;
let showOverlayMessage = null;
let playSound = null;
let setMusicMode = null;
let isMusicEnabled = null;
let enterWarpMaze = null;
let completeSectorWarp = null;
let findSpawnPointRelative = null;
let resolveEntityCollision = null;
let processBulletCollisions = null;

let shakeOffsetX = 0;
let shakeOffsetY = 0;
let renderAlpha = 1.0;

/**
 * @param {Object} deps
 */
export function registerGameLoopDependencies(deps) {
    if (deps.updateGamepad) _updateGamepad = deps.updateGamepad;
    if (deps.gameLoopLogic) _gameLoopLogic = deps.gameLoopLogic;
    if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
    if (deps.setSimNowMs) _setSimNowMs = deps.setSimNowMs;
    if (deps.getSimAccMs) _getSimAccMs = deps.getSimAccMs;
    if (deps.setSimAccMs) _setSimAccMs = deps.setSimAccMs;
    if (deps.getSimLastPerfAt) _getSimLastPerfAt = deps.getSimLastPerfAt;
    if (deps.setSimLastPerfAt) _setSimLastPerfAt = deps.setSimLastPerfAt;
    if (deps.fpsCounterEl !== undefined) _fpsCounterEl = deps.fpsCounterEl;

    fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    fpsSmoothMs = 16.7;
    fpsNextUiAt = 0;
    fpsUiVisible = null;
}

/**
 * @param {Object} deps
 */
export function registerGameLoopLogicDependencies(deps) {
    if (deps.getWidth) _getWidth = deps.getWidth;
    if (deps.getHeight) _getHeight = deps.getHeight;
    if (deps.getPixiApp) _getPixiApp = deps.getPixiApp;
    if (deps.getPixiWorldRoot) _getPixiWorldRoot = deps.getPixiWorldRoot;
    if (deps.getPixiScreenRoot) _getPixiScreenRoot = deps.getPixiScreenRoot;
    if (deps.getPixiNebulaLayer) _getPixiNebulaLayer = deps.getPixiNebulaLayer;
    if (deps.getPixiStarLayer) _getPixiStarLayer = deps.getPixiStarLayer;
    if (deps.getPixiStarTilingLayer) _getPixiStarTilingLayer = deps.getPixiStarTilingLayer;
    if (deps.getPixiCaveGridSprite) _getPixiCaveGridSprite = deps.getPixiCaveGridSprite;
    if (deps.getPixiMinimapGraphics) _getPixiMinimapGraphics = deps.getPixiMinimapGraphics;
    if (deps.getPixiArrowsGraphics) _getPixiArrowsGraphics = deps.getPixiArrowsGraphics;
    if (deps.getPixiBulletLayer) _getPixiBulletLayer = deps.getPixiBulletLayer;
    if (deps.getPixiParticleLayer) _getPixiParticleLayer = deps.getPixiParticleLayer;
    if (deps.getPixiPickupLayer) _getPixiPickupLayer = deps.getPixiPickupLayer;
    if (deps.getPixiVectorLayer) _getPixiVectorLayer = deps.getPixiVectorLayer;
    if (deps.getPixiBulletTextures) _getPixiBulletTextures = deps.getPixiBulletTextures;
    if (deps.getPixiTextures) _getPixiTextures = deps.getPixiTextures;
    if (deps.getPixiTextureWhite) _getPixiTextureWhite = deps.getPixiTextureWhite;
    if (deps.getPixiParticleGlowTexture) _getPixiParticleGlowTexture = deps.getPixiParticleGlowTexture;
    if (deps.getPixiParticleSmokeTexture) _getPixiParticleSmokeTexture = deps.getPixiParticleSmokeTexture;
    if (deps.getPixiParticleWarpTexture) _getPixiParticleWarpTexture = deps.getPixiParticleWarpTexture;
    if (deps.getPixiBulletSpritePool) _getPixiBulletSpritePool = deps.getPixiBulletSpritePool;
    if (deps.getPixiParticleSpritePool) _getPixiParticleSpritePool = deps.getPixiParticleSpritePool;
    if (deps.getPixiPickupSpritePool) _getPixiPickupSpritePool = deps.getPixiPickupSpritePool;
    if (deps.setRenderAlphaLocal) _setRenderAlphaLocal = deps.setRenderAlphaLocal;
    if (deps.getGameDurationMs) _getGameDurationMs = deps.getGameDurationMs;
    if (deps.intensityBreakDuration) _intensityBreakDuration = deps.intensityBreakDuration;
    if (deps.ShootingStar) _ShootingStar = deps.ShootingStar;

    if (deps.ctx) ctx = deps.ctx;
    if (deps.uiCtx) uiCtx = deps.uiCtx;
    if (deps.canvas) canvas = deps.canvas;
    if (deps.uiCanvas) uiCanvas = deps.uiCanvas;
    if (deps.overlayMessage) overlayMessage = deps.overlayMessage;

    if (deps.resetPixiOverlaySprites) resetPixiOverlaySprites = deps.resetPixiOverlaySprites;
    if (deps.clearArrayWithPixiCleanup) clearArrayWithPixiCleanup = deps.clearArrayWithPixiCleanup;
    if (deps.clearMiniEvent) clearMiniEvent = deps.clearMiniEvent;
    if (deps.updateMiniEventUI) updateMiniEventUI = deps.updateMiniEventUI;
    if (deps.drawSlackerMouseLine) drawSlackerMouseLine = deps.drawSlackerMouseLine;
    if (deps.drawStationIndicator) drawStationIndicator = deps.drawStationIndicator;
    if (deps.drawDestroyerIndicator) drawDestroyerIndicator = deps.drawDestroyerIndicator;
    if (deps.drawWarpGateIndicator) drawWarpGateIndicator = deps.drawWarpGateIndicator;
    if (deps.drawContractIndicator) drawContractIndicator = deps.drawContractIndicator;
    if (deps.drawMiniEventIndicator) drawMiniEventIndicator = deps.drawMiniEventIndicator;
    if (deps.clearPixiUiText) clearPixiUiText = deps.clearPixiUiText;
    if (deps.processStaggeredBombExplosions) processStaggeredBombExplosions = deps.processStaggeredBombExplosions;
    if (deps.processStaggeredParticleBursts) processStaggeredParticleBursts = deps.processStaggeredParticleBursts;
    if (deps.processLightningEffects) processLightningEffects = deps.processLightningEffects;
    if (deps.compactArray) compactArray = deps.compactArray;
    if (deps.compactParticles) compactParticles = deps.compactParticles;
    if (deps.immediateCompactArray) immediateCompactArray = deps.immediateCompactArray;
    if (deps.globalStaggeredCleanup) globalStaggeredCleanup = deps.globalStaggeredCleanup;
    if (deps.destroyBulletSprite) destroyBulletSprite = deps.destroyBulletSprite;
    if (deps.pixiCleanupObject) pixiCleanupObject = deps.pixiCleanupObject;
    if (deps.showOverlayMessage) showOverlayMessage = deps.showOverlayMessage;
    if (deps.playSound) playSound = deps.playSound;
    if (deps.setMusicMode) setMusicMode = deps.setMusicMode;
    if (deps.isMusicEnabled) isMusicEnabled = deps.isMusicEnabled;
    if (deps.enterWarpMaze) enterWarpMaze = deps.enterWarpMaze;
    if (deps.completeSectorWarp) completeSectorWarp = deps.completeSectorWarp;
    if (deps.findSpawnPointRelative) findSpawnPointRelative = deps.findSpawnPointRelative;
    if (deps.resolveEntityCollision) resolveEntityCollision = deps.resolveEntityCollision;
    if (deps.processBulletCollisions) processBulletCollisions = deps.processBulletCollisions;
}

/**
 * @returns {void}
 */
export function startMainLoop() {
    mainLoop();
}

function mainLoop() {
    globalProfiler.update();
    animationId = requestAnimationFrame(mainLoop);

    if (_fpsCounterEl) {
        const shouldShow = !!GameContext.gameActive;
        if (fpsUiVisible !== shouldShow) {
            _fpsCounterEl.style.display = shouldShow ? 'block' : 'none';
            fpsUiVisible = shouldShow;
        }

        const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.min(250, t - fpsLastFrameAt));
        fpsLastFrameAt = t;
        fpsSmoothMs = fpsSmoothMs * 0.9 + dt * 0.1;

        if (shouldShow && t >= fpsNextUiAt) {
            const fps = fpsSmoothMs > 0 ? (1000 / fpsSmoothMs) : 0;
            _fpsCounterEl.textContent = `FPS ${fps.toFixed(0)}  ${fpsSmoothMs.toFixed(1)}ms`;
            fpsNextUiAt = t + 250;
        }
    }

    if (_updateGamepad) _updateGamepad();
    if (!_gameLoopLogic) return;

    if (GameContext.gameActive && !GameContext.gamePaused) {
        const frameStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        let simLastPerfAt = _getSimLastPerfAt ? _getSimLastPerfAt() : 0;
        let simNowMs = _getSimNowMs ? _getSimNowMs() : 0;
        let simAccMs = _getSimAccMs ? _getSimAccMs() : 0;

        if (!simLastPerfAt) {
            console.log('[RESUME] First frame after resume - simLastPerfAt was 0, initializing');
            simLastPerfAt = frameStart;
            if (!simNowMs) simNowMs = Date.now();
            simAccMs = 0;
        }
        let frameDt = frameStart - simLastPerfAt;
        simLastPerfAt = frameStart;
        if (!isFinite(frameDt) || frameDt < 0) frameDt = 0;

        globalJitterMonitor.recordFrame(frameDt);
        frameDt = Math.min(100, frameDt);
        simNowMs += frameDt;
        simAccMs += frameDt;

        let steps = 0;
        const STEP = SIM_STEP_MS;
        while (simAccMs >= STEP && steps < SIM_MAX_STEPS_PER_FRAME) {
            const originalDateNow = Date.now;
            Date.now = () => Math.floor(simNowMs - (simAccMs - STEP));
            _gameLoopLogic({ doUpdate: true, doDraw: false, deltaTime: STEP });
            Date.now = originalDateNow;
            simAccMs -= STEP;
            steps++;
        }

        const alpha = steps > 0 ? Math.min(1, simAccMs / STEP) : 1.0;

        const originalDateNow2 = Date.now;
        Date.now = () => Math.floor(simNowMs);
        _gameLoopLogic({ doUpdate: false, doDraw: true, deltaTime: 0, alpha: alpha });
        Date.now = originalDateNow2;

        if (_setSimLastPerfAt) _setSimLastPerfAt(simLastPerfAt);
        if (_setSimNowMs) _setSimNowMs(simNowMs);
        if (_setSimAccMs) _setSimAccMs(simAccMs);
    } else {
        if (_setSimLastPerfAt) _setSimLastPerfAt(0);
        if (_setSimAccMs) _setSimAccMs(0);
    }
}

function triggerFinalBattle() {
    console.log('[FINAL BATTLE] 30 minutes reached. Teleporting to warp level.');
    if (showOverlayMessage) showOverlayMessage("TIME LIMIT REACHED - PREPARE FOR FINAL BATTLE", '#f00', 5000, 5);
    if (playSound) playSound('warp_scream');

    setTimeout(() => {
        if (!GameContext.gameActive || !GameContext.player || GameContext.player.dead) return;
        if (enterWarpMaze) enterWarpMaze();
    }, 3000);
}
export function gameLoopLogic(opts = null) {
    if (_getWidth) width = _getWidth();
    if (_getHeight) height = _getHeight();
    if (_getPixiApp) pixiApp = _getPixiApp();
    if (_getPixiWorldRoot) pixiWorldRoot = _getPixiWorldRoot();
    if (_getPixiScreenRoot) pixiScreenRoot = _getPixiScreenRoot();
    if (_getPixiNebulaLayer) pixiNebulaLayer = _getPixiNebulaLayer();
    if (_getPixiStarLayer) pixiStarLayer = _getPixiStarLayer();
    if (_getPixiStarTilingLayer) pixiStarTilingLayer = _getPixiStarTilingLayer();
    if (_getPixiCaveGridSprite) pixiCaveGridSprite = _getPixiCaveGridSprite();
    if (_getPixiMinimapGraphics) pixiMinimapGraphics = _getPixiMinimapGraphics();
    if (_getPixiArrowsGraphics) pixiArrowsGraphics = _getPixiArrowsGraphics();
    if (_getPixiBulletLayer) pixiBulletLayer = _getPixiBulletLayer();
    if (_getPixiParticleLayer) pixiParticleLayer = _getPixiParticleLayer();
    if (_getPixiPickupLayer) pixiPickupLayer = _getPixiPickupLayer();
    if (_getPixiVectorLayer) pixiVectorLayer = _getPixiVectorLayer();
    if (_getPixiBulletTextures) pixiBulletTextures = _getPixiBulletTextures();
    if (_getPixiTextures) pixiTextures = _getPixiTextures();
    if (_getPixiTextureWhite) pixiTextureWhite = _getPixiTextureWhite();
    if (_getPixiParticleGlowTexture) pixiParticleGlowTexture = _getPixiParticleGlowTexture();
    if (_getPixiParticleSmokeTexture) pixiParticleSmokeTexture = _getPixiParticleSmokeTexture();
    if (_getPixiParticleWarpTexture) pixiParticleWarpTexture = _getPixiParticleWarpTexture();
    if (_getPixiBulletSpritePool) pixiBulletSpritePool = _getPixiBulletSpritePool();
    if (_getPixiParticleSpritePool) pixiParticleSpritePool = _getPixiParticleSpritePool();
    if (_getPixiPickupSpritePool) pixiPickupSpritePool = _getPixiPickupSpritePool();

    globalProfiler.start('GameLoopLogic');

    // Safety: deactivate station arena if station gone
    if (GameContext.stationArena.active && (!GameContext.spaceStation || GameContext.spaceStation.dead)) {
        GameContext.stationArena.active = false;
    }
    // Safety: deactivate cave boss arena if boss gone
    if (GameContext.caveBossArena && GameContext.caveBossArena.active && GameContext.caveMode && (!GameContext.bossActive || !GameContext.boss || GameContext.boss.dead)) {
        GameContext.caveBossArena.active = false;
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
    if (_setRenderAlphaLocal) _setRenderAlphaLocal(renderAlpha);

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
            clearArrayWithPixiCleanup(GameContext.cavePinwheels);
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

                const gameDurationMs = _getGameDurationMs ? _getGameDurationMs() : 0;
                // Final battle teleport at 30 minutes (GAME_DURATION_MS)
                if (!GameContext.gameEnded && elapsed >= gameDurationMs && !warpActive && !GameContext.bossActive && !GameContext.sectorTransitionActive) {
                    triggerFinalBattle();
                    return;
                }
            }
        } catch (e) { console.warn('timer update failed', e); }

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
                // Ensure warp gate is not suppressed when it spawns
                GameContext.suppressWarpGateUntil = 0;
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
    clearArrayWithPixiCleanup(cavePinwheels);
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
                if (isMusicEnabled && isMusicEnabled()) setMusicMode('cruiser');
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
                // Use Gunboat classes (cave variants extend Gunboat for unified difficulty tier system)
                if (!GameContext.gunboatLevel2Unlocked) {
                    if (!level1Alive) {
                        if (GameContext.caveMode) {
                            GameContext.enemies.push(new CaveGunboat1(null, null));
                        } else {
                            GameContext.enemies.push(new Gunboat(null, null, 1));
                        }
                    }
                    GameContext.gunboatRespawnAt = null;
                } else {
                    if (!level1Alive) {
                        if (GameContext.caveMode) {
                            GameContext.enemies.push(new CaveGunboat1(null, null));
                        } else {
                            GameContext.enemies.push(new Gunboat(null, null, 1));
                        }
                    } else if (!level2Alive) {
                        if (GameContext.caveMode) {
                            GameContext.enemies.push(new CaveGunboat2(null, null));
                        } else {
                            GameContext.enemies.push(new Gunboat(null, null, 2));
                        }
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

        if (!warpActive && !GameContext.caveMode && !GameContext.dungeon1Active && !GameContext.bossActive && Date.now() > GameContext.nextShootingStarTime && _ShootingStar) {
            // Fire a meteor shower: 10 comets from different directions, 1s apart
            for (let i = 0; i < 10; i++) {
                const delay = i * 1000;
                setTimeout(() => {
                    GameContext.shootingStars.push(new _ShootingStar());
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
                GameContext.nextIntensityBreakAt = now + _intensityBreakDuration + 90000; // after break, schedule next in ~90s
            }
            if (GameContext.intensityBreakActive && now >= GameContext.nextIntensityBreakAt - (_intensityBreakDuration)) {
                // during break, stop new roamer spawns
            }
            if (GameContext.intensityBreakActive && now >= GameContext.nextIntensityBreakAt) {
                GameContext.intensityBreakActive = false;
            }
        }

        // Allow roamers to spawn in normal mode and cave mode (but not in warp/dungeon/boss)
        if (!warpActive && !GameContext.dungeon1Active && !GameContext.bossActive && !GameContext.sectorTransitionActive && GameContext.initialSpawnDone) {
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
                    // Use cave-aware spawn point finder for cave mode
                    // findSpawnPointRelative from main.js takes (random, min, max) and uses GameContext internally
                    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && findSpawnPointRelative) {
                        const spawnPoint = findSpawnPointRelative(true, 1500, 2500);
                        if (spawnPoint && spawnPoint.x !== undefined && spawnPoint.y !== undefined) {
                            GameContext.enemies.push(new Enemy(type, spawnPoint));
                        } else {
                            GameContext.enemies.push(new Enemy(type));
                        }
                    } else {
                        GameContext.enemies.push(new Enemy(type));
                    }
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
        for (let i = 0; i < GameContext.cavePinwheels.length; i++) GameContext.targetGrid.insert(GameContext.cavePinwheels[i]);
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
            for (let i = 0; i < GameContext.warpZone.turrets.length; i++) {
                const t = GameContext.warpZone.turrets[i];
                if (t && !t.dead) GameContext.targetGrid.insert(t);
            }
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

            const currentPinwheels = GameContext.caveMode ? GameContext.cavePinwheels.length : GameContext.pinwheels.length;

            if (currentPinwheels < targetBases) {
                if (GameContext.baseRespawnTimers.length === 0) spawnNewPinwheelRelative();
            }

            for (let i = GameContext.baseRespawnTimers.length - 1; i >= 0; i--) {
                if (now > GameContext.baseRespawnTimers[i]) {
                    const currentPinwheelsCheck = GameContext.caveMode ? GameContext.cavePinwheels.length : GameContext.pinwheels.length;
                    if (currentPinwheelsCheck < targetBases) {
                        spawnNewPinwheelRelative();
                        GameContext.baseRespawnTimers.splice(i, 1);
                    } else {
                        // Delay respawns until the current target count needs them.
                        GameContext.baseRespawnTimers[i] = now + 8000;
                    }
                } else if (GameContext.baseRespawnTimers[i] > now + 60000) {
                    // Remove timers that are more than 60 seconds in the future (stale timers)
                    GameContext.baseRespawnTimers.splice(i, 1);
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
    if (_setRenderAlphaLocal) _setRenderAlphaLocal(renderAlpha);
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
    if (wg && !wg.dead) {
        if (doUpdate) wg.update(deltaTime, {
            getGameNowMs: () => Date.now(), // Use wall clock time to match suppressWarpGateUntil
            suppressUntil: GameContext.suppressWarpGateUntil,
            showMessage: showOverlayMessage,
            enterWarp: enterWarpMaze
        });
        if (doDraw) wg.draw(ctx);
    }
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

    // Draw cave boss arena
    if (doDraw && caveActive && GameContext.caveLevel && typeof GameContext.caveLevel.drawCaveBossArena === 'function') {
        GameContext.caveLevel.drawCaveBossArena(ctx);
    }

    if (doUpdate) globalProfiler.end('LevelLogic');
    // Asteroids should render behind everything else (drops, ships, UI).
    globalProfiler.start('Entities');
    // Update environment asteroids and skip dead ones
    for (let i = GameContext.environmentAsteroids.length - 1; i >= 0; i--) {
        const a = GameContext.environmentAsteroids[i];
        if (!a || a.dead) continue;
        if (doUpdate) a.update(deltaTime);
        if (doDraw) a.draw(ctx);
    }

    // Update coins and skip dead ones
    for (let i = GameContext.coins.length - 1; i >= 0; i--) {
        const c = GameContext.coins[i];
        if (!c || c.dead) continue;
        if (doUpdate) c.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(c.pos.x, c.pos.y, 50)) c.draw(ctx, pickupRes);
            else if (typeof c.cull === 'function') c.cull();
        }
    }
    // Update nuggets and skip dead ones
    for (let i = GameContext.nuggets.length - 1; i >= 0; i--) {
        const n = GameContext.nuggets[i];
        if (!n || n.dead) continue;
        if (doUpdate) n.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(n.pos.x, n.pos.y, 50)) n.draw(ctx, pickupRes);
            else if (typeof n.cull === 'function') n.cull();
        }
    }
    // Update powerups and skip dead ones
    for (let i = GameContext.powerups.length - 1; i >= 0; i--) {
        const p = GameContext.powerups[i];
        if (!p || p.dead) continue;
        if (doUpdate) p.update(GameContext.player, deltaTime);
        if (doDraw) {
            if (isInView(p.pos.x, p.pos.y, 60)) p.draw(ctx, pickupRes);
            else if (typeof p.cull === 'function') p.cull();
        }
    }
    // Update shooting stars and skip dead ones
    for (let i = GameContext.shootingStars.length - 1; i >= 0; i--) {
        const s = GameContext.shootingStars[i];
        if (!s || s.dead) continue;
        if (doUpdate) s.update(deltaTime);
        if (doDraw) s.draw(ctx);
    }
    // Update caches and skip dead ones
    for (let i = GameContext.caches.length - 1; i >= 0; i--) {
        const c = GameContext.caches[i];
        if (!c || c.dead) continue;
        if (doUpdate) c.update(deltaTime);
        if (doDraw) c.draw(ctx, pickupRes);
    }
    // Update POIs and skip dead ones
    for (let i = GameContext.pois.length - 1; i >= 0; i--) {
        const p = GameContext.pois[i];
        if (!p || p.dead) continue;
        if (doUpdate) p.update(deltaTime);
        if (doDraw) p.draw(ctx);
    }
    if (GameContext.radiationStorm && !GameContext.radiationStorm.dead) { if (doUpdate) GameContext.radiationStorm.update(deltaTime); if (doDraw) GameContext.radiationStorm.draw(ctx); }
    if (GameContext.miniEvent && !GameContext.miniEvent.dead) { if (doUpdate) GameContext.miniEvent.update(deltaTime); if (doDraw) GameContext.miniEvent.draw(ctx); }
    // Update contract entities and skip dead ones
    if (GameContext.contractEntities) {
        if (GameContext.contractEntities.beacons) {
            for (let i = GameContext.contractEntities.beacons.length - 1; i >= 0; i--) {
                const b = GameContext.contractEntities.beacons[i];
                if (!b || b.dead) continue;
                if (doUpdate) b.update(deltaTime);
                if (doDraw) b.draw(ctx);
            }
        }
        if (GameContext.contractEntities.gates) {
            for (let i = GameContext.contractEntities.gates.length - 1; i >= 0; i--) {
                const g = GameContext.contractEntities.gates[i];
                if (!g || g.dead) continue;
                if (doUpdate) g.update(deltaTime);
                if (doDraw) g.draw(ctx);
            }
        }
        if (GameContext.contractEntities.anomalies) {
            for (let i = GameContext.contractEntities.anomalies.length - 1; i >= 0; i--) {
                const a = GameContext.contractEntities.anomalies[i];
                if (!a || a.dead) continue;
                if (doUpdate) a.update(deltaTime);
                if (doDraw) a.draw(ctx);
            }
        }
        if (GameContext.contractEntities.fortresses) {
            for (let i = GameContext.contractEntities.fortresses.length - 1; i >= 0; i--) {
                const f = GameContext.contractEntities.fortresses[i];
                if (!f || f.dead) continue;
                if (doUpdate) f.update(deltaTime);
                if (doDraw) f.draw(ctx);
            }
        }
        if (GameContext.contractEntities.wallTurrets) {
            for (let i = GameContext.contractEntities.wallTurrets.length - 1; i >= 0; i--) {
                const t = GameContext.contractEntities.wallTurrets[i];
                if (!t || t.dead) continue;
                if (doUpdate) t.update(deltaTime);
                if (doDraw) t.draw(ctx);
            }
        }
    }

    // Monster shield drones (from CaveMonster3) - cleanup dead ones
    if (window.monsterDrones && window.monsterDrones.length > 0) {
        for (let i = window.monsterDrones.length - 1; i >= 0; i--) {
            const drone = window.monsterDrones[i];
            if (!drone || drone.dead) {
                if (drone) {
                    if (typeof drone.kill === 'function') {
                        try { drone.kill(); } catch (e) { }
                    }
                    try { pixiCleanupObject(drone); } catch (e) { }
                }
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

    // Cave Pinwheels - always update (can fire), cull drawing
    for (let i = 0, len = GameContext.cavePinwheels.length; i < len; i++) {
        const b = GameContext.cavePinwheels[i];
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

    const bulletPixiResources = (pixiBulletLayer && pixiBulletTextures.glow)
        ? { layer: pixiBulletLayer, textures: pixiBulletTextures, pool: pixiBulletSpritePool }
        : null;

    // Bullets - always update (movement), cull drawing
    for (let i = 0, len = GameContext.bullets.length; i < len; i++) {
        const b = GameContext.bullets[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx, bulletPixiResources);
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
        immediateCompactArray(GameContext.cavePinwheels, pixiCleanupObject);
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
        // Clean up contract entities - remove dead entities
        if (GameContext.contractEntities) {
            immediateCompactArray(GameContext.contractEntities.beacons, pixiCleanupObject);
            immediateCompactArray(GameContext.contractEntities.gates, pixiCleanupObject);
            immediateCompactArray(GameContext.contractEntities.anomalies, pixiCleanupObject);
            immediateCompactArray(GameContext.contractEntities.fortresses, pixiCleanupObject);
            immediateCompactArray(GameContext.contractEntities.wallTurrets, pixiCleanupObject);
        }

        globalProfiler.end('Cleanup');

        globalProfiler.start('EntityCollision');
        resolveEntityCollision();
        globalProfiler.end('EntityCollision');

        // Bullet Logic Loop
        globalProfiler.start('BulletLogic');
        processBulletCollisions();
        globalProfiler.end('BulletLogic');
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

        // Update CRT filter animation
        if (updateCrtFilter) {
            try { updateCrtFilter(); } catch (e) { }
        }

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
