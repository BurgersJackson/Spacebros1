/**
 * Environment Entities Index
 * Re-exports all environment entities.
 */

export {
    EnvironmentAsteroid,
    registerAsteroidDependencies,
    updateAsteroidRenderState
} from './EnvironmentAsteroid.js';
export { WarpGate } from './WarpGate.js';
export { Dungeon1Gate } from './Dungeon1Gate.js';
export {
    SectorPOI,
    DerelictShipPOI,
    DebrisFieldPOI,
    ExplorationCache,
    registerPoiDependencies
} from './poi.js';
export {
    MiniEventDefendCache,
    registerMiniEventDefendCacheDependencies
} from './MiniEventDefendCache.js';
export {
    ShootingStar,
    registerShootingStarDependencies
} from './ShootingStar.js';
