# MATHEMATICKS — desktop app

This folder turns the game into a real desktop program with its own window and
icon: a `.exe` installer on Windows, a `.dmg` on macOS, an `.AppImage` on Linux.

**The game itself is untouched.** Everything in the folder above still runs by
double-clicking `index.html`, and still has no build step. This wrapper only
opens a window and loads those same files, so there is one copy of the game to
maintain, not two.

## Building

You need [Node.js](https://nodejs.org) 18 or newer. From inside this folder:

```
npm install          # once, downloads Electron (~100 MB)
npm start            # run the app without packaging, to check it works
npm run dist         # build an installer for the machine you are on
```

The finished installer appears in `desktop/dist/`.

## Which machine builds which installer

This is the part that catches people out. **You can only build a macOS `.dmg`
on a Mac, and a Windows `.exe` on Windows.** The packaging tools have to run
the target platform's own code-signing and disk-image utilities, so there is no
way around it.

| To produce | Run this | On |
|---|---|---|
| `.exe` installer | `npm run dist:win` | Windows |
| `.dmg` disk image | `npm run dist:mac` | macOS |
| `.AppImage` | `npm run dist:linux` | Linux |

If your team has both a Windows machine and a Mac, run the matching command on
each and you will have both installers. If you only have one, build for that
platform — a judge opening the game on the machine you bring will not know or
care that the other installer does not exist.

## Unsigned builds

These installers are not code-signed, because signing certificates cost money
and are issued to registered organisations. The apps work perfectly; the
operating system simply shows a warning the first time.

- **Windows:** SmartScreen says the publisher is unknown. Click *More info*,
  then *Run anyway*.
- **macOS:** Gatekeeper refuses to open it. Right-click the app and choose
  *Open*, then *Open* again in the dialog. Only needed once.

Worth knowing before a demonstration, so it does not surprise you in front of
judges. **Install and launch it once on the presentation machine beforehand.**

## What the wrapper does

`main.js` is deliberately small:

- Opens one window sized to the display, minimum 900×600, and shows it only
  once the first frame is painted. Its background is black, like the splash
  the game opens on, so launching is one fade rather than a flash.
- **No title bar.** The game is drawn edge to edge. A 30 px strip along the
  top drags the window; every button, key and module stays clickable (they
  are styled `-webkit-app-region: no-drag`). On a Mac the three window lights
  sit inset at the top left; on Windows and Linux the system's own buttons
  are drawn over the top right. The game moves the controls that sat in
  those corners (`body.desktop-mac` / `body.desktop-win` in `style.css`).
- **Remembers the window**: size, position, maximised and fullscreen, saved
  to `window.json` in the app's data folder as they change and restored on
  the next launch if that spot is still on a connected display.
- **Closing the window quits the app**, on every platform, including QUIT on
  the game's main menu. It is a game, not a document app; on a Mac it no
  longer lingers in the Dock with nothing open.
- Loads `index.html` from disk. No server, no network, nothing to configure.
- Runs the page with Node disabled, context isolation on, and the sandbox
  enabled. The game asks the network for nothing, so navigation away from the
  bundled files is refused rather than trusted not to happen.
- Single instance: launching again focuses the window already open instead of
  starting a second bomb.
- A thin menu — Restart (`Ctrl`/`Cmd`+`R`), **Open the printed manual**
  (`Ctrl`/`Cmd`+`M`), fullscreen, zoom, quit. Developer tools appear only in
  unpackaged runs.

## The manual is part of the build

The app bundles `manual/` alongside `js/`, because the on-screen manual is
built from `manual/rules.js` at runtime — without it a Solo split and a
two-device manual screen both come up empty. `manual/manual.pdf` rides along
too, and **Open the printed manual** hands it to whatever the machine already
uses to read and print a PDF. That is what PRINTED mode needs, and shipping a
PDF viewer inside the app to do a job every desktop already does better would
be silly.

## Updating an app you have already installed

The build copies the game inside the app bundle, so editing the game folder
does not change an app that is already on the machine. Push the current game
into it with:

```
./tools/update-app.sh                      # /Applications/MATHEMATICKS.app
./tools/update-app.sh /path/to/Other.app
```

It prints the cache stamp before and after, so you can see the app actually
moved, and then you relaunch it.

## Changing the version or the name

`version` lives in `package.json` **and** in `js/core.js` (`D.VERSION`, shown
on the title screen and in About). They must match: `tools/check-shell.js`
fails if they drift. `version` appears in the installer filename;
`productName` is what the installed app is called.

The icon is drawn by `tools/make-icons.sh`, which writes the web icons and
`build/icon.png` (1024 px, on the macOS icon grid: a rounded square with a
margin, so it sits right in the Dock). The build tools derive the Windows
`.ico` and macOS `.icns` from that one file.

## Installing a new build over the old one

`npm run dist:mac` builds both Mac architectures; `npx electron-builder --mac
dmg --arm64` builds only Apple silicon, faster. The app is in
`dist/mac-arm64/`. Quit the old app and replace `/Applications/MATHEMATICKS.app`
with it. Saved progress is kept: it lives in the app's data folder
(`~/Library/Application Support/MATHEMATICKS`), not inside the app.

If `npm install` warns that Electron's install script was not run (npm's
`allowScripts` policy), packaging still works — electron-builder downloads
its own copy. Only `npm start` needs it.
