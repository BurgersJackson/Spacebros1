# Save/Load System Update - Abort Confirmation Implementation

## Overview
Replace manual save/load with profile management system featuring:
- Visual profile cards with full game statistics
- Auto-save on death and quit (no popups)
- Abort run confirmation dialog when quitting to main menu
- Proper menu navigation between pause and start screens

---

## Changes Required

### 1. HTML Changes (index.html)

#### A. Update Start Screen
- Add current profile display: `<div id="current-profile-display">Current: None</div>`
- Replace "LOAD DATA" button with "SELECT PROFILE" button
- Remove "NEW PROFILE" button

#### B. Update Pause Menu
- Remove "SAVE GAME" button
- Remove "LOAD GAME" button
- Change "MAIN MENU" to "ABORT RUN"

#### C. Add Abort Modal
```html
<div id="abort-modal" class="menu-screen" style="display: none; width: 450px; padding: 30px; border-color: #ff0;">
    <h2 style="color: #ff0; margin-top: 0; font-family: 'Courier New', monospace;">ABORT RUN?</h2>
    <p style="color: #ccc; margin: 20px 0; line-height: 1.6;">Are you sure?</p>
    <div style="display: flex; gap: 20px; justify-content: center; margin-top: 25px;">
        <button id="abort-confirm">YES</button>
        <button id="abort-cancel">NO</button>
    </div>
</div>
```

#### D. Add CSS Styles
```css
#abort-confirm {
    border-color: #ff0;
    color: #ff0;
    min-width: 120px;
    font-weight: bold;
}
#abort-cancel {
    border-color: #0f0;
    min-width: 120px;
}
```

### 2. JavaScript Changes (src/js/main.js)

#### A. Add Global Variables
```javascript
let currentProfileName = null;
let selectedProfileName = null;
let totalKills = 0;
let highScore = 0;
let totalPlayTimeMs = 0;
let fromPauseMenu = false;
```

#### B. Add Confirmation Function
```javascript
function showAbortConfirmDialog() {
    return new Promise((resolve) => {
        const modal = document.getElementById('abort-modal');
        const confirmBtn = document.getElementById('abort-confirm');
        const cancelBtn = document.getElementById('abort-cancel');

        if (!modal || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        modal.style.display = 'block';

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onYes);
            cancelBtn.removeEventListener('click', onNo);
            window.removeEventListener('keydown', onEscape);
            modal.style.display = 'none';
        };

        const onYes = () => {
            cleanup();
            resolve(true);
        };

        const onNo = () => {
            cleanup();
            resolve(false);
        };

        const onEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onNo();
            }
        };

        confirmBtn.addEventListener('click', onYes);
        cancelBtn.addEventListener('click', onNo);
        window.addEventListener('keydown', onEscape);
    });
}
```

#### C. Add Profile Management Functions

**getProfileList()** - Returns sorted profiles with full details:
```javascript
function getProfileList() {
    const profiles = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_PREFIX)) {
            const raw = localStorage.getItem(k);
            try {
                const data = JSON.parse(raw);
                const name = k.replace(SAVE_PREFIX, '');
                const p = data.player || {};

                const storedHighScore = data.highScore || 0;
                const currentScore = data.score || 0;
                const effectiveHighScore = Math.max(storedHighScore, currentScore);

                profiles.push({
                    name: name,
                    level: p.level || 1,
                    xp: p.xp || 0,
                    nextXp: p.nextLevelXp || 100,
                    hp: p.hp || 100,
                    maxHp: p.maxHp || 100,
                    totalKills: data.totalKills || 0,
                    sectorIndex: data.sectorIndex || 1,
                    score: data.score || 0,
                    highScore: effectiveHighScore,
                    totalPlayTimeMs: data.totalPlayTimeMs || 0,
                    timestamp: data.lastSavedAt || data.timestamp || 0
                });
            } catch (e) {
                console.warn('Failed to parse profile', name, e);
            }
        }
    }
    return profiles.sort((a, b) => b.timestamp - a.timestamp);
}
```

**showSaveMenu()** - Displays profile cards:
```javascript
function showSaveMenu() {
    const menu = document.getElementById('save-menu');
    const listEl = document.getElementById('profile-list');

    const profiles = getProfileList();
    listEl.innerHTML = '';

    if (profiles.length === 0) {
        listEl.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No profiles found</div>';
    } else {
        profiles.forEach(p => {
            const date = new Date(p.timestamp);
            const timeStr = date.toLocaleString();
            const playTime = formatPlayTime(p.totalPlayTimeMs);

            const div = document.createElement('div');
            div.className = 'profile-item';
            div.dataset.name = p.name;
            div.innerHTML = `
                <div class="profile-item-name">${p.name}</div>
                <div class="profile-item-detail">Level ${p.level} • XP: ${p.xp}/${p.nextXp}</div>
                <div class="profile-item-detail">HP: ${p.hp}/${p.maxHp} • Kills: ${p.totalKills}</div>
                <div class="profile-item-detail">Sector ${p.sectorIndex} • Score: ${p.score}</div>
                <div class="profile-item-detail">High Score: ${p.highScore}</div>
                <div class="profile-item-detail">Play Time: ${playTime}</div>
                <div class="profile-item-last-saved">Last saved: ${timeStr}</div>
            `;
            div.addEventListener('click', () => {
                selectedProfileName = p.name;
                updateProfileSelectionVisuals();
            });
            listEl.appendChild(div);
        });
    }

    document.getElementById('create-new-profile').onclick = () => createNewProfile();
    document.getElementById('delete-profile').onclick = () => deleteSelectedProfile();
    document.getElementById('select-profile').onclick = () => {
        if (selectedProfileName) {
            selectProfile(selectedProfileName);
            menu.style.display = 'none';
        } else {
            showOverlayMessage("NO PROFILE SELECTED", '#f00', 1200);
        }
    };
    document.getElementById('close-save-menu').onclick = () => {
        menu.style.display = 'none';
        updateStartScreenDisplay();
    };

    menu.style.display = 'block';
    selectedProfileName = currentProfileName;
    updateProfileSelectionVisuals();

    menuSelectionIndex = 0;
    gpState.lastMenuElements = null;
}
```

**createNewProfile()** - Auto-generates unique name:
```javascript
function createNewProfile() {
    const existingProfiles = listSaveSlots();
    let counter = 1;
    let newName;
    do {
        newName = `profile${counter}`;
        counter++;
    } while (existingProfiles.includes(newName));

    const template = {
        version: 1,
        timestamp: Date.now(),
        lastSavedAt: Date.now(),
        score: 0,
        sectorIndex: 1,
        totalKills: 0,
        highScore: 0,
        totalPlayTimeMs: 0,
        player: null
    };

    try {
        localStorage.setItem(SAVE_PREFIX + newName, JSON.stringify(template));
    } catch (e) {
        showOverlayMessage("PROFILE CREATE FAILED", '#f00', 1500);
        return;
    }

    currentProfileName = newName;
    localStorage.setItem(SAVE_LAST_KEY, newName);
    showSaveMenu();
    updateStartScreenDisplay();
    showOverlayMessage(`CREATED: ${newName}`, '#0f0', 1200);
}
```

**deleteSelectedProfile()** - Removes profile with confirmation:
```javascript
async function deleteSelectedProfile() {
    if (!selectedProfileName) {
        showOverlayMessage("NO PROFILE SELECTED", '#f00', 1200);
        return;
    }

    const confirmed = await showAbortConfirmDialog();
    if (!confirmed) return;

    localStorage.removeItem(SAVE_PREFIX + selectedProfileName);
    if (currentProfileName === selectedProfileName) {
        currentProfileName = null;
        localStorage.removeItem(SAVE_LAST_KEY);
        updateStartScreenDisplay();
    }

    selectedProfileName = currentProfileName;
    showSaveMenu();
    showOverlayMessage("PROFILE DELETED", '#ff0', 1200);
}
```

**selectProfile()** - Sets profile as active:
```javascript
function selectProfile(name) {
    currentProfileName = name;
    localStorage.setItem(SAVE_LAST_KEY, name);
    updateStartScreenDisplay();
    showOverlayMessage(`SELECTED: ${name}`, '#ff0', 1200);
}
```

**updateProfileSelectionVisuals()** - Highlights selected profile:
```javascript
function updateProfileSelectionVisuals() {
    document.querySelectorAll('.profile-item').forEach(el => {
        if (el.dataset.name === selectedProfileName) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}
```

**updateStartScreenDisplay()** - Shows current profile:
```javascript
function updateStartScreenDisplay() {
    const el = document.getElementById('current-profile-display');
    if (el) {
        el.innerText = currentProfileName ? `Current: ${currentProfileName}` : 'Current: None';
    }
}
```

**formatPlayTime()** - Formats time display:
```javascript
function formatPlayTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
```

#### D. Modify Existing Functions

**buildProfileData()** - Add new fields:
- Add `lastSavedAt: Date.now()`
- Add `score: score`
- Add `sectorIndex: sectorIndex`
- Add `totalKills: totalKills`
- Add `highScore: highScore`
- Add `totalPlayTimeMs: totalPlayTimeMs`

**killPlayer()** - Replace save prompt with auto-save:
- Remove `await saveEndOfRun()`
- Add `if (currentProfileName) autoSaveToCurrentProfile();`

**quitGame()** - Update for abort confirmation:
- Set `fromPauseMenu = true` before showing start screen
- Change heading from "PAUSED" to "ABORTED"
- Change button text from "INITIATE LAUNCH" to "INITIATE LAUNCH"

**togglePause()** - Add return to pause menu:
- Add check at function start:
  ```javascript
  if (fromPauseMenu && gamePaused && document.getElementById('start-screen').style.display === 'block') {
      document.getElementById('start-screen').style.display = 'none';
      document.getElementById('pause-menu').style.display = 'block';
      document.getElementById('pause-menu').style.display = gamePaused ? 'none' : 'block';
      fromPauseMenu = false;
      return;
  }
  ```

**startGame()** - Load profile on startup:
- After `player = new Spaceship();`, load current profile data if available
- Restore `totalKills`, `highScore`, `totalPlayTimeMs`

**mainLoop()** - Track play time:
- Add `if (gameActive && !gamePaused) totalPlayTimeMs += frameDt;`

#### E. Remove Functions

Remove these entire functions (no longer needed):
- `promptForSlot()` - Replaced by save menu
- `saveGame()` - Replaced by auto-save on quit/death
- `saveEndOfRun()` - Replaced by auto-save

#### F. Update Event Listeners

Remove:
- `saveBtn` click handler
- `pauseLoadBtn` click handler

Update:
- `quit-btn` handler to call `showAbortConfirmDialog()`:
  ```javascript
  document.getElementById('quit-btn').addEventListener('click', async () => {
      const confirmed = await showAbortConfirmDialog();
      if (confirmed) {
          quitGame();
      }
  });
  ```

Add:
- `profileBtn` click handler:
  ```javascript
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
      profileBtn.addEventListener('click', () => {
          initAudio();
          showSaveMenu();
      });
  }
  ```

#### G. Update Gamepad Support

**getActiveMenuElements()** - Add save menu check:
```javascript
const saveMenu = document.getElementById('save-menu');
if (isVisible(saveMenu)) {
    return Array.from(document.querySelectorAll('.profile-item'));
}
```

**updateMenuVisuals()** - Handles profile item selection in save menu (already exists)

#### H. Initialization

Add at script end (before mainLoop()):
```javascript
currentProfileName = localStorage.getItem(SAVE_LAST_KEY) || null;
updateStartScreenDisplay();
```

---

## Menu Flow Summary

### Normal Pause
- Player presses Escape in-game → Shows pause menu (no save/load buttons)

### From Pause Menu
- Click "ABORT RUN" → Shows confirmation → YES → Auto-saves → Shows "ABORTED" on start screen
- Press Escape → Resumes game
- Press Escape from start screen → Returns to pause menu

### Fresh Start
- Click "INITIATE LAUNCH" → Sets `fromPauseMenu = false`
- Escape in start screen does nothing (no previous menu)

### Profile Selection
- Click "SELECT PROFILE" → Shows profile cards with details
- Click profile card → Selects as current, shows message
- Click "CREATE NEW" → Generates unique name, saves template
- Click "DELETE SELECTED" → Shows confirmation, removes profile

---

## Profile Card Display Format

Each card shows:
```
profile3
─────────────────────────────────────
Level 5 • XP: 450/1000
HP: 45/60 • Kills: 847
Sector 2 • Score: 12,340
High Score: 15,420
Play Time: 1h 23m
─────────────────────────────────────
Last saved: Jan 5, 2026 3:45 PM
```

---

## Auto-Save Behavior

**On Death:**
- Auto-saves to `currentProfileName` (if set)
- No popup dialog
- Game ends normally

**On Quit to Menu:**
- Shows confirmation dialog
- If YES: Auto-saves, sets `fromPauseMenu = true`, shows start screen
- If NO: Returns to pause menu

**On Quit to Desktop:**
- Quits entire application directly

---

## Testing Checklist

- [ ] Save menu displays all profiles in cards
- [ ] Profiles sorted by newest first
- [ ] Profile details display correctly
- [ ] Create New Profile generates unique names (profile1, profile2...)
- [ ] Select Profile sets current profile
- [ ] Delete Profile shows confirmation
- [ ] Delete Profile updates UI correctly
- [ ] Current profile displays on start screen
- [ ] Abort confirmation dialog shows YES/NO
- [ ] Auto-save works on death (no popup)
- [ ] Auto-save works on quit with confirmation
- [ ] Pause menu shows abort/run (no save/load)
- [ ] Return to pause menu from start screen (Escape key)
- [ ] Fresh start resets `fromPauseMenu`
- [ ] Gamepad navigation works in save menu
- [ ] Kill tracking accumulates across runs
- [ ] High score updates correctly
- [ ] Play time tracks correctly
- [ ] All kill tracking added to enemy deaths

---

## Key Implementation Notes

1. **Profile Naming**: Auto-generated (profile1, profile2, profile3...)
2. **Profile Limit**: Unlimited (limited only by localStorage)
3. **Auto-Save**: Silent (no overlay messages)
4. **Abort Confirmation**: Dedicated modal with YES/NO buttons
5. **Menu Navigation**: Proper state tracking with `fromPauseMenu` flag
6. **Statistics**: Kills, High Score, Play Time tracked and displayed
7. **Sorting**: Profiles sorted by `timestamp` (newest first)
8. **Confirmation Dialog**: Reuses `prompt-modal` structure temporarily
9. **Layout**: Single-column profile list as requested

---

## Warp Boss Fixes

### Issues Fixed

#### 1. Warp Boss Self-Damage from Shockwaves
**Problem**: Warp Sentinel Boss creates shockwaves that damage itself
**Solution**: Add `ignoreEntity: this` parameter when creating shockwaves
**Files Modified**:
- `src/js/main.js` (Shockwave constructor, dash shockwave creation, scream shockwave creation)
**Changes**:
- Dash shockwave (line ~10453): `new Shockwave(..., { ignoreEntity: this })`
- Scream shockwave (line ~10556): `new Shockwave(..., { ignoreEntity: this })`

#### 2. Shockwave Projectile Speed and Size Reduction
**Problem**: Shockwave projectiles too fast/small
**Solution**: Reduce speed by 50%, increase size by 50%
**Files Modified**:
- `src/js/main.js` (Shockwave creation calls, Shockwave.draw projectile rendering)
**Changes**:
- Dash shockwave speed: `travelSpeed: 12` (down from 24)
- Scream shockwave speed: `travelSpeed: 12` (down from 24)
- Projectile size: Fill radius 12 (up from 8), outline radius 18 (up from 12)

#### 3. Remove Sound Loop
**Problem**: `warp_flame_start` sound loops continuously
**Solution**: Change to play once and auto-stop
**Files Modified**:
- `src/js/audio/audio-manager.js` (warp_flame_start case)
**Changes**:
- Stop oscillator and noise after 0.8 seconds
- Remove from `sfxLoops.warp_flame_loop` tracking
- Change `warp_flame_stop` to empty function

#### 4. Asteroid Spawning During Boss Fight
**Problem**: No asteroids spawn during warp boss fight
**Solution**: Remove `!bossActive` check from asteroid spawn logic
**Files Modified**:
- `src/js/main.js` (mainLoop asteroid spawning section)
**Changes**:
- Line ~16530: Remove `!bossActive` from condition
- Change from `else if (warpZone && warpZone.active && !bossActive)` to `else if (warpZone && warpZone.active)`

---

## Testing Checklist - Warp Boss

- [ ] Warp boss no longer takes damage from its own shockwaves
- [ ] Dash shockwave travels at reduced speed (12)
- [ ] Scream shockwave travels at reduced speed (12)
- [ ] Shockwave projectiles are larger (radius 12/18)
- [ ] Warp flame breath sound plays once (0.8 seconds) without looping
- [ ] Asteroids continue spawning during warp boss fight
- [ ] Shockwaves still explode properly at destination
- [ ] All warp boss abilities function correctly after changes

---

## Testing Checklist

- [ ] Save menu displays all profiles in cards
- [ ] Profiles sorted by newest first
- [ ] Profile details display correctly
- [ ] Create New Profile generates unique names (profile1, profile2...)
- [ ] Select Profile sets current profile
- [ ] Delete Profile shows confirmation
- [ ] Delete Profile updates UI correctly
- [ ] Current profile displays on start screen
- [ ] Abort confirmation dialog shows YES/NO
- [ ] Auto-save works on death (no popup)
- [ ] Auto-save works on quit with confirmation
- [ ] Pause menu shows abort/run (no save/load)
- [ ] Return to pause menu from start screen (Escape key)
- [ ] Fresh start resets `fromPauseMenu`
- [ ] Gamepad navigation works in save menu
- [ ] Kill tracking accumulates across runs
- [ ] High score updates correctly
- [ ] Play time tracks correctly
- [ ] All kill tracking added to enemy deaths
