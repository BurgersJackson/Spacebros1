export function genTexture(pixiApp, graphics) {
    const b = graphics.getLocalBounds();
    const tex = pixiApp.renderer.generateTexture(graphics);
    try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) { }
    const anchor = (b && b.width > 0 && b.height > 0)
        ? { x: (-b.x) / b.width, y: (-b.y) / b.height }
        : { x: 0.5, y: 0.5 };
    try { graphics.destroy(true); } catch (e) { }
    return { tex, anchor };
}

export function allocPixiSprite(pool, layer, texture, size = 2, anchor = 0.5) {
    if (!texture || !layer) return null;
    let spr = pool && pool.length > 0 ? pool.pop() : null;
    if (!spr) spr = new PIXI.Sprite(texture);
    spr.texture = texture;
    spr.tint = 0xffffff;
    spr.alpha = 1;
    spr.rotation = 0;
    spr.blendMode = PIXI.BLEND_MODES.NORMAL;
    spr.scale.set(1);

    if (typeof anchor === 'number') spr.anchor.set(anchor);
    else if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') spr.anchor.set(anchor.x, anchor.y);
    else spr.anchor.set(0.5);

    spr.visible = true;
    if (size != null) {
        spr.width = size;
        spr.height = size;
    }
    if (!spr.parent) layer.addChild(spr);
    return spr;
}

export function releasePixiSprite(pool, spr, PIXI_SPRITE_POOL_MAX = 30000) {
    if (!spr) return;
    if (spr.parent) spr.parent.removeChild(spr);
    spr.visible = false;
    if (pool && pool.length < PIXI_SPRITE_POOL_MAX) pool.push(spr);
}

export function pixiCleanupObject(obj, releaseEnemySprite) {
    if (!obj) return;
    if (obj._pixiContainer) {
        try { obj._pixiContainer.destroy({ children: true }); } catch (e) { }
        obj._pixiContainer = null;
    }
    if (obj.sprite) {
        // This needs coordination with specific pools
        if (releaseEnemySprite && typeof releaseEnemySprite === 'function') {
            releaseEnemySprite(obj);
        }
        obj.sprite = null;
    }
    if (obj._pixiGfx) {
        try { obj._pixiGfx.destroy(true); } catch (e) { }
        obj._pixiGfx = null;
    }
    if (obj._pixiGfx2) {
        try { obj._pixiGfx2.destroy(true); } catch (e) { }
        obj._pixiGfx2 = null;
    }
    if (obj._pixiNameText) {
        try { obj._pixiNameText.destroy(true); } catch (e) { }
        obj._pixiNameText = null;
    }
    if (obj._pixiLaserGfx) {
        try { obj._pixiLaserGfx.destroy(true); } catch (e) { }
        obj._pixiLaserGfx = null;
    }
}

export function clearArrayWithPixiCleanup(arr, releaseEnemySprite) {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
        pixiCleanupObject(arr[i], releaseEnemySprite);
    }
    arr.length = 0;
}
