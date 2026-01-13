# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm start` - Start the Electron app in normal mode
- `npm run start:dev` - Start with DevTools opened (for debugging)
- `npm run start:smoke` - Run smoke test (auto-closes after load)
- `npm run dist` - Build distributables for current platform
- `npm run dist:win` - Build Windows installer (NSIS)
- `npm run dist:linux` - Build Linux packages (AppImage, deb, tar.gz)

### Testing
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

**Test Structure:**
- Tests located in `/tests/unit/` directory
- Unit tests for core math and constants
- Vitest configuration supports ESM modules
- Tests are AI-callable for automated validation

### Debug Console Commands
Available in browser console (F12) during gameplay:
- `perfEnable()` / `perfDisable()` - Toggle profiler
- `perfStats()` - Show current performance stats
- `perfReport()` - Print detailed performance report
- `perfWatch(secs)` - Monitor performance for N seconds
- `entityCount()` - Count all game entities
- `memStats()` - Memory usage statistics
- `perfCheck()` - Quick performance check with warnings
- `window.spawnCruiser()` - DEBUG: Spawn cruiser boss instantly

## Architecture Overview

- **Game Loop**: Variable timestep simulation running at **120Hz** physics tick rate with interpolation (`renderAlpha`) for frame-rate independent rendering.
- **Entity System**: Class-based entities with manual lifecycle management (not ECS)
- **Rendering**: Hybrid DOM (primary UI) + PixiJS (game world sprites) + Canvas 2D overlays (directional arrows, minimap)
- **Collision Detection**: Spatial hash grids for efficient collision queries
- **State Management**: Global variables for game state (score, flags, active entities)

### Key Systems

**Fixed-Timestep Physics Loop** (`src/js/core/constants.js`):
- **Physics Rate**: Locked to **120Hz** (`PHYSICS_FPS`) to ensure stability and fix Linux VSync stuttering.
- `SIM_FPS = 60` - Reference framerate for calibration (kept for backwards compatibility).
- `SIM_STEP_MS = 8.33` - Milliseconds per simulation step at 120Hz.
- `SIM_MAX_STEPS_PER_FRAME = 12` - Max catch-up steps to prevent spiral of death.
- **IMPORTANT**: All timing must normalize to 60Hz reference using `dtScale = deltaTime / 16.67`.
- **Interpolation**: Rendering uses `renderAlpha` to smooth object positions between physics ticks.
- Time-based counters use `this.t += dtFactor` instead of `this.t++`.
- Frame-based checks use `Math.floor(this.t) % N === 0` for compatibility with time-scaled counters.

**Sprite Pooling** (`src/js/rendering/pixi-setup.js`):
- Pre-allocated sprite pools for performance: bullets, particles, enemies, pickups, asteroids, stars
- Use `pixiCleanupObject()` for standard cleanup
- Critical entity graphics must be explicitly cleaned before calling `pixiCleanupObject()`

**Staggered Cleanup** (`src/js/core/staggered-cleanup.js`):
- Spreads array cleanup across frames to prevent GC pauses
- Critical arrays (bullets, enemies) cleaned immediately
- Other arrays cleaned up to 3 per frame based on priority

**Performance Monitoring** (`src/js/core/jitter-monitor.js`):
- Tracks frame time variance and spikes
- Console commands available for runtime diagnostics

**GameContext Pattern** (`src/js/core/game-context.js`):
- Centralized global state object replacing scattered global variables
- All game state accessible via `GameContext` export
- Includes `reset()` method for clean game restart
- Contains entity arrays, timing variables, input state, meta progression

**Modular Entity System**:
- Each entity type in its own file
- Index files provide clean imports: `import { Spaceship } from './entities/player/index.js'`
- Entity registry in `entities.js` for dynamic spawning
- Base `Entity` class with common lifecycle methods

### Module Structure

The game uses a **modular ES6 architecture** with the following structure:

```
src/js/
├── index.js             # Main entry point for ES6 module imports
├── entities.js          # Entity registry and factory functions
├── world.js             # World/spawn management
├── core/
│   ├── index.js         # Core module re-exports
│   ├── constants.js     # Game configuration (physics, graphics, audio, balance)
│   │                    # Includes UPGRADE_DATA and META_SHOP_UPGRADE_DATA
│   ├── math.js          # Vector class, SpatialHash for collision detection
│   ├── state.js         # Global game state management
│   ├── performance.js   # View culling and rendering optimization
│   ├── game-context.js  # Centralized GameContext object for all game state
│   ├── profiler.js      # Performance profiling
│   ├── jitter-monitor.js    # Frame time tracking
│   ├── staggered-cleanup.js # Spread cleanup across frames
│   └── perf-debug.js    # Console debug commands
├── entities/
│   ├── Entity.js        # Base class for all game entities
│   ├── FloatingText.js  # Floating damage/combat text
│   ├── index.js         # Entity module re-exports
│   ├── player/          # Player ship classes
│   │   ├── Spaceship.js
│   │   └── index.js
│   ├── bosses/          # Boss enemies (Cruiser, Destroyer, Flagship, etc.)
│   │   ├── dungeon/     # Dungeon-specific bosses
│   │   └── index.js
│   ├── enemies/         # Regular enemies
│   │   └── index.js
│   ├── projectiles/     # Bullets, missiles, explosives
│   │   └── index.js
│   ├── particles/       # Visual effects and explosions
│   │   └── index.js
│   ├── pickups/         # Collectibles (coins, health, space nuggets)
│   │   └── index.js
│   ├── environment/     # Destructible asteroids, warp gates
│   │   └── index.js
│   ├── cave/            # Cave-specific entities and levels
│   │   └── index.js
│   ├── zones/           # Environmental hazards and special areas
│   │   └── index.js
│   └── support/         # Drones, turrets, support entities
│       └── index.js
├── rendering/
│   ├── index.js         # Rendering module re-exports
│   ├── pixi-setup.js    # PixiJS initialization and sprite pooling
│   ├── pixi-context.js  # PixiJS layer management
│   ├── sprite-pools.js  # PixiJS sprite pooling system
│   ├── background-renderer.js # Star field and nebula rendering
│   ├── minimap-renderer.js # Minimap rendering
│   ├── texture-loader.js # Asset loading management
│   ├── rendering-state.js # Rendering state management
│   └── colors.js        # Color conversion utilities
├── audio/
│   ├── index.js         # Audio module re-exports
│   └── audio-manager.js # Sound and music management
└── utils/
    ├── index.js         # Utils module re-exports
    ├── spawn-utils.js   # Spawn point utilities
    └── cleanup-utils.js # Cleanup utilities
```

### Electron Wrapper (`electron/`)

- `main.js` - Main process, creates browser window, handles IPC for settings
- `preload.js` - Context bridge between renderer and Node.js
- Settings persisted to `userData/settings.json`
- Cache management configured for temp directory

## Variable Timestep Timing Patterns

### Time Scaling in update() Methods
All entity `update(deltaTime)` methods must use time scaling:

```javascript
update(deltaTime = 16.67) {
    if (this.dead) return;

    const dtFactor = deltaTime / 16.67;  // or use SIM_STEP_MS
    // or simply use dtScale if passed from parent

    // Use dtFactor for all time-based operations:
    this.timer -= dtFactor;
    this.cooldown -= dtFactor;

    // Counter increments MUST be time-scaled:
    this.t += dtFactor;  // NOT this.t++

    // Frame-based checks need Math.floor():
    if (Math.floor(this.t) % 2 === 0) {
        emitParticle(...);
    }
}
```

### Constants for Time Values
When defining duration constants, use frame counts at 60fps reference:
- 1 second = 60 frames
- 0.5 seconds = 30 frames
- These work correctly with dtScale because it normalizes to reference framerate

### Using SIM_FPS for Calibration
When calculating rates that depend on framerate, use `SIM_FPS` instead of hardcoded 60:
```javascript
// CORRECT
this.turnSpeed = (Math.PI * 2) / (4 * SIM_FPS);

// WRONG
this.turnSpeed = (Math.PI * 2) / (4 * 60);
```

## Important Patterns and Gotchas

### Entity Cleanup Pattern
When creating entities with PixiJS graphics, follow this exact order:

```javascript
kill() {
    if (this.dead) return;
    this.dead = true;

    // 1. Clean up entity-specific graphics FIRST
    if (this._pixiGfx) {
        try { this._pixiGfx.destroy(true); } catch (e) { }
        this._pixiGfx = null;
    }
    if (this._pixiInnerGfx) {
        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
        this._pixiInnerGfx = null;
    }
    if (this._pixiText) {
        try { this._pixiText.destroy(); } catch (e) { }
        this._pixiText = null;
    }

    // 2. Then do standard cleanup
    pixiCleanupObject(this);

    // 3. Continue with death logic (sounds, effects, drops)
}
```

### Zoom Scaling for Graphics
PixiJS `lineStyle()` uses absolute widths. Scale inversely with zoom:

```javascript
const baseWidth = 10;
const lineWidth = baseWidth / Math.max(0.5, currentZoom || ZOOM_LEVEL);
g.lineStyle(lineWidth, color, alpha);
```

### Global Entity References
Some entities have global references that must be nullified on death:

```javascript
if (this.dead) {
    if (globalEntity === this) {
        globalEntity = null;
    }
    return;
}
```

Examples: `radiationStorm`, `boss`, `destroyer`, `spaceStation`

### Dead Entity Checks
Always check `this.dead` early in update/draw methods to prevent operating on dead entities:

```javascript
update() {
    if (this.dead) return;
    // ... rest of update
}

draw(ctx) {
    if (this.dead) return;
    // ... rest of draw
}
```

## Upgrade System

### Popup/Level-Up Upgrades
Defined in `UPGRADE_DATA` in `src/js/core/constants.js`:

**Weapons Category:**
- Turret Damage, Turret Fire Rate, Turret Range
- Multi-Shot, Flak Shotgun, Static Weapons, Homing Missiles
- **NEW**: Volley Shot (hold to charge burst), Chain Lightning (chains to enemies), Backstabber (bonus damage from behind)

**Shields & Hull Category:**
- Hull Strength, Segment Count, Outer Shield
- Shield Regen, Hull Regen
- **NEW**: Reactive Shield (restore on kill), Damage Mitigation (reduce damage taken + speed)

**Mobility Category:**
- Speed, Turbo Boost

**Specials Category:**
- XP Magnet, Area Nuke, Phase Shield, Stasis Field
- **NEW**: Time Dilation (slow nearby enemies), Momentum (DPS while moving)

**Drones Category:**
- Companion Drones

### Meta Shop Upgrades
Permanent progression upgrades purchased with Space Nuggets. Defined in `META_SHOP_UPGRADE_DATA`:

**Core Upgrades:**
- Start Damage Boost, Passive +HP, Hull Plating, Shield Core
- Static Blueprint, Missile Primer, Magnet Booster, Global Defense Ring
- Speed Tuning, Bank Multiplier, Shop Discount, Extra Life

**Combat Upgrades:**
- Piercing Rounds, Explosive Rounds, Critical Strike, Split Shot
- Thorn Armor, Lifesteal, Evasion Boost

**Utility Upgrades:**
- Shield Recharge, Dash Cooldown, Dash Duration
- XP Magnet+, Auto-Reroll, Nugget Magnet, Contract Speed
- Starting Rerolls, Lucky Drop, Bounty Hunter

**Advanced Upgrades:**
- Combo Meter, Starting Weapon, Second Wind
- **NEW**: Battery Capacitor (manual discharge AOE ability)

### Battery Power-Up
Store-bought ability that charges during gameplay and discharges manually:
- **Activation**: Press F key (keyboard) or Y button (gamepad)
- **Charge Time**: 30 seconds to full charge (all tiers)
- **Tier Scaling**:
  - Tier 1: 500 damage, 800u range
  - Tier 2: 800 damage, 900u range
  - Tier 3: 1200 damage, 1000u range
- **Visual**: Electric blue (#0ff) with expanding ring effect
- **UI**: Battery HUD shows charge percentage and turns white when fully charged

## Ship Types

### Standard Ship
Manual turret control with mouse/gamepad aiming. Default ship type.

### Slacker Special (shipType = 'slacker')
Auto-targeting ship designed for easier gameplay:

**Features:**
- **Auto-turret**: Automatically targets nearest enemy, prioritizing bosses
  - Lead targeting: Aims ahead of moving targets
  - Range: 2000 units
- **Forward Laser**: Fires green laser independently in ship's facing direction
  - Fire rate: Every 20 frames
  - Damage: 2 × damage multiplier

**Controls:**
- **Mouse-based movement**: Ship moves toward mouse cursor position
  - Additive with WASD keyboard input (both work together)
  - Dead zone: 50 units (prevents jitter when mouse is near ship)
- **Left mouse button (hold)**: Rotation mode - stops movement, only rotates to face cursor
  - Braking: 0.85 friction when in rotation mode
- **Right mouse button**: Turbo boost (same as E key)
  - Triggers on press (not release)
  - Re-triggers when cooldown expires if button held

**Cursor Behavior:**
- Cursor hidden during gameplay
- Cursor visible in menus (pause, level-up, start screen, settings)

**Code Location:**
- `Spaceship` class: `src/js/entities/player/Spaceship.js`

## PixiJS Rendering Best Practices

### Anti-Ghosting Pattern
When drawing dynamic graphics with PixiJS, always call `endFill()` after drawing lines to prevent ghost trails:

```javascript
gfx.lineStyle(2, color, alpha);
gfx.moveTo(x1, y1);
gfx.lineTo(x2, y2);
gfx.endFill();  // CRITICAL: prevents ghosting
```

### Persistent Graphics Objects (Like Outer Shield)
For graphics that update every frame, use persistent graphics objects stored on the entity:

```javascript
// In constructor
this._pixiCustomGfx = null;

// In draw/update method
let gfx = this._pixiCustomGfx;
if (!gfx) {
    gfx = new PIXI.Graphics();
    pixiVectorLayer.addChild(gfx);
    this._pixiCustomGfx = gfx;
} else if (!gfx.parent) {
    pixiVectorLayer.addChild(gfx);
}

// Clear and redraw each frame (prevents ghosting)
gfx.clear();
gfx.lineStyle(width, color, alpha);
gfx.moveTo(...);
gfx.lineTo(...);
gfx.endFill();
```

**Benefits:**
- No ghosting (graphics explicitly cleared before redraw)
- Better performance (object reused, not recreated)
- Proper cleanup (destroyed with entity)

### PixiJS Layer Structure
- `pixiBaseLayer` - Player ship, static elements
- `pixiEnemyLayer` - Enemy ships
- `pixiBossLayer` - Stations, bosses
- `pixiVectorLayer` - Graphics (shields, rings, lines, UI overlays)
- `pixiBulletLayer` - Projectiles
- `pixiParticleLayer` - Particles, explosions

### Laser Aiming Line (Turret Indicator)
The dashed cyan laser that shows where the turret is aiming:
- **Location**: `Spaceship` class in `src/js/entities/player/Spaceship.js`
- **Uses**: `this._pixiLaserGfx` (persistent graphics object)
- **Pattern**: Dashed line (10px dash, 20px gap) with target circle
- **Anti-ghosting**: Always call `gfx.endFill()` after drawing line segments

## Game Configuration

Key constants in `src/js/core/constants.js`:
- `ZOOM_LEVEL` - Default camera zoom
- `SIM_FPS` - Reference simulation framerate (60)
- `SIM_STEP_MS` - Milliseconds per step at reference framerate (16.67)
- `PIXI_SPRITE_POOL_MAX` - Max sprites per pool type
- `USE_PIXI_OVERLAY` - Whether to use PixiJS for rendering
- `ENABLE_NEBULA` - Nebula background rendering
- `BACKGROUND_MUSIC_URL` - Music file location
- `UPGRADE_DATA` - All popup/level-up upgrade definitions
- `META_SHOP_UPGRADE_DATA` - All meta shop upgrade descriptions

## Claude Skills

Project-specific Claude Code skills are installed to help with common development tasks.

### Installed Skills

| Skill | Purpose |
|-------|---------|
| **entity-generator** | Generate new enemies, bosses, projectiles with proper PixiJS cleanup and variable timestep timing |
| **performance-analyzer** | Use built-in debug commands (`perfStats()`, `entityCount()`) to profile and identify bottlenecks |
| **code-pattern-validator** | Validate entity cleanup patterns, `endFill()` calls, `dtFactor` usage, dead entity checks |
| **upgrade-system-assistant** | Create balanced popup and meta shop upgrades with proper tier scaling |
| **collision-testing-tool** | Test spatial hash collision detection, visualize hitboxes (Ctrl+Shift+H), validate boundaries |
| **build-release-manager** | Build Electron distributables, manage versioning, generate changelogs |

### Creating New Skills

To create additional project-specific skills:

1. Use the global `skill-creator` skill for complete workflow documentation
2. Create skill directory in `.claude/skills/<skill-name>/SKILL.md`
3. Package: `python3 ~/.codex/skills/.system/skill-creator/scripts/package_skill.py .claude/skills/<skill-name> .claude/skills/`
4. Copy `.skill` file to `~/.codex/skills/public/` and extract
5. Reload VS Code window to discover the new skill

## Critical File Locations

The game uses a **modular ES6 architecture**. Key entity locations:

| Entity Type | Module Path | Notes |
|-------------|-------------|-------|
| `Entity` (base) | `src/js/entities/Entity.js` | Base class for all entities |
| `Spaceship` | `src/js/entities/player/Spaceship.js` | Main player class |
| `Enemy` (base) | `src/js/entities/enemies/Enemy.js` | Base enemy class |
| `Pinwheel` | `src/js/entities/enemies/Pinwheel.js` | Pinwheel enemies |
| `Cruiser` | `src/js/entities/bosses/Cruiser.js` | Cruiser boss |
| `Destroyer` | `src/js/entities/bosses/Destroyer.js` | Destroyer boss |
| `Destroyer2` | `src/js/entities/bosses/Destroyer2.js` | Destroyer variant |
| `Flagship` | `src/js/entities/bosses/Flagship.js` | Flagship boss |
| `SuperFlagshipBoss` | `src/js/entities/bosses/SuperFlagshipBoss.js` | Super flagship |
| `WarpSentinelBoss` | `src/js/entities/bosses/WarpSentinelBoss.js` | Warp boss |
| `FinalBoss` | `src/js/entities/bosses/FinalBoss.js` | Final boss |
| `SpaceStation` | `src/js/entities/bosses/SpaceStation.js` | Space station |
| `Bullet` | `src/js/entities/projectiles/` | Main projectile classes |
| `ClusterBomb` | `src/js/entities/projectiles/ClusterBomb.js` | Splitting projectiles |
| `NapalmZone` | `src/js/entities/projectiles/NapalmZone.js` | Area damage zones |
| `CruiserMineBomb` | `src/js/entities/projectiles/CruiserMineBomb.js` | Boss mines |
| `FlagshipGuidedMissile` | `src/js/entities/projectiles/FlagshipGuidedMissile.js` | Boss missiles |
| `Particle` | `src/js/entities/particles/Particle.js` | Base particle class |
| `Explosion` | `src/js/entities/particles/Explosion.js` | Explosion effects |
| `SpriteExplosion` | `src/js/entities/particles/SpriteExplosion.js` | Sprite-based explosions |
| `LightningArc` | `src/js/entities/particles/LightningArc.js` | Lightning effects |
| `Coin` | `src/js/entities/pickups/Coin.js` | Coin pickup |
| `HealthPowerUp` | `src/js/entities/pickups/HealthPowerUp.js` | Health pickup |
| `SpaceNugget` | `src/js/entities/pickups/SpaceNugget.js` | Nugget pickup |
| `EnvironmentAsteroid` | `src/js/entities/environment/EnvironmentAsteroid.js` | Destructible asteroids |
| `WarpGate` | `src/js/entities/environment/WarpGate.js` | Warp gate |
| `Dungeon1Gate` | `src/js/entities/environment/Dungeon1Gate.js` | Dungeon gate |
| `RadiationStorm` | `src/js/entities/zones/RadiationStorm.js` | Environmental hazard |
| `WarpMazeZone` | `src/js/entities/zones/WarpMazeZone.js` | Warp zone |
| `Dungeon1Zone` | `src/js/entities/zones/Dungeon1Zone.js` | Dungeon zone |
| `WarpBioPod` | `src/js/entities/zones/WarpBioPod.js` | Warp bio pod |
| `AnomalyZone` | `src/js/entities/zones/AnomalyZone.js` | Anomaly zone |
| `Drone` | `src/js/entities/support/Drone.js` | Companion drones |
| `WallTurret` | `src/js/entities/support/WallTurret.js` | Station turrets |
| `ContractBeacon` | `src/js/entities/support/ContractBeacon.js` | Contract beacons |
| `GateRing` | `src/js/entities/support/GateRing.js` | Gate rings |
| `CaveWallTurret` | `src/js/entities/cave/CaveWallTurret.js` | Cave wall turrets |
| `CaveMonster2` | `src/js/entities/cave/CaveMonster2.js` | Cave monsters |
| `FloatingText` | `src/js/entities/FloatingText.js` | Floating damage/combat text |

## Global State Management

The game uses a centralized **GameContext** object (`src/js/core/game-context.js`) for all global state instead of scattered variables.

### Accessing Game State
```javascript
import { GameContext } from './core/index.js';

// Entity arrays
GameContext.enemies
GameContext.bullets
GameContext.particles
GameContext.coins
GameContext.drones

// Game state
GameContext.gameActive
GameContext.gamePaused
GameContext.score
GameContext.difficultyTier

// Boss/event entities
GameContext.boss
GameContext.spaceStation
GameContext.destroyer
GameContext.radiationStorm
```

### Key GameContext Properties

**Game State:**
- `gameActive`, `gamePaused`, `gameMode` - Main game state flags
- `sectorIndex`, `sectorTransitionActive` - Sector tracking
- `caveMode`, `caveLevel` - Cave mode state
- `score`, `difficultyTier`, `pinwheelsDestroyed` - Progress tracking

**Entity Arrays:**
- `player` - Single player instance
- `enemies` - All active enemies
- `bullets` - All projectiles
- `bossBombs` - Boss explosive mines
- `particles`, `explosions` - Visual effects
- `coins`, `nuggets` - Collectibles
- `drones` - Companion drones
- `environmentAsteroids` - Destructible environment

**Boss/Event Entities:**
- `boss`, `bossActive` - Current boss entity
- `spaceStation` - Space station entity
- `destroyer` - Destroyer boss
- `radiationStorm` - Radiation storm event
- `warpGate` - Active warp gate
- `warpZone`, `dungeon1Gate`, `dungeon1Zone` - Zone entities

**Dungeon Bosses:**
- `necroticHive`, `cerebralPsion`, `fleshforge` - Dungeon boss instances
- `vortexMatriarch`, `chitinusPrime`, `psyLich` - More dungeon bosses

**Meta Progression:**
- `spaceNuggets` - Premium currency
- `rerollTokens` - Reroll tokens available
- `metaExtraLifeCount` - Extra lives from meta
- `activeContract` - Current active contract
- `shownUpgradesThisRun` - Track shown upgrades
- `metaProfile` - Meta progression profile (purchases, upgrades)

**Timing:**
- `simAccMs` - Accumulated simulation time
- `simNowMs` - Current simulation time
- `renderAlpha` - Interpolation factor (0-1)

**Input State:**
- `keys` - Keyboard state (w, a, s, d, space, shift, e, f)
- `mouseState` - Mouse button states
- `mouseScreen`, `mouseWorld` - Mouse position
- `gpState` - Gamepad state
- `usingGamepad` - Whether gamepad is active

## Asset Organization

Assets in `/assets/` directory:

**Player Ships:**
- `player1.png` - Main hull
- `slacker.png` - Slacker special variant

**Enemies:**
- `roamer1.png`, `roamer_elite.png` - Basic/elite roamers
- `hunter.png`, `defender.png` - Specialized enemies
- `gunboat1.png`, `gunboat2.png` - Gunboats
- `cruiser.png` - Cruiser boss
- `warp_boss.png`, `spaceboss2.png` - Final bosses

**Bases:**
- `base1.png`, `base2.png`, `base3.png` - Station tiers

**Environment:**
- `asteroid1.png`, `asteroid2.png`, `asteroid3.png` - Destructible
- `asteroid2_U.png` - Indestructible

**Effects:**
- `explosion1.png` - Spritesheet (4 cols × 5 rows, 256×204 per frame)
- `nugget.png` - Space nugget sprite

## Common Patterns

### Entity Creation
```javascript
const entity = new SomeEntityClass(startPos, opts);
enemies.push(entity);
if (entity._pixiGfx) pixiEnemyLayer.addChild(entity._pixiGfx);
```

### Entity Removal
```javascript
// Use staggered cleanup (automatic)
// Never manually splice from arrays during iteration
entity.kill(); // Marks as dead, cleanup happens automatically
```

### Damage Pattern
```javascript
takeDamage(amount, source) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
        this.kill();
    }
}
```

### Finding Spawn Point
```javascript
const spawnPos = findSpawnPointRelative(hostile);
// Returns Vector with position away from player
```

### View Culling
```javascript
if (!entity.isInView(camX, camY, viewWidth, viewHeight)) {
    return; // Skip rendering
}
```

## Important Utility Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `GameContext.reset()` | core/game-context.js | Reset all game state |
| `getElapsedGameTime()` | core/game-context.js | Get current game time |
| `Vector` class | core/math.js | Vector math utility |
| `SpatialHash` | core/math.js | Spatial hashing for collisions |
| `clamp()`, `lerp()` | core/math.js | Math utility functions |
| `randomRange()`, `randomInt()` | core/math.js | Random number generation |
| `clearArrayWithPixiCleanup(arr)` | utils/cleanup-utils.js | Clear array with sprite cleanup |
| `filterArrayWithPixiCleanup(arr, fn)` | utils/cleanup-utils.js | Filter with cleanup |
| `pixiCleanupObject(obj)` | rendering/pixi-setup.js | Standard PixiJS cleanup |
| `findSpawnPointRelative(hostile)` | utils/spawn-utils.js | Find spawn position |
| `isInView()`, `isInExtendedView()` | Entity base | View culling checks |

## Debug Tools

### Keyboard Shortcuts
- `Ctrl+Shift+3` - Spawn Cruiser boss instantly
- `Ctrl+Shift+4` - Spawn Space Station instantly
- `Ctrl+Shift+5` - Spawn Final Boss instantly
- `Ctrl+Shift+H` - Toggle collision debug visualization (`DEBUG_COLLISION`)

### Console Commands
See "Debug Console Commands" section above for full list.

### Debug Flags
- `DEBUG_COLLISION` - Show hitboxes and collision boundaries

## Important Constants

### Timing
- `PHYSICS_FPS = 120` - Physics simulation rate
- `SIM_FPS = 60` - Reference framerate for calibration
- `SIM_STEP_MS = 8.33` - Milliseconds per physics step at 120Hz
- `SIM_MAX_STEPS_PER_FRAME = 12` - Max catch-up steps

### Rendering
- `ZOOM_LEVEL = 0.4` - Default camera zoom
- `SPRITE_RENDER_SCALE = 2.5` - Scale to compensate for low zoom
- `PLAYER_HULL_RENDER_SCALE = 2.5` - Player hull scale
- `PLAYER_HULL_ROT_OFFSET = Math.PI / 2` - Art rotation offset
- `PIXI_SPRITE_POOL_MAX = 30000` - Max sprites per pool

### Gameplay
- `GAME_DURATION_MS = 30 * 60 * 1000` - 30-minute game duration

### Spatial Hash Cell Sizes
- `asteroidGrid` - 300 units (asteroids, environment)
- `targetGrid` - 350 units (enemies, bases, turrets, bosses)
- `bulletGrid` - 150 units (projectiles)

### Animation
- `EXPLOSION1_COLS = 4`, `EXPLOSION1_ROWS = 5` - Explosion spritesheet
- `EXPLOSION1_FRAME_W = 256`, `EXPLOSION1_FRAME_H = 204` - Frame dimensions
