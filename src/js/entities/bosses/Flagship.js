import { Cruiser } from "./Cruiser.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS } from "../../core/constants.js";
import { playSound } from "../../audio/audio-manager.js";
import { FlagshipGuidedMissile } from "../projectiles/FlagshipGuidedMissile.js";
import { Coin } from "../pickups/Coin.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { clearArrayWithPixiCleanup, pixiCleanupObject } from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _spawnLargeExplosion = null;
let _awardCoinsInstant = null;
let _awardNuggetsInstant = null;

export function registerFlagshipDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnLargeExplosion) _spawnLargeExplosion = deps.spawnLargeExplosion;
  if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
  if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class Flagship extends Cruiser {
  constructor(spawnAt = null) {
    super(Math.max(4, GameContext.cruiserEncounterCount));
    this.type = "flagship";
    this.isFlagship = true;
    this.despawnImmune = true;
    this.vulnerableDurationFrames = 30;

    this.cruiserHullScale = 8.8;
    this.gunboatScale = this.cruiserHullScale;
    this.radius = Math.round(22 * this.cruiserHullScale);
    this.shieldRadius = Math.round(34 * this.cruiserHullScale);
    this.innerShieldRadius = Math.round(28 * this.cruiserHullScale);

    if (spawnAt && typeof spawnAt.x === "number" && typeof spawnAt.y === "number") {
      this.pos.x = spawnAt.x;
      this.pos.y = spawnAt.y;
    } else if (GameContext.player && !GameContext.player.dead) {
      this.pos.x = GameContext.player.pos.x;
      this.pos.y = GameContext.player.pos.y - 2200;
    }

    const bonus = Math.max(0, GameContext.cruiserEncounterCount - 1);
    const baseHp = 260 + bonus * 35;
    this.hp = Math.round(baseHp * 1.25);
    this.maxHp = this.hp;

    this.shieldStrength = Math.max(3, Math.ceil((this.shieldStrength + 1) * 1.5));
    this.shieldSegments = new Array(14).fill(this.shieldStrength);
    this.innerShieldSegments = new Array(22).fill(this.shieldStrength);

    this.thrustPower = 0.36;
    this.maxSpeed = 5.4;
    this.baseGunboatRange = this.baseGunboatRange * 1.15;
    this.gunboatRange = this.baseGunboatRange;
    this.cruiserBaseDamage = Math.max(this.cruiserBaseDamage, 2 + Math.floor(bonus / 2));

    this.helperScale = 0.35;
    this.helperMax = 3;

    this.phaseSeq = [
      { name: "SALVO", duration: 70 },
      { name: "CURTAIN", duration: 85 },
      { name: "MINEFIELD", duration: 100 },
      { name: "SWEEP", duration: 80 },
      { name: "CHARGE", duration: 60 }
    ];
    this.phaseIndex = 0;
    this.phaseName = "INTRO";
    this.phaseTimer = 45;
    this.phaseTick = 0;

    this.guidedMissileCd = 105;
    this.guidedMissileInterval = 105;
    this.guidedMissileCap = 4;
  }

  update(deltaTime = SIM_STEP_MS) {
    super.update();
    if (this.dead) return;
    if (!GameContext.bossActive || GameContext.boss !== this) return;
    if (!GameContext.player || GameContext.player.dead) return;

    if (this.phaseName === "INTRO") return;

    this.guidedMissileCd--;
    if (this.guidedMissileCd > 0) return;

    const alive = GameContext.guidedMissiles.filter(m => m && !m.dead).length;
    if (alive >= this.guidedMissileCap) {
      this.guidedMissileCd = Math.max(30, Math.floor(this.guidedMissileInterval * 0.5));
      return;
    }

    GameContext.guidedMissiles.push(new FlagshipGuidedMissile(this));
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, "#fa0");
    playSound("heavy_shoot");
    this.guidedMissileCd = this.guidedMissileInterval;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    GameContext.bossKills++;
    if (this._pixiInnerGfx) {
      try {
        this._pixiInnerGfx.destroy(true);
      } catch (e) {}
      this._pixiInnerGfx = null;
    }
    if (this._pixiGfx) {
      try {
        this._pixiGfx.destroy(true);
      } catch (e) {}
      this._pixiGfx = null;
    }
    pixiCleanupObject(this);
    playSound("base_explode");

    if (_spawnLargeExplosion) _spawnLargeExplosion(this.pos.x, this.pos.y, 5.0);

    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 200, "#f0f");
    clearArrayWithPixiCleanup(GameContext.bossBombs);
    clearArrayWithPixiCleanup(GameContext.guidedMissiles);

    // Spawn coins: 50 coins * 10 value = 500 total
    const coinCount = 50;
    const coinValue = 10;
    for (let i = 0; i < coinCount; i++) {
      const coin = new Coin(this.pos.x, this.pos.y, coinValue);
      coin.vel.x = (Math.random() - 0.5) * 5;
      coin.vel.y = (Math.random() - 0.5) * 5;
      GameContext.coins.push(coin);
    }
    playSound("coin");
    // Award nuggets directly: 16 nuggets
    let nuggetCount = 16;
    // Bounty Hunter meta upgrade - bonus nuggets for boss kills
    if (
      GameContext.player &&
      GameContext.player.stats &&
      GameContext.player.stats.bountyBossBonus
    ) {
      nuggetCount += GameContext.player.stats.bountyBossBonus;
    }
    if (_awardNuggetsInstant) _awardNuggetsInstant(nuggetCount, { noSound: false, sound: "coin" });

    GameContext.bossActive = false;
    GameContext.bossArena.active = false;
    GameContext.bossArena.growing = false;
    GameContext.boss = null;

    showOverlayMessage("FLAGSHIP DESTROYED - WARP CORE CHARGING", "#0ff", 3500, 2);
  }
}
