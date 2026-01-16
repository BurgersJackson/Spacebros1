/**
 * Background Renderer - Stars, nebulas, cave grid
 */

import { GameContext } from '../core/game-context.js';
import { ENABLE_NEBULA, NEBULA_ALPHA, ZOOM_LEVEL } from '../core/constants.js';
import {
    pixiApp,
    pixiScreenRoot,
    pixiNebulaLayer,
    pixiStarLayer,
    pixiStarTilingLayer,
    pixiCaveGridLayer,
    pixiCaveGridSprite,
    pixiTextureWhite,
    pixiStarSpritePool
} from './pixi-setup.js';
import { allocPixiSprite } from '../pixi-utils.js';

let pixiStarTiles = null;
let pixiNebulaTiles = null;
let pixiNebulaPaletteIdx = null;

export function initStars(width, height) {
    GameContext.starfield = [];
    GameContext.nebulas = [];
    const count = Math.floor((width * height) / 3000);
    for (let i = 0; i < count; i++) {
        const baseAlpha = Math.random() * 0.4 + 0.05;
        const s = {
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() < 0.95 ? 1 : 2,
            alpha: baseAlpha * 0.5,
            parallax: 0.05 + Math.random() * 0.1
        };
        s.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        GameContext.starfield.push(s);
    }

    if (pixiScreenRoot && pixiApp && pixiApp.renderer) {
        try {
            if (pixiStarLayer) pixiStarLayer.visible = false;

            if (!Array.isArray(pixiStarTiles)) pixiStarTiles = [];
            if (!Array.isArray(pixiNebulaTiles)) pixiNebulaTiles = [];

            if (ENABLE_NEBULA && pixiNebulaLayer) {
                const hexToRgb = (hex) => {
                    const h = (hex >>> 0).toString(16).padStart(6, '0');
                    return {
                        r: parseInt(h.slice(0, 2), 16),
                        g: parseInt(h.slice(2, 4), 16),
                        b: parseInt(h.slice(4, 6), 16)
                    };
                };
                const makeNebulaTileTexture = (tileSize, blobCount, paletteHex) => {
                    const c = document.createElement('canvas');
                    c.width = tileSize;
                    c.height = tileSize;
                    const cctx = c.getContext('2d');
                    cctx.clearRect(0, 0, tileSize, tileSize);
                    cctx.globalCompositeOperation = 'lighter';
                    for (let i = 0; i < blobCount; i++) {
                        const col = hexToRgb(paletteHex[i % paletteHex.length]);
                        const cx = Math.random() * tileSize;
                        const cy = Math.random() * tileSize;
                        const r = tileSize * (0.20 + Math.random() * 0.55);
                        const a = 0.03 + Math.random() * 0.08;
                        for (const ox of [-tileSize, 0, tileSize]) {
                            for (const oy of [-tileSize, 0, tileSize]) {
                                const x = cx + ox;
                                const y = cy + oy;
                                const g = cctx.createRadialGradient(x, y, 0, x, y, r);
                                g.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${a.toFixed(3)})`);
                                g.addColorStop(0.45, `rgba(${col.r},${col.g},${col.b},${(a * 0.35).toFixed(3)})`);
                                g.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
                                cctx.fillStyle = g;
                                cctx.fillRect(0, 0, tileSize, tileSize);
                            }
                        }
                    }
                    cctx.globalCompositeOperation = 'source-over';
                    const vign = cctx.createRadialGradient(tileSize * 0.5, tileSize * 0.5, tileSize * 0.10, tileSize * 0.5, tileSize * 0.5, tileSize * 0.75);
                    vign.addColorStop(0, 'rgba(0,0,0,0)');
                    vign.addColorStop(1, 'rgba(0,0,0,0.18)');
                    cctx.fillStyle = vign;
                    cctx.fillRect(0, 0, tileSize, tileSize);

                    const tex = PIXI.Texture.from(c);
                    try {
                        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
                        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
                    } catch (e) { }
                    return tex;
                };

                const palettes = [
                    [0x0b1020, 0x2a1a5e, 0x4b2ccf, 0x0a5bd6, 0x00c2ff],
                    [0x0b1020, 0x2a2a6e, 0x1c4cff, 0x00d6d6, 0x00aaff],
                    [0x0b1020, 0x3b1366, 0x6a2cff, 0x1c7cff, 0x00b6ff]
                ];
                const idxBase = (typeof GameContext.sectorIndex === 'number' && isFinite(GameContext.sectorIndex)) ? (Math.abs(GameContext.sectorIndex) | 0) : 0;
                const paletteIdx = idxBase % palettes.length;
                const palette = palettes[paletteIdx];

                const nebulaLayers = [
                    { tileSize: 1024, blobs: 9, alphaMult: 1.00, parallax: 0.010 },
                    { tileSize: 768, blobs: 7, alphaMult: 0.66, parallax: 0.018 }
                ];

                const needsNebulaRebuild = (pixiNebulaPaletteIdx !== paletteIdx) || (pixiNebulaTiles.length === 0);
                if (needsNebulaRebuild) {
                    const oldNebs = pixiNebulaLayer.removeChildren();
                    for (const spr of oldNebs) {
                        try { spr.destroy({ children: true, texture: false, baseTexture: false }); } catch (e) { }
                    }
                    for (const t of pixiNebulaTiles) {
                        if (t && t.tex) {
                            try { t.tex.destroy(true); } catch (e) { }
                        }
                    }
                    pixiNebulaTiles = [];

                    for (const L of nebulaLayers) {
                        const tex = makeNebulaTileTexture(L.tileSize, L.blobs, palette);
                        const spr = new PIXI.TilingSprite(tex, (typeof width === 'number' && width > 0) ? width : 1, (typeof height === 'number' && height > 0) ? height : 1);
                        const mult = (typeof L.alphaMult === 'number' && isFinite(L.alphaMult)) ? L.alphaMult : 1;
                        spr.alpha = (typeof NEBULA_ALPHA === 'number' && isFinite(NEBULA_ALPHA)) ? (NEBULA_ALPHA * mult) : (0.12 * mult);
                        spr.tint = 0xffffff;
                        spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                        pixiNebulaLayer.addChild(spr);
                        pixiNebulaTiles.push({ spr, tex, parallax: L.parallax });
                    }
                    pixiNebulaPaletteIdx = paletteIdx;
                }
            }

            if (pixiStarTilingLayer) {
                const makeStarTileTexture = (tileSize, count, minSize, maxSize, minAlpha, maxAlpha) => {
                    const c = document.createElement('canvas');
                    c.width = tileSize;
                    c.height = tileSize;
                    const cctx = c.getContext('2d');
                    cctx.clearRect(0, 0, tileSize, tileSize);
                    for (let i = 0; i < count; i++) {
                        const x = Math.random() * tileSize;
                        const y = Math.random() * tileSize;
                        const sz = (minSize + Math.random() * (maxSize - minSize)) | 0;
                        const a = minAlpha + Math.random() * (maxAlpha - minAlpha);
                        cctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
                        cctx.fillRect(x, y, Math.max(1, sz), Math.max(1, sz));
                    }
                    const tex = PIXI.Texture.from(c);
                    try {
                        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
                    } catch (e) { }
                    return tex;
                };

                if (pixiStarTiles.length === 0) {
                    const tileSize = 512;
                    const layers = [
                        { count: 260, minSize: 1, maxSize: 2, minAlpha: 0.05, maxAlpha: 0.25, parallax: 0.06 },
                        { count: 70, minSize: 2, maxSize: 3, minAlpha: 0.08, maxAlpha: 0.40, parallax: 0.12 }
                    ];
                    for (const L of layers) {
                        const tex = makeStarTileTexture(tileSize, L.count, L.minSize, L.maxSize, L.minAlpha, L.maxAlpha);
                        const spr = new PIXI.TilingSprite(tex, width, height);
                        spr.alpha = 0.5;
                        spr.tint = 0xffffff;
                        spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                        pixiStarTilingLayer.addChild(spr);
                        pixiStarTiles.push({ spr, tex, parallax: L.parallax });
                    }
                }
            } else if (pixiStarLayer && pixiTextureWhite) {
                pixiStarLayer.visible = true;
                for (const s of GameContext.starfield) {
                    const spr = allocPixiSprite(pixiStarSpritePool, pixiStarLayer, pixiTextureWhite, s.size, 0);
                    spr.alpha = s.alpha;
                    spr.tint = 0xffffff;
                    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
                    s._pixiSprite = spr;
                }
            }
        } catch (e) { }
    }
}

export function updatePixiBackground(camX, camY, viewportWidth, viewportHeight) {
    // viewportWidth/Height are 1920x1080 (game viewport)
    // But sprites should be sized to internal resolution (handled by canvas-setup.js)
    // Tile positions use viewport size for correct parallax calculation
    if (pixiNebulaTiles && pixiNebulaTiles.length) {
        for (const t of pixiNebulaTiles) {
            const spr = t && (t.sprite || t.spr);
            if (!spr) continue;
            // Don't resize sprites here - they're sized to internal resolution in canvas-setup.js
            // Tile positions use viewport size for correct parallax
            const tx = -camX * (t.parallax || 0.012);
            const ty = -camY * (t.parallax || 0.012);
            spr.tilePosition.set(Math.round(tx), Math.round(ty));
        }
    }
    if (pixiStarTiles && pixiStarTiles.length) {
        for (const t of pixiStarTiles) {
            const spr = t && (t.sprite || t.spr);
            if (!spr) continue;
            // Don't resize sprites here - they're sized to internal resolution in canvas-setup.js
            // Tile positions use viewport size for correct parallax
            const tx = -camX * (t.parallax || 0.08);
            const ty = -camY * (t.parallax || 0.08);
            spr.tilePosition.set(Math.round(tx), Math.round(ty));
        }
        return;
    }
    if (!pixiStarLayer) return;
    for (const s of GameContext.starfield) {
        const spr = s && s._pixiSprite;
        if (!spr) continue;
        if (!spr.parent) pixiStarLayer.addChild(spr);
        // Use viewport size for positioning calculations
        let x = (s.x - camX * s.parallax) % viewportWidth;
        let y = (s.y - camY * s.parallax) % viewportHeight;
        if (x < 0) x += viewportWidth;
        if (y < 0) y += viewportHeight;
        spr.position.set(x, y);
    }
}

export function updatePixiCaveGrid(camX, camY, zoom, caveActive, viewportWidth, viewportHeight) {
    if (!pixiCaveGridLayer || !pixiCaveGridSprite) return;
    pixiCaveGridLayer.visible = !!caveActive;
    if (!caveActive) return;
    // Don't resize sprite here - it's sized to internal resolution in canvas-setup.js
    // Tile scale and position use viewport size for correct rendering
    const z = (typeof zoom === 'number' && isFinite(zoom) && zoom > 0) ? zoom : (GameContext.currentZoom || ZOOM_LEVEL);
    pixiCaveGridSprite.tileScale.set(z);
    pixiCaveGridSprite.tilePosition.set(Math.round(-camX * z), Math.round(-camY * z));
}

export function getStarTiles() {
    return pixiStarTiles;
}

export function getNebulaTiles() {
    return pixiNebulaTiles;
}

export function setStarTiles(tiles) {
    pixiStarTiles = tiles;
}

export function setNebulaTiles(tiles) {
    pixiNebulaTiles = tiles;
}
