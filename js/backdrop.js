/* ==========================================================================
   DEFUSAL — the room behind the interface.

   A procedural sky: drifting colour, a star field with depth, the curve of a
   world, and something very far away crossing it.

   Built to be cheap. The colour is CSS radial-gradient rather than a blurred
   SVG (a screen-sized feGaussianBlur re-renders every frame and will not hold
   sixty), and the stars are one static drawing whose two layers are moved as
   a whole rather than several hundred separately animated nodes.
   ========================================================================== */

(function (D) {
  'use strict';

  var S = D.svg;
  var W = 1600, H = 900;

  function cloud(host, x, y, size, color, alpha, dur, delay) {
    var d = document.createElement('div');
    d.className = 'bd-cloud';
    d.style.cssText =
      'left:' + x + '%;top:' + y + '%;' +
      'width:' + size + 'vmax;height:' + size + 'vmax;' +
      'background:radial-gradient(closest-side, ' + color + ' 0%, ' +
      'rgba(0,0,0,0) 72%);opacity:' + alpha + ';' +
      'animation-duration:' + dur + 's;animation-delay:' + delay + 's';
    host.appendChild(d);
  }

  D.backdrop = {
    init: function () {
      var host = document.getElementById('backdrop');
      if (!host) return;
      host.innerHTML = '';

      /* colour: four soft gradients, moved as whole layers */
      cloud(host, 14, 14, 62, '#1f6f8f', 0.34, 54, 0);
      cloud(host, 72, 20, 58, '#5b3f8c', 0.30, 66, -14);
      cloud(host, 42, 74, 74, '#8a5a2a', 0.24, 78, -32);
      cloud(host, 84, 4, 40, '#2f8f7a', 0.22, 60, -25);

      var svg = S.root(0, 0, W, H, 'bd-svg');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

      /* the star field: static art, two groups, two animations in total */
      var twinkles = [];
      [[150, 1.0, 0.55], [90, 1.9, 0.32]].forEach(function (layer, li) {
        var g = S.el('g', { class: 'bd-layer bd-layer-' + li }, svg);
        var rng = D.makeRng(9001 + li * 77), i;
        for (i = 0; i < layer[0]; i++) {
          var c = S.el('circle', {
            cx: D.rint(rng, 0, W), cy: D.rint(rng, 0, H),
            r: (D.rint(rng, 5, 16) / 10) * layer[1],
            fill: '#dceef6',
            opacity: layer[2] * (0.4 + D.rint(rng, 0, 60) / 100)
          }, g);
          if (i % 9 === 0) twinkles.push(c);      /* only a handful blink */
        }
      });
      twinkles.forEach(function (c, i) {
        c.setAttribute('class', 'bd-star');
        c.setAttribute('style', 'animation-delay:' + (i * 0.31 % 6) + 's');
      });

      /* the curve of a world along the bottom */
      S.el('circle', { cx: 700, cy: 2050, r: 1330, fill: '#081a24',
        opacity: 0.85 }, svg);
      S.el('circle', { cx: 700, cy: 2050, r: 1336, fill: 'none',
        stroke: '#2e7f9c', 'stroke-width': 4, opacity: 0.4,
        class: 'bd-rim' }, svg);
      var rng2 = D.makeRng(404), k;
      for (k = 0; k < 46; k++) {
        var a = 90 + D.rint(rng2, -46, 46);
        var p = S.polar(700, 2050, 1330 - D.rint(rng2, 0, 30), a);
        S.el('circle', { cx: p.x, cy: p.y, r: D.rint(rng2, 5, 13) / 10,
          fill: '#ffcf8a', opacity: 0.2 + D.rint(rng2, 0, 50) / 100 }, svg);
      }

      /* something very far off, crossing */
      var far = S.el('g', { class: 'bd-far' }, svg);
      S.el('ellipse', { cx: 0, cy: 0, rx: 26, ry: 6, fill: '#1a2b33',
        stroke: '#4d7f92', 'stroke-width': 1.4 }, far);
      S.el('path', { d: 'M-9 -3 a11 9 0 0 1 18 0 Z', fill: '#24404c',
        stroke: '#4d7f92', 'stroke-width': 1.2 }, far);
      S.el('circle', { cx: -14, cy: 2, r: 1.6, fill: '#6fd7e8',
        class: 'bd-blink' }, far);

      host.appendChild(svg);
    }
  };
})(DEFUSAL);
