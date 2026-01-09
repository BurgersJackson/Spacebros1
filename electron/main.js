const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");

// Settings Persistence
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const defaultSettings = {
  width: 1920,      // DEPRECATED: kept for backwards compatibility
  height: 1080,      // DEPRECATED: kept for backwards compatibility
  internalResolution: { width: 1920, height: 1080 },  // Internal render resolution (absolute)
  fullscreen: false,
  frameless: false,
  vsync: true
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const loaded = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Migrate old width/height to internalResolution if needed
      if (!loaded.internalResolution && loaded.width && loaded.height) {
        loaded.internalResolution = { width: loaded.width, height: loaded.height };
      }
      return { ...defaultSettings, ...loaded };
    }
  } catch (e) { console.error("Failed to load settings:", e); }
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) { console.error("Failed to save settings:", e); }
}

// Cache Management
try {
  const cacheRoot = path.join(app.getPath("temp"), "spacebros-electron-cache");
  fs.mkdirSync(cacheRoot, { recursive: true });
  app.commandLine.appendSwitch("disk-cache-dir", path.join(cacheRoot, "disk"));
  app.commandLine.appendSwitch("gpu-cache-dir", path.join(cacheRoot, "gpu"));
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
} catch { }

if (process.env.ELECTRON_NO_GPU === "1") {
  app.disableHardwareAcceleration();
}

let mainWindow = null;

function createWindow() {
  const settings = loadSettings();

  // Apply vsync setting (disable vsync if setting is false)
  if (settings.vsync === false) {
    app.commandLine.appendSwitch('--disable-gpu-vsync');
  }

  const win = new BrowserWindow({
    width: settings.fullscreen ? undefined : settings.width,
    height: settings.fullscreen ? undefined : settings.height,
    fullscreen: settings.fullscreen,
    frame: !settings.frameless,
    backgroundColor: "#000000",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;

  if (process.env.ELECTRON_SMOKE !== "1") {
    win.once("ready-to-show", () => {
      win.show();
      // If purely windowed, center it. If fullscreen, it handles itself.
      if (!settings.fullscreen) win.center();
    });
  }

  win.loadFile(path.join(__dirname, "..", "index.html"));

  win.webContents.once("did-finish-load", () => {
    if (process.env.ELECTRON_SMOKE === "1") setTimeout(() => app.quit(), 250);
  });

  // Intercept window close to save game data before quitting
  win.on("close", (e) => {
    // Prevent immediate close
    e.preventDefault();
    // Send save request to renderer process
    win.webContents.send("app-before-quit");
    // Allow a short time for save to complete, then close
    setTimeout(() => {
      win.destroy(); // Force close after save attempt
    }, 500);
  });

  if (process.env.ELECTRON_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // IPC Handlers
  ipcMain.handle("app:get-settings", () => loadSettings());

  ipcMain.handle("app:save-settings", (event, newSettings) => {
    const current = loadSettings();
    saveSettings({ ...current, ...newSettings });
  });

  ipcMain.handle("app:set-resolution", (event, w, h) => {
    if (mainWindow && !mainWindow.isFullScreen()) {
      mainWindow.setSize(w, h);
      mainWindow.center();
    }
  });

  ipcMain.handle("app:set-fullscreen", (event, flag) => {
    if (mainWindow) mainWindow.setFullScreen(flag);
  });

  ipcMain.handle("app:relaunch", () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  // Internal resolution handlers
  ipcMain.handle("app:get-internal-resolution", () => {
    const settings = loadSettings();
    return settings.internalResolution || { width: 1920, height: 1080 };
  });

  ipcMain.handle("app:set-internal-resolution", (event, w, h) => {
    const settings = loadSettings();
    settings.internalResolution = { width: w, height: h };
    saveSettings(settings);

    // Notify renderer to update canvas scaling
    if (mainWindow) {
      mainWindow.webContents.send("internal-resolution-changed", { width: w, height: h });
    }
  });

  // Get all supported resolutions for the current display
  const { screen } = require('electron');
  ipcMain.handle("app:get-supported-resolutions", () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const resolutions = new Set();

      // Add common resolutions up to the display's native resolution
      const commonResolutions = [
        { width: 1280, height: 720 },
        { width: 1600, height: 900 },
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 3840, height: 2160 }
      ];

      // Add common resolutions that don't exceed display size
      for (const res of commonResolutions) {
        if (res.width <= primaryDisplay.size.width && res.height <= primaryDisplay.size.height) {
          resolutions.add(`${res.width}x${res.height}`);
        }
      }

      // Add the display's native resolution
      const native = primaryDisplay.size;
      resolutions.add(`${native.width}x${native.height}`);

      // Convert to array and sort by resolution (ascending)
      return Array.from(resolutions).map(resStr => {
        const [w, h] = resStr.split('x').map(Number);
        return { width: w, height: h };
      }).sort((a, b) => (a.width * a.height) - (b.width * b.height));
    } catch (e) {
      console.error("Failed to get supported resolutions:", e);
      // Return fallback resolutions
      return [
        { width: 1920, height: 1080 }
      ];
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
