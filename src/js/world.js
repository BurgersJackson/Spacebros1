import { state } from './constants.js';
import { SpatialHash } from './utils.js';

export function initWorld() {
    state.entities = {
        player: null,
        enemies: [],
        bullets: [],
        asteroids: [],
        particles: [],
        coins: [],
        pickups: []
    };
    state.grids = {
        asteroid: new SpatialHash(500),
        enemy: new SpatialHash(500)
    };
}

export function updateGrids() {
    state.grids.asteroid.clear();
    for (let ast of state.entities.asteroids) {
        state.grids.asteroid.insert(ast);
    }
}

export function spawnAsteroids(count) {
    // Logic from spawnOneAsteroidRelative...
}

export function checkCollisions() {
    // Collision resolution logic...
}
