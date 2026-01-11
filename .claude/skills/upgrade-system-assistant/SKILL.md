---
name: upgrade-system-assistant
description: Create and balance game upgrades for Spacebros1. Generate upgrade definitions with proper tier scaling, calculate balance curves, and manage popup/meta shop upgrades. Use when adding new weapons, shields, abilities, or meta progression upgrades.
metadata:
  short-description: Manage game upgrades
---

# Upgrade System Assistant

Create and balance upgrades for the Spacebros1 upgrade system.

## Upgrade Categories

There are two upgrade systems:

### 1. Popup/Level-Up Upgrades (`UPGRADE_DATA`)
In-game upgrades that appear during gameplay. Categories:
- **Weapons** - Turret mods, special weapons
- **Shields & Hull** - Defense and survivability
- **Mobility** - Movement and speed
- **Specials** - Active/passive abilities
- **Drones** - Companion units

### 2. Meta Shop Upgrades (`META_SHOP_UPGRADE_DATA`)
Permanent progression purchased with Space Nuggets:
- **Core Upgrades** - Starting stats and abilities
- **Combat Upgrades** - Damage and combat bonuses
- **Utility Upgrades** - Quality of life improvements
- **Advanced Upgrades** - Special mechanics

## Upgrade Definition Structure

### Popup Upgrade Template

```javascript
{
    id: "upgrade_id",           // Unique identifier (snake_case)
    name: "Display Name",       // User-facing name
    tier1: "First tier text",   // What tier 1 does
    tier2: "Second tier text",  // What tier 2 does
    tier3: "Third tier text",   // What tier 3 does
    // Optional: tier4, tier5 for upgrades with 5 tiers
    notes: "Short description of the upgrade's purpose and mechanics."
}
```

### Meta Shop Upgrade Template

```javascript
{
    id: "meta_upgrade_id",
    name: "Upgrade Name",
    description: "What this upgrade does",
    maxLevel: 5,                // Maximum purchase level
    baseCost: 100,              // Base cost in Space Nuggets
    costMultiplier: 1.5,        // Cost scaling per level
    effect: (level) => {
        // Function returning the effect at given level
        return level * 10;      // Example: +10 per level
    }
}
```

## Location

**File:** `src/js/core/constants.js`

**Popup upgrades:** Lines ~78-200 (`UPGRADE_DATA` constant)
**Meta upgrades:** Lines ~200-400 (`META_SHOP_UPGRADE_DATA` constant)

## Balance Guidelines

### Damage Upgrades

| Tier | Damage Increase | Notes |
|------|----------------|-------|
| Tier 1 | +20-25% | Starting boost |
| Tier 2 | +40-50% total | Noticeable improvement |
| Tier 3 | +70-80% total | Significant power |
| Tier 4 | +100-120% total | Major upgrade |
| Tier 5 | +140-160% total | Near-max power |

### Fire Rate Upgrades

| Tier | RPS Increase | Notes |
|------|--------------|-------|
| Tier 1 | +15% RPS | Slight speedup |
| Tier 2 | +30% total | Noticeable |
| Tier 3 | +50% total | Fast firing |
| Tier 4 | +75% total | Very fast |
| Tier 5 | +100% total | Double fire rate |

### Health/Shield Upgrades

| Tier | Effect | Notes |
|------|--------|-------|
| Tier 1 | +25 max HP, heal 25 | Immediate benefit |
| Tier 2 | +50 total | Stacks additively |
| Tier 3 | +75 total | Significant buffer |

## Common Upgrade Patterns

### Multiplicative Stacking

```javascript
// Example: Fire rate stacks multiplicatively
tier1: "+15% RPS",
tier2: "+30% total",    // 1.15 * current rate
tier3: "+50% total",    // Continues from previous
```

### Additive Stacking

```javascript
// Example: Hull strength adds flat HP
tier1: "+25 Max HP, Heal 25",
tier2: "+25 Max HP, Heal 25",  // Adds another +25 (total +50)
tier3: "+25 Max HP, Heal 25",  // Adds another +25 (total +75)
```

### Unlock-Based

```javascript
// Example: New features unlocked at tiers
tier1: "Unlock feature",
tier2: "Upgrade feature",
tier3: "Max upgrade feature",
```

## Creating New Upgrades

### Step 1: Choose Category

Determine if the upgrade belongs in:
- Weapons (damage, fire rate, special weapons)
- Shields & Hull (HP, shields, regen)
- Mobility (speed, boost)
- Specials (active abilities, passives)
- Drones (companions)

### Step 2: Define Scaling

Decide on tier count (3-5 tiers) and scaling:
- **3 tiers**: Standard upgrades
- **4 tiers**: Important upgrades
- **5 tiers**: Core/flagship upgrades

### Step 3: Write Descriptions

Keep descriptions concise:
- Use "+X% total" for cumulative bonuses
- Use "Unlock: X" for new features
- Include specific numbers where possible

### Step 4: Add to Constants

Insert into appropriate category in `src/js/core/constants.js`:

```javascript
{
    name: "Weapons",
    upgrades: [
        // ... existing upgrades ...
        { id: "my_new_upgrade", name: "My Upgrade", tier1: "...", tier2: "...", tier3: "...", notes: "..." }
    ]
}
```

## Implementation Notes

After adding upgrade definitions:

1. **Game Logic Integration**: Add effect handling in `src/js/main.js`
   - Look for `if (hasUpgrade('upgrade_id'))` patterns
   - Add level checks: `getUpgradeLevel('upgrade_id')`

2. **UI Display**: Ensure upgrade shows correctly in level-up menu

3. **Balance Testing**: Test each tier in actual gameplay

## Meta Shop Cost Formula

```
cost = baseCost * (costMultiplier ^ (level - 1))
```

Example with `baseCost: 100, costMultiplier: 1.5`:
- Level 1: 100 nuggets
- Level 2: 150 nuggets
- Level 3: 225 nuggets
- Level 4: 338 nuggets
- Level 5: 506 nuggets

## Existing Upgrade IDs

**Weapons:**
- `turret_damage`, `turret_fire_rate`, `turret_range`
- `multi_shot`, `shotgun`, `static_weapons`
- `homing_missiles`, `volley_shot`, `ciws`
- `chain_lightning`, `backstabber`

**Shields & Hull:**
- `hull_strength`, `segment_count`, `outer_shield`
- `shield_regen`, `hp_regen`
- `reactive_shield`, `damage_mitigation`

**Mobility:**
- `speed`, `turbo_boost`

**Specials:**
- `xp_magnet`, `area_nuke`, `invincibility`
- `slow_field`, `time_dilation`, `momentum`

**Drones:**
- `companion_drones`
