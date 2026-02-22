import { GameContext } from "../core/game-context.js";
import { UPGRADE_DATA } from "../core/constants.js";
import { applyUpgrade, getMaxUpgradeTier } from "../systems/upgrade-manager.js";
import { updateHealthUI, updateNuggetUI } from "./hud.js";
import { showOverlayMessage } from "../utils/ui-helpers.js";
import { playSound, isMusicEnabled, startMusic } from "../audio/audio-manager.js";
import { getActiveMenuElements, updateMenuVisuals } from "../systems/input-manager.js";
import { saveMetaProfile } from "../systems/meta-manager.js";

/**
 * @returns {void}
 */
export function showLevelUpMenu() {
  // Pause game (same as Spaceship.levelUp) so physics/input stop while menu is open
  GameContext.gameActive = false;
  const canvas = document.getElementById("gameCanvas");
  if (canvas && document.pointerLockElement === canvas) {
    try {
      document.exitPointerLock();
    } catch (e) {}
  }

  const container = document.getElementById("upgrade-container");
  container.innerHTML = "";
  const parent = container.parentElement;
  const existingReroll = document.getElementById("reroll-btn");
  if (existingReroll) existingReroll.remove();

  const validUpgrades = [];

  UPGRADE_DATA.categories.forEach(cat => {
    cat.upgrades.forEach(up => {
      const currentTier =
        (GameContext.player &&
          GameContext.player.inventory &&
          GameContext.player.inventory[up.id]) ||
        0;
      const nextTier = currentTier + 1;

      const maxTier = getMaxUpgradeTier();
      if (nextTier > maxTier) {
        return;
      }

      validUpgrades.push({ ...up, category: cat.name });
    });
  });

  if (validUpgrades.length === 0) {
    showOverlayMessage("NO UPGRADES AVAILABLE!", "#f00", 2000);

    if (GameContext.player && !GameContext.player.dead) {
      GameContext.player.hp = Math.min(GameContext.player.hp + 3, GameContext.player.maxHp);
      updateHealthUI(GameContext);
      playSound("powerup");
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        resumeGameFromLevelUp();
      }, 100);
    });
    return;
  }

  const choices = [];
  const count = Math.min(3, validUpgrades.length);

  if (!GameContext.shownUpgradesThisRun) GameContext.shownUpgradesThisRun = new Set();

  const weightedUpgrades = [];
  for (const upgrade of validUpgrades) {
    const hasBeenShown = GameContext.shownUpgradesThisRun.has(upgrade.id);
    const weight = hasBeenShown ? 1 : 3;

    for (let w = 0; w < weight; w++) {
      weightedUpgrades.push(upgrade);
    }
  }

  const pickedIds = new Set();
  for (let i = 0; i < count; i++) {
    if (weightedUpgrades.length === 0) break;

    const idx = Math.floor(Math.random() * weightedUpgrades.length);
    const choice = weightedUpgrades[idx];

    if (!pickedIds.has(choice.id)) {
      choices.push(choice);
      pickedIds.add(choice.id);
      GameContext.shownUpgradesThisRun.add(choice.id);
    }

    for (let j = weightedUpgrades.length - 1; j >= 0; j--) {
      if (weightedUpgrades[j].id === choice.id) {
        weightedUpgrades.splice(j, 1);
      }
    }
  }

  // Auto-Reroll - chance for free reroll (doesn't count against tokens)
  if (
    GameContext.player.stats.autoRerollChance > 0 &&
    Math.random() < GameContext.player.stats.autoRerollChance
  ) {
    // Clear shown upgrades to reshow all without penalty
    GameContext.shownUpgradesThisRun.clear();
    weightedUpgrades.length = 0;
    choices.length = 0;
    pickedIds.clear();

    // Rebuild weighted upgrades from scratch (all weight 1 now)
    for (const upgrade of validUpgrades) {
      for (let w = 0; w < 1; w++) {
        weightedUpgrades.push(upgrade);
      }
    }

    // Pick 3 fresh options
    for (let i = 0; i < count; i++) {
      if (weightedUpgrades.length === 0) break;
      const idx = Math.floor(Math.random() * weightedUpgrades.length);
      const choice = weightedUpgrades[idx];
      if (!pickedIds.has(choice.id)) {
        choices.push(choice);
        pickedIds.add(choice.id);
        GameContext.shownUpgradesThisRun.add(choice.id);
      }
      for (let j = weightedUpgrades.length - 1; j >= 0; j--) {
        if (weightedUpgrades[j].id === choice.id) {
          weightedUpgrades.splice(j, 1);
        }
      }
    }

    // Show notification
    if (_showOverlayMessage) {
      _showOverlayMessage("AUTO-REROLL! FREE REROLL TRIGGERED!", "#f80", 1500);
    }
  }

  const rerollBtn = document.createElement("button");
  rerollBtn.id = "reroll-btn";
  rerollBtn.style.marginTop = "10px";
  rerollBtn.style.padding = "12px 24px";
  rerollBtn.style.fontSize = "16px";
  rerollBtn.style.backgroundColor = "#4a2";
  rerollBtn.style.color = "#fff";
  rerollBtn.style.cursor = "pointer";

  const updateRerollButton = () => {
    if (GameContext.rerollTokens > 0) {
      rerollBtn.textContent = `REROLL OPTIONS (TOKENS: ${GameContext.rerollTokens})`;
      rerollBtn.style.backgroundColor = "#4a2";
      rerollBtn.disabled = false;
    } else {
      rerollBtn.textContent = `REROLL (5 NUGGETS)`;
      rerollBtn.style.backgroundColor = GameContext.spaceNuggets >= 5 ? "#2a4" : "#333";
      rerollBtn.disabled = GameContext.spaceNuggets < 5;
    }
  };

  updateRerollButton();

  rerollBtn.onclick = () => {
    if (GameContext.rerollTokens > 0) {
      GameContext.rerollTokens--;
      GameContext.metaProfile.purchases.rerollTokens = GameContext.rerollTokens;
      saveMetaProfile();
      showLevelUpMenu();
    } else if (GameContext.spaceNuggets >= 5) {
      GameContext.spaceNuggets -= 5;
      updateNuggetUI(GameContext);
      showLevelUpMenu();
    }
  };

  parent.insertBefore(rerollBtn, container);

  choices.forEach(choice => {
    const currentTier =
      (GameContext.player &&
        GameContext.player.inventory &&
        GameContext.player.inventory[choice.id]) ||
      0;
    const nextTier = currentTier + 1;
    let desc = choice[`tier${nextTier}`];
    if (!desc) {
      for (let t = nextTier - 1; t >= 1; t--) {
        if (choice[`tier${t}`]) {
          desc = choice[`tier${t}`];
          break;
        }
      }
      if (!desc) desc = "Further upgrade";
    }

    const card = document.createElement("div");
    card.className = "upgrade-card";
    card.innerHTML = `
                    <div class="upgrade-title">${choice.name}</div>
                    <div style="color:#aaa; font-size:12px; margin-bottom:10px">${choice.category}</div>
                    <div class="upgrade-desc">${desc}</div>
                    <div style="font-size:12px; color:#888; margin-top:10px">${choice.notes}</div>
                `;

    card.onmouseenter = () => {
      const active = getActiveMenuElements();
      const cardIndex = active.indexOf(card);
      if (cardIndex >= 0) {
        GameContext.menuSelectionIndex = cardIndex;
        updateMenuVisuals(active);
      }
    };

    card.onmouseleave = () => {
      const active = getActiveMenuElements();
      const reroll = document.getElementById("reroll-btn");
      GameContext.menuSelectionIndex = active.indexOf(reroll);
      updateMenuVisuals(active);
    };

    card.onclick = e => {
      e.stopPropagation(); // Prevent event bubbling to document click handler

      const canvas = document.getElementById("gameCanvas");
      if (canvas && document.body.contains(canvas)) {
        // Apply upgrade FIRST
        applyUpgrade(choice.id, nextTier);
        document.getElementById("levelup-screen").style.display = "none";

        // Windowed mode: lock mouse back to the game window as we return to gameplay.
        // Do it immediately (still within the click gesture) so it isn't blocked.
        if (!document.pointerLockElement) {
          let isFullscreen = false;
          try {
            isFullscreen = window.getComputedStyle(canvas).position === "fixed";
          } catch (err) {
            isFullscreen = canvas.style.position === "fixed";
          }
          if (!isFullscreen) {
            canvas.focus();
            try {
              const request = canvas.requestPointerLock();
              if (request && typeof request.catch === "function") {
                request.catch(err =>
                  console.warn("Pointer lock failed after level-up selection:", err)
                );
              }
            } catch (err) {
              console.warn("Pointer lock failed after level-up selection:", err);
            }
          }
        }

        // Then resume game logic next frame
        requestAnimationFrame(() => {
          if (typeof window !== "undefined" && window.gc && typeof window.gc === "function") {
            try {
              window.gc();
            } catch (err) {}
          }

          setTimeout(() => {
            setTimeout(() => {
              resumeGameFromLevelUp();
            }, 50);
          }, 10);
        }, 0);
      }
    };
    container.appendChild(card);
  });

  document.getElementById("levelup-screen").style.display = "flex";

  try {
    if (GameContext.player && !GameContext.player.dead) {
      GameContext.player.hp = Math.min(GameContext.player.hp + 3, GameContext.player.maxHp);
      updateHealthUI(GameContext);
      playSound("powerup");
    }
  } catch (e) {
    console.warn("heal on levelup failed", e);
  }

  GameContext.menuSelectionIndex = 0;
  const cards = getActiveMenuElements();
  if (cards.length > 0) updateMenuVisuals(cards);
}

/**
 * Show the upgrade popup for a contract/event reward (upgrade already applied).
 * @param {Object} choice - From applyRandomUpgrade(): { id, name, nextTier?, tier1?, ... } or { id: "health", name: "Health Restored" }
 */
export function showRewardUpgradePopup(choice) {
  if (!choice) return;
  const container = document.getElementById("upgrade-container");
  if (!container) return;
  container.innerHTML = "";
  const parent = container.parentElement;
  const existingReroll = document.getElementById("reroll-btn");
  if (existingReroll) existingReroll.remove();

  let categoryName = "Reward";
  if (choice.id !== "health") {
    for (const cat of UPGRADE_DATA.categories) {
      if (cat.upgrades.some(u => u.id === choice.id)) {
        categoryName = cat.name;
        break;
      }
    }
  }

  const nextTier = choice.nextTier || 1;
  let desc = choice[`tier${nextTier}`];
  if (!desc) {
    for (let t = nextTier - 1; t >= 1; t--) {
      if (choice[`tier${t}`]) {
        desc = choice[`tier${t}`];
        break;
      }
    }
  }
  if (!desc) desc = choice.id === "health" ? "+5 HP" : "Further upgrade";

  const card = document.createElement("div");
  card.className = "upgrade-card";
  card.innerHTML = `
    <div class="upgrade-title">${choice.name}</div>
    <div style="color:#aaa; font-size:12px; margin-bottom:10px">${categoryName}</div>
    <div class="upgrade-desc">${desc}</div>
    <div style="font-size:12px; color:#8f8; margin-top:10px">Contract / Event reward (already applied)</div>
  `;

  card.onclick = () => {
    document.getElementById("levelup-screen").style.display = "none";
    const canvas = document.getElementById("gameCanvas");
    if (canvas && !document.pointerLockElement) {
      try {
        canvas.focus();
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === "function") request.catch(() => {});
      } catch (err) {}
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        resumeGameFromLevelUp();
      }, 50);
    });
  };
  container.appendChild(card);

  document.getElementById("levelup-screen").style.display = "flex";
  playSound("powerup");
  if (GameContext.player && !GameContext.player.dead && choice.id === "health") {
    updateHealthUI(GameContext);
  }
  GameContext.menuSelectionIndex = 0;
  const cards = getActiveMenuElements();
  if (cards.length > 0) updateMenuVisuals(cards);
}

function resumeGameFromLevelUp() {
  const resetEnt = e => {
    if (e && e.pos && e.prevPos) {
      e.prevPos.x = e.pos.x;
      e.prevPos.y = e.pos.y;
    }
  };
  if (GameContext.player) resetEnt(GameContext.player);
  if (GameContext.boss) resetEnt(GameContext.boss);
  if (GameContext.spaceStation) resetEnt(GameContext.spaceStation);
  if (GameContext.enemies) GameContext.enemies.forEach(resetEnt);
  if (GameContext.pinwheels) GameContext.pinwheels.forEach(resetEnt);
  if (GameContext.bullets) GameContext.bullets.forEach(resetEnt);
  if (GameContext.particles) GameContext.particles.forEach(resetEnt);
  if (GameContext.floatingTexts) GameContext.floatingTexts.forEach(resetEnt);

  GameContext.simAccMs = 0;
  GameContext.simLastPerfAt = performance.now();

  // Use a simpler approach than depending on exported setters which might not exist or be wired
  // We assume GameContext properties are directly mutable as per the pattern

  const nowMs = Date.now();
  const suppressUntil = nowMs + 750;

  GameContext.suppressWarpGateUntil = suppressUntil;
  GameContext.suppressWarpInputUntil = suppressUntil;

  GameContext.gameActive = true;
  if (isMusicEnabled()) {
    startMusic();
  }
}
