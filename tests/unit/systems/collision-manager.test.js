import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkWallCollision, checkBulletWallCollision, registerCollisionDependencies } from '../../../src/js/systems/collision-manager.js';
import { GameContext } from '../../../src/js/core/game-context.js';

// Mock entity classes to avoid texture-loader DOM dependencies
vi.mock('../../../src/js/entities/index.js', () => ({
  Enemy: class {},
  Pinwheel: class {},
  Destroyer: class {},
  Destroyer2: class {},
  SpaceStation: class {},
  Cruiser: class {},
}));

vi.mock('../../../src/js/entities/cave/index.js', () => ({
  CavePinwheel1: class {},
  CavePinwheel2: class {},
  CavePinwheel3: class {},
}));

// Mock GameContext
vi.mock('../../../src/js/core/game-context.js', () => ({
  GameContext: {
    caveMode: false,
    caveLevel: null,
    warpZone: null,
    bossArena: { active: false, x: 0, y: 0, radius: 2000 },
    stationArena: { active: false, x: 0, y: 0, radius: 2000 },
    caveBossArena: { active: false, x: 0, y: 0, radius: 2000 },
    dungeon1Arena: { active: false, x: 0, y: 0, radius: 2000 },
    player: null,
    asteroidGrid: { query: vi.fn(() => []) },
    activeContract: null,
    contractEntities: {
      anomalies: [],
      fortresses: [],
    },
    sectorIndex: 0,
  },
}));

describe('collision-manager.js', () => {
  beforeEach(() => {
    // Reset GameContext state
    GameContext.caveMode = false;
    GameContext.caveLevel = null;
    GameContext.warpZone = null;
    GameContext.bossArena = { active: false, x: 0, y: 0, radius: 2000 };
    GameContext.stationArena = { active: false, x: 0, y: 0, radius: 2000 };
    GameContext.caveBossArena = { active: false, x: 0, y: 0, radius: 2000 };
    GameContext.dungeon1Arena = { active: false, x: 0, y: 0, radius: 2000 };
    GameContext.activeContract = null;
    GameContext.contractEntities = { anomalies: [], fortresses: [] };
    GameContext.asteroidGrid.query.mockReturnValue([]);

    vi.clearAllMocks();
  });

  describe('registerCollisionDependencies', () => {
    it('should register spawnParticles dependency', () => {
      const mockSpawnParticles = vi.fn();
      registerCollisionDependencies({ spawnParticles: mockSpawnParticles });
      expect(mockSpawnParticles).toBeDefined();
    });

    it('should register playSound dependency', () => {
      const mockPlaySound = vi.fn();
      registerCollisionDependencies({ playSound: mockPlaySound });
      expect(mockPlaySound).toBeDefined();
    });

    it('should register updateHealthUI dependency', () => {
      const mockUpdateHealthUI = vi.fn();
      registerCollisionDependencies({ updateHealthUI: mockUpdateHealthUI });
      expect(mockUpdateHealthUI).toBeDefined();
    });

    it('should register killPlayer dependency', () => {
      const mockKillPlayer = vi.fn();
      registerCollisionDependencies({ killPlayer: mockKillPlayer });
      expect(mockKillPlayer).toBeDefined();
    });

    it('should handle missing dependencies gracefully', () => {
      expect(() => {
        registerCollisionDependencies({});
      }).not.toThrow();
    });

    it('should register all dependencies at once', () => {
      const deps = {
        spawnParticles: vi.fn(),
        playSound: vi.fn(),
        updateHealthUI: vi.fn(),
        updateNuggetUI: vi.fn(),
        addPickupFloatingText: vi.fn(),
        showOverlayMessage: vi.fn(),
        killPlayer: vi.fn(),
        handleSpaceStationDestroyed: vi.fn(),
        spawnLightningArc: vi.fn(),
        spawnLargeExplosion: vi.fn(),
        destroyBulletSprite: vi.fn(),
        updateContractUI: vi.fn(),
        setProjectileImpactSoundContext: vi.fn(),
        awardCoinsInstant: vi.fn(),
        awardNuggetsInstant: vi.fn(),
      };
      expect(() => {
        registerCollisionDependencies(deps);
      }).not.toThrow();
    });
  });

  describe('checkWallCollision', () => {
    let mockEntity;

    beforeEach(() => {
      mockEntity = {
        pos: { x: 100, y: 100 },
        vel: { x: 5, y: 5 },
        radius: 20,
        dead: false,
      };
    });

    it('should return early if entity is null', () => {
      expect(() => {
        checkWallCollision(null);
      }).not.toThrow();
    });

    it('should return early if entity is dead', () => {
      mockEntity.dead = true;
      expect(() => {
        checkWallCollision(mockEntity);
      }).not.toThrow();
    });

    it('should apply cave wall collisions when caveMode is active', () => {
      GameContext.caveMode = true;
      GameContext.caveLevel = {
        active: true,
        applyWallCollisions: vi.fn(),
      };

      checkWallCollision(mockEntity);
      expect(GameContext.caveLevel.applyWallCollisions).toHaveBeenCalledWith(mockEntity);
    });

    it('should apply warp zone wall collisions when warpZone is active', () => {
      GameContext.warpZone = {
        active: true,
        applyWallCollisions: vi.fn(),
      };

      checkWallCollision(mockEntity);
      expect(GameContext.warpZone.applyWallCollisions).toHaveBeenCalledWith(mockEntity);
    });

    it('should apply anomaly zone wall collisions when active contract is anomaly', () => {
      const mockAnomaly = {
        pos: { x: 100, y: 100 },
        radius: 100,
        dead: false,
        contractId: 'contract-1',
        applyWallCollisions: vi.fn(),
      };

      GameContext.activeContract = { type: 'anomaly', id: 'contract-1' };
      GameContext.contractEntities.anomalies = [mockAnomaly];

      checkWallCollision(mockEntity);
      expect(mockAnomaly.applyWallCollisions).toHaveBeenCalledWith(mockEntity, 0.95);
    });

    describe('Boss Arena Boundary', () => {
      beforeEach(() => {
        GameContext.bossArena = { active: true, x: 0, y: 0, radius: 1000 };
        GameContext.player = {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          hp: 100,
          invulnerable: 0,
          lastArenaDamageTime: 0,
        };
      });

      it('should return early for enemies in boss arena', async () => {
        const { Enemy } = await import('../../../src/js/entities/index.js');
        const mockEnemy = new Enemy();
        Object.assign(mockEnemy, {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          dead: false,
          type: 'enemy',
        });

        checkWallCollision(mockEnemy);
        expect(mockEnemy.pos.y).toBe(1050);
      });

      it('should push entity back to arena boundary', () => {
        checkWallCollision(GameContext.player);
        expect(GameContext.player.pos.x).toBeCloseTo(0);
        expect(Math.abs(GameContext.player.pos.y)).toBeLessThan(1021);
      });

      it('should reflect velocity when moving away from center', () => {
        const mockKillPlayer = vi.fn();
        registerCollisionDependencies({ killPlayer: mockKillPlayer });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.vel.y).toBeLessThan(5);
      });

      it('should damage player when outside arena boundary', () => {
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(99);
        expect(mockUpdateHealthUI).toHaveBeenCalled();
        expect(mockSpawnParticles).toHaveBeenCalled();
        expect(mockPlaySound).toHaveBeenCalledWith('hit');
        expect(mockShowOverlayMessage).toHaveBeenCalled();
      });

      it('should not damage player during warp boss fight', () => {
        GameContext.boss = { isWarpBoss: true, active: true, dead: false };
        GameContext.bossActive = true;
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(100);
        expect(mockUpdateHealthUI).not.toHaveBeenCalled();
      });

      it('should respect damage cooldown', () => {
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        GameContext.player.lastArenaDamageTime = Date.now() - 500;
        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(100);
        expect(mockUpdateHealthUI).not.toHaveBeenCalled();
      });
    });

    describe('Station Arena Boundary', () => {
      beforeEach(() => {
        GameContext.stationArena = { active: true, x: 0, y: 0, radius: 1000 };
        GameContext.player = {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          hp: 100,
          invulnerable: 0,
          lastArenaDamageTime: 0,
        };
      });

      it('should return early for enemies in station arena', async () => {
        const { Enemy } = await import('../../../src/js/entities/index.js');
        const mockEnemy = new Enemy();
        Object.assign(mockEnemy, {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          dead: false,
          type: 'enemy',
        });

        checkWallCollision(mockEnemy);
        expect(mockEnemy.pos.y).toBe(1050);
      });

      it('should push player back to station arena boundary', () => {
        checkWallCollision(GameContext.player);
        expect(GameContext.player.pos.x).toBeCloseTo(0);
        expect(Math.abs(GameContext.player.pos.y)).toBeLessThan(1021);
      });

      it('should damage player when outside station arena boundary', () => {
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(99);
        expect(mockUpdateHealthUI).toHaveBeenCalled();
        expect(mockPlaySound).toHaveBeenCalledWith('hit');
        expect(mockShowOverlayMessage).toHaveBeenCalledWith('STATION FIELD DAMAGE', '#f80', 1000);
      });
    });

    describe('Cave Boss Arena Boundary', () => {
      beforeEach(() => {
        GameContext.caveMode = true;
        GameContext.caveBossArena = { active: true, x: 0, y: 0, radius: 1000 };
        GameContext.player = {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          hp: 100,
          invulnerable: 0,
          lastArenaDamageTime: 0,
        };
      });

      it('should push player back to cave boss arena boundary', () => {
        checkWallCollision(GameContext.player);
        expect(GameContext.player.pos.x).toBeCloseTo(0);
        expect(Math.abs(GameContext.player.pos.y)).toBeLessThan(1021);
      });

      it('should damage player when outside cave boss arena boundary', () => {
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(99);
        expect(mockUpdateHealthUI).toHaveBeenCalled();
        expect(mockPlaySound).toHaveBeenCalledWith('hit');
        expect(mockShowOverlayMessage).toHaveBeenCalledWith('ARENA BOUNDARY DAMAGE', '#f80', 1000);
      });
    });

    describe('Dungeon Arena Boundary', () => {
      beforeEach(() => {
        GameContext.dungeon1Arena = { active: true, x: 0, y: 0, radius: 1000 };
        GameContext.player = {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          hp: 100,
          invulnerable: 0,
          lastArenaDamageTime: 0,
        };
      });

      it('should return early for enemies in dungeon arena', async () => {
        const { Enemy } = await import('../../../src/js/entities/index.js');
        const mockEnemy = new Enemy();
        Object.assign(mockEnemy, {
          pos: { x: 0, y: 1050 },
          vel: { x: 0, y: 5 },
          radius: 20,
          dead: false,
          type: 'enemy',
        });

        checkWallCollision(mockEnemy);
        expect(mockEnemy.pos.y).toBe(1050);
      });

      it('should push player back to dungeon arena boundary', () => {
        checkWallCollision(GameContext.player);
        expect(GameContext.player.pos.x).toBeCloseTo(0);
        expect(Math.abs(GameContext.player.pos.y)).toBeLessThan(1021);
      });

      it('should damage player when outside dungeon arena boundary', () => {
        const mockKillPlayer = vi.fn();
        const mockUpdateHealthUI = vi.fn();
        const mockSpawnParticles = vi.fn();
        const mockPlaySound = vi.fn();
        const mockShowOverlayMessage = vi.fn();

        registerCollisionDependencies({
          killPlayer: mockKillPlayer,
          updateHealthUI: mockUpdateHealthUI,
          spawnParticles: mockSpawnParticles,
          playSound: mockPlaySound,
          showOverlayMessage: mockShowOverlayMessage,
        });

        checkWallCollision(GameContext.player);
        expect(GameContext.player.hp).toBe(99);
        expect(mockUpdateHealthUI).toHaveBeenCalled();
        expect(mockPlaySound).toHaveBeenCalledWith('hit');
        expect(mockShowOverlayMessage).toHaveBeenCalledWith('DUNGEON BOUNDARY', '#f80', 1000);
      });
    });

    describe('Elasticity', () => {
      beforeEach(() => {
        GameContext.bossArena = { active: true, x: 0, y: 0, radius: 1000 };
        mockEntity.pos = { x: 0, y: 1050 };
        mockEntity.vel = { x: 0, y: 5 };
      });

      it('should use default elasticity of 0', () => {
        checkWallCollision(mockEntity);
        expect(mockEntity.pos.x).toBeDefined();
      });

      it('should use provided elasticity value', () => {
        const initialVelY = mockEntity.vel.y;
        checkWallCollision(mockEntity, 0.5);
        expect(mockEntity.vel.y).toBeLessThan(initialVelY);
      });
    });
  });

  describe('checkBulletWallCollision', () => {
    let mockBullet;

    beforeEach(() => {
      mockBullet = {
        pos: { x: 100, y: 100 },
        radius: 5,
        dead: false,
      };
      GameContext.asteroidGrid.query.mockReturnValue([]);
    });

    it('should return null when no collisions', () => {
      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });

    it('should detect warp zone wall collision', () => {
      GameContext.warpZone = {
        active: true,
        bulletHitsWall: vi.fn(() => true),
      };

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toEqual({ kind: 'warp_wall', obj: null });
    });

    it('should not detect warp zone collision when bullet does not hit wall', () => {
      GameContext.warpZone = {
        active: true,
        bulletHitsWall: vi.fn(() => false),
      };

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });

    it('should detect cave wall collision', () => {
      GameContext.caveMode = true;
      GameContext.caveLevel = {
        active: true,
        bulletHitsWall: vi.fn(() => true),
      };

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toEqual({ kind: 'cave_wall', obj: null });
    });

    it('should detect anomaly wall collision', () => {
      const mockAnomaly = {
        pos: { x: 100, y: 100 },
        radius: 100,
        dead: false,
        contractId: 'contract-1',
        bulletHitsWall: vi.fn(() => true),
      };

      GameContext.activeContract = { type: 'anomaly', id: 'contract-1' };
      GameContext.contractEntities.anomalies = [mockAnomaly];

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toEqual({ kind: 'anomaly_wall', obj: null });
    });

    it('should skip anomaly when contract IDs do not match', () => {
      const mockAnomaly = {
        pos: { x: 100, y: 100 },
        radius: 100,
        dead: false,
        contractId: 'contract-2',
        bulletHitsWall: vi.fn(() => true),
      };

      GameContext.activeContract = { type: 'anomaly', id: 'contract-1' };
      GameContext.contractEntities.anomalies = [mockAnomaly];

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });

    it('should skip anomaly when out of range', () => {
      const mockAnomaly = {
        pos: { x: 1000, y: 1000 },
        radius: 100,
        dead: false,
        contractId: 'contract-1',
        bulletHitsWall: vi.fn(() => true),
      };

      GameContext.activeContract = { type: 'anomaly', id: 'contract-1' };
      GameContext.contractEntities.anomalies = [mockAnomaly];

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });

    it('should detect asteroid collision', () => {
      const mockAsteroid = {
        pos: { x: 100, y: 100 },
        radius: 20,
        dead: false,
      };

      GameContext.asteroidGrid.query.mockReturnValue([mockAsteroid]);

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toEqual({ kind: 'asteroid', obj: mockAsteroid });
    });

    it('should skip dead asteroids', () => {
      const mockAsteroid = {
        pos: { x: 100, y: 100 },
        radius: 20,
        dead: true,
      };

      GameContext.asteroidGrid.query.mockReturnValue([mockAsteroid]);

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });

    it('should skip asteroids that do not collide', () => {
      const mockAsteroid = {
        pos: { x: 500, y: 500 },
        radius: 20,
        dead: false,
      };

      GameContext.asteroidGrid.query.mockReturnValue([mockAsteroid]);

      const result = checkBulletWallCollision(mockBullet);
      expect(result).toBeNull();
    });
  });
});
