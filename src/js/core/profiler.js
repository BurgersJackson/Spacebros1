export class Profiler {
    constructor() {
        this.metrics = {};
        this.frameCount = 0;
        this.reportInterval = 300; // Report every 300 frames (approx 5s)
        this.enabled = false; // Disabled - enable via perfEnable() if needed
    }

    start(label) {
        if (!this.enabled) return;
        if (!this.metrics[label]) {
            this.metrics[label] = {
                startTime: 0,
                totalTime: 0,
                count: 0,
                max: 0,
                avg: 0
            };
        }
        this.metrics[label].startTime = performance.now();
    }

    end(label) {
        if (!this.enabled || !this.metrics[label]) return;

        const end = performance.now();
        const duration = end - this.metrics[label].startTime;
        const metric = this.metrics[label];

        metric.totalTime += duration;
        metric.count++;
        metric.max = Math.max(metric.max, duration);
    }

    update() {
        if (!this.enabled) return;

        this.frameCount++;
        if (this.frameCount >= this.reportInterval) {
            this.report();
            this.reset();
        }
    }

    report() {
        console.group('--- Performance Report (Avg per frame over last ' + this.reportInterval + ' frames) ---');
        // Also log to screen for better visibility
        if (typeof window !== 'undefined') {
            window.lastPerfReport = this.metrics;
        }

        // Sort by average time descending
        const sortedLabels = Object.keys(this.metrics).sort((a, b) => {
            const avgA = this.metrics[a].totalTime / this.metrics[a].count;
            const avgB = this.metrics[b].totalTime / this.metrics[b].count;
            return avgB - avgA;
        });

        const tableData = {};

        for (const label of sortedLabels) {
            const m = this.metrics[label];
            if (m.count === 0) continue;

            const avg = m.totalTime / m.count;
            tableData[label] = {
                'Avg (ms)': avg.toFixed(3),
                'Max (ms)': m.max.toFixed(3),
                'Total (ms)': m.totalTime.toFixed(1),
                'Calls': m.count
            };
        }

        console.table(tableData);
        console.groupEnd();
    }

    reset() {
        this.frameCount = 0;
        for (const label in this.metrics) {
            this.metrics[label].totalTime = 0;
            this.metrics[label].count = 0;
            this.metrics[label].max = 0;
        }
    }
}

export const globalProfiler = new Profiler();
