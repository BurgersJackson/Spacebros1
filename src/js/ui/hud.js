import { GameContext } from '../core/game-context.js';
import { ZOOM_LEVEL } from '../core/constants.js';

let canvas = null;
let pixiArrowsGraphics = null;
let pixiUiOverlayLayer = null;
let mouseScreen = null;
let getViewportSize = null;

let pixiUiTextObjects = [];

export function registerHudDependencies(deps) {
    if (deps.canvas) canvas = deps.canvas;
    if (deps.pixiArrowsGraphics) pixiArrowsGraphics = deps.pixiArrowsGraphics;
    if (deps.pixiUiOverlayLayer) pixiUiOverlayLayer = deps.pixiUiOverlayLayer;
    if (deps.mouseScreen) mouseScreen = deps.mouseScreen;
    if (deps.getViewportSize) getViewportSize = deps.getViewportSize;
}

function transformPolygon(vertices, x, y, scale, rotation) {
    const cos = Math.cos(rotation) * scale;
    const sin = Math.sin(rotation) * scale;
    const result = [];
    for (let i = 0; i < vertices.length; i += 2) {
        const vx = vertices[i];
        const vy = vertices[i + 1];
        result.push(
            x + (vx * cos - vy * sin),
            y + (vx * sin + vy * cos)
        );
    }
    return result;
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
    if (!GameContext.spaceStation || !GameContext.player || !pixiArrowsGraphics || !canvas || !pixiUiOverlayLayer) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (GameContext.spaceStation.pos.x > camX && GameContext.spaceStation.pos.x < camX + viewW &&
        GameContext.spaceStation.pos.y > camY && GameContext.spaceStation.pos.y < camY + viewH) {
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
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ffff,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

export function drawDestroyerIndicator() {
    if (!GameContext.destroyer || !GameContext.player || GameContext.destroyer.dead || !pixiArrowsGraphics || !canvas || !pixiUiOverlayLayer) return;

    const screenW = canvas.width;
    const screenH = canvas.height;

    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (GameContext.destroyer.pos.x > camX && GameContext.destroyer.pos.x < camX + viewW &&
        GameContext.destroyer.pos.y > camY && GameContext.destroyer.pos.y < camY + viewH) {
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
    const label = isDestroyer2 ? 'DESTROYER II ' : 'DESTROYER ';
    const text = new PIXI.Text(label + (dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: indicatorColor,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

export function drawWarpGateIndicator() {
    if (!GameContext.warpGate || !GameContext.player || GameContext.player.dead || GameContext.warpGate.dead || !pixiArrowsGraphics || !canvas || !pixiUiOverlayLayer) return;
    if (GameContext.warpGate.mode !== 'entry') return;

    const screenW = canvas.width;
    const screenH = canvas.height;
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - screenW / (2 * z);
    const camY = GameContext.player.pos.y - screenH / (2 * z);
    const viewW = screenW / z;
    const viewH = screenH / z;

    if (GameContext.warpGate.pos.x > camX && GameContext.warpGate.pos.x < camX + viewW &&
        GameContext.warpGate.pos.y > camY && GameContext.warpGate.pos.y < camY + viewH) {
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
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text1.anchor.set(0.5, 1);
    text1.position.set(arrowX, arrowY - 18);
    pixiUiOverlayLayer.addChild(text1);
    pixiUiTextObjects.push(text1);

    const text2 = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xff8800,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text2.anchor.set(0.5, 0);
    text2.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text2);
    pixiUiTextObjects.push(text2);
}

export function drawContractIndicator() {
    if (!GameContext.activeContract || !GameContext.player || GameContext.player.dead || !pixiArrowsGraphics || !canvas || !pixiUiOverlayLayer) return;
    let tx = null;
    let ty = null;
    if (GameContext.activeContract.type === 'gate_run' && GameContext.contractEntities.gates.length > 0) {
        const idx = GameContext.activeContract.gateIndex || 0;
        const g = GameContext.contractEntities.gates[idx];
        if (g && !g.dead) { tx = g.pos.x; ty = g.pos.y; }
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

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0x00ff00);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0x00ff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

export function drawMiniEventIndicator() {
    if (!GameContext.miniEvent || GameContext.miniEvent.dead || !GameContext.player || GameContext.player.dead || !pixiArrowsGraphics || !canvas || !pixiUiOverlayLayer) return;

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
    const blink = (Math.sin(Date.now() * 0.012) > 0.2) ? 1 : 0.55;

    const arrowShape = [15, 0, -15, 12, -15, -12];
    const transformed = transformPolygon(arrowShape, arrowX, arrowY, pulse, angle);

    pixiArrowsGraphics.lineStyle(2, 0x000000);
    pixiArrowsGraphics.beginFill(0xffff00, blink);
    pixiArrowsGraphics.drawPolygon(transformed);
    pixiArrowsGraphics.endFill();

    const dist = Math.hypot(dx, dy);
    const text = new PIXI.Text((dist / 1000).toFixed(1) + 'km', {
        fontFamily: 'Courier New',
        fontWeight: 'bold',
        fontSize: 14,
        fill: 0xffff00,
        align: 'center',
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4
    });
    text.anchor.set(0.5, 0);
    text.position.set(arrowX, arrowY + 25);
    text.alpha = blink;
    pixiUiOverlayLayer.addChild(text);
    pixiUiTextObjects.push(text);
}

export function drawSlackerMouseLine() {
    if (!GameContext.player || GameContext.player.shipType !== 'slacker' || GameContext.usingGamepad || !pixiArrowsGraphics || !mouseScreen) return;
    if (GameContext.gamePaused || !GameContext.gameActive) return;
    if (!getViewportSize) return;

    const viewport = getViewportSize();
    const z = GameContext.currentZoom || ZOOM_LEVEL;
    const camX = GameContext.player.pos.x - viewport.width / (2 * z);
    const camY = GameContext.player.pos.y - viewport.height / (2 * z);

    const screenShipX = (GameContext.player.pos.x - camX) * z;
    const screenShipY = (GameContext.player.pos.y - camY) * z;

    const screenMouseX = mouseScreen.x;
    const screenMouseY = mouseScreen.y;

    const angle = Math.atan2(screenMouseY - screenShipY, screenMouseX - screenShipX);

    const startDistScreen = (GameContext.player.outerShieldRadius + 10) * z;
    const screenStartX = screenShipX + Math.cos(angle) * startDistScreen;
    const screenStartY = screenShipY + Math.sin(angle) * startDistScreen;

    const dx = screenMouseX - screenShipX;
    const dy = screenMouseY - screenShipY;
    const distSq = dx * dx + dy * dy;
    if (distSq < startDistScreen * startDistScreen) return;

    pixiArrowsGraphics.lineStyle(2, 0xffffff, 0.5);
    pixiArrowsGraphics.moveTo(screenStartX, screenStartY);
    pixiArrowsGraphics.lineTo(screenMouseX, screenMouseY);
}
