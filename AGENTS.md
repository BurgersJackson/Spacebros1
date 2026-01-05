# AGENTS.md

## Development Commands

- `npm start` - Start the Electron app in normal mode
- `npm run start:dev` - Start with DevTools opened (for debugging)
- `npm run start:smoke` - Run smoke test (auto-closes after load)
- `npm run dist` - Build distributables for current platform
- `npm run dist:win` - Build Windows installer (NSIS)

**Note:** No test framework is configured. To test changes, run the app with `npm start:dev` and interact with it.

## Code Style Guidelines

### Imports
- Use ES6 named imports with `.js` extensions
- Import from barrel files when possible: `import { Vector, SpatialHash } from './core/math.js';`
- Relative paths use `../` for parent directories

### Formatting
- 4-space indentation
- DO NOT add any comments (unless explicitly asked)
- Use JSDoc blocks for public functions: `@param {number} deltaTime`, `@returns {boolean}`

### Types
- Plain JavaScript (no TypeScript)
- Use JSDoc for type hints in function signatures
- Check types with `typeof` and `instanceof` when needed

### Naming Conventions
- **Classes:** PascalCase (Entity, Vector, Explosion)
- **Functions:** camelCase (initAudio, playSound, pixiCleanupObject)
- **Constants:** UPPER_SNAKE_CASE (ZOOM_LEVEL, SIM_FPS, PIXI_SPRITE_POOL_MAX)
- **Variables:** camelCase (pos, vel, hp, dead)
- **Private properties:** underscore prefix (_pixiGfx, _pixiContainer, _poolType)

### Error Handling
- Always wrap PixiJS destruction in try-catch blocks
- Use early returns with `if (this.dead)` in update/draw methods
- Check null/undefined before accessing nested properties
- Use `|| 0` fallbacks for math operations to prevent NaN

### Entity Cleanup Pattern
Critical for PixiJS entities with custom graphics:

```javascript
kill() {
    if (this.dead) return;
    this.dead = true;

    // 1. Clean up entity-specific graphics FIRST
    if (this._pixiGfx) {
        try { this._pixiGfx.destroy(true); } catch (e) { }
        this._pixiGfx = null;
    }

    // 2. Standard cleanup
    pixiCleanupObject(this);
}
```

### Zoom Scaling
PixiJS `lineStyle()` uses absolute widths. Scale inversely with zoom:
```javascript
const lineWidth = baseWidth / Math.max(0.5, currentZoom || ZOOM_LEVEL);
```

### Global Entity References
Some entities have global references that must be nullified on death:
- `radiationStorm`, `boss`, `destroyer`, `spaceStation`
```javascript
if (this.dead) {
    if (globalEntity === this) {
        globalEntity = null;
    }
    return;
}
```

### Sprite Pooling
- Use `allocPixiSprite()` to get sprites from pools
- Use `releasePixiSprite()` to return sprites
- Never manually destroy pooled sprites - they're reused

### Dead Entity Checks
Always check `this.dead` early in update/draw methods to prevent operating on dead entities.

## Architecture Notes

- **Monolithic main.js** (~750KB) contains the game loop and all entity classes
- **Fixed timestep:** 60 FPS simulation with `deltaTime / 16.67` scaling
- **PixiJS sprites** for performance-critical rendering (bullets, enemies, particles)
- **SpatialHash** for efficient collision detection
- Global state variables for game state (score, flags, active entities)

## Debug Commands (Console)
- `perfEnable()` / `perfDisable()` - Toggle profiler
- `perfStats()` - Show current performance stats
- `entityCount()` - Count all game entities
- `window.spawnCruiser()` - Spawn cruiser boss
- `window.spawnStation()` - Spawn space station
