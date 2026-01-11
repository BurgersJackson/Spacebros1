---
name: entity-generator
description: Generate new game entities (enemies, projectiles, bosses) for Spacebros1 with proper PixiJS cleanup patterns, sprite pool configuration, and variable timestep timing. Use when creating new enemy types, bosses, projectiles, or any entity that extends the Entity base class.
metadata:
  short-description: Generate game entities
---

# Entity Generator

Generate new game entities with correct patterns for the Spacebros1 codebase.

## Entity Structure

All entities extend the `Entity` base class from `src/js/entities/Entity.js`:
- Constructor takes `(x, y)` position
- Core properties: `pos`, `vel`, `dead`, `radius`, `angle`, `prevPos`
- `update(deltaTime)` method using time scaling
- Optional `draw(ctx)` method
- `kill()` method for cleanup

## Critical Patterns

### Variable Timestep Timing

All `update()` methods must use `dtFactor` for time-based operations:

```javascript
update(deltaTime = 16.67) {
    if (this.dead) return;

    const dtFactor = deltaTime / 16.67;  // Normalize to 60Hz reference

    // Time-based operations
    this.timer -= dtFactor;
    this.cooldown -= dtFactor;

    // Counter increments (NOT this.t++)
    this.t += dtFactor;

    // Frame-based checks need Math.floor()
    if (Math.floor(this.t) % 2 === 0) {
        // Do something every 2 frames
    }
}
```

### Entity Cleanup Pattern (CRITICAL)

PixiJS graphics must be destroyed BEFORE standard cleanup:

```javascript
kill() {
    if (this.dead) return;
    this.dead = true;

    // 1. Clean up entity-specific graphics FIRST
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

    // 2. Then standard cleanup
    pixiCleanupObject(this);

    // 3. Continue with death logic (sounds, drops, etc.)
}
```

### PixiJS Anti-Ghosting

Always call `endFill()` after drawing lines:

```javascript
gfx.clear();
gfx.lineStyle(2, color, alpha);
gfx.moveTo(x1, y1);
gfx.lineTo(x2, y2);
gfx.endFill();  // CRITICAL: prevents ghosting
```

## Sprite Pool Configuration

Add new sprite types to `src/js/rendering/pixi-setup.js`:

```javascript
export const pixiCustomSpritePool = createPixiSpritePool('custom');
```

Reference: `src/js/rendering/sprite-pools.js`

## Entity Template

```javascript
class CustomEnemy extends Entity {
    constructor(startPos = null, opts = {}) {
        super(0, 0);
        this._pixiPool = 'enemy';  // or 'bullet', 'particle', etc.

        // Position
        if (startPos) {
            this.pos.x = startPos.x;
            this.pos.y = startPos.y;
        } else {
            const start = findSpawnPointRelative(true);
            this.pos.x = start.x;
            this.pos.y = start.y;
        }

        // Physics
        this.radius = 20;
        this.thrustPower = 0.72;
        this.maxSpeed = 13.6;
        this.friction = 0.94;

        // Combat
        this.hp = 10;
        this.shootTimer = 40;

        // Graphics
        this._pixiGfx = null;
        this._pixiInnerGfx = null;

        // AI
        this.aiState = 'SEEK';
        this.aiTimer = 0;
    }

    update(deltaTime) {
        if (this.dead) return;

        const dtFactor = deltaTime / 16.67;

        // AI logic
        this.aiTimer -= dtFactor;
        if (this.aiTimer <= 0) {
            // Change AI state
        }

        // Movement
        this.pos.x += this.vel.x * dtFactor;
        this.pos.y += this.vel.y * dtFactor;

        // Shooting
        this.shootTimer -= dtFactor;
        if (this.shootTimer <= 0) {
            // Fire projectile
            this.shootTimer = 40;
        }

        super.update(deltaTime);
    }

    kill() {
        if (this.dead) return;
        this.dead = true;

        // Clean up graphics FIRST
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }

        pixiCleanupObject(this);

        // Death effects
        playSound('explode');
        spawnFieryExplosion(this.pos.x, this.pos.y, 1.0);
    }
}
```

## Common Entity Types

| Type | Base Class | Sprite Pool | Notes |
|------|------------|-------------|-------|
| Basic Enemy | `Enemy` | `enemy` | Use for roamers, hunters |
| Boss | `Cruiser` | `enemy` | Large, multi-phase |
| Projectile | `Bullet` | `bullet` | Short-lived |
| Particle | `Particle` | `particle` | Visual effects |
| Pickup | `Coin`, `SpaceNugget` | `pickup` | Collectibles |

## File Location

Add new entities to `src/js/main.js` (monolithic structure) at appropriate line ranges:
- Enemies: ~line 5740+
- Bosses: ~line 10699+
- Projectiles: ~line 5356+

## Asset Configuration

Add sprite paths to `ASSET_URLS` in `src/js/core/constants.js`:

```javascript
export const ASSET_URLS = {
    // ...
    customEnemy: 'assets/custom_enemy.png',
};
```
