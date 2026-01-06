
const assert = require('assert');

// Mock Entity structure
class MockEntity {
    constructor(x, y, angle = 0) {
        this.pos = { x, y };
        this.angle = angle;
        this.dead = false;
        this.radius = 260; // Approx destroyer radius
    }
}

// --- Destroyer Logic ---
class DestroyerLogic extends MockEntity {
    constructor(x, y, angle) {
        super(x, y, angle);
        this.visualRadius = 780; // 520 * 1.5
        // Replicating the logic added to main.js
        this.hullDefinition = [
            { x: -110, y: 0, r: 120 }, // Rear
            { x: 0, y: 0, r: 120 },    // Center
            { x: 110, y: 0, r: 120 }   // Front
        ];
        this.hullScale = (this.visualRadius / 340); // ~2.29
        // Recalculate radius based on scale to match main.js logic if needed, 
        // but main.js uses this.radius for broad phase. 
        // Let's assume broad phase radius is sufficient for the test.
        this.radius = 390; 
    }

    hitTestCircle(x, y, r) {
        if (this.dead) return false;
        // Broad phase
        const dx = x - this.pos.x;
        const dy = y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        const broadRadius = this.radius + r;
        if (distSq > broadRadius * broadRadius) return false;

        // Detailed hull check
        const angle = -this.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        for (const circle of this.hullDefinition) {
            const cx = circle.x * this.hullScale;
            const cy = circle.y * this.hullScale;
            const cr = circle.r * this.hullScale;
            const cdx = localX - cx;
            const cdy = localY - cy;
            if (cdx * cdx + cdy * cdy < (cr + r) * (cr + r)) return true;
        }
        return false;
    }
}

// --- Warp Boss Logic ---
class WarpBossLogic extends MockEntity {
    constructor(x, y, angle) {
        super(x, y, angle);
        this.sizeScale = 3;
        this.collisionRadius = 240 * this.sizeScale; // 720
        
        // Replicating main.js logic
        this.collisionHull = [
            { x: 100 * this.sizeScale, y: 0, r: 115 * this.sizeScale }, // Head (Right)
            { x: 0, y: 0, r: 120 * this.sizeScale },                    // Body (Center)
            { x: -100 * this.sizeScale, y: 0, r: 115 * this.sizeScale } // Tail (Left)
        ];
    }

    hitTestCircle(x, y, r) {
        if (this.dead) return false;
        const dx = x - this.pos.x;
        const dy = y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > (this.collisionRadius + r) * (this.collisionRadius + r)) return false;

        // Note: Boss hitTestCircle in main.js calculates local coords differently
        // It uses "aimToPlayer" for rotation. 
        // In main.js: const aimToPlayer = ...; const cos = Math.cos(-aimToPlayer);
        // Here we simulate the rotation passed as this.angle (which effectively represents aim)
        
        const cos = Math.cos(-this.angle);
        const sin = Math.sin(-this.angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        for (const circle of this.collisionHull) {
            const cdx = localX - circle.x;
            const cdy = localY - circle.y;
            if (cdx * cdx + cdy * cdy < (circle.r + r) * (circle.r + r)) return true;
        }
        return false;
    }
}

// --- Test Suite ---
console.log("Running Collision Logic Tests...");

// 1. Destroyer Tests
const dest = new DestroyerLogic(0, 0, 0);
console.log(`Destroyer Scale: ${dest.hullScale.toFixed(2)}`);

// Test Center Hit
const hitCenter = dest.hitTestCircle(0, 0, 10);
console.log(`Destroyer Center Hit: ${hitCenter} (Expected: true)`);
assert.ok(hitCenter, "Destroyer should be hit at center");

// Test Front Hull Hit (approx 110 * 2.29 = ~251px)
const hitFront = dest.hitTestCircle(250, 0, 10);
console.log(`Destroyer Front Hit: ${hitFront} (Expected: true)`);
assert.ok(hitFront, "Destroyer should be hit at front hull");

// Test Rear Hull Hit (-251px)
const hitRear = dest.hitTestCircle(-250, 0, 10);
console.log(`Destroyer Rear Hit: ${hitRear} (Expected: true)`);
assert.ok(hitRear, "Destroyer should be hit at rear hull");

// Test Flank Miss (Width is circle radius 120 * 2.29 = ~275px)
const missFlank = dest.hitTestCircle(0, 300, 10); 
console.log(`Destroyer Flank Miss: ${!missFlank} (Expected: true)`);
assert.ok(!missFlank, "Destroyer should NOT be hit far flank");

// Test Rotation (90 degrees, facing down)
const destRot = new DestroyerLogic(0, 0, Math.PI / 2);
const hitRotated = destRot.hitTestCircle(0, 250, 10); // Check Y axis now
console.log(`Destroyer Rotated Hit: ${hitRotated} (Expected: true)`);
assert.ok(hitRotated, "Rotated Destroyer should be hit on Y axis");


// 2. Warp Boss Tests
const boss = new WarpBossLogic(0, 0, 0);
// Head is at x = 100 * 3 = 300. Radius = 115 * 3 = 345. Extends to 645.
// Tail is at x = -300. Radius 345. Extends to -645.

// Test Head Hit
const hitBossHead = boss.hitTestCircle(600, 0, 10);
console.log(`Boss Head Hit: ${hitBossHead} (Expected: true)`);
assert.ok(hitBossHead, "Boss should be hit at head");

// Test Tail Hit
const hitBossTail = boss.hitTestCircle(-600, 0, 10);
console.log(`Boss Tail Hit: ${hitBossTail} (Expected: true)`);
assert.ok(hitBossTail, "Boss should be hit at tail");

// Test Body Miss (Too far up)
// Center Radius is 120 * 3 = 360.
const missBossSide = boss.hitTestCircle(0, 400, 10);
console.log(`Boss Side Miss: ${!missBossSide} (Expected: true)`);
assert.ok(!missBossSide, "Boss should NOT be hit far side");

console.log("All Collision Tests Passed!");
