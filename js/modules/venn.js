/* ==========================================================================
   MODULE: VENN DIAGRAM  (rating: Easy)

   Manual rule implemented here
   ----------------------------
   Three overlapping circles A, B, C inside a box U. Numbers are scattered
   through the eight regions and each number is a clickable button; there is
   also an empty-set button.

   Region numbering
     1 A only         2 B only         3 C only        4 A n B, not C
     5 A n C, not B   6 B n C, not A   7 all three     8 outside all three

   Evaluate the displayed expression region by region; the target set is every
   number lying in a matching region. Click them in ASCENDING NUMERIC ORDER.
   If the target set is empty the single correct action is the empty-set
   button. Clicking a number outside the target set, or out of order, strikes.
   ========================================================================== */

(function (D) {
  'use strict';

  /* region -> which of A,B,C contain it, as a bit mask over regions 1..8 */
  var BITS = {};
  for (var i = 1; i <= 8; i++) BITS[i] = 1 << (i - 1);
  var ALL = 0xFF;
  var SET = {
    A: BITS[1] | BITS[4] | BITS[5] | BITS[7],
    B: BITS[2] | BITS[4] | BITS[6] | BITS[7],
    C: BITS[3] | BITS[5] | BITS[6] | BITS[7]
  };

  function comp(m) { return (~m) & ALL; }

  /* ---- expression templates (at most two operators) ---------------------- */

  var TEMPLATES = [
    { t: '{0} ∪ {1}',   f: function (a, b)    { return a | b; },        n: 2 },
    { t: '{0} ∩ {1}',   f: function (a, b)    { return a & b; },        n: 2 },
    { t: "{0}′",        f: function (a)       { return comp(a); },      n: 1 },
    { t: "{0}′ ∩ {1}",  f: function (a, b)    { return comp(a) & b; },  n: 2 },
    { t: "{0}′ ∪ {1}",  f: function (a, b)    { return comp(a) | b; },  n: 2 },
    { t: "{0} ∩ {1}′",  f: function (a, b)    { return a & comp(b); },  n: 2 },
    { t: "{0} ∪ {1}′",  f: function (a, b)    { return a | comp(b); },  n: 2 },
    { t: "({0} ∩ {1})′", f: function (a, b)   { return comp(a & b); },  n: 2 },
    { t: "({0} ∪ {1})′", f: function (a, b)   { return comp(a | b); },  n: 2 },
    { t: '({0} ∩ {1}) ∪ {2}', f: function (a, b, c) { return (a & b) | c; }, n: 3 },
    { t: '({0} ∪ {1}) ∩ {2}', f: function (a, b, c) { return (a | b) & c; }, n: 3 },
    { t: '({0} ∩ {1}) ∩ {2}', f: function (a, b, c) { return a & b & c; },   n: 3 },
    { t: '({0} ∪ {1}) ∪ {2}', f: function (a, b, c) { return a | b | c; },   n: 3 }
  ];

  /* ---- generation -------------------------------------------------------- */

  function scatterNumbers(rng) {
    /* Choose how many regions are occupied first, then spread 10-14 numbers
       across them with no region holding more than two. Leaving a region or
       three empty is what makes the empty-set answer reachable at all. */
    var active = D.rint(rng, 5, 8);
    var lo = Math.max(10, active), hi = Math.min(14, active * 2);
    if (hi < lo) { active = 8; lo = 10; hi = 14; }
    var total = D.rint(rng, lo, hi);

    var open = D.shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, active);
    var counts = [0, 0, 0, 0, 0, 0, 0, 0];
    var placed = 0, guard = 0, j;
    for (j = 0; j < open.length; j++) { counts[open[j]] = 1; placed++; }
    while (placed < total && guard++ < 500) {
      var r = open[D.rint(rng, 0, open.length - 1)];
      if (counts[r] >= 2) continue;
      counts[r]++; placed++;
    }
    var pool = D.shuffle(rng, (function () {
      var a = [], k;
      for (k = 1; k <= 30; k++) a.push(k);
      return a;
    })()).slice(0, total);

    var regions = {}, idx = 0, region;
    for (region = 1; region <= 8; region++) {
      regions[region] = [];
      for (var j = 0; j < counts[region - 1]; j++) {
        regions[region].push(pool[idx++]);
      }
      regions[region].sort(function (x, y) { return x - y; });
    }
    return regions;
  }

  function generate(rng, ctx) {
    var guard = 0;
    var wantEmpty = rng() < 0.10;
    while (guard++ < 400) {
      var regions = scatterNumbers(rng);
      var letters = D.shuffle(rng, ['A', 'B', 'C']);
      var tpl = D.pick(rng, TEMPLATES);
      var args = letters.slice(0, tpl.n);
      var mask = tpl.f.apply(null, args.map(function (L) { return SET[L]; }));

      /* an expression covering every region is rejected outright */
      if (mask === ALL) continue;

      var text = tpl.t.replace(/\{(\d)\}/g, function (_, k) {
        return args[Number(k)];
      });

      var target = [];
      for (var r = 1; r <= 8; r++) {
        if (mask & BITS[r]) target = target.concat(regions[r]);
      }
      target.sort(function (x, y) { return x - y; });

      /* the empty set is allowed, but only occasionally */
      if ((target.length === 0) !== wantEmpty && guard < 200) continue;

      return { regions: regions, text: text, mask: mask };
    }
    return { regions: scatterNumbers(rng), text: 'A ∩ B',
             mask: SET.A & SET.B };
  }

  /* ---- solution ---------------------------------------------------------- */

  function solve(p) {
    var target = [];
    for (var r = 1; r <= 8; r++) {
      if (p.mask & BITS[r]) target = target.concat(p.regions[r]);
    }
    target.sort(function (a, b) { return a - b; });
    return { target: target, empty: target.length === 0 };
  }

  function debugText(p, s) {
    return s.empty ? 'empty set' : s.target.join(' ');
  }

  function validate(p, s, ctx, fail) {
    if (p.mask === ALL) fail('expression covers all eight regions');
    var seen = {}, count = 0, r, i;
    for (r = 1; r <= 8; r++) {
      if (p.regions[r].length > 2) fail('region ' + r + ' holds more than two');
      for (i = 0; i < p.regions[r].length; i++) {
        var v = p.regions[r][i];
        if (v < 1 || v > 30) fail('number out of 1..30: ' + v);
        if (seen[v]) fail('duplicate number ' + v);
        seen[v] = true; count++;
      }
    }
    if (count < 10 || count > 14) fail('placed ' + count + ' numbers');
    for (i = 1; i < s.target.length; i++) {
      if (s.target[i] <= s.target[i - 1]) fail('target not ascending');
    }
    /* independent recomputation of the target from the region masks */
    var recomputed = [];
    for (r = 1; r <= 8; r++) {
      if (p.mask & BITS[r]) recomputed = recomputed.concat(p.regions[r]);
    }
    recomputed.sort(function (a, b) { return a - b; });
    if (recomputed.join() !== s.target.join()) fail('target mismatch');
  }

  /* ---- rendering --------------------------------------------------------- */

  /* anchor points chosen so both slots of every region stay inside it */
  var ANCHOR = {
    1: [[-101, -45], [-69, -45]],
    2: [[69, -45], [101, -45]],
    3: [[-16, 90], [16, 90]],
    4: [[-16, -55], [16, -55]],
    5: [[-59, 25], [-31, 25]],
    6: [[31, 25], [59, 25]],
    7: [[-14, 0], [14, 0]],
    8: [[-136, 106], [-104, 106]]
  };
  var CENTERS = { A: [-40, -25], B: [40, -25], C: [0, 40] };
  var RAD = 75;

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution, S = D.svg;

    var svg = S.root(-165, -128, 330, 268, 'art');

    S.el('rect', { x: -160, y: -123, width: 320, height: 258,
      fill: '#f7f4ec', stroke: '#333b3f', 'stroke-width': 3 }, svg);
    S.text(svg, -150, -104, 'U', { fill: '#333b3f', 'font-size': 17,
      'font-weight': '700' });

    ['A', 'B', 'C'].forEach(function (L, i) {
      var c = CENTERS[L];
      S.el('circle', { cx: c[0], cy: c[1], r: RAD, fill: 'none',
        stroke: ['#d0574f', '#4180ae', '#4f9d5d'][i], 'stroke-width': 4 }, svg);
      var lp = [[-108, -88], [108, -88], [0, 130]][i];
      S.text(svg, lp[0], lp[1], L, { fill: '#333b3f', 'font-size': 18,
        'font-weight': '700', 'text-anchor': 'middle' });
    });

    var next = 0;
    var buttons = {};

    for (var r = 1; r <= 8; r++) {
      var slots = ANCHOR[r], only = p.regions[r].length === 1;
      p.regions[r].forEach(function (value, slot) {
        var a = only
          ? [(slots[0][0] + slots[1][0]) / 2, slots[0][1]]
          : slots[slot];
        var g = S.el('g', { class: 'hit venn-num' }, svg);
        S.dome(g, a[0], a[1], 14, '#f3efe4', 5);
        var circle = S.el('circle', { cx: a[0], cy: a[1], r: 14,
          fill: 'none', stroke: 'none' }, g);
        var t = S.text(g, a[0], a[1] + 1, String(value), {
          'text-anchor': 'middle', fill: '#333b3f', 'font-size': 14,
          'font-weight': '700'
        });
        t.setAttribute('dominant-baseline', 'middle');
        buttons[value] = { g: g, circle: circle };
        g.addEventListener('click', function () { press(value); });
      });
    }

    var bar = document.createElement('div');
    bar.className = 'side';
    var expr = document.createElement('div');
    expr.className = 'expr';
    expr.textContent = p.text;
    var empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'null-btn';
    empty.textContent = '∅';
    bar.appendChild(expr);
    bar.appendChild(empty);

    var split = document.createElement('div');
    split.className = 'split';
    split.appendChild(svg);
    split.appendChild(bar);
    host.appendChild(split);

    function resetProgress() {
      next = 0;
      Object.keys(buttons).forEach(function (k) {
        buttons[k].g.classList.remove('taken');
      });
    }

    function press(value) {
      if (inst.isSolved()) return;
      if (s.empty) { inst.strike(); resetProgress(); return; }
      if (value === s.target[next]) {
        buttons[value].g.classList.add('taken');
        next++;
        if (next === s.target.length) inst.solve();
      } else {
        inst.strike();
        resetProgress();
      }
    }

    empty.addEventListener('click', function () {
      if (inst.isSolved()) return;
      if (s.empty) inst.solve(); else { inst.strike(); resetProgress(); }
    });
  }

  D.register({
    id: 'venn',
    name: 'VENN DIAGRAM',
    rating: 'easy',
    wide: true,
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
