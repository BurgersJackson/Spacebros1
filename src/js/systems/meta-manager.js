import { GameContext } from '../core/game-context.js';
import { META_SHOP_UPGRADE_DATA } from '../core/constants.js';
import { showOverlayMessage, updateHealthUI } from '../utils/ui-helpers.js';

let currentModalUpgradeId = null;
let modalSourceButtonIndex = null;
let returningFromModal = false;

let getActiveMenuElementsFn = null;
let updateMenuVisualsFn = null;
let getGpStateFn = null;

export function registerMetaShopNavigationHandlers(handlers) {
    getActiveMenuElementsFn = handlers && handlers.getActiveMenuElements ? handlers.getActiveMenuElements : null;
    updateMenuVisualsFn = handlers && handlers.updateMenuVisuals ? handlers.updateMenuVisuals : null;
    getGpStateFn = handlers && handlers.getGpState ? handlers.getGpState : null;
}

export function getReturningFromModal() {
    return returningFromModal;
}

export function setReturningFromModal(value) {
    returningFromModal = !!value;
}

export function loadMetaProfile() {
    try {
        const profileKey = GameContext.currentProfileName
            ? `meta_profile_v1_${GameContext.currentProfileName}`
            : 'meta_profile_v1';
        let raw = localStorage.getItem(profileKey);

        if (!raw && GameContext.currentProfileName) {
            const legacyKey = 'meta_profile_v1';
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) {
                raw = legacyRaw;
                localStorage.setItem(profileKey, legacyRaw);
            }
        }

        GameContext.metaProfile = {
            bank: 0,
            purchases: {}
        };

        if (raw) {
            try {
                const saved = JSON.parse(raw);
                if (typeof saved.bank === 'number') GameContext.metaProfile.bank = saved.bank;
                if (saved.purchases) {
                    GameContext.metaProfile.purchases = Object.assign(GameContext.metaProfile.purchases, saved.purchases);
                }
            } catch (e) {
                console.warn('Failed to parse meta profile, using defaults', e);
            }
        }
        if (!GameContext.metaProfile.purchases) GameContext.metaProfile.purchases = {};
        GameContext.metaProfile.purchases = Object.assign({
            startDamage: 0,
            passiveHp: 0,
            rerollTokens: 0,
            hullPlating: 0,
            shieldCore: 0,
            staticBlueprint: 0,
            missilePrimer: 0,
            magnetBooster: 0,
            nukeCapacitor: 0,
            speedTuning: 0,
            bankMultiplier: 0,
            shopDiscount: 0,
            extraLife: 0,
            droneFabricator: 0,
            piercingRounds: 0,
            explosiveRounds: 0,
            criticalStrike: 0,
            splitShot: 0,
            thornArmor: 0,
            lifesteal: 0,
            evasionBoost: 0,
            shieldRecharge: 0,
            dashCooldown: 0,
            dashDuration: 0,
            xpMagnetPlus: 0,
            autoReroll: 0,
            nuggetMagnet: 0,
            contractSpeed: 0,
            startingRerolls: 0,
            luckyDrop: 0,
            bountyHunter: 0,
            comboMeter: 0,
            startingWeapon: 0,
            secondWind: 0,
            batteryCapacitor: 0
        }, GameContext.metaProfile.purchases);
        if (GameContext.metaProfile.purchases.warpPrecharge) delete GameContext.metaProfile.purchases.warpPrecharge;
        if (typeof GameContext.metaProfile.bank !== 'number') GameContext.metaProfile.bank = 0;

        for (const key of ['startDamage', 'passiveHp', 'hullPlating', 'shieldCore',
            'staticBlueprint', 'missilePrimer', 'magnetBooster',
            'nukeCapacitor', 'speedTuning', 'bankMultiplier',
            'shopDiscount', 'extraLife', 'droneFabricator']) {
            if (GameContext.metaProfile.purchases[key] === true) {
                GameContext.metaProfile.purchases[key] = 1;
            } else if (GameContext.metaProfile.purchases[key] === false) {
                GameContext.metaProfile.purchases[key] = 0;
            }
        }
    } catch (e) {
        console.warn('failed to load meta profile', e);
    }
}

export function resetMetaProfile() {
    GameContext.metaProfile = {
        bank: 0, purchases: {
            startDamage: 0,
            passiveHp: 0,
            rerollTokens: 0,
            hullPlating: 0,
            shieldCore: 0,
            staticBlueprint: 0,
            missilePrimer: 0,
            magnetBooster: 0,
            nukeCapacitor: 0,
            speedTuning: 0,
            bankMultiplier: 0,
            shopDiscount: 0,
            extraLife: 0,
            droneFabricator: 0,
            piercingRounds: 0,
            explosiveRounds: 0,
            criticalStrike: 0,
            splitShot: 0,
            thornArmor: 0,
            lifesteal: 0,
            evasionBoost: 0,
            shieldRecharge: 0,
            dashCooldown: 0,
            dashDuration: 0,
            xpMagnetPlus: 0,
            autoReroll: 0,
            nuggetMagnet: 0,
            contractSpeed: 0,
            startingRerolls: 0,
            luckyDrop: 0,
            bountyHunter: 0,
            comboMeter: 0,
            startingWeapon: 0,
            secondWind: 0
        }
    };
}

export function saveMetaProfile() {
    try {
        const profileKey = GameContext.currentProfileName
            ? `meta_profile_v1_${GameContext.currentProfileName}`
            : 'meta_profile_v1';
        GameContext.metaProfile.lastSavedAt = Date.now();
        const dataToSave = JSON.stringify(GameContext.metaProfile);
        localStorage.setItem(profileKey, dataToSave);
        updateMetaUI();
    } catch (e) { console.warn('failed to save meta profile', e); }
}

export function depositMetaNuggets() {
    const tier = GameContext.metaProfile.purchases.bankMultiplier || 0;
    let bonus = 0.1 * Math.min(tier, 3);
    if (tier > 3) {
        const table = { 0: 1.0, 1: 1.1, 2: 1.2, 3: 1.3 };
        const extraValue = getDiminishingValue(tier, table, 0.99);
        bonus = extraValue - 1.0;
    }
    GameContext.metaProfile.bank += Math.round(GameContext.spaceNuggets * (1 + bonus));
    saveMetaProfile();
}

export function updateMetaUI() {
    const bankEl = document.getElementById('meta-bank');
    if (bankEl) bankEl.innerText = GameContext.metaProfile.bank;
    const startEl = document.getElementById('meta-start-dmg');
    if (startEl) {
        const tier = GameContext.metaProfile.purchases.startDamage || 0;
        const cost = getMetaUpgradeCost('startDamage', 10);
        startEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const passiveEl = document.getElementById('meta-passive-hp');
    if (passiveEl) {
        const tier = GameContext.metaProfile.purchases.passiveHp || 0;
        const cost = getMetaUpgradeCost('passiveHp', 15);
        passiveEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const rerollEl = document.getElementById('meta-reroll-count');
    if (rerollEl) rerollEl.innerText = GameContext.metaProfile.purchases.rerollTokens || 0;
    const hullEl = document.getElementById('meta-hull');
    if (hullEl) {
        const tier = GameContext.metaProfile.purchases.hullPlating || 0;
        const cost = getMetaUpgradeCost('hullPlating', 30);
        hullEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const shieldEl = document.getElementById('meta-shield-core');
    if (shieldEl) {
        const tier = GameContext.metaProfile.purchases.shieldCore || 0;
        const cost = getMetaUpgradeCost('shieldCore', 30);
        shieldEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const staticEl = document.getElementById('meta-static');
    if (staticEl) {
        const tier = GameContext.metaProfile.purchases.staticBlueprint || 0;
        const cost = getMetaUpgradeCost('staticBlueprint', 40);
        staticEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const missileEl = document.getElementById('meta-missile');
    if (missileEl) {
        const tier = GameContext.metaProfile.purchases.missilePrimer || 0;
        const cost = getMetaUpgradeCost('missilePrimer', 40);
        missileEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const magnetEl = document.getElementById('meta-magnet');
    if (magnetEl) {
        const tier = GameContext.metaProfile.purchases.magnetBooster || 0;
        const cost = getMetaUpgradeCost('magnetBooster', 25);
        magnetEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const nukeEl = document.getElementById('meta-nuke');
    if (nukeEl) {
        const tier = GameContext.metaProfile.purchases.nukeCapacitor || 0;
        const cost = getMetaUpgradeCost('nukeCapacitor', 35);
        nukeEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const speedEl = document.getElementById('meta-speed');
    if (speedEl) {
        const tier = GameContext.metaProfile.purchases.speedTuning || 0;
        const cost = getMetaUpgradeCost('speedTuning', 25);
        speedEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const bankMultEl = document.getElementById('meta-bank-mult');
    if (bankMultEl) {
        const tier = GameContext.metaProfile.purchases.bankMultiplier || 0;
        const cost = getMetaUpgradeCost('bankMultiplier', 50);
        bankMultEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const discountEl = document.getElementById('meta-discount');
    if (discountEl) {
        const tier = GameContext.metaProfile.purchases.shopDiscount || 0;
        const cost = getMetaUpgradeCost('shopDiscount', 50);
        discountEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const extraLifeEl = document.getElementById('meta-extra-life');
    if (extraLifeEl) {
        const tier = GameContext.metaProfile.purchases.extraLife || 0;
        const cost = getMetaUpgradeCost('extraLife', 60);
        extraLifeEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const droneEl = document.getElementById('meta-drone');
    if (droneEl) {
        const tier = GameContext.metaProfile.purchases.droneFabricator || 0;
        const cost = getMetaUpgradeCost('droneFabricator', 40);
        droneEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const piercingEl = document.getElementById('meta-piercing');
    if (piercingEl) {
        const tier = GameContext.metaProfile.purchases.piercingRounds || 0;
        const cost = getMetaUpgradeCost('piercingRounds', 45);
        piercingEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const explosiveEl = document.getElementById('meta-explosive');
    if (explosiveEl) {
        const tier = GameContext.metaProfile.purchases.explosiveRounds || 0;
        const cost = getMetaUpgradeCost('explosiveRounds', 55);
        explosiveEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const critEl = document.getElementById('meta-crit');
    if (critEl) {
        const tier = GameContext.metaProfile.purchases.criticalStrike || 0;
        const cost = getMetaUpgradeCost('criticalStrike', 50);
        critEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const splitEl = document.getElementById('meta-split');
    if (splitEl) {
        const tier = GameContext.metaProfile.purchases.splitShot || 0;
        const cost = getMetaUpgradeCost('splitShot', 60);
        splitEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const thornEl = document.getElementById('meta-thorn');
    if (thornEl) {
        const tier = GameContext.metaProfile.purchases.thornArmor || 0;
        const cost = getMetaUpgradeCost('thornArmor', 35);
        thornEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const lifestealEl = document.getElementById('meta-lifesteal');
    if (lifestealEl) {
        const tier = GameContext.metaProfile.purchases.lifesteal || 0;
        const cost = getMetaUpgradeCost('lifesteal', 40);
        lifestealEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const evasionEl = document.getElementById('meta-evasion');
    if (evasionEl) {
        const tier = GameContext.metaProfile.purchases.evasionBoost || 0;
        const cost = getMetaUpgradeCost('evasionBoost', 45);
        evasionEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const shieldRegenEl = document.getElementById('meta-shieldregen');
    if (shieldRegenEl) {
        const tier = GameContext.metaProfile.purchases.shieldRecharge || 0;
        const cost = getMetaUpgradeCost('shieldRecharge', 30);
        shieldRegenEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const dashCdEl = document.getElementById('meta-dashcd');
    if (dashCdEl) {
        const tier = GameContext.metaProfile.purchases.dashCooldown || 0;
        const cost = getMetaUpgradeCost('dashCooldown', 35);
        dashCdEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const dashDurEl = document.getElementById('meta-dashdur');
    if (dashDurEl) {
        const tier = GameContext.metaProfile.purchases.dashDuration || 0;
        const cost = getMetaUpgradeCost('dashDuration', 30);
        dashDurEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const xpMagEl = document.getElementById('meta-xpmag');
    if (xpMagEl) {
        const tier = GameContext.metaProfile.purchases.xpMagnetPlus || 0;
        const cost = getMetaUpgradeCost('xpMagnetPlus', 25);
        xpMagEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const autoRerollEl = document.getElementById('meta-autoreroll');
    if (autoRerollEl) {
        const tier = GameContext.metaProfile.purchases.autoReroll || 0;
        const cost = getMetaUpgradeCost('autoReroll', 50);
        autoRerollEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const nuggetMagEl = document.getElementById('meta-nuggetmag');
    if (nuggetMagEl) {
        const tier = GameContext.metaProfile.purchases.nuggetMagnet || 0;
        const cost = getMetaUpgradeCost('nuggetMagnet', 35);
        nuggetMagEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const contractSpeedEl = document.getElementById('meta-contractspeed');
    if (contractSpeedEl) {
        const tier = GameContext.metaProfile.purchases.contractSpeed || 0;
        const cost = getMetaUpgradeCost('contractSpeed', 40);
        contractSpeedEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const startRerollEl = document.getElementById('meta-startreroll');
    if (startRerollEl) {
        const tier = GameContext.metaProfile.purchases.startingRerolls || 0;
        const cost = getMetaUpgradeCost('startingRerolls', 30);
        startRerollEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const luckyEl = document.getElementById('meta-lucky');
    if (luckyEl) {
        const tier = GameContext.metaProfile.purchases.luckyDrop || 0;
        const cost = getMetaUpgradeCost('luckyDrop', 55);
        luckyEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const bountyEl = document.getElementById('meta-bounty');
    if (bountyEl) {
        const tier = GameContext.metaProfile.purchases.bountyHunter || 0;
        const cost = getMetaUpgradeCost('bountyHunter', 45);
        bountyEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const comboEl = document.getElementById('meta-combo');
    if (comboEl) {
        const tier = GameContext.metaProfile.purchases.comboMeter || 0;
        const cost = getMetaUpgradeCost('comboMeter', 50);
        comboEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const startWeaponEl = document.getElementById('meta-startweapon');
    if (startWeaponEl) {
        const tier = GameContext.metaProfile.purchases.startingWeapon || 0;
        const cost = getMetaUpgradeCost('startingWeapon', 60);
        startWeaponEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const secondWindEl = document.getElementById('meta-secondwind');
    if (secondWindEl) {
        const tier = GameContext.metaProfile.purchases.secondWind || 0;
        const cost = getMetaUpgradeCost('secondWind', 70);
        secondWindEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }
    const batteryEl = document.getElementById('meta-battery');
    if (batteryEl) {
        const tier = GameContext.metaProfile.purchases.batteryCapacitor || 0;
        const cost = getMetaUpgradeCost('batteryCapacitor', 45);
        batteryEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
    }

    const upgradeButtonMap = {
        'buy-start-dmg': 'startDamage',
        'buy-passive-hp': 'passiveHp',
        'buy-hull': 'hullPlating',
        'buy-shield-core': 'shieldCore',
        'buy-static': 'staticBlueprint',
        'buy-missile': 'missilePrimer',
        'buy-magnet': 'magnetBooster',
        'buy-nuke': 'nukeCapacitor',
        'buy-speed': 'speedTuning',
        'buy-bank-mult': 'bankMultiplier',
        'buy-discount': 'shopDiscount',
        'buy-extra-life': 'extraLife',
        'buy-drone': 'droneFabricator',
        'buy-piercing': 'piercingRounds',
        'buy-explosive': 'explosiveRounds',
        'buy-crit': 'criticalStrike',
        'buy-split': 'splitShot',
        'buy-thorn': 'thornArmor',
        'buy-lifesteal': 'lifesteal',
        'buy-evasion': 'evasionBoost',
        'buy-shieldregen': 'shieldRecharge',
        'buy-dashcd': 'dashCooldown',
        'buy-dashdur': 'dashDuration',
        'buy-xpmag': 'xpMagnetPlus',
        'buy-autoreroll': 'autoReroll',
        'buy-nuggetmag': 'nuggetMagnet',
        'buy-contractspeed': 'contractSpeed',
        'buy-startreroll': 'startingRerolls',
        'buy-lucky': 'luckyDrop',
        'buy-bounty': 'bountyHunter',
        'buy-combo': 'comboMeter',
        'buy-startweapon': 'startingWeapon',
        'buy-secondwind': 'secondWind',
        'buy-battery': 'batteryCapacitor'
    };
    Object.entries(upgradeButtonMap).forEach(([btnId, upgradeId]) => {
        const button = document.getElementById(btnId);
        if (button) {
            button.onclick = (e) => showMetaShopUpgradeModal(upgradeId, e.target);
        }
    });
}

export function showUpgradeDescription(upgradeId) {
    const data = META_SHOP_UPGRADE_DATA[upgradeId];
    if (!data) return;

    const titleEl = document.getElementById('desc-panel-title');
    const contentEl = document.getElementById('desc-panel-content');
    const tierInfoEl = document.getElementById('desc-panel-tier-info');

    const currentTier = GameContext.metaProfile.purchases[upgradeId] || 0;

    titleEl.textContent = data.name.toUpperCase();

    let html = `<div style="margin-bottom: 8px;">${data.description}</div>`;
    if (currentTier === 0) {
        html += `<div style="color: #ff0;">First Tier: ${data.tier1}</div>`;
    } else {
        html += `<div style="color: #0f0;">Current Tier: ${currentTier}</div>`;
        html += `<div style="color: #ff0;">Next Tier Benefits:</div>`;
        if (data[`tier${currentTier + 1}`]) {
            html += `<div>- ${data[`tier${currentTier + 1}`]}</div>`;
        }
    }
    html += `<div style="color: #888; font-size: 12px; margin-top: 8px;">${data.notes}</div>`;

    contentEl.innerHTML = html;
    tierInfoEl.textContent = `OWNED: TIER ${currentTier}`;
}

export function showMetaShopUpgradeModal(upgradeId, clickedButton) {
    const data = META_SHOP_UPGRADE_DATA[upgradeId];
    if (!data) {
        console.error(`Unknown upgrade ID: ${upgradeId}`);
        return;
    }

    currentModalUpgradeId = upgradeId;

    if (clickedButton) {
        const shopButtons = Array.from(document.querySelectorAll('#meta-shop .meta-item button'));
        modalSourceButtonIndex = shopButtons.indexOf(clickedButton);
    } else {
        modalSourceButtonIndex = null;
    }

    const modal = document.getElementById('meta-shop-modal');
    const titleEl = document.getElementById('meta-modal-title');
    const contentEl = document.getElementById('meta-modal-content');
    const costEl = document.getElementById('meta-modal-cost');
    const tierEl = document.getElementById('meta-modal-tier-info');
    const buyBtn = document.getElementById('meta-modal-buy');

    if (!modal || !titleEl || !contentEl || !costEl || !tierEl || !buyBtn) {
        console.error('Meta shop modal elements missing');
        return;
    }

    const currentTier = GameContext.metaProfile.purchases[upgradeId] || 0;

    const baseCostMap = {
        'startDamage': 10, 'passiveHp': 15, 'hullPlating': 30, 'shieldCore': 30,
        'staticBlueprint': 40, 'missilePrimer': 40, 'magnetBooster': 25,
        'nukeCapacitor': 35, 'speedTuning': 25, 'bankMultiplier': 50,
        'shopDiscount': 50, 'extraLife': 60, 'droneFabricator': 40,
        'piercingRounds': 45, 'explosiveRounds': 55, 'criticalStrike': 50,
        'splitShot': 60, 'thornArmor': 35, 'lifesteal': 40,
        'evasionBoost': 45, 'shieldRecharge': 30, 'dashCooldown': 35,
        'dashDuration': 30, 'xpMagnetPlus': 25, 'autoReroll': 50,
        'nuggetMagnet': 35, 'contractSpeed': 40, 'startingRerolls': 30,
        'luckyDrop': 55, 'bountyHunter': 45, 'comboMeter': 50,
        'startingWeapon': 60, 'secondWind': 70, 'batteryCapacitor': 45
    };

    const baseCost = baseCostMap[upgradeId] || 50;
    const cost = getMetaUpgradeCost(upgradeId, baseCost);
    const canAfford = GameContext.metaProfile.bank >= cost;

    titleEl.textContent = data.name.toUpperCase();

    let html = `<div style="margin-bottom: 12px;">${data.description}</div>`;

    if (currentTier === 0) {
        html += `<div style="color: #ff0; margin-top: 10px;"><strong>First Tier:</strong> ${data.tier1}</div>`;
    } else {
        html += `<div style="color: #0f0; margin-top: 10px;"><strong>Current Tier:</strong> ${currentTier}</div>`;

        const nextTierKey = `tier${currentTier + 1}`;
        let nextText = data[nextTierKey];

        if (!nextText) {
            nextText = "Increases effectiveness further (Infinite Scaling)";
            if (upgradeId.includes('Damage') || upgradeId === 'batteryCapacitor' || upgradeId === 'nukeCapacitor') {
                nextText = "Increases damage output";
            } else if (upgradeId === 'passiveHp' || upgradeId === 'hullPlating') {
                nextText = "Increases maximum hull HP";
            } else if (upgradeId === 'shieldCore') {
                nextText = "Adds segments or increases shield HP";
            }
        }

        html += `<div style="color: #ff0; margin-top: 8px;"><strong>Next Tier Benefits:</strong></div>`;
        html += `<div style="margin-left: 15px;">- ${nextText}</div>`;
    }

    html += `<div style="color: #888; font-size: 13px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #333;">${data.notes}</div>`;

    contentEl.innerHTML = html;
    costEl.textContent = `Cost: ${cost} Meta Nuggets`;
    costEl.style.color = canAfford ? '#0f0' : '#f00';
    tierEl.textContent = `OWNED: TIER ${currentTier}`;

    const nextTierKey = `tier${currentTier + 1}`;

    let nextBenefitText = data[nextTierKey];
    if (!nextBenefitText) {
        nextBenefitText = "Increases effectiveness further (Infinite Scaling)";
        if (upgradeId.includes('Damage') || upgradeId === 'batteryCapacitor' || upgradeId === 'nukeCapacitor') {
            nextBenefitText = "Increases damage output";
        } else if (upgradeId === 'passiveHp' || upgradeId === 'hullPlating') {
            nextBenefitText = "Increases maximum hull HP";
        } else if (upgradeId === 'shieldCore') {
            nextBenefitText = "Adds more shield segments";
        }
    }

    buyBtn.disabled = !canAfford;
    buyBtn.textContent = canAfford ? `BUY (${cost} NUGS)` : `NEED ${cost} NUGS`;

    modal.style.display = 'block';

    setupMetaShopModalHandlers(upgradeId, cost, currentTier);
}

export function setupMetaShopModalHandlers(upgradeId, cost, currentTier) {
    const modal = document.getElementById('meta-shop-modal');
    const backBtn = document.getElementById('meta-modal-back');
    const buyBtn = document.getElementById('meta-modal-buy');

    if (!modal || !backBtn || !buyBtn) return;

    const newBackBtn = backBtn.cloneNode(true);
    const newBuyBtn = buyBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    buyBtn.parentNode.replaceChild(newBuyBtn, buyBtn);

    GameContext.menuSelectionIndex = 0;
    const gpState = getGpStateFn ? getGpStateFn() : null;
    if (gpState) gpState.lastMenuElements = null;

    requestAnimationFrame(() => {
        const activeElements = getActiveMenuElementsFn ? getActiveMenuElementsFn() : [];
        if (activeElements.length > 0) {
            if (updateMenuVisualsFn) updateMenuVisualsFn(activeElements);
            activeElements[0].focus();
        }
    });

    const closeModal = () => {
        modal.style.display = 'none';
        currentModalUpgradeId = null;

        const savedIndex = modalSourceButtonIndex;
        modalSourceButtonIndex = null;

        if (savedIndex !== null && savedIndex >= 0) {
            GameContext.menuSelectionIndex = savedIndex;
            returningFromModal = true;
        }

        if (gpState) gpState.lastMenuElements = null;
    };

    newBackBtn.addEventListener('click', closeModal);

    newBuyBtn.addEventListener('click', () => {
        if (GameContext.metaProfile.bank >= cost) {
            GameContext.metaProfile.bank -= cost;
            GameContext.metaProfile.purchases[upgradeId] = currentTier + 1;
            saveMetaProfile();

            const data = META_SHOP_UPGRADE_DATA[upgradeId];
            showOverlayMessage(`${data.name.toUpperCase()} TIER ${currentTier + 1}!`, '#0f0', 1500);

            updateMetaUI();

            closeModal();
        } else {
            showOverlayMessage(`NEED ${cost} NUGS`, '#f00', 1500);
        }
    });

    const onEscape = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            e.preventDefault();

            const savedIndex = modalSourceButtonIndex;
            modalSourceButtonIndex = null;

            modal.style.display = 'none';
            currentModalUpgradeId = null;

            if (savedIndex !== null && savedIndex >= 0) {
                GameContext.menuSelectionIndex = savedIndex;
                returningFromModal = true;
            }

            if (gpState) gpState.lastMenuElements = null;

            window.removeEventListener('keydown', onEscape);
        }
    };
    window.addEventListener('keydown', onEscape);
}

export function getDiminishingValue(tier, baseTable, decayFactor = 0.99) {
    if (tier <= 3) return baseTable[tier] || 1.0;

    const baseValue = baseTable[3] || 1.0;
    const tiersBeyond = tier - 3;

    let totalBonus = 0;
    for (let i = 1; i <= tiersBeyond; i++) {
        totalBonus += 0.01 * Math.pow(decayFactor, i - 1);
    }

    return baseValue * (1 + totalBonus);
}

export function getMetaUpgradeCost(upgradeId, baseCost) {
    const currentTier = GameContext.metaProfile.purchases[upgradeId] || 0;
    const discountTier = GameContext.metaProfile.purchases.shopDiscount || 0;
    let discount = 1.0;
    if (discountTier > 0) {
        const discountMultiplier = 0.1 * Math.min(discountTier, 3);
        if (discountTier > 3) {
            const table = { 0: 1.0, 1: 0.9, 2: 0.8, 3: 0.7 };
            const extraValue = getDiminishingValue(discountTier, table, 0.99);
            discount = extraValue;
        } else {
            discount = 1.0 - discountMultiplier;
        }
    }
    const cost = Math.ceil(baseCost * Math.pow(1.2, currentTier) * discount);
    return cost;
}

export function applyMetaUpgrades(spawnDroneFn) {
    const startDamageTier = GameContext.metaProfile.purchases.startDamage || 0;
    if (startDamageTier > 0) {
        GameContext.player.stats.damageMult *= (1 + (0.1 * startDamageTier));
    }

    const passiveHpTier = GameContext.metaProfile.purchases.passiveHp || 0;
    if (passiveHpTier > 0) {
        GameContext.player.maxHp += 10 * passiveHpTier;
        GameContext.player.hp = GameContext.player.maxHp;
        updateHealthUI(GameContext);
    }

    const hullPlatingTier = GameContext.metaProfile.purchases.hullPlating || 0;
    if (hullPlatingTier > 0) {
        GameContext.player.maxHp += 15 * hullPlatingTier;
        GameContext.player.hp = GameContext.player.maxHp;
    }

    const shieldCoreTier = GameContext.metaProfile.purchases.shieldCore || 0;
    if (shieldCoreTier > 0) {
        const bonusSegments = Math.ceil(shieldCoreTier / 2);
        const bonusHp = Math.floor(shieldCoreTier / 2);
        const totalSegments = 8 + bonusSegments;
        const totalHp = 2 + bonusHp;

        GameContext.player.shieldSegments = new Array(totalSegments).fill(totalHp);
        GameContext.player.maxShieldSegments = totalSegments;
    }

    const staticBlueprintTier = GameContext.metaProfile.purchases.staticBlueprint || 0;
    if (staticBlueprintTier > 0) {
        for (let i = 0; i < staticBlueprintTier; i++) {
            const effectiveness = Math.max(0.2, 1 - (i * 0.2));
            GameContext.player.staticWeapons.push({
                type: 'forward',
                source: 'meta',
                effectiveness: effectiveness
            });
        }
    }

    const missilePrimerTier = GameContext.metaProfile.purchases.missilePrimer || 0;
    GameContext.player.stats.homingFromMeta = missilePrimerTier;
    if (missilePrimerTier > 0) {
        GameContext.player.stats.homing = Math.max(GameContext.player.stats.homingFromUpgrade, GameContext.player.stats.homingFromMeta);
        GameContext.player.missileTimer = 0;
    }

    const magnetBoosterTier = GameContext.metaProfile.purchases.magnetBooster || 0;
    if (magnetBoosterTier > 0) {
        const baseRadius = 300;
        const extraRadius = magnetBoosterTier > 1 ? (magnetBoosterTier - 1) * 50 * Math.pow(0.9, magnetBoosterTier - 2) : 0;
        GameContext.player.magnetRadius = Math.max(GameContext.player.magnetRadius, baseRadius + extraRadius);
    }

    const nukeCapacitorTier = GameContext.metaProfile.purchases.nukeCapacitor || 0;
    if (nukeCapacitorTier > 0) {
        GameContext.player.defenseRingTier = nukeCapacitorTier;
        GameContext.player.defenseOrbDamage = 5 + (nukeCapacitorTier - 1);
        GameContext.player.defenseOrbs = [];
        const count = nukeCapacitorTier;
        for (let i = 0; i < count; i++) {
            GameContext.player.defenseOrbs.push({
                angleOffset: (Math.PI * 2 * i) / count,
                hitCooldowns: new WeakMap()
            });
        }
    }

    const speedTuningTier = GameContext.metaProfile.purchases.speedTuning || 0;
    if (speedTuningTier > 0) {
        GameContext.player.stats.speedMult *= (1 + (0.05 * speedTuningTier));
    }

    const droneFabricatorTier = GameContext.metaProfile.purchases.droneFabricator || 0;
    if (droneFabricatorTier > 0 && typeof spawnDroneFn === 'function') {
        const droneCount = Math.min(droneFabricatorTier, 5);
        for (let i = 0; i < droneCount; i++) {
            spawnDroneFn('shooter');
        }
    }

    const piercingRoundsTier = GameContext.metaProfile.purchases.piercingRounds || 0;
    if (piercingRoundsTier > 0) {
        let pierceCount = Math.min(piercingRoundsTier, 3);
        if (piercingRoundsTier > 3) {
            pierceCount += (piercingRoundsTier - 3) * 0.5;
        }
        GameContext.player.stats.pierceCount = (GameContext.player.stats.pierceCount || 0) + pierceCount;
    }

    const explosiveRoundsTier = GameContext.metaProfile.purchases.explosiveRounds || 0;
    if (explosiveRoundsTier > 0) {
        let explosiveChance = 0.2 * Math.min(explosiveRoundsTier, 3);
        if (explosiveRoundsTier > 3) {
            explosiveChance += 0.05 * (explosiveRoundsTier - 3);
        }
        GameContext.player.stats.explosiveChance = (GameContext.player.stats.explosiveChance || 0) + Math.min(explosiveChance, 1.0);
        GameContext.player.stats.explosiveDamage = (GameContext.player.stats.explosiveDamage || 0) + 30;
    }

    const criticalStrikeTier = GameContext.metaProfile.purchases.criticalStrike || 0;
    if (criticalStrikeTier > 0) {
        let critChance = 0.05 * Math.min(criticalStrikeTier, 3);
        if (criticalStrikeTier > 3) {
            critChance += 0.02 * (criticalStrikeTier - 3);
        }
        GameContext.player.stats.critChance = (GameContext.player.stats.critChance || 0) + Math.min(critChance, 0.30);
        GameContext.player.stats.critDamage = (GameContext.player.stats.critDamage || 1.0) + 1.0;
    }

    const splitShotTier = GameContext.metaProfile.purchases.splitShot || 0;
    if (splitShotTier > 0) {
        let splitChance = 0.1 * Math.min(splitShotTier, 3);
        if (splitShotTier > 3) {
            splitChance += 0.03 * (splitShotTier - 3);
        }
        GameContext.player.stats.splitChance = (GameContext.player.stats.splitChance || 0) + Math.min(splitChance, 0.50);
    }

    const thornArmorTier = GameContext.metaProfile.purchases.thornArmor || 0;
    if (thornArmorTier > 0) {
        let thornPercent = 0.1 * Math.min(thornArmorTier, 3);
        if (thornArmorTier > 3) {
            thornPercent += 0.02 * (thornArmorTier - 3);
        }
        GameContext.player.stats.thornReflect = Math.min(thornPercent, 0.35);
    }

    const lifestealTier = GameContext.metaProfile.purchases.lifesteal || 0;
    if (lifestealTier > 0) {
        const thresholds = [100, 75, 50];
        let threshold = thresholds[Math.min(lifestealTier - 1, 2)];
        if (lifestealTier > 3) {
            threshold -= 5 * (lifestealTier - 3);
        }
        GameContext.player.stats.lifestealThreshold = Math.max(threshold, 25);
        GameContext.player.stats.lifestealTracking = 0;
    }

    const evasionBoostTier = GameContext.metaProfile.purchases.evasionBoost || 0;
    if (evasionBoostTier > 0) {
        let evasionChance = 0.05 * Math.min(evasionBoostTier, 3);
        if (evasionBoostTier > 3) {
            evasionChance += 0.02 * (evasionBoostTier - 3);
        }
        GameContext.player.stats.evasionChance = (GameContext.player.stats.evasionChance || 0) + Math.min(evasionChance, 0.25);
    }

    const shieldRechargeTier = GameContext.metaProfile.purchases.shieldRecharge || 0;
    if (shieldRechargeTier > 0) {
        const intervals = [30, 20, 15];
        let interval = intervals[Math.min(shieldRechargeTier - 1, 2)];
        if (shieldRechargeTier > 3) {
            interval = Math.max(interval - (shieldRechargeTier - 3), 5);
        }
        GameContext.player.stats.shieldRechargeInterval = interval * 60;
        GameContext.player.stats.shieldRechargeTimer = 0;
        GameContext.player.stats.shieldRechargeLast = Date.now();
    }

    const dashCooldownTier = GameContext.metaProfile.purchases.dashCooldown || 0;
    if (dashCooldownTier > 0) {
        let cooldownReduction = Math.min(dashCooldownTier, 3);
        if (dashCooldownTier > 3) {
            cooldownReduction += 0.3 * (dashCooldownTier - 3);
        }
        GameContext.player.stats.turboCooldownReduction = cooldownReduction;
    }

    const dashDurationTier = GameContext.metaProfile.purchases.dashDuration || 0;
    if (dashDurationTier > 0) {
        let durationBonus = 0.5 * Math.min(dashDurationTier, 3);
        if (dashDurationTier > 3) {
            durationBonus += 0.2 * (dashDurationTier - 3);
        }
        GameContext.player.stats.turboDurationBonus = durationBonus * 60;
    }

    const xpMagnetPlusTier = GameContext.metaProfile.purchases.xpMagnetPlus || 0;
    if (xpMagnetPlusTier > 0) {
        let magnetBonus = 0.2 * Math.min(xpMagnetPlusTier, 3);
        if (xpMagnetPlusTier > 3) {
            magnetBonus += 0.1 * (xpMagnetPlusTier - 3);
        }
        GameContext.player.stats.magnetBonusMult = (GameContext.player.stats.magnetBonusMult || 1.0) + magnetBonus;
    }

    const autoRerollTier = GameContext.metaProfile.purchases.autoReroll || 0;
    if (autoRerollTier > 0) {
        let autoRerollChance = 0.1 * Math.min(autoRerollTier, 3);
        if (autoRerollTier > 3) {
            autoRerollChance += 0.03 * (autoRerollTier - 3);
        }
        GameContext.player.stats.autoRerollChance = Math.min(autoRerollChance, 0.50);
    }

    const nuggetMagnetTier = GameContext.metaProfile.purchases.nuggetMagnet || 0;
    if (nuggetMagnetTier > 0) {
        let nuggetMagnetBonus = 0.5 * Math.min(nuggetMagnetTier, 3);
        if (nuggetMagnetTier > 3) {
            nuggetMagnetBonus += 0.25 * (nuggetMagnetTier - 3);
        }
        GameContext.player.stats.nuggetMagnetBonus = (GameContext.player.stats.nuggetMagnetBonus || 1.0) + nuggetMagnetBonus;
    }

    const contractSpeedTier = GameContext.metaProfile.purchases.contractSpeed || 0;
    if (contractSpeedTier > 0) {
        let contractSpeedBonus = 0.1 * Math.min(contractSpeedTier, 3);
        if (contractSpeedTier > 3) {
            contractSpeedBonus += 0.05 * (contractSpeedTier - 3);
        }
        GameContext.player.stats.contractSpeedMult = (GameContext.player.stats.contractSpeedMult || 1.0) + contractSpeedBonus;
    }

    const startingRerollsTier = GameContext.metaProfile.purchases.startingRerolls || 0;
    if (startingRerollsTier > 0) {
        let startingTokens = Math.min(startingRerollsTier, 3);
        if (startingRerollsTier > 3) {
            startingTokens += 0.5 * (startingRerollsTier - 3);
        }
        GameContext.rerollTokens += Math.floor(startingTokens);
    }

    const luckyDropTier = GameContext.metaProfile.purchases.luckyDrop || 0;
    if (luckyDropTier > 0) {
        let healthDropBonus = 0.05 * Math.min(luckyDropTier, 3);
        let nuggetBonus = 0.02 * Math.min(luckyDropTier, 3);
        if (luckyDropTier > 3) {
            healthDropBonus += 0.02 * (luckyDropTier - 3);
            nuggetBonus += 0.01 * (luckyDropTier - 3);
        }
        GameContext.player.stats.luckyHealthDrop = healthDropBonus;
        GameContext.player.stats.luckyNuggetDrop = nuggetBonus;
    }

    const bountyHunterTier = GameContext.metaProfile.purchases.bountyHunter || 0;
    if (bountyHunterTier > 0) {
        let eliteBonus = 5 * Math.min(bountyHunterTier, 3);
        let bossBonus = 20 * Math.min(bountyHunterTier, 3);
        if (bountyHunterTier > 3) {
            eliteBonus += 3 * (bountyHunterTier - 3);
            bossBonus += 10 * (bountyHunterTier - 3);
        }
        GameContext.player.stats.bountyEliteBonus = eliteBonus;
        GameContext.player.stats.bountyBossBonus = bossBonus;
    }

    const comboMeterTier = GameContext.metaProfile.purchases.comboMeter || 0;
    if (comboMeterTier > 0) {
        let comboDamagePer10 = 0.01 * Math.min(comboMeterTier, 3);
        let maxComboDamage = 0.10 * Math.min(comboMeterTier, 3);
        if (comboMeterTier > 3) {
            comboDamagePer10 += 0.003 * (comboMeterTier - 3);
            maxComboDamage += 0.05 * (comboMeterTier - 3);
        }
        GameContext.player.stats.comboDamagePer10 = comboDamagePer10;
        GameContext.player.stats.maxComboDamage = maxComboDamage;
        GameContext.player.stats.comboStacks = 0;
        GameContext.player.stats.comboLastHitTime = 0;
    }

    const startingWeaponTier = GameContext.metaProfile.purchases.startingWeapon || 0;
    if (startingWeaponTier > 0) {
        GameContext.player.inventory['shotgun'] = Math.min(startingWeaponTier, 3);
        if (startingWeaponTier > 3) {
            let damageBonus = 0.05 * (startingWeaponTier - 3);
            GameContext.player.stats.startingShotgunDamageMult = 1.0 + damageBonus;
        }
    }

    const secondWindTier = GameContext.metaProfile.purchases.secondWind || 0;
    if (secondWindTier > 0) {
        const durations = [0.5, 1.0, 1.5];
        const cooldowns = [10, 8, 6];
        let duration = durations[Math.min(secondWindTier - 1, 2)];
        let cooldown = cooldowns[Math.min(secondWindTier - 1, 2)];
        if (secondWindTier > 3) {
            duration += 0.2 * (secondWindTier - 3);
            cooldown = Math.max(cooldown - 0.5 * (secondWindTier - 3), 3);
        }
        GameContext.player.stats.secondWindDuration = duration * 60;
        GameContext.player.stats.secondWindCooldown = cooldown * 60;
        GameContext.player.stats.secondWindTimer = 0;
        GameContext.player.stats.secondWindReady = true;
    }

    const batteryTier = GameContext.metaProfile.purchases.batteryCapacitor || 0;
    if (batteryTier > 0) {
        GameContext.player.batteryUnlocked = true;
        GameContext.player.batteryDamage = batteryTier * 100;
        if (batteryTier === 1) { GameContext.player.batteryRange = 800; }
        if (batteryTier === 2) { GameContext.player.batteryRange = 900; }
        if (batteryTier === 3) { GameContext.player.batteryRange = 1000; }
    }
}
