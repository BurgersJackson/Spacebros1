# main.js Refactoring Progress Tracking

**Goal**: Reduce main.js from 6,411 lines to under 1,000 lines

## Current Progress

**Starting lines**: 6,411
**Current lines**: 2,495
**Lines removed**: 3,916 (61.1%)
**Target**: Under 1,000 lines
**Remaining to remove**: 1,495 lines

---

## Planned Removals

### Phase 1: Simple Entity Classes
- [ ] **ShootingStar class** (~90 lines)
  - Created: `src/js/entities/environment/ShootingStar.js`
  - Added dependency registration in main.js
  - Lines removed: 90

- [ ] **WarpGate class** (~80 lines)
  - Already existed in `src/js/entities/environment/WarpGate.js`
  - Removed duplicate class from main.js
  - Lines removed: 162 (including Dungeon1Gate)

- [ ] **Dungeon1Gate class** (~50 lines)
  - Already existed in `src/js/entities/environment/Dungeon1Gate.js`
  - Removed duplicate class from main.js
  - Part of WarpGate removal above

### Unused Classes Removed
- [ ] **WarpTurret class** (~75 lines)
  - Never used anywhere in codebase
  - Lines removed: 75

- [ ] **MiniEventDefendCache class** (~200 lines)
  - Never used anywhere in codebase
  - Lines removed: 200

- [ ] **SectorPOI class** (~135 lines)
  - Never used anywhere in codebase
  - Lines removed: 135

- [ ] **DerelictShipPOI class** (~7 lines)
  - Never used anywhere in codebase
  - Lines removed: 7

- [ ] **DebrisFieldPOI class** (~9 lines)
  - Never used anywhere in codebase
  - Lines removed: 9

- [ ] **ExplorationCache class** (~95 lines)
  - Never used anywhere in codebase
  - Lines removed: 95

### Unused Functions Removed
- [ ] **beginFlagshipFight function** (~20 lines)
  - Never called anywhere
  - Lines removed: 20

- [ ] **exitWarpMaze function** (~141 lines)
  - Never called anywhere
  - Lines removed: 141

- [ ] **exitDungeon1 function** (~21 lines)
  - Never called anywhere
  - Lines removed: 21

### Phase 4: Game State Functions
- [ ] **Game State Functions** (~389 lines)
  - Created: `src/js/systems/game-state-manager.js`
  - Extracted: `getGameNowMs`, `startGame`, `endGame`, `shiftPausedTimers`, `togglePause`, `quitGame`
  - Added: `createUpdateResumeButtonState` for resume button state management
  - Added dependency registration in main.js
  - Lines removed: 389

### Phase 5: Helper Functions
- [ ] **Helper Functions** (~24 lines)
  - Created: `src/js/utils/game-helpers.js`
  - Extracted: `showFloatingText`, `addPickupFloatingText`, `awardCoinsInstant`, `spawnSmoke`, `spawnBarrelSmoke`
  - Added dependency registration in main.js
  - Lines removed: 24

### Phase 6: Registration Functions
- [ ] **Centralized Registration Module** (~498 lines)
  - Created: `src/js/systems/registration.js`
  - Extracted all entity and system dependency registration calls
  - Replaced ~500 lines of registration code with single `registerAllDependencies()` call
  - Lines removed: 498

### Phase 7: Texture/Asset Loading
- [x] **Texture and asset loading** (~839 lines)
  - Created: `src/js/rendering/texture-manager.js`
  - Replaced inline asset loading with `initTextureAssets()`
  - Lines removed: 839

### Phase 8: Canvas/Setup Initialization
- [x] **Canvas + PixiJS initialization** (~961 lines)
  - Created: `src/js/rendering/canvas-setup.js`, `src/js/rendering/pixi-init.js`
  - Replaced inline setup with `initCanvasSetup()` and `initPixiOverlay()`
  - Lines removed: 961

### Phase 9: Settings/Profile UI
- [x] **Settings and profile UI logic** (~718 lines)
  - Created: `src/js/ui/settings-manager.js`
  - Replaced inline logic with `initSettingsMenu()` and `initProfileSystem()`
  - Lines removed: 718

### Phase 10: POI/Cache Entities
- [x] **POI and cache entities** (~339 lines)
  - Created: `src/js/entities/environment/poi.js`
  - Extracted: `SectorPOI`, `DerelictShipPOI`, `DebrisFieldPOI`, `ExplorationCache`
  - Lines removed: 339

### Phase 11: Mini-Event Entities
- [x] **MiniEventDefendCache** (~200 lines)
  - Created: `src/js/entities/environment/MiniEventDefendCache.js`
  - Extracted: `MiniEventDefendCache`
  - Lines removed: 200

### Phase 1: Unused Classes Removed
- [x] **WarpTurret class** (~120 lines)
  - Removed unused class from `src/js/main.js`
  - Lines removed: 120

### Phase 12: ShootingStar Entity
- [x] **ShootingStar** (~190 lines)
  - Created: `src/js/entities/environment/ShootingStar.js`
  - Extracted: `ShootingStar`
  - Lines removed: 190

### Phase 13: Particle System
- [x] **Particle manager extraction** (~150 lines)
  - Created: `src/js/systems/particle-manager.js`
  - Extracted particle pooling, explosions, and smoke emitters
  - Lines removed: 150

### Phase 1: Simple Entity Classes
- [x] **WarpGate class** (~80 lines)
  - Removed duplicate class from `src/js/main.js`
  - Lines removed: 80
- [x] **Dungeon1Gate class** (~50 lines)
  - Removed duplicate class from `src/js/main.js`
  - Lines removed: 50

### Phase 1: Unused Functions Removed
- [x] **exitWarpMaze function** (~200 lines)
  - Removed unused function from `src/js/main.js`
  - Lines removed: 200
- [x] **exitDungeon1 function** (~35 lines)
  - Removed unused function from `src/js/main.js`
  - Lines removed: 35

---

## Next Steps (from original plan)

### Phase 7: Extract Texture/Asset Loading (~1,500 lines)
- Target: Image loading, texture generation, sprite pool setup
- New file: `src/js/rendering/texture-manager.js`

### Phase 8: Extract Canvas/Setup Initialization (~800 lines)
- Target: Canvas setup and PixiJS initialization
- New files: `src/js/rendering/canvas-setup.js`, `src/js/rendering/pixi-init.js`

### Phase 9: Extract UI/Menu Logic (~500 lines)
- Target: Settings menu and profile management
- New file: `src/js/ui/settings-manager.js`

---

## Test Results

- [ ] Smoke test after ShootingStar extraction - NOT RUN
- [ ] Smoke test after Phase 3 cleanup (unused classes/functions) - NOT RUN
- [ ] Fix ShootingStar duplicate import - NOT RUN
- [ ] Fix ExplorationCache not defined error - NOT RUN
- [ ] Smoke test after Phase 4 (Game State Functions) - NOT RUN
- [ ] Smoke test after Phase 5 (Helper Functions) - NOT RUN
- [ ] Smoke test after Phase 6 (Registration Functions) - NOT RUN
- [x] Smoke test after Phase 7 (Texture/Asset Loading) - PASSED
- [x] Smoke test after Phase 8 (Canvas/PixiJS Init) - PASSED
- [x] Smoke test after Phase 9 (Settings/Profile UI) - PASSED
- [x] Smoke test after Phase 10 (POI/Cache Entities) - PASSED
- [x] Smoke test after Phase 11 (MiniEventDefendCache) - PASSED
- [x] Smoke test after Phase 12 (ShootingStar/WarpGate cleanup) - PASSED
- [x] Smoke test after Phase 13 (Particle manager) - PASSED
