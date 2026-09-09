/* MATHEMATICKS — desktop shell.

   This wrapper owns a window and nothing else. The game in ../ is untouched
   and still runs by double-clicking index.html; Electron simply loads the same
   files from disk, so there is exactly one copy of the game to maintain and no
   build step is introduced into it.

   Everything is off by default that does not need to be on: no Node in the
   page, context isolation on, no remote content, no new windows. The game asks
   the network for nothing, so navigation away from the bundled files is
   refused outright rather than trusted not to happen. */

const { app, BrowserWindow, Menu, shell, screen } = require('electron');
const path = require('path');

/* In development the game sits one level up, beside this folder. Once packaged
   it is copied into the app's resources, so the two cases resolve differently. */
const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');
const INDEX = path.join(GAME_DIR, 'index.html');

let win = null;

function createWindow() {
  /* The casing is laid out at 1724x938 and scaled to fit, so open near that
     when the display allows and fall back gracefully on a small laptop. */
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1440, Math.max(1024, area.width - 80));
  const height = Math.min(900, Math.max(640, area.height - 80));

  win = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1115',
    title: 'MATHEMATICKS',
    show: false,
    autoHideMenuBar: true,
    icon: process.platform === 'linux'
      ? path.join(__dirname, 'build', 'icon.png')
      : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  /* Avoid the white flash while the first paint happens. */
  win.once('ready-to-show', () => win.show());

  win.loadFile(INDEX);

  /* The game never opens a window or navigates anywhere. Anything that tries
     is either a mistake or something we did not write, so send real links to
     the system browser and refuse the rest. */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  win.on('closed', () => { win = null; });
}

/* A single instance. Launching again focuses the window that already exists
   rather than starting a second bomb. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------------------------------------------------------------------------
   Menu. Kept deliberately thin: fullscreen and reload are genuinely useful
   during a session, the rest is noise on top of a game.
   ------------------------------------------------------------------------- */
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Game',
      submenu: [
        {
          label: 'Restart',
          accelerator: 'CmdOrCtrl+R',
          click: () => { if (win) win.reload(); }
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
