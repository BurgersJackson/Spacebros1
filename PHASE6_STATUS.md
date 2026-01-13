# Phase 6: UI Module Extraction - Status Report

**Last Updated:** 2026-01-12T17:48:00-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 6 extracts UI logic from `src/js/main.js` into `src/js/ui/` modules.

---

## Target Modules

### 1. `src/js/ui/hud.js`
- HUD updates (health, XP, turbo, warp, nuggets).
- Minimap and indicators (warp gate, station, destroyer).

### 2. `src/js/ui/menus.js`
- Pause menu, start screen, settings menu, save/load menu.
- Button wiring and menu visibility toggles.

### 3. `src/js/ui/levelup-screen.js`
- Level-up screen UI logic and card rendering.

### 4. `src/js/ui/meta-shop.js`
- Meta shop modal and upgrades menu UI.

### 5. `src/js/ui/index.js`
- Barrel exports and UI initialization helpers.

---

## Remaining Work

1. Extract DOM wiring and update helpers into `src/js/ui/levelup-screen.js` and `src/js/ui/meta-shop.js`.
2. Replace remaining `main.js` references with imports from `src/js/ui/index.js`.
3. Verify UI behavior in-game (menus, HUD, level-up, meta shop).

---

## Notes

- Testing: manual validation via `npm run start:dev`.

## Completed

1. Extracted HUD indicator rendering into `src/js/ui/hud.js` with dependency registration.
2. Added `src/js/ui/index.js` barrel and wired HUD imports in `src/js/main.js`.
3. Extracted menu UI wiring into `src/js/ui/menus.js` with dependency registration and toggle handler wiring.
