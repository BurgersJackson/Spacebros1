import { GameContext } from "../core/game-context.js";
import { updateHealthUI, updateTurboUI, updateWarpUI, updateXpUI } from "../ui/hud.js";

export const SAVE_PREFIX = "neon_space_profile_v1_";
export const SAVE_LAST_KEY = "neon_space_profile_last";

let pendingProfile = null;

/**
 * @returns {Object|null}
 */
export function buildProfileData() {
  if (!GameContext.player) return null;
  return {
    version: 1,
    timestamp: Date.now(),
    lastSavedAt: Date.now(),
    score: GameContext.score,
    sectorIndex: GameContext.sectorIndex,
    totalKills: GameContext.totalKills,
    highScore: GameContext.highScore,
    totalPlayTimeMs: GameContext.totalPlayTimeMs,
    unlockedLevels: GameContext.unlockedLevels || [1],
    player: {
      hp: GameContext.player.hp,
      maxHp: GameContext.player.maxHp,
      shieldSegments: [...GameContext.player.shieldSegments],
      maxShieldSegments: GameContext.player.maxShieldSegments,
      outerShieldSegments: [...(GameContext.player.outerShieldSegments || [])],
      maxOuterShieldSegments: GameContext.player.maxOuterShieldSegments || 0,
      stats: { ...GameContext.player.stats },
      inventory: { ...GameContext.player.inventory },
      level: GameContext.player.level,
      xp: GameContext.player.xp,
      nextLevelXp: GameContext.player.nextLevelXp,
      magnetRadius: GameContext.player.magnetRadius,
      nukeUnlocked: GameContext.player.nukeUnlocked,
      nukeCooldown: GameContext.player.nukeCooldown,
      nukeMaxCooldown: GameContext.player.nukeMaxCooldown,
      staticWeapons: [...GameContext.player.staticWeapons],
      shieldRotation: GameContext.player.shieldRotation,
      outerShieldRotation: GameContext.player.outerShieldRotation,
      outerShieldRadius: GameContext.player.outerShieldRadius,
      invincibilityCycle: { ...GameContext.player.invincibilityCycle },
      turboBoost: { ...GameContext.player.turboBoost },
      nukeDamage: GameContext.player.nukeDamage,
      nukeRange: GameContext.player.nukeRange
    }
  };
}

/**
 * @param {Object} profile
 * @returns {void}
 */
export function applyProfile(profile) {
  if (!profile || !profile.player || !GameContext.player) {
    pendingProfile = profile || null;
    return;
  }
  const src = profile.player;
  GameContext.player.maxHp = src.maxHp || GameContext.player.maxHp;
  GameContext.player.hp = Math.min(src.hp || GameContext.player.hp, GameContext.player.maxHp);
  if (src.shieldSegments) {
    GameContext.player.shieldSegments = [...src.shieldSegments];
  }
  GameContext.player.maxShieldSegments =
    src.maxShieldSegments || GameContext.player.shieldSegments.length;
  if (typeof src.maxOuterShieldSegments === "number") {
    GameContext.player.maxOuterShieldSegments = src.maxOuterShieldSegments;
  }
  if (src.outerShieldSegments) {
    GameContext.player.outerShieldSegments = [...src.outerShieldSegments];
  }
  GameContext.player.stats = { ...GameContext.player.stats, ...(src.stats || {}) };
  GameContext.player.inventory = { ...(src.inventory || {}) };
  GameContext.player.level = src.level || GameContext.player.level;
  GameContext.player.xp = src.xp || 0;
  GameContext.player.nextLevelXp = src.nextLevelXp || GameContext.player.nextLevelXp;
  if (typeof src.magnetRadius === "number") {
    GameContext.player.magnetRadius = src.magnetRadius;
  }
  GameContext.player.nukeUnlocked = !!src.nukeUnlocked;
  if (typeof src.nukeCooldown === "number") {
    GameContext.player.nukeCooldown = src.nukeCooldown;
  }
  if (typeof src.nukeMaxCooldown === "number") {
    GameContext.player.nukeMaxCooldown = src.nukeMaxCooldown;
  }
  if (typeof src.nukeDamage === "number") {
    GameContext.player.nukeDamage = src.nukeDamage;
  }
  if (typeof src.nukeRange === "number") {
    GameContext.player.nukeRange = src.nukeRange;
  }
  GameContext.player.staticWeapons = src.staticWeapons
    ? [...src.staticWeapons]
    : GameContext.player.staticWeapons;
  if (typeof src.shieldRotation === "number") {
    GameContext.player.shieldRotation = src.shieldRotation;
  }
  if (typeof src.outerShieldRotation === "number") {
    GameContext.player.outerShieldRotation = src.outerShieldRotation;
  }
  if (typeof src.outerShieldRadius === "number") {
    GameContext.player.outerShieldRadius = src.outerShieldRadius;
  }
  GameContext.player.invincibilityCycle = {
    ...GameContext.player.invincibilityCycle,
    ...(src.invincibilityCycle || {})
  };
  if (src.turboBoost) {
    GameContext.player.turboBoost = { ...GameContext.player.turboBoost, ...(src.turboBoost || {}) };
  }
  GameContext.player.turboBoost.unlocked = true;
  GameContext.player.turboBoost.durationFrames = Math.max(
    60,
    GameContext.player.turboBoost.durationFrames || 0
  );
  GameContext.player.turboBoost.cooldownTotalFrames = 600;
  GameContext.player.turboBoost.speedMult = Math.max(
    1.25,
    GameContext.player.turboBoost.speedMult || 0
  );

  if (typeof profile.totalKills === "number") {
    GameContext.totalKills = profile.totalKills;
  }
  if (typeof profile.highScore === "number") {
    GameContext.highScore = profile.highScore;
  }
  if (typeof profile.totalPlayTimeMs === "number") {
    GameContext.totalPlayTimeMs = profile.totalPlayTimeMs;
  }
  if (profile.unlockedLevels && Array.isArray(profile.unlockedLevels)) {
    GameContext.unlockedLevels = profile.unlockedLevels;
  }

  updateHealthUI(GameContext);
  updateWarpUI(GameContext);
  updateTurboUI(GameContext);
  updateXpUI(GameContext);
  pendingProfile = null;
}

/**
 * @returns {void}
 */
export function applyPendingProfile() {
  if (pendingProfile) applyProfile(pendingProfile);
}

/**
 * @returns {string[]}
 */
export function listSaveSlots() {
  const slots = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SAVE_PREFIX)) {
      slots.push(k.replace(SAVE_PREFIX, ""));
    }
  }
  return slots;
}

/**
 * @returns {Array<Object>}
 */
export function getProfileList() {
  const profiles = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SAVE_PREFIX)) {
      const raw = localStorage.getItem(k);
      try {
        const data = JSON.parse(raw);
        const name = k.replace(SAVE_PREFIX, "");
        const p = data.player || {};

        const storedHighScore = data.highScore || 0;
        const currentScore = data.score || 0;
        const effectiveHighScore = Math.max(storedHighScore, currentScore);

        profiles.push({
          name: name,
          level: p.level || 1,
          xp: p.xp || 0,
          nextXp: p.nextLevelXp || 100,
          hp: p.hp || 100,
          maxHp: p.maxHp || 100,
          totalKills: data.totalKills || 0,
          sectorIndex: data.sectorIndex || 1,
          score: data.score || 0,
          highScore: effectiveHighScore,
          totalPlayTimeMs: data.totalPlayTimeMs || 0,
          timestamp: data.lastSavedAt || data.timestamp || 0
        });
      } catch (e) {
        console.warn("Failed to parse profile", k, e);
      }
    }
  }
  return profiles.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * @param {string} slotName
 * @param {boolean} silent
 * @returns {boolean}
 */
export function saveGame(slotName, silent = false) {
  if (!slotName) return false;
  try {
    const data = buildProfileData();
    if (!data) throw new Error("no player");
    localStorage.setItem(SAVE_PREFIX + slotName, JSON.stringify(data));
    localStorage.setItem(SAVE_LAST_KEY, slotName);
    return true;
  } catch (e) {
    if (!silent) console.warn("save failed", e);
    return false;
  }
}

/**
 * @param {string} slotName
 * @returns {Object|null}
 */
export function loadGame(slotName) {
  if (!slotName) return null;
  const raw = localStorage.getItem(SAVE_PREFIX + slotName);
  if (!raw) return null;
  try {
    const profile = JSON.parse(raw);
    applyProfile(profile);
    return profile;
  } catch (e) {
    console.warn("load failed", e);
    return null;
  }
}

/**
 * @param {string} name
 * @returns {void}
 */
export function selectProfile(name) {
  if (!name) return;
  GameContext.currentProfileName = name;
  localStorage.setItem(SAVE_LAST_KEY, name);
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function createNewProfile(name) {
  const existingProfiles = listSaveSlots();

  localStorage.removeItem("meta_profile_v1");

  let counter = 1;
  let newName = name;
  if (!newName) {
    do {
      newName = `profile${counter}`;
      counter++;
    } while (existingProfiles.includes(newName));
  } else if (existingProfiles.includes(newName)) {
    return null;
  }

  const template = {
    version: 1,
    timestamp: Date.now(),
    lastSavedAt: Date.now(),
    score: 0,
    sectorIndex: 1,
    totalKills: 0,
    highScore: 0,
    totalPlayTimeMs: 0,
    unlockedLevels: [1],
    player: null
  };

  const newMetaProfile = {
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
      secondWind: 0,
      batteryCapacitor: 0
    }
  };

  try {
    localStorage.setItem(SAVE_PREFIX + newName, JSON.stringify(template));
    localStorage.setItem(`meta_profile_v1_${newName}`, JSON.stringify(newMetaProfile));
  } catch (_e) {
    return null;
  }

  return newName;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function deleteProfile(name) {
  if (!name) return false;
  localStorage.removeItem(SAVE_PREFIX + name);
  localStorage.removeItem(`meta_profile_v1_${name}`);
  if (GameContext.currentProfileName === name) {
    GameContext.currentProfileName = null;
    localStorage.removeItem(SAVE_LAST_KEY);
  }
  return true;
}
