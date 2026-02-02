/**
 * Death Screen UI - Shows detailed statistics when player dies
 */

import { GameContext } from '../core/game-context.js';
import { UPGRADE_DATA } from '../core/constants.js';
import { getElapsedGameTime } from '../core/game-context.js';

let _startGame = null;
let _formatTime = null;

/**
 * Register dependencies for death screen
 * @param {Object} deps
 */
export function registerDeathScreenDependencies(deps) {
    if (deps.startGame) _startGame = deps.startGame;
    if (deps.formatTime) _formatTime = deps.formatTime;
}

/**
 * Format time helper (fallback if formatTime not provided)
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Format number with commas
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
    return Math.floor(num).toLocaleString('en-US');
}

/**
 * Get weapon type display name
 * @param {string} weaponType
 * @returns {string}
 */
function getWeaponTypeName(weaponType) {
    const names = {
        'turret': 'Turret',
        'shotgun': 'Shotgun',
        'static_forward': 'Static Forward',
        'static_side': 'Static Side',
        'static_rear': 'Static Rear',
        'homing_missile': 'Homing Missiles',
        'volley_shot': 'Volley Shot',
        'ciws': 'CIWS',
        'chain_lightning': 'Chain Lightning',
        'area_nuke': 'Area Nuke',
        'drone': 'Drone',
        'split_shot': 'Split Shot',
        'explosive_rounds': 'Explosive Rounds'
    };
    return names[weaponType] || weaponType;
}

/**
 * Show the death screen with statistics
 * @param {number} survivalTimeMs - Pre-calculated survival time in milliseconds (optional, will calculate if not provided)
 * @param {Object} [options] - Optional: { title, titleColor } for win screen (e.g. "LEVEL 1 COMPLETE!", "#0f0")
 */
export function showDeathScreen(survivalTimeMs = null, options = {}) {
    const deathScreen = document.getElementById('death-screen');
    const container = document.getElementById('death-stats-container');
    
    if (!deathScreen || !container) {
        console.warn('[DEATH SCREEN] Missing HTML elements');
        return;
    }

    const h1 = deathScreen.querySelector('h1');
    if (h1) {
        if (options.title !== undefined) {
            h1.innerText = options.title;
            h1.style.color = options.titleColor !== undefined ? options.titleColor : h1.style.color;
        } else {
            h1.innerText = 'MISSION FAILED';
            h1.style.color = '#f00';
        }
    }
    const endScreen = document.getElementById('end-screen');
    if (endScreen) endScreen.style.display = 'none';

    // Calculate statistics - use provided time or try to get it (may be 0 if gameActive is false)
    if (survivalTimeMs === null || survivalTimeMs === undefined) {
        survivalTimeMs = getElapsedGameTime();
    }
    const survivalTimeSeconds = survivalTimeMs / 1000;
    const totalDamage = GameContext.totalDamageDealt || 0;
    const dps = survivalTimeSeconds > 0 ? totalDamage / survivalTimeSeconds : 0;
    
    // Get upgrades
    const upgrades = [];
    if (GameContext.player && GameContext.player.inventory) {
        UPGRADE_DATA.categories.forEach(category => {
            category.upgrades.forEach(upgrade => {
                const tier = GameContext.player.inventory[upgrade.id] || 0;
                if (tier > 0) {
                    upgrades.push({
                        name: upgrade.name,
                        tier: tier
                    });
                }
            });
        });
    }
    
    // Get damage by weapon type
    const weaponDamage = [];
    if (GameContext.damageByWeaponType) {
        Object.entries(GameContext.damageByWeaponType)
            .sort((a, b) => b[1] - a[1]) // Sort by damage descending
            .forEach(([weaponType, damage]) => {
                if (damage > 0) {
                    weaponDamage.push({
                        type: weaponType,
                        name: getWeaponTypeName(weaponType),
                        damage: damage
                    });
                }
            });
    }
    
    // Build HTML
    let html = '<div class="death-stats-section">';
    html += '<h2>STATISTICS</h2>';
    html += `<div class="death-stat-item"><span class="stat-label">Survival Time:</span> <span class="stat-value">${_formatTime ? _formatTime(survivalTimeMs) : formatTime(survivalTimeMs)}</span></div>`;
    html += `<div class="death-stat-item"><span class="stat-label">Total Damage:</span> <span class="stat-value">${formatNumber(totalDamage)}</span></div>`;
    html += `<div class="death-stat-item"><span class="stat-label">DPS:</span> <span class="stat-value">${formatNumber(dps)}</span></div>`;
    html += `<div class="death-stat-item"><span class="stat-label">Enemies Killed:</span> <span class="stat-value">${formatNumber(GameContext.enemyKills || 0)}</span></div>`;
    html += `<div class="death-stat-item"><span class="stat-label">Bosses Killed:</span> <span class="stat-value">${formatNumber(GameContext.bossKills || 0)}</span></div>`;
    html += '</div>';
    
    // Weapon damage breakdown
    if (weaponDamage.length > 0) {
        html += '<div class="death-stats-section">';
        html += '<h2>DAMAGE BY WEAPON</h2>';
        weaponDamage.forEach(w => {
            html += `<div class="death-stat-item"><span class="stat-label">${w.name}:</span> <span class="stat-value">${formatNumber(w.damage)}</span></div>`;
        });
        html += '</div>';
    }
    
    // Upgrades
    if (upgrades.length > 0) {
        html += '<div class="death-stats-section">';
        html += '<h2>UPGRADES</h2>';
        upgrades.forEach(upgrade => {
            html += `<div class="death-stat-item"><span class="stat-label">${upgrade.name}:</span> <span class="stat-value">Tier ${upgrade.tier}</span></div>`;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    // Show the screen
    deathScreen.style.display = 'block';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';

    // Reset gamepad menu state so next frame treats this as a new menu and focuses the button
    GameContext.menuSelectionIndex = 0;
    if (GameContext.gpState) {
        GameContext.gpState.lastMenuElements = null;
    }

    // Focus the restart button (keyboard/mouse and gamepad)
    setTimeout(() => {
        const btn = document.getElementById('death-restart-btn');
        if (btn) {
            btn.focus();
        }
    }, 100);
}

/**
 * Hide the death screen
 */
export function hideDeathScreen() {
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
}
