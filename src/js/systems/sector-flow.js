import { GameContext } from "../core/game-context.js";

const deps = {};

export function registerSectorFlowDependencies(next) {
  Object.assign(deps, next);
}

export function startSectorTransition() {
  GameContext.sectorTransitionActive = true;
  GameContext.warpCountdownAt = Date.now() + 10000;
  deps.showOverlayMessage("WARPING TO NEW SECTOR IN 10s", "#0ff", 10000);
  deps.clearOverlayMessageTimeout();
  GameContext.pendingStations = 0;
  GameContext.nextSpaceStationTime = null;
  GameContext.radiationStorm = null;
  deps.clearMiniEvent();
  GameContext.gamePaused = false;
  GameContext.gameActive = true;
  GameContext.pendingTransitionClear = true;
  GameContext.dreadManager.timerActive = false;
}

export function completeSectorWarp() {
  GameContext.gameActive = true;
  GameContext.gamePaused = false;
  GameContext.sectorTransitionActive = false;
  GameContext.warpCountdownAt = null;
  GameContext.sectorIndex++;
  GameContext.player.hp = GameContext.player.maxHp;
  GameContext.player.invulnerable = 180;
  GameContext.player.shieldSegments = GameContext.player.shieldSegments.map(() => 2);
  if (GameContext.player.maxOuterShieldSegments && GameContext.player.maxOuterShieldSegments > 0) {
    GameContext.player.outerShieldSegments = new Array(
      GameContext.player.maxOuterShieldSegments
    ).fill(1);
  }
  deps.updateHealthUI();

  deps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 40, "#0ff");
  GameContext.player.pos.x = 0;
  GameContext.player.pos.y = 0;
  GameContext.player.vel.x = 0;
  GameContext.player.vel.y = 0;
  deps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 40, "#0ff");

  deps.resetPixiOverlaySprites();
  deps.clearArrayWithPixiCleanup(GameContext.bullets);
  deps.clearArrayWithPixiCleanup(GameContext.bossBombs);
  deps.clearArrayWithPixiCleanup(GameContext.guidedMissiles);
  deps.clearArrayWithPixiCleanup(GameContext.enemies);
  deps.clearArrayWithPixiCleanup(GameContext.pinwheels);
  deps.clearArrayWithPixiCleanup(GameContext.cavePinwheels);
  deps.clearArrayWithPixiCleanup(GameContext.coins);
  deps.clearArrayWithPixiCleanup(GameContext.nuggets);
  deps.clearArrayWithPixiCleanup(GameContext.goldNuggets);
  deps.clearArrayWithPixiCleanup(GameContext.environmentAsteroids);
  GameContext.asteroidRespawnTimers = [];
  GameContext.baseRespawnTimers = [];
  GameContext.roamerRespawnQueue = [];
  deps.clearArrayWithPixiCleanup(GameContext.caches);
  deps.clearArrayWithPixiCleanup(GameContext.powerups);
  deps.clearArrayWithPixiCleanup(GameContext.shootingStars);
  deps.clearArrayWithPixiCleanup(GameContext.drones);
  GameContext.contractEntities = {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  };
  GameContext.activeContract = null;
  GameContext.nextContractAt = Date.now() + 30000;
  GameContext.radiationStorm = null;
  deps.scheduleNextRadiationStorm(Date.now() + 15000);
  deps.clearMiniEvent();
  GameContext.nextMiniEventAt = Date.now() + 120000;
  deps.scheduleNextMiniEvent(Date.now() + 20000);
  deps.clearArrayWithPixiCleanup(GameContext.pois);
  GameContext.warpCompletedOnce = false;
  GameContext.caveMode = false;
  GameContext.caveLevel = null;
  GameContext.warpGateUnlocked = false;

  if (GameContext.sectorIndex !== 2) {
    deps.initStars(deps.getWidth(), deps.getHeight());
  }

  if (GameContext.sectorIndex === 2) {
    startCaveSector2();
    GameContext.dreadManager.timerActive = false;
    GameContext.dreadManager.timerAt = null;
    GameContext.cruiserTimerPausedAt = null;
    deps.stopArenaCountdown();
    return;
  }

  deps.generateMap();
  for (let i = 0; i < 3; i++) deps.spawnNewPinwheelRelative(true);
  GameContext.gunboatRespawnAt = Date.now() + 5000;
  GameContext.dreadManager.timerActive = true;
  GameContext.cruiserTimerPausedAt = null;
  const firstCruiserGraceMs = 180000;
  const baseDelay =
    GameContext.dreadManager.minDelayMs +
    Math.floor(
      Math.random() *
        (GameContext.dreadManager.maxDelayMs - GameContext.dreadManager.minDelayMs + 1)
    );
  GameContext.dreadManager.timerAt = Date.now() + Math.max(firstCruiserGraceMs, baseDelay);

  GameContext.pendingStations = 0;
  if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;
  GameContext.nextSpaceStationTime = null;
  if (GameContext.destroyer) deps.pixiCleanupObject(GameContext.destroyer);
  GameContext.destroyer = null;
  GameContext.nextDestroyerSpawnTime = null;
  deps.scheduleNextShootingStar();
  deps.showOverlayMessage("NEW SECTOR ENTERED", "#0ff", 3000);
}

export function startCaveSector2() {
  resetWarpState();
  GameContext.caveMode = true;
  GameContext.caveLevel = new deps.Cave.CaveLevel();
  GameContext.caveLevel.generate();
  deps.clearArrayWithPixiCleanup(GameContext.coins);

  deps.clearArrayWithPixiCleanup(GameContext.goldNuggets);
  const caveLength = Math.abs(GameContext.caveLevel.endY - GameContext.caveLevel.startY);
  const nuggetInterval = caveLength / 10;
  for (let i = 1; i <= 10; i++) {
    const nuggetY = GameContext.caveLevel.startY - i * nuggetInterval;
    const bounds = GameContext.caveLevel.boundsAt(nuggetY);
    const nuggetX = bounds.left + Math.random() * (bounds.right - bounds.left);
    const goldNugget = new deps.GoldNugget(nuggetX, nuggetY, 3, 5, 25, 75);
    GameContext.goldNuggets.push(goldNugget);
  }

  GameContext.activeContract = null;
  GameContext.contractEntities = {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  };
  GameContext.nextContractAt = Date.now() + 999999999;
  GameContext.radiationStorm = null;
  GameContext.nextRadiationStormAt = null;
  deps.clearMiniEvent();
  GameContext.nextMiniEventAt = Date.now() + 999999999;
  GameContext.nextShootingStarTime = Date.now() + 999999999;
  GameContext.intensityBreakActive = false;
  GameContext.nextIntensityBreakAt = Date.now() + 999999999;

  deps.clearArrayWithPixiCleanup(GameContext.pinwheels);
  deps.clearArrayWithPixiCleanup(GameContext.cavePinwheels);
  GameContext.baseRespawnTimers = [];
  GameContext.roamerRespawnQueue = [];
  GameContext.maxRoamers = 15; // Allow roamers to spawn in cave mode
  GameContext.initialSpawnDone = true;
  GameContext.initialSpawnDelayAt = null;
  GameContext.pendingStations = 0;
  if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;
  GameContext.nextSpaceStationTime = null;

  if (GameContext.destroyer) deps.pixiCleanupObject(GameContext.destroyer);
  GameContext.destroyer = null;
  GameContext.nextDestroyerSpawnTime = null;

  GameContext.player.pos.x = GameContext.caveLevel.startX;
  GameContext.player.pos.y = GameContext.caveLevel.startY + 600;
  GameContext.player.vel.x = 0;
  GameContext.player.vel.y = 0;
  GameContext.player.angle = -Math.PI / 2;
  GameContext.player.turretAngle = -Math.PI / 2;

  GameContext.caveLevel.resetFireWall(GameContext.player.pos.y);

  for (let i = 0; i < 3; i++) deps.spawnNewPinwheelRelative(true);

  deps.showOverlayMessage("SECTOR 2: CAVE RUN - FLY UPWARD", "#0ff", 3200, 2);
}

export function enterWarpMaze() {
  if (GameContext.warpZone && GameContext.warpZone.active) return;
  if (GameContext.warpCompletedOnce) {
    deps.showOverlayMessage("WARP ALREADY USED THIS SECTOR", "#f80", 1200, 2);
    return;
  }
  GameContext.warpCompletedOnce = true;

  deps.resetPixiOverlaySprites();
  const detach = arr => {
    if (!arr || arr.length === 0) return;
    for (let i = 0; i < arr.length; i++) deps.pixiCleanupObject(arr[i]);
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
  detach(GameContext.goldNuggets);
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
  GameContext.goldNuggets = [];
  GameContext.powerups = [];
  GameContext.shootingStars = [];
  GameContext.drones = [];
  GameContext.caches = [];
  GameContext.pois = [];
  GameContext.environmentAsteroids = [];
  GameContext.asteroidRespawnTimers = [];
  GameContext.baseRespawnTimers = [];

  GameContext.radiationStorm = null;
  deps.clearMiniEvent();

  resetCaveState();

  GameContext.activeContract = null;
  GameContext.contractEntities = {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  };
  GameContext.nextContractAt = Date.now() + 999999999;

  if (GameContext.destroyer) {
    if (
      GameContext.destroyer.pixiCleanupObject &&
      typeof GameContext.destroyer.pixiCleanupObject === "function"
    ) {
      GameContext.destroyer.pixiCleanupObject();
    }
    GameContext.destroyer = null;
  }

  if (GameContext.boss) deps.pixiCleanupObject(GameContext.boss);
  GameContext.boss = null;
  GameContext.bossActive = false;
  GameContext.bossArena.active = false;
  GameContext.bossArena.growing = false;

  if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;
  GameContext.pendingStations = 0;
  GameContext.nextSpaceStationTime = null;
  GameContext.roamerRespawnQueue = [];
  GameContext.maxRoamers = 0;
  GameContext.gunboatRespawnAt = null;

  const originX = 0;
  const originY = 0;
  GameContext.warpZone = new deps.WarpMazeZone(originX, originY);
  GameContext.warpZone.generate();
  GameContext.warpZone.state = "boss_intro";
  GameContext.warpZone.bossIntroAt = Date.now() + 10000;
  GameContext.warpZone.bossIntroLastSec = null;

  GameContext.player.pos.x = GameContext.warpZone.entrancePos.x;
  GameContext.player.pos.y = GameContext.warpZone.entrancePos.y;
  GameContext.player.vel.x = 0;
  GameContext.player.vel.y = 0;

  let seedTries = 0;
  while (GameContext.environmentAsteroids.length < 50 && seedTries < 800) {
    deps.spawnOneWarpAsteroidRelative(true);
    seedTries++;
  }
}

export function resetWarpState() {
  try {
    if (GameContext.warpZone) {
      if (typeof GameContext.warpZone.cleanup === "function") {
        GameContext.warpZone.cleanup();
      } else {
        GameContext.warpZone.active = false;
      }
    }
  } catch (e) {
    console.warn("[resetWarpState] Error cleaning up warp zone:", e);
  }
  GameContext.warpZone = null;
  if (GameContext.warpGate) deps.pixiCleanupObject(GameContext.warpGate);
  GameContext.warpGate = null;
}

export function resetCaveState() {
  try {
    if (GameContext.caveLevel) {
      if (typeof GameContext.caveLevel.cleanup === "function") {
        GameContext.caveLevel.cleanup();
      } else {
        GameContext.caveLevel.active = false;
      }
    }
  } catch (e) {
    console.warn("[resetCaveState] Error cleaning up cave level:", e);
  }
  GameContext.caveMode = false;
  GameContext.caveLevel = null;
}

export function resetDungeon1State() {
  try {
    if (GameContext.dungeon1Zone) {
      if (typeof GameContext.dungeon1Zone.cleanup === "function") {
        GameContext.dungeon1Zone.cleanup();
      } else {
        GameContext.dungeon1Zone.active = false;
      }
    }
  } catch (e) {
    console.warn("[resetDungeon1State] Error cleaning up dungeon1 zone:", e);
  }
  GameContext.dungeon1Active = false;
  GameContext.dungeon1Zone = null;
}

export function resetVerticalScrollingState() {
  try {
    if (GameContext.verticalScrollingZone) {
      if (typeof GameContext.verticalScrollingZone.cleanup === "function") {
        GameContext.verticalScrollingZone.cleanup();
      } else {
        GameContext.verticalScrollingZone.active = false;
      }
    }
  } catch (e) {
    console.warn("[resetVerticalScrollingState] Error cleaning up vertical scrolling zone:", e);
  }

  try {
    if (GameContext.verticalScrollingWarpGate)
      deps.pixiCleanupObject(GameContext.verticalScrollingWarpGate);
  } catch (e) {
    console.warn(
      "[resetVerticalScrollingState] Error cleaning up vertical scrolling warp gate:",
      e
    );
  }

  // Defensive UI cleanup: VerticalScrollingZone may have shown the countdown directly.
  try {
    if (typeof document !== "undefined") {
      const el = document.getElementById("arena-countdown");
      if (el) el.style.display = "none";
    }
  } catch (e) {}

  GameContext.verticalScrollingMode = false;
  GameContext.verticalScrollingWarpGateUnlocked = false;
  GameContext.verticalScrollingZone = null;
  GameContext.verticalScrollingWarpGate = null;
  GameContext.scrollProgress = 0;
  GameContext.scrollSpeed = 2.0;
}

export function enterVerticalScrollingZone() {
  if (GameContext.verticalScrollingZone && GameContext.verticalScrollingZone.active) return;

  deps.resetPixiOverlaySprites();
  const detach = arr => {
    if (!arr || arr.length === 0) return;
    for (let i = 0; i < arr.length; i++) deps.pixiCleanupObject(arr[i]);
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
  detach(GameContext.goldNuggets);
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
  GameContext.goldNuggets = [];
  GameContext.powerups = [];
  GameContext.shootingStars = [];
  GameContext.drones = [];
  GameContext.caches = [];
  GameContext.pois = [];
  GameContext.environmentAsteroids = [];
  GameContext.asteroidRespawnTimers = [];
  GameContext.baseRespawnTimers = [];

  GameContext.radiationStorm = null;
  deps.clearMiniEvent();

  // Disable all level 1 timers and events
  GameContext.dreadManager.timerActive = false;
  GameContext.dreadManager.timerAt = null;
  GameContext.nextRadiationStormAt = null;
  GameContext.nextMiniEventAt = Date.now() + 999999999;
  GameContext.nextSpaceStationTime = null;
  GameContext.nextShootingStarTime = Date.now() + 999999999;
  GameContext.nextIntensityBreakAt = Date.now() + 999999999;

  resetCaveState();

  GameContext.activeContract = null;
  GameContext.contractEntities = {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  };
  GameContext.nextContractAt = Date.now() + 999999999;

  if (GameContext.destroyer) {
    if (
      GameContext.destroyer.pixiCleanupObject &&
      typeof GameContext.destroyer.pixiCleanupObject === "function"
    ) {
      GameContext.destroyer.pixiCleanupObject();
    }
    GameContext.destroyer = null;
  }

  if (GameContext.boss) deps.pixiCleanupObject(GameContext.boss);
  GameContext.boss = null;
  GameContext.bossActive = false;
  GameContext.bossArena.active = false;
  GameContext.bossArena.growing = false;

  if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;
  GameContext.pendingStations = 0;
  GameContext.nextSpaceStationTime = null;
  GameContext.roamerRespawnQueue = [];
  GameContext.maxRoamers = 0;
  GameContext.gunboatRespawnAt = null;

  // Initialize vertical scrolling zone
  const originX = 0;
  const originY = 0;
  GameContext.verticalScrollingZone = new deps.VerticalScrollingZone(originX, originY);
  GameContext.verticalScrollingMode = true;
  GameContext.scrollProgress = 0;
  GameContext.scrollSpeed = 2.0;

  // Position player at center of screen, near bottom
  GameContext.player.pos.x = originX;
  GameContext.player.pos.y = originY + 300; // Start near bottom of viewport
  GameContext.player.vel.x = 0;
  GameContext.player.vel.y = 0;
  // Allow normal rotation (no angle lock)

  deps.showOverlayMessage("VERTICAL SCROLLING MODE - SURVIVE 5 MINUTES", "#0ff", 4000, 2);
  if (deps.playSound) deps.playSound("contract");
}

export function enterDungeon1Internal() {
  if (GameContext.dungeon1Zone && GameContext.dungeon1Zone.active) return;
  if (GameContext.dungeon1CompletedOnce) {
    deps.showOverlayMessage("DUNGEON ALREADY CLEARED", "#f80", 1200, 2);
    return;
  }

  GameContext.dungeon1OriginalPos = { x: GameContext.player.pos.x, y: GameContext.player.pos.y };

  deps.resetPixiOverlaySprites();
  const detach = arr => {
    if (!arr || arr.length === 0) return;
    for (let i = 0; i < arr.length; i++) deps.pixiCleanupObject(arr[i]);
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
  detach(GameContext.goldNuggets);
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
  GameContext.goldNuggets = [];
  GameContext.powerups = [];
  GameContext.shootingStars = [];
  GameContext.drones = [];
  GameContext.caches = [];
  GameContext.pois = [];
  GameContext.environmentAsteroids = [];
  GameContext.asteroidRespawnTimers = [];
  GameContext.baseRespawnTimers = [];

  GameContext.radiationStorm = null;
  deps.clearMiniEvent();

  resetCaveState();

  GameContext.activeContract = null;
  GameContext.contractEntities = {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  };
  GameContext.nextContractAt = Date.now() + 999999999;

  if (GameContext.destroyer) {
    if (
      GameContext.destroyer.pixiCleanupObject &&
      typeof GameContext.destroyer.pixiCleanupObject === "function"
    ) {
      GameContext.destroyer.pixiCleanupObject();
    }
    GameContext.destroyer = null;
  }

  if (GameContext.boss) deps.pixiCleanupObject(GameContext.boss);
  GameContext.boss = null;
  GameContext.bossActive = false;
  GameContext.bossArena.active = false;
  GameContext.bossArena.growing = false;

  if (GameContext.spaceStation) deps.pixiCleanupObject(GameContext.spaceStation);
  GameContext.spaceStation = null;
  GameContext.stationHealthBarVisible = false;
  GameContext.pendingStations = 0;
  GameContext.nextSpaceStationTime = null;
  GameContext.roamerRespawnQueue = [];
  GameContext.maxRoamers = 0;
  GameContext.gunboatRespawnAt = null;

  const originX = 0;
  const originY = 0;
  GameContext.dungeon1Zone = new deps.Dungeon1Zone(originX, originY);
  GameContext.dungeon1Active = true;

  GameContext.player.pos.x = originX;
  GameContext.player.pos.y = originY + GameContext.dungeon1Arena.radius - 300;
  GameContext.player.vel.x = 0;
  GameContext.player.vel.y = 0;

  GameContext.dungeon1Arena.x = originX;
  GameContext.dungeon1Arena.y = originY;
  GameContext.dungeon1Arena.radius = 2500;
  GameContext.dungeon1Arena.active = true;
  GameContext.dungeon1Arena.growing = false;

  deps.showOverlayMessage("ENTERED DUNGEON 1", "#f80", 2000, 2);
}
