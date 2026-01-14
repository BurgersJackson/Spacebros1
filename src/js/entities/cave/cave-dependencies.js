
/**
 * cave-dependencies.js
 * Dependency injection placeholder for cave module to avoid circular dependencies.
 */

export const caveDeps = {
    // Audio
    playSound: null, // can be imported usually, but keeping option open

    // Particles/Visuals
    spawnParticles: null,
    spawnFieryExplosion: null,
    spawnBossExplosion: null,
    emitParticle: null,

    // Mechanics
    applyAOEDamageToPlayer: null,
    awardCoinsInstant: null,
    awardNuggetsInstant: null,
    killPlayer: null,
    showLevelUpMenu: null,
    startSectorTransition: null,
    resetWarpState: null, // used in startCaveSector2
    clearMiniEvent: null, // used in startCaveSector2

    // UI
    showOverlayMessage: null,
    updateHealthUI: null
};

export function registerCaveDependencies(deps) {
    Object.assign(caveDeps, deps);
}
