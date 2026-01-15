let GameContextRef = null;
let gpStateRef = null;
let setMenuDebounceRef = null;
let getActiveMenuElementsRef = null;
let updateMenuVisualsRef = null;
let showOverlayMessageRef = null;
let updateMetaUIRef = null;
let selectProfileRecordRef = null;
let listSaveSlotsRef = null;
let getProfileListRef = null;
let createNewProfileRecordRef = null;
let deleteProfileRecordRef = null;
let loadMetaProfileRef = null;
let saveGameRef = null;
let resetMetaProfileRef = null;
let saveMetaProfileRef = null;
let setMusicVolumeRef = null;
let setSfxVolumeRef = null;
let getMusicVolumeRef = null;
let getSfxVolumeRef = null;
let setupCanvasResolutionRef = null;
let initStarsRef = null;
let getViewportSizeRef = null;
let SAVE_PREFIX_REF = '';
let SAVE_LAST_KEY_REF = '';

let isCrtFilterEnabledRef = null;
let toggleCrtFilterRef = null;

let selectedProfileName = null;

/**
 * @param {object} deps
 * @returns {void}
 */
export function registerSettingsManagerDependencies(deps) {
    GameContextRef = deps.GameContext;
    gpStateRef = deps.gpState;
    setMenuDebounceRef = deps.setMenuDebounce;
    getActiveMenuElementsRef = deps.getActiveMenuElements;
    updateMenuVisualsRef = deps.updateMenuVisuals;
    showOverlayMessageRef = deps.showOverlayMessage;
    updateMetaUIRef = deps.updateMetaUI;
    selectProfileRecordRef = deps.selectProfileRecord;
    listSaveSlotsRef = deps.listSaveSlotsSystem;
    getProfileListRef = deps.getProfileListSystem;
    createNewProfileRecordRef = deps.createNewProfileRecord;
    deleteProfileRecordRef = deps.deleteProfileRecord;
    loadMetaProfileRef = deps.loadMetaProfileSystem;
    saveGameRef = deps.saveGameSystem;
    resetMetaProfileRef = deps.resetMetaProfileSystem;
    saveMetaProfileRef = deps.saveMetaProfileSystem;
    setMusicVolumeRef = deps.setMusicVolume;
    setSfxVolumeRef = deps.setSfxVolume;
    getMusicVolumeRef = deps.getMusicVolume;
    getSfxVolumeRef = deps.getSfxVolume;
    setupCanvasResolutionRef = deps.setupCanvasResolution;
    initStarsRef = deps.initStars;
    getViewportSizeRef = deps.getViewportSize;
    SAVE_PREFIX_REF = deps.SAVE_PREFIX;
    SAVE_LAST_KEY_REF = deps.SAVE_LAST_KEY;
    isCrtFilterEnabledRef = deps.isCrtFilterEnabled;
    toggleCrtFilterRef = deps.toggleCrtFilter;
}

function formatPlayTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * @returns {void}
 */
export function updateStartScreenDisplay() {
    const el = document.getElementById('current-profile-display');
    if (el) {
        el.innerText = GameContextRef.currentProfileName ? `Current: ${GameContextRef.currentProfileName}` : 'Current: None';
    }
}

function updateProfileSelectionVisuals() {
    document.querySelectorAll('.profile-item').forEach(el => {
        if (el.dataset.name === selectedProfileName) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

export function resetProfileStats() {
    GameContextRef.totalKills = 0;
    GameContextRef.highScore = 0;
    GameContextRef.totalPlayTimeMs = 0;
}

/**
 * @param {string} name
 * @returns {void}
 */
export function selectProfile(name) {
    resetProfileStats();
    selectProfileRecordRef(name);
    GameContextRef.metaProfile = { purchases: {}, bank: 0 };
    loadMetaProfileRef();
    updateStartScreenDisplay();
    showOverlayMessageRef(`SELECTED: ${name}`, '#ff0', 1200);
}

function createNewProfile() {
    const newName = createNewProfileRecordRef();
    if (!newName) {
        showOverlayMessageRef("PROFILE CREATE FAILED", '#f00', 1500);
        return;
    }

    selectProfileRecordRef(newName);
    GameContextRef.metaProfile = { purchases: {}, bank: 0 };
    loadMetaProfileRef();
    updateStartScreenDisplay();
    showSaveMenu();
    showOverlayMessageRef(`CREATED: ${newName}`, '#0f0', 1200);
}

async function renameSelectedProfile() {
    if (!selectedProfileName) {
        showOverlayMessageRef("NO PROFILE SELECTED", '#f00', 1200);
        return;
    }

    const menu = document.getElementById('save-menu');
    if (menu) menu.style.display = 'none';

    const oldName = selectedProfileName;
    const newName = await showRenamePromptDialog(oldName);

    showSaveMenu();

    if (!newName || newName === oldName) return;

    const existingProfiles = listSaveSlotsRef();
    if (existingProfiles.includes(newName)) {
        showOverlayMessageRef("PROFILE NAME EXISTS", '#f00', 1500);
        return;
    }

    try {
        const profileData = localStorage.getItem(SAVE_PREFIX_REF + oldName);
        const metaData = localStorage.getItem(`meta_profile_v1_${oldName}`);

        if (profileData) localStorage.setItem(SAVE_PREFIX_REF + newName, profileData);
        if (metaData) localStorage.setItem(`meta_profile_v1_${newName}`, metaData);

        localStorage.removeItem(SAVE_PREFIX_REF + oldName);
        localStorage.removeItem(`meta_profile_v1_${oldName}`);

        if (GameContextRef.currentProfileName === oldName) {
            GameContextRef.currentProfileName = newName;
            localStorage.setItem(SAVE_LAST_KEY_REF, newName);
        }
        if (selectedProfileName === oldName) {
            selectedProfileName = newName;
        }

        showSaveMenu();
        showOverlayMessageRef(`RENAMED TO: ${newName}`, '#0f0', 1200);
    } catch (e) {
        showOverlayMessageRef("RENAME FAILED", '#f00', 1500);
    }
}

async function deleteSelectedProfile() {
    if (!selectedProfileName) {
        showOverlayMessageRef("NO PROFILE SELECTED", '#f00', 1200);
        return;
    }

    const menu = document.getElementById('save-menu');
    if (menu) menu.style.display = 'none';

    const confirmed = await showAbortConfirmDialog();
    if (!confirmed) {
        showSaveMenu();
        return;
    }

    deleteProfileRecordRef(selectedProfileName);
        if (success) {
            updateStartScreenDisplay();
            updateMetaUIRef();
            if (showOverlayMessageRef) showOverlayMessageRef(`DELETED ${nameToDelete}`, '#f00', 1500);
        }

    selectedProfileName = GameContextRef.currentProfileName;
    showSaveMenu();
    showOverlayMessageRef("PROFILE DELETED", '#ff0', 1200);
}

/**
 * @returns {void}
 */
export function showSaveMenu() {
    const menu = document.getElementById('save-menu');
    const listEl = document.getElementById('profile-list');

    const profiles = getProfileListRef();
    listEl.innerHTML = '';

    if (profiles.length > 0) {
        const currentProfileExists = GameContextRef.currentProfileName && profiles.some(p => p.name === GameContextRef.currentProfileName);
        selectedProfileName = currentProfileExists ? GameContextRef.currentProfileName : profiles[0].name;
    } else {
        selectedProfileName = null;
    }

    if (profiles.length === 0) {
        listEl.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No profiles found</div>';
    } else {
        profiles.forEach(p => {
            const date = new Date(p.timestamp);
            const timeStr = date.toLocaleString();
            const playTime = formatPlayTime(p.totalPlayTimeMs);

            const div = document.createElement('div');
            div.className = 'profile-item';
            div.dataset.name = p.name;
            div.innerHTML = `
                <div class="profile-item-name">${p.name}</div>
                <div class="profile-item-detail">Level ${p.level} • XP: ${p.xp}/${p.nextXp}</div>
                <div class="profile-item-detail">HP: ${p.hp}/${p.maxHp} • Kills: ${p.totalKills}</div>
                <div class="profile-item-detail">Sector ${p.sectorIndex} • Score: ${p.score}</div>
                <div class="profile-item-detail">High Score: ${p.highScore}</div>
                <div class="profile-item-detail">Play Time: ${playTime}</div>
                <div class="profile-item-last-saved">Last saved: ${timeStr}</div>
            `;
            div.addEventListener('click', () => {
                selectedProfileName = p.name;
                updateProfileSelectionVisuals();
            });
            listEl.appendChild(div);
        });
    }

    document.getElementById('create-new-profile').onclick = () => createNewProfile();
    document.getElementById('rename-profile').onclick = () => renameSelectedProfile();
    document.getElementById('delete-profile').onclick = () => deleteSelectedProfile();
    document.getElementById('select-profile').onclick = () => {
        if (selectedProfileName) {
            selectProfile(selectedProfileName);
            menu.style.display = 'none';
        } else {
            showOverlayMessageRef("NO PROFILE SELECTED", '#f00', 1200);
        }
    };
    document.getElementById('close-save-menu').onclick = () => {
        menu.style.display = 'none';
        updateStartScreenDisplay();
    };

    menu.style.display = 'block';
    updateProfileSelectionVisuals();

    GameContextRef.menuSelectionIndex = 0;
    gpStateRef.lastMenuElements = null;

    requestAnimationFrame(() => {
        setMenuDebounceRef(Date.now() + 300);
        const active = getActiveMenuElementsRef();
        if (active.length > 0) {
            updateMenuVisualsRef(active);
            if (typeof active[0].focus === 'function') {
                active[0].focus();
            }
        }
    });
}

/**
 * @returns {void}
 */
export function autoSaveToCurrentProfile() {
    if (!GameContextRef.currentProfileName) return;
    saveGameRef(GameContextRef.currentProfileName, true);
}

/**
 * @returns {void}
 */
export function wipeProfiles() {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(SAVE_PREFIX_REF) || k.startsWith('meta_profile_v1_'))) {
            toDelete.push(k);
        }
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(SAVE_LAST_KEY_REF);
    localStorage.removeItem('meta_profile_v1');
    resetMetaProfileRef();
    GameContextRef.rerollTokens = 0;
    GameContextRef.currentProfileName = null;
    updateMetaUIRef();
    updateStartScreenDisplay();
    showOverlayMessageRef("PROFILE RESET - STARTING FRESH", '#0f0', 2000);
}

/**
 * @returns {Promise<boolean>}
 */
export function showAbortConfirmDialog() {
    return new Promise((resolve) => {
        const modal = document.getElementById('abort-modal');
        const confirmBtn = document.getElementById('abort-confirm');
        const cancelBtn = document.getElementById('abort-cancel');

        if (!modal || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        modal.style.display = 'block';

        GameContextRef.menuSelectionIndex = 0;
        gpStateRef.lastMenuElements = null;

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onYes);
            cancelBtn.removeEventListener('click', onNo);
            window.removeEventListener('keydown', onEscape);
            modal.style.display = 'none';
        };

        const onYes = () => {
            cleanup();
            resolve(true);
        };

        const onNo = () => {
            cleanup();
            resolve(false);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onNo();
            }
        };

        confirmBtn.addEventListener('click', onYes);
        cancelBtn.addEventListener('click', onNo);
        window.addEventListener('keydown', onEscape);

        requestAnimationFrame(() => {
            setMenuDebounceRef(Date.now() + 300);
            const active = getActiveMenuElementsRef();
            if (active.length > 0) {
                updateMenuVisualsRef(active);
                if (typeof active[0].focus === 'function') {
                    active[0].focus();
                }
            }
        });
    });
}

/**
 * @param {string} defaultName
 * @returns {Promise<?string>}
 */
export function showRenamePromptDialog(defaultName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('rename-prompt-modal');
        const input = document.getElementById('rename-input');
        const confirmBtn = document.getElementById('rename-confirm');
        const cancelBtn = document.getElementById('rename-cancel');

        if (!modal || !input || !confirmBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        input.value = defaultName || '';
        modal.style.display = 'block';

        GameContextRef.menuSelectionIndex = 0;
        gpStateRef.lastMenuElements = null;

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('keydown', onEnter);
            modal.style.display = 'none';
        };

        const onConfirm = () => {
            const newName = input.value.trim();
            cleanup();
            resolve(newName || null);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };

        const onEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('keydown', onEnter);

        const setupGamepadNav = () => {
            const navElements = [confirmBtn, cancelBtn];
            gpStateRef.lastMenuElements = navElements;
            const inputElement = input;
            const originalUpdateMenuVisuals = window.updateMenuVisuals;
            window.updateMenuVisuals = function (elements) {
                elements.forEach((el, idx) => {
                    if (idx === GameContextRef.menuSelectionIndex) {
                        el.classList.add('selected');
                        if (typeof el.focus === 'function') {
                            el.focus();
                        }
                    } else {
                        el.classList.remove('selected');
                        if (el !== inputElement && typeof el.blur === 'function') {
                            el.blur();
                        }
                    }
                });
            };

            const originalCleanup = cleanup;
            const newCleanup = () => {
                window.updateMenuVisuals = originalUpdateMenuVisuals;
                originalCleanup();
            };

            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.addEventListener('click', () => {
                const newName = input.value.trim();
                newCleanup();
                resolve(newName || null);
            });
            cancelBtn.addEventListener('click', () => {
                newCleanup();
                resolve(null);
            });
        };

        requestAnimationFrame(() => {
            setMenuDebounceRef(Date.now() + 300);
            input.focus();
            input.select();
            setupGamepadNav();
            const active = [confirmBtn, cancelBtn];
            updateMenuVisualsRef(active);
        });
    });
}

/**
 * @returns {void}
 */
export function initProfileSystem() {
    GameContextRef.currentProfileName = localStorage.getItem(SAVE_LAST_KEY_REF) || null;

    let autoCreated = false;
    if (!GameContextRef.currentProfileName) {
        const existing = listSaveSlotsRef();
        if (existing.length === 0) {
            console.log('[PROFILE] Auto-creating default profile');
            const newName = 'profile1';
            const template = {
                version: 1,
                timestamp: Date.now(),
                lastSavedAt: Date.now(),
                score: 0,
                sectorIndex: 1,
                totalKills: 0,
                highScore: 0,
                totalPlayTimeMs: 0,
                player: null
            };
            try {
                localStorage.setItem(SAVE_PREFIX_REF + newName, JSON.stringify(template));

                const newMetaProfile = {
                    bank: 0,
                    purchases: {
                        startDamage: 0, passiveHp: 0, rerollTokens: 0, hullPlating: 0, shieldCore: 0,
                        staticBlueprint: 0, missilePrimer: 0,  nukeCapacitor: 0,
                        speedTuning: 0, bankMultiplier: 0, shopDiscount: 0, extraLife: 0, droneFabricator: 0,
                        piercingRounds: 0, explosiveRounds: 0, criticalStrike: 0, splitShot: 0,
                        thornArmor: 0, lifesteal: 0, evasionBoost: 0, shieldRecharge: 0,
                        dashCooldown: 0, dashDuration: 0,  autoReroll: 0,
                         contractSpeed: 0, startingRerolls: 0, luckyDrop: 0,
                        bountyHunter: 0, comboMeter: 0, startingWeapon: 0, secondWind: 0, batteryCapacitor: 0
                    }
                };
                localStorage.setItem(`meta_profile_v1_${newName}`, JSON.stringify(newMetaProfile));

                selectProfile(newName);
                autoCreated = true;
            } catch (e) {
                console.warn('[PROFILE] Auto-create failed', e);
            }
        }
    }

    if (!autoCreated) {
        loadMetaProfileRef();
    }
    updateMetaUIRef();
    updateStartScreenDisplay();

    window.addEventListener('beforeunload', () => {
        if (GameContextRef.currentProfileName) {
            try {
                autoSaveToCurrentProfile();
                saveMetaProfileRef();
            } catch (e) {
            }
        }
    });

    if (window.SpacebrosApp && window.SpacebrosApp.ipcRenderer) {
        window.SpacebrosApp.ipcRenderer.on('app-before-quit', () => {
            console.log('[SAVE] App quit detected, saving profiles...');
            if (GameContextRef.currentProfileName) {
                try {
                    autoSaveToCurrentProfile();
                    console.log('[SAVE] Game profile saved');
                    saveMetaProfileRef();
                    console.log('[SAVE] Meta profile saved');
                } catch (e) {
                    console.warn('[SAVE] Save on quit failed:', e);
                }
            } else {
                console.log('[SAVE] No profile, skipping save');
            }
        });
    }
}

/**
 * @returns {void}
 */
export function initSettingsMenu() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const settingsApplyBtn = document.getElementById('settings-apply-btn');
    const resSelect = document.getElementById('res-select');
    const fullscreenCheck = document.getElementById('fullscreen-check');
    const vsyncCheck = document.getElementById('vsync-check');
    const framelessCheck = document.getElementById('frameless-check');
    const crtCheck = document.getElementById('crt-check');

    const isElectron = window.SpacebrosApp && window.SpacebrosApp.settings;

    async function populateResolutionSelector() {
        if (!isElectron || !resSelect) return;

        try {
            const resolutions = await window.SpacebrosApp.settings.getSupportedResolutions();
            if (!resolutions || !Array.isArray(resolutions)) {
                addResolutionOption(1920, 1080, true);
                return;
            }

            resSelect.innerHTML = '';

            resolutions.forEach(res => {
                const isDefault = res.width === 1920 && res.height === 1080;
                addResolutionOption(res.width, res.height, isDefault);
            });
        } catch (e) {
            console.error("Failed to populate resolutions:", e);
            resSelect.innerHTML = '';
            addResolutionOption(1920, 1080, true);
        }
    }

    function addResolutionOption(width, height, isDefault = false) {
        const option = document.createElement('option');
        option.value = `${width}x${height}`;

        let label = `${width} x ${height}`;
        if (width === 1280 && height === 720) label += ' (HD)';
        else if (width === 1600 && height === 900) label += ' (HD+)';
        else if (width === 1920 && height === 1080) label += ' (Full HD)';
        else if (width === 2560 && height === 1440) label += ' (QHD)';
        else if (width === 3840 && height === 2160) label += ' (4K UHD)';
        else label += ' (Native)';

        option.textContent = label;
        resSelect.appendChild(option);

        if (isDefault) {
            resSelect.value = option.value;
        }
    }

    populateResolutionSelector();

    if (settingsBtn) {
        if (!isElectron) {
            settingsBtn.style.display = 'none';
        } else {
            settingsBtn.addEventListener('click', async () => {
                openSettingsMenu();
            });
        }
    }

    const pauseSettingsBtn = document.getElementById('pause-settings-btn');
    if (pauseSettingsBtn) {
        pauseSettingsBtn.addEventListener('click', openSettingsMenu);
    }

    async function openSettingsMenu() {
        const current = await window.SpacebrosApp.settings.get();
        if (current) {
            fullscreenCheck.checked = !!current.fullscreen;
            resSelect.disabled = false;

            const internalRes = current.internalResolution || { width: current.width || 1920, height: current.height || 1080 };
            const resString = `${internalRes.width}x${internalRes.height}`;

            const optionExists = [...resSelect.options].some(o => o.value === resString);
            if (optionExists) {
                resSelect.value = resString;
            } else {
                const customOption = document.createElement('option');
                customOption.value = resString;
                customOption.textContent = `${internalRes.width} x ${internalRes.height} (Custom)`;
                resSelect.appendChild(customOption);
                resSelect.value = resString;
            }

            framelessCheck.checked = !!current.frameless;
            vsyncCheck.checked = current.vsync !== false;
        }

        const musicVolumeSlider = document.getElementById('music-volume');
        const sfxVolumeSlider = document.getElementById('sfx-volume');
        const musicVolumeLabel = document.getElementById('music-volume-label');
        const sfxVolumeLabel = document.getElementById('sfx-volume-label');

        const musicVolume = typeof getMusicVolumeRef === 'function' ? getMusicVolumeRef() : 1;
        const sfxVolume = typeof getSfxVolumeRef === 'function' ? getSfxVolumeRef() : 1;

        if (musicVolumeSlider && musicVolumeLabel) {
            musicVolumeSlider.value = Math.round(musicVolume * 100);
            musicVolumeLabel.textContent = `${musicVolumeSlider.value}%`;
        }
        if (sfxVolumeSlider && sfxVolumeLabel) {
            sfxVolumeSlider.value = Math.round(sfxVolume * 100);
            sfxVolumeLabel.textContent = `${sfxVolumeSlider.value}%`;
        }

        settingsMenu.style.display = 'block';

        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu && GameContextRef.gamePaused) {
            pauseMenu.style.pointerEvents = 'none';
        }
    }

    const musicVolumeSlider = document.getElementById('music-volume');
    const sfxVolumeSlider = document.getElementById('sfx-volume');
    const musicVolumeLabel = document.getElementById('music-volume-label');
    const sfxVolumeLabel = document.getElementById('sfx-volume-label');

    if (musicVolumeSlider) {
        musicVolumeSlider.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            setMusicVolumeRef(value);
            musicVolumeLabel.textContent = `${e.target.value}%`;
        });
    }

    if (sfxVolumeSlider) {
        sfxVolumeSlider.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            setSfxVolumeRef(value);
            sfxVolumeLabel.textContent = `${e.target.value}%`;
        });
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => {
            settingsMenu.style.display = 'none';
            if (GameContextRef.gamePaused) {
                const pauseMenu = document.getElementById('pause-menu');
                pauseMenu.style.display = 'block';
                pauseMenu.style.pointerEvents = 'auto';
            }
        });
    }

    if (settingsApplyBtn && isElectron) {
        settingsApplyBtn.addEventListener('click', async () => {
            const isFullscreen = fullscreenCheck.checked;
            const isVsync = vsyncCheck.checked;
            const isFrameless = framelessCheck.checked;
            const [w, h] = resSelect.value.split('x').map(Number);

            const old = await window.SpacebrosApp.settings.get();
            const framelessChanged = old.frameless !== isFrameless;
            const vsyncChanged = old.vsync !== isVsync;
            const oldRes = old.internalResolution || { width: old.width || 1920, height: old.height || 1080 };
            const resolutionChanged = oldRes.width !== w || oldRes.height !== h;

            await window.SpacebrosApp.settings.save({
                width: w,
                height: h,
                internalResolution: { width: w, height: h },
                fullscreen: isFullscreen,
                vsync: isVsync,
                frameless: isFrameless
            });

            window.SpacebrosApp.settings.setFullscreen(isFullscreen);

            if (!isFullscreen) {
                window.SpacebrosApp.settings.setResolution(w, h);
            }

            if (resolutionChanged) {
                setupCanvasResolutionRef(w, h);
                if (typeof getViewportSizeRef === 'function') {
                    const size = getViewportSizeRef();
                    initStarsRef(size.width, size.height);
                } else {
                    initStarsRef(w, h);
                }
            }

            if (framelessChanged || vsyncChanged) {
                if (confirm("Changing vsync or window frame style requires a restart. Restart now?")) {
                    window.SpacebrosApp.settings.relaunch();
                }
            } else {
                showOverlayMessageRef("SETTINGS SAVED", '#0f0', 1500);
                settingsMenu.style.display = 'none';
                if (GameContextRef.gamePaused) {
                    const pauseMenu = document.getElementById('pause-menu');
                    pauseMenu.style.display = 'block';
                    pauseMenu.style.pointerEvents = 'auto';
                }
            }
        });
    }

    const qStart = document.getElementById('desktop-quit-start-btn');
    const qPause = document.getElementById('desktop-quit-pause-btn');

    if (qStart) {
        qStart.addEventListener('click', () => window.SpacebrosApp.settings.quit());
    }
    if (qPause) {
        qPause.addEventListener('click', () => {
            if (confirm("Quit to desktop? Game and upgrades will be auto-saved.")) {
                window.SpacebrosApp.settings.quit();
            }
        });
    }
}
