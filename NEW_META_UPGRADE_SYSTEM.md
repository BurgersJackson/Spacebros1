# New Meta Upgrade System Design

## Overview

This document outlines a complete redesign of meta upgrade system for Spacebros1. The goal is to remove all upgrades that contribute to direct damage output or fire rate increases, replacing them with unique quality-of-life and utility enhancements that cannot be obtained through in-game upgrades.

**Design Principles:**

- Meta upgrades should provide unique mechanics unavailable in-game
- No direct damage boosts or fire rate increases
- Focus on QoL, resource management, survivability, and build control
- Keep system concise (10-15 upgrades total)
- Maintain progression satisfaction without power creep

---

## Removals: Current Meta Upgrades to Delete

The following upgrades will be completely removed as they contribute to DPS or fire rate:

### Damage-Increasing Upgrades

1. **startDamage** - Increased base damage multiplies all weapon damage
2. **criticalStrike** - Chance for double damage
3. **comboMeter** - Damage increases with consecutive hits
4. **explosiveRounds** - AOE damage on projectile impact
5. **nukeCapacitor** - Orbiting fireballs that deal contact damage

### Fire Rate/Projectile Count Upgrades

1. **splitShot** - Extra projectiles per shot
2. **piercingRounds** - Piercing allows hitting multiple enemies per shot
3. **missilePrimer** - Unlocks homing missiles that deal damage
4. **staticBlueprint** - Unlocks static weapons that deal damage

### Rationale

All of these upgrades compound multiplicatively with in-game damage and fire rate upgrades, creating exponential power scaling that makes the game trivial too quickly. Meta upgrades should enhance the player's experience, not trivialize combat.

---

## Retained: Current Upgrades to Keep

The following upgrades will be kept as they don't directly affect damage output or fire rate:

### Survivability Upgrades

1. **passiveHp** - Start with more max health (+5/10/15 HP per tier)
2. **hullPlating** - Major HP increase (+15/30/45 HP per tier)
3. **shieldCore** - Shield capacity and strength (+segments or HP per tier)
4. **thornArmor** - Reflect 10/15/20% damage when hit
5. **lifesteal** - Heal 1/2/3 HP per kill
6. **evasionBoost** - 5/8/12% chance to avoid damage
7. **shieldRecharge** - Regen shield segments over time
8. **secondWind** - 0.5/1.0/1.5s invulnerability after damage
9. **extraLife** - 1/2/3 extra lives per run

### Mobility Upgrades

1. **speedTuning** - +10/20/30% max speed
2. **dashCooldown** - -1/2/3s turbo boost cooldown
3. **dashDuration** - +0.5/1.0/1.5s turbo boost duration

### Economy/Progression Upgrades

1. **bankMultiplier** - +25/50/75% nugs per run
2. **shopDiscount** - -10/20/30% cost on all meta shop purchases
3. **luckyDrop** - +5/10/15% health pickup, +2/4/6% nug drops
4. **bountyHunter** - +5/10/15 nugs per elite, +20/40/60 per boss

### Build Control Upgrades

1. **autoReroll** - 10/20/30% chance for free reroll on level-up
2. **startingRerolls** - Start with 1/2/3 reroll tokens
3. **contractSpeed** - +10/20/30% contract completion speed

### Note on droneFabricator

**Recommendation: REMOVE** - Companion drones deal damage, making this an indirect DPS boost. If kept, drones should only provide utility (shields, healing) and no damage dealing.

**Total Retained:** 19 upgrades (18 if droneFabricator removed)

---

## New Meta Upgrades (Proposed)

### 1. XP Booster

**Description:** Gain XP faster to unlock upgrades earlier

| Tier      | Effect                         |
| --------- | ------------------------------ |
| Tier 1    | +15% XP gain from all sources  |
| Tier 2    | +30% XP gain from all sources  |
| Tier 3    | +45% XP gain from all sources  |
| Tier 4    | +60% XP gain from all sources  |
| Tier 5    | +80% XP gain from all sources  |
| Tier 6-10 | Diminishing returns, max +120% |

**Implementation:**

- Modify `addXp()` in `Spaceship.js` to apply multiplier
- Multiplier stored as `stats.xpMult`
- Applied before level check: `this.xp += amount * this.stats.xpMult`

**File:** `src/js/entities/player/Spaceship.js` (addXp method)

---

### 2. Magnet Field

**Description:** Increase pickup attraction range

| Tier      | Effect                          |
| --------- | ------------------------------- |
| Tier 1    | +20% pickup range (150 → 180u)  |
| Tier 2    | +40% pickup range (150 → 210u)  |
| Tier 3    | +60% pickup range (150 → 240u)  |
| Tier 4    | +80% pickup range (150 → 270u)  |
| Tier 5    | +100% pickup range (150 → 300u) |
| Tier 6-10 | Diminishing returns, max 450u   |

**Implementation:**

- Modify initial `magnetRadius` in `Spaceship.js:102`
- Apply multiplier on game start in `applyMetaUpgrades()`

**Files:**

- `src/js/entities/player/Spaceship.js` (magnetRadius initialization)
- `src/js/systems/meta-manager.js` (applyMetaUpgrades)

---

### 3. Warp Enhancer

**Description:** Improve teleport ability cooldown and distance

| Tier      | Effect                                                    |
| --------- | --------------------------------------------------------- |
| Tier 1    | -0.5s warp cooldown (3s → 2.5s)                           |
| Tier 2    | -1.0s warp cooldown (3s → 2.0s)                           |
| Tier 3    | -1.5s warp cooldown, +20% distance                        |
| Tier 4    | -2.0s warp cooldown, +40% distance                        |
| Tier 5    | -2.5s warp cooldown, +60% distance + 0.5s invulnerability |
| Tier 6-10 | Max 0.5s cooldown, 100% distance, 1s invulnerability      |

**Implementation:**

- Modify `warpCooldown` in `Spaceship.js` (currently 180 frames / 3 seconds)
- Modify warp distance calculation in `warp()` method (currently 3000-5000u)
- Add temporary invulnerability after warp if upgraded

**File:** `src/js/entities/player/Spaceship.js` (warpCooldown, warp method)

---

### 4. Contract Multiplier

**Description:** Increase rewards from contract completions

| Tier      | Effect                             |
| --------- | ---------------------------------- |
| Tier 1    | +25% contract nuggets              |
| Tier 2    | +50% contract nuggets              |
| Tier 3    | +75% contract nuggets, +10% score  |
| Tier 4    | +100% contract nuggets, +20% score |
| Tier 5    | +125% contract nuggets, +30% score |
| Tier 6-10 | Max +200% nuggets, +50% score      |

**Implementation:**

- Modify contract reward calculation in `contract-manager.js`
- Apply multiplier to `rewardNugs` and `rewardScore` when contract completes

**File:** `src/js/systems/contract-manager.js`

---

### 5. More Options

**Description:** See more upgrade choices per level-up

| Tier   | Effect                               |
| ------ | ------------------------------------ |
| Tier 1 | 4 upgrade options instead of 3       |
| Tier 2 | 5 upgrade options instead of 3       |
| Tier 3 | 5 options + better upgrade weighting |

**Implementation:**

- Modify `levelup-screen.js` line 67: `const count = Math.min(3, validUpgrades.length)`
- Change to `const count = Math.min(3 + this.stats.moreOptions, validUpgrades.length)`
- Add `stats.moreOptions` to track tier

**File:** `src/js/ui/levelup-screen.js`

---

### 6. Contract Frequency

**Description:** Contracts appear more frequently

| Tier   | Effect                                                |
| ------ | ----------------------------------------------------- |
| Tier 1 | -5 seconds between contract spawns (45-75s → 40-70s)  |
| Tier 2 | -10 seconds between contract spawns (45-75s → 35-65s) |
| Tier 3 | -15 seconds between contract spawns (45-75s → 30-60s) |
| Tier 4 | -20 seconds between contract spawns (45-75s → 25-55s) |
| Tier 5 | -25 seconds between contract spawns (45-75s → 20-50s) |

**Implementation:**

- Modify contract spawn timer in `contract-manager.js` line 66
- Reduce `nextContractDelay` based on tier

**File:** `src/js/systems/contract-manager.js`

---

### 7. Contract Time Extension

**Description:** More time to complete gate run contracts

| Tier   | Effect                          |
| ------ | ------------------------------- |
| Tier 1 | +5 seconds gate run time limit  |
| Tier 2 | +10 seconds gate run time limit |
| Tier 3 | +15 seconds gate run time limit |
| Tier 4 | +20 seconds gate run time limit |
| Tier 5 | +25 seconds gate run time limit |

**Implementation:**

- Modify gate run time limit in `contract-manager.js` line 109
- Currently: `endsAt: Date.now() + 45000` (45 seconds)
- Add tier bonus: `+ (tier * 5000)`

**File:** `src/js/systems/contract-manager.js`

---

### 8. Leveling Smoothness

**Description:** Reduce XP scaling per level

| Tier   | Effect                                        |
| ------ | --------------------------------------------- |
| Tier 1 | 10% less XP required per level (1.2x → 1.18x) |
| Tier 2 | 20% less XP required per level (1.2x → 1.16x) |
| Tier 3 | 30% less XP required per level (1.2x → 1.14x) |
| Tier 4 | 40% less XP required per level (1.2x → 1.12x) |
| Tier 5 | 50% less XP required per level (1.2x → 1.1x)  |

**Implementation:**

- Modify `nextLevelXp` calculation in `Spaceship.js:279`
- Currently: `this.nextLevelXp = Math.floor(this.nextLevelXp * 1.2)`
- Apply reduction: `* (1.2 - (tier * 0.02))`

**File:** `src/js/entities/player/Spaceship.js`

---

### 9. Score Multiplier

**Description:** Earn score faster for leaderboards/achievements

| Tier   | Effect                       |
| ------ | ---------------------------- |
| Tier 1 | +15% score from all sources  |
| Tier 2 | +30% score from all sources  |
| Tier 3 | +50% score from all sources  |
| Tier 4 | +75% score from all sources  |
| Tier 5 | +100% score from all sources |

**Implementation:**

- Add `stats.scoreMult` multiplier
- Apply to all score additions in `collision-manager.js`
- Example: `GameContext.score += c.value * GameContext.player.stats.scoreMult`

**File:** `src/js/systems/collision-manager.js`

---

### 10. Upgrade Guarantee

**Description:** Ensure at least one upgrade from a specific category

| Tier   | Effect                                         |
| ------ | ---------------------------------------------- |
| Tier 1 | At least 1 survivability option in level-up    |
| Tier 2 | At least 1 survivability AND 1 mobility option |
| Tier 3 | At least 1 of each category in level-up        |

**Implementation:**

- Modify `levelup-screen.js` upgrade selection logic
- Filter valid upgrades to guarantee specific categories
- Use `UPGRADE_DATA.categories` to identify upgrade types

**File:** `src/js/ui/levelup-screen.js`

---

### 11. Difficulty Dampener

**Description:** Slow down difficulty scaling

| Tier   | Effect                                         |
| ------ | ---------------------------------------------- |
| Tier 1 | +1 kill required per difficulty tier (6 → 7)   |
| Tier 2 | +2 kills required per difficulty tier (6 → 8)  |
| Tier 3 | +3 kills required per difficulty tier (6 → 9)  |
| Tier 4 | +4 kills required per difficulty tier (6 → 10) |
| Tier 5 | +5 kills required per difficulty tier (6 → 11) |

**Implementation:**

- Modify difficulty tier calculation in `Enemy.js:303`
- Currently: `GameContext.difficultyTier = 1 + Math.floor(totalDestroyed / 6)`
- Add dampener: `+ this.stats.difficultyDampener`

**File:** `src/js/entities/Enemy.js`

---

### 12. XP from Pickups

**Description:** Pickup coins also grant XP

| Tier   | Effect                      |
| ------ | --------------------------- |
| Tier 1 | Coins grant 10% value as XP |
| Tier 2 | Coins grant 20% value as XP |
| Tier 3 | Coins grant 30% value as XP |
| Tier 4 | Coins grant 40% value as XP |
| Tier 5 | Coins grant 50% value as XP |

**Implementation:**

- Modify coin collision logic in `collision-manager.js:761`
- Add XP gain when coins are collected

**File:** `src/js/systems/collision-manager.js`

---

## Complete Upgrade Categories

After implementing the new system, meta upgrades will be organized into these categories:

### Survivability (7 upgrades)

1. passiveHp - More max HP
2. hullPlating - More max HP
3. shieldCore - Shield segments and HP
4. thornArmor - Reflect damage
5. lifesteal - Heal on kill
6. evasionBoost - Dodge chance
7. extraLife - Extra lives

### Mobility (4 upgrades)

1. speedTuning - Movement speed
2. dashCooldown - Faster dash cooldown
3. dashDuration - Longer dash
4. **NEW:** warpEnhancer - Better teleport ability

### Economy/Progression (6 upgrades)

1. bankMultiplier - More nugs
2. shopDiscount - Cheaper upgrades
3. **NEW:** contractMultiplier - Better contract rewards
4. **NEW:** contractFrequency - More frequent contracts
5. luckyDrop - Better pickup drops
6. bountyHunter - More nugs from kills

### Build Control (4 upgrades)

1. autoReroll - Free reroll chance
2. startingRerolls - Start with tokens
3. **NEW:** moreOptions - More upgrade choices
4. **NEW:** upgradeGuarantee - Guaranteed categories

### Utility/Mechanics (5 upgrades)

1. **NEW:** xpBooster - Faster XP gain
2. **NEW:** magnetField - Increased pickup range
3. **NEW:** levelingSmoothness - Reduced XP scaling
4. **NEW:** scoreMultiplier - More score
5. **NEW:** xpFromPickups - Coins grant XP

### Defense (3 upgrades)

1. shieldRecharge - Shield regen
2. secondWind - Invulnerability frames
3. **NEW:** contractTimeExtension - More time for contracts

### **NEW:** Difficulty (1 upgrade)

1. **NEW:** difficultyDampener - Slower difficulty scaling

---

## Implementation Priority

### Phase 0: Move 5 Upgrades to In-Game (High Priority)

1. **critical_strike** - 5-25% chance for 2x-2.5x damage
2. **combo_meter** - +3-15% damage per 10 combo stacks (max 20-60%)
3. **explosive_rounds** - 15-60% chance for AOE explosion on impact
4. **piercing_rounds** - Bullets pierce 1-5 enemies
5. **orbiting_nuke** - 1-5 orbiting fireballs dealing contact damage

### Phase 1: Core Removals (High Priority)

Remove damage-dealing meta upgrades:

1. Delete `startDamage` from META_SHOP_UPGRADE_DATA
2. Remove `applyMetaUpgrades()` call for startDamage in `meta-manager.js`
3. Repeat for: `criticalStrike`, `comboMeter`, `explosiveRounds`, `nukeCapacitor`, `splitShot`, `piercingRounds`, `missilePrimer`, `staticBlueprint`
4. Remove `droneFabricator` (or modify to make drones utility-only)

### Phase 2: Core Additions (High Priority)

Implement essential new upgrades:

1. **xpBooster** - Immediately impactful for progression
2. **magnetField** - Simple QoL improvement
3. **moreOptions** - Significant build control upgrade
4. **upgradeGuarantee** - Reduces RNG frustration

### Phase 3: Utility Additions (Medium Priority)

Add mechanic-enhancing upgrades:

5. **warpEnhancer** - Improves existing warp ability
6. **contractMultiplier** - Rewards contract completion
7. **contractFrequency** - More frequent contracts
8. **contractTimeExtension** - Easier contract completion

### Phase 4: Advanced Additions (Low Priority)

Add specialized upgrades:

9. **levelingSmoothness** - More gradual progression
10. **scoreMultiplier** - Competitive play benefit
11. **xpFromPickups** - Economy-XP synergy
12. **difficultyDampener** - Long-run sustainability

---

## Cost Balancing Recommendations

Base costs for new upgrades (consistent with current system):

| Upgrade               | Base Cost | Cost Scaling |
| --------------------- | --------- | ------------ |
| xpBooster             | 15 nugs   | +5 per tier  |
| magnetField           | 10 nugs   | +3 per tier  |
| warpEnhancer          | 25 nugs   | +8 per tier  |
| contractMultiplier    | 20 nugs   | +7 per tier  |
| contractFrequency     | 15 nugs   | +5 per tier  |
| contractTimeExtension | 10 nugs   | +3 per tier  |
| levelingSmoothness    | 20 nugs   | +7 per tier  |
| scoreMultiplier       | 15 nugs   | +5 per tier  |
| moreOptions           | 30 nugs   | +10 per tier |
| upgradeGuarantee      | 25 nugs   | +8 per tier  |
| xpFromPickups         | 20 nugs   | +7 per tier  |
| difficultyDampener    | 25 nugs   | +8 per tier  |

---

## Migration Plan for Existing Players

### Option 1: Full Reset (Recommended)

- Clear all meta purchases
- Refund 100% of nugs spent on removed upgrades
- Allow players to reinvest in new system
- Add one-time "migration bonus" of 500 nugs to compensate for time

**Advantages:**

- Clean break from power-crept system
- All players on equal footing
- Encourages re-engagement with meta system

### Option 2: Partial Reset

- Remove damage-dealing upgrades
- Keep QoL upgrades (passiveHp, shopDiscount, etc.)
- Refund nugs from removed upgrades only

**Advantages:**

- Less player frustration
- Maintains some progression

**Disadvantages:**

- Complex implementation
- Player confusion over what was removed

### Option 3: Token Conversion

- Convert removed upgrade tiers into new upgrade tiers
- Example: Tier 5 startDamage → Tier 5 xpBooster

**Advantages:**

- Maintains progression
- Minimizes player loss

**Disadvantages:**

- Doesn't solve power creep (players keep high tiers)
- Complex mapping between old and new upgrades

**Recommendation:** Option 1 (Full Reset) for cleanest implementation and best game balance.

---

## Testing Checklist

After implementation, test the following scenarios:

### Balance Testing

- [ ] Verify no damage or fire rate increases from any meta upgrade
- [ ] Ensure all new upgrades function as documented
- [ ] Test tier scaling (T1-T5 effectiveness)
- [ ] Verify no soft caps are exceeded unintentionally

### Progression Testing

- [ ] Play through first 10 levels with different meta builds
- [ ] Verify difficulty curve remains challenging
- [ ] Test late-game (difficulty tier 5+) survivability
- [ ] Ensure game doesn't become too easy or too hard

### Edge Cases

- [ ] Test with maximum tier on all upgrades
- [ ] Verify upgrade stacking doesn't cause bugs
- [ ] Test contract system with both frequency and time upgrades
- [ ] Ensure UI displays correct values for all tiers

### UI/UX Testing

- [ ] Verify meta shop displays new upgrades correctly
- [ ] Test upgrade descriptions are clear and accurate
- [ ] Check that upgrade tiers show proper costs
- [ ] Ensure tooltips show complete information

---

## Performance Considerations

All new upgrades have minimal performance impact:

- **Multiplier-based upgrades** (xpBooster, scoreMultiplier): Simple multiplication, negligible CPU impact
- **Magnet field**: Slightly larger pickup detection radius, trivial impact
- **Warp enhancer**: Alters cooldown/distance variables, no per-frame overhead
- **Contract upgrades**: Modifies spawn timers and rewards, minimal impact
- **Leveling upgrades**: Affects XP calculations, rare occurrence (once per level-up)
- **More options/guarantee**: Increases upgrade selection complexity, runs once per level-up

No upgrades add per-frame physics calculations or particle effects.

---

## Future Expansion Opportunities

If more upgrades are desired later, consider:

### Potential Future Upgrades

1. **Pickup Magnet Speed** - Attract pickups faster once magnetized
2. **XP Bank** - Carry over a percentage of XP to next run (not spent on upgrades)
3. **Starting Contracts** - Spawn with an active contract
4. **Elite Marker** - Highlight elite enemies on minimap
5. **Boss Prep Time** - Warning before boss spawns
6. **Ammoless Mode** - Remove ammo constraints (if implemented)
7. **Safe Zone** - Temporary invulnerability zone after warp
8. **Companion Drone Utility** - Non-damaging drones (scanner, decoy, healer)
9. **Weapon Swapping** - Quickly swap between unlocked weapons
10. **XP Display** - Show progress bar to next level

### Avoid These (Damage/Fire Rate)

- ❌ Any upgrade that directly increases damage
- ❌ Any upgrade that directly increases fire rate
- ❌ Any upgrade that adds new damage-dealing sources
- ❌ Any upgrade that increases projectile count per shot
- ❌ Any upgrade that adds piercing/chain/leech effects

---

## Summary

**New Total Meta Upgrades:**

- **Retained:** 18 (removed droneFabricator)
- **Moved to In-Game:** 5 (criticalStrike, comboMeter, explosiveRounds, piercingRounds, nukeCapacitor)
- **New:** 12
- **Total:** 25 upgrades

**Categories:**

- Survivability: 7 upgrades
- Mobility: 4 upgrades
- Economy/Progression: 6 upgrades
- Build Control: 4 upgrades
- Utility/Mechanics: 5 upgrades
- Defense: 3 upgrades
- Difficulty: 1 upgrade

**Key Improvements:**

1. Complete removal of damage and fire rate upgrades from meta system
2. Five DPS upgrades moved to in-game system where they belong
3. Unique gameplay enhancements unavailable in-game
4. Better build control and QoL features
5. More strategic depth without power creep
6. Maintains progression satisfaction
7. Balanced 25 upgrade meta system

**Expected Outcomes:**

- Slower power curve throughout runs
- More meaningful build choices
- Greater variety in viable playstyles
- More challenging late-game content
- Better long-term replayability
- Meta upgrades provide QoL and utility, not power

---

## Appendix: Code Modification Locations

### Files to Modify

**Constants:**

- `src/js/core/constants.js` - META_SHOP_UPGRADE_DATA object, UPGRADE_DATA object

**Player Systems:**

- `src/js/entities/player/Spaceship.js` - XP, magnet radius, warp, leveling

**Meta Systems:**

- `src/js/systems/meta-manager.js` - applyMetaUpgrades() function

**UI Systems:**

- `src/js/ui/meta-shop.js` - Upgrade display and purchase logic
- `src/js/ui/levelup-screen.js` - Upgrade selection logic

**Game Systems:**

- `src/js/systems/collision-manager.js` - Score, coin collection
- `src/js/systems/contract-manager.js` - Contract timing and rewards
- `src/js/entities/Enemy.js` - Difficulty scaling
- `src/js/systems/upgrade-manager.js` - Add 5 new in-game upgrades

### Key Functions to Update

1. `applyMetaUpgrades()` in `meta-manager.js` - Add new upgrade applications, remove old ones
2. `addXp()` in `Spaceship.js` - Apply XP multiplier
3. `warp()` in `Spaceship.js` - Apply warp enhancements
4. `selectUpgrades()` in `levelup-screen.js` - Apply more options/guarantee
5. `spawnContract()` in `contract-manager.js` - Apply frequency/time changes
6. `destroy()` in various enemy files - Apply score multiplier

---

_Document Version: 2.0_
_Created: January 2026_
_Last Updated: January 2026_
