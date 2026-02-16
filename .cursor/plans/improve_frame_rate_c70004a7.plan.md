---
name: Improve frame rate
overview: Reduce frame time when 2+ bosses and the space station are on screen by adding update/draw culling, early-outs in collision, and reducing per-frame work in hot paths (cleanup, bullet–station checks, and heavy draw paths).
todos: []
isProject: false
---

# Frame rate improvement plan (2 bosses + station + many enemies)

## Current bottlenecks (from codebase review)

- **Update path**: Every enemy (including a second boss in `GameContext.enemies`), boss, spaceStation, and destroyer are updated every frame; no update culling. [game-loop.js](src/js/systems/game-loop.js) (e.g. 1896–1933).
- **Draw path**: Boss, spaceStation, and destroyer are always drawn (no `isInView` check). Station redraws 36+32 shield segments with PIXI Graphics when `shieldsDirty` and draws laser/turrets every frame. [SpaceStation.js](src/js/entities/bosses/SpaceStation.js) (draw and update).
- **Collision path**: For every player bullet, [processBulletCollisions](src/js/systems/collision-manager.js) runs a full spaceStation hit block (shield/hull segment math) even when the bullet is far from the station (~3279–3443). Station is not in `targetGrid`, so there is no spatial early-out.
- **Cleanup path**: Every frame, [game-loop.js](src/js/systems/game-loop.js) (2119–2218) calls `immediateCompactArray` on many arrays (bullets, enemies, particles, pinwheels, etc.). With high entity counts this is a lot of full-array scans and write-backs in one frame.

Existing good behavior: view bounds and `isInView` for draw culling (coins, pickups, enemies, bullets, particles); spatial hashes (`targetGrid`, `bulletGrid`, `asteroidGrid`) for collisions; interpolation and 120 Hz physics are already in place.

---

## Phase 1 – Profile and quick wins (low risk)

---

### 1. Profile and tune

- **Where**: [profiler.js](src/js/core/profiler.js); game loop already has `globalProfiler.start/end` for GameLogic, SpatialHash, LevelLogic, Entities, Cleanup, EntityCollision, BulletLogic, Draw, PixiRender.
- **What**: Run a session with 2 bosses + station + many enemies; enable profiler (`perfEnable()`), then inspect `perfReport()` / `lastPerfReport` to see which of Entities, Cleanup, BulletLogic, or Draw dominates. Use that to prioritize (e.g. if Cleanup is top, prioritize item 7; if Draw is top, prioritize items 3 and 6).
- **Why**: Measure before optimizing to target the real bottleneck.

---

### 2. Early-out bullet–spaceStation check in processBulletCollisions

- **Where**: [collision-manager.js](src/js/systems/collision-manager.js) just before the `GameContext.spaceStation` block (~3279).
- **What**: Compute squared distance from bullet to station; if `distSq > (spaceStation.shieldRadius + b.radius + 200)^2` (or similar margin), skip the entire station hit block (shield segments, inner shield, hull).
- **Why**: When many bullets are on screen and the station is present but most bullets are elsewhere, this avoids expensive segment math for every bullet. Station is not in `targetGrid`, so this is the only way to avoid per-bullet station work.

---

### 3. Use isInViewRadius where a radius is intended

- **Where**: [game-loop.js](src/js/systems/game-loop.js) calls that pass a third argument to `isInView`, e.g. `isInView(c.pos.x, c.pos.y, 50)` (coins, pickups, napalm, particles). [performance.js](src/js/core/performance.js) `isInView(x, y)` ignores the third parameter.
- **What**: Replace those with `isInViewRadius(c.pos.x, c.pos.y, 50)` (and the appropriate radius per entity type) so culling matches intent. Optionally use `isInViewRadius` for large entities (e.g. bosses in the enemies loop) so we don't draw when the center is just outside but the sprite would still be visible.
- **Why**: Correctness and slightly fewer draw calls at view edges; small win but low risk.

---

### 4. Draw culling for boss, spaceStation, and destroyer

- **Where**: [game-loop.js](src/js/systems/game-loop.js) where `GameContext.boss`, `GameContext.spaceStation`, and `GameContext.destroyer` are drawn (~1905–1933).
- **What**: Use `isInViewRadius(pos.x, pos.y, largeRadius)` (from [performance.js](src/js/core/performance.js)) so we only call `draw(ctx)` when the entity is within or near the view. Use a large radius (e.g. station ~600, boss/destroyer ~400–500) so they don't pop at edges. Destroyer already hides Pixi in its own `draw()` when out of view; this adds an early skip so we don't call into it when clearly off-screen.
- **Why**: When the camera is focused on one boss and the station or second boss is off-screen, skipping their draw (and any draw-time work) reduces GPU and CPU cost.

---

### 5. Add particle and bullet caps

- **Where**: [constants.js](src/js/core/constants.js) for limits; [particle-manager.js](src/js/systems/particle-manager.js) and [game-loop.js](src/js/systems/game-loop.js) for enforcement.
- **What**: Add `MAX_PARTICLES = 500` and `MAX_BULLETS = 300` constants. When emitting new particles/bullets, check array length against cap; if at cap, either reject new emissions or kill oldest first.
- **Why**: Prevents unbounded growth during intense combat (2 bosses + station). Caps keep worst-case predictable and bounded.

---

## Phase 2 – More aggressive (if still needed)

---

### 6. Throttle or batch space station shield redraws

- **Where**: [SpaceStation.js](src/js/entities/bosses/SpaceStation.js) draw path where `shieldsDirty` triggers full PIXI Graphics redraw of outer and inner rings.
- **What**: Options (pick one or combine): (a) Only redraw shield rings when `shieldsDirty` and at most once per frame (already true), and/or (b) Redraw at most every N ms (e.g. 50–100 ms) when dirty so rapid small hits don't cause a redraw every frame. Ensure first hit after a pause still redraws immediately so visuals stay correct.
- **Why**: With many bullets hitting the station, `shieldsDirty` can stay true every frame and we redraw 68 segments every frame; throttling reduces draw cost while keeping shields looking correct.

---

### 7. Stagger or defer heavy array cleanups

- **Where**: [game-loop.js](src/js/systems/game-loop.js) cleanup block (~2068–2220) and [core/staggered-cleanup.js](src/js/core/staggered-cleanup.js).
- **What**: For the heaviest arrays (e.g. `bullets`, `enemies`, `particles`), either: (a) Use the existing `StaggeredCleanup` so only 1–2 of these arrays are compacted per frame, or (b) Compact only when `arr.length` exceeds a threshold (e.g. > 200) and otherwise defer to next frame. Ensure dead entities are still not drawn and not counted in collision (existing `.dead` checks).
- **Why**: With 2 bosses + station + many enemies, bullet and particle counts can be high; running `immediateCompactArray` on all of them every frame can cause noticeable spikes. Spreading or conditioning cleanup smooths frame time.

---

### 8. Add update culling for off-screen enemies

- **Where**: [game-loop.js](src/js/systems/game-loop.js) enemy loop (~1896–1902) and any other "always update" entity loops that are safe to cull.
- **What**: Import `isInExtendedView` from [performance.js](src/js/core/performance.js). For each enemy, only call `e.update(deltaTime)` when `isInExtendedView(e.pos.x, e.pos.y)` (or when `e.alwaysDraw` / `e.isDungeonBoss` so key bosses still update).
- **Why**: With 2 bosses + station + many enemies, a large fraction of enemies can be off-screen. Skipping their AI/state updates when outside extended view saves CPU and keeps frame time more stable.
- **Caveat**: Only cull non-essential enemies; always update bosses, spawners, and entities with `alwaysDraw`/`isDungeonBoss`. Ensure extended margin (500) is enough that entities don't "pop" when re-entering.

---

## Phase 3 – Last resort

---

### 9. Make physics rate configurable (60Hz option for slower machines)

- **Where**: [constants.js](src/js/core/constants.js) – `PHYSICS_FPS`, `SIM_STEP_MS`; [settings-manager.js](src/js/ui/settings-manager.js) for user preference; [game-loop.js](src/js/systems/game-loop.js) for step time.
- **What**: Add a setting (e.g. `physicsRate: '120hz' | '60hz'`) defaulting to 120Hz. When 60Hz is selected, set `PHYSICS_FPS = 60` and `SIM_STEP_MS = 1000/60` (~16.67 ms). Ensure any derived constants use the new values.
- **Why**: Update, collision, and cleanup run once per physics step. At 60 Hz they run half as often. This is a significant optimization but changes game feel, so it should be **optional** for players on slower machines, not forced.
- **Tradeoffs**: Slightly less frequent physics sampling; possible tunneling for very fast bullets. Keep 120Hz as the default for best feel.

---

## Risks and mitigations

- **60Hz physics (configurable)**: Slightly less smooth physics; possible tunneling for very fast bullets. Mitigation: **make it optional**, not forced; keep 120Hz as default; let players choose based on their hardware.
- **Update culling**: Entities that only update when in extended view might "freeze" or miss triggers. Mitigation: **only cull non-essential enemies**; always update bosses, spawners, and entities with `alwaysDraw`/`isDungeonBoss`.
- **Draw culling**: If radius is too small, large sprites could pop at edges. Mitigation: use generous radius (e.g. station 600+, bosses 400+).
- **Deferred cleanup**: Dead entities might remain in the array one or a few extra frames. Mitigation: all update/draw/collision code already checks `.dead`; ensure no logic assumes "compact has already run" in the same frame.
- **Particle/bullet caps**: Might drop visual effects or shots during extreme combat. Mitigation: start with generous caps (500 particles, 300 bullets) and tune based on gameplay; prioritize killing oldest so player rarely notices.

---

## Summary

**Safest first steps** (profile, then targeted fixes that don't change gameplay):

- Profile to identify the real bottleneck
- Bullet–station early-out
- Draw culling for large off-screen entities
- isInViewRadius fix
- Add particle/bullet caps

**More aggressive** (if still dropping frames):

- Shield redraw throttle
- Staggered cleanup
- Careful update culling for non-essential enemies

**Last resort** (configurable, not forced):

- 60Hz physics as an option for players on slower machines

This approach preserves gameplay feel while still providing meaningful frame rate improvements.