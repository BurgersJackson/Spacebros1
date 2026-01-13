import { GameContext } from '../core/game-context.js';

const deps = {};

export function registerMiniEventDependencies(next) {
    Object.assign(deps, next);
}

export function updateMiniEventUI() {
    const el = document.getElementById('event-display');
    if (!el) return;
    if (!GameContext.miniEvent || GameContext.miniEvent.dead) {
        el.style.display = 'none';
        el.innerText = 'EVENT: NONE';
        return;
    }
    el.style.display = 'block';
    if (typeof GameContext.miniEvent.getUiText === 'function') el.innerText = GameContext.miniEvent.getUiText();
    else el.innerText = 'EVENT: ACTIVE';
}

export function clearMiniEvent() {
    if (!GameContext.miniEvent) return;
    if (typeof GameContext.miniEvent.kill === 'function') {
        GameContext.miniEvent.kill();
    } else {
        GameContext.miniEvent.dead = true;
    }
    deps.pixiCleanupObject(GameContext.miniEvent);
    GameContext.miniEvent = null;
}

export function completeContract(success = true) {
    deps.completeContractSystem(success);
}
