/* ==========================================================================
   DEFUSAL — the cutscene illustration kit: shared pieces.

   Every picture in the cutscenes is painted here in code — gradients, rim
   light, glow, haze — the way a flat-vector illustrator would build it, so
   there is still not one image file in the game.

   Painters draw in a fixed 1600 x 900 design space. `layer` maps that onto
   the screen with the camera applied at a given depth: depth 0 does not
   move (the sky), depth 1 moves fully with the camera (the foreground), and
   everything between gives the parallax that makes a flat painting read as
   a place. A painter is { prepare(W, H, params, lite) -> state,
   draw(g, t, cam, state, W, H, params) } and is registered by name.

   Expensive, unchanging things (a thousand stars, a city's windows) are
   painted once into an offscreen canvas in `prepare` and stamped each
   frame. Anything that moves is drawn live.

   The scenes themselves, and the one art style they all follow, are in
   kit-flat.js.
   ========================================================================== */

(function (D) {
  'use strict';

  var cine = D.cine = D.cine || {};
  var painters = {};
  var DW = 1600, DH = 900;

  function rng(seed) {
    var r = (seed >>> 0) % 2147483646 + 1;
    return function () { r = (r * 16807) % 2147483647; return r / 2147483647; };
  }
  function off(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function cover(W, H) { return Math.max(W / DW, H / DH); }

  /* Draw `fn` in design units at depth `d` under camera `cam`. */
  function layer(g, W, H, cam, d, fn) {
    var k = cover(W, H) * (1 + (cam.z - 1) * d);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(k, k);
    g.translate(-DW / 2 - cam.x * DW * d, -DH / 2 - cam.y * DH * d);
    fn(g);
    g.restore();
  }

  /* Paint once into an offscreen canvas at the resolution the screen needs
     (with headroom for the camera's push), and hand back a stamp. */
  function bake(W, H, w, h, fn, zoom) {
    var dpr = cine.dpr || 1;
    var s = cover(W, H) * dpr * (zoom || 1.15);
    /* never more than about a 4K frame's worth of pixels per sheet: past
       that, memory and upload cost rise and the eye gains nothing */
    s = Math.min(s, 4096 / Math.max(w, h), Math.sqrt(9e6 / (w * h)));
    var c = off(w * s, h * s), x = c.getContext('2d');
    x.scale(s, s);
    fn(x);
    return { c: c, w: w, h: h };
  }

  /* Painting a sheet takes tens of milliseconds, and doing it while a scene
     plays is exactly what made the cuts hitch (measured: 80-220 ms frames at
     shot changes). Sheets that several shots share — the sky, the stars, the
     world, a skyline — are painted once and kept, keyed by what they are and
     the screen they were painted for. */
  var cache = {}, cacheSize = '';
  function cached(key, W, H, make) {
    var size = W + 'x' + H + '@' + (cine.dpr || 1);
    if (size !== cacheSize) { cache = {}; cacheSize = size; }
    if (!cache[key]) cache[key] = make();
    return cache[key];
  }

  function stamp(g, b, x, y, w, h) {
    g.drawImage(b.c, x || 0, y || 0, w || b.w, h || b.h);
  }

  function ell(x, cx, cy, rx, ry, a0, a1) {
    x.beginPath(); x.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0,
      a0 || 0, a1 === undefined ? Math.PI * 2 : a1);
  }

  /* a closed, smooth, slightly irregular shape: land, cloud, a bush */
  function blob(x, cx, cy, rad, wob, rnd, pts, squash) {
    pts = pts || 14; squash = squash || 0.8;
    var p = [], i;
    for (i = 0; i < pts; i++) {
      var a = i / pts * Math.PI * 2, k = rad * (1 - wob / 2 + rnd() * wob);
      p.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k * squash]);
    }
    x.beginPath();
    for (i = 0; i < pts; i++) {
      var p0 = p[i], p1 = p[(i + 1) % pts];
      var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (i === 0) x.moveTo(mx, my); else x.quadraticCurveTo(p0[0], p0[1], mx, my);
    }
    x.quadraticCurveTo(p[0][0], p[0][1], (p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
    x.closePath();
  }

  function lin(x, x0, y0, x1, y1, stops) {
    var gr = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    return gr;
  }
  function rad(x, cx, cy, r0, r1, stops, fx, fy) {
    var gr = x.createRadialGradient(fx === undefined ? cx : fx, fy === undefined ? cy : fy, r0, cx, cy, r1);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    return gr;
  }

  /* light added, not painted over: a soft round glow */
  function glow(x, cx, cy, r, rgb, a) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = rad(x, cx, cy, 0, r, [[0, 'rgba(' + rgb + ',' + a + ')'],
      [0.35, 'rgba(' + rgb + ',' + (a * 0.35) + ')'], [1, 'rgba(' + rgb + ',0)']]);
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.restore();
  }

  /* the sky behind a place: a vertical gradient wider than the frame, so
     the camera can never pan past its edge */
  function sky(x, stops) {
    x.fillStyle = lin(x, 0, -200, 0, DH + 200, stops);
    x.fillRect(-600, -400, DW + 1200, DH + 800);
  }

  /* a star field, baked */
  function stars(W, H, n, seed, yMax, big) {
    return cached('stars:' + [n, seed, yMax, big].join(','), W, H, function () { return bake(W, H, DW + 800, DH + 400, function (x) {
      var r = rng(seed);
      for (var i = 0; i < n; i++) {
        var px = r() * (DW + 800), py = r() * Math.min(DH + 400, yMax || 9999);
        var s = (big ? 1.1 : 0.45) + Math.pow(r(), 4) * (big ? 2.4 : 1.3), a = 0.3 + r() * 0.7;
        if (s > 1.9) {
          x.fillStyle = rad(x, px, py, 0, s * 4, [[0, 'rgba(200,230,255,' + a * 0.45 + ')'], [1, 'rgba(200,230,255,0)']]);
          x.fillRect(px - s * 4, py - s * 4, s * 8, s * 8);
        }
        x.fillStyle = 'rgba(235,245,255,' + a + ')';
        x.beginPath(); x.arc(px, py, s * 0.6, 0, 7); x.fill();
      }
    }, 1.05); });
  }
  function starsAt(g, b) { stamp(g, b, -400, -200); }

  /* ---- people ------------------------------------------------------------
     The two students: silhouettes, never faces. School uniform reads from the
     shape alone — collar, short sleeves, a bag strap, a skirt or trousers.
     `pose`: stand | device | binder | phone | sit | walk. `rim` is the colour
     of the light catching their edge; `face` is -1 or 1. Drawn about 300
     units tall at scale 1, feet at (0, 0). */
  function student(x, px, py, s, pose, opts) {
    opts = opts || {};
    var face = opts.face || 1, fill = opts.fill || '#0b1318', rim = opts.rim || 'rgba(140,220,240,.75)';
    var skirt = !!opts.skirt, t = opts.t || 0;
    var sitting = pose === 'sit';
    var bob = pose === 'walk' ? Math.sin(t * 6) * 3 : 0;
    var hy = sitting ? -200 : -282 + bob;
    var sy = hy + 56, wy = sy + 112;

    /* The figure as one path, so it can be laid down twice: once in the rim
       colour nudged toward the light, then dark on top. Only the edge that
       faces the light shows, the way a rim light does — stroking the outline
       instead drew every overlap as a line across the body. */
    function shape() {
      x.beginPath();
      x.moveTo(25, hy + 22); x.arc(0, hy + 22, 25, 0, Math.PI * 2);
      x.rect(-9, hy + 42, 18, 18);
      x.moveTo(-40, sy + 8);
      x.quadraticCurveTo(-42, sy, -22, sy - 2);
      x.lineTo(0, sy + 12); x.lineTo(22, sy - 2);
      x.quadraticCurveTo(42, sy, 40, sy + 8);
      x.lineTo(46, sy + 44); x.lineTo(32, sy + 46);
      x.lineTo(30, sy + 112); x.lineTo(-30, sy + 112);
      x.lineTo(-32, sy + 46); x.lineTo(-46, sy + 44);
      x.closePath();
      function arm(sx, ex, ey, hx2, hy2) {
        x.moveTo(sx - 7, sy + 40); x.lineTo(ex - 8, ey); x.lineTo(hx2 - 6, hy2);
        x.lineTo(hx2 + 6, hy2); x.lineTo(ex + 8, ey); x.lineTo(sx + 7, sy + 40); x.closePath();
      }
      if (pose === 'device' || pose === 'binder') {
        arm(-38, -30, sy + 80, 14, sy + 92);
        arm(38, 40, sy + 80, 20, sy + 96);
      } else if (pose === 'phone') {
        arm(-38, -40, sy + 98, -38, sy + 150);
        arm(38, 44, sy + 50, 22, sy + 4);
      } else if (sitting) {
        arm(-38, -40, sy + 80, -20, sy + 110);
        arm(38, 40, sy + 80, 24, sy + 110);
      } else {
        var sw = pose === 'walk' ? Math.sin(t * 6) * 10 : 0;
        arm(-38, -42 + sw, sy + 98, -40 + sw, sy + 150);
        arm(38, 42 - sw, sy + 98, 40 - sw, sy + 150);
      }
      if (sitting) {
        x.moveTo(-30, wy); x.lineTo(-30, wy + 30); x.lineTo(40, wy + 34); x.lineTo(46, wy + 130);
        x.lineTo(62, wy + 130); x.lineTo(60, wy + 16); x.lineTo(30, wy); x.closePath();
        x.moveTo(-22, wy + 16); x.lineTo(14, wy + 40); x.lineTo(16, wy + 132); x.lineTo(32, wy + 132); x.lineTo(30, wy + 30); x.closePath();
      } else {
        var st = pose === 'walk' ? Math.sin(t * 6) * 16 : 0;
        if (skirt) {
          x.moveTo(-32, wy - 4); x.lineTo(-40, wy + 64); x.lineTo(40, wy + 64); x.lineTo(32, wy - 4); x.closePath();
          x.moveTo(-22 - st, wy + 60); x.lineTo(-24 - st, -6); x.lineTo(-8 - st, -6); x.lineTo(-6, wy + 60); x.closePath();
          x.moveTo(6, wy + 60); x.lineTo(8 + st, -6); x.lineTo(24 + st, -6); x.lineTo(22, wy + 60); x.closePath();
        } else {
          x.moveTo(-30, wy - 2); x.lineTo(-28 - st, -6); x.lineTo(-6 - st, -6); x.lineTo(0, wy + 30);
          x.lineTo(6 + st, -6); x.lineTo(28 + st, -6); x.lineTo(30, wy - 2); x.closePath();
        }
        x.moveTo(-30 - st, -8); x.lineTo(-30 - st, 0); x.lineTo(-2 - st, 0); x.lineTo(-4 - st, -8); x.closePath();
        x.moveTo(4 + st, -8); x.lineTo(2 + st, 0); x.lineTo(32 + st, 0); x.lineTo(30 + st, -8); x.closePath();
      }
      if (opts.bag) { x.moveTo(-40, sy + 12); x.lineTo(-62, sy + 20); x.lineTo(-64, sy + 96); x.lineTo(-40, sy + 100); x.closePath(); }
    }

    var light = opts.light || [-1, -0.6], off2 = 3.2 / Math.max(0.3, s);
    x.save();
    x.translate(px, py);
    x.save();
    x.translate(light[0] * off2 * s, light[1] * off2 * s);
    x.scale(s * face, s);
    shape(); x.fillStyle = rim; x.fill('nonzero');
    x.restore();
    x.scale(s * face, s);
    shape(); x.fillStyle = fill; x.fill('nonzero');
    if (pose === 'binder') {
      x.fillStyle = '#7a2d27'; x.fillRect(4, sy + 64, 46, 58);
      x.fillStyle = '#e9e1cf'; x.fillRect(8, sy + 70, 6, 46);
    } else if (pose === 'device') {
      x.fillStyle = '#1d2a31'; x.fillRect(-6, sy + 76, 60, 38);
      glowRect(x, 2, sy + 82, 26, 10, '255,200,97', 0.9);
    } else if (pose === 'phone') {
      x.fillStyle = '#0a0f12'; x.fillRect(14, sy - 12, 14, 24);
      glowRect(x, 16, sy - 10, 10, 20, '170,220,255', 0.7);
    }
    x.restore();
  }

  function glowRect(x, gx, gy, w, h, rgb, a) {
    x.save();
    x.fillStyle = 'rgba(' + rgb + ',' + a + ')'; x.fillRect(gx, gy, w, h);
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = rad(x, gx + w / 2, gy + h / 2, 0, Math.max(w, h) * 1.6, [[0, 'rgba(' + rgb + ',' + a * 0.6 + ')'], [1, 'rgba(' + rgb + ',0)']]);
    x.fillRect(gx - w * 1.6, gy - h * 1.6, w * 4.2, h * 4.2);
    x.restore();
  }

  /* ---- weather ---------------------------------------------------------- */

  var drops = (function () { var r = rng(77), d = []; for (var i = 0; i < 260; i++) d.push([r(), r(), 0.6 + r() * 0.8]); return d; })();
  function rain(x, t, amount, wind, lite, area) {
    if (amount <= 0) return;
    area = area || [-200, -100, DW + 400, DH + 200];
    var n = Math.round((lite ? 90 : drops.length) * amount);
    x.save();
    x.strokeStyle = 'rgba(190,215,235,.38)';
    x.lineWidth = 1.6;
    x.beginPath();
    for (var i = 0; i < n; i++) {
      var d = drops[i];
      var speed = 1.6 * d[2];
      var yy = area[1] + ((d[1] + t * speed) % 1) * area[3];
      var xx = area[0] + d[0] * area[2] + (yy - area[1]) * (wind || 0.12);
      x.moveTo(xx, yy); x.lineTo(xx - 7 * (wind || 0.12) * 4, yy - 34 * d[2]);
    }
    x.stroke();
    x.restore();
  }

  /* a full-frame flash, scaled by the FLASHES setting */
  function flash(x, amount, rgb) {
    var k = amount * (cine.flashK ? cine.flashK() : 1);
    if (k <= 0.002) return;
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = 'rgba(' + (rgb || '220,235,255') + ',' + k + ')';
    x.fillRect(-600, -400, DW + 1200, DH + 800);
    x.restore();
  }

  function register(name, p) { painters[name] = p; }

  cine.kit = {
    DW: DW, DH: DH,
    register: register,
    get: function (name) { return painters[name] || null; },
    names: function () { return Object.keys(painters); },
    rng: rng, off: off, cover: cover, layer: layer, bake: bake, cached: cached, stamp: stamp,
    ell: ell, blob: blob, lin: lin, rad: rad, glow: glow, glowRect: glowRect,
    sky: sky, stars: stars, starsAt: starsAt,
    student: student, rain: rain, flash: flash
  };
})(DEFUSAL);
