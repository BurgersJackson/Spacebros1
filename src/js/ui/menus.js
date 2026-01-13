import { UPGRADE_DATA } from '../core/constants.js';

let GameContextRef = null;
let initAudioRef = null;
let startGameRef = null;
let getGameNowMsRef = null;
let shiftPausedTimersRef = null;
let startMusicRef = null;
let showOverlayMessageRef = null;
let showSaveMenuRef = null;
let updateMetaUIRef = null;
let getActiveMenuElementsRef = null;
let updateMenuVisualsRef = null;
let setMenuDebounceRef = null;
let applyUpgradeRef = null;
let wipeProfilesRef = null;
let togglePauseRef = null;
let showAbortConfirmDialogRef = null;
let quitGameRef = null;
let toggleMusicRef = null;
let getMusicEnabledRef = null;
let getSelectedShipTypeRef = null;
let setSelectedShipTypeRef = null;
let shipSelectionKeyRef = null;
let getDebugMenuVisibleRef = null;
let setDebugMenuVisibleRef = null;

/**
 * @param {object} deps
 */
export function registerMenuDependencies(deps) {
    if (deps.GameContext) GameContextRef = deps.GameContext;
    if (deps.initAudio) initAudioRef = deps.initAudio;
    if (deps.startGame) startGameRef = deps.startGame;
    if (deps.getGameNowMs) getGameNowMsRef = deps.getGameNowMs;
    if (deps.shiftPausedTimers) shiftPausedTimersRef = deps.shiftPausedTimers;
    if (deps.startMusic) startMusicRef = deps.startMusic;
    if (deps.showOverlayMessage) showOverlayMessageRef = deps.showOverlayMessage;
    if (deps.showSaveMenu) showSaveMenuRef = deps.showSaveMenu;
    if (deps.updateMetaUI) updateMetaUIRef = deps.updateMetaUI;
    if (deps.getActiveMenuElements) getActiveMenuElementsRef = deps.getActiveMenuElements;
    if (deps.updateMenuVisuals) updateMenuVisualsRef = deps.updateMenuVisuals;
    if (deps.setMenuDebounce) setMenuDebounceRef = deps.setMenuDebounce;
    if (deps.applyUpgrade) applyUpgradeRef = deps.applyUpgrade;
    if (deps.wipeProfiles) wipeProfilesRef = deps.wipeProfiles;
    if (deps.togglePause) togglePauseRef = deps.togglePause;
    if (deps.showAbortConfirmDialog) showAbortConfirmDialogRef = deps.showAbortConfirmDialog;
    if (deps.quitGame) quitGameRef = deps.quitGame;
    if (deps.toggleMusic) toggleMusicRef = deps.toggleMusic;
    if (deps.getMusicEnabled) getMusicEnabledRef = deps.getMusicEnabled;
    if (deps.getSelectedShipType) getSelectedShipTypeRef = deps.getSelectedShipType;
    if (deps.setSelectedShipType) setSelectedShipTypeRef = deps.setSelectedShipType;
    if (deps.shipSelectionKey) shipSelectionKeyRef = deps.shipSelectionKey;
    if (deps.getDebugMenuVisible) getDebugMenuVisibleRef = deps.getDebugMenuVisible;
    if (deps.setDebugMenuVisible) setDebugMenuVisibleRef = deps.setDebugMenuVisible;
}

export function showUpgradesMenu() {
    const levelupScreen = document.getElementById('levelup-screen');
    if (levelupScreen) levelupScreen.style.display = 'none';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.style.display = 'none';
        startScreen.style.visibility = 'hidden';
    }
    const upgradesMenu = document.getElementById('upgrades-menu');
    if (upgradesMenu) {
        upgradesMenu.style.display = 'block';
        upgradesMenu.style.visibility = 'visible';
    }

    const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
    allMenuElements.forEach(el => {
        el.classList.remove('selected');
        if (el.tagName === 'BUTTON') el.blur();
    });

    if (updateMetaUIRef) updateMetaUIRef();

    if (GameContextRef) GameContextRef.menuSelectionIndex = 0;
    if (setMenuDebounceRef) setMenuDebounceRef(Date.now() + 300);

    requestAnimationFrame(() => {
        const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
        if (active.length > 0) {
            if (updateMenuVisualsRef) updateMenuVisualsRef(active);
            active[0].focus();
        }
    });
}

export function showRunUpgrades() {
    if (!GameContextRef || !GameContextRef.player || !GameContextRef.player.inventory) {
        console.warn('[RUN UPGRADES] Player not initialized');
        return;
    }

    const container = document.getElementById('run-upgrades-container');
    if (!container) return;

    container.innerHTML = '';

    const collectedUpgrades = Object.entries(GameContextRef.player.inventory).filter(([id, tier]) => tier > 0);

    if (collectedUpgrades.length === 0) {
        container.innerHTML = '<div class="run-upgrades-empty">No upgrades collected yet</div>';
    } else {
        UPGRADE_DATA.categories.forEach(category => {
            const categoryUpgrades = category.upgrades.filter(u => GameContextRef.player.inventory[u.id] > 0);
            if (categoryUpgrades.length === 0) return;

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'run-upgrade-category';

            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'run-upgrade-category-title';
            categoryTitle.textContent = category.name;
            categoryDiv.appendChild(categoryTitle);

            categoryUpgrades.forEach(upgrade => {
                const tier = GameContextRef.player.inventory[upgrade.id];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'run-upgrade-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'run-upgrade-name';
                nameSpan.textContent = upgrade.name;

                const tierSpan = document.createElement('span');
                tierSpan.className = 'run-upgrade-tier';
                tierSpan.textContent = `TIER ${tier}`;

                itemDiv.appendChild(nameSpan);
                itemDiv.appendChild(tierSpan);
                categoryDiv.appendChild(itemDiv);
            });

            container.appendChild(categoryDiv);
        });
    }

    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('run-upgrades-screen').style.display = 'block';

    setTimeout(() => {
        document.getElementById('run-upgrades-back-btn').focus();
    }, 100);
}

export function hideRunUpgrades() {
    document.getElementById('run-upgrades-screen').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'block';

    setTimeout(() => {
        document.getElementById('pause-upgrades-btn').focus();
    }, 100);
}

export function showDebugMenu() {
    if (!GameContextRef || !GameContextRef.player || !GameContextRef.player.inventory) {
        console.warn('[DEBUG] Player not initialized');
        return;
    }

    const container = document.getElementById('debug-upgrades-container');
    if (!container) return;

    container.innerHTML = '';

    import('../core/constants.js').then(({ UPGRADE_DATA: upgradeData }) => {
        upgradeData.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'debug-category';

            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'debug-category-title';
            categoryTitle.textContent = category.name;
            categoryDiv.appendChild(categoryTitle);

            category.upgrades.forEach(upgrade => {
                const currentTier = GameContextRef.player.inventory[upgrade.id] || 0;
                const maxTier = upgrade.tier5 ? 5 : (upgrade.tier4 ? 4 : 3);

                const itemDiv = document.createElement('div');
                itemDiv.className = 'debug-upgrade-item';

                const infoDiv = document.createElement('div');
                infoDiv.className = 'debug-upgrade-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'debug-upgrade-name';
                nameDiv.textContent = `${upgrade.name} (Tier ${currentTier})`;
                infoDiv.appendChild(nameDiv);

                if (upgrade.notes) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'debug-upgrade-notes';
                    notesDiv.textContent = upgrade.notes;
                    infoDiv.appendChild(notesDiv);
                }

                itemDiv.appendChild(infoDiv);

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'debug-tier-buttons';

                for (let tier = 1; tier <= maxTier; tier++) {
                    const btn = document.createElement('button');
                    btn.className = 'debug-tier-btn';
                    btn.textContent = `T${tier}`;
                    btn.dataset.upgrade = upgrade.id;
                    btn.dataset.tier = tier;
                    btn.dataset.name = upgrade.name;

                    if (tier === currentTier) {
                        btn.classList.add('current-tier');
                    }

                    buttonsDiv.appendChild(btn);
                }

                itemDiv.appendChild(buttonsDiv);
                categoryDiv.appendChild(itemDiv);
            });

            container.appendChild(categoryDiv);
        });

        container.querySelectorAll('.debug-tier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const upgradeId = btn.dataset.upgrade;
                const tier = parseInt(btn.dataset.tier);
                const upgradeName = btn.dataset.name;
                grantDebugUpgrade(upgradeId, tier, upgradeName);
            });
        });

        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('debug-menu').style.display = 'block';

        setTimeout(() => {
            document.getElementById('debug-back-btn').focus();
        }, 100);
    }).catch(err => console.error('[DEBUG] Failed to load UPGRADE_DATA:', err));
}

export function hideDebugMenu() {
    document.getElementById('debug-menu').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'block';

    setTimeout(() => {
        document.getElementById('debug-btn').focus();
    }, 100);
}

function grantDebugUpgrade(upgradeId, tier, upgradeName) {
    if (!GameContextRef || !GameContextRef.player) {
        console.warn('[DEBUG] No player to grant upgrade to');
        return;
    }

    const prevTier = GameContextRef.player.inventory[upgradeId] || 0;

    if (applyUpgradeRef) applyUpgradeRef(upgradeId, tier);

    const action = tier > prevTier ? `UPGRADED to Tier ${tier}` :
        tier < prevTier ? `DOWNGRADED to Tier ${tier}` :
            `RESET to Tier ${tier}`;
    if (showOverlayMessageRef) showOverlayMessageRef(`[DEBUG] ${upgradeName}: ${action}`, '#ff0', 1500, 10);

    console.log(`[DEBUG] Granted upgrade: ${upgradeId} Tier ${tier} (was Tier ${prevTier})`);

    showDebugMenu();
}

/**
 * @returns {void}
 */
export function initMenuUi() {
    const updateShipSelectionUI = () => {
        const standardBtn = document.getElementById('ship-standard-btn');
        const slackerBtn = document.getElementById('ship-slacker-btn');
        const descEl = document.getElementById('ship-description');
        if (!standardBtn || !slackerBtn || !descEl) return;

        const selectedShipType = getSelectedShipTypeRef ? getSelectedShipTypeRef() : 'standard';
        if (selectedShipType === 'slacker') {
            standardBtn.classList.remove('selected');
            slackerBtn.classList.add('selected');
            descEl.textContent = 'Mouse-driven • Click & hold LEFT BUTTON to brake • RIGHT BUTTON activates turbo boost\nShip follows your cursor • Keyboard works too • Perfect for tactical positioning';
        } else {
            standardBtn.classList.add('selected');
            slackerBtn.classList.remove('selected');
            descEl.textContent = 'Manual turret control • Mouse/Gamepad aiming\nClassic combat experience';
        }
        if (shipSelectionKeyRef && selectedShipType) {
            localStorage.setItem(shipSelectionKeyRef, selectedShipType);
        }
    };

    updateShipSelectionUI();

    const shipStandardBtn = document.getElementById('ship-standard-btn');
    if (shipStandardBtn) {
        shipStandardBtn.addEventListener('click', () => {
            if (setSelectedShipTypeRef) setSelectedShipTypeRef('standard');
            updateShipSelectionUI();
        });
    }

    const shipSlackerBtn = document.getElementById('ship-slacker-btn');
    if (shipSlackerBtn) {
        shipSlackerBtn.addEventListener('click', () => {
            if (setSelectedShipTypeRef) setSelectedShipTypeRef('slacker');
            updateShipSelectionUI();
        });
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (initAudioRef) initAudioRef();
            if (startGameRef) startGameRef();
        });
    }

    const resumeStartBtn = document.getElementById('resume-btn-start');
    if (resumeStartBtn) {
        resumeStartBtn.addEventListener('click', () => {
            if (initAudioRef) initAudioRef();
            document.getElementById('start-screen').style.display = 'none';

            if (GameContextRef && GameContextRef.gamePaused && GameContextRef.pauseStartTime && getGameNowMsRef && shiftPausedTimersRef) {
                const pauseMs = Math.max(0, getGameNowMsRef() - GameContextRef.pauseStartTime);
                if (pauseMs > 0) {
                    GameContextRef.pausedAccumMs += pauseMs;
                    shiftPausedTimersRef(pauseMs);
                }
                GameContextRef.pauseStartTime = null;
            }
            if (GameContextRef) GameContextRef.gamePaused = false;

            if (getMusicEnabledRef && getMusicEnabledRef()) {
                if (startMusicRef) startMusicRef();
            }
            if (showOverlayMessageRef) showOverlayMessageRef('RESUMED', '#0f0', 1500);

            if (GameContextRef) GameContextRef.canResumeGame = false;

            if (window.updateResumeButtonState) {
                window.updateResumeButtonState();
            }
        });

        if (window.updateResumeButtonState) {
            window.updateResumeButtonState();
        }
    }

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            if (initAudioRef) initAudioRef();
            if (showSaveMenuRef) showSaveMenuRef();
        });
    }

    const upgradesBtn = document.getElementById('upgrades-btn');
    const upgradesBackBtn = document.getElementById('upgrades-back-btn');
    if (upgradesBtn) {
        upgradesBtn.addEventListener('click', () => {
            if (initAudioRef) initAudioRef();
            showUpgradesMenu();
        });
    }
    if (upgradesBackBtn) {
        upgradesBackBtn.addEventListener('click', () => {
            const upgradesMenu = document.getElementById('upgrades-menu');
            if (upgradesMenu) {
                upgradesMenu.style.display = 'none';
                upgradesMenu.style.visibility = 'hidden';
            }

            const startScreen = document.getElementById('start-screen');
            if (startScreen) {
                startScreen.style.display = 'block';
                startScreen.style.visibility = 'visible';
            }

            const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
            allMenuElements.forEach(el => {
                el.classList.remove('selected');
                if (el.tagName === 'BUTTON') el.blur();
            });

            requestAnimationFrame(() => {
                if (GameContextRef) GameContextRef.menuSelectionIndex = 0;
                const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
                if (active.length > 0) {
                    if (updateMenuVisualsRef) updateMenuVisualsRef(active);
                    active[0].focus();
                }
                if (setMenuDebounceRef) setMenuDebounceRef(Date.now() + 300);
            });
        });
    }

    const newProfileBtn = document.getElementById('new-profile-btn');
    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', () => {
            if (confirm('Reset profile? This clears all nugs/stats and saved profiles.')) {
                if (wipeProfilesRef) wipeProfilesRef();
            }
        });
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (initAudioRef) initAudioRef();
            if (startGameRef) startGameRef();
        });
    }

    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => { if (togglePauseRef) togglePauseRef(); });

    const pauseRestartBtn = document.getElementById('restart-btn-pause');
    if (pauseRestartBtn) pauseRestartBtn.addEventListener('click', () => { if (startGameRef) startGameRef(); });

    const quitBtn = document.getElementById('quit-btn');
    if (quitBtn) {
        quitBtn.addEventListener('click', async () => {
            const confirmed = showAbortConfirmDialogRef ? await showAbortConfirmDialogRef() : false;
            if (confirmed) {
                if (quitGameRef) quitGameRef();
            }
        });
    }

    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) musicBtn.addEventListener('click', () => { if (toggleMusicRef) toggleMusicRef(); });

    const pauseMenuButtons = [
        'resume-btn',
        'pause-upgrades-btn',
        'pause-settings-btn',
        'restart-btn-pause',
        'music-btn',
        'quit-btn',
        'debug-btn',
        'desktop-quit-pause-btn'
    ];

    pauseMenuButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('mouseenter', () => {
                const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
                const index = active.indexOf(btn);
                if (index >= 0 && GameContextRef) {
                    GameContextRef.menuSelectionIndex = index;
                    if (updateMenuVisualsRef) updateMenuVisualsRef(active);
                }
            });

            btn.addEventListener('mouseleave', () => {
                const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
                if (GameContextRef) {
                    GameContextRef.menuSelectionIndex = 0;
                    if (updateMenuVisualsRef) updateMenuVisualsRef(active);
                }
            });
        }
    });

    const pauseUpgradesBtn = document.getElementById('pause-upgrades-btn');
    if (pauseUpgradesBtn) {
        pauseUpgradesBtn.addEventListener('click', showRunUpgrades);
    }

    const runUpgradesBackBtn = document.getElementById('run-upgrades-back-btn');
    if (runUpgradesBackBtn) {
        runUpgradesBackBtn.addEventListener('click', hideRunUpgrades);
    }

    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        debugBtn.addEventListener('click', showDebugMenu);
    }

    const debugBackBtn = document.getElementById('debug-back-btn');
    if (debugBackBtn) {
        debugBackBtn.addEventListener('click', hideDebugMenu);
    }

    const levelupScreen = document.getElementById('levelup-screen');
    if (levelupScreen) levelupScreen.style.display = 'none';
    const upgradesMenu = document.getElementById('upgrades-menu');
    if (upgradesMenu) upgradesMenu.style.display = 'none';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'block';

    const allMenuElements = document.querySelectorAll('button, .upgrade-card, .meta-item');
    allMenuElements.forEach(el => {
        el.classList.remove('selected');
        if (el.tagName === 'BUTTON') el.blur();
    });

    requestAnimationFrame(() => {
        if (GameContextRef) GameContextRef.menuSelectionIndex = 0;
        const initialActiveElements = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
        if (initialActiveElements.length > 0) {
            if (updateMenuVisualsRef) updateMenuVisualsRef(initialActiveElements);
            initialActiveElements[0].focus();
        }
    });
}

/**
 * @returns {void}
 */
export function toggleDebugButton() {
    const debugBtn = document.getElementById('debug-btn');
    if (!debugBtn) return;

    const current = getDebugMenuVisibleRef ? getDebugMenuVisibleRef() : false;
    const nextValue = !current;
    if (setDebugMenuVisibleRef) setDebugMenuVisibleRef(nextValue);
    debugBtn.style.display = nextValue ? 'block' : 'none';

    console.log(`[DEBUG] Debug menu button ${nextValue ? 'ENABLED' : 'DISABLED'}`);
}