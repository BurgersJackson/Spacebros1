const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");

// Settings Persistence
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const defaultSettings = { width: 1280, height: 720, fullscreen: false, frameless: false, vsync: true };

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
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
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
