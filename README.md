# DEFUSAL

A two-player co-op maths bomb. The **defuser** holds this screen; the **expert**
holds the printed manual. The app never shows a rule, a hint, a unit name or a
solution during play — it only draws the bomb, generates valid puzzles and
checks answers.

## The story layer

An unidentified species has placed devices across the world. Each one is a
test, set in mathematics because it is the only language both sides could be
certain of, and built out of our own conventions — our units, our notation,
our playing cards. The rules were transmitted apart from the devices on
purpose: one person may hold the device, one may hold the rules, neither may
hold both. It is a tally, not a trigger.

* **Opening cutscene** (`js/cutscene.js`) — twenty-two lines over ten scenes
  of procedural scenery. **It carries itself:** each scene plays for a beat
  before anyone speaks (2.6s while the craft slides in, 1.9s while the pods
  fall), lines type themselves out and then hand on after a read-hold scaled
  to their length. Click, `Space` or `Enter` only ever hurries it — during the
  opening beat it starts the line, mid-type it completes the line, on a
  finished line it moves on. `Esc` or the SKIP control leaves at any point,
  including the first frame. It plays once on a first visit and then never
  again, remembered in `localStorage` behind a `try`/`catch` — if storage is
  unavailable it simply plays every time, which SKIP makes harmless.
  **REPLAY INTRO** on the menu replays it.
* **It ends by handing over a device.** The last beat resolves the point of
  light into a clock and offers BEGIN, which arms the first device directly
  rather than dropping the player on a menu. If they have already cleared
  something it goes to the selector instead.
* **The voice** — one treatment (`.voice`) for everything the devices say:
  the cutscene, the line that appears while a case arms, the result screen and
  the premise under the title.
* **Result framing** — one line above the statistics, chosen at random from
  four variants each way. Losing lines stay gentle: a mark on a long tally,
  never blame.
* **A page per device.** The menu is a carousel rather than a row of buttons:
  each device gets its own card with its number, its mathematical name, a
  glyph that gains a side and a satellite every stage, and its record — module
  count, time limit, best time left, attempts. Move between them with the
  arrows, the arrow keys or the page dots. Two more pages sit at the end:
  SANDBOX and OPEN PLAY, each locked until it is earned.
* **Five devices, in order.** Each stage is harder than the last and only the
  next one is unlocked. Practice opens after the first device so players can
  rehearse for what is coming; the free-play difficulties open only once all
  five are answered. Progress is stored with the same guarded `localStorage`,
  with a reset control on the menu.
* **A beat after every stage**, and a full conclusion sequence after the fifth
  — the end of the story, not just the end of the last puzzle.

The species is never named, described or explained, nothing states what
failure would mean, and there is no depiction of harm. `prefers-reduced-motion`
disables the animation and prints each line immediately.

## The interface

Behind every screen sits a procedural sky (`js/backdrop.js`): four drifting
washes of colour, a star field in two layers moving at different speeds, the
curve of a world along the bottom, and something very far away crossing it on
a four-minute loop. The device selector is flanked by the premise drawn rather
than written — the device on one side, the rules on the other — and each
device carries its own accent, cool to hot as the difficulty climbs.

**It is built to stay cheap.** The colour is CSS radial-gradient, not a blurred
SVG: a screen-sized `feGaussianBlur` that is also transform-animated re-renders
every frame and will not hold sixty. The stars are one static drawing whose two
layers are moved as a whole rather than several hundred separately animated
nodes, and only every ninth star blinks. The sky pauses while a device is on
screen and is dropped entirely under the opening, which is opaque anyway. The
cursor parallax coalesces to one transform write per frame — left unthrottled,
a mousemove burst re-composites the whole 3D tree several times per frame.

## Running it

Double-click `index.html`. It runs straight from `file://` — plain HTML, CSS and
classic `<script>` tags, no build step, no modules, no network, no image files.
All artwork is drawn procedurally as inline SVG. Desktop, 1280×720 or larger,
mouse only.

## The bomb

**The case has two live sides and real thickness.** It is 150 units deep, so
turning it over is one continuous rotation of a solid object rather than a
card flipping. The coloured loom runs along the four rim panels, where it is
only visible during the turn and never competes with the puzzles. The clock,
its draining bar, the strikes and the counter live on the **front only** — the
reverse carries a stamped plate, so turning the case over costs you sight of
the time. Modules are split across
the front and the back, balanced by how much room each one needs, so every
module gets a bigger slot and there is space left for hardware. Press the flip
key on the case (or `F`) and it turns over as a solid object — four rim panels
join the two faces, so the turn shows the case's depth rather than flipping a
flat card.

Slots no module occupies are filled with bolted-in hardware — a battery holder, a wire strip, a
vent, a port plate, a pressure gauge — or a plain plate. The back rail carries
a strapped payload wired up both sides into the case. All of it is drawn
procedurally as inline SVG; none of it is ever read by a module.

**Arming.** Choosing a device pulls the camera back so the whole case is in
frame, tilted. Slots then light one at a time in reading order, each with a
charge flash and a relay click, and the control strip snaps on last with a
flash and a rising tone. Only then does the camera push in to the working
view — and the clock, held at its full time throughout, is released as the
push lands. Nothing is touchable until the case is in frame. With
`prefers-reduced-motion` the pull-back and the push are skipped and the clock
starts as soon as the slots are lit.

Inside it, modules sit in slots on a lattice of 300px square cells. **Each
module declares the footprint its content actually wants** — one cell, or a 2:1
pair — so a row of sequence tiles, a Venn diagram beside its expression, or a
ruler close-up all get a shape that suits them instead of being folded into a
square:

| Footprint | Modules |
|---|---|
| 2:1 wide | Sequences, Venn Diagram, Triangles, Angles, Unit Conversions |
| square | Mutually Exclusive Events, Rationality, Parallel Lines |

The clock always holds the exact middle cell, carrying the countdown digits, a
draining bar that runs green to amber to red, the strike lights, the serial
plate and the solved counter. A packer fills outward from it, nearest cells
first, so modules cluster around the clock and any unused slot is a blank plate
pushed to the edge. The case itself is sized to the round — the smallest shape
that holds this bomb's modules — so an easy bomb is a short strip and an insane
one is the full rack. Modules carry no titles; they are identified by how they
look, the way the manual describes them.

**Focus view.** Every module bay has a small lens button in its corner. Press
it and that module comes forward at over twice the size with the rest of the
bomb dimmed behind it, while the clock ducks into the top-left corner so it
stays readable. Press it again, click anywhere outside, or hit `Esc` to pull
back out. Solving a focused module hands the whole bomb back automatically.

The whole casing is laid out at a fixed design size and scaled to the viewport
in a single transform, so nothing ever reflows. Press-by-press progress on every module appears as amber
pips in the same corner of its bay; a solved bay dims and its corner lamp goes
green and its whole outline turns green; a strike flashes the bay red.

## Motion and sound

Screens cross-fade. Arming a bomb plays a power-on ripple: the timer lights
first, then the edge bays, then the corners, each with a charge flash and a
relay click, while the LCD flickers up. The clock ticks and tocks once a second and the whole room pulses
red under thirty seconds. A strike shakes the casing, washes the screen red and
buzzes; a solve sweeps green across the bay and chimes; a loss detonates in
white, and a defusal rings out.

**Every sound is synthesised at runtime** with the Web Audio API — oscillators,
filtered noise and envelopes — so there are still no asset files and it all
works from `file://`. Audio starts on the first click, as browsers require.
Toggle it with the SOUND button on the menu or the `M` key.

Game state always changes synchronously; the motion layer is presentation only,
so nothing about timing or fairness depends on an animation finishing.
`prefers-reduced-motion` disables the lot.

## Modules

| Module | Rating |
|---|---|
| Venn Diagram, Sequences | Easy |
| Rationality, Parallel Lines, Mutually Exclusive Events | Medium |
| Triangles, Angles, Unit Conversions | Hard |

| Difficulty | Modules | Time | Selection rule |
|---|---|---|---|
| Easy | 3 | 5:00 | at most 1 Hard |
| Medium | 5 | 7:00 | at least 1 Hard |
| Hard | 6 | 8:00 | exactly 2 Hard |
| Insane | 8 | 10:00 | all eight |
| Practice | 1–8 | 1–30 min | random, no duplicates |

## Debug and reproducibility

Debug mode is off by default and cannot be reached by accident.

* `index.html?debug=1` — overlays each module's correct answer and runs the
  self-test in the browser console at startup.
* `Ctrl` + `Shift` + `D` — toggles the same overlay mid-session.
* `index.html?seed=123456` — replays the exact bomb whose seed is printed at
  the bottom of the result screen, so a broken round can be reproduced.
* `index.html?start=hard` — skips the menu and arms that difficulty; pair it
  with `?seed=` to reopen a reported bomb in one click.
* `index.html?start=hard&focus=7` — opens the 8th placed module in the focus
  view, for reproducing a layout report.
* `index.html?start=hard&face=back` — starts with the case turned over.
* `index.html?intro=1` — replays the opening; add `&scene=2` to open on a
  particular beat. `?intro=0` skips it when you want the menu directly.
* `index.html?page=5` — opens the selector on a given card.

`Esc` aborts back to the menu, as does the ABORT plate on the timer.

## Development

```
node tools/run-selftest.js 1200   # generates 1200 rounds per module and asserts
                                  # a solution exists, is unique and satisfies
                                  # every constraint in the manual
node tools/run-play.js 150        # mounts every module for real against a
                                  # headless DOM, drives the winning and the
                                  # losing interaction, then plays whole bombs
                                  # to a defusal, a three-strike loss and a
                                  # time-out
node tools/render-preview.js 5    # writes one round of each module to
node tools/render-units.js        # tools/preview/*.svg for eyeballing artwork
tools/shoot.sh                    # screenshots the real page through headless
                                  # Chrome into tools/shots/ (macOS); add
                                  # --virtual-time-budget to catch a frame
                                  # mid-animation
tools/sheet.html                  # contact sheet: one live bay per module at
                                  # real size, ?seed=N to reroll
```

`tools/dom-shim.js` is a minimal DOM used only by those scripts; the game itself
never loads it.

## Layout

```
index.html
style.css
js/core.js              namespace, seeded RNG, module registry, serial helpers
js/svg.js               SVG construction helpers
js/audio.js             the synthesised sound kit
js/cutscene.js          the opening: script, typewriter, procedural scenery
js/game.js              screens, countdown, strikes, bay grid, win/lose
js/selftest.js          generated-round assertions (browser + Node)
js/main.js              boot
js/modules/*.js         one file per puzzle; each opens with the manual rule
                        it implements, so it can be diffed against the print
```
