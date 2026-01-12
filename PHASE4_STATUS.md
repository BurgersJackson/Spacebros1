# Phase 4: Entity Classes - Status Report

**Last Updated:** 2026-01-12T12:05:31-08:00  
**Status:** IN PROGRESS

---

## Overview

Phase 4 involves extracting entity classes from `main.js` into separate module files and establishing a unified PixiJS rendering context.

---

## Metrics

| Metric | Original | Current | Change |
|--------|----------|---------|--------|
| **main.js lines** | 26,438 | 21,462 | **-4,976** |

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
- **Destroyer2GuidedMissile**: `src/js/entities/projectiles/Destroyer2GuidedMissile.js`
- **ClusterBomb**: `src/js/entities/projectiles/ClusterBomb.js`
- **NapalmZone**: `src/js/entities/projectiles/NapalmZone.js`
- **Status:** Integrated and registered.

### 5. Cruiser ✅
- **File:** `src/js/entities/bosses/Cruiser.js`
- **Status:** Integrated with dependency registration and module Bullet signatures.

### 6. Flagship ✅
- **File:** `src/js/entities/bosses/Flagship.js`
- **Status:** Integrated with dependency registration and shield gfx cleanup on death.

### 7. SuperFlagshipBoss ✅
- **File:** `src/js/entities/bosses/SuperFlagshipBoss.js`
- **Status:** Integrated with dependency registration and shield gfx cleanup on death.

### 8. WarpSentinelBoss ✅
- **File:** `src/js/entities/bosses/WarpSentinelBoss.js`
- **Status:** Integrated with dependency registration and WarpBioPod module.

### 9. WarpBioPod ✅
- **File:** `src/js/entities/zones/WarpBioPod.js`
- **Status:** Integrated with dependency registration and module Bullet signature.

### 10. SpaceStation ✅
- **File:** `src/js/entities/bosses/SpaceStation.js`
- **Status:** Integrated with dependency registration.

### 11. Dungeon Boss Helpers ✅
- **DungeonDrone**: `src/js/entities/bosses/dungeon/DungeonDrone.js`
- **PsychicEcho**: `src/js/entities/bosses/dungeon/PsychicEcho.js`
- **GravityWell**: `src/js/entities/bosses/dungeon/GravityWell.js`
- **SoulDrainTether**: `src/js/entities/bosses/dungeon/SoulDrainTether.js`
- **Status:** Integrated with dependency registration where needed.

### 12. pixi-context.js ✅
- **File:** `src/js/rendering/pixi-context.js`
- **Status:** Complete.

---

## Next Steps

### 1. Extract Other Bosses
- `Destroyer`
- `FinalBoss`
- `Destroyer2`
 - Dungeon bosses (NecroticHive, CerebralPsion, Fleshforge, VortexMatriarch, ChitinusPrime, PsyLich)

### 2. Unify Bullet Class
- `main.js` still has a legacy `Bullet` class definition. Future extractions should use the module `Bullet` class. Eventually remove `Bullet` from `main.js`.

---
