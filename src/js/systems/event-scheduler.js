import { GameContext } from "../core/game-context.js";

// Stub functions for backwards compatibility (arena countdown removed)
export function isArenaCountdownActive() {
  return false;
}

export function startArenaCountdown() {
  // No-op - arena countdown removed
}

export function stopArenaCountdown() {
  // No-op - arena countdown removed
}

export function scheduleNextShootingStar() {
  if (GameContext.sectorIndex >= 2) {
    GameContext.nextShootingStarTime = Date.now() + 60000;
  } else {
    GameContext.nextShootingStarTime = Date.now() + 180000 + Math.random() * 120000;
  }
}

export function scheduleNextRadiationStorm(fromNow = Date.now()) {
  GameContext.nextRadiationStormAt = null;
  GameContext.radiationStorm = null;
}

export function scheduleNextMiniEvent(fromNow = Date.now()) {
  const min = 120000;
  const max = 210000;
  GameContext.nextMiniEventAt = fromNow + min + Math.floor(Math.random() * (max - min + 1));
}
