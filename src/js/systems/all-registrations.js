// ============================================================================
// ALL REGISTRATIONS
// This file contains all dependency registration calls extracted from main.js
// To consolidate the massive registration block into a single module
// ============================================================================

// This function receives ALL the registration functions and their dependencies
// as a single large object, then calls each registration in turn
export function registerAllEntityDependencies(r) {
  // Pixi Cleanup
  r.registerPixiCleanupDependencies(r.pixiCleanupDeps);
  r.setPixiCleanupObject(r.pixiCleanupObject);

  // Settings Manager
  r.registerSettingsManagerDependencies(r.settingsManagerDeps);

  // World Setup
  r.registerWorldSetupDependencies(r.worldSetupDeps);

  // Mini Event
  r.registerMiniEventDependencies(r.miniEventDeps);

  // Game Flow
  r.registerGameFlowDependencies(r.gameFlowDeps);
  r.initGameFlow();

  // World Helpers
  r.registerWorldHelperDependencies(r.worldHelperDeps);

  // Sector Flow
  r.registerSectorFlowDependencies(r.sectorFlowDeps);

  // Input
  r.registerInputDependencies(r.inputDeps);
  r.initInputListeners();

  // HUD
  r.registerHudDependencies(r.hudDeps);

  // Collision
  r.registerCollisionDependencies(r.collisionDeps);

  // Game Loop
  r.registerGameLoopDependencies(r.gameLoopDeps);
  r.registerGameLoopLogicDependencies(r.gameLoopLogicDeps);

  // Entity registrations
  r.registerAsteroidDependencies(r.asteroidDeps);
  r.registerPoiDependencies(r.poiDeps);
  r.registerMiniEventDefendCacheDependencies(r.miniEventDefendCacheDeps);
  r.registerShootingStarDependencies(r.shootingStarDeps);
  r.registerSpawnManagerDependencies(r.spawnManagerDeps);
  r.registerEnemyDependencies(r.enemyDeps);
  r.registerPinwheelDependencies(r.pinwheelDeps);
  r.registerCruiserDependencies(r.cruiserDeps);
  r.registerFlagshipDependencies(r.flagshipDeps);
  r.registerSuperFlagshipDependencies(r.superFlagshipDeps);
  r.registerShockwaveDependencies(r.shockwaveDeps);
  r.registerBulletDependencies(r.bulletDeps);
  r.registerCruiserMineBombDependencies(r.cruiserMineBombDeps);
  r.registerFlagshipGuidedMissileDependencies(r.flagshipGuidedMissileDeps);
  r.registerClusterBombDependencies(r.clusterBombDeps);
  r.registerNapalmZoneDependencies(r.napalmZoneDeps);
  r.Cave.registerCaveDependencies(r.caveDeps);
  r.registerWarpBioPodDependencies(r.warpBioPodDeps);
  r.registerDungeonDroneDependencies(r.dungeonDroneDeps);
  r.registerWarpShieldDroneDependencies(r.warpShieldDroneDeps);
  r.registerWarpSentinelBossDependencies(r.warpSentinelBossDeps);
  r.registerSpaceStationDependencies(r.spaceStationDeps);
  r.registerDestroyerDependencies(r.destroyerDeps);
  r.registerDestroyer2Dependencies(r.destroyer2Deps);
  r.registerFinalBossDependencies(r.finalBossDeps);
  r.registerNecroticHiveDependencies(r.necroticHiveDeps);
  r.registerCerebralPsionDependencies(r.cerebralPsionDeps);
  r.registerFleshforgeDependencies(r.fleshforgeDeps);
  r.registerVortexMatriarchDependencies(r.vortexMatriarchDeps);
  r.registerChitinusPrimeDependencies(r.chitinusPrimeDeps);
  r.registerPsyLichDependencies(r.psyLichDeps);
  r.registerDroneDependencies(r.droneDeps);
  r.registerContractBeaconDependencies(r.contractBeaconDeps);
  r.registerGateRingDependencies(r.gateRingDeps);
  r.registerWallTurretDependencies(r.wallTurretDeps);
  r.registerWarpMazeZoneDependencies(r.warpMazeZoneDeps);
  r.registerVerticalScrollingZoneDependencies(r.verticalScrollingZoneDeps);
  r.registerDungeon1ZoneDependencies(r.dungeon1ZoneDeps);
  r.registerRadiationStormDependencies(r.radiationStormDeps);
  r.registerAnomalyZoneDependencies(r.anomalyZoneDeps);
  r.registerSpaceshipDependencies(r.spaceshipDeps);

  // Menu
  r.registerMenuDependencies(r.menuDeps);
  r.initMenuUi();
  r.initSettingsMenu();

  // Game Helpers
  r.registerGameHelperDependencies(r.gameHelperDeps);

  // Debug Spawn
  r.registerDebugSpawnDependencies(r.debugSpawnDeps);
  r.initDebugKeyboardShortcuts();
}
