# Entity Cleanup Fixes

## Issues Fixed

### 1. Debris Field Graphic Not Disappearing After Event Completes

**Problem:** When a debris field event is completed (player stands in it long enough), the Pixi graphics remain visible on screen.

**Root Cause:** The `DebrisFieldPOI.kill()` method only called `super.kill()` and `pixiCleanupObject()`, but didn't properly hide the graphics first. The `draw()` method had a check for `this.dead || this.claimed` that should hide graphics, but if the kill happens and then draw isn't called, the graphics remain visible.

**Files Affected:**
- `src/js/main.js` - `DebrisFieldPOI` class (lines 8847-8947)
- `src/js/main.js` - `SectorPOI` class (lines 8715-8891)

**Fix Applied:**
```javascript
// In DebrisFieldPOI.draw():
draw(ctx) {
    if (this.dead || this.claimed) {
        // Hide and cleanup all Pixi graphics when dead or claimed
        if (this._pixiProgressGfx) {
            this._pixiProgressGfx.visible = false;
        }
        if (this._pixiGfx) {
            this._pixiGfx.visible = false;
        }
        if (this._pixiNameText) {
            this._pixiNameText.visible = false;
        }
        return;
    }
    super.draw(ctx);
}

// In DebrisFieldPOI.kill():
kill() {
    if (this.dead) return;
    super.kill();
    // Clean up ALL Pixi graphics
    if (this._pixiProgressGfx) {
        try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) {}
        this._pixiProgressGfx = null;
    }
    if (this._pixiGfx) {
        try { this._pixiGfx.destroy({ children: true }); } catch (e) {}
        this._pixiGfx = null;
    }
    if (this._pixiNameText) {
        try { this._pixiNameText.destroy(); } catch (e) {}
        this._pixiNameText = null;
    }
}
```

**Same fix applied to:** `MiniEventDefendCache` and `MiniEventEscortDrone` classes.

### 2. Explosion Particles Not Cleaning Up and Staying on Screen

**Problem:** Enemy explosion particles sometimes fail to clean up and remain visible on screen indefinitely.

**Root Causes:**
1. The `Explosion.update()` method only set `this.dead = true` when `life <= 0`, but didn't force cleanup of internal particles
2. The `Explosion.draw()` method cleans up particle sprites when `this.dead` is true, but only if called (which might not happen if the explosion goes off-screen)
3. Particle sprites could leak if exceptions occur during cleanup
4. The `Explosion.cleanup()` method wasn't being called by the game loop for dead explosions

**Files Affected:**
- `src/js/entities/particles/Explosion.js`
- `src/js/main.js` - explosion rendering loop

**Fixes Applied:**

#### Fix 1: Update loop should mark particles as dead
```javascript
// In Explosion.update():
update() {
    this.life--;
    
    // Update particles
    for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96; // friction
        p.vy *= 0.96;
        p.life--;
        // Add gravity effect (visual only)
        p.vy += 0.05;
        
        // Kill particles that have expired
        if (p.life <= 0 && p.life > -100) {
            // Only mark once to prevent multiple deaths
            p.life = -1000; 
        }
    }
    
    // If explosion itself is dead, all particles should be considered dead too
    if (this.life <= 0) {
        this.dead = true;
        // Force all particles to dead state
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].life = -1000;
        }
        return;
    }
}
```

#### Fix 2: Draw loop should cleanup even when not in view
```javascript
// In main.js explosion rendering loop:
// Explosions - always update, cull drawing
for (let i = 0, len = explosions.length; i < len; i++) {
    const ex = explosions[i];
    try {
        if (doUpdate) ex.update();
        if (doDraw && isInView(ex.pos.x, ex.pos.y)) {
            ex.draw(ctx, particleRes, alpha);
        } else if (ex.dead && particleRes && particleRes.pool) {
            // Even if not in view, cleanup dead explosions
            ex.cleanup(particleRes);
        }
    } catch (e) {
        console.error('[EXPLOSION ERROR]', e);
        ex.dead = true;
        if (typeof ex.cleanup === 'function') ex.cleanup(particleRes);
        else if (typeof pixiCleanupObject === 'function') pixiCleanupObject(ex);
    }
}
```

#### Fix 3: Add error handling to sprite cleanup
```javascript
// In Explosion.draw():
if (p.sprite) {
    try {
        releasePixiSprite(pixiResources.pool, p.sprite);
    } catch (e) {
        console.warn('Failed to release explosion particle sprite in draw:', e);
    }
    p.sprite = null;
}
```

#### Fix 4: Clear particle array on cleanup
```javascript
// In Explosion.cleanup():
cleanup(pixiResources) {
    if (!pixiResources || !pixiResources.pool) return;
    for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.sprite) {
            try {
                releasePixiSprite(pixiResources.pool, p.sprite);
            } catch (e) {
                console.warn('Failed to release explosion particle sprite:', e);
            }
            p.sprite = null;
        }
    }
    // Clear particle array to free memory
    this.particles.length = 0;
}
```

## Testing the Fixes

### Test Debris Field Cleanup
1. Start the game and find a "DEBRIS FIELD" POI
2. Stand inside the debris field until it's claimed
3. Move away from the area
4. **Expected:** All orange graphics (circle, diamond, text) should disappear immediately
5. **Before fix:** Graphics would remain visible on screen

### Test Explosion Cleanup
1. Enter a battle and destroy several enemies
2. Move camera away from the explosions
3. Wait 5-10 seconds
4. **Expected:** All explosion particles should be cleaned up even if off-screen
5. **Before fix:** Particles would remain visible if explosions went off-screen before dying

## Manual Fix Instructions (if automatic fixes didn't apply)

### Fix DebrisFieldPOI in main.js
Find the `DebrisFieldPOI` class and update these methods:

```javascript
class DebrisFieldPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DEBRIS FIELD', '#fa0', 220);
        this.rewardXp = 20;
        this.rewardCoins = 40;
        this.captureMsRequired = 3000;
        this.captureMs = 0;
        this.captureActive = false;
        this.lastUpdateAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
    }
    
    kill() {
        if (this.dead) return;
        super.kill();
        // Clean up ALL Pixi graphics
        if (this._pixiProgressGfx) {
            try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) {}
            this._pixiProgressGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy({ children: true }); } catch (e) {}
            this._pixiGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(); } catch (e) {}
            this._pixiNameText = null;
        }
    }
    
    draw(ctx) {
        if (this.dead || this.claimed) {
            // Hide and cleanup all Pixi graphics when dead or claimed
            if (this._pixiProgressGfx) {
                this._pixiProgressGfx.visible = false;
            }
            if (this._pixiGfx) {
                this._pixiGfx.visible = false;
            }
            if (this._pixiNameText) {
                this._pixiNameText.visible = false;
            }
            return;
        }
        super.draw(ctx);
        // ... rest of draw code ...
    }
}
```

### Fix Explosion Particle Cleanup in main.js
Find the explosion rendering loop (around line 14726) and update:

```javascript
// Explosions - always update, cull drawing
for (let i = 0, len = explosions.length; i < len; i++) {
    const ex = explosions[i];
    try {
        if (doUpdate) ex.update();
        if (doDraw && isInView(ex.pos.x, ex.pos.y)) {
            ex.draw(ctx, particleRes, alpha);
        } else if (ex.dead && particleRes && particleRes.pool) {
            // Even if not in view, cleanup dead explosions
            ex.cleanup(particleRes);
        }
    } catch (e) {
        console.error('[EXPLOSION ERROR]', e);
        ex.dead = true;
        if (typeof ex.cleanup === 'function') ex.cleanup(particleRes);
        else if (typeof pixiCleanupObject === 'function') pixiCleanupObject(ex);
    }
}
```

### Fix Explosion.js
Update `src/js/entities/particles/Explosion.js`:

1. In `update()` - Force all particles dead when explosion dies
2. In `draw()` - Add try-catch around sprite cleanup
3. In `cleanup()` - Clear the particles array

## Additional Recommendations

### Prevent Future Sprite Leaks

Add a helper function to safely hide Pixi graphics before cleanup:

```javascript
function safePixiCleanup(obj) {
    if (!obj) return;
    
    // Hide all Pixi graphics before destroying
    const graphicsProps = [
        '_pixiGfx', '_pixiProgressGfx', '_pixiNameText', 
        '_pixiTimerText', '_pixiLabelText', '_pixiWaypointGfx',
        '_pixiTetherGfx', '_pixiDroneGfx', '_pixiContainer'
    ];
    
    for (const prop of graphicsProps) {
        if (obj[prop] && typeof obj[prop].visible !== 'undefined') {
            obj[prop].visible = false;
        }
    }
    
    // Then cleanup
    pixiCleanupObject(obj);
}
```

Then use in all entity kill() methods:

```javascript
kill() {
    if (this.dead) return;
    this.dead = true;
    safePixiCleanup(this);
}
```

## Debug Commands

Use these console commands to verify cleanup is working:

```javascript
// Check entity counts
entityCount()

// Check memory usage
memStats()

// Watch for memory leaks
perfWatch(60)

// Force garbage collection to check if sprites are released
forceGC()
```

## Summary

Both issues stem from incomplete Pixi graphics cleanup when entities die:

1. **Debris field graphics** weren't being explicitly hidden before cleanup
2. **Explosion particles** weren't being cleaned up if the explosion went off-screen

The fixes ensure:
- All Pixi graphics are set to `visible = false` before cleanup
- Pixi graphics are properly destroyed with error handling
- Off-screen entities still get cleaned up
- Particle arrays are cleared to prevent memory leaks






