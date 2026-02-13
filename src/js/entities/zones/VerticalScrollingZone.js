import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { playSound, setMusicMode, musicEnabled } from "../../audio/audio-manager.js";
import { Enemy } from "../enemies/Enemy.js";
import { Gunboat } from "../enemies/Gunboat.js";
import { Pinwheel } from "../enemies/Pinwheel.js";
import {
  CavePinwheel1,
  CavePinwheel2,
  CavePinwheel3,
  CaveGunboat1,
  CaveGunboat2
} from "../cave/index.js";
import { Destroyer } from "../bosses/Destroyer.js";
import { pixiCleanupObject } from "../../utils/cleanup-utils.js";

let _clearArrayWithPixiCleanup = null;
let _filterArrayWithPixiCleanup = null;

export function registerVerticalScrollingZoneDependencies(deps) {
  if (deps.clearArrayWithPixiCleanup) _clearArrayWithPixiCleanup = deps.clearArrayWithPixiCleanup;
  if (deps.filterArrayWithPixiCleanup)
    _filterArrayWithPixiCleanup = deps.filterArrayWithPixiCleanup;
}

export class VerticalScrollingZone extends Entity {
  constructor(x, y) {
    super(x, y);
    this.active = true;
    this.state = "scrolling"; // 'scrolling' | 'boss_intro' | 'boss_battle' | 'warp_out'

    // Scrolling parameters
    this.scrollSpeed = 2.0; // pixels per frame (scaled by dtFactor) - used for background/asteroid movement
    this.scrollProgress = 0; // static camera position (doesn't change)
    this.scrollDuration = 300000; // 5 minutes in milliseconds
    this.startTime = Date.now();
    this.elapsedScrollDistance = 0; // Track total distance scrolled for timing purposes

    // Wave system
    this.currentWave = 0;
    this.waveTimer = 0;
    this.waveInterval = 8000; // 8 seconds between waves (scaled by dtFactor)
    this.baseWaveDifficulty = 1.0;
    this.escalationRate = 0.15; // difficulty increase per wave
    this.randomVariation = 0.3; // ±30% variation

    // Boss state
    this.bossSpawned = false;
    this.bossIntroAt = null;
    this.bossIntroLastSec = null;

    // Warp out
    this.warpCountdown = 0;
    this.warpCountdownAt = null;
    this.warpCountdownLastSec = null;

    // Viewport dimensions (locked to 1920x1080)
    this.viewportWidth = 1920;
    this.viewportHeight = 1080;

    // Level center (camera will be centered here)
    this.levelCenterX = 0;
    this.levelCenterY = 0;

    // Boss spawn position (above viewport initially)
    this.bossSpawnY = -2000;
  }

  /**
   * Get wave difficulty with escalation and randomness
   */
  getWaveDifficulty() {
    const base = this.baseWaveDifficulty + this.currentWave * this.escalationRate;
    const variation = (Math.random() - 0.5) * 2 * this.randomVariation; // ±30%
    return Math.max(0.5, base * (1 + variation)); // Ensure minimum 50% difficulty
  }

  /**
   * Spawn a wave of enemies from the top of the screen
   */
  spawnWave() {
    const difficulty = this.getWaveDifficulty();
    const waveSize = Math.floor(2 + difficulty * 1.5 + Math.random() * 2); // 2-5 enemies based on difficulty (reduced)

    // Available enemy types with variety including pinwheels and cave variants
    const enemyTypes = [];

    // Always include basic enemies (30% of wave)
    for (let i = 0; i < Math.floor(waveSize * 0.3); i++) {
      enemyTypes.push("roamer");
    }

    // Add elite roamers based on difficulty (20% of wave)
    if (difficulty > 1.2) {
      for (let i = 0; i < Math.floor(waveSize * 0.2); i++) {
        enemyTypes.push("elite_roamer");
      }
    }

    // Add hunters based on difficulty (15% of wave)
    if (difficulty > 1.5) {
      for (let i = 0; i < Math.floor(waveSize * 0.15); i++) {
        enemyTypes.push("hunter");
      }
    }

    // Add defenders based on difficulty (10% of wave)
    if (difficulty > 1.8) {
      for (let i = 0; i < Math.floor(waveSize * 0.1); i++) {
        enemyTypes.push("defender");
      }
    }

    // Add gunboats for high difficulty (10% of wave)
    if (difficulty > 2.0) {
      for (let i = 0; i < Math.floor(waveSize * 0.1); i++) {
        enemyTypes.push("gunboat");
      }
    }

    // Add cave gunboats for very high difficulty (5% of wave)
    if (difficulty > 2.5) {
      for (let i = 0; i < Math.floor(waveSize * 0.05); i++) {
        enemyTypes.push("cave_gunboat1");
      }
      for (let i = 0; i < Math.floor(waveSize * 0.05); i++) {
        enemyTypes.push("cave_gunboat2");
      }
    }

    // Add pinwheels based on difficulty (10% of wave)
    if (difficulty > 1.5) {
      for (let i = 0; i < Math.floor(waveSize * 0.1); i++) {
        const pinwheelTypes = ["pinwheel_standard"];
        if (difficulty > 2.0) pinwheelTypes.push("pinwheel_rapid");
        if (difficulty > 2.5) pinwheelTypes.push("pinwheel_heavy");
        enemyTypes.push(pinwheelTypes[Math.floor(Math.random() * pinwheelTypes.length)]);
      }
    }

    // Add cave pinwheels for high difficulty (10% of wave)
    if (difficulty > 2.0) {
      for (let i = 0; i < Math.floor(waveSize * 0.1); i++) {
        const cavePinwheelTypes = ["cave_pinwheel1"];
        if (difficulty > 2.3) cavePinwheelTypes.push("cave_pinwheel2");
        if (difficulty > 2.6) cavePinwheelTypes.push("cave_pinwheel3");
        enemyTypes.push(cavePinwheelTypes[Math.floor(Math.random() * cavePinwheelTypes.length)]);
      }
    }

    // Fill remaining slots with roamers
    while (enemyTypes.length < waveSize) {
      enemyTypes.push("roamer");
    }

    // Shuffle and limit to waveSize
    const shuffled = enemyTypes.sort(() => Math.random() - 0.5).slice(0, waveSize);

    // Camera is static, so use fixed camera position
    // Spawn enemies above viewport (negative Y in world space)
    const z = GameContext.currentZoom || 0.4;
    const staticCamY = this.scrollProgress; // Static camera center Y
    const viewportTopY = staticCamY - this.viewportHeight / (2 * z); // Top of viewport
    const spawnY = viewportTopY - 400; // Spawn 400 pixels above viewport top (off screen)

    // Spawn enemies across the width of the screen
    for (let i = 0; i < shuffled.length; i++) {
      const type = shuffled[i];
      const spawnX = this.levelCenterX + (Math.random() - 0.5) * this.viewportWidth * 0.8; // Spread across 80% of width

      let enemy;
      if (type === "gunboat") {
        enemy = new Gunboat(spawnX, spawnY);
      } else if (type === "cave_gunboat1") {
        enemy = new CaveGunboat1(spawnX, spawnY);
      } else if (type === "cave_gunboat2") {
        enemy = new CaveGunboat2(spawnX, spawnY);
      } else if (type === "pinwheel_standard") {
        enemy = new Pinwheel(spawnX, spawnY, "standard");
        GameContext.pinwheels.push(enemy);
        enemy.despawnImmune = true;
        // Pinwheel spawns with defender escort
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else if (type === "pinwheel_rapid") {
        enemy = new Pinwheel(spawnX, spawnY, "rapid");
        GameContext.pinwheels.push(enemy);
        enemy.despawnImmune = true;
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else if (type === "pinwheel_heavy") {
        enemy = new Pinwheel(spawnX, spawnY, "heavy");
        GameContext.pinwheels.push(enemy);
        enemy.despawnImmune = true;
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else if (type === "cave_pinwheel1") {
        enemy = new CavePinwheel1(spawnX, spawnY);
        GameContext.cavePinwheels.push(enemy);
        enemy.despawnImmune = true;
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else if (type === "cave_pinwheel2") {
        enemy = new CavePinwheel2(spawnX, spawnY);
        GameContext.cavePinwheels.push(enemy);
        enemy.despawnImmune = true;
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else if (type === "cave_pinwheel3") {
        enemy = new CavePinwheel3(spawnX, spawnY);
        GameContext.cavePinwheels.push(enemy);
        enemy.despawnImmune = true;
        const da = Math.random() * Math.PI * 2;
        const defX = spawnX + Math.cos(da) * 150;
        const defY = spawnY + Math.sin(da) * 150;
        const defender = new Enemy("defender", { x: defX, y: defY }, enemy);
        defender.despawnImmune = true;
        GameContext.enemies.push(defender);
      } else {
        enemy = new Enemy(type, { x: spawnX, y: spawnY });
      }

      if (enemy) {
        enemy.despawnImmune = true; // Don't despawn when off screen
        if (type.startsWith("pinwheel") || type.startsWith("cave_pinwheel")) {
          // Already added to pinwheels array above
        } else {
          GameContext.enemies.push(enemy);
        }
      }
    }

    this.currentWave++;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (!this.active) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;

    const now = Date.now();
    const elapsed = now - this.startTime;

    // Track elapsed scroll distance for timing (camera stays static, only background/asteroids move)
    if (this.state === "scrolling" || this.state === "boss_intro" || this.state === "boss_battle") {
      // Track total distance scrolled (for timing boss spawn)
      this.elapsedScrollDistance += this.scrollSpeed * dtFactor;
      // Keep scrollProgress static (camera doesn't move)
      GameContext.scrollProgress = this.scrollProgress;
    }

    if (this.state === "scrolling") {
      // Spawn waves
      this.waveTimer -= dtFactor;
      if (this.waveTimer <= 0) {
        this.spawnWave();
        // Randomize next wave timing (10-15 seconds) - slower spawn rate
        this.waveTimer = 1000 + Math.random() * 500;
      }

      // Check if we've reached the boss (after 5 minutes of scrolling)
      if (this.elapsedScrollDistance >= (this.scrollSpeed * 60 * 5 * 1000) / 16.67) {
        // 5 minutes at scrollSpeed
        this.state = "boss_intro";
        this.bossIntroAt = Date.now() + 5000; // 5 second intro
        this.bossIntroLastSec = null;
        // Keep scrolling during boss fight
        showOverlayMessage("BOSS APPROACHING", "#f00", 3000);
      }
    }

    if (this.state === "boss_intro") {
      const remainingMs = (this.bossIntroAt || now) - now;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));
      if (this.bossIntroLastSec !== remainingSecs) {
        const el = document.getElementById("arena-countdown");
        if (el) {
          el.innerText = `BOSS INCOMING\n${remainingSecs}s`;
          el.style.display = "block";
          el.style.color = "#f00";
          el.style.textShadow = "0 0 24px #f00, 0 0 48px #f00";
          el.style.fontSize = remainingSecs <= 2 ? "44px" : "36px";
        }
        this.bossIntroLastSec = remainingSecs;
      }
      // Start boss music when entering boss_intro state
      if (!this.bossMusicStarted && musicEnabled) {
        setMusicMode("destroyer");
        this.bossMusicStarted = true;
      }
      if (remainingMs <= 0) {
        const el = document.getElementById("arena-countdown");
        if (el) el.style.display = "none";

        this.state = "boss_battle";
        this.spawnBoss();
      }
    }

    if (this.state === "boss_battle") {
      // Check if boss is defeated
      if (!GameContext.bossActive || !GameContext.boss || GameContext.boss.dead) {
        if (musicEnabled) setMusicMode("normal");
        this.state = "warp_out";
        this.warpCountdownAt = Date.now() + 10000; // 10 second countdown
        this.warpCountdownLastSec = null;
        showOverlayMessage("BOSS DEFEATED - WARPING OUT IN 10s", "#0ff", 10000);
      }
    }

    if (this.state === "warp_out") {
      const remainingMs = (this.warpCountdownAt || now) - now;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));
      if (this.warpCountdownLastSec !== remainingSecs) {
        const el = document.getElementById("arena-countdown");
        if (el) {
          el.innerText = `WARPING OUT\n${remainingSecs}s`;
          el.style.display = "block";
          el.style.color = "#0ff";
          el.style.textShadow = "0 0 24px #0ff, 0 0 48px #0ff";
          el.style.fontSize = remainingSecs <= 3 ? "44px" : "36px";
        }
        this.warpCountdownLastSec = remainingSecs;
      }
      if (remainingMs <= 0) {
        const el = document.getElementById("arena-countdown");
        if (el) el.style.display = "none";
        this.exitZone();
      }
    }
  }

  /**
   * Spawn the static Destroyer boss
   */
  spawnBoss() {
    // Clear existing enemies
    if (_clearArrayWithPixiCleanup) {
      _clearArrayWithPixiCleanup(GameContext.enemies);
      _clearArrayWithPixiCleanup(GameContext.bullets);
      _clearArrayWithPixiCleanup(GameContext.bossBombs);
    }

    // Spawn boss at center of screen, above viewport initially
    // Camera is static, so use fixed camera position
    const z = GameContext.currentZoom || 0.4;
    const bossX = this.levelCenterX;
    const staticCamY = this.scrollProgress; // Static camera center Y
    const viewportCenterY = staticCamY; // Camera center Y
    const bossY = staticCamY - this.viewportHeight / (2 * z) - 600; // Start above viewport

    // Create Destroyer in static mode
    GameContext.boss = new Destroyer();
    GameContext.boss.pos.x = bossX;
    GameContext.boss.pos.y = bossY;
    GameContext.boss.angle = Math.PI / 2; // Face downward
    GameContext.boss.vel.x = 0;
    GameContext.boss.vel.y = 0;
    GameContext.boss.staticMode = true; // Flag for static mode

    // Move boss into view - position it in the upper center of viewport
    const targetY = viewportCenterY - this.viewportHeight / (4 * z); // Upper center of viewport
    const moveSpeed = (targetY - bossY) / 120; // 2 seconds at 60fps

    // Store move target
    GameContext.boss._moveTargetY = targetY;
    GameContext.boss._moveSpeed = moveSpeed;

    GameContext.bossActive = true;
    this.bossSpawned = true;

    showOverlayMessage("DESTROYER ENGAGED", "#f00", 3000, 3);
    playSound("boss_spawn");
  }

  /**
   * Exit the vertical scrolling zone
   */
  exitZone() {
    this.active = false;
    GameContext.verticalScrollingMode = false;
    GameContext.verticalScrollingZone = null;
    GameContext.scrollProgress = 0;
    GameContext.scrollSpeed = 2.0;

    // Clean up boss
    if (GameContext.boss) {
      pixiCleanupObject(GameContext.boss);
      GameContext.boss = null;
    }
    GameContext.bossActive = false;

    // Return player to normal mode
    if (GameContext.player) {
      // Player rotation will be unlocked automatically when verticalScrollingMode is false
    }

    // Return to normal game (could spawn player back in normal space)
    showOverlayMessage("RETURNED TO SECTOR", "#0ff", 3000);
  }

  draw(ctx) {
    // Zone doesn't need visual representation
    return;
  }

  /**
   * Clean up all entities and resources
   */
  cleanup() {
    this.active = false;
  }
}
