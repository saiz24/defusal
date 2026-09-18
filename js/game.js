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
  var viewScale = 1, wide = false;     /* the defuser's own zoom-out */
  var armFactor = 1, armTilt = 0;      /* the arming pull-back */
  var focusBoost = 1;                  /* touch only: fill the screen on focus */
  var focusShiftY = 0;                 /* ...and re-centre it while we are there */

  function applyBombTransform() {
    dom.bomb.style.transform =
      'translate(-50%, calc(-50% + ' + focusShiftY.toFixed(1) + 'px)) scale(' +
        (scaleNow * armFactor * viewScale * focusBoost).toFixed(4) + ')' +
      ' rotateX(' + (tiltX + armTilt).toFixed(2) + 'deg)' +
      ' rotateY(' + tiltY.toFixed(2) + 'deg)';
  }

  /* The case is fitted to the PANE it is in, not to the window. In Solo the
     deck is half the screen, and a case sized to the whole of it simply ran
     off the side of its own half. Hidden elements report no size, so the
     window is the fallback. */
  function paneBox() {
    var node = dom['screen-game'];
    var w = (node && node.clientWidth) || window.innerWidth || 1280;
    var h = (node && node.clientHeight) || window.innerHeight || 720;
    return { w: w, h: h };
  }

  function fit() {
    /* On a desktop the case used to run edge to edge, so there was no room
       around it and the device read as a screen rather than as an object on a
       table. A margin costs a few per cent of size and buys the whole of it.
       Small viewports keep the old tight fit — there, legibility wins. */
    var box = paneBox();
    var pad = box.w >= 1100 ? 108 : 24;
    scaleNow = Math.min((box.w - pad) / (BOMB_W || 1724),
                        (box.h - pad) / (BOMB_H || 938));
    applyBombTransform();
  }

  /* A finger, not a mouse. Everything below that changes for touch is gated on
     this rather than on width: a small window on a laptop still has a cursor,
     and a large tablet still has a finger. */
  function coarse() {
    try {
      return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { return false; }
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
    /* A shallower lean. Rotating the case changes the on-screen scale of
       every layer in it, and each change costs a re-rasterise of the text and
       artwork inside — a smaller sweep is materially cheaper and still reads
       as the case sitting in a room. */
    pendingTilt = [D.clamp(nx * 5.5, -5.5, 5.5), D.clamp(-ny * 3.6, -3.6, 3.6)];
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

  /* ---------- signage and hardware ----------------------------------------
     The faces stay quiet — the modules have to be read — so everything that
     says "this is a bomb" lives on the rails, where nothing is ever solved.
     All of it is static: one paint at build time, no per-frame work. */

  var chevUid = 0;

  /* a hazard bar: diagonal stripes clipped to a rounded plate */
  function hazardBar(svg, x, y, w, h) {
    var S = D.svg, g = S.el('g', {}, svg), step = 30, i;
    var id = 'chev' + (++chevUid);
    var cp = S.el('clipPath', { id: id }, g);
    S.el('rect', { x: x, y: y, width: w, height: h, rx: 6 }, cp);
    S.el('rect', { x: x, y: y, width: w, height: h, rx: 6, fill: '#d9b03c' }, g);
    var band = S.el('g', { 'clip-path': 'url(#' + id + ')' }, g);
    for (i = -h - step; i < w + step; i += step) {
      S.el('path', { d: 'M' + (x + i) + ' ' + (y + h) +
        ' L' + (x + i + h) + ' ' + y +
        ' L' + (x + i + h + step / 2) + ' ' + y +
        ' L' + (x + i + step / 2) + ' ' + (y + h) + ' Z',
        fill: '#2b3136' }, band);
    }
    S.el('rect', { x: x, y: y, width: w, height: h, rx: 6, fill: 'none',
      stroke: INK, 'stroke-width': 3.5 }, g);
  }

  /* an armed pilot lamp in a bezel. The pulse is opacity on one small node. */
  function pilotLamp(svg, x, y, color) {
    var S = D.svg, g = S.el('g', {}, svg);
    S.el('circle', { cx: x, cy: y, r: 17, fill: '#28343a', stroke: INK,
      'stroke-width': 3.5 }, g);
    S.el('circle', { cx: x, cy: y, r: 10, fill: color }, g);
    S.el('circle', { cx: x - 3, cy: y - 4, r: 3.4,
      fill: 'rgba(255,255,255,.55)' }, g);
    var halo = S.el('circle', { cx: x, cy: y, r: 10, fill: color,
      opacity: 0.55 }, g);
    halo.setAttribute('class', 'pilot-halo');
    return g;
  }

  /* a strapped charge cell — the same object the back rail carries, one of */
  function chargeCell(svg, x, y, w, h) {
    var S = D.svg, g = S.el('g', {}, svg);
    S.el('rect', { x: x, y: y, width: w, height: h, rx: h * 0.34,
      fill: '#a94a3f', stroke: INK, 'stroke-width': 4 }, g);
    S.el('rect', { x: x + 10, y: y + 8, width: w - 20, height: 8, rx: 4,
      fill: '#c26254' }, g);
    [0.32, 0.68].forEach(function (f) {
      S.el('rect', { x: x + w * f - 9, y: y - 3, width: 18, height: h + 6,
        fill: '#e8ddc4', stroke: INK, 'stroke-width': 3 }, g);
    });
  }

  /* wear: a handful of faint scratches so the shell is not factory-new */
  function scuffs(svg, seed) {
    var S = D.svg, rng = D.makeRng(seed >>> 0), i, x, y, len, ang;
    for (i = 0; i < 14; i++) {
      x = D.rint(rng, 40, BOMB_W - 40);
      y = rng() < 0.5 ? D.rint(rng, 46, RAIL_TOP - 20)
                      : D.rint(rng, BOMB_H - RAIL_BOT + 16, BOMB_H - 26);
      len = D.rint(rng, 14, 54);
      ang = (rng() * 0.5 - 0.25);
      S.el('line', { x1: x, y1: y, x2: x + len, y2: y + len * ang,
        stroke: 'rgba(255,255,255,.055)', 'stroke-width': 2,
        'stroke-linecap': 'round' }, svg);
    }
  }

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

    /* --- everything below is signage and hardware on the rails only ------
       The control strip is centred and about 680 wide, so the flanks start
       where it ends. On the narrowest case that is a short run; the pieces
       are placed from the outside in so they simply have less room, never
       overlap the clock. */
    var half = BOMB_W / 2, flank = Math.max(0, half - 360);
    var botY = BOMB_H - RAIL_BOT + 34;

    [-1, 1].forEach(function (side) {
      var edge = side < 0 ? 26 : BOMB_W - 26;
      var inner = half + side * 352;
      var mid = half + side * (352 + flank / 2);   /* middle of this flank */

      if (flank > 70) {
        var bw = Math.min(150, flank - 26), bx = mid - bw / 2, by = 96;
        var xOut = side < 0 ? bx + 10 : bx + bw - 10;
        var xEdge = side < 0 ? -10 : BOMB_W + 10;

        /* The loom is laid down FIRST so the block is bolted on top of it.
           Drawn afterwards the wires painted over the stencil on the plate,
           and a cable crossing a label is the wrong way round anyway: the
           wires run under the hardware, not over it.

           Three leads, not four, at uneven sag — a loom is a bundle routed by
           hand, not a rainbow. Every end is hidden: these run off the side of
           the case, where the SVG viewport clips them, because a wire that
           stops in open air reads as a broken line rather than as wiring. */
        [0, 1, 2].forEach(function (k) {
          var y0 = by + 52 - k * 7;
          var y1 = by + 74 + k * 17;
          cable(svg, 'M' + xOut + ' ' + y0 +
            ' C' + (xOut + side * 48) + ' ' + (y0 + 28) + ' ' +
            (xOut + side * 96) + ' ' + y1 + ' ' + xEdge + ' ' + y1,
            WIRE[k], 4.5);
        });
        /* and one lead inward, ending under the control strip, so the panel
           is plainly wired to the rest of the case. It has to finish well
           inside the strip rather than at the edge of where the strip is
           guessed to be: the strip is content-sized, and an end laid against
           its border showed as a hook in open air. The narrowest case still
           puts the strip's edge about 350 out from the middle, so 180 is
           always underneath it. */
        var xIn = side < 0 ? bx + bw - 10 : bx + 10;
        cable(svg, 'M' + xIn + ' ' + (by + 56) +
          ' C' + (xIn - side * 40) + ' ' + (by + 96) + ' ' +
          (half + side * 260) + ' ' + (by + 60) + ' ' +
          (half + side * 180) + ' ' + (by + 20), WIRE[3], 4.5);

        /* A relay block with its lamp, bolted to the top rail. The lamp needs
           something to be mounted on or it reads as a floating dot. */
        S.el('rect', { x: bx, y: by, width: bw, height: 62, rx: 12,
          fill: '#3a474e', stroke: INK, 'stroke-width': 4 }, svg);
        S.el('rect', { x: bx + 8, y: by + 7, width: bw - 16, height: 7, rx: 4,
          fill: 'rgba(255,255,255,.14)' }, svg);
        bolt(svg, bx + 14, by + 48, 6);
        bolt(svg, bx + bw - 14, by + 48, 6);
        pilotLamp(svg, bx + 30, by + 28, side < 0 ? '#d0574f' : '#ffc861');
        /* The plate used to carry a stencilled ARMED / LIVE. Nothing on the
           case is ever read by a module, so lettering here is decoration that
           competes with the only text that matters — the clock, the serial and
           the modules. The lamp says the same thing without words. */
        S.el('rect', { x: bx + 56, y: by + 20, width: Math.max(0, bw - 76),
          height: 16, rx: 5, fill: '#2b3439', stroke: INK,
          'stroke-width': 2.5 }, svg);
      }

      /* the bottom rail: one hazard bar per flank */
      if (flank > 110) {
        var hw = Math.min(flank + 40, half - 150);
        /* The rail's lowest band carries the case bevel and swallows anything
           drawn into it, so the bar sits in its upper half. */
        var hx = side < 0 ? 34 : BOMB_W - 34 - hw;
        hazardBar(svg, hx, botY + 22, hw, 28);
      }
    });

    scuffs(svg, BOMB_W * 7919 + BOMB_H);
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
      if (leaving.abort) return;
      leaving.abort = true;

      /* stop the clock at once, then let the case go dark before the menu */
      if (state) {
        state.running = false;
        clearInterval(state.timer);
        stopArming();            /* before the fade, not after it */
      }
      D.audio.click();
      D.audio.stopBeeps();
      D.audio.powerdown();
      dom['screen-game'].classList.add('aborting');

      /* `aborting` is deliberately left on: it is cleared when the screen is
         next shown. Removing it here dropped the fade's forwards fill, so
         the case flashed back to full brightness on its way out. */
      var done = function () {
        leaving.abort = false;
        teardown();
        D.showMenu();
      };
      if (reducedMotion()) done(); else setTimeout(done, 620);
    });

    if (faceIndex === 0) {
      lcd.id = 'timer'; strikes.id = 'strikes';
      serial.id = 'serial'; count.id = 'modcount';
    }
    dom.clocks.push({ lcd: lcd, digits: digits, fuse: fuse, fill: fill,
                      strikes: strikes, count: count });
  }

  /* The reverse has no clock: turning the case over costs you sight of it.
     It carries the serial and nothing else — the serial is read by modules,
     so it is the one piece of lettering on the shell that earns its place. */
  function buildBackPlate(host) {
    host.innerHTML = '';
    var strip = el('div', 'strip plate-only', host);
    var mark = el('div', 'stamp', strip);
    mark.textContent = state.ctx.serial;
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

  /* The result screen used to carry a line of its own above the statistics,
     one of four each way. It is gone: after a round the player wants the
     verdict and the numbers, and a sentence of narration between the two put
     the story in the way of the scoreboard. The devices still speak while a
     case arms, which is where the voice belongs. */
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

  /* ---------- round codes --------------------------------------------------
     Every round is a seed plus the shape of the device it was dealt into, and
     both have to travel together: a seed alone reproduces nothing, because the
     same seed poured into a three-module device and an eight-module one deals
     two different bombs. One short string carries both, the result screen
     prints it, and typing it back arms the identical device.

       S3-K7A2XQ     device 3, that seed
       F4M8-K7A2XQ   a sandbox device: 4 modules, 8 minutes, that seed
       DH-K7A2XQ     a free device at PATHOLOGICAL, that seed

     A round entered as a code never counts towards progress — otherwise the
     last device could be cleared by typing somebody else's code for it. */

  var DIFF_LETTER = { easy: 'E', medium: 'M', hard: 'H', insane: 'I' };
  var LETTER_DIFF = { E: 'easy', M: 'medium', H: 'hard', I: 'insane' };

  function makeCode(config, seed) {
    var tail = (seed >>> 0).toString(36).toUpperCase();
    if (config.stage) return 'S' + config.stage + '-' + tail;
    if (config.difficulty === 'practice') {
      return 'F' + config.count + 'M' + Math.round(config.seconds / 60) +
             '-' + tail;
    }
    return 'D' + (DIFF_LETTER[config.difficulty] || 'E') + '-' + tail;
  }

  function seedOf(text) {
    var n = parseInt(text, 36);
    return (isFinite(n) && n >= 0) ? (n >>> 0) : null;
  }

  function parseCode(raw) {
    var t = String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    var m, seed;

    if ((m = /^S([1-5])-([0-9A-Z]{1,7})$/.exec(t))) {
      seed = seedOf(m[2]);
      if (seed === null) return null;
      var st = STAGES[Number(m[1]) - 1];
      return { difficulty: st.rule, count: st.count, seconds: st.seconds,
               stage: Number(m[1]), seed: seed, noRecord: true };
    }
    if ((m = /^F([1-8])M([0-9]{1,2})-([0-9A-Z]{1,7})$/.exec(t))) {
      seed = seedOf(m[3]);
      if (seed === null) return null;
      var mins = D.clamp(Number(m[2]), 1, 30);
      return { difficulty: 'practice', count: Number(m[1]),
               seconds: mins * 60, seed: seed, noRecord: true };
    }
    if ((m = /^D([EMHI])-([0-9A-Z]{1,7})$/.exec(t))) {
      seed = seedOf(m[2]);
      if (seed === null) return null;
      var d = LETTER_DIFF[m[1]];
      return { difficulty: d, count: DIFFICULTIES[d].count,
               seconds: DIFFICULTIES[d].seconds, seed: seed, noRecord: true };
    }
    return null;
  }

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

  /* The premise used to be drawn either side of the selector — a device on one
     side, the rules on the other. It never had a line of CSS, so both halves
     collapsed to nothing and all they did was add two flex gaps to a centred
     row, which is what put the carousel 16px left of the middle of the screen.
     The mode screen draws the same idea properly, at a size somebody can see.
     ------------------------------------------------------------------------ */

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
      go.addEventListener('click', function (e) {
        if (go.disabled) return;
        D.audio.click();
        /* the device's own colour, taken right down: a full screen of raw
           accent is a flashbulb, a deep wash of it is the device arriving */
        cutTo(e, D.shade(ACCENT[i], -0.76), function () {
          start({ difficulty: st.rule, count: st.count, seconds: st.seconds,
                  stage: i + 1 });
        });
      });
      c.style.setProperty('--accent', ACCENT[i]);
      pages.push({ el: c, kind: 'stage', i: i, go: go, accent: ACCENT[i],
                   fMod: fMod, fTime: fTime, fBest: fBest, fTry: fTry });
    });

    var sc = card(dom.track);
    el('div', 'idx', sc).textContent = 'FREE';
    el('div', 'nm', sc).textContent = 'SANDBOX';
    sc.appendChild(dom.practicePanel);
    dom.practicePanel.hidden = false;
    pages.push({ el: sc, kind: 'sandbox', need: 1 });

    /* OPEN PLAY is gone. A row of difficulties dealt a new random device
       every time and there was no way back to one you had just played — the
       one thing a player asks for after a round they want to show somebody.
       This page takes the code the result screen printed and arms that exact
       device again. */
    var fc = card(dom.track);
    el('div', 'idx', fc).textContent = 'FREE';
    el('div', 'nm', fc).textContent = 'SEED';
    fc.appendChild(dom.seedPanel);
    dom.seedPanel.hidden = false;
    /* Never locked. A code reproduces a device and records nothing, and the
       first thing a player wants a code for is the round they just lost. */
    pages.push({ el: fc, kind: 'seed', need: 0 });

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

    var pg = pages[selIndex];

    /* each device brings its own weather with it */
    if (D.backdrop && D.backdrop.sky) {
      D.backdrop.sky(pg && pg.kind === 'stage' ? pg.i : -1);
    }

    /* ...and its own light. The title is a lit readout, and what lights it is
       whichever device you are looking at: cool at TRIVIAL, hot at
       INTRACTABLE. Setting it on the screen means the title, the dots and
       anything else that asks for --accent all change together. */
    var accent = (pg && pg.kind === 'stage') ? ACCENT[pg.i] : '#6fd7e8';
    dom['screen-menu'].style.setProperty('--accent', accent);
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
      if (pg.kind === 'seed') {
        dom.seedStart.disabled = locked;
        dom.seedCode.disabled = locked;
      }
    });

    dom.progress.textContent = (done >= STAGES.length)
      ? 'ALL ' + STAGES.length + ' ANSWERED'
      : 'DEVICE ' + (done + 1) + ' / ' + STAGES.length;

    /* the MODE key says what the mode IS, so it is a statement of the current
       state rather than a button whose meaning you have to remember */
    if (dom.modeNow) {
      var meta = D.mode.META[D.mode.get()];
      dom.modeNow.textContent = meta.label +
        (D.mode.is('twodevice')
          ? ' \u00b7 ' + (D.mode.getRole() === 'manual' ? 'MANUAL' : 'DEVICE')
          : '');
    }
    if (dom.setProgress) {
      dom.setProgress.textContent = done + ' / ' + STAGES.length;
    }
    gotoPage(selIndex);
  }

  /* ---------- the mode screen ---------------------------------------------
     The first thing the opening hands over, and the only place the mode is
     chosen. It is a carousel: three keys along the bottom, and above them a
     panel big enough to show what the mode actually looks like once a device
     is armed. "Two devices" and "solo" are shapes, not sentences, and a
     player picks a shape far better from a picture of it than from a blurb.
     ------------------------------------------------------------------------ */

  var MODE_ORDER = ['printed', 'twodevice', 'solo'];
  var modeIndex = 0, modeAfter = null, modePanels = [], modeKeys = [];

  /* --- the previews, drawn the way everything else in the game is drawn ---
     No captions on them. A picture of two screens with one showing a grid and
     the other showing lines of rules does not need to be told to anybody in
     words underneath it. --------------------------------------------------- */

  function pv(parent, tag, attrs) {
    attrs = attrs || {};
    attrs.fill = attrs.fill || 'none';
    attrs.stroke = attrs.stroke || 'currentColor';
    attrs['stroke-width'] = attrs['stroke-width'] || 2.4;
    attrs['stroke-linejoin'] = 'round';
    attrs['stroke-linecap'] = 'round';
    return D.svg.el(tag, attrs, parent);
  }

  /* a device face: the clock strip and a few module bays */
  function pvDevice(svg, x, y, w, h, cols, rows) {
    var g = D.svg.el('g', {}, svg);
    pv(g, 'rect', { x: x, y: y, width: w, height: h, rx: 10, 'stroke-width': 3,
      fill: 'rgba(111,215,232,.05)' });
    var strip = 22;
    pv(g, 'rect', { x: x + 9, y: y + 8, width: w - 18, height: strip, rx: 5,
      'stroke-width': 2, fill: 'rgba(255,200,97,.14)', stroke: '#ffc861' });
    D.svg.el('rect', { x: x + 16, y: y + 14, width: 34, height: 10, rx: 3,
      fill: '#ffc861', opacity: .75 }, g);
    var pad = 9, top = y + strip + 16;
    var cw = (w - pad * (cols + 1)) / cols;
    var ch = (h - strip - 16 - pad * (rows + 1) - 2) / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        pv(g, 'rect', { x: x + pad + c * (cw + pad), y: top + r * (ch + pad),
          width: cw, height: ch, rx: 6, 'stroke-width': 2,
          fill: 'rgba(236,239,240,.10)' });
      }
    }
    return g;
  }

  /* a page of rules: a run of text lines, no picture anywhere on it */
  function pvPage(svg, x, y, w, h, lines) {
    var g = D.svg.el('g', {}, svg);
    pv(g, 'rect', { x: x, y: y, width: w, height: h, rx: 6, 'stroke-width': 3,
      fill: 'rgba(216,192,122,.05)', stroke: '#d8c07a' });
    var i, gap = (h - 34) / lines;
    D.svg.el('rect', { x: x + 14, y: y + 14, width: Math.min(w - 28, 64),
      height: 7, rx: 3, fill: '#d8c07a', opacity: .8 }, g);
    for (i = 0; i < lines; i++) {
      var lw = (w - 28) * (i % 3 === 2 ? 0.62 : 0.92);
      D.svg.el('rect', { x: x + 14, y: y + 30 + i * gap, width: lw, height: 4,
        rx: 2, fill: '#d8c07a', opacity: .34 }, g);
    }
    return g;
  }

  function pvGap(svg, x, y0, y1) {
    D.svg.el('line', { x1: x, y1: y0, x2: x, y2: y1, stroke: 'currentColor',
      'stroke-width': 2, 'stroke-dasharray': '3 12', opacity: .5 }, svg);
  }

  var MODE_ART = {
    printed: function () {
      var svg = D.svg.root(0, 36, 640, 226, 'mode-art');
      pvDevice(svg, 44, 54, 240, 186, 3, 2);
      pvGap(svg, 320, 52, 268);
      pvPage(svg, 356, 60, 118, 174, 7);
      pvPage(svg, 478, 60, 118, 174, 7);
      return svg;
    },
    twodevice: function () {
      var svg = D.svg.root(0, 36, 640, 226, 'mode-art');
      pvDevice(svg, 52, 50, 228, 194, 3, 2);
      pvGap(svg, 320, 48, 268);
      pv(svg, 'rect', { x: 360, y: 50, width: 228, height: 194, rx: 10,
        'stroke-width': 3, fill: 'rgba(216,192,122,.05)', stroke: '#d8c07a' });
      pvPage(svg, 374, 64, 200, 166, 8);
      return svg;
    },
    solo: function () {
      var svg = D.svg.root(0, 36, 640, 226, 'mode-art');
      pv(svg, 'rect', { x: 56, y: 44, width: 528, height: 206, rx: 12,
        'stroke-width': 3, fill: 'rgba(111,215,232,.04)' });
      pvDevice(svg, 70, 58, 244, 178, 2, 2);
      D.svg.el('line', { x1: 320, y1: 58, x2: 320, y2: 236,
        stroke: 'currentColor', 'stroke-width': 3, opacity: .75 }, svg);
      pvPage(svg, 326, 58, 244, 178, 8);
      return svg;
    }
  };

  function buildModeScreen() {
    if (!dom.modeTrack) return;
    dom.modeTrack.innerHTML = '';
    dom.modeRow.innerHTML = '';
    modePanels = []; modeKeys = [];

    MODE_ORDER.forEach(function (id, i) {
      var meta = D.mode.META[id];

      var panel = el('div', 'mode-panel', dom.modeTrack);
      var art = el('div', 'mode-art-wrap', panel);
      art.appendChild(MODE_ART[id]());
      modePanels.push(panel);

      var key = el('button', 'key mode-key', dom.modeRow);
      key.type = 'button';
      el('b', '', key).textContent = meta.label;
      el('i', '', key).textContent = meta.players;
      key.addEventListener('click', function () {
        D.audio.click();
        gotoMode(i);
      });
      modeKeys.push(key);
    });

    dom.modeConfirm.addEventListener('click', function (e) { confirmMode(e); });
    dom.modeBack.addEventListener('click', function (e) {
      D.audio.click();
      modeAfter = null;
      D.showMenu(e);
    });

    modeIndex = Math.max(0, MODE_ORDER.indexOf(D.mode.get()));
    gotoMode(modeIndex);
  }

  /* the options that only one mode has: who this screen is, and which way a
     Solo split runs */
  function paintModeOpts() {
    var id = MODE_ORDER[modeIndex];
    dom.modeOpts.innerHTML = '';

    /* A segmented control: two fixed cells with one lit pill that SLIDES
       between them. The old version rebuilt both buttons on every press and
       re-flowed everything under them to match the new label widths, which is
       why choosing what this screen is looked like the page breaking. Nothing
       reflows now — the cells never change size and only a transform moves. */
    function group(items, read, write) {
      var row = el('div', 'mode-opt', dom.modeOpts);
      var seg = el('div', 'seg', row);
      seg.style.setProperty('--n', items.length);
      var pill = el('i', 'seg-pill', seg);
      var btns = [];

      function paint() {
        var at = 0;
        items.forEach(function (it, k) { if (read() === it.value) at = k; });
        pill.style.transform = 'translateX(' + (at * 100) + '%)';
        btns.forEach(function (b, k) { b.classList.toggle('on', k === at); });
      }

      items.forEach(function (it) {
        var b = el('button', 'seg-btn', seg);
        b.type = 'button';
        b.textContent = it.label;
        b.addEventListener('click', function () {
          if (read() === it.value) return;
          D.audio.click();
          write(it.value);
          paint();
          paintModeConfirm();
        });
        btns.push(b);
      });
      paint();
    }

    if (id === 'twodevice') {
      dom.modeOpts.hidden = false;
      group([
        { value: 'bomb', label: 'DEVICE' },
        { value: 'manual', label: 'MANUAL' }
      ], function () { return D.mode.getRole(); },
         function (v) { D.mode.setRole(v); });
    } else if (id === 'solo') {
      dom.modeOpts.hidden = false;
      group([
        { value: 'vertical', label: 'SIDE BY SIDE' },
        { value: 'horizontal', label: 'STACKED' }
      ], function () { return D.mode.getSplit(); },
         function (v) { D.mode.setSplit(v); });
    } else {
      dom.modeOpts.hidden = true;
    }
  }

  function paintModeConfirm() {
    var id = MODE_ORDER[modeIndex];
    var manualScreen = (id === 'twodevice' && D.mode.getRole() === 'manual');
    dom.modeConfirm.querySelector('b').textContent =
      manualScreen ? 'OPEN THE MANUAL' : 'CONTINUE';
  }

  /* Everything under the copy has to travel when the copy changes length or
     a mode grows a row of options — PRINTED has none, TWO DEVICES has two. */
  function modeShifters() {
    return [dom.modeCopy, dom.modeOpts, dom.modeRow, dom.modeGo]
      .filter(Boolean);
  }

  function gotoMode(i) {
    modeIndex = D.clamp(i, 0, MODE_ORDER.length - 1);
    var id = MODE_ORDER[modeIndex];
    D.mode.set(id);
    dom.modeTrack.style.transform = 'translateX(' + (-modeIndex * 100) + '%)';
    modePanels.forEach(function (p, k) { p.classList.toggle('on', k === modeIndex); });
    modeKeys.forEach(function (b, k) { b.classList.toggle('on', k === modeIndex); });

    var change = function () {
      paintModeOpts();
      paintModeConfirm();
    };
    if (D.fx) D.fx.flip(modeShifters(), change, { duration: 460 });
    else change();
  }

  function confirmMode(e) {
    D.audio.click();
    var after = modeAfter;
    modeAfter = null;
    cutTo(e, '#0a1318', function () {
      if (D.mode.is('twodevice') && D.mode.getRole() === 'manual') {
        mountReader();
        show('reader');
        return;
      }
      if (after) after(); else { paintMenu(); show('menu'); }
    });
  }

  function openReader(e) {
    mountReader();
    goTo('reader', e);
  }

  /* ---------- screens --------------------------------------------------------- */

  var SCREENS = ['mode', 'menu', 'settings', 'game', 'result', 'reader'];

  /* How far in each screen is. A move to a higher number goes forward — the
     old screen is pushed left and the new one comes in from the right — and a
     move to a lower one reverses it, so the player can always tell which way
     through the game they just went. The result is not further in, it is an
     interruption, so it drops from above. */
  /* NOT `DEPTH`: that name is already the case's thickness in units, at the
     top of this file, and `var` is function-scoped — redeclaring it turned
     the number into an object, `DEPTH / 2` into NaN, and every face and rim
     transform into an invalid string that was silently dropped. The box lost
     its thickness, the two faces ended up coplanar, and the case z-fought
     with itself. */
  var SCREEN_DEPTH = { mode: 0, menu: 1, reader: 1, settings: 2, game: 2,
                       result: 3 };
  var atScreen = null;

  function show(screen) {
    var from = atScreen === null ? -1 : SCREEN_DEPTH[atScreen];
    var to = SCREEN_DEPTH[screen];
    var back = to < from;
    var drop = (screen === 'result');
    var sink = (atScreen === 'result');
    atScreen = screen;

    SCREENS.forEach(function (name) {
      var node = dom['screen-' + name];
      if (!node) return;
      if (name === screen) {
        if (leaving[name]) { clearTimeout(leaving[name]); leaving[name] = null; }
        node.classList.remove('leaving', 'aborting', 'back', 'drop', 'sink');
        node.hidden = false;
        node.classList.remove('entering');
        void node.offsetWidth;
        if (back) node.classList.add('back');
        if (drop) node.classList.add('drop');
        node.classList.add('entering');
        setTimeout(function () {
          node.classList.remove('entering', 'back', 'drop');
        }, 1600);
      } else if (!node.hidden) {
        node.classList.remove('entering', 'back', 'drop', 'sink');
        if (back) node.classList.add('back');
        if (sink) node.classList.add('sink');
        node.classList.add('leaving');
        if (leaving[name]) clearTimeout(leaving[name]);
        leaving[name] = setTimeout(function () {
          node.classList.remove('leaving', 'back', 'sink');
          node.hidden = true;
          leaving[name] = null;
        }, 260);
      }
    });
    document.body.classList.toggle('playing', screen === 'game');
    document.body.classList.toggle('reading', screen === 'reader');
    if (screen === 'game') fit();
  }

  /* EVERY page change goes through here. The screens used to slide past each
     other, which meant the swap itself was on show — and a swap is the one
     part of a change of screen that has nothing to look at. So the cover is
     the transition: you press, something takes the glass, the page changes
     behind it where nobody can see it happen, and it opens again on the new
     one. The screens themselves now only settle into place underneath. */
  function cutTo(e, color, fn) {
    var x, y;
    if (e && e.clientX !== undefined && (e.clientX || e.clientY)) {
      x = e.clientX; y = e.clientY;
    } else if (e && e.currentTarget && e.currentTarget.getBoundingClientRect) {
      var r = e.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    if (!D.fx) { fn(); return; }
    D.audio.whoosh();
    D.fx.iris({ x: x, y: y, color: color, hold: fn });
  }

  /* Go to a screen behind the cover. `e` is the press that asked for it, so
     the cover opens from the control the player actually touched. */
  function goTo(screen, e, color) {
    if (atScreen === screen) return;
    cutTo(e, color || '#070d11', function () { show(screen); });
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
    if (focusBoost !== 1 || focusShiftY !== 0) {
      focusBoost = 1; focusShiftY = 0;
      if (!silent) springZoom();
      applyBombTransform();
    }
    if (dom.focusClock) dom.focusClock.hidden = true;
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

    /* On a phone the case is scaled to about 0.45, so a focused bay still only
       reaches ~450px and its controls land near 30px — under the 44px both
       Apple and Google publish as the floor. Push the whole case in until the
       focused module fills most of the screen; the scrim hides the rest, so
       there is nothing to see around it anyway. */
    springZoom();
    if (coarse()) {
      var onScreen = w * k * scaleNow;
      var want = paneBox().w * 0.82;
      focusBoost = D.clamp(want / Math.max(1, onScreen), 1, 2.4);
      /* The grid is not centred in the case — the top rail carries the control
         strip and is 90 units deeper than the bottom one — so a bay pushed to
         the grid's centre sits below the middle of the screen and hangs off the
         bottom once it is this large. Lift the case by half that difference. */
      focusShiftY = -((RAIL_TOP - RAIL_BOT) / 2) * scaleNow * focusBoost;
      applyBombTransform();
      if (dom.focusClock) {
        dom.focusClock.hidden = false;
        dom.focusClockCount.textContent =
          state.solved + '/' + state.instances.length;
      }
    }

    D.audio.zoom(true);
  }

  /* Pull the whole case back. The per-module zoom goes the other way; this is
     for seeing all of it at once, which matters on a small screen. */
  /* The case's default transition is 16ms, because the cursor tilt rides on
     the same transform and has to feel immediate. A deliberate zoom wants a
     longer curve, so it borrows one for the length of the move and hands it
     straight back. */
  var zoomTimer = 0;
  function springZoom() {
    if (!dom.bomb || (D.fx && D.fx.reduced())) return;
    dom.bomb.classList.add('zooming');
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(function () {
      dom.bomb.classList.remove('zooming');
    }, 560);
  }

  function toggleWide() {
    clearFocus(true);
    wide = !wide;
    viewScale = wide ? 0.66 : 1;
    if (dom.wideBtn) dom.wideBtn.classList.toggle('on', wide);
    D.audio.zoom(!wide);
    springZoom();
    applyBombTransform();
  }

  function resetWide() {
    wide = false; viewScale = 1;
    if (dom.wideBtn) dom.wideBtn.classList.remove('on');
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
    resetWide();
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

    /* Held so teardown can cancel them, and checked against the round that
       scheduled them. Left running, an abort part way through arming still
       fired the push sound after the player had gone, and the second one
       cleared `arming` on whatever round happened to exist by then — which
       could be the next one, mid-animation. */
    var mine = state;
    state.armTimers = [
      setTimeout(function () {
        if (state !== mine) return;
        dom.bomb.classList.add('arming-zoom');
        armFactor = 1; armTilt = 0;
        applyBombTransform();
        D.audio.push();
      }, PUSH_AT),

      setTimeout(function () {
        if (state !== mine) return;
        dom.bomb.classList.remove('arming', 'arming-zoom');
        dom.faces.forEach(function (f) { f.casing.classList.remove('arming'); });
        state.arming = false;
      }, PUSH_AT + PUSH_MS)
    ];

    lastClock = '';
    applyLayout();
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
      /* Nothing interactive was hit. On a mouse that stays what it has always
         been — the case is scenery and a stray click lands on nothing. On a
         finger it focuses the module instead: unfocused, the lens button is
         about twelve device pixels across, and requiring a player to hit that
         before they can read anything is the single worst thing about this
         game on a phone. */
      if (coarse() && !state.arming) toggleFocus(inst);
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

    /* Touch only: when a module's answer box takes focus the on-screen keyboard
       eats roughly half the screen, and an unfocused bay puts that box at
       about a third of legible size. Pull the module forward first, so the
       browser scrolls something worth looking at into view. */
    body.addEventListener('focusin', function (e) {
      if (!coarse()) return;
      var tag = e.target && e.target.tagName;
      if (tag !== 'INPUT') return;
      if (focused !== inst) toggleFocus(inst);
    });

    def.mount(body, inst);
    /* debug builds only: the headless harness drives real games through this */
    if (debug) bay.__instance = inst;
    state.instances.push(inst);
    return bay;
  }

  function updateCount() {
    var txt = state.solved + '/' + state.instances.length;
    if (dom.focusClockCount) dom.focusClockCount.textContent = txt;
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
    if (ticked && dom.focusClockTime) dom.focusClockTime.textContent = text;
    if (dom.focusClock) dom.focusClock.classList.toggle('urgent', t <= 30);
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

  /* ---------- the manual, beside the device ---------------------------------
     Solo shows the device and the manual at the same time now, in two panes,
     and two-device mode gives the manual a screen of its own. Both are the
     same mounted view (js/manual-view.js), and neither is a link the player
     has to follow: the manual is part of the game.

     The old Solo overlay covered the case and billed the player for the time
     it was open. That made looking something up feel like a penalty rather
     than like consulting a manual, and on a phone it meant the device and the
     rule were never on the glass together. */

  var manualMounted = false, readerMounted = false;

  function mountPlayManual() {
    if (manualMounted || !D.manualView || !dom.playManual) return;
    D.manualView.mount(dom.playManual, { title: 'MANUAL' });
    manualMounted = true;
  }

  function mountReader() {
    if (readerMounted || !D.manualView || !dom.readerHost) return;
    D.manualView.mount(dom.readerHost, { title: 'MATHEMATICKS · MANUAL' });
    readerMounted = true;
  }

  /* Solo only: which panes are on screen, and which way the split runs. */
  function applyLayout() {
    var solo = D.mode && D.mode.is('solo');
    var live = solo && !!state && state.running;
    var wasManual = dom.playManual && !dom.playManual.hidden;
    var wasBomb = dom['screen-game'] && !dom['screen-game'].hidden;
    var pane = D.mode.getPane(), split = D.mode.getSplit();
    var showManual = live && pane !== 'bomb';
    var showBomb = live && pane !== 'manual';

    if (dom.playManual) dom.playManual.hidden = !showManual;
    if (dom.layoutBar) dom.layoutBar.hidden = !live;
    if (dom.splitGrip) dom.splitGrip.hidden = !live || pane !== 'both';

    /* The geometry snaps and the panes fade. Animating `inset` on two
       full-screen panes is layout work on every frame of the move, for the
       whole of both of them, with the case inside one having to be measured
       again as it goes — a fade reads the same and costs a composite. */
    if (D.fx) {
      /* which way a half travels says which half it is: the manual lives on
         the right (or below), so it arrives from there and leaves that way */
      var side = split === 'vertical' ? 'from-right' : 'from-below';
      if (showManual && !wasManual) {
        D.fx.play(dom.playManual, 'fx-slide ' + side, 620);
      }
      if (showBomb && !wasBomb) {
        D.fx.play(dom['screen-game'], 'fx-slide from-left', 620);
      }
      if (live && dom.layoutBar) {
        D.fx.play(dom.layoutBar, 'fx-in', 620);
        if (!dom.splitGrip.hidden) D.fx.play(dom.splitGrip, 'fx-in', 720);
      }
    }

    if (!live) return;
    mountPlayManual();
    if (dom.layBomb) dom.layBomb.classList.toggle('on', pane === 'bomb');
    if (dom.layBoth) dom.layBoth.classList.toggle('on', pane === 'both');
    if (dom.layManual) dom.layManual.classList.toggle('on', pane === 'manual');
    if (dom.layTurn) {
      dom.layTurn.classList.toggle('horizontal', split === 'horizontal');
      dom.layTurn.disabled = (pane !== 'both');
    }
    /* the pane changed shape, so the case has to be measured again */
    clearFocus(true);
    fit();
  }

  function setPane(which) {
    if (D.mode.getPane() === which) return;
    D.audio.click();
    var before = D.mode.getPane();
    D.mode.setPane(which);
    applyLayout();
    /* coming back from a full-screen half, the other one should arrive rather
       than simply be there again */
    if (D.fx && before !== 'both' && which === 'both') {
      var side = D.mode.getSplit() === 'vertical' ? 'from-right' : 'from-below';
      D.fx.play(dom.playManual, 'fx-slide ' + side, 620);
      D.fx.play(dom['screen-game'], 'fx-slide from-left', 620);
    }
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
    applyLayout();               /* the panes go with the round */
    flash(won ? 'safe' : 'boom');
    if (won) D.audio.defused(); else D.audio.exploded();

    var left = Math.max(0, Math.round(state.remaining));
    var spent = Math.max(0, Math.round(state.total - state.remaining));

    dom.resultTitle.textContent = won ? 'DEFUSED' : 'EXPLODED';
    dom.resultTitle.className = 'verdict ' + (won ? 'good' : 'bad');
    dom.resultCause.textContent = won ? 'every module solved' : cause;

    /* clearing a stage moves the story on — unless the round was armed from a
       typed code, which reproduces a device without earning it */
    var pending = null;
    if (won && state.config.stage && !state.config.noRecord) {
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
    var total = state.instances.length;
    var rows = [
      [won ? 'TIME REMAINING' : 'TIME ELAPSED', mmss(won ? left : spent),
        (won ? left : spent), mmss],
      ['MODULES SOLVED', state.solved + ' / ' + total, state.solved,
        function (n) { return n + ' / ' + total; }],
      ['STRIKES', state.strikes + ' / 3', state.strikes,
        function (n) { return n + ' / 3'; }]
    ];
    rows.forEach(function (r, i) {
      var row = el('div', 'row', dom.resultStats);
      el('span', 'k', row).textContent = r[0];
      var v = el('span', 'v', row);
      /* The figures roll up to their value rather than being there already.
         It is one rAF each, for about half a second, and then it stops —
         there is nothing left ticking on the result screen. */
      if (D.fx && r[2] !== undefined) {
        v.textContent = r[3] ? r[3](0) : '0';
        setTimeout(function () {
          D.fx.countUp(v, r[2], { duration: 700, format: r[3] });
        }, 260 + i * 90);
      } else {
        v.textContent = r[1];
      }
    });
    state.code = makeCode(state.config, state.seed);
    dom.resultSeed.textContent = state.code;
    dom.resultDetail.textContent = state.config.difficulty +
      ' \u00b7 ' + state.ctx.serial;
    if (dom.resultCopy) dom.resultCopy.textContent = 'COPY';

    show('result');
  }

  function mmss(t) {
    var m = Math.floor(t / 60), s = t % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* The power-up has its own timers, and they can come due before the abort
     animation has finished — cancelling them only in teardown still let the
     push sound land after the player had gone. */
  function stopArming() {
    if (!state) return;
    (state.armTimers || []).forEach(function (t) { clearTimeout(t); });
    state.armTimers = null;
    state.arming = false;
  }

  function teardown() {
    clearFocus(true);
    dom.bomb.classList.remove('arming', 'arming-zoom');
    armFactor = 1; armTilt = 0; tiltX = 0; tiltY = 0;
    if (dom.bomb) applyBombTransform();
    clearFocus(true);
    if (state) {
      clearInterval(state.timer);
      stopArming();
      state.instances.forEach(function (i) {
        if (i.cleanup) { i.cleanup(); i.cleanup = null; }
      });
      state.running = false;
    }
    state = null;
    applyLayout();
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
      'screen-mode': q('screen-mode'),
      'screen-menu': q('screen-menu'),
      'screen-settings': q('screen-settings'),
      'screen-reader': q('screen-reader'),
      'screen-game': q('screen-game'),
      'screen-result': q('screen-result'),
      bomb: q('bomb'),
      flipper: q('flipper'),
      wideBtn: q('wide-btn'),
      flash: q('flash'),
      clocks: [],
      resultTitle: q('result-title'),
      resultCause: q('result-cause'),
      resultContinue: q('result-continue'),
      resultReplay: q('result-replay'),
      resultMenu: q('result-menu'),
      track: q('sel-track'),
      modeTrack: q('mode-track'),
      modeRow: q('mode-row'),
      modeCopy: q('mode-copy'),
      modeOpts: q('mode-opts'),
      modeConfirm: q('mode-confirm'),
      modeNow: q('mode-now'),
      setProgress: q('set-progress'),
      modeBack: q('mode-back'),
      playManual: q('play-manual'),
      layoutBar: q('layout-bar'),
      layBomb: q('lay-bomb'),
      layBoth: q('lay-both'),
      layManual: q('lay-manual'),
      layTurn: q('lay-turn'),
      readerHost: q('reader-host'),
      splitGrip: q('split-grip'),
      seedPanel: q('seed-panel'),
      seedCode: q('seed-code'),
      seedNote: q('seed-note'),
      seedStart: q('seed-start'),
      resultDetail: q('result-detail'),
      resultCopy: q('result-copy'),
      dots: q('sel-dots'),
      select: document.querySelector('.select'),
      prev: q('sel-prev'),
      next: q('sel-next'),
      practicePanel: q('practice-panel'),
      practiceStart: q('practice-start'),
      progress: q('progress'),
      armingLine: q('arming-line'),
      resultStats: q('result-stats'),
      focusClock: q('focus-clock'),
      focusClockTime: q('focus-clock-time'),
      focusClockCount: q('focus-clock-count'),
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

    /* A screen that was told it is the manual has no menu: the menu is a list
       of devices, and this screen does not carry one. It goes to the manual
       and stays there until somebody changes what this screen is. */
    D.showMenu = function (e) {
      if (D.mode.is('twodevice') && D.mode.getRole() === 'manual') {
        openReader(e);
        return;
      }
      paintMenu();
      goTo('menu', e);
    };

    /* the mode screen, wherever it is reached from */
    D.showModeSelect = function (after, e) {
      modeAfter = after || null;
      dom.modeBack.hidden = !!after;   /* from the opening there is no back */
      modeIndex = Math.max(0, MODE_ORDER.indexOf(D.mode.get()));
      gotoMode(modeIndex);
      goTo('mode', e);
    };

    /* the opening hands the player a device rather than a menu */
    D.startFirstDevice = function () {
      paintMenu();
      if (cleared() > 0) { D.showMenu(); return; }
      var st = STAGES[0];
      start({ difficulty: st.rule, count: st.count, seconds: st.seconds, stage: 1 });
    };

    dom.prev.addEventListener('click', function () {
      D.audio.click(); gotoPage(selIndex - 1);
    });
    dom.next.addEventListener('click', function () {
      D.audio.click(); gotoPage(selIndex + 1);
    });

    /* ?mode=solo&split=horizontal, ?mode=twodevice&role=manual — so a layout
       can be reopened exactly as it was reported, the same way ?seed= reopens
       a bomb. They write through to storage like any other choice. */
    var modeParam = /[?&]mode=(printed|twodevice|solo)/.exec(location.search);
    if (modeParam) D.mode.set(modeParam[1]);
    var roleParam = /[?&]role=(bomb|manual)/.exec(location.search);
    if (roleParam) D.mode.setRole(roleParam[1]);
    var splitParam = /[?&]split=(vertical|horizontal)/.exec(location.search);
    if (splitParam) D.mode.setSplit(splitParam[1]);

    D.mode.apply();
    buildModeScreen();

    q('mode-open').addEventListener('click', function (e) {
      D.audio.click();
      D.showModeSelect(null, e);
    });

    q('settings-open').addEventListener('click', function (e) {
      D.audio.click();
      paintMenu();
      goTo('settings', e);
    });
    q('settings-back').addEventListener('click', function (e) {
      D.audio.click();
      D.showMenu(e);
    });

    q('reader-back').addEventListener('click', function (e) {
      D.audio.click();
      D.showModeSelect(null, e);
    });

    /* the Solo split controls */
    dom.layBomb.addEventListener('click', function () { setPane('bomb'); });
    dom.layBoth.addEventListener('click', function () { setPane('both'); });
    dom.layManual.addEventListener('click', function () { setPane('manual'); });
    dom.layTurn.addEventListener('click', function () {
      D.audio.click();
      D.mode.toggleSplit();
      applyLayout();
    });

    /* Dragging the divider. Pointer events rather than mouse events: the same
       three handlers then cover a finger, a pen and a mouse, and pointer
       capture means a fast drag that leaves the grip behind still tracks. */
    (function () {
      var grip = dom.splitGrip;
      if (!grip) return;
      var dragging = false, raf = 0, want = 0;

      function flush() {
        raf = 0;
        D.mode.setRatio(want);
        fit();
      }

      function at(e) {
        var vertical = D.mode.getSplit() === 'vertical';
        var span = vertical ? (window.innerWidth || 1) : (window.innerHeight || 1);
        var px = vertical ? e.clientX : e.clientY;
        want = (px / span) * 100;
        if (!raf && window.requestAnimationFrame) {
          raf = window.requestAnimationFrame(flush);
        } else if (!window.requestAnimationFrame) {
          flush();
        }
      }

      grip.addEventListener('pointerdown', function (e) {
        if (grip.hidden) return;
        dragging = true;
        grip.classList.add('dragging');
        document.body.classList.add('resizing');
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      grip.addEventListener('pointermove', function (e) {
        if (dragging) { at(e); e.preventDefault(); }
      });
      function end(e) {
        if (!dragging) return;
        dragging = false;
        grip.classList.remove('dragging');
        document.body.classList.remove('resizing');
        try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
        clearFocus(true);
        fit();
      }
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);

      /* back to the middle, the way a split pane always does it */
      grip.addEventListener('dblclick', function () {
        D.audio.click();
        D.mode.resetRatio();
        clearFocus(true);
        fit();
      });

      /* and from the keyboard, since the grip can be tabbed to */
      grip.addEventListener('keydown', function (e) {
        var vertical = D.mode.getSplit() === 'vertical';
        var back = vertical ? 'ArrowLeft' : 'ArrowUp';
        var fwd = vertical ? 'ArrowRight' : 'ArrowDown';
        var step = e.shiftKey ? 10 : 2;
        if (e.key === back) D.mode.setRatio(D.mode.getRatio() - step);
        else if (e.key === fwd) D.mode.setRatio(D.mode.getRatio() + step);
        else if (e.key === 'Home' || e.key === 'Enter') D.mode.resetRatio();
        else return;
        e.preventDefault();
        clearFocus(true);
        fit();
      });
    })();

    /* the seed page: one code in, that exact device out */
    function engageCode(e) {
      var config = parseCode(dom.seedCode.value);
      if (!config) {
        dom.seedNote.hidden = false;
        dom.seedNote.textContent = 'S3-K7A2XQ';
        dom.seedNote.classList.add('bad');
        if (D.fx) D.fx.play(dom.seedPanel, 'fx-shake', 460);
        D.audio.strike();
        dom.seedCode.focus();
        return;
      }
      dom.seedNote.hidden = true;
      dom.seedNote.classList.remove('bad');
      D.audio.click();
      cutTo(e, '#0a1318', function () { start(config); });
    }
    dom.seedStart.addEventListener('click', engageCode);
    dom.seedCode.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); engageCode(); }
    });

    dom.resultCopy.addEventListener('click', function () {
      D.audio.click();
      var code = (state && state.code) || dom.resultSeed.textContent;
      var done = function () { dom.resultCopy.textContent = 'COPIED'; };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done, function () {});
          return;
        }
      } catch (e) {}
      /* file:// and older browsers have no clipboard API — select it instead,
         so one keystroke still takes it */
      try {
        var r = document.createRange();
        r.selectNodeContents(dom.resultSeed);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        dom.resultCopy.textContent = 'SELECTED';
      } catch (e2) {}
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
      if (D.fx) D.fx.play(dom.setProgress, 'fx-flash', 700);
    });

    var soundBtn = q('sound');
    function paintSound() {
      soundBtn.textContent = D.audio.isOn() ? 'ON' : 'OFF';
      soundBtn.classList.toggle('on', D.audio.isOn());
      soundBtn.classList.toggle('off', !D.audio.isOn());
    }
    paintSound();
    soundBtn.addEventListener('click', function () { D.audio.toggle(); paintSound(); });

    ['pointerdown', 'keydown'].forEach(function (evt) {
      document.addEventListener(evt, function () { D.audio.unlock(); });
    });

    q('practice-start').addEventListener('click', function (e) {
      var n = D.clamp(parseInt(q('practice-modules').value, 10) || 1, 1, 8);
      var mins = D.clamp(parseInt(q('practice-minutes').value, 10) || 1, 1, 30);
      q('practice-modules').value = n;
      q('practice-minutes').value = mins;
      cutTo(e, '#0a1318', function () {
        start({ difficulty: 'practice', count: n, seconds: mins * 60 });
      });
    });

    q('result-continue').addEventListener('click', function (e) {
      D.audio.click();
      var next = state && state.pending;
      teardown();
      if (next && D.cutscene) D.cutscene.play(next, function () { D.showMenu(); });
      else D.showMenu(e);
    });
    q('result-replay').addEventListener('click', function (e) {
      D.audio.click();
      var cfg = { difficulty: state.config.difficulty,
                  count: state.config.count, seconds: state.config.seconds,
                  stage: state.config.stage, noRecord: state.config.noRecord };
      cutTo(e, '#0a1318', function () { start(cfg); });
    });
    q('result-menu').addEventListener('click', function (e) {
      D.audio.click(); teardown(); D.showMenu(e);
    });

    [].forEach.call(document.querySelectorAll('[data-flip]'), function (b) {
      b.addEventListener('click', flip);
    });
    [].forEach.call(document.querySelectorAll('[data-wide]'), function (b) {
      b.addEventListener('click', toggleWide);
    });

    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () {
      setTimeout(fit, 120);
    });

    /* The on-screen keyboard does not resize the window on most phones — it
       shrinks the VISUAL viewport and leaves layout alone, so a centred case
       simply ends up underneath it. visualViewport is the only thing that
       reports this. We lift the case by half of whatever the keyboard took,
       which re-centres it in the space that is left. */
    if (window.visualViewport) {
      var vv = window.visualViewport, kbRaf = 0;
      var onViewport = function () {
        if (kbRaf) return;
        kbRaf = requestAnimationFrame(function () {
          kbRaf = 0;
          var taken = Math.max(0, (window.innerHeight || 0) - vv.height);
          var open = taken > 120;      /* smaller than any real keyboard */
          document.body.classList.toggle('kb-open', open);
          document.documentElement.style.setProperty(
            '--kb-lift', open ? (-Math.round(taken / 2) + 'px') : '0px');
        });
      };
      vv.addEventListener('resize', onViewport);
      vv.addEventListener('scroll', onViewport);
    }
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
    /* Debug builds only. tools/run-play.js drives real rounds through this:
       the free-difficulty buttons it used to click are gone with OPEN PLAY,
       and a harness should not have to fake its way through the menu. */
    if (debug) {
      D.startRound = start;
      D.makeCode = makeCode;
      D.parseCode = parseCode;
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
        else if (state) { teardown(); D.showMenu(); }
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

    /* ?modes=1 opens the mode screen directly, for checking its previews */
    if (/[?&]modes=1(&|$)/.test(location.search)) {
      D.showModeSelect(null);
      return;
    }

    D.showMenu();
  };
})(DEFUSAL);
