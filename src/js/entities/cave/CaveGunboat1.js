/**
 * CaveGunboat1.js
 * Cave-specific gunboat variant (level 1).
 * Extends Gunboat to inherit difficulty tier system and base functionality.
 */

import { Gunboat } from '../enemies/Gunboat.js';

export class CaveGunboat1 extends Gunboat {
    constructor(x, y, opts = {}) {
        // Call parent constructor with level 1
        super(x, y, 1, opts);
        // Override type to identify as cave variant
        this.type = 'cave_gunboat1';
    }
}
