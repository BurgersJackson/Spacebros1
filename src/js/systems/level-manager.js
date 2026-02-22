let GameContextRef = null;
let startGameRef = null;
let getActiveMenuElementsRef = null;
let updateMenuVisualsRef = null;
let initAudioRef = null;
let saveGameRef = null;

let selectedLevel = 1;

const LEVEL_MISSIONS = {
  1: {
    title: "MISSION BRIEFING",
    description: "Defeat 3 cruisers and destroy the space station to complete this area."
  },
  2: {
    title: "LEVEL 2",
    description:
      "Defeat 3 cave monsters in order, then destroy the final destroyer to unlock Level 3."
  },
  3: {
    title: "LEVEL 3",
    description: "Complete this final challenge."
  }
};

export function registerLevelManagerDependencies(deps) {
  if (deps.GameContext) GameContextRef = deps.GameContext;
  if (deps.startGame) startGameRef = deps.startGame;
  if (deps.getActiveMenuElements) getActiveMenuElementsRef = deps.getActiveMenuElements;
  if (deps.updateMenuVisuals) updateMenuVisualsRef = deps.updateMenuVisuals;
  if (deps.initAudio) initAudioRef = deps.initAudio;
  if (deps.saveGame) saveGameRef = deps.saveGame;
}

export function initLevelSelection() {
  const levelBtns = document.querySelectorAll(".level-select-btn");
  levelBtns.forEach(btn => {
    btn.addEventListener("click", () => handleLevelButtonClick(btn));
  });

  const missionStartBtn = document.getElementById("mission-start-btn");
  if (missionStartBtn) {
    missionStartBtn.addEventListener("click", () => startSelectedLevel(false));
  }

  const missionHardcoreBtn = document.getElementById("mission-hardcore-btn");
  if (missionHardcoreBtn) {
    missionHardcoreBtn.addEventListener("click", () => startSelectedLevel(true));
  }

  const missionBackBtn = document.getElementById("mission-back-btn");
  if (missionBackBtn) {
    missionBackBtn.addEventListener("click", hideMissionModal);
  }

  updateLevelButtons();
}

function handleLevelButtonClick(btn) {
  if (btn.classList.contains("level-locked")) {
    return;
  }

  const level = parseInt(btn.dataset.level);
  selectedLevel = level;
  showMissionModal(level);
}

export function showMissionModal(level) {
  const modal = document.getElementById("level-mission-modal");
  const titleEl = document.getElementById("mission-title");
  const descEl = document.getElementById("mission-description");

  if (!modal || !titleEl || !descEl) return;

  const mission = LEVEL_MISSIONS[level];
  if (mission) {
    titleEl.textContent = mission.title;
    descEl.textContent = mission.description;
  }

  modal.style.display = "block";
  document.getElementById("start-screen").style.display = "none";

  setTimeout(() => {
    const missionStartBtn = document.getElementById("mission-start-btn");
    if (missionStartBtn) missionStartBtn.focus();
  }, 100);

  if (GameContextRef) GameContextRef.menuSelectionIndex = 0;
}

export function hideMissionModal(showStartScreen = true) {
  const modal = document.getElementById("level-mission-modal");
  if (modal) {
    modal.style.display = "none";
  }

  if (showStartScreen) {
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.style.display = "block";
    }
  }

  updateLevelButtons();

  setTimeout(() => {
    const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
    if (active.length > 0 && updateMenuVisualsRef) {
      updateMenuVisualsRef(active);
      active[0].focus();
    }
  }, 100);
}

export function startSelectedLevel(hardcore = false) {
  if (GameContextRef) {
    GameContextRef.currentLevel = selectedLevel;
    GameContextRef.hardcoreMode = hardcore;
  }
  if (initAudioRef) initAudioRef();
  if (startGameRef) startGameRef();
  hideMissionModal(false);
}

export function getUnlockedLevels() {
  if (!GameContextRef) return [1];
  if (!GameContextRef.unlockedLevels) {
    GameContextRef.unlockedLevels = [1];
  }
  return GameContextRef.unlockedLevels;
}

export function setUnlockedLevels(levels) {
  if (GameContextRef) {
    GameContextRef.unlockedLevels = levels;
  }
}

export function unlockLevel(level) {
  const unlocked = getUnlockedLevels();
  if (!unlocked.includes(level)) {
    unlocked.push(level);
    unlocked.sort((a, b) => a - b);
    setUnlockedLevels(unlocked);
    updateLevelButtons();

    if (GameContextRef && GameContextRef.currentProfileName && saveGameRef) {
      saveGameRef(GameContextRef.currentProfileName, true);
    }
  }
}

export function updateLevelButtons() {
  const unlocked = getUnlockedLevels();
  const levelBtns = document.querySelectorAll(".level-select-btn");

  levelBtns.forEach(btn => {
    const level = parseInt(btn.dataset.level);
    btn.classList.remove("level-btn-selected");

    if (unlocked.includes(level)) {
      btn.classList.remove("level-locked");
      btn.disabled = false;
    } else {
      btn.classList.add("level-locked");
      btn.disabled = true;
    }

    if (level === selectedLevel && unlocked.includes(level)) {
      btn.classList.add("level-btn-selected");
    }
  });
}

export function getSelectedLevel() {
  return selectedLevel;
}

export function setSelectedLevel(level) {
  selectedLevel = level;
  updateLevelButtons();
}

/**
 * Build current level objectives summary from GameContext. Used when pause menu opens.
 * @returns {string} Text for pause menu objectives block
 */
function buildObjectivesSummary() {
  const g = GameContextRef;
  if (!g || !g.gameActive) return "";

  const lines = [];

  // Level 2: cave monsters then destroyer
  if (g.currentLevel === 2) {
    const caveBosses = g.level2CaveBossesDefeated || 0;
    lines.push(`Cave Monsters: ${caveBosses}/3`);
    const destroyerDone = g.level2DestroyerSpawned && g.destroyer && g.destroyer.dead;
    lines.push(`Destroyer: ${destroyerDone ? "1" : "0"}/1`);
  } else if (g.sectorIndex === 1) {
    // Level 1 Sector 1: cruisers (incl. dungeon bosses), space station
    const cruiserKills = g.bossesDestroyedCount || 0;
    const dungeonBossKills = g.caveLevel?.bossesDefeated || 0;
    const cruisers = Math.min(cruiserKills + dungeonBossKills, 3);
    lines.push(`Cruisers: ${cruisers}/3`);

    const stationDone = !g.spaceStation || g.spaceStation.dead;
    lines.push(`Space station: ${stationDone ? "1" : "0"}/1`);
  } else if (g.sectorIndex === 2 && g.caveLevel) {
    const defeated = g.caveLevel.bossesDefeated || 0;
    lines.push(`Cruisers: ${defeated}/3`);
  } else {
    const finalBossDone = g.bossActive === false && (g.boss === null || (g.boss && g.boss.dead));
    lines.push(`Final boss: ${finalBossDone ? "1" : "0"}/1`);
  }

  if (lines.length === 0) return "";
  return lines.join(" • ");
}

/**
 * Update the pause menu objectives block. Call when pause menu is shown.
 */
export function updatePauseMenuObjectives() {
  const el = document.getElementById("pause-objectives");
  if (!el) return;
  el.textContent = buildObjectivesSummary();
}
