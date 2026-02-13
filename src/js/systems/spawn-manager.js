import { GameContext } from "../core/game-context.js";
import { EnvironmentAsteroid } from "../entities/environment/EnvironmentAsteroid.js";
import { Enemy } from "../entities/enemies/Enemy.js";
import { Pinwheel } from "../entities/enemies/Pinwheel.js";
import { CavePinwheel1, CavePinwheel2, CavePinwheel3 } from "../entities/cave/index.js";
import { Drone } from "../entities/support/Drone.js";
import { findSpawnPointRelative } from "../utils/spawn-utils.js";
import { playSound } from "../audio/audio-manager.js";
import { showOverlayMessage } from "../utils/ui-helpers.js";

let _ExplorationCache = null;
let _DerelictShipPOI = null;
let _DebrisFieldPOI = null;
let _MiniEventDefendCache = null;

export function registerSpawnManagerDependencies(deps) {
  if (deps.ExplorationCache) _ExplorationCache = deps.ExplorationCache;
  if (deps.DerelictShipPOI) _DerelictShipPOI = deps.DerelictShipPOI;
  if (deps.DebrisFieldPOI) _DebrisFieldPOI = deps.DebrisFieldPOI;
  if (deps.MiniEventDefendCache) _MiniEventDefendCache = deps.MiniEventDefendCache;
}

export function spawnDrone(type) {
  GameContext.drones.push(new Drone(type));
}

export function spawnMiniEventRelative() {
  if (!GameContext.player) return;
  const p = findSpawnPointRelative(GameContext, true, 2400, 4400);
  if (!_MiniEventDefendCache) return;
  GameContext.miniEvent = new _MiniEventDefendCache(p.x, p.y);
  showOverlayMessage("MINI-EVENT: DEFEND THE CACHE", "#ff0", 2200, 1);
  playSound("contract");
}

export function spawnExplorationCaches() {
  if (!GameContext.player) return;
  if (!_ExplorationCache) return;
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1200 + Math.random() * 2000;
    const cx = GameContext.player.pos.x + Math.cos(angle) * dist;
    const cy = GameContext.player.pos.y + Math.sin(angle) * dist;
    GameContext.caches.push(new _ExplorationCache(cx, cy));
  }
}

export function spawnSectorPOIs() {
  return; // POIs disabled
  if (!GameContext.player) return;
  if (!_DerelictShipPOI || !_DebrisFieldPOI) return;
  const constructors = [_DerelictShipPOI, _DebrisFieldPOI];

  const placed = [];
  for (let i = 0; i < constructors.length; i++) {
    let placedOne = false;
    for (let attempts = 0; attempts < 40; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1900 + Math.random() * 2600;
      const x = GameContext.player.pos.x + Math.cos(angle) * dist;
      const y = GameContext.player.pos.y + Math.sin(angle) * dist;
      let ok = true;
      for (const p of placed) {
        if (Math.hypot(x - p.x, y - p.y) < 1400) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      placed.push({ x, y });
      const C = constructors[i];
      const poi = new C(x, y);
      GameContext.pois.push(poi);
      placedOne = true;
      break;
    }
    if (!placedOne) {
    }
  }
}

export function spawnOneAsteroidRelative(initial = false) {
  if (!GameContext.player) return;
  let attempts = 0;
  while (attempts < 50) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const minDist = initial ? 500 : 2000;
    const maxDist = initial ? 3000 : 4000;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = GameContext.player.pos.x + Math.cos(angle) * dist;
    const y = GameContext.player.pos.y + Math.sin(angle) * dist;
    const r = 50 + Math.random() * 150;

    let safe = true;
    if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.fireWall) {
      const firewallY = GameContext.caveLevel.fireWall.y;
      if (y > firewallY) {
        safe = false;
      }
    }
    for (let b of GameContext.pinwheels) {
      if (Math.hypot(x - b.pos.x, y - b.pos.y) < b.shieldRadius + r + 200) safe = false;
    }

    if (safe) {
      const isIndestructible = Math.random() < 0.2;
      const sizeLevel = isIndestructible ? 1 : 3;
      const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
      const asteroid = new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible);
      GameContext.environmentAsteroids.push(asteroid);
      break;
    }
  }
}

export function spawnOneWarpAsteroidRelative(initial = false) {
  if (!GameContext.player || !GameContext.warpZone || !GameContext.warpZone.active) return false;
  let attempts = 0;
  while (attempts < 60) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const minDist = initial ? 600 : 2000;
    const maxDist = initial ? 5200 : 5600;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = GameContext.player.pos.x + Math.cos(angle) * dist;
    const y = GameContext.player.pos.y + Math.sin(angle) * dist;

    const dxC = x - GameContext.warpZone.pos.x;
    const dyC = y - GameContext.warpZone.pos.y;
    const dC = Math.hypot(dxC, dyC);
    const boundary = (GameContext.warpZone.boundaryRadius || 6200) - 220;
    if (dC > boundary) continue;

    const roll = Math.random();
    let r;
    if (roll < 0.14) r = 170 + Math.random() * 60;
    else if (roll < 0.46) r = 110 + Math.random() * 70;
    else r = 50 + Math.random() * 80;

    if (dC + r > (GameContext.warpZone.boundaryRadius || 6200) - 40) continue;

    if (
      Math.hypot(x - GameContext.player.pos.x, y - GameContext.player.pos.y) <
      r + GameContext.player.radius + 240
    )
      continue;

    const isIndestructible = Math.random() < 0.05;
    const sizeLevel = isIndestructible ? 1 : 3;
    const asteroidR = isIndestructible ? 40 + Math.random() * 50 : r;
    GameContext.environmentAsteroids.push(
      new EnvironmentAsteroid(x, y, asteroidR, sizeLevel, isIndestructible)
    );
    return true;
  }
  return false;
}

export function spawnNewPinwheelRelative(initial = false) {
  if (!GameContext.player) return;

  // Determine position
  let angle;
  if (initial) {
    angle = Math.random() * Math.PI * 2;
  } else {
    let baseAngle = GameContext.player.angle;
    if (GameContext.player.vel.mag() > 1)
      baseAngle = Math.atan2(GameContext.player.vel.y, GameContext.player.vel.x);
    angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2);
  }

  const dist = initial ? 1000 + Math.random() * 2000 : 3500 + Math.random() * 1500;
  let bx, by;
  if (GameContext.caveMode && GameContext.caveLevel && GameContext.caveLevel.active) {
    by = GameContext.player.pos.y - dist * (0.85 + Math.random() * 0.3);
    const bounds = GameContext.caveLevel.boundsAt(by);
    const margin = 420;
    const w = Math.max(200, bounds.right - bounds.left - margin * 2);
    bx = bounds.left + margin + Math.random() * w;
  } else {
    bx = GameContext.player.pos.x + Math.cos(angle) * dist;
    by = GameContext.player.pos.y + Math.sin(angle) * dist;
  }

  let b;
  if (GameContext.caveMode) {
    // Spawn cave pinwheels in cave mode - uses same difficulty tier system as regular pinwheels
    // Since cave level comes after level 1, difficulty tier should naturally be higher
    const caveTypes = ["cave1"];
    if (GameContext.difficultyTier >= 2) caveTypes.push("cave2"); // Heavy variant (matches 'rapid' unlock tier)
    if (GameContext.difficultyTier >= 3) caveTypes.push("cave3"); // Rapid variant (matches 'heavy' unlock tier)

    const type = caveTypes[Math.floor(Math.random() * caveTypes.length)];
    if (type === "cave1") b = new CavePinwheel1(bx, by);
    else if (type === "cave2") b = new CavePinwheel2(bx, by);
    else b = new CavePinwheel3(bx, by);

    GameContext.cavePinwheels.push(b);
  } else {
    // Original regular pinwheel spawning logic
    const availableTypes = ["standard"];
    if (GameContext.difficultyTier >= 2) availableTypes.push("rapid");
    if (GameContext.difficultyTier >= 3) availableTypes.push("heavy");

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    b = new Pinwheel(bx, by, type);
    GameContext.pinwheels.push(b);
  }

  // Spawn defender escort
  const da = Math.random() * Math.PI * 2;
  const defX = b.pos.x + Math.cos(da) * 150;
  const defY = b.pos.y + Math.sin(da) * 150;
  GameContext.enemies.push(new Enemy("defender", { x: defX, y: defY }, b));
}

export function spawnRadiationStormRelative() {
  return;
}
