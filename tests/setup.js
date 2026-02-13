/**
 * Global Test Setup
 * Runs before all test suites
 */

import { beforeEach, vi } from "vitest";

// Reset any global state before each test
beforeEach(async () => {
  // Reset temp vectors to clean state
  const { _tempVec1, _tempVec2, _tempVec3 } = await import("../src/js/core/math.js");
  if (_tempVec1) _tempVec1.set(0, 0);
  if (_tempVec2) _tempVec2.set(0, 0);
  if (_tempVec3) _tempVec3.set(0, 0);
});

// Set test timezone for consistent time-based tests
process.env.TZ = "UTC";

// Mock browser globals for Node.js environment
global.window = {
  AudioContext: class MockAudioContext {},
  webkitAudioContext: class MockWebkitAudioContext {}
};
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.Audio = class MockAudio {};
global.Image = class MockImage {};
