/**
 * CruiserMineBomb.js
 * Boss projectile: Floating mine that chases or drifts and explodes.
 */

import { Entity } from '../Entity.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';
import { playSound } from '../../audio/audio-manager.js';
import { pixiBulletLayer, pixiCleanupObject, getRenderAlpha } from '../../rendering/pixi-context.js';
import { colorToPixi } from '../../rendering/colors.js';
import { Shockwave } from './Shockwave.js';

// Dependency placeholders
let _spawnParticles = null;
let _emitParticle = null;

/**
 * Register dependencies from main.js logic.
 */
export function registerCruiserMineBombDependencies(deps) {
    if (deps.spawnParticles) _spawnParticles = deps.spawnParticles;
    if (deps.emitParticle) _emitParticle = deps.emitParticle;
}

export class CruiserMineBomb extends Entity {
    constructor(owner, angle, maxTravel, damage, blastRadius) {
        super(owner.pos.x, owner.pos.y);
        this.owner = owner;
        this.angle = angle;
        this.speed = 13.0;
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = Math.sin(angle) * this.speed;
        this.radius = 14;
        this.damage = damage;
        this.blastRadius = blastRadius;
        this.maxTravel = maxTravel;
        // Proximity fuse so the mine can detonate early if the player gets too close.
        this.proximityFuseRadius = Math.max(260, Math.min(520, this.blastRadius * 0.55));
        this.startX = this.pos.x;
        this.startY = this.pos.y;
        this.t = 0;

        // Spawn around the cruiser, not on the center
        const off = (owner.radius * 0.75) + 18;
        this.pos.x += Math.cos(angle) * off;
        this.pos.y += Math.sin(angle) * off;
        this.startX = this.pos.x;
        this.startY = this.pos.y;

        // Set prevPos to prevent ghosting on first render
        this.prevPos = { x: this.pos.x, y: this.pos.y };

        this._pixiGfx = null;
        this._pixiInnerGfx = null;
    }
    update(deltaTime = SIM_STEP_MS) {
        const dtFactor = deltaTime / 16.67;
        this.t += dtFactor;
        this.pos.add(this.vel);

        if (GameContext.player && !GameContext.player.dead) {
            const d = Math.hypot(GameContext.player.pos.x - this.pos.x, GameContext.player.pos.y - this.pos.y);
            if (d <= this.proximityFuseRadius) {
                this.explode();
                return;
            }
        }

        if (Math.floor(this.t) % 2 === 0) {
            if (_emitParticle) {
                _emitParticle(
                    this.pos.x + (Math.random() - 0.5) * 6,
                    this.pos.y + (Math.random() - 0.5) * 6,
                    -this.vel.x * 0.05 + (Math.random() - 0.5) * 0.6,
                    -this.vel.y * 0.05 + (Math.random() - 0.5) * 0.6,
                    '#fa0',
                    30
                );
            }
        }

        const travelled = Math.hypot(this.pos.x - this.startX, this.pos.y - this.startY);
        if (travelled >= this.maxTravel) this.explode();
    }
    explode() {
        if (this.dead) return;
        this.dead = true;

        // FIX: Clean up shield graphics BEFORE calling pixiCleanupObject
        // This prevents pixiCleanupObject from missing these
        if (this._pixiInnerGfx) {
            try { this._pixiInnerGfx.destroy(true); } catch (e) { }
            this._pixiInnerGfx = null;
        }
        if (this._pixiGfx) {
            try { this._pixiGfx.destroy(true); } catch (e) { }
            this._pixiGfx = null;
        }

        pixiCleanupObject(this);
        playSound('explode');
        if (_spawnParticles) _spawnParticles(this.pos.x, this.pos.y, 40, '#fa0');
        GameContext.shockwaves.push(new Shockwave(this.pos.x, this.pos.y, this.damage, this.blastRadius, {
            damagePlayer: true,
            damageBases: true,
            ignoreEntity: this.owner,
            color: '#fa0'
        }));
    }
    draw(ctx) {
        if (this.dead) return;

        const rPos = this.getRenderPos(getRenderAlpha());

        if (pixiBulletLayer) {
            let g = this._pixiGfx;
            if (!g) {
                g = new PIXI.Graphics();
                // Glow Halo
                g.beginFill(0xffaa00, 0.4);
                g.drawCircle(0, 0, this.radius * 1.4);
                g.endFill();
                // Main Body
                g.lineStyle(2, 0xffffff, 1);
                g.beginFill(0xffaa00, 1);
                g.drawCircle(0, 0, this.radius);
                g.endFill();
                g.lineStyle(0); // Clear lineStyle to prevent ghosting

                pixiBulletLayer.addChild(g);
                this._pixiGfx = g;
            }
            g.position.set(rPos.x, rPos.y);
            g.rotation = this.t * 0.1;
            return;
        }
    }
}
