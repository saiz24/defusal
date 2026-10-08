/* ==========================================================================
   DEFUSAL — the cutscene kit: the sky, the world, the craft.
   ========================================================================== */

(function (D) {
  'use strict';

  var K = D.cine.kit, DW = K.DW, DH = K.DH;
  var rng = K.rng, ell = K.ell, lin = K.lin, rad = K.rad;

  /* deep space: a dark field with slow washes of colour */
  function nebula(W, H, seed) {
    return K.bake(W, H, DW + 800, DH + 400, function (x) {
      x.fillStyle = lin(x, 0, 0, 0, DH + 400, [[0, '#03060f'], [1, '#060b18']]);
      x.fillRect(0, 0, DW + 800, DH + 400);
      x.globalCompositeOperation = 'lighter';
      var r = rng(seed || 3);
      [[0.25, 0.3, 700, '40,90,140', 0.22], [0.75, 0.7, 820, '70,40,120', 0.16],
       [0.55, 0.2, 520, '20,120,130', 0.14]].forEach(function (n) {
        var cx = n[0] * (DW + 800) + (r() - 0.5) * 200, cy = n[1] * (DH + 400);
        x.fillStyle = rad(x, cx, cy, 0, n[2], [[0, 'rgba(' + n[3] + ',' + n[4] + ')'], [1, 'rgba(' + n[3] + ',0)']]);
        x.fillRect(0, 0, DW + 800, DH + 400);
      });
    }, 1.05);
  }

  /* The deep sky and the far stars move almost together (parallax 0.02 and
     0.06), so they are painted into ONE sheet: a full-screen bitmap is the
     most expensive thing a frame draws, and this saves one of them. */
  function spaceState(W, H, lite, seed) {
    var neb = nebula(W, H, seed), far = K.stars(W, H, lite ? 500 : 900, (seed || 3) + 1, 0, false);
    var deep = K.bake(W, H, DW + 800, DH + 400, function (x) {
      x.drawImage(neb.c, 0, 0, DW + 800, DH + 400);
      x.drawImage(far.c, 0, 0, DW + 800, DH + 400);
    }, 1.05);
    return {
      deep: deep,
      near: K.stars(W, H, lite ? 80 : 140, (seed || 3) + 7, 0, true)
    };
  }
  function spaceDraw(g, cam, st, W, H) {
    K.layer(g, W, H, cam, 0.04, function (x) { K.stamp(x, st.deep, -400, -200); });
    K.layer(g, W, H, cam, 0.15, function (x) { K.starsAt(x, st.near); });
  }

  /* ---- the world, painted on a disc -------------------------------------- */

  var R = 760;
  function globeArt(W, H, night) {
    return K.bake(W, H, 1700, 1700, function (x) {
      var c = 850, r = rng(11);
      x.save();
      x.beginPath(); x.arc(c, c, R, 0, 7); x.clip();
      x.fillStyle = rad(x, c, c, 60, R, [[0, '#3fa3d6'], [0.55, '#1c6aa8'], [1, '#0c3566']], c - 260, c - 220);
      x.fillRect(0, 0, 1700, 1700);
      var lands = [[560, 620, 260], [820, 900, 220], [1100, 560, 170], [1180, 1080, 200], [420, 1080, 150], [900, 420, 110]];
      lands.forEach(function (L) {
        K.blob(x, L[0], L[1], L[2], 0.55, r, 18);
        x.fillStyle = lin(x, L[0] - L[2], L[1] - L[2], L[0] + L[2], L[1] + L[2], [[0, '#78b866'], [0.6, '#4d8f4f'], [1, '#3b6d40']]);
        x.fill();
        x.lineWidth = 7; x.strokeStyle = 'rgba(120,210,220,.45)'; x.stroke();
        K.blob(x, L[0] + L[2] * 0.15, L[1] + L[2] * 0.1, L[2] * 0.35, 0.6, r, 10);
        x.fillStyle = 'rgba(214,184,120,.75)'; x.fill();
      });
      for (var i = 0; i < 26; i++) {
        var cx = 120 + r() * 1460, cy = 140 + r() * 1420, cr = 40 + r() * 110;
        x.save(); x.translate(cx, cy); x.rotate(r() * 0.6 - 0.3); x.scale(2.4, 0.7);
        K.blob(x, 0, 0, cr * 0.5, 0.7, r, 10);
        x.fillStyle = 'rgba(10,30,60,.18)'; x.save(); x.translate(4, 6); x.fill(); x.restore();
        x.fillStyle = 'rgba(245,250,255,.82)'; x.fill();
        x.restore();
      }
      /* night: from the upper-left lit side into shadow; the night side of
         the night globe is nearly all of it */
      var nk = night ? [0, 0.15] : [0.42, 0.62];
      x.fillStyle = lin(x, c - R * 0.9, c - R * 0.5, c + R * 0.9, c + R * 0.4,
        [[0, 'rgba(2,6,18,' + (night ? 0.55 : 0) + ')'], [nk[0], 'rgba(2,6,18,' + (night ? 0.8 : 0.05) + ')'],
         [nk[1], 'rgba(2,6,18,0.86)'], [1, 'rgba(2,6,18,0.97)']]);
      x.fillRect(0, 0, 1700, 1700);
      x.globalCompositeOperation = 'lighter';
      var nLights = night ? 900 : 260;
      for (i = 0; i < nLights; i++) {
        var lx = c - (night ? 700 : -80) + r() * (night ? 1400 : 600), ly = c - 600 + r() * 1200;
        if (Math.hypot(lx - c, ly - c) > R - 20) continue;
        x.fillStyle = 'rgba(255,190,100,' + (0.3 + r() * 0.5) + ')';
        x.beginPath(); x.arc(lx, ly, 1.2 + r() * 2.2, 0, 7); x.fill();
      }
      if (!night) {
        x.fillStyle = rad(x, c - 330, c - 260, 0, 260, [[0, 'rgba(255,250,230,.45)'], [1, 'rgba(255,250,230,0)']]);
        x.fillRect(0, 0, 1700, 1700);
      }
      x.restore();
      var ring = K.off(1700, 1700), rx = ring.getContext('2d');
      rx.fillStyle = rad(rx, c, c, R * 0.95, R * 1.07, [[0, 'rgba(90,190,255,0)'], [0.45, 'rgba(120,205,255,.7)'], [1, 'rgba(90,190,255,0)']]);
      rx.fillRect(0, 0, 1700, 1700);
      rx.globalCompositeOperation = 'destination-in';
      rx.fillStyle = lin(rx, c - R, c - R * 0.6, c + R, c + R * 0.5, [[0, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,' + (night ? 0.35 : 0.7) + ')'], [1, 'rgba(0,0,0,.08)']]);
      rx.fillRect(0, 0, 1700, 1700);
      x.globalCompositeOperation = 'lighter';
      x.drawImage(ring, 0, 0);
    }, 0.9);
  }

  /* Fixed places on the disc where a device comes down, in disc units from
     the centre. They are picked once so the falling lights, the points that
     wake, and the points that go dark are always the same cities. */
  var SITES = (function () {
    var r = rng(404), s = [];
    while (s.length < 46) {
      var a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.86;
      s.push([Math.cos(a) * d * R, Math.sin(a) * d * R, r()]);
    }
    return s;
  })();

  K.register('space', {
    prepare: function (W, H, p, lite) { return spaceState(W, H, lite, p.seed); },
    draw: function (g, t, cam, st, W, H) { spaceDraw(g, cam, st, W, H); }
  });

  /* The world. params:
       night    the dark side, cities lit
       sun      a sunrise on the left limb
       falling  streaks of light coming down onto the sites
       points   the sites lit and pulsing
       dimming  the sites going out one by one across the shot
       scale/x/y  where the disc sits */
  K.register('globe', {
    prepare: function (W, H, p, lite) {
      var st = spaceState(W, H, lite, p.seed || 5);
      st.art = globeArt(W, H, !!p.night);
      return st;
    },
    draw: function (g, t, cam, st, W, H, p) {
      spaceDraw(g, cam, st, W, H);
      var sc = p.scale || 0.46, gx = p.x === undefined ? 960 : p.x, gy = p.y === undefined ? 470 : p.y;
      K.layer(g, W, H, cam, 0.5, function (x) {
        if (p.sun) {
          var sx = gx - R * sc * 0.98, sy = gy - R * sc * 0.3;
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = rad(x, sx, sy, 0, 420 * sc, [[0, 'rgba(255,240,210,.9)'], [0.2, 'rgba(255,200,140,.25)'], [1, 'rgba(255,180,120,0)']]);
          x.fillRect(sx - 500, sy - 500, 1000, 1000);
          x.restore();
        }
        x.save(); x.translate(gx, gy); x.rotate(-0.12 + t * 0.004); x.scale(sc, sc);
        K.stamp(x, st.art, -850, -850, 1700, 1700);
        /* the sites */
        x.globalCompositeOperation = 'lighter';
        var dur = p.dur || 8;
        SITES.forEach(function (s, i) {
          var order = s[2];
          var lit = 1;
          if (p.falling) lit = Math.max(0, Math.min(1, (t - 0.6 - order * (dur * 0.6)) / 0.5));
          if (p.dimming) lit = 1 - Math.max(0, Math.min(1, (t - 1 - order * (dur * 0.7)) / 0.6));
          if (!p.falling && !p.points && !p.dimming) lit = 0;
          if (lit <= 0) return;
          var pulse = 0.75 + 0.25 * Math.sin(t * 3 + i);
          K.glow(x, s[0], s[1], 26, '255,214,140', 0.9 * lit * pulse);
          x.fillStyle = 'rgba(255,240,210,' + lit + ')';
          x.beginPath(); x.arc(s[0], s[1], 4, 0, 7); x.fill();
        });
        if (p.falling) {
          SITES.forEach(function (s) {
            var t0 = 0.6 + s[2] * (dur * 0.6) - 0.9, k = (t - t0) / 0.9;
            if (k < 0 || k > 1) return;
            var fx = s[0] - 260 * (1 - k), fy = s[1] - 520 * (1 - k);
            x.strokeStyle = lin(x, fx - 120, fy - 240, fx, fy, [[0, 'rgba(160,240,255,0)'], [1, 'rgba(220,255,255,.95)']]);
            x.lineWidth = 6; x.lineCap = 'round';
            x.beginPath(); x.moveTo(fx - 120, fy - 240); x.lineTo(fx, fy); x.stroke();
            K.glow(x, fx, fy, 30, '160,240,255', 0.8);
          });
        }
        x.restore();
        if (p.sun) {
          var lx = gx - R * sc * 0.98, ly = gy - R * sc * 0.3;
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = lin(x, lx - 700, ly, lx + 700, ly, [[0, 'rgba(120,200,255,0)'], [0.5, 'rgba(180,230,255,.35)'], [1, 'rgba(120,200,255,0)']]);
          x.fillRect(lx - 700, ly - 1.5, 1400, 3);
          x.restore();
        }
      });
    }
  });

  /* The horizon of the world from just above it, and the craft.
     params: enter (slides in), leave (slides away), beamAt (seconds when the
     beam opens), x (where it settles, design units) */
  K.register('arrival', {
    prepare: function (W, H, p, lite) {
      var st = spaceState(W, H, lite, 31); st.lite = lite;
      /* the horizon is still; it is painted once */
      st.horizon = K.bake(W, H, DW + 1200, 700, function (x) {
        x.translate(600, -200);
        var HR = 3600, hx = DW / 2, hy = 640 + HR;
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = rad(x, hx, hy, HR * 0.995, HR * 1.06, [[0, 'rgba(120,210,255,.55)'], [0.3, 'rgba(70,150,230,.22)'], [1, 'rgba(40,90,200,0)']]);
        x.fillRect(-600, 200, DW + 1200, 700);
        x.restore();
        x.fillStyle = rad(x, hx, hy - HR * 0.6, HR * 0.02, HR * 0.7, [[0, '#5fb3dd'], [0.35, '#2a77ad'], [1, '#0a2850']], hx - 480, hy - HR);
        x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.fill();
        x.save(); x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.clip();
        var cr = rng(42);
        for (var c = 0; c < 30; c++) {
          var ang = -Math.PI / 2 + (cr() - 0.5) * 0.5, dd = HR - 6 - cr() * 200;
          var px = hx + Math.cos(ang) * dd, py = hy + Math.sin(ang) * dd;
          x.save(); x.translate(px, py); x.rotate(ang + Math.PI / 2); x.scale(1, 0.18);
          x.fillStyle = rad(x, 0, 0, 0, 60 + cr() * 90, [[0, 'rgba(240,248,255,.55)'], [1, 'rgba(240,248,255,0)']]);
          x.beginPath(); x.arc(0, 0, 150, 0, 7); x.fill(); x.restore();
        }
        x.restore();
      }, 1.12);
      return st;
    },
    draw: function (g, t, cam, st, W, H, p) {
      spaceDraw(g, cam, st, W, H);
      K.layer(g, W, H, cam, 0.35, function (x) { K.stamp(x, st.horizon, -600, 200); });
      K.layer(g, W, H, cam, 0.8, function (x) {
        var ease = function (k) { k = Math.max(0, Math.min(1, k)); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
        var settleX = p.x === undefined ? 800 : p.x;
        var cx = settleX, cy = 250, sc = 0.62, tilt = 0.02;
        if (p.enter) { var e = ease(t / 5.2); cx = -400 + (settleX + 400) * e; cy = 200 + 50 * e; tilt = -0.12 + 0.14 * e; sc = 0.5 + 0.12 * e; }
        if (p.leave) { var lv = ease(t / 9); cx = settleX + 1500 * lv; cy = 250 - 160 * lv; sc = 0.62 - 0.36 * lv; tilt = 0.02 + 0.1 * lv; }
        cy += Math.sin(t * 1.4) * 4;
        var b = p.beamAt === undefined ? 0 : ease((t - p.beamAt) / 1.6);
        K.beam(x, cx, cy + 66 * sc, 640, 120 * sc, 360 * sc, b, t, st.lite);
        x.save(); x.translate(cx, cy); x.rotate(tilt); x.scale(sc, sc);
        K.saucer(x, t);
        x.restore();
      });
    }
  });

  /* Stars that resolve into the figures anyone would find: a triangle, a
     circle, a square, drawn in light between points. */
  K.register('constellation', {
    prepare: function (W, H, p, lite) { return spaceState(W, H, lite, 5); },
    draw: function (g, t, cam, st, W, H) {
      spaceDraw(g, cam, st, W, H);
      K.layer(g, W, H, cam, 0.3, function (x) {
        var figs = [
          { pts: [[480, 560], [660, 560], [570, 404]], closed: true, at: 0.8 },
          { circle: [800, 480, 92], at: 2.2 },
          { pts: [[968, 396], [1132, 396], [1132, 560], [968, 560]], closed: true, at: 3.6 }
        ];
        x.save(); x.globalCompositeOperation = 'lighter';
        figs.forEach(function (f) {
          var k = Math.max(0, Math.min(1, (t - f.at) / 1.4));
          if (k <= 0) return;
          x.strokeStyle = 'rgba(150,230,250,' + (0.85 * k) + ')';
          x.lineWidth = 3; x.lineCap = 'round';
          if (f.circle) {
            x.beginPath(); x.arc(f.circle[0], f.circle[1], f.circle[2], -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke();
            for (var a = 0; a < 6; a++) {
              var aa = a / 6 * Math.PI * 2 - Math.PI / 2;
              K.glow(x, f.circle[0] + Math.cos(aa) * f.circle[2], f.circle[1] + Math.sin(aa) * f.circle[2], 20, '200,240,255', 0.8 * Math.min(1, k * 2));
            }
          } else {
            var p2 = f.pts, n = p2.length, segs = n, prog = k * segs;
            x.beginPath(); x.moveTo(p2[0][0], p2[0][1]);
            for (var i = 1; i <= segs; i++) {
              var a1 = p2[(i - 1) % n], b1 = p2[i % n], kk = Math.max(0, Math.min(1, prog - (i - 1)));
              if (kk <= 0) break;
              x.lineTo(a1[0] + (b1[0] - a1[0]) * kk, a1[1] + (b1[1] - a1[1]) * kk);
            }
            x.stroke();
            p2.forEach(function (q) { K.glow(x, q[0], q[1], 22, '200,240,255', 0.85 * Math.min(1, k * 3)); });
          }
        });
        x.restore();
      });
    }
  });

  /* A single point of light that opens into a clock reading 00:00. */
  K.register('point', {
    prepare: function (W, H, p, lite) { return spaceState(W, H, lite, 9); },
    draw: function (g, t, cam, st, W, H) {
      g.save(); g.globalAlpha = 0.5; spaceDraw(g, cam, st, W, H); g.restore();
      K.layer(g, W, H, cam, 0.4, function (x) {
        var k = Math.min(1, t / 1.2);
        K.glow(x, 800, 450, 40 + 240 * k, '255,207,92', 0.9 * (1 - k * 0.6));
        var d = Math.max(0, Math.min(1, (t - 1.2) / 1.2));
        if (d > 0) {
          x.save();
          x.globalAlpha = d;
          x.font = '150px "Seven Segment", monospace';
          x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = 'rgba(255,200,97,.1)'; x.fillText('88:88', 800, 460);
          x.shadowColor = 'rgba(255,190,80,.9)'; x.shadowBlur = 40;
          x.fillStyle = '#ffcf5c'; x.fillText('00:00', 800, 460);
          x.restore();
        }
      });
    }
  });

  /* the credits roll over: the world's limb at the bottom, a sunrise */
  K.register('credits-sky', {
    prepare: function (W, H, p, lite) { return spaceState(W, H, lite, 13); },
    draw: function (g, t, cam, st, W, H) {
      spaceDraw(g, cam, st, W, H);
      K.layer(g, W, H, cam, 0.3, function (x) {
        var HR = 3000, hx = DW / 2, hy = 740 + HR;
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = rad(x, hx, hy, HR * 0.99, HR * 1.08, [[0, 'rgba(255,190,120,.6)'], [0.25, 'rgba(120,190,255,.25)'], [1, 'rgba(40,90,200,0)']]);
        x.fillRect(-600, -400, DW + 1200, DH + 800);
        x.restore();
        x.fillStyle = rad(x, hx, hy - HR * 0.6, 10, HR * 0.7, [[0, '#4b9cc8'], [1, '#081c36']], hx, hy - HR);
        x.beginPath(); x.arc(hx, hy, HR, 0, 7); x.fill();
        K.glow(x, hx - 520, 736, 260, '255,220,170', 0.55);
      });
    }
  });
})(DEFUSAL);
