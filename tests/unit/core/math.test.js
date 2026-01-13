/**
 * Vector Class and Math Utilities Tests
 * AI-callable tests for core math functionality
 */

import { describe, it, expect } from 'vitest';
import { Vector, SpatialHash, clamp, lerp, randomRange, randomInt, closestPointOnSegment, resolveCircleSegment } from '../../../src/js/core/math.js';

describe('Vector class', () => {
    describe('construction', () => {
        it('should create zero vector by default', () => {
            const v = new Vector();
            expect(v.x).toBe(0);
            expect(v.y).toBe(0);
        });

        it('should create vector with coordinates', () => {
            const v = new Vector(3, 4);
            expect(v.x).toBe(3);
            expect(v.y).toBe(4);
        });

        it('should create vector with negative coordinates', () => {
            const v = new Vector(-5, -10);
            expect(v.x).toBe(-5);
            expect(v.y).toBe(-10);
        });
    });

    describe('add', () => {
        it('should add vectors and return this for chaining', () => {
            const v1 = new Vector(3, 4);
            const v2 = new Vector(1, 2);
            const result = v1.add(v2);
            expect(v1.x).toBe(4);
            expect(v1.y).toBe(6);
            expect(result).toBe(v1); // Chaining support
        });

        it('should add negative vectors', () => {
            const v1 = new Vector(5, 5);
            const v2 = new Vector(-2, -3);
            v1.add(v2);
            expect(v1.x).toBe(3);
            expect(v1.y).toBe(2);
        });
    });

    describe('sub', () => {
        it('should subtract vectors and return this for chaining', () => {
            const v1 = new Vector(5, 7);
            const v2 = new Vector(2, 3);
            const result = v1.sub(v2);
            expect(v1.x).toBe(3);
            expect(v1.y).toBe(4);
            expect(result).toBe(v1);
        });
    });

    describe('mult', () => {
        it('should multiply vector by scalar', () => {
            const v = new Vector(3, 4);
            v.mult(2);
            expect(v.x).toBe(6);
            expect(v.y).toBe(8);
        });

        it('should handle negative scalar', () => {
            const v = new Vector(3, 4);
            v.mult(-1);
            expect(v.x).toBe(-3);
            expect(v.y).toBe(-4);
        });

        it('should handle zero scalar', () => {
            const v = new Vector(3, 4);
            v.mult(0);
            expect(v.x).toBe(0);
            expect(v.y).toBe(0);
        });
    });

    describe('div', () => {
        it('should divide vector by scalar', () => {
            const v = new Vector(6, 8);
            v.div(2);
            expect(v.x).toBe(3);
            expect(v.y).toBe(4);
        });

        it('should not modify vector when dividing by zero', () => {
            const v = new Vector(6, 8);
            v.div(0);
            expect(v.x).toBe(6);
            expect(v.y).toBe(8);
        });
    });

    describe('mag', () => {
        it('should calculate magnitude correctly for 3-4-5 triangle', () => {
            const v = new Vector(3, 4);
            expect(v.mag()).toBe(5);
        });

        it('should calculate magnitude correctly for 5-12-13 triangle', () => {
            const v = new Vector(5, 12);
            expect(v.mag()).toBe(13);
        });

        it('should return 0 for zero vector', () => {
            const v = new Vector(0, 0);
            expect(v.mag()).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const v = new Vector(-3, -4);
            expect(v.mag()).toBe(5);
        });
    });

    describe('magSq', () => {
        it('should calculate squared magnitude without sqrt', () => {
            const v = new Vector(3, 4);
            expect(v.magSq()).toBe(25);
        });

        it('should be faster than mag for comparisons', () => {
            const v = new Vector(5, 12);
            expect(v.magSq()).toBe(169);
        });
    });

    describe('normalize', () => {
        it('should normalize vector to unit length', () => {
            const v = new Vector(3, 4);
            v.normalize();
            expect(v.mag()).toBeCloseTo(1, 5);
        });

        it('should preserve direction when normalizing', () => {
            const v = new Vector(10, 0);
            v.normalize();
            expect(v.x).toBeCloseTo(1, 5);
            expect(v.y).toBeCloseTo(0, 5);
        });

        it('should handle zero vector gracefully', () => {
            const v = new Vector(0, 0);
            v.normalize();
            expect(v.x).toBe(0);
            expect(v.y).toBe(0);
        });
    });

    describe('copy', () => {
        it('should create independent copy of vector', () => {
            const v1 = new Vector(3, 4);
            const v2 = v1.copy();
            expect(v2.x).toBe(3);
            expect(v2.y).toBe(4);

            v1.x = 10;
            expect(v2.x).toBe(3); // Should not affect copy
        });
    });

    describe('set', () => {
        it('should set vector coordinates', () => {
            const v = new Vector(0, 0);
            v.set(5, 7);
            expect(v.x).toBe(5);
            expect(v.y).toBe(7);
        });

        it('should return this for chaining', () => {
            const v = new Vector(0, 0);
            const result = v.set(1, 2);
            expect(result).toBe(v);
        });
    });

    describe('static methods', () => {
        it('should calculate distance between vectors', () => {
            const v1 = new Vector(0, 0);
            const v2 = new Vector(3, 4);
            expect(Vector.dist(v1, v2)).toBe(5);
        });

        it('should calculate squared distance without sqrt', () => {
            const v1 = new Vector(0, 0);
            const v2 = new Vector(3, 4);
            expect(Vector.distSq(v1, v2)).toBe(25);
        });

        it('should calculate angle between vectors (0 degrees)', () => {
            const v1 = new Vector(0, 0);
            const v2 = new Vector(1, 0);
            expect(Vector.angle(v1, v2)).toBeCloseTo(0, 5);
        });

        it('should calculate angle between vectors (90 degrees)', () => {
            const v1 = new Vector(0, 0);
            const v2 = new Vector(0, 1);
            expect(Vector.angle(v1, v2)).toBeCloseTo(Math.PI / 2, 5);
        });

        it('should calculate angle between vectors (180 degrees)', () => {
            const v1 = new Vector(0, 0);
            const v2 = new Vector(-1, 0);
            expect(Vector.angle(v1, v2)).toBeCloseTo(Math.PI, 5);
        });
    });
});

describe('Utility functions', () => {
    describe('clamp', () => {
        it('should return value when within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
        });

        it('should clamp to minimum', () => {
            expect(clamp(-5, 0, 10)).toBe(0);
        });

        it('should clamp to maximum', () => {
            expect(clamp(15, 0, 10)).toBe(10);
        });

        it('should handle negative ranges', () => {
            expect(clamp(0, -10, -5)).toBe(-5);
        });
    });

    describe('lerp', () => {
        it('should linear interpolate between values at t=0.5', () => {
            expect(lerp(0, 10, 0.5)).toBe(5);
        });

        it('should return start value at t=0', () => {
            expect(lerp(0, 10, 0)).toBe(0);
        });

        it('should return end value at t=1', () => {
            expect(lerp(0, 10, 1)).toBe(10);
        });

        it('should extrapolate beyond t=1', () => {
            expect(lerp(0, 10, 1.5)).toBe(15);
        });

        it('should extrapolate below t=0', () => {
            expect(lerp(0, 10, -0.5)).toBe(-5);
        });
    });

    describe('randomRange', () => {
        it('should return value within range', () => {
            for (let i = 0; i < 100; i++) {
                const val = randomRange(10, 20);
                expect(val).toBeGreaterThanOrEqual(10);
                expect(val).toBeLessThan(20);
            }
        });

        it('should handle negative ranges', () => {
            for (let i = 0; i < 50; i++) {
                const val = randomRange(-10, 10);
                expect(val).toBeGreaterThanOrEqual(-10);
                expect(val).toBeLessThan(10);
            }
        });
    });

    describe('randomInt', () => {
        it('should return integer within range inclusive', () => {
            for (let i = 0; i < 100; i++) {
                const val = randomInt(1, 10);
                expect(val).toBeGreaterThanOrEqual(1);
                expect(val).toBeLessThanOrEqual(10);
                expect(Number.isInteger(val)).toBe(true);
            }
        });

        it('should return same value when min equals max', () => {
            const val = randomInt(5, 5);
            expect(val).toBe(5);
        });
    });
});

describe('SpatialHash class', () => {
    describe('construction', () => {
        it('should create spatial hash with cell size', () => {
            const hash = new SpatialHash(100);
            expect(hash.cellSize).toBe(100);
            expect(hash.grid).toBeInstanceOf(Map);
        });
    });

    describe('key generation', () => {
        it('should generate consistent keys for same position', () => {
            const hash = new SpatialHash(100);
            const key1 = hash.key(50, 50);
            const key2 = hash.key(50, 50);
            expect(key1).toBe(key2);
        });

        it('should generate different keys for different cells', () => {
            const hash = new SpatialHash(100);
            const key1 = hash.key(50, 50);
            const key2 = hash.key(150, 50);
            expect(key1).not.toBe(key2);
        });

        it('should handle negative coordinates', () => {
            const hash = new SpatialHash(100);
            const key = hash.key(-50, -50);
            expect(typeof key).toBe('string');
        });
    });

    describe('insert and query', () => {
        it('should insert entity and retrieve via query', () => {
            const hash = new SpatialHash(100);
            const entity = { pos: new Vector(50, 50) };
            hash.insert(entity);

            const results = hash.query(50, 50, 50);
            expect(results).toContain(entity);
        });

        it('should query nearby cells with radius', () => {
            const hash = new SpatialHash(100);
            const entity1 = { pos: new Vector(50, 50) };
            const entity2 = { pos: new Vector(150, 50) };
            hash.insert(entity1);
            hash.insert(entity2);

            const results = hash.query(100, 50, 100);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should query nearby cells with queryNearby', () => {
            const hash = new SpatialHash(100);
            const entity = { pos: new Vector(50, 50) };
            hash.insert(entity);

            const results = hash.queryNearby(50, 50);
            expect(results).toContain(entity);
        });
    });

    describe('clear', () => {
        it('should clear all entities from grid', () => {
            const hash = new SpatialHash(100);
            hash.insert({ pos: new Vector(50, 50) });
            hash.insert({ pos: new Vector(150, 50) });

            hash.clear();
            expect(hash.grid.size).toBe(0);
        });
    });
});

describe('closestPointOnSegment', () => {
    it('should find midpoint when point is at center', () => {
        const result = closestPointOnSegment(0, 0, -10, 0, 10, 0);
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.y).toBeCloseTo(0, 5);
        expect(result.t).toBeCloseTo(0.5, 5);
    });

    it('should find closest point on segment endpoints', () => {
        const result = closestPointOnSegment(20, 0, 0, 0, 10, 0);
        expect(result.x).toBeCloseTo(10, 5);
        expect(result.t).toBeCloseTo(1, 5);
    });

    it('should handle vertical segments', () => {
        const result = closestPointOnSegment(0, 5, 0, 0, 0, 10);
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.y).toBeCloseTo(5, 5);
        expect(result.t).toBeCloseTo(0.5, 5);
    });

    it('should handle diagonal segments', () => {
        const result = closestPointOnSegment(5, 5, 0, 0, 10, 10);
        expect(result.x).toBeCloseTo(5, 5);
        expect(result.y).toBeCloseTo(5, 5);
        expect(result.t).toBeCloseTo(0.5, 5);
    });
});
