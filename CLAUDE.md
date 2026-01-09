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

## Architecture Overview

### Monolithic Game Loop
This is an Electron wrapper for "Neon Space Cave," a 2D space shooter. The core game logic (`src/js/main.js`) is a large monolithic file (~800KB) that contains:

- **Game Loop**: Variable timestep simulation with `dtScale` (deltaTime / SIM_STEP_MS) for frame-rate independence
- **Entity System**: Class-based entities with manual lifecycle management (not ECS)
- **Rendering**: Hybrid DOM (primary UI) + PixiJS (game world sprites) + Canvas 2D overlays (directional arrows, minimap)
- **Collision Detection**: Spatial hash grids for efficient collision queries
- **State Management**: Global variables for game state (score, flags, active entities)

### Key Systems

**Variable Timestep Timing** (`src/js/core/constants.js`):
- Game uses **variable timestep** - NOT locked to 60fps
- `SIM_FPS = 60` - Reference framerate for calibration (kept for backwards compatibility)
- `SIM_STEP_MS = 16.67` - Milliseconds per simulation step at reference framerate
- `SIM_MAX_STEPS_PER_FRAME = 4` - Max catch-up steps to prevent spiral of death
- **IMPORTANT**: All timing must use `dtScale = deltaTime / SIM_STEP_MS` or `dtFactor = deltaTime / 16.67`
- Time-based counters use `this.t += dtFactor` instead of `this.t++`
- Frame-based checks use `Math.floor(this.t) % N === 0` for compatibility with time-scaled counters

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
│   │                    # Includes UPGRADE_DATA and META_SHOP_UPGRADE_DATA
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
- Static Blueprint, Missile Primer, Magnet Booster, Nuke Capacitor
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
- Mouse movement: `src/js/main.js:3387-3400`
- Rotation mode: `src/js/main.js:3396, 3482-3492`
- Turbo boost with right-click: `src/js/main.js:3354`
- Cursor hiding: `src/js/main.js:2192-2201`

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
- **Location**: `Spaceship.drawLaser()` in `src/js/main.js:4123-4171`
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
