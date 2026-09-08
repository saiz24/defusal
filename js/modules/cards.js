/* ==========================================================================
   Procedural playing-card artwork (used by MUTUALLY EXCLUSIVE EVENTS).
   Real-deck conventions: corner indices top-left and bottom-right, classic
   pip arrangements with the lower half inverted, a single large pip on the
   ace, and court figures mirrored about the centre of an inner panel.
   Pure SVG — no image assets anywhere.
   ========================================================================== */

(function (D) {
  'use strict';
  var S = D.svg;

  var SUITS = [
    { id: 'spades',   color: 'black' },
    { id: 'hearts',   color: 'red' },
    { id: 'diamonds', color: 'red' },
    { id: 'clubs',    color: 'black' }
  ];

  var RANKS = [
    { id: 'A',  value: 1  }, { id: '2',  value: 2  }, { id: '3',  value: 3 },
    { id: '4',  value: 4  }, { id: '5',  value: 5  }, { id: '6',  value: 6 },
    { id: '7',  value: 7  }, { id: '8',  value: 8  }, { id: '9',  value: 9 },
    { id: '10', value: 10 }, { id: 'J',  value: 11 }, { id: 'Q',  value: 12 },
    { id: 'K',  value: 13 }
  ];

  var INK = { red: '#c8102e', black: '#12161a' };
  var FACE = '#f7f2e7';
  var GOLD = '#d8a627';
  var SKIN = '#f3ddc4';

  /* suit outlines drawn inside a 0..100 box, then scaled into place */
  var PATHS = {
    spades: 'M50 6 C50 6 17 35 11 50 C3 69 13 83 29 83 C38 83 44 79 48 72 ' +
            'C47 81 42 88 33 94 L67 94 C58 88 53 81 52 72 C56 79 62 83 71 83 ' +
            'C87 83 97 69 89 50 C83 35 50 6 50 6 Z',
    hearts: 'M50 93 C17 68 5 52 5 34 C5 19 17 9 30 9 C39 9 46 14 50 23 ' +
            'C54 14 61 9 70 9 C83 9 95 19 95 34 C95 52 83 68 50 93 Z',
    diamonds: 'M50 4 L89 50 L50 96 L11 50 Z'
  };

  function glyph(parent, cx, cy, size, suit, fill, rotate) {
    var t = 'translate(' + cx + ',' + cy + ') scale(' + (size / 100) + ')' +
            (rotate ? ' rotate(180)' : '') + ' translate(-50,-50)';
    var g = S.el('g', { transform: t }, parent);
    if (suit === 'clubs') {
      S.el('circle', { cx: 50, cy: 28, r: 19, fill: fill }, g);
      S.el('circle', { cx: 27, cy: 57, r: 19, fill: fill }, g);
      S.el('circle', { cx: 73, cy: 57, r: 19, fill: fill }, g);
      S.el('path', { d: 'M43 62 C43 77 39 87 31 95 L69 95 C61 87 57 77 57 62 Z',
        fill: fill }, g);
    } else {
      S.el('path', { d: PATHS[suit], fill: fill }, g);
    }
    return g;
  }

  /* classic pip grids, [x, y, inverted] as fractions of the pip field */
  var PIPS = {
    '2':  [[.5,.00],[.5,1,1]],
    '3':  [[.5,.00],[.5,.5],[.5,1,1]],
    '4':  [[0,0],[1,0],[0,1,1],[1,1,1]],
    '5':  [[0,0],[1,0],[.5,.5],[0,1,1],[1,1,1]],
    '6':  [[0,0],[1,0],[0,.5],[1,.5],[0,1,1],[1,1,1]],
    '7':  [[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[0,1,1],[1,1,1]],
    '8':  [[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[.5,.75,1],[0,1,1],[1,1,1]],
    '9':  [[0,0],[1,0],[0,.3333],[1,.3333],[.5,.5],[0,.6667,1],[1,.6667,1],
           [0,1,1],[1,1,1]],
    '10': [[0,0],[1,0],[.5,.1667],[0,.3333],[1,.3333],[0,.6667,1],[1,.6667,1],
           [.5,.8333,1],[0,1,1],[1,1,1]]
  };

  /* ---- court figures ------------------------------------------------------
     Drawn head-down into a 100x100 box; the card stamps it twice, the second
     copy rotated 180 degrees, exactly like a real court card. */

  var HAIR = '#5a4636', LINE = '#2a2118';

  function crown(g, rank, ink) {
    if (rank === 'J') {
      S.el('path', { d: 'M30 27 C30 12 44 6 50 6 C56 6 70 12 70 27 Z',
        fill: ink, stroke: LINE, 'stroke-width': 1.4 }, g);
      S.el('rect', { x: 29, y: 25, width: 42, height: 6, rx: 2, fill: GOLD,
        stroke: LINE, 'stroke-width': 1.2 }, g);
      S.el('path', { d: 'M68 22 C77 17 80 9 78 5 C72 8 68 13 66 20 Z',
        fill: '#fffdf6', stroke: LINE, 'stroke-width': 1.2 }, g);
      return;
    }
    if (rank === 'Q') {
      S.el('path', { d: 'M30 29 L33 13 L42 21 L50 7 L58 21 L67 13 L70 29 Z',
        fill: GOLD, stroke: LINE, 'stroke-width': 1.4,
        'stroke-linejoin': 'round' }, g);
      [[33, 12], [50, 6], [67, 12]].forEach(function (q) {
        S.el('circle', { cx: q[0], cy: q[1], r: 3, fill: ink,
          stroke: LINE, 'stroke-width': 1 }, g);
      });
      return;
    }
    S.el('path', { d: 'M28 31 L28 15 L39 23 L50 9 L61 23 L72 15 L72 31 Z',
      fill: GOLD, stroke: LINE, 'stroke-width': 1.4,
      'stroke-linejoin': 'round' }, g);
    S.el('rect', { x: 28, y: 29, width: 44, height: 6, rx: 2, fill: GOLD,
      stroke: LINE, 'stroke-width': 1.2 }, g);
    S.el('circle', { cx: 50, cy: 22, r: 3, fill: ink, stroke: LINE,
      'stroke-width': 1 }, g);
  }

  /* Half-figure drawn head-down into a 100x100 box. The card stamps it twice,
     the second copy rotated 180 degrees, exactly like a real court card:
     a light robe carrying suit-coloured blocks and gold trim. */
  function courtFigure(parent, x, y, w, h, card, ink, flip) {
    var t = 'translate(' + x + ',' + y + ') scale(' + (w / 100) + ',' + (h / 100) + ')';
    var outer = S.el('g', { transform: t }, parent);
    var g = S.el('g', flip ? { transform: 'rotate(180 50 50)' } : {}, outer);

    /* robe */
    S.el('path', {
      d: 'M18 100 L18 76 C18 64 31 57 50 57 C69 57 82 64 82 76 L82 100 Z',
      fill: '#fffdf6', stroke: LINE, 'stroke-width': 1.6
    }, g);
    S.el('path', { d: 'M18 100 L18 77 C18 69 24 63 33 60 L39 100 Z', fill: ink }, g);
    S.el('path', { d: 'M82 100 L82 77 C82 69 76 63 67 60 L61 100 Z', fill: ink }, g);
    S.el('path', { d: 'M39 100 L45 66 L55 66 L61 100 Z', fill: ink,
      opacity: 0.16 }, g);
    S.el('path', { d: 'M39 100 L45 66 M61 100 L55 66', fill: 'none',
      stroke: GOLD, 'stroke-width': 1.8 }, g);
    glyph(g, 50, 86, 16, card.suit.id, ink);

    /* ruff collar */
    S.el('path', {
      d: 'M30 60 L36 51 L43 59 L50 51 L57 59 L64 51 L70 60 L64 65 L50 67 L36 65 Z',
      fill: '#fffdf6', stroke: LINE, 'stroke-width': 1.3,
      'stroke-linejoin': 'round'
    }, g);

    /* hair, head, features */
    S.el('path', {
      d: 'M33 43 C33 25 40 18 50 18 C60 18 67 25 67 43 C67 51 64 56 59 58 ' +
         'L41 58 C36 56 33 51 33 43 Z',
      fill: HAIR, stroke: LINE, 'stroke-width': 1.3
    }, g);
    S.el('ellipse', { cx: 50, cy: 41, rx: 12, ry: 14, fill: SKIN,
      stroke: LINE, 'stroke-width': 1.3 }, g);
    S.el('circle', { cx: 45.5, cy: 38, r: 1.6, fill: LINE }, g);
    S.el('circle', { cx: 54.5, cy: 38, r: 1.6, fill: LINE }, g);
    S.el('path', { d: 'M50 41 L50 45 M46 49 Q50 51.5 54 49', fill: 'none',
      stroke: LINE, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
    if (card.rank.id === 'K') {
      S.el('path', { d: 'M40 50 Q50 62 60 50 Q56 58 50 58 Q44 58 40 50 Z',
        fill: '#e7e2d8', stroke: LINE, 'stroke-width': 1.1 }, g);
    }

    crown(g, card.rank.id, ink);
    return outer;
  }

  /* ---- the card itself ---------------------------------------------------- */

  function drawCard(parent, x, y, w, h, card) {
    var ink = INK[card.suit.color];
    var g = S.el('g', { transform: 'translate(' + x + ',' + y + ')' }, parent);

    S.el('rect', { x: 1, y: 1, width: w, height: h, rx: w * 0.07,
      fill: '#00000055' }, g);
    S.el('rect', { x: 0, y: 0, width: w, height: h, rx: w * 0.07,
      fill: FACE, stroke: '#b9b0a0', 'stroke-width': 1 }, g);

    /* corner indices, the second rotated 180 degrees like a real deck */
    var narrow = card.rank.id === '10';
    [0, 1].forEach(function (flip) {
      var cg = S.el('g', flip
        ? { transform: 'rotate(180 ' + (w / 2) + ' ' + (h / 2) + ')' } : {}, g);
      var t = S.text(cg, w * 0.115, h * 0.082, card.rank.id, {
        fill: ink, 'font-size': w * (narrow ? 0.165 : 0.195), 'font-weight': '700',
        'text-anchor': 'middle', 'letter-spacing': narrow ? -1 : 0
      });
      t.setAttribute('dominant-baseline', 'middle');
      glyph(cg, w * 0.115, h * 0.158, w * 0.108, card.suit.id, ink);
    });

    var pips = PIPS[card.rank.id];
    if (pips) {
      /* pip field, inset from the corner indices */
      /* field kept clear of both corner indices */
      var fx = w * 0.27, fw = w * 0.46;
      var fy = h * 0.215, fh = h * 0.57;
      pips.forEach(function (p) {
        glyph(g, fx + p[0] * fw, fy + p[1] * fh, w * 0.165, card.suit.id, ink,
          !!p[2]);
      });
    } else if (card.rank.id === 'A') {
      glyph(g, w * 0.5, h * 0.5, w * 0.46, card.suit.id, ink);
    } else {
      var px = w * 0.215, pw = w * 0.57;
      var py = h * 0.145, ph = h * 0.71;
      S.el('rect', { x: px, y: py, width: pw, height: ph, rx: 3,
        fill: '#fffdf6', stroke: ink, 'stroke-width': 1.2 }, g);
      courtFigure(g, px, py, pw, ph / 2, card, ink, false);
      courtFigure(g, px, py + ph / 2, pw, ph / 2, card, ink, true);
      glyph(g, px + pw * 0.13, py + ph * 0.075, w * 0.10, card.suit.id, ink);
      glyph(g, px + pw * 0.87, py + ph * 0.925, w * 0.10, card.suit.id, ink, true);
      S.el('line', { x1: px, y1: py + ph / 2, x2: px + pw, y2: py + ph / 2,
        stroke: ink, 'stroke-width': 1.2 }, g);
    }
    return g;
  }

  D.cards = {
    SUITS: SUITS, RANKS: RANKS, drawCard: drawCard, glyph: glyph,
    draw: function (rng) {
      return { suit: D.pick(rng, SUITS), rank: D.pick(rng, RANKS) };
    }
  };
})(DEFUSAL);
