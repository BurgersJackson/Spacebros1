import { GameContext } from "../core/game-context.js";

let joystickBase = null;
let joystickStick = null;
let joystickCenter = { x: 0, y: 0 };
let joystickActive = false;
let joystickTouchId = null;

const JOYSTICK_RADIUS = 50; // Max distance stick can move from center
const DEADZONE = 0.15; // Deadzone for joystick input

/**
 * Initialize touch controls
 */
export function initTouchControls() {
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    return false;
  }

  const touchControls = document.getElementById("touch-controls");
  if (!touchControls) return false;

  // Show touch controls
  touchControls.classList.add("visible");

  // Get joystick elements
  joystickBase = document.getElementById("joystick-base");
  joystickStick = document.getElementById("joystick-stick");

  // Set up joystick touch handlers
  const joystickArea = document.getElementById("touch-joystick");
  if (joystickArea) {
    joystickArea.addEventListener("touchstart", handleJoystickStart, { passive: false });
    joystickArea.addEventListener("touchmove", handleJoystickMove, { passive: false });
    joystickArea.addEventListener("touchend", handleJoystickEnd, { passive: false });
    joystickArea.addEventListener("touchcancel", handleJoystickEnd, { passive: false });
  }

  // Set up button touch handlers
  setupButton("touch-fire", "fire");
  setupButton("touch-turbo", "turbo");
  setupButton("touch-battery", "battery");
  setupButton("touch-warp", "warp");

  // Calculate joystick center on init and resize
  updateJoystickCenter();
  window.addEventListener("resize", updateJoystickCenter);

  GameContext.touchState.active = true;
  return true;
}

/**
 * Update joystick center position (called on resize)
 */
function updateJoystickCenter() {
  if (joystickBase) {
    const rect = joystickBase.getBoundingClientRect();
    joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
}

/**
 * Handle joystick touch start
 */
function handleJoystickStart(e) {
  e.preventDefault();

  if (joystickActive) return;

  const touch = e.changedTouches[0];
  joystickActive = true;
  joystickTouchId = touch.identifier;

  updateJoystickCenter();
  updateJoystickPosition(touch);
}

/**
 * Handle joystick touch move
 */
function handleJoystickMove(e) {
  e.preventDefault();

  if (!joystickActive) return;

  // Find the touch that started the joystick
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      updateJoystickPosition(touch);
      break;
    }
  }
}

/**
 * Handle joystick touch end
 */
function handleJoystickEnd(e) {
  e.preventDefault();

  // Check if the joystick touch ended
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      resetJoystick();
      break;
    }
  }
}

/**
 * Update joystick position based on touch
 */
function updateJoystickPosition(touch) {
  const dx = touch.clientX - joystickCenter.x;
  const dy = touch.clientY - joystickCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  let stickX = dx;
  let stickY = dy;

  // Clamp to joystick radius
  if (distance > JOYSTICK_RADIUS) {
    const ratio = JOYSTICK_RADIUS / distance;
    stickX = dx * ratio;
    stickY = dy * ratio;
  }

  // Update visual position
  if (joystickStick) {
    joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;
  }

  // Calculate normalized input (-1 to 1)
  const normalizedX = stickX / JOYSTICK_RADIUS;
  const normalizedY = stickY / JOYSTICK_RADIUS;

  // Apply deadzone
  const magnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
  if (magnitude < DEADZONE) {
    GameContext.touchState.move.x = 0;
    GameContext.touchState.move.y = 0;
  } else {
    // Rescale to account for deadzone
    const rescaledMag = (magnitude - DEADZONE) / (1 - DEADZONE);
    const scale = rescaledMag / magnitude;
    GameContext.touchState.move.x = normalizedX * scale;
    GameContext.touchState.move.y = normalizedY * scale;
  }

  // Update last input time for input mode switching
  GameContext.lastMouseInputAt = Date.now();
}

/**
 * Reset joystick to center
 */
function resetJoystick() {
  joystickActive = false;
  joystickTouchId = null;

  if (joystickStick) {
    joystickStick.style.transform = "translate(0px, 0px)";
  }

  GameContext.touchState.move.x = 0;
  GameContext.touchState.move.y = 0;
}

/**
 * Set up a touch button
 */
function setupButton(elementId, stateKey) {
  const button = document.getElementById(elementId);
  if (!button) return;

  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    GameContext.touchState[stateKey] = true;
    button.classList.add("pressed");
    GameContext.lastMouseInputAt = Date.now();
  }, { passive: false });

  button.addEventListener("touchend", (e) => {
    e.preventDefault();
    GameContext.touchState[stateKey] = false;
    button.classList.remove("pressed");
  }, { passive: false });

  button.addEventListener("touchcancel", (e) => {
    GameContext.touchState[stateKey] = false;
    button.classList.remove("pressed");
  }, { passive: false });
}

/**
 * Check if touch controls are active
 */
export function isTouchControlsActive() {
  return GameContext.touchState.active;
}

/**
 * Get touch movement input (normalized -1 to 1)
 */
export function getTouchMovement() {
  if (!GameContext.touchState.active) {
    return { x: 0, y: 0 };
  }
  return {
    x: GameContext.touchState.move.x,
    y: GameContext.touchState.move.y
  };
}

/**
 * Check if touch fire button is pressed
 */
export function isTouchFiring() {
  return GameContext.touchState.active && GameContext.touchState.fire;
}

/**
 * Check if touch turbo button is pressed
 */
export function isTouchTurbo() {
  return GameContext.touchState.active && GameContext.touchState.turbo;
}

/**
 * Check if touch battery button is pressed
 */
export function isTouchBattery() {
  return GameContext.touchState.active && GameContext.touchState.battery;
}

/**
 * Check if touch warp button is pressed
 */
export function isTouchWarp() {
  return GameContext.touchState.active && GameContext.touchState.warp;
}

/**
 * Hide touch controls (for menus, etc.)
 */
export function hideTouchControls() {
  const touchControls = document.getElementById("touch-controls");
  if (touchControls) {
    touchControls.style.display = "none";
  }
}

/**
 * Show touch controls
 */
export function showTouchControls() {
  const touchControls = document.getElementById("touch-controls");
  if (touchControls) {
    touchControls.style.display = "";
  }
}
