/**
 * Core Constants Tests
 * AI-callable tests for validating game constants and configuration
 */

import { describe, it, expect } from "vitest";
import {
  ZOOM_LEVEL,
  SPRITE_RENDER_SCALE,
  SIM_FPS,
  PHYSICS_FPS,
  SIM_STEP_MS,
  SIM_MAX_STEPS_PER_FRAME,
  GAME_DURATION_MS,
  PIXI_SPRITE_POOL_MAX,
  ASTEROID_GRID_CELL_SIZE,
  EXPLOSION1_COLS,
  EXPLOSION1_ROWS,
  EXPLOSION1_FRAMES,
  EXPLOSION1_FRAME_W,
  EXPLOSION1_FRAME_H
} from "../../../src/js/core/constants.js";

describe("Rendering Constants", () => {
  it("should have valid zoom level", () => {
    expect(ZOOM_LEVEL).toBeGreaterThan(0);
    expect(ZOOM_LEVEL).toBeLessThan(1);
  });

  it("should have sprite render scale compensating for zoom", () => {
    expect(SPRITE_RENDER_SCALE).toBeGreaterThan(1);
  });
});

describe("Simulation Constants", () => {
  it("should have correct reference framerate (60Hz)", () => {
    expect(SIM_FPS).toBe(60);
  });

  it("should have physics at 120Hz for stability", () => {
    expect(PHYSICS_FPS).toBe(120);
  });

  it("should calculate correct time step at 120Hz", () => {
    // 1000ms / 120 = 8.333...ms
    expect(SIM_STEP_MS).toBeCloseTo(8.33, 2);
    expect(SIM_STEP_MS).toBeCloseTo(1000 / PHYSICS_FPS, 5);
  });

  it("should have reasonable max catch-up steps", () => {
    expect(SIM_MAX_STEPS_PER_FRAME).toBeGreaterThan(0);
    expect(SIM_MAX_STEPS_PER_FRAME).toBeLessThan(20);
  });
});

describe("Game Duration", () => {
  it("should have 30 minute game duration", () => {
    // 30 minutes * 60 seconds * 1000ms
    expect(GAME_DURATION_MS).toBe(30 * 60 * 1000);
  });
});

describe("Sprite Pool Limits", () => {
  it("should have reasonable sprite pool max", () => {
    expect(PIXI_SPRITE_POOL_MAX).toBeGreaterThan(1000);
    expect(PIXI_SPRITE_POOL_MAX).toBeLessThan(100000);
  });
});

describe("Spatial Hash Settings", () => {
  it("should have positive cell size for collision grid", () => {
    expect(ASTEROID_GRID_CELL_SIZE).toBeGreaterThan(0);
  });
});

describe("Explosion Spritesheet", () => {
  it("should have correct frame count", () => {
    expect(EXPLOSION1_FRAMES).toBe(EXPLOSION1_COLS * EXPLOSION1_ROWS);
  });

  it("should calculate correct frame dimensions", () => {
    // Explosion spritesheet is 1024x1024
    const expectedWidth = 1024 / EXPLOSION1_COLS;
    const expectedHeight = 1024 / EXPLOSION1_ROWS;

    expect(EXPLOSION1_FRAME_W).toBe(expectedWidth);
    expect(EXPLOSION1_FRAME_H).toBe(expectedHeight);
  });

  it("should have reasonable frame counts", () => {
    expect(EXPLOSION1_COLS).toBeGreaterThan(0);
    expect(EXPLOSION1_ROWS).toBeGreaterThan(0);
    expect(EXPLOSION1_FRAMES).toBeGreaterThan(0);
  });
});
