const { app, BrowserWindow } = require('electron');
const serve = require('electron-serve');
const path = require('path');

const loadURL = serve({ directory: 'dist' });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: '2026 线性日历',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'), // 可选：替换为你的应用图标
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  loadURL(mainWindow);
  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});