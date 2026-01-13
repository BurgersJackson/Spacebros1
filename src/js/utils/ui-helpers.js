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

