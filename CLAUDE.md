# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm start` - Start the Electron app in normal mode
- `npm run start:dev` - Start with DevTools opened (for debugging)
- `npm run start:smoke` - Run smoke test (auto-closes after load) - **Run after changes to verify basic functionality**

### Building Distributables
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
- Vitest configuration with Node environment
- Tests are AI-callable for automated validation

### Linting & Formatting
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Architecture Overview

This is an **Electron desktop app** wrapping a 2D space shooter game with a modular ES6 architecture.

### Key Architectural Patterns

**Variable Timestep Physics Loop**:
- **Physics Rate**: Locked to **120Hz** (`PHYSICS_FPS`) to ensure stability and fix VSync issues
- `SIM_FPS = 60` - Reference framerate for calibration
- `SIM_STEP_MS = 8.33` - Milliseconds per simulation step at 120Hz
- `SIM_MAX_STEPS_PER_FRAME = 12` - Max catch-up steps to prevent spiral of death
- **Interpolation**: Rendering uses `renderAlpha` to smooth object positions between physics ticks
- **CRITICAL**: All timing must normalize to 60Hz reference using `dtFactor = deltaTime / 16.67`

**Hybrid Rendering**:
- **PixiJS** - Sprite rendering for game entities (player, enemies, bullets, particles)
- **Canvas 2D** - Overlays (minimap, directional arrows, UI elements, vector graphics)
- Multiple PixiJS layers: `pixiBaseLayer`, `pixiEnemyLayer`, `pixiBossLayer`, `pixiVectorLayer`, `pixiBulletLayer`, `pixiParticleLayer`

**Centralized State Management**:
- `GameContext` singleton in [src/js/core/game-context.js](src/js/core/game-context.js) replaces scattered global variables
- All game state accessible via `GameContext` export
- Contains `reset()` method for clean game restart

**Entity System**:
- Class-based entities with manual lifecycle management (not ECS)
- Base `Entity` class in [src/js/entities/Entity.js](src/js/entities/Entity.js) with common lifecycle methods
- Each entity type in its own file with index files for clean imports

**Dependency Injection**:
- Many modules use dependency injection via `register*Dependencies()` functions
- Critical for utilities like `compactArray()` which needs `pixiCleanupObject`, sprite pools, etc.

## Module Structure

```
src/js/
├── main.js              # Main entry point
├── core/
│   ├── index.js         # Core module re-exports
│   ├── constants.js     # Game config (physics, graphics, audio, balance)
│   │                    # Includes UPGRADE_DATA and META_SHOP_UPGRADE_DATA
│   ├── math.js          # Vector class, SpatialHash for collision detection
│   ├── game-context.js  # Centralized GameContext object for all game state
│   ├── performance.js   # View culling and rendering optimization
│   ├── profiler.js      # Performance profiling
│   ├── jitter-monitor.js    # Frame time tracking
│   ├── staggered-cleanup.js # Spread cleanup across frames
│   └── perf-debug.js    # Console debug commands
├── systems/             # Extracted game systems (formerly in main.js)
│   ├── index.js         # Systems module re-exports
│   ├── game-loop.js     # Main game loop logic
│   ├── game-flow.js     # Game start/end/state management
│   ├── input-manager.js # Input handling
│   ├── collision-manager.js # Collision detection
│   ├── spawn-manager.js # Entity spawning
│   ├── event-scheduler.js # Timed events (arena countdown, etc.)
│   ├── sector-flow.js   # Sector transitions
│   ├── mini-event-manager.js # Mini events
│   ├── meta-manager.js # Meta shop/profile
│   ├── save-manager.js # Save/load system
│   ├── upgrade-manager.js # Level-up upgrades
│   ├── contract-manager.js # Contracts system
│   ├── particle-manager.js # Particle effects
│   ├── world-setup.js   # World initialization
│   ├── world-helpers.js # World generation helpers
│   └── all-registrations.js # All dependency registrations
├── entities/
│   ├── Entity.js        # Base class for all game entities
│   ├── FloatingText.js  # Floating damage/combat text
│   ├── index.js         # Entity module re-exports
│   ├── player/          # Player ship classes
│   ├── bosses/          # Boss enemies (Cruiser, Destroyer, Flagship, dungeon bosses)
│   ├── enemies/         # Regular enemies
│   ├── projectiles/     # Bullets, missiles, explosives
│   ├── particles/       # Visual effects and explosions
│   ├── pickups/         # Collectibles (coins, health, space nuggets)
│   ├── environment/     # Destructible asteroids, warp gates, POIs
│   ├── cave/            # Cave-specific entities and levels
│   ├── zones/           # Environmental hazards and special areas
│   └── support/         # Drones, turrets, support entities
├── rendering/
│   ├── index.js         # Rendering module re-exports
│   ├── pixi-context.js  # PixiJS layer management
│   ├── pixi-init.js     # PixiJS app initialization
│   ├── pixi-setup.js    # Additional PixiJS setup
│   ├── sprite-pools.js  # PixiJS sprite pooling system
│   ├── pixi-cleanup.js  # PixiJS cleanup utilities
│   ├── texture-loader.js # Asset loading management
│   ├── texture-manager.js # Asset loading coordination
│   ├── canvas-setup.js  # Canvas element setup
│   ├── background-renderer.js # Star field rendering
│   ├── minimap-renderer.js # Minimap rendering
│   ├── rendering-state.js # Rendering state management
│   └── colors.js        # Color conversion utilities
├── ui/                  # User interface modules
│   ├── index.js         # UI module re-exports
│   ├── menus.js         # Start, pause, settings menus
│   ├── hud.js           # Heads-up display
│   ├── levelup-screen.js # Level-up upgrade menu
│   ├── meta-shop.js     # Meta shop between runs
│   ├── settings-manager.js # Settings persistence
│   └── crt-filter.js    # CRT visual effect
├── audio/
│   └── audio-manager.js # Sound and music management
├── utils/
│   ├── index.js         # Utils module re-exports
│   ├── spawn-utils.js   # Spawn point utilities
│   ├── cleanup-utils.js # Cleanup utilities (clearArrayWithPixiCleanup, etc.)
│   ├── ui-helpers.js    # UI helper functions
│   └── game-helpers.js  # Game helper functions (compactArray, etc.)
└── debug/
    ├── index.js         # Debug module re-exports
    └── debug-spawn.js   # Debug spawn functions for testing
```

## Critical Patterns & Gotchas

### Variable Timestep Timing

All entity `update(deltaTime)` methods must use time scaling:

```javascript
update(deltaTime = 16.67) {
    if (this.dead) return;

    const dtFactor = deltaTime / 16.67;  // or use SIM_STEP_MS (8.33)

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

**When defining duration constants**, use frame counts at 60fps reference:
- 1 second = 60 frames
- 0.5 seconds = 30 frames
- These work correctly with dtScale because it normalizes to reference framerate

### Entity Cleanup Pattern

**CRITICAL**: `pixiCleanupObject()` does NOT clean up custom graphics like `_pixiGfx`, `_pixiNameText`, `_pixiText`, etc. These must be explicitly destroyed first:

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

### Dead Entity Checks

Always check `this.dead` early in update/draw methods:

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

### PixiJS Anti-Ghosting Pattern

When drawing dynamic graphics with PixiJS, always call `endFill()` after drawing lines to prevent ghost trails:

```javascript
gfx.lineStyle(2, color, alpha);
gfx.moveTo(x1, y1);
gfx.lineTo(x2, y2);
gfx.endFill();  // CRITICAL: prevents ghosting
```

### Persistent Graphics Objects

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

### POI/Event Entity Completion Pattern

For entities that are "claimed" or "completed" (like POIs), call `kill()` instead of just setting `dead = true`:

```javascript
claim() {
    if (this.claimed) return;
    this.claimed = true;
    // ... reward logic ...
    this.kill();  // Use kill() instead of this.dead = true
}
```

This ensures graphics are properly destroyed and the entity is removed from arrays.

### Dependency Injection Pattern

Many systems use dependency injection via `register*Dependencies()` functions:

```javascript
// In the entity/module file
let _spawnParticles = null;
let _getSimNowMs = null;

export function registerEntityDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
}

// In main.js during initialization
registerEntityDependencies({
    spawnParticles,
    getSimNowMs: getElapsedGameTime
});
```

This is critical for:
- `utils/game-helpers.js` - `compactArray()` needs `pixiCleanupObject`, `pixiBulletSpritePool`, `destroyBulletSprite`
- `entities/environment/poi.js` - POIs need `spawnParticles`, `getSimNowMs`
- Boss classes - Need various game functions for spawning particles, explosions, etc.

## Key Constants

From [src/js/core/constants.js](src/js/core/constants.js):

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
| `pixiCleanupObject(obj)` | rendering/sprite-pools.js | Standard PixiJS cleanup |
| `compactArray(arr)` | utils/game-helpers.js | Compact array removing dead entities |
| `findSpawnPointRelative(hostile)` | utils/spawn-utils.js | Find spawn position |
| `isInView()`, `isInExtendedView()` | Entity base | View culling checks |
| `showOverlayMessage()` | utils/ui-helpers.js | Show overlay message to player |

## Debug Console Commands

Available in browser console (F12) during gameplay:

### Performance Commands
- `perfEnable()` / `perfDisable()` - Toggle profiler
- `perfStats()` - Show current performance stats
- `perfReport()` - Print detailed performance report
- `perfWatch(secs)` - Monitor performance for N seconds
- `entityCount()` - Count all game entities
- `memStats()` - Memory usage statistics
- `perfCheck()` - Quick performance check with warnings

### Debug Spawn Commands
- `window.spawnCruiser()` - Spawn cruiser boss instantly
- `window.spawnStation()` - Spawn space station instantly
- `window.spawnFinalBoss()` - Spawn final boss instantly
- `window.spawnDungeonBoss(type)` - Spawn specific dungeon boss by name
- `window.enterDungeon1Debug()` - Enter dungeon mode

### Keyboard Shortcuts
- `Ctrl+Shift+3` - Spawn Cruiser boss instantly
- `Ctrl+Shift+4` - Spawn Space Station instantly
- `Ctrl+Shift+5` - Spawn Final Boss instantly
- `Ctrl+Shift+6` - Enter Dungeon1 instantly
- `Ctrl+Shift+D + 4-9` - Spawn specific dungeon bosses (4=NecroticHive, 5=CerebralPsion, 6=Fleshforge, 7=VortexMatriarch, 8=ChitinusPrime, 9=PsyLich)
- `Ctrl+Shift+H` - Toggle collision debug visualization (`DEBUG_COLLISION`)

## Upgrade System

### Popup/Level-Up Upgrades
Defined in `UPGRADE_DATA` in [src/js/core/constants.js](src/js/core/constants.js):

**Categories:**
- **Weapons**: Turret Damage, Turret Fire Rate, Turret Range, Multi-Shot, Flak Shotgun, Static Weapons, Homing Missiles, Volley Shot, CIWS, Chain Lightning, Backstabber
- **Shields & Hull**: Hull Strength, Segment Count, Outer Shield, Shield Regen, Hull Regen, Reactive Shield, Damage Mitigation
- **Mobility**: Speed, Turbo Boost
- **Specials**: XP Magnet, Area Nuke, Phase Shield, Stasis Field
- **Drones**: Companion Drones

### Meta Shop Upgrades
Permanent progression upgrades purchased with Space Nuggets. Defined in `META_SHOP_UPGRADE_DATA`:

**Categories:**
- **Core**: Start Damage Boost, Passive +HP, Hull Plating, Shield Core, Static Blueprint, Missile Primer, Magnet Booster, Global Defense Ring, Speed Tuning, Bank Multiplier, Shop Discount, Extra Life
- **Combat**: Piercing Rounds, Explosive Rounds, Critical Strike, Split Shot, Thorn Armor, Lifesteal, Evasion Boost
- **Utility**: Shield Recharge, Dash Cooldown, Dash Duration, XP Magnet+, Auto-Reroll, Nugget Magnet, Contract Speed, Starting Rerolls, Lucky Drop, Bounty Hunter
- **Advanced**: Combo Meter, Starting Weapon, Second Wind, Battery Capacitor

## Common Issues and Solutions

### Graphics Not Cleaning Up
**Symptom**: Entity graphics remain visible after entity should be gone
**Cause**: `pixiCleanupObject()` doesn't clean up custom `_pixi*` properties
**Fix**: Explicitly destroy all custom graphics in `kill()` method:
```javascript
kill() {
    if (this.dead) return;
    this.dead = true;
    if (this._pixiGfx) {
        try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
        this._pixiGfx = null;
    }
    // ... other graphics ...
    pixiCleanupObject(this);
}
```

### POI/Event Not Disappearing
**Symptom**: Derelict Ship, Debris Field, or other POI graphics stay after completion
**Cause**: Setting `dead = true` without calling `kill()` to cleanup graphics
**Fix**: Call `this.kill()` in `claim()` method, not just `this.dead = true`

### "X is not defined" Errors
**Symptom**: `ReferenceError: Cruiser is not defined` (or other entity)
**Cause**: Entity class imported to systems but missing from import statement
**Fix**: Add entity to imports in `systems/game-loop.js` or other system files

### Missing Dependency Function
**Symptom**: `TypeError: pixiCleanupObject is not a function`
**Cause**: Dependency not registered via `register*Dependencies()`
**Fix**: Ensure dependency is passed in the registration call in `main.js`

## Electron Wrapper

Located in `electron/`:
- `main.js` - Main process, creates browser window, handles IPC for settings
- `preload.js` - Context bridge between renderer and Node.js
- Settings persisted to `userData/settings.json`
- Cache management configured for temp directory

## Game Context Access

Access game state via the `GameContext` export:

```javascript
import { GameContext } from './core/game-context.js';

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
