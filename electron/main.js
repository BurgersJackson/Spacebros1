const path = require("path");
const fs = require("fs");
const { app, BrowserWindow } = require("electron");

// Some Windows setups (e.g. locked-down profiles / sync tools) can prevent Chromium from creating/migrating
// its GPU/Disk cache in the default location, which results in noisy "Unable to move the cache" errors.
// Keep `userData` unchanged (so localStorage/saves persist), but move caches to a guaranteed-writable temp dir.
try {
  const cacheRoot = path.join(app.getPath("temp"), "spacebros-electron-cache");
  fs.mkdirSync(cacheRoot, { recursive: true });
  app.commandLine.appendSwitch("disk-cache-dir", path.join(cacheRoot, "disk"));
  app.commandLine.appendSwitch("gpu-cache-dir", path.join(cacheRoot, "gpu"));
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
} catch {
  // If this fails, Electron will fall back to its defaults.
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_SMOKE !== "1") {
    win.once("ready-to-show", () => {
      win.maximize();
      win.show();
    });
  }

  win.loadFile(path.join(__dirname, "..", "index.html"));

  win.webContents.once("did-finish-load", () => {
    if (process.env.ELECTRON_SMOKE === "1") setTimeout(() => app.quit(), 250);
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
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
