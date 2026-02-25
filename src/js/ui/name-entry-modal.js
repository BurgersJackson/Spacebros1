/**
 * Name Entry Modal - Prompts player to enter their name for high score submission
 */

import {
  submitScore,
  savePlayerName,
  getSavedPlayerName
} from "../services/leaderboard-service.js";
import { GameContext } from "../core/game-context.js";

let _showDeathScreen = null;
let _playSound = null;

export function registerNameEntryDependencies(deps) {
  if (deps.showDeathScreen) _showDeathScreen = deps.showDeathScreen;
  if (deps.playSound) _playSound = deps.playSound;
}

export function showNameEntryModal(level, score, rank) {
  const modal = document.getElementById("name-entry-modal");
  const input = document.getElementById("name-entry-input");
  const titleEl = document.getElementById("name-entry-title");
  const scoreEl = document.getElementById("name-entry-score");
  const rankEl = document.getElementById("name-entry-rank");
  const submitBtn = document.getElementById("name-entry-submit");
  const skipBtn = document.getElementById("name-entry-skip");

  if (!modal || !input) {
    console.error("[NAME ENTRY] Modal elements not found");
    if (_showDeathScreen) {
      _showDeathScreen(null, { returnToSummary: true });
    }
    return;
  }

  const rankSuffix = getRankSuffix(rank);
  if (titleEl) titleEl.textContent = "NEW HIGH SCORE!";
  if (scoreEl) scoreEl.textContent = formatScore(score);
  if (rankEl) rankEl.textContent = `${rank}${rankSuffix} PLACE`;

  const savedName = getSavedPlayerName();
  input.value = savedName;

  modal.style.display = "block";

  GameContext.menuSelectionIndex = 0;
  if (GameContext.gpState) {
    GameContext.gpState.lastMenuElements = null;
  }

  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);

  const handleSubmit = async () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }

    savePlayerName(name);

    submitBtn.disabled = true;
    submitBtn.textContent = "SUBMITTING...";

    if (_playSound) _playSound("coin");

    const result = await submitScore(level, name, score);

    cleanup();
    modal.style.display = "none";

    if (_showDeathScreen) {
      _showDeathScreen(null, { returnToSummary: true });
    }
  };

  const handleSkip = () => {
    cleanup();
    modal.style.display = "none";

    if (_showDeathScreen) {
      _showDeathScreen(null, { returnToSummary: true });
    }
  };

  const handleKeydown = e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleSkip();
    }
  };

  const cleanup = () => {
    submitBtn.removeEventListener("click", handleSubmit);
    skipBtn.removeEventListener("click", handleSkip);
    input.removeEventListener("keydown", handleKeydown);
    submitBtn.disabled = false;
    submitBtn.textContent = "SUBMIT";
  };

  submitBtn.addEventListener("click", handleSubmit);
  skipBtn.addEventListener("click", handleSkip);
  input.addEventListener("keydown", handleKeydown);
}

function getRankSuffix(rank) {
  if (rank >= 11 && rank <= 13) return "th";
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatScore(score) {
  return Math.floor(score).toLocaleString("en-US");
}

export function hideNameEntryModal() {
  const modal = document.getElementById("name-entry-modal");
  if (modal) {
    modal.style.display = "none";
  }
}
