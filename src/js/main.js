// --- Module Imports ---
import { Vector, SpatialHash, _tempVec1, _tempVec2 } from './core/math.js';
import { globalProfiler } from './core/profiler.js';
import { globalJitterMonitor } from './core/jitter-monitor.js';
import { globalStaggeredCleanup, immediateCompactArray } from './core/staggered-cleanup.js';
import {
    updateViewBounds, viewBounds, isInView, isInViewRadius, entityInView,
    bulletGrid, rebuildBulletGrid, distSq, distLessThan
} from './core/performance.js';
import { colorToPixi } from './rendering/colors.js';
import { Entity } from './entities/Entity.js';
import {
    ZOOM_LEVEL, SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME,
    PIXI_SPRITE_POOL_MAX, USE_PIXI_OVERLAY, BACKGROUND_MUSIC_URL,
    ENABLE_NEBULA, NEBULA_ALPHA, ENABLE_PROJECTILE_IMPACT_SOUNDS
} from './core/constants.js';
import { Particle, SmokeParticle, Explosion, WarpParticle, Coin, FloatingText, HealthPowerUp, SpaceNugget, getOrCreateFloatingText } from './entities/index.js';
import {
    initAudio, startMusic, stopMusic, setMusicMode, playSound, playMp3Sfx,
    toggleMusic as audioToggleMusic, isMusicEnabled, setProjectileImpactSoundContext,
    musicEnabled, setMusicVolume, setSfxVolume, musicVolume, sfxVolume
} from './audio/audio-manager.js';
import {
    pixiBulletSpritePool, pixiParticleSpritePool, pixiEnemySpritePools,
    pixiPickupSpritePool, pixiAsteroidSpritePool, pixiStarSpritePool
} from './rendering/pixi-setup.js';

// --- Performance Debug (load after other modules) ---
import './core/perf-debug.js';

// --- Upgrade Data ---
const UPGRADE_DATA = {
    "categories": [
        {
            "name": "Weapons",
            "upgrades": [
                { "id": "turret_damage", "name": "Turret Damage", "tier1": "+20% damage", "tier2": "+40% total", "tier3": "+70% total", "notes": "Core DPS boost." },
                { "id": "turret_fire_rate", "name": "Turret Fire Rate", "tier1": "+15% RPS", "tier2": "+30% total", "tier3": "+50% total", "notes": "Stacks multiplicatively." },
                { "id": "turret_range", "name": "Turret Range", "tier1": "+25% range", "tier2": "+50% total", "tier3": "+100% total", "notes": "Hits farther threats." },
                { "id": "multi_shot", "name": "Multi-Shot", "tier1": "Fires 2 proj.", "tier2": "Fires 3 proj.", "tier3": "Fires 4 proj.", "notes": "Parallel fire." },
                { "id": "shotgun", "name": "Flak Shotgun", "tier1": "Unlock: 5 Pellets", "tier2": "8 Pellets, +Range", "tier3": "12 Pellets", "notes": "Close-range burst." },
                { "id": "static_weapons", "name": "Static Weapons", "tier1": "Unlock Forward Laser", "tier2": "Add Side Lasers", "tier3": "Add Rear Laser", "tier4": "Dual Rear Stream", "tier5": "Dual Front Stream", "notes": "Always-on turrets." },
                { "id": "homing_missiles", "name": "Homing Missiles", "tier1": "2x Missiles / 2s", "tier2": "4x Missiles / 2s", "tier3": "6x Missiles / 2s", "notes": "Shield-piercing swarm." }
            ]
        },
        {
            "name": "Shields & Hull",
            "upgrades": [
                { "id": "hull_strength", "name": "Hull Strength", "tier1": "+25 Max HP, Heal 25", "tier2": "+25 Max HP, Heal 25", "tier3": "+25 Max HP, Heal 25", "notes": "Increases survival." },
                { "id": "segment_count", "name": "Segment Count", "tier1": "+2 segments (total 10)", "tier2": "+4 total (14)", "tier3": "+8 total (18)", "notes": "Larger shield bubble." },
                { "id": "outer_shield", "name": "Outer Shield", "tier1": "6 purple segments", "tier2": "8 segments (restore all)", "tier3": "12 segments (restore all)", "notes": "Extra rotating ring (1 HP/seg)." },
                { "id": "shield_regen", "name": "Shield Regen", "tier1": "Regen 1 seg./5s", "tier2": "1 seg./3s", "tier3": "1 seg./1s", "notes": "Sustain in long fights." },
                { "id": "hp_regen", "name": "Hull Regen", "tier1": "Regen 1 HP / 5s", "tier2": "Regen 2 HP / 5s", "tier3": "Regen 3 HP / 5s", "notes": "Slow passive healing." }
            ]
        },
        {
            "name": "Mobility",
            "upgrades": [
                { "id": "speed", "name": "Speed", "tier1": "+15% max speed", "tier2": "+30% total", "tier3": "+50% total", "notes": "Dodge better." },
                { "id": "turbo_boost", "name": "Turbo Boost", "tier1": "+50% speed for 2s", "tier2": "+50% speed for 3.5s", "tier3": "+50% speed for 5s", "notes": "Press E / Gamepad X." }
            ]
        },
        {
            "name": "Specials",
            "upgrades": [
                { "id": "xp_magnet", "name": "XP Magnet", "tier1": "2x range", "tier2": "4x range", "tier3": "8x range", "notes": "Faster leveling." },
                { "id": "area_nuke", "name": "Area Nuke", "tier1": "Auto-fire 500u blast (5 dmg)", "tier2": "600u range, 10 dmg", "tier3": "800u range, 15 dmg", "notes": "Auto-activates when ready." },
                { "id": "invincibility", "name": "Phase Shield", "tier1": "3s Active / 20s CD", "tier2": "5s Active / 15s CD", "tier3": "7s Active / 10s CD + Regen", "notes": "Auto-cycling invulnerability." },
                { "id": "slow_field", "name": "Stasis Field", "tier1": "Stops roamers 3s", "tier2": "Stops 5s, +25% Area", "tier3": "Stops 8s, +25% Area", "notes": "Freezes enemies." }
            ]
        },
        {
            "name": "Drones",
            "upgrades": [
                { "id": "companion_drones", "name": "Companion Drones", "tier1": "Unlock Shooter Drone", "tier2": "Add Shield Drone", "tier3": "Add Heal Drone", "notes": "Orbiting support bots." }
            ]
        }
    ]
};

// --- Globals ---
let mouseState = { down: false };
let overlayTimeout = null;
let warpParticles = [];
let starfield = [];
let nebulas = [];
let shockwaves = [];
let menuSelectionIndex = 0;
let sectorIndex = 1;

// Pixi Textures (Global)
let pixiParticleSmokeTexture;
let pixiParticleWarpTexture;


// --- Game Mode State ---
let gameMode = 'normal'; // 'normal' or 'arcade'
let arcadeBoss = null;
let arcadeWave = 0;
let arcadeWaveNextAt = 0;

// --- Spatial Grid (SpatialHash imported from module) ---
const asteroidGrid = new SpatialHash(300); // Cell size approx max asteroid size + buffer
const targetGrid = new SpatialHash(350); // Spatial hash for Enemies, Bases, Turrets

// --- Base Classes (Vector and Entity imported from modules) ---

// Particle, SmokeParticle, Explosion, WarpParticle imported from ./entities/index.js
// Coin, FloatingText, HealthPowerUp, SpaceNugget imported from ./entities/index.js
// getOrCreateFloatingText imported from ./entities/index.js

// Audio functions imported from ./audio/audio-manager.js
// initAudio, startMusic, stopMusic, setMusicMode, playSound, playMp3Sfx,
// audioToggleMusic, isMusicEnabled, setProjectileImpactSoundContext

// DEBUG: Spawn cruiser instantly from console with window.spawnCruiser()
window.spawnCruiser = function () {
    if (typeof bossActive !== 'undefined' && bossActive) {
        console.log('[DEBUG] Boss already active');
        return;
    }
    cruiserEncounterCount++;
    if (destroyer) {
        const idx = enemies.indexOf(destroyer);
        if (idx !== -1) enemies.splice(idx, 1);
        if (destroyer.pixiCleanupObject && typeof destroyer.pixiCleanupObject === 'function') {
            destroyer.pixiCleanupObject();
        }
        destroyer = null;
    }
    clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
    baseRespawnTimers = [];
    roamerRespawnQueue = [];
    clearArrayWithPixiCleanup(bullets);
    clearArrayWithPixiCleanup(bossBombs);
    clearArrayWithPixiCleanup(guidedMissiles);
    boss = new Cruiser(cruiserEncounterCount);
    bossActive = true;
    bossArena.x = (player.pos.x + boss.pos.x) / 2;
    bossArena.y = (player.pos.y + boss.pos.y) / 2;
    bossArena.radius = 2500;
    bossArena.active = true;
    bossArena.growing = false;
    radiationStorm = null;
    clearMiniEvent();
    dreadManager.timerActive = false;
    dreadManager.firstSpawnDone = true;
    showOverlayMessage("DEBUG: CRUISER SPAWNED", '#ff0', 2000);
    playSound('boss_spawn');
    if (musicEnabled) setMusicMode('cruiser');
};

// DEBUG: Ctrl+Shift+3 to spawn cruiser
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === '3') {
        e.preventDefault();
        window.spawnCruiser();
    } else if (e.ctrlKey && e.shiftKey && e.key === '4') {
        e.preventDefault();
        window.spawnStation();
    }
});

// DEBUG: Spawn station instantly (Ctrl+Shift+4)
window.spawnStation = function () {
    if (spaceStation) {
        console.log('[DEBUG] Station already active');
        return;
    }
    spaceStation = new SpaceStation();
    // Only decrement if there are pending stations (debug bypass)
    if (pendingStations > 0) pendingStations--;
    stationArena.x = spaceStation.pos.x;
    stationArena.y = spaceStation.pos.y;
    stationArena.radius = 2800;
    stationArena.active = false;
    showOverlayMessage("DEBUG: SPACE STATION SPAWNED", '#ff0', 2000);
    playSound('station_spawn');
    console.log('[DEBUG] Station spawned at', spaceStation.pos.x.toFixed(0), spaceStation.pos.y.toFixed(0));
};

// toggleMusic wrapper that updates DOM button
function toggleMusic() {
    // Uses audioToggleMusic from module (imported as audioToggleMusic)
    const enabled = audioToggleMusic(gameActive, gamePaused);
    const btn = document.getElementById('music-btn');
    if (btn) btn.innerText = enabled ? "MUSIC: ON" : "MUSIC: OFF";
}

// --- Game Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = (() => {
    try { return canvas.getContext('2d', { desynchronized: true, alpha: false }); }
    catch (e) { return canvas.getContext('2d'); }
})();
// --- UI Canvas Setup ---
const uiCanvas = document.getElementById('uiCanvas');
const uiCtx = (() => {
    try { return uiCanvas.getContext('2d', { alpha: true }); }
    catch (e) { return uiCanvas.getContext('2d'); }
})();

const minimapCanvas = document.getElementById('minimap');
const minimapCtx = (() => {
    try { return minimapCanvas.getContext('2d', { desynchronized: true, alpha: false }); }
    catch (e) { return minimapCanvas.getContext('2d'); }
})();
if (ctx) ctx.imageSmoothingEnabled = false;
if (uiCtx) uiCtx.imageSmoothingEnabled = false;
if (minimapCtx) minimapCtx.imageSmoothingEnabled = false;

// Handle Resizing for both Canvases
function resizeGameCanvases() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    uiCanvas.width = w;
    uiCanvas.height = h;
    if (ctx) ctx.imageSmoothingEnabled = false;
    if (uiCtx) uiCtx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resizeGameCanvases);
resizeGameCanvases();

// PixiJS overlay (optional; falls back to Canvas if unavailable)
// Note: Pixi is rendered manually inside our main loop to avoid running a second render/ticker.
// USE_PIXI_OVERLAY imported from ./core/constants.js
// ENABLE_NEBULA and NEBULA_ALPHA imported from ./core/constants.js
let pixiApp = null;
let pixiWorldRoot = null;   // camera-transformed world space
let pixiScreenRoot = null;  // screen space (no camera transform)

// Screen-space background layers
let pixiNebulaLayer = null;
let pixiStarLayer = null;
let pixiStarTilingLayer = null; // preferred starfield (1-2 tiling sprites)
let pixiStarTiles = null;
let pixiNebulaTiles = null;
let pixiNebulaPaletteIdx = null;

// UI overlay layers (screen-space, for minimap and directional arrows)
let pixiUiOverlayLayer = null;    // Container for all UI graphics
let pixiMinimapGraphics = null;   // Graphics object for minimap
let pixiArrowsGraphics = null;    // Graphics object for directional arrows

// World-space layers
let pixiAsteroidLayer = null;
let pixiPickupLayer = null;
let pixiPlayerLayer = null;
let pixiBaseLayer = null;
let pixiEnemyLayer = null;
let pixiBossLayer = null; // stations / non-enemy bosses
let pixiVectorLayer = null; // Graphics (shields/rings/etc)
let pixiBulletLayer = null;
let pixiParticleLayer = null;
let pixiTextureWhite = null;
let pixiCaveGridLayer = null;   // screen-space
let pixiCaveGridSprite = null;  // TilingSprite
let pixiCaveGridTexture = null;
let pixiParticleGlowTexture = null;

// PIXI_SPRITE_POOL_MAX imported from ./core/constants.js
// Sprite pools imported from ./rendering/pixi-setup.js (see imports at top)

const pixiBulletTextures = { glow: null, laser: null, square: null };
const pixiTextures = {
    // Pickups / collectibles
    coin1: null,
    coin5: null,
    coin10: null,
    nugget: null,
    gateKey: null,
    health: null,

    // Enemies
    enemy_roamer: null,
    enemy_elite_roamer: null,
    enemy_hunter: null,
    enemy_defender: null,
    enemy_gunboat_1: null,
    enemy_gunboat_2: null,
    enemy_cruiser: null,

    // Player
    player_hull: null,
    player_turret_base: null,
    player_barrel: null,
    player_thruster: null,
    player_turbo_flame: null,

    // Bases
    base_standard: null,
    base_heavy: null,
    base_rapid: null,

    // Space station
    station_hull: null,
    station_core: null,
    station_turret: null,

    // Destroyer ship
    destroyer_hull: null,
    destroyer_turret: null,
    destroyer2_hull: null,

    // Asteroids
    asteroids: []
};
const pixiTextureAnchors = {};
const pixiTextureRotOffsets = {};
const pixiTextureBaseScales = {};
const pixiTextureScaleToRadius = {};

// Optional external sprite override for gunboats (falls back to procedural silhouette if missing)
const GUNBOAT1_URL = 'assets/gunboat1.png';
const GUNBOAT2_URL = 'assets/gunboat2.png';
const gunboat1Image = new Image();
const gunboat2Image = new Image();
gunboat1Image.decoding = 'async';
gunboat2Image.decoding = 'async';
gunboat1Image.src = GUNBOAT1_URL;
gunboat2Image.src = GUNBOAT2_URL;
let gunboat1Texture = null;
let gunboat2Texture = null;
let gunboat1Loaded = false;
let gunboat2Loaded = false;

// Space station external sprite
const STATION1_URL = 'assets/station1.png';
const station1Image = new Image();
station1Image.decoding = 'async';
station1Image.src = STATION1_URL;
let station1Texture = null;
let station1Loaded = false;

// Destroyer ship sprite
const DESTROYER1_URL = 'assets/destroyer1.png';
const destroyer1Image = new Image();
destroyer1Image.decoding = 'async';
destroyer1Image.src = DESTROYER1_URL;
let destroyer1Texture = null;
let destroyer1Loaded = false;

// Destroyer 2 ship sprite
const DESTROYER2_URL = 'assets/destroyer2.png';
const destroyer2Image = new Image();
destroyer2Image.decoding = 'async';
destroyer2Image.src = DESTROYER2_URL;
let destroyer2Texture = null;
let destroyer2Loaded = false;

const applyGunboatTextures = () => {
    if (!window.PIXI) return;
    try {
        if (gunboat1Loaded && !gunboat1Texture) {
            const tex = PIXI.Texture.from(gunboat1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat1Texture = tex;
        }
        if (gunboat2Loaded && !gunboat2Texture) {
            const tex = PIXI.Texture.from(gunboat2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat2Texture = tex;
        }

        if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_1 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_1 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_1 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_1 = true;
            pixiTextureBaseScales.enemy_gunboat_1 = 1;
        }

        if (gunboat2Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat2Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        } else if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        }
    } catch (e) {
        // Keep procedural gunboat textures.
    }
};

const applyStationTexture = () => {
    if (!window.PIXI) return;
    try {
        if (station1Loaded && !station1Texture) {
            const tex = PIXI.Texture.from(station1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            station1Texture = tex;
        }

        if (station1Texture) {
            pixiTextures.station_hull = station1Texture;
            pixiTextureAnchors.station_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural station texture.
    }
};

const applyDestroyerTexture = () => {
    if (!window.PIXI) return;
    try {
        if (destroyer1Loaded && !destroyer1Texture) {
            const tex = PIXI.Texture.from(destroyer1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer1Texture = tex;
        }

        if (destroyer1Texture) {
            pixiTextures.destroyer_hull = destroyer1Texture;
            pixiTextureAnchors.destroyer_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural destroyer texture.
    }
};

const applyDestroyer2Texture = () => {
    if (!window.PIXI) return;
    try {
        if (destroyer2Loaded && !destroyer2Texture) {
            const tex = PIXI.Texture.from(destroyer2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer2Texture = tex;
        }

        if (destroyer2Texture) {
            pixiTextures.destroyer2_hull = destroyer2Texture;
            pixiTextureAnchors.destroyer2_hull = 0.5;
        }
    } catch (e) {
        // Keep procedural destroyer texture.
    }
};

gunboat1Image.addEventListener('load', () => {
    gunboat1Loaded = true;
    applyGunboatTextures();
});
gunboat1Image.addEventListener('error', () => {
    gunboat1Loaded = false;
});
gunboat2Image.addEventListener('load', () => {
    gunboat2Loaded = true;
    applyGunboatTextures();
});
gunboat2Image.addEventListener('error', () => {
    gunboat2Loaded = false;
});
station1Image.addEventListener('load', () => {
    station1Loaded = true;
    applyStationTexture();
});
station1Image.addEventListener('error', () => {
    station1Loaded = false;
});
destroyer1Image.addEventListener('load', () => {
    destroyer1Loaded = true;
    applyDestroyerTexture();
});
destroyer1Image.addEventListener('error', () => {
    destroyer1Loaded = false;
});
destroyer2Image.addEventListener('load', () => {
    destroyer2Loaded = true;
    applyDestroyer2Texture();
});
destroyer2Image.addEventListener('error', () => {
    destroyer2Loaded = false;
});

// Optional external sprite override for nugget pickups (also used by nugz caches).
const NUGGET_URL = 'assets/nugget.png';
const nuggetImage = new Image();
nuggetImage.decoding = 'async';
nuggetImage.src = NUGGET_URL;
let nuggetTexture = null;
let nuggetLoaded = false;

const applyNuggetTexture = () => {
    if (!nuggetLoaded || nuggetTexture || !window.PIXI || !pixiTextures) return;
    try {
        const tex = PIXI.Texture.from(nuggetImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        nuggetTexture = tex;
        pixiTextures.nugget = tex;
    } catch (e) {
        // Keep procedural nugget texture.
    }
};

nuggetImage.addEventListener('load', () => {
    nuggetLoaded = true;
    applyNuggetTexture();
});
nuggetImage.addEventListener('error', () => {
    nuggetLoaded = false;
});

// Optional external sprite overrides for roamers/defenders/hunters.
const ROAMER_URL = 'assets/roamer1.png';
const ELITE_ROAMER_URL = 'assets/roamer_elite.png';
const HUNTER_URL = 'assets/hunter.png';
const DEFENDER_URL = 'assets/defender.png';
const roamerImage = new Image();
const eliteRoamerImage = new Image();
const hunterImage = new Image();
const defenderImage = new Image();
roamerImage.decoding = 'async';
eliteRoamerImage.decoding = 'async';
hunterImage.decoding = 'async';
defenderImage.decoding = 'async';
roamerImage.src = ROAMER_URL;
eliteRoamerImage.src = ELITE_ROAMER_URL;
hunterImage.src = HUNTER_URL;
defenderImage.src = DEFENDER_URL;
let roamerLoaded = false;
let eliteRoamerLoaded = false;
let hunterLoaded = false;
let defenderLoaded = false;

const applyEnemyTexture = (img, key) => {
    if (!img || img.naturalWidth <= 0 || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(img);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        pixiTextures[key] = tex;
        pixiTextureAnchors[key] = 0.5;
        pixiTextureScaleToRadius[key] = true;
        if (key === 'enemy_roamer' || key === 'enemy_elite_roamer' || key === 'enemy_hunter' || key === 'enemy_defender') {
            pixiTextureRotOffsets[key] = Math.PI / 2;
        }
    } catch (e) {
        // Keep procedural enemy textures.
    }
};

roamerImage.addEventListener('load', () => {
    roamerLoaded = true;
    applyEnemyTexture(roamerImage, 'enemy_roamer');
});
eliteRoamerImage.addEventListener('load', () => {
    eliteRoamerLoaded = true;
    applyEnemyTexture(eliteRoamerImage, 'enemy_elite_roamer');
});
hunterImage.addEventListener('load', () => {
    hunterLoaded = true;
    applyEnemyTexture(hunterImage, 'enemy_hunter');
});
defenderImage.addEventListener('load', () => {
    defenderLoaded = true;
    applyEnemyTexture(defenderImage, 'enemy_defender');
});
roamerImage.addEventListener('error', () => { roamerLoaded = false; });
eliteRoamerImage.addEventListener('error', () => { eliteRoamerLoaded = false; });
hunterImage.addEventListener('error', () => { hunterLoaded = false; });
defenderImage.addEventListener('error', () => { defenderLoaded = false; });

// Optional external sprite override for the standard base.
const BASE1_URL = 'assets/base1.png';
const base1Image = new Image();
base1Image.decoding = 'async';
base1Image.src = BASE1_URL;
let base1Texture = null;
let base1Loaded = false;

const applyBase1Texture = () => {
    if (!base1Loaded || base1Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base1Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base1Texture = tex;
        pixiTextures.base_standard = tex;
        pixiTextureAnchors.base_standard = 0.5;

        // Match the existing base's visual diameter (~2*radius = 140px).
        const desired = 140;
        const denom = Math.max(1, Math.max(base1Image.naturalWidth || 1, base1Image.naturalHeight || 1));
        pixiTextureBaseScales.base_standard = desired / denom;
    } catch (e) {
        // Keep procedural base textures.
    }
};

base1Image.addEventListener('load', () => {
    base1Loaded = true;
    applyBase1Texture();
});
base1Image.addEventListener('error', () => {
    base1Loaded = false;
});

// Optional external sprite override for the heavy base.
const BASE2_URL = 'assets/base2.png';
const base2Image = new Image();
base2Image.decoding = 'async';
base2Image.src = BASE2_URL;
let base2Texture = null;
let base2Loaded = false;

const applyBase2Texture = () => {
    if (!base2Loaded || base2Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base2Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base2Texture = tex;
        pixiTextures.base_heavy = tex;
        pixiTextureAnchors.base_heavy = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base2Image.naturalWidth || 1, base2Image.naturalHeight || 1));
        pixiTextureBaseScales.base_heavy = desired / denom;
    } catch (e) { }
};

base2Image.addEventListener('load', () => {
    base2Loaded = true;
    applyBase2Texture();
});
base2Image.addEventListener('error', () => {
    base2Loaded = false;
});

// Optional external sprite override for the rapid base.
const BASE3_URL = 'assets/base3.png';
const base3Image = new Image();
base3Image.decoding = 'async';
base3Image.src = BASE3_URL;
let base3Texture = null;
let base3Loaded = false;

const applyBase3Texture = () => {
    if (!base3Loaded || base3Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base3Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base3Texture = tex;
        pixiTextures.base_rapid = tex;
        pixiTextureAnchors.base_rapid = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base3Image.naturalWidth || 1, base3Image.naturalHeight || 1));
        pixiTextureBaseScales.base_rapid = desired / denom;
    } catch (e) { }
};

base3Image.addEventListener('load', () => {
    base3Loaded = true;
    applyBase3Texture();
});
base3Image.addEventListener('error', () => {
    base3Loaded = false;
});

// Optional external sprite override for the cruiser.
const CRUISER_URL = 'assets/cruiser.png';
const cruiserImage = new Image();
cruiserImage.decoding = 'async';
cruiserImage.src = CRUISER_URL;
let cruiserTexture = null;
let cruiserLoaded = false;

const applyCruiserTexture = () => {
    if (!cruiserLoaded || cruiserTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(cruiserImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        cruiserTexture = tex;
        pixiTextures.enemy_cruiser = tex;
        pixiTextureAnchors.enemy_cruiser = 0.5;

        // Auto-rotate if the asset is portrait (common for "nose up" sprites).
        const w = cruiserImage.naturalWidth || 0;
        const h = cruiserImage.naturalHeight || 0;
        pixiTextureRotOffsets.enemy_cruiser = (h > w) ? (Math.PI / 2) : 0;

        // For cruisers, scale by in-world radius (better match for boss scaling).
        pixiTextureScaleToRadius.enemy_cruiser = true;
    } catch (e) { }
};

cruiserImage.addEventListener('load', () => {
    cruiserLoaded = true;
    applyCruiserTexture();
});
cruiserImage.addEventListener('error', () => {
    cruiserLoaded = false;
});

// Warp Sentinel Boss sprite override
const WARP_BOSS_URL = 'assets/warp_boss.png';
const warpBossImage = new Image();
warpBossImage.decoding = 'async';
warpBossImage.src = WARP_BOSS_URL;
let warpBossTexture = null;
let warpBossLoaded = false;

const applyWarpBossTexture = () => {
    if (!warpBossLoaded || warpBossTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(warpBossImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        warpBossTexture = tex;
        pixiTextures.warp_boss = tex;
        pixiTextureAnchors.warp_boss = 0.5;
        // Face right by default; rotate to face player
        pixiTextureRotOffsets.warp_boss = 0;
        // Scale to fit the body width (exclude wispy tail)
        pixiTextureScaleToRadius.warp_boss = true;
    } catch (e) { }
};

warpBossImage.addEventListener('load', () => {
    warpBossLoaded = true;
    applyWarpBossTexture();
});
warpBossImage.addEventListener('error', () => {
    warpBossLoaded = false;
});

// Optional external sprite override for asteroid size tiers.
// sizeLevel: 3=large, 2=medium, 1=small.
const ASTEROID1_URL = 'assets/asteroid1.png';
const ASTEROID2_URL = 'assets/asteroid2.png';
const ASTEROID3_URL = 'assets/asteroid3.png';
const ASTEROID2_U_URL = 'assets/asteroid2_U.png'; // Indestructible asteroid
const asteroidImages = [
    new Image(),
    new Image(),
    new Image()
];
const asteroidIndestructibleImage = new Image();
asteroidIndestructibleImage.decoding = 'async';
asteroidIndestructibleImage.src = ASTEROID2_U_URL;
asteroidImages[0].decoding = 'async';
asteroidImages[1].decoding = 'async';
asteroidImages[2].decoding = 'async';
asteroidImages[0].src = ASTEROID1_URL;
asteroidImages[1].src = ASTEROID2_URL;
asteroidImages[2].src = ASTEROID3_URL;
let asteroidTexturesExternalReady = false;
let asteroidIndestructibleTextureReady = false;

const applyAsteroidTextures = () => {
    if (asteroidTexturesExternalReady || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    if (!asteroidImages.every(img => img && img.naturalWidth > 0)) return;
    try {
        const tex1 = PIXI.Texture.from(asteroidImages[0]);
        const tex2 = PIXI.Texture.from(asteroidImages[1]);
        const tex3 = PIXI.Texture.from(asteroidImages[2]);
        for (const t of [tex1, tex2, tex3]) {
            try { t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { t.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        }
        pixiTextures.asteroids = [tex1, tex2, tex3];
        pixiTextureAnchors.asteroid_0 = 0.5;
        pixiTextureAnchors.asteroid_1 = 0.5;
        pixiTextureAnchors.asteroid_2 = 0.5;
        asteroidTexturesExternalReady = true;
    } catch (e) {
        // Keep procedural asteroid textures.
    }
};

for (const img of asteroidImages) {
    img.addEventListener('load', applyAsteroidTextures);
    img.addEventListener('error', () => {
        // Any missing asteroid image should leave procedural rendering intact.
    });
}

// Indestructible asteroid texture
asteroidIndestructibleImage.addEventListener('load', () => {
    if (!window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(asteroidIndestructibleImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        pixiTextures.asteroidIndestructible = tex;
        pixiTextureAnchors.asteroidIndestructible = 0.5;
        asteroidIndestructibleTextureReady = true;
    } catch (e) {
        console.warn('Failed to load indestructible asteroid texture', e);
    }
});
asteroidIndestructibleImage.addEventListener('error', () => {
    // Indestructible asteroid image is optional
});

// Optional external sprite override for the player hull.
const PLAYER1_URL = 'assets/player1.png';
const playerHullImage = new Image();
playerHullImage.decoding = 'async';
playerHullImage.src = PLAYER1_URL;
const PLAYER_HULL_RENDER_SCALE = 2.5;
const PLAYER_HULL_ROT_OFFSET = Math.PI / 2; // world angle 0=right, art is nose-up
let playerHullExternalReady = false; // image loaded (usable by Canvas fallback too)
let playerHullPixiApplied = false;

const applyPlayerHullTexture = () => {
    if (!playerHullImage || playerHullImage.naturalWidth <= 0) return;

    // Player art is authored nose-up; apply an offset to match our world angle convention.
    playerHullExternalReady = true;

    if (playerHullPixiApplied || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(playerHullImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.player_hull = tex;
        pixiTextureAnchors.player_hull = 0.5;
        playerHullPixiApplied = true;
    } catch (e) {
        // Keep procedural hull.
    }
};
playerHullImage.addEventListener('load', applyPlayerHullTexture);
playerHullImage.addEventListener('error', () => {
    playerHullExternalReady = false;
    playerHullPixiApplied = false;
});

// Explosion sprite sheet (4 columns x 5 rows, 1024x1024).
const EXPLOSION1_URL = 'assets/explosion1.png';
const explosion1Image = new Image();
explosion1Image.decoding = 'async';
explosion1Image.src = EXPLOSION1_URL;
const EXPLOSION1_COLS = 4;
const EXPLOSION1_ROWS = 5;
const EXPLOSION1_FRAMES = EXPLOSION1_COLS * EXPLOSION1_ROWS;
const EXPLOSION1_FRAME_W = 1024 / EXPLOSION1_COLS;
const EXPLOSION1_FRAME_H = 1024 / EXPLOSION1_ROWS;
let explosion1Ready = false;
explosion1Image.addEventListener('load', () => { explosion1Ready = true; });
explosion1Image.addEventListener('error', () => { explosion1Ready = false; });


if (USE_PIXI_OVERLAY && window.PIXI) {
    console.log('[DEBUG] Pixi Block Entered');
    try { PIXI.settings.ROUND_PIXELS = true; } catch (e) { }
    pixiApp = new PIXI.Application({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true
    });
    try { pixiApp.renderer.roundPixels = true; } catch (e) { }
    // We'll render Pixi manually in our main loop to avoid double work.
    try { pixiApp.stop(); } catch (e) { }

    pixiApp.view.style.position = 'absolute';
    pixiApp.view.style.top = '0';
    pixiApp.view.style.left = '0';
    pixiApp.view.style.pointerEvents = 'none';
    pixiApp.view.style.zIndex = '15';  // Higher than uiCanvas (10) to render minimap/arrows on top
    document.body.appendChild(pixiApp.view);
    pixiTextureWhite = PIXI.Texture.WHITE;
    try { pixiApp.stage.eventMode = 'none'; } catch (e) { }

    pixiScreenRoot = new PIXI.Container();
    pixiWorldRoot = new PIXI.Container();
    pixiApp.stage.addChild(pixiScreenRoot);
    pixiApp.stage.addChild(pixiWorldRoot);

    // UI Overlay layer (minimap and directional arrows) - must be added AFTER world root to render on top
    pixiUiOverlayLayer = new PIXI.Container();
    pixiMinimapGraphics = new PIXI.Graphics();
    pixiArrowsGraphics = new PIXI.Graphics();
    pixiUiOverlayLayer.addChild(pixiArrowsGraphics);  // Arrows drawn first (behind minimap)
    pixiUiOverlayLayer.addChild(pixiMinimapGraphics);  // Minimap on top
    pixiApp.stage.addChild(pixiUiOverlayLayer);  // Add to stage (not pixiScreenRoot) so it renders above everything

    const makeGlowTexture = () => {
        const g = new PIXI.Graphics();
        // Large soft outer glow
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 16);
        // Medium glow
        g.beginFill(0xffffff, 0.4);
        g.drawCircle(0, 0, 8);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 4);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeLaserTexture = () => {
        const g = new PIXI.Graphics();
        // Glow
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-24, -8, 48, 16, 8);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-18, -5, 36, 10, 5);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-14, -2, 28, 4, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeSquareTexture = () => {
        const g = new PIXI.Graphics();
        // Glow
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-16, -16, 32, 32, 4);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-10, -10, 20, 20, 3);
        // Core
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-4, -4, 8, 8, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.glow = makeGlowTexture();
    pixiBulletTextures.laser = makeLaserTexture();
    pixiBulletTextures.square = makeSquareTexture();

    const makeMissileTexture = () => {
        const g = new PIXI.Graphics();
        // Shadow / Glow
        g.beginFill(0xffaa00, 0.3);
        g.drawCircle(0, 0, 12);
        g.beginFill(0xffaa00, 0.5);
        g.drawCircle(0, 0, 6);

        // Missile Body (Triangle pointing right)
        g.beginFill(0xff8800, 1);
        g.moveTo(6, 0);
        g.lineTo(-4, 4);
        g.lineTo(-4, -4);
        g.closePath();

        // Engine Glow (Static approximation)
        g.beginFill(0xff6400, 0.8);
        g.drawRect(-6, -2, 4, 4);

        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.missile = makeMissileTexture();

    const makeParticleGlowTexture = () => {
        const g = new PIXI.Graphics();
        // Inner core
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 2);
        // Soft outer halo
        g.beginFill(0xffffff, 0.45);
        g.drawCircle(0, 0, 5);
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 10);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleGlowTexture = makeParticleGlowTexture();

    const makeSmokeTexture = () => {
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0xffffff, 1);
        g.drawRect(-16, -16, 32, 32);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleSmokeTexture = makeSmokeTexture();

    const makeWarpTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1);
        g.drawRect(0, -2, 32, 4); // Origin at left-center
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiParticleWarpTexture = makeWarpTexture();

    // Background (screen-space)
    pixiNebulaLayer = new PIXI.Container();
    pixiCaveGridLayer = new PIXI.Container();
    pixiStarLayer = new PIXI.ParticleContainer(8000, { position: true, tint: true, scale: true, alpha: true });
    pixiStarTilingLayer = new PIXI.Container();
    pixiScreenRoot.addChild(pixiNebulaLayer);
    pixiScreenRoot.addChild(pixiCaveGridLayer);
    pixiScreenRoot.addChild(pixiStarTilingLayer);
    pixiScreenRoot.addChild(pixiStarLayer);

    // World-space layers (camera transformed)
    // Use a regular Container for asteroids because they use multiple textures; ParticleContainer can
    // occasionally show wrong textures under heavy batching, which looks like "shape changing".
    pixiAsteroidLayer = new PIXI.Container();
    pixiPickupLayer = new PIXI.ParticleContainer(6000, { position: true, rotation: true, tint: true, scale: true, alpha: true });
    pixiPlayerLayer = new PIXI.Container();
    pixiBaseLayer = new PIXI.Container();
    // NOTE: ParticleContainer effectively assumes a single texture; enemies use multiple textures (and can now include external images),
    // so use a regular Container to avoid "all enemies show the same sprite" issues.
    pixiEnemyLayer = new PIXI.Container();
    pixiBossLayer = new PIXI.Container();
    pixiVectorLayer = new PIXI.Container();
    // Use regular Container for bullets since they use multiple different generated textures
    // (glow, laser, square, missile). ParticleContainer requires uniform base textures.
    pixiBulletLayer = new PIXI.Container();
    pixiParticleLayer = new PIXI.ParticleContainer(20000, { position: true, tint: true, scale: true, alpha: true });

    pixiWorldRoot.addChild(pixiAsteroidLayer);
    pixiWorldRoot.addChild(pixiPickupLayer);
    pixiWorldRoot.addChild(pixiPlayerLayer);
    pixiWorldRoot.addChild(pixiBaseLayer);
    pixiWorldRoot.addChild(pixiEnemyLayer);
    pixiWorldRoot.addChild(pixiBossLayer);
    pixiWorldRoot.addChild(pixiVectorLayer);
    pixiWorldRoot.addChild(pixiBulletLayer);
    pixiWorldRoot.addChild(pixiParticleLayer);

    // Cave grid background (screen-space tiling texture)
    const makeCaveGridTexture = () => {
        const grid = 420;
        const minor = 210;
        const g = new PIXI.Graphics();
        // Minor grid lines (slightly thicker so they survive low zoom)
        g.lineStyle(2, 0x00ffff, 0.05);
        g.moveTo(0, 0); g.lineTo(0, grid);
        g.moveTo(minor, 0); g.lineTo(minor, grid);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, minor); g.lineTo(grid, minor);
        // Major lines on tile edges
        g.lineStyle(3, 0x00ffff, 0.10);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, 0); g.lineTo(0, grid);
        const tex = pixiApp.renderer.generateTexture(g);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };
    try {
        pixiCaveGridTexture = makeCaveGridTexture();
        pixiCaveGridSprite = new PIXI.TilingSprite(pixiCaveGridTexture, (typeof width === 'number' && width > 0) ? width : 1, (typeof height === 'number' && height > 0) ? height : 1);
        pixiCaveGridSprite.alpha = 1;
        pixiCaveGridLayer.addChild(pixiCaveGridSprite);
        pixiCaveGridLayer.visible = false;
    } catch (e) { }

    // --- Starfield and Nebula Backdrop ---
    // Create procedural textures for parallax star layers and nebula clouds.
    // Uses TilingSprite for GPU-optimized infinite scrolling.
    const STAR_TILE_SIZE = 512;
    const NEBULA_TILE_SIZE = 512;

    // Generate a starfield texture with random stars (seamless tile)
    const makeStarfieldTexture = (starCount, minSize, maxSize, minAlpha, maxAlpha) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * STAR_TILE_SIZE;
            const y = Math.random() * STAR_TILE_SIZE;
            const size = minSize + Math.random() * (maxSize - minSize);
            const alpha = minAlpha + Math.random() * (maxAlpha - minAlpha);
            // Slight color variation: white to light blue/yellow
            const colorVar = Math.random();
            let color = 0xffffff;
            if (colorVar < 0.15) color = 0xaaddff; // light blue
            else if (colorVar < 0.25) color = 0xffffaa; // light yellow
            else if (colorVar < 0.3) color = 0xffccaa; // light orange
            // Draw the star and its wrapped copies for seamless tiling
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    g.beginFill(color, alpha);
                    g.drawCircle(x + ox * STAR_TILE_SIZE, y + oy * STAR_TILE_SIZE, size);
                    g.endFill();
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, STAR_TILE_SIZE, STAR_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    // Generate a nebula texture with soft colored clouds (seamless tile)
    // Uses multiple overlapping circles with varying alpha to create soft gradient-like blobs
    const makeNebulaTexture = (blobCount, palette) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < blobCount; i++) {
            const x = Math.random() * NEBULA_TILE_SIZE;
            const y = Math.random() * NEBULA_TILE_SIZE;
            const baseSize = 60 + Math.random() * 140;
            const color = palette[Math.floor(Math.random() * palette.length)];
            const baseAlpha = 0.001 + Math.random() * 0.003; // Very subtle/transparent

            // Draw multiple layered circles to create soft gradient falloff
            const layers = 8;
            for (let layer = layers; layer >= 1; layer--) {
                const ratio = layer / layers;
                const size = baseSize * ratio;
                const layerAlpha = baseAlpha * (1 - ratio * 0.7); // Fade toward edges

                // Draw at the position and wrapped copies for seamless tiling
                for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                        g.beginFill(color, layerAlpha);
                        g.drawCircle(x + ox * NEBULA_TILE_SIZE, y + oy * NEBULA_TILE_SIZE, size);
                        g.endFill();
                    }
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, NEBULA_TILE_SIZE, NEBULA_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    // Color palettes for nebulae (different sectors can use different palettes)
    const nebulaPalettes = [
        [0x4400aa, 0x220066, 0x6622aa, 0x3311aa], // Purple/violet
        [0x004488, 0x002266, 0x006688, 0x003366], // Blue
        [0x440022, 0x660033, 0x880044, 0x330022], // Red/magenta
        [0x224400, 0x336600, 0x448800, 0x113300], // Green (rare)
    ];
    pixiNebulaPaletteIdx = Math.floor(Math.random() * nebulaPalettes.length);

    try {
        // Create 3 parallax star layers (far, mid, near)
        const starTexFar = makeStarfieldTexture(80, 0.5, 1.2, 0.1, 0.25);   // Many dim distant stars
        const starTexMid = makeStarfieldTexture(40, 0.8, 1.8, 0.2, 0.35);   // Medium stars
        const starTexNear = makeStarfieldTexture(15, 1.2, 2.5, 0.3, 0.5); // Fewer bright close stars

        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;

        pixiStarTiles = [
            { sprite: new PIXI.TilingSprite(starTexFar, w, h), parallax: 0.02 },
            { sprite: new PIXI.TilingSprite(starTexMid, w, h), parallax: 0.05 },
            { sprite: new PIXI.TilingSprite(starTexNear, w, h), parallax: 0.10 }
        ];
        pixiStarTiles.forEach(layer => {
            pixiStarTilingLayer.addChild(layer.sprite);
        });

        // Create 2 nebula layers (far, near)
        const nebulaTexFar = makeNebulaTexture(12, nebulaPalettes[pixiNebulaPaletteIdx]);
        const nebulaTexNear = makeNebulaTexture(8, nebulaPalettes[pixiNebulaPaletteIdx]);
        pixiNebulaTiles = [
            { sprite: new PIXI.TilingSprite(nebulaTexFar, w, h), parallax: 0.01 },
            { sprite: new PIXI.TilingSprite(nebulaTexNear, w, h), parallax: 0.03 }
        ];
        pixiNebulaTiles.forEach(layer => {
            layer.sprite.blendMode = PIXI.BLEND_MODES.ADD;
            pixiNebulaLayer.addChild(layer.sprite);
        });
    } catch (e) {
        console.warn('Backdrop initialization failed:', e);
    }

    // --- Prebaked textures (avoid per-frame Canvas2D paths for hot objects) ---
    const genTexture = (graphics) => {
        const b = graphics.getLocalBounds();
        const tex = pixiApp.renderer.generateTexture(graphics);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        const anchor = (b && b.width > 0 && b.height > 0)
            ? { x: (-b.x) / b.width, y: (-b.y) / b.height }
            : { x: 0.5, y: 0.5 };
        try { graphics.destroy(true); } catch (e) { }
        return { tex, anchor };
    };

    const makeGlowStrokedPolyTexture = (points, fillHex, strokeHex, lineWidth = 2) => {
        const g = new PIXI.Graphics();
        g.beginFill(fillHex, 1);
        g.drawPolygon(points);
        g.endFill();
        // Glow-ish outline
        g.lineStyle(lineWidth * 5, strokeHex, 0.12);
        g.drawPolygon(points);
        g.lineStyle(lineWidth * 3, strokeHex, 0.25);
        g.drawPolygon(points);
        g.lineStyle(lineWidth, strokeHex, 1);
        g.drawPolygon(points);
        return genTexture(g);
    };

    // Pickups
    {
        const makeCoin = (fillHex) => {
            const g = new PIXI.Graphics();
            const pts = [0, -8, 8, 0, 0, 8, -8, 0];

            // Outer Glow (Large halo)
            g.lineStyle(24, fillHex, 0.15);
            g.drawPolygon(pts);

            // Inner Glow
            g.lineStyle(12, fillHex, 0.4);
            g.drawPolygon(pts);

            // Core Outline (White)
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(fillHex, 1);
            g.drawPolygon(pts);
            g.endFill();

            return genTexture(g).tex;
        };
        pixiTextures.coin1 = makeCoin(0xffff00);
        pixiTextures.coin5 = makeCoin(0xffff00);  // All coins are gold
        pixiTextures.coin10 = makeCoin(0xffff00); // All coins are gold

        const makeHealth = () => {
            const g = new PIXI.Graphics();
            // glow behind
            g.beginFill(0x00ff00, 0.12);
            g.drawCircle(0, 0, 20);
            g.endFill();
            // plus
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x00ff00, 1);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            g.endFill();
            g.lineStyle(10, 0x00ff00, 0.10);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            return genTexture(g).tex;
        };
        pixiTextures.health = makeHealth();

        const makeNugget = () => {
            const c = document.createElement('canvas');
            c.width = 96;
            c.height = 96;
            const cctx = c.getContext('2d');
            cctx.translate(48, 48);
            cctx.rotate(Math.PI / 6);
            cctx.lineJoin = 'round';
            cctx.lineWidth = 6;
            const grad = cctx.createLinearGradient(-24, -24, 24, 24);
            grad.addColorStop(0, '#ff0');
            grad.addColorStop(0.5, '#f90');
            grad.addColorStop(1, '#0ff');
            cctx.fillStyle = grad;
            cctx.strokeStyle = '#fff';
            cctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const x = Math.cos(a) * 22;
                const y = Math.sin(a) * 22;
                if (i === 0) cctx.moveTo(x, y);
                else cctx.lineTo(x, y);
            }
            cctx.closePath();
            cctx.fill();
            cctx.stroke();
            return PIXI.Texture.from(c);
        };
        pixiTextures.nugget = makeNugget();
        applyNuggetTexture();
    }

    // Enemies (baked colors; per-instance alpha/tint for effects only)
    {
        const roamerPts = [18, 0, -12, 12, -6, 0, -12, -12];
        const elitePts = [25, 0, -15, 18, -5, 0, -15, -18];
        const hunterPts = [30, 0, -15, 12, -10, 0, -15, -12];

        const makeEnemy = (points, fillHex, strokeHex) => {
            const { tex, anchor } = makeGlowStrokedPolyTexture(points, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const r = makeEnemy(roamerPts, 0x441111, 0xff5555);
        pixiTextures.enemy_roamer = r.tex;
        pixiTextureAnchors.enemy_roamer = r.anchor;

        // Elite roamers should stay in the same red family as regular roamers (no purple tinting).
        const er = makeEnemy(elitePts, 0x441111, 0xff5555);
        pixiTextures.enemy_elite_roamer = er.tex;
        pixiTextureAnchors.enemy_elite_roamer = er.anchor;

        const h = makeEnemy(hunterPts, 0x442200, 0xffaa00);
        pixiTextures.enemy_hunter = h.tex;
        pixiTextureAnchors.enemy_hunter = h.anchor;

        const d = makeEnemy(roamerPts, 0x661111, 0xff8888);
        pixiTextures.enemy_defender = d.tex;
        pixiTextureAnchors.enemy_defender = d.anchor;

        // Gunboat silhouette (scaled in draw; base at s=1.4 to match Canvas default)
        const makeGunboat = (fillHex, strokeHex) => {
            const s = 1.4;
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            const { tex, anchor } = makeGlowStrokedPolyTexture(pts, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const gb1 = makeGunboat(0x221111, 0xff5555);
        pixiTextures.enemy_gunboat_1 = gb1.tex;
        pixiTextureAnchors.enemy_gunboat_1 = gb1.anchor;

        const gb2 = makeGunboat(0x332211, 0xffbb00);
        pixiTextures.enemy_gunboat_2 = gb2.tex;
        pixiTextureAnchors.enemy_gunboat_2 = gb2.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyGunboatTextures();

        const makeCruiser = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const L = 28 * s;
            const H = 7.5 * s;
            const nose = 6 * s;
            const tail = 7 * s;
            const podL = 10 * s;
            const podH = 3.2 * s;
            const podX = 16.5 * s;
            const podY = 10.0 * s;

            // Hull
            const hull = [
                L, 0,
                L - nose, H,
                -L + tail, H,
                -L, 0,
                -L + tail, -H,
                L - nose, -H
            ];
            g.beginFill(0x2b2f33, 1);
            g.drawPolygon(hull);
            g.endFill();

            // Pods
            g.beginFill(0x1b1f23, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);
            g.endFill();

            // Deck lines (subtle)
            g.lineStyle(1, 0x8aa0b3, 0.35);
            g.moveTo(-L + tail + 8 * s, 0);
            g.lineTo(L - nose - 10 * s, 0);
            g.moveTo(-L + tail + 8 * s, H * 0.55);
            g.lineTo(L - nose - 14 * s, H * 0.55);
            g.moveTo(-L + tail + 8 * s, -H * 0.55);
            g.lineTo(L - nose - 14 * s, -H * 0.55);

            // Outline glow
            g.lineStyle(10, 0xc7ced6, 0.10);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);

            // Engine glow
            g.beginFill(0x00ffff, 1);
            g.drawCircle(-L + 5 * s, 0, 2.8 * s);
            g.endFill();
            g.beginFill(0x00ffff, 0.20);
            g.drawCircle(-L + 5 * s, 0, 10 * s);
            g.endFill();

            return genTexture(g);
        };

        const cr = makeCruiser();
        pixiTextures.enemy_cruiser = cr.tex;
        pixiTextureAnchors.enemy_cruiser = cr.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyCruiserTexture();
    }

    // Asteroids (few shared variants; tinted per asteroid)
    {
        // If external asteroid art is present, use it and skip procedural generation.
        applyAsteroidTextures();
        if (!asteroidTexturesExternalReady) {
            const makeAsteroidVariant = () => {
                const g = new PIXI.Graphics();
                const points = [];
                // Higher-res base shape reduces "shape shimmer" while rotating at low zoom.
                const baseR = 320;
                const count = 12 + Math.floor(Math.random() * 7);
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2;
                    const r = baseR * (0.75 + Math.random() * 0.35);
                    points.push(Math.cos(a) * r, Math.sin(a) * r);
                }
                // Hollow asteroids: outline-only (no filled interior).
                g.lineStyle(7, 0xffffff, 0.90);
                g.drawPolygon(points);
                const { tex, anchor } = genTexture(g);
                try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF; } catch (e) { }
                return { tex, anchor };
            };
            pixiTextures.asteroids = [];
            for (let i = 0; i < 12; i++) {
                const v = makeAsteroidVariant();
                pixiTextures.asteroids.push(v.tex);
                pixiTextureAnchors[`asteroid_${i}`] = v.anchor;
            }
        } else {
            // Ensure the asteroid texture list exists even if external failed mid-session.
            if (!pixiTextures.asteroids || pixiTextures.asteroids.length === 0) pixiTextures.asteroids = [];
        }
    }

    // Player / Bases / Space station (prebaked textures)
    {
        // Player hull
        const makePlayerHull = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            g.beginFill(0x112222, 1);
            g.drawPolygon(pts);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawPolygon(pts);
            // Cockpit
            g.beginFill(0x001111, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            // Struts
            g.lineStyle(2, 0x00ffff, 1);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, 8 * s);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, -8 * s);
            return genTexture(g);
        };
        const ph = makePlayerHull();
        pixiTextures.player_hull = ph.tex;
        pixiTextureAnchors.player_hull = ph.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyPlayerHullTexture();

        // Player turret base (circle + cyan chevron)
        const makePlayerTurretBase = () => {
            const g = new PIXI.Graphics();
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x003333, 1);
            g.drawCircle(0, 0, 8);
            g.endFill();
            g.beginFill(0x00ffff, 1);
            g.drawPolygon([0, -4, 6, 0, 0, 4]);
            g.endFill();
            return genTexture(g);
        };
        const ptb = makePlayerTurretBase();
        pixiTextures.player_turret_base = ptb.tex;
        pixiTextureAnchors.player_turret_base = ptb.anchor;

        // Player barrel (anchor at left-center)
        const makePlayerBarrel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x000000, 1);
            g.drawRect(0, -3, 25, 6);
            g.endFill();
            g.lineStyle(2, 0xffffff, 1);
            g.drawRect(0, -3, 25, 6);
            return genTexture(g);
        };
        const pb = makePlayerBarrel();
        pixiTextures.player_barrel = pb.tex;
        pixiTextureAnchors.player_barrel = pb.anchor; // expects {x:0,y:0.5}

        // Player thruster (simple triangle, shown when thrusting)
        const makePlayerThruster = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            g.beginFill(0x00ffff, 1);
            g.drawPolygon([-25 * s, 4 * s, -40 * s, 0, -25 * s, -4 * s]);
            g.endFill();
            return genTexture(g);
        };
        const pth = makePlayerThruster();
        pixiTextures.player_thruster = pth.tex;
        pixiTextureAnchors.player_thruster = pth.anchor;

        const makePlayerTurboFlame = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const baseX = -25 * s;

            // Outer red/orange plume
            g.beginFill(0xff2200, 0.45);
            g.drawPolygon([
                baseX, 0,
                baseX - 105 * s, -18 * s,
                baseX - 95 * s, 0,
                baseX - 105 * s, 18 * s
            ]);
            g.endFill();

            // Mid orange
            g.beginFill(0xff6600, 0.65);
            g.drawPolygon([
                baseX, 0,
                baseX - 88 * s, -12 * s,
                baseX - 82 * s, 0,
                baseX - 88 * s, 12 * s
            ]);
            g.endFill();

            // Inner yellow
            g.beginFill(0xffdd00, 0.85);
            g.drawPolygon([
                baseX, 0,
                baseX - 70 * s, -9 * s,
                baseX - 66 * s, 0,
                baseX - 70 * s, 9 * s
            ]);
            g.endFill();

            // White-hot core
            g.beginFill(0xffffff, 0.75);
            g.drawPolygon([
                baseX, 0,
                baseX - 48 * s, -5 * s,
                baseX - 44 * s, 0,
                baseX - 48 * s, 5 * s
            ]);
            g.endFill();

            return genTexture(g);
        };
        const ptf = makePlayerTurboFlame();
        pixiTextures.player_turbo_flame = ptf.tex;
        pixiTextureAnchors.player_turbo_flame = ptf.anchor;

        // Bases
        const makeBase = (strokeHex, fillHex) => {
            const g = new PIXI.Graphics();
            const r = 70;
            g.beginFill(fillHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            g.endFill();
            g.lineStyle(6, strokeHex, 0.10);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(3, strokeHex, 0.85);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(2, strokeHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            return genTexture(g);
        };
        const bs = makeBase(0x00ffff, 0x111111);
        pixiTextures.base_standard = bs.tex;
        pixiTextureAnchors.base_standard = bs.anchor;
        const bh = makeBase(0xffaa00, 0x111111);
        pixiTextures.base_heavy = bh.tex;
        pixiTextureAnchors.base_heavy = bh.anchor;
        const br = makeBase(0x0088ff, 0x111111);
        pixiTextures.base_rapid = br.tex;
        pixiTextureAnchors.base_rapid = br.anchor;

        // If the external image is available, swap it in (non-fatal if missing).
        applyBase1Texture();
        applyBase2Texture();
        applyBase3Texture();
        applyStationTexture();

        // Station hull (procedural - used if external texture not available)
        if (!station1Texture) {
            const makeStationHull = () => {
                const g = new PIXI.Graphics();
                const R = 340;
                // Outer ring
                g.lineStyle(20, 0x333333, 1);
                g.drawCircle(0, 0, R - 30);
                // Main body
                g.beginFill(0x111111, 1);
                g.drawCircle(0, 0, R * 0.75);
                g.endFill();
                g.lineStyle(5, 0x00ffff, 1);
                g.drawCircle(0, 0, R * 0.75);
                // Tech ring + spokes
                g.lineStyle(2, 0x00ffff, 0.30);
                g.drawCircle(0, 0, R * 0.5);
                for (let i = 0; i < 8; i++) {
                    const a = i * (Math.PI / 4);
                    g.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
                    g.lineTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75);
                }
                // Core housing
                g.beginFill(0x000000, 1);
                g.drawCircle(0, 0, R * 0.25);
                g.endFill();
                g.lineStyle(3, 0xff00ff, 1);
                g.drawCircle(0, 0, R * 0.25);
                return genTexture(g);
            };
            const sh = makeStationHull();
            pixiTextures.station_hull = sh.tex;
            pixiTextureAnchors.station_hull = sh.anchor;
        }

        const makeStationCore = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0xff00ff, 1);
            g.drawCircle(0, 0, 60);
            g.endFill();
            g.beginFill(0xff00ff, 0.25);
            g.drawCircle(0, 0, 120);
            g.endFill();
            return genTexture(g);
        };
        const sc = makeStationCore();
        pixiTextures.station_core = sc.tex;
        pixiTextureAnchors.station_core = sc.anchor;

        const makeStationTurret = () => {
            const g = new PIXI.Graphics();
            // Base
            g.beginFill(0x333333, 1);
            g.drawCircle(0, 0, 22);
            g.endFill();
            g.lineStyle(2, 0x888888, 1);
            g.drawCircle(0, 0, 22);
            // Twin barrels (anchor around origin)
            g.beginFill(0xff4444, 1);
            g.drawRect(10, -12, 40, 8);
            g.drawRect(10, 4, 40, 8);
            g.endFill();
            // Center pivot
            g.beginFill(0xaaaaaa, 1);
            g.drawCircle(0, 0, 10);
            g.endFill();
            return genTexture(g);
        };
        const st = makeStationTurret();
        pixiTextures.station_turret = st.tex;
        pixiTextureAnchors.station_turret = st.anchor;
    }
}

// colorToPixi is now imported from ./rendering/colors.js

function allocPixiSprite(pool, layer, texture = pixiTextureWhite, size = 2, anchor = 0.5) {
    if (!texture || !layer) return null;
    let spr = pool && pool.length > 0 ? pool.pop() : null;
    if (!spr) spr = new PIXI.Sprite(texture);
    spr.texture = texture;
    spr.tint = 0xffffff;
    spr.alpha = 1;
    spr.rotation = 0;
    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
    spr.scale.set(1);
    if (typeof anchor === 'number') spr.anchor.set(anchor);
    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') spr.anchor.set(anchor.x, anchor.y);
    else if (Array.isArray(anchor) && anchor.length >= 2) spr.anchor.set(anchor[0], anchor[1]);
    else spr.anchor.set(0.5);
    spr.visible = true;
    if (size != null) spr.width = spr.height = size;
    if (!spr.parent) layer.addChild(spr);
    return spr;
}

function releasePixiSprite(pool, spr) {
    if (!spr) return;
    if (spr.parent) spr.parent.removeChild(spr);
    spr.visible = false;
    if (pool && pool.length < PIXI_SPRITE_POOL_MAX) pool.push(spr);
}

function destroyBulletSprite(b) {
    if (b && b.sprite && pixiBulletSpritePool) {
        releasePixiSprite(pixiBulletSpritePool, b.sprite);
        b.sprite = null;
    }
}

function releasePixiEnemySprite(spr) {
    if (!spr) return;
    const key = spr._pixiKey;
    const pool = (key && pixiEnemySpritePools && pixiEnemySpritePools[key]) ? pixiEnemySpritePools[key] : null;
    if (pool) releasePixiSprite(pool, spr);
    else releasePixiSprite(null, spr);
}

function pixiCleanupObject(obj) {
    if (!obj) return;
    // Safety check to prevent recursion
    if (obj._pixiIsCleaning) return;
    obj._pixiIsCleaning = true;

    // Non-pooled containers (player/bases/stations/etc)
    if (obj._pixiContainer) {
        try { obj._pixiContainer.destroy({ children: true }); } catch (e) { }
        obj._pixiContainer = null;
    }
    // Common sprite cleanup (pooled sprites)
    if (obj.sprite) {
        if (obj._pixiPool === 'enemy') releasePixiEnemySprite(obj.sprite);
        else if (obj._pixiPool === 'pickup' && pixiPickupSpritePool) releasePixiSprite(pixiPickupSpritePool, obj.sprite);
        else if (obj._pixiPool === 'asteroid' && pixiAsteroidSpritePool) releasePixiSprite(pixiAsteroidSpritePool, obj.sprite);
        else if (obj._poolType === 'bullet' && pixiBulletSpritePool) releasePixiSprite(pixiBulletSpritePool, obj.sprite);
        else if (obj._poolType === 'particle' && pixiParticleSpritePool) releasePixiSprite(pixiParticleSpritePool, obj.sprite);
        obj.sprite = null;
    }

    // Comprehensive destruction of all _pixi Graphics/Text/etc.
    // This allows classes to add pixi elements without manually updating the cleanup logic.
    const keys = Object.keys(obj);
    for (let k of keys) {
        if (k.startsWith('_pixi') && obj[k] && k !== '_pixiIsCleaning') {
            const val = obj[k];
            if (Array.isArray(val)) {
                val.forEach(item => {
                    if (item && typeof item.destroy === 'function') {
                        try {
                            if (!item.destroyed) {
                                item.visible = false;
                                if (typeof item.clear === 'function') item.clear();
                                if (item.parent) item.parent.removeChild(item);
                                item.destroy(true);
                            }
                        } catch (e) { console.warn('[CLEANUP] Error destroying item:', e); }
                    }
                });
            } else if (val && typeof val.destroy === 'function') {
                try {
                    if (!val.destroyed) {
                        val.visible = false;
                        if (typeof val.clear === 'function') val.clear();
                        if (val.parent) val.parent.removeChild(val);
                        val.destroy(true);
                    }
                } catch (e) { console.warn('[CLEANUP] Error destroying val:', e); }
            }
            obj[k] = null;
        }
    }

    obj._pixiIsCleaning = false;
}

function clearArrayWithPixiCleanup(arr) {
    if (!arr || arr.length === 0) return;
    for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        if (obj) {
            // Mark as dead FIRST to prevent draw() from recreating graphics
            obj.dead = true;
            pixiCleanupObject(obj);
        }
    }
    arr.length = 0;
}

function filterArrayWithPixiCleanup(arr, keepFn) {
    if (!arr || arr.length === 0) return arr;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        if (!obj) continue;
        if (keepFn(obj)) arr[w++] = obj;
        else pixiCleanupObject(obj);
    }
    arr.length = w;
    return arr;
}

function resetPixiOverlaySprites() {
    // Nebula is a persistent screen-space backdrop; keep it mounted.
    if (pixiNebulaLayer && pixiNebulaTiles && pixiNebulaTiles.length) {
        for (const t of pixiNebulaTiles) {
            if (t && t.spr && !t.spr.parent) pixiNebulaLayer.addChild(t.spr);
        }
    }
    // Cave grid is a persistent screen-space layer; keep it mounted.
    if (pixiCaveGridLayer && pixiCaveGridSprite && !pixiCaveGridSprite.parent) pixiCaveGridLayer.addChild(pixiCaveGridSprite);
    if (pixiStarLayer) pixiStarLayer.removeChildren();
    if (pixiAsteroidLayer) pixiAsteroidLayer.removeChildren();
    if (pixiPickupLayer) pixiPickupLayer.removeChildren();
    if (pixiPlayerLayer) pixiPlayerLayer.removeChildren();
    if (pixiBaseLayer) pixiBaseLayer.removeChildren();
    if (pixiEnemyLayer) pixiEnemyLayer.removeChildren();
    if (pixiBossLayer) pixiBossLayer.removeChildren();
    if (pixiVectorLayer) pixiVectorLayer.removeChildren();
    if (pixiBulletLayer) pixiBulletLayer.removeChildren();
    if (pixiParticleLayer) pixiParticleLayer.removeChildren();
    pixiBulletSpritePool.length = 0;
    pixiParticleSpritePool.length = 0;
    try {
        const keys = pixiEnemySpritePools ? Object.keys(pixiEnemySpritePools) : [];
        for (const k of keys) pixiEnemySpritePools[k].length = 0;
    } catch (e) { }
    pixiPickupSpritePool.length = 0;
    pixiAsteroidSpritePool.length = 0;
    pixiStarSpritePool.length = 0;
}

function cleanupPixiWorldRootExtras() {
    if (!pixiWorldRoot) return;
    const keep = new Set();
    if (pixiAsteroidLayer) keep.add(pixiAsteroidLayer);
    if (pixiPickupLayer) keep.add(pixiPickupLayer);
    if (pixiPlayerLayer) keep.add(pixiPlayerLayer);
    if (pixiBaseLayer) keep.add(pixiBaseLayer);
    if (pixiEnemyLayer) keep.add(pixiEnemyLayer);
    if (pixiBossLayer) keep.add(pixiBossLayer);
    if (pixiVectorLayer) keep.add(pixiVectorLayer);
    if (pixiBulletLayer) keep.add(pixiBulletLayer);
    if (pixiParticleLayer) keep.add(pixiParticleLayer);

    for (let i = pixiWorldRoot.children.length - 1; i >= 0; i--) {
        const child = pixiWorldRoot.children[i];
        if (!keep.has(child)) {
            try { if (child.parent) child.parent.removeChild(child); } catch (e) { }
            try { if (typeof child.destroy === 'function') child.destroy({ children: true }); } catch (e) { }
        }
    }
}
const healthFill = document.getElementById('health-fill');
const overlayMessage = document.getElementById('overlay-message');
const warpStatus = document.getElementById('warp-status');
const warpFill = document.getElementById('warp-fill');
const turboStatus = document.getElementById('turbo-status');
const turboFill = document.getElementById('turbo-fill');
const xpFill = document.getElementById('xp-fill');
const fpsCounterEl = document.getElementById('fps-counter');
let fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let fpsSmoothMs = 16.7;
let fpsNextUiAt = 0;
let fpsUiVisible = null;
let posUiNextAt = 0;

// Fixed-timestep simulation (decouple simulation from render FPS)
// SIM_FPS, SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME imported from ./core/constants.js
let simAccMs = 0;
let simNowMs = 0;
let simLastPerfAt = 0;
const getGameNowMs = () => (typeof simNowMs === 'number' && simNowMs > 0) ? simNowMs : Date.now();
let renderAlpha = 1.0; // Global render interpolation alpha (0-1)
let shakeOffsetX = 0;
let shakeOffsetY = 0;
let suppressWarpGateUntil = 0;
let suppressWarpInputUntil = 0;

let width, height;
let animationId;
let gameActive = false;
let gamePaused = false;
let canResumeGame = false; // Only true after quitting to menu from pause menu

// ZOOM_LEVEL imported from ./core/constants.js
let currentZoom = ZOOM_LEVEL;

// Map Entities
let environmentAsteroids = [];
let asteroidRespawnTimers = [];
let baseRespawnTimers = [];

// Camera Shake
let shakeTimer = 0;
let shakeMagnitude = 0;

// Inputs
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false, e: false };
const mouseScreen = { x: 0, y: 0 };
const mouseWorld = { x: 0, y: 0 };
let lastMouseInputAt = 0;
let lastGamepadInputAt = 0;

// Gamepad State
let gamepadIndex = null;
let gpState = {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    fire: false,
    warp: false,
    turbo: false,
    pausePressed: false,
    lastMenuElements: null
};
let usingGamepad = false;
let menuDebounce = 0;

function updateInputMode(now = Date.now()) {
    const preferGamepadMs = 1200;
    const mouseGraceMs = 220; // Allow mouse to take over if it moves significantly

    // Strict priority: if aiming with stick (fresh input < 100ms), ignore mouse jitter entirely
    const strictGamepad = (now - lastGamepadInputAt) < 100;

    if (strictGamepad) {
        usingGamepad = true;
    } else {
        const gamepadRecent = (now - lastGamepadInputAt) < preferGamepadMs;
        const mouseRecent = (now - lastMouseInputAt) < mouseGraceMs;
        usingGamepad = gamepadRecent && !mouseRecent;
    }

    if (usingGamepad) document.body.classList.add('no-cursor');
    else document.body.classList.remove('no-cursor');
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;
    if (pixiApp && pixiApp.renderer) {
        pixiApp.renderer.resize(width, height);
    }
    if (pixiCaveGridSprite) {
        pixiCaveGridSprite.width = width;
        pixiCaveGridSprite.height = height;
    }
    if (pixiStarTiles && pixiStarTiles.length) {
        for (const t of pixiStarTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = width;
            t.spr.height = height;
        }
    }
    if (pixiNebulaTiles && pixiNebulaTiles.length) {
        for (const t of pixiNebulaTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = width;
            t.spr.height = height;
        }
    }
    initStars();
}

function initStars() {
    starfield = [];
    nebulas = [];
    const count = Math.floor((width * height) / 3000);
    for (let i = 0; i < count; i++) {
        const baseAlpha = Math.random() * 0.4 + 0.05;
        const s = {
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() < 0.95 ? 1 : 2,
            alpha: baseAlpha * 0.5,
            parallax: 0.05 + Math.random() * 0.1
        };
        s.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        starfield.push(s);
    }

    // Nebula backdrop is handled by Pixi (optional). Canvas fallback stays black + stars only.

    // If Pixi is enabled, build/rebuild background sprites once (positions update per-frame).
    if (pixiScreenRoot && pixiApp && pixiApp.renderer) {
        try {
            // Legacy per-star sprites: keep disabled (tiling is faster).
            if (pixiStarLayer) pixiStarLayer.visible = false;

            if (!Array.isArray(pixiStarTiles)) pixiStarTiles = [];
            if (!Array.isArray(pixiNebulaTiles)) pixiNebulaTiles = [];

            if (ENABLE_NEBULA && pixiNebulaLayer) {
                const hexToRgb = (hex) => {
                    const h = (hex >>> 0).toString(16).padStart(6, '0');
                    return {
                        r: parseInt(h.slice(0, 2), 16),
                        g: parseInt(h.slice(2, 4), 16),
                        b: parseInt(h.slice(4, 6), 16)
                    };
                };
                const makeNebulaTileTexture = (tileSize, blobCount, paletteHex) => {
                    const c = document.createElement('canvas');
                    c.width = tileSize;
                    c.height = tileSize;
                    const cctx = c.getContext('2d');
                    cctx.clearRect(0, 0, tileSize, tileSize);
                    cctx.globalCompositeOperation = 'lighter';
                    for (let i = 0; i < blobCount; i++) {
                        const col = hexToRgb(paletteHex[i % paletteHex.length]);
                        const cx = Math.random() * tileSize;
                        const cy = Math.random() * tileSize;
                        const r = tileSize * (0.20 + Math.random() * 0.55);
                        const a = 0.03 + Math.random() * 0.08;
                        for (const ox of [-tileSize, 0, tileSize]) {
                            for (const oy of [-tileSize, 0, tileSize]) {
                                const x = cx + ox;
                                const y = cy + oy;
                                const g = cctx.createRadialGradient(x, y, 0, x, y, r);
                                g.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${a.toFixed(3)})`);
                                g.addColorStop(0.45, `rgba(${col.r},${col.g},${col.b},${(a * 0.35).toFixed(3)})`);
                                g.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
                                cctx.fillStyle = g;
                                cctx.fillRect(0, 0, tileSize, tileSize);
                            }
                        }
                    }
                    cctx.globalCompositeOperation = 'source-over';
                    const vign = cctx.createRadialGradient(tileSize * 0.5, tileSize * 0.5, tileSize * 0.10, tileSize * 0.5, tileSize * 0.5, tileSize * 0.75);
                    vign.addColorStop(0, 'rgba(0,0,0,0)');
                    vign.addColorStop(1, 'rgba(0,0,0,0.18)');
                    cctx.fillStyle = vign;
                    cctx.fillRect(0, 0, tileSize, tileSize);

                    const tex = PIXI.Texture.from(c);
                    try {
                        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
                        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
                    } catch (e) { }
                    return tex;
                };

                const palettes = [
                    [0x0b1020, 0x2a1a5e, 0x4b2ccf, 0x0a5bd6, 0x00c2ff],
                    [0x0b1020, 0x2a2a6e, 0x1c4cff, 0x00d6d6, 0x00aaff],
                    [0x0b1020, 0x3b1366, 0x6a2cff, 0x1c7cff, 0x00b6ff]
                ];
                const idxBase = (typeof sectorIndex === 'number' && isFinite(sectorIndex)) ? (Math.abs(sectorIndex) | 0) : 0;
                const paletteIdx = idxBase % palettes.length;
                const palette = palettes[paletteIdx];

                const nebulaLayers = [
                    { tileSize: 1024, blobs: 9, alphaMult: 1.00, parallax: 0.010 },
                    { tileSize: 768, blobs: 7, alphaMult: 0.66, parallax: 0.018 }
                ];

                const needsNebulaRebuild = (pixiNebulaPaletteIdx !== paletteIdx) || (pixiNebulaTiles.length === 0);
                if (needsNebulaRebuild) {
                    // Rebuild nebula only when the palette changes (sector change) or on first init.
                    const oldNebs = pixiNebulaLayer.removeChildren();
                    for (const spr of oldNebs) {
                        try { spr.destroy({ children: true, texture: false, baseTexture: false }); } catch (e) { }
                    }
                    for (const t of pixiNebulaTiles) {
                        if (t && t.tex) {
                            try { t.tex.destroy(true); } catch (e) { }
                        }
                    }
                    pixiNebulaTiles = [];

                    for (const L of nebulaLayers) {
                        const tex = makeNebulaTileTexture(L.tileSize, L.blobs, palette);
                        const spr = new PIXI.TilingSprite(tex, (typeof width === 'number' && width > 0) ? width : 1, (typeof height === 'number' && height > 0) ? height : 1);
                        const mult = (typeof L.alphaMult === 'number' && isFinite(L.alphaMult)) ? L.alphaMult : 1;
                        spr.alpha = (typeof NEBULA_ALPHA === 'number' && isFinite(NEBULA_ALPHA)) ? (NEBULA_ALPHA * mult) : (0.12 * mult);
                        spr.tint = 0xffffff;
                        spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                        pixiNebulaLayer.addChild(spr);
                        pixiNebulaTiles.push({ spr, tex, parallax: L.parallax });
                    }
                    pixiNebulaPaletteIdx = paletteIdx;
                }
            }

            // Preferred: tiling starfield (no per-star sprite updates)
            if (pixiStarTilingLayer) {
                const makeStarTileTexture = (tileSize, count, minSize, maxSize, minAlpha, maxAlpha) => {
                    const c = document.createElement('canvas');
                    c.width = tileSize;
                    c.height = tileSize;
                    const cctx = c.getContext('2d');
                    cctx.clearRect(0, 0, tileSize, tileSize);
                    for (let i = 0; i < count; i++) {
                        const x = Math.random() * tileSize;
                        const y = Math.random() * tileSize;
                        const sz = (minSize + Math.random() * (maxSize - minSize)) | 0;
                        const a = minAlpha + Math.random() * (maxAlpha - minAlpha);
                        cctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
                        cctx.fillRect(x, y, Math.max(1, sz), Math.max(1, sz));
                    }
                    const tex = PIXI.Texture.from(c);
                    try {
                        // Avoid shimmer/brightness flicker on 1-2px stars while panning.
                        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
                    } catch (e) { }
                    return tex;
                };

                if (pixiStarTiles.length === 0) {
                    const tileSize = 512;
                    const layers = [
                        { count: 260, minSize: 1, maxSize: 2, minAlpha: 0.05, maxAlpha: 0.25, parallax: 0.06 },
                        { count: 70, minSize: 2, maxSize: 3, minAlpha: 0.08, maxAlpha: 0.40, parallax: 0.12 }
                    ];
                    for (const L of layers) {
                        const tex = makeStarTileTexture(tileSize, L.count, L.minSize, L.maxSize, L.minAlpha, L.maxAlpha);
                        const spr = new PIXI.TilingSprite(tex, width, height);
                        spr.alpha = 0.5;
                        spr.tint = 0xffffff;
                        spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                        pixiStarTilingLayer.addChild(spr);
                        pixiStarTiles.push({ spr, tex, parallax: L.parallax });
                    }
                }
            } else if (pixiStarLayer && pixiTextureWhite) {
                // Fallback: per-star sprites
                pixiStarLayer.visible = true;
                for (const s of starfield) {
                    const spr = allocPixiSprite(pixiStarSpritePool, pixiStarLayer, pixiTextureWhite, s.size, 0);
                    spr.alpha = s.alpha;
                    spr.tint = 0xffffff;
                    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                    s._pixiSprite = spr;
                }
            }
        } catch (e) { }
    }
}

function updatePixiBackground(camX, camY) {
    // Update nebula layers (additive blend, very slow parallax)
    if (pixiNebulaTiles && pixiNebulaTiles.length) {
        for (const t of pixiNebulaTiles) {
            const spr = t && (t.sprite || t.spr);
            if (!spr) continue;
            if (spr.width !== width) spr.width = width;
            if (spr.height !== height) spr.height = height;
            const tx = -camX * (t.parallax || 0.012);
            const ty = -camY * (t.parallax || 0.012);
            spr.tilePosition.set(Math.round(tx), Math.round(ty));
        }
    }
    // Update star layers (faster parallax for depth effect)
    if (pixiStarTiles && pixiStarTiles.length) {
        for (const t of pixiStarTiles) {
            const spr = t && (t.sprite || t.spr);
            if (!spr) continue;
            if (spr.width !== width) spr.width = width;
            if (spr.height !== height) spr.height = height;
            const tx = -camX * (t.parallax || 0.08);
            const ty = -camY * (t.parallax || 0.08);
            spr.tilePosition.set(Math.round(tx), Math.round(ty));
        }
        return;
    }
    // Legacy fallback: per-star sprite positioning (disabled)
    if (!pixiStarLayer) return;
    for (const s of starfield) {
        const spr = s && s._pixiSprite;
        if (!spr) continue;
        if (!spr.parent) pixiStarLayer.addChild(spr);
        let x = (s.x - camX * s.parallax) % width;
        let y = (s.y - camY * s.parallax) % height;
        if (x < 0) x += width;
        if (y < 0) y += height;
        spr.position.set(x, y);
    }
}

function updatePixiCaveGrid(camX, camY, zoom, caveActive) {
    if (!pixiCaveGridLayer || !pixiCaveGridSprite) return;
    pixiCaveGridLayer.visible = !!caveActive;
    if (!caveActive) return;
    if (pixiCaveGridSprite.width !== width) pixiCaveGridSprite.width = width;
    if (pixiCaveGridSprite.height !== height) pixiCaveGridSprite.height = height;
    const z = (typeof zoom === 'number' && isFinite(zoom) && zoom > 0) ? zoom : (currentZoom || ZOOM_LEVEL);
    pixiCaveGridSprite.tileScale.set(z);
    pixiCaveGridSprite.tilePosition.set(Math.round(-camX * z), Math.round(-camY * z));
}

function startSectorTransition() {
    sectorTransitionActive = true;
    warpCountdownAt = Date.now() + 10000;
    showOverlayMessage("WARPING TO NEW SECTOR IN 10s", '#0ff', 10000);
    if (overlayTimeout) { clearTimeout(overlayTimeout); overlayTimeout = null; }
    pendingStations = 0;
    nextSpaceStationTime = null;
    radiationStorm = null;
    clearMiniEvent();
    gamePaused = false;
    gameActive = true;
    pendingTransitionClear = true; // clear arrays safely next frame
    dreadManager.timerActive = false;
}

function completeSectorWarp() {
    gameActive = true;
    gamePaused = false;
    sectorTransitionActive = false;
    warpCountdownAt = null;
    sectorIndex++;
    // Heal player
    player.hp = player.maxHp;
    player.invulnerable = 180;
    player.shieldSegments = player.shieldSegments.map(() => 2);
    if (player.maxOuterShieldSegments && player.maxOuterShieldSegments > 0) {
        player.outerShieldSegments = new Array(player.maxOuterShieldSegments).fill(1);
    }
    updateHealthUI();

    // Warp effect
    spawnParticles(player.pos.x, player.pos.y, 40, '#0ff');
    player.pos.x = 0;
    player.pos.y = 0;
    player.vel.x = 0;
    player.vel.y = 0;
    spawnParticles(player.pos.x, player.pos.y, 40, '#0ff');

    // Reset world for new sector
    resetPixiOverlaySprites();
    clearArrayWithPixiCleanup(bullets);
    clearArrayWithPixiCleanup(bossBombs);
    clearArrayWithPixiCleanup(guidedMissiles);
    clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
    clearArrayWithPixiCleanup(coins);
    clearArrayWithPixiCleanup(nuggets);
    clearArrayWithPixiCleanup(environmentAsteroids);
    asteroidRespawnTimers = [];
    baseRespawnTimers = [];
    roamerRespawnQueue = [];
    clearArrayWithPixiCleanup(caches);
    clearArrayWithPixiCleanup(powerups);
    clearArrayWithPixiCleanup(shootingStars);
    clearArrayWithPixiCleanup(drones);
    contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    activeContract = null;
    nextContractAt = Date.now() + 30000;
    radiationStorm = null;
    scheduleNextRadiationStorm(Date.now() + 15000);
    clearMiniEvent();
    nextMiniEventAt = Date.now() + 120000;
    scheduleNextMiniEvent(Date.now() + 20000);
    clearArrayWithPixiCleanup(pois);
    warpCompletedOnce = false;
    caveMode = false;
    caveLevel = null;
    warpGateUnlocked = false;

    // Avoid rebuilding stars/nebula when entering Sector 2 cave (background is hidden there).
    if (sectorIndex !== 2) initStars(); // update nebula palette

    // Sector 2: long cave run instead of open space.
    if (sectorIndex === 2) {
        startCaveSector2();
        dreadManager.timerActive = false;
        dreadManager.timerAt = null;
        cruiserTimerPausedAt = null;
        stopArenaCountdown();
        return;
    }

    generateMap();
    for (let i = 0; i < 3; i++) spawnNewPinwheelRelative(true);
    gunboatRespawnAt = Date.now() + 5000;
    gunboatLevel2Unlocked = true; // level 2 gunboats allowed after warp
    // Restart cruiser timer for the new sector
    dreadManager.timerActive = true;
    cruiserTimerPausedAt = null;
    const firstCruiserGraceMs = 180000; // 3 minutes breathing room after entering a new sector
    const baseDelay = dreadManager.minDelayMs + Math.floor(Math.random() * (dreadManager.maxDelayMs - dreadManager.minDelayMs + 1));
    dreadManager.timerAt = Date.now() + Math.max(firstCruiserGraceMs, baseDelay);

    // Stations for new sector
    pendingStations = 0;
    if (spaceStation) pixiCleanupObject(spaceStation);
    spaceStation = null;
    nextSpaceStationTime = null;
    if (destroyer) pixiCleanupObject(destroyer);
    destroyer = null;
    nextDestroyerSpawnTime = null;
    scheduleNextShootingStar();
    showOverlayMessage("NEW SECTOR ENTERED", '#0ff', 3000);
}

function endGame(elapsedMs) {
    if (gameEnded) return;
    gameEnded = true;
    gameActive = false;
    gamePaused = false;
    canResumeGame = false; // Game ended - can't resume
    stopMusic();
    try {
        depositMetaNuggets();
    } catch (e) { console.warn('meta deposit failed', e); }
    try { saveEndOfRun(); } catch (e) { console.warn('save end of run failed', e); }
    const endEl = document.getElementById('end-screen');
    if (endEl) endEl.style.display = 'block';
    const startEl = document.getElementById('start-screen');
    if (startEl) startEl.style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    const t = document.getElementById('end-time');
    const sc = document.getElementById('end-score');
    const ng = document.getElementById('end-nuggets');
    if (t) t.innerText = formatTime(elapsedMs);
    if (sc) sc.innerText = score;
    if (ng) ng.innerText = spaceNuggets;
    setTimeout(() => {
        const btn = document.getElementById('restart-btn');
        if (btn) btn.focus();
    }, 100);

    // Update resume button state
    if (window.updateResumeButtonState) {
        window.updateResumeButtonState();
    }
}

function handleSpaceStationDestroyed() {
    if (!spaceStation) return;
    const sx = spaceStation.pos.x;
    const sy = spaceStation.pos.y;
    playSound('base_explode');

    spawnLargeExplosion(sx, sy, 3.5);
    spawnParticles(sx, sy, 200, '#fff');
    for (let k = 0; k < 50; k++) coins.push(new Coin(sx + (Math.random() - 0.5) * 200, sy + (Math.random() - 0.5) * 200, 10));
    for (let k = 0; k < 25; k++) nuggets.push(new SpaceNugget(sx + (Math.random() - 0.5) * 220, sy + (Math.random() - 0.5) * 220, 1));
    showOverlayMessage("SPACE STATION DESTROYED - WARP SIGNAL IN 30s", '#f80', 5000);
    pixiCleanupObject(spaceStation);
    spaceStation = null;
    setTimeout(() => {
        warpGateUnlocked = true;
    }, 30000);
    score += 50000;
    if (pendingStations > 0 && !sectorTransitionActive) nextSpaceStationTime = Date.now() + 7000;
}

window.addEventListener('resize', resize);
resize();

function checkDespawn(entity, range = 6000) {
    if (!player) return;
    const dist = Math.hypot(entity.pos.x - player.pos.x, entity.pos.y - player.pos.y);
    if (dist > range) {
        entity.dead = true;
    }
}

let overlayToken = 0;
let overlayPriority = 0;
let overlayLockUntil = 0;

function showOverlayMessage(text, color = '#0ff', duration = 2000, priority = 0) {
    const el = document.getElementById('overlay-message');
    const now = Date.now();
    if (now < overlayLockUntil && priority < overlayPriority) return;

    overlayPriority = priority;
    overlayLockUntil = now + duration;
    overlayToken++;
    const token = overlayToken;

    el.innerText = text;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;
    el.style.display = 'block';
    if (overlayTimeout) clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
        if (overlayToken !== token) return;
        el.style.display = 'none';
        overlayPriority = 0;
        overlayLockUntil = 0;
    }, duration);
}

// Arena countdown system
let arenaCountdownActive = false;
let arenaCountdownInterval = null;
let arenaCountdownTimeLeft = 0;

function startArenaCountdown() {
    if (arenaCountdownActive) return;

    arenaCountdownActive = true;
    arenaCountdownTimeLeft = 10;

    updateArenaCountdownDisplay();
}

function updateArenaCountdownDisplay() {
    const el = document.getElementById('arena-countdown');
    if (!el) return;

    if (arenaCountdownTimeLeft <= 0) {
        el.style.display = 'none';
        return;
    }

    el.innerText = `ARENA FIGHT\n${arenaCountdownTimeLeft}`;
    el.style.display = 'block';

    // Change color and scale based on time remaining
    if (arenaCountdownTimeLeft <= 3) {
        el.style.color = '#f00';
        el.style.textShadow = '0 0 30px #f00, 0 0 60px #f00';
        el.style.fontSize = '64px';
    } else if (arenaCountdownTimeLeft <= 5) {
        el.style.color = '#ff0';
        el.style.textShadow = '0 0 25px #ff0, 0 0 50px #ff0';
        el.style.fontSize = '56px';
    } else {
        el.style.color = '#f80';
        el.style.textShadow = '0 0 20px #f80, 0 0 40px #f80';
        el.style.fontSize = '48px';
    }
}

function stopArenaCountdown() {
    if (arenaCountdownInterval) {
        clearInterval(arenaCountdownInterval);
        arenaCountdownInterval = null;
    }
    arenaCountdownActive = false;
    const el = document.getElementById('arena-countdown');
    if (el) el.style.display = 'none';
}

// --- Map Entities ---
class EnvironmentAsteroid extends Entity {
    constructor(x, y, r, sizeLevel = 3, indestructible = false) {
        super(x, y);
        this._pixiPool = 'asteroid';
        this.radius = r;
        this.sizeLevel = sizeLevel;
        this.indestructible = indestructible;
        this.unbreakable = indestructible; // Set both properties for compatibility
        this.sprite = null;
        this._pixiAsteroidIndex = Math.floor(Math.random() * 12);
        const speed = (Math.random() * 0.4) + 0.2; // doubled for 60Hz
        const angle = Math.random() * Math.PI * 2;
        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;
        this.rotSpeed = (Math.random() - 0.5) * 0.04; // doubled for 60Hz

        this.vertices = [];
        const points = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const rad = r * (0.8 + Math.random() * 0.4);
            this.vertices.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad });
        }
    }

    update(deltaTime = 16.67) {
        // Save previous state for interpolation
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        this.prevAngle = this.angle;

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        const dtFactor = deltaTime / 16.67;
        this.angle += this.rotSpeed * dtFactor;
        // Contract / maze walls should persist until the contract cleans them up.
        // (Older builds used other contractId prefixes; those should despawn normally.)
        const persistentContractWall = !!(this.unbreakable && this.contractId && String(this.contractId).startsWith('C'));
        if (!persistentContractWall) {
            checkDespawn(this, 5000);
        }
    }

    break(noSound = false) {
        if (this.dead) return;
        if (this.unbreakable) return;
        this.dead = true;
        pixiCleanupObject(this);
        // Play quiet destruction sound
        if (!noSound) playSound('asteroid_destroy');
        // previously dropped a coin here; asteroid drops disabled
        const boomScale = Math.max(0.7, Math.min(2.4, (this.radius || 50) / 60));
        spawnAsteroidExplosion(this.pos.x, this.pos.y, boomScale);

        if (this.sizeLevel > 2) {
            const newSize = this.sizeLevel - 1;
            const newR = this.radius * 0.6;
            // Split into ~50% fewer pieces on average (used to always spawn 3).
            const pieces = 3;
            const pieceChance = 0.5;
            let spawned = 0;
            for (let i = 0; i < pieces; i++) {
                if (Math.random() > pieceChance) continue;
                const a = new EnvironmentAsteroid(this.pos.x, this.pos.y, newR, newSize);
                a.vel.x = this.vel.x + (Math.random() - 0.5) * 2;
                a.vel.y = this.vel.y + (Math.random() - 0.5) * 2;
                environmentAsteroids.push(a);
                spawned++;
            }
            // Ensure at least 1 child when splitting.
            if (spawned === 0) {
                const a = new EnvironmentAsteroid(this.pos.x, this.pos.y, newR, newSize);
                a.vel.x = this.vel.x + (Math.random() - 0.5) * 2;
                a.vel.y = this.vel.y + (Math.random() - 0.5) * 2;
                environmentAsteroids.push(a);
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            if (this.sprite && pixiAsteroidSpritePool) {
                releasePixiSprite(pixiAsteroidSpritePool, this.sprite);
                this.sprite = null;
            }
            return;
        }

        // Interpolate position and angle for smooth rendering on high refresh displays
        const rPos = this.getRenderPos(renderAlpha);
        const prevAng = (this.prevAngle !== undefined) ? this.prevAngle : this.angle;
        const rAngle = prevAng + (this.angle - prevAng) * renderAlpha;

        if (pixiAsteroidLayer && pixiTextures && pixiTextures.asteroids && pixiTextures.asteroids.length > 0) {
            let tex;
            let anchor;

            // Use indestructible asteroid texture if available
            if (this.indestructible && asteroidIndestructibleTextureReady && pixiTextures.asteroidIndestructible) {
                tex = pixiTextures.asteroidIndestructible;
                anchor = pixiTextureAnchors.asteroidIndestructible || 0.5;
            } else {
                let idx = 0;
                if (asteroidTexturesExternalReady && pixiTextures.asteroids.length >= 3) {
                    idx = (this.sizeLevel >= 3) ? 0 : (this.sizeLevel === 2 ? 1 : 2);
                } else {
                    idx = (this._pixiAsteroidIndex >>> 0) % pixiTextures.asteroids.length;
                }
                tex = pixiTextures.asteroids[idx] || pixiTextures.asteroids[0];
                anchor = pixiTextureAnchors[`asteroid_${idx}`] || 0.5;
            }

            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiAsteroidSpritePool, pixiAsteroidLayer, tex, null, anchor);
                this.sprite = spr;
            }
            if (spr) {
                spr.texture = tex;
                // Re-apply anchor in case pooled sprite was previously used by a different variant.
                try {
                    if (typeof anchor === 'number') spr.anchor.set(anchor);
                    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') spr.anchor.set(anchor.x, anchor.y);
                } catch (e) { }
                if (!spr.parent) pixiAsteroidLayer.addChild(spr);
                spr.visible = true;
                spr.position.set(rPos.x, rPos.y);
                spr.rotation = rAngle;
                const s = (this.radius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(s);
                const tint = this.indestructible ? 0x00aaff : 0xffffff;
                spr.tint = tint;
                spr.alpha = 1;
                spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                return;
            }
        }

        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.rotate(rAngle);

        // Canvas fallback: draw external asteroid art if present.
        // For indestructible asteroids, use the special texture
        if (this.indestructible && asteroidIndestructibleImage && asteroidIndestructibleImage.naturalWidth > 0) {
            const img = asteroidIndestructibleImage;
            if (img && img.naturalWidth > 0) {
                const denom = Math.max(1, Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                const scale = (this.radius * 2) / denom;
                ctx.save();
                ctx.scale(scale, scale);
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                ctx.restore();
                ctx.restore();
                return;
            }
        } else if (!this.unbreakable && asteroidImages && asteroidTexturesExternalReady) {
            const img = (this.sizeLevel >= 3) ? asteroidImages[0] : (this.sizeLevel === 2 ? asteroidImages[1] : asteroidImages[2]);
            if (img && img.naturalWidth > 0) {
                const denom = Math.max(1, Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                const scale = (this.radius * 2) / denom;
                ctx.save();
                ctx.scale(scale, scale);
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                ctx.restore();
                ctx.restore();
                return;
            }
        }

        if (this.unbreakable) {
            // Indestructible "walls" (used by anomaly maze rings)
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
        }

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }
}

function generateMap() {
    clearArrayWithPixiCleanup(environmentAsteroids);
    asteroidRespawnTimers = [];
    clearArrayWithPixiCleanup(caches);
    clearArrayWithPixiCleanup(pois);
    for (let i = 0; i < 60; i++) {
        spawnOneAsteroidRelative(true);
    }
    spawnExplorationCaches();
    spawnSectorPOIs();
}

function spawnSectorPOIs() {
    if (!player) return;
    const constructors = [DerelictShipPOI, DebrisFieldPOI];

    const placed = [];
    for (let i = 0; i < constructors.length; i++) {
        let placedOne = false;
        for (let attempts = 0; attempts < 40; attempts++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1900 + Math.random() * 2600;
            const x = player.pos.x + Math.cos(angle) * dist;
            const y = player.pos.y + Math.sin(angle) * dist;
            let ok = true;
            for (const p of placed) {
                if (Math.hypot(x - p.x, y - p.y) < 1400) { ok = false; break; }
            }
            if (!ok) continue;
            placed.push({ x, y });
            const C = constructors[i];
            const poi = new C(x, y);
            pois.push(poi);
            placedOne = true;
            break;
        }
        if (!placedOne) {
            // fallback: skip
        }
    }
}

function spawnExplorationCaches() {
    if (!player) return;
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1200 + Math.random() * 2000;
        const cx = player.pos.x + Math.cos(angle) * dist;
        const cy = player.pos.y + Math.sin(angle) * dist;
        caches.push(new ExplorationCache(cx, cy));
    }
}

function spawnOneAsteroidRelative(initial = false) {
    if (!player) return;
    let attempts = 0;
    while (attempts < 50) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const minDist = initial ? 500 : 2000;
        const maxDist = initial ? 3000 : 4000;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const x = player.pos.x + Math.cos(angle) * dist;
        const y = player.pos.y + Math.sin(angle) * dist;
        const r = 50 + Math.random() * 150;

        let safe = true;
        for (let b of pinwheels) {
            if (Math.hypot(x - b.pos.x, y - b.pos.y) < b.shieldRadius + r + 200) safe = false;
        }

        if (safe) {
            // Spawn indestructible asteroids from level 1, 1 for every 20 regular asteroids
            const isIndestructible = Math.random() < 0.05; // 1/20 = 0.05
            const sizeLevel = isIndestructible ? 1 : 3; // Small size for indestructible (reduced by 1)
            // Adjust radius for small indestructible asteroids
            const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
            const asteroid = new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible);
            environmentAsteroids.push(asteroid);
            break;
        }
    }
}

function spawnOneWarpAsteroidRelative(initial = false) {
    if (!player || !warpZone || !warpZone.active) return false;
    let attempts = 0;
    while (attempts < 60) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const minDist = initial ? 600 : 2000;
        const maxDist = initial ? 5200 : 5600;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const x = player.pos.x + Math.cos(angle) * dist;
        const y = player.pos.y + Math.sin(angle) * dist;

        const dxC = x - warpZone.pos.x;
        const dyC = y - warpZone.pos.y;
        const dC = Math.hypot(dxC, dyC);
        const boundary = (warpZone.boundaryRadius || 6200) - 220;
        if (dC > boundary) continue;

        // Size mix: include big rocks like the normal space area.
        const roll = Math.random();
        let r;
        if (roll < 0.14) r = 170 + Math.random() * 60; // large 170..230
        else if (roll < 0.46) r = 110 + Math.random() * 70; // medium 110..180
        else r = 50 + Math.random() * 80; // small 50..130

        // Keep within boundary with its own radius.
        if (dC + r > (warpZone.boundaryRadius || 6200) - 40) continue;

        // Don't spawn directly on top of the player.
        if (Math.hypot(x - player.pos.x, y - player.pos.y) < r + player.radius + 240) continue;

        // Spawn indestructible asteroids from level 1, 1 for every 20 regular asteroids
        const isIndestructible = Math.random() < 0.05; // 1/20 = 0.05
        const sizeLevel = isIndestructible ? 1 : 3; // Small size for indestructible (reduced by 1)
        // Adjust radius for small indestructible asteroids
        const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
        environmentAsteroids.push(new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible));
        return true;
    }
    return false;
}

function rayCast(x1, y1, angle, maxDist) {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    let closest = { hit: false, dist: maxDist, x: x1 + vx * maxDist, y: y1 + vy * maxDist };

    for (let ast of environmentAsteroids) {
        const cx = ast.pos.x;
        const cy = ast.pos.y;
        const r = ast.radius;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = vx * vx + vy * vy;
        const b = 2 * (fx * vx + fy * vy);
        const c = (fx * fx + fy * fy) - r * r;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
            let t = -1;
            if (t1 >= 0 && t1 <= maxDist) t = t1;
            else if (t2 >= 0 && t2 <= maxDist) t = t2;
            if (t >= 0 && t < closest.dist) {
                closest.hit = true;
                closest.dist = t;
                closest.x = x1 + vx * t;
                closest.y = y1 + vy * t;
                closest.obj = ast;
            }
        }
    }
    return closest;
}

// Player sprite is rendered larger than its physics radius; scale shield radii to match visuals.
const PLAYER_SHIELD_RADIUS_SCALE = 1.5;

class Spaceship extends Entity {
    constructor() {
        super(0, 0);
        this.radius = 30;
        this.angle = -Math.PI / 2;
        this.turretAngle = -Math.PI / 2;
        this.baseThrust = 0.60; // quadrupled (0.15 * 4) for 60Hz
        this.baseMaxSpeed = 12.0; // doubled (6.0 * 2) for 60Hz

        // Progression
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 100;
        this.inventory = {}; // Track upgrade tiers

        // Stats
        this.stats = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            shotgunFireRateMult: 1.0,
            rangeMult: 1.0,
            multiShot: 1,
            homing: 0, // 0=none, 1=weak, 2=strong
            shieldRegenRate: 8, // seconds per segment
            hpRegenAmount: 1, // HP per tick
            hpRegenRate: 10, // seconds per tick
            speedMult: 1.0,
            // accelMult and rotMult removed
            slowField: 0, // Radius
            slowFieldDuration: 0
        };

        this.magnetRadius = 150;

        this.thrustPower = this.baseThrust;
        this.rotationSpeed = 0.12; // doubled for 60Hz
        this.friction = 0.98; // 0.99^2 for 60Hz logic to stay same real-time speed
        this.maxSpeed = this.baseMaxSpeed; // Correctly uses 12.0 now

        this.invulnerable = 90; // halved for 60Hz
        this.visible = true;
        this.maxHp = 25;  // starting health hp
        this.hp = this.maxHp;

        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.lastHpRegenTime = Date.now();

        this.shieldRadius = 45 * PLAYER_SHIELD_RADIUS_SCALE;
        this.maxShieldSegments = 8;
        this.shieldSegments = new Array(8).fill(2);
        this.shieldRotation = 0;
        this.shieldsDirty = true;
        this._pixiInnerShieldGfx = null;
        this._pixiOuterShieldGfx = null;

        // Optional outer shield ring (separate from the main shield)
        this.outerShieldRadius = this.shieldRadius + (26 * PLAYER_SHIELD_RADIUS_SCALE);
        this.maxOuterShieldSegments = 0;
        this.outerShieldSegments = [];
        this.outerShieldRotation = 0;

        this.baseFireDelay = 12;
        this.fireDelay = 12;
        this.autofireTimer = 0;
        this.baseShotgunDelay = 30;  // shotgun fire rate (lower = faster)
        this.shotgunDelay = this.baseShotgunDelay;
        this.shotgunTimer = 0;
        this.turretLevel = 1;

        this.staticWeapons = []; // Array of objects {type: 'forward'|'side'|'rear'}

        this.canWarp = false;
        this.warpCooldown = 0;
        this.maxWarpCooldown = 180;

        // Special CDs
        this.nukeUnlocked = false;
        this.nukeCooldown = 0;
        this.nukeMaxCooldown = 600; // Default 10s
        this.nukeDamage = 5;
        this.nukeRange = 500;
        this.slowField = 0; // 0 or radius

        this.missileTimer = 0;

        // Invincibility Phase Shield
        this.invincibilityCycle = {
            unlocked: false,
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 0, cooldown: 0, regen: false }
        };

        // Turbo boost (activated by E / gamepad X)
        this.turboBoost = {
            // Stock ship has a small turbo (upgrades extend duration).
            unlocked: true,
            activeFrames: 0,
            cooldownFrames: 0,
            durationFrames: 60, // 1.0s
            cooldownTotalFrames: 600, // fixed 10s cooldown
            speedMult: 1.25, // +25% speed
            buttonHeld: false
        };
    }

    respawn() {
        this.pos.x = 0;
        this.pos.y = 0;
        if (this.prevPos) { this.prevPos.x = 0; this.prevPos.y = 0; }
        this.vel.x = 0;
        this.vel.y = 0;
        this.angle = -Math.PI / 2;
        this.invulnerable = 90; // halved for 60Hz
        this.dead = false;
        this.visible = true;
        this.hp = this.maxHp;
        this.lastAsteroidHitTime = 0;
        this.lastArenaDamageTime = 0;
        this.lastShieldRegenTime = Date.now();
        this.shieldSegments = new Array(this.maxShieldSegments).fill(2);
        this.shieldsDirty = true;
        this.outerShieldSegments = (this.maxOuterShieldSegments > 0) ? new Array(this.maxOuterShieldSegments).fill(1) : [];
        this.warpCooldown = 0;
        this.nukeCooldown = 0;
        this.invincibilityCycle.state = 'ready';
        this.invincibilityCycle.timer = 0;
        this.turboBoost.activeFrames = 0;
        this.turboBoost.cooldownFrames = 0;
        this.turboBoost.buttonHeld = false;
        this.shotgunTimer = 0;
        updateHealthUI();
        updateWarpUI();
        updateXpUI();
    }

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
        updateXpUI();
    }

    levelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2);

        // Pause and Show Menu
        playSound('levelup');
        gameActive = false; // Soft pause logic required
        showLevelUpMenu();
    }

    takeHit(damage, ignoreShields = false) {
        if (this.dead || this.invulnerable > 0) return;

        let remaining = Math.max(0, Math.ceil(damage));

        if (!ignoreShields) {
            // Apply damage to outer shields first
            if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                for (let i = 0; i < this.outerShieldSegments.length && remaining > 0; i++) {
                    if (this.outerShieldSegments[i] > 0) {
                        this.outerShieldSegments[i] = 0;
                        remaining -= 1;
                        this.shieldsDirty = true;
                    }
                }
            }

            // Apply damage to main inner shields
            if (this.shieldSegments && this.shieldSegments.length > 0) {
                for (let i = 0; i < this.shieldSegments.length && remaining > 0; i++) {
                    const absorb = Math.min(remaining, this.shieldSegments[i]);
                    this.shieldSegments[i] -= absorb;
                    remaining -= absorb;
                    this.shieldsDirty = true;
                }
            }
        }

        // Hull damage only happens when shields cannot absorb the full hit.
        if (remaining > 0) {
            this.hp -= remaining;
            spawnParticles(this.pos.x, this.pos.y, 14, '#f00');
            playSound('hit');
            updateHealthUI();

            // Screen shake (global variables)
            if (typeof shakeMagnitude !== 'undefined') shakeMagnitude = 10;
            if (typeof shakeTimer !== 'undefined') shakeTimer = 10;

            if (this.hp <= 0) {
                killPlayer();
            } else {
                this.invulnerable = 5;
            }
        } else {
            // Shield absorbed all damage
            playSound('shield_hit');
            spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
            this.invulnerable = 5;
        }
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;

        const dtScale = deltaTime / 16.67;

        this.shieldRotation += 0.02 * dtScale;
        if (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0)) {
            this.outerShieldRotation -= 0.026 * dtScale;
        }

        // Turbo boost timers + activation (E / gamepad X)
        if (this.turboBoost && this.turboBoost.unlocked) {
            if (this.turboBoost.activeFrames > 0) this.turboBoost.activeFrames -= dtScale;
            if (this.turboBoost.cooldownFrames > 0) this.turboBoost.cooldownFrames -= dtScale;
            const turboInput = !(keys.e || gpState.turbo);
            if (turboInput && !this.turboBoost.buttonHeld) {
                if (this.turboBoost.activeFrames <= 0 && this.turboBoost.cooldownFrames <= 0) {
                    this.turboBoost.activeFrames = this.turboBoost.durationFrames;
                    this.turboBoost.cooldownFrames = this.turboBoost.cooldownTotalFrames;
                    playSound('powerup');
                }
            }
            this.turboBoost.buttonHeld = turboInput;
            updateTurboUI();
        }

        let moveX = gpState.move.x;
        let moveY = gpState.move.y;

        if (!usingGamepad) {
            if (keys.w) moveY -= 1;
            if (keys.s) moveY += 1;
            if (keys.a) moveX -= 1;
            if (keys.d) moveX += 1;
        }

        const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
        let thrusting = false;

        const aimMag = Math.sqrt(gpState.aim.x * gpState.aim.x + gpState.aim.y * gpState.aim.y);
        const aimThresh = 0.08;
        const moveAimThresh = 0.08;
        if (usingGamepad) {
            // In gamepad mode, never snap aim back to mouse when sticks go idle.
            if (aimMag > aimThresh) {
                this.turretAngle = Math.atan2(gpState.aim.y, gpState.aim.x);
            } else if (moveMag > moveAimThresh) {
                this.turretAngle = Math.atan2(moveY, moveX);
            }
        } else {
            this.turretAngle = Math.atan2(mouseWorld.y - this.pos.y, mouseWorld.x - this.pos.x);
        }

        // Removed acceleration stat multiplier, using base or 1.0 implicitly
        const turboMult = (this.turboBoost && this.turboBoost.activeFrames > 0) ? (this.turboBoost.speedMult || 1.5) : 1.0;
        const currentThrust = this.thrustPower * turboMult * dtScale; // Scale thrust by time
        if (this.caveSlowFrames === undefined) this.caveSlowFrames = 0;
        if (this.caveSlowMult === undefined) this.caveSlowMult = 1.0;
        if (this.caveSlowFrames > 0) this.caveSlowFrames -= dtScale;
        const slowMult = (this.caveSlowFrames > 0) ? Math.max(0.4, Math.min(1.0, this.caveSlowMult || 0.62)) : 1.0;
        const currentMaxSpeed = this.maxSpeed * this.stats.speedMult * turboMult * slowMult;

        if (moveMag > 0.06) {
            const targetAngle = Math.atan2(moveY, moveX);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.15 * dtScale);
            }
            // Use normalized components for thrust calculation
            const normMoveX = moveX / moveMag;
            const normMoveY = moveY / moveMag;
            const finalMag = Math.min(1.0, moveMag);

            this.vel.x += normMoveX * (currentThrust * finalMag);
            this.vel.y += normMoveY * (currentThrust * finalMag);
            thrusting = true;
        }

        this.fireDelay = this.baseFireDelay / this.stats.fireRateMult;
        this.shotgunDelay = this.baseShotgunDelay / this.stats.shotgunFireRateMult;

        this.autofireTimer -= dtScale;
        this.shotgunTimer -= dtScale;
        if (this.autofireTimer <= 0) {
            this.shoot();
            this.autofireTimer = Math.max(4, this.fireDelay);
        }
        if (this.shotgunTimer <= 0) {
            this.shootShotgun();
            this.shotgunTimer = Math.max(4, this.shotgunDelay);
        }

        // Shield Regen
        if (this.stats.shieldRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastShieldRegenTime > this.stats.shieldRegenRate * 1000) {
                // Regen prioritizes main (inner) shield; once full, it repairs outer shield (if owned).
                const innerIdx = this.shieldSegments.findIndex(s => s < 2);
                if (innerIdx !== -1) {
                    this.shieldSegments[innerIdx] = 2;
                    this.shieldsDirty = true;
                    playSound('powerup'); // Soft sound
                } else if (this.outerShieldSegments && this.outerShieldSegments.length > 0) {
                    const outerIdx = this.outerShieldSegments.findIndex(s => s <= 0);
                    if (outerIdx !== -1) {
                        this.outerShieldSegments[outerIdx] = 1;
                        this.shieldsDirty = true;
                        playSound('powerup'); // Soft sound
                    }
                }
                this.lastShieldRegenTime = now;
            }
        }

        // Hull HP Regen
        if (this.stats.hpRegenAmount > 0 && this.stats.hpRegenRate > 0) {
            const now = Date.now();
            if (now - this.lastHpRegenTime > this.stats.hpRegenRate * 1000) {
                if (this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegenAmount);
                    updateHealthUI();
                    spawnParticles(this.pos.x, this.pos.y, 4, '#0f0');
                }
                this.lastHpRegenTime = now;
            }
        }

        // Auto-Cycling Invincibility Phase Shield
        if (this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtScale;

            if (this.invincibilityCycle.state === 'ready') {
                // Start active phase immediately if ready
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
                // showOverlayMessage("PHASE SHIELD ACTIVE", '#ff0', 1000);
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2; // Sustain invulnerability each frame
                // Tier 3 Regen - check every ~1 second (60 frames at 60fps)
                if (this.invincibilityCycle.stats.regen && Math.floor(this.invincibilityCycle.timer / 60) !== Math.floor((this.invincibilityCycle.timer + dtScale) / 60)) {
                    const emptyIdx = this.shieldSegments.findIndex(s => s < 2);
                    if (emptyIdx !== -1) {
                        this.shieldSegments[emptyIdx] = 2;
                    }
                }

                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'cooldown';
                    this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
                }
            } else if (this.invincibilityCycle.state === 'cooldown') {
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'ready';
                }
            }
        }

        // Warp Sentinel Boss shield collision
        if (bossActive && boss && !boss.dead && player && !player.dead && boss.isWarpBoss) {
            const dx = player.pos.x - boss.pos.x;
            const dy = player.pos.y - boss.pos.y;
            const dist = Math.hypot(dx, dy);

            // Outer shield collision
            const outerShieldsUp = boss.shieldSegments && boss.shieldSegments.some(s => s > 0);
            if (outerShieldsUp && dist < boss.shieldRadius + player.radius && dist > boss.shieldRadius - player.radius * 2) {
                const angle = Math.atan2(dy, dx) - boss.shieldRotation;
                const count = boss.shieldSegments.length;
                const arcLen = (Math.PI * 2) / count;
                const normalizedAngle = angle - Math.floor(angle / arcLen) * arcLen;
                const segIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * count) % count;
                if (boss.shieldSegments[segIndex] > 0) {
                    const pushAngle = Math.atan2(dy, dx);
                    const nx = Math.cos(pushAngle);
                    const ny = Math.sin(pushAngle);
                    const pushForce = 8;
                    player.vel.x += nx * pushForce;
                    player.vel.y += ny * pushForce;
                    spawnParticles((player.pos.x + boss.pos.x) / 2, (player.pos.y + boss.pos.y) / 2, 5, '#0ff');
                    playSound('shield_hit');
                }
            }

            // Inner shield collision
            const innerShieldsUp = boss.innerShieldSegments && boss.innerShieldSegments.some(s => s > 0);
            if (innerShieldsUp && dist < boss.innerShieldRadius + player.radius && dist > boss.innerShieldRadius - player.radius * 2) {
                const angle = Math.atan2(dy, dx) - boss.innerShieldRotation;
                const count = boss.innerShieldSegments.length;
                const arcLen = (Math.PI * 2) / count;
                const normalizedAngle = angle - Math.floor(angle / arcLen) * arcLen;
                const segIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * count) % count;
                if (boss.innerShieldSegments[segIndex] > 0) {
                    const pushAngle = Math.atan2(dy, dx);
                    const nx = Math.cos(pushAngle);
                    const ny = Math.sin(pushAngle);
                    const pushForce = 8;
                    player.vel.x += nx * pushForce;
                    player.vel.y += ny * pushForce;
                    spawnParticles((player.pos.x + boss.pos.x) / 2, (player.pos.y + boss.pos.y) / 2, 5, '#f0f');
                    playSound('shield_hit');
                }
            }
        }

        // Homing Missiles (Separate System)
        if (this.stats.homing > 0) {
            this.missileTimer -= dtScale;
            if (this.missileTimer <= 0) {
                this.fireMissiles();
                this.missileTimer = 30 / this.stats.fireRateMult;
            }
        }

        // Auto Nuke Trigger
        if (this.nukeCooldown > 0) this.nukeCooldown -= dtScale;
        if (this.nukeUnlocked && this.nukeCooldown <= 0) {
            this.fireNuke();
        }

        if (this.canWarp) {
            if (this.warpCooldown > 0) {
                this.warpCooldown -= dtScale;
                updateWarpUI();
            } else if (keys.shift || gpState.warp) {
                if (!suppressWarpInputUntil || getGameNowMs() >= suppressWarpInputUntil) {
                    this.warp();
                }
            }
        }

        if (this.hp <= 3 && Math.random() < 0.1 * dtScale) {
            spawnSmoke(this.pos.x, this.pos.y, 1);
        }

        const speed = this.vel.mag();
        if (speed > currentMaxSpeed) this.vel.mult(currentMaxSpeed / speed);

        if (thrusting) {
            const bx = this.pos.x - Math.cos(this.angle) * 35;
            const bx2 = this.pos.y - Math.sin(this.angle) * 35;
            if (Math.random() > 0.5) spawnParticles(bx, bx2, 1, '#0aa');
        }

        // Time-scaled friction
        // friction^dtScale
        this.vel.mult(Math.pow(this.friction, dtScale));

        super.update(deltaTime);
        checkWallCollision(this, 0.0);

        if (this.invulnerable > 0) {
            this.invulnerable -= dtScale;
            if (this.invincibilityCycle.state === 'active') {
                this.visible = true;
            } else {
                this.visible = true;
            }
        } else {
            this.visible = true;
        }
    }

    fireNuke() {
        shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.nukeDamage, this.nukeRange, { damageAsteroids: true, damageMissiles: true }));
        this.nukeCooldown = this.nukeMaxCooldown;
        //    showOverlayMessage("NUKE DEPLOYED", '#ff0', 1000);
    }

    warp() {
        spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        playSound('warp');
        const angle = Math.random() * Math.PI * 2;
        const dist = 3000 + Math.random() * 2000;
        this.pos.x += Math.cos(angle) * dist;
        this.pos.y += Math.sin(angle) * dist;
        this.vel.x = 0;
        this.vel.y = 0;
        spawnParticles(this.pos.x, this.pos.y, 30, '#0ff');
        this.warpCooldown = this.maxWarpCooldown;
        updateWarpUI();
    }

    fireMissiles() {
        const count = this.stats.homing * 2;
        for (let i = 0; i < count; i++) {
            const angleOffset = (i - (count - 1) / 2) * 0.3;
            const angle = this.turretAngle + angleOffset + (Math.random() - 0.5) * 0.2;
            // Homing strength 2 (strong), damage 1
            const b = new Bullet(this.pos.x, this.pos.y, angle, false, 1, 12, 3, '#f80', 2);
            b.ignoreShields = false; // missiles now respect shields
            b.isMissile = true;
            bullets.push(b);
            spawnSmoke(this.pos.x, this.pos.y, 1);
        }
    }

    shoot() {
        const damage = 2 * this.stats.damageMult; //turret damage
        const bulletSpeed = 15;
        const shots = this.stats.multiShot;

        // DEBUG: Validation
        if (bullets.length > 500) console.warn('[WARN] Bullet count high:', bullets.length);

        // Calculate firing vectors for parallel multi-shot
        const aimX = Math.cos(this.turretAngle);
        const aimY = Math.sin(this.turretAngle);
        const perpX = -aimY; // Right vector
        const perpY = aimX;
        const spacing = 12; // Gap between projectiles

        for (let i = 0; i < shots; i++) {
            // Parallel offset logic
            const offset = (i - (shots - 1) / 2) * spacing;

            const bx = this.pos.x + aimX * 25 + perpX * offset;
            const by = this.pos.y + aimY * 25 + perpY * offset;

            bullets.push(new Bullet(bx, by, this.turretAngle, false, damage, bulletSpeed, 4, null, 0));
            spawnBarrelSmoke(bx, by, this.turretAngle);
        }
        // Player shooting SFX (MP3), rate-limited.
        const now = Date.now();
        if (!this._lastShootSfxAt || (now - this._lastShootSfxAt) >= 100) {
            playSound('shoot', 0.5);
            this._lastShootSfxAt = now;
        }

        // Shotgun Logic
        const shotgunTier = this.inventory['shotgun'] || 0;
        if (shotgunTier > 0 && this.shotgunTimer <= 0) {
            const count = shotgunTier === 1 ? 5 : (shotgunTier === 2 ? 8 : 12);
            const dmg = this.stats.damageMult * 0.7;
            const spread = 0.5;
            const baseShotgunLife = 23;
            const tierRangeMult = 1 + (0.1 * Math.max(0, shotgunTier - 1));

            for (let i = 0; i < count; i++) {
                const a = this.turretAngle + (Math.random() - 0.5) * spread;
                const s = 12 + (Math.random() - 0.5) * 4;
                const b = new Bullet(this.pos.x, this.pos.y, a, false, dmg, s, 3, '#ff0', 0, 'square');
                b.life = (baseShotgunLife * tierRangeMult) * this.stats.rangeMult;
                bullets.push(b);
            }
            // Shotgun uses a soft visual only (no sound)
            spawnBarrelSmoke(this.pos.x, this.pos.y, this.turretAngle);
            this.shotgunTimer = Math.max(4, this.shotgunDelay);
        }

        // Static Weapons
        this.staticWeapons.forEach(w => {
            let angleBase = this.angle;
            if (w.type === 'side') {
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI / 2, false, damage, bulletSpeed, 4, '#0f0'));
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle - Math.PI / 2, false, damage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'rear') {
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI, false, damage, bulletSpeed, 4, '#0f0')); // Rear laser
            } else if (w.type === 'dual_rear') {
                // Dual stream to the rear at angles
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI - Math.PI / 6, false, damage, bulletSpeed, 4, '#0f0'));
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI + Math.PI / 6, false, damage, bulletSpeed, 4, '#0f0'));
            } else if (w.type === 'dual_front') {
                // Dual stream to the front at angles
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle - Math.PI / 6, false, damage, bulletSpeed, 4, '#0f0'));
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle + Math.PI / 6, false, damage, bulletSpeed, 4, '#0f0'));
            } else { // Forward
                bullets.push(new Bullet(this.pos.x, this.pos.y, this.angle, false, damage, bulletSpeed, 4, '#0f0'));
            }
        });
    }

    drawLaser(ctx) {
        if (!this.visible || this.dead) {
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            return;
        }

        // Pixi path (dashed aim laser)
        if (pixiVectorLayer && pixiApp && pixiApp.renderer) {
            const startX = this.pos.x + Math.cos(this.turretAngle) * 25;
            const startY = this.pos.y + Math.sin(this.turretAngle) * 25;
            const hit = rayCast(startX, startY, this.turretAngle, 2000 * this.stats.rangeMult);

            let gfx = this._pixiLaserGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(gfx);
                this._pixiLaserGfx = gfx;
            } else if (!gfx.parent) {
                pixiVectorLayer.addChild(gfx);
            }
            gfx.visible = true;
            gfx.clear();

            const dx = hit.x - startX;
            const dy = hit.y - startY;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const ux = dx / dist;
            const uy = dy / dist;
            const dashLen = 10;
            const gapLen = 20;

            gfx.lineStyle(2, 0x88ffff, 0.5);
            for (let t = 0; t < dist; t += (dashLen + gapLen)) {
                const a0 = t;
                const a1 = Math.min(dist, t + dashLen);
                gfx.moveTo(startX + ux * a0, startY + uy * a0);
                gfx.lineTo(startX + ux * a1, startY + uy * a1);
            }

            gfx.beginFill(0xaaffff, 0.8);
            gfx.drawCircle(hit.x, hit.y, 4);
            gfx.endFill();
            return;
        }
    }

    draw(ctx, alpha = 1.0) {
        if (!this.visible || this.dead) {
            if (this._pixiContainer) this._pixiContainer.visible = false;
            if (this._pixiLaserGfx) {
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
                try { this._pixiLaserGfx.clear(); } catch (e) { }
                this._pixiLaserGfx.visible = false;
            }
            if (this._pixiOuterShieldGfx) {
                try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                this._pixiOuterShieldGfx = null;
            }
            if (this._pixiInnerShieldGfx) {
                try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                this._pixiInnerShieldGfx = null;
            }
            if (this.dead) pixiCleanupObject(this);
            return;
        }

        const rPos = (this.getRenderPos && typeof alpha === 'number') ? this.getRenderPos(alpha) : this.pos;

        // Pixi fast path (player hull/turret/shields)
        if (pixiPlayerLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiPlayerLayer.addChild(container);

                const turbo = new PIXI.Sprite(pixiTextures.player_turbo_flame || pixiTextureWhite);
                const tfA = pixiTextureAnchors.player_turbo_flame || { x: 0.5, y: 0.5 };
                turbo.anchor.set((tfA && tfA.x != null) ? tfA.x : 0.5, (tfA && tfA.y != null) ? tfA.y : 0.5);
                turbo.position.set(0, 0);
                turbo.visible = false;
                turbo.alpha = 0.95;
                turbo.blendMode = PIXI.BLEND_MODES.ADD;
                container.addChild(turbo);
                this._pixiTurboFlameSpr = turbo;

                const hull = new PIXI.Sprite(pixiTextures.player_hull);
                const hA = pixiTextureAnchors.player_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;

                const thr = new PIXI.Sprite(pixiTextures.player_thruster);
                const tA = pixiTextureAnchors.player_thruster || { x: 0.5, y: 0.5 };
                thr.anchor.set((tA && tA.x != null) ? tA.x : 0.5, (tA && tA.y != null) ? tA.y : 0.5);
                thr.position.set(0, 0);
                thr.visible = false;
                container.addChild(thr);
                this._pixiThrusterSpr = thr;

                const turret = new PIXI.Container();
                turret.position.set(0, 0);
                container.addChild(turret);
                this._pixiTurretContainer = turret;

                const turretBase = new PIXI.Sprite(pixiTextures.player_turret_base);
                const tbA = pixiTextureAnchors.player_turret_base || { x: 0.5, y: 0.5 };
                turretBase.anchor.set((tbA && tbA.x != null) ? tbA.x : 0.5, (tbA && tbA.y != null) ? tbA.y : 0.5);
                turret.addChild(turretBase);
                this._pixiTurretBaseSpr = turretBase;

                this._pixiBarrelSprs = [];
            } else if (!container.parent) {
                pixiPlayerLayer.addChild(container);
            }
            container.visible = true;
            container.position.set(rPos.x, rPos.y);

            // Hull
            if (this._pixiHullSpr) {
                // Keep hull texture synced (important for late-loaded external image).
                this._pixiHullSpr.texture = pixiTextures.player_hull;
                const hA = pixiTextureAnchors.player_hull || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.anchor.set((hA && hA.x != null) ? hA.x : 0.5, (hA && hA.y != null) ? hA.y : 0.5);
                this._pixiHullSpr.rotation = (this.angle || 0) + (playerHullExternalReady ? PLAYER_HULL_ROT_OFFSET : 0);
                if (playerHullExternalReady) {
                    const tex = pixiTextures.player_hull;
                    const denom = Math.max(1, Math.max(tex.width || 1, tex.height || 1));
                    const s = (this.radius * 2 * PLAYER_HULL_RENDER_SCALE) / denom;
                    this._pixiHullSpr.scale.set(s);
                } else {
                    this._pixiHullSpr.scale.set(1);
                }
            }

            // Thruster (simple)
            const thrusting = !!(keys.w || (Math.abs(gpState.move.x) > 0.1 || Math.abs(gpState.move.y) > 0.1));
            const turboActive = !!(this.turboBoost && this.turboBoost.activeFrames > 0);
            if (this._pixiTurboFlameSpr) {
                this._pixiTurboFlameSpr.visible = turboActive;
                if (turboActive) {
                    this._pixiTurboFlameSpr.rotation = this.angle;
                    const t = (typeof frameNow === 'number' && frameNow > 0) ? frameNow : Date.now();
                    const flicker = 0.80 + Math.abs(Math.sin(t * 0.02)) * 0.45;
                    this._pixiTurboFlameSpr.scale.set(flicker);
                }
            }
            if (this._pixiThrusterSpr) {
                this._pixiThrusterSpr.visible = thrusting && !turboActive;
                this._pixiThrusterSpr.rotation = this.angle;
                this._pixiThrusterSpr.alpha = 0.9;
            }

            // Turret + barrels
            const turret = this._pixiTurretContainer;
            if (turret) turret.rotation = this.turretAngle;
            const barrels = this._pixiBarrelSprs || (this._pixiBarrelSprs = []);
            const shots = Math.max(1, Math.floor(this.stats && this.stats.multiShot ? this.stats.multiShot : 1));
            while (barrels.length < shots) {
                const spr = new PIXI.Sprite(pixiTextures.player_barrel);
                const bA = pixiTextureAnchors.player_barrel || { x: 0, y: 0.5 };
                spr.anchor.set((bA && bA.x != null) ? bA.x : 0, (bA && bA.y != null) ? bA.y : 0.5);
                turret.addChild(spr);
                barrels.push(spr);
            }
            const spacing = 12 * 1.2;
            for (let i = 0; i < barrels.length; i++) {
                const spr = barrels[i];
                if (!spr) continue;
                if (i < shots) {
                    spr.visible = true;
                    const offset = (shots >= 2) ? ((i - (shots - 1) / 2) * spacing) : 0;
                    spr.position.set(0, offset);
                } else {
                    spr.visible = false;
                }
            }

            // Shields / slow field / phase ring
            if (pixiVectorLayer) {
                const hasOuter = (this.outerShieldSegments && this.outerShieldSegments.some(s => s > 0));
                const hasInner = (this.shieldSegments && this.shieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner || (this.stats && this.stats.slowField > 0) || (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active'));

                if (needs) {
                    // --- STATIC EFFECTS (Phase & Slow Field) ---
                    // Re-drawn every frame as they are simple circles and might pulse/chang size.
                    let gfx = this._pixiGfx;
                    if (!gfx) {
                        gfx = new PIXI.Graphics();
                        pixiVectorLayer.addChild(gfx);
                        this._pixiGfx = gfx;
                    } else if (!gfx.parent) {
                        pixiVectorLayer.addChild(gfx);
                    }
                    gfx.clear();
                    gfx.position.set(this.pos.x, this.pos.y);

                    if (this.invincibilityCycle && this.invincibilityCycle.unlocked && this.invincibilityCycle.state === 'active') {
                        const outerR = (hasOuter ? this.outerShieldRadius : 0);
                        const r = Math.max(this.shieldRadius || 0, outerR || 0) + 14;
                        gfx.lineStyle(3, 0xffdc00, 0.6);
                        gfx.drawCircle(0, 0, r);
                    }

                    if (this.stats && this.stats.slowField > 0) {
                        gfx.lineStyle(2, 0x00c8ff, 0.30);
                        gfx.drawCircle(0, 0, this.stats.slowField);
                    }

                    // --- OUTER SHIELD ---
                    let outerGfx = this._pixiOuterShieldGfx;
                    if (hasOuter) {
                        if (!outerGfx) {
                            outerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(outerGfx);
                            this._pixiOuterShieldGfx = outerGfx;
                            this.shieldsDirty = true;
                        } else if (!outerGfx.parent) pixiVectorLayer.addChild(outerGfx);

                        outerGfx.position.set(this.pos.x, this.pos.y);
                        outerGfx.rotation = this.outerShieldRotation || 0;
                    } else if (outerGfx) {
                        try { outerGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                        outerGfx = null;
                    }

                    // --- INNER SHIELD ---
                    let innerGfx = this._pixiInnerShieldGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerShieldGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(this.pos.x, this.pos.y);
                        innerGfx.rotation = this.shieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                        innerGfx = null;
                    }

                    // --- GEOMETRY REBUILD ---
                    if (this.shieldsDirty) {
                        if (outerGfx && hasOuter) {
                            outerGfx.clear();
                            const outerCount = this.outerShieldSegments.length;
                            const outerAngle = (Math.PI * 2) / outerCount;
                            outerGfx.lineStyle(4, 0xb000ff, 0.9);
                            for (let i = 0; i < outerCount; i++) {
                                if (this.outerShieldSegments[i] > 0) {
                                    // Draw at base angle 0
                                    const a0 = i * outerAngle + 0.08;
                                    const a1 = (i + 1) * outerAngle - 0.08;
                                    outerGfx.moveTo(Math.cos(a0) * this.outerShieldRadius, Math.sin(a0) * this.outerShieldRadius);
                                    outerGfx.arc(0, 0, this.outerShieldRadius, a0, a1);
                                }
                            }
                        }

                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;

                            // Iterate segments once to group by alpha if needed, or just multiple lineStyles?
                            // PIXI lineStyle applies to subsequent drawing.
                            // To optimize batches, we can draw all full segments then all damaged ones, but simpler is loop.
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const a0 = i * segAngle + 0.1;
                                    const a1 = (i + 1) * segAngle - 0.1;
                                    const alpha = Math.max(0.15, Math.min(1, v / 2));
                                    innerGfx.lineStyle(3, 0x00ffff, alpha);
                                    innerGfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    innerGfx.arc(0, 0, this.shieldRadius, a0, a1);
                                }
                            }
                        }

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiOuterShieldGfx) {
                        try { this._pixiOuterShieldGfx.destroy(true); } catch (e) { }
                        this._pixiOuterShieldGfx = null;
                    }
                    if (this._pixiInnerShieldGfx) {
                        try { this._pixiInnerShieldGfx.destroy(true); } catch (e) { }
                        this._pixiInnerShieldGfx = null;
                    }
                }
            }

            return;
        }
    }
}

class Shockwave extends Entity {
    constructor(x, y, damage, maxRadius = 500, opts = {}) {
        super(x, y);
        this.damage = damage;
        this.currentRadius = 10;
        this.maxRadius = maxRadius;
        this.speed = 25;
        this.hitList = [];
        this.damagePlayer = !!opts.damagePlayer;
        this.damageBases = !!opts.damageBases;
        this.damageAsteroids = !!opts.damageAsteroids;
        this.damageMissiles = !!opts.damageMissiles;
        this.ignoreEntity = opts.ignoreEntity || null;
        this.color = opts.color || '#ff0';
    }
    update(deltaTime = 16.67) {
        this.currentRadius += this.speed;
        if (this.currentRadius >= this.maxRadius) this.dead = true;

        const targets = [...enemies];
        if (this.damageBases)         targets.push(...pinwheels);
        if (boss && bossActive && !boss.dead) targets.push(boss);
        if (this.damagePlayer && player && !player.dead) targets.push(player);

        for (let e of targets) {
            if (this.ignoreEntity && e === this.ignoreEntity) continue;
            if (e.dead || this.hitList.includes(e)) continue;
            const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (dist < this.currentRadius + e.radius) {
                if (e === player) {
                    player.takeHit(this.damage);
                    this.hitList.push(e);
                } else {
                    e.hp -= this.damage;
                    this.hitList.push(e);
                    playSound('hit');
                    spawnParticles(e.pos.x, e.pos.y, 5, '#ff0');
                    if (e.hp <= 0) e.kill();
                }
            }
        }

        if (this.damageAsteroids) {
            for (let ast of environmentAsteroids) {
                if (!ast || ast.dead) continue;
                if (ast.unbreakable) continue;
                if (this.hitList.includes(ast)) continue;
                const dist = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (dist < this.currentRadius + ast.radius) {
                    ast.break();
                    this.hitList.push(ast);
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    playSound('hit');
                }
            }
        }

        if (this.damageMissiles) {
            for (let m of guidedMissiles) {
                if (!m || m.dead) continue;
                if (this.hitList.includes(m)) continue;
                const dist = Math.hypot(m.pos.x - this.pos.x, m.pos.y - this.pos.y);
                if (dist < this.currentRadius + (m.radius || 15)) {
                    if (typeof m.explode === 'function') m.explode('#ff0');
                    m.dead = true;
                    this.hitList.push(m);
                    spawnParticles(m.pos.x, m.pos.y, 8, '#f80');
                    playSound('hit');
                }
            }
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }
            return;
        }

        const rPos = this.getRenderPos(renderAlpha);

        if (pixiVectorLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                pixiVectorLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.clear();
            const alpha = Math.max(0, 1 - (this.currentRadius / this.maxRadius));
            g.lineStyle(8, colorToPixi(this.color), alpha);
            g.drawCircle(0, 0, this.currentRadius);
            g.position.set(rPos.x, rPos.y);
            return;
        }

        // Canvas fallback removed
    }
}

class CruiserMineBomb extends Entity {
    constructor(owner, angle, maxTravel, damage, blastRadius) {
        super(owner.pos.x, owner.pos.y);
        this.owner = owner;
        this.angle = angle;
        this.speed = 13.0;
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = Math.sin(angle) * this.speed;
        this.radius = 14;
        this.damage = damage;
        this.blastRadius = blastRadius;
        this.maxTravel = maxTravel;
        // Proximity fuse so the mine can detonate early if the player gets too close.
        this.proximityFuseRadius = Math.max(260, Math.min(520, this.blastRadius * 0.55));
        this.startX = this.pos.x;
        this.startY = this.pos.y;
        this.t = 0;

        // Spawn around the cruiser, not on the center
        const off = (owner.radius * 0.75) + 18;
        this.pos.x += Math.cos(angle) * off;
        this.pos.y += Math.sin(angle) * off;
        this.startX = this.pos.x;
        this.startY = this.pos.y;

        this._pixiGfx = null;
    }
    update(deltaTime = 16.67) {
        this.t++;
        this.pos.add(this.vel);

        if (player && !player.dead) {
            const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (d <= this.proximityFuseRadius) {
                this.explode();
                return;
            }
        }

        if (this.t % 2 === 0) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 6,
                this.pos.y + (Math.random() - 0.5) * 6,
                -this.vel.x * 0.05 + (Math.random() - 0.5) * 0.6,
                -this.vel.y * 0.05 + (Math.random() - 0.5) * 0.6,
                '#fa0',
                30
            );
        }

        const travelled = Math.hypot(this.pos.x - this.startX, this.pos.y - this.startY);
        if (travelled >= this.maxTravel) this.explode();
    }
    explode() {
        if (this.dead) return;
        this.dead = true;

        // FIX: Clean up shield graphics BEFORE calling pixiCleanupObject
        // This prevents pixiCleanupObject from missing these
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }

        pixiCleanupObject(this);
        playSound('explode');
        spawnParticles(this.pos.x, this.pos.y, 40, '#fa0');
        shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.damage, this.blastRadius, {
            damagePlayer: true,
            damageBases: true,
            ignoreEntity: this.owner,
            color: '#fa0'
        }));
    }
    draw(ctx) {
        if (this.dead) return;

        const rPos = this.getRenderPos(renderAlpha);

        if (pixiBulletLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                // Glow Halo
                g.beginFill(0xffaa00, 0.4);
                g.drawCircle(0, 0, this.radius * 1.4);
                g.endFill();
                // Main Body
                g.lineStyle(2, 0xffffff, 1);
                g.beginFill(0xffaa00, 1);
                g.drawCircle(0, 0, this.radius);
                g.endFill();

                pixiBulletLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.position.set(rPos.x, rPos.y);
            g.rotation = this.t * 0.1;
            return;
        }
    }
}

class FlagshipGuidedMissile extends Entity {
    constructor(owner) {
        super(owner.pos.x, owner.pos.y);
        this.owner = owner || null;
        this.t = 0;
        this.radius = 28;
        this.hp = 10;
        this.maxHp = 10;
        // Updated for 60Hz: player speed is ~12, so missiles must be faster.
        this.speed = 11.0;
        this.turnRate = 0.085;
        this.lifeMs = 5000;
        this.angle = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;

        const off = (owner && owner.radius) ? (owner.radius * 0.85 + 14) : 60;
        this.pos.x += Math.cos(this.angle) * off;
        this.pos.y += Math.sin(this.angle) * off;

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
    }

    explode(color = '#fa0') {
        if (this._exploded) return;
        this._exploded = true;
        this.dead = true;
        playSound('explode');
        spawnFieryExplosion(this.pos.x, this.pos.y, 1.2);
    }

    applyDamageToPlayer(amount) {
        if (!player || player.dead) return;
        if (player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
            for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                if (player.outerShieldSegments[i] > 0) {
                    player.outerShieldSegments[i] = 0;
                    remaining -= 1;
                }
            }
        }

        if (player.shieldSegments && player.shieldSegments.length > 0) {
            for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                const absorb = Math.min(remaining, player.shieldSegments[i]);
                player.shieldSegments[i] -= absorb;
                remaining -= absorb;
            }
        }

        if (remaining > 0) {
            player.hp -= remaining;
            spawnParticles(player.pos.x, player.pos.y, 14, '#f00');
            playSound('hit');
            updateHealthUI();
            if (player.hp <= 0) killPlayer();
        } else {
            playSound('shield_hit');
            spawnParticles(player.pos.x, player.pos.y, 10, '#0ff');
        }
        player.invulnerable = 22;
    }

    takeHit(damage) {
        if (this.dead) return;
        const d = Math.max(0, damage || 0);
        this.hp -= d;
        spawnParticles(this.pos.x, this.pos.y, 6, '#ff0');
        playSound('shield_hit');
        if (this.hp <= 0) this.explode('#ff0');
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        this.lifeMs -= deltaTime;
        if (this.lifeMs <= 0) { this.explode(); return; }
        if (!player || player.dead) { this.explode(); return; }

        const targetAngle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const dtFactor = deltaTime / 16.67;
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate * dtFactor);

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        if (this.t % 2 === 0) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 6,
                this.pos.y + (Math.random() - 0.5) * 6,
                -this.vel.x * 0.08 + (Math.random() - 0.5) * 0.6,
                -this.vel.y * 0.08 + (Math.random() - 0.5) * 0.6,
                '#fa0',
                30
            );
        }

        checkWallCollision(this, 0.15);

        // Collide with asteroids / ships: explode and deal damage (splash) to enemies. 
        const splashDamageEnemies = () => {
            const dmg = Math.max(0, Math.ceil(this.hp));
            if (dmg <= 0) return;
            const splashR = 180;
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.dead) continue;
                const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (d < splashR + (e.radius || 0)) {
                    e.hp -= dmg;
                    spawnParticles(e.pos.x, e.pos.y, 10, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                }
            }
        };

        try {
            const nearby = asteroidGrid ? asteroidGrid.query(this.pos.x, this.pos.y) : [];
            for (let i = 0; i < nearby.length; i++) {
                const ast = nearby[i];
                if (!ast || ast.dead) continue;
                const d = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (d < (ast.radius || 0) + this.radius) {
                    if (typeof ast.break === 'function') ast.break();
                    this.explode('#fa0');
                    splashDamageEnemies();
                    return;
                }
            }
        } catch (e) { }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead) continue;
            const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (d < (e.radius || 0) + this.radius) {
                this.explode('#fa0');
                splashDamageEnemies();
                return;
            }
        }

        const dP = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dP < player.radius + this.radius) {
            const dmg = Math.max(0, Math.ceil(this.hp));
            this.explode('#fa0');
            this.applyDamageToPlayer(dmg);
            shakeMagnitude = Math.max(shakeMagnitude, 10);
            shakeTimer = Math.max(shakeTimer, 10);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }
            return;
        }

        const rPos = this.getRenderPos(renderAlpha);

        if (pixiBulletLayer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBulletLayer.addChild(container);

                // Setup graphics (One-time)
                const g = new PIXI.Graphics();
                const len = 64;
                const w = 18;

                // Glow Halo
                g.beginFill(0xffaa00, 0.4);
                g.drawEllipse(0, 0, len * 1.2 / 2, w * 1.4 / 2); // Approximate
                g.endFill();

                // Main Body (Gradient approximation)
                g.beginFill(0xffaa00); // Solid color as gradient is hard in Graphics
                g.lineStyle(2, 0x111111);
                g.moveTo(len / 2, 0);
                g.lineTo(-len / 2 + 10, w / 2);
                g.lineTo(-len / 2, 0);
                g.lineTo(-len / 2 + 10, -w / 2);
                g.closePath();
                g.endFill();

                // Fins
                g.lineStyle(0);
                g.beginFill(0xcc3333);
                // Fin 1
                g.moveTo(-len / 2 + 14, w / 2);
                g.lineTo(-len / 2 - 2, w / 2 + 8);
                g.lineTo(-len / 2 + 8, w / 2 - 2);
                g.closePath();
                // Fin 2
                g.moveTo(-len / 2 + 14, -w / 2);
                g.lineTo(-len / 2 - 2, -w / 2 - 8);
                g.lineTo(-len / 2 + 8, -w / 2 + 2);
                g.closePath();
                g.endFill();

                // Engine Glow
                g.beginFill(0xff7800, 0.8);
                g.drawRect(-len / 2 - 10, -5, 14, 10);
                g.endFill();

                container.addChild(g);
                this._pixiGfx = g; // Keep ref if needed
            }

            container.position.set(rPos.x, rPos.y);
            container.rotation = this.angle;
            // No easy HP ring update in this structure without redraw, skipping or could add another Gfx
            return;
        }
    }
}

class Destroyer2GuidedMissile extends FlagshipGuidedMissile {
    constructor(owner) {
        super(owner);
        this.radius = Math.max(1, this.radius * 2);
        this.hp = Math.max(1, this.hp * 2);
        this.maxHp = this.hp;
    }
}

class ShootingStar extends Entity {
    constructor() {
        super(0, 0);
        const angle = Math.random() * Math.PI * 2;
        const dist = 2500; // Start far out
        this.pos.x = player.pos.x + Math.cos(angle) * dist;
        this.pos.y = player.pos.y + Math.sin(angle) * dist;

        // Aim somewhat near the player
        const targetX = player.pos.x + (Math.random() - 0.5) * 1000;
        const targetY = player.pos.y + (Math.random() - 0.5) * 1000;
        const travelAngle = Math.atan2(targetY - this.pos.y, targetX - this.pos.x);

        this.vel.x = Math.cos(travelAngle) * 15; // 50% slower
        this.vel.y = Math.sin(travelAngle) * 15;

        this.radius = 40;
        this.damage = 10;
        this.hp = 3;
        this.life = 300; // 5 seconds at 60fps
        this._pixiGfx = null;
    }

    update(deltaTime = 16.67) {
        // Use Entity.update for scaled movement
        super.update(deltaTime);
        const dtFactor = deltaTime / 16.67;
        this.life -= dtFactor;
        if (this.life <= 0) this.kill(false);

        // Trail
        for (let i = 0; i < 5; i++) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 20,
                this.pos.y + (Math.random() - 0.5) * 20,
                -this.vel.x * 0.2 + (Math.random() - 0.5) * 2,
                -this.vel.y * 0.2 + (Math.random() - 0.5) * 2,
                '#ffaa00',
                30
            );
        }
    }

    takeHit(dmg = 1) {
        if (this.dead) return;
        this.hp -= dmg;
        if (this.hp <= 0) this.kill(true);
    }

    kill(dropNugz = false) {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        if (dropNugz) {
            spawnAsteroidExplosion(this.pos.x, this.pos.y, 1.4);
            const count = Math.floor(Math.random() * 7);
            for (let i = 0; i < count; i++) {
                nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 80, this.pos.y + (Math.random() - 0.5) * 80, 1));
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const rPos = this.getRenderPos(renderAlpha);

        if (pixiBulletLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                // Simple glowing ball
                g.beginFill(0xffffff, 0.2); // Outer
                g.drawCircle(0, 0, 40);
                g.beginFill(0xffaa00, 0.4); // Mid
                g.drawCircle(0, 0, 25);
                g.beginFill(0xffffff, 0.8); // Core
                g.drawCircle(0, 0, 10);

                pixiBulletLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.position.set(rPos.x, rPos.y);
            return;
        }
    }
}

class Bullet extends Entity {
    constructor(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        super(x, y);
        this._poolType = 'bullet';
        this.sprite = null;
        this.init(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape);
    }
    init(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        this.pos.x = x; this.pos.y = y;
        // Initialize prevPos for interpolation
        if (this.prevPos) { this.prevPos.x = x; this.prevPos.y = y; }
        this.speed = speed * 2; // Doubled for 60Hz
        this.angle = angle;
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = Math.sin(angle) * this.speed;
        this.isEnemy = isEnemy;
        this.damage = damage;
        this.radius = radius;
        this.life = 50 * player.stats.rangeMult; // 100 / 2
        this.color = color;
        this.homing = homing;
        this.ignoreShields = false;
        this.isMissile = false;
        this.shape = shape;
        this.dead = false;
        this.sprite = null;
    }
    reset(x, y, angle, isEnemy, damage = 1, speed = 10, radius = 4, color = null, homing = 0, shape = null) {
        return this.init(x, y, angle, isEnemy, damage, speed, radius, color, homing, shape);
    }
    update(deltaTime = 16.67) {
        // Homing Logic
        if (this.homing > 0 && !this.isEnemy) {
            let target = null;
            let minDist = Infinity;
            const acquireRange = 8000;

            const consider = (obj) => {
                if (!obj || obj.dead || !obj.pos) return;
                const d = Math.hypot(obj.pos.x - this.pos.x, obj.pos.y - this.pos.y);
                if (d < minDist && d <= acquireRange) { minDist = d; target = obj; }
            };

            for (let e of enemies) consider(e);
            if (bossActive && boss && !boss.dead) consider(boss);
            if (pinwheels && pinwheels.length > 0) for (let b of pinwheels) consider(b);
            if (spaceStation && !spaceStation.dead) consider(spaceStation);
            if (destroyer && !destroyer.dead) consider(destroyer);
            if (contractEntities && contractEntities.wallTurrets && contractEntities.wallTurrets.length > 0) {
                for (let t of contractEntities.wallTurrets) consider(t);
            }
            if (warpZone && warpZone.active && warpZone.turrets && warpZone.turrets.length > 0) {
                for (let t of warpZone.turrets) consider(t);
            }
            if (caveMode && caveLevel && caveLevel.active && caveLevel.wallTurrets && caveLevel.wallTurrets.length > 0) {
                for (let t of caveLevel.wallTurrets) consider(t);
            }

            if (target) {
                const targetAngle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                const dtFactor = deltaTime / 16.67;
                const turnRate = (this.homing === 2 ? 0.4 : 0.1) * dtFactor;
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);

                this.vel.x = Math.cos(this.angle) * this.speed;
                this.vel.y = Math.sin(this.angle) * this.speed;
            }
        }

        super.update(deltaTime);
        const scale = deltaTime / 16.67;
        this.life -= scale;

        // Bomb explosion when life expires
        if (this.life <= 0) {
            if (this.isBomb && this.explosionRadius > 0) {
                // Create explosion effect
                spawnFieryExplosion(this.pos.x, this.pos.y, 1.5);
                playSound('explode');

                // Damage player if within explosion radius
                if (player && !player.dead) {
                    const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
                    if (dist < this.explosionRadius) {
                        const dmg = this.explosionDamage || 5;
                        player.takeHit(dmg);
                    }
                }
            }
            this.dead = true;
        }
    }
    draw(ctx) {
        if (this.dead) return;

        // Interpolate position for smooth rendering on high refresh displays
        const rPos = this.getRenderPos(renderAlpha);

        // Pixi Rendering
        if (pixiBulletLayer && pixiBulletTextures.glow) {
            let spr = this.sprite;
            let texture = pixiBulletTextures.glow;
            let size = (this.radius || 4) * 2;
            const isLaser = (!this.isEnemy && this.shape !== 'square' && !this.isMissile);

            if (this.isMissile) {
                texture = pixiBulletTextures.missile;
                size = 20; // Fixed size for missile sprite
            } else if (this.shape === 'square') {
                texture = pixiBulletTextures.square;
            } else if (isLaser) {
                texture = pixiBulletTextures.laser;
            }

            if (!spr) {
                // Ensure we have a valid texture before alloc
                if (texture) {
                    spr = allocPixiSprite(pixiBulletSpritePool, pixiBulletLayer, texture, size);
                    this.sprite = spr;
                    this._poolType = 'bullet'; // Tag for cleanup to know which pool to return to
                } else {
                    if (Math.random() < 0.01) console.warn('[BULLET DRAW] No texture selected!', this);
                }
            }
            if (spr) {
                spr.texture = texture;
                if (!spr.parent) pixiBulletLayer.addChild(spr);
                spr.visible = true;
                spr.position.set(rPos.x, rPos.y);
                spr.rotation = this.angle;
                spr.blendMode = PIXI.BLEND_MODES.ADD;

                if (this.isMissile) {
                    spr.width = size;
                    spr.height = size;
                    // Missiles act like they have their own colors usually, but apply tint just in case
                    spr.tint = 0xffffff;
                } else if (isLaser) {
                    spr.width = size * 6;
                    spr.height = size * 3.5;
                    spr.tint = colorToPixi(this.color || (this.isEnemy ? '#f00' : '#ff0'));
                } else {
                    spr.width = size * 4;
                    spr.height = size * 4;
                    spr.tint = colorToPixi(this.color || (this.isEnemy ? '#f00' : '#ff0'));
                }
                spr.alpha = 1;
                return;
            } else {
                if (Math.random() < 0.01) console.error('[BULLET DRAW] Sprite alloc failed or missing!', this);
            }
        }
        // No Canvas fallback intended for final release. 
    }
}


class Enemy extends Entity {
    constructor(type = 'roamer', startPos = null, assignedBase = null, opts = {}) {
        super(0, 0);
        this._pixiPool = 'enemy';
        this.type = type;
        this.assignedBase = assignedBase;
        this.shieldSegments = [];
        this.shieldRadius = 0;
        this.shieldRotation = 0;
        this.modifier = null;
        this.nameTag = null;
        this.sprite = null;
        this._pixiGfx = null;
        this._pixiInnerGfx = null;
        this.shieldsDirty = true;
        this._pixiNameText = null;
        this.freezeTimer = 0;
        this.freezeCooldown = 0;

        if (startPos) {
            this.pos.x = startPos.x;
            this.pos.y = startPos.y;
        } else {
            const start = findSpawnPointRelative(true);
            this.pos.x = start.x;
            this.pos.y = start.y;
        }

        this.radius = 20;
        const speedMult = 1 + (difficultyTier - 1) * 0.1;
        this.thrustPower = 0.72 * speedMult; // quadrupled (0.18 * 4) for 60Hz
        this.maxSpeed = 13.6 * speedMult; // doubled (6.8 * 2) for 60Hz
        this.rotationSpeed = 0.1; // 0.05 * 2
        this.friction = 0.94; // 0.97^2 approx 0.941

        if (this.type === 'roamer') {
            this.hp = 1;
        } else if (this.type === 'elite_roamer') {
            this.hp = 6 + (difficultyTier * 2);
            this.shieldSegments = new Array(6).fill(1);
            this.shieldRadius = 26; // reduced 25%
            this.radius = 19; // reduced 25% (was 25)
            this.maxSpeed *= 1.05;
        } else if (this.type === 'hunter') {
            this.hp = 12 + (difficultyTier * 3);
            this.radius = Math.round(22 * 1.35 * 0.75); // reduced 25%
            this.maxSpeed = 13.0 + (difficultyTier * 0.5); // doubled
            this.thrustPower = 1.2; // quadrupled (0.3 * 4)
            this.shieldSegments = new Array(4).fill(1);
            this.shieldRadius = Math.round(30 * 1.35 * 0.75); // reduced 25%
            this.shootTimer = 20; // 40 / 2
        } else {
            this.hp = 5 + (difficultyTier - 1) * 2;
        }

        this.shootTimer = 40; // 80 / 2
        if (this.type === 'elite_roamer' || this.type === 'hunter') this.shootTimer = 30; // 60 / 2

        // Named elite modifiers
        if (this.type === 'elite_roamer' || this.type === 'hunter') {
            const mods = ['explosive', 'split', 'stealth'];
            if (Math.random() < 0.12) {
                this.modifier = mods[Math.floor(Math.random() * mods.length)];
                const names = ['NOVA', 'SHADE', 'VIPER', 'TITAN', 'EMBER', 'PHANTOM', 'ION'];
                this.nameTag = names[Math.floor(Math.random() * names.length)];
                this.hp += 2; // slight buff for named elites
            }
        }

        if (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter' || this.type === 'defender') {
            const sizeMult = 3;
            this.radius = Math.round(this.radius * sizeMult);
            if (this.shieldRadius) this.shieldRadius = Math.round(this.shieldRadius * sizeMult);
        }

        this.turnSpeed = (Math.PI * 2) / (4 * 60);
        this.smoothDir = new Vector(Math.random(), Math.random());

        this.aiState = 'SEEK';
        this.aiTimer = 0;
        this.freezeTimer = 0;
        this.freezeCooldown = 0;
        this.flankSide = 1;
        this.isGunboat = (type === 'gunboat');
        this.gunboatLevel = 1;
        if (this.isGunboat) {
            const overrideLevel = opts.gunboatLevel;
            this.gunboatLevel = overrideLevel ? overrideLevel : ((difficultyTier >= 4 || (player && player.level >= 6)) ? 2 : 1);
            this.radius = 30; // match player size
            this.hp = this.gunboatLevel === 1 ? 10 : 16;
            this.maxSpeed = 8.0; // doubled
            this.thrustPower = 0.88; // quadrupled (0.22 * 4)
            this.shootTimer = this.gunboatLevel === 1 ? 11 : 9; // ~half
            this.shieldSegments = new Array(10).fill(2);
            this.shieldRadius = 45;
            this.gunboatShieldRecharge = 90; // halved for 60Hz (approx 1.5s)
            const gunboatSizeMult = 3;
            this.radius = Math.round(this.radius * gunboatSizeMult);
            this.shieldRadius = Math.round(this.shieldRadius * gunboatSizeMult);
        }

        // Default bounce; bosses can override
        this.wallElasticity = 0.8;
        // Circle-strafe preference flags (set after gunboat init so all gunboats orbit)
        this.circleStrafePreferred = false;
        if (this.isGunboat) this.circleStrafePreferred = true;
        else if (this.type === 'roamer') this.circleStrafePreferred = Math.random() < 0.3;
        else if (this.type === 'elite_roamer' || this.type === 'hunter') this.circleStrafePreferred = Math.random() < 0.5;
    }

    getAimAngle() {
        if (!player || player.dead) return 0;
        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        if ((this.type === 'elite_roamer' || this.type === 'hunter') && dist < 600) {
            const lead = Math.min(30, dist / 10);
            return Math.atan2(player.pos.y + player.vel.y * lead - this.pos.y, player.pos.x + player.vel.x * lead - this.pos.x);
        }
        return angle;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        // FIX: Clean up shield graphics BEFORE calling pixiCleanupObject
        // This prevents pixiCleanupObject from missing these
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }

        pixiCleanupObject(this);

        if (this.isGunboat) playSound('base_explode');
        else playSound('explode');
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(true); } catch (e) { }
            this._pixiNameText = null;
        }

        // FIX: Mark as dead FIRST before doing anything else
        // This prevents draw() from trying to recreate graphics after cleanup
        if (this.isGunboat) {
            spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);
        } else {
            playSound('explode');
            const boomScale = Math.max(0.9, Math.min(2.6, (this.radius || 30) / 40));
            spawnFieryExplosion(this.pos.x, this.pos.y, boomScale);
        }

        // DROP COINS
        let val = 2;
        let count = 3;
        if (this.type === 'elite_roamer') { val = 3; count = 4; }
        if (this.type === 'hunter') { val = 4; count = 5; }
        if (this.type === 'defender') { val = 3; count = 3; }
        if (this.nameTag) { val += 1; count += 2; }
        const caveActive = (caveMode && caveLevel && caveLevel.active);
        if (caveActive) {
            let total = count * val;
            if (this.isGunboat) total += 10 + (5 * 2);
            // Reduce roamer-style coin income in Level 2.
            if (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter') {
                total = Math.floor(total * 0.75);
            }
            awardCoinsInstant(total, { noSound: false, sound: 'coin' });
        } else {
            if (this.isGunboat) {
                // Gunboat drops: 1 gold coin (value 10) + 5 regular (value 2)
                coins.push(new Coin(this.pos.x, this.pos.y, 10));
                for (let i = 0; i < 5; i++) coins.push(new Coin(this.pos.x, this.pos.y, 2));
            }
            for (let i = 0; i < count; i++) {
                coins.push(new Coin(this.pos.x, this.pos.y, val));
            }
        }
        if (this.nameTag) {
            nuggets.push(new SpaceNugget(this.pos.x, this.pos.y, 1));
        }

        // Sector 2 needs more nugz to match the pace of Sector 1 (no contracts/stations here).
        if (caveActive) {
            let p = 0.08;
            if (this.type === 'defender') p = 0.14;
            else if (this.type === 'elite_roamer') p = 0.12;
            else if (this.type === 'hunter') p = 0.16;
            if (this.isGunboat) p = 0.25;

            if (Math.random() < p) {
                const count = this.isGunboat ? 2 : 1;
                for (let k = 0; k < count; k++) {
                    nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 80, this.pos.y + (Math.random() - 0.5) * 80, 1));
                }
            }
        }

        if (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter') roamerRespawnQueue.push(2000 + Math.floor(Math.random() * 2000));
        if (this.isGunboat) {
            gunboatRespawnAt = Date.now() + 20000;
        }

        if (this.modifier === 'explosive') {
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i;
                bullets.push(new Bullet(this.pos.x, this.pos.y, a, true, 2, 10, 4, '#f80'));
            }
            spawnParticles(this.pos.x, this.pos.y, 20, '#f80');
        }
    }

    update(deltaTime = 16.67) {
        if (!this.despawnImmune) checkDespawn(this, 5000);
        if (this.dead) return;

        const dtFactor = deltaTime / 16.67;

        // Stasis Field Logic (Freeze)
        if (this.freezeTimer > 0) {
            this.freezeTimer -= dtFactor;
            this.vel.x = 0;
            this.vel.y = 0;
            // Skip AI movement when frozen
        } else if (player.stats.slowField > 0 && !this.isCruiser) {
            if (this.freezeCooldown > 0) this.freezeCooldown -= dtFactor;

            const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (dist < player.stats.slowField && this.freezeCooldown <= 0) {
                this.freezeTimer = player.stats.slowFieldDuration;
                this.freezeCooldown = this.freezeTimer + 120; // 2s immunity after freeze
                spawnParticles(this.pos.x, this.pos.y, 5, '#0ff');
            }
        }

        if (this.shieldSegments.length > 0) this.shieldRotation += 0.05 * dtFactor;
        if (this.isGunboat && this.shieldSegments.length > 0 && !this.disableShieldRegen) {
            this.gunboatShieldRecharge -= dtFactor;
            if (this.gunboatShieldRecharge <= 0) {
                const idx = this.shieldSegments.findIndex(s => s < 2);
                if (idx !== -1) {
                    this.shieldSegments[idx] = 2;
                    this.shieldsDirty = true;
                }
                this.gunboatShieldRecharge = 180;
            }
        }

        if (this.hp <= 2 && this.type !== 'roamer') {
            if (Math.random() < 0.1 * dtFactor) spawnSmoke(this.pos.x, this.pos.y, 1);
        }

        this.aiTimer -= dtFactor;
        if (this.aiTimer <= 0) this.updateAIState();

        // Only calculate movement if not frozen
        if (this.freezeTimer <= 0) {

            const desiredVel = new Vector(0, 0);
            const wantsStandoff = (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter' || this.type === 'defender');
            if (this.circleStrafePreferred && this.aiState === 'CIRCLE') {
                if (player && !player.dead) {
                    const dx = player.pos.x - this.pos.x;
                    const dy = player.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    const angleToPlayer = Math.atan2(dy, dx);
                    const orbitDir = 1; // clockwise
                    const targetAngle = angleToPlayer + orbitDir * Math.PI / 2;
                    desiredVel.x = Math.cos(targetAngle);
                    desiredVel.y = Math.sin(targetAngle);
                    // keep preferred distance
                    const preferred = 700;
                    if (dist > preferred + 150) { desiredVel.x += dx * 0.001; desiredVel.y += dy * 0.001; }
                    if (dist < preferred - 150) { desiredVel.x -= dx * 0.001; desiredVel.y -= dy * 0.001; }
                }
            } else if (this.aiState === 'SEEK') {
                if (player && !player.dead) {
                    const dx = player.pos.x - this.pos.x;
                    const dy = player.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    if (wantsStandoff) {
                        // Don't kamikaze: keep space and shoot from range.
                        const keepOut = (this.type === 'hunter') ? 360 : 320;
                        if (dist < keepOut) {
                            desiredVel.x = -dx;
                            desiredVel.y = -dy;
                        } else {
                            desiredVel.x = dx;
                            desiredVel.y = dy;
                        }
                    } else {
                        desiredVel.x = dx;
                        desiredVel.y = dy;
                    }
                }
            } else if (this.aiState === 'ORBIT') {
                if (player && !player.dead) {
                    const dx = player.pos.x - this.pos.x;
                    const dy = player.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx) + (this.type === 'elite_roamer' ? 0.05 : 0.02);
                    desiredVel.x = Math.cos(angle);
                    desiredVel.y = Math.sin(angle);
                    if (dist > 600) { desiredVel.x += dx * 0.001; desiredVel.y += dy * 0.001; }
                    if (dist < 400) { desiredVel.x -= dx * 0.001; desiredVel.y -= dy * 0.001; }
                }
            } else if (this.aiState === 'ATTACK_RUN') {
                if (player && !player.dead) {
                    const dx = player.pos.x - this.pos.x;
                    const dy = player.pos.y - this.pos.y;
                    const dist = Math.hypot(dx, dy);
                    if (wantsStandoff) {
                        // "Attack run" becomes a strafe + maintain-range behavior (no ramming).
                        const preferred = (this.type === 'hunter') ? 620 : 560;
                        const band = 140;
                        if (dist > preferred + band) {
                            desiredVel.x = dx;
                            desiredVel.y = dy;
                        } else if (dist < preferred - band) {
                            desiredVel.x = -dx;
                            desiredVel.y = -dy;
                        } else {
                            const inv = dist > 0.001 ? (1 / dist) : 0;
                            const strafe = this.flankSide || 1;
                            desiredVel.x = (-dy * inv) * strafe;
                            desiredVel.y = (dx * inv) * strafe;
                        }
                    } else {
                        desiredVel.x = dx;
                        desiredVel.y = dy;
                    }
                }
            } else if (this.aiState === 'RETREAT') {
                if (this.assignedBase && !this.assignedBase.dead) {
                    desiredVel.x = this.assignedBase.pos.x - this.pos.x;
                    desiredVel.y = this.assignedBase.pos.y - this.pos.y;
                } else if (player) {
                    desiredVel.x = this.pos.x - player.pos.x;
                    desiredVel.y = this.pos.y - player.pos.y;
                }
            } else if (this.aiState === 'FLANK') {
                if (player && !player.dead) {
                    const dx = player.pos.x - this.pos.x;
                    const dy = player.pos.y - this.pos.y;
                    const angleToPlayer = Math.atan2(dy, dx);
                    // Break off at ~60-90 degrees relative to player direction
                    const targetAngle = angleToPlayer + (this.flankSide * (Math.PI / 2.5));
                    desiredVel.x = Math.cos(targetAngle);
                    desiredVel.y = Math.sin(targetAngle);
                }
            } else if (this.aiState === 'EVADE') {
                if (player) {
                    const dx = this.pos.x - player.pos.x;
                    const dy = this.pos.y - player.pos.y;
                    desiredVel.x = -dy;
                    desiredVel.y = dx;
                }
            }

            if (desiredVel.mag() > 0) desiredVel.normalize();

            if (this.type === 'elite_roamer' || difficultyTier >= 4) {
                const dodgeForce = this.calculateDodge();
                desiredVel.add(dodgeForce);
            }

            const sepForce = new Vector(0, 0);
            let count = 0;
            for (let other of enemies) {
                if (other === this || other.dead) continue;
                let odx = this.pos.x - other.pos.x;
                let ody = this.pos.y - other.pos.y;
                const distSq = odx * odx + ody * ody;
                if (distSq < 10000) {
                    const dist = Math.sqrt(distSq);
                    const force = (100 - dist) / 100;
                    if (dist > 0) {
                        sepForce.x += (odx / dist) * force;
                        sepForce.y += (ody / dist) * force;
                    }
                    count++;
                }
            }
            if (count > 0) { sepForce.mult(1.5); desiredVel.add(sepForce); }

            // Avoid pinwheels/stations/fortresses so we don't rely on collision pushing.
            const avoid = new Vector(0, 0);
            const obstacles = [];
            for (let b of pinwheels) if (b && !b.dead) obstacles.push({ e: b, r: b.radius + 420 });
            if (spaceStation && !spaceStation.dead) obstacles.push({ e: spaceStation, r: spaceStation.radius + 520 });
            if (contractEntities && contractEntities.fortresses) {
                for (let f of contractEntities.fortresses) if (f && !f.dead) obstacles.push({ e: f, r: f.radius + 420 });
            }

            for (let o of obstacles) {
                // Defenders can be assigned to a base; only repel strongly if they get too close.
                const dx = this.pos.x - o.e.pos.x;
                const dy = this.pos.y - o.e.pos.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 0.001) continue;
                const r = o.r;
                if (dist < r) {
                    const t = (r - dist) / r;
                    avoid.x += (dx / dist) * (t * 1.6);
                    avoid.y += (dy / dist) * (t * 1.6);
                }
            }
            if (avoid.mag() > 0) {
                avoid.normalize();
                avoid.mult(0.9);
                desiredVel.add(avoid);
            }

            // Anti-ram spacing: roamers/defenders should avoid colliding with the player.
            if (wantsStandoff && player && !player.dead) {
                const dx = this.pos.x - player.pos.x;
                const dy = this.pos.y - player.pos.y;
                const dist = Math.hypot(dx, dy);
                const keepOut = (this.type === 'hunter') ? 300 : 260;
                if (dist > 0.001 && dist < keepOut) {
                    const t = (keepOut - dist) / keepOut;
                    desiredVel.x += (dx / dist) * (2.2 * t);
                    desiredVel.y += (dy / dist) * (2.2 * t);
                    // Brake a bit so existing momentum doesn't carry into a collision.
                    this.vel.mult(0.92);
                }
            }

            if (desiredVel.mag() > 0) desiredVel.normalize();

            this.smoothDir.x = this.smoothDir.x * 0.92 + desiredVel.x * 0.08;
            this.smoothDir.y = this.smoothDir.y * 0.92 + desiredVel.y * 0.08;

            if (this.smoothDir.mag() > 0.1) {
                const targetAngle = Math.atan2(this.smoothDir.y, this.smoothDir.x);
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                const turnStep = this.turnSpeed * dtFactor;
                if (Math.abs(angleDiff) < turnStep) {
                    this.angle = targetAngle;
                } else {
                    this.angle += Math.sign(angleDiff) * turnStep;
                }
                const forwardX = Math.cos(this.angle);
                const forwardY = Math.sin(this.angle);
                const dirMag = Math.sqrt(this.smoothDir.x * this.smoothDir.x + this.smoothDir.y * this.smoothDir.y);
                const dot = (forwardX * this.smoothDir.x + forwardY * this.smoothDir.y) / (dirMag || 1);
                if (dot > 0.3) {
                    const thrust = this.thrustPower * dtFactor;
                    this.vel.x += forwardX * thrust;
                    this.vel.y += forwardY * thrust;
                }
            }

            let currentMaxSpeed = this.maxSpeed;
            if (this.circleStrafePreferred && this.aiState === 'CIRCLE') {
                currentMaxSpeed *= 1.15;
            } else if (this.aiState === 'FLANK') {
                currentMaxSpeed *= 1.6; // Speed boost when flanking
                if (Math.random() < 0.3) spawnParticles(this.pos.x, this.pos.y, 1, '#fa0'); // Engine flare
            }

            const speed = this.vel.mag();
            if (speed > currentMaxSpeed) this.vel.mult(currentMaxSpeed / speed);
        } // End freeze check

        // friction^dtFactor
        this.vel.mult(Math.pow(this.friction, dtFactor));
        super.update(deltaTime);
        checkWallCollision(this, (typeof this.wallElasticity === 'number') ? this.wallElasticity : 0.8);

        let distToPlayer = Infinity;
        if (player && !player.dead) distToPlayer = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        const attackRange = (this.type === 'elite_roamer' || this.type === 'hunter') ? 800 : 600;

        const gunboatRange = this.isGunboat ? (this.gunboatRange || 900) : attackRange;
        let roamerAsteroidBlocked = false;
        if (!this.isGunboat && (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter' || this.type === 'defender') && player && !player.dead && this.freezeTimer <= 0) {
            const angleToPlayer = this.getAimAngle();
            const hit = rayCast(this.pos.x, this.pos.y, angleToPlayer, distToPlayer);
            if (hit && hit.hit && hit.obj) {
                const buffer = (player.radius || 0) + 10;
                if (hit.dist < distToPlayer - buffer) roamerAsteroidBlocked = true;
            }
        }

        const shouldRoamerClear = roamerAsteroidBlocked && distToPlayer < (attackRange * 1.8);
        if (!this.disableAutoFire && (distToPlayer < gunboatRange || shouldRoamerClear) && !player.dead && this.freezeTimer <= 0) {
            this.shootTimer -= dtFactor;
            if (this.shootTimer <= 0) {
                const angle = this.getAimAngle();
                if (this.isGunboat) {
                    const muzzle = this.gunboatMuzzleDist || 28;
                    const bx = this.pos.x + Math.cos(angle) * muzzle;
                    const by = this.pos.y + Math.sin(angle) * muzzle;
                    const dmg = this.isCruiser ? (this.cruiserBaseDamage || 1) : (this.gunboatLevel === 1 ? 2 : 3);
                    const bulletSpeed = this.isCruiser ? 18 : 22;
                    bullets.push(new Bullet(bx, by, angle, true, dmg, bulletSpeed, 4, '#0ff'));
                    if (this.isCruiser) {
                        // Cruiser twin barrels
                        const a2 = angle + 0.08;
                        bullets.push(new Bullet(bx, by, a2, true, dmg, bulletSpeed, 4, '#0ff'));
                    } else if (this.gunboatLevel === 2) {
                        const a2 = angle + 0.08;
                        bullets.push(new Bullet(bx, by, a2, true, 3, 22, 4, '#0ff'));
                    }
                    spawnBarrelSmoke(bx, by, angle);
                    this.shootTimer = this.isCruiser ? this.cruiserFireDelay || 24 : (this.gunboatLevel === 1 ? 11 : 9);
                } else if (this.type === 'elite_roamer' || this.type === 'hunter') {
                    const bx = this.pos.x + Math.cos(angle) * 25;
                    const by = this.pos.y + Math.sin(angle) * 25;
                    bullets.push(new Bullet(bx, by, angle, true, 1, 11, 5, '#f0f'));
                    if (this.modifier === 'split') {
                        const a2 = angle + (Math.random() - 0.5) * 0.2;
                        bullets.push(new Bullet(bx, by, a2, true, 1, 11, 5, '#f0f'));
                    }
                    spawnBarrelSmoke(bx, by, angle);
                    this.shootTimer = this.type === 'hunter' ? 20 : 30;
                } else if (difficultyTier >= 5 && this.type === 'roamer') {
                    for (let i = -1; i <= 1; i++) {
                        const a = angle + i * 0.2;
                        const bx = this.pos.x + Math.cos(a) * 20;
                        const by = this.pos.y + Math.sin(a) * 20;
                        bullets.push(new Bullet(bx, by, a, true, 1));
                        spawnBarrelSmoke(bx, by, a);
                    }
                    this.shootTimer = 40;
                } else {
                    const bx = this.pos.x + Math.cos(angle) * 20;
                    const by = this.pos.y + Math.sin(angle) * 20;
                    bullets.push(new Bullet(bx, by, angle, true, 1));
                    spawnBarrelSmoke(bx, by, angle);
                    this.shootTimer = 40;
                }
                playSound('shoot');
            }
        }
    }

    updateAIState() {
        if (!player || player.dead) { this.aiState = 'IDLE'; this.aiTimer = 30; return; }
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

        // All roamers (elite/hunter included) should be actively seeking, not waiting
        if (this.circleStrafePreferred) {
            this.aiState = 'CIRCLE';
            this.aiTimer = 45;
        } else if (this.type === 'roamer' || this.type === 'elite_roamer' || this.type === 'hunter') {
            // Check for bunching/crowding
            let neighbors = 0;
            for (let e of enemies) {
                if (e !== this && !e.dead && e.type === 'roamer') {
                    const dSq = (e.pos.x - this.pos.x) ** 2 + (e.pos.y - this.pos.y) ** 2;
                    if (dSq < 40000) neighbors++; // within 200px
                }
            }

            if (neighbors >= 3) {
                this.aiState = 'FLANK';
                this.aiTimer = 45 + Math.random() * 30;
                this.flankSide = Math.random() < 0.5 ? 1 : -1;
            } else if (dist > 800) {
                this.aiState = 'SEEK';
                this.aiTimer = 30;
            } else {
                const roll = Math.random();
                if (roll < 0.6) { this.aiState = 'ORBIT'; this.aiTimer = 120 + Math.random() * 60; }
                else { this.aiState = 'ORBIT'; this.aiTimer = 90 + Math.random() * 45; }
            }
        } else if (this.type === 'defender') {
            if (this.assignedBase && !this.assignedBase.dead) {
                const distBase = Math.hypot(player.pos.x - this.assignedBase.pos.x, player.pos.y - this.assignedBase.pos.y);
                if (distBase < 800) { this.aiState = 'ORBIT'; this.aiTimer = 90; }
                else if (this.hp < 2) { this.aiState = 'RETREAT'; this.aiTimer = 120; }
                else { this.aiState = 'SEEK'; this.aiTimer = 60; }
            } else {
                this.aiState = 'SEEK';
                this.aiTimer = 60;
            }
        }
    }

    calculateDodge() {
        const dodgeVec = new Vector(0, 0);
        for (let b of bullets) {
            if (b.isEnemy) continue;
            const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
            if (dist < 200) {
                const toMeX = this.pos.x - b.pos.x;
                const toMeY = this.pos.y - b.pos.y;
                const dot = toMeX * b.vel.x + toMeY * b.vel.y;
                if (dot > 0) {
                    const perpX = -b.vel.y;
                    const perpY = b.vel.x;
                    dodgeVec.x += perpX;
                    dodgeVec.y += perpY;
                }
            }
        }
        if (dodgeVec.mag() > 0) {
            dodgeVec.normalize();
            dodgeVec.mult(3.0);
        }
        return dodgeVec;
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        // Interpolate position for smooth rendering on high refresh displays
        const rPos = this.getRenderPos(renderAlpha);

        // Pixi fast path for the hot enemy rendering (hulls + shields + name tags).
        if (pixiEnemyLayer && pixiTextures) {
            // Defensive: some bosses change `type` strings (e.g. flagship) but should always render as cruisers.
            if (this.isCruiser || this.type === 'cruiser' || this.type === 'flagship' || this.isFlagship) {
                this.isGunboat = true;
                this.gunboatLevel = 2;
            }
            let tex = null;
            let anchor = 0.5;
            let modelScale = 1;
            let key = null;

            if (this.isGunboat) {
                modelScale = ((this.gunboatScale || 1.4) / 1.4);
                if (this.isCruiser) {
                    tex = pixiTextures.enemy_cruiser;
                    anchor = pixiTextureAnchors.enemy_cruiser || 0.5;
                    key = 'enemy_cruiser';
                } else if (this.gunboatLevel === 2) {
                    tex = pixiTextures.enemy_gunboat_2;
                    anchor = pixiTextureAnchors.enemy_gunboat_2 || 0.5;
                    key = 'enemy_gunboat_2';
                } else {
                    tex = pixiTextures.enemy_gunboat_1;
                    anchor = pixiTextureAnchors.enemy_gunboat_1 || 0.5;
                    key = 'enemy_gunboat_1';
                }
            } else if (this.type === 'elite_roamer') {
                tex = pixiTextures.enemy_elite_roamer;
                anchor = pixiTextureAnchors.enemy_elite_roamer || 0.5;
                key = 'enemy_elite_roamer';
            } else if (this.type === 'hunter') {
                tex = pixiTextures.enemy_hunter;
                anchor = pixiTextureAnchors.enemy_hunter || 0.5;
                key = 'enemy_hunter';
            } else if (this.type === 'defender') {
                tex = pixiTextures.enemy_defender;
                anchor = pixiTextureAnchors.enemy_defender || 0.5;
                key = 'enemy_defender';
            } else {
                tex = pixiTextures.enemy_roamer;
                anchor = pixiTextureAnchors.enemy_roamer || 0.5;
                key = 'enemy_roamer';
            }

            const stealthAlpha = (this.modifier === 'stealth')
                ? (0.4 + Math.abs(Math.sin(Date.now() * 0.003)) * 0.4)
                : 1;

            if (!tex) {
                // Avoid leaving a stale sprite visible (e.g. roamer sprite on a cruiser) if the texture is missing.
                if (this.sprite) {
                    releasePixiEnemySprite(this.sprite);
                    this.sprite = null;
                }
                if (this._pixiGfx) {
                    try { this._pixiGfx.destroy(true); } catch (e) { }
                    this._pixiGfx = null;
                }
                if (this._pixiInnerGfx) {
                    try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                    this._pixiInnerGfx = null;
                }
                if (this._pixiNameText) {
                    try { this._pixiNameText.destroy(true); } catch (e) { }
                    this._pixiNameText = null;
                }
            } else {
                let spr = this.sprite;
                if (spr && key && spr._pixiKey !== key) {
                    releasePixiEnemySprite(spr);
                    spr = null;
                    this.sprite = null;
                }
                if (!spr) {
                    if (!pixiEnemySpritePools[key]) pixiEnemySpritePools[key] = [];
                    spr = allocPixiSprite(pixiEnemySpritePools[key], pixiEnemyLayer, tex, null, anchor);
                    if (spr) spr._pixiKey = key;
                    this.sprite = spr;
                }
                if (spr) {
                    spr.texture = tex;
                    if (!spr.parent) pixiEnemyLayer.addChild(spr);
                    if (typeof anchor === 'number') spr.anchor.set(anchor);
                    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') spr.anchor.set(anchor.x, anchor.y);
                    spr.visible = true;
                    spr.position.set(rPos.x, rPos.y);
                    spr.rotation = (this.angle || 0) + (pixiTextureRotOffsets[key] || 0);
                    let effectiveScale = modelScale;
                    if (pixiTextureScaleToRadius[key]) {
                        const denom = Math.max(1, Math.max(tex.width || 1, tex.height || 1));
                        effectiveScale = (this.radius * 2) / denom;
                    }
                    effectiveScale *= (pixiTextureBaseScales[key] || 1);
                    spr.scale.set(effectiveScale);
                    spr.alpha = stealthAlpha;
                    spr.tint = (this.freezeTimer > 0) ? 0x00ffff : 0xffffff;
                    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                }
            }

            // Shields + freeze indicator (Graphics)
            const hasOuter = (this.shieldSegments && this.shieldSegments.length > 0);
            const hasInner = (this.innerShieldSegments && this.innerShieldSegments.length > 0);
            const needsGfx = !!(hasOuter || hasInner || (this.freezeTimer > 0 && hasOuter));

            if (needsGfx && pixiVectorLayer) {
                // --- Outer Shield & Freeze Highlight ---
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.position.set(rPos.x, rPos.y);
                gfx.alpha = stealthAlpha;

                // --- Inner Shield ---
                let innerGfx = this._pixiInnerGfx;
                if (hasInner) {
                    if (!innerGfx) {
                        innerGfx = new PIXI.Graphics();
                        pixiVectorLayer.addChild(innerGfx);
                        this._pixiInnerGfx = innerGfx;
                        this.shieldsDirty = true;
                    } else if (!innerGfx.parent) {
                        pixiVectorLayer.addChild(innerGfx);
                    }
                    innerGfx.position.set(rPos.x, rPos.y);
                    innerGfx.alpha = stealthAlpha;
                } else if (innerGfx) {
                    try { innerGfx.destroy(true); } catch (e) { }
                    this._pixiInnerGfx = null;
                    innerGfx = null;
                }

                if (this.shieldsDirty) {
                    // OUTER SHIELD REBUILD
                    gfx.clear();

                    if (this.freezeTimer > 0 && hasOuter) {
                        gfx.lineStyle(2, 0x00ffff, 1);
                        gfx.drawRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    }

                    if (hasOuter) {
                        const segCount = this.shieldSegments.length;
                        const segAngle = (Math.PI * 2) / segCount;
                        const shieldColor = this.isCruiser
                            ? 0x88ffff
                            : (this.isGunboat
                                ? (this.gunboatLevel === 1 ? 0xff5555 : 0xffaa00)
                                : (this.type === 'hunter' ? 0xffaa00 : 0xff5555));

                        // Draw at rotation 0; container rotation handles the spin
                        gfx.lineStyle(2, shieldColor, 1);
                        for (let i = 0; i < segCount; i++) {
                            if (this.shieldSegments[i] > 0) {
                                const a0 = i * segAngle;
                                const a1 = (i + 1) * segAngle - 0.2;
                                gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                gfx.arc(0, 0, this.shieldRadius, a0, a1);
                            }
                        }
                    }

                    // INNER SHIELD REBUILD
                    if (hasInner && innerGfx) {
                        innerGfx.clear();
                        const innerCount = this.innerShieldSegments.length;
                        const innerAngle = (Math.PI * 2) / innerCount;
                        const innerRadius = this.innerShieldRadius || Math.max(10, this.shieldRadius - 20);
                        const innerColor = this.isCruiser
                            ? 0x88ffff
                            : (this.isGunboat
                                ? (this.gunboatLevel === 1 ? 0xff8888 : 0xffff00)
                                : (this.type === 'hunter' ? 0xffdd55 : 0xff8888));

                        innerGfx.lineStyle(2, innerColor, 1);
                        for (let i = 0; i < innerCount; i++) {
                            if (this.innerShieldSegments[i] > 0) {
                                const a0 = i * innerAngle + 0.05;
                                const a1 = (i + 1) * innerAngle - 0.15;
                                innerGfx.moveTo(Math.cos(a0) * innerRadius, Math.sin(a0) * innerRadius);
                                innerGfx.arc(0, 0, innerRadius, a0, a1);
                            }
                        }
                    } else if (innerGfx) {
                        innerGfx.clear();
                    }

                    this.shieldsDirty = false;
                }

                // UPDATE ROTATIONS
                if (hasOuter) gfx.rotation = this.shieldRotation;
                else gfx.rotation = 0;

                if (hasInner && innerGfx) {
                    const innerRot = (typeof this.innerShieldRotation === 'number') ? this.innerShieldRotation : -this.shieldRotation;
                    innerGfx.rotation = innerRot;
                }

            } else {
                if (this._pixiGfx) {
                    try { this._pixiGfx.destroy(true); } catch (e) { }
                    this._pixiGfx = null;
                }
                if (this._pixiInnerGfx) {
                    try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                    this._pixiInnerGfx = null;
                }
            }

            // Name tag (rare; only named elites)
            if (this.nameTag && pixiVectorLayer) {
                let t = this._pixiNameText;
                if (!t) {
                    t = new PIXI.Text(this.nameTag, {
                        fontFamily: 'Courier New',
                        fontSize: 14,
                        fontWeight: 'bold',
                        fill: 0xffff00
                    });
                    t.anchor.set(0.5);
                    t.resolution = 2;
                    pixiVectorLayer.addChild(t);
                    this._pixiNameText = t;
                } else if (t.text !== this.nameTag) {
                    t.text = this.nameTag;
                }
                if (t && !t.parent) {
                    pixiVectorLayer.addChild(t);
                }
                t.visible = true;
                t.position.set(this.pos.x, this.pos.y - this.radius - 15);
                t.alpha = stealthAlpha;
            } else if (this._pixiNameText) {
                try { this._pixiNameText.destroy(true); } catch (e) { }
                this._pixiNameText = null;
            }

        }
    }
}

class Pinwheel extends Entity {
    constructor(x, y, type = 'standard') {
        super(0, 0);
        this.pos.x = x;
        this.pos.y = y;
        this.type = type;
        this.radius = 70;
        this.hp = 10 + (difficultyTier - 1) * 5;
        this.shootTimer = 75; // 150 / 2
        this.angle = 0;
        this.turretAngle = 0;
        this.shieldRadius = 130; // outer shield (moved out from 110)
        const BASE_SHIELD_GAP = 35;
        this.innerShieldRadius = Math.max(this.radius + 15, this.shieldRadius - BASE_SHIELD_GAP); // keep inner ring inside the outer shield with a fixed gap
        this.aggro = false;

        let outerCount = 24;
        let outerHp = 1;
        let innerCount = 0;
        let innerHp = 0;

        if (difficultyTier === 1) { outerCount = 12; outerHp = 1; }
        else if (difficultyTier === 2) { outerCount = 16; outerHp = 1; }
        else if (difficultyTier === 3) { outerCount = 24; outerHp = 1; }
        else if (difficultyTier === 4) { outerCount = 24; outerHp = 2; innerCount = 8; innerHp = 1; }
        else if (difficultyTier === 5) { outerCount = 24; outerHp = 2; innerCount = 12; innerHp = 2; }
        else if (difficultyTier >= 6) {
            outerCount = 24;
            outerHp = 3 + (difficultyTier - 6);
            innerCount = 16 + (difficultyTier - 6);
            innerHp = 2 + Math.floor((difficultyTier - 6) / 2);
        }

        if (type === 'heavy') {
            this.hp *= 1.5;
            outerHp = Math.ceil(outerHp * 1.5);
            innerHp = Math.ceil(innerHp * 1.5);
            this.shootTimer = 60; // 120 / 2
        } else if (type === 'rapid') {
            this.hp *= 0.7;
            outerHp = Math.max(1, Math.floor(outerHp * 0.8));
            this.shootTimer = 15; // 30 / 2
        }

        this.maxShieldHp = outerHp;
        this.shieldSegments = new Array(outerCount).fill(outerHp);
        this.shieldRotation = 0;

        this.innerShieldSegments = [];
        if (innerCount > 0) {
            this.innerShieldSegments = new Array(innerCount).fill(innerHp);
        }
        this.innerShieldRotation = 0;

        const angle = Math.random() * Math.PI * 2;
        let speed = 0.2 + Math.random() * 0.3;
        if (type === 'heavy') speed *= 0.5;
        if (type === 'rapid') speed *= 1.5;

        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;

        this.freezeTimer = 0;
        this.freezeCooldown = 0;
        this.shieldsDirty = true;
        this._pixiInnerGfx = null;
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;

        const dtFactor = deltaTime / 16.67;

        // Stasis Field Logic (Freeze)
        if (this.freezeTimer > 0) {
            this.freezeTimer -= dtFactor;
            this.vel.x = 0;
            this.vel.y = 0;
            // Skip logic when frozen
        } else if (player.stats.slowField > 0) {
            if (this.freezeCooldown > 0) this.freezeCooldown -= dtFactor;

            const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (dist < player.stats.slowField && this.freezeCooldown <= 0) {
                this.freezeTimer = player.stats.slowFieldDuration;
                this.freezeCooldown = this.freezeTimer + 120; // 2s immunity after freeze
                spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
            }
        }

        if (this.freezeTimer > 0) {
            super.update();
            return;
        }

        if (player && !player.dead) {

            const dx = player.pos.x - this.pos.x;
            const dy = player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            // Keep distance from active cruiser boss
            let dreadAvoidX = 0, dreadAvoidY = 0;
            if (bossActive && boss && boss.isCruiser && !boss.dead) {
                const bdx = boss.pos.x - this.pos.x;
                const bdy = boss.pos.y - this.pos.y;
                const bdist = Math.hypot(bdx, bdy);
                if (bdist < 200) {
                    dreadAvoidX = -(bdx / (bdist || 1)) * 0.2;
                    dreadAvoidY = -(bdy / (bdist || 1)) * 0.2;
                }
            }

            // Avoid bunching with other bases
            for (let b of pinwheels) {
                if (b === this || b.dead) continue;
                const bx = b.pos.x - this.pos.x;
                const by = b.pos.y - this.pos.y;
                const bdist = Math.hypot(bx, by);
                if (bdist > 0 && bdist < 400) {
                    const repulse = (400 - bdist) * 0.0005 * dtFactor;
                    this.vel.x -= (bx / bdist) * repulse;
                    this.vel.y -= (by / bdist) * repulse;
                }
            }

            // Aggression ramp: ease-in early, then match prior behavior.
            let elapsed = Date.now() - gameStartTime - pausedAccumMs;
            if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;
            const rampT = Math.max(0, Math.min(1, elapsedMinutes / 10));
            const chaseAccel = (0.12 + 0.08 * rampT) * dtFactor;
            const speedRamp = (0.85 + 0.15 * rampT);

            if (dist > 250) {
                const angle = Math.atan2(dy, dx);
                this.vel.x += Math.cos(angle) * chaseAccel;
                this.vel.y += Math.sin(angle) * chaseAccel;
            }
            this.vel.x += dreadAvoidX * dtFactor;
            this.vel.y += dreadAvoidY * dtFactor;
            const speed = this.vel.mag();
            let maxSpeed = this.type === 'heavy' ? 3.0 : (this.type === 'rapid' ? 6.0 : 5.0); // doubled for 60Hz
            maxSpeed *= speedRamp;
            if (speed > maxSpeed) this.vel.mult(maxSpeed / speed);
        } else {
            // Friction scaled by time
            this.vel.mult(Math.pow(0.99, dtFactor));
        }

        this.pos.add(this.vel);
        checkDespawn(this, 6000);
        this.shieldRotation += 0.01 * dtFactor;
        this.innerShieldRotation -= 0.015 * dtFactor;

        if (this.hp <= 5 && Math.random() < 0.1) spawnSmoke(this.pos.x, this.pos.y, 1);

        if (player && !player.dead) {
            // Start easier: bases ramp up aggression over the first minutes.
            const now = Date.now();
            let elapsed = now - gameStartTime - pausedAccumMs;
            if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;
            const rampT = Math.max(0, Math.min(1, elapsedMinutes / 10));
            const cooldownMult = 1.35 - 0.35 * rampT; // slower early, normal later

            let px = player.pos.x, py = player.pos.y;
            const dx = px - this.pos.x;
            const dy = py - this.pos.y;
            const dist = Math.hypot(dx, dy);
            this.angle = Math.atan2(dy, dx);
            this.turretAngle = Math.atan2(dy, dx);
            this.angle += 0.002;

            const fireRange = 1100 + 400 * rampT;
            if (dist < fireRange) {
                this.shootTimer -= dtFactor;
                if (this.shootTimer <= 0) {
                    const shootAngle = this.turretAngle;
                    if (this.type === 'heavy') {
                        for (let i = -1; i <= 1; i++) {
                            const a = shootAngle + i * 0.15;
                            const bx = this.pos.x + Math.cos(a) * 75;
                            const by = this.pos.y + Math.sin(a) * 75;
                            bullets.push(new Bullet(bx, by, a, true, 3, 8, 8, '#fa0'));
                            spawnBarrelSmoke(bx, by, a);
                        }
                        playSound('heavy_shoot');
                        this.shootTimer = Math.round(60 * cooldownMult);
                    } else if (this.type === 'rapid') {
                        const spread = (Math.random() - 0.5) * 0.1;
                        const a = shootAngle + spread;
                        const bx = this.pos.x + Math.cos(a) * 75;
                        const by = this.pos.y + Math.sin(a) * 75;
                        bullets.push(new Bullet(bx, by, a, true, 1, 14, 3, '#0ff'));
                        spawnBarrelSmoke(bx, by, a);
                        playSound('rapid_shoot');
                        this.shootTimer = Math.round(15 * cooldownMult);
                    } else {
                        const damage = 2;
                        // 3-sided star shooting pattern
                        for (let i = 0; i < 3; i++) {
                            const a = this.angle + i * (Math.PI * 2 / 3);
                            const bx = this.pos.x + Math.cos(a) * 70;
                            const by = this.pos.y + Math.sin(a) * 70;
                            bullets.push(new Bullet(bx, by, a, true, damage));
                            spawnBarrelSmoke(bx, by, a);
                        }
                        playSound('shoot');
                        this.shootTimer = Math.round((difficultyTier >= 2 ? 40 : 75) * cooldownMult);
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }
            if (this._pixiGfx) {
                try { this._pixiGfx.destroy(true); } catch (e) { }
                this._pixiGfx = null;
            }
            return;
        }

        // Interpolate position for smooth rendering on high refresh displays
        const rPos = this.getRenderPos(renderAlpha);

        // Pixi fast path (base hull + shields)
        if (pixiBaseLayer && pixiTextures) {
            const baseKey = (this.type === 'heavy') ? 'base_heavy' : (this.type === 'rapid' ? 'base_rapid' : 'base_standard');
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBaseLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures[baseKey]);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;

                // Base turret visuals removed (still shoots, but no turret graphic).
                this._pixiTurretContainer = null;
                this._pixiTurretBaseSpr = null;
                this._pixiBarrelSpr = null;
            } else if (!container.parent) {
                pixiBaseLayer.addChild(container);
            }
            container.visible = true;

            // Clean up any older turret sprites from a previous version.
            if (this._pixiTurretContainer) {
                try { this._pixiTurretContainer.destroy({ children: true }); } catch (e) { }
                this._pixiTurretContainer = null;
            }
            this._pixiTurretBaseSpr = null;
            this._pixiBarrelSpr = null;

            // Keep hull texture/anchor/scale in sync (important for late-loaded external images).
            if (this._pixiHullSpr) {
                const tex = pixiTextures[baseKey];
                const a = pixiTextureAnchors[baseKey] || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.texture = tex;
                this._pixiHullSpr.anchor.set((a && a.x != null) ? a.x : 0.5, (a && a.y != null) ? a.y : 0.5);
                this._pixiHullSpr.scale.set(pixiTextureBaseScales[baseKey] || 1);
            }

            const jitter = (this.hp <= 2) ? 2 : 0;
            const jx = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            const jy = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            container.position.set(rPos.x + jx, rPos.y + jy);

            if (this._pixiHullSpr) this._pixiHullSpr.rotation = this.angle || 0;

            // Shields (Graphics)
            if (pixiVectorLayer) {
                const shieldColor = (this.type === 'heavy') ? 0xffaa00 : (this.type === 'rapid' ? 0x0088ff : 0x00ffff);
                const innerColor = (this.type === 'heavy') ? 0xff4444 : (this.type === 'rapid' ? 0x8888ff : 0xff00ff);
                const hasOuter = (this.shieldSegments && this.shieldSegments.length > 0);
                const hasInner = (this.innerShieldSegments && this.innerShieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner);

                if (needs) {
                    // --- Outer Shield ---
                    let gfx = this._pixiGfx;
                    if (hasOuter) {
                        if (!gfx) {
                            gfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(gfx);
                            this._pixiGfx = gfx;
                            this.shieldsDirty = true;
                        } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

                        gfx.position.set(rPos.x, rPos.y);
                        gfx.rotation = this.shieldRotation || 0;
                    } else if (gfx) {
                        try { gfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                        gfx = null;
                    }

                    // --- Inner Shield ---
                    let innerGfx = this._pixiInnerGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(rPos.x, rPos.y);
                        innerGfx.rotation = this.innerShieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                        innerGfx = null;
                    }

                    if (this.shieldsDirty) {
                        // Outer Rebuild
                        if (gfx && hasOuter) {
                            gfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    gfx.lineStyle(4, shieldColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * segAngle + 0.05;
                                    const a1 = (i + 1) * segAngle - 0.05;
                                    gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    gfx.arc(0, 0, this.shieldRadius, a0, a1);
                                }
                            }
                        }

                        // Inner Rebuild
                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const innerCount = this.innerShieldSegments.length;
                            const innerAngle = (Math.PI * 2) / innerCount;
                            for (let i = 0; i < innerCount; i++) {
                                const v = this.innerShieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    innerGfx.lineStyle(3, innerColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * innerAngle + 0.05;
                                    const a1 = (i + 1) * innerAngle - 0.05;
                                    innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                                    innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                                }
                            }
                        }

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiInnerGfx) {
                        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                    }
                }
            }

            return;
        }

    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        playSound('base_explode');

        spawnLargeExplosion(this.pos.x, this.pos.y, 2.0);

        // Drop coins
        for (let i = 0; i < 5; i++) {
            nuggets.push(new SpaceNugget(
                this.pos.x + (Math.random() - 0.5) * 120,
                this.pos.y + (Math.random() - 0.5) * 120,
                1
            ));
        }
    }
}

// SpaceNugget imported from ./entities/index.js

class WarpGate extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 140;
        this.t = 0;
        this.mode = 'entry';
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        if (suppressWarpGateUntil && getGameNowMs() < suppressWarpGateUntil) return;
        this.t++;
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dist > this.radius + player.radius) return;

        if (warpCompletedOnce) {
            showOverlayMessage("WARP ALREADY USED THIS SECTOR", '#f80', 1200, 2);
            return;
        }
        if (warpZone && warpZone.active) return;
        showOverlayMessage("WARP INITIATED", '#0ff', 1400, 3);
        playSound('contract');
        enterWarpMaze();
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiWorldRoot) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiWorldRoot.addChildAt(container, 1); // Add behind players/enemies ideally

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center',
                    dropShadow: true,
                    dropShadowColor: '#000000',
                    dropShadowBlur: 4,
                    dropShadowDistance: 0
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const g = this._pixiGfx;
            g.clear();
            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.45;
            const gateColor = 0xff8800;

            // Glow Ring
            g.lineStyle(6, gateColor, 0.35 + pulse);
            g.drawCircle(0, 0, this.radius);

            // Inner Fill
            g.beginFill(gateColor, 0.08);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Text
            const t = this._pixiText;
            t.text = this.mode === 'exit' ? 'EXIT' : 'WARP';

            return;
        }
    }
}

function beginFlagshipFight(cx, cy, radius = 1875) {
    if (bossActive || sectorTransitionActive) return;

    // Start the fight without wiping the whole world (regular asteroids + roaming enemies remain).
    boss = new Flagship({ x: cx, y: cy - 2200 });
    bossActive = true;
    bossArena.x = cx;
    bossArena.y = cy;
    bossArena.radius = radius;
    bossArena.active = true;
    bossArena.growing = false;

    // Don't let the cruiser timer trigger during a flagship boss.
    try { dreadManager.timerActive = false; dreadManager.timerAt = null; } catch (e) { }
    stopArenaCountdown();

    showOverlayMessage("WARNING: FLAGSHIP ENGAGED - ARENA LOCKED", '#f0f', 4500, 2);
    playSound('boss_spawn');
    if (musicEnabled) setMusicMode('cruiser');
}

class CaveGuidedMissile extends Entity {
    constructor(owner, opts = {}) {
        super(owner && owner.pos ? owner.pos.x : 0, owner && owner.pos ? owner.pos.y : 0);
        this.owner = owner || null;
        this.t = 0;
        this.radius = opts.radius || 18;
        this.hp = opts.hp || 4;
        this.maxHp = this.hp;
        this.maxDamage = (typeof opts.maxDamage === 'number') ? opts.maxDamage : null;
        // Removed multiplier for 60Hz scaling transparency.
        this.speed = (opts.speed || 11.0);
        this.turnRate = opts.turnRate || 0.11;
        this.life = opts.life || 720;
        this.angle = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;

        const off = (owner && owner.radius) ? (owner.radius * 0.85 + 14) : 60;
        this.pos.x += Math.cos(this.angle) * off;
        this.pos.y += Math.sin(this.angle) * off;

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;
    }

    explode(color = '#fa0') {
        if (this._exploded) return;
        this._exploded = true;
        this.dead = true;
        playSound('explode');
        spawnFieryExplosion(this.pos.x, this.pos.y, 1.0);
    }

    takeHit(damage) {
        if (this.dead) return;
        const d = Math.max(0, damage || 0);
        this.hp -= d;
        spawnParticles(this.pos.x, this.pos.y, 4, '#ff0');
        playSound('shield_hit');
        if (this.hp <= 0) this.explode('#ff0');
    }

    applyDamageToPlayer(amount) {
        if (!player || player.dead) return;
        if (player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
            for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                if (player.outerShieldSegments[i] > 0) {
                    player.outerShieldSegments[i] = 0;
                    remaining -= 1;
                }
            }
        }

        if (player.shieldSegments && player.shieldSegments.length > 0) {
            for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                const absorb = Math.min(remaining, player.shieldSegments[i]);
                player.shieldSegments[i] -= absorb;
                remaining -= absorb;
            }
        }

        if (remaining > 0) {
            player.hp -= remaining;
            spawnParticles(player.pos.x, player.pos.y, 10, '#f00');
            playSound('hit');
            updateHealthUI();
            if (player.hp <= 0) killPlayer();
        } else {
            playSound('shield_hit');
            spawnParticles(player.pos.x, player.pos.y, 8, '#0ff');
        }
        player.invulnerable = 20;
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        const dtFactor = deltaTime / 16.67;

        this.life -= dtFactor;
        if (this.life <= 0) { this.explode(); return; }
        if (!player || player.dead) { this.explode(); return; }

        const targetAngle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate * dtFactor);

        this.vel.x = Math.cos(this.angle) * this.speed;
        this.vel.y = Math.sin(this.angle) * this.speed;

        // Use Entity.update for scaled movement
        super.update(deltaTime);

        if (this.t % 2 === 0) {
            emitParticle(
                this.pos.x + (Math.random() - 0.5) * 6,
                this.pos.y + (Math.random() - 0.5) * 6,
                -this.vel.x * 0.08 + (Math.random() - 0.5) * 0.6,
                -this.vel.y * 0.08 + (Math.random() - 0.5) * 0.6,
                '#fa0',
                30
            );
        }

        checkWallCollision(this, 0.12);

        // Collide with asteroids / ships: explode and deal damage (splash) to enemies. 
        const splashDamageEnemies = () => {
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            if (dmg <= 0) return;
            const splashR = 160;
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.dead) continue;
                const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
                if (d < splashR + (e.radius || 0)) {
                    e.hp -= dmg;
                    spawnParticles(e.pos.x, e.pos.y, 8, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                }
            }
        };

        try {
            const nearby = asteroidGrid ? asteroidGrid.query(this.pos.x, this.pos.y) : [];
            for (let i = 0; i < nearby.length; i++) {
                const ast = nearby[i];
                if (!ast || ast.dead) continue;
                const d = Math.hypot(ast.pos.x - this.pos.x, ast.pos.y - this.pos.y);
                if (d < (ast.radius || 0) + this.radius) {
                    if (typeof ast.break === 'function') ast.break();
                    this.explode('#fa0');
                    splashDamageEnemies();
                    return;
                }
            }
        } catch (e) { }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead) continue;
            const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
            if (d < (e.radius || 0) + this.radius) {
                this.explode('#fa0');
                splashDamageEnemies();
                return;
            }
        }

        const dP = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dP < player.radius + this.radius) {
            let dmg = Math.max(0, Math.ceil(this.hp));
            if (typeof this.maxDamage === 'number') dmg = Math.min(dmg, this.maxDamage);
            this.explode('#fa0');
            this.applyDamageToPlayer(dmg);
            shakeMagnitude = Math.max(shakeMagnitude, 8);
            shakeTimer = Math.max(shakeTimer, 8);
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const z = currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#fa0';
        ctx.fillStyle = '#f80';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(-18, 9);
        ctx.lineTo(-26, 0);
        ctx.lineTo(-18, -9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = `rgba(255, 120, 0, ${0.35 + Math.random() * 0.45})`;
        ctx.fillRect(-32, -4, 10, 8);
        ctx.globalAlpha = 1;

        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.save();
        ctx.rotate(-this.angle);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = 'rgba(255,255,0,0.55)';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}

class CaveWallTurret extends Entity {
    constructor(x, y, mode = 'rapid', opts = {}) {
        super(x, y);
        this.mode = mode; // 'rapid' | 'beam' | 'missile' 
        this.armored = !!opts.armored;
        this.armorHp = Math.max(0, opts.armorHp || (this.armored ? 10 : 0));
        this.maxArmorHp = this.armorHp;
        this.weakpointHp = Math.max(0, opts.weakpointHp || (this.armored ? 4 : 0));
        this.maxWeakpointHp = this.weakpointHp;
        this._weakOffset = null;
        this.radius = 66;
        this.hp = 6;
        this.maxHp = 6;
        this.t = 0;
        this.reload = 30 + Math.floor(Math.random() * 25);
        this.trackerCharge = 0;
        this.trackerChargeTotal = 75;
        this.trackerLock = 0;
        this.trackerLockTotal = 50;
        this.trackerBurst = 0;
        this.trackerBurstCd = 0;
        this.trackerAngle = 0;

        this.beamCooldown = 220 + Math.floor(Math.random() * 160);
        this.beamCharge = 0;
        this.beamChargeTotal = 55;
        this.beamFire = 0;
        this.beamFireTotal = 14;
        this.beamAngle = 0;
        this.beamLen = 4200;
        this.beamWidth = 20;
        this.beamHitThisShot = false;
    }

    weakpointPos() {
        if (!caveLevel || !caveLevel.active) return { x: this.pos.x, y: this.pos.y };
        if (!this._weakOffset) {
            const cx = caveLevel.centerXAt(this.pos.y);
            const nx = (this.pos.x < cx) ? -1 : 1;
            this._weakOffset = { x: nx * (this.radius + 16), y: (Math.random() - 0.5) * 10 };
        }
        return { x: this.pos.x + this._weakOffset.x, y: this.pos.y + this._weakOffset.y };
    }

    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (dist > this.radius + b.radius) {
            // Weakpoint can be slightly outside the core radius. 
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                const wp = this.weakpointPos();
                const d2 = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
                if (d2 > 12 + b.radius) return false;
            } else {
                return false;
            }
        }

        if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
            const wp = this.weakpointPos();
            const dWp = Math.hypot(b.pos.x - wp.x, b.pos.y - wp.y);
            if (dWp < 12 + b.radius && this.weakpointHp > 0) {
                this.weakpointHp -= b.damage;
                spawnParticles(wp.x, wp.y, 10, '#0ff');
                playSound('hit');
                if (this.weakpointHp <= 0) {
                    // Cable severed: turret disabled immediately. 
                    this.hp = 0;
                    this.kill();
                }
                return true;
            }

            // Armored shell: heavily reduced damage until armor breaks. 
            if (this.armorHp > 0) {
                this.armorHp -= Math.max(1, Math.ceil(b.damage * 0.6));
                spawnParticles(this.pos.x, this.pos.y, 6, '#88f');
                playSound('hit');
                if (this.armorHp < 0) this.armorHp = 0;
                return true;
            }
        }

        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 6, '#ff8');
        playSound('hit');
        if (this.hp <= 0) this.kill();
        return true;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        if (caveMode && caveLevel && caveLevel.active) awardCoinsInstant(6);
        else for (let i = 0; i < 3; i++) coins.push(new Coin(this.pos.x, this.pos.y, 2));
        spawnParticles(this.pos.x, this.pos.y, 18, '#88f');
        playSound('explode');
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (!caveMode || !caveLevel || !caveLevel.active) return;
        if (!player || player.dead) return;

        const dtFactor = deltaTime / 16.67;

        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        const engageRange = (this.mode === 'rapid') ? (5200 * 1.25) : 5200;
        if (dist > engageRange) return;

        const aim = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

        if (this.mode === 'tracker') {
            // Paint -> lock -> burst (fresh gameplay turret). 
            if (this.trackerBurst > 0) {
                this.trackerBurstCd -= dtFactor;
                if (this.trackerBurstCd <= 0) {
                    const leadX = player.pos.x + player.vel.x * 10;
                    const leadY = player.pos.y + player.vel.y * 10;
                    const a = Math.atan2(leadY - this.pos.y, leadX - this.pos.x);
                    const muzzleX = this.pos.x + Math.cos(a) * (this.radius + 6);
                    const muzzleY = this.pos.y + Math.sin(a) * (this.radius + 6);
                    bullets.push(new Bullet(muzzleX, muzzleY, a, true, 1, 16, 4, '#0ff'));
                    this.trackerBurst--;
                    this.trackerBurstCd = 6;
                    playSound('rapid_shoot');
                }
            } else if (this.trackerLock > 0) {
                this.trackerLock -= dtFactor;
                this.trackerAngle = aim;
                if (this.trackerLock <= 0) { // Changed to <= 0 for safety with float decrement
                    this.trackerBurst = 10;
                    this.trackerBurstCd = 0;
                    spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
                    playSound('heavy_shoot');
                }
            } else {
                this.trackerCharge -= dtFactor;
                if (this.trackerCharge <= 0) {
                    this.trackerLock = this.trackerLockTotal;
                    this.trackerCharge = this.trackerChargeTotal + Math.floor(Math.random() * 40);
                    this.trackerAngle = aim;
                }
            }
            return;
        }

        if (this.mode === 'missile') {
            this.reload -= dtFactor;
            if (this.reload <= 0) {
                guidedMissiles.push(new CaveGuidedMissile(this, { hp: 5, maxDamage: 5, radius: 18, speed: 8.2, turnRate: 0.12 }));
                spawnParticles(this.pos.x, this.pos.y, 8, '#fa0');
                playSound('heavy_shoot');
                // Slower missile turret cadence. 
                this.reload = 340 + Math.floor(Math.random() * 140);
            }
            return;
        }

        if (this.mode === 'beam') {
            const applyBeamDamageToPlayer = (amount) => {
                if (!player || player.dead) return;
                if (player.invulnerable > 0) return;
                let remaining = Math.max(0, Math.ceil(amount));
                if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
                    for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                        if (player.outerShieldSegments[i] > 0) {
                            player.outerShieldSegments[i] = 0;
                            remaining -= 1;
                        }
                    }
                }
                if (player.shieldSegments && player.shieldSegments.length > 0) {
                    for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                        const absorb = Math.min(remaining, player.shieldSegments[i]);
                        player.shieldSegments[i] -= absorb;
                        remaining -= absorb;
                    }
                }
                if (remaining > 0) {
                    player.hp -= remaining;
                    spawnParticles(player.pos.x, player.pos.y, 10, '#f00');
                    playSound('hit');
                    updateHealthUI();
                    if (player.hp <= 0) killPlayer();
                } else {
                    spawnParticles(player.pos.x, player.pos.y, 8, '#ff0');
                    playSound('shield_hit');
                }
                player.invulnerable = 20;
            };

            if (this.beamFire > 0) {
                this.beamFire -= dtFactor;
                if (!this.beamHitThisShot) {
                    const ex = this.pos.x + Math.cos(this.beamAngle) * this.beamLen;
                    const ey = this.pos.y + Math.sin(this.beamAngle) * this.beamLen;
                    const cp = closestPointOnSegment(player.pos.x, player.pos.y, this.pos.x, this.pos.y, ex, ey);
                    const d = Math.hypot(player.pos.x - cp.x, player.pos.y - cp.y);
                    const hitDist = (this.beamWidth * 0.5) + (player.radius * 0.55);
                    if (d <= hitDist) {
                        this.beamHitThisShot = true;
                        applyBeamDamageToPlayer(3);
                        shakeMagnitude = Math.max(shakeMagnitude, 8);
                        shakeTimer = Math.max(shakeTimer, 8);
                    }
                }
            } else if (this.beamCharge > 0) {
                this.beamCharge -= dtFactor;
                if (this.beamCharge <= 0) {
                    this.beamFire = this.beamFireTotal;
                    this.beamHitThisShot = false;
                    playSound('heavy_shoot');
                }
            } else {
                this.beamCooldown -= dtFactor;
                if (this.beamCooldown <= 0 && dist > 300) {
                    this.beamAngle = aim;
                    this.beamCharge = this.beamChargeTotal;
                    this.beamFire = 0;
                    this.beamCooldown = 260 + Math.floor(Math.random() * 180);
                    this.beamHitThisShot = false;
                }
            }
            return;
        }

        // Rapid-fire lasers
        this.reload -= dtFactor;
        if (this.reload <= 0) {
            const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
            const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
            bullets.push(new Bullet(muzzleX, muzzleY, aim, true, 1, 14, 4, '#8ff'));
            if (Math.random() < 0.25) bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.08, true, 1, 14, 4, '#8ff'));
            if (Math.random() < 0.25) bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.08, true, 1, 14, 4, '#8ff'));
            this.reload = 26 + Math.floor(Math.random() * 18);
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const aim = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;

        // Pixi Rendering
        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                // Base Gfx (Staticish)
                const g = new PIXI.Graphics();
                g.name = 'base';
                container.addChild(g);
                this._pixiGfx = g;

                // Overlay Gfx (Beams/Trackers)
                const overlay = new PIXI.Graphics();
                overlay.name = 'overlay';
                container.addChild(overlay);
                this._pixiOverlay = overlay;

                // Label/UI if needed (none for turret)
            }

            container.visible = true; // Managed by caller ideally, but ensure true if called
            container.position.set(this.pos.x, this.pos.y);

            const z = currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            const overlay = this._pixiOverlay;

            // Redraw every frame for now due to dynamic rotation/state. 
            // Optimization: Cache base, only rotate gun?
            // For now, full redraw is safer for migration.
            g.clear();
            overlay.clear();

            // Turret Base/Gun
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff, 1);
            // Shadow not maintained in Pixi Gfx easily without filters, skipping shadow for perf
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Gun Barrel
            g.beginFill(0x8888ff);
            g.drRect = { x: this.radius * 0.2, y: -4, w: this.radius * 1.35, h: 8 };
            // Rotate manually for barrel? No, rotate Graphics? 
            // Turret rotates to aim.
            // Base is round, so rotating container is fine.
            container.rotation = aim;

            g.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
            g.endFill();

            // Weakpoint (Armored Cable) - drawn in world space relative to turret? 
            // Weakpoint is calculated by weakpointPos(), usually offset.
            // If I rotate container by `aim`, local (0,0) is center.
            // weakpointPos() logic: nx * (radius+16), y random.
            // That logic is constant in *world* space? No, weakpointPos uses `nx` based on `centerXAt`.
            // The turret base (round) is at `pos`.
            // The weakpoint is at `pos + offset`.
            // The gun rotates `aim`.
            // So if I rotate `container` by `aim`, the *weakpoint* (attached to wall) would rotate too!
            // Incorrect.

            // Correction: Container should NOT rotate. Only the Gun Barrel should rotate.
            container.rotation = 0;

            // Redraw Base (Circle) - No rotation needed.
            g.beginFill(0x101018);
            g.lineStyle(2, 0x8888ff);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Draw Gun Barrel (Rotated)
            const barrX = Math.cos(aim);
            const barrY = Math.sin(aim);
            // Rotated rect points
            // Start at offset *0.2
            // Since we are doing geometry, maybe use a sub-container for gun?
            // Let's use drawing matrix or just trig.
            // Gun rect: x:0.2*r, y:-4, w:1.35*r, h:8.
            // It's easier to add a 'gun' child Container.
            if (!this._pixiGun) {
                const gun = new PIXI.Graphics();
                gun.beginFill(0x8888ff);
                gun.drawRect(this.radius * 0.2, -4, this.radius * 1.35, 8);
                gun.endFill();
                container.addChild(gun);
                this._pixiGun = gun;
            }
            this._pixiGun.rotation = aim;

            // Weakpoint
            if (this.armored && (this.armorHp > 0 || this.weakpointHp > 0)) {
                // We draw lines from (0,0) to weakpoint offset
                const wp = this.weakpointPos();
                const lx = wp.x - this.pos.x;
                const ly = wp.y - this.pos.y;

                g.lineStyle(2, 0x00ffff, 0.9);
                g.moveTo(0, 0);
                g.lineTo(lx, ly);

                g.beginFill(0x00ffff);
                g.lineStyle(0);
                g.drawCircle(lx, ly, 6);
                g.endFill();
            }

            // Overlay (Beams, Trackers)
            // Tracker
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                // Dashed line from center to aim
                // LineDash not native in v5 Graphics easily without plugins, simulate dots?
                // Or just solid line with low alpha
                overlay.lineStyle(2, 0x00ffff, 0.35);
                // Draw manual dash?
                const angle = this.trackerAngle;
                const tx = Math.cos(angle) * 2600;
                const ty = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(tx, ty);
            }
            // Beam
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                const bx = Math.cos(angle) * 2600;
                const by = Math.sin(angle) * 2600;
                overlay.moveTo(0, 0);
                overlay.lineTo(bx, by);
            }

            // HP Ring
            const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.drawCircle(0, 0, this.radius + 8);
            // drawCircle is full circle. Canvas was partial arc based on pct.
            // Graphics.arc(cx, cy, radius, startAngle, endAngle)
            overlay.clear();
            if (this.mode === 'tracker' && (this.trackerLock > 0 || this.trackerBurst > 0)) {
                overlay.lineStyle(2, 0x00ffff, 0.35);
                const angle = this.trackerAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            if (this.mode === 'beam' && this.beamCharge > 0) {
                overlay.lineStyle(2, 0xffff00, 0.35);
                const angle = this.beamAngle;
                overlay.moveTo(0, 0);
                overlay.lineTo(Math.cos(angle) * 2600, Math.sin(angle) * 2600);
            }
            overlay.lineStyle(3, 0xffff66, 0.75);
            overlay.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);

            return;
        }

        // Canvas Fallback Removed
    }
}

class CaveWallSwitch extends Entity {
    constructor(x, y, doorIds = []) {
        super(x, y);
        this.radius = 18;
        this.hp = 3;
        this.maxHp = 3;
        this.doorIds = Array.isArray(doorIds) ? doorIds : [];
        this.t = 0;
    }
    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (d > this.radius + b.radius) return false;
        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 10, '#0ff');
        playSound('hit');
        if (this.hp <= 0) {
            this.dead = true;
            pixiCleanupObject(this);
            for (let i = 0; i < this.doorIds.length; i++) {
                try { if (caveLevel) caveLevel.toggleDoor(this.doorIds[i]); } catch (e) { }
            }
            showOverlayMessage("SWITCH ACTIVATED", '#0ff', 900, 1);
            playSound('powerup');
        }
        return true;
    }
    update(deltaTime = 16.67) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('SW', {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: '#000000',
                    align: 'center'
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Halo
            g.beginFill(0x00ffff, 0.25 + pulse);
            g.lineStyle(2, 0x00ffff, 1);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            return;
        }
    }
}

class CavePowerRelay extends Entity {
    constructor(x, y, gateIndex = 0) {
        super(x, y);
        this.gateIndex = gateIndex;
        this.radius = 22;
        this.hp = 8;
        this.maxHp = 8;
        this.t = 0;
    }
    hitByPlayerBullet(b) {
        if (this.dead) return false;
        if (!b || b.isEnemy) return false;
        const d = Math.hypot(b.pos.x - this.pos.x, b.pos.y - this.pos.y);
        if (d > this.radius + b.radius) return false;
        this.hp -= b.damage;
        spawnParticles(this.pos.x, this.pos.y, 12, '#ff0');
        playSound('hit');
        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.pos.x, this.pos.y, 40, '#ff0');
            playSound('explode');
            try { if (caveLevel) caveLevel.onRelayDestroyed(this.gateIndex); } catch (e) { }
        }
        return true;
    }
    update(deltaTime = 16.67) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.5 + Math.abs(Math.sin(this.t * 0.03)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Outer Ring
            g.beginFill(0x111111);
            g.lineStyle(2, 0xffff00);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

            // Inner Core
            g.beginFill(0xffff00, 0.5 + pulse * 0.3);
            g.lineStyle(0);
            g.drawCircle(0, 0, 8);
            g.endFill();

            return;
        }
    }
}

class CaveRewardPickup extends Entity {
    constructor(x, y, rewardType = 'coins', value = 0) {
        super(x, y);
        this.rewardType = rewardType;
        this.value = value;
        this.radius = 26;
        this.t = 0;
    }
    update(deltaTime = 16.67) { this.t += deltaTime / 16.67; }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;

                const text = new PIXI.Text('', {
                    fontFamily: 'Courier New',
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill: '#ffffff',
                    align: 'center'
                });
                text.anchor.set(0.5);
                container.addChild(text);
                this._pixiText = text;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.035)) * 0.35;
            const colorVals = {
                'upgrade': 0xff00ff,
                'shield': 0x00ffff,
                'fragment': 0xffff00,
                'nugs': 0xffaa00,
                'coins': 0x00ff00
            };
            const col = colorVals[this.rewardType] || 0x00ff00;
            const labelVals = {
                'upgrade': 'UP',
                'shield': 'SH',
                'fragment': 'KF',
                'nugs': 'NG',
                'coins': '$'
            };

            const g = this._pixiGfx;
            g.clear();

            g.lineStyle(4, 0xffffff, 0.15 + pulse);
            g.drawCircle(0, 0, this.radius);

            const txt = this._pixiText;
            txt.text = labelVals[this.rewardType] || '$';
            txt.style.fill = col;

            return;
        }
    }
}

class CaveGasVent extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 420;
        this.t = 0;
        this.state = 'off'; // off | warn | on 
        this.timer = 180 + Math.floor(Math.random() * 120);
        this.damageCd = 0;
    }
    update(deltaTime = 16.67) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }
        this.t++;
        this.timer -= deltaTime / 16.67;
        if (this.timer <= 0) {
            if (this.state === 'off') { this.state = 'warn'; this.timer = 60; }
            else if (this.state === 'warn') { this.state = 'on'; this.timer = 140; }
            else { this.state = 'off'; this.timer = 220 + Math.floor(Math.random() * 160); }
        }
        if (this.damageCd > 0) this.damageCd -= deltaTime / 16.67;
        if (!player || player.dead) return;
        if (this.state !== 'on') return;
        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (d > this.radius + player.radius) return;
        // Slow the ship and tick damage (forces movement). 
        player.caveSlowFrames = Math.max(player.caveSlowFrames || 0, 18);
        player.caveSlowMult = 0.62;
        if (this.damageCd <= 0 && player.invulnerable <= 0) {
            player.hp -= 1;
            this.damageCd = 40;
            spawnParticles(player.pos.x, player.pos.y, 10, '#6f6');
            playSound('hit');
            updateHealthUI();
            if (player.hp <= 0) killPlayer();
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0x78ff78, 0.35);
                // Dashed? Simulate with dots or low alpha solid
                g.drawCircle(0, 0, this.radius);
            } else if (this.state === 'on') {
                g.beginFill(0x50ff50, 0.08 + pulse * 0.10);
                g.drawCircle(0, 0, this.radius);
                g.endFill();
            } else {
                container.visible = false;
            }

            return;
        }
    }
}

class CaveRockfall extends Entity {
    constructor(x, y, width = 1600, closeSide = 'left') {
        super(x, y);
        this.width = width;
        this.closeSide = closeSide; // left | right | center 
        this.radius = 1;
        this.state = 'idle'; // idle | warn | fallen 
        this.t = 0;
        this.timer = 0;
        this.segments = [];
    }
    trigger() {
        if (this.state !== 'idle') return;
        this.state = 'warn';
        this.timer = 90;
        showOverlayMessage("ROCKFALL INCOMING", '#ff0', 900, 1);
    }
    fall() {
        if (this.state === 'fallen') return;
        this.state = 'fallen';
        this.timer = 0;
        this.segments = [];
        if (!caveLevel) return;
        const b = caveLevel.boundsAt(this.pos.y);
        const cx = (b.left + b.right) * 0.5;
        let left = b.left + 60;
        let right = b.right - 60;
        if (this.closeSide === 'left') right = Math.min(right, cx - 260);
        else if (this.closeSide === 'right') left = Math.max(left, cx + 260);
        else { left = cx - this.width * 0.5; right = cx + this.width * 0.5; }
        left = Math.max(b.left + 60, left);
        right = Math.min(b.right - 60, right);
        const n = 18;
        const step = (right - left) / n;
        for (let i = 0; i < n; i++) {
            const x0 = left + i * step;
            const x1 = left + (i + 1) * step;
            const j0 = (Math.random() - 0.5) * 70;
            const j1 = (Math.random() - 0.5) * 70;
            this.segments.push({ x0, y0: this.pos.y + j0, x1, y1: this.pos.y + j1, kind: 'rockfall' });
        }
        spawnParticles(cx, this.pos.y, 50, '#888');
        playSound('explode');
    }
    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (!player || player.dead) return;
        if (this.state === 'idle') {
            const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (d < 2200) this.trigger();
        } else if (this.state === 'warn') {
            this.timer -= deltaTime / 16.67;
            if (this.timer <= 0) this.fall();
            // Falling debris visuals 
            if (this.t % 3 === 0) {
                emitParticle(this.pos.x + (Math.random() - 0.5) * 700, this.pos.y - 800 + Math.random() * 400, (Math.random() - 0.5) * 0.8, 3 + Math.random() * 2, '#888', 50);
            }
        }
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const z = currentZoom || ZOOM_LEVEL;
            const g = this._pixiGfx;
            g.clear();

            if (this.state === 'warn') {
                g.lineStyle(3, 0xffff00, 0.25 + Math.abs(Math.sin(this.t * 0.2)) * 0.25);
                // Simulate dashed line
                // g.moveTo(-900, 0); g.lineTo(900, 0);
                // Manual dash
                let dx = -900;
                while (dx < 900) {
                    g.moveTo(dx, 0);
                    g.lineTo(Math.min(900, dx + 20), 0);
                    dx += 40;
                }
            }
            else if (this.state === 'fallen' && this.segments && this.segments.length) {
                // Thick blue background
                g.lineStyle(16, 0x003764, 0.9);
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    // Segments coordinates are world space (x0, y0).
                    // Container is at this.pos.x, this.pos.y.
                    // Need to transform to local.
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }

                // Neon glow
                // Pixi allows multiple line styles on one path? No.
                // Re-iterate for glow pass.
                g.lineStyle(3, 0x8cf0ff, 0.75); // rgba(140, 240, 255, 0.75)
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    g.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                    g.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
                }
            } else {
                container.visible = false;
            }

            return;
        }
    }
}

class CaveDraftZone extends Entity {
    constructor(x, y, w, h, forceY = -0.08) {
        super(x, y);
        this.w = w;
        this.h = h;
        this.forceY = forceY;
        this.t = 0;
    }
    contains(entity) {
        if (!entity || entity.dead) return false;
        return (entity.pos.x > this.pos.x - this.w / 2 && entity.pos.x < this.pos.x + this.w / 2 && entity.pos.y > this.pos.y - this.h / 2 && entity.pos.y < this.pos.y + this.h / 2);
    }
    update(deltaTime = 16.67) {
        this.t++;
        const apply = (e) => {
            if (!this.contains(e)) return;
            e.vel.y += this.forceY;
            // Slight stabilization so it feels like a current. 
            e.vel.x *= 0.995;
        };
        apply(player);
        for (let i = 0; i < enemies.length; i++) apply(enemies[i]);
    }
    draw(ctx) {
        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;
            const g = this._pixiGfx;
            g.clear();

            // Background Fill (Simulate Gradient with solid color)
            const aFill = 0.08 + pulse * 0.06;
            g.beginFill(0x0078ff, aFill);
            g.drawRect(-this.w / 2, -this.h / 2, this.w, this.h);
            g.endFill();

            // Outline
            g.lineStyle(2, 0x00ffff, 0.10 + pulse * 0.12);
            g.drawRect(-this.w / 2, -this.h / 2, this.w, this.h);

            // Wavy lines
            g.lineStyle(1, 0xffffff, 0.10 + pulse * 0.10);
            for (let i = -2; i <= 2; i++) {
                // Draw wavy line. Since Pixi Gfx path building is fast, we can calc points.
                // 5 lines spaced 120px apart (vertical offset).
                // x goes from -w/2+20 to w/2-20.
                const basePathY = (i * 120);
                const startX = -this.w / 2 + 20;
                const endX = this.w / 2 - 20;

                // Draw sine wave? Original used single lineTo:
                // ctx.moveTo(-this.w / 2 + 20, y); ctx.lineTo(this.w / 2 - 20, y);
                // The 'y' was modulated by sin(t + i). So it's a moving horizontal line.
                const y = basePathY + Math.sin(this.t * 0.06 + i) * 30;
                g.moveTo(startX, y);
                g.lineTo(endX, y);
            }

            return;
        }
    }
}

class CaveCritter extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 14;
        this.t = 0;
        this.vel.x = (Math.random() - 0.5) * 2.2;
        this.vel.y = (Math.random() - 0.5) * 2.2;
    }
    scatter(fromX, fromY) {
        const a = Math.atan2(this.pos.y - fromY, this.pos.x - fromX);
        this.vel.x += Math.cos(a) * 4.2;
        this.vel.y += Math.sin(a) * 4.2;
    }
    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (player && !player.dead) {
            const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (d < 520) this.scatter(player.pos.x, player.pos.y);
        }
        this.vel.x *= 0.98;
        this.vel.y *= 0.98;
        this.pos.add(this.vel);
        checkWallCollision(this, 0.35);
    }
    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (caveLevel && caveLevel._pixiContainer) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                caveLevel._pixiContainer.addChild(container);

                const g = new PIXI.Graphics();
                container.addChild(g);
                this._pixiGfx = g;
            }
            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const z = currentZoom || ZOOM_LEVEL;
            const pulse = 0.35 + Math.abs(Math.sin(this.t * 0.04)) * 0.35;

            const g = this._pixiGfx;
            g.clear();

            // Fill
            g.beginFill(0x33cc33);
            g.lineStyle(2, 0x00aa00);
            g.drawCircle(0, 0, this.radius);
            g.endFill();

        }
    }
}

class CaveLevel {
    constructor() {
        this.active = true;
        this.startX = 0;
        this.startY = 0;
        this.endY = -220000; // ~10 minutes of flight at stock speeds 
        this.stepY = 240;
        this.baseWidth = 3000;
        // Pixi Rendering
        this._pixiContainer = null;
        this._pixiBackGfx = null;
        this._pixiFrontGfx = null;
        this._pixiBlockerGfx = null;
        this._pixiReady = false;

        this.buckets = [];
        this.leftPts = [];
        this.rightPts = [];
        this.innerSegments = [];
        this.wallTurrets = [];
        this.switches = [];
        this.doors = []; // { id, open, segments } 
        this.rewards = [];
        this.relays = [];
        this.gasVents = [];
        this.draftZones = [];
        this.critters = [];
        this.rockfalls = [];
        this.arenaSegments = [];
        this.entranceSeal = null;
        this.exitSeal = null;
        this.exitUnlocked = false;
        this.gates = []; // { y, open, segments } 
        this.bossesDefeated = 0;
        this.finalSpawned = false;
        this.enemySpawnCooldown = 0;
        this.critterSpawnCooldown = 0;
    }

    generate() {
        this.resetFireWall();
        const length = Math.abs(this.endY - this.startY);
        const count = Math.max(1, Math.ceil(length / this.stepY));
        this.buckets = new Array(count);
        for (let i = 0; i < count; i++) this.buckets[i] = [];

        let cx = this.startX;
        const leftPts = [];
        const rightPts = [];
        for (let i = 0; i <= count; i++) {
            const y = this.startY - i * this.stepY;
            cx += (Math.random() - 0.5) * 140;
            cx = Math.max(-1600, Math.min(1600, cx));

            const endBoost = (y < this.endY + 22000) ? 1 : 0;
            let width = this.baseWidth + ((i % 70 < 14) ? (900 + Math.random() * 900) : 0) + endBoost * 1400;
            width += (Math.random() - 0.5) * 220;
            width = Math.max(2400, Math.min(6200, width));

            leftPts.push({ x: cx - width * 0.5 + (Math.random() - 0.5) * 220, y });
            rightPts.push({ x: cx + width * 0.5 + (Math.random() - 0.5) * 220, y });
        }

        this.leftPts = leftPts;
        this.rightPts = rightPts;

        for (let i = 0; i < leftPts.length - 1; i++) {
            const l0 = leftPts[i], l1 = leftPts[i + 1];
            const r0 = rightPts[i], r1 = rightPts[i + 1];
            const sL = { x0: l0.x, y0: l0.y, x1: l1.x, y1: l1.y, kind: 'outer' };
            const sR = { x0: r0.x, y0: r0.y, x1: r1.x, y1: r1.y, kind: 'outer' };
            if (this.buckets[i]) this.buckets[i].push(sL, sR);
        }

        // Branching pillars: create alternate routes around central obstructions.
        this.innerSegments = [];
        const pillarCount = 6;
        for (let p = 0; p < pillarCount; p++) {
            const at = Math.floor((count * (p + 1)) / (pillarCount + 1));
            const span = 18 + Math.floor(Math.random() * 14);
            const yTop = this.startY - (at + span) * this.stepY;
            const yBot = this.startY - at * this.stepY;
            const xMid = (Math.random() - 0.5) * 500;
            const w = 520 + Math.random() * 520;
            const n = span * 2;
            const pts = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const y = yBot + (yTop - yBot) * t;
                const jx = (Math.random() - 0.5) * 110;
                pts.push({ x: xMid + jx, y });
            }
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i + 1];
                const s1 = { x0: a.x - w * 0.5, y0: a.y, x1: b.x - w * 0.5, y1: b.y, kind: 'inner' };
                const s2 = { x0: a.x + w * 0.5, y0: a.y, x1: b.x + w * 0.5, y1: b.y, kind: 'inner' };
                this.innerSegments.push(s1, s2);
                const bi = this.bucketIndexForY(a.y);
                if (this.buckets[bi]) this.buckets[bi].push(s1, s2);
            }
        }

        // Gates (boss checkpoints): closed barriers across the tunnel. 
        const gateYs = [-52000, -118000, -182000];
        this.gates = gateYs.map((y, i) => ({
            y,
            open: false,
            preSpawned: false,
            relaysSpawned: false,
            relaysCleared: false,
            relaysRemaining: 0,
            defendCd: 0,
            bossEnabled: i > 0,
            relaysEnabled: i === 0,
            segments: this.buildGateSegments(y)
        }));

        // Wall turrets along the cave walls. 
        this.wallTurrets = [];
        const turretEvery = 2600;
        const totalTurrets = Math.max(70, Math.floor(Math.abs(this.endY - this.startY) / turretEvery));
        // Turret variety: machine-gun bias + missile + beam + tracker. 
        const modes = ['rapid', 'rapid', 'rapid', 'beam', 'missile', 'rapid', 'tracker', 'rapid'];
        for (let i = 0; i < totalTurrets; i++) {
            const y = this.startY - (i * turretEvery) - 2400 - Math.random() * 1200;
            if (y < this.endY + 1200) break;
            const bounds = this.boundsAt(y);
            const side = (Math.random() < 0.5) ? 'left' : 'right';
            const x = side === 'left' ? (bounds.left + 160) : (bounds.right - 160);
            const mode = modes[i % modes.length];
            const armored = (mode === 'rapid') && (Math.random() < 0.28);
            this.wallTurrets.push(new CaveWallTurret(x, y, mode, { armored }));
        }

        // Side caves with rewards + switchable doors (optional detours). 
        this.doors = [];
        this.switches = [];
        this.rewards = [];
        this.relays = [];
        this.gasVents = [];
        this.draftZones = [];
        this.critters = [];
        this.rockfalls = [];
        this.arenaSegments = [];

        const isNearGate = (y) => this.gates.some(g => g && Math.abs(g.y - y) < 9000);
        const sideCaveCount = 8;
        for (let sc = 0; sc < sideCaveCount; sc++) {
            const y = this.startY - (sc + 1) * 24000 - Math.random() * 6000;
            if (y < this.endY + 16000) break;
            if (isNearGate(y)) continue;
            const b = this.boundsAt(y);
            const side = (sc % 2 === 0) ? 'left' : 'right';
            const w = 1100;
            const h = 1800;
            const margin = 30;
            const x1 = side === 'left' ? (b.left + margin + w) : (b.right - margin);
            const x0 = x1 - w;
            const y0 = y - h * 0.5;
            const y1c = y + h * 0.5;
            const faceX = side === 'left' ? x1 : x0;

            // Chamber walls (mostly sealed, with 2 doorways on the face that reconnect later). 
            const segs = [];
            const step = 140;
            // Top / bottom 
            segs.push({ x0, y0: y0, x1, y1: y0, kind: 'inner' });
            segs.push({ x0, y0: y1c, x1, y1: y1c, kind: 'inner' });
            // Outer wall (flush to boundary side) 
            const outerX = side === 'left' ? x0 : x1;
            for (let yy = y0; yy < y1c; yy += step) {
                segs.push({ x0: outerX, y0: yy, x1: outerX, y1: Math.min(y1c, yy + step), kind: 'inner' });
            }
            // Face wall with two gaps 
            const gapH = 220;
            const gap1 = y + 520;
            const gap2 = y - 520;
            const pieces = [
                { a: y0, b: gap2 - gapH / 2 },
                { a: gap2 + gapH / 2, b: gap1 - gapH / 2 },
                { a: gap1 + gapH / 2, b: y1c }
            ];
            for (let p = 0; p < pieces.length; p++) {
                const A = pieces[p].a, B = pieces[p].b;
                for (let yy = A; yy < B; yy += step) {
                    segs.push({ x0: faceX, y0: yy, x1: faceX, y1: Math.min(B, yy + step), kind: 'inner' });
                }
            }
            // Add segments to buckets 
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                const bi = this.bucketIndexForY((s.y0 + s.y1) * 0.5);
                if (this.buckets[bi]) this.buckets[bi].push(s);
            }

            // Door that blocks the lower entrance until the player shoots a switch. 
            const doorId = `side_${sc}`;
            const doorSeg = { x0: faceX, y0: gap1 - gapH / 2, x1: faceX, y1: gap1 + gapH / 2, kind: 'door' };
            this.doors.push({ id: doorId, open: false, segments: [doorSeg] });
            const towardCenter = side === 'left' ? 1 : -1;
            this.switches.push(new CaveWallSwitch(faceX + towardCenter * 140, gap1, [doorId]));

            // Reward in the chamber (include nugz caches to keep Sector 2 economy healthy).
            const rr = Math.random();
            const rewardType =
                (rr < 0.35) ? 'nugs' :
                    (rr < 0.55) ? 'coins' :
                        (rr < 0.70) ? 'shield' :
                            (rr < 0.85) ? 'fragment' :
                                'upgrade';
            this.rewards.push(new CaveRewardPickup((x0 + x1) * 0.5, y, rewardType, 0));
        }

        // Hazards / traversal moments sprinkled throughout. 
        for (let i = 0; i < 10; i++) {
            const y = this.startY - (i + 1) * 18000 - Math.random() * 8000;
            if (y < this.endY + 14000) break;
            if (isNearGate(y)) continue;
            const b = this.boundsAt(y);
            const x = (b.left + b.right) * 0.5 + (Math.random() - 0.5) * (Math.min(1400, (b.right - b.left) * 0.25));
            this.gasVents.push(new CaveGasVent(x, y));
        }
        for (let i = 0; i < 8; i++) {
            const y = this.startY - (i + 1) * 26000 - Math.random() * 9000;
            if (y < this.endY + 12000) break;
            if (isNearGate(y)) continue;
            const b = this.boundsAt(y);
            const cx = (b.left + b.right) * 0.5;
            this.draftZones.push(new CaveDraftZone(cx, y, 1200, 3200, (Math.random() < 0.5) ? -0.10 : 0.10));
        }
        for (let i = 0; i < 6; i++) {
            const y = this.startY - (i + 1) * 30000 - Math.random() * 9000;
            if (y < this.endY + 16000) break;
            if (isNearGate(y)) continue;
            const b = this.boundsAt(y);
            const cx = (b.left + b.right) * 0.5;
            const closeSide = (Math.random() < 0.5) ? 'left' : 'right';
            this.rockfalls.push(new CaveRockfall(cx, y, 1600, closeSide));
        }

        // Seal the entrance behind the player so there's no way back out of the cave. 
        const sealY = this.startY + 1400;
        const b0 = this.boundsAt(this.startY);
        const entranceLeftX = b0.left;
        const entranceRightX = b0.right;
        const sealLeft = entranceLeftX;
        const sealRight = entranceRightX;
        const sealSegs = [];
        const n = 34;
        const step = (sealRight - sealLeft) / n;
        const jitter = 60;
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const x = sealLeft + i * step;
            let y = sealY + (Math.random() - 0.5) * jitter;
            if (i === 0 || i === n) y = sealY;
            pts.push({ x, y });
        }
        for (let i = 0; i < n; i++) {
            sealSegs.push({ x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y, kind: 'seal' });
        }
        // Connect the seal to the cave boundary with side walls. 
        const sideSegs = [];
        const sideStep = 220;
        for (let y = this.startY; y < sealY; y += sideStep) {
            const y1 = Math.min(sealY, y + sideStep);
            sideSegs.push({ x0: entranceLeftX, y0: y, x1: entranceLeftX, y1, kind: 'seal' });
            sideSegs.push({ x0: entranceRightX, y0: y, x1: entranceRightX, y1, kind: 'seal' });
        }
        this.entranceSeal = { y: sealY, segments: sealSegs, sideSegments: sideSegs, leftX: entranceLeftX, rightX: entranceRightX };

        // Seal the cave exit near the end so the player can't fly out until the final boss is defeated.
        const exitTargetY = this.endY + 1800;
        const exitIdx = Math.ceil((this.startY - exitTargetY) / this.stepY);
        const exitY = this.startY - exitIdx * this.stepY;
        const bEnd = this.boundsAt(exitY);
        const exitLeftX = bEnd.left;
        const exitRightX = bEnd.right;
        const exitSegs = [];
        const exitN = 34;
        const exitStep = (exitRightX - exitLeftX) / exitN;
        const exitJitter = 70;
        const exitPts = [];
        for (let i = 0; i <= exitN; i++) {
            const x = exitLeftX + i * exitStep;
            let y = exitY + (Math.random() - 0.5) * exitJitter;
            if (i === 0 || i === exitN) y = exitY;
            exitPts.push({ x, y });
        }
        for (let i = 0; i < exitN; i++) {
            exitSegs.push({ x0: exitPts[i].x, y0: exitPts[i].y, x1: exitPts[i + 1].x, y1: exitPts[i + 1].y, kind: 'exit' });
        }
        // Connect the exit seal to the cave boundary for a tight lock.
        const exitSideSegs = [];
        const exitConnectLen = 1200;
        for (let y = exitY; y < exitY + exitConnectLen; y += this.stepY) {
            const y1 = Math.min(exitY + exitConnectLen, y + this.stepY);
            const bA = this.boundsAt(y);
            const bB = this.boundsAt(y1);
            exitSideSegs.push({ x0: bA.left, y0: y, x1: bB.left, y1, kind: 'exit' });
            exitSideSegs.push({ x0: bA.right, y0: y, x1: bB.right, y1, kind: 'exit' });
        }
        this.exitSeal = { y: exitY, segments: exitSegs, sideSegments: exitSideSegs, leftX: exitLeftX, rightX: exitRightX };
        this.exitUnlocked = false;
    }

    resetFireWall(playerY = null) {
        const gap = 400;
        const baseY = (typeof playerY === 'number' && isFinite(playerY))
            ? playerY
            : (this.startY + 600);
        this.fireWall = {
            y: baseY + gap,
            speed: 160, // units per second (five times faster)
            damagePerSecond: 5,
            damageTimer: 0,
            minY: this.endY + 1200
        };
    }

    updateFireWall(deltaTime = 16.67) {
        if (!this.active || !this.fireWall) return;
        const fire = this.fireWall;
        const dtSec = Math.max(0, deltaTime) / 1000;
        fire.y -= fire.speed * dtSec;
        if (fire.minY !== undefined && fire.y < fire.minY) fire.y = fire.minY;
        if (!player || player.dead) {
            fire.damageTimer = 0;
            return;
        }
        const inside = player.pos.y >= fire.y;
        if (!inside) {
            fire.damageTimer = 0;
            return;
        }
        fire.damageTimer += deltaTime;
        const ticks = Math.floor(fire.damageTimer / 1000);
        if (ticks > 0) {
            const damage = fire.damagePerSecond * ticks;
            player.takeHit(damage);
            fire.damageTimer -= ticks * 1000;
        }
    }

    initPixi() {
        if (this._pixiReady && this._pixiContainer) return;

        // Container for all cave geometry
        this._pixiContainer = new PIXI.Container();
        this._pixiContainer.sortableChildren = true; // Ensure layers order

        // Layer 1: Back elements (thick dark lines)
        this._pixiBackGfx = new PIXI.Graphics();
        this._pixiContainer.addChild(this._pixiBackGfx);

        // Layer 2: Front elements (thin neon lines)
        this._pixiFrontGfx = new PIXI.Graphics();
        this._pixiFrontGfx.blendMode = PIXI.BLEND_MODES.ADD;
        this._pixiContainer.addChild(this._pixiFrontGfx);

        // Layer 3: Blockers (gates, seals)
        this._pixiBlockerGfx = new PIXI.Graphics();
        this._pixiBlockerGfx.blendMode = PIXI.BLEND_MODES.ADD;
        this._pixiContainer.addChild(this._pixiBlockerGfx);

        if (pixiWorldRoot) {
            pixiWorldRoot.addChildAt(this._pixiContainer, 0); // Add at bottom
        }
        this._pixiReady = true;
    }

    cleanupPixi() {
        if (this._pixiContainer) {
            if (this._pixiContainer.parent) this._pixiContainer.parent.removeChild(this._pixiContainer);
            this._pixiContainer.destroy({ children: true });
        }
        this._pixiContainer = null;
        this._pixiBackGfx = null;
        this._pixiFrontGfx = null;
        this._pixiBlockerGfx = null;
        this._pixiReady = false;
    }

    updatePixi() {
        if (!this.active) {
            if (this._pixiContainer) this._pixiContainer.visible = false;
            return;
        }

        if (!this._pixiReady) this.initPixi();
        this._pixiContainer.visible = true;

        if (!player || !this._pixiBackGfx || !this._pixiFrontGfx || !this._pixiBlockerGfx) return;

        const z = currentZoom || ZOOM_LEVEL;
        const sh = canvas.height / z;
        // Determine visible range (slightly expanded to prevent popping)
        const y0 = player.pos.y - (sh * 0.5) - 1500;
        const y1 = player.pos.y + (sh * 0.5) + 1500;

        let i0 = this.bucketIndexForY(y1);
        let i1 = this.bucketIndexForY(y0);
        if (!isFinite(i0) || !isFinite(i1)) {
            i0 = 0;
            i1 = Math.max(0, (this.buckets ? this.buckets.length - 1 : 0));
        }
        const minIdx = Math.max(0, i0 - 1);
        const maxIdx = Math.min(this.buckets.length - 1, i1 + 1);

        const visibleSegments = [];
        const visibleOuter = [];
        const visibleInner = [];
        const segFinite = (s) => (s && isFinite(s.x0) && isFinite(s.y0) && isFinite(s.x1) && isFinite(s.y1));

        // Collect visible static segments
        for (let i = minIdx; i <= maxIdx; i++) {
            const b = this.buckets[i];
            if (!b) continue;
            for (let j = 0; j < b.length; j++) {
                const s = b[j];
                if (!segFinite(s)) continue;
                if (s.kind === 'outer') visibleOuter.push(s);
                else visibleInner.push(s);
            }
        }

        // Clear graphics
        this._pixiBackGfx.clear();
        this._pixiFrontGfx.clear();
        this._pixiBlockerGfx.clear();

        // 1. Draw Outer Walls
        // Back (Thick Dark)
        this._pixiBackGfx.lineStyle(18, 0x004678, 0.85);
        for (let s of visibleOuter) {
            this._pixiBackGfx.moveTo(s.x0, s.y0);
            this._pixiBackGfx.lineTo(s.x1, s.y1);
        }
        // Front (Thin Neon)
        this._pixiFrontGfx.lineStyle(3, 0x8cf0ff, 0.9);
        for (let s of visibleOuter) {
            this._pixiFrontGfx.moveTo(s.x0, s.y0);
            this._pixiFrontGfx.lineTo(s.x1, s.y1);
        }

        // 2. Draw Inner Walls
        // Back (Thick Dark)
        this._pixiBackGfx.lineStyle(8, 0x003c6e, 0.85);
        for (let s of visibleInner) {
            this._pixiBackGfx.moveTo(s.x0, s.y0);
            this._pixiBackGfx.lineTo(s.x1, s.y1);
        }
        // Front (Thin Neon)
        this._pixiFrontGfx.lineStyle(3, 0x00ffff, 0.85);
        for (let s of visibleInner) {
            this._pixiFrontGfx.moveTo(s.x0, s.y0);
            this._pixiFrontGfx.lineTo(s.x1, s.y1);
        }

        // 3. Draw Blockers (Gates, Seals, Rockfalls)
        this._pixiBlockerGfx.lineStyle(14, 0x003764, 0.95);
        const blockerSegs = [];

        // Helper to add segments
        const addIfVisible = (segs) => {
            if (!segs) return;
            for (let s of segs) {
                if (segFinite(s) && s.y0 >= y0 && s.y0 <= y1) blockerSegs.push(s);
            }
        };

        // Gates
        for (let gate of this.gates) {
            if (gate && !gate.open && gate.segments) addIfVisible(gate.segments);
        }
        // Doors
        for (let door of this.doors) {
            if (door && !door.open && door.segments) addIfVisible(door.segments);
        }
        // Entrance Seal
        if (this.entranceSeal) {
            addIfVisible(this.entranceSeal.segments);
            addIfVisible(this.entranceSeal.sideSegments);
        }
        // Exit Seal
        if (!this.exitUnlocked && this.exitSeal) {
            addIfVisible(this.exitSeal.segments);
            addIfVisible(this.exitSeal.sideSegments);
        }
        // Rockfalls
        for (let r of this.rockfalls) {
            if (r && !r.dead && r.state === 'fallen' && r.segments) addIfVisible(r.segments);
        }

        // Draw Blockers Back
        for (let s of blockerSegs) {
            this._pixiBlockerGfx.moveTo(s.x0, s.y0);
            this._pixiBlockerGfx.lineTo(s.x1, s.y1);
        }
        // Draw Blockers Front
        this._pixiBlockerGfx.lineStyle(3, 0x00ffff, 0.95);
        for (let s of blockerSegs) {
            this._pixiBlockerGfx.moveTo(s.x0, s.y0);
            this._pixiBlockerGfx.lineTo(s.x1, s.y1);
        }
    }

    bucketIndexForY(y) {
        const idx = Math.floor((this.startY - y) / this.stepY);
        return Math.max(0, Math.min(this.buckets.length - 1, idx));
    }

    boundsAt(y) {
        if (!this.leftPts || this.leftPts.length < 2) return { left: -1500, right: 1500 };
        const idx = Math.max(0, Math.min(this.leftPts.length - 1, Math.floor((this.startY - y) / this.stepY)));
        const l = this.leftPts[idx];
        const r = this.rightPts[idx];
        return { left: l ? l.x : -1500, right: r ? r.x : 1500 };
    }

    centerXAt(y) {
        const b = this.boundsAt(y);
        return (b.left + b.right) * 0.5;
    }

    segmentsNearY(y, spanBuckets = 3) {
        if (!this.buckets || this.buckets.length === 0) return [];
        const idx = this.bucketIndexForY(y);
        const segs = [];
        for (let i = Math.max(0, idx - spanBuckets); i <= Math.min(this.buckets.length - 1, idx + spanBuckets); i++) {
            const b = this.buckets[i];
            if (b && b.length) segs.push(...b);
        }
        // Closed gates add barrier segments. 
        for (let g = 0; g < this.gates.length; g++) {
            const gate = this.gates[g];
            if (!gate || gate.open) continue;
            if (Math.abs(gate.y - y) < this.stepY * (spanBuckets + 2)) {
                if (gate.segments && gate.segments.length) segs.push(...gate.segments);
            }
        }
        // Closed doors add barrier segments. 
        for (let d = 0; d < this.doors.length; d++) {
            const door = this.doors[d];
            if (!door || door.open) continue;
            if (door.segments && door.segments.length) {
                const yy = (door.segments[0].y0 + door.segments[0].y1) * 0.5;
                if (Math.abs(yy - y) < this.stepY * (spanBuckets + 2)) segs.push(...door.segments);
            }
        }
        // Entrance seal behind the player. 
        if (this.entranceSeal && this.entranceSeal.segments && this.entranceSeal.segments.length) {
            if (Math.abs(this.entranceSeal.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...this.entranceSeal.segments);
        }
        if (this.entranceSeal && this.entranceSeal.sideSegments && this.entranceSeal.sideSegments.length) {
            if (y > this.startY - this.stepY * (spanBuckets + 3) && y < this.entranceSeal.y + this.stepY * (spanBuckets + 3)) segs.push(...this.entranceSeal.sideSegments);
        }
        // Exit seal near the end of the cave (locked until the final boss is defeated).
        if (!this.exitUnlocked && this.exitSeal && this.exitSeal.segments && this.exitSeal.segments.length) {
            if (Math.abs(this.exitSeal.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...this.exitSeal.segments);
        }
        if (!this.exitUnlocked && this.exitSeal && this.exitSeal.sideSegments && this.exitSeal.sideSegments.length) {
            if (y > this.exitSeal.y - this.stepY * (spanBuckets + 3) && y < this.exitSeal.y + this.stepY * (spanBuckets + 6)) segs.push(...this.exitSeal.sideSegments);
        }
        // Rockfalls / arena reshaping segments. 
        for (let i = 0; i < this.rockfalls.length; i++) {
            const rf = this.rockfalls[i];
            if (!rf || rf.dead || rf.state !== 'fallen' || !rf.segments) continue;
            if (Math.abs(rf.pos.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...rf.segments);
        }
        // (Intentionally no arenaSegments; cave bosses do not spawn dynamic blocker walls.)
        return segs;
    }

    buildGateSegments(y) {
        const bounds = this.boundsAt(y);
        const left = bounds.left + 10;
        const right = bounds.right - 10;
        const segs = [];
        const rows = 2;
        for (let r = 0; r < rows; r++) {
            const ry = y + (r === 0 ? -40 : 40);
            const n = 22;
            const step = (right - left) / n;
            for (let i = 0; i < n; i++) {
                const x0 = left + i * step;
                const x1 = left + (i + 1) * step;
                const j0 = (Math.random() - 0.5) * 60;
                const j1 = (Math.random() - 0.5) * 60;
                segs.push({ x0, y0: ry + j0, x1, y1: ry + j1, kind: 'gate' });
            }
        }
        return segs;
    }

    openGate(index) {
        const gate = this.gates[index];
        if (!gate || gate.open) return;
        gate.open = true;
        this.bossesDefeated++;
        showOverlayMessage(`GATE ${this.bossesDefeated}/3 OPEN`, '#0ff', 1600, 2);
    }

    applyWallCollisions(entity) {
        if (!this.active || !entity || entity.dead) return;
        const segs = this.segmentsNearY(entity.pos.y, 3);
        const elasticity = (entity === player) ? 0.92 : 0.55;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            resolveCircleSegment(entity, s.x0, s.y0, s.x1, s.y1, elasticity);
        }
        this.applyFireWallCollision(entity);
    }

    applyFireWallCollision(entity) {
        if (!this.fireWall || !entity || entity.dead) return;
        const radius = entity.radius || 0;
        const limitY = this.fireWall.y - radius;

        // If entity is below the firewall (caught in fire), destroy it
        if (entity.pos.y > limitY + radius * 0.5) {
            if (typeof entity.kill === 'function') {
                entity.kill();
            } else if (typeof entity.die === 'function') {
                entity.die();
            }
            entity.dead = true;
            return;
        }

        // Otherwise push it up ahead of the firewall
        if (entity.pos.y > limitY) {
            entity.pos.y = limitY;
            if (entity.vel && entity.vel.y > 0) entity.vel.y = 0;
        }
    }

    bulletHitsWall(bullet) {
        const segs = this.segmentsNearY(bullet.pos.y, 2);
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const cp = closestPointOnSegment(bullet.pos.x, bullet.pos.y, s.x0, s.y0, s.x1, s.y1);
            const dx = bullet.pos.x - cp.x;
            const dy = bullet.pos.y - cp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < (bullet.radius || 0) + 0.8) return true;
        }
        return false;
    }

    clipInterior(ctx, camY, height, zoom) {
        // (Kept for future use) 
        if (!this.active) return;
        const z = zoom || (currentZoom || ZOOM_LEVEL);
        const y0 = camY - 1400;
        const y1 = camY + (height / z) + 1400;
        const step = this.stepY;
        ctx.beginPath();
        for (let y = y0; y <= y1; y += step) {
            const b = this.boundsAt(y);
            if (y === y0) ctx.moveTo(b.left, y);
            else ctx.lineTo(b.left, y);
        }
        for (let y = y1; y >= y0; y -= step) {
            const b = this.boundsAt(y);
            ctx.lineTo(b.right, y);
        }
        ctx.closePath();
        ctx.clip();
    }

    toggleDoor(id) {
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            if (d && d.id === id) {
                d.open = !d.open;
                showOverlayMessage(d.open ? "DOOR OPENED" : "DOOR CLOSED", '#0ff', 900, 1);
                return;
            }
        }
    }

    spawnGateRelays(gateIndex) {
        const gate = this.gates[gateIndex];
        if (!gate || gate.open || gate.relaysSpawned || !gate.relaysEnabled) return;
        gate.relaysSpawned = true;
        gate.relaysCleared = false;
        gate.relaysRemaining = 4;
        const y = gate.y + 1400;
        const b = this.boundsAt(y);
        const cx = (b.left + b.right) * 0.5;
        const offsets = [
            { x: -700, y: 0 },
            { x: 700, y: 0 },
            { x: -350, y: 520 },
            { x: 350, y: 520 }
        ];
        for (let i = 0; i < offsets.length; i++) {
            const rx = cx + offsets[i].x + (Math.random() - 0.5) * 120;
            const ry = y + offsets[i].y + (Math.random() - 0.5) * 120;
            const clampedX = Math.max(b.left + 260, Math.min(b.right - 260, rx));
            this.relays.push(new CavePowerRelay(clampedX, ry, gateIndex));
        }
        showOverlayMessage("GATE SHIELD: DESTROY 4 RELAYS", '#ff0', 2200, 3);
    }

    onRelayDestroyed(gateIndex) {
        const gate = this.gates[gateIndex];
        if (!gate || gate.open || !gate.relaysEnabled || !gate.relaysSpawned || gate.relaysCleared) return;
        gate.relaysRemaining = Math.max(0, (gate.relaysRemaining || 0) - 1);
        showOverlayMessage(`RELAYS LEFT: ${gate.relaysRemaining}`, '#ff0', 800, 2);
        if (gate.relaysRemaining <= 0) {
            gate.relaysCleared = true;
            showOverlayMessage("GATE SHIELD DOWN", '#0f0', 1600, 3);
            playSound('powerup');
            if (!gate.bossEnabled) {
                this.openGate(gateIndex);
            }
        }
    }

    drawGridBackground(ctx, camX, camY, width, height, zoom) {
        let z = zoom || (currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) z = ZOOM_LEVEL;
        const w = width / z;
        const h = height / z;
        const grid = 420;
        const minor = 210;

        const x0 = Math.floor((camX - 1200) / minor) * minor;
        const x1 = camX + w + 1200;
        const y0 = Math.floor((camY - 1200) / minor) * minor;
        const y1 = camY + h + 1200;

        ctx.save();
        ctx.lineWidth = 1 / z;
        ctx.globalAlpha = 1;

        // Minor grid 
        ctx.strokeStyle = 'rgba(0,255,255,0.05)';
        ctx.beginPath();
        for (let x = x0; x <= x1; x += minor) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
        }
        for (let y = y0; y <= y1; y += minor) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
        }
        ctx.stroke();

        // Major grid 
        ctx.strokeStyle = 'rgba(0,255,255,0.10)';
        ctx.beginPath();
        const gx0 = Math.floor((camX - 1200) / grid) * grid;
        const gy0 = Math.floor((camY - 1200) / grid) * grid;
        for (let x = gx0; x <= x1; x += grid) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
        }
        for (let y = gy0; y <= y1; y += grid) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawFireWall(ctx, camX, camY, width, height, zoom) {
        if (!this.fireWall) return;
        const z = zoom || (currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) return;
        const viewTop = camY - 1200;
        const viewBottom = camY + (height / z) + 1200;
        const rangeTop = Math.min(this.startY, this.fireWall.y);
        const rangeBottom = Math.max(this.startY, this.fireWall.y);
        if (rangeBottom < viewTop || rangeTop > viewBottom) return;
        const drawTop = Math.max(rangeTop, viewTop);
        const drawBottom = Math.min(rangeBottom, viewBottom);
        if (drawBottom <= drawTop) return;
        const worldWidth = width / z;
        const padding = 720;
        ctx.save();
        ctx.globalAlpha = 0.35;
        const gradient = ctx.createLinearGradient(camX - padding, drawTop, camX - padding, drawBottom);
        gradient.addColorStop(0, 'rgba(255,165,72,0.85)');
        gradient.addColorStop(0.6, 'rgba(255,80,0,0.65)');
        gradient.addColorStop(1, 'rgba(255,0,0,0.25)');
        ctx.fillStyle = gradient;
        ctx.fillRect(camX - padding, drawTop, worldWidth + padding * 2, drawBottom - drawTop);
        ctx.strokeStyle = 'rgba(255,200,120,0.6)';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.moveTo(camX - padding, this.fireWall.y);
        ctx.lineTo(camX + worldWidth + padding, this.fireWall.y);
        ctx.stroke();
        ctx.restore();
    }

    update(deltaTime = 16.67) {
        if (!this.active) return;
        if (!player || player.dead) return;

        this.updateFireWall(deltaTime);

        // Update hazards / drafts. 
        for (let i = 0; i < this.gasVents.length; i++) {
            const h = this.gasVents[i];
            if (h && !h.dead) h.update();
        }
        for (let i = 0; i < this.draftZones.length; i++) {
            const d = this.draftZones[i];
            if (d) d.update();
        }
        for (let i = 0; i < this.rockfalls.length; i++) {
            const r = this.rockfalls[i];
            if (r && !r.dead) r.update();
        }

        // Ambient cave life. 
        this.critterSpawnCooldown--;
        if (this.critterSpawnCooldown <= 0) {
            const living = this.critters.filter(c => c && !c.dead).length;
            if (living < 10) {
                const y = player.pos.y - (800 + Math.random() * 2200);
                const b = this.boundsAt(y);
                const x = b.left + 260 + Math.random() * Math.max(200, (b.right - b.left - 520));
                this.critters.push(new CaveCritter(x, y));
            }
            this.critterSpawnCooldown = 260 + Math.floor(Math.random() * 240);
        }
        for (let i = 0; i < this.critters.length; i++) {
            const c = this.critters[i];
            if (c && !c.dead) c.update();
        }
        compactArray(this.critters);

        // Update switches + rewards. 
        for (let i = 0; i < this.switches.length; i++) {
            const s = this.switches[i];
            if (s && !s.dead) s.update();
        }
        compactArray(this.switches);
        for (let i = 0; i < this.rewards.length; i++) {
            const r = this.rewards[i];
            if (r && !r.dead) r.update();
        }
        compactArray(this.rewards);
        for (let i = 0; i < this.relays.length; i++) {
            const r = this.relays[i];
            if (r && !r.dead) r.update();
        }
        compactArray(this.relays);

        // Reward pickup handling. 
        for (let i = 0; i < this.rewards.length; i++) {
            const rw = this.rewards[i];
            if (!rw || rw.dead) continue;
            const d = Math.hypot(player.pos.x - rw.pos.x, player.pos.y - rw.pos.y);
            if (d < player.radius + rw.radius) {
                rw.dead = true;
                if (rw.rewardType === 'coins') {
                    awardCoinsInstant(14 * 3, { noSound: false, sound: 'coin', color: '#ff0' });
                    showOverlayMessage("CACHE FOUND", '#0f0', 1000, 2);
                } else if (rw.rewardType === 'nugs') {
                    const count = 10 + Math.floor(Math.random() * 9);
                    for (let k = 0; k < count; k++) {
                        nuggets.push(new SpaceNugget(rw.pos.x + (Math.random() - 0.5) * 180, rw.pos.y + (Math.random() - 0.5) * 180, 1));
                    }
                    showOverlayMessage(`NUGZ CACHE +${count}`, '#fa0', 1200, 2);
                    playSound('coin');
                } else if (rw.rewardType === 'shield') {
                    if (player.outerShieldSegments && player.outerShieldSegments.length) player.outerShieldSegments = player.outerShieldSegments.map(() => 1);
                    if (player.shieldSegments && player.shieldSegments.length) player.shieldSegments = player.shieldSegments.map(() => 2);
                    updateHealthUI();
                    showOverlayMessage("SHIELDS REFILLED", '#0ff', 1200, 2);
                    playSound('powerup');
                } else if (rw.rewardType === 'upgrade') {
                    showOverlayMessage("UPGRADE CACHE", '#f0f', 1200, 3);
                    playSound('levelup');
                    gameActive = false;
                    showLevelUpMenu();
                } else if (rw.rewardType === 'fragment') {
                    player.caveKeyFragments = (player.caveKeyFragments || 0) + 1;
                    showOverlayMessage(`KEY FRAGMENT ${player.caveKeyFragments}/4`, '#ff0', 1200, 2);
                    playSound('coin');
                    if (player.caveKeyFragments >= 4) {
                        player.caveKeyFragments = 0;
                        showOverlayMessage("FRAGMENTS COMPLETE: BONUS UPGRADE", '#ff0', 1600, 3);
                        playSound('levelup');
                        gameActive = false;
                        showLevelUpMenu();
                    }
                }
            }
        }

        // Spawn a wave shortly before each closed gate to warn the player.
        for (let i = 0; i < this.gates.length; i++) {
            const gate = this.gates[i];
            if (!gate || gate.open || gate.preSpawned) continue;
            const dY = player.pos.y - gate.y;
            // Approaching from below (player y > gate y): spawn before reaching the barrier.
            if (dY < 9000 && dY > 3200) {
                gate.preSpawned = true;
                const spawnY = gate.y + 1600 + Math.random() * 700;
                const b = this.boundsAt(spawnY);
                const cx = (b.left + b.right) * 0.5;
                const count = 4 + i;
                for (let k = 0; k < count; k++) {
                    const typeRoll = Math.random();
                    // Hunters should be rare in the cave; mostly defenders/roamers.
                    const type = typeRoll < 0.74 ? 'defender' : (typeRoll < 0.94 ? 'roamer' : 'hunter');
                    enemies.push(new Enemy(type, { x: cx + (Math.random() - 0.5) * 900, y: spawnY + (Math.random() - 0.5) * 500 }, null));
                }
                showOverlayMessage("CAVE DEFENDERS AHEAD", '#f0f', 1400, 2);
            }
        }

        // Mini-objective: destroy relays to drop the gate shield. 
        for (let i = 0; i < this.gates.length; i++) {
            const gate = this.gates[i];
            if (!gate || gate.open || gate.relaysCleared || !gate.relaysEnabled) continue;
            const dY = player.pos.y - gate.y;
            if (!gate.relaysSpawned && dY < 12000 && dY > 4200) {
                this.spawnGateRelays(i);
            }
            if (gate.relaysSpawned && !gate.relaysCleared) {
                gate.defendCd = Math.max(0, (gate.defendCd || 0) - 1);
                if ((gate.defendCd || 0) <= 0) {
                    const spawnY = gate.y + 1700 + Math.random() * 800;
                    const b = this.boundsAt(spawnY);
                    const sx = (b.left + b.right) * 0.5 + (Math.random() - 0.5) * 900;
                    enemies.push(new Enemy('defender', { x: sx, y: spawnY }, null));
                    if (Math.random() < 0.35) enemies.push(new Enemy('roamer', { x: sx + (Math.random() - 0.5) * 260, y: spawnY + 80 }, null));
                    gate.defendCd = 140 + Math.floor(Math.random() * 120);
                }
            }
        }

        // Activate gate bosses when the player reaches a closed gate. 
        for (let i = 0; i < this.gates.length; i++) {
            const gate = this.gates[i];
            if (!gate || gate.open) continue;
            if (gate.bossEnabled === false) {
                if (!gate.relaysEnabled || gate.relaysCleared) this.openGate(i);
                continue;
            }
            const dY = player.pos.y - gate.y;
            if (dY < 5200 && dY > -3800) {
                if (gate.relaysEnabled && !gate.relaysCleared) break;
                if (!bossActive || !boss || boss.dead) {
                    const bx = this.centerXAt(gate.y + 900);
                    const by = gate.y + 900;
                    boss = createCaveCruiserBoss(bx, by, { gateIndex: i });
                    bossActive = true;
                    showOverlayMessage(`CAVE BOSS ${i + 1}/3 ENGAGED`, '#f0f', 2400, 2);
                    playSound('boss_spawn');
                }
                break;
            }
        }

        // Spawn the super flagship near the end after 3 bosses.
        if (!this.finalSpawned && this.bossesDefeated >= 3 && player.pos.y < this.endY + 14000) {
            this.finalSpawned = true;
            const cx = this.centerXAt(this.endY + 5600);
            boss = createCaveCruiserBoss(cx, this.endY + 5600, { finalBoss: true });
            bossActive = true;
            showOverlayMessage("CAVE CRUISER DETECTED", '#0ff', 3500, 3);
            playSound('boss_spawn');
            if (musicEnabled) setMusicMode('cruiser');
        }

        // Update cave wall turrets. 
        for (let i = 0; i < this.wallTurrets.length; i++) {
            const t = this.wallTurrets[i];
            if (t && !t.dead) t.update();
        }
        compactArray(this.wallTurrets);

        // No dynamic boss-arena blockers in the cave. 
        this.arenaSegments = [];

        // Maintain ambient Level-1 enemies in the cave (no pinwheels/stations here). 
        this.enemySpawnCooldown--;
        if (this.enemySpawnCooldown <= 0) {
            const living = enemies.filter(e => e && !e.dead && (e.type === 'roamer' || e.type === 'elite_roamer' || e.type === 'hunter' || e.type === 'defender')).length;
            const cap = (bossActive ? 10 : 14) + Math.min(6, this.bossesDefeated * 2);
            if (living < cap) {
                const toSpawn = Math.min(2, cap - living);
                let gateLimitY = -Infinity;
                for (let i = 0; i < this.gates.length; i++) {
                    const g = this.gates[i];
                    if (!g || g.open) continue;
                    if (g.y < player.pos.y) gateLimitY = Math.max(gateLimitY, g.y);
                }
                for (let i = 0; i < toSpawn; i++) {
                    let y = player.pos.y - (1400 + Math.random() * 2800);
                    if (gateLimitY > -Infinity) y = Math.max(y, gateLimitY + 1100);
                    y = Math.min(y, player.pos.y - 900);
                    const b = this.boundsAt(y);
                    const x = b.left + 260 + Math.random() * Math.max(200, (b.right - b.left - 520));
                    const r = Math.random();
                    // Hunters should be rare in the cave; keep variety with defenders + occasional elites. 
                    const type = r < 0.30 ? 'roamer' : (r < 0.78 ? 'defender' : (r < 0.93 ? 'elite_roamer' : 'hunter'));
                    enemies.push(new Enemy(type, { x, y }, null));
                }
            }
            this.enemySpawnCooldown = 160 + Math.floor(Math.random() * 140);
        }
    }

    drawEntities(ctx, camX, camY, height, zoom) {
        if (!this.active) return;
        let z = zoom || (currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) z = ZOOM_LEVEL;
        const safeCamX = (isFinite(camX) ? camX : (player ? player.pos.x - (canvas.width / (2 * z)) : 0));
        const safeCamY = (isFinite(camY) ? camY : (player ? player.pos.y - (canvas.height / (2 * z)) : 0));
        const y0 = safeCamY - 1200;
        const y1 = safeCamY + (height / z) + 1200;

        // Legacy Canvas Entity Drawing (To be migrated)

        // Wall turrets  
        for (let i = 0; i < this.wallTurrets.length; i++) {
            const t = this.wallTurrets[i];
            if (!t || t.dead) continue;
            if (t.pos.y < y0 - 1600 || t.pos.y > y1 + 1600) {
                if (t._pixiContainer) t._pixiContainer.visible = false;
                continue;
            }
            t.draw(ctx);
        }

        // Switches / relays / rewards / hazards / critters / drafts 
        for (let i = 0; i < this.switches.length; i++) {
            const s = this.switches[i];
            if (!s || s.dead) continue;
            if (s.pos.y < y0 - 1600 || s.pos.y > y1 + 1600) {
                if (s._pixiContainer) s._pixiContainer.visible = false;
                continue;
            }
            s.draw(ctx);
        }
        for (let i = 0; i < this.relays.length; i++) {
            const r = this.relays[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 1600 || r.pos.y > y1 + 1600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.rewards.length; i++) {
            const r = this.rewards[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 1600 || r.pos.y > y1 + 1600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.gasVents.length; i++) {
            const h = this.gasVents[i];
            if (!h || h.dead) continue;
            if (h.pos.y < y0 - 2000 || h.pos.y > y1 + 2000) {
                if (h._pixiContainer) h._pixiContainer.visible = false;
                continue;
            }
            h.draw(ctx);
        }
        for (let i = 0; i < this.draftZones.length; i++) {
            const d = this.draftZones[i];
            if (!d) continue;
            if (d.pos.y < y0 - 2600 || d.pos.y > y1 + 2600) {
                if (d._pixiContainer) d._pixiContainer.visible = false;
                continue;
            }
            d.draw(ctx);
        }
        for (let i = 0; i < this.rockfalls.length; i++) {
            const r = this.rockfalls[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 2600 || r.pos.y > y1 + 2600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.critters.length; i++) {
            const c = this.critters[i];
            if (!c || c.dead) continue;
            if (c.pos.y < y0 - 1600 || c.pos.y > y1 + 1600) {
                if (c._pixiContainer) c._pixiContainer.visible = false;
                continue;
            }
            c.draw(ctx);
        }
    }
}

function createCaveCruiserBoss(x, y, opts = {}) {
    const gateIndex = (typeof opts.gateIndex === 'number') ? opts.gateIndex : null;
    const finalBoss = !!opts.finalBoss;
    const encounterIndex = (typeof opts.encounterIndex === 'number')
        ? opts.encounterIndex
        : (finalBoss ? 3 : (gateIndex !== null ? Math.max(1, gateIndex) : 1));

    const c = new Cruiser(encounterIndex);
    c.pos.x = x;
    c.pos.y = y;
    c.vel.x = 0;
    c.vel.y = 0;
    c.despawnImmune = true;
    c.isCaveBoss = true;
    c.isCaveFinalBoss = finalBoss;
    c.caveGateIndex = gateIndex;
    c.circleStrafePreferred = false;
    c.aiState = 'SEEK';
    c.moveMode = 'SEEK';
    c.moveModeTimer = 999999;

    // All cave cruisers have guided missiles.
    c.guidedMissileEnabled = true;
    c.guidedMissileInterval = finalBoss ? 150 : 180;
    c.guidedMissileCap = finalBoss ? 3 : 2;
    c.guidedMissileCd = 90;

    // In the cave, the cruiser should actively chase the player.
    const baseUpdate = c.update.bind(c);
    c.update = function () {
        if (this.dead) return;
        this.circleStrafePreferred = false;
        this.aiState = 'SEEK';
        this.moveMode = 'SEEK';
        this.moveModeTimer = 999999;

        baseUpdate();

        if (!bossActive || boss !== this) return;
        if (!player || player.dead) return;

        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = finalBoss ? 0.11 : 0.09;
        this.vel.x += (dx / dist) * pull;
        this.vel.y += (dy / dist) * pull;

        const sp = Math.hypot(this.vel.x, this.vel.y) || 1;
        const vmax = finalBoss ? 4.8 : 4.3;
        if (sp > vmax) {
            this.vel.x = (this.vel.x / sp) * vmax;
            this.vel.y = (this.vel.y / sp) * vmax;
        }
    };

    c.kill = function () {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        playSound('base_explode');
        spawnParticles(this.pos.x, this.pos.y, finalBoss ? 140 : 110, '#f0f');
        clearArrayWithPixiCleanup(bossBombs);
        clearArrayWithPixiCleanup(guidedMissiles);

        for (let i = 0; i < (finalBoss ? 22 : 14); i++) coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 140, this.pos.y + (Math.random() - 0.5) * 140, 10));
        for (let i = 0; i < (finalBoss ? 10 : 6); i++) nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 200, this.pos.y + (Math.random() - 0.5) * 200, 1));
        powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

        if (gateIndex !== null) {
            try { if (caveLevel && caveLevel.active) caveLevel.openGate(gateIndex); } catch (e) { }
            showOverlayMessage(`CAVE CRUISER ${gateIndex + 1} DESTROYED`, '#0f0', 2600, 3);
        } else {
            showOverlayMessage("CAVE CRUISER DESTROYED - WARP CORE CHARGING", '#0ff', 3500, 3);
        }

        bossActive = false;
        bossArena.active = false;
        bossArena.growing = false;
        if (boss) pixiCleanupObject(boss);
        boss = null;

        if (musicEnabled) setMusicMode('normal');
        if (finalBoss) {
            try { if (caveLevel && caveLevel.active) caveLevel.exitUnlocked = true; } catch (e) { }
        }
        if (finalBoss && !sectorTransitionActive) startSectorTransition();
    };

    return c;
}

function startCaveSector2() {
    // Ensure no world-mode carryover. 
    resetWarpState();
    caveMode = true;
    caveLevel = new CaveLevel();
    caveLevel.generate();
    clearArrayWithPixiCleanup(coins);

    // Disable contracts/events for the cave run.
    activeContract = null;
    contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    nextContractAt = Date.now() + 999999999;
    radiationStorm = null;
    nextRadiationStormAt = null;
    clearMiniEvent();
    nextMiniEventAt = Date.now() + 999999999;
    nextShootingStarTime = Date.now() + 999999999;
    intensityBreakActive = false;
    nextIntensityBreakAt = Date.now() + 999999999;

    // Keep bases in the cave (Sector 1 feel), but no stations/contracts. 
    clearArrayWithPixiCleanup(pinwheels);
    baseRespawnTimers = [];
    roamerRespawnQueue = [];
    maxRoamers = 0;
    initialSpawnDone = true;
    initialSpawnDelayAt = null;
    pendingStations = 0;
    if (spaceStation) pixiCleanupObject(spaceStation);
    spaceStation = null;
    nextSpaceStationTime = null;

    // Place player at the cave start (bottom), facing upward.
    player.pos.x = caveLevel.startX;
    player.pos.y = caveLevel.startY + 600;
    player.vel.x = 0;
    player.vel.y = 0;
    player.angle = -Math.PI / 2;
    player.turretAngle = -Math.PI / 2;

    caveLevel.resetFireWall(player.pos.y);

    // Seed a few pinwheels up the tunnel (they'll also respawn via the normal pinwheel timer loop).
    for (let i = 0; i < 3; i++) spawnNewPinwheelRelative(true);

    showOverlayMessage("SECTOR 2: CAVE RUN - FLY UPWARD", '#0ff', 3200, 2);
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    let t = 0;
    if (abLenSq > 0.000001) t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return { x: ax + abx * t, y: ay + aby * t, t };
}

function resolveCircleSegment(entity, ax, ay, bx, by, elasticity = 0.7) {
    const cp = closestPointOnSegment(entity.pos.x, entity.pos.y, ax, ay, bx, by);
    let dx = entity.pos.x - cp.x;
    let dy = entity.pos.y - cp.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.0001) {
        // Fallback: choose a stable normal.
        const sx = bx - ax;
        const sy = by - ay;
        const nLen = Math.hypot(sx, sy) || 1;
        dx = -sy / nLen;
        dy = sx / nLen;
        dist = 1;
    }
    const pad = 0.5;
    const minDist = (entity.radius || 0) + pad;
    if (dist >= minDist) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    entity.pos.x += nx * overlap;
    entity.pos.y += ny * overlap;

    if (entity.vel) {
        const vn = entity.vel.x * nx + entity.vel.y * ny;
        if (vn < 0) {
            entity.vel.x -= nx * vn * (1 + elasticity);
            entity.vel.y -= ny * vn * (1 + elasticity);
        }
    }
    return true;
}

class WarpTurret extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 24;
        this.hp = 7;
        this.maxHp = 7;
        this.reload = 35 + Math.floor(Math.random() * 25);
        this.t = 0;
    }
    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (!warpZone || !warpZone.active) return;
        if (!player || player.dead) return;
        // Keep maze turrets as "obstacles", not part of the boss arena phase.
        if (warpZone.state === 'boss') return;

        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dist > 4200) return;

        this.reload--;
        if (this.reload > 0) return;

        const aim = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
        const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
        const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
        bullets.push(new Bullet(muzzleX, muzzleY, aim, true, 1, 12, 4, '#0ff'));
        if (Math.random() < 0.18) bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.10, true, 1, 12, 4, '#0ff'));
        if (Math.random() < 0.18) bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.10, true, 1, 12, 4, '#0ff'));
        this.reload = 48 + Math.floor(Math.random() * 35);
    }
    draw(ctx) {
        if (this.dead) return;
        const z = currentZoom || ZOOM_LEVEL;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const aim = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;
        ctx.rotate(aim);

        ctx.fillStyle = '#061018';
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2 / z;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0ff';
        ctx.shadowBlur = 0;
        ctx.fillRect(this.radius * 0.2, -4 / z, this.radius * 1.35, 8 / z);

        // HP ring
        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#ff6';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + (8 / z), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.restore();
    }
    kill() {
        if (this.dead) return;
        this.dead = true;
        // No coin drops in the cave; award instantly instead. 
        if (caveMode && caveLevel && caveLevel.active) awardCoinsInstant(6);
        else for (let i = 0; i < 3; i++) coins.push(new Coin(this.pos.x, this.pos.y, 2));
        spawnParticles(this.pos.x, this.pos.y, 18, '#0ff');
        playSound('explode');
    }
}

class WarpMazeZone extends Entity {
    constructor(x, y) {
        super(x, y);
        this.active = true;
        this.state = 'maze'; // 'maze' | 'boss' | 'escape'
        this.exitUnlocked = false;
        this.generated = false;
        this.t = 0;
        this.mobWaveBand = null;
        this.mobSpawnCooldown = 0;
        this.mobCap = 10;

        this.boundaryRadius = 6200;
        this.entryAngle = Math.random() * Math.PI * 2;
        this.exitAngle = this.entryAngle + Math.PI;
        this.arenaRadius = 2600;

        // Rings define the "maze". Each ring has a gap you must find to get inward. 
        const a = this.entryAngle;
        this.rings = [
            // Multiple openings per ring so the maze never "feels sealed".
            { r: 5400, gaps: [a, a + Math.PI], width: 0.55, turretCount: 6 },
            { r: 4400, gaps: [a + Math.PI / 2, a + (Math.PI * 3 / 2)], width: 0.50, turretCount: 6 },
            { r: 3400, gaps: [a + Math.PI, a], width: 0.48, turretCount: 5 },
            // Arena ring: 4 entrances so you can always reach the center.
            { r: this.arenaRadius, gaps: [a, a + Math.PI / 2, a + Math.PI, a + (Math.PI * 3 / 2)], width: 0.65, turretCount: 0, isArena: true }
        ];

        this.segments = [];      // fixed walls
        this.dynamicSegments = []; // doors/locks
        this.turrets = [];

        this.entrancePos = {
            x: this.pos.x + Math.cos(this.entryAngle) * (this.boundaryRadius - 420),
            y: this.pos.y + Math.sin(this.entryAngle) * (this.boundaryRadius - 420)
        };

        // Put the exit gate on the opposite side so you can't immediately re-trigger it. 
        this.exitPos = {
            x: this.pos.x + Math.cos(this.exitAngle) * (this.boundaryRadius - 420),
            y: this.pos.y + Math.sin(this.exitAngle) * (this.boundaryRadius - 420)
        };
    }

    buildRing(r, gaps, width, step = 0.06) {
        const segs = [];
        for (let ang = 0; ang < Math.PI * 2; ang += step) {
            const a0 = ang;
            const a1 = Math.min(Math.PI * 2, ang + step);
            let inGap = false;
            for (const g of gaps) {
                let d = a0 - g;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                if (Math.abs(d) < width) { inGap = true; break; }
            }
            if (inGap) continue;
            const x0 = this.pos.x + Math.cos(a0) * r;
            const y0 = this.pos.y + Math.sin(a0) * r;
            const x1 = this.pos.x + Math.cos(a1) * r;
            const y1 = this.pos.y + Math.sin(a1) * r;
            segs.push({ x0, y0, x1, y1 });
        }
        return segs;
    }

    generate() {
        if (this.generated) return;
        this.generated = true;
        this.segments = [];
        this.dynamicSegments = [];

        // Outer boundary: no gaps (keeps you in the warp area).
        this.segments.push(...this.buildRing(this.boundaryRadius, [], 0));

        // Maze rings
        for (const ring of this.rings) {
            const gaps = ring.gaps || [ring.gap];
            this.segments.push(...this.buildRing(ring.r, gaps, ring.width));
        }

        // Maze turrets placed along outer rings away from gaps.
        this.turrets = [];
        // Extra boundary turrets to make the warp perimeter feel defended (avoid the entrance direction).
        const boundaryTurrets = 10;
        for (let i = 0; i < boundaryTurrets; i++) {
            for (let attempt = 0; attempt < 50; attempt++) {
                const ang = Math.random() * Math.PI * 2;
                let d = ang - this.entryAngle;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                if (Math.abs(d) < 0.7) continue;
                const rr = this.boundaryRadius - 260;
                const x = this.pos.x + Math.cos(ang) * rr;
                const y = this.pos.y + Math.sin(ang) * rr;
                this.turrets.push(new WarpTurret(x, y));
                break;
            }
        }
        for (const ring of this.rings) {
            if (ring.isArena) continue;
            const gaps = ring.gaps || [ring.gap];
            for (let i = 0; i < ring.turretCount; i++) {
                for (let attempt = 0; attempt < 40; attempt++) {
                    const ang = Math.random() * Math.PI * 2;
                    let nearGap = false;
                    for (const g of gaps) {
                        let d = ang - g;
                        while (d > Math.PI) d -= Math.PI * 2;
                        while (d < -Math.PI) d += Math.PI * 2;
                        if (Math.abs(d) < ring.width + 0.35) { nearGap = true; break; }
                    }
                    if (nearGap) continue;
                    const rr = ring.r + 95;
                    const x = this.pos.x + Math.cos(ang) * rr;
                    const y = this.pos.y + Math.sin(ang) * rr;
                    this.turrets.push(new WarpTurret(x, y));
                    break;
                }
            }
        }

        showOverlayMessage("WARP MAZE: NAVIGATE TO THE CORE", '#0ff', 2200, 2);

        // Seed some roamers so the zone isn't empty.
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = this.boundaryRadius - 900 - Math.random() * 900;
            const x = this.pos.x + Math.cos(a) * rr;
            const y = this.pos.y + Math.sin(a) * rr;
            const e = new Enemy('roamer', { x, y });
            e.despawnImmune = true;
            enemies.push(e);
        }
    }

    update(deltaTime = 16.67) {
        if (!this.active) return;
        this.t++;
        if (!this.generated) this.generate();

        // Spawn roamers in waves as the player moves inward.
        if (this.mobSpawnCooldown > 0) this.mobSpawnCooldown--;
        if (this.state === 'maze' && player && !player.dead) {
            const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            const band =
                dist > 5400 ? 0 :
                    dist > 4400 ? 1 :
                        dist > 3400 ? 2 :
                            dist > this.arenaRadius ? 3 :
                                4;

            if (this.mobWaveBand === null) this.mobWaveBand = band;
            const movedInward = band > this.mobWaveBand;
            this.mobWaveBand = band;

            const living = enemies.filter(e => e && !e.dead && (e.type === 'roamer' || e.type === 'elite_roamer' || e.type === 'hunter' || e.type === 'defender')).length;
            const wantCap = this.mobCap;
            if ((movedInward || this.mobSpawnCooldown === 0) && living < wantCap) {
                const spawnCount = movedInward ? 4 : 2;
                for (let i = 0; i < spawnCount && enemies.length < 300; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const rr = Math.max(this.arenaRadius + 220, Math.min(this.boundaryRadius - 380, dist + 900 + Math.random() * 700));
                    const x = this.pos.x + Math.cos(a) * rr;
                    const y = this.pos.y + Math.sin(a) * rr;
                    const distP = Math.hypot(x - player.pos.x, y - player.pos.y);
                    if (distP < 650) continue;
                    const typeRoll = Math.random();
                    const type = (band >= 2 && typeRoll < 0.12) ? 'elite_roamer' : 'roamer';
                    const e = new Enemy(type, { x, y });
                    e.despawnImmune = true;
                    enemies.push(e);
                }
                this.mobSpawnCooldown = movedInward ? 120 : 180;
            }
        }

        // Dynamic door: lock the arena ring while the boss is alive.
        this.dynamicSegments = [];
        const arena = this.rings.find(r => r.isArena);
        if (arena && this.state === 'boss' && bossActive && boss && !boss.dead) {
            // Seal *all* entrances by overlaying a full ring (no gaps).
            this.dynamicSegments = this.buildRing(arena.r, [], 0);
        }

        this.turrets.forEach(t => t.update());
        compactArray(this.turrets);

        // Start boss when player reaches the core (inside the arena ring).
        if (this.state === 'maze' && player && !player.dead) {
            const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (dist < this.arenaRadius - 300) {
                this.state = 'boss';
                // Keep the boss arena readable by clearing asteroids near the core.
                filterArrayWithPixiCleanup(environmentAsteroids, a => !a.dead && (Math.hypot(a.pos.x - this.pos.x, a.pos.y - this.pos.y) > this.arenaRadius + 260));
                showOverlayMessage("WARP SENTINEL ENGAGED", '#f0f', 2200, 3);
                playSound('boss_spawn');
                clearArrayWithPixiCleanup(enemies); // keep the fight clean
                clearArrayWithPixiCleanup(pinwheels);
                filterArrayWithPixiCleanup(bullets, b => !b.isEnemy);
                clearArrayWithPixiCleanup(bossBombs);
                boss = new WarpSentinelBoss(this.pos.x, this.pos.y, this);
                bossActive = true;
            }
        }

        if (this.state === 'boss' && (!bossActive || !boss || boss.dead)) {
            this.state = 'escape';
        }
    }

    allSegments() {
        return [...this.segments, ...(this.dynamicSegments || [])];
    }

    applyWallCollisions(entity) {
        if (!this.active || !entity || entity.dead) return;
        const segs = this.allSegments();
        const elasticity = (entity === player) ? 0.85 : (entity.isWarpBoss ? 0.75 : 0.55);
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            resolveCircleSegment(entity, s.x0, s.y0, s.x1, s.y1, elasticity);
        }
    }

    bulletHitsWall(bullet) {
        const segs = this.allSegments();
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const cp = closestPointOnSegment(bullet.pos.x, bullet.pos.y, s.x0, s.y0, s.x1, s.y1);
            const dx = bullet.pos.x - cp.x;
            const dy = bullet.pos.y - cp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < (bullet.radius || 0) + 0.8) return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.active) return;
        const z = currentZoom || ZOOM_LEVEL;
        const segs = this.allSegments();
        ctx.save();
        ctx.lineWidth = 1 / z; // 1px lines in screen space
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#0ff';
        ctx.strokeStyle = 'rgba(0,255,255,0.65)';
        ctx.beginPath();
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            ctx.moveTo(s.x0, s.y0);
            ctx.lineTo(s.x1, s.y1);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arena outline glow for readability.
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 3 / z;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#f0f';
        ctx.strokeStyle = 'rgba(255,0,255,0.35)';
        const arenaRing = this.rings.find(r => r.isArena);
        const arenaGaps = arenaRing ? (arenaRing.gaps || [arenaRing.gap]) : [];
        const arenaGapWidth = arenaRing ? arenaRing.width : 0.65;
        const ringStep = 0.12;
        ctx.beginPath();
        for (let ang = 0; ang < Math.PI * 2; ang += ringStep) {
            const a0 = ang;
            const a1 = Math.min(Math.PI * 2, ang + ringStep);
            let inGap = false;
            for (const g of arenaGaps) {
                let d = a0 - g;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                if (Math.abs(d) < arenaGapWidth) { inGap = true; break; }
            }
            if (inGap) continue;
            ctx.moveTo(Math.cos(a0) * this.arenaRadius, Math.sin(a0) * this.arenaRadius);
            ctx.arc(0, 0, this.arenaRadius, a0, a1);
        }
        ctx.stroke();
        ctx.restore();

        ctx.restore();

        // Draw warp turrets (separate from global enemies list).
        if (this.turrets && this.turrets.length > 0) {
            for (let i = 0; i < this.turrets.length; i++) {
                const t = this.turrets[i];
                if (t && !t.dead) t.draw(ctx);
            }
        }
    }
}

class RadiationStorm extends Entity {
    constructor(x, y, radius = 900, durationMs = 45000) {
        super(x, y);
        this.radius = radius;
        this.endsAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now()) + durationMs;
        this.t = 0;
        this.tick = 0;
        this.wasInside = false;
        this.shieldsDirty = true;
        this._pixiGfx = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        pixiCleanupObject(this);
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        this.t++;
        const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        if (now >= this.endsAt) {
            this.kill();
            return;
        }

        // FIX: Ensure storm is nullified after kill to prevent drawing dead storm
        if (this.dead) {
            if (radiationStorm === this) {
                radiationStorm = null;
            }
            return;
        }

        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        const inside = d < this.radius;
        if (inside) {
            if (!this.wasInside) {
                showOverlayMessage("RADIATION STORM - HIGH RISK ZONE", '#ff0', 1800);
            }
            this.tick++;
            if (this.tick % 60 === 0) {
                // Reward: XP + small gold drip
                player.addXp(4);
                coins.push(new Coin(player.pos.x + (Math.random() - 0.5) * 40, player.pos.y + (Math.random() - 0.5) * 40, 2));

                // Cost: drains shields (main shield first, then outer shield)
                let drained = false;
                const idx = player.shieldSegments.findIndex(s => s > 0);
                if (idx !== -1) {
                    player.shieldSegments[idx] = Math.max(0, player.shieldSegments[idx] - 1);
                    drained = true;
                } else if (player.outerShieldSegments && player.outerShieldSegments.some(s => s > 0)) {
                    const o = player.outerShieldSegments.findIndex(s => s > 0);
                    if (o !== -1) {
                        player.outerShieldSegments[o] = 0;
                        drained = true;
                    }
                }
                if (drained) {
                    spawnParticles(player.pos.x, player.pos.y, 6, '#ff0');
                    playSound('shield_hit');
                }
            }
        } else {
            this.tick = 0;
        }
        this.wasInside = inside;
    }
    draw(ctx) {
        if (this.dead) return;

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            this._pixiGfx.clear();
            const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
            const remaining = Math.max(0, this.endsAt - now);
            const lifeT = Math.min(1, remaining / 45000);
            const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.03)) * 0.25;

            this._pixiGfx.position.set(this.pos.x, this.pos.y);

            // Outer Ring
            const innerColor = 0xffdc00;
            const alpha = 0.35 + pulse;
            const lineWidth = 6 / Math.max(0.5, currentZoom || ZOOM_LEVEL);
            this._pixiGfx.lineStyle(lineWidth, innerColor, alpha);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            // Haze Fill
            const hazeAlpha = 0.08 + (1 - lifeT) * 0.08;
            this._pixiGfx.beginFill(0xffff00, hazeAlpha);
            this._pixiGfx.drawCircle(0, 0, this.radius);
            this._pixiGfx.endFill();

            // Sparks
            for (let i = 0; i < 8; i++) {
                const a = (this.t * 0.02) + i * (Math.PI * 2 / 8);
                const r = this.radius * (0.65 + 0.35 * Math.sin(this.t * 0.02 + i));
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                const sparkAlpha = 0.55;
                const sparkColor = 0xffa000 + ((i * 8) % 80) * 256; // approximation
                this._pixiGfx.beginFill(0xffaa00, sparkAlpha);
                this._pixiGfx.drawCircle(x, y, 4 + (i % 3));
                this._pixiGfx.endFill();
            }
            return;
        }

        const now = Date.now();
        const remaining = Math.max(0, this.endsAt - now);
        const lifeT = Math.min(1, remaining / 45000);
        const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.03)) * 0.25;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 6;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = `rgba(255, 220, 0, ${0.35 + pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // subtle haze fill
        ctx.globalAlpha = 0.08 + (1 - lifeT) * 0.08;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // sparks
        for (let i = 0; i < 8; i++) {
            const a = (this.t * 0.02) + i * (Math.PI * 2 / 8);
            const r = this.radius * (0.65 + 0.35 * Math.sin(this.t * 0.02 + i));
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            ctx.fillStyle = `rgba(255, ${160 + (i * 8) % 80}, 0, 0.55)`;
            ctx.beginPath();
            ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class MiniEventDefendCache extends Entity {
    constructor(x, y) {
        super(x, y);
        this.kind = 'defend_cache';
        this.radius = 520;
        this.requiredMs = 5000;
        this.progressMs = 0;
        this.expiresAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now()) + 75000;
        this.lastUpdateAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        this.nextWaveAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now()) + 1500;
        this.activated = false;
        this.t = 0;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiProgressGfx = null;
        this._pixiLabelText = null;
        this._pixiTimerText = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        // Ensure all Pixi graphics are hidden before cleanup to prevent visual artifacts
        if (this._pixiGfx && this._pixiGfx.visible !== false) {
            this._pixiGfx.visible = false;
        }
        if (this._pixiProgressGfx && this._pixiProgressGfx.visible !== false) {
            this._pixiProgressGfx.visible = false;
        }
        if (this._pixiLabelText && this._pixiLabelText.visible !== false) {
            this._pixiLabelText.visible = false;
        }
        if (this._pixiTimerText && this._pixiTimerText.visible !== false) {
            this._pixiTimerText.visible = false;
        }
        pixiCleanupObject(this);
    }
    update(deltaTime = 16.67) {
        if (this.dead) return;
        if (!player || player.dead) { this.fail(); return; }
        const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        const dt = Math.min(120, Math.max(0, now - this.lastUpdateAt));
        this.lastUpdateAt = now;
        this.t++;

        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (!this.activated && d < 900) {
            this.activated = true;
            showOverlayMessage("DEFEND THE CACHE - HOLD POSITION", '#ff0', 1500, 1);
        }

        if (now >= this.expiresAt) {
            this.fail();
            return;
        }

        if (d < this.radius) {
            this.progressMs += dt;
        }

        if (this.activated && now >= this.nextWaveAt) {
            this.spawnWave();
            this.nextWaveAt = now + 2600 + Math.floor(Math.random() * 1600);
        }

        if (this.progressMs >= this.requiredMs) {
            this.success();
        }
    }
    spawnWave() {
        const cap = 22;
        if (enemies.length >= cap) return;
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            if (enemies.length >= cap) break;
            const a = Math.random() * Math.PI * 2;
            const dist = 900 + Math.random() * 600;
            const sx = this.pos.x + Math.cos(a) * dist;
            const sy = this.pos.y + Math.sin(a) * dist;
            enemies.push(new Enemy('roamer', { x: sx, y: sy }));
        }
    }
    success() {
        if (this.dead) return;
        this.kill();
        showOverlayMessage("EVENT COMPLETE - CACHE SECURED", '#0f0', 2200, 1);
        playSound('powerup');
        player.addXp(60);
        spawnParticles(this.pos.x, this.pos.y, 40, '#ff0');
        for (let i = 0; i < 10; i++) coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 220, this.pos.y + (Math.random() - 0.5) * 220, 8));
    }
    fail() {
        if (this.dead) return;
        this.kill();
        showOverlayMessage("EVENT FAILED", '#f00', 2000, 1);
    }
    getUiText() {
        const pct = Math.max(0, Math.min(100, Math.floor((this.progressMs / this.requiredMs) * 100)));
        return `EVENT: DEFEND CACHE ${pct}%`;
    }
    draw(ctx) {
        if (this.dead) return;

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            if (!this._pixiProgressGfx) {
                this._pixiProgressGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiProgressGfx);
            }
            if (!this._pixiLabelText) {
                this._pixiLabelText = new PIXI.Text("DEFEND", { fontFamily: 'Courier New', fontSize: 48, fill: 0xffff00, fontWeight: 'bold' });
                this._pixiLabelText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiLabelText);
            }
            if (!this._pixiTimerText) {
                this._pixiTimerText = new PIXI.Text("", { fontFamily: 'Courier New', fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
                this._pixiTimerText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiTimerText);
            }

            const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
            const remain = Math.max(0, this.expiresAt - now);
            const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
            const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;

            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiProgressGfx.position.set(this.pos.x, this.pos.y);
            this._pixiLabelText.position.set(this.pos.x, this.pos.y - this.radius - 64);
            this._pixiTimerText.position.set(this.pos.x, this.pos.y - this.radius - 26);

            this._pixiGfx.clear();
            // boundary
            this._pixiGfx.lineStyle(6 / (currentZoom || 1), 0xffdc00, 0.45);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            // central area
            this._pixiGfx.beginFill(0xffff00, 0.35 * pulse);
            this._pixiGfx.drawCircle(0, 0, 54);
            this._pixiGfx.endFill();

            // progress
            this._pixiProgressGfx.clear();
            this._pixiProgressGfx.lineStyle(8 / (currentZoom || 1), 0x00ff00, 0.6);
            this._pixiProgressGfx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);

            this._pixiTimerText.text = `${(remain / 1000).toFixed(0)}s`;
            return;
        }

        const now = Date.now();
        const remain = Math.max(0, this.expiresAt - now);
        const pct = Math.max(0, Math.min(1, this.progressMs / this.requiredMs));
        const pulse = 0.85 + Math.sin(this.t * 0.08) * 0.15;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 6;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ff0';
        ctx.strokeStyle = 'rgba(255, 220, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();

        ctx.globalAlpha = 0.35 * pulse;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("DEFEND", 0, -this.radius - 64);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Courier New';
        ctx.fillText(`${(remain / 1000).toFixed(0)}s`, 0, -this.radius - 26);

        ctx.restore();
    }
}

class SectorPOI extends Entity {
    constructor(x, y, name, color = '#0ff', radius = 170) {
        super(x, y);
        this.kind = 'poi';
        this.name = name;
        this.color = color;
        this.radius = radius;
        this.claimed = false;
        this.t = 0;
        this.rewardXp = 20;
        this.rewardCoins = 30;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiNameText = null;
    }
    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
    }
    canClaim() {
        if (!player || player.dead) return false;
        if (this.claimed) return false;
        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        return d <= this.radius + player.radius;
    }
    claim() {
        if (this.claimed) return;
        this.claimed = true;
        showOverlayMessage(`POI CLEARED: ${this.name}`, '#0ff', 1600, 1);
        playSound('powerup');
        if (player) player.addXp(this.rewardXp);
        const coinsToSpawn = Math.max(1, Math.floor(this.rewardCoins / 8));
        for (let i = 0; i < coinsToSpawn; i++) {
            coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 220, this.pos.y + (Math.random() - 0.5) * 220, 8));
        }
        spawnParticles(this.pos.x, this.pos.y, 30, this.color);
        this.dead = true;
    }
    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (this.canClaim()) this.claim();
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            // Hide all Pixi graphics when dead or claimed
            if (this._pixiGfx) this._pixiGfx.visible = false;
            if (this._pixiNameText) this._pixiNameText.visible = false;
            return;
        }

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
            }
            if (!this._pixiNameText) {
                const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;
                this._pixiNameText = new PIXI.Text(this.name, { fontFamily: 'Courier New', fontSize: 42, fill: c, fontWeight: 'bold' });
                this._pixiNameText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiNameText);
            }
            this._pixiGfx.visible = true;
            this._pixiNameText.visible = true;

            const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiNameText.position.set(this.pos.x, this.pos.y - this.radius - 18);

            this._pixiGfx.clear();
            const c = parseInt(this.color.replace('#', '0x'), 16) || 0x00ffff;

            // boundary
            this._pixiGfx.lineStyle(5 / (currentZoom || 1), c, 0.35 + pulse * 0.15);
            this._pixiGfx.drawCircle(0, 0, this.radius);

            // center diamond
            this._pixiGfx.lineStyle(2 / (currentZoom || 1), 0xffffff, 1.0);
            this._pixiGfx.beginFill(c, 1.0);
            this._pixiGfx.moveTo(0, -18);
            this._pixiGfx.lineTo(16, 0);
            this._pixiGfx.lineTo(0, 18);
            this._pixiGfx.lineTo(-16, 0);
            this._pixiGfx.closePath();
            this._pixiGfx.endFill();
            return;
        }

        const pulse = 0.8 + Math.sin(this.t * 0.08) * 0.2;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.35 + pulse * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.font = 'bold 42px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 0, -this.radius - 18);
        ctx.restore();
    }
}

class DerelictShipPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DERELICT SHIP', '#0ff', 160);
        this.rewardXp = 25;
        this.rewardCoins = 32;
    }
}

class DebrisFieldPOI extends SectorPOI {
    constructor(x, y) {
        super(x, y, 'DEBRIS FIELD', '#fa0', 220);
        this.rewardXp = 20;
        this.rewardCoins = 40;
        this.captureMsRequired = 3000;
        this.captureMs = 0;
        this.captureActive = false;
        this.lastUpdateAt = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
    }
    kill() {
        if (this.dead) return;
        super.kill();
    }
    update(deltaTime = 16.67) {
        if (this.dead || this.claimed) return;
        this.t++;
        if (!player || player.dead) return;
        const now = (typeof simNowMs !== 'undefined' ? simNowMs : Date.now());
        const dt = Math.min(120, Math.max(0, now - (this.lastUpdateAt || now)));
        this.lastUpdateAt = now;

        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        const inside = d <= this.radius + player.radius;
        if (inside) {
            if (!this.captureActive) {
                this.captureActive = true;
                this.captureMs = 0;
            }
            this.captureMs += dt;
            if (this.captureMs >= this.captureMsRequired) this.claim();
        } else {
            this.captureActive = false;
            this.captureMs = 0;
        }
    }
    draw(ctx) {
        if (this.dead || this.claimed) {
            // Hide and cleanup all Pixi graphics when dead or claimed
            if (this._pixiProgressGfx) {
                this._pixiProgressGfx.visible = false;
            }
            if (this._pixiGfx) {
                this._pixiGfx.visible = false;
            }
            if (this._pixiNameText) {
                this._pixiNameText.visible = false;
            }
            return;
        }
        super.draw(ctx);

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            if (!this._pixiProgressGfx) {
                this._pixiProgressGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiProgressGfx);
            }
            const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
            this._pixiProgressGfx.clear();
            if (pct > 0) {
                this._pixiProgressGfx.visible = true;
                this._pixiProgressGfx.position.set(this.pos.x, this.pos.y);
                this._pixiProgressGfx.lineStyle(10 / (currentZoom || 1), 0x00ff00, 0.65);
                this._pixiProgressGfx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            } else {
                this._pixiProgressGfx.visible = false;
            }
            return;
        }

        const pct = Math.max(0, Math.min(1, (this.captureMs || 0) / this.captureMsRequired));
        if (pct <= 0) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.65)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    kill() {
        if (this.dead) return;
        super.kill();
        // Clean up ALL Pixi graphics
        if (this._pixiProgressGfx) {
            try { this._pixiProgressGfx.destroy({ children: true }); } catch (e) { }
            this._pixiProgressGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy({ children: true }); } catch (e) { }
            this._pixiGfx = null;
        }
        if (this._pixiNameText) {
            try { this._pixiNameText.destroy(); } catch (e) { }
            this._pixiNameText = null;
        }
    }
}

class ExplorationCache extends Entity {
    constructor(x, y, contractId = null) {
        super(x, y);
        this._pixiPool = 'pickup';
        this.contractId = contractId;
        this.radius = 12;
        this.vel.x = (Math.random() - 0.5) * 0.3;
        this.vel.y = (Math.random() - 0.5) * 0.3;
        this.magnetized = false;
        this.flash = 0;
        this.value = 2 + Math.floor(Math.random() * 3); // 2-4 nuggets
        this.sprite = null;
    }
    kill() {
        if (this.dead) return;
        super.kill();
        pixiCleanupObject(this);
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dist < player.magnetRadius) this.magnetized = true;
        if (this.magnetized) {
            const a = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
            const speed = 8 + (800 / Math.max(10, dist));
            this.vel.x = Math.cos(a) * speed;
            this.vel.y = Math.sin(a) * speed;
        } else {
            this.vel.mult(0.99);
        }
        this.pos.add(this.vel);
        this.flash++;
    }
    draw(ctx, pixiResources = null) {
        if (this.dead) return;

        if (pixiResources?.layer && pixiResources?.textures?.nugget) {
            const tex = pixiResources.textures.nugget;
            let spr = this.sprite;
            if (!spr) {
                spr = allocPixiSprite(pixiResources.pool, pixiResources.layer, tex, null, 0.5);
                this.sprite = spr;
            }
            if (spr) {
                if (!spr.parent) pixiResources.layer.addChild(spr);
                spr.visible = true;
                spr.position.set(this.pos.x, this.pos.y);
                const pulse = 1.0 + Math.sin(this.flash * 0.1) * 0.15;
                const targetRadius = 25; // 50% smaller cache nugz.
                const base = (targetRadius * 2) / Math.max(1, Math.max(tex.width, tex.height));
                spr.scale.set(base * pulse);
                spr.rotation = this.flash * 0.05;
                spr.tint = 0xffffff;
                spr.alpha = 1;
                if (window.PIXI) spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                return;
            }
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const scale = (1.0 + Math.sin(this.flash * 0.1) * 0.15) * 0.5;
        ctx.scale(scale, scale);
        ctx.rotate(this.flash * 0.05);

        const grad = ctx.createLinearGradient(-12, -12, 12, 12);
        grad.addColorStop(0, '#ff0');
        grad.addColorStop(0.5, '#ffa500');
        grad.addColorStop(1, '#0ff');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Cruiser extends Enemy {
    constructor(encounterIndex = 1) {
        super('gunboat', null, null, { gunboatLevel: 2 });
        const boost = Math.max(0, encounterIndex - 1);
        const hpScale = 1 + boost * 0.35;
        let shieldStrength = 2 + boost;
        const maxShieldHp = 5; // Max 5 HP per shield segment
        shieldStrength = Math.min(shieldStrength, maxShieldHp);
        const baseCruiserHp = 100; // first cruiser is 100 HP; later cruisers scale from this baseline
        this.type = 'cruiser';
        this.isCruiser = true;
        this.isGunboat = true;
        this.gunboatLevel = 2;

        // Visual scale: make it read as a capital ship (Battlestar-ish)
        this.cruiserHullScale = 6.2;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);
        // Longer, pattern-driven fights
        let hp = Math.round(baseCruiserHp * hpScale);
        // Second cruiser: give a real difficulty bump.
        if (encounterIndex === 2) {
            hp = Math.round(hp * 1.25);
            shieldStrength = Math.max(shieldStrength, Math.ceil(shieldStrength * 1.25));
        }
        this.hp = hp;
        this.maxHp = this.hp;
        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);
        this.shieldSegments = new Array(12).fill(shieldStrength);
        this.innerShieldSegments = new Array(18).fill(shieldStrength);
        this.innerShieldRotation = 0;
        this.gunboatShieldRecharge = 90;
        this.gunboatMuzzleDist = Math.round(6 * this.cruiserHullScale);
        this.cruiserWeaponRangeMult = 1.05625;
        this.baseGunboatRange = (900 + boost * 150) * this.cruiserWeaponRangeMult;
        this.gunboatRange = this.baseGunboatRange;
        this.cruiserBaseDamage = 1 + boost; // scales with encounters
        this.cruiserFireDelay = Math.round(16 / 1.3); // Scale fire delay appropriately for 60Hz (previously 16 / 0.65)
        this.circleStrafePreferred = true;
        this.despawnImmune = true;
        this.disableShieldRegen = true;
        this.turretAngle = 0;
        this.shootTimer = this.cruiserFireDelay;
        this.encounterIndex = encounterIndex;
        this.visualAngleOffset = Math.PI; // rotate cruiser art 180°

        // Disable the default Enemy.update shooting; cruiser uses scripted patterns.
        this.disableAutoFire = true;

        // Arcade-style boss kit
        this.shieldStrength = shieldStrength;
        this.vulnerableDurationFrames = 90;
        this.vulnerableTimer = 0;
        this.phaseName = 'INTRO';
        this.phaseTimer = 45;
        this.phaseIndex = 0;
        this.phaseTick = 0;
        // Reinforcements scale: first cruiser is 50% weaker/less; later scale up from that baseline
        this.helperScale = 0.5 * hpScale;
        this.helperHpMult = this.helperScale;
        this.helperMax = Math.max(2, Math.round(6 * this.helperScale));
        this.helperCall70 = Math.max(1, Math.round(2 * this.helperScale));
        this.helperCall40 = Math.max(1, Math.round(3 * this.helperScale));
        this.helperBurst = Math.max(1, Math.round(2 * this.helperScale));
        this.helperCooldownBase = Math.round(210 / Math.max(0.25, this.helperScale));
        this.helperCooldown = Math.round(90 / Math.max(0.25, this.helperScale));
        this.helperStrengthTier = (encounterIndex <= 1) ? 0 : (encounterIndex === 2 ? 1 : 2);
        this.called70 = false;
        this.called40 = false;
        this.lastShieldGenAt = 0;

        // Guided missiles for the 2nd cruiser (like flagship, but slower).
        this.guidedMissileEnabled = (encounterIndex === 2);
        this.guidedMissileCd = 90;
        this.guidedMissileInterval = 90; // ~1.5s
        this.guidedMissileCap = 2;

        // Heavier turning to feel like a capital ship
        this.turnSpeed = (Math.PI * 2) / (18 * 60);
        this.wallElasticity = 0.25;

        const hardHp = Math.round((18 + boost * 6) * hpScale);
        const hs = this.cruiserHullScale;
        this.hardpointMaxHp = 5; // Each shard maxes at 5 HP
        this.hardpointHpRegenMs = 3000; // Shards regenerate 1 HP every 3 seconds
        this.lastHpRegenTime = Date.now();
        this.fightDuration = 0; // Track fight duration for scaling
        this.hardpoints = [
            { id: 'LC', type: 'cannon', off: { x: -20 * hs, y: -4 * hs }, r: 3.2 * hs, hp: hardHp, maxHp: hardHp, cd: 0 },
            { id: 'RC', type: 'cannon', off: { x: 20 * hs, y: -4 * hs }, r: 3.2 * hs, hp: hardHp, maxHp: hardHp, cd: 0 },
            { id: 'SP', type: 'sprayer', off: { x: 0, y: -12 * hs }, r: 3.7 * hs, hp: Math.round(hardHp * 1.1), maxHp: Math.round(hardHp * 1.1), cd: 0 },
            { id: 'MB', type: 'bay', off: { x: 0, y: 12 * hs }, r: 3.7 * hs, hp: Math.round(hardHp * 1.1), maxHp: Math.round(hardHp * 1.1), cd: 0 },
            { id: 'SG', type: 'shieldgen', off: { x: 0, y: 3 * hs }, r: 3.4 * hs, hp: Math.round(hardHp * 1.2), maxHp: Math.round(hardHp * 1.2), cd: 0 }
        ];

        // Phase sequence (rotated by encounter for variety)
        this.phaseSeq = [
            { name: 'SALVO', duration: 180 },
            { name: 'CURTAIN', duration: 150 },
            { name: 'MINEFIELD', duration: 150 },
            { name: 'SWEEP', duration: 150 },
            { name: 'CHARGE', duration: 110 }
        ];
        const rot = encounterIndex % this.phaseSeq.length;
        this.phaseSeq = this.phaseSeq.slice(rot).concat(this.phaseSeq.slice(0, rot));

        const angle = Math.random() * Math.PI * 2;
        const dist = 3000;
        this.pos.x = player.pos.x + Math.cos(angle) * dist;
        this.pos.y = player.pos.y + Math.sin(angle) * dist;
    }

    hardpointWorld(hp) {
        const ang = this.angle + (this.visualAngleOffset || 0);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const ox = hp.off.x;
        const oy = hp.off.y;
        // rotate local offsets by current facing
        return { x: this.pos.x + ox * ca - oy * sa, y: this.pos.y + ox * sa + oy * ca };
    }

    hasHardpoint(type) {
        return this.hardpoints.some(h => h.hp > 0 && h.type === type);
    }

    livingHardpoints() {
        return this.hardpoints.filter(h => h.hp > 0);
    }

    updateAIState() {
        // Override base random AI; cruiser uses custom mode switching.
        this.aiTimer = 999999;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        const boomScale = Math.max(2.6, Math.min(5, (this.radius || 160) / 40));
        spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 26);

        // ADDED: Large particle explosion for Cruiser (Scale 4.0)
        spawnLargeExplosion(this.pos.x, this.pos.y, 4.0);

        spawnParticles(this.pos.x, this.pos.y, 120, '#f00');
        playSound('base_explode');
        shakeMagnitude = Math.max(shakeMagnitude, 22);
        shakeTimer = Math.max(shakeTimer, 24);
        clearArrayWithPixiCleanup(bossBombs);
        for (let i = 0; i < 13; i++) {
            coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 100, this.pos.y + (Math.random() - 0.5) * 100, 10));
        }
        for (let i = 0; i < 5; i++) {
            nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 120, this.pos.y + (Math.random() - 0.5) * 120, 1));
        }
        powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));
        bossActive = false;
        bossArena.active = false;
        bossArena.growing = false;
        if (cruiserEncounterCount === 2) {
            pendingStations = 1;
            nextSpaceStationTime = Date.now() + 30000;
            showOverlayMessage("CRUISER DESTROYED - SPACE STATION IN 30s", '#f80', 4000);
        } else {
            showOverlayMessage("CRUISER DESTROYED - ARENA UNLOCKED", '#0f0', 3000);
        }
        if (musicEnabled) setMusicMode('normal');
        try {
            const delay = dreadManager.minDelayMs + Math.floor(Math.random() * (dreadManager.maxDelayMs - dreadManager.minDelayMs + 1));
            dreadManager.timerAt = Date.now() + delay;
            dreadManager.timerActive = true;
            dreadManager.firstSpawnDone = true;
        } catch (e) { console.warn('failed to start cruiser timer', e); }
        if (boss) pixiCleanupObject(boss);
        boss = null;
        bossArena.active = false;
        bossArena.growing = false;
        stopArenaCountdown();
    }

    update(deltaTime = 16.67) {
        const now = Date.now();
        const dtFactor = deltaTime / 16.67;

        // Phase sequencing
        this.phaseTimer -= dtFactor;
        // phaseTick increment moved to accumulator loop at bottom
        if (this.vulnerableTimer > 0) this.vulnerableTimer -= dtFactor;

        if (this.phaseTimer <= 0) {
            const prev = this.phaseName;
            if (prev === 'CHARGE') {
                // Overheated core: short vulnerability window after a charge phase.
                this.vulnerableTimer = this.vulnerableDurationFrames;
            }

            // Advance to next valid phase
            for (let attempts = 0; attempts < this.phaseSeq.length; attempts++) {
                const next = this.phaseSeq[this.phaseIndex % this.phaseSeq.length];
                this.phaseIndex++;
                // Skip phases that rely on destroyed hardpoints
                if (next.name === 'SALVO' && !this.hasHardpoint('cannon')) continue;
                if ((next.name === 'CURTAIN' || next.name === 'SWEEP') && !this.hasHardpoint('sprayer')) continue;
                if ((next.name === 'MINEFIELD') && !this.hasHardpoint('bay')) continue;
                this.phaseName = next.name;
                this.phaseTimer = next.duration;
                this.phaseTick = 0;
                showOverlayMessage(`BOSS: ${this.phaseName}`, '#f0f', 900);
                break;
            }
        }

        // Movement style per phase
        const charging = (this.phaseName === 'CHARGE');
        if (charging) {
            this.circleStrafePreferred = false;
            this.aiState = 'SEEK';
            this.thrustPower = 0.64; // quadrupled for 60Hz
            this.maxSpeed = 8.4; // doubled for 60Hz
            this.gunboatRange = this.baseGunboatRange + 350;
        } else {
            // More varied movement: alternates between circling, orbiting, flanking, and direct approaches
            const dx = player.pos.x - this.pos.x;
            const dy = player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            if (typeof this.moveModeTimer !== 'number') this.moveModeTimer = 0;
            if (!this.moveMode) this.moveMode = 'CIRCLE';
            this.moveModeTimer -= deltaTime / 16.67;
            if (this.moveModeTimer <= 0) {
                const r = Math.random();
                if (dist > 1700) this.moveMode = (r < 0.55) ? 'SEEK' : (r < 0.80 ? 'CIRCLE' : 'ORBIT');
                else this.moveMode = (r < 0.38) ? 'CIRCLE' : (r < 0.60 ? 'ORBIT' : (r < 0.82 ? 'SEEK' : 'FLANK'));
                this.flankSide = Math.random() < 0.5 ? 1 : -1;
                this.moveModeTimer = 22 + Math.floor(Math.random() * 45);
            }

            if (this.moveMode === 'SEEK') {
                this.circleStrafePreferred = false;
                this.aiState = 'SEEK';
                this.thrustPower = 0.52; // quadrupled
                this.maxSpeed = 7.8; // doubled
            } else if (this.moveMode === 'ORBIT') {
                this.circleStrafePreferred = false;
                this.aiState = 'ORBIT';
                this.thrustPower = 0.48; // quadrupled
                this.maxSpeed = 6.6; // doubled
            } else if (this.moveMode === 'FLANK') {
                this.circleStrafePreferred = false;
                this.aiState = 'FLANK';
                this.thrustPower = 0.56; // quadrupled
                this.maxSpeed = 8.2; // doubled
            } else {
                this.circleStrafePreferred = true;
                this.aiState = 'CIRCLE';
                this.thrustPower = 0.40; // quadrupled
                this.maxSpeed = 5.8; // doubled
            }
            this.gunboatRange = this.baseGunboatRange;
        }

        this.innerShieldRotation -= 0.08 * (deltaTime / 16.67);
        super.update(deltaTime);

        // Shield generator gimmick (destroy SG hardpoint to stop regen)
        if (this.hasHardpoint('shieldgen')) {
            if (!this.lastShieldGenAt) this.lastShieldGenAt = now;
            if (now - this.lastShieldGenAt >= 1500) {
                const idx1 = this.shieldSegments.findIndex(s => s < this.shieldStrength);
                if (idx1 !== -1) this.shieldSegments[idx1] = Math.min(this.shieldStrength, this.shieldSegments[idx1] + 1);
                const idx2 = this.innerShieldSegments.findIndex(s => s < this.shieldStrength);
                if (idx2 !== -1) this.innerShieldSegments[idx2] = Math.min(this.shieldStrength, this.innerShieldSegments[idx2] + 1);
                this.lastShieldGenAt = now;
                spawnParticles(this.pos.x, this.pos.y, 6, '#0ff');
            }
        }

        // Phase attacks - Fixed timestep accumulator to preserve pattern speed
        if (typeof this.phaseTickAccum === 'undefined') this.phaseTickAccum = 0;
        this.phaseTickAccum += dtFactor;
        while (this.phaseTickAccum >= 1) {
            this.phaseTickAccum -= 1;
            this.phaseTick++;
            this.runPhaseAttacks();
        }

        // Helper calls (few small ships only)
        this.maybeCallHelpers();

        if (this.guidedMissileEnabled && bossActive && boss === this) {
            this.guidedMissileCd -= (deltaTime / 16.67);
            if (this.guidedMissileCd <= 0) {
                const alive = guidedMissiles.filter(m => m && !m.dead).length;
                if (alive < this.guidedMissileCap) {
                    guidedMissiles.push(new FlagshipGuidedMissile(this));
                    spawnParticles(this.pos.x, this.pos.y, 10, '#fa0');
                    playSound('heavy_shoot');
                }
                this.guidedMissileCd = this.guidedMissileInterval;
            }
        }
    }

    runPhaseAttacks() {
        if (!player || player.dead) return;

        // Hardpoint cooldowns tick
        for (let i = 0; i < this.hardpoints.length; i++) this.hardpoints[i].cd--;

        const aim = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

        if (this.phaseName === 'SALVO') {
            if (this.phaseTick % 11 === 0) {
                this.fireCannons(aim, 3, 0.18, 18, this.cruiserBaseDamage, '#f44');
            }
        } else if (this.phaseName === 'CURTAIN') {
            if (this.phaseTick % 5 === 0) {
                this.fireSprayerFan(aim, 11, 1.1, 10, 1, '#f0f');
            }
            if (this.phaseTick % 35 === 0 && this.hasHardpoint('cannon')) {
                this.fireCannons(aim, 2, 0.12, 20, this.cruiserBaseDamage, '#ff0');
            }
        } else if (this.phaseName === 'MINEFIELD') {
            if (this.phaseTick % 45 === 1) {
                this.launchMinefieldBombs();
            }
        } else if (this.phaseName === 'SWEEP') {
            // Simple sweeping stream (telegraphed by consistent direction change)
            if (this.phaseTick % 2 === 0) {
                const t = (this.phaseTick % 120) / 120;
                const a = (Math.PI / 2 - 1.1) + t * 2.2;
                this.fireSprayerSingle(a, 12, 1, '#0ff');
            }
            if (this.phaseTick % 40 === 0) {
                this.fireRing(14, 8.4, 1, '#ff0');
            }
        } else if (this.phaseName === 'CHARGE') {
            if (this.phaseTick % 9 === 0) {
                this.fireCannons(aim, 1, 0, 22, this.cruiserBaseDamage, '#f55');
            }
            if (this.phaseTick % 17 === 0) {
                this.dropMine(aim + (Math.random() - 0.5) * 0.6, 4.0, 2, '#f80');
            }
        } else if (this.phaseName === 'INTRO') {
            // no-op
        }
    }

    fireCannons(baseAngle, shots, spread, speed, dmg, color) {
        const cannons = this.hardpoints.filter(h => h.hp > 0 && h.type === 'cannon');
        for (let c = 0; c < cannons.length; c++) {
            const hp = cannons[c];
            const p = this.hardpointWorld(hp);
            for (let i = 0; i < shots; i++) {
                const t = shots === 1 ? 0 : (i / (shots - 1) - 0.5);
                const a = baseAngle + t * spread;
                const shot = new Bullet(p.x, p.y, a, true, dmg, speed, 4, color);
                shot.life = Math.round(shot.life * this.cruiserWeaponRangeMult);
                bullets.push(shot);
                spawnBarrelSmoke(p.x, p.y, a);
            }
        }
        // DEBUG: Log fire attempt
        if (Math.random() < 0.05) console.log(`[CRUISER] fireCannons. Shots: ${shots} Time: ${Date.now()}`);
        playSound('rapid_shoot');
    }

    fireSprayerFan(baseAngle, count, spread, speed, dmg, color) {
        const spr = this.hardpoints.find(h => h.hp > 0 && h.type === 'sprayer');
        if (!spr) return;
        const p = this.hardpointWorld(spr);
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
            const a = baseAngle + t * spread;
            const b = new Bullet(p.x, p.y, a, true, dmg, speed, 4, color);
            b.life = Math.round(60 * this.cruiserWeaponRangeMult);
            bullets.push(b);
        }
        playSound('shoot');
    }

    fireSprayerSingle(angle, speed, dmg, color) {
        const spr = this.hardpoints.find(h => h.hp > 0 && h.type === 'sprayer');
        if (!spr) return;
        const p = this.hardpointWorld(spr);
        const b = new Bullet(p.x, p.y, angle, true, dmg, speed, 4, color);
        b.life = Math.round(55 * this.cruiserWeaponRangeMult);
        bullets.push(b);
    }

    dropMine(angle, speed, dmg, color) {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        if (!bay) return;
        const p = this.hardpointWorld(bay);
        const b = new Bullet(p.x, p.y, angle, true, dmg, speed, 11, color, 0, 'square');
        b.life = Math.round(110 * this.cruiserWeaponRangeMult);
        bullets.push(b);
        playSound('heavy_shoot');
    }

    launchMinefieldBombs() {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        if (!bay) return;
        const count = 5;
        const base = Math.random() * Math.PI * 2;
        const maxTravel = this.baseGunboatRange;
        const blastRadius = this.radius * 1.3 * 1.5; // +50% blast radius
        const dmg = Math.max(2, Math.round(this.cruiserBaseDamage));
        for (let i = 0; i < count; i++) {
            const a = base + (Math.PI * 2 / count) * i;
            bossBombs.push(new CruiserMineBomb(this, a, maxTravel, dmg, blastRadius));
        }
        playSound('heavy_shoot');
    }

    fireRing(n, speed, dmg, color) {
        const bay = this.hardpoints.find(h => h.hp > 0 && h.type === 'bay');
        const p = bay ? this.hardpointWorld(bay) : { x: this.pos.x, y: this.pos.y };
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const b = new Bullet(p.x, p.y, a, true, dmg, speed, 4, color);
            b.life = Math.round(70 * this.cruiserWeaponRangeMult);
            bullets.push(b);
        }
        playSound('shotgun');
    }

    maybeCallHelpers() {
        if (!bossActive) return;
        if (!player || player.dead) return;

        const aliveHelpers = enemies.filter(e => e && !e.dead).length;
        const maxHelpers = this.helperMax;

        const hpPct = this.hp / this.maxHp;
        if (!this.called70 && hpPct <= 0.7) {
            this.called70 = true;
            this.spawnHelpers(this.helperCall70);
        }
        if (!this.called40 && hpPct <= 0.4) {
            this.called40 = true;
            this.spawnHelpers(this.helperCall40);
        }

        this.helperCooldown--;
        if (this.helperCooldown <= 0 && aliveHelpers < maxHelpers) {
            const burst = Math.min(this.helperBurst, maxHelpers - aliveHelpers);
            this.spawnHelpers(burst);
            this.helperCooldown = this.helperCooldownBase;
        }
    }

    spawnHelpers(count) {
        const aliveHelpers = enemies.filter(e => e && !e.dead).length;
        const slots = Math.max(0, this.helperMax - aliveHelpers);
        if (slots <= 0) return;
        count = Math.min(count, slots);
        let types = ['roamer', 'roamer', 'elite_roamer'];
        if (this.helperStrengthTier <= 0) types = ['roamer', 'roamer', 'roamer'];
        else if (this.helperStrengthTier >= 2) types = ['roamer', 'elite_roamer', 'hunter'];
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const a = Math.random() * Math.PI * 2;
            const d = 260 + Math.random() * 260;
            const e = new Enemy(type, { x: this.pos.x + Math.cos(a) * d, y: this.pos.y + Math.sin(a) * d });
            e.hp = Math.max(1, Math.round(e.hp * this.helperHpMult));
            if (e.shieldSegments && e.shieldSegments.length > 0) {
                const segMult = this.helperHpMult;
                e.shieldSegments = e.shieldSegments.map(s => Math.max(0, Math.round(s * segMult)));
            }
            enemies.push(e);
        }
        showOverlayMessage("BOSS CALLED REINFORCEMENTS", '#f00', 1100);
    }

    applyPlayerBulletHit(b) {
        if (!b || b.isEnemy) return false;
        // Hardpoints can always be damaged to disable attacks.
        for (let i = 0; i < this.hardpoints.length; i++) {
            const hp = this.hardpoints[i];
            if (hp.hp <= 0) continue;
            const p = this.hardpointWorld(hp);
            const dist = Math.hypot(b.pos.x - p.x, b.pos.y - p.y);
            if (dist < hp.r + b.radius) {
                hp.hp -= b.damage;
                spawnParticles(p.x, p.y, 6, '#fff');
                playSound('hit');
                if (hp.hp <= 0) {
                    spawnParticles(p.x, p.y, 40, '#ff0');
                    showOverlayMessage(`HARDPOINT ${hp.id} DESTROYED`, '#ff0', 1200);
                }
                return true;
            }
        }
        return false;
    }

    drawBossHud(ctx) {
        if (!bossActive || this.dead) return;
        const w = canvas.width;
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = this.vulnerableTimer > 0 ? '#ff0' : '#f00';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const phaseText = this.vulnerableTimer > 0 ? `${this.phaseName} (CORE EXPOSED)` : this.phaseName;
        const bossName = this.isFlagship ? 'FLAGSHIP' : 'CRUISER';
        ctx.fillText(`${bossName}  (PHASE: ${phaseText})`, w / 2, y + 12);

        // Hardpoint status line
        ctx.font = 'bold 11px Courier New';
        ctx.fillStyle = '#ff0';
        const hpStr = this.hardpoints.map(h => `${h.id}:${h.hp > 0 ? 'ON' : 'OFF'}`).join('  ');
        ctx.fillText(hpStr, w / 2, y + 26);
        ctx.restore();
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.dead) return;

        const rPos = this.getRenderPos(renderAlpha);
        // Using current angle (not interpolated) matches Enemy.draw behavior
        const ang = this.angle + (this.visualAngleOffset || 0);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        // Hardpoints overlay
        ctx.save();
        for (let i = 0; i < this.hardpoints.length; i++) {
            const hp = this.hardpoints[i];

            // Replicate hardpointWorld logic but with rPos
            const ox = hp.off.x;
            const oy = hp.off.y;
            const px = rPos.x + ox * ca - oy * sa;
            const py = rPos.y + ox * sa + oy * ca;

            const alive = hp.hp > 0;
            ctx.globalAlpha = alive ? 1 : 0.35;
            ctx.strokeStyle = alive ? '#ff0' : '#0f0';
            ctx.fillStyle = alive ? '#222' : '#040';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, hp.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        if (this.vulnerableTimer > 0) {
            ctx.globalAlpha = 0.25 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.25;
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(rPos.x, rPos.y, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Flagship extends Cruiser {
    constructor(spawnAt = null) {
        super(Math.max(4, cruiserEncounterCount));
        this.type = 'flagship';
        this.isFlagship = true;
        this.despawnImmune = true;
        // Harder to punish: +2s invul by shrinking the core-exposed window.
        this.vulnerableDurationFrames = 30; // halved for 60Hz

        // Bigger, slower, higher-stakes fight
        this.cruiserHullScale = 8.8;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);
        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);

        // Spawn above a target point (defaults to the player).
        if (spawnAt && typeof spawnAt.x === 'number' && typeof spawnAt.y === 'number') {
            this.pos.x = spawnAt.x;
            this.pos.y = spawnAt.y;
        } else if (player && !player.dead) {
            // Arcade "top of screen" vibe
            this.pos.x = player.pos.x;
            this.pos.y = player.pos.y - 2200;
        }

        const bonus = Math.max(0, cruiserEncounterCount - 1);
        const baseHp = 260 + bonus * 35;
        this.hp = Math.round(baseHp * 1.25);
        this.maxHp = this.hp;

        this.shieldStrength = Math.max(3, Math.ceil((this.shieldStrength + 1) * 1.5));
        this.shieldSegments = new Array(14).fill(this.shieldStrength);
        this.innerShieldSegments = new Array(22).fill(this.shieldStrength);

        this.thrustPower = 0.36; // quadrupled (0.09 * 4) for 60Hz
        this.maxSpeed = 5.4; // doubled (2.7 * 2) for 60Hz
        this.baseGunboatRange = this.baseGunboatRange * 1.15;
        this.gunboatRange = this.baseGunboatRange;
        this.cruiserBaseDamage = Math.max(this.cruiserBaseDamage, 2 + Math.floor(bonus / 2));

        // Less clutter: only a few helpers, ever
        this.helperScale = 0.35;
        this.helperMax = 3;

        // Tighten phases to keep it frantic
        this.phaseSeq = [
            { name: 'SALVO', duration: 70 },
            { name: 'CURTAIN', duration: 85 },
            { name: 'MINEFIELD', duration: 100 },
            { name: 'SWEEP', duration: 80 },
            { name: 'CHARGE', duration: 60 }
        ]; // halved for 60Hz
        this.phaseIndex = 0;
        this.phaseName = 'INTRO';
        this.phaseTimer = 45; // halved for 60Hz
        this.phaseTick = 0;

        this.guidedMissileCd = 105;
        this.guidedMissileInterval = 105; // halved for 60Hz (~1.75s)
        this.guidedMissileCap = 4;
    }

    update(deltaTime = 16.67) {
        super.update();
        if (this.dead) return;
        if (!bossActive || boss !== this) return;
        if (!player || player.dead) return;

        if (this.phaseName === 'INTRO') return;

        this.guidedMissileCd--;
        if (this.guidedMissileCd > 0) return;

        const alive = guidedMissiles.filter(m => m && !m.dead).length;
        if (alive >= this.guidedMissileCap) {
            this.guidedMissileCd = Math.max(30, Math.floor(this.guidedMissileInterval * 0.5));
            return;
        }

        guidedMissiles.push(new FlagshipGuidedMissile(this));
        spawnParticles(this.pos.x, this.pos.y, 10, '#fa0');
        playSound('heavy_shoot');
        this.guidedMissileCd = this.guidedMissileInterval;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        playSound('base_explode');

        // ADDED: Large particle explosion for Flagship (Scale 5.0)
        spawnLargeExplosion(this.pos.x, this.pos.y, 5.0);

        spawnParticles(this.pos.x, this.pos.y, 200, '#f0f');
        clearArrayWithPixiCleanup(bossBombs);
        clearArrayWithPixiCleanup(guidedMissiles);

        for (let i = 0; i < 40; i++) coins.push(new Coin(this.pos.x + (Math.random() - 0.5) * 260, this.pos.y + (Math.random() - 0.5) * 260, 10));
        for (let i = 0; i < 16; i++) nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 320, this.pos.y + (Math.random() - 0.5) * 320, 1));

        bossActive = false;
        bossArena.active = false;
        bossArena.growing = false;
        boss = null;

        showOverlayMessage("FLAGSHIP DESTROYED - WARP CORE CHARGING", '#0ff', 3500, 2);
        // Keep world entities intact; just drop the arena lock on flagship kill.
    }
}

class SuperFlagshipBoss extends Flagship {
    constructor(spawnAt = null) {
        super(spawnAt);
        this.type = 'super_flagship';
        this.isSuperFlagship = true;
        this.despawnImmune = true;

        this.cruiserHullScale = 10.4;
        this.gunboatScale = this.cruiserHullScale;
        this.radius = Math.round(22 * this.cruiserHullScale);
        this.shieldRadius = Math.round(34 * this.cruiserHullScale);
        this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);

        this.hp = Math.round(this.hp * 2.1 + 220);
        this.maxHp = this.hp;

        this.shieldStrength = Math.max(4, this.shieldStrength + 2);
        this.shieldSegments = new Array(18).fill(this.shieldStrength);
        this.innerShieldSegments = new Array(28).fill(this.shieldStrength);

        // More pressure in the narrow cave.
        this.helperScale = 0.55;
        this.helperHpMult = 0.9;
        this.helperMax = 7;
        this.helperBurst = 3;
        this.helperCooldownBase = 520;
        this.helperCooldown = 200;
        this.helperCall70 = 2;
        this.helperCall40 = 3;
        this.helperStrengthTier = 2;

        // Guided missiles ramp up.
        this.guidedMissileInterval = 340; // ~5.6s (50% fewer)
        this.guidedMissileCap = 3;

        // Cave laser sweep (separate from cruiser phases).
        this.caveLaserCooldown = 260;
        this.caveLaserCharge = 0;
        this.caveLaserChargeTotal = 70;
        this.caveLaserFire = 0;
        this.caveLaserFireTotal = 22;
        this.caveLaserAngle = 0;
        this.caveLaserLen = 6000;
        this.caveLaserWidth = 44;
        this.caveLaserSweep = 1.0;
        this.caveLaserHitThisShot = false;
        this.caveSummonCooldown = 260;
    }

    cavePhase2() {
        return this.hp <= this.maxHp * 0.5;
    }

    applyDamageToPlayer(amount) {
        if (!player || player.dead) return;
        if (player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
            for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                if (player.outerShieldSegments[i] > 0) {
                    player.outerShieldSegments[i] = 0;
                    remaining -= 1;
                }
            }
        }

        if (player.shieldSegments && player.shieldSegments.length > 0) {
            for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                const absorb = Math.min(remaining, player.shieldSegments[i]);
                player.shieldSegments[i] -= absorb;
                remaining -= absorb;
            }
        }

        if (remaining > 0) {
            player.hp -= remaining;
            spawnParticles(player.pos.x, player.pos.y, 14, '#f00');
            playSound('hit');
            updateHealthUI();
            if (player.hp <= 0) killPlayer();
        } else {
            playSound('shield_hit');
            spawnParticles(player.pos.x, player.pos.y, 10, '#0ff');
        }
        player.invulnerable = 22;
    }

    update(deltaTime = 16.67) {
        super.update();
        if (this.dead) return;
        if (!bossActive || boss !== this) return;
        if (!player || player.dead) return;

        const phase2 = this.cavePhase2();
        const aim = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

        // In the cave, bias movement toward the tunnel centerline.
        if (caveMode && caveLevel && caveLevel.active) {
            const bounds = caveLevel.boundsAt(this.pos.y);
            const pad = this.radius + 220;
            const cx = Math.max(bounds.left + pad, Math.min(bounds.right - pad, caveLevel.centerXAt(this.pos.y)));
            this.vel.x += (cx - this.pos.x) * 0.0022;
            this.vel.x *= 0.96;
        }

        // Laser sweep (telegraphed), becomes twin-sweep in phase 2.
        if (this.caveLaserFire > 0) {
            this.caveLaserFire--;
            const sweep = this.caveLaserSweep;
            const t = 1 - (this.caveLaserFire / Math.max(1, this.caveLaserFireTotal));
            const a0 = this.caveLaserAngle - sweep * 0.5;
            const a = a0 + sweep * t;

            const applyHit = (angle, damage) => {
                if (this.caveLaserHitThisShot) return;
                const ex = this.pos.x + Math.cos(angle) * this.caveLaserLen;
                const ey = this.pos.y + Math.sin(angle) * this.caveLaserLen;
                const cp = closestPointOnSegment(player.pos.x, player.pos.y, this.pos.x, this.pos.y, ex, ey);
                const d = Math.hypot(player.pos.x - cp.x, player.pos.y - cp.y);
                const hitDist = (this.caveLaserWidth * 0.5) + (player.radius * 0.55);
                if (d <= hitDist) {
                    this.caveLaserHitThisShot = true;
                    this.applyDamageToPlayer(damage);
                    shakeMagnitude = Math.max(shakeMagnitude, 12);
                    shakeTimer = Math.max(shakeTimer, 12);
                }
            };

            applyHit(a, phase2 ? 7 : 6);
            if (phase2) applyHit(a + 0.22, 6);
        } else if (this.caveLaserCharge > 0) {
            this.caveLaserCharge--;
            if (this.caveLaserCharge === 0) {
                this.caveLaserFire = this.caveLaserFireTotal;
                this.caveLaserHitThisShot = false;
                playSound('heavy_shoot');
            }
        } else {
            this.caveLaserCooldown--;
            if (this.caveLaserCooldown <= 0) {
                this.caveLaserAngle = aim;
                this.caveLaserSweep = phase2 ? 1.9 : 1.35;
                this.caveLaserChargeTotal = phase2 ? 55 : 70;
                this.caveLaserFireTotal = phase2 ? 26 : 22;
                this.caveLaserCharge = this.caveLaserChargeTotal;
                this.caveLaserFire = 0;
                this.caveLaserHitThisShot = false;
                this.caveLaserCooldown = (phase2 ? 220 : 320) + Math.floor(Math.random() * 220);
            }
        }

        // Extra defenders in the tunnel.
        this.caveSummonCooldown--;
        if (this.caveSummonCooldown <= 0) {
            const count = phase2 ? 4 : 3;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = 420 + Math.random() * 520;
                const type = (phase2 && Math.random() < 0.45) ? 'hunter' : 'defender';
                enemies.push(new Enemy(type, { x: this.pos.x + Math.cos(a) * d, y: this.pos.y + Math.sin(a) * d }, null));
            }
            showOverlayMessage("SUPER FLAGSHIP DEPLOYED DEFENDERS", '#f0f', 1200, 2);
            this.caveSummonCooldown = (phase2 ? 240 : 340) + Math.floor(Math.random() * 260);
        }
    }

    drawBossHud(ctx) {
        if (!bossActive || this.dead) return;
        const w = canvas.width;
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);
        const phase = this.cavePhase2() ? 'PHASE 2' : (this.phaseName || 'PHASE 1');

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);
        ctx.fillStyle = this.vulnerableTimer > 0 ? '#ff0' : '#0ff';
        ctx.fillRect(x, y, barW * pct, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`SUPER FLAGSHIP  (${phase})`, w / 2, y + 12);
        ctx.restore();
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        playSound('base_explode');

        // Super Flagship Explosion: Scale 6.0
        spawnLargeExplosion(this.pos.x, this.pos.y, 6.0);

        spawnParticles(this.pos.x, this.pos.y, 260, '#0ff');
        clearArrayWithPixiCleanup(bossBombs);
        clearArrayWithPixiCleanup(guidedMissiles);

        awardCoinsInstant(80 * 10, { noSound: false, sound: 'coin', color: '#ff0' });
        for (let i = 0; i < 24; i++) nuggets.push(new SpaceNugget(this.pos.x + (Math.random() - 0.5) * 360, this.pos.y + (Math.random() - 0.5) * 360, 1));

        bossActive = false;
        bossArena.active = false;
        bossArena.growing = false;
        if (boss) pixiCleanupObject(boss);
        boss = null;

        showOverlayMessage("SUPER FLAGSHIP DESTROYED - MISSION COMPLETE", '#0f0', 5000, 5);

        let elapsed = 0;
        const now = Date.now();
        if (gameStartTime) {
            elapsed = now - gameStartTime - (pausedAccumMs || 0);
            if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - (pausedAccumMs || 0);
            if (elapsed < 0) elapsed = 0;
        }
        endGame(elapsed);
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.dead) return;
        const z = currentZoom || ZOOM_LEVEL;
        if (this.caveLaserCharge > 0) {
            const aim = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(aim);
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3 / z;
            ctx.setLineDash([10 / z, 14 / z]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(3600, 0);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }
}

class WarpSentinelBoss extends Entity {
    constructor(x, y, zone) {
        super(x, y);
        this.zone = zone || null;
        this.isWarpBoss = true;
        this.sizeScale = 3;
        this.radius = 110 * this.sizeScale;
        this.hp = 180;
        this.maxHp = this.hp;

        // Cruiser-style rotating shield rings + regen.
        this.shieldStrength = 3;
        this.shieldSegments = new Array(18).fill(this.shieldStrength);
        this.innerShieldSegments = new Array(24).fill(this.shieldStrength);
        // Shield radius scaled to protect enlarged body
        this.shieldRadius = 950;
        this.innerShieldRadius = 850;
        this.shieldRotation = Math.random() * Math.PI * 2;
        this.innerShieldRotation = Math.random() * Math.PI * 2;
        this.lastShieldRegenAt = Date.now();
        this.shieldRegenMs = 500;

        this.t = 0;
        this.phase = 1;
        this.coreRot = 0;
        this.burstCooldown = 55;
        this.mineCooldown = 130;

        // Smoother movement (no hard velocity snaps).
        this.orbitOffset = Math.random() * Math.PI * 2;
        this.maxSpeed = 5.5;
        this.dashCooldown = 240;
        this.dashWarmup = 0;
        this.dashFrames = 0;
        this.dashDir = { x: 0, y: 0 };
        this.dashSpeed = 15;

        // Telegraphed heavy laser (quick blast).
        // Fire less frequently; extra lock delay improves readability.
        this.laserCooldown = 180;
        this.laserCharge = 0;
        this.laserChargeTotal = 35;
        this.laserDelay = 0;
        this.laserDelayTotal = 15; // ~0.25s at 60fps after lock-in
        this.laserFire = 0;
        this.laserFireTotal = 5;
        this.laserAngle = 0;
        this.laserLen = 5200;
        this.laserWidth = 44;
        this.laserHitThisShot = false;

        // Reinforcements (like cruiser helpers).
        this.helperMax = 6;
        this.helperCall70 = 2;
        this.helperCall40 = 3;
        this.helperBurst = 2;
        this.helperCooldownBase = 210;
        this.helperCooldown = 90;
        this.called70 = false;
        this.called50 = false;
        this.called40 = false;
        this.phase2Started = false;
        this.helperStrengthTier = 1;

        this.spiralTimer = 0;
        this.spiralAng = Math.random() * Math.PI * 2;
        this.shieldsDirty = true;
        this._pixiInnerGfx = null;

        // Collision hull (head + body, no tail) - hand-tuned for 512x256 sprite
        // Head is the large right-side part, body is the mid section
        this.collisionHull = [
            { x: 50 * this.sizeScale, y: 0, r: 85 * this.sizeScale },
            { x: -30 * this.sizeScale, y: 0, r: 70 * this.sizeScale },
            { x: -80 * this.sizeScale, y: 0, r: 50 * this.sizeScale }
        ];
        this.collisionRadius = 85 * this.sizeScale;

        // Sprite properties
        this._pixiSprite = null;
    }

    hitTestCircle(x, y, r) {
        if (this.dead) return false;
        const dx = x - this.pos.x;
        const dy = y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > (this.collisionRadius + r) * (this.collisionRadius + r)) return false;
        const aimToPlayer = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;
        const cos = Math.cos(-aimToPlayer);
        const sin = Math.sin(-aimToPlayer);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        for (const circle of this.collisionHull) {
            const cdx = localX - circle.x;
            const cdy = localY - circle.y;
            if (cdx * cdx + cdy * cdy < (circle.r + r) * (circle.r + r)) return true;
        }
        return false;
    }

    drawBossHud(ctx) {
        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        const w = 360;
        const h = 16;
        const x = canvas.width / 2 - w / 2;
        const y = 64;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 6, y - 8, w + 12, h + 18);
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 6, y - 8, w + 12, h + 18);
        ctx.fillStyle = '#300';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#f0f';
        ctx.fillRect(x, y, Math.floor(w * pct), h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`WARP SENTINEL ${Math.max(0, Math.floor(pct * 100))}%`, canvas.width / 2, y - 2);
        ctx.restore();
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        pixiCleanupObject(this);
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }

        // PERFORMANCE MONITORING: Track boss death frame time
        const killStartTime = performance.now();
        const bombCount = bossBombs.length;
        console.log(`[BOSS KILL] Starting death sequence with ${bombCount} bombs`);

        // PERFORMANCE FIX: Staggered particle spawning to prevent frame spikes
        // Instead of 140 particles at once, spread them over ~20 frames
        scheduleParticleBursts(this.pos.x, this.pos.y, 140, '#f0f', 20);

        // ADDED: Large particle explosion for Warp Sentinel (Scale 4.5)
        spawnLargeExplosion(this.pos.x, this.pos.y, 4.5);

        // PERFORMANCE FIX: Stagger bomb explosions over multiple frames
        // instead of exploding all bombs at once which causes sprite pool exhaustion
        scheduleStaggeredBombExplosions(this.pos.x, this.pos.y);

        // Start 10-second countdown to level 2
        sectorTransitionActive = true;
        warpCountdownAt = Date.now() + 10000; // 10 seconds
        showOverlayMessage("SENTINEL DOWN - LEVEL 2 IN 10s", '#ff0', 2600, 3);
        bossActive = false;
        if (boss) pixiCleanupObject(boss);
        boss = null;

        // PERFORMANCE MONITORING: Log completion time
        const killDuration = performance.now() - killStartTime;
        console.log(`[BOSS KILL] Death sequence setup completed in ${killDuration.toFixed(2)}ms`);
        if (killDuration > 16.67) {
            console.warn(`[BOSS KILL] Frame time spike detected (${killDuration.toFixed(2)}ms)`);
        }
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        if (!player || player.dead) return;
        const now = Date.now();
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.coreRot += 0.04 * dtFactor;
        this.shieldRotation += 0.06 * dtFactor;
        this.innerShieldRotation -= 0.09 * dtFactor;

        // Shield regen (outer then inner).
        if (now - this.lastShieldRegenAt >= this.shieldRegenMs) {
            const idx1 = this.shieldSegments.findIndex(s => s < this.shieldStrength);
            if (idx1 !== -1) { this.shieldSegments[idx1] = Math.min(this.shieldStrength, this.shieldSegments[idx1] + 1); this.shieldsDirty = true; }
            const idx2 = this.innerShieldSegments.findIndex(s => s < this.shieldStrength);
            if (idx2 !== -1) { this.innerShieldSegments[idx2] = Math.min(this.shieldStrength, this.innerShieldSegments[idx2] + 1); this.shieldsDirty = true; }
            this.lastShieldRegenAt = now;
            if (Math.random() < 0.5) spawnParticles(this.pos.x, this.pos.y, 4, '#0ff');
        }

        const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 0;
        this.phase = hpPct < 0.5 ? 2 : 1;

        if (this.phase === 2 && !this.phase2Started) {
            this.phase2Started = true;
            // Phase 2: faster laser cadence + heavier reinforcement pressure.
            this.helperMax = 10;
            this.helperBurst = 3;
            this.helperCooldownBase = 320;
            this.spawnDefenders(6);
            showOverlayMessage("SENTINEL PHASE 2", '#f0f', 1800, 3);
        }

        // Orbit the zone center (smooth steering).
        const cx = this.zone ? this.zone.pos.x : this.pos.x;
        const cy = this.zone ? this.zone.pos.y : this.pos.y;
        const orbitR = this.phase === 2 ? 560 : 720;
        const orbitSpeed = this.phase === 2 ? 0.01 : 0.0075;
        const orbitAng = this.orbitOffset + this.t * orbitSpeed;
        const targetX = cx + Math.cos(orbitAng) * orbitR;
        const targetY = cy + Math.sin(orbitAng) * orbitR;
        const distToPlayer = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        const aimToPlayer = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

        // Dash scheduling (telegraphed and blended).
        this.dashCooldown -= dtFactor;
        if (this.dashWarmup > 0) {
            this.dashWarmup -= dtFactor;
            this.vel.mult(Math.pow(0.92, dtFactor));
            if (this.dashWarmup <= 0) {
                this.dashWarmup = 0;
                this.dashFrames = 60;
            }
        } else if (this.dashFrames > 0) {
            this.dashFrames -= dtFactor;
            const blend = 1 - Math.pow(0.80, dtFactor); // frame-independent lerp factor for 0.20
            this.vel.x += (this.dashDir.x * this.dashSpeed - this.vel.x) * blend;
            this.vel.y += (this.dashDir.y * this.dashSpeed - this.vel.y) * blend;

            if (this.dashFrames <= 0) {
                this.dashFrames = 0;
                shockwaves.push(new Shockwave(this.pos.x, this.pos.y, 2, 650, { damagePlayer: true, color: '#f0f' }));
                playSound('explode');
            }
        } else if (this.dashCooldown <= 0 && distToPlayer > 650 && distToPlayer < 2800) {
            const dx = Math.cos(aimToPlayer);
            const dy = Math.sin(aimToPlayer);
            this.dashDir = { x: dx, y: dy };
            this.dashWarmup = 9;
            this.dashCooldown = this.phase === 2 ? 180 : 240;
            spawnParticles(this.pos.x, this.pos.y, 14, '#f0f');
            showOverlayMessage("SENTINEL CHARGING", '#f0f', 700);
        }

        if (this.dashWarmup <= 0 && this.dashFrames <= 0) {
            const dx = targetX - this.pos.x;
            const dy = targetY - this.pos.y;
            const d = Math.hypot(dx, dy) || 1;
            // Add a gentle tangential drift so it doesn't jitter around the target point.
            const dcx = this.pos.x - cx;
            const dcy = this.pos.y - cy;
            const cd = Math.hypot(dcx, dcy) || 1;
            const tx = (-dcy / cd) * (this.phase === 2 ? 0.75 : 0.55);
            const ty = (dcx / cd) * (this.phase === 2 ? 0.75 : 0.55);
            let desiredX = (dx / d) + tx;
            let desiredY = (dy / d) + ty;
            const dd = Math.hypot(desiredX, desiredY) || 1;
            desiredX /= dd;
            desiredY /= dd;

            const desiredVx = desiredX * this.maxSpeed;
            const desiredVy = desiredY * this.maxSpeed;

            // Frame independent smoothing
            const blend = 1 - Math.pow(0.90, dtFactor); // for 0.10 per frame
            this.vel.x += (desiredVx - this.vel.x) * blend;
            this.vel.y += (desiredVy - this.vel.y) * blend;

            const sp = Math.hypot(this.vel.x, this.vel.y);
            if (sp > this.maxSpeed) {
                const s = this.maxSpeed / sp;
                this.vel.x *= s;
                this.vel.y *= s;
            }
        }

        // Attacks
        this.burstCooldown -= dtFactor;
        this.mineCooldown -= dtFactor;

        // Telegraphed heavy laser: charge -> quick blast (single big hit if caught).
        const applyBeamDamageToPlayer = (amount) => {
            if (!player || player.dead) return;
            if (player.invulnerable > 0) return;
            let remaining = Math.max(0, Math.ceil(amount));
            // Outer shield (if any): each segment is 0/1.
            if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
                for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                    if (player.outerShieldSegments[i] > 0) {
                        player.outerShieldSegments[i] = 0;
                        remaining -= 1;
                    }
                }
            }
            // Inner shield: each segment can be 0..2.
            if (player.shieldSegments && player.shieldSegments.length > 0) {
                for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                    const absorb = Math.min(remaining, player.shieldSegments[i]);
                    player.shieldSegments[i] -= absorb;
                    remaining -= absorb;
                }
            }
            if (remaining > 0) {
                player.hp -= remaining;
                spawnParticles(player.pos.x, player.pos.y, 14, '#f00');
                playSound('hit');
                updateHealthUI();
                if (player.hp <= 0) killPlayer();
            } else {
                spawnParticles(player.pos.x, player.pos.y, 10, '#ff0');
                playSound('shield_hit');
            }
            player.invulnerable = 22;
        };

        if (this.laserFire > 0) {
            this.laserFire--;
            if (!this.laserHitThisShot) {
                const ex = this.pos.x + Math.cos(this.laserAngle) * this.laserLen;
                const ey = this.pos.y + Math.sin(this.laserAngle) * this.laserLen;
                const cp = closestPointOnSegment(player.pos.x, player.pos.y, this.pos.x, this.pos.y, ex, ey);
                const d = Math.hypot(player.pos.x - cp.x, player.pos.y - cp.y);
                const hitDist = (this.laserWidth * 0.5) + (player.radius * 0.55);
                if (d <= hitDist) {
                    this.laserHitThisShot = true;
                    const dmg = (this.phase === 2) ? 10 : 8;
                    applyBeamDamageToPlayer(dmg);
                    shakeMagnitude = Math.max(shakeMagnitude, 14);
                    shakeTimer = Math.max(shakeTimer, 14);
                }
            }
        } else if (this.laserDelay > 0) {
            this.laserDelay--;
            if (this.laserDelay === 0) {
                this.laserFire = this.laserFireTotal;
                this.laserHitThisShot = false;
                playSound('heavy_shoot');
                spawnParticles(this.pos.x + Math.cos(this.laserAngle) * (this.radius + 10), this.pos.y + Math.sin(this.laserAngle) * (this.radius + 10), 18, '#ff0');
            }
        } else if (this.laserCharge > 0) {
            this.laserCharge--;
            if (this.laserCharge === 0) {
                this.laserDelay = this.laserDelayTotal;
            }
        } else {
            this.laserCooldown--;
            const cd = (this.phase === 2) ? 280 : 560;
            const wantCharge = (this.phase === 2) ? 55 : 70;
            if (this.laserCooldown <= 0 && distToPlayer < 3200 && distToPlayer > 450) {
                this.laserAngle = aimToPlayer;
                this.laserChargeTotal = wantCharge;
                this.laserCharge = this.laserChargeTotal;
                this.laserDelay = 0;
                this.laserFireTotal = 10;
                this.laserFire = 0;
                this.laserCooldown = cd;
                this.laserHitThisShot = false;
                showOverlayMessage("SENTINEL LASER LOCK", '#ff0', 900, 2);
            }
        }

        if (this.mineCooldown <= 0) {
            // Bring back the mine pressure.
            const count = this.phase === 2 ? 10 : 7;
            for (let i = 0; i < count; i++) {
                const a = (Math.PI * 2 / count) * i + (this.t * 0.01);
                const maxTravel = 320 + Math.random() * 320;
                const dmg = 5;
                const blastRadius = 620;
                bossBombs.push(new CruiserMineBomb(this, a, maxTravel, dmg, blastRadius));
            }
            this.mineCooldown = this.phase === 2 ? 220 : 280;
        }

        if (this.burstCooldown <= 0) {
            const shots = this.phase === 2 ? 26 : 18;
            for (let i = 0; i < shots; i++) {
                const a = (Math.PI * 2 / shots) * i + (this.t * 0.015);
                const bx = this.pos.x + Math.cos(a) * (this.radius + 10);
                const by = this.pos.y + Math.sin(a) * (this.radius + 10);
                bullets.push(new Bullet(bx, by, a, true, 1, 9 + (this.phase === 2 ? 2 : 0), 4, '#f0f'));
            }
            this.spiralTimer = this.phase === 2 ? 90 : 45;
            this.burstCooldown = this.phase === 2 ? 95 : 120;
            playSound('shoot');
        }

        if (this.spiralTimer > 0) {
            this.spiralTimer -= dtFactor;

            // Accumulator for consistent spiral density independent of frame rate
            if (typeof this.spiralAccum === 'undefined') this.spiralAccum = 0;
            this.spiralAccum += dtFactor;

            while (this.spiralAccum >= 1) {
                this.spiralAccum -= 1;
                this.spiralAng += 0.18;
                const a = this.spiralAng;
                const bx = this.pos.x + Math.cos(a) * (this.radius + 14);
                const by = this.pos.y + Math.sin(a) * (this.radius + 14);
                bullets.push(new Bullet(bx, by, a, true, 1, 12, 3, '#ff6'));
            }
        }

        // Reinforcements.
        this.maybeCallHelpers();

        // Contact damage (prevents "hugging" the boss).
        if (distToPlayer < this.radius + player.radius + 4) {
            if (player.invulnerable <= 0) {
                player.hp -= 1;
                player.invulnerable = 22;
                spawnParticles(player.pos.x, player.pos.y, 10, '#f00');
                playSound('hit');
                updateHealthUI();
                if (player.hp <= 0) killPlayer();
            }
        }

        // Save previous position for interpolation
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        this.pos.add(this.vel);
    }

    maybeCallHelpers() {
        if (!warpZone || !warpZone.active) return;
        if (!bossActive) return;
        if (!player || player.dead) return;

        const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 0;
        const aliveHelpers = enemies.filter(e => e && !e.dead && e.isWarpReinforcement).length;
        const maxHelpers = this.helperMax;

        if (!this.called70 && hpPct <= 0.7) {
            this.called70 = true;
            this.spawnHelpers(this.helperCall70);
        }
        if (!this.called40 && hpPct <= 0.4) {
            this.called40 = true;
            this.spawnHelpers(this.helperCall40);
        }

        this.helperCooldown--;
        if (this.helperCooldown <= 0 && aliveHelpers < maxHelpers) {
            const burst = Math.min(this.helperBurst, maxHelpers - aliveHelpers);
            this.spawnHelpers(burst);
            this.helperCooldown = this.helperCooldownBase;
        }
    }

    spawnHelpers(count) {
        const aliveHelpers = enemies.filter(e => e && !e.dead && e.isWarpReinforcement).length;
        const slots = Math.max(0, this.helperMax - aliveHelpers);
        if (slots <= 0) return;
        count = Math.min(count, slots);

        const phase2 = (this.phase === 2);
        let types = ['roamer', 'defender', 'roamer', 'elite_roamer'];
        if (this.helperStrengthTier <= 0) types = ['roamer', 'roamer', 'defender'];
        if (phase2) types = ['defender', 'defender', 'hunter', 'elite_roamer'];

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            for (let attempt = 0; attempt < 25; attempt++) {
                const a = Math.random() * Math.PI * 2;
                const d = 900 + Math.random() * 700;
                const x = this.pos.x + Math.cos(a) * d;
                const y = this.pos.y + Math.sin(a) * d;
                const distP = Math.hypot(x - player.pos.x, y - player.pos.y);
                if (distP < 650) continue;
                const e = new Enemy(type, { x, y }, null);
                e.despawnImmune = true;
                e.isWarpReinforcement = true;
                enemies.push(e);
                spawnParticles(x, y, 10, '#f0f');
                break;
            }
        }
        showOverlayMessage("SENTINEL SUMMONED REINFORCEMENTS", '#f0f', 1200);
    }

    spawnDefenders(count) {
        const aliveHelpers = enemies.filter(e => e && !e.dead && e.isWarpReinforcement).length;
        const slots = Math.max(0, this.helperMax - aliveHelpers);
        if (slots <= 0) return;
        count = Math.min(count, slots);

        for (let i = 0; i < count; i++) {
            for (let attempt = 0; attempt < 25; attempt++) {
                const a = Math.random() * Math.PI * 2;
                const d = 900 + Math.random() * 700;
                const x = this.pos.x + Math.cos(a) * d;
                const y = this.pos.y + Math.sin(a) * d;
                const distP = Math.hypot(x - player.pos.x, y - player.pos.y);
                if (distP < 650) continue;
                const e = new Enemy('defender', { x, y }, null);
                e.despawnImmune = true;
                e.isWarpReinforcement = true;
                enemies.push(e);
                spawnParticles(x, y, 10, '#f0f');
                break;
            }
        }
        showOverlayMessage("DEFENDERS DEPLOYED", '#f0f', 1200);
    }

    draw(ctx) {
        if (this.dead) return;

        const rPos = this.getRenderPos(renderAlpha);
        const aim = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : 0;
        const z = currentZoom || ZOOM_LEVEL;

        // Pixi sprite rendering (rotate to face player)
        if (pixiBossLayer && pixiTextures && pixiTextures.warp_boss) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const spr = new PIXI.Sprite(pixiTextures.warp_boss);
                spr.anchor.set(0.5);
                container.addChild(spr);
                this._pixiSprite = spr;
            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;
            container.position.set(rPos.x, rPos.y);
            container.rotation = aim;

            if (this._pixiSprite) {
                const hullScale = this.sizeScale;
                this._pixiSprite.scale.set(hullScale);
            }

            if (pixiVectorLayer) {
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

                let innerGfx = this._pixiInnerGfx;
                if (!innerGfx) {
                    innerGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(innerGfx);
                    this._pixiInnerGfx = innerGfx;
                    this.shieldsDirty = true;
                } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                gfx.position.set(rPos.x, rPos.y);
                gfx.rotation = aim + this.shieldRotation;
                innerGfx.position.set(rPos.x, rPos.y);
                innerGfx.rotation = aim + this.innerShieldRotation;

                if (this.shieldsDirty) {
                    const drawShieldRing = (graphics, segments, radius, color) => {
                        if (!segments || segments.length === 0) return;
                        graphics.clear();
                        const count = segments.length;
                        const arcLen = (Math.PI * 2) / count;
                        graphics.lineStyle(8 / z, color, 0.8);
                        for (let i = 0; i < count; i++) {
                            if (segments[i] <= 0) continue;
                            const a0 = i * arcLen + 0.03;
                            const a1 = (i + 1) * arcLen - 0.03;
                            graphics.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
                            graphics.arc(0, 0, radius, a0, a1);
                        }
                    };
                    drawShieldRing(gfx, this.shieldSegments, this.shieldRadius, 0x00ffff);
                    drawShieldRing(innerGfx, this.innerShieldSegments, this.innerShieldRadius, 0xff00ff);
                    this.shieldsDirty = false;
                }
            }

            // Telegraphed heavy laser (charge line -> blast) overlay
            if ((this.laserCharge && this.laserCharge > 0) || (this.laserDelay && this.laserDelay > 0) || (this.laserFire && this.laserFire > 0)) {
                const a = this.laserAngle || aim;
                const ex = Math.cos(a) * this.laserLen;
                const ey = Math.sin(a) * this.laserLen;
                const charging = (this.laserCharge && this.laserCharge > 0);
                const locking = (this.laserDelay && this.laserDelay > 0);
                const firing = (this.laserFire && this.laserFire > 0);
                const pct = charging ? (1 - (this.laserCharge / (this.laserChargeTotal || 1))) : 1;
                ctx.save();
                ctx.translate(rPos.x, rPos.y);
                ctx.lineWidth = (this.laserWidth / z);
                if (charging || locking) {
                    ctx.setLineDash([12 / z, 10 / z]);
                    const lockPulse = locking ? (0.55 + 0.35 * Math.sin(this.t * 0.35)) : 1;
                    ctx.strokeStyle = `rgba(255, 220, 0, ${Math.min(0.75, (0.10 + pct * 0.35) * lockPulse + (locking ? 0.20 : 0))})`;
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = '#ff0';
                } else if (firing) {
                    ctx.setLineDash([]);
                    ctx.strokeStyle = 'rgba(255, 240, 0, 0.95)';
                    ctx.shadowBlur = 28;
                    ctx.shadowColor = '#ff0';
                }
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.setLineDash([]);
                if (firing) {
                    ctx.fillStyle = 'rgba(255, 240, 0, 0.85)';
                    ctx.beginPath();
                    ctx.arc(ex, ey, (10 / z), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            return;
        }

        // Fallback: procedural canvas rendering
        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.rotate(aim);

        const drawShieldRing = (segments, radius, color, strength) => {
            if (!segments || segments.length === 0) return;
            ctx.lineWidth = 8 / z;
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.8;
            const count = segments.length;
            const arcLen = (Math.PI * 2) / count;
            for (let i = 0; i < count; i++) {
                if (segments[i] <= 0) continue;
                const a0 = i * arcLen + 0.03;
                const a1 = (i + 1) * arcLen - 0.03;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
                ctx.arc(0, 0, radius, a0, a1);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        };

        drawShieldRing(this.shieldSegments, this.shieldRadius, '#0ff', this.shieldStrength);
        drawShieldRing(this.innerShieldSegments, this.innerShieldRadius, '#f0f', this.shieldStrength);

        ctx.shadowBlur = 26;
        ctx.shadowColor = '#f0f';
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 4 / z;
        ctx.fillStyle = 'rgba(20,0,20,0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Telegraphed heavy laser (charge line -> blast).
        if ((this.laserCharge && this.laserCharge > 0) || (this.laserDelay && this.laserDelay > 0) || (this.laserFire && this.laserFire > 0)) {
            const a = (this.laserAngle || aim) - aim;
            const ex = Math.cos(a) * this.laserLen;
            const ey = Math.sin(a) * this.laserLen;
            const charging = (this.laserCharge && this.laserCharge > 0);
            const locking = (this.laserDelay && this.laserDelay > 0);
            const firing = (this.laserFire && this.laserFire > 0);
            const pct = charging ? (1 - (this.laserCharge / (this.laserChargeTotal || 1))) : 1;
            ctx.save();
            ctx.lineWidth = (this.laserWidth / z);
            if (charging || locking) {
                ctx.setLineDash([12 / z, 10 / z]);
                const lockPulse = locking ? (0.55 + 0.35 * Math.sin(this.t * 0.35)) : 1;
                ctx.strokeStyle = `rgba(255, 220, 0, ${Math.min(0.75, (0.10 + pct * 0.35) * lockPulse + (locking ? 0.20 : 0))})`;
                ctx.shadowBlur = 16;
                ctx.shadowColor = '#ff0';
            } else if (firing) {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(255, 240, 0, 0.95)';
                ctx.shadowBlur = 28;
                ctx.shadowColor = '#ff0';
            }
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
            if (firing) {
                ctx.fillStyle = 'rgba(255, 240, 0, 0.85)';
                ctx.beginPath();
                ctx.arc(ex, ey, (10 / z), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.rotate(this.coreRot);
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ff6';
        ctx.fillStyle = '#ff6';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(18, 0);
        ctx.lineTo(0, 22);
        ctx.lineTo(-18, 0);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}
//space station class
class SpaceStation extends Entity {
    // Initialize the Space Station with massive health and shields
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 6000; // Spawn far away from player
        super(player.pos.x + Math.cos(angle) * dist, player.pos.y + Math.sin(angle) * dist);
        this.fixedPos = { x: this.pos.x, y: this.pos.y }; // Lock position forever

        const names = ["OMEGA", "NOVA", "TITAN", "ORION", "PHOENIX", "AURORA", "ASTRA", "ZEUS", "HELIOS", "HYPERION"];
        const suffix = Math.floor(Math.random() * 999);
        this.displayName = names[Math.floor(Math.random() * names.length)] + "-" + suffix;

        this.radius = Math.floor(520 * 0.65); // reduce size ~35%
        this.hp = 180;
        this.maxHp = 180;

        // Two layers of shields (increased gap to prevent overlap)
        this.shieldRadius = Math.floor(600 * 0.65);    // outer: ~390
        this.innerShieldRadius = Math.floor(560 * 0.65); // inner: ~364 (gap ~50px from hull)

        // High segment count for "boss" feel
        this.shieldSegments = new Array(36).fill(5);
        this.innerShieldSegments = new Array(32).fill(5);

        this.shieldRotation = 0;
        this.innerShieldRotation = 0;

        this.turretReload = 250; // 0.25 seconds in ms (2x faster)
        this.defenderSpawnTimer = 0;
        this.minefieldTimer = 2500; // Deploy minefield every 2.5 seconds
        this.shieldsDirty = true;
        this._pixiInnerGfx = null;

        // Telegraphed heavy laser (quick blast).
        // Fire less frequently; extra lock delay improves readability.
        this.laserCooldown = 560;
        this.laserCharge = 0;
        this.laserChargeTotal = 70;
        this.laserDelay = 0;
        this.laserDelayTotal = 15; // ~0.25s at 60fps after lock-in
        this.laserFire = 0;
        this.laserFireTotal = 5;
        this.laserAngle = 0;
        this.laserLen = 5200;
        this.laserWidth = 44;
        this.laserHitThisShot = false;
        this.t = 0;
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;

        // Keep station completely stationary (immovable)
        if (this.fixedPos) {
            this.pos.x = this.fixedPos.x;
            this.pos.y = this.fixedPos.y;
            this.vel.set(0, 0);
            this.angleVel = 0;
        }

        // Arena lock activation
        if (player && !player.dead && !stationArena.active) {
            const pdx = player.pos.x - this.pos.x;
            const pdy = player.pos.y - this.pos.y;
            const pdist = Math.hypot(pdx, pdy);
            if (pdist < stationArena.radius) {
                stationArena.active = true;
                showOverlayMessage("STATION DEFENSE FIELD - YOU ARE TRAPPED", '#f0f', 5000, 2);
                playSound('boss_spawn');
                if (typeof musicEnabled !== 'undefined' && musicEnabled) setMusicMode('cruiser');
            }
        }

        // Rotate shields in opposite directions for visual effect (scale by deltaTime)
        const dtFactor = deltaTime / 16.67;
        this.shieldRotation += 0.006 * dtFactor;
        this.innerShieldRotation -= 0.009 * dtFactor;

        // Check if player is within range to engage
        if (player && !player.dead) {
            const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            const aimToPlayer = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);

            if (dist < 2800) { // Engagement range reduced by 20%
                this.turretReload -= deltaTime; // deltaTime is in ms
                if (this.turretReload <= 0) {
                    this.fireTurrets();
                    this.turretReload = 250; // 0.25 seconds in ms (2x faster)
                }

                // Minefield attack
                this.minefieldTimer -= deltaTime;
                if (this.minefieldTimer <= 0) {
                    this.deployBombs();
                    this.minefieldTimer = 2500; // Reset to 2.5 seconds
                }

                // Telegraphed heavy laser (quick blast).
                const applyBeamDamageToPlayer = (amount) => {
                    if (!player || player.dead) return;
                    if (player.invulnerable > 0) return;
                    let remaining = Math.max(0, Math.ceil(amount));
                    // Outer shield (if any): each segment is 0/1.
                    if (player.outerShieldSegments && player.outerShieldSegments.length > 0) {
                        for (let i = 0; i < player.outerShieldSegments.length && remaining > 0; i++) {
                            if (player.outerShieldSegments[i] > 0) {
                                player.outerShieldSegments[i] = 0;
                                remaining -= 1;
                            }
                        }
                    }
                    // Inner shield: each segment can be 0..2.
                    if (player.shieldSegments && player.shieldSegments.length > 0) {
                        for (let i = 0; i < player.shieldSegments.length && remaining > 0; i++) {
                            const absorb = Math.min(remaining, player.shieldSegments[i]);
                            player.shieldSegments[i] -= absorb;
                            remaining -= absorb;
                        }
                    }
                    if (remaining > 0) {
                        player.hp -= remaining;
                        spawnParticles(player.pos.x, player.pos.y, 14, '#f00');
                        playSound('hit');
                        updateHealthUI();
                        if (player.hp <= 0) killPlayer();
                    } else {
                        spawnParticles(player.pos.x, player.pos.y, 10, '#ff0');
                        playSound('shield_hit');
                    }
                    player.invulnerable = 11;
                };

                if (this.laserFire > 0) {
                    this.laserFire--;
                    if (!this.laserHitThisShot) {
                        const ex = this.pos.x + Math.cos(this.laserAngle) * this.laserLen;
                        const ey = this.pos.y + Math.sin(this.laserAngle) * this.laserLen;
                        const cp = closestPointOnSegment(player.pos.x, player.pos.y, this.pos.x, this.pos.y, ex, ey);
                        const d = Math.hypot(player.pos.x - cp.x, player.pos.y - cp.y);
                        const hitDist = (this.laserWidth * 0.5) + (player.radius * 0.55);
                        if (d <= hitDist) {
                            this.laserHitThisShot = true;
                            const dmg = 8;
                            applyBeamDamageToPlayer(dmg);
                            shakeMagnitude = Math.max(shakeMagnitude, 14);
                            shakeTimer = Math.max(shakeTimer, 14);
                        }
                    }
                } else if (this.laserDelay > 0) {
                    this.laserDelay--;
                    if (this.laserDelay === 0) {
                        this.laserFire = this.laserFireTotal;
                        this.laserHitThisShot = false;
                        playSound('heavy_shoot');
                        spawnParticles(this.pos.x + Math.cos(this.laserAngle) * (this.radius + 10), this.pos.y + Math.sin(this.laserAngle) * (this.radius + 10), 18, '#ff0');
                    }
                } else if (this.laserCharge > 0) {
                    this.laserCharge--;
                    if (this.laserCharge === 0) {
                        this.laserDelay = this.laserDelayTotal;
                    }
                } else {
                    this.laserCooldown--;
                    const cd = 560;
                    const wantCharge = 70;
                    if (this.laserCooldown <= 0 && dist < 3200 && dist > 450) {
                        this.laserAngle = aimToPlayer;
                        this.laserChargeTotal = wantCharge;
                        this.laserCharge = this.laserChargeTotal;
                        this.laserDelay = 0;
                        this.laserFireTotal = 10;
                        this.laserFire = 0;
                        this.laserCooldown = cd;
                        this.laserHitThisShot = false;
                        showOverlayMessage("STATION LASER LOCK", '#ff0', 900, 2);
                    }
                }

                this.manageDefenders(deltaTime);
            }
        }
    }

    manageDefenders(deltaTime = 16.67) {
        let myDefenderCount = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e && !e.dead && e.assignedBase === this) myDefenderCount++;
        }
        if (myDefenderCount < 4) {
            if (this.defenderSpawnTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const d = this.radius + 70;
                const sx = this.pos.x + Math.cos(angle) * d;
                const sy = this.pos.y + Math.sin(angle) * d;
                enemies.push(new Enemy('defender', { x: sx, y: sy }, this));
                spawnParticles(sx, sy, 15, '#0f0');
                this.defenderSpawnTimer = 180; // Spawn every 3 seconds (60 FPS)
            } else {
                this.defenderSpawnTimer -= deltaTime / 16.67;
            }
        }
    }

    // Fires 4 turrets mounted on the station (1 bullet each, every 0.5s)
    fireTurrets() {
        const offsets = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]; // 4 turrets at 90A? intervals
        for (let i = 0; i < offsets.length; i++) {
            // Calculate turret position based on current rotation
            const angleOffset = offsets[i] + this.shieldRotation;
            const tx = this.pos.x + Math.cos(angleOffset) * (this.radius * 0.75);
            const ty = this.pos.y + Math.sin(angleOffset) * (this.radius * 0.75);

            // Aim at player
            const angle = Math.atan2(player.pos.y - ty, player.pos.x - tx);

            // Single bullet per turret (radius 6 like gunboat bullets)
            const b = new Bullet(tx, ty, angle, true, 2, 14.96, 6, '#f80');
            bullets.push(b);
            spawnBarrelSmoke(tx, ty, angle);
        }
        playSound('rapid_shoot');
    }

    // Deploy bombs in 8 directions (like warp boss) - explode after traveling max distance
    deployBombs() {
        const bombCount = 8;
        for (let i = 0; i < bombCount; i++) {
            // 8 directions: 0, 45, 90, 135, 180, 225, 270, 315 degrees
            const angle = (i / bombCount) * Math.PI * 2;

            const maxTravel = 600 + Math.random() * 300;
            const dmg = 5;
            const blastRadius = 350;

            const bomb = new CruiserMineBomb(this, angle, maxTravel, dmg, blastRadius);
            bossBombs.push(bomb);
        }
        spawnParticles(this.pos.x, this.pos.y, 20, '#f00');
        playSound('boss_spawn');
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }
            return;
        }

        // Arena barrier draw (always canvas for visibility)
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const arenaPulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.3;
        ctx.strokeStyle = stationArena.active ? `rgba(255,0,255,${0.5 + arenaPulse * 0.3})` : `rgba(255,255,0,${0.25 + arenaPulse * 0.15})`;
        ctx.lineWidth = 12;
        ctx.shadowBlur = stationArena.active ? 40 : 20;
        ctx.shadowColor = stationArena.active ? '#f0f' : '#ff0';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, stationArena.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Telegraphed heavy laser (charge line -> blast).
        if ((this.laserCharge && this.laserCharge > 0) || (this.laserDelay && this.laserDelay > 0) || (this.laserFire && this.laserFire > 0)) {
            const a = this.laserAngle;
            const ex = Math.cos(a) * this.laserLen;
            const ey = Math.sin(a) * this.laserLen;
            const charging = (this.laserCharge && this.laserCharge > 0);
            const locking = (this.laserDelay && this.laserDelay > 0);
            const firing = (this.laserFire && this.laserFire > 0);
            const pct = charging ? (1 - (this.laserCharge / (this.laserChargeTotal || 1))) : 1;
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            const z = currentZoom || ZOOM_LEVEL;
            ctx.lineWidth = (this.laserWidth / z);
            if (charging || locking) {
                ctx.setLineDash([12 / z, 10 / z]);
                const lockPulse = locking ? (0.55 + 0.35 * Math.sin(this.t * 0.35)) : 1;
                ctx.strokeStyle = `rgba(255, 220, 0, ${Math.min(0.75, (0.10 + pct * 0.35) * lockPulse + (locking ? 0.20 : 0))})`;
                ctx.shadowBlur = 16;
                ctx.shadowColor = '#ff0';
            } else if (firing) {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(255, 240, 0, 0.95)';
                ctx.shadowBlur = 28;
                ctx.shadowColor = '#ff0';
            }
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
            // Endpoint flash
            if (firing) {
                ctx.fillStyle = 'rgba(255, 240, 0, 0.85)';
                ctx.beginPath();
                ctx.arc(ex, ey, (10 / z), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Pixi fast path (station hull + turrets + shields + nameplate)
        if (pixiBossLayer && pixiTextures && pixiTextures.station_hull) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures.station_hull);
                const ha = pixiTextureAnchors.station_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;

            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);

            const now = (typeof frameNow === 'number' && frameNow > 0) ? frameNow : Date.now();
            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 340) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            // Turrets (4 visuals)
            const offsets = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
            const turrets = this._pixiTurrets || [];
            for (let i = 0; i < turrets.length; i++) {
                const t = turrets[i];
                if (!t) continue;
                const angleOffset = offsets[i] + (this.shieldRotation || 0);
                const tx = Math.cos(angleOffset) * (this.radius * 0.75);
                const ty = Math.sin(angleOffset) * (this.radius * 0.75);
                t.position.set(tx, ty);
                let aim = angleOffset;
                if (player && !player.dead) {
                    aim = Math.atan2(player.pos.y - (this.pos.y + ty), player.pos.x - (this.pos.x + tx));
                }
                t.rotation = aim;
            }

            // Shields + nameplate (vector layer)
            if (pixiVectorLayer) {
                const hasOuter = (this.shieldSegments && this.shieldSegments.length > 0);
                const hasInner = (this.innerShieldSegments && this.innerShieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner);

                if (needs) {
                    // --- Outer Shield ---
                    let gfx = this._pixiGfx;
                    if (hasOuter) {
                        if (!gfx) {
                            gfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(gfx);
                            this._pixiGfx = gfx;
                            this.shieldsDirty = true;
                        } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

                        gfx.position.set(this.pos.x, this.pos.y);
                        gfx.rotation = this.shieldRotation || 0;
                    } else if (gfx) {
                        try { gfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                        gfx = null;
                    }

                    // --- Inner Shield ---
                    let innerGfx = this._pixiInnerGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(this.pos.x, this.pos.y);
                        innerGfx.rotation = this.innerShieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                        innerGfx = null;
                    }

                    if (this.shieldsDirty) {
                        const drawRing = (graphics, segments, radius, color) => {
                            if (!segments || segments.length === 0) return;
                            graphics.clear();
                            const count = segments.length;
                            const arcLen = (Math.PI * 2) / count;
                            // We lose the per-segment pulse for caching optimization.
                            // Instead we apply a static alpha. To regain pulse, we'd need to modify container alpha in update loop.
                            // For now, static alpha 0.8 looks fine.
                            graphics.lineStyle(8, color, 0.8);
                            for (let i = 0; i < count; i++) {
                                if (segments[i] > 0) {
                                    // Draw at base angle 0
                                    const a0 = i * arcLen + 0.02;
                                    const a1 = (i + 1) * arcLen - 0.02;
                                    graphics.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
                                    graphics.arc(0, 0, radius, a0, a1);
                                }
                            }
                        };

                        if (gfx && hasOuter) drawRing(gfx, this.shieldSegments, this.shieldRadius, 0x00ffff);
                        if (innerGfx && hasInner) drawRing(innerGfx, this.innerShieldSegments, this.innerShieldRadius, 0xff00ff);

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiInnerGfx) {
                        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                    }
                }

                if (this.displayName) {
                    let t = this._pixiNameText;
                    if (!t) {
                        t = new PIXI.Text(this.displayName, {
                            fontFamily: 'Courier New',
                            fontSize: 18,
                            fontWeight: 'bold',
                            fill: 0x00ffff
                        });
                        t.anchor.set(0.5);
                        t.resolution = 2;
                        pixiVectorLayer.addChild(t);
                        this._pixiNameText = t;
                    } else if (t.text !== this.displayName) {
                        t.text = this.displayName;
                    }
                    if (!t.parent) pixiVectorLayer.addChild(t);
                    t.visible = true;
                    t.position.set(this.pos.x, this.pos.y - this.radius - 20);
                } else if (this._pixiNameText) {
                    try { this._pixiNameText.destroy(true); } catch (e) { }
                    this._pixiNameText = null;
                }
            }

            return;
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const now = (typeof frameNow === 'number' && frameNow > 0) ? frameNow : Date.now();

        // --- 1. Rotating Outer Ring Structure ---
        ctx.save();
        ctx.rotate(this.shieldRotation * 0.5);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 20;
        ctx.beginPath();
        const ringRad = this.radius - 30;
        ctx.arc(0, 0, ringRad, 0, Math.PI * 2);
        ctx.stroke();

        // Mechanical Teeth/Docking Ports
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        const teeth = 12;
        for (let i = 0; i < teeth; i++) {
            const a = (i / teeth) * Math.PI * 2;
            const tx = Math.cos(a) * ringRad;
            const ty = Math.sin(a) * ringRad;
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.rect(-15, -25, 30, 50);
            ctx.fill();
            ctx.stroke();
            // Small light
            ctx.fillStyle = i % 2 === 0 ? '#f00' : '#ff0';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // --- 2. Main Hull Body ---
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0ff';

        ctx.beginPath();
        ctx.arc(0, 0, this.visualRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // --- 3. Tech Patterning ---
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Radial lines
        for (let i = 0; i < 8; i++) {
            const a = i * (Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * this.radius * 0.25, Math.sin(a) * this.radius * 0.25);
            ctx.lineTo(Math.cos(a) * this.radius * 0.75, Math.sin(a) * this.radius * 0.75);
            ctx.stroke();
        }

        // --- 4. Central Reactor Core ---
        const pulse = 1.0 + Math.sin(now * 0.005) * 0.15;

        // Core housing
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing center
        ctx.fillStyle = '#f0f';
        ctx.shadowBlur = 30 * pulse;
        ctx.shadowColor = '#f0f';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.15 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // --- 5. Turrets (High Tech) ---
        const offsets = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
        for (let i = 0; i < 4; i++) {
            const angleOffset = offsets[i] + this.shieldRotation;
            // Mount on the main hull rim
            const tx = Math.cos(angleOffset) * (this.radius * 0.75);
            const ty = Math.sin(angleOffset) * (this.radius * 0.75);

            ctx.save();
            ctx.translate(tx, ty);
            let aim = angleOffset;
            if (player && !player.dead) {
                aim = Math.atan2(player.pos.y - (this.pos.y + ty), player.pos.x - (this.pos.x + tx));
            }
            ctx.rotate(aim);

            // Base
            ctx.fillStyle = '#333';
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Barrels (Twin Heavy)
            ctx.fillStyle = '#f44';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f00';
            ctx.fillRect(10, -12, 40, 8);
            ctx.fillRect(10, 4, 40, 8);
            ctx.shadowBlur = 0;

            // Center pivot
            ctx.fillStyle = '#aaa';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // --- 6. Shields ---
        const drawShieldRing = (segments, radius, rotation, color) => {
            ctx.save();
            ctx.rotate(rotation);
            ctx.lineWidth = 8;
            const count = segments.length;
            const arcLen = (Math.PI * 2) / count;
            ctx.strokeStyle = color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            const t = now * 0.008;
            for (let i = 0; i < count; i++) {
                if (segments[i] > 0) {
                    // Pulse alpha for "energy" feel
                    const energyPulse = 0.6 + Math.sin(t + i) * 0.3;
                    ctx.globalAlpha = Math.min(1, (segments[i] / 2) * energyPulse);
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, i * arcLen + 0.02, (i + 1) * arcLen - 0.02);
                    ctx.stroke();
                }
            }
            ctx.restore();
        };

        drawShieldRing(this.shieldSegments, this.shieldRadius, this.shieldRotation, '#0ff');
        drawShieldRing(this.innerShieldSegments, this.innerShieldRadius, this.innerShieldRotation, '#f0f');

        // Nameplate
        if (this.displayName) {
            ctx.fillStyle = '#0ff';
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000';
            ctx.fillText(this.displayName, 0, -this.radius - 20);
            ctx.shadowBlur = 0;
        }

        // Draw Tractor Beam
        if (this.tractorBeamActive) {
            // Pulse effect like boss arena
            const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;

            // Outer glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#0ff';

            // Solid line
            ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`; // Cyan
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.tractorBeamRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Reset shadow
            ctx.shadowBlur = 0;

            // Faint fill
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#055';
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }
}

// Destroyer ship class - roams the map and drops 20 nugz when defeated
class Destroyer extends Entity {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 4000; // Spawn somewhat far from player
        super(player.pos.x + Math.cos(angle) * dist, player.pos.y + Math.sin(angle) * dist);

        this.displayName = "DESTROYER";

        this.visualRadius = Math.floor(520 * 0.65) * 2 * 1.5; // 1.5x larger than Destroyer (visual scale)
        this.radius = Math.round(this.visualRadius * 0.5); // Collision trimmed to hull, not PNG bounds
        this.collisionRadius = this.radius;
        this.hp = 300;
        this.maxHp = 300;

        // Movement properties for roaming
        this.roamSpeed = 1.5; // Slow roaming speed
        this.roamAngle = Math.random() * Math.PI * 2;
        this.angle = this.roamAngle;
        this.roamInterval = 900 + Math.floor(Math.random() * 600); // Rare direction changes (15-25s)
        this.roamTimer = this.roamInterval;
        this.turnSpeed = 0.008; // Slow turning per frame at 60fps
        this.baseTurnSpeed = 0.008;
        this.farTurnSpeed = 0.05;
        this.chaseDistance = 8000;

        // Outer + inner shields for destroyer (optimized segment count for performance)
        this.maxShieldHp = 3;
        this.shieldSegments = new Array(80).fill(3);
        this.innerShieldSegments = new Array(70).fill(3);
        this.shieldRadius = Math.round(this.visualRadius * 0.85);
        this.innerShieldRadius = Math.round(this.visualRadius * 0.78);
        this.shieldRotation = 0;
        this.innerShieldRotation = 0;
        this.shieldsDirty = true;
        this.shieldRegenMs = 3000;
        this.lastShieldRegenAt = Date.now();
        this.invulnerable = 0;
        this.invincibilityCycle = {
            unlocked: true,
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 180, cooldown: 600, regen: false } // 3s active / 10s CD
        };

        // Single turret fire
        this.turretReload = 1000; // 1.0 seconds
        this.t = 0;

        this.turretLocalOffsets = [
            { x: 0, y: -0.35 }
        ];

        this.ringAttackTimer = 5000;
        this.guidedMissileTimer = 2000;

        // Tractor Beam properties
        this.tractorBeamActive = false;
        this.tractorBeamRadius = 3000; // 20% larger than 2500 arena
        this.tractorBeamTextShown = false;
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;

        const now = Date.now();

        // Roaming movement - slowly move around the map, always moving forward
        const dtFactor = deltaTime / 16.67;
        this.roamTimer -= dtFactor;

        const playerAlive = player && !player.dead;
        const distToPlayer = playerAlive ? Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y) : 0;
        if (playerAlive && distToPlayer > this.chaseDistance) {
            this.roamAngle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
            this.turnSpeed = this.farTurnSpeed;
        } else {
            this.turnSpeed = this.baseTurnSpeed;
            if (this.roamTimer <= 0) {
                const drift = (Math.random() - 0.5) * 0.35;
                this.roamAngle = (this.angle || 0) + drift;
                this.roamTimer = this.roamInterval;
            }
        }

        // Smoothly turn toward roamAngle instead of snapping
        let angleDiff = this.roamAngle - (this.angle || 0);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const turnStep = this.turnSpeed * dtFactor;
        if (Math.abs(angleDiff) < turnStep) this.angle = this.roamAngle;
        else this.angle += Math.sign(angleDiff) * turnStep;

        // Apply velocity for roaming (always move forward in the direction we're facing)
        this.vel.x = Math.cos(this.angle || 0) * this.roamSpeed;
        this.vel.y = Math.sin(this.angle || 0) * this.roamSpeed;
        super.update(deltaTime);

        // Keep within reasonable bounds (stay within 15000 of center)
        const distFromCenter = Math.hypot(this.pos.x, this.pos.y);
        if (distFromCenter > 15000) {
            this.roamAngle = Math.atan2(-this.pos.y, -this.pos.x);
        }

        // Outer/inner shield rotation (opposite directions)
        this.shieldRotation += 0.004 * dtFactor;
        this.innerShieldRotation -= 0.006 * dtFactor;

        // Shield regen: restore 1 segment every 5s (outer first, then inner)
        if (now - this.lastShieldRegenAt >= this.shieldRegenMs) {
            const outerIdx = this.shieldSegments.findIndex(s => s < 3);
            if (outerIdx !== -1) {
                this.shieldSegments[outerIdx] = 3;
                this.shieldsDirty = true;
            } else {
                const innerIdx = this.innerShieldSegments.findIndex(s => s < 3);
                if (innerIdx !== -1) {
                    this.innerShieldSegments[innerIdx] = 3;
                    this.shieldsDirty = true;
                }
            }
            this.lastShieldRegenAt = now;
        }

        // Auto-cycling invincibility phase shield
        if (this.invincibilityCycle && this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtFactor;

            if (this.invincibilityCycle.state === 'ready') {
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2;
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'cooldown';
                    this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
                }
            } else if (this.invincibilityCycle.state === 'cooldown') {
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'ready';
                }
            }
        }

        // Check if player is within range to engage with turrets
        if (playerAlive) {
            const dist = distToPlayer;

            if (dist < 3200) { // Engagement range
                this.turretReload -= deltaTime;
                if (this.turretReload <= 0) {
                    this.fireTurrets();
                    this.turretReload = 1000; // 1.0 seconds in ms
                }

                this.ringAttackTimer -= deltaTime;
                if (this.ringAttackTimer <= 0) {
                    this.fireRing(16, 8.0, 8, '#ff0');
                    // Fire more frequently (every 2s) when damaged below 50%
                    this.ringAttackTimer = (this.hp < this.maxHp * 0.5) ? 2000 : 5000;
                }
            }

            this.guidedMissileTimer -= deltaTime;
            if (this.guidedMissileTimer <= 0) {
                guidedMissiles.push(new FlagshipGuidedMissile(this));
                this.guidedMissileTimer = 2000;
            }
        }


        // Tractor Beam Logic
        if (!this.tractorBeamActive && this.hp < this.maxHp * 0.8) {
            this.tractorBeamActive = true;
            if (!this.tractorBeamTextShown) {
                showOverlayMessage("You are caught in Tractor Beam", '#0ff', 3000); // 0ff for cyan beam
                this.tractorBeamTextShown = true;
            }
        }

        if (this.tractorBeamActive && playerAlive) {
            const dx = player.pos.x - this.pos.x;
            const dy = player.pos.y - this.pos.y;
            const dist = Math.hypot(dx, dy);

            // If player is outside the beam radius, pull them back in
            if (dist > this.tractorBeamRadius) {
                const angle = Math.atan2(dy, dx);
                // Clamp position
                player.pos.x = this.pos.x + Math.cos(angle) * (this.tractorBeamRadius - 5);
                player.pos.y = this.pos.y + Math.sin(angle) * (this.tractorBeamRadius - 5);

                // Kill outward velocity component to prevent glitchy movement against the wall
                // Simple approach: dampen all velocity or just reflect? 
                // Let's just dampen heavily if moving away
                const dot = player.vel.x * Math.cos(angle) + player.vel.y * Math.sin(angle);
                if (dot > 0) {
                    player.vel.x *= 0.1;
                    player.vel.y *= 0.1;
                }
            }
        }

        if (this.invulnerable > 0) {
            this.invulnerable -= dtFactor;
        }
    }

    fireTurrets() {
        const baseAngle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
        const muzzle = this.visualRadius * 0.45;
        const tx = this.pos.x + Math.cos(baseAngle) * muzzle;
        const ty = this.pos.y + Math.sin(baseAngle) * muzzle;
        const spread = 0.18;
        const bulletSpeed = 14.96 * 0.7;
        const bulletRadius = 15 * 0.5;

        // Rage mode: fire 5 shots spread wider instead of 3
        let angles;
        if (this.hp < this.maxHp * 0.5) {
            angles = [baseAngle - spread * 2, baseAngle - spread, baseAngle, baseAngle + spread, baseAngle + spread * 2];
        } else {
            angles = [baseAngle - spread, baseAngle, baseAngle + spread];
        }

        for (const a of angles) {
            const b = new Bullet(tx, ty, a, true, 10, bulletSpeed, bulletRadius, '#f80');
            b.life = Math.round(b.life * 1.25);
            bullets.push(b);
        }
        spawnBarrelSmoke(tx, ty, baseAngle);
        playSound('rapid_shoot');
    }

    fireRing(n, speed, dmg, color) {
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const b = new Bullet(this.pos.x, this.pos.y, a, true, dmg, speed, 6, color);
            b.life = 140;
            bullets.push(b);
        }
        playSound('shotgun');
    }

    takeHit(dmg = 1) {
        if (this.dead || this.invulnerable > 0) return false;
        this.hp -= dmg;
        playSound('hit');
        if (this.hp <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);

        // If tractor beam was active, delay the cruiser timer resume by 20s
        if (this.tractorBeamActive) {
            cruiserTimerResumeAt = Date.now() + 20000;
            showOverlayMessage("TRACTOR BEAM DOWN - SYSTEM REBOOTING (20s)", '#0ff', 4000);
        }

        // Drop 20 nuggets
        for (let i = 0; i < 20; i++) {
            nuggets.push(new SpaceNugget(
                this.pos.x + (Math.random() - 0.5) * 200,
                this.pos.y + (Math.random() - 0.5) * 200,
                1
            ));
        }

        const boomScale = Math.max(2.8, Math.min(5, (this.visualRadius || this.radius || 400) / 250));
        // Use generic boss explosion for background visual
        spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 22);

        // ADDED: Large particle explosion for Destroyer (Scale 3.5)
        spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);

        spawnParticles(this.pos.x, this.pos.y, 80, '#0ff');
        playSound('base_explode');
        shakeMagnitude = Math.max(shakeMagnitude, 18);
        shakeTimer = Math.max(shakeTimer, 20);
        showOverlayMessage("DESTROYER DESTROYED - 20 NUGGETS DROPPED", '#ff0', 2000, 2);

        // Set respawn timer - spawn the OTHER destroyer type
        currentDestroyerType = (currentDestroyerType === 1) ? 2 : 1;
        nextDestroyerSpawnTime = Date.now() + 60000; // 1 minute
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        // Pixi fast path (destroyer hull + turrets)
        if (pixiBossLayer && pixiTextures && pixiTextures.destroyer_hull) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures.destroyer_hull);
                const ha = pixiTextureAnchors.destroyer_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;

            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);
            container.rotation = this.angle || 0;

            const now = (typeof frameNow === 'number' && frameNow > 0) ? frameNow : Date.now();
            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 340) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            // Outer + inner shields (vector layer)
            if (pixiVectorLayer && this.shieldSegments && this.shieldSegments.length > 0) {
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.position.set(this.pos.x, this.pos.y);
                gfx.rotation = this.shieldRotation || 0;
                if (this.shieldsDirty) {
                    gfx.clear();
                    const count = this.shieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.1 * (36 / count);
                    const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
                    for (let i = 0; i < count; i++) {
                        const v = this.shieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            gfx.lineStyle(6, 0x00ffff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                            gfx.arc(0, 0, this.shieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiGfx) {
                try { this._pixiGfx.destroy(true); } catch (e) { }
                this._pixiGfx = null;
            }

            if (pixiVectorLayer && this.innerShieldSegments && this.innerShieldSegments.length > 0) {
                let innerGfx = this._pixiInnerGfx;
                if (!innerGfx) {
                    innerGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(innerGfx);
                    this._pixiInnerGfx = innerGfx;
                    this.shieldsDirty = true;
                } else if (!innerGfx.parent) {
                    pixiVectorLayer.addChild(innerGfx);
                }

                innerGfx.position.set(this.pos.x, this.pos.y);
                innerGfx.rotation = this.innerShieldRotation || 0;
                if (this.shieldsDirty) {
                    innerGfx.clear();
                    const count = this.innerShieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.05 * (24 / count);
                    const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
                    for (let i = 0; i < count; i++) {
                        const v = this.innerShieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            innerGfx.lineStyle(5, 0xff00ff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                            innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }

            if (this.shieldsDirty) this.shieldsDirty = false;

            if (pixiVectorLayer && this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
                let phaseGfx = this._pixiPhaseGfx;
                if (!phaseGfx) {
                    phaseGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(phaseGfx);
                    this._pixiPhaseGfx = phaseGfx;
                } else if (!phaseGfx.parent) {
                    pixiVectorLayer.addChild(phaseGfx);
                }
                phaseGfx.clear();
                phaseGfx.position.set(this.pos.x, this.pos.y);
                phaseGfx.lineStyle(3, 0xffdc00, 0.6);
                phaseGfx.drawCircle(0, 0, (this.shieldRadius || this.radius || 0) + 14);
            } else if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }

            // Nameplate
            if (this.displayName && pixiVectorLayer) {
                let txt = this._pixiNameText;
                if (!txt) {
                    txt = new PIXI.Text(this.displayName, {
                        fontFamily: 'Courier New',
                        fontSize: 18,
                        fontWeight: 'bold',
                        fill: 0xff8000
                    });
                    txt.anchor.set(0.5);
                    txt.resolution = 2;
                    pixiVectorLayer.addChild(txt);
                    this._pixiNameText = txt;
                } else if (txt.text !== this.displayName) {
                    txt.text = this.displayName;
                }
                if (!txt.parent) pixiVectorLayer.addChild(txt);
                txt.visible = true;
                txt.position.set(this.pos.x, this.pos.y - this.visualRadius - 20);
            }

            // Draw Tractor Beam (red ring like arena)
            if (this.tractorBeamActive && pixiVectorLayer) {
                let beamGfx = this._pixiTractorBeamGfx;
                if (!beamGfx) {
                    beamGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(beamGfx);
                    this._pixiTractorBeamGfx = beamGfx;
                } else if (!beamGfx.parent) {
                    pixiVectorLayer.addChild(beamGfx);
                }
                beamGfx.clear();
                beamGfx.position.set(this.pos.x, this.pos.y);

                // Pulsing red like boss arena
                const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
                beamGfx.lineStyle(10, 0xff0000, pulse);
                beamGfx.drawCircle(0, 0, this.tractorBeamRadius);
            } else if (this._pixiTractorBeamGfx) {
                try { this._pixiTractorBeamGfx.destroy(true); } catch (e) { }
                this._pixiTractorBeamGfx = null;
            }

            return;
        }

        // Fallback canvas rendering
        if (this.shieldSegments && this.shieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.shieldRotation || 0);
            ctx.lineWidth = 6;
            const count = this.shieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.1 * (36 / count);
            const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
            for (let i = 0; i < count; i++) {
                const v = this.shieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.shieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.innerShieldRotation || 0);
            ctx.lineWidth = 5;
            const count = this.innerShieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.05 * (24 / count);
            const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
            for (let i = 0; i < count; i++) {
                const v = this.innerShieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(255, 0, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.innerShieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.strokeStyle = 'rgba(255, 220, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (this.shieldRadius || this.radius || 0) + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle || 0);

        // Main hull
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#ff8000';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff8000';
        ctx.beginPath();
        ctx.arc(0, 0, this.visualRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Nameplate
        ctx.restore();
        if (this.displayName) {
            ctx.fillStyle = '#ff8000';
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000';
            ctx.fillText(this.displayName, this.pos.x, this.pos.y - this.visualRadius - 20);
            ctx.shadowBlur = 0;
        }

        // Canvas fallback: Draw Tractor Beam (red ring like arena)
        if (this.tractorBeamActive) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.lineWidth = 10;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f00';
            ctx.beginPath();
            ctx.arc(0, 0, this.tractorBeamRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}


class Destroyer2 extends Entity {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 4000; // Spawn somewhat far from player
        super(player.pos.x + Math.cos(angle) * dist, player.pos.y + Math.sin(angle) * dist);

        this.displayName = "DESTROYER II";

        this.visualRadius = Math.floor(520 * 0.65) * 2 * 1.5; // Match Destroyer size (visual scale)
        this.radius = Math.round(this.visualRadius * 0.5); // Collision trimmed to hull, not PNG bounds
        this.collisionRadius = this.radius;
        this.hp = 300;
        this.maxHp = 300;

        // Movement properties for roaming
        this.roamSpeed = 1.5; // Slow roaming speed
        this.roamAngle = Math.random() * Math.PI * 2;
        this.angle = this.roamAngle;
        this.roamInterval = 900 + Math.floor(Math.random() * 600); // Rare direction changes (15-25s)
        this.roamTimer = this.roamInterval;
        this.turnSpeed = 0.008; // Slow turning per frame at 60fps
        this.baseTurnSpeed = 0.008;
        this.farTurnSpeed = 0.05;
        this.chaseDistance = 8000;

        // Outer + inner shields for destroyer (optimized segment count for performance)
        this.maxShieldHp = 3;
        this.shieldSegments = new Array(80).fill(3);
        this.innerShieldSegments = new Array(70).fill(3);
        this.shieldRadius = Math.round(this.visualRadius * 0.85);
        this.innerShieldRadius = Math.round(this.visualRadius * 0.78);
        this.shieldRotation = 0;
        this.innerShieldRotation = 0;
        this.shieldsDirty = true;
        this.shieldRegenMs = 3000;
        this.lastShieldRegenAt = Date.now();
        this.invulnerable = 0;
        this.invincibilityCycle = {
            unlocked: true,
            state: 'ready', // ready, active, cooldown
            timer: 0,
            stats: { duration: 180, cooldown: 600, regen: false } // 3s active / 10s CD
        };

        // Turrets only (4 turrets like space station)
        this.turretReload = 100; // 3x rate (0.1 seconds)
        this.t = 0;

        this.turretLocalOffsets = [
            { x: -0.42, y: -0.02 },
            { x: 0.42, y: -0.02 },
            { x: -0.42, y: 0.24 },
            { x: 0.42, y: 0.24 }
        ];

        this.ringAttackTimer = 5000;
        this.guidedMissileTimer = 2000;
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;

        const now = Date.now();

        // Roaming movement - slowly move around the map, always moving forward
        const dtFactor = deltaTime / 16.67;
        this.roamTimer -= dtFactor;

        const playerAlive = player && !player.dead;
        const distToPlayer = playerAlive ? Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y) : 0;
        if (playerAlive && distToPlayer > this.chaseDistance) {
            this.roamAngle = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
            this.turnSpeed = this.farTurnSpeed;
        } else {
            this.turnSpeed = this.baseTurnSpeed;
            if (this.roamTimer <= 0) {
                const drift = (Math.random() - 0.5) * 0.35;
                this.roamAngle = (this.angle || 0) + drift;
                this.roamTimer = this.roamInterval;
            }
        }

        // Smoothly turn toward roamAngle instead of snapping
        let angleDiff = this.roamAngle - (this.angle || 0);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const turnStep = this.turnSpeed * dtFactor;
        if (Math.abs(angleDiff) < turnStep) this.angle = this.roamAngle;
        else this.angle += Math.sign(angleDiff) * turnStep;

        // Apply velocity for roaming (always move forward in the direction we're facing)
        this.vel.x = Math.cos(this.angle || 0) * this.roamSpeed;
        this.vel.y = Math.sin(this.angle || 0) * this.roamSpeed;
        super.update(deltaTime);

        // Keep within reasonable bounds (stay within 15000 of center)
        const distFromCenter = Math.hypot(this.pos.x, this.pos.y);
        if (distFromCenter > 15000) {
            this.roamAngle = Math.atan2(-this.pos.y, -this.pos.x);
        }

        // Outer/inner shield rotation (opposite directions)
        this.shieldRotation += 0.004 * dtFactor;
        this.innerShieldRotation -= 0.006 * dtFactor;

        // Shield regen: restore 1 segment every 5s (outer first, then inner)
        if (now - this.lastShieldRegenAt >= this.shieldRegenMs) {
            const outerIdx = this.shieldSegments.findIndex(s => s < 3);
            if (outerIdx !== -1) {
                this.shieldSegments[outerIdx] = 3;
                this.shieldsDirty = true;
            } else {
                const innerIdx = this.innerShieldSegments.findIndex(s => s < 3);
                if (innerIdx !== -1) {
                    this.innerShieldSegments[innerIdx] = 3;
                    this.shieldsDirty = true;
                }
            }
            this.lastShieldRegenAt = now;
        }

        // Auto-cycling invincibility phase shield
        if (this.invincibilityCycle && this.invincibilityCycle.unlocked) {
            this.invincibilityCycle.timer -= dtFactor;

            if (this.invincibilityCycle.state === 'ready') {
                this.invincibilityCycle.state = 'active';
                this.invincibilityCycle.timer = this.invincibilityCycle.stats.duration;
                playSound('powerup');
            } else if (this.invincibilityCycle.state === 'active') {
                this.invulnerable = 2;
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'cooldown';
                    this.invincibilityCycle.timer = this.invincibilityCycle.stats.cooldown;
                }
            } else if (this.invincibilityCycle.state === 'cooldown') {
                if (this.invincibilityCycle.timer <= 0) {
                    this.invincibilityCycle.state = 'ready';
                }
            }
        }

        // Check if player is within range to engage with turrets
        if (playerAlive) {
            const dist = distToPlayer;

            if (dist < 3200) { // Engagement range
                this.turretReload -= deltaTime;
                if (this.turretReload <= 0) {
                    this.fireTurrets();
                    this.turretReload = 100; // 0.1 seconds in ms
                }

                this.ringAttackTimer -= deltaTime;
                if (this.ringAttackTimer <= 0) {
                    this.fireRing(16, 8.0, 8, '#ff0');
                    // Fire more frequently (every 2s) when damaged below 50%
                    this.ringAttackTimer = (this.hp < this.maxHp * 0.5) ? 2000 : 5000;
                }
            }

            this.guidedMissileTimer -= deltaTime;
            if (this.guidedMissileTimer <= 0) {
                guidedMissiles.push(new Destroyer2GuidedMissile(this));
                this.guidedMissileTimer = 2000;
            }
        }

        if (this.invulnerable > 0) {
            this.invulnerable -= dtFactor;
        }
    }

    fireTurrets() {
        const tx = this.pos.x;
        const ty = this.pos.y;
        const bulletSpeed = 14.96;
        const dx = player.pos.x - tx;
        const dy = player.pos.y - ty;
        const dist = Math.hypot(dx, dy);
        const leadTime = Math.min(40, dist / bulletSpeed);
        const leadX = player.pos.x + player.vel.x * leadTime;
        const leadY = player.pos.y + player.vel.y * leadTime;
        const baseAngle = Math.atan2(leadY - ty, leadX - tx);
        const spread = 0.09;
        const angles = [baseAngle - spread, baseAngle, baseAngle + spread];
        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            const b = new Bullet(tx, ty, angle, true, 2, bulletSpeed, 6, '#f80');
            // Increase range by 25% (default life is ~60, so 1.25x range via life or direct property)
            // Assuming default Bullet life is roughly sufficient for screen range, we bump it up.
            b.life = Math.round(b.life * 1.25);
            bullets.push(b);
            spawnBarrelSmoke(tx, ty, angle);
        }
        playSound('rapid_shoot');
    }

    fireRing(n, speed, dmg, color) {
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const b = new Bullet(this.pos.x, this.pos.y, a, true, dmg, speed, 6, color);
            b.life = 140;
            bullets.push(b);
        }
        playSound('shotgun');
    }

    takeHit(dmg = 1) {
        if (this.dead || this.invulnerable > 0) return false;
        this.hp -= dmg;
        playSound('hit');
        if (this.hp <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);

        // Drop 20 nuggets
        for (let i = 0; i < 20; i++) {
            nuggets.push(new SpaceNugget(
                this.pos.x + (Math.random() - 0.5) * 200,
                this.pos.y + (Math.random() - 0.5) * 200,
                1
            ));
        }

        const boomScale = Math.max(2.8, Math.min(5, (this.visualRadius || this.radius || 400) / 250));
        spawnBossExplosion(this.pos.x, this.pos.y, boomScale, 22);
        spawnLargeExplosion(this.pos.x, this.pos.y, 3.5);
        spawnParticles(this.pos.x, this.pos.y, 80, '#0ff');
        playSound('base_explode');
        shakeMagnitude = Math.max(shakeMagnitude, 18);
        shakeTimer = Math.max(shakeTimer, 20);
        showOverlayMessage("DESTROYER II DESTROYED - 20 NUGGETS DROPPED", '#ff0', 2000, 2);

        // Set respawn timer - spawn the OTHER destroyer type
        currentDestroyerType = (currentDestroyerType === 1) ? 2 : 1;
        nextDestroyerSpawnTime = Date.now() + 60000; // 1 minute
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        // Pixi fast path (destroyer hull + turrets)
        if (pixiBossLayer && pixiTextures && pixiTextures.destroyer2_hull) {
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBossLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures.destroyer2_hull);
                const ha = pixiTextureAnchors.destroyer2_hull || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;

            } else if (!container.parent) {
                pixiBossLayer.addChild(container);
            }

            container.visible = true;
            container.position.set(this.pos.x, this.pos.y);
            container.rotation = this.angle || 0;

            const now = (typeof frameNow === 'number' && frameNow > 0) ? frameNow : Date.now();
            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 340) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            // Outer + inner shields (vector layer)
            if (pixiVectorLayer && this.shieldSegments && this.shieldSegments.length > 0) {
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.position.set(this.pos.x, this.pos.y);
                gfx.rotation = this.shieldRotation || 0;
                if (this.shieldsDirty) {
                    gfx.clear();
                    const count = this.shieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.1 * (36 / count);
                    const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
                    for (let i = 0; i < count; i++) {
                        const v = this.shieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            gfx.lineStyle(6, 0x00ffff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                            gfx.arc(0, 0, this.shieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiGfx) {
                try { this._pixiGfx.destroy(true); } catch (e) { }
                this._pixiGfx = null;
            }

            if (pixiVectorLayer && this.innerShieldSegments && this.innerShieldSegments.length > 0) {
                let innerGfx = this._pixiInnerGfx;
                if (!innerGfx) {
                    innerGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(innerGfx);
                    this._pixiInnerGfx = innerGfx;
                    this.shieldsDirty = true;
                } else if (!innerGfx.parent) {
                    pixiVectorLayer.addChild(innerGfx);
                }

                innerGfx.position.set(this.pos.x, this.pos.y);
                innerGfx.rotation = this.innerShieldRotation || 0;
                if (this.shieldsDirty) {
                    innerGfx.clear();
                    const count = this.innerShieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    const gapPct = 0.05 * (24 / count);
                    const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
                    for (let i = 0; i < count; i++) {
                        const v = this.innerShieldSegments[i];
                        if (v > 0) {
                            const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                            innerGfx.lineStyle(5, 0xff00ff, alpha);
                            const a0 = i * arcLen + gap;
                            const a1 = (i + 1) * arcLen - gap;
                            innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                            innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                        }
                    }
                }
            } else if (this._pixiInnerGfx) {
                try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                this._pixiInnerGfx = null;
            }

            if (this.shieldsDirty) this.shieldsDirty = false;

            if (pixiVectorLayer && this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
                let phaseGfx = this._pixiPhaseGfx;
                if (!phaseGfx) {
                    phaseGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(phaseGfx);
                    this._pixiPhaseGfx = phaseGfx;
                } else if (!phaseGfx.parent) {
                    pixiVectorLayer.addChild(phaseGfx);
                }
                phaseGfx.clear();
                phaseGfx.position.set(this.pos.x, this.pos.y);
                phaseGfx.lineStyle(3, 0xffdc00, 0.6);
                phaseGfx.drawCircle(0, 0, (this.shieldRadius || this.radius || 0) + 14);
            } else if (this._pixiPhaseGfx) {
                try { this._pixiPhaseGfx.destroy(true); } catch (e) { }
                this._pixiPhaseGfx = null;
            }

            // Nameplate
            if (this.displayName && pixiVectorLayer) {
                let txt = this._pixiNameText;
                if (!txt) {
                    txt = new PIXI.Text(this.displayName, {
                        fontFamily: 'Courier New',
                        fontSize: 18,
                        fontWeight: 'bold',
                        fill: 0xff8000
                    });
                    txt.anchor.set(0.5);
                    txt.resolution = 2;
                    pixiVectorLayer.addChild(txt);
                    this._pixiNameText = txt;
                } else if (txt.text !== this.displayName) {
                    txt.text = this.displayName;
                }
                if (!txt.parent) pixiVectorLayer.addChild(txt);
                txt.visible = true;
                txt.position.set(this.pos.x, this.pos.y - this.visualRadius - 20);
            }

            return;
        }

        // Fallback canvas rendering
        if (this.shieldSegments && this.shieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.shieldRotation || 0);
            ctx.lineWidth = 6;
            const count = this.shieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.1 * (36 / count);
            const gap = arcLen * Math.min(0.12, gapPct); // Scale gap for higher segment counts
            for (let i = 0; i < count; i++) {
                const v = this.shieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.shieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.rotate(this.innerShieldRotation || 0);
            ctx.lineWidth = 5;
            const count = this.innerShieldSegments.length;
            const arcLen = (Math.PI * 2) / count;
            const gapPct = 0.05 * (24 / count);
            const gap = arcLen * Math.min(0.08, gapPct); // Scale gap for higher segment counts
            for (let i = 0; i < count; i++) {
                const v = this.innerShieldSegments[i];
                if (v > 0) {
                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                    ctx.strokeStyle = `rgba(255, 0, 255, ${alpha})`;
                    const a0 = i * arcLen + gap;
                    const a1 = (i + 1) * arcLen - gap;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.innerShieldRadius, a0, a1);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        if (this.invincibilityCycle && this.invincibilityCycle.state === 'active') {
            ctx.save();
            ctx.translate(this.pos.x, this.pos.y);
            ctx.strokeStyle = 'rgba(255, 220, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (this.shieldRadius || this.radius || 0) + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle || 0);

        // Main hull
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#ff8000';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff8000';
        ctx.beginPath();
        ctx.arc(0, 0, this.visualRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Nameplate
        ctx.restore();
        if (this.displayName) {
            ctx.fillStyle = '#ff8000';
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000';
            ctx.fillText(this.displayName, this.pos.x, this.pos.y - this.visualRadius - 20);
            ctx.shadowBlur = 0;
        }
    }
}

// --- Game State ---
let player;
let bullets = [];
let bossBombs = [];
let staggeredBombExplosions = []; // Queue for staggered bomb explosions
let staggeredParticleBursts = []; // Queue for staggered particle bursts
let guidedMissiles = [];
let enemies = [];
let pinwheels = [];
let particles = [];
let explosions = [];
let floatingTexts = [];
let coins = []; // New currency entity
let nuggets = [];
let spaceNuggets = 0;
let powerups = [];
let shootingStars = [];
let drones = [];
let caches = [];
let radiationStorm = null;
let nextRadiationStormAt = 0;
let miniEvent = null;
let nextMiniEventAt = 0;
let pois = [];
let warpGate = null;
let warpZone = null;
let warpGateUnlocked = false;
// Per-sector limiter: only allow entering the warp maze once per sector.
let warpCompletedOnce = false;
let caveMode = false;
let caveLevel = null;
let nextShootingStarTime = 0;
let nextIntensityBreakAt = 0;
let intensityBreakActive = false;
const INTENSITY_BREAK_DURATION = 12000; // 12s
let score = 0;
let difficultyTier = 1;
let pinwheelsDestroyed = 0;
let pinwheelsDestroyedTotal = 0;
let roamerRespawnQueue = [];
let maxRoamers = 5;
let boss = null;
let bossActive = false;
let spaceStation = null;
let pendingStations = 0;
let nextSpaceStationTime = null;
let destroyer = null; // Current active destroyer (either Destroyer or Destroyer2)
let nextDestroyerSpawnTime = null; // Time for next destroyer to spawn
let currentDestroyerType = 1; // Track which type to spawn (1 or 2)
let stationArena = { x: 0, y: 0, radius: 2800, active: false };
let sectorTransitionActive = false;
let warpCountdownAt = null;
let gameEnded = false;
let bossArena = { x: 0, y: 0, radius: 2500, active: false, growing: false };
const GAME_DURATION_MS = 30 * 60 * 1000; // 30 minutes
let minimapFrame = 0;
let frameNow = 0;
let pendingTransitionClear = false;
let gunboatRespawnAt = null;
let gunboatLevel2Unlocked = false;
let cruiserEncounterCount = 0;
let initialSpawnDelayAt = null;
let initialSpawnDone = false;
let metaProfile = { bank: 0, purchases: { startDamage: false, passiveHp: false, rerollTokens: 0, hullPlating: false, shieldCore: false, staticBlueprint: false, missilePrimer: false, magnetBooster: false, nukeCapacitor: false, speedTuning: false, bankMultiplier: false, shopDiscount: false, extraLife: false, droneFabricator: false } };
let rerollTokens = 0;
let metaExtraLifeAvailable = false;

// --- Exploration Contracts ---
let activeContract = null;
let nextContractAt = 0;
let contractSequence = 0;
let contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };

// Cruiser spawn manager
let dreadManager = {
    upgradesChosen: 0,
    firstSpawnDone: false,
    timerActive: false,
    timerAt: null,
    minDelayMs: 120000, // 2 minutes
    maxDelayMs: 300000 // 5 minutes
};
let cruiserTimerPausedAt = null;
let cruiserTimerResumeAt = 0;

// Game timer
let gameStartTime = null;
let pauseStartTime = null;
let pausedAccumMs = 0; // total paused time to subtract

function compactArray(arr) {
    let alive = 0;
    for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        if (!obj) continue;
        if (!obj.dead) {
            arr[alive++] = obj;
            continue;
        }
        // Explosion-specific cleanup - release particle sprites
        if (obj instanceof Explosion && typeof obj.cleanup === 'function') {
            obj.cleanup(window.cachedParticleRes);
        }
        else if (obj._poolType === 'bullet' && obj.sprite && pixiBulletSpritePool) destroyBulletSprite(obj);
        else pixiCleanupObject(obj);
    }
    arr.length = alive;
}

// NOTE: snapshotWorldForWarp removed - we no longer save/restore level 1 state
// Level 1 is deleted when entering warp zone
// Level 1 is deleted when entering warp zone

function enterWarpMaze() {
    if (warpZone && warpZone.active) return;
    if (warpCompletedOnce) {
        showOverlayMessage("WARP ALREADY USED THIS SECTOR", '#f80', 1200, 2);
        return;
    }
    warpCompletedOnce = true;

    // Clear world to make a controlled encounter space - NO SNAPSHOT, level 1 is deleted
    resetPixiOverlaySprites();
    const detach = (arr) => {
        if (!arr || arr.length === 0) return;
        for (let i = 0; i < arr.length; i++) pixiCleanupObject(arr[i]);
    };
    detach(bullets);
    detach(bossBombs);
    detach(guidedMissiles);
    detach(enemies);
    detach(pinwheels);
    detach(particles);
    detach(explosions);
    detach(floatingTexts);
    detach(coins);
    detach(nuggets);
    detach(powerups);
    detach(shootingStars);
    detach(drones);
    detach(caches);
    detach(pois);
    detach(environmentAsteroids);

    bullets = [];
    bossBombs = [];
    staggeredBombExplosions = [];
    staggeredParticleBursts = [];
    guidedMissiles = [];
    enemies = [];
    pinwheels = [];
    particles = [];
    explosions = [];
    floatingTexts = [];
    coins = [];
    nuggets = [];
    powerups = [];
    shootingStars = [];
    drones = [];
    caches = [];
    pois = [];
    environmentAsteroids = [];
    asteroidRespawnTimers = [];
    baseRespawnTimers = [];

    radiationStorm = null;
    clearMiniEvent();

    activeContract = null;
    contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    nextContractAt = Date.now() + 999999999;

    if (boss) pixiCleanupObject(boss);
    boss = null;
    bossActive = false;
    bossArena.active = false;
    bossArena.growing = false;

    if (spaceStation) pixiCleanupObject(spaceStation);
    spaceStation = null;
    pendingStations = 0;
    nextSpaceStationTime = null;
    roamerRespawnQueue = [];
    maxRoamers = 0;
    gunboatRespawnAt = null;

    // Spawn warp zone at origin since we're deleting level 1 anyway
    const originX = 0;
    const originY = 0;
    warpZone = new WarpMazeZone(originX, originY);
    warpZone.generate();

    // Place the player at the entrance.
    player.pos.x = warpZone.entrancePos.x;
    player.pos.y = warpZone.entrancePos.y;
    player.vel.x = 0;
    player.vel.y = 0;

    // Seed warp asteroids to reduced density (and let runtime spawning maintain it). 
    let seedTries = 0;
    while (environmentAsteroids.length < 50 && seedTries < 800) {
        spawnOneWarpAsteroidRelative(true);
        seedTries++;
    }

}

function resetWarpState() {
    // Hard-reset all warp state so a fresh run can't inherit "in-warp" flags. 
    try { if (warpZone) warpZone.active = false; } catch (e) { }
    warpZone = null;
    if (warpGate) pixiCleanupObject(warpGate);
    warpGate = null;
}

function resetCaveState() {
    // Hard-reset all cave state so a fresh run can't inherit cave flags/walls/clipping. 
    try { if (caveLevel) caveLevel.active = false; } catch (e) { }
    caveMode = false;
    caveLevel = null;
}

function exitWarpMaze() {
    if (!warpZone || !warpZone.active) return;
    const completedRun = !!(warpZone && warpZone.exitUnlocked);
    if (warpZone && warpZone.active) warpZone.active = false;

    // CLEANUP FIX: Properly clean up all warp entities before restoring snapshot
    // This prevents frozen sprites appearing on screen after warp exit
    console.log('[WARP EXIT] Cleaning up warp entities before restoring snapshot...');

    // Clean up warp gate if it exists
    if (warpGate) {
        pixiCleanupObject(warpGate);
        warpGate = null;
        console.log('[WARP EXIT] Cleaned warp gate');
    }

    // Clean up warp zone and its entities
    if (warpZone) {
        // Clean up warp turrets
        if (warpZone.turrets && warpZone.turrets.length > 0) {
            for (let i = 0; i < warpZone.turrets.length; i++) {
                const turret = warpZone.turrets[i];
                if (turret) {
                    try {
                        pixiCleanupObject(turret);
                    } catch (e) {
                        console.warn('[WARP EXIT] Failed to clean turret:', e);
                    }
                }
            }
            warpZone.turrets = [];
            console.log('[WARP EXIT] Cleaned warp turrets');
        }

        // Clean up warp zone graphics
        if (warpZone._pixiGfx) {
            try { warpZone._pixiGfx.destroy(true); } catch (e) { }
            warpZone._pixiGfx = null;
        }
    }

    // Clean up warp particles (separate array from regular particles)
    if (warpParticles && warpParticles.length > 0) {
        for (let i = 0; i < warpParticles.length; i++) {
            const p = warpParticles[i];
            if (p && p.sprite) {
                try {
                    releasePixiSprite(pixiParticleSpritePool, p.sprite);
                    p.sprite = null;
                } catch (e) {
                    console.warn('[WARP EXIT] Failed to clean warp particle sprite:', e);
                }
            }
        }
        warpParticles.length = 0;
        console.log('[WARP EXIT] Cleaned warp particles');
    }

    // Clean up all current warp entities (these will be replaced by snapshot)
    const cleanupWarpArray = (arr, name) => {
        if (!arr || arr.length === 0) return;
        let cleaned = 0;
        for (let i = 0; i < arr.length; i++) {
            const entity = arr[i];
            if (entity) {
                try {
                    entity.dead = true;
                    pixiCleanupObject(entity);
                    cleaned++;
                } catch (e) {
                    console.warn(`[WARP EXIT] Failed to clean ${name}[${i}]:`, e);
                }
            }
        }
        console.log(`[WARP EXIT] Cleaned ${cleaned} ${name}`);
    };

    // Clean up all warp-specific entities
    cleanupWarpArray(bullets, 'warp bullets');
    cleanupWarpArray(bossBombs, 'warp boss bombs');
    cleanupWarpArray(staggeredBombExplosions, 'staggered bomb explosions');
    cleanupWarpArray(staggeredParticleBursts, 'staggered particle bursts');
    cleanupWarpArray(guidedMissiles, 'warp guided missiles');
    cleanupWarpArray(enemies, 'warp enemies');
    cleanupWarpArray(pinwheels, 'warp pinwheels');
    cleanupWarpArray(particles, 'warp particles');
    cleanupWarpArray(explosions, 'warp explosions');
    cleanupWarpArray(floatingTexts, 'warp floating texts');
    cleanupWarpArray(coins, 'warp coins');
    cleanupWarpArray(nuggets, 'warp nuggets');
    cleanupWarpArray(powerups, 'warp powerups');
    cleanupWarpArray(shootingStars, 'warp shooting stars');
    cleanupWarpArray(drones, 'warp drones');
    cleanupWarpArray(caches, 'warp caches');
    cleanupWarpArray(pois, 'warp POIs');
    cleanupWarpArray(environmentAsteroids, 'warp asteroids');
    if (boss && boss.isWarpBoss) {
        try {
            boss.dead = true;
            pixiCleanupObject(boss);
        } catch (e) {
            console.warn('[WARP EXIT] Failed to clean warp boss:', e);
        }
        boss = null;
        bossActive = false;
    }

    // Clear the arrays
    bullets.length = 0;
    bossBombs.length = 0;
    staggeredBombExplosions.length = 0;
    staggeredParticleBursts.length = 0;
    guidedMissiles.length = 0;
    enemies.length = 0;
    pinwheels.length = 0;
    particles.length = 0;
    explosions.length = 0;
    floatingTexts.length = 0;
    coins.length = 0;
    nuggets.length = 0;
    powerups.length = 0;
    shootingStars.length = 0;
    drones.length = 0;
    caches.length = 0;
    pois.length = 0;
    environmentAsteroids.length = 0;

    // Clear Pixi overlay sprites (includes warp zone walls/gates)
    resetPixiOverlaySprites();
    cleanupPixiWorldRootExtras();

    // NOTE: No longer restoring snapshots - we transition directly to level 2 after boss defeat
    // This entire function now just cleans up warp entities
    // The actual transition to level 2 is handled by sectorTransitionActive countdown in gameLoopLogic

    warpZone = null;
    warpGate = null;
}
// Instead, we transition directly to level 2 via sectorTransitionActive

// --- Performance: particle pooling (render-only, no gameplay impact) ---
const PARTICLE_POOL_MAX = 12000;
const SMOKE_POOL_MAX = 6000;
const particlePool = [];
const smokeParticlePool = [];

function emitParticle(x, y, vx, vy, color = '#fff', life = 30) {
    let p = particlePool.length > 0 ? particlePool.pop() : null;
    if (!p) p = new Particle(x, y, vx, vy, color, life);
    else p.reset(x, y, vx, vy, color, life);
    particles.push(p);
    return p;
}

function emitSmokeParticle(x, y, vx, vy, color = '#aaa') {
    let p = smokeParticlePool.length > 0 ? smokeParticlePool.pop() : null;
    if (!p) p = new SmokeParticle(x, y, vx, vy, color);
    else p.reset(x, y, vx, vy, color);
    particles.push(p);
    return p;
}

function compactParticles(arr) {
    immediateCompactArray(arr, (p) => {
        // Release particle sprite back to pool when particle dies
        if (p.sprite && pixiParticleSpritePool) {
            releasePixiSprite(pixiParticleSpritePool, p.sprite);
            p.sprite = null;
        }
    });
}

// Safety cleanup function to force explosions to clean themselves
function forceExplosionCleanup() {
    if (!particleRes || !particleRes.pool) return;

    let forcedCount = 0;
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        if (ex && ex.dead && !ex.cleaned) {
            try {
                ex.cleanup(particleRes);
                forcedCount++;
                console.warn(`[FORCED CLEANUP] Cleaning explosion #${i} at (${Math.round(ex.pos.x)}, ${Math.round(ex.pos.y)})`);
            } catch (e) {
                console.error(`[FORCED CLEANUP ERROR] Failed to clean explosion #${i}:`, e);
            }
        }
    }

    if (forcedCount > 0) {
        console.log(`[FORCED CLEANUP] Cleaned ${forcedCount} explosions`);
    }
}

function spawnParticles(x, y, count = 10, color = '#fff') {
    for (let i = 0; i < count; i++) emitParticle(x, y, null, null, color, 30);
}

/**
 * Schedule particle bursts to be spread across multiple frames
 * This prevents sprite pool exhaustion when many particles need to spawn at once
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} totalCount - Total particles to spawn
 * @param {string} color - Particle color
 * @param {number} spreadFrames - Number of frames to spread the spawn over
 */
function scheduleParticleBursts(x, y, totalCount, color, spreadFrames = 10) {
    const particlesPerFrame = Math.max(1, Math.floor(totalCount / spreadFrames));

    for (let frame = 0; frame < spreadFrames; frame++) {
        staggeredParticleBursts.push({
            x: x + (Math.random() - 0.5) * 100, // Add some position variation
            y: y + (Math.random() - 0.5) * 100,
            count: particlesPerFrame + (frame === spreadFrames - 1 ? totalCount % spreadFrames : 0),
            color: color,
            delayFrames: frame * 2, // Spawn every 2 frames
            processed: false
        });
    }
}

/**
 * Process staggered particle bursts
 * Call this every frame to handle queued particle spawning
 */
function processStaggeredParticleBursts() {
    if (staggeredParticleBursts.length === 0) return;

    for (let i = staggeredParticleBursts.length - 1; i >= 0; i--) {
        const burst = staggeredParticleBursts[i];

        if (burst.processed) {
            staggeredParticleBursts.splice(i, 1);
            continue;
        }

        if (burst.delayFrames <= 0) {
            burst.processed = true;
            spawnParticles(burst.x, burst.y, burst.count, burst.color);
        } else {
            burst.delayFrames--;
        }
    }
}

/**
 * Schedule bomb explosions to be spread across multiple frames
 * This prevents sprite pool exhaustion and frame spikes when many bombs explode at once
 * @param {number} sourceX - X position to spawn effects at
 * @param {number} sourceY - Y position to spawn effects at
 */
function scheduleStaggeredBombExplosions(sourceX, sourceY) {
    const bombCount = bossBombs.length;
    if (bombCount === 0) {
        clearArrayWithPixiCleanup(bossBombs);
        return;
    }

    console.log(`[BOSS KILL] Scheduling ${bombCount} bomb explosions over multiple frames`);

    // Clear the bombs array but keep the explosion queue
    const bombsToExplode = [...bossBombs];
    bossBombs.length = 0;

    // Schedule explosions spread across frames
    // Explode up to 3 bombs per frame to prevent sprite pool exhaustion
    const bombsPerFrame = Math.min(3, Math.ceil(bombCount / 10)); // Spread over at least 10 frames

    for (let i = 0; i < bombCount; i++) {
        const bomb = bombsToExplode[i];
        // Calculate delay in frames
        const delayFrames = Math.floor(i / bombsPerFrame);

        staggeredBombExplosions.push({
            bomb: bomb,
            pos: { x: bomb.pos.x, y: bomb.pos.y },
            delayFrames: delayFrames,
            processed: false
        });
    }
}

/**
 * Process staggered bomb explosions
 * Call this every frame to handle queued bomb explosions
 */
function processStaggeredBombExplosions() {
    if (staggeredBombExplosions.length === 0) return;

    const frameTime = performance.now();
    const explosionsThisFrame = [];

    for (let i = staggeredBombExplosions.length - 1; i >= 0; i--) {
        const queued = staggeredBombExplosions[i];

        if (queued.processed) {
            staggeredBombExplosions.splice(i, 1);
            continue;
        }

        if (queued.delayFrames <= 0) {
            // Explode this bomb now
            queued.processed = true;
            explosionsThisFrame.push(queued);
        } else {
            queued.delayFrames--;
        }
    }

    // Execute explosions for this frame
    // Limit to prevent overwhelming the system
    const maxPerFrame = 4;
    const actualExplosions = explosionsThisFrame.slice(0, maxPerFrame);

    for (const queued of actualExplosions) {
        const bomb = queued.bomb;
        if (bomb && !bomb.dead) {
            bomb.dead = true;
            pixiCleanupObject(bomb);
            playSound('explode');
            spawnParticles(bomb.pos.x, bomb.pos.y, 40, '#fa0');
            shockwaves.push(new Shockwave(bomb.pos.x, bomb.pos.y, bomb.damage, bomb.blastRadius, {
                damagePlayer: true,
                damageBases: true,
                ignoreEntity: bomb.owner,
                color: '#fa0'
            }));
        }
    }

    // If we couldn't process all explosions this frame, keep them for next frame
    // (they're already marked as processed, so they won't be re-exploded)
}

// Replaces spawnGunboatExplosion with a more generic large explosion
function spawnLargeExplosion(x, y, scale = 2.0) {
    const s = scale;
    const spriteSize = 250 * (s / 2.0); // Base size 250 at scale 2.0
    explosions.push(new Explosion(x, y, spriteSize));

    // Standard fiery particles (glowy)
    const count = Math.floor(25 * (s / 1.5));
    const colors = ['#ff8', '#fa0', '#f40', '#f00'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (2.0 + Math.random() * 3.0) * (s / 2.0);
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 30 + Math.floor(Math.random() * 20);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.glow = true;
        p.size = (6 + Math.random() * 8) * (s / 2.0); // Scale size
    }

    // EXTRA LARGE debris particles (explode in all directions)
    const bigCount = Math.floor(12 * (s / 2.0));
    for (let i = 0; i < bigCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 3.5) * (s / 2.0);
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const life = 40 + Math.floor(Math.random() * 25);
        // Use enemy bullet colors (Red/Orange) to match request
        const color = (Math.random() < 0.5) ? '#f00' : '#f80';

        const p = emitParticle(x, y, vx, vy, color, life);
        p.size = (20 + Math.random() * 12) * (s / 2.0); // Large particles scaled
        p.glow = true;
    }

    spawnSmoke(x, y, Math.ceil(6 * (s / 2.0)));
    playSound('base_explode');
}

function spawnFieryExplosion(x, y, scale = 1) {
    const s = Math.max(0.6, Math.min(3, scale || 1));
    const spriteSize = Math.max(90, Math.round(140 * s));
    explosions.push(new Explosion(x, y, spriteSize));

    const count = Math.max(10, Math.round(12 * s));
    const colors = ['#ff6', '#fa0', '#f80', '#f00'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (0.8 + Math.random() * 1.8) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 20 + Math.floor(Math.random() * 16);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.glow = true;
    }
    spawnSmoke(x, y, Math.max(1, Math.round(2 * s)));
}

function spawnBossExplosion(x, y, scale = 2.5, chunkCount = 18) {
    const s = Math.max(1.2, Math.min(5, scale || 1));
    spawnFieryExplosion(x, y, s);

    const colors = ['#888', '#777', '#666'];
    const count = Math.max(8, Math.round(chunkCount * (0.6 + s * 0.15)));
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (2.5 + Math.random() * 4.5) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const life = 40 + Math.floor(Math.random() * 35);
        const p = emitParticle(x, y, vx, vy, colors[(Math.random() * colors.length) | 0], life);
        p.size = 4 + Math.random() * 6;
        p.glow = false;
    }

    const smokeCount = Math.max(2, Math.round(2 * s));
    for (let i = 0; i < smokeCount; i++) {
        const sp = emitSmokeParticle(x, y, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s, '#777');
        if (sp) {
            sp.size *= 1.8;
            sp.life = Math.round(sp.life * 1.3);
            sp.maxLife = sp.life;
        }
    }
}

function spawnAsteroidExplosion(x, y, scale = 1) {
    const s = Math.max(0.5, Math.min(2.6, scale || 1)) * 2;
    const count = Math.max(8, Math.round(10 * s));
    const colors = ['#fff'];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (0.6 + Math.random() * 1.6) * s;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const color = colors[(Math.random() * colors.length) | 0];
        const life = 18 + Math.floor(Math.random() * 16);
        const p = emitParticle(x, y, vx, vy, color, life);
        p.size = (p.size || 2) * 3;
        p.glow = true;
    }
    const smokeCount = Math.max(2, Math.round(4 * s));
    for (let i = 0; i < smokeCount; i++) {
        const sp = emitSmokeParticle(x, y, null, null, '#fff');
        if (sp) {
            sp.size *= 3;
            sp.life = Math.round(sp.life * 1.4);
            sp.maxLife = sp.life;
        }
    }
}

function spawnSmoke(x, y, count = 1, color = '#aaa') {
    for (let i = 0; i < count; i++) emitSmokeParticle(x, y, null, null, color);
}

function spawnBarrelSmoke(x, y, angle) {
    for (let i = 0; i < 3; i++) {
        const speed = 2 + Math.random() * 2;
        const spread = (Math.random() - 0.5) * 0.5;
        const vx = Math.cos(angle + spread) * speed;
        const vy = Math.sin(angle + spread) * speed;
        emitSmokeParticle(x, y, vx, vy);
    }
}

// --- Meta Progression ---
function loadMetaProfile() {
    try {
        const raw = localStorage.getItem('meta_profile_v1');
        if (raw) metaProfile = JSON.parse(raw);
        if (!metaProfile.purchases) metaProfile.purchases = {};
        metaProfile.purchases = Object.assign({
            startDamage: false,
            passiveHp: false,
            rerollTokens: 0,
            hullPlating: false,
            shieldCore: false,
            staticBlueprint: false,
            missilePrimer: false,
            magnetBooster: false,
            nukeCapacitor: false,
            speedTuning: false,
            bankMultiplier: false,
            shopDiscount: false,
            extraLife: false,
            droneFabricator: false
        }, metaProfile.purchases);
        if (metaProfile.purchases.warpPrecharge) delete metaProfile.purchases.warpPrecharge;
        if (typeof metaProfile.bank !== 'number') metaProfile.bank = 0;
    } catch (e) {
        console.warn('failed to load meta profile', e);
    }
}
function resetMetaProfile() {
    metaProfile = {
        bank: 0, purchases: {
            startDamage: false,
            passiveHp: false,
            rerollTokens: 0,
            hullPlating: false,
            shieldCore: false,
            staticBlueprint: false,
            missilePrimer: false,
            magnetBooster: false,
            nukeCapacitor: false,
            speedTuning: false,
            bankMultiplier: false,
            shopDiscount: false,
            extraLife: false,
            droneFabricator: false
        }
    };
}
function saveMetaProfile() {
    try {
        localStorage.setItem('meta_profile_v1', JSON.stringify(metaProfile));
        updateMetaUI();
    } catch (e) { console.warn('failed to save meta profile', e); }
}
function depositMetaNuggets() {
    const bonus = metaProfile.purchases.bankMultiplier ? 1.1 : 1.0;
    metaProfile.bank += Math.round(spaceNuggets * bonus);
    saveMetaProfile();
}
function updateMetaUI() {
    const bankEl = document.getElementById('meta-bank');
    if (bankEl) bankEl.innerText = metaProfile.bank;
    const startEl = document.getElementById('meta-start-dmg');
    if (startEl) startEl.innerText = metaProfile.purchases.startDamage ? 'OWNED' : 'BUY (10 NUGS)';
    const passiveEl = document.getElementById('meta-passive-hp');
    if (passiveEl) passiveEl.innerText = metaProfile.purchases.passiveHp ? 'OWNED' : 'BUY (15 NUGS)';
    const rerollEl = document.getElementById('meta-reroll-count');
    if (rerollEl) rerollEl.innerText = metaProfile.purchases.rerollTokens || 0;
    const hullEl = document.getElementById('meta-hull');
    if (hullEl) hullEl.innerText = metaProfile.purchases.hullPlating ? 'OWNED' : 'BUY (30 NUGS)';
    const shieldEl = document.getElementById('meta-shield-core');
    if (shieldEl) shieldEl.innerText = metaProfile.purchases.shieldCore ? 'OWNED' : 'BUY (30 NUGS)';
    const staticEl = document.getElementById('meta-static');
    if (staticEl) staticEl.innerText = metaProfile.purchases.staticBlueprint ? 'OWNED' : 'BUY (40 NUGS)';
    const missileEl = document.getElementById('meta-missile');
    if (missileEl) missileEl.innerText = metaProfile.purchases.missilePrimer ? 'OWNED' : 'BUY (40 NUGS)';
    const magnetEl = document.getElementById('meta-magnet');
    if (magnetEl) magnetEl.innerText = metaProfile.purchases.magnetBooster ? 'OWNED' : 'BUY (25 NUGS)';
    const nukeEl = document.getElementById('meta-nuke');
    if (nukeEl) nukeEl.innerText = metaProfile.purchases.nukeCapacitor ? 'OWNED' : 'BUY (35 NUGS)';
    const speedEl = document.getElementById('meta-speed');
    if (speedEl) speedEl.innerText = metaProfile.purchases.speedTuning ? 'OWNED' : 'BUY (25 NUGS)';
    const bankMultEl = document.getElementById('meta-bank-mult');
    if (bankMultEl) bankMultEl.innerText = metaProfile.purchases.bankMultiplier ? 'OWNED' : 'BUY (50 NUGS)';
    const discountEl = document.getElementById('meta-discount');
    if (discountEl) discountEl.innerText = metaProfile.purchases.shopDiscount ? 'OWNED' : 'BUY (50 NUGS)';
    const extraLifeEl = document.getElementById('meta-extra-life');
    if (extraLifeEl) extraLifeEl.innerText = metaProfile.purchases.extraLife ? 'OWNED' : 'BUY (60 NUGS)';
    const droneEl = document.getElementById('meta-drone');
    if (droneEl) droneEl.innerText = metaProfile.purchases.droneFabricator ? 'OWNED' : 'BUY (40 NUGS)';
}

// Companion Drones
class Drone extends Entity {
    constructor(type) {
        super(0, 0);
        this.type = type; // 'heal' | 'shield' | 'shooter'
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitRadius = 80 + Math.random() * 20;
        this.dead = false;
        this.timer = 0;
        this.lastShieldTick = Date.now();
        this.lastHealTick = Date.now();
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;

        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        const now = Date.now();
        this.orbitAngle += 0.04; // doubled for 60Hz
        const baseX = player.pos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        const baseY = player.pos.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.pos.x = baseX;
        this.pos.y = baseY;
        this.timer++;

        if (this.type === 'heal') {
            // 1 HP per 5 seconds
            if (now - this.lastHealTick >= 5000) {
                if (player.hp < player.maxHp) {
                    player.hp = Math.min(player.maxHp, player.hp + 1);
                    updateHealthUI();
                    spawnParticles(this.pos.x, this.pos.y, 6, '#0f0');
                }
                this.lastHealTick = now;
            }
        } else if (this.type === 'shield') {
            // Time-gated to 1 segment per ~3 seconds
            if (now - this.lastShieldTick >= 3000) {
                const idx = player.shieldSegments.findIndex(s => s < 2);
                if (idx !== -1) {
                    player.shieldSegments[idx] = 2;
                    spawnParticles(this.pos.x, this.pos.y, 6, '#0ff');
                }
                this.lastShieldTick = now;
            }
        } else if (this.type === 'shooter' && this.timer % 25 === 0) { // halved interval for 60Hz
            // Shooter drone now fires where the player's turret aims
            const aimAngle = player ? player.turretAngle : 0;
            bullets.push(new Bullet(this.pos.x, this.pos.y, aimAngle, false, 1.5, 14, 4, '#ff0'));
            spawnBarrelSmoke(this.pos.x, this.pos.y, aimAngle);
        }
    }
    draw(ctx) {
        if (!player || player.dead) return;
        const rPos = this.getRenderPos(renderAlpha);
        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.rotate(this.orbitAngle);
        ctx.lineWidth = 2;
        if (this.type === 'heal') {
            ctx.fillStyle = '#0f0'; ctx.strokeStyle = '#0b0';
        } else if (this.type === 'shield') {
            ctx.fillStyle = '#0ff'; ctx.strokeStyle = '#08f';
        } else {
            ctx.fillStyle = '#ff0'; ctx.strokeStyle = '#aa0';
        }
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function spawnDrone(type) {
    drones.push(new Drone(type));
}

function updateContractUI() {
    const el = document.getElementById('contract-display');
    if (!el) return;
    if (!activeContract) {
        el.innerText = 'CONTRACT: NONE';
        return;
    }
    let extra = '';
    if (activeContract.type === 'scan_beacon') {
        if (activeContract.state === 'active') extra = ` (SCANNING ${Math.floor((activeContract.progress || 0) * 100)}%)`;
        else extra = ' (GO TO BEACON)';
    } else if (activeContract.type === 'gate_run') {
        const remain = Math.max(0, (activeContract.endsAt || 0) - Date.now());
        extra = ` (GATE ${activeContract.gateIndex + 1}/${activeContract.gateCount} ${formatTime(remain)})`;
    } else if (activeContract.type === 'anomaly') {
        if (activeContract.coreCollected) extra = ' (ESCAPE ZONE)';
        else extra = activeContract.state === 'inside' ? ' (FIND CORE)' : ' (ENTER ZONE)';
    }
    el.innerText = `CONTRACT: ${activeContract.title}${extra}`;
}

function updateMiniEventUI() {
    const el = document.getElementById('event-display');
    if (!el) return;
    if (!miniEvent || miniEvent.dead) {
        el.style.display = 'none';
        el.innerText = 'EVENT: NONE';
        return;
    }
    el.style.display = 'block';
    if (typeof miniEvent.getUiText === 'function') el.innerText = miniEvent.getUiText();
    else el.innerText = 'EVENT: ACTIVE';
}

function clearMiniEvent() {
    if (!miniEvent) return;
    if (typeof miniEvent.kill === 'function') {
        miniEvent.kill();
    } else {
        miniEvent.dead = true;
    }
    pixiCleanupObject(miniEvent);
    miniEvent = null;
}

function completeContract(success = true) {
    if (!activeContract) return;
    const contractId = activeContract.id;
    if (success) {
        const rewardNugs = (activeContract.rewardNugs !== undefined) ? activeContract.rewardNugs : 4;
        for (let i = 0; i < rewardNugs; i++) nuggets.push(new SpaceNugget(player.pos.x + (Math.random() - 0.5) * 120, player.pos.y + (Math.random() - 0.5) * 120, 1));
        // Bonus gold (coins) for all contracts
        coins.push(new Coin(player.pos.x + (Math.random() - 0.5) * 80, player.pos.y + (Math.random() - 0.5) * 80, 10));
        const rewardScore = (activeContract.rewardScore !== undefined) ? activeContract.rewardScore : 5000;
        score += rewardScore;
        showOverlayMessage("CONTRACT COMPLETE", '#0f0', 1500);
    } else {
        showOverlayMessage("CONTRACT FAILED", '#f00', 1500);
    }
    // Cleanup entities
    clearArrayWithPixiCleanup(contractEntities.beacons);
    clearArrayWithPixiCleanup(contractEntities.gates);
    clearArrayWithPixiCleanup(contractEntities.anomalies);
    clearArrayWithPixiCleanup(contractEntities.fortresses);
    clearArrayWithPixiCleanup(contractEntities.wallTurrets);
    // Cleanup anomaly contract debris
    if (contractId) {
        filterArrayWithPixiCleanup(environmentAsteroids, a => !a.contractId || a.contractId !== contractId);
        filterArrayWithPixiCleanup(enemies, e => !e.contractId || e.contractId !== contractId);
    }
    activeContract = null;
    nextContractAt = Date.now() + 45000 + Math.random() * 30000;
    updateContractUI();
}

class ContractBeacon extends Entity {
    constructor(x, y, label = "SCAN") {
        super(x, y);
        this.radius = 135;
        this.label = label;
        this.t = 0;
        this.scanStartAt = null;
        this.scanMsRequired = 2000;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiLabelText = null;
        this._pixiProgressText = null;
        this._pixiProgressGfx = null;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        this.t++;
        if (!activeContract || activeContract.type !== 'scan_beacon') return;
        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (d < this.radius) {
            activeContract.state = 'active';
            if (!this.scanStartAt) this.scanStartAt = Date.now();
            activeContract.progress = Math.min(1, (Date.now() - this.scanStartAt) / this.scanMsRequired);
            if (activeContract.progress >= 1) completeContract(true);
        } else {
            if (activeContract.state === 'active') activeContract.state = 'travel';
            this.scanStartAt = null;
            activeContract.progress = 0;
        }
    }
    draw(ctx) {
        if (this.dead) return;

        const pulse = 0.6 + Math.sin(this.t * 0.1) * 0.2;

        if (pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
                this.shieldsDirty = true;
            }
            if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);

            if (this.shieldsDirty) {
                this._pixiGfx.clear();
                // Outer ring
                this._pixiGfx.lineStyle(3, 0x00ff00, 1.0);
                this._pixiGfx.drawCircle(0, 0, this.radius);
                // Crosshair
                this._pixiGfx.lineStyle(2, 0x00ff00, 1.0);
                this._pixiGfx.moveTo(-18, 0); this._pixiGfx.lineTo(18, 0);
                this._pixiGfx.moveTo(0, -18); this._pixiGfx.lineTo(0, 18);
                this.shieldsDirty = false;
            }
            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiGfx.alpha = pulse;

            // Label
            if (!this._pixiLabelText) {
                this._pixiLabelText = new PIXI.Text(this.label, {
                    fontFamily: 'Courier New',
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill: 0x00ff00,
                    align: 'center'
                });
                this._pixiLabelText.anchor.set(0.5, 1);
                pixiVectorLayer.addChild(this._pixiLabelText);
            }
            if (!this._pixiLabelText.parent) pixiVectorLayer.addChild(this._pixiLabelText);
            this._pixiLabelText.position.set(this.pos.x, this.pos.y - this.radius - 10);
            this._pixiLabelText.visible = true;

            // Progress
            if (player && !player.dead && activeContract && activeContract.type === 'scan_beacon') {
                const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
                if (d < this.radius) {
                    const progress = Math.max(0, Math.min(1, activeContract.progress || 0));

                    if (!this._pixiProgressGfx) {
                        this._pixiProgressGfx = new PIXI.Graphics();
                        pixiVectorLayer.addChild(this._pixiProgressGfx);
                    }
                    if (!this._pixiProgressGfx.parent) pixiVectorLayer.addChild(this._pixiProgressGfx);

                    this._pixiProgressGfx.clear();
                    const w = 140, h = 10;
                    const x = this.pos.x - w / 2, y = this.pos.y + this.radius + 18;
                    this._pixiProgressGfx.beginFill(0x000000, 0.65);
                    this._pixiProgressGfx.lineStyle(2, 0x00ff00, 1.0);
                    this._pixiProgressGfx.drawRect(x, y, w, h);
                    this._pixiProgressGfx.endFill();
                    this._pixiProgressGfx.beginFill(0x00ff00, 1.0);
                    this._pixiProgressGfx.drawRect(x, y, w * progress, h);
                    this._pixiProgressGfx.endFill();
                    this._pixiProgressGfx.visible = true;

                    if (!this._pixiProgressText) {
                        this._pixiProgressText = new PIXI.Text('STAY IN ZONE 2s', {
                            fontFamily: 'Courier New',
                            fontSize: 13,
                            fontWeight: 'bold',
                            fill: 0xffffff,
                            align: 'center'
                        });
                        this._pixiProgressText.anchor.set(0.5, 0);
                        pixiVectorLayer.addChild(this._pixiProgressText);
                    }
                    if (!this._pixiProgressText.parent) pixiVectorLayer.addChild(this._pixiProgressText);
                    this._pixiProgressText.position.set(this.pos.x, y + h + 6);
                    this._pixiProgressText.visible = true;
                } else {
                    if (this._pixiProgressGfx) this._pixiProgressGfx.visible = false;
                    if (this._pixiProgressText) this._pixiProgressText.visible = false;
                }
            } else {
                if (this._pixiProgressGfx) this._pixiProgressGfx.visible = false;
                if (this._pixiProgressText) this._pixiProgressText.visible = false;
            }

            return;
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.strokeStyle = `rgba(0,255,0,${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // small crosshair
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-18, 0); ctx.lineTo(18, 0);
        ctx.moveTo(0, -18); ctx.lineTo(0, 18);
        ctx.stroke();

        // label
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.label, 0, -this.radius - 10);

        // contextual prompt + progress bar (works with keyboard + gamepad)
        if (player && !player.dead && activeContract && activeContract.type === 'scan_beacon') {
            const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
            if (d < this.radius) {
                const progress = Math.max(0, Math.min(1, activeContract.progress || 0));
                const w = 140;
                const h = 10;
                const x = -w / 2;
                const y = this.radius + 18;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.strokeStyle = '#0f0';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#0f0';
                ctx.fillRect(x, y, w * progress, h);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 13px Courier New';
                ctx.textBaseline = 'top';
                ctx.fillText('STAY IN ZONE 2s', 0, y + h + 6);
            }
        }
        ctx.restore();
    }
}

class GateRing extends Entity {
    constructor(x, y, index, total) {
        super(x, y);
        this.radius = 140;
        this.index = index;
        this.total = total;
        this.t = 0;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiText = null;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
    }
    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        this.t++;
        if (!activeContract || activeContract.type !== 'gate_run') return;
        if (activeContract.gateIndex !== this.index) return;
        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (d < this.radius) {
            // advance
            activeContract.gateIndex++;
            playSound('powerup');
            showOverlayMessage(`GATE ${this.index + 1} CLEARED`, '#0f0', 700);
            if (activeContract.gateIndex >= activeContract.gateCount) {
                completeContract(true);
            }
        }
    }
    draw(ctx) {
        if (this.dead) return;

        const active = activeContract && activeContract.type === 'gate_run' && activeContract.gateIndex === this.index;
        const pulse = 0.45 + Math.abs(Math.sin(this.t * 0.08)) * 0.35;

        if (pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);
                this.shieldsDirty = true;
            }
            if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);

            // Track active state changes to trigger visual update
            if (this._wasActive !== active) {
                this._wasActive = active;
                this.shieldsDirty = true;
            }

            if (this.shieldsDirty) {
                this._pixiGfx.clear();
                const col = active ? 0x00ff00 : 0x005000;
                const lw = active ? 6 : 3;
                this._pixiGfx.lineStyle(lw, col, 1.0);
                this._pixiGfx.drawCircle(0, 0, this.radius);
                this.shieldsDirty = false;
            }
            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiGfx.alpha = active ? pulse : 0.6;

            if (!this._pixiText) {
                this._pixiText = new PIXI.Text(`${this.index + 1}/${this.total}`, {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: 0xffffff,
                    align: 'center'
                });
                this._pixiText.anchor.set(0.5);
                pixiVectorLayer.addChild(this._pixiText);
            }
            if (!this._pixiText.parent) pixiVectorLayer.addChild(this._pixiText);
            this._pixiText.position.set(this.pos.x, this.pos.y);
            this._pixiText.tint = active ? 0x00ff00 : 0x005500;
            this._pixiText.visible = true;

            return;
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.strokeStyle = active ? `rgba(0,255,0,${pulse})` : 'rgba(0,80,0,0.6)';
        ctx.lineWidth = active ? 6 : 3;
        ctx.shadowBlur = active ? 18 : 0;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = active ? '#0f0' : '#050';
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.index + 1}/${this.total}`, 0, 0);
        ctx.restore();
    }
}

class AnomalyZone extends Entity {
    constructor(x, y, contractId = null) {
        super(x, y);
        this.contractId = contractId;
        this.radius = 2400; // 25% smaller
        this.t = 0;
        this.generated = false;
        this.defendersSpawned = false;
        this.coreRadius = 195;
        this.entryAngle = Math.random() * Math.PI * 2;
        this.segments = []; // 1px line walls (like warp maze)
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiCoreGfx = null;
        this._pixiOuterGfx = null;
        this._pixiCoreText = null;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
    }

    generateMaze() {
        if (this.generated) return;
        this.generated = true;
        // Concentric 1px line rings (warp-maze style). Each ring has intentional gap(s).
        const entry = this.entryAngle;
        const rings = [
            // Path widths doubled to make navigation less punishing.
            { r: 825, gap: entry + Math.PI, width: 0.68, astR: 86, turretChance: 0.10 },
            { r: 1310, gap: entry, width: 0.68, astR: 90, turretChance: 0.12 },
            { r: 1800, gap: entry + Math.PI, width: 0.68, astR: 94, turretChance: 0.12 },
            { r: 2175, gaps: [entry, entry + Math.PI / 2, entry + Math.PI, entry + (Math.PI * 3 / 2)], width: 0.44, astR: 98, turretChance: 0.00 } // outer ring entrances
        ];

        this.segments = [];
        for (const ring of rings) {
            const gaps = ring.gaps || [ring.gap];
            this.segments.push(...this.buildRing(ring.r, gaps, ring.width, 0.065));
        }

        let turretBudget = 6;
        for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
            const ring = rings[ringIndex];
            const count = Math.ceil((Math.PI * 2 * ring.r) / (ring.astR * 2 * 0.92));
            const step = (Math.PI * 2) / count;
            for (let i = 0; i < count; i++) {
                const a = i * step;
                const gaps = ring.gaps || [ring.gap];
                let nearGap = false;
                let d = a - gaps[0];
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                for (let gi = 0; gi < gaps.length; gi++) {
                    let dg = a - gaps[gi];
                    while (dg > Math.PI) dg -= Math.PI * 2;
                    while (dg < -Math.PI) dg += Math.PI * 2;
                    if (Math.abs(dg) < ring.width) { nearGap = true; break; }
                }
                if (nearGap) continue; // intentional gap(s)

                const x = this.pos.x + Math.cos(a) * ring.r;
                const y = this.pos.y + Math.sin(a) * ring.r;

                // Static defensive turrets mounted on some inner walls (not on the entrance ring).
                const allowTurretRing = (ringIndex === 1 || ringIndex === 2);
                if (allowTurretRing && turretBudget > 0 && contractEntities && contractEntities.wallTurrets) {
                    if (Math.random() < ring.turretChance && Math.abs(d) > (ring.width + 0.25)) {
                        const tx = x - Math.cos(a) * (ring.astR * 0.75 + 34);
                        const ty = y - Math.sin(a) * (ring.astR * 0.75 + 34);
                        contractEntities.wallTurrets.push(new WallTurret(tx, ty, this.contractId, a));
                        turretBudget--;
                    }
                }
            }
        }

        // Reward cache in the core
        caches.push(new ExplorationCache(this.pos.x, this.pos.y, this.contractId));
    }

    buildRing(r, gaps, width, step = 0.065) {
        const segs = [];
        for (let ang = 0; ang < Math.PI * 2; ang += step) {
            const a0 = ang;
            const a1 = Math.min(Math.PI * 2, ang + step);
            let inGap = false;
            for (const g of gaps) {
                let d = a0 - g;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                if (Math.abs(d) < width) { inGap = true; break; }
            }
            if (inGap) continue;
            const x0 = this.pos.x + Math.cos(a0) * r;
            const y0 = this.pos.y + Math.sin(a0) * r;
            const x1 = this.pos.x + Math.cos(a1) * r;
            const y1 = this.pos.y + Math.sin(a1) * r;
            segs.push({ x0, y0, x1, y1 });
        }
        return segs;
    }

    allSegments() {
        return this.segments || [];
    }

    applyWallCollisions(entity, elasticity = 0.95) {
        const segs = this.allSegments();
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            resolveCircleSegment(entity, s.x0, s.y0, s.x1, s.y1, elasticity);
        }
    }

    bulletHitsWall(bullet) {
        const segs = this.allSegments();
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const cp = closestPointOnSegment(bullet.pos.x, bullet.pos.y, s.x0, s.y0, s.x1, s.y1);
            const dx = bullet.pos.x - cp.x;
            const dy = bullet.pos.y - cp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < (bullet.radius || 0) + 0.8) return true;
        }
        return false;
    }

    update(deltaTime = 16.67) {
        if (!player || player.dead) return;
        this.t++;
        if (!activeContract || activeContract.type !== 'anomaly') return;

        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);

        // Build the maze before the player hits the ring so it can be seen on approach.
        if (d < this.radius * 1.6) {
            if (!this.generated) {
                this.generateMaze();
                this.shieldsDirty = true;
            }
        }

        const collected = !!activeContract.coreCollected;
        if (d < this.radius) {
            activeContract.state = collected ? 'escape' : 'inside';

            if (!this.defendersSpawned) {
                this.defendersSpawned = true;
                const defenderCount = 6;
                for (let i = 0; i < defenderCount; i++) {
                    let spawned = false;
                    for (let attempt = 0; attempt < 30 && !spawned; attempt++) {
                        const a = Math.random() * Math.PI * 2;
                        const dd = 850 + Math.random() * 950;
                        const sx = this.pos.x + Math.cos(a) * dd;
                        const sy = this.pos.y + Math.sin(a) * dd;
                        const distPlayer = player ? Math.hypot(player.pos.x - sx, player.pos.y - sy) : 99999;
                        if (distPlayer < 500) continue;
                        const def = new Enemy('defender', { x: sx, y: sy }, null);
                        def.contractId = this.contractId;
                        enemies.push(def);
                        spawned = true;
                    }
                }
                showOverlayMessage("ANOMALY STABILIZED: NAVIGATE TO CORE", '#0f0', 2500);
            }
        } else {
            // Outside the ring: if the cache was collected, escaping completes the contract.
            activeContract.state = 'travel';
            if (collected) {
                completeContract(true);
            }
        }
    }
    draw(ctx) {
        if (this.dead) return;

        const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.02)) * 0.25;

        if (pixiVectorLayer) {
            // Initialization
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);

                this._pixiOuterGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiOuterGfx);

                this._pixiCoreGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiCoreGfx);

                this.shieldsDirty = true;
            }
            if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);
            if (!this._pixiOuterGfx.parent) pixiVectorLayer.addChild(this._pixiOuterGfx);
            if (!this._pixiCoreGfx.parent) pixiVectorLayer.addChild(this._pixiCoreGfx);

            // Rebuild Geometry if dirty
            if (this.shieldsDirty && this.segments && this.segments.length > 0) {
                const z = currentZoom || ZOOM_LEVEL;

                // 1. Maze Segments
                this._pixiGfx.clear();
                this._pixiGfx.lineStyle(2 / z, 0x00ffff, 0.55); // Increased line width slightly for visibility
                for (let i = 0; i < this.segments.length; i++) {
                    const s = this.segments[i];
                    this._pixiGfx.moveTo(s.x0, s.y0);
                    this._pixiGfx.lineTo(s.x1, s.y1);
                }

                // 2. Outer Ring
                this._pixiOuterGfx.clear();
                this._pixiOuterGfx.lineStyle(4, 0x00ff78, 1.0);
                this._pixiOuterGfx.drawCircle(this.pos.x, this.pos.y, this.radius);

                // 3. Core
                this._pixiCoreGfx.clear();
                this._pixiCoreGfx.beginFill(0xff8c00, 0.3); // Core fill
                this._pixiCoreGfx.lineStyle(4, 0xff8c00, 0.8);
                this._pixiCoreGfx.drawCircle(this.pos.x, this.pos.y, this.coreRadius);
                this._pixiCoreGfx.endFill();

                this.shieldsDirty = false;
            }

            // Update Dynamic states (Alpha pulse)
            if (this._pixiOuterGfx) this._pixiOuterGfx.alpha = 0.5 + pulse;
            if (this._pixiCoreGfx) this._pixiCoreGfx.alpha = 0.5 + pulse;

            // Core Text
            if (pixiVectorLayer) {
                let t = this._pixiCoreText;
                if (!t) {
                    const fontSize = Math.round(16 / (currentZoom || ZOOM_LEVEL));
                    t = new PIXI.Text('CORE', {
                        fontFamily: 'Courier New',
                        fontSize: fontSize,
                        fontWeight: 'bold',
                        fill: 0xffffff,
                        align: 'center'
                    });
                    t.anchor.set(0.5);
                    pixiVectorLayer.addChild(t);
                    this._pixiCoreText = t;
                }
                if (!t.parent) pixiVectorLayer.addChild(t);
                t.position.set(this.pos.x, this.pos.y);
                t.visible = true;
            }

            return; // Exit canvas path
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Maze rings (warp-maze style 1px line walls)
        if (this.segments && this.segments.length > 0) {
            const z = currentZoom || ZOOM_LEVEL;
            ctx.save();
            ctx.lineWidth = 1 / z;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0ff';
            ctx.strokeStyle = 'rgba(0,255,255,0.55)';
            ctx.beginPath();
            for (let i = 0; i < this.segments.length; i++) {
                const s = this.segments[i];
                ctx.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
                ctx.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
            }
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = `rgba(0,255,120,${pulse})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.save();
        ctx.fillStyle = `rgba(255,140,0,${0.10 + pulse * 0.20})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.coreRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#f80';
        ctx.strokeStyle = `rgba(255,140,0,${0.55 + pulse * 0.25})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(16 / (currentZoom || ZOOM_LEVEL))}px Courier New`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', 0, 0);
        ctx.restore();
        ctx.restore();
    }
}

class WallTurret extends Entity {
    constructor(x, y, contractId = null, baseAngle = 0) {
        super(x, y);
        this.contractId = contractId;
        this.baseAngle = baseAngle;
        this.radius = 26;
        this.hp = 6;
        this.maxHp = 6;
        this.reload = 50 + Math.floor(Math.random() * 30);
        this.t = 0;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiHpGfx = null;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        // Drop coins like a roamer ship.
        for (let i = 0; i < 3; i++) coins.push(new Coin(this.pos.x, this.pos.y, 2));
        spawnParticles(this.pos.x, this.pos.y, 18, '#ff6');
        playSound('explode');
    }

    update(deltaTime = 16.67) {
        if (this.dead) return;
        this.t++;
        if (!player || player.dead) return;
        if (!activeContract || activeContract.type !== 'anomaly' || activeContract.id !== this.contractId) return;

        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.y - this.pos.y);
        if (dist > 3600) return;

        this.reload--;
        if (this.reload > 0) return;

        const aim = Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x);
        const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
        const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
        bullets.push(new Bullet(muzzleX, muzzleY, aim, true, 1, 12, 4, '#f80'));
        if (Math.random() < 0.25) {
            bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.12, true, 1, 12, 4, '#f80'));
            bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.12, true, 1, 12, 4, '#f80'));
        }
        this.reload = 55 + Math.floor(Math.random() * 30);
    }

    draw(ctx) {
        if (this.dead) return;

        const aim = (player && !player.dead) ? Math.atan2(player.pos.y - this.pos.y, player.pos.x - this.pos.x) : this.baseAngle;

        if (pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);

                this._pixiHpGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiHpGfx);

                this.shieldsDirty = true;
            }
            if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);
            if (!this._pixiHpGfx.parent) pixiVectorLayer.addChild(this._pixiHpGfx);

            if (this.shieldsDirty) {
                this._pixiGfx.clear();
                // Base
                this._pixiGfx.beginFill(0x111111, 1.0);
                this._pixiGfx.lineStyle(2, 0xff8800, 1.0);
                this._pixiGfx.drawCircle(0, 0, this.radius);
                this._pixiGfx.endFill();
                // Barrel
                this._pixiGfx.beginFill(0xff8800, 1.0);
                this._pixiGfx.drawRect(this.radius * 0.2, -5, this.radius * 1.25, 10);
                this._pixiGfx.endFill();
                // Core
                this._pixiGfx.beginFill(0x222222, 1.0);
                this._pixiGfx.drawCircle(0, 0, 8);
                this._pixiGfx.endFill();

                this.shieldsDirty = false;
            }

            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiGfx.rotation = aim;

            // HP ring
            const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
            this._pixiHpGfx.clear();
            this._pixiHpGfx.lineStyle(3, 0xffff66, 0.75);
            this._pixiHpGfx.arc(this.pos.x, this.pos.y, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            this._pixiHpGfx.visible = true;

            return;
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(aim);

        // Base
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#f80';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f80';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Barrel
        ctx.fillStyle = '#f80';
        ctx.fillRect(this.radius * 0.2, -5, this.radius * 1.25, 10);

        // Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // HP ring
        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#ff6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();

        ctx.restore();
    }
}

function scheduleNextShootingStar() {
    if (sectorIndex >= 2) {
        nextShootingStarTime = Date.now() + 60000; // every ~1 minute
    } else {
        // 3-5 minutes = 180000 to 300000 ms
        nextShootingStarTime = Date.now() + 180000 + Math.random() * 120000;
    }
}

function scheduleNextRadiationStorm(fromNow = Date.now()) {
    nextRadiationStormAt = null;
    radiationStorm = null;
}

function spawnRadiationStormRelative() {
    return;
}

function scheduleNextMiniEvent(fromNow = Date.now()) {
    const min = 120000;  // 2m
    const max = 210000;  // 3.5m
    nextMiniEventAt = fromNow + min + Math.floor(Math.random() * (max - min + 1));
}

function spawnMiniEventRelative() {
    if (!player) return;
    const p = findSpawnPointRelative(true, 2400, 4400);
    // Always spawn the Defend Cache event
    miniEvent = new MiniEventDefendCache(p.x, p.y);
    showOverlayMessage("MINI-EVENT: DEFEND THE CACHE", '#ff0', 2200, 1);
    playSound('contract');
}

function findSpawnPointRelative(random = false, min = 1500, max = 2500) {
    if (!player) return { x: 0, y: 0 };
    if (caveMode && caveLevel && caveLevel.active) {
        const dist = min + Math.random() * (max - min);
        // Bias spawns "up the tunnel" so progression stays pressured.
        const y = player.pos.y - dist * (0.85 + Math.random() * 0.3);
        const bounds = caveLevel.boundsAt(y);
        const margin = 180;
        const w = Math.max(200, (bounds.right - bounds.left) - margin * 2);
        const x = bounds.left + margin + Math.random() * w;
        return { x, y };
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = min + Math.random() * (max - min);
    const x = player.pos.x + Math.cos(angle) * dist;
    const y = player.pos.y + Math.sin(angle) * dist;
    return { x, y };
}

function resolveEntityCollision() {
    const allEntities = [player, ...enemies, ...pinwheels, ...(contractEntities.fortresses || [])].filter(e => e && !e.dead);
    if (boss && !boss.dead) allEntities.push(boss);
    if (spaceStation) allEntities.push(spaceStation);
    if (destroyer && !destroyer.dead) allEntities.push(destroyer);

    const activeAnomalyZone = (activeContract && activeContract.type === 'anomaly' && contractEntities && contractEntities.anomalies)
        ? contractEntities.anomalies.find(a => a && !a.dead && a.contractId === activeContract.id)
        : null;

    const activeCave = (caveMode && caveLevel && caveLevel.active) ? caveLevel : null;

    // Push physics
    for (let i = 0; i < allEntities.length; i++) {
        for (let j = i + 1; j < allEntities.length; j++) {
            const e1 = allEntities[i];
            const e2 = allEntities[j];

            // Pinwheels shouldn't "push" ships around; ships should avoid them instead.
            if ((e1 instanceof Pinwheel && e2 instanceof Enemy) || (e2 instanceof Pinwheel && e1 instanceof Enemy)) {
                continue;
            }
            let r1 = (e1 instanceof Destroyer || e1 instanceof Destroyer2) ? (e1.shieldRadius || e1.radius) : e1.radius;
            let r2 = (e2 instanceof Destroyer || e2 instanceof Destroyer2) ? (e2.shieldRadius || e2.radius) : e2.radius;

            const isStatic1 = (e1 instanceof Pinwheel) || (e1 instanceof SpaceStation);
            const isStatic2 = (e2 instanceof Pinwheel) || (e2 instanceof SpaceStation);
            const e1IsDestroyer = (e1 instanceof Destroyer || e1 instanceof Destroyer2);
            const e2IsDestroyer = (e2 instanceof Destroyer || e2 instanceof Destroyer2);

            if (isStatic1 && e1.shieldSegments && e1.shieldSegments.some(s => s > 0)) r1 = e1.shieldRadius;
            if (isStatic2 && e2.shieldSegments && e2.shieldSegments.some(s => s > 0)) r2 = e2.shieldRadius;

            const dx = e2.pos.x - e1.pos.x;
            const dy = e2.pos.y - e1.pos.y;
            const distSq = dx * dx + dy * dy;
            const minDist = r1 + r2;
            if (distSq < minDist * minDist && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const push = overlap * 0.5;

                if ((e1IsDestroyer && e2 instanceof Pinwheel) || (e2IsDestroyer && e1 instanceof Pinwheel)) {
                    if (e1IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                    else { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                } else if (isStatic1) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (isStatic2) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else if (e1IsDestroyer && !e2IsDestroyer) { e2.pos.x += nx * overlap; e2.pos.y += ny * overlap; }
                else if (e2IsDestroyer && !e1IsDestroyer) { e1.pos.x -= nx * overlap; e1.pos.y -= ny * overlap; }
                else {
                    e1.pos.x -= nx * push; e1.pos.y -= ny * push;
                    e2.pos.x += nx * push; e2.pos.y += ny * push;
                }

                if (e1 instanceof Pinwheel) e1.aggro = true;
                if (e2 instanceof Pinwheel) e2.aggro = true;
            }
        }
    }

    // Collision & Damage
    const damageable = [player, ...enemies, ...pinwheels, ...(contractEntities.fortresses || [])];
    if (boss && bossActive && !boss.dead) damageable.push(boss);
    if (destroyer && !destroyer.dead) damageable.push(destroyer);
    for (let entity of damageable) {
        if (entity.dead) continue;
        const nearbyAsteroids = asteroidGrid.query(entity.pos.x, entity.pos.y);
        for (let ast of nearbyAsteroids) {
            if (ast.dead) continue;
            const dx = entity.pos.x - ast.pos.x;
            const dy = entity.pos.y - ast.pos.y;
            const distSq = dx * dx + dy * dy;
            const entityRadius = (entity instanceof Destroyer || entity instanceof Destroyer2) ? (entity.shieldRadius || entity.radius) : entity.radius;
            const minDist = entityRadius + ast.radius;
            const isIndestructibleWall = !!ast.unbreakable;

            if (distSq < minDist * minDist) {
                let dist = Math.sqrt(distSq);
                if (dist < 0.001) dist = 0.001;
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                // Some large entities can smash normal asteroids, but indestructible contract walls should block everything.
                const isCrasher = (entity instanceof Pinwheel) ||
                    (entity instanceof Cruiser) ||
                    (entity instanceof Enemy && (
                        entity.isGunboat ||
                        entity.type === 'roamer' ||
                        entity.type === 'elite_roamer' ||
                        entity.type === 'hunter' ||
                        entity.type === 'defender'
                    ));
                const isDestroyer = (entity instanceof Destroyer || entity instanceof Destroyer2);

                // Track if we had any valid collision
                let validCollision = false;

                if (isDestroyer && isIndestructibleWall) {
                    // Destroyers blow through indestructible asteroids with particle effects only (no sound)
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    // No collision response - continue to next asteroid
                    continue;
                }

                if (!isIndestructibleWall && isCrasher) {
                    ast.break();
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#aa8');
                    validCollision = true;
                }

                // Only apply collision response if we had a valid collision (not indestructible)
                if (validCollision) {
                    entity.pos.x += nx * overlap;
                    entity.pos.y += ny * overlap;

                    if (entity !== player) {
                        entity.vel.x += nx * 1;
                        entity.vel.y += ny * 1;
                    }
                }

                if (entity === player) {
                    // Bump response: bounce like a rubber wall + push away
                    const vn = player.vel.x * nx + player.vel.y * ny;
                    if (vn < 0) {
                        const restitution = 1.0; // elastic bounce
                        player.vel.x -= nx * vn * (1 + restitution);
                        player.vel.y -= ny * vn * (1 + restitution);
                    }
                    // Indestructible walls should feel "tight" (no extra invisible buffer) vs regular asteroids.
                    const outwardKick = isIndestructibleWall ? Math.min(4, overlap * 0.08) : Math.min(10, 3 + overlap * 0.12);
                    player.vel.x += nx * outwardKick;
                    player.vel.y += ny * outwardKick;
                    player.vel.mult(0.98);
                    shakeMagnitude = Math.max(shakeMagnitude, isIndestructibleWall ? 3 : 6);
                    shakeTimer = Math.max(shakeTimer, 10);

                    if (Date.now() - player.lastAsteroidHitTime > 1000) {
                        // Invincibility check from upgrade
                        if (player.invincibilityOnHit > 0) {
                            // Trigger invuln? For now simpler logic: Just standard shield hit
                        }

                        if (Date.now() - player.lastAsteroidHitTime > 1000) {
                            const asteroidDamage = sectorIndex >= 2 ? 2 : 1;
                            player.takeHit(asteroidDamage);
                            player.lastAsteroidHitTime = Date.now();
                            if (!isIndestructibleWall) {
                                ast.break();
                                spawnParticles(ast.pos.x, ast.pos.y, 8, '#aa8');
                                playSound('hit');
                } else {
                    // Wall sparks (no breaking).
                    spawnParticles(player.pos.x - nx * player.radius, player.pos.y - ny * player.radius, 6, '#08f');
                    playSound('hit');
                    }
                }
            }
        }
    }
    }
    }

    // (Wall collisions for caves, warp zones, and anomalies are now handled centrally
        //  via checkWallCollision(entity) within each entity's update method).

    // Coin Collection
    if (player && !player.dead) {
        // Player rams into roamers/defenders: destroy them, take damage equal to remaining HP
        for (let e of enemies) {
            if (e.dead) continue;
            // Ramming Logic
            const isRoamer = (e.type === 'roamer' || e.type === 'elite_roamer');
            const isDefender = (e.type === 'defender');
            const isHunter = (e.type === 'hunter');

            if (isRoamer || isDefender || isHunter) {
                const dist = Math.hypot(player.pos.x - e.pos.x, player.pos.y - e.pos.y);
                if (dist < player.radius + e.radius) {
                    // Safe Bump for Roamers/Defenders
                    if (isRoamer || isDefender) {
                        const angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);

                        // Push away physically (velocity)
                        const pushForce = 5;
                        player.vel.x += nx * pushForce;
                        player.vel.y += ny * pushForce;
                        e.vel.x -= nx * pushForce;
                        e.vel.y -= ny * pushForce;

                    // Visuals
                        spawnParticles((player.pos.x + e.pos.x) / 2, (player.pos.y + e.pos.y) / 2, 5, '#fff');
                        // No damage, no death.
                        continue;
                    }

                    // Original logic for Hunters or others
                    const ramDamage = Math.max(0, Math.ceil(e.hp));
                    // Larger, colorful burst on impact
                    spawnParticles(e.pos.x, e.pos.y, 20, '#f44');
                    spawnParticles(e.pos.x, e.pos.y, 15, '#ff0');
                    spawnParticles(e.pos.x, e.pos.y, 10, '#0ff');
                    e.kill();
                    playSound('hit');

                    player.takeHit(ramDamage);
                }
            }
        }

        for (let c of coins) {
            if (c.dead) continue;
            const dist = Math.hypot(player.pos.x - c.pos.x, player.pos.y - c.pos.y);
            if (dist < player.radius + c.radius) {
                // Collect - call kill() to properly release sprite
                playSound('coin');
                score += c.value;
                player.addXp(c.value);
                addPickupFloatingText('gold', c.value, '#ff0');
                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        for (let n of nuggets) {
            if (n.dead) continue;
            const dist = Math.hypot(player.pos.x - n.pos.x, player.pos.y - n.pos.y);
            if (dist < player.radius + n.radius) {
                playSound('coin');
                spaceNuggets += n.value;
                updateNuggetUI();
                addPickupFloatingText('nugs', n.value, '#ff0');
                // Call kill() to properly release sprite
                if (typeof n.kill === 'function') n.kill();
                else n.dead = true;
            }
        }

        for (let p of powerups) {
            if (p.dead) continue;
            const dist = Math.hypot(player.pos.x - p.pos.x, player.pos.y - p.pos.y);
            if (dist < player.radius + p.radius) {
                playSound('powerup');
                player.hp = Math.min(player.hp + 10, player.maxHp);
                updateHealthUI();
                showOverlayMessage("HEALTH RESTORED", '#0f0', 1000);
                // Call kill() to properly release sprite
                if (typeof p.kill === 'function') p.kill();
                else p.dead = true;
            }
        }

        for (let c of caches) {
            if (c.dead) continue;
            const dist = Math.hypot(player.pos.x - c.pos.x, player.pos.y - c.pos.y);
            if (dist < player.radius + c.radius) {
                playSound('coin');
                spaceNuggets += c.value;
                updateNuggetUI();
                addPickupFloatingText('nugs', c.value, '#ff0');
                showOverlayMessage(`CACHE +${c.value} NUGS`, '#ff0', 800);

                // Anomaly contract: picking up the cache is step 1; you must escape the ring to finish.
                if (activeContract && activeContract.type === 'anomaly' && activeContract.id && c.contractId === activeContract.id) {
                    if (!activeContract.coreCollected) {
                        activeContract.coreCollected = true;
                        showOverlayMessage("CORE ACQUIRED - ESCAPE ANOMALY", '#0f0', 2000);
                        updateContractUI();
                    }
                }
                // Call kill() to properly clean up PIXI graphics
                if (typeof c.kill === 'function') c.kill();
                else c.dead = true;
            }
        }

        // Shooting Star Collisions
        for (let s of shootingStars) {
            if (s.dead) continue;

            // Vs Player
            if (player && !player.dead && !player.invulnerable) {
                const dist = Math.hypot(s.pos.x - player.pos.x, s.pos.y - player.pos.y);
                if (dist < s.radius + player.radius) {
                    player.takeHit(s.damage);
                    updateHealthUI();
                    playSound('explode');
                    spawnParticles(player.pos.x, player.pos.y, 20, '#f00');
                    showOverlayMessage("HIT BY SHOOTING STAR!", '#f00', 2000);
                    s.dead = true;
                    if (player.hp <= 0) killPlayer();
                    continue;
                }
            }

            // Vs Enemies / Bases / Boss / Station
            let hitEntity = false;
            for (let e of enemies) {
                if (!e || e.dead) continue;
                const dist = Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y);
                if (dist < s.radius + e.radius) {
                    e.hp -= s.damage;
                    spawnParticles(e.pos.x, e.pos.y, 14, '#fa0');
                    playSound('explode');
                    if (e.hp <= 0) e.kill();
                    hitEntity = true;
                    break;
                }
            }
            if (!hitEntity) {
                for (let b of pinwheels) {
                    if (!b || b.dead) continue;
                    const dist = Math.hypot(s.pos.x - b.pos.x, s.pos.y - b.pos.y);
                    if (dist < s.radius + b.radius) {
                        b.hp -= s.damage;
                        b.aggro = true;
                        spawnParticles(b.pos.x, b.pos.y, 18, '#fa0');
                        playSound('explode');
                        if (b.hp <= 0) {
                            b.dead = true;
                            playSound('base_explode');
                            spawnLargeExplosion(b.pos.x, b.pos.y, 2.0);
                            for (let i = 0; i < 6; i++) coins.push(new Coin(b.pos.x + (Math.random() - 0.5) * 50, b.pos.y + (Math.random() - 0.5) * 50, 5));
                            nuggets.push(new SpaceNugget(b.pos.x, b.pos.y, 1));
                            pinwheelsDestroyed++;
                            pinwheelsDestroyedTotal++;
                            difficultyTier = 1 + Math.floor(pinwheelsDestroyedTotal / 6);
                            score += 1000;
                            document.getElementById('bases-display').innerText = `${pinwheelsDestroyedTotal}`;
                            enemies.forEach(e => { if (e.assignedBase === b) e.type = 'roamer'; });
                            const delay = 5000 + Math.random() * 5000;
                            baseRespawnTimers.push(Date.now() + delay);
                        }
                        hitEntity = true;
                        break;
                    }
                }
            }
            if (!hitEntity && bossActive && boss && !boss.dead) {
                if (boss.hitTestCircle(s.pos.x, s.pos.y, s.radius)) {
                    boss.hp -= s.damage;
                    spawnParticles(boss.pos.x, boss.pos.y, 22, '#fa0');
                    playSound('explode');
                    if (boss.hp <= 0) {
                        boss.kill();
                        score += 10000;
                    }
                    hitEntity = true;
                }
            }
            if (!hitEntity && spaceStation) {
                const dist = Math.hypot(s.pos.x - spaceStation.pos.x, s.pos.y - spaceStation.pos.y);
                if (dist < s.radius + spaceStation.radius) {
                    spaceStation.hp -= s.damage;
                    spawnParticles(spaceStation.pos.x, spaceStation.pos.y, 22, '#fa0');
                    playSound('explode');
                    if (spaceStation.hp <= 0) handleSpaceStationDestroyed();
                    hitEntity = true;
                }
            }
            if (hitEntity) {
                s.dead = true;
                continue;
            }

            // Vs Asteroids
            const nearby = asteroidGrid.query(s.pos.x, s.pos.y);
            for (let ast of nearby) {
                if (ast.dead) continue;
                const dist = Math.hypot(s.pos.x - ast.pos.x, s.pos.y - ast.pos.y);
                if (dist < s.radius + ast.radius) {
                    ast.break(true); // No sound when hit by comet
                    spawnParticles(ast.pos.x, ast.pos.y, 10, '#fa0');
                    // Star keeps going (pierces)
                }
            }
        }

    }
}

function checkWallCollision(entity, elasticity = 0) {
    // 1. Cave Level Collisions
    if (caveMode && caveLevel && caveLevel.active) {
        caveLevel.applyWallCollisions(entity);
    }

    // 2. Warp Zone Collisions
    if (warpZone && warpZone.active) {
        warpZone.applyWallCollisions(entity);
    }

    // 3. Anomaly Maze Collisions
    const activeAnomalyZone = (activeContract && activeContract.type === 'anomaly' && contractEntities && contractEntities.anomalies)
        ? contractEntities.anomalies.find(a => a && !a.dead && a.contractId === activeContract.id)
        : null;
    if (activeAnomalyZone) {
        const dA = Math.hypot(entity.pos.x - activeAnomalyZone.pos.x, entity.pos.y - activeAnomalyZone.pos.y);
        if (dA < activeAnomalyZone.radius + 800) activeAnomalyZone.applyWallCollisions(entity, 0.95);
    }

    // Arena barriers only affect player/bullets (enemies exempt)
    if (bossArena.active && entity instanceof Enemy) return;
    if (bossArena.active) {
        const dx = entity.pos.x - bossArena.x;
        const dy = entity.pos.y - bossArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > bossArena.radius) {
            // Player Damage Logic
            if (entity === player) {
                if (Date.now() - player.lastArenaDamageTime > 1000) {
                    if (player.invulnerable <= 0) {
                        player.hp -= 1;
                        playSound('hit');
                        updateHealthUI();
                        spawnParticles(player.pos.x, player.pos.y, 5, '#f00');
                        showOverlayMessage("WARNING: ARENA WALL DAMAGE", '#f00', 1000);
                        if (player.hp <= 0) killPlayer();
                    }
                    player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = bossArena.x + Math.cos(angle) * bossArena.radius;
            entity.pos.y = bossArena.y + Math.sin(angle) * bossArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }

    // Station arena barrier
    if (stationArena.active && entity instanceof Enemy) return;
    if (stationArena.active) {
        const dx = entity.pos.x - stationArena.x;
        const dy = entity.pos.y - stationArena.y;
        const dist = Math.hypot(dx, dy);
        if (dist > stationArena.radius) {
            if (entity === player) {
                if (Date.now() - player.lastArenaDamageTime > 1000) {
                    if (player.invulnerable <= 0) {
                        player.hp -= 1;
                        playSound('hit');
                        updateHealthUI();
                        spawnParticles(player.pos.x, player.pos.y, 5, '#f00');
                        showOverlayMessage("STATION FIELD DAMAGE", '#f80', 1000);
                        if (player.hp <= 0) killPlayer();
                    }
                    player.lastArenaDamageTime = Date.now();
                }
            }

            const angle = Math.atan2(dy, dx);
            entity.pos.x = stationArena.x + Math.cos(angle) * stationArena.radius;
            entity.pos.y = stationArena.y + Math.sin(angle) * stationArena.radius;

            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const dot = entity.vel.x * nx + entity.vel.y * ny;

            if (dot > 0) {
                entity.vel.x -= nx * dot * (1 + elasticity);
                entity.vel.y -= ny * dot * (1 + elasticity);
            }
        }
    }
}

function checkBulletWallCollision(bullet) {
    // Warp maze 1px line walls (blocks bullets).
    if (warpZone && warpZone.active && typeof warpZone.bulletHitsWall === 'function') {
        if (warpZone.bulletHitsWall(bullet)) return { kind: 'warp_wall', obj: null };
    }
    // Cave 1px line walls.
    if (caveMode && caveLevel && caveLevel.active && typeof caveLevel.bulletHitsWall === 'function') {
        if (caveLevel.bulletHitsWall(bullet)) return { kind: 'cave_wall', obj: null };
    }
    // Anomaly maze 1px line walls.
    if (activeContract && activeContract.type === 'anomaly' && contractEntities && contractEntities.anomalies) {
        const az = contractEntities.anomalies.find(a => a && !a.dead && a.contractId === activeContract.id && typeof a.bulletHitsWall === 'function');
        if (az) {
            const dA = Math.hypot(bullet.pos.x - az.pos.x, bullet.pos.y - az.pos.y);
            if (dA < az.radius + 900 && az.bulletHitsWall(bullet)) return { kind: 'anomaly_wall', obj: null };
        }
    }
    const nearby = asteroidGrid.query(bullet.pos.x, bullet.pos.y);
    for (let ast of nearby) {
        if (ast.dead) continue;
        const dx = bullet.pos.x - ast.pos.x;
        const dy = bullet.pos.y - ast.pos.y;
        const distSq = dx * dx + dy * dy;
        const rad = ast.radius + bullet.radius;
        if (distSq < rad * rad) {
            return { kind: 'asteroid', obj: ast };
        }
    }
    return null;
}

function updateHealthUI() {
    if (!player) return;
    const pct = (player.hp / player.maxHp) * 100;
    healthFill.style.width = `${Math.max(0, pct)}%`;
    if (pct < 30) healthFill.style.backgroundColor = '#f00';
    else if (pct < 60) healthFill.style.backgroundColor = '#ff0';
    else healthFill.style.backgroundColor = '#0f0';
    const ht = document.getElementById('health-text');
    if (ht) ht.innerText = `${Math.max(0, Math.floor(player.hp))} / ${player.maxHp}`;
}

function updateXpUI() {
    if (!player) return;
    const pct = (player.xp / player.nextLevelXp) * 100;
    xpFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    document.getElementById('level-display').innerText = player.level;
    document.getElementById('score').innerText = score;
}

function updateNuggetUI() {
    const el = document.getElementById('nugget-count');
    if (el) el.innerText = (metaProfile.bank || 0) + spaceNuggets;
}

// --- Profile Save / Load (player stats only) ---
const SAVE_PREFIX = 'neon_space_profile_v1_';
const SAVE_LAST_KEY = 'neon_space_profile_last';
let pendingProfile = null;

function buildProfileData() {
    if (!player) return null;
    return {
        version: 1,
        timestamp: Date.now(),
        player: {
            hp: player.hp,
            maxHp: player.maxHp,
            shieldSegments: [...player.shieldSegments],
            maxShieldSegments: player.maxShieldSegments,
            outerShieldSegments: [...(player.outerShieldSegments || [])],
            maxOuterShieldSegments: player.maxOuterShieldSegments || 0,
            stats: { ...player.stats },
            inventory: { ...player.inventory },
            level: player.level,
            xp: player.xp,
            nextLevelXp: player.nextLevelXp,
            magnetRadius: player.magnetRadius,
            nukeUnlocked: player.nukeUnlocked,
            nukeCooldown: player.nukeCooldown,
            nukeMaxCooldown: player.nukeMaxCooldown,
            staticWeapons: [...player.staticWeapons],
            shieldRotation: player.shieldRotation,
            outerShieldRotation: player.outerShieldRotation,
            outerShieldRadius: player.outerShieldRadius,
            invincibilityCycle: { ...player.invincibilityCycle },
            turboBoost: { ...player.turboBoost },
            nukeDamage: player.nukeDamage,
            nukeRange: player.nukeRange
        }
    };
}

function applyProfile(profile) {
    if (!profile || !profile.player || !player) {
        pendingProfile = profile || null;
        return;
    }
    const src = profile.player;
    player.maxHp = src.maxHp || player.maxHp;
    player.hp = Math.min(src.hp || player.hp, player.maxHp);
    if (src.shieldSegments) player.shieldSegments = [...src.shieldSegments];
    player.maxShieldSegments = src.maxShieldSegments || player.shieldSegments.length;
    if (typeof src.maxOuterShieldSegments === 'number') player.maxOuterShieldSegments = src.maxOuterShieldSegments;
    if (src.outerShieldSegments) player.outerShieldSegments = [...src.outerShieldSegments];
    player.stats = { ...player.stats, ...(src.stats || {}) };
    player.inventory = { ...(src.inventory || {}) };
    player.level = src.level || player.level;
    player.xp = src.xp || 0;
    player.nextLevelXp = src.nextLevelXp || player.nextLevelXp;
    if (typeof src.magnetRadius === 'number') player.magnetRadius = src.magnetRadius;
    player.nukeUnlocked = !!src.nukeUnlocked;
    if (typeof src.nukeCooldown === 'number') player.nukeCooldown = src.nukeCooldown;
    if (typeof src.nukeMaxCooldown === 'number') player.nukeMaxCooldown = src.nukeMaxCooldown;
    if (typeof src.nukeDamage === 'number') player.nukeDamage = src.nukeDamage;
    if (typeof src.nukeRange === 'number') player.nukeRange = src.nukeRange;
    player.staticWeapons = src.staticWeapons ? [...src.staticWeapons] : player.staticWeapons;
    if (typeof src.shieldRotation === 'number') player.shieldRotation = src.shieldRotation;
    if (typeof src.outerShieldRotation === 'number') player.outerShieldRotation = src.outerShieldRotation;
    if (typeof src.outerShieldRadius === 'number') player.outerShieldRadius = src.outerShieldRadius;
    player.invincibilityCycle = { ...player.invincibilityCycle, ...(src.invincibilityCycle || {}) };
    if (src.turboBoost) player.turboBoost = { ...player.turboBoost, ...(src.turboBoost || {}) };
    // Stock ship always has a minimal turbo boost even on older saves.
    player.turboBoost.unlocked = true;
    player.turboBoost.durationFrames = Math.max(60, player.turboBoost.durationFrames || 0);
    player.turboBoost.cooldownTotalFrames = 600;
    player.turboBoost.speedMult = Math.max(1.25, player.turboBoost.speedMult || 0);
    updateHealthUI();
    updateWarpUI();
    updateTurboUI();
    updateXpUI();
    pendingProfile = null;
}

function listSaveSlots() {
    const slots = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_PREFIX)) {
            slots.push(k.replace(SAVE_PREFIX, ''));
        }
    }
    return slots;
}

function promptForSlot(existingOnly = false, promptText = null) {
    const slots = listSaveSlots();
    const defaultSlot = localStorage.getItem(SAVE_LAST_KEY) || (slots[0] || 'slot1');
    let msg = promptText;
    if (!msg) {
        msg = existingOnly ? `Load profile (${slots.join(', ') || 'none'}):` : `Save profile (existing: ${slots.join(', ') || 'none'}):`;
    }
    const name = prompt(msg, defaultSlot);
    if (!name) return null;
    localStorage.setItem(SAVE_LAST_KEY, name);
    return name;
}

function saveToSlot(slot, silent = false) {
    try {
        const data = buildProfileData();
        if (!data) throw new Error('no player');
        localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
        localStorage.setItem(SAVE_LAST_KEY, slot);
        if (!silent) showOverlayMessage(`PROFILE SAVED (${slot})`, '#0f0', 1500);
    } catch (e) {
        console.warn('save failed', e);
        if (!silent) showOverlayMessage("SAVE FAILED", '#f00', 1500);
    }
}

function wipeProfiles() {
    // Remove all stored profiles and meta progression
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_PREFIX)) toDelete.push(k);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(SAVE_LAST_KEY);
    localStorage.removeItem('meta_profile_v1');
    resetMetaProfile();
    pendingProfile = null;
    rerollTokens = 0;
    updateMetaUI();
    showOverlayMessage("PROFILE RESET - STARTING FRESH", '#0f0', 2000);
}

function saveGame() {
    if (!player || !gameActive) {
        showOverlayMessage("NO ACTIVE PROFILE TO SAVE", '#f00', 1500);
        return;
    }
    const slot = promptForSlot(false);
    if (!slot) return;
    saveToSlot(slot);
}

function loadGameFromStorage() {
    const slot = promptForSlot(true);
    if (!slot) return;
    try {
        const raw = localStorage.getItem(SAVE_PREFIX + slot);
        if (!raw) {
            showOverlayMessage("NO PROFILE FOUND", '#f00', 1500);
            return;
        }
        const data = JSON.parse(raw);
        pendingProfile = data;
        if (player) applyProfile(data);
        localStorage.setItem(SAVE_LAST_KEY, slot);
        showOverlayMessage(`PROFILE LOADED (${slot})`, '#0f0', 1500);

        // Loading a save is like starting fresh - can't resume until quitting to menu
        canResumeGame = false;

        // Update resume button state
        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }
    } catch (e) {
        console.warn('load failed', e);
        showOverlayMessage("LOAD FAILED", '#f00', 1500);
    }
}

function saveEndOfRun() {
    const slot = promptForSlot(false, "Save profile (new or overwrite):");
    if (!slot) return;
    saveToSlot(slot);
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return hh > 0 ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function updateWarpUI() {
    if (!player) return;
    if (!player.canWarp) {
        warpStatus.style.display = 'none';
    } else {
        warpStatus.style.display = 'flex';
        const pct = ((player.maxWarpCooldown - player.warpCooldown) / player.maxWarpCooldown) * 100;
        warpFill.style.width = `${pct}%`;
        warpFill.style.backgroundColor = player.warpCooldown > 0 ? '#333' : '#0ff';
    }
}

function updateTurboUI() {
    if (!player || !turboStatus || !turboFill) return;
    if (!player.turboBoost || !player.turboBoost.unlocked) {
        turboStatus.style.display = 'none';
        return;
    }
    turboStatus.style.display = 'flex';

    const cooldownTotal = 600; // 10 seconds at 60fps
    const cd = Math.max(0, player.turboBoost.cooldownFrames || 0);
    const active = Math.max(0, player.turboBoost.activeFrames || 0);

    if (active > 0) {
        turboFill.style.width = `100%`;
        turboFill.style.background = 'linear-gradient(90deg, #ff0, #f80, #f00)';
    } else if (cd > 0) {
        const pct = (1 - (cd / cooldownTotal)) * 100;
        turboFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        turboFill.style.background = 'linear-gradient(90deg, #f00, #ff0)';
    } else {
        turboFill.style.width = `100%`;
        turboFill.style.background = 'linear-gradient(90deg, #0ff, #0f0)';
    }
}

function setupGameWorld() {
    player.respawn();
    resetPixiOverlaySprites();
    clearArrayWithPixiCleanup(bullets);
    clearArrayWithPixiCleanup(bossBombs);
    clearArrayWithPixiCleanup(guidedMissiles);
    clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
    clearArrayWithPixiCleanup(particles);
    clearArrayWithPixiCleanup(explosions);
    clearArrayWithPixiCleanup(floatingTexts);
    clearArrayWithPixiCleanup(coins);
    clearArrayWithPixiCleanup(nuggets);
    spaceNuggets = 0;
    clearArrayWithPixiCleanup(powerups);
    clearArrayWithPixiCleanup(shootingStars);
    clearArrayWithPixiCleanup(drones);
    clearArrayWithPixiCleanup(caches);
    radiationStorm = null;
    nextRadiationStormAt = null;
    clearMiniEvent();
    nextMiniEventAt = Date.now() + 120000;
    clearArrayWithPixiCleanup(pois);
    contractEntities = { beacons: [], gates: [], anomalies: [], fortresses: [], wallTurrets: [] };
    activeContract = null;
    nextContractAt = Date.now() + 30000; // first contract after ~30s
    scheduleNextShootingStar();
    scheduleNextRadiationStorm();
    scheduleNextMiniEvent();
    nextIntensityBreakAt = Date.now() + 120000; // first break at 2 minutes
    intensityBreakActive = false;
    warpParticles = [];
    shockwaves = [];
    roamerRespawnQueue = [];
    baseRespawnTimers = [];
    pinwheelsDestroyed = 0;
    pinwheelsDestroyedTotal = 0;
    if (boss) pixiCleanupObject(boss);
    boss = null;
    if (spaceStation) pixiCleanupObject(spaceStation);
    spaceStation = null;
    if (destroyer) {
        pixiCleanupObject(destroyer);
        destroyer = null;
    }
    nextDestroyerSpawnTime = null;
    currentDestroyerType = 1;
    bossActive = false;
    bossArena.active = false;
    stationArena.active = false;
    pendingStations = 0;
    sectorIndex = 1;
    sectorTransitionActive = false;
    warpCountdownAt = null;
    warpGateUnlocked = false;
    // nextSpaceStationTime = Date.now() + 180000; // disabled, after second cruiser
    gunboatRespawnAt = null;
    gunboatLevel2Unlocked = false;
    initialSpawnDone = false;
    gameStartTime = getGameNowMs();
    pauseStartTime = null;
    pausedAccumMs = 0;

    initialSpawnDelayAt = gameStartTime + 5000;

    generateMap();
    // Ensure the nebula palette matches Sector 1 when restarting after a Sector 2 cave run. 
    initStars();

    maxRoamers = 3;
    document.getElementById('bases-display').innerText = `0`;
    shakeMagnitude = 0;
    updateWarpUI();
    updateTurboUI();
    updateXpUI();
    updateNuggetUI();
}

function showFloatingText(x, y, amount, color = '#ff0', key = null) {
    if (key) {
        getOrCreateFloatingText(floatingTexts, key, x, y, amount, color, {
            prefix: '+',
            life: 70
        });
    } else {
        floatingTexts.push(new FloatingText(x, y, `+${amount}`, color, 70, { prefix: '+' }));
    }
}

function addPickupFloatingText(key, amount, color = '#ff0') {
    if (!player || player.dead) return;
    const x = player.pos.x;
    const y = player.pos.y - player.radius - 10;
    showFloatingText(x, y, amount, color, key);
}

function awardCoinsInstant(amount, opts = {}) {
    const v = Math.max(0, Math.floor(amount || 0));
    if (v <= 0) return;
    score += v;
    if (player && !player.dead && typeof player.addXp === 'function') player.addXp(v);
    if (!opts.noSound) playSound(opts.sound || 'coin');
    addPickupFloatingText('gold', v, opts.color || '#ff0');
}

function awardNugzInstant(amount, opts = {}) {
    const v = Math.max(0, Math.floor(amount || 0));
    if (v <= 0) return;
    spaceNuggets += v;
    updateNuggetUI();
    if (!opts.noSound) playSound(opts.sound || 'coin');
    addPickupFloatingText('nugs', v, opts.color || '#ff0');
}

function spawnNewPinwheelRelative(initial = false) {
    if (!player) return;
    const availableTypes = ['standard'];
    if (difficultyTier >= 2) availableTypes.push('rapid');
    if (difficultyTier >= 3) availableTypes.push('heavy');

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    let angle;
    if (initial) {
        angle = Math.random() * Math.PI * 2;
    } else {
        let baseAngle = player.angle;
        if (player.vel.mag() > 1) baseAngle = Math.atan2(player.vel.y, player.vel.x);
        angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2);
    }

    const dist = initial ? (1000 + Math.random() * 2000) : (3500 + Math.random() * 1500);
    let bx, by;
    if (caveMode && caveLevel && caveLevel.active) {
        // Spawn pinwheels "up the tunnel" and inside the cave bounds.
        by = player.pos.y - dist * (0.85 + Math.random() * 0.3);
        const bounds = caveLevel.boundsAt(by);
        const margin = 420;
        const w = Math.max(200, (bounds.right - bounds.left) - margin * 2);
        bx = bounds.left + margin + Math.random() * w;
    } else {
        bx = player.pos.x + Math.cos(angle) * dist;
        by = player.pos.y + Math.sin(angle) * dist;
    }

    const b = new Pinwheel(bx, by, type);
    pinwheels.push(b);
    // One guard per pinwheel
    const da = Math.random() * Math.PI * 2;
    const defX = b.pos.x + Math.cos(da) * 150;
    const defY = b.pos.y + Math.sin(da) * 150;
    enemies.push(new Enemy('defender', { x: defX, y: defY }, b));
}

// --- Upgrade Logic ---

function showLevelUpMenu() {
    const container = document.getElementById('upgrade-container');
    container.innerHTML = '';
    const parent = container.parentElement;
    const existingReroll = document.getElementById('reroll-btn');
    if (existingReroll) existingReroll.remove();

    // 1. Filter Valid Upgrades
    const validUpgrades = [];
    UPGRADE_DATA.categories.forEach(cat => {
        cat.upgrades.forEach(up => {
            const currentTier = player.inventory[up.id] || 0;
            if (currentTier < 3) {
                validUpgrades.push({ ...up, category: cat.name });
            }
        });
    });

    // Handle case when all upgrades are maxed out
    if (validUpgrades.length === 0) {
        // Show message that all upgrades are maxed
        showOverlayMessage("ALL UPGRADES MAXED OUT!", '#0f0', 2000);

        // Give bonus health as a reward for leveling up
        if (player && !player.dead) {
            player.hp = player.maxHp;
            updateHealthUI();
            playSound('powerup');
        }

        // Resume game with the same timing reset logic as normal upgrade selection
        // This prevents jitter and timing issues when resuming
        requestAnimationFrame(() => {
            setTimeout(() => {
                // Force reset interpolation for all entities to prevent visual jumps
                const resetEnt = (e) => {
                    if (e && e.pos && e.prevPos) {
                        e.prevPos.x = e.pos.x;
                        e.prevPos.y = e.pos.y;
                    }
                };
                if (player) resetEnt(player);
                if (boss) resetEnt(boss);
                if (spaceStation) resetEnt(spaceStation);
                if (enemies) enemies.forEach(resetEnt);
                if (pinwheels) pinwheels.forEach(resetEnt);
                if (bullets) bullets.forEach(resetEnt);
                if (particles) particles.forEach(resetEnt);
                if (floatingTexts) floatingTexts.forEach(resetEnt);

                // Reset simAccMs to zero to avoid catching up
                simAccMs = 0;
                // Update simLastPerfAt to current time to prevent large delta
                simLastPerfAt = performance.now();

                suppressWarpGateUntil = getGameNowMs() + 750;
                suppressWarpInputUntil = suppressWarpGateUntil;
                gameActive = true;
                if (musicEnabled) startMusic();
            }, 100);
        });
        return;
    }

    // 2. Pick 3 Random
    const choices = [];
    const count = Math.min(3, validUpgrades.length);
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * validUpgrades.length);
        choices.push(validUpgrades[idx]);
        validUpgrades.splice(idx, 1);
    }

    // Reroll button - uses tokens if available, otherwise costs 5 nuggets
    const rerollBtn = document.createElement('button');
    rerollBtn.id = 'reroll-btn';
    rerollBtn.style.marginTop = '10px';
    rerollBtn.style.padding = '12px 24px';
    rerollBtn.style.fontSize = '16px';
    rerollBtn.style.backgroundColor = '#4a2';
    rerollBtn.style.color = '#fff';
    rerollBtn.style.cursor = 'pointer';

    const updateRerollButton = () => {
        if (rerollTokens > 0) {
            rerollBtn.textContent = `REROLL OPTIONS (TOKENS: ${rerollTokens})`;
            rerollBtn.style.backgroundColor = '#4a2';
            rerollBtn.disabled = false;
        } else {
            rerollBtn.textContent = `REROLL (5 NUGGETS)`;
            rerollBtn.style.backgroundColor = spaceNuggets >= 5 ? '#2a4' : '#333';
            rerollBtn.disabled = spaceNuggets < 5;
        }
    };

    updateRerollButton();

    rerollBtn.onclick = () => {
        if (rerollTokens > 0) {
            // Use purchased reroll token
            rerollTokens--;
            metaProfile.purchases.rerollTokens = rerollTokens;
            saveMetaProfile();
            showLevelUpMenu();
        } else if (spaceNuggets >= 5) {
            // Spend 5 nuggets
            spaceNuggets -= 5;
            updateNuggetUI();
            showLevelUpMenu();
        }
    };

    parent.insertBefore(rerollBtn, container);

    // 3. Create DOM
    choices.forEach((choice, index) => {
        const currentTier = player.inventory[choice.id] || 0;
        const nextTier = currentTier + 1;
        const desc = choice[`tier${nextTier}`];

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
                    <div class="upgrade-title">${choice.name}</div>
                    <div style="color:#aaa; font-size:12px; margin-bottom:10px">${choice.category}</div>
                    <div class="upgrade-desc">${desc}</div>
                    <div style="font-size:12px; color:#888; margin-top:10px">${choice.notes}</div>
                `;

        card.onmouseenter = () => {
            menuSelectionIndex = index;
            const active = getActiveMenuElements();
            updateMenuVisuals(active);
        };

        card.onclick = () => {
            // Apply the upgrade first
            applyUpgrade(choice.id, nextTier);
            document.getElementById('levelup-screen').style.display = 'none';

            // Smooth timing reset to prevent jitter on resume
            // We don't reset simLastPerfAt to 0 anymore - that causes a large frameDt spike
            // Instead, we let the frame accumulator naturally handle the pause

            // Delay resume to allow browser layout/GC to settle
            requestAnimationFrame(() => {
                // Force garbage collection if available (Chrome dev tools)
                if (typeof window !== 'undefined' && window.gc && typeof window.gc === 'function') {
                    try { window.gc(); } catch (e) { }
                }

                setTimeout(() => {
                    // Force reset interpolation for all entities to prevent visual jumps
                    // if the first frame has weird timing.
                    const resetEnt = (e) => {
                        if (e && e.pos && e.prevPos) {
                            e.prevPos.x = e.pos.x;
                            e.prevPos.y = e.pos.y;
                        }
                    };
                    if (player) resetEnt(player);
                    if (boss) resetEnt(boss);
                    if (spaceStation) resetEnt(spaceStation);
                    if (enemies) enemies.forEach(resetEnt);
                    if (pinwheels) pinwheels.forEach(resetEnt);
                    if (bullets) bullets.forEach(resetEnt);
                    if (particles) particles.forEach(resetEnt);
                    if (floatingTexts) floatingTexts.forEach(resetEnt);

                    // Reset simAccMs to zero to avoid catching up
                    simAccMs = 0;
                    // Update simLastPerfAt to current time to prevent large delta
                    simLastPerfAt = performance.now();

                    suppressWarpGateUntil = getGameNowMs() + 750;
                    suppressWarpInputUntil = suppressWarpGateUntil;
                    gameActive = true;
                    if (musicEnabled) startMusic();
                }, 100); // Reduced from 200ms for snappier resume
            });
        };
        container.appendChild(card);
    });

    document.getElementById('levelup-screen').style.display = 'flex';
    // Keep background music playing during the upgrade choice.

    // Restore 3 HP whenever the upgrade/level-up menu appears
    try {
        if (player && !player.dead) {
            player.hp = Math.min(player.hp + 3, player.maxHp);
            updateHealthUI();
            playSound('powerup');
        }
    } catch (e) { console.warn('heal on levelup failed', e); }

    // Reset selection for gamepad
    menuSelectionIndex = 0;
    const cards = getActiveMenuElements();
    if (cards.length > 0) updateMenuVisuals(cards);
}

function applyUpgrade(id, tier) {
    const prevTier = player.inventory[id] || 0;
    player.inventory[id] = tier;

    // Track upgrades for cruiser first-spawn logic 
    try {
        dreadManager.upgradesChosen = (dreadManager.upgradesChosen || 0) + 1;
        // On the 3rd chosen upgrade, schedule the first cruiser to spawn after 10s
        // On the 3rd chosen upgrade, schedule the first cruiser to spawn after 10s
        if (!dreadManager.firstSpawnDone && dreadManager.upgradesChosen >= 3 && !bossActive && !dreadManager.timerActive) {
            dreadManager.timerAt = Date.now() + 10000; // 10 seconds (real time)
            dreadManager.timerActive = true;
            // Countdown will automatically show 10 seconds before spawn
        }
    } catch (e) { console.warn('dreadManager upgrade increment failed', e); }

    // Logic Map 
    switch (id) {
        case 'turret_damage':
            {
                const table = { 0: 1.0, 1: 1.5, 2: 2.0, 3: 3.0 };
                const prev = table[prevTier] || 1.0;
                const next = table[tier] || prev;
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                player.stats.damageMult *= ratio;
            }
            break;
        case 'turret_fire_rate':
            {
                const table = { 0: 1.0, 1: 1.15, 2: 1.30, 3: 1.50 };
                const prev = table[prevTier] || 1.0;
                const next = table[tier] || prev;
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                player.stats.fireRateMult *= ratio;
            }
            break;
        case 'turret_range':
            {
                const table = { 0: 1.0, 1: 1.25, 2: 1.50, 3: 2.0 };
                const prev = table[prevTier] || 1.0;
                const next = table[tier] || prev;
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                player.stats.rangeMult *= ratio;
            }
            break;
        case 'multi_shot':
            player.stats.multiShot = tier + 1; // 2, 3, 4
            break;
        case 'static_weapons':
            // Add specific gun logic
            if (tier === 1) player.staticWeapons.push({ type: 'forward' });
            if (tier === 2) player.staticWeapons.push({ type: 'side' });
            if (tier === 3) player.staticWeapons.push({ type: 'rear' });
            if (tier === 4) player.staticWeapons.push({ type: 'dual_rear' });
            if (tier === 5) player.staticWeapons.push({ type: 'dual_front' });
            player.staticCannonCount = player.staticWeapons.length; // Vis only
            break;
        case 'homing_missiles':
            player.stats.homing = tier; // 1=weak, 2=strong, 3=perfect(implied by stronger turn rate)
            break;
        case 'segment_count':
            if (tier === 1) player.shieldSegments.push(2, 2); // 8+2=10
            if (tier === 2) player.shieldSegments.push(2, 2, 2, 2); // 10+4=14
            if (tier === 3) player.shieldSegments.push(2, 2, 2, 2); // 14+4=18
            player.maxShieldSegments = player.shieldSegments.length;
            break;
        case 'outer_shield':
            if (tier === 1) player.maxOuterShieldSegments = 6;
            if (tier === 2) player.maxOuterShieldSegments = 8;
            if (tier === 3) player.maxOuterShieldSegments = 12;
            player.outerShieldRadius = player.shieldRadius + (26 * PLAYER_SHIELD_RADIUS_SCALE);
            player.outerShieldSegments = new Array(player.maxOuterShieldSegments).fill(1);
            break;
        case 'shield_regen':
            if (tier === 1) player.stats.shieldRegenRate = 5;
            if (tier === 2) player.stats.shieldRegenRate = 3;
            if (tier === 3) player.stats.shieldRegenRate = 1;
            break;
        case 'hp_regen':
            player.stats.hpRegenAmount = tier; // 1/2/3 HP per tick
            player.stats.hpRegenRate = 5; // fixed 5s tick
            player.lastHpRegenTime = Date.now();
            break;
        case 'hull_strength':
            player.maxHp += 25;
            player.hp = Math.min(player.hp + 25, player.maxHp); // restore 25 HP on upgrade
            updateHealthUI();
            break;
        case 'speed':
            {
                const table = { 0: 1.0, 1: 1.15, 2: 1.30, 3: 1.50 };
                const prev = table[prevTier] || 1.0;
                const next = table[tier] || prev;
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                player.stats.speedMult *= ratio;
            }
            break;
        case 'turbo_boost': {
            player.turboBoost.unlocked = true;
            if (tier === 1) player.turboBoost.durationFrames = 120; // 2.0s
            if (tier === 2) player.turboBoost.durationFrames = 210; // 3.5s
            if (tier === 3) player.turboBoost.durationFrames = 300; // 5.0s
            player.turboBoost.cooldownTotalFrames = 600; // fixed 10s cooldown
            player.turboBoost.speedMult = 1.5;
            player.turboBoost.activeFrames = 0;
            player.turboBoost.cooldownFrames = 0;
            updateTurboUI();
            break;
        }
        case 'xp_magnet':
            if (tier === 1) player.magnetRadius = 300;
            if (tier === 2) player.magnetRadius = 600;
            if (tier === 3) player.magnetRadius = 1200;
            break;
        case 'area_nuke':
            player.nukeUnlocked = true;
            player.nukeMaxCooldown = 600; // 10s
            if (tier === 1) { player.nukeDamage = 5; player.nukeRange = 600; }
            if (tier === 2) { player.nukeDamage = 10; player.nukeRange = 700; }
            if (tier === 3) { player.nukeDamage = 15; player.nukeRange = 900; }
            break;
        case 'invincibility':
            player.invincibilityCycle.unlocked = true;
            if (tier === 1) player.invincibilityCycle.stats = { duration: 180, cooldown: 1200, regen: false }; // 3s / 20s
            if (tier === 2) player.invincibilityCycle.stats = { duration: 300, cooldown: 900, regen: false }; // 5s / 15s
            if (tier === 3) player.invincibilityCycle.stats = { duration: 420, cooldown: 600, regen: true }; // 7s / 10s
            player.invincibilityCycle.state = 'ready';
            player.invincibilityCycle.timer = 0;
            break;
        case 'slow_field':
            if (tier === 1) { player.stats.slowField = 250; player.stats.slowFieldDuration = 180; }
            if (tier === 2) { player.stats.slowField = 312; player.stats.slowFieldDuration = 300; }
            if (tier === 3) { player.stats.slowField = 390; player.stats.slowFieldDuration = 480; }
            break;
        case 'companion_drones': {
            const ensureDrone = (t) => {
                if (!drones.find(d => d.type === t)) spawnDrone(t);
            };
            if (tier >= 1) ensureDrone('shooter');
            if (tier >= 2) ensureDrone('shield');
            if (tier >= 3) ensureDrone('heal');
            break;
        }
    }

    showOverlayMessage(`${id.replace('_', ' ').toUpperCase()} UPGRADED!`, '#ff0', 1500);
}

// --- Core Loop ---

function updateGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gamepadIndex];
    if (!gp) {
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) { gamepadIndex = i; break; }
        }
        // If no pads are present, fall back to mouse/keyboard mode.
        if (!pads.some(p => p)) {
            gamepadIndex = null;
            lastGamepadInputAt = 0;
            updateInputMode(Date.now());
        }
        return;
    }

    const deadzone = 0.12;
    const applyDeadzone = (v) => {
        const a = Math.abs(v);
        if (a <= deadzone) return 0;
        // Rescale so values just outside the deadzone don't feel sluggish.
        const scaled = (a - deadzone) / (1 - deadzone);
        return Math.sign(v) * scaled;
    };

    let gamepadInput = false;
    if (gp.axes.some(axis => Math.abs(axis) > deadzone) || gp.buttons.some(button => button.pressed)) {
        gamepadInput = true;
    }

    if (gamepadInput) {
        lastGamepadInputAt = Date.now();
    }

    gpState.move.x = applyDeadzone(gp.axes[0]);
    gpState.move.y = applyDeadzone(gp.axes[1]);
    gpState.aim.x = applyDeadzone(gp.axes[2]);
    gpState.aim.y = applyDeadzone(gp.axes[3]);

    const now = Date.now();
    updateInputMode(now);
    if (gp.buttons[9].pressed && !gpState.pausePressed) { // Start
        togglePause();
        gpState.pausePressed = true;
    } else if (!gp.buttons[9].pressed) {
        gpState.pausePressed = false;
    }

    gpState.warp = gp.buttons[0].pressed;
    gpState.turbo = gp.buttons[2].pressed; // Button 2 (X/Square)

    // DEBUG: Y button (button 3) spawns space station
    if (gp.buttons[3].pressed && !gpState.yPressed) {
        gpState.yPressed = true;
        if (typeof window.spawnStation === 'function') {
            window.spawnStation();
        }
    } else if (!gp.buttons[3].pressed) {
        gpState.yPressed = false;
    }

    // Menu Navigation Support
    if ((!gameActive || gamePaused) && now - menuDebounce > 150) {
        const activeElements = getActiveMenuElements();
        if (activeElements.length > 0) {
            // Check if menu has changed by comparing first element or length
            const menuChanged = !gpState.lastMenuElements ||
                gpState.lastMenuElements.length !== activeElements.length ||
                gpState.lastMenuElements[0] !== activeElements[0];

            if (menuChanged) {
                menuSelectionIndex = 0;
                gpState.lastMenuElements = activeElements;
                updateMenuVisuals(activeElements);
            }

            const selectedEl = activeElements[menuSelectionIndex];
            const isSlider = selectedEl && selectedEl.tagName === 'INPUT' && selectedEl.type === 'range';
            const isCheckbox = selectedEl && selectedEl.tagName === 'INPUT' && selectedEl.type === 'checkbox';
            const isSelect = selectedEl && selectedEl.tagName === 'SELECT';

            // Check for horizontal input
            const leftPressed = gp.axes[0] < -0.5 || (gp.buttons[14] && gp.buttons[14].pressed);
            const rightPressed = gp.axes[0] > 0.5 || (gp.buttons[15] && gp.buttons[15].pressed);

            // Handle sliders - left/right adjusts value, up/down navigates
            if (isSlider) {
                if (leftPressed || rightPressed) {
                    const changeAmount = 5;
                    if (rightPressed) {
                        selectedEl.value = Math.min(parseInt(selectedEl.max), parseInt(selectedEl.value) + changeAmount);
                    } else {
                        selectedEl.value = Math.max(parseInt(selectedEl.min), parseInt(selectedEl.value) - changeAmount);
                    }
                    selectedEl.dispatchEvent(new Event('input', { bubbles: true }));
                    menuDebounce = now + 100;
                } else {
                    // Vertical navigation for sliders
                    let change = 0;
                    if (gp.axes[1] < -0.5 || (gp.buttons[12] && gp.buttons[12].pressed)) change = -1;
                    if (gp.axes[1] > 0.5 || (gp.buttons[13] && gp.buttons[13].pressed)) change = 1;

                    if (change !== 0) {
                        menuSelectionIndex += change;
                        if (menuSelectionIndex < 0) menuSelectionIndex = activeElements.length - 1;
                        if (menuSelectionIndex >= activeElements.length) menuSelectionIndex = 0;
                        updateMenuVisuals(activeElements);
                        menuDebounce = now;
                    }
                }
            } else {
                // Non-slider navigation
                // Check for vertical input (navigation)
                let vertChange = 0;
                if (gp.axes[1] < -0.5 || (gp.buttons[12] && gp.buttons[12].pressed)) vertChange = -1;
                if (gp.axes[1] > 0.5 || (gp.buttons[13] && gp.buttons[13].pressed)) vertChange = 1;

                // Check for horizontal input
                let horizChange = 0;
                if (leftPressed) horizChange = -1;
                if (rightPressed) horizChange = 1;

                // Vertical input - always navigate
                if (vertChange !== 0) {
                    menuSelectionIndex += vertChange;
                    if (menuSelectionIndex < 0) menuSelectionIndex = activeElements.length - 1;
                    if (menuSelectionIndex >= activeElements.length) menuSelectionIndex = 0;
                    updateMenuVisuals(activeElements);
                    menuDebounce = now;
                }
                // Horizontal input - cycle options for selects
                else if (horizChange !== 0 && isSelect) {
                    const options = selectedEl.options;
                    const currentIndex = selectedEl.selectedIndex;
                    const nextIndex = (currentIndex + horizChange + options.length) % options.length;
                    selectedEl.selectedIndex = nextIndex;
                    selectedEl.dispatchEvent(new Event('change', { bubbles: true }));
                    menuDebounce = now;
                }
                // Horizontal input on non-select - navigate
                else if (horizChange !== 0) {
                    menuSelectionIndex += horizChange;
                    if (menuSelectionIndex < 0) menuSelectionIndex = activeElements.length - 1;
                    if (menuSelectionIndex >= activeElements.length) menuSelectionIndex = 0;
                    updateMenuVisuals(activeElements);
                    menuDebounce = now;
                }

                // A Button / Cross - toggle checkbox or click button
                if (gp.buttons[0].pressed) {
                    if (isCheckbox) {
                        selectedEl.checked = !selectedEl.checked;
                        selectedEl.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        selectedEl.click();
                        gpState.lastMenuElements = null;
                    }
                    menuDebounce = now + 200;
                }
            }
        } else {
            gpState.lastMenuElements = null;
        }
    }
}

function getActiveMenuElements() {
    const isVisible = (el) => {
        if (!el) return false;
        if (typeof window === 'undefined' || !window.getComputedStyle) {
            return el.style.display !== 'none' && el.style.visibility !== 'hidden';
        }
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const upgradesMenu = document.getElementById('upgrades-menu');
    if (isVisible(upgradesMenu)) {
        const shopButtons = Array.from(document.querySelectorAll('#meta-shop .meta-item button'));
        const backBtn = document.getElementById('upgrades-back-btn');
        const result = [];
        if (shopButtons.length) {
            result.push(...shopButtons);
        }
        if (backBtn) {
            result.push(backBtn);
        }
        return result.length ? result : (backBtn ? [backBtn] : []);
    }

    const levelupScreen = document.getElementById('levelup-screen');
    if (isVisible(levelupScreen)) {
        // Include reroll button first, then upgrade cards
        const elements = [];
        const rerollBtn = document.getElementById('reroll-btn');
        if (rerollBtn) {
            elements.push(rerollBtn);
        }
        const cards = Array.from(document.querySelectorAll('.upgrade-card'));
        return elements.concat(cards);
    }

    // Check settings menu first - it should take priority over pause menu when visible
    const settingsMenu = document.getElementById('settings-menu');
    if (isVisible(settingsMenu)) {
        // Get interactive elements: select, checkboxes, sliders, and buttons
        const elements = [];

        // Add resolution select
        const resSelect = document.getElementById('res-select');
        if (resSelect) {
            elements.push(resSelect);
        }

        // Add checkboxes (fullscreen, frameless)
        const fullscreenCheck = document.getElementById('fullscreen-check');
        if (fullscreenCheck) {
            elements.push(fullscreenCheck);
        }
        const framelessCheck = document.getElementById('frameless-check');
        if (framelessCheck) {
            elements.push(framelessCheck);
        }

        // Add volume sliders
        const musicVolume = document.getElementById('music-volume');
        const sfxVolume = document.getElementById('sfx-volume');
        if (musicVolume) {
            elements.push(musicVolume);
        }
        if (sfxVolume) {
            elements.push(sfxVolume);
        }

        // Add buttons
        const settingsCloseBtn = document.getElementById('settings-close-btn');
        const settingsApplyBtn = document.getElementById('settings-apply-btn');
        if (settingsCloseBtn) {
            elements.push(settingsCloseBtn);
        }
        if (settingsApplyBtn) {
            elements.push(settingsApplyBtn);
        }

        return elements;
    }

    const pauseMenu = document.getElementById('pause-menu');
    if (isVisible(pauseMenu)) {
        return Array.from(document.querySelectorAll('#pause-menu button'));
    }

    const startScreen = document.getElementById('start-screen');
    if (isVisible(startScreen)) {
        return Array.from(document.querySelectorAll('#start-screen button'));
    }

    return [];
}

function updateMenuVisuals(elements) {
    elements.forEach((el, idx) => {
        if (idx === menuSelectionIndex) {
            el.classList.add('selected');
            // Support focus for all interactive elements, not just buttons
            if (typeof el.focus === 'function') {
                el.focus();
            }
            // For shop buttons, also highlight the parent meta-item and scroll into view
            if (el.tagName === 'BUTTON') {
                const metaItem = el.closest('.meta-item');
                if (metaItem) {
                    metaItem.classList.add('selected');
                    // Scroll the selected item into view
                    metaItem.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            }
        } else {
            el.classList.remove('selected');
            if (typeof el.blur === 'function') {
                el.blur();
            }
            // For shop buttons, also remove highlight from parent meta-item
            if (el.tagName === 'BUTTON') {
                const metaItem = el.closest('.meta-item');
                if (metaItem) {
                    metaItem.classList.remove('selected');
                }
            }
        }
    });
}

function killPlayer() {
    player.dead = true;
    if (metaExtraLifeAvailable) {
        metaExtraLifeAvailable = false;
        player.dead = false;
        player.hp = Math.max(1, Math.floor(player.maxHp * 0.5));
        player.invulnerable = 180;
        spawnParticles(player.pos.x, player.pos.y, 20, '#0f0');
        showOverlayMessage("SECOND CHANCE!", '#0f0', 1500);
        updateHealthUI();
        return;
    }
    playSound('explode');
    spawnParticles(player.pos.x, player.pos.y, 30, '#0ff');
    setTimeout(() => {
        gameActive = false;
        resetWarpState();
        stopMusic();
        try { depositMetaNuggets(); } catch (e) { console.warn('meta deposit failed', e); }
        try { saveEndOfRun(); } catch (e) { console.warn('save end of run failed', e); }
        document.getElementById('start-screen').style.display = 'block';
        document.querySelector('#start-screen h1').innerText = "SYSTEM FAILURE";
        document.getElementById('start-btn').innerText = "REBOOT SYSTEM";
        setTimeout(() => {
            document.getElementById('start-btn').focus();
            menuSelectionIndex = 0; // Reset for start menu
        }, 100);
    }, 2000);
}

function mainLoop() {
    const perfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    globalProfiler.update();
    animationId = requestAnimationFrame(mainLoop);
    // FPS counter (render-only).
    if (fpsCounterEl) {
        const shouldShow = !!gameActive;
        if (fpsUiVisible !== shouldShow) {
            fpsCounterEl.style.display = shouldShow ? 'block' : 'none';
            fpsUiVisible = shouldShow;
        }

        const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.min(250, t - fpsLastFrameAt));
        fpsLastFrameAt = t;
        fpsSmoothMs = fpsSmoothMs * 0.9 + dt * 0.1;

        if (shouldShow && t >= fpsNextUiAt) {
            const fps = fpsSmoothMs > 0 ? (1000 / fpsSmoothMs) : 0;
            fpsCounterEl.textContent = `FPS ${fps.toFixed(0)}  ${fpsSmoothMs.toFixed(1)}ms`;
            fpsNextUiAt = t + 250;
        }
    }
    updateGamepad();
    if (gameActive && !gamePaused) {
        // Variable timestep simulation; update and render at display refresh rate.
        const frameStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        if (!simLastPerfAt) {
            console.log('[RESUME] First frame after resume - simLastPerfAt was 0, initializing');
            simLastPerfAt = frameStart;
            // Only init simNowMs if it's 0 (first run or reset), otherwise preserve it (resume)
            if (!simNowMs) simNowMs = Date.now();
            simAccMs = 0;
        }
        let frameDt = frameStart - simLastPerfAt;
        simLastPerfAt = frameStart;
        if (!isFinite(frameDt) || frameDt < 0) frameDt = 0;

        // Record frame time for jitter monitoring
        globalJitterMonitor.recordFrame(frameDt);

        // Drop extremely large frame times (pause/background) but allow high refresh rates
        // 100ms = 10fps minimum
        frameDt = Math.min(100, frameDt);

        // Update simulation time
        simNowMs += frameDt;

        // Use variable timestep - pass actual delta time to game logic
        const originalDateNow = Date.now;
        Date.now = () => Math.floor(simNowMs);
        gameLoopLogic({ doUpdate: true, doDraw: true, deltaTime: frameDt });
        Date.now = originalDateNow;
    } else {
        // Reset timing so we don't "catch up" a large paused interval on resume.
        simLastPerfAt = 0;
        simAccMs = 0;
    }
}

function gameLoopLogic(opts = null) {
    globalProfiler.start('GameLoopLogic');

    // Safety: deactivate station arena if station gone
    if (stationArena.active && (!spaceStation || spaceStation.dead)) {
        stationArena.active = false;
    }
    const doDraw = !(opts && opts.doDraw === false);
    const doUpdate = !(opts && opts.doUpdate === false);
    const deltaTime = (opts && opts.deltaTime) || SIM_STEP_MS; // Default to 60fps step for backwards compatibility
    if (!player) return;

    const now = Date.now();
    frameNow = now;
    const warpActive = !!(warpZone && warpZone.active);

    if (doUpdate) {
        globalProfiler.start('Update');
        globalProfiler.start('GameLogic');
        // Safe clears after a station destruction to avoid mid-loop mutation
        if (pendingTransitionClear) {
            resetPixiOverlaySprites();
    clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
            clearArrayWithPixiCleanup(bullets);
            clearArrayWithPixiCleanup(bossBombs);
            clearArrayWithPixiCleanup(floatingTexts);
            bossActive = false;
            if (boss) pixiCleanupObject(boss);
            boss = null;
            bossArena.active = false;
            roamerRespawnQueue = [];
            baseRespawnTimers = [];
            pendingTransitionClear = false;
            gunboatRespawnAt = null;
        }
        // Delay the first wave to give the player breathing room (not used in cave mode) 
        if (!caveMode && !initialSpawnDone && initialSpawnDelayAt && now >= initialSpawnDelayAt) {
            initialSpawnDone = true;
            initialSpawnDelayAt = null;
            showOverlayMessage("ENEMIES DETECTED", '#f00', 2000);
            maxRoamers = 3;
            for (let i = 0; i < 2; i++) {
                const start = findSpawnPointRelative(true, 1200);
                enemies.push(new Enemy('roamer', start));
            }
            for (let i = 0; i < 1; i++) spawnNewPinwheelRelative(true);
        }
        // Update HUD timer (exclude paused time)
        try {
            const tEl = document.getElementById('game-timer');
            if (tEl && gameStartTime) {
                let elapsed = now - gameStartTime - pausedAccumMs;
                if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - pausedAccumMs;
                if (elapsed < 0) elapsed = 0;
                tEl.innerText = formatTime(elapsed);
                if (!gameEnded && elapsed >= GAME_DURATION_MS) {
                    endGame(elapsed);
                    return;
                }
            }
        } catch (e) { console.warn('timer update failed', e); }

        if (player && now >= posUiNextAt) {
            const posEl = document.getElementById('pos-debug');
            if (posEl) {
                posEl.innerText = `POS: ${Math.round(player.pos.x)}, ${Math.round(player.pos.y)}`;
                posUiNextAt = now + 100;
            }
        }

        // Sector transition countdown
        if (sectorTransitionActive && warpCountdownAt) {
            const remainingMs = Math.max(0, warpCountdownAt - now);
            overlayMessage.style.display = 'block';
            overlayMessage.innerText = `WARPING TO NEW SECTOR IN ${Math.ceil(remainingMs / 1000)}s`;
            overlayMessage.style.color = '#0ff';
            if (remainingMs <= 0) {
                completeSectorWarp();
            }
        }

        // World warp gate (appears after space station is destroyed, once per sector).
        if (!warpActive && !bossActive && !sectorTransitionActive && !warpCompletedOnce && !caveMode && !spaceStation && warpGateUnlocked) {
            if (!warpGate || warpGate.mode !== 'entry') {
                const gx = player.pos.x + 900;
                const gy = player.pos.y;
                warpGate = new WarpGate(gx, gy);
                showOverlayMessage("WARP GATE OPEN", '#f80', 1600);
            }
        } else {
            if (warpGate && warpGate.mode === 'entry') {
                pixiCleanupObject(warpGate);
                warpGate = null;
            }
        }

        // Contracts: spawn and update (normal mode only, not during arena boss)
        if (gameMode === 'normal' && gameActive && !gamePaused && !bossActive && !warpActive && !caveMode) {
            if (!activeContract && now >= nextContractAt) {
                contractSequence++;
                const pick = Math.random();
                const target = findSpawnPointRelative(true, 6000, 9000);

                if (pick < 0.60) {
                    // Scan Beacon
                    const beacon = new ContractBeacon(target.x, target.y, "SCAN BEACON");
                    contractEntities.beacons.push(beacon);
                    activeContract = {
                        id: `C${contractSequence}`,
                        type: 'scan_beacon',
                        state: 'travel',
                        title: 'SCAN BEACON',
                        target: { x: target.x, y: target.y },
                        progress: 0,
                        rewardNugs: 4 + Math.floor(Math.random() * 3),
                        rewardScore: 7000
                    };
                    showOverlayMessage("NEW CONTRACT: SCAN BEACON (STAY IN ZONE)", '#0f0', 2000, 2);
                    playSound('contract');
                } else {
                    // Gate run puzzle
                    const gateCount = 5;
                    contractEntities.gates = [];
                    const dir = Math.random() * Math.PI * 2;
                    for (let i = 0; i < gateCount; i++) {
                        const d = 1800 + i * 1500;
                        const a = dir + (Math.random() - 0.5) * 0.45;
                        const gx = player.pos.x + Math.cos(a) * d;
                        const gy = player.pos.y + Math.sin(a) * d;
                        contractEntities.gates.push(new GateRing(gx, gy, i, gateCount));
                    }
                    activeContract = {
                        id: `C${contractSequence}`,
                        type: 'gate_run',
                        state: 'active',
                        title: 'GATE RUN',
                        gateIndex: 0,
                        gateCount,
                        endsAt: Date.now() + 45000,
                        rewardNugs: 6 + Math.floor(Math.random() * 4),
                        rewardScore: 10000
                    };
                    showOverlayMessage("NEW CONTRACT: GATE RUN", '#0f0', 2000, 2);
                    playSound('contract');
                }
                updateContractUI();
            }

            if (activeContract && activeContract.type === 'gate_run') {
                if (Date.now() > activeContract.endsAt) {
                    completeContract(false);
                }
            }
        }

        // Pause the cruiser timer while the player is inside (or very near) an anomaly. 
        // (Warp-zone pausing is handled via the warp snapshot so it doesn't count warp time.) 
        let inAnomaly = false;
        try {
            if (activeContract && activeContract.type === 'anomaly' && activeContract.id && contractEntities && contractEntities.anomalies && player && !player.dead) {
                const az = contractEntities.anomalies.find(a => a && !a.dead && a.contractId === activeContract.id);
                if (az) {
                    const d = Math.hypot(player.pos.x - az.pos.x, player.pos.y - az.pos.y);
                    // Use the same "anomaly vicinity" threshold as collision/bullet-wall checks. 
                    inAnomaly = d < (az.radius + 900);
                }
            }
        } catch (e) { }
        const inStationFight = !!(stationArena.active && spaceStation && !spaceStation.dead);
        const inTractorBeam = !!(destroyer && !destroyer.dead && destroyer.tractorBeamActive);
        const waitingForResume = (cruiserTimerResumeAt > now);

        if (inAnomaly || inStationFight || inTractorBeam || waitingForResume) {
            if (cruiserTimerPausedAt === null) cruiserTimerPausedAt = now;
        } else if (cruiserTimerPausedAt !== null) {
            const dt = Math.max(0, now - cruiserTimerPausedAt);
            if (dreadManager && dreadManager.timerActive && typeof dreadManager.timerAt === 'number') {
                dreadManager.timerAt += dt;
            }
            cruiserTimerPausedAt = null;
        }
        // Arena countdown: start 10 seconds before cruiser spawns
        try {
            if (!sectorTransitionActive && !warpActive && !caveMode && !inAnomaly && !inStationFight && !inTractorBeam && !waitingForResume && dreadManager.timerActive && !bossActive && dreadManager.timerAt) {
                const remainingMs = dreadManager.timerAt - now;
                if (remainingMs <= 10000 && remainingMs > 0) {
                    if (!arenaCountdownActive) {
                        startArenaCountdown();
                    }
                    const remainingSecs = Math.ceil(remainingMs / 1000);
                    if (remainingSecs > 0 && remainingSecs <= 10) {
                        if (remainingSecs !== arenaCountdownTimeLeft) {
                            arenaCountdownTimeLeft = remainingSecs;
                            updateArenaCountdownDisplay();
                        }
                    }
                } else {
                    if (arenaCountdownActive) {
                        stopArenaCountdown();
                    }
                }
            } else {
                if (arenaCountdownActive) {
                    stopArenaCountdown();
                }
            }
        } catch (e) { }
        // Cruiser timed spawn: if timer active and no boss present, spawn a cruiser 
        try {
            if (!sectorTransitionActive && !warpActive && !caveMode && !inAnomaly && !inStationFight && !inTractorBeam && !waitingForResume && dreadManager.timerActive && !bossActive && dreadManager.timerAt && now >= dreadManager.timerAt) {
                // Cruisers can spawn even if a station exists
                cruiserEncounterCount++;
                // Arena boss fight: clear world threats; boss may call a few helpers.
                // REMOVED: Enemy/Base/Bullet clearing logic to allow them inside arena
                /*
                if (destroyer) {
                    const idx = enemies.indexOf(destroyer);
                    if (idx !== -1) enemies.splice(idx, 1);
                }
                clearArrayWithPixiCleanup(enemies);
    clearArrayWithPixiCleanup(pinwheels);
    baseRespawnTimers = [];
                roamerRespawnQueue = [];
                // Clear all bullets to prevent immediate cruiser death
                clearArrayWithPixiCleanup(bullets);
                clearArrayWithPixiCleanup(bossBombs);
                clearArrayWithPixiCleanup(guidedMissiles);
                */
                boss = new Cruiser(cruiserEncounterCount);
                bossActive = true;
                bossArena.x = (player.pos.x + boss.pos.x) / 2;
                bossArena.y = (player.pos.y + boss.pos.y) / 2;
                bossArena.radius = 2500;
                bossArena.active = true;
                bossArena.growing = false;
                // Keep arena fights clean
                radiationStorm = null;
                scheduleNextRadiationStorm(Date.now() + 60000);
                clearMiniEvent();
                scheduleNextMiniEvent(Date.now() + 90000);
                dreadManager.timerActive = false;
                dreadManager.firstSpawnDone = true;
                showOverlayMessage("WARNING: CRUISER APPROACHING - ARENA LOCKED", '#f00', 4000);
                playSound('boss_spawn');
                if (musicEnabled) setMusicMode('cruiser');
            }
        } catch (e) { console.warn('cruiser spawn check failed', e); }

        // Space Station Spawn (timer-driven)
        if (!sectorTransitionActive && !warpActive && !caveMode && !spaceStation && pendingStations > 0 && nextSpaceStationTime && now >= nextSpaceStationTime) {
            spaceStation = new SpaceStation();
            pendingStations--;
            stationArena.x = spaceStation.pos.x;
            stationArena.y = spaceStation.pos.y;
            stationArena.radius = 2800;
            stationArena.active = false;
            showOverlayMessage("SPACE STATION SPAWNED - DESTROY THE BARRIER?", '#f80', 5000);
            playSound('station_spawn');
            nextSpaceStationTime = null;
        }

        // Gunboat respawn (one at a time)
        if (!warpActive && !bossActive && !sectorTransitionActive && gameActive && !gamePaused && initialSpawnDone) {
            const gunboatAlive = enemies.some(e => e.isGunboat);
            const level2Alive = enemies.some(e => e.isGunboat && e.gunboatLevel === 2);
            const level1Alive = enemies.some(e => e.isGunboat && e.gunboatLevel === 1);
            if (gunboatRespawnAt && now >= gunboatRespawnAt) {
                // Spawn rules: before warp, only level 1, one at a time. After warp, allow one level 1 and one level 2 simultaneously.
                if (!gunboatLevel2Unlocked) {
                    if (!level1Alive) enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 1 }));
                    gunboatRespawnAt = null;
                } else {
                    if (!level1Alive) {
                        enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 1 })); // level decided in constructor
                    } else if (!level2Alive) {
                        enemies.push(new Enemy('gunboat', null, null, { gunboatLevel: 2 }));
                    }
                    gunboatRespawnAt = null;
                }
            }
            if (!gunboatRespawnAt) {
                // Only set a timer if we need more according to rules
                if (!gunboatLevel2Unlocked) {
                    if (!level1Alive) gunboatRespawnAt = now + 20000;
                } else {
                    if (!level1Alive || !level2Alive) gunboatRespawnAt = now + 20000;
                }
            }
        }

        // Single destroyer system: only 1 destroyer at a time, alternates between type 1 and 2
        if (!warpActive && !caveMode && !bossActive && !sectorTransitionActive && gameActive && !gamePaused && initialSpawnDone && !warpCompletedOnce) {
            const destroyerAlive = destroyer && !destroyer.dead;

            if (!destroyerAlive) {
                if (destroyer && destroyer.dead && nextDestroyerSpawnTime && now >= nextDestroyerSpawnTime) {
                    // Spawn alternate destroyer type
                    destroyer = (currentDestroyerType === 1) ? new Destroyer() : new Destroyer2();
                    nextDestroyerSpawnTime = null;
                    const typeName = (currentDestroyerType === 1) ? "DESTROYER" : "DESTROYER II";
                    showOverlayMessage(`NEW ${typeName} DETECTED`, '#f80', 3000);
                    playSound('boss_spawn');
                } else if (!nextDestroyerSpawnTime && initialSpawnDone && now - gameStartTime - pausedAccumMs > 30000) {
                    // First spawn - start with Destroyer type 1
                    currentDestroyerType = 1;
                    destroyer = new Destroyer();
                    nextDestroyerSpawnTime = null;
                    showOverlayMessage("DESTROYER DETECTED", '#f80', 3000);
                    playSound('boss_spawn');
                }
            }
        }

        if (!warpActive && !caveMode && !bossActive && Date.now() > nextShootingStarTime) {
            // Fire a meteor shower: 10 comets from different directions, 1s apart
            for (let i = 0; i < 10; i++) {
                const delay = i * 1000;
                setTimeout(() => {
                    shootingStars.push(new ShootingStar());
                }, delay);
            }
            scheduleNextShootingStar();
            showOverlayMessage("WARNING: COSMIC EVENT DETECTED", '#fa0', 3000);
        }

        // Risk zones: Radiation Storms
        if (!warpActive && !caveMode && !bossActive && !sectorTransitionActive && gameActive && !gamePaused && initialSpawnDone) {
            if (radiationStorm && radiationStorm.dead) radiationStorm = null;
            if ((!radiationStorm || radiationStorm.dead) && nextRadiationStormAt && now >= nextRadiationStormAt) {
                spawnRadiationStormRelative();
                scheduleNextRadiationStorm(now);
            }
        }

        // Mini-events
        if (!warpActive && !caveMode && !bossActive && !sectorTransitionActive && gameActive && !gamePaused && initialSpawnDone) {
            if (miniEvent && miniEvent.dead) clearMiniEvent();
            if (!miniEvent && nextMiniEventAt && now >= nextMiniEventAt) {
                spawnMiniEventRelative();
                scheduleNextMiniEvent(now);
            }
        }

        // Intensity breaks to let players collect/reposition
        if (!warpActive && !sectorTransitionActive && !gamePaused && gameActive) {
            if (!intensityBreakActive && now >= nextIntensityBreakAt) {
                intensityBreakActive = true;
                nextIntensityBreakAt = now + INTENSITY_BREAK_DURATION + 90000; // after break, schedule next in ~90s
            }
            if (intensityBreakActive && now >= nextIntensityBreakAt - (INTENSITY_BREAK_DURATION)) {
                // during break, stop new roamer spawns
            }
            if (intensityBreakActive && now >= nextIntensityBreakAt) {
                intensityBreakActive = false;
            }
        }

        if (!warpActive && !caveMode && !bossActive && !sectorTransitionActive && initialSpawnDone) {
            // Time-based pacing for roamer count and strength 
            let elapsed = now - gameStartTime - pausedAccumMs;
            if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;

            const baseRoamers = 6;
            const maxRoamers = 15;
            const rampMinutes = 28; // slower ramp
            const rampT = Math.min(1, elapsedMinutes / rampMinutes);
            const difficultyBonus = Math.max(0, (difficultyTier + player.level * 0.1) - 1) * 0.3;
            const earlyEnemyFactor = (elapsedMinutes < 4) ? 0.75 : 1.0;
            const targetRoamers = Math.floor((baseRoamers + (maxRoamers - baseRoamers) * rampT + difficultyBonus) * earlyEnemyFactor);

            const currentRoamers = enemies.filter(e => e.type === 'roamer' || e.type === 'elite_roamer' || e.type === 'hunter').length;
            if (!intensityBreakActive && currentRoamers + roamerRespawnQueue.length < targetRoamers) {
                // 3000ms delay between new spawns to refill population slower
                roamerRespawnQueue.push(3000);
            }

            const eliteUnlocked = elapsedMinutes >= 5 || difficultyTier >= 3 || player.level >= 4;
            const hunterUnlocked = elapsedMinutes >= 11 || difficultyTier >= 5 || player.level >= 7;
            // Keep elites/hunters rare and capped
            const eliteChance = eliteUnlocked ? Math.min(0.25, 0.08 + (elapsedMinutes / 25) * 0.2) : 0;
            const hunterChance = hunterUnlocked ? Math.min(0.15, 0.05 + (elapsedMinutes / 35) * 0.12) : 0;
            const eliteSoftCap = 3;
            const hunterSoftCap = 3;

            for (let i = roamerRespawnQueue.length - 1; i >= 0; i--) {
                roamerRespawnQueue[i] -= deltaTime;
                if (roamerRespawnQueue[i] <= 0) {
                    roamerRespawnQueue.splice(i, 1);
                    let type = 'roamer';
                    const currentElite = enemies.filter(e => e.type === 'elite_roamer').length;
                    const currentHunter = enemies.filter(e => e.type === 'hunter').length;
                    if (eliteUnlocked && currentElite < eliteSoftCap && Math.random() < eliteChance) {
                        type = 'elite_roamer';
                        if (hunterUnlocked && currentHunter < hunterSoftCap && Math.random() < hunterChance) {
                            type = 'hunter';
                        }
                    }
                    enemies.push(new Enemy(type));
                }
            }
        } else {
            roamerRespawnQueue = [];
        }

        if (!warpActive && !caveMode) {
            while (environmentAsteroids.length < 100) spawnOneAsteroidRelative();
        } else if (caveMode && caveLevel && caveLevel.active) {
            // Keep asteroids present but not overwhelming inside the cave.
            let tries = 0;
            while (environmentAsteroids.length < 40 && tries < 300) {
                spawnOneAsteroidRelative(false);
                tries++;
            }
        } else if (warpZone && warpZone.active && !bossActive) {
            let tries = 0;
            while (environmentAsteroids.length < 50 && tries < 300) {
                if (!spawnOneWarpAsteroidRelative(false)) break;
                tries++;
            }
        }

        // Build Spatial Grid for this frame
        globalProfiler.end('GameLogic');
        globalProfiler.start('SpatialHash');
        asteroidGrid.clear();
        for (let i = 0; i < environmentAsteroids.length; i++) asteroidGrid.insert(environmentAsteroids[i]);

        targetGrid.clear();
        for (let i = 0; i < enemies.length; i++) targetGrid.insert(enemies[i]);
        for (let i = 0; i < pinwheels.length; i++) targetGrid.insert(pinwheels[i]);
        for (let i = 0; i < shootingStars.length; i++) targetGrid.insert(shootingStars[i]);
        if (contractEntities) {
            if (contractEntities.fortresses) {
                for (let i = 0; i < contractEntities.fortresses.length; i++) targetGrid.insert(contractEntities.fortresses[i]);
            }
            if (contractEntities.wallTurrets) {
                for (let i = 0; i < contractEntities.wallTurrets.length; i++) targetGrid.insert(contractEntities.wallTurrets[i]);
            }
        }
        if (warpZone && warpZone.turrets) {
            for (let i = 0; i < warpZone.turrets.length; i++) targetGrid.insert(warpZone.turrets[i]);
        }
        if (boss && !boss.dead) targetGrid.insert(boss);
        if (destroyer && !destroyer.dead) targetGrid.insert(destroyer);

        // Build bullet spatial hash for efficient collision detection
        rebuildBulletGrid(bullets);
        globalProfiler.end('SpatialHash');
        globalProfiler.start('LevelLogic');

        if (!warpActive && !bossActive && !sectorTransitionActive && initialSpawnDone) {
            // Ramp base count up over the first few minutes (start easier).
            let elapsed = now - gameStartTime - pausedAccumMs;
            if (pauseStartTime) elapsed = pauseStartTime - gameStartTime - pausedAccumMs;
            if (elapsed < 0) elapsed = 0;
            const elapsedMinutes = elapsed / 60000;

            let targetBases = caveMode ? 3 : 3;
            if (!caveMode) {
                if (elapsedMinutes < 2) targetBases = 1;
                else if (elapsedMinutes < 5) targetBases = 2;
                else if (elapsedMinutes < 10) targetBases = 3;
                else targetBases = 4;
            }

                    if (pinwheels.length < targetBases) {
                if (baseRespawnTimers.length === 0) spawnNewPinwheelRelative();
            }

            for (let i = baseRespawnTimers.length - 1; i >= 0; i--) {
                if (now > baseRespawnTimers[i]) {
            if (pinwheels.length < targetBases) {
                        spawnNewPinwheelRelative();
                        baseRespawnTimers.splice(i, 1);
                    } else {
                        // Delay respawns until the current target count needs them.
                        baseRespawnTimers[i] = now + 8000;
                    }
                }
            }
        }

        // Arena ring is now static; no shrinking/growing
    }

    const targetZoom = ZOOM_LEVEL * 0.85;
    if (doUpdate) {
        currentZoom += (targetZoom - currentZoom) * 0.08;
        if (Math.abs(currentZoom - targetZoom) < 0.001) currentZoom = targetZoom;
    }
    const zoom = currentZoom;

    const alpha = (opts && opts.alpha !== undefined) ? opts.alpha : 1.0;
    renderAlpha = alpha; // Set global for entity draw methods
    const renderPos = player.getRenderPos(alpha);
    let camX, camY;
    const arenaLockActive = !!(bossArena && bossArena.active && !(boss && (boss.isCruiser || boss.isFlagship || boss.type === 'flagship')));
    if (arenaLockActive) {
        camX = bossArena.x - width / (2 * zoom);
        camY = bossArena.y - height / (2 * zoom);
    } else {
        camX = renderPos.x - width / (2 * zoom);
        camY = renderPos.y - height / (2 * zoom);
    }
    if (shakeTimer > 0) {
        if (doUpdate) {
            shakeTimer -= deltaTime / 16.67;
            shakeOffsetX = (Math.random() - 0.5) * shakeMagnitude * 2;
            shakeOffsetY = (Math.random() - 0.5) * shakeMagnitude * 2;
            if (shakeTimer <= 0) { shakeOffsetX = 0; shakeOffsetY = 0; }
        }
        // camX += shakeOffsetX;
        // camY += shakeOffsetY;
    } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
    }

    if (isNaN(camX)) camX = 0;
    if (isNaN(camY)) camY = 0;

    // Update view bounds for frustum culling (used throughout this frame)
    const viewW = width / zoom;
    const viewH = height / zoom;
    updateViewBounds(camX + viewW / 2, camY + viewH / 2, viewW, viewH);

    if (doDraw) {
        // Defensive reset: ensure no draw routine can permanently corrupt the main canvas state
        // (e.g. mismatched save/restore). This prevents "invisible world" after warp transitions.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        try { ctx.setLineDash([]); } catch (e) { }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        const caveActiveBg = (caveMode && caveLevel && caveLevel.active);
        if (pixiApp && pixiApp.renderer) {
            if (pixiApp.renderer.width !== width || pixiApp.renderer.height !== height) {
                pixiApp.renderer.resize(width, height);
            }
            if (pixiWorldRoot) {
                pixiWorldRoot.scale.set(zoom);
                // Align to pixel grid to reduce shimmer/brightness flicker from subpixel sampling.
                const px = -camX * zoom;
                const py = -camY * zoom;
                pixiWorldRoot.position.set(Math.round(px), Math.round(py));
            }
            if (pixiScreenRoot) {
                pixiScreenRoot.scale.set(1);
                pixiScreenRoot.position.set(0, 0);
                pixiScreenRoot.visible = true;
                // Enable Nebula/Stars in cave mode, disable grid
                if (pixiNebulaLayer) pixiNebulaLayer.visible = !!ENABLE_NEBULA;
                if (pixiStarTilingLayer) pixiStarTilingLayer.visible = true;
                if (pixiStarLayer) pixiStarLayer.visible = false; // legacy particle stars disabled
                updatePixiCaveGrid(camX, camY, zoom, false);
            }
        }

        // Draw Stars (always enabled)
        // if (!caveActiveBg) { // REMOVED: Enable stars in cave
        if (pixiScreenRoot && pixiStarLayer) {
            updatePixiBackground(camX, camY);
        } else {
            for (let s of starfield) {
                let x = (s.x - camX * s.parallax) % width;
                let y = (s.y - camY * s.parallax) % height;
                if (x < 0) x += width;
                if (y < 0) y += height;

                ctx.fillStyle = s.fillStyle;
                ctx.fillRect(x, y, s.size, s.size);
            }
        }
        // }
    }

    if (doDraw) {
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-camX, -camY);
    }

    // Hoisted resource objects to prevent GC
    if (!window.cachedPickupRes) window.cachedPickupRes = { layer: null, textures: null, pool: null };
    window.cachedPickupRes.layer = pixiPickupLayer; window.cachedPickupRes.textures = pixiTextures; window.cachedPickupRes.pool = pixiPickupSpritePool;
    const pickupRes = window.cachedPickupRes;

    if (!window.cachedParticleRes) window.cachedParticleRes = { layer: null, whiteTexture: null, glowTexture: null, smokeTexture: null, warpTexture: null, pool: null };
    window.cachedParticleRes.layer = pixiParticleLayer;
    window.cachedParticleRes.whiteTexture = pixiTextureWhite;
    window.cachedParticleRes.glowTexture = pixiParticleGlowTexture;
    window.cachedParticleRes.smokeTexture = pixiParticleSmokeTexture;
    window.cachedParticleRes.warpTexture = pixiParticleWarpTexture;
    window.cachedParticleRes.pool = pixiParticleSpritePool;
    // One-time pool identity check
    const particleRes = window.cachedParticleRes;

    const caveActive = (caveMode && caveLevel && caveLevel.active);
    // Use local refs in case update() clears the global (prevents null deref on draw()).
    const wz = warpZone;
    if (wz && wz.active) { if (doUpdate) wz.update(deltaTime); if (doDraw) wz.draw(ctx); }
    const wg = warpGate;
    if (wg && !wg.dead) { if (doUpdate) wg.update(deltaTime); if (doDraw) wg.draw(ctx); }
    if (caveActive) { if (doUpdate) caveLevel.update(deltaTime); }

    // Cave: full-screen grid background (no stars). 
    if (doDraw && caveActive) {
        // Pixi: cached tiling grid; Canvas fallback only if Pixi is unavailable.
        // Disabled grid background for cave mode to match Level 1 style
        /*
        if (!(pixiCaveGridSprite && pixiApp && pixiApp.renderer)) {
            caveLevel.drawGridBackground(ctx, camX, camY, width, height, zoom);
        }
        */
        caveLevel.drawFireWall(ctx, camX, camY, width, height, zoom);
    }

    if (doUpdate) globalProfiler.end('LevelLogic');
    // Asteroids should render behind everything else (drops, ships, UI).
    globalProfiler.start('Entities');
    environmentAsteroids.forEach(a => { if (doUpdate) a.update(deltaTime); if (doDraw) a.draw(ctx); });

    coins.forEach(c => {
        if (doUpdate) c.update(player, deltaTime);
        if (doDraw) {
            if (isInView(c.pos.x, c.pos.y, 50)) c.draw(ctx, pickupRes);
            else if (typeof c.cull === 'function') c.cull();
        }
    });
    nuggets.forEach(n => {
        if (doUpdate) n.update(player, deltaTime);
        if (doDraw) {
            if (isInView(n.pos.x, n.pos.y, 50)) n.draw(ctx, pickupRes);
            else if (typeof n.cull === 'function') n.cull();
        }
    });
    powerups.forEach(p => {
        if (doUpdate) p.update(player, deltaTime);
        if (doDraw) {
            if (isInView(p.pos.x, p.pos.y, 60)) p.draw(ctx, pickupRes);
            else if (typeof p.cull === 'function') p.cull();
        }
    });
    shootingStars.forEach(s => { if (doUpdate) s.update(deltaTime); if (doDraw) s.draw(ctx); });
    caches.forEach(c => { if (doUpdate) c.update(deltaTime); if (doDraw) c.draw(ctx, pickupRes); });
    pois.forEach(p => { if (doUpdate) p.update(deltaTime); if (doDraw) p.draw(ctx); });
    if (radiationStorm && !radiationStorm.dead) { if (doUpdate) radiationStorm.update(deltaTime); if (doDraw) radiationStorm.draw(ctx); }
    if (miniEvent && !miniEvent.dead) { if (doUpdate) miniEvent.update(deltaTime); if (doDraw) miniEvent.draw(ctx); }
    contractEntities.beacons.forEach(b => { if (doUpdate) b.update(deltaTime); if (doDraw) b.draw(ctx); });
    contractEntities.gates.forEach(g => { if (doUpdate) g.update(deltaTime); if (doDraw) g.draw(ctx); });
    contractEntities.anomalies.forEach(a => { if (doUpdate) a.update(deltaTime); if (doDraw) a.draw(ctx); });
    contractEntities.fortresses.forEach(f => { if (doUpdate) f.update(deltaTime); if (doDraw) f.draw(ctx); });
    contractEntities.wallTurrets.forEach(t => { if (doUpdate) t.update(deltaTime); if (doDraw) t.draw(ctx); });

    // NOTE: we intentionally do not clip in cave mode; walls indicate the bounds. 

    if (doDraw && bossArena.active) {
        ctx.save();
        ctx.translate(bossArena.x, bossArena.y);
        const pulse = 0.5 + Math.sin(now * 0.005) * 0.2;
        if (bossArena.growing) ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
        else ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;

        ctx.lineWidth = 10;
        ctx.shadowBlur = 20;
        // ctx.shadowColor = bossArena.growing ? '#0ff' : '#f00';
        ctx.beginPath();
        ctx.arc(0, 0, bossArena.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.1;
        // ctx.fillStyle = bossArena.growing ? '#055' : '#500';
        // ctx.fill();
        ctx.restore();
    }

    if (doUpdate) player.update(deltaTime);
    if (doDraw) {
        player.drawLaser(ctx);
        const alpha = (opts && opts.alpha !== undefined) ? opts.alpha : 1.0;
        player.draw(ctx, alpha);
    }

    // FloatingTexts - always update, cull drawing by view
    for (let i = 0, len = floatingTexts.length; i < len; i++) {
        const t = floatingTexts[i];
        if (doUpdate) t.update(deltaTime);
        if (doDraw && isInView(t.pos.x, t.pos.y)) t.draw(ctx, alpha);
    }

    // Drones - always close to player, no culling needed
    for (let i = 0, len = drones.length; i < len; i++) {
        const d = drones[i];
        if (doUpdate) d.update(deltaTime);
        if (doDraw) d.draw(ctx);
    }

    // Pinwheels - always update (can fire), cull drawing
    for (let i = 0, len = pinwheels.length; i < len; i++) {
        const b = pinwheels[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Enemies - always update (AI), cull drawing
    for (let i = 0, len = enemies.length; i < len; i++) {
        const e = enemies[i];
        if (doUpdate) e.update(deltaTime);
        if (doDraw && isInView(e.pos.x, e.pos.y)) e.draw(ctx);
    }

    if (bossActive && boss) {
        if (doUpdate) boss.update(deltaTime);
        if (doDraw) boss.draw(ctx);
    }

    if (spaceStation) {
        if (doUpdate) spaceStation.update(deltaTime);
        if (doDraw) spaceStation.draw(ctx);

        // Update Station Health Bar
        const sContainer = document.getElementById('station-health-container');
        const sFill = document.getElementById('station-health-fill');
        if (doDraw && sContainer && sFill) {
            sContainer.style.display = 'flex';
            const pct = Math.max(0, (spaceStation.hp / spaceStation.maxHp) * 100);
            sFill.style.width = `${pct}%`;
        }
    } else {
        const sContainer = document.getElementById('station-health-container');
        if (doDraw && sContainer) sContainer.style.display = 'none';
    }

    // Destroyer update and draw
    if (destroyer) {
        if (doUpdate) destroyer.update(deltaTime);
        if (doDraw && isInViewRadius(destroyer.pos.x, destroyer.pos.y, destroyer.visualRadius)) destroyer.draw(ctx);
    }

    // Bullets - always update (movement), cull drawing
    for (let i = 0, len = bullets.length; i < len; i++) {
        const b = bullets[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Boss bombs - always update, cull drawing
    for (let i = 0, len = bossBombs.length; i < len; i++) {
        const b = bossBombs[i];
        if (doUpdate) b.update(deltaTime);
        if (doDraw && isInView(b.pos.x, b.pos.y)) b.draw(ctx);
    }

    // Guided missiles - always update (tracking), cull drawing
    for (let i = 0, len = guidedMissiles.length; i < len; i++) {
        const m = guidedMissiles[i];
        if (doUpdate) m.update(deltaTime);
        if (doDraw && isInView(m.pos.x, m.pos.y)) m.draw(ctx);
    }

    // Particles - always update, cull drawing (high volume)
    // Particles - always update, cull drawing (high volume)
    for (let i = 0, len = particles.length; i < len; i++) {
        const p = particles[i];
        try {
            if (doUpdate) p.update(deltaTime);
            if (doDraw) {
                if (isInView(p.pos.x, p.pos.y, 20)) p.draw(ctx, particleRes, alpha);
                else if (typeof p.cull === 'function') p.cull();
            }
        } catch (e) {
            // Particles are cheap, just kill on error
            p.life = 0;
        }
    }

    // Staggered bomb explosions - process queued explosions over multiple frames
    // This prevents sprite pool exhaustion and frame spikes when boss dies
    if (doUpdate) {
        processStaggeredBombExplosions();
        processStaggeredParticleBursts();
    }

    // Explosions - always update, cull drawing
    // Explosions are always updated and cleaned up even if off-screen
    for (let i = 0, len = explosions.length; i < len; i++) {
        const ex = explosions[i];
        try {
            if (doUpdate) ex.update();
            if (doDraw && isInView(ex.pos.x, ex.pos.y)) {
                ex.draw(ctx, particleRes, alpha);
            }
            // Always cleanup dead explosions to release sprites back to pool
            // This fixes a bug where sprites accumulated when explosions died while in view
            if (ex.dead && !ex.cleaned && particleRes && particleRes.pool) {
                ex.cleanup(particleRes);
            }
        } catch (e) {
            console.error('[EXPLOSION ERROR]', e);
            ex.dead = true;
            if (typeof ex.cleanup === 'function') ex.cleanup(particleRes);
            else if (typeof pixiCleanupObject === 'function') pixiCleanupObject(ex);
        }
    }

    for (let i = 0; i < warpParticles.length; i++) {
        const p = warpParticles[i];
        if (doUpdate) p.update();
        if (doDraw) p.draw(ctx, null, alpha);
    }
    if (doUpdate) compactArray(warpParticles);

    for (let i = 0; i < shockwaves.length; i++) {
        const s = shockwaves[i];
        try {
            if (doUpdate) s.update();
            if (doDraw) s.draw(ctx);
        } catch (e) {
            console.error('[SHOCKWAVE ERROR]', e);
            s.dead = true; // Kill corrupted shockwave
        }
    }
    if (doUpdate) compactArray(shockwaves);
    globalProfiler.end('Entities');

    // [MOVED] Pixi overlay render moved to end of Draw block


    if (doUpdate) {
        globalProfiler.start('Cleanup');

        // Process staggered cleanup queue (spreads cleanup across frames)
        globalStaggeredCleanup.process();

        // Use immediate cleanup for critical arrays that need per-frame compacting
        // Use staggered cleanup for large arrays that can wait
        immediateCompactArray(bullets, (b) => {
            if (b._poolType === 'bullet' && b.sprite && pixiBulletSpritePool) destroyBulletSprite(b);
            else pixiCleanupObject(b);
        });
        immediateCompactArray(bossBombs);
        immediateCompactArray(guidedMissiles, (m) => {
            if (m && m.dead && typeof m.explode === 'function' && !m._exploded) {
                m.explode('#ff0');
            }
            pixiCleanupObject(m);
        });
        immediateCompactArray(enemies, pixiCleanupObject);
        immediateCompactArray(pinwheels, pixiCleanupObject);
        immediateCompactArray(environmentAsteroids);

        // Explosion cleanup with safety check for uncleaned sprites
        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            if (ex && ex.dead && !ex.cleaned && particleRes && particleRes.pool) {
                // Force cleanup of dead explosions that weren't cleaned during draw
                ex.cleanup(particleRes);
            }
        }
        immediateCompactArray(explosions);

        immediateCompactArray(floatingTexts);
        immediateCompactArray(coins);

        // Safety: Force cleanup of dead pickups that didn't clean themselves
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (coin && coin.dead && coin.sprite) {
                coin.kill();
            }
        }

        immediateCompactArray(nuggets);

        // Safety: Force cleanup of dead nuggets that didn't clean themselves
        for (let i = nuggets.length - 1; i >= 0; i--) {
            const nugget = nuggets[i];
            if (nugget && nugget.dead && nugget.sprite) {
                nugget.kill();
            }
        }

        immediateCompactArray(powerups);

        // Safety: Force cleanup of dead pickups that didn't clean themselves
        for (let i = powerups.length - 1; i >= 0; i--) {
            const powerup = powerups[i];
            if (powerup && powerup.dead && powerup.sprite) {
                powerup.kill();
            }
        }

        compactParticles(particles);
        immediateCompactArray(shootingStars, pixiCleanupObject);
        immediateCompactArray(drones);

        // Safety: Force cleanup of dead caches that didn't clean themselves
        for (let i = caches.length - 1; i >= 0; i--) {
            const cache = caches[i];
            if (cache && cache.dead && cache.sprite) {
                if (typeof cache.kill === 'function') cache.kill();
            }
        }
        immediateCompactArray(caches);
        immediateCompactArray(pois);
        immediateCompactArray(contractEntities.beacons);
        immediateCompactArray(contractEntities.gates);
        immediateCompactArray(contractEntities.anomalies);
        immediateCompactArray(contractEntities.fortresses);
        immediateCompactArray(contractEntities.wallTurrets);

        globalProfiler.end('Cleanup');

        globalProfiler.start('EntityCollision');
        resolveEntityCollision();
        globalProfiler.end('EntityCollision');

        // Bullet Logic Loop
        globalProfiler.start('BulletLogic');
        setProjectileImpactSoundContext(true);
        try {
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                let hit = false;
                const astCol = checkBulletWallCollision(b);
                if (astCol) {
                    hit = true;
                    b.dead = true;
                    if (astCol.obj) {
                        astCol.obj.break();
                        spawnParticles(b.pos.x, b.pos.y, 8, '#aa8');
                        playSound('hit');
                    } else {
                        // Warp/anomaly line walls: bullets just fizzle.
                        const wallColor = (astCol.kind === 'anomaly_wall') ? '#0f0' : (astCol.kind === 'cave_wall' ? '#88f' : '#0ff');
                        spawnParticles(b.pos.x, b.pos.y, 6, wallColor);
                        playSound('hit');
                    }
                }

                if (!hit) {
                    if (b.isEnemy) {
                        if (!player.dead && player.invulnerable <= 0) {
                            const dx = b.pos.x - player.pos.x;
                            const dy = b.pos.y - player.pos.y;
                            const distSq = dx * dx + dy * dy;
                            const dist = Math.sqrt(distSq); // Only calc sqrt if needed for specific range checks, but kept here for logic flow

                            if (!hit && player.outerShieldSegments && player.outerShieldSegments.some(s => s > 0) &&
                                dist < player.outerShieldRadius + b.radius * 1.5 && dist > player.outerShieldRadius - b.radius * 2) {
                                let angle = Math.atan2(b.pos.y - player.pos.y, b.pos.x - player.pos.x) - player.outerShieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const count = player.outerShieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                if (player.outerShieldSegments[segIndex] > 0) {
                                    player.outerShieldSegments[segIndex] = 0;
                                    player.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 7, '#b0f');
                                }
                            }
                            if (!hit && dist < player.shieldRadius + b.radius * 1.5 && dist > player.shieldRadius - b.radius * 2) {
                                let angle = Math.atan2(b.pos.y - player.pos.y, b.pos.x - player.pos.x) - player.shieldRotation;
                                while (angle < 0) angle += Math.PI * 2;
                                const count = player.shieldSegments.length;
                                const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                if (player.shieldSegments[segIndex] > 0) {
                                    player.shieldSegments[segIndex]--;
                                    player.shieldsDirty = true;
                                    hit = true;
                                    playSound('shield_hit');
                                    spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                                }
                            }
                            const hitDist = player.radius * 1.5 + b.radius * 1.5;
                            if (!hit && distSq < hitDist * hitDist) {
                                player.takeHit(b.damage, true); // Use ignoreShields=true as they were checked above
                                hit = true;
                            }
                        }
                    }
                    else {
                        for (let mi = 0, mlen = guidedMissiles.length; mi < mlen; mi++) {
                            const m = guidedMissiles[mi];
                            if (!m || m.dead) continue;
                            const dx = b.pos.x - m.pos.x;
                            const dy = b.pos.y - m.pos.y;
                            const hitRad = (m.radius || 0) + (b.radius || 0);
                            if (dx * dx + dy * dy < hitRad * hitRad) {
                                if (typeof m.takeHit === 'function') m.takeHit(b.damage);
                                else if (typeof m.explode === 'function') m.explode('#ff0');
                                else m.dead = true;
                                hit = true;
                                b.dead = true;
                                break;
                            }
                        }

                        if (hit) continue;
                        const nearby = targetGrid.query(b.pos.x, b.pos.y, 250);
                        for (let e of nearby) {
                            if (e.dead) continue;
                            if (hit) break;

                            // Shooting Star (Comet) Logic
                            if (e instanceof ShootingStar) {
                                if (b.isEnemy) continue;
                                const dx = b.pos.x - e.pos.x;
                                const dy = b.pos.y - e.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const hitRadius = e.radius + b.radius;
                                if (distSq < hitRadius * hitRadius) {
                                    e.takeHit(b.damage);
                                    hit = true;
                                    b.dead = true;
                                    spawnParticles(b.pos.x, b.pos.y, 4, '#fff');
                                    break;
                                }
                            }
                            // Enemy Logic
                            if (e instanceof Enemy) {
                                const dx = b.pos.x - e.pos.x;
                                const dy = b.pos.y - e.pos.y;
                                const distSq = dx * dx + dy * dy;
                                const dist = Math.sqrt(distSq);

                                if (!b.ignoreShields && e.shieldSegments && e.shieldSegments.length > 0 && dist < e.shieldRadius + b.radius && dist > e.shieldRadius - 10) {
                                    const activeIdx = e.shieldSegments.findIndex(s => s > 0);
                                    if (activeIdx !== -1) {
                                        e.shieldSegments[activeIdx] = 0;
                                        e.shieldsDirty = true;
                                        hit = true;
                                        playSound('enemy_shield_hit');
                                        spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                                    }
                                }
                                if (!hit && !b.ignoreShields && e.innerShieldSegments && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + b.radius && dist > e.innerShieldRadius - 10) {
                                    const activeIdx = e.innerShieldSegments.findIndex(s => s > 0);
                                    if (activeIdx !== -1) {
                                        e.innerShieldSegments[activeIdx] = Math.max(0, e.innerShieldSegments[activeIdx] - 1);
                                        e.shieldsDirty = true;
                                        hit = true;
                                        playSound('enemy_shield_hit');
                                        spawnParticles(b.pos.x, b.pos.y, 3, '#ff0');
                                    }
                                }

                                const hitRadius = e.radius + b.radius;
                                if (!hit && distSq < hitRadius * hitRadius) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(e.pos.x, e.pos.y, 3, '#fff');
                                    if (e.hp <= 0) {
                                        e.kill();
                                        score += 100;
                                    }
                                    break;
                                }
                            }
                            // Wall Turret Logic (Contracts)
                            else if (e instanceof WallTurret) {
                                const wtDx = b.pos.x - e.pos.x;
                                const wtDy = b.pos.y - e.pos.y;
                                const wtHitRad = e.radius + b.radius;
                                if (wtDx * wtDx + wtDy * wtDy < wtHitRad * wtHitRad) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#ff8');
                                    if (e.hp <= 0) {
                                        if (typeof e.kill === 'function') e.kill();
                                        else e.dead = true;
                                    }
                                    break;
                                }
                            }
                            // Warp Turret Logic
                            else if (e instanceof WarpTurret) {
                                const wpDx = b.pos.x - e.pos.x;
                                const wpDy = b.pos.y - e.pos.y;
                                const wpHitRad = e.radius + b.radius;
                                if (wpDx * wpDx + wpDy * wpDy < wpHitRad * wpHitRad) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#0ff');
                                    if (e.hp <= 0) e.kill();
                                    break;
                                }
                            }
                            // Pinwheel Logic
                            else if (e instanceof Pinwheel) {
                                const dist = Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y);
                                if (!b.ignoreShields && dist < e.shieldRadius + 5 && dist > e.shieldRadius - 15) {
                                    let angle = Math.atan2(b.pos.y - e.pos.y, b.pos.x - e.pos.x) - e.shieldRotation;
                                    while (angle < 0) angle += Math.PI * 2;
                                    const segCount = e.shieldSegments.length;
                                    const segIndex = Math.floor((angle / (Math.PI * 2)) * segCount) % segCount;
                                    if (e.shieldSegments[segIndex] > 0) {
                                        e.shieldSegments[segIndex]--;
                                        e.shieldsDirty = true;
                                        hit = true;
                                        playSound('enemy_shield_hit');
                                        if (e.shieldSegments[segIndex] === 0) spawnParticles(b.pos.x, b.pos.y, 8, '#0ff');
                                        else spawnParticles(b.pos.x, b.pos.y, 3, '#088');
                                        e.aggro = true;
                                        break;
                                    }
                                }
                                if (!b.ignoreShields && e.innerShieldSegments.length > 0 && dist < e.innerShieldRadius + 5 && dist > e.innerShieldRadius - 15) {
                                    let angle = Math.atan2(b.pos.y - e.pos.y, b.pos.x - e.pos.x) - e.innerShieldRotation;
                                    while (angle < 0) angle += Math.PI * 2;
                                    const count = e.innerShieldSegments.length;
                                    const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                                    if (e.innerShieldSegments[segIndex] > 0) {
                                        e.innerShieldSegments[segIndex]--;
                                        e.shieldsDirty = true;
                                        hit = true;
                                        playSound('shield_hit');
                                        if (e.innerShieldSegments[segIndex] === 0) spawnParticles(b.pos.x, b.pos.y, 8, '#f0f');
                                        else spawnParticles(b.pos.x, b.pos.y, 3, '#808');
                                        e.aggro = true;
                                        break;
                                    }
                                }

                                if (dist < e.radius + b.radius) {
                                    e.hp -= b.damage;
                                    hit = true;
                                    e.aggro = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                                    if (e.hp <= 0) {
                                        e.dead = true;
                                        playSound('base_explode');
                                        spawnLargeExplosion(e.pos.x, e.pos.y, 2.0);

                                        // DROP COINS
                                        const caveActive = (caveMode && caveLevel && caveLevel.active);
                                        if (caveActive) {
                                            const gold = Math.floor((6 * 5) * 0.5);
                                            awardCoinsInstant(gold, { noSound: false, sound: 'coin', color: '#ff0' });
                                            const baseNugCount = 4 + Math.floor(Math.random() * 3);
                                            const nugCount = Math.max(1, Math.floor(baseNugCount * 0.5));
                                            if (typeof awardNugzInstant === 'function') awardNugzInstant(nugCount, { noSound: false, sound: 'coin', color: '#fa0' });
                                        } else {
                                            for (let i = 0; i < 6; i++) {
                                                coins.push(new Coin(e.pos.x + (Math.random() - 0.5) * 50, e.pos.y + (Math.random() - 0.5) * 50, 5));
                                            }
                                            nuggets.push(new SpaceNugget(e.pos.x, e.pos.y, 1));
                                        }

                                        pinwheelsDestroyed++;
                                        pinwheelsDestroyedTotal++;
                                        difficultyTier = 1 + Math.floor(pinwheelsDestroyedTotal / 6);
                                        score += 1000;
                                        const bdDisplay = document.getElementById('bases-display');
                                        if (bdDisplay) bdDisplay.innerText = `${pinwheelsDestroyedTotal}`;

                                        enemies.forEach(en => { if (en.assignedBase === e) en.type = 'roamer'; });

                                        const delay = 5000 + Math.random() * 5000;
                                        baseRespawnTimers.push(Date.now() + delay);
                                    }
                                    break;
                                }
                            }
                        }
                    }





                    // Only player bullets can hit cave wall turrets
                    if (!hit && !b.isEnemy && caveMode && caveLevel && caveLevel.active && caveLevel.wallTurrets && caveLevel.wallTurrets.length > 0) {
                        for (let t of caveLevel.wallTurrets) {
                            if (!t || t.dead) continue;
                            if (typeof t.hitByPlayerBullet === 'function') {
                                if (t.hitByPlayerBullet(b)) { hit = true; break; }
                            } else {
                                const dist = Math.hypot(b.pos.x - t.pos.x, b.pos.y - t.pos.y);
                                if (dist < t.radius + b.radius) {
                                    t.hp -= b.damage;
                                    hit = true;
                                    playSound('hit');
                                    spawnParticles(b.pos.x, b.pos.y, 6, '#88f');
                                    if (t.hp <= 0) {
                                        if (typeof t.kill === 'function') t.kill();
                                        else t.dead = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    // Only player bullets can hit cave switches
                    if (!hit && !b.isEnemy && caveMode && caveLevel && caveLevel.active && caveLevel.switches && caveLevel.switches.length > 0) {
                        for (let s of caveLevel.switches) {
                            if (!s || s.dead) continue;
                            if (typeof s.hitByPlayerBullet === 'function' && s.hitByPlayerBullet(b)) { hit = true; break; }
                        }
                    }

                    // Only player bullets can hit cave relays
                    if (!hit && !b.isEnemy && caveMode && caveLevel && caveLevel.active && caveLevel.relays && caveLevel.relays.length > 0) {
                        for (let r of caveLevel.relays) {
                            if (!r || r.dead) continue;
                            if (typeof r.hitByPlayerBullet === 'function' && r.hitByPlayerBullet(b)) { hit = true; break; }
                        }
                    }

                    // Only player bullets can hit cave critters
                    if (!hit && !b.isEnemy && caveMode && caveLevel && caveLevel.active && caveLevel.critters && caveLevel.critters.length > 0) {
                        for (let c of caveLevel.critters) {
                            if (!c || c.dead) continue;
                            const dist = Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y);
                            if (dist < c.radius + b.radius) {
                                c.dead = true;
                                hit = true;
                                spawnParticles(c.pos.x, c.pos.y, 18, '#6f6');
                                playSound('explode');
                                // Disturbance: nearby turrets react. 
                                if (caveLevel.wallTurrets && caveLevel.wallTurrets.length > 0) {
                                    for (let t of caveLevel.wallTurrets) {
                                        if (!t || t.dead) continue;
                                        const dt = Math.hypot(t.pos.x - c.pos.x, t.pos.y - c.pos.y);
                                        if (dt < 900) {
                                            t.reload = Math.min(t.reload || 0, 10);
                                            t.beamCooldown = Math.min(t.beamCooldown || 0, 30);
                                            t.trackerCharge = Math.min(t.trackerCharge || 0, 30);
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }

                    // Only player bullets can hit the space station
                    if (!hit && !b.isEnemy && spaceStation && !spaceStation.dead) {
                        const dist = Math.hypot(b.pos.x - spaceStation.pos.x, b.pos.y - spaceStation.pos.y);

                        // Check if outer shields have any segments up
                        const outerShieldsUp = spaceStation.shieldSegments && spaceStation.shieldSegments.some(s => s > 0);
                        const innerShieldsUp = spaceStation.innerShieldSegments && spaceStation.innerShieldSegments.some(s => s > 0);

                        // Outer shield collision - bullet is within or touching the outer shield radius
                        if (!hit && !b.ignoreShields && outerShieldsUp && dist < spaceStation.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - spaceStation.pos.y, b.pos.x - spaceStation.pos.x) - spaceStation.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = spaceStation.shieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (spaceStation.shieldSegments[idx] > 0) {
                                spaceStation.shieldSegments[idx]--;
                                spaceStation.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                            }
                        }
                        // Inner shield collision - bullet is within or touching the inner shield radius
                        if (!hit && !b.ignoreShields && innerShieldsUp && dist < spaceStation.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - spaceStation.pos.y, b.pos.x - spaceStation.pos.x) - spaceStation.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = spaceStation.innerShieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (spaceStation.innerShieldSegments[idx] > 0) {
                                spaceStation.innerShieldSegments[idx]--;
                                spaceStation.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                            }
                        }
                        // Hull damage: allowed if shields are bypassed or down
                        if (!hit && dist < spaceStation.radius + b.radius) {
                            spaceStation.hp -= b.damage;
                            hit = true;
                            playSound('hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#fff');
                            if (spaceStation.hp <= 0) {
                                handleSpaceStationDestroyed();
                            }
                        }
                    }

                    // Only player bullets (!b.isEnemy) can hit destroyer
                    if (!hit && !b.isEnemy && destroyer && !destroyer.dead) {
                        const dist = Math.hypot(b.pos.x - destroyer.pos.x, b.pos.y - destroyer.pos.y);
                        // Destroy bullet if it hits invulnerable destroyer's shield radius
                        if (destroyer.invulnerable > 0 && dist < destroyer.shieldRadius + b.radius) {
                            hit = true;
                            playSound('shield_hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                        }
                        const outerUp = destroyer.shieldSegments && destroyer.shieldSegments.some(s => s > 0);
                        const innerUp = destroyer.innerShieldSegments && destroyer.innerShieldSegments.some(s => s > 0);
                        if (!hit && !b.ignoreShields && outerUp && dist < destroyer.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - destroyer.pos.y, b.pos.x - destroyer.pos.x) - destroyer.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = destroyer.shieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (destroyer.shieldSegments[idx] > 0) {
                                destroyer.shieldSegments[idx]--;
                                destroyer.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#0ff');
                            }
                        }
                        if (!hit && !b.ignoreShields && innerUp && dist < destroyer.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - destroyer.pos.y, b.pos.x - destroyer.pos.x) - destroyer.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = destroyer.innerShieldSegments.length;
                            const idx = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (destroyer.innerShieldSegments[idx] > 0) {
                                destroyer.innerShieldSegments[idx]--;
                                destroyer.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#f0f');
                            }
                        }
                        if (!hit && dist < destroyer.radius + b.radius) {
                            destroyer.hp -= b.damage;
                            hit = true;
                            playSound('hit');
                            spawnParticles(b.pos.x, b.pos.y, 5, '#ff0');
                            if (destroyer.hp <= 0) {
                                destroyer.kill();
                            }
                        }
                    }

                    // Only player bullets (!b.isEnemy) can hit the boss
                    if (!hit && !b.isEnemy && bossActive && boss && !boss.dead) {
                        const dist = Math.hypot(b.pos.x - boss.pos.x, b.pos.y - boss.pos.y);

                        // Check if shields have any segments up
                        const outerShieldsUp = boss.shieldSegments && boss.shieldSegments.some(s => s > 0);
                        const innerShieldsUp = boss.innerShieldSegments && boss.innerShieldSegments.length > 0 && boss.innerShieldSegments.some(s => s > 0);

                        // Outer shield collision - bullet is within the shield radius
                        if (!hit && !b.ignoreShields && outerShieldsUp && dist < boss.shieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - boss.pos.y, b.pos.x - boss.pos.x) - boss.shieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const segCount = boss.shieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * segCount) % segCount;
                            if (boss.shieldSegments[segIndex] > 0) {
                                boss.shieldSegments[segIndex]--;
                                boss.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 3, '#0ff');
                            }
                        }
                        // Inner shield collision - bullet is within the inner shield radius
                        if (!hit && !b.ignoreShields && innerShieldsUp && dist < boss.innerShieldRadius + b.radius) {
                            let angle = Math.atan2(b.pos.y - boss.pos.y, b.pos.x - boss.pos.x) - boss.innerShieldRotation;
                            while (angle < 0) angle += Math.PI * 2;
                            const count = boss.innerShieldSegments.length;
                            const segIndex = Math.floor((angle / (Math.PI * 2)) * count) % count;
                            if (boss.innerShieldSegments[segIndex] > 0) {
                                boss.innerShieldSegments[segIndex]--;
                                boss.shieldsDirty = true;
                                hit = true;
                                playSound('shield_hit');
                                spawnParticles(b.pos.x, b.pos.y, 3, '#f0f');
                            }
                        }

                        // If shields are bypassed or down, allow hardpoints and hull damage
                        if (!hit) {
                            // Hardpoints take damage when shields are down (or bypassed)
                            if (typeof boss.applyPlayerBulletHit === 'function') {
                                if (boss.applyPlayerBulletHit(b)) {
                                    hit = true;
                                }
                            }

                            // Hull damage
                            if (!hit && boss.hitTestCircle(b.pos.x, b.pos.y, b.radius)) {
                                const dmg = (boss.vulnerableTimer && boss.vulnerableTimer > 0) ? (b.damage * 2) : b.damage;
                                boss.hp -= dmg;
                                hit = true;
                                playSound('hit');
                                spawnParticles(b.pos.x, b.pos.y, 5, '#f00');
                                if (boss.hp <= 0) {
                                    boss.kill(); // Drops coins
                                    score += 10000;
                                }
                            }
                        }
                    }




                }

                if (hit) {
                    destroyBulletSprite(b);
                    bullets.splice(i, 1);
                }
            }
        } catch (e) {
            console.error('[BULLET LOGIC ERROR]', e);
        } finally {
            setProjectileImpactSoundContext(false);
            globalProfiler.end('BulletLogic');
        }
    }
    if (doUpdate) globalProfiler.end('Update');

    if (doDraw) {
        globalProfiler.start('Draw');
        // Draw cave boundaries on top.
        if (caveActive && caveLevel) {
            caveLevel.updatePixi();
            caveLevel.drawEntities(ctx, camX, camY, height, zoom);
        }

        ctx.restore();

        // Clear UI Canvas for this frame (still used for boss HUD and other elements)
        uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

        // Clear Pixi UI graphics and text objects from previous frame
        if (pixiArrowsGraphics) pixiArrowsGraphics.clear();
        clearPixiUiText();

        drawStationIndicator();
        drawDestroyerIndicator();
        drawWarpGateIndicator();
        drawMinimap();
        drawContractIndicator();
        drawMiniEventIndicator();
        updateMiniEventUI();
        if (bossActive && boss && typeof boss.drawBossHud === 'function') boss.drawBossHud(uiCtx);

        // Render Pixi overlay (MOVED from Update loop)
        if (pixiApp && pixiApp.renderer && pixiApp.stage) {
            globalProfiler.start('PixiRender');
            try { pixiApp.renderer.render(pixiApp.stage); } catch (e) { }
            globalProfiler.end('PixiRender');
        }
    }
    if (doDraw) globalProfiler.end('Draw');
    globalProfiler.end('GameLoopLogic');
}

// Helper function to transform polygon vertices
function transformPolygon(vertices, x, y, scale, rotation) {
    const cos = Math.cos(rotation) * scale;
    const sin = Math.sin(rotation) * scale;
    const result = [];
    for (let i = 0; i < vertices.length; i += 2) {
        const vx = vertices[i];
        const vy = vertices[i + 1];
        result.push(
            x + (vx * cos - vy * sin),
            y + (vx * sin + vy * cos)
        );
    }
    return result;
}

// Array to hold temporary text objects for cleanup
let pixiUiTextObjects = [];

function clearPixiUiText() {
    for (const text of pixiUiTextObjects) {
        if (text && text.parent) {
            text.parent.removeChild(text);
            text.destroy({ children: true });
        }
    }
    pixiUiTextObjects = [];
}

function drawStationIndicator() {
    if (!spaceStation || !player || !pixiArrowsGraphics) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    // Check if on screen (approximate bounds)
    const z = currentZoom || ZOOM_LEVEL;
    const camX = player.pos.x - screenW / (2 * z);
    const camY = player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    // If center of station is within view (plus a bit of margin), don't draw arrow
    if (spaceStation.pos.x > camX && spaceStation.pos.x < camX + viewW &&
        spaceStation.pos.y > camY && spaceStation.pos.y < camY + viewH) {
        return;
    }

    const dx = spaceStation.pos.x - player.pos.x;
    const dy = spaceStation.pos.y - player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;

    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    // Intersect ray from center with screen bounding box inset by margin
    const bx = cx - margin;
    const by = cy - margin;

    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS with manually transformed vertices
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0x00ffff);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ffff,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawDestroyerIndicator() {
    if (!destroyer || !player || destroyer.dead || !pixiArrowsGraphics) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    // Check if on screen (approximate bounds)
    const z = currentZoom || ZOOM_LEVEL;
    const camX = player.pos.x - screenW / (2 * z);
    const camY = player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    // If center of destroyer is within view (plus a bit of margin), don't draw arrow
    if (destroyer.pos.x > camX && destroyer.pos.x < camX + viewW &&
        destroyer.pos.y > camY && destroyer.pos.y < camY + viewH) {
        return;
    }

    const dx = destroyer.pos.x - player.pos.x;
    const dy = destroyer.pos.y - player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;

    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    // Intersect ray from center with screen bounding box inset by margin
    const bx = cx - margin;
    const by = cy - margin;

    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Color based on destroyer type
    const isDestroyer2 = destroyer.displayName === "DESTROYER II";
    const indicatorColor = isDestroyer2 ? 0xff0000 : 0xff8000;

    // Draw arrow using PixiJS with manually transformed vertices
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(indicatorColor);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const label = isDestroyer2 ? 'DESTROYER II ' : 'DESTROYER ';
    const text = new PIXI.Text(label + (dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: indicatorColor,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawWarpGateIndicator() {
    if (!warpGate || !player || player.dead || warpGate.dead || !pixiArrowsGraphics) return;
    if (warpGate.mode !== 'entry') return;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = currentZoom || ZOOM_LEVEL;
    const camX = player.pos.x - screenW / (2 * z);
    const camY = player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (warpGate.pos.x > camX && warpGate.pos.x < camX + viewW &&
        warpGate.pos.y > camY && warpGate.pos.y < camY + viewH) {
        return;
    }

    const dx = warpGate.pos.x - player.pos.x;
    const dy = warpGate.pos.y - player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty);

    const arrowX = cx + vx * t;
    const arrowY = cy + vy * t;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0xff8800);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text (two lines: "WARP" and distance)
    const dist = Math.hypot(dx, dy);
    const text1 = new PIXI.Text("WARP", {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text1.anchor.set(0.5, 1);
    text1.position.set(arrowX, arrowY - 18);
    pixiUiOverlayLayer.addChild(text1);
    pixiUiTextObjects.push(text1);

    const text2 = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text2.anchor.set(0.5, 0);
    text2.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text2);
    pixiUiTextObjects.push(text2);
}

// Flagship warp zone removed - no longer needed
function drawContractIndicator() {
    if (!activeContract || !player || player.dead || !pixiArrowsGraphics) return;
    let tx = null, ty = null;
    if (activeContract.type === 'gate_run' && contractEntities.gates.length > 0) {
        const idx = activeContract.gateIndex || 0;
        const g = contractEntities.gates[idx];
        if (g && !g.dead) { tx = g.pos.x; ty = g.pos.y; }
    } else if (activeContract.target) {
        tx = activeContract.target.x; ty = activeContract.target.y;
    } else if (contractEntities.beacons.length > 0) {
        tx = contractEntities.beacons[0].pos.x; ty = contractEntities.beacons[0].pos.y;
    }
    if (tx === null || ty === null) return;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = currentZoom || ZOOM_LEVEL;
    const camX = player.pos.x - screenW / (2 * z);
    const camY = player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

    const dx = tx - player.pos.x;
    const dy = ty - player.pos.y;
    const angle = Math.atan2(dy, dx);

    // Match the space-station indicator style/position (edge, pulsing, distance readout).
    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const tEdge = Math.min(txEdge, tyEdge);

    const arrowX = cx + vx * tEdge;
    const arrowY = cy + vy * tEdge;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0x00ff00);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

function drawMiniEventIndicator() {
    if (!miniEvent || miniEvent.dead || !player || player.dead || !pixiArrowsGraphics) return;

    let tx = miniEvent.pos.x;
    let ty = miniEvent.pos.y;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = currentZoom || ZOOM_LEVEL;
    const camX = player.pos.x - screenW / (2 * z);
    const camY = player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

    const dx = tx - player.pos.x;
    const dy = ty - player.pos.y;
    const angle = Math.atan2(dy, dx);

    const margin = 60;
    const cx = screenW / 2;
    const cy = screenH / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    const bx = cx - margin;
    const by = cy - margin;
    const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
    const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
    const tEdge = Math.min(txEdge, tyEdge);

    const arrowX = cx + vx * tEdge;
    const arrowY = cy + vy * tEdge;

    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
    const blink = (Math.sin(Date.now() * 0.012) > 0.2) ? 1 : 0.55;

    // Draw arrow using PixiJS
    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0xffff00, blink);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    // Distance Text
    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xffff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    text.alpha = blink;
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

// Minimap position constants (bottom-right corner of screen)
const MINIMAP_SIZE = 200;
const MINIMAP_RADIUS = 100;
const MINIMAP_OFFSET = 20;

function drawMinimap() {
    if (!pixiMinimapGraphics) return;
    minimapFrame++;
    if (minimapFrame % 2 === 1) return; // throttle updates

    // Clear previous graphics
    pixiMinimapGraphics.clear();

    // Position minimap in bottom-right corner
    const screenW = canvas.width;
    const screenH = canvas.height;
    const minimapX = screenW - MINIMAP_SIZE - MINIMAP_OFFSET;
    const minimapY = screenH - MINIMAP_SIZE - MINIMAP_OFFSET;
    const centerX = minimapX + MINIMAP_RADIUS;
    const centerY = minimapY + MINIMAP_RADIUS;

    // Draw circular background with cyan outline
    pixiMinimapGraphics.lineStyle(2, 0x00ffff);  // Cyan outline
    pixiMinimapGraphics.beginFill(0x000011);
    pixiMinimapGraphics.drawCircle(centerX, centerY, MINIMAP_RADIUS);
    pixiMinimapGraphics.endFill();

    // Create a circular mask for clipping (reused each frame)
    // We'll manually clip by checking bounds for each element

    const warpActive = !!(warpZone && warpZone.active);
    const radarRange = warpActive ? ((warpZone.boundaryRadius || 6200) + 300) : 4000;
    const scale = MINIMAP_RADIUS / radarRange;
    const refX = warpActive ? warpZone.pos.x : (player ? player.pos.x : 0);
    const refY = warpActive ? warpZone.pos.y : (player ? player.pos.y : 0);

    // Helper to check if point is in circular bounds
    const inBounds = (x, y) => (x * x + y * y) <= (MINIMAP_RADIUS * MINIMAP_RADIUS);

    // Draw player
    if (player && !player.dead) {
        const px = warpActive ? ((player.pos.x - refX) * scale) : 0;
        const py = warpActive ? ((player.pos.y - refY) * scale) : 0;
        pixiMinimapGraphics.beginFill(0x00ff00);
        pixiMinimapGraphics.drawCircle(centerX + px, centerY + py, 3);
        pixiMinimapGraphics.endFill();
    }

    // Warp maze walls + turrets
    if (warpActive && warpZone) {
        const segs = (typeof warpZone.allSegments === 'function') ? warpZone.allSegments() : [];
        pixiMinimapGraphics.lineStyle(1, 0x00ffff, 0.65);
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const x0 = (s.x0 - refX) * scale;
            const y0 = (s.y0 - refY) * scale;
            const x1 = (s.x1 - refX) * scale;
            const y1 = (s.y1 - refY) * scale;
            if (Math.abs(x0) > 120 && Math.abs(x1) > 120 && Math.abs(y0) > 120 && Math.abs(y1) > 120) continue;
            pixiMinimapGraphics.moveTo(centerX + x0, centerY + y0);
            pixiMinimapGraphics.lineTo(centerX + x1, centerY + y1);
        }

        if (warpZone.turrets && warpZone.turrets.length > 0) {
            pixiMinimapGraphics.beginFill(0x00ffff);
            for (let i = 0; i < warpZone.turrets.length; i++) {
                const t = warpZone.turrets[i];
                if (!t || t.dead) continue;
                const dx = (t.pos.x - refX) * scale;
                const dy = (t.pos.y - refY) * scale;
                if (inBounds(dx, dy)) {
                    pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
                }
            }
            pixiMinimapGraphics.endFill();
        }

        if (warpGate && !warpGate.dead) {
            const dx = (warpGate.pos.x - refX) * scale;
            const dy = (warpGate.pos.y - refY) * scale;
            pixiMinimapGraphics.lineStyle(2, 0xff8800, 0.9);
            pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 7);
        }
    }

    // Environment asteroids
    pixiMinimapGraphics.lineStyle(1, 0x005500);
    environmentAsteroids.forEach(a => {
        if (player) {
            const dx = (a.pos.x - refX) * scale;
            const dy = (a.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, Math.max(1, a.radius * scale));
            }
        }
    });

    // Enemies
    pixiMinimapGraphics.beginFill(0xff0000);
    enemies.forEach(e => {
        if (player) {
            const dx = (e.pos.x - refX) * scale;
            const dy = (e.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    // Bases
    pixiMinimapGraphics.beginFill(0xff00ff);
    pinwheels.forEach(b => {
        if (player) {
            const dx = (b.pos.x - refX) * scale;
            const dy = (b.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 5);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    // Boss
    if (bossActive && boss && !boss.dead && player) {
        const dx = (boss.pos.x - refX) * scale;
        const dy = (boss.pos.y - refY) * scale;
        pixiMinimapGraphics.beginFill(0xff0000);
        pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 8);
        pixiMinimapGraphics.endFill();
    }

    // Radiation storm
    if (!warpActive && radiationStorm && !radiationStorm.dead && player) {
        const dx = radiationStorm.pos.x - player.pos.x;
        const dy = radiationStorm.pos.y - player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        pixiMinimapGraphics.lineStyle(2, 0xffdc00, 0.7);
        if (dist * scale > 95) {
            const px = Math.cos(angle) * 90;
            const py = Math.sin(angle) * 90;
            pixiMinimapGraphics.beginFill(0xffff00);
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            pixiMinimapGraphics.endFill();
        } else {
            pixiMinimapGraphics.drawCircle(centerX + dx * scale, centerY + dy * scale, Math.max(4, radiationStorm.radius * scale));
        }
    }

    // Coins
    pixiMinimapGraphics.beginFill(0xffff00);
    coins.forEach(c => {
        if (player) {
            const dx = (c.pos.x - player.pos.x) * scale;
            const dy = (c.pos.y - player.pos.y) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx, centerY + dy, 1, 1);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    // Powerups
    pixiMinimapGraphics.beginFill(0x00ff00);
    powerups.forEach(p => {
        if (player) {
            const dx = (p.pos.x - player.pos.x) * scale;
            const dy = (p.pos.y - player.pos.y) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    // POIs
    if (player && pois && pois.length > 0) {
        for (const p of pois) {
            if (!p || p.dead || p.claimed) continue;
            const dx = p.pos.x - player.pos.x;
            const dy = p.pos.y - player.pos.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const inRange = (dist * scale <= 95);
            const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
            const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);
            const color = colorToHex(p.color || '#0ff');
            pixiMinimapGraphics.beginFill(color);
            if (inRange) {
                pixiMinimapGraphics.drawCircle(centerX + px, centerY + py, 4);
            } else {
                drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            }
            pixiMinimapGraphics.endFill();
        }
    }

    // Space station
    if (spaceStation && player) {
        const dx = spaceStation.pos.x - player.pos.x;
        const dy = spaceStation.pos.y - player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        pixiMinimapGraphics.beginFill(0xffffff);
        if (dist * scale > 95) {
            const px = Math.cos(angle) * 90;
            const py = Math.sin(angle) * 90;
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        } else {
            const mx = dx * scale;
            const my = dy * scale;
            pixiMinimapGraphics.drawCircle(centerX + mx, centerY + my, 6);
        }
        pixiMinimapGraphics.endFill();
    }

    // Destroyer indicator on minimap
    if (!warpActive && player && destroyer && !destroyer.dead) {
        const dx = destroyer.pos.x - player.pos.x;
        const dy = destroyer.pos.y - player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const color = destroyer.displayName === "DESTROYER II" ? 0xffff00 : 0xff8800;

        const inRange = (dist * scale <= 95);
        const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
        const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

        pixiMinimapGraphics.beginFill(color);
        drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        pixiMinimapGraphics.endFill();
    }

    // Contract target indicator on minimap
    if (!warpActive && player && activeContract) {
        let tx = null, ty = null;
        if (activeContract.type === 'gate_run' && contractEntities.gates.length > 0) {
            const idx = activeContract.gateIndex || 0;
            const g = contractEntities.gates[idx];
            if (g && !g.dead) { tx = g.pos.x; ty = g.pos.y; }
        } else if (activeContract.target) {
            tx = activeContract.target.x; ty = activeContract.target.y;
        } else if (contractEntities.beacons.length > 0) {
            tx = contractEntities.beacons[0].pos.x; ty = contractEntities.beacons[0].pos.y;
        }

        if (tx !== null && ty !== null) {
            const dx = tx - player.pos.x;
            const dy = ty - player.pos.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const inRange = (dist * scale <= 95);
            const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
            const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

            pixiMinimapGraphics.beginFill(0x00ff00);
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            pixiMinimapGraphics.endFill();
        }
    }

    // Mini-event indicator on minimap
    if (!warpActive && player && miniEvent && !miniEvent.dead) {
        let tx = miniEvent.pos.x, ty = miniEvent.pos.y;
        const dx = tx - player.pos.x;
        const dy = ty - player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const inRange = (dist * scale <= 95);
        const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
        const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

        pixiMinimapGraphics.beginFill(0xffff00);
        drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        pixiMinimapGraphics.endFill();
    }
}

// Helper function to draw arrows on the minimap
function drawMinimapArrow(gfx, x, y, angle, length, width) {
    const tipX = x + Math.cos(angle) * length;
    const tipY = y + Math.sin(angle) * length;
    const leftX = x + Math.cos(angle + 2.5) * width;
    const leftY = y + Math.sin(angle + 2.5) * width;
    const rightX = x + Math.cos(angle - 2.5) * width;
    const rightY = y + Math.sin(angle - 2.5) * width;
    gfx.drawPolygon([tipX, tipY, leftX, leftY, rightX, rightY]);
}

// Helper function to convert color string to hex number
function colorToHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return 0xffffff;
    if (colorStr.startsWith('#')) {
        return parseInt(colorStr.slice(1), 16);
    }
    // Handle named colors (basic subset)
    const colors = {
        'cyan': 0x00ffff, 'magenta': 0xff00ff, 'yellow': 0xffff00,
        'red': 0xff0000, 'green': 0x00ff00, 'blue': 0x0000ff,
        'white': 0xffffff, 'black': 0x000000, 'orange': 0xff8800
    };
    return colors[colorStr.toLowerCase()] || 0xffffff;
}


function startGame() {
    console.log('[DEBUG] startGame() called');
    try {
        resetWarpState();
        resetCaveState();
        warpCompletedOnce = false;
        // Always reset audio state to normal before a new run 
        setMusicMode('normal');
        gameMode = 'normal';
        simNowMs = 0; // Reset simulation clock for new game logic
        arcadeBoss = null;
        arcadeWave = 0;
        arcadeWaveNextAt = 0;
        currentZoom = ZOOM_LEVEL;
        stopMusic();
        if (player) pixiCleanupObject(player);
        player = new Spaceship();
        score = 0;
        difficultyTier = 1;
        pinwheelsDestroyedTotal = 0;
        bossActive = false;
        if (boss) pixiCleanupObject(boss);
        boss = null;
        bossArena.active = false;
        bossArena.growing = false;
        stopArenaCountdown();
        cruiserEncounterCount = 0;
        cruiserTimerPausedAt = null;
        dreadManager.upgradesChosen = 0;
        dreadManager.firstSpawnDone = false;
        dreadManager.timerActive = true;
        dreadManager.timerAt = Date.now() + dreadManager.minDelayMs + Math.floor(Math.random() * (dreadManager.maxDelayMs - dreadManager.minDelayMs + 1));
        rerollTokens = metaProfile.purchases.rerollTokens || 0;
        metaExtraLifeAvailable = !!metaProfile.purchases.extraLife;

        // Reset player stats/inventory
        player.fireDelay = 24;

        player.turretLevel = 1;
        player.canWarp = false;
        player.shieldSegments = new Array(8).fill(2);
        player.outerShieldSegments = new Array(12).fill(2);
        player.hp = player.maxHp;
        player.inventory = {};
        player.xp = 0;
        player.level = 1;
        player.nextLevelXp = 100;
        player.stats = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            shotgunFireRateMult: 1.0,
            rangeMult: 1.0,
            multiShot: 1,
            homing: 0,
            shieldRegenRate: 8, // seconds per segment baseline
            hpRegenAmount: 1,
            hpRegenRate: 10,
            speedMult: 1.0,
            slowField: 0,
            slowFieldDuration: 0
        };
        player.lastHpRegenTime = Date.now();
        player.staticWeapons = [];
        player.nukeMaxCooldown = 600;
        player.magnetRadius = 150;
        player.nukeUnlocked = false;
        gameEnded = false;

        // Setup game world (clear all entities)
        setupGameWorld();

        // Apply meta bonuses
        if (metaProfile.purchases.startDamage) {
            player.stats.damageMult *= 1.2; // starter damage bump
        }
        if (metaProfile.purchases.passiveHp) {
            player.maxHp += 10;
            player.hp = player.maxHp;
            updateHealthUI();
        }
        if (metaProfile.purchases.hullPlating) {
            player.maxHp += 15;
            player.hp = player.maxHp;
        }
        if (metaProfile.purchases.shieldCore) {
            player.shieldSegments.push(2, 2);
            player.maxShieldSegments = player.shieldSegments.length;
        }
        if (metaProfile.purchases.staticBlueprint) {
            player.staticWeapons.push({ type: 'forward' });
        }
        if (metaProfile.purchases.missilePrimer) {
            player.stats.homing = Math.max(player.stats.homing, 1);
            player.missileTimer = 0;
        }
        if (metaProfile.purchases.magnetBooster) {
            player.magnetRadius = Math.max(player.magnetRadius, 300);
        }
        if (metaProfile.purchases.nukeCapacitor) {
            player.nukeUnlocked = true;
            player.nukeCooldown = 0;
            player.nukeDamage = 5;
            player.nukeRange = 500;
        }
        if (metaProfile.purchases.speedTuning) {
            player.stats.speedMult *= 1.1;
        }
        if (metaProfile.purchases.droneFabricator) {
            spawnDrone('shooter');
        }
        if (pendingProfile) {
            applyProfile(pendingProfile);
        }
        updateHealthUI();

        document.getElementById('score').innerText = score;
        document.getElementById('start-screen').style.display = 'none';
        const endScreen = document.getElementById('end-screen');
        if (endScreen) endScreen.style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        gameActive = true;
        gamePaused = false;
        canResumeGame = false; // New game - can't resume yet

        // Update resume button state
        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }

        setupGameWorld();
        updateContractUI();

        if (musicEnabled) {
            initAudio();
            startMusic();
        }
    } catch (e) {
        console.error('[STARTGAME ERROR]', e);
    }
}

function shiftPausedTimers(pauseMs) {
    if (!pauseMs || pauseMs <= 0) return;
    const shiftIfNumber = (val) => (typeof val === 'number' && isFinite(val) && val > 0) ? (val + pauseMs) : val;
    const shiftArrayNumbers = (arr) => {
        if (!Array.isArray(arr)) return arr;
        for (let i = 0; i < arr.length; i++) {
            if (typeof arr[i] === 'number' && isFinite(arr[i]) && arr[i] > 0) arr[i] += pauseMs;
        }
        return arr;
    };

    warpCountdownAt = shiftIfNumber(warpCountdownAt);
    nextContractAt = shiftIfNumber(nextContractAt);
    nextSpaceStationTime = shiftIfNumber(nextSpaceStationTime);
    gunboatRespawnAt = shiftIfNumber(gunboatRespawnAt);
    nextShootingStarTime = shiftIfNumber(nextShootingStarTime);
    nextRadiationStormAt = shiftIfNumber(nextRadiationStormAt);
    nextMiniEventAt = shiftIfNumber(nextMiniEventAt);
    nextIntensityBreakAt = shiftIfNumber(nextIntensityBreakAt);
    initialSpawnDelayAt = shiftIfNumber(initialSpawnDelayAt);

    asteroidRespawnTimers = shiftArrayNumbers(asteroidRespawnTimers);
    baseRespawnTimers = shiftArrayNumbers(baseRespawnTimers);

    if (dreadManager && dreadManager.timerActive && typeof dreadManager.timerAt === 'number') {
        dreadManager.timerAt += pauseMs;
    }
    if (cruiserTimerPausedAt !== null && typeof cruiserTimerPausedAt === 'number') {
        cruiserTimerPausedAt += pauseMs;
    }
    if (radiationStorm && typeof radiationStorm.endsAt === 'number') {
        radiationStorm.endsAt += pauseMs;
    }
    if (miniEvent) {
        if (typeof miniEvent.expiresAt === 'number') miniEvent.expiresAt += pauseMs;
        if (typeof miniEvent.nextWaveAt === 'number') miniEvent.nextWaveAt += pauseMs;
        if (typeof miniEvent.lastUpdateAt === 'number') miniEvent.lastUpdateAt += pauseMs;
    }
    if (activeContract && typeof activeContract.endsAt === 'number') {
        activeContract.endsAt += pauseMs;
    }
}

// Global function to update resume button state
// This is defined globally so it can be called from anywhere in the code
const updateResumeButtonState = () => {
    const resumeBtn = document.getElementById('resume-btn-start');
    if (resumeBtn) {
        if (canResumeGame) {
            resumeBtn.disabled = false;
            resumeBtn.style.opacity = '1';
            resumeBtn.style.cursor = 'pointer';
        } else {
            resumeBtn.disabled = true;
            resumeBtn.style.opacity = '0.5';
            resumeBtn.style.cursor = 'not-allowed';
        }
    }
};

// Store globally so it can be called from anywhere in the code
window.updateResumeButtonState = updateResumeButtonState;

function togglePause() {
    if (!gameActive) return;
    const wasPaused = gamePaused;
    gamePaused = !gamePaused;
    document.getElementById('pause-menu').style.display = gamePaused ? 'block' : 'none';
    // Pause timer bookkeeping
    if (gamePaused) {
        pauseStartTime = getGameNowMs();
        if (arenaCountdownActive) stopArenaCountdown();
    } else {
        if (pauseStartTime) {
            const pauseMs = Math.max(0, getGameNowMs() - pauseStartTime);
            if (pauseMs > 0) {
                pausedAccumMs += pauseMs;
                shiftPausedTimers(pauseMs);
            }
            pauseStartTime = null;
        }
    }
    if (gamePaused) {
        setTimeout(() => {
            document.getElementById('resume-btn').focus();
            menuSelectionIndex = 0;
        }, 100);
    }
    else if (musicEnabled) startMusic();
}

function quitGame() {
    // Pause the game and show the start menu overlay
    if (!gamePaused) {
        gamePaused = true;
        pauseStartTime = getGameNowMs();
    }
    stopArenaCountdown();
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    const endScreen = document.getElementById('end-screen');
    if (endScreen) endScreen.style.display = 'none';
    document.querySelector('#start-screen h1').innerText = "PAUSED";
    document.getElementById('start-btn').innerText = "INITIATE LAUNCH";
    setTimeout(() => document.getElementById('resume-btn-start').focus(), 100);
    menuSelectionIndex = 0;

    // Mark that we can resume this game
    canResumeGame = gameActive;

    // Update resume button state based on whether we can resume
    const updateResumeButtonState = () => {
        const resumeBtn = document.getElementById('resume-btn-start');
        if (resumeBtn) {
            if (canResumeGame) {
                resumeBtn.disabled = false;
                resumeBtn.style.opacity = '1';
                resumeBtn.style.cursor = 'pointer';
            } else {
                resumeBtn.disabled = true;
                resumeBtn.style.opacity = '0.5';
                resumeBtn.style.cursor = 'not-allowed';
            }
        }
    };
    updateResumeButtonState();

    // Store the update function so it can be called when game starts/stops
    window.updateResumeButtonState = updateResumeButtonState;
}

window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
    if (e.key === ' ') keys.space = true;
    if (e.key === 'e' || e.key === 'E') keys.e = true;
    if (e.key === 'Shift') keys.shift = true;
    if (e.key === 'Escape') togglePause();
    // Debug: instantly destroy space station (Ctrl+Shift+K)
    if (e.ctrlKey && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        handleSpaceStationDestroyed();
    }
    // Debug: jump straight to Sector 2 cave (Ctrl+Shift+2) 
    if (e.ctrlKey && e.shiftKey && (e.code === 'Digit2' || e.code === 'Numpad2')) {
        e.preventDefault();
        const doJump = () => {
            if (!gameActive || !player || player.dead) return;
            // Force a sector warp completion into sector 2. 
            sectorTransitionActive = false;
            warpCountdownAt = null;
            sectorIndex = 1;
            showOverlayMessage("DEBUG: ENTERING SECTOR 2 CAVE", '#0ff', 1200, 5);
            completeSectorWarp();
        };
        if (!gameActive) {
            startGame();
            setTimeout(doJump, 60);
        } else {
            if (gamePaused) togglePause();
            doJump();
        }
    }
    // Debug: jump directly into the warp maze (Ctrl+Shift+W)
    if (e.ctrlKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (!gameActive || gamePaused || !player || player.dead) return;
        if (warpZone && warpZone.active) {
            showOverlayMessage("ALREADY IN WARP", '#ff0', 900);
        } else {
            enterWarpMaze();
        }
    }
    // Debug: force-exit warp maze back to world (Ctrl+Shift+Q)
    if (e.ctrlKey && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        if (!gameActive || !player) return;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.key === ' ') keys.space = false;
    if (e.key === 'e' || e.key === 'E') keys.e = false;
    if (e.key === 'Shift') keys.shift = false;
});

window.addEventListener('mousemove', e => {
    const now = Date.now();
    const dx = Math.abs(e.clientX - mouseScreen.x);
    const dy = Math.abs(e.clientY - mouseScreen.y);
    // Ignore tiny pointer jitter so it doesn't steal aim from the gamepad.
    if (dx + dy >= 10) lastMouseInputAt = now;
    updateInputMode(now);
    if (typeof mouseScreen !== 'undefined') {
        mouseScreen.x = e.clientX;
        mouseScreen.y = e.clientY;
    }
    if (player) {
        const z = currentZoom || ZOOM_LEVEL;
        const camX = player.pos.x - width / (2 * z);
        const camY = player.pos.y - height / (2 * z);
        mouseWorld.x = (e.clientX / z) + camX;
        mouseWorld.y = (e.clientY / z) + camY;
    }
});

window.addEventListener('mousedown', (e) => {
    mouseState.down = true;
});

window.addEventListener('mouseup', () => {
    mouseState.down = false;
});

window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected");
    gamepadIndex = e.gamepad.index;
    initAudio();
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
    lastGamepadInputAt = 0;
    updateInputMode(Date.now());
});

document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    startGame();
});

const resumeStartBtn = document.getElementById('resume-btn-start');
if (resumeStartBtn) {
    resumeStartBtn.addEventListener('click', () => {
        initAudio();
        // Hide start screen and resume the game
        document.getElementById('start-screen').style.display = 'none';

        // Unpause the game (same logic as togglePause)
        if (gamePaused && pauseStartTime) {
            const pauseMs = Math.max(0, getGameNowMs() - pauseStartTime);
            if (pauseMs > 0) {
                pausedAccumMs += pauseMs;
                shiftPausedTimers(pauseMs);
            }
            pauseStartTime = null;
        }
        gamePaused = false;

        if (musicEnabled) startMusic();
        showOverlayMessage("RESUMED", '#0f0', 1500);

        // Once resumed, can't resume again until quitting to menu
        canResumeGame = false;

        // Update resume button state
        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }
    });

    // Initialize resume button state on page load
    // It should start disabled until you quit to menu from pause menu
    window.updateResumeButtonState();
}

const loadBtn = document.getElementById('load-btn');
if (loadBtn) loadBtn.addEventListener('click', () => {
    initAudio();
    loadGameFromStorage();
});

const upgradesBtn = document.getElementById('upgrades-btn');
const upgradesBackBtn = document.getElementById('upgrades-back-btn');
if (upgradesBtn) {
    upgradesBtn.addEventListener('click', () => {
        initAudio();
        // Show upgrades menu (similar to levelup menu but from start menu)
        showUpgradesMenu();
    });
}
if (upgradesBackBtn) {
    upgradesBackBtn.addEventListener('click', () => {
        // Hide upgrades menu
        document.getElementById('upgrades-menu').style.display = 'none';
        document.getElementById('upgrades-menu').style.visibility = 'hidden';

        // Show start screen
        document.getElementById('start-screen').style.display = 'block';
        document.getElementById('start-screen').style.visibility = 'visible';

        // Clear all menu selections
        const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
        allMenuElements.forEach(el => {
            el.classList.remove('selected');
            if (el.tagName === 'BUTTON') el.blur();
        });

        // Wait one frame then setup start screen navigation
        requestAnimationFrame(() => {
            menuSelectionIndex = 0;
            const active = getActiveMenuElements();
            if (active.length > 0) {
                updateMenuVisuals(active);
                active[0].focus();
            }
            // Prevent input during menu transition
            menuDebounce = Date.now() + 300;
        });
    });
}

function showUpgradesMenu() {
    // Hide all menus first
    const levelupScreen = document.getElementById('levelup-screen');
    if (levelupScreen) levelupScreen.style.display = 'none';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.style.display = 'none';
        startScreen.style.visibility = 'hidden';
    }
    const upgradesMenu = document.getElementById('upgrades-menu');
    if (upgradesMenu) {
        upgradesMenu.style.display = 'block';
        upgradesMenu.style.visibility = 'visible';
    }

    // Clear any previous menu selections
    const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
    allMenuElements.forEach(el => {
        el.classList.remove('selected');
        if (el.tagName === 'BUTTON') el.blur();
    });

    // Update meta UI to show current values
    updateMetaUI();

    menuSelectionIndex = 0;
    menuDebounce = Date.now() + 300;

    // Wait one frame to ensure DOM has updated, then setup navigation
    requestAnimationFrame(() => {
        const active = getActiveMenuElements();
        if (active.length > 0) {
            updateMenuVisuals(active);
            // Force focus on the first button
            active[0].focus();
        }
    });
}
const newProfileBtn = document.getElementById('new-profile-btn');
if (newProfileBtn) newProfileBtn.addEventListener('click', () => {
    if (confirm("Reset profile? This clears all nugs/stats and saved profiles.")) {
        wipeProfiles();
    }
});
const buyStart = document.getElementById('buy-start-dmg');
if (buyStart) buyStart.addEventListener('click', () => {
    const cost = Math.ceil(10 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.startDamage) {
        metaProfile.bank -= cost;
        metaProfile.purchases.startDamage = true;
        saveMetaProfile();
        showOverlayMessage("START DAMAGE UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 10 NUGS OR ALREADY OWNED", '#f00', 1500);
    }
});
const buyPassive = document.getElementById('buy-passive-hp');
if (buyPassive) buyPassive.addEventListener('click', () => {
    const cost = Math.ceil(15 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.passiveHp) {
        metaProfile.bank -= cost;
        metaProfile.purchases.passiveHp = true;
        saveMetaProfile();
        showOverlayMessage("PASSIVE HP UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 15 NUGS OR ALREADY OWNED", '#f00', 1500);
    }
});
const buyReroll = document.getElementById('buy-reroll');
if (buyReroll) buyReroll.addEventListener('click', () => {
    const cost = Math.ceil(5 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost) {
        metaProfile.bank -= cost;
        metaProfile.purchases.rerollTokens = (metaProfile.purchases.rerollTokens || 0) + 1;
        saveMetaProfile();
        showOverlayMessage("REROLL TOKEN +1", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 5 NUGS", '#f00', 1500);
    }
});
const buyRerollPack = document.getElementById('buy-reroll-pack');
if (buyRerollPack) buyRerollPack.addEventListener('click', () => {
    const cost = Math.ceil(25 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost) {
        metaProfile.bank -= cost;
        metaProfile.purchases.rerollTokens = (metaProfile.purchases.rerollTokens || 0) + 5;
        saveMetaProfile();
        showOverlayMessage("REROLL TOKENS +5", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 25 NUGS", '#f00', 1500);
    }
});
const buyHull = document.getElementById('buy-hull');
if (buyHull) buyHull.addEventListener('click', () => {
    const cost = Math.ceil(30 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.hullPlating) {
        metaProfile.bank -= cost;
        metaProfile.purchases.hullPlating = true;
        saveMetaProfile();
        showOverlayMessage("HULL PLATING UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 30 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyShield = document.getElementById('buy-shield-core');
if (buyShield) buyShield.addEventListener('click', () => {
    const cost = Math.ceil(30 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.shieldCore) {
        metaProfile.bank -= cost;
        metaProfile.purchases.shieldCore = true;
        saveMetaProfile();
        showOverlayMessage("SHIELD CORE UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 30 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyStatic = document.getElementById('buy-static');
if (buyStatic) buyStatic.addEventListener('click', () => {
    const cost = Math.ceil(40 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.staticBlueprint) {
        metaProfile.bank -= cost;
        metaProfile.purchases.staticBlueprint = true;
        saveMetaProfile();
        showOverlayMessage("STATIC BLUEPRINT UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 40 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyMissile = document.getElementById('buy-missile');
if (buyMissile) buyMissile.addEventListener('click', () => {
    const cost = Math.ceil(40 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.missilePrimer) {
        metaProfile.bank -= cost;
        metaProfile.purchases.missilePrimer = true;
        saveMetaProfile();
        showOverlayMessage("MISSILE PRIMER UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 40 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyMagnet = document.getElementById('buy-magnet');
if (buyMagnet) buyMagnet.addEventListener('click', () => {
    const cost = Math.ceil(25 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.magnetBooster) {
        metaProfile.bank -= cost;
        metaProfile.purchases.magnetBooster = true;
        saveMetaProfile();
        showOverlayMessage("MAGNET BOOSTER UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 25 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyNuke = document.getElementById('buy-nuke');
if (buyNuke) buyNuke.addEventListener('click', () => {
    const cost = Math.ceil(35 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.nukeCapacitor) {
        metaProfile.bank -= cost;
        metaProfile.purchases.nukeCapacitor = true;
        saveMetaProfile();
        showOverlayMessage("NUKE CAPACITOR UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 35 NUGS OR OWNED", '#f00', 1500);
    }
});
const buySpeed = document.getElementById('buy-speed');
if (buySpeed) buySpeed.addEventListener('click', () => {
    const cost = Math.ceil(25 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.speedTuning) {
        metaProfile.bank -= cost;
        metaProfile.purchases.speedTuning = true;
        saveMetaProfile();
        showOverlayMessage("SPEED TUNING UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 25 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyBankMult = document.getElementById('buy-bank-mult');
if (buyBankMult) buyBankMult.addEventListener('click', () => {
    const cost = Math.ceil(50 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.bankMultiplier) {
        metaProfile.bank -= cost;
        metaProfile.purchases.bankMultiplier = true;
        saveMetaProfile();
        showOverlayMessage("BANK MULTIPLIER UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 50 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyDiscount = document.getElementById('buy-discount');
if (buyDiscount) buyDiscount.addEventListener('click', () => {
    const cost = Math.ceil(50 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.shopDiscount) {
        metaProfile.bank -= cost;
        metaProfile.purchases.shopDiscount = true;
        saveMetaProfile();
        showOverlayMessage("SHOP DISCOUNT UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 50 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyExtraLife = document.getElementById('buy-extra-life');
if (buyExtraLife) buyExtraLife.addEventListener('click', () => {
    const cost = Math.ceil(60 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.extraLife) {
        metaProfile.bank -= cost;
        metaProfile.purchases.extraLife = true;
        saveMetaProfile();
        showOverlayMessage("EXTRA LIFE UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 60 NUGS OR OWNED", '#f00', 1500);
    }
});
const buyDrone = document.getElementById('buy-drone');
if (buyDrone) buyDrone.addEventListener('click', () => {
    const cost = Math.ceil(40 * (metaProfile.purchases.shopDiscount ? 0.9 : 1));
    if (metaProfile.bank >= cost && !metaProfile.purchases.droneFabricator) {
        metaProfile.bank -= cost;
        metaProfile.purchases.droneFabricator = true;
        saveMetaProfile();
        showOverlayMessage("DRONE FABRICATOR UNLOCKED", '#0f0', 1500);
    } else {
        showOverlayMessage("NEED 40 NUGS OR OWNED", '#f00', 1500);
    }
});
document.getElementById('restart-btn').addEventListener('click', () => {
    initAudio();
    startGame();
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
const saveBtn = document.getElementById('save-btn');
if (saveBtn) saveBtn.addEventListener('click', () => {
    saveGame();
});
const pauseLoadBtn = document.getElementById('pause-load-btn');
if (pauseLoadBtn) pauseLoadBtn.addEventListener('click', () => {
    loadGameFromStorage();
});
const pauseRestartBtn = document.getElementById('restart-btn-pause');
if (pauseRestartBtn) pauseRestartBtn.addEventListener('click', () => {
    startGame();
});
document.getElementById('quit-btn').addEventListener('click', quitGame);
document.getElementById('music-btn').addEventListener('click', toggleMusic);


// --- Settings Menu Logic ---

const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsApplyBtn = document.getElementById('settings-apply-btn');
const resSelect = document.getElementById('res-select');
const fullscreenCheck = document.getElementById('fullscreen-check');
const framelessCheck = document.getElementById('frameless-check');

// Only enable if running in Electron environment with exposed API
const isElectron = window.SpacebrosApp && window.SpacebrosApp.settings;

if (settingsBtn) {
    if (!isElectron) {
        settingsBtn.style.display = 'none';
    } else {
        settingsBtn.addEventListener('click', async () => {
            openSettingsMenu();
        });
    }
}

// Make settings menu accessible from pause menu
const pauseSettingsBtn = document.getElementById('pause-settings-btn');
if (pauseSettingsBtn) {
    pauseSettingsBtn.addEventListener('click', openSettingsMenu);
}

async function openSettingsMenu() {
    const current = await window.SpacebrosApp.settings.get();
    if (current) {
        // Populate UI
        if (current.fullscreen) {
            fullscreenCheck.checked = true;
            resSelect.disabled = true;
        } else {
            fullscreenCheck.checked = false;
            resSelect.disabled = false;
            const resString = `${current.width}x${current.height}`;
            if ([...resSelect.options].some(o => o.value === resString)) {
                resSelect.value = resString;
            }
        }
        framelessCheck.checked = !!current.frameless;
    }

    // Set volume sliders to current values
    const musicVolumeSlider = document.getElementById('music-volume');
    const sfxVolumeSlider = document.getElementById('sfx-volume');
    const musicVolumeLabel = document.getElementById('music-volume-label');
    const sfxVolumeLabel = document.getElementById('sfx-volume-label');

    if (musicVolumeSlider && musicVolumeLabel) {
        musicVolumeSlider.value = Math.round(musicVolume * 100);
        musicVolumeLabel.textContent = `${musicVolumeSlider.value}%`;
    }
    if (sfxVolumeSlider && sfxVolumeLabel) {
        sfxVolumeSlider.value = Math.round(sfxVolume * 100);
        sfxVolumeLabel.textContent = `${sfxVolumeSlider.value}%`;
    }

    settingsMenu.style.display = 'block';

    // Disable pointer-events on pause menu when settings is open to prevent click-through
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu && gamePaused) {
        pauseMenu.style.pointerEvents = 'none';
    }
}

// Volume slider handlers
const musicVolumeSlider = document.getElementById('music-volume');
const sfxVolumeSlider = document.getElementById('sfx-volume');
const musicVolumeLabel = document.getElementById('music-volume-label');
const sfxVolumeLabel = document.getElementById('sfx-volume-label');

if (musicVolumeSlider) {
    musicVolumeSlider.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        setMusicVolume(value);
        musicVolumeLabel.textContent = `${e.target.value}%`;
    });
}

if (sfxVolumeSlider) {
    sfxVolumeSlider.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        setSfxVolume(value);
        sfxVolumeLabel.textContent = `${e.target.value}%`;
    });
}

if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
        settingsMenu.style.display = 'none';
        // If we were paused when opening settings, return to pause menu
        if (gamePaused) {
            const pauseMenu = document.getElementById('pause-menu');
            pauseMenu.style.display = 'block';
            pauseMenu.style.pointerEvents = 'auto';
        }
    });
}

if (settingsApplyBtn && isElectron) {
    settingsApplyBtn.addEventListener('click', async () => {
        const isFullscreen = fullscreenCheck.checked;
        const isFrameless = framelessCheck.checked;
        const [w, h] = resSelect.value.split('x').map(Number);

        // Get old settings to compare for restart requirement
        const old = await window.SpacebrosApp.settings.get();
        const framelessChanged = old.frameless !== isFrameless;

        // Save everything
        await window.SpacebrosApp.settings.save({
            width: w,
            height: h,
            fullscreen: isFullscreen,
            frameless: isFrameless
        });

        // Apply runtime changes
        window.SpacebrosApp.settings.setFullscreen(isFullscreen);
        if (!isFullscreen) {
            window.SpacebrosApp.settings.setResolution(w, h);
        }

        // Handle restart if frameless changed
        if (framelessChanged) {
            if (confirm("Changing window frame style requires a restart. Restart now?")) {
                window.SpacebrosApp.settings.relaunch();
            }
        } else {
            showOverlayMessage("SETTINGS SAVED", '#0f0', 1500);
            settingsMenu.style.display = 'none';
            if (gamePaused) {
                const pauseMenu = document.getElementById('pause-menu');
                pauseMenu.style.display = 'block';
                pauseMenu.style.pointerEvents = 'auto';
            }
        }
    });
}

if (fullscreenCheck) {
    fullscreenCheck.addEventListener('change', (e) => {
        resSelect.disabled = e.target.checked;
    });
}

// Desktop Quit Support
const qStart = document.getElementById('desktop-quit-start-btn');
const qPause = document.getElementById('desktop-quit-pause-btn');

if (qStart) {
    qStart.addEventListener('click', () => window.SpacebrosApp.settings.quit());
}
if (qPause) {
    qPause.addEventListener('click', () => {
        if (confirm("Quit to desktop? Any unsaved progress will be lost.")) {
            window.SpacebrosApp.settings.quit();
        }
    });
}

// Robust menu initialization for start screen
document.getElementById('levelup-screen').style.display = 'none';
document.getElementById('upgrades-menu').style.display = 'none';
document.getElementById('start-screen').style.display = 'block';

const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
allMenuElements.forEach(el => {
    el.classList.remove('selected');
    if (el.tagName === 'BUTTON') el.blur();
});

requestAnimationFrame(() => {
    menuSelectionIndex = 0;
    const initialActiveElements = getActiveMenuElements();
    if (initialActiveElements.length > 0) {
        updateMenuVisuals(initialActiveElements);
        initialActiveElements[0].focus();
    }
});

loadMetaProfile();
updateMetaUI();
mainLoop();
