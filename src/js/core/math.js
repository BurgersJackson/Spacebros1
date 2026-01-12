/**
 * Math Utilities
 * Vector class and SpatialHash for collision optimization.
 */

/**
 * 2D Vector class for position and velocity calculations.
 */
export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    div(s) {
        if (s !== 0) {
            this.x /= s;
            this.y /= s;
        }
        return this;
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const m = this.mag();
        if (m > 0) {
            this.x /= m;
            this.y /= m;
        }
        return this;
    }

    copy() {
        return new Vector(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    static dist(v1, v2) {
        return Math.hypot(v2.x - v1.x, v2.y - v1.y);
    }

    static angle(v1, v2) {
        return Math.atan2(v2.y - v1.y, v2.x - v1.x);
    }

    /**
     * Squared distance between two vectors (faster than dist, no sqrt).
     * Use for distance comparisons: distSq < threshold * threshold
     */
    static distSq(v1, v2) {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        return dx * dx + dy * dy;
    }
}

// Reusable temp vectors for zero-allocation calculations
// Use these in hot paths instead of creating new Vector instances
export const _tempVec1 = new Vector();
export const _tempVec2 = new Vector();
export const _tempVec3 = new Vector();

/**
 * Spatial hash grid for efficient neighbor queries.
 * Used for collision detection optimization.
 */
export class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    key(x, y) {
        return Math.floor(x / this.cellSize) + "," + Math.floor(y / this.cellSize);
    }

    clear() {
        this.grid.clear();
    }

    insert(entity) {
        const k = this.key(entity.pos.x, entity.pos.y);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(entity);
    }

    query(x, y, radius = 1) {
        const cellRadius = Math.ceil(radius / this.cellSize);
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const results = [];

        for (let i = -cellRadius; i <= cellRadius; i++) {
            for (let j = -cellRadius; j <= cellRadius; j++) {
                const k = (cx + i) + "," + (cy + j);
                const cell = this.grid.get(k);
                if (cell) {
                    for (let l = 0; l < cell.length; l++) {
                        results.push(cell[l]);
                    }
                }
            }
        }
        return results;
    }

    queryNearby(x, y) {
        // Query immediate neighbors (3x3 cells)
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const results = [];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const k = (cx + i) + "," + (cy + j);
                const cell = this.grid.get(k);
                if (cell) {
                    for (let l = 0; l < cell.length; l++) {
                        results.push(cell[l]);
                    }
                }
            }
        }
        return results;
    }
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b.
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Random float between min and max.
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Random integer between min and max (inclusive).
 */
export function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Find the closest point on a line segment to a given point.
 * @param {number} px Point X
 * @param {number} py Point Y
 * @param {number} ax Segment Start X
 * @param {number} ay Segment Start Y
 * @param {number} bx Segment End X
 * @param {number} by Segment End Y
 * @returns {{x: number, y: number, t: number}} Closest point and t-value
 */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    let t = 0;
    if (abLenSq > 0.000001) t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return { x: ax + abx * t, y: ay + aby * t, t };
}

/**
 * Resolve collision between a circular entity and a line segment.
 * @param {Entity} entity The entity with pos, radius, and vel
 * @param {number} ax Segment Start X
 * @param {number} ay Segment Start Y
 * @param {number} bx Segment End X
 * @param {number} by Segment End Y
 * @param {number} elasticity Bounce factor (0 to 1)
 * @returns {boolean} True if collision occurred
 */
export function resolveCircleSegment(entity, ax, ay, bx, by, elasticity = 0.7) {
    const cp = closestPointOnSegment(entity.pos.x, entity.pos.y, ax, ay, bx, by);
    let dx = entity.pos.x - cp.x;
    let dy = entity.pos.y - cp.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
        // Fallback: choose a stable normal.
        const sx = bx - ax;
        const sy = by - ay;
        const nLen = Math.hypot(sx, sy) || 1;
        dx = -sy / nLen;
        dy = sx / nLen;
        dist = 1;
    }
    const pad = 0.5;
    const minDist = (entity.radius || 0) + pad;
    if (dist >= minDist) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    entity.pos.x += nx * overlap;
    entity.pos.y += ny * overlap;

    if (entity.vel) {
        const vn = entity.vel.x * nx + entity.vel.y * ny;
        if (vn < 0) {
            entity.vel.x -= nx * vn * (1 + elasticity);
            entity.vel.y -= ny * vn * (1 + elasticity);
        }
    }
    return true;
}
