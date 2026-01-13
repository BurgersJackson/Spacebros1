import {
    pixiTextures,
    pixiTextureAnchors,
    pixiTextureRotOffsets,
    pixiTextureBaseScales,
    pixiTextureScaleToRadius,
    loadAllTextures
} from './texture-loader.js';
import {
    setAsteroidImages,
    setAsteroidIndestructibleImage,
    setAsteroidTexturesReady,
    setAsteroidIndestructibleTextureReady
} from './pixi-context.js';

let textureAssetsInitialized = false;

const GUNBOAT1_URL = 'assets/gunboat1.png';
const GUNBOAT2_URL = 'assets/gunboat2.png';
const STATION1_URL = 'assets/station1.png';
const DESTROYER1_URL = 'assets/destroyer1.png';
const DESTROYER2_URL = 'assets/destroyer2.png';
const DUNGEON4_URL = 'assets/dungeon4.png';
const DUNGEON5_URL = 'assets/dungeon5.png';
const DUNGEON6_URL = 'assets/dungeon6.png';
const DUNGEON7_URL = 'assets/dungeon7.png';
const DUNGEON8_URL = 'assets/dungeon8.png';
const DUNGEON9_URL = 'assets/dungeon9.png';
const MONSTER1_URL = 'assets/monster1.png';
const MONSTER2_URL = 'assets/monster2.png';
const MONSTER4_URL = 'assets/monster4.png';
const NUGGET_URL = 'assets/nugget.png';
const ROAMER_URL = 'assets/roamer1.png';
const ELITE_ROAMER_URL = 'assets/roamer_elite.png';
const HUNTER_URL = 'assets/hunter.png';
const DEFENDER_URL = 'assets/defender.png';
const BASE1_URL = 'assets/base1.png';
const BASE2_URL = 'assets/base2.png';
const BASE3_URL = 'assets/base3.png';
const CRUISER_URL = 'assets/cruiser.png';
const WARP_BOSS_URL = 'assets/warp_boss.png';
const FINAL_BOSS_URL = 'assets/spaceboss2.png';
const ASTEROID1_URL = 'assets/asteroid1.png';
const ASTEROID2_URL = 'assets/asteroid2.png';
const ASTEROID3_URL = 'assets/asteroid3.png';
const ASTEROID2_U_URL = 'assets/asteroid2_U.png';
const PLAYER1_URL = 'assets/player1.png';
const SLACKER_URL = 'assets/slacker.png';
const EXPLOSION1_URL = 'assets/explosion1.png';

let gunboat1Image = null;
let gunboat2Image = null;
let gunboat1Texture = null;
let gunboat2Texture = null;
let gunboat1Loaded = false;
let gunboat2Loaded = false;

let station1Image = null;
let station1Texture = null;
let station1Loaded = false;

let destroyer1Image = null;
let destroyer1Texture = null;
let destroyer1Loaded = false;

let destroyer2Image = null;
let destroyer2Texture = null;
let destroyer2Loaded = false;

let dungeon4Image = null;
let dungeon5Image = null;
let dungeon6Image = null;
let dungeon7Image = null;
let dungeon8Image = null;
let dungeon9Image = null;
let dungeon4Texture = null;
let dungeon5Texture = null;
let dungeon6Texture = null;
let dungeon7Texture = null;
let dungeon8Texture = null;
let dungeon9Texture = null;
let dungeon4Loaded = false;
let dungeon5Loaded = false;
let dungeon6Loaded = false;
let dungeon7Loaded = false;
let dungeon8Loaded = false;
let dungeon9Loaded = false;

let monster1Image = null;
let monster2Image = null;
let monster4Image = null;
let monster1Texture = null;
let monster2Texture = null;
let monster4Texture = null;
let monster1Loaded = false;
let monster2Loaded = false;
let monster4Loaded = false;

let nuggetImage = null;
let nuggetTexture = null;
let nuggetLoaded = false;

let roamerImage = null;
let eliteRoamerImage = null;
let hunterImage = null;
let defenderImage = null;

let base1Image = null;
let base1Texture = null;
let base1Loaded = false;

let base2Image = null;
let base2Texture = null;
let base2Loaded = false;

let base3Image = null;
let base3Texture = null;
let base3Loaded = false;

let cruiserImage = null;
let cruiserTexture = null;
let cruiserLoaded = false;

let warpBossImage = null;
let warpBossTexture = null;
let warpBossLoaded = false;

let finalBossImage = null;
let finalBossTexture = null;
let finalBossLoaded = false;

let asteroidImages = null;
let asteroidIndestructibleImage = null;
let asteroidTexturesExternalReady = false;

let playerHullImage = null;
let playerHullExternalReady = false;
let playerHullPixiApplied = false;

let slackerHullImage = null;
let slackerHullExternalReady = false;
let slackerHullPixiApplied = false;

let explosion1Image = null;

/**
 * @returns {void}
 */
export function initTextureAssets() {
    if (textureAssetsInitialized) return;
    textureAssetsInitialized = true;

    loadAllTextures();

    gunboat1Image = new Image();
    gunboat2Image = new Image();
    gunboat1Image.decoding = 'async';
    gunboat2Image.decoding = 'async';
    gunboat1Image.src = GUNBOAT1_URL;
    gunboat2Image.src = GUNBOAT2_URL;

    station1Image = new Image();
    station1Image.decoding = 'async';
    station1Image.src = STATION1_URL;

    destroyer1Image = new Image();
    destroyer1Image.decoding = 'async';
    destroyer1Image.src = DESTROYER1_URL;

    destroyer2Image = new Image();
    destroyer2Image.decoding = 'async';
    destroyer2Image.src = DESTROYER2_URL;

    dungeon4Image = new Image();
    dungeon5Image = new Image();
    dungeon6Image = new Image();
    dungeon7Image = new Image();
    dungeon8Image = new Image();
    dungeon9Image = new Image();
    dungeon4Image.decoding = 'async';
    dungeon5Image.decoding = 'async';
    dungeon6Image.decoding = 'async';
    dungeon7Image.decoding = 'async';
    dungeon8Image.decoding = 'async';
    dungeon9Image.decoding = 'async';
    dungeon4Image.src = DUNGEON4_URL;
    dungeon5Image.src = DUNGEON5_URL;
    dungeon6Image.src = DUNGEON6_URL;
    dungeon7Image.src = DUNGEON7_URL;
    dungeon8Image.src = DUNGEON8_URL;
    dungeon9Image.src = DUNGEON9_URL;

    monster1Image = new Image();
    monster2Image = new Image();
    monster4Image = new Image();
    monster1Image.decoding = 'async';
    monster2Image.decoding = 'async';
    monster4Image.decoding = 'async';
    monster1Image.src = MONSTER1_URL;
    monster2Image.src = MONSTER2_URL;
    monster4Image.src = MONSTER4_URL;

    nuggetImage = new Image();
    nuggetImage.decoding = 'async';
    nuggetImage.src = NUGGET_URL;

    roamerImage = new Image();
    eliteRoamerImage = new Image();
    hunterImage = new Image();
    defenderImage = new Image();
    roamerImage.decoding = 'async';
    eliteRoamerImage.decoding = 'async';
    hunterImage.decoding = 'async';
    defenderImage.decoding = 'async';
    roamerImage.src = ROAMER_URL;
    eliteRoamerImage.src = ELITE_ROAMER_URL;
    hunterImage.src = HUNTER_URL;
    defenderImage.src = DEFENDER_URL;

    base1Image = new Image();
    base1Image.decoding = 'async';
    base1Image.src = BASE1_URL;

    base2Image = new Image();
    base2Image.decoding = 'async';
    base2Image.src = BASE2_URL;

    base3Image = new Image();
    base3Image.decoding = 'async';
    base3Image.src = BASE3_URL;

    cruiserImage = new Image();
    cruiserImage.decoding = 'async';
    cruiserImage.src = CRUISER_URL;

    warpBossImage = new Image();
    warpBossImage.decoding = 'async';
    warpBossImage.src = WARP_BOSS_URL;

    finalBossImage = new Image();
    finalBossImage.decoding = 'async';
    finalBossImage.src = FINAL_BOSS_URL;

    asteroidImages = [
        new Image(),
        new Image(),
        new Image()
    ];
    asteroidIndestructibleImage = new Image();
    asteroidIndestructibleImage.decoding = 'async';
    asteroidIndestructibleImage.src = ASTEROID2_U_URL;
    asteroidImages[0].decoding = 'async';
    asteroidImages[1].decoding = 'async';
    asteroidImages[2].decoding = 'async';
    asteroidImages[0].src = ASTEROID1_URL;
    asteroidImages[1].src = ASTEROID2_URL;
    asteroidImages[2].src = ASTEROID3_URL;

    setAsteroidImages(asteroidImages);
    setAsteroidIndestructibleImage(asteroidIndestructibleImage);

    playerHullImage = new Image();
    playerHullImage.decoding = 'async';
    playerHullImage.src = PLAYER1_URL;

    slackerHullImage = new Image();
    slackerHullImage.decoding = 'async';
    slackerHullImage.src = SLACKER_URL;

    explosion1Image = new Image();
    explosion1Image.decoding = 'async';
    explosion1Image.src = EXPLOSION1_URL;

    gunboat1Image.addEventListener('load', () => {
        gunboat1Loaded = true;
        applyGunboatTextures();
    });
    gunboat1Image.addEventListener('error', () => {
        gunboat1Loaded = false;
    });
    gunboat2Image.addEventListener('load', () => {
        gunboat2Loaded = true;
        applyGunboatTextures();
    });
    gunboat2Image.addEventListener('error', () => {
        gunboat2Loaded = false;
    });
    station1Image.addEventListener('load', () => {
        station1Loaded = true;
        applyStationTexture();
    });
    station1Image.addEventListener('error', () => {
        station1Loaded = false;
    });
    destroyer1Image.addEventListener('load', () => {
        destroyer1Loaded = true;
        applyDestroyerTexture();
    });
    destroyer1Image.addEventListener('error', () => {
        destroyer1Loaded = false;
    });
    destroyer2Image.addEventListener('load', () => {
        destroyer2Loaded = true;
        applyDestroyer2Texture();
    });
    destroyer2Image.addEventListener('error', () => {
        destroyer2Loaded = false;
    });

    dungeon4Image.addEventListener('load', () => {
        dungeon4Loaded = true;
        applyDungeonTextures();
    });
    dungeon4Image.addEventListener('error', () => {
        dungeon4Loaded = false;
    });
    dungeon5Image.addEventListener('load', () => {
        dungeon5Loaded = true;
        applyDungeonTextures();
    });
    dungeon5Image.addEventListener('error', () => {
        dungeon5Loaded = false;
    });
    dungeon6Image.addEventListener('load', () => {
        dungeon6Loaded = true;
        applyDungeonTextures();
    });
    dungeon6Image.addEventListener('error', () => {
        dungeon6Loaded = false;
    });
    dungeon7Image.addEventListener('load', () => {
        dungeon7Loaded = true;
        applyDungeonTextures();
    });
    dungeon7Image.addEventListener('error', () => {
        dungeon7Loaded = false;
    });
    dungeon8Image.addEventListener('load', () => {
        dungeon8Loaded = true;
        applyDungeonTextures();
    });
    dungeon8Image.addEventListener('error', () => {
        dungeon8Loaded = false;
    });
    dungeon9Image.addEventListener('load', () => {
        dungeon9Loaded = true;
        applyDungeonTextures();
    });
    dungeon9Image.addEventListener('error', () => {
        dungeon9Loaded = false;
    });

    monster1Image.addEventListener('load', () => {
        monster1Loaded = true;
        applyMonsterTextures();
    });
    monster1Image.addEventListener('error', () => {
        monster1Loaded = false;
    });
    monster2Image.addEventListener('load', () => {
        monster2Loaded = true;
        applyMonsterTextures();
    });
    monster2Image.addEventListener('error', () => {
        monster2Loaded = false;
    });
    monster4Image.addEventListener('load', () => {
        monster4Loaded = true;
        applyMonsterTextures();
    });
    monster4Image.addEventListener('error', () => {
        monster4Loaded = false;
    });

    nuggetImage.addEventListener('load', () => {
        nuggetLoaded = true;
        applyNuggetTexture();
    });
    nuggetImage.addEventListener('error', () => {
        nuggetLoaded = false;
    });

    roamerImage.addEventListener('load', () => {
        applyEnemyTexture(roamerImage, 'enemy_roamer');
    });
    eliteRoamerImage.addEventListener('load', () => {
        applyEnemyTexture(eliteRoamerImage, 'enemy_elite_roamer');
    });
    hunterImage.addEventListener('load', () => {
        applyEnemyTexture(hunterImage, 'enemy_hunter');
    });
    defenderImage.addEventListener('load', () => {
        applyEnemyTexture(defenderImage, 'enemy_defender');
    });

    base1Image.addEventListener('load', () => {
        base1Loaded = true;
        applyBase1Texture();
    });
    base1Image.addEventListener('error', () => {
        base1Loaded = false;
    });

    base2Image.addEventListener('load', () => {
        base2Loaded = true;
        applyBase2Texture();
    });
    base2Image.addEventListener('error', () => {
        base2Loaded = false;
    });

    base3Image.addEventListener('load', () => {
        base3Loaded = true;
        applyBase3Texture();
    });
    base3Image.addEventListener('error', () => {
        base3Loaded = false;
    });

    cruiserImage.addEventListener('load', () => {
        cruiserLoaded = true;
        applyCruiserTexture();
    });
    cruiserImage.addEventListener('error', () => {
        cruiserLoaded = false;
    });

    warpBossImage.addEventListener('load', () => {
        warpBossLoaded = true;
        applyWarpBossTexture();
    });
    warpBossImage.addEventListener('error', () => {
        warpBossLoaded = false;
    });

    finalBossImage.addEventListener('load', () => {
        finalBossLoaded = true;
        applyFinalBossTexture();
    });
    finalBossImage.addEventListener('error', () => {
        finalBossLoaded = false;
    });

    for (const img of asteroidImages) {
        img.addEventListener('load', applyAsteroidTextures);
        img.addEventListener('error', () => {
        });
    }

    asteroidIndestructibleImage.addEventListener('load', () => {
        if (!window.PIXI) return;
        if (!pixiTextures || !pixiTextureAnchors) return;
        try {
            const tex = PIXI.Texture.from(asteroidIndestructibleImage);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            pixiTextures.asteroidIndestructible = tex;
            pixiTextureAnchors.asteroidIndestructible = 0.5;

            setAsteroidIndestructibleTextureReady(true);
        } catch (e) {
            console.warn('Failed to load indestructible asteroid texture', e);
        }
    });
    asteroidIndestructibleImage.addEventListener('error', () => {
    });

    playerHullImage.addEventListener('load', applyPlayerHullTexture);
    playerHullImage.addEventListener('error', () => {
        playerHullExternalReady = false;
        playerHullPixiApplied = false;
    });

    slackerHullImage.addEventListener('load', applySlackerHullTexture);
    slackerHullImage.addEventListener('error', () => {
        slackerHullExternalReady = false;
        slackerHullPixiApplied = false;
    });
}

/**
 * @returns {void}
 */
export function applyGunboatTextures() {
    if (!window.PIXI) return;
    try {
        if (gunboat1Loaded && !gunboat1Texture) {
            const tex = PIXI.Texture.from(gunboat1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat1Texture = tex;
        }
        if (gunboat2Loaded && !gunboat2Texture) {
            const tex = PIXI.Texture.from(gunboat2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            gunboat2Texture = tex;
        }

        if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_1 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_1 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_1 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_1 = true;
            pixiTextureBaseScales.enemy_gunboat_1 = 1;
        }
        if (gunboat2Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat2Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        } else if (gunboat1Texture) {
            pixiTextures.enemy_gunboat_2 = gunboat1Texture;
            pixiTextureAnchors.enemy_gunboat_2 = 0.5;
            pixiTextureRotOffsets.enemy_gunboat_2 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_gunboat_2 = true;
            pixiTextureBaseScales.enemy_gunboat_2 = 1;
        }
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyStationTexture() {
    if (!window.PIXI) return;
    try {
        if (station1Loaded && !station1Texture) {
            const tex = PIXI.Texture.from(station1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            station1Texture = tex;
        }
        if (station1Texture) {
            pixiTextures.station_hull = station1Texture;
            pixiTextureAnchors.station_hull = 0.5;
        }
    } catch (e) {
    }
}

function applyDestroyerTexture() {
    if (!window.PIXI) return;
    try {
        if (destroyer1Loaded && !destroyer1Texture) {
            const tex = PIXI.Texture.from(destroyer1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer1Texture = tex;
        }

        if (destroyer1Texture) {
            pixiTextures.destroyer_hull = destroyer1Texture;
            pixiTextureAnchors.destroyer_hull = 0.5;
        }
    } catch (e) {
    }
}

function applyDestroyer2Texture() {
    if (!window.PIXI) return;
    try {
        if (destroyer2Loaded && !destroyer2Texture) {
            const tex = PIXI.Texture.from(destroyer2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            destroyer2Texture = tex;
        }

        if (destroyer2Texture) {
            pixiTextures.destroyer2_hull = destroyer2Texture;
            pixiTextureAnchors.destroyer2_hull = 0.5;
        }
    } catch (e) {
    }
}

function applyDungeonTextures() {
    if (!window.PIXI) return;
    try {
        if (dungeon4Loaded && !dungeon4Texture) {
            const tex = PIXI.Texture.from(dungeon4Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon4Texture = tex;
        }
        if (dungeon5Loaded && !dungeon5Texture) {
            const tex = PIXI.Texture.from(dungeon5Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon5Texture = tex;
        }
        if (dungeon6Loaded && !dungeon6Texture) {
            const tex = PIXI.Texture.from(dungeon6Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon6Texture = tex;
        }
        if (dungeon7Loaded && !dungeon7Texture) {
            const tex = PIXI.Texture.from(dungeon7Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon7Texture = tex;
        }
        if (dungeon8Loaded && !dungeon8Texture) {
            const tex = PIXI.Texture.from(dungeon8Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon8Texture = tex;
        }
        if (dungeon9Loaded && !dungeon9Texture) {
            const tex = PIXI.Texture.from(dungeon9Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            dungeon9Texture = tex;
        }

        if (dungeon4Texture) {
            pixiTextures.enemy_dungeon4 = dungeon4Texture;
            pixiTextureAnchors.enemy_dungeon4 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon4 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon4 = true;
            pixiTextureBaseScales.enemy_dungeon4 = 1;
        }
        if (dungeon5Texture) {
            pixiTextures.enemy_dungeon5 = dungeon5Texture;
            pixiTextureAnchors.enemy_dungeon5 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon5 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon5 = true;
            pixiTextureBaseScales.enemy_dungeon5 = 1;
        }
        if (dungeon6Texture) {
            pixiTextures.enemy_dungeon6 = dungeon6Texture;
            pixiTextureAnchors.enemy_dungeon6 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon6 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon6 = true;
            pixiTextureBaseScales.enemy_dungeon6 = 1;
        }
        if (dungeon7Texture) {
            pixiTextures.enemy_dungeon7 = dungeon7Texture;
            pixiTextureAnchors.enemy_dungeon7 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon7 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon7 = true;
            pixiTextureBaseScales.enemy_dungeon7 = 1;
        }
        if (dungeon8Texture) {
            pixiTextures.enemy_dungeon8 = dungeon8Texture;
            pixiTextureAnchors.enemy_dungeon8 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon8 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon8 = true;
            pixiTextureBaseScales.enemy_dungeon8 = 1;
        }
        if (dungeon9Texture) {
            pixiTextures.enemy_dungeon9 = dungeon9Texture;
            pixiTextureAnchors.enemy_dungeon9 = 0.5;
            pixiTextureRotOffsets.enemy_dungeon9 = Math.PI / 2;
            pixiTextureScaleToRadius.enemy_dungeon9 = true;
            pixiTextureBaseScales.enemy_dungeon9 = 1;
        }
    } catch (e) {
        console.error('Error loading dungeon textures:', e);
    }
}

function applyMonsterTextures() {
    if (!window.PIXI) return;
    try {
        if (monster1Loaded && !monster1Texture) {
            const tex = PIXI.Texture.from(monster1Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster1Texture = tex;
            pixiTextures.cave_monster_1 = monster1Texture;
            pixiTextureAnchors.cave_monster_1 = 0.5;
            pixiTextureScaleToRadius.cave_monster_1 = true;
            pixiTextureBaseScales.cave_monster_1 = 1;
        }
        if (monster2Loaded && !monster2Texture) {
            const tex = PIXI.Texture.from(monster2Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster2Texture = tex;
            pixiTextures.cave_monster_2 = monster2Texture;
            pixiTextureAnchors.cave_monster_2 = 0.5;
            pixiTextureScaleToRadius.cave_monster_2 = true;
            pixiTextureBaseScales.cave_monster_2 = 1;
        }
        if (monster4Loaded && !monster4Texture) {
            const tex = PIXI.Texture.from(monster4Image);
            try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
            monster4Texture = tex;
            pixiTextures.cave_monster_3 = monster4Texture;
            pixiTextureAnchors.cave_monster_3 = 0.5;
            pixiTextureScaleToRadius.cave_monster_3 = true;
            pixiTextureBaseScales.cave_monster_3 = 1;
        }
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyNuggetTexture() {
    if (!nuggetLoaded || nuggetTexture || !window.PIXI || !pixiTextures) return;
    try {
        const tex = PIXI.Texture.from(nuggetImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        nuggetTexture = tex;
        pixiTextures.nugget = tex;
    } catch (e) {
    }
}

function applyEnemyTexture(img, key) {
    if (!img || img.naturalWidth <= 0 || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(img);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        pixiTextures[key] = tex;
        pixiTextureAnchors[key] = 0.5;
        pixiTextureScaleToRadius[key] = true;
        if (key === 'enemy_roamer' || key === 'enemy_elite_roamer' || key === 'enemy_hunter' || key === 'enemy_defender') {
            pixiTextureRotOffsets[key] = Math.PI / 2;
        }
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyBase1Texture() {
    if (!base1Loaded || base1Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base1Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base1Texture = tex;
        pixiTextures.base_standard = tex;
        pixiTextureAnchors.base_standard = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base1Image.naturalWidth || 1, base1Image.naturalHeight || 1));
        pixiTextureBaseScales.base_standard = desired / denom;
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyBase2Texture() {
    if (!base2Loaded || base2Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base2Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base2Texture = tex;
        pixiTextures.base_heavy = tex;
        pixiTextureAnchors.base_heavy = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base2Image.naturalWidth || 1, base2Image.naturalHeight || 1));
        pixiTextureBaseScales.base_heavy = desired / denom;
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyBase3Texture() {
    if (!base3Loaded || base3Texture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(base3Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        base3Texture = tex;
        pixiTextures.base_rapid = tex;
        pixiTextureAnchors.base_rapid = 0.5;

        const desired = 140;
        const denom = Math.max(1, Math.max(base3Image.naturalWidth || 1, base3Image.naturalHeight || 1));
        pixiTextureBaseScales.base_rapid = desired / denom;
    } catch (e) { }
}

/**
 * @returns {void}
 */
export function applyCruiserTexture() {
    if (!cruiserLoaded || cruiserTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(cruiserImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        cruiserTexture = tex;
        pixiTextures.enemy_cruiser = tex;
        pixiTextureAnchors.enemy_cruiser = 0.5;

        const w = cruiserImage.naturalWidth || 0;
        const h = cruiserImage.naturalHeight || 0;
        pixiTextureRotOffsets.enemy_cruiser = (h > w) ? (Math.PI / 2) : 0;

        pixiTextureScaleToRadius.enemy_cruiser = true;
    } catch (e) { }
}

function applyWarpBossTexture() {
    if (!warpBossLoaded || warpBossTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(warpBossImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        warpBossTexture = tex;
        pixiTextures.warp_boss = tex;
        pixiTextureAnchors.warp_boss = 0.5;
        pixiTextureRotOffsets.warp_boss = 0;
        pixiTextureScaleToRadius.warp_boss = true;
    } catch (e) { }
}

function applyFinalBossTexture() {
    if (!finalBossLoaded || finalBossTexture || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(finalBossImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        finalBossTexture = tex;
        pixiTextures.final_boss = tex;
        pixiTextureAnchors.final_boss = 0.5;
        pixiTextureRotOffsets.final_boss = 0;
        pixiTextureScaleToRadius.final_boss = true;
    } catch (e) { }
}

/**
 * @returns {void}
 */
export function applyAsteroidTextures() {
    if (asteroidTexturesExternalReady || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    if (!asteroidImages.every(img => img && img.naturalWidth > 0)) return;
    try {
        const tex1 = PIXI.Texture.from(asteroidImages[0]);
        const tex2 = PIXI.Texture.from(asteroidImages[1]);
        const tex3 = PIXI.Texture.from(asteroidImages[2]);
        for (const t of [tex1, tex2, tex3]) {
            try { t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
            try { t.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }
        }
        pixiTextures.asteroids = [tex1, tex2, tex3];
        pixiTextureAnchors.asteroid_0 = 0.5;
        pixiTextureAnchors.asteroid_1 = 0.5;
        pixiTextureAnchors.asteroid_2 = 0.5;

        asteroidTexturesExternalReady = true;
        setAsteroidTexturesReady(true);
    } catch (e) {
    }
}

/**
 * @returns {void}
 */
export function applyPlayerHullTexture() {
    if (!playerHullImage || playerHullImage.naturalWidth <= 0) return;

    playerHullExternalReady = true;

    if (playerHullPixiApplied || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(playerHullImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.player_hull = tex;
        pixiTextureAnchors.player_hull = 0.5;
        playerHullPixiApplied = true;
    } catch (e) {
    }
}

function applySlackerHullTexture() {
    if (!slackerHullImage || slackerHullImage.naturalWidth <= 0) return;

    slackerHullExternalReady = true;

    if (slackerHullPixiApplied || !window.PIXI) return;
    if (!pixiTextures || !pixiTextureAnchors) return;
    try {
        const tex = PIXI.Texture.from(slackerHullImage);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.slacker_hull = tex;
        pixiTextureAnchors.slacker_hull = 0.5;
        slackerHullPixiApplied = true;
    } catch (e) {
    }
}

/**
 * @returns {boolean}
 */
export function getAsteroidTexturesExternalReady() {
    return asteroidTexturesExternalReady;
}

/**
 * @returns {boolean}
 */
export function getPlayerHullExternalReady() {
    return playerHullExternalReady;
}

/**
 * @returns {boolean}
 */
export function getSlackerHullExternalReady() {
    return slackerHullExternalReady;
}

/**
 * @returns {object|null}
 */
export function getStationHullTexture() {
    return station1Texture;
}
