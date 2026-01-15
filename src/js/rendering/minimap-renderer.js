/**
 * Minimap Renderer
 */

import { GameContext } from '../core/game-context.js';

const MINIMAP_SIZE = 200;
const MINIMAP_RADIUS = 100;
const MINIMAP_OFFSET = 20;

function drawMinimapArrow(gfx, x, y, angle, length, width) {
    const tipX = x + Math.cos(angle) * length;
    const tipY = y + Math.sin(angle) * length;
    const leftX = x + Math.cos(angle + 2.5) * width;
    const leftY = y + Math.sin(angle + 2.5) * width;
    const rightX = x + Math.cos(angle - 2.5) * width;
    const rightY = y + Math.sin(angle - 2.5) * width;
    gfx.drawPolygon([tipX, tipY, leftX, leftY, rightX, rightY]);
}

function colorToHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return 0xffffff;
    if (colorStr.startsWith('#')) {
        return parseInt(colorStr.slice(1), 16);
    }
    const colors = {
        'cyan': 0x00ffff, 'magenta': 0xff00ff, 'yellow': 0xffff00,
        'red': 0xff0000, 'green': 0x00ff00, 'blue': 0x0000ff,
        'white': 0xffffff, 'black': 0x000000, 'orange': 0xff8800
    };
    return colors[colorStr.toLowerCase()] || 0xffffff;
}

export function drawMinimap(pixiMinimapGraphics, canvas) {
    if (!pixiMinimapGraphics) return;
    GameContext.minimapFrame++;
    if (GameContext.minimapFrame % 2 === 1) return;

    pixiMinimapGraphics.clear();

    const screenW = canvas.width;
    const screenH = canvas.height;
    const minimapX = screenW - MINIMAP_SIZE - MINIMAP_OFFSET;
    const minimapY = screenH - MINIMAP_SIZE - MINIMAP_OFFSET;
    const centerX = minimapX + MINIMAP_RADIUS;
    const centerY = minimapY + MINIMAP_RADIUS;

    pixiMinimapGraphics.lineStyle(2, 0x00ffff);
    pixiMinimapGraphics.beginFill(0x000011);
    pixiMinimapGraphics.drawCircle(centerX, centerY, MINIMAP_RADIUS);
    pixiMinimapGraphics.endFill();

    const warpActive = !!(GameContext.warpZone && GameContext.warpZone.active);
    const radarRange = warpActive ? ((GameContext.warpZone.boundaryRadius || 6200) + 300) : 4000;
    const scale = MINIMAP_RADIUS / radarRange;
    const refX = warpActive ? GameContext.warpZone.pos.x : (GameContext.player ? GameContext.player.pos.x : 0);
    const refY = warpActive ? GameContext.warpZone.pos.y : (GameContext.player ? GameContext.player.pos.y : 0);

    const inBounds = (x, y) => (x * x + y * y) <= (MINIMAP_RADIUS * MINIMAP_RADIUS);

    if (GameContext.player && !GameContext.player.dead) {
        const px = warpActive ? ((GameContext.player.pos.x - refX) * scale) : 0;
        const py = warpActive ? ((GameContext.player.pos.y - refY) * scale) : 0;
        pixiMinimapGraphics.beginFill(0x00ff00);
        pixiMinimapGraphics.drawCircle(centerX + px, centerY + py, 3);
        pixiMinimapGraphics.endFill();
    }

    if (warpActive && GameContext.warpZone) {
        const segs = (typeof GameContext.warpZone.allSegments === 'function') ? GameContext.warpZone.allSegments() : [];
        pixiMinimapGraphics.lineStyle(1, 0x00ffff, 0.65);
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const x0 = (s.x0 - refX) * scale;
            const y0 = (s.y0 - refY) * scale;
            const x1 = (s.x1 - refX) * scale;
            const y1 = (s.y1 - refY) * scale;
            if (Math.abs(x0) > 120 && Math.abs(x1) > 120 && Math.abs(y0) > 120 && Math.abs(y1) > 120) continue;
            pixiMinimapGraphics.moveTo(centerX + x0, centerY + y0);
            pixiMinimapGraphics.lineTo(centerX + x1, centerY + y1);
        }

        if (GameContext.warpZone && GameContext.warpZone.turrets && GameContext.warpZone.turrets.length > 0) {
            pixiMinimapGraphics.beginFill(0x00ffff);
            for (let i = 0; i < GameContext.warpZone.turrets.length; i++) {
                const t = GameContext.warpZone.turrets[i];
                if (!t || t.dead) continue;
                const dx = (t.pos.x - refX) * scale;
                const dy = (t.pos.y - refY) * scale;
                if (inBounds(dx, dy)) {
                    pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
                }
            }
            pixiMinimapGraphics.endFill();
        }

        if (GameContext.warpGate && !GameContext.warpGate.dead) {
            const dx = (GameContext.warpGate.pos.x - refX) * scale;
            const dy = (GameContext.warpGate.pos.y - refY) * scale;
            pixiMinimapGraphics.lineStyle(2, 0xff8800, 0.9);
            pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 7);
        }
    }

    pixiMinimapGraphics.lineStyle(1, 0x005500);
    GameContext.environmentAsteroids.forEach(a => {
        if (GameContext.player) {
            const dx = (a.pos.x - refX) * scale;
            const dy = (a.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, Math.max(1, a.radius * scale));
            }
        }
    });

    pixiMinimapGraphics.beginFill(0xff0000);
    GameContext.enemies.forEach(e => {
        if (GameContext.player) {
            const dx = (e.pos.x - refX) * scale;
            const dy = (e.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    pixiMinimapGraphics.beginFill(0xff00ff);
    GameContext.pinwheels.forEach(b => {
        if (GameContext.player) {
            const dx = (b.pos.x - refX) * scale;
            const dy = (b.pos.y - refY) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 5);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    if (GameContext.bossActive && GameContext.boss && !GameContext.boss.dead && GameContext.player) {
        const dx = (GameContext.boss.pos.x - refX) * scale;
        const dy = (GameContext.boss.pos.y - refY) * scale;
        pixiMinimapGraphics.beginFill(0xff0000);
        pixiMinimapGraphics.drawCircle(centerX + dx, centerY + dy, 8);
        pixiMinimapGraphics.endFill();
    }

    if (!warpActive && GameContext.radiationStorm && !GameContext.radiationStorm.dead && GameContext.player) {
        const dx = GameContext.radiationStorm.pos.x - GameContext.player.pos.x;
        const dy = GameContext.radiationStorm.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        pixiMinimapGraphics.lineStyle(2, 0xffdc00, 0.7);
        if (dist * scale > 95) {
            const px = Math.cos(angle) * 90;
            const py = Math.sin(angle) * 90;
            pixiMinimapGraphics.beginFill(0xffff00);
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            pixiMinimapGraphics.endFill();
        } else {
            pixiMinimapGraphics.drawCircle(centerX + dx * scale, centerY + dy * scale, Math.max(4, GameContext.radiationStorm.radius * scale));
        }
    }

    pixiMinimapGraphics.beginFill(0xffff00);
    GameContext.coins.forEach(c => {
        if (GameContext.player) {
            const dx = (c.pos.x - GameContext.player.pos.x) * scale;
            const dy = (c.pos.y - GameContext.player.pos.y) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx, centerY + dy, 1, 1);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    pixiMinimapGraphics.beginFill(0x00ff00);
    GameContext.powerups.forEach(p => {
        if (GameContext.player) {
            const dx = (p.pos.x - GameContext.player.pos.x) * scale;
            const dy = (p.pos.y - GameContext.player.pos.y) * scale;
            if (inBounds(dx, dy)) {
                pixiMinimapGraphics.drawRect(centerX + dx - 1, centerY + dy - 1, 3, 3);
            }
        }
    });
    pixiMinimapGraphics.endFill();

    if (GameContext.player && GameContext.pois && GameContext.pois.length > 0) {
        for (const p of GameContext.pois) {
            if (!p || p.dead || p.claimed) continue;
            const dx = p.pos.x - GameContext.player.pos.x;
            const dy = p.pos.y - GameContext.player.pos.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const inRange = (dist * scale <= 95);
            const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
            const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);
            const color = colorToHex(p.color || '#0ff');
            pixiMinimapGraphics.beginFill(color);
            if (inRange) {
                pixiMinimapGraphics.drawCircle(centerX + px, centerY + py, 4);
            } else {
                drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            }
            pixiMinimapGraphics.endFill();
        }
    }

    if (GameContext.spaceStation && GameContext.player) {
        const dx = GameContext.spaceStation.pos.x - GameContext.player.pos.x;
        const dy = GameContext.spaceStation.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        pixiMinimapGraphics.beginFill(0xffffff);
        if (dist * scale > 95) {
            const px = Math.cos(angle) * 90;
            const py = Math.sin(angle) * 90;
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        } else {
            const mx = dx * scale;
            const my = dy * scale;
            pixiMinimapGraphics.drawCircle(centerX + mx, centerY + my, 6);
        }
        pixiMinimapGraphics.endFill();
    }

    if (!warpActive && GameContext.player && GameContext.destroyer && !GameContext.destroyer.dead) {
        const dx = GameContext.destroyer.pos.x - GameContext.player.pos.x;
        const dy = GameContext.destroyer.pos.y - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const color = GameContext.destroyer.displayName === "DESTROYER II" ? 0xffff00 : 0xff8800;

        const inRange = (dist * scale <= 95);
        const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
        const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

        pixiMinimapGraphics.beginFill(color);
        drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        pixiMinimapGraphics.endFill();
    }

    if (!warpActive && GameContext.player && GameContext.activeContract) {
        let tx = null, ty = null;
        if (GameContext.activeContract.type === 'gate_run' && GameContext.contractEntities.gates.length > 0) {
            const idx = GameContext.activeContract.gateIndex || 0;
            const g = GameContext.contractEntities.gates[idx];
            if (g && !g.dead) { tx = g.pos.x; ty = g.pos.y; }
        } else if (GameContext.activeContract.target) {
            tx = GameContext.activeContract.target.x; ty = GameContext.activeContract.target.y;
        } else if (GameContext.contractEntities.beacons.length > 0) {
            tx = GameContext.contractEntities.beacons[0].pos.x; ty = GameContext.contractEntities.beacons[0].pos.y;
        }

        if (tx !== null && ty !== null) {
            const dx = tx - GameContext.player.pos.x;
            const dy = ty - GameContext.player.pos.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const inRange = (dist * scale <= 95);
            const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
            const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

            pixiMinimapGraphics.beginFill(0x00ff00);
            drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
            pixiMinimapGraphics.endFill();
        }
    }

    if (!warpActive && GameContext.player && GameContext.miniEvent && !GameContext.miniEvent.dead) {
        let tx = GameContext.miniEvent.pos.x, ty = GameContext.miniEvent.pos.y;
        const dx = tx - GameContext.player.pos.x;
        const dy = ty - GameContext.player.pos.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const inRange = (dist * scale <= 95);
        const px = inRange ? (dx * scale) : (Math.cos(angle) * 90);
        const py = inRange ? (dy * scale) : (Math.sin(angle) * 90);

        pixiMinimapGraphics.beginFill(0xffff00);
        drawMinimapArrow(pixiMinimapGraphics, centerX + px, centerY + py, angle, 10, 8);
        pixiMinimapGraphics.endFill();
    }
}

export function initMinimapCanvas() {
    const minimapCanvas = document.getElementById('minimap');
    if (!minimapCanvas) return null;
    const minimapCtx = (() => {
        try { return minimapCanvas.getContext('2d', { desynchronized: true, alpha: false }); }
        catch (e) { return minimapCanvas.getContext('2d'); }
    })();
    if (minimapCtx) minimapCtx.imageSmoothingEnabled = false;
    return minimapCanvas;
}
