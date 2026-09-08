/* ==========================================================================
   MODULE: TRIANGLES  (rating: Hard)

   Manual rule implemented here
   ----------------------------
   A triangle with its three angle measures, three colour buttons (red, green,
   blue) in a randomised left-to-right order, and a four-way D-pad.
   Seven presses: the three colours first, then the four directions.

   1. Side classification chooses the colour SLOTS (left-to-right positions,
      not colours):
        equilateral -> 2, 1, 3      isosceles -> 3, 2, 1      scalene -> 1, 2, 3
   2. D = largest angle - smallest angle.
   3. X = 10 if right, 20 if acute, 30 if obtuse.
   4. D = 0        -> Z = X
      D 1..30      -> Z = X + D
      D 31..60     -> Z = 2X
      D over 60    -> Z = X - D
   5. If the left-to-right colour order is NOT red-green-blue, Z += 5.
   6. Z <= 20  -> up, right, down, left
      Z 21..40 -> left, up, right, down
      Z 41..60 -> down, left, up, right
      Z >= 61  -> right, down, left, up
   Any press out of order strikes.
   ========================================================================== */

(function (D) {
  'use strict';

  var COMBOS = [
    ['equilateral', 'acute'],
    ['isosceles', 'acute'], ['isosceles', 'right'], ['isosceles', 'obtuse'],
    ['scalene', 'acute'], ['scalene', 'right'], ['scalene', 'obtuse']
  ];

  function sideClass(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    if (s[0] === s[1] && s[1] === s[2]) return 'equilateral';
    if (s[0] === s[1] || s[1] === s[2]) return 'isosceles';
    return 'scalene';
  }

  function angleClass(a) {
    var max = Math.max.apply(null, a);
    if (max === 90) return 'right';
    if (max > 90) return 'obtuse';
    return 'acute';
  }

  function randomAngles(rng) {
    /* every angle at least 10 degrees so the triangle stays drawable */
    var a = D.rint(rng, 10, 160);
    var b = D.rint(rng, 10, 170 - a);
    var c = 180 - a - b;
    if (c < 10) return null;
    return [a, b, c];
  }

  function generate(rng, ctx) {
    var target = D.pick(rng, COMBOS), angles = null, guard = 0;

    if (target[0] === 'equilateral') {
      angles = [60, 60, 60];
    } else {
      while (guard++ < 4000) {
        var t = randomAngles(rng);
        if (!t) continue;
        if (sideClass(t) === target[0] && angleClass(t) === target[1]) {
          angles = t; break;
        }
      }
    }
    if (!angles) angles = [50, 60, 70];

    return {
      angles: D.shuffle(rng, angles),
      order: D.shuffle(rng, ['red', 'green', 'blue'])
    };
  }

  /* ---- solution ---------------------------------------------------------- */

  var SLOTS = {
    equilateral: [2, 1, 3],
    isosceles: [3, 2, 1],
    scalene: [1, 2, 3]
  };

  var DIRS = {
    a: ['up', 'right', 'down', 'left'],
    b: ['left', 'up', 'right', 'down'],
    c: ['down', 'left', 'up', 'right'],
    d: ['right', 'down', 'left', 'up']
  };

  function solve(p) {
    var sc = sideClass(p.angles);
    var ac = angleClass(p.angles);
    var sorted = p.angles.slice().sort(function (x, y) { return x - y; });
    var dd = sorted[2] - sorted[0];
    var x = ac === 'right' ? 10 : (ac === 'acute' ? 20 : 30);

    var z;
    if (dd === 0) z = x;
    else if (dd <= 30) z = x + dd;
    else if (dd <= 60) z = 2 * x;
    else z = x - dd;

    var standard = (p.order[0] === 'red' && p.order[1] === 'green' &&
                    p.order[2] === 'blue');
    if (!standard) z += 5;

    var dirs;
    if (z <= 20) dirs = DIRS.a;
    else if (z <= 40) dirs = DIRS.b;
    else if (z <= 60) dirs = DIRS.c;
    else dirs = DIRS.d;

    var slots = SLOTS[sc];
    var colors = slots.map(function (slot) { return p.order[slot - 1]; });

    return {
      sideClass: sc, angleClass: ac, d: dd, x: x, z: z,
      slots: slots, colors: colors, dirs: dirs,
      presses: colors.concat(dirs)
    };
  }

  function debugText(p, s) {
    return s.colors.map(function (c) { return c.charAt(0).toUpperCase(); })
      .join('') + ' / ' +
      s.dirs.map(function (d) {
        return { up: '↑', down: '↓', left: '←', right: '→' }[d];
      }).join('') + '   (D=' + s.d + ' X=' + s.x + ' Z=' + s.z + ')';
  }

  function validate(p, s, ctx, fail) {
    var sum = p.angles[0] + p.angles[1] + p.angles[2];
    if (sum !== 180) fail('angles sum to ' + sum);
    p.angles.forEach(function (a) {
      if (!Number.isInteger(a) || a < 1) fail('bad angle ' + a);
    });
    if (s.presses.length !== 7) fail('press sequence is not seven long');
    if (SLOTS[s.sideClass].join() !== s.slots.join()) fail('slot rule wrong');
    /* colours must be the round's order read through the slot positions */
    s.slots.forEach(function (slot, i) {
      if (s.colors[i] !== p.order[slot - 1]) fail('colour slot ' + i + ' wrong');
    });
    var sorted = p.angles.slice().sort(function (x, y) { return x - y; });
    if (s.d !== sorted[2] - sorted[0]) fail('D wrong');
    var wantX = s.angleClass === 'right' ? 10 : (s.angleClass === 'acute' ? 20 : 30);
    if (s.x !== wantX) fail('X wrong');
    var z;
    if (s.d === 0) z = s.x;
    else if (s.d <= 30) z = s.x + s.d;
    else if (s.d <= 60) z = 2 * s.x;
    else z = s.x - s.d;
    if (!(p.order[0] === 'red' && p.order[1] === 'green' && p.order[2] === 'blue')) {
      z += 5;
    }
    if (s.z !== z) fail('Z wrong: ' + s.z + ' vs ' + z);
    var want = s.z <= 20 ? DIRS.a : (s.z <= 40 ? DIRS.b :
               (s.z <= 60 ? DIRS.c : DIRS.d));
    if (want.join() !== s.dirs.join()) fail('direction rule wrong');
    if (['red', 'green', 'blue'].some(function (c) {
      return p.order.indexOf(c) < 0;
    })) fail('colour order incomplete');
  }

  /* ---- rendering --------------------------------------------------------- */

  var HEX = { red: '#d0574f', green: '#4f9d5d', blue: '#4180ae' };
  var DARK = { red: '#a3403a', green: '#3a7746', blue: '#2f6187' };

  function unit(x, y) {
    var n = Math.sqrt(x * x + y * y) || 1;
    return { x: x / n, y: y / n };
  }

  function triangleGeometry(angles) {
    /* law of sines: side lengths proportional to sin of the opposite angle */
    var rad = angles.map(function (a) { return a * Math.PI / 180; });
    var A = { x: 0, y: 0 };
    var c = Math.sin(rad[2]);                 /* side AB, opposite angle C */
    var b = Math.sin(rad[1]);                 /* side AC, opposite angle B */
    var B = { x: c, y: 0 };
    var C = { x: b * Math.cos(rad[0]), y: -b * Math.sin(rad[0]) };
    return [A, B, C];
  }

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution, S = D.svg;

    var W = 560, H = 260;
    var svg = S.root(0, 0, W, H, 'art');

    var pts = triangleGeometry(p.angles);
    var xs = pts.map(function (q) { return q.x; });
    var ys = pts.map(function (q) { return q.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var boxW = 236, boxH = 138;
    var k = Math.min(boxW / (maxX - minX || 1), boxH / (maxY - minY || 1));
    var offX = 40 + (boxW - (maxX - minX) * k) / 2;
    var offY = 58 + (boxH - (maxY - minY) * k) / 2;

    var scr = pts.map(function (q) {
      return { x: offX + (q.x - minX) * k, y: offY + (q.y - minY) * k };
    });

    S.el('polygon', {
      points: scr.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); })
        .join(' '),
      fill: '#dce7ed', stroke: '#333b3f', 'stroke-width': 4,
      'stroke-linejoin': 'round'
    }, svg);

    /* Angle labels sit just OUTSIDE each vertex along the outward bisector,
       so they stay apart even when the triangle is very thin. */
    scr.forEach(function (q, i) {
      var o1 = scr[(i + 1) % 3], o2 = scr[(i + 2) % 3];
      var u1 = unit(o1.x - q.x, o1.y - q.y);
      var u2 = unit(o2.x - q.x, o2.y - q.y);
      var b = unit(u1.x + u2.x, u1.y + u2.y);
      /* clamp the label inside the frame: a vertex near the edge would
         otherwise push its number off the panel */
      var lx = D.clamp(q.x - b.x * 20, 28, W - 28);
      var ly = D.clamp(q.y - b.y * 20, 18, H - 18);
      var t = S.text(svg, lx, ly, p.angles[i] + '°', {
        'text-anchor': 'middle', fill: '#e8d9a8', 'font-size': 13,
        'font-weight': '700', stroke: '#171d20', 'stroke-width': 3.5,
        'paint-order': 'stroke'
      });
      t.setAttribute('dominant-baseline', 'middle');
    });

    var pressed = 0;

    function hit(token) {
      if (inst.isSolved()) return;
      if (token === s.presses[pressed]) {
        pressed++;
        inst.progress(pressed);
        if (pressed === s.presses.length) inst.solve();
      } else {
        pressed = 0;
        inst.progress(0);
        inst.strike();
      }
    }

    /* three colour buttons, left to right in this round's order */
    p.order.forEach(function (color, i) {
      var bx = 336 + i * 66, by = 34;
      var g = S.el('g', { class: 'hit' }, svg);
      S.el('rect', { x: bx, y: by + 7, width: 58, height: 58, rx: 12,
        fill: DARK[color] }, g);
      S.el('rect', { x: bx, y: by, width: 58, height: 58, rx: 12,
        fill: HEX[color], stroke: '#333b3f', 'stroke-width': 4 }, g);
      g.addEventListener('click', function () { hit(color); });
    });

    /* D-pad */
    var pad = { cx: 431, cy: 182, s: 44 };
    var DP = {
      up:    [pad.cx - pad.s / 2, pad.cy - pad.s * 1.55],
      down:  [pad.cx - pad.s / 2, pad.cy + pad.s * 0.55],
      left:  [pad.cx - pad.s * 1.55, pad.cy - pad.s / 2],
      right: [pad.cx + pad.s * 0.55, pad.cy - pad.s / 2]
    };
    var ARROW = {
      up: 'M22 10 L34 30 L10 30 Z', down: 'M22 34 L10 14 L34 14 Z',
      left: 'M10 22 L30 10 L30 34 Z', right: 'M34 22 L14 34 L14 10 Z'
    };
    Object.keys(DP).forEach(function (dir) {
      var q = DP[dir];
      var g = S.el('g', { class: 'hit' }, svg);
      S.keycap(g, q[0], q[1], pad.s, pad.s, 12, '#dfd6c2');
      S.el('path', {
        d: ARROW[dir], fill: '#333b3f',
        transform: 'translate(' + q[0] + ',' + q[1] + ')'
      }, g);
      g.addEventListener('click', function () { hit(dir); });
    });

    host.appendChild(svg);
  }

  D.register({
    id: 'triangles',
    name: 'TRIANGLES',
    rating: 'hard',
    wide: true,
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
