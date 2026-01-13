import { GameContext } from '../core/game-context.js';
import { SIM_STEP_MS, SIM_MAX_STEPS_PER_FRAME } from '../core/constants.js';
import { globalProfiler } from '../core/profiler.js';
import { globalJitterMonitor } from '../core/jitter-monitor.js';

let _updateGamepad = null;
let _gameLoopLogic = null;
let _getSimNowMs = null;
let _setSimNowMs = null;
let _getSimAccMs = null;
let _setSimAccMs = null;
let _getSimLastPerfAt = null;
let _setSimLastPerfAt = null;
let _fpsCounterEl = null;

let fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let fpsSmoothMs = 16.7;
let fpsNextUiAt = 0;
let fpsUiVisible = null;
let animationId = null;

/**
 * @param {Object} deps
 */
export function registerGameLoopDependencies(deps) {
    if (deps.updateGamepad) _updateGamepad = deps.updateGamepad;
    if (deps.gameLoopLogic) _gameLoopLogic = deps.gameLoopLogic;
    if (deps.getSimNowMs) _getSimNowMs = deps.getSimNowMs;
    if (deps.setSimNowMs) _setSimNowMs = deps.setSimNowMs;
    if (deps.getSimAccMs) _getSimAccMs = deps.getSimAccMs;
    if (deps.setSimAccMs) _setSimAccMs = deps.setSimAccMs;
    if (deps.getSimLastPerfAt) _getSimLastPerfAt = deps.getSimLastPerfAt;
    if (deps.setSimLastPerfAt) _setSimLastPerfAt = deps.setSimLastPerfAt;
    if (deps.fpsCounterEl !== undefined) _fpsCounterEl = deps.fpsCounterEl;

    fpsLastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    fpsSmoothMs = 16.7;
    fpsNextUiAt = 0;
    fpsUiVisible = null;
}

/**
 * @returns {void}
 */
export function startMainLoop() {
    mainLoop();
}

function mainLoop() {
    globalProfiler.update();
    animationId = requestAnimationFrame(mainLoop);

    if (_fpsCounterEl) {
        const shouldShow = !!GameContext.gameActive;
        if (fpsUiVisible !== shouldShow) {
            _fpsCounterEl.style.display = shouldShow ? 'block' : 'none';
            fpsUiVisible = shouldShow;
        }

        const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.min(250, t - fpsLastFrameAt));
        fpsLastFrameAt = t;
        fpsSmoothMs = fpsSmoothMs * 0.9 + dt * 0.1;

        if (shouldShow && t >= fpsNextUiAt) {
            const fps = fpsSmoothMs > 0 ? (1000 / fpsSmoothMs) : 0;
            _fpsCounterEl.textContent = `FPS ${fps.toFixed(0)}  ${fpsSmoothMs.toFixed(1)}ms`;
            fpsNextUiAt = t + 250;
        }
    }

    if (_updateGamepad) _updateGamepad();
    if (!_gameLoopLogic) return;

    if (GameContext.gameActive && !GameContext.gamePaused) {
        const frameStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        let simLastPerfAt = _getSimLastPerfAt ? _getSimLastPerfAt() : 0;
        let simNowMs = _getSimNowMs ? _getSimNowMs() : 0;
        let simAccMs = _getSimAccMs ? _getSimAccMs() : 0;

        if (!simLastPerfAt) {
            console.log('[RESUME] First frame after resume - simLastPerfAt was 0, initializing');
            simLastPerfAt = frameStart;
            if (!simNowMs) simNowMs = Date.now();
            simAccMs = 0;
        }
        let frameDt = frameStart - simLastPerfAt;
        simLastPerfAt = frameStart;
        if (!isFinite(frameDt) || frameDt < 0) frameDt = 0;

        globalJitterMonitor.recordFrame(frameDt);
        frameDt = Math.min(100, frameDt);
        simNowMs += frameDt;
        simAccMs += frameDt;

        let steps = 0;
        const STEP = SIM_STEP_MS;
        while (simAccMs >= STEP && steps < SIM_MAX_STEPS_PER_FRAME) {
            const originalDateNow = Date.now;
            Date.now = () => Math.floor(simNowMs - (simAccMs - STEP));
            _gameLoopLogic({ doUpdate: true, doDraw: false, deltaTime: STEP });
            Date.now = originalDateNow;
            simAccMs -= STEP;
            steps++;
        }

        const alpha = steps > 0 ? Math.min(1, simAccMs / STEP) : 1.0;

        const originalDateNow2 = Date.now;
        Date.now = () => Math.floor(simNowMs);
        _gameLoopLogic({ doUpdate: false, doDraw: true, deltaTime: 0, alpha: alpha });
        Date.now = originalDateNow2;

        if (_setSimLastPerfAt) _setSimLastPerfAt(simLastPerfAt);
        if (_setSimNowMs) _setSimNowMs(simNowMs);
        if (_setSimAccMs) _setSimAccMs(simAccMs);
    } else {
        if (_setSimLastPerfAt) _setSimLastPerfAt(0);
        if (_setSimAccMs) _setSimAccMs(0);
    }
}
