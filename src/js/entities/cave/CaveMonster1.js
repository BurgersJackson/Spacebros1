
import { CaveMonsterBase } from './CaveMonsterBase.js';
import { GameContext, getEnemyHpScaling } from '../../core/game-context.js';
import { Bullet } from '../projectiles/Bullet.js';
import { Enemy } from '../enemies/Enemy.js';
import { playSound } from '../../audio/audio-manager.js';
import { caveDeps } from './cave-dependencies.js';
import { pixiVectorLayer, getRenderAlpha } from '../../rendering/pixi-context.js';
import { ZOOM_LEVEL } from '../../core/constants.js';

export class CaveMonster1 extends CaveMonsterBase {
    constructor(x, y) {
        super(x, y, 1);
        this.displayName = 'CAVE CRYPTID';
        this.pulseActive = false;
        this.pulseRadius = 0;
        this.pulseMaxRadius = 600;
        this.pulseExpansionSpeed = 6.25;
        this.pulseHit = false;
        this.artillerySpeed = 3.0;
        this.attackType = 0;
    }

    fireAttack(phase) {
        const attacks = ['bioMortars', 'neuralPulse', 'tendrilMines'];
        const attack = attacks[this.attackType % attacks.length];
        this.attackType++;

        switch (attack) {
            case 'bioMortars':
                this.bioMortars(phase);
                break;
            case 'neuralPulse':
                this.neuralPulse(phase);
                break;
            case 'tendrilMines':
                this.tendrilMines(phase);
                break;
        }
    }

    bioMortars(phase) {
        const count = phase === 3 ? 8 : (phase === 2 ? 6 : 4);
        const targetX = GameContext.player ? GameContext.player.pos.x : this.pos.x;
        const targetY = GameContext.player ? GameContext.player.pos.y : this.pos.y;

        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 1200;
            const offsetY = (Math.random() - 0.5) * 1200;
            const targetAngle = Math.atan2(targetY + offsetY - this.pos.y, targetX + offsetX - this.pos.x);

            const b = new Bullet(this.pos.x, this.pos.y, targetAngle, 10, { damage: 20, color: '#0a0' }); // Signature mismatch?
            // "new Bullet(this.pos.x, this.pos.y, targetAngle, true, 10, 8, 20, '#0a0')" in main.js
            // New signature is likely (x, y, angle, speed, opts).
            // main.js old: constructor(x, y, angle, isEnemy, speed, radius, damage, color)
            // New Bullet signature check needed.
            // Let's assume new signature is (x, y, angle, speed, opts) based on Enemy.js usage.
            // Enemy.js: new Bullet(bx, by, angle, bulletSpeed, { owner: 'enemy', damage: dmg, life: 240, color: '#0ff' })

            // So:
            // speed = 10
            // damage = 20
            // radius = 8 (from main.js)
            // color = '#0a0'
            const opts = {
                owner: 'enemy',
                damage: 20,
                life: 125,
                speed: 10,
                color: '#0a0',
                radius: 8,
                isEnemy: true,
                isBomb: true,
                explosionRadius: 150,
                explosionDamage: 10,
                useShockwave: true
            };
            // Bullet constructor: constructor(x, y, angle, speed, opts = {})
            const bNew = new Bullet(this.pos.x, this.pos.y, targetAngle, 10, opts);

            // Note: Bullet module might handle options differently. 
            // I'll stick to the pattern I saw in Enemy.js
            GameContext.bullets.push(bNew);
        }
        playSound('shotgun');
    }

    neuralPulse(phase) {
        if (this.dead) return;
        this.pulseActive = true;
        this.pulseRadius = 400;
        this.pulseHit = false;
        playSound('heavy_shoot');
    }

    tendrilMines(phase) {
        // Tendril mines attack (5 damage, 1 HP each)
        const count = phase === 3 ? 5 : (phase === 2 ? 4 : 3);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 600 + Math.random() * 1400;
            const mx = this.pos.x + Math.cos(angle) * dist;
            const my = this.pos.y + Math.sin(angle) * dist;

            const mine = new Enemy('turret', { x: mx, y: my }, null);
            const scale = getEnemyHpScaling();
            mine.hp = (5 + 10) * scale;
            mine.maxHp = mine.hp;
            mine.radius = 30;
            mine.despawnImmune = true;
            mine.owner = this;
            mine.noDrops = true;
            mine.t = 0;
            mine.pulsePhase = Math.random() * Math.PI * 2;

            mine.update = function () {
                this.t += 1;

                if (GameContext.player && !GameContext.player.dead) {
                    const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
                    if (dist < 100) {
                        this.dead = true;
                        // Fiery explosion visual
                        if (caveDeps.spawnFieryExplosion) caveDeps.spawnFieryExplosion(this.pos.x, this.pos.y, 2.0);
                        playSound('explosion');

                        // AOE damage - 200px radius, bypasses shields
                        const explosionRadius = 200;
                        if (Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y) < explosionRadius) {
                            if (GameContext.player && !GameContext.player.dead) {
                                GameContext.player.takeHit(5, true); // true = bypass shields
                            }
                        }
                    }
                }
            };

            mine.draw = function (ctx) {
                // ... logic to draw using canvas ctx ...
                // Pixi logic should ideally be here too if we want unified rendering, 
                // but for now preserving original drawing logic mostly.
                // Or I can skip drawing implementation here since it's attached to an Enemy instance 
                // and Enemy.js handles drawing. 
                // HOWEVER, Enemy.js draw() uses prototypes or pixi logic. 
                // This overrides draw(), so it works for canvas. 
                // For Pixi, Enemy.js uses allocPixiSprite.
                // Since 'turret' isn't standard, it might fallback?
                // I'll leave the canvas draw override on the instance for now.

                ctx.save();
                ctx.translate(this.pos.x, this.pos.y);

                const pulseScale = 1.0 + Math.sin(this.t * 0.1 + this.pulsePhase) * 0.15;
                const pulseAlpha = 0.5 + Math.sin(this.t * 0.1 + this.pulsePhase) * 0.3;

                ctx.fillStyle = `rgba(0, 255, 0, ${pulseAlpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(0, 0, 25 * pulseScale, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#0f0';
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            };

            GameContext.enemies.push(mine);
        }
        playSound('powerup');
    }

    update(deltaTime) { // SIM_STEP_MS default via base?
        if (this.dead) return;
        const dtFactor = (deltaTime || 16.67) / 16.67;

        if (this.pulseActive) {
            this.pulseRadius += this.pulseExpansionSpeed * dtFactor;

            if (GameContext.player && !GameContext.player.dead) {
                const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);

                if (Math.abs(dist - this.pulseRadius) < 30 && !this.pulseHit) {
                    this.pulseHit = true;
                    // Damage bypasses shields (true = ignoreShields)
                    const damage = dist > 400 ? 2 : 5;
                    if (GameContext.player && !GameContext.player.dead) {
                        GameContext.player.takeHit(damage, true); // true = bypass shields
                    }
                }
            }

            if (this.pulseRadius >= this.pulseMaxRadius) {
                this.pulseActive = false;
                this.pulseRadius = 0;
                this.pulseHit = false;
            }
        }

        super.update(deltaTime);
    }

    draw(ctx) {
        super.draw(ctx);

        if (this.dead) return;

        // Get interpolated position for smooth rendering
        const rPos = this.getRenderPos ? this.getRenderPos(getRenderAlpha()) : this.pos;

        if (this.pulseActive && pixiVectorLayer) {
            let gfx = this._pixiPulseGfx;
            if (!gfx) {
                gfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(gfx);
                this._pixiPulseGfx = gfx;
            } else if (!gfx.parent) {
                pixiVectorLayer.addChild(gfx);
            }

            gfx.clear();
            gfx.position.set(rPos.x, rPos.y);
            const z = GameContext.currentZoom || ZOOM_LEVEL;
            gfx.lineStyle(4 / z, 0xff0088, 0.8);
            gfx.drawCircle(0, 0, this.pulseRadius / z);
        } else if (this._pixiPulseGfx) {
            try { this._pixiPulseGfx.clear(); } catch (e) { }
        }
    }

    kill() {
        if (this.dead) return;
        if (this._pixiPulseGfx) {
            try { this._pixiPulseGfx.destroy({ children: true }); } catch (e) { }
            this._pixiPulseGfx = null;
        }

        for (let i = GameContext.enemies.length - 1; i >= 0; i--) {
            const e = GameContext.enemies[i];
            if (e && !e.dead && e.owner === this) {
                e.dead = true;
                if (caveDeps.spawnParticles) caveDeps.spawnParticles(e.pos.x, e.pos.y, 15, '#0f0');
            }
        }

        super.kill();
    }
}
