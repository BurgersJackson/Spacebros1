import { GameContext, getElapsedGameTime } from "../core/game-context.js";
import { ZOOM_LEVEL } from "../core/constants.js";

const deps = {};

export function registerGameFlowDependencies(next) {
  Object.assign(deps, next);
}

export function getGameFlowDeps() {
  return deps;
}

function updateResumeButtonState() {
  const resumeBtn = document.getElementById("resume-btn-start");
  if (resumeBtn) {
    if (GameContext.canResumeGame) {
      resumeBtn.disabled = false;
      resumeBtn.style.opacity = "1";
      resumeBtn.style.cursor = "pointer";
    } else {
      resumeBtn.disabled = true;
      resumeBtn.style.opacity = "0.5";
      resumeBtn.style.cursor = "not-allowed";
    }
  }
}

export function initGameFlow() {
  window.updateResumeButtonState = updateResumeButtonState;
}

export function endGame(elapsedMs, options = {}) {
  if (GameContext.gameEnded) return;
  GameContext.gameEnded = true;
  GameContext.gameActive = false;
  GameContext.gamePaused = false;
  GameContext.canResumeGame = false;

  // Ensure menus can use the mouse.
  const canvas = document.getElementById("gameCanvas");
  if (canvas && document.pointerLockElement === canvas) {
    try {
      document.exitPointerLock();
    } catch (e) {}
  }

  deps.stopMusic();
  try {
    deps.depositMetaNuggets();
  } catch (e) {
    console.warn("meta deposit failed", e);
  }
  if (GameContext.currentProfileName) {
    try {
      deps.autoSaveToCurrentProfile();
      deps.saveMetaProfile();
    } catch (e) {
      console.warn("save on end game failed", e);
    }
  }
  const startEl = document.getElementById("start-screen");
  if (startEl) startEl.style.display = "none";
  document.getElementById("pause-menu").style.display = "none";

  if (options.showDeathScreen && deps.showDeathScreen) {
    deps.showDeathScreen(elapsedMs, { title: options.title, titleColor: options.titleColor });
    const endEl = document.getElementById("end-screen");
    if (endEl) endEl.style.display = "none";
    setTimeout(() => {
      const btn = document.getElementById("death-restart-btn");
      if (btn) btn.focus();
    }, 100);
  } else {
    const endEl = document.getElementById("end-screen");
    if (endEl) endEl.style.display = "block";
    const t = document.getElementById("end-time");
    const sc = document.getElementById("end-score");
    const ng = document.getElementById("end-nuggets");
    if (t) t.innerText = deps.formatTime(elapsedMs);
    if (sc) sc.innerText = GameContext.score;
    if (ng) ng.innerText = GameContext.spaceNuggets;
    setTimeout(() => {
      const btn = document.getElementById("restart-btn");
      if (btn) btn.focus();
    }, 100);
  }

  if (window.updateResumeButtonState) {
    window.updateResumeButtonState();
  }
}

export function killPlayer() {
  GameContext.player.dead = true;
  if (GameContext.metaExtraLifeCount > 0) {
    GameContext.metaExtraLifeCount--;
    GameContext.player.dead = false;
    GameContext.player.hp = GameContext.player.maxHp;
    GameContext.player.invulnerable = 180;
    deps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 20, "#0f0");
    deps.showOverlayMessage(
      `SECOND CHANCE! (${GameContext.metaExtraLifeCount} remaining)`,
      "#0f0",
      1500
    );
    deps.updateHealthUI();
    return;
  }
  deps.playSound("explode");
  deps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 30, "#0ff");
  setTimeout(() => {
    // Capture survival time BEFORE setting gameActive = false
    const survivalTimeMs = getElapsedGameTime();
    GameContext.gameActive = false;
    deps.resetWarpState();
    deps.stopMusic();
    try {
      deps.depositMetaNuggets();
    } catch (e) {
      console.warn("meta deposit failed", e);
    }
    if (GameContext.currentProfileName) {
      deps.autoSaveToCurrentProfile();
      deps.saveMetaProfile();
    }
    // Show death screen instead of start screen
    if (deps.showDeathScreen) {
      deps.showDeathScreen(survivalTimeMs);
    } else {
      // Fallback to old behavior if death screen not available
      document.getElementById("start-screen").style.display = "block";
      document.querySelector("#start-screen h1").innerText = "BETTER LUCK NEXT TIME";
      document.querySelector("#start-screen h1").style.color = "#f00";
      document.getElementById("start-btn").innerText = "REBOOT SYSTEM";
      setTimeout(() => {
        document.getElementById("start-btn").focus();
        GameContext.menuSelectionIndex = 0;
      }, 100);
    }
  }, 2000);
}

export function startGame() {
  console.log("[DEBUG] startGame() called");

  if (!GameContext.currentProfileName) {
    console.log("[START] No profile selected, checking for auto-create");
    const existing = deps.listSaveSlots();
    if (existing.length === 0) {
      console.log("[START] Auto-creating default profile");
      const newName = "profile1";
      const template = {
        version: 1,
        timestamp: Date.now(),
        lastSavedAt: Date.now(),
        score: 0,
        sectorIndex: 1,
        totalKills: 0,
        highScore: 0,
        totalPlayTimeMs: 0,
        player: null
      };
      try {
        localStorage.setItem(deps.savePrefix + newName, JSON.stringify(template));
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
        localStorage.setItem(`meta_profile_v1_${newName}`, JSON.stringify(newMetaProfile));
        deps.selectProfile(newName);
      } catch (e) {
        console.warn("[START] Auto-create failed", e);
      }
    }
  }

  try {
    deps.setFromPauseMenu(false);

    deps.resetWarpState();
    deps.resetCaveState();
    deps.resetDungeon1State();
    if (deps.resetVerticalScrollingState) deps.resetVerticalScrollingState();
    GameContext.warpCompletedOnce = false;
    deps.setMusicMode("normal");
    GameContext.gameMode = "normal";
    deps.setSimNowMs(0);
    GameContext.arcadeBoss = null;
    GameContext.arcadeWave = 0;
    GameContext.arcadeWaveNextAt = 0;
    GameContext.currentZoom = ZOOM_LEVEL;
    deps.stopMusic();
    if (GameContext.player) deps.pixiCleanupObject(GameContext.player);
    const shipType = deps.getSelectedShipType ? deps.getSelectedShipType() : null;
    GameContext.player = new deps.Spaceship(shipType || "standard");

    if (GameContext.currentProfileName) {
      const raw = localStorage.getItem(deps.savePrefix + GameContext.currentProfileName);
      if (raw) {
        try {
          const profile = JSON.parse(raw);
          if (typeof profile.totalKills === "number") GameContext.totalKills = profile.totalKills;
          if (typeof profile.highScore === "number") GameContext.highScore = profile.highScore;
          if (typeof profile.totalPlayTimeMs === "number")
            GameContext.totalPlayTimeMs = profile.totalPlayTimeMs;
        } catch (e) {
          console.warn("Failed to load profile on start", e);
        }
      }
    } else {
      deps.resetProfileStats();
    }

    GameContext.score = 0;
    GameContext.difficultyTier = 1;
    GameContext.pinwheelsDestroyedTotal = 0;
    GameContext.gunboatsDestroyedTotal = 0;
    // Reset death screen statistics
    GameContext.damageByWeaponType = {};
    GameContext.enemyKills = 0;
    GameContext.bossKills = 0;
    GameContext.totalDamageDealt = 0;
    GameContext.bossActive = false;
    if (GameContext.boss) deps.pixiCleanupObject(GameContext.boss);
    GameContext.boss = null;
    GameContext.bossArena.active = false;
    GameContext.bossArena.growing = false;
    deps.stopArenaCountdown();
    GameContext.cruiserEncounterCount = 0;
    GameContext.bossesDestroyedCount = 0;
    GameContext.cruiserTimerPausedAt = null;
    GameContext.dreadManager.upgradesChosen = 0;
    GameContext.dreadManager.timerActive = true;
    GameContext.dreadManager.timerAt =
      Date.now() +
      GameContext.dreadManager.minDelayMs +
      Math.floor(
        Math.random() *
          (GameContext.dreadManager.maxDelayMs - GameContext.dreadManager.minDelayMs + 1)
      );
    GameContext.rerollTokens = GameContext.metaProfile.purchases.rerollTokens || 0;
    GameContext.metaExtraLifeCount = GameContext.metaProfile.purchases.extraLife || 0;

    GameContext.player.fireDelay = 24;

    GameContext.player.turretLevel = 1;
    GameContext.player.canWarp = false;
    GameContext.player.shieldSegments = new Array(8).fill(2);
    GameContext.player.outerShieldSegments = new Array(12).fill(2);
    GameContext.player.hp = GameContext.player.maxHp;
    GameContext.player.inventory = {};
    GameContext.player.reactiveShieldCoins = 0;
    GameContext.shownUpgradesThisRun = new Set();
    GameContext.player.xp = 0;
    GameContext.player.level = 1;
    GameContext.player.nextLevelXp = 100;
    GameContext.player.stats = {
      damageMult: 1.0,
      fireRateMult: 1.0,
      shotgunFireRateMult: 1.0,
      rangeMult: 1.0,
      multiShot: 1,
      homing: 0,
      shieldRegenRate: 8,
      hpRegenAmount: 1,
      hpRegenRate: 10,
      speedMult: 1.0,
      slowField: 0,
      slowFieldDuration: 0,
      critChance: 0,
      critDamage: 2.0,
      lifestealAmount: 0,
      lifestealThreshold: 100,
      thornArmor: 0,
      evasion: 0,
      piercing: 0,
      explosiveRounds: 0,
      explosiveDamage: 300,
      explosiveRadius: 200,
      splitShot: 0,
      comboMeter: 0,
      comboMaxBonus: 0,
      secondWindFrames: 0,
      secondWindCooldown: 0,
      secondWindActive: 0
    };
    GameContext.player.comboStacks = 0;
    GameContext.player.comboMaxStacks = 100;
    GameContext.player.lastHitTime = Date.now();
    GameContext.player.lastDamageTakenTime = 0;
    GameContext.player.lastHpRegenTime = Date.now();
    GameContext.player.staticWeapons = [];
    GameContext.player.nukeMaxCooldown = 600;
    GameContext.player.magnetRadius = 150;
    GameContext.player.nukeUnlocked = false;
    GameContext.player.volleyShotUnlocked = false;
    GameContext.player.volleyShotCount = 0;
    GameContext.player.volleyCooldown = 0;
    GameContext.player.lastF = false;
    GameContext.gameEnded = false;

    deps.setupGameWorld();

    deps.applyMetaUpgrades(deps.spawnDrone);

    deps.applyPendingProfile();
    deps.updateHealthUI();

    document.getElementById("score").innerText = GameContext.score;
    document.getElementById("start-screen").style.display = "none";
    const endScreen = document.getElementById("end-screen");
    if (endScreen) endScreen.style.display = "none";
    const deathScreen = document.getElementById("death-screen");
    if (deathScreen) deathScreen.style.display = "none";
    document.getElementById("pause-menu").style.display = "none";
    GameContext.gameActive = true;
    GameContext.gamePaused = false;
    GameContext.canResumeGame = false;

    // Windowed mode: lock mouse to the game window (prevents cursor leaving the window mid-run).
    // Fullscreen already confines the cursor, so we only do this in windowed.
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
            request.catch(err => console.warn("Pointer lock failed on game start:", err));
          }
        } catch (err) {
          console.warn("Pointer lock failed on game start:", err);
        }
      }
    }

    if (window.updateResumeButtonState) {
      window.updateResumeButtonState();
    }

    deps.setupGameWorld();
    deps.updateContractUI();

    if (deps.getMusicEnabled && deps.getMusicEnabled()) {
      deps.initAudio();
      deps.startMusic();
    }
  } catch (e) {
    console.error("[STARTGAME ERROR]", e);
  }
}

export function shiftPausedTimers(pauseMs) {
  if (!pauseMs || pauseMs <= 0) return;
  const shiftIfNumber = val =>
    typeof val === "number" && isFinite(val) && val > 0 ? val + pauseMs : val;
  const shiftArrayNumbers = arr => {
    if (!Array.isArray(arr)) return arr;
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] === "number" && isFinite(arr[i]) && arr[i] > 0) arr[i] += pauseMs;
    }
    return arr;
  };

  GameContext.warpCountdownAt = shiftIfNumber(GameContext.warpCountdownAt);
  GameContext.nextContractAt = shiftIfNumber(GameContext.nextContractAt);
  GameContext.nextSpaceStationTime = shiftIfNumber(GameContext.nextSpaceStationTime);
  GameContext.gunboatRespawnAt = shiftIfNumber(GameContext.gunboatRespawnAt);
  GameContext.nextShootingStarTime = shiftIfNumber(GameContext.nextShootingStarTime);
  GameContext.nextRadiationStormAt = shiftIfNumber(GameContext.nextRadiationStormAt);
  GameContext.nextMiniEventAt = shiftIfNumber(GameContext.nextMiniEventAt);
  GameContext.nextIntensityBreakAt = shiftIfNumber(GameContext.nextIntensityBreakAt);
  GameContext.initialSpawnDelayAt = shiftIfNumber(GameContext.initialSpawnDelayAt);

  GameContext.asteroidRespawnTimers = shiftArrayNumbers(GameContext.asteroidRespawnTimers);
  GameContext.baseRespawnTimers = shiftArrayNumbers(GameContext.baseRespawnTimers);

  if (
    GameContext.dreadManager &&
    GameContext.dreadManager.timerActive &&
    typeof GameContext.dreadManager.timerAt === "number"
  ) {
    GameContext.dreadManager.timerAt += pauseMs;
  }
  if (
    GameContext.cruiserTimerPausedAt !== null &&
    typeof GameContext.cruiserTimerPausedAt === "number"
  ) {
    GameContext.cruiserTimerPausedAt += pauseMs;
  }
  if (GameContext.radiationStorm && typeof GameContext.radiationStorm.endsAt === "number") {
    GameContext.radiationStorm.endsAt += pauseMs;
  }
  if (GameContext.miniEvent) {
    if (typeof GameContext.miniEvent.expiresAt === "number")
      GameContext.miniEvent.expiresAt += pauseMs;
    if (typeof GameContext.miniEvent.nextWaveAt === "number")
      GameContext.miniEvent.nextWaveAt += pauseMs;
    if (typeof GameContext.miniEvent.lastUpdateAt === "number")
      GameContext.miniEvent.lastUpdateAt += pauseMs;
  }
  if (GameContext.activeContract && typeof GameContext.activeContract.endsAt === "number") {
    GameContext.activeContract.endsAt += pauseMs;
  }
}

export function togglePause() {
  if (!GameContext.gameActive) return;

  if (document.getElementById("debug-menu").style.display === "block") {
    deps.hideDebugMenu();
    return;
  }

  if (
    deps.getFromPauseMenu &&
    deps.getFromPauseMenu() &&
    GameContext.gamePaused &&
    document.getElementById("start-screen").style.display === "block"
  ) {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("pause-menu").style.display = "block";
    if (deps.updatePauseMenuObjectives) deps.updatePauseMenuObjectives();
    if (deps.setFromPauseMenu) deps.setFromPauseMenu(false);
    return;
  }

  GameContext.gamePaused = !GameContext.gamePaused;
  document.getElementById("pause-menu").style.display = GameContext.gamePaused ? "block" : "none";
  if (GameContext.gamePaused) {
    if (deps.updatePauseMenuObjectives) deps.updatePauseMenuObjectives();
    GameContext.pauseStartTime = deps.getGameNowMs();
    if (deps.isArenaCountdownActive && deps.isArenaCountdownActive()) deps.stopArenaCountdown();

    // If the mouse was locked during gameplay, release it immediately for menu interaction.
    const canvas = document.getElementById("gameCanvas");
    if (canvas && document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
  } else {
    if (GameContext.pauseStartTime) {
      const pauseMs = Math.max(0, deps.getGameNowMs() - GameContext.pauseStartTime);
      if (pauseMs > 0) {
        GameContext.pausedAccumMs += pauseMs;
        shiftPausedTimers(pauseMs);
      }
      GameContext.pauseStartTime = null;
    }
  }
  if (GameContext.gamePaused) {
    setTimeout(() => {
      document.getElementById("resume-btn").focus();
      GameContext.menuSelectionIndex = 0;
    }, 100);
  } else if (deps.getMusicEnabled && deps.getMusicEnabled()) {
    deps.startMusic();
  }

  // Windowed mode: re-lock mouse on unpause (in the same user gesture).
  if (!GameContext.gamePaused) {
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
            request.catch(err => {
              // Silently ignore SecurityError from user exiting lock via ESC
              if (err.name !== "SecurityError") {
                console.warn("Pointer lock failed on unpause:", err);
              }
            });
          }
        } catch (err) {
          // Silently ignore SecurityError from user exiting lock via ESC
          if (err.name !== "SecurityError") {
            console.warn("Pointer lock failed on unpause:", err);
          }
        }
      }
    }
  }
}

export function quitGame() {
  try {
    deps.depositMetaNuggets();
  } catch (e) {
    console.warn("meta deposit failed on abort", e);
  }

  if (GameContext.currentProfileName) {
    try {
      deps.autoSaveToCurrentProfile();
      deps.saveMetaProfile();
    } catch (e) {
      console.warn("save failed on abort", e);
    }
  }

  // Capture survival time BEFORE setting gameActive = false
  const survivalTimeMs = getElapsedGameTime();
  GameContext.gameActive = false;
  GameContext.gameEnded = true;

  // Ensure menus can use the mouse.
  const canvas = document.getElementById("gameCanvas");
  if (canvas && document.pointerLockElement === canvas) {
    try {
      document.exitPointerLock();
    } catch (e) {}
  }

  deps.stopArenaCountdown();
  deps.stopMusic();
  if (deps.resetVerticalScrollingState) deps.resetVerticalScrollingState();
  GameContext.sectorIndex = 1;

  document.getElementById("pause-menu").style.display = "none";

  // Show death screen instead of start screen
  if (deps.showDeathScreen) {
    deps.showDeathScreen(survivalTimeMs);
  } else {
    // Fallback to old behavior
    document.getElementById("start-screen").style.display = "block";
    const endScreen = document.getElementById("end-screen");
    if (endScreen) endScreen.style.display = "none";
    document.querySelector("#start-screen h1").innerText = "ABORTED";
    document.getElementById("start-btn").innerText = "INITIATE LAUNCH";
    setTimeout(() => document.getElementById("resume-btn-start").focus(), 100);
    GameContext.menuSelectionIndex = 0;
  }

  GameContext.canResumeGame = false;

  updateResumeButtonState();
  window.updateResumeButtonState = updateResumeButtonState;
}

/**
 * Return to main menu from death screen
 * Hides death screen and shows start screen without starting a new game
 */
export function returnToMainMenuFromDeath() {
  // Hide death screen
  const deathScreen = document.getElementById("death-screen");
  if (deathScreen) {
    deathScreen.style.display = "none";
  }

  // Show start screen
  const startScreen = document.getElementById("start-screen");
  if (startScreen) {
    startScreen.style.display = "block";
    // Reset start screen text to default
    document.querySelector("#start-screen h1").innerText = "SPACEBROS";
    document.querySelector("#start-screen h1").style.color = "";
    document.getElementById("start-btn").innerText = "INITIATE LAUNCH";

    // Focus the start button
    setTimeout(() => {
      const startBtn = document.getElementById("start-btn");
      if (startBtn) startBtn.focus();
    }, 100);

    // Reset menu selection
    GameContext.menuSelectionIndex = 0;
  }

  // Hide pause menu
  const pauseMenu = document.getElementById("pause-menu");
  if (pauseMenu) {
    pauseMenu.style.display = "none";
  }

  // Start background music if not already playing
  if (deps.startMusic) deps.startMusic();
}
