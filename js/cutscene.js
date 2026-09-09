/* ==========================================================================
   DEFUSAL — the story.

   One cutscene player driving several sequences: the opening, a short beat
   after each stage, and the conclusion. Everything is presentation; it never
   touches a module, a rule or a generated problem.

   Procedural like the rest of the game — the scenery is inline SVG built at
   runtime, the sound is synthesised. No asset files.
   ========================================================================== */

(function (D) {
  'use strict';

  var TYPE_MS = 24;          /* per character */
  var HOLD_MS = 260;         /* beat before the "go on" prompt appears */
  var STORE_KEY = 'defusal.intro';

  /* ---------- the sequences --------------------------------------------------- */

  var SEQ = {
    intro: [
      { art: 'earth', wait: 1600, lines: [
        'For a long time we only listened.',
        'You were loud, and you were young.'
      ] },
      { art: 'arrival', wait: 2600, lines: [
        'We came close enough to be certain.',
        'You did not see us. That was deliberate.'
      ] },
      { art: 'drop', wait: 1900, lines: [
        'We left something in every place you live.'
      ] },
      { art: 'device', wait: 1500, lines: [
        'We do not speak your languages.',
        'We did not need to.'
      ] },
      { art: 'stars', lines: [
        'Every thinking species arrives at the same mathematics.',
        'It is the only thing we could be certain you would understand.'
      ] },
      { art: 'objects', lines: [
        'So we built our questions out of yours.',
        'Your units. Your notation. Your figures.',
        'We have returned them to you.'
      ] },
      { art: 'binder', lines: [
        'The rules were sent apart from the devices.',
        'Deliberately.',
        'One of you may hold the device.',
        'One of you may hold the rules.',
        'Neither of you may hold both.'
      ] },
      { art: 'apart', lines: [
        'We are not measuring what one of you knows.',
        'We are measuring whether you can reach each other in time.'
      ] },
      { art: 'tally', lines: [
        'There are many devices.',
        'You will not answer them all.',
        'Answer enough.'
      ] },
      { art: 'point', wait: 900, lines: [
        'Begin.'
      ] }
    ],

    s1: [ { art: 'device', lines: [
      'One device answered.',
      'We have adjusted the next.'
    ] } ],

    s2: [ { art: 'tally', lines: [
      'Two.',
      'You are quicker than we recorded.'
    ] } ],

    s3: [ { art: 'apart', lines: [
      'Three.',
      'The rules were no use to you until you said them aloud.',
      'We noticed.'
    ] } ],

    s4: [ { art: 'device', lines: [
      'Four. One remains.',
      'We have not made it kind.'
    ] } ],

    finale: [
      { art: 'device-dark', lines: [
        'The last device is answered.',
        'It is going quiet. They all are.'
      ] },
      { art: 'apart', lines: [
        'We will record what we saw here.',
        'Two of you. One holding a thing you did not build.',
        'One holding words you did not write.',
        'Neither of you able to finish alone.',
        'That is the whole of the test.'
      ] },
      { art: 'leaving', lines: [
        'We are leaving.',
        'You may keep the rules.',
        'You will need them for each other.'
      ] },
      { art: 'earth', lines: [
        'For now, that is enough.'
      ] }
    ]
  };

  /* ---------- state ------------------------------------------------------------ */

  var node = {}, seq = null, seqName = '', scene = 0, line = 0;
  var typing = false, timer = null, holdTimer = null, autoTimer = null;
  var waitTimer = null;
  var full = '', shown = 0, active = false, onDone = null;

  /* how long a finished line stays up before the next one arrives; the click
     is still there for anyone who reads faster */
  function readHold(text) { return 520 + text.length * 19; }

  function lastBeat() {
    return scene === seq.length - 1 && line === seq[scene].lines.length - 1;
  }

  function reduced() {
    try {
      return window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }
  function seen() {
    try { return window.localStorage.getItem(STORE_KEY) === 'done'; }
    catch (e) { return false; }      /* storage blocked: just play it again */
  }
  function markSeen() {
    try { window.localStorage.setItem(STORE_KEY, 'done'); } catch (e) {}
  }

  /* ---------- scenery ----------------------------------------------------------- */

  var S = D.svg;
  var LINEC = '#b9ccd6', DIM = '#3d525e', LIT = '#6fd7e8';

  function frame() { return S.root(0, 0, 1000, 560, 'cs-art'); }

  function ink(parent, tag, attrs) {
    attrs = attrs || {};
    attrs.fill = attrs.fill || 'none';
    attrs.stroke = attrs.stroke || LINEC;
    attrs['stroke-width'] = attrs['stroke-width'] || 2.6;
    attrs['stroke-linejoin'] = 'round';
    attrs['stroke-linecap'] = 'round';
    return S.el(tag, attrs, parent);
  }

  function starfield(svg, n, seed) {
    var rng = D.makeRng(seed || 4242), i;
    for (i = 0; i < n; i++) {
      /* only a few of them twinkle: animating all 200 is the same mistake
         that made the backdrop lag, and nobody can watch 200 at once */
      var live = (i % 7 === 0);
      var c = S.el('circle', {
        cx: D.rint(rng, 4, 996), cy: D.rint(rng, 4, 430),
        r: D.rint(rng, 5, 18) / 10, fill: '#cfe0e8',
        opacity: 0.12 + D.rint(rng, 0, 55) / 100,
        class: live ? 'cs-star' : ''
      }, svg);
      if (live) {
        c.setAttribute('style',
          'animation-delay:' + (D.rint(rng, 0, 500) / 100) + 's');
      }
    }
  }

  /* a world anyone would name on sight */
  function earthGlobe(svg, cx, cy, r) {
    S.el('circle', { cx: cx, cy: cy, r: r + 14, fill: 'none',
      stroke: '#3fa9d8', 'stroke-width': 8, opacity: .35, class: 'cs-glow' }, svg);
    S.el('circle', { cx: cx, cy: cy, r: r, fill: '#1c5f96' }, svg);

    var clip = S.el('clipPath', { id: 'globeclip' }, svg);
    S.el('circle', { cx: cx, cy: cy, r: r }, clip);
    var g = S.el('g', { 'clip-path': 'url(#globeclip)' }, svg);
    var k = r / 100;
    function land(d) {
      S.el('path', { d: d, fill: '#3f8c50', stroke: '#2f6d3e',
        'stroke-width': 1.5, transform: 'translate(' + cx + ',' + cy +
        ') scale(' + k + ')' }, g);
    }
    /* blocked-in continents: read as land masses, not as any one map */
    land('M-74 -46 q22 -20 44 -8 q16 -14 34 -2 q12 12 2 24 q-18 8 -34 2 ' +
         'q-16 12 -32 2 q-16 -6 -14 -18 Z');
    land('M-30 -6 q16 -8 26 4 q10 16 2 34 q-6 22 -20 30 q-14 -10 -14 -34 ' +
         'q-2 -22 6 -34 Z');
    land('M22 -30 q28 -14 48 4 q14 16 4 30 q-16 14 -34 8 q-20 -6 -24 -22 Z');
    land('M34 20 q22 -6 30 10 q6 18 -8 28 q-18 6 -26 -8 q-6 -16 4 -30 Z');
    land('M-86 44 q18 -8 30 4 q6 14 -8 20 q-18 4 -24 -8 Z');
    /* cloud bands */
    [[-58, -22, 62, 9], [10, 6, 74, 11], [-24, 44, 56, 8]].forEach(function (c) {
      S.el('ellipse', { cx: cx + c[0] * k, cy: cy + c[1] * k,
        rx: c[2] * k, ry: c[3] * k, fill: '#eaf6ff', opacity: .3,
        class: 'cs-clouds' }, g);
    });
    /* the night side */
    S.el('circle', { cx: cx + r * 0.42, cy: cy - r * 0.12, r: r * 1.02,
      fill: '#04121c', opacity: .55 }, g);
    S.el('circle', { cx: cx - r * 0.34, cy: cy - r * 0.34, r: r * 0.5,
      fill: '#ffffff', opacity: .10 }, g);
  }

  /* the establishing shot: the whole world, centred */
  function limb(svg) { earthGlobe(svg, 500, 320, 210); }

  /* every shot with a craft in it: the world sits large and low so only its
     upper curve shows, which is what gives the craft any sense of altitude */
  function limbLow(svg) { earthGlobe(svg, 500, 1060, 660); }

  /* A craft, drawn so a child names it without being told: saucer hull,
     dome, a ring of lights. No crew, nothing to read a species from. */
  function hull(parent, cls) {
    var g = S.el('g', { class: cls }, parent);
    /* under-glow */
    S.el('ellipse', { cx: 400, cy: 322, rx: 150, ry: 26, fill: LIT,
      opacity: .18, class: 'cs-blink' }, g);
    /* hull */
    S.el('ellipse', { cx: 400, cy: 300, rx: 210, ry: 46,
      fill: '#2b3f4a', stroke: LINEC, 'stroke-width': 3 }, g);
    S.el('path', { d: 'M190 300 q210 62 420 0 q-210 40 -420 0 Z',
      fill: '#1b2c35' }, g);
    /* dome */
    S.el('path', { d: 'M318 288 a86 74 0 0 1 164 0 Z', fill: '#3d5a68',
      stroke: LINEC, 'stroke-width': 3 }, g);
    S.el('path', { d: 'M344 280 a58 48 0 0 1 44 -44', fill: 'none',
      stroke: '#cfeaf3', 'stroke-width': 5, opacity: .5,
      'stroke-linecap': 'round' }, g);
    /* rim lights */
    [-160, -96, -32, 32, 96, 160].forEach(function (dx, i) {
      S.el('circle', { cx: 400 + dx, cy: 314, r: 8, fill: LIT,
        class: 'cs-blink', style: 'animation-delay:' + (i * 0.28) + 's' }, g);
    });
    S.el('ellipse', { cx: 400, cy: 300, rx: 210, ry: 46, fill: 'none',
      stroke: LINEC, 'stroke-width': 3 }, g);
    return g;
  }

  /* A glow with no filter: a wide faint stroke sitting under a bright one.
     A screen-sized blur is what made the backdrop lag, so nothing here uses
     one — this costs a single extra path. */
  function glow(parent, tag, attrs, color, spread) {
    var wide = {}, k;
    for (k in attrs) if (attrs.hasOwnProperty(k)) wide[k] = attrs[k];
    wide.fill = 'none';
    wide.stroke = color || LIT;
    wide['stroke-width'] = (attrs['stroke-width'] || 2.6) + (spread || 7);
    wide.opacity = 0.16;
    wide['stroke-linejoin'] = 'round';
    wide['stroke-linecap'] = 'round';
    S.el(tag, wide, parent);
    return ink(parent, tag, attrs);
  }

  /* A shaft of light, built from nested wedges: one flat triangle reads as a
     grey shape, several stacked read as something luminous. */
  function beam(parent, cx, yTop, yBot) {
    var g = S.el('g', { class: 'cs-beam' }, parent);

    /* Across the shaft rather than in bands: stacked wedges leave visible
       edges where they overlap, and light has none. A gradient is only a
       paint — it costs nothing like the blur that made the backdrop lag. */
    var lg = S.el('linearGradient', { id: 'csbeam', x1: '0', y1: '0',
      x2: '1', y2: '0' }, g);
    [[0, 0], [0.18, .05], [0.5, .17], [0.82, .05], [1, 0]]
      .forEach(function (st) {
        S.el('stop', { offset: st[0], 'stop-color': LIT,
          'stop-opacity': st[1] }, lg);
      });

    S.el('path', { d: 'M' + (cx - 46) + ' ' + yTop + ' L' + (cx - 196) + ' ' +
      yBot + ' L' + (cx + 196) + ' ' + yBot + ' L' + (cx + 46) + ' ' + yTop +
      ' Z', fill: 'url(#csbeam)' }, g);

    /* a brighter core down the middle */
    S.el('path', { d: 'M' + (cx - 13) + ' ' + yTop + ' L' + (cx - 54) + ' ' +
      yBot + ' L' + (cx + 54) + ' ' + yBot + ' L' + (cx + 13) + ' ' + yTop +
      ' Z', fill: LIT, opacity: .07 }, g);

    /* where it lands */
    S.el('ellipse', { cx: cx, cy: yBot, rx: 196, ry: 26, fill: LIT,
      opacity: .08 }, g);
    S.el('ellipse', { cx: cx, cy: yBot, rx: 98, ry: 14, fill: LIT,
      opacity: .12 }, g);
    return g;
  }

  /* One of the devices on its way down. Small, but the same object as the
     one the defuser ends up holding: dark case, one lit band. */
  function pod(parent, x, y, k, delay) {
    var g = S.el('g', { class: 'cs-drop',
      style: 'animation-delay:' + delay + 's' }, parent);
    var w = 22 * k, h = 30 * k;
    S.el('line', { x1: x, y1: y - 8 * k, x2: x, y2: y - 78 * k, stroke: LIT,
      'stroke-width': 2.2 * k, opacity: .28, 'stroke-linecap': 'round' }, g);
    S.el('rect', { x: x - w / 2, y: y, width: w, height: h, rx: 6 * k,
      fill: '#16242c', stroke: LINEC, 'stroke-width': 2.2 * k }, g);
    S.el('rect', { x: x - w / 2 + 4 * k, y: y + h * 0.34,
      width: w - 8 * k, height: 5.5 * k, rx: 2 * k, fill: LIT, opacity: .85 }, g);
    return g;
  }

  /* one of the devices, schematic */
  function unit(parent, lit) {
    var g = S.el('g', {}, parent);

    /* a case with a body: the outline alone read as a diagram */
    S.el('rect', { x: 300, y: 176, width: 400, height: 250, rx: 18,
      fill: '#0d161b' }, g);
    glow(g, 'rect', { x: 300, y: 176, width: 400, height: 250, rx: 18,
      'stroke-width': 3 }, lit ? LIT : DIM, 8);

    S.el('rect', { x: 388, y: 196, width: 224, height: 48, rx: 8,
      fill: '#061016' }, g);
    ink(g, 'rect', { x: 388, y: 196, width: 224, height: 48, rx: 8,
      'stroke-width': 2 });

    [0, 1].forEach(function (r) {
      [0, 1, 2].forEach(function (c) {
        var x = 330 + c * 116, y = 262 + r * 80;
        S.el('rect', { x: x, y: y, width: 96, height: 64, rx: 8,
          fill: '#111f27' }, g);
        var b = ink(g, 'rect', { x: x, y: y, width: 96, height: 64, rx: 8,
          'stroke-width': 2 });
        if (lit) {
          b.setAttribute('class', 'cs-lightup');
          b.setAttribute('style',
            'animation-delay:' + (0.4 + (r * 3 + c) * 0.28) + 's');
        } else {
          b.setAttribute('opacity', '.35');
        }
      });
    });

    if (lit) {
      S.el('text', { x: 500, y: 230, 'text-anchor': 'middle', fill: LIT,
        'font-size': 30, 'font-family': 'inherit', class: 'cs-lightup',
        style: 'animation-delay:1.9s' }, g).textContent = '00:00';
    }
    return g;
  }

  var ART = {
    earth: function () {
      var svg = frame();
      starfield(svg, 150, 11);
      limb(svg);
      return svg;
    },

    arrival: function () {
      var svg = frame();
      starfield(svg, 120, 21);
      limbLow(svg);
      hull(svg, 'cs-slide-in');
      return svg;
    },

    /* The craft, its beam and what it sets down all share one axis. They did
       not before: the hull sat left of a beam that pointed somewhere else,
       and seven identical pods spread across the frame in a flat row. */
    drop: function () {
      var svg = frame();
      starfield(svg, 110, 31);
      limbLow(svg);

      var CX = 500, TOP = 168, GROUND = 404;

      beam(svg, CX, TOP, GROUND);

      /* four, at different distances, so the shaft has depth */
      [[-46, 196, 0.62, 0.0], [22, 178, 0.78, 1.3],
       [-14, 206, 1.0, 2.6], [56, 188, 0.72, 3.9]]
        .forEach(function (q) { pod(svg, CX + q[0], q[1], q[2], q[3]); });

      /* the craft last, so it sits above its own light */
      var g = S.el('g', { transform: 'translate(300,-18) scale(.5)' }, svg);
      hull(g, '');
      return svg;
    },

    device: function () {
      var svg = frame();
      starfield(svg, 60, 41);
      unit(svg, true);
      return svg;
    },

    'device-dark': function () {
      var svg = frame();
      starfield(svg, 60, 41);
      var g = unit(svg, false);
      g.setAttribute('class', 'cs-dim');
      return svg;
    },

    stars: function () {
      var svg = frame();
      starfield(svg, 200, 5);
      /* a few points resolving into the same three figures anyone would find */
      var g = S.el('g', { class: 'cs-appear', style: 'animation-delay:.8s' }, svg);
      ink(g, 'polygon', { points: '250,330 350,330 300,244' });
      ink(g, 'circle', { cx: 500, cy: 288, r: 52 });
      ink(g, 'rect', { x: 652, y: 240, width: 92, height: 92 });
      ink(g, 'path', { d: 'M652 240 L744 332 M744 240 L652 332', opacity: .5 });
      return svg;
    },

    objects: function () {
      var svg = frame();
      var slot = [170, 390, 610, 830], k = 0;
      function bay() {
        return S.el('g', { class: 'cs-appear',
          style: 'animation-delay:' + (k++ * 0.8) + 's' }, svg);
      }

      /* a ruler */
      var g0 = bay();
      S.el('rect', { x: slot[0] - 90, y: 250, width: 180, height: 54, rx: 4,
        fill: '#2a2416' }, g0);
      ink(g0, 'rect', { x: slot[0] - 90, y: 250, width: 180, height: 54, rx: 4 });
      for (var t = 0; t <= 12; t++) {
        var x = slot[0] - 84 + t * 14;
        ink(g0, 'line', { x1: x, y1: 250, x2: x,
          y2: 250 + (t % 4 === 0 ? 26 : 14), 'stroke-width': 1.8 });
      }

      /* a protractor over its baseline */
      var g1 = bay();
      S.el('path', { d: 'M' + (slot[1] - 62) + ' 268 a62 62 0 0 1 124 0 Z',
        fill: '#12262c' }, g1);
      ink(g1, 'circle', { cx: slot[1], cy: 268, r: 62 });
      ink(g1, 'line', { x1: slot[1], y1: 268, x2: slot[1] + 34, y2: 232 });
      ink(g1, 'line', { x1: slot[1] - 78, y1: 336, x2: slot[1] + 78, y2: 336 });
      ink(g1, 'line', { x1: slot[1], y1: 330, x2: slot[1], y2: 300 });

      /* a measure with something in it */
      var g2 = bay();
      S.el('rect', { x: slot[2] - 52, y: 208, width: 104, height: 146, rx: 10,
        fill: '#0e1c24' }, g2);
      S.el('rect', { x: slot[2] - 52, y: 286, width: 104, height: 68,
        fill: '#1f6fa8', opacity: .5 }, g2);
      ink(g2, 'rect', { x: slot[2] - 52, y: 208, width: 104, height: 146, rx: 10 });
      [246, 274, 302, 330].forEach(function (y) {
        ink(g2, 'line', { x1: slot[2] - 52, y1: y, x2: slot[2] - 26, y2: y,
          'stroke-width': 1.8, opacity: .7 });
      });

      /* a figure */
      var g3 = bay();
      var tri = (slot[3] - 82) + ',336 ' + (slot[3] + 82) + ',336 ' +
                (slot[3] - 18) + ',204';
      S.el('polygon', { points: tri, fill: '#101d24' }, g3);
      ink(g3, 'polygon', { points: tri });
      return svg;
    },

    binder: function () {
      var svg = frame();
      var g = S.el('g', { class: 'cs-appear' }, svg);
      S.el('rect', { x: 372, y: 168, width: 256, height: 226, rx: 8,
        fill: '#15120c' }, g);
      glow(g, 'rect', { x: 372, y: 168, width: 256, height: 226, rx: 8,
        'stroke-width': 3 }, '#d8c07a', 7);
      S.el('rect', { x: 372, y: 168, width: 54, height: 226, rx: 8,
        fill: '#0f0d09' }, g);
      ink(g, 'rect', { x: 372, y: 168, width: 54, height: 226, rx: 8, 'stroke-width': 3 });
      [212, 262, 312, 362].forEach(function (y) {
        ink(g, 'circle', { cx: 399, cy: y, r: 9, 'stroke-width': 2 });
      });
      [206, 226, 246, 266].forEach(function (y, i) {
        ink(g, 'line', { x1: 452, y1: y, x2: i === 3 ? 548 : 596, y2: y,
          'stroke-width': 1.8, opacity: .7 });
      });
      return svg;
    },

    /* Two people, each holding half of it. The gap down the middle is the
       whole idea, so the scene now actually has one. */
    apart: function () {
      var svg = frame();

      S.el('line', { x1: 500, y1: 150, x2: 500, y2: 412, stroke: DIM,
        'stroke-width': 2, 'stroke-dasharray': '3 14', opacity: .55,
        class: 'cs-appear', style: 'animation-delay:.9s' }, svg);

      var dev = S.el('g', { class: 'cs-drift-l' }, svg);
      S.el('rect', { x: 96, y: 186, width: 250, height: 190, rx: 14,
        fill: '#0d161b' }, dev);
      glow(dev, 'rect', { x: 96, y: 186, width: 250, height: 190, rx: 14,
        'stroke-width': 3 }, LIT, 7);
      [0, 1].forEach(function (r) {
        [0, 1].forEach(function (c) {
          var x = 124 + c * 104, y = 214 + r * 82;
          S.el('rect', { x: x, y: y, width: 84, height: 62, rx: 6,
            fill: '#111f27' }, dev);
          ink(dev, 'rect', { x: x, y: y, width: 84, height: 62, rx: 6,
            'stroke-width': 2 });
        });
      });

      var bin = S.el('g', { class: 'cs-drift-r' }, svg);
      S.el('rect', { x: 654, y: 186, width: 250, height: 190, rx: 8,
        fill: '#15120c' }, bin);
      glow(bin, 'rect', { x: 654, y: 186, width: 250, height: 190, rx: 8,
        'stroke-width': 3 }, '#d8c07a', 7);
      S.el('rect', { x: 654, y: 186, width: 48, height: 190, rx: 8,
        fill: '#0f0d09' }, bin);
      ink(bin, 'rect', { x: 654, y: 186, width: 48, height: 190, rx: 8,
        'stroke-width': 3 });
      [222, 262, 302, 342].forEach(function (y) {
        ink(bin, 'circle', { cx: 678, cy: y, r: 8, 'stroke-width': 2 });
      });
      /* lines of text on the page, so it reads as rules and not a slab */
      [216, 240, 264, 288, 312, 336].forEach(function (y, i) {
        ink(bin, 'line', { x1: 726, y1: y, x2: i % 3 === 2 ? 830 : 872,
          y2: y, 'stroke-width': 1.8, opacity: .45 });
      });
      return svg;
    },

    /* a long row of marks, most of them still blank */
    tally: function () {
      var svg = frame();
      var rng = D.makeRng(1234);
      for (var r = 0; r < 5; r++) {
        for (var c = 0; c < 22; c++) {
          var x = 96 + c * 37, y = 176 + r * 46;
          var done = D.rint(rng, 0, 9) < 3;
          var m = ink(svg, 'line', { x1: x, y1: y, x2: x + 8, y2: y + 30,
            'stroke-width': done ? 3 : 2,
            stroke: done ? LINEC : DIM, opacity: done ? 1 : .5 });
          m.setAttribute('class', 'cs-appear');
          m.setAttribute('style', 'animation-delay:' + ((r * 22 + c) * 0.012) + 's');
        }
      }
      return svg;
    },

    leaving: function () {
      var svg = frame();
      starfield(svg, 140, 63);
      limbLow(svg);
      hull(svg, 'cs-slide-out');
      return svg;
    },

    point: function () {
      var svg = frame();
      S.el('circle', { cx: 500, cy: 280, r: 6, fill: '#ffcf5c', class: 'cs-spark' }, svg);
      S.text(svg, 500, 292, '00:00', {
        'text-anchor': 'middle', fill: '#ffcf5c', 'font-size': 84,
        'font-family': 'inherit', class: 'cs-digits'
      });
      return svg;
    }
  };

  /* ---------- playback ---------------------------------------------------------- */

  function paintScene() {
    node.art.innerHTML = '';
    var build = ART[seq[scene].art] || ART.earth;
    node.art.appendChild(build());
    node.art.classList.remove('in');
    void node.art.offsetWidth;
    node.art.classList.add('in');
  }

  function stopTyping() {
    if (timer) { clearInterval(timer); timer = null; }
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
    typing = false;
  }

  /* let the scene play for a moment before anyone speaks over it */
  function enterScene() {
    stopTyping();
    node.text.textContent = '';
    node.prompt.classList.remove('ready');
    var w = reduced() ? 0 : (seq[scene].wait || 550);
    waitTimer = setTimeout(function () { waitTimer = null; startLine(); }, w);
  }

  function startLine() {
    stopTyping();
    full = seq[scene].lines[line];
    shown = 0;
    node.prompt.classList.remove('ready');
    if (reduced()) { finishLine(); return; }
    typing = true;
    node.text.textContent = '';
    timer = setInterval(function () {
      shown++;
      node.text.textContent = full.slice(0, shown);
      if (shown >= full.length) finishLine();
    }, TYPE_MS);
  }

  function finishLine() {
    stopTyping();
    node.text.textContent = full;
    D.audio.line();
    holdTimer = setTimeout(function () {
      node.prompt.classList.add('ready');
    }, reduced() ? 0 : HOLD_MS);

    if (lastBeat() && seqName === 'intro') { offerBegin(); return; }
    /* it carries itself from here; clicking only hurries it along */
    autoTimer = setTimeout(function () { autoTimer = null; advance(); },
      readHold(full));
  }

  function offerBegin() {
    node.begin.hidden = false;
    node.begin.classList.add('in');
  }

  function advance() {
    if (waitTimer) { stopTyping(); startLine(); return; }  /* skip the beat */
    if (typing) { finishLine(); return; }   /* complete before moving on */
    if (!node.begin.hidden) return;         /* the last beat waits for BEGIN */
    D.audio.click();
    line++;
    if (line >= seq[scene].lines.length) {
      scene++;
      line = 0;
      if (scene >= seq.length) { finish(); return; }
      paintScene();
      enterScene();
      return;
    }
    startLine();
  }

  function finish() {
    stopTyping();
    node.begin.hidden = true;
    node.begin.classList.remove('in');
    active = false;
    D.audio.music(false);
    node.root.classList.remove('open');
    node.root.hidden = true;
    document.body.classList.remove('cutscene-open');
    var cb = onDone; onDone = null;
    if (cb) cb();
    else if (D.showMenu) D.showMenu();
  }

  function play(name, done) {
    seqName = name || 'intro';
    seq = SEQ[name] || SEQ.intro;
    if (name === 'intro' || !name) markSeen();
    onDone = done || null;
    /* ?scene=N opens on a given beat, for checking the scenery */
    var at = /[?&]scene=(\d)/.exec(location.search);
    scene = at ? D.clamp(Number(at[1]), 0, seq.length - 1) : 0;
    line = 0; active = true;
    node.begin.hidden = true;
    node.begin.classList.remove('in');
    node.root.hidden = false;
    node.root.classList.add('open');
    document.body.classList.add('cutscene-open');
    paintScene();
    enterScene();
    D.audio.unlock();
    D.audio.music(true);
    D.audio.intro();
  }

  /* ---------- wiring ------------------------------------------------------------ */

  D.cutscene = {
    isActive: function () { return active; },
    play: play,
    has: function (name) { return !!SEQ[name]; },
    skip: finish,

    init: function () {
      node.root = document.getElementById('cutscene');
      node.art = document.getElementById('cs-art');
      node.text = document.getElementById('cs-text');
      node.prompt = document.getElementById('cs-prompt');
      node.skip = document.getElementById('cs-skip');
      node.begin = document.getElementById('cs-begin');

      node.begin.addEventListener('click', function (e) {
        e.stopPropagation();
        D.audio.click();
        finish();
        if (D.startFirstDevice) D.startFirstDevice();
      });

      node.root.addEventListener('click', function (e) {
        if (e.target === node.skip || node.skip.contains(e.target)) return;
        advance();
      });
      node.skip.addEventListener('click', function (e) {
        e.stopPropagation();
        D.audio.click();
        finish();
      });
      document.addEventListener('keydown', function (e) {
        if (!active) return;
        if (e.key === 'Escape') { e.preventDefault(); finish(); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      });
    },

    maybePlay: function () {
      if (/[?&]start=/.test(location.search)) return;
      if (/[?&]intro=0/.test(location.search)) return;
      var want = /[?&]cs=(\w+)/.exec(location.search);
      if (want && SEQ[want[1]]) { play(want[1]); return; }
      if (/[?&]intro=1/.test(location.search)) { play('intro'); return; }
      if (seen()) return;
      play('intro');
    }
  };
})(DEFUSAL);
