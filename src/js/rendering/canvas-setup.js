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
let isElectronFullscreen = false;

function setupCanvasResolution(internalW, internalH) {
    if (!canvas || !uiCanvas) return;

    // Always render at internal resolution for consistent game logic
    // Check both browser Fullscreen API and Electron fullscreen state
    const isBrowserFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement ||
                            document.mozFullScreenElement || document.msFullscreenElement);
    
    // Use cached Electron fullscreen state (updated via IPC events)
    const isFullscreen = isBrowserFullscreen || isElectronFullscreen;

    // Set canvas pixel dimensions to internal resolution (game renders at this)
    canvas.width = internalW;
    canvas.height = internalH;

    uiCanvas.width = internalW;
    uiCanvas.height = internalH;

    // In fullscreen: stretch canvas to fill entire screen via CSS
    // In windowed: use internal resolution size (or window size if smaller)
    if (isFullscreen) {
        // In fullscreen, ensure canvas container and canvas fill entire viewport
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.style.setProperty('width', '100vw', 'important');
            canvasContainer.style.setProperty('height', '100vh', 'important');
            canvasContainer.style.setProperty('position', 'fixed', 'important');
            canvasContainer.style.setProperty('top', '0', 'important');
            canvasContainer.style.setProperty('left', '0', 'important');
            canvasContainer.style.setProperty('margin', '0', 'important');
            canvasContainer.style.setProperty('padding', '0', 'important');
            canvasContainer.style.setProperty('overflow', 'hidden', 'important');
        }
        
        // Stretch canvas to fill fullscreen viewport - use pixel values for exact sizing
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // CRITICAL: Canvas internal resolution (canvas.width/height) is 1280x720
        // CSS width/height set to 2195x1235 will make the browser stretch the canvas
        // This is the standard way to stretch a canvas - browser handles it automatically
        canvas.style.removeProperty('transform');
        canvas.style.setProperty('width', `${vw}px`, 'important');
        canvas.style.setProperty('height', `${vh}px`, 'important');
        canvas.style.setProperty('display', 'block', 'important');
        canvas.style.setProperty('box-sizing', 'border-box', 'important');
        
        uiCanvas.style.removeProperty('transform');
        uiCanvas.style.setProperty('width', `${vw}px`, 'important');
        uiCanvas.style.setProperty('height', `${vh}px`, 'important');
        uiCanvas.style.setProperty('display', 'block', 'important');
        uiCanvas.style.setProperty('box-sizing', 'border-box', 'important');
        
        // Force a reflow to ensure styles are applied
        void canvas.offsetWidth;
        void uiCanvas.offsetWidth;
    } else {
        // Windowed mode: ensure container is properly sized and centered
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.style.setProperty('width', '100%', 'important');
            canvasContainer.style.setProperty('height', '100%', 'important');
            canvasContainer.style.setProperty('display', 'flex', 'important');
            canvasContainer.style.setProperty('align-items', 'center', 'important');
            canvasContainer.style.setProperty('justify-content', 'center', 'important');
        }
        // Windowed mode: use internal resolution or window size, whichever is smaller
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const scaleW = windowW / internalW;
        const scaleH = windowH / internalH;
        const scale = Math.min(scaleW, scaleH, 1); // Don't scale up in windowed mode
        
        const displayW = internalW * scale;
        const displayH = internalH * scale;
        
        canvas.style.setProperty('width', `${displayW}px`, 'important');
        canvas.style.setProperty('height', `${displayH}px`, 'important');
        uiCanvas.style.setProperty('width', `${displayW}px`, 'important');
        uiCanvas.style.setProperty('height', `${displayH}px`, 'important');
    }

    // Position canvas absolutely within container, or fixed to viewport in fullscreen
    if (isFullscreen) {
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
    } else {
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
    }
    canvas.style.imageRendering = 'pixelated';
    canvas.style.setProperty('max-width', 'none', 'important');
    canvas.style.setProperty('max-height', 'none', 'important');
    canvas.style.setProperty('min-width', '0', 'important');
    canvas.style.setProperty('min-height', '0', 'important');
    canvas.style.setProperty('object-fit', 'fill', 'important');
    canvas.style.setProperty('aspect-ratio', 'unset', 'important');

    if (isFullscreen) {
        uiCanvas.style.position = 'fixed';
        uiCanvas.style.top = '0';
        uiCanvas.style.left = '0';
    } else {
        uiCanvas.style.position = 'absolute';
        uiCanvas.style.top = '0';
        uiCanvas.style.left = '0';
    }
    uiCanvas.style.pointerEvents = 'none';
    uiCanvas.style.imageRendering = 'pixelated';
    uiCanvas.style.setProperty('max-width', 'none', 'important');
    uiCanvas.style.setProperty('max-height', 'none', 'important');
    uiCanvas.style.setProperty('min-width', '0', 'important');
    uiCanvas.style.setProperty('min-height', '0', 'important');
    uiCanvas.style.setProperty('object-fit', 'fill', 'important');
    uiCanvas.style.setProperty('aspect-ratio', 'unset', 'important');

    // Store internal resolution for game logic
    if (typeof setSize === 'function') {
        setSize(internalW, internalH);
    }

    if (ctx) ctx.imageSmoothingEnabled = false;
    if (uiCtx) uiCtx.imageSmoothingEnabled = false;

    // Update PixiJS renderer - in fullscreen, resize to window size for proper stretching
    // In windowed, use internal resolution
    const pixiApp = typeof getPixiApp === 'function' ? getPixiApp() : null;
    if (pixiApp && pixiApp.renderer) {
        if (isFullscreen) {
            pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
        } else {
            pixiApp.renderer.resize(internalW, internalH);
        }
    }

    // Background sprites should be sized to viewport (1920x1080), not internal resolution
    // They will be scaled to internal resolution by pixiScreenRoot.scale in the game loop
    // This ensures the game world viewport is always 1920x1080 regardless of internal resolution
    const viewportW = 1920;  // Fixed viewport size
    const viewportH = 1080;

    const caveGridSprite = typeof getPixiCaveGridSprite === 'function' ? getPixiCaveGridSprite() : null;
    if (caveGridSprite) {
        caveGridSprite.width = viewportW;
        caveGridSprite.height = viewportH;
    }

    const starTiles = typeof getStarTiles === 'function' ? getStarTiles() : null;
    if (starTiles && starTiles.length) {
        for (const t of starTiles) {
            if (!t || !t.spr) continue;
            t.spr.width = viewportW;
            t.spr.height = viewportH;
        }
    }
    const nebulaTiles = typeof getNebulaTiles === 'function' ? getNebulaTiles() : null;
    if (nebulaTiles && nebulaTiles.length) {
        for (const t of nebulaTiles) {
            // Support both 'sprite' (from pixi-init.js) and 'spr' (from background-renderer.js)
            const spr = t && (t.sprite || t.spr);
            if (!spr) continue;
            spr.width = viewportW;
            spr.height = viewportH;
        }
    }
}

function handleWindowResize() {
    if (typeof initStarsFn !== 'function') return;
    const size = typeof getSize === 'function' ? getSize() : null;
    if (!size) return;

    // Re-setup canvas with new dimensions when window resizes (e.g., entering fullscreen)
    // Get current internal resolution from settings
    let internalW = size.width;
    let internalH = size.height;

    // Re-apply canvas resolution setup to update to new window dimensions
    // Use requestAnimationFrame to ensure window has finished resizing
    requestAnimationFrame(() => {
        setupCanvasResolution(internalW, internalH);
        // Update stars to fill the display area
        const displayW = (isElectronFullscreen || document.fullscreenElement) ? window.innerWidth : internalW;
        const displayH = (isElectronFullscreen || document.fullscreenElement) ? window.innerHeight : internalH;
        initStarsFn(displayW, displayH);
    });
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
            // Check initial fullscreen state from settings
            isElectronFullscreen = !!settings.fullscreen;
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

    // Store internal resolution for fullscreen changes
    let storedInternalW = 1920;
    let storedInternalH = 1080;

    // Handle fullscreen changes to stretch canvas to screen
    const handleFullscreenChange = async () => {
        const size = typeof getSize === 'function' ? getSize() : null;
        if (size) {
            storedInternalW = size.width;
            storedInternalH = size.height;
        }
        // Re-setup canvas to detect fullscreen state and stretch accordingly
        setupCanvasResolution(storedInternalW, storedInternalH);
        handleWindowResize();
    };

    // Listen for Electron fullscreen changes
    if (window.SpacebrosApp && window.SpacebrosApp.ipcRenderer) {
        window.SpacebrosApp.ipcRenderer.on('electron-fullscreen-changed', (isFullscreen) => {
            isElectronFullscreen = isFullscreen;
            // Small delay to ensure window has finished resizing
            setTimeout(() => {
                handleFullscreenChange();
            }, 100);
        });
    }
    
    // Also check fullscreen state on initialization if in Electron
    if (window.SpacebrosApp && window.SpacebrosApp.settings && window.SpacebrosApp.settings.isFullscreen) {
        window.SpacebrosApp.settings.isFullscreen().then((fs) => {
            isElectronFullscreen = fs;
            const size = typeof getSize === 'function' ? getSize() : null;
            if (size) {
                setupCanvasResolution(size.width, size.height);
            }
        }).catch(() => {
            // Ignore errors, use cached value
        });
    }

    window.addEventListener('resize', handleWindowResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

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
