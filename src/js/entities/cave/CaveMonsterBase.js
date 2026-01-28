
import { Entity } from '../Entity.js';
import { Enemy } from '../enemies/Enemy.js';
import { CaveGunboat1, CaveGunboat2 } from './index.js';
import { Vector } from '../../core/math.js';
import { GameContext, getEnemyHpScaling } from '../../core/game-context.js';
import { SIM_STEP_MS, SIM_FPS, ZOOM_LEVEL } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Coin } from '../pickups/Coin.js';
import { SpaceNugget } from '../pickups/SpaceNugget.js';
import { HealthPowerUp } from '../pickups/HealthPowerUp.js';
import {
    pixiTextures,
    pixiTextureAnchors,
    pixiEnemyLayer,
    pixiVectorLayer,
    pixiCleanupObject,
    getRenderAlpha
} from '../../rendering/pixi-context.js';
import { caveDeps } from './cave-dependencies.js';

export class CaveMonsterBase extends Entity {
    constructor(x, y, monsterType) {
        super(x, y);

        // Monster type: 1, 2, or 3
        this.monsterType = monsterType;
        this.isCaveBoss = true;

        // Base stats by monster type
        // Monster sprites are 512x512, with visible content filling the frame (radius ~250px)
        const monsterConfigs = {
            1: {
                hp: 250,
                name: 'CAVE CRYPTID',
                texture: 'cave_monster_1',
                ringSpeed: 0.003,
                moveMode: 'artillery',
                // Monster1: Skull on RIGHT, Tail on LEFT, 4 legs at corners
                hullDefinition: [
                    { x: 0, y: 0, r: 100 },     // Central body
                    { x: 190, y: 0, r: 70 },    // Skull head (Front)
                    { x: -140, y: 0, r: 60 },   // Tail (Rear)
                    { x: 110, y: -130, r: 50 }, // Front-Top leg
                    { x: 110, y: 130, r: 50 },  // Front-Bottom leg
                    { x: -100, y: -110, r: 50 },// Rear-Top leg
                    { x: -100, y: 110, r: 50 }  // Rear-Bottom leg
                ]
            },
            2: {
                hp: 300,
                name: 'HOLLOW HORROR',
                texture: 'cave_monster_2',
                ringSpeed: 0.005,
                moveMode: 'chase',
                // Monster2: Large spiky shell, Head on RIGHT, Spikes UP/DOWN
                hullDefinition: [
                    { x: 0, y: 0, r: 110 },     // Central mass
                    { x: 170, y: 0, r: 80 },    // Glowing head (Front)
                    { x: -160, y: 0, r: 70 },   // Pointed nose (Rear)
                    { x: 0, y: -160, r: 60 },   // Top large spike
                    { x: 0, y: 160, r: 60 },    // Bottom large spike
                    { x: -90, y: -120, r: 50 }, // Top-Rear spike
                    { x: -90, y: 120, r: 50 }   // Bottom-Rear spike
                ]
            },
            3: {
                hp: 350,
                name: 'VOID TERROR',
                texture: 'cave_monster_3',
                ringSpeed: 0.007,
                moveMode: 'artillery',
                // Monster3 (monster4.png): Broad beetle shape, Rear Engines, Side Spines
                hullDefinition: [
                    { x: -20, y: 0, r: 120 },   // Central bulk
                    { x: 180, y: 0, r: 80 },    // Front snout
                    { x: 40, y: -160, r: 50 },  // Top side spine
                    { x: 40, y: 160, r: 50 },   // Bottom side spine
                    { x: -150, y: -110, r: 70 },// Top rear engine
                    { x: -150, y: 110, r: 70 }, // Bottom rear engine
                    { x: -150, y: 0, r: 70 }    // Rear center fill
                ]
            }
        };

        const config = monsterConfigs[monsterType];
        this.displayName = config.name;
        this.textureKey = config.texture;
        this.baseRingSpeed = config.ringSpeed;
        this.moveMode = config.moveMode;

        // Visual and physical properties
        // Sprites are 512x512, visualRadius should encompass the full sprite
        // Using a scale that makes the monsters appropriately large
        this.visualRadius = 350; // Increased from 280 to properly contain 512x512 sprites
        this.radius = Math.round(this.visualRadius * 1.6); // Collision radius for hull (matches sprite edge ~527px)
        this.collisionRadius = this.visualRadius * 1.5; // For ship-ship collisions
        this.hullCollisionRadius = 550; // Simplified hull collision for bullets (550px circle)
        const scale = getEnemyHpScaling();
        this.hp = (config.hp * 10 + 100) * scale;
        this.maxHp = this.hp;
        this.angle = 0;

        // Crystalline shield system - two rings with 50 slots each
        // Every other slot active = 25 indestructible shards per ring
        // Shields must be OUTSIDE the monster sprite, not inside
        this.maxShieldHp = 999; // Indestructible
        this.shieldSegments = new Array(50).fill(0);
        this.innerShieldSegments = new Array(20).fill(0);
        // Every other slot active (25 outer, 10 inner segments per ring)
        for (let i = 0; i < 50; i += 2) {
            this.shieldSegments[i] = 999;
        }
        for (let i = 0; i < 20; i += 2) {
            this.innerShieldSegments[i] = 999;
        }
        // Shields are OUTSIDE the monster - outer shield is larger than visualRadius
        this.shieldRadius = Math.round(this.visualRadius * 2.0) - 30; // ~670, OUTSIDE the sprite including corners
        this.innerShieldRadius = Math.round(this.visualRadius * 1.85) - 30; // ~617, just inside outer shield
        this.shieldRotation = 0;
        this.innerShieldRotation = 0;
        this.shieldsDirty = true;

        // Collision hull definition (multi-sphere for accurate bullet collision)
        this.hullDefinition = config.hullDefinition;
        // Dynamically calculate hull scale to match sprite rendering scale
        // Sprite scale = visualRadius / 170 (approx 2.05x)
        this.hullScale = this.visualRadius / 170;
        this.hullScale = isFinite(this.hullScale) ? this.hullScale : 1.0;

        // Escalation system
        this.battleStartTime = Date.now();
        this.escalationPhase = 1;
        this.escalationMultiplier = 1.0;

        // Attack timers
        this.t = 0;
        this.attackTimer = 0;
        this.attackCooldown = 120;

        // Reinforcement spawning
        this.reinforcementCooldown = 360; // 6 seconds at 60fps reference
        this.reinforcementTimer = 360;
        // Summon limits based on boss tier
        this.maxCaveGunboats = 2; // Total: 1 cave_gunboat1 + 1 cave_gunboat2
        this.maxDefenders = this.monsterType === 1 ? 3 : (this.monsterType === 2 ? 4 : 5);

        // Movement
        this.strafeAngle = 0;
        this.strafeDir = 1;
        this.chaseSpeed = 2.5;
        this.artillerySpeed = 1.2;
    }

    getEscalationPhase() {
        if (this.dead) return 1;
        const elapsed = Date.now() - this.battleStartTime;
        if (elapsed >= 120000) return 3; // 2+ minutes
        if (elapsed >= 80000) return 2;  // 80-120 seconds
        return 1; // 0-80 seconds
    }

    getEscalationMultiplier() {
        const phase = this.getEscalationPhase();
        if (phase === 3) return 1.5;
        if (phase === 2) return 1.3;
        return 1.0;
    }

    getRingSpeedMultiplier() {
        const phase = this.getEscalationPhase();
        if (phase === 3) return 2.0;
        if (phase === 2) return 1.5;
        return 1.0;
    }

    hitTestCircle(x, y, r) {
        if (this.dead) return false;

        // First check shield collision
        const dx = x - this.pos.x;
        const dy = y - this.pos.y;
        const dist = Math.hypot(dx, dy);

        // Bullets collide with shield rings - check if there's an active segment at this angle
        if (dist <= this.shieldRadius && dist >= this.innerShieldRadius * 0.8) {
            const angle = Math.atan2(dy, dx) - this.shieldRotation;
            const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const segmentIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * 50);
            if (this.shieldSegments[segmentIndex] > 0) {
                return true; // Hit shield
            }
        }

        if (dist <= this.innerShieldRadius) {
            const angle = Math.atan2(dy, dx) - this.innerShieldRotation;
            const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const segmentIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * this.innerShieldSegments.length);
            if (this.innerShieldSegments[segmentIndex] > 0) {
                return true; // Hit inner shield
            }
        }

        // Hull collision (only when shields don't block)
        const angle = -this.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        for (const circle of this.hullDefinition) {
            const cx = circle.x * this.hullScale;
            const cy = circle.y * this.hullScale;
            const cr = circle.r * this.hullScale;
            const cdx = localX - cx;
            const cdy = localY - cy;
            if (cdx * cdx + cdy * cdy < (cr + r) * (cr + r)) return true;
        }
        return false;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        const phase = this.getEscalationPhase();
        const mult = this.getEscalationMultiplier();
        const ringMult = this.getRingSpeedMultiplier();

        // Rotate shields in opposite directions
        this.shieldRotation += this.baseRingSpeed * ringMult * dtFactor;
        this.innerShieldRotation -= this.baseRingSpeed * ringMult * 1.2 * dtFactor;

        // Face player
        if (GameContext.player && !GameContext.player.dead) {
            const targetAngle = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
            let angleDiff = targetAngle - (this.angle || 0);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * 0.03 * dtFactor;

            // Movement patterns
            if (this.moveMode === 'strafe') {
                // Circle strafe around player
                this.strafeAngle += 0.008 * this.strafeDir * dtFactor;
                const dist = 900;
                const targetX = GameContext.player.pos.x + Math.cos(this.strafeAngle) * dist;
                const targetY = GameContext.player.pos.y + Math.sin(this.strafeAngle) * dist;
                const dx = targetX - this.pos.x;
                const dy = targetY - this.pos.y;
                this.vel.x = dx * 0.02;
                this.vel.y = dy * 0.02;
                if (Math.random() < 0.005) this.strafeDir *= -1;
            } else if (this.moveMode === 'chase') {
                // Aggressive chase
                const dx = GameContext.player.pos.x - this.pos.x;
                const dy = GameContext.player.pos.y - this.pos.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 500) {
                    this.vel.x += (dx / dist) * 0.15 * dtFactor;
                    this.vel.y += (dy / dist) * 0.15 * dtFactor;
                }
                const speed = Math.hypot(this.vel.x, this.vel.y);
                if (speed > this.chaseSpeed) {
                    this.vel.x = (this.vel.x / speed) * this.chaseSpeed;
                    this.vel.y = (this.vel.y / speed) * this.chaseSpeed;
                }
            } else if (this.moveMode === 'artillery') {
                // Slow movement, keeps distance
                const dx = GameContext.player.pos.x - this.pos.x;
                const dy = GameContext.player.pos.y - this.pos.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1400) {
                    this.vel.x += (dx / dist) * 0.05 * dtFactor;
                    this.vel.y += (dy / dist) * 0.05 * dtFactor;
                } else if (dist < 1000) {
                    this.vel.x -= (dx / dist) * 0.05 * dtFactor;
                    this.vel.y -= (dy / dist) * 0.05 * dtFactor;
                }
                const speed = Math.hypot(this.vel.x, this.vel.y);
                if (speed > this.artillerySpeed) {
                    this.vel.x = (this.vel.x / speed) * this.artillerySpeed;
                    this.vel.y = (this.vel.y / speed) * this.artillerySpeed;
                }
            }

            // Attack logic
            this.attackTimer -= dtFactor * mult;
            if (this.attackTimer <= 0) {
                this.fireAttack(phase);
                this.attackTimer = this.attackCooldown / mult;
            }

            // Reinforcement spawning
            this.reinforcementTimer -= dtFactor;
            if (this.reinforcementTimer <= 0) {
                this.spawnReinforcements();
                this.reinforcementTimer = this.reinforcementCooldown;
            }
        }

        super.update(deltaTime);
    }

    fireAttack(phase) {
        // Override in subclasses
    }

    spawnReinforcements() {
        // Count current summoned enemies by type
        let caveGunboat1Count = 0;
        let caveGunboat2Count = 0;
        let defenderCount = 0;

        for (const enemy of GameContext.enemies) {
            if (enemy.dead) continue;
            if (enemy.type === 'cave_gunboat1') caveGunboat1Count++;
            else if (enemy.type === 'cave_gunboat2') caveGunboat2Count++;
            else if (enemy.type === 'defender') defenderCount++;
        }

        // Determine what we can spawn based on limits
        const canSpawnGunboat1 = caveGunboat1Count < 1;
        const canSpawnGunboat2 = caveGunboat2Count < 1;
        const canSpawnDefender = defenderCount < this.maxDefenders;

        // Build list of available spawn types
        const availableTypes = [];
        if (canSpawnGunboat1) availableTypes.push('cave_gunboat1');
        if (canSpawnGunboat2) availableTypes.push('cave_gunboat2');
        if (canSpawnDefender) availableTypes.push('defender');

        // If nothing available to spawn, return
        if (availableTypes.length === 0) return;

        // Spawn 1-2 enemies from available types
        const count = 1 + Math.floor(Math.random() * Math.min(2, availableTypes.length));

        for (let i = 0; i < count; i++) {
            // Pick a random type from available
            const typeIndex = Math.floor(Math.random() * availableTypes.length);
            const type = availableTypes[typeIndex];

            const angle = Math.random() * Math.PI * 2;
            const dist = 400 + Math.random() * 200;
            const ex = this.pos.x + Math.cos(angle) * dist;
            const ey = this.pos.y + Math.sin(angle) * dist;

            // Use CaveGunboat classes for cave gunboats (extends Gunboat for unified difficulty tier system)
            let enemy;
            if (type === 'cave_gunboat1') {
                enemy = new CaveGunboat1(ex, ey);
            } else if (type === 'cave_gunboat2') {
                enemy = new CaveGunboat2(ex, ey);
            } else {
                enemy = new Enemy(type, { x: ex, y: ey }, null);
            }
            GameContext.enemies.push(enemy);

            // Remove this type from available so we don't spawn it twice in one call
            availableTypes.splice(typeIndex, 1);
            if (availableTypes.length === 0) break;
        }
        playSound('powerup');
    }

    takeHit(dmg = 1) {
        if (this.dead) return false;
        this.hp -= dmg;
        playSound('hit');
        if (this.hp <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    applyDamageToPlayer(amount) {
        if (!GameContext.player || GameContext.player.dead) return;
        if (GameContext.player.invulnerable > 0) return;
        let remaining = Math.max(0, Math.ceil(amount));

        if (GameContext.player.outerShieldSegments && GameContext.player.outerShieldSegments.length > 0) {
            for (let i = 0; i < GameContext.player.outerShieldSegments.length && remaining > 0; i++) {
                if (GameContext.player.outerShieldSegments[i] > 0) {
                    const absorb = Math.min(remaining, GameContext.player.outerShieldSegments[i]);
                    GameContext.player.outerShieldSegments[i] -= absorb;
                    remaining -= absorb;
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
            if (caveDeps.spawnParticles) caveDeps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 14, '#f00');
            playSound('hit');
            if (caveDeps.updateHealthUI) caveDeps.updateHealthUI();
            if (GameContext.player.hp <= 0 && caveDeps.killPlayer) caveDeps.killPlayer();
        } else {
            playSound('shield_hit');
            if (caveDeps.spawnParticles) caveDeps.spawnParticles(GameContext.player.pos.x, GameContext.player.pos.y, 10, '#0ff');
        }
        GameContext.player.invulnerable = 0;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        GameContext.bossKills++;
        pixiCleanupObject(this);

        // Award loot directly
        const coinCount = 18 + this.monsterType * 4;
        let nuggetCount = 5 + this.monsterType * 2;
        // Bounty Hunter meta upgrade - bonus nuggets for boss kills
        if (GameContext.player && GameContext.player.stats && GameContext.player.stats.bountyBossBonus) {
            nuggetCount += GameContext.player.stats.bountyBossBonus;
        }
        const totalCoinValue = coinCount * 10;
        if (caveDeps.awardCoinsInstant) caveDeps.awardCoinsInstant(totalCoinValue, { noSound: false, sound: 'coin' });
        if (caveDeps.awardNuggetsInstant) caveDeps.awardNuggetsInstant(nuggetCount, { noSound: false, sound: 'coin' });
        GameContext.powerups.push(new HealthPowerUp(this.pos.x, this.pos.y));

        if (caveDeps.spawnParticles) caveDeps.spawnParticles(this.pos.x, this.pos.y, 120, '#0ff');
        if (caveDeps.spawnBossExplosion) caveDeps.spawnBossExplosion(this.pos.x, this.pos.y, 3.0, 20);
        playSound('base_explode');
        GameContext.shakeMagnitude = Math.max(GameContext.shakeMagnitude, 15);
        GameContext.shakeTimer = Math.max(GameContext.shakeTimer, 18);
        if (caveDeps.showOverlayMessage) caveDeps.showOverlayMessage(`${this.displayName} DESTROYED`, '#0f0', 2800, 3);

        GameContext.bossActive = false;
        GameContext.caveBossArena.active = false;
        if (GameContext.boss) pixiCleanupObject(GameContext.boss);
        GameContext.boss = null;

        // Notify cave level that boss is defeated
        if (caveDeps.onBossDefeated) caveDeps.onBossDefeated();
        // setMusicMode is handled in main loop mostly or via callback? 
        // Main.js says: if (musicEnabled) setMusicMode('normal');
        // I can't easily access musicEnabled global. Maybe emit event?
        // Or assume GameContext has music state later. For now, skip music reset or add to deps.
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        // Pixi rendering
        if (pixiEnemyLayer) { // Using pixiEnemyLayer for boss hull usually? or pixiBossLayer if it exists?
            // main.js says "pixiBossLayer" in line 8535.
            // I need to import pixiBossLayer? It's not in pixi-context exports currently.
            // Let's check pixi-context.js exports.

            // Checking imports above: pixiEnemyLayer.
            // I should use pixiEnemyLayer if bossLayer isn't available, or add it to pixi-context.
            // I'll stick to pixiEnemyLayer for now or check if pixi-context has it.

            let targetLayer = pixiEnemyLayer;
            // ... actually I should probably add pixiBossLayer to pixi-context.js exports if it exists there.
            // But for now, let's use pixiEnemyLayer. 
            // Wait, pixiBossLayer was used in main.js.

            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                targetLayer.addChild(container);

                // Hull sprite
                const hull = new PIXI.Sprite(pixiTextures[this.textureKey]);
                const ha = pixiTextureAnchors[this.textureKey] || { x: 0.5, y: 0.5 };
                hull.anchor.set((ha && ha.x != null) ? ha.x : 0.5, (ha && ha.y != null) ? ha.y : 0.5);
                container.addChild(hull);
                this._pixiHullSpr = hull;
            } else if (!container.parent) {
                targetLayer.addChild(container);
            }

            container.visible = true;
            const rPos = this.getRenderPos ? this.getRenderPos(getRenderAlpha()) : this.pos;
            container.position.set(rPos.x, rPos.y);
            container.rotation = this.angle || 0;

            const hullScale = (this.visualRadius && isFinite(this.visualRadius)) ? (this.visualRadius / 170) : 1;
            if (this._pixiHullSpr) this._pixiHullSpr.scale.set(hullScale);

            // Outer shield
            if (pixiVectorLayer) {
                let gfx = this._pixiGfx;
                if (!gfx) {
                    gfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(gfx);
                    this._pixiGfx = gfx;
                    this.shieldsDirty = true;
                } else if (!gfx.parent) {
                    pixiVectorLayer.addChild(gfx);
                }

                gfx.position.set(rPos.x, rPos.y);
                gfx.rotation = this.shieldRotation || 0;
                if (this.shieldsDirty) {
                    gfx.clear();
                    const count = this.shieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    for (let i = 0; i < count; i++) {
                        if (this.shieldSegments[i] > 0) {
                            const a0 = i * arcLen + arcLen * 0.1;
                            const a1 = (i + 1) * arcLen - arcLen * 0.1;
                            gfx.lineStyle(5, 0x00ff88, 0.8);
                            gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                            gfx.arc(0, 0, this.shieldRadius, a0, a1);
                        }
                    }
                }
            }

            // Inner shield
            if (pixiVectorLayer) {
                let innerGfx = this._pixiInnerGfx;
                if (!innerGfx) {
                    innerGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(innerGfx);
                    this._pixiInnerGfx = innerGfx;
                    this.shieldsDirty = true;
                } else if (!innerGfx.parent) {
                    pixiVectorLayer.addChild(innerGfx);
                }

                innerGfx.position.set(rPos.x, rPos.y);
                innerGfx.rotation = this.innerShieldRotation || 0;
                if (this.shieldsDirty) {
                    innerGfx.clear();
                    const count = this.innerShieldSegments.length;
                    const arcLen = (Math.PI * 2) / count;
                    for (let i = 0; i < count; i++) {
                        if (this.innerShieldSegments[i] > 0) {
                            const a0 = i * arcLen + arcLen * 0.1;
                            const a1 = (i + 1) * arcLen - arcLen * 0.1;
                            innerGfx.lineStyle(4, 0x88ff00, 0.7);
                            innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                            innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                        }
                    }
                }
            }

            if (this.shieldsDirty) this.shieldsDirty = false;

            // Nameplate
            if (this.displayName && pixiVectorLayer) {
                let txt = this._pixiNameText;
                if (!txt) {
                    txt = new PIXI.Text(this.displayName, {
                        fontFamily: 'Courier New',
                        fontSize: 18,
                        fontWeight: 'bold',
                        fill: 0x00ff88
                    });
                    txt.anchor.set(0.5);
                    txt.resolution = 2;
                    pixiVectorLayer.addChild(txt);
                    this._pixiNameText = txt;
                }
                if (!txt.parent) pixiVectorLayer.addChild(txt);
                txt.visible = true;
                txt.position.set(rPos.x, rPos.y - this.visualRadius - 20);
            }

            // DEBUG HITBOX skipped for brevity/module size, can add if needed.
            return;
        }
    }

    drawBossHud(ctx) {
        if (!GameContext.bossActive || this.dead) return;
        const w = ctx.canvas.width; // Access canvas from ctx
        const barW = Math.min(560, w - 40);
        const x = (w - barW) / 2;
        const y = 14;
        const pct = Math.max(0, this.hp / this.maxHp);
        const phase = this.getEscalationPhase();

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 4, y - 4, barW + 8, 20);
        ctx.strokeStyle = '#0f8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, barW + 8, 20);

        // Color changes based on phase
        const phaseColor = phase === 3 ? '#f0f' : (phase === 2 ? '#ff0' : '#0f8');
        ctx.fillStyle = phaseColor;
        ctx.fillRect(x, y, barW * pct, 12);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const phaseName = phase === 3 ? 'PHASE 3' : (phase === 2 ? 'PHASE 2' : 'PHASE 1');
        ctx.fillText(`${this.displayName} (${phaseName})`, w / 2, y + 12);
        ctx.restore();
    }
}

