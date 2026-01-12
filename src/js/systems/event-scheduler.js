import { GameContext } from '../core/game-context.js';

let arenaCountdownActive = false;
let arenaCountdownTimeLeft = 0;
let arenaCountdownElement = null;

export function isArenaCountdownActive() {
    return arenaCountdownActive;
}

export function getArenaCountdownTimeLeft() {
    return arenaCountdownTimeLeft;
}

export function setArenaCountdownTimeLeft(value) {
    arenaCountdownTimeLeft = value;
}

export function scheduleNextShootingStar() {
    if (GameContext.sectorIndex >= 2) {
        GameContext.nextShootingStarTime = Date.now() + 60000;
    } else {
        GameContext.nextShootingStarTime = Date.now() + 180000 + Math.random() * 120000;
    }
}

export function scheduleNextRadiationStorm(fromNow = Date.now()) {
    GameContext.nextRadiationStormAt = null;
    GameContext.radiationStorm = null;
}

export function scheduleNextMiniEvent(fromNow = Date.now()) {
    const min = 120000;
    const max = 210000;
    GameContext.nextMiniEventAt = fromNow + min + Math.floor(Math.random() * (max - min + 1));
}

export function startArenaCountdown() {
    if (arenaCountdownActive) return;

    arenaCountdownActive = true;
    arenaCountdownTimeLeft = 10;

    if (!arenaCountdownElement) {
        arenaCountdownElement = document.getElementById('arena-countdown');
    }

    updateArenaCountdownDisplay();
}

export function updateArenaCountdownDisplay() {
    if (!arenaCountdownElement) {
        arenaCountdownElement = document.getElementById('arena-countdown');
    }
    const el = arenaCountdownElement;
    if (!el) return;

    if (arenaCountdownTimeLeft <= 0) {
        el.style.display = 'none';
        el.className = '';
        return;
    }

    el.innerText = `ARENA FIGHT\n${arenaCountdownTimeLeft}`;
    el.style.display = 'block';

    el.className = '';
    if (arenaCountdownTimeLeft <= 3) {
        el.classList.add('countdown-critical');
    } else if (arenaCountdownTimeLeft <= 5) {
        el.classList.add('countdown-warning');
    } else {
        el.classList.add('countdown-normal');
    }
}

export function stopArenaCountdown() {
    arenaCountdownActive = false;
    const el = arenaCountdownElement;
    if (el) {
        el.style.display = 'none';
        el.className = '';
    }
}
