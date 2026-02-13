/**
 * CaveGunboat2.js
 * Cave-specific gunboat variant (level 2).
 * Extends Gunboat to inherit difficulty tier system and base functionality.
 */

import { Gunboat } from "../enemies/Gunboat.js";

export class CaveGunboat2 extends Gunboat {
  constructor(x, y, opts = {}) {
    // Call parent constructor with level 2
    super(x, y, 2, opts);
    // Override type to identify as cave variant
    this.type = "cave_gunboat2";
  }
}
