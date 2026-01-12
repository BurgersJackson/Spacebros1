
import { CaveMonster1 } from './CaveMonster1.js';
import { CaveMonster2 } from './CaveMonster2.js';
import { CaveMonster3 } from './CaveMonster3.js';

export function createCaveMonsterBoss(x, y, level = 1) {
    // Round robin or random, but let's stick to the level logic if it maps to type
    // In main.js it was:
    // startCaveSector2 calls createCaveMonsterBoss(x, y, 1 + Math.floor(bossesDefeated % 3))

    // Actually, createCaveMonsterBoss logic in main.js
    /* 
    function createCaveMonsterBoss(x, y) {
        // ... logic ...
    }
    */
    // Wait, main.js didn't have a factory function, it just instantiated CaveMonster1/2/3?
    // Let's check main.js usage.

    if (level === 1) return new CaveMonster1(x, y);
    if (level === 2) return new CaveMonster2(x, y);
    if (level === 3) return new CaveMonster3(x, y);
    return new CaveMonster1(x, y);
}
