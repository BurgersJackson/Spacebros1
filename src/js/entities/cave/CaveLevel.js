
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
import { closestPointOnSegment, resolveCircleSegment } from '../../core/math.js';
import { caveDeps } from './cave-dependencies.js';
import { pixiWorldRoot } from '../../rendering/pixi-context.js';
import { playSound, setMusicMode, musicEnabled } from '../../audio/audio-manager.js';
import { pixiCleanupObject } from '../../utils/cleanup-utils.js';

export class CaveLevel {
    constructor() {
        this.active = true;
        this.startX = 0;
        this.startY = 0;
        this.endY = -220000; // ~10 minutes of flight at stock speeds
        this.stepY = 240;
        this.baseWidth = 4902; // 5% narrower (5160 * 0.95)
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
        // Cave boss arena state
        this.bossArenaPlaced = false;
        this.bossArenaTier = null;
    }

    generate() {
        this.resetFireWall();
        const length = Math.abs(this.endY - this.startY);
        const count = Math.max(1, Math.ceil(length / this.stepY));
        // Allocate one extra bucket to ensure we cover the full cave length including the very end
        this.buckets = new Array(count + 1);
        for (let i = 0; i < count + 1; i++) this.buckets[i] = [];

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
            speed: 176, // 160 * 1.1 (10% increase)
            damagePerSecond: 5,
            damageTimer: 0,
            minY: this.endY + 1200
        };
    }

    updateFireWall(deltaTime = 16.67) {
        if (!this.active || !this.fireWall) return;
        const fire = this.fireWall;
        const dtSec = Math.max(0, deltaTime) / 1000;
        
        // Pause firewall movement if player is fighting a boss in cave level
        const isBossFightActive = GameContext.bossActive && GameContext.boss && !GameContext.boss.dead && GameContext.caveMode;
        if (!isBossFightActive) {
            fire.y -= fire.speed * dtSec;
            if (fire.minY !== undefined && fire.y < fire.minY) fire.y = fire.minY;
        }

        if (GameContext.player && !GameContext.player.dead && GameContext.player.pos.y >= fire.y) {
            fire.damageTimer += deltaTime;
            const ticks = Math.floor(fire.damageTimer / 1000);
            if (ticks > 0) {
                const damage = fire.damagePerSecond * ticks;
                GameContext.player.takeHit(damage);
                fire.damageTimer -= ticks * 1000;
            }
        } else {
            fire.damageTimer = 0;
        }

        // Firewall no longer damages enemies - removed enemy damage loop
    }

    boundsAt(y) {
        if (!this.leftPts || this.leftPts.length < 2) return { left: -1500, right: 1500 };
        const idx = Math.max(0, Math.min(this.leftPts.length - 1, Math.floor((this.startY - y) / this.stepY)));
        const l = this.leftPts[idx];
        const r = this.rightPts[idx];
        return { left: l ? l.x : -1500, right: r ? r.x : 1500 };
    }

    bucketIndexForY(y) {
        const idx = Math.floor((this.startY - y) / this.stepY);
        return Math.max(0, Math.min(this.buckets.length - 1, idx));
    }

    centerXAt(y) {
        const b = this.boundsAt(y);
        return (b.left + b.right) * 0.5;
    }

    segmentsNearY(y, spanBuckets = 3) {
        if (!this.buckets || this.buckets.length === 0) return [];
        const idx = this.bucketIndexForY(y);
        const segs = [];
        for (let i = Math.max(0, idx - spanBuckets); i <= Math.min(this.buckets.length - 1, idx + spanBuckets); i++) {
            const b = this.buckets[i];
            if (b && b.length) segs.push(...b);
        }
        for (let g = 0; g < this.gates.length; g++) {
            const gate = this.gates[g];
            if (!gate || gate.open) continue;
            if (Math.abs(gate.y - y) < this.stepY * (spanBuckets + 2)) {
                if (gate.segments && gate.segments.length) segs.push(...gate.segments);
            }
        }
        for (let d = 0; d < this.doors.length; d++) {
            const door = this.doors[d];
            if (!door || door.open) continue;
            if (door.segments && door.segments.length) {
                const yy = (door.segments[0].y0 + door.segments[0].y1) * 0.5;
                if (Math.abs(yy - y) < this.stepY * (spanBuckets + 2)) segs.push(...door.segments);
            }
        }
        if (this.entranceSeal && this.entranceSeal.segments && this.entranceSeal.segments.length) {
            if (Math.abs(this.entranceSeal.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...this.entranceSeal.segments);
        }
        if (this.entranceSeal && this.entranceSeal.sideSegments && this.entranceSeal.sideSegments.length) {
            if (y > this.startY - this.stepY * (spanBuckets + 3) && y < this.entranceSeal.y + this.stepY * (spanBuckets + 3)) segs.push(...this.entranceSeal.sideSegments);
        }
        if (!this.exitUnlocked && this.exitSeal && this.exitSeal.segments && this.exitSeal.segments.length) {
            if (Math.abs(this.exitSeal.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...this.exitSeal.segments);
        }
        if (!this.exitUnlocked && this.exitSeal && this.exitSeal.sideSegments && this.exitSeal.sideSegments.length) {
            if (y > this.exitSeal.y - this.stepY * (spanBuckets + 3) && y < this.exitSeal.y + this.stepY * (spanBuckets + 6)) segs.push(...this.exitSeal.sideSegments);
        }
        for (let i = 0; i < this.rockfalls.length; i++) {
            const rf = this.rockfalls[i];
            if (!rf || rf.dead || rf.state !== 'fallen' || !rf.segments) continue;
            if (Math.abs(rf.pos.y - y) < this.stepY * (spanBuckets + 3)) segs.push(...rf.segments);
        }
        return segs;
    }

    buildGateSegments(y) {
        const bounds = this.boundsAt(y);
        const left = bounds.left + 10;
        const right = bounds.right - 10;
        const segs = [];
        const rows = 2;
        for (let r = 0; r < rows; r++) {
            const ry = y + (r === 0 ? -40 : 40);
            const n = 22;
            const step = (right - left) / n;
            for (let i = 0; i < n; i++) {
                const x0 = left + i * step;
                const x1 = left + (i + 1) * step;
                const j0 = (Math.random() - 0.5) * 60;
                const j1 = (Math.random() - 0.5) * 60;
                segs.push({ x0, y0: ry + j0, x1, y1: ry + j1, kind: 'gate' });
            }
        }
        return segs;
    }

    openGate(index) {
        return;
    }

    applyWallCollisions(entity) {
        if (!this.active || !entity || entity.dead) return;
        const segs = this.segmentsNearY(entity.pos.y, 3);
        const elasticity = (entity === GameContext.player) ? 0.92 : 0.55;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            resolveCircleSegment(entity, s.x0, s.y0, s.x1, s.y1, elasticity);
        }
        this.applyFireWallCollision(entity);
    }

    applyFireWallCollision(entity) {
        if (!this.active || !this.fireWall || !entity || entity.dead) return;
        
        // Only collide with player, other entities can pass through
        if (entity !== GameContext.player) return;
        
        const fire = this.fireWall;
        const playerY = entity.pos.y;
        
        // If player is at or below firewall, push them up
        if (playerY >= fire.y) {
            const pushForce = 8; // Push force to keep player above firewall
            entity.pos.y = fire.y - 1; // Position player just above firewall
            // Also add upward velocity to help player escape
            if (entity.vel && entity.vel.y < 0) {
                entity.vel.y = Math.max(entity.vel.y, -pushForce);
            } else if (entity.vel) {
                entity.vel.y = -pushForce;
            }
        }
    }

    bulletHitsWall(bullet) {
        const segs = this.segmentsNearY(bullet.pos.y, 2);
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const cp = closestPointOnSegment(bullet.pos.x, bullet.pos.y, s.x0, s.y0, s.x1, s.y1);
            const dx = bullet.pos.x - cp.x;
            const dy = bullet.pos.y - cp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < (bullet.radius || 0) + 0.8) return true;
        }
        return false;
    }

    clipInterior(ctx, camX, camY, height, zoom) {
        if (!this.active) return;
        const z = zoom || (GameContext.currentZoom || ZOOM_LEVEL);
        const y0 = camY - 1400;
        const y1 = camY + (height / z) + 1400;
        const step = this.stepY;
        ctx.beginPath();
        for (let y = y0; y <= y1; y += step) {
            const b = this.boundsAt(y);
            if (y === y0) ctx.moveTo(b.left, y);
            else ctx.lineTo(b.left, y);
        }
        for (let y = y1; y >= y0; y -= step) {
            const b = this.boundsAt(y);
            ctx.lineTo(b.right, y);
        }
        ctx.closePath();
        ctx.clip();
    }

    toggleDoor(id) {
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            if (d && d.id === id) {
                d.open = !d.open;
                if (caveDeps.showOverlayMessage) caveDeps.showOverlayMessage(d.open ? "DOOR OPENED" : "DOOR CLOSED", '#0ff', 900, 1);
                return;
            }
        }
    }

    spawnGateRelays(gateIndex) {
        return;
    }

    onRelayDestroyed(gateIndex) {
        const gate = this.gates[gateIndex];
        if (!gate || gate.open || !gate.relaysEnabled || !gate.relaysSpawned || gate.relaysCleared) return;
        gate.relaysRemaining = Math.max(0, (gate.relaysRemaining || 0) - 1);
        if (caveDeps.showOverlayMessage) caveDeps.showOverlayMessage(`RELAYS LEFT: ${gate.relaysRemaining}`, '#ff0', 800, 2);
        if (gate.relaysRemaining <= 0) {
            gate.relaysCleared = true;
            if (caveDeps.showOverlayMessage) caveDeps.showOverlayMessage("GATE SHIELD DOWN", '#0f0', 1600, 3);
            playSound('powerup');
            if (!gate.bossEnabled) {
                this.openGate(gateIndex);
            }
        }
    }

    drawGridBackground(ctx, camX, camY, width, height, zoom) {
        let z = zoom || (GameContext.currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) z = ZOOM_LEVEL;
        const w = width / z;
        const h = height / z;
        const grid = 420;
        const minor = 210;

        const x0 = Math.floor((camX - 1200) / minor) * minor;
        const x1 = camX + w + 1200;
        const y0 = Math.floor((camY - 1200) / minor) * minor;
        const y1 = camY + h + 1200;

        ctx.save();
        ctx.lineWidth = 1 / z;
        ctx.globalAlpha = 1;

        ctx.strokeStyle = 'rgba(0,255,255,0.05)';
        ctx.beginPath();
        for (let x = x0; x <= x1; x += minor) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
        }
        for (let y = y0; y <= y1; y += minor) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,255,255,0.10)';
        ctx.beginPath();
        const gx0 = Math.floor((camX - 1200) / grid) * grid;
        const gy0 = Math.floor((camY - 1200) / grid) * grid;
        for (let x = gx0; x <= x1; x += grid) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
        }
        for (let y = gy0; y <= y1; y += grid) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawFireWall(ctx, camX, camY, width, height, zoom) {
        if (!this.fireWall) return;
        const z = zoom || (GameContext.currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) return;
        const viewTop = camY - 1200;
        const viewBottom = camY + (height / z) + 1200;
        const rangeTop = Math.min(this.startY, this.fireWall.y);
        const rangeBottom = Math.max(this.startY, this.fireWall.y);
        if (rangeBottom < viewTop || rangeTop > viewBottom) return;
        const drawTop = Math.max(rangeTop, viewTop);
        const drawBottom = Math.min(rangeBottom, viewBottom);
        if (drawBottom <= drawTop) return;
        const worldWidth = width / z;
        const padding = 720;
        ctx.save();
        ctx.globalAlpha = 0.35;
        const gradient = ctx.createLinearGradient(camX - padding, drawTop, camX - padding, drawBottom);
        gradient.addColorStop(0, 'rgba(255,165,72,0.85)');
        gradient.addColorStop(0.6, 'rgba(255,80,0,0.65)');
        gradient.addColorStop(1, 'rgba(255,0,0,0.25)');
        ctx.fillStyle = gradient;
        ctx.fillRect(camX - padding, drawTop, worldWidth + padding * 2, drawBottom - drawTop);
        ctx.strokeStyle = 'rgba(255,200,120,0.6)';
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.moveTo(camX - padding, this.fireWall.y);
        ctx.lineTo(camX + worldWidth + padding, this.fireWall.y);
        ctx.stroke();
        ctx.restore();
    }

    drawEntities(ctx, camX, camY, height, zoom) {
        if (!this.active) return;
        let z = zoom || (GameContext.currentZoom || ZOOM_LEVEL);
        if (!isFinite(z) || z <= 0) z = ZOOM_LEVEL;
        const safeCamX = (isFinite(camX) ? camX : (GameContext.player ? GameContext.player.pos.x - (height / (2 * z)) : 0));
        const safeCamY = (isFinite(camY) ? camY : (GameContext.player ? GameContext.player.pos.y - (height / (2 * z)) : 0));
        const y0 = safeCamY - 1200;
        const y1 = safeCamY + (height / z) + 1200;

        for (let i = 0; i < this.wallTurrets.length; i++) {
            const t = this.wallTurrets[i];
            if (!t || t.dead) continue;
            if (t.pos.y < y0 - 1600 || t.pos.y > y1 + 1600) {
                if (t._pixiContainer) t._pixiContainer.visible = false;
                continue;
            }
            t.draw(ctx);
        }

        for (let i = 0; i < this.switches.length; i++) {
            const s = this.switches[i];
            if (!s || s.dead) continue;
            if (s.pos.y < y0 - 1600 || s.pos.y > y1 + 1600) {
                if (s._pixiContainer) s._pixiContainer.visible = false;
                continue;
            }
            s.draw(ctx);
        }
        for (let i = 0; i < this.relays.length; i++) {
            const r = this.relays[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 1600 || r.pos.y > y1 + 1600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.rewards.length; i++) {
            const r = this.rewards[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 1600 || r.pos.y > y1 + 1600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.gasVents.length; i++) {
            const h = this.gasVents[i];
            if (!h || h.dead) continue;
            if (h.pos.y < y0 - 2000 || h.pos.y > y1 + 2000) {
                if (h._pixiContainer) h._pixiContainer.visible = false;
                continue;
            }
            h.draw(ctx);
        }
        for (let i = 0; i < this.draftZones.length; i++) {
            const d = this.draftZones[i];
            if (!d) continue;
            if (d.pos.y < y0 - 2600 || d.pos.y > y1 + 2600) {
                if (d._pixiContainer) d._pixiContainer.visible = false;
                continue;
            }
            d.draw(ctx);
        }
        for (let i = 0; i < this.rockfalls.length; i++) {
            const r = this.rockfalls[i];
            if (!r || r.dead) continue;
            if (r.pos.y < y0 - 2600 || r.pos.y > y1 + 2600) {
                if (r._pixiContainer) r._pixiContainer.visible = false;
                continue;
            }
            r.draw(ctx);
        }
        for (let i = 0; i < this.critters.length; i++) {
            const c = this.critters[i];
            if (!c || c.dead) continue;
            if (c.pos.y < y0 - 1600 || c.pos.y > y1 + 1600) {
                if (c._pixiContainer) c._pixiContainer.visible = false;
                continue;
            }
            c.draw(ctx);
        }
    }

    update(deltaTime = SIM_STEP_MS) {
        if (!this.active) return;

        this.updateFireWall(deltaTime);

        // Update Turrets and remove dead ones
        for (let i = this.wallTurrets.length - 1; i >= 0; i--) {
            const t = this.wallTurrets[i];
            if (!t || t.dead) {
                if (t) {
                    if (typeof t.kill === 'function') {
                        try { t.kill(); } catch (e) { }
                    }
                    try { pixiCleanupObject(t); } catch (e) { }
                }
                this.wallTurrets.splice(i, 1);
                continue;
            }
            t.update(deltaTime);
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
            // Place cave boss arena at progress thresholds
            if (progress > 0.30 && this.bossesDefeated === 0 && !this.bossArenaPlaced && !GameContext.bossActive) {
                this.placeBossArena(1);
            } else if (progress > 0.63 && this.bossesDefeated === 1 && !this.bossArenaPlaced && !GameContext.bossActive) {
                this.placeBossArena(2);
            } else if (progress > 0.92 && this.bossesDefeated === 2 && !this.bossArenaPlaced && !GameContext.bossActive && !this.finalSpawned) {
                this.placeBossArena(3);
                this.finalSpawned = true;
            }

            // Check if player entered arena (spawn boss if not yet spawned)
            if (this.bossArenaPlaced && GameContext.caveBossArena && !GameContext.caveBossArena.bossSpawned) {
                this.checkArenaEntry();
            }
        }

        // Update other entities and remove dead ones
        const entityArrays = [
            { arr: this.gasVents, name: 'gasVents' },
            { arr: this.draftZones, name: 'draftZones' },
            { arr: this.critters, name: 'critters' },
            { arr: this.rockfalls, name: 'rockfalls' },
            { arr: this.rewards, name: 'rewards' },
            { arr: this.switches, name: 'switches' },
            { arr: this.relays, name: 'relays' }
        ];
        
        for (const { arr } of entityArrays) {
            if (!arr) continue;
            for (let i = arr.length - 1; i >= 0; i--) {
                const entity = arr[i];
                if (!entity || entity.dead) {
                    if (entity) {
                        if (typeof entity.kill === 'function') {
                            try { entity.kill(); } catch (e) { }
                        }
                        try { pixiCleanupObject(entity); } catch (e) { }
                    }
                    arr.splice(i, 1);
                    continue;
                }
                entity.update(deltaTime);
            }
        }
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

    placeBossArena(tier) {
        if (!GameContext.player) return;

        // Place arena ahead of player (3000 units forward)
        const playerY = GameContext.player.pos.y;
        const arenaY = playerY - 3000;  // Ahead of player

        GameContext.caveBossArena.x = 0;
        GameContext.caveBossArena.y = arenaY;
        GameContext.caveBossArena.radius = 2500;
        GameContext.caveBossArena.active = false;
        GameContext.caveBossArena.bossSpawned = false;

        this.bossArenaPlaced = true;
        this.bossArenaTier = tier;

        // Warning message
        const bossNames = ["", "CAVE CRYPTID", "HOLLOW HORROR", "VOID TERROR"];
        const bossName = bossNames[tier];
        if (caveDeps.showOverlayMessage) {
            caveDeps.showOverlayMessage(`${bossName} LAIR AHEAD - ENTER TO CONFRONT`, "#fa0", 3000);
        }
    }

    checkArenaEntry() {
        if (!GameContext.player || !GameContext.caveBossArena || GameContext.caveBossArena.bossSpawned) return;

        const pdx = GameContext.player.pos.x - GameContext.caveBossArena.x;
        const pdy = GameContext.player.pos.y - GameContext.caveBossArena.y;
        const pdist = Math.hypot(pdx, pdy);

        // Player entered the arena circle - spawn boss immediately
        if (pdist < GameContext.caveBossArena.radius) {  // Enter arena radius
            this.spawnBossFromArena();
        }
    }

    spawnBossFromArena() {
        const tier = this.bossArenaTier;
        const arenaY = GameContext.caveBossArena.y;

        // Spawn boss at arena center
        const boss = createCaveMonsterBoss(0, arenaY, tier);
        GameContext.enemies.push(boss);
        GameContext.boss = boss;
        GameContext.bossActive = true;

        // Activate arena (lock player in)
        GameContext.caveBossArena.active = true;
        GameContext.caveBossArena.bossSpawned = true;

        const bossNames = ["", "CAVE CRYPTID", "HOLLOW HORROR", "VOID TERROR"];
        const bossName = bossNames[tier];

        if (caveDeps.showOverlayMessage) {
            caveDeps.showOverlayMessage(`${bossName} ENGAGED - ARENA LOCKED`, "#f00", 3000);
        }
        if (caveDeps.playSound) {
            caveDeps.playSound('boss_spawn');
        }
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

    /**
     * Clean up all entities and resources in the cave level
     */
    cleanup() {
        this.active = false;
        
        // Clean up all entity arrays
        const entityArrays = [
            this.wallTurrets,
            this.switches,
            this.relays,
            this.rewards,
            this.gasVents,
            this.draftZones,
            this.critters,
            this.rockfalls
        ];
        
        for (const arr of entityArrays) {
            if (arr && arr.length > 0) {
                for (let i = 0; i < arr.length; i++) {
                    const entity = arr[i];
                    if (entity) {
                        entity.dead = true;
                        if (typeof entity.kill === 'function') {
                            try { entity.kill(); } catch (e) { }
                        }
                        if (typeof pixiCleanupObject === 'function') {
                            try { pixiCleanupObject(entity); } catch (e) { }
                        }
                    }
                }
                arr.length = 0;
            }
        }
        
        // Clean up PixiJS graphics
        this.cleanupPixi();
        
        // Clear other arrays
        this.buckets = [];
        this.leftPts = [];
        this.rightPts = [];
        this.innerSegments = [];
        this.doors = [];
        this.gates = [];
        this.arenaSegments = [];
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

    drawCaveBossArena(ctx) {
        if (!this.bossArenaPlaced) return;

        const arena = GameContext.caveBossArena;
        // Don't draw arena if boss was spawned but is now dead
        if (arena.bossSpawned && (!GameContext.bossActive || !GameContext.boss || GameContext.boss.dead)) return;

        const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.3;

        ctx.save();
        ctx.translate(arena.x, arena.y);

        // Color changes when active (locked)
        const isActive = arena.active;
        ctx.strokeStyle = isActive ?
            `rgba(255,50,50,${0.5 + pulse * 0.3})` :    // Red when locked
            `rgba(255,200,50,${0.25 + pulse * 0.15})`;  // Orange when waiting
        ctx.lineWidth = 12;
        ctx.shadowBlur = isActive ? 40 : 20;
        ctx.shadowColor = isActive ? '#f00' : '#fa0';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.arc(0, 0, arena.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
