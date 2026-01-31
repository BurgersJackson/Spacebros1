# COMPLETE MONOGAME MIGRATION GUIDE - Spacebros 2D Space Shooter

This guide contains EVERYTHING needed to recreate the Spacebros game from scratch in MonoGame or any other game engine. All graphics and sound assets can be reused from the `assets/` folder.

---

## TABLE OF CONTENTS
1. [GAME OVERVIEW](#1-game-overview)
2. [CORE CONSTANTS](#2-core-constants)
3. [GAME LOOP ARCHITECTURE](#3-game-loop-architecture)
4. [PHYSICS SYSTEM](#4-physics-system)
5. [PLAYER SPACESHIP](#5-player-spaceship)
6. [WEAPONS SYSTEM](#6-weapons-system)
7. [SHIELD SYSTEM](#7-shield-system)
8. [UPGRADE SYSTEM](#8-upgrade-system)
9. [ENEMIES](#9-enemies)
10. [BOSSES](#10-bosses)
11. [PROJECTILES](#11-projectiles)
12. [COLLISION DETECTION](#12-collision-detection)
13. [PARTICLES & EFFECTS](#13-particles--effects)
14. [UI & HUD](#14-ui--hud)
15. [ASSET REFERENCES](#15-asset-references)

---

## 1. GAME OVERVIEW

**Genre**: 2D top-down space shooter roguelite
**Perspective**: Top-down, camera follows player
**Game Duration**: 30 minutes per run
**Goal**: Survive, defeat bosses, collect upgrades, earn currency for permanent progression

### Core Gameplay Loop
1. Player controls spaceship in open space
2. Enemies spawn continuously and attack the player
3. Player earns XP from kills, levels up, chooses upgrades
4. Bosses appear at specific intervals (Cruiser, Destroyer, Final Boss)
5. Collect coins (score) and Space Nuggets (permanent upgrade currency)
6. Between runs, spend nuggets in Meta Shop for permanent upgrades
7. Repeat with stronger builds

### Key Features
- **Variable Timestep Physics**: 120Hz physics, 60Hz rendering with interpolation
- **Segmented Shield System**: Rotating shield rings that absorb damage
- **Dual Upgrade Systems**: In-game popup upgrades + permanent meta shop
- **Multiple Control Schemes**: Keyboard, Mouse, Gamepad support
- **Two Ship Types**: Standard (WASD + mouse aim) and Slacker (mouse movement)

---

## 2. CORE CONSTANTS

### Timing Constants
```csharp
// Reference framerate for calibration (all gameplay tuned to 60fps)
public const float SIM_FPS = 60f;
public const float SIM_STEP_MS = 1000f / SIM_FPS;  // 16.67ms per frame

// Physics runs at higher frequency for stability
public const int PHYSICS_FPS = 120;
public const float PHYSICS_STEP_MS = 1000f / PHYSICS_FPS;  // 8.33ms

// Maximum catch-up steps to prevent spiral of death
public const int SIM_MAX_STEPS_PER_FRAME = 12;

// Total game duration before final boss
public const long GAME_DURATION_MS = 30 * 60 * 1000;  // 30 minutes
```

### Rendering Constants
```csharp
public const float ZOOM_LEVEL = 0.4f;
public const float SPRITE_RENDER_SCALE = 2.5f;
public const int PIXI_SPRITE_POOL_MAX = 30000;
```

### Player Constants
```csharp
public const float PLAYER_HULL_RENDER_SCALE = 2.5f;
public const float PLAYER_HULL_ROT_OFFSET = MathF.PI / 2f;  // Art is nose-up, world 0=right
public const float PLAYER_SHIELD_RADIUS_SCALE = 1.5f;
```

### Spatial Hash Cell Sizes
```csharp
public const int ASTEROID_GRID_CELL_SIZE = 300;  // For asteroids
public const int TARGET_GRID_CELL_SIZE = 350;    // For enemies, bosses, bases
public const int BULLET_GRID_CELL_SIZE = 150;    // For projectiles
```

### Frame Conversion Helper
```csharp
// Convert seconds to frames at 60fps reference
int SecondsToFrames(float seconds) => (int)(seconds * 60f);

// Examples:
// 1 second = 60 frames
// 0.5 seconds = 30 frames
// 2 seconds = 120 frames
```

---

## 3. GAME LOOP ARCHITECTURE

### Variable Timestep Physics Loop
The game uses a fixed timestep accumulator for consistent physics:

```csharp
float simAccumulator = 0f;
float previousTime = GetCurrentTimeMs();

// Main game loop
while (gameRunning) {
    float currentTime = GetCurrentTimeMs();
    float deltaTime = currentTime - previousTime;
    previousTime = currentTime;

    simAccumulator += deltaTime;

    // Physics update loop (fixed 120Hz)
    int steps = 0;
    while (simAccumulator >= PHYSICS_STEP_MS && steps < SIM_MAX_STEPS_PER_FRAME) {
        UpdatePhysics(PHYSICS_STEP_MS);
        simAccumulator -= PHYSICS_STEP_MS;
        steps++;
    }

    // Render with interpolation
    float alpha = simAccumulator / PHYSICS_STEP_MS;  // 0-1 blend factor
    Render(alpha);
}

void UpdatePhysics(float deltaTime) {
    // Apply time scaling to all time-based operations
    float dtFactor = deltaTime / 16.67f;  // Normalize to 60fps reference

    // Example usage in entity update:
    // this.timer -= dtFactor;
    // this.cooldown -= dtFactor;
    // this.t += dtFactor;  // Counter increment
}
```

### Timing Scale Formula (CRITICAL)
All entity `update(deltaTime)` methods must use time scaling:

```csharp
public void Update(float deltaTime = 16.67f) {
    if (this.dead) return;

    const float dtFactor = deltaTime / 16.67f;  // Normalizes to 1.0 at 60fps

    // Use dtFactor for ALL time-based operations:
    this.timer -= dtFactor;
    this.cooldown -= dtFactor;
    this.t += dtFactor;  // NOT this.t++

    // Frame-based checks need Math.Floor():
    if (Math.Floor(this.t) % 2 == 0) {
        EmitParticle();
    }
}
```

### Render Interpolation
For smooth rendering between physics ticks:

```csharp
// Store previous position in entity
public Vector2 prevPos;

// In update (before moving):
this.prevPos = new Vector2(this.pos.x, this.pos.y);

// In render:
Vector2 GetRenderPos(float alpha) {
    return new Vector2(
        this.prevPos.x + (this.pos.x - this.prevPos.x) * alpha,
        this.prevPos.y + (this.pos.y - this.prevPos.y) * alpha
    );
}
```

---

## 4. PHYSICS SYSTEM

### Movement Physics
All moving entities use velocity-based movement with friction:

```csharp
public class Entity {
    public Vector2 pos;        // Position
    public Vector2 vel;        // Velocity
    public Vector2 acc;        // Acceleration
    public float angle;        // Facing angle in radians
    public float radius;       // Collision radius

    // Physics properties
    public float maxSpeed;
    public float thrustPower;
    public float friction;     // Velocity decay (0-1)

    public void UpdatePhysics(float deltaTime) {
        const float dtFactor = deltaTime / 16.67f;

        // Apply acceleration
        this.vel.x += this.acc.x * dtFactor;
        this.vel.y += this.acc.y * dtFactor;

        // Clamp to max speed
        float speed = Math.Sqrt(vel.x * vel.x + vel.y * vel.z);
        if (speed > this.maxSpeed) {
            float scale = this.maxSpeed / speed;
            vel.x *= scale;
            vel.y *= scale;
        }

        // Apply friction (exponential decay based on time)
        float frictionFactor = Math.Pow(this.friction, dtFactor);
        vel.x *= frictionFactor;
        vel.y *= frictionFactor;

        // Update position
        pos.x += vel.x * dtFactor;
        pos.y += vel.y * dtFactor;
    }
}
```

### Rotation Physics
```csharp
public void RotateTowards(Vector2 target, float deltaTime) {
    const float dtFactor = deltaTime / 16.67f;
    float targetAngle = Math.Atan2(target.y - pos.y, target.x - pos.x);
    float angleDiff = targetAngle - this.angle;

    // Normalize to -PI to +PI
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Apply rotation
    float turnStep = this.rotationSpeed * dtFactor;
    if (Math.Abs(angleDiff) < turnStep) {
        this.angle = targetAngle;
    } else {
        this.angle += Math.Sign(angleDiff) * turnStep;
    }
}
```

---

## 5. PLAYER SPACESHIP

### Player Class Structure
```csharp
public class Spaceship : Entity {
    // Ship type
    public string shipType;  // "standard" or "slacker"

    // Physics
    public float baseThrust = 0.6f;
    public float maxSpeed = 13.8f;  // Standard ship
    public float rotationSpeed = 0.12f;
    public float friction = 0.98f;

    // Combat stats
    public float damageMult = 1.0f;
    public float fireRateMult = 1.0f;
    public float rangeMult = 1.0f;
    public int multiShot = 1;
    public int pierceCount = 0;

    // Health
    public int maxHp = 25;
    public int hp;
    public float invulnerable = 90f;  // Frames of i-frames

    // Shields
    public float shieldRadius = 75f;  // 50 * 1.5
    public int maxShieldSegments = 8;
    public int[] shieldSegments = new int[8];  // Each segment has 2 HP
    public float shieldRotation = 0f;

    public int maxOuterShieldSegments = 0;
    public int[] outerShieldSegments = new int[0];
    public float outerShieldRadius = 114f;
    public float outerShieldRotation = 0f;

    // Progression
    public int level = 1;
    public int xp = 0;
    public int nextLevelXp = 100;

    // Weapons
    public int baseFireDelay = 20;  // Frames between shots
    public int fireDelay = 20;
    public float autofireTimer = 0f;

    public int baseShotgunDelay = 30;
    public int shotgunDelay = 30;
    public float shotgunTimer = 0f;

    // Special abilities
    public bool nukeUnlocked = false;
    public float nukeCooldown = 0f;
    public float nukeMaxCooldown = 600f;  // 10 seconds
    public float nukeDamage = 50f;
    public float nukeRange = 5000f;

    // Turbo boost
    public float turboDurationFrames = 60f;     // 1 second
    public float turboCooldownFrames = 600f;   // 10 seconds
    public float turboSpeedMult = 1.25f;       // +25% speed
    public bool turboActive = false;

    // Phase shield (invincibility)
    public bool phaseShieldUnlocked = false;
    public float phaseShieldDuration = 180f;   // 3 seconds (tier 1)
    public float phaseShieldCooldown = 1200f;  // 20 seconds (tier 1)
    public string phaseShieldState = "ready";  // ready, active, cooldown

    // Leveling
    public void AddXp(int amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            LevelUp();
        }
    }

    public void LevelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = (int)Math.Floor(this.nextLevelXp * 1.2f);
        // Show upgrade menu
    }
}
```

### Player Physics Values
| Property | Value | Notes |
|----------|-------|-------|
| Base Thrust | 0.6 | Scaled to 60Hz timing |
| Max Speed (Standard) | 13.8 | Doubled from 6.8 for 60Hz |
| Max Speed (Slacker) | 22.6 | Mouse movement mode |
| Rotation Speed | 0.12 | Radians per frame |
| Friction | 0.98 | Velocity retention per frame |
| Radius | 30 | Collision radius |

### Player Controls

#### Standard Ship (WASD + Mouse)
```
W/Thumbstick Forward: Thrust forward
A/D/Left-Right: Rotate
S/Thumbstick Down: Brake
Mouse Move: Aim turret
Left Click: Fire
Right Click/E/Gamepad X: Turbo boost
F/Gamepad Y: Battery discharge
Shift/Gamepad B: Warp (when unlocked)
```

#### Slacker Ship (Mouse Movement)
```
Mouse Position (button NOT held): Move ship (gamepad-style from center)
Left Click (held): Stop movement, auto-fire nearest enemy
Ship auto-rotates toward mouse
```

### Player Update Loop
```csharp
public void Update(float deltaTime) {
    const float dtFactor = deltaTime / 16.67f;

    // 1. Process input
    Vector2 moveInput = GetMovementInput();
    Vector2 aimInput = GetAimInput();

    // 2. Rotate toward aim
    if (shipType == "standard") {
        RotateTowards(aimInput, deltaTime);
    } else {
        // Slacker rotates toward mouse
        RotateTowardMouse(deltaTime);
    }

    // 3. Apply thrust
    if (moveInput.Length() > 0.06f) {
        float thrustAmount = baseThrust * turboMult * dtFactor;
        vel.x += Math.Cos(angle) * thrustAmount;
        vel.y += Math.Sin(angle) * thrustAmount;
    }

    // 4. Clamp velocity
    float currentMaxSpeed = maxSpeed * speedMult * turboMult;
    ClampVelocity(currentMaxSpeed);

    // 5. Apply friction
    vel.x *= (float)Math.Pow(friction, dtFactor);
    vel.y *= (float)Math.Pow(friction, dtFactor);

    // 6. Update position
    pos.x += vel.x * dtFactor;
    pos.y += vel.y * dtFactor;

    // 7. Update weapons
    autofireTimer -= dtFactor;
    if (autofireTimer <= 0) {
        FireTurret();
        autofireTimer = Math.Max(4, fireDelay / fireRateMult);
    }

    // 8. Update shields rotation
    shieldRotation += 0.02f * dtFactor;
    if (outerShieldSegments.Length > 0) {
        outerShieldRotation -= 0.026f * dtFactor;
    }

    // 9. Update abilities
    UpdateAbilities(dtFactor);
}
```

---

## 6. WEAPONS SYSTEM

### Weapon Fire Rates (frames at 60fps)
| Weapon | Base Delay | Actual Delay | Notes |
|--------|-----------|-------------|-------|
| Main Turret | 20 | 20 / fireRateMult | Primary damage |
| Shotgun | 30 | 30 / shotgunFireRateMult | Burst fire |
| Forward Laser | 20 | 20 / fireRateMult | Always fires |
| CIWS | 6 | 6 | Auto-target |
| Homing Missiles | 30 | 30 / fireRateMult | Auto-fire |
| Volley Shot | 120 | 120 | Auto-burst (2s) |

### Weapon Damage Formula
```csharp
// Base damage values (scaled 10x internally, divide by 10 for actual)
const float TURRET_BASE_DAMAGE = 20f;
const float SHOTGUN_BASE_DAMAGE = 10f;
const float FORWARD_LASER_DAMAGE = 2f;

// Final damage calculation
float CalculateDamage(float baseDamage) {
    float damage = baseDamage * player.damageMult;

    // Combo meter bonus
    if (player.comboStacks > 0) {
        float comboBonus = 1f + (player.comboStacks / 10f) * player.comboMaxBonus;
        damage *= comboBonus;
    }

    // Critical strike
    if (player.critChance > 0 && Random() < player.critChance) {
        damage *= 2f;
    }

    return damage;
}
```

### Main Turret
```csharp
public void FireTurret() {
    float damage = 20f * damageMult;  // Apply damage multiplier
    float bulletSpeed = 15f;
    int shots = multiShot;  // 1-6 based on upgrades

    // Fan pattern
    float anglePerShot = 0.05f;  // Radians between shots
    float startAngle = turretAngle - (anglePerShot * (shots - 1)) / 2f;

    for (int i = 0; i < shots; i++) {
        float angle = startAngle + i * anglePerShot;
        Vector2 spawnPos = pos + new Vector2(Cos(angle), Sin(angle)) * 25;

        Bullet bullet = new Bullet(spawnPos, angle, bulletSpeed, damage, pierceCount);
        bullets.Add(bullet);
    }
}
```

### Shotgun
```csharp
public void FireShotgun() {
    int tier = GetUpgradeTier("shotgun");
    if (tier == 0) return;

    int pelletCount = tier == 1 ? 5 : tier == 2 ? 8 : 12;
    float damage = 10f * damageMult * 0.7f;  // Reduced per pellet
    float spread = 0.5f;  // Radians

    for (int i = 0; i < pelletCount; i++) {
        float angle = turretAngle + (Random() - 0.5f) * spread;
        float speed = 12f + (Random() - 0.5f) * 4f;

        Bullet bullet = new Bullet(pos, angle, speed, damage, 0);
        bullet.life = 23f * rangeMult;  // Range based on upgrade
        bullets.Add(bullet);
    }
}
```

### Static Weapons
Always-on turrets that fire with main turret:

| Type | Angle | Description |
|------|-------|-------------|
| Rear | angle + PI | Fires backward |
| Side | angle ± PI/2 | Two side lasers |
| Forward | angle | Forward laser |
| Dual Rear | angle ± PI/6 | Two angled rear streams |
| Dual Side | angle ± (PI/2 ± 2.5°) | Four side lasers with spread |

### Homing Missiles
```csharp
public void FireHomingMissiles() {
    int totalMissiles = 2;  // Base
    if (hasMetaUpgrade) totalMissiles = 4;

    float damage = upgradeTier * 10f;  // 10-50 based on tier
    float speed = 12f;
    float turnRate = 0.1f;  // Weak tracking

    for (int i = 0; i < totalMissiles; i++) {
        float angleOffset = (i - (totalMissiles - 1) / 2f) * 0.3f;
        float angle = turretAngle + angleOffset;

        Missile missile = new Missile(pos, angle, speed, damage, turnRate);
        missiles.Add(missile);
    }
}
```

### CIWS (Close-In Weapon System)
```csharp
// Auto-targets nearest threat within range
public void UpdateCIWS(float dtFactor) {
    ciwsCooldown -= dtFactor;
    if (ciwsCooldown <= 0) {
        Entity target = FindNearestTarget(ciwsRange);
        if (target != null) {
            float angle = Atan2(target.pos.y - pos.y, target.pos.x - pos.x);
            Bullet bullet = new Bullet(pos, angle, 18f, ciwsDamage, 0);
            bullets.Add(bullet);
            ciwsCooldown = 6f;  // Fire every 6 frames
        }
    }
}
```

### Volley Shot
```csharp
// Auto-fires burst every 2 seconds
public void UpdateVolleyShot(float dtFactor) {
    volleyCooldown -= dtFactor;
    if (volleyCooldown <= 0) {
        int shots = 3 + volleyTier * 1;  // 3-7 shots
        float spread = 0.15f;

        for (int i = 0; i < shots; i++) {
            float angle = turretAngle + (i - (shots - 1) / 2f) * spread;
            Bullet bullet = new Bullet(pos, angle, 14f, 20f * damageMult, pierceCount);
            bullets.Add(bullet);
        }

        volleyCooldown = 120f;  // 2 seconds at 60fps
    }
}
```

### Area Nuke
```csharp
// Auto-fires when cooldown ready
public void UpdateNuke(float dtFactor) {
    nukeCooldown -= dtFactor;
    if (nukeCooldown <= 0 && nukeUnlocked) {
        Shockwave shockwave = new Shockwave(pos, nukeDamage, nukeRange);
        shockwave.followPlayer = true;
        shockwaves.Add(shockwave);
        nukeCooldown = nukeMaxCooldown;
    }
}
```

---

## 7. SHIELD SYSTEM

### Shield Mechanics
The player has segmented rotating shields that absorb damage:

```csharp
public class ShieldSystem {
    public float shieldRadius = 75f;
    public int[] shieldSegments;  // Each index = HP of that segment (typically 2)
    public float shieldRotation = 0f;

    public int[] outerShieldSegments;  // Extra shield ring (1 HP each)
    public float outerShieldRadius = 114f;
    public float outerShieldRotation = 0f;

    // Shield regeneration
    public float shieldRegenRate = 8f;  // Seconds per segment
    public long lastShieldRegenTime;

    public void Update(float dtFactor) {
        // Rotate shields
        shieldRotation += 0.02f * dtFactor;
        if (outerShieldSegments.Length > 0) {
            outerShieldRotation -= 0.026f * dtFactor;
        }

        // Regenerate shields
        long now = GetCurrentTimeMs();
        if (now - lastShieldRegenTime > shieldRegenRate * 1000) {
            int emptyIdx = Array.FindIndex(shieldSegments, s => s < 2);
            if (emptyIdx >= 0) {
                shieldSegments[emptyIdx] = 2;
            }
            lastShieldRegenTime = now;
        }
    }

    public void TakeDamage(ref int damage) {
        int remaining = damage;

        // Outer shield absorbs first (1 HP per segment)
        for (int i = 0; i < outerShieldSegments.Length && remaining > 0; i++) {
            if (outerShieldSegments[i] > 0) {
                outerShieldSegments[i] = 0;
                remaining--;
            }
        }

        // Inner shield absorbs remaining (2 HP per segment)
        for (int i = 0; i < shieldSegments.Length && remaining > 0; i++) {
            int absorb = Math.Min(remaining, shieldSegments[i]);
            shieldSegments[i] -= absorb;
            remaining -= absorb;
        }

        damage = remaining;  // Overflow goes to hull
    }
}
```

### Shield Rendering
```csharp
public void DrawShields(SpriteBatch spriteBatch) {
    // Inner shield
    int segCount = shieldSegments.Length;
    float segAngle = (2 * Math.PI) / segCount;

    for (int i = 0; i < segCount; i++) {
        if (shieldSegments[i] > 0) {
            float a0 = i * segAngle + 0.1f;
            float a1 = (i + 1) * segAngle - 0.1f;
            float alpha = Math.Max(0.15f, Math.Min(1f, shieldSegments[i] / 2f));

            DrawArc(shieldRadius, a0 + shieldRotation, a1 + shieldRotation,
                    Color.Cyan * alpha, 3f);
        }
    }

    // Outer shield (if present)
    if (outerShieldSegments.Length > 0) {
        int outerCount = outerShieldSegments.Length;
        float outerAngle = (2 * Math.PI) / outerCount;

        for (int i = 0; i < outerCount; i++) {
            if (outerShieldSegments[i] > 0) {
                float a0 = i * outerAngle + 0.08f;
                float a1 = (i + 1) * outerAngle - 0.08f;

                DrawArc(outerShieldRadius, a0 + outerShieldRotation, a1 + outerShieldRotation,
                        Color.Purple, 4f);
            }
        }
    }
}
```

---

## 8. UPGRADE SYSTEM

### Popup Upgrades (In-Game)
Shown when player levels up. Player chooses 1 of 3 random options.

#### Weapons Upgrades

| ID | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----|--------|--------|--------|--------|--------|
| **Turret Damage** | +20% | +40% | +70% | +100% | +140% |
| **Turret Fire Rate** | +10% | +20% | +30% | +35% | +40% |
| **Turret Range** | +25% | +50% | +100% | +150% | +200% |
| **Multi-Shot** | 2 proj | 3 proj | 4 proj | 5 proj | 6 proj |
| **Shotgun** | 5 pellets | 8 pellets | 12 pellets | 16 pellets | 20 pellets |
| **Homing Missiles** | 2×10 dmg | 2×20 dmg | 2×30 dmg | 2×40 dmg | 2×50 dmg |
| **Volley Shot** | 3 burst | 4 burst | 5 burst | 6 burst | 7 burst |
| **CIWS** | 10 dmg | 20 dmg | 30 dmg | 40 dmg | 50 dmg |
| **Chain Lightning** | 1×200u | 2×250u | 3×300u | 4×350u | 5×400u |

#### Shield & Hull Upgrades

| ID | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----|--------|--------|--------|--------|--------|
| **Hull Strength** | +25 HP | +25 HP | +25 HP | +25 HP | +25 HP |
| **Segment Count** | +2 (10) | +4 (14) | +8 (18) | +12 (26) | +16 (30) |
| **Outer Shield** | 6 purple | 8 purple | 12 purple | 16 purple | 20 purple |
| **Shield Regen** | 1/5s | 1/3s | 1/1s | 1/0.75s | 1/0.5s |
| **Hull Regen** | 1 HP/5s | 2 HP/5s | 3 HP/5s | 4 HP/5s | 5 HP/5s |
| **Reactive Shield** | On kill | 2 seg/kill | 3 seg/kill, +25% HP | 4 seg/kill, +50% HP | 5 seg/kill, +75% HP |
| **Damage Mitigation** | -10%, +5% spd | -20%, +10% spd | -30%, +15% spd | -40%, +20% spd | -50%, +25% spd |

#### Mobility Upgrades

| ID | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----|--------|--------|--------|--------|--------|
| **Speed** | +15% | +30% | +50% | +75% | +100% |
| **Turbo Boost** | 2s dur | 3.5s dur | 5s dur | 6.5s dur | 8s dur |

#### Special Upgrades

| ID | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----|--------|--------|--------|--------|--------|
| **Area Nuke** | 600u, 200 dmg | 700u, 300 dmg | 900u, 400 dmg | 1000u, 500 dmg | 1200u, 600 dmg |
| **Phase Shield** | 3s/20s CD | 5s/15s CD | 7s/10s CD | 9s/8s CD | 12s/6s CD |
| **Stasis Field** | 3s freeze | 5s, +25% area | 8s, +25% area | 10s, +25% area | 12s, +50% area |

### Meta Shop Upgrades (Permanent)
Purchased with Space Nuggets between runs.

| Upgrade ID | Effect (per tier) | Max Tiers |
|------------|-------------------|-----------|
| **startDamage** | +10% base damage | 10 |
| **passiveHp** | +5 max HP | 10 |
| **hullPlating** | +15 max HP | 10 |
| **shieldCore** | +1 segment / +1 HP per seg | 10 |
| **staticBlueprint** | Rear → Side → Forward lasers | 10 |
| **missilePrimer** | 2 missiles ×10 dmg | 10 |
| **nukeCapacitor** | 1 fireball ×50 dmg | 10 |
| **speedTuning** | +10% max speed | 10 |
| **bankMultiplier** | +25% nuggets | 10 |
| **shopDiscount** | -10% cost | 10 |
| **extraLife** | +1 extra life | 10 |
| **droneFabricator** | Unlock drones | 10 |
| **piercingRounds** | Pierce 1 enemy | 10 |
| **explosiveRounds** | 20% explosion | 10 |
| **criticalStrike** | 5% crit 2x dmg | 10 |
| **splitShot** | 10% split chance | 10 |
| **thornArmor** | Reflect 10% | 10 |
| **lifesteal** | Heal 1 HP/kill | 10 |
| **evasionBoost** | 5% dodge | 10 |
| **shieldRecharge** | Regen 1 seg/30s | 10 |
| **dashCooldown** | -1s CD | 10 |
| **dashDuration** | +0.5s duration | 10 |
| **autoReroll** | 10% free reroll | 10 |
| **contractSpeed** | +10% speed | 10 |
| **startingRerolls** | Start +1 token | 10 |
| **luckyDrop** | +5% HP, +2% nugs | 10 |
| **bountyHunter** | +5 nugs elite | 10 |
| **comboMeter** | +1% per 10 stacks | 10 |
| **startingWeapon** | Shotgun tier 1 | 10 |
| **secondWind** | 0.5s i-frames | 10 |
| **batteryCapacitor** | 100 dmg AOE | 10 |

---

## 9. ENEMIES

### Enemy Base Class
```csharp
public class Enemy : Entity {
    public string type;  // "roamer", "elite_roamer", "hunter", "defender", "gunboat"
    public string nameTag;  // Named elites: "NOVA", "SHADE", etc.
    public string modifier;  // "explosive", "split", "stealth"

    // Stats
    public int hp;
    public float maxSpeed;
    public float thrustPower = 0.72f;
    public float turnSpeed = (2 * Math.PI) / (4 * 60f);  // 4 seconds to turn 360
    public float friction = 0.94f;

    // Shields
    public int[] shieldSegments;
    public float shieldRadius;
    public float shieldRotation;

    // AI
    public string aiState;  // SEEK, ORBIT, ATTACK_RUN, FLANK, CIRCLE, RETREAT, EVADE
    public float aiTimer;
    public int flankSide;
    public bool circleStrafePreferred;

    // Combat
    public float shootTimer;
    public float shootInterval;
}
```

### Enemy Stats Table

| Enemy Type | HP | Radius | Speed | Shields | Fire Rate | Range |
|------------|-----|--------|-------|---------|-----------|-------|
| **Roamer** | 50→100 | 60 | 13.6× | None | 13 frames | 600u |
| **Elite Roamer** | 160+20×tier | 57 | 14.3× | 6×10 HP | 10 frames | 600u |
| **Hunter** | 220+30×tier | 66 | 13.0+0.5×tier | 4×10 HP | 7 frames | 800u |
| **Defender** | 150+20×tier | 60 | 13.6× | 4×10 HP | 13 frames | 600u |
| **Gunboat Lvl 1** | 200+10×tier | 84 | 8.0 | 8-10×10 HP | 11 frames | 900u |
| **Gunboat Lvl 2** | 260+10×tier | 84 | 8.0 | 10-14×20-30 HP | 9 frames | 900u |

× = multiplied by difficulty tier (1-6+)

### Enemy AI States

| State | Description | Movement |
|-------|-------------|----------|
| **SEEK** | Move toward player | Direct approach |
| **ORBIT** | Circle around player | Maintain distance |
| **FLANK** | Strafe around player | Perpendicular movement |
| **ATTACK_RUN** | Aggressive approach | Close distance |
| **CIRCLE** | Keep distance and circle | Maintain orbital position |
| **RETREAT** | Return to base | Move to assigned base |
| **EVADE** | Dodge bullets | Perpendicular to threats |

### AI State Machine
```csharp
public void UpdateAI() {
    float distToPlayer = DistanceTo(player.pos);

    if (circleStrafePreferred) {
        aiState = "CIRCLE";
        aiTimer = 45f;
    } else if (type == "roamer" || type == "elite_roamer") {
        // Check for nearby allies (bunching)
        int neighbors = CountNeighborsWithin(200f);

        if (neighbors >= 2) {
            aiState = "FLANK";
            flankSide = RandomSign();
            aiTimer = 30f + Random() * 20f;
        } else if (distToPlayer > 700f) {
            aiState = "SEEK";
            aiTimer = 20f + Random() * 10f;
        } else {
            float roll = Random();
            if (roll < 0.4f) {
                aiState = "ATTACK_RUN";
                aiTimer = 60f + Random() * 30f;
            } else if (roll < 0.65f) {
                aiState = "SEEK";
                aiTimer = 30f + Random() * 15f;
            } else {
                aiState = "ORBIT";
                aiTimer = 90f + Random() * 30f;
            }
        }
    }
}
```

### Enemy Movement
```csharp
public void UpdateMovement(float dtFactor) {
    Vector2 desiredVel = GetDesiredVelocity();

    // Add dodge force (elite enemies)
    if (type == "elite_roamer" || difficultyTier >= 4) {
        desiredVel += CalculateDodgeForce();
    }

    // Add separation force (avoid crowding)
    desiredVel += CalculateSeparationForce(150f, 2.0f);

    // Add obstacle avoidance
    desiredVel += CalculateObstacleAvoidance();

    // Smooth direction changes
    smoothDir.x = smoothDir.x * 0.92f + desiredVel.x * 0.08f;
    smoothDir.y = smoothDir.y * 0.92f + desiredVel.y * 0.08f;

    // Rotate towards desired direction
    float targetAngle = Atan2(smoothDir.y, smoothDir.x);
    RotateTowards(targetAngle, dtFactor);

    // Apply thrust
    if (Dot(forward, smoothDir) > 0.3f) {
        float thrust = thrustPower * dtFactor;
        vel.x += Cos(angle) * thrust;
        vel.y += Sin(angle) * thrust;
    }

    // Clamp speed
    float currentMaxSpeed = maxSpeed;
    if (aiState == "FLANK") currentMaxSpeed *= 1.6f;
    if (aiState == "CIRCLE") currentMaxSpeed *= 1.15f;

    ClampVelocity(currentMaxSpeed);

    // Apply friction
    vel.x *= (float)Math.Pow(friction, dtFactor);
    vel.y *= (float)Math.Pow(friction, dtFactor);

    // Update position
    pos.x += vel.x * dtFactor;
    pos.y += vel.y * dtFactor;
}
```

### Elite Modifiers
12% chance for elite enemies to have special modifiers:

| Modifier | Name Tags | Effect |
|----------|-----------|--------|
| **Explosive** | All | On death, fires 8 bullets in all directions |
| **Split** | All | Fires extra bullet with spread |
| **Stealth** | All | Transparency oscillates 40-80% |

---

## 10. BOSSES

### Cruiser (Main Boss)

```csharp
public class Cruiser : Enemy {
    public int encounterIndex;  // 1-3+
    public Phase currentPhase;

    // Hardpoints
    public Hardpoint[] hardpoints;
    // Types: LC/RC (cannon), SP (sprayer), MB (bay), SG (shieldgen)

    // Phases: SALVO (180f), CURTAIN (150f), MINEFIELD (150f), SWEEP (150f), CHARGE (110f)
}
```

**Phase Sequence** (rotates by encounter):
1. SALVO - Cannon fire from rear hardpoints
2. CURTAIN - Sprayer covers arc in front
3. MINEFIELD - Bay drops bombs
4. SWEEP - Wide sprayer sweep
5. CHARGE - High-speed straight charge

**Encounter Scaling**:
- HP: `150 × (1 + 0.35 × (encounterIndex - 1)) × hpScale`
- Shield Strength: `2 + encounterIndex`
- Charge Speed: 25

**AI Movement by Phase**:
| Phase | Speed | Behavior |
|-------|-------|----------|
| SEEK | 13.8 | Move toward player |
| ORBIT | 8.25 | Circle player |
| FLANK | 14.95 | Strafe |
| CIRCLE | 10.35 | Maintain orbit |
| CHARGE | 25.0 | Straight line attack |

### Destroyer (Space Station)

```csharp
public class Destroyer : Enemy {
    public int escalationPhase;  // 1-3
    public float escalationMultiplier;  // 1.0, 1.3, 1.6

    // Phase Shield
    public float invulnerableDuration;
    public int shieldStrengthPerPhase[];
    public float shieldRechargeMs;

    // Reinforcement spawning
    public int helperMax = 8;
    public int helperCooldown = 20s;  // 1200 frames
}
```

**Phase System**:
- Phase 1: Standard behavior
- Phase 2: +30% damage multiplier
- Phase 3: +60% damage multiplier

**Summoned Drones**:
- Count: 4-5 per wave
- HP scales with strength tier
- Max 8 drones active at once

### Dungeon Bosses

All dungeon bosses share the same structure with unique phases and assets.

| Boss | Asset | HP Range | Unique Mechanics |
|------|-------|----------|------------------|
| **NecroticHive** | dungeon4.png | 300-500 | Drone swarm, chitin barrage |
| **CerebralPsion** | dungeon5.png | 350-600 | Psychic attacks, mind control |
| **Fleshforge** | dungeon6.png | 400-700 | Biological attacks, minions |
| **VortexMatriarch** | dungeon7.png | 450-800 | Gravity wells, teleportation |
| **ChitinusPrime** | dungeon8.png | 500-900 | Swarm attacks, armor plating |
| **PsyLich** | dungeon9.png | 550-1000 | Phase shift, spectral attacks |

### Dungeon Boss HP Formula
```csharp
float CalculateDungeonBossHP(string bossId) {
    float baseHp = bossId switch {
        "dungeon4" => 300f,
        "dungeon5" => 350f,
        "dungeon6" => 400f,
        "dungeon7" => 450f,
        "dungeon8" => 500f,
        "dungeon9" => 550f,
        _ => 300f
    };

    // Scale with game progress
    float elapsedMs = GetElapsedGameTime();
    float timeScale = 1f + (elapsedMs / 1800000f) * 3f;  // 1x to 4x over 30 min

    return baseHp * timeScale;
}
```

---

## 11. PROJECTILES

### Bullet Class
```csharp
public class Bullet : Entity {
    public float damage;
    public float radius = 4f;
    public string owner;  // "player" or "enemy"
    public float life = 50f;
    public int pierceCount = 0;
    public int homing;  // 0=none, 1=weak, 2=strong
    public bool isExplosive;
    public bool ignoreShields;
}
```

### Projectile Speeds
| Projectile | Speed |
|------------|-------|
| Player Turret | 15 |
| Player Shotgun | 12-16 |
| Player CIWS | 18 |
| Enemy Bullet | 11-22 |
| Homing Missile | 12 |
| Cruiser Bullet | 18 |

### Projectile Life (frames)
| Projectile | Base Life | With Range Mult |
|------------|-----------|-----------------|
| Player Turret | 50 | 50 × rangeMult |
| Player Shotgun | 23 | 23 × rangeMult × tierMult |
| Enemy Bullet | 180-300 | Fixed |

### Homing Missile Logic
```csharp
public void Update(float dtFactor) {
    life -= dtFactor;

    if (homing > 0 && target != null && !target.dead) {
        float turnRate = homing == 1 ? 0.1f : 0.4f;
        float targetAngle = Atan2(target.pos.y - pos.y, target.pos.x - pos.x);

        float angleDiff = targetAngle - angle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        angle += Math.Sign(angleDiff) * Math.Min(Math.Abs(angleDiff), turnRate * dtFactor);
    }

    pos.x += Cos(angle) * speed * dtFactor;
    pos.y += Sin(angle) * speed * dtFactor;
}
```

### Shockwave (Area Damage)
```csharp
public class Shockwave : Entity {
    public float damage;
    public float maxRadius;
    public float currentRadius;
    public float travelSpeed = 15f;
    public bool followPlayer;
    public bool damageAsteroids = true;
    public bool damageEnemies = true;
    public bool damageBases = true;

    public void Update(float dtFactor) {
        currentRadius += travelSpeed * dtFactor;

        if (followPlayer) {
            pos.x = player.pos.x;
            pos.y = player.pos.y;
        }

        // Damage entities at radius
        DamageEntitiesInRadius(currentRadius);

        if (currentRadius >= maxRadius) {
            dead = true;
        }
    }
}
```

---

## 12. COLLISION DETECTION

### Spatial Hash Implementation

```csharp
public class SpatialHash {
    private float cellSize;
    private Dictionary<(int, int), List<Entity>> grid = new();

    public SpatialHash(float cellSize) {
        this.cellSize = cellSize;
    }

    public void Clear() {
        grid.Clear();
    }

    public void Insert(Entity entity) {
        int minX = (int)Math.Floor((entity.pos.x - entity.radius) / cellSize);
        int maxX = (int)Math.Floor((entity.pos.x + entity.radius) / cellSize);
        int minY = (int)Math.Floor((entity.pos.y - entity.radius) / cellSize);
        int maxY = (int)Math.Floor((entity.pos.y + entity.radius) / cellSize);

        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                var key = (x, y);
                if (!grid.ContainsKey(key))
                    grid[key] = new List<Entity>();
                grid[key].Add(entity);
            }
        }
    }

    public List<Entity> Query(float x, float y, float radius) {
        var result = new List<Entity>();
        int minX = (int)Math.Floor((x - radius) / cellSize);
        int maxX = (int)Math.Floor((x + radius) / cellSize);
        int minY = (int)Math.Floor((y - radius) / cellSize);
        int maxY = (int)Math.Floor((y + radius) / cellSize);

        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                var key = (x, y);
                if (grid.ContainsKey(key)) {
                    foreach (var entity in grid[key]) {
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

### Spatial Hash Grids
```csharp
// Create grids
SpatialHash asteroidGrid = new(300f);  // Asteroids, environment
SpatialHash targetGrid = new(350f);    // Enemies, bosses, bases
SpatialHash bulletGrid = new(150f);    // Projectiles

// Rebuild each frame
asteroidGrid.Clear();
targetGrid.Clear();
bulletGrid.Clear();

foreach (var asteroid in asteroids) asteroidGrid.Insert(asteroid);
foreach (var enemy in enemies) targetGrid.Insert(enemy);
foreach (var bullet in bullets) bulletGrid.Insert(bullet);
```

### Collision Check Pattern
```csharp
public void CheckCollisions() {
    // Player bullets vs Enemies
    foreach (Bullet bullet in bullets) {
        if (bullet.owner == "enemy") continue;

        var potentialTargets = targetGrid.Query(bullet.pos.x, bullet.pos.y, bullet.radius + 100f);
        foreach (Entity target in potentialTargets) {
            if (target.dead) continue;

            float dist = Distance(bullet.pos, target.pos);
            if (dist < bullet.radius + target.radius) {
                // Hit!
                target.hp -= bullet.damage;
                bullet.life = 0;  // Destroy bullet

                if (bullet.pierceCount > 0) {
                    bullet.pierceCount--;
                    bullet.life = 1;  // Keep alive
                }
            }
        }
    }

    // Player vs Enemy Bullets
    foreach (Bullet bullet in bullets) {
        if (bullet.owner == "player") continue;

        float dist = Distance(bullet.pos, player.pos);
        if (dist < bullet.radius + player.radius) {
            player.TakeDamage(bullet.damage);
            bullet.life = 0;
        }
    }
}
```

---

## 13. PARTICLES & EFFECTS

### Particle Class
```csharp
public class Particle : Entity {
    public float life;
    public float maxLife;
    public Color color;
    public float size;
    public bool glow;

    public void Update(float dtFactor) {
        life -= dtFactor;

        // Fade out
        alpha = life / maxLife;

        // Move with velocity
        pos.x += vel.x * dtFactor;
        pos.y += vel.y * dtFactor;
    }
}
```

### Explosion Class
```csharp
public class Explosion : Entity {
    public float scale;
    public int frame = 0;
    public const int TOTAL_FRAMES = 20;

    public void Update(float dtFactor) {
        frameTimer -= dtFactor;
        if (frameTimer <= 0) {
            frame++;
            frameTimer = 3f;  // 3 frames per sprite frame
        }
        if (frame >= TOTAL_FRAMES) {
            dead = true;
        }
    }
}
```

**Explosion Sprite Sheet**: `assets/explosion1.png` is 4×5 (20 frames), 1024×1024

### Particle Spawning
```csharp
public void SpawnParticles(float x, float y, int count, string color) {
    for (int i = 0; i < count; i++) {
        Particle p = new Particle();
        p.pos.x = x;
        p.pos.y = y;
        p.life = 30f + Random() * 30f;
        p.maxLife = p.life;

        float angle = Random() * 2 * Math.PI;
        float speed = 1f + Random() * 2f;
        p.vel.x = Math.Cos(angle) * speed;
        p.vel.y = Math.Sin(angle) * speed;

        p.color = ParseColor(color);
        p.size = 2f + Random() * 3f;
        p.glow = true;

        particles.Add(p);
    }
}
```

---

## 14. UI & HUD

### HUD Layout
```
┌──────────────────────────────────────────────┐
│ SCORE: 125,430           TIME: 12:34         │
│                                               │
│ HP:  ████░░░░ 100/150                        │
│ SH:  ■■■□□□ 3/6                              │
│                                               │
│ ┌─────────────────────────────────────┐     │
│ │                                     │     │
│ │            MINIMAP                   │     │
│ │                                     │     │
│ └─────────────────────────────────────┘     │
│                                               │
│ XP: [████████░░] 8,450/10,000   LVL 15      │
│                                               │
│ [TURBO: ████░░]  [BATTERY: 87%]             │
└──────────────────────────────────────────────┘
```

### Minimap
```csharp
public void DrawMinimap() {
    float mapSize = 150f;
    float mapX = screenWidth - mapSize - 20f;
    float mapY = screenHeight - mapSize - 20f;

    // Draw background
    DrawRect(mapX, mapY, mapSize, mapSize, Color.Black * 0.5f);

    // Draw player (center of world = center of minimap)
    float playerMapX = mapX + mapSize / 2f;
    float playerMapY = mapY + mapSize / 2f;
    DrawCircle(playerMapX, playerMapY, 3f, Color.Cyan);

    // Draw enemies
    foreach (Enemy enemy in enemies) {
        float relX = (enemy.pos.x - player.pos.x) / 50f;  // Scale: 50 pixels = 1 minimap pixel
        float relY = (enemy.pos.y - player.pos.y) / 50f;

        float ex = playerMapX + relX;
        float ey = playerMapY + relY;

        if (ex > mapX && ex < mapX + mapSize && ey > mapY && ey < mapY + mapSize) {
            DrawCircle(ex, ey, 2f, Color.Red);
        }
    }

    // Draw border
    DrawRectBorder(mapX, mapY, mapSize, mapSize, Color.White, 2f);
}
```

### Directional Indicators
When important entities are off-screen, show arrows pointing to them:

```csharp
public void DrawDirectionalIndicator(Vector2 targetPos, Color color, string label) {
    Vector2 toTarget = targetPos - player.pos;
    float distance = toTarget.Length();
    float angle = Atan2(toTarget.Y, toTarget.X);

    if (distance > screenDiagonal / 2f) {
        // Calculate edge position
        float edgeDist = screenDiagonal / 2f - 50f;
        float arrowX = screenCenter.X + Cos(angle) * edgeDist;
        float arrowY = screenCenter.Y + Sin(angle) * edgeDist;

        // Draw arrow
        DrawArrow(arrowX, arrowY, angle, color);

        // Draw label
        DrawText(label, arrowX, arrowY - 20f, color);
    }
}
```

---

## 15. ASSET REFERENCES

### All Graphics Assets (Reusable)

#### Player
```
assets/player1.png          - Standard ship hull
assets/slacker.png          - Slacker ship hull
assets/player_turret_base.png - Turret base
assets/player_barrel.png    - Turret barrel(s)
assets/player_thruster.png  - Engine thruster
assets/player_turbo_flame.png - Turbo boost flame
```

#### Enemies
```
assets/roamer1.png         - Basic roamer
assets/roamer_elite.png    - Elite roamer
assets/hunter.png          - Hunter
assets/defender.png        - Defender
assets/gunboat1.png        - Gunboat level 1
assets/gunboat2.png        - Gunboat level 2
```

#### Bosses
```
assets/cruiser.png         - Cruiser boss
assets/station1.png        - Space Station / Destroyer
assets/spaceboss2.png      - Final Boss (Flagship)
assets/dungeon4.png        - NecroticHive
assets/dungeon5.png        - CerebralPsion
assets/dungeon6.png        - Fleshforge
assets/dungeon7.png        - VortexMatriarch
assets/dungeon8.png        - ChitinusPrime
assets/dungeon9.png        - PsyLich
```

#### Environment
```
assets/asteroid1.png       - Large asteroid
assets/asteroid2.png       - Medium asteroid
assets/asteroid3.png       - Small asteroid
assets/asteroid2_U.png     - Indestructible asteroid
assets/pinwheel.png        - Pinwheel base
assets/base.png            - Generic base
assets/warpgate.png        - Warp gate
```

#### Pickups
```
assets/coin.png            - Coin pickup
assets/nugget.png          - Space Nugget
assets/medkit.png          - Health pickup
assets/sparkle.png        - Sparkle effect
```

#### Effects
```
assets/explosion1.png      - Explosion sprite sheet (4x5 = 20 frames)
```

### All Sound Assets (Reuse from `assets/sfx/`)
```
background1.mp3           - Background music
interstellar_destroyer.mp3 - Boss music
shoot.mp3                  - Shooting sound
explode.mp3                - Explosion sound
hit.mp3                    - Player hit sound
shield_hit.mp3             - Shield hit sound
powerup.mp3                - Powerup/upgrade sound
levelup.mp3                - Level up sound
coin.mp3                   - Coin pickup sound
warp.mp3                   - Warp sound
base_explode.mp3           - Base/gunboat explosion
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Core Foundation
- [ ] Set up MonoGame project
- [ ] Implement variable timestep game loop (120Hz physics, 60Hz render)
- [ ] Create Entity base class with position, velocity, collision
- [ ] Implement Spatial Hash collision detection
- [ ] Create GameContext singleton for state management

### Phase 2: Player
- [ ] Implement Spaceship class
- [ ] Add keyboard/mouse/gamepad input
- [ ] Implement movement physics (thrust, friction, velocity clamping)
- [ ] Add rotation controls
- [ ] Create turret aiming system

### Phase 3: Weapons
- [ ] Implement Bullet class
- [ ] Create main turret firing
- [ ] Add multi-shot upgrade
- [ ] Implement shotgun
- [ ] Add static weapons system

### Phase 4: Shields
- [ ] Create shield segment system
- [ ] Implement shield rotation
- [ ] Add shield damage absorption
- [ ] Create outer shield ring
- [ ] Add shield regeneration

### Phase 5: Enemies
- [ ] Implement Enemy base class
- [ ] Create AI state machine
- [ ] Add different enemy types (roamer, elite, hunter, defender)
- [ ] Implement enemy shooting
- [ ] Add enemy spawning system

### Phase 6: Collision & Combat
- [ ] Implement bullet-enemy collision
- [ ] Add enemy-bullet-player collision
- [ ] Create damage numbers
- [ ] Add shield collision
- [ ] Implement death/drops

### Phase 7: Upgrades
- [ ] Create XP system
- [ ] Implement level-up menu
- [ ] Add upgrade data definitions
- [ ] Implement upgrade application
- [ ] Create meta shop

### Phase 8: Bosses
- [ ] Implement Cruiser boss
- [ ] Add phase system
- [ ] Create hardpoint system
- [ ] Implement Destroyer boss
- [ ] Add dungeon bosses

### Phase 9: UI & Polish
- [ ] Create HUD
- [ ] Add minimap
- [ ] Implement directional indicators
- [ ] Add particle effects
- [ ] Create explosion effects

### Phase 10: Content
- [ ] Copy all graphics assets
- [ ] Copy all sound assets
- [ ] Implement full game flow (start, play, game over, restart)
- [ ] Add save/load system

---

**END OF COMPLETE MIGRATION GUIDE**

This guide contains all information needed to recreate Spacebros from scratch. All game mechanics, formulas, values, and systems are documented above. The only remaining work is implementation in the target engine.
