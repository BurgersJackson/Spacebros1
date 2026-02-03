import { GameContext } from "../core/game-context.js";
import {
  Enemy,
  Pinwheel,
  Destroyer,
  Destroyer2,
  SpaceStation,
  Cruiser
} from "../entities/index.js";
import { CavePinwheel1, CavePinwheel2, CavePinwheel3 } from "../entities/cave/index.js";
import { WarpShieldDrone } from "../entities/bosses/index.js";
import { Shockwave } from "../entities/projectiles/Shockwave.js";

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
let _FloatingText = null;

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
  if (deps.handleSpaceStationDestroyed)
    _handleSpaceStationDestroyed = deps.handleSpaceStationDestroyed;
  if (deps.spawnLightningArc) _spawnLightningArc = deps.spawnLightningArc;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.destroyBulletSprite) _destroyBulletSprite = deps.destroyBulletSprite;
  if (deps.updateContractUI) _updateContractUI = deps.updateContractUI;
  if (deps.setProjectileImpactSoundContext)
    _setProjectileImpactSoundContext = deps.setProjectileImpactSoundContext;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
  if (deps.FloatingText) _FloatingText = deps.FloatingText;
}

/** Log only when GameContext.DEBUG_SHIELD_BYPASS is true (Pinwheel/Gunboat shield debugging). */
function _shieldBypassLog(...args) {
  if (typeof GameContext.DEBUG_SHIELD_BYPASS !== "undefined" && GameContext.DEBUG_SHIELD_BYPASS) {
    console.log("[SHIELD DEBUG]", ...args);
  }
}

/**
 * Apply critical strike to damage
 * @param {number} baseDamage - Base damage value
 * @param {number} x - X position for floating text
 * @param {number} y - Y position for floating text
 * @returns {Object} { damage, isCrit }
 */
function applyCriticalStrike(baseDamage, x, y) {
  if (!GameContext.player || !GameContext.player.stats) {
    return { damage: Math.round(baseDamage), isCrit: false };
  }

  const critChance = GameContext.player.stats.critChance || 0;
  const critDamage = GameContext.player.stats.critDamage || 1.0;

  if (Math.random() < critChance) {
    const finalDamage = Math.round(baseDamage * critDamage);
    // Show floating text for crit - directly create FloatingText instance
    if (_FloatingText) {
      GameContext.floatingTexts.push(
        new _FloatingText(x, y, `CRIT! ${finalDamage}`, "#ff0", 70, {})
      );
    }
    return { damage: finalDamage, isCrit: true };
  }

  return { damage: baseDamage, isCrit: false };
}

/**
 * Show floating damage text at position
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} damage - Damage amount
 * @param {boolean} isCrit - Whether this is a crit hit
 */
function showDamageFloatingText(x, y, damage, isCrit = false) {
  if (damage <= 0) return;
  const color = isCrit ? "#ff0" : "#fff";
  const roundedDamage = Math.round(damage);
  const text = isCrit ? `${roundedDamage}!` : `${roundedDamage}`;
  const key = `dmg_${Math.floor(x / 50)}_${Math.floor(y / 50)}`;
  if (_FloatingText) {
    GameContext.floatingTexts.push(new _FloatingText(x, y, text, color, 45, { fontSize: 50 }));
  }
}

/**
 * Find or create a floating text for stacking
 * @param {Array} floatingTexts - Array of floating texts
 * @param {string} key - Unique key for stacking
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} amount - Text to display
 * @param {string} color - Text color
 * @param {Object} opts - Additional options
 */
function getOrCreateFloatingText(floatingTexts, key, x, y, amount, color, opts = {}) {
  const maxAge = opts.maxAge || 600;
  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    if (ft.key === key && !ft.dead && ft.age < 20) {
      ft.bump(null, x, y);
      return ft;
    }
  }
  const ft = new _FloatingText(x, y, `${amount}`, color, opts.life || 45, {
    key,
    amount: null,
    prefix: "",
    suffix: ""
  });
  floatingTexts.push(ft);
  return ft;
}

/**
 * Apply lifesteal - heal player on enemy kills
 * @param {number} x - X position for floating text
 * @param {number} y - Y position for floating text
 */
function applyLifesteal(x, y) {
  if (!GameContext.player || !GameContext.player.stats) {
    return;
  }

  const threshold = GameContext.player.stats.lifestealThreshold || 100;
  const healAmount = GameContext.player.stats.lifestealHealAmount || 1;

  // Track kills
  if (!GameContext.player.lifestealKills) {
    GameContext.player.lifestealKills = 0;
  }

  GameContext.player.lifestealKills++;

  // Check if we've reached the threshold
  if (GameContext.player.lifestealKills >= threshold) {
    // Heal player
    GameContext.player.hp = Math.min(GameContext.player.hp + healAmount, GameContext.player.maxHp);

    // Show floating text
    if (_FloatingText) {
      GameContext.floatingTexts.push(new _FloatingText(x, y, `+${healAmount} HP`, "#0f0", 60, {}));
    }

    // Update UI
    if (_updateHealthUI) {
      _updateHealthUI();
    }

    // Reset counter
    GameContext.player.lifestealKills = 0;
  }
}

/**
 * Track damage by weapon type for death screen statistics
 * @param {Object} bullet - The bullet that dealt damage
 * @param {number} damage - The damage dealt
 */
function trackDamageByWeaponType(bullet, damage) {
  if (!bullet || bullet.isEnemy || bullet.owner === "enemy") return;

  // Determine weapon type from bullet properties
  let weaponType = "turret"; // default

  if (bullet.weaponType) {
    weaponType = bullet.weaponType;
  } else if (bullet.isMissile) {
    weaponType = "homing_missile";
  } else if (bullet.isSplitShot) {
    weaponType = "split_shot";
  } else if (bullet.isExplosive) {
    weaponType = "explosive_rounds";
  } else if (bullet.shape === "square") {
    weaponType = "shotgun";
  }

  // Initialize if needed
  if (!GameContext.damageByWeaponType[weaponType]) {
    GameContext.damageByWeaponType[weaponType] = 0;
  }

  GameContext.damageByWeaponType[weaponType] += damage;
  GameContext.totalDamageDealt += damage;
}

/**
 * Track chain lightning damage
 * @param {number} damage - The chain lightning damage dealt
 */
function trackChainLightningDamage(damage) {
  const weaponType = "chain_lightning";
  if (!GameContext.damageByWeaponType[weaponType]) {
    GameContext.damageByWeaponType[weaponType] = 0;
  }
  GameContext.damageByWeaponType[weaponType] += damage;
  GameContext.totalDamageDealt += damage;
}

/**
 * Apply Thorn Armor - reflect damage when player is hit
 * @param {number} damage - Damage taken by player
 * @param {Object} sourceEntity - The entity that damaged player
 */
function applyThornArmor(damage, sourceEntity) {
  if (!GameContext.player || !GameContext.player.stats) {
    return;
  }

  const thornPercent = GameContext.player.stats.thornReflect || 0;
  if (thornPercent <= 0) return;

  // Calculate reflected damage
  const thornDamage = Math.ceil(damage * thornPercent);

  // Apply damage to source
  if (typeof sourceEntity.takeHit === "function") {
    sourceEntity.takeHit(thornDamage);
  } else if (sourceEntity.hp !== undefined) {
    sourceEntity.hp -= thornDamage;
    if (sourceEntity.hp <= 0 && typeof sourceEntity.kill === "function") {
      sourceEntity.kill();
    }
  }

  // Visual feedback
  if (_spawnParticles) {
    _spawnParticles(sourceEntity.pos.x, sourceEntity.pos.y, 10, "#f0f");
  }
}

/**
 * @param {Object} entity
 * @param {number} elasticity
 */
export function checkWallCollision(entity, elasticity = 0) {
  if (!entity || entity.dead) return;

  // Shield drones are fixed-position entities and should not collide with walls/asteroids
  if (entity instanceof WarpShieldDrone || entity.isWarpShieldDrone) return;

  if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
    GameContext.caveLevel.applyWallCollisions(entity);
  }

  if (GameContext.warpZone && GameContext.warpZone.active) {
    GameContext.warpZone.applyWallCollisions(entity);
  }

  const activeAnomalyZone =
    GameContext.activeContract &&
    GameContext.activeContract.type === "anomaly" &&
    GameContext.contractEntities &&
    GameContext.contractEntities.anomalies
      ? GameContext.contractEntities.anomalies.find(
          a => a && !a.dead && a.contractId === GameContext.activeContract.id
        )
      : null;
  if (activeAnomalyZone) {
    const dA = Math.hypot(
      entity.pos.x - activeAnomalyZone.pos.x,
      entity.pos.y - activeAnomalyZone.pos.y
    );
    if (dA < activeAnomalyZone.radius + 800) activeAnomalyZone.applyWallCollisions(entity, 0.95);
  }

  if (GameContext.bossArena.active && entity instanceof Enemy) return;
  if (GameContext.bossArena.active) {
    const dx = entity.pos.x - GameContext.bossArena.x;
    const dy = entity.pos.y - GameContext.bossArena.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GameContext.bossArena.radius) {
      if (entity === GameContext.player) {
        const warpBossActive = !!(
          GameContext.boss &&
          GameContext.bossActive &&
          GameContext.boss.isWarpBoss &&
          !GameContext.boss.dead
        );
        if (!warpBossActive && Date.now() - GameContext.player.lastArenaDamageTime > 1000) {
          if (GameContext.player.invulnerable <= 0) {
            GameContext.player.hp -= 1;
            if (_playSound) _playSound("hit");
            if (_updateHealthUI) _updateHealthUI();
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, "#f00");
            if (_showOverlayMessage)
              _showOverlayMessage("WARNING: ARENA WALL DAMAGE", "#f00", 1000);
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
            if (_playSound) _playSound("hit");
            if (_updateHealthUI) _updateHealthUI();
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, "#f00");
            if (_showOverlayMessage) _showOverlayMessage("STATION FIELD DAMAGE", "#f80", 1000);
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
            if (_playSound) _playSound("hit");
            if (_updateHealthUI) _updateHealthUI();
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, "#f80");
            if (_showOverlayMessage) _showOverlayMessage("ARENA BOUNDARY DAMAGE", "#f80", 1000);
            if (GameContext.player.hp <= 0) {
              if (_killPlayer) _killPlayer();
              else GameContext.player.dead = true;
            }
          }
          GameContext.player.lastArenaDamageTime = Date.now();
        }
      }

      const angle = Math.atan2(dy, dx);
      entity.pos.x =
        GameContext.caveBossArena.x + Math.cos(angle) * GameContext.caveBossArena.radius;
      entity.pos.y =
        GameContext.caveBossArena.y + Math.sin(angle) * GameContext.caveBossArena.radius;

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
            if (_playSound) _playSound("hit");
            if (_updateHealthUI) _updateHealthUI();
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 5, "#f80");
            if (_showOverlayMessage) _showOverlayMessage("DUNGEON BOUNDARY", "#f80", 1000);
            if (GameContext.player.hp <= 0) {
              if (_killPlayer) _killPlayer();
              else GameContext.player.dead = true;
            }
          }
          GameContext.player.lastArenaDamageTime = Date.now();
        }
      }

      const angle = Math.atan2(dy, dx);
      entity.pos.x =
        GameContext.dungeon1Arena.x + Math.cos(angle) * GameContext.dungeon1Arena.radius;
      entity.pos.y =
        GameContext.dungeon1Arena.y + Math.sin(angle) * GameContext.dungeon1Arena.radius;

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
  if (
    GameContext.warpZone &&
    GameContext.warpZone.active &&
    typeof GameContext.warpZone.bulletHitsWall === "function"
  ) {
    if (GameContext.warpZone.bulletHitsWall(bullet)) return { kind: "warp_wall", obj: null };
  }
  if (
    GameContext.caveMode &&
    GameContext.caveLevel &&
    GameContext.caveLevel.active &&
    typeof GameContext.caveLevel.bulletHitsWall === "function"
  ) {
    if (GameContext.caveLevel.bulletHitsWall(bullet)) return { kind: "cave_wall", obj: null };
  }
  if (
    GameContext.activeContract &&
    GameContext.activeContract.type === "anomaly" &&
    GameContext.contractEntities &&
    GameContext.contractEntities.anomalies
  ) {
    const az = GameContext.contractEntities.anomalies.find(
      a =>
        a &&
        !a.dead &&
        a.contractId === GameContext.activeContract.id &&
        typeof a.bulletHitsWall === "function"
    );
    if (az) {
      const dA = Math.hypot(bullet.pos.x - az.pos.x, bullet.pos.y - az.pos.y);
      if (dA < az.radius + 900 && az.bulletHitsWall(bullet))
        return { kind: "anomaly_wall", obj: null };
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
      return { kind: "asteroid", obj: ast };
    }
  }
  return null;
}

/**
 * @returns {void}
 */
export function resolveEntityCollision() {
  const allEntities = [
    GameContext.player,
    ...GameContext.enemies,
    ...GameContext.pinwheels,
    ...GameContext.cavePinwheels,
    ...(GameContext.contractEntities.fortresses || [])
  ].filter(e => e && !e.dead);
  if (GameContext.destroyer && !GameContext.destroyer.dead) allEntities.push(GameContext.destroyer);
  if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead)
    allEntities.push(GameContext.boss);

  const activeAnomalyZone =
    GameContext.activeContract &&
    GameContext.activeContract.type === "anomaly" &&
    GameContext.contractEntities &&
    GameContext.contractEntities.anomalies
      ? GameContext.contractEntities.anomalies.find(
          a => a && !a.dead && a.contractId === GameContext.activeContract.id
        )
      : null;

  const activeCave =
    GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active
      ? GameContext.caveLevel
      : null;

  for (let i = 0; i < allEntities.length; i++) {
    for (let j = i + 1; j < allEntities.length; j++) {
      const e1 = allEntities[i];
      const e2 = allEntities[j];

      if (
        (e1 instanceof Pinwheel && e2 instanceof Enemy) ||
        (e2 instanceof Pinwheel && e1 instanceof Enemy)
      ) {
        continue;
      }
      // Dungeon bosses only collide with player, skip dungeon boss vs other enemies
      if (e1.isDungeonBoss && e2 !== GameContext.player) continue;
      if (e2.isDungeonBoss && e1 !== GameContext.player) continue;
      // Warp boss only collides with player, skip warp boss vs other enemies
      if (e1.isWarpBoss && e2 !== GameContext.player) continue;
      if (e2.isWarpBoss && e1 !== GameContext.player) continue;
      // Destroyer only collides with player, skip destroyer vs other enemies
      if ((e1 instanceof Destroyer || e1 instanceof Destroyer2) && e2 !== GameContext.player)
        continue;
      if ((e2 instanceof Destroyer || e2 instanceof Destroyer2) && e1 !== GameContext.player)
        continue;
      // Cave bosses only collide with player, skip cave boss vs other enemies
      if (e1.isCaveBoss && e2 !== GameContext.player) continue;
      if (e2.isCaveBoss && e1 !== GameContext.player) continue;
      // Shield drones only collide with player, skip shield drone vs other entities
      if ((e1 instanceof WarpShieldDrone || e1.isWarpShieldDrone) && e2 !== GameContext.player)
        continue;
      if ((e2 instanceof WarpShieldDrone || e2.isWarpShieldDrone) && e1 !== GameContext.player)
        continue;
      // Cruiser only collides with player, skip cruiser vs other enemies
      if (e1 instanceof Cruiser && e2 !== GameContext.player) continue;
      if (e2 instanceof Cruiser && e1 !== GameContext.player) continue;

      let r1 =
        e1 instanceof Destroyer || e1 instanceof Destroyer2
          ? e1.shieldRadius || e1.radius
          : e1.radius;
      let r2 =
        e2 instanceof Destroyer || e2 instanceof Destroyer2
          ? e2.shieldRadius || e2.radius
          : e2.radius;
      if (e1.isWarpBoss) r1 = e1.shieldRadius || e1.radius;
      if (e2.isWarpBoss) r2 = e2.shieldRadius || e2.radius;
      if (e1.isDungeonBoss) r1 = e1.shieldRadius || e1.radius;
      if (e2.isDungeonBoss) r2 = e2.shieldRadius || e2.radius;
      if (e1.isCaveBoss) r1 = e1.shieldRadius || e1.radius;
      if (e2.isCaveBoss) r2 = e2.shieldRadius || e2.radius;
      // Cruiser uses shield radius if shields are up, otherwise hull radius
      if (e1 instanceof Cruiser)
        r1 = e1.shieldSegments && e1.shieldSegments.some(s => s > 0) ? e1.shieldRadius : e1.radius;
      if (e2 instanceof Cruiser)
        r2 = e2.shieldSegments && e2.shieldSegments.some(s => s > 0) ? e2.shieldRadius : e2.radius;

      const isStatic1 =
        e1 instanceof Pinwheel || e1 instanceof SpaceStation || e1.isDungeonBoss || e1.isCaveBoss;
      const isStatic2 =
        e2 instanceof Pinwheel || e2 instanceof SpaceStation || e2.isDungeonBoss || e2.isCaveBoss;
      const e1IsDestroyer = e1 instanceof Destroyer || e1 instanceof Destroyer2;
      const e2IsDestroyer = e2 instanceof Destroyer || e2 instanceof Destroyer2;

      if (isStatic1 && e1.shieldSegments && e1.shieldSegments.some(s => s > 0))
        r1 = e1.shieldRadius;
      if (isStatic2 && e2.shieldSegments && e2.shieldSegments.some(s => s > 0))
        r2 = e2.shieldRadius;

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

        if (
          (e1IsDestroyer && e2 instanceof Pinwheel) ||
          (e2IsDestroyer && e1 instanceof Pinwheel)
        ) {
          if (e1IsDestroyer) {
            e2.pos.x += nx * overlap;
            e2.pos.y += ny * overlap;
          } else {
            e1.pos.x -= nx * overlap;
            e1.pos.y -= ny * overlap;
          }
        } else if (isStatic1) {
          e2.pos.x += nx * overlap;
          e2.pos.y += ny * overlap;
        } else if (isStatic2) {
          e1.pos.x -= nx * overlap;
          e1.pos.y -= ny * overlap;
        } else if (e1IsDestroyer && !e2IsDestroyer) {
          e2.pos.x += nx * overlap;
          e2.pos.y += ny * overlap;
        } else if (e2IsDestroyer && !e1IsDestroyer) {
          e1.pos.x -= nx * overlap;
          e1.pos.y -= ny * overlap;
        } else {
          e1.pos.x -= nx * push;
          e1.pos.y -= ny * push;
          e2.pos.x += nx * push;
          e2.pos.y += ny * push;
        }

        if (e1 instanceof Pinwheel) e1.aggro = true;
        if (e2 instanceof Pinwheel) e2.aggro = true;
      }
    }
  }

  if (
    GameContext.bossActive &&
    GameContext.boss &&
    GameContext.boss.isWarpBoss &&
    !GameContext.boss.dead
  ) {
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
        if (
          !GameContext.player.lastWarpBossBlockAt ||
          now - GameContext.player.lastWarpBossBlockAt > 200
        ) {
          if (_spawnParticles)
            _spawnParticles(
              (GameContext.player.pos.x + GameContext.boss.pos.x) / 2,
              (GameContext.player.pos.y + GameContext.boss.pos.y) / 2,
              5,
              "#0ff"
            );
          if (_playSound) _playSound("shield_hit");
          GameContext.player.lastWarpBossBlockAt = now;
        }
      }
    }
  }

  const damageable = [
    GameContext.player,
    ...GameContext.enemies,
    ...GameContext.pinwheels,
    ...GameContext.cavePinwheels,
    ...(GameContext.contractEntities.fortresses || [])
  ];
  if (GameContext.boss && GameContext.bossActive && !GameContext.boss.dead)
    damageable.push(GameContext.boss);
  if (GameContext.destroyer && !GameContext.destroyer.dead) damageable.push(GameContext.destroyer);

  for (let entity of damageable) {
    if (entity.dead) continue;
    // Cruiser doesn't collide with asteroids
    if (entity instanceof Cruiser) continue;
    const nearbyAsteroids = GameContext.asteroidGrid.query(entity.pos.x, entity.pos.y);
    for (let ast of nearbyAsteroids) {
      if (ast.dead) continue;
      const dx = entity.pos.x - ast.pos.x;
      const dy = entity.pos.y - ast.pos.y;
      const distSq = dx * dx + dy * dy;
      const entityRadius =
        entity instanceof Destroyer || entity instanceof Destroyer2
          ? entity.shieldRadius || entity.radius
          : entity.radius;
      const minDist = entityRadius + ast.radius;
      const isIndestructibleWall = !!ast.unbreakable;

      if (distSq < minDist * minDist) {
        let dist = Math.sqrt(distSq);
        if (dist < 0.001) dist = 0.001;
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const isCrasher =
          entity instanceof Pinwheel ||
          entity instanceof Cruiser ||
          (entity instanceof Enemy &&
            (entity.isGunboat ||
              entity.type === "roamer" ||
              entity.type === "elite_roamer" ||
              entity.type === "hunter" ||
              entity.type === "defender"));
        const isDestroyer = entity instanceof Destroyer || entity instanceof Destroyer2;

        let validCollision = false;

        if (isDestroyer && isIndestructibleWall) {
          if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, "#aa8");
          continue;
        }

        if (!isIndestructibleWall && isCrasher) {
          ast.break();
          if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, "#aa8");
          validCollision = true;
        }

        if (validCollision) {
          // Cruisers charging should smash through asteroids without being pushed back
          const isChargingCruiser =
            entity instanceof Cruiser &&
            (entity.chargeState === "charging" || entity.chargeState === "telegraph");
          if (!isChargingCruiser) {
            entity.pos.x += nx * overlap;
            entity.pos.y += ny * overlap;

            if (entity !== GameContext.player) {
              entity.vel.x += nx * 1;
              entity.vel.y += ny * 1;
            }
          }
        }

        if (entity === GameContext.player) {
          const vn = GameContext.player.vel.x * nx + GameContext.player.vel.y * ny;
          if (vn < 0) {
            const restitution = 1.0;
            GameContext.player.vel.x -= nx * vn * (1 + restitution);
            GameContext.player.vel.y -= ny * vn * (1 + restitution);
          }
          const outwardKick = isIndestructibleWall
            ? Math.min(4, overlap * 0.08)
            : Math.min(10, 3 + overlap * 0.12);
          GameContext.player.vel.x += nx * outwardKick;
          GameContext.player.vel.y += ny * outwardKick;
          GameContext.player.vel.mult(0.98);
          GameContext.shakeMagnitude = Math.max(
            GameContext.shakeMagnitude,
            isIndestructibleWall ? 3 : 6
          );
          GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 10);

          if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
            if (GameContext.player.invincibilityOnHit > 0) {
            }

            if (Date.now() - GameContext.player.lastAsteroidHitTime > 1000) {
              const asteroidDamage = isIndestructibleWall ? 2 : 1;
              GameContext.player.takeHit(asteroidDamage, true);
              GameContext.player.lastAsteroidHitTime = Date.now();
              if (!isIndestructibleWall) {
                ast.break();
                if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 8, "#aa8");
                if (_playSound) _playSound("hit");
              } else {
                if (_spawnParticles)
                  _spawnParticles(
                    GameContext.player.pos.x - nx * GameContext.player.radius,
                    GameContext.player.pos.y - ny * GameContext.player.radius,
                    6,
                    "#08f"
                  );
                if (_playSound) _playSound("hit");
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
      const isRoamer = e.type === "roamer" || e.type === "elite_roamer";
      const isDefender = e.type === "defender";
      const isHunter = e.type === "hunter";
      const isShieldDrone = e instanceof WarpShieldDrone || e.isWarpShieldDrone;

      if (isRoamer || isDefender || isHunter || isShieldDrone) {
        const dist = Math.hypot(
          GameContext.player.pos.x - e.pos.x,
          GameContext.player.pos.y - e.pos.y
        );
        if (dist < GameContext.player.radius + e.radius) {
          if (isRoamer || isDefender || isShieldDrone) {
            const angle = Math.atan2(
              GameContext.player.pos.y - e.pos.y,
              GameContext.player.pos.x - e.pos.x
            );
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);

            const pushForce = isShieldDrone ? 7 : 5; // Stronger push for shield drones
            GameContext.player.vel.x += nx * pushForce;
            GameContext.player.vel.y += ny * pushForce;
            if (e.vel) {
              // Shield drones don't have velocity, so check first
              e.vel.x -= nx * pushForce;
              e.vel.y -= ny * pushForce;
            }

            if (_spawnParticles)
              _spawnParticles(
                (GameContext.player.pos.x + e.pos.x) / 2,
                (GameContext.player.pos.y + e.pos.y) / 2,
                5,
                isShieldDrone ? "#0af" : "#fff"
              );
            continue;
          }

          const ramDamage = Math.max(0, Math.ceil(e.hp));
          if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 20, "#f44");
          if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 15, "#ff0");
          if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 10, "#0ff");
          e.kill();
          if (_playSound) _playSound("hit");

          GameContext.player.takeHit(ramDamage);
          applyThornArmor(ramDamage, e);
        }
      }

      if (e.isDungeonBoss) {
        const dist = Math.hypot(
          GameContext.player.pos.x - e.pos.x,
          GameContext.player.pos.y - e.pos.y
        );
        // Player collides with dungeon boss at outer shield radius
        const collisionRadius = e.shieldRadius || e.radius;
        if (dist < GameContext.player.radius + collisionRadius) {
          // Positional collision handled in main loop, only apply damage/effects here
          const ramDamage = 3 + Math.floor(GameContext.sectorIndex * 0.5);
          GameContext.player.takeHit(ramDamage);
          applyThornArmor(ramDamage, e);

          if (_spawnParticles)
            _spawnParticles(
              (GameContext.player.pos.x + e.pos.x) / 2,
              (GameContext.player.pos.y + e.pos.y) / 2,
              12,
              "#f44"
            );
          if (_playSound) _playSound("hit");
        }
      }
    }

    // Check collision with Cruiser boss (stored in GameContext.boss)
    if (
      GameContext.bossActive &&
      GameContext.boss &&
      !GameContext.boss.dead &&
      GameContext.boss instanceof Cruiser
    ) {
      const dist = Math.hypot(
        GameContext.player.pos.x - GameContext.boss.pos.x,
        GameContext.player.pos.y - GameContext.boss.pos.y
      );

      // Skip all ram damage if Cruiser is invulnerable
      if (GameContext.boss.invulnerableTimer > 0) return;

      // Check if Cruiser is charging (bypasses shields for 10 damage)
      if (GameContext.boss.chargeState === "charging") {
        const collisionRadius = GameContext.boss.radius;
        if (dist < GameContext.player.radius + collisionRadius) {
          // Deal 10 damage bypassing shields
          GameContext.player.hp -= 10;
          if (_updateHealthUI) _updateHealthUI();
          if (_spawnParticles)
            _spawnParticles(
              (GameContext.player.pos.x + GameContext.boss.pos.x) / 2,
              (GameContext.player.pos.y + GameContext.boss.pos.y) / 2,
              20,
              "#ff0066"
            );
          if (_playSound) _playSound("hit");
          if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
        }
        return;
      }

      // Use shield radius if shields are up, otherwise use hull radius
      const collisionRadius =
        GameContext.boss.shieldSegments && GameContext.boss.shieldSegments.some(s => s > 0)
          ? GameContext.boss.shieldRadius
          : GameContext.boss.radius;

      if (dist < GameContext.player.radius + collisionRadius) {
        // Positional collision handled in main loop, only apply damage/effects here
        const ramDamage = 5; // Fixed damage for ramming the Cruiser
        GameContext.player.takeHit(ramDamage);
        applyThornArmor(ramDamage, e);

        if (_spawnParticles)
          _spawnParticles(
            (GameContext.player.pos.x + GameContext.boss.pos.x) / 2,
            (GameContext.player.pos.y + GameContext.boss.pos.y) / 2,
            15,
            "#f44"
          );
        if (_playSound) _playSound("hit");
      }
    }

    for (let c of GameContext.coins) {
      if (c.dead) continue;
      const dist = Math.hypot(
        GameContext.player.pos.x - c.pos.x,
        GameContext.player.pos.y - c.pos.y
      );
      if (dist < GameContext.player.radius + c.radius) {
        if (_playSound) _playSound("coin");
        GameContext.score += c.value;
        GameContext.player.addXp(c.value);
        if (_addPickupFloatingText) _addPickupFloatingText("gold", c.value, "#ff0");

        if (
          GameContext.player.stats.reactiveShield &&
          GameContext.player.stats.reactiveShield > 0
        ) {
          if (!GameContext.player.reactiveShieldCoins) GameContext.player.reactiveShieldCoins = 0;
          GameContext.player.reactiveShieldCoins += c.value;

          while (GameContext.player.reactiveShieldCoins >= 50) {
            GameContext.player.reactiveShieldCoins -= 50;
            const restoreAmount = GameContext.player.stats.reactiveShield;
            const innerShieldMaxHp = GameContext.player.stats.reactiveShieldBonusHp ? 3 : 2;

            for (
              let i = 0;
              i < restoreAmount &&
              GameContext.player.outerShieldSegments &&
              GameContext.player.outerShieldSegments.length > 0;
              i++
            ) {
              const idx = GameContext.player.outerShieldSegments.findIndex(s => s <= 0);
              if (idx !== -1) {
                GameContext.player.outerShieldSegments[idx] = 1;
                GameContext.player.shieldsDirty = true;
              } else {
                const innerIdx = GameContext.player.shieldSegments.findIndex(
                  s => s < innerShieldMaxHp
                );
                if (innerIdx !== -1) {
                  GameContext.player.shieldSegments[innerIdx] = Math.min(
                    innerShieldMaxHp,
                    GameContext.player.shieldSegments[innerIdx] + 1
                  );
                  GameContext.player.shieldsDirty = true;
                }
              }
            }
            if (restoreAmount > 0 && GameContext.player.shieldSegments) {
              for (let i = 0; i < restoreAmount; i++) {
                const innerIdx = GameContext.player.shieldSegments.findIndex(
                  s => s < innerShieldMaxHp
                );
                if (innerIdx !== -1) {
                  GameContext.player.shieldSegments[innerIdx] = Math.min(
                    innerShieldMaxHp,
                    GameContext.player.shieldSegments[innerIdx] + 1
                  );
                  GameContext.player.shieldsDirty = true;
                }
              }
            }
          }
        }

        if (typeof c.kill === "function") c.kill();
        else c.dead = true;
      }
    }

    for (let n of GameContext.nuggets) {
      if (n.dead) continue;
      const dist = Math.hypot(
        GameContext.player.pos.x - n.pos.x,
        GameContext.player.pos.y - n.pos.y
      );
      if (dist < GameContext.player.radius + n.radius) {
        if (_playSound) _playSound("coin");
        const nuggetBonus = GameContext.player.stats.luckyNuggetDrop || 0;
        const finalNuggets = Math.ceil(n.value * (1 + nuggetBonus));
        GameContext.spaceNuggets += finalNuggets;
        if (_updateNuggetUI) _updateNuggetUI();
        if (_addPickupFloatingText) _addPickupFloatingText("nugs", n.value, "#ff0");
        if (typeof n.kill === "function") n.kill();
        else n.dead = true;
      }
    }

    for (let gn of GameContext.goldNuggets) {
      if (gn.dead) continue;
      const dist = Math.hypot(
        GameContext.player.pos.x - gn.pos.x,
        GameContext.player.pos.y - gn.pos.y
      );
      if (dist < GameContext.player.radius + gn.radius) {
        if (_playSound) _playSound("coin");
        const nuggetCount =
          Math.floor(Math.random() * (gn.nuggetMax - gn.nuggetMin + 1)) + gn.nuggetMin;
        const coinAmount = Math.floor(Math.random() * (gn.coinMax - gn.coinMin + 1)) + gn.coinMin;
        if (_awardCoinsInstant) _awardCoinsInstant(coinAmount, { noSound: false, sound: "coin" });
        if (_awardNuggetsInstant)
          _awardNuggetsInstant(nuggetCount, { noSound: false, sound: "coin" });
        if (_addPickupFloatingText) {
          _addPickupFloatingText("gold", coinAmount, "#ffd700");
          _addPickupFloatingText("nugs", nuggetCount, "#ff0");
        }
        if (typeof gn.kill === "function") gn.kill();
        else gn.dead = true;
      }
    }

    for (let p of GameContext.powerups) {
      if (p.dead) continue;
      const dist = Math.hypot(
        GameContext.player.pos.x - p.pos.x,
        GameContext.player.pos.y - p.pos.y
      );
      if (dist < GameContext.player.radius + p.radius) {
        if (_playSound) _playSound("powerup");
        const healthBonus = GameContext.player.stats.luckyHealthDrop || 0;
        const finalHealth = Math.ceil(10 * (1 + healthBonus));
        GameContext.player.hp = Math.min(
          GameContext.player.hp + finalHealth,
          GameContext.player.maxHp
        );
        if (_updateHealthUI) _updateHealthUI();
        if (_showOverlayMessage) _showOverlayMessage("HEALTH RESTORED", "#0f0", 1000);
        if (typeof p.kill === "function") p.kill();
        else p.dead = true;
      }
    }

    for (let c of GameContext.caches) {
      if (c.dead) continue;
      const dist = Math.hypot(
        GameContext.player.pos.x - c.pos.x,
        GameContext.player.pos.y - c.pos.y
      );
      if (dist < GameContext.player.radius + c.radius) {
        if (_playSound) _playSound("coin");
        GameContext.spaceNuggets += c.value;
        if (_updateNuggetUI) _updateNuggetUI();
        if (_addPickupFloatingText) _addPickupFloatingText("nugs", c.value, "#ff0");
        if (_showOverlayMessage) _showOverlayMessage(`CACHE +${c.value} NUGS`, "#ff0", 800);

        if (
          GameContext.activeContract &&
          GameContext.activeContract.type === "anomaly" &&
          GameContext.activeContract.id &&
          c.contractId === GameContext.activeContract.id
        ) {
          if (!GameContext.activeContract.coreCollected) {
            GameContext.activeContract.coreCollected = true;
            if (_showOverlayMessage)
              _showOverlayMessage("CORE ACQUIRED - ESCAPE ANOMALY", "#0f0", 2000);
            if (_updateContractUI) _updateContractUI();
          }
        }
        if (typeof c.kill === "function") c.kill();
        else c.dead = true;
      }
    }

    // Check collision with cave wall turrets
    if (
      GameContext.caveMode &&
      GameContext.caveLevel &&
      GameContext.caveLevel.active &&
      GameContext.caveLevel.wallTurrets
    ) {
      for (let t of GameContext.caveLevel.wallTurrets) {
        if (!t || t.dead) continue;
        const dist = Math.hypot(
          GameContext.player.pos.x - t.pos.x,
          GameContext.player.pos.y - t.pos.y
        );
        const collisionRadius = t.outerShieldRadius || t.radius;
        if (dist < GameContext.player.radius + collisionRadius) {
          // Push player back and apply damage
          const angle = Math.atan2(
            GameContext.player.pos.y - t.pos.y,
            GameContext.player.pos.x - t.pos.x
          );
          GameContext.player.vel.x += Math.cos(angle) * 2;
          GameContext.player.vel.y += Math.sin(angle) * 2;
          GameContext.player.takeHit(2);
          applyThornArmor(2, e);
          if (_updateHealthUI) _updateHealthUI();
          if (_playSound) _playSound("hit");
          if (_spawnParticles)
            _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 8, "#f00");
        }
      }
    }

    for (let s of GameContext.shootingStars) {
      if (s.dead) continue;

      if (GameContext.player && !GameContext.player.dead && !GameContext.player.invulnerable) {
        const dist = Math.hypot(
          s.pos.x - GameContext.player.pos.x,
          s.pos.y - GameContext.player.pos.y
        );
        if (dist < s.radius + GameContext.player.radius) {
          GameContext.player.takeHit(s.damage);
          if (_updateHealthUI) _updateHealthUI();
          if (_playSound) _playSound("explode");
          if (_spawnParticles)
            _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 20, "#f00");
          if (_showOverlayMessage) _showOverlayMessage("HIT BY SHOOTING STAR!", "#f00", 2000);
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
        if (e.isDungeonBoss) continue;
        const dist = Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y);
        if (dist < s.radius + e.radius) {
          e.hp -= s.damage;
          showDamageFloatingText(e.pos.x, e.pos.y, s.damage, false);
          if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 14, "#fa0");
          if (_playSound) _playSound("explode");
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
            showDamageFloatingText(b.pos.x, b.pos.y, s.damage, false);
            b.aggro = true;
            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 18, "#fa0");
            if (_playSound) _playSound("explode");
            if (b.hp <= 0) {
              applyLifesteal(b.pos.x, b.pos.y);
              b.dead = true;
              if (_playSound) _playSound("base_explode");
              if (_spawnLargeExplosion) _spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
              // Award coins directly: 6 coins * 5 value = 30 total
              if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: "coin" });
              // Award nugget directly
              if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: "coin" });
              GameContext.pinwheelsDestroyed++;
              GameContext.pinwheelsDestroyedTotal++;
              // Update difficulty tier based on total pinwheels and gunboats destroyed
              const totalDestroyed =
                GameContext.pinwheelsDestroyedTotal + GameContext.gunboatsDestroyedTotal;
              GameContext.difficultyTier = 1 + Math.floor(totalDestroyed / 6);
              GameContext.score += 10000;
              const baseEl = document.getElementById("bases-display");
              if (baseEl) baseEl.innerText = `${GameContext.pinwheelsDestroyedTotal}`;
              GameContext.enemies.forEach(e => {
                if (e.assignedBase === b) e.type = "roamer";
              });
              const delay = 10000 + Math.random() * 10000;
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
            showDamageFloatingText(b.pos.x, b.pos.y, s.damage, false);
            b.aggro = true;
            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 18, "#fa0");
            if (_playSound) _playSound("explode");
            if (b.hp <= 0) {
              applyLifesteal(b.pos.x, b.pos.y);
              b.dead = true;
              if (_playSound) _playSound("base_explode");
              if (_spawnLargeExplosion) _spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
              // Award coins directly: 6 coins * 5 value = 30 total
              if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: "coin" });
              // Award nugget directly
              if (_awardNuggetsInstant) _awardNuggetsInstant(1, { noSound: false, sound: "coin" });
              GameContext.pinwheelsDestroyed++;
              GameContext.pinwheelsDestroyedTotal++;
              // Update difficulty tier based on total pinwheels and gunboats destroyed
              const totalDestroyed =
                GameContext.pinwheelsDestroyedTotal + GameContext.gunboatsDestroyedTotal;
              GameContext.difficultyTier = 1 + Math.floor(totalDestroyed / 6);
              GameContext.score += 10000;
              const baseEl = document.getElementById("bases-display");
              if (baseEl) baseEl.innerText = `${GameContext.pinwheelsDestroyedTotal}`;
              GameContext.enemies.forEach(e => {
                if (e.assignedBase === b) e.type = "roamer";
              });
              const delay = 10000 + Math.random() * 10000;
              GameContext.baseRespawnTimers.push(Date.now() + delay);
            }
            hitEntity = true;
            break;
          }
        }
      }
      if (!hitEntity && GameContext.bossActive && GameContext.boss && !GameContext.boss.dead) {
        // Cruiser doesn't collide with shooting stars
        if (GameContext.boss instanceof Cruiser) continue;
        // Skip ship-boss collision for cave bosses - enemies can fly through them
        if (
          !GameContext.boss.isCaveBoss &&
          typeof GameContext.boss.hitTestCircle === "function" &&
          GameContext.boss.hitTestCircle(s.pos.x, s.pos.y, s.radius)
        ) {
          if (
            !(GameContext.boss.isWarpBoss && GameContext.boss.ramInvulnerable > 0) &&
            !(GameContext.boss instanceof Cruiser && GameContext.boss.invulnerableTimer > 0)
          ) {
            GameContext.boss.hp -= s.damage;
            showDamageFloatingText(GameContext.boss.pos.x, GameContext.boss.pos.y, s.damage, false);
            if (_spawnParticles)
              _spawnParticles(GameContext.boss.pos.x, GameContext.boss.pos.y, 22, "#fa0");
            if (_playSound) _playSound("explode");
            if (GameContext.boss.hp <= 0) {
              GameContext.boss.kill();
              GameContext.score += 5000;
            }
          }
          hitEntity = true;
        }
      }
      if (!hitEntity && GameContext.spaceStation) {
        const dist = Math.hypot(
          s.pos.x - GameContext.spaceStation.pos.x,
          s.pos.y - GameContext.spaceStation.pos.y
        );
        if (dist < s.radius + GameContext.spaceStation.radius) {
          GameContext.spaceStation.hp -= s.damage;
          showDamageFloatingText(
            GameContext.spaceStation.pos.x,
            GameContext.spaceStation.pos.y,
            s.damage,
            false
          );
          if (_spawnParticles)
            _spawnParticles(
              GameContext.spaceStation.pos.x,
              GameContext.spaceStation.pos.y,
              22,
              "#fa0"
            );
          if (_playSound) _playSound("explode");
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
          if (_spawnParticles) _spawnParticles(ast.pos.x, ast.pos.y, 10, "#fa0");
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
          if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 8, "#aa8");
          if (_playSound) _playSound("hit");
        } else {
          const wallColor =
            astCol.kind === "anomaly_wall" ? "#0f0" : astCol.kind === "cave_wall" ? "#88f" : "#0ff";
          if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 6, wallColor);
          if (_playSound) _playSound("hit");
        }
      }

      if (!hit) {
        if (b.isEnemy) {
          if (!GameContext.player.dead && GameContext.player.invulnerable <= 0) {
            const dx = b.pos.x - GameContext.player.pos.x;
            const dy = b.pos.y - GameContext.player.pos.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (
              !hit &&
              GameContext.player.outerShieldSegments &&
              GameContext.player.outerShieldSegments.some(s => s > 0) &&
              dist < GameContext.player.outerShieldRadius + b.radius * 1.5 &&
              dist > GameContext.player.outerShieldRadius - b.radius * 2
            ) {
              let angle =
                Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) -
                GameContext.player.outerShieldRotation;
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
                if (_playSound) _playSound("shield_hit");
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 7, "#b0f");
              }
            }
            if (
              !hit &&
              dist < GameContext.player.shieldRadius + b.radius * 1.5 &&
              dist > GameContext.player.shieldRadius - b.radius * 2
            ) {
              let angle =
                Math.atan2(b.pos.y - GameContext.player.pos.y, b.pos.x - GameContext.player.pos.x) -
                GameContext.player.shieldRotation;
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
                if (_playSound) _playSound("shield_hit");
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
              }
            }
            const hitDist = GameContext.player.radius * 1.5 + b.radius * 1.5;
            if (!hit && distSq < hitDist * hitDist) {
              const damage = b.directHitDamage !== undefined ? b.directHitDamage : b.damage;
              GameContext.player.takeHit(damage, true);
              hit = true;
            }
          }
        } else {
          for (let mi = 0, mlen = GameContext.guidedMissiles.length; mi < mlen; mi++) {
            const m = GameContext.guidedMissiles[mi];
            if (!m || m.dead) continue;
            const dx = b.pos.x - m.pos.x;
            const dy = b.pos.y - m.pos.y;
            const hitRad = (m.radius || 0) + (b.radius || 0);
            if (dx * dx + dy * dy < hitRad * hitRad) {
              if (typeof m.takeHit === "function") m.takeHit(b.damage);
              else if (typeof m.explode === "function") m.explode("#ff0");
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
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 4, "#fff");
                break;
              }
            }
            if (e instanceof WarpShieldDrone || e.isWarpShieldDrone) {
              if (b.isEnemy) continue;
              const dx = b.pos.x - e.pos.x;
              const dy = b.pos.y - e.pos.y;
              const distSq = dx * dx + dy * dy;
              const hitRadius = e.radius + b.radius;
              if (distSq < hitRadius * hitRadius) {
                const critResult = applyCriticalStrike(b.damage, e.pos.x, e.pos.y);
                if (!critResult.isCrit) {
                  showDamageFloatingText(e.pos.x, e.pos.y, critResult.damage, false);
                }
                trackDamageByWeaponType(b, critResult.damage);
                e.hp -= critResult.damage;
                hit = true;
                b.dead = true;
                // Stop bullet movement immediately
                b.vel.x = 0;
                b.vel.y = 0;
                // Clamp bullet position to collision point to prevent visual pass-through
                const dist = Math.sqrt(distSq);
                if (dist > 0) {
                  const overlap = hitRadius - dist;
                  const nx = dx / dist;
                  const ny = dy / dist;
                  b.pos.x = e.pos.x + nx * (e.radius + b.radius);
                  b.pos.y = e.pos.y + ny * (e.radius + b.radius);
                  b.prevPos.x = b.pos.x;
                  b.prevPos.y = b.pos.y;
                }
                if (_playSound) _playSound("hit");
                if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, "#0af");

                // Chain lightning support
                if (
                  GameContext.player.chainLightningCount &&
                  GameContext.player.chainLightningCount > 0 &&
                  GameContext.player.chainLightningRange &&
                  !b.isEnemy
                ) {
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
                      const isCavePinwheel =
                        other instanceof CavePinwheel1 ||
                        other instanceof CavePinwheel2 ||
                        other instanceof CavePinwheel3;
                      const isShieldDrone =
                        other instanceof WarpShieldDrone || other.isWarpShieldDrone;
                      if (!isEnemy && !isPinwheel && !isCavePinwheel && !isShieldDrone) continue;
                      if (other === GameContext.boss) continue;
                      if (chainTargets.has(other)) continue;

                      const d = Math.hypot(
                        other.pos.x - chainSource.pos.x,
                        other.pos.y - chainSource.pos.y
                      );
                      if (d < nearestDist) {
                        nearestDist = d;
                        nearestTarget = other;
                      }
                    }

                    if (nearestTarget) {
                      const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                      trackChainLightningDamage(chainDamage);
                      nearestTarget.hp -= chainDamage;
                      showDamageFloatingText(
                        nearestTarget.pos.x,
                        nearestTarget.pos.y,
                        chainDamage,
                        false
                      );
                      chainTargets.add(nearestTarget);

                      if (_spawnLightningArc)
                        _spawnLightningArc(
                          chainSource.pos.x,
                          chainSource.pos.y,
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          "#0ff"
                        );
                      if (_spawnParticles)
                        _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, "#0ff");
                      if (_playSound) _playSound("hit");

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

                // Explosive Rounds meta upgrade - chance to create explosion on hit
                if (
                  !b.isEnemy &&
                  GameContext.player &&
                  GameContext.player.stats &&
                  GameContext.player.stats.explosiveChance > 0 &&
                  Math.random() < GameContext.player.stats.explosiveChance
                ) {
                  const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                  const explosiveRange = 200;
                  GameContext.shockwaves.push(
                    new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                      damageAsteroids: true,
                      damageEnemies: true,
                      ignoreOwner: true
                    })
                  );
                }

                if (e.hp <= 0) {
                  applyLifesteal(e.pos.x, e.pos.y);
                  e.kill();
                  GameContext.score += 100;
                }
                break;
              }
            }
            if (e instanceof Enemy) {
              // Skip damage for non-dungeon bosses stored in GameContext.boss (they have separate collision handling)
              // Dungeon bosses need to go through normal shield checking logic
              if (
                GameContext.bossActive &&
                GameContext.boss &&
                e === GameContext.boss &&
                !e.isDungeonBoss
              )
                continue;
              // Skip damage if Cruiser is invulnerable
              if (e instanceof Cruiser && e.invulnerableTimer > 0) continue;

              const dx = b.pos.x - e.pos.x;
              const dy = b.pos.y - e.pos.y;
              const distSq = dx * dx + dy * dy;
              const dist = Math.sqrt(distSq);

              // Check shields: shields protect the hull, so if bullet is within shield radius and shield is active, block it
              // Check outer shield first (if bullet is within outer shield radius)
              if (
                !b.ignoreShields &&
                e.shieldSegments &&
                e.shieldSegments.length > 0 &&
                dist < e.shieldRadius + b.radius
              ) {
                // Find the shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                const segCount = e.shieldSegments.length;
                const segAngle = (Math.PI * 2) / segCount;
                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;

                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                const shouldCheckOuterShield =
                  !e.innerShieldSegments ||
                  e.innerShieldSegments.length === 0 ||
                  dist > e.innerShieldRadius;

                if (shouldCheckOuterShield && e.shieldSegments[segmentIdx] > 0) {
                  const segmentHp = e.shieldSegments[segmentIdx];
                  _shieldBypassLog(
                    "Gunboat OUTER SHIELD HIT - segment",
                    segmentIdx,
                    "was",
                    segmentHp,
                    "HP, took",
                    b.damage,
                    "damage, entity hp",
                    e.hp
                  );
                  if (b.damage >= segmentHp) {
                    e.shieldSegments[segmentIdx] = 0;
                    _shieldBypassLog("Gunboat shield segment DESTROYED");
                  } else {
                    e.shieldSegments[segmentIdx] -= b.damage;
                    _shieldBypassLog(
                      "Gunboat shield segment now at",
                      e.shieldSegments[segmentIdx],
                      "HP, entity hp",
                      e.hp
                    );
                  }
                  e.shieldsDirty = true;
                  hit = true;
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  // FIX: Destroy bullet after hitting shield to prevent it from continuing to hull
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Check inner shield (if bullet is within inner shield radius but outside hull)
              if (
                !hit &&
                !b.ignoreShields &&
                e.innerShieldSegments &&
                e.innerShieldSegments.length > 0 &&
                dist < e.innerShieldRadius + b.radius &&
                dist > e.radius + b.radius
              ) {
                // Find the inner shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Also check if bullet is inside hull but would pass through active shields
              // If there are active shields, they should block even bullets that are "inside" the hull visually
              if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                // Check if any shields are still active - if so, they should block
                const hasActiveOuter =
                  e.shieldSegments &&
                  e.shieldSegments.length > 0 &&
                  e.shieldSegments.some(s => s > 0);
                const hasActiveInner =
                  e.innerShieldSegments &&
                  e.innerShieldSegments.length > 0 &&
                  e.innerShieldSegments.some(s => s > 0);

                if (hasActiveOuter || hasActiveInner) {
                  // Bullet is inside hull radius but shields are still up - check which shield should block
                  const angle = Math.atan2(dy, dx);

                  // Check inner shield first (closer to hull)
                  if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                    const innerCount = e.innerShieldSegments.length;
                    const innerAngle = (Math.PI * 2) / innerCount;
                    const segmentIdx = Math.floor(normalizedAngle / innerAngle) % innerCount;

                    if (e.innerShieldSegments[segmentIdx] > 0) {
                      const segmentHp = e.innerShieldSegments[segmentIdx];
                      _shieldBypassLog(
                        "Gunboat INNER SHIELD HIT - segment",
                        segmentIdx,
                        "was",
                        segmentHp,
                        "HP, took",
                        b.damage,
                        "damage, entity hp",
                        e.hp
                      );
                      if (b.damage >= segmentHp) {
                        e.innerShieldSegments[segmentIdx] = 0;
                        _shieldBypassLog("Gunboat inner shield segment DESTROYED");
                      } else {
                        e.innerShieldSegments[segmentIdx] -= b.damage;
                        _shieldBypassLog(
                          "Gunboat inner shield segment now at",
                          e.innerShieldSegments[segmentIdx],
                          "HP, entity hp",
                          e.hp
                        );
                      }
                      e.shieldsDirty = true;
                      hit = true;
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                      // FIX: Destroy bullet after hitting inner shield
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }

                  // If inner didn't block, check outer shield
                  if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                      // FIX: Destroy bullet after hitting outer shield
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }
                }
              }

              const hitRadius = e.radius + b.radius;
              if (!hit && distSq < hitRadius * hitRadius) {
                // Check shield segments at the bullet's angle (same robust logic as Pinwheel)
                const angle = Math.atan2(dy, dx);
                let hasShieldAtAngle = false;
                /** When blocking, which segment took the hit: { inner: index } or { outer: index } */
                let blockingSegment = null;

                const hasGunboatShields =
                  e.shieldSegments?.length && (e.isGunboat || e.shieldRadius);

                // Check inner shield at this angle
                if (e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                  const normInner =
                    (((angle - (e.innerShieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const innerCount = e.innerShieldSegments.length;
                  const innerAngle = (Math.PI * 2) / innerCount;
                  const innerIdx = Math.floor(normInner / innerAngle) % innerCount;
                  if (e.innerShieldSegments[innerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { inner: innerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && hasGunboatShields) {
                    for (let i = 0; i < innerCount; i++) {
                      if (e.innerShieldSegments[i] <= 0) continue;
                      const a0 = i * innerAngle;
                      const a1 = (i + 1) * innerAngle;
                      if (normInner >= a0 - 0.02 && normInner < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { inner: i };
                        break;
                      }
                    }
                  }
                }

                // Check outer shield at this angle (only if inner didn't block)
                if (!hasShieldAtAngle && e.shieldSegments && e.shieldSegments.length > 0) {
                  const normOuter =
                    (((angle - (e.shieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const segCount = e.shieldSegments.length;
                  const segAngle = (Math.PI * 2) / segCount;
                  const outerIdx = Math.floor(normOuter / segAngle) % segCount;
                  if (e.shieldSegments[outerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { outer: outerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && hasGunboatShields) {
                    for (let i = 0; i < segCount; i++) {
                      if (e.shieldSegments[i] <= 0) continue;
                      const a0 = i * segAngle;
                      const a1 = (i + 1) * segAngle;
                      if (normOuter >= a0 - 0.02 && normOuter < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { outer: i };
                        break;
                      }
                    }
                  }
                }

                // Apply HP damage if no shield at this angle
                if (!hasShieldAtAngle) {
                  const critResult = applyCriticalStrike(b.damage, e.pos.x, e.pos.y);
                  if (!critResult.isCrit) {
                    showDamageFloatingText(e.pos.x, e.pos.y, critResult.damage, false);
                  }
                  trackDamageByWeaponType(b, critResult.damage);
                  if (e.shieldSegments?.length || e.isGunboat) {
                    _shieldBypassLog(
                      "Gunboat HULL BYPASS - damage",
                      critResult.damage,
                      "dist",
                      dist.toFixed(0),
                      "ignoreShields",
                      !!b.ignoreShields,
                      "entity hp",
                      e.hp,
                      "->",
                      e.hp - critResult.damage
                    );
                  }
                  e.hp -= critResult.damage;
                  hit = true;
                  if (_playSound) _playSound("hit");
                  if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, "#fff");
                } else {
                  // Shield at this angle still active - block and apply damage to the segment
                  hit = true;
                  if (blockingSegment) {
                    if (blockingSegment.inner !== undefined) {
                      const idx = blockingSegment.inner;
                      const segHp = e.innerShieldSegments[idx];
                      if (segHp > 0) {
                        e.innerShieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    } else if (blockingSegment.outer !== undefined) {
                      const idx = blockingSegment.outer;
                      const segHp = e.shieldSegments[idx];
                      if (segHp > 0) {
                        e.shieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    }
                  }
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }

                if (
                  GameContext.player.chainLightningCount &&
                  GameContext.player.chainLightningCount > 0 &&
                  GameContext.player.chainLightningRange &&
                  !b.isEnemy
                ) {
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
                      const isCavePinwheel =
                        other instanceof CavePinwheel1 ||
                        other instanceof CavePinwheel2 ||
                        other instanceof CavePinwheel3;
                      if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                      if (other === GameContext.boss) continue;
                      if (chainTargets.has(other)) continue;

                      const d = Math.hypot(
                        other.pos.x - chainSource.pos.x,
                        other.pos.y - chainSource.pos.y
                      );
                      if (d < nearestDist) {
                        nearestDist = d;
                        nearestTarget = other;
                      }
                    }

                    if (nearestTarget) {
                      const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                      trackChainLightningDamage(chainDamage);
                      if (nearestTarget === GameContext.destroyer) {
                        const hpBefore = nearestTarget.hp;
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      } else {
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      }
                      chainTargets.add(nearestTarget);

                      if (_spawnLightningArc)
                        _spawnLightningArc(
                          chainSource.pos.x,
                          chainSource.pos.y,
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          "#0ff"
                        );
                      if (_spawnParticles)
                        _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, "#0ff");
                      if (_playSound) _playSound("hit");

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

                // Explosive Rounds meta upgrade
                if (
                  !b.isEnemy &&
                  GameContext.player &&
                  GameContext.player.stats &&
                  GameContext.player.stats.explosiveChance > 0 &&
                  Math.random() < GameContext.player.stats.explosiveChance
                ) {
                  const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                  const explosiveRange = 200;
                  GameContext.shockwaves.push(
                    new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                      damageAsteroids: true,
                      damageEnemies: true,
                      ignoreOwner: true
                    })
                  );
                }

                if (e.hp <= 0) {
                  applyLifesteal(e.pos.x, e.pos.y);
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
              if (
                !b.ignoreShields &&
                e.shieldSegments &&
                e.shieldSegments.length > 0 &&
                dist < e.shieldRadius + b.radius
              ) {
                // Find the shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                const segCount = e.shieldSegments.length;
                const segAngle = (Math.PI * 2) / segCount;
                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;

                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                const shouldCheckOuterShield =
                  !e.innerShieldSegments ||
                  e.innerShieldSegments.length === 0 ||
                  dist > e.innerShieldRadius;

                if (shouldCheckOuterShield && e.shieldSegments[segmentIdx] > 0) {
                  const segmentHp = e.shieldSegments[segmentIdx];
                  _shieldBypassLog(
                    "Pinwheel OUTER SHIELD HIT - segment",
                    segmentIdx,
                    "took",
                    b.damage,
                    "entity hp",
                    e.hp
                  );
                  if (b.damage >= segmentHp) {
                    e.shieldSegments[segmentIdx] = 0;
                  } else {
                    e.shieldSegments[segmentIdx] -= b.damage;
                  }
                  e.shieldsDirty = true;
                  hit = true;
                  e.aggro = true;
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Check inner shield (if bullet is within inner shield radius but outside hull)
              if (
                !hit &&
                !b.ignoreShields &&
                e.innerShieldSegments &&
                e.innerShieldSegments.length > 0 &&
                dist < e.innerShieldRadius + b.radius &&
                dist > e.radius + b.radius
              ) {
                // Find the inner shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                  _shieldBypassLog(
                    "Pinwheel INNER SHIELD HIT - segment",
                    segmentIdx,
                    "took",
                    b.damage,
                    "entity hp",
                    e.hp
                  );
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Also check if bullet is inside hull but would pass through active shields
              // If there are active shields, they should block even bullets that are "inside" the hull visually
              if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                // Check if any shields are still active - if so, they should block
                const hasActiveOuter =
                  e.shieldSegments &&
                  e.shieldSegments.length > 0 &&
                  e.shieldSegments.some(s => s > 0);
                const hasActiveInner =
                  e.innerShieldSegments &&
                  e.innerShieldSegments.length > 0 &&
                  e.innerShieldSegments.some(s => s > 0);

                if (hasActiveOuter || hasActiveInner) {
                  // Bullet is inside hull radius but shields are still up - check which shield should block
                  const angle = Math.atan2(dy, dx);

                  // Check inner shield first (closer to hull)
                  if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }

                  // If inner didn't block, check outer shield
                  if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }
                }
              }

              const hitRadius = e.radius + b.radius;
              if (!hit && distSq < hitRadius * hitRadius) {
                // Final gate: check shield at bullet's angle so we never apply hull damage when a segment is still up.
                // Use explicit "angle within segment arc" check so we block whenever the bullet is inside shield radius and any segment has HP.
                const angle = Math.atan2(dy, dx);
                let hasShieldAtAngle = false;
                /** When blocking, which segment took the hit: { inner: index } or { outer: index } */
                let blockingSegment = null;

                const isPinwheelOrCave =
                  e instanceof Pinwheel ||
                  e instanceof CavePinwheel1 ||
                  e instanceof CavePinwheel2 ||
                  e instanceof CavePinwheel3;

                if (e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                  const innerCount = e.innerShieldSegments.length;
                  const innerAngle = (Math.PI * 2) / innerCount;
                  const normInner =
                    (((angle - (e.innerShieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const innerIdx = Math.floor(normInner / innerAngle) % innerCount;
                  if (e.innerShieldSegments[innerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { inner: innerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && isPinwheelOrCave) {
                    for (let i = 0; i < innerCount; i++) {
                      if (e.innerShieldSegments[i] <= 0) continue;
                      const a0 = i * innerAngle;
                      const a1 = (i + 1) * innerAngle;
                      if (normInner >= a0 - 0.02 && normInner < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { inner: i };
                        break;
                      }
                    }
                  }
                }
                if (!hasShieldAtAngle && e.shieldSegments && e.shieldSegments.length > 0) {
                  const segCount = e.shieldSegments.length;
                  const segAngle = (Math.PI * 2) / segCount;
                  const normOuter =
                    (((angle - (e.shieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const outerIdx = Math.floor(normOuter / segAngle) % segCount;
                  if (e.shieldSegments[outerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { outer: outerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && isPinwheelOrCave) {
                    for (let i = 0; i < segCount; i++) {
                      if (e.shieldSegments[i] <= 0) continue;
                      const a0 = i * segAngle;
                      const a1 = (i + 1) * segAngle;
                      if (normOuter >= a0 - 0.02 && normOuter < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { outer: i };
                        break;
                      }
                    }
                  }
                }

                if (!hasShieldAtAngle) {
                  const critResult = applyCriticalStrike(b.damage, e.pos.x, e.pos.y);
                  if (!critResult.isCrit) {
                    showDamageFloatingText(e.pos.x, e.pos.y, critResult.damage, false);
                  }
                  trackDamageByWeaponType(b, critResult.damage);
                  if (
                    e instanceof Pinwheel ||
                    e instanceof CavePinwheel1 ||
                    e instanceof CavePinwheel2 ||
                    e instanceof CavePinwheel3
                  ) {
                    _shieldBypassLog(
                      (e instanceof Pinwheel ? "Pinwheel" : "CavePinwheel") +
                        " HULL BYPASS - damage",
                      critResult.damage,
                      "dist",
                      dist.toFixed(0),
                      "ignoreShields",
                      !!b.ignoreShields,
                      "entity hp",
                      e.hp,
                      "->",
                      e.hp - critResult.damage
                    );
                  }
                  e.hp -= critResult.damage;
                  hit = true;
                  e.aggro = true;
                  if (_playSound) _playSound("hit");
                  if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, "#fff");
                } else {
                  // Shield at this angle still active - block and apply damage to the segment
                  hit = true;
                  e.aggro = true;
                  if (blockingSegment) {
                    if (blockingSegment.inner !== undefined) {
                      const idx = blockingSegment.inner;
                      const segHp = e.innerShieldSegments[idx];
                      if (segHp > 0) {
                        e.innerShieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    } else if (blockingSegment.outer !== undefined) {
                      const idx = blockingSegment.outer;
                      const segHp = e.shieldSegments[idx];
                      if (segHp > 0) {
                        e.shieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    }
                  }
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }

                if (
                  GameContext.player.chainLightningCount &&
                  GameContext.player.chainLightningCount > 0 &&
                  GameContext.player.chainLightningRange &&
                  !b.isEnemy
                ) {
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
                      const isCavePinwheel =
                        other instanceof CavePinwheel1 ||
                        other instanceof CavePinwheel2 ||
                        other instanceof CavePinwheel3;
                      if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                      if (other === GameContext.boss) continue;
                      if (chainTargets.has(other)) continue;

                      const d = Math.hypot(
                        other.pos.x - chainSource.pos.x,
                        other.pos.y - chainSource.pos.y
                      );
                      if (d < nearestDist) {
                        nearestDist = d;
                        nearestTarget = other;
                      }
                    }

                    if (nearestTarget) {
                      const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                      trackChainLightningDamage(chainDamage);
                      if (nearestTarget === GameContext.destroyer) {
                        const hpBefore = nearestTarget.hp;
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      } else {
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      }
                      chainTargets.add(nearestTarget);

                      if (_spawnLightningArc)
                        _spawnLightningArc(
                          chainSource.pos.x,
                          chainSource.pos.y,
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          "#0ff"
                        );
                      if (_spawnParticles)
                        _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, "#0ff");
                      if (_playSound) _playSound("hit");

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

                // Explosive Rounds meta upgrade
                if (
                  !b.isEnemy &&
                  GameContext.player &&
                  GameContext.player.stats &&
                  GameContext.player.stats.explosiveChance > 0 &&
                  Math.random() < GameContext.player.stats.explosiveChance
                ) {
                  const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                  const explosiveRange = 200;
                  GameContext.shockwaves.push(
                    new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                      damageAsteroids: true,
                      damageEnemies: true,
                      ignoreOwner: true
                    })
                  );
                }

                if (e.hp <= 0) {
                  e.dead = true;
                  if (_playSound) _playSound("base_explode");
                  if (_spawnLargeExplosion) _spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);
                  // Award coins directly: 6 coins * 5 value = 30 total
                  if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: "coin" });
                  // Award nugget directly
                  if (_awardNuggetsInstant)
                    _awardNuggetsInstant(1, { noSound: false, sound: "coin" });
                }
                break;
              }
            }
            // Cave Pinwheels (CavePinwheel1, CavePinwheel2, CavePinwheel3) - same collision logic as regular Pinwheels
            if (
              e instanceof CavePinwheel1 ||
              e instanceof CavePinwheel2 ||
              e instanceof CavePinwheel3
            ) {
              if (b.isEnemy) continue;
              const dx = b.pos.x - e.pos.x;
              const dy = b.pos.y - e.pos.y;
              const distSq = dx * dx + dy * dy;
              const dist = Math.sqrt(distSq);

              // Check shields: shields protect the hull, so if bullet is within shield radius and shield is active, block it
              // Check outer shield first (if bullet is within outer shield radius)
              if (
                !b.ignoreShields &&
                e.shieldSegments &&
                e.shieldSegments.length > 0 &&
                dist < e.shieldRadius + b.radius
              ) {
                // Find the shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
                const segCount = e.shieldSegments.length;
                const segAngle = (Math.PI * 2) / segCount;
                const segmentIdx = Math.floor(normalizedAngle / segAngle) % segCount;

                // Only check outer shield if bullet is outside inner shield (or no inner shield exists)
                const shouldCheckOuterShield =
                  !e.innerShieldSegments ||
                  e.innerShieldSegments.length === 0 ||
                  dist > e.innerShieldRadius;

                if (shouldCheckOuterShield && e.shieldSegments[segmentIdx] > 0) {
                  const segmentHp = e.shieldSegments[segmentIdx];
                  _shieldBypassLog(
                    "CavePinwheel OUTER SHIELD HIT - segment",
                    segmentIdx,
                    "took",
                    b.damage,
                    "entity hp",
                    e.hp
                  );
                  if (b.damage >= segmentHp) {
                    e.shieldSegments[segmentIdx] = 0;
                  } else {
                    e.shieldSegments[segmentIdx] -= b.damage;
                  }
                  e.shieldsDirty = true;
                  hit = true;
                  e.aggro = true;
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Check inner shield (if bullet is within inner shield radius but outside hull)
              if (
                !hit &&
                !b.ignoreShields &&
                e.innerShieldSegments &&
                e.innerShieldSegments.length > 0 &&
                dist < e.innerShieldRadius + b.radius &&
                dist > e.radius + b.radius
              ) {
                // Find the inner shield segment based on angle
                const angle = Math.atan2(dy, dx);
                const normalizedAngle =
                  (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                  _shieldBypassLog(
                    "CavePinwheel INNER SHIELD HIT - segment",
                    segmentIdx,
                    "took",
                    b.damage,
                    "entity hp",
                    e.hp
                  );
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }
              }
              // Also check if bullet is inside hull but would pass through active shields
              // If there are active shields, they should block even bullets that are "inside" the hull visually
              if (!hit && !b.ignoreShields && dist < e.radius + b.radius) {
                // Check if any shields are still active - if so, they should block
                const hasActiveOuter =
                  e.shieldSegments &&
                  e.shieldSegments.length > 0 &&
                  e.shieldSegments.some(s => s > 0);
                const hasActiveInner =
                  e.innerShieldSegments &&
                  e.innerShieldSegments.length > 0 &&
                  e.innerShieldSegments.some(s => s > 0);

                if (hasActiveOuter || hasActiveInner) {
                  // Bullet is inside hull radius but shields are still up - check which shield should block
                  const angle = Math.atan2(dy, dx);

                  // Check inner shield first (closer to hull)
                  if (hasActiveInner && e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.innerShieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#ff0");
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }

                  // If inner didn't block, check outer shield
                  if (!hit && hasActiveOuter && e.shieldSegments && e.shieldSegments.length > 0) {
                    const normalizedAngle =
                      (angle - (e.shieldRotation || 0) + Math.PI * 2) % (Math.PI * 2);
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
                      if (_playSound) _playSound("enemy_shield_hit");
                      if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                      b.dead = true;
                      b.vel.x = 0;
                      b.vel.y = 0;
                    }
                  }
                }
              }

              const hitRadius = e.radius + b.radius;
              if (!hit && distSq < hitRadius * hitRadius) {
                // Final gate: check shield at bullet's angle so we never apply hull damage when a segment is still up.
                // Use explicit "angle within segment arc" check so we block whenever the bullet is inside shield radius and any segment has HP.
                const angle = Math.atan2(dy, dx);
                let hasShieldAtAngle = false;
                /** When blocking, which segment took the hit: { inner: index } or { outer: index } */
                let blockingSegment = null;

                const isPinwheelOrCave =
                  e instanceof Pinwheel ||
                  e instanceof CavePinwheel1 ||
                  e instanceof CavePinwheel2 ||
                  e instanceof CavePinwheel3;

                if (e.innerShieldSegments && e.innerShieldSegments.length > 0) {
                  const innerCount = e.innerShieldSegments.length;
                  const innerAngle = (Math.PI * 2) / innerCount;
                  const normInner =
                    (((angle - (e.innerShieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const innerIdx = Math.floor(normInner / innerAngle) % innerCount;
                  if (e.innerShieldSegments[innerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { inner: innerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && isPinwheelOrCave) {
                    for (let i = 0; i < innerCount; i++) {
                      if (e.innerShieldSegments[i] <= 0) continue;
                      const a0 = i * innerAngle;
                      const a1 = (i + 1) * innerAngle;
                      if (normInner >= a0 - 0.02 && normInner < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { inner: i };
                        break;
                      }
                    }
                  }
                }
                if (!hasShieldAtAngle && e.shieldSegments && e.shieldSegments.length > 0) {
                  const segCount = e.shieldSegments.length;
                  const segAngle = (Math.PI * 2) / segCount;
                  const normOuter =
                    (((angle - (e.shieldRotation ?? 0)) % (Math.PI * 2)) + Math.PI * 2) %
                    (Math.PI * 2);
                  const outerIdx = Math.floor(normOuter / segAngle) % segCount;
                  if (e.shieldSegments[outerIdx] > 0) {
                    hasShieldAtAngle = true;
                    blockingSegment = { outer: outerIdx };
                  }
                  // Fallback: any segment with HP contains this angle (handles boundaries)
                  if (!hasShieldAtAngle && isPinwheelOrCave) {
                    for (let i = 0; i < segCount; i++) {
                      if (e.shieldSegments[i] <= 0) continue;
                      const a0 = i * segAngle;
                      const a1 = (i + 1) * segAngle;
                      if (normOuter >= a0 - 0.02 && normOuter < a1 + 0.02) {
                        hasShieldAtAngle = true;
                        blockingSegment = { outer: i };
                        break;
                      }
                    }
                  }
                }

                if (!hasShieldAtAngle) {
                  const critResult = applyCriticalStrike(b.damage, e.pos.x, e.pos.y);
                  if (!critResult.isCrit) {
                    showDamageFloatingText(e.pos.x, e.pos.y, critResult.damage, false);
                  }
                  trackDamageByWeaponType(b, critResult.damage);
                  if (
                    e instanceof Pinwheel ||
                    e instanceof CavePinwheel1 ||
                    e instanceof CavePinwheel2 ||
                    e instanceof CavePinwheel3
                  ) {
                    _shieldBypassLog(
                      (e instanceof Pinwheel ? "Pinwheel" : "CavePinwheel") +
                        " HULL BYPASS - damage",
                      critResult.damage,
                      "dist",
                      dist.toFixed(0),
                      "ignoreShields",
                      !!b.ignoreShields,
                      "entity hp",
                      e.hp,
                      "->",
                      e.hp - critResult.damage
                    );
                  }
                  e.hp -= critResult.damage;
                  hit = true;
                  e.aggro = true;
                  if (_playSound) _playSound("hit");
                  if (_spawnParticles) _spawnParticles(e.pos.x, e.pos.y, 3, "#fff");
                } else {
                  // Shield at this angle still active - block and apply damage to the segment
                  hit = true;
                  e.aggro = true;
                  if (blockingSegment) {
                    if (blockingSegment.inner !== undefined) {
                      const idx = blockingSegment.inner;
                      const segHp = e.innerShieldSegments[idx];
                      if (segHp > 0) {
                        e.innerShieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    } else if (blockingSegment.outer !== undefined) {
                      const idx = blockingSegment.outer;
                      const segHp = e.shieldSegments[idx];
                      if (segHp > 0) {
                        e.shieldSegments[idx] = Math.max(0, segHp - b.damage);
                        e.shieldsDirty = true;
                      }
                    }
                  }
                  if (_playSound) _playSound("enemy_shield_hit");
                  if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                  b.dead = true;
                  b.vel.x = 0;
                  b.vel.y = 0;
                }

                if (
                  GameContext.player.chainLightningCount &&
                  GameContext.player.chainLightningCount > 0 &&
                  GameContext.player.chainLightningRange &&
                  !b.isEnemy
                ) {
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
                      const isCavePinwheel =
                        other instanceof CavePinwheel1 ||
                        other instanceof CavePinwheel2 ||
                        other instanceof CavePinwheel3;
                      if (!isEnemy && !isPinwheel && !isCavePinwheel) continue;
                      if (other === GameContext.boss) continue;
                      if (chainTargets.has(other)) continue;

                      const d = Math.hypot(
                        other.pos.x - chainSource.pos.x,
                        other.pos.y - chainSource.pos.y
                      );
                      if (d < nearestDist) {
                        nearestDist = d;
                        nearestTarget = other;
                      }
                    }

                    if (nearestTarget) {
                      const chainDamage = b.damage * Math.pow(0.7, chain + 1);
                      trackChainLightningDamage(chainDamage);
                      if (nearestTarget === GameContext.destroyer) {
                        const hpBefore = nearestTarget.hp;
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      } else {
                        nearestTarget.hp -= chainDamage;
                        showDamageFloatingText(
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          chainDamage,
                          false
                        );
                      }
                      chainTargets.add(nearestTarget);

                      if (_spawnLightningArc)
                        _spawnLightningArc(
                          chainSource.pos.x,
                          chainSource.pos.y,
                          nearestTarget.pos.x,
                          nearestTarget.pos.y,
                          "#0ff"
                        );
                      if (_spawnParticles)
                        _spawnParticles(nearestTarget.pos.x, nearestTarget.pos.y, 3, "#0ff");
                      if (_playSound) _playSound("hit");

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

                // Explosive Rounds meta upgrade
                if (
                  !b.isEnemy &&
                  GameContext.player &&
                  GameContext.player.stats &&
                  GameContext.player.stats.explosiveChance > 0 &&
                  Math.random() < GameContext.player.stats.explosiveChance
                ) {
                  const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                  const explosiveRange = 200;
                  GameContext.shockwaves.push(
                    new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                      damageAsteroids: true,
                      damageEnemies: true,
                      ignoreOwner: true
                    })
                  );
                }

                if (e.hp <= 0) {
                  e.dead = true;
                  if (_playSound) _playSound("base_explode");
                  if (_spawnLargeExplosion) _spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);
                  // Award coins directly: 6 coins * 5 value = 30 total
                  if (_awardCoinsInstant) _awardCoinsInstant(30, { noSound: false, sound: "coin" });
                  // Award nugget directly
                  if (_awardNuggetsInstant)
                    _awardNuggetsInstant(1, { noSound: false, sound: "coin" });
                }
                break;
              }
            }
            if (
              GameContext.contractEntities &&
              GameContext.contractEntities.fortresses &&
              GameContext.contractEntities.fortresses.length > 0
            ) {
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
                  if (_playSound) _playSound("hit");
                  if (_spawnParticles) _spawnParticles(f.pos.x, f.pos.y, 6, "#fff");

                  // Explosive Rounds meta upgrade
                  if (
                    !b.isEnemy &&
                    GameContext.player &&
                    GameContext.player.stats &&
                    GameContext.player.stats.explosiveChance > 0 &&
                    Math.random() < GameContext.player.stats.explosiveChance
                  ) {
                    const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                    const explosiveRange = 200;
                    GameContext.shockwaves.push(
                      new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                        damageAsteroids: true,
                        damageEnemies: true,
                        ignoreOwner: true
                      })
                    );
                  }

                  if (f.hp <= 0) {
                    if (typeof f.kill === "function") f.kill();
                    else f.dead = true;
                  }
                  break;
                }
              }
            }
            if (
              GameContext.contractEntities &&
              GameContext.contractEntities.wallTurrets &&
              GameContext.contractEntities.wallTurrets.length > 0
            ) {
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
                  if (_playSound) _playSound("hit");
                  if (_spawnParticles) _spawnParticles(t.pos.x, t.pos.y, 6, "#fff");

                  // Explosive Rounds meta upgrade
                  if (
                    !b.isEnemy &&
                    GameContext.player &&
                    GameContext.player.stats &&
                    GameContext.player.stats.explosiveChance > 0 &&
                    Math.random() < GameContext.player.stats.explosiveChance
                  ) {
                    const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                    const explosiveRange = 200;
                    GameContext.shockwaves.push(
                      new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                        damageAsteroids: true,
                        damageEnemies: true,
                        ignoreOwner: true
                      })
                    );
                  }

                  if (t.hp <= 0) {
                    if (typeof t.kill === "function") t.kill();
                    else t.dead = true;
                  }
                  break;
                }
              }
            }
          }
        }

        // Check cave wall turrets
        if (
          !hit &&
          !b.isEnemy &&
          GameContext.caveMode &&
          GameContext.caveLevel &&
          GameContext.caveLevel.active &&
          GameContext.caveLevel.wallTurrets &&
          GameContext.caveLevel.wallTurrets.length > 0
        ) {
          for (let t of GameContext.caveLevel.wallTurrets) {
            if (!t || t.dead) continue;
            if (typeof t.hitByPlayerBullet === "function" && t.hitByPlayerBullet(b)) {
              hit = true;
              break;
            }
          }
        }

        if (
          !hit &&
          !b.isEnemy &&
          GameContext.caveMode &&
          GameContext.caveLevel &&
          GameContext.caveLevel.active &&
          GameContext.caveLevel.switches &&
          GameContext.caveLevel.switches.length > 0
        ) {
          for (let s of GameContext.caveLevel.switches) {
            if (!s || s.dead) continue;
            if (typeof s.hitByPlayerBullet === "function" && s.hitByPlayerBullet(b)) {
              hit = true;
              break;
            }
          }
        }

        if (
          !hit &&
          !b.isEnemy &&
          GameContext.caveMode &&
          GameContext.caveLevel &&
          GameContext.caveLevel.active &&
          GameContext.caveLevel.relays &&
          GameContext.caveLevel.relays.length > 0
        ) {
          for (let r of GameContext.caveLevel.relays) {
            if (!r || r.dead) continue;
            if (typeof r.hitByPlayerBullet === "function" && r.hitByPlayerBullet(b)) {
              hit = true;
              break;
            }
          }
        }

        if (
          !hit &&
          !b.isEnemy &&
          GameContext.caveMode &&
          GameContext.caveLevel &&
          GameContext.caveLevel.active &&
          GameContext.caveLevel.critters &&
          GameContext.caveLevel.critters.length > 0
        ) {
          for (let c of GameContext.caveLevel.critters) {
            if (!c || c.dead) continue;
            const dist = Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y);
            if (dist < c.radius + b.radius) {
              c.dead = true;
              hit = true;
              if (_spawnParticles) _spawnParticles(c.pos.x, c.pos.y, 18, "#6f6");
              if (_playSound) _playSound("explode");
              if (
                GameContext.caveLevel.wallTurrets &&
                GameContext.caveLevel.wallTurrets.length > 0
              ) {
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
          const dist = Math.hypot(
            b.pos.x - GameContext.spaceStation.pos.x,
            b.pos.y - GameContext.spaceStation.pos.y
          );

          const outerShieldsUp =
            GameContext.spaceStation.shieldSegments &&
            GameContext.spaceStation.shieldSegments.some(s => s > 0);
          const innerShieldsUp =
            GameContext.spaceStation.innerShieldSegments &&
            GameContext.spaceStation.innerShieldSegments.some(s => s > 0);

          if (
            !hit &&
            !b.ignoreShields &&
            outerShieldsUp &&
            dist < GameContext.spaceStation.shieldRadius + b.radius
          ) {
            let angle =
              Math.atan2(
                b.pos.y - GameContext.spaceStation.pos.y,
                b.pos.x - GameContext.spaceStation.pos.x
              ) - GameContext.spaceStation.shieldRotation;
            while (angle < 0) angle += Math.PI * 2;
            const count = GameContext.spaceStation.shieldSegments.length;
            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
            if (GameContext.spaceStation.shieldSegments[idx] > 0) {
              const segHp = GameContext.spaceStation.shieldSegments[idx];
              GameContext.spaceStation.shieldSegments[idx] = Math.max(0, segHp - b.damage);
              GameContext.spaceStation.shieldsDirty = true;
              hit = true;
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            }
          }
          if (
            !hit &&
            !b.ignoreShields &&
            innerShieldsUp &&
            dist < GameContext.spaceStation.innerShieldRadius + b.radius
          ) {
            let angle =
              Math.atan2(
                b.pos.y - GameContext.spaceStation.pos.y,
                b.pos.x - GameContext.spaceStation.pos.x
              ) - GameContext.spaceStation.innerShieldRotation;
            while (angle < 0) angle += Math.PI * 2;
            const count = GameContext.spaceStation.innerShieldSegments.length;
            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
            if (GameContext.spaceStation.innerShieldSegments[idx] > 0) {
              const segHp = GameContext.spaceStation.innerShieldSegments[idx];
              GameContext.spaceStation.innerShieldSegments[idx] = Math.max(0, segHp - b.damage);
              GameContext.spaceStation.shieldsDirty = true;
              hit = true;
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#f0f");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            }
          }
          if (!hit && dist < GameContext.spaceStation.radius + b.radius) {
            // Final gate: block and damage segment if shield still up at this angle
            const angle = Math.atan2(
              b.pos.y - GameContext.spaceStation.pos.y,
              b.pos.x - GameContext.spaceStation.pos.x
            );
            let hasShieldAtAngle = false;
            let blockingInnerIdx = -1;
            let blockingOuterIdx = -1;
            if (
              GameContext.spaceStation.innerShieldSegments &&
              GameContext.spaceStation.innerShieldSegments.length > 0
            ) {
              const norm =
                (((angle - (GameContext.spaceStation.innerShieldRotation ?? 0)) % (Math.PI * 2)) +
                  Math.PI * 2) %
                (Math.PI * 2);
              const innerCount = GameContext.spaceStation.innerShieldSegments.length;
              const innerAngle = (Math.PI * 2) / innerCount;
              const innerIdx = Math.floor(norm / innerAngle) % innerCount;
              if (GameContext.spaceStation.innerShieldSegments[innerIdx] > 0) {
                hasShieldAtAngle = true;
                blockingInnerIdx = innerIdx;
              }
            }
            if (
              !hasShieldAtAngle &&
              GameContext.spaceStation.shieldSegments &&
              GameContext.spaceStation.shieldSegments.length > 0
            ) {
              const norm =
                (((angle - (GameContext.spaceStation.shieldRotation ?? 0)) % (Math.PI * 2)) +
                  Math.PI * 2) %
                (Math.PI * 2);
              const segCount = GameContext.spaceStation.shieldSegments.length;
              const segAngle = (Math.PI * 2) / segCount;
              const outerIdx = Math.floor(norm / segAngle) % segCount;
              if (GameContext.spaceStation.shieldSegments[outerIdx] > 0) {
                hasShieldAtAngle = true;
                blockingOuterIdx = outerIdx;
              }
            }
            if (hasShieldAtAngle) {
              hit = true;
              if (blockingInnerIdx >= 0) {
                const segHp = GameContext.spaceStation.innerShieldSegments[blockingInnerIdx];
                if (segHp > 0) {
                  GameContext.spaceStation.innerShieldSegments[blockingInnerIdx] = Math.max(
                    0,
                    segHp - b.damage
                  );
                  GameContext.spaceStation.shieldsDirty = true;
                }
              } else if (blockingOuterIdx >= 0) {
                const segHp = GameContext.spaceStation.shieldSegments[blockingOuterIdx];
                if (segHp > 0) {
                  GameContext.spaceStation.shieldSegments[blockingOuterIdx] = Math.max(
                    0,
                    segHp - b.damage
                  );
                  GameContext.spaceStation.shieldsDirty = true;
                }
              }
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            } else {
              trackDamageByWeaponType(b, b.damage);
              GameContext.spaceStation.hp -= b.damage;
              showDamageFloatingText(
                GameContext.spaceStation.pos.x,
                GameContext.spaceStation.pos.y,
                b.damage,
                false
              );
              hit = true;
              if (_playSound) _playSound("hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#fff");

              // Explosive Rounds meta upgrade
              if (
                GameContext.player &&
                GameContext.player.stats &&
                GameContext.player.stats.explosiveChance > 0 &&
                Math.random() < GameContext.player.stats.explosiveChance
              ) {
                const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                const explosiveRange = 200;
                GameContext.shockwaves.push(
                  new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                    damageAsteroids: true,
                    damageEnemies: true,
                    ignoreOwner: true
                  })
                );
              }

              if (GameContext.spaceStation.hp <= 0) {
                if (_handleSpaceStationDestroyed) _handleSpaceStationDestroyed();
              }
            }
          }
        }

        if (!hit && !b.isEnemy && GameContext.destroyer && !GameContext.destroyer.dead) {
          const dist = Math.hypot(
            b.pos.x - GameContext.destroyer.pos.x,
            b.pos.y - GameContext.destroyer.pos.y
          );
          if (
            GameContext.destroyer.invulnerable > 0 &&
            dist < GameContext.destroyer.shieldRadius + b.radius
          ) {
            hit = true;
            if (_playSound) _playSound("shield_hit");
            if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
            b.dead = true;
            b.vel.x = 0;
            b.vel.y = 0;
          }
          const outerUp =
            GameContext.destroyer.shieldSegments &&
            GameContext.destroyer.shieldSegments.some(s => s > 0);
          const innerUp =
            GameContext.destroyer.innerShieldSegments &&
            GameContext.destroyer.innerShieldSegments.some(s => s > 0);
          if (
            !hit &&
            !b.ignoreShields &&
            outerUp &&
            dist < GameContext.destroyer.shieldRadius + b.radius
          ) {
            let angle =
              Math.atan2(
                b.pos.y - GameContext.destroyer.pos.y,
                b.pos.x - GameContext.destroyer.pos.x
              ) - GameContext.destroyer.shieldRotation;
            while (angle < 0) angle += Math.PI * 2;
            const count = GameContext.destroyer.shieldSegments.length;
            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
            if (GameContext.destroyer.shieldSegments[idx] > 0) {
              const segmentHp = GameContext.destroyer.shieldSegments[idx];
              GameContext.destroyer.shieldSegments[idx] = Math.max(0, segmentHp - b.damage);
              GameContext.destroyer.shieldsDirty = true;
              hit = true;
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            }
          }
          if (
            !hit &&
            !b.ignoreShields &&
            innerUp &&
            dist < GameContext.destroyer.innerShieldRadius + b.radius
          ) {
            let angle =
              Math.atan2(
                b.pos.y - GameContext.destroyer.pos.y,
                b.pos.x - GameContext.destroyer.pos.x
              ) - GameContext.destroyer.innerShieldRotation;
            while (angle < 0) angle += Math.PI * 2;
            const count = GameContext.destroyer.innerShieldSegments.length;
            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
            if (GameContext.destroyer.innerShieldSegments[idx] > 0) {
              const segmentHp = GameContext.destroyer.innerShieldSegments[idx];
              GameContext.destroyer.innerShieldSegments[idx] = Math.max(0, segmentHp - b.damage);
              GameContext.destroyer.shieldsDirty = true;
              hit = true;
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#f0f");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            }
          }
          const destroyerHullHit =
            typeof GameContext.destroyer.hitTestCircle === "function"
              ? GameContext.destroyer.hitTestCircle(b.pos.x, b.pos.y, b.radius)
              : dist < GameContext.destroyer.radius + b.radius;
          if (!hit && destroyerHullHit) {
            // Final gate: block and damage segment if shield still up at this angle
            const angle = Math.atan2(
              b.pos.y - GameContext.destroyer.pos.y,
              b.pos.x - GameContext.destroyer.pos.x
            );
            let hasShieldAtAngle = false;
            let blockingInnerIdx = -1;
            let blockingOuterIdx = -1;
            if (
              GameContext.destroyer.innerShieldSegments &&
              GameContext.destroyer.innerShieldSegments.length > 0
            ) {
              const norm =
                (((angle - (GameContext.destroyer.innerShieldRotation ?? 0)) % (Math.PI * 2)) +
                  Math.PI * 2) %
                (Math.PI * 2);
              const innerCount = GameContext.destroyer.innerShieldSegments.length;
              const innerAngle = (Math.PI * 2) / innerCount;
              const innerIdx = Math.floor(norm / innerAngle) % innerCount;
              if (GameContext.destroyer.innerShieldSegments[innerIdx] > 0) {
                hasShieldAtAngle = true;
                blockingInnerIdx = innerIdx;
              }
            }
            if (
              !hasShieldAtAngle &&
              GameContext.destroyer.shieldSegments &&
              GameContext.destroyer.shieldSegments.length > 0
            ) {
              const norm =
                (((angle - (GameContext.destroyer.shieldRotation ?? 0)) % (Math.PI * 2)) +
                  Math.PI * 2) %
                (Math.PI * 2);
              const segCount = GameContext.destroyer.shieldSegments.length;
              const segAngle = (Math.PI * 2) / segCount;
              const outerIdx = Math.floor(norm / segAngle) % segCount;
              if (GameContext.destroyer.shieldSegments[outerIdx] > 0) {
                hasShieldAtAngle = true;
                blockingOuterIdx = outerIdx;
              }
            }
            if (hasShieldAtAngle) {
              hit = true;
              if (blockingInnerIdx >= 0) {
                const segHp = GameContext.destroyer.innerShieldSegments[blockingInnerIdx];
                if (segHp > 0) {
                  GameContext.destroyer.innerShieldSegments[blockingInnerIdx] = Math.max(
                    0,
                    segHp - b.damage
                  );
                  GameContext.destroyer.shieldsDirty = true;
                }
              } else if (blockingOuterIdx >= 0) {
                const segHp = GameContext.destroyer.shieldSegments[blockingOuterIdx];
                if (segHp > 0) {
                  GameContext.destroyer.shieldSegments[blockingOuterIdx] = Math.max(
                    0,
                    segHp - b.damage
                  );
                  GameContext.destroyer.shieldsDirty = true;
                }
              }
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#0ff");
              b.dead = true;
              b.vel.x = 0;
              b.vel.y = 0;
            } else {
              const hpBefore = GameContext.destroyer.hp;
              trackDamageByWeaponType(b, b.damage);
              GameContext.destroyer.hp -= b.damage;
              showDamageFloatingText(
                GameContext.destroyer.pos.x,
                GameContext.destroyer.pos.y,
                b.damage,
                false
              );
              hit = true;
              if (_playSound) _playSound("hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#ff0");

              // Explosive Rounds meta upgrade
              if (
                GameContext.player &&
                GameContext.player.stats &&
                GameContext.player.stats.explosiveChance > 0 &&
                Math.random() < GameContext.player.stats.explosiveChance
              ) {
                const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                const explosiveRange = 200;
                GameContext.shockwaves.push(
                  new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                    damageAsteroids: true,
                    damageEnemies: true,
                    ignoreOwner: true
                  })
                );
              }

              if (GameContext.destroyer.hp <= 0) {
                GameContext.destroyer.kill();
              }
            }
          }
        }

        if (
          !hit &&
          !b.isEnemy &&
          GameContext.bossActive &&
          GameContext.boss &&
          !GameContext.boss.dead
        ) {
          if (b.owner !== GameContext.boss) {
            const dist = Math.hypot(
              b.pos.x - GameContext.boss.pos.x,
              b.pos.y - GameContext.boss.pos.y
            );

            if (
              GameContext.boss.isWarpBoss &&
              GameContext.boss.ramInvulnerable > 0 &&
              dist < GameContext.boss.radius + b.radius + 6
            ) {
              hit = true;
              if (_playSound) _playSound("shield_hit");
              if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#f0f");
            }

            const outerShieldsUp =
              GameContext.boss.shieldSegments && GameContext.boss.shieldSegments.some(s => s > 0);
            const innerShieldsUp =
              GameContext.boss.innerShieldSegments &&
              GameContext.boss.innerShieldSegments.length > 0 &&
              GameContext.boss.innerShieldSegments.some(s => s > 0);

            if (
              !hit &&
              !b.ignoreShields &&
              outerShieldsUp &&
              dist < GameContext.boss.shieldRadius + b.radius
            ) {
              const angle =
                Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) -
                GameContext.boss.shieldRotation;
              const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              const segCount = GameContext.boss.shieldSegments.length;
              const segAngle = (Math.PI * 2) / segCount;
              const segIndex = Math.floor(norm / segAngle) % segCount;
              if (GameContext.boss.shieldSegments[segIndex] > 0) {
                const segHp = GameContext.boss.shieldSegments[segIndex];
                GameContext.boss.shieldSegments[segIndex] = Math.max(0, segHp - b.damage);
                GameContext.boss.shieldsDirty = true;
                hit = true;
                if (_playSound) _playSound("shield_hit");
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#0ff");
                b.dead = true;
                b.vel.x = 0;
                b.vel.y = 0;
              }
            }
            if (
              !hit &&
              !b.ignoreShields &&
              innerShieldsUp &&
              dist < GameContext.boss.innerShieldRadius + b.radius
            ) {
              const angle =
                Math.atan2(b.pos.y - GameContext.boss.pos.y, b.pos.x - GameContext.boss.pos.x) -
                GameContext.boss.innerShieldRotation;
              const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              const count = GameContext.boss.innerShieldSegments.length;
              const innerAngle = (Math.PI * 2) / count;
              const segIndex = Math.floor(norm / innerAngle) % count;
              if (GameContext.boss.innerShieldSegments[segIndex] > 0) {
                const segHp = GameContext.boss.innerShieldSegments[segIndex];
                GameContext.boss.innerShieldSegments[segIndex] = Math.max(0, segHp - b.damage);
                GameContext.boss.shieldsDirty = true;
                hit = true;
                if (_playSound) _playSound("shield_hit");
                if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                b.dead = true;
                b.vel.x = 0;
                b.vel.y = 0;
              }
            }

            if (!hit) {
              if (typeof GameContext.boss.applyPlayerBulletHit === "function") {
                if (GameContext.boss.applyPlayerBulletHit(b)) {
                  hit = true;
                }
              }

              if (!hit) {
                if (GameContext.boss.invulnerableTimer > 0) continue;
                const hullRadius = GameContext.boss.hullCollisionRadius
                  ? GameContext.boss.hullCollisionRadius
                  : typeof GameContext.boss.hitTestCircle === "function"
                    ? 0
                    : GameContext.boss.radius;
                const hitTest =
                  typeof GameContext.boss.hitTestCircle === "function" &&
                  !GameContext.boss.hullCollisionRadius
                    ? GameContext.boss.hitTestCircle(b.pos.x, b.pos.y, b.radius)
                    : dist < hullRadius + b.radius;
                if (hitTest) {
                  // Check shield segments at bullet's angle (same robust logic as Pinwheel/Gunboat)
                  const angle = Math.atan2(
                    b.pos.y - GameContext.boss.pos.y,
                    b.pos.x - GameContext.boss.pos.x
                  );
                  let hasShieldAtAngle = false;
                  /** When blocking, which segment took the hit: { inner: index } or { outer: index } */
                  let blockingSegment = null;

                  const isBossWithShields =
                    GameContext.boss.shieldSegments?.length ||
                    GameContext.boss.isDungeonBoss ||
                    GameContext.boss.isCaveBoss ||
                    GameContext.boss instanceof Cruiser;

                  // Check inner shield at this angle
                  if (
                    GameContext.boss.innerShieldSegments &&
                    GameContext.boss.innerShieldSegments.length > 0
                  ) {
                    const normInner =
                      (((angle - (GameContext.boss.innerShieldRotation ?? 0)) % (Math.PI * 2)) +
                        Math.PI * 2) %
                      (Math.PI * 2);
                    const innerCount = GameContext.boss.innerShieldSegments.length;
                    const innerAngle = (Math.PI * 2) / innerCount;
                    const innerIdx = Math.floor(normInner / innerAngle) % innerCount;
                    if (GameContext.boss.innerShieldSegments[innerIdx] > 0) {
                      hasShieldAtAngle = true;
                      blockingSegment = { inner: innerIdx };
                    }
                    // Fallback: any segment with HP contains this angle (handles boundaries)
                    if (!hasShieldAtAngle && isBossWithShields) {
                      for (let i = 0; i < innerCount; i++) {
                        if (GameContext.boss.innerShieldSegments[i] <= 0) continue;
                        const a0 = i * innerAngle;
                        const a1 = (i + 1) * innerAngle;
                        if (normInner >= a0 - 0.02 && normInner < a1 + 0.02) {
                          hasShieldAtAngle = true;
                          blockingSegment = { inner: i };
                          break;
                        }
                      }
                    }
                  }

                  // Check outer shield at this angle (only if inner didn't block)
                  if (
                    !hasShieldAtAngle &&
                    GameContext.boss.shieldSegments &&
                    GameContext.boss.shieldSegments.length > 0
                  ) {
                    const normOuter =
                      (((angle - (GameContext.boss.shieldRotation ?? 0)) % (Math.PI * 2)) +
                        Math.PI * 2) %
                      (Math.PI * 2);
                    const segCount = GameContext.boss.shieldSegments.length;
                    const segAngle = (Math.PI * 2) / segCount;
                    const outerIdx = Math.floor(normOuter / segAngle) % segCount;
                    if (GameContext.boss.shieldSegments[outerIdx] > 0) {
                      hasShieldAtAngle = true;
                      blockingSegment = { outer: outerIdx };
                    }
                    // Fallback: any segment with HP contains this angle (handles boundaries)
                    if (!hasShieldAtAngle && isBossWithShields) {
                      for (let i = 0; i < segCount; i++) {
                        if (GameContext.boss.shieldSegments[i] <= 0) continue;
                        const a0 = i * segAngle;
                        const a1 = (i + 1) * segAngle;
                        if (normOuter >= a0 - 0.02 && normOuter < a1 + 0.02) {
                          hasShieldAtAngle = true;
                          blockingSegment = { outer: i };
                          break;
                        }
                      }
                    }
                  }

                  // Apply HP damage if no shield at this angle
                  if (!hasShieldAtAngle) {
                    trackDamageByWeaponType(b, b.damage);
                    GameContext.boss.hp -= b.damage;
                    showDamageFloatingText(
                      GameContext.boss.pos.x,
                      GameContext.boss.pos.y,
                      b.damage,
                      false
                    );
                    hit = true;
                    if (_playSound) _playSound("hit");
                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 5, "#fff");
                  } else {
                    // Shield at this angle still active - block and apply damage to the segment
                    hit = true;
                    if (blockingSegment) {
                      if (blockingSegment.inner !== undefined) {
                        const idx = blockingSegment.inner;
                        const segHp = GameContext.boss.innerShieldSegments[idx];
                        if (segHp > 0) {
                          GameContext.boss.innerShieldSegments[idx] = Math.max(0, segHp - b.damage);
                          GameContext.boss.shieldsDirty = true;
                        }
                      } else if (blockingSegment.outer !== undefined) {
                        const idx = blockingSegment.outer;
                        const segHp = GameContext.boss.shieldSegments[idx];
                        if (segHp > 0) {
                          GameContext.boss.shieldSegments[idx] = Math.max(0, segHp - b.damage);
                          GameContext.boss.shieldsDirty = true;
                        }
                      }
                    }
                    if (_playSound) _playSound("enemy_shield_hit");
                    if (_spawnParticles) _spawnParticles(b.pos.x, b.pos.y, 3, "#f0f");
                    b.dead = true;
                    b.vel.x = 0;
                    b.vel.y = 0;
                  }

                  // Explosive Rounds meta upgrade
                  if (
                    GameContext.player &&
                    GameContext.player.stats &&
                    GameContext.player.stats.explosiveChance > 0 &&
                    Math.random() < GameContext.player.stats.explosiveChance
                  ) {
                    const explosiveDamage = GameContext.player.stats.explosiveDamage || 1;
                    const explosiveRange = 200;
                    GameContext.shockwaves.push(
                      new Shockwave(b.pos.x, b.pos.y, explosiveDamage, explosiveRange, {
                        damageAsteroids: true,
                        damageEnemies: true,
                        ignoreOwner: true
                      })
                    );
                  }

                  if (GameContext.boss.hp <= 0) {
                    GameContext.boss.kill();
                    GameContext.score += 10000;
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
    console.error("[BULLET LOGIC ERROR]", e);
  } finally {
    if (_setProjectileImpactSoundContext) _setProjectileImpactSoundContext(false);
  }
}
