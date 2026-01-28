/**
 * Gunboat2.js
 * Level 2 gunboat variant with higher HP and faster fire rate.
 * Extends Gunboat to inherit difficulty tier system and base functionality.
 */

import { Gunboat } from "./Gunboat.js";

export class Gunboat2 extends Gunboat {
  constructor(x, y, opts = {}) {
    // Call parent constructor with level 2
    super(x, y, 2, opts);
    // Override type to identify as level 2 variant
    this.type = "gunboat2";
  }
}
