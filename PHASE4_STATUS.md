# Phase 4: Entity Classes - Status Report

**Last Updated:** 2026-01-12T10:35:00-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 4 involves extracting entity classes from `main.js` into separate module files and establishing a unified PixiJS rendering context.

---

## Metrics

| Metric | Original | Current | Change |
|--------|----------|---------|--------|
| **main.js lines** | 26,438 | 25,437 | **-1,001** |

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

### 3. pixi-context.js ✅
- **File:** `src/js/rendering/pixi-context.js`
- **Status:** Complete. Defines the shared rendering context.

---

## Next Steps

### 1. Verify Enemy Spawning and Rendering
- Test: Do enemies spawn?
- Test: Do they look correct (textures, shields, name tags)?
- Test: Do they explode/die correctly?

### 2. Extract Pinwheel
- **File:** `src/js/main.js` (~350 lines)
- **Target:** `src/js/entities/enemies/Pinwheel.js` (or `environment`?)
  - Pinwheel is a static enemy/hazard. Usually grouped with enemies or environment. `main.js` treats it as an enemy in `GameContext.enemies` loop sometimes, or separate `GameContext.pinwheels`.
  - Recommend `src/js/entities/enemies/Pinwheel.js`.

### 3. Extract Bosses
- Cruiser, Overseer, etc.

---

## How it Works: The Architecture

1.  **pixi-context.js**: The Hub.
    - Exposes `pixiEnemyLayer`, `pixiTextures` etc.
    - `main.js` pushes its local layer references into this hub at startup.
2.  **Entity Modules**: The Spokes.
    - `Enemy.js` imports layers from `pixi-context.js`.
    - Draws sprites into those layers.
3.  **Dependency Injection**: Logic.
    - `main.js` injects global functions (`spawnExplosion`) into Entity Modules via `register...Dependencies`.

This architecture decouples drawing (via context) and logic (via injection/GameContext).
