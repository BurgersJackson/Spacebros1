---
name: collision-testing-tool
description: Test and validate collision detection in Spacebros1. Visualize hitboxes, test spatial hash performance, validate entity collision boundaries, and debug collision issues. Use when adding new entities, fixing collision bugs, or optimizing collision detection.
metadata:
  short-description: Test collision detection
---

# Collision Testing Tool

Test and validate collision detection in the Spacebros1 codebase.

## Collision System Overview

The game uses **Spatial Hash Grids** for efficient collision detection:

```javascript
// From src/js/main.js
const asteroidGrid = new SpatialHash(300);  // Cell size ~300 units
const targetGrid = new SpatialHash(350);    // Cell size ~350 units
```

**Grid Purposes:**
- `asteroidGrid`: Asteroids, environment objects
- `targetGrid`: Enemies, bases, turrets, bosses
- `bulletGrid`: Projectiles (managed in core/performance.js)

## Debug Visualization

### Enable Hitbox Debug Mode

**Toggle:** Press `Ctrl+Shift+H` during gameplay

**Visualizes:**
- Entity hitboxes (circles)
- Collision boundaries
- Spatial hash cell divisions

**Code location:** `src/js/main.js:170-184`

```javascript
// DEBUG: Ctrl+Shift+H toggles hitbox visualization
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        DEBUG_COLLISION = !DEBUG_COLLISION;
        showOverlayMessage(`HITBOX DEBUG: ${DEBUG_COLLISION ? "ON" : "OFF"}`,
                          DEBUG_COLLISION ? '#0f0' : '#f00', 1500);
    }
});
```

## Collision Testing Workflow

### 1. Visual Hitbox Validation

Enable debug mode and verify hitbox sizes match sprites:

```javascript
// In console
DEBUG_COLLISION = true;

// Or use the keybinding: Ctrl+Shift+H
```

**What to check:**
- Hitbox circle matches visual sprite size
- Hitbox is centered on entity position
- Hitbox scales correctly for larger enemies

### 2. Spatial Hash Query Testing

Test spatial hash lookups:

```javascript
// Test spatial hash queries
function testSpatialHash() {
    // Insert test entity
    const testEnemy = enemies[0];
    if (testEnemy) {
        targetGrid.insert(testEnemy);

        // Query nearby entities
        const nearby = targetGrid.query(testEnemy.pos.x, testEnemy.pos.y, 200);
        console.log(`Found ${nearby.length} entities nearby`);

        // Verify self is included
        console.log('Self included:', nearby.includes(testEnemy));
    }
}

testSpatialHash();
```

### 3. Collision Pair Testing

Test specific entity collision pairs:

```javascript
// Test bullet vs enemy collision
function testBulletEnemyCollision() {
    if (enemies.length === 0) {
        console.log('No enemies to test');
        return;
    }

    const enemy = enemies[0];
    const bullet = new Bullet(player.pos.x, player.pos.y, player.angle, 10);

    // Direct collision check
    const collides = bullet.collidesWith(enemy);
    console.log('Bullet vs Enemy collision:', collides);

    // Distance check
    const dist = bullet.distTo(enemy);
    const combinedRadius = bullet.radius + enemy.radius;
    console.log(`Distance: ${dist.toFixed(2)}, Combined radius: ${combinedRadius}`);
    console.log('Colliding:', dist < combinedRadius);

    // Cleanup
    bullet.kill();
}

testBulletEnemyCollision();
```

## Collision Reference

### SpatialHash API

```javascript
// Create spatial hash
const grid = new SpatialHash(cellSize);

// Insert entity
grid.insert(entity);  // entity must have pos.x, pos.y, radius

// Query for entities within radius
const results = grid.query(x, y, radius);

// Remove entity
grid.remove(entity);

// Clear all
grid.clear();
```

### Entity Collision Methods

```javascript
// Check collision with another entity
entity.collidesWith(otherEntity)  // Returns boolean

// Get distance (slower)
entity.distTo(otherEntity)  // Returns number

// Get squared distance (faster, use for comparisons)
entity.distSqTo(otherEntity)  // Returns number

// Get angle to entity
entity.angleTo(otherEntity)  // Returns radians
```

## Common Collision Issues

### Issue: Hitbox Too Large/Small

**Symptom:** Collisions happen at wrong distances

**Fix:** Adjust entity radius:

```javascript
// In entity constructor
this.radius = 20;  // Adjust this value

// For shielded enemies, also adjust:
this.shieldRadius = 30;
```

### Issue: Missed Fast Projectiles

**Symptom:** Bullets pass through enemies

**Causes:**
- Projectile moves faster than its size per frame
- Frame rate drops causing large time steps

**Fixes:**
1. Increase projectile size: `this.radius = 15;`
2. Use raycasting for very fast projectiles
3. Enable continuous collision detection

### Issue: Spatial Hash Performance

**Symptom:** Slow queries when many entities exist

**Check:**
```javascript
// Measure query performance
console.time('spatial-query');
const results = targetGrid.query(player.pos.x, player.pos.y, 1000);
console.timeEnd('spatial-query');
console.log(`Found ${results.length} entities`);
```

**Fixes:**
- Adjust cell size for typical entity radius
- Cell size should be ~2x largest entity radius
- Current: 300-350 units for 20-50 unit entities

## Test Script Template

Create test scenarios in `test-collision.js`:

```javascript
// Collision test template
function testCollisionScenario() {
    console.log('=== COLLISION TEST ===');

    // Spawn test enemy
    const enemy = new Enemy('roamer');
    enemy.pos.x = 1000;
    enemy.pos.y = 1000;

    // Spawn test bullet
    const bullet = new Bullet(900, 1000, 0, 10);

    // Test collision
    console.log('Enemy pos:', enemy.pos.x, enemy.pos.y);
    console.log('Enemy radius:', enemy.radius);
    console.log('Bullet pos:', bullet.pos.x, bullet.pos.y);
    console.log('Bullet radius:', bullet.radius);
    console.log('Collides:', bullet.collidesWith(enemy));

    // Cleanup
    enemy.kill();
    bullet.kill();
}

testCollisionScenario();
```

## Files of Interest

| File | Purpose |
|------|---------|
| `src/js/core/math.js` | `SpatialHash` class implementation |
| `test-collision.js` | Existing collision test script |
| `src/js/core/performance.js` | `bulletGrid`, rebuildBulletGrid() |
| `src/js/main.js` | All entity collision logic |

## Debug Commands

```javascript
// Count entities in each grid
function countGridEntities() {
    console.log('Targets in grid:', targetGrid.query(0, 0, 50000).length);
    console.log('Asteroids in grid:', asteroidGrid.query(0, 0, 50000).length);
}

countGridEntities();

// Check specific entity grid membership
function checkEntityGrid(entity) {
    const results = targetGrid.query(entity.pos.x, entity.pos.y, entity.radius * 2);
    console.log('Entity in grid results:', results.includes(entity));
}

checkEntityGrid(enemies[0]);
```
