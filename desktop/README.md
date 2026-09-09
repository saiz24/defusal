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
  once the first frame is painted so there is no white flash.
- Loads `index.html` from disk. No server, no network, nothing to configure.
- Runs the page with Node disabled, context isolation on, and the sandbox
  enabled. The game asks the network for nothing, so navigation away from the
  bundled files is refused rather than trusted not to happen.
- Single instance: launching again focuses the window already open instead of
  starting a second bomb.
- A thin menu — Restart (`Ctrl`/`Cmd`+`R`), fullscreen, zoom, quit. Developer
  tools appear only in unpackaged runs.

## Changing the version or the name

Both live in `package.json`. `version` appears in the installer filename;
`productName` is what the installed app is called. The icon is
`build/icon.png` — replace that single 512×512 file and the build tools derive
the Windows `.ico` and macOS `.icns` from it automatically.
