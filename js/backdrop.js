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

  /* A drifting field of colour. The gradient is painted from currentColor,
     which means retinting a cloud is a plain `color` transition and the
     browser interpolates it for us — no second layer to cross-fade, and
     still no filter anywhere near it. */
  var clouds = [];

  function cloud(host, x, y, size, alpha, dur, delay) {
    var d = document.createElement('div');
    d.className = 'bd-cloud';
    d.style.cssText =
      'left:' + x + '%;top:' + y + '%;' +
      'width:' + size + 'vmax;height:' + size + 'vmax;' +
      'opacity:' + alpha + ';' +
      'animation-duration:' + dur + 's;animation-delay:' + delay + 's';
    host.appendChild(d);
    clouds.push(d);
    return d;
  }

  /* Each device gets its own sky. The palette runs with the accents, cool to
     hot, so moving through the pages is a change of weather. */
  var SKIES = [
    ['#1f6f8f', '#3d5f9c', '#2f8f7a', '#15455c'],   /* 1 cool blue    */
    ['#2b7f6a', '#3f7f4c', '#1f6f8f', '#1a5348'],   /* 2 green        */
    ['#8a7a2a', '#8a5a2a', '#5b3f8c', '#4a4420'],   /* 3 amber        */
    ['#8a4a2a', '#7a3560', '#5b3f8c', '#52281c'],   /* 4 rust         */
    ['#8c2f3a', '#6a2f6c', '#8a4a2a', '#4a1a22']    /* 5 hot          */
  ];
  var FREE = ['#1f6f8f', '#5b3f8c', '#8a5a2a', '#2f8f7a'];   /* the default */

  D.backdrop = {
    init: function () {
      var host = document.getElementById('backdrop');
      if (!host) return;
      host.innerHTML = '';

      /* colour: soft gradients, moved as whole layers */
      clouds.length = 0;
      cloud(host, 14, 14, 68, 0.62, 54, 0);
      cloud(host, 72, 20, 62, 0.55, 66, -14);
      cloud(host, 42, 76, 82, 0.48, 78, -32);
      cloud(host, 86, 6, 46, 0.44, 60, -25);
      cloud(host, 28, 48, 56, 0.36, 92, -47);
      D.backdrop.sky(-1);

      /* one slow sweep across everything, so the sky is never quite still */
      var sweep = document.createElement('div');
      sweep.className = 'bd-sweep';
      host.appendChild(sweep);

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

      /* two of these cross in a minute and a half, and are meant to be
         half-missed: one node each */
      [[0, 210, 90, 34], [1, 980, 250, 71]].forEach(function (d) {
        var sh = S.el('g', { class: 'bd-shoot bd-shoot-' + d[0],
          transform: 'translate(' + d[1] + ',' + d[2] + ')',
          style: 'animation-delay:' + d[3] + 's' }, svg);
        S.el('line', { x1: 0, y1: 0, x2: 74, y2: 26, stroke: '#dceef6',
          'stroke-width': 2, 'stroke-linecap': 'round', opacity: .9 }, sh);
      });

      /* something very far off, crossing */
      var far = S.el('g', { class: 'bd-far' }, svg);
      S.el('ellipse', { cx: 0, cy: 0, rx: 26, ry: 6, fill: '#1a2b33',
        stroke: '#4d7f92', 'stroke-width': 1.4 }, far);
      S.el('path', { d: 'M-9 -3 a11 9 0 0 1 18 0 Z', fill: '#24404c',
        stroke: '#4d7f92', 'stroke-width': 1.2 }, far);
      S.el('circle', { cx: -14, cy: 2, r: 1.6, fill: '#6fd7e8',
        class: 'bd-blink' }, far);

      host.appendChild(svg);
    },

    /* n is the stage index; anything else gets the default weather */
    sky: function (n) {
      var pal = SKIES[n] || FREE;
      clouds.forEach(function (d, i) { d.style.color = pal[i % pal.length]; });
    }
  };
})(DEFUSAL);
