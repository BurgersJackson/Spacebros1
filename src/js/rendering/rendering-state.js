/**
 * Rendering State Module
 * Exposes mutable rendering state used by entity draw methods.
 * This centralizes texture-loading flags and image references.
 */

// --- Asteroid Textures ---
const ASTEROID1_URL = 'assets/asteroid1.png';
const ASTEROID2_URL = 'assets/asteroid2.png';
const ASTEROID3_URL = 'assets/asteroid3.png';
const ASTEROID2_U_URL = 'assets/asteroid2_U.png';

export const asteroidImages = [
    new Image(),
    new Image(),
    new Image()
];
export const asteroidIndestructibleImage = new Image();

// Texture loading state
export const renderingState = {
    asteroidTexturesExternalReady: false,
    asteroidIndestructibleTextureReady: false
};

/**
 * Initialize asteroid images.
 * Call this after module loads.
 */
export function initAsteroidImages() {
    asteroidIndestructibleImage.decoding = 'async';
    asteroidIndestructibleImage.src = ASTEROID2_U_URL;

    asteroidImages[0].decoding = 'async';
    asteroidImages[1].decoding = 'async';
    asteroidImages[2].decoding = 'async';
    asteroidImages[0].src = ASTEROID1_URL;
    asteroidImages[1].src = ASTEROID2_URL;
    asteroidImages[2].src = ASTEROID3_URL;
}

/**
 * Apply asteroid textures to PixiJS.
 * Call from image load handler.
 * @param {Object} pixiTextures - Texture storage object
 * @param {Object} pixiTextureAnchors - Anchor storage object
 */
export function applyAsteroidTextures(pixiTextures, pixiTextureAnchors) {
    if (renderingState.asteroidTexturesExternalReady || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    if (!asteroidImages.every(img => img && img.naturalWidth > 0)) return;

    try {
        const tex1 = PIXI.Texture.from(asteroidImages[0]);
        const tex2 = PIXI.Texture.from(asteroidImages[1]);
        const tex3 = PIXI.Texture.from(asteroidImages[2]);

        for (const t of [tex1, tex2, tex3]) {
            try { t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { t.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        }

        pixiTextures.asteroids = [tex1, tex2, tex3];
        pixiTextureAnchors.asteroid_0 = 0.5;
        pixiTextureAnchors.asteroid_1 = 0.5;
        pixiTextureAnchors.asteroid_2 = 0.5;
        renderingState.asteroidTexturesExternalReady = true;
    } catch (e) {
        // Keep procedural asteroid textures
    }
}

/**
 * Apply indestructible asteroid texture to PixiJS.
 * @param {Object} pixiTextures - Texture storage object
 * @param {Object} pixiTextureAnchors - Anchor storage object
 */
export function applyIndestructibleAsteroidTexture(pixiTextures, pixiTextureAnchors) {
    if (!window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;

    try {
        const tex = PIXI.Texture.from(asteroidIndestructibleImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.asteroidIndestructible = tex;
        pixiTextureAnchors.asteroidIndestructible = 0.5;
        renderingState.asteroidIndestructibleTextureReady = true;
    } catch (e) {
        console.warn('Failed to load indestructible asteroid texture', e);
    }
}
