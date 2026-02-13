/**
 * Audio Manager
 * Handles background music and sound effects.
 */

import {
  BACKGROUND_MUSIC_URL,
  BOSS_MUSIC_URL,
  ENABLE_PROJECTILE_IMPACT_SOUNDS
} from "../core/constants.js";

// --- Audio Context ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// --- Music State ---
export let musicEnabled = true;
let musicNodes = [];
let musicMode = "normal";
let backgroundMusicAudio = null;
export let musicVolume = 0.5; // 0.0 to 1.0
export let sfxVolume = 0.5; // 0.0 to 1.0

// --- Persisted Audio Settings ---
const AUDIO_SETTINGS_KEY = "neon_space_audio_settings_v1";

function clamp01(val) {
  return Math.max(0, Math.min(1, val));
}

function loadAudioSettingsFromStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      if (typeof data.musicEnabled === "boolean") musicEnabled = data.musicEnabled;
      if (typeof data.musicVolume === "number" && isFinite(data.musicVolume))
        musicVolume = clamp01(data.musicVolume);
      if (typeof data.sfxVolume === "number" && isFinite(data.sfxVolume))
        sfxVolume = clamp01(data.sfxVolume);
    }
  } catch (e) {
    // Ignore corrupted/missing settings
  }
}

function saveAudioSettingsToStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        musicEnabled,
        musicVolume,
        sfxVolume
      })
    );
  } catch (e) {
    // Ignore storage failures (quota, denied, etc)
  }
}

// Load saved audio prefs immediately on module import.
loadAudioSettingsFromStorage();

// --- Sound Context ---
let inProjectileImpactSoundContext = false;

// --- Looping SFX ---
const sfxLoops = Object.create(null);

// --- MP3 SFX Pools ---
const mp3SfxPools = Object.create(null);

/**
 * Initialize Web Audio API context.
 */
export function initAudio() {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    console.error("Audio init failed", e);
  }
}

/**
 * Stop legacy music oscillator nodes.
 */
function stopLegacyMusicNodes() {
  musicNodes.forEach(n => {
    try {
      n.stop();
    } catch (e) {}
    try {
      n.disconnect();
    } catch (e) {}
  });
  musicNodes = [];
}

let currentMusicUrl = null;

/**
 * Set music mode and adjust volume.
 * @param {string} mode - 'normal', 'cruiser', or 'destroyer'
 */
export function setMusicMode(mode = null) {
  if (mode) musicMode = mode;
  if (!musicMode) musicMode = "normal";
  if (!musicEnabled) return;

  if (musicNodes.length > 0) stopLegacyMusicNodes();

  const musicUrl = musicMode === "destroyer" ? BOSS_MUSIC_URL : BACKGROUND_MUSIC_URL;

  if (musicUrl !== currentMusicUrl) {
    if (backgroundMusicAudio) {
      try {
        backgroundMusicAudio.pause();
      } catch (e) {}
      try {
        backgroundMusicAudio.currentTime = 0;
      } catch (e) {}
    }
    backgroundMusicAudio = new Audio(musicUrl);
    backgroundMusicAudio.loop = true;
    backgroundMusicAudio.preload = "auto";
    currentMusicUrl = musicUrl;
  }

  backgroundMusicAudio.volume = (musicMode === "cruiser" ? 0.22 : 0.25) * musicVolume;
  if (!backgroundMusicAudio.paused && backgroundMusicAudio.readyState > 2) {
    return;
  }
  try {
    const p = backgroundMusicAudio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) {}
}

/**
 * Set music volume.
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export function setMusicVolume(volume) {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (backgroundMusicAudio) {
    backgroundMusicAudio.volume = (musicMode === "cruiser" ? 0.22 : 0.25) * musicVolume;
  }
  saveAudioSettingsToStorage();
}

/**
 * Set SFX volume.
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export function setSfxVolume(volume) {
  sfxVolume = Math.max(0, Math.min(1, volume));
  saveAudioSettingsToStorage();
}

/**
 * Start background music.
 * @param {string} mode - Music mode
 */
export function startMusic(mode = null) {
  if (mode) musicMode = mode;
  if (!musicMode) musicMode = "normal";
  if (!musicEnabled) return;
  setMusicMode(musicMode);
}

/**
 * Stop background music.
 */
export function stopMusic() {
  stopLegacyMusicNodes();
  musicMode = musicMode || "normal";
  if (backgroundMusicAudio) {
    try {
      backgroundMusicAudio.pause();
    } catch (e) {}
    try {
      backgroundMusicAudio.currentTime = 0;
    } catch (e) {}
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

  saveAudioSettingsToStorage();
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
  if (!audioCtx || audioCtx.state === "suspended") return;
  if (
    !ENABLE_PROJECTILE_IMPACT_SOUNDS &&
    inProjectileImpactSoundContext &&
    (type === "hit" || type === "shield_hit")
  )
    return;
  if (!(volumeMult > 0)) return;

  // Apply global SFX volume
  volumeMult *= sfxVolume;

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

    const createNoise = () => {
      const bufferSize = audioCtx.sampleRate * 0.5;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      return src;
    };

    const stopLoop = key => {
      const loop = sfxLoops[key];
      if (!loop) return;
      try {
        loop.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch (e) {}
      try {
        loop.osc.stop(now + 0.1);
      } catch (e) {}
      try {
        if (loop.noise) loop.noise.stop(now + 0.1);
      } catch (e) {}
      delete sfxLoops[key];
    };

    switch (type) {
      case "shoot": {
        // Deeper bass-heavy version: 700Hz -> 50Hz, reduced volume
        const { osc, gain } = createOsc("triangle", 700, 0.15, 0.075);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "coin": {
        const { osc, gain } = createOsc("sine", 1200, 0.1, 0.1);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "hit": {
        const { osc, gain } = createOsc("square", 200, 0.1, 0.15);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "shield_hit": {
        const { osc, gain } = createOsc("triangle", 600, 0.1, 0.15);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "asteroid_destroy": {
        // Rock breaking/crunching sound
        const { osc, gain } = createOsc("sawtooth", 200, 0.08, 0.12);
        // Quick frequency drop for "crack" sound
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.03);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case "enemy_shield_hit": {
        // Small, lower-pitched sound for enemy shield hits (increased volume)
        const { osc, gain } = createOsc("sine", 400, 0.08, 0.12);
        osc.frequency.linearRampToValueAtTime(250, now + 0.08);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case "explode": {
        const { osc, gain } = createOsc("sawtooth", 100, 0.3, 0.2);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "levelup": {
        const { osc, gain } = createOsc("square", 440, 0.6, 0.2);
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      }
      case "warp": {
        const { osc, gain } = createOsc("sine", 200, 0.3, 0.3);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "powerup": {
        const { osc, gain } = createOsc("sine", 400, 0.3, 0.2);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "shotgun": {
        const { osc, gain } = createOsc("square", 120, 0.1, 0.2);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "heavy_shoot": {
        const { osc, gain } = createOsc("square", 150, 0.2, 0.15);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "rapid_shoot": {
        const { osc, gain } = createOsc("triangle", 600, 0.1, 0.05);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "base_explode": {
        // Ominous explosion (shorter version of boss_spawn)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(80, now);
        osc1.frequency.linearRampToValueAtTime(10, now + 0.8);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(120, now);
        osc2.frequency.linearRampToValueAtTime(20, now + 0.8);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.5 * volumeMult, now);
        g.gain.exponentialRampToValueAtTime(0.01 * volumeMult, now + 0.8);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.8);
        osc2.stop(now + 0.8);
        break;
      }
      case "boss_spawn": {
        // Ominous sound
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(60, now);
        osc1.frequency.linearRampToValueAtTime(40, now + 3);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(90, now);
        osc2.frequency.linearRampToValueAtTime(60, now + 3);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.4 * volumeMult, now + 0.5);
        g.gain.linearRampToValueAtTime(0, now + 3);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 3);
        osc2.stop(now + 3);
        break;
      }
      case "station_spawn": {
        // Longer ominous sound for station
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(55, now);
        osc1.frequency.linearRampToValueAtTime(30, now + 6);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.linearRampToValueAtTime(50, now + 6);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.4 * volumeMult, now + 1);
        g.gain.linearRampToValueAtTime(0, now + 6);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 6);
        osc2.stop(now + 6);
        break;
      }
      case "contract": {
        // 3-note arcade chirp
        const oscA = audioCtx.createOscillator();
        const oscB = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        oscA.type = "square";
        oscB.type = "triangle";
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.22 * volumeMult, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.14 * volumeMult, now + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
        const seq = [
          { t: 0.0, f: 880 },
          { t: 0.28, f: 1320 },
          { t: 0.56, f: 1760 }
        ];
        for (const n of seq) {
          oscA.frequency.setValueAtTime(n.f, now + n.t);
          oscA.frequency.exponentialRampToValueAtTime(n.f * 1.06, now + n.t + 0.18);
          oscB.frequency.setValueAtTime(n.f * 0.5, now + n.t);
          oscB.frequency.exponentialRampToValueAtTime(n.f * 0.5 * 1.04, now + n.t + 0.18);
        }
        oscA.connect(g);
        oscB.connect(g);
        g.connect(audioCtx.destination);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.95);
        oscB.stop(now + 0.95);
        break;
      }
      case "warp_growl":
      case "warp_scream": {
        const isScream = type === "warp_scream";
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc1.type = "sawtooth";
        osc2.type = "triangle";
        const base = isScream ? 120 : 90;
        const peak = isScream ? 180 : 130;
        const dur = isScream ? 0.8 : 0.5;
        osc1.frequency.setValueAtTime(base, now);
        osc1.frequency.exponentialRampToValueAtTime(peak, now + dur * 0.4);
        osc1.frequency.exponentialRampToValueAtTime(base * 0.6, now + dur);
        osc2.frequency.setValueAtTime(base * 0.5, now);
        osc2.frequency.exponentialRampToValueAtTime(peak * 0.7, now + dur * 0.4);
        osc2.frequency.exponentialRampToValueAtTime(base * 0.4, now + dur);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime((isScream ? 0.45 : 0.35) * volumeMult, now + dur * 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(audioCtx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur);
        osc2.stop(now + dur);
        break;
      }
      case "warp_chitin": {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
        g.gain.setValueAtTime(0.18 * volumeMult, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case "warp_pod": {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
        g.gain.setValueAtTime(0.22 * volumeMult, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case "warp_pod_pop": {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        g.gain.setValueAtTime(0.25 * volumeMult, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case "warp_flame_start": {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const noise = createNoise();
        const filter = audioCtx.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.6);
        noise.playbackRate.setValueAtTime(1.0, now);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(900, now);
        filter.Q.setValueAtTime(0.7, now);
        osc.connect(g);
        noise.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.25 * volumeMult, now + 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.8);
        noise.stop(now + 0.8);
        break;
      }
      case "warp_flame_stop": {
        break;
      }
    }
  } catch (e) {}
}

/**
 * Play an MP3 sound effect with pooling.
 * @param {string} url - MP3 URL
 * @param {Object} opts - Options (volume, key, rateLimitMs, poolSize)
 */
export function playMp3Sfx(url, opts = {}) {
  let volume = typeof opts.volume === "number" ? opts.volume : 1;
  // Apply global SFX volume
  volume *= sfxVolume;
  if (!(volume > 0)) return;

  const key = opts.key || url;
  const now = Date.now();
  const entry = mp3SfxPools[key] || (mp3SfxPools[key] = { pool: [], idx: 0, lastAt: 0, url });

  const rateLimitMs = typeof opts.rateLimitMs === "number" ? opts.rateLimitMs : 0;
  if (rateLimitMs > 0 && now - (entry.lastAt || 0) < rateLimitMs) return;
  entry.lastAt = now;

  if (entry.pool.length === 0) {
    const poolSize = typeof opts.poolSize === "number" ? opts.poolSize : 4;
    for (let i = 0; i < Math.max(1, poolSize); i++) {
      const a = new Audio(url);
      a.preload = "auto";
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
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) {}
}

/**
 * Check if audio context is ready.
 */
export function isAudioReady() {
  return audioCtx !== null && audioCtx.state !== "suspended";
}

/**
 * Get current music enabled state.
 */
export function isMusicEnabled() {
  return musicEnabled;
}
