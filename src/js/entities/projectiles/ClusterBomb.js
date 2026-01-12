import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { Bullet } from './Bullet.js';
import { colorToPixi } from '../../rendering/colors.js';
import { pixiBulletLayer, pixiBulletSpritePool, allocPixiSprite, pixiCleanupObject, getRenderAlpha } from '../../rendering/pixi-context.js';

let _spawnFieryExplosion = null;
let _pixiBulletTextures = null;

export function registerClusterBombDependencies(deps) {
    if (deps.spawnFieryExplosion) _spawnFieryExplosion = deps.spawnFieryExplosion;
    if (deps.pixiBulletTextures) _pixiBulletTextures = deps.pixiBulletTextures;
}

export class ClusterBomb extends Entity {
    constructor(x, y, angle, owner, splitCount = 4, splitDistance = 400) {
        super(x, y);
        this._poolType = 'bullet';
        this.sprite = null;
        this.angle = angle;
        this.owner = owner;
        this.splitCount = splitCount;
        this.splitDistance = splitDistance;
        this.speed = 12;
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = Math.sin(angle) * this.speed;
        this.radius = 8;
        this.damage = 8;
        this.isEnemy = true;
        this.dead = false;
        this.hasSplit = false;
        this.color = '#f80';
        this.startX = x;
        this.startY = y;
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead) return;

        super.update(deltaTime);

        const dist = Math.hypot(this.pos.x - this.startX, this.pos.y - this.startY);
        if (dist >= this.splitDistance && !this.hasSplit) {
            this.split();
        }
    }

    split() {
        this.hasSplit = true;
        this.dead = true;

        const spreadAngle = 0.3;
        const startAngle = this.angle - spreadAngle / 2;
        const angleStep = this.splitCount > 1 ? spreadAngle / (this.splitCount - 1) : 0;

        for (let i = 0; i < this.splitCount; i++) {
            const a = this.splitCount > 1 ? startAngle + (i * angleStep) : this.angle + (Math.random() - 0.5) * spreadAngle;
            const b = new Bullet(this.pos.x, this.pos.y, a, 10, {
                owner: 'enemy',
                damage: this.damage,
                radius: 5,
                color: this.color,
                life: 60
            });
            b.owner = this.owner;
            GameContext.bullets.push(b);
        }

        if (_spawnFieryExplosion) _spawnFieryExplosion(this.pos.x, this.pos.y, 0.8);
        playSound('shotgun');
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        if (pixiBulletLayer && _pixiBulletTextures?.glow) {
            let spr = this.sprite;
            const size = (this.radius || 8) * 2;

            if (!spr) {
                spr = allocPixiSprite(pixiBulletSpritePool, pixiBulletLayer, _pixiBulletTextures.glow, size);
                this.sprite = spr;
                this._poolType = 'bullet';
            }

            if (spr) {
                const rPos = this.getRenderPos(getRenderAlpha());
                if (!spr.parent) pixiBulletLayer.addChild(spr);
                spr.visible = true;
                spr.position.set(rPos.x, rPos.y);
                spr.rotation = this.angle;
                spr.width = size * 4;
                spr.height = size * 4;
                spr.tint = colorToPixi(this.color || '#f80');
                spr.alpha = 1;
            }
        }
    }
}
