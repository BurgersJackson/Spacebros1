import { GameContext } from '../core/game-context.js';

const deps = {};

export function registerWorldSetupDependencies(next) {
    Object.assign(deps, next);
}

export function setupGameWorld() {
    GameContext.player.respawn();
    deps.resetPixiOverlaySprites();
    deps.clearArrayWithPixiCleanup(GameContext.bullets);
    deps.clearArrayWithPixiCleanup(GameContext.bossBombs);
    deps.clearArrayWithPixiCleanup(GameContext.guidedMissiles);
    deps.clearArrayWithPixiCleanup(GameContext.enemies);
    deps.clearArrayWithPixiCleanup(GameContext.pinwheels);
    deps.clearArrayWithPixiCleanup(GameContext.particles);
    deps.clearArrayWithPixiCleanup(GameContext.explosions);
    deps.clearArrayWithPixiCleanup(GameContext.floatingTexts);
    deps.clearArrayWithPixiCleanup(GameContext.coins);
    deps.clearArrayWithPixiCleanup(GameContext.nuggets);
    GameContext.spaceNuggets = 0;
    deps.clearArrayWithPixiCleanup(GameContext.powerups);
    deps.clearArrayWithPixiCleanup(GameContext.shootingStars);
    deps.clearArrayWithPixiCleanup(GameContext.drones);
    deps.clearArrayWithPixiCleanup(GameContext.caches);
    GameContext.radiationStorm = null;
    GameContext.nextRadiationStormAt = null;
    deps.clearMiniEvent();
    GameContext.nextMiniEventAt = Date.now() + 120000;
    deps.clearArrayWithPixiCleanup(GameContext.pois);
    GameContext.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    GameContext.activeContract = null;
    GameContext.nextContractAt = Date.now() + 30000;
    deps.scheduleNextShootingStar();
    deps.scheduleNextRadiationStorm();
    deps.scheduleNextMiniEvent();
    GameContext.nextIntensityBreakAt = Date.now() + 120000;
    GameContext.intensityBreakActive = false;
    GameContext.warpParticles = [];
    GameContext.shockwaves = [];
    GameContext.roamerRespawnQueue = [];
    GameContext.baseRespawnTimers = [];
    GameContext.pinwheelsDestroyed = 0;
    GameContext.pinwheelsDestroyedTotal = 0;
    if (GameContext.boss) deps.pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;
    if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
    GameContext.spaceStation = null;
    GameContext.stationHealthBarVisible = false;
    if (GameContext.destroyer) {
        deps.pixiCleanupObject(GameContext.destroyer);
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
    GameContext.gunboatRespawnAt = null;
    GameContext.gunboatLevel2Unlocked = false;
    GameContext.initialSpawnDone = false;
    GameContext.gameStartTime = deps.getGameNowMs();
    GameContext.pauseStartTime = null;
    GameContext.pausedAccumMs = 0;

    GameContext.initialSpawnDelayAt = GameContext.gameStartTime + 5000;

    deps.generateMap();
    deps.initStars(deps.getWidth(), deps.getHeight());

    GameContext.maxRoamers = 3;
    document.getElementById('bases-display').innerText = `0`;
    GameContext.shakeMagnitude = 0;
    deps.updateWarpUI();
    deps.updateTurboUI();
    deps.updateXpUI();
    deps.updateNuggetUI();
}
