/* ==========================================================================
   MODULE: ANGLES  (rating: Hard)

   Manual rule implemented here
   ----------------------------
   Two angles are drawn together in one of four configurations - crossing
   lines (vertical angles), adjacent forming a right angle, adjacent on a
   straight line, or two unrelated angles - with both measures labelled.
   Below them a panel cycles through six colours in a random order, changing
   every two seconds, plus a single button.

   Digit per angle type:
     Zero 6   Acute 4   Right 1   Obtuse 0   Straight 5   Reflex 2   Complete 3
   X = the first angle's digit then the second angle's digit.
   Y, first match: drawn as vertical angles -> 3; measures sum to exactly 90
     -> 2; sum to exactly 180 -> 1; otherwise 4.
   Z = the three digits X then Y read as a number (leading zeros ignored).

     0-110 Red   111-220 Orange   221-330 Yellow
     331-440 Green   441-550 Blue   551-664 Violet

   If EITHER angle is reflex, use the next colour down that list instead, with
   violet wrapping round to red.

   Pressing the button while the target colour shows solves the module.
   Pressing on any other colour strikes. Missing it is not a strike.
   ========================================================================== */

(function (D) {
  'use strict';

  var COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'violet'];
  var HEX = { red: '#d0574f', orange: '#d98b3d', yellow: '#ddb63f',
              green: '#4f9d5d', blue: '#4180ae', violet: '#7a6bb0' };

  var DIGIT = { zero: 6, acute: 4, right: 1, obtuse: 0, straight: 5,
                reflex: 2, complete: 3 };

  function typeOf(m) {
    if (m === 0) return 'zero';
    if (m < 90) return 'acute';
    if (m === 90) return 'right';
    if (m < 180) return 'obtuse';
    if (m === 180) return 'straight';
    if (m < 360) return 'reflex';
    return 'complete';
  }

  /* ---- generation -------------------------------------------------------- */

  var CONFIGS = ['vertical', 'complementary', 'linear', 'unrelated'];

  function loneMeasure(rng) {
    var roll = rng();
    if (roll < 0.06) return 0;
    if (roll < 0.12) return 360;
    if (roll < 0.20) return 180;
    if (roll < 0.30) return 90;
    if (roll < 0.55) return D.rint(rng, 10, 89);        /* acute  */
    if (roll < 0.78) return D.rint(rng, 91, 179);       /* obtuse */
    return D.rint(rng, 190, 350);                       /* reflex */
  }

  function generate(rng, ctx) {
    var config = D.pick(rng, CONFIGS), m1, m2, start;

    if (config === 'vertical') {
      m1 = (rng() < 0.15) ? 90 : D.rint(rng, 20, 160);
      m2 = m1;
      start = D.rint(rng, 10, 70);
    } else if (config === 'complementary') {
      m1 = D.rint(rng, 15, 75);
      m2 = 90 - m1;
      start = D.rint(rng, 0, 40);
    } else if (config === 'linear') {
      m1 = (rng() < 0.12) ? 90 : D.rint(rng, 20, 160);
      m2 = 180 - m1;
      start = 0;
    } else {
      m1 = loneMeasure(rng);
      m2 = loneMeasure(rng);
      start = D.rint(rng, 0, 60);
    }

    return {
      config: config, m1: m1, m2: m2, start: start,
      cycle: D.shuffle(rng, COLORS),
      phase: D.rint(rng, 0, 5)
    };
  }

  /* ---- solution ---------------------------------------------------------- */

  function solve(p) {
    var t1 = typeOf(p.m1), t2 = typeOf(p.m2);
    var d1 = DIGIT[t1], d2 = DIGIT[t2];

    var y;
    if (p.config === 'vertical') y = 3;
    else if (p.m1 + p.m2 === 90) y = 2;
    else if (p.m1 + p.m2 === 180) y = 1;
    else y = 4;

    var z = d1 * 100 + d2 * 10 + y;

    var idx;
    if (z <= 110) idx = 0;
    else if (z <= 220) idx = 1;
    else if (z <= 330) idx = 2;
    else if (z <= 440) idx = 3;
    else if (z <= 550) idx = 4;
    else idx = 5;

    var shifted = (t1 === 'reflex' || t2 === 'reflex');
    if (shifted) idx = (idx + 1) % 6;

    return { t1: t1, t2: t2, x: '' + d1 + d2, y: y, z: z,
             color: COLORS[idx], shifted: shifted };
  }

  function debugText(p, s) {
    return s.color.toUpperCase() + '   (X=' + s.x + ' Y=' + s.y + ' Z=' + s.z +
           (s.shifted ? ' +reflex shift' : '') + ')';
  }

  function validate(p, s, ctx, fail) {
    if (s.z < 0 || s.z > 664) fail('Z out of range: ' + s.z);
    if (COLORS.indexOf(s.color) < 0) fail('bad colour ' + s.color);
    if (p.cycle.length !== 6) fail('cycle is not six colours');
    COLORS.forEach(function (c) {
      if (p.cycle.indexOf(c) < 0) fail('cycle missing ' + c);
    });
    [p.m1, p.m2].forEach(function (m) {
      if (!Number.isInteger(m) || m < 0 || m > 360) fail('bad measure ' + m);
    });
    if (p.config === 'vertical' && p.m1 !== p.m2) {
      fail('vertical angles are not equal');
    }
    if (p.config === 'complementary' && p.m1 + p.m2 !== 90) {
      fail('complementary pair does not sum to 90');
    }
    if (p.config === 'linear' && p.m1 + p.m2 !== 180) {
      fail('linear pair does not sum to 180');
    }
    var wantY;
    if (p.config === 'vertical') wantY = 3;
    else if (p.m1 + p.m2 === 90) wantY = 2;
    else if (p.m1 + p.m2 === 180) wantY = 1;
    else wantY = 4;
    if (s.y !== wantY) fail('Y rule wrong');
    if (s.z !== DIGIT[typeOf(p.m1)] * 100 + DIGIT[typeOf(p.m2)] * 10 + s.y) {
      fail('Z assembly wrong');
    }
    var base = s.z <= 110 ? 0 : s.z <= 220 ? 1 : s.z <= 330 ? 2 :
               s.z <= 440 ? 3 : s.z <= 550 ? 4 : 5;
    var want = (typeOf(p.m1) === 'reflex' || typeOf(p.m2) === 'reflex')
      ? (base + 1) % 6 : base;
    if (s.color !== COLORS[want]) fail('colour lookup wrong');
  }

  /* ---- rendering --------------------------------------------------------- */

  /* Every drawing helper also reports the points it touched, so the finished
     figure can be measured and centred: with a random starting rotation and
     arcs up to 360 degrees, a fixed layout drifts off-centre or clips. */
  function ray(g, cx, cy, deg, len, pts) {
    var e = D.svg.polar(cx, cy, len, deg);
    D.svg.el('line', { x1: cx, y1: cy, x2: e.x.toFixed(2), y2: e.y.toFixed(2),
      stroke: '#333b3f', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g);
    pts.push([cx, cy], [e.x, e.y]);
  }

  function arc(g, cx, cy, r, startDeg, measure, color, pts) {
    var i, p;
    if (measure === 0) {
      p = D.svg.polar(cx, cy, r, startDeg);
      D.svg.el('circle', { cx: p.x, cy: p.y, r: 3, fill: color }, g);
      pts.push([p.x, p.y]);
      return;
    }
    if (measure >= 360) {
      D.svg.el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: color,
        'stroke-width': 2.5 }, g);
      pts.push([cx - r, cy - r], [cx + r, cy + r]);
      return;
    }
    D.svg.el('path', { d: D.svg.arcPath(cx, cy, r, startDeg, measure),
      fill: 'none', stroke: color, 'stroke-width': 2.5 }, g);
    for (i = 0; i <= measure; i += 10) {
      p = D.svg.polar(cx, cy, r, startDeg + i);
      pts.push([p.x, p.y]);
    }
  }

  function tag(g, cx, cy, r, startDeg, measure, label, color, pts) {
    var mid = startDeg + measure / 2;
    var pt = D.svg.polar(cx, cy, r + 15, measure === 0 ? startDeg + 12 : mid);
    var t = D.svg.text(g, pt.x, pt.y, label, {
      'text-anchor': 'middle', fill: color, 'font-size': 13,
      'font-weight': '700'
    });
    t.setAttribute('dominant-baseline', 'middle');
    pts.push([pt.x - 7, pt.y - 8], [pt.x + 7, pt.y + 8]);
  }

  /* translate and scale a group so its contents sit centred in `box` */
  function fitInto(g, pts, box) {
    if (!pts.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    var s = Math.min(box.w / w, box.h / h, 1.35);
    var dx = box.x + (box.w - w * s) / 2 - minX * s;
    var dy = box.y + (box.h - h * s) / 2 - minY * s;
    g.setAttribute('transform',
      'translate(' + dx.toFixed(2) + ',' + dy.toFixed(2) + ') scale(' + s.toFixed(4) + ')');
  }

  var C1 = '#c17f28', C2 = '#3a6f96';

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution, S = D.svg;

    var svg = S.root(0, 0, 340, 252, 'art');
    var fig = S.el('g', {}, svg);
    var pts = [];

    if (p.config === 'unrelated') {
      var A = { x: 70, y: 110 }, B = { x: 230, y: 110 };
      ray(fig, A.x, A.y, p.start, 66, pts);
      ray(fig, A.x, A.y, p.start + p.m1, 66, pts);
      arc(fig, A.x, A.y, 30, p.start, p.m1, C1, pts);
      tag(fig, A.x, A.y, 30, p.start, p.m1, '1', C1, pts);
      ray(fig, B.x, B.y, p.start + 20, 66, pts);
      ray(fig, B.x, B.y, p.start + 20 + p.m2, 66, pts);
      arc(fig, B.x, B.y, 30, p.start + 20, p.m2, C2, pts);
      tag(fig, B.x, B.y, 30, p.start + 20, p.m2, '2', C2, pts);
      S.el('circle', { cx: A.x, cy: A.y, r: 5, fill: '#333b3f' }, fig);
      S.el('circle', { cx: B.x, cy: B.y, r: 5, fill: '#333b3f' }, fig);
    } else {
      var V = { x: 150, y: 112 }, L = 100;
      if (p.config === 'vertical') {
        [p.start, p.start + p.m1].forEach(function (deg) {
          ray(fig, V.x, V.y, deg, L, pts);
          ray(fig, V.x, V.y, deg + 180, L, pts);
        });
        arc(fig, V.x, V.y, 34, p.start, p.m1, C1, pts);
        tag(fig, V.x, V.y, 34, p.start, p.m1, '1', C1, pts);
        arc(fig, V.x, V.y, 50, p.start + 180, p.m2, C2, pts);
        tag(fig, V.x, V.y, 50, p.start + 180, p.m2, '2', C2, pts);
      } else {
        var total = (p.config === 'complementary') ? 90 : 180;
        ray(fig, V.x, V.y, p.start, L, pts);
        ray(fig, V.x, V.y, p.start + p.m1, L, pts);
        ray(fig, V.x, V.y, p.start + total, L, pts);
        arc(fig, V.x, V.y, 34, p.start, p.m1, C1, pts);
        tag(fig, V.x, V.y, 34, p.start, p.m1, '1', C1, pts);
        arc(fig, V.x, V.y, 52, p.start + p.m1, p.m2, C2, pts);
        tag(fig, V.x, V.y, 52, p.start + p.m1, p.m2, '2', C2, pts);
      }
      S.el('circle', { cx: V.x, cy: V.y, r: 5, fill: '#333b3f' }, fig);
    }

    fitInto(fig, pts, { x: 12, y: 8, w: 316, h: 188 });

    var l1 = S.text(svg, 90, 228, '\u22201 = ' + p.m1 + '\u00b0',
      { fill: C1, 'font-size': 16, 'font-weight': '700', 'text-anchor': 'middle' });
    l1.setAttribute('dominant-baseline', 'middle');
    var l2 = S.text(svg, 250, 228, '\u22202 = ' + p.m2 + '\u00b0',
      { fill: C2, 'font-size': 16, 'font-weight': '700', 'text-anchor': 'middle' });
    l2.setAttribute('dominant-baseline', 'middle');

    var bar = document.createElement('div');
    bar.className = 'side';
    var panel = document.createElement('div');
    panel.className = 'swatch';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'press-btn';
    btn.textContent = 'PRESS';
    bar.appendChild(panel);
    bar.appendChild(btn);

    var split = document.createElement('div');
    split.className = 'split';
    split.appendChild(svg);
    split.appendChild(bar);
    host.appendChild(split);

    var idx = p.phase;
    function show() {
      var c = HEX[p.cycle[idx]];
      panel.style.background = c;
      panel.style.boxShadow = 'inset 0 -8px 0 rgba(0,0,0,.18)';
    }
    show();

    var timer = setInterval(function () {
      if (inst.isSolved()) return;
      idx = (idx + 1) % p.cycle.length;
      show();
      D.audio.relay();
    }, 2000);

    btn.addEventListener('click', function () {
      if (inst.isSolved()) return;
      if (p.cycle[idx] === s.color) inst.solve(); else inst.strike();
    });

    inst.onSolved = function () { btn.disabled = true; };
    inst.cleanup = function () { clearInterval(timer); };
  }

  D.register({
    id: 'angles',
    name: 'ANGLES',
    rating: 'hard',
    wide: true,
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
