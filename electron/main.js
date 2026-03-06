const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'EEG EDF Reader',
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // Load static exported Next.js
    const indexPath = path.join(__dirname, '..', 'out', 'index.html');
    win.loadFile(indexPath);
  }

  // Build application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open EDF File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              title: 'Open EDF/BDF File',
              filters: [
                { name: 'EEG Files', extensions: ['edf', 'bdf'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              try {
                const data = fs.readFileSync(filePath);
                win.webContents.send('file-opened', {
                  name: path.basename(filePath),
                  path: filePath,
                  buffer: Array.from(data),
                });
              } catch (err) {
                dialog.showErrorBox('Error', `Failed to read file: ${err.message}`);
              }
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EEG EDF Reader',
          click: () => {
            dialog.showMessageBox(win, {
              title: 'About EEG EDF Reader',
              message: 'EEG EDF Reader v1.0.0',
              detail:
                'A standalone EEG EDF/BDF file viewer with:\n' +
                '• Artifact cancellation (bandpass + notch filter)\n' +
                '• Eye movement recognition (blinks & saccades)\n' +
                '• Multi-channel visualization\n' +
                '• PDF report generation\n\n' +
                'Supports EDF and BDF format files.',
              type: 'info',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC: open file via dialog (triggered from renderer)
ipcMain.handle('open-file-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open EDF/BDF File',
    filters: [
      { name: 'EEG Files', extensions: ['edf', 'bdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const data = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      buffer: Array.from(data),
    };
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: save file (for PDF report export)
ipcMain.handle('save-file-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath || 'report.pdf',
    filters: options.filters || [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return null;

  return result.filePath;
});

// IPC: write bytes to file
ipcMain.handle('write-file', async (event, { filePath, data }) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
