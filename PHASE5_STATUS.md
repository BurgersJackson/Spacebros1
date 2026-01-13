# Phase 5: Systems Extraction - Status Report

**Last Updated:** 2026-01-12T15:28:00-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 5 focuses on extracting remaining system logic out of `main.js` into `src/js/systems/`.

---

## Completed Extractions

### 1. Input Manager ✅
- **File:** `src/js/systems/input-manager.js`
- **Status:** Integrated and initialized from `src/js/main.js`.
- **Notes:** Event listeners moved, menu navigation helpers exported.

### 2. Spawn Manager ✅ (Partial)
- **File:** `src/js/systems/spawn-manager.js`
- **Status:** Integrated with dependency registration and exports via `src/js/systems/index.js`.
- **Notes:** Spawn helpers for drones, pinwheels, caches, and POIs extracted.

### 3. Collision Manager ✅
- **File:** `src/js/systems/collision-manager.js`
- **Status:** Integrated with dependency registration and exports via `src/js/systems/index.js`.
- **Notes:** Entity collisions, wall checks, and bullet collision loop extracted.

### 4. Game Loop ✅ (Partial)
- **File:** `src/js/systems/game-loop.js`
- **Status:** `mainLoop` and `gameLoopLogic` extracted and initialized from `src/js/main.js`.
- **Notes:** Logic now lives in the systems module with dependency registration.

---

## Remaining Work

### 1. Collision Manager
- Verify collision manager against in-game edge cases (warp maze, cave, anomaly walls).

### 2. Game Loop
- Validate `gameLoopLogic` after extraction (timers, spawns, UI, Pixi render).
- Provide dependency injection for render hooks and state transitions.
- Keep `main.js` as a bootstrap coordinator.

### 3. Spawn Manager (Finish)
- Extract any remaining spawn helpers still in `main.js`.
- Ensure all call sites use `src/js/systems/spawn-manager.js`.

---

## Notes

- No test framework configured. Validate by running `npm run start:dev`.
