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
Make sure to read the CLAUDE.md file to see how the game is made