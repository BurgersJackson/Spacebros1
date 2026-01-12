
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS, ZOOM_LEVEL } from '../../core/constants.js';
import { CaveWallTurret } from './CaveWallTurret.js';
import { CaveGasVent } from './CaveGasVent.js';
import { CaveDraftZone } from './CaveDraftZone.js';
import { CaveRockfall } from './CaveRockfall.js';
import { CaveCritter } from './CaveCritter.js';
import { CaveRewardPickup } from './CaveRewardPickup.js';
import { CaveWallSwitch } from './CaveWallSwitch.js';
import { createCaveMonsterBoss } from './cave-factory.js';
import { WarpSentinelBoss } from '../bosses/WarpSentinelBoss.js';
import { resolveCircleSegment } from '../../core/math.js';
import { caveDeps } from './cave-dependencies.js';
import { pixiWorldRoot } from '../../rendering/pixi-context.js';

export class CaveLevel {
    constructor() {
        this.active = true;
        this.startX = 0;
        this.startY = 0;
        this.endY = -220000; // ~10 minutes of flight at stock speeds 
        this.stepY = 240;
        this.baseWidth = 4688;
        // Pixi Rendering
        this._pixiContainer = null;
        this._pixiBackGfx = null;
        this._pixiFrontGfx = null;
        this._pixiBlockerGfx = null;
        this._pixiReady = false;

        this.buckets = [];
        this.leftPts = [];
        this.rightPts = [];
        this.innerSegments = [];
        this.wallTurrets = [];
        this.switches = [];
        this.doors = []; // { id, open, segments } 
        this.rewards = [];
        this.relays = [];
        this.gasVents = [];
        this.draftZones = [];
        this.critters = [];
        this.rockfalls = [];
        this.arenaSegments = [];
        this.entranceSeal = null;
        this.exitSeal = null;
        this.exitUnlocked = false;
        this.gates = []; // { y, open, segments } 
        this.bossesDefeated = 0;
        this.finalSpawned = false;
        this.enemySpawnCooldown = 0;
        this.critterSpawnCooldown = 0;
    }

    generate() {
        this.resetFireWall();
        const length = Math.abs(this.endY - this.startY);
        const count = Math.max(1, Math.ceil(length / this.stepY));
        this.buckets = new Array(count);
        for (let i = 0; i < count; i++) this.buckets[i] = [];

        const leftPts = [];
        const rightPts = [];
        for (let i = 0; i <= count; i++) {
            const y = this.startY - i * this.stepY;
            // Straight walls - no randomization
            leftPts.push({ x: -this.baseWidth * 0.5, y });
            rightPts.push({ x: this.baseWidth * 0.5, y });
        }

        this.leftPts = leftPts;
        this.rightPts = rightPts;

        for (let i = 0; i < leftPts.length - 1; i++) {
            const l0 = leftPts[i], l1 = leftPts[i + 1];
            const r0 = rightPts[i], r1 = rightPts[i + 1];
            const sL = { x0: l0.x, y0: l0.y, x1: l1.x, y1: l1.y, kind: 'outer' };
            const sR = { x0: r0.x, y0: r0.y, x1: r1.x, y1: r1.y, kind: 'outer' };
            if (this.buckets[i]) this.buckets[i].push(sL, sR);
        }

        // Wall turrets along the cave walls.
        this.wallTurrets = [];
        const turretEvery = 2600;
        const totalTurrets = Math.max(70, Math.floor(Math.abs(this.endY - this.startY) / turretEvery));
        const modes = ['rapid', 'rapid', 'rapid', 'beam', 'missile', 'rapid', 'tracker', 'rapid'];
        for (let i = 0; i < totalTurrets; i++) {
            const y = this.startY - (i * turretEvery) - 2400 - Math.random() * 1200;
            if (y < this.endY + 1200) break;
            const bounds = this.boundsAt(y);
            const side = (Math.random() < 0.5) ? 'left' : 'right';
            const x = side === 'left' ? (bounds.left + 160) : (bounds.right - 160);
            const mode = modes[i % modes.length];
            const armored = (mode === 'rapid') && (Math.random() < 0.28);
            this.wallTurrets.push(new CaveWallTurret(x, y, mode, { armored }));
        }

        // Seal the entrance
        const sealY = this.startY + 1400;
        const b0 = this.boundsAt(this.startY);
        const entranceLeftX = b0.left;
        const entranceRightX = b0.right;
        const sealLeft = entranceLeftX;
        const sealRight = entranceRightX;
        const sealSegs = [];
        const n = 34;
        const step = (sealRight - sealLeft) / n;
        const jitter = 60;
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const x = sealLeft + i * step;
            let y = sealY + (Math.random() - 0.5) * jitter;
            if (i === 0 || i === n) y = sealY;
            pts.push({ x, y });
        }
        for (let i = 0; i < n; i++) {
            sealSegs.push({ x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y, kind: 'seal' });
        }
        const sideSegs = [];
        const sideStep = 220;
        for (let y = this.startY; y < sealY; y += sideStep) {
            const y1 = Math.min(sealY, y + sideStep);
            sideSegs.push({ x0: entranceLeftX, y0: y, x1: entranceLeftX, y1, kind: 'seal' });
            sideSegs.push({ x0: entranceRightX, y0: y, x1: entranceRightX, y1, kind: 'seal' });
        }
        this.entranceSeal = { y: sealY, segments: sealSegs, sideSegments: sideSegs, leftX: entranceLeftX, rightX: entranceRightX };

        this.exitSeal = null;
        this.exitUnlocked = true;
    }

    resetFireWall(playerY = null) {
        const gap = 400;
        const baseY = (typeof playerY === 'number' && isFinite(playerY))
            ? playerY
            : (this.startY + 600);
        this.fireWall = {
            y: baseY + gap,
            speed: 160,
            damagePerSecond: 5,
            damageTimer: 0,
            minY: this.endY + 1200
        };
    }

    updateFireWall(deltaTime = 16.67) {
        if (!this.active || !this.fireWall) return;
        const fire = this.fireWall;
        if (GameContext.player && !GameContext.player.dead) {
            // Accelerate firewall if it falls too far behind
            const dist = fire.y - GameContext.player.pos.y;
            let targetSpeed = 160;
            if (dist > 2800) targetSpeed = 450;
            else if (dist > 1800) targetSpeed = 320;

            // Allow firewall to slow down if close, but not stop
            if (dist < 800) targetSpeed = 140;

            // Apply speed change smoothly
            fire.speed = fire.speed * 0.98 + targetSpeed * 0.02;

            if (fire.y > fire.minY) {
                fire.y -= (fire.speed * (deltaTime / 1000));

                // Damage player if they touch the firewall
                // The firewall is a line at fire.y. Player is above it (smaller Y).
                // If player.y > fire.y - buffer, they are in the fire.
                if (GameContext.player.pos.y > fire.y - 100) {
                    fire.damageTimer -= deltaTime;
                    if (fire.damageTimer <= 0) {
                        // Apply damage logic
                        if (caveDeps.applyAOEDamageToPlayer) caveDeps.applyAOEDamageToPlayer(GameContext.player.pos.x, GameContext.player.pos.y, 200, 1);
                        fire.damageTimer = 200; // 5 dps approx
                    }
                }
            }
        }
    }

    boundsAt(y) {
        // Simplified bounds for straight walls
        return { left: -this.baseWidth * 0.5, right: this.baseWidth * 0.5 };
    }

    bucketIndexForY(y) {
        return Math.floor((this.startY - y) / this.stepY);
    }

    applyWallCollisions(entity) {
        if (!entity || entity.dead) return;

        // Ensure buckets are initialized
        if (!this.buckets || this.buckets.length === 0) return;

        const i = this.bucketIndexForY(entity.pos.y);
        const range = 2; // Check neighboring buckets
        const count = this.buckets.length;

        for (let k = i - range; k <= i + range; k++) {
            if (k >= 0 && k < count) {
                const b = this.buckets[k];
                if (b) {
                    for (const seg of b) {
                        if (resolveCircleSegment(entity, seg.x0, seg.y0, seg.x1, seg.y1, 0.7)) {
                            // Collision happened
                        }
                    }
                }
            }
        }

        // Entrance seal
        if (this.entranceSeal) {
            for (const seg of this.entranceSeal.segments) {
                resolveCircleSegment(entity, seg.x0, seg.y0, seg.x1, seg.y1, 0.5);
            }
            for (const seg of this.entranceSeal.sideSegments) {
                resolveCircleSegment(entity, seg.x0, seg.y0, seg.x1, seg.y1, 0.5);
            }
        }
    }

    update(deltaTime = SIM_STEP_MS) {
        if (!this.active) return;

        this.updateFireWall(deltaTime);

        // Update Turrets
        for (let i = this.wallTurrets.length - 1; i >= 0; i--) {
            const t = this.wallTurrets[i];
            t.update(deltaTime);
            if (t.dead && typeof t.kill === 'function') {
                // Should clean up?
            }
        }

        // Spawning Logic (Bosses)
        if (GameContext.player && !GameContext.player.dead && !this.finalSpawned) {
            const py = GameContext.player.pos.y;

            // Checkpoints for bosses mainly
            // Using logic from main.js: 
            // 3 bosses: at 33%, 66%, 100% of cave? 
            // main.js had gateYs = [-52000, -118000, -182000];
            // Let's use simplified distance based spawning if gates are gone.

            const caveLen = Math.abs(this.endY - this.startY);
            const dist = Math.abs(py - this.startY);
            const progress = dist / caveLen;

            // Simple boss encounter logic without gates
            if (progress > 0.33 && this.bossesDefeated === 0 && !GameContext.bossActive) {
                this.spawnBoss(1);
            } else if (progress > 0.66 && this.bossesDefeated === 1 && !GameContext.bossActive) {
                this.spawnBoss(2);
            } else if (progress > 0.95 && this.bossesDefeated === 2 && !GameContext.bossActive && !this.finalSpawned) {
                this.spawnBoss(3);
                this.finalSpawned = true;
            }
        }

        // Update other entities
        [this.gasVents, this.draftZones, this.critters, this.rockfalls, this.rewards, this.switches].forEach(arr => {
            for (let i = 0; i < arr.length; i++) arr[i].update(deltaTime);
        });
    }

    spawnBoss(tier) {
        // Spawn boss ahead of player
        if (!GameContext.player) return;
        const spawnY = GameContext.player.pos.y - 1200;
        const boss = createCaveMonsterBoss(0, spawnY, tier);
        GameContext.enemies.push(boss);
        GameContext.boss = boss;
        GameContext.bossActive = true;
        GameContext.bossArena.active = true;
        GameContext.bossArena.y = spawnY;

        if (caveDeps.showOverlayMessage) caveDeps.showOverlayMessage("WARNING: TITAN CLASS DETECTED", "#f00", 3000, 5);

        // This relies on BossArena logic in main.js to trap player.
    }

    initPixi() {
        if (!this.active || this._pixiReady) return;

        this._pixiContainer = new PIXI.Container();

        this._pixiBackGfx = new PIXI.Graphics();
        this._pixiContainer.addChild(this._pixiBackGfx);

        this._pixiFrontGfx = new PIXI.Graphics();
        this._pixiFrontGfx.blendMode = PIXI.BLEND_MODES.ADD;
        this._pixiContainer.addChild(this._pixiFrontGfx);

        this._pixiBlockerGfx = new PIXI.Graphics();
        this._pixiBlockerGfx.blendMode = PIXI.BLEND_MODES.ADD;
        this._pixiContainer.addChild(this._pixiBlockerGfx);

        if (pixiWorldRoot) {
            pixiWorldRoot.addChildAt(this._pixiContainer, 0); // Add at bottom
        }
        this._pixiReady = true;
    }

    cleanupPixi() {
        if (this._pixiContainer) {
            if (this._pixiContainer.parent) this._pixiContainer.parent.removeChild(this._pixiContainer);
            this._pixiContainer.destroy({ children: true });
        }
        this._pixiContainer = null;
        this._pixiBackGfx = null;
        this._pixiFrontGfx = null;
        this._pixiBlockerGfx = null;
        this._pixiReady = false;
    }

    updatePixi() {
        if (!this.active) {
            if (this._pixiContainer) this._pixiContainer.visible = false;
            return;
        }

        if (!this._pixiReady) this.initPixi();
        this._pixiContainer.visible = true;

        if (!GameContext.player || !this._pixiBackGfx || !this._pixiFrontGfx || !this._pixiBlockerGfx) return;

        // Use global canvas or window dimensions
        const w = 1920; // Fallback
        const h = 1080;
        // Or fetch from context if stored, but let's assume standard HD for culling calc

        const z = GameContext.currentZoom || ZOOM_LEVEL;
        const sh = h / z;
        const y0 = GameContext.player.pos.y - (sh * 0.5) - 1500;
        const y1 = GameContext.player.pos.y + (sh * 0.5) + 1500;

        let i0 = this.bucketIndexForY(y1);
        let i1 = this.bucketIndexForY(y0);
        if (!isFinite(i0) || !isFinite(i1)) {
            i0 = 0;
            i1 = Math.max(0, (this.buckets ? this.buckets.length - 1 : 0));
        }
        const minIdx = Math.max(0, i0 - 1);
        const maxIdx = Math.min(this.buckets.length - 1, i1 + 1);

        const visibleOuter = [];
        const visibleInner = []; // Not used technically if empty
        const segFinite = (s) => (s && isFinite(s.x0) && isFinite(s.y0) && isFinite(s.x1) && isFinite(s.y1));

        for (let i = minIdx; i <= maxIdx; i++) {
            const b = this.buckets[i];
            if (!b) continue;
            for (let j = 0; j < b.length; j++) {
                const s = b[j];
                if (!segFinite(s)) continue;
                if (s.kind === 'outer') visibleOuter.push(s);
            }
        }

        this._pixiBackGfx.clear();
        this._pixiFrontGfx.clear();
        this._pixiBlockerGfx.clear();

        // Draw Outer Walls
        this._pixiBackGfx.lineStyle(23, 0x004678, 0.85);
        for (let s of visibleOuter) {
            this._pixiBackGfx.moveTo(s.x0, s.y0);
            this._pixiBackGfx.lineTo(s.x1, s.y1);
        }
        this._pixiFrontGfx.lineStyle(4, 0x8cf0ff, 0.9);
        for (let s of visibleOuter) {
            this._pixiFrontGfx.moveTo(s.x0, s.y0);
            this._pixiFrontGfx.lineTo(s.x1, s.y1);
        }

        // Blocker/Seal Graphics
        this._pixiBlockerGfx.lineStyle(14, 0x003764, 0.95);
        if (this.entranceSeal) {
            for (let s of this.entranceSeal.segments) {
                this._pixiBlockerGfx.moveTo(s.x0, s.y0);
                this._pixiBlockerGfx.lineTo(s.x1, s.y1);
            }
            for (let s of this.entranceSeal.sideSegments) {
                this._pixiBlockerGfx.moveTo(s.x0, s.y0);
                this._pixiBlockerGfx.lineTo(s.x1, s.y1);
            }
        }

        // Draw entities that manage their own pixi state but attach to this container?
        // No, entities like Turrets manage their own sprite in enemies layer.
        // DraftZones, etc might attach here.
        [this.draftZones, this.critters].forEach(arr => {
            for (let e of arr) if (e.draw) e.draw();
        });

        // Firewall Draw
        if (this.fireWall && this.fireWall.y < this.fireWall.minY + 20000 && this.fireWall.y > y0 - 1000) {
            // It's just a line/rect?
            const fy = this.fireWall.y;
            const gfx = this._pixiFrontGfx;
            gfx.lineStyle(0);
            gfx.beginFill(0xff4400, 0.4);
            gfx.drawRect(-this.baseWidth, fy, this.baseWidth * 2, 800);
            gfx.endFill();

            gfx.lineStyle(4, 0xffaa00, 1);
            gfx.moveTo(-this.baseWidth, fy);
            gfx.lineTo(this.baseWidth, fy);
        }
    }
}
