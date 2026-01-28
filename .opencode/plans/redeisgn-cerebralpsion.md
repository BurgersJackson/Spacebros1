# Redesign Plan: CerebralPsion Boss

## Current Issues Identified

### 1. Excessive Teleportation

- **TELEPORT_STRIKE phase**: Teleports every 40 ticks (0.67 seconds) at 500 units from player
- **PSIONIC_STORM phase**: Teleports every 8 ticks (0.13 seconds) - extremely chaotic
- **Phase changes**: Boss teleports on every phase transition
- Result: Unpredictable, frustrating combat with no clear damage windows

### 2. Confusing Reality Fracture

- At 40% HP, spawns 3 fake echoes
- Echoes orbit and distract player
- Unclear which target is real boss

### 3. Stasis Field Issue

- Dungeon bosses currently get frozen by player's Stasis Field upgrade
- Condition in Enemy.js line 454: `!this.isCruiser` only prevents Cruisers from being frozen
- Dungeon bosses are NOT frozen - this is WRONG per user requirement
- User requirement: "no dungeon bosses should be freezable by the players stasis field upgrade"

---

## Proposed New CerebralPsion Design

### Theme: Psionic Mind Control

Replace chaotic teleportation with strategic positioning and psychological warfare mechanics.

### New Phase Sequence

| Phase           | Duration | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| PSYCHIC_BARRAGE | 160      | Rapid guided missiles + psychic shockwaves        |
| MIND_SHACKLES   | 180      | Tractor beam pulls player in + restricts movement |
| ECHO_SWARM      | 160      | Spawn 3 active echoes that mirror attacks         |
| MENTAL_BLADE    | 140      | Piercing psychic daggers that penetrate shields   |
| REALITY_TEAR    | 200      | Final desperation phase - all abilities combined  |

### Phase Details

#### 1. PSYCHIC_BARRAGE (160 ticks)

- **Every 60 ticks**: Fire guided missile (FlagshipGuidedMissile)
- **Every 30 ticks**: Psychic shockwave (push player away at 800 range)
- **Every 20 ticks**: Particle burst for visual feedback
- **Behavior**: Standard cruiser-style movement (orbit/circle/flank)

#### 2. MIND_SHACKLES (180 ticks)

- **Every 5 ticks**: Active tractor beam pulls player inward (slow but steady)
- **Every 40 ticks**: Fire homing missile (prevents player from running away)
- **Effect**: Player feels trapped, but not instant teleportation
- **Movement**: Boss stays relatively still, forcing player to break free or fight

#### 3. ECHO_SWARM (160 ticks)

- **Tick 0**: Spawn 3 PsychicEcho entities that actively fight
- **Echo behavior**:
  - Fire curtain pattern at player (5-tick interval)
  - Have 25% of boss HP each
  - Die when destroyed or phase ends
- **Boss attacks**: Every 40 ticks, homing missile
- **Strategy**: Player must prioritize echoes or tank while boss adds pressure

#### 4. MENTAL_BLADE (140 ticks)

- **Every 12 ticks**: Fire 3 psychic daggers in spread pattern
  - Daggers have `ignoreShields: true` property
  - Damage: 3 per dagger
  - Color: `#f0f` (bright purple)
- **Every 50 ticks**: Wide cone attack (12 bullets in arc)
- **Risk**: Shields are bypassed, forcing player to dodge

#### 5. REALITY_TEAR (200 ticks)

- **Every 8 ticks**: Rapid fire (speed 12)
- **Every 20 ticks**: Random spawn psychic echo
- **Every 40 ticks**: Homing missile + mind push
- **Trigger**: Activates at 30% HP (single trigger, not repeatable)
- **Effect**: All-out assault, player under pressure

### Movement Pattern Changes

**Remove**: All teleportation methods

- Delete `teleport()` method entirely
- Remove teleport on phase change (lines 31-34 in current `update()`)
- Remove TELEPORT_STRIKE phase teleportation (lines 212-220 in current `runPhaseAttacks()`)
- Remove PSIONIC_STORM phase teleportation (lines 302-309 in current `runPhaseAttacks()`)

**Keep**: Standard cruiser-style AI movement

- Alternating between: CIRCLE, ORBIT, SEEK, FLANK
- Predictable, gives player clear damage windows
- Boss maintains consistent position relative to player

### Visual/Atmospheric Changes

#### Psychic Power Surge Visual

- **Every phase change**: Boss pulses with energy
- **Implementation**: Flash particles and brief screen shake
- **Feedback**: Clear indication of phase transition

#### Tractor Beam Visual

- **During MIND_SHACKLES phase**: Draw visible tether to player
- **Implementation**: Line from boss to player position
- **Color**: Gradient purple (transparent to opaque)

#### Psychic Knife Visuals

- **Mental Blade projectiles**: Distinct from regular bullets
- **Shape**: Elongated with glowing tip
- **Trail**: Particle trail behind projectile

---

## File Changes Required

### 1. `src/js/entities/bosses/dungeon/CerebralPsion.js`

#### Remove Properties

- `teleportCooldown` (line 67)
- `realityFractureTriggered` (line 68)
- `realityFractureTimer` (line 71)
- `realityFractureTriggered` - Reality fracture at 40% HP is being replaced

#### Add Properties

- `mindShacklesActive = false`
- `mentalBladeCount = 0`
- `realityTearTriggered = false`

#### Replace Phase Sequence

**Current** (lines 73-79):

```javascript
this.phaseSeq = [
  { name: "TELEPORT_STRIKE", duration: 140 },
  { name: "PSYCHIC_FIELD", duration: 180 },
  { name: "ECHO_SUMMON", duration: 160 },
  { name: "MIND_CRUSH", duration: 120 },
  { name: "PSIONIC_STORM", duration: 200 }
];
```

**New**:

```javascript
this.phaseSeq = [
  { name: "PSYCHIC_BARRAGE", duration: 160 },
  { name: "MIND_SHACKLES", duration: 180 },
  { name: "ECHO_SWARM", duration: 160 },
  { name: "MENTAL_BLADE", duration: 140 },
  { name: "REALITY_TEAR", duration: 200 }
];
```

#### Replace `runPhaseAttacks()` Method

**Delete entire current method** (lines 202-323)

**New method implementation** (all 5 phases with new mechanics):

```javascript
runPhaseAttacks() {
  if (!GameContext.player || GameContext.player.dead) return;

  const aim = Math.atan2(
    GameContext.player.pos.y - this.pos.y,
    GameContext.player.pos.x - this.pos.x
  );

  if (this.phaseName === "PSYCHIC_BARRAGE") {
    if (this.phaseTick % 60 === 0) {
      // Homing missiles
      GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
      playSound("heavy_shoot");
    }
    if (this.phaseTick % 30 === 0) {
      // Psychic shockwave
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#f0f");
      // Push player away
      if (GameContext.player && !GameContext.player.dead) {
        const dx = GameContext.player.pos.x - this.pos.x;
        const dy = GameContext.player.pos.y - this.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 800 && dist > 0) {
          const pushForce = 12;
          GameContext.player.vel.x += (dx / dist) * pushForce;
          GameContext.player.vel.y += (dy / dist) * pushForce;
        }
      }
      playSound("shockwave");
    }
    if (this.phaseTick % 20 === 0) {
      // Particle burst
      if (_spawnParticles)
        _spawnParticles(this.pos.x, this.pos.y, 5, "#a0f");
    }
  } else if (this.phaseName === "MIND_SHACKLES") {
    this.mindShacklesActive = true;
    // Tractor beam pulls player in every 5 ticks
    if (this.phaseTick % 5 === 0 && GameContext.player && !GameContext.player.dead) {
      const dx = this.pos.x - GameContext.player.pos.x;
      const dy = this.pos.y - GameContext.player.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1200 && dist > 0) {
        // Gentle but persistent pull
        GameContext.player.vel.x += (dx / dist) * 0.8;
        GameContext.player.vel.y += (dy / dist) * 0.8;
      }
    }
    // Fire homing missile to discourage running away
    if (this.phaseTick % 40 === 0) {
      GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
      playSound("heavy_shoot");
    }
    if (_spawnParticles) {
      _spawnParticles(
        this.pos.x + (Math.random() - 0.5) * 200,
        this.pos.y + (Math.random() - 0.5) * 200,
        2,
        "#a0f"
      );
    }
  } else if (this.phaseName === "ECHO_SWARM") {
    // Spawn 3 echoes at start of phase
    if (this.phaseTick === 0) {
      this.spawnEchoes(3);
      showOverlayMessage("ECHO SWARM ACTIVATED", "#f0f", 1500);
    }
    // Echoes fire curtain pattern every 15 ticks
    if (this.phaseTick % 15 === 0) {
      for (let i = -2; i <= 2; i++) {
        const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.2, 10, {
          owner: "enemy",
          damage: 1,
          radius: 3,
          color: "#f0f"
        });
        b.owner = this;
        GameContext.bullets.push(b);
      }
      playSound("rapid_shoot");
    }
    // Boss also fires homing missiles
    if (this.phaseTick % 40 === 0) {
      GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
      playSound("heavy_shoot");
    }
  } else if (this.phaseName === "MENTAL_BLADE") {
    this.mindShacklesActive = false;
    // Fire psychic daggers that penetrate shields
    if (this.phaseTick % 12 === 0) {
      const numBlades = 3;
      for (let i = 0; i < numBlades; i++) {
        const spread = -0.3 + (i / (numBlades - 1)) * 0.6;
        const b = new Bullet(this.pos.x, this.pos.y, aim + spread, 14, {
          owner: "enemy",
          damage: 3,
          radius: 6,
          color: "#f0f",
          ignoreShields: true  // Bypass player shields
        });
        b.owner = this;
        GameContext.bullets.push(b);
      }
      playSound("laser");
    }
    // Wide cone attack
    if (this.phaseTick % 50 === 0) {
      for (let i = -6; i <= 6; i++) {
        const b = new Bullet(this.pos.x, this.pos.y, aim + i * 0.15, 11, {
          owner: "enemy",
          damage: 1,
          radius: 3,
          color: "#d0f"
        });
        b.owner = this;
        GameContext.bullets.push(b);
      }
      playSound("shotgun");
    }
  } else if (this.phaseName === "REALITY_TEAR") {
    this.mindShacklesActive = false;
    // Triggered once at 30% HP - final desperate assault
    if (!this.realityTearTriggered) {
      this.realityTearTriggered = true;
      showOverlayMessage("REALITY TEAR! FINAL PHASE!", "#f00", 2000);
    }
    // Rapid fire
    if (this.phaseTick % 8 === 0) {
      const b = new Bullet(this.pos.x, this.pos.y, aim, 12, {
        owner: "enemy",
        damage: 1,
        radius: 3,
        color: "#f0f"
      });
      b.owner = this;
      GameContext.bullets.push(b);
      playSound("rapid_shoot");
    }
    // Spawn echoes randomly
    if (this.phaseTick % 20 === 0) {
      this.spawnEchoes(1);
    }
    // Homing missiles + shockwaves
    if (this.phaseTick % 40 === 0) {
      GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
      // Psychic shockwave
      if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 15, "#f0f");
      if (GameContext.player && !GameContext.player.dead) {
        const dx = GameContext.player.pos.x - this.pos.x;
        const dy = GameContext.player.pos.y - this.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 800 && dist > 0) {
          const pushForce = 15;
          GameContext.player.vel.x += (dx / dist) * pushForce;
          GameContext.player.vel.y += (dy / dist) * pushForce;
        }
      }
      playSound("heavy_shoot");
    }
  }
}
```

#### Remove Methods

- `teleport()` method entirely (lines 340-350)
- Remove reality fracture logic from `update()` method (lines 104-120)
- Remove `fireFlameBreath()` method (lines 325-338) - not used in new design

#### Modify `update()` Method

**Remove these sections:**

- Lines 101: `this.teleportCooldown -= dtFactor;`
- Lines 104-110: Reality fracture timer logic
- Lines 113-120: Reality fracture trigger at 40% HP
- Lines 131-134: Teleport on phase change

**Add these sections:**

Replace reality fracture trigger with reality tear trigger:

```javascript
// Reality Tear at 30% HP (one-time trigger)
if (!this.realityTearTriggered && this.hp / this.maxHp <= 0.3) {
  this.realityTearTriggered = true;
  // Force phase switch to REALITY_TEAR on next cycle
  this.phaseIndex = this.phaseSeq.length - 1; // Index of REALITY_TEAR
  showOverlayMessage("REALITY TEAR IMMINENT!", "#f00", 2000);
}
```

**Keep**: All other movement logic unchanged

- Phase timer decrement
- Movement mode switching (CIRCLE, ORBIT, SEEK, FLANK)
- Shield rotation

#### Modify `kill()` Method

**Ensure cleanup:**

- Echoes are already cleaned up in current implementation (lines 368-372) - KEEP
- Disable mind shackle visual if added (if we add tether visualization)

#### Modify `drawBossHud()` Method

**No changes needed** - phase name already displays correctly

#### Optional: Add `draw()` Method Enhancement

If we want to visualize the mind shackle tether:

```javascript
draw(ctx) {
  super.draw(ctx);

  // Draw mind shackle tether
  if (this.mindShacklesActive && GameContext.player && !GameContext.player.dead) {
    const rPos = this.getRenderPos(getRenderAlpha());
    const playerPos = GameContext.player.getRenderPos(getRenderAlpha());

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rPos.x, rPos.y);
    ctx.lineTo(playerPos.x, playerPos.y);
    ctx.stroke();

    // Pulsing energy effect
    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(168, 0, 255, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rPos.x, rPos.y);
    ctx.lineTo(playerPos.x, playerPos.y);
    ctx.stroke();
    ctx.restore();
  }
}
```

**Note**: This depends on whether boss calls `super.draw(ctx)` - if using Pixi rendering, may need different implementation.

---

### 2. `src/js/entities/enemies/Enemy.js`

#### Fix Stasis Field Dungeon Boss Immunity

**Location**: Line 454

**Current**:

```javascript
} else if (GameContext.player.stats.slowField > 0 && !this.isCruiser) {
```

**Issue**: This condition allows dungeon bosses to be frozen because:

- Cruisers have `isCruiser = true` - they are NOT frozen ✓
- Dungeon bosses have `isCruiser = false` (they extend Enemy) - they ARE frozen ✗
- User requirement: Dungeon bosses should NOT be frozen

**Fixed**:

```javascript
} else if (GameContext.player.stats.slowField > 0 && !this.isCruiser && !this.isDungeonBoss) {
```

**Rationale**: Add `!this.isDungeonBoss` check to prevent Stasis Field from affecting dungeon bosses.

**Impact After Fix**:

- Cruisers (isCruiser=true) → NOT frozen ✓
- Dungeon bosses (isDungeonBoss=true) → NOT frozen ✓
- Regular enemies (both false) → ARE frozen ✓

**Affected Dungeon Bosses** (all have `this.isDungeonBoss = true`):

- PsyLich
- NecroticHive
- CerebralPsion
- Fleshforge
- VortexMatriarch
- ChitinusPrime

---

## Summary of Changes

| Change                                  | Files Affected   | Lines                                           | Impact                                    |
| --------------------------------------- | ---------------- | ----------------------------------------------- | ----------------------------------------- |
| Remove teleportation mechanics          | CerebralPsion.js | 67, 104-120, 131-134, 212-220, 302-309, 340-350 | Boss stays predictable, fairer combat     |
| New 5-phase attack sequence             | CerebralPsion.js | 73-79, 202-323                                  | Coherent boss flow, clear phases          |
| Add Reality Tear at 30% HP              | CerebralPsion.js | 113-120 replacement, 202-323                    | Escalating difficulty finale              |
| Add Mental Blade shield-piercing attack | CerebralPsion.js | 202-323                                         | Forces positioning, breaks shield camping |
| Add Mind Shackle tractor beam           | CerebralPsion.js | 202-323, optional draw()                        | Creates pressure zones without teleport   |
| Make Echoes fight actively              | CerebralPsion.js | 202-323                                         | Strategic adds, not just confusion        |
| Fix Stasis Field dungeon boss immunity  | Enemy.js         | 454                                             | Dungeon bosses CANNOT be frozen           |

---

## Testing Checklist

After implementation:

- [ ] Spawn CerebralPsion and verify it doesn't teleport
- [ ] Test all 5 phases transition correctly
- [ ] Verify Reality Tear triggers at 30% HP exactly once
- [ ] Test Stasis Field on CerebralPsion - should NOT freeze boss
- [ ] Test Psychic Blade ignores player shields
- [ ] Test Echo Swarm echoes fire at player
- [ ] Test Mind Shackle visual tether appears/disappears (if implemented)
- [ ] Test Psychic Barrage shockwave pushes player
- [ ] Verify movement AI uses standard cruiser patterns (orbit/circle/flank)
- [ ] Run `npm test` - all tests should pass
- [ ] Run `npm run start:smoke` - no console errors
- [ ] Test other dungeon bosses with Stasis Field - should NOT freeze them

---

## Expected Player Experience

### Before:

- Boss teleports randomly every 0.5-2 seconds
- Player can't line up shots
- Frustrating, feels unfair
- Shield camping somewhat effective

### After:

- Boss uses predictable movement patterns
- Clear phase telegraphs (phase name on HUD)
- Strategic choices: dodge attacks, prioritize echoes
- Mental Blade forces movement (can't just sit behind shields)
- Mind Shackle creates pressure zones without chaos
- Reality Tear provides escalating finale
- Dungeon bosses CANNOT be frozen (maintains challenge)
- Fair, skill-based fight with clear progression
