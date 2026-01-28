# Weapon Damage Refactor - Batch Updates

## Files Modified So Far:
- ✓ Bullet.js: Changed base damage from 1 to 10 (line 34)
- ✓ Spaceship.js: Changed player maxHp from 25 to 250 (line 119)
- ✓ Spaceship.js: Changed turret base damage from 2 to 20 (line 1402)

## Remaining Changes Needed:

### Enemy.js - Scale HP by 10x:
```javascript
// Line 100: baseHp 5→50, 10→100
const baseHp = elapsedMinutes < 5 ? 50 : 100;

// Line 101: difficultyTier scaling
this.hp = (baseHp + GameContext.difficultyTier * 10) * scale;

// Line 103: elite_roamer HP
this.hp = (160 + GameContext.difficultyTier * 20) * scale;

// Line 109: hunter HP
this.hp = (220 + GameContext.difficultyTier * 30) * scale;

// Line 117: defender HP
this.hp = (150 + (GameContext.difficultyTier - 1) * 20) * scale;

// Line 120: default HP
this.hp = (150 + (GameContext.difficultyTier - 1) * 20) * scale;

// Line 194: gunboat HP
const baseHp = this.gunboatLevel === 1 ? 200 : 260; // was 20/26
this.hp = (baseHp + GameContext.difficultyTier * 10) * getEnemyHpScaling(); // tier scaled 10x

// Line 133: named elite bonus
this.hp += 20; // was 2
```

### Boss Files - Scale HP by 10x:
- Destroyer.js: 300 → 3000
- Destroyer2.js: 300 → 3000
- FinalBoss.js: 1000 → 10000
- SpaceStation.js: 500 → 5000
- WarpSentinelBoss.js: 500 → 5000
- WarpShieldDrone.js: 300 → 3000

### Cave Entities - Scale HP by 10x:
- CaveGuidedMissile.js: opts.hp || 40 (was 4)
- CavePowerRelay.js: 8 → 80
- CaveWallSwitch.js: 3 → 30
- CaveWallTurret.js: (16 + tier) * 10 → (160 + tier * 10)
- CaveMonsterBase.js: (config.hp + 10) * 10 → (config.hp * 10 + 100)

### Spaceship.js - Remaining updates:
- fireVolleyShot(): damage = 2 → 20
- fireForwardLaser(): damage = 2 → 20
- CIWS damage: 1 → 10
- Defense orb damage: Already 10 ✓
- Nuke damage: 5 → 50, ranges also scale up
- Battery damage: 500 → 5000
- Volley shot base: 2 * mult → 20 * mult

### Special Damage Values Review:
- explosiveRounds: 30 → 300 (meta upgrade)
- CIWS tiers: 1-5 → 10-50
- Homing missiles: Keep 1-5 scales (already uses small values)
- Meta shop explosive rounds: 30 → 300

### Constants.js - Update upgrade descriptions:
- All damage-related upgrade descriptions need 10x multiplier in text
