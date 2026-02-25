import { GameContext } from "../core/game-context.js";
import { updateXpUI } from "../ui/hud.js";

export const SCORE_VALUES = {
  PICKUP_COIN_MULTIPLIER: 1,
  PICKUP_SPACE_NUGGET: 50,
  PICKUP_GOLD_NUGGET: 100,
  PICKUP_HEALTH_POWERUP: 75,
  PICKUP_MAGNET: 100,
  PICKUP_NUKE: 150,
  PICKUP_EXPLORATION_CACHE: 50,
  CONTRACT_COMPLETE: 1000,
  LEVEL_COMPLETE: 5000,
  UPGRADE_BASE_POINTS: 100,
  UPGRADE_TIER_MULTIPLIER: 1.5,
  ENEMY_BASE_POINTS: {
    ROAMER: 10,
    ELITE_ROAMER: 10,
    HUNTER: 10,
    DEFENDER: 10,
    GUNBOAT: 15,
    PINWHEEL: 15,
    CAVE_MONSTER: 25,
    DUNGEON_BOSS: 30,
    CRUISER: 40,
    SPACE_STATION: 50,
    FINAL_BOSS: 60,
    DESTROYER: 75
  }
};

function getDifficultyMultiplier() {
  return 1 + (GameContext.difficultyTier - 1) * 0.1;
}

export function awardScore(amount, source = "unknown") {
  if (amount <= 0) return;
  const multiplier = getDifficultyMultiplier();
  const finalScore = Math.floor(amount * multiplier);
  GameContext.score += finalScore;
  updateXpUI();
}

export function awardEnemyKillScore(enemy) {
  const score = calculateEnemyScore(enemy);
  if (score > 0) {
    awardScore(score, "enemy_kill");
  }
  return score;
}

export function calculateEnemyScore(enemy) {
  if (!enemy) return 0;

  const maxHp = enemy.maxHp > 0 ? enemy.maxHp : 100;
  let basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.ROAMER;

  if (enemy.isDestroyer || enemy.type === "destroyer" || enemy.type === "destroyer2") {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.DESTROYER;
  } else if (enemy.isWarpBoss || enemy.isFinalBoss) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.FINAL_BOSS;
  } else if (GameContext.spaceStation === enemy) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.SPACE_STATION;
  } else if (enemy.isCruiser || enemy.type === "cruiser" || enemy.isFlagship) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.CRUISER;
  } else if (enemy.isDungeonBoss) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.DUNGEON_BOSS;
  } else if (enemy.isCaveBoss) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.CAVE_MONSTER;
  } else if (
    enemy.isGunboat ||
    enemy.type === "gunboat" ||
    enemy.type === "cave_gunboat1" ||
    enemy.type === "cave_gunboat2"
  ) {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.GUNBOAT;
  } else if (enemy.type === "pinwheel") {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.PINWHEEL;
  } else if (enemy.type === "hunter") {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.HUNTER;
  } else if (enemy.type === "elite_roamer") {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.ELITE_ROAMER;
  } else if (enemy.type === "defender") {
    basePoints = SCORE_VALUES.ENEMY_BASE_POINTS.DEFENDER;
  }

  const hpFactor = maxHp / 100;
  const rawScore = Math.floor(basePoints * hpFactor);
  const multiplier = getDifficultyMultiplier();
  return Math.floor(rawScore * multiplier);
}

export function awardPickupScore(pickupType, value = 1) {
  let score = 0;

  switch (pickupType) {
    case "coin":
      score = value * SCORE_VALUES.PICKUP_COIN_MULTIPLIER;
      break;
    case "space_nugget":
      score = SCORE_VALUES.PICKUP_SPACE_NUGGET;
      break;
    case "gold_nugget":
      score = SCORE_VALUES.PICKUP_GOLD_NUGGET;
      break;
    case "health_powerup":
      score = SCORE_VALUES.PICKUP_HEALTH_POWERUP;
      break;
    case "magnet":
      score = SCORE_VALUES.PICKUP_MAGNET;
      break;
    case "nuke":
      score = SCORE_VALUES.PICKUP_NUKE;
      break;
    case "exploration_cache":
      score = SCORE_VALUES.PICKUP_EXPLORATION_CACHE;
      break;
  }

  if (score > 0) {
    awardScore(score, `pickup_${pickupType}`);
  }
  return score;
}

export function awardContractScore() {
  const score = SCORE_VALUES.CONTRACT_COMPLETE;
  awardScore(score, "contract_complete");
  return score;
}

export function awardLevelCompleteScore() {
  const score = SCORE_VALUES.LEVEL_COMPLETE;
  awardScore(score, "level_complete");
  return score;
}

export function calculateUpgradeScore(tier = 1) {
  const base = SCORE_VALUES.UPGRADE_BASE_POINTS;
  const multiplier = SCORE_VALUES.UPGRADE_TIER_MULTIPLIER;
  const effectiveTier = Math.max(1, tier);
  return Math.floor(base * Math.pow(multiplier, effectiveTier));
}

export function awardUpgradeScore(tier = 1, upgradeName = "unknown") {
  const score = calculateUpgradeScore(tier);
  if (score > 0) {
    awardScore(score, `upgrade_${upgradeName}_tier${tier}`);
  }
  return score;
}
