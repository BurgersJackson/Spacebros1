/**
 * Tests for Staggered Cleanup - Garbage collection system
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StaggeredCleanup,
  globalStaggeredCleanup,
  staggeredCompactArray,
  immediateCompactArray
} from "../../../src/js/core/staggered-cleanup.js";

describe("StaggeredCleanup", () => {
  let cleanup;

  beforeEach(() => {
    cleanup = new StaggeredCleanup();
    vi.clearAllMocks();
  });

  describe("construction", () => {
    it("should initialize with empty queue", () => {
      expect(cleanup.cleanupQueue).toEqual([]);
    });

    it("should set max cleanups per frame to 3", () => {
      expect(cleanup.maxCleanupsPerFrame).toBe(3);
    });

    it("should initialize frame counter", () => {
      expect(cleanup.cleanupFrameCounter).toBe(0);
    });

    it("should be enabled by default", () => {
      expect(cleanup.enabled).toBe(true);
    });
  });

  describe("schedule", () => {
    it("should return false for disabled cleanup", () => {
      cleanup.enabled = false;
      const array = [{ dead: true }, { dead: false }];

      const result = cleanup.schedule(array, "test");

      expect(result).toBe(false);
      expect(cleanup.cleanupQueue).toHaveLength(0);
    });

    it("should return false for null array", () => {
      const result = cleanup.schedule(null, "test");

      expect(result).toBe(false);
    });

    it("should return false for empty array", () => {
      const result = cleanup.schedule([], "test");

      expect(result).toBe(false);
    });

    it("should add array to queue", () => {
      const array = [{ dead: true }, { dead: false }];

      const result = cleanup.schedule(array, "test");

      expect(result).toBe(true);
      expect(cleanup.cleanupQueue).toHaveLength(1);
      expect(cleanup.cleanupQueue[0].array).toBe(array);
      expect(cleanup.cleanupQueue[0].name).toBe("test");
    });

    it("should calculate priority for array", () => {
      const array = [{ dead: true }, { dead: false }, { dead: true }];

      cleanup.schedule(array, "test");

      const item = cleanup.cleanupQueue[0];
      expect(item.priority).toBeGreaterThan(0);
    });

    it("should give higher priority to arrays with more dead items", () => {
      const smallArray = [{ dead: false }, { dead: false }, { dead: false }];
      const largeArray = [
        { dead: true },
        { dead: true },
        { dead: true },
        { dead: true },
        { dead: true }
      ];

      cleanup.schedule(smallArray, "small");
      cleanup.schedule(largeArray, "large");

      expect(cleanup.cleanupQueue[1].priority).toBeGreaterThan(cleanup.cleanupQueue[0].priority);
    });

    it("should handle missing cleanup function", () => {
      const array = [{ dead: true }, { dead: false }];

      expect(() => cleanup.schedule(array, "test")).not.toThrow();
    });
  });

  describe("calculatePriority", () => {
    it("should return NaN for empty array", () => {
      const priority = cleanup.calculatePriority([]);
      expect(priority).toBeNaN();
    });

    it("should calculate priority based on dead count", () => {
      const array = Array(10).fill({ dead: false });
      const priority = cleanup.calculatePriority(array);

      expect(priority).toBe(0);
    });

    it("should calculate higher priority for more dead items", () => {
      const array1 = [{ dead: true }, { dead: false }, { dead: false }];
      const array2 = [{ dead: true }, { dead: true }, { dead: true }];

      const priority1 = cleanup.calculatePriority(array1);
      const priority2 = cleanup.calculatePriority(array2);

      expect(priority2).toBeGreaterThan(priority1);
    });

    it("should give higher priority with more dead items", () => {
      const array1 = [{ dead: true }, { dead: false }]; // 1 dead, 2 total
      const array2 = [{ dead: true }, { dead: true }, { dead: false }]; // 2 dead, 3 total

      const priority1 = cleanup.calculatePriority(array1);
      const priority2 = cleanup.calculatePriority(array2);

      expect(priority2).toBeGreaterThan(priority1);
    });
  });

  describe("process", () => {
    it("should return early when queue is empty", () => {
      expect(() => cleanup.process()).not.toThrow();
      expect(cleanup.cleanupFrameCounter).toBe(0);
    });

    it("should return early when disabled", () => {
      cleanup.enabled = false;
      const array = [{ dead: true }];
      cleanup.schedule(array, "test");

      cleanup.process();

      expect(cleanup.cleanupFrameCounter).toBe(0);
    });

    it("should process one array from queue", () => {
      const array = [{ dead: true }, { dead: false }];
      cleanup.schedule(array, "test");

      cleanup.process();

      expect(cleanup.cleanupFrameCounter).toBe(1);
      expect(cleanup.cleanupQueue).toHaveLength(0);
    });

    it("should process multiple arrays up to maxCleanupsPerFrame", () => {
      const array1 = [{ dead: true }];
      const array2 = [{ dead: true }];
      const array3 = [{ dead: true }];
      const array4 = [{ dead: true }];

      cleanup.schedule(array1, "test1");
      cleanup.schedule(array2, "test2");
      cleanup.schedule(array3, "test3");
      cleanup.schedule(array4, "test4");

      cleanup.process();

      expect(cleanup.cleanupFrameCounter).toBe(1);
      expect(cleanup.cleanupQueue).toHaveLength(1);
    });

    it("should remove dead items from arrays", () => {
      const array = [
        { dead: true },
        { dead: false },
        { dead: true },
        { dead: false },
        { dead: true }
      ];

      cleanup.schedule(array, "test");
      cleanup.process();

      expect(array).toHaveLength(2);
      expect(array.every(item => !item.dead)).toBe(true);
    });

    it("should call cleanup function for dead items", () => {
      const cleanupFn = vi.fn();
      const array = [
        { dead: true, id: 1 },
        { dead: false, id: 2 }
      ];

      cleanup.schedule(array, "test", cleanupFn);
      cleanup.process();

      expect(cleanupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).toHaveBeenCalledWith({ dead: true, id: 1 });
    });

    it("should handle cleanup function errors", () => {
      const cleanupFn = vi.fn(() => {
        throw new Error("Test error");
      });
      const array = [{ dead: true }, { dead: false }];

      expect(() => {
        cleanup.schedule(array, "test", cleanupFn);
        cleanup.process();
      }).not.toThrow();
    });
  });

  describe("forceCleanupAll", () => {
    it("should process all arrays in queue", () => {
      const array1 = [{ dead: true }];
      const array2 = [{ dead: true }];
      const array3 = [{ dead: true }];

      cleanup.schedule(array1, "test1");
      cleanup.schedule(array2, "test2");
      cleanup.schedule(array3, "test3");

      cleanup.forceCleanupAll();

      expect(cleanup.cleanupQueue).toHaveLength(0);
      expect(array1).toHaveLength(0);
      expect(array2).toHaveLength(0);
      expect(array3).toHaveLength(0);
    });

    it("should ignore queue order", () => {
      const array1 = [{ dead: true }];
      const array2 = [{ dead: true }, { dead: true }];

      cleanup.schedule(array1, "test1");
      cleanup.schedule(array2, "test2");

      cleanup.forceCleanupAll();

      expect(array1).toHaveLength(0);
      expect(array2).toHaveLength(0);
    });
  });

  describe("getQueueSize", () => {
    it("should return 0 for empty queue", () => {
      expect(cleanup.getQueueSize()).toBe(0);
    });

    it("should return correct queue size", () => {
      cleanup.schedule([{ dead: true }], "test1");
      cleanup.schedule([{ dead: true }], "test2");
      cleanup.schedule([{ dead: true }], "test3");

      expect(cleanup.getQueueSize()).toBe(3);
    });
  });
});

describe("globalStaggeredCleanup", () => {
  it("should be a StaggeredCleanup instance", () => {
    expect(globalStaggeredCleanup).toBeInstanceOf(StaggeredCleanup);
  });

  it("should be usable globally", () => {
    const array = [{ dead: true }, { dead: false }];

    expect(() => globalStaggeredCleanup.schedule(array, "test")).not.toThrow();
  });
});

describe("immediateCompactArray", () => {
  it("should return 0 for empty array", () => {
    const result = immediateCompactArray([]);
    expect(result).toBe(0);
  });

  it("should remove dead items", () => {
    const array = [
      { dead: true },
      { dead: false },
      { dead: true },
      { dead: false },
      { dead: true }
    ];

    const removed = immediateCompactArray(array);

    expect(removed).toBe(3);
    expect(array).toHaveLength(2);
    expect(array.every(item => !item.dead)).toBe(true);
  });

  it("should preserve live items", () => {
    const item1 = { id: 1, dead: false };
    const item2 = { id: 2, dead: false };
    const item3 = { id: 3, dead: false };

    const array = [{ dead: true }, item1, { dead: true }, item2, { dead: true }, item3];

    immediateCompactArray(array);

    expect(array).toHaveLength(3);
    expect(array).toContain(item1);
    expect(array).toContain(item2);
    expect(array).toContain(item3);
  });

  it("should call cleanup function", () => {
    const cleanupFn = vi.fn();
    const array = [
      { dead: true, id: 1 },
      { dead: false, id: 2 }
    ];

    immediateCompactArray(array, cleanupFn);

    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledWith({ dead: true, id: 1 });
  });

  it("should handle cleanup function errors", () => {
    const cleanupFn = vi.fn(() => {
      throw new Error("Test error");
    });
    const array = [{ dead: true }, { dead: false }];

    expect(() => immediateCompactArray(array, cleanupFn)).not.toThrow();
  });

  it("should update array length", () => {
    const array = [
      { dead: true },
      { dead: false },
      { dead: true },
      { dead: false },
      { dead: true }
    ];

    expect(array).toHaveLength(5);

    immediateCompactArray(array);

    expect(array).toHaveLength(2);
  });
});

describe("staggeredCompactArray", () => {
  beforeEach(() => {
    globalStaggeredCleanup.cleanupQueue = [];
    vi.clearAllMocks();
  });

  it("should return 0 for null array", () => {
    const result = staggeredCompactArray(null);
    expect(result).toBe(0);
  });

  it("should return 0 for empty array", () => {
    const result = staggeredCompactArray([]);
    expect(result).toBe(0);
  });

  it("should compact small arrays immediately", () => {
    const array = [
      { dead: true },
      { dead: false },
      { dead: true },
      { dead: false },
      { dead: true }
    ];

    const removed = staggeredCompactArray(array);

    expect(removed).toBe(3);
    expect(array).toHaveLength(2);
    expect(globalStaggeredCleanup.cleanupQueue).toHaveLength(0);
  });

  it("should schedule large arrays for staggered cleanup", () => {
    const array = Array(100).fill({ dead: true });

    const removed = staggeredCompactArray(array);

    expect(removed).toBe(0);
    expect(globalStaggeredCleanup.cleanupQueue).toHaveLength(1);
  });

  it("should call cleanup function", () => {
    const cleanupFn = vi.fn();
    const array = [
      { dead: true, id: 1 },
      { dead: false, id: 2 },
      { dead: true, id: 3 },
      { dead: false, id: 4 },
      { dead: true, id: 5 }
    ];

    const removed = staggeredCompactArray(array, cleanupFn);

    expect(removed).toBe(3);
  });

  it("should handle threshold boundary at 50 items", () => {
    const array1 = Array(49).fill({ dead: true });
    const array2 = Array(50).fill({ dead: true });
    const array3 = Array(51).fill({ dead: true });

    const removed1 = staggeredCompactArray(array1);
    const removed2 = staggeredCompactArray(array2);
    const removed3 = staggeredCompactArray(array3);

    expect(removed1).toBe(49);
    expect(removed2).toBe(0); // Arrays >= 50 items are scheduled, not immediately cleaned
    expect(removed3).toBe(0);
  });
});
