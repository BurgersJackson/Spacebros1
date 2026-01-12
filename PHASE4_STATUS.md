# Phase 4: Entity Classes - Status Report

**Last Updated:** 2026-01-12T11:20:00-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 4 involves extracting entity classes from `main.js` into separate module files and establishing a unified PixiJS rendering context.

---

## Metrics

| Metric | Original | Current | Change |
|--------|----------|---------|--------|
| **main.js lines** | 26,438 | 24,539 | **-1,899** |

---

## Completed Fixes

### 1. Fixed Asteroid Rendering Bug ✅
- Use `setPixiContext` to bridge main.js layers.
- Updates texture state via `setAsteroidTexturesReady`.

### 2. Fixed Enemy Spawning Bug ✅
- Fixed `Enemy` spawning at (0,0) by passing `GameContext` to `findSpawnPointRelative`.

### 3. Fixed Bullet Firing & Collision ✅
- Updated `Enemy.js` and `Pinwheel.js` to use the `Bullet.js` module constructor signature (`opts` object).
- **Added `isEnemy` property to `Bullet.js`** to ensure compatibility with `main.js` collision and logic checks.

---

## Completed Extractions

### 1. EnvironmentAsteroid ✅
- **File:** `src/js/entities/environment/EnvironmentAsteroid.js`
- **Status:** Integrated.

### 2. Enemy ✅ (MAJOR)
- **File:** `src/js/entities/enemies/Enemy.js`
- **Lines extracted:** ~880
- **Status:** Integrated.
- **Note:** Uses Module `Bullet` (new signature).

### 3. Pinwheel ✅
- **File:** `src/js/entities/enemies/Pinwheel.js`
- **Lines extracted:** ~415
- **Status:** Integrated.
- **Note:** Uses Module `Bullet` (new signature).

### 4. Projectiles (Dependencies for Bosses) ✅
- **Shockwave**: `src/js/entities/projectiles/Shockwave.js`
- **CruiserMineBomb**: `src/js/entities/projectiles/CruiserMineBomb.js`
- **FlagshipGuidedMissile**: `src/js/entities/projectiles/FlagshipGuidedMissile.js`
- **Status:** Integrated and registered.

### 5. pixi-context.js ✅
- **File:** `src/js/rendering/pixi-context.js`
- **Status:** Complete.

---

## Next Steps

### 1. Extract Cruiser (Boss)
- **File:** `src/js/entities/enemies/Cruiser.js`
- **Prerequisites:** Done (Projectiles extracted).
- **Status:** Ready for extraction.

### 2. Extract Other Bosses
- `Destroyer`
- `WarpSentinelBoss`

### 3. Unify Bullet Class
- `main.js` still has a legacy `Bullet` class definition. Future extractions should use the module `Bullet` class. Eventually remove `Bullet` from `main.js`.

---
