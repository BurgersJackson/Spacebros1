const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("SpacebrosApp", {
  platform: process.platform,
  ipcRenderer: {
    on: (channel, callback) => {
      // Deliberately strip event as it includes `sender`
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
    },
    once: (channel, callback) => {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.once(channel, subscription);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('app:get-settings'),
    save: (s) => ipcRenderer.invoke('app:save-settings', s),
    setResolution: (w, h) => ipcRenderer.invoke('app:set-resolution', w, h),
    setFullscreen: (f) => ipcRenderer.invoke('app:set-fullscreen', f),
    getInternalResolution: () => ipcRenderer.invoke('app:get-internal-resolution'),
    setInternalResolution: (w, h) => ipcRenderer.invoke('app:set-internal-resolution', w, h),
    getSupportedResolutions: () => ipcRenderer.invoke('app:get-supported-resolutions'),
    relaunch: () => ipcRenderer.invoke('app:relaunch'),
    quit: () => ipcRenderer.invoke('app:quit')
  }
});

