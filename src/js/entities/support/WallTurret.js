import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from '../projectiles/Bullet.js';
import { Coin } from '../pickups/Coin.js';
import { pixiVectorLayer, pixiCleanupObject } from '../../rendering/pixi-context.js';

let _spawnParticles = null;
let _awardCoinsInstant = null;

export function registerWallTurretDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.awardCoinsInstant) _awardCoinsInstant = deps.awardCoinsInstant;
}

export class WallTurret extends Entity {
    constructor(x, y, contractId = null, baseAngle = 0) {
        super(x, y);
        this.contractId = contractId;
        this.baseAngle = baseAngle;
        this.radius = 26;
        this.hp = 6;
        this.maxHp = 6;
        this.reload = 50 + Math.floor(Math.random() * 30);
        this.t = 0;
        this.shieldsDirty = true;
        this._pixiGfx = null;
        this._pixiHpGfx = null;
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        // Award coins directly: 3 coins * 2 value = 6 total
        if (_awardCoinsInstant) _awardCoinsInstant(6, { noSound: false, sound: 'coin' });
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 18, '#ff6');
        playSound('explode');
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        if (!GameContext.player || GameContext.player.dead) return;
        if (!GameContext.activeContract || GameContext.activeContract.type !== 'anomaly' || GameContext.activeContract.id !== this.contractId) return;

        const dist = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
        if (dist > 3600) return;

        this.reload -= dtFactor;
        if (this.reload > 0) return;

        const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
        const muzzleX = this.pos.x + Math.cos(aim) * (this.radius + 6);
        const muzzleY = this.pos.y + Math.sin(aim) * (this.radius + 6);
        GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#f80' }));
        if (Math.random() < 0.25) {
            GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim + 0.12, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#f80' }));
            GameContext.bullets.push(new Bullet(muzzleX, muzzleY, aim - 0.12, 12, { owner: 'enemy', damage: 1, radius: 4, color: '#f80' }));
        }
        this.reload = 55 + Math.floor(Math.random() * 30);
    }

    draw(ctx) {
        if (this.dead) return;

        const aim = (GameContext.player && !GameContext.player.dead) ? Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x) : this.baseAngle;

        if (pixiVectorLayer) {
            if (!this._pixiGfx) {
                this._pixiGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiGfx);

                this._pixiHpGfx = new PIXI.Graphics();
                pixiVectorLayer.addChild(this._pixiHpGfx);

                this.shieldsDirty = true;
            }
            if (!this._pixiGfx.parent) pixiVectorLayer.addChild(this._pixiGfx);
            if (!this._pixiHpGfx.parent) pixiVectorLayer.addChild(this._pixiHpGfx);

            if (this.shieldsDirty) {
                this._pixiGfx.clear();
                // Base
                this._pixiGfx.beginFill(0x111111, 1.0);
                this._pixiGfx.lineStyle(2, 0xff8800, 1.0);
                this._pixiGfx.drawCircle(0, 0, this.radius);
                this._pixiGfx.endFill();
                // Barrel
                this._pixiGfx.beginFill(0xff8800, 1.0);
                this._pixiGfx.drawRect(this.radius * 0.2, -5, this.radius * 1.25, 10);
                this._pixiGfx.endFill();
                // Core
                this._pixiGfx.beginFill(0x222222, 1.0);
                this._pixiGfx.drawCircle(0, 0, 8);
                this._pixiGfx.endFill();

                this.shieldsDirty = false;
            }

            this._pixiGfx.position.set(this.pos.x, this.pos.y);
            this._pixiGfx.rotation = aim;

            // HP ring
            const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
            this._pixiHpGfx.clear();
            this._pixiHpGfx.lineStyle(3, 0xffff66, 0.75);
            this._pixiHpGfx.arc(this.pos.x, this.pos.y, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            this._pixiHpGfx.visible = true;

            return;
        }

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(aim);

        // Base
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#f80';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f80';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Barrel
        ctx.fillStyle = '#f80';
        ctx.fillRect(this.radius * 0.2, -5, this.radius * 1.25, 10);

        // Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // HP ring
        const pct = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#ff6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();

        ctx.restore();
    }
}
