const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("SpacebrosApp", {
  platform: process.platform
});

