/* ==========================================================================
   DEFUSAL — the story, as data.

   Each sequence is a list of shots. A shot names its painter (kit-*.js),
   the painter's params, an optional camera move [x, y, zoom] from -> to,
   the narrator's lines, sounds at marks, the score's mood, and how it
   arrives (dissolve, cut, or through black). Timing is worked out by the
   player from the lines; `wait` is the beat before anyone speaks and `hold`
   the beat after.

   The rules of this story, kept from the first version: the species is
   never named, described or explained; nothing says what failure would
   mean; nothing is harmed; the devices are a tally, not a trigger. The
   narrator is the only voice. The two students are silhouettes and never
   speak — the pictures say what they do.

   The city is not named. It is drawn to read as a Bicol city — a volcano on
   the skyline, a river, jeepneys, a public high school — so anyone who
   plays it can take it for their own.
   ========================================================================== */

(function (D) {
  'use strict';

  var SEQ = {

    /* ---- PROLOGUE: CONTACT ------------------------------------------- */
    intro: { end: 'begin', shots: [
      { paint: 'globe', params: { sun: true, dur: 9 }, card: ['PROLOGUE', 'CONTACT'],
        cam: { from: [-0.04, 0, 1], to: [-0.02, 0, 1.12] }, score: 'space', wait: 1.6,
        lines: ['For a long time we only listened.', 'You were loud, and you were young.'] },
      { paint: 'arrival', params: { enter: true, beamAt: 7.5 }, trans: 'cut', wait: 2.4,
        cam: { from: [-0.03, 0.01, 1], to: [0.01, -0.01, 1.08] },
        sfx: [[0, 'boom'], [0.2, 'whoosh'], [7.5, 'hum-on']],
        lines: ['We came close enough to be certain.', 'You did not see us. That was deliberate.'] },
      { paint: 'globe', params: { night: true, falling: true, scale: 0.5, x: 820, y: 470, dur: 7 },
        cam: { from: [0, 0, 1.02], to: [0.01, 0, 1.1] }, wait: 1.4, hold: 2.2,
        sfx: [[0, 'hum-off']],
        lines: ['We left something in every place you live.'] },
      { paint: 'city-night', params: { streak: true }, score: 'city', wait: 2.4,
        cam: { from: [0, -0.02, 1], to: [0.02, 0, 1.1] }, sfx: [[1.4, 'whoosh']],
        lines: ['We chose places you return to every day.'] },
      { paint: 'device', params: { wake: true }, wait: 1.6,
        cam: { from: [0, 0, 1.08], to: [0, 0, 1] }, sfx: [[1.0, 'sting']],
        lines: ['We do not speak your languages.', 'We did not need to.'] },
      { paint: 'constellation', score: 'space', wait: 1.4,
        cam: { from: [0, 0, 1], to: [0, 0, 1.06] },
        lines: ['Every thinking species arrives at the same mathematics.',
                'It is the only thing we could be certain you would understand.'] },
      { paint: 'desk', wait: 1.2, cam: { from: [-0.03, 0, 1.06], to: [0.03, 0, 1.06] },
        lines: ['So we built our questions out of yours.', 'Your units. Your notation. Your figures.',
                'We have returned them to you.'] },
      { paint: 'school', params: { flag: true }, score: 'city', trans: 'black', wait: 1.8,
        card: ['MORNING', 'THE RULES'],
        cam: { from: [0, 0.02, 1], to: [0, -0.01, 1.08] },
        lines: ['The rules were sent apart from the devices.', 'Deliberately.'] },
      { paint: 'classroom', params: { people: 'meet', light: 'morning' }, wait: 1.2,
        cam: { from: [0.02, 0, 1.04], to: [-0.02, 0, 1.1] },
        lines: ['One of you may hold the device.', 'One of you may hold the rules.', 'Neither of you may hold both.'] },
      { paint: 'apart', wait: 1.0,
        cam: { from: [0, 0, 1], to: [0, 0, 1.05] },
        lines: ['We are not measuring what one of you knows.',
                'We are measuring whether you can reach each other in time.'] },
      { paint: 'globe', params: { night: true, points: true, scale: 0.5, x: 800, y: 470 }, score: 'tension', wait: 0.8,
        cam: { from: [0, 0, 1.12], to: [0, 0, 1] },
        lines: ['There are many devices.', 'You will not answer them all.', 'Answer enough.'] },
      { paint: 'point', trans: 'black', wait: 2.6, hold: 1.4, score: null, sfx: [[1.2, 'sting']],
        lines: ['Begin.'] }
    ] },

    /* ---- before and after each device --------------------------------- */
    pre1: { shots: [
      { paint: 'classroom', params: { rain: 1, device: 'wake', people: 'none', light: 'dusk' },
        card: ['DEVICE ONE', 'TRIVIAL'], score: 'tension', wait: 1.8,
        cam: { from: [0, 0, 1.0], to: [0.02, 0.01, 1.12] },
        sfx: [[0, 'rain-on'], [1.4, 'sting']],
        lines: ['This one is small.', 'It is meant to be.'] }
    ] },
    s1: { shots: [
      { paint: 'classroom', params: { rain: 0.4, device: 'dark', people: 'none', light: 'night', skyLight: true },
        score: 'city', wait: 1.6, cam: { from: [0.02, 0, 1.08], to: [0, 0, 1] },
        sfx: [[0, 'rain-on'], [5, 'rain-off']],
        lines: ['One device answered.', 'We have adjusted the next.'] }
    ] },

    pre2: { shots: [
      { paint: 'market', params: { time: 'dawn', device: 'wake' },
        card: ['DEVICE TWO', 'ELEMENTARY'], score: 'tension', wait: 2.0,
        cam: { from: [-0.03, 0, 1], to: [0.02, 0, 1.1] }, sfx: [[1.6, 'sting']],
        lines: ['You trade here. You count here.', 'You will count for us.'] }
    ] },
    s2: { shots: [
      { paint: 'market', params: { time: 'morning', device: 'dark' }, score: 'city', wait: 1.4,
        cam: { from: [0.02, 0, 1.08], to: [-0.01, 0, 1] },
        lines: ['Two.', 'You are quicker than we recorded.'] }
    ] },

    pre3: { shots: [
      { paint: 'terminal', params: { split: true }, card: ['DEVICE THREE', 'NONTRIVIAL'],
        score: 'tension', wait: 2.0, cam: { from: [-0.04, 0, 1.02], to: [0.04, 0, 1.1] },
        sfx: [[1.6, 'sting']],
        lines: ['This time we have put distance between you.',
                'Distance is only a problem if you stop talking.'] }
    ] },
    s3: { shots: [
      { paint: 'terminal', params: { together: true }, score: 'city', wait: 1.4,
        cam: { from: [0.03, 0, 1.08], to: [0, 0, 1] },
        lines: ['Three.', 'The rules were no use to you until you said them aloud.', 'We noticed.'] }
    ] },

    pre4: { shots: [
      { paint: 'court', params: { storm: 1 }, card: ['DEVICE FOUR', 'PATHOLOGICAL'],
        score: 'tension', wait: 2.2, cam: { from: [0, 0.02, 1], to: [0, 0, 1.12] },
        sfx: [[0, 'rain-on'], [1.2, 'thunder']],
        lines: ['Your light failed.', 'Your arithmetic did not.'] }
    ] },
    s4: { shots: [
      { paint: 'court', params: { storm: 0.3, after: true }, score: 'city', wait: 1.6,
        cam: { from: [0, 0, 1.1], to: [0, 0, 1] }, sfx: [[0, 'rain-on'], [4, 'rain-off']],
        lines: ['Four. One remains.', 'We have not made it kind.'] }
    ] },

    pre5: { shots: [
      { paint: 'bridge', params: { night: true, saucer: true }, card: ['DEVICE FIVE', 'INTRACTABLE'],
        score: 'tension', wait: 2.4, cam: { from: [0, 0.04, 1], to: [0, -0.02, 1.14] },
        sfx: [[1.0, 'hum-on'], [2.0, 'sting']],
        lines: ['Everyone you know is awake tonight.', 'This is the last one we brought.'] }
    ] },

    /* ---- FINALE: RECORD ------------------------------------------------ */
    finale: { end: 'credits', shots: [
      { paint: 'globe', params: { night: true, dimming: true, scale: 0.5, x: 800, y: 470, dur: 8 },
        card: ['FINALE', 'RECORD'], score: 'resolve', wait: 1.6, hold: 1.4,
        cam: { from: [0, 0, 1], to: [0, 0, 1.1] }, sfx: [[0, 'hum-off']],
        lines: ['The last device is answered.', 'It is going quiet. They all are.'] },
      { paint: 'bridge', params: { sunrise: true, sitting: true }, wait: 2.0,
        cam: { from: [-0.02, 0.02, 1.0], to: [0.02, 0, 1.08] },
        lines: ['We will record what we saw here.', 'Two of you. One holding a thing you did not build.',
                'One holding words you did not write.', 'Neither of you able to finish alone.',
                'That is the whole of the test.'] },
      { paint: 'arrival', params: { leave: true, x: 820 }, wait: 1.6, sfx: [[0.4, 'whoosh']],
        cam: { from: [0, 0, 1.06], to: [0.02, -0.01, 1] },
        lines: ['We are leaving.', 'You may keep the rules.', 'You will need them for each other.'] },
      { paint: 'globe', params: { sun: true }, wait: 1.4, hold: 2.4,
        cam: { from: [-0.02, 0, 1.12], to: [-0.04, 0, 1] },
        lines: ['For now, that is enough.'] },
      { paint: 'credits-sky', trans: 'black', wait: 0.5, dur: 3 }
    ] }
  };

  D.cine = D.cine || {};
  D.cine.SEQ = SEQ;
})(DEFUSAL);
