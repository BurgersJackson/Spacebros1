let overlayToken = 0;
let overlayPriority = 0;
let overlayLockUntil = 0;
let overlayTimeout = null;

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return hh > 0
        ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
        : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * @param {string} text
 * @param {string} color
 * @param {number} duration
 * @param {number} priority
 * @returns {void}
 */
export function showOverlayMessage(text, color = '#0ff', duration = 2000, priority = 0) {
    const el = document.getElementById('overlay-message');
    if (!el) return;
    const now = Date.now();
    if (now < overlayLockUntil && priority < overlayPriority) return;

    overlayPriority = priority;
    overlayLockUntil = now + duration;
    overlayToken++;
    const token = overlayToken;

    el.innerText = text;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;
    el.style.display = 'block';
    if (overlayTimeout) clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
        if (overlayToken !== token) return;
        el.style.display = 'none';
        overlayPriority = 0;
        overlayLockUntil = 0;
    }, duration);
}

/**
 * @returns {void}
 */
export function clearOverlayMessageTimeout() {
    if (overlayTimeout) {
        clearTimeout(overlayTimeout);
        overlayTimeout = null;
    }
}

/**
 * @param {Object} state
 * @returns {void}
 */
export function updateHealthUI(state) {
    const player = state ? state.player : null;
    if (!player) return;
    const healthFill = document.getElementById('health-fill');
    if (!healthFill) return;
    const pct = (player.hp / player.maxHp) * 100;
    healthFill.style.width = `${Math.max(0, pct)}%`;
    if (pct < 30) healthFill.style.backgroundColor = '#f00';
    else if (pct < 60) healthFill.style.backgroundColor = '#ff0';
    else healthFill.style.backgroundColor = '#0f0';
    const ht = document.getElementById('health-text');
    if (ht) ht.innerText = `${Math.max(0, Math.floor(player.hp))} / ${player.maxHp}`;
}

/**
 * @param {Object} state
 * @returns {void}
 */
export function updateXpUI(state) {
    const player = state ? state.player : null;
    if (!player) return;
    const xpFill = document.getElementById('xp-fill');
    if (!xpFill) return;
    const pct = (player.xp / player.nextLevelXp) * 100;
    xpFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    const levelEl = document.getElementById('level-display');
    if (levelEl) levelEl.innerText = player.level;
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = state.score;
}

/**
 * @param {Object} state
 * @returns {void}
 */
export function updateWarpUI(state) {
    const player = state ? state.player : null;
    if (!player) return;
    const warpStatus = document.getElementById('warp-status');
    const warpFill = document.getElementById('warp-fill');
    if (!warpStatus || !warpFill) return;
    if (!player.canWarp) {
        warpStatus.style.display = 'none';
    } else {
        warpStatus.style.display = 'flex';
        const pct = ((player.maxWarpCooldown - player.warpCooldown) / player.maxWarpCooldown) * 100;
        warpFill.style.width = `${pct}%`;
        warpFill.style.backgroundColor = player.warpCooldown > 0 ? '#333' : '#0ff';
    }
}

/**
 * @param {Object} state
 * @returns {void}
 */
export function updateTurboUI(state) {
    const player = state ? state.player : null;
    const turboStatus = document.getElementById('turbo-status');
    const turboFill = document.getElementById('turbo-fill');
    if (!player || !turboStatus || !turboFill) return;
    if (!player.turboBoost || !player.turboBoost.unlocked) {
        turboStatus.style.display = 'none';
        return;
    }
    turboStatus.style.display = 'flex';

    const cooldownTotal = 600;
    const cd = Math.max(0, player.turboBoost.cooldownFrames || 0);
    const active = Math.max(0, player.turboBoost.activeFrames || 0);

    if (active > 0) {
        turboFill.style.width = '100%';
        turboFill.style.background = 'linear-gradient(90deg, #ff0, #f80, #f00)';
    } else if (cd > 0) {
        const pct = (1 - (cd / cooldownTotal)) * 100;
        turboFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        turboFill.style.background = 'linear-gradient(90deg, #f00, #ff0)';
    } else {
        turboFill.style.width = '100%';
        turboFill.style.background = 'linear-gradient(90deg, #0ff, #0f0)';
    }
}

/**
 * @param {Object} state
 * @returns {void}
 */
export function updateContractUI(state) {
    const el = document.getElementById('contract-display');
    if (!el) return;
    const activeContract = state ? state.activeContract : null;
    if (!activeContract) {
        el.innerText = 'CONTRACT: NONE';
        return;
    }
    let extra = '';
    if (activeContract.type === 'scan_beacon') {
        if (activeContract.state === 'active') extra = ` (SCANNING ${Math.floor((activeContract.progress || 0) * 100)}%)`;
        else extra = ' (GO TO BEACON)';
    } else if (activeContract.type === 'gate_run') {
        const remain = Math.max(0, (activeContract.endsAt || 0) - Date.now());
        extra = ` (GATE ${activeContract.gateIndex + 1}/${activeContract.gateCount} ${formatTime(remain)})`;
    } else if (activeContract.type === 'anomaly') {
        if (activeContract.coreCollected) extra = ' (ESCAPE ZONE)';
        else extra = activeContract.state === 'inside' ? ' (FIND CORE)' : ' (ENTER ZONE)';
    }
    el.innerText = `CONTRACT: ${activeContract.title}${extra}`;
}
