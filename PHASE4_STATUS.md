# Phase 4: Entity Classes - Status Report

**Last Updated:** 2026-01-12T10:55:00-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 4 involves extracting entity classes from `main.js` into separate module files and establishing a unified PixiJS rendering context.

---

## Metrics

| Metric | Original | Current | Change |
|--------|----------|---------|--------|
| **main.js lines** | 26,438 | 25,033 | **-1,405** |

---

## Completed Fixes

### 1. Fixed Asteroid Rendering Bug ✅
- Use `setPixiContext` to bridge main.js layers.
- Updates texture state via `setAsteroidTexturesReady`.

---

## Completed Extractions

### 1. EnvironmentAsteroid ✅
- **File:** `src/js/entities/environment/EnvironmentAsteroid.js`
- **Status:** Integrated via pixi-context.

### 2. Enemy ✅ (MAJOR)
- **File:** `src/js/entities/enemies/Enemy.js`
- **Lines extracted:** ~880
- **Integration:** 
  - Imports rendering resources from `pixi-context.js` (layers, pools, textures).
  - Uses `registerEnemyDependencies` for logic callbacks (`spawnExplosion`, `checkDespawn`, etc.).
  - Full PixiJS `draw()` method implementation preserved (no simplified fallback).

### 3. Pinwheel ✅
- **File:** `src/js/entities/enemies/Pinwheel.js`
- **Lines extracted:** ~415
- **Integration:**
  - Uses `pixiBaseLayer` via `pixi-context.js`.
  - Dependency injection for `spawnParticles`, `checkDespawn`, etc.

### 4. pixi-context.js ✅
- **File:** `src/js/rendering/pixi-context.js`
- **Status:** Complete. Defines the shared rendering context.

---

## Next Steps (Recommended Path)

To extract the **Cruiser Boss**, we must first extract its dependencies to avoid circular issues or confusing module graphs.

### 1. Extract Shockwave
- **File:** `src/js/entities/projectiles/Shockwave.js`
- **Reason:** Dependency for `CruiserMineBomb`.
- **Status:** Ready to extract.

### 2. Extract CruiserMineBomb
- **File:** `src/js/entities/projectiles/CruiserMineBomb.js`
- **Reason:** Dependency for `Cruiser`.
- **Status:** Depends on `Shockwave`.

### 3. Extract FlagshipGuidedMissile
- **File:** `src/js/entities/projectiles/FlagshipGuidedMissile.js`
- **Reason:** Dependency for `Cruiser` and `Flagship`.

### 4. Extract Cruiser (Boss)
- **File:** `src/js/entities/enemies/Cruiser.js`
- **Reason:** Major boss class. Depends on the above projectiles.

### 5. Verification
- Verify Boss encounters work correctly.
