/**
 * Core Constants & Configuration
 * Game balance, rendering settings, and static data.
 */

// --- Rendering Constants ---
export const ZOOM_LEVEL = 0.4;
export const SPRITE_RENDER_SCALE = 2.5; // Compensate for low zoom level

// --- Simulation Constants ---
// Game now uses variable timestep instead of fixed 60fps
// SIM_FPS is kept for backwards compatibility but not used for timing
export const SIM_FPS = 60;
export const SIM_STEP_MS = 1000 / SIM_FPS;
export const SIM_MAX_STEPS_PER_FRAME = 4; // Prevent spiral-of-death (fewer steps needed at 60Hz)

// --- Pixi Sprite Pool Limits ---
export const PIXI_SPRITE_POOL_MAX = 30000;

// --- Spatial Hash Settings ---
export const ASTEROID_GRID_CELL_SIZE = 300;

// --- Audio ---
export const BACKGROUND_MUSIC_URL = 'assets/sfx/background1.mp3';
export const ENABLE_PROJECTILE_IMPACT_SOUNDS = false;

// --- Asset URLs ---
export const ASSET_URLS = {
    // Player
    player1: 'assets/player1.png',

    // Enemies
    roamer: 'assets/roamer1.png',
    eliteRoamer: 'assets/roamer_elite.png',
    hunter: 'assets/hunter.png',
    defender: 'assets/defender.png',
    gunboat1: 'assets/gunboat1.png',
    gunboat2: 'assets/gunboat2.png',
    cruiser: 'assets/cruiser.png',

    // Bases
    base1: 'assets/base1.png',
    base2: 'assets/base2.png',
    base3: 'assets/base3.png',

    // Asteroids
    asteroid1: 'assets/asteroid1.png',
    asteroid2: 'assets/asteroid2.png',
    asteroid3: 'assets/asteroid3.png',
    asteroid2_U: 'assets/asteroid2_U.png', // Indestructible asteroid

    // Effects
    explosion1: 'assets/explosion1.png'
};

// --- Explosion Spritesheet ---
export const EXPLOSION1_COLS = 4;
export const EXPLOSION1_ROWS = 5;
export const EXPLOSION1_FRAMES = EXPLOSION1_COLS * EXPLOSION1_ROWS;
export const EXPLOSION1_FRAME_W = 1024 / EXPLOSION1_COLS;
export const EXPLOSION1_FRAME_H = 1024 / EXPLOSION1_ROWS;

// --- Player Hull ---
export const PLAYER_HULL_RENDER_SCALE = 2.5;
export const PLAYER_HULL_ROT_OFFSET = Math.PI / 2; // World angle 0=right, art is nose-up

// --- Pixi/Canvas Toggle ---
export const USE_PIXI_OVERLAY = true;
export const ENABLE_NEBULA = true;
export const NEBULA_ALPHA = 0.023;

// --- Upgrade Data ---
export const UPGRADE_DATA = {
    categories: [
        {
            name: "Weapons",
            upgrades: [
                { id: "turret_damage", name: "Turret Damage", tier1: "+20% damage", tier2: "+40% total", tier3: "+70% total", notes: "Core DPS boost." },
                { id: "turret_fire_rate", name: "Turret Fire Rate", tier1: "+15% RPS", tier2: "+30% total", tier3: "+50% total", notes: "Stacks multiplicatively." },
                { id: "turret_range", name: "Turret Range", tier1: "+25% range", tier2: "+50% total", tier3: "+100% total", notes: "Hits farther threats." },
                { id: "multi_shot", name: "Multi-Shot", tier1: "Fires 2 proj.", tier2: "Fires 3 proj.", tier3: "Fires 4 proj.", notes: "Parallel fire." },
                { id: "shotgun", name: "Flak Shotgun", tier1: "Unlock: 5 Pellets", tier2: "8 Pellets, +Range", tier3: "12 Pellets", notes: "Close-range burst." },
                { id: "static_weapons", name: "Static Weapons", tier1: "Unlock Forward Laser", tier2: "Add Side Lasers", tier3: "Add Rear Laser", tier4: "Dual Rear Stream", tier5: "Dual Front Stream", notes: "Always-on turrets." },
                { id: "homing_missiles", name: "Homing Missiles", tier1: "2x Missiles / 2s", tier2: "4x Missiles / 2s", tier3: "6x Missiles / 2s", notes: "Shield-piercing swarm." }
            ]
        },
        {
            name: "Shields & Hull",
            upgrades: [
                { id: "hull_strength", name: "Hull Strength", tier1: "+25 Max HP, Heal 25", tier2: "+25 Max HP, Heal 25", tier3: "+25 Max HP, Heal 25", notes: "Increases survival." },
                { id: "segment_count", name: "Segment Count", tier1: "+2 segments (total 10)", tier2: "+4 total (14)", tier3: "+8 total (18)", notes: "Larger shield bubble." },
                { id: "outer_shield", name: "Outer Shield", tier1: "6 purple segments", tier2: "8 segments (restore all)", tier3: "12 segments (restore all)", notes: "Extra rotating ring (1 HP/seg)." },
                { id: "shield_regen", name: "Shield Regen", tier1: "Regen 1 seg./5s", tier2: "1 seg./3s", tier3: "1 seg./1s", notes: "Sustain in long fights." },
                { id: "hp_regen", name: "Hull Regen", tier1: "Regen 1 HP / 5s", tier2: "Regen 2 HP / 5s", tier3: "Regen 3 HP / 5s", notes: "Slow passive healing." }
            ]
        },
        {
            name: "Mobility",
            upgrades: [
                { id: "speed", name: "Speed", tier1: "+15% max speed", tier2: "+30% total", tier3: "+50% total", notes: "Dodge better." },
                { id: "turbo_boost", name: "Turbo Boost", tier1: "+50% speed for 2s", tier2: "+50% speed for 3.5s", tier3: "+50% speed for 5s", notes: "Press E / Gamepad X." }
            ]
        },
        {
            name: "Specials",
            upgrades: [
                { id: "xp_magnet", name: "XP Magnet", tier1: "2x range", tier2: "4x range", tier3: "8x range", notes: "Faster leveling." },
                { id: "area_nuke", name: "Area Nuke", tier1: "Auto-fire 500u blast (5 dmg)", tier2: "600u range, 10 dmg", tier3: "800u range, 15 dmg", notes: "Auto-activates when ready." },
                { id: "invincibility", name: "Phase Shield", tier1: "3s Active / 20s CD", tier2: "5s Active / 15s CD", tier3: "7s Active / 10s CD + Regen", notes: "Auto-cycling invulnerability." },
                { id: "slow_field", name: "Stasis Field", tier1: "Stops roamers 3s", tier2: "Stops 5s, +25% Area", tier3: "Stops 8s, +25% Area", notes: "Freezes enemies." }
            ]
        },
        {
            name: "Drones",
            upgrades: [
                { id: "companion_drones", name: "Companion Drones", tier1: "Unlock Shooter Drone", tier2: "Add Shield Drone", tier3: "Add Heal Drone", notes: "Orbiting support bots." }
            ]
        }
    ]
};
