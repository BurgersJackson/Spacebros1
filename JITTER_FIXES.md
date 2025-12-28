# Jitter Fixes and Performance Improvements

This document explains the jitter issues that were identified and the solutions implemented.

## Issues Identified

### 1. **Upgrade Menu Timing Spike** ❌
**Problem:** When the upgrade menu closed, the game would reset timing variables (`simLastPerfAt = 0`, `simAccMs = 0`), causing a massive frame time spike as the game tried to "catch up" on accumulated time.

**Impact:** Visible stutter/jitter immediately after selecting an upgrade.

**Solution:** 
- Instead of hard-resetting to 0, we now update `simLastPerfAt` to current time
- Reset `simAccMs` to 0 without resetting the frame timer
- Reduced resume delay from 200ms to 100ms for snappier gameplay

### 2. **Large Frame Time Cutoff** ⚠️
**Problem:** The game had a hard cutoff at 50ms where it would drop to `SIM_STEP_MS` (16.67ms), causing jarring frame rate changes.

**Impact:** Sudden jumps in game speed during frame spikes.

**Solution:**
- Implemented smooth frame time transition instead of hard cutoff
- Very large spikes (>100ms) are clamped to 33.33ms (30fps equivalent)
- Moderate spikes (50-100ms) are blended 50/50 with normal time
- This maintains smooth motion while preventing catch-up spirals

### 3. **Array Cleanup Spikes** 📊
**Problem:** All entity arrays were cleaned in a single frame using `compactArray()`, causing GC pauses and frame time spikes when many entities died at once.

**Impact:** Stutter during battles with many explosions or when destroying bases.

**Solution:**
- Created `StaggeredCleanup` class to spread cleanup across multiple frames
- Critical arrays (bullets, enemies) still cleaned immediately for gameplay correctness
- Large arrays can be cleaned over multiple frames (up to 3 per frame)
- Significantly reduces GC pressure during intense gameplay

### 4. **High Refresh Rate Monitors** 🖥️
**Problem:** The simulation comment said "120 FPS" but actual `SIM_FPS` was set to 60, and `SIM_MAX_STEPS_PER_FRAME` was 4. This could cause issues on >60Hz displays.

**Impact:** Inconsistent frame times on high refresh rate monitors (120Hz, 144Hz, etc).

**Solution:**
- Fixed simulation to 60 FPS (as configured in constants)
- Improved frame interpolation for smoother rendering on any refresh rate
- Added jitter monitoring to detect and report frame time inconsistencies

### 5. **No Performance Visibility** 🔍
**Problem:** No way to diagnose what was causing performance issues in real-time.

**Impact:** Difficult to identify and fix performance bottlenecks.

**Solution:**
- Enabled profiler by default (was previously disabled)
- Created `JitterMonitor` to track frame time variance and spikes
- Added console commands for runtime performance diagnostics

## New Features

### Jitter Monitor
The `JitterMonitor` class tracks:
- Average frame time and FPS
- Frame time variance (jitter percentage)
- Frame spikes (>33.3ms)
- Automatic diagnosis of common issues

### Performance Debug Commands
Open the browser console (F12) and use:

```javascript
perfEnable()          // Enable profiler
perfDisable()         // Disable profiler
perfStats()           // Get current performance stats
perfReport()          // Print detailed performance report
perfWatch(secs)       // Monitor performance for N seconds
forceGC()             // Force garbage collection (if available)
memStats()            // Get memory usage statistics
entityCount()         // Count all game entities
perfCheck()           // Quick performance check with warnings
perfHelp()            // Show all available commands
```

### Staggered Cleanup System
Automatically spreads array cleanup across frames to prevent spikes:
- Cleans up to 3 arrays per frame
- Prioritizes arrays with more dead items
- Can force immediate cleanup when needed

## Usage

### Monitoring Performance During Gameplay

1. **Quick Check:**
   ```javascript
   // In browser console during gameplay
   perfCheck()
   ```

2. **Detailed Report:**
   ```javascript
   // Watch for 30 seconds while playing
   perfWatch(30)
   ```

3. **Real-time Monitoring:**
   ```javascript
   // Get detailed stats anytime
   perfStats()
   ```

### Diagnosing Jitter Issues

1. **Check frame time variance:**
   ```javascript
   perfStats()
   // Look at jitter.percent - anything over 30% is problematic
   ```

2. **Check for frame spikes:**
   ```javascript
   perfStats()
   // Look at spikes count in recent activity
   ```

3. **Check entity counts:**
   ```javascript
   entityCount()
   // Total over 500 may cause performance issues
   ```

4. **Check memory usage:**
   ```javascript
   memStats()
   // Over 80% heap usage will cause frequent GC spikes
   ```

## Configuration

### Adjust Frame Time Limits

Edit `src/js/core/jitter-monitor.js`:
```javascript
this.jitterThreshold = 16.67 * 2; // Adjust spike detection threshold
this.maxSamples = 300;            // How many frames to track
```

### Adjust Staggered Cleanup

Edit `src/js/core/staggered-cleanup.js`:
```javascript
this.maxCleanupsPerFrame = 3;  // Clean up to N arrays per frame
```

### Adjust Simulation

Edit `src/js/core/constants.js`:
```javascript
export const SIM_FPS = 60;                      // Simulation FPS
export const SIM_STEP_MS = 1000 / SIM_FPS;       // Time per sim step
export const SIM_MAX_STEPS_PER_FRAME = 4;         // Max catch-up steps
```

## Testing the Fixes

### Test Upgrade Menu Smoothness
1. Start the game
2. Collect enough XP to level up
3. Open browser console: `perfWatch(10)`
4. Select an upgrade
5. Observe the report - frame times should be smooth (<33ms)

### Test Battle Performance
1. Start a battle with many enemies
2. Open browser console: `entityCount()`
3. Watch FPS counter in-game
4. Performance should remain smooth even with 300+ entities

### Test Memory Stability
1. Play for 10+ minutes
2. Check memory periodically: `memStats()`
3. Memory should not grow unbounded
4. GC spikes should be minimal due to staggered cleanup

## Expected Results

After these fixes, you should experience:
- ✅ Smooth gameplay after upgrade menu selection
- ✅ Consistent frame times even during intense battles
- ✅ Minimal stutter when many entities spawn/die
- ✅ Stable performance on high refresh rate monitors
- ✅ Ability to diagnose performance issues in real-time

## Performance Tips

1. **Keep entity counts under 500** - More entities = more work per frame
2. **Watch memory usage** - High memory = frequent GC pauses
3. **Monitor jitter percentage** - Over 30% indicates inconsistent frame times
4. **Use staggered cleanup** for large arrays - Spread work across frames
5. **Avoid creating objects in hot paths** - Causes GC pressure

## Files Modified

- `src/js/core/profiler.js` - Enabled by default, added reporting
- `src/js/core/jitter-monitor.js` - NEW: Frame time tracking and analysis
- `src/js/core/staggered-cleanup.js` - NEW: Spread cleanup across frames
- `src/js/core/perf-debug.js` - NEW: Console debug commands
- `src/js/main.js` - Integrated fixes and improved timing
- `src/js/core/constants.js` - Reference for simulation settings

## Further Optimizations (Future Work)

1. **Object Pooling** - Pre-allocate common objects to reduce GC
2. **Spatial Hash Optimization** - Tune cell sizes for better performance
3. **View Frustum Culling** - Only update entities near camera
4. **Particle System Optimization** - Limit particle count based on performance
5. **LOD (Level of Detail)** - Simplify distant entities

## Support

If you still experience jitter after these fixes:
1. Run `perfWatch(30)` during problematic moments
2. Share the console output
3. Check system specs and background processes
4. Try reducing graphics settings in the game menu

## Technical Details

### Frame Timing Algorithm
```javascript
// Old approach (caused jitter):
if (frameDt > 50) {
    frameDt = SIM_STEP_MS; // Hard cutoff
}

// New approach (smooth):
if (frameDt > 100) {
    frameDt = 33.33; // Clamp to 30fps equivalent
} else if (frameDt > 50) {
    frameDt = frameDt * 0.5 + SIM_STEP_MS * 0.5; // Blend
}
```

### Staggered Cleanup Priority
```javascript
priority = (deadCount * 2) + (totalCount * deadRatio)
```
- Higher dead count = higher priority (more urgent cleanup needed)
- Larger array with high dead ratio = higher priority
- Prioritized arrays are cleaned first each frame

## Version History

- **v1.0** - Initial jitter fixes implementation
  - Fixed upgrade menu timing
  - Implemented staggered cleanup
  - Added jitter monitoring
  - Created debug commands

