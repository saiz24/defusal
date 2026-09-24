# DEFUSAL

**The game is called MATHEMATICKS.** That is the name on the title screen, in
the manifest, on the printed manual and on the competition entry. DEFUSAL is
the codename this repository, the JavaScript namespace and the source headers
were written under, and it stays — renaming a namespace buys nothing and risks
everything a fortnight before a competition. Anything an audience sees says
MATHEMATICKS; anything only a developer sees may say DEFUSAL.

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
* **It fills the screen; the DRAWING is what is held off the edges.** The
  scenery used to run right to the glass with nowhere for the eye to rest, and
  a pass that only pulled the camera back left it sitting in a frame, which was
  worse. The stage covers the whole screen and the picture is inset by padding
  on the SVG itself — it is a replaced element, so its viewBox fits the content
  box — with a deeper inset at the bottom so nothing runs under the line being
  read. Beats dissolve into each other through a ghost layer.
* **It ends by handing over the mode screen**, which then hands over a device.
  The last beat resolves the point of light into a clock and offers BEGIN;
  BEGIN asks how the two halves will be held, and CONTINUE arms the first
  device. If they have already cleared something it goes to the selector.
* **The voice** — one treatment (`.voice`) for everything the devices say:
  the cutscene, the line that appears while a case arms, and the premise under
  the title. **The result screen says nothing.** It used to carry a line of
  narration above the statistics; after a round the player wants the verdict
  and the numbers, and a sentence between the two put the story in the way of
  the scoreboard.
* **A page per device.** The menu is a carousel rather than a row of buttons:
  each device gets its own card with its number, its mathematical name, a
  glyph that gains a side and a satellite every stage, and its record — module
  count, time limit, best time left, attempts. Move between them with the
  arrows, the arrow keys or the page dots. Two more pages sit at the end:
  SANDBOX, locked until the first device is answered, and SEED, never locked.
* **Five devices, in order.** Each stage is harder than the last and only the
  next one is unlocked. Practice opens after the first device so players can
  rehearse for what is coming. Progress is stored with the same guarded
  `localStorage`, with a reset control on the menu.
* **A code, not a seed.** Every result screen prints one short code and offers
  to copy it; the SEED page takes it back and arms the identical device. A
  seed alone reproduces nothing — the same seed poured into a three-module
  device and an eight-module one deals two different bombs — so the code
  carries the shape of the device with it: `S3-K7A2XQ` is device 3 at that
  seed, `F4M8-K7A2XQ` is a sandbox device of 4 modules and 8 minutes, and
  `DH-K7A2XQ` is a free device at PATHOLOGICAL. A round armed from a code
  records nothing, so the last device cannot be cleared by typing somebody
  else's code for it. This replaced OPEN PLAY, which dealt a new random device
  every time and gave the player no way back to one.
* **A beat after every stage**, and a full conclusion sequence after the fifth
  — the end of the story, not just the end of the last puzzle.

**Two things made it look broken, and both were mechanical.** The scenery
declares ids — a clipPath for the globe, a gradient for the shaft of light —
and while one beat dissolves into the next there are *two* copies of the
artwork in the document, so a duplicated id made both resolve to whichever was
parsed first. They are uniquely stamped now. And the slow drift is an animation
on `.cs-stage.in .cs-art`: the instant the outgoing scene was handed to the
ghost layer that rule stopped applying and it snapped back to the start of the
drift, which is the jump every scene change had. It is frozen at its computed
transform before it is moved.

The species is never named, described or explained, nothing states what
failure would mean, and there is no depiction of harm. `prefers-reduced-motion`
disables the animation, skips the dissolve and prints each line immediately.

## Three ways to hold the two halves

The game rests on one rule: the person who can see the device and the person
who can read the rules are not the same person. All three modes keep that rule.
They differ only in where the manual lives and what it costs to reach it.

**The mode is chosen on its own screen**, which is the first thing the opening
hands over and is reachable again from MODE on the menu. It is a carousel:
three keys along the bottom and, above them, a panel big enough to show what
the mode looks like once a device is armed. "Two devices" is a shape, and a
player picks a shape from a picture of it far more easily than from a sentence
about it. Every choice on that screen is remembered in the same guarded
`localStorage`.

| Mode | Players | The manual |
|---|---|---|
| **PRINTED** | two | on paper. The original, and still the best: nothing to set up, nothing to charge. |
| **TWO DEVICES** | two | on the second screen, inside the game. |
| **SOLO** | one | beside the device, on this screen, in a split. |

**Two devices.** Each screen is told what it is — THE DEVICE or THE MANUAL —
and shows only that. A screen set to THE MANUAL has no menu and no bomb: it is
the manual, and it stays there until somebody changes what that screen is.
Nothing anywhere tells a player to open a file or follow a link.

**Solo.** The device and the manual are both on the glass, split. Either half
can take the whole screen, the split can be turned, and **the divider can be
dragged** — 50/50 is only ever a starting guess, and which half needs the room
depends on the device in front of you. It is clamped to 20–80%, remembered per
orientation, double-click puts it back in the middle, and it answers the arrow
keys once it has focus. The bomb is scaled to its **pane**, not to the window,
so it refits the moment the divider moves. On a phone the device half is small
until a module is focused — which is how the game is played on a phone
anyway, one module at a time.

Solo is deliberately not the default. With one player the information gap stops
being a communication problem and becomes a memory-and-retrieval one: a
different exercise, and an honestly lesser one, since describing mathematics
precisely to another person is the competency the game exists to drill. What it
buys is a learner who can practise alone, at home, without a partner.

## The manual, inside the game

`js/manual-view.js` mounts it: half of a Solo split, or the whole of a second
screen. It is **typeset for the screen it is on**, not embedded as a document.
A PDF in a frame is somebody else's viewer inside ours — its own scrollbar, its
own zoom, its own idea of a page, a sheet of white margin before a word is
read, and on iOS only ever the first page.

`manual/manual.pdf` is still built, because PRINTED mode needs something to
print. The chain is `DEFUSAL.docx` → `tools/extract-manual.py` →
`manual/rules.js` → `manual/print.html` → headless Chrome → `manual/manual.pdf`,
and the on-screen manual reads the same `manual/rules.js`, so nothing is
retyped and paper and glass cannot drift apart.

**No illustrations, anywhere in it.** The manual used to carry a live example
of every module, drawn by the game. The Expert never sees the device, and a
picture of a module invites them to match one by eye instead of asking the
Defuser to describe it — which is the whole competency.

**No search either**, on any of the three places it is read. A search box turns
the manual into a lookup table: type the word the Defuser just said, read back
the one line that matched. The contents are how a module is found by name, and
the Expert is supposed to read the section.

## Type and colour

The type used to be four unrelated families — the segment readout, American
Typewriter, Avenir and the system mono — and every screen had a seam where one
voice met another. Two of them do not exist on Windows at all, so half the
players were reading Courier New. It is now **two families, both bundled**:
the segment face for the device, and IBM Plex for everything else, one
superfamily in four cuts drawn to sit together.

That is the pattern in the games this borrows from. *Keep Talking and Nobody
Explodes* pairs one display face with one document face for its manual;
*Alien: Isolation* runs its whole interface in one grotesque and keeps a
second, diegetic face for the terminals.

| | |
|---|---|
| `--seg` | **the device.** The clock, serial and counter on the case, the title, a verdict, a device's name, a screen heading. Lit, and glows. `fonts/seven-segment.ttf`. |
| `--round` | controls and labels — every key, button, tab and panel heading. Plex Sans Condensed, capitals, tracked: the printed legend on equipment. |
| `--prose` | small print and interface sentences. Plex Sans. |
| `--doc` | the manual's prose. Plex Serif: the manual is a document, and the serif says "paper" without leaving the family. The printed PDF uses the same cuts. |
| `--mono` | figures that must line up — a table, a round code. Plex Mono. |

`fonts/plex/` holds the Latin subsets as woff2 (about 250KB, OFL — licence
beside them). A face is only fetched when a rule on screen asks for it.

**The glow follows the device.** `--accent` is set on the menu from whichever
device is in front of you — cool at TRIVIAL, hot at INTRACTABLE — and the
title, the device's name and the page dots all light from it. Paging through
the carousel walks the whole screen from blue to red.

**And one scale.** Sizes used to be chosen per rule — 10, 11, 12, 13, 15, 17,
19, 21, 22, 25, 26, most of them a pixel apart, which is how a screen ends up
with no hierarchy at all. Six steps (`--t-hero` … `--t-micro`) and three
tracking values, used everywhere. A heading is now obviously a heading because
it is two steps away from the thing under it, not one pixel.

The greys were raised (`--ink-2`, `--ink-3`, `--ink-off`), anything sitting
directly on the animated sky carries a shadow so the backdrop cannot eat it,
and the things that should announce themselves are lit rather than merely
large: the title is clipped to a top-lit gradient with a glow and a hairline
rule under it, a device's name glows in its own accent, its emblem carries a
drop-shadow in the same colour, and a verdict glows green or red.

## Show, don't tell

There is no explanatory line under anything. The mode screen had a kicker and
a blurb, the settings rows each had a sentence, the seed page had an
instruction, the code plate had a note, and the mode previews had captions
underneath the drawings. All of it is gone. A picture of two screens, one
showing a grid of modules and the other showing lines of rules, does not need
to be told to anybody in words; a settings row is a name and a control; a field
that wants a code says so by having `S3-K7A2XQ` in it. The only line of prose
left in the interface is the manual's own lede, which is a rule rather than a
description — it is the one thing telling an Expert they may not look at the
device.

Numbers are numerals. `2 DEVICES`, `2 PLAYERS`, `1 PLAYER`, `DEVICE 1 / 5`.

## Where to click

The menu used to end in four buttons of identical weight — MODE, SOUND,
REPLAY INTRO, RESET PROGRESS — so nothing told the eye which of them mattered,
and one of them wipes your progress. There are three things on the menu now, in
order of how often they are wanted:

* **ENGAGE**, on the device card. The thing you came to press.
* **MODE**, a wide key that states what the mode currently *is* rather than
  being a button whose meaning you have to remember: `MODE / SOLO`,
  `MODE / TWO DEVICES · MANUAL`.
* a small **settings** icon, which is a door rather than a decision.

`#screen-settings` holds everything that is housekeeping, filed under four
tabs the way most games do it — fourteen rows in one column ran off a laptop
screen. The tabs share one grid cell, so switching never moves DONE.

| tab | setting | what it does |
|---|---|---|
| SOUND | SOUND, VOLUME, MUSIC, EFFECTS | on/off and three levels (see *Sound*) |
| DISPLAY | FULLSCREEN | the Fullscreen API; read back from the document, so Esc keeps it honest. Hidden where the browser has none (iPhone) |
| | DEVICE SIZE | 80–120% of the case's fitted size at rest; over 100% it may overhang its pane and can then be dragged |
| | TEXT SIZE | S M L XL (90–130%) for the menus, the opening's captions, the split's controls and the manual — the manual's own `− 100% +` is relative to it |
| ACCESS | REDUCE MOTION | AUTO follows the system and follows it live; ON and OFF override it either way |
| | SCREEN SHAKE | the case, a struck bay and the seed box stop moving; the strike still flashes and sounds |
| | FLASHES | 0–100% for the strike, blast and win washes, the red room under thirty seconds and the strip's power-up pop. At 0 they are gone and the clock holds a steady red instead of blinking |
| | COLOUR LABELS | the colour's letter on every Triangles and Rationality key, and the colour's name on the Angles lamp — six neighbouring hues, the hardest thing in the game to tell apart without full colour vision |
| GAME | OPENING | replay it |
| | SETTINGS | every option back to default, including the sound levels and the manual's size. Progress is not a setting and is left alone |
| | PROGRESS | reset, in red |

`js/settings.js` owns all of it: each setting's default, storage
(`defusal.pref.*`), effect and control. The effects are a class or a custom
property on `<body>`/`<html>` (`rm`, `no-shake`, `no-flash`, `cb`,
`--flash-k`, `--ui-text`), so CSS does the work and nothing is redrawn — the
colour letters are always in the drawing and only shown by `body.cb`. Every
`@media (prefers-reduced-motion)` rule became `body.rm`, which is what lets
the setting override the system. `tools/check-settings.js` drives each
control in headless Chrome and checks its effect, a reload, and the reset.

## Zoom

Both halves zoom continuously, about the point under the pointer.

| | the case | the manual |
|---|---|---|
| mouse wheel | zooms | scrolls (it is read top to bottom) |
| Ctrl/Cmd + wheel, trackpad pinch | zooms | zooms |
| two fingers | zooms | zooms |
| drag | moves a zoomed case | — |
| keys / buttons | `+` `-` `0`; the lens button pulls back, or resets from any zoom | `−` `100%` `+` in its bar |

The case ranges from half to 3.2x its fitted size and cannot be dragged past
the point where its edge reaches the middle of the pane. A press only becomes
a drag after six pixels, so taps and clicks on modules land exactly as before,
and a drag swallows the click it would otherwise end in. The manual scales with
CSS `zoom` rather than a transform, so its lines re-wrap to the pane instead of
running off the side; its size (70–220%) is remembered. `js/zoom.js`
normalises every input into one call; `tools/check-zoom.js` drives real wheel,
drag, key and Ctrl+wheel input through headless Chrome and checks all of it.

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

**Nothing on the shell is lettered.** The rails used to carry stencilled
ARMED, LIVE, DO NOT CUT and CHARGE LIVE, and the reverse was stamped REVERSE.
None of it is ever read by a module, and all of it competed with the only text
that matters — the clock, the serial and the puzzles. The pilot lamps and the
hazard bars say the same thing without words. The serial stays: modules read
it.

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

## On a phone

The case is laid out at a fixed design size and scaled to the viewport in one
transform. On a 844x390 phone that scale is about 0.48, which has two
consequences worth knowing:

* **A stylesheet pixel is not a glass pixel inside the case.** `min-height: 44px`
  on a control inside the transform becomes about 21px of actual glass. Anything
  that has to stay thumb-sized is therefore sized in case units big enough to
  survive the scale, not in the 44px the guidelines quote.
* **Unfocused, a module is not readable.** A 12px label renders at about 6px.
  Focus view is not a convenience on a phone, it is the way the game is played:
  one module at a time, filling the screen.

So on a coarse pointer:

* **Tapping anywhere on a module focuses it.** The lens button unfocused is
  about twelve device pixels across, and making a player hit that before they
  can read anything was the single worst thing about this game on a phone. On a
  mouse a stray click still lands on nothing, as it always has.
* **A focused module fills about 82% of its PANE**, and the case is
  lifted by half the difference between the two rails, because the grid is not
  centred in the case and the bay otherwise hangs off the bottom.
* **The clock is pinned to the glass while a module is focused**, since the
  case's own control strip is pushed off the top by the zoom.
* **Focusing an answer box pulls its module forward first**, and `visualViewport`
  lifts the case clear of the on-screen keyboard — the keyboard shrinks the
  visual viewport without resizing the window, so nothing else reports it.

Measured at 844x390, focused: smallest label 20px, smallest control 55px, and
at 740x360, 18px and 48px. Before that pass: 12px and 32px.

**The menus were the part that had never been fitted to a phone.** A handset
held sideways is about 390 tall; the title alone took 40 of it and the device
card asked for 396 more, so ENGAGE sat below the fold. Every sheet now has a
short-screen pass (`@media (max-height: 540px)`), and the two screens that are
mostly choices — the mode screen and the opening — are re-laid out for a wide,
short frame: the mode screen puts the preview in the left half and everything
you press in the right, and the opening shrinks its frame by viewport height so
the caption and BEGIN always have room. Measured at 844x390: the menu comes to
397px against 390 of glass, the mode screen to exactly 390, and the opening
fits with nothing clipped.

**Still to check on real hardware**, which a headless browser cannot do: the
actual on-screen keyboard on iOS and Android, sustained frame rate, and whether
the ruler and cylinder gradations survive a real phone's pixel density.

## Sound, and the case

Screens cross-fade. Arming a bomb plays a power-on ripple: the timer lights
first, then the edge bays, then the corners, each with a charge flash and a
relay click, while the LCD flickers up. The clock ticks and tocks once a second and the whole room pulses
red under thirty seconds. A strike shakes the casing, washes the screen red and
goes off like an alarm — a crack, a sub thump, two sawtooth growls a tritone
apart and a two-blat klaxon over them. It measures about twice the peak and
twice the RMS of the old buzzer, which was quieter than the solve chime two
bays over and so read as a shrug. A solve sweeps green across the bay and
chimes; a loss detonates in
white, and a defusal rings out.

**Every sound is synthesised at runtime** with the Web Audio API — oscillators,
filtered noise and envelopes — so there are still no asset files and it all
works from `file://`. Audio starts on the first click, as browsers require.
Toggle it with SOUND in settings or the `M` key.

**Levels.** Effects and the music bed are separate buses under one master,
each with a slider in settings (the slider is squared, so its travel sounds
even), and a limiter at -4 dBFS keeps overlapping sounds from clipping. The
old mix measured quiet — a key press peaked at -32 dBFS and the countdown beep
at -14, under a music bed at -4 — so the effects were lifted and the bed pulled
under them. `node tools/measure-audio.js [volume]` renders every sound offline
in headless Chrome and prints its peak and loudest 100ms:

| | before | now |
|---|---|---|
| key press, peak | -31.9 | -10.7 |
| countdown beep, loudest 100ms | -22.2 | -11.0 |
| solve | -21.7 | -12.7 |
| strike | -14.8 | -11.0 |
| music bed (at 70%) | -9.5 | -16.4 |

**Light.** Everything on the case that is a light source — the clock, serial,
counter, drain bar, strike and status lamps, pilot lamps, the conversion
module's indicators and the backlit rim of every module — carries a hot core,
a tight bloom and a wide spill. It is all static box- and text-shadow, which
rasterises once; a filter or an animated shadow inside the 3D tree would be
repainted with the whole case on every tilt.

Game state always changes synchronously; the motion layer is presentation only,
so nothing about timing or fairness depends on an animation finishing.
REDUCE MOTION in settings disables the lot; on AUTO it follows the system's `prefers-reduced-motion`.

## Motion

`js/fx.js` is the motion layer, and nothing in it is allowed to matter. Game
state always changes synchronously; if every animation in the file failed to
run, the same rounds would be dealt, the same answers accepted and the same
clock would expire.

**What moves.** Every control OUTSIDE the case answers a press with a ripple
from the point it was touched. Hover lifts a key, a card, a dot. Screens have
a direction — going further in pushes the old screen left and brings the new
one in from the right, coming back reverses it, and the result screen drops
from above because it is an interruption rather than a place. Each screen then
assembles itself, staggered. The zooms are sprung. The carousels give the page
you are on depth over the ones sliding past. A solve leaves a ring; a strike
kicks the bay; a code that will not parse shakes its panel. The manual's
contents arrive a chip at a time and its sections arrive as they are scrolled
to. The result screen's figures roll up to their values.

**The cut.** Where the game genuinely moves somewhere else — the opening into
the mode screen, the mode screen into a device, a card into an armed round — an
iris closes from the point you pressed, the screen changes behind it, and it
opens again, in the colour of the device you chose. It is deliberately *not* on
every button: a transition on everything is just a delay.

**Nothing on the case ripples, and nothing on the case hovers.** Both were
tried and both were wrong. The case is laid out at a fixed design size and
scaled to the viewport in one transform, so a button's box on screen and its
box in its own coordinate space are different sizes: a ripple measured from
`getBoundingClientRect` and positioned in the element's own space lands in the
wrong place at the wrong size, and the error grows as the case gets smaller. A
per-bay hover transform was worse — a bay lives inside the preserve-3d tree the
cursor tilt already rewrites every frame, and a focused bay carries an inline
transform that the hover rule fought outright. The case answers a press with a
key sound and an `:active` scale, and answers the pointer by leaning once, as a
whole.

**Screens do not cross-fade, they hand over.** The old and the new used to
animate across the same window, so for a third of a second one sheet of text
lay on top of another — the single thing that made a change of screen read as
broken. The leaving screen goes first (`--t-leave`), there is a beat where only
the sky shows (`--t-hold`), and then the new one arrives (`--t-slow`) and
assembles itself. The arriving screen also has the higher `z-index`: before
that it was DOM order that decided which was on top, so going *back* put the
screen you were leaving over the one you were going to. Measured across the
handover: menu at 0.96, 0.68, 0.00 — settings at 0.00, 0.00, 0.32.

**Timings are tokens, not guesses.** `--t-quick` .22s, `--t-mid` .42s,
`--t-slow` .68s, `--t-cut` .92s, with three shared easings. Everything used to
be over before the eye had found it.

**Things move rather than jump.** When a screen swaps a line of copy for a
longer one, or grows a row of options it did not have a moment ago — PRINTED
has none, TWO DEVICES has two — everything under it used to be shoved down
instantly. `fx.flip` measures where everything is, lets the change happen,
measures again, puts it all back with a transform and releases it: two rect
reads and one composited transform each, with the layout work happening once in
the middle rather than on every frame.

**The budget.** All of it is transform and opacity, which are handed to the
compositor and cost no layout and no repaint. Specifically avoided:

* No `clip-path` for the iris — a scaled disc composites, an animated clip-path
  repaints its layer every frame.
* Nothing animates `filter`, `box-shadow`, `width`, `top` or `letter-spacing`
  on a loop. A glow that has to move is a pre-composited layer whose opacity
  changes.
* The Solo panes **snap** and fade. Animating `inset` on two full-screen panes
  is layout work on every frame for the whole of both, with the case inside one
  having to be re-measured as it goes.
* Nothing animates the LCD's digits. Scaling live text re-rasterises it.
* A focused bay carries an inline transform, so the strike kick is scoped to
  `:not(.focused)` — otherwise a strike would throw the module back to its
  unfocused size mid-animation.
* Opacity never goes on `.bomb`: on an element inside `preserve-3d` it flattens
  the box. The deck is the fade layer.
* A ripple host is clipped but only *anchored* if it is not positioned
  already. Forcing `position: relative` on every control took SKIP and BEGIN —
  which are absolutely placed — out of position the instant they were pressed:
  the button jumped out from under the cursor and the click landed on nothing.
* The iris adds ONE `animationend` listener and removes it on every exit. Added
  per call and removed only on the happy path, one was left behind for every
  cut of the session, and an old one firing re-ran the transition it had closed
  over.
* The base `.bay` rule already carries the transitions the case is built
  around. Nothing overrides them; an override once set `transition: none` on
  unfocused bays and silently took the solve fade with it.
* The strike kick keeps the bay's own `translateZ(14px)` in every keyframe. A
  bay sits proud of the panel, and a keyframe that forgets that drops it flat
  for the length of the kick.
* One delegated listener for every press in the game. Ripple nodes delete
  themselves. `will-change` is set when an effect starts and cleared when it
  ends. Every rAF loop is short and self-cancelling.
* The role and split choices are a **segmented control**: two fixed cells and
  one lit pill, and the pill is the only thing that moves. What was there
  before rebuilt both buttons on every press, so their labels changed width and
  every line underneath jumped to match — choosing what a screen is looked like
  the page coming apart.
* The opening throttles presses. A player who clicks through it as fast as
  they can used to outrun it: every press fired another advance, lines were
  completed and skipped in the same frame, the line sound stacked on itself,
  and a scene change could begin while the previous one was still dissolving.
  There is a floor between presses, and a longer one held from the moment a
  scene changes — a new picture has to be on screen before it can be skipped.
  Measured: 120 clicks in a second now advance it by exactly one line.
* **No pointer parallax.** The menus once leaned towards the cursor. A
  whole-screen layer that answers every pointer move is a cost paid on every
  frame the mouse is moving, and it read as the screen being loose. The sky
  already drifts on its own.

Measured in Chrome at 1440x900: **60fps with an 18.8ms worst frame** on the
menu, on a full eight-module INTRACTABLE device, in the opening, and in a Solo
split with the manual mounted beside the case (2394 nodes).

**One name cost the whole case.** `var DEPTH = 150` is the case's thickness in
units, at the top of `js/game.js`. A later pass declared `var DEPTH = {...}`
for the screen ordering in the same function scope — `var` is function-scoped,
so the number became an object, `DEPTH / 2` became `NaN`, and every face and
rim transform came out as `translateZ(NaNpx)`, which the browser drops in
silence. The box lost its thickness, the two faces ended up coplanar, and the
case z-fought with itself: the reverse painted over the front, so the clock
vanished and the device looked broken. Nothing in the test suite noticed —
rounds were dealt correctly and every module still solved. `tools/run-play.js`
now asserts the geometry: two faces with a real `translateZ`, the back one
turned over, four rims with usable sizes, and no `NaN`, `undefined` or
`[object Object]` anywhere in any of them.

**And it all switches off.** `prefers-reduced-motion` does not slow any of this
down, it removes it — and the callbacks still fire immediately, so nothing ever
waits on an animation that is not going to play. The same path is taken by the
headless harness, which has no layout, no rAF and no media queries: `fx.js`
treats "cannot animate" and "asked not to animate" as one case, which is what
stops a test run hanging behind an iris that will never finish.

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

The five devices in the story use their own counts and limits: TRIVIAL 3/5:00,
ELEMENTARY 4/5:30, NONTRIVIAL 5/7:00, PATHOLOGICAL 6/8:00, INTRACTABLE 8/10:00.

## Debug and reproducibility

Debug mode is off by default and cannot be reached by accident.

* `index.html?debug=1` — overlays each module's correct answer and runs the
  self-test in the browser console at startup.
* `Ctrl` + `Shift` + `D` — toggles the same overlay mid-session.
* The **code on the result screen** is the supported way to reproduce a round:
  type it into the SEED page. `index.html?seed=123456` still forces a seed for
  a round started any other way.
* `index.html?start=hard` — skips the menu and arms that difficulty; pair it
  with `?seed=` to reopen a reported bomb in one click.
* `index.html?start=hard&focus=7` — opens the 8th placed module in the focus
  view, for reproducing a layout report.
* `index.html?start=hard&face=back` — starts with the case turned over.
* `index.html?intro=1` — replays the opening; add `&scene=2` to open on a
  particular beat. `?intro=0` skips it when you want the menu directly.
* `index.html?page=5` — opens the selector on a given card.
* `index.html?modes=1` — opens the mode screen, for checking its previews.
* `index.html?mode=solo&split=horizontal` and
  `index.html?mode=twodevice&role=manual` — reopen a layout exactly as it was
  reported. They write through to storage like any other choice.
* Debug builds also export `D.startRound`, `D.makeCode` and `D.parseCode`,
  which is how `tools/run-play.js` drives real rounds.

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
python3 tools/extract-manual.py   # rebuilds manual/rules.js from the printed
                                  # manual. Run it after EVERY edit to the
                                  # .docx: the digital manual is generated from
                                  # that extraction and retypes nothing, which
                                  # is what stops the two drifting apart
python3 tools/check-manual.py     # asserts the PRINTED MANUAL agrees with the
                                  # code: every unit chart value, the angle
                                  # digit table, the binary place values, and
                                  # that no two modules share a tagline
node tools/render-preview.js 5    # writes one round of each module to
node tools/render-units.js        # tools/preview/*.svg for eyeballing artwork
tools/shoot.sh                    # screenshots the real page through headless
                                  # Chrome into tools/shots/ (macOS); add
                                  # --virtual-time-budget to catch a frame
                                  # mid-animation
node tools/check-zoom.js          # real wheel/drag/key/Ctrl+wheel input
                                  # through headless Chrome against the
                                  # case and manual zoom
node tools/measure-audio.js [vol] # peak and loudness of every sound
node tools/check-settings.js      # every setting through the real screen:
                                  # its effect, a reload, and RESET
tools/sheet.html                  # contact sheet: one live bay per module at
                                  # real size, ?seed=N to reroll
```

`tools/dom-shim.js` is a minimal DOM used only by those scripts; the game itself
never loads it.

## Layout

```
index.html
manual/manual.pdf       GENERATED — for printing, which is what PRINTED mode
                        needs. Not what any screen shows
manual/print.html       the manual as a document, for printing and for the PDF
manual/index.html       the same rules as a web page, for reading or printing
                        on anything. No illustrations, no search
manual/rules.js         GENERATED from the .docx — never edited by hand
style.css
js/core.js              namespace, seeded RNG, module registry, serial helpers
js/svg.js               SVG construction helpers
js/audio.js             the synthesised sound kit
js/cutscene.js          the opening: script, typewriter, procedural scenery
js/fx.js                the motion layer: ripples, the iris, count-ups,
                        reveal-on-scroll, parallax. Presentation only
js/mode.js              the mode, the two-device role, the Solo split
js/manual-view.js       the manual mounted inside the game, typeset for the
                        screen it is on
js/game.js              screens, countdown, strikes, bay grid, win/lose
js/selftest.js          generated-round assertions (browser + Node)
js/main.js              boot
js/modules/*.js         one file per puzzle; each opens with the manual rule
                        it implements, so it can be diffed against the print
```
