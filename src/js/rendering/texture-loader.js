/**
 * Texture Loader - Handles all texture/sprite loading
 */
import { applyHealthTexture } from "./texture-manager.js";

export const pixiTextures = {
  coin1: null,
  coin5: null,
  coin10: null,
  coinPickup: null, // Dedicated key for Coin entity (never shared with nugget)
  nugget: null,
  gateKey: null,
  health: null,

  enemy_roamer: null,
  enemy_elite_roamer: null,
  enemy_hunter: null,
  enemy_defender: null,
  enemy_gunboat_1: null,
  enemy_gunboat_2: null,
  enemy_cruiser: null,

  player_hull: null,
  player_hull_vectrex: null,
  slacker_hull: null,
  slacker_hull_vectrex: null,
  player_turret_base: null,
  player_barrel: null,
  player_thruster: null,
  player_turbo_flame: null,

  base_standard: null,
  base_heavy: null,
  base_rapid: null,

  cave_pinwheel_1: null,
  cave_pinwheel_2: null,
  cave_pinwheel_3: null,

  station_hull: null,
  station_core: null,
  station_turret: null,

  destroyer_hull: null,
  destroyer_turret: null,
  destroyer2_hull: null,

  shield_drone: null,

  asteroids: []
};

export const pixiTextureAnchors = {};
export const pixiTextureRotOffsets = {};
export const pixiTextureBaseScales = {};
export const pixiTextureScaleToRadius = {};

const GUNBOAT1_URL = "assets/gunboat1.png";
const GUNBOAT2_URL = "assets/gunboat2.png";
const gunboat1Image = new Image();
const gunboat2Image = new Image();
gunboat1Image.decoding = "async";
gunboat2Image.decoding = "async";
gunboat1Image.src = GUNBOAT1_URL;
gunboat2Image.src = GUNBOAT2_URL;
let gunboat1Texture = null;
let gunboat2Texture = null;
let gunboat1Loaded = false;
let gunboat2Loaded = false;

const CAVE_GUNBOAT1_URL = "assets/cave_gunboat1.png";
const CAVE_GUNBOAT2_URL = "assets/cave_gunboat2.png";
const caveGunboat1Image = new Image();
const caveGunboat2Image = new Image();
caveGunboat1Image.decoding = "async";
caveGunboat2Image.decoding = "async";
caveGunboat1Image.src = CAVE_GUNBOAT1_URL;
caveGunboat2Image.src = CAVE_GUNBOAT2_URL;
let caveGunboat1Texture = null;
let caveGunboat2Texture = null;
let caveGunboat1Loaded = false;
let caveGunboat2Loaded = false;

const STATION1_URL = "assets/station1.png";
const station1Image = new Image();
station1Image.decoding = "async";
station1Image.src = STATION1_URL;
let station1Texture = null;
let station1Loaded = false;

const DESTROYER1_URL = "assets/destroyer1.png";
const destroyer1Image = new Image();
destroyer1Image.decoding = "async";
destroyer1Image.src = DESTROYER1_URL;
let destroyer1Texture = null;
let destroyer1Loaded = false;

const DESTROYER2_URL = "assets/destroyer2.png";
const destroyer2Image = new Image();
destroyer2Image.decoding = "async";
destroyer2Image.src = DESTROYER2_URL;
let destroyer2Texture = null;
let destroyer2Loaded = false;

const DUNGEON4_URL = "assets/dungeon4.png";
const DUNGEON5_URL = "assets/dungeon5.png";
const DUNGEON6_URL = "assets/dungeon6.png";
const DUNGEON7_URL = "assets/dungeon7.png";
const DUNGEON8_URL = "assets/dungeon8.png";
const DUNGEON9_URL = "assets/dungeon9.png";
const dungeon4Image = new Image();
const dungeon5Image = new Image();
const dungeon6Image = new Image();
const dungeon7Image = new Image();
const dungeon8Image = new Image();
const dungeon9Image = new Image();
dungeon4Image.decoding = "async";
dungeon5Image.decoding = "async";
dungeon6Image.decoding = "async";
dungeon7Image.decoding = "async";
dungeon8Image.decoding = "async";
dungeon9Image.decoding = "async";
dungeon4Image.src = DUNGEON4_URL;
dungeon5Image.src = DUNGEON5_URL;
dungeon6Image.src = DUNGEON6_URL;
dungeon7Image.src = DUNGEON7_URL;
dungeon8Image.src = DUNGEON8_URL;
dungeon9Image.src = DUNGEON9_URL;
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

export function applyGunboatTextures() {
  if (!window.PIXI) return;
  try {
    if (gunboat1Loaded && !gunboat1Texture) {
      const tex = PIXI.Texture.from(gunboat1Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      gunboat1Texture = tex;
    }
    if (gunboat2Loaded && !gunboat2Texture) {
      const tex = PIXI.Texture.from(gunboat2Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
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
  } catch (e) {}
}

export function applyCaveGunboatTextures() {
  if (!window.PIXI) return;
  try {
    if (caveGunboat1Loaded && !caveGunboat1Texture) {
      const tex = PIXI.Texture.from(caveGunboat1Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      caveGunboat1Texture = tex;
    }
    if (caveGunboat2Loaded && !caveGunboat2Texture) {
      const tex = PIXI.Texture.from(caveGunboat2Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      caveGunboat2Texture = tex;
    }

    if (caveGunboat1Texture) {
      pixiTextures.cave_gunboat_1 = caveGunboat1Texture;
      pixiTextureAnchors.cave_gunboat_1 = 0.5;
      pixiTextureRotOffsets.cave_gunboat_1 = Math.PI / 2;
      pixiTextureScaleToRadius.cave_gunboat_1 = true;
      pixiTextureBaseScales.cave_gunboat_1 = 1;
    }

    if (caveGunboat2Texture) {
      pixiTextures.cave_gunboat_2 = caveGunboat2Texture;
      pixiTextureAnchors.cave_gunboat_2 = 0.5;
      pixiTextureRotOffsets.cave_gunboat_2 = Math.PI / 2;
      pixiTextureScaleToRadius.cave_gunboat_2 = true;
      pixiTextureBaseScales.cave_gunboat_2 = 1;
    }
  } catch (e) {}
}

export function applyStationTexture() {
  if (!window.PIXI) return;
  try {
    if (station1Loaded && !station1Texture) {
      const tex = PIXI.Texture.from(station1Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      station1Texture = tex;
    }

    if (station1Texture) {
      pixiTextures.station_hull = station1Texture;
      pixiTextureAnchors.station_hull = 0.5;
    }
  } catch (e) {}
}

export function applyDestroyerTexture() {
  if (!window.PIXI) return;
  try {
    if (destroyer1Loaded && !destroyer1Texture) {
      const tex = PIXI.Texture.from(destroyer1Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      destroyer1Texture = tex;
    }

    if (destroyer1Texture) {
      pixiTextures.destroyer_hull = destroyer1Texture;
      pixiTextureAnchors.destroyer_hull = 0.5;
    }
  } catch (e) {}
}

export function applyDestroyer2Texture() {
  if (!window.PIXI) return;
  try {
    if (destroyer2Loaded && !destroyer2Texture) {
      const tex = PIXI.Texture.from(destroyer2Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      destroyer2Texture = tex;
    }

    if (destroyer2Texture) {
      pixiTextures.destroyer2_hull = destroyer2Texture;
      pixiTextureAnchors.destroyer2_hull = 0.5;
    }
  } catch (e) {}
}

export function applyDungeonTextures() {
  if (!window.PIXI) return;
  try {
    if (dungeon4Loaded && !dungeon4Texture) {
      const tex = PIXI.Texture.from(dungeon4Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      dungeon4Texture = tex;
    }
    if (dungeon5Loaded && !dungeon5Texture) {
      const tex = PIXI.Texture.from(dungeon5Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      dungeon5Texture = tex;
    }
    if (dungeon6Loaded && !dungeon6Texture) {
      const tex = PIXI.Texture.from(dungeon6Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      dungeon6Texture = tex;
    }
    if (dungeon7Loaded && !dungeon7Texture) {
      const tex = PIXI.Texture.from(dungeon7Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      dungeon7Texture = tex;
    }
    if (dungeon8Loaded && !dungeon8Texture) {
      const tex = PIXI.Texture.from(dungeon8Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      dungeon8Texture = tex;
    }
    if (dungeon9Loaded && !dungeon9Texture) {
      const tex = PIXI.Texture.from(dungeon9Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
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
    console.error("Error loading dungeon textures:", e);
  }
}

gunboat1Image.addEventListener("load", () => {
  gunboat1Loaded = true;
  applyGunboatTextures();
});
gunboat1Image.addEventListener("error", () => {
  gunboat1Loaded = false;
});
gunboat2Image.addEventListener("load", () => {
  gunboat2Loaded = true;
  applyGunboatTextures();
});
gunboat2Image.addEventListener("error", () => {
  gunboat2Loaded = false;
});
caveGunboat1Image.addEventListener("load", () => {
  caveGunboat1Loaded = true;
  applyCaveGunboatTextures();
});
caveGunboat1Image.addEventListener("error", () => {
  caveGunboat1Loaded = false;
});
caveGunboat2Image.addEventListener("load", () => {
  caveGunboat2Loaded = true;
  applyCaveGunboatTextures();
});
caveGunboat2Image.addEventListener("error", () => {
  caveGunboat2Loaded = false;
});
station1Image.addEventListener("load", () => {
  station1Loaded = true;
  applyStationTexture();
});
station1Image.addEventListener("error", () => {
  station1Loaded = false;
});
destroyer1Image.addEventListener("load", () => {
  destroyer1Loaded = true;
  applyDestroyerTexture();
});
destroyer1Image.addEventListener("error", () => {
  destroyer1Loaded = false;
});
destroyer2Image.addEventListener("load", () => {
  destroyer2Loaded = true;
  applyDestroyer2Texture();
});
destroyer2Image.addEventListener("error", () => {
  destroyer2Loaded = false;
});

dungeon4Image.addEventListener("load", () => {
  dungeon4Loaded = true;
  applyDungeonTextures();
});
dungeon4Image.addEventListener("error", () => {
  dungeon4Loaded = false;
});
dungeon5Image.addEventListener("load", () => {
  dungeon5Loaded = true;
  applyDungeonTextures();
});
dungeon5Image.addEventListener("error", () => {
  dungeon5Loaded = false;
});
dungeon6Image.addEventListener("load", () => {
  dungeon6Loaded = true;
  applyDungeonTextures();
});
dungeon6Image.addEventListener("error", () => {
  dungeon6Loaded = false;
});
dungeon7Image.addEventListener("load", () => {
  dungeon7Loaded = true;
  applyDungeonTextures();
});
dungeon7Image.addEventListener("error", () => {
  dungeon7Loaded = false;
});
dungeon8Image.addEventListener("load", () => {
  dungeon8Loaded = true;
  applyDungeonTextures();
});
dungeon8Image.addEventListener("error", () => {
  dungeon8Loaded = false;
});
dungeon9Image.addEventListener("load", () => {
  dungeon9Loaded = true;
  applyDungeonTextures();
});
dungeon9Image.addEventListener("error", () => {
  dungeon9Loaded = false;
});

const MONSTER1_URL = "assets/monster1.png";
const MONSTER2_URL = "assets/monster2.png";
const MONSTER4_URL = "assets/monster4.png";
const monster1Image = new Image();
const monster2Image = new Image();
const monster4Image = new Image();
monster1Image.decoding = "async";
monster2Image.decoding = "async";
monster4Image.decoding = "async";
monster1Image.src = MONSTER1_URL;
monster2Image.src = MONSTER2_URL;
monster4Image.src = MONSTER4_URL;
let monster1Texture = null;
let monster2Texture = null;
let monster4Texture = null;
let monster1Loaded = false;
let monster2Loaded = false;
let monster4Loaded = false;

const CAVE_TURRET_URL = "assets/caveturret.png";
const caveTurretImage = new Image();
caveTurretImage.decoding = "async";
caveTurretImage.src = CAVE_TURRET_URL;
let caveTurretTexture = null;
let caveTurretLoaded = false;

export function applyMonsterTextures() {
  if (!window.PIXI) return;
  try {
    if (monster1Loaded && !monster1Texture) {
      const tex = PIXI.Texture.from(monster1Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      monster1Texture = tex;
      pixiTextures.cave_monster_1 = monster1Texture;
      pixiTextureAnchors.cave_monster_1 = 0.5;
      pixiTextureScaleToRadius.cave_monster_1 = true;
      pixiTextureBaseScales.cave_monster_1 = 1;
    }
    if (monster2Loaded && !monster2Texture) {
      const tex = PIXI.Texture.from(monster2Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      monster2Texture = tex;
      pixiTextures.cave_monster_2 = monster2Texture;
      pixiTextureAnchors.cave_monster_2 = 0.5;
      pixiTextureScaleToRadius.cave_monster_2 = true;
      pixiTextureBaseScales.cave_monster_2 = 1;
    }
    if (monster4Loaded && !monster4Texture) {
      const tex = PIXI.Texture.from(monster4Image);
      try {
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      } catch (e) {}
      try {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      } catch (e) {}
      monster4Texture = tex;
      pixiTextures.cave_monster_3 = monster4Texture;
      pixiTextureAnchors.cave_monster_3 = 0.5;
      pixiTextureScaleToRadius.cave_monster_3 = true;
      pixiTextureBaseScales.cave_monster_3 = 1;
    }
  } catch (e) {}
}

monster1Image.addEventListener("load", () => {
  monster1Loaded = true;
  applyMonsterTextures();
});
monster1Image.addEventListener("error", () => {
  monster1Loaded = false;
});
monster2Image.addEventListener("load", () => {
  monster2Loaded = true;
  applyMonsterTextures();
});
monster2Image.addEventListener("error", () => {
  monster2Loaded = false;
});
monster4Image.addEventListener("load", () => {
  monster4Loaded = true;
  applyMonsterTextures();
});
monster4Image.addEventListener("error", () => {
  monster4Loaded = false;
});

export function applyCaveTurretTexture() {
  if (!caveTurretLoaded || caveTurretTexture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(caveTurretImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}
    caveTurretTexture = tex;
    pixiTextures.cave_turret = tex;
    pixiTextureAnchors.cave_turret = 0.5;
    pixiTextureRotOffsets.cave_turret = 0;
  } catch (e) {}
}

caveTurretImage.addEventListener("load", () => {
  caveTurretLoaded = true;
  applyCaveTurretTexture();
});
caveTurretImage.addEventListener("error", () => {
  caveTurretLoaded = false;
});

const NUGGET_URL = "assets/nugget.png";
const nuggetImage = new Image();
nuggetImage.decoding = "async";
nuggetImage.src = NUGGET_URL;
let nuggetTexture = null;
let nuggetLoaded = false;

export function applyNuggetTexture() {
  if (!nuggetLoaded || nuggetTexture || !window.PIXI || !pixiTextures) return;
  try {
    const tex = PIXI.Texture.from(nuggetImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}
    nuggetTexture = tex;
    pixiTextures.nugget = tex;
  } catch (e) {}
}

nuggetImage.addEventListener("load", () => {
  nuggetLoaded = true;
  applyNuggetTexture();
});
nuggetImage.addEventListener("error", () => {
  nuggetLoaded = false;
});

const ROAMER_URL = "assets/roamer1.png";
const ELITE_ROAMER_URL = "assets/roamer_elite.png";
const HUNTER_URL = "assets/hunter.png";
const DEFENDER_URL = "assets/defender.png";
const roamerImage = new Image();
const eliteRoamerImage = new Image();
const hunterImage = new Image();
const defenderImage = new Image();
roamerImage.decoding = "async";
eliteRoamerImage.decoding = "async";
hunterImage.decoding = "async";
defenderImage.decoding = "async";
roamerImage.src = ROAMER_URL;
eliteRoamerImage.src = ELITE_ROAMER_URL;
hunterImage.src = HUNTER_URL;
defenderImage.src = DEFENDER_URL;
let roamerLoaded = false;
let eliteRoamerLoaded = false;
let hunterLoaded = false;
let defenderLoaded = false;

export function applyEnemyTexture(img, key) {
  if (!img || img.naturalWidth <= 0 || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(img);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}
    pixiTextures[key] = tex;
    pixiTextureAnchors[key] = 0.5;
    pixiTextureScaleToRadius[key] = true;
    if (
      key === "enemy_roamer" ||
      key === "enemy_elite_roamer" ||
      key === "enemy_hunter" ||
      key === "enemy_defender"
    ) {
      pixiTextureRotOffsets[key] = Math.PI / 2;
    }
  } catch (e) {}
}

roamerImage.addEventListener("load", () => {
  roamerLoaded = true;
  applyEnemyTexture(roamerImage, "enemy_roamer");
  // If hunter is already loaded, set its base scale now
  if (hunterLoaded && roamerImage.naturalWidth > 0 && hunterImage.naturalWidth > 0) {
    const roamerSize = Math.max(roamerImage.naturalWidth, roamerImage.naturalHeight);
    const hunterSize = Math.max(hunterImage.naturalWidth, hunterImage.naturalHeight);
    if (hunterSize > 0 && roamerSize > 0) {
      pixiTextureBaseScales.enemy_hunter = roamerSize / hunterSize;
    }
  }
});
eliteRoamerImage.addEventListener("load", () => {
  eliteRoamerLoaded = true;
  applyEnemyTexture(eliteRoamerImage, "enemy_elite_roamer");
});
hunterImage.addEventListener("load", () => {
  hunterLoaded = true;
  applyEnemyTexture(hunterImage, "enemy_hunter");
  // Compensate for texture size difference - if hunter texture is larger than roamer, scale it up
  if (roamerLoaded && roamerImage.naturalWidth > 0 && hunterImage.naturalWidth > 0) {
    const roamerSize = Math.max(roamerImage.naturalWidth, roamerImage.naturalHeight);
    const hunterSize = Math.max(hunterImage.naturalWidth, hunterImage.naturalHeight);
    if (hunterSize > 0 && roamerSize > 0) {
      // Set base scale to compensate for size difference
      pixiTextureBaseScales.enemy_hunter = roamerSize / hunterSize;
    }
  }
});
defenderImage.addEventListener("load", () => {
  defenderLoaded = true;
  applyEnemyTexture(defenderImage, "enemy_defender");
});
roamerImage.addEventListener("error", () => {
  roamerLoaded = false;
});
eliteRoamerImage.addEventListener("error", () => {
  eliteRoamerLoaded = false;
});
hunterImage.addEventListener("error", () => {
  hunterLoaded = false;
});
defenderImage.addEventListener("error", () => {
  defenderLoaded = false;
});

const BASE1_URL = "assets/base1.png";
const base1Image = new Image();
base1Image.decoding = "async";
base1Image.src = BASE1_URL;
let base1Texture = null;
let base1Loaded = false;

export function applyBase1Texture() {
  if (!base1Loaded || base1Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(base1Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    base1Texture = tex;
    pixiTextures.base_standard = tex;
    pixiTextureAnchors.base_standard = 0.5;

    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(base1Image.naturalWidth || 1, base1Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.base_standard = desired / denom;
  } catch (e) {}
}

base1Image.addEventListener("load", () => {
  base1Loaded = true;
  applyBase1Texture();
});
base1Image.addEventListener("error", () => {
  base1Loaded = false;
});

const BASE2_URL = "assets/base2.png";
const base2Image = new Image();
base2Image.decoding = "async";
base2Image.src = BASE2_URL;
let base2Texture = null;
let base2Loaded = false;

export function applyBase2Texture() {
  if (!base2Loaded || base2Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(base2Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    base2Texture = tex;
    pixiTextures.base_heavy = tex;
    pixiTextureAnchors.base_heavy = 0.5;

    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(base2Image.naturalWidth || 1, base2Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.base_heavy = desired / denom;
  } catch (e) {}
}

base2Image.addEventListener("load", () => {
  base2Loaded = true;
  applyBase2Texture();
});
base2Image.addEventListener("error", () => {
  base2Loaded = false;
});

const BASE3_URL = "assets/base3.png";
const base3Image = new Image();
base3Image.decoding = "async";
base3Image.src = BASE3_URL;
let base3Texture = null;
let base3Loaded = false;

export function applyBase3Texture() {
  if (!base3Loaded || base3Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(base3Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    base3Texture = tex;
    pixiTextures.base_rapid = tex;
    pixiTextureAnchors.base_rapid = 0.5;

    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(base3Image.naturalWidth || 1, base3Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.base_rapid = desired / denom;
  } catch (e) {}
}

base3Image.addEventListener("load", () => {
  base3Loaded = true;
  applyBase3Texture();
});
base3Image.addEventListener("error", () => {
  base3Loaded = false;
});

// Cave Pinwheel Textures
const CAVE_PINWHEEL1_URL = "assets/cave_pinwheel1.png";
const CAVE_PINWHEEL2_URL = "assets/cave_pinwheel2.png";
const CAVE_PINWHEEL3_URL = "assets/cave_pinwheel3.png";
const cavePinwheel1Image = new Image();
const cavePinwheel2Image = new Image();
const cavePinwheel3Image = new Image();
cavePinwheel1Image.decoding = "async";
cavePinwheel2Image.decoding = "async";
cavePinwheel3Image.decoding = "async";
cavePinwheel1Image.src = CAVE_PINWHEEL1_URL;
cavePinwheel2Image.src = CAVE_PINWHEEL2_URL;
cavePinwheel3Image.src = CAVE_PINWHEEL3_URL;
let cavePinwheel1Texture = null;
let cavePinwheel2Texture = null;
let cavePinwheel3Texture = null;
let cavePinwheel1Loaded = false;
let cavePinwheel2Loaded = false;
let cavePinwheel3Loaded = false;

export function applyCavePinwheel1Texture() {
  if (!cavePinwheel1Loaded || cavePinwheel1Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(cavePinwheel1Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    cavePinwheel1Texture = tex;
    pixiTextures.cave_pinwheel_1 = tex;
    pixiTextureAnchors.cave_pinwheel_1 = 0.5;

    // Scale: 140/256 = 0.547 for 256x256 graphics
    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(cavePinwheel1Image.naturalWidth || 1, cavePinwheel1Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.cave_pinwheel_1 = desired / denom;
  } catch (e) {}
}

export function applyCavePinwheel2Texture() {
  if (!cavePinwheel2Loaded || cavePinwheel2Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(cavePinwheel2Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    cavePinwheel2Texture = tex;
    pixiTextures.cave_pinwheel_2 = tex;
    pixiTextureAnchors.cave_pinwheel_2 = 0.5;

    // Scale: 140/256 = 0.547 for 256x256 graphics
    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(cavePinwheel2Image.naturalWidth || 1, cavePinwheel2Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.cave_pinwheel_2 = desired / denom;
  } catch (e) {}
}

export function applyCavePinwheel3Texture() {
  if (!cavePinwheel3Loaded || cavePinwheel3Texture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(cavePinwheel3Image);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    cavePinwheel3Texture = tex;
    pixiTextures.cave_pinwheel_3 = tex;
    pixiTextureAnchors.cave_pinwheel_3 = 0.5;

    // Scale: 140/256 = 0.547 for 256x256 graphics
    const desired = 140;
    const denom = Math.max(
      1,
      Math.max(cavePinwheel3Image.naturalWidth || 1, cavePinwheel3Image.naturalHeight || 1)
    );
    pixiTextureBaseScales.cave_pinwheel_3 = desired / denom;
  } catch (e) {}
}

cavePinwheel1Image.addEventListener("load", () => {
  cavePinwheel1Loaded = true;
  applyCavePinwheel1Texture();
});
cavePinwheel1Image.addEventListener("error", () => {
  cavePinwheel1Loaded = false;
});
cavePinwheel2Image.addEventListener("load", () => {
  cavePinwheel2Loaded = true;
  applyCavePinwheel2Texture();
});
cavePinwheel2Image.addEventListener("error", () => {
  cavePinwheel2Loaded = false;
});
cavePinwheel3Image.addEventListener("load", () => {
  cavePinwheel3Loaded = true;
  applyCavePinwheel3Texture();
});
cavePinwheel3Image.addEventListener("error", () => {
  cavePinwheel3Loaded = false;
});

const CRUISER_URL = "assets/cruiser.png";
const cruiserImage = new Image();
cruiserImage.decoding = "async";
cruiserImage.src = CRUISER_URL;
let cruiserTexture = null;
let cruiserLoaded = false;

export function applyCruiserTexture() {
  if (!cruiserLoaded || cruiserTexture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(cruiserImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    cruiserTexture = tex;
    pixiTextures.enemy_cruiser = tex;
    pixiTextureAnchors.enemy_cruiser = 0.5;

    const w = cruiserImage.naturalWidth || 0;
    const h = cruiserImage.naturalHeight || 0;
    pixiTextureRotOffsets.enemy_cruiser = h > w ? Math.PI / 2 : 0;

    pixiTextureScaleToRadius.enemy_cruiser = true;
  } catch (e) {}
}

cruiserImage.addEventListener("load", () => {
  cruiserLoaded = true;
  applyCruiserTexture();
});
cruiserImage.addEventListener("error", () => {
  cruiserLoaded = false;
});

const WARP_BOSS_URL = "assets/warp_boss.png";
const warpBossImage = new Image();
warpBossImage.decoding = "async";
warpBossImage.src = WARP_BOSS_URL;
let warpBossTexture = null;
let warpBossLoaded = false;

export function applyWarpBossTexture() {
  if (!warpBossLoaded || warpBossTexture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(warpBossImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    warpBossTexture = tex;
    pixiTextures.warp_boss = tex;
    pixiTextureAnchors.warp_boss = 0.5;
    pixiTextureRotOffsets.warp_boss = 0;
    pixiTextureScaleToRadius.warp_boss = true;
  } catch (e) {}
}

warpBossImage.addEventListener("load", () => {
  warpBossLoaded = true;
  applyWarpBossTexture();
});
warpBossImage.addEventListener("error", () => {
  warpBossLoaded = false;
});

const FINAL_BOSS_URL = "assets/spaceboss2.png";
const finalBossImage = new Image();
finalBossImage.decoding = "async";
finalBossImage.src = FINAL_BOSS_URL;
let finalBossTexture = null;
let finalBossLoaded = false;

export function applyFinalBossTexture() {
  if (!finalBossLoaded || finalBossTexture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(finalBossImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    finalBossTexture = tex;
    pixiTextures.final_boss = tex;
    pixiTextureAnchors.final_boss = 0.5;
    pixiTextureRotOffsets.final_boss = 0;
    pixiTextureScaleToRadius.final_boss = true;
  } catch (e) {}
}

finalBossImage.addEventListener("load", () => {
  finalBossLoaded = true;
  applyFinalBossTexture();
});
finalBossImage.addEventListener("error", () => {
  finalBossLoaded = false;
});

const SHIELD_DRONE_URL = "assets/shield_drone.png";
const shieldDroneImage = new Image();
shieldDroneImage.decoding = "async";
shieldDroneImage.src = SHIELD_DRONE_URL;
let shieldDroneTexture = null;
let shieldDroneLoaded = false;

export function applyShieldDroneTexture() {
  if (!shieldDroneLoaded || shieldDroneTexture || !window.PIXI) return;
  try {
    const tex = PIXI.Texture.from(shieldDroneImage);
    try {
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    } catch (e) {}
    try {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    } catch (e) {}

    shieldDroneTexture = tex;
    pixiTextures.shield_drone = tex;
    pixiTextureAnchors.shield_drone = 0.5;
    pixiTextureRotOffsets.shield_drone = Math.PI / 2;
    pixiTextureScaleToRadius.shield_drone = true;
    pixiTextureBaseScales.shield_drone = 1.5;
  } catch (e) {
    console.error("Error loading shield drone texture:", e);
  }
}

shieldDroneImage.addEventListener("load", () => {
  shieldDroneLoaded = true;
  applyShieldDroneTexture();
});
shieldDroneImage.addEventListener("error", () => {
  shieldDroneLoaded = false;
});

export function loadAllTextures() {
  applyGunboatTextures();
  applyCaveGunboatTextures();
  applyStationTexture();
  applyDestroyerTexture();
  applyDestroyer2Texture();
  applyDungeonTextures();
  applyMonsterTextures();
  applyCaveTurretTexture();
  applyNuggetTexture();
  applyHealthTexture();
  applyBase1Texture();
  applyBase2Texture();
  applyBase3Texture();
  applyCavePinwheel1Texture();
  applyCavePinwheel2Texture();
  applyCavePinwheel3Texture();
  applyCruiserTexture();
  applyWarpBossTexture();
  applyFinalBossTexture();
  applyShieldDroneTexture();
}
