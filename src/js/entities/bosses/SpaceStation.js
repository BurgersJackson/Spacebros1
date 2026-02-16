import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, ZOOM_LEVEL } from "../../core/constants.js";
import { playSound, setMusicMode, musicEnabled } from "../../audio/audio-manager.js";
import { Bullet } from "../projectiles/Bullet.js";
import { ClusterBomb } from "../projectiles/ClusterBomb.js";
import { CruiserMineBomb } from "../projectiles/CruiserMineBomb.js";
import { Enemy } from "../enemies/Enemy.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import {
  pixiBossLayer,
  pixiVectorLayer,
  pixiTextures,
  pixiTextureAnchors,
  pixiCleanupObject,
  getRenderAlpha
} from "../../rendering/pixi-context.js";

let _spawnParticles = null;
let _spawnBarrelSmoke = null;
let _updateHealthUI = null;
let _killPlayer = null;
let _closestPointOnSegment = null;
let _canvas = null;

export function registerSpaceStationDependencies(deps) {
  if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
  if (deps.spawnBarrelSmoke) _spawnBarrelSmoke = deps.spawnBarrelSmoke;
  if (deps.updateHealthUI) _updateHealthUI = deps.updateHealthUI;
  if (deps.killPlayer) _killPlayer = deps.killPlayer;
  if (deps.closestPointOnSegment) _closestPointOnSegment = deps.closestPointOnSegment;
  if (deps.canvas) _canvas = deps.canvas;
}

export class SpaceStation extends Entity {
  constructor() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6000;
    super(
      GameContext.player.pos.x + Math.cos(angle) * dist,
      GameContext.player.pos.y + Math.sin(angle) * dist
    );
    this.fixedPos = { x: this.pos.x, y: this.pos.y };

    const names = [
      "OMEGA",
      "NOVA",
      "TITAN",
      "ORION",
      "PHOENIX",
      "AURORA",
      "ASTRA",
      "ZEUS",
      "HELIOS",
      "HYPERION"
    ];
    const suffix = Math.floor(Math.random() * 999);
    this.displayName = names[Math.floor(Math.random() * names.length)] + "-" + suffix;

    this.radius = Math.floor(520 * 0.65);
    this.hp = 12500;
    this.maxHp = 12500;

    this.shieldRadius = Math.floor(600 * 0.65);
    this.innerShieldRadius = Math.floor(560 * 0.65);

    this.shieldSegments = new Array(36).fill(100);
    this.innerShieldSegments = new Array(32).fill(100);

    this.shieldRotation = 0;
    this.innerShieldRotation = 0;
    this.shieldRotationSpeed = 0.0105; // 50% faster than hull (0.007 * 1.5)
    this.shieldRegenTimer = 0;
    this.shieldRegenInterval = 1000; // 1 shard every 1 second

    this.turretReload = 250;
    this.defenderSpawnTimer = 0;
    this.minefieldTimer = 2500;
    this.clusterBombTimer = 3200;
    this.clusterBombInterval = 3200;
    this.shieldsDirty = true;
    this._pixiInnerGfx = null;
    this._lastShieldRedrawAt = 0; // Throttle shield redraws
    this._shieldRedrawInterval = 50; // Min ms between redraws

    this.laserCooldown = 560;
    this.laserCharge = 0;
    this.laserChargeTotal = 70;
    this.laserDelay = 0;
    this.laserDelayTotal = 15;
    this.laserFire = 0;
    this.laserFireTotal = 5;
    this.laserAngle = 0;
    this.laserLen = 5200;
    this.laserWidth = 44;
    this.laserHitThisShot = false;
    this.t = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.rotationSpeed = 0.007;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (this.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    this.angle += this.rotationSpeed * dtFactor;
    this.shieldRotation += this.shieldRotationSpeed * dtFactor;
    this.innerShieldRotation += this.shieldRotationSpeed * dtFactor;

    this.shieldRegenTimer += deltaTime;
    if (this.shieldRegenTimer >= this.shieldRegenInterval) {
      this.shieldRegenTimer = 0;
      const maxSeg = 100;
      let healed = false;
      for (let i = 0; i < this.shieldSegments.length && !healed; i++) {
        if (this.shieldSegments[i] < maxSeg) {
          this.shieldSegments[i] = Math.min(maxSeg, this.shieldSegments[i] + maxSeg);
          this.shieldsDirty = true;
          healed = true;
        }
      }
      if (!healed && this.innerShieldSegments) {
        for (let i = 0; i < this.innerShieldSegments.length && !healed; i++) {
          if (this.innerShieldSegments[i] < maxSeg) {
            this.innerShieldSegments[i] = Math.min(maxSeg, this.innerShieldSegments[i] + maxSeg);
            this.shieldsDirty = true;
            healed = true;
          }
        }
      }
    }

    if (this.fixedPos) {
      this.pos.x = this.fixedPos.x;
      this.pos.y = this.fixedPos.y;
      if (this.prevPos) {
        this.prevPos.x = this.fixedPos.x;
        this.prevPos.y = this.fixedPos.y;
      }
      this.vel.set(0, 0);
      this.angleVel = 0;
    }

    if (GameContext.player && !GameContext.player.dead) {
      const dist = Math.hypot(
        GameContext.player.pos.x - this.pos.x,
        GameContext.player.pos.y - this.pos.y
      );
      if (dist < 2800) {
        this.turretReload -= deltaTime;
        if (this.turretReload <= 0) {
          this.fireTurrets();
          this.turretReload = 250;
        }

        this.minefieldTimer -= deltaTime;
        if (this.minefieldTimer <= 0) {
          this.deployBombs();
          this.minefieldTimer = 2500;
        }

        this.clusterBombTimer -= deltaTime;
        if (this.clusterBombTimer <= 0) {
          this.fireClusterBomb();
          this.clusterBombTimer = this.clusterBombInterval;
        }

        const applyBeamDamageToPlayer = amount => {
          if (!GameContext.player || GameContext.player.dead) return;
          if (GameContext.player.invulnerable > 0) return;
          let remaining = Math.max(0, Math.ceil(amount));
          if (
            GameContext.player.outerShieldSegments &&
            GameContext.player.outerShieldSegments.length > 0
          ) {
            for (
              let i = 0;
              i < GameContext.player.outerShieldSegments.length && remaining > 0;
              i++
            ) {
              if (GameContext.player.outerShieldSegments[i] > 0) {
                GameContext.player.outerShieldSegments[i] = 0;
                remaining -= 1;
              }
            }
          }
          if (GameContext.player.shieldSegments && GameContext.player.shieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.shieldSegments.length && remaining > 0; i++) {
              const absorb = Math.min(remaining, GameContext.player.shieldSegments[i]);
              GameContext.player.shieldSegments[i] -= absorb;
              remaining -= absorb;
            }
          }
          if (remaining > 0) {
            GameContext.player.hp -= remaining;
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 14, "#f00");
            playSound("hit");
            if (_updateHealthUI) _updateHealthUI();
            if (GameContext.player.hp <= 0 && _killPlayer) _killPlayer();
          } else {
            if (_spawnParticles)
              _spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, "#ff0");
            playSound("shield_hit");
          }
          GameContext.player.invulnerable = 0;
        };

        if (this.laserFire > 0) {
          this.laserFire--;
          if (!this.laserHitThisShot) {
            const ex = this.pos.x + Math.cos(this.laserAngle) * this.laserLen;
            const ey = this.pos.y + Math.sin(this.laserAngle) * this.laserLen;
            const cp = _closestPointOnSegment
              ? _closestPointOnSegment(
                  GameContext.player.pos.x,
                  GameContext.player.pos.y,
                  this.pos.x,
                  this.pos.y,
                  ex,
                  ey
                )
              : { x: this.pos.x, y: this.pos.y };
            const d = Math.hypot(GameContext.player.pos.x - cp.x, GameContext.player.pos.y - cp.y);
            const hitDist = this.laserWidth * 0.5 + GameContext.player.radius * 0.55;
            if (d <= hitDist) {
              this.laserHitThisShot = true;
              const dmg = 8;
              applyBeamDamageToPlayer(dmg);
              GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 14);
              GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 14);
            }
          }
        } else if (this.laserDelay > 0) {
          this.laserDelay--;
          if (this.laserDelay === 0) {
            this.laserFire = this.laserFireTotal;
            this.laserHitThisShot = false;
            playSound("heavy_shoot");
            if (_spawnParticles) {
              _spawnParticles(
                this.pos.x + Math.cos(this.laserAngle) * (this.radius + 10),
                this.pos.y + Math.sin(this.laserAngle) * (this.radius + 10),
                18,
                "#ff0"
              );
            }
          }
        } else if (this.laserCharge > 0) {
          this.laserCharge--;
          if (this.laserCharge === 0) {
            this.laserDelay = this.laserDelayTotal;
          }
        } else {
          this.laserCooldown--;
          const cd = 560;
          const wantCharge = 70;
          if (this.laserCooldown <= 0 && dist < 3200 && dist > 450) {
            this.laserAngle = Math.atan2(
              GameContext.player.pos.y - this.pos.y,
              GameContext.player.pos.x - this.pos.x
            );
            this.laserChargeTotal = wantCharge;
            this.laserCharge = this.laserChargeTotal;
            this.laserDelay = 0;
            this.laserFireTotal = 10;
            this.laserFire = 0;
            this.laserCooldown = cd;
            this.laserHitThisShot = false;
            showOverlayMessage("STATION LASER LOCK", "#ff0", 900, 2);
          }
        }

        this.manageDefenders(deltaTime);
      }
    }
  }

  manageDefenders(deltaTime = 16.67) {
    let myDefenderCount = 0;
    for (let i = 0; i < GameContext.enemies.length; i++) {
      const e = GameContext.enemies[i];
      if (e && !e.dead && e.assignedBase === this) myDefenderCount++;
    }
    if (myDefenderCount < 4) {
      if (this.defenderSpawnTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const d = this.radius + 70;
        const sx = this.pos.x + Math.cos(angle) * d;
        const sy = this.pos.y + Math.sin(angle) * d;
        GameContext.enemies.push(new Enemy("defender", { x: sx, y: sy }, this));
        if (_spawnParticles) _spawnParticles(sx, sy, 15, "#0f0");
        this.defenderSpawnTimer = 180;
      } else {
        this.defenderSpawnTimer -= deltaTime / 16.67;
      }
    }
  }

  fireTurrets() {
    const offsets = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (let i = 0; i < offsets.length; i++) {
      const angleOffset = offsets[i] + this.shieldRotation;
      const tx = this.pos.x + Math.cos(angleOffset) * (this.radius * 0.75);
      const ty = this.pos.y + Math.sin(angleOffset) * (this.radius * 0.75);
      const angle = Math.atan2(GameContext.player.pos.y - ty, GameContext.player.pos.x - tx);
      const b = new Bullet(tx, ty, angle, 14.96, {
        owner: "enemy",
        damage: 2,
        radius: 6,
        color: "#f80"
      });
      b.owner = this;
      GameContext.bullets.push(b);
      if (_spawnBarrelSmoke) _spawnBarrelSmoke(tx, ty, angle);
    }
    playSound("rapid_shoot");
  }

  deployBombs() {
    const bombCount = 8;
    for (let i = 0; i < bombCount; i++) {
      const angle = (i / bombCount) * Math.PI * 2;
      const maxTravel = 600 + Math.random() * 300;
      const dmg = 5;
      const blastRadius = 350;
      const bomb = new CruiserMineBomb(this, angle, maxTravel, dmg, blastRadius);
      GameContext.bossBombs.push(bomb);
    }
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 20, "#f00");
    playSound("boss_spawn");
  }

  fireClusterBomb() {
    if (!GameContext.player || GameContext.player.dead) return;
    const angle = Math.atan2(
      GameContext.player.pos.y - this.pos.y,
      GameContext.player.pos.x - this.pos.x
    );
    const bomb = new ClusterBomb(this.pos.x, this.pos.y, angle, this, 4, 350);
    bomb.damage = 8;
    GameContext.bullets.push(bomb);
    if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 12, "#f80");
    playSound("rapid_shoot");
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    GameContext.bossKills++;
    // Clean up PixiJS graphics
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
    if (this._pixiContainer) {
      try {
        this._pixiContainer.destroy({ children: true });
      } catch (e) {}
      this._pixiContainer = null;
    }
    if (this._pixiTurrets) {
      for (let i = 0; i < this._pixiTurrets.length; i++) {
        if (this._pixiTurrets[i]) {
          try {
            this._pixiTurrets[i].destroy();
          } catch (e) {}
        }
      }
      this._pixiTurrets = null;
    }
    if (this._pixiHullSpr) {
      try {
        this._pixiHullSpr.destroy();
      } catch (e) {}
      this._pixiHullSpr = null;
    }
    if (this._pixiNameText) {
      try {
        this._pixiNameText.destroy();
      } catch (e) {}
      this._pixiNameText = null;
    }
    pixiCleanupObject(this);
  }

  draw(ctx) {
    if (this.dead) {
      pixiCleanupObject(this);
      if (this._pixiInnerGfx) {
        try {
          this._pixiInnerGfx.destroy(true);
        } catch (e) {}
        this._pixiInnerGfx = null;
      }
      return;
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.restore();

    if (
      (this.laserCharge && this.laserCharge > 0) ||
      (this.laserDelay && this.laserDelay > 0) ||
      (this.laserFire && this.laserFire > 0)
    ) {
      const a = this.laserAngle;
      const ex = Math.cos(a) * this.laserLen;
      const ey = Math.sin(a) * this.laserLen;
      const charging = this.laserCharge && this.laserCharge > 0;
      const locking = this.laserDelay && this.laserDelay > 0;
      const firing = this.laserFire && this.laserFire > 0;
      const pct = charging ? 1 - this.laserCharge / (this.laserChargeTotal || 1) : 1;
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      const z = GameContext.currentZoom || ZOOM_LEVEL;
      ctx.lineWidth = this.laserWidth / z;
      if (charging || locking) {
        ctx.setLineDash([12 / z, 10 / z]);
        const lockPulse = locking ? 0.55 + 0.35 * Math.sin(this.t * 0.35) : 1;
        ctx.strokeStyle = `rgba(255, 220, 0, ${Math.min(0.75, (0.1 + pct * 0.35) * lockPulse + (locking ? 0.2 : 0))})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ff0";
      } else if (firing) {
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255, 240, 0, 0.95)";
        ctx.shadowBlur = 28;
        ctx.shadowColor = "#ff0";
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (firing) {
        ctx.fillStyle = "rgba(255, 240, 0, 0.85)";
        ctx.beginPath();
        ctx.arc(ex, ey, 10 / z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (pixiBossLayer && pixiTextures && pixiTextures.station_hull) {
      let container = this._pixiContainer;
      if (!container) {
        container = new PIXI.Container();
        this._pixiContainer = container;
        pixiBossLayer.addChild(container);

        const hull = new PIXI.Sprite(pixiTextures.station_hull);
        const ha = pixiTextureAnchors.station_hull || { x: 0.5, y: 0.5 };
        hull.anchor.set(ha && ha.x != null ? ha.x : 0.5, ha && ha.y != null ? ha.y : 0.5);
        container.addChild(hull);
        this._pixiHullSpr = hull;
      } else if (!container.parent) {
        pixiBossLayer.addChild(container);
      }

      container.visible = true;
      const rPos = this.getRenderPos(getRenderAlpha());
      container.position.set(rPos.x, rPos.y);
      container.rotation = this.angle;

      const now =
        typeof GameContext.frameNow === "number" && GameContext.frameNow > 0
          ? GameContext.frameNow
          : Date.now();
      const hullScale =
        this.visualRadius && isFinite(this.visualRadius) ? this.visualRadius / 340 : 1;
      if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

      const offsets = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      const turrets = this._pixiTurrets || [];
      for (let i = 0; i < turrets.length; i++) {
        const t = turrets[i];
        if (!t) continue;
        const angleOffset = offsets[i] + (this.shieldRotation || 0);
        const tx = Math.cos(angleOffset) * (this.radius * 0.75);
        const ty = Math.sin(angleOffset) * (this.radius * 0.75);
        t.position.set(tx, ty);
        let aim = angleOffset;
        if (GameContext.player && !GameContext.player.dead) {
          aim = Math.atan2(
            GameContext.player.pos.y - (this.pos.y + ty),
            GameContext.player.pos.x - (this.pos.x + tx)
          );
        }
        t.rotation = aim;
      }

      if (pixiVectorLayer) {
        const hasOuter = this.shieldSegments && this.shieldSegments.length > 0;
        const hasInner = this.innerShieldSegments && this.innerShieldSegments.length > 0;
        const needs = !!(hasOuter || hasInner);

        if (needs) {
          let gfx = this._pixiGfx;
          if (hasOuter) {
            if (!gfx) {
              gfx = new PIXI.Graphics();
              pixiVectorLayer.addChild(gfx);
              this._pixiGfx = gfx;
              this.shieldsDirty = true;
            } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

            gfx.position.set(rPos.x, rPos.y);
            gfx.rotation = this.shieldRotation || 0;
          } else if (gfx) {
            try {
              gfx.destroy(true);
            } catch (e) {}
            this._pixiGfx = null;
            gfx = null;
          }

          let innerGfx = this._pixiInnerGfx;
          if (hasInner) {
            if (!innerGfx) {
              innerGfx = new PIXI.Graphics();
              pixiVectorLayer.addChild(innerGfx);
              this._pixiInnerGfx = innerGfx;
              this.shieldsDirty = true;
            } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

            innerGfx.position.set(rPos.x, rPos.y);
            innerGfx.rotation = this.innerShieldRotation || 0;
          } else if (innerGfx) {
            try {
              innerGfx.destroy(true);
            } catch (e) {}
            this._pixiInnerGfx = null;
            innerGfx = null;
          }

          if (this.shieldsDirty) {
            // Throttle shield redraws to avoid redrawing every frame during rapid hits
            const canRedraw = now - this._lastShieldRedrawAt >= this._shieldRedrawInterval;
            if (canRedraw) {
              this._lastShieldRedrawAt = now;
              const drawRing = (graphics, segments, radius, color) => {
                if (!segments || segments.length === 0) return;
                graphics.clear();
                const count = segments.length;
                const arcLen = (Math.PI * 2) / count;
                graphics.lineStyle(8, color, 0.8);
                for (let i = 0; i < count; i++) {
                  if (segments[i] > 0) {
                    const a0 = i * arcLen + 0.02;
                    const a1 = (i + 1) * arcLen - 0.02;
                    graphics.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
                    graphics.arc(0, 0, radius, a0, a1);
                  }
                }
                graphics.endFill();
              };

              if (gfx && hasOuter) drawRing(gfx, this.shieldSegments, this.shieldRadius, 0x00ffff);
              if (innerGfx && hasInner)
                drawRing(innerGfx, this.innerShieldSegments, this.innerShieldRadius, 0xff00ff);

              this.shieldsDirty = false;
            }
          }
        } else {
          if (this._pixiGfx) {
            try {
              this._pixiGfx.destroy(true);
            } catch (e) {}
            this._pixiGfx = null;
          }
          if (this._pixiInnerGfx) {
            try {
              this._pixiInnerGfx.destroy(true);
            } catch (e) {}
            this._pixiInnerGfx = null;
          }
        }

        if (this.displayName) {
          let t = this._pixiNameText;
          if (!t) {
            t = new PIXI.Text(this.displayName, {
              fontFamily: "Courier New",
              fontSize: 18,
              fontWeight: "bold",
              fill: 0x00ffff
            });
            t.anchor.set(0.5);
            t.resolution = 2;
            pixiVectorLayer.addChild(t);
            this._pixiNameText = t;
          } else if (t.text !== this.displayName) {
            t.text = this.displayName;
          }
          if (!t.parent) pixiVectorLayer.addChild(t);
          t.visible = true;
          t.position.set(rPos.x, rPos.y - this.radius - 20);
        } else if (this._pixiNameText) {
          try {
            this._pixiNameText.destroy(true);
          } catch (e) {}
          this._pixiNameText = null;
        }
      }

      return;
    }

    ctx.restore();
  }
}
