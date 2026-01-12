## Phase 2 Summary

### Systems Extracted
- Save manager moved to `src/js/systems/save-manager.js` and wired into `src/js/main.js` for profile creation, selection, listing, and auto-save.
- Meta manager moved to `src/js/systems/meta-manager.js` with shop UI updates, modal handlers, and apply-meta-upgrades logic.
- Event scheduler moved to `src/js/systems/event-scheduler.js` including arena countdown state and event scheduling helpers.
- Contract manager moved to `src/js/systems/contract-manager.js` handling contract spawn, updates, completion, and cleanup.
- Upgrade manager moved to `src/js/systems/upgrade-manager.js` for level-up menu, rerolls, and upgrade application logic.

### Main Wiring Changes
- `src/js/main.js` now imports and uses the systems modules for save/meta/contract/event/upgrade flows.
- Upgrade data removed from `src/js/main.js` and pulled from `src/js/core/constants.js` where already defined.
- Meta shop gamepad back action delegates to modal close button instead of inline state mutation.
- Shared constants updated: `PLAYER_SHIELD_RADIUS_SCALE` exported in `src/js/core/constants.js` and imported in `src/js/main.js`.

### New/Updated Files
- `src/js/systems/save-manager.js`
- `src/js/systems/meta-manager.js`
- `src/js/systems/event-scheduler.js`
- `src/js/systems/contract-manager.js`
- `src/js/systems/upgrade-manager.js`
- `src/js/systems/index.js` updated to export all Phase 2 systems
- `src/js/core/constants.js` updated to export `PLAYER_SHIELD_RADIUS_SCALE`

## Remaining Phase 2 Work
- None. Phase 2 system extractions and wiring are complete.

## Notes / Follow-ups
- Phase 3 (rendering modules) is next per `REFACTORING_PLAN.md`.
