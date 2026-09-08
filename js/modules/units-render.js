/* ==========================================================================
   UNIT CONVERSIONS — artwork and interaction. Drawing only; the rules live in
   units.js. Instrument scales carry numbers and nothing else, never a unit.

   The bay is square, so the two panels are stacked with the instrument panel
   given twice the height of the object panel, and the ruler is drawn as a
   close-up window around the reading: a fine scale stays countable because
   only ~26 gradations are ever on screen at once.
   ========================================================================== */

(function (D) {
  'use strict';
  var S = D.svg;

  var PW = 430;                 /* panel width, in the wide slot */
  var OBJ_H = 105;              /* both panels are the same height, as the */
  var INS_H = 105;              /* manual describes them */
  var RULER_WINDOW = 26;        /* gradations visible in the ruler close-up */

  var uid = 0;

  /* ---------------- everyday objects ------------------------------------- */
  /* Length objects are drawn to an exact pixel length so they can be laid
     along the ruler; the others are drawn at a fixed size on a baseline. */

  var OUT = '#26313a';

  function shape(g, tag, attrs, fill) {
    attrs.fill = fill || 'none';
    attrs.stroke = OUT;
    attrs['stroke-width'] = attrs['stroke-width'] || 2.4;
    attrs['stroke-linejoin'] = 'round';
    return S.el(tag, attrs, g);
  }
  /* a lighter band along the top of a body reads as a rounded surface */
  function lit(g, x, y, w, h, r, color) {
    S.el('rect', { x: x, y: y, width: w, height: h, rx: r,
      fill: D.shade(color, 0.34), opacity: 0.9 }, g);
  }

  function lengthObject(g, kind, x, y, len) {
    var h, tip, cap;
    switch (kind) {
      case 'pencil':
        h = 17;
        tip = Math.min(16, len * 0.16); cap = Math.min(13, len * 0.13);
        shape(g, 'polygon', { points: x + ',' + y + ' ' + (x + tip) + ',' +
          (y - h / 2) + ' ' + (x + tip) + ',' + (y + h / 2) }, '#e6d2ae');
        shape(g, 'polygon', { points: x + ',' + y + ' ' + (x + tip * 0.34) + ',' +
          (y - h * 0.17) + ' ' + (x + tip * 0.34) + ',' + (y + h * 0.17) }, '#3b3b3b');
        shape(g, 'rect', { x: x + tip, y: y - h / 2,
          width: Math.max(3, len - tip - cap - 7), height: h }, '#e8b53c');
        lit(g, x + tip + 3, y - h / 2 + 3, Math.max(2, len - tip - cap - 13), 4, 2, '#e8b53c');
        shape(g, 'rect', { x: x + len - cap - 7, y: y - h / 2, width: 7,
          height: h }, '#9aa4ab');
        shape(g, 'rect', { x: x + len - cap, y: y - h / 2, width: cap,
          height: h, rx: 3 }, '#d4736a');
        break;

      case 'key':
        shape(g, 'circle', { cx: x + 15, cy: y, r: 14, 'stroke-width': 7 }, 'none');
        S.el('circle', { cx: x + 15, cy: y, r: 14, fill: 'none',
          stroke: '#d8b24a', 'stroke-width': 5 }, g);
        shape(g, 'rect', { x: x + 26, y: y - 5, width: Math.max(6, len - 26),
          height: 10, rx: 2 }, '#d8b24a');
        lit(g, x + 29, y - 3.5, Math.max(3, len - 33), 3, 1.5, '#d8b24a');
        [0, 11, 22].forEach(function (o, k) {
          shape(g, 'rect', { x: x + len - 26 + o, y: y + 5,
            width: 6, height: 7 + k * 3, rx: 1 }, '#d8b24a');
        });
        break;

      case 'screw':
        h = 13;
        shape(g, 'polygon', { points: [[x, y - 15], [x + 15, y - 15],
          [x + 20, y], [x + 15, y + 15], [x, y + 15]].map(function (q) {
            return q[0] + ',' + q[1]; }).join(' ') }, '#93a1aa');
        shape(g, 'rect', { x: x + 18, y: y - h / 2,
          width: Math.max(6, len - 30), height: h }, '#a9b6be');
        for (var t = x + 26; t < x + len - 14; t += 8) {
          S.el('line', { x1: t, y1: y - h / 2, x2: t - 5, y2: y + h / 2,
            stroke: '#6d7b84', 'stroke-width': 2 }, g);
        }
        shape(g, 'polygon', { points: (x + len) + ',' + y + ' ' +
          (x + len - 14) + ',' + (y - h / 2) + ' ' + (x + len - 14) + ',' +
          (y + h / 2) }, '#93a1aa');
        break;

      case 'marker':
        h = 21;
        cap = Math.min(30, len * 0.3);
        shape(g, 'rect', { x: x, y: y - h / 2, width: Math.max(4, len - cap),
          height: h, rx: 4 }, '#f0efe8');
        lit(g, x + 4, y - h / 2 + 3, Math.max(2, len - cap - 8), 5, 2.5, '#f0efe8');
        shape(g, 'rect', { x: x + len - cap, y: y - h / 2 - 2, width: cap,
          height: h + 4, rx: 5 }, '#3f7fae');
        shape(g, 'rect', { x: x + len - cap - 6, y: y - h / 2 - 2, width: 6,
          height: h + 4 }, '#2f6288');
        break;

      default: /* brush */
        h = 12;
        shape(g, 'rect', { x: x, y: y - 9, width: Math.min(26, len * 0.24),
          height: 18, rx: 4 }, '#c2a06a');
        shape(g, 'rect', { x: x + Math.min(26, len * 0.24) - 2, y: y - 7,
          width: 10, height: 14, rx: 2 }, '#9aa4ab');
        shape(g, 'rect', { x: x + Math.min(26, len * 0.24) + 7, y: y - h / 2,
          width: Math.max(4, len - Math.min(26, len * 0.24) - 7), height: h,
          rx: 4 }, '#6d4f34');
        lit(g, x + Math.min(26, len * 0.24) + 10, y - h / 2 + 2.5,
          Math.max(2, len - Math.min(26, len * 0.24) - 14), 3, 1.5, '#6d4f34');
    }
  }

  function standingObject(g, kind, cx, baseY, scale) {
    var k = function (v) { return v * scale; };
    switch (kind) {
      case 'apple':
        shape(g, 'path', { d: 'M' + cx + ' ' + (baseY - k(46)) +
          ' c' + (-k(30)) + ' ' + (-k(16)) + ' ' + (-k(34)) + ' ' + k(30) + ' 0 ' + k(46) +
          ' c' + k(34) + ' ' + (-k(16)) + ' ' + k(30) + ' ' + (-k(62)) + ' 0 ' + (-k(46)) + ' Z',
          'stroke-width': k(3) }, '#c8483c');
        S.el('ellipse', { cx: cx - k(13), cy: baseY - k(34), rx: k(9), ry: k(13),
          fill: '#e88276', opacity: .75,
          transform: 'rotate(-18 ' + (cx - k(13)) + ' ' + (baseY - k(34)) + ')' }, g);
        shape(g, 'path', { d: 'M' + cx + ' ' + (baseY - k(48)) + ' q' + k(3) +
          ' ' + (-k(14)) + ' ' + k(12) + ' ' + (-k(17)), 'stroke-width': k(4) });
        shape(g, 'ellipse', { cx: cx + k(17), cy: baseY - k(62), rx: k(12),
          ry: k(6), transform: 'rotate(-22 ' + (cx + k(17)) + ' ' +
          (baseY - k(62)) + ')' }, '#54a04a');
        break;

      case 'sack':
        shape(g, 'path', { d: 'M' + (cx - k(34)) + ' ' + baseY +
          ' q' + (-k(6)) + ' ' + (-k(46)) + ' ' + k(10) + ' ' + (-k(62)) +
          ' l' + k(48) + ' 0 q' + k(16) + ' ' + k(16) + ' ' + k(10) + ' ' + k(62) + ' Z',
          'stroke-width': k(3) }, '#d8c79a');
        shape(g, 'path', { d: 'M' + (cx - k(24)) + ' ' + (baseY - k(62)) +
          ' q' + k(24) + ' ' + (-k(12)) + ' ' + k(48) + ' 0', 'stroke-width': k(3) });
        shape(g, 'rect', { x: cx - k(22), y: baseY - k(40), width: k(44),
          height: k(20), rx: k(3) }, '#b6743c');
        break;

      case 'can':
        shape(g, 'rect', { x: cx - k(24), y: baseY - k(58), width: k(48),
          height: k(58), rx: k(3), 'stroke-width': k(3) }, '#c3cace');
        lit(g, cx - k(19), baseY - k(52), k(9), k(46), k(4), '#c3cace');
        shape(g, 'rect', { x: cx - k(24), y: baseY - k(44), width: k(48),
          height: k(26) }, '#c04a3c');
        shape(g, 'ellipse', { cx: cx, cy: baseY - k(58), rx: k(24), ry: k(8),
          'stroke-width': k(3) }, '#dde3e6');
        break;

      default: /* book */
        shape(g, 'path', { d: 'M' + (cx - k(42)) + ' ' + (baseY - k(6)) +
          ' l0 ' + (-k(52)) + ' q' + k(42) + ' ' + (-k(12)) + ' ' + k(42) + ' 0' +
          ' q' + k(42) + ' ' + (-k(12)) + ' ' + k(42) + ' 0 l0 ' + k(52) +
          ' q' + (-k(42)) + ' ' + (-k(10)) + ' ' + (-k(42)) + ' 0' +
          ' q' + (-k(42)) + ' ' + (-k(10)) + ' ' + (-k(42)) + ' 0 Z',
          'stroke-width': k(3) }, '#f2efe4');
        shape(g, 'path', { d: 'M' + cx + ' ' + (baseY - k(58)) + ' l0 ' + k(52),
          'stroke-width': k(3) });
        shape(g, 'path', { d: 'M' + (cx - k(46)) + ' ' + (baseY - k(2)) +
          ' q' + k(46) + ' ' + (-k(12)) + ' ' + k(46) + ' 0 q' + k(46) + ' ' +
          (-k(12)) + ' ' + k(46) + ' 0 l0 ' + k(8) + ' q' + (-k(46)) + ' ' +
          (-k(10)) + ' ' + (-k(46)) + ' 0 q' + (-k(46)) + ' ' + (-k(10)) + ' ' +
          (-k(46)) + ' 0 Z', 'stroke-width': k(3) }, '#3f6d9c');
        break;

      case 'bottle':
        shape(g, 'path', { d: 'M' + (cx - k(21)) + ' ' + baseY + ' L' + (cx - k(21)) +
          ' ' + (baseY - k(50)) + ' q0 ' + (-k(14)) + ' ' + k(8) + ' ' + (-k(20)) +
          ' L' + (cx - k(8)) + ' ' + (baseY - k(84)) + ' L' + (cx + k(8)) + ' ' +
          (baseY - k(84)) + ' L' + (cx + k(13)) + ' ' + (baseY - k(70)) + ' q' +
          k(8) + ' ' + k(6) + ' ' + k(8) + ' ' + k(20) + ' L' + (cx + k(21)) +
          ' ' + baseY + ' Z', 'stroke-width': k(3) }, '#4f9ec0');
        S.el('rect', { x: cx - k(15), y: baseY - k(44), width: k(6),
          height: k(34), rx: k(3), fill: '#a8dcee', opacity: .7 }, g);
        shape(g, 'rect', { x: cx - k(23), y: baseY - k(40), width: k(46),
          height: k(22) }, '#f0e6cd');
        shape(g, 'rect', { x: cx - k(10), y: baseY - k(96), width: k(20),
          height: k(13), rx: k(3) }, '#d4643c');
        break;

      case 'mug':
        shape(g, 'path', { d: 'M' + (cx + k(23)) + ' ' + (baseY - k(38)) +
          ' q' + k(22) + ' ' + k(2) + ' 0 ' + k(24), 'stroke-width': k(8) });
        S.el('path', { d: 'M' + (cx + k(23)) + ' ' + (baseY - k(38)) + ' q' +
          k(22) + ' ' + k(2) + ' 0 ' + k(24), fill: 'none', stroke: '#e7ebee',
          'stroke-width': k(5) }, g);
        shape(g, 'path', { d: 'M' + (cx - k(24)) + ' ' + (baseY - k(48)) +
          ' l' + k(4) + ' ' + k(44) + ' q' + k(20) + ' ' + k(6) + ' ' + k(40) + ' 0' +
          ' l' + k(4) + ' ' + (-k(44)) + ' Z', 'stroke-width': k(3) }, '#e7ebee');
        shape(g, 'ellipse', { cx: cx, cy: baseY - k(48), rx: k(24), ry: k(8),
          'stroke-width': k(3) }, '#6b4a30');
        break;

      case 'carton':
        shape(g, 'path', { d: 'M' + (cx - k(23)) + ' ' + baseY + ' l0 ' + (-k(58)) +
          ' l' + k(23) + ' ' + (-k(16)) + ' l' + k(23) + ' ' + k(16) + ' l0 ' +
          k(58) + ' Z', 'stroke-width': k(3) }, '#eae4d2');
        shape(g, 'path', { d: 'M' + (cx - k(23)) + ' ' + (baseY - k(58)) + ' l' +
          k(23) + ' ' + k(10) + ' l' + k(23) + ' ' + (-k(10)),
          'stroke-width': k(2.4) });
        shape(g, 'rect', { x: cx - k(16), y: baseY - k(40), width: k(32),
          height: k(22), rx: k(2) }, '#4f9ec0');
        break;

      case 'jug':
        shape(g, 'path', { d: 'M' + (cx + k(26)) + ' ' + (baseY - k(46)) +
          ' q' + k(20) + ' ' + k(4) + ' 0 ' + k(26), 'stroke-width': k(8) });
        S.el('path', { d: 'M' + (cx + k(26)) + ' ' + (baseY - k(46)) + ' q' +
          k(20) + ' ' + k(4) + ' 0 ' + k(26), fill: 'none', stroke: '#dfe9ee',
          'stroke-width': k(5) }, g);
        shape(g, 'path', { d: 'M' + (cx - k(26)) + ' ' + baseY + ' l0 ' + (-k(54)) +
          ' q0 ' + (-k(12)) + ' ' + k(12) + ' ' + (-k(14)) + ' l' + k(26) + ' 0' +
          ' q' + k(14) + ' ' + k(2) + ' ' + k(14) + ' ' + k(14) + ' l0 ' + k(54) +
          ' Z', 'stroke-width': k(3) }, '#dfe9ee');
        shape(g, 'path', { d: 'M' + (cx - k(26)) + ' ' + (baseY - k(30)) + ' l' +
          k(52) + ' 0 l0 ' + k(30) + ' l' + (-k(52)) + ' 0 Z',
          'stroke-width': 0 }, '#4f9ec0');
        shape(g, 'path', { d: 'M' + (cx - k(26)) + ' ' + baseY + ' l0 ' + (-k(54)) +
          ' q0 ' + (-k(12)) + ' ' + k(12) + ' ' + (-k(14)) + ' l' + k(26) + ' 0' +
          ' q' + k(14) + ' ' + k(2) + ' ' + k(14) + ' ' + k(14) + ' l0 ' + k(54) +
          ' Z', 'stroke-width': k(3) });
        break;
    }
  }

  /* nominal footprint of each object at scale 1, so a brick and a bottle can
     be drawn to the same visual weight instead of one filling the panel and
     the other floating in it */
  var OBJ_BOX = {
    apple: [60, 68], sack: [70, 64], can: [48, 66], book: [92, 60],
    bottle: [42, 96], mug: [68, 56], carton: [46, 74], jug: [80, 68]
  };

  function objScale(kind, boxW, boxH) {
    var b = OBJ_BOX[kind] || [60, 60];
    return Math.min(boxW / b[0], boxH / b[1]);
  }
  function objHeight(kind, scale) {
    return (OBJ_BOX[kind] || [60, 60])[1] * scale;
  }

  function isLengthObject(kind) {
    return ['pencil', 'key', 'screw', 'marker', 'brush'].indexOf(kind) >= 0;
  }

  function label(g, x, y, value, anchor, halo, size) {
    var a = { 'text-anchor': anchor || 'middle', fill: '#2b3135',
              'font-size': size || 10, 'font-weight': '700' };
    if (halo) { a.stroke = halo; a['stroke-width'] = 2.6; a['paint-order'] = 'stroke'; }
    var t = S.text(g, x, y, D.fmt(value), a);
    t.setAttribute('dominant-baseline', 'middle');
    return t;
  }

  /* ---------------- instruments ------------------------------------------ */

  /* A close-up of the ruler: only a couple of dozen gradations are ever drawn,
     so the marks stay countable however fine the scale is. */
  function drawRuler(g, p, withObject) {
    var grid = p.grid;
    var total = Math.round(grid.max / grid.step);
    var readTick = Math.round(p.reading / grid.step);

    /* short measurements show the object whole from zero; long ones become a
       close-up around the reading */
    var win, start;
    if (readTick + 3 <= 40) {
      win = Math.min(total, Math.max(20, readTick + 3));
      start = 0;
    } else {
      win = Math.min(total, RULER_WINDOW);
      start = D.clamp(readTick - Math.round(win / 2), 0, total - win);
    }
    var every = 10, mid = 5;

    var x0 = 8, x1 = PW - 8, w = x1 - x0;
    var top = 50, h = 40;
    var px = function (t) { return x0 + ((t - start) / win) * w; };

    var clip = 'ucclip' + (++uid);
    var cp = S.el('clipPath', { id: clip }, g);
    S.el('rect', { x: 0, y: 0, width: PW, height: INS_H }, cp);
    var inner = S.el('g', { 'clip-path': 'url(#' + clip + ')' }, g);

    if (withObject) lengthObject(inner, p.object, px(0), 28, px(readTick) - px(0));

    S.el('rect', { x: x0 - 8, y: top, width: w + 16, height: h, rx: 2,
      fill: '#e3d7ae', stroke: '#9c8f6b', 'stroke-width': 1.2 }, inner);

    for (var i = start; i <= start + win; i++) {
      var vx = px(i);
      var isLab = (i % every === 0);
      var len = isLab ? 18 : (i % mid === 0 ? 11 : 7);
      S.el('line', { x1: vx, y1: top, x2: vx, y2: top + len, stroke: '#2b3135',
        'stroke-width': isLab ? 1.6 : 0.9 }, inner);
      /* a number that would be cut off by the edge of the close-up is skipped */
      if (isLab && vx > 20 && vx < PW - 20) label(inner, vx, top + 29, i * grid.step, 'middle', null, 11);
    }

    if (withObject) {
      var rx = px(readTick);
      S.el('line', { x1: rx, y1: 10, x2: rx, y2: top + 18, stroke: '#c0392b',
        'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, inner);
      S.el('path', { d: 'M' + (rx - 5) + ' 8 L' + (rx + 5) + ' 8 L' + rx +
        ' 16 Z', fill: '#c0392b' }, inner);
    }
    /* shaded edges show the scale continues past the close-up */
    if (start > 0) {
      S.el('rect', { x: 0, y: top, width: 5, height: h, fill: '#0b1013',
        opacity: 0.55 }, g);
    }
    if (start + win < total) {
      S.el('rect', { x: PW - 5, y: top, width: 5, height: h, fill: '#0b1013',
        opacity: 0.55 }, g);
    }
  }

  function drawDial(g, p, withObject) {
    var grid = p.grid;
    var cx = 318, cy = 52, R = 44;
    var n = Math.round(grid.max / grid.step);

    /* at most six numbers around the face so they never collide */
    var every = [5, 10, 20, 25, 50, 100].filter(function (m) {
      return n / m <= 6;
    })[0] || 100;

    S.el('circle', { cx: cx, cy: cy, r: R + 8, fill: '#7d878d' }, g);
    S.el('circle', { cx: cx, cy: cy, r: R + 2, fill: '#f0ece0' }, g);

    if (withObject) {
      var deg2 = 90 - (p.reading / grid.max) * 360;
      var tip = S.polar(cx, cy, R - 7, deg2);
      S.el('line', { x1: cx, y1: cy, x2: tip.x, y2: tip.y, stroke: '#c0392b',
        'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
    }

    for (var i = 0; i < n; i++) {
      var deg = 90 - (i / n) * 360;
      var isLab = (i % every === 0);
      var inner = isLab ? R - 10 : (i % Math.max(1, Math.round(every / 2)) === 0
        ? R - 7 : R - 4);
      var a = S.polar(cx, cy, R, deg), b = S.polar(cx, cy, inner, deg);
      S.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#2b3135',
        'stroke-width': isLab ? 1.4 : 0.7 }, g);
      if (isLab) {
        var lp = S.polar(cx, cy, R - 20, deg);
        label(g, lp.x, lp.y, i * grid.step, 'middle', '#f0ece0', 8.5);
      }
    }
    S.el('circle', { cx: cx, cy: cy, r: 4, fill: '#2b3135' }, g);

    if (withObject) {
      S.el('rect', { x: 68, y: 76, width: 158, height: 7, rx: 2, fill: '#aab6bd' }, g);
      S.el('rect', { x: 133, y: 83, width: 28, height: 20, fill: '#7d878d' }, g);
      var os = objScale(p.object, 138, 62);
      standingObject(g, p.object, 147, 76, os);
    }
  }

  function drawCylinder(g, p, withObject) {
    var grid = p.grid;
    var x = 284, w = 68, top = 5, bot = 90, hgt = bot - top, r = 10;
    var n = Math.round(grid.max / grid.step);
    var every = [5, 10, 20, 25].filter(function (m) { return n / m <= 6; })[0] || 10;

    var shell = 'M' + x + ' ' + top + ' L' + x + ' ' + (bot - r) +
      ' q0 ' + r + ' ' + r + ' ' + r + ' L' + (x + w - r) + ' ' + bot +
      ' q' + r + ' 0 ' + r + ' ' + (-r) + ' L' + (x + w) + ' ' + top;

    S.el('path', { d: shell + ' Z', fill: '#e7edf0', opacity: 0.94,
      stroke: '#a9b7be', 'stroke-width': 1.4 }, g);
    S.el('ellipse', { cx: x + w / 2, cy: top, rx: w / 2, ry: 3.4,
      fill: '#cfdbe1', stroke: '#a9b7be', 'stroke-width': 1.1 }, g);
    S.el('rect', { x: x - 10, y: bot, width: w + 20, height: 7, rx: 2,
      fill: '#c3ced3' }, g);

    if (withObject) {
      var fy = bot - (p.reading / grid.max) * hgt;
      S.el('path', {
        d: 'M' + x + ' ' + fy + ' L' + x + ' ' + (bot - r) + ' q0 ' + r + ' ' +
           r + ' ' + r + ' L' + (x + w - r) + ' ' + bot + ' q' + r + ' 0 ' + r +
           ' ' + (-r) + ' L' + (x + w) + ' ' + fy + ' Z', fill: '#3f95b8' }, g);
      S.el('ellipse', { cx: x + w / 2, cy: fy, rx: w / 2, ry: 3,
        fill: '#7fcde8' }, g);
      var os = objScale(p.object, 140, 74);
      standingObject(g, p.object, 146, 97, os);
    }

    for (var i = 0; i <= n; i++) {
      var vy = bot - (i / n) * hgt;
      var isLab = (i % every === 0);
      var len = isLab ? 24 : (i % Math.max(1, Math.round(every / 2)) === 0 ? 15 : 8);
      S.el('line', { x1: x + w, y1: vy, x2: x + w - len, y2: vy,
        stroke: '#2b3135', 'stroke-width': isLab ? 1.3 : 0.7, opacity: 0.9 }, g);
      if (isLab) label(g, x + w - len - 4, vy, i * grid.step, 'end', null, 8.5);
    }
  }

  /* ---------------- panels ------------------------------------------------ */

  function objectPane(p) {
    var svg = S.root(0, 0, PW, OBJ_H);
    var g = S.el('g', {}, svg);
    if (isLengthObject(p.object)) {
      lengthObject(g, p.object, PW / 2 - 95, OBJ_H / 2, 190);
    } else {
      var os = objScale(p.object, 150, 68);
      standingObject(g, p.object, PW / 2, OBJ_H / 2 + objHeight(p.object, os) / 2, os);
    }
    return svg;
  }

  function instrumentPane(p, withObject) {
    var svg = S.root(0, 0, PW, INS_H);
    var g = S.el('g', {}, svg);
    if (p.instrument === 'ruler') drawRuler(g, p, withObject);
    else if (p.instrument === 'dial') drawDial(g, p, withObject);
    else drawCylinder(g, p, withObject);
    return svg;
  }

  /* ---------------- mount -------------------------------------------------- */

  D.unitsRender = function (host, inst) {
    var p = inst.puzzle, s = inst.solution;

    var wrap = document.createElement('div');
    wrap.className = 'uc';

    var lamps = document.createElement('div');
    lamps.className = 'uc-lamps';
    p.lit.forEach(function (on) {
      var sq = document.createElement('i');
      if (on) sq.className = 'on';
      lamps.appendChild(sq);
    });

    var stack = document.createElement('div');
    stack.className = 'uc-stack';

    var plan = { A: ['object', 'both'], B: ['both', 'object'],
                 C: ['both', 'dark'],   D: ['dark', 'both'] }[p.layout];

    plan.forEach(function (kind, i) {
      var pane = document.createElement('div');
      pane.className = 'uc-pane' + (kind === 'dark' ? ' dark' : '');
      if (kind === 'object') pane.appendChild(objectPane(p));
      else if (kind === 'both') pane.appendChild(instrumentPane(p, true));
      else {
        /* the dark panel still holds its share of the stack */
        var other = plan[1 - i];
        pane.style.height = (other === 'both' ? OBJ_H : INS_H) + 'px';
      }
      stack.appendChild(pane);
    });

    var form = document.createElement('div');
    form.className = 'side answer';
    form.innerHTML =
      '<input type="text" maxlength="7" inputmode="numeric" autocomplete="off" ' +
      'spellcheck="false"><button type="button" class="go-btn">ENTER</button>';

    wrap.appendChild(lamps);
    wrap.appendChild(stack);
    wrap.appendChild(form);
    host.appendChild(wrap);

    var box = form.querySelector('input');
    var btn = form.querySelector('button');

    function attempt() {
      if (inst.isSolved()) return;
      var v = box.value.trim();
      if (!/^\d+$/.test(v)) { inst.strike(); return; }
      if (Number(v) === s.answer) inst.solve(); else inst.strike();
    }
    btn.addEventListener('click', attempt);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); attempt(); }
    });

    inst.onSolved = function () { box.disabled = true; btn.disabled = true; };
  };
})(DEFUSAL);
