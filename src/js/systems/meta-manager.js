/**
 * Meta Manager - Handles persistent meta progression
 */

import { GameContext } from "../core/game-context.js";
import { META_SHOP_UPGRADE_DATA } from "../core/constants.js";
import { showOverlayMessage } from "../utils/ui-helpers.js";
import { updateMetaUI } from "../ui/meta-shop.js";
import { updateHealthUI } from "../ui/hud.js";

let returningFromModal = false;

export function getReturningFromModal() {
  return returningFromModal;
}

export function setReturningFromModal(value) {
  returningFromModal = !!value;
}

export function loadMetaProfile() {
  try {
    const profileKey = GameContext.currentProfileName
      ? `meta_profile_v1_${GameContext.currentProfileName}`
      : "meta_profile_v1";
    let raw = localStorage.getItem(profileKey);

    if (!raw && GameContext.currentProfileName) {
      const legacyKey = "meta_profile_v1";
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        raw = legacyRaw;
        localStorage.setItem(profileKey, legacyRaw);
      }
    }

    GameContext.metaProfile = {
      bank: 0,
      purchases: {}
    };

    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (typeof saved.bank === "number") GameContext.metaProfile.bank = saved.bank;
        if (saved.purchases) {
          GameContext.metaProfile.purchases = Object.assign(
            GameContext.metaProfile.purchases,
            saved.purchases
          );
        }
      } catch (e) {
        console.warn("Failed to parse meta profile, using defaults", e);
      }
    }
    if (!GameContext.metaProfile.purchases) GameContext.metaProfile.purchases = {};
    GameContext.metaProfile.purchases = Object.assign(
      {
        startDamage: 0,
        passiveHp: 0,
        rerollTokens: 0,
        hullPlating: 0,
        shieldCore: 0,
        staticBlueprint: 0,
        missilePrimer: 0,
        nukeCapacitor: 0,
        speedTuning: 0,
        bankMultiplier: 0,
        shopDiscount: 0,
        extraLife: 0,
        droneFabricator: 0,
        piercingRounds: 0,
        explosiveRounds: 0,
        criticalStrike: 0,
        splitShot: 0,
        thornArmor: 0,
        lifesteal: 0,
        evasionBoost: 0,
        shieldRecharge: 0,
        dashCooldown: 0,
        dashDuration: 0,
        autoReroll: 0,
        contractSpeed: 0,
        startingRerolls: 0,
        luckyDrop: 0,
        bountyHunter: 0,
        comboMeter: 0,
        startingWeapon: 0,
        secondWind: 0,
        batteryCapacitor: 0
      },
      GameContext.metaProfile.purchases
    );
    if (GameContext.metaProfile.purchases.warpPrecharge)
      delete GameContext.metaProfile.purchases.warpPrecharge;
    if (typeof GameContext.metaProfile.bank !== "number") GameContext.metaProfile.bank = 0;

    for (const key of [
      "startDamage",
      "passiveHp",
      "hullPlating",
      "shieldCore",
      "staticBlueprint",
      "missilePrimer",
      "nukeCapacitor",
      "speedTuning",
      "bankMultiplier",
      "shopDiscount",
      "extraLife",
      "droneFabricator"
    ]) {
      if (GameContext.metaProfile.purchases[key] === true) {
        GameContext.metaProfile.purchases[key] = 1;
      } else if (GameContext.metaProfile.purchases[key] === false) {
        GameContext.metaProfile.purchases[key] = 0;
      }
    }
  } catch (e) {
    console.warn("failed to load meta profile", e);
  }
}

export function resetMetaProfile() {
  GameContext.metaProfile = {
    bank: 0,
    purchases: {
      startDamage: 0,
      passiveHp: 0,
      rerollTokens: 0,
      hullPlating: 0,
      shieldCore: 0,
      staticBlueprint: 0,
      missilePrimer: 0,
      nukeCapacitor: 0,
      speedTuning: 0,
      bankMultiplier: 0,
      shopDiscount: 0,
      extraLife: 0,
      droneFabricator: 0,
      piercingRounds: 0,
      explosiveRounds: 0,
      criticalStrike: 0,
      splitShot: 0,
      thornArmor: 0,
      lifesteal: 0,
      evasionBoost: 0,
      shieldRecharge: 0,
      dashCooldown: 0,
      dashDuration: 0,
      autoReroll: 0,
      contractSpeed: 0,
      startingRerolls: 0,
      luckyDrop: 0,
      bountyHunter: 0,
      comboMeter: 0,
      startingWeapon: 0,
      secondWind: 0
    }
  };
}

export function saveMetaProfile() {
  try {
    const profileKey = GameContext.currentProfileName
      ? `meta_profile_v1_${GameContext.currentProfileName}`
      : "meta_profile_v1";
    GameContext.metaProfile.lastSavedAt = Date.now();
    const dataToSave = JSON.stringify(GameContext.metaProfile);
    localStorage.setItem(profileKey, dataToSave);
    updateMetaUI();
  } catch (e) {
    console.warn("failed to save meta profile", e);
  }
}

export function depositMetaNuggets() {
  const tier = GameContext.metaProfile.purchases.bankMultiplier || 0;
  let bonus = 0.1 * Math.min(tier, 3);
  if (tier > 3) {
    const table = { 0: 1.0, 1: 1.1, 2: 1.2, 3: 1.3 };
    const extraValue = getDiminishingValue(tier, table, 0.99);
    bonus = extraValue - 1.0;
  }
  GameContext.metaProfile.bank += Math.round(GameContext.spaceNuggets * (1 + bonus));
  saveMetaProfile();
}

export function getDiminishingValue(tier, baseTable, decayFactor = 0.99) {
  if (tier <= 3) return baseTable[tier] || 1.0;

  const baseValue = baseTable[3] || 1.0;
  const tiersBeyond = tier - 3;

  let totalBonus = 0;
  for (let i = 1; i <= tiersBeyond; i++) {
    totalBonus += 0.01 * Math.pow(decayFactor, i - 1);
  }

  return baseValue * (1 + totalBonus);
}

export function getMetaUpgradeCost(upgradeId, baseCost) {
  const currentTier = GameContext.metaProfile.purchases[upgradeId] || 0;

  if (currentTier >= 10) {
    return Infinity;
  }

  const discountTier = GameContext.metaProfile.purchases.shopDiscount || 0;
  let discount = 1.0;
  if (discountTier > 0) {
    const discountMultiplier = 0.1 * Math.min(discountTier, 3);
    if (discountTier > 3) {
      const table = { 0: 1.0, 1: 0.9, 2: 0.8, 3: 0.7 };
      const extraValue = getDiminishingValue(discountTier, table, 0.99);
      discount = extraValue;
    } else {
      discount = 1.0 - discountMultiplier;
    }
  }

  const multiplier = Math.pow(1.3, currentTier * 0.5);
  const cost = Math.ceil(baseCost * multiplier * discount);
  return cost;
}

export function applyMetaUpgrades(spawnDroneFn) {
  const startDamageTier = GameContext.metaProfile.purchases.startDamage || 0;
  if (startDamageTier > 0) {
    GameContext.player.stats.damageMult *= 1 + 0.1 * startDamageTier;
  }

  const passiveHpTier = GameContext.metaProfile.purchases.passiveHp || 0;
  if (passiveHpTier > 0) {
    GameContext.player.maxHp += 10 * passiveHpTier;
    GameContext.player.hp = GameContext.player.maxHp;
    updateHealthUI(GameContext);
  }

  const hullPlatingTier = GameContext.metaProfile.purchases.hullPlating || 0;
  if (hullPlatingTier > 0) {
    GameContext.player.maxHp += 15 * hullPlatingTier;
    GameContext.player.hp = GameContext.player.maxHp;
  }

  const shieldCoreTier = GameContext.metaProfile.purchases.shieldCore || 0;
  if (shieldCoreTier > 0) {
    const bonusSegments = Math.ceil(shieldCoreTier / 2);
    const bonusHp = Math.floor(shieldCoreTier / 2);
    const totalSegments = 8 + bonusSegments;
    const totalHp = 2 + bonusHp;

    GameContext.player.shieldSegments = new Array(totalSegments).fill(totalHp);
    GameContext.player.maxShieldSegments = totalSegments;
  }

  const staticBlueprintTier = GameContext.metaProfile.purchases.staticBlueprint || 0;
  if (staticBlueprintTier > 0) {
    for (let i = 0; i < staticBlueprintTier; i++) {
      const effectiveness = Math.max(0.2, 1 - i * 0.2);
      GameContext.player.staticWeapons.push({
        type: "forward",
        source: "meta",
        effectiveness: effectiveness
      });
    }
  }

  const missilePrimerTier = GameContext.metaProfile.purchases.missilePrimer || 0;
  GameContext.player.stats.homingFromMeta = missilePrimerTier;
  GameContext.player.stats.homing = Math.max(
    GameContext.player.stats.homingFromUpgrade,
    GameContext.player.stats.homingFromMeta
  );
  if (missilePrimerTier > 0) {
    GameContext.player.missileTimer = 0;
  }

  const nukeCapacitorTier = GameContext.metaProfile.purchases.nukeCapacitor || 0;
  if (nukeCapacitorTier > 0) {
    GameContext.player.defenseRingTier = nukeCapacitorTier;
    GameContext.player.defenseOrbDamage = 10 + (nukeCapacitorTier - 1) * 2;
    GameContext.player.defenseOrbs = [];
    const count = nukeCapacitorTier;
    for (let i = 0; i < count; i++) {
      GameContext.player.defenseOrbs.push({
        angleOffset: (Math.PI * 2 * i) / count,
        hitCooldowns: new WeakMap()
      });
    }
  }

  const speedTuningTier = GameContext.metaProfile.purchases.speedTuning || 0;
  if (speedTuningTier > 0) {
    GameContext.player.stats.speedMult *= 1 + 0.05 * speedTuningTier;
  }

  const droneFabricatorTier = GameContext.metaProfile.purchases.droneFabricator || 0;
  if (droneFabricatorTier > 0 && typeof spawnDroneFn === "function") {
    if (droneFabricatorTier >= 1) spawnDroneFn("shooter");
    if (droneFabricatorTier >= 2) spawnDroneFn("shield");
    if (droneFabricatorTier >= 3) spawnDroneFn("heal");
    if (droneFabricatorTier >= 4) spawnDroneFn("shooter");
    if (droneFabricatorTier >= 5) spawnDroneFn("shield");
  }

  const piercingRoundsTier = GameContext.metaProfile.purchases.piercingRounds || 0;
  if (piercingRoundsTier > 0) {
    let pierceCount = Math.min(piercingRoundsTier, 3);
    if (piercingRoundsTier > 3) {
      pierceCount += (piercingRoundsTier - 3) * 0.5;
    }
    GameContext.player.stats.pierceCount =
      (GameContext.player.stats.pierceCount || 0) + pierceCount;
  }

  const explosiveRoundsTier = GameContext.metaProfile.purchases.explosiveRounds || 0;
  if (explosiveRoundsTier > 0) {
    let explosiveChance = 0.2 * Math.min(explosiveRoundsTier, 3);
    if (explosiveRoundsTier > 3) {
      explosiveChance += 0.05 * (explosiveRoundsTier - 3);
    }
    GameContext.player.stats.explosiveChance =
      (GameContext.player.stats.explosiveChance || 0) + Math.min(explosiveChance, 1.0);
    // Explosive damage: Tier 1 = 5, adds 2 per tier (5, 7, 9, 11, 13)
    const explosiveDamage = 5 + (explosiveRoundsTier - 1) * 2;
    GameContext.player.stats.explosiveDamage = explosiveDamage;
  }

  const criticalStrikeTier = GameContext.metaProfile.purchases.criticalStrike || 0;
  if (criticalStrikeTier > 0) {
    const critChance = 0.01 * criticalStrikeTier;
    GameContext.player.stats.critChance =
      (GameContext.player.stats.critChance || 0) + Math.min(critChance, 0.3);
    GameContext.player.stats.critDamage = (GameContext.player.stats.critDamage || 1.0) + 1.0;
  }

  const splitShotTier = GameContext.metaProfile.purchases.splitShot || 0;
  if (splitShotTier > 0) {
    let splitChance = 0.1 * Math.min(splitShotTier, 3);
    if (splitShotTier > 3) {
      splitChance += 0.03 * (splitShotTier - 3);
    }
    GameContext.player.stats.splitChance =
      (GameContext.player.stats.splitChance || 0) + Math.min(splitChance, 0.5);
  }

  const thornArmorTier = GameContext.metaProfile.purchases.thornArmor || 0;
  if (thornArmorTier > 0) {
    let thornPercent = 0.1 * Math.min(thornArmorTier, 3);
    if (thornArmorTier > 3) {
      thornPercent += 0.02 * (thornArmorTier - 3);
    }
    GameContext.player.stats.thornReflect = Math.min(thornPercent, 0.35);
  }

  const lifestealTier = GameContext.metaProfile.purchases.lifesteal || 0;
  if (lifestealTier > 0) {
    const thresholds = [100, 75, 50];
    let threshold = thresholds[Math.min(lifestealTier - 1, 2)];
    if (lifestealTier > 3) {
      threshold -= 5 * (lifestealTier - 3);
    }
    GameContext.player.stats.lifestealThreshold = Math.max(threshold, 25);
    GameContext.player.stats.lifestealHealAmount = Math.min(lifestealTier, 3);
    GameContext.player.stats.lifestealTracking = 0;
  }

  const evasionBoostTier = GameContext.metaProfile.purchases.evasionBoost || 0;
  if (evasionBoostTier > 0) {
    let evasionChance = 0.05 * Math.min(evasionBoostTier, 3);
    if (evasionBoostTier > 3) {
      evasionChance += 0.02 * (evasionBoostTier - 3);
    }
    GameContext.player.stats.evasionChance =
      (GameContext.player.stats.evasionChance || 0) + Math.min(evasionChance, 0.25);
  }

  const shieldRechargeTier = GameContext.metaProfile.purchases.shieldRecharge || 0;
  if (shieldRechargeTier > 0) {
    const intervals = [30, 20, 15];
    let interval = intervals[Math.min(shieldRechargeTier - 1, 2)];
    if (shieldRechargeTier > 3) {
      interval = Math.max(interval - (shieldRechargeTier - 3), 5);
    }
    GameContext.player.stats.shieldRechargeInterval = interval * 60;
    GameContext.player.stats.shieldRechargeTimer = 0;
    GameContext.player.stats.shieldRechargeLast = Date.now();
  }

  const dashCooldownTier = GameContext.metaProfile.purchases.dashCooldown || 0;
  if (dashCooldownTier > 0) {
    let cooldownReduction = Math.min(dashCooldownTier, 3);
    if (dashCooldownTier > 3) {
      cooldownReduction += 0.3 * (dashCooldownTier - 3);
    }
    GameContext.player.stats.turboCooldownReduction = cooldownReduction;
  }

  const dashDurationTier = GameContext.metaProfile.purchases.dashDuration || 0;
  if (dashDurationTier > 0) {
    let durationBonus = 0.5 * Math.min(dashDurationTier, 3);
    if (dashDurationTier > 3) {
      durationBonus += 0.2 * (dashDurationTier - 3);
    }
    GameContext.player.stats.turboDurationBonus = durationBonus * 60;
  }

  const autoRerollTier = GameContext.metaProfile.purchases.autoReroll || 0;
  if (autoRerollTier > 0) {
    let autoRerollChance = 0.1 * Math.min(autoRerollTier, 3);
    if (autoRerollTier > 3) {
      autoRerollChance += 0.03 * (autoRerollTier - 3);
    }
    GameContext.player.stats.autoRerollChance = Math.min(autoRerollChance, 0.5);
  }

  const contractSpeedTier = GameContext.metaProfile.purchases.contractSpeed || 0;
  if (contractSpeedTier > 0) {
    let contractSpeedBonus = 0.1 * Math.min(contractSpeedTier, 3);
    if (contractSpeedTier > 3) {
      contractSpeedBonus += 0.05 * (contractSpeedTier - 3);
    }
    GameContext.player.stats.contractSpeedMult =
      (GameContext.player.stats.contractSpeedMult || 1.0) + contractSpeedBonus;
  }

  const startingRerollsTier = GameContext.metaProfile.purchases.startingRerolls || 0;
  if (startingRerollsTier > 0) {
    let startingTokens = Math.min(startingRerollsTier, 3);
    if (startingRerollsTier > 3) {
      startingTokens += 0.5 * (startingRerollsTier - 3);
    }
    GameContext.rerollTokens += Math.floor(startingTokens);
  }

  const luckyDropTier = GameContext.metaProfile.purchases.luckyDrop || 0;
  if (luckyDropTier > 0) {
    let healthDropBonus = 0.05 * Math.min(luckyDropTier, 3);
    let nuggetBonus = 0.02 * Math.min(luckyDropTier, 3);
    if (luckyDropTier > 3) {
      healthDropBonus += 0.02 * (luckyDropTier - 3);
      nuggetBonus += 0.01 * (luckyDropTier - 3);
    }
    GameContext.player.stats.luckyHealthDrop = healthDropBonus;
    GameContext.player.stats.luckyNuggetDrop = nuggetBonus;
  }

  const bountyHunterTier = GameContext.metaProfile.purchases.bountyHunter || 0;
  if (bountyHunterTier > 0) {
    let eliteBonus = 5 * Math.min(bountyHunterTier, 3);
    let bossBonus = 20 * Math.min(bountyHunterTier, 3);
    if (bountyHunterTier > 3) {
      eliteBonus += 3 * (bountyHunterTier - 3);
      bossBonus += 10 * (bountyHunterTier - 3);
    }
    GameContext.player.stats.bountyEliteBonus = eliteBonus;
    GameContext.player.stats.bountyBossBonus = bossBonus;
  }

  const comboMeterTier = GameContext.metaProfile.purchases.comboMeter || 0;
  if (comboMeterTier > 0) {
    let comboDamagePer10 = 0.01 * Math.min(comboMeterTier, 3);
    let maxComboDamage = 0.1 * Math.min(comboMeterTier, 3);
    if (comboMeterTier > 3) {
      comboDamagePer10 += 0.003 * (comboMeterTier - 3);
      maxComboDamage += 0.05 * (comboMeterTier - 3);
    }
    GameContext.player.stats.comboDamagePer10 = comboDamagePer10;
    GameContext.player.stats.maxComboDamage = maxComboDamage;
    GameContext.player.stats.comboMaxBonus = maxComboDamage / 10; // Convert to per-stack bonus
    GameContext.player.stats.comboStacks = 0;
    GameContext.player.stats.comboLastHitTime = 0;
  }

  const startingWeaponTier = GameContext.metaProfile.purchases.startingWeapon || 0;
  if (startingWeaponTier > 0) {
    GameContext.player.inventory["shotgun"] = Math.min(startingWeaponTier, 3);
    if (startingWeaponTier > 3) {
      let damageBonus = 0.05 * (startingWeaponTier - 3);
      GameContext.player.stats.startingShotgunDamageMult = 1.0 + damageBonus;
    }
  }

  const secondWindTier = GameContext.metaProfile.purchases.secondWind || 0;
  if (secondWindTier > 0) {
    const durations = [0.5, 1.0, 1.5];
    const cooldowns = [10, 8, 6];
    let duration = durations[Math.min(secondWindTier - 1, 2)];
    let cooldown = cooldowns[Math.min(secondWindTier - 1, 2)];
    if (secondWindTier > 3) {
      duration += 0.2 * (secondWindTier - 3);
      cooldown = Math.max(cooldown - 0.5 * (secondWindTier - 3), 3);
    }
    GameContext.player.stats.secondWindDuration = duration * 60;
    GameContext.player.stats.secondWindCooldown = cooldown * 60;
    GameContext.player.stats.secondWindTimer = 0;
    GameContext.player.stats.secondWindReady = true;
  }

  const batteryCapacitorTier = GameContext.metaProfile.purchases.batteryCapacitor || 0;
  if (batteryCapacitorTier > 0) {
    GameContext.player.batteryUnlocked = true;
    GameContext.player.batteryDamage = batteryCapacitorTier * 100;
    const baseRanges = { 1: 800, 2: 900, 3: 1000 };
    if (baseRanges[batteryCapacitorTier]) {
      GameContext.player.batteryRange = baseRanges[batteryCapacitorTier];
    } else if (batteryCapacitorTier > 3) {
      GameContext.player.batteryRange = 1000 + (batteryCapacitorTier - 3) * 100;
    }
  }
}
