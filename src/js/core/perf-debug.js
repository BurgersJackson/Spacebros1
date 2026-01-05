/**
 * Performance Debug Console Commands
 * Provides runtime performance monitoring and diagnostics
 */

import { globalProfiler } from './profiler.js';
import { globalJitterMonitor } from './jitter-monitor.js';

// Make performance tools available in browser console
if (typeof window !== 'undefined') {
    
    // Enable/disable profiler
    window.perfEnable = () => {
        globalProfiler.enabled = true;
        console.log('✅ Profiler ENABLED');
        return globalProfiler;
    };
    
    window.perfDisable = () => {
        globalProfiler.enabled = false;
        console.log('❌ Profiler DISABLED');
    };
    
    // Get current performance stats
    window.perfStats = () => {
        return {
            profiler: {
                enabled: globalProfiler.enabled,
                metrics: globalProfiler.metrics,
                frameCount: globalProfiler.frameCount
            },
            jitter: window.jitterStats || {},
            recommendations: globalJitterMonitor.getRecommendations()
        };
    };
    
    // Log performance report immediately
    window.perfReport = () => {
        globalProfiler.report();
        globalJitterMonitor.report();
        return window.perfStats();
    };
    
    // Monitor frame times for specified duration
    window.perfWatch = (seconds = 10) => {
        console.log(`👀 Watching performance for ${seconds} seconds...`);
        const originalInterval = globalJitterMonitor.reportInterval;
        globalJitterMonitor.reportInterval = seconds * 1000;
        setTimeout(() => {
            globalJitterMonitor.report();
            globalJitterMonitor.reportInterval = originalInterval;
        }, seconds * 1000);
    };
    
    // Force garbage collection (if available)
    window.forceGC = () => {
        if (typeof window.gc === 'function') {
            const start = performance.now();
            window.gc();
            const duration = performance.now() - start;
            console.log(`🗑️ Forced GC in ${duration.toFixed(2)}ms`);
            return duration;
        } else {
            console.log('⚠️ GC not exposed. Use Chrome DevTools with --js-flags="--expose-gc"');
        }
    };
    
    // Check memory usage
    window.memStats = () => {
        if (performance.memory) {
            const mem = performance.memory;
            const usedMB = (mem.usedJSHeapSize / 1048576).toFixed(2);
            const totalMB = (mem.totalJSHeapSize / 1048576).toFixed(2);
            const limitMB = (mem.jsHeapSizeLimit / 1048576).toFixed(2);
            const percent = ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1);
            
            return {
                usedMB,
                totalMB,
                limitMB,
                percent,
                status: percent > 80 ? '⚠️ HIGH' : '✅ OK'
            };
        } else {
            console.log('⚠️ Memory stats not available in this browser');
        }
    };
    
    // Entity count report
    window.entityCount = () => {
        const stats = {
            bullets: window.bullets?.length || 0,
            enemies: window.enemies?.length || 0,
            pinwheels: window.pinwheels?.length || 0,
            particles: window.particles?.length || 0,
            explosions: window.explosions?.length || 0,
            coins: window.coins?.length || 0,
            nuggets: window.nuggets?.length || 0,
            powerups: window.powerups?.length || 0,
            drones: window.drones?.length || 0
        };
        
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        
        console.table(stats);
        console.log(`Total entities: ${total}`);
        
        return stats;
    };
    
    // Quick performance check
    window.perfCheck = () => {
        console.group('🔍 Performance Check');
        
        // Memory
        const mem = window.memStats();
        if (mem) {
            console.log(`Memory: ${mem.usedMB}MB / ${mem.limitMB}MB (${mem.percent}%) ${mem.status}`);
        }
        
        // Entities
        const entities = window.entityCount();
        const totalEntities = Object.values(entities).reduce((a, b) => a + b, 0);
        
        // FPS estimation
        if (window.fpsSmoothMs) {
            const fps = 1000 / window.fpsSmoothMs;
            console.log(`FPS: ${fps.toFixed(1)}`);
        }
        
        // Jitter
        if (window.jitterStats) {
            const { fps, jitterPercent, spikes } = window.jitterStats;
            console.log(`Jitter: ${jitterPercent?.toFixed(1)}% (spikes: ${spikes})`);
        }
        
        // Warnings
        if (totalEntities > 500) {
            console.warn('⚠️ High entity count - may cause performance issues');
        }
        if (mem && mem.percent > 80) {
            console.warn('⚠️ High memory usage - GC spikes likely');
        }
        
        console.groupEnd();
        
        return {
            mem,
            entities,
            totalEntities
        };
    };
    
    // Help
    window.perfHelp = () => {
        console.log(`
🚀 Performance Debug Commands:

perfEnable()      - Enable profiler
perfDisable()     - Disable profiler
perfStats()       - Get current performance stats
perfReport()      - Print detailed performance report
perfWatch(secs)   - Monitor performance for N seconds
forceGC()         - Force garbage collection (if available)
memStats()        - Get memory usage statistics
entityCount()     - Count all game entities
perfCheck()       - Quick performance check with warnings

Tips for smooth gameplay:
- Keep entity count under 500
- Monitor for frame spikes >33ms
- Check for jitter >30%
- Use perfWatch(30) to observe during gameplay
        `);
    };
    
    console.log('🚀 Performance debug commands loaded. Type perfHelp() for commands.');
}










