import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { pixiCleanupObject, pixiBulletLayer, getRenderAlpha } from '../../rendering/pixi-context.js';

let _emitParticle = null;
let _spawnAsteroidExplosion = null;
let _awardNuggetsInstant = null;

/**
 * @param {object} deps
 * @returns {void}
 */
export function registerShootingStarDependencies(deps) {
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
    if (deps.spawnAsteroidExplosion) _spawnAsteroidExplosion = deps.spawnAsteroidExplosion;
    if (deps.awardNuggetsInstant) _awardNuggetsInstant = deps.awardNuggetsInstant;
}

export class ShootingStar extends Entity {
    constructor() {
        super(0, 0);
        this.isShootingStar = true;
        const angle = Math.random() * Math.PI * 2;
        const dist = 2500;
        this.pos.x = GameContext.player.pos.x + Math.cos(angle) * dist;
        this.pos.y = GameContext.player.pos.y + Math.sin(angle) * dist;

        const targetX = GameContext.player.pos.x + (Math.random() - 0.5) * 1000;
        const targetY = GameContext.player.pos.y + (Math.random() - 0.5) * 1000;
        const travelAngle = Math.atan2(targetY - this.pos.y, targetX - this.pos.x);

        this.vel.x = Math.cos(travelAngle) * 15;
        this.vel.y = Math.sin(travelAngle) * 15;

        this.radius = 40;
        this.damage = 10;
        this.hp = 3;
        this.life = 300;
        this._pixiGfx = null;
    }

    update(deltaTime = SIM_STEP_MS) {
        super.update(deltaTime);
        const dtFactor = deltaTime / 16.67;
        this.life -= dtFactor;
        if (this.life <= 0) this.kill(false);

        if (_emitParticle) {
            for (let i = 0; i < 5; i++) {
                _emitParticle(
                    this.pos.x + (Math.random() - 0.5) * 20,
                    this.pos.y + (Math.random() - 0.5) * 20,
                    -this.vel.x * 0.2 + (Math.random() - 0.5) * 2,
                    -this.vel.y * 0.2 + (Math.random() - 0.5) * 2,
                    '#ffaa00',
                    30
                );
            }
        }
    }

    takeHit(dmg = 1) {
        if (this.dead) return;
        this.hp -= dmg;
        if (this.hp <= 0) this.kill(true);
    }

    kill(dropNugz = false) {
        if (this.dead) return;
        this.dead = true;
        pixiCleanupObject(this);
        if (dropNugz) {
            if (_spawnAsteroidExplosion) _spawnAsteroidExplosion(this.pos.x, this.pos.y, 1.4);
            const count = Math.floor(Math.random() * 7);
            // Award nuggets directly
            if (_awardNuggetsInstant && count > 0) _awardNuggetsInstant(count, { noSound: false, sound: 'coin' });
        }
    }

    draw(ctx) {
        if (this.dead) {
            pixiCleanupObject(this);
            return;
        }

        const rPos = this.getRenderPos(getRenderAlpha());

        if (pixiBulletLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                g.beginFill(0xffffff, 0.2);
                g.drawCircle(0, 0, 40);
                g.beginFill(0xffaa00, 0.4);
                g.drawCircle(0, 0, 25);
                g.beginFill(0xffffff, 0.8);
                g.drawCircle(0, 0, 10);

                pixiBulletLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.position.set(rPos.x, rPos.y);
            return;
        }
    }
}
