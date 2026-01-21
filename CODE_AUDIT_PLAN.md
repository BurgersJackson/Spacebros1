# Spacebros1 Code Audit Plan

## Overview
Systematic, phased approach to identify and fix logic errors, bad code, and maintainability issues across 154 JavaScript files.

---

## Phase 1: Quick Wins (Low-Hanging Fruit)
**Target:** ~2-3 hours | **Impact:** Immediate bug fixes, clean code
**Status:** ✅ COMPLETED - 2026-01-21

### Phase 1 Progress Log:
- 2026-01-21: Phase 1 initiated, analysis complete, plan updated with actual data
- 2026-01-21: Console statement cleanup completed (removed 42 debug statements, kept 122 total)
- 2026-01-21: Logic error checks completed (no infinite loops, null checks adequate, division by zero protected)
- 2026-01-21: All tests passing (65/65)

### 1.1 Remove Legacy Duplicate Files - CANCELLED
- **Status:** Analysis complete - files are NOT duplicates:
  - `src/js/entities.js` (687 lines) - Contains Entity classes, Coin, WarpGate, etc. used by game
  - `src/js/constants.js` (603 lines) - Contains unique UPGRADE_DATA and state objects
  - `src/js/utils.js` (634 lines) - Contains Vector, SpatialHash, audio functions, colorToPixi
- **Action:** No removal needed, original plan was incorrect
- **Notes:** Files serve different purposes and are actively used

### 1.2 Remove Console Statements - ✅ COMPLETED
- **Scope:** Find all `console.*` calls across codebase
- **Action:** Remove or replace with proper logging system
- **Status:** ✅ Complete:
  - Total console statements before cleanup: 164
  - Total console statements after cleanup: 122
  - Removed: 42 debug statements
  - Remaining breakdown: 19 debug/log (performance monitoring, help docs), 103 error handling (warn/error)
- **Files processed:** debug-spawn.js, game-flow.js, collision-manager.js, particle-manager.js, game-loop.js, pixi-init.js, settings-manager.js, menus.js, Destroyer.js, Destroyer2.js, Shockwave.js, FinalBoss.js, WarpSentinelBoss.js, pickup-safety.js, main.js
- **Priority:** Removed debug statements, kept critical error handling
- **Result:** All tests passing (65/65), no gameplay changes

### 1.3 Fix Obvious Logic Errors - ✅ COMPLETED
- **Status:** ✅ Complete - No critical issues found
- **Infinite loops:** All while/for loops have proper termination conditions. Two `while(true)` loops in sprite-editor.js are for line drawing algorithms with explicit break conditions.
- **Null checks:** Codebase uses appropriate null checks for nullable entities (`GameContext.boss`, `GameContext.destroyer`, `GameContext.player`). Pattern: `if (GameContext.entity && !GameContext.entity.dead)`
- **Uninitialized variables:** Math/collision code properly initializes variables. Vector.div() method checks for zero division before executing.
- **Math operations:** Edge cases properly handled. Vector.div() has explicit zero-division protection.

---

## Phase 2: Setup Quality Tools
**Target:** ~1-2 hours | **Impact:** Prevent future bugs

### 2.1 Install Linting Tools
- Install ESLint with Airbnb or Google config
- Enable rules for:
  - No unused variables
  - No console statements
  - Proper error handling
  - Consistent formatting
- Configure to run on `npm test`

### 2.2 Install Code Formatter
- Install Prettier
- Configure to match linter rules
- Auto-format on save

### 2.3 Install TypeScript (Optional)
- Evaluate feasibility
- Convert critical modules
- Benefits: Compile-time error detection

---

## Phase 3: Test Coverage Expansion
**Target:** ~8-12 hours | **Impact:** 100% bug prevention

### 3.1 Add Unit Tests for Core Math
- **Already exists:** `math.test.js`, `constants.test.js`
- **Action:** Expand to cover edge cases

### 3.2 Test Critical Systems
- **Priority systems:**
  - `collision-manager.js` - Critical for gameplay
  - `spawn-manager.js` - Entity creation
  - `game-flow.js` - Level progression
  - `input-manager.js` - User interaction

### 3.3 Test Entity Lifecycle
- Base `Entity.js` class
- Player ship movement & shooting
- Enemy behavior
- Boss mechanics

### 3.4 Test Upgrade/Progression Systems
- `upgrade-manager.js`
- `save-manager.js`
- `meta-manager.js`

### 3.5 Set Coverage Target
- **Phase 3:** 20-30% coverage
- **Phase 4:** 50-60% coverage
- **Phase 5:** 80%+ coverage

---

## Phase 4: Large File Refactoring
**Target:** ~6-8 hours | **Impact:** Maintainability, readability

### 4.1 High-Priority Refactors
- `src/js/systems/collision-manager.js` (1,771 lines)
  - Split into: collision detection, collision resolution, special cases
- `src/js/systems/game-loop.js` (1,598 lines)
  - Extract: update loop, draw loop, event handling
- `src/js/entities/player/Spaceship.js` (1,824 lines)
  - Extract: movement, shooting, upgrades, shields

### 4.2 Modulo Refactoring
- Ensure all time scaling uses `SIM_STEP_MS` and `SIM_FPS` constants
- Fix any hardcoded 16.67 or 60 values

### 4.3 Dependency Injection Verification
- Verify all systems use `register*Dependencies()` pattern
- Check proper initialization order

---

## Phase 5: Complex System Audits
**Target:** ~12-16 hours | **Impact:** Critical bug fixes

### 5.1 Boss System Review
- **Cave Bosses** (10 files):
  - Verify collision logic
  - Check health/damage calculations
  - Validate behavior states
  - Test upgrade interactions

- **Dungeon Bosses** (9 files):
  - Complex behavior patterns
  - Multiple attack types
  - Check for infinite states

### 5.2 Cave System Review
- **23 cave entity files**:
  - `CaveMonsterBase` behavior
  - Cave level generation
  - Trigger systems (rockfalls, gas vents)
  - Maze/draft zone logic

### 5.3 Projectile System
- Verify collision detection
- Check edge cases (out of bounds)
- Validate damage calculations

### 5.4 Particle System
- Ensure proper cleanup (memory leaks)
- Verify performance impact

---

## Phase 6: Performance & Memory
**Target:** ~4-6 hours | **Impact:** Smooth gameplay

### 6.1 Memory Leaks Check
- Verify all entities properly clean up
- Check PixiJS object disposal
- Validate array splicing (use `kill()` method)
- Verify sprite pool management

### 6.2 Performance Hotspots
- Profile frame rate during gameplay
- Identify slow collision detection
- Check heavy rendering operations

### 6.3 Staggered Cleanup
- Verify all systems use staggered cleanup
- Check proper cleanup order:
  1. Destroy graphics
  2. Remove from arrays
  3. Nullify references

---

## Phase 7: Error Handling & Edge Cases
**Target:** ~4-6 hours | **Impact:** Crash prevention

### 7.1 Try/Catch Coverage
- Verify all PixiJS operations wrapped in try/catch
- Check for unhandled promise rejections
- Validate error logging

### 7.2 Null Checks
- Verify all object property access has null checks
- Check GameContext array access
- Validate object references before use

### 7.3 Boundary Conditions
- Out of bounds coordinates
- Zero division
- Negative values where invalid
- Empty arrays/objects

---

## Phase 8: Documentation & Cleanup
**Target:** ~2-3 hours | **Impact:** Maintainability

### 8.1 Code Comments
- Add JSDoc comments to public methods
- Document complex algorithms
- Mark TODO/FIXME items

### 8.2 Deprecated Code Removal
- Remove any marked for deprecation
- Update references to new locations

### 8.3 Update Documentation
- Reflect code structure changes
- Update AGENTS.md with new patterns

---

## Audit Checklist Template

For each file, run through this checklist:

- [ ] **Syntax & Structure**
  - Valid JavaScript syntax
  - Proper module imports/exports
  - No duplicate variable declarations

- [ ] **Logic Errors**
  - No infinite loops
  - Correct conditionals
  - Proper null/undefined checks

- [ ] **Time Scaling**
  - Uses `SIM_STEP_MS` and `SIM_FPS`
  - Consistent with 60Hz reference

- [ ] **Entity Lifecycle**
  - Proper `dead` property check
  - Uses `kill()` method
  - Cleanup order correct

- [ ] **PixiJS Cleanup**
  - Graphics destroyed
  - Parent sprites removed
  - Memory properly released

- [ ] **Error Handling**
  - Try/catch around PixiJS
  - Null checks before access
  - No console.log pollution

- [ ] **Performance**
  - No unnecessary calculations
  - Uses spatial hashing
  - Proper array operations

- [ ] **Testing**
  - Covered by unit tests
  - Edge cases tested
  - Fixed if bugs found

---

## Execution Order

### Week 1: Foundation
- Day 1-2: Phase 1 (Quick Wins)
- Day 3: Phase 2 (Quality Tools)

### Week 2: Testing
- Day 4-5: Phase 3 (Test Coverage - Core)
- Day 6: Phase 3 (Test Coverage - Systems)

### Week 3: Refactoring
- Day 7: Phase 4 (Large Files - part 1)
- Day 8: Phase 4 (Large Files - part 2)

### Week 4: Complex Systems
- Day 9: Phase 5 (Boss Systems)
- Day 10: Phase 5 (Cave Systems)

### Week 5: Optimization
- Day 11: Phase 6 (Performance)
- Day 12: Phase 7 (Error Handling)

### Week 6: Polish
- Day 13: Phase 8 (Documentation)
- Day 14: Final verification & reporting

---

## Metrics & Success Criteria

### Immediate Wins
- ✅ Remove 3 legacy files (~1,900 lines)
- ✅ Remove console statements (~47 files)
- ✅ Setup ESLint + Prettier

### Short-term
- ✅ Test coverage: 20-30%
- ✅ Refactor 3 largest files
- ✅ Fix 10-15 critical bugs

### Medium-term
- ✅ Test coverage: 50-60%
- ✅ All systems tested
- ✅ Complex systems audited

### Long-term
- ✅ Test coverage: 80%+
- ✅ All entities reviewed
- ✅ No memory leaks
- ✅ Performance optimized

---

## Risk Mitigation

### During Audit
- **Backup frequently** - Use git commits before major changes
- **Test in parallel** - Don't break existing tests
- **Document breaking changes** - Update AGENTS.md
- **Keep repo clean** - Remove unused branches

### During Refactoring
- **Incremental changes** - Commit after each logical change
- **Maintain API** - Don't break external interfaces
- **Run tests after each change** - Catch regressions early

### Risk Areas
- **Game flow changes** - Can break entire game state
- **Collision changes** - Can create unfair gameplay
- **Performance regressions** - Can make game unplayable

---

## Tools & Resources

### Current Tools
- Vitest 4.0.17 (testing)
- Phaser 3.90.0 (game engine)
- Electron 35.0.0 (desktop app)

### New Tools to Add
- ESLint (code linting)
- Prettier (code formatting)
- VS Code extensions (linting, formatting)
- Chrome DevTools (performance profiling)

### Documentation
- AGENTS.md (AI agent guidance)
- CLAUDE.md (Claude-specific patterns)
- README.md (user-facing documentation)
- This audit plan

---

## Expected Outcomes

### Bug Fixes
- Runtime errors eliminated
- Logic errors corrected
- Edge cases handled

### Code Quality
- Consistent code style
- Better error handling
- Improved maintainability

### Testing
- Comprehensive test coverage
- Regression prevention
- Confidence in refactoring

### Performance
- No memory leaks
- Smooth frame rate
- Efficient collision detection

---

## Next Steps

1. **Review this plan** - ✅ Complete (2026-01-21)
2. **Set up dev environment** - ✅ Complete (Vitest already configured)
3. **Start Phase 1** - ✅ Complete - Console statement cleanup + logic error checks
4. **Start Phase 2** - 🔜 Next: Install ESLint + Prettier for code quality
5. **Document findings** - Track issues as they're found
6. **Iterate** - Adjust plan based on actual findings

---

**Status:** ✅ Phase 1 Complete | **Next:** Phase 2 (Setup Quality Tools)
**Timeline:** 6-8 weeks (estimated)
**Total effort:** 60-80 hours (revised from 45-60 based on scope)
**Phase 1 actual time:** ~2 hours (on target)
