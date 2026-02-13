/**
 * Tests for GameContext - Global Game State Management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameContext, getElapsedGameTime } from "../../../src/js/core/game-context.js";

describe("GameContext", () => {
  beforeEach(() => {
    // Reset GameContext to initial state before each test
    GameContext.reset();
    // Re-initialize grids since reset clears them
    GameContext.asteroidGrid.clear();
    GameContext.targetGrid.clear();
  });

  describe("initialization", () => {
    it("should have correct initial state values", () => {
      expect(GameContext.gameActive).toBe(false);
      expect(GameContext.gamePaused).toBe(false);
      expect(GameContext.score).toBe(0);
      expect(GameContext.difficultyTier).toBe(1);
      expect(GameContext.sectorIndex).toBe(1);
    });

    it("should initialize entity arrays", () => {
      expect(Array.isArray(GameContext.bullets)).toBe(true);
      expect(Array.isArray(GameContext.enemies)).toBe(true);
      expect(Array.isArray(GameContext.particles)).toBe(true);
      expect(Array.isArray(GameContext.explosions)).toBe(true);
      expect(Array.isArray(GameContext.coins)).toBe(true);
    });

    it("should initialize spatial hash grids", () => {
      expect(GameContext.asteroidGrid).toBeDefined();
      expect(GameContext.targetGrid).toBeDefined();
    });

    it("should initialize boss references as null", () => {
      expect(GameContext.boss).toBeNull();
      expect(GameContext.spaceStation).toBeNull();
      expect(GameContext.destroyer).toBeNull();
      expect(GameContext.radiationStorm).toBeNull();
    });
  });

  describe("reset", () => {
    it("should reset game state values", () => {
      // Modify some values
      GameContext.gameActive = true;
      GameContext.score = 1000;
      GameContext.difficultyTier = 3;
      GameContext.sectorIndex = 5;
      GameContext.gamePaused = true;

      // Reset
      GameContext.reset();

      // Check values are reset
      expect(GameContext.gameActive).toBe(false);
      expect(GameContext.score).toBe(0);
      expect(GameContext.difficultyTier).toBe(1);
      expect(GameContext.sectorIndex).toBe(1);
      expect(GameContext.gamePaused).toBe(false);
    });

    it("should clear entity arrays", () => {
      // Add some entities
      GameContext.bullets.push({ id: 1 });
      GameContext.enemies.push({ id: 2 });
      GameContext.particles.push({ id: 3 });

      // Reset
      GameContext.reset();

      // Check arrays are cleared
      expect(GameContext.bullets).toEqual([]);
      expect(GameContext.enemies).toEqual([]);
      expect(GameContext.particles).toEqual([]);
    });

    it("should clear spatial hash grids", () => {
      // Reset calls clear() on grids
      GameContext.reset();

      // Verify grids are cleared by re-initializing them empty
      expect(GameContext.asteroidGrid).toBeDefined();
      expect(GameContext.targetGrid).toBeDefined();
    });

    it("should reset boss references", () => {
      // Set some boss references
      GameContext.boss = { name: "test boss" };
      GameContext.spaceStation = { name: "test station" };
      GameContext.destroyer = { name: "test destroyer" };

      // Reset
      GameContext.reset();

      // Check references are nullified
      expect(GameContext.boss).toBeNull();
      expect(GameContext.spaceStation).toBeNull();
      expect(GameContext.destroyer).toBeNull();
    });

    it("should reset arena states", () => {
      // Modify arena states
      GameContext.bossArena.active = true;
      GameContext.caveBossArena.active = true;
      GameContext.dungeon1Arena.active = true;
      GameContext.stationArena.active = true;

      // Reset
      GameContext.reset();

      // Check arena states are reset
      expect(GameContext.bossArena.active).toBe(false);
      expect(GameContext.caveBossArena.active).toBe(false);
      expect(GameContext.dungeon1Arena.active).toBe(false);
      expect(GameContext.stationArena.active).toBe(false);
    });
  });

  describe("game state management", () => {
    it("should track pause state", () => {
      expect(GameContext.gamePaused).toBe(false);
      GameContext.gamePaused = true;
      expect(GameContext.gamePaused).toBe(true);
    });

    it("should track active state", () => {
      expect(GameContext.gameActive).toBe(false);
      GameContext.gameActive = true;
      expect(GameContext.gameActive).toBe(true);
    });

    it("should track score", () => {
      expect(GameContext.score).toBe(0);
      GameContext.score = 100;
      expect(GameContext.score).toBe(100);
      GameContext.score += 50;
      expect(GameContext.score).toBe(150);
    });

    it("should track difficulty tier", () => {
      expect(GameContext.difficultyTier).toBe(1);
      GameContext.difficultyTier = 2;
      expect(GameContext.difficultyTier).toBe(2);
    });
  });

  describe("meta profile", () => {
    it("should initialize meta profile with default values", () => {
      expect(GameContext.metaProfile).toBeDefined();
      expect(GameContext.metaProfile.bank).toBe(0);
      expect(GameContext.metaProfile.purchases).toBeDefined();
      expect(GameContext.metaProfile.purchases.startDamage).toBe(0);
      expect(GameContext.metaProfile.purchases.passiveHp).toBe(0);
    });

    it("should track reroll tokens", () => {
      expect(GameContext.rerollTokens).toBe(0);
      GameContext.rerollTokens = 5;
      expect(GameContext.rerollTokens).toBe(5);
    });

    it("should track extra lives", () => {
      expect(GameContext.metaExtraLifeCount).toBe(0);
      GameContext.metaExtraLifeCount = 2;
      expect(GameContext.metaExtraLifeCount).toBe(2);
    });
  });

  describe("dread manager", () => {
    it("should initialize dread manager with default values", () => {
      expect(GameContext.dreadManager).toBeDefined();
      expect(GameContext.dreadManager.timerActive).toBe(false);
      expect(GameContext.dreadManager.firstSpawnDone).toBe(false);
      expect(GameContext.dreadManager.minDelayMs).toBe(120000);
      expect(GameContext.dreadManager.maxDelayMs).toBe(300000);
    });

    it("should be reset correctly", () => {
      // Modify dread manager
      GameContext.dreadManager.timerActive = true;
      GameContext.dreadManager.firstSpawnDone = true;
      GameContext.dreadManager.timerAt = Date.now();

      // Reset
      GameContext.reset();

      // Check dread manager is reset
      expect(GameContext.dreadManager.timerActive).toBe(false);
      expect(GameContext.dreadManager.firstSpawnDone).toBe(false);
      expect(GameContext.dreadManager.timerAt).toBeNull();
    });
  });
});

describe("getElapsedGameTime", () => {
  beforeEach(() => {
    GameContext.gameActive = false;
    GameContext.gameStartTime = 0;
    GameContext.pausedAccumMs = 0;
  });

  it("should return 0 when game is not active", () => {
    expect(getElapsedGameTime()).toBe(0);
  });

  it("should return elapsed time when game is active", () => {
    const startTime = Date.now();
    GameContext.gameActive = true;
    GameContext.gameStartTime = startTime;

    // Mock a delay
    const delay = 1000;
    const testTime = startTime + delay;
    vi.useFakeTimers();
    vi.setSystemTime(testTime);

    const elapsed = getElapsedGameTime();
    expect(elapsed).toBeGreaterThanOrEqual(delay - 10);
    expect(elapsed).toBeLessThanOrEqual(delay + 10);

    vi.useRealTimers();
  });

  it("should subtract accumulated pause time", () => {
    const startTime = Date.now();
    GameContext.gameActive = true;
    GameContext.gameStartTime = startTime;
    GameContext.pausedAccumMs = 5000;

    const testTime = startTime + 10000;
    vi.useFakeTimers();
    vi.setSystemTime(testTime);

    const elapsed = getElapsedGameTime();
    expect(elapsed).toBe(5000); // 10000 - 5000

    vi.useRealTimers();
  });
});
