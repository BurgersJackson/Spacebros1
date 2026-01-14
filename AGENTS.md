# AGENTS.md

This file provides guidance for AI coding agents working on this codebase.

## Development Commands

### Running the Application
- `npm start` - Start the Electron app in normal mode
- `npm run start:dev` - Start with DevTools opened (for debugging)
- `npm run start:smoke` - Run smoke test (auto-closes after load)
- `npm run dist` - Build distributables for current platform
- `npm run dist:win` - Build Windows installer (NSIS)
- `npm run dist:linux` - Build Linux packages (AppImage, deb, tar.gz)

### Testing
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

**Running a single test:**
- `npx vitest run tests/unit/core/math.test.js` - Run specific test file
- `npx vitest run --testNamePattern="Vector"` - Run tests matching pattern
- `npx vitest tests/unit/core/constants.test.js --reporter=verbose` - Verbose output

**Test structure:**
- Tests located in `/tests/unit/` directory
- Vitest configuration in `vitest.config.js` supports ESM modules
- Test setup in `tests/setup.js` runs before all test suites

## Code Style Guidelines

### Imports and Module Structure
- Use ES6 module syntax: `import { ClassName } from './path/index.js'`
- Prefer importing from index files: `import { GameContext } from './core/index.js'`
- Avoid default exports; use named exports consistently
- Legacy files in `src/js/entities.js`, `src/js/constants.js`, `src/js/utils.js` may contain duplicates; prefer modular versions

### Naming Conventions
- **Classes**: PascalCase (`Entity`, `Spaceship`, `GameContext`)
- **Variables/functions**: camelCase (`spawnParticles`, `getSimNowMs`)
- **Constants**: UPPER_SNAKE_CASE (`PHYSICS_FPS`, `SIM_STEP_MS`)
- **Private properties**: Prefix with underscore (`this._pixiGfx`, `this._pixiInnerGfx`)
- **Files**: kebab-case for directories, PascalCase for classes (`cave-monster.js`, `CaveMonster.js`)

### Time Scaling and Physics
- **Critical**: All timing must normalize to 60Hz reference using `dtFactor = deltaTime / 16.67`
- Time-based counters use `this.t += dtFactor` NOT `this.t++`
- Frame-based checks use `Math.floor(this.t) % N === 0`
- Import constants: `import { SIM_STEP_MS, SIM_FPS } from '../core/constants.js'`

### Entity Lifecycle and Cleanup
- All entities must have `dead` property (boolean, defaults false)
- Always check `if (this.dead) return;` early in `update()` and `draw()` methods
- Use `kill()` method to destroy entities; never directly splice arrays during iteration
- Graphics cleanup order:
  1. Destroy custom `_pixi*` graphics explicitly (try/catch around destroy)
  2. Call `pixiCleanupObject(this)` for standard cleanup
  3. Continue with death logic (effects, drops)
- Global entity references (`boss`, `destroyer`, `spaceStation`) must be nullified on death

### PixiJS Rendering Patterns
- Call `gfx.endFill()` after drawing lines to prevent ghost trails
- For persistent graphics (shields, rings), reuse the Graphics object and call `clear()` before redrawing
- Layer structure: `pixiBaseLayer`, `pixiEnemyLayer`, `pixiBossLayer`, `pixiVectorLayer`, `pixiBulletLayer`, `pixiParticleLayer`
- Scale line widths inversely with zoom: `lineWidth = baseWidth / Math.max(0.5, currentZoom || ZOOM_LEVEL)`

### Dependency Injection
- Systems use `register*Dependencies()` pattern for loose coupling
- Register dependencies at initialization in `main.js` or `all-registrations.js`
- Functions receive deps object: `export function registerEntityDependencies(deps) { ... }`

### Error Handling
- Use try/catch around PixiJS destroy calls to prevent crashes
- Always check for null/undefined before accessing properties: `if (!other) return false;`
- Graceful degradation for missing dependencies: `if (deps.spawnParticles) _spawnParticles = deps.spawnParticles`

### State Management
- Use `GameContext` for all global state: `import { GameContext } from './core/index.js'`
- Access entity arrays: `GameContext.enemies`, `GameContext.bullets`, `GameContext.particles`
- Never create new global variables; extend GameContext instead
- Use `GameContext.reset()` for clean game restarts

### Documentation
- Add JSDoc comments for public methods
- Include `@param` and `@returns` tags for complex functions
- Keep CLAUDE.md updated with new patterns and critical gotchas

## Debug Tools

**Console commands during gameplay (F12):**
- `perfEnable()`/`perfDisable()` - Toggle profiler
- `perfStats()` - Show performance stats
- `entityCount()` - Count all game entities
- `window.spawnCruiser()` - Spawn cruiser boss instantly

**Keyboard shortcuts:**
- `Ctrl+Shift+3` - Spawn Cruiser
- `Ctrl+Shift+4` - Spawn Space Station
- `Ctrl+Shift+5` - Spawn Final Boss
- `Ctrl+Shift+H` - Toggle collision debug visualization
