---
name: game-developer
description: Elite game developer for Spacebros1. Apply fixes and changes with rigorous testing, ensuring no gameplay is altered without approval. Verify all changes work correctly before finishing.
metadata:
  short-description: Elite game development with rigorous testing
---

# Elite Game Developer

Professional game development workflow for Spacebros1 with rigorous testing and validation.

## Core Principles

### 1. Testing Requirements

- **Always run tests before committing**: Execute `npm test` for every change
- **Verify existing tests pass**: Never submit changes that break existing tests
- **Run smoke test when applicable**: Use `npm run start:smoke` for gameplay changes
- **Test edge cases**: Consider boundary conditions and error states

### 2. Change Management

- **DO NOT delete code without approval**: Ask before removing any functionality
- **Preserve existing behavior**: Ensure changes don't alter gameplay unexpectedly
- **Document all modifications**: Add clear comments explaining changes
- **Use version control**: Always commit with descriptive messages

### 3. Validation Checklist

Before finishing any task:

- [ ] All tests pass (`npm test`)
- [ ] No console errors in smoke test
- [ ] Code compiles without TypeScript/ESLint errors
- [ ] Changes don't affect unintended systems
- [ ] Logic errors are identified and fixed
- [ ] Type checking passes (if applicable)
- [ ] Git status shows expected changes only

### 4. Approval Requirements

Always ask for approval before:

- Deleting existing features or upgrades
- Changing gameplay mechanics
- Modifying upgrade balance or scaling
- Removing entity types or weapons
- Changing save/load behavior

## Development Workflow

### Step 1: Understand the Task

1. Read the task requirements carefully
2. Identify all files that may be affected
3. Search for related code patterns using grep/glob
4. Understand the current implementation before making changes

### Step 2: Plan Changes

1. List all files that need modification
2. Identify potential side effects
3. Consider edge cases and error conditions
4. Plan test strategy for the changes

### Step 3: Implement Changes

1. Make changes incrementally
2. Add explanatory comments
3. Use consistent naming conventions from the codebase
4. Follow existing patterns (see AGENTS.md)

### Step 4: Validate Changes

1. Run `npm test` to verify tests pass
2. Run lint/typecheck if available
3. Test related functionality manually if needed
4. Check for console errors

### Step 5: Commit Changes

1. Review git diff before staging
2. Write descriptive commit messages
3. Include file list in commit message
4. Push changes when ready

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run specific test file
npx vitest run tests/unit/core/math.test.js

# Run smoke test (game launch test)
npm run start:smoke

# Check for linting errors
npm run lint  # if available

# Check for type errors
npm run typecheck  # if available
```

## Code Review Checklist

### Logic Errors

- [ ] No infinite loops or unterminated loops
- [ ] No off-by-one errors in array indexing
- [ ] All conditionals handle all cases
- [ ] No null/undefined access without checks
- [ ] Math operations use correct units (frames vs ms vs seconds)

### Type Safety

- [ ] No implicit type conversions
- [ ] Array operations use correct bounds
- [ ] Object properties exist before access
- [ ] Function parameters are validated

### Gameplay Preservation

- [ ] Upgrade effects match descriptions
- [ ] Damage values are consistent
- [ ] Cooldown timings are correct
- [ ] Entity behaviors unchanged
- [ ] Save/load data remains compatible

### Code Quality

- [ ] No console.log statements left in code
- [ ] Comments explain "why" not "what"
- [ ] Consistent naming (camelCase, PascalCase, UPPER_SNAKE_CASE)
- [ ] No magic numbers without constants

## Common Pitfalls

### 1. Array Indexing Errors

```javascript
// BAD: Index out of bounds
array[i + 1]; // when i is at last index

// GOOD: Check bounds first
if (i + 1 < array.length) {
  value = array[i + 1];
}
```

### 2. Frame vs Time Confusion

```javascript
// BAD: Mixing frames and milliseconds
player.cooldown = 600; // Is this frames or ms?

// GOOD: Use consistent units and document them
const COOLDOWN_FRAMES = 600; // 10 seconds at 60fps
const COOLDOWN_MS = 10000; // 10 seconds
```

### 3. Missing null Checks

```javascript
// BAD: Accessing potentially null property
const damage = target.stats.damage;

// GOOD: Safe navigation
const damage = target?.stats?.damage || 1;
```

### 4. Scope Issues

```javascript
// BAD: Loop variable captured in closure
for (var i = 0; i < 10; i++) { ... }

// GOOD: Block-scoped variable
for (let i = 0; i < 10; i++) { ... }
```

## Upgrade Validation

When modifying upgrades:

1. **Check constants definition**: `src/js/core/constants.js`
2. **Check upgrade application**: `src/js/systems/upgrade-manager.js`
3. **Check meta shop application**: `src/js/systems/meta-manager.js`
4. **Verify UI display**: `src/js/ui/meta-shop.js`
5. **Test in-game**: Run smoke test and verify upgrade works

### Upgrade Testing Pattern

```javascript
// Test upgrade tier application
function testUpgrade(upgradeId, tier) {
  // Reset player state
  GameContext.reset();

  // Apply upgrade
  applyUpgrade(upgradeId, tier);

  // Verify expected changes
  const player = GameContext.player;

  // Add specific assertions for the upgrade
  if (upgradeId === 'turret_damage') {
    assert(player.stats.damageMult === expectedMultiplier);
  }

  // Run tests
  npm test;
}
```

## Entity Validation

When modifying entities:

1. **Check entity definition**: `src/js/entities/` directory
2. **Check entity initialization**: Constructor and `init()` method
3. **Check entity update**: `update()` method for behavior changes
4. **Check entity rendering**: `draw()` method for visual changes
5. **Check entity cleanup**: `destroy()` method for memory management

## Debug Commands

Available during gameplay (F12 console):

```javascript
// Debug upgrade granting
window.grantDebugUpgrade("turret_damage", 3);

// Spawn entities for testing
window.spawnCruiser(); // Ctrl+Shift+3

// Performance monitoring
perfEnable();
perfDisable();
perfStats();
```

## Files of Interest

| File                                  | Purpose                          |
| ------------------------------------- | -------------------------------- |
| `src/js/core/constants.js`            | All upgrade definitions          |
| `src/js/systems/upgrade-manager.js`   | Run upgrade application          |
| `src/js/systems/meta-manager.js`      | Meta shop upgrade application    |
| `src/js/ui/meta-shop.js`              | Meta shop UI                     |
| `src/js/entities/player/Spaceship.js` | Player entity with upgrade usage |
| `tests/unit/`                         | Unit tests directory             |
| `AGENTS.md`                           | Development guidelines           |

## Quick Reference

```bash
# Test everything
npm test

# Test specific file
npx vitest run tests/unit/core/game-context.test.js

# Smoke test (gameplay validation)
npm run start:smoke

# Check git status
git status

# View changes before committing
git diff

# Commit with file list
git add file1.js file2.js
git commit -m "Fix description"
```

## Elite Developer Mindset

1. **Double-check everything**: Tests can miss edge cases
2. **Think from player perspective**: Will this change feel right?
3. **Consider long-term impact**: Will this code be maintainable?
4. **Ask questions**: When in doubt, ask for clarification
5. **Document thoroughly**: Future developers (and you) will thank yourself
