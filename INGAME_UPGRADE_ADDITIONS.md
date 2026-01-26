# Move 5 Upgrades from Meta to In-Game System

## Overview

This document details the plan to move 5 unique meta upgrades to the in-game upgrade system. These upgrades don't have in-game equivalents and should be part of core progression rather than meta progression.

**Key Points:**

- Moving upgrades that are unique to the game (no duplicates in current in-game system)
- These upgrades are being removed from meta system in NEW_META_UPGRADE_SYSTEM.md
- Moving to in-game allows players to access them during runs
- Maintains progression variety without power creep from meta stacking

---

## Removed Meta Upgrades: Moving to In-Game

### Upgrades Moving to In-Game System

The following meta upgrades will be removed and re-added to in-game upgrade system. They don't have in-game equivalents and should be part of core progression:

#### 1. **criticalStrike** → **critical_strike** (Weapons category)

- **Meta effect:** 5-25% chance for 2x-2.5x damage
- **New in-game name:** Critical Strike
- **Why unique:** Currently no RNG-based damage boost in in-game system
- **Benefits:** Adds random damage spikes, exciting moments, different from flat damage upgrades

#### 2. **comboMeter** → **combo_meter** (Specials category)

- **Meta effect:** +3-15% damage per 10 combo stacks (max 20-60%)
- **New in-game name:** Combo Meter
- **Benefits:** Rewards consistent play, resets on damage taken, skill-based mechanic

#### 3. **explosiveRounds** → **explosive_rounds** (Weapons category)

- **Meta effect:** 15-60% chance for AOE explosion on impact
- **New in-game name:** Explosive Rounds
- **Why unique:** Different from `chain_lightning` (impact AOE vs chaining to enemies)
- **Benefits:** Satisfying explosions, AOE damage helps with grouped enemies

#### 4. **piercingRounds** → **piercing_rounds** (Weapons category)

- **Meta effect:** Bullets pierce 1-5 enemies
- **New in-game name:** Piercing Rounds
- **Why unique:** No piercing mechanic currently in in-game system
- **Benefits:** Multi-hit capability, synergizes with shotgun, helps with swarms

#### 5. **nukeCapacitor** → **orbiting_nuke** (Specials category)

- **Meta effect:** 1-3 orbiting fireballs dealing 5-15 damage
- **New in-game name:** Orbiting Nuke
- **Why unique:** Different from `area_nuke` (orbiting vs one-time blast) and `companion_drones` (passive orbit vs shooter/heal/shield drones)
- **Benefits:** Passive AOE damage, constant damage source, reduces micro-management

---

## Detailed Upgrade Specifications

### Upgrade 1: Critical Strike

**Category:** Weapons
**ID:** `critical_strike`

| Tier   | Effect                         |
| ------ | ------------------------------ |
| Tier 1 | 5% chance to deal 2x damage    |
| Tier 2 | 8% chance to deal 2x damage    |
| Tier 3 | 12% chance to deal 2x damage   |
| Tier 4 | 18% chance to deal 2x damage   |
| Tier 5 | 25% chance to deal 2.5x damage |

**Implementation Details:**

- Add `stats.critChance` property (stores 0.05 to 0.25)
- Add `stats.critDamage` property (stores 2.0 to 2.5)
- Apply in `collision-manager.js` when enemy takes damage
- Check: `if (Math.random() < player.stats.critChance) damage *= player.stats.critDamage`
- Visual effect: Flash enemy on crit hit, show damage number in different color
- Sound effect: Distinct crit sound (or amplify existing hit sound)

**Files to Modify:**

- `src/js/core/constants.js` - Add to UPGRADE_DATA.categories.weapons
- `src/js/systems/upgrade-manager.js` - Add case for 'critical_strike'
- `src/js/entities/player/Spaceship.js` - Initialize stats properties in stats object
- `src/js/systems/collision-manager.js` - Apply crit chance on damage
- `src/js/rendering/` - Add visual effect for crit hits

**Questions for Balance:**

- Should tier 5 have 2.5x crits (higher damage) or keep at 2x like lower tiers?
- Should crits apply to all damage sources (turret, missiles, static weapons) or just main turret?

---

### Upgrade 2: Combo Meter

**Category:** Specials
**ID:** `combo_meter`

| Tier   | Effect                             |
| ------ | ---------------------------------- |
| Tier 1 | +3% damage per 10 stacks, max 20%  |
| Tier 2 | +5% damage per 10 stacks, max 30%  |
| Tier 3 | +8% damage per 10 stacks, max 40%  |
| Tier 4 | +12% damage per 10 stacks, max 50% |
| Tier 5 | +15% damage per 10 stacks, max 60% |

**Implementation Details:**

- This already exists in meta system, move to in-game
- Existing properties: `stats.comboMeter`, `comboStacks`, `comboMaxStacks`, `comboMaxBonus`
- Current meta implementation in `meta-manager.js:431-443`
- Combo increases on enemy hit, decreases over time
- Combo resets when player takes damage
- Damage bonus applies to all damage calculations

**Files to Modify:**

- `src/js/core/constants.js` - Add to UPGRADE_DATA.categories.specials
- `src/js/systems/upgrade-manager.js` - Add case for 'combo_meter'
- Move logic from `meta-manager.js` to `upgrade-manager.js`
- `src/js/ui/hud.js` - Ensure combo meter UI is displayed (add if missing)

**Questions for Balance:**

- Does combo meter UI already exist in game?
- Should combo decay over time or stay until reset by damage?
- Should combo reset on ALL damage taken or only above a threshold?

---

### Upgrade 3: Explosive Rounds

**Category:** Weapons
**ID:** `explosive_rounds`

| Tier   | Effect                                         |
| ------ | ---------------------------------------------- |
| Tier 1 | 15% chance for explosion (20 dmg, 150u radius) |
| Tier 2 | 25% chance for explosion (25 dmg, 160u radius) |
| Tier 3 | 40% chance for explosion (30 dmg, 175u radius) |
| Tier 4 | 50% chance for explosion (35 dmg, 190u radius) |
| Tier 5 | 60% chance for explosion (40 dmg, 200u radius) |

**Implementation Details:**

- This already exists in meta system, move to in-game
- Existing properties: `stats.explosiveRounds`, `stats.explosiveDamage`, `stats.explosiveRadius`
- Current meta implementation in `meta-manager.js:292-301`
- Create Shockwave on impact if roll succeeds
- Explosion damages all enemies in radius
- Synergizes with multi-hit upgrades (piercing rounds)

**Files to Modify:**

- `src/js/core/constants.js` - Add to UPGRADE_DATA.categories.weapons
- `src/js/systems/upgrade-manager.js` - Add case for 'explosive_rounds'
- Move logic from `meta-manager.js` to `upgrade-manager.js`
- `src/js/systems/collision-manager.js` - Spawn explosion on enemy hit (verify existing implementation)

**Questions for Balance:**

- Should explosions apply chain lightning if both upgrades owned?
- Should explosions also damage player (friendly fire)?
- Should explosion chance apply per hit or per bullet spawned?

---

### Upgrade 4: Piercing Rounds

**Category:** Weapons
**ID:** `piercing_rounds`

| Tier   | Effect                   |
| ------ | ------------------------ |
| Tier 1 | Bullets pierce 1 enemy   |
| Tier 2 | Bullets pierce 2 enemies |
| Tier 3 | Bullets pierce 3 enemies |
| Tier 4 | Bullets pierce 4 enemies |
| Tier 5 | Bullets pierce 5 enemies |

**Implementation Details:**

- This already exists in meta system, move to in-game
- Existing property: `stats.piercing` (stored as count 1-5)
- Current meta implementation in `meta-manager.js:283-291`
- Modify `Bullet.js` to track pierce count
- Continue checking collisions after hit if pierce count > 0
- Pierced enemies may take reduced damage (optional balance)

**Files to Modify:**

- `src/js/core/constants.js` - Add to UPGRADE_DATA.categories.weapons
- `src/js/systems/upgrade-manager.js` - Add case for 'piercing_rounds'
- Move logic from `meta-manager.js` to `upgrade-manager.js`
- `src/js/entities/projectiles/Bullet.js` - Add pierce tracking logic (modify hit/destroy methods)

**Questions for Balance:**

- Should pierced enemies take reduced damage (e.g., 80%, 60%, 40%) or full damage to all?
- Should piercing apply to all projectile types (bullets, missiles, CIWS) or just main turret?
- Should piercing bullets stop after hitting max enemies or continue until out of range?

---

### Upgrade 5: Orbiting Nuke

**Category:** Specials
**ID:** `orbiting_nuke`

| Tier   | Effect                                      |
| ------ | ------------------------------------------- |
| Tier 1 | 1 orbiting fireball, 5 damage, 400u range   |
| Tier 2 | 2 orbiting fireballs, 8 damage, 450u range  |
| Tier 3 | 3 orbiting fireballs, 12 damage, 500u range |
| Tier 4 | 4 orbiting fireballs, 15 damage, 550u range |
| Tier 5 | 5 orbiting fireballs, 18 damage, 600u range |

**Implementation Details:**

- This is DIFFERENT from existing `area_nuke` (one-time blast) and `nukeCapacitor` (orbiting fireballs from meta)
- Create orbiting fireballs that rotate around player
- Fireballs orbit at fixed distance (400-600u based on tier)
- Damage enemies on contact (like drone but different behavior)
- 1 full rotation every 4.8 seconds (same speed as nukeCapacitor)
- Evenly spaced around player (360 degrees / count)

**Files to Modify:**

- `src/js/core/constants.js` - Add to UPGRADE_DATA.categories.specials
- `src/js/systems/upgrade-manager.js` - Add case for 'orbiting_nuke'
- `src/js/entities/player/Spaceship.js` - Add orbiting fireball tracking and update logic
- Create new entity: `OrbitingFireball.js` or reuse existing projectile/fireball code
- `src/js/systems/collision-manager.js` - Handle fireball contact damage

**Questions for Balance:**

- Should fireballs orbit indefinitely or have limited duration?
- Should fireballs be destroyed when hitting enemies or pass through?
- Should fireballs rotate clockwise or counter-clockwise (or random)?

---

## Meta System: Complete Removal List

### Removed from Meta (moved to in-game):

1. ~~**criticalStrike**~~ → Moving to in-game as `critical_strike`
2. ~~**comboMeter**~~ → Moving to in-game as `combo_meter`
3. ~~**explosiveRounds**~~ → Moving to in-game as `explosive_rounds`
4. ~~**piercingRounds**~~ → Moving to in-game as `piercing_rounds`
5. ~~**nukeCapacitor**~~ → Moving to in-game as `orbiting_nuke` (renamed for clarity)

### Removed from Meta (no in-game equivalent, will delete):

1. **startDamage** - `turret_damage` exists in-game
2. **splitShot** - `multi_shot` exists in-game
3. **missilePrimer** - `homing_missiles` exists in-game
4. **staticBlueprint** - `static_weapons` exists in-game
5. **droneFabricator** - `companion_drones` exists in-game

**Total Meta Removals:** 10 upgrades (5 moved to in-game, 5 deleted)

---

## Updated System Summary

### In-Game Upgrade System (After Changes)

**Total upgrades:** ~35 (from ~30, adding 5)

**New Additions:**

- Critical Strike (Weapons)
- Combo Meter (Specials)
- Explosive Rounds (Weapons)
- Piercing Rounds (Weapons)
- Orbiting Nuke (Specials)

**Benefits:**

- More variety in weapons category (+2 upgrades)
- More variety in specials category (+2 upgrades)
- Unique mechanics not previously available in-game
- Players can access during runs (no meta dependency)

### Meta Upgrade System (After Changes)

**Total upgrades:** 25 (from 30, removing 10)

**Remaining categories:**

- Survivability: 7 upgrades
- Mobility: 4 upgrades
- Economy/Progression: 6 upgrades
- Build Control: 4 upgrades
- Utility/Mechanics: 5 upgrades
- Defense: 3 upgrades
- Difficulty: 1 upgrade

**Benefits:**

- Complete removal of damage and fire rate upgrades
- Meta provides QoL and utility only
- No direct DPS from meta system
- Cleaner separation between meta (permanent) and in-game (per-run) progression

---

## Implementation Priority

### Phase 0: Move 5 Upgrades to In-Game (High Priority)

#### 1. critical_strike

- Add to `constants.js` UPGRADE_DATA.categories.weapons
- Add case in `upgrade-manager.js`
- Initialize stats in `Spaceship.js`
- Implement crit logic in `collision-manager.js`
- Add visual feedback (flash, sound, damage number)

#### 2. combo_meter

- Move from `meta-manager.js` to `upgrade-manager.js`
- Add to `constants.js` UPGRADE_DATA.categories.specials
- Update HUD to display combo meter
- Test combo reset logic (on damage taken)

#### 3. explosive_rounds

- Move from `meta-manager.js` to `upgrade-manager.js`
- Add to `constants.js` UPGRADE_DATA.categories.weapons
- Verify explosion spawning logic works correctly
- Test synergy with chain_lightning and piercing_rounds

#### 4. piercing_rounds

- Move from `meta-manager.js` to `upgrade-manager.js`
- Add to `constants.js` UPGRADE_DATA.categories.weapons
- Modify `Bullet.js` for pierce tracking
- Test multi-hit behavior
- Decide on damage falloff (full or reduced per pierce)

#### 5. orbiting_nuke

- Create new entity `OrbitingFireball.js` or reuse existing code
- Add to `constants.js` UPGRADE_DATA.categories.specials
- Add case in `upgrade-manager.js`
- Implement orbit logic in `Spaceship.js` update loop
- Handle collision in `collision-manager.js`
- Test spacing and rotation speed

### Phase 1: Core Removals from Meta (High Priority)

Delete 5 damage-dealing meta upgrades:

- Remove `startDamage`, `splitShot`, `missilePrimer`, `staticBlueprint`, `droneFabricator`
- Delete from META_SHOP_UPGRADE_DATA
- Remove from `applyMetaUpgrades()`
- Update meta-shop UI to not display removed upgrades

### Phase 2: Core Additions (Meta) (High Priority)

Implement essential new meta upgrades:

1. **xpBooster** - Immediately impactful for progression
2. **magnetField** - Simple QoL improvement
3. **moreOptions** - Significant build control upgrade
4. **upgradeGuarantee** - Reduces RNG frustration

### Phase 3-4: Continue with original NEW_META_UPGRADE_SYSTEM.md plan

- Proceed with remaining meta upgrades as documented in NEW_META_UPGRADE_SYSTEM.md

---

## File Modification Summary

### Files to Modify:

**Constants:**

- `src/js/core/constants.js`
  - Add 5 new upgrades to UPGRADE_DATA (critical_strike, combo_meter, explosive_rounds, piercing_rounds, orbiting_nuke)
  - Remove 5 upgrades from META_SHOP_UPGRADE_DATA (startDamage, splitShot, missilePrimer, staticBlueprint, droneFabricator)
  - Remove 5 upgrades from META_SHOP_UPGRADE_DATA that were moved (criticalStrike, comboMeter, explosiveRounds, piercingRounds, nukeCapacitor)

**Upgrade Systems:**

- `src/js/systems/upgrade-manager.js`
  - Add cases for: `critical_strike`, `combo_meter`, `explosive_rounds`, `piercing_rounds`, `orbiting_nuke`
  - Remove case for `startDamage` (if exists in upgrade-manager)

- `src/js/systems/meta-manager.js`
  - Remove `applyMetaUpgrades()` code for: `criticalStrike`, `comboMeter`, `explosiveRounds`, `piercingRounds`, `nukeCapacitor`
  - Remove `applyMetaUpgrades()` code for: `startDamage`, `splitShot`, `missilePrimer`, `staticBlueprint`, `droneFabricator`

**Player Systems:**

- `src/js/entities/player/Spaceship.js`
  - Initialize: `stats.critChance`, `stats.critDamage` (new)
  - Keep: `stats.comboMeter`, `comboStacks`, `comboMaxStacks`, `comboMaxBonus` (already exists from meta)
  - Keep: `stats.explosiveRounds`, `stats.explosiveDamage`, `stats.explosiveRadius` (already exists)
  - Keep: `stats.piercing` (already exists)
  - Add: orbiting fireball tracking logic (array of fireballs, update positions)

**Entities:**

- `src/js/entities/projectiles/Bullet.js`
  - Add pierce counting logic (hitCount, maxHits)
  - Continue checking collisions after hit if hitCount < maxHits
  - Optional: Reduce damage per pierce

- Create: `src/js/entities/projectiles/OrbitingFireball.js` (or reuse existing fireball code)

**Game Systems:**

- `src/js/systems/collision-manager.js`
  - Add crit damage application (check critChance, apply critDamage multiplier)
  - Verify explosion spawning works (create Shockwave if explosiveRounds roll succeeds)
  - Handle orbiting fireball collisions (check contact with enemies, deal damage)

**UI:**

- `src/js/ui/meta-shop.js`
  - Remove upgrade displays for deleted and moved meta upgrades
  - Update layout if needed

- `src/js/ui/hud.js`
  - Ensure combo meter UI is displayed (add if missing)
  - Add crit visual feedback (optional)

---

## Testing Checklist

### New In-Game Upgrade Testing

#### Critical Strike

- [ ] Crit chance triggers at correct rate (5-25%)
- [ ] Crit damage applies correct multiplier (2.0-2.5x)
- [ ] Crit visual feedback displays correctly (flash, sound)
- [ ] Crits work with all damage sources (turret, missiles, static weapons)
- [ ] Damage numbers show correct values for crits

#### Combo Meter

- [ ] Combo meter tracks hits correctly (every hit increases stacks)
- [ ] Damage bonus applies correctly (3-15% per 10 stacks, max 20-60%)
- [ ] Combo resets correctly when player takes damage
- [ ] Combo meter UI displays stacks and damage bonus
- [ ] Max combo bonus is respected (doesn't exceed max)

#### Explosive Rounds

- [ ] Explosions trigger at correct rate (15-60% chance)
- [ ] Explosion damage and radius match tier values
- [ ] Explosions damage all enemies in radius (AOE works correctly)
- [ ] Explosion visual effect displays properly
- [ ] Explosion doesn't damage player

#### Piercing Rounds

- [ ] Bullets pierce correct number of enemies (1-5)
- [ ] Piercing bullets stop after hitting max enemies
- [ ] Damage falloff applies correctly (if implemented)
- [ ] Piercing works with all projectile types
- [ ] Visual feedback shows piercing (bullet continues past enemy)

#### Orbiting Nuke

- [ ] Correct number of fireballs spawn (1-5 based on tier)
- [ ] Fireballs orbit at correct distance (400-600u)
- [ ] Fireballs deal correct damage (5-18 based on tier)
- [ ] Fireballs rotate at correct speed (4.8 seconds per rotation)
- [ ] Fireballs evenly spaced around player
- [ ] Fireballs damage enemies on contact
- [ ] Fireballs despawn correctly if destroyed

### Meta Upgrade Testing (Post-Removal)

#### Removed Upgrades

- [ ] `startDamage`, `criticalStrike`, `comboMeter`, `explosiveRounds`, `nukeCapacitor`, `splitShot`, `piercingRounds`, `missilePrimer`, `staticBlueprint`, `droneFabricator` don't appear in meta shop
- [ ] Purchased meta upgrades don't apply (removed upgrades don't affect gameplay)
- [ ] No damage multipliers remain from removed meta upgrades
- [ ] Remaining meta upgrades still apply correctly

---

## Balance Considerations

### Synergy Analysis

#### Positive Synergies

- **Explosive Rounds + Piercing Rounds:** Explosions trigger on each pierced enemy, creating chain explosions
- **Explosive Rounds + Multi-Shot:** More bullets = more explosion chances
- **Critical Strike + Turret Damage:** Crits apply to boosted damage, very satisfying
- **Combo Meter + Fire Rate:** More hits = faster combo build-up
- **Orbiting Nuke + Static Weapons:** Multiple passive damage sources
- **Combo Meter + Momentum:** Two different damage bonuses (hit-based + movement-based)

#### Potential Issues

- **Explosive Rounds + Chain Lightning:** May be redundant AOE mechanics
- **Piercing Rounds + High Fire Rate:** May cause performance issues with many piercing bullets
- **Critical Strike + Combo Meter:** Too much RNG in damage calculation (may feel inconsistent)
- **Orbiting Nuke + High Damage:** May make game too easy if damage is too high

### Recommended Balance Adjustments

If issues arise during testing:

1. **Reduce explosive rounds damage** if AOE is too strong
2. **Reduce crit multiplier** if crits deal too much damage
3. **Add combo decay time** if combo meter stays maxed too long
4. **Reduce orbiting nuke damage** if passive damage is too high
5. **Limit piercing to specific projectile types** if multi-hit is too OP

---

## Questions for Implementation

1. **Critical Strike Damage Multiplier:** Should tier 5 be 2.5x damage (like current meta) or 2x like lower tiers? Higher tiers could have bigger crits.

2. **Orbiting Nuke Naming:** Should I keep it as `orbiting_nuke` or use a different name like `orbiting_fireballs` or `defense_ring`?

3. **Combo Meter UI:** Does a combo meter UI already exist in game? If not, should it be added or should it be invisible like some other effects?

4. **Visual Effects:** For critical strikes, should there be a special particle effect, sound, or number popup to indicate a crit occurred?

5. **Piercing Behavior:** Should pierced enemies take reduced damage (like 50% per pierce) or full damage to all hit enemies?

6. **Orbiting Nuke Duration:** Should orbiting nukes last indefinitely or have limited duration (e.g., 30 seconds, then respawn)?

7. **Explosion Stacking:** Should explosions from piercing rounds also trigger chain lightning? Or should only the main projectile trigger chain lightning?

8. **Combo Decay:** Should combo meter decay over time if no hits are made (e.g., -1 stack per second), or stay until reset by damage taken?

---

## Summary

**Moving from Meta to In-Game:** 5 unique upgrades

- Critical Strike
- Combo Meter
- Explosive Rounds
- Piercing Rounds
- Orbiting Nuke

**Deleting from Meta:** 5 upgrades that duplicate in-game upgrades

- Start Damage
- Split Shot
- Missile Primer
- Static Blueprint
- Drone Fabricator

**Total Meta Removals:** 10 upgrades

**Expected Outcomes:**

- In-game system gains 5 unique mechanics
- Meta system loses all damage and fire rate upgrades
- Cleaner separation between permanent and per-run progression
- More variety in both upgrade systems
- No power creep from meta stacking with in-game upgrades

---

_Document Version: 1.0_
_Created: January 2026_
_Last Updated: January 2026_
