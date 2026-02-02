/**
 * Vectrex Filter Manager
 * Handles toggling and persistence of Vectrex vector display effect
 * Vectrex was a vector console with monochrome phosphor glow, no scanlines/curvature
 */

const VECTREX_FILTER_STORAGE_KEY = "vectrex_filter_enabled";

let GameContextRef = null;
let showOverlayMessageRef = null;
let getPixiAppRef = null;
let disableCrtFilterRef = null;
let isCrtFilterEnabledRef = null;
let bloomFilter = null;

/**
 * Register dependencies
 * @param {object} deps
 */
export function registerVectrexFilterDependencies(deps) {
  if (deps.GameContext) GameContextRef = deps.GameContext;
  if (deps.showOverlayMessage) showOverlayMessageRef = deps.showOverlayMessage;
  if (deps.getPixiApp) getPixiAppRef = deps.getPixiApp;
  if (deps.disableCrtFilter) disableCrtFilterRef = deps.disableCrtFilter;
  if (deps.isCrtFilterEnabled) isCrtFilterEnabledRef = deps.isCrtFilterEnabled;
}

/**
 * Check if Vectrex filter is currently enabled
 * @returns {boolean}
 */
export function isVectrexFilterEnabled() {
  const stored = localStorage.getItem(VECTREX_FILTER_STORAGE_KEY);
  if (stored === null || stored === undefined) {
    return false;
  }
  return stored === "true";
}

/**
 * Enable Vectrex filter
 */
export function enableVectrexFilter() {
  const pixiApp = getPixiAppRef ? getPixiAppRef() : null;

  if (!pixiApp || !pixiApp.stage) {
    console.warn("[VECTREX] PixiJS not initialized");
    return;
  }

  if (!window.PIXI || !window.PIXI.filters) {
    console.warn("[VECTREX] PixiJS filters not available.");
    return;
  }

  // Disable CRT filter if active (filters are mutually exclusive)
  if (isCrtFilterEnabledRef && isCrtFilterEnabledRef()) {
    if (disableCrtFilterRef) {
      disableCrtFilterRef();
    }
  }

  // Create Bloom filter for phosphor glow effect (similar to CRT but stronger)
  if (!bloomFilter) {
    try {
      if (window.PIXI.filters.AdvancedBloomFilter) {
        bloomFilter = new window.PIXI.filters.AdvancedBloomFilter({
          threshold: 0.2,
          bloomScale: 1.5,
          brightness: 1.2,
          blur: 10,
          quality: 4,
          resolution: pixiApp.renderer.resolution || 1
        });
      } else if (window.PIXI.filters.BloomFilter) {
        bloomFilter = new window.PIXI.filters.BloomFilter({
          blur: 10,
          quality: 4,
          resolution: pixiApp.renderer.resolution || 1
        });
      }
    } catch (e) {
      console.warn("[VECTREX] Failed to create Bloom filter:", e);
    }
  }

  // Apply bloom filter to stage
  const filters = [];
  if (bloomFilter) filters.push(bloomFilter);

  if (pixiApp.stage.filters) {
    const existingFilters = pixiApp.stage.filters.filter(f => f !== bloomFilter);
    pixiApp.stage.filters = [...existingFilters, ...filters];
  } else {
    pixiApp.stage.filters = filters;
  }

  // Add green phosphor tint via CSS overlay
  document.body.classList.add("vectrex-active");

  localStorage.setItem(VECTREX_FILTER_STORAGE_KEY, "true");
  updateVectrexButtonStates(true);
}

/**
 * Disable Vectrex filter
 */
export function disableVectrexFilter() {
  const pixiApp = getPixiAppRef ? getPixiAppRef() : null;

  if (!pixiApp || !pixiApp.stage) {
    return;
  }

  // Remove bloom filter from stage
  if (pixiApp.stage.filters) {
    const filters = pixiApp.stage.filters.filter(f => f !== bloomFilter);
    if (filters.length === 0) {
      pixiApp.stage.filters = null;
    } else {
      pixiApp.stage.filters = filters;
    }
  }

  // Remove green phosphor tint overlay
  document.body.classList.remove("vectrex-active");

  localStorage.setItem(VECTREX_FILTER_STORAGE_KEY, "false");
  updateVectrexButtonStates(false);
}

/**
 * Toggle Vectrex filter on/off
 */
export function toggleVectrexFilter() {
  if (isVectrexFilterEnabled()) {
    disableVectrexFilter();
    if (showOverlayMessageRef) {
      showOverlayMessageRef("VECTREX: OFF", "#888", 1000, 10);
    }
  } else {
    enableVectrexFilter();
    if (showOverlayMessageRef) {
      showOverlayMessageRef("VECTREX: ON", "#0f0", 1000, 10);
    }
  }
}

/**
 * Update Vectrex button text and checkbox states
 * @param {boolean} enabled
 */
function updateVectrexButtonStates(enabled) {
  const vectrexToggleBtn = document.getElementById("vectrex-toggle-btn");
  const vectrexCheck = document.getElementById("vectrex-check");

  if (vectrexToggleBtn) {
    vectrexToggleBtn.textContent = `VECTREX: ${enabled ? "ON" : "OFF"}`;
  }

  if (vectrexCheck) {
    vectrexCheck.checked = enabled;
  }
}

/**
 * Get Vectrex filter instances (for external access)
 * @returns {object}
 */
export function getVectrexFilters() {
  return { bloomFilter };
}

/**
 * Initialize Vectrex filter from saved settings
 */
export function initVectrexFilter() {
  const isEnabled = isVectrexFilterEnabled();

  if (isEnabled) {
    enableVectrexFilter();
  } else {
    disableVectrexFilter();
  }
}

/**
 * Initialize Vectrex filter UI event listeners
 */
export function initVectrexFilterUI() {
  const vectrexToggleBtn = document.getElementById("vectrex-toggle-btn");
  if (vectrexToggleBtn) {
    vectrexToggleBtn.addEventListener("click", () => {
      toggleVectrexFilter();
    });

    if (GameContextRef && !GameContextRef.pauseMenuButtons) {
      GameContextRef.pauseMenuButtons = [];
    }
  }

  const vectrexCheck = document.getElementById("vectrex-check");
  if (vectrexCheck) {
    vectrexCheck.addEventListener("change", e => {
      if (e.target.checked) {
        enableVectrexFilter();
        if (showOverlayMessageRef) {
          showOverlayMessageRef("VECTREX: ON", "#0f0", 1000, 10);
        }
      } else {
        disableVectrexFilter();
        if (showOverlayMessageRef) {
          showOverlayMessageRef("VECTREX: OFF", "#888", 1000, 10);
        }
      }
    });
  }

  initVectrexFilter();
}
