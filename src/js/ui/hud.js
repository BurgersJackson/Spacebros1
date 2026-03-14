import { GameContext } from "../core/game-context.js";
import { ZOOM_LEVEL } from "../core/constants.js";

let canvas = null;
let pixiArrowsGraphics = null;
let pixiUiOverlayLayer = null;
let mouseScreen = null;
let getViewportSize = null;
let getInternalSize = null;

let pixiUiTextObjects = [];

export function registerHudDependencies(deps) {
  if (deps.canvas) canvas = deps.canvas;
  if (deps.pixiArrowsGraphics) pixiArrowsGraphics = deps.pixiArrowsGraphics;
  if (deps.pixiUiOverlayLayer) pixiUiOverlayLayer = deps.pixiUiOverlayLayer;
  if (deps.mouseScreen) mouseScreen = deps.mouseScreen;
  if (deps.getViewportSize) getViewportSize = deps.getViewportSize;
  if (deps.getInternalSize) getInternalSize = deps.getInternalSize;
}

function transformPolygon(vertices, x, y, scale, rotation) {
  const cos = Math.cos(rotation) * scale;
  const sin = Math.sin(rotation) * scale;
  const result = [];
  for (let i = 0; i < vertices.length; i += 2) {
    const vx = vertices[i];
    const vy = vertices[i + 1];
    result.push(x + (vx * cos - vy * sin), y + (vx * sin + vy * cos));
  }
  return result;
}

/** When arrow is near bottom of screen, place text above it so it stays readable. */
function getArrowTextPlacement(arrowY, screenH, offset = 25) {
  const nearBottom = arrowY > screenH - 80;
  return {
    y: nearBottom ? arrowY - offset : arrowY + offset,
    anchorY: nearBottom ? 1 : 0
  };
}

export function clearPixiUiText() {
  for (const text of pixiUiTextObjects) {
    if (text && text.parent) {
      text.parent.removeChild(text);
      text.destroy({ children: true });
    }
  }
  pixiUiTextObjects = [];
}

export function drawStationIndicator() {
  if (
    !GameContext.spaceStation ||
    !GameContext.player ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  const screenW = canvas.width;
  const screenH = canvas.height;

  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (
    GameContext.spaceStation.pos.x > camX &&
    GameContext.spaceStation.pos.x < camX + viewW &&
    GameContext.spaceStation.pos.y > camY &&
    GameContext.spaceStation.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = GameContext.spaceStation.pos.x - GameContext.player.pos.x;
  const dy = GameContext.spaceStation.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;

  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;

  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;

  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0x00ffff);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text = new PIXI.Text("STATION " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: 0x00ffff,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawDestroyerIndicator() {
  if (
    !GameContext.destroyer ||
    !GameContext.player ||
    GameContext.destroyer.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  const screenW = canvas.width;
  const screenH = canvas.height;

  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (
    GameContext.destroyer.pos.x > camX &&
    GameContext.destroyer.pos.x < camX + viewW &&
    GameContext.destroyer.pos.y > camY &&
    GameContext.destroyer.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = GameContext.destroyer.pos.x - GameContext.player.pos.x;
  const dy = GameContext.destroyer.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;

  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;

  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;

  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

  const isDestroyer2 = GameContext.destroyer.displayName === "DESTROYER II";
  const indicatorColor = isDestroyer2 ? 0xff0000 : 0xff8000;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(indicatorColor);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const label = isDestroyer2 ? "DESTROYER II " : "DESTROYER ";
  const text = new PIXI.Text(label + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: indicatorColor,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawWarpGateIndicator() {
  if (
    !GameContext.warpGate ||
    !GameContext.player ||
    GameContext.player.dead ||
    GameContext.warpGate.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;
  if (GameContext.warpGate.mode !== "entry") return;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (
    GameContext.warpGate.pos.x > camX &&
    GameContext.warpGate.pos.x < camX + viewW &&
    GameContext.warpGate.pos.y > camY &&
    GameContext.warpGate.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = GameContext.warpGate.pos.x - GameContext.player.pos.x;
  const dy = GameContext.warpGate.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;

  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0xff8800);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text1 = new PIXI.Text("WARP", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: 0xff8800,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const nearBottom = arrowY > screenH - 80;
  text1.anchor.set(0.5, 1);
  text1.position.set(arrowX, nearBottom ? arrowY - 43 : arrowY - 18);
  pixiUiOverlayLayer.addChild(text1);
  pixiUiTextObjects.push(text1);

  const text2 = new PIXI.Text((dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: 0xff8800,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement2 = getArrowTextPlacement(arrowY, screenH);
  text2.anchor.set(0.5, placement2.anchorY);
  text2.position.set(arrowX, placement2.y);
  pixiUiOverlayLayer.addChild(text2);
  pixiUiTextObjects.push(text2);
}

export function drawContractIndicator() {
  if (
    !GameContext.activeContract ||
    !GameContext.player ||
    GameContext.player.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;
  let tx = null;
  let ty = null;
  let isGateRun = false;
  if (
    GameContext.activeContract.type === "gate_run" &&
    GameContext.contractEntities.gates.length > 0
  ) {
    const idx = GameContext.activeContract.gateIndex || 0;
    const g = GameContext.contractEntities.gates[idx];
    if (g && !g.dead) {
      tx = g.pos.x;
      ty = g.pos.y;
      isGateRun = true;
    }
  } else if (GameContext.activeContract.target) {
    tx = GameContext.activeContract.target.x;
    ty = GameContext.activeContract.target.y;
  } else if (GameContext.contractEntities.beacons.length > 0) {
    tx = GameContext.contractEntities.beacons[0].pos.x;
    ty = GameContext.contractEntities.beacons[0].pos.y;
  }
  if (tx === null || ty === null) return;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

  const dx = tx - GameContext.player.pos.x;
  const dy = ty - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const tEdge = Math.min(txEdge, tyEdge);

  const arrowX = cx + vx * tEdge;
  const arrowY = cy + vy * tEdge;

  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  const arrowColor = isGateRun ? 0xff8800 : 0x00ff00;
  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(arrowColor);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const contractLabel = GameContext.activeContract.title || "CONTRACT";
  const text = new PIXI.Text(contractLabel + " " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: arrowColor,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawHealthPackIndicator() {
  if (
    !GameContext.powerups ||
    !GameContext.player ||
    GameContext.player.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  // Find nearest health pack
  let nearestHealthPack = null;
  let nearestDist = Infinity;

  for (const pickup of GameContext.powerups) {
    if (!pickup || pickup.dead) continue;
    // Check if it's a HealthPowerUp by checking if it has healAmount
    if (pickup.healAmount && typeof pickup.healAmount === "number") {
      const dist = Math.hypot(
        pickup.pos.x - GameContext.player.pos.x,
        pickup.pos.y - GameContext.player.pos.y
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestHealthPack = pickup;
      }
    }
  }

  if (!nearestHealthPack) return;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  // Don't draw if health pack is on-screen
  if (
    nearestHealthPack.pos.x > camX &&
    nearestHealthPack.pos.x < camX + viewW &&
    nearestHealthPack.pos.y > camY &&
    nearestHealthPack.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = nearestHealthPack.pos.x - GameContext.player.pos.x;
  const dy = nearestHealthPack.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;
  const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.15;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0x00ff00);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text = new PIXI.Text("HEALTH " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 12,
    fill: 0xff0000,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawMagnetPickupIndicator() {
  if (
    !GameContext.magnetPickups ||
    !GameContext.player ||
    GameContext.player.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  let nearestMagnet = null;
  let nearestDist = Infinity;

  for (const pickup of GameContext.magnetPickups) {
    if (!pickup || pickup.dead) continue;
    const dist = Math.hypot(
      pickup.pos.x - GameContext.player.pos.x,
      pickup.pos.y - GameContext.player.pos.y
    );
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestMagnet = pickup;
    }
  }

  if (!nearestMagnet) return;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (
    nearestMagnet.pos.x > camX &&
    nearestMagnet.pos.x < camX + viewW &&
    nearestMagnet.pos.y > camY &&
    nearestMagnet.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = nearestMagnet.pos.x - GameContext.player.pos.x;
  const dy = nearestMagnet.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;
  const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.15;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0x00ffff);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text = new PIXI.Text("MAGNET " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 12,
    fill: 0x00ffff,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawNukePickupIndicator() {
  if (
    !GameContext.nukePickups ||
    !GameContext.player ||
    GameContext.player.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  let nearestNuke = null;
  let nearestDist = Infinity;

  for (const pickup of GameContext.nukePickups) {
    if (!pickup || pickup.dead) continue;
    const dist = Math.hypot(
      pickup.pos.x - GameContext.player.pos.x,
      pickup.pos.y - GameContext.player.pos.y
    );
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestNuke = pickup;
    }
  }

  if (!nearestNuke) return;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (
    nearestNuke.pos.x > camX &&
    nearestNuke.pos.x < camX + viewW &&
    nearestNuke.pos.y > camY &&
    nearestNuke.pos.y < camY + viewH
  ) {
    return;
  }

  const dx = nearestNuke.pos.x - GameContext.player.pos.x;
  const dy = nearestNuke.pos.y - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const tx = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const ty = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const t = Math.min(tx, ty);

  const arrowX = cx + vx * t;
  const arrowY = cy + vy * t;
  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0xff4400);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text = new PIXI.Text("NUKE " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 12,
    fill: 0xff4400,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawMiniEventIndicator() {
  if (
    !GameContext.miniEvent ||
    GameContext.miniEvent.dead ||
    !GameContext.player ||
    GameContext.player.dead ||
    !pixiArrowsGraphics ||
    !canvas ||
    !pixiUiOverlayLayer
  )
    return;

  const tx = GameContext.miniEvent.pos.x;
  const ty = GameContext.miniEvent.pos.y;

  const screenW = canvas.width;
  const screenH = canvas.height;
  const z = GameContext.currentZoom || ZOOM_LEVEL;
  const camX = GameContext.player.pos.x - screenW / (2 * z);
  const camY = GameContext.player.pos.y - screenH / (2 * z);
  const viewW = screenW / z;
  const viewH = screenH / z;

  if (tx > camX && tx < camX + viewW && ty > camY && ty < camY + viewH) return;

  const dx = tx - GameContext.player.pos.x;
  const dy = ty - GameContext.player.pos.y;
  const angle = Math.atan2(dy, dx);

  const margin = 60;
  const cx = screenW / 2;
  const cy = screenH / 2;
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);

  const bx = cx - margin;
  const by = cy - margin;
  const txEdge = Math.abs(vx) > 0.001 ? bx / Math.abs(vx) : Infinity;
  const tyEdge = Math.abs(vy) > 0.001 ? by / Math.abs(vy) : Infinity;
  const tEdge = Math.min(txEdge, tyEdge);

  const arrowX = cx + vx * tEdge;
  const arrowY = cy + vy * tEdge;

  const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
  const blink = Math.sin(Date.now() * 0.012) > 0.2 ? 1 : 0.55;

  const arrowShape = [15, 0, -15, 12, -15, -12];
  const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

  pixiArrowsGraphics.lineStyle(2, 0x000000);
  pixiArrowsGraphics.beginFill(0xffff00, blink);
  pixiArrowsGraphics.drawPolygon(transformed);
  pixiArrowsGraphics.endFill();

  const dist = Math.hypot(dx, dy);
  const text = new PIXI.Text("EVENT " + (dist / 1000).toFixed(1) + "km", {
    fontFamily: "Courier New",
    fontWeight: "bold",
    fontSize: 14,
    fill: 0xffff00,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4
  });
  const placement = getArrowTextPlacement(arrowY, screenH);
  text.anchor.set(0.5, placement.anchorY);
  text.position.set(arrowX, placement.y);
  text.alpha = blink;
  pixiUiOverlayLayer.addChild(text);
  pixiUiTextObjects.push(text);
}

export function drawSlackerMouseLine() {
  if (
    !GameContext.player ||
    GameContext.player.shipType !== "slacker" ||
    GameContext.usingGamepad ||
    !pixiArrowsGraphics ||
    !mouseScreen
  )
    return;
  if (GameContext.gamePaused || !GameContext.gameActive) return;
  if (!getViewportSize || !getInternalSize || !canvas) return;

  const viewport = getViewportSize();
  const internal = getInternalSize();
  const z = GameContext.currentZoom || ZOOM_LEVEL;

  // Use vertical scrolling camera calculation if in that mode
  let camX, camY;
  if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
    // Lock camera to level center horizontally
    camX = GameContext.verticalScrollingZone.levelCenterX - viewport.width / (2 * z);

    // Camera is static (doesn't move) - background and asteroids move instead
    // Always use scrollProgress, never center on boss (matches game-loop.js)
    camY = GameContext.scrollProgress - viewport.height / (2 * z);
  } else {
    // Normal camera follows player
    camX = GameContext.player.pos.x - viewport.width / (2 * z);
    camY = GameContext.player.pos.y - viewport.height / (2 * z);
  }

  // Calculate ship position in viewport coordinates (1920x1080)
  const viewportShipX = (GameContext.player.pos.x - camX) * z;
  const viewportShipY = (GameContext.player.pos.y - camY) * z;

  // Scale to canvas internal resolution coordinates to match mouseScreen
  const renderScaleX = internal.width / viewport.width;
  const renderScaleY = internal.height / viewport.height;
  const screenShipX = viewportShipX * renderScaleX;
  const screenShipY = viewportShipY * renderScaleY;

  const screenMouseX = mouseScreen.x;
  const screenMouseY = mouseScreen.y;

  // In vertical scrolling mode the camera is static and the ship can drift off-screen-center.
  // Slacker movement uses a virtual joystick centered on screen center, so draw the aim line
  // from the ship using the same screen-center deflection vector (matches feel on other levels).
  let angle;
  let dist;
  if (GameContext.verticalScrollingMode && GameContext.verticalScrollingZone) {
    const centerX = internal.width / 2;
    const centerY = internal.height / 2;
    const dx = screenMouseX - centerX;
    const dy = screenMouseY - centerY;
    dist = Math.sqrt(dx * dx + dy * dy);
    angle = Math.atan2(dy, dx);
  } else {
    const dx = screenMouseX - screenShipX;
    const dy = screenMouseY - screenShipY;
    dist = Math.sqrt(dx * dx + dy * dy);
    angle = Math.atan2(dy, dx);
  }

  // Scale the start distance to canvas coordinates
  const startDistScreen = (GameContext.player.outerShieldRadius + 10) * z * renderScaleX;
  const screenStartX = screenShipX + Math.cos(angle) * startDistScreen;
  const screenStartY = screenShipY + Math.sin(angle) * startDistScreen;

  if (dist < startDistScreen) return;

  // Draw line to half the distance (clamped at max)
  const maxDist = Math.min(dist, internal.width * 0.3);
  const drawDist = startDistScreen + (maxDist - startDistScreen) * 0.5;
  const drawX = screenShipX + Math.cos(angle) * drawDist;
  const drawY = screenShipY + Math.sin(angle) * drawDist;

  pixiArrowsGraphics.lineStyle(2, 0xffffff, 0.5);
  pixiArrowsGraphics.moveTo(screenStartX, screenStartY);
  pixiArrowsGraphics.lineTo(drawX, drawY);
  pixiArrowsGraphics.endFill(); // Clear lineStyle to prevent ghosting
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return hh > 0
    ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateHealthUI(state = GameContext) {
  const player = state ? state.player : null;
  if (!player) return;
  const healthFill = document.getElementById("health-fill");
  if (!healthFill) return;
  const pct = (player.hp / player.maxHp) * 100;
  healthFill.style.width = `${Math.max(0, pct)}%`;
  if (player.hp <= 10) healthFill.style.backgroundColor = "#f00";
  else if (player.hp <= 20) healthFill.style.backgroundColor = "#ff0";
  else healthFill.style.backgroundColor = "#0f0";
  const ht = document.getElementById("health-text");
  if (ht) ht.innerText = `${Math.max(0, Math.floor(player.hp))} / ${player.maxHp}`;

  const vignette = document.getElementById("low-health-vignette");
  if (vignette) {
    if (player.hp <= 10 && player.hp > 0) {
      vignette.classList.add("active");
    } else {
      vignette.classList.remove("active");
    }
  }
  const warningVignette = document.getElementById("warning-vignette");
  if (warningVignette) {
    if (player.hp <= 20 && player.hp > 10) {
      warningVignette.classList.add("active");
    } else {
      warningVignette.classList.remove("active");
    }
  }
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateXpUI(state = GameContext) {
  const player = state ? state.player : null;
  if (!player) return;
  const xpFill = document.getElementById("xp-fill");
  if (!xpFill) return;
  const pct = (player.xp / player.nextLevelXp) * 100;
  xpFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  const levelEl = document.getElementById("level-display");
  if (levelEl) levelEl.innerText = player.level;
  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.innerText = state.score;

  // Hardcore mode indicator
  const hardcoreEl = document.getElementById("hardcore-indicator");
  if (hardcoreEl) {
    hardcoreEl.style.display = state.hardcoreMode ? "block" : "none";
  }
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateWarpUI(state = GameContext) {
  const player = state ? state.player : null;
  if (!player) return;
  const warpStatus = document.getElementById("warp-status");
  const warpFill = document.getElementById("warp-fill");
  if (!warpStatus || !warpFill) return;
  if (!player.canWarp) {
    warpStatus.style.display = "none";
  } else {
    warpStatus.style.display = "flex";
    const pct = ((player.maxWarpCooldown - player.warpCooldown) / player.maxWarpCooldown) * 100;
    warpFill.style.width = `${pct}%`;
    warpFill.style.backgroundColor = player.warpCooldown > 0 ? "#333" : "#0ff";
  }
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateTurboUI(state = GameContext) {
  const player = state ? state.player : null;
  const turboStatus = document.getElementById("turbo-status");
  const turboFill = document.getElementById("turbo-fill");
  if (!player || !turboStatus || !turboFill) return;
  if (!player.turboBoost || !player.turboBoost.unlocked) {
    turboStatus.style.display = "none";
    return;
  }
  turboStatus.style.display = "flex";

  const cooldownTotal = 600;
  const cd = Math.max(0, player.turboBoost.cooldownFrames || 0);
  const active = Math.max(0, player.turboBoost.activeFrames || 0);

  if (active > 0) {
    turboFill.style.width = "100%";
    turboFill.style.background = "linear-gradient(90deg, #ff0, #f80, #f00)";
  } else if (cd > 0) {
    const pct = (1 - cd / cooldownTotal) * 100;
    turboFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    turboFill.style.background = "linear-gradient(90deg, #f00, #ff0)";
  } else {
    turboFill.style.width = "100%";
    turboFill.style.background = "linear-gradient(90deg, #0ff, #0f0)";
  }
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateContractUI(state = GameContext) {
  const el = document.getElementById("contract-display");
  if (!el) return;

  // Show quest progress instead of contracts
  const fightsCompleted = state.arenaFightsCompleted || 0;
  const fightTarget = state.arenaFightTarget || 3;

  // Check if station exists (final boss)
  if (state.spaceStation && !state.spaceStation.dead) {
    el.innerText = "QUEST: DESTROY THE STATION";
    el.style.color = "#f80";
  } else if (state.stationSpawnAt) {
    // Waiting for station to spawn - show boss kills complete with countdown
    const remainMs = Math.max(0, state.stationSpawnAt - Date.now());
    const remainSec = Math.ceil(remainMs / 1000);
    el.innerText = `BOSS KILLS: ${fightTarget}/${fightTarget} - STATION IN ${remainSec}s`;
    el.style.color = "#f80";
  } else if (fightsCompleted >= fightTarget) {
    // All bosses killed and station destroyed, waiting for warp
    el.innerText = "QUEST: SECTOR CLEARED";
    el.style.color = "#0f0";
  } else {
    // Show boss kill progress
    el.innerText = `BOSS KILLS: ${fightsCompleted}/${fightTarget}`;
    el.style.color = "#0f0";
  }
}

/**
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateNuggetUI(state = GameContext) {
  const el = document.getElementById("nugget-count");
  if (el) el.innerText = (state.metaProfile.bank || 0) + state.spaceNuggets;
}

/**
 * Returns a short label for a boss entity (for bottom HP bar).
 * @param {Object} entity
 * @returns {string}
 */
function getBossBarLabel(entity) {
  if (!entity) return "BOSS";
  if (entity.displayName) return String(entity.displayName).toUpperCase();
  if (entity.isFlagship) return "FLAGSHIP";
  if (entity.isCruiser) return "CRUISER";
  const type = entity.type || (entity.constructor && entity.constructor.name) || "";
  const name = String(type);
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim()
    .toUpperCase()
    .slice(0, 14);
}

/**
 * Collects all active boss-like entities (with hp/maxHp) for the bottom HP bars.
 * Includes: main boss, dungeon/cave bosses in enemies, destroyer, space station.
 * @param {Object} [state=GameContext]
 * @returns {{ name: string, hp: number, maxHp: number }[]}
 */
export function getActiveBosses(state = GameContext) {
  const list = [];
  const gc = state || GameContext;

  if (gc.spaceStation && gc.spaceStation.maxHp > 0) {
    list.push({
      name:
        (gc.spaceStation.displayName && String(gc.spaceStation.displayName).toUpperCase()) ||
        "STATION",
      hp: gc.spaceStation.hp,
      maxHp: gc.spaceStation.maxHp
    });
  }

  if (gc.destroyer && !gc.destroyer.dead && gc.destroyer.maxHp > 0) {
    list.push({
      name: getBossBarLabel(gc.destroyer),
      hp: gc.destroyer.hp,
      maxHp: gc.destroyer.maxHp
    });
  }

  if (gc.bossActive && gc.boss && !gc.boss.dead && gc.boss.maxHp > 0) {
    list.push({
      name: getBossBarLabel(gc.boss),
      hp: gc.boss.hp,
      maxHp: gc.boss.maxHp
    });
  }

  if (gc.enemies && gc.enemies.length) {
    for (let i = 0; i < gc.enemies.length; i++) {
      const e = gc.enemies[i];
      if (e.dead || !e.maxHp) continue;
      if (e === gc.boss) continue; // already in list as main boss
      const isBoss = typeof e.drawBossHud === "function" || e.isDungeonBoss || e.isCruiser;
      if (!isBoss) continue;
      list.push({
        name: getBossBarLabel(e),
        hp: e.hp,
        maxHp: e.maxHp
      });
    }
  }

  return list;
}

/**
 * Updates the bottom-of-screen boss HP bars (player bar size, side-by-side).
 * Call each frame when doDraw. Hides container when no bosses.
 * @param {Object} [state=GameContext]
 * @returns {void}
 */
export function updateBossHealthBars(state = GameContext) {
  const container = document.getElementById("boss-health-bars-container");
  if (!container) return;
  const bosses = getActiveBosses(state);
  if (bosses.length === 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }
  container.style.display = "flex";
  while (container.children.length < bosses.length) {
    const wrap = document.createElement("div");
    wrap.className = "boss-hp-bar";
    const label = document.createElement("div");
    label.className = "boss-hp-bar-label";
    const border = document.createElement("div");
    border.className = "boss-hp-bar-border";
    const fill = document.createElement("div");
    fill.className = "boss-hp-bar-fill";
    border.appendChild(fill);
    wrap.appendChild(label);
    wrap.appendChild(border);
    container.appendChild(wrap);
  }
  while (container.children.length > bosses.length) {
    container.removeChild(container.lastChild);
  }
  for (let i = 0; i < bosses.length; i++) {
    const b = bosses[i];
    const wrap = container.children[i];
    const labelEl = wrap.querySelector(".boss-hp-bar-label");
    const fillEl = wrap.querySelector(".boss-hp-bar-fill");
    if (labelEl) labelEl.textContent = b.name;
    if (fillEl) {
      const pct = b.maxHp > 0 ? Math.max(0, (b.hp / b.maxHp) * 100) : 0;
      fillEl.style.width = `${pct}%`;
    }
  }
}

export function updateInputSpeedUI(state = GameContext) {
  const el = document.getElementById("input-speed");
  if (!el) return;

  let speed = 0;
  const player = state ? state.player : null;

  if (state.usingGamepad) {
    const x = state.gpState.move.x || 0;
    const y = state.gpState.move.y || 0;
    speed = Math.sqrt(x * x + y * y);
  } else if (
    player &&
    player.shipType === "slacker" &&
    state.mouseState &&
    state.mouseScreen &&
    getInternalSize
  ) {
    const internal = getInternalSize();
    const centerX = internal.width / 2;
    const centerY = internal.height / 2;

    const rawX = (state.mouseScreen.x - centerX) / centerX;
    const rawY = (state.mouseScreen.y - centerY) / centerY;

    const deadzone = 0.03;
    const mag = Math.sqrt(rawX * rawX + rawY * rawY);
    speed = mag <= deadzone ? 0 : 1;
  }

  el.innerText = speed.toFixed(2);
}
