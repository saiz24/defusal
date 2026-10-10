/* MATHEMATICKS — desktop shell.

   This wrapper owns a window and nothing else. The game in ../ is untouched
   and still runs by double-clicking index.html; Electron simply loads the same
   files from disk, so there is exactly one copy of the game to maintain and no
   build step is introduced into it.

   Everything is off by default that does not need to be on: no Node in the
   page, context isolation on, no remote content, no new windows. The game asks
   the network for nothing, so navigation away from the bundled files is
   refused outright rather than trusted not to happen. */

const { app, BrowserWindow, Menu, shell, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/* In development the game sits one level up, beside this folder. Once packaged
   it is copied into the app's resources, so the two cases resolve differently. */
const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');
const INDEX = path.join(GAME_DIR, 'index.html');
/* The printed manual, for PRINTED mode. The game itself never opens it — the
   on-screen manual is typeset in the page — but the Expert's copy has to come
   from somewhere, and a packaged app with no way to reach it is a game that
   cannot be played its best way. */
const MANUAL_PDF = path.join(GAME_DIR, 'manual', 'manual.pdf');

let win = null;
const isMac = process.platform === 'darwin';

/* Where the window was and how big, so the game opens where it was left.
   Kept in the app's own data folder beside the game's saved progress. */
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'window.json');

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(BOUNDS_FILE(), 'utf8'));
    /* only if it still lands on a display that is plugged in */
    const onScreen = screen.getAllDisplays().some(d => {
      const a = d.workArea;
      return b.x >= a.x - 40 && b.y >= a.y - 40 &&
             b.x + 200 <= a.x + a.width && b.y + 100 <= a.y + a.height;
    });
    if (onScreen && b.width >= 900 && b.height >= 600) return b;
  } catch (e) { /* first run, or unreadable: fall back to the default size */ }
  return null;
}

function saveBounds() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    b.fullScreen = win.isFullScreen();
    b.maximized = win.isMaximized();
    fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(b));
  } catch (e) { /* not worth stopping a quit over */ }
}

function createWindow() {
  /* The casing is laid out at 1724x938 and scaled to fit, so open near that
     when the display allows and fall back gracefully on a small laptop. */
  const area = screen.getPrimaryDisplay().workAreaSize;
  const saved = loadBounds();
  const width = saved ? saved.width : Math.min(1440, Math.max(1024, area.width - 80));
  const height = saved ? saved.height : Math.min(900, Math.max(640, area.height - 80));

  win = new BrowserWindow({
    width,
    height,
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 900,
    minHeight: 600,
    /* black, like the splash the game opens on, so launching is one fade */
    backgroundColor: '#000000',
    title: 'MATHEMATICKS',
    show: false,
    autoHideMenuBar: true,
    /* No title bar: the game is drawn edge to edge, and a strip along its
       top drags the window. The Mac keeps its three lights, inset; Windows
       and Linux keep the system's own buttons, drawn over the corner. */
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } }
              : { titleBarOverlay: { color: '#00000000', symbolColor: '#cfe0e7', height: 32 } }),
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
  win.once('ready-to-show', () => {
    if (saved && saved.maximized) win.maximize();
    if (saved && saved.fullScreen) win.setFullScreen(true);
    win.show();
  });
  /* saved as it changes, not only on close: QUIT on the game's own menu
     closes the window from the page, and that path skips 'close' */
  let pending = null;
  const later = () => { clearTimeout(pending); pending = setTimeout(saveBounds, 400); };
  ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']
    .forEach(ev => win.on(ev, later));
  win.on('close', saveBounds);

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

/* A game, not a document app: closing its window (or QUIT on its main
   menu) ends it on every platform, rather than leaving it in the Mac's Dock
   with nothing open. */
app.on('window-all-closed', () => app.quit());

app.setAboutPanelOptions({
  applicationName: 'MATHEMATICKS',
  applicationVersion: app.getVersion(),
  version: '',
  copyright: 'A two-player co-op mathematics game.'
});

/* ---------------------------------------------------------------------------
   Menu. Kept deliberately thin: fullscreen and reload are genuinely useful
   during a session, the rest is noise on top of a game.
   ------------------------------------------------------------------------- */
/* Hands the PDF to whatever the machine already uses to read and print one.
   Opening it in our own window would mean shipping a PDF viewer, and every
   desktop this runs on has a better one than we would write. */
function openPrintedManual() {
  if (!fs.existsSync(MANUAL_PDF)) {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'The printed manual',
      message: 'manual/manual.pdf is not in this build.',
      detail: 'Run tools/make-manual-pdf.sh in the game folder and build again.'
    });
    return;
  }
  shell.openPath(MANUAL_PDF);
}

function buildMenu() {
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
        {
          label: 'Open the printed manual\u2026',
          accelerator: 'CmdOrCtrl+M',
          click: openPrintedManual
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
