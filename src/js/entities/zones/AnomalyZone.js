import { Entity } from "../Entity.js";
import { GameContext } from "../../core/game-context.js";
import { SIM_STEP_MS, ZOOM_LEVEL } from "../../core/constants.js";
import { showOverlayMessage } from "../../utils/ui-helpers.js";
import { Enemy } from "../enemies/Enemy.js";
import { WallTurret } from "../support/WallTurret.js";
import { pixiVectorLayer, pixiCleanupObject } from "../../rendering/pixi-context.js";

let _resolveCircleSegment = null;
let _closestPointOnSegment = null;
let _completeContract = null;
let _ExplorationCache = null;

export function registerAnomalyZoneDependencies(deps) {
  if (deps.resolveCircleSegment) _resolveCircleSegment = deps.resolveCircleSegment;
  if (deps.closestPointOnSegment) _closestPointOnSegment = deps.closestPointOnSegment;
  if (deps.completeContract) _completeContract = deps.completeContract;
  if (deps.ExplorationCache) _ExplorationCache = deps.ExplorationCache;
}

export class AnomalyZone extends Entity {
  constructor(x, y, contractId = null) {
    super(x, y);
    this.contractId = contractId;
    this.radius = 2400; // 25% smaller
    this.t = 0;
    this.generated = false;
    this.defendersSpawned = false;
    this.coreRadius = 195;
    this.entryAngle = Math.random() * Math.PI * 2;
    this.segments = []; // 1px line walls (like warp maze)
    this.shieldsDirty = true;
    this._pixiGfx = null;
    this._pixiCoreGfx = null;
    this._pixiOuterGfx = null;
    this._pixiCoreText = null;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    pixiCleanupObject(this);
  }

  generateMaze() {
    if (this.generated) return;
    this.generated = true;
    // Concentric 1px line rings (warp-maze style). Each ring has intentional gap(s).
    const entry = this.entryAngle;
    const rings = [
      // Path widths doubled to make navigation less punishing.
      { r: 825, gap: entry + Math.PI, width: 0.68, astR: 86, turretChance: 0.1 },
      { r: 1310, gap: entry, width: 0.68, astR: 90, turretChance: 0.12 },
      { r: 1800, gap: entry + Math.PI, width: 0.68, astR: 94, turretChance: 0.12 },
      {
        r: 2175,
        gaps: [entry, entry + Math.PI / 2, entry + Math.PI, entry + (Math.PI * 3) / 2],
        width: 0.44,
        astR: 98,
        turretChance: 0.0
      } // outer ring entrances
    ];

    this.segments = [];
    for (const ring of rings) {
      const gaps = ring.gaps || [ring.gap];
      this.segments.push(...this.buildRing(ring.r, gaps, ring.width, 0.065));
    }

    let turretBudget = 6;
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      const ring = rings[ringIndex];
      const count = Math.ceil((Math.PI * 2 * ring.r) / (ring.astR * 2 * 0.92));
      const step = (Math.PI * 2) / count;
      for (let i = 0; i < count; i++) {
        const a = i * step;
        const gaps = ring.gaps || [ring.gap];
        let nearGap = false;
        let d = a - gaps[0];
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        for (let gi = 0; gi < gaps.length; gi++) {
          let dg = a - gaps[gi];
          while (dg > Math.PI) dg -= Math.PI * 2;
          while (dg < -Math.PI) dg += Math.PI * 2;
          if (Math.abs(dg) < ring.width) {
            nearGap = true;
            break;
          }
        }
        if (nearGap) continue; // intentional gap(s)

        const x = this.pos.x + Math.cos(a) * ring.r;
        const y = this.pos.y + Math.sin(a) * ring.r;

        // Static defensive turrets mounted on some inner walls (not on the entrance ring).
        const allowTurretRing = ringIndex === 1 || ringIndex === 2;
        if (
          allowTurretRing &&
          turretBudget > 0 &&
          GameContext.contractEntities &&
          GameContext.contractEntities.wallTurrets
        ) {
          if (Math.random() < ring.turretChance && Math.abs(d) > ring.width + 0.25) {
            const tx = x - Math.cos(a) * (ring.astR * 0.75 + 34);
            const ty = y - Math.sin(a) * (ring.astR * 0.75 + 34);
            GameContext.contractEntities.wallTurrets.push(
              new WallTurret(tx, ty, this.contractId, a)
            );
            turretBudget--;
          }
        }
      }
    }

    // Reward cache in the core
    if (_ExplorationCache) {
      GameContext.caches.push(new _ExplorationCache(this.pos.x, this.pos.y, this.contractId));
    }
  }

  buildRing(r, gaps, width, step = 0.065) {
    const segs = [];
    for (let ang = 0; ang < Math.PI * 2; ang += step) {
      const a0 = ang;
      const a1 = Math.min(Math.PI * 2, ang + step);
      let inGap = false;
      for (const g of gaps) {
        let d = a0 - g;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < width) {
          inGap = true;
          break;
        }
      }
      if (inGap) continue;
      const x0 = this.pos.x + Math.cos(a0) * r;
      const y0 = this.pos.y + Math.sin(a0) * r;
      const x1 = this.pos.x + Math.cos(a1) * r;
      const y1 = this.pos.y + Math.sin(a1) * r;
      segs.push({ x0, y0, x1, y1 });
    }
    return segs;
  }

  allSegments() {
    return this.segments || [];
  }

  applyWallCollisions(entity, elasticity = 0.95) {
    const segs = this.allSegments();
    if (!_resolveCircleSegment) return;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      _resolveCircleSegment(entity, s.x0, s.y0, s.x1, s.y1, elasticity);
    }
  }

  bulletHitsWall(bullet) {
    const segs = this.allSegments();
    if (!_closestPointOnSegment) return false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const cp = _closestPointOnSegment(bullet.pos.x, bullet.pos.y, s.x0, s.y0, s.x1, s.y1);
      const dx = bullet.pos.x - cp.x;
      const dy = bullet.pos.y - cp.y;
      const dist = Math.hypot(dx, dy);
      if (dist < (bullet.radius || 0) + 0.8) return true;
    }
    return false;
  }

  update(deltaTime = SIM_STEP_MS) {
    if (!GameContext.player || GameContext.player.dead) return;
    const dtFactor = deltaTime / 16.67;
    this.t += dtFactor;
    if (!GameContext.activeContract || GameContext.activeContract.type !== "anomaly") return;

    const d = Math.hypot(
      GameContext.player.pos.x - this.pos.x,
      GameContext.player.pos.y - this.pos.y
    );

    // Build the maze before the player hits the ring so it can be seen on approach.
    if (d < this.radius * 1.6) {
      if (!this.generated) {
        this.generateMaze();
        this.shieldsDirty = true;
      }
    }

    const collected = !!GameContext.activeContract.coreCollected;
    if (d < this.radius) {
      GameContext.activeContract.state = collected ? "escape" : "inside";

      if (!this.defendersSpawned) {
        this.defendersSpawned = true;
        const defenderCount = 6;
        for (let i = 0; i < defenderCount; i++) {
          let spawned = false;
          for (let attempt = 0; attempt < 30 && !spawned; attempt++) {
            const a = Math.random() * Math.PI * 2;
            const dd = 850 + Math.random() * 950;
            const sx = this.pos.x + Math.cos(a) * dd;
            const sy = this.pos.y + Math.sin(a) * dd;
            const distPlayer = GameContext.player
              ? Math.hypot(GameContext.player.pos.x - sx, GameContext.player.pos.y - sy)
              : 99999;
            if (distPlayer < 500) continue;
            const def = new Enemy("defender", { x: sx, y: sy }, null);
            def.contractId = this.contractId;
            GameContext.enemies.push(def);
            spawned = true;
          }
        }
        showOverlayMessage("ANOMALY STABILIZED: NAVIGATE TO CORE", "#0f0", 2500);
      }
    } else {
      // Outside the ring: if the cache was collected, escaping completes the contract.
      GameContext.activeContract.state = "travel";
      if (collected && _completeContract) {
        _completeContract(true);
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;

    const pulse = 0.25 + Math.abs(Math.sin(this.t * 0.02)) * 0.25;

    if (pixiVectorLayer) {
      // Initialization
      if (!this._pixiGfx) {
        this._pixiGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiGfx);

        this._pixiOuterGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiOuterGfx);

        this._pixiCoreGfx = new PIXI.Graphics();
        pixiVectorLayer.addChild(this._pixiCoreGfx);

        this.shieldsDirty = true;
      }
      if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);
      if (!this._pixiOuterGfx.parent) pixiVectorLayer.addChild(this._pixiOuterGfx);
      if (!this._pixiCoreGfx.parent) pixiVectorLayer.addChild(this._pixiCoreGfx);

      // Rebuild Geometry if dirty
      if (this.shieldsDirty && this.segments && this.segments.length > 0) {
        const z = GameContext.currentZoom || ZOOM_LEVEL;

        // 1. Maze Segments
        this._pixiGfx.clear();
        this._pixiGfx.lineStyle(2 / z, 0x00ffff, 0.55); // Increased line width slightly for visibility
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          this._pixiGfx.moveTo(s.x0, s.y0);
          this._pixiGfx.lineTo(s.x1, s.y1);
        }

        // 2. Outer Ring
        this._pixiOuterGfx.clear();
        this._pixiOuterGfx.lineStyle(4, 0x00ff78, 1.0);
        this._pixiOuterGfx.drawCircle(this.pos.x, this.pos.y, this.radius);

        // 3. Core
        this._pixiCoreGfx.clear();
        this._pixiCoreGfx.beginFill(0xff8c00, 0.3); // Core fill
        this._pixiCoreGfx.lineStyle(4, 0xff8c00, 0.8);
        this._pixiCoreGfx.drawCircle(this.pos.x, this.pos.y, this.coreRadius);
        this._pixiCoreGfx.endFill();

        this.shieldsDirty = false;
      }

      // Update Dynamic states (Alpha pulse)
      if (this._pixiOuterGfx) this._pixiOuterGfx.alpha = 0.5 + pulse;
      if (this._pixiCoreGfx) this._pixiCoreGfx.alpha = 0.5 + pulse;

      // Core Text
      if (pixiVectorLayer) {
        let t = this._pixiCoreText;
        if (!t) {
          const fontSize = Math.round(16 / (GameContext.currentZoom || ZOOM_LEVEL));
          t = new PIXI.Text("CORE", {
            fontFamily: "Courier New",
            fontSize: fontSize,
            fontWeight: "bold",
            fill: 0xffffff,
            align: "center"
          });
          t.anchor.set(0.5);
          pixiVectorLayer.addChild(t);
          this._pixiCoreText = t;
        }
        if (!t.parent) pixiVectorLayer.addChild(t);
        t.position.set(this.pos.x, this.pos.y);
        t.visible = true;
      }

      return; // Exit canvas path
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Maze rings (warp-maze style 1px line walls)
    if (this.segments && this.segments.length > 0) {
      const z = GameContext.currentZoom || ZOOM_LEVEL;
      ctx.save();
      ctx.lineWidth = 1 / z;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#0ff";
      ctx.strokeStyle = "rgba(0,255,255,0.55)";
      ctx.beginPath();
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        ctx.moveTo(s.x0 - this.pos.x, s.y0 - this.pos.y);
        ctx.lineTo(s.x1 - this.pos.x, s.y1 - this.pos.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = `rgba(0,255,120,${pulse})`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#0f0";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.fillStyle = `rgba(255,140,0,${0.1 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#f80";
    ctx.strokeStyle = `rgba(255,140,0,${0.55 + pulse * 0.25})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(16 / (GameContext.currentZoom || ZOOM_LEVEL))}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CORE", 0, 0);
    ctx.restore();
    ctx.restore();
  }
}
