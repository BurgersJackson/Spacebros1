/**
 * Global Game State Manager
 * Centralized state for all game entities and systems.
 */

import { SpatialHash } from './math.js';
import { ASTEROID_GRID_CELL_SIZE, ZOOM_LEVEL } from './constants.js';

// --- Entity Collections ---
export let player = null;
export let enemies = [];
export let bullets = [];
export let particles = [];
export let explosions = [];
export let pickups = [];
export let floatingTexts = [];
export let pinwheels = [];
export let warpGates = [];
export let cruisers = [];
export let stations = [];
export let drones = [];
export let environmentAsteroids = [];

// --- Respawn Timers ---
export let asteroidRespawnTimers = [];
export let baseRespawnTimers = [];

// --- Background Effects ---
export let starfield = [];
export let nebulas = [];
export let warpParticles = [];
export let shockwaves = [];

// --- Spatial Hashing ---
export const asteroidGrid = new SpatialHash(ASTEROID_GRID_CELL_SIZE);

// --- Game State ---
export let gameActive = false;
export let gamePaused = false;
export let sectorIndex = 1;
export let menuSelectionIndex = 0;

// --- Camera ---
export let currentZoom = ZOOM_LEVEL;
export let shakeTimer = 0;
export let shakeMagnitude = 0;
export let shakeOffsetX = 0;
export let shakeOffsetY = 0;

// --- Dimensions ---
export let width = typeof window !== 'undefined' ? window.innerWidth : 1920;
export let height = typeof window !== 'undefined' ? window.innerHeight : 1080;

// --- Input State ---
export const keys = {
    w: false, a: false, s: false, d: false,
    space: false, shift: false, e: false
};
export const mouseScreen = { x: 0, y: 0 };
export const mouseWorld = { x: 0, y: 0 };
export const mouseState = { down: false };
export let lastMouseInputAt = 0;
export let lastGamepadInputAt = 0;

// --- Gamepad State ---
export let gamepadIndex = null;
export const gpState = {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    fire: false,
    warp: false,
    turbo: false,
    pausePressed: false
};
export let usingGamepad = false;
export let menuDebounce = 0;

// --- Timing ---
export let overlayTimeout = null;

// --- Simulation ---
export let simAccMs = 0;
export let simNowMs = 0;
export let simLastPerfAt = 0;

// --- FPS Counter ---
export let fpsLastFrameAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
export let fpsSmoothMs = 16.7;
export let fpsNextUiAt = 0;
export let fpsUiVisible = null;

// --- State Setters ---
export function setPlayer(p) { player = p; }
export function setGameActive(active) { gameActive = active; }
export function setGamePaused(paused) { gamePaused = paused; }
export function setSectorIndex(idx) { sectorIndex = idx; }
export function setMenuSelectionIndex(idx) { menuSelectionIndex = idx; }
export function setCurrentZoom(zoom) { currentZoom = zoom; }
export function setDimensions(w, h) { width = w; height = h; }
export function setUsingGamepad(val) { usingGamepad = val; }
export function setGamepadIndex(idx) { gamepadIndex = idx; }
export function setOverlayTimeout(t) { overlayTimeout = t; }
export function setLastMouseInputAt(t) { lastMouseInputAt = t; }
export function setLastGamepadInputAt(t) { lastGamepadInputAt = t; }
export function setMenuDebounce(t) { menuDebounce = t; }

// --- Camera Shake ---
export function setShake(timer, magnitude) {
    shakeTimer = timer;
    shakeMagnitude = magnitude;
}
export function setShakeOffset(x, y) {
    shakeOffsetX = x;
    shakeOffsetY = y;
}

// --- FPS State ---
export function setFpsLastFrameAt(t) { fpsLastFrameAt = t; }
export function setFpsSmoothMs(ms) { fpsSmoothMs = ms; }
export function setFpsNextUiAt(t) { fpsNextUiAt = t; }
export function setFpsUiVisible(v) { fpsUiVisible = v; }

// --- Simulation State ---
export function setSimAccMs(ms) { simAccMs = ms; }
export function setSimNowMs(ms) { simNowMs = ms; }
export function setSimLastPerfAt(t) { simLastPerfAt = t; }

/**
 * Clear all entity arrays for game reset.
 */
export function clearAllEntities() {
    enemies.length = 0;
    bullets.length = 0;
    particles.length = 0;
    explosions.length = 0;
    pickups.length = 0;
    floatingTexts.length = 0;
    pinwheels.length = 0;
    warpGates.length = 0;
    cruisers.length = 0;
    stations.length = 0;
    drones.length = 0;
    environmentAsteroids.length = 0;
    asteroidRespawnTimers.length = 0;
    baseRespawnTimers.length = 0;
    warpParticles.length = 0;
    shockwaves.length = 0;
    asteroidGrid.clear();
}

/**
 * Clear an array and call cleanup on each entity if available.
 */
export function clearArrayWithCleanup(arr, cleanupFn = null) {
    if (cleanupFn) {
        for (let i = 0; i < arr.length; i++) {
            cleanupFn(arr[i]);
        }
    }
    arr.length = 0;
}
