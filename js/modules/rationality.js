/* ==========================================================================
   MODULE: RATIONALITY  (rating: Medium)

   Manual rule implemented here
   ----------------------------
   One number is shown. Four colour buttons sit in a diamond; the four colours
   (yellow, blue, green, red) are arranged at random each round.

   Build a base colour sequence of FIVE presses by answering, in order (if the
   number is NOT real, answer "no" to questions 2-5):
     1 real?                        yes Red     no Blue
     2 rational?                    yes Yellow  no Green
     3 integer?                     yes Green   no Red
     4 negative?                    yes Blue    no Yellow
     5 natural (counting) number?   yes Red     no Blue
   0 is a whole number but NOT natural.

   Then apply the first matching serial rule:
     * a digit >= 7 AND a digit <= 3  -> replace each colour with the colour
       OPPOSITE it in the diamond
     * else a digit >= 7              -> one position CLOCKWISE
     * else a digit <= 3              -> one position COUNTER-CLOCKWISE
     * else                            unchanged
   The shifts operate on POSITIONS IN THIS ROUND'S ARRANGEMENT, not on a fixed
   colour wheel: "one clockwise" is whichever colour currently sits in the next
   diamond position clockwise. Opposite means top<->bottom, left<->right.
   ========================================================================== */

(function (D) {
  'use strict';

  var COLORS = ['yellow', 'blue', 'green', 'red'];
  /* diamond positions in clockwise order */
  var POSITIONS = ['top', 'right', 'bottom', 'left'];

  /* ---- number catalogue -------------------------------------------------- */

  var IRRATIONALS = [
    { display: 'π',            negative: false },
    { display: '-π',           negative: true  },
    { display: '2π',           negative: false },
    { display: 'π/2',          negative: false },
    { display: '√2',           negative: false },
    { display: '√3',           negative: false },
    { display: '√5',           negative: false },
    { display: '√6',           negative: false },
    { display: '√7',           negative: false },
    { display: '√10',          negative: false },
    { display: '-√2',          negative: true  },
    { display: '-√3',          negative: true  },
    { display: '-√11',         negative: true  }
  ];

  var NONREAL = ['√-1', '√-2', '√-4', '√-7', '√-9',
                 '√-16', '3√-5', '-√-8'];

  function makeNumber(rng, category) {
    switch (category) {
      case 'nonreal':
        return { display: D.pick(rng, NONREAL), real: false, rational: false,
                 integer: false, negative: false, natural: false };
      case 'irrational': {
        var q = D.pick(rng, IRRATIONALS);
        return { display: q.display, real: true, rational: false,
                 integer: false, negative: q.negative, natural: false };
      }
      case 'rational': {
        var neg = rng() < 0.5, txt;
        if (rng() < 0.5) {
          /* proper fraction that is not an integer */
          var den = D.rint(rng, 2, 9), num;
          do { num = D.rint(rng, 1, 40); } while (num % den === 0);
          txt = (neg ? '-' : '') + num + '/' + den;
        } else {
          var whole = D.rint(rng, 0, 24);
          var frac = D.pick(rng, ['1', '2', '25', '4', '5', '6', '75', '8']);
          txt = (neg ? '-' : '') + whole + '.' + frac;
        }
        return { display: txt, real: true, rational: true, integer: false,
                 negative: neg, natural: false };
      }
      case 'negint':
        return { display: '-' + D.rint(rng, 1, 99), real: true, rational: true,
                 integer: true, negative: true, natural: false };
      case 'zero':
        return { display: '0', real: true, rational: true, integer: true,
                 negative: false, natural: false };
      default: /* natural */
        return { display: String(D.rint(rng, 1, 99)), real: true,
                 rational: true, integer: true, negative: false,
                 natural: true };
    }
  }

  var CATEGORIES = ['nonreal', 'irrational', 'rational', 'negint', 'zero',
                    'natural'];

  /* ---- generation -------------------------------------------------------- */

  function generate(rng, ctx) {
    var category = D.pick(rng, CATEGORIES);
    var num = makeNumber(rng, category);
    var arrangement = D.shuffle(rng, COLORS); /* index i -> POSITIONS[i] */
    return {
      category: category,
      num: num,
      arrangement: arrangement,
      serial: ctx.serialInfo.serial
    };
  }

  /* ---- solution ---------------------------------------------------------- */

  function baseSequence(n) {
    if (!n.real) return ['blue', 'green', 'red', 'yellow', 'blue'];
    return [
      'red',
      n.rational ? 'yellow' : 'green',
      n.integer ? 'green' : 'red',
      n.negative ? 'blue' : 'yellow',
      n.natural ? 'red' : 'blue'
    ];
  }

  function solve(p, ctx) {
    var info = ctx.serialInfo;
    var base = baseSequence(p.num);

    var shift = 0, rule = 'unchanged';
    if (info.hasHighDigit && info.hasLowDigit) { shift = 2; rule = 'opposite'; }
    else if (info.hasHighDigit) { shift = 1; rule = 'clockwise'; }
    else if (info.hasLowDigit) { shift = 3; rule = 'counter-clockwise'; }

    var arr = p.arrangement;
    var posOf = {};
    arr.forEach(function (c, i) { posOf[c] = i; });

    var sequence = base.map(function (c) {
      return arr[(posOf[c] + shift) % 4];
    });

    return { base: base, sequence: sequence, rule: rule, shift: shift };
  }

  function debugText(p, s) {
    return s.sequence.map(function (c) { return c.toUpperCase().slice(0, 1); })
      .join(' ') + '   [' + s.rule + ']';
  }

  /* ---- self-test checks -------------------------------------------------- */

  function validate(p, s, ctx, fail) {
    var i;
    if (s.sequence.length !== 5) fail('sequence is not five presses');
    for (i = 0; i < 5; i++) {
      if (COLORS.indexOf(s.sequence[i]) < 0) fail('bad colour ' + s.sequence[i]);
    }
    if (p.arrangement.length !== 4) fail('diamond needs four colours');
    COLORS.forEach(function (c) {
      if (p.arrangement.indexOf(c) < 0) fail('missing colour ' + c);
    });
    /* base sequence must match the question table */
    var n = p.num, expect;
    if (!n.real) expect = ['blue', 'green', 'red', 'yellow', 'blue'];
    else expect = ['red', n.rational ? 'yellow' : 'green',
                   n.integer ? 'green' : 'red', n.negative ? 'blue' : 'yellow',
                   n.natural ? 'red' : 'blue'];
    if (expect.join() !== s.base.join()) fail('base sequence mismatch');
    /* category self-consistency */
    if (p.category === 'zero' && n.natural) fail('0 must not be natural');
    if (p.category === 'natural' && !n.natural) fail('natural flag wrong');
    if (p.category === 'nonreal' && n.real) fail('non-real flagged real');
    if (p.category === 'negint' && !(n.integer && n.negative)) {
      fail('negative integer flags wrong');
    }
    /* shift rule matches the serial */
    var info = ctx.serialInfo, want;
    if (info.hasHighDigit && info.hasLowDigit) want = 2;
    else if (info.hasHighDigit) want = 1;
    else if (info.hasLowDigit) want = 3;
    else want = 0;
    if (s.shift !== want) fail('serial shift rule wrong');
  }

  /* ---- rendering --------------------------------------------------------- */

  var HEX = { yellow: '#ddb63f', blue: '#4180ae', green: '#4f9d5d',
              red: '#d0574f' };
  var DARK = { yellow: '#ab8a24', blue: '#2f6187', green: '#3a7746',
               red: '#a3403a' };

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution, S = D.svg;

    var readout = document.createElement('div');
    readout.className = 'readout';
    readout.textContent = p.num.display;
    host.appendChild(readout);

    /* R + r must stay inside the box or the top and bottom keys get clipped */
    var svg = S.root(0, 0, 280, 200, 'art');
    var cx = 140, cy = 98, R = 60, r = 29;
    var pts = { top: [cx, cy - R], right: [cx + R, cy],
                bottom: [cx, cy + R], left: [cx - R, cy] };

    S.el('path', {
      d: 'M' + cx + ' ' + (cy - R) + ' L' + (cx + R) + ' ' + cy +
         ' L' + cx + ' ' + (cy + R) + ' L' + (cx - R) + ' ' + cy + ' Z',
      fill: 'none', stroke: '#333b3f', 'stroke-width': 4
    }, svg);

    var pressed = 0;

    p.arrangement.forEach(function (color, i) {
      var pos = POSITIONS[i], pt = pts[pos];
      var g = S.el('g', { class: 'hit' }, svg);
      S.dome(g, pt[0], pt[1], r, HEX[color]);
      S.colourTag(g, pt[0], pt[1], color, Math.round(r * 0.9));
      g.addEventListener('click', function () {
        if (inst.isSolved()) return;
        if (color === s.sequence[pressed]) {
          pressed++;
          inst.progress(pressed);
          if (pressed === s.sequence.length) inst.solve();
        } else {
          pressed = 0;
          inst.progress(0);
          inst.strike();
        }
      });
    });

    host.appendChild(svg);
  }

  /* ---- the same module, as a 3D object (js/module3d.js) -----------------
     A raised plate carrying the number, four domed keys on a diamond. Same
     presses, same rules: only the picture and the way a press is found
     changed. */
  function mount3d(host, inst) {
    var p = inst.puzzle, s = inst.solution, M = D.module3d, P = M.parts;
    var W = 268, H = 262;
    var view = M.stage(host, W, H);
    if (!view) { mount(host, inst); return; }
    var T = M.THREE();

    /* the readout: a cream plate, the number printed on it */
    var plateW = 200, plateH = 62;
    var pl = view.at(P.plate(plateW, plateH, 12, '#f6f0e2', 12), W / 2, 36, 6);
    function printNumber() {
      var tex = P.textTexture(p.num.display, { w: 640, h: 200, font: '600 120px "Plex Sans Condensed", "Plex Sans", sans-serif', dy: 8 });
      if (face.material.map) face.material.map.dispose();
      face.material.map = tex; face.material.needsUpdate = true;
      view.invalidate();
    }
    var face = new T.Mesh(new T.PlaneGeometry(plateW - 14, plateH - 10), new T.MeshBasicMaterial({ transparent: true }));
    face.position.z = 6.2; pl.add(face);
    printNumber();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('600 120px "Plex Sans Condensed"').then(printNumber, function () {});
    }

    /* the diamond the keys sit on */
    var cx = W / 2, cy = 160, R = 58, r = 27;
    var pts = { top: [cx, cy - R], right: [cx + R, cy], bottom: [cx, cy + R], left: [cx - R, cy] };
    view.at(P.line([pts.top, pts.right, pts.bottom, pts.left, pts.top], 4), 0, 0, 0);

    var pressed = 0, keys = [];
    p.arrangement.forEach(function (color, i) {
      var pt = pts[POSITIONS[i]];
      var key = view.at(P.domeKey(HEX[color], r), pt[0], pt[1], 0);
      key.userData.colour = color;
      /* COLOUR LABELS: the letter on the dome, shown with body.cb */
      var tag = new T.Mesh(new T.PlaneGeometry(r * 1.1, r * 1.1), new T.MeshBasicMaterial({
        map: P.textTexture(color.charAt(0).toUpperCase(), { w: 128, h: 128, color: '#ffffff', font: '700 96px "Plex Sans Condensed", sans-serif', dy: 4 }),
        transparent: true, depthTest: false }));
      tag.position.z = r * 0.95; key.userData.cap.add(tag); key.userData.tag = tag;
      view.hit(key, function () {
        if (inst.isSolved()) return;
        key.userData.pressedAt = performance.now();
        view.animate(300);
        D.audio.press();
        if (color === s.sequence[pressed]) {
          pressed++;
          inst.progress(pressed);
          if (pressed === s.sequence.length) inst.solve();
        } else {
          pressed = 0;
          inst.progress(0);
          inst.strike();
        }
      });
      keys.push(key);
    });

    view.beforeDraw = function (now) {
      var cb = document.body && document.body.classList.contains('cb');
      keys.forEach(function (k) {
        var d = P.pressDepth(now - (k.userData.pressedAt || -1e9));
        k.userData.cap.position.z = k.userData.rest - d * r * 0.24;
        k.userData.dome.material.emissive.setRGB(0, 0, 0).addScalar(view.hover === k ? 0.12 : 0);
        k.userData.tag.visible = cb;
      });
    };
    if (D.prefs) D.prefs.onChange(function (key) { if (key === 'colorblind' || key === '*') view.invalidate(); });
    /* the tests reach the keys through this */
    view.canvas.__keys = function (colour) {
      var k = keys.filter(function (x) { return x.userData.colour === colour; })[0];
      return k ? view.screenOf(k) : null;
    };
  }

  D.register({
    id: 'rationality',
    name: 'RATIONALITY',
    rating: 'medium',
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount,
    mount3d: mount3d
  });
})(DEFUSAL);
