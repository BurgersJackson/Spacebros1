import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { showOverlayMessage } from '../../utils/ui-helpers.js';
import { playSound } from '../../audio/audio-manager.js';
import { Enemy } from '../enemies/Enemy.js';
import { Gunboat } from '../enemies/Gunboat.js';
import { Cruiser } from '../bosses/Cruiser.js';
import { NecroticHive } from '../bosses/dungeon/NecroticHive.js';
import { CerebralPsion } from '../bosses/dungeon/CerebralPsion.js';
import { Fleshforge } from '../bosses/dungeon/Fleshforge.js';
import { VortexMatriarch } from '../bosses/dungeon/VortexMatriarch.js';
import { ChitinusPrime } from '../bosses/dungeon/ChitinusPrime.js';
import { PsyLich } from '../bosses/dungeon/PsyLich.js';
import { EnvironmentAsteroid } from '../environment/EnvironmentAsteroid.js';
import { pixiCleanupObject } from '../../utils/cleanup-utils.js';

let _clearArrayWithPixiCleanup = null;
let _filterArrayWithPixiCleanup = null;

export function registerDungeon1ZoneDependencies(deps) {
    if (deps.clearArrayWithPixiCleanup) _clearArrayWithPixiCleanup = deps.clearArrayWithPixiCleanup;
    if (deps.filterArrayWithPixiCleanup) _filterArrayWithPixiCleanup = deps.filterArrayWithPixiCleanup;
}

export class Dungeon1Zone extends Entity {
    constructor(x, y) {
        super(x, y);
        this.active = true;
        this.state = 'wave1'; // 'wave1' | 'cruiser' | 'complete'
        this.t = 0;
        this.waveSpawned = false;
        this.boundaryRadius = 2500;
        this.dungeonEnemies = []; // Track enemies spawned by this dungeon
    }

    update(deltaTime = SIM_STEP_MS) {
        if (!this.active) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        // Spawn wave immediately on first update
        if (this.state === 'wave1' && !this.waveSpawned) {
            this.spawnWave1();
            this.spawnIndestructibleAsteroids();
            this.waveSpawned = true;
        }

        // Remove dead enemies from dungeonEnemies array
        for (let i = this.dungeonEnemies.length - 1; i >= 0; i--) {
            const enemy = this.dungeonEnemies[i];
            if (!enemy || enemy.dead) {
                this.dungeonEnemies.splice(i, 1);
            }
        }

        // Check if wave 1 is complete
        if (this.state === 'wave1') {
            const livingDungeonEnemies = this.dungeonEnemies.filter(e => e && !e.dead).length;
            if (livingDungeonEnemies === 0) {
                this.startCruiserFight();
            }
        }

        // Check if cruiser is defeated
        if (this.state === 'cruiser' && (!GameContext.bossActive || !GameContext.boss || GameContext.boss.dead)) {
            this.state = 'complete';
            GameContext.dungeon1Arena.active = false;
            GameContext.dungeon1Arena.growing = false;
            showOverlayMessage("DUNGEON 1 CLEARED - BOUNDARY REMOVED", '#0f0', 3000, 2);
            GameContext.dungeon1CompletedOnce = true;
        }
    }

    spawnWave1() {
        // Spawn indestructible stationary asteroids for cover (4-12 random)
        this.spawnIndestructibleAsteroids();

        // Spawn 3 level 2 gunboats at top edge, flying in
        for (let i = 0; i < 3; i++) {
            // Spread horizontally across the top edge
            const spreadX = (i - 1) * 600; // -600, 0, +600
            const spawnX = this.pos.x + spreadX;
            const spawnY = this.pos.y - this.boundaryRadius + 200; // Top edge, slightly inside

            // Use Gunboat class for unified difficulty tier system
            const gunboat = new Gunboat(spawnX, spawnY, 2);
            gunboat.isDungeonEnemy = true;
            gunboat.despawnImmune = true;

            // Set velocity flying inward toward center
            const angle = Math.atan2(this.pos.y - spawnY, this.pos.x - spawnX);
            const speed = 4; // Flying in speed
            gunboat.vel.x = Math.cos(angle) * speed;
            gunboat.vel.y = Math.sin(angle) * speed;

            GameContext.enemies.push(gunboat);
            this.dungeonEnemies.push(gunboat);
        }

        // Spawn 5 defenders at top edge, flying in
        for (let i = 0; i < 5; i++) {
            // Spread horizontally across the top edge
            const spreadX = (i - 2) * 500; // -1000, -500, 0, +500, +1000
            const spawnX = this.pos.x + spreadX;
            const spawnY = this.pos.y - this.boundaryRadius + 100; // Top edge, slightly inside

            const defender = new Enemy('defender', { x: spawnX, y: spawnY }, null);
            defender.isDungeonEnemy = true;
            defender.despawnImmune = true;

            // Set velocity flying inward toward center
            const angle = Math.atan2(this.pos.y - spawnY, this.pos.x - spawnX);
            const speed = 5; // Flying in speed
            defender.vel.x = Math.cos(angle) * speed;
            defender.vel.y = Math.sin(angle) * speed;

            GameContext.enemies.push(defender);
            this.dungeonEnemies.push(defender);
        }

        showOverlayMessage("DESTROY ALL ENEMIES", '#f80', 2000, 2);
        playSound('contract');
    }

    startCruiserFight() {
        this.state = 'cruiser';

        // Clear remaining enemies and projectiles
        if (_clearArrayWithPixiCleanup) {
            _clearArrayWithPixiCleanup(GameContext.enemies);
            _clearArrayWithPixiCleanup(GameContext.pinwheels);
            _clearArrayWithPixiCleanup(GameContext.bossBombs);
            _clearArrayWithPixiCleanup(GameContext.guidedMissiles);
            _clearArrayWithPixiCleanup(GameContext.warpBioPods);
        }
        if (_filterArrayWithPixiCleanup) {
            _filterArrayWithPixiCleanup(GameContext.bullets, b => !b.isEnemy);
        }

        this.dungeonEnemies = [];

        // Spawn random dungeon boss from the pool
        const bossType = GameContext.dungeonBossPool[Math.floor(Math.random() * GameContext.dungeonBossPool.length)];
        let newBoss;

        switch (bossType) {
            case 'NecroticHive':
                newBoss = new NecroticHive(1);
                GameContext.necroticHive = newBoss;
                break;
            case 'CerebralPsion':
                newBoss = new CerebralPsion(1);
                GameContext.cerebralPsion = newBoss;
                break;
            case 'Fleshforge':
                newBoss = new Fleshforge(1);
                GameContext.fleshforge = newBoss;
                break;
            case 'VortexMatriarch':
                newBoss = new VortexMatriarch(1);
                GameContext.vortexMatriarch = newBoss;
                break;
            case 'ChitinusPrime':
                newBoss = new ChitinusPrime(1);
                GameContext.chitinusPrime = newBoss;
                break;
            case 'PsyLich':
                newBoss = new PsyLich(1);
                GameContext.psyLich = newBoss;
                break;
            default:
                // Fallback to Cruiser if something goes wrong
                newBoss = new Cruiser(1);
        }

        GameContext.boss = newBoss;
        GameContext.bossActive = true;

        // Position boss at top of dungeon arena
        GameContext.boss.pos.x = this.pos.x;
        GameContext.boss.pos.y = this.pos.y - this.boundaryRadius + 500;
        GameContext.boss.prevPos.x = GameContext.boss.pos.x;
        GameContext.boss.prevPos.y = GameContext.boss.pos.y;

        showOverlayMessage(`DUNGEON BOSS: ${bossType.toUpperCase()}`, '#f00', 2200, 3);
        playSound('boss_spawn');
    }

    spawnIndestructibleAsteroids() {
        // Spawn 4-12 random indestructible stationary asteroids
        const count = 4 + Math.floor(Math.random() * 9); // 4-12
        const spawnRadius = this.boundaryRadius - 300; // Keep away from boundary edge
        const minDistanceFromCenter = 500; // Don't spawn too close to player spawn

        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let validPosition = false;
            let x, y;

            // Try to find a valid position (not too close to center or other asteroids)
            while (!validPosition && attempts < 50) {
                attempts++;
                const angle = Math.random() * Math.PI * 2;
                const dist = minDistanceFromCenter + Math.random() * (spawnRadius - minDistanceFromCenter);
                x = this.pos.x + Math.cos(angle) * dist;
                y = this.pos.y + Math.sin(angle) * dist;

                // Check distance from player spawn (center)
                const distFromCenter = Math.hypot(x - this.pos.x, y - this.pos.y);
                if (distFromCenter < minDistanceFromCenter) continue;

                // Check distance from other asteroids to avoid overlapping
                let tooClose = false;
                for (const ast of GameContext.environmentAsteroids) {
                    const d = Math.hypot(x - ast.pos.x, y - ast.pos.y);
                    if (d < 200) { // Minimum 200 units apart
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) validPosition = true;
            }

            if (validPosition) {
                const radius = 60 + Math.random() * 80; // 60-140 unit radius
                const asteroid = new EnvironmentAsteroid(x, y, radius, 2, true); // sizeLevel 2, indestructible

                // Make asteroid stationary (no velocity) but with rotation
                asteroid.vel.x = 0;
                asteroid.vel.y = 0;
                asteroid.rotSpeed = (Math.random() - 0.5) * 0.02; // Slow rotation in place

                // Mark as dungeon asteroid for cleanup tracking
                asteroid.isDungeonAsteroid = true;

                GameContext.environmentAsteroids.push(asteroid);
            }
        }
    }

    allSegments() {
        return [];
    }

    applyWallCollisions(entity) {
        if (!this.active || !entity || entity.dead) return;
        return;
    }

    bulletHitsWall(bullet) {
        return false;
    }

    draw(ctx) {
        return;
    }

    /**
     * Clean up all entities and resources in the dungeon zone
     */
    cleanup() {
        this.active = false;
        
        // Clean up dungeon enemies array
        if (this.dungeonEnemies && this.dungeonEnemies.length > 0) {
            for (let i = 0; i < this.dungeonEnemies.length; i++) {
                const enemy = this.dungeonEnemies[i];
                if (enemy) {
                    enemy.dead = true;
                    if (typeof enemy.kill === 'function') {
                        try { enemy.kill(); } catch (e) { }
                    }
                    try { pixiCleanupObject(enemy); } catch (e) { }
                }
            }
            this.dungeonEnemies.length = 0;
        }
    }
}
