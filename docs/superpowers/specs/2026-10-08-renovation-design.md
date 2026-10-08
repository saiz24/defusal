# MATHEMATICKS renovation — design

Date: 2026-10-08. Status: approved in conversation ("sounds good. execute.").

## Goal

Make the game feel like a shippable, downloadable game rather than a website.
The biggest single improvement is the cutscenes.

## Direction (chosen from three test shots in `../spikes/`)

* **Cutscenes and story art: illustrated 2D** (test shot C). Layered painted
  illustration drawn in code on a canvas: gradients, rim light, haze,
  parallax camera, particles, letterbox, film grain.
* **Gameplay: full 3D** (test shot B). The device is a 3D object on a desk
  under a lamp; the player turns it over and presses its parts.
* **Craft: the reworked saucer** (tiers, portholes, emitter ring, lit dome).
* **Narrator: synthesised alien voice** under subtitles. No audio files.
* **Hardware: laptops first**; phones get a LITE quality tier.

## Sub-projects, in order

Each is built, tested, shipped (website + desktop app) before the next.

1. **Cutscenes (2D illustrated)** — this document specifies it in full.
2. **3D foundation** — vendored Three.js IIFE (offline, works from `file://`
   and Electron), quality tiers (HIGH / LITE / 2D fallback without WebGL),
   desk scene, case model, turn-and-snap-to-face, lean-in, picking. Lighting
   rules from test shot B: bloom only on HDR emitters, a camera-following
   fill light, faces never readable only edge-on.
3. **Module port** — the 9 modules rebuilt as 3D objects. Generators, solvers,
   validators and the manual are untouched; only the view and input layer is
   new. Each module gets its own short spec. The play-through test gets a 3D
   counterpart.
4. **Game shell** — launch splash; title screen = the desk scene with a slow
   camera and PRESS ANY KEY; menus rebuilt (campaign, free play, mode,
   settings, quit in Electron); pause menu; transitions.
5. **Presentation** — briefing card per device; results with rank S/A/B/C and
   count-up numbers.
6. **Electron polish** — frameless window, splash, icon, version.

Unchanged throughout: module rules and generators, the manual (2D document),
the three play modes, settings, zoom, the test suites.

---

## Sub-project 1: cutscenes

### Interface

`js/cine/` replaces `js/cutscene.js` and keeps its API on `DEFUSAL.cutscene`:
`play(name, done)`, `has(name)`, `isActive()`, `skip()`, `maybePlay()`,
`init()`. New: `playOnce(name, done)` plays a sequence only if it has not
been seen, else calls `done` at once.

### Files

| file | job |
|---|---|
| `js/cine/voice.js` | alien voice (formant babble, ring-modulated, octave shadow) and score cues (pad, swell, boom, whoosh, hum, sting). Routed through `audio.js` buses: voice on a new VOICE bus, score on MUSIC, effects on EFFECTS. |
| `js/cine/kit.js` | the illustration kit: painters. Static layers painted once to offscreen canvases per sequence; moving parts drawn per frame. |
| `js/cine/script.js` | every sequence as data. |
| `js/cine/player.js` | the player: canvas, clock, camera, transitions, subtitles, cards, letterbox, hold-to-skip, BEGIN. |

### Shot data

```
{ paint: 'classroom', params: {...},
  cam: { from: [x, y, zoom], to: [x, y, zoom] },   // optional; default slow push
  wait: 1.2,                                        // seconds before first line
  lines: ['...', '...'],
  hold: 1.0,                                        // seconds after last line
  dur: 6,                                           // optional fixed length
  trans: 'dissolve' | 'cut' | 'black',              // how this shot arrives
  sfx: [[0.0, 'whoosh'], [1.2, 'boom']],
  card: ['PROLOGUE', 'CONTACT'] }                   // optional title card first
```

A shot's length is `wait + Σ(voice length + gap) + hold` unless `dur` is
given. Painters receive `(g, t, cam, state, W, H)`: `t` seconds into the
shot, `cam` the eased camera.

### Behaviour

* Lines are spoken by the voice and revealed word by word in sync. A tap
  (click, Space, Enter) completes the current line, a second tap moves on.
* **Hold 1 s** (mouse, touch, Space, Enter, Esc) skips the sequence. The ring
  and "HOLD TO SKIP" appear only once a press starts.
* Letterbox bars slide in at start, out at end. Title cards between acts.
* Prologue ends on BEGIN, which hands over the mode screen as today.
* Pauses on window blur / hidden tab.
* Settings honoured: TEXT SIZE (subtitles, cards), FLASHES (lightning,
  impacts), REDUCE MOTION (no camera moves, no particles, quick fades),
  VOICE / MUSIC / EFFECTS levels.
* LITE quality (coarse pointer or small screen): device-pixel ratio capped at
  1.25, fewer particles.
* Each sequence remembers it has been seen (`defusal.cine.<name>`).

### Game hooks

* First visit: prologue (as today).
* Starting a campaign device not yet cleared: `pre<N>` plays once, then the
  device arms.
* Clearing device N (1–4): `s<N>` as today. Clearing 5: `pre`-less `finale`,
  ending in credits.
* Settings → GAME → OPENING: REPLAY stays; it replays the prologue.

### Story

Rules kept from the README: the species is never named, described or
explained; nothing states what failure would mean; no harm is shown; the
devices are a tally, not a trigger; the narrator is the only voice. The two
students are silhouettes with no names and do not speak.

Setting: one unnamed Philippine city drawn to read as Naga — a volcano on the
skyline (Isarog-like), a river, jeepneys, a public high school.

#### PROLOGUE — CONTACT

| shot | picture | lines |
|---|---|---|
| 1 | Earth from space, sunrise on the limb | For a long time we only listened. / You were loud, and you were young. |
| 2 | the horizon; the saucer slides in | We came close enough to be certain. / You did not see us. That was deliberate. |
| 3 | the globe's night side; streaks of light falling to every city | We left something in every place you live. |
| 4 | the city at night: rooftops, the volcano, one streak landing | We chose places you return to every day. |
| 5 | the device close up, waking | We do not speak your languages. / We did not need to. |
| 6 | stars resolving into a triangle, a circle, a square | Every thinking species arrives at the same mathematics. / It is the only thing we could be certain you would understand. |
| 7 | a desk: ruler, protractor, measuring cylinder, cards | So we built our questions out of yours. / Your units. Your notation. Your figures. / We have returned them to you. |
| 8 | morning: the school, the flag going up | The rules were sent apart from the devices. / Deliberately. |
| 9 | classroom: one student at the device, one in the doorway with the binder | One of you may hold the device. / One of you may hold the rules. / Neither of you may hold both. |
| 10 | the two, apart, a dashed line between | We are not measuring what one of you knows. / We are measuring whether you can reach each other in time. |
| 11 | the globe pricked with points of light | There are many devices. / You will not answer them all. / Answer enough. |
| 12 | a point of light that becomes a clock | Begin. → BEGIN |

#### Devices

| seq | picture | lines |
|---|---|---|
| pre1 | classroom after class, rain on the windows; the device on the teacher's table wakes | This one is small. / It is meant to be. |
| s1 | the same room, the device dark; a light blinks in the sky outside | One device answered. / We have adjusted the next. |
| pre2 | the market at dawn: awnings, crates, hanging bulbs | You trade here. You count here. / You will count for us. |
| s2 | the market, morning light, the device dark | Two. / You are quicker than we recorded. |
| pre3 | jeepney terminal at noon; one student by the device, the other across the terminal on a phone with the binder | This time we have put distance between you. / Distance is only a problem if you stop talking. |
| s3 | the terminal, the two walking back to each other | Three. / The rules were no use to you until you said them aloud. / We noticed. |
| pre4 | basketball court in a storm, power out, lit by phone flashlights | Your light failed. / Your arithmetic did not. |
| s4 | the court, rain easing, the device dark | Four. One remains. / We have not made it kind. |
| pre5 | the bridge over the river at night, the city lit, the saucer overhead | Everyone you know is awake tonight. / This is the last one we brought. |

#### FINALE — RECORD

| shot | picture | lines |
|---|---|---|
| 1 | the globe, its lights going out one by one | The last device is answered. / It is going quiet. They all are. |
| 2 | sunrise over the city; the two sitting on the bridge rail with the binder | We will record what we saw here. / Two of you. One holding a thing you did not build. / One holding words you did not write. / Neither of you able to finish alone. / That is the whole of the test. |
| 3 | the saucer leaving over the horizon | We are leaving. / You may keep the rules. / You will need them for each other. |
| 4 | Earth from space | For now, that is enough. |
| 5 | credits over the sky | — |

### Testing

`tools/check-cine.js` (headless Chrome over CDP):

* every sequence and shot renders a non-blank frame at start, middle, end;
* no exceptions;
* every line gets a voice duration > 0 and a subtitle;
* tap advances, hold skips, `done` is called exactly once;
* prints the running time of each sequence;
* writes a contact sheet PNG per shot to `tools/shots/cine/`.

`run-play.js` and `run-selftest.js` keep passing (the cine files load in the
node shim without a canvas and do nothing).
