# Cutscenes (sub-project 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outline-SVG opening with an illustrated 2D cinematic system and the expanded campaign story.

**Architecture:** Four files under `js/cine/` (voice, kit, script, player) on one `<canvas>` plus a thin HTML overlay. Sequences are data; painters are functions. Sound goes through `audio.js` buses. Public API `DEFUSAL.cutscene` is kept so `game.js` changes are limited to two hooks.

**Tech Stack:** Canvas 2D, Web Audio, plain ES5 IIFEs (house style), headless Chrome over CDP for tests (`tools/cdp.js`).

**Spec:** `docs/superpowers/specs/2026-10-08-renovation-design.md` (sub-project 1).

## Global Constraints

* No asset files; everything drawn and synthesised in code; works from `file://` and in Electron.
* ES5 style, `(function (D) { 'use strict'; ... })(DEFUSAL);` like every other file.
* Species never named/described; no stated consequence of failure; no harm shown; narrator is the only voice; students silent silhouettes.
* Settings honoured: TEXT SIZE, FLASHES, REDUCE MOTION, VOICE/MUSIC/EFFECTS.
* Existing suites keep passing: `run-selftest.js`, `run-play.js`, `check-manual.py`, `check-zoom.js`, `check-settings.js`.
* Comments in the file's existing voice: explain why, in prose.

---

### Task 1: Voice bus, VOICE slider, `js/cine/voice.js`

**Files:** Modify `js/audio.js`, `index.html` (SOUND tab row), `js/game.js` (slider list is generic — no change needed if `data-level="voice"`), `tools/check-settings.js`. Create `js/cine/voice.js`.

**Interfaces — Produces:**
* `D.audio.graph()` → `{ ctx, voice, music, sfx, verb }` (AudioNodes; `null` before unlock).
* `D.audio.level('voice')`, `D.audio.setLevel('voice', v)`; default 0.9, stored `defusal.voice`.
* `D.cine.voice.speak(text)` → seconds (number > 0; estimate when audio unavailable: 0.16 s per syllable).
* `D.cine.voice.cue(name)` for `'boom' | 'whoosh' | 'hum-on' | 'hum-off' | 'sting' | 'thunder' | 'rain-on' | 'rain-off'`.
* `D.cine.voice.score(mood)` for `'space' | 'city' | 'tension' | 'resolve' | null` (crossfades pads).

- [ ] Step 1: add `'voice'` to `level` in audio.js, a `voiceBus` gain into master with its own reverb send, `graph()`, `resetLevels` covers voice.
- [ ] Step 2: add VOICE slider row (copy of MUSIC row, `data-level="voice"`), sample on drag = `D.cine.voice.speak('test')`.
- [ ] Step 3: write voice.js (port of spikes/common.js speak/pad/boom/whoosh/hum, plus thunder, rain, sting) routed to the buses.
- [ ] Step 4: extend check-settings: VOICE slider sets level and persists; reset returns 0.9.
- [ ] Step 5: run all suites; commit.

### Task 2: Player, CSS, wiring, harness

**Files:** Create `js/cine/player.js`, `js/cine/script.js` (prologue shot list), `js/cine/kit.js` (space painters first), `tools/check-cine.js`. Modify `index.html` (cutscene markup, script tags), `style.css` (replace THE OPENING block and `.cs-*` rules), `tools/run-play.js` (file list), `js/main.js` untouched. Delete `js/cutscene.js`.

**Interfaces — Produces:**
* `D.cine.kit.register(name, painter)`; painter = `{ prepare(W, H, params, lite) → state, draw(g, t, cam, state, W, H) }`.
* `D.cine.SEQ[name]` = `{ shots: [shot...], end: 'begin' | 'credits' | null }` with shot fields per spec.
* `D.cutscene.debug = { names(), shots(name), freeze(name, shotIndex, t) }` (draws one frame synchronously; returns canvas non-blank boolean).
* `D.cutscene.playOnce(name, done)`.

Test (check-cine.js):
```js
for each name in debug.names(): for each shot i: for t in [0.2, mid, end-0.2]:
  assert await eval(`DEFUSAL.cutscene.debug.freeze(name, i, t)`) === true
  save screenshot tools/shots/cine/<name>-<i>.png at mid
play('pre1') then dispatch Space tap -> line index advances
hold Space 1.2 s -> done called once, cutscene not active
assert no EXCEPTION logs
```

- [ ] Step 1: write check-cine.js; run; FAIL (no debug API).
- [ ] Step 2: write player.js + minimal script + space painters; markup + CSS.
- [ ] Step 3: run check-cine; PASS; run all suites; commit.

### Task 3: Space kit

Painters: `space` (sky, two star layers, nebula), `globe` (day/night, rim, sun flare; params: `lights`, `falling`, `dimming`), `horizon` (limb, clouds), `saucer` (live: reworked design from spike C) with `beam`, `constellation`, `point` (spark → 00:00 clock), `credits`.

- [ ] Port from `../spikes/shot-c-2d-illustrated.html`, add falling streaks and lights-out.
- [ ] check-cine contact sheet reviewed by eye; commit.

### Task 4: Places kit

Painters: `city-night` (rooftops, volcano, landing streak), `school` (two-storey building, corridor railings, flag rising, trees, morning sky), `classroom` (blackboard, windows, rain param, teacher's table, desks), `market` (stalls, awnings, crates, bulbs, dawn), `terminal` (jeepneys, overpass, noon), `court` (hoop, storm, rain, lightning scaled by FLASHES, phone-light cones), `bridge` (river, reflections, city lights, saucer overhead option), `sunrise` (city at dawn).

- [ ] Write painters; contact sheet; commit.

### Task 5: Props and people

Painters/helpers: `device` (case close-up waking/dark), `binder`, `desk-objects`, `apart`, `tally`, helper `D.cine.kit.student(g, x, y, scale, pose)` for poses `stand | hold-device | hold-binder | phone | sit`.

- [ ] Write; place students into classroom/terminal/court/bridge/apart; contact sheet; commit.

### Task 6: Script and game hooks

* Full script from spec (prologue 12 shots, pre1–pre5, s1–s4, finale with credits).
* game.js: campaign start plays `pre<N>` via `playOnce` when stage N not cleared; finale ends in credits then menu.
* Settings REPLAY OPENING unchanged.

- [ ] Write; check-cine over all; run-play; commit.

### Task 7: Verify and ship

- [ ] All suites; check-cine; screenshot review of every shot; phone (844×390) review.
- [ ] README story section rewritten; bump `?v=` stamps and `sw.js` cache.
- [ ] Commit, push, `tools/update-app.sh`, verify in an isolated Electron instance.
