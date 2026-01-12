# Phase 1 Refactor Status

## Completed
- Created `GameContext` singleton and `getElapsedGameTime` in `src/js/core/game-context.js`.
- Re-exported `GameContext` from `src/js/core/index.js`.
- Added utils index and modules:
    - `src/js/utils/index.js`
    - `src/js/utils/spawn-utils.js`
    - `src/js/utils/cleanup-utils.js`
    - `src/js/utils/ui-helpers.js`
- Wired `main.js` to use helper modules for spawn, cleanup, and UI updates.
- Routed input state (`keys`, mouse state, gamepad state, input mode) through `GameContext`.
- Routed core timing and game state (`gameActive`, `gamePaused`, `gameMode`, `gameStartTime`, `pausedAccumMs`, `currentZoom`) through `GameContext`.
- Routed UI selection and debug flags (`menuSelectionIndex`, `DEBUG_COLLISION`) through `GameContext`.
- Routed background arrays (`warpParticles`, `starfield`, `nebulas`, `shockwaves`) through `GameContext`.
- Updated sector index usage to read/write `GameContext.sectorIndex` while keeping save schema keys intact.
- Migrated remaining global state in `main.js` into `GameContext` (entity arrays, globals, grids, progression stats, spawn timers/queues, meta/profile state).
- Replaced remaining direct uses of migrated globals with `GameContext` accessors.
- Removed redundant local globals after migration.

## Not Implemented Yet (Phase 1)
- `getOffscreenSpawnPosition` is not present in `main.js`, so it has not been extracted.

## Notes
- `main.js` still holds a large number of globals; Phase 1 focuses on state centralization, not full modularization.
