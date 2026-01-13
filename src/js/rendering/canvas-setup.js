let canvas = null;
let ctx = null;
let uiCanvas = null;
let uiCtx = null;
let minimapCanvas = null;
let getPixiApp = null;
let getPixiCaveGridSprite = null;
let getStarTiles = null;
let getNebulaTiles = null;
let initStarsFn = null;
let setSize = null;
let getSize = null;

function setupCanvasResolution(internalW, internalH) {
    if (!canvas || !uiCanvas) return;

    canvas.width = internalW;
    canvas.height = internalH;

    uiCanvas.width = internalW;
    uiCanvas.height = internalH;

    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    uiCanvas.style.width = '100%';
    uiCanvas.style.height = '100%';
    uiCanvas.style.objectFit = 'contain';
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.top = '0';
    uiCanvas.style.left = '0';
    uiCanvas.style.pointerEvents = 'none';

    if (typeof setSize === 'function') {
        setSize(internalW, internalH);
    }

    if (ctx) ctx.imageSmoothingEnabled = false;
    if (uiCtx) uiCtx.imageSmoothingEnabled = false;

    const pixiApp = typeof getPixiApp === 'function' ? getPixiApp() : null;
    if (pixiApp && pixiApp.renderer) {
        pixiApp.renderer.resize(internalW, internalH);
    }

    const caveGridSprite = typeof getPixiCaveGridSprite === 'function' ? getPixiCaveGridSprite() : null;
    if (caveGridSprite) {
        caveGridSprite.width = internalW;
        caveGridSprite.height = internalH;
    }

    const starTiles = typeof getStarTiles === 'function' ? getStarTiles() : null;
    if (starTiles && starTiles.length) {
        for (const t of starTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalW;
            t.spr.height = internalH;
        }
    }
    const nebulaTiles = typeof getNebulaTiles === 'function' ? getNebulaTiles() : null;
    if (nebulaTiles && nebulaTiles.length) {
        for (const t of nebulaTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = internalW;
            t.spr.height = internalH;
        }
    }
}

function handleWindowResize() {
    if (typeof initStarsFn !== 'function') return;
    const size = typeof getSize === 'function' ? getSize() : null;
    if (!size) return;
    initStarsFn(size.width, size.height);
}

async function initializeCanvasResolution() {
    let internalW = 1920;
    let internalH = 1080;

    if (window.SpacebrosApp && window.SpacebrosApp.settings) {
        try {
            const settings = await window.SpacebrosApp.settings.get();
            const internalRes = settings.internalResolution || { width: 1920, height: 1080 };
            internalW = internalRes.width;
            internalH = internalRes.height;
        } catch (e) {
            console.warn("Failed to load internal resolution from settings:", e);
        }
    } else {
        internalW = window.innerWidth;
        internalH = window.innerHeight;
    }

    setupCanvasResolution(internalW, internalH);

    if (window.SpacebrosApp && window.SpacebrosApp.ipcRenderer) {
        window.SpacebrosApp.ipcRenderer.on('internal-resolution-changed', (res) => {
            setupCanvasResolution(res.width, res.height);
            handleWindowResize();
        });
    }
}

/**
 * @param {object} options
 * @param {function(): any} options.getPixiApp
 * @param {function(): any} options.getPixiCaveGridSprite
 * @param {function(): any} options.getStarTiles
 * @param {function(): any} options.getNebulaTiles
 * @param {function(number, number): void} options.initStars
 * @param {function(number, number): void} options.setSize
 * @param {function(): {width:number, height:number}} options.getSize
 * @returns {object}
 */
export function initCanvasSetup(options) {
    getPixiApp = options.getPixiApp;
    getPixiCaveGridSprite = options.getPixiCaveGridSprite;
    getStarTiles = options.getStarTiles;
    getNebulaTiles = options.getNebulaTiles;
    initStarsFn = options.initStars;
    setSize = options.setSize;
    getSize = options.getSize;

    canvas = document.getElementById('gameCanvas');
    ctx = (() => {
        try { return canvas.getContext('2d', { desynchronized: true, alpha: false }); }
        catch (e) { return canvas.getContext('2d'); }
    })();

    uiCanvas = document.getElementById('uiCanvas');
    uiCtx = (() => {
        try { return uiCanvas.getContext('2d', { alpha: true }); }
        catch (e) { return uiCanvas.getContext('2d'); }
    })();

    minimapCanvas = document.getElementById('minimap');

    if (ctx) ctx.imageSmoothingEnabled = false;
    if (uiCtx) uiCtx.imageSmoothingEnabled = false;

    window.addEventListener('resize', handleWindowResize);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCanvasResolution);
    } else {
        initializeCanvasResolution();
    }

    return {
        canvas,
        ctx,
        uiCanvas,
        uiCtx,
        minimapCanvas,
        setupCanvasResolution,
        initializeCanvasResolution,
        handleWindowResize
    };
}
