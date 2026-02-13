/**
 * Performance Utilities
 * Optimization helpers for hot paths in the game loop.
 */

import { SpatialHash } from "./math.js";

// --- View Frustum Culling ---

/**
 * Cached view bounds for the current frame.
 * Updated once per frame in gameLoopLogic.
 */
export const viewBounds = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  // Extended bounds for entities that should update even slightly off-screen
  extLeft: 0,
  extRight: 0,
  extTop: 0,
  extBottom: 0
};

/**
 * Update view bounds for the current frame.
 * Call once at the start of gameLoopLogic.
 * @param {number} camX - Camera center X
 * @param {number} camY - Camera center Y
 * @param {number} viewW - View width in world units
 * @param {number} viewH - View height in world units
 * @param {number} margin - Extra margin for entities entering view (default: 200)
 * @param {number} extendedMargin - Extended margin for update culling (default: 500)
 */
export function updateViewBounds(camX, camY, viewW, viewH, margin = 200, extendedMargin = 500) {
  const halfW = viewW / 2;
  const halfH = viewH / 2;

  viewBounds.left = camX - halfW - margin;
  viewBounds.right = camX + halfW + margin;
  viewBounds.top = camY - halfH - margin;
  viewBounds.bottom = camY + halfH + margin;

  viewBounds.extLeft = camX - halfW - extendedMargin;
  viewBounds.extRight = camX + halfW + extendedMargin;
  viewBounds.extTop = camY - halfH - extendedMargin;
  viewBounds.extBottom = camY + halfH + extendedMargin;
}

/**
 * Check if position is within view bounds (for rendering).
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {boolean}
 */
export function isInView(x, y) {
  return x > viewBounds.left && x < viewBounds.right && y > viewBounds.top && y < viewBounds.bottom;
}

/**
 * Check if position is within view bounds with an extra radius.
 * Useful for large entities so they don't pop in/out when their center leaves view.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} radius - Extra radius margin
 * @returns {boolean}
 */
export function isInViewRadius(x, y, radius = 0) {
  const r = Math.max(0, radius || 0);
  return (
    x > viewBounds.left - r &&
    x < viewBounds.right + r &&
    y > viewBounds.top - r &&
    y < viewBounds.bottom + r
  );
}

/**
 * Check if position is within extended view bounds (for updates).
 * Entities outside extended bounds can skip updates.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {boolean}
 */
export function isInExtendedView(x, y) {
  return (
    x > viewBounds.extLeft &&
    x < viewBounds.extRight &&
    y > viewBounds.extTop &&
    y < viewBounds.extBottom
  );
}

/**
 * Check if entity is within view bounds.
 * @param {Object} entity - Entity with pos.x, pos.y
 * @returns {boolean}
 */
export function entityInView(entity) {
  return isInView(entity.pos.x, entity.pos.y);
}

/**
 * Check if entity is within extended view bounds.
 * @param {Object} entity - Entity with pos.x, pos.y
 * @returns {boolean}
 */
export function entityInExtendedView(entity) {
  return isInExtendedView(entity.pos.x, entity.pos.y);
}

// --- Bullet Spatial Hash ---

/**
 * Spatial hash specifically for bullets.
 * Cell size tuned for typical bullet speeds and collision ranges.
 */
export const bulletGrid = new SpatialHash(150);

/**
 * Rebuild the bullet spatial hash.
 * Call once per frame before collision detection.
 * @param {Array} bullets - Array of bullet objects
 */
export function rebuildBulletGrid(bullets) {
  bulletGrid.clear();
  const len = bullets.length;
  for (let i = 0; i < len; i++) {
    const b = bullets[i];
    if (!b.dead) {
      bulletGrid.insert(b);
    }
  }
}

// --- Array Cleanup Utilities ---

/**
 * Compact an array by removing dead entries (swap-and-pop style).
 * Much faster than splice() for removing multiple items.
 * @param {Array} arr - Array to compact
 * @param {Function} cleanup - Optional cleanup function called for each dead item
 * @returns {number} Number of items removed
 */
export function compactArray(arr, cleanup = null) {
  let writeIdx = 0;
  const len = arr.length;

  for (let i = 0; i < len; i++) {
    const item = arr[i];
    if (item.dead) {
      if (cleanup) cleanup(item);
    } else {
      arr[writeIdx++] = item;
    }
  }

  const removed = len - writeIdx;
  arr.length = writeIdx;
  return removed;
}

/**
 * Compact an array using a custom predicate.
 * @param {Array} arr - Array to compact
 * @param {Function} keepFn - Return true to keep item, false to remove
 * @param {Function} cleanup - Optional cleanup function called for removed items
 * @returns {number} Number of items removed
 */
export function compactArrayWith(arr, keepFn, cleanup = null) {
  let writeIdx = 0;
  const len = arr.length;

  for (let i = 0; i < len; i++) {
    const item = arr[i];
    if (keepFn(item)) {
      arr[writeIdx++] = item;
    } else if (cleanup) {
      cleanup(item);
    }
  }

  const removed = len - writeIdx;
  arr.length = writeIdx;
  return removed;
}

// --- Distance Utilities ---

/**
 * Squared distance between two points (faster than actual distance).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Check if distance between two points is less than threshold (using squared comparison).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} threshold
 * @returns {boolean}
 */
export function distLessThan(x1, y1, x2, y2, threshold) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy < threshold * threshold;
}

/**
 * Pre-computed squared thresholds for common collision checks.
 * Update these if collision radii change.
 */
export const thresholdsSq = {
  bullet_enemy: 0, // Updated dynamically
  bullet_player: 0, // Updated dynamically
  pickup_player: 0, // Updated dynamically
  magnet_range: 0 // Updated dynamically
};

/**
 * Update pre-computed squared thresholds.
 * Call when player radius or magnet range changes.
 * @param {Object} config
 */
export function updateThresholds(config) {
  if (config.bulletEnemy) {
    thresholdsSq.bullet_enemy = config.bulletEnemy * config.bulletEnemy;
  }
  if (config.bulletPlayer) {
    thresholdsSq.bullet_player = config.bulletPlayer * config.bulletPlayer;
  }
  if (config.pickupPlayer) {
    thresholdsSq.pickup_player = config.pickupPlayer * config.pickupPlayer;
  }
  if (config.magnetRange) {
    thresholdsSq.magnet_range = config.magnetRange * config.magnetRange;
  }
}
