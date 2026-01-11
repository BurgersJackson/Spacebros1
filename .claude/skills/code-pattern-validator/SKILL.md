---
name: code-pattern-validator
description: Validate code patterns in Spacebros1 main.js. Check for proper entity cleanup, missing endFill() calls (ghosting bug), correct dtFactor usage, and dead entity checks. Use when reviewing code changes, refactoring entities, or preventing common bugs.
metadata:
  short-description: Validate code patterns
---

# Code Pattern Validator

Validate code patterns to prevent common bugs in the Spacebros1 codebase.

## Critical Patterns to Validate

### 1. Entity Cleanup Pattern

**Check:** All entities with PixiJS graphics must clean them up BEFORE calling `pixiCleanupObject()`.

**Required Order:**
```javascript
kill() {
    if (this.dead) return;
    this.dead = true;

    // 1. Graphics cleanup FIRST
    if (this._pixiGfx) {
        try { this._pixiGfx.destroy(true); } catch (e) { }
        this._pixiGfx = null;
    }
    if (this._pixiInnerGfx) {
        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
        this._pixiInnerGfx = null;
    }
    if (this._pixiText) {
        try { this._pixiText.destroy(); } catch (e) { }
        this._pixiText = null;
    }

    // 2. Standard cleanup
    pixiCleanupObject(this);

    // 3. Death logic (sounds, drops, effects)
}
```

**Common Mistakes:**
- Missing `try/catch` around `destroy()` calls
- Not setting graphics to `null` after destroy
- Calling `pixiCleanupObject()` before graphics cleanup
- Missing `if (this.dead) return` at start

### 2. Anti-Ghosting Pattern

**Check:** All PixiJS `lineStyle()` drawing must end with `endFill()`.

**Correct:**
```javascript
gfx.clear();
gfx.lineStyle(2, color, alpha);
gfx.moveTo(x1, y1);
gfx.lineTo(x2, y2);
gfx.endFill();  // CRITICAL - prevents ghost trails
```

**Incorrect:**
```javascript
gfx.lineStyle(2, color, alpha);
gfx.moveTo(x1, y1);
gfx.lineTo(x2, y2);
// Missing endFill() - CAUSES GHOSTING
```

**Files to check:**
- `src/js/main.js` - All drawing methods
- Look for: `drawLaser()`, `drawShield()`, `drawArrow()`

### 3. Variable Timestep Timing

**Check:** All `update()` methods use `dtFactor` for time-based operations.

**Correct:**
```javascript
update(deltaTime = 16.67) {
    if (this.dead) return;

    const dtFactor = deltaTime / 16.67;

    // Use dtFactor for all time-based operations
    this.timer -= dtFactor;
    this.cooldown -= dtFactor;
    this.t += dtFactor;  // NOT this.t++

    // Frame-based checks need Math.floor()
    if (Math.floor(this.t) % 2 === 0) {
        emitParticle(...);
    }
}
```

**Incorrect patterns:**
- `this.t++` (should be `this.t += dtFactor`)
- `this.timer--` (should be `this.timer -= dtFactor`)
- Hardcoded frame counts without time scaling

### 4. Dead Entity Checks

**Check:** All `update()` and `draw()` methods check `this.dead` first.

**Required:**
```javascript
update(deltaTime) {
    if (this.dead) return;
    // ... rest of update
}

draw(ctx) {
    if (this.dead) return;
    // ... rest of draw
}
```

### 5. Global Entity Nullification

**Check:** Entities with global references must nullify them on death.

**Example:**
```javascript
kill() {
    if (this.dead) return;
    this.dead = true;

    // Clear global references
    if (radiationStorm === this) {
        radiationStorm = null;
    }
    if (boss === this) {
        boss = null;
    }

    // ... rest of cleanup
}
```

**Global entities to check:**
- `radiationStorm`
- `boss`
- `destroyer`
- `spaceStation`
- `arcadeBoss`

## Validation Commands

### Manual Check Scripts

Existing scripts in the project root:

```bash
# Check brace matching
node check-braces.js

# Check level data integrity
node check-levels.js
```

### Grep Patterns

Find potential issues:

```bash
# Missing endFill() after lineStyle
grep -n "lineStyle" src/js/main.js | grep -v "endFill"

# Direct increment instead of dtFactor
grep -n "this\.t++" src/js/main.js

# Missing dead check in update
grep -A 3 "^    update(" src/js/main.js | grep -v "if (this.dead)"
```

## Common Bug Patterns

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Missing `endFill()` | Ghost trails on lines | Add `gfx.endFill()` after drawing |
| Graphics cleanup order | Memory leaks, crashes | Destroy graphics before `pixiCleanupObject()` |
| Missing `dtFactor` | Inconsistent timing at different FPS | Scale all time values by `dtFactor` |
| Missing dead check | Operating on dead entities | Add `if (this.dead) return` at start |

## Files Requiring Validation

| File | Lines | Focus |
|------|-------|-------|
| `src/js/main.js` | 26000+ | All entity classes |
| `src/js/entities/Entity.js` | 134 | Base class patterns |
| `src/js/rendering/pixi-setup.js` | - | Sprite pool management |

## Validation Checklist

For any entity modification:

- [ ] `kill()` method has `if (this.dead) return`
- [ ] PixiJS graphics destroyed with `try/catch`
- [ ] Graphics set to `null` after destroy
- [ ] `pixiCleanupObject()` called after graphics cleanup
- [ ] `update()` uses `dtFactor` for time operations
- [ ] No `this.t++` (use `this.t += dtFactor`)
- [ ] All `lineStyle()` followed by `endFill()`
- [ ] Global references nullified if applicable
