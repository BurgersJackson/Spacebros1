import {
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureRotOffsets,
    pixiTextureBaseScales,
    pixiTextureScaleToRadius
} from './texture-loader.js';
import { setPixiContext } from './pixi-context.js';
import { setStarTiles, setNebulaTiles } from './background-renderer.js';
import { NEBULA_ALPHA } from '../core/constants.js';
import {
    applyGunboatTextures,
    applyNuggetTexture,
    applyCruiserTexture,
    applyAsteroidTextures,
    applyPlayerHullTexture,
    applyBase1Texture,
    applyBase2Texture,
    applyBase3Texture,
    applyStationTexture,
    getStationHullTexture
} from './texture-manager.js';

/**
 * @param {object} options
 * @param {boolean} options.usePixiOverlay
 * @param {function(): {width:number, height:number}} options.getViewportSize
 * @returns {object}
 */
export function initPixiOverlay(options) {
    const usePixiOverlay = options && options.usePixiOverlay;
    const getViewportSize = options && options.getViewportSize;
    const empty = {
        pixiApp: null,
        pixiWorldRoot: null,
        pixiScreenRoot: null,
        pixiNebulaLayer: null,
        pixiStarLayer: null,
        pixiStarTilingLayer: null,
        pixiCaveGridLayer: null,
        pixiCaveGridSprite: null,
        pixiUiOverlayLayer: null,
        pixiMinimapGraphics: null,
        pixiArrowsGraphics: null,
        pixiAsteroidLayer: null,
        pixiPickupLayer: null,
        pixiPlayerLayer: null,
        pixiBaseLayer: null,
        pixiEnemyLayer: null,
        pixiBossLayer: null,
        pixiVectorLayer: null,
        pixiBulletLayer: null,
        pixiParticleLayer: null,
        pixiTextureWhite: null,
        pixiParticleGlowTexture: null,
        pixiParticleSmokeTexture: null,
        pixiParticleWarpTexture: null,
        pixiBulletTextures: { glow: null, laser: null, square: null, missile: null }
    };

    if (!usePixiOverlay || !window.PIXI) return empty;

    console.log('[DEBUG] Pixi Block Entered');
    try { PIXI.settings.ROUND_PIXELS = true; } catch (e) { }
    const pixiApp = new PIXI.Application({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true
    });
    try { pixiApp.renderer.roundPixels = true; } catch (e) { }
    try { pixiApp.stop(); } catch (e) { }

    pixiApp.view.style.position = 'absolute';
    pixiApp.view.style.top = '0';
    pixiApp.view.style.left = '0';
    pixiApp.view.style.pointerEvents = 'none';
    pixiApp.view.style.zIndex = '15';
    document.body.appendChild(pixiApp.view);
    const pixiTextureWhite = PIXI.Texture.WHITE;
    try { pixiApp.stage.eventMode = 'none'; } catch (e) { }

    const pixiScreenRoot = new PIXI.Container();
    const pixiWorldRoot = new PIXI.Container();
    pixiApp.stage.addChild(pixiScreenRoot);
    pixiApp.stage.addChild(pixiWorldRoot);

    const pixiUiOverlayLayer = new PIXI.Container();
    const pixiMinimapGraphics = new PIXI.Graphics();
    const pixiArrowsGraphics = new PIXI.Graphics();
    pixiUiOverlayLayer.addChild(pixiArrowsGraphics);
    pixiUiOverlayLayer.addChild(pixiMinimapGraphics);
    pixiApp.stage.addChild(pixiUiOverlayLayer);

    const pixiBulletTextures = { glow: null, laser: null, square: null, missile: null };

    const makeGlowTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 16);
        g.beginFill(0xffffff, 0.4);
        g.drawCircle(0, 0, 8);
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 4);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeLaserTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-24, -8, 48, 16, 8);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-18, -5, 36, 10, 5);
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-14, -2, 28, 4, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const makeSquareTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 0.15);
        g.drawRoundedRect(-16, -16, 32, 32, 4);
        g.beginFill(0xffffff, 0.5);
        g.drawRoundedRect(-10, -10, 20, 20, 3);
        g.beginFill(0xffffff, 1);
        g.drawRoundedRect(-4, -4, 8, 8, 2);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.glow = makeGlowTexture();
    pixiBulletTextures.laser = makeLaserTexture();
    pixiBulletTextures.square = makeSquareTexture();

    const makeMissileTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffaa00, 0.3);
        g.drawCircle(0, 0, 12);
        g.beginFill(0xffaa00, 0.5);
        g.drawCircle(0, 0, 6);
        g.beginFill(0xff8800, 1);
        g.moveTo(6, 0);
        g.lineTo(-4, 4);
        g.lineTo(-4, -4);
        g.closePath();
        g.beginFill(0xff6400, 0.8);
        g.drawRect(-6, -2, 4, 4);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    pixiBulletTextures.missile = makeMissileTexture();

    const makeParticleGlowTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, 2);
        g.beginFill(0xffffff, 0.45);
        g.drawCircle(0, 0, 5);
        g.beginFill(0xffffff, 0.15);
        g.drawCircle(0, 0, 10);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const pixiParticleGlowTexture = makeParticleGlowTexture();

    const makeSmokeTexture = () => {
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0xffffff, 1);
        g.drawRect(-16, -16, 32, 32);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const pixiParticleSmokeTexture = makeSmokeTexture();

    const makeWarpTexture = () => {
        const g = new PIXI.Graphics();
        g.beginFill(0xffffff, 1);
        g.drawRect(0, -2, 32, 4);
        const tex = pixiApp.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
    };
    const pixiParticleWarpTexture = makeWarpTexture();

    const pixiNebulaLayer = new PIXI.Container();
    const pixiCaveGridLayer = new PIXI.Container();
    const pixiStarLayer = new PIXI.ParticleContainer(8000, { position: true, tint: true, scale: true, alpha: true });
    const pixiStarTilingLayer = new PIXI.Container();
    pixiScreenRoot.addChild(pixiNebulaLayer);
    pixiScreenRoot.addChild(pixiCaveGridLayer);
    pixiScreenRoot.addChild(pixiStarTilingLayer);
    pixiScreenRoot.addChild(pixiStarLayer);

    const pixiAsteroidLayer = new PIXI.Container();
    const pixiPickupLayer = new PIXI.ParticleContainer(6000, { position: true, rotation: true, tint: true, scale: true, alpha: true });
    const pixiPlayerLayer = new PIXI.Container();
    const pixiBaseLayer = new PIXI.Container();
    const pixiEnemyLayer = new PIXI.Container();
    const pixiBossLayer = new PIXI.Container();
    const pixiVectorLayer = new PIXI.Container();
    const pixiBulletLayer = new PIXI.Container();
    const pixiParticleLayer = new PIXI.ParticleContainer(20000, { position: true, tint: true, scale: true, alpha: true });

    pixiWorldRoot.addChild(pixiAsteroidLayer);
    pixiWorldRoot.addChild(pixiPickupLayer);
    pixiWorldRoot.addChild(pixiPlayerLayer);
    pixiWorldRoot.addChild(pixiBaseLayer);
    pixiWorldRoot.addChild(pixiEnemyLayer);
    pixiWorldRoot.addChild(pixiBossLayer);
    pixiWorldRoot.addChild(pixiVectorLayer);
    pixiWorldRoot.addChild(pixiBulletLayer);
    pixiWorldRoot.addChild(pixiParticleLayer);

    const makeCaveGridTexture = () => {
        const grid = 420;
        const minor = 210;
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0x00ffff, 0.05);
        g.moveTo(0, 0); g.lineTo(0, grid);
        g.moveTo(minor, 0); g.lineTo(minor, grid);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, minor); g.lineTo(grid, minor);
        g.lineStyle(3, 0x00ffff, 0.10);
        g.moveTo(0, 0); g.lineTo(grid, 0);
        g.moveTo(0, 0); g.lineTo(0, grid);
        const tex = pixiApp.renderer.generateTexture(g);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    let pixiCaveGridTexture = null;
    let pixiCaveGridSprite = null;
    try {
        pixiCaveGridTexture = makeCaveGridTexture();
        const size = typeof getViewportSize === 'function' ? getViewportSize() : null;
        const w = size && typeof size.width === 'number' && size.width > 0 ? size.width : 1;
        const h = size && typeof size.height === 'number' && size.height > 0 ? size.height : 1;
        pixiCaveGridSprite = new PIXI.TilingSprite(pixiCaveGridTexture, w, h);
        pixiCaveGridSprite.alpha = 1;
        pixiCaveGridLayer.addChild(pixiCaveGridSprite);
        pixiCaveGridLayer.visible = false;
    } catch (e) { }

    setPixiContext({
        pixiApp,
        pixiWorldRoot,
        pixiScreenRoot,
        pixiAsteroidLayer,
        pixiPickupLayer,
        pixiPlayerLayer,
        pixiBaseLayer,
        pixiEnemyLayer,
        pixiBossLayer,
        pixiVectorLayer,
        pixiBulletLayer,
        pixiParticleLayer,
        pixiNebulaLayer,
        pixiStarLayer,
        pixiStarTilingLayer,
        pixiCaveGridLayer,
        pixiCaveGridSprite,
        pixiTextureWhite,
        pixiParticleSmokeTexture,
        pixiParticleWarpTexture
    });

    const STAR_TILE_SIZE = 512;
    const NEBULA_TILE_SIZE = 512;

    const makeStarfieldTexture = (starCount, minSize, maxSize, minAlpha, maxAlpha) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * STAR_TILE_SIZE;
            const y = Math.random() * STAR_TILE_SIZE;
            const size = minSize + Math.random() * (maxSize - minSize);
            const alpha = minAlpha + Math.random() * (maxAlpha - minAlpha);
            const colorVar = Math.random();
            let color = 0xffffff;
            if (colorVar < 0.15) color = 0xaaddff;
            else if (colorVar < 0.25) color = 0xffffaa;
            else if (colorVar < 0.3) color = 0xffccaa;
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    g.beginFill(color, alpha);
                    g.drawCircle(x + ox * STAR_TILE_SIZE, y + oy * STAR_TILE_SIZE, size);
                    g.endFill();
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, STAR_TILE_SIZE, STAR_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    const makeNebulaTexture = (blobCount, palette) => {
        const g = new PIXI.Graphics();
        for (let i = 0; i < blobCount; i++) {
            const x = Math.random() * NEBULA_TILE_SIZE;
            const y = Math.random() * NEBULA_TILE_SIZE;
            const baseSize = 60 + Math.random() * 140;
            const color = palette[Math.floor(Math.random() * palette.length)];
            const baseAlpha = 0.001 + Math.random() * 0.003;
            const layers = 8;
            for (let layer = layers; layer >= 1; layer--) {
                const ratio = layer / layers;
                const size = baseSize * ratio;
                const layerAlpha = baseAlpha * (1 - ratio * 0.7);
                for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                        g.beginFill(color, layerAlpha);
                        g.drawCircle(x + ox * NEBULA_TILE_SIZE, y + oy * NEBULA_TILE_SIZE, size);
                        g.endFill();
                    }
                }
            }
        }
        const tex = pixiApp.renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, NEBULA_TILE_SIZE, NEBULA_TILE_SIZE) });
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        } catch (e) { }
        try { g.destroy(true); } catch (e) { }
        return tex;
    };

    const nebulaPalettes = [
        [0x4400aa, 0x220066, 0x6622aa, 0x3311aa],
        [0x004488, 0x002266, 0x006688, 0x003366],
        [0x440022, 0x660033, 0x880044, 0x330022],
        [0x224400, 0x336600, 0x448800, 0x113300]
    ];
    const pixiNebulaPaletteIdx = Math.floor(Math.random() * nebulaPalettes.length);

    try {
        const starTexFar = makeStarfieldTexture(80, 0.5, 1.2, 0.1, 0.25);
        const starTexMid = makeStarfieldTexture(40, 0.8, 1.8, 0.2, 0.35);
        const starTexNear = makeStarfieldTexture(15, 1.2, 2.5, 0.3, 0.5);

        const size = typeof getViewportSize === 'function' ? getViewportSize() : null;
        const w = size && typeof size.width === 'number' ? size.width : (window.innerWidth || 1920);
        const h = size && typeof size.height === 'number' ? size.height : (window.innerHeight || 1080);

        const starTiles = [
            { sprite: new PIXI.TilingSprite(starTexFar, w, h), parallax: 0.02 },
            { sprite: new PIXI.TilingSprite(starTexMid, w, h), parallax: 0.05 },
            { sprite: new PIXI.TilingSprite(starTexNear, w, h), parallax: 0.10 }
        ];
        setStarTiles(starTiles);
        starTiles.forEach(layer => {
            pixiStarTilingLayer.addChild(layer.sprite);
        });

        // Nebula tiles are created by background-renderer.js in initStars()
        // Don't create them here to avoid conflicts
    } catch (e) {
        console.warn('Backdrop initialization failed:', e);
    }

    const genTexture = (graphics) => {
        const b = graphics.getLocalBounds();
        const tex = pixiApp.renderer.generateTexture(graphics);
        try {
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        } catch (e) { }
        const anchor = (b && b.width > 0 && b.height > 0)
            ? { x: (-b.x) / b.width, y: (-b.y) / b.height }
            : { x: 0.5, y: 0.5 };
        try { graphics.destroy(true); } catch (e) { }
        return { tex, anchor };
    };

    const makeGlowStrokedPolyTexture = (points, fillHex, strokeHex, lineWidth = 2) => {
        const g = new PIXI.Graphics();
        g.beginFill(fillHex, 1);
        g.drawPolygon(points);
        g.endFill();
        g.lineStyle(lineWidth * 5, strokeHex, 0.12);
        g.drawPolygon(points);
        g.lineStyle(lineWidth * 3, strokeHex, 0.25);
        g.drawPolygon(points);
        g.lineStyle(lineWidth, strokeHex, 1);
        g.drawPolygon(points);
        return genTexture(g);
    };

    {
        const makeCoin = (fillHex) => {
            const g = new PIXI.Graphics();
            const pts = [0, -8, 8, 0, 0, 8, -8, 0];
            g.lineStyle(24, fillHex, 0.15);
            g.drawPolygon(pts);
            g.lineStyle(12, fillHex, 0.4);
            g.drawPolygon(pts);
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(fillHex, 1);
            g.drawPolygon(pts);
            g.endFill();
            return genTexture(g).tex;
        };
        pixiTextures.coin1 = makeCoin(0xffff00);
        pixiTextures.coin5 = makeCoin(0xffff00);
        pixiTextures.coin10 = makeCoin(0xffff00);

        const makeHealth = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x00ff00, 0.12);
            g.drawCircle(0, 0, 20);
            g.endFill();
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x00ff00, 1);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            g.endFill();
            g.lineStyle(10, 0x00ff00, 0.10);
            g.drawRect(-4, -10, 8, 20);
            g.drawRect(-10, -4, 20, 8);
            return genTexture(g).tex;
        };
        pixiTextures.health = makeHealth();

        const makeNugget = () => {
            const c = document.createElement('canvas');
            c.width = 96;
            c.height = 96;
            const cctx = c.getContext('2d');
            cctx.translate(48, 48);
            cctx.rotate(Math.PI / 6);
            cctx.lineJoin = 'round';
            cctx.lineWidth = 6;
            const grad = cctx.createLinearGradient(-24, -24, 24, 24);
            grad.addColorStop(0, '#ff0');
            grad.addColorStop(0.5, '#f90');
            grad.addColorStop(1, '#0ff');
            cctx.fillStyle = grad;
            cctx.strokeStyle = '#fff';
            cctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const x = Math.cos(a) * 22;
                const y = Math.sin(a) * 22;
                if (i === 0) cctx.moveTo(x, y);
                else cctx.lineTo(x, y);
            }
            cctx.closePath();
            cctx.fill();
            cctx.stroke();
            return PIXI.Texture.from(c);
        };
        pixiTextures.nugget = makeNugget();
        applyNuggetTexture();
    }

    {
        const roamerPts = [18, 0, -12, 12, -6, 0, -12, -12];
        const elitePts = [25, 0, -15, 18, -5, 0, -15, -18];
        const hunterPts = [30, 0, -15, 12, -10, 0, -15, -12];

        const makeEnemy = (points, fillHex, strokeHex) => {
            const { tex, anchor } = makeGlowStrokedPolyTexture(points, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const r = makeEnemy(roamerPts, 0x441111, 0xff5555);
        pixiTextures.enemy_roamer = r.tex;
        pixiTextureAnchors.enemy_roamer = r.anchor;

        const er = makeEnemy(elitePts, 0x441111, 0xff5555);
        pixiTextures.enemy_elite_roamer = er.tex;
        pixiTextureAnchors.enemy_elite_roamer = er.anchor;

        const h = makeEnemy(hunterPts, 0x442200, 0xffaa00);
        pixiTextures.enemy_hunter = h.tex;
        pixiTextureAnchors.enemy_hunter = h.anchor;

        const d = makeEnemy(roamerPts, 0x661111, 0xff8888);
        pixiTextures.enemy_defender = d.tex;
        pixiTextureAnchors.enemy_defender = d.anchor;

        const makeGunboat = (fillHex, strokeHex) => {
            const s = 1.4;
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            const { tex, anchor } = makeGlowStrokedPolyTexture(pts, fillHex, strokeHex, 2);
            return { tex, anchor };
        };

        const gb1 = makeGunboat(0x221111, 0xff5555);
        pixiTextures.enemy_gunboat_1 = gb1.tex;
        pixiTextureAnchors.enemy_gunboat_1 = gb1.anchor;

        const gb2 = makeGunboat(0x332211, 0xffbb00);
        pixiTextures.enemy_gunboat_2 = gb2.tex;
        pixiTextureAnchors.enemy_gunboat_2 = gb2.anchor;

        applyGunboatTextures();

        const makeCruiser = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const L = 28 * s;
            const H = 7.5 * s;
            const nose = 6 * s;
            const tail = 7 * s;
            const podL = 10 * s;
            const podH = 3.2 * s;
            const podX = 16.5 * s;
            const podY = 10.0 * s;
            const hull = [
                L, 0,
                L - nose, H,
                -L + tail, H,
                -L, 0,
                -L + tail, -H,
                L - nose, -H
            ];
            g.beginFill(0x2b2f33, 1);
            g.drawPolygon(hull);
            g.endFill();
            g.beginFill(0x1b1f23, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);
            g.endFill();
            g.lineStyle(1, 0x8aa0b3, 0.35);
            g.moveTo(-L + tail + 8 * s, 0);
            g.lineTo(L - nose - 10 * s, 0);
            g.moveTo(-L + tail + 8 * s, H * 0.55);
            g.lineTo(L - nose - 14 * s, H * 0.55);
            g.moveTo(-L + tail + 8 * s, -H * 0.55);
            g.lineTo(L - nose - 14 * s, -H * 0.55);
            g.lineStyle(10, 0xc7ced6, 0.10);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawPolygon(hull);
            g.lineStyle(2, 0xc7ced6, 1);
            g.drawRect(podX, podY - podH, podL, podH * 2);
            g.drawRect(podX, -podY - podH, podL, podH * 2);
            g.beginFill(0x00ffff, 1);
            g.drawCircle(-L + 5 * s, 0, 2.8 * s);
            g.endFill();
            g.beginFill(0x00ffff, 0.20);
            g.drawCircle(-L + 5 * s, 0, 10 * s);
            g.endFill();
            return genTexture(g);
        };

        const cr = makeCruiser();
        pixiTextures.enemy_cruiser = cr.tex;
        pixiTextureAnchors.enemy_cruiser = cr.anchor;

        applyCruiserTexture();
    }

    {
        applyAsteroidTextures();
        if (!pixiTextures.asteroids || pixiTextures.asteroids.length === 0) {
            if (!pixiTextures.asteroids) pixiTextures.asteroids = [];
        }
        if (!pixiTextures.asteroids || pixiTextures.asteroids.length === 0) {
            const makeAsteroidVariant = () => {
                const g = new PIXI.Graphics();
                const points = [];
                const baseR = 320;
                const count = 12 + Math.floor(Math.random() * 7);
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2;
                    const r = baseR * (0.75 + Math.random() * 0.35);
                    points.push(Math.cos(a) * r, Math.sin(a) * r);
                }
                g.lineStyle(7, 0xffffff, 0.90);
                g.drawPolygon(points);
                const { tex, anchor } = genTexture(g);
                try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF; } catch (e) { }
                return { tex, anchor };
            };
            pixiTextures.asteroids = [];
            for (let i = 0; i < 12; i++) {
                const v = makeAsteroidVariant();
                pixiTextures.asteroids.push(v.tex);
                pixiTextureAnchors[`asteroid_${i}`] = v.anchor;
            }
        }
    }

    {
        const makePlayerHull = () => {
            const s = 1.4;
            const g = new PIXI.Graphics();
            const pts = [
                25 * s, 0,
                -10 * s, 10 * s,
                -20 * s, 20 * s,
                -20 * s, 5 * s,
                -25 * s, 5 * s,
                -25 * s, -5 * s,
                -20 * s, -5 * s,
                -20 * s, -20 * s,
                -10 * s, -10 * s
            ];
            g.beginFill(0x112222, 1);
            g.drawPolygon(pts);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawPolygon(pts);
            g.beginFill(0x001111, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.drawEllipse(-5 * s, 0, 8 * s, 4 * s);
            g.lineStyle(2, 0x00ffff, 1);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, 8 * s);
            g.moveTo(10 * s, 0);
            g.lineTo(-15 * s, -8 * s);
            return genTexture(g);
        };
        const ph = makePlayerHull();
        pixiTextures.player_hull = ph.tex;
        pixiTextureAnchors.player_hull = ph.anchor;

        applyPlayerHullTexture();

        const makePlayerTurretBase = () => {
            const g = new PIXI.Graphics();
            g.lineStyle(2, 0xffffff, 1);
            g.beginFill(0x003333, 1);
            g.drawCircle(0, 0, 8);
            g.endFill();
            g.lineStyle(2, 0x00ffff, 1);
            g.moveTo(-5, 4);
            g.lineTo(5, 0);
            g.lineTo(-5, -4);
            return genTexture(g);
        };
        const pt = makePlayerTurretBase();
        pixiTextures.player_turret_base = pt.tex;
        pixiTextureAnchors.player_turret_base = pt.anchor;

        const makePlayerGun = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0xffffff, 1);
            g.drawRect(-2, -2, 4, 4);
            g.endFill();
            g.beginFill(0x00ffff, 1);
            g.drawRect(-2, -6, 4, 10);
            g.endFill();
            return genTexture(g);
        };
        const pg = makePlayerGun();
        pixiTextures.player_gun = pg.tex;
        pixiTextureAnchors.player_gun = pg.anchor;

        const makePlayerShield = () => {
            const g = new PIXI.Graphics();
            g.lineStyle(2, 0x00ffff, 0.5);
            g.drawCircle(0, 0, 40);
            g.lineStyle(8, 0x00ffff, 0.08);
            g.drawCircle(0, 0, 40);
            return genTexture(g);
        };
        const ps = makePlayerShield();
        pixiTextures.player_shield = ps.tex;
        pixiTextureAnchors.player_shield = ps.anchor;

        const makePlayerOuterShield = () => {
            const g = new PIXI.Graphics();
            g.lineStyle(2, 0x00ffff, 0.5);
            g.drawCircle(0, 0, 44);
            g.lineStyle(8, 0x00ffff, 0.08);
            g.drawCircle(0, 0, 44);
            return genTexture(g);
        };
        const pos = makePlayerOuterShield();
        pixiTextures.player_outer_shield = pos.tex;
        pixiTextureAnchors.player_outer_shield = pos.anchor;

        const makePlayerShieldSegment = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x00ffff, 1);
            g.drawCircle(0, 0, 4);
            g.endFill();
            g.beginFill(0x00ffff, 0.2);
            g.drawCircle(0, 0, 9);
            g.endFill();
            return genTexture(g);
        };
        const pss = makePlayerShieldSegment();
        pixiTextures.player_shield_segment = pss.tex;
        pixiTextureAnchors.player_shield_segment = pss.anchor;

        const makePlayerOuterShieldSegment = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x00ffff, 1);
            g.drawCircle(0, 0, 4);
            g.endFill();
            g.beginFill(0x00ffff, 0.2);
            g.drawCircle(0, 0, 9);
            g.endFill();
            return genTexture(g);
        };
        const poss = makePlayerOuterShieldSegment();
        pixiTextures.player_outer_shield_segment = poss.tex;
        pixiTextureAnchors.player_outer_shield_segment = poss.anchor;

        const makePlayerWarpCore = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x00ffff, 1);
            g.drawCircle(0, 0, 4);
            g.endFill();
            g.beginFill(0x00ffff, 0.2);
            g.drawCircle(0, 0, 9);
            g.endFill();
            return genTexture(g);
        };
        const pwc = makePlayerWarpCore();
        pixiTextures.player_warp_core = pwc.tex;
        pixiTextureAnchors.player_warp_core = pwc.anchor;

        const makePlayerTurboFlame = () => {
            const g = new PIXI.Graphics();
            // Long flame shape - teardrop pointing left (extends behind ship)
            // Bright inner core
            g.beginFill(0xffaa00, 1);
            g.moveTo(0, 0);
            g.bezierCurveTo(-15, -8, -50, -5, -80, 0);
            g.bezierCurveTo(-50, 5, -15, 8, 0, 0);
            g.endFill();
            // Outer glow
            g.beginFill(0xff8800, 0.6);
            g.moveTo(0, 0);
            g.bezierCurveTo(-20, -12, -60, -8, -90, 0);
            g.bezierCurveTo(-60, 8, -20, 12, 0, 0);
            g.endFill();
            // Faint outermost glow
            g.beginFill(0xff6600, 0.3);
            g.moveTo(0, 0);
            g.bezierCurveTo(-25, -16, -70, -10, -100, 0);
            g.bezierCurveTo(-70, 10, -25, 16, 0, 0);
            g.endFill();
            return genTexture(g);
        };
        const ptf = makePlayerTurboFlame();
        pixiTextures.player_turbo_flame = ptf.tex;
        pixiTextureAnchors.player_turbo_flame = ptf.anchor;

        const makeBase = (strokeHex, fillHex) => {
            const g = new PIXI.Graphics();
            const r = 70;
            g.beginFill(fillHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            g.endFill();
            g.lineStyle(6, strokeHex, 0.10);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(3, strokeHex, 0.85);
            g.drawCircle(0, 0, r * 0.78);
            g.lineStyle(2, strokeHex, 1);
            g.drawPolygon([
                r, 0,
                r * 0.35, r * 0.65,
                -r * 0.35, r * 0.65,
                -r, 0,
                -r * 0.35, -r * 0.65,
                r * 0.35, -r * 0.65
            ]);
            return genTexture(g);
        };
        const bs = makeBase(0x00ffff, 0x111111);
        pixiTextures.base_standard = bs.tex;
        pixiTextureAnchors.base_standard = bs.anchor;
        const bh = makeBase(0xffaa00, 0x111111);
        pixiTextures.base_heavy = bh.tex;
        pixiTextureAnchors.base_heavy = bh.anchor;
        const br = makeBase(0x0088ff, 0x111111);
        pixiTextures.base_rapid = br.tex;
        pixiTextureAnchors.base_rapid = br.anchor;

        applyBase1Texture();
        applyBase2Texture();
        applyBase3Texture();
        applyStationTexture();

        if (!getStationHullTexture()) {
            const makeStationHull = () => {
                const g = new PIXI.Graphics();
                const R = 340;
                g.lineStyle(20, 0x333333, 1);
                g.drawCircle(0, 0, R - 30);
                g.beginFill(0x111111, 1);
                g.drawCircle(0, 0, R * 0.75);
                g.endFill();
                g.lineStyle(5, 0x00ffff, 1);
                g.drawCircle(0, 0, R * 0.75);
                g.lineStyle(2, 0x00ffff, 0.30);
                g.drawCircle(0, 0, R * 0.5);
                for (let i = 0; i < 8; i++) {
                    const a = i * (Math.PI / 4);
                    g.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
                    g.lineTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75);
                }
                g.beginFill(0x000000, 1);
                g.drawCircle(0, 0, R * 0.25);
                g.endFill();
                g.lineStyle(3, 0xff00ff, 1);
                g.drawCircle(0, 0, R * 0.25);
                return genTexture(g);
            };
            const sh = makeStationHull();
            pixiTextures.station_hull = sh.tex;
            pixiTextureAnchors.station_hull = sh.anchor;
        }

        const makeStationCore = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0xff00ff, 1);
            g.drawCircle(0, 0, 60);
            g.endFill();
            g.beginFill(0xff00ff, 0.25);
            g.drawCircle(0, 0, 120);
            g.endFill();
            return genTexture(g);
        };
        const sc = makeStationCore();
        pixiTextures.station_core = sc.tex;
        pixiTextureAnchors.station_core = sc.anchor;

        const makeStationTurret = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x333333, 1);
            g.drawCircle(0, 0, 22);
            g.endFill();
            g.lineStyle(2, 0x888888, 1);
            g.drawCircle(0, 0, 22);
            g.beginFill(0xff4444, 1);
            g.drawRect(10, -12, 40, 8);
            g.drawRect(10, 4, 40, 8);
            g.endFill();
            g.beginFill(0xaaaaaa, 1);
            g.drawCircle(0, 0, 10);
            g.endFill();
            return genTexture(g);
        };
        const st = makeStationTurret();
        pixiTextures.station_turret = st.tex;
        pixiTextureAnchors.station_turret = st.anchor;
    }

    return {
        pixiApp,
        pixiWorldRoot,
        pixiScreenRoot,
        pixiNebulaLayer,
        pixiStarLayer,
        pixiStarTilingLayer,
        pixiCaveGridLayer,
        pixiCaveGridSprite,
        pixiUiOverlayLayer,
        pixiMinimapGraphics,
        pixiArrowsGraphics,
        pixiAsteroidLayer,
        pixiPickupLayer,
        pixiPlayerLayer,
        pixiBaseLayer,
        pixiEnemyLayer,
        pixiBossLayer,
        pixiVectorLayer,
        pixiBulletLayer,
        pixiParticleLayer,
        pixiTextureWhite,
        pixiParticleGlowTexture,
        pixiParticleSmokeTexture,
        pixiParticleWarpTexture,
        pixiBulletTextures
    };
}
