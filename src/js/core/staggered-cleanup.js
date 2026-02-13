/**
 * Staggered Cleanup System
 * Spreads array cleanup and garbage collection across multiple frames
 * to prevent frame time spikes and jitter
 */

export class StaggeredCleanup {
  constructor() {
    this.cleanupQueue = [];
    this.maxCleanupsPerFrame = 3; // Clean up to 3 arrays per frame
    this.cleanupFrameCounter = 0;
    this.enabled = true;
  }

  /**
   * Register an array for staggered cleanup
   * @param {Array} array - The array to clean
   * @param {string} name - Name for debugging
   * @param {Function} cleanupFn - Optional cleanup function for dead items
   */
  schedule(array, name, cleanupFn = null) {
    if (!this.enabled || !array || array.length === 0) return false;

    this.cleanupQueue.push({
      array,
      name,
      cleanupFn,
      priority: this.calculatePriority(array)
    });

    return true;
  }

  calculatePriority(array) {
    // Higher priority for larger arrays that cause more GC pressure
    const deadCount = array.filter(item => item && item.dead).length;
    const totalCount = array.length;
    const ratio = deadCount / totalCount;

    // Priority: (dead count * 2) + (total count * ratio)
    return deadCount * 2 + totalCount * ratio;
  }

  process() {
    if (!this.enabled || this.cleanupQueue.length === 0) return;

    // Process up to maxCleanupsPerFrame arrays
    const processed = [];
    for (let i = 0; i < Math.min(this.maxCleanupsPerFrame, this.cleanupQueue.length); i++) {
      const item = this.cleanupQueue[i];
      if (item && item.array) {
        const removed = this.cleanupArray(item.array, item.cleanupFn);
        if (removed > 0) {
          // Only remove from queue if items were actually cleaned
          processed.push(i);
        }
      } else {
        // Array is empty or invalid, remove from queue
        processed.push(i);
      }
    }

    // Remove processed items from queue (in reverse order to maintain indices)
    for (let i = processed.length - 1; i >= 0; i--) {
      this.cleanupQueue.splice(processed[i], 1);
    }

    this.cleanupFrameCounter++;
  }

  cleanupArray(array, cleanupFn) {
    let writeIdx = 0;
    const len = array.length;
    let removedCount = 0;

    for (let i = 0; i < len; i++) {
      const item = array[i];
      if (!item) continue;

      if (item.dead) {
        removedCount++;
        if (cleanupFn && typeof cleanupFn === "function") {
          try {
            cleanupFn(item);
          } catch (e) {
            console.warn("Staggered cleanup callback failed:", e);
          }
        }
      } else {
        array[writeIdx++] = item;
      }
    }

    if (removedCount > 0) {
      array.length = writeIdx;
    }

    return removedCount;
  }

  forceCleanupAll() {
    // Bypass staggering and clean everything immediately
    const total = this.cleanupQueue.length;
    for (let i = 0; i < total; i++) {
      const item = this.cleanupQueue[i];
      if (item && item.array) {
        this.cleanupArray(item.array, item.cleanupFn);
      }
    }
    this.cleanupQueue = [];
  }

  getQueueSize() {
    return this.cleanupQueue.length;
  }
}

// Global instance
export const globalStaggeredCleanup = new StaggeredCleanup();

// Convenience function for direct array cleanup without queueing
export function staggeredCompactArray(array, cleanupFn = null) {
  if (!array || array.length === 0) return 0;

  // For small arrays (< 50 items), just clean immediately
  if (array.length < 50) {
    return immediateCompactArray(array, cleanupFn);
  }

  // For larger arrays, use staggered cleanup
  return globalStaggeredCleanup.schedule(array, "array", cleanupFn)
    ? 0
    : immediateCompactArray(array, cleanupFn);
}

// Immediate compact for critical cleanup
export function immediateCompactArray(array, cleanupFn = null) {
  let writeIdx = 0;
  const len = array.length;
  let removedCount = 0;

  for (let i = 0; i < len; i++) {
    const item = array[i];
    if (!item) continue;

    if (item.dead) {
      removedCount++;
      if (cleanupFn && typeof cleanupFn === "function") {
        try {
          cleanupFn(item);
        } catch (e) {
          console.warn("Immediate cleanup callback failed:", e);
        }
      }
    } else {
      array[writeIdx++] = item;
    }
  }

  if (removedCount > 0) {
    array.length = writeIdx;
  }

  return removedCount;
}
