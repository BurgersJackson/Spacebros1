import { FlagshipGuidedMissile } from './FlagshipGuidedMissile.js';

export class Destroyer2GuidedMissile extends FlagshipGuidedMissile {
    constructor(owner) {
        super(owner);
        this.radius = Math.max(1, this.radius * 2);
        this.hp = Math.max(1, this.hp * 2);
        this.maxHp = this.hp;
    }
}
