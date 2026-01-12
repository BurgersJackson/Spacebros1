# SPACEBROS1 REFACTORING IMPLEMENTATION GUIDE

## Document Purpose

This document provides a complete implementation plan for refactoring the monolithic `main.js` file (~29,285 lines, 1.2MB) into a modular, maintainable codebase. Follow the phases in order - each builds upon the previous.

---

## Pre-Implementation Checklist

Before starting any phase:

1. **Verify the game runs**: `npm run start:dev`
2. **Create a git branch**: `git checkout -b refactor/phase-N`
3. **After each module extraction**: Run the game and test basic gameplay (move, shoot, kill enemies, collect coins, level up)

---

## Project Context

### Current State
| Metric | Value |
|--------|-------|
| **main.js size** | **29,285 lines** (~1.2MB) |
| **Classes in main.js** | **62 classes** |
| **Global variables** | **~242 `let` declarations** |
| **Already modularized** | ~15 files (core, audio, some entities) |

### Current Structure
```
src/js/
├── main.js                    # 29,285 lines - EVERYTHING is here
├── core/                      # Already extracted
│   ├── constants.js           # Game constants, upgrade data
│   ├── game-context.js        # Central state singleton (extracted)
│   ├── math.js                # Vector, SpatialHash
│   ├── performance.js         # View bounds, bullet grid
│   ├── profiler.js            # Performance profiling
│   ├── jitter-monitor.js      # Frame timing
│   └── staggered-cleanup.js   # Array cleanup utilities
├── audio/
│   └── audio-manager.js       # Sound system (complete)
├── rendering/
│   ├── pixi-setup.js          # PixiJS initialization
│   ├── sprite-pools.js        # Sprite pool management
│   ├── colors.js              # Color utilities
│   ├── pixi-context.js        # Centralized PixiJS state access
│   ├── texture-loader.js      # Texture loading (extracted)
│   ├── background-renderer.js # Background rendering (extracted)
│   └── minimap-renderer.js    # Minimap rendering (extracted)
└── entities/
    ├── Entity.js              # Base entity class
    ├── FloatingText.js        # Damage numbers
    ├── particles/             # Particle, Explosion, LightningArc
    ├── pickups/               # Coin, SpaceNugget, HealthPowerUp
    └── projectiles/           # Bullet
```

### Target Structure
```
src/js/
├── main.js                    # ~500 lines (bootstrap only)
├── core/
│   ├── game-context.js        # NEW: Central state singleton
│   ├── constants.js           # Existing
│   ├── math.js                # Existing
│   └── ...existing files
├── systems/                   # NEW FOLDER
│   ├── index.js
│   ├── game-loop.js
│   ├── input-manager.js
│   ├── collision-manager.js
│   ├── spawn-manager.js
│   ├── upgrade-manager.js
│   ├── contract-manager.js
│   ├── event-scheduler.js
│   ├── save-manager.js
│   └── meta-manager.js
├── entities/
│   ├── player/                # NEW FOLDER
│   │   ├── index.js
│   │   └── Spaceship.js
│   ├── enemies/               # NEW FOLDER
│   │   ├── index.js
│   │   ├── Enemy.js
│   │   └── Pinwheel.js
│   ├── bosses/                # NEW FOLDER
│   │   ├── index.js
│   │   ├── Cruiser.js
│   │   ├── Flagship.js
│   │   ├── FinalBoss.js
│   │   ├── WarpSentinelBoss.js
│   │   ├── SpaceStation.js
│   │   ├── Destroyer.js
│   │   └── dungeon/
│   │       ├── NecroticHive.js
│   │       ├── CerebralPsion.js
│   │       ├── Fleshforge.js
│   │       ├── VortexMatriarch.js
│   │       ├── ChitinusPrime.js
│   │       └── PsyLich.js
│   ├── environment/           # NEW FOLDER
│   │   ├── index.js
│   │   ├── EnvironmentAsteroid.js
│   │   ├── WarpGate.js
│   │   └── Dungeon1Gate.js
│   ├── cave/                  # NEW FOLDER
│   │   ├── index.js
│   │   ├── CaveLevel.js
│   │   ├── CaveMonsterBase.js
│   │   └── ...cave entities
│   ├── zones/                 # NEW FOLDER
│   │   ├── index.js
│   │   ├── WarpMazeZone.js
│   │   ├── Dungeon1Zone.js
│   │   └── RadiationStorm.js
│   ├── support/               # NEW FOLDER
│   │   ├── index.js
│   │   ├── Drone.js
│   │   ├── ContractBeacon.js
│   │   └── GateRing.js
│   └── ...existing folders
├── rendering/
│   ├── texture-loader.js      # NEW
│   ├── background-renderer.js # NEW
│   ├── minimap-renderer.js    # NEW
│   ├── pixi-context.js        # NEW: centralized PixiJS state access
│   └── ...existing files
├── ui/                        # NEW FOLDER
│   ├── index.js
│   ├── menus.js
│   ├── levelup-screen.js
│   ├── meta-shop.js
│   └── hud.js
└── data/                      # NEW FOLDER
    ├── index.js
    └── upgrade-data.js
```

---

## Current Implementation Status (as of 2026-01-12T11:38:56-08:00)

### Completed
- **Phase 1**: `src/js/core/game-context.js` exists and is in use.
- **Phase 2 (partial)**: `src/js/systems/` contains `save-manager.js`, `meta-manager.js`, `upgrade-manager.js`, `contract-manager.js`, `event-scheduler.js`.
- **Phase 3**: `src/js/rendering/texture-loader.js`, `src/js/rendering/background-renderer.js`, `src/js/rendering/minimap-renderer.js` are extracted.
- **Rendering bridge**: `src/js/rendering/pixi-context.js` is in place for centralized PixiJS layers/pools/textures. Most extracted entities use it, while particle systems still rely on a `pixiResources` object passed in by `main.js`.
- **Phase 4 (partial)**:
  - Environment: `EnvironmentAsteroid`, `WarpGate`, `Dungeon1Gate`
  - Enemies: `Enemy`, `Pinwheel`
  - Projectiles: `Bullet`, `Shockwave`, `CruiserMineBomb`, `FlagshipGuidedMissile`
  - Bosses: `Cruiser`, `Flagship`

### Remaining Work
- **Phase 4**:
  - Bosses: `SuperFlagshipBoss`, `WarpSentinelBoss`, `FinalBoss`, `SpaceStation`, `Destroyer`, `Destroyer2`, dungeon bosses (NecroticHive, CerebralPsion, Fleshforge, VortexMatriarch, ChitinusPrime, PsyLich)
  - Projectiles: `Destroyer2GuidedMissile`, `ClusterBomb`, `NapalmZone`
  - Cave entities: `CaveLevel`, `CaveMonsterBase`, `CaveMonster1/2/3`, `CaveWallTurret`, `CaveGasVent`, `CaveRockfall`, `CaveDraftZone`, `CaveCritter`, `CaveGuidedMissile`
  - Zones: `WarpMazeZone`, `Dungeon1Zone`, `RadiationStorm`, `AnomalyZone`
  - Support: `Drone`, `ContractBeacon`, `GateRing`, `WallTurret`
  - Player: `Spaceship`
  - Remove legacy `Bullet` from `main.js` after all references are migrated.
- **Phase 5**: Input manager, collision manager, spawn manager, and game loop extraction.
- **Phase 6**: UI module extraction.

---

## CLASS INVENTORY (62 Classes in main.js)

### Player & Core Entities
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 3501 | `Spaceship` | `Entity` | Player ship with stats, abilities, shields |
| 5650 | `Bullet` | `Entity` | Projectiles (NOTE: Already in entities/projectiles/) |
| 5029 | `Shockwave` | `Entity` | Expanding damage wave effect |

### Environmental Objects
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 3141 | `EnvironmentAsteroid` | `Entity` | Destructible/indestructible asteroids |
| 5559 | `ShootingStar` | `Entity` | Visual shooting star effect |

### Enemies & AI
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 6035 | `Enemy` | `Entity` | Base enemy class (roamer, elite_roamer, hunter, defender, gunboat) |
| 6920 | `Pinwheel` | `Entity` | Spinning defensive structure/base |

### Boss Classes
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 11310 | `Cruiser` | `Enemy` | Primary boss ship (multi-phase) |
| 11888 | `Flagship` | `Cruiser` | Enhanced cruiser variant |
| 12000 | `SuperFlagshipBoss` | `Flagship` | Ultimate flagship boss |
| 12771 | `WarpSentinelBoss` | `Entity` | Warp dimension boss |
| 13578 | `FinalBoss` | `Entity` | End-game final boss |
| 16368 | `SpaceStation` | `Entity` | Orbital station boss/objective |
| 17061 | `Destroyer` | `Entity` | Destroyer-class ship |
| 17803 | `Destroyer2` | `Entity` | Advanced destroyer variant |

### Dungeon Bosses
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 14400 | `NecroticHive` | `Enemy` | Bio-mechanical swarm controller |
| 14733 | `CerebralPsion` | `Enemy` | Psionic mind controller |
| 15062 | `Fleshforge` | `Enemy` | Living bio-factory |
| 15339 | `VortexMatriarch` | `Enemy` | Gravity manipulating hive mother |
| 15658 | `ChitinusPrime` | `Enemy` | Armored bio-tank |
| 15965 | `PsyLich` | `Enemy` | Undying phase-shifting entity |

### Boss Projectiles & Mechanics
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 5205 | `CruiserMineBomb` | `Entity` | Cruiser's mine bombs |
| 5316 | `FlagshipGuidedMissile` | `Entity` | Homing missiles from flagship |
| 5550 | `Destroyer2GuidedMissile` | `FlagshipGuidedMissile` | Destroyer2 variant missiles |
| 5833 | `ClusterBomb` | `Entity` | Multi-explosion cluster bomb |
| 5923 | `NapalmZone` | `Entity` | Persistent damage zone |

### Cave/Dungeon Entities
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 7518 | `CaveGuidedMissile` | `Entity` | Cave-environment missile |
| 7771 | `CaveWallTurret` | `Entity` | Wall-mounted turret |
| 8182 | `CaveWallSwitch` | `Entity` | Interactive switch |
| 8257 | `CavePowerRelay` | `Entity` | Power distribution node |
| 8324 | `CaveRewardPickup` | `Entity` | Cave loot pickup |
| 8397 | `AsteroidTurret` | `CaveWallTurret` | Asteroid-based turret |
| 8421 | `CaveGasVent` | `Entity` | Hazardous gas vent |
| 8501 | `CaveRockfall` | `Entity` | Falling rock hazard |
| 8628 | `CaveDraftZone` | `Entity` | Movement-affecting zone |
| 8704 | `CaveCritter` | `Entity` | Small cave creature |
| 8766 | `CaveLevel` | *(standalone)* | Cave level manager |
| 18482 | `CaveMonsterBase` | `Entity` | Base class for cave monsters |
| 19138 | `CaveMonster1` | `CaveMonsterBase` | Cave monster variant 1 |
| 19349 | `CaveMonster2` | `CaveMonsterBase` | Cave monster variant 2 |
| 19472 | `CaveMonster3` | `CaveMonsterBase` | Cave monster variant 3 |

### Warp/Dimension Entities
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 7334 | `WarpGate` | `Entity` | Portal to warp dimension |
| 7416 | `Dungeon1Gate` | `Entity` | Dungeon entry portal |
| 10048 | `WarpTurret` | `Entity` | Warp zone turret |
| 10125 | `WarpMazeZone` | `Entity` | Warp maze instance/manager |
| 10381 | `Dungeon1Zone` | `Entity` | Dungeon 1 zone instance |
| 12251 | `WarpBioPod` | `Entity` | Warp biological pod |
| 12371 | `DungeonDrone` | `Entity` | Autonomous dungeon drone |
| 12465 | `PsychicEcho` | `Entity` | Psionic echo effect |
| 12556 | `GravityWell` | `Entity` | Gravity manipulation zone |
| 12663 | `SoulDrainTether` | `Entity` | Life-draining tether |

### Events & POIs
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 10610 | `RadiationStorm` | `Entity` | Environmental radiation event |
| 10762 | `MiniEventDefendCache` | `Entity` | Defense objective mini-event |
| 10961 | `SectorPOI` | `Entity` | Base Point of Interest |
| 11099 | `DerelictShipPOI` | `SectorPOI` | Abandoned ship POI |
| 11107 | `DebrisFieldPOI` | `SectorPOI` | Debris field POI |
| 11225 | `ExplorationCache` | `Entity` | Lootable cache |

### Support/Utility Entities
| Line | Class | Extends | Description |
|------|-------|---------|-------------|
| 21391 | `Drone` | `Entity` | Player companion drone |
| 21548 | `ContractBeacon` | `Entity` | Contract objective beacon |
| 21733 | `GateRing` | `Entity` | Gate run checkpoint ring |
| 21836 | `AnomalyZone` | `Entity` | Anomaly contract zone |
| 22144 | `WallTurret` | `Entity` | Defensive wall turret |

---

## SYSTEM/MANAGER LOCATIONS

### Game Loop System (Lines ~25010-25090)
- `mainLoop()` - Main animation frame loop with FPS counter
- `gameLoopLogic(opts)` - Core update/draw logic with fixed timestep simulation
- Fixed timestep: 60 FPS simulation (`SIM_STEP_MS = 16.67ms`)

### Input Handling System (Lines ~2560-2620, ~28308-28490)
- Keyboard: `keys` object tracking WASD, Space, Shift, E, F
- Mouse: `mouseState`, `mouseScreen`, `mouseWorld` coordinates
- Gamepad: `gpState` object, `updateGamepad()` function

### Upgrade System (Lines ~24200-24520)
- `UPGRADE_DATA` - Constant defining all upgrades with tiers
- `applyUpgrade(id, tier)` - Applies upgrade effects to player
- `showLevelUpMenu()` - Displays upgrade selection UI

### Meta Profile System (Lines ~20707-20900, ~23015-23400)
- `metaProfile` - Persistent upgrade purchases across runs
- `loadMetaProfile()` / `saveMetaProfile()` - localStorage persistence
- `buildProfileData()` / `applyProfile()` - Save/load game state

### Collision System (Lines ~22334-22900)
- `resolveEntityCollision()` - Main collision resolver (~500 lines)
- `checkWallCollision(entity)` - Cave/arena wall collisions
- `SpatialHash` grids: `asteroidGrid`, `targetGrid`, `bulletGrid`

### Spawning System
- `findSpawnPointRelative()` (~Line 22315) - Safe spawn position
- `spawnNewPinwheelRelative()` (~Line 23886) - Pinwheel base spawning
- `spawnOneAsteroidRelative()` (~Line 3384) - Asteroid spawning

### Contract System (Lines ~25209-25266, ~21473-21530)
- `activeContract` - Current contract objective
- `contractEntities` - Beacons, gates, anomalies
- `updateContractUI()` / `completeContract()`

---

## DEPENDENCY MAP

### Critical Circular Dependencies to Resolve

| Cycle | Entities Involved | Resolution Strategy |
|-------|-------------------|---------------------|
| Entity ↔ Global Arrays | All entities push to `bullets[]`, `coins[]`, etc. | Use GameContext singleton |
| Spawning ↔ Player | `findSpawnPointRelative` needs `player.pos` | Pass player reference or use GameContext |
| Boss ↔ Arena | Cruiser/Station modify `bossArena` | Use GameContext.bossArena |
| Audio ↔ All Entities | Every entity calls `playSound()` | Import audio module directly |
| Collision ↔ All Entities | Collision references entity types by class | Use `instanceof` checks with imported classes |

### Entity Class Dependencies

**Spaceship** (Player):
- Reads: `keys`, `gpState`, `mouseState`, `usingGamepad`, game state flags
- Writes: `gameActive` (via levelUp), shake effects
- Creates: `Bullet`, `ClusterBomb`
- Calls: UI update functions, `playSound`, `spawnParticles`

**Enemy** (Base class):
- Reads: `player`, `difficultyTier`, `caveMode`
- Writes: `coins[]`, `nuggets[]`, `roamerRespawnQueue[]`
- Creates: `Coin`, `SpaceNugget`, `Bullet`
- Calls: `playSound`, spawn functions, cleanup functions

**Cruiser** (Boss):
- Reads: `player`, `bullets`, `bossBombs`, `enemies`, `bossArena`
- Writes: `enemies[]`, `bossBombs[]`, `bossActive`, `boss`
- Creates: `Bullet`, `CruiserMineBomb`, `Enemy`
- Calls: explosion functions, `playSound`, `setMusicMode`

---

## PHASE 1: FOUNDATION (LOW RISK)

**Estimated Time**: 2-3 hours
**Risk Level**: LOW

**Status**: COMPLETE (GameContext extracted and in use).

### 1.1 Create GameContext Singleton

**Create file**: `src/js/core/game-context.js`

```javascript
/**
 * GameContext - Central state singleton for all game state
 * All modules should import this instead of using globals
 */

import { SpatialHash } from './math.js';

export const GameContext = {
    // === Core Game State ===
    gameActive: false,
    gamePaused: false,
    canResumeGame: false,
    gameEnded: false,
    gameMode: 'normal',  // 'normal' or 'arcade'
    gameStartTime: 0,
    pauseStartTime: 0,
    pausedAccumMs: 0,
    
    // === Player Reference ===
    player: null,
    
    // === Entity Arrays ===
    bullets: [],
    bossBombs: [],
    warpBioPods: [],
    staggeredBombExplosions: [],
    staggeredParticleBursts: [],
    guidedMissiles: [],
    napalmZones: [],
    enemies: [],
    pinwheels: [],
    particles: [],
    lightningArcs: [],
    explosions: [],
    floatingTexts: [],
    coins: [],
    nuggets: [],
    powerups: [],
    shootingStars: [],
    drones: [],
    caches: [],
    pois: [],
    environmentAsteroids: [],
    warpParticles: [],
    shockwaves: [],
    starfield: [],
    nebulas: [],
    
    // === Spatial Grids ===
    asteroidGrid: new SpatialHash(300),
    targetGrid: new SpatialHash(350),
    
    // === Boss/Major Entity References ===
    boss: null,
    bossActive: false,
    spaceStation: null,
    destroyer: null,
    radiationStorm: null,
    miniEvent: null,
    warpGate: null,
    warpZone: null,
    dungeon1Gate: null,
    dungeon1Zone: null,
    
    // Dungeon bosses
    necroticHive: null,
    cerebralPsion: null,
    fleshforge: null,
    vortexMatriarch: null,
    chitinusPrime: null,
    psyLich: null,
    
    // === Arena States ===
    bossArena: { x: 0, y: 0, radius: 2500, active: false, growing: false, countdownActive: false, countdownEndTime: 0 },
    stationArena: { x: 0, y: 0, radius: 2800, active: false },
    dungeon1Arena: { x: 0, y: 0, radius: 3000, active: false },
    
    // === Cave/Warp State ===
    caveMode: false,
    caveLevel: null,
    dungeon1Active: false,
    dungeon1CompletedOnce: false,
    dungeon1GateUnlocked: false,
    dungeon1OriginalPos: null,
    warpGateUnlocked: false,
    warpCompletedOnce: false,
    warpCountdownAt: null,
    
    // === Timing/Scheduling ===
    nextRadiationStormAt: 0,
    nextMiniEventAt: 0,
    nextShootingStarTime: 0,
    nextIntensityBreakAt: 0,
    intensityBreakActive: false,
    nextDestroyerSpawnTime: null,
    nextContractAt: 0,
    nextSpaceStationTime: null,
    
    // === Progression ===
    score: 0,
    difficultyTier: 1,
    sectorIndex: 1,
    pinwheelsDestroyed: 0,
    pinwheelsDestroyedTotal: 0,
    maxRoamers: 5,
    spaceNuggets: 0,
    totalKills: 0,
    highScore: 0,
    totalPlayTimeMs: 0,
    
    // === Respawn Queues ===
    roamerRespawnQueue: [],
    baseRespawnTimers: [],
    asteroidRespawnTimers: [],
    gunboatRespawnAt: null,
    gunboatLevel2Unlocked: false,
    
    // === Boss Encounter Tracking ===
    cruiserEncounterCount: 0,
    pendingStations: 0,
    currentDestroyerType: 1,
    stationHealthBarVisible: false,
    
    // === Meta Progression ===
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
            magnetBooster: 0,
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
            xpMagnetPlus: 0,
            autoReroll: 0,
            nuggetMagnet: 0,
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
    
    // === Contract System ===
    activeContract: null,
    contractSequence: 0,
    contractEntities: {
        beacons: [],
        gates: [],
        anomalies: [],
        fortresses: [],
        wallTurrets: []
    },
    
    // === Input State ===
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
    
    // === Rendering State ===
    currentZoom: 0.4,
    shakeTimer: 0,
    shakeMagnitude: 0,
    renderAlpha: 0,
    frameNow: 0,
    
    // === Simulation Timing ===
    simAccMs: 0,
    simNowMs: 0,
    simLastPerfAt: 0,
    
    // === Canvas Dimensions ===
    width: 1920,
    height: 1080,
    internalWidth: 1920,
    internalHeight: 1080,
    aspectRatio: 16/9,
    
    // === Dread Manager (Boss Scheduling) ===
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
    
    // === Arcade Mode ===
    arcadeBoss: null,
    arcadeWave: 0,
    arcadeWaveNextAt: 0,
    
    // === UI State ===
    menuSelectionIndex: 0,
    overlayTimeout: null,
    minimapFrame: 0,
    pendingTransitionClear: false,
    
    // === Debug ===
    DEBUG_COLLISION: false,
    
    // === Reset Function ===
    reset() {
        this.gameActive = false;
        this.gamePaused = false;
        this.gameEnded = false;
        this.score = 0;
        this.difficultyTier = 1;
        this.sectorIndex = 1;
        this.spaceNuggets = 0;

        // Clear entity arrays
        this.bullets = [];
        this.bossBombs = [];
        this.warpBioPods = [];
        this.staggeredBombExplosions = [];
        this.staggeredParticleBursts = [];
        this.guidedMissiles = [];
        this.napalmZones = [];
        this.enemies = [];
        this.pinwheels = [];
        this.particles = [];
        this.lightningArcs = [];
        this.explosions = [];
        this.floatingTexts = [];
        this.coins = [];
        this.nuggets = [];
        this.powerups = [];
        this.shootingStars = [];
        this.drones = [];
        this.caches = [];
        this.pois = [];
        this.environmentAsteroids = [];
        this.warpParticles = [];
        this.shockwaves = [];

        // Clear boss references
        this.boss = null;
        this.bossActive = false;
        this.spaceStation = null;
        this.destroyer = null;
        this.radiationStorm = null;
        this.miniEvent = null;
        this.warpGate = null;
        this.warpZone = null;
        this.dungeon1Gate = null;
        this.dungeon1Zone = null;
        this.necroticHive = null;
        this.cerebralPsion = null;
        this.fleshforge = null;
        this.vortexMatriarch = null;
        this.chitinusPrime = null;
        this.psyLich = null;

        // Reset arenas
        this.bossArena = { x: 0, y: 0, radius: 2500, active: false, growing: false };
        this.stationArena = { x: 0, y: 0, radius: 2800, active: false };
        this.dungeon1Arena = { x: 0, y: 0, radius: 3000, active: false };

        // Reset cave/warp state
        this.caveMode = false;
        this.caveLevel = null;
        this.dungeon1Active = false;
        this.dungeon1CompletedOnce = false;
        this.dungeon1GateUnlocked = false;
        this.dungeon1OriginalPos = null;
        this.warpGateUnlocked = false;
        this.warpCompletedOnce = false;
        this.warpCountdownAt = null;

        // Reset timing
        this.nextRadiationStormAt = 0;
        this.nextMiniEventAt = 0;
        this.nextShootingStarTime = 0;
        this.nextIntensityBreakAt = 0;
        this.intensityBreakActive = false;
        this.nextDestroyerSpawnTime = null;
        this.nextContractAt = 0;
        this.nextSpaceStationTime = null;

        // Reset progression
        this.pinwheelsDestroyed = 0;
        this.pinwheelsDestroyedTotal = 0;
        this.maxRoamers = 5;

        // Clear respawn queues
        this.roamerRespawnQueue = [];
        this.baseRespawnTimers = [];
        this.asteroidRespawnTimers = [];
        this.gunboatRespawnAt = null;
        this.gunboatLevel2Unlocked = false;

        // Reset state flags
        this.minimapFrame = 0;
        this.pendingTransitionClear = false;
        this.pendingStations = 0;
        this.stationHealthBarVisible = false;
        this.sectorTransitionActive = false;

        // Reset meta state
        this.rerollTokens = 0;
        this.metaExtraLifeCount = 0;
        this.shownUpgradesThisRun = new Set();
        this.activeContract = null;
        this.contractSequence = 0;
        this.contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };

        // Reset dread manager
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

        // Clear grids
        this.asteroidGrid.clear();
        this.targetGrid.clear();
    }
};

// Convenience function to get elapsed game time
export function getElapsedGameTime() {
    if (!GameContext.gameActive) return 0;
    return Date.now() - GameContext.gameStartTime - GameContext.pausedAccumMs;
}
```

### 1.2 Update core/index.js

**Modify file**: `src/js/core/index.js`

```javascript
/**
 * Core Module Index
 * Re-exports all core utilities for convenient imports.
 */

export * from './constants.js';
export * from './math.js';
export * from './state.js';
export * from './performance.js';
export * from './game-context.js';  // ADD THIS LINE
```

### 1.3 Create Utility Modules

**Create file**: `src/js/utils/index.js`

```javascript
/**
 * Utils Module Index
 */

export * from './spawn-utils.js';
export * from './cleanup-utils.js';
export * from './ui-helpers.js';
```

**Create file**: `src/js/utils/spawn-utils.js`

Extract from main.js (~line 22315):
- `findSpawnPointRelative(state, random, min, max)`

**Create file**: `src/js/utils/cleanup-utils.js`

Extract from main.js:
- `pixiCleanupObject(entity)`
- `clearArrayWithPixiCleanup(arr)`
- `destroyBulletSprite(bullet)`

**Create file**: `src/js/utils/ui-helpers.js`

Extract from main.js:
- `formatTime(ms)`
- `showOverlayMessage(text, color, duration, priority)`
- `clearOverlayMessageTimeout()`
- `updateHealthUI(state)`
- `updateWarpUI(state)`
- `updateTurboUI(state)`
- `updateXpUI(state)`
- `updateContractUI(state)`

### 1.4 Test Phase 1

After creating these files:
1. Add imports to main.js for `GameContext`
2. Gradually replace global variable references with `GameContext.variableName`
3. Run `npm run start:dev` and verify game still works

---

## PHASE 2: ISOLATED SYSTEMS (MEDIUM RISK)

**Estimated Time**: 4-6 hours
**Risk Level**: MEDIUM

**Status**: IN PROGRESS (save/meta/upgrade/contract/event-scheduler extracted; input/collision/spawn/game-loop not yet extracted).

### 2.1 Save Manager

**Create file**: `src/js/systems/save-manager.js`

Extract from main.js (lines ~23024-23400):

```javascript
/**
 * Save Manager - Handles game save/load and profile management
 */

import { GameContext } from '../core/game-context.js';

const SAVE_PREFIX = 'spacebros_save_';

export function buildProfileData() {
    // Extract from main.js
}

export function applyProfile(data) {
    // Extract from main.js
}

export function saveGame() {
    // Extract from main.js
}

export function loadGame(slotName) {
    // Extract from main.js
}

export function listSaveSlots() {
    // Extract from main.js
}

export function selectProfile(name) {
    // Extract from main.js
}

export function createNewProfile(name) {
    // Extract from main.js
}

export function deleteProfile(name) {
    // Extract from main.js
}
```

### 2.2 Meta Manager

**Create file**: `src/js/systems/meta-manager.js`

Extract from main.js (lines ~20707-21130):

```javascript
/**
 * Meta Manager - Handles persistent meta progression
 */

import { GameContext } from '../core/game-context.js';
import { META_SHOP_UPGRADE_DATA } from '../core/constants.js';

export function loadMetaProfile() {
    // Extract from main.js
}

export function saveMetaProfile() {
    // Extract from main.js
}

export function applyMetaUpgrades() {
    // Extract from main.js - applies meta upgrades to player at run start
}

export function getMetaUpgradeCost(upgradeId, currentTier) {
    // Extract from main.js
}

export function purchaseMetaUpgrade(upgradeId) {
    // Extract from main.js
}

export function updateMetaUI() {
    // Extract from main.js
}

export function getDiminishingValue(baseCost, tier, scale) {
    // Extract from main.js
}
```

### 2.3 Contract Manager

**Create file**: `src/js/systems/contract-manager.js`

Extract from main.js (lines ~25209-25266, ~21473-21544):

```javascript
/**
 * Contract Manager - Handles contract objectives
 */

import { GameContext } from '../core/game-context.js';
import { playSound } from '../audio/audio-manager.js';

const CONTRACT_TYPES = ['kill', 'collect', 'beacon', 'gate_run', 'anomaly', 'fortress'];

export function startNewContract() {
    // Extract from main.js
}

export function updateContract(deltaTime) {
    // Extract from main.js
}

export function completeContract() {
    // Extract from main.js
}

export function clearContractEntities() {
    // Extract from main.js
}

export function updateContractUI() {
    // Extract from main.js
}

export function getContractReward(type, difficulty) {
    // Extract from main.js
}
```

### 2.4 Event Scheduler

**Create file**: `src/js/systems/event-scheduler.js`

Extract from main.js:

```javascript
/**
 * Event Scheduler - Handles boss spawns, events, and timing
 */

import { GameContext, getElapsedGameTime } from '../core/game-context.js';

export const dreadManager = {
    timerActive: false,
    firstSpawnDone: false,
    cruiserTimerPausedAt: 0,
    upgradesChosen: 0,
    
    update(deltaTime) {
        // Boss scheduling logic
    },
    
    pause() {
        // Pause timer
    },
    
    resume() {
        // Resume timer
    }
};

export function scheduleNextShootingStar() {
    // Extract from main.js
}

export function scheduleNextRadiationStorm() {
    // Extract from main.js
}

export function scheduleNextMiniEvent() {
    // Extract from main.js
}

export function startArenaCountdown(duration, onComplete) {
    // Extract from main.js
}

export function updateArenaCountdownDisplay() {
    // Extract from main.js
}

export function stopArenaCountdown() {
    // Extract from main.js
}
```

### 2.5 Upgrade Manager

**Create file**: `src/js/systems/upgrade-manager.js`

Extract from main.js (lines ~24200-24520):

```javascript
/**
 * Upgrade Manager - Handles level-up upgrades
 */

import { GameContext } from '../core/game-context.js';
import { UPGRADE_DATA } from '../core/constants.js';
import { playSound } from '../audio/audio-manager.js';

export function applyUpgrade(id, tier) {
    // Extract from main.js - the big switch statement
}

export function getUpgradeDescription(id, tier) {
    // Extract from main.js
}

export function getAvailableUpgrades(count = 3) {
    // Extract from main.js - random selection logic
}

export function showLevelUpMenu() {
    // Extract from main.js
}

export function hideLevelUpMenu() {
    // Extract from main.js
}

export function handleUpgradeSelection(index) {
    // Extract from main.js
}

export function rerollUpgrades() {
    // Extract from main.js
}
```

### 2.6 Create Systems Index

**Create file**: `src/js/systems/index.js`

```javascript
/**
 * Systems Module Index
 */

export * from './save-manager.js';
export * from './meta-manager.js';
export * from './contract-manager.js';
export * from './event-scheduler.js';
export * from './upgrade-manager.js';
```

### 2.7 Test Phase 2

After creating these files:
1. Import systems in main.js
2. Replace inline code with system function calls
3. Run `npm run start:dev`
4. Test: Save/load game, meta shop purchases, level-up upgrades, contracts

---

## PHASE 3: RENDERING MODULES (MEDIUM RISK)

**Estimated Time**: 3-4 hours
**Risk Level**: MEDIUM

**Status**: IN PROGRESS (texture-loader, background-renderer, minimap-renderer, pixi-context extracted; main.js still owns some Pixi globals and particle rendering uses per-call pixiResources).

### 3.1 Texture Loader

**Create file**: `src/js/rendering/texture-loader.js`

Extract from main.js (lines ~612-1290):

```javascript
/**
 * Texture Loader - Handles all texture/sprite loading
 */

export const pixiTextures = {
    coin1: null,
    coin5: null,
    coin10: null,
    nugget: null,
    // ... all texture references
};

export const pixiTextureAnchors = {};
export const pixiTextureRotOffsets = {};
export const pixiTextureBaseScales = {};
export const pixiTextureScaleToRadius = {};

export function loadAllTextures() {
    // Load gunboat, station, destroyer, dungeon textures
}

export function applyGunboatTextures() { /* ... */ }
export function applyStationTexture() { /* ... */ }
export function applyDestroyerTexture() { /* ... */ }
export function applyDungeonTextures() { /* ... */ }
export function applyMonsterTextures() { /* ... */ }
export function applyNuggetTexture() { /* ... */ }
export function applyEnemyTexture(img, key) { /* ... */ }
export function applyBase1Texture() { /* ... */ }
export function applyCruiserTexture() { /* ... */ }
export function applyWarpBossTexture() { /* ... */ }
```

### 3.2 Background Renderer

**Create file**: `src/js/rendering/background-renderer.js`

```javascript
/**
 * Background Renderer - Stars, nebulas, cave grid
 */

import { GameContext } from '../core/game-context.js';

export function initStars() {
    // Extract from main.js
}

export function updatePixiBackground(camX, camY, zoom) {
    // Extract from main.js
}

export function updatePixiCaveGrid(camX, camY, zoom) {
    // Extract from main.js
}

export function generateNebulaPalette() {
    // Extract from main.js
}
```

### 3.3 Minimap Renderer

**Create file**: `src/js/rendering/minimap-renderer.js`

Extract from main.js (~line 27319):

```javascript
/**
 * Minimap Renderer
 */

import { GameContext } from '../core/game-context.js';

export function drawMinimap(ctx, camX, camY) {
    // Extract from main.js - the entire drawMinimap function
}

export function initMinimapCanvas() {
    // Setup minimap canvas
}
```

### 3.4 Update Rendering Index

**Modify file**: `src/js/rendering/index.js`

```javascript
/**
 * Rendering Module Index
 */

export * from './pixi-setup.js';
export * from './sprite-pools.js';
export * from './colors.js';
export * from './texture-loader.js';
export * from './background-renderer.js';
export * from './minimap-renderer.js';
```

---

## PHASE 4: ENTITY CLASSES (HIGH RISK)

**Estimated Time**: 8-12 hours
**Risk Level**: HIGH

**Status**: IN PROGRESS (EnvironmentAsteroid, WarpGate, Dungeon1Gate, Enemy, Pinwheel, Bullet, Shockwave, CruiserMineBomb, FlagshipGuidedMissile, Cruiser, Flagship extracted; remaining bosses, cave, zones, support, player pending).

### Important: Entity Extraction Pattern

When extracting entities, follow this pattern:

```javascript
/**
 * EntityName.js
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { playSound } from '../../audio/audio-manager.js';
import { SIM_STEP_MS } from '../../core/constants.js';

export class EntityName extends Entity {
    constructor(x, y, ...args) {
        super(x, y);
        // ... initialization
    }
    
    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        // ... update logic
        super.update(deltaTime);
    }
    
    draw(ctx) {
        if (this.dead) return;
        // ... draw logic
    }
    
    kill() {
        if (this.dead) return;
        this.dead = true;
        
        // Clean up entity-specific graphics FIRST
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
        
        // Standard cleanup
        pixiCleanupObject(this);
        
        // Nullify global reference if applicable
        if (GameContext.someGlobalRef === this) {
            GameContext.someGlobalRef = null;
        }
    }
}
```

### 4.1 Extract Environment Entities

**Create folder**: `src/js/entities/environment/`

**Create file**: `src/js/entities/environment/EnvironmentAsteroid.js`

Extract from main.js (line ~3141):
- Full `EnvironmentAsteroid` class
- Dependencies: `GameContext.asteroidGrid`, `pixiCleanupObject`

**Create file**: `src/js/entities/environment/index.js`

```javascript
export * from './EnvironmentAsteroid.js';
export * from './WarpGate.js';
export * from './Dungeon1Gate.js';
```

### 4.2 Extract Enemy Classes

**Create folder**: `src/js/entities/enemies/`

**Create file**: `src/js/entities/enemies/Enemy.js`

Extract from main.js (line ~6035):
- Full `Enemy` class (~900 lines)
- AI state machine logic
- All enemy type handling (roamer, elite_roamer, hunter, defender, gunboat)

**Create file**: `src/js/entities/enemies/Pinwheel.js`

Extract from main.js (line ~6920):
- Full `Pinwheel` class

**Create file**: `src/js/entities/enemies/index.js`

```javascript
export * from './Enemy.js';
export * from './Pinwheel.js';
```

### 4.3 Extract Projectile Classes

**Modify folder**: `src/js/entities/projectiles/`

Add these files:
- `CruiserMineBomb.js` (line ~5205)
- `FlagshipGuidedMissile.js` (line ~5316)
- `Destroyer2GuidedMissile.js` (line ~5550)
- `ClusterBomb.js` (line ~5833)
- `NapalmZone.js` (line ~5923)

**Update**: `src/js/entities/projectiles/index.js`

### 4.4 Extract Boss Classes

**Create folder**: `src/js/entities/bosses/`

Extract in this order (due to inheritance):

1. `Cruiser.js` (line ~11310) - extends Enemy
2. `Flagship.js` (line ~11888) - extends Cruiser
3. `SuperFlagshipBoss.js` (line ~12000) - extends Flagship
4. `SpaceStation.js` (line ~16368) - extends Entity
5. `Destroyer.js` (line ~17061) - extends Entity
6. `Destroyer2.js` (line ~17803) - extends Entity
7. `WarpSentinelBoss.js` (line ~12771) - extends Entity
8. `FinalBoss.js` (line ~13578) - extends Entity

**Create folder**: `src/js/entities/bosses/dungeon/`

Extract dungeon bosses:
- `NecroticHive.js` (line ~14400)
- `CerebralPsion.js` (line ~14733)
- `Fleshforge.js` (line ~15062)
- `VortexMatriarch.js` (line ~15339)
- `ChitinusPrime.js` (line ~15658)
- `PsyLich.js` (line ~15965)

### 4.5 Extract Cave Entities

**Create folder**: `src/js/entities/cave/`

Extract:
- `CaveLevel.js` (line ~8766) - Cave generation manager
- `CaveMonsterBase.js` (line ~18482)
- `CaveMonster1.js` (line ~19138)
- `CaveMonster2.js` (line ~19349)
- `CaveMonster3.js` (line ~19472)
- `CaveWallTurret.js` (line ~7771)
- `CaveGasVent.js` (line ~8421)
- `CaveRockfall.js` (line ~8501)
- `CaveDraftZone.js` (line ~8628)
- `CaveCritter.js` (line ~8704)
- `CaveGuidedMissile.js` (line ~7518)

### 4.6 Extract Zone Entities

**Create folder**: `src/js/entities/zones/`

Extract:
- `WarpMazeZone.js` (line ~10125)
- `Dungeon1Zone.js` (line ~10381)
- `RadiationStorm.js` (line ~10610)
- `AnomalyZone.js` (line ~21836)

### 4.7 Extract Support Entities

**Create folder**: `src/js/entities/support/`

Extract:
- `Drone.js` (line ~21391)
- `ContractBeacon.js` (line ~21548)
- `GateRing.js` (line ~21733)
- `WallTurret.js` (line ~22144)

### 4.8 Extract Player Class (LAST)

**Create folder**: `src/js/entities/player/`

**Create file**: `src/js/entities/player/Spaceship.js`

Extract from main.js (line ~3501):
- Full `Spaceship` class (~1500 lines)
- This is the most complex class with the most dependencies

### 4.9 Update Main Entities Index

**Modify file**: `src/js/entities/index.js`

```javascript
/**
 * Entities Module Index
 */

export * from './Entity.js';
export * from './FloatingText.js';
export * from './particles/index.js';
export * from './pickups/index.js';
export * from './projectiles/index.js';
export * from './environment/index.js';
export * from './enemies/index.js';
export * from './bosses/index.js';
export * from './cave/index.js';
export * from './zones/index.js';
export * from './support/index.js';
export * from './player/index.js';
```

---

## PHASE 5: CORE SYSTEMS (CRITICAL RISK)

**Estimated Time**: 6-8 hours
**Risk Level**: CRITICAL

**Status**: NOT STARTED (input/collision/spawn/game-loop extraction pending).

### 5.1 Input Manager

**Create file**: `src/js/systems/input-manager.js`

Extract from main.js (lines ~2560-2620, ~28308-28490):

```javascript
/**
 * Input Manager - Handles all input sources
 */

import { GameContext } from '../core/game-context.js';

export function initInputListeners() {
    // Setup keyboard listeners
    // Setup mouse listeners
    // Setup gamepad connection listeners
}

export function updateGamepad() {
    // Extract from main.js - gamepad polling
}

export function updateInputMode() {
    // Determine if using gamepad or mouse
}

export function getAimDirection() {
    // Return normalized aim direction from mouse or right stick
}

export function getMoveDirection() {
    // Return normalized move direction from WASD or left stick
}
```

### 5.2 Collision Manager

**Create file**: `src/js/systems/collision-manager.js`

Extract from main.js (lines ~22334-22826):

```javascript
/**
 * Collision Manager - Handles all collision detection and resolution
 */

import { GameContext } from '../core/game-context.js';
import { distSq, distLessThan } from '../core/performance.js';

export function resolveEntityCollision(entity1, entity2, pushFactor = 0.5) {
    // Extract from main.js
}

export function checkWallCollision(entity, arena) {
    // Extract from main.js
}

export function checkBulletWallCollision(bullet) {
    // Extract from main.js
}

export function updateCollisions(deltaTime) {
    // Main collision loop - bullets vs enemies, player vs pickups, etc.
}

export function checkPlayerCollisions() {
    // Player-specific collision handling
}

export function checkBulletCollisions() {
    // Bullet collision handling
}
```

### 5.3 Spawn Manager

**Create file**: `src/js/systems/spawn-manager.js`

```javascript
/**
 * Spawn Manager - Handles entity spawning
 */

import { GameContext } from '../core/game-context.js';
import { Enemy } from '../entities/enemies/Enemy.js';
import { EnvironmentAsteroid } from '../entities/environment/EnvironmentAsteroid.js';

export function spawnOneAsteroidRelative(player, isInit = false) {
    // Extract from main.js (line ~3384)
}

export function spawnExplorationCaches() {
    // Extract from main.js
}

export function spawnSectorPOIs() {
    // Extract from main.js
}

export function spawnRadiationStormRelative() {
    // Extract from main.js
}

export function spawnMiniEventRelative() {
    // Extract from main.js
}

export function spawnNewPinwheelRelative(nearPlayer = true) {
    // Extract from main.js
}

export function spawnDrone(type) {
    // Extract from main.js
}

export function processRespawnQueues(deltaTime) {
    // Handle roamer respawn queue, base respawn timers, etc.
}
```

### 5.4 Game Loop

**Create file**: `src/js/systems/game-loop.js`

Extract from main.js (lines ~25010-25090):

```javascript
/**
 * Game Loop - Main game loop and orchestration
 */

import { GameContext } from '../core/game-context.js';
import { SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME } from '../core/constants.js';
import { updateCollisions } from './collision-manager.js';
import { processRespawnQueues } from './spawn-manager.js';

let animationFrameId = null;
let lastFrameTime = 0;

export function startGameLoop() {
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(mainLoop);
}

export function stopGameLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function mainLoop(timestamp) {
    // FPS calculation
    // Fixed timestep accumulator
    // Call gameLoopLogic
    animationFrameId = requestAnimationFrame(mainLoop);
}

export function gameLoopLogic(opts = {}) {
    const { doUpdate = true, doDraw = true, alpha = 1 } = opts;
    
    if (doUpdate) {
        updateEntities(SIM_STEP_MS);
        updateCollisions(SIM_STEP_MS);
        processRespawnQueues(SIM_STEP_MS);
        // ... etc
    }
    
    if (doDraw) {
        renderFrame(alpha);
    }
}

function updateEntities(deltaTime) {
    // Update all entity arrays
}

function renderFrame(alpha) {
    // Render all entities
}
```

### 5.5 Update Systems Index

**Modify file**: `src/js/systems/index.js`

```javascript
/**
 * Systems Module Index
 */

export * from './save-manager.js';
export * from './meta-manager.js';
export * from './contract-manager.js';
export * from './event-scheduler.js';
export * from './upgrade-manager.js';
export * from './input-manager.js';
export * from './collision-manager.js';
export * from './spawn-manager.js';
export * from './game-loop.js';
```

---

## PHASE 6: UI SYSTEM (MEDIUM RISK)

**Estimated Time**: 4-5 hours
**Risk Level**: MEDIUM

**Status**: NOT STARTED.

### 6.1 Menu System

**Create folder**: `src/js/ui/`

**Create file**: `src/js/ui/menus.js`

```javascript
/**
 * Menu System - Start, pause, settings, end screens
 */

import { GameContext } from '../core/game-context.js';

export function showStartScreen() { /* ... */ }
export function hideStartScreen() { /* ... */ }

export function showPauseMenu() { /* ... */ }
export function hidePauseMenu() { /* ... */ }

export function showSettingsMenu() { /* ... */ }
export function hideSettingsMenu() { /* ... */ }

export function showEndScreen() { /* ... */ }
export function hideEndScreen() { /* ... */ }

export function initMenuListeners() {
    // Setup all menu button click handlers
}
```

### 6.2 Level-Up Screen

**Create file**: `src/js/ui/levelup-screen.js`

```javascript
/**
 * Level-Up Screen - Upgrade selection UI
 */

import { GameContext } from '../core/game-context.js';
import { getAvailableUpgrades, applyUpgrade } from '../systems/upgrade-manager.js';

export function showLevelUpScreen() { /* ... */ }
export function hideLevelUpScreen() { /* ... */ }
export function renderUpgradeCards(upgrades) { /* ... */ }
export function handleCardSelection(index) { /* ... */ }
export function handleReroll() { /* ... */ }
```

### 6.3 Meta Shop

**Create file**: `src/js/ui/meta-shop.js`

```javascript
/**
 * Meta Shop - Persistent upgrade shop UI
 */

import { GameContext } from '../core/game-context.js';
import { purchaseMetaUpgrade, getMetaUpgradeCost } from '../systems/meta-manager.js';

export function showMetaShop() { /* ... */ }
export function hideMetaShop() { /* ... */ }
export function updateMetaShopUI() { /* ... */ }
export function showUpgradeModal(upgradeId) { /* ... */ }
export function hideUpgradeModal() { /* ... */ }
```

### 6.4 HUD

**Create file**: `src/js/ui/hud.js`

```javascript
/**
 * HUD - Heads-up display updates
 */

import { GameContext } from '../core/game-context.js';

export function updateHealthUI() { /* ... */ }
export function updateWarpUI() { /* ... */ }
export function updateTurboUI() { /* ... */ }
export function updateXpUI() { /* ... */ }
export function updateContractUI() { /* ... */ }
```

### 6.5 Gamepad Navigation

**Create file**: `src/js/ui/gamepad-nav.js`

```javascript
/**
 * Gamepad Navigation - Menu navigation with gamepad
 */

import { GameContext } from '../core/game-context.js';

export function initGamepadNav() { /* ... */ }
export function updateMenuNavigation() { /* ... */ }
export function handleMenuConfirm() { /* ... */ }
export function handleMenuBack() { /* ... */ }
```

### 6.6 UI Index

**Create file**: `src/js/ui/index.js`

```javascript
/**
 * UI Module Index
 */

export * from './menus.js';
export * from './levelup-screen.js';
export * from './meta-shop.js';
export * from './hud.js';
export * from './gamepad-nav.js';
```

---

## FINAL MAIN.JS STRUCTURE

After all phases, `main.js` should be approximately 500 lines:

```javascript
/**
 * Spacebros - Main Entry Point
 * This file bootstraps the game and imports all modules.
 */

// === Core Imports ===
import { GameContext } from './core/game-context.js';
import { ZOOM_LEVEL, SIM_FPS } from './core/constants.js';
import { Vector, SpatialHash } from './core/math.js';

// === System Imports ===
import { startGameLoop, stopGameLoop } from './systems/game-loop.js';
import { initInputListeners } from './systems/input-manager.js';
import { loadMetaProfile, applyMetaUpgrades } from './systems/meta-manager.js';
import { loadGame } from './systems/save-manager.js';

// === Rendering Imports ===
import { initPixiApp, initPixiLayers } from './rendering/pixi-setup.js';
import { loadAllTextures } from './rendering/texture-loader.js';
import { initStars } from './rendering/background-renderer.js';

// === Audio Imports ===
import { initAudio, startMusic } from './audio/audio-manager.js';

// === UI Imports ===
import { initMenuListeners, showStartScreen } from './ui/menus.js';

// === Entity Imports (for registration) ===
import { Spaceship } from './entities/player/Spaceship.js';
import { Enemy } from './entities/enemies/Enemy.js';
// ... other entity imports

// === Canvas Setup ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });

// === Initialization ===
async function init() {
    console.log('[Spacebros] Initializing...');
    
    // Setup canvas
    await initializeCanvasResolution();
    
    // Initialize PixiJS
    await initPixiApp(canvas);
    initPixiLayers();
    
    // Load textures
    await loadAllTextures();
    
    // Initialize audio
    initAudio();
    
    // Load meta profile
    loadMetaProfile();
    
    // Setup input
    initInputListeners();
    
    // Setup UI
    initMenuListeners();
    
    // Show start screen
    showStartScreen();
    
    console.log('[Spacebros] Ready!');
}

// === Game Start ===
export function startNewGame() {
    GameContext.reset();
    
    // Create player
    GameContext.player = new Spaceship(0, 0);
    
    // Apply meta upgrades
    applyMetaUpgrades();
    
    // Initialize world
    initStars();
    spawnInitialEntities();
    
    // Start game
    GameContext.gameActive = true;
    GameContext.gameStartTime = Date.now();
    startGameLoop();
    startMusic();
}

// === Resume Game ===
export function resumeGame() {
    if (!GameContext.canResumeGame) return;
    loadGame(GameContext.currentProfileName);
    GameContext.gameActive = true;
    startGameLoop();
    startMusic();
}

// === Debug Functions ===
window.spawnCruiser = function() { /* ... */ };
window.spawnStation = function() { /* ... */ };
window.spawnFinalBoss = function() { /* ... */ };

// === Start ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

---

## TESTING CHECKLIST

After each phase, verify these work:

### Basic Gameplay
- [ ] Player can move (WASD)
- [ ] Player can aim (mouse)
- [ ] Player can shoot (mouse click / space)
- [ ] Enemies spawn and move
- [ ] Bullets hit enemies
- [ ] Enemies die and drop coins
- [ ] Coins can be collected
- [ ] Score increases

### Progression
- [ ] XP bar fills
- [ ] Level-up screen appears
- [ ] Upgrades can be selected
- [ ] Upgrades apply correctly

### Bosses
- [ ] Cruiser spawns after time
- [ ] Boss fights work
- [ ] Boss arena boundary works
- [ ] Boss drops rewards

### Persistence
- [ ] Game can be saved
- [ ] Game can be loaded
- [ ] Meta shop purchases persist
- [ ] Profiles can be created/deleted

### Input
- [ ] Keyboard works
- [ ] Mouse works
- [ ] Gamepad works (if available)
- [ ] Input mode switches correctly

---

## COMMON ISSUES AND SOLUTIONS

### Issue: "X is not defined"
**Cause**: Missing import or circular dependency
**Solution**: Add the import or use lazy loading

### Issue: Entity not appearing
**Cause**: Not added to correct PixiJS layer or entity array
**Solution**: Verify entity is pushed to GameContext array and has correct layer

### Issue: Collision not working
**Cause**: Entity not in spatial hash or collision system
**Solution**: Verify entity is added to appropriate grid and collision loop includes it

### Issue: Sound not playing
**Cause**: Audio context not initialized or suspended
**Solution**: Ensure `initAudio()` called after user interaction

### Issue: Save/Load broken
**Cause**: Property names changed during refactor
**Solution**: Verify `buildProfileData` and `applyProfile` use matching property names

---

## ESTIMATED TOTAL TIME

| Phase | Estimated Hours | Risk Level |
|-------|-----------------|------------|
| Phase 1: Foundation | 2-3 hours | LOW |
| Phase 2: Isolated Systems | 4-6 hours | MEDIUM |
| Phase 3: Rendering Modules | 3-4 hours | MEDIUM |
| Phase 4: Entity Classes | 8-12 hours | HIGH |
| Phase 5: Core Systems | 6-8 hours | CRITICAL |
| Phase 6: UI System | 4-5 hours | MEDIUM |
| **Total** | **27-38 hours** | - |

---

## SUCCESS CRITERIA

The refactoring is complete when:

1. `main.js` is under 1000 lines
2. All 62 classes are in separate files
3. No global variables outside `GameContext`
4. Game runs without errors
5. All features work as before
6. Code is organized by responsibility
7. Imports are clean and logical
