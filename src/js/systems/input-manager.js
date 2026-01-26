import { GameContext } from "../core/game-context.js";
import { ZOOM_LEVEL } from "../core/constants.js";
import { initAudio } from "../audio/audio-manager.js";

let _canvas = null;
let _getInternalSize = null;
let _getViewportSize = null;
let _togglePause = null;
let _toggleDebugButton = null;
let _handleSpaceStationDestroyed = null;
let _startGame = null;
let _completeSectorWarp = null;
let _enterWarpMaze = null;
let _showOverlayMessage = null;
let _getGameNowMs = null;
let _shiftPausedTimers = null;
let _getReturningFromModal = null;
let _setReturningFromModal = null;

let menuDebounce = 0;
let mouseMovementDir = { x: 0, y: 0 };
let mouseLastPos = { x: 0, y: 0 };
let smoothedDir = { x: 0, y: 0 };

/**
 * @param {Object} deps
 */
export function registerInputDependencies(deps) {
  if (deps.canvas) _canvas = deps.canvas;
  if (deps.getInternalSize) _getInternalSize = deps.getInternalSize;
  if (deps.getViewportSize) _getViewportSize = deps.getViewportSize;
  if (deps.togglePause) _togglePause = deps.togglePause;
  if (deps.toggleDebugButton) _toggleDebugButton = deps.toggleDebugButton;
  if (deps.handleSpaceStationDestroyed)
    _handleSpaceStationDestroyed = deps.handleSpaceStationDestroyed;
  if (deps.startGame) _startGame = deps.startGame;
  if (deps.completeSectorWarp) _completeSectorWarp = deps.completeSectorWarp;
  if (deps.enterWarpMaze) _enterWarpMaze = deps.enterWarpMaze;
  if (deps.showOverlayMessage) _showOverlayMessage = deps.showOverlayMessage;
  if (deps.getGameNowMs) _getGameNowMs = deps.getGameNowMs;
  if (deps.shiftPausedTimers) _shiftPausedTimers = deps.shiftPausedTimers;
  if (deps.getReturningFromModal) _getReturningFromModal = deps.getReturningFromModal;
  if (deps.setReturningFromModal) _setReturningFromModal = deps.setReturningFromModal;
}

/**
 * @param {number} now
 */
export function updateInputMode(now = Date.now()) {
  const preferGamepadMs = 1200;
  const mouseGraceMs = 220;
  const strictGamepad = now - GameContext.lastGamepadInputAt < 100;

  if (strictGamepad) {
    GameContext.usingGamepad = true;
  } else {
    const gamepadRecent = now - GameContext.lastGamepadInputAt < preferGamepadMs;
    const mouseRecent = now - GameContext.lastMouseInputAt < mouseGraceMs;
    GameContext.usingGamepad = gamepadRecent && !mouseRecent;
  }

  const levelupScreen = document.getElementById("levelup-screen");
  const isMenuOpen =
    GameContext.gamePaused ||
    !GameContext.gameActive ||
    (levelupScreen && levelupScreen.style.display === "flex");

  if (
    (GameContext.usingGamepad ||
      (GameContext.player && GameContext.player.shipType === "slacker")) &&
    !isMenuOpen
  ) {
    document.body.classList.add("no-cursor");
  } else {
    document.body.classList.remove("no-cursor");
  }
}

/**
 * @returns {HTMLElement[]}
 */
export function getActiveMenuElements() {
  const isVisible = el => {
    if (!el) return false;
    if (typeof window === "undefined" || !window.getComputedStyle) {
      return el.style.display !== "none" && el.style.visibility !== "hidden";
    }
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const metaShopModal = document.getElementById("meta-shop-modal");
  if (isVisible(metaShopModal)) {
    const buyBtn = document.getElementById("meta-modal-buy");
    const backBtn = document.getElementById("meta-modal-back");
    const result = [];
    if (buyBtn) result.push(buyBtn);
    if (backBtn) result.push(backBtn);
    return result;
  }

  const upgradesMenu = document.getElementById("upgrades-menu");
  if (isVisible(upgradesMenu)) {
    const shopButtons = Array.from(document.querySelectorAll("#meta-shop .meta-item button"));
    const backBtn = document.getElementById("upgrades-back-btn");
    const result = [];
    if (shopButtons.length) {
      result.push(...shopButtons);
    }
    if (backBtn) {
      result.push(backBtn);
    }
    return result.length ? result : backBtn ? [backBtn] : [];
  }

  const runUpgradesScreen = document.getElementById("run-upgrades-screen");
  if (isVisible(runUpgradesScreen)) {
    const backBtn = document.getElementById("run-upgrades-back-btn");
    return backBtn ? [backBtn] : [];
  }

  const debugMenu = document.getElementById("debug-menu");
  if (isVisible(debugMenu)) {
    const backBtn = document.getElementById("debug-back-btn");
    const tierButtons = Array.from(document.querySelectorAll(".debug-tier-btn"));
    return backBtn ? [backBtn, ...tierButtons] : tierButtons;
  }

  const levelupScreen = document.getElementById("levelup-screen");
  if (isVisible(levelupScreen)) {
    const elements = [];
    const rerollBtn = document.getElementById("reroll-btn");
    if (rerollBtn) {
      elements.push(rerollBtn);
    }
    const cards = Array.from(document.querySelectorAll(".upgrade-card"));
    return elements.concat(cards);
  }

  const settingsMenu = document.getElementById("settings-menu");
  if (isVisible(settingsMenu)) {
    const elements = [];

    const resSelect = document.getElementById("res-select");
    if (resSelect) {
      elements.push(resSelect);
    }

    const fullscreenCheck = document.getElementById("fullscreen-check");
    if (fullscreenCheck) {
      elements.push(fullscreenCheck);
    }
    const vsyncCheck = document.getElementById("vsync-check");
    if (vsyncCheck) {
      elements.push(vsyncCheck);
    }
    const framelessCheck = document.getElementById("frameless-check");
    if (framelessCheck) {
      elements.push(framelessCheck);
    }

    const musicVolume = document.getElementById("music-volume");
    const sfxVolume = document.getElementById("sfx-volume");
    if (musicVolume) {
      elements.push(musicVolume);
    }
    if (sfxVolume) {
      elements.push(sfxVolume);
    }

    const settingsCloseBtn = document.getElementById("settings-close-btn");
    const settingsApplyBtn = document.getElementById("settings-apply-btn");
    if (settingsCloseBtn) {
      elements.push(settingsCloseBtn);
    }
    if (settingsApplyBtn) {
      elements.push(settingsApplyBtn);
    }

    return elements;
  }

  const saveMenu = document.getElementById("save-menu");
  if (isVisible(saveMenu)) {
    const profileItems = Array.from(document.querySelectorAll(".profile-item"));
    const actionButtons = Array.from(document.querySelectorAll("#save-menu button"));
    return [...profileItems, ...actionButtons];
  }

  const abortModal = document.getElementById("abort-modal");
  if (isVisible(abortModal)) {
    return Array.from(document.querySelectorAll("#abort-modal button"));
  }

  const renameModal = document.getElementById("rename-prompt-modal");
  if (isVisible(renameModal)) {
    return Array.from(document.querySelectorAll("#rename-prompt-modal button"));
  }

  const pauseMenu = document.getElementById("pause-menu");
  if (isVisible(pauseMenu)) {
    return Array.from(document.querySelectorAll("#pause-menu button"));
  }

  const startScreen = document.getElementById("start-screen");
  if (isVisible(startScreen)) {
    return Array.from(document.querySelectorAll("#start-screen button"));
  }

  return [];
}

/**
 * @param {HTMLElement[]} elements
 */
export function updateMenuVisuals(elements) {
  elements.forEach((el, idx) => {
    if (idx === GameContext.menuSelectionIndex) {
      el.classList.add("selected");
      if (typeof el.focus === "function") {
        el.focus();
      }
      if (el.tagName === "BUTTON") {
        const metaItem = el.closest(".meta-item");
        if (metaItem) {
          metaItem.classList.add("selected");
          metaItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest"
          });
        }
      }
      if (el.classList.contains("profile-item")) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest"
        });
      }
    } else {
      el.classList.remove("selected");
      if (typeof el.blur === "function") {
        el.blur();
      }
      if (el.tagName === "BUTTON") {
        const metaItem = el.closest(".meta-item");
        if (metaItem) {
          metaItem.classList.remove("selected");
        }
      }
    }
  });
}

/**
 * @param {number} value
 */
export function setMenuDebounce(value) {
  menuDebounce = value;
}

/**
 * @returns {boolean}
 */
function handleMenuNavigation(now) {
  if ((!GameContext.gameActive || GameContext.gamePaused) && now - menuDebounce > 150) {
    const activeElements = getActiveMenuElements();
    if (activeElements.length > 0) {
      const menuChanged =
        !GameContext.gpState.lastMenuElements ||
        GameContext.gpState.lastMenuElements.length !== activeElements.length ||
        GameContext.gpState.lastMenuElements[0] !== activeElements[0];

      if (menuChanged) {
        if (!_getReturningFromModal || !_getReturningFromModal()) {
          GameContext.menuSelectionIndex = 0;
        }
        GameContext.gpState.lastMenuElements = activeElements;
        updateMenuVisuals(activeElements);
      }

      if (_getReturningFromModal && _getReturningFromModal() && menuChanged) {
        if (_setReturningFromModal) _setReturningFromModal(false);
      }

      const selectedEl = activeElements[GameContext.menuSelectionIndex];
      const isSlider = selectedEl && selectedEl.tagName === "INPUT" && selectedEl.type === "range";
      const isCheckbox =
        selectedEl && selectedEl.tagName === "INPUT" && selectedEl.type === "checkbox";
      const isSelect = selectedEl && selectedEl.tagName === "SELECT";

      const leftPressed =
        GameContext.gpState.lastPadAxes?.x < -0.5 || GameContext.gpState.lastPadButtons?.left;
      const rightPressed =
        GameContext.gpState.lastPadAxes?.x > 0.5 || GameContext.gpState.lastPadButtons?.right;

      if (isSlider) {
        if (leftPressed || rightPressed) {
          const changeAmount = 5;
          if (rightPressed) {
            selectedEl.value = Math.min(
              parseInt(selectedEl.max),
              parseInt(selectedEl.value) + changeAmount
            );
          } else {
            selectedEl.value = Math.max(
              parseInt(selectedEl.min),
              parseInt(selectedEl.value) - changeAmount
            );
          }
          selectedEl.dispatchEvent(new Event("input", { bubbles: true }));
          menuDebounce = now + 100;
        } else {
          let change = 0;
          if (GameContext.gpState.lastPadAxes?.y < -0.5 || GameContext.gpState.lastPadButtons?.up)
            change = -1;
          if (GameContext.gpState.lastPadAxes?.y > 0.5 || GameContext.gpState.lastPadButtons?.down)
            change = 1;

          if (change !== 0) {
            GameContext.menuSelectionIndex += change;
            if (GameContext.menuSelectionIndex < 0)
              GameContext.menuSelectionIndex = activeElements.length - 1;
            if (GameContext.menuSelectionIndex >= activeElements.length)
              GameContext.menuSelectionIndex = 0;
            updateMenuVisuals(activeElements);
            menuDebounce = now;
          }
        }
      } else {
        let vertChange = 0;
        if (GameContext.gpState.lastPadAxes?.y < -0.5 || GameContext.gpState.lastPadButtons?.up)
          vertChange = -1;
        if (GameContext.gpState.lastPadAxes?.y > 0.5 || GameContext.gpState.lastPadButtons?.down)
          vertChange = 1;

        let horizChange = 0;
        if (leftPressed) horizChange = -1;
        if (rightPressed) horizChange = 1;

        if (vertChange !== 0) {
          GameContext.menuSelectionIndex += vertChange;
          if (GameContext.menuSelectionIndex < 0)
            GameContext.menuSelectionIndex = activeElements.length - 1;
          if (GameContext.menuSelectionIndex >= activeElements.length)
            GameContext.menuSelectionIndex = 0;
          updateMenuVisuals(activeElements);
          menuDebounce = now;
        } else if (horizChange !== 0 && isSelect) {
          const options = selectedEl.options;
          const currentIndex = selectedEl.selectedIndex;
          const nextIndex = (currentIndex + horizChange + options.length) % options.length;
          selectedEl.selectedIndex = nextIndex;
          selectedEl.dispatchEvent(new Event("change", { bubbles: true }));
          menuDebounce = now;
        } else if (horizChange !== 0) {
          GameContext.menuSelectionIndex += horizChange;
          if (GameContext.menuSelectionIndex < 0)
            GameContext.menuSelectionIndex = activeElements.length - 1;
          if (GameContext.menuSelectionIndex >= activeElements.length)
            GameContext.menuSelectionIndex = 0;
          updateMenuVisuals(activeElements);
          menuDebounce = now;
        }

        if (GameContext.gpState.lastPadButtons?.confirm) {
          if (isCheckbox) {
            selectedEl.checked = !selectedEl.checked;
            selectedEl.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            selectedEl.click();
            GameContext.gpState.lastMenuElements = null;
          }
          menuDebounce = now + 200;
        }

        if (GameContext.gpState.lastPadButtons?.back) {
          let handled = false;

          const modal = document.getElementById("meta-shop-modal");
          if (modal && modal.style.display === "block") {
            const backBtn = document.getElementById("meta-modal-back");
            if (backBtn) backBtn.click();
            GameContext.gpState.lastMenuElements = null;
            handled = true;
          }

          if (!handled) {
            const settingsMenu = document.getElementById("settings-menu");
            if (settingsMenu && settingsMenu.style.display === "block") {
              const settingsCloseBtn = document.getElementById("settings-close-btn");
              if (settingsCloseBtn) {
                settingsCloseBtn.click();
                handled = true;
              }
            }
          }

          if (!handled) {
            const upgradesMenu = document.getElementById("upgrades-menu");
            if (upgradesMenu && upgradesMenu.style.display !== "none") {
              const upgradesBackBtn = document.getElementById("upgrades-back-btn");
              if (upgradesBackBtn) {
                upgradesBackBtn.click();
                handled = true;
              }
            }
          }

          if (!handled) {
            const profileSelect = document.getElementById("profile-select");
            if (profileSelect && profileSelect.style.display === "block") {
              const profileBackBtn = document.getElementById("profile-back-btn");
              if (profileBackBtn) {
                profileBackBtn.click();
                handled = true;
              }
            }
          }

          if (!handled) {
            const runUpgradesScreen = document.getElementById("run-upgrades-screen");
            if (runUpgradesScreen && runUpgradesScreen.style.display === "block") {
              const runUpgradesBackBtn = document.getElementById("run-upgrades-back-btn");
              if (runUpgradesBackBtn) {
                runUpgradesBackBtn.click();
                handled = true;
              }
            }
          }

          if (!handled) {
            const debugMenu = document.getElementById("debug-menu");
            if (debugMenu && debugMenu.style.display === "block") {
              const debugBackBtn = document.getElementById("debug-back-btn");
              if (debugBackBtn) {
                debugBackBtn.click();
                handled = true;
              }
            }
          }

          if (!handled) {
            const pauseMenu = document.getElementById("pause-menu");
            if (pauseMenu && pauseMenu.style.display === "block") {
              if (_togglePause) _togglePause();
              handled = true;
            }
          }

          if (handled) {
            menuDebounce = now + 200;
          }
        }
      }
    } else {
      GameContext.gpState.lastMenuElements = null;
    }
  }
  return false;
}

/**
 * @returns {void}
 */
export function updateGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads[GameContext.gamepadIndex];
  if (!gp) {
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) {
        GameContext.gamepadIndex = i;
        break;
      }
    }
    if (!pads.some(p => p)) {
      GameContext.gamepadIndex = null;
      GameContext.lastGamepadInputAt = 0;
      updateInputMode(Date.now());
    }
    return;
  }

  const deadzone = 0.12;
  const applyDeadzone = v => {
    const a = Math.abs(v);
    if (a <= deadzone) return 0;
    const scaled = (a - deadzone) / (1 - deadzone);
    return Math.sign(v) * scaled;
  };

  let gamepadInput = false;
  if (
    gp.axes.some(axis => Math.abs(axis) > deadzone) ||
    gp.buttons.some(button => button.pressed)
  ) {
    gamepadInput = true;
  }

  if (gamepadInput) {
    GameContext.lastGamepadInputAt = Date.now();
  }

  GameContext.gpState.move.x = applyDeadzone(gp.axes[0]);
  GameContext.gpState.move.y = applyDeadzone(gp.axes[1]);
  GameContext.gpState.aim.x = applyDeadzone(gp.axes[2]);
  GameContext.gpState.aim.y = applyDeadzone(gp.axes[3]);

  GameContext.gpState.lastPadAxes = {
    x: gp.axes[0],
    y: gp.axes[1]
  };
  GameContext.gpState.lastPadButtons = {
    up: gp.buttons[12] && gp.buttons[12].pressed,
    down: gp.buttons[13] && gp.buttons[13].pressed,
    left: gp.buttons[14] && gp.buttons[14].pressed,
    right: gp.buttons[15] && gp.buttons[15].pressed,
    confirm: gp.buttons[0].pressed,
    back: gp.buttons[1].pressed
  };

  const now = Date.now();
  updateInputMode(now);
  if (gp.buttons[9].pressed && !GameContext.gpState.pausePressed) {
    if (_togglePause) _togglePause();
    GameContext.gpState.pausePressed = true;
  } else if (!gp.buttons[9].pressed) {
    GameContext.gpState.pausePressed = false;
  }

  GameContext.gpState.warp = gp.buttons[0].pressed;
  GameContext.gpState.turbo = gp.buttons[2].pressed || gp.buttons[6].pressed;
  GameContext.gpState.battery = gp.buttons[3].pressed || gp.buttons[7].pressed;

  handleMenuNavigation(now);
}

/**
 * @returns {void}
 */
export function initInputListeners() {
  const keys = GameContext.keys;
  const mouseState = GameContext.mouseState;
  const mouseScreen = GameContext.mouseScreen;
  const mouseWorld = GameContext.mouseWorld;

  window.addEventListener("keydown", e => {
    if (e.key === "w" || e.key === "W") keys.w = true;
    if (e.key === "a" || e.key === "A") keys.a = true;
    if (e.key === "s" || e.key === "S") keys.s = true;
    if (e.key === "d" || e.key === "D") keys.d = true;
    if (e.key === " ") keys.space = true;
    if (e.key === "e" || e.key === "E") keys.e = true;
    if (e.key === "f" || e.key === "F") keys.f = true;
    if (e.key === "Shift") keys.shift = true;
    if (e.key === "Escape" && _togglePause) {
      // Handle pointer lock state before toggling pause
      const canvas = document.getElementById('gameCanvas');
      if (canvas && document.pointerLockElement === canvas) {
        // First ESC press releases pointer lock, don't toggle pause yet
        try { document.exitPointerLock(); } catch (e) { }
        // Let the browser consume this event for pointer lock release
        e.preventDefault();
        return;
      }
      // Pointer is not locked, proceed with normal pause toggle
      if (!GameContext.gamePaused) {
        e.preventDefault();
      }
      _togglePause();
    }
    if (e.key === "F1") {
      e.preventDefault();
      if (_toggleDebugButton) _toggleDebugButton();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "k" || e.key === "K")) {
      if (_handleSpaceStationDestroyed) _handleSpaceStationDestroyed();
    }
    if (e.ctrlKey && e.shiftKey && (e.code === "Digit2" || e.code === "Numpad2")) {
      e.preventDefault();
      const doJump = () => {
        if (!GameContext.gameActive || !GameContext.player || GameContext.player.dead) return;
        GameContext.sectorTransitionActive = false;
        GameContext.warpCountdownAt = null;
        GameContext.sectorIndex = 1;
        if (_showOverlayMessage)
          _showOverlayMessage("DEBUG: ENTERING SECTOR 2 CAVE", "#0ff", 1200, 5);
        if (_completeSectorWarp) _completeSectorWarp();
      };
      if (!GameContext.gameActive) {
        if (_startGame) _startGame();
        setTimeout(doJump, 60);
      } else {
        if (GameContext.gamePaused && _togglePause) _togglePause();
        doJump();
      }
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "w" || e.key === "W")) {
      e.preventDefault();
      if (
        !GameContext.gameActive ||
        GameContext.gamePaused ||
        !GameContext.player ||
        GameContext.player.dead
      )
        return;
      if (GameContext.warpZone && GameContext.warpZone.active) {
        if (_showOverlayMessage) _showOverlayMessage("ALREADY IN WARP", "#ff0", 900);
      } else if (_enterWarpMaze) {
        _enterWarpMaze();
      }
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      if (!GameContext.gameActive || !GameContext.player) return;
      GameContext.verticalScrollingWarpGateEnabled = !GameContext.verticalScrollingWarpGateEnabled;
      if (_showOverlayMessage)
        _showOverlayMessage(
          GameContext.verticalScrollingWarpGateEnabled
            ? "VERTICAL WARP: ENABLED"
            : "VERTICAL WARP: DISABLED",
          "#0ff",
          1000
        );
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "q" || e.key === "Q")) {
      e.preventDefault();
      if (!GameContext.gameActive || !GameContext.player) return;
    }
  });

  window.addEventListener("keyup", e => {
    if (e.key === "w" || e.key === "W") keys.w = false;
    if (e.key === "a" || e.key === "A") keys.a = false;
    if (e.key === "s" || e.key === "S") keys.s = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.key === " ") keys.space = false;
    if (e.key === "e" || e.key === "E") keys.e = false;
    if (e.key === "f" || e.key === "F") keys.f = false;
    if (e.key === "Shift") keys.shift = false;
  });

  window.addEventListener("mousemove", e => {
    const now = Date.now();
    if (!_canvas || !_getInternalSize || !_getViewportSize) return;

    const rect = _canvas.getBoundingClientRect();
    const internal = _getInternalSize();
    const viewport = _getViewportSize();
    const scaleX = internal.width / rect.width;
    const scaleY = internal.height / rect.height;

    let scaledX;
    let scaledY;

    if (document.pointerLockElement === _canvas) {
      mouseScreen.x += e.movementX * scaleX;
      mouseScreen.y += e.movementY * scaleY;

      mouseScreen.x = Math.max(0, Math.min(internal.width, mouseScreen.x));
      mouseScreen.y = Math.max(0, Math.min(internal.height, mouseScreen.y));

      scaledX = mouseScreen.x;
      scaledY = mouseScreen.y;
    } else {
      scaledX = (e.clientX - rect.left) * scaleX;
      scaledY = (e.clientY - rect.top) * scaleY;
    }

    const dx = Math.abs(scaledX - (mouseScreen.x || 0));
    const dy = Math.abs(scaledY - (mouseScreen.y || 0));

    if (dx + dy >= 10 || document.pointerLockElement === _canvas)
      GameContext.lastMouseInputAt = now;

    updateInputMode(now);

    mouseScreen.x = scaledX;
    mouseScreen.y = scaledY;

    if (GameContext.player) {
      const z = GameContext.currentZoom || ZOOM_LEVEL;

      // Use correct camera calculation for vertical scrolling mode (static camera) vs normal mode (follows player)
      let camX, camY;
      if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
        // Static camera in vertical scrolling mode
        camX = GameContext.verticalScrollingZone.levelCenterX - viewport.width / (2 * z);
        camY = GameContext.scrollProgress - viewport.height / (2 * z);
      } else {
        // Normal mode: camera follows player
        camX = GameContext.player.pos.x - viewport.width / (2 * z);
        camY = GameContext.player.pos.y - viewport.height / (2 * z);
      }

      // Convert canvas internal resolution coordinates to viewport coordinates (1920x1080)
      // This is the inverse of the scale used in drawSlackerMouseLine
      // Line code: screenShipX = viewportShipX * (internal.width / viewport.width)
      // So: viewportX = canvasX * (viewport.width / internal.width)
      const renderScaleX = viewport.width / internal.width;
      const renderScaleY = viewport.height / internal.height;
      const viewportX = scaledX * renderScaleX;
      const viewportY = scaledY * renderScaleY;

      // Convert viewport coordinates to world coordinates
      // Viewport center (viewport.width/2, viewport.height/2) maps to camera center
      // Formula: worldX = (viewportX / z) + camX
      mouseWorld.x = viewportX / z + camX;
      mouseWorld.y = viewportY / z + camY;

      const deltaX = scaledX - mouseLastPos.x;
      const deltaY = scaledY - mouseLastPos.y;
      const moveDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (moveDist > 2) {
        mouseMovementDir.x = deltaX / moveDist;
        mouseMovementDir.y = deltaY / moveDist;
      }
      mouseLastPos.x = scaledX;
      mouseLastPos.y = scaledY;

      const lerpFactor = 0.15;
      smoothedDir.x = smoothedDir.x + (mouseMovementDir.x - smoothedDir.x) * lerpFactor;
      smoothedDir.y = smoothedDir.y + (mouseMovementDir.y - smoothedDir.y) * lerpFactor;
    }
  });

  if (_canvas) {
    const canvas = _canvas;

    const isCanvasFullscreen = () => {
      // Browser Fullscreen API
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
        return true;

      // Electron fullscreen is reflected by canvas being positioned `fixed`
      // (see `canvas-setup.js` + `index.html` fullscreen CSS).
      try {
        return window.getComputedStyle(canvas).position === "fixed";
      } catch (e) {
        return canvas.style.position === "fixed";
      }
    };

    const shouldLockPointer = () => {
      // Only lock in WINDOWED mode; fullscreen already confines mouse.
      if (isCanvasFullscreen()) return false;
      if (!GameContext.gameActive) return false;
      if (GameContext.gamePaused) return false;
      return true;
    };

    const requestPointerLockForGameplay = () => {
      if (!shouldLockPointer()) return;
      if (document.pointerLockElement) return;
      if (!document.body.contains(canvas)) return;

      canvas.focus();
      try {
        const request = canvas.requestPointerLock();
        if (request && typeof request.catch === "function") {
          request.catch(e => console.warn("Pointer lock failed:", e));
        }
      } catch (e) {
        console.warn("Pointer lock failed:", e);
      }
    };

    // Acquire pointer lock from actual player gestures on the playfield.
    canvas.addEventListener("mousedown", () => requestPointerLockForGameplay());
    canvas.addEventListener("click", () => requestPointerLockForGameplay());
  }

  // Center mouse when pointer lock is activated (for joystick-style control)
  document.addEventListener("pointerlockchange", () => {
    const canvas = document.getElementById("gameCanvas");

    if (document.pointerLockElement === canvas && _getInternalSize) {
      const internal = _getInternalSize();
      mouseScreen.x = internal.width / 2;
      mouseScreen.y = internal.height / 2;
    }
  });

  const checkPointerLockState = () => {
    if (
      (!GameContext.gameActive || GameContext.gamePaused) &&
      document.pointerLockElement === _canvas
    ) {
      document.exitPointerLock();
    }
  };
  setInterval(checkPointerLockState, 1000);

  window.addEventListener("mousedown", e => {
    mouseState.down = true;
    if (e.button === 0) mouseState.leftDown = true;
    if (e.button === 1) mouseState.middleDown = true;
    if (e.button === 2) mouseState.rightDown = true;
  });

  window.addEventListener("mouseup", e => {
    mouseState.down = false;
    if (e.button === 0) mouseState.leftDown = false;
    if (e.button === 1) mouseState.middleDown = false;
    if (e.button === 2) mouseState.rightDown = false;
  });

  window.addEventListener("gamepadconnected", e => {
    GameContext.gamepadIndex = e.gamepad.index;
    initAudio();
  });

  window.addEventListener("gamepaddisconnected", e => {
    if (GameContext.gamepadIndex === e.gamepad.index) GameContext.gamepadIndex = null;
    GameContext.lastGamepadInputAt = 0;
    updateInputMode(Date.now());
  });
}
