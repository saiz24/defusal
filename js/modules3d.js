/* ==========================================================================
   DEFUSAL — the 3D views of the modules (Rationality's is in its own file).

   Each one mounts the module's own 2D view hidden in the bay (js/module3d-
   kit.js explains why) and lays a 3D object over it: printed panels for the
   figures, real keys and domes that fire the 2D controls, the 2D text boxes
   set into 3D slots. Layouts are in the canvas's own pixels: 268 x 268 for a
   bay, 580 x 268 for a wide one.
   ========================================================================== */

(function (D) {
  'use strict';

  var M = D.module3d, K = D.module3dKit;
  if (!M || !K) return;

  function attach(id, fn) {
    var def = D.byId && D.byId[id];
    if (!def) return;
    def.mount3d = function (host, inst) {
      var src = K.source(host, def, inst);
      var view = K.stageFor(host, def);
      if (!view) { src.classList.remove('m3d-src'); return; }
      /* the 2D source is live at once; the 3D picture is built a frame or
         two later, one module per frame, under the arming animation */
      M.defer(function () {
        if (!view.canvas.isConnected) return;
        try { fn(view, src, inst, def); view.invalidate(); }
        catch (e) {
          /* a 3D view that fails falls back to the 2D one, which still works */
          if (window.console) console.error('module3d ' + id, e);
          view.destroy(); src.classList.remove('m3d-src');
        }
      });
    };
  }

  var GREY = '#e6dcc6', GO = '#8fc79a';

  /* the ENTER key every typed answer has, firing the 2D button */
  function enter(view, src, x, y, w) {
    return K.key(view, { x: x, y: y, w: w || 110, h: 50, colour: GO, label: 'ENTER',
      target: src.querySelector('.go-btn'), token: 'enter' });
  }

  /* ---- SEQUENCES: five tiles, one missing; two numbers -------------------- */
  attach('sequences', function (view, src) {
    var THREE = M.THREE(), P = M.parts;
    var cells = [].slice.call(src.querySelectorAll('.terms div'));
    var n = cells.length, tw = 84, th = 128, gap = 12;
    var total = n * tw + (n - 1) * gap, x0 = (580 - total) / 2;
    view.at(P.plate(total + 30, th + 28, 8, '#ece5d4', 14), 290, 92, 2);
    cells.forEach(function (c, i) {
      var isGap = c.classList.contains('gap');
      var tile = new THREE.Mesh(new THREE.RoundedBoxGeometry(tw, th, 16, 4, 8), P.toon(isGap ? '#dceaf3' : '#f4f1e8'));
      P.outline(tile, 2.5);
      view.at(tile, x0 + tw / 2 + i * (tw + gap), 92, 12);
      var face = new THREE.Mesh(new THREE.PlaneGeometry(tw - 8, th - 8), new THREE.MeshBasicMaterial({
        map: P.textTexture(c.textContent, { w: 256, h: 390, color: isGap ? '#4180ae' : '#1a2429',
          font: '600 ' + (c.textContent.length > 2 ? 120 : 170) + 'px "Plex Sans Condensed", sans-serif' }),
        transparent: true }));
      face.position.z = 8.2; tile.add(face);
    });
    var inputs = src.querySelectorAll('input');
    K.slot(view, inputs[0], [150, 196, 90, 50]);
    K.slot(view, inputs[1], [254, 196, 90, 50]);
    enter(view, src, 420, 221);
  });

  /* ---- MUTUALLY EXCLUSIVE EVENTS: two cards, one number ------------------- */
  attach('mutex', function (view, src) {
    var THREE = M.THREE(), P = M.parts;
    var svg = src.querySelector('svg.art');
    /* each card its own object, cut from the 2D drawing, dealt at an angle */
    [[14, 7, -0.05, 72], [162, 7, 0.04, 196]].forEach(function (c) {
      var tex = K.svgTexture(svg, { crop: [c[0], c[1], 140, 200], bg: '#fbf8f0' }, function () { view.invalidate(); });
      var w = 112, h = 160;
      var card = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), [
        P.toon('#e8e2d2'), P.toon('#e8e2d2'), P.toon('#e8e2d2'), P.toon('#e8e2d2'),
        new THREE.MeshBasicMaterial({ map: tex }), P.toon('#c9c2b0')]);
      P.outline(card, 2);
      card.rotation.z = c[2];
      view.at(card, c[3], 92, 8);
    });
    K.slot(view, src.querySelector('input'), [40, 196, 96, 50]);
    enter(view, src, 196, 221, 100);
  });

  /* ---- PARALLEL LINES: the figure printed, the eight angles as domes ------ */
  attach('parallel', function (view, src) {
    var svg = src.querySelector('svg.art');
    var rect = [8, 6, 252, 236];
    var map = K.panel(view, svg, rect, { drop: '.hit' });
    var k = rect[2] / 320;
    [].forEach.call(svg.querySelectorAll('g.angle-btn'), function (g) {
      var b = K.shapeBox(g), texts = [].map.call(g.querySelectorAll('text'), function (t) { return t.textContent; });
      var at = map(b.cx, b.cy);
      K.dome(view, { x: at[0], y: at[1], r: b.r * k, colour: texts.length > 1 ? '#cfe6f5' : '#f3efe4',
        label: texts.join('\n'), target: g, token: Number(texts[0]) });
    });
  });

  /* ---- VENN: the diagram printed, the numbers as domes; the expression;
     the empty-set key -------------------------------------------------------- */
  attach('venn', function (view, src) {
    var THREE = M.THREE();
    var svg = src.querySelector('svg.art');
    var rect = [6, 4, 322, 260];
    var map = K.panel(view, svg, rect, { drop: '.hit', paper: '#f7f4ec' });
    var k = rect[2] / 330;
    [].forEach.call(svg.querySelectorAll('g.venn-num'), function (g) {
      var b = K.shapeBox(g), label = g.querySelector('text').textContent;
      var at = map(b.cx, b.cy);
      var d = K.dome(view, { x: at[0], y: at[1], r: b.r * k * 1.05, label: label, target: g, token: Number(label) });
      /* taken: the 2D view marks it; the dome turns green with it */
      d.userData.sync = function () {
        d.userData.dome.material.color.set(g.classList.contains('taken') ? '#4f9d5d' : '#f3efe4');
      };
    });
    K.textPlate(view, src.querySelector('.expr').textContent, [352, 52, 210, 64], { colour: '#dceaf3', px: 78 });
    K.key(view, { x: 457, y: 178, w: 96, h: 64, colour: '#f4f1e8', label: '∅',
      font: '600 250px "Plex Sans", sans-serif', target: src.querySelector('.null-btn'), token: 'null' });
    K.watch(view, svg, { attributes: true, subtree: true, attributeFilter: ['class'] });
  });

  /* ---- TRIANGLES: the triangle and its plate printed; colour keys; D-pad --- */
  attach('triangles', function (view, src, inst) {
    var svg = src.querySelector('svg.art');
    var rect = [6, 4, 568, 264];
    var map = K.panel(view, svg, rect, { drop: '.hit', plate: false, paper: '#eef1f2', lift: 0 });
    var k = rect[2] / 560;
    var hits = svg.querySelectorAll('g.hit');
    var order = inst.puzzle.order, HEX = { red: '#d0574f', green: '#4f9d5d', blue: '#4180ae' };
    var DIRS = ['up', 'down', 'left', 'right'], ARROWS = { up: '▲', down: '▼', left: '◀', right: '▶' };
    [].forEach.call(hits, function (g, i) {
      var b = K.shapeBox(g), at = map(b.cx, b.cy);
      if (i < 3) {
        K.key(view, { x: at[0], y: at[1], w: 56 * k, h: 56 * k, colour: HEX[order[i]], target: g,
          token: order[i], tag: order[i].charAt(0).toUpperCase() });
      } else {
        var dir = DIRS[i - 3];
        K.key(view, { x: at[0], y: at[1], w: 42 * k, h: 42 * k, colour: GREY, label: ARROWS[dir],
          font: '400 260px "Plex Sans", sans-serif', target: g, token: dir });
      }
    });
  });

  /* ---- ANGLES: the figure printed; the colour lamp; PRESS ----------------- */
  attach('angles', function (view, src) {
    var THREE = M.THREE(), P = M.parts;
    var svg = src.querySelector('svg.art');
    K.panel(view, svg, [8, 8, 340, 252]);
    var swatch = src.querySelector('.swatch'), word = src.querySelector('.swatch-word');
    var glass = K.lamp(view, [380, 52, 176, 70], function () { return swatch.style.background || null; });
    /* COLOUR LABELS: the colour's name on the lamp */
    var nameMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
    var name = new THREE.Mesh(new THREE.PlaneGeometry(160, 50), nameMat);
    name.position.z = 4; glass.add(name);
    var shown = '';
    K.track(view).extra.push(function () {
      var cb = document.body.classList.contains('cb');
      name.visible = cb;
      var w = word ? word.textContent : '';
      if (cb && w !== shown) {
        shown = w;
        if (nameMat.map) nameMat.map.dispose();
        nameMat.map = P.textTexture(w, { w: 512, h: 160, color: '#ffffff', font: '700 110px "Plex Sans Condensed", sans-serif' });
        nameMat.needsUpdate = true;
      }
    });
    K.key(view, { x: 468, y: 190, w: 132, h: 60, colour: '#e2d7bf', label: 'PRESS',
      target: src.querySelector('.press-btn'), token: 'press' });
    K.watch(view, swatch);
  });

  /* ---- UNIT CONVERSIONS: three lamps; the panes printed; the answer -------- */
  attach('units', function (view, src) {
    var THREE = M.THREE(), P = M.parts;
    var lamps = src.querySelectorAll('.uc-lamps i');
    [].forEach.call(lamps, function (l, i) {
      var on = l.classList.contains('on');
      K.lamp(view, [16, 52 + i * 66, 30, 30], function () { return on ? '#6fd7e8' : null; });
    });
    var panes = [].slice.call(src.querySelectorAll('.uc-pane'));
    /* the panes keep their 2D proportions, stacked to fill the height */
    var sizes = panes.map(function (pn) {
      var s = pn.querySelector('svg');
      if (s) { var vb = s.getAttribute('viewBox').split(/[\s,]+/).map(Number); return vb[3] / vb[2]; }
      return null;
    });
    var x = 70, w = 360, gap = 10;
    var known = sizes.filter(function (s) { return s; });
    var fill = known.length ? known.reduce(function (a, b) { return a + b; }) / known.length : 0.3;
    var hs = sizes.map(function (s) { return (s || fill) * w; });
    var scale = Math.min(1, (268 - 16 - gap) / (hs[0] + hs[1]));
    w *= scale; hs = hs.map(function (h) { return h * scale; });
    var y = (268 - hs[0] - hs[1] - gap) / 2;
    panes.forEach(function (pn, i) {
      var s = pn.querySelector('svg'), r = [x + (360 - w) / 2, y, w, hs[i]];
      if (s) K.panel(view, s, r, { paper: '#e9eef0', scale: 4 });
      else view.at(P.plate(r[2], r[3], 6, '#8d959a', 8), r[0] + r[2] / 2, r[1] + r[3] / 2, 2);
      y += hs[i] + gap;
    });
    K.slot(view, src.querySelector('input'), [452, 92, 112, 50]);
    enter(view, src, 508, 180);
  });
})(DEFUSAL);
