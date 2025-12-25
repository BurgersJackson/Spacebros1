/**
 * Audio Manager
 * Handles background music and sound effects.
 */

import { BACKGROUND_MUSIC_URL, ENABLE_PROJECTILE_IMPACT_SOUNDS } from '../core/constants.js';

// --- Audio Context ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// --- Music State ---
export let musicEnabled = true;
let musicNodes = [];
let musicMode = 'normal';
let backgroundMusicAudio = null;

// --- Sound Context ---
let inProjectileImpactSoundContext = false;

// --- MP3 SFX Pools ---
const mp3SfxPools = Object.create(null);

/**
 * Initialize Web Audio API context.
 */
export function initAudio() {
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {
        console.error("Audio init failed", e);
    }
}

/**
 * Stop legacy music oscillator nodes.
 */
function stopLegacyMusicNodes() {
    musicNodes.forEach(n => {
        try { n.stop(); } catch (e) { }
        try { n.disconnect(); } catch (e) { }
    });
    musicNodes = [];
}

/**
 * Set music mode and adjust volume.
 * @param {string} mode - 'normal' or 'cruiser'
 */
export function setMusicMode(mode = null) {
    if (mode) musicMode = mode;
    if (!musicMode) musicMode = 'normal';
    if (!musicEnabled) return;

    if (musicNodes.length > 0) stopLegacyMusicNodes();

    if (!backgroundMusicAudio) {
        backgroundMusicAudio = new Audio(BACKGROUND_MUSIC_URL);
        backgroundMusicAudio.loop = true;
        backgroundMusicAudio.preload = 'auto';
    }

    backgroundMusicAudio.volume = (musicMode === 'cruiser') ? 0.22 : 0.25;
    try {
        const p = backgroundMusicAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch (e) { }
}

/**
 * Start background music.
 * @param {string} mode - Music mode
 */
export function startMusic(mode = null) {
    if (mode) musicMode = mode;
    if (!musicMode) musicMode = 'normal';
    if (!musicEnabled) return;
    setMusicMode(musicMode);
}

/**
 * Stop background music.
 */
export function stopMusic() {
    stopLegacyMusicNodes();
    musicMode = musicMode || 'normal';
    if (backgroundMusicAudio) {
        try { backgroundMusicAudio.pause(); } catch (e) { }
        try { backgroundMusicAudio.currentTime = 0; } catch (e) { }
    }
}

/**
 * Toggle music on/off.
 * @param {boolean} gameActive - Current game active state
 * @param {boolean} gamePaused - Current game paused state
 * @returns {boolean} New music enabled state
 */
export function toggleMusic(gameActive, gamePaused) {
    musicEnabled = !musicEnabled;

    if (musicEnabled && gameActive && !gamePaused) {
        initAudio();
        startMusic();
    } else {
        stopMusic();
    }

    return musicEnabled;
}

/**
 * Set projectile impact sound context.
 * @param {boolean} val - Whether in impact context
 */
export function setProjectileImpactSoundContext(val) {
    inProjectileImpactSoundContext = val;
}

/**
 * Play a synthesized sound effect.
 * @param {string} type - Sound type
 * @param {number} volumeMult - Volume multiplier
 */
export function playSound(type, volumeMult = 1) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    if (!ENABLE_PROJECTILE_IMPACT_SOUNDS && inProjectileImpactSoundContext &&
        (type === 'hit' || type === 'shield_hit')) return;
    if (!(volumeMult > 0)) return;

    try {
        const now = audioCtx.currentTime;

        const createOsc = (oscType, freq, dur, vol) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.setValueAtTime(vol * volumeMult, now);
            return { osc, gain };
        };

        switch (type) {
            case 'shoot': {
                const { osc, gain } = createOsc('sawtooth', 880, 0.15, 0.1);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
            case 'coin': {
                const { osc, gain } = createOsc('sine', 1200, 0.1, 0.1);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'hit': {
                const { osc, gain } = createOsc('square', 200, 0.1, 0.15);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'shield_hit': {
                const { osc, gain } = createOsc('triangle', 600, 0.1, 0.15);
                osc.frequency.linearRampToValueAtTime(300, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'explode': {
                const { osc, gain } = createOsc('sawtooth', 100, 0.3, 0.2);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            case 'levelup': {
                const { osc, gain } = createOsc('square', 440, 0.6, 0.2);
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554, now + 0.1);
                osc.frequency.setValueAtTime(659, now + 0.2);
                osc.frequency.setValueAtTime(880, now + 0.3);
                gain.gain.linearRampToValueAtTime(0, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.6);
                break;
            }
            case 'warp': {
                const { osc, gain } = createOsc('sine', 200, 0.3, 0.3);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            case 'powerup': {
                const { osc, gain } = createOsc('sine', 400, 0.3, 0.2);
                osc.frequency.linearRampToValueAtTime(800, now + 0.3);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            case 'shotgun': {
                const { osc, gain } = createOsc('square', 120, 0.1, 0.2);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
        }
    } catch (e) { }
}

/**
 * Play an MP3 sound effect with pooling.
 * @param {string} url - MP3 URL
 * @param {Object} opts - Options (volume, key, rateLimitMs, poolSize)
 */
export function playMp3Sfx(url, opts = {}) {
    const volume = (typeof opts.volume === 'number') ? opts.volume : 1;
    if (!(volume > 0)) return;

    const key = opts.key || url;
    const now = Date.now();
    const entry = mp3SfxPools[key] || (mp3SfxPools[key] = { pool: [], idx: 0, lastAt: 0, url });

    const rateLimitMs = (typeof opts.rateLimitMs === 'number') ? opts.rateLimitMs : 0;
    if (rateLimitMs > 0 && (now - (entry.lastAt || 0)) < rateLimitMs) return;
    entry.lastAt = now;

    if (entry.pool.length === 0) {
        const poolSize = (typeof opts.poolSize === 'number') ? opts.poolSize : 4;
        for (let i = 0; i < Math.max(1, poolSize); i++) {
            const a = new Audio(url);
            a.preload = 'auto';
            a.volume = volume;
            entry.pool.push(a);
        }
    }

    const a = entry.pool[entry.idx % entry.pool.length];
    entry.idx = (entry.idx + 1) % entry.pool.length;
    try {
        a.volume = volume;
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch (e) { }
}

/**
 * Check if audio context is ready.
 */
export function isAudioReady() {
    return audioCtx !== null && audioCtx.state !== 'suspended';
}

/**
 * Get current music enabled state.
 */
export function isMusicEnabled() {
    return musicEnabled;
}
