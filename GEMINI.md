# Spacebros (Neon Space Cave)

## Project Overview

This project is a desktop game called "Neon Space Cave" (internally "Spacebros"), wrapped in Electron. It combines web technologies (HTML, CSS, JavaScript) with game libraries like Phaser and PixiJS to deliver a retro-style space shooter experience.

### Key Technologies

*   **Electron:** Wraps the web application for desktop deployment.
*   **Phaser:** Primary game framework (loaded via `node_modules` or CDN).
*   **PixiJS:** Used for high-performance sprite rendering (bullets, particles).
*   **Vanilla JavaScript (ES6 Modules):** Core game logic found in `src/js`.
*   **HTML/CSS:** Handles the game container, UI overlays (HUD, menus), and styling.

### Architecture

The application follows a standard Electron structure:
*   **Main Process:** Managed by `electron/main.js`, responsible for creating the application window and handling system events.
*   **Renderer Process:** The game itself, running in the window created by the main process. It starts from `index.html` and loads the main game logic from `src/js/main.js`.

## Building and Running

The project uses `npm` for dependency management and script execution.

### Prerequisites

*   Node.js and npm installed.

### Commands

*   **Install Dependencies:**
    ```bash
    npm install
    ```
    *Note: On Windows PowerShell, if `npm` is blocked, try using `npm.cmd`.*

*   **Run in Development Mode:**
    ```bash
    npm start
    ```
    This launches the Electron application.

*   **Run with DevTools:**
    ```bash
    npm run start:dev
    ```
    Launches the app with Chrome DevTools open for debugging.

*   **Build Windows Installer:**
    ```bash
    npm run dist:win
    ```
    Creates a distribution build for Windows using `electron-builder`.

## Directory Structure

*   **`electron/`**: Contains the Electron main process code (`main.js`).
*   **`src/`**: Source code for the game logic and styles.
    *   **`js/`**: JavaScript modules for the game (entry point `main.js`).
    *   **`css/`**: Stylesheets.
*   **`assets/`**: Game assets (images, audio, etc.).
*   **`index.html`**: The main entry HTML file for the game window.
*   **`scripts/`**: Utility scripts for build/run processes (e.g., `start-electron.js`).

## Development Conventions

*   **ES6 Modules:** The game logic is structured using standard ES6 modules (`import`/`export`).
*   **Hybrid Rendering:** The game appears to use a mix of HTML5 Canvas (`#gameCanvas`) and DOM elements for UI (`#ui-layer`). PixiJS is explicitly imported for particle/sprite optimization.
*   **Phaser Loading:** Phaser is loaded dynamically in `index.html` with a fallback to CDN if the local node module is missing.

### Physics & Timing System

*   **Decoupled Loop:** The game uses a fixed-timestep physics simulation running at **120Hz** (`PHYSICS_FPS`), decoupled from the variable rendering rate (RAF). This ensures consistent gameplay speed regardless of the monitor's refresh rate (60Hz, 144Hz, etc.).
*   **VSync Optimization:** 120Hz was chosen specifically to resolve "VSync Aliasing" on Linux compositors. Smaller physics steps (8.33ms) prevent missed updates during tiny frame-time fluctuations that cause stuttering in strict 60Hz loops.
*   **Time Scaling:** All entity `update(deltaTime)` methods must normalize logic to a **60Hz reference frame** using `const dtScale = deltaTime / 16.67`.
*   **Interpolation:** The game calculates `renderAlpha` (the remainder of simulation time) to interpolate object positions between physics ticks, providing visually perfect smoothness on high-Hz displays.
*   **Safe Defaults:** Always use `SIM_STEP_MS` as the default parameter for `update(deltaTime)` to ensure correct behavior when methods are called without explicit timing (e.g., in cleanup or effect loops).

Make sure to read the CLAUDE.md file to see how the game is made