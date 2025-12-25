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
}

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
