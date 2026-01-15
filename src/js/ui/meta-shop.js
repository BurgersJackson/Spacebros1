import { GameContext } from '../core/game-context.js';
import { META_SHOP_UPGRADE_DATA } from '../core/constants.js';
import { showOverlayMessage } from '../utils/ui-helpers.js';
import { getMetaUpgradeCost, saveMetaProfile, setReturningFromModal } from '../systems/meta-manager.js';
import { getActiveMenuElements, updateMenuVisuals } from '../systems/input-manager.js';

let currentModalUpgradeId = null;
let modalSourceButtonIndex = null;

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
    const autoRerollEl = document.getElementById('meta-autoreroll');
    if (autoRerollEl) {
        const tier = GameContext.metaProfile.purchases.autoReroll || 0;
        const cost = getMetaUpgradeCost('autoReroll', 50);
        autoRerollEl.innerText = tier > 0 ? `TIER ${tier} (NEXT: ${cost})` : `BUY (${cost} NUGS)`;
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
        'buy-autoreroll': 'autoReroll',
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
        'staticBlueprint': 40, 'missilePrimer': 40,
        'nukeCapacitor': 35, 'speedTuning': 25, 'bankMultiplier': 50,
        'shopDiscount': 50, 'extraLife': 60, 'droneFabricator': 40,
        'piercingRounds': 45, 'explosiveRounds': 55, 'criticalStrike': 50,
        'splitShot': 60, 'thornArmor': 35, 'lifesteal': 40,
        'evasionBoost': 45, 'shieldRecharge': 30, 'dashCooldown': 35,
        'dashDuration': 30, 'autoReroll': 50,
        'contractSpeed': 40, 'startingRerolls': 30,
        'luckyDrop': 55, 'bountyHunter': 45, 'comboMeter': 50,
        'startingWeapon': 60, 'secondWind': 70, 'batteryCapacitor': 45
    };
    const baseCost = baseCostMap[upgradeId] || 50;
    const cost = getMetaUpgradeCost(upgradeId, baseCost);
    const canAfford = GameContext.metaProfile.bank >= cost;

    titleEl.textContent = data.name.toUpperCase();

    let html = `<div style="margin-bottom: 12px;">${data.description}</div>`;

    if (currentTier >= 10) {
        html += `<div style="color: #888; margin-top: 10px;"><strong>Maximum Tier Reached</strong></div>`;
    } else if (currentTier === 0) {
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

    const isMaxTier = currentTier >= 10;

    if (isMaxTier) {
        costEl.textContent = "MAX TIER REACHED";
        costEl.style.color = '#888';
    } else {
        costEl.textContent = `Cost: ${cost} Meta Nuggets`;
        costEl.style.color = canAfford ? '#0f0' : '#f00';
    }

    tierEl.textContent = `OWNED: TIER ${currentTier}`;

    buyBtn.disabled = !canAfford || isMaxTier;
    buyBtn.textContent = isMaxTier ? "MAX TIER" : (canAfford ? `BUY (${cost} NUGS)` : `NEED ${cost} NUGS`);

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
    const gpState = GameContext.gpState;
    if (gpState) gpState.lastMenuElements = null;

    requestAnimationFrame(() => {
        const activeElements = getActiveMenuElements();
        if (activeElements.length > 0) {
            updateMenuVisuals(activeElements);
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
            setReturningFromModal(true);
        }

        if (gpState) gpState.lastMenuElements = null;
    };

    newBackBtn.addEventListener('click', closeModal);

    newBuyBtn.addEventListener('click', () => {
        if (currentTier >= 10) {
            showOverlayMessage("MAX TIER REACHED", '#888', 1500);
            return;
        }

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
                setReturningFromModal(true);
            }
            if (gpState) gpState.lastMenuElements = null;
            window.removeEventListener('keydown', onEscape);
        }
    };
    window.addEventListener('keydown', onEscape);
}
