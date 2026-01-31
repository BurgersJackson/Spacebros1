import { GameContext } from '../core/game-context.js';

const deps = {};

export function registerWorldHelperDependencies(next) {
    Object.assign(deps, next);
}

export function checkDespawn(entity, range = 6000) {
    if (!GameContext.player) return;
    const dist = Math.hypot(entity.pos.x - GameContext.player.pos.x, entity.pos.y - GameContext.player.pos.y);
    if (dist > range) {
        entity.dead = true;
    }
}

export function generateMap() {
    deps.clearArrayWithPixiCleanup(GameContext.environmentAsteroids);
    GameContext.asteroidRespawnTimers = [];
    deps.clearArrayWithPixiCleanup(GameContext.caches);
    deps.clearArrayWithPixiCleanup(GameContext.pois);
    for (let i = 0; i < 30; i++) {
        deps.spawnOneAsteroidRelative(true);
    }
    deps.spawnExplorationCaches();
    deps.spawnSectorPOIs();
}

export function rayCast(x1, y1, angle, maxDist) {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    let closest = { hit: false, dist: maxDist, x: x1 + vx * maxDist, y: y1 + vy * maxDist };

    for (let ast of GameContext.environmentAsteroids) {
        const cx = ast.pos.x;
        const cy = ast.pos.y;
        const r = ast.radius;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = vx * vx + vy * vy;
        const b = 2 * (fx * vx + fy * vy);
        const c = (fx * fx + fy * fy) - r * r;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
            let t = -1;
            if (t1 >= 0 && t1 <= maxDist) t = t1;
            else if (t2 >= 0 && t2 <= maxDist) t = t2;
            if (t >= 0 && t < closest.dist) {
                closest.hit = true;
                closest.dist = t;
                closest.x = x1 + vx * t;
                closest.y = y1 + vy * t;
                closest.obj = ast;
            }
        }
    }
    return closest;
}

export function applyAOEDamageToPlayer(aoeX, aoeY, aoeRadius, totalDamage, bypassShields = false) {
    if (!GameContext.player || GameContext.player.dead) return;

    let remainingDamage = Math.max(0, Math.ceil(totalDamage));
    const playerAngleToAOE = Math.atan2(aoeY - GameContext.player.pos.y, aoeX - GameContext.player.pos.x);

    // Skip shield damage if bypassShields is true (for explosive weapons)
    if (!bypassShields && GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.some(s => s > 0)) {
        const shieldAngle = playerAngleToAOE - GameContext.player.outerShieldRotation;
        const normalizedAngle = (shieldAngle + Math.PI * 2) % (Math.PI * 2);
        const segCount = GameContext.player.outerShieldSegments.length;

        const arcWidth = Math.atan2(aoeRadius, GameContext.player.outerShieldRadius) * 2;
        const startAngle = normalizedAngle - arcWidth / 2;
        const endAngle = normalizedAngle + arcWidth / 2;

        for (let i = 0; i < segCount && remainingDamage > 0; i++) {
            const segAngle = (i / segCount) * Math.PI * 2;
            let angleDiff = Math.abs(segAngle - startAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff <= arcWidth / 2 && GameContext.player.outerShieldSegments[i] > 0) {
                const absorb = Math.min(remainingDamage, GameContext.player.outerShieldSegments[i]);
                GameContext.player.outerShieldSegments[i] -= absorb;
                remainingDamage -= absorb;
                GameContext.player.shieldsDirty = true;
            }
        }
    }

    if (!bypassShields && GameContext.player.shieldSegments && remainingDamage > 0) {
        const shieldAngle = playerAngleToAOE - GameContext.player.shieldRotation;
        const normalizedAngle = (shieldAngle + Math.PI * 2) % (Math.PI * 2);
        const segCount = GameContext.player.shieldSegments.length;

        const arcWidth = Math.atan2(aoeRadius, GameContext.player.shieldRadius) * 2;
        const startAngle = normalizedAngle - arcWidth / 2;
        const endAngle = normalizedAngle + arcWidth / 2;

        for (let i = 0; i < segCount && remainingDamage > 0; i++) {
            const segAngle = (i / segCount) * Math.PI * 2;
            let angleDiff = Math.abs(segAngle - startAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff <= arcWidth / 2 && GameContext.player.shieldSegments[i] > 0) {
                const absorb = Math.min(remainingDamage, GameContext.player.shieldSegments[i]);
                GameContext.player.shieldSegments[i] -= absorb;
                remainingDamage -= absorb;
                GameContext.player.shieldsDirty = true;
            }
        }
    }

    if (remainingDamage > 0) {
        GameContext.player.takeHit(remainingDamage);
    }
}
