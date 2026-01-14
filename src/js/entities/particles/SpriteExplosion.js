/**
 * Sprite Sheet Explosion Effect
 * Animated explosion using a sprite sheet.
 */

import { Entity } from '../Entity.js';
import { allocPixiSprite, releasePixiSprite } from '../../rendering/sprite-pools.js';

export class SpriteExplosion extends Entity {
    constructor(x, y, size = 256) {
        super(x, y);
        this.size = size;
        this.frame = 0;
        this.frameCount = 16; // 4x4 grid
        this.frameTime = 0;
        this.frameDuration = 10; // 2 frames per update (30fps, slowed by 50%)
        this.textures = [];
        this.sprite = null;
        this.maxLife = this.frameCount * this.frameDuration; // Total updates needed
        this.life = this.maxLife;
        this.cleaned = false;
        this.createTextures();
    }

    createTextures() {
        // Load the sprite sheet texture
        const baseTexture = window.PIXI ? PIXI.Texture.from('assets/explosion3.png') : null;
        if (!baseTexture) return;

        const frameWidth = 64;
        const frameHeight = 64;
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const rect = new PIXI.Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight);
                const texture = new PIXI.Texture(baseTexture, rect);
                this.textures.push(texture);
            }
        }
    }

    update() {
        this.life--;
        if (this.life <= 0) {
            this.dead = true;
            return;
        }

        this.frameTime++;
        if (this.frameTime >= this.frameDuration) {
            this.frameTime = 0;
            this.frame = Math.min(this.frame + 1, this.frameCount - 1);
        }
    }

    cleanup(pixiResources) {
        if (this.cleaned) return;
        if (this.sprite) {
            try {
                this.sprite.visible = false;
                // FIX: Always remove from parent layer, even if pool is null
                // This prevents sprites from being left behind if the pool doesn't exist
                if (this.sprite.parent) {
                    this.sprite.parent.removeChild(this.sprite);
                }
                // Only return to pool if it exists
                if (pixiResources && pixiResources.pool) {
                    releasePixiSprite(pixiResources.pool, this.sprite);
                }
            } catch (e) {
                console.warn('[SpriteExplosion] Failed to release sprite:', e);
            }
            this.sprite = null;
        }
        this.cleaned = true;
    }

    draw(ctx, pixiResources = null, alpha = 1.0) {
        if (this.cleaned || !pixiResources || !pixiResources.layer || !pixiResources.pool) return;

        const rPos = (this.getRenderPos && typeof alpha === 'number') ? this.getRenderPos(alpha) : this.pos;

        if (!this.sprite) {
            this.sprite = allocPixiSprite(pixiResources.pool, pixiResources.layer, this.textures[this.frame] || pixiResources.whiteTexture, null, 0.5);
        }

        if (this.sprite) {
            if (!this.sprite.parent) pixiResources.layer.addChild(this.sprite);
            this.sprite.visible = true;
            this.sprite.position.set(rPos.x, rPos.y);
            this.sprite.texture = this.textures[this.frame] || this.sprite.texture;
            const scale = this.size / 64; // 64 is frame size
            this.sprite.scale.set(scale);
            this.sprite.alpha = this.life / this.maxLife;
            this.sprite.blendMode = window.PIXI ? PIXI.BLEND_MODES.NORMAL : 0;
        }
    }
}