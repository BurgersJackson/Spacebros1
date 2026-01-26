/**
 * Upgrade Manager - Handles level-up upgrades
 */

import { GameContext } from "../core/game-context.js";
import { PLAYER_SHIELD_RADIUS_SCALE, UPGRADE_DATA } from "../core/constants.js";
import { getDiminishingValue } from "./meta-manager.js";
import { updateHealthUI, updateTurboUI } from "../ui/hud.js";
import { showOverlayMessage } from "../utils/ui-helpers.js";
import { spawnDrone } from "./spawn-manager.js";

/**
 * @param {string} id
 * @param {number} tier
 * @returns {void}
 */
export function applyUpgrade(id, tier) {
  const prevTier = GameContext.player.inventory[id] || 0;
  GameContext.player.inventory[id] = tier;

  try {
    GameContext.dreadManager.upgradesChosen = (GameContext.dreadManager.upgradesChosen || 0) + 1;
    if (
      !GameContext.dreadManager.firstSpawnDone &&
      GameContext.dreadManager.upgradesChosen >= 3 &&
      !GameContext.bossActive &&
      !GameContext.dreadManager.timerActive
    ) {
      GameContext.dreadManager.timerAt = Date.now() + 10000;
      GameContext.dreadManager.timerActive = true;
    }
  } catch (e) {
    console.warn("dreadManager upgrade increment failed", e);
  }

  switch (id) {
    case "turret_damage":
      {
        const table = { 0: 1.0, 1: 1.5, 2: 2.0, 3: 3.0 };
        const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
        const next = table[tier] || getDiminishingValue(tier, table, 0.99);
        const ratio = prev > 0 ? next / prev : 1.0;
        GameContext.player.stats.damageMult *= ratio;
      }
      break;
    case "turret_fire_rate":
      {
        const table = { 0: 1.0, 1: 1.1, 2: 1.2, 3: 1.3, 4: 1.35, 5: 1.4 };
        const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
        const next = table[tier] || getDiminishingValue(tier, table, 0.99);
        const ratio = prev > 0 ? next / prev : 1.0;
        GameContext.player.stats.fireRateMult *= ratio;
      }
      break;
    case "turret_range":
      {
        const table = { 0: 1.0, 1: 1.25, 2: 1.5, 3: 2.0 };
        const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
        const next = table[tier] || getDiminishingValue(tier, table, 0.99);
        const ratio = prev > 0 ? next / prev : 1.0;
        GameContext.player.stats.rangeMult *= ratio;
      }
      break;
    case "multi_shot":
      GameContext.player.stats.multiShot = tier + 1;
      break;
    case "static_weapons":
      {
        GameContext.player.staticWeapons = GameContext.player.staticWeapons.filter(
          w => w.source !== "upgrade"
        );
        const weaponTypes = ["forward", "side", "rear", "dual_rear", "dual_front"];
        for (let i = 0; i < tier && i < weaponTypes.length; i++) {
          GameContext.player.staticWeapons.push({ type: weaponTypes[i], source: "upgrade" });
        }
        if (tier > weaponTypes.length) {
          for (let i = weaponTypes.length; i < tier; i++) {
            const duplicateIndex = i - weaponTypes.length;
            const effectiveness = Math.max(0.2, 1 - duplicateIndex * 0.2);
            GameContext.player.staticWeapons.push({
              type: weaponTypes[i % weaponTypes.length],
              source: "upgrade",
              effectiveness: effectiveness
            });
          }
        }
        GameContext.player.staticCannonCount = GameContext.player.staticWeapons.length;
      }
      break;
    case "homing_missiles":
      GameContext.player.stats.homingFromUpgrade = tier;
      GameContext.player.stats.homing = Math.max(
        GameContext.player.stats.homingFromUpgrade,
        GameContext.player.stats.homingFromMeta
      );
      break;
    case "segment_count":
      if (tier === 1) GameContext.player.shieldSegments.push(2, 2);
      if (tier === 2) GameContext.player.shieldSegments.push(2, 2, 2, 2);
      if (tier === 3) GameContext.player.shieldSegments.push(2, 2, 2, 2);
      if (tier === 4) GameContext.player.shieldSegments.push(2, 2, 2, 2, 2, 2, 2, 2);
      if (tier === 5) GameContext.player.shieldSegments.push(2, 2);
      GameContext.player.maxShieldSegments = GameContext.player.shieldSegments.length;
      break;
    case "outer_shield":
      if (tier === 1) GameContext.player.maxOuterShieldSegments = 6;
      if (tier === 2) GameContext.player.maxOuterShieldSegments = 8;
      if (tier === 3) GameContext.player.maxOuterShieldSegments = 12;
      if (tier === 4) GameContext.player.maxOuterShieldSegments = 16;
      if (tier === 5) GameContext.player.maxOuterShieldSegments = 20;
      GameContext.player.outerShieldRadius =
        GameContext.player.shieldRadius + 26 * PLAYER_SHIELD_RADIUS_SCALE;
      GameContext.player.outerShieldSegments = new Array(
        GameContext.player.maxOuterShieldSegments
      ).fill(1);
      break;
    case "shield_regen":
      if (tier === 1) GameContext.player.stats.shieldRegenRate = 5;
      if (tier === 2) GameContext.player.stats.shieldRegenRate = 3;
      if (tier === 3) GameContext.player.stats.shieldRegenRate = 1;
      if (tier === 4) GameContext.player.stats.shieldRegenRate = 0.75;
      if (tier === 5) GameContext.player.stats.shieldRegenRate = 0.5;
      break;
    case "hp_regen":
      GameContext.player.stats.hpRegenAmount = tier;
      GameContext.player.stats.hpRegenRate = 5;
      GameContext.player.lastHpRegenTime = Date.now();
      break;
    case "hull_strength":
      GameContext.player.maxHp += 25;
      GameContext.player.hp = Math.min(GameContext.player.hp + 25, GameContext.player.maxHp);
      updateHealthUI(GameContext);
      break;
    case "speed":
      {
        const table = { 0: 1.0, 1: 1.15, 2: 1.3, 3: 1.5 };
        const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
        const next = table[tier] || getDiminishingValue(tier, table, 0.99);
        const ratio = prev > 0 ? next / prev : 1.0;
        GameContext.player.stats.speedMult *= ratio;
      }
      break;
    case "turbo_boost": {
      GameContext.player.turboBoost.unlocked = true;
      if (tier === 1) GameContext.player.turboBoost.durationFrames = 120;
      if (tier === 2) GameContext.player.turboBoost.durationFrames = 210;
      if (tier === 3) GameContext.player.turboBoost.durationFrames = 300;
      if (tier === 4) GameContext.player.turboBoost.durationFrames = 390;
      if (tier === 5) GameContext.player.turboBoost.durationFrames = 480;
      GameContext.player.turboBoost.cooldownTotalFrames = 600;
      GameContext.player.turboBoost.speedMult = 1.5;
      GameContext.player.turboBoost.activeFrames = 0;
      GameContext.player.turboBoost.cooldownFrames = 0;
      updateTurboUI(GameContext);
      break;
    }
    case "area_nuke":
      GameContext.player.nukeUnlocked = true;
      GameContext.player.nukeMaxCooldown = 600;
      if (tier === 1) {
        GameContext.player.nukeDamage = 5;
        GameContext.player.nukeRange = 600;
      }
      if (tier === 2) {
        GameContext.player.nukeDamage = 10;
        GameContext.player.nukeRange = 700;
      }
      if (tier === 3) {
        GameContext.player.nukeDamage = 15;
        GameContext.player.nukeRange = 900;
      }
      if (tier === 4) {
        GameContext.player.nukeDamage = 20;
        GameContext.player.nukeRange = 1000;
      }
      if (tier === 5) {
        GameContext.player.nukeDamage = 25;
        GameContext.player.nukeRange = 1200;
      }
      break;
    case "invincibility":
      GameContext.player.invincibilityCycle.unlocked = true;
      if (tier === 1)
        GameContext.player.invincibilityCycle.stats = {
          duration: 180,
          cooldown: 1200,
          regen: false
        };
      if (tier === 2)
        GameContext.player.invincibilityCycle.stats = {
          duration: 300,
          cooldown: 900,
          regen: false
        };
      if (tier === 3)
        GameContext.player.invincibilityCycle.stats = { duration: 420, cooldown: 600, regen: true };
      if (tier === 4)
        GameContext.player.invincibilityCycle.stats = { duration: 540, cooldown: 480, regen: true };
      if (tier === 5)
        GameContext.player.invincibilityCycle.stats = { duration: 720, cooldown: 360, regen: true };
      GameContext.player.invincibilityCycle.state = "ready";
      GameContext.player.invincibilityCycle.timer = 0;
      break;
    case "slow_field":
      if (tier === 1) {
        GameContext.player.stats.slowField = 250;
        GameContext.player.stats.slowFieldDuration = 180;
      }
      if (tier === 2) {
        GameContext.player.stats.slowField = 312;
        GameContext.player.stats.slowFieldDuration = 300;
      }
      if (tier === 3) {
        GameContext.player.stats.slowField = 390;
        GameContext.player.stats.slowFieldDuration = 480;
      }
      if (tier === 4) {
        GameContext.player.stats.slowField = 390;
        GameContext.player.stats.slowFieldDuration = 600;
      }
      if (tier === 5) {
        GameContext.player.stats.slowField = 487;
        GameContext.player.stats.slowFieldDuration = 720;
      }
      break;
    case "companion_drones": {
      const ensureDrone = t => {
        if (!GameContext.drones.find(d => d.type === t) && spawnDrone) spawnDrone(t);
      };
      if (tier >= 1) ensureDrone("shooter");
      if (tier >= 2) ensureDrone("shield");
      if (tier >= 3) ensureDrone("heal");
      if (tier >= 4) ensureDrone("shooter");
      if (tier >= 5) ensureDrone("shield");
      break;
    }
    case "volley_shot":
      GameContext.player.volleyShotUnlocked = true;
      if (tier === 1) {
        GameContext.player.volleyShotCount = 3;
      }
      if (tier === 2) {
        GameContext.player.volleyShotCount = 4;
      }
      if (tier === 3) {
        GameContext.player.volleyShotCount = 5;
      }
      if (tier === 4) {
        GameContext.player.volleyShotCount = 6;
      }
      if (tier === 5) {
        GameContext.player.volleyShotCount = 7;
      }
      break;
    case "ciws":
      GameContext.player.ciwsUnlocked = true;
      GameContext.player.ciwsDamage = tier;
      break;
    case "chain_lightning":
      if (tier === 1) {
        GameContext.player.chainLightningCount = 1;
        GameContext.player.chainLightningRange = 200;
      }
      if (tier === 2) {
        GameContext.player.chainLightningCount = 2;
        GameContext.player.chainLightningRange = 250;
      }
      if (tier === 3) {
        GameContext.player.chainLightningCount = 3;
        GameContext.player.chainLightningRange = 300;
      }
      if (tier === 4) {
        GameContext.player.chainLightningCount = 4;
        GameContext.player.chainLightningRange = 350;
      }
      if (tier === 5) {
        GameContext.player.chainLightningCount = 5;
        GameContext.player.chainLightningRange = 400;
      }
      break;
    case "shotgun":
      GameContext.player.stats.shotgunUnlocked = true;
      if (tier === 1) {
        GameContext.player.stats.shotgunPellets = 5;
        GameContext.player.stats.shotgunRangeMult = 1.0;
      }
      if (tier === 2) {
        GameContext.player.stats.shotgunPellets = 8;
        GameContext.player.stats.shotgunRangeMult = 1.2;
      }
      if (tier === 3) {
        GameContext.player.stats.shotgunPellets = 12;
        GameContext.player.stats.shotgunRangeMult = 1.2;
      }
      if (tier === 4) {
        GameContext.player.stats.shotgunPellets = 16;
        GameContext.player.stats.shotgunRangeMult = 1.4;
      }
      if (tier === 5) {
        GameContext.player.stats.shotgunPellets = 20;
        GameContext.player.stats.shotgunRangeMult = 1.6;
      }
      break;
    case "reactive_shield":
      if (tier === 1) GameContext.player.stats.reactiveShield = 1;
      if (tier === 2) GameContext.player.stats.reactiveShield = 2;
      if (tier === 3) {
        GameContext.player.stats.reactiveShield = 3;
        GameContext.player.stats.reactiveShieldBonusHp = true;
        if (GameContext.player.shieldSegments) {
          for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
            if (GameContext.player.shieldSegments[i] === 2)
              GameContext.player.shieldSegments[i] = 3;
          }
          GameContext.player.shieldsDirty = true;
        }
      }
      if (tier === 4) {
        GameContext.player.stats.reactiveShield = 4;
        GameContext.player.stats.reactiveShieldBonusHp = true;
        if (GameContext.player.shieldSegments) {
          for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
            if (GameContext.player.shieldSegments[i] < 4) GameContext.player.shieldSegments[i] = 4;
          }
          GameContext.player.shieldsDirty = true;
        }
      }
      if (tier === 5) {
        GameContext.player.stats.reactiveShield = 5;
        GameContext.player.stats.reactiveShieldBonusHp = true;
        if (GameContext.player.shieldSegments) {
          for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
            if (GameContext.player.shieldSegments[i] < 5) GameContext.player.shieldSegments[i] = 5;
          }
          GameContext.player.shieldsDirty = true;
        }
      }
      break;
    case "damage_mitigation":
      if (tier === 1) {
        GameContext.player.stats.damageMitigation = 0.9;
        GameContext.player.stats.speedBonusFromMit = 1.05;
      }
      if (tier === 2) {
        GameContext.player.stats.damageMitigation = 0.8;
        GameContext.player.stats.speedBonusFromMit = 1.1;
      }
      if (tier === 3) {
        GameContext.player.stats.damageMitigation = 0.7;
        GameContext.player.stats.speedBonusFromMit = 1.15;
      }
      if (tier === 4) {
        GameContext.player.stats.damageMitigation = 0.6;
        GameContext.player.stats.speedBonusFromMit = 1.2;
      }
      if (tier === 5) {
        GameContext.player.stats.damageMitigation = 0.5;
        GameContext.player.stats.speedBonusFromMit = 1.25;
      }
      break;
  }

  showOverlayMessage(`${id.replace("_", " ").toUpperCase()} UPGRADED!`, "#ff0", 1500);
}
