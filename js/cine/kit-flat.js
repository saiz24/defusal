/* ==========================================================================
   DEFUSAL — the cutscene art: flat, layered, atmospheric. One style.

   Every picture in the story is drawn by the rules below and nothing else,
   so no scene can drift from the others:

     1. SKY        one gradient, top to horizon
     2. LAYERS     three to five flat silhouette layers. A layer's colour is
                   never picked by hand: `tint(pal, local, depth)` takes the
                   thing's own colour (or none), darkens it for the time of
                   day, and fades it toward the scene's fog with distance —
                   atmospheric perspective, the way Firewatch did it
     3. DETAIL     none inside a shape — no outlines, no textures — except
                   points of light: windows, lamps, stars, a clock
     4. ACCENTS    two in the whole game: amber is the device, cyan is the
                   visitors
     5. GLOW       only on things that give off light
     6. CLOSE-UPS  objects seen up close get exactly two flat tones, a lit
                   side and a shadow side (the craft, the device, the desk)

   The painters keep the names the script already uses — globe, arrival,
   city-night, classroom, market … — so the story and its timing did not
   change when the style did.
   ========================================================================== */

(function (D) {
  'use strict';

  var K = D.cine.kit, DW = K.DW, DH = K.DH;
  var rng = K.rng, ell = K.ell, lin = K.lin, rad = K.rad;

  var AMBER = '255,200,97', CYAN = '111,215,232';

  /* top, horizon, fog, near, dark (how much night swallows local colour),
     light (the colour of whatever lights the scene) */
  var PAL = {
    space:   { top: '#02040b', hor: '#0a1430', fog: '#2b5d8f', near: '#06090f', dark: 0.6, light: '#fff2d8' },
    night:   { top: '#070b1c', hor: '#24305a', fog: '#3a4878', near: '#05070e', dark: 0.82, light: '#dfe8ff' },
    dawn:    { top: '#26284f', hor: '#f0a07c', fog: '#b47a92', near: '#1d1426', dark: 0.45, light: '#ffe2b4' },
    morning: { top: '#5fa8dc', hor: '#f6e2c4', fog: '#b9cfd9', near: '#25333a', dark: 0.12, light: '#fff3d6' },
    noon:    { top: '#3f97d6', hor: '#d4ecf4', fog: '#a6cbd9', near: '#24414f', dark: 0.08, light: '#fffbe8' },
    storm:   { top: '#121823', hor: '#343f51', fog: '#465163', near: '#07090d', dark: 0.7, light: '#dfe8ff' },
    sunrise: { top: '#2f3c78', hor: '#ffbf8a', fog: '#d38f96', near: '#2a1830', dark: 0.35, light: '#fff0d0' },
    room:    { top: '#0c1116', hor: '#1b252d', fog: '#2a3640', near: '#080b0e', dark: 0.5, light: '#ffe0b0' }
  };

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, k) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }); }
  function css(c) { return 'rgb(' + c.join(',') + ')'; }

  /* THE rule: a thing's colour at a depth (0 = on the horizon, 1 = in front
     of us), from its own colour (or the near-dark if it has none) */
  function tint(pal, local, d) {
    var base = local ? mix(hex(local), hex(pal.near), pal.dark) : hex(pal.near);
    var k = Math.pow(Math.max(0, Math.min(1, d)), 0.8);
    return css(mix(hex(pal.fog), base, k));
  }

  function sky(x, pal) {
    x.fillStyle = lin(x, 0, -200, 0, DH * 0.8, [[0, pal.top], [1, pal.hor]]);
    x.fillRect(-600, -400, DW + 1200, DH + 800);
  }
  function stars(x, n, seed, yMax, alpha) {
    var r = rng(seed);
    for (var i = 0; i < n; i++) {
      x.fillStyle = 'rgba(230,240,255,' + ((0.25 + r() * 0.6) * (alpha || 1)) + ')';
      var sz = r() < 0.06 ? 2.4 : 1.2;
      x.fillRect(-600 + r() * (DW + 1200), -400 + r() * (yMax + 400), sz, sz);
    }
  }
  function glow(x, px, py, r, rgb, a) { K.glow(x, px, py, r, rgb, a); }

  /* ---- silhouettes -------------------------------------------------- */

  function ridge(x, seed, base, amp, colour) {
    var r = rng(seed), pts = [], n = 16;
    for (var i = 0; i <= n; i++) pts.push(base - amp * (0.35 + 0.65 * r()));
    x.beginPath(); x.moveTo(-600, DH + 400); x.lineTo(-600, pts[0]);
    for (i = 0; i < n; i++) {
      var px = -600 + i / n * (DW + 1200), nx = -600 + (i + 0.5) / n * (DW + 1200);
      x.quadraticCurveTo(px, pts[i], nx, (pts[i] + pts[i + 1]) / 2);
    }
    x.lineTo(DW + 600, pts[n]); x.lineTo(DW + 600, DH + 400); x.closePath();
    x.fillStyle = colour; x.fill();
  }

  function volcano(x, cx, base, w, h, colour) {
    x.beginPath();
    x.moveTo(cx - w, base);
    x.bezierCurveTo(cx - w * 0.5, base - h * 0.3, cx - w * 0.2, base - h * 0.95, cx - w * 0.08, base - h);
    x.lineTo(cx + w * 0.06, base - h * 0.97);
    x.bezierCurveTo(cx + w * 0.22, base - h * 0.9, cx + w * 0.55, base - h * 0.28, cx + w, base);
    x.lineTo(cx + w, base + 400); x.lineTo(cx - w, base + 400);
    x.closePath(); x.fillStyle = colour; x.fill();
  }

  function skyline(x, seed, base, minH, maxH, colour, lit, litColour) {
    var r = rng(seed), px = -600, wins = [];
    x.fillStyle = colour;
    while (px < DW + 600) {
      var w = 50 + r() * 110, h = minH + Math.pow(r(), 1.6) * (maxH - minH);
      x.fillRect(px, base - h, w + 1, h + 400);
      if (r() < 0.25) x.fillRect(px + w * 0.35, base - h - 22, w * 0.12, 22);
      for (var wy = base - h + 14; wy < base - 12; wy += 18) {
        for (var wx = px + 8; wx < px + w - 10; wx += 15) if (r() < lit) wins.push([wx, wy]);
      }
      px += w;
    }
    if (litColour) { x.fillStyle = litColour; wins.forEach(function (p) { x.fillRect(p[0], p[1], 5, 7); }); }
  }

  /* low houses with pitched corrugated roofs: the neighbourhood */
  function houses(x, seed, base, colour, lit, litColour) {
    var r = rng(seed), px = -600, wins = [];
    x.fillStyle = colour;
    while (px < DW + 600) {
      var w = 120 + r() * 160, h = 50 + r() * 50, roof = 30 + r() * 30;
      x.beginPath(); x.moveTo(px, base - h); x.lineTo(px + w * 0.5, base - h - roof); x.lineTo(px + w, base - h);
      x.lineTo(px + w, base + 400); x.lineTo(px, base + 400); x.closePath(); x.fill();
      if (r() < lit) wins.push([px + w * 0.3, base - h * 0.6]);
      px += w - 4;
    }
    if (litColour) { x.fillStyle = litColour; wins.forEach(function (p) { x.fillRect(p[0], p[1], 22, 18); }); }
  }

  function palm(x, px, py, h, lean, colour) {
    x.strokeStyle = colour; x.fillStyle = colour; x.lineCap = 'round';
    x.lineWidth = h * 0.045;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + lean * 0.4, py - h * 0.55, px + lean, py - h); x.stroke();
    var tx = px + lean, ty = py - h;
    for (var i = 0; i < 8; i++) {
      var a = -Math.PI * 0.95 + i / 7 * Math.PI * 0.9 + (i % 2 ? 0.08 : -0.05);
      var l = h * (0.42 + (i % 3) * 0.05);
      var ex = tx + Math.cos(a) * l, ey = ty + Math.sin(a) * l * 0.5 + l * 0.27;
      var mx = tx + Math.cos(a) * l * 0.55, my = ty + Math.sin(a) * l * 0.55 - l * 0.12;
      x.beginPath(); x.moveTo(tx, ty);
      x.quadraticCurveTo(mx, my - h * 0.03, ex, ey);
      x.quadraticCurveTo(mx, my + h * 0.05, tx, ty + h * 0.02);
      x.fill();
    }
    x.lineCap = 'butt';
  }

  function tree(x, px, py, r, colour) {
    x.fillStyle = colour;
    x.fillRect(px - r * 0.07, py - r * 0.9, r * 0.14, r * 0.9);
    K.blob(x, px, py - r * 1.25, r, 0.3, rng(Math.round(px)), 11, 0.62); x.fill();
  }

  function church(x, cx, base, s, colour) {
    x.fillStyle = colour;
    x.fillRect(cx - 34 * s, base - 300 * s, 68 * s, 300 * s);
    x.beginPath(); x.moveTo(cx - 42 * s, base - 300 * s); x.lineTo(cx, base - 380 * s); x.lineTo(cx + 42 * s, base - 300 * s); x.fill();
    x.fillRect(cx - 3 * s, base - 420 * s, 6 * s, 44 * s); x.fillRect(cx - 14 * s, base - 408 * s, 28 * s, 6 * s);
    x.fillRect(cx - 150 * s, base - 150 * s, 300 * s, 150 * s);
  }

  function wires(x, y, colour) {
    x.strokeStyle = colour; x.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      x.beginPath(); x.moveTo(-600, y + i * 14);
      x.quadraticCurveTo(DW / 2, y + 70 + i * 16, DW + 600, y - 16 + i * 12); x.stroke();
    }
  }

  /* ---- the things that recur ----------------------------------------- */

  /* the visitors' craft: two flat hull tones, flat glass, cyan lights */
  function craft(x, t, glowK) {
    var e = glowK === undefined ? 0.4 : glowK;
    x.save(); x.globalCompositeOperation = 'lighter';
    x.fillStyle = rad(x, 0, 52, 0, 150, [[0, 'rgba(' + CYAN + ',' + (0.2 + 0.55 * e) + ')'], [1, 'rgba(' + CYAN + ',0)']]);
    x.fillRect(-150, -98, 300, 300);
    x.restore();
    ell(x, 0, 12, 360, 54); x.fillStyle = '#5f7682'; x.fill();
    ell(x, 0, 0, 360, 46); x.fillStyle = '#c9d6dc'; x.fill();
    ell(x, 0, -4, 360, 42, Math.PI, Math.PI * 2); x.fillStyle = '#dde7eb'; x.fill();
    ell(x, 0, 50, 92, 13); x.fillStyle = 'rgba(210,255,255,' + (0.4 + 0.6 * e) + ')'; x.fill();
    x.beginPath(); x.ellipse(0, -26, 140, 118, 0, Math.PI, 0); x.closePath();
    x.fillStyle = '#5fb8c9'; x.fill();
    x.beginPath(); x.ellipse(0, -26, 140, 118, 0, Math.PI, Math.PI * 1.5); x.lineTo(0, -26); x.closePath();
    x.fillStyle = '#86cfdc'; x.fill();
    x.beginPath(); x.ellipse(-8, -30, 104, 88, 0, Math.PI * 1.15, Math.PI * 1.38);
    x.lineWidth = 9; x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.7)'; x.stroke(); x.lineCap = 'butt';
    ell(x, 0, -26, 146, 18); x.fillStyle = '#9db1bb'; x.fill();
    x.save(); x.globalCompositeOperation = 'lighter';
    for (var l = 0; l < 7; l++) {
      var a = Math.PI * (0.16 + l / 6 * 0.68), lx = Math.cos(a) * 352, ly = Math.sin(a) * 50 + 4;
      var pu = 0.5 + 0.5 * Math.sin(t * 2.4 - l * 0.55);
      x.fillStyle = 'rgba(220,255,255,' + (0.6 + 0.4 * pu) + ')';
      x.beginPath(); x.arc(lx, ly, 6, 0, 7); x.fill();
      glow(x, lx, ly, 22, CYAN, 0.35 * pu);
    }
    x.restore();
  }
  function craftGlow(since) { return since > -0.9 ? Math.min(1, 0.4 + (since + 0.9) / 0.9 * 0.6) : 0.4; }

  var cones = {};
  function coneSheet(len, wTop, wBot) {
    var dpr = D.cine.dpr || 1, key = [len, wTop, wBot, dpr].join(':');
    if (cones[key]) return cones[key];
    var pad = 40, Wd = wBot * 2 + pad * 2, s = Math.min(1.1 * dpr, 2048 / Math.max(Wd, len + pad));
    var c = K.off(Wd * s, (len + pad) * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(Wd / 2, 0);
    function cone(a, b, alpha, blur) {
      x.save(); if ('filter' in x) x.filter = 'blur(' + blur + 'px)';
      x.beginPath(); x.moveTo(-a, 0); x.lineTo(-b, len); x.lineTo(b, len); x.lineTo(a, 0); x.closePath();
      x.fillStyle = 'rgba(' + CYAN + ',' + alpha + ')'; x.fill(); x.restore();
    }
    cone(wTop, wBot, 0.2, 6);
    cone(wTop * 0.55, wBot * 0.55, 0.22, 6);
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = lin(x, 0, 0, 0, len, [[0, 'rgba(0,0,0,1)'], [0.8, 'rgba(0,0,0,.75)'], [1, 'rgba(0,0,0,.35)']]);
    x.fillRect(-Wd / 2, 0, Wd, len + pad);
    cones[key] = { c: c, Wd: Wd, H: len + pad };
    return cones[key];
  }
  function easeOut(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }
  function beam(x, since, len, wTop, wBot) {
    if (since <= 0) return;
    var rm = D.cine.reduced && D.cine.reduced();
    var open = rm ? 1 : easeOut(since / 1.4), reach = len * open, top = 52;
    var sh = coneSheet(len, wTop, wBot);
    x.save(); x.globalCompositeOperation = 'lighter';
    x.globalAlpha = Math.min(1, open * 1.5);
    x.beginPath(); x.rect(-sh.Wd / 2, top, sh.Wd, reach); x.clip();
    x.drawImage(sh.c, -sh.Wd / 2, top, sh.Wd, sh.H);
    x.restore();
    x.save(); x.globalCompositeOperation = 'lighter';
    var land = Math.max(0, (open - 0.8) / 0.2);
    if (land > 0) {
      ell(x, 0, top + len, wBot * 1.05, wBot * 0.16);
      x.fillStyle = 'rgba(' + CYAN + ',' + (0.16 * land * (0.85 + 0.15 * Math.sin(since * 1.8))) + ')'; x.fill();
      ell(x, 0, top + len, wBot * 0.6, wBot * 0.09);
      x.fillStyle = 'rgba(220,255,255,' + 0.14 * land + ')'; x.fill();
    }
    if (!rm && since > 1.6) {
      var ph = ((since - 1.6) / 2.6) % 1, yy = top + ph * len, ww = wTop + (wBot - wTop) * ph;
      ell(x, 0, yy, ww * 0.9, ww * 0.13);
      x.lineWidth = 22; x.strokeStyle = 'rgba(' + CYAN + ',' + 0.1 * Math.sin(ph * Math.PI) + ')'; x.stroke();
    }
    x.restore();
  }
  function prebake(len, wide) { if (len) coneSheet(len, 84, wide); }

  /* moving like a thing with weight: decelerate into place, lean into the
     speed, bob once still; or gather speed to leave */
  function path(t, from, to, dur, leaving) {
    function pos(tt) {
      var k = Math.max(0, Math.min(1, tt / dur));
      var e = leaving ? k * k * k : 1 - Math.pow(1 - k, 4);
      return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e];
    }
    var a = pos(t), b = pos(t + 1 / 60);
    var still = leaving ? 1 - Math.max(0, Math.min(1, t / 1.5)) : Math.max(0, Math.min(1, (t - dur * 0.7) / (dur * 0.4)));
    return { x: a[0], y: a[1] + Math.sin(t * 1.3) * 5 * still, s: a[2],
             tilt: Math.max(-0.14, Math.min(0.14, (b[0] - a[0]) * 60 * 0.00012)) + Math.sin(t * 0.9) * 0.01 * still };
  }

  function drawCraft(x, c, t, beamAt, len, wide) {
    x.save(); x.translate(c.x, c.y); x.rotate(c.tilt); x.scale(c.s, c.s);
    var since = beamAt === undefined ? -9 : t - beamAt;
    if (len) beam(x, since, len, 84, wide || 400);
    craft(x, t, craftGlow(since));
    x.restore();
  }

  /* the device, two flat tones and its lit clock */
  function device(x, cx, cy, s, t, state) {
    var on = state === 'wake' ? Math.max(0, Math.min(1, (t - 0.8) / 0.6)) : state === 'dark' ? 0 : 1;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 0, 38, 118, 10); x.fill();
    x.fillStyle = '#1b2329'; x.fillRect(-100, -34, 200, 70);
    x.fillStyle = '#2f3d45'; x.fillRect(-100, -34, 200, 12);
    x.fillStyle = '#05090b'; x.fillRect(-62, -20, 84, 26);
    if (on > 0) {
      x.font = '22px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(' + AMBER + ',' + on + ')';
      var sec = Math.max(0, 299 - Math.floor(t));
      x.fillText('0' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2), -20, -6);
      glow(x, -20, -6, 120, AMBER, 0.4 * on);
      x.fillStyle = 'rgba(' + CYAN + ',' + on + ')'; x.fillRect(40, -16, 30, 8);
    }
    x.restore();
  }

  function person(x, px, py, s, pose, fill, rim, opts) {
    opts = opts || {};
    K.student(x, px, py, s, pose, { face: opts.face, skirt: opts.skirt, bag: opts.bag, t: opts.t,
      fill: fill, rim: rim, light: opts.light });
  }

  /* one baked sheet per scene variant: everything that never moves */
  function sheet(key, W, H, draw) {
    return K.cached(key, W, H, function () {
      return K.bake(W, H, DW + 1200, DH + 800, function (x) { x.translate(600, 400); draw(x); }, 1.1);
    });
  }
  function stampSheet(x, s) { K.stamp(x, s, -600, -400); }

  /* ---- the world --------------------------------------------------------
     A flat disc: ocean, land, cloud, a flat night side with the cities lit
     in it, a thin bright limb and the glow of air around it. */
  var R = 760;
  var SITES = (function () {
    var r = rng(404), s = [];
    while (s.length < 46) { var a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.86; s.push([Math.cos(a) * d * R, Math.sin(a) * d * R, r()]); }
    return s;
  })();
  function globeArt(W, H, night) {
    return K.cached('flat-globe:' + night, W, H, function () {
      return K.bake(W, H, 1900, 1900, function (x) {
        var c = 950, r = rng(11);
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = rad(x, c, c, R, R + 110, [[0, 'rgba(110,190,255,.5)'], [1, 'rgba(110,190,255,0)']]);
        x.fillRect(0, 0, 1900, 1900);
        x.restore();
        x.beginPath(); x.arc(c, c, R + 9, 0, 7); x.fillStyle = '#86cdf2'; x.fill();
        x.save(); x.beginPath(); x.arc(c, c, R, 0, 7); x.clip();
        x.fillStyle = '#2d6ea8'; x.fillRect(0, 0, 1900, 1900);
        x.fillStyle = '#3f8a5c';
        [[660, 720, 260], [920, 1000, 220], [1200, 660, 170], [1280, 1180, 200], [520, 1180, 150], [1000, 520, 110]].forEach(function (L, k) {
          K.blob(x, L[0], L[1], L[2], 0.5, rng(30 + k), 13); x.fill();
        });
        x.fillStyle = '#d7c48a';
        [[700, 760, 80], [1240, 700, 60], [1300, 1200, 70]].forEach(function (L, k) { K.blob(x, L[0], L[1], L[2], 0.5, rng(60 + k), 9); x.fill(); });
        x.fillStyle = 'rgba(255,255,255,.75)';
        for (var i = 0; i < 18; i++) {
          x.save(); x.translate(220 + r() * 1460, 240 + r() * 1420); x.rotate(r() * 0.5 - 0.25); x.scale(2.6, 0.55);
          K.blob(x, 0, 0, 30 + r() * 50, 0.6, r, 9); x.fill(); x.restore();
        }
        /* the night side: one flat shape */
        x.fillStyle = night ? 'rgba(6,14,32,.9)' : 'rgba(6,14,32,.78)';
        x.beginPath(); x.arc(c, c, R, 0, 7);
        if (!night) {
          /* the lit side, cut out of the dark: start the cut at its own first
             point, or the two outlines get joined by a stray straight edge */
          var ex = c - R * 0.28, ey = c - R * 0.1, er = -0.25;
          x.moveTo(ex + R * 0.92 * Math.cos(er), ey + R * 0.92 * Math.sin(er));
          x.ellipse(ex, ey, R * 0.92, R * 1.02, er, 0, Math.PI * 2, true);
        }
        x.fill('evenodd');
        /* city lights, only in the dark */
        var lr = rng(5);
        for (i = 0; i < (night ? 700 : 240); i++) {
          var lx = c + (night ? -700 : 120) + lr() * (night ? 1400 : 560), ly = c - 600 + lr() * 1200;
          if (Math.hypot(lx - c, ly - c) > R - 16) continue;
          x.fillStyle = 'rgba(' + AMBER + ',' + (0.4 + lr() * 0.5) + ')';
          x.fillRect(lx, ly, 2.4, 2.4);
        }
        x.restore();
      }, 0.95);
    });
  }

  K.register('globe', {
    prepare: function (W, H, p) {
      return {
        sky: sheet('flat-space', W, H, function (x) { sky(x, PAL.space); stars(x, 600, 7, 900); }),
        art: globeArt(W, H, !!p.night)
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0.04, function (x) { stampSheet(x, st.sky); });
      var sc = p.scale || 0.46, gx = p.x === undefined ? 960 : p.x, gy = p.y === undefined ? 470 : p.y;
      K.layer(g, W, H, cam, 0.5, function (x) {
        if (p.sun) {
          var sx = gx - R * sc * 1.02, sy = gy - R * sc * 0.36;
          glow(x, sx, sy, 300 * sc * 1.6, '255,232,190', 0.85);
          x.fillStyle = '#fff6e0'; x.beginPath(); x.arc(sx, sy, 22, 0, 7); x.fill();
        }
        x.save(); x.translate(gx, gy); x.rotate(-0.1 + t * 0.003); x.scale(sc, sc);
        K.stamp(x, st.art, -950, -950, 1900, 1900);
        var dur = p.dur || 8;
        SITES.forEach(function (s, i) {
          var lit = 0;
          if (p.falling) lit = Math.max(0, Math.min(1, (t - 0.6 - s[2] * dur * 0.6) / 0.5));
          if (p.points) lit = 1;
          if (p.dimming) lit = 1 - Math.max(0, Math.min(1, (t - 1 - s[2] * dur * 0.7) / 0.6));
          if (lit <= 0) return;
          var pu = 0.75 + 0.25 * Math.sin(t * 2.5 + i);
          glow(x, s[0], s[1], 26, CYAN, 0.8 * lit * pu);
          x.fillStyle = 'rgba(220,255,255,' + lit + ')'; x.beginPath(); x.arc(s[0], s[1], 4.5, 0, 7); x.fill();
        });
        if (p.falling) {
          SITES.forEach(function (s) {
            var k = (t - (0.6 + s[2] * dur * 0.6 - 0.9)) / 0.9;
            if (k < 0 || k > 1) return;
            var e = 1 - Math.pow(1 - k, 2), fx = s[0] - 200 * (1 - e), fy = s[1] - 420 * (1 - e);
            x.save(); x.globalCompositeOperation = 'lighter';
            x.strokeStyle = lin(x, fx - 70, fy - 150, fx, fy, [[0, 'rgba(' + CYAN + ',0)'], [1, 'rgba(220,255,255,.9)']]);
            x.lineWidth = 5; x.lineCap = 'round';
            x.beginPath(); x.moveTo(fx - 70, fy - 150); x.lineTo(fx, fy); x.stroke(); x.restore();
          });
        }
        x.restore();
      });
    }
  });

  /* ---- the horizon and the craft ---------------------------------------- */
  var ARRIVAL_BEAM = 560;
  K.register('arrival', {
    prepare: function (W, H, p) {
      if (p.beamAt !== undefined) prebake(ARRIVAL_BEAM, 380);
      return {
        bg: sheet('flat-horizon', W, H, function (x) {
          sky(x, PAL.space); stars(x, 520, 9, 600);
          var HR = 3400, hx = DW / 2, hy = 640 + HR;
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = rad(x, hx, hy, HR, HR + 150, [[0, 'rgba(110,190,255,.45)'], [1, 'rgba(110,190,255,0)']]);
          x.fillRect(-600, 300, DW + 1200, 600); x.restore();
          x.beginPath(); x.arc(hx, hy, HR + 10, 0, 7); x.fillStyle = '#7cc4ef'; x.fill();
          x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.fillStyle = '#2d6ea8'; x.fill();
          x.save(); x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.clip();
          x.fillStyle = '#3f8a5c';
          [[200, 660, 360], [980, 650, 300], [1500, 700, 260]].forEach(function (L, k) { K.blob(x, L[0], L[1], L[2], 0.35, rng(20 + k), 9, 0.16); x.fill(); });
          x.fillStyle = 'rgba(255,255,255,.55)';
          [[420, 672, 160], [1260, 662, 220], [760, 700, 120]].forEach(function (c2, k) { K.blob(x, c2[0], c2[1], c2[2], 0.4, rng(40 + k), 8, 0.08); x.fill(); });
          x.restore();
        })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0.05, function (x) { stampSheet(x, st.bg); });
      K.layer(g, W, H, cam, 0.7, function (x) {
        var settle = p.x === undefined ? 800 : p.x, c;
        if (p.enter) c = path(t, [-460, 140, 0.5], [settle, 250, 0.62], 6.2, false);
        else if (p.leave) c = path(Math.max(0, t - 1.2), [settle, 250, 0.62], [settle + 1700, 60, 0.24], 7.5, true);
        else c = path(t, [settle, 250, 0.62], [settle, 250, 0.62], 1, false);
        drawCraft(x, c, t, p.beamAt, p.beamAt !== undefined ? ARRIVAL_BEAM : 0, 380);
      });
    }
  });

  K.register('constellation', {
    prepare: function (W, H) { return { sky: sheet('flat-space', W, H, function (x) { sky(x, PAL.space); stars(x, 600, 7, 900); }) }; },
    draw: function (g, t, cam, st, W, H) {
      K.layer(g, W, H, cam, 0.04, function (x) { stampSheet(x, st.sky); });
      K.layer(g, W, H, cam, 0.3, function (x) {
        var figs = [{ pts: [[480, 560], [660, 560], [570, 404]], at: 0.8 }, { circle: [800, 480, 92], at: 2.2 },
                    { pts: [[968, 396], [1132, 396], [1132, 560], [968, 560]], at: 3.6 }];
        x.save(); x.globalCompositeOperation = 'lighter';
        figs.forEach(function (f) {
          var k = easeOut((t - f.at) / 1.6);
          if (k <= 0) return;
          x.strokeStyle = 'rgba(' + CYAN + ',' + 0.9 * k + ')'; x.lineWidth = 3; x.lineCap = 'round';
          if (f.circle) {
            x.beginPath(); x.arc(f.circle[0], f.circle[1], f.circle[2], -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke();
          } else {
            var n = f.pts.length, prog = k * n;
            x.beginPath(); x.moveTo(f.pts[0][0], f.pts[0][1]);
            for (var i = 1; i <= n; i++) {
              var a = f.pts[i - 1], b = f.pts[i % n], kk = Math.max(0, Math.min(1, prog - (i - 1)));
              if (kk <= 0) break;
              x.lineTo(a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk);
            }
            x.stroke();
            f.pts.forEach(function (q) { x.fillStyle = 'rgba(230,255,255,' + k + ')'; x.beginPath(); x.arc(q[0], q[1], 4, 0, 7); x.fill(); glow(x, q[0], q[1], 22, CYAN, 0.5 * k); });
          }
        });
        x.restore();
      });
    }
  });

  K.register('point', {
    prepare: function (W, H) { return { sky: sheet('flat-space', W, H, function (x) { sky(x, PAL.space); stars(x, 600, 7, 900); }) }; },
    draw: function (g, t, cam, st, W, H) {
      g.save(); g.globalAlpha = 0.45; K.layer(g, W, H, cam, 0.04, function (x) { stampSheet(x, st.sky); }); g.restore();
      K.layer(g, W, H, cam, 0.4, function (x) {
        var k = easeOut(t / 1.4);
        glow(x, 800, 450, 40 + 220 * k, AMBER, 0.85 * (1 - k * 0.6));
        var d = Math.max(0, Math.min(1, (t - 1.2) / 1.2));
        if (d > 0) {
          x.save(); x.globalAlpha = d;
          x.font = '150px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = 'rgba(' + AMBER + ',.08)'; x.fillText('88:88', 800, 460);
          x.fillStyle = 'rgb(' + AMBER + ')'; x.fillText('00:00', 800, 460);
          x.restore();
          glow(x, 800, 460, 340, AMBER, 0.25 * d);
        }
      });
    }
  });

  K.register('credits-sky', {
    prepare: function (W, H) {
      return { bg: sheet('flat-credits', W, H, function (x) {
        sky(x, PAL.space); stars(x, 520, 13, 700);
        var HR = 3000, hx = DW / 2, hy = 720 + HR;
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = rad(x, hx, hy, HR, HR + 160, [[0, 'rgba(255,200,150,.5)'], [1, 'rgba(110,170,255,0)']]);
        x.fillRect(-600, 200, DW + 1200, 700); x.restore();
        x.beginPath(); x.arc(hx, hy, HR + 8, 0, 7); x.fillStyle = '#ffd3a8'; x.fill();
        x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.fillStyle = '#163a66'; x.fill();
      }) };
    },
    draw: function (g, t, cam, st, W, H) { K.layer(g, W, H, cam, 0.1, function (x) { stampSheet(x, st.bg); }); }
  });

  /* ---- the city at night (prologue) -------------------------------------- */
  K.register('city-night', {
    prepare: function (W, H) {
      var pal = PAL.night;
      return {
        far: sheet('flat-city-far', W, H, function (x) {
          sky(x, pal); stars(x, 300, 41, 520);
          glow(x, 1260, 150, 90, '230,238,255', 0.35);
          x.fillStyle = pal.light; x.beginPath(); x.arc(1260, 150, 20, 0, 7); x.fill();
          volcano(x, 560, 640, 760, 360, tint(pal, null, 0.05));
          ridge(x, 4, 650, 50, tint(pal, null, 0.15));
        }),
        mid: sheet('flat-city-mid', W, H, function (x) {
          skyline(x, 7, 700, 60, 220, tint(pal, null, 0.4), 0.45, 'rgba(' + AMBER + ',.8)');
          church(x, 1100, 700, 0.85, tint(pal, null, 0.4));
          palm(x, 140, 742, 200, 30, tint(pal, null, 0.6)); palm(x, 1420, 742, 240, -40, tint(pal, null, 0.6));
          x.fillStyle = tint(pal, null, 0.65); x.fillRect(-600, 742, DW + 1200, 400);
          var r = rng(3);
          for (var i = 0; i < 90; i++) { x.fillStyle = 'rgba(' + AMBER + ',' + (0.1 + r() * 0.25) + ')'; x.fillRect(-600 + r() * (DW + 1200), 750 + r() * 120, 12 + r() * 40, 2); }
        }),
        near: sheet('flat-city-near', W, H, function (x) {
          houses(x, 12, 820, tint(pal, null, 1), 0.5, 'rgba(' + AMBER + ',.75)');
          wires(x, 640, tint(pal, null, 1));
        })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0.04, function (x) { stampSheet(x, st.far); });
      K.layer(g, W, H, cam, 0.25, function (x) {
        stampSheet(x, st.mid);
        if (Math.sin(t * 3) > 0) glow(x, 380, 400, 22, '255,80,60', 0.9);
      });
      if (p.streak) K.layer(g, W, H, cam, 0.5, function (x) {
        var k = (t - 1.4) / 1.1, lx = 980, ly = 790;
        if (k > 0 && k < 1) {
          var e = k * k, fx = lx + 260 * (1 - e), fy = ly - 760 * (1 - e);
          x.save(); x.globalCompositeOperation = 'lighter';
          x.strokeStyle = lin(x, fx + 100, fy - 280, fx, fy, [[0, 'rgba(' + CYAN + ',0)'], [1, 'rgba(230,255,255,.95)']]);
          x.lineWidth = 6; x.lineCap = 'round';
          x.beginPath(); x.moveTo(fx + 100, fy - 280); x.lineTo(fx, fy); x.stroke(); x.restore();
        }
        if (k >= 1) glow(x, lx, ly, 130, CYAN, 0.45 * (0.7 + 0.3 * Math.sin(t * 3)));
      });
      K.layer(g, W, H, cam, 0.8, function (x) { stampSheet(x, st.near); });
    }
  });

  /* ---- the school, morning, the flag going up ---------------------------- */
  function flag(x, px, top, w, h, t) {
    for (var i = 0; i < 16; i++) {
      var u0 = i / 16, u1 = (i + 1) / 16;
      var wv = function (u) { return Math.sin(u * 6 - t * 3.5) * 6 * u; };
      var x0 = px + u0 * w, x1 = px + u1 * w;
      x.fillStyle = '#1c3f9a'; x.beginPath(); x.moveTo(x0, top + wv(u0)); x.lineTo(x1, top + wv(u1)); x.lineTo(x1, top + h / 2 + wv(u1)); x.lineTo(x0, top + h / 2 + wv(u0)); x.fill();
      x.fillStyle = '#c8302c'; x.beginPath(); x.moveTo(x0, top + h / 2 + wv(u0)); x.lineTo(x1, top + h / 2 + wv(u1)); x.lineTo(x1, top + h + wv(u1)); x.lineTo(x0, top + h + wv(u0)); x.fill();
    }
    x.fillStyle = '#f6f2e6'; x.beginPath(); x.moveTo(px, top); x.lineTo(px + w * 0.42, top + h / 2 + Math.sin(0.42 * 6 - t * 3.5) * 6 * 0.42); x.lineTo(px, top + h); x.closePath(); x.fill();
    x.fillStyle = '#f2c230'; x.beginPath(); x.arc(px + w * 0.15, top + h / 2, h * 0.11, 0, 7); x.fill();
  }
  K.register('school', {
    prepare: function (W, H) {
      var pal = PAL.morning;
      return {
        far: sheet('flat-school-far', W, H, function (x) {
          sky(x, pal);
          glow(x, 1300, 220, 260, '255,240,200', 0.45);
          x.fillStyle = '#fff6df'; x.beginPath(); x.arc(1300, 220, 34, 0, 7); x.fill();
          volcano(x, 1180, 470, 620, 280, tint(pal, null, 0.05));
          for (var i = 0; i < 8; i++) tree(x, 60 + i * 210 + (i % 2) * 40, 460, 70 + (i % 3) * 18, tint(pal, '#3f7d4a', 0.3));
        }),
        mid: sheet('flat-school-mid', W, H, function (x) {
          var L = 170, Rr = 1430, top = 330, mid = 470, bot = 620;
          var wall = tint(pal, '#efe4c8', 0.6), trim = tint(pal, '#2f5a40', 0.6), glass = tint(pal, '#8fb6c6', 0.6);
          x.fillStyle = trim;
          x.beginPath(); x.moveTo(L - 40, top + 8); x.lineTo(L + 30, top - 34); x.lineTo(Rr - 30, top - 34); x.lineTo(Rr + 40, top + 8); x.closePath(); x.fill();
          x.fillStyle = wall; x.fillRect(L, top, Rr - L, bot - top);
          [top + 20, mid].forEach(function (fy) {
            for (var c = 0; c < 8; c++) {
              var cx = L + 40 + c * 158;
              x.fillStyle = trim; x.fillRect(cx, fy + 26, 44, 100);
              x.fillStyle = glass; x.fillRect(cx + 60, fy + 34, 80, 56);
            }
            x.fillStyle = trim; x.fillRect(L, fy + 120, Rr - L, 8);
            for (var rx = L; rx < Rr; rx += 22) x.fillRect(rx, fy + 92, 4, 30);
            x.fillRect(L, fy + 90, Rr - L, 5);
          });
          x.fillStyle = tint(pal, '#9aa98a', 0.85); x.fillRect(-600, 620, DW + 1200, 400);
          x.fillStyle = tint(pal, '#c9c3b2', 0.9); x.fillRect(700, 700, 200, 20);
        })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var pal = PAL.morning;
      K.layer(g, W, H, cam, 0.06, function (x) { stampSheet(x, st.far); });
      K.layer(g, W, H, cam, 0.35, function (x) { stampSheet(x, st.mid); });
      K.layer(g, W, H, cam, 0.6, function (x) {
        x.fillStyle = tint(pal, '#e9e6dc', 0.9); x.fillRect(796, 260, 8, 450);
        var k = p.flag ? Math.min(1, t / 7) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        flag(x, 804, 640 - 360 * e, 120, 72, t);
        var fill = tint(pal, null, 0.9);
        for (var s = 0; s < 14; s++) {
          person(x, 300 + s * 34 + (s > 6 ? 520 : 0), 790 + (s % 2) * 18, 0.18, 'stand', fill, 'rgba(255,240,210,0)',
            { skirt: s % 3 === 0, face: s > 6 ? -1 : 1 });
        }
      });
    }
  });

  /* ---- the classroom -----------------------------------------------------
     params: people ('meet' | 'none'), device ('wake' | 'dark'), rain,
     light ('morning' | 'dusk' | 'night'), skyLight */
  var ROOM = {
    morning: { pal: PAL.morning, outside: PAL.morning, lamp: 0.0 },
    dusk:    { pal: PAL.dawn, outside: PAL.dawn, lamp: 0.0 },
    night:   { pal: PAL.night, outside: PAL.night, lamp: 0.0 }
  };
  K.register('classroom', {
    prepare: function (W, H, p) {
      var R0 = ROOM[p.light || 'morning'], pal = R0.pal, key = 'flat-room:' + (p.light || 'morning');
      return {
        wall: sheet(key, W, H, function (x) {
          x.fillStyle = tint(pal, '#e9dfc6', 0.55); x.fillRect(-600, -400, DW + 1200, DH + 800);
          for (var w = 0; w < 2; w++) {
            var wx = 1080 + w * 220, wy = 150;
            x.fillStyle = lin(x, 0, wy, 0, wy + 260, [[0, R0.outside.top], [1, R0.outside.hor]]);
            x.fillRect(wx, wy, 180, 260);
            if ((p.light || 'morning') !== 'morning') volcano(x, wx + 120 - w * 220, wy + 260, 260, 110, tint(R0.outside, null, 0.1));
          }
          x.fillStyle = tint(pal, '#6b5038', 0.6); x.fillRect(250, 120, 700, 330);
          x.fillStyle = tint(pal, '#2f4f3e', 0.6); x.fillRect(266, 136, 668, 298);
          x.fillStyle = 'rgba(235,240,230,' + (p.light === 'night' ? 0.25 : 0.5) + ')';
          x.font = '30px "Plex Mono", monospace';
          x.fillText('x² + 2x − 8 = 0', 300, 200); x.fillText('∠A + ∠B = 90°', 300, 260);
          x.strokeStyle = x.fillStyle; x.lineWidth = 3; x.beginPath(); x.moveTo(700, 380); x.lineTo(860, 380); x.lineTo(700, 220); x.closePath(); x.stroke();
          x.fillStyle = p.light === 'night' ? tint(pal, '#1c2230', 0.6) : tint(pal, '#fff3da', 0.6); x.fillRect(40, 200, 130, 300);
          x.fillStyle = tint(pal, '#9c7a56', 0.8); x.fillRect(-600, 500, DW + 1200, 500);
          x.fillStyle = tint(pal, '#6d4b30', 0.85); x.fillRect(520, 520, 520, 40);
          x.fillRect(540, 560, 20, 150); x.fillRect(1000, 560, 20, 150);
        }),
        pal: pal
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var pal = st.pal;
      K.layer(g, W, H, cam, 0.15, function (x) {
        stampSheet(x, st.wall);
        for (var w = 0; w < 2; w++) {
          var wx = 1080 + w * 220, wy = 150;
          if (p.skyLight && w === 1) glow(x, wx + 110, wy + 70, 46, CYAN, 0.9 * Math.max(0, Math.sin(t * 2.2)) * Math.min(1, t / 2));
          if (p.rain) {
            x.save(); x.beginPath(); x.rect(wx, wy, 180, 260); x.clip();
            K.rain(x, t, p.rain, 0.06, false, [wx, wy - 40, 180, 340]); x.restore();
          }
          x.fillStyle = tint(pal, '#3a4a44', 0.6);
          x.fillRect(wx - 4, wy - 4, 188, 8); x.fillRect(wx - 4, wy + 256, 188, 8);
          x.fillRect(wx - 4, wy, 8, 260); x.fillRect(wx + 176, wy, 8, 260); x.fillRect(wx + 87, wy, 6, 260);
        }
        if (p.light !== 'morning') {
          x.fillStyle = 'rgba(5,8,20,' + (p.light === 'night' ? 0.45 : 0.2) + ')'; x.fillRect(-600, -400, DW + 1200, DH + 800);
        } else {
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = 'rgba(255,236,190,.12)';
          x.beginPath(); x.moveTo(1080, 150); x.lineTo(1480, 150); x.lineTo(1100, 900); x.lineTo(420, 900); x.closePath(); x.fill();
          x.restore();
        }
        var dev = p.device || (p.people === 'meet' ? 'lit' : null);
        if (dev) device(x, 780, 492, 0.9, t, dev);
      });
      var near = tint(pal, null, 1);
      if (p.people === 'meet') K.layer(g, W, H, cam, 0.5, function (x) {
        person(x, 640, 760, 0.95, 'stand', near, 'rgba(255,220,150,.8)', { bag: true, light: [1, -0.5] });
        person(x, 120, 720, 0.82, 'binder', near, 'rgba(255,240,210,.85)', { skirt: true, light: [-1, -0.5] });
      });
      K.layer(g, W, H, cam, 0.85, function (x) {
        x.fillStyle = near;
        for (var c = 0; c < 4; c++) {
          var cx = 120 + c * 420;
          x.fillRect(cx, 780, 220, 26); x.fillRect(cx + 10, 640, 16, 250); x.fillRect(cx + 190, 700, 14, 200); x.fillRect(cx + 10, 640, 120, 18);
        }
      });
    }
  });

  /* ---- two people, apart --------------------------------------------------- */
  K.register('apart', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H) {
      var pal = PAL.room;
      K.layer(g, W, H, cam, 0, function (x) { sky(x, pal); });
      K.layer(g, W, H, cam, 0.3, function (x) {
        [[420, CYAN], [1180, AMBER]].forEach(function (s) {
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = 'rgba(' + s[1] + ',.07)';
          x.beginPath(); x.moveTo(s[0] - 60, -100); x.lineTo(s[0] + 60, -100); x.lineTo(s[0] + 250, 840); x.lineTo(s[0] - 250, 840); x.fill();
          ell(x, s[0], 838, 250, 28); x.fillStyle = 'rgba(' + s[1] + ',.16)'; x.fill();
          x.restore();
        });
        x.fillStyle = pal.near; x.fillRect(-600, 838, DW + 1200, 300);
      });
      K.layer(g, W, H, cam, 0.5, function (x) {
        person(x, 400, 838, 1.25, 'device', PAL.room.near, 'rgba(' + CYAN + ',.9)', { bag: true, light: [0.4, -1] });
        person(x, 1200, 838, 1.25, 'binder', PAL.room.near, 'rgba(' + AMBER + ',.9)', { skirt: true, face: -1, light: [-0.4, -1] });
        x.save(); x.setLineDash([6, 18]); x.lineDashOffset = -t * 30;
        x.strokeStyle = 'rgba(200,220,230,' + Math.min(0.55, t / 2) + ')'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(520, 560); x.lineTo(1080, 560); x.stroke(); x.restore();
      });
    }
  });

  /* ---- the device, close ------------------------------------------------- */
  K.register('device', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H, p) {
      var pal = PAL.room;
      K.layer(g, W, H, cam, 0, function (x) { sky(x, pal); });
      K.layer(g, W, H, cam, 0.5, function (x) {
        var on = function (d) { return p.wake ? Math.max(0, Math.min(1, (t - d) / 0.4)) : 1; };
        x.fillStyle = pal.near; x.fillRect(-600, 660, DW + 1200, 500);
        x.fillStyle = 'rgba(0,0,0,.45)'; ell(x, 800, 690, 520, 34); x.fill();
        /* two tones: the case's lit top band, its body */
        x.fillStyle = '#26323a'; x.fillRect(330, 230, 940, 450);
        x.fillStyle = '#3a4952'; x.fillRect(330, 230, 940, 36);
        x.fillStyle = '#141c22'; x.fillRect(520, 270, 560, 100);
        x.fillStyle = '#04080a'; x.fillRect(548, 286, 260, 66);
        var c = on(0.6);
        if (c > 0) {
          x.save(); x.font = '64px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = 'rgba(' + AMBER + ',.08)'; x.fillText('88:88', 678, 320);
          x.fillStyle = 'rgba(' + AMBER + ',' + c + ')';
          var sec = Math.max(0, 599 - Math.floor(Math.max(0, t - 1)));
          x.fillText(('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2), 678, 320);
          x.restore(); glow(x, 678, 320, 240, AMBER, 0.28 * c);
        }
        var sc = on(1.0);
        x.fillStyle = '#071014'; x.fillRect(832, 300, 220, 40);
        if (sc > 0) {
          x.save(); x.font = '30px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = 'rgba(' + CYAN + ',' + sc + ')'; x.fillText('252KP7', 942, 321); x.restore();
        }
        for (var b = 0; b < 6; b++) {
          var bx = 370 + (b % 3) * 300, by = 400 + Math.floor(b / 3) * 132, k = on(1.3 + b * 0.25);
          x.fillStyle = css(mix([44, 56, 64], [216, 224, 228], k)); x.fillRect(bx, by, 260, 112);
          if (k > 0) {
            x.globalAlpha = k; x.fillStyle = '#2b3439'; x.strokeStyle = '#2b3439'; x.lineWidth = 5;
            var mx = bx + 130, my = by + 56;
            if (b === 0) { x.beginPath(); x.moveTo(mx - 46, my + 30); x.lineTo(mx + 46, my + 30); x.lineTo(mx, my - 36); x.closePath(); x.fill(); }
            if (b === 1) [[0, -30, '#d0574f'], [-30, 0, '#4180ae'], [30, 0, '#ddb63f'], [0, 30, '#4f9d5d']].forEach(function (q) { x.fillStyle = q[2]; x.beginPath(); x.arc(mx + q[0], my + q[1], 15, 0, 7); x.fill(); });
            if (b === 2) { x.beginPath(); x.arc(mx - 20, my, 32, 0, 7); x.stroke(); x.beginPath(); x.arc(mx + 20, my, 32, 0, 7); x.stroke(); }
            if (b === 3) for (var q = 0; q < 4; q++) x.fillRect(mx - 96 + q * 50, my - 30, 40, 60);
            if (b === 4) { x.beginPath(); x.moveTo(mx - 70, my + 28); x.lineTo(mx + 70, my - 28); x.moveTo(mx - 80, my - 8); x.lineTo(mx + 80, my - 8); x.stroke(); }
            if (b === 5) { x.fillStyle = '#e1d2a2'; x.fillRect(mx - 96, my - 16, 192, 32); }
            x.globalAlpha = 1;
          }
        }
      });
    }
  });

  /* ---- the desk, the conventions the questions are made of ---------------- */
  K.register('desk', {
    prepare: function (W, H) {
      return { bg: sheet('flat-desk', W, H, function (x) {
        x.fillStyle = '#4a3324'; x.fillRect(-600, -400, DW + 1200, DH + 800);
        glow(x, 820, 380, 900, '255,200,140', 0.35);
        function two(px, py, w, h, lit, dark, rot) {
          x.save(); x.translate(px, py); x.rotate(rot || 0);
          x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(10, 12, w, h);
          x.fillStyle = dark; x.fillRect(0, 0, w, h);
          x.fillStyle = lit; x.fillRect(0, 0, w, h * 0.82);
          x.restore();
        }
        two(560, 160, 520, 380, '#efe9da', '#cfc7b4', -0.03);
        x.save(); x.translate(560, 160); x.rotate(-0.03); x.strokeStyle = '#2a4f7a'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(60, 300); x.lineTo(300, 300); x.lineTo(60, 110); x.closePath(); x.stroke(); x.restore();
        two(180, 600, 640, 70, '#e9cf73', '#c9ad52', 0.04);
        x.save(); x.translate(180, 600); x.rotate(0.04); x.fillStyle = '#3a2f12';
        for (var tk = 0; tk <= 60; tk++) x.fillRect(10 + tk * 10.3, 0, 2, tk % 10 === 0 ? 30 : tk % 5 === 0 ? 20 : 11);
        x.restore();
        x.save(); x.translate(1180, 520);
        x.beginPath(); x.arc(0, 0, 170, Math.PI, 0); x.closePath(); x.fillStyle = 'rgba(190,225,232,.75)'; x.fill();
        x.beginPath(); x.arc(0, 0, 70, Math.PI, 0); x.closePath(); x.fillStyle = '#4a3324'; x.fill();
        x.restore();
        x.save(); x.translate(340, 210);
        x.fillStyle = 'rgba(200,232,244,.35)'; x.fillRect(0, 0, 80, 300);
        x.fillStyle = 'rgba(70,150,200,.75)'; x.fillRect(4, 140, 72, 156);
        x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(60, 10, 8, 280);
        x.restore();
        [[1240, 150, 0.18, '♥', '#c8302c', 'A'], [1320, 180, 0.32, '♠', '#1a1a1a', '7']].forEach(function (cd) {
          x.save(); x.translate(cd[0], cd[1]); x.rotate(cd[2]);
          x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(10, 12, 150, 210);
          x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, 150, 210);
          x.fillStyle = cd[4]; x.font = '700 34px "Plex Serif", serif'; x.fillText(cd[5], 14, 42);
          x.font = '90px serif'; x.textAlign = 'center'; x.fillText(cd[3], 75, 140);
          x.restore();
        });
        two(980, 690, 360, 22, '#f2c230', '#d29f1a', -0.22);
      }) };
    },
    draw: function (g, t, cam, st, W, H) { K.layer(g, W, H, cam, 0.5, function (x) { stampSheet(x, st.bg); }); }
  });

  /* ---- the market at dawn -------------------------------------------------- */
  K.register('market', {
    prepare: function (W, H, p) {
      var pal = p.time === 'morning' ? PAL.morning : PAL.dawn, key = 'flat-market:' + (p.time || 'dawn');
      return {
        pal: pal,
        bg: sheet(key, W, H, function (x) {
          sky(x, pal);
          glow(x, 800, 520, 320, '255,214,170', 0.55);
          x.fillStyle = tint(pal, '#5a4a44', 0.55); x.fillRect(-600, 560, DW + 1200, 500);
          var cols = ['#c8302c', '#2a5aa8', '#e2b02c', '#2e8a5a'];
          for (var side = -1; side <= 1; side += 2) {
            for (var i = 4; i >= 0; i--) {
              var k = i / 4, ds = 1 - k * 0.68, depth = 0.25 + (1 - k) * 0.55;
              var cx = 800 + side * (160 + (1 - k) * 640), w = 360 * ds, h = 300 * ds, top = 560 - h * 0.85;
              var col = cols[(i + (side > 0 ? 2 : 0)) % 4];
              for (var sI = 0; sI < 6; sI++) {
                x.fillStyle = tint(pal, sI % 2 ? col : '#f2ece0', depth);
                var sx0 = cx - w / 2 + sI * w / 6;
                x.beginPath(); x.moveTo(sx0, top); x.lineTo(sx0 + w / 6, top); x.lineTo(sx0 + w / 6 + side * 6, top + 36 * ds); x.lineTo(sx0 + side * 6, top + 36 * ds); x.fill();
              }
              x.fillStyle = tint(pal, '#5a3f2c', depth); x.fillRect(cx - w / 2, top + 36 * ds, w, h * 0.7);
              var cr = rng(i * 7 + side + 2);
              for (var f = 0; f < 10; f++) {
                x.fillStyle = tint(pal, ['#f2c230', '#e9a23a', '#7cb342', '#e85a3a'][Math.floor(cr() * 4)], depth);
                x.beginPath(); x.arc(cx - w / 2 + 10 * ds + cr() * (w - 20 * ds), top + h * 0.62 + cr() * 14 * ds, 9 * ds, 0, 7); x.fill();
              }
            }
          }
        }),
        near: sheet(key + ':near', W, H, function (x) {
          var nc = tint(pal, '#4a3324', 1);
          x.fillStyle = nc; x.fillRect(420, 700, 760, 260);
          x.fillStyle = tint(pal, '#6b4a30', 0.95); for (var c = 0; c < 4; c++) x.fillRect(440 + c * 190, 620, 160, 84);
          var fr = rng(55);
          for (var m = 0; m < 46; m++) {
            var crate = m % 4; if (crate === 2) continue;
            x.fillStyle = tint(pal, ['#f2c230', '#7cb342', '#f2c230', '#e85a3a'][crate], 0.95);
            x.beginPath(); x.arc(452 + crate * 190 + fr() * 136, 612 + fr() * 12, 13, 0, 7); x.fill();
          }
          x.fillStyle = tint(pal, '#f4ecd6', 0.95); x.fillRect(470, 560, 110, 60);
          x.fillStyle = tint(pal, '#2a2a2a', 1); x.font = '600 26px "Plex Sans Condensed", sans-serif'; x.fillText('₱40/kg', 478, 600);
        })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0.3, function (x) {
        stampSheet(x, st.bg);
        /* the bulbs over the stalls, lit */
        for (var side = -1; side <= 1; side += 2) for (var i = 0; i < 5; i++) {
          var k = i / 4, ds = 1 - k * 0.68, cx = 800 + side * (160 + (1 - k) * 640), top = 560 - 300 * ds * 0.85;
          glow(x, cx, top + 66 * ds, 70 * ds, AMBER, p.time === 'morning' ? 0.18 : 0.6);
          x.fillStyle = 'rgb(255,240,200)'; x.beginPath(); x.arc(cx, top + 66 * ds, 5 * ds, 0, 7); x.fill();
        }
      });
      K.layer(g, W, H, cam, 0.7, function (x) { stampSheet(x, st.near); device(x, 900, 610, 0.95, t, p.device || 'lit'); });
    }
  });

  /* ---- the jeepney terminal at noon ---------------------------------------- */
  function jeepney(x, cx, base, s, body, face, pal, depth) {
    var T = function (c) { return tint(pal, c, depth); };
    x.save(); x.translate(cx, base); x.scale(s * (face || 1), s);
    x.fillStyle = 'rgba(0,0,0,.18)'; ell(x, 0, 0, 290, 14); x.fill();
    x.fillStyle = T(body); x.fillRect(-250, -150, 380, 118);
    x.beginPath(); x.moveTo(130, -112); x.lineTo(218, -104); x.lineTo(236, -40); x.lineTo(130, -32); x.closePath(); x.fill();
    x.fillStyle = T('#d9dfe3'); x.fillRect(226, -100, 22, 64); x.fillRect(150, -36, 110, 10);
    x.fillStyle = T('#a9c4cf'); x.beginPath(); x.moveTo(132, -146); x.lineTo(170, -146); x.lineTo(196, -112); x.lineTo(132, -112); x.closePath(); x.fill();
    x.fillStyle = T('#eef1f3'); x.fillRect(-276, -172, 470, 22);
    x.fillStyle = T('#1b2830'); for (var w = 0; w < 6; w++) x.fillRect(-236 + w * 58, -140, 46, 36);
    x.fillStyle = T('#f2c230'); x.fillRect(-250, -92, 470, 8);
    x.fillStyle = T('#c8302c'); x.fillRect(-250, -80, 470, 5);
    x.fillStyle = T('#111111'); [[-150, 0], [170, 0]].forEach(function (wh) { x.beginPath(); x.arc(wh[0], -16, 32, 0, 7); x.fill(); });
    x.restore();
  }
  K.register('terminal', {
    prepare: function (W, H) {
      var pal = PAL.noon;
      return { pal: pal, bg: sheet('flat-terminal', W, H, function (x) {
        sky(x, pal);
        glow(x, 1200, 80, 260, '255,252,230', 0.7);
        volcano(x, 400, 520, 560, 250, tint(pal, null, 0.05));
        var ov = tint(pal, '#b8b2a4', 0.3);
        x.fillStyle = ov; x.fillRect(-600, 330, DW + 1200, 44);
        for (var c = 0; c < 7; c++) x.fillRect(-120 + c * 300, 374, 40, 220);
        x.fillStyle = tint(pal, '#7a7570', 0.7); x.fillRect(-600, 560, DW + 1200, 500);
        x.fillStyle = tint(pal, '#e9e2c8', 0.75); for (var l = 0; l < 6; l++) x.fillRect(100 + l * 260, 700, 120, 8);
        jeepney(x, 820, 600, 0.5, '#2e8a5a', 1, pal, 0.45);
        jeepney(x, 260, 640, 0.75, '#2a6fb0', 1, pal, 0.75);
        jeepney(x, 1340, 650, 0.8, '#c8302c', -1, pal, 0.8);
      }) };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var pal = st.pal, near = tint(pal, null, 1), rim = 'rgba(255,250,230,.85)';
      K.layer(g, W, H, cam, 0.35, function (x) { stampSheet(x, st.bg); });
      K.layer(g, W, H, cam, 0.65, function (x) {
        if (p.split) {
          device(x, 300, 720, 0.8, t, 'lit');
          person(x, 420, 800, 0.95, 'stand', near, rim, { bag: true, light: [0.3, -1] });
          person(x, 1300, 790, 0.75, 'phone', near, rim, { skirt: true, face: -1, light: [0.3, -1] });
          x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(' + CYAN + ',.5)'; x.lineWidth = 3;
          for (var a = 0; a < 3; a++) {
            var ph = (t * 0.6 + a / 3) % 1; x.globalAlpha = 1 - ph;
            x.beginPath(); x.arc(1300, 600, 30 + ph * 190, Math.PI * 0.9, Math.PI * 1.25); x.stroke();
            x.beginPath(); x.arc(420, 600, 30 + ph * 190, -Math.PI * 0.25, Math.PI * 0.1); x.stroke();
          }
          x.restore();
        } else {
          var k = easeOut(t / 9);
          person(x, 300 + 360 * k, 830, 0.95, 'walk', near, rim, { bag: true, t: t, light: [0.3, -1] });
          person(x, 1320 - 380 * k, 830, 0.92, 'walk', near, rim, { skirt: true, face: -1, t: t + 0.4, light: [0.3, -1] });
        }
      });
    }
  });

  /* ---- the basketball court in a storm, the power out ---------------------- */
  K.register('court', {
    prepare: function (W, H, p, lite) {
      var pal = PAL.storm;
      return { pal: pal, lite: lite, bg: sheet('flat-court', W, H, function (x) {
        sky(x, pal);
        volcano(x, 1100, 560, 600, 250, tint(pal, null, 0.1));
        houses(x, 31, 560, tint(pal, null, 0.35), 0, null);
        x.fillStyle = tint(pal, '#3a4048', 0.7); x.fillRect(-600, 560, DW + 1200, 500);
        x.strokeStyle = tint(pal, '#c9c9b8', 0.7); x.lineWidth = 4;
        ell(x, 800, 700, 260, 60); x.stroke();
        x.beginPath(); x.moveTo(-600, 640); x.lineTo(DW + 600, 640); x.stroke();
        var hoop = tint(pal, null, 0.75);
        x.fillStyle = hoop; x.fillRect(1360, 260, 18, 380);
        x.fillStyle = tint(pal, '#d8dde2', 0.7); x.fillRect(1250, 250, 180, 110);
        x.fillStyle = tint(pal, '#d4602c', 0.8); x.fillRect(1306, 362, 68, 6);
        x.fillStyle = tint(pal, '#3a2a20', 0.85); x.fillRect(560, 690, 380, 20); x.fillRect(580, 710, 16, 60); x.fillRect(900, 710, 16, 60);
      }) };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var storm = p.storm === undefined ? 1 : p.storm, pal = st.pal, near = tint(pal, null, 1);
      var bolt = 0;
      [[1.2, 1], [5.5, 0.7], [9.3, 0.8]].forEach(function (b) {
        var d = t - b[0];
        if (d > 0 && d < 0.5) bolt = Math.max(bolt, b[1] * storm * (d < 0.08 ? 1 : d < 0.16 ? 0.3 : d < 0.22 ? 0.8 : 1 - d * 2));
      });
      K.layer(g, W, H, cam, 0.3, function (x) {
        stampSheet(x, st.bg);
        device(x, 750, 672, 0.85, t, p.after ? 'dark' : 'lit');
      });
      K.layer(g, W, H, cam, 0.55, function (x) {
        person(x, 470, 840, 0.95, 'phone', near, 'rgba(210,228,255,.7)', { bag: true, light: [1, -0.4] });
        person(x, 1060, 850, 0.95, 'binder', near, 'rgba(210,228,255,.7)', { skirt: true, face: -1, light: [-1, -0.4] });
        x.save(); x.globalCompositeOperation = 'lighter';
        [[505, 560, 760, 660], [1030, 580, 1000, 760]].forEach(function (b) {
          var dx = b[2] - b[0], dy = b[3] - b[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
          x.fillStyle = 'rgba(225,238,255,.14)';
          x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(b[2] + nx * 80, b[3] + ny * 80); x.lineTo(b[2] - nx * 80, b[3] - ny * 80); x.closePath(); x.fill();
          glow(x, b[2], b[3], 110, '225,238,255', 0.22);
        });
        x.restore();
      });
      K.layer(g, W, H, cam, 0.9, function (x) { K.rain(x, t, storm, 0.18, st.lite); });
      if (bolt > 0) K.layer(g, W, H, cam, 0, function (x) { K.flash(x, bolt * 0.32); });
    }
  });

  /* ---- the bridge: at night under the craft, or at sunrise ----------------- */
  var BRIDGE_BEAM = Math.round((742 - 190) / 0.3 - 52);
  K.register('bridge', {
    prepare: function (W, H, p) {
      var pal = p.sunrise ? PAL.sunrise : PAL.night, key = 'flat-bridge:' + (p.sunrise ? 'sunrise' : 'night');
      if (p.saucer) prebake(BRIDGE_BEAM, 460);
      return {
        pal: pal,
        bg: sheet(key, W, H, function (x) {
          sky(x, pal);
          if (p.sunrise) { glow(x, 520, 520, 380, '255,220,170', 0.8); x.fillStyle = '#fff2d2'; x.beginPath(); x.arc(520, 500, 44, 0, 7); x.fill(); }
          else { stars(x, 260, 3, 360); glow(x, 1240, 150, 90, '230,238,255', 0.35); x.fillStyle = pal.light; x.beginPath(); x.arc(1240, 150, 20, 0, 7); x.fill(); }
          volcano(x, 560, 600, 760, 330, tint(pal, null, 0.05));
          ridge(x, 4, 600, 50, tint(pal, null, 0.18));
        }),
        mid: sheet(key + ':mid', W, H, function (x) {
          var lit = p.sunrise ? 0.05 : 0.55;
          skyline(x, 21, 600, 60, 250, tint(pal, null, 0.45), lit, 'rgba(' + AMBER + ',.85)');
          church(x, 1180, 600, 0.9, tint(pal, null, 0.45));
          if (!p.sunrise) { x.fillStyle = 'rgba(' + AMBER + ',.9)'; x.beginPath(); x.arc(1180, 600 - 230 * 0.9, 9, 0, 7); x.fill(); }
          palm(x, 120, 610, 200, 24, tint(pal, null, 0.62)); palm(x, 1480, 610, 240, -36, tint(pal, null, 0.62)); palm(x, 1560, 610, 170, -20, tint(pal, null, 0.62));
          x.fillStyle = tint(pal, null, 0.7); x.fillRect(-600, 600, DW + 1200, 400);
          var rr = rng(9), refl = p.sunrise ? '255,226,180' : AMBER;
          for (var k = 0; k < 120; k++) { x.fillStyle = 'rgba(' + refl + ',' + (0.1 + rr() * 0.25) + ')'; x.fillRect(-600 + rr() * (DW + 1200), 610 + rr() * 150, 14 + rr() * 50, 2); }
        })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var pal = st.pal;
      K.layer(g, W, H, cam, 0.05, function (x) { stampSheet(x, st.bg); });
      K.layer(g, W, H, cam, 0.25, function (x) { stampSheet(x, st.mid); });
      if (p.saucer) K.layer(g, W, H, cam, 0.5, function (x) {
        x.save(); x.globalAlpha = Math.min(1, t / 2.5);
        drawCraft(x, { x: 620, y: 190 + Math.sin(t * 1.2) * 5, s: 0.3, tilt: Math.sin(t * 0.8) * 0.012 }, t, 1.2, BRIDGE_BEAM, 460);
        x.restore();
      });
      K.layer(g, W, H, cam, 0.8, function (x) {
        var near = tint(pal, null, 1), deck = 760;
        x.fillStyle = near;
        x.fillRect(-600, deck, DW + 1200, 400);
        x.fillRect(-600, deck - 70, DW + 1200, 7);
        for (var b = -600; b < DW + 600; b += 26) x.fillRect(b, deck - 66, 5, 66);
        for (var l = 0; l < 5; l++) {
          var lx = 60 + l * 380;
          x.fillStyle = near; x.fillRect(lx, deck - 250, 8, 250); x.fillRect(lx - 30, deck - 252, 38, 8);
          if (!p.sunrise) { glow(x, lx - 26, deck - 238, 110, AMBER, 0.5); x.fillStyle = 'rgb(255,236,190)'; x.beginPath(); x.arc(lx - 26, deck - 240, 7, 0, 7); x.fill(); }
        }
        var rim = p.sunrise ? 'rgba(255,214,170,.9)' : 'rgba(' + CYAN + ',.85)';
        if (p.sitting) {
          person(x, 730, deck - 66, 0.62, 'sit', near, rim, { bag: true, light: [-1, -0.4] });
          person(x, 870, deck - 66, 0.62, 'sit', near, rim, { skirt: true, face: -1, light: [-1, -0.4] });
          x.fillStyle = '#7a2d27'; x.fillRect(792, deck - 108, 26, 34);
        } else if (p.saucer) {
          device(x, 620, deck - 18, 0.55, t, 'lit');
          person(x, 520, deck, 0.6, 'stand', near, rim, { bag: true, light: [0.6, -0.6] });
          person(x, 730, deck, 0.6, 'binder', near, rim, { skirt: true, face: -1, light: [-0.6, -0.6] });
        }
      });
    }
  });
})(DEFUSAL);
