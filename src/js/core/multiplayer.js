/**
 * Multiplayer Core System
 * Handles multi-player state, input management, and coordination for split-screen.
 */

/**
 * Multiplayer game mode
 * 'single' = 1 player
 * 'split' = 2 players split-screen
 */
export let multiplayerMode = 'single';

/**
 * Array of all active players
 * players[0] = Player 1 (left screen, WASD/Arrows)
 * players[1] = Player 2 (right screen, IJKL/Gamepad 1)
 */
export let players = [];

/**
 * Current number of active players
 */
export let activePlayerCount = 1;

/**
 * Deadzone helper function for gamepad input
 * @param {number} v - Axis value
 * @param {number} deadzone - Deadzone threshold (default: 0.12)
 * @returns {number} Deadzone-processed value
 */
export function applyDeadzone(v, deadzone = 0.12) {
    const a = Math.abs(v);
    if (a <= deadzone) return 0;
    // Rescale so values just outside of deadzone don't feel sluggish.
    const scaled = (a - deadzone) / (1 - deadzone);
    return Math.sign(v) * scaled;
}

/**
 * Set multiplayer mode
 * @param {string} mode - 'single' or 'split'
 */
export function setMultiplayerMode(mode) {
    multiplayerMode = mode;
    activePlayerCount = (mode === 'split') ? 2 : 1;
}

/**
 * Per-player input state
 */
export class PlayerInput {
    constructor(playerIndex) {
        this.playerIndex = playerIndex;

        // Keyboard state
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            turbo: false,
            special: false,
            fire: false,
            pause: false
        };

        // Gamepad state
        this.gamepadIndex = playerIndex;
        this.gamepadConnected = false;
        this.gamepadState = {
            move: { x: 0, y: 0 },
            aim: { x: 0, y: 0 },
            fire: false,
            turbo: false,
            special: false,
            pause: false
        };

        // Mouse position (for aiming)
        this.mouseScreen = { x: 0, y: 0 };
        this.mouseWorld = { x: 0, y: 0 };
        this.lastMouseInputAt = 0;

        // Last gamepad input time
        this.lastGamepadInputAt = 0;

        // Input mode flag
        this.usingGamepad = false;
    }

    /**
     * Update input state from keyboard
     * @param {boolean} keyState - True if key is down, false if up
     * @param {string} key - Key identifier
     */
    updateKeyboard(keyState, key) {
        switch (this.playerIndex) {
            case 0:
                this._updatePlayer1Keyboard(keyState, key);
                break;
            case 1:
                this._updatePlayer2Keyboard(keyState, key);
                break;
        }
    }

    _updatePlayer1Keyboard(keyState, key) {
        const k = this.keys;
        switch (key) {
            case 'KeyW': case 'ArrowUp': k.up = keyState; break;
            case 'KeyS': case 'ArrowDown': k.down = keyState; break;
            case 'KeyA': case 'ArrowLeft': k.left = keyState; break;
            case 'KeyD': case 'ArrowRight': k.right = keyState; break;
            case 'KeyE': case 'ShiftRight': k.turbo = keyState; break;
            case 'KeyQ': case 'ControlRight': k.special = keyState; break;
            case 'Space': k.fire = keyState; break;
            case 'Escape': k.pause = keyState; break;
        }
    }

    _updatePlayer2Keyboard(keyState, key) {
        const k = this.keys;
        switch (key) {
            case 'KeyI': k.up = keyState; break;
            case 'KeyK': k.down = keyState; break;
            case 'KeyJ': k.left = keyState; break;
            case 'KeyL': k.right = keyState; break;
            case 'KeyO': k.turbo = keyState; break;
            case 'KeyU': k.special = keyState; break;
            case 'KeyP': k.fire = keyState; break;
        }
    }

    /**
     * Update gamepad state
     * @param {Gamepad} gamepad - Browser Gamepad API object
     */
    updateGamepad(gamepad) {
        if (!gamepad) {
            this.gamepadConnected = false;
            return;
        }

        this.gamepadConnected = true;
        const gp = this.gamepadState;

        const deadzone = 0.2;

        gp.move.x = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
        gp.move.y = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;

        if (gamepad.axes.length >= 4) {
            gp.aim.x = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
            gp.aim.y = Math.abs(gamepad.axes[3]) > deadzone ? gamepad.axes[3] : 0;
        }

        const buttons = gamepad.buttons;
        gp.fire = buttons[0] && buttons[0].pressed;
        gp.turbo = buttons[2] && buttons[2].pressed;
        gp.special = buttons[3] && buttons[3].pressed;
        gp.pause = buttons[9] && buttons[9].pressed;

        this.lastGamepadInputAt = Date.now();
    }

    /**
     * Update mouse position for aiming
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     */
    updateMouse(x, y) {
        this.mouseScreen.x = x;
        this.mouseScreen.y = y;
        this.lastMouseInputAt = Date.now();
    }

    /**
     * Determine if using gamepad or mouse/keyboard
     * @returns {boolean} True if gamepad should be used
     */
    updateInputMode() {
        const now = Date.now();
        const preferGamepadMs = 1200;
        const mouseGraceMs = 220;

        const strictGamepad = (now - this.lastGamepadInputAt) < 100;

        if (strictGamepad) {
            this.usingGamepad = true;
        } else {
            const gamepadRecent = (now - this.lastGamepadInputAt) < preferGamepadMs;
            const mouseRecent = (now - this.lastMouseInputAt) < mouseGraceMs;
            this.usingGamepad = gamepadRecent && !mouseRecent;
        }

        return this.usingGamepad;
    }
}

/**
 * Input state for all players
 */
export const playerInputs = [];

/**
 * Initialize input system for multiplayer
 */
export function initMultiplayerInput() {
    playerInputs.length = 0;
    for (let i = 0; i < activePlayerCount; i++) {
        playerInputs.push(new PlayerInput(i));
    }
}

/**
 * Get input state for specific player
 * @param {number} playerIndex - Player index
 * @returns {PlayerInput} Input state object
 */
export function getPlayerInput(playerIndex) {
    return playerInputs[playerIndex] || null;
}

/**
 * Split-screen viewport configuration
 */
export const splitScreenViewports = {
    left: { x: 0, y: 0, width: 0, height: 0 },
    right: { x: 0, y: 0, width: 0, height: 0 }
};

/**
 * View bounds for frustum culling (per viewport)
 */
export const viewBoundsP1 = { left: 0, right: 0, top: 0, bottom: 0 };
export const viewBoundsP2 = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * Camera positions for each player
 */
export const cameras = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 }
};

/**
 * Initialize split-screen viewports
 * @param {number} screenWidth - Total screen width
 * @param {number} screenHeight - Total screen height
 */
export function initSplitScreenViewports(screenWidth, screenHeight) {
    const halfWidth = screenWidth / 2;

    // Left viewport (Player 1)
    splitScreenViewports.left = {
        x: 0,
        y: 0,
        width: halfWidth,
        height: screenHeight
    };

    // Right viewport (Player 2)
    splitScreenViewports.right = {
        x: halfWidth,
        y: 0,
        width: halfWidth,
        height: screenHeight
    };
}

/**
 * Update camera positions based on player positions
 * @param {Array} players - Array of player entities
 * @param {number} screenWidth - Total screen width
 * @param {number} screenHeight - Total screen height
 * @param {number} zoom - Camera zoom level
 */
export function updateMultiplayerCameras(players, screenWidth, screenHeight, zoom) {
    // In split-screen mode, each viewport is half the screen width
    // So we center player within their half of the screen
    const viewportWidth = (multiplayerMode === 'split') ? screenWidth / 2 : screenWidth;
    const halfViewW = viewportWidth / 2;
    const halfViewH = screenHeight / 2;

    // Player 1 camera (left viewport)
    if (players[0]) {
        const p1 = players[0];
        const p1Pos = p1.getRenderPos ? p1.getRenderPos(1.0) : { x: p1.pos.x, y: p1.pos.y };
        cameras.p1.x = p1Pos.x - halfViewW / zoom;
        cameras.p1.y = p1Pos.y - halfViewH / zoom;
    }

    // Player 2 camera (right viewport)
    if (multiplayerMode === 'split' && players[1]) {
        const p2 = players[1];
        const p2Pos = p2.getRenderPos ? p2.getRenderPos(1.0) : { x: p2.pos.x, y: p2.pos.y };
        cameras.p2.x = p2Pos.x - halfViewW / zoom;
        cameras.p2.y = p2Pos.y - halfViewH / zoom;
    }
}

/**
 * Check if position is in either player's view
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {boolean} True if in any viewport
 */
export function isInAnyView(x, y) {
    return (
        (x > viewBoundsP1.left && x < viewBoundsP1.right && y > viewBoundsP1.top && y < viewBoundsP1.bottom) ||
        (x > viewBoundsP2.left && x < viewBoundsP2.right && y > viewBoundsP2.top && y < viewBoundsP2.bottom)
    );
}
