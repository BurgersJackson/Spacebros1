# Spacebros to MonoGame Migration Guide

This guide provides comprehensive information for porting the Spacebros 2D space shooter game from PixiJS/Canvas to MonoGame.

---

## Table of Contents

1. [Asteroids](#1-asteroids)
2. [Player Spaceship](#2-player-spaceship)
3. [Upgrade System](#3-upgrade-system)
4. [Enemies](#4-enemies)
5. [Bosses](#5-bosses)
6. [Projectiles](#6-projectiles)
7. [Game Loop Architecture](#7-game-loop-architecture)
8. [Collision Detection](#8-collision-detection)
9. [Particles](#9-particles)
10. [UI/HUD](#10-uihud)
11. [Asset References](#asset-references)

---

## 1. ASTEROIDS

### Class Structure
```csharp
public class EnvironmentAsteroid : Entity
{
    public int SizeLevel { get; set; } // 3=large, 2=medium, 1=small
    public bool Indestructible { get; set; }
    public bool Unbreakable { get; set; }
    public Vector2[] Vertices { get; set; }
    public float Angle { get; set; }
    public float RotSpeed { get; set; }
    public int EncounterCount { get; set; }
}
```

### Properties
- **SizeLevel**: 1 (small), 2 (medium), 3 (large)
- **Radius**: Varied based on size level
- **Indestructible**: If true, cannot be destroyed by player
- **Vertices**: Array of polygon vertices for procedural shapes

### Behavior
- **Movement**: Constant velocity vector
- **Rotation**: Constant angular velocity
- **Spawning**: Spawn relative to player with avoidance of pinwheels/base spawn areas
- **Splitting**: When destroyed at size level 3, breaks into 3 smaller asteroids (size 2)

### Collision
- Collision radius determined by polygon hull approximation
- In cave mode, follows scrolling background parallax

### Asset References
```
- asteroid1.png: Large asteroids (size 3)
- asteroid2.png: Medium asteroids (size 2)
- asteroid3.png: Small asteroids (size 1)
- asteroid2_U.png: Indestructible asteroid
```

---

## 2. PLAYER SPACESHIP

### Class Structure
```csharp
public class Spaceship : Entity
{
    public string ShipType { get; set; } // "standard" or "slacker"

    // Physics
    public float BaseThrust { get; set; }
    public float MaxSpeed { get; set; }
    public float RotationSpeed { get; set; }
    public float Friction { get; set; }

    // Stats (scaled with damage multiplier)
    public float DamageMult { get; set; } // Base 1.0, increased by upgrades
    public float FireRateMult { get; set; }
    public float ShotgunFireRateMult { get; set; }
    public float RangeMult { get; set; }
    public int MultiShot { get; set; }
    public int PiercingCount { get; set; }

    // Shield System
    public float ShieldRadius { get; set; }
    public int MaxShieldSegments { get; set; }
    public int[] ShieldSegments { get; set; } // Each segment has HP
    public int OuterShieldRadius { get; set; }
    public int MaxOuterShieldSegments { get; set; }
    public int[] OuterShieldSegments { get; set; }
    public float ShieldRotation { get; set; }
    public int[] InnerShieldSegments { get; set; }
    public int InnerShieldRadius { get; set; }

    // Progression
    public int Level { get; set; }
    public int Xp { get; set; }
    public int NextLevelXp { get; set; }
    public Dictionary<string, int> Inventory { get; set; }

    // Upgrades (from in-game pickups)
    public float SpeedMult { get; set; }
    public float TurboSpeedMult { get; set; }
    public float TurboDurationFrames { get; set; }
    public float TurboCooldownTotalFrames { get; set; }

    // Special Abilities
    public bool NukeUnlocked { get; set; }
    public float NukeDamage { get; set; }
    public float NukeRange { get; set; }

    public bool PhaseShieldUnlocked { get; set; }
    public float PhaseShieldDuration { get; set; }
    public float PhaseShieldCooldown { get; set; }
    public bool PhaseShieldRegen { get; set; }

    // Phase Shield State
    public int InvulnerableTimer { get; set; }

    // Turbo Boost
    public float ActiveTurboFrames { get; set; }
    public float CooldownTurboFrames { get; set; }
    public float DurationTurboFrames { get; set; }

    // Global Defense Ring
    public int DefenseRingTier { get; set; }
    public List<DefenseOrb> DefenseOrbs { get; set; }

    // Battery
    public bool BatteryUnlocked { get; set; }
    public float BatteryCharge { get; set; }
    public float BatteryChargeRate { get; set; }
    public float BatteryDamage { get; set; }
    public float BatteryRange { get; set; }
    public bool BatteryDischarging { get; set; }

    // Drone Setup (Companion)
    public int DroneLevel { get; set; } // 0-5
    public List<Drone> Drones { get; set; }
}
```

### Physics Constants
- **Base Thrust**: 0.6 (scales to 60Hz timing)
- **Max Speed**: 13.8 (standard), 22.6 (slacker with mouse)
- **Rotation Speed**: 0.12
- **Friction**: 0.98

### Movement Controls
- **Keyboard**: WASD movement with directional thrust
- **Mouse (Standard)**: Aim with left-click, thrust toward mouse
- **Mouse (Slacker)**: Auto-fire, ship follows mouse position, constant thrust
- **Gamepad**: Left stick for movement/aiming

### Weapon Systems

#### Primary Turret
- **Fire Rate**: 20 frames (base delay, scaled by fireRateMult)
- **Bullet Speed**: 15
- **Damage**: 20 × DamageMult
- **Pattern**: Fan pattern based on MultiShot count

#### Shotgun
- **Unlock Tier 1**: 5 pellets
- **Unlock Tier 2**: 8 pellets
- **Unlock Tier 3**: 12 pellets
- **Base Damage**: 10 × DamageMult × 0.7
- **Spread**: 0.5 radians
- **Bullet Speed**: 12-16
- **Life**: 23 frames × RangeMult

#### Static Weapons
Types unlocked via "static_weapons" upgrade:
- **Rear**: Fires backward from player ship
- **Side**: Fires left/right from player ship
- **Forward**: Fires forward from player ship
- **Dual Rear**: Fires two streams from rear at ±30°
- **Dual Side**: Fires four side lasers at ±27.5°

#### Homing Missiles
- **Unlock**: Tier 1 = 2 missiles, tier 5 = 2 missiles (stacked with meta)
- **Damage**: Tier × 10
- **Speed**: 12
- **Tracking**: Weak (turn rate 0.1) or Strong (turn rate 0.4)

#### Volley Shot
- **Unlock**: Auto-fires 3-7 shot burst every 2 seconds
- **Damage**: 20 × DamageMult
- **Spread**: 0.15 radians

#### CIWS (Close-In Weapon System)
- **Unlock**: Auto-targets enemies within 400 units
- **Damage**: Tier 1 = 10, Tier 5 = 50
- **Fire Rate**: Every 6 frames
- **Target Priority**: Missiles first, then nearest enemy

#### Static Defense Ring
- **Unlock**: Auto-orbiting fireballs
- **Damage**: 10 (tier 1)
- **Radius**: 500 units
- **Speed**: 1.25 rotations per 6 seconds

#### Phase Shield (Invincibility)
- **Active Duration**: 3s (tier 1), 12s (tier 5)
- **Cooldown**: 20s (tier 1), 6s (tier 5)
- **Regen**: Tier 3+ have shield regeneration during active phase
- **State Machine**: ready → active → cooldown

#### Turbo Boost
- **Trigger**: E key or Gamepad X
- **Duration**: 1s (tier 1), 8s (tier 5)
- **Speed Bonus**: +25%
- **Cooldown**: 10s (tier 1), 3s (tier 5)
- **Frame timing**: 120-480 frames

### Shield Mechanics
- **Inner Shield**: Segmented ring rotating at +0.02 rad/frame
- **Outer Shield**: Segmented ring rotating at -0.026 rad/frame
- **Segment HP**: 2 (default), 1 (outer), 1-10 (inner varies)
- **Damage Absorption**: Damage first applies to outer shield, then inner
- **Regeneration**: 1 segment every 3-5 seconds

### Upgrade Scaling (Damage/Speed)
Using diminishing returns table with minimum 0.99 factor:
```
Turret Damage: 1.0 → 1.5 → 2.0 → 3.0 → 4.0 → 5.0
Turret Fire Rate: 1.0 → 1.1 → 1.2 → 1.3 → 1.35 → 1.4
Turret Range: 1.0 → 1.25 → 1.5 → 2.0 → 2.5 → 3.0
Speed: 1.0 → 1.15 → 1.3 → 1.5 → 1.75 → 2.0
```

### Level-Up Logic
- **XP Requirements**: 100 × Level
- **New Level**: Level + 1
- **Level Scaling**: Xp += NextLevelXp; NextLevelXp = floor(NextLevelXp * 1.2)
- **Pause & Menu**: Pauses game, shows level-up menu

---

## 3. UPGRADE SYSTEM

### Popup Upgrades (UPGRADE_DATA)

#### Categories

##### Weapons
- **Turret Damage**: +20%/tier
- **Turret Fire Rate**: +10%/tier
- **Turret Range**: +25%/tier
- **Multi-Shot**: 2-6 projectiles
- **Flak Shotgun**: 5-20 pellets based on tier
- **Static Weapons**: Unlocks rear/side/forward turrets
- **Homing Missiles**: 2 missiles auto-fire (10 damage/tier)
- **Volley Shot**: Auto-fire burst (3-7 shots every 2s)
- **CIWS**: Auto-target enemies in 400 units
- **Chain Lightning**: Projectiles chain to 1-5 enemies

##### Shields & Hull
- **Hull Strength**: +25 HP, Heal 25
- **Segment Count**: +2-16 segments
- **Outer Shield**: +6-20 segments
- **Shield Regen**: 5s-0.5s per segment
- **Hull Regen**: 1-5 HP / 5s
- **Reactive Shield**: +1-5 segments per kill
- **Damage Mitigation**: -10-50% damage, +5-25% speed

##### Mobility
- **Speed**: +15-100%
- **Turbo Boost**: +50% speed, 2-8s duration, 10-3s cooldown

##### Specials
- **Area Nuke**: Auto-fire 600-1200u blast (200-600 damage)
- **Phase Shield**: 3-12s active / 20-6s cooldown
- **Stasis Field**: Freeze enemies 3-12s, 250-487u radius

##### Drones
- **Companion Drones**: Unlock/Shooter, Shield, Heal drones

### Meta Shop Upgrades (META_SHOP_UPGRADE_DATA)

| ID | Tiers (1-10) | Description |
|---|---|---|
| startDamage | +10-100% base damage | Scaled for 10x damage system |
| passiveHp | +5-50 max HP | Tier 1-10 start HP per run |
| hullPlating | +15-150 max HP | Permanent HP increase |
| shieldCore | +1 seg / +1 HP per seg | Alternating segments & HP |
| staticBlueprint | Rear, Side, Forward lasers | Permanent static weapons |
| missilePrimer | 2 missiles 10-50 damage | Auto-fire missiles |
| nukeCapacitor | Orbiting fireballs | Defense ring |
| speedTuning | +10-100% max speed |
| bankMultiplier | +25-250% nuggets |
| shopDiscount | -10-90% shop cost |
| extraLife | +0-9 extra lives |
| droneFabricator | Unlock companion drones |
| piercingRounds | Pierce 1-10 enemies |
| explosiveRounds | 10-60% chance mini-explosion |
| criticalStrike | 5-50% crit chance 2x dmg |
| splitShot | 10-100% chance split shot |
| thornArmor | Reflect 10-50% damage |
| lifesteal | Heal 1-10 HP per kill |
| evasionBoost | 5-50% dodge chance |
| shieldRecharge | Regen 1 seg / 30s-0.5s |
| dashCooldown | -1-9s dash CD |
| dashDuration | +0.5-6s dash duration |
| autoReroll | 10-100% free rerolls |
| contractSpeed | +10-100% contract speed |
| startingRerolls | Start with 0-9 rerolls |
| luckyDrop | +5-50% rare drops |
| bountyHunter | +5-50 nugs per elite/boss |
| comboMeter | +1-15% per 10 stacks |
| startingWeapon | Shotgun tiers 1-5 |
| secondWind | 0.5-5s i-frames |
| batteryCapacitor | 100-1000 dmg AOE |

### Damage Scaling System
The game uses a **10x damage multiplier** internally. Damage values in UPGRADE_DATA are 10x the actual base damage:
- Turret Damage Tier 1: "Tier1: +20% damage" = +2 damage base × 10 = +20 actual damage
- PsyLich 30 HP: 30 × 10 = 300 actual damage
- Pinwheel 2-4 HP: 2-4 × 10 = 20-40 actual damage

### ApplyUpgrade Function Pattern
```csharp
void ApplyUpgrade(string id, int tier)
{
    // Uses diminishing returns formula
    // Multiplies existing multiplier by new/old ratio
    // Updates player stats
}
```

---

## 4. ENEMIES

### Class Structure
```csharp
public class Enemy : Entity
{
    public string Type { get; set; } // "roamer", "elite_roamer", "hunter", "defender", "gunboat"
    public string NameTag { get; set; } // "NOVA", "SHADE", "VIPER", "TITAN", "EMBER", "PHANTOM", "ION"
    public string Modifier { get; set; } // "explosive", "split", "stealth"
    public int ShieldSegmentsCount { get; set; }
    public int[] ShieldSegments { get; set; }
    public float ShieldRadius { get; set; }
    public int InnerShieldSegmentsCount { get; set; }
    public int[] InnerShieldSegments { get; set; }
    public float InnerShieldRadius { get; set; }
    public float ShieldRotation { get; set; }
    public float InnerShieldRotation { get; set; }

    // AI State Machine
    public string AIState { get; set; } // SEEK, ORBIT, ATTACK_RUN, FLANK, CIRCLE, RETREAT, EVADE
    public string MoveMode { get; set; } // SEEK, ORBIT, FLANK, CIRCLE
    public float AIListener { get; set; }
    public float CircleStrafePreferred { get; set; }
    public int FlankSide { get; set; }

    // Weapon
    public float ShootTimer { get; set; }
    public float GunboatRange { get; set; }
    public bool IsGunboat { get; set; }
    public int GunboatLevel { get; set; }
    public float GunboatShieldRecharge { get; set; }
    public float GunboatMuzzleDist { get; set; }
    public bool DisableShieldRegen { get; set; }

    // AI Config
    public float TurnSpeed { get; set; }
    public float ThrustPower { get; set; }
    public float MaxSpeed { get; set; }
    public float Friction { get; set; }

    // Boss Flags
    public bool IsCruiser { get; set; }
    public bool IsDungeonBoss { get; set; }
    public string DungeonAsset { get; set; }

    // AI Targeting
    public float ShieldStrength { get; set; }
    public int VulnerableDurationFrames { get; set; }
    public float StealthAlpha { get; set; }
}
```

### Enemy Types

#### Roamer
- **HP**: 50 (first 5 min), 100 (after)
- **Radius**: 60
- **Speed**: 13.6 × difficultyMultiplier
- **Shields**: 6 segments × 10 HP each
- **AI States**: SEEK, ORBIT, FLANK, ATTACK_RUN
- **Auto-Fire**: 400-600 units, 1 bullet/tier, 50% faster at difficulty 5+

#### Elite Roamer
- **HP**: 160 + tier × 20
- **Radius**: 57
- **Speed**: 1.05x
- **Shields**: 6 segments × 10 HP
- **Modifiers**: Explosive, Split, Stealth (12% chance each)
- **Naming**: NOVA, SHADE, VIPER, TITAN, EMBER, PHANTOM, ION

#### Hunter
- **HP**: 220 + tier × 30
- **Radius**: 66 (x3 base)
- **Speed**: 13.0 + tier × 0.5
- **Thrust**: 1.2 (strong forward push)
- **Shields**: 4 segments × 10 HP each
- **Auto-Fire**: 800 units, 1 bullet/tier
- **Lead**: Aims 30 units ahead when < 600 units

#### Defender
- **HP**: 150 + (tier-1) × 20
- **Radius**: 60
- **Shields**: 4 segments × 10 HP each
- **Auto-Fire**: 600 units
- **AssignedBase**: Prioritizes defending assigned base
- **Behavior**: Seeks unless near base, retreats at low HP

#### Gunboat (Standard Base)
- **HP**: 200 (lvl 1), 260 (lvl 2)
- **Radius**: 84
- **Shields**: 10 segments × 10 HP each (tier 1), up to 12-14 × 20-30 HP (tier 5+)
- **GunboatLevel**: 1 or 2 based on difficulty/level
- **Speed**: 8.0
- **Thrust**: 0.88
- **Auto-Fire**: 900 units
- **Shield Regen**: 90 frames (1.5s)

### AI State Machine
```
AIState Transition Logic:
- CIRCLE (circleStrafePreferred): Circles around player
- SEEK: Moves toward player
- ORBIT: Orbits around player
- FLANK: Strafes around player
- ATTACK_RUN: Aggressive approach
- RETREAT: Returns to base
- EVADE: Moves perpendicular to player
```

### Behavior Patterns
- **Separation Force**: Avoids other enemies within 150 units
- **Obstacle Avoidance**: Avoids pinwheels, bases, fortresses
- **Anti-Ram Spacing**: Roamers keep 260 units from player
- **Dodge Force**: 3.0 strength when dodging bullets within 200 units
- **Smoothing**: Smooth movement (0.92 factor)

### Bullet Patterns
- **Rocket**: 10 units/tier damage, 50 frames life
- **Shotgun**: 1 unit/tier damage, 300 frames life
- **Multi-Shot**: 1 unit/tier damage, 180 frames life

### Kill Rewards
- **Roamer**: 2-4 coins × 2-4 value, 1-2 nuggets
- **Elite Roamer**: 3-5 coins × 3, 2-4 nuggets
- **Hunter**: 4-7 coins × 4, 2-4 nuggets
- **Defender**: 3 coins × 3, 1-2 nuggets
- **Gunboat**: +10-15 coins, 2-5 nuggets
- **Named Elite**: +1-2 coins, +2-4 nuggets

### Difficulty Scaling
```csharp
float GetEnemyHpScaling() {
    const elapsedMs = GetElapsedGameTime();
    // Scale: 1.0 (start) -> 4.0 (30 mins)
    return 1 + (elapsedMs / 1800000) * 3; // 30*60*1000*3 = 1800000
}
```

---

## 5. BOSSES

### Main Bosses

#### Cruiser (Cruiser.js)
```csharp
public class Cruiser : Enemy
{
    public int EncounterIndex { get; set; } // 1-3+
    public int PhaseIndex { get; set; }
    public string PhaseName { get; set; }
    public float CruiserHullScale { get; set; } // 7.75 × encounterIndex
    public int ShieldStrength { get; set; }
    public float CruiseHullScale { get; set; }
    public float GunboatScale { get; set; }

    // Hardpoints
    public struct Hardpoint {
        public string Id { get; set; }
        public string Type { get; set; } // cannon, sprayer, bay, shieldgen
        public Vector Offset { get; set; }
        public float Radius { get; set; }
        public int Hp { get; set; }
        public int MaxHp { get; set; }
        public int Cooldown { get; set; }
    }
    public Hardpoint[] Hardpoints { get; set; }

    // Phase Sequence
    public Phase[] PhaseSeq { get; set; }

    // Charge Attack
    public float ChargeState { get; set; } // 'telegraph', 'charging', 'none'
    public float ChargeDuration { get; set; }
    public float ChargeTelegraphDuration { get; set; }
    public float ChargeTargetPos { get; set; }

    // Phase Timing
    public float PhaseTimer { get; set; }
    public int PhaseTick { get; set; }

    // Shield Generation
    public int ShieldStrength { get; set; }
    public long LastShieldGenAt { get; set; }

    // Invasion Logic
    public int InvasionPhase { get; set; }
    public int InvasionCooldown { get; set; }
    public int InvasionCooldownBase { get; set; }
}
```

**Phase Sequence** (rotates by encounterIndex):
1. **SALVO** - 180 frames - Cannon fire
2. **CURTAIN** - 150 frames - Sprayers (covers arc)
3. **MINEFIELD** - 150 frames - Bomb drops
4. **SWEEP** - 150 frames - Sprayers (wide spread)
5. **CHARGE** - 110 frames - Straight charge attack

**Hardpoints Types**:
- **LC/RC**: Cannon (rear positions)
- **SP**: Sprayer (center top)
- **MB**: Bay (bottom)
- **SG**: Shield Generator

**Encounter Scaling**:
- **HP**: 150 × (1 + 0.35 × (encounterIndex - 1)) × hpScale
- **Shield Strength**: 2 + encounterIndex
- **Hardpoint HP**: Base × hpScale
- **Invulnerability**: 120 + 30 × (encounterIndex - 1) frames after CHARGE phase
- **Duration**: 180, 210, 240 frames for phases 1-3

**AI Behavior**:
- **Seek**: Speed 13.8
- **Circle**: Speed 10.35, circles around player
- **Orbit**: Speed 8.25, orbits around player
- **Flank**: Speed 14.95
- **Charge**: Speed 25, straight line attack

#### Destroyer (Destroyer.js)
```csharp
public class Destroyer : Entity
{
    public string DisplayName { get; set; }
    public float VisualRadius { get; set; }
    public float CollisionRadius { get; set; }
    public int MaxShieldHp { get; set; }

    // Shield System
    public int ShieldStrength { get; set; }
    public int InnerShieldStrength { get; set; }
    public int ShieldSegmentsCount { get; set; }
    public int InnerShieldSegmentsCount { get; set; }
    public float ShieldRotation { get; set; }

    // Invincibility Phase Shield
    public PhaseShieldState InvincibilityCycle { get; set; }

    // Weapon System
    public float TurretReload { get; set; }

    // Reinforcement System
    public int HelperMax { get; set; }
    public int HelperCooldown { get; set; }
    public int HelperCooldownBase { get; set; }
    public int HelperBurst { get; set; }
    public int HelperCall70 { get; set; }
    public int HelperCall40 { get; set; }
    public int HelperStrengthTier { get; set; }
    public int Called70 { get; set; }
    public int Called40 { get; set; }
    public int ShieldGenAt { get; set; }

    // Combat Stats
    public int EscalationPhase { get; set; } // 1-3
    public float EscalationMultiplier { get; set; } // 1.0, 1.3, 1.6
    public float FarTurnSpeed { get; set; }
    public float BaseTurnSpeed { get; set; }
    public float RoamSpeed { get; set; }
    public float RoamInterval { get; set; }

    // Hull Definition
    public HullPoint[] HullDefinition { get; set; }
    public float HullScale { get; set; }

    // Invincibility Phase Shield Config
    public float InvulnerableDurationFrames { get; set; }
    public int[] ShieldStrengthPerPhase { get; set; }
    public int ShieldHealthPerPhase { get; set; }
    public int ShieldRechargeMs { get; set; }
    public long LastHpRegenTime { get; set; }

    // AI Move Modes
    public float MoveModeTimer { get; set; }
    public float MoveMode { get; set; } // SEEK, ORBIT, FLANK, CIRCLE
}
```

**Phase System**:
- **Phase 1**: Standard AI modes
- **Phase 2**: 30% damage multiplier
- **Phase 3**: 60% damage multiplier

**AI Modes**:
- **Seek**: 9.75 speed
- **Orbit**: 8.25 speed
- **Flank**: 10.25 speed
- **Circle**: 7.25 speed

**Reinforcement**:
- Max 8 drones
- Calls 4-5 drones every 20 seconds
- Drones have scaled HP based on strength tier

#### Destroyer II (Destroyer2.js)
- Shares Destroyer base structure with enhanced variants
- Additional: more advanced AI, different hardpoints

### Dungeon Bosses

#### NecroticHive
```csharp
public class NecroticHive : Enemy
{
    public string DungeonAsset { get; set; }
    public float CruiserHullScale { get; set; }
    public float GunboatScale { get; set; }

    // Drone Swarm
    public Drone[] Drones { get; set; }
    public int MaxDrones { get; set; }
    public int DroneRespawnCooldown { get; set; }
    public bool HiveResurgenceTriggered { get; set; }

    // Phase Sequence
    public Phase[] PhaseSeq { get; set; }

    // Phase Actions
    // SWARM_SUMMON: Summon drones, chitin barrage
    // PROTECTIVE_RING: Guided missiles, drone ring attack
    // PARASITE_BURST: Bio-pods, napalm zones
    // FRENZY: Rapid triple spread, ring attack
    // HIVE_MIND: Final phase
}
```

#### Other Dungeon Bosses

**CerebralPsion**: Psychic abilities, mind control effects
**Fleshforge**: Biological attacks, spawning minions
**VortexMatriarch**: Gravity wells, teleportation
**ChitinusPrime**: Swarm attacks, armor plating
**PsyLich**: Phase shift, spectral attacks

All dungeon bosses share similar structure with unique assets and phase patterns.

---

## 6. PROJECTILES

### Bullet Class
```csharp
public class Bullet : Entity
{
    public float Damage { get; set; }
    public float Radius { get; set; }
    public string Owner { get; set; } // "player", "enemy"
    public bool IsEnemy { get; set; }
    public int Life { get; set; }
    public float MaxLife { get; set; }
    public bool Piercing { get; set; }
    public int HitCount { get; set; }
    public int MaxHits { get; set; }
    public bool IgnoreShields { get; set; }
    public int Homing { get; set; } // 0, 1 (weak), 2 (strong)
    public int PierceCount { get; set; }
    public bool IsExplosive { get; set; }
    public bool IsBomb { get; set; }
    public float ExplosionRadius { get; set; }
    public float ExplosionDamage { get; set; }
    public bool UseShockwave { get; set; }
    public bool IsMissile { get; set; }
    public bool IsSplitShot { get; set; }
    public bool HasCrit { get; set; }
    public string Shape { get; set; } // "laser", "square", "glow", "missile"
    public string Style { get; set; } // from shape/style
}
```

### Missile Class
```csharp
public class Missile : Entity
{
    public float Damage { get; set; }
    public float Radius { get; set; }
    public float Life { get; set; }
    public float TurnRate { get; set; } // Scale x 2
    public float Acceleration { get; set; }
    public float MaxSpeed { get; set; }
    public Entity Target { get; set; }
    public Vector2 Velocity { get; set; }
}
```

### Projectile Types

#### Standard Bullet
- **Speed**: 15 (player), 11-22 (enemies)
- **Life**: 50 frames
- **Radius**: 4
- **Style**: Glow (player), red glow (enemy)

#### Homing Missile
- **Speed**: 12
- **Turn Rate**: 0.1 (weak) or 0.4 (strong)
- **Damage**: 10 per tier

#### Cluster Bomb
- **Explosion**: Area of 150 units
- **Damage**: 5 base
- **Shockwave**: Triggers

#### Shockwave
- **Damage**: 10-600 (nuke)
- **Range**: 2000-8000 units
- **Follows Player**: True for nuke
- **Color**: Customizable

#### Napalm Zone
- **Duration**: Persistent damage zone
- **Damage**: 80 damage per frame
- **Area**: 600-700 units

#### Flagship Guided Missile
- **Targets**: Boss entities
- **Damage**: 1 per frame
- **Speed**: 12
- **Tracking**: Gradual turn rate

---

## 7. GAME LOOP ARCHITECTURE

### Variable Timestep Physics
```csharp
// Physics runs at 120Hz (8.33ms steps)
const int PHYSICS_FPS = 120;
const float SIM_STEP_MS = 1000f / PHYSICS_FPS; // 8.33ms
const int SIM_MAX_STEPS_PER_FRAME = 12; // Max catch-up steps

// Update loop
while (simAccMs >= STEP && steps < SIM_MAX_STEPS_PER_FRAME) {
    GameLoopLogic(doUpdate: true, doDraw: false, deltaTime: STEP);
    simAccMs -= STEP;
    steps++;
}

// Render loop
float alpha = steps > 0 ? Math.Min(1, simAccMs / STEP) : 1.0f;
GameLoopLogic(doUpdate: false, doDraw: true, deltaTime: 0, alpha: alpha);
```

### Timing Scale Formula
```csharp
float deltaTime = 16.67f; // Reference frame at 60fps
float dtFactor = deltaTime / 16.67f; // Normalizes to 1.0 at 60fps

// In update() methods:
this.timer -= dtFactor;
this.cooldown -= dtFactor;
this.t += dtFactor; // Counter increments
```

### Rendering
- **Rendering**: Interpolated positions for smooth 60fps feel
- **Interpolation**: `renderAlpha` controls the blend factor (0-1)
- **Zoom**: Dynamic zoom (0.34-0.42) to keep player centered
- **Screenshake**: Timer + magnitude based on damage taken

### Render Layers
- `BaseLayer`: Base rendering (asteroids, backgrounds)
- `EnemyLayer`: Enemy sprites
- `BossLayer`: Boss sprites
- `BulletLayer`: Bullets
- `ParticleLayer`: Particles
- `VectorLayer`: Vector graphics (shields, lines)
- `PickupLayer`: Pickups
- `UIOverlayLayer`: UI elements (minimap, arrows)

---

## 8. COLLISION DETECTION

### Spatial Hashing
```csharp
// Target grid for entities
var targetGrid = new SpatialHash(350); // 350 units cell size

// Build per frame
targetGrid.Clear();
foreach (Entity e in GameContext.Enemies) {
    if (!e.dead) targetGrid.Insert(e);
}
```

### Bullet Grid
```csharp
// Bullet grid tuned for projectiles
var bulletGrid = new SpatialHash(150); // 150 units cell size
```

### Collision Categories
- **asteroidGrid**: Environment asteroids (300 units)
- **targetGrid**: Enemies, pinwheels, bosses, turrets
- **bulletGrid**: Projectiles (150 units)

### Spatial Hash Implementation
```csharp
public class SpatialHash
{
    private float cellSize;
    private Dictionary<Vector2Int, List<Entity>> grid = new();

    public SpatialHash(float cellSize)
    {
        this.cellSize = cellSize;
    }

    public void Clear()
    {
        grid.Clear();
    }

    public void Insert(Entity entity)
    {
        int minX = (int)Math.Floor((entity.x - entity.radius) / cellSize);
        int maxX = (int)Math.Floor((entity.x + entity.radius) / cellSize);
        int minY = (int)Math.Floor((entity.y - entity.radius) / cellSize);
        int maxY = (int)Math.Floor((entity.y + entity.radius) / cellSize);

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                var key = new Vector2Int(x, y);
                if (!grid.ContainsKey(key))
                    grid[key] = new List<Entity>();
                grid[key].Add(entity);
            }
        }
    }

    public List<Entity> Query(float x, float y, float radius)
    {
        var result = new List<Entity>();
        int minX = (int)Math.Floor((x - radius) / cellSize);
        int maxX = (int)Math.Floor((x + radius) / cellSize);
        int minY = (int)Math.Floor((y - radius) / cellSize);
        int maxY = (int)Math.Floor((y + radius) / cellSize);

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                var key = new Vector2Int(x, y);
                if (grid.ContainsKey(key))
                {
                    foreach (var entity in grid[key])
                    {
                        if (!result.Contains(entity))
                            result.Add(entity);
                    }
                }
            }
        }
        return result;
    }
}
```

---

## 9. PARTICLES

### Particle Class
```csharp
public class Particle : Entity
{
    public float Life { get; set; }
    public float MaxLife { get; set; }
    public Color Color { get; set; }
    public bool Glow { get; set; }
    public float Size { get; set; }
}
```

### Explosion Class
```csharp
public class Explosion : Entity
{
    public float ExplosionTime { get; set; }
    public SpriteExplosion SpriteExplosion { get; set; }
    public float RenderTime { get; set; }
}
```

### Particle Types

#### Glow Particle
- Procedurally generated radial gradient
- Fades out over lifetime
- Used for bullet trails, explosions

#### Smoke Particle
- Darker, larger particles
- Slower fade out
- Used for engine trails, destruction

#### Warp Particle
- Spiral pattern
- Used for warp gate effects

### Sprite Explosion
- Uses sprite sheet: assets/explosion1.png (4x5 grid)
- 20 frames total
- Scaled by explosion size

---

## 10. UI/HUD

### Minimap
- **Render**: Canvas 2D overlay
- **Entities**: Red circles for enemies, blue for pinwheels
- **Boss**: Different color

### Directional Indicators
- **Station**: Cyan arrow
- **Destroyer**: Orange (Destroyer II = red)
- **Warp Gate**: Orange
- **Contract**: Green
- **Mini Event**: Yellow

### Health Bars
- **Player**: Left side, segmented shield + hull
- **Space Station**: Red progress bar above station

### HUD Elements
```
┌─────────────────────────────────────┐
│ SCORE: 125,430   TIME: 12:34        │
│                                     │
│ ████░░░░ 100/150 HP                 │
│ ■■■□□□ 3/6 Shields                 │
│                                     │
│ [MINIMAP]                           │
│                                     │
│ XP: [████████░░] 8,450/10,000       │
│ LVL 15                              │
└─────────────────────────────────────┘
```

### Level-Up Menu
- Pauses game
- Shows 3 random upgrade choices
- Reroll available

### Meta Shop
- Between runs
- Purchase permanent upgrades
- Currency: Space Nuggets

---

## ASSET REFERENCES

### Player Assets
| Type | Asset Path |
|------|------------|
| hull | assets/player1.png, assets/slacker.png |
| turret_base | assets/player_turret_base.png |
| barrel | assets/player_barrel.png |
| thruster | assets/player_thruster.png |
| turbo_flame | assets/player_turbo_flame.png |

### Enemy Assets
| Type | Asset Path |
|------|------------|
| roamer | assets/roamer1.png |
| elite_roamer | assets/roamer_elite.png |
| hunter | assets/hunter.png |
| defender | assets/defender.png |
| gunboat1 | assets/gunboat1.png |
| gunboat2 | assets/gunboat2.png |

### Boss Assets
| Type | Asset Path |
|------|------------|
| cruiser | assets/cruiser.png |
| space_station | assets/station1.png |
| final_boss | assets/spaceboss2.png |
| necrotic_hive | assets/dungeon4.png |
| cerebral_psion | assets/dungeon5.png |
| fleshforge | assets/dungeon6.png |
| vortex_matriarch | assets/dungeon7.png |
| chitinus_prime | assets/dungeon8.png |
| psy_lich | assets/dungeon9.png |

### Pickup Assets
| Type | Asset Path |
|------|------------|
| coin | assets/coin.png |
| nugget | assets/nugget.png |
| health | assets/medkit.png |
| sparkle | assets/sparkle.png |

### Effect Assets
| Type | Asset Path |
|------|------------|
| explosion | assets/explosion1.png (sprite sheet: 4x5) |
| particle_glow | Procedural generation |
| particle_smoke | Procedural generation |
| particle_warp | Procedural generation |

### Environment Assets
| Type | Asset Path |
|------|------------|
| asteroid1 | assets/asteroid1.png (large) |
| asteroid2 | assets/asteroid2.png (medium) |
| asteroid3 | assets/asteroid3.png (small) |
| asteroid2_U | assets/asteroid2_U.png (indestructible) |
| pinwheel | assets/pinwheel.png |
| warp_gate | assets/warpgate.png |
| base | assets/base.png |

---

## ADDITIONAL NOTES

### 10x Damage System
The game internally uses a 10x multiplier for all damage values. When reading HP/damage from the constants, divide by 10 for actual values.

### Frame-Based Timing
All durations are specified in frames at 60fps reference:
- 1 second = 60 frames
- 0.5 seconds = 30 frames
- These work correctly with dtScale because it normalizes to reference framerate

### Entity Cleanup Pattern
Always call `.Kill()` instead of setting `.dead = true` to ensure proper graphics cleanup.

### View Culling
Entities should implement `IsInView()` and `IsInExtendedView()` checks for performance optimization.

---

**End of Migration Guide**
