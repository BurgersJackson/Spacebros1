import { GameContext } from '../core/game-context.js';
import { updateContractUI as updateContractUIHelper } from '../utils/ui-helpers.js';

let findSpawnPointRelativeFn = null;
let ContractBeaconCtor = null;
let GateRingCtor = null;
let SpaceNuggetCtor = null;
let CoinCtor = null;
let showOverlayMessageFn = null;
let playSoundFn = null;
let clearArrayWithPixiCleanupFn = null;
let filterArrayWithPixiCleanupFn = null;

export function registerContractHandlers(handlers) {
    findSpawnPointRelativeFn = handlers.findSpawnPointRelative || null;
    ContractBeaconCtor = handlers.ContractBeacon || null;
    GateRingCtor = handlers.GateRing || null;
    SpaceNuggetCtor = handlers.SpaceNugget || null;
    CoinCtor = handlers.Coin || null;
    showOverlayMessageFn = handlers.showOverlayMessage || null;
    playSoundFn = handlers.playSound || null;
    clearArrayWithPixiCleanupFn = handlers.clearArrayWithPixiCleanup || null;
    filterArrayWithPixiCleanupFn = handlers.filterArrayWithPixiCleanup || null;
}

export function updateContractUI() {
    updateContractUIHelper(GameContext);
}

export function clearContractEntities() {
    if (!clearArrayWithPixiCleanupFn || !GameContext.contractEntities) return;
    clearArrayWithPixiCleanupFn(GameContext.contractEntities.beacons);
    clearArrayWithPixiCleanupFn(GameContext.contractEntities.gates);
    clearArrayWithPixiCleanupFn(GameContext.contractEntities.anomalies);
    clearArrayWithPixiCleanupFn(GameContext.contractEntities.fortresses);
    clearArrayWithPixiCleanupFn(GameContext.contractEntities.wallTurrets);
}

export function completeContract(success = true) {
    if (!GameContext.activeContract) return;
    const contractId = GameContext.activeContract.id;
    if (success) {
        const rewardNugs = (GameContext.activeContract.rewardNugs !== undefined) ? GameContext.activeContract.rewardNugs : 4;
        if (SpaceNuggetCtor && GameContext.player) {
            for (let i = 0; i < rewardNugs; i++) {
                GameContext.nuggets.push(new SpaceNuggetCtor(GameContext.player.pos.x + (Math.random() - 0.5) * 120, GameContext.player.pos.y + (Math.random() - 0.5) * 120, 1));
            }
        }
        if (CoinCtor && GameContext.player) {
            GameContext.coins.push(new CoinCtor(GameContext.player.pos.x + (Math.random() - 0.5) * 80, GameContext.player.pos.y + (Math.random() - 0.5) * 80, 10));
        }
        const rewardScore = (GameContext.activeContract.rewardScore !== undefined) ? GameContext.activeContract.rewardScore : 5000;
        GameContext.score += rewardScore;
        if (showOverlayMessageFn) showOverlayMessageFn("CONTRACT COMPLETE", '#0f0', 1500);
    } else {
        if (showOverlayMessageFn) showOverlayMessageFn("CONTRACT FAILED", '#f00', 1500);
    }
    if (clearArrayWithPixiCleanupFn && GameContext.contractEntities) {
        clearArrayWithPixiCleanupFn(GameContext.contractEntities.beacons);
        clearArrayWithPixiCleanupFn(GameContext.contractEntities.gates);
        clearArrayWithPixiCleanupFn(GameContext.contractEntities.anomalies);
        clearArrayWithPixiCleanupFn(GameContext.contractEntities.fortresses);
        clearArrayWithPixiCleanupFn(GameContext.contractEntities.wallTurrets);
    }
    if (filterArrayWithPixiCleanupFn && contractId) {
        filterArrayWithPixiCleanupFn(GameContext.environmentAsteroids, a => !a.contractId || a.contractId !== contractId);
        filterArrayWithPixiCleanupFn(GameContext.enemies, e => !e.contractId || e.contractId !== contractId);
    }
    GameContext.activeContract = null;
    GameContext.nextContractAt = Date.now() + 45000 + Math.random() * 30000;
    updateContractUI();
}

export function startNewContract() {
    if (!findSpawnPointRelativeFn || !ContractBeaconCtor || !GateRingCtor) return;
    GameContext.contractSequence++;
    const pick = Math.random();
    const target = findSpawnPointRelativeFn(true, 6000, 9000);

    if (pick < 0.60) {
        const beacon = new ContractBeaconCtor(target.x, target.y, "SCAN BEACON");
        GameContext.contractEntities.beacons.push(beacon);
        GameContext.activeContract = {
            id: `C${GameContext.contractSequence}`,
            type: 'scan_beacon',
            state: 'travel',
            title: 'SCAN BEACON',
            target: { x: target.x, y: target.y },
            progress: 0,
            rewardNugs: 4 + Math.floor(Math.random() * 3),
            rewardScore: 7000
        };
        if (showOverlayMessageFn) showOverlayMessageFn("NEW CONTRACT: SCAN BEACON (STAY IN ZONE)", '#0f0', 2000, 2);
        if (playSoundFn) playSoundFn('contract');
    } else {
        const gateCount = 5;
        GameContext.contractEntities.gates = [];
        const dir = Math.random() * Math.PI * 2;
        for (let i = 0; i < gateCount; i++) {
            const d = 1800 + i * 1500;
            const a = dir + (Math.random() - 0.5) * 0.45;
            const gx = GameContext.player.pos.x + Math.cos(a) * d;
            const gy = GameContext.player.pos.y + Math.sin(a) * d;
            GameContext.contractEntities.gates.push(new GateRingCtor(gx, gy, i, gateCount));
        }
        GameContext.activeContract = {
            id: `C${GameContext.contractSequence}`,
            type: 'gate_run',
            state: 'active',
            title: 'GATE RUN',
            gateIndex: 0,
            gateCount,
            endsAt: Date.now() + 45000,
            rewardNugs: 6 + Math.floor(Math.random() * 4),
            rewardScore: 10000
        };
        if (showOverlayMessageFn) showOverlayMessageFn("NEW CONTRACT: GATE RUN", '#0f0', 2000, 2);
        if (playSoundFn) playSoundFn('contract');
    }
    updateContractUI();
}

export function updateContract(now, warpActive) {
    if (GameContext.gameMode !== 'normal' || !GameContext.gameActive || GameContext.gamePaused) return;
    if (GameContext.bossActive || warpActive || GameContext.dungeon1Active || GameContext.caveMode) return;

    if (!GameContext.activeContract && now >= GameContext.nextContractAt) {
        startNewContract();
    }

    if (GameContext.activeContract && GameContext.activeContract.type === 'gate_run') {
        if (Date.now() > GameContext.activeContract.endsAt) {
            completeContract(false);
        }
    }
}
