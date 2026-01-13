# Phase 7: Final Reduction to ~1,000 Lines - Status Report

**Last Updated:** 2026-01-12T21:15:00-08:00
**Status:** IN PROGRESS

---

## Goal
Reduce `src/js/main.js` from 6,411 lines to under 1,000 lines by extracting remaining initialization and asset setup logic into dedicated modules.

## Current Metrics
- **Current lines:** 2,647
- **Target lines:** < 1,000
- **Remaining to remove:** 1,647 lines

## Planned Work

### 1) Extract Texture and Asset Loading
- **Target:** Image loading, texture generation, sprite pool setup
- **New module:** `src/js/rendering/texture-manager.js`
- **Expected removal:** ~1,200-1,600 lines
- **Notes:** Centralize all texture registration and pool initialization in a single entry point.

### 2) Extract Canvas and PixiJS Initialization
- **Target:** Canvas setup, PixiJS app creation, renderer configuration
- **New modules:** `src/js/rendering/canvas-setup.js`, `src/js/rendering/pixi-init.js`
- **Expected removal:** ~600-900 lines
- **Notes:** Keep `main.js` focused on orchestration; use exported `initPixi()` and `setupCanvas()` helpers.

### 3) Extract Remaining UI/Menu Logic (Settings/Profile)
- **Target:** Settings menu logic, profile management, remaining DOM bindings
- **New module:** `src/js/ui/settings-manager.js`
- **Expected removal:** ~300-600 lines

### 4) Final Main.js Cleanup and Orchestration
- **Target:** Remove remaining inline helpers, keep bootstrap only
- **Expected removal:** ~400-700 lines

## Testing Plan
Run after each extraction step:
- `npm run start:dev` and verify:
  - Game loads, movement/shooting works
  - Menus open/close correctly
  - Assets render (sprites, particles, backgrounds)
  - No console errors

## Progress Checklist
- [x] Texture and asset loading extracted
- [x] Canvas + PixiJS initialization extracted
- [x] Settings/profile UI extracted
- [ ] Main.js trimmed to < 1,000 lines
- [ ] Final smoke test completed
