/* ==========================================================================
   DEFUSAL — the device.

   The case has two live sides. Modules are split across them, so each module
   gets a bigger slot and there is room left over for the hardware that makes
   it a bomb. A control strip runs across the top rail of both faces carrying
   the clock, the drain bar, the strikes, the serial and the counter, so
   turning the case over never costs the defuser anything.

   Everything is laid out at a fixed design size and scaled to the viewport in
   one transform, so nothing ever reflows. Modules stay fully independent:
   each gets its own puzzle, its own DOM subtree and its own cleanup hook.
   ========================================================================== */

(function (D) {
  'use strict';

  var DIFFICULTIES = {
    easy:   { count: 3, seconds: 300 },
    medium: { count: 5, seconds: 420 },
    hard:   { count: 6, seconds: 480 },
    insane: { count: 8, seconds: 600 }
  };

  /* strikes wind the clock up a little — a classic touch */
  var STRIKE_RATE = [1, 1.08, 1.2];

  var CELL = 300, GAP = 12, STEP = CELL + GAP;
  var DEPTH = 150;                 /* how thick the case is, for the turn */
  var RAIL_X = 88, RAIL_TOP = 208, RAIL_BOT = 118;

  /* slot grids we build, smallest first */
  var SHAPES = [[3, 1], [5, 1], [3, 2], [5, 2]];

  var COLS = 5, ROWS = 2;
  var GRID_W = 0, GRID_H = 0, BOMB_W = 0, BOMB_H = 0;
  var builtShape = '';

  var state = null;
  var debug = false;
  var forcedSeed = null;   /* ?seed=N replays a specific bomb */
  var focused = null;
  var lastClock = '';
  var leaving = {};
  var dom = {};

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- case geometry ------------------------------------------------ */

  function setShape(cols, rows) {
    COLS = cols; ROWS = rows;
    GRID_W = cols * CELL + (cols - 1) * GAP;
    GRID_H = rows * CELL + (rows - 1) * GAP;
    BOMB_W = GRID_W + 2 * RAIL_X;
    BOMB_H = GRID_H + RAIL_TOP + RAIL_BOT;
    dom.bomb.style.width = BOMB_W + 'px';
    dom.bomb.style.height = BOMB_H + 'px';
    layoutBox();
    dom.faces.forEach(function (f) {
      f.grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + CELL + 'px)';
      f.grid.style.gridTemplateRows = 'repeat(' + rows + ', ' + CELL + 'px)';
    });
    var key = cols + 'x' + rows;
    if (builtShape !== key) {
      dom.faces[0].chassis.innerHTML = '';
      dom.faces[0].chassis.appendChild(buildFrontChassis());
      dom.faces[1].chassis.innerHTML = '';
      dom.faces[1].chassis.appendChild(buildBackChassis());
      builtShape = key;
    }
  }

  /* Lay the six pieces of the box out in 3D: two faces at +/- half the depth
     and four rims joining them, so the turn shows real thickness. */
  function layoutBox() {
    var half = DEPTH / 2;
    function place(node, w, h, transform) {
      node.style.width = w + 'px';
      node.style.height = h + 'px';
      node.style.marginLeft = (-w / 2) + 'px';
      node.style.marginTop = (-h / 2) + 'px';
      node.style.transform = transform;
    }
    place(dom.faceNodes[0], BOMB_W, BOMB_H, 'translateZ(' + half + 'px)');
    place(dom.faceNodes[1], BOMB_W, BOMB_H,
      'rotateY(180deg) translateZ(' + half + 'px)');
    place(dom.edges.left, DEPTH, BOMB_H,
      'translateX(' + (-BOMB_W / 2) + 'px) rotateY(-90deg)');
    place(dom.edges.right, DEPTH, BOMB_H,
      'translateX(' + (BOMB_W / 2) + 'px) rotateY(90deg)');
    place(dom.edges.top, BOMB_W, DEPTH,
      'translateY(' + (-BOMB_H / 2) + 'px) rotateX(90deg)');
    place(dom.edges.bottom, BOMB_W, DEPTH,
      'translateY(' + (BOMB_H / 2) + 'px) rotateX(-90deg)');
  }

  /* One transform keeps the case rigid at any window size. The tilt rides on
     top of it: the defuser cannot pick the case up, but the view leans with
     the cursor, which is enough to read it as an object in a room. */
  var scaleNow = 1, tiltX = 0, tiltY = 0;
  var armFactor = 1, armTilt = 0;      /* the arming pull-back */

  function applyBombTransform() {
    dom.bomb.style.transform =
      'translate(-50%, -50%) scale(' + (scaleNow * armFactor).toFixed(4) + ')' +
      ' rotateX(' + (tiltX + armTilt).toFixed(2) + 'deg)' +
      ' rotateY(' + tiltY.toFixed(2) + 'deg)';
  }

  function fit() {
    var w = (window.innerWidth || 1280) - 24;
    var h = (window.innerHeight || 720) - 24;
    scaleNow = Math.min(w / (BOMB_W || 1724), h / (BOMB_H || 938));
    applyBombTransform();
  }

  function reducedMotion() {
    try {
      return window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  /* Coalesced to one write per frame. Left unthrottled, a mousemove burst
     re-composites the whole preserve-3d tree several times per frame. */
  var pendingTilt = null, tiltRaf = 0;

  function flushTilt() {
    tiltRaf = 0;
    if (!pendingTilt) return;
    tiltY = pendingTilt[0];
    tiltX = pendingTilt[1];
    pendingTilt = null;
    applyBombTransform();
  }

  function trackCursor(e) {
    if (reducedMotion()) return;
    if (state && state.arming) return;      /* the intro owns the camera */
    var w = window.innerWidth || 1280, h = window.innerHeight || 720;
    var nx = (e.clientX / w) * 2 - 1;          /* -1 .. 1 */
    var ny = (e.clientY / h) * 2 - 1;
    pendingTilt = [D.clamp(nx * 9, -9, 9), D.clamp(-ny * 6, -6, 6)];
    if (!tiltRaf && window.requestAnimationFrame) {
      tiltRaf = window.requestAnimationFrame(flushTilt);
    } else if (!window.requestAnimationFrame) {
      flushTilt();
    }
  }

  /* ---------- chassis art --------------------------------------------------- */

  var INK = '#333b3f';

  function bolt(svg, x, y, r) {
    var S = D.svg, g = S.el('g', {}, svg);
    S.el('circle', { cx: x, cy: y, r: r, fill: '#c7ccce', stroke: INK,
      'stroke-width': 3.5 }, g);
    S.el('path', { d: 'M' + (x - r * 0.5) + ' ' + y + ' H' + (x + r * 0.5) +
      ' M' + x + ' ' + (y - r * 0.5) + ' V' + (y + r * 0.5),
      stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
  }

  function frame(svg) {
    var S = D.svg;
    /* carry handle above the control strip */
    var hw = 190, hx = BOMB_W / 2 - hw / 2;
    S.el('rect', { x: hx, y: 10, width: hw, height: 26, rx: 13,
      fill: '#c7ccce', stroke: INK, 'stroke-width': 4 }, svg);
    /* rail seams */
    S.el('line', { x1: 60, y1: RAIL_TOP - 12, x2: BOMB_W - 60, y2: RAIL_TOP - 12,
      stroke: 'rgba(0,0,0,.16)', 'stroke-width': 3 }, svg);
    S.el('line', { x1: 60, y1: BOMB_H - RAIL_BOT + 12, x2: BOMB_W - 60,
      y2: BOMB_H - RAIL_BOT + 12, stroke: 'rgba(0,0,0,.16)',
      'stroke-width': 3 }, svg);
    [[40, 40], [BOMB_W - 40, 40], [40, BOMB_H - 40], [BOMB_W - 40, BOMB_H - 40]]
      .forEach(function (q) { bolt(svg, q[0], q[1], 14); });
  }

  function cable(svg, d, color, w) {
    D.svg.el('path', { d: d, fill: 'none', stroke: INK,
      'stroke-width': (w || 8) + 6, 'stroke-linecap': 'round' }, svg);
    D.svg.el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': w || 8,
      'stroke-linecap': 'round' }, svg);
  }

  var WIRE = ['#d0574f', '#ddb63f', '#4180ae', '#4f9d5d'];

  function buildFrontChassis() {
    var S = D.svg, svg = S.root(0, 0, BOMB_W, BOMB_H);
    /* the wiring lives on the rim now; the faces stay quiet */
    [44, BOMB_W - 44].forEach(function (x) {
      S.el('rect', { x: x - 22, y: RAIL_TOP + 20, width: 44,
        height: GRID_H - 40, rx: 16, fill: 'rgba(0,0,0,.16)' }, svg);
      [0.2, 0.5, 0.8].forEach(function (f) {
        S.el('rect', { x: x - 30, y: RAIL_TOP + GRID_H * f - 10, width: 60,
          height: 20, rx: 7, fill: '#48575e', stroke: INK, 'stroke-width': 3 }, svg);
      });
    });
    /* a small maker's plate in the bottom rail */
    S.el('rect', { x: BOMB_W / 2 - 96, y: BOMB_H - RAIL_BOT + 34, width: 192,
      height: 44, rx: 10, fill: '#9aa7ac', stroke: INK, 'stroke-width': 3.5 }, svg);
    for (var i = 0; i < 3; i++) {
      S.el('rect', { x: BOMB_W / 2 - 74 + i * 52, y: BOMB_H - RAIL_BOT + 47,
        width: 34, height: 18, rx: 5, fill: '#77848a' }, svg);
    }
    frame(svg);
    return svg;
  }

  /* the back rail carries the payload, so there is no doubt what this is */
  function buildBackChassis() {
    var S = D.svg, svg = S.root(0, 0, BOMB_W, BOMB_H);

    var by = BOMB_H - RAIL_BOT + 16, sh = RAIL_BOT - 34;
    var n = Math.max(4, Math.round(BOMB_W / 330));
    var sw = Math.min(150, (BOMB_W - 320) / n - 12), gap = 12;
    var bw = n * sw + (n - 1) * gap, bx = BOMB_W / 2 - bw / 2;
    for (var k = 0; k < n; k++) {
      var x = bx + k * (sw + gap);
      S.el('rect', { x: x, y: by, width: sw, height: sh, rx: sh * 0.36,
        fill: '#a94a3f', stroke: INK, 'stroke-width': 4 }, svg);
      S.el('rect', { x: x + 12, y: by + 9, width: sw - 24, height: 9, rx: 5,
        fill: '#c26254' }, svg);
      [0.3, 0.7].forEach(function (f) {
        S.el('rect', { x: x + sw * f - 11, y: by, width: 22, height: sh,
          fill: '#e8ddc4', stroke: INK, 'stroke-width': 3 }, svg);
      });
    }
    [0.26, 0.74].forEach(function (f) {
      S.el('rect', { x: BOMB_W * f - 14, y: by - 10, width: 28, height: sh + 20,
        rx: 8, fill: '#4c4740', stroke: INK, 'stroke-width': 3.5 }, svg);
    });
    /* short leads from the payload out to the rim */
    [0, 1].forEach(function (side) {
      WIRE.forEach(function (c, i) {
        var y = by + sh * (0.22 + i * 0.18);
        cable(svg, 'M' + (side ? bx + bw + 4 : bx - 4) + ' ' + y +
          ' C' + (side ? bx + bw + 90 : bx - 90) + ' ' + y + ' ' +
          (side ? BOMB_W - 120 : 120) + ' ' + (y - 30) + ' ' +
          (side ? BOMB_W - 30 : 30) + ' ' + (y - 40), c, 6);
      });
    });
    frame(svg);
    return svg;
  }

  /* ---------- decorative fittings ------------------------------------------- */
  /* Bolted-in hardware for slots no module occupies. They carry no lamp and no
     lens, so they never read as something to solve. */

  var FITTINGS = ['battery', 'wires', 'vent', 'ports', 'gauge'];

  function buildFitting(kind) {
    var S = D.svg, svg = S.root(0, 0, 260, 260, 'art');
    var g = S.el('g', {}, svg);
    S.el('rect', { x: 8, y: 8, width: 244, height: 244, rx: 14,
      fill: '#93a3a9', stroke: '#5d6c72', 'stroke-width': 4 }, g);
    [[30, 30], [230, 30], [30, 230], [230, 230]].forEach(function (q) {
      S.el('circle', { cx: q[0], cy: q[1], r: 7, fill: '#c7ccce',
        stroke: INK, 'stroke-width': 3 }, g);
    });

    if (kind === 'battery') {
      [0, 1].forEach(function (i) {
        var y = 74 + i * 78;
        S.el('rect', { x: 42, y: y, width: 176, height: 60, rx: 16,
          fill: '#3d4a52', stroke: INK, 'stroke-width': 4 }, g);
        S.el('rect', { x: 54, y: y + 12, width: 116, height: 36, rx: 9,
          fill: '#d9b74a' }, g);
        S.el('rect', { x: 212, y: y + 20, width: 16, height: 20, rx: 4,
          fill: '#c7ccce', stroke: INK, 'stroke-width': 3 }, g);
      });
    } else if (kind === 'wires') {
      S.el('rect', { x: 34, y: 44, width: 44, height: 172, rx: 10,
        fill: '#3f4a4f', stroke: INK, 'stroke-width': 4 }, g);
      S.el('rect', { x: 182, y: 44, width: 44, height: 172, rx: 10,
        fill: '#3f4a4f', stroke: INK, 'stroke-width': 4 }, g);
      WIRE.forEach(function (c, i) {
        var y = 74 + i * 38;
        cable(g, 'M78 ' + y + ' C120 ' + (y - 26) + ' 140 ' + (y + 26) +
          ' 182 ' + y, c, 9);
      });
    } else if (kind === 'vent') {
      for (var v = 0; v < 7; v++) {
        S.el('rect', { x: 40, y: 46 + v * 24, width: 180, height: 13, rx: 6,
          fill: '#404a4f', stroke: INK, 'stroke-width': 3 }, g);
      }
    } else if (kind === 'ports') {
      S.el('rect', { x: 40, y: 56, width: 180, height: 62, rx: 10,
        fill: '#3f4a4f', stroke: INK, 'stroke-width': 4 }, g);
      for (var p2 = 0; p2 < 5; p2++) {
        S.el('rect', { x: 56 + p2 * 32, y: 74, width: 18, height: 26, rx: 4,
          fill: '#c7ccce' }, g);
      }
      S.el('rect', { x: 66, y: 148, width: 128, height: 58, rx: 26,
        fill: '#3f4a4f', stroke: INK, 'stroke-width': 4 }, g);
      S.el('circle', { cx: 130, cy: 177, r: 18, fill: '#c7ccce' }, g);
    } else {
      S.el('circle', { cx: 130, cy: 130, r: 76, fill: '#e8e2d3',
        stroke: INK, 'stroke-width': 4 }, g);
      for (var t = 0; t < 12; t++) {
        var a = S.polar(130, 130, 68, 90 - t * 30), b = S.polar(130, 130, 56, 90 - t * 30);
        S.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: INK,
          'stroke-width': 3 }, g);
      }
      var tip = S.polar(130, 130, 50, 46);
      S.el('line', { x1: 130, y1: 130, x2: tip.x, y2: tip.y, stroke: '#d0574f',
        'stroke-width': 5, 'stroke-linecap': 'round' }, g);
      S.el('circle', { cx: 130, cy: 130, r: 8, fill: INK }, g);
    }
    return svg;
  }

  /* ---------- the control strip --------------------------------------------- */

  function buildPanel(host, faceIndex) {
    host.innerHTML = '';
    var strip = el('div', 'strip', host);

    var clockBox = el('div', 'clock', strip);
    var lcd = el('div', 'lcd', clockBox);
    var digits = el('span', 'digits', lcd);
    digits.textContent = '00:00';
    var fuse = el('div', 'fuse', clockBox);
    var fill = el('i', '', fuse);

    var gauges = el('div', 'gauges', strip);
    var strikes = el('div', 'strike-row', gauges);
    for (var k = 0; k < 3; k++) el('i', '', strikes);
    var serial = el('div', 'plate', gauges);
    serial.textContent = state.ctx.serial;

    var tail = el('div', 'tail', strip);
    var count = el('span', 'count', tail);
    var abort = el('button', 'abort', tail);
    abort.type = 'button';
    abort.textContent = 'ABORT';
    abort.addEventListener('click', function () {
      D.audio.click(); teardown(); show('menu');
    });

    if (faceIndex === 0) {
      lcd.id = 'timer'; strikes.id = 'strikes';
      serial.id = 'serial'; count.id = 'modcount';
    }
    dom.clocks.push({ lcd: lcd, digits: digits, fuse: fuse, fill: fill,
                      strikes: strikes, count: count });
  }

  /* the reverse has no clock: turning the case over costs you sight of it */
  function buildBackPlate(host) {
    host.innerHTML = '';
    var strip = el('div', 'strip plate-only', host);
    var mark = el('div', 'stamp', strip);
    mark.textContent = state.ctx.serial;
    var sub = el('div', 'stamp-sub', strip);
    sub.textContent = 'REVERSE';
  }

  /* ---------- slot packing --------------------------------------------------- */

  function slotWidth(span) { return span * CELL + (span - 1) * GAP; }

  function candidates(span) {
    var list = [], r, c;
    var mr = (ROWS - 1) / 2, mc = (COLS - 1) / 2;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c + span <= COLS; c++) {
        var mid = c + (span - 1) / 2;
        list.push({ r: r, c: c, d: Math.abs(r - mr) * 2.2 + Math.abs(mid - mc) });
      }
    }
    list.sort(function (a, b) { return a.d - b.d || a.r - b.r || a.c - b.c; });
    return list;
  }

  function packSlots(ids) {
    var occ = [], r, c;
    for (r = 0; r < ROWS; r++) {
      occ[r] = [];
      for (c = 0; c < COLS; c++) occ[r][c] = false;
    }
    function free(rr, cc, span) {
      for (var k = 0; k < span; k++) if (occ[rr][cc + k]) return false;
      return true;
    }
    function take(rr, cc, span) {
      for (var k = 0; k < span; k++) occ[rr][cc + k] = true;
    }

    var placed = [];
    /* wide modules go down first: they are the ones that can fail to fit */
    [2, 1].forEach(function (span) {
      var spots = candidates(span);
      ids.filter(function (id) { return (D.byId[id].wide ? 2 : 1) === span; })
        .forEach(function (id) {
          var i, sp;
          for (i = 0; i < spots.length; i++) {
            sp = spots[i];
            if (free(sp.r, sp.c, span)) {
              take(sp.r, sp.c, span);
              placed.push({ id: id, r: sp.r, c: sp.c, span: span });
              return;
            }
          }
          var ones = candidates(1);
          for (i = 0; i < ones.length; i++) {
            sp = ones[i];
            if (free(sp.r, sp.c, 1)) {
              take(sp.r, sp.c, 1);
              placed.push({ id: id, r: sp.r, c: sp.c, span: 1 });
              return;
            }
          }
        });
    });

    var blanks = [];
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) if (!occ[r][c]) blanks.push({ r: r, c: c });
    }
    return { placed: placed, blanks: blanks };
  }

  function setSlot(node, r, c, span) {
    node.style.gridColumn = (c + 1) + ' / span ' + span;
    node.style.gridRow = (r + 1);
  }

  var BAY_LEAD = 180, BAY_STEP = 95;

  /* ---------- module selection ----------------------------------------------- */

  function ratingOf(id) { return D.byId[id].rating; }
  function costOf(id) { return D.byId[id].wide ? 2 : 1; }

  function satisfies(ids, difficulty) {
    var hard = ids.filter(function (id) { return ratingOf(id) === 'hard'; }).length;
    switch (difficulty) {
      case 'easy':   return hard <= 1;
      case 'medium': return hard >= 1;
      case 'hard':   return hard === 2;
      default:       return true;
    }
  }

  function chooseModules(rng, difficulty, count) {
    var all = D.modules.map(function (m) { return m.id; });
    count = Math.min(count, all.length);
    var tries = 0, pick;
    do {
      pick = D.shuffle(rng, all).slice(0, count);
      tries++;
    } while (!satisfies(pick, difficulty) && tries < 2000);
    return pick;
  }

  /* heaviest first into the lighter face, so the two sides stay balanced */
  function splitModules(ids) {
    var sorted = ids.slice().sort(function (a, b) { return costOf(b) - costOf(a); });
    var faces = [[], []], load = [0, 0];
    sorted.forEach(function (id) {
      var i = load[0] <= load[1] ? 0 : 1;
      faces[i].push(id);
      load[i] += costOf(id);
    });
    return faces;
  }

  function wideCapacity(cols, rows) { return Math.floor(cols / 2) * rows; }

  function chooseShape(faces) {
    var need = 0, wide = 0;
    faces.forEach(function (ids) {
      var c = 0, w = 0;
      ids.forEach(function (id) { c += costOf(id); if (D.byId[id].wide) w++; });
      need = Math.max(need, c);
      wide = Math.max(wide, w);
    });
    for (var i = 0; i < SHAPES.length; i++) {
      var cols = SHAPES[i][0], rows = SHAPES[i][1];
      if (cols * rows >= need && wideCapacity(cols, rows) >= wide) return SHAPES[i];
    }
    return SHAPES[SHAPES.length - 1];
  }

  /* ---------- the voice ------------------------------------------------------- */

  var SAID_WON = [
    'One device answered. The tally holds.',
    'Recorded. You may continue, for now.',
    'Answered. Another will be set.',
    'Noted. The count moves your way, for now.'
  ];
  var SAID_LOST = [
    'One mark against you. There are others still working.',
    'This one goes dark. The tally is long.',
    'Recorded. Others are still answering.',
    'A mark, no more. The count continues elsewhere.'
  ];
  var SAID_ARM = [
    'A device is set. The rules are not here.',
    'Another trial. Reach each other.',
    'It is listening. So are we.',
    'Begin when it wakes.'
  ];

  function pickSaying(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* Five devices, each harder than the last. Free play and practice stay
     locked until all five are answered, so the story has somewhere to go. */
  var STAGES = [
    { name: 'TRIVIAL',      count: 3, seconds: 300, rule: 'easy'   },
    { name: 'ELEMENTARY',   count: 4, seconds: 330, rule: 'easy'   },
    { name: 'NONTRIVIAL',   count: 5, seconds: 420, rule: 'medium' },
    { name: 'PATHOLOGICAL', count: 6, seconds: 480, rule: 'hard'   },
    { name: 'INTRACTABLE',  count: 8, seconds: 600, rule: 'insane' }
  ];
  var STAGE_KEY = 'defusal.stage';

  function cleared() {
    try {
      var n = parseInt(window.localStorage.getItem(STAGE_KEY), 10);
      return (n >= 0 && n <= STAGES.length) ? n : 0;
    } catch (e) { return 0; }
  }
  function setCleared(n) {
    try { window.localStorage.setItem(STAGE_KEY, String(n)); } catch (e) {}
  }

  /* per-stage record, kept only if the browser lets us store it */
  var STATS_KEY = 'defusal.stats';
  function loadStats() {
    try {
      var raw = JSON.parse(window.localStorage.getItem(STATS_KEY));
      if (raw && typeof raw === 'object') return raw;
    } catch (e) {}
    return {};
  }
  function saveStats(t) {
    try { window.localStorage.setItem(STATS_KEY, JSON.stringify(t)); } catch (e) {}
  }
  function bumpStat(stage, field, value) {
    var t = loadStats(), k = String(stage);
    t[k] = t[k] || { a: 0, best: 0 };
    if (field === 'a') t[k].a++;
    else t[k].best = Math.max(t[k].best || 0, value);
    saveStats(t);
  }

  /* A glyph that visibly gains complexity stage by stage: a polygon with one
     more side each time, ringed by one more satellite. */
  function stageEmblem(i) {
    var S = D.svg, svg = S.root(0, 0, 120, 120, 'emblem');
    var sides = i + 3, cx = 60, cy = 60, r = 30;
    var pts = [], k;
    for (k = 0; k < sides; k++) {
      var p = S.polar(cx, cy, r, 90 + k * 360 / sides);
      pts.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
    }
    S.el('polygon', { points: pts.join(' '), fill: 'none',
      stroke: 'currentColor', 'stroke-width': 3,
      'stroke-linejoin': 'round' }, svg);
    for (k = 0; k < sides; k++) {
      var q = S.polar(cx, cy, 48, 90 + (k + 0.5) * 360 / sides);
      S.el('circle', { cx: q.x, cy: q.y, r: 4, fill: 'currentColor' }, svg);
    }
    if (i >= 3) {
      S.el('circle', { cx: cx, cy: cy, r: 13, fill: 'none',
        stroke: 'currentColor', 'stroke-width': 3 }, svg);
    }
    if (i >= 4) {
      S.el('circle', { cx: cx, cy: cy, r: 5, fill: 'currentColor' }, svg);
    }
    return svg;
  }

  /* ---------- the selector ----------------------------------------------- */
  /* One page per device, moved through one at a time, so choosing a stage is
     an event rather than a row of buttons. */

  var selIndex = 0, pages = [];

  /* cool to hot as the devices get harder */
  var ACCENT = ['#6fd7e8', '#5fc79a', '#e3c65a', '#e8974a', '#e0645c'];

  /* the two halves of the premise, drawn either side of the selector */
  function flankArt(kind) {
    var S = D.svg, svg = S.root(0, 0, 132, 150);
    function ink(tag, a) {
      a.fill = a.fill || 'none'; a.stroke = 'currentColor';
      a['stroke-width'] = a['stroke-width'] || 2.4;
      a['stroke-linejoin'] = 'round';
      return S.el(tag, a, svg);
    }
    if (kind === 'device') {
      ink('rect', { x: 12, y: 30, width: 108, height: 78, rx: 9, 'stroke-width': 3 });
      [0, 1].forEach(function (r) {
        [0, 1, 2].forEach(function (c) {
          ink('rect', { x: 22 + c * 33, y: 40 + r * 32, width: 25, height: 24, rx: 4 });
        });
      });
      ink('rect', { x: 46, y: 18, width: 40, height: 10, rx: 5 });
    } else {
      ink('rect', { x: 20, y: 24, width: 92, height: 96, rx: 6, 'stroke-width': 3 });
      ink('rect', { x: 20, y: 24, width: 22, height: 96, rx: 6, 'stroke-width': 3 });
      [42, 62, 82, 102].forEach(function (y) {
        ink('circle', { cx: 31, cy: y, r: 4, 'stroke-width': 2 });
      });
      [40, 54, 68].forEach(function (y) {
        ink('line', { x1: 52, y1: y, x2: 100, y2: y, 'stroke-width': 2 });
      });
      ink('line', { x1: 52, y1: 82, x2: 84, y2: 82, 'stroke-width': 2 });
    }
    var t = S.text(svg, 66, 140, kind === 'device' ? 'THE DEVICE' : 'THE RULES', {
      'text-anchor': 'middle', fill: 'currentColor', 'font-size': 9,
      'letter-spacing': 2, 'font-family': 'inherit'
    });
    return t && svg;
  }

  function card(parent) {
    var page = el('div', 'page', parent);
    return el('div', 'card', page);
  }

  function fact(list, label) {
    var row = el('div', 'fact', list);
    el('span', '', row).textContent = label;
    return el('b', '', row);
  }

  function buildSelect() {
    dom.track.innerHTML = '';
    pages = [];

    if (!dom.select.querySelector('.flank')) {
      ['device', 'rules'].forEach(function (kind, i) {
        var f = el('div', 'flank ' + (i ? 'right' : 'left'), dom.select);
        f.appendChild(flankArt(kind));
      });
    }

    STAGES.forEach(function (st, i) {
      var c = card(dom.track);
      el('div', 'idx', c).textContent = 'DEVICE ' + (i + 1);
      el('div', 'nm', c).textContent = st.name;
      var em = el('div', 'emblem-wrap', c);
      em.appendChild(stageEmblem(i));
      var facts = el('div', 'facts', c);
      var fMod = fact(facts, 'MODULES');
      var fTime = fact(facts, 'TIME');
      var fBest = fact(facts, 'BEST LEFT');
      var fTry = fact(facts, 'ATTEMPTS');
      var go = el('button', 'key go engage', c);
      go.type = 'button';
      el('b', '', go).textContent = 'ENGAGE';
      go.addEventListener('click', function () {
        if (go.disabled) return;
        D.audio.click();
        start({ difficulty: st.rule, count: st.count, seconds: st.seconds,
                stage: i + 1 });
      });
      c.style.setProperty('--accent', ACCENT[i]);
      pages.push({ el: c, kind: 'stage', i: i, go: go, accent: ACCENT[i],
                   fMod: fMod, fTime: fTime, fBest: fBest, fTry: fTry });
    });

    var sc = card(dom.track);
    el('div', 'idx', sc).textContent = 'FREE';
    el('div', 'nm', sc).textContent = 'SANDBOX';
    el('div', 'blurb', sc).textContent =
      'Set your own device. Nothing here is recorded.';
    sc.appendChild(dom.practicePanel);
    dom.practicePanel.hidden = false;
    pages.push({ el: sc, kind: 'sandbox', need: 1 });

    var fc = card(dom.track);
    el('div', 'idx', fc).textContent = 'FREE';
    el('div', 'nm', fc).textContent = 'OPEN PLAY';
    el('div', 'blurb', fc).textContent = 'Any device, in any order.';
    fc.appendChild(dom.freeRow);
    pages.push({ el: fc, kind: 'free', need: STAGES.length });

    dom.dots.innerHTML = '';
    pages.forEach(function (pg, i) {
      var d = el('button', 'dot', dom.dots);
      d.type = 'button';
      d.addEventListener('click', function () { D.audio.click(); gotoPage(i); });
      pg.dot = d;
    });
  }

  function gotoPage(i) {
    selIndex = D.clamp(i, 0, pages.length - 1);
    dom.track.style.transform = 'translateX(' + (-selIndex * 100) + '%)';
    pages.forEach(function (pg, k) {
      pg.dot.classList.toggle('on', k === selIndex);
      pg.el.classList.toggle('focused-page', k === selIndex);
    });
    dom.prev.disabled = (selIndex === 0);
    dom.next.disabled = (selIndex === pages.length - 1);
  }

  function paintMenu() {
    var done = cleared();
    var stats = loadStats();

    pages.forEach(function (pg) {
      var locked;
      if (pg.kind === 'stage') {
        locked = pg.i > done;
        var st = STAGES[pg.i], rec = stats[String(pg.i + 1)] || {};
        pg.fMod.textContent = String(st.count);
        pg.fTime.textContent = mmss(st.seconds);
        pg.fBest.textContent = rec.best ? mmss(rec.best) : '—';
        pg.fTry.textContent = String(rec.a || 0);
        pg.go.disabled = locked;
        pg.go.querySelector('b').textContent = locked ? 'LOCKED'
          : (pg.i < done ? 'AGAIN' : 'ENGAGE');
        pg.el.classList.toggle('done', pg.i < done);
      } else {
        locked = done < pg.need;
      }
      pg.el.classList.toggle('locked', locked);
      pg.el.classList.toggle('next', pg.kind === 'stage' && pg.i === done);
      pg.dot.classList.toggle('locked', locked);
      if (pg.accent) pg.dot.style.setProperty('--dot', pg.accent);
      if (pg.kind === 'sandbox') dom.practiceStart.disabled = locked;
      if (pg.kind === 'free') {
        [].forEach.call(dom.freeRow.querySelectorAll('[data-diff]'), function (b) {
          b.disabled = locked;
          b.classList.toggle('locked', locked);
        });
      }
    });

    dom.progress.textContent = (done >= STAGES.length)
      ? 'all five devices answered'
      : 'device ' + (done + 1) + ' of ' + STAGES.length;
    gotoPage(selIndex);
  }

  /* ---------- screens --------------------------------------------------------- */

  function show(screen) {
    ['menu', 'game', 'result'].forEach(function (name) {
      var node = dom['screen-' + name];
      if (name === screen) {
        if (leaving[name]) { clearTimeout(leaving[name]); leaving[name] = null; }
        node.classList.remove('leaving');
        node.hidden = false;
        node.classList.remove('entering');
        void node.offsetWidth;
        node.classList.add('entering');
        setTimeout(function () { node.classList.remove('entering'); }, 1000);
      } else if (!node.hidden) {
        node.classList.remove('entering');
        node.classList.add('leaving');
        if (leaving[name]) clearTimeout(leaving[name]);
        leaving[name] = setTimeout(function () {
          node.classList.remove('leaving');
          node.hidden = true;
          leaving[name] = null;
        }, 300);
      }
    });
    document.body.classList.toggle('playing', screen === 'game');
    if (screen === 'game') fit();
  }

  function flash(kind) {
    dom.flash.className = 'flash';
    void dom.flash.offsetWidth;
    dom.flash.classList.add(kind);
  }

  function shakeCase() {
    dom.faces.forEach(function (f) {
      f.casing.classList.remove('shake');
      void f.casing.offsetWidth;
      f.casing.classList.add('shake');
      setTimeout(function () { f.casing.classList.remove('shake'); }, 580);
    });
  }

  /* ---------- focus view ------------------------------------------------------ */

  function slotCentre(slot) {
    return { x: slot.c * STEP + slotWidth(slot.span) / 2,
             y: slot.r * STEP + CELL / 2 };
  }

  function clearFocus(silent) {
    if (!focused) return;
    focused.bay.classList.remove('focused');
    focused.bay.style.transform = '';
    dom.faces[focused.faceIndex].casing.classList.remove('focusing');
    focused = null;
    if (!silent) D.audio.zoom(false);
  }

  function toggleFocus(inst) {
    var was = focused;
    clearFocus(true);
    if (was === inst) { D.audio.zoom(false); return; }

    focused = inst;
    var c = slotCentre(inst.slot);
    var w = slotWidth(inst.slot.span);
    /* measured against the whole case, not the grid: on a one-row shape the
       grid is shorter than a bay and the module was coming out smaller */
    var k = Math.max(1.45, Math.min((BOMB_W - 150) / w,
                                    (BOMB_H - RAIL_TOP - 70) / CELL, 2.8));
    inst.bay.classList.add('focused');
    inst.bay.style.transform =
      'translate(' + (GRID_W / 2 - c.x).toFixed(1) + 'px,' +
      (GRID_H / 2 - c.y).toFixed(1) + 'px) translateZ(60px) scale(' +
      k.toFixed(3) + ')';
    dom.faces[inst.faceIndex].casing.classList.add('focusing');
    D.audio.zoom(true);
  }

  function flip() {
    clearFocus(true);
    var showingBack = dom.bomb.classList.toggle('flipped');
    D.audio.flip(showingBack);
  }

  /* ---------- game lifecycle -------------------------------------------------- */

  function start(config) {
    teardown();

    var seed = (config.seed !== undefined) ? config.seed
      : (forcedSeed !== null ? forcedSeed
        : (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0));
    var rng = D.makeRng(seed);
    var serial = D.makeSerial(rng);
    var ctx = { serial: serial, serialInfo: D.serialInfo(serial) };
    var ids = chooseModules(rng, config.difficulty, config.count);
    if (config.stage) bumpStat(config.stage, 'a');
    var faces = splitModules(ids);

    state = {
      seed: seed, config: config, ctx: ctx,
      total: config.seconds, remaining: config.seconds,
      strikes: 0, solved: 0, instances: [],
      running: true, last: Date.now(), timer: null, nextBeep: 0
    };

    clearFocus(true);
    dom.bomb.classList.remove('flipped');
    dom.clocks = [];

    var shape = chooseShape(faces);
    setShape(shape[0], shape[1]);

    var fittingPool = D.shuffle(rng, FITTINGS);
    var fittingAt = 0;
    var lastLit = 0;

    dom.faces.forEach(function (face, fi) {
      if (fi === 0) buildPanel(face.panel, fi);
      else buildBackPlate(face.panel);
      face.grid.innerHTML = '';
      var layout = packSlots(faces[fi]);

      /* every slot on the face, in reading order, so they light one by one */
      var slots = layout.placed.map(function (sl) {
        return { slot: sl, node: null, module: true };
      }).concat(layout.blanks.map(function (sl, k) {
        return { slot: sl, node: null, module: false, index: k };
      }));
      slots.sort(function (a, b) {
        return a.slot.r - b.slot.r || a.slot.c - b.slot.c;
      });

      slots.forEach(function (entry, i) {
        var sl = entry.slot, bay;
        if (entry.module) {
          bay = buildModuleBay(sl.id, ctx, rng, sl, fi);
        } else if (entry.index < 3 && fittingAt < fittingPool.length) {
          bay = el('div', 'bay fitting');
          bay.appendChild(buildFitting(fittingPool[fittingAt++]));
        } else {
          bay = el('div', 'bay blank');
        }
        setSlot(bay, sl.r, sl.c, sl.span || 1);
        bay.style.setProperty('--d', (BAY_LEAD + i * BAY_STEP) + 'ms');
        face.grid.appendChild(bay);
        if (i > lastLit) lastLit = i;
      });

      face.casing.style.setProperty('--panel-d',
        (BAY_LEAD + (lastLit + 1) * BAY_STEP + 60) + 'ms');
      face.casing.classList.remove('arming');
      void face.casing.offsetWidth;
      face.casing.classList.add('arming');
    });

    /* The camera pulls back so the whole device is in frame, the slots light
       one at a time, the strip comes up last, and only then does it push in
       to the working view — which is the moment the clock is released. */
    var panelDelay = BAY_LEAD + (lastLit + 1) * BAY_STEP + 60;
    var bayDelays = [];
    for (var b = 0; b <= lastLit; b++) bayDelays.push(BAY_LEAD + b * BAY_STEP);

    var slow = reducedMotion();
    /* with motion off there is no push to wait for, so do not stall the clock */
    var PUSH_AT = slow ? panelDelay : panelDelay + 300;
    var PUSH_MS = slow ? 0 : 1150;
    state.arming = true;
    state.armingUntil = Date.now() + PUSH_AT + PUSH_MS;

    dom.bomb.classList.add('arming');
    dom.bomb.classList.remove('arming-zoom');
    if (slow) { armFactor = 1; armTilt = 0; }
    else { armFactor = 0.46; armTilt = 10; }
    tiltX = 0; tiltY = 0;
    applyBombTransform();

    setTimeout(function () {
      dom.bomb.classList.add('arming-zoom');
      armFactor = 1; armTilt = 0;
      applyBombTransform();
      D.audio.push();
    }, PUSH_AT);

    setTimeout(function () {
      dom.bomb.classList.remove('arming', 'arming-zoom');
      dom.faces.forEach(function (f) { f.casing.classList.remove('arming'); });
      if (state) state.arming = false;
    }, PUSH_AT + PUSH_MS);

    lastClock = '';
    renderStrikes();
    renderTimer();
    updateCount();
    applyDebug();

    D.audio.unlock();
    D.audio.boot(bayDelays, panelDelay);

    /* one line while the case wakes up; it never blocks anything */
    dom.armingLine.textContent = pickSaying(SAID_ARM);
    dom.armingLine.classList.remove('on');
    void dom.armingLine.offsetWidth;
    dom.armingLine.classList.add('on');

    show('game');
    state.last = Date.now();
    state.timer = setInterval(tick, 100);
  }

  function buildModuleBay(id, ctx, rng, slot, faceIndex) {
    var def = D.byId[id];
    var puzzle = def.generate(rng, ctx);
    var solution = def.solve(puzzle, ctx);

    var bay = el('div', 'bay module' + (def.wide ? ' wide' : ''));
    bay.setAttribute('data-id', id);
    el('div', 'led', bay);

    var zoom = el('button', 'zoom', bay);
    zoom.type = 'button';
    zoom.title = 'focus on this module';
    zoom.innerHTML =
      '<svg viewBox="0 0 16 16"><circle class="in" cx="6.6" cy="6.6" r="4.6">' +
      '</circle><path class="in" d="M10 10 L14.5 14.5"></path>' +
      '<path class="out" d="M3.5 8 L12.5 8"></path></svg>';

    var body = el('div', 'body', bay);
    var dots = el('div', 'dots', bay);

    var tag = el('div', 'answer-tag', bay);
    tag.textContent = def.debugText(puzzle, solution, ctx);

    /* Only a real control answers a click. Listening at the bay meant a click
       on bare panel played a key press, which made the whole case feel like
       one big button. */
    bay.addEventListener('click', function (e) {
      var n = e.target;
      while (n && n !== bay) {
        var tag = n.tagName ? String(n.tagName).toUpperCase() : '';
        if (tag === 'INPUT') return;
        if (tag === 'BUTTON') { D.audio.press(); return; }
        var cls = n.getAttribute ? (n.getAttribute('class') || '') : '';
        if ((' ' + cls + ' ').indexOf(' hit ') >= 0) { D.audio.press(); return; }
        n = n.parentNode;
      }
    });

    var inst = {
      id: id, def: def, puzzle: puzzle, solution: solution, ctx: ctx,
      bay: bay, dots: dots, slot: slot, faceIndex: faceIndex,
      solved: false, onSolved: null, cleanup: null,

      isSolved: function () { return inst.solved; },

      progress: function (n) {
        dots.innerHTML = '';
        for (var j = 0; j < n; j++) el('i', '', dots);
      },

      solve: function () {
        if (inst.solved || !state || !state.running) return;
        inst.solved = true;
        bay.classList.add('solved');
        dots.innerHTML = '';
        if (inst.onSolved) inst.onSolved();
        if (inst.cleanup) { inst.cleanup(); inst.cleanup = null; }
        D.audio.solve();
        if (focused === inst) setTimeout(function () { clearFocus(true); }, 900);
        state.solved++;
        updateCount();
        if (state.solved === state.instances.length) finish(true, 'all modules solved');
      },

      strike: function () {
        if (inst.solved || !state || !state.running) return;
        bay.classList.remove('striking');
        void bay.offsetWidth;
        bay.classList.add('striking');
        setTimeout(function () { bay.classList.remove('striking'); }, 620);
        addStrike();
      }
    };

    zoom.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFocus(inst);
    });

    def.mount(body, inst);
    /* debug builds only: the headless harness drives real games through this */
    if (debug) bay.__instance = inst;
    state.instances.push(inst);
    return bay;
  }

  function updateCount() {
    var txt = state.solved + '/' + state.instances.length;
    dom.clocks.forEach(function (c) { c.count.textContent = txt; });
  }

  function addStrike() {
    state.strikes++;
    renderStrikes();
    D.audio.strike();
    shakeCase();
    flash('strike');
    if (state.strikes >= 3) finish(false, 'three strikes');
  }

  function renderStrikes() {
    dom.clocks.forEach(function (c) {
      var kids = c.strikes.children, i;
      for (i = 0; i < kids.length; i++) {
        kids[i].className = (i < state.strikes) ? 'lit' : '';
      }
    });
  }

  function renderTimer() {
    var t = Math.max(0, Math.ceil(state.remaining));
    var text = mmss(t);
    var frac = state.total ? Math.max(0, Math.min(1, state.remaining / state.total)) : 0;
    var pct = (frac * 100).toFixed(2) + '%';
    var ticked = (text !== lastClock);

    dom.clocks.forEach(function (c) {
      if (ticked) {
        c.digits.textContent = text;
        if (lastClock !== '') {
          c.digits.classList.remove('tick');
          void c.digits.offsetWidth;
          c.digits.classList.add('tick');
        }
      }
      c.fill.style.width = pct;
      c.fuse.classList.toggle('warn', frac <= 0.5 && frac > 0.2);
      c.fuse.classList.toggle('danger', frac <= 0.2);
      c.lcd.classList.toggle('urgent', t <= 30);
    });

    if (ticked) lastClock = text;
    dom['screen-game'].classList.toggle('critical', t <= 30 && state.running);
  }

  /* the closer it gets, the more often it speaks */
  function beepGap(left) {
    return left > 120 ? 1.0 : left > 60 ? 0.75 : left > 30 ? 0.5
         : left > 10 ? 0.3 : 0.18;
  }

  /* Beeps ride the audio clock, queued a little ahead of time. Fired straight
     from the 100ms interval they inherited its jitter, and the old accumulator
     reset to zero on each beep, throwing the overshoot away — so the pulse
     drifted and stuttered. Queued this way the spacing is sample-exact. */
  var BEEP_AHEAD = 0.2;

  function scheduleBeeps(left) {
    var t = D.audio.now();
    if (!t) return;                    /* audio not unlocked yet */
    if (!state.nextBeep || state.nextBeep < t) state.nextBeep = t;

    var horizon = t + BEEP_AHEAD, guard = 0;
    while (state.nextBeep < horizon && guard++ < 16) {
      var at = state.nextBeep;
      var leftThen = Math.max(0, left - (at - t));   /* clock at sounding time */
      D.audio.beep(1 - Math.min(1, leftThen / 90), at);
      state.nextBeep = at + beepGap(leftThen);
    }
  }

  function tick() {
    if (!state || !state.running) return;
    var now = Date.now();
    if (now < state.armingUntil) {   /* still powering up */
      state.last = now;
      renderTimer();
      return;
    }
    var dt = (now - state.last) / 1000;
    state.last = now;
    state.remaining -= dt * STRIKE_RATE[Math.min(state.strikes, 2)];

    var left = Math.max(0, state.remaining);
    scheduleBeeps(left);
    if (state.remaining <= 0) {
      state.remaining = 0;
      renderTimer();
      finish(false, 'the clock ran out');
      return;
    }
    renderTimer();
  }

  function finish(won, cause) {
    if (!state || !state.running) return;
    state.running = false;
    clearInterval(state.timer);
    D.audio.stopBeeps();
    state.instances.forEach(function (i) {
      if (i.cleanup) { i.cleanup(); i.cleanup = null; }
    });

    dom['screen-game'].classList.remove('critical');
    flash(won ? 'safe' : 'boom');
    if (won) D.audio.defused(); else D.audio.exploded();

    var left = Math.max(0, Math.round(state.remaining));
    var spent = Math.max(0, Math.round(state.total - state.remaining));

    dom.resultTitle.textContent = won ? 'DEFUSED' : 'EXPLODED';
    dom.resultTitle.className = 'verdict ' + (won ? 'good' : 'bad');
    dom.resultVoice.textContent = pickSaying(won ? SAID_WON : SAID_LOST);
    dom.resultCause.textContent = won ? 'every module solved' : cause;

    /* clearing a stage moves the story on */
    var pending = null;
    if (won && state.config.stage) {
      var n = state.config.stage;
      if (n > cleared()) setCleared(n);
      bumpStat(n, 'best', left);
      pending = (n >= STAGES.length) ? 'finale' : ('s' + n);
      if (D.cutscene && !D.cutscene.has(pending)) pending = null;
      selIndex = Math.min(n, STAGES.length - 1);
      paintMenu();
    }
    dom.resultContinue.hidden = !pending;
    dom.resultReplay.hidden = !!pending;
    dom.resultMenu.hidden = !!pending;
    state.pending = pending;

    dom.resultStats.innerHTML = '';
    [[won ? 'TIME REMAINING' : 'TIME ELAPSED', mmss(won ? left : spent)],
     ['MODULES SOLVED', state.solved + ' / ' + state.instances.length],
     ['STRIKES', state.strikes + ' / 3']
    ].forEach(function (r) {
      var row = el('div', 'row', dom.resultStats);
      el('span', 'k', row).textContent = r[0];
      el('span', 'v', row).textContent = r[1];
    });
    dom.resultSeed.textContent = 'seed ' + state.seed + ' · ' +
      state.config.difficulty + ' · ' + state.ctx.serial;

    show('result');
  }

  function mmss(t) {
    var m = Math.floor(t / 60), s = t % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function teardown() {
    clearFocus(true);
    dom.bomb.classList.remove('arming', 'arming-zoom');
    armFactor = 1; armTilt = 0; tiltX = 0; tiltY = 0;
    if (dom.bomb) applyBombTransform();
    clearFocus(true);
    if (state) {
      clearInterval(state.timer);
      state.instances.forEach(function (i) {
        if (i.cleanup) { i.cleanup(); i.cleanup = null; }
      });
      state.running = false;
    }
    state = null;
  }

  /* ---------- debug ------------------------------------------------------------ */

  function applyDebug() { document.body.classList.toggle('debug', debug); }

  function toggleDebug() {
    debug = !debug;
    applyDebug();
    if (debug) runSelfTest();
  }

  function runSelfTest() {
    if (!D.selfTest) return;
    var report = D.selfTest(400, 20260831, function (line) { console.log(line); });
    if (report.ok) {
      console.log('%cDEFUSAL self-test passed — ' + report.total + ' rounds',
        'color:#4f9d5d;font-weight:bold');
    } else {
      console.error('DEFUSAL self-test FAILED');
      report.failures.slice(0, 40).forEach(function (f) { console.error('  ' + f); });
    }
    Object.keys(report.modules).forEach(function (id) {
      if (report.modules[id].notes) console.log(id, report.modules[id].notes);
    });
  }

  /* ---------- wiring ------------------------------------------------------------ */

  function q(id) { return document.getElementById(id); }

  D.boot = function () {
    dom = {
      'screen-menu': q('screen-menu'),
      'screen-game': q('screen-game'),
      'screen-result': q('screen-result'),
      bomb: q('bomb'),
      flipper: q('flipper'),
      flash: q('flash'),
      clocks: [],
      resultTitle: q('result-title'),
      resultCause: q('result-cause'),
      resultVoice: q('result-voice'),
      resultContinue: q('result-continue'),
      resultReplay: q('result-replay'),
      resultMenu: q('result-menu'),
      track: q('sel-track'),
      dots: q('sel-dots'),
      select: document.querySelector('.select'),
      prev: q('sel-prev'),
      next: q('sel-next'),
      freeRow: q('free-row'),
      practicePanel: q('practice-panel'),
      practiceStart: q('practice-start'),
      progress: q('progress'),
      armingLine: q('arming-line'),
      resultStats: q('result-stats'),
      resultSeed: q('result-seed'),
      faces: [].map.call(document.querySelectorAll('[data-face]'), function (casing) {
        return {
          casing: casing,
          chassis: casing.querySelector('.chassis'),
          panel: casing.querySelector('.panel'),
          grid: casing.querySelector('.bays'),
          scrim: casing.querySelector('.scrim')
        };
      })
    };

    dom.faceNodes = [].slice.call(document.querySelectorAll('.face'));
    dom.edges = {};
    ['left', 'right', 'top', 'bottom'].forEach(function (side) {
      var e = el('div', 'edge ' + side + (side === 'top' || side === 'bottom' ? ' tb' : ''),
        dom.flipper);
      dom.edges[side] = e;
    });

    dom.faces.forEach(function (f) {
      f.scrim.addEventListener('click', function () { clearFocus(); });
    });

    buildSelect();
    paintMenu();
    D.showMenu = function () { paintMenu(); show('menu'); };

    /* the opening hands the player a device rather than a menu */
    D.startFirstDevice = function () {
      paintMenu();
      if (cleared() > 0) { show('menu'); return; }
      var st = STAGES[0];
      start({ difficulty: st.rule, count: st.count, seconds: st.seconds, stage: 1 });
    };

    dom.prev.addEventListener('click', function () {
      D.audio.click(); gotoPage(selIndex - 1);
    });
    dom.next.addEventListener('click', function () {
      D.audio.click(); gotoPage(selIndex + 1);
    });

    q('replay-intro').addEventListener('click', function () {
      D.audio.click();
      if (D.cutscene) D.cutscene.play();
    });
    q('reset-progress').addEventListener('click', function () {
      D.audio.click();
      setCleared(0);
      saveStats({});        /* the per-device record, or BEST and TRIES
                               survive the reset on every device played */
      paintMenu();
    });

    [].forEach.call(document.querySelectorAll('[data-diff]'), function (btn) {
      btn.addEventListener('click', function () {
        var d = btn.getAttribute('data-diff');
        if (d === 'practice') return;      /* sandbox has its own page */
        D.audio.click();
        start({ difficulty: d, count: DIFFICULTIES[d].count,
                seconds: DIFFICULTIES[d].seconds });
      });
    });

    var soundBtn = q('sound');
    function paintSound() {
      soundBtn.textContent = 'SOUND ' + (D.audio.isOn() ? 'ON' : 'OFF');
      soundBtn.classList.toggle('off', !D.audio.isOn());
    }
    paintSound();
    soundBtn.addEventListener('click', function () { D.audio.toggle(); paintSound(); });

    ['pointerdown', 'keydown'].forEach(function (evt) {
      document.addEventListener(evt, function () { D.audio.unlock(); });
    });

    q('practice-start').addEventListener('click', function () {
      var n = D.clamp(parseInt(q('practice-modules').value, 10) || 1, 1, 8);
      var mins = D.clamp(parseInt(q('practice-minutes').value, 10) || 1, 1, 30);
      q('practice-modules').value = n;
      q('practice-minutes').value = mins;
      start({ difficulty: 'practice', count: n, seconds: mins * 60 });
    });

    q('result-continue').addEventListener('click', function () {
      D.audio.click();
      var next = state && state.pending;
      teardown();
      if (next && D.cutscene) D.cutscene.play(next, function () { D.showMenu(); });
      else D.showMenu();
    });
    q('result-replay').addEventListener('click', function () {
      D.audio.click();
      start({ difficulty: state.config.difficulty, count: state.config.count,
              seconds: state.config.seconds, stage: state.config.stage });
    });
    q('result-menu').addEventListener('click', function () {
      D.audio.click(); teardown(); D.showMenu();
    });

    [].forEach.call(document.querySelectorAll('[data-flip]'), function (b) {
      b.addEventListener('click', flip);
    });

    window.addEventListener('resize', fit);
    dom['screen-game'].addEventListener('mousemove', trackCursor);
    dom['screen-game'].addEventListener('mouseleave', function () {
      tiltX = 0; tiltY = 0; applyBombTransform();
    });

    var seedParam = /[?&]seed=(\d+)/.exec(location.search);
    if (seedParam) forcedSeed = Number(seedParam[1]) >>> 0;

    if (/[?&]debug=1(&|$)/.test(location.search)) {
      debug = true;
      applyDebug();
      runSelfTest();
    }
    document.addEventListener('keydown', function (e) {
      if (D.cutscene && D.cutscene.isActive()) return;   /* the opening owns keys */
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        toggleDebug();
      }
      if (!dom['screen-menu'].hidden &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        gotoPage(selIndex + (e.key === 'ArrowRight' ? 1 : -1));
        D.audio.click();
        return;
      }
      if (e.key === 'Escape') {
        if (focused) clearFocus();
        else if (state) { teardown(); show('menu'); }
      }
      var typing = e.target && e.target.tagName === 'INPUT';
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && state && !typing) {
        flip();
      }
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !typing) {
        D.audio.toggle();
        paintSound();
      }
    });

    /* ?page=N opens the selector on a given device, for checking a layout */
    var pageParam = /[?&]page=(\d)/.exec(location.search);
    if (pageParam) { selIndex = Number(pageParam[1]); paintMenu(); }

    var startParam = /[?&]start=(easy|medium|hard|insane)/.exec(location.search);
    if (startParam) {
      var d = startParam[1];
      start({ difficulty: d, count: DIFFICULTIES[d].count,
              seconds: DIFFICULTIES[d].seconds });
      if (/[?&]face=back/.test(location.search)) dom.bomb.classList.add('flipped');
      var focusParam = /[?&]focus=(\d+)/.exec(location.search);
      if (focusParam && state.instances[Number(focusParam[1])]) {
        toggleFocus(state.instances[Number(focusParam[1])]);
      }
      return;
    }

    show('menu');
  };
})(DEFUSAL);
