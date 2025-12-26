# Spacebros Project Map

This document maps the file structure of the Spacebros project, describing the purpose of each file and directory to assist with future development and fixes.

## Root Directory
| File | Purpose |
| :--- | :--- |
| `index.html` | **Entry Point**. The main HTML file that loads the game. Contains the UI overlay (HUD, menus) and loads `src/js/main.js`. |
| `package.json` | Project configuration, dependencies (Electron, Phaser), and build scripts (`npm start`, `npm run dist`). |
| `package-lock.json` | Exact version locks for npm dependencies. |
| `README.md` | Basic project documentation. |

## Source Code (`src/js`)
The core game logic lives here.

| File | Purpose |
| :--- | :--- |
| `main.js` | **Main Game Loop**. Contains the monolithic game logic, initialization, update/draw loops, input handling, and state management. Currently being modularized. |
| `entities.js` | **Legacy/Unused**. Contains older inline class definitions. Most have been moved to `entities/` module. |
| `index.js` | **Module Index**. A barrel file exporting core modules. Not currently used by `index.html` but useful for future architecture. |
| `utils.js` | **Utilities**. Generic helper functions (math, random, etc.). Some functionality may overlap with `core/math.js`. |
| `pixi-utils.js` | **PixiJS Helpers**. Utilities for managing PixiJS sprites and resources. |
| `world.js` | **World Logic**. Likely contains world generation or management logic (possibly unused/legacy). |

### Core (`src/js/core`)
Fundamental data structures and constants.
| File | Purpose |
| :--- | :--- |
| `constants.js` | **Game Constants**. Configuration for physics, graphics (`ZOOM_LEVEL`), audio, and gameplay balance. |
| `math.js` | **Math Library**. Defines `Vector` class and `SpatialHash` for collision detection. |
| `state.js` | **Game State**. Manages global game state (score, flags, etc.). |
| `index.js` | Module index for Core. |

### Entities (`src/js/entities`)
Game object definitions.
| File | Purpose |
| :--- | :--- |
| `index.js` | **Entities Index**. Central export point for all game entities. |
| `Entity.js` | **Base Class**. The parent class for all interactive game objects (`pos`, `vel`, `update`, `draw`). |
| `FloatingText.js` | **UI Effect**. Class for damage numbers and pickup labels. |
| **Pickups** | |
| ├ `pickups/Coin.js` | Standard currency pickup. |
| ├ `pickups/SpaceNugget.js` | Premium currency pickup (magnetized). |
| ├ `pickups/HealthPowerUp.js` | Health restoration pickup. |
| ├ `pickups/index.js` | Export index for pickups. |
| **Particles** | |
| ├ `particles/Particle.js` | Base `Particle` class plus `SmokeParticle`. |
| ├ `particles/Explosion.js` | Explosion effect logic. |
| ├ `particles/index.js` | Export index for particles. |
| **Projectiles** | |
| └ `projectiles/index.js` | Export index for projectiles (check for specific classes). |

### Rendering (`src/js/rendering`)
Graphics and visual systems.
| File | Purpose |
| :--- | :--- |
| `colors.js` | **Color Utils**. Functions for converting/manipulating colors (e.g., `colorToPixi`). |
| `sprite-pools.js` | **Pooling**. Object pooling system for PixiJS sprites to optimize performance. |
| `pixi-setup.js` | **Setup**. Intitialization code for the PixiJS renderer. |
| `index.js` | Module index for Rendering. |

### Audio (`src/js/audio`)
Sound management.
| File | Purpose |
| :--- | :--- |
| `audio-manager.js` | **Audio Engine**. Handles music, SFX, potential volume control, and audio context. |
| `index.js` | Module index for Audio. |

## Electron (`electron`)
Desktop application wrapper.
| File | Purpose |
| :--- | :--- |
| `main.js` | **Main Process**. Electron entry point that creates the browser window and loads `index.html`. |
| `preload.js` | **Preload Script**. Bridge between Node.js and the renderer process (security sandbox). |

## Directories
| Directory | Purpose |
| :--- | :--- |
| `assets` | Contains images, sounds, and other binary assets. |
| `scripts` | Build and utility scripts (e.g., `start-electron.js` for launching the dev environment). |
| `node_modules` | Installed npm dependencies. |

---
**Note:** `.tmp` files found in the root directory are temporary artifacts from development tools and can be safely deleted.
