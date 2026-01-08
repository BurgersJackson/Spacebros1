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
                { id: "homing_missiles", name: "Homing Missiles", tier1: "2x Missiles / 2s", tier2: "4x Missiles / 2s", tier3: "6x Missiles / 2s", notes: "Shield-piercing swarm." },
                { id: "volley_shot", name: "Volley Shot", tier1: "Auto-fires 3-shot burst every 3s", tier2: "5-shot burst every 3s", tier3: "7-shot burst every 3s", notes: "Automatic burst damage. No input required." },
                { id: "chain_lightning", name: "Chain Lightning", tier1: "Projectiles chain to 1 enemy (200u)", tier2: "Chain to 2 enemies (250u)", tier3: "Chain to 3 enemies (300u)", notes: "Arc damage hits grouped enemies. Great vs swarms." },
                { id: "backstabber", name: "Backstabber", tier1: "+50% damage from behind", tier2: "+100% damage from behind", tier3: "+150% damage, slow enemies 2s", notes: "Positioning matters. Flanking = huge damage." }
            ]
        },
        {
            name: "Shields & Hull",
            upgrades: [
                { id: "hull_strength", name: "Hull Strength", tier1: "+25 Max HP, Heal 25", tier2: "+25 Max HP, Heal 25", tier3: "+25 Max HP, Heal 25", notes: "Increases survival." },
                { id: "segment_count", name: "Segment Count", tier1: "+2 segments (total 10)", tier2: "+4 total (14)", tier3: "+8 total (18)", notes: "Larger shield bubble." },
                { id: "outer_shield", name: "Outer Shield", tier1: "6 purple segments", tier2: "8 segments (restore all)", tier3: "12 segments (restore all)", notes: "Extra rotating ring (1 HP/seg)." },
                { id: "shield_regen", name: "Shield Regen", tier1: "Regen 1 seg./5s", tier2: "1 seg./3s", tier3: "1 seg./1s", notes: "Sustain in long fights." },
                { id: "hp_regen", name: "Hull Regen", tier1: "Regen 1 HP / 5s", tier2: "Regen 2 HP / 5s", tier3: "Regen 3 HP / 5s", notes: "Slow passive healing." },
                { id: "reactive_shield", name: "Reactive Shield", tier1: "Shield segments restore on kill", tier2: "Restore 2 segments per kill", tier3: "Restore 3 segments, +25% shield HP", notes: "Offensive play heals shields. Aggressive sustain." },
                { id: "damage_mitigation", name: "Damage Mitigation", tier1: "-10% damage taken, +5% move speed", tier2: "-20% damage taken, +10% move speed", tier3: "-30% damage taken, +15% move speed", notes: "Tanky AND fast. General survivability." }
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
                { id: "slow_field", name: "Stasis Field", tier1: "Stops roamers 3s", tier2: "Stops 5s, +25% Area", tier3: "Stops 8s, +25% Area", notes: "Freezes enemies." },
                { id: "time_dilation", name: "Time Dilation", tier1: "Enemies move 20% slower near you", tier2: "40% slow, 300u radius", tier3: "60% slow, 450u radius", notes: "Passive danger zone. Easier dodging." },
                { id: "momentum", name: "Momentum", tier1: "Moving increases fire rate (+10%)", tier2: "+20% fire rate, +15% damage", tier3: "+30% fire rate, +25% damage", notes: "Keep moving to maximize DPS. Hit-and-run style." }
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

// --- Meta Shop Upgrade Descriptions ---
export const META_SHOP_UPGRADE_DATA = {
    startDamage: {
        name: "Start Damage Boost",
        description: "Increase turret damage for all future runs",
        tier1: "+10% base damage",
        tier2: "+20% base damage",
        tier3: "+35% base damage",
        notes: "Stacks with in-game damage upgrades. Foundation for DPS builds."
    },
    passiveHp: {
        name: "Passive +HP",
        description: "Start with more max health each run",
        tier1: "+5 max HP",
        tier2: "+10 max HP",
        tier3: "+15 max HP",
        notes: "Survivability boost. Helps tank early damage."
    },
    hullPlating: {
        name: "Hull Plating",
        description: "Significantly increase maximum hull HP",
        tier1: "+15 max HP",
        tier2: "+30 max HP",
        tier3: "+45 max HP",
        notes: "Major HP increase for tanky builds."
    },
    shieldCore: {
        name: "Shield Core",
        description: "Add permanent shield segments",
        tier1: "+2 shield segments",
        tier2: "+4 shield segments",
        tier3: "+6 shield segments",
        notes: "More shield segments = more damage absorption."
    },
    staticBlueprint: {
        name: "Static Blueprint",
        description: "Unlock always-on forward laser turret",
        tier1: "Unlock Forward Laser",
        tier2: "Add Side Lasers",
        tier3: "Add Rear Laser",
        notes: "Fires automatically at nearby enemies."
    },
    missilePrimer: {
        name: "Missile Primer",
        description: "Unlock homing missiles that auto-fire",
        tier1: "2x Missiles / 2s",
        tier2: "4x Missiles / 2s",
        tier3: "6x Missiles / 2s",
        notes: "Homing projectiles track enemies automatically."
    },
    magnetBooster: {
        name: "Magnet Booster",
        description: "Increase XP and pickup collection range",
        tier1: "300u magnet radius",
        tier2: "+50% range bonus",
        tier3: "+100% range bonus",
        notes: "Less chasing coins. Quality of life upgrade."
    },
    nukeCapacitor: {
        name: "Nuke Capacitor",
        description: "Unlock auto-firing area nuke ability",
        tier1: "500u blast, 5 damage",
        tier2: "600u blast, 10 damage",
        tier3: "800u blast, 15 damage",
        notes: "Fires automatically when cooldown ready."
    },
    speedTuning: {
        name: "Speed Tuning",
        description: "Increase maximum movement speed",
        tier1: "+10% max speed",
        tier2: "+20% max speed",
        tier3: "+30% max speed",
        notes: "Move faster, dodge better, kite more effectively."
    },
    bankMultiplier: {
        name: "Bank Multiplier",
        description: "Earn more Space Nuggets per run",
        tier1: "+25% nuggets",
        tier2: "+50% nuggets",
        tier3: "+75% nuggets",
        notes: "Faster meta progression."
    },
    shopDiscount: {
        name: "Shop Discount",
        description: "Reduce cost of all meta shop upgrades",
        tier1: "-10% cost",
        tier2: "-20% cost",
        tier3: "-30% cost",
        notes: "Applies to ALL purchases. Great value long-term."
    },
    extraLife: {
        name: "Extra Life",
        description: "Revive with 50% HP once per run",
        tier1: "1 extra life",
        tier2: "2 extra lives",
        tier3: "3 extra lives",
        notes: "Second chance when you would die."
    },
    droneFabricator: {
        name: "Drone Fabricator",
        description: "Unlock orbiting companion drones",
        tier1: "Unlock Shooter Drone",
        tier2: "Add Shield Drone",
        tier3: "Add Heal Drone",
        notes: "Drones orbit and assist automatically."
    },
    piercingRounds: {
        name: "Piercing Rounds",
        description: "Projectiles pierce through multiple enemies",
        tier1: "Pierce 1 enemy",
        tier2: "Pierce 2 enemies",
        tier3: "Pierce 3 enemies",
        notes: "Helps with clustered enemies. Synergizes with shotgun."
    },
    explosiveRounds: {
        name: "Explosive Rounds",
        description: "Projectiles create mini-explosions on impact",
        tier1: "20% chance (30 dmg, 200u)",
        tier2: "40% chance (30 dmg, 200u)",
        tier3: "60% chance (30 dmg, 200u)",
        notes: "Adds AoE damage. Satisfying feedback."
    },
    criticalStrike: {
        name: "Critical Strike",
        description: "Chance to deal double damage",
        tier1: "5% crit, 2x damage",
        tier2: "10% crit, 2x damage",
        tier3: "15% crit, 2x damage",
        notes: "Random spike damage. Exciting moments."
    },
    splitShot: {
        name: "Split Shot",
        description: "Each shot has chance to fire extra projectile",
        tier1: "10% chance to split",
        tier2: "20% chance to split",
        tier3: "30% chance to split",
        notes: "Visual chaos, increased crowd control."
    },
    thornArmor: {
        name: "Thorn Armor",
        description: "Reflect damage when hit",
        tier1: "Reflect 10%",
        tier2: "Reflect 15%",
        tier3: "Reflect 20%",
        notes: "Rewards aggressive play. Satisfying vs melee."
    },
    lifesteal: {
        name: "Lifesteal",
        description: "Heal when killing enemies",
        tier1: "Heal 1 HP per kill",
        tier2: "Heal 2 HP per kill",
        tier3: "Heal 3 HP per kill",
        notes: "Sustain through combat. Less healing pickup dependency."
    },
    evasionBoost: {
        name: "Evasion Boost",
        description: "Chance to avoid damage entirely",
        tier1: "5% evasion",
        tier2: "8% evasion",
        tier3: "12% evasion",
        notes: "RNG-based survival. Exciting close calls."
    },
    shieldRecharge: {
        name: "Shield Recharge",
        description: "Shield segments regenerate over time",
        tier1: "Regen 1 seg / 30s",
        tier2: "Regen 1 seg / 20s",
        tier3: "Regen 1 seg / 15s",
        notes: "Longer combat sustainability."
    },
    dashCooldown: {
        name: "Dash Cooldown",
        description: "Reduce turbo boost cooldown",
        tier1: "-1s cooldown (10s -> 9s)",
        tier2: "-2s cooldown",
        tier3: "-3s cooldown",
        notes: "More frequent mobility escapes."
    },
    dashDuration: {
        name: "Dash Duration",
        description: "Longer turbo boost duration",
        tier1: "+0.5s duration",
        tier2: "+1s duration",
        tier3: "+1.5s duration",
        notes: "Extended mobility windows."
    },
    xpMagnetPlus: {
        name: "XP Magnet+",
        description: "Increases magnet booster effectiveness",
        tier1: "+20% magnet radius",
        tier2: "+40% magnet radius",
        tier3: "+60% magnet radius",
        notes: "Stacks with base magnet booster."
    },
    autoReroll: {
        name: "Auto-Reroll",
        description: "Chance for free reroll on level-up",
        tier1: "10% chance",
        tier2: "20% chance",
        tier3: "30% chance",
        notes: "More build control. Less RNG frustration."
    },
    nuggetMagnet: {
        name: "Nugget Magnet",
        description: "Increase magnet for Space Nuggets specifically",
        tier1: "+50% nugget range",
        tier2: "+100% nugget range",
        tier3: "+150% nugget range",
        notes: "Easier premium currency collection."
    },
    contractSpeed: {
        name: "Contract Speed",
        description: "Contract objectives complete faster",
        tier1: "+10% speed",
        tier2: "+20% speed",
        tier3: "+30% speed",
        notes: "Faster contract completion, more variety."
    },
    startingRerolls: {
        name: "Starting Rerolls",
        description: "Start each run with free reroll tokens",
        tier1: "Start with 1 token",
        tier2: "Start with 2 tokens",
        tier3: "Start with 3 tokens",
        notes: "Better early-game build options."
    },
    luckyDrop: {
        name: "Lucky Drop",
        description: "Increased chance for rare pickups",
        tier1: "+5% health, +2% nugs",
        tier2: "+10% health, +4% nugs",
        tier3: "+15% health, +6% nugs",
        notes: "More resources, exciting drops."
    },
    bountyHunter: {
        name: "Bounty Hunter",
        description: "Bonus nuggets for elite/boss kills",
        tier1: "+5 nugs/elite, +20/boss",
        tier2: "+10 nugs/elite, +40/boss",
        tier3: "+15 nugs/elite, +60/boss",
        notes: "Rewards combat skill. Targets high-value enemies."
    },
    comboMeter: {
        name: "Combo Meter",
        description: "Damage increases with consecutive hits",
        tier1: "+1% per 10 stacks, max 10%",
        tier2: "+1.5% per 10, max 15%",
        tier3: "+2% per 10, max 20%",
        notes: "Rewards skilled play. Resets on damage taken."
    },
    startingWeapon: {
        name: "Starting Weapon",
        description: "Start with shotgun unlocked",
        tier1: "Start with tier 1 shotgun",
        tier2: "Start with tier 2 shotgun",
        tier3: "Start with tier 3 shotgun",
        notes: "Early-game power. Different start strategy."
    },
    secondWind: {
        name: "Second Wind",
        description: "Short invulnerability after taking damage",
        tier1: "0.5s i-frames",
        tier2: "1.0s i-frames",
        tier3: "1.5s i-frames",
        notes: "Forgiving for mistakes. Combo preservation."
    },
    batteryCapacitor: {
        name: "Battery Capacitor",
        description: "Stores energy over time. Discharge manually for massive AOE damage.",
        tier1: "500 dmg, 800u blast (30s charge)",
        tier2: "800 dmg, 900u blast (30s charge)",
        tier3: "1200 dmg, 1000u blast (30s charge)",
        notes: "Press F / Gamepad Y to discharge. Manual control only, never auto-fires."
    }
};
