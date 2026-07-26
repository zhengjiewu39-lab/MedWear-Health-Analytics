const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('medwearDesktop', {
  platform: process.platform,
  version: '0.1.0',
});
