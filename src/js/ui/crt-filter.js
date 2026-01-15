/**
 * CRT Filter Manager
 * Handles toggling and persistence of the CRT display filter effect using PixiJS CRTFilter
 */

const CRT_FILTER_STORAGE_KEY = 'crt_filter_enabled';

let GameContextRef = null;
let showOverlayMessageRef = null;
let getPixiAppRef = null;
let crtFilter = null;
let bloomFilter = null;

/**
 * Register dependencies
 * @param {object} deps
 */
export function registerCrtFilterDependencies(deps) {
    if (deps.GameContext) GameContextRef = deps.GameContext;
    if (deps.showOverlayMessage) showOverlayMessageRef = deps.showOverlayMessage;
    if (deps.getPixiApp) getPixiAppRef = deps.getPixiApp;
}

/**
 * Check if CRT filter is currently enabled
 * @returns {boolean}
 */
export function isCrtFilterEnabled() {
    return localStorage.getItem(CRT_FILTER_STORAGE_KEY) === 'true';
}

/**
 * Enable CRT filter
 */
export function enableCrtFilter() {
    const pixiApp = getPixiAppRef ? getPixiAppRef() : null;
    
    if (!pixiApp || !pixiApp.stage) {
        console.warn('[CRT] PixiJS not initialized');
        return;
    }

    // Check if filters are available
    if (!window.PIXI || !window.PIXI.filters) {
        console.warn('[CRT] PixiJS filters not available.');
        return;
    }

    if (!window.PIXI.filters.CRTFilter) {
        console.warn('[CRT] PixiJS CRTFilter not available. Make sure pixi-filters is loaded.');
        return;
    }

    // Create CRT filter if it doesn't exist (with enhanced glow settings)
    if (!crtFilter) {
        try {
            crtFilter = new window.PIXI.filters.CRTFilter({
                curvature: 8.0,
                lineWidth: 1.5,
                lineContrast: 0.4,  // Increased for more visible scanlines
                noise: 0.0,
                noiseSize: 512,
                vignetting: 0.4,  // Increased vignetting
                vignettingAlpha: 0.8,  // Stronger vignette
                vignettingBlur: 0.4,
                seed: 0.0,
                time: 0.0
            });
        } catch (e) {
            console.error('[CRT] Failed to create CRT filter:', e);
            return;
        }
    }

    // Create Bloom filter for phosphor glow effect
    // Try AdvancedBloomFilter first for better control, fallback to BloomFilter
    if (!bloomFilter) {
        try {
            if (window.PIXI.filters.AdvancedBloomFilter) {
                bloomFilter = new window.PIXI.filters.AdvancedBloomFilter({
                    threshold: 0.3,  // Lower threshold = more pixels glow
                    bloomScale: 1.0,  // Reduced from 2.0 (50% less)
                    brightness: 1.15,  // Reduced from 1.3 (50% less increase)
                    blur: 8,  // Reduced from 12 (less spread)
                    quality: 4,  // Good quality
                    resolution: pixiApp.renderer.resolution || 1
                });
            } else if (window.PIXI.filters.BloomFilter) {
                bloomFilter = new window.PIXI.filters.BloomFilter({
                    blur: 8,  // Reduced from 12 (less spread)
                    quality: 4,  // Good quality
                    resolution: pixiApp.renderer.resolution || 1
                });
            }
        } catch (e) {
            console.warn('[CRT] Failed to create Bloom filter:', e);
        }
    }

    // Apply filters to stage (bloom first, then CRT for proper effect)
    const filters = [];
    if (bloomFilter) filters.push(bloomFilter);
    filters.push(crtFilter);

    // Check if filters are already applied
    if (pixiApp.stage.filters) {
        // Remove old filters if they exist
        const existingFilters = pixiApp.stage.filters.filter(f => f !== crtFilter && f !== bloomFilter);
        pixiApp.stage.filters = [...existingFilters, ...filters];
    } else {
        pixiApp.stage.filters = filters;
    }

    localStorage.setItem(CRT_FILTER_STORAGE_KEY, 'true');
    updateCrtButtonStates(true);
}

/**
 * Disable CRT filter
 */
export function disableCrtFilter() {
    const pixiApp = getPixiAppRef ? getPixiAppRef() : null;
    
    if (!pixiApp || !pixiApp.stage || !crtFilter) {
        return;
    }

    // Remove filters from stage
    if (pixiApp.stage.filters) {
        const filters = pixiApp.stage.filters.filter(f => f !== crtFilter && f !== bloomFilter);
        if (filters.length === 0) {
            pixiApp.stage.filters = null;
        } else {
            pixiApp.stage.filters = filters;
        }
    }

    localStorage.setItem(CRT_FILTER_STORAGE_KEY, 'false');
    updateCrtButtonStates(false);
}

/**
 * Toggle CRT filter on/off
 */
export function toggleCrtFilter() {
    if (isCrtFilterEnabled()) {
        disableCrtFilter();
        if (showOverlayMessageRef) {
            showOverlayMessageRef('CRT: OFF', '#888', 1000, 10);
        }
    } else {
        enableCrtFilter();
        if (showOverlayMessageRef) {
            showOverlayMessageRef('CRT: ON', '#0ff', 1000, 10);
        }
    }
}

/**
 * Update CRT button text and checkbox states
 * @param {boolean} enabled
 */
function updateCrtButtonStates(enabled) {
    const crtToggleBtn = document.getElementById('crt-toggle-btn');
    const crtCheck = document.getElementById('crt-check');

    if (crtToggleBtn) {
        crtToggleBtn.textContent = `CRT: ${enabled ? 'ON' : 'OFF'}`;
    }

    if (crtCheck) {
        crtCheck.checked = enabled;
    }
}

/**
 * Update CRT filter animation (call this in game loop)
 */
export function updateCrtFilter() {
    const pixiApp = getPixiAppRef ? getPixiAppRef() : null;
    
    if (!pixiApp || !pixiApp.stage || !pixiApp.stage.filters) {
        return;
    }

    // Update CRT filter time for animation effects
    if (crtFilter && pixiApp.stage.filters.includes(crtFilter)) {
        crtFilter.time += 0.016; // ~60fps
    }
}

/**
 * Get the CRT filter instance (for external access)
 * @returns {PIXI.filters.CRTFilter|null}
 */
export function getCrtFilter() {
    return crtFilter;
}

/**
 * Initialize CRT filter from saved settings
 */
export function initCrtFilter() {
    const isEnabled = isCrtFilterEnabled();

    if (isEnabled) {
        enableCrtFilter();
    } else {
        disableCrtFilter();
    }
}

/**
 * Initialize CRT filter UI event listeners
 */
export function initCrtFilterUI() {
    // Pause menu button
    const crtToggleBtn = document.getElementById('crt-toggle-btn');
    if (crtToggleBtn) {
        crtToggleBtn.addEventListener('click', () => {
            toggleCrtFilter();
        });

        // Add to pause menu button list for gamepad navigation
        if (GameContextRef && !GameContextRef.pauseMenuButtons) {
            GameContextRef.pauseMenuButtons = [];
        }
    }

    // Settings menu checkbox
    const crtCheck = document.getElementById('crt-check');
    if (crtCheck) {
        crtCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                enableCrtFilter();
                if (showOverlayMessageRef) {
                    showOverlayMessageRef('CRT: ON', '#0ff', 1000, 10);
                }
            } else {
                disableCrtFilter();
                if (showOverlayMessageRef) {
                    showOverlayMessageRef('CRT: OFF', '#888', 1000, 10);
                }
            }
        });
    }

    // Initialize from saved state
    initCrtFilter();
}
