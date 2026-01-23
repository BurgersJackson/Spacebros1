# Meta Shop Upgrades Status

Analysis of which meta shop upgrades actually work when purchased in Spacebros1.

**Last Updated:** 2026-01-23

## Summary

- **18 upgrades** fully functional
- **12 upgrades** partially or completely non-functional
- **1 upgrade** has implementation bugs

---

## ✅ Fully Functional Upgrades

| Upgrade ID | Name | Status | Implementation Location |
|------------|------|--------|------------------------|
| `startDamage` | Start Damage Boost | ✅ Works | `stats.damageMult` used in all shoot methods |
| `passiveHp` | Passive +HP | ✅ Works | Directly adds to `maxHp` |
| `hullPlating` | Hull Plating | ✅ Works | Directly adds to `maxHp` |
| `shieldCore` | Shield Core | ✅ Works | Adds shield segments and HP |
| `staticBlueprint` | Static Blueprint | ✅ Works | `staticWeapons` array fired in `shoot()` |
| `missilePrimer` | Missile Primer | ✅ Works | `stats.homingFromMeta` used in `fireMissiles()` |
| `nukeCapacitor` | Global Defense Ring | ✅ Works | Full collision detection in update() |
| `speedTuning` | Speed Tuning | ✅ Works | `stats.speedMult` used in max speed calculation |
| `bankMultiplier` | Bank Multiplier | ✅ Works | Used in `depositMetaNuggets()` |
| `shopDiscount` | Shop Discount | ✅ Works | Used in `getMetaUpgradeCost()` |
| `extraLife` | Extra Life | ✅ Works (Fixed) | `GameContext.metaExtraLifeCount` checked in `killPlayer()` - revives with full HP |
| `droneFabricator` | Drone Fabricator | ✅ Works | Spawns drones via `spawnDroneFn` |
| `splitShot` | Split Shot | ✅ Works | `stats.splitChance` used in shoot() |
| `shieldRecharge` | Shield Recharge | ✅ Works | `stats.shieldRechargeInterval` used in update() |
| `startingRerolls` | Starting Rerolls | ✅ Works | Adds to `GameContext.rerollTokens` |
| `bountyHunter` | Bounty Hunter | ⚠️ Appears working | `stats.bountyEliteBonus/bountyBossBonus` set |
| `startingWeapon` | Starting Weapon | ✅ Works | Sets `inventory['shotgun']` |
| `batteryCapacitor` | Battery Capacitor | ✅ Works | `batteryUnlocked`, `batteryDamage`, `batteryRange` all used |

---

## ❌ Broken / Non-Functional Upgrades

| Upgrade ID | Name | Issue | Details |
|------------|------|-------|---------|
| `piercingRounds` | Piercing Rounds | ❌ NOT USED | `stats.pierceCount` set but never passed to Bullet constructor |
| `explosiveRounds` | Explosive Rounds | ❌ NOT USED | `stats.explosiveChance/explosiveDamage` set but never applied to bullets |
| `criticalStrike` | Critical Strike | ❌ NOT USED | `stats.critChance` set but only used for Shockwaves, not regular bullets |
| `thornArmor` | Thorn Armor | ❌ NOT USED | `stats.thornReflect` set but never checked in `takeHit()` |
| `lifesteal` | Lifesteal | ❌ NOT USED | `stats.lifestealThreshold` set but never checked on enemy kills |
| `evasionBoost` | Evasion Boost | ❌ NOT USED | `stats.evasionChance` set but never checked in `takeHit()` |
| `dashCooldown` | Dash Cooldown | ❌ NOT USED | `stats.turboCooldownReduction` set but never applied to `cooldownTotalFrames` |
| `dashDuration` | Dash Duration | ❌ NOT USED | `stats.turboDurationBonus` set but never applied to `durationFrames` |
| `autoReroll` | Auto-Reroll | ❌ NOT USED | `stats.autoRerollChance` set but never checked in `levelUp()` |
| `contractSpeed` | Contract Speed | ❌ NOT USED | `stats.contractSpeedMult` set but never applied to contracts |
| `luckyDrop` | Lucky Drop | ❌ NOT USED | `stats.luckyHealthDrop/luckyNuggetDrop` set but never used in drop logic |
| `secondWind` | Second Wind | ⚠️ Partial | `stats.secondWindDuration/Cooldown` set but logic incomplete |

---

## 🐛 Implementation Bugs

### Combo Meter
- **Issue:** Stats mismatch
- **What's set:** `stats.comboDamagePer10` and `stats.maxComboDamage` in `meta-manager.js:439-440`
- **What's used:** `stats.comboMaxBonus` in `Spaceship.js:1094,1285,1446`
- **Problem:** `comboMaxBonus` is set to `0` in `game-flow.js:243`
- **Result:** Combo meter tracks stacks but applies 0% damage bonus

---

## Implementation Details

### Files Analyzed
- `src/js/core/constants.js` - Upgrade definitions (lines 136-601)
- `src/js/systems/meta-manager.js` - Stats application (lines 200-470)
- `src/js/entities/player/Spaceship.js` - Player combat and stats usage
- `src/js/entities/projectiles/Bullet.js` - Bullet properties
- `src/js/entities/projectiles/Shockwave.js` - Shockwave damage
- `src/js/systems/collision-manager.js` - Damage application
- `src/js/systems/game-flow.js` - Game initialization

### Common Pattern Issues

1. **Stat Set, Never Read:** Many stats are set in `applyMetaUpgrades()` but never checked elsewhere
   - Example: `stats.evasionChance` is set but `takeHit()` never rolls for evasion

2. **Property Not Passed:** Stats exist but aren't passed to objects that need them
   - Example: `stats.pierceCount` exists but `createBullet()` never uses it

3. **Missing Integration:** Stats are set on player but the relevant system doesn't check them
   - Example: `stats.autoRerollChance` exists but `levelUp()` doesn't check it

---

## Priority Fixes (Most Visible to Players)

1. **Critical Strike** - Players expect crit numbers
2. **Explosive Rounds** - Visual effect missing
3. **Piercing Rounds** - Combat feel impact
4. **Evasion Boost** - Survival mechanic
5. **Lifesteal** - Sustain mechanic
6. **Thorn Armor** - Reflect damage is satisfying
7. **Combo Meter** - Has tracking, just needs bonus fixed
