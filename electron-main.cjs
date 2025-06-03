const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Optional: for more secure IPC
      nodeIntegration: false, // Recommended: keep false for security
      contextIsolation: true, // Recommended: true for security
    }
  });

  // Load your Vite app's index.html (from the dist folder)
  // mainWindow.loadFile('dist/index.html');
  // For development with Vite dev server, you might use:
  // mainWindow.loadURL('http://localhost:5173'); // Adjust port if needed
  // For a production build:
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  // Open the DevTools (optional)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Optional: Create a preload.js if you need to expose Node.js APIs to your renderer securely
// For now, we can skip this, but if you need it:
// const fs = require('fs');
// fs.writeFileSync(path.join(__dirname, 'preload.js'), '// Preload script here'); 