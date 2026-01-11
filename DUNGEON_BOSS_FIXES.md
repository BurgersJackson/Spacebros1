# Fix Summary: Dungeon Boss Movement

The movement logic for all 6 Dungeon Boss classes has been updated to match the behavior of the `Cruiser` class.

## Changes Applied

For each of the following classes in `src/js/main.js`:
- `NecroticHive`
- `CerebralPsion`
- `Fleshforge`
- `VortexMatriarch`
- `ChitinusPrime`
- `PsyLich`

The following changes were made:
1.  **Added `updateAIState()` Override:**
    - Prevents the base `Enemy` class from randomly switching AI states (`aiTimer = 999999`).
    - Allows the boss `update()` method to fully control movement modes.

2.  **Updated `update()` Method:**
    - Removed the code that disabled AI movement (`thrustPower = 0`, `Entity.prototype.update.call(this)`).
    - Implemented the `Cruiser` movement state machine:
        - **States:** `CIRCLE`, `ORBIT`, `SEEK`, `FLANK`.
        - **Logic:** Alternates between states based on distance to player and random timers.
    - Added specific `charging` phase logic where applicable (e.g., `NecroticHive`'s `FRENZY`, `ChitinusPrime`'s `RAMPAGE`) to trigger aggressive seeking.
    - Called `super.update(deltaTime)` to ensure standard physics and steering forces are applied.

## verification
- **Syntax Check:** Passed (Braces balanced).
- **Logic:** Aligned with `Cruiser` class implementation.
