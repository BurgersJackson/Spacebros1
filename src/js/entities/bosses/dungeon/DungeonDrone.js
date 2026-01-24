import { Entity } from '../../Entity.js';
import { GameContext, getEnemyHpScaling } from '../../../core/game-context.js';
import { SIM_STEP_MS, USE_PIXI_OVERLAY } from '../../../core/constants.js';
import { playSound } from '../../../audio/audio-manager.js';
import { Bullet } from '../../projectiles/Bullet.js';
import { pixiVectorLayer, getRenderAlpha } from '../../../rendering/pixi-context.js';

let _spawnParticles = null;

export function registerDungeonDroneDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
}

export class DungeonDrone extends Entity {
    constructor(parentBoss, orbitAngle = null) {
        const orbitRadius = 180 + Math.random() * 60;
        const angle = orbitAngle !== null ? orbitAngle : Math.random() * Math.PI * 2;
        const x = parentBoss.pos.x + Math.cos(angle) * orbitRadius;
        const y = parentBoss.pos.y + Math.sin(angle) * orbitRadius;
        super(x, y);

        this.parentBoss = parentBoss;
        this.orbitRadius = orbitRadius;
        this.orbitAngle = angle;
        this.orbitSpeed = 0.02 + Math.random() * 0.01;
        const scale = getEnemyHpScaling();
        this.hp = (15 + (GameContext.difficultyTier || 1)) * scale;
        this.maxHp = this.hp;
        this.radius = 18;
        this.fireCooldown = 40 + Math.floor(Math.random() * 20);
        this.t = 0;
        this._pixiGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;

        if (!this.parentBoss || this.parentBoss.dead) {
            this.kill();
            return;
        }

        this.orbitAngle += this.orbitSpeed * dtFactor;
        this.pos.x = this.parentBoss.pos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.pos.y = this.parentBoss.pos.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;

        this.fireCooldown -= dtFactor;
        if (this.fireCooldown <= 0 && GameContext.player && !GameContext.player.dead) {
            const aim = Math.atan2(GameContext.player.pos.y - this.pos.y, GameContext.player.pos.x - this.pos.x);
            GameContext.bullets.push(new Bullet(this.pos.x, this.pos.y, aim, 10, { owner: 'enemy', damage: 1, radius: 3, color: '#f80' }));
            playSound('shoot');
            this.fireCooldown = 50 + Math.floor(Math.random() * 30);
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const rPos = this.getRenderPos(getRenderAlpha());

        if (USE_PIXI_OVERLAY && pixiVectorLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                pixiVectorLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.clear();
            g.position.set(rPos.x, rPos.y);
            g.lineStyle(2 / (GameContext.currentZoom || 1), 0xff8800, 0.9);
            g.beginFill(0xff4400, 0.6);
            g.drawCircle(0, 0, this.radius);
            g.endFill();
            return;
        }

        ctx.save();
        ctx.translate(rPos.x, rPos.y);
        ctx.fillStyle = '#f40';
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    kill() {
        if (this.dead) return;
        this.dead = true;
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 10, '#f80');
        playSound('hit');
    }
}
