---
name: performance-analyzer
description: Analyze game performance using existing debug tools. Profile frame times, memory usage, entity counts, and identify bottlenecks. Use when investigating performance issues, optimizing the game loop, or diagnosing frame rate drops.
metadata:
  short-description: Analyze game performance
---

# Performance Analyzer

Analyze game performance using built-in debug console commands and profiling tools.

## Console Commands (Open with F12)

### Basic Performance

```javascript
// Enable/disable profiler
perfEnable()
perfDisable()

// Show current stats
perfStats()

// Detailed report
perfReport()

// Monitor for N seconds
perfWatch(60)  // Monitor for 60 seconds

// Quick check with warnings
perfCheck()
```

### Entity Analysis

```javascript
// Count all game entities
entityCount()

// Returns breakdown of:
// - bullets, enemies, coins, particles, etc.
// - Total entity count
```

### Memory Analysis

```javascript
// Memory usage statistics
memStats()

// Returns:
// - Used JS heap size
// - Total heap size
// - Heap limit
```

## Profiling Workflow

### 1. Baseline Measurement

Start the game and establish a baseline:

```javascript
// Enable profiler
perfEnable()

// Let game run for 30-60 seconds of normal gameplay
perfWatch(60)

// Check results
perfStats()
```

### 2. Entity Count Analysis

Check entity counts during different scenarios:

```javascript
// During normal gameplay
entityCount()

// During intense combat (many enemies)
entityCount()

// Check specific entity types
console.log(`Bullets: ${bullets.length}`)
console.log(`Enemies: ${enemies.length}`)
console.log(`Particles: ${particles.length}`)
```

### 3. Memory Leak Detection

Monitor memory over extended sessions:

```javascript
// Initial reading
memStats()

// ... play for 10 minutes ...

memStats()  // Compare with initial
```

## Common Issues

### High Frame Time (Stutter)

**Symptoms:** `perfStats()` shows frame time > 20ms

**Checks:**
1. Entity count: `entityCount()` - look for > 1000 entities
2. Active enemies: `enemies.length`
3. Bullet count: `bullets.length`

**Fixes:**
- Reduce spawn rates
- Increase entity cleanup frequency
- Check for dead entities not being removed

### Memory Growth

**Symptoms:** `memStats()` shows growing used heap

**Checks:**
1. Look for missing `pixiCleanupObject()` calls
2. Check sprite pool sizes (should be bounded)
3. Verify event listeners are removed

**Reference:** `src/js/core/staggered-cleanup.js`

### Jitter Spikes

**Symptoms:** Inconsistent frame times with spikes

**Checks:**
```javascript
// Jitter monitoring is automatic
// Check globalJitterMonitor in src/js/core/jitter-monitor.js
```

## Sprite Pool Analysis

Check sprite pool utilization:

```javascript
// In pixi-setup.js, pools are initialized with PIXI_SPRITE_POOL_MAX
// Check if pools are exhausted

console.log('Bullet pool:', pixiBulletSpritePool.used)
console.log('Particle pool:', pixiParticleSpritePool.used)
console.log('Enemy pool:', pixiEnemySpritePools.used)
```

## Performance Constants

Key constants in `src/js/core/constants.js`:

```javascript
PHYSICS_FPS = 120           // Physics tick rate
SIM_FPS = 60                // Reference framerate
SIM_STEP_MS = 8.33          // Milliseconds per step
PIXI_SPRITE_POOL_MAX = 30000  // Max sprites per pool
```

## Automated Profiling Script

```javascript
// Run in console for automated 60-second profile
function runProfile(duration = 60) {
    perfEnable();
    const startMem = performance.memory?.usedJSHeapSize || 0;
    const startTime = Date.now();

    setTimeout(() => {
        const endMem = performance.memory?.usedJSHeapSize || 0;
        const memDelta = (endMem - startMem) / 1024 / 1024;

        console.log('=== PROFILE RESULTS ===');
        perfReport();
        entityCount();
        memStats();
        console.log(`Memory delta: ${memDelta.toFixed(2)} MB`);

        perfDisable();
    }, duration * 1000);
}

// Usage
runProfile(60);
```

## Files of Interest

| File | Purpose |
|------|---------|
| `src/js/core/profiler.js` | Profiling system |
| `src/js/core/jitter-monitor.js` | Frame time tracking |
| `src/js/core/staggered-cleanup.js` | Array cleanup management |
| `src/js/core/perf-debug.js` | Console command definitions |
| `src/js/rendering/pixi-setup.js` | Sprite pool configuration |
