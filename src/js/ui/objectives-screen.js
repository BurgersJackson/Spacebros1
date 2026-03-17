import { GameContext } from "../core/game-context.js";

const deps = {};

export function registerObjectivesScreenDependencies(next) {
  Object.assign(deps, next);
}

let typewriterInterval = null;
let currentCharIndex = 0;
let fullText = "";
let objectivesScreenVisible = false;
let seenGamepadRelease = false;

const LEVEL_OBJECTIVES = {
  1: [
    "LEVEL 1: SECTOR ALPHA",
    "",
    "• Defeat 3 cruiser bosses",
    "• Destroy the space station",
    "",
    "Complete contracts for bonus upgrades!"
  ].join("\n"),
  2: [
    "LEVEL 2: CAVE SYSTEM",
    "",
    "• Defeat 3 cave monsters",
    "• Destroy the destroyer",
    "",
    "Survive the depths!"
  ].join("\n"),
  3: [
    "LEVEL 3: FINAL FRONTIER",
    "",
    "• Defeat 4 randomly selected bosses",
    "• Destroy the Warp Boss",
    "",
    "The ultimate challenge awaits!"
  ].join("\n")
};

function getObjectivesText() {
  const level = GameContext.currentLevel || 1;
  return LEVEL_OBJECTIVES[level] || LEVEL_OBJECTIVES[1];
}

export function isObjectivesScreenVisible() {
  return objectivesScreenVisible;
}

export function showObjectivesScreen() {
  const screen = document.getElementById("objectives-screen");
  const textEl = document.getElementById("objectives-text");
  const promptEl = document.getElementById("objectives-prompt");
  const continueBtn = document.getElementById("objectives-continue-btn");

  if (!screen || !textEl) return;

  objectivesScreenVisible = true;
  fullText = getObjectivesText();
  currentCharIndex = 0;
  textEl.textContent = "";

  screen.style.display = "block";
  seenGamepadRelease = false;

  // Show continue button on touch devices
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (continueBtn) {
    continueBtn.style.display = isTouchDevice ? "inline-block" : "none";
  }

  GameContext.gamePaused = true;
  GameContext.pauseStartTime = deps.getGameNowMs();

  startTypewriter(textEl, promptEl);

  document.addEventListener("keydown", handleSkipKey);

  // Add click/touch handlers for mobile
  if (continueBtn) {
    continueBtn.addEventListener("click", handleContinueClick);
  }
  screen.addEventListener("click", handleScreenClick);
}

export function hideObjectivesScreen() {
  const screen = document.getElementById("objectives-screen");
  const continueBtn = document.getElementById("objectives-continue-btn");

  if (typewriterInterval) {
    clearInterval(typewriterInterval);
    typewriterInterval = null;
  }

  document.removeEventListener("keydown", handleSkipKey);

  // Remove click/touch handlers
  if (continueBtn) {
    continueBtn.removeEventListener("click", handleContinueClick);
  }
  if (screen) {
    screen.removeEventListener("click", handleScreenClick);
    screen.style.display = "none";
  }

  objectivesScreenVisible = false;

  if (GameContext.pauseStartTime) {
    const pauseMs = Math.max(0, deps.getGameNowMs() - GameContext.pauseStartTime);
    if (pauseMs > 0) {
      GameContext.pausedAccumMs += pauseMs;
      deps.shiftPausedTimers(pauseMs);
    }
    GameContext.pauseStartTime = null;
  }

  GameContext.gamePaused = false;

  const now = deps.getGameNowMs();
  GameContext.objectivesScreenShown = true;
  GameContext.initialSpawnDelayAt = now + 5000;

  if (deps.getMusicEnabled && deps.getMusicEnabled()) {
    deps.startMusic();
  }

  const canvas = document.getElementById("gameCanvas");
  if (canvas && document.body.contains(canvas) && !document.pointerLockElement) {
    let isFullscreen = false;
    try {
      isFullscreen = window.getComputedStyle(canvas).position === "fixed";
    } catch (e) {
      isFullscreen = canvas.style.position === "fixed";
    }
    if (!isFullscreen) {
      canvas.focus();
      try {
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === "function") {
          request.catch(() => {});
        }
      } catch (err) {}
    }
  }
}

function startTypewriter(textEl, promptEl) {
  const charDelay = 25;

  updatePromptText(promptEl);

  typewriterInterval = setInterval(() => {
    if (currentCharIndex < fullText.length) {
      textEl.textContent = fullText.substring(0, currentCharIndex + 1);
      currentCharIndex++;
    } else {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
  }, charDelay);
}

function updatePromptText(promptEl) {
  if (!promptEl) return;

  if (GameContext.usingGamepad) {
    promptEl.innerHTML = 'Press <span style="color:#0ff">A</span> to continue';
  } else {
    promptEl.innerHTML = 'Press <span style="color:#0ff">SPACE</span> to continue';
  }
}

function handleSkipKey(e) {
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    skipOrClose();
  }
}

function handleContinueClick(e) {
  e.stopPropagation();
  skipOrClose();
}

function handleScreenClick(e) {
  // Allow clicking anywhere on the screen to dismiss (for touch devices)
  // but ignore clicks on the continue button (handled separately)
  if (e.target.id === "objectives-continue-btn") return;
  skipOrClose();
}

export function handleGamepadInputForObjectives() {
  if (!objectivesScreenVisible) {
    seenGamepadRelease = false;
    return false;
  }

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads[GameContext.gamepadIndex];

  if (!gp) {
    seenGamepadRelease = false;
    return false;
  }

  const confirmPressed = gp.buttons[0] && gp.buttons[0].pressed;

  if (!confirmPressed) {
    seenGamepadRelease = true;
    return false;
  }

  if (!seenGamepadRelease) {
    return false;
  }

  seenGamepadRelease = false;
  GameContext.lastGamepadInputAt = Date.now();
  skipOrClose();
  return true;
}

function skipOrClose() {
  const textEl = document.getElementById("objectives-text");

  if (currentCharIndex < fullText.length) {
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
    textEl.textContent = fullText;
    currentCharIndex = fullText.length;
  } else {
    hideObjectivesScreen();
  }
}

export function updateObjectivesPromptForInputMode() {
  if (!objectivesScreenVisible) return;

  const promptEl = document.getElementById("objectives-prompt");
  updatePromptText(promptEl);
}
