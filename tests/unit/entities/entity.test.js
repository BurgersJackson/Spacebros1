/**
 * Tests for Entity class - Base game object
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../../../src/js/entities/Entity.js";
import { SIM_STEP_MS } from "../../../src/js/core/constants.js";

describe("Entity", () => {
  let entity;

  beforeEach(() => {
    entity = new Entity(100, 200);
  });

  describe("construction", () => {
    it("should create entity at given position", () => {
      expect(entity.pos.x).toBe(100);
      expect(entity.pos.y).toBe(200);
    });

    it("should initialize velocity to zero", () => {
      expect(entity.vel.x).toBe(0);
      expect(entity.vel.y).toBe(0);
    });

    it("should initialize dead to false", () => {
      expect(entity.dead).toBe(false);
    });

    it("should set default radius", () => {
      expect(entity.radius).toBe(10);
    });

    it("should initialize angle to 0", () => {
      expect(entity.angle).toBe(0);
    });

    it("should initialize prevPos to current position", () => {
      expect(entity.prevPos.x).toBe(100);
      expect(entity.prevPos.y).toBe(200);
    });
  });

  describe("update", () => {
    it("should update position based on velocity with default delta", () => {
      entity.vel.x = 10;
      entity.vel.y = 20;

      entity.update();

      // At 120Hz (8.33ms), velocity scales by ~0.5 compared to 60Hz
      // So in one frame: 10 * ~0.5 = ~5, 20 * ~0.5 = ~10
      expect(entity.pos.x).toBeCloseTo(105, 1);
      expect(entity.pos.y).toBeCloseTo(210, 1);
    });

    it("should update position with custom deltaTime", () => {
      entity.vel.x = 10;
      entity.vel.y = 20;

      // Use 2x the normal delta time
      entity.update(SIM_STEP_MS * 2);

      // Should move 2x as far
      expect(entity.pos.x).toBeCloseTo(110, 1);
      expect(entity.pos.y).toBeCloseTo(220, 1);
    });

    it("should save previous position before updating", () => {
      entity.vel.x = 10;
      entity.vel.y = 20;

      entity.update();

      expect(entity.prevPos.x).toBe(100);
      expect(entity.prevPos.y).toBe(200);
    });

    it("should handle zero velocity", () => {
      entity.vel.x = 0;
      entity.vel.y = 0;

      entity.update();

      expect(entity.pos.x).toBe(100);
      expect(entity.pos.y).toBe(200);
    });

    it("should handle negative velocity", () => {
      entity.vel.x = -10;
      entity.vel.y = -20;

      entity.update();

      expect(entity.pos.x).toBeCloseTo(95, 1);
      expect(entity.pos.y).toBeCloseTo(190, 1);
    });

    it("should update prevPos each frame", () => {
      entity.vel.x = 10;
      entity.vel.y = 0;

      entity.update();
      expect(entity.prevPos.x).toBe(100);

      entity.update();
      expect(entity.prevPos.x).toBeCloseTo(105, 1);
    });
  });

  describe("getRenderPos", () => {
    it("should return prevPos when alpha is 0", () => {
      entity.pos.x = 150;
      entity.prevPos.x = 100;

      const renderPos = entity.getRenderPos(0);
      expect(renderPos.x).toBe(100);
      expect(renderPos.y).toBe(200);
    });

    it("should return current pos when alpha is 1", () => {
      entity.prevPos.x = 100;
      entity.pos.x = 150;

      const renderPos = entity.getRenderPos(1);
      expect(renderPos.x).toBe(150);
      expect(renderPos.y).toBe(200);
    });

    it("should interpolate between prevPos and pos at alpha 0.5", () => {
      entity.prevPos.x = 100;
      entity.pos.x = 200;
      entity.prevPos.y = 100;
      entity.pos.y = 200;

      const renderPos = entity.getRenderPos(0.5);
      expect(renderPos.x).toBe(150);
      expect(renderPos.y).toBe(150);
    });

    it("should return plain object not Vector", () => {
      const renderPos = entity.getRenderPos(0.5);
      expect(renderPos.constructor).toBe(Object);
      expect(renderPos).not.toHaveProperty("mag");
      expect(renderPos).not.toHaveProperty("add");
    });
  });

  describe("collidesWith", () => {
    let otherEntity;

    beforeEach(() => {
      otherEntity = new Entity(110, 200);
    });

    it("should return true when entities overlap", () => {
      entity.radius = 10;
      otherEntity.radius = 10;
      // Distance is 10, combined radius is 20, so they overlap

      expect(entity.collidesWith(otherEntity)).toBe(true);
    });

    it("should return false when entities do not overlap", () => {
      entity.radius = 5;
      otherEntity.radius = 5;
      // Distance is 10, combined radius is 10, so they touch but don't overlap

      expect(entity.collidesWith(otherEntity)).toBe(false);
    });

    it("should return false when other is null", () => {
      expect(entity.collidesWith(null)).toBe(false);
    });

    it("should return false when other is undefined", () => {
      expect(entity.collidesWith(undefined)).toBe(false);
    });

    it("should handle entities at same position", () => {
      const samePositionEntity = new Entity(100, 200);
      entity.radius = 10;
      samePositionEntity.radius = 5;

      expect(entity.collidesWith(samePositionEntity)).toBe(true);
    });
  });

  describe("distSqTo", () => {
    let otherEntity;

    beforeEach(() => {
      otherEntity = new Entity(100, 200);
    });

    it("should return 0 when at same position", () => {
      expect(entity.distSqTo(otherEntity)).toBe(0);
    });

    it("should calculate correct squared distance", () => {
      const farEntity = new Entity(100, 300); // 100 units away in Y
      const distSq = entity.distSqTo(farEntity);
      expect(distSq).toBe(10000); // 100^2
    });

    it("should handle diagonal distance", () => {
      const diagEntity = new Entity(110, 210); // 10 units in X, 10 units in Y
      const distSq = entity.distSqTo(diagEntity);
      expect(distSq).toBe(200); // sqrt(10^2 + 10^2) = sqrt(200)
    });
  });

  describe("distTo", () => {
    let otherEntity;

    beforeEach(() => {
      otherEntity = new Entity(100, 200);
    });

    it("should return 0 when at same position", () => {
      expect(entity.distTo(otherEntity)).toBe(0);
    });

    it("should calculate correct distance", () => {
      const farEntity = new Entity(100, 300); // 100 units away in Y
      const dist = entity.distTo(farEntity);
      expect(dist).toBe(100);
    });

    it("should handle diagonal distance", () => {
      const diagEntity = new Entity(110, 210); // 10 units in X, 10 units in Y
      const dist = entity.distTo(diagEntity);
      expect(dist).toBeCloseTo(14.142, 3);
    });
  });

  describe("angleTo", () => {
    it("should return 0 when target is to the right", () => {
      const rightEntity = new Entity(200, 200);
      const angle = entity.angleTo(rightEntity);
      expect(angle).toBeCloseTo(0, 4);
    });

    it("should return PI/2 when target is below", () => {
      const downEntity = new Entity(100, 300);
      const angle = entity.angleTo(downEntity);
      expect(angle).toBeCloseTo(Math.PI / 2, 4);
    });

    it("should return PI when target is to the left", () => {
      const leftEntity = new Entity(0, 200);
      const angle = entity.angleTo(leftEntity);
      expect(angle).toBeCloseTo(Math.PI, 4);
    });

    it("should return -PI/2 when target is above", () => {
      const upEntity = new Entity(100, 100);
      const angle = entity.angleTo(upEntity);
      expect(angle).toBeCloseTo(-Math.PI / 2, 4);
    });
  });

  describe("kill", () => {
    it("should mark entity as dead", () => {
      expect(entity.dead).toBe(false);
      entity.kill();
      expect(entity.dead).toBe(true);
    });

    it("should not affect other properties", () => {
      const originalPos = entity.pos.x;
      const originalVel = entity.vel.y;
      const originalRadius = entity.radius;

      entity.kill();

      expect(entity.pos.x).toBe(originalPos);
      expect(entity.vel.y).toBe(originalVel);
      expect(entity.radius).toBe(originalRadius);
    });
  });

  describe("isInView", () => {
    it("should return true when entity is within view bounds", () => {
      const inView = entity.isInView(100, 200, 200, 200);
      expect(inView).toBe(true);
    });

    it("should return false when entity is outside view bounds (left)", () => {
      const inView = entity.isInView(500, 200, 200, 200);
      expect(inView).toBe(false);
    });

    it("should return false when entity is outside view bounds (right)", () => {
      const inView = entity.isInView(-300, 200, 200, 200);
      expect(inView).toBe(false);
    });

    it("should return false when entity is outside view bounds (above)", () => {
      const inView = entity.isInView(100, 500, 200, 200);
      expect(inView).toBe(false);
    });

    it("should return false when entity is outside view bounds (below)", () => {
      const inView = entity.isInView(100, -300, 200, 200);
      expect(inView).toBe(false);
    });

    it("should include margin in calculation", () => {
      // Entity at 100,200. Camera at 150,200 with 200x200 view and 50 margin
      // View bounds with margin:
      // x: 150-100-50=0, x: 150+100+50=300
      // y: 200-100-50=50, y: 200+100+50=350
      // Entity at x=100,y=200 should be in view
      const inView = entity.isInView(150, 200, 200, 200, 50);
      expect(inView).toBe(true);
    });
  });
});
