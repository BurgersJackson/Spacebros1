/**
 * Test Data Fixtures
 * Reusable mock objects and test data for AI-callable tests
 */

import { Vector } from '../../src/js/core/math.js';

/**
 * Common test vectors
 */
export const testVectors = {
    origin: new Vector(0, 0),
    unitX: new Vector(1, 0),
    unitY: new Vector(0, 1),
    diagonal: new Vector(1, 1),
    threeFourFive: new Vector(3, 4),
    negative: new Vector(-5, -10),
    large: new Vector(1000, 2000)
};

/**
 * Create a mock player entity
 */
export function mockPlayer(opts = {}) {
    return {
        pos: opts.pos || new Vector(0, 0),
        vel: opts.vel || new Vector(0, 0),
        angle: opts.angle || 0,
        radius: opts.radius || 25,
        hp: opts.hp || 100,
        maxHp: opts.maxHp || 100,
        dead: false,
        damageMultiplier: opts.damageMultiplier || 1,
        fireRateMultiplier: opts.fireRateMultiplier || 1,
        rangeMultiplier: opts.rangeMultiplier || 1,
        shipType: opts.shipType || 'standard'
    };
}

/**
 * Create a mock enemy entity
 */
export function mockEnemy(opts = {}) {
    return {
        pos: opts.pos || new Vector(100, 100),
        vel: opts.vel || new Vector(0, 0),
        angle: opts.angle || 0,
        radius: opts.radius || 20,
        hp: opts.hp || 30,
        maxHp: opts.maxHp || 30,
        dead: false,
        type: opts.type || 'roamer',
        xpValue: opts.xpValue || 10
    };
}

/**
 * Create a mock projectile
 */
export function mockProjectile(opts = {}) {
    return {
        pos: opts.pos || new Vector(0, 0),
        vel: opts.vel || new Vector(10, 0),
        angle: opts.angle || 0,
        radius: opts.radius || 5,
        damage: opts.damage || 10,
        dead: false,
        owner: opts.owner || 'player'
    };
}

/**
 * Create a mock game state
 */
export function mockGameState(opts = {}) {
    return {
        player: opts.player || mockPlayer(),
        enemies: opts.enemies || [],
        bullets: opts.bullets || [],
        particles: opts.particles || [],
        coins: opts.coins || [],
        score: opts.score || 0,
        difficultyTier: opts.difficultyTier || 1,
        gameActive: opts.gameActive !== undefined ? opts.gameActive : true,
        gamePaused: opts.gamePaused || false,
        caveMode: opts.caveMode || false,
        sectorIndex: opts.sectorIndex || 0
    };
}

/**
 * Spawn position test cases
 */
export const spawnTestCases = [
    {
        name: 'player at origin',
        playerPos: new Vector(0, 0),
        minDistance: 500,
        maxDistance: 2000
    },
    {
        name: 'player at positive coordinates',
        playerPos: new Vector(1000, 1000),
        minDistance: 500,
        maxDistance: 2000
    },
    {
        name: 'player at negative coordinates',
        playerPos: new Vector(-1000, -1000),
        minDistance: 500,
        maxDistance: 2000
    }
];

/**
 * Upgrade tier test data
 */
export const upgradeTiers = [1, 2, 3, 4, 5];

/**
 * Common damage multiplier values
 */
export const damageMultipliers = {
    base: 1.0,
    tier1: 1.2,
    tier2: 1.4,
    tier3: 1.7,
    tier4: 2.0,
    tier5: 2.4
};
