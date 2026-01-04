# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm start` - Start the Electron app in normal mode
- `npm run start:dev` - Start with DevTools opened (for debugging)
- `npm run start:smoke` - Run smoke test (auto-closes after load)
- `npm run dist` - Build distributables for current platform
- `npm run dist:win` - Build Windows installer (NSIS)

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
- `window.spawnStation()` - DEBUG: Spawn space station instantly

## Architecture Overview

### Monolithic Game Loop
This is an Electron wrapper for "Neon Space Cave," a 2D space shooter. The core game logic (`src/js/main.js`) is a large monolithic file (~750KB) that contains:

- **Game Loop**: Fixed timestep simulation (60 FPS) with configurable max catch-up steps
- **Entity System**: Class-based entities with manual lifecycle management (not ECS)
- **Rendering**: Hybrid DOM (primary UI) + PixiJS (game world sprites) + Canvas 2D overlays (directional arrows, minimap)
- **Collision Detection**: Spatial hash grids for efficient collision queries
- **State Management**: Global variables for game state (score, flags, active entities)

### Key Systems

**Simulation Timing** (`src/js/core/constants.js`):
- `SIM_FPS = 60` - Fixed simulation framerate
- `SIM_STEP_MS = 16.67` - Milliseconds per simulation step
- `SIM_MAX_STEPS_PER_FRAME = 4` - Max catch-up steps to prevent spiral of death

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

### Module Structure

```
src/js/
├── main.js              # Monolithic game loop (contains all entity classes)
├── core/
│   ├── constants.js     # Game configuration (physics, graphics, audio, balance)
│   ├── math.js          # Vector class, SpatialHash for collision detection
│   ├── state.js         # Global game state management
│   ├── profiler.js      # Performance profiling
│   ├── jitter-monitor.js    # Frame time tracking
│   ├── staggered-cleanup.js # Spread cleanup across frames
│   └── perf-debug.js    # Console debug commands
├── entities/
│   ├── Entity.js        # Base class for all game entities
│   ├── pickups/         # Coin, SpaceNugget, HealthPowerUp
│   ├── particles/       # Particle, Explosion, WarpParticle
│   └── projectiles/     # Projectile classes
├── rendering/
│   ├── colors.js        # Color conversion utilities
│   ├── sprite-pools.js  # PixiJS sprite pooling system
│   └── pixi-setup.js    # PixiJS initialization
└── audio/
    └── audio-manager.js # Sound and music management
```

### Electron Wrapper (`electron/`)

- `main.js` - Main process, creates browser window, handles IPC for settings
- `preload.js` - Context bridge between renderer and Node.js
- Settings persisted to `userData/settings.json`
- Cache management configured for temp directory

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

## Known Issues and Fixes

See `ENTITY_CLEANUP_FINAL.md`, `JITTER_FIXES.md`, and related fix documents for detailed explanations of:
- Radiation storm cleanup (self-nullification pattern)
- Shield ring scaling at different zoom levels
- Entity sprite cleanup patterns
- Stutter/jitter fixes (upgrade menu timing, staggered cleanup)

## Game Configuration

Key constants in `src/js/core/constants.js`:
- `ZOOM_LEVEL` - Default camera zoom
- `SIM_FPS` - Simulation framerate
- `PIXI_SPRITE_POOL_MAX` - Max sprites per pool type
- `USE_PIXI_OVERLAY` - Whether to use PixiJS for rendering
- `ENABLE_NEBULA` - Nebula background rendering
- `BACKGROUND_MUSIC_URL` - Music file location
