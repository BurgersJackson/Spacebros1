/**
 * CavePinwheel3.js
 * Cave-specific pinwheel variant (rapid type).
 * Similar to 'rapid' Pinwheel: blue shields, rapid single shots, less HP, faster speed.
 * Extends Pinwheel to inherit difficulty tier system and base functionality.
 */

import { Pinwheel } from '../enemies/Pinwheel.js';
import { GameContext } from '../../core/game-context.js';
import { SIM_STEP_MS } from '../../core/constants.js';

import {
    pixiBaseLayer,
    pixiVectorLayer,
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureBaseScales,
    getRenderAlpha
} from '../../rendering/pixi-context.js';

export class CavePinwheel3 extends Pinwheel {
    constructor(x, y) {
        // Call parent constructor with 'rapid' type to inherit all base functionality
        super(x, y, 'rapid');
        // Override type to identify as cave variant
        this.type = 'cave3';
        // All initialization is handled by Pinwheel constructor
    }

    update(deltaTime = SIM_STEP_MS) {
        // Call parent update first to get all base behavior
        super.update(deltaTime);
        
        // Override avoidance to check cavePinwheels instead of pinwheels
        if (this.dead) return;
        if (this.freezeTimer > 0) return;
        
        const dtFactor = deltaTime / 16.67;
        
        if (GameContext.player && !GameContext.player.dead) {
            // Avoid bunching with other cave pinwheels (override parent's pinwheels check)
            for (let b of GameContext.cavePinwheels) {
                if (b === this || b.dead) continue;
                const bx = b.pos.x - this.pos.x;
                const by = b.pos.y - this.pos.y;
                const bdist = Math.hypot(bx, by);
                if (bdist > 0 && bdist < 400) {
                    const repulse = (400 - bdist) * 0.0005 * dtFactor;
                    this.vel.x -= (bx / bdist) * repulse;
                    this.vel.y -= (by / bdist) * repulse;
                }
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            // Parent handles cleanup, but we need to return early
            return;
        }

        // Interpolate position for smooth rendering on high refresh displays
        const currentAlpha = getRenderAlpha();
        const rPos = this.getRenderPos(currentAlpha);

        // Pixi fast path (base hull + shields) - override to use cave texture
        if (pixiBaseLayer && pixiTextures) {
            const baseKey = 'cave_pinwheel_3';
            let container = this._pixiContainer;
            if (!container) {
                container = new PIXI.Container();
                this._pixiContainer = container;
                pixiBaseLayer.addChild(container);

                const hull = new PIXI.Sprite(pixiTextures[baseKey]);
                hull.position.set(0, 0);
                container.addChild(hull);
                this._pixiHullSpr = hull;
            } else if (!container.parent) {
                pixiBaseLayer.addChild(container);
            }
            container.visible = true;

            // Keep hull texture/anchor/scale in sync (important for late-loaded external images).
            if (this._pixiHullSpr) {
                const tex = pixiTextures[baseKey];
                const a = pixiTextureAnchors[baseKey] || { x: 0.5, y: 0.5 };
                this._pixiHullSpr.texture = tex;
                this._pixiHullSpr.anchor.set((a && a.x != null) ? a.x : 0.5, (a && a.y != null) ? a.y : 0.5);
                const baseScale = pixiTextureBaseScales[baseKey] || 1;
                this._pixiHullSpr.scale.set(baseScale * 1.2);
            }

            const jitter = (this.hp <= 2) ? 2 : 0;
            const jx = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            const jy = jitter ? (Math.random() - 0.5) * jitter * 2 : 0;
            container.position.set(rPos.x + jx, rPos.y + jy);

            if (this._pixiHullSpr) {
                this._pixiHullSpr.rotation = this.angle || 0;
                this._pixiHullSpr.tint = (this.freezeTimer > 0) ? 0x00ffff : 0xffffff;
            }

            // Shields (Graphics) - rapid blue colors
            if (pixiVectorLayer) {
                const shieldColor = 0x00ff00; // bright green outer
                const innerColor = 0x006400; // dark green inner
                const hasOuter = (this.shieldSegments && this.shieldSegments.length > 0);
                const hasInner = (this.innerShieldSegments && this.innerShieldSegments.length > 0);
                const needs = !!(hasOuter || hasInner);

                if (needs) {
                    // --- Outer Shield ---
                    let gfx = this._pixiGfx;
                    if (hasOuter) {
                        if (!gfx) {
                            gfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(gfx);
                            this._pixiGfx = gfx;
                            this.shieldsDirty = true;
                        } else if (!gfx.parent) pixiVectorLayer.addChild(gfx);

                        gfx.position.set(rPos.x, rPos.y);
                        gfx.rotation = this.shieldRotation || 0;
                    } else if (gfx) {
                        try { gfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                        gfx = null;
                    }

                    // --- Inner Shield ---
                    let innerGfx = this._pixiInnerGfx;
                    if (hasInner) {
                        if (!innerGfx) {
                            innerGfx = new PIXI.Graphics();
                            pixiVectorLayer.addChild(innerGfx);
                            this._pixiInnerGfx = innerGfx;
                            this.shieldsDirty = true;
                        } else if (!innerGfx.parent) pixiVectorLayer.addChild(innerGfx);

                        innerGfx.position.set(rPos.x, rPos.y);
                        innerGfx.rotation = this.innerShieldRotation || 0;
                    } else if (innerGfx) {
                        try { innerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                        innerGfx = null;
                    }

                    if (this.shieldsDirty) {
                        // Outer Rebuild
                        if (gfx && hasOuter) {
                            gfx.clear();
                            const segCount = this.shieldSegments.length;
                            const segAngle = (Math.PI * 2) / segCount;
                            for (let i = 0; i < segCount; i++) {
                                const v = this.shieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    gfx.lineStyle(4, shieldColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * segAngle + 0.05;
                                    const a1 = (i + 1) * segAngle - 0.05;
                                    gfx.moveTo(Math.cos(a0) * this.shieldRadius, Math.sin(a0) * this.shieldRadius);
                                    gfx.arc(0, 0, this.shieldRadius, a0, a1);
                                }
                            }
                        }

                        // Inner Rebuild
                        if (innerGfx && hasInner) {
                            innerGfx.clear();
                            const innerCount = this.innerShieldSegments.length;
                            const innerAngle = (Math.PI * 2) / innerCount;
                            for (let i = 0; i < innerCount; i++) {
                                const v = this.innerShieldSegments[i];
                                if (v > 0) {
                                    const alpha = Math.min(1.0, v / (this.maxShieldHp * 0.5));
                                    innerGfx.lineStyle(3, innerColor, alpha);
                                    // Draw at base angle 0
                                    const a0 = i * innerAngle + 0.05;
                                    const a1 = (i + 1) * innerAngle - 0.05;
                                    innerGfx.moveTo(Math.cos(a0) * this.innerShieldRadius, Math.sin(a0) * this.innerShieldRadius);
                                    innerGfx.arc(0, 0, this.innerShieldRadius, a0, a1);
                                }
                            }
                        }

                        this.shieldsDirty = false;
                    }

                } else {
                    if (this._pixiGfx) {
                        try { this._pixiGfx.destroy(true); } catch (e) { }
                        this._pixiGfx = null;
                    }
                    if (this._pixiInnerGfx) {
                        try { this._pixiInnerGfx.destroy(true); } catch (e) { }
                        this._pixiInnerGfx = null;
                    }
                }
            }

            // Debug visualization for Ctrl+H
            if (pixiVectorLayer && typeof GameContext.DEBUG_COLLISION !== 'undefined' && GameContext.DEBUG_COLLISION) {
                let debugGfx = this._pixiDebugGfx;
                if (!debugGfx) {
                    debugGfx = new PIXI.Graphics();
                    pixiVectorLayer.addChild(debugGfx);
                    this._pixiDebugGfx = debugGfx;
                } else if (!debugGfx.parent) {
                    pixiVectorLayer.addChild(debugGfx);
                }

                debugGfx.visible = true;
                debugGfx.clear();
                debugGfx.position.set(rPos.x, rPos.y);

                // Draw hull collision radius (green)
                debugGfx.lineStyle(3, 0x00FF00, 0.8);
                debugGfx.drawCircle(0, 0, this.radius);

                // Draw outer shield radius (cyan) if shields exist
                if (this.shieldSegments && this.shieldSegments.length > 0) {
                    const hasActiveOuter = this.shieldSegments.some(s => s > 0);
                    debugGfx.lineStyle(2, hasActiveOuter ? 0x00FFFF : 0x888888, hasActiveOuter ? 0.6 : 0.3);
                    debugGfx.drawCircle(0, 0, this.shieldRadius);
                }

                // Draw inner shield radius (magenta) if inner shields exist
                if (this.innerShieldSegments && this.innerShieldSegments.length > 0) {
                    const hasActiveInner = this.innerShieldSegments.some(s => s > 0);
                    debugGfx.lineStyle(2, hasActiveInner ? 0xFF00FF : 0x888888, hasActiveInner ? 0.6 : 0.3);
                    debugGfx.drawCircle(0, 0, this.innerShieldRadius);
                }
            } else if (this._pixiDebugGfx) {
                if (this._pixiDebugGfx.parent) {
                    this._pixiDebugGfx.visible = false;
                }
            }

            return;
        }
    }

    // kill() method is inherited from Pinwheel
    // All pinwheel deaths (cave and regular) are handled in collision-manager.js
    // and will increment pinwheelsDestroyedTotal for difficulty tier calculation
}
