# Enemy Hit Points (HP) - Complete List

Generated: 2025-01-23

## Summary: Do enemies get more HP as the game progresses?

**YES**, many enemies scale their HP based on `GameContext.difficultyTier` and encounter index. As the difficulty tier increases, enemy HP increases.

---

## Basic Enemies (Regular Spawns)

| Enemy Type     | Base HP | Scaling Formula                 | Notes                           |
| -------------- | ------- | ------------------------------- | ------------------------------- |
| Roamer         | 1       | None (static)                   | Does NOT scale with difficulty  |
| Elite Roamer   | 8       | `6 + (difficultyTier * 2)`      | Named elites get +2 HP on spawn |
| Hunter         | 12      | `12 + (difficultyTier * 3)`     | Named elites get +2 HP on spawn |
| Defender       | 5       | `5 + (difficultyTier - 1) * 2)` | Starts at tier 2                |
| Gunboat Lvl 1  | 10      | None (static)                   | Does NOT scale with difficulty  |
| Gunboat Lvl 2  | 16      | None (static)                   | Does NOT scale with difficulty  |
| Pinwheel       | 10      | `10 + (difficultyTier - 1) * 5` | Standard type                   |
| Pinwheel Heavy | 15      | Same as standard (then `* 1.5`) | Heavy has 1.5x multiplier       |
| Pinwheel Rapid | 7       | Same as standard (then `* 0.7`) | Rapid has 0.7x multiplier       |

---

## Pinwheel Shield Segments (Additional HP from shields)

Pinwheels have shield segments that must be destroyed before hull HP is reached:

| Difficulty Tier 1: 12 outer shields (1 HP each), no inner shields
| Difficulty Tier 2: 16 outer shields (1 HP each), no inner shields
| Difficulty Tier 3: 24 outer shields (1 HP each), no inner shields
| Difficulty Tier 4: 24 outer shields (2 HP each), 8 inner shields (1 HP each)
| Difficulty Tier 5: 24 outer shields (2 HP each), 12 inner shields (2 HP each)
| Difficulty Tier 6+: 24 outer shields (3+ per tier beyond 6), 16+ (inner shields per tier)

---

## Bosses - Space Sector

| Boss               | Base HP | Scaling Formula            | Encounter 1  | Encounter 2                            | Encounter 3+                 |
| ------------------ | ------- | -------------------------- | ------------ | -------------------------------------- | ---------------------------- | ---------------------- |
| Cruiser            | 150     | `150 * (1 + boost * 0.35)` | 150          | 202 (encounter 2: `150 * 1.35 * 1.25`) | Scales with encounters       |
| Destroyer          | 300     | None (static)              | 300 (static) | Does NOT scale                         |
| Space Station      | 180     | None (static)              | 180 (static) | Does NOT scale                         |
| Flagship           | 260     | `260 + bonus * 35`         | 260          | 295                                    | 330 (each +35 per encounter) | Scales with encounters |
| Warp Shield Drone  | 300     | None (static)              | 300 (static) | Does NOT scale                         |
| Warp Sentinel Boss | 500     | None (static)              | 500 (static) | Does NOT scale                         |

---

## Bosses - Dungeon

All dungeon bosses use the same scaling formula: `baseHp * (1 + boost * scaleRate)`

| Dungeon Boss     | Base HP | Scale Rate | Encounter 1 | Encounter 2 | Encounter 3+            |
| ---------------- | ------- | ---------- | ----------- | ----------- | ----------------------- |
| PsyLich          | 130     | 0.12       | 130         | 146         | 162 (+12 per encounter) |
| Necrotic Hive    | 160     | 0.20       | 160         | 192         | 224 (+32 per encounter) |
| Fleshforge       | 180     | 0.25       | 180         | 225         | 270 (+45 per encounter) |
| Vortex Matriarch | 150     | 0.18       | 150         | 177         | 204 (+27 per encounter) |
| Chitinus Prime   | 200     | 0.30       | 200         | 230         | 260 (+30 per encounter) |
| Cerebral Psion   | 140     | 0.15       | 140         | 161         | 182 (+21 per encounter) |

---

## Cave Monsters (Static HP - No Scaling)

| Monster                        | HP  | Notes                    |
| ------------------------------ | --- | ------------------------ |
| Cave Monster 1 (CAVE CRYPTID)  | 250 | Artillery mode, shielded |
| Cave Monster 2 (HOLLOW HORROR) | 300 | Chase mode               |
| Cave Monster 3 (VOID TERROR)   | 350 | Artillery mode, shielded |

---

## Cave Dungeon Support Enemies (Scaling)

| Enemy          | Base HP | Scaling       | Notes       |
| -------------- | ------- | ------------- | ----------- |
| Cave Gunboat 1 | 10      | None (static) | Level 1     |
| Cave Gunboat 2 | 16      | None (static) | Level 2     |
| Dungeon Drone  | 5       | None (static) | Always 5 HP |

---

## Cave Support Structures

| Structure        | HP  | Notes    |
| ---------------- | --- | -------- |
| Cave Wall Turret | 6   | Shielded |
| Cave Wall Switch | 3   | Shielded |
| Cave Power Relay | 8   | Shielded |
| Cave Bio Pod     | 3   | Shielded |

---

## Warp Zone Bosses

| Boss       | HP   | Notes                                             |
| ---------- | ---- | ------------------------------------------------- |
| Final Boss | 1000 | Double HP of previous bosses, static (no scaling) |

---

## Warp Shield Drone (Support Entity)

| Entity            | HP  | Notes                        |
| ----------------- | --- | ---------------------------- |
| Warp Shield Drone | 300 | Orbits boss, shield segments |

---

## Final Boss Reinforcements

The Final Boss spawns:

- Mine entities: 1 HP each (exploding mines)
- Reinforcements (defenders/elite_roamers/hunters): Scale with difficultyTier (see basic enemies above)

---

## Key Scaling Mechanics

### Difficulty Tier System

- Starts at 1
- Increases when: `GameContext.pinwheelsDestroyedTotal + GameContext.gunboatsDestroyedTotal >= 6 * difficultyTier`
- Pinwheel destruction increases tier by 1
- Gunboat destruction increases tier by 1

### Encounter System

- Some bosses (Cruiser, Flagship, all Dungeon bosses) scale with `encounterIndex`
- `boost = Math.max(0, encounterIndex - 1)`
- Higher encounters = more HP for that boss only

### Cave Monster Escalation

- Monster 1-3 have escalation phases that increase damage output
- Phase 1: 0-80s elapsed
- Phase 2: 80-120s elapsed (1.3x multiplier)
- Phase 3: 120s+ elapsed (1.5x multiplier)

---

## HP Progression Over Time

**Early Game (Difficulty Tier 1-3):**

- Roamers: 1 HP
- Elite Roamers: 8-14 HP
- Hunters: 12-18 HP
- Pinwheels: 10-20 HP
- Gunboats: 10-16 HP (static)

**Mid Game (Difficulty Tier 4-6):**

- Elite Roamers: 14-20 HP
- Hunters: 18-30 HP
- Pinwheels: 20-30 HP (with stronger shields)

**Late Game (Difficulty Tier 7+):**

- Elite Roamers: 20+ HP
- Hunters: 30+ HP
- Pinwheels: 30+ HP (with strongest shields)

---

## Boss Difficulty Progression

**Dungeon Bosses:**

- Start low (130-200 HP at encounter 1)
- Scale up with each encounter (+12 to +45 HP per level)
- PsyLich: 130 → 162 → 194 HP
- Fleshforge: 180 → 225 → 270 HP
- Chitinus Prime: 200 → 230 → 260 HP
- All dungeon bosses heal during fights or have regeneration phases

**Space Bosses:**

- Cruiser: 150 → 203 → 274 HP (encounters)
- Flagship: 260 → 295 → 330 HP (encounters)
- Destroyer/Station: Fixed HP (300/180 HP)

**Final Boss:**

- Static 1000 HP (toughest single enemy)

---

## Notable Exceptions (No Scaling)

The following enemies do **NOT** scale with difficulty:

- Roamers: Always 1 HP
- Gunboats: Always 10/16 HP
- Cave Monsters: Fixed 250/300/350 HP
- Destroyer: Fixed 300 HP
- Space Station: Fixed 180 HP
- Warp Sentinel: Fixed 500 HP
- Final Boss: Fixed 1000 HP
