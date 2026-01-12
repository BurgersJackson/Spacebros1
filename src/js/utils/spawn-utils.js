/**
 * @param {Object} state
 * @param {boolean} random
 * @param {number} min
 * @param {number} max
 * @returns {{x: number, y: number}}
 */
export function findSpawnPointRelative(state, random = false, min = 1500, max = 2500) {
    const player = state ? state.player : null;
    const caveMode = state ? state.caveMode : false;
    const caveLevel = state ? state.caveLevel : null;
    if (!player) return { x: 0, y: 0 };
    if (caveMode && caveLevel && caveLevel.active) {
        const dist = min + Math.random() * (max - min);
        const y = player.pos.y - dist * (0.85 + Math.random() * 0.3);
        const bounds = caveLevel.boundsAt(y);
        const margin = 180;
        const w = Math.max(200, (bounds.right - bounds.left) - margin * 2);
        const x = bounds.left + margin + Math.random() * w;
        return { x, y };
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = min + Math.random() * (max - min);
    const x = player.pos.x + Math.cos(angle) * dist;
    const y = player.pos.y + Math.sin(angle) * dist;
    return { x, y };
}
