const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("SpacebrosApp", {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('app:get-settings'),
    save: (s) => ipcRenderer.invoke('app:save-settings', s),
    setResolution: (w, h) => ipcRenderer.invoke('app:set-resolution', w, h),
    setFullscreen: (f) => ipcRenderer.invoke('app:set-fullscreen', f),
    relaunch: () => ipcRenderer.invoke('app:relaunch'),
    quit: () => ipcRenderer.invoke('app:quit')
  }
});

