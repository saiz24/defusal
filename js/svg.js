/* ==========================================================================
   DEFUSAL — tiny SVG construction helpers.
   Everything the bomb draws is built procedurally through these.
   ========================================================================== */

(function (D) {
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag), k;
    if (attrs) for (k in attrs) if (attrs.hasOwnProperty(k)) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function root(x, y, w, h, cls) {
    var s = el('svg', {
      viewBox: x + ' ' + y + ' ' + w + ' ' + h,
      preserveAspectRatio: 'xMidYMid meet'
    });
    if (cls) s.setAttribute('class', cls);
    return s;
  }

  function text(parent, x, y, str, attrs) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.textContent = str;
    return t;
  }

  /* Math-convention polar point (0deg = east, angles increase counter-clockwise
     on screen because SVG's y axis points down and we negate it). */
  function polar(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }

  /* Arc from startDeg sweeping `sweep` degrees counter-clockwise on screen. */
  function arcPath(cx, cy, r, startDeg, sweep) {
    var p0 = polar(cx, cy, r, startDeg);
    var p1 = polar(cx, cy, r, startDeg + sweep);
    var large = Math.abs(sweep) > 180 ? 1 : 0;
    var dir = sweep >= 0 ? 0 : 1; /* ccw on screen => sweep-flag 0 */
    return 'M ' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) +
           ' A ' + r + ' ' + r + ' 0 ' + large + ' ' + dir + ' ' +
           p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
  }

  /* --- moulded controls ---------------------------------------------------
     Built from stacked solids rather than gradients: a shadowed base, the cap,
     a lit upper half and a specular, so a key reads as an object with a top
     and a side instead of a coloured circle. */

  var INKC = '#161f24';

  function dome(parent, cx, cy, r, color, lift) {
    var d = lift === undefined ? 7 : lift;
    var g = el('g', {}, parent);
    el('ellipse', { cx: cx, cy: cy + d + 2, rx: r, ry: r * 0.94,
      fill: 'rgba(0,0,0,.32)' }, g);
    el('circle', { cx: cx, cy: cy + d, r: r, fill: D.shade(color, -0.42),
      stroke: INKC, 'stroke-width': 3 }, g);
    el('circle', { cx: cx, cy: cy, r: r, fill: color,
      stroke: INKC, 'stroke-width': 3 }, g);
    el('path', {
      d: 'M' + (cx - r * 0.86) + ' ' + (cy - r * 0.12) +
         ' a ' + r + ' ' + r + ' 0 0 1 ' + (r * 1.72) + ' 0' +
         ' a ' + (r * 0.86) + ' ' + (r * 0.5) + ' 0 0 0 ' + (-r * 1.72) + ' 0 Z',
      fill: D.shade(color, 0.30), opacity: 0.85
    }, g);
    el('ellipse', { cx: cx - r * 0.3, cy: cy - r * 0.44, rx: r * 0.36,
      ry: r * 0.2, fill: '#ffffff', opacity: 0.42,
      transform: 'rotate(-24 ' + (cx - r * 0.3) + ' ' + (cy - r * 0.44) + ')' }, g);
    return g;
  }

  function keycap(parent, x, y, w, h, rx, color, lift) {
    var d = lift === undefined ? 8 : lift;
    var g = el('g', {}, parent);
    el('rect', { x: x, y: y + d + 2, width: w, height: h, rx: rx,
      fill: 'rgba(0,0,0,.3)' }, g);
    el('rect', { x: x, y: y + d, width: w, height: h, rx: rx,
      fill: D.shade(color, -0.42), stroke: INKC, 'stroke-width': 3 }, g);
    el('rect', { x: x, y: y, width: w, height: h, rx: rx, fill: color,
      stroke: INKC, 'stroke-width': 3 }, g);
    el('rect', { x: x + w * 0.1, y: y + h * 0.1, width: w * 0.8,
      height: h * 0.42, rx: rx * 0.7, fill: D.shade(color, 0.32),
      opacity: 0.8 }, g);
    el('rect', { x: x + w * 0.16, y: y + h * 0.15, width: w * 0.36,
      height: h * 0.14, rx: h * 0.07, fill: '#ffffff', opacity: 0.4 }, g);
    return g;
  }

  D.svg = {
    NS: NS, el: el, root: root, text: text, polar: polar, arcPath: arcPath,
    dome: dome, keycap: keycap
  };
})(DEFUSAL);
