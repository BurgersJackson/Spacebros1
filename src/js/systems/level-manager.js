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
    description: "Destroy the space station to beat this area."
  },
  2: {
    title: "LEVEL 2",
    description: "Defeat the final boss in this sector to unlock Level 3."
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
    missionStartBtn.addEventListener("click", startSelectedLevel);
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

export function startSelectedLevel() {
  if (GameContextRef) {
    GameContextRef.currentLevel = selectedLevel;
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
