import { SpatialHash } from "./math.js";

export const GameContext = {
  gameActive: false,
  gamePaused: false,
  canResumeGame: false,
  gameEnded: false,
  gameMode: "normal",
  hardcoreMode: false,
  gameStartTime: 0,
  pauseStartTime: 0,
  pausedAccumMs: 0,
  player: null,
  bullets: [],
  bossBombs: [],
  warpBioPods: [],
  staggeredBombExplosions: [],
  staggeredParticleBursts: [],
  guidedMissiles: [],
  napalmZones: [],
  enemies: [],
  pinwheels: [],
  cavePinwheels: [],
  particles: [],
  lightningArcs: [],
  explosions: [],
  floatingTexts: [],
  coins: [],
  nuggets: [],
  goldNuggets: [],
  powerups: [],
  magnetPickups: [],
  nukePickups: [],
  nextNukeSpawnTime: null,
  nukeFlashTimer: 0,
  shootingStars: [],
  drones: [],
  caches: [],
  pois: [],
  environmentAsteroids: [],
  warpParticles: [],
  shockwaves: [],
  starfield: [],
  nebulas: [],
  asteroidGrid: new SpatialHash(300),
  targetGrid: new SpatialHash(350),
  boss: null,
  bossActive: false,
  spaceStation: null,
  destroyer: null,
  radiationStorm: null,
  miniEvent: null,
  warpGate: null,
  verticalScrollingWarpGate: null,
  warpZone: null,
  dungeon1Gate: null,
  dungeon1Zone: null,
  necroticHive: null,
  cerebralPsion: null,
  fleshforge: null,
  vortexMatriarch: null,
  chitinusPrime: null,
  psyLich: null,
  bossArena: {
    x: 0,
    y: 0,
    radius: 2500,
    active: false,
    growing: false,
    countdownActive: false,
    countdownEndTime: 0
  },
  stationArena: { x: 0, y: 0, radius: 2800, active: false },
  caveWarpCountdownAt: null,
  stationSpawnAt: null,
  arenaFightsCompleted: 0,
  arenaFightTarget: 3,
  caveBossArena: { x: 0, y: 0, radius: 2500, active: false, bossSpawned: false },
  dungeon1Arena: { x: 0, y: 0, radius: 3000, active: false },
  caveMode: false,
  caveLevel: null,
  dungeon1Active: false,
  dungeon1CompletedOnce: false,
  dungeon1GateUnlocked: false,
  dungeon1OriginalPos: null,
  warpGateUnlocked: false,
  warpCompletedOnce: false,
  warpCountdownAt: null,
  verticalScrollingMode: false,
  verticalScrollingWarpGateUnlocked: false,
  verticalScrollingWarpGateEnabled: false,
  verticalScrollingZone: null,
  scrollProgress: 0,
  scrollSpeed: 2.0, // pixels per frame (scaled by dtFactor)
  nextRadiationStormAt: 0,
  nextMiniEventAt: 0,
  nextShootingStarTime: 0,
  nextIntensityBreakAt: 0,
  intensityBreakActive: false,
  nextDestroyerSpawnTime: null,
  nextContractAt: 0,
  nextSpaceStationTime: null,
  nextMagnetSpawnTime: null,
  score: 0,
  difficultyTier: 1,
  sectorIndex: 1,
  pinwheelsDestroyed: 0,
  pinwheelsDestroyedTotal: 0,
  gunboatsDestroyed: 0,
  gunboatsDestroyedTotal: 0,
  maxRoamers: 5,
  spaceNuggets: 0,
  highScore: 0,
  totalPlayTimeMs: 0,
  unlockedLevels: [1],
  currentLevel: 1,
  roamerRespawnQueue: [],
  baseRespawnTimers: [],
  asteroidRespawnTimers: [],
  gunboatRespawnAt: null,
  gunboatLevel2Unlocked: false,
  minimapFrame: 0,
  pendingTransitionClear: false,
  suppressWarpGateUntil: 0,
  suppressWarpInputUntil: 0,
  cruiserEncounterCount: 0,
  bossesDestroyedCount: 0,
  pendingStations: 0,
  currentDestroyerType: 1,
  stationHealthBarVisible: false,
  metaProfile: {
    bank: 0,
    purchases: {
      startDamage: 0,
      passiveHp: 0,
      rerollTokens: 0,
      hullPlating: 0,
      shieldCore: 0,
      staticBlueprint: 0,
      missilePrimer: 0,
      nukeCapacitor: 0,
      speedTuning: 0,
      bankMultiplier: 0,
      shopDiscount: 0,
      extraLife: 0,
      droneFabricator: 0,
      piercingRounds: 0,
      explosiveRounds: 0,
      criticalStrike: 0,
      splitShot: 0,
      thornArmor: 0,
      lifesteal: 0,
      evasionBoost: 0,
      shieldRecharge: 0,
      dashCooldown: 0,
      dashDuration: 0,
      autoReroll: 0,
      contractSpeed: 0,
      startingRerolls: 0,
      luckyDrop: 0,
      bountyHunter: 0,
      comboMeter: 0,
      startingWeapon: 0,
      secondWind: 0,
      batteryCapacitor: 0
    }
  },
  rerollTokens: 0,
  metaExtraLifeCount: 0,
  shownUpgradesThisRun: new Set(),
  currentProfileName: null,
  activeContract: null,
  contractSequence: 0,
  contractEntities: {
    beacons: [],
    gates: [],
    anomalies: [],
    fortresses: [],
    wallTurrets: []
  },
  dungeonBossPool: [
    "NecroticHive",
    "CerebralPsion",
    "Fleshforge",
    "VortexMatriarch",
    "ChitinusPrime",
    "PsyLich"
  ],
  bossPool: [
    "Cruiser",
    "NecroticHive",
    "CerebralPsion",
    "Fleshforge",
    "VortexMatriarch",
    "ChitinusPrime",
    "PsyLich"
  ],
  bossesSpawnedThisLevel: [],
  currentSectorForBossReset: null,
  sectorTransitionActive: false,
  keys: { w: false, a: false, s: false, d: false, space: false, shift: false, e: false, f: false },
  mouseState: { down: false, leftDown: false, rightDown: false, middleDown: false },
  mouseScreen: { x: 0, y: 0 },
  mouseWorld: { x: 0, y: 0 },
  gpState: {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    fire: false,
    warp: false,
    turbo: false,
    battery: false,
    pausePressed: false,
    lastMenuElements: null
  },
  gamepadIndex: -1,
  usingGamepad: false,
  lastMouseInputAt: 0,
  lastGamepadInputAt: 0,
  currentZoom: 0.4,
  shakeTimer: 0,
  shakeMagnitude: 0,
  renderAlpha: 0,
  frameNow: 0,
  simAccMs: 0,
  simNowMs: 0,
  simLastPerfAt: 0,
  frameNow: 0,
  width: 1920,
  height: 1080,
  internalWidth: 1920,
  internalHeight: 1080,
  aspectRatio: 16 / 9,
  dreadManager: {
    timerActive: false,
    firstSpawnDone: false,
    cruiserTimerPausedAt: 0,
    upgradesChosen: 0,
    timerAt: null,
    minDelayMs: 120000,
    maxDelayMs: 300000
  },
  cruiserTimerPausedAt: null,
  cruiserTimerResumeAt: 0,
  arcadeBoss: null,
  arcadeWave: 0,
  arcadeWaveNextAt: 0,
  menuSelectionIndex: 0,
  overlayTimeout: null,
  DEBUG_COLLISION: false,
  /** When true, log shield hit / hull bypass for Pinwheel and Gunboat (set in console: GameContext.DEBUG_SHIELD_BYPASS = true) */
  DEBUG_SHIELD_BYPASS: false,
  TEST_WARP_GATE_AT_START: false, // Set to true to spawn warp gate at game start for testing
  // Death screen statistics
  damageByWeaponType: {},
  enemyKills: 0,
  bossKills: 0,
  totalDamageDealt: 0,
  /**
   * @returns {void}
   */
  reset() {
    this.gameActive = false;
    this.gamePaused = false;
    this.gameEnded = false;
    this.score = 0;
    this.difficultyTier = 1;
    this.sectorIndex = 1;
    this.spaceNuggets = 0;
    this.bullets = [];
    this.bossBombs = [];
    this.warpBioPods = [];
    this.staggeredBombExplosions = [];
    this.staggeredParticleBursts = [];
    this.guidedMissiles = [];
    this.napalmZones = [];
    this.enemies = [];
    this.pinwheels = [];
    this.cavePinwheels = [];
    this.particles = [];
    this.lightningArcs = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.coins = [];
    this.nuggets = [];
    this.goldNuggets = [];
    this.powerups = [];
    this.magnetPickups = [];
    this.nukePickups = [];
    this.nextNukeSpawnTime = null;
    this.nukeFlashTimer = 0;
    this.shootingStars = [];
    this.drones = [];
    this.caches = [];
    this.pois = [];
    this.environmentAsteroids = [];
    this.warpParticles = [];
    this.shockwaves = [];
    this.boss = null;
    this.bossActive = false;
    this.spaceStation = null;
    this.destroyer = null;
    this.radiationStorm = null;
    this.miniEvent = null;
    this.warpGate = null;
    this.verticalScrollingWarpGate = null;
    this.warpZone = null;
    this.dungeon1Gate = null;
    this.dungeon1Zone = null;
    this.necroticHive = null;
    this.cerebralPsion = null;
    this.fleshforge = null;
    this.vortexMatriarch = null;
    this.chitinusPrime = null;
    this.psyLich = null;
    this.bossArena = { x: 0, y: 0, radius: 2500, active: false, growing: false };
    this.stationArena = { x: 0, y: 0, radius: 2800, active: false };
    this.caveBossArena = { x: 0, y: 0, radius: 2500, active: false, bossSpawned: false };
    this.dungeon1Arena = { x: 0, y: 0, radius: 3000, active: false };
    this.caveMode = false;
    this.caveLevel = null;
    this.dungeon1Active = false;
    this.dungeon1CompletedOnce = false;
    this.dungeon1GateUnlocked = false;
    this.dungeon1OriginalPos = null;
    this.bossesSpawnedThisLevel = [];
    this.currentSectorForBossReset = null;
    this.warpGateUnlocked = false;
    this.warpCompletedOnce = false;
    this.warpCountdownAt = null;
    this.verticalScrollingMode = false;
    this.verticalScrollingWarpGateUnlocked = false;
    this.verticalScrollingZone = null;
    this.scrollProgress = 0;
    this.scrollSpeed = 2.0;
    this.nextRadiationStormAt = 0;
    this.nextMiniEventAt = 0;
    this.nextShootingStarTime = 0;
    this.nextIntensityBreakAt = 0;
    this.intensityBreakActive = false;
    this.nextDestroyerSpawnTime = null;
    this.nextContractAt = 0;
    this.nextSpaceStationTime = null;
    this.nextMagnetSpawnTime = null;
    this.pinwheelsDestroyed = 0;
    this.pinwheelsDestroyedTotal = 0;
    this.gunboatsDestroyed = 0;
    this.gunboatsDestroyedTotal = 0;
    this.maxRoamers = 5;
    this.roamerRespawnQueue = [];
    this.baseRespawnTimers = [];
    this.asteroidRespawnTimers = [];
    this.gunboatRespawnAt = null;
    this.gunboatLevel2Unlocked = false;
    this.minimapFrame = 0;
    this.pendingTransitionClear = false;
    this.suppressWarpGateUntil = 0;
    this.suppressWarpInputUntil = 0;
    this.pendingStations = 0;
    this.stationHealthBarVisible = false;
    this.arenaFightsCompleted = 0;
    this.arenaFightTarget = 3;
    this.caveWarpCountdownAt = null;
    this.stationSpawnAt = null;
    this.rerollTokens = 0;
    this.metaExtraLifeCount = 0;
    this.shownUpgradesThisRun = new Set();
    this.activeContract = null;
    this.contractSequence = 0;
    this.contractEntities = {
      beacons: [],
      gates: [],
      anomalies: [],
      fortresses: [],
      wallTurrets: []
    };
    this.sectorTransitionActive = false;
    this.dreadManager = {
      timerActive: false,
      firstSpawnDone: false,
      cruiserTimerPausedAt: 0,
      upgradesChosen: 0,
      timerAt: null,
      minDelayMs: 120000,
      maxDelayMs: 300000
    };
    this.cruiserTimerPausedAt = null;
    this.cruiserTimerResumeAt = 0;
    this.damageByWeaponType = {};
    this.enemyKills = 0;
    this.bossKills = 0;
    this.bossesDestroyedCount = 0;
    this.totalDamageDealt = 0;
    this.asteroidGrid.clear();
    this.targetGrid.clear();
  }
};

/**
 * @returns {number}
 */
export function getElapsedGameTime() {
  if (!GameContext.gameActive) return 0;
  return Date.now() - GameContext.gameStartTime - GameContext.pausedAccumMs;
}

/**
 * @returns {number} Multiplier for enemy HP based on elapsed time (1.0 to 4.0 over 30 mins)
 */
export function getEnemyHpScaling() {
  if (!GameContext.gameActive) return 1;
  const elapsed = getElapsedGameTime();
  // Scale: 1.0 (start) -> 4.0 (30 mins)
  // +10 HP base added elsewhere
  return 1 + (elapsed / (30 * 60 * 1000)) * 3;
}
