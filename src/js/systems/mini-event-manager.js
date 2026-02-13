import { GameContext } from "../core/game-context.js";

const deps = {};

export function registerMiniEventDependencies(next) {
  Object.assign(deps, next);
}

export function updateMiniEventUI() {
  const el = document.getElementById("event-display");
  if (!el) return;
  // Always hide the event display - quest info is shown in contract-display instead
  el.style.display = "none";
}

export function clearMiniEvent() {
  if (!GameContext.miniEvent) return;
  if (typeof GameContext.miniEvent.kill === "function") {
    GameContext.miniEvent.kill();
  } else {
    GameContext.miniEvent.dead = true;
  }
  deps.pixiCleanupObject(GameContext.miniEvent);
  GameContext.miniEvent = null;
}

export function completeContract(success = true) {
  deps.completeContractSystem(success);
}
