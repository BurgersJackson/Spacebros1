/**
 * Jitter Monitor and Frame Time Analysis
 * Detects and helps fix frame time inconsistencies causing jitter
 */

export class JitterMonitor {
    constructor() {
        this.enabled = true;
        this.frameTimes = [];
        this.maxSamples = 300; // Store ~5 seconds of frame data at 60fps
        this.jitterThreshold = 16.67 * 2; // Alert if frame time is 2x normal (33ms)
        this.jitterCount = 0;
        this.lastReportTime = 0;
        this.reportInterval = 5000; // Report every 5 seconds
        
        // Statistics
        this.avgFrameTime = 0;
        this.maxFrameTime = 0;
        this.minFrameTime = Infinity;
        this.frameTimeVariance = 0;
        
        // Spike detection
        this.recentSpikes = [];
        this.maxRecentSpikes = 10;
    }

    recordFrame(frameTimeMs) {
        if (!this.enabled) return;
        
        const now = performance.now();
        this.frameTimes.push(frameTimeMs);
        
        // Maintain circular buffer
        if (this.frameTimes.length > this.maxSamples) {
            this.frameTimes.shift();
        }
        
        // Track min/max
        this.maxFrameTime = Math.max(this.maxFrameTime, frameTimeMs);
        this.minFrameTime = Math.min(this.minFrameTime, frameTimeMs);
        
        // Detect spikes
        if (frameTimeMs > this.jitterThreshold) {
            this.jitterCount++;
            this.recentSpikes.push({
                time: now,
                duration: frameTimeMs,
                stack: this.captureStackTrace()
            });
            
            if (this.recentSpikes.length > this.maxRecentSpikes) {
                this.recentSpikes.shift();
            }
        }
        
        // Calculate statistics periodically
        if (now - this.lastReportTime >= this.reportInterval) {
            this.calculateStats();
            this.report();
            this.resetStats();
            this.lastReportTime = now;
        }
    }

    calculateStats() {
        if (this.frameTimes.length === 0) return;
        
        let sum = 0;
        for (const t of this.frameTimes) {
            sum += t;
        }
        this.avgFrameTime = sum / this.frameTimes.length;
        
        // Calculate variance
        let varianceSum = 0;
        for (const t of this.frameTimes) {
            varianceSum += Math.pow(t - this.avgFrameTime, 2);
        }
        this.frameTimeVariance = varianceSum / this.frameTimes.length;
    }

    report() {
        const fps = 1000 / this.avgFrameTime;
        const varianceMs = Math.sqrt(this.frameTimeVariance);
        const jitterPercent = (varianceMs / this.avgFrameTime) * 100;
        
        console.group('📊 Jitter Monitor Report');
        console.log(`Avg Frame Time: ${this.avgFrameTime.toFixed(2)}ms (${fps.toFixed(0)} FPS)`);
        console.log(`Min/Max: ${this.minFrameTime.toFixed(2)}ms / ${this.maxFrameTime.toFixed(2)}ms`);
        console.log(`Variance: ${varianceMs.toFixed(2)}ms (${jitterPercent.toFixed(1)}% jitter)`);
        console.log(`Spikes (>${this.jitterThreshold}ms): ${this.jitterCount} in last ${this.maxSamples} frames`);
        
        if (this.recentSpikes.length > 0) {
            console.warn('Recent Frame Spikes:');
            this.recentSpikes.forEach((spike, i) => {
                const timeSince = ((performance.now() - spike.time) / 1000).toFixed(1);
                console.warn(`  ${i + 1}. ${spike.duration.toFixed(1)}ms (${timeSince}s ago)`);
                if (spike.stack) {
                    console.warn('     Likely from:', spike.stack);
                }
            });
        }
        
        // Diagnosis
        this.diagnoseIssues(fps, jitterPercent);
        
        console.groupEnd();
        
        // Store for external access
        if (typeof window !== 'undefined') {
            window.jitterStats = {
                avgFrameTime: this.avgFrameTime,
                fps,
                variance: varianceMs,
                jitterPercent,
                spikes: this.jitterCount,
                recentSpikes: this.recentSpikes
            };
        }
    }

    diagnoseIssues(fps, jitterPercent) {
        if (fps < 45) {
            console.warn('⚠️ LOW FPS DETECTED - Consider optimizing entity counts or reducing particle effects');
        }
        
        if (jitterPercent > 30) {
            console.warn('⚠️ HIGH JITTER - Game feels stuttery. Common causes:');
            console.warn('   1. Garbage collection spikes');
            console.warn('   2. Large array operations (compactArray, clearArray)');
            console.warn('   3. Sudden entity spawning/destruction');
            console.warn('   4. Pixi sprite pool exhaustion');
        }
        
        if (this.maxFrameTime > 100) {
            console.warn('⚠️ EXTREME FRAME SPIKE (>100ms) - Likely blocking operation or GC pause');
        }
    }

    resetStats() {
        this.jitterCount = 0;
        this.maxFrameTime = 0;
        this.minFrameTime = Infinity;
        this.frameTimes = [];
        this.recentSpikes = [];
    }

    captureStackTrace() {
        // Try to capture a simplified stack to identify what caused the spike
        try {
            const err = new Error();
            const stack = err.stack;
            if (stack) {
                // Extract just the function names, keep it brief
                const lines = stack.split('\n').slice(2, 5);
                return lines.map(l => l.trim().substring(0, 50)).join(' → ');
            }
        } catch (e) {}
        return null;
    }

    getRecommendations() {
        const recommendations = [];
        
        if (this.jitterCount > 10) {
            recommendations.push('High jitter detected - Consider spreading entity cleanup across multiple frames');
        }
        
        if (this.avgFrameTime > 20) {
            recommendations.push('Average frame time high - Reduce entity counts or optimize rendering');
        }
        
        if (this.maxFrameTime > 50) {
            recommendations.push('Large frame spikes detected - Check for blocking operations during gameplay');
        }
        
        return recommendations;
    }
}

export const globalJitterMonitor = new JitterMonitor();

