
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 450,
    height: 750,
    resizable: false, // Keep the PICO-8 aspect ratio locked
    title: "PULSE: One Click Jump and Shoot",
    icon: path.join(__dirname, 'icon.ico'), // Optional icon
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // In production, we load the built index.html
  // For development, you can load your local server URL
  win.loadFile('index.html');
  
  // Hide the menu bar for a clean game look
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
