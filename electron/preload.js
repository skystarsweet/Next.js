const { contextBridge, ipcRenderer } = require('electron');

// Expose safe Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Open EDF file via native dialog
  openFile: () => ipcRenderer.invoke('open-file-dialog'),

  // Save a file via native save dialog
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

  // Write bytes to a file path
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', { filePath, data }),

  // Listen for file-opened event from menu
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (_event, fileData) => callback(fileData));
  },

  // Remove file-opened listener
  offFileOpened: (callback) => {
    ipcRenderer.removeListener('file-opened', callback);
  },
});
