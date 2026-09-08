/* ==========================================================================
   MODULE: PARALLEL LINES CUT BY A TRANSVERSAL  (rating: Medium)

   Manual rule implemented here
   ----------------------------
   Eight clickable angles. At each intersection they are numbered CLOCKWISE
   FROM THE UPPER LEFT: 1-4 at the upper intersection, 5-8 at the lower.
   Angles 1,3,5,7 = X;  angles 2,4,6,8 = 180 - X.  Exactly one angle shows its
   measure; call its number N.

   X is the measure of angle 1: if N is odd, X is the shown measure; if N is
   even, X = 180 - shown measure.

   Starting angle S, first match:
     X exactly 90            -> 2
     X acute  and N odd      -> 1
     X acute  and N even     -> 4
     X obtuse and N odd      -> 6
     X obtuse and N even     -> 7

   Press S, then its corresponding, vertical and same-side angle:
     S | corresponding | vertical | same-side
     1 |      5        |    3     |     8
     2 |      6        |    4     |     7
     4 |      8        |    2     |     5
     6 |      2        |    8     |     3
     7 |      3        |    5     |     2
   If the LAST character of the serial is an EVEN DIGIT, press those four in
   reverse order. (A letter does not trigger this.)
   ========================================================================== */

(function (D) {
  'use strict';

  var TABLE = {
    1: [1, 5, 3, 8],
    2: [2, 6, 4, 7],
    4: [4, 8, 2, 5],
    6: [6, 2, 8, 3],
    7: [7, 3, 5, 2]
  };

  function generate(rng, ctx) {
    var x;
    /* The transversal is drawn at the real angle, so X is held to a range the
       figure can actually show without running off the panel. Every case the
       manual distinguishes — acute, exactly 90, obtuse — is still reachable. */
    if (rng() < 0.15) x = 90;
    else { do { x = D.rint(rng, 40, 140); } while (x === 90); }
    var n = D.rint(rng, 1, 8);
    return { x: x, n: n, lastEven: ctx.serialInfo.lastIsEvenDigit };
  }

  function measureOf(p, n) { return (n % 2 === 1) ? p.x : 180 - p.x; }

  function solve(p, ctx) {
    var shown = measureOf(p, p.n);
    var x = (p.n % 2 === 1) ? shown : 180 - shown;
    var nOdd = (p.n % 2 === 1);

    var s;
    if (x === 90) s = 2;
    else if (x < 90) s = nOdd ? 1 : 4;
    else s = nOdd ? 6 : 7;

    var order = TABLE[s].slice();
    if (ctx.serialInfo.lastIsEvenDigit) order.reverse();

    return { shown: shown, x: x, s: s, order: order };
  }

  function debugText(p, s) {
    return 'X=' + s.x + '  S=' + s.s + '  ->  ' + s.order.join(' ');
  }

  function validate(p, s, ctx, fail) {
    if (p.x < 1 || p.x > 179) fail('X out of range: ' + p.x);
    if (p.n < 1 || p.n > 8) fail('N out of range: ' + p.n);
    if (s.x !== p.x) fail('recovered X does not equal generated X');
    if (!TABLE[s.s]) fail('bad starting angle ' + s.s);
    if (s.order.length !== 4) fail('press order is not four long');
    /* the four presses must be S plus its corresponding / vertical / same-side */
    var want = TABLE[s.s].slice().sort().join();
    if (s.order.slice().sort().join() !== want) fail('press set wrong');
    var rev = ctx.serialInfo.lastIsEvenDigit;
    var expect = TABLE[s.s].slice();
    if (rev) expect.reverse();
    if (expect.join() !== s.order.join()) fail('reverse rule wrong');
    /* geometry: 1,3,5,7 equal X and 2,4,6,8 equal 180-X */
    for (var i = 1; i <= 8; i++) {
      var m = measureOf(p, i);
      if (i % 2 === 1 ? m !== p.x : m !== 180 - p.x) fail('angle ' + i + ' wrong');
    }
    /* the S rule must be the first matching row */
    var nOdd = (p.n % 2 === 1), wantS;
    if (p.x === 90) wantS = 2;
    else if (p.x < 90) wantS = nOdd ? 1 : 4;
    else wantS = nOdd ? 6 : 7;
    if (s.s !== wantS) fail('starting angle rule wrong');
  }

  /* ---- rendering --------------------------------------------------------- */

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution, S = D.svg;

    var W = 320, H = 300;
    var svg = S.root(0, 0, W, H, 'art');

    var yTop = 100, yBot = 216, dy = yBot - yTop;

    /* Angle 1 is the upper-left region, and the manual says it measures X.
       That fixes the transversal: it must leave the intersection at
       180 - X degrees from the rightward horizontal, or the picture would
       contradict the number printed on it. */
    var alpha = 180 - p.x;
    var rad = alpha * Math.PI / 180;
    var run = dy * Math.cos(rad) / Math.sin(rad);      /* dy * cot(alpha) */
    var xTop = W / 2 + run / 2, xBot = W / 2 - run / 2;

    S.el('line', { x1: 16, y1: yTop, x2: W - 16, y2: yTop,
      stroke: '#333b3f', 'stroke-width': 4 }, svg);
    S.el('line', { x1: 16, y1: yBot, x2: W - 16, y2: yBot,
      stroke: '#333b3f', 'stroke-width': 4 }, svg);

    var ext = 62;
    S.el('line', {
      x1: xTop + ext * Math.cos(rad), y1: yTop - ext * Math.sin(rad),
      x2: xBot - ext * Math.cos(rad), y2: yBot + ext * Math.sin(rad),
      stroke: '#333b3f', 'stroke-width': 4
    }, svg);

    /* arrow marks so the two horizontals read as parallel */
    [yTop, yBot].forEach(function (y) {
      S.el('path', { d: 'M34 ' + (y - 7) + ' L42 ' + y + ' L34 ' + (y + 7),
        fill: 'none', stroke: '#333b3f', 'stroke-width': 3 }, svg);
    });

    /* Each button sits on the bisector of its own sector, far enough out to
       fit inside it however steep the transversal happens to be. */
    var sectors = [
      { wide: 180 - alpha, mid: (alpha + 180) / 2 },   /* 1, 5  upper left  */
      { wide: alpha,       mid: alpha / 2 },           /* 2, 6  upper right */
      { wide: 180 - alpha, mid: 270 + alpha / 2 },     /* 3, 7  lower right */
      { wide: alpha,       mid: 180 + alpha / 2 }      /* 4, 8  lower left  */
    ];
    var R = 20;
    sectors.forEach(function (sec) {
      sec.r = D.clamp((R + 4) / Math.sin(sec.wide / 2 * Math.PI / 180), 44, 62);
    });

    var pressed = 0;

    function makeButton(num, cx, cy, sec) {
      var q = S.polar(cx, cy, sec.r, sec.mid);
      var g = S.el('g', { class: 'hit angle-btn' }, svg);
      var showMeasure = (num === p.n);
      S.dome(g, q.x, q.y, R, showMeasure ? '#cfe6f5' : '#f3efe4', 5);
      var t = S.text(g, q.x, q.y + (showMeasure ? -4 : 1), String(num), {
        'text-anchor': 'middle', fill: '#333b3f', 'font-size': 15,
        'font-weight': '700'
      });
      t.setAttribute('dominant-baseline', 'middle');
      if (showMeasure) {
        var m = S.text(g, q.x, q.y + 9, s.shown + '°', {
          'text-anchor': 'middle', fill: '#1f6aa5', 'font-size': 12,
          'font-weight': '700'
        });
        m.setAttribute('dominant-baseline', 'middle');
      }
      g.addEventListener('click', function () {
        if (inst.isSolved()) return;
        if (num === s.order[pressed]) {
          pressed++;
          inst.progress(pressed);
          if (pressed === 4) inst.solve();
        } else {
          pressed = 0;
          inst.progress(0);
          inst.strike();
        }
      });
    }

    sectors.forEach(function (sec, i) { makeButton(i + 1, xTop, yTop, sec); });
    sectors.forEach(function (sec, i) { makeButton(i + 5, xBot, yBot, sec); });

    host.appendChild(svg);
  }

  D.register({
    id: 'parallel',
    name: 'PARALLEL LINES',
    rating: 'medium',
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
