import { GameContext } from '../core/game-context.js';
import { PLAYER_SHIELD_RADIUS_SCALE, UPGRADE_DATA } from '../core/constants.js';
import { getDiminishingValue } from './meta-manager.js';

let playSoundFn = null;
let showOverlayMessageFn = null;
let updateHealthUIFn = null;
let updateTurboUIFn = null;
let updateNuggetUIFn = null;
let getActiveMenuElementsFn = null;
let updateMenuVisualsFn = null;
let startMusicFn = null;
let isMusicEnabledFn = null;
let saveMetaProfileFn = null;
let getGameNowMsFn = null;
let setSimAccMsFn = null;
let setSimLastPerfAtFn = null;
let setSuppressWarpGateUntilFn = null;
let setSuppressWarpInputUntilFn = null;
let spawnDroneFn = null;

/**
 * @param {Object} handlers
 * @returns {void}
 */
export function registerUpgradeHandlers(handlers) {
    playSoundFn = handlers.playSound || null;
    showOverlayMessageFn = handlers.showOverlayMessage || null;
    updateHealthUIFn = handlers.updateHealthUI || null;
    updateTurboUIFn = handlers.updateTurboUI || null;
    updateNuggetUIFn = handlers.updateNuggetUI || null;
    getActiveMenuElementsFn = handlers.getActiveMenuElements || null;
    updateMenuVisualsFn = handlers.updateMenuVisuals || null;
    startMusicFn = handlers.startMusic || null;
    isMusicEnabledFn = handlers.isMusicEnabled || null;
    saveMetaProfileFn = handlers.saveMetaProfile || null;
    getGameNowMsFn = handlers.getGameNowMs || null;
    setSimAccMsFn = handlers.setSimAccMs || null;
    setSimLastPerfAtFn = handlers.setSimLastPerfAt || null;
    setSuppressWarpGateUntilFn = handlers.setSuppressWarpGateUntil || null;
    setSuppressWarpInputUntilFn = handlers.setSuppressWarpInputUntil || null;
    spawnDroneFn = handlers.spawnDrone || null;
}

/**
 * @param {string} id
 * @param {number} tier
 * @returns {void}
 */
export function applyUpgrade(id, tier) {
    const prevTier = GameContext.player.inventory[id] || 0;
    GameContext.player.inventory[id] = tier;

    try {
        GameContext.dreadManager.upgradesChosen = (GameContext.dreadManager.upgradesChosen || 0) + 1;
        if (!GameContext.dreadManager.firstSpawnDone && GameContext.dreadManager.upgradesChosen >= 3 && !GameContext.bossActive && !GameContext.dreadManager.timerActive) {
            GameContext.dreadManager.timerAt = Date.now() + 10000;
            GameContext.dreadManager.timerActive = true;
        }
    } catch (e) { console.warn('dreadManager upgrade increment failed', e); }

    switch (id) {
        case 'turret_damage':
            {
                const table = { 0: 1.0, 1: 1.5, 2: 2.0, 3: 3.0 };
                const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
                const next = table[tier] || getDiminishingValue(tier, table, 0.99);
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                GameContext.player.stats.damageMult *= ratio;
            }
            break;
        case 'turret_fire_rate':
            {
                const table = { 0: 1.0, 1: 1.15, 2: 1.30, 3: 1.50 };
                const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
                const next = table[tier] || getDiminishingValue(tier, table, 0.99);
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                GameContext.player.stats.fireRateMult *= ratio;
            }
            break;
        case 'turret_range':
            {
                const table = { 0: 1.0, 1: 1.25, 2: 1.50, 3: 2.0 };
                const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
                const next = table[tier] || getDiminishingValue(tier, table, 0.99);
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                GameContext.player.stats.rangeMult *= ratio;
            }
            break;
        case 'multi_shot':
            GameContext.player.stats.multiShot = tier + 1;
            break;
        case 'static_weapons':
            {
                GameContext.player.staticWeapons = GameContext.player.staticWeapons.filter(w => w.source !== 'upgrade');
                const weaponTypes = ['forward', 'side', 'rear', 'dual_rear', 'dual_front'];
                for (let i = 0; i < tier && i < weaponTypes.length; i++) {
                    GameContext.player.staticWeapons.push({ type: weaponTypes[i], source: 'upgrade' });
                }
                if (tier > weaponTypes.length) {
                    for (let i = weaponTypes.length; i < tier; i++) {
                        const duplicateIndex = i - weaponTypes.length;
                        const effectiveness = Math.max(0.2, 1 - (duplicateIndex * 0.2));
                        GameContext.player.staticWeapons.push({
                            type: weaponTypes[i % weaponTypes.length],
                            source: 'upgrade',
                            effectiveness: effectiveness
                        });
                    }
                }
                GameContext.player.staticCannonCount = GameContext.player.staticWeapons.length;
            }
            break;
        case 'homing_missiles':
            GameContext.player.stats.homingFromUpgrade = tier;
            GameContext.player.stats.homing = Math.max(GameContext.player.stats.homingFromUpgrade, GameContext.player.stats.homingFromMeta);
            break;
        case 'segment_count':
            if (tier === 1) GameContext.player.shieldSegments.push(2, 2);
            if (tier === 2) GameContext.player.shieldSegments.push(2, 2, 2, 2);
            if (tier === 3) GameContext.player.shieldSegments.push(2, 2, 2, 2);
            if (tier === 4) GameContext.player.shieldSegments.push(2, 2, 2, 2, 2, 2, 2, 2);
            if (tier === 5) GameContext.player.shieldSegments.push(2, 2, 2, 2, 2, 2, 2, 2);
            GameContext.player.maxShieldSegments = GameContext.player.shieldSegments.length;
            break;
        case 'outer_shield':
            if (tier === 1) GameContext.player.maxOuterShieldSegments = 6;
            if (tier === 2) GameContext.player.maxOuterShieldSegments = 8;
            if (tier === 3) GameContext.player.maxOuterShieldSegments = 12;
            if (tier === 4) GameContext.player.maxOuterShieldSegments = 16;
            if (tier === 5) GameContext.player.maxOuterShieldSegments = 20;
            GameContext.player.outerShieldRadius = GameContext.player.shieldRadius + (26 * PLAYER_SHIELD_RADIUS_SCALE);
            GameContext.player.outerShieldSegments = new Array(GameContext.player.maxOuterShieldSegments).fill(1);
            break;
        case 'shield_regen':
            if (tier === 1) GameContext.player.stats.shieldRegenRate = 5;
            if (tier === 2) GameContext.player.stats.shieldRegenRate = 3;
            if (tier === 3) GameContext.player.stats.shieldRegenRate = 1;
            if (tier === 4) GameContext.player.stats.shieldRegenRate = 0.75;
            if (tier === 5) GameContext.player.stats.shieldRegenRate = 0.5;
            break;
        case 'hp_regen':
            GameContext.player.stats.hpRegenAmount = tier;
            GameContext.player.stats.hpRegenRate = 5;
            GameContext.player.lastHpRegenTime = Date.now();
            break;
        case 'hull_strength':
            GameContext.player.maxHp += 25;
            GameContext.player.hp = Math.min(GameContext.player.hp + 25, GameContext.player.maxHp);
            if (updateHealthUIFn) updateHealthUIFn();
            break;
        case 'speed':
            {
                const table = { 0: 1.0, 1: 1.15, 2: 1.30, 3: 1.50 };
                const prev = table[prevTier] || getDiminishingValue(prevTier, table, 0.99);
                const next = table[tier] || getDiminishingValue(tier, table, 0.99);
                const ratio = (prev > 0) ? (next / prev) : 1.0;
                GameContext.player.stats.speedMult *= ratio;
            }
            break;
        case 'turbo_boost': {
            GameContext.player.turboBoost.unlocked = true;
            if (tier === 1) GameContext.player.turboBoost.durationFrames = 120;
            if (tier === 2) GameContext.player.turboBoost.durationFrames = 210;
            if (tier === 3) GameContext.player.turboBoost.durationFrames = 300;
            if (tier === 4) GameContext.player.turboBoost.durationFrames = 390;
            if (tier === 5) GameContext.player.turboBoost.durationFrames = 480;
            GameContext.player.turboBoost.cooldownTotalFrames = 600;
            GameContext.player.turboBoost.speedMult = 1.5;
            GameContext.player.turboBoost.activeFrames = 0;
            GameContext.player.turboBoost.cooldownFrames = 0;
            if (updateTurboUIFn) updateTurboUIFn();
            break;
        }
        case 'xp_magnet':
            if (tier === 1) GameContext.player.magnetRadius = 300;
            if (tier === 2) GameContext.player.magnetRadius = 600;
            if (tier === 3) GameContext.player.magnetRadius = 1200;
            if (tier === 4) GameContext.player.magnetRadius = 1800;
            if (tier === 5) GameContext.player.magnetRadius = 2400;
            break;
        case 'area_nuke':
            GameContext.player.nukeUnlocked = true;
            GameContext.player.nukeMaxCooldown = 600;
            if (tier === 1) { GameContext.player.nukeDamage = 5; GameContext.player.nukeRange = 600; }
            if (tier === 2) { GameContext.player.nukeDamage = 10; GameContext.player.nukeRange = 700; }
            if (tier === 3) { GameContext.player.nukeDamage = 15; GameContext.player.nukeRange = 900; }
            if (tier === 4) { GameContext.player.nukeDamage = 20; GameContext.player.nukeRange = 1000; }
            if (tier === 5) { GameContext.player.nukeDamage = 25; GameContext.player.nukeRange = 1200; }
            break;
        case 'invincibility':
            GameContext.player.invincibilityCycle.unlocked = true;
            if (tier === 1) GameContext.player.invincibilityCycle.stats = { duration: 180, cooldown: 1200, regen: false };
            if (tier === 2) GameContext.player.invincibilityCycle.stats = { duration: 300, cooldown: 900, regen: false };
            if (tier === 3) GameContext.player.invincibilityCycle.stats = { duration: 420, cooldown: 600, regen: true };
            if (tier === 4) GameContext.player.invincibilityCycle.stats = { duration: 540, cooldown: 480, regen: true };
            if (tier === 5) GameContext.player.invincibilityCycle.stats = { duration: 720, cooldown: 360, regen: true };
            GameContext.player.invincibilityCycle.state = 'ready';
            GameContext.player.invincibilityCycle.timer = 0;
            break;
        case 'slow_field':
            if (tier === 1) { GameContext.player.stats.slowField = 250; GameContext.player.stats.slowFieldDuration = 180; }
            if (tier === 2) { GameContext.player.stats.slowField = 312; GameContext.player.stats.slowFieldDuration = 300; }
            if (tier === 3) { GameContext.player.stats.slowField = 390; GameContext.player.stats.slowFieldDuration = 480; }
            if (tier === 4) { GameContext.player.stats.slowField = 390; GameContext.player.stats.slowFieldDuration = 600; }
            if (tier === 5) { GameContext.player.stats.slowField = 487; GameContext.player.stats.slowFieldDuration = 720; }
            break;
        case 'companion_drones': {
            const ensureDrone = (t) => {
                if (!GameContext.drones.find(d => d.type === t) && spawnDroneFn) spawnDroneFn(t);
            };
            if (tier >= 1) ensureDrone('shooter');
            if (tier >= 2) ensureDrone('shield');
            if (tier >= 3) ensureDrone('heal');
            if (tier >= 4) ensureDrone('shooter');
            if (tier >= 5) ensureDrone('shield');
            break;
        }
        case 'volley_shot':
            GameContext.player.volleyShotUnlocked = true;
            if (tier === 1) { GameContext.player.volleyShotCount = 3; }
            if (tier === 2) { GameContext.player.volleyShotCount = 5; }
            if (tier === 3) { GameContext.player.volleyShotCount = 7; }
            if (tier === 4) { GameContext.player.volleyShotCount = 9; }
            if (tier === 5) { GameContext.player.volleyShotCount = 11; }
            break;
        case 'ciws':
            console.log('[CIWS] Applying CIWS upgrade, tier:', tier);
            GameContext.player.ciwsUnlocked = true;
            GameContext.player.ciwsDamage = tier;
            console.log('[CIWS] CIWS unlocked:', GameContext.player.ciwsUnlocked, 'damage:', GameContext.player.ciwsDamage);
            break;
        case 'chain_lightning':
            if (tier === 1) { GameContext.player.chainLightningCount = 1; GameContext.player.chainLightningRange = 200; }
            if (tier === 2) { GameContext.player.chainLightningCount = 2; GameContext.player.chainLightningRange = 250; }
            if (tier === 3) { GameContext.player.chainLightningCount = 3; GameContext.player.chainLightningRange = 300; }
            if (tier === 4) { GameContext.player.chainLightningCount = 4; GameContext.player.chainLightningRange = 350; }
            if (tier === 5) { GameContext.player.chainLightningCount = 5; GameContext.player.chainLightningRange = 400; }
            break;
        case 'shotgun':
            GameContext.player.stats.shotgunUnlocked = true;
            if (tier === 1) { GameContext.player.stats.shotgunPellets = 5; GameContext.player.stats.shotgunRangeMult = 1.0; }
            if (tier === 2) { GameContext.player.stats.shotgunPellets = 8; GameContext.player.stats.shotgunRangeMult = 1.2; }
            if (tier === 3) { GameContext.player.stats.shotgunPellets = 12; GameContext.player.stats.shotgunRangeMult = 1.2; }
            break;
        case 'backstabber':
            if (tier === 1) GameContext.player.stats.backstabberBonus = 1.5;
            if (tier === 2) GameContext.player.stats.backstabberBonus = 2.0;
            if (tier === 3) { GameContext.player.stats.backstabberBonus = 2.5; GameContext.player.stats.backstabberSlow = 120; }
            if (tier === 4) { GameContext.player.stats.backstabberBonus = 3.0; GameContext.player.stats.backstabberSlow = 180; }
            if (tier === 5) { GameContext.player.stats.backstabberBonus = 3.5; GameContext.player.stats.backstabberSlow = 240; }
            break;
        case 'reactive_shield':
            if (tier === 1) GameContext.player.stats.reactiveShield = 1;
            if (tier === 2) GameContext.player.stats.reactiveShield = 2;
            if (tier === 3) {
                GameContext.player.stats.reactiveShield = 3;
                GameContext.player.stats.reactiveShieldBonusHp = true;
                if (GameContext.player.shieldSegments) {
                    for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
                        if (GameContext.player.shieldSegments[i] === 2) GameContext.player.shieldSegments[i] = 3;
                    }
                    GameContext.player.shieldsDirty = true;
                }
            }
            if (tier === 4) {
                GameContext.player.stats.reactiveShield = 4;
                GameContext.player.stats.reactiveShieldBonusHp = true;
                if (GameContext.player.shieldSegments) {
                    for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
                        if (GameContext.player.shieldSegments[i] < 4) GameContext.player.shieldSegments[i] = 4;
                    }
                    GameContext.player.shieldsDirty = true;
                }
            }
            if (tier === 5) {
                GameContext.player.stats.reactiveShield = 5;
                GameContext.player.stats.reactiveShieldBonusHp = true;
                if (GameContext.player.shieldSegments) {
                    for (let i = 0; i < GameContext.player.shieldSegments.length; i++) {
                        if (GameContext.player.shieldSegments[i] < 5) GameContext.player.shieldSegments[i] = 5;
                    }
                    GameContext.player.shieldsDirty = true;
                }
            }
            break;
        case 'damage_mitigation':
            if (tier === 1) { GameContext.player.stats.damageMitigation = 0.9; GameContext.player.stats.speedBonusFromMit = 1.05; }
            if (tier === 2) { GameContext.player.stats.damageMitigation = 0.8; GameContext.player.stats.speedBonusFromMit = 1.10; }
            if (tier === 3) { GameContext.player.stats.damageMitigation = 0.7; GameContext.player.stats.speedBonusFromMit = 1.15; }
            if (tier === 4) { GameContext.player.stats.damageMitigation = 0.6; GameContext.player.stats.speedBonusFromMit = 1.20; }
            if (tier === 5) { GameContext.player.stats.damageMitigation = 0.5; GameContext.player.stats.speedBonusFromMit = 1.25; }
            break;
        case 'time_dilation':
            if (tier === 1) { GameContext.player.stats.timeDilation = 0.8; GameContext.player.stats.timeDilationRange = 200; }
            if (tier === 2) { GameContext.player.stats.timeDilation = 0.6; GameContext.player.stats.timeDilationRange = 300; }
            if (tier === 3) { GameContext.player.stats.timeDilation = 0.4; GameContext.player.stats.timeDilationRange = 450; }
            if (tier === 4) { GameContext.player.stats.timeDilation = 0.2; GameContext.player.stats.timeDilationRange = 600; }
            if (tier === 5) { GameContext.player.stats.timeDilation = 0.0; GameContext.player.stats.timeDilationRange = 750; }
            break;
        case 'momentum':
            if (tier === 1) { GameContext.player.stats.momentumFireRate = 1.10; GameContext.player.stats.momentumDamage = 1.0; }
            if (tier === 2) { GameContext.player.stats.momentumFireRate = 1.20; GameContext.player.stats.momentumDamage = 1.15; }
            if (tier === 3) { GameContext.player.stats.momentumFireRate = 1.30; GameContext.player.stats.momentumDamage = 1.25; }
            if (tier === 4) { GameContext.player.stats.momentumFireRate = 1.40; GameContext.player.stats.momentumDamage = 1.35; }
            if (tier === 5) { GameContext.player.stats.momentumFireRate = 1.50; GameContext.player.stats.momentumDamage = 1.50; }
            break;
    }

    if (showOverlayMessageFn) {
        showOverlayMessageFn(`${id.replace('_', ' ').toUpperCase()} UPGRADED!`, '#ff0', 1500);
    }
}

/**
 * @returns {void}
 */
export function showLevelUpMenu() {
    const container = document.getElementById('upgrade-container');
    container.innerHTML = '';
    const parent = container.parentElement;
    const existingReroll = document.getElementById('reroll-btn');
    if (existingReroll) existingReroll.remove();

    const validUpgrades = [];

    let tier2Count = 0;
    let tier4Count = 0;
    Object.values(GameContext.player.inventory).forEach(tier => {
        if (tier === 2) tier2Count++;
        if (tier === 3) tier2Count++;
        if (tier === 4) tier4Count++;
        if (tier === 5) tier4Count++;
    });

    UPGRADE_DATA.categories.forEach(cat => {
        cat.upgrades.forEach(up => {
            const currentTier = GameContext.player.inventory[up.id] || 0;
            const nextTier = currentTier + 1;

            if (nextTier >= 3 && tier2Count < 5) {
                return;
            }
            if (nextTier >= 5 && tier4Count < 5) {
                return;
            }

            validUpgrades.push({ ...up, category: cat.name });
        });
    });

    if (validUpgrades.length === 0) {
        if (showOverlayMessageFn) showOverlayMessageFn("NO UPGRADES AVAILABLE!", '#f00', 2000);

        if (GameContext.player && !GameContext.player.dead) {
            GameContext.player.hp = Math.min(GameContext.player.hp + 3, GameContext.player.maxHp);
            if (updateHealthUIFn) updateHealthUIFn();
            if (playSoundFn) playSoundFn('powerup');
        }

        requestAnimationFrame(() => {
            setTimeout(() => {
                const resetEnt = (e) => {
                    if (e && e.pos && e.prevPos) {
                        e.prevPos.x = e.pos.x;
                        e.prevPos.y = e.pos.y;
                    }
                };
                if (GameContext.player) resetEnt(GameContext.player);
                if (GameContext.boss) resetEnt(GameContext.boss);
                if (GameContext.spaceStation) resetEnt(GameContext.spaceStation);
                if (GameContext.enemies) GameContext.enemies.forEach(resetEnt);
                if (GameContext.pinwheels) GameContext.pinwheels.forEach(resetEnt);
                if (GameContext.bullets) GameContext.bullets.forEach(resetEnt);
                if (GameContext.particles) GameContext.particles.forEach(resetEnt);
                if (GameContext.floatingTexts) GameContext.floatingTexts.forEach(resetEnt);

                if (setSimAccMsFn) setSimAccMsFn(0);
                if (setSimLastPerfAtFn) setSimLastPerfAtFn(performance.now());

                const nowMs = getGameNowMsFn ? getGameNowMsFn() : Date.now();
                const suppressUntil = nowMs + 750;
                if (setSuppressWarpGateUntilFn) setSuppressWarpGateUntilFn(suppressUntil);
                if (setSuppressWarpInputUntilFn) setSuppressWarpInputUntilFn(suppressUntil);
                GameContext.gameActive = true;
                if (isMusicEnabledFn && isMusicEnabledFn()) {
                    if (startMusicFn) startMusicFn();
                }
            }, 100);
        });
        return;
    }

    const choices = [];
    const count = Math.min(3, validUpgrades.length);

    if (!GameContext.shownUpgradesThisRun) GameContext.shownUpgradesThisRun = new Set();

    const weightedUpgrades = [];
    for (const upgrade of validUpgrades) {
        const hasBeenShown = GameContext.shownUpgradesThisRun.has(upgrade.id);
        const weight = hasBeenShown ? 1 : 3;

        for (let w = 0; w < weight; w++) {
            weightedUpgrades.push(upgrade);
        }
    }

    const pickedIds = new Set();
    for (let i = 0; i < count; i++) {
        if (weightedUpgrades.length === 0) break;

        const idx = Math.floor(Math.random() * weightedUpgrades.length);
        const choice = weightedUpgrades[idx];

        if (!pickedIds.has(choice.id)) {
            choices.push(choice);
            pickedIds.add(choice.id);
            GameContext.shownUpgradesThisRun.add(choice.id);
        }

        for (let j = weightedUpgrades.length - 1; j >= 0; j--) {
            if (weightedUpgrades[j].id === choice.id) {
                weightedUpgrades.splice(j, 1);
            }
        }
    }

    const rerollBtn = document.createElement('button');
    rerollBtn.id = 'reroll-btn';
    rerollBtn.style.marginTop = '10px';
    rerollBtn.style.padding = '12px 24px';
    rerollBtn.style.fontSize = '16px';
    rerollBtn.style.backgroundColor = '#4a2';
    rerollBtn.style.color = '#fff';
    rerollBtn.style.cursor = 'pointer';

    const updateRerollButton = () => {
        if (GameContext.rerollTokens > 0) {
            rerollBtn.textContent = `REROLL OPTIONS (TOKENS: ${GameContext.rerollTokens})`;
            rerollBtn.style.backgroundColor = '#4a2';
            rerollBtn.disabled = false;
        } else {
            rerollBtn.textContent = `REROLL (5 NUGGETS)`;
            rerollBtn.style.backgroundColor = GameContext.spaceNuggets >= 5 ? '#2a4' : '#333';
            rerollBtn.disabled = GameContext.spaceNuggets < 5;
        }
    };

    updateRerollButton();

    rerollBtn.onclick = () => {
        if (GameContext.rerollTokens > 0) {
            GameContext.rerollTokens--;
            GameContext.metaProfile.purchases.rerollTokens = GameContext.rerollTokens;
            if (saveMetaProfileFn) saveMetaProfileFn();
            showLevelUpMenu();
        } else if (GameContext.spaceNuggets >= 5) {
            GameContext.spaceNuggets -= 5;
            if (updateNuggetUIFn) updateNuggetUIFn();
            showLevelUpMenu();
        }
    };

    parent.insertBefore(rerollBtn, container);

    choices.forEach((choice) => {
        const currentTier = GameContext.player.inventory[choice.id] || 0;
        const nextTier = currentTier + 1;
        let desc = choice[`tier${nextTier}`];
        if (!desc) {
            for (let t = nextTier - 1; t >= 1; t--) {
                if (choice[`tier${t}`]) {
                    desc = choice[`tier${t}`];
                    break;
                }
            }
            if (!desc) desc = "Further upgrade";
        }

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
                    <div class="upgrade-title">${choice.name}</div>
                    <div style="color:#aaa; font-size:12px; margin-bottom:10px">${choice.category}</div>
                    <div class="upgrade-desc">${desc}</div>
                    <div style="font-size:12px; color:#888; margin-top:10px">${choice.notes}</div>
                `;

        card.onmouseenter = () => {
            const active = getActiveMenuElementsFn ? getActiveMenuElementsFn() : [];
            const cardIndex = active.indexOf(card);
            if (cardIndex >= 0) {
                GameContext.menuSelectionIndex = cardIndex;
                if (updateMenuVisualsFn) updateMenuVisualsFn(active);
            }
        };

        card.onmouseleave = () => {
            const active = getActiveMenuElementsFn ? getActiveMenuElementsFn() : [];
            const reroll = document.getElementById('reroll-btn');
            GameContext.menuSelectionIndex = active.indexOf(reroll);
            if (updateMenuVisualsFn) updateMenuVisualsFn(active);
        };

        card.onclick = () => {
            applyUpgrade(choice.id, nextTier);
            document.getElementById('levelup-screen').style.display = 'none';

            requestAnimationFrame(() => {
                if (typeof window !== 'undefined' && window.gc && typeof window.gc === 'function') {
                    try { window.gc(); } catch (e) { }
                }

                setTimeout(() => {
                    const resetEnt = (e) => {
                        if (e && e.pos && e.prevPos) {
                            e.prevPos.x = e.pos.x;
                            e.prevPos.y = e.pos.y;
                        }
                    };
                    if (GameContext.player) resetEnt(GameContext.player);
                    if (GameContext.boss) resetEnt(GameContext.boss);
                    if (GameContext.spaceStation) resetEnt(GameContext.spaceStation);
                    if (GameContext.enemies) GameContext.enemies.forEach(resetEnt);
                    if (GameContext.pinwheels) GameContext.pinwheels.forEach(resetEnt);
                    if (GameContext.bullets) GameContext.bullets.forEach(resetEnt);
                    if (GameContext.particles) GameContext.particles.forEach(resetEnt);
                    if (GameContext.floatingTexts) GameContext.floatingTexts.forEach(resetEnt);

                    if (setSimAccMsFn) setSimAccMsFn(0);
                    if (setSimLastPerfAtFn) setSimLastPerfAtFn(performance.now());

                    const nowMs = getGameNowMsFn ? getGameNowMsFn() : Date.now();
                    const suppressUntil = nowMs + 750;
                    if (setSuppressWarpGateUntilFn) setSuppressWarpGateUntilFn(suppressUntil);
                    if (setSuppressWarpInputUntilFn) setSuppressWarpInputUntilFn(suppressUntil);
                    GameContext.gameActive = true;
                    if (isMusicEnabledFn && isMusicEnabledFn()) {
                        if (startMusicFn) startMusicFn();
                    }
                }, 100);
            });
        };
        container.appendChild(card);
    });

    document.getElementById('levelup-screen').style.display = 'flex';

    try {
        if (GameContext.player && !GameContext.player.dead) {
            GameContext.player.hp = Math.min(GameContext.player.hp + 3, GameContext.player.maxHp);
            if (updateHealthUIFn) updateHealthUIFn();
            if (playSoundFn) playSoundFn('powerup');
        }
    } catch (e) { console.warn('heal on levelup failed', e); }

    GameContext.menuSelectionIndex = 0;
    const cards = getActiveMenuElementsFn ? getActiveMenuElementsFn() : [];
    if (cards.length > 0 && updateMenuVisualsFn) updateMenuVisualsFn(cards);
}
