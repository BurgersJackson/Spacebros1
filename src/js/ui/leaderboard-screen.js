/**
 * Leaderboard Screen - Displays high scores for each level
 * Toggle between local (offline) and online leaderboards
 */

import {
  getLeaderboard,
  clearLeaderboardCache,
  isOnlineMode,
  toggleOnlineMode
} from "../services/leaderboard-service.js";
import { GameContext } from "../core/game-context.js";

let currentLevel = 1;
let isLoading = false;
let _returnToMenu = null;

export function registerLeaderboardScreenDependencies(deps) {
  if (deps.returnToMenu) _returnToMenu = deps.returnToMenu;
}

export function showLeaderboardScreen(level = 1) {
  const screen = document.getElementById("leaderboard-screen");
  if (!screen) {
    console.error("[LEADERBOARD SCREEN] Screen element not found");
    return;
  }

  currentLevel = level;
  updateTabButtons(level);
  updateOnlineToggleButton();

  screen.style.display = "block";

  GameContext.menuSelectionIndex = 0;
  if (GameContext.gpState) {
    GameContext.gpState.lastMenuElements = null;
  }

  loadAndDisplayScores(level);

  setupEventListeners();

  setTimeout(() => {
    const toggleBtn = document.getElementById("leaderboard-online-toggle");
    if (toggleBtn) {
      toggleBtn.focus();
    }
  }, 100);
}

export function hideLeaderboardScreen() {
  const screen = document.getElementById("leaderboard-screen");
  if (screen) {
    screen.style.display = "none";
  }
}

function updateTabButtons(activeLevel) {
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`leaderboard-tab-${i}`);
    if (btn) {
      if (i === activeLevel) {
        btn.classList.add("active");
        btn.style.background = "#0ff";
        btn.style.color = "#000";
      } else {
        btn.classList.remove("active");
        btn.style.background = "transparent";
        btn.style.color = "#0ff";
      }
    }
  }
}

function updateOnlineToggleButton() {
  const btn = document.getElementById("leaderboard-online-toggle");
  if (btn) {
    const online = isOnlineMode();
    btn.textContent = online ? "ONLINE: ON" : "ONLINE: OFF";
    btn.style.borderColor = online ? "#0f0" : "#666";
    btn.style.color = online ? "#0f0" : "#666";
  }
}

async function loadAndDisplayScores(level) {
  const container = document.getElementById("leaderboard-entries");
  if (!container) return;

  container.innerHTML = '<div class="leaderboard-loading">LOADING...</div>';
  isLoading = true;

  const modeIndicator = document.getElementById("leaderboard-mode-indicator");
  if (modeIndicator) {
    modeIndicator.textContent = isOnlineMode() ? "(ONLINE)" : "(LOCAL)";
    modeIndicator.style.color = isOnlineMode() ? "#0f0" : "#fa0";
  }

  try {
    const result = await getLeaderboard(level, true);
    const entries = result.data || [];

    if (entries.length === 0) {
      container.innerHTML =
        '<div class="leaderboard-empty">NO SCORES YET<br><br>BE THE FIRST!</div>';
    } else {
      container.innerHTML = entries
        .map((entry, index) => {
          const rankClass = index < 3 ? `rank-${index + 1}` : "";
          return `
          <div class="leaderboard-row ${rankClass}">
            <span class="leaderboard-rank">${entry.rank || index + 1}</span>
            <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
            <span class="leaderboard-score">${formatScore(entry.score)}</span>
          </div>
        `;
        })
        .join("");
    }

    if (result.offline && isOnlineMode()) {
      showOfflineNotice();
    } else {
      hideOfflineNotice();
    }
  } catch (error) {
    console.error("[LEADERBOARD SCREEN] Error loading scores:", error);
    container.innerHTML =
      '<div class="leaderboard-error">FAILED TO LOAD<br><br>TRY AGAIN LATER</div>';
  }

  isLoading = false;
}

function setupEventListeners() {
  const backBtn = document.getElementById("leaderboard-back-btn");
  const refreshBtn = document.getElementById("leaderboard-refresh-btn");
  const toggleBtn = document.getElementById("leaderboard-online-toggle");
  const tab1 = document.getElementById("leaderboard-tab-1");
  const tab2 = document.getElementById("leaderboard-tab-2");
  const tab3 = document.getElementById("leaderboard-tab-3");

  const handleBack = () => {
    hideLeaderboardScreen();
    if (_returnToMenu) {
      _returnToMenu();
    } else {
      const startScreen = document.getElementById("start-screen");
      if (startScreen) startScreen.style.display = "block";
    }
  };

  const handleRefresh = () => {
    if (!isLoading) {
      clearLeaderboardCache();
      loadAndDisplayScores(currentLevel);
    }
  };

  const handleToggleOnline = async () => {
    if (isLoading) return;

    const newMode = await toggleOnlineMode();
    updateOnlineToggleButton();
    await loadAndDisplayScores(currentLevel);
  };

  const handleTabClick = level => {
    if (level !== currentLevel && !isLoading) {
      currentLevel = level;
      updateTabButtons(level);
      loadAndDisplayScores(level);
    }
  };

  if (backBtn) {
    backBtn.onclick = handleBack;
  }

  if (refreshBtn) {
    refreshBtn.onclick = handleRefresh;
  }

  if (toggleBtn) {
    toggleBtn.onclick = handleToggleOnline;
  }

  if (tab1) tab1.onclick = () => handleTabClick(1);
  if (tab2) tab2.onclick = () => handleTabClick(2);
  if (tab3) tab3.onclick = () => handleTabClick(3);
}

function showOfflineNotice() {
  const notice = document.getElementById("leaderboard-offline-notice");
  if (notice) notice.style.display = "block";
}

function hideOfflineNotice() {
  const notice = document.getElementById("leaderboard-offline-notice");
  if (notice) notice.style.display = "none";
}

function formatScore(score) {
  return Math.floor(score).toLocaleString("en-US");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
