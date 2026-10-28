import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#030712',
    title: 'F.R.I.D.A.Y. – The Trading Desk',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  const devUrl = 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      setTimeout(() => mainWindow.loadURL(devUrl), 1500);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('system:getInfo', async () => {
  return {
    version: '1.0.0-phase1',
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    platform: process.platform,
    isDev: !app.isPackaged
  };
});

ipcMain.handle('desk:command', async (_event, command) => {
  console.log('[MAIN IPC] Received desk command:', command);
  // Phase 1: Echo and dispatch mock desk reaction
  return {
    status: 'ok',
    echo: command,
    timestamp: new Date().toISOString(),
    message: `Phase 1 Desk Command registered: "${command}". Routing engine initializes in Phase 2.`
  };
});

ipcMain.handle('voice:toggleMic', async (_event, listening) => {
  return { listening, status: 'ready' };
});

ipcMain.handle('voice:speak', async (_event, { agentId, text }) => {
  console.log(`[TTS IPC] Agent ${agentId} requesting to speak: "${text}"`);
  return { status: 'queued', agentId };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
