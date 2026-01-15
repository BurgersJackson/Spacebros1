import { GameContext } from '../core/game-context.js';
import { Enemy, Pinwheel, Destroyer, Destroyer2, SpaceStation, Cruiser } from '../entities/index.js';
import { CavePinwheel1, CavePinwheel2, CavePinwheel3 } from '../entities/cave/index.js';

let _spawnParticles = null;
let _playSound = null;
let _updateHealthUI = null;
let _updateNuggetUI = null;
let _addPickupFloatingText = null;
let _showOverlayMessage = null;
let _killPlayer = null;
let _handleSpaceStationDestroyed = null;
let _spawnLightningArc = null;
let _spawnLargeExplosion = null;
let _destroyBulletSprite = null;
let _updateContractUI = null;
let _setProjectileImpactSoundContext = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

/**
 * @param {Object} deps
 */
export function registerCollisionDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.playSound) _playSound = deps.playSound;
    if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
    if (deps.updateNuggetUI) _updateNuggetUI = deps.updateNuggetUI;
    if (deps.addPickupFloatingText) _addPickupFloatingText = deps.addPickupFloatingText;
    if (deps.showOverlayMessage) _showOverlayMessage = deps.showOverlayMessage;
    if (deps.killPlayer) _killPlayer = deps.killPlayer;
    if (deps.handleSpaceStationDestroyed) _handleSpaceStationDestroyed = deps.handleSpaceStationDestroyed;
    if (deps.spawnLightningArc) _spawnLightningArc = deps.spawnLightningArc;
    if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
    if (deps.destroyBulletSprite) _destroyBulletSprite = deps.destroyBulletSprite;
    if (deps.updateContractUI) _updateContractUI = deps.updateContractUI;
    if (deps.setProjectileImpactSoundContext) _setProjectileImpactSoundContext = deps.setProjectileImpactSoundContext;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

/**
 * @param {Object} entity
 * @param {number} elasticity
 */
export function checkWallCollision(entity, elasticity = 0) {
    if (!entity || entity.dead) return;

    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
        GameContext.caveLevel.applyWallCollisions(entity);
    }

    if (GameContext.warpZone && GameContext.warpZone.active) {
        GameContext.warpZone.applyWallCollisions(entity);
    }

    const activeAnomalyZone = (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies)
        ? GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id)
        : null;
    if (activeAnomalyZone) {
        const dA = Math.hypot(entity.pos.x - activeAnomalyZone.pos.x, entity.pos.y - activeAnomalyZone.pos.y);
        if (dA < activeAnomalyZone.radius + 800) activeAnomalyZone.applyWallCollisions(entity, 0.95);
    }

    if (GameContext.bossArena.active && entity instanceof Enemy) return;
    if (GameContext.bossArena.active) {
        const dx = entity.pos.x - GameContext.bossArena.x;
        const dy = entity.pos.y - GameContext.bossArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.bossArena.radius) {
            if (entity === GameContext.player) {
                const warpBossActive = !!(GameContext.boss && GameContext.bossActive && GameContext.boss.isWarpBoss && !GameContext.boss.dead);
                if (!warpBossActive && Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        if (_playSound) _playSound('hit');
                        if (_updateHealthUI) _updateHealthUI();
                        if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f00');
                        if (_showOverlayMessage) _showOverlayMessage("WARNING: ARENA WALL DAMAGE", '#f00', 1000);
                        if (GameContext.player.hp <= 0) {
                            if (_killPlayer) _killPlayer();
                            else GameContext.player.dead = true;
                        }
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.bossArena.x + Math.cos(angle) * GameContext.bossArena.radius;
            entity.pos.y = GameContext.bossArena.y + Math.sin(angle) * GameContext.bossArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    if (GameContext.stationArena.active && entity instanceof Enemy) return;
    if (GameContext.stationArena.active) {
        const dx = entity.pos.x - GameContext.stationArena.x;
        const dy = entity.pos.y - GameContext.stationArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.stationArena.radius) {
            if (entity === GameContext.player) {
                if (Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        if (_playSound) _playSound('hit');
                        if (_updateHealthUI) _updateHealthUI();
                        if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f00');
                        if (_showOverlayMessage) _showOverlayMessage("STATION FIELD DAMAGE", '#f80', 1000);
                        if (GameContext.player.hp <= 0) {
                            if (_killPlayer) _killPlayer();
                            else GameContext.player.dead = true;
                        }
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.stationArena.x + Math.cos(angle) * GameContext.stationArena.radius;
            entity.pos.y = GameContext.stationArena.y + Math.sin(angle) * GameContext.stationArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    // Cave boss arena boundary (similar to station arena)
    if (GameContext.caveBossArena && GameContext.caveBossArena.active && GameContext.caveMode) {
        const dx = entity.pos.x - GameContext.caveBossArena.x;
        const dy = entity.pos.y - GameContext.caveBossArena.y;
        const dist = Math.hypot(dx, dy);

        if (dist > GameContext.caveBossArena.radius) {
            if (entity === GameContext.player) {
                if (Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        if (_playSound) _playSound('hit');
                        if (_updateHealthUI) _updateHealthUI();
                        if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f80');
                        if (_showOverlayMessage) _showOverlayMessage("ARENA BOUNDARY DAMAGE", '#f80', 1000);
                        if (GameContext.player.hp <= 0) {
                            if (_killPlayer) _killPlayer();
                            else GameContext.player.dead = true;
                        }
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.caveBossArena.x + Math.cos(angle) * GameContext.caveBossArena.radius;
            entity.pos.y = GameContext.caveBossArena.y + Math.sin(angle) * GameContext.caveBossArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    if (GameContext.dungeon1Arena.active && entity instanceof Enemy) return;
    if (GameContext.dungeon1Arena.active) {
        const dx = entity.pos.x - GameContext.dungeon1Arena.x;
        const dy = entity.pos.y - GameContext.dungeon1Arena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > GameContext.dungeon1Arena.radius) {
            if (entity === GameContext.player) {
                if (Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
                    if (GameContext.player.invulnerable <= 0) {
                        GameContext.player.hp -= 1;
                        if (_playSound) _playSound('hit');
                        if (_updateHealthUI) _updateHealthUI();
                        if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, '#f80');
                        if (_showOverlayMessage) _showOverlayMessage("DUNGEON BOUNDARY", '#f80', 1000);
                        if (GameContext.player.hp <= 0) {
                            if (_killPlayer) _killPlayer();
                            else GameContext.player.dead = true;
                        }
                    }
                    GameContext.player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = GameContext.dungeon1Arena.x + Math.cos(angle) * GameContext.dungeon1Arena.radius;
            entity.pos.y = GameContext.dungeon1Arena.y + Math.sin(angle) * GameContext.dungeon1Arena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }
}

/**
 * @param {Object} bullet
 * @returns {Object|null}
 */
export function checkBulletWallCollision(bullet) {
    if (GameContext.warpZone && GameContext.warpZone.active && typeof GameContext.warpZone.bulletHitsWall === 'function') {
        if (GameContext.warpZone.bulletHitsWall(bullet)) return { kind: 'warp_wall', obj: null };
    }
    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && typeof GameContext.caveLevel.bulletHitsWall === 'function') {
        if (GameContext.caveLevel.bulletHitsWall(bullet)) return { kind: 'cave_wall', obj: null };
    }
    if (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies) {
        const az = GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id && typeof a.bulletHitsWall === 'function');
        if (az) {
            const dA = Math.hypot(bullet.pos.x - az.pos.x, bullet.pos.y - az.pos.y);
            if (dA < az.radius + 900 && az.bulletHitsWall(bullet)) return { kind: 'anomaly_wall', obj: null };
        }
    }
    const nearby = GameContext.asteroidGrid.query(bullet.pos.x, bullet.pos.y);
    for (let ast of nearby) {
        if (ast.dead) continue;
        const dx = bullet.pos.x - ast.pos.x;
        const dy = bullet.pos.y - ast.pos.y;
        const distSq = dx * dx + dy * dy;
        const rad = ast.radius + bullet.radius;
        if (distSq < rad * rad) {
            return { kind: 'asteroid', obj: ast };
        }
    }
    return null;
}

/**
 * @returns {void}
 */
export function resolveEntityCollision() {
    const allEntities = [GameContext.player, ...GameContext.enemies, ...GameContext.pinwheels, ...GameContext.cavePinwheels, ...(GameContext.contractEntities.fortresses || [])].filter(e => e && !e.dead);
    if (GameContext.destroyer && !GameContext.destroyer.dead) allEntities.push(GameContext.destroyer);
    if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) allEntities.push(GameContext.boss);

    const activeAnomalyZone = (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.contractEntities && GameContext.contractEntities.anomalies)
        ? GameContext.contractEntities.anomalies.find(a => a && !a.dead && a.contractId === GameContext.activeContract.id)
        : null;

    const activeCave = (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) ? GameContext.caveLevel : null;

    for (let i = 0; i < allEntities.length; i++) {
        for (let j = i + 1; j < allEntities.length; j++) {
            const e1 = allEntities[i];
            const e2 = allEntities[j];

            if ((e1 instanceof Pinwheel && e2 instanceof Enemy) || (e2 instanceof Pinwheel && e1 instanceof Enemy)) {
                continue;
            }
            // Dungeon bosses only collide with player, skip dungeon boss vs other enemies
            if (e1.isDungeonBoss && e2 !== GameContext.player) continue;
            if (e2.isDungeonBoss && e1 !== GameContext.player) continue;
            // Warp boss only collides with player, skip warp boss vs other enemies
            if (e1.isWarpBoss && e2 !== GameContext.player) continue;
            if (e2.isWarpBoss && e1 !== GameContext.player) continue;
            // Destroyer only collides with player, skip destroyer vs other enemies
            if ((e1 instanceof Destroyer || e1 instanceof Destroyer2) && e2 !== GameContext.player) continue;
            if ((e2 instanceof Destroyer || e2 instanceof Destroyer2) && e1 !== GameContext.player) continue;
            // Cave bosses only collide with player, skip cave boss vs other enemies
            if (e1.isCaveBoss && e2 !== GameContext.player) continue;
            if (e2.isCaveBoss && e1 !== GameContext.player) continue;

            let r1 = (e1 instanceof Destroyer || e1 instanceof Destroyer2) ? (e1.shieldRadius || e1.radius) : e1.radius;
            let r2 = (e2 instanceof Destroyer || e2 instanceof Destroyer2) ? (e2.shieldRadius || e2.radius) : e2.radius;
            if (e1.isWarpBoss) r1 = e1.shieldRadius || e1.radius;
            if (e2.isWarpBoss) r2 = e2.shieldRadius || e2.radius;
            if (e1.isDungeonBoss) r1 = e1.shieldRadius || e1.radius;
            if (e2.isDungeonBoss) r2 = e2.shieldRadius || e2.radius;
            if (e1.isCaveBoss) r1 = e1.shieldRadius || e1.radius;
            if (e2.isCaveBoss) r2 = e2.shieldRadius || e2.radius;
            // Cruiser uses shield radius if shields are up, otherwise hull radius
            if (e1 instanceof Cruiser) r1 = (e1.shieldSegments && e1.shieldSegments.some(s => s > 0)) ? e1.shieldRadius : e1.radius;
            if (e2 instanceof Cruiser) r2 = (e2.shieldSegments && e2.shieldSegments.some(s => s > 0)) ? e2.shieldRadius : e2.radius;

            const isStatic1 = (e1 instanceof Pinwheel) || (e1 instanceof SpaceStation) || e1.isDungeonBoss || e1.isCaveBoss;
            const isStatic2 = (e2 instanceof Pinwheel) || (e2 instanceof SpaceStation) || e2.isDungeonBoss || e2.isCaveBoss;
            const e1IsDestroyer = (e1 instanceof Destroyer || e1 instanceof Destroyer2);
            const e2IsDestroyer = (e2 instanceof Destroyer || e2 instanceof Destroyer2);

            if (isStatic1 && e1.shieldSegments && e1.shieldSegments.some(s => s > 0)) r1 = e1.shieldRadius;
            if (isStatic2 && e2.shieldSegments && e2.shieldSegments.some(s => s > 0)) r2 = e2.shieldRadius;

            const dx = e2.pos.x - e1.pos.x;
            const dy = e2.pos.y - e1.pos.y;
            const distSq = dx * dx + dy * dy;
            const minDist = r1 + r2;
            if (distSq < minDist * minDist && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const push = overlap * 0.5;

                if ((e1IsDestroyer && e2 instanceof Pinwheel) || (e2IsDestroyer && e1 instanceof Pinwheel)) {
                    if (e1IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                    else { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                } else if (isStatic1) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (isStatic2) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else if (e1IsDestroyer && !e2IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (e2IsDestroyer && !e1IsDestroyer) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else {
                    e1.pos.x -= nx * push; e1.pos.y -= ny * push;
                    e2.pos.x += nx * push; e2.pos.y += ny * push;
                }

                if (e1 instanceof Pinwheel) e1.aggro = true;
                if (e2 instanceof Pinwheel) e2.aggro = true;
            }
        }
    }

    if (GameContext.bossActive && GameContext.boss && GameContext.boss.isWarpBoss && !GameContext.boss.dead) {
        // Warp boss only collides with player, other ships can fly through
        if (GameContext.player && !GameContext.player.dead) {
            const entity = GameContext.player;
            const dx = entity.pos.x - GameContext.boss.pos.x;
            const dy = entity.pos.y - GameContext.boss.pos.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const barrierRadius = GameContext.boss.shieldRadius;
            const minDist = barrierRadius + entity.radius;
            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const nx = Math.cos(angle);
                const ny = Math.sin(angle);
                entity.pos.x = GameContext.boss.pos.x + nx * minDist;
                entity.pos.y = GameContext.boss.pos.y + ny * minDist;
                const dot = entity.vel.x * nx + entity.vel.y * ny;
                if (dot < 0) {
                    entity.vel.x -= nx * dot * 1.2;
                    entity.vel.y -= ny * dot * 1.2;
                }
                const now = Date.now();
                if (!GameContext.player.lastWarpBossBlockAt || now - GameContext.player.lastWarpBossBlockAt > 200) {
                    if (_spawnParticles) _spawnParticles((GameContext.player.pos.x + GameContext.boss.pos.x) / 2, (GameContext.player.pos.y + GameContext.boss.pos.y) / 2, 5, '#0ff');
                    if (_playSound) _playSound('shield_hit');
                    GameContext.player.lastWarpBossBlockAt = now;
                }
            }
        }
    }

    const damageable = [GameContext.player, ...GameContext.enemies, ...GameContext.pinwheels, ...GameContext.cavePinwheels, ...(GameContext.contractEntities.fortresses || [])];
    if (GameContext.boss && GameContext.bossActive && !GameContext.boss.dead) damageable.push(GameContext.boss);
    if (GameContext.destroyer && !GameContext.destroyer.dead) damageable.push(GameContext.destroyer);

    for (let entity of damageable) {
        if (entity.dead) continue;
        const nearbyAsteroids = GameContext.asteroidGrid.query(entity.pos.x, entity.pos.y);
        for (let ast of nearbyAsteroids) {
            if (ast.dead) continue;
            const dx = entity.pos.x - ast.pos.x;
            const dy = entity.pos.y - ast.pos.y;
            const distSq = dx * dx + dy * dy;
            const entityRadius = (entity instanceof Destroyer || entity instanceof Destroyer2) ? (entity.shieldRadius || entity.radius) : entity.radius;
            const minDist = entityRadius + ast.radius;
            const isIndestructibleWall = !!ast.unbreakable;

            if (distSq < minDist * minDist) {
                let dist = Math.sqrt(distSq);
                if (dist < 0.001) dist = 0.001;
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const isCrasher = (entity instanceof Pinwheel) ||
                    (entity instanceof Cruiser) ||
                    (entity instanceof Enemy && (
                        entity.isGunboat ||
                        entity.type === 'roamer' ||
                        entity.type === 'elite_roamer' ||
                        entity.type === 'hunter' ||
                        entity.type === 'defender'
                    ));
                const isDestroyer = (entity instanceof Destroyer || entity instanceof Destroyer2);

                let validCollision = false;

                if (isDestroyer && isIndestructibleWall) {
                    if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    continue;
                }

                if (!isIndestructibleWall && isCrasher) {
                    ast.break();
                    if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    validCollision = true;
                }

                if (validCollision) {
                    entity.pos.x += nx * overlap;
                    entity.pos.y += ny * overlap;

                    if (entity !== GameContext.player) {
                        entity.vel.x += nx * 1;
                        entity.vel.y += ny * 1;
                    }
                }

                if (entity === GameContext.player) {
                    const vn = GameContext.player.vel.x * nx + GameContext.player.vel.y * ny;
                    if (vn < 0) {
                        const restitution = 1.0;
                        GameContext.player.vel.x -= nx * vn * (1 + restitution);
                        GameContext.player.vel.y -= ny * vn * (1 + restitution);
                    }
                    const outwardKick = isIndestructibleWall ? Math.min(4, overlap * 0.08) : Math.min(10, 3 + overlap * 0.12);
                    GameContext.player.vel.x += nx * outwardKick;
                    GameContext.player.vel.y += ny * outwardKick;
                    GameContext.player.vel.mult(0.98);
                    GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, isIndestructibleWall ? 3 : 6);
                    GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 10);

                    if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
                        if (GameContext.player.invincibilityOnHit > 0) {
                        }

                        if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
                            const asteroidDamage = GameContext.sectorIndex >= 2 ? 2 : 1;
                            GameContext.player.takeHit(asteroidDamage);
                            GameContext.player.lastAsteroidHitTime = Date.now();
                            if (!isIndestructibleWall) {
                                ast.break();
                                if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 8, '#aa8');
                                if (_playSound) _playSound('hit');
                            } else {
                                if (_spawnParticles) _spawnParticles(GameContext.player.pos.x - nx * GameContext.player.radius, GameContext.player.pos.y - ny * GameContext.player.radius, 6, '#08f');
                                if (_playSound) _playSound('hit');
                            }
                        }
                    }
                }
            }
        }
    }

    if (GameContext.player && !GameContext.player.dead) {
        for (let e of GameContext.enemies) {
            if (e.dead) continue;
            const isRoamer = (e.type === 'roamer' || e.type === 'elite_roamer');
            const isDefender = (e.type === 'defender');
            const isHunter = (e.type === 'hunter');

            if (isRoamer || isDefender || isHunter) {
                const dist = Math.hypot(GameContext.player.pos.x - e.pos.x, GameContext.player.pos.y - e.pos.y);
                if (dist < GameContext.player.radius + e.radius) {
                    if (isRoamer || isDefender) {
                        const angle = Math.atan2(GameContext.player.pos.y - e.pos.y, GameContext.player.pos.x - e.pos.x);
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);

                        const pushForce = 5;
                        GameContext.player.vel.x += nx * pushForce;
                        GameContext.player.vel.y += ny * pushForce;
                        e.vel.x -= nx * pushForce;
                        e.vel.y -= ny * pushForce;

                        if (_spawnParticles) _spawnParticles((GameContext.player.pos.x + e.pos.x) / 2, (GameContext.player.pos.y + e.pos.y) / 2, 5, '#fff');
                        continue;
                    }

                    const ramDamage = Math.max(0, Math.ceil(e.hp));
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 20, '#f44');
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 15, '#ff0');
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 10, '#0ff');
                    e.kill();
                    if (_playSound) _playSound('hit');

                    GameContext.player.takeHit(ramDamage);
                }
            }

            if (e.isDungeonBoss) {
                const dist = Math.hypot(GameContext.player.pos.x - e.pos.x, GameContext.player.pos.y - e.pos.y);
                // Player collides with dungeon boss at outer shield radius
                const collisionRadius = e.shieldRadius || e.radius;
                if (dist < GameContext.player.radius + collisionRadius) {
                    // Positional collision handled in main loop, only apply damage/effects here
                    const ramDamage = 3 + Math.floor(GameContext.sectorIndex * 0.5);
                    GameContext.player.takeHit(ramDamage);

                    if (_spawnParticles) _spawnParticles((GameContext.player.pos.x + e.pos.x) / 2, (GameContext.player.pos.y + e.pos.y) / 2, 12, '#f44');
                    if (_playSound) _playSound('hit');
                }
            }
        }

        // Check collision with Cruiser boss (stored in GameContext.boss)
        if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead && GameContext.boss instanceof Cruiser) {
            const dist = Math.hypot(GameContext.player.pos.x - GameContext.boss.pos.x, GameContext.player.pos.y - GameContext.boss.pos.y);
            // Use shield radius if shields are up, otherwise use hull radius
            const collisionRadius = (GameContext.boss.shieldSegments && GameContext.boss.shieldSegments.some(s => s > 0)) 
                ? GameContext.boss.shieldRadius 
                : GameContext.boss.radius;
            
            if (dist < GameContext.player.radius + collisionRadius) {
                // Positional collision handled in main loop, only apply damage/effects here
                const ramDamage = 5; // Fixed damage for ramming the Cruiser
                GameContext.player.takeHit(ramDamage);

                if (_spawnParticles) _spawnParticles((GameContext.player.pos.x + GameContext.boss.pos.x) / 2, (GameContext.player.pos.y + GameContext.boss.pos.y) / 2, 15, '#f44');
                if (_playSound) _playSound('hit');
            }
        }

        for (let c of GameContext.coins) {
            if (c.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - c.pos.x, GameContext.player.pos.y - c.pos.y);
            if (dist < GameContext.player.radius + c.radius) {
                if (_playSound) _playSound('coin');
                GameContext.score += c.value;
                GameContext.player.addXp(c.value);
                if (_addPickupFloatingText) _addPickupFloatingText('gold', c.value, '#ff0');

                if (GameContext.player.stats.reactiveShield && GameContext.player.stats.reactiveShield > 0) {
                    if (!GameContext.player.reactiveShieldCoins) GameContext.player.reactiveShieldCoins = 0;
                    GameContext.player.reactiveShieldCoins += c.value;

                    while (GameContext.player.reactiveShieldCoins >= 50) {
                        GameContext.player.reactiveShieldCoins -= 50;
                        const restoreAmount = GameContext.player.stats.reactiveShield;
                        const innerShieldMaxHp = GameContext.player.stats.reactiveShieldBonusHp ? 3 : 2;

                        for (let i = 0; i < restoreAmount && GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0; i++) {
                            const idx = GameContext.player.outerShieldSegments.findIndex(s => s <= 0);
                            if (idx !== -1) {
                                GameContext.player.outerShieldSegments[idx] = 1;
                                GameContext.player.shieldsDirty = true;
                            } else {
                                const innerIdx = GameContext.player.shieldSegments.findIndex(s => s < innerShieldMaxHp);
                                if (innerIdx !== -1) {
                                    GameContext.player.shieldSegments[innerIdx] = Math.min(innerShieldMaxHp, GameContext.player.shieldSegments[innerIdx] + 1);
                                    GameContext.player.shieldsDirty = true;
                                }
                            }
                        }
                        if (restoreAmount > 0 && GameContext.player.shieldSegments) {
                            for (let i = 0; i < restoreAmount; i++) {
                                const innerIdx = GameContext.player.shieldSegments.findIndex(s => s < innerShieldMaxHp);
                                if (innerIdx !== -1) {
                                    GameContext.player.shieldSegments[innerIdx] = Math.min(innerShieldMaxHp, GameContext.player.shieldSegments[innerIdx] + 1);
                                    GameContext.player.shieldsDirty = true;
                                }
                            }
                        }
                    }
                }

                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        for (let n of GameContext.nuggets) {
            if (n.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - n.pos.x, GameContext.player.pos.y - n.pos.y);
            if (dist < GameContext.player.radius + n.radius) {
                if (_playSound) _playSound('coin');
                GameContext.spaceNuggets += n.value;
                if (_updateNuggetUI) _updateNuggetUI();
                if (_addPickupFloatingText) _addPickupFloatingText('nugs', n.value, '#ff0');
                if (typeof n.kill === 'function') n.kill();
                else n.dead = true;
            }
        }

        for (let p of GameContext.powerups) {
            if (p.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - p.pos.x, GameContext.player.pos.y - p.pos.y);
            if (dist < GameContext.player.radius + p.radius) {
                if (_playSound) _playSound('powerup');
                GameContext.player.hp = Math.min(GameContext.player.hp + 10, GameContext.player.maxHp);
                if (_updateHealthUI) _updateHealthUI();
                if (_showOverlayMessage) _showOverlayMessage("HEALTH RESTORED", '#0f0', 1000);
                if (typeof p.kill === 'function') p.kill();
                else p.dead = true;
            }
        }

        for (let c of GameContext.caches) {
            if (c.dead) continue;
            const dist = Math.hypot(GameContext.player.pos.x - c.pos.x, GameContext.player.pos.y - c.pos.y);
            if (dist < GameContext.player.radius + c.radius) {
                if (_playSound) _playSound('coin');
                GameContext.spaceNuggets += c.value;
                if (_updateNuggetUI) _updateNuggetUI();
                if (_addPickupFloatingText) _addPickupFloatingText('nugs', c.value, '#ff0');
                if (_showOverlayMessage) _showOverlayMessage(`CACHE +${c.value} NUGS`, '#ff0', 800);

                if (GameContext.activeContract && GameContext.activeContract.type === 'anomaly' && GameContext.activeContract.id && c.contractId === GameContext.activeContract.id) {
                    if (!GameContext.activeContract.coreCollected) {
                        GameContext.activeContract.coreCollected = true;
                        if (_showOverlayMessage) _showOverlayMessage("CORE ACQUIRED - ESCAPE ANOMALY", '#0f0', 2000);
                        if (_updateContractUI) _updateContractUI();
                    }
                }
                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        // Check collision with cave wall turrets
        if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.wallTurrets) {
            for (let t of GameContext.caveLevel.wallTurrets) {
                if (!t || t.dead) continue;
                const dist = Math.hypot(GameContext.player.pos.x - t.pos.x, GameContext.player.pos.y - t.pos.y);
                const collisionRadius = t.outerShieldRadius || t.radius;
                if (dist < GameContext.player.radius + collisionRadius) {
                    // Push player back and apply damage
                    const angle = Math.atan2(GameContext.player.pos.y - t.pos.y, GameContext.player.pos.x - t.pos.x);
                    GameContext.player.vel.x += Math.cos(angle) * 2;
                    GameContext.player.vel.y += Math.sin(angle) * 2;
                    GameContext.player.takeHit(2);
                    if (_updateHealthUI) _updateHealthUI();
                    if (_playSound) _playSound('hit');
                    if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, '#f00');
                }
            }
        }

        for (let s of GameContext.shootingStars) {
            if (s.dead) continue;

            if (GameContext.player && !GameContext.player.dead && !GameContext.player.invulnerable) {
                const dist = Math.hypot(s.pos.x - GameContext.player.pos.x, s.pos.y - GameContext.player.pos.y);
                if (dist < s.radius + GameContext.player.radius) {
                    GameContext.player.takeHit(s.damage);
                    if (_updateHealthUI) _updateHealthUI();
                    if (_playSound) _playSound('explode');
                    if (_spawnParticles) _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 20, '#f00');
                    if (_showOverlayMessage) _showOverlayMessage("HIT BY SHOOTING STAR!", '#f00', 2000);
                    s.dead = true;
                    if (GameContext.player.hp <= 0) {
                        if (_killPlayer) _killPlayer();
                        else GameContext.player.dead = true;
                    }
                    continue;
                }
            }

            let hitEntity = false;
            for (let e of GameContext.enemies) {
                if (!e || e.dead) continue;
                const dist = Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y);
                if (dist < s.radius + e.radius) {
                    e.hp -= s.damage;
                    if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 14, '#fa0');
                    if (_playSound) _playSound('explode');
                    if (e.hp <= 0) e.kill();
                    hitEntity = true;
                    break;
                }
            }
            if (!hitEntity) {
                for (let b of GameContext.pinwheels) {
                    if (!b || b.dead) continue;
                    const dist = Math.hypot(s.pos.x - b.pos.x, s.pos.y - b.pos.y);
                    if (dist < s.radius + b.radius) {
                        b.hp -= s.damage;
                        b.aggro = true;
                        if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 18, '#fa0');
                        if (_playSound) _playSound('explode');
                        if (b.hp <= 0) {
                            b.dead = true;
                            if (_playSound) _playSound('base_explode');
                            if (_spawnLargeExplosion) _spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
                            // Award coins directly: 6 coins * 5 value = 30 total
                            if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: 'coin' });
                            // Award nugget directly
                            if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: 'coin' });
                            GameContext.pinwheelsDestroyed++;
                            GameContext.pinwheelsDestroyedTotal++;
                            GameContext.difficultyTier = 1 + Math.floor(GameContext.pinwheelsDestroyedTotal / 6);
                            GameContext.score += 1000;
                            const baseEl = document.getElementById('bases-display');
                            if (baseEl) baseEl.innerText = `${GameContext.pinwheelsDestroyedTotal}`;
                            GameContext.enemies.forEach(e => { if (e.assignedBase === b) e.type = 'roamer'; });
                            const delay = 5000 + Math.random() * 5000;
                            GameContext.baseRespawnTimers.push(Date.now() + delay);
                        }
                        hitEntity = true;
                        break;
                    }
                }
            }
            if (!hitEntity) {
                for (let b of GameContext.cavePinwheels) {
                    if (!b || b.dead) continue;
                    const dist = Math.hypot(s.pos.x - b.pos.x, s.pos.y - b.pos.y);
                    if (dist < s.radius + b.radius) {
                        b.hp -= s.damage;
                        b.aggro = true;
                        if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 18, '#fa0');
                        if (_playSound) _playSound('explode');
                        if (b.hp <= 0) {
                            b.dead = true;
                            if (_playSound) _playSound('base_explode');
                            if (_spawnLargeExplosion) _spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
                            // Award coins directly: 6 coins * 5 value = 30 total
                            if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: 'coin' });
                            // Award nugget directly
                            if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: 'coin' });
                            GameContext.pinwheelsDestroyed++;
                            GameContext.pinwheelsDestroyedTotal++;
                            GameContext.difficultyTier = 1 + Math.floor(GameContext.pinwheelsDestroyedTotal / 6);
                            GameContext.score += 1000;
                            const baseEl = document.getElementById('bases-display');
                            if (baseEl) baseEl.innerText = `${GameContext.pinwheelsDestroyedTotal}`;
                            GameContext.enemies.forEach(e => { if (e.assignedBase === b) e.type = 'roamer'; });
                            const delay = 5000 + Math.random() * 5000;
                            GameContext.baseRespawnTimers.push(Date.now() + delay);
                        }
                        hitEntity = true;
                        break;
                    }
                }
            }
            if (!hitEntity && GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) {
                // Skip ship-boss collision for cave bosses - enemies can fly through them
                if (!GameContext.boss.isCaveBoss && typeof GameContext.boss.hitTestCircle === 'function' && GameContext.boss.hitTestCircle(s.pos.x, s.pos.y, s.radius)) {
                    if (!(GameContext.boss.isWarpBoss && GameContext.boss.ramInvulnerable > 0)) {
                        GameContext.boss.hp -= s.damage;
                        if (_spawnParticles) _spawnParticles(GameContext.boss.pos.x, GameContext.boss.pos.y, 22, '#fa0');
                        if (_playSound) _playSound('explode');
                        if (GameContext.boss.hp <= 0) {
                            GameContext.boss.kill();
                            GameContext.score += 10000;
                        }
                    }
                    hitEntity = true;
                }
            }
            if (!hitEntity && GameContext.spaceStation) {
                const dist = Math.hypot(s.pos.x - GameContext.spaceStation.pos.x, s.pos.y - GameContext.spaceStation.pos.y);
                if (dist < s.radius + GameContext.spaceStation.radius) {
                    GameContext.spaceStation.hp -= s.damage;
                    if (_spawnParticles) _spawnParticles(GameContext.spaceStation.pos.x, GameContext.spaceStation.pos.y, 22, '#fa0');
                    if (_playSound) _playSound('explode');
                    if (GameContext.spaceStation.hp <= 0) {
                        if (_handleSpaceStationDestroyed) _handleSpaceStationDestroyed();
                    }
                    hitEntity = true;
                }
            }
            if (hitEntity) {
                s.dead = true;
                continue;
            }

            const nearby = GameContext.asteroidGrid.query(s.pos.x, s.pos.y);
            for (let ast of nearby) {
                if (ast.dead) continue;
                const dist = Math.hypot(s.pos.x - ast.pos.x, s.pos.y - ast.pos.y);
                if (dist < s.radius + ast.radius) {
                    ast.break(true);
                    if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, '#fa0');
                }
            }
        }
    }
}

/**
 * @returns {void}
 */
export function processBulletCollisions() {
    if (_setProjectileImpactSoundContext) _setProjectileImpactSoundContext(true);
    try {
        for (let i = GameContext.bullets.length - 1; i >= 0; i--) {
            const b = GameContext.bullets[i];
            let hit = false;
            const astCol = checkBulletWallCollision(b);
            if (astCol) {
                hit = true;
                b.dead = true;
                if (astCol.obj) {
                    astCol.obj.break();
                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 8, '#aa8');
                    if (_playSound) _playSound('hit');
                } else {
                    const wallColor = (astCol.kind === 'anomaly_wall') ? '#0f0' : (astCol.kind === 'cave_wall' ? '#88f' : '#0ff');
                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 6, wallColor);
                    if (_playSound) _playSound('hit');
                }
            }

            if (!hit) {
                if (b.isEnemy) {
                    if (!GameContext.player.dead && GameContext.player.invulnerable <= 0) {
                        const dx = b.pos.x - GameContext.player.pos.x;
                        const dy = b.pos.y - GameContext.player.pos.y;
                        const distSq = dx * dx + dy * dy;
                        const dist = Math.sqrt(distSq);

                        if (!hit && GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.some(s => s > 0) &&
                            dist < GameContext.player.outerShieldRadius + b.radius * 1.5 && dist > GameContext.player.outerShieldRadius - b.radius * 2) {
                            let angle = Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) - GameContext.player.outerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.player.outerShieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.player.outerShieldSegments[segIndex] > 0) {
                                const segmentHp = GameContext.player.outerShieldSegments[segIndex];
                                if (b.damage > segmentHp) {
                                    GameContext.player.outerShieldSegments[segIndex] = 0;
                                } else {
                                    GameContext.player.outerShieldSegments[segIndex] -= b.damage;
                                }
                                GameContext.player.shieldsDirty = true;
                                hit = true;
                                if (_playSound) _playSound('shield_hit');
                                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 7, '#b0f');
                            }
                        }
                        if (!hit && dist < GameContext.player.shieldRadius + b.radius * 1.5 && dist > GameContext.player.shieldRadius - b.radius * 2) {
                            let angle = Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) - GameContext.player.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.player.shieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.player.shieldSegments[segIndex] > 0) {
                                const segmentHp = GameContext.player.shieldSegments[segIndex];
                                if (b.damage > segmentHp) {
                                    GameContext.player.shieldSegments[segIndex] = 0;
                                } else {
                                    GameContext.player.shieldSegments[segIndex] -= b.damage;
                                }
                                GameContext.player.shieldsDirty = true;
                                hit = true;
                                if (_playSound) _playSound('shield_hit');
                                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                            }
                        }
                        const hitDist = GameContext.player.radius * 1.5 + b.radius * 1.5;
                        if (!hit && distSq < hitDist * hitDist) {
                            const damage = b.directHitDamage !== undefined ? b.directHitDamage : b.damage;
                            GameContext.player.takeHit(damage, true);
                            hit = true;
                        }
                    }
                }
                else {
                    for (let mi = 0, mlen = GameContext.guidedMissiles.length; mi < mlen; mi++) {
                        const m = GameContext.guidedMissiles[mi];
                        if (!m || m.dead) continue;
                        const dx = b.pos.x - m.pos.x;
                        const dy = b.pos.y - m.pos.y;
                        const hitRad = (m.radius || 0) + (b.radius || 0);
                        if (dx * dx + dy * dy < hitRad * hitRad) {
                            if (typeof m.takeHit === 'function') m.takeHit(b.damage);
                            else if (typeof m.explode === 'function') m.explode('#ff0');
                            else m.dead = true;
                            hit = true;
                            b.dead = true;
                            break;
                        }
                    }

                    if (hit) continue;
                    const nearby = GameContext.targetGrid.query(b.pos.x, b.pos.y, 250);
                    for (let e of nearby) {
                        if (e.dead) continue;
                        if (hit) break;

                        if (e && e.isShootingStar) {
                            if (b.isEnemy) continue;
                            const dx = b.pos.x - e.pos.x;
                            const dy = b.pos.y - e.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const hitRadius = e.radius + b.radius;
                            if (distSq < hitRadius * hitRadius) {
                                e.takeHit(b.damage);
                                hit = true;
                                b.dead = true;
                                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 4, '#fff');
                                break;
                            }
                        }
                        if (e instanceof Enemy) {
                            if (GameContext.bossActive && GameContext.boss && e === GameContext.boss) continue;

                            const dx = b.pos.x - e.pos.x;
                            const dy = b.pos.y - e.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const dist = Math.sqrt(distSq);

                            // Check shields: shields protect the hull, so if bullet is within shield radius and shield is active, block it
                            // Check outer shield first (if bullet is within outer shield radius)
                            if (!b.ignoreShields && e.shieldSegments && e.shieldSegments.length > 0 && dist < e.shieldRadius + b.radius) {
                                // Find the shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const segCount = e.shieldSegments.length;
                                const segAngle = (Math.PI * 2) / segCount;
                                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;
                                
                                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                                const innerShieldOuterEdge = e.innerShieldSegments && e.innerShieldSegments.length > 0 
                                    ? e.innerShieldRadius + b.radius 
                                    : e.radius + b.radius;
                                
                                if (dist > innerShieldOuterEdge && e.shieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.shieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.shieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.shieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                }
                            }
                            // Check inner shield (if bullet is within inner shield radius but outside hull)
                            if (!hit && !b.ignoreShields && e.innerShieldSegments && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + b.radius && dist > e.radius + b.radius) {
                                // Find the inner shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const innerCount = e.innerShieldSegments.length;
                                const innerAngle = (Math.PI * 2) / innerCount;
                                const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;
                                
                                if (e.innerShieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.innerShieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.innerShieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.innerShieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                }
                            }
                            // Also check if bullet is inside hull but would pass through active shields
                            // If there are active shields, they should block even bullets that are "inside" the hull visually
                            if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                                // Check if any shields are still active - if so, they should block
                                const hasActiveOuter = e.shieldSegments && e.shieldSegments.length > 0 && e.shieldSegments.some(s => s > 0);
                                const hasActiveInner = e.innerShieldSegments && e.innerShieldSegments.length > 0 && e.innerShieldSegments.some(s => s > 0);
                                
                                if (hasActiveOuter || hasActiveInner) {
                                    // Bullet is inside hull radius but shields are still up - check which shield should block
                                    const angle = Math.atan2(dy, dx);
                                    
                                    // Check inner shield first (closer to hull)
                                    if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const innerCount = e.innerShieldSegments.length;
                                        const innerAngle = (Math.PI * 2) / innerCount;
                                        const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;
                                        
                                        if (e.innerShieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.innerShieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.innerShieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.innerShieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                        }
                                    }
                                    
                                    // If inner didn't block, check outer shield
                                    if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const segCount = e.shieldSegments.length;
                                        const segAngle = (Math.PI * 2) / segCount;
                                        const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;
                                        
                                        if (e.shieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.shieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.shieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.shieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                        }
                                    }
                                }
                            }

                            const hitRadius = e.radius + b.radius;
                            if (!hit && distSq < hitRadius * hitRadius) {
                                e.hp -= b.damage;
                                hit = true;
                                if (_playSound) _playSound('hit');
                                if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, '#fff');

                                if (GameContext.player.chainLightningCount && GameContext.player.chainLightningCount > 0 && GameContext.player.chainLightningRange && !b.isEnemy) {
                                    let chainCount = GameContext.player.chainLightningCount;
                                    let chainSource = e;
                                    let chainTargets = new Set();
                                    chainTargets.add(e);

                                    for (let chain = 0; chain < chainCount; chain++) {
                                        let nearestTarget = null;
                                        let nearestDist = GameContext.player.chainLightningRange;

                                        for (let other of nearby) {
                                            if (other.dead) continue;
                                            const isEnemy = other instanceof Enemy;
                                            const isPinwheel = other instanceof Pinwheel;
                                            const isCavePinwheel = other instanceof CavePinwheel1 || other instanceof CavePinwheel2 || other instanceof CavePinwheel3;
                                            if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                                            if (other === GameContext.boss) continue;
                                            if (chainTargets.has(other)) continue;

                                            const d = Math.hypot(other.pos.x - chainSource.pos.x, other.pos.y - chainSource.pos.y);
                                            if (d < nearestDist) {
                                                nearestDist = d;
                                                nearestTarget = other;
                                            }
                                        }

                                        if (nearestTarget) {
                                            const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                                            if (nearestTarget === GameContext.destroyer) {
                                                const hpBefore = nearestTarget.hp;
                                                nearestTarget.hp -= chainDamage;
                                                console.log(`[DESTROYER DEBUG] CHAIN LIGHTNING: ${chainDamage.toFixed(1)} damage | HP: ${hpBefore} -> ${nearestTarget.hp} | Chain: ${chain + 1}`);
                                            } else {
                                                nearestTarget.hp -= chainDamage;
                                            }
                                            chainTargets.add(nearestTarget);

                                            if (_spawnLightningArc) _spawnLightningArc(chainSource.pos.x, chainSource.pos.y, nearestTarget.pos.x, nearestTarget.pos.y, '#0ff');
                                            if (_spawnParticles) _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, '#0ff');
                                            if (_playSound) _playSound('hit');

                                            if (nearestTarget.hp <= 0) {
                                                nearestTarget.kill();
                                                GameContext.score += 100;
                                            }

                                            chainSource = nearestTarget;
                                        } else {
                                            break;
                                        }
                                    }
                                }

                                if (e.hp <= 0) {
                                    e.kill();
                                    GameContext.score += 100;
                                }
                                break;
                            }
                        }
                        if (e instanceof Pinwheel) {
                            if (b.isEnemy) continue;
                            const dx = b.pos.x - e.pos.x;
                            const dy = b.pos.y - e.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const dist = Math.sqrt(distSq);
                            
                            // Check shields: shields protect the hull, so if bullet is within shield radius and shield is active, block it
                            // Check outer shield first (if bullet is within outer shield radius)
                            if (!b.ignoreShields && e.shieldSegments && e.shieldSegments.length > 0 && dist < e.shieldRadius + b.radius) {
                                // Find the shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const segCount = e.shieldSegments.length;
                                const segAngle = (Math.PI * 2) / segCount;
                                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;
                                
                                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                                const innerShieldOuterEdge = e.innerShieldSegments && e.innerShieldSegments.length > 0 
                                    ? e.innerShieldRadius + b.radius 
                                    : e.radius + b.radius;
                                
                                if (dist > innerShieldOuterEdge && e.shieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.shieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.shieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.shieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    e.aggro = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                }
                            }
                            // Check inner shield (if bullet is within inner shield radius but outside hull)
                            if (!hit && !b.ignoreShields && e.innerShieldSegments && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + b.radius && dist > e.radius + b.radius) {
                                // Find the inner shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const innerCount = e.innerShieldSegments.length;
                                const innerAngle = (Math.PI * 2) / innerCount;
                                const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;
                                
                                if (e.innerShieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.innerShieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.innerShieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.innerShieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    e.aggro = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                }
                            }
                            // Also check if bullet is inside hull but would pass through active shields
                            // If there are active shields, they should block even bullets that are "inside" the hull visually
                            if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                                // Check if any shields are still active - if so, they should block
                                const hasActiveOuter = e.shieldSegments && e.shieldSegments.length > 0 && e.shieldSegments.some(s => s > 0);
                                const hasActiveInner = e.innerShieldSegments && e.innerShieldSegments.length > 0 && e.innerShieldSegments.some(s => s > 0);
                                
                                if (hasActiveOuter || hasActiveInner) {
                                    // Bullet is inside hull radius but shields are still up - check which shield should block
                                    const angle = Math.atan2(dy, dx);
                                    
                                    // Check inner shield first (closer to hull)
                                    if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const innerCount = e.innerShieldSegments.length;
                                        const innerAngle = (Math.PI * 2) / innerCount;
                                        const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;
                                        
                                        if (e.innerShieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.innerShieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.innerShieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.innerShieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            e.aggro = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                        }
                                    }
                                    
                                    // If inner didn't block, check outer shield
                                    if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const segCount = e.shieldSegments.length;
                                        const segAngle = (Math.PI * 2) / segCount;
                                        const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;
                                        
                                        if (e.shieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.shieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.shieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.shieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            e.aggro = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                        }
                                    }
                                }
                            }
                            
                            const hitRadius = e.radius + b.radius;
                            if (!hit && distSq < hitRadius * hitRadius) {
                                e.hp -= b.damage;
                                hit = true;
                                e.aggro = true;
                                if (_playSound) _playSound('hit');
                                if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, '#fff');

                                if (GameContext.player.chainLightningCount && GameContext.player.chainLightningCount > 0 && GameContext.player.chainLightningRange && !b.isEnemy) {
                                    let chainCount = GameContext.player.chainLightningCount;
                                    let chainSource = e;
                                    let chainTargets = new Set();
                                    chainTargets.add(e);

                                    for (let chain = 0; chain < chainCount; chain++) {
                                        let nearestTarget = null;
                                        let nearestDist = GameContext.player.chainLightningRange;

                                        for (let other of nearby) {
                                            if (other.dead) continue;
                                            const isEnemy = other instanceof Enemy;
                                            const isPinwheel = other instanceof Pinwheel;
                                            const isCavePinwheel = other instanceof CavePinwheel1 || other instanceof CavePinwheel2 || other instanceof CavePinwheel3;
                                            if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                                            if (other === GameContext.boss) continue;
                                            if (chainTargets.has(other)) continue;

                                            const d = Math.hypot(other.pos.x - chainSource.pos.x, other.pos.y - chainSource.pos.y);
                                            if (d < nearestDist) {
                                                nearestDist = d;
                                                nearestTarget = other;
                                            }
                                        }

                                        if (nearestTarget) {
                                            const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                                            if (nearestTarget === GameContext.destroyer) {
                                                const hpBefore = nearestTarget.hp;
                                                nearestTarget.hp -= chainDamage;
                                                console.log(`[DESTROYER DEBUG] CHAIN LIGHTNING: ${chainDamage.toFixed(1)} damage | HP: ${hpBefore} -> ${nearestTarget.hp} | Chain: ${chain + 1}`);
                                            } else {
                                                nearestTarget.hp -= chainDamage;
                                            }
                                            chainTargets.add(nearestTarget);

                                            if (_spawnLightningArc) _spawnLightningArc(chainSource.pos.x, chainSource.pos.y, nearestTarget.pos.x, nearestTarget.pos.y, '#0ff');
                                            if (_spawnParticles) _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, '#0ff');
                                            if (_playSound) _playSound('hit');

                                            if (nearestTarget.hp <= 0) {
                                                nearestTarget.kill();
                                                GameContext.score += 100;
                                            }

                                            chainSource = nearestTarget;
                                        } else {
                                            break;
                                        }
                                    }
                                }

                                if (e.hp <= 0) {
                                    e.dead = true;
                                    if (_playSound) _playSound('base_explode');
                                    if (_spawnLargeExplosion) _spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);
                                    // Award coins directly: 6 coins * 5 value = 30 total
                                    if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: 'coin' });
                                    // Award nugget directly
                                    if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: 'coin' });
                                }
                                break;
                            }
                        }
                        // Cave Pinwheels (CavePinwheel1, CavePinwheel2, CavePinwheel3) - same collision logic as regular Pinwheels
                        if (e instanceof CavePinwheel1 || e instanceof CavePinwheel2 || e instanceof CavePinwheel3) {
                            if (b.isEnemy) continue;
                            const dx = b.pos.x - e.pos.x;
                            const dy = b.pos.y - e.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const dist = Math.sqrt(distSq);

                            // Check shields: shields protect the hull, so if bullet is within shield radius and shield is active, block it
                            // Check outer shield first (if bullet is within outer shield radius)
                            if (!b.ignoreShields && e.shieldSegments && e.shieldSegments.length > 0 && dist < e.shieldRadius + b.radius) {
                                // Find the shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const segCount = e.shieldSegments.length;
                                const segAngle = (Math.PI * 2) / segCount;
                                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;

                                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                                const innerShieldOuterEdge = e.innerShieldSegments && e.innerShieldSegments.length > 0
                                    ? e.innerShieldRadius + b.radius
                                    : e.radius + b.radius;

                                if (dist > innerShieldOuterEdge && e.shieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.shieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.shieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.shieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    e.aggro = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                }
                            }
                            // Check inner shield (if bullet is within inner shield radius but outside hull)
                            if (!hit && !b.ignoreShields && e.innerShieldSegments && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + b.radius && dist > e.radius + b.radius) {
                                // Find the inner shield segment based on angle
                                const angle = Math.atan2(dy, dx);
                                const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                const innerCount = e.innerShieldSegments.length;
                                const innerAngle = (Math.PI * 2) / innerCount;
                                const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;

                                if (e.innerShieldSegments[segmentIdx] > 0) {
                                    const segmentHp = e.innerShieldSegments[segmentIdx];
                                    if (b.damage >= segmentHp) {
                                        e.innerShieldSegments[segmentIdx] = 0;
                                    } else {
                                        e.innerShieldSegments[segmentIdx] -= b.damage;
                                    }
                                    e.shieldsDirty = true;
                                    hit = true;
                                    e.aggro = true;
                                    if (_playSound) _playSound('enemy_shield_hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                }
                            }
                            // Also check if bullet is inside hull but would pass through active shields
                            // If there are active shields, they should block even bullets that are "inside" the hull visually
                            if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                                // Check if any shields are still active - if so, they should block
                                const hasActiveOuter = e.shieldSegments && e.shieldSegments.length > 0 && e.shieldSegments.some(s => s > 0);
                                const hasActiveInner = e.innerShieldSegments && e.innerShieldSegments.length > 0 && e.innerShieldSegments.some(s => s > 0);

                                if (hasActiveOuter || hasActiveInner) {
                                    // Bullet is inside hull radius but shields are still up - check which shield should block
                                    const angle = Math.atan2(dy, dx);

                                    // Check inner shield first (closer to hull)
                                    if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const innerCount = e.innerShieldSegments.length;
                                        const innerAngle = (Math.PI * 2) / innerCount;
                                        const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;

                                        if (e.innerShieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.innerShieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.innerShieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.innerShieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            e.aggro = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                        }
                                    }

                                    // If inner didn't block, check outer shield
                                    if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                                        const normalizedAngle = (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                                        const segCount = e.shieldSegments.length;
                                        const segAngle = (Math.PI * 2) / segCount;
                                        const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;

                                        if (e.shieldSegments[segmentIdx] > 0) {
                                            const segmentHp = e.shieldSegments[segmentIdx];
                                            if (b.damage >= segmentHp) {
                                                e.shieldSegments[segmentIdx] = 0;
                                            } else {
                                                e.shieldSegments[segmentIdx] -= b.damage;
                                            }
                                            e.shieldsDirty = true;
                                            hit = true;
                                            e.aggro = true;
                                            if (_playSound) _playSound('enemy_shield_hit');
                                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                        }
                                    }
                                }
                            }

                            const hitRadius = e.radius + b.radius;
                            if (!hit && distSq < hitRadius * hitRadius) {
                                e.hp -= b.damage;
                                hit = true;
                                e.aggro = true;
                                if (_playSound) _playSound('hit');
                                if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, '#fff');

                                if (GameContext.player.chainLightningCount && GameContext.player.chainLightningCount > 0 && GameContext.player.chainLightningRange && !b.isEnemy) {
                                    let chainCount = GameContext.player.chainLightningCount;
                                    let chainSource = e;
                                    let chainTargets = new Set();
                                    chainTargets.add(e);

                                    for (let chain = 0; chain < chainCount; chain++) {
                                        let nearestTarget = null;
                                        let nearestDist = GameContext.player.chainLightningRange;

                                        for (let other of nearby) {
                                            if (other.dead) continue;
                                            const isEnemy = other instanceof Enemy;
                                            const isPinwheel = other instanceof Pinwheel;
                                            const isCavePinwheel = other instanceof CavePinwheel1 || other instanceof CavePinwheel2 || other instanceof CavePinwheel3;
                                            if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                                            if (other === GameContext.boss) continue;
                                            if (chainTargets.has(other)) continue;

                                            const d = Math.hypot(other.pos.x - chainSource.pos.x, other.pos.y - chainSource.pos.y);
                                            if (d < nearestDist) {
                                                nearestDist = d;
                                                nearestTarget = other;
                                            }
                                        }

                                        if (nearestTarget) {
                                            const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                                            if (nearestTarget === GameContext.destroyer) {
                                                const hpBefore = nearestTarget.hp;
                                                nearestTarget.hp -= chainDamage;
                                                console.log(`[DESTROYER DEBUG] CHAIN LIGHTNING: ${chainDamage.toFixed(1)} damage | HP: ${hpBefore} -> ${nearestTarget.hp} | Chain: ${chain + 1}`);
                                            } else {
                                                nearestTarget.hp -= chainDamage;
                                            }
                                            chainTargets.add(nearestTarget);

                                            if (_spawnLightningArc) _spawnLightningArc(chainSource.pos.x, chainSource.pos.y, nearestTarget.pos.x, nearestTarget.pos.y, '#0ff');
                                            if (_spawnParticles) _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, '#0ff');
                                            if (_playSound) _playSound('hit');

                                            if (nearestTarget.hp <= 0) {
                                                nearestTarget.kill();
                                                GameContext.score += 100;
                                            }

                                            chainSource = nearestTarget;
                                        } else {
                                            break;
                                        }
                                    }
                                }

                                if (e.hp <= 0) {
                                    e.dead = true;
                                    if (_playSound) _playSound('base_explode');
                                    if (_spawnLargeExplosion) _spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);
                                    // Award coins directly: 6 coins * 5 value = 30 total
                                    if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: 'coin' });
                                    // Award nugget directly
                                    if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: 'coin' });
                                }
                                break;
                            }
                        }
                        if (GameContext.contractEntities && GameContext.contractEntities.fortresses && GameContext.contractEntities.fortresses.length > 0) {
                            const fortresses = GameContext.contractEntities.fortresses;
                            for (let f of fortresses) {
                                if (!f || f.dead) continue;
                                if (b.isEnemy && b.owner !== GameContext.player) continue;
                                const dx = b.pos.x - f.pos.x;
                                const dy = b.pos.y - f.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const hitRadius = f.radius + b.radius;
                                if (distSq < hitRadius * hitRadius) {
                                    f.hp -= b.damage;
                                    hit = true;
                                    if (_playSound) _playSound('hit');
                                    if (_spawnParticles) _spawnParticles(f.pos.x, f.pos.y, 6, '#fff');
                                    if (f.hp <= 0) {
                                        if (typeof f.kill === 'function') f.kill();
                                        else f.dead = true;
                                    }
                                    break;
                                }
                            }
                        }
                        if (GameContext.contractEntities && GameContext.contractEntities.wallTurrets && GameContext.contractEntities.wallTurrets.length > 0) {
                            const wallTurrets = GameContext.contractEntities.wallTurrets;
                            for (let t of wallTurrets) {
                                if (!t || t.dead) continue;
                                if (b.isEnemy && b.owner !== GameContext.player) continue;
                                const dx = b.pos.x - t.pos.x;
                                const dy = b.pos.y - t.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const hitRadius = t.radius + b.radius;
                                if (distSq < hitRadius * hitRadius) {
                                    t.hp -= b.damage;
                                    hit = true;
                                    if (_playSound) _playSound('hit');
                                    if (_spawnParticles) _spawnParticles(t.pos.x, t.pos.y, 6, '#fff');
                                    if (t.hp <= 0) {
                                        if (typeof t.kill === 'function') t.kill();
                                        else t.dead = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                // Check cave wall turrets
                if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.wallTurrets && GameContext.caveLevel.wallTurrets.length > 0) {
                    for (let t of GameContext.caveLevel.wallTurrets) {
                        if (!t || t.dead) continue;
                        if (typeof t.hitByPlayerBullet === 'function' && t.hitByPlayerBullet(b)) {
                            hit = true;
                            break;
                        }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.switches && GameContext.caveLevel.switches.length > 0) {
                    for (let s of GameContext.caveLevel.switches) {
                        if (!s || s.dead) continue;
                        if (typeof s.hitByPlayerBullet === 'function' && s.hitByPlayerBullet(b)) { hit = true; break; }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.relays && GameContext.caveLevel.relays.length > 0) {
                    for (let r of GameContext.caveLevel.relays) {
                        if (!r || r.dead) continue;
                        if (typeof r.hitByPlayerBullet === 'function' && r.hitByPlayerBullet(b)) { hit = true; break; }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active && GameContext.caveLevel.critters && GameContext.caveLevel.critters.length > 0) {
                    for (let c of GameContext.caveLevel.critters) {
                        if (!c || c.dead) continue;
                        const dist = Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y);
                        if (dist < c.radius + b.radius) {
                            c.dead = true;
                            hit = true;
                            if (_spawnParticles) _spawnParticles(c.pos.x, c.pos.y, 18, '#6f6');
                            if (_playSound) _playSound('explode');
                            if (GameContext.caveLevel.wallTurrets && GameContext.caveLevel.wallTurrets.length > 0) {
                                for (let t of GameContext.caveLevel.wallTurrets) {
                                    if (!t || t.dead) continue;
                                    const dt = Math.hypot(t.pos.x - c.pos.x, t.pos.y - c.pos.y);
                                    if (dt < 900) {
                                        t.reload = Math.min(t.reload || 0, 10);
                                        t.beamCooldown = Math.min(t.beamCooldown || 0, 30);
                                        t.trackerCharge = Math.min(t.trackerCharge || 0, 30);
                                    }
                                }
                            }
                            break;
                        }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.warpBioPods && GameContext.warpBioPods.length > 0) {
                    for (let p of GameContext.warpBioPods) {
                        if (!p || p.dead) continue;
                        const dist = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
                        if (dist < p.radius + b.radius) {
                            p.takeHit(b.damage);
                            hit = true;
                            break;
                        }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.spaceStation && !GameContext.spaceStation.dead) {
                    const dist = Math.hypot(b.pos.x - GameContext.spaceStation.pos.x, b.pos.y - GameContext.spaceStation.pos.y);

                    const outerShieldsUp = GameContext.spaceStation.shieldSegments && GameContext.spaceStation.shieldSegments.some(s => s > 0);
                    const innerShieldsUp = GameContext.spaceStation.innerShieldSegments && GameContext.spaceStation.innerShieldSegments.some(s => s > 0);

                    if (!hit && !b.ignoreShields && outerShieldsUp && dist < GameContext.spaceStation.shieldRadius + b.radius) {
                        let angle = Math.atan2(b.pos.y - GameContext.spaceStation.pos.y, b.pos.x - GameContext.spaceStation.pos.x) - GameContext.spaceStation.shieldRotation;
                        while (angle < 0) angle += Math.PI * 2;
                        const count = GameContext.spaceStation.shieldSegments.length;
                        const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                        if (GameContext.spaceStation.shieldSegments[idx] > 0) {
                            GameContext.spaceStation.shieldSegments[idx]--;
                            GameContext.spaceStation.shieldsDirty = true;
                            hit = true;
                            if (_playSound) _playSound('shield_hit');
                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                        }
                    }
                    if (!hit && !b.ignoreShields && innerShieldsUp && dist < GameContext.spaceStation.innerShieldRadius + b.radius) {
                        let angle = Math.atan2(b.pos.y - GameContext.spaceStation.pos.y, b.pos.x - GameContext.spaceStation.pos.x) - GameContext.spaceStation.innerShieldRotation;
                        while (angle < 0) angle += Math.PI * 2;
                        const count = GameContext.spaceStation.innerShieldSegments.length;
                        const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                        if (GameContext.spaceStation.innerShieldSegments[idx] > 0) {
                            GameContext.spaceStation.innerShieldSegments[idx]--;
                            GameContext.spaceStation.shieldsDirty = true;
                            hit = true;
                            if (_playSound) _playSound('shield_hit');
                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                        }
                    }
                    if (!hit && dist < GameContext.spaceStation.radius + b.radius) {
                        GameContext.spaceStation.hp -= b.damage;
                        hit = true;
                        if (_playSound) _playSound('hit');
                        if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#fff');
                        if (GameContext.spaceStation.hp <= 0) {
                            if (_handleSpaceStationDestroyed) _handleSpaceStationDestroyed();
                        }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.destroyer && !GameContext.destroyer.dead) {
                    const dist = Math.hypot(b.pos.x - GameContext.destroyer.pos.x, b.pos.y - GameContext.destroyer.pos.y);
                    if (GameContext.destroyer.invulnerable > 0 && dist < GameContext.destroyer.shieldRadius + b.radius) {
                        hit = true;
                        if (_playSound) _playSound('shield_hit');
                        if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                    }
                    const outerUp = GameContext.destroyer.shieldSegments && GameContext.destroyer.shieldSegments.some(s => s > 0);
                    const innerUp = GameContext.destroyer.innerShieldSegments && GameContext.destroyer.innerShieldSegments.some(s => s > 0);
                    if (!hit && !b.ignoreShields && outerUp && dist < GameContext.destroyer.shieldRadius + b.radius) {
                        let angle = Math.atan2(b.pos.y - GameContext.destroyer.pos.y, b.pos.x - GameContext.destroyer.pos.x) - GameContext.destroyer.shieldRotation;
                        while (angle < 0) angle += Math.PI * 2;
                        const count = GameContext.destroyer.shieldSegments.length;
                        const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                        if (GameContext.destroyer.shieldSegments[idx] > 0) {
                            const segmentHp = GameContext.destroyer.shieldSegments[idx];
                            if (b.damage > segmentHp) {
                                GameContext.destroyer.shieldSegments[idx] = 0;
                            } else {
                                GameContext.destroyer.shieldSegments[idx] -= b.damage;
                            }
                            GameContext.destroyer.shieldsDirty = true;
                            hit = true;
                            if (_playSound) _playSound('shield_hit');
                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                        }
                    }
                    if (!hit && !b.ignoreShields && innerUp && dist < GameContext.destroyer.innerShieldRadius + b.radius) {
                        let angle = Math.atan2(b.pos.y - GameContext.destroyer.pos.y, b.pos.x - GameContext.destroyer.pos.x) - GameContext.destroyer.innerShieldRotation;
                        while (angle < 0) angle += Math.PI * 2;
                        const count = GameContext.destroyer.innerShieldSegments.length;
                        const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                        if (GameContext.destroyer.innerShieldSegments[idx] > 0) {
                            const segmentHp = GameContext.destroyer.innerShieldSegments[idx];
                            if (b.damage > segmentHp) {
                                GameContext.destroyer.innerShieldSegments[idx] = 0;
                            } else {
                                GameContext.destroyer.innerShieldSegments[idx] -= b.damage;
                            }
                            GameContext.destroyer.shieldsDirty = true;
                            hit = true;
                            if (_playSound) _playSound('shield_hit');
                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                        }
                    }
                    if (!hit && (typeof GameContext.destroyer.hitTestCircle === 'function' ? GameContext.destroyer.hitTestCircle(b.pos.x, b.pos.y, b.radius) : (dist < GameContext.destroyer.radius + b.radius))) {
                        const hpBefore = GameContext.destroyer.hp;
                        GameContext.destroyer.hp -= b.damage;
                        console.log(`[DESTROYER DEBUG] BULLET HIT: ${b.damage} dmg | HP: ${hpBefore} -> ${GameContext.destroyer.hp} | isEnemy=${b.isEnemy} | color=${b.color} | owner=${b.owner?.displayName || b.owner?.constructor?.name || 'none'} | homing=${b.homing}`);
                        hit = true;
                        if (_playSound) _playSound('hit');
                        if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#ff0');
                        if (GameContext.destroyer.hp <= 0) {
                            GameContext.destroyer.kill();
                        }
                    }
                }

                if (!hit && !b.isEnemy && GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) {
                    if (b.owner !== GameContext.boss) {
                        const dist = Math.hypot(b.pos.x - GameContext.boss.pos.x, b.pos.y - GameContext.boss.pos.y);

                        if (GameContext.boss.isWarpBoss && GameContext.boss.ramInvulnerable > 0 && dist < GameContext.boss.radius + b.radius + 6) {
                            hit = true;
                            if (_playSound) _playSound('shield_hit');
                            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                        }

                        const outerShieldsUp = GameContext.boss.shieldSegments && GameContext.boss.shieldSegments.some(s => s > 0);
                        const innerShieldsUp = GameContext.boss.innerShieldSegments && GameContext.boss.innerShieldSegments.length > 0 && GameContext.boss.innerShieldSegments.some(s => s > 0);

                        if (!hit && !b.ignoreShields && outerShieldsUp && dist < GameContext.boss.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) - GameContext.boss.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const segCount = GameContext.boss.shieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * segCount) % segCount;
                            if (GameContext.boss.shieldSegments[segIndex] > 0) {
                                GameContext.boss.shieldSegments[segIndex]--;
                                GameContext.boss.shieldsDirty = true;
                                hit = true;
                                if (_playSound) _playSound('shield_hit');
                                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#0ff');
                            }
                        }
                        if (!hit && !b.ignoreShields && innerShieldsUp && dist < GameContext.boss.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) - GameContext.boss.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = GameContext.boss.innerShieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (GameContext.boss.innerShieldSegments[segIndex] > 0) {
                                GameContext.boss.innerShieldSegments[segIndex]--;
                                GameContext.boss.shieldsDirty = true;
                                hit = true;
                                if (_playSound) _playSound('shield_hit');
                                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                            }
                        }

                        if (!hit) {
                            if (typeof GameContext.boss.applyPlayerBulletHit === 'function') {
                                if (GameContext.boss.applyPlayerBulletHit(b)) {
                                    hit = true;
                                }
                            }

                            if (!hit) {
                                const hullRadius = (GameContext.boss.hullCollisionRadius) ? GameContext.boss.hullCollisionRadius :
                                    (typeof GameContext.boss.hitTestCircle === 'function' ? 0 : GameContext.boss.radius);
                                const hitTest = (typeof GameContext.boss.hitTestCircle === 'function' && !GameContext.boss.hullCollisionRadius) ?
                                    GameContext.boss.hitTestCircle(b.pos.x, b.pos.y, b.radius) :
                                    (dist < hullRadius + b.radius);
                                if (hitTest) {
                                    GameContext.boss.hp -= b.damage;
                                    hit = true;
                                    if (_playSound) _playSound('hit');
                                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, '#fff');
                                    if (GameContext.boss.hp <= 0) {
                                        GameContext.boss.kill();
                                        GameContext.score += 5000;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (hit) {
                if (_destroyBulletSprite) _destroyBulletSprite(b);
                GameContext.bullets.splice(i, 1);
            }
        }
    } catch (e) {
        console.error('[BULLET LOGIC ERROR]', e);
    } finally {
        if (_setProjectileImpactSoundContext) _setProjectileImpactSoundContext(false);
    }
}
