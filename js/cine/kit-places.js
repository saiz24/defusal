/* ==========================================================================
   DEFUSAL — the cutscene kit: the city and its places.

   One city, never named, drawn to read as a Bicol city: a broad volcano on
   the skyline, a river, a church tower, palms, corrugated roofs, jeepneys, a
   public high school in cream and green. Each place a device is left in is
   a painter here, with params for time of day and who is in frame.
   ========================================================================== */

(function (D) {
  'use strict';

  var K = D.cine.kit, DW = K.DW, DH = K.DH;
  var rng = K.rng, ell = K.ell, lin = K.lin, rad = K.rad;

  /* ---- shared scenery ------------------------------------------------- */

  /* the volcano: a broad cone, its summit worn flat and uneven */
  function volcano(x, cx, base, w, h, fill, rim) {
    x.beginPath();
    x.moveTo(cx - w, base);
    x.bezierCurveTo(cx - w * 0.55, base - h * 0.25, cx - w * 0.22, base - h * 0.92, cx - w * 0.1, base - h);
    x.lineTo(cx - w * 0.02, base - h * 0.96); x.lineTo(cx + w * 0.06, base - h * 0.99);
    x.bezierCurveTo(cx + w * 0.2, base - h * 0.9, cx + w * 0.55, base - h * 0.3, cx + w, base);
    x.closePath();
    x.fillStyle = fill; x.fill();
    if (rim) {
      x.save(); x.clip();
      x.lineWidth = 6; x.strokeStyle = rim; x.stroke();
      x.restore();
    }
  }

  function palm(x, px, py, h, lean, fill) {
    x.fillStyle = fill; x.strokeStyle = fill;
    x.lineWidth = h * 0.045; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + lean * 0.5, py - h * 0.5, px + lean, py - h); x.stroke();
    var tx = px + lean, ty = py - h;
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI + i / 6 * Math.PI + (i % 2 ? 0.15 : -0.1);
      var l = h * (0.42 + (i % 3) * 0.06);
      x.lineWidth = h * 0.028;
      x.beginPath(); x.moveTo(tx, ty);
      x.quadraticCurveTo(tx + Math.cos(a) * l * 0.6, ty + Math.sin(a) * l * 0.6 - l * 0.15,
        tx + Math.cos(a) * l, ty + Math.sin(a) * l * 0.4 + l * 0.25);
      x.stroke();
    }
  }

  /* a row of buildings with lit windows, baked: the far bank of the city */
  function skyline(W, H, seed, opts) {
    opts = opts || {};
    return K.bake(W, H, DW + 600, 420, function (x) {
      var r = rng(seed), px = 0, base = 420;
      var lit = opts.lit === undefined ? 0.4 : opts.lit;
      while (px < DW + 600) {
        var bw = 40 + r() * 120, bh = 50 + Math.pow(r(), 2) * (opts.tall || 220);
        x.fillStyle = opts.fill || '#0d1726';
        x.fillRect(px, base - bh, bw, bh);
        if (r() < 0.3) { x.fillRect(px + bw * 0.3, base - bh - 26, bw * 0.12, 26); }
        for (var wy = base - bh + 12; wy < base - 10; wy += 16) {
          for (var wx = px + 8; wx < px + bw - 10; wx += 14) {
            if (r() < lit) {
              x.fillStyle = r() < 0.8 ? 'rgba(255,200,120,' + (0.5 + r() * 0.5) + ')' : 'rgba(180,220,255,.7)';
              x.fillRect(wx, wy, 6, 8);
            }
          }
        }
        px += bw + 2 + r() * 10;
      }
      /* the church tower, which every Bicol city has somewhere on its skyline */
      if (opts.church !== false) {
        var cx = (DW + 600) * 0.62;
        x.fillStyle = opts.fill || '#0d1726';
        x.fillRect(cx - 30, base - 300, 60, 300);
        x.beginPath(); x.moveTo(cx - 38, base - 300); x.lineTo(cx, base - 372); x.lineTo(cx + 38, base - 300); x.fill();
        x.fillRect(cx - 3, base - 410, 6, 40); x.fillRect(cx - 14, base - 398, 28, 6);
        x.fillStyle = 'rgba(255,214,140,.75)';
        x.beginPath(); x.arc(cx, base - 240, 12, 0, 7); x.fill();
      }
      /* a telecom mast, its lamp drawn live */
      x.strokeStyle = opts.fill || '#0d1726'; x.lineWidth = 4;
      var mx = (DW + 600) * 0.28;
      x.beginPath(); x.moveTo(mx - 14, base); x.lineTo(mx, base - 330); x.lineTo(mx + 14, base); x.stroke();
    }, 1.1);
  }

  /* corrugated roofs close to the camera */
  function roofs(x, y, seed, fill, rimc, litc) {
    var r = rng(seed), px = -300;
    while (px < DW + 300) {
      var w = 160 + r() * 200, h = 50 + r() * 60, peak = r() < 0.5;
      x.beginPath();
      if (peak) { x.moveTo(px, y + h); x.lineTo(px + w * 0.5, y); x.lineTo(px + w, y + h); }
      else { x.moveTo(px, y + h * 0.5); x.lineTo(px + w, y + h * 0.2); x.lineTo(px + w, y + h); x.lineTo(px, y + h); }
      x.closePath(); x.fillStyle = fill; x.fill();
      x.lineWidth = 3; x.strokeStyle = rimc; x.stroke();
      x.fillStyle = fill; x.fillRect(px + 10, y + h, w - 20, 260);
      if (litc && r() < 0.6) { x.fillStyle = litc; x.fillRect(px + w * 0.3, y + h + 30, 26, 22); }
      px += w - 10;
    }
  }

  /* hanging wires across a frame: power lines are the Philippine sky */
  function wires(x, y, fill) {
    x.strokeStyle = fill; x.lineWidth = 2;
    for (var i = 0; i < 4; i++) {
      x.beginPath(); x.moveTo(-200, y + i * 14);
      x.quadraticCurveTo(DW / 2, y + 80 + i * 18, DW + 200, y - 20 + i * 12); x.stroke();
    }
  }

  /* the device as a small object in a scene: dark case, lit clock */
  function device(x, cx, cy, s, state, t) {
    var on = state === 'wake' ? Math.min(1, Math.max(0, (t - 0.8) / 0.6)) : state === 'dark' ? 0 : 1;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = 'rgba(0,0,0,.45)'; ell(x, 0, 44, 120, 14); x.fill();
    x.fillStyle = '#26333a'; x.beginPath(); x.roundRect ? x.roundRect(-110, -40, 220, 84, 12) : x.rect(-110, -40, 220, 84); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#0a1115'; x.stroke();
    x.fillStyle = '#3b4c55'; x.fillRect(-104, -40, 208, 10);
    x.fillStyle = '#05090b'; x.fillRect(-64, -26, 92, 30);
    for (var b = 0; b < 3; b++) { x.fillStyle = on ? '#cfd8da' : '#59656b'; x.fillRect(-96 + b * 66, 10, 58, 26); }
    if (on > 0) {
      x.font = '26px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(255,190,80,.9)'; x.shadowBlur = 14;
      x.fillStyle = 'rgba(255,200,97,' + on + ')';
      var sec = Math.max(0, 299 - Math.floor(t));
      x.fillText('0' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2), -18, -10);
      x.shadowBlur = 0;
      x.fillStyle = 'rgba(111,215,232,' + on + ')'; x.fillRect(48, -24, 34, 10);
      K.glow(x, -18, -10, 120, '255,190,90', 0.35 * on);
    }
    x.restore();
  }
  K.device = device;

  function windowRain(x, rx, ry, rw, rh, t, amount) {
    x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
    K.rain(x, t, amount, 0.06, false, [rx, ry - 40, rw, rh + 80]);
    /* drops running down the glass */
    var r = rng(19);
    for (var i = 0; i < 30 * amount; i++) {
      var dx = rx + r() * rw, sp = 0.05 + r() * 0.12, dy = ry + ((r() + t * sp) % 1) * rh;
      x.fillStyle = 'rgba(200,225,240,.5)';
      x.beginPath(); x.ellipse(dx, dy, 2.2, 3.4, 0, 0, 7); x.fill();
    }
    x.restore();
  }

  /* ---- the city at night (prologue) ------------------------------------- */
  K.register('city-night', {
    prepare: function (W, H, p, lite) {
      return {
        stars: K.stars(W, H, lite ? 250 : 500, 41, 520, false),
        far: skyline(W, H, 7, { lit: 0.35, fill: '#0b1424', tall: 200 })
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#050a1c'], [0.55, '#10234a'], [0.8, '#2a3768'], [1, '#3f3a6a']]);
      });
      K.layer(g, W, H, cam, 0.04, function (x) { K.starsAt(x, st.stars); K.glow(x, 1260, 150, 60, '230,240,255', 0.5); x.fillStyle = '#eef4ff'; x.beginPath(); x.arc(1260, 150, 18, 0, 7); x.fill(); });
      K.layer(g, W, H, cam, 0.1, function (x) {
        volcano(x, 560, 640, 760, 360, '#1a2550', 'rgba(150,170,230,.35)');
      });
      K.layer(g, W, H, cam, 0.25, function (x) {
        K.stamp(x, st.far, -300, 320);
        /* mast lamp blinking */
        var on = Math.sin(t * 3) > 0;
        if (on) K.glow(x, (DW + 600) * 0.28 - 300, 410, 24, '255,60,50', 0.9);
        palm(x, 140, 742, 200, 30, '#070d18'); palm(x, 1420, 742, 240, -40, '#070d18');
      });
      /* the river, holding the lights */
      K.layer(g, W, H, cam, 0.4, function (x) {
        x.fillStyle = lin(x, 0, 740, 0, 900, [[0, '#0a1630'], [1, '#050a16']]);
        x.fillRect(-400, 740, DW + 800, 300);
        var r = rng(3);
        for (var i = 0; i < 80; i++) {
          var rx = r() * DW, ry = 750 + r() * 140, w = 10 + r() * 40;
          x.fillStyle = 'rgba(255,200,120,' + (0.15 + 0.2 * Math.sin(t * 2 + i)) + ')';
          x.fillRect(rx + Math.sin(t + i) * 6, ry, w, 2);
        }
      });
      K.layer(g, W, H, cam, 0.8, function (x) {
        roofs(x, 760, 12, '#060b14', 'rgba(120,150,210,.25)', 'rgba(255,190,110,.6)');
        wires(x, 640, 'rgba(5,9,16,.9)');
      });
      /* the streak: something comes down among the roofs */
      if (p.streak) {
        K.layer(g, W, H, cam, 0.6, function (x) {
          var k = (t - 1.4) / 1.0, lx = 980, ly = 770;
          if (k > 0 && k < 1) {
            var fx = lx + 300 * (1 - k), fy = ly - 760 * (1 - k);
            x.save(); x.globalCompositeOperation = 'lighter';
            x.strokeStyle = lin(x, fx + 120, fy - 300, fx, fy, [[0, 'rgba(160,240,255,0)'], [1, 'rgba(230,255,255,.95)']]);
            x.lineWidth = 7; x.lineCap = 'round';
            x.beginPath(); x.moveTo(fx + 120, fy - 300); x.lineTo(fx, fy); x.stroke();
            x.restore();
            K.glow(x, fx, fy, 50, '170,240,255', 0.9);
          }
          if (k >= 1) {
            var pulse = 0.6 + 0.4 * Math.sin(t * 4);
            K.glow(x, lx, ly, 120, '120,220,240', 0.55 * pulse);
            if (k < 1.4) K.flash(x, (1.4 - k) * 0.25, '170,240,255');
          }
        });
      }
    }
  });

  /* ---- the school, morning: the flag going up ---------------------------- */
  function flag(x, px, top, w, h, t) {
    /* the Philippine flag, simplified: blue over red, a white triangle at the
       hoist with a sun. It waves. */
    var cols = 18;
    for (var i = 0; i < cols; i++) {
      var u0 = i / cols, u1 = (i + 1) / cols;
      var wv = function (u) { return Math.sin(u * 6 - t * 4) * 7 * u; };
      var x0 = px + u0 * w, x1 = px + u1 * w;
      x.fillStyle = '#1c3f9a';
      x.beginPath(); x.moveTo(x0, top + wv(u0)); x.lineTo(x1, top + wv(u1)); x.lineTo(x1, top + h / 2 + wv(u1)); x.lineTo(x0, top + h / 2 + wv(u0)); x.fill();
      x.fillStyle = '#c8302c';
      x.beginPath(); x.moveTo(x0, top + h / 2 + wv(u0)); x.lineTo(x1, top + h / 2 + wv(u1)); x.lineTo(x1, top + h + wv(u1)); x.lineTo(x0, top + h + wv(u0)); x.fill();
    }
    x.fillStyle = '#f6f2e6';
    x.beginPath(); x.moveTo(px, top); x.lineTo(px + w * 0.42, top + h / 2 + Math.sin(0.42 * 6 - t * 4) * 7 * 0.42); x.lineTo(px, top + h); x.closePath(); x.fill();
    x.fillStyle = '#f2c230';
    x.beginPath(); x.arc(px + w * 0.15, top + h / 2, h * 0.11, 0, 7); x.fill();
  }

  K.register('school', {
    prepare: function (W, H, p, lite) {
      var r = rng(8);
      var trees = [];
      for (var i = 0; i < 9; i++) trees.push([r() * DW, 330 + r() * 60, 90 + r() * 70]);
      return { trees: trees, r: r };
    },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#6fb2e0'], [0.55, '#bfe0ef'], [0.8, '#f6e1c0'], [1, '#f2c9a0']]);
        K.glow(x, 1300, 200, 300, '255,240,200', 0.5);
      });
      K.layer(g, W, H, cam, 0.06, function (x) {
        volcano(x, 1180, 470, 620, 280, '#8fa8c4', null);
        [[200, 140], [700, 110], [1100, 160]].forEach(function (c) {
          x.save(); x.translate(c[0] + t * 4, c[1]); x.scale(2.6, 0.6);
          K.blob(x, 0, 0, 60, 0.5, rng(c[0]), 10); x.fillStyle = 'rgba(255,255,255,.85)'; x.fill(); x.restore();
        });
      });
      K.layer(g, W, H, cam, 0.2, function (x) {
        st.trees.forEach(function (tr, i) {
          K.blob(x, tr[0], tr[1], tr[2], 0.4, rng(i + 3), 12, 0.6);
          x.fillStyle = i % 2 ? '#3f7d4a' : '#4b8f52'; x.fill();
        });
      });
      /* the building: two storeys, a corridor along each, cream and green */
      K.layer(g, W, H, cam, 0.35, function (x) {
        var L = 160, R = 1440, top = 330, mid = 470, bot = 620;
        x.fillStyle = '#3d6b4b';
        x.beginPath(); x.moveTo(L - 40, top + 8); x.lineTo(L + 30, top - 34); x.lineTo(R - 30, top - 34); x.lineTo(R + 40, top + 8); x.closePath(); x.fill();
        x.fillStyle = '#efe4c8'; x.fillRect(L, top, R - L, bot - top);
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(L, top, R - L, 24);
        [top + 20, mid].forEach(function (fy, f) {
          for (var c = 0; c < 8; c++) {
            var cx2 = L + 40 + c * 158;
            x.fillStyle = '#2f5a40'; x.fillRect(cx2, fy + 26, 44, 100);
            x.fillStyle = '#9fc2cf'; x.fillRect(cx2 + 60, fy + 34, 80, 56);
            x.strokeStyle = '#2f5a40'; x.lineWidth = 3;
            for (var j = 0; j < 6; j++) { x.beginPath(); x.moveTo(cx2 + 60, fy + 40 + j * 9); x.lineTo(cx2 + 140, fy + 40 + j * 9); x.stroke(); }
          }
          /* the corridor railing */
          x.fillStyle = '#3d6b4b'; x.fillRect(L, fy + 120, R - L, 8);
          for (var rx2 = L; rx2 < R; rx2 += 22) x.fillRect(rx2, fy + 92, 4, 30);
          x.fillRect(L, fy + 90, R - L, 5);
        });
        x.fillStyle = '#dccfae'; x.fillRect(L, mid - 4, R - L, 10);
        /* the name board over the stairs, unreadable on purpose */
        x.fillStyle = '#2f5a40'; x.fillRect(640, top - 30, 320, 34);
        x.fillStyle = 'rgba(240,230,200,.8)'; x.fillRect(660, top - 20, 280, 6); x.fillRect(700, top - 10, 200, 4);
      });
      /* the grounds, the flagpole, the flag rising */
      K.layer(g, W, H, cam, 0.6, function (x) {
        x.fillStyle = lin(x, 0, 620, 0, 900, [[0, '#9aa98a'], [1, '#6e7d63']]);
        x.fillRect(-400, 620, DW + 800, 400);
        x.fillStyle = '#c9c3b2'; x.fillRect(700, 700, 200, 20);
        x.fillStyle = '#e9e6dc'; x.fillRect(795, 260, 10, 450);
        var k = p.flag ? Math.min(1, t / 7) : 1;
        var fy = 640 - 360 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        flag(x, 805, fy, 130, 78, t);
        /* students in line, small, facing the flag */
        for (var s = 0; s < 14; s++) {
          K.student(x, 300 + s * 34 + (s > 6 ? 520 : 0), 790 + (s % 2) * 18, 0.18, 'stand',
            { fill: '#2b3038', rim: 'rgba(255,240,210,.5)', skirt: s % 3 === 0, face: s > 6 ? -1 : 1 });
        }
      });
    }
  });

  /* ---- the classroom ----------------------------------------------------
     params: people ('meet' | 'none'), device ('wake' | 'dark' | absent),
     rain (0..1), light ('morning' | 'dusk' | 'night'), skyLight */
  var LIGHT = {
    morning: { wall: ['#e9dfc6', '#d8cba9'], board: '#2f4f3e', win: ['#bfe3f2', '#fff2d6'], floor: ['#a88c66', '#7c6448'], shade: 0, beam: 'rgba(255,236,190,' },
    dusk:    { wall: ['#7a6a73', '#4d4452'], board: '#22362c', win: ['#4b5d86', '#e09a72'], floor: ['#5a4a46', '#382e2c'], shade: 0.25, beam: 'rgba(255,170,120,' },
    night:   { wall: ['#2a3140', '#1a1f2a'], board: '#16241d', win: ['#0f1a33', '#1e2a4d'], floor: ['#25211f', '#151312'], shade: 0.5, beam: null }
  };
  function backWall(x, L, p) {
    x.fillStyle = lin(x, 0, 0, 0, 640, [[0, L.wall[0]], [1, L.wall[1]]]);
    x.fillRect(-400, -300, DW + 800, 960);
    /* windows on the right with the outside in them */
    for (var w = 0; w < 2; w++) {
      var wx = 1080 + w * 220, wy = 150, ww = 180, wh = 260;
      x.fillStyle = lin(x, 0, wy, 0, wy + wh, [[0, L.win[0]], [1, L.win[1]]]);
      x.fillRect(wx, wy, ww, wh);
      if (p.light === 'dusk' || p.light === 'night') { volcano(x, wx + 120 - w * 220, wy + wh, 260, 120, p.light === 'night' ? '#0a1224' : '#3c3a5c', null); }
    }
    /* the board, with yesterday's lesson half erased */
    x.fillStyle = '#5b4632'; x.fillRect(250, 120, 700, 330);
    x.fillStyle = L.board; x.fillRect(266, 136, 668, 298);
    x.strokeStyle = 'rgba(235,240,230,.55)'; x.lineWidth = 3; x.lineCap = 'round';
    x.font = '30px "Plex Mono", monospace'; x.fillStyle = 'rgba(235,240,230,.6)';
    x.fillText('x² + 2x − 8 = 0', 300, 200);
    x.fillText('∠A + ∠B = 90°', 300, 260);
    x.beginPath(); x.moveTo(700, 380); x.lineTo(860, 380); x.lineTo(700, 220); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(235,240,230,.15)'; x.fillRect(420, 300, 220, 80);
    /* a clock, a fan, the lights */
    x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(160, 150, 34, 0, 7); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.moveTo(160, 150); x.lineTo(160, 128); x.moveTo(160, 150); x.lineTo(176, 156); x.stroke();
    x.fillStyle = 'rgba(255,255,255,' + (p.light === 'night' ? 0.15 : 0.7) + ')'; x.fillRect(300, 40, 200, 10); x.fillRect(800, 40, 200, 10);
    /* the door on the left, open, the corridor bright behind it */
    x.fillStyle = p.light === 'night' ? '#1c2230' : '#fff3da'; x.fillRect(40, 200, 130, 300);
    x.fillStyle = '#3a4a44'; x.fillRect(32, 196, 8, 306); x.fillRect(170, 196, 8, 306);
  }

  K.register('classroom', {
    prepare: function (W, H, p) {
      var L = LIGHT[p.light || 'morning'];
      /* the back wall does not move: it is painted once */
      return { wall: K.bake(W, H, DW + 800, DH + 600, function (x) { x.translate(400, 300); backWall(x, L, p); }, 1.12) };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var L = LIGHT[p.light || 'morning'];
      K.layer(g, W, H, cam, 0.15, function (x) {
        K.stamp(x, st.wall, -400, -300);
        for (var w = 0; w < 2; w++) {
          var wx = 1080 + w * 220, wy = 150, ww = 180, wh = 260;
          if (p.skyLight && w === 1) {
            var bl = Math.max(0, Math.sin(t * 2.2)) * Math.min(1, t / 2);
            K.glow(x, wx + 110, wy + 70, 50, '160,240,255', 0.9 * bl);
          }
          if (p.rain) windowRain(x, wx, wy, ww, wh, t, p.rain);
          x.strokeStyle = '#3a4a44'; x.lineWidth = 8; x.strokeRect(wx, wy, ww, wh);
          x.lineWidth = 4; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
          for (var j = 1; j < 8; j++) { x.lineWidth = 2; x.beginPath(); x.moveTo(wx, wy + j * wh / 8); x.lineTo(wx + ww, wy + j * wh / 8); x.stroke(); }
        }
      });
      /* sunlight across the room */
      if (L.beam) {
        K.layer(g, W, H, cam, 0.25, function (x) {
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = lin(x, 1100, 150, 700, 800, [[0, L.beam + '.28)'], [1, L.beam + '0)']]);
          x.beginPath(); x.moveTo(1080, 150); x.lineTo(1480, 150); x.lineTo(1100, 900); x.lineTo(420, 900); x.closePath(); x.fill();
          x.restore();
        });
      }
      /* floor, the teacher's table, the device */
      K.layer(g, W, H, cam, 0.4, function (x) {
        x.fillStyle = lin(x, 0, 500, 0, 900, [[0, L.floor[0]], [1, L.floor[1]]]);
        x.fillRect(-400, 500, DW + 800, 500);
        x.fillStyle = '#6d4b30'; x.fillRect(520, 520, 520, 40);
        x.fillStyle = '#4c3322'; x.fillRect(540, 560, 20, 150); x.fillRect(1000, 560, 20, 150);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(540, 560, 480, 30);
        if (p.device) device(x, 780, 492, 0.9, p.device, t);
        else if (p.people === 'meet') device(x, 760, 492, 0.9, 'lit', t);
      });
      /* the two of them */
      if (p.people === 'meet') {
        K.layer(g, W, H, cam, 0.5, function (x) {
          K.student(x, 640, 760, 0.95, 'stand', { face: 1, rim: 'rgba(255,220,150,.8)', bag: true });
          K.student(x, 120, 720, 0.82, 'binder', { face: 1, rim: 'rgba(255,240,210,.9)', skirt: true });
        });
      }
      /* the armchairs in the front row, dark against the room */
      K.layer(g, W, H, cam, 0.85, function (x) {
        for (var c = 0; c < 4; c++) {
          var cx = 120 + c * 420;
          x.fillStyle = '#1c140e';
          x.fillRect(cx, 780, 220, 26); x.fillRect(cx + 10, 640, 16, 250); x.fillRect(cx + 190, 700, 14, 200);
          x.fillRect(cx + 10, 640, 120, 18);
          x.fillStyle = 'rgba(255,230,190,.12)'; x.fillRect(cx, 780, 220, 4);
        }
      });
      if (L.shade) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = 'rgba(5,8,20,' + L.shade * 0.6 + ')'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
        g.restore();
        /* the device's own light, on top of the dark */
        if (p.device === 'wake') K.layer(g, W, H, cam, 0.4, function (x) { K.glow(x, 764, 482, 220, '255,190,90', 0.25 * Math.min(1, Math.max(0, t - 0.8))); });
      }
    }
  });

  /* ---- the market at dawn ------------------------------------------------ */
  K.register('market', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H, p) {
      var dawn = p.time !== 'morning';
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, dawn ? [[0, '#2c3566'], [0.45, '#8a6a8c'], [0.7, '#f2a27a'], [1, '#ffd29a']]
                      : [[0, '#7fb8e2'], [0.6, '#cfe6ef'], [1, '#fff0d0']]);
        K.glow(x, 800, 520, 300, dawn ? '255,200,140' : '255,250,230', 0.6);
      });
      /* the aisle: stalls receding toward the light */
      K.layer(g, W, H, cam, 0.3, function (x) {
        x.fillStyle = dawn ? '#2b2530' : '#6b6a6e';
        x.fillRect(-400, 560, DW + 800, 400);
        var cols = ['#c8302c', '#2a5aa8', '#e2b02c', '#2e8a5a'];
        for (var side = -1; side <= 1; side += 2) {
          for (var i = 4; i >= 0; i--) {
            var k = i / 4, depthScale = 1 - k * 0.68;
            var cx = 800 + side * (160 + (1 - k) * 640), w = 360 * depthScale, h = 300 * depthScale;
            var top = 560 - h * 0.85;
            /* awning, striped */
            var col = cols[(i + (side > 0 ? 2 : 0)) % 4];
            for (var sIdx = 0; sIdx < 6; sIdx++) {
              x.fillStyle = sIdx % 2 ? col : '#f2ece0';
              var sx0 = cx - w / 2 + sIdx * w / 6;
              x.beginPath(); x.moveTo(sx0, top); x.lineTo(sx0 + w / 6, top);
              x.lineTo(sx0 + w / 6 + side * 6, top + 36 * depthScale); x.lineTo(sx0 + side * 6, top + 36 * depthScale); x.fill();
            }
            x.fillStyle = dawn ? '#3a2f2c' : '#7b5a40'; x.fillRect(cx - w / 2, top + 36 * depthScale, w, h * 0.55);
            /* fruit in crates on the counter */
            var cr = rng(i * 7 + (side + 2));
            for (var f = 0; f < 10; f++) {
              var fx = cx - w / 2 + 10 * depthScale + cr() * (w - 20 * depthScale), fy = top + h * 0.62 + cr() * 14 * depthScale;
              x.fillStyle = ['#f2c230', '#e9a23a', '#7cb342', '#e85a3a'][Math.floor(cr() * 4)];
              x.beginPath(); x.arc(fx, fy, 9 * depthScale, 0, 7); x.fill();
            }
            x.fillStyle = dawn ? '#241c18' : '#5a3f2c'; x.fillRect(cx - w / 2, top + h * 0.7, w, h * 0.3);
            /* the bulb */
            x.fillStyle = '#222'; x.fillRect(cx, top + 36 * depthScale, 2, 26 * depthScale);
            K.glow(x, cx, top + 66 * depthScale, 70 * depthScale, '255,200,120', dawn ? 0.75 : 0.25);
            x.fillStyle = '#fff1c8'; x.beginPath(); x.arc(cx, top + 66 * depthScale, 6 * depthScale, 0, 7); x.fill();
          }
        }
      });
      /* the front stall and the device among the crates */
      K.layer(g, W, H, cam, 0.7, function (x) {
        x.fillStyle = '#4a3324'; x.fillRect(420, 700, 760, 60);
        x.fillStyle = '#6b4a30'; for (var c = 0; c < 4; c++) x.fillRect(440 + c * 190, 620, 160, 84);
        x.strokeStyle = '#3a2618'; x.lineWidth = 3;
        for (c = 0; c < 4; c++) for (var sl = 0; sl < 3; sl++) { x.beginPath(); x.moveTo(440 + c * 190, 640 + sl * 22); x.lineTo(600 + c * 190, 640 + sl * 22); x.stroke(); }
        var fr = rng(55);
        for (var m = 0; m < 46; m++) {
          var crate = m % 4; if (crate === 2) continue;
          x.fillStyle = ['#f2c230', '#7cb342', '#f2c230', '#e85a3a'][crate];
          x.beginPath(); x.arc(452 + crate * 190 + fr() * 136, 612 + fr() * 12, 13, 0, 7); x.fill();
        }
        /* a hand-lettered price card */
        x.fillStyle = '#f4ecd6'; x.fillRect(470, 560, 110, 60);
        x.fillStyle = '#2a2a2a'; x.font = '600 26px "Plex Sans Condensed", sans-serif'; x.fillText('₱40/kg', 478, 600);
        device(x, 900, 610, 0.95, p.device || 'lit', t);
      });
      if (dawn) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = 'rgba(20,10,40,.18)'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
        g.restore();
      }
    }
  });

  /* ---- the jeepney terminal at noon -------------------------------------- */
  /* A jeepney, not a bus: a long hood and a chrome grille in front, a roof
     that overhangs the open back, painted stripes, a route board, a mirror. */
  function jeepney(x, cx, base, s, body, face) {
    x.save(); x.translate(cx, base); x.scale(s * (face || 1), s);
    x.fillStyle = 'rgba(0,0,0,.25)'; ell(x, 0, 0, 290, 16); x.fill();
    /* the cabin and passenger body */
    x.fillStyle = body; x.fillRect(-250, -150, 380, 118);
    /* the hood, lower, out in front */
    x.beginPath(); x.moveTo(130, -112); x.lineTo(218, -104); x.lineTo(236, -40); x.lineTo(130, -32); x.closePath(); x.fill();
    /* the grille and bumper, all chrome */
    x.fillStyle = '#d9dfe3'; x.fillRect(226, -100, 22, 64);
    x.fillStyle = '#9aa5ac'; for (var gr = 0; gr < 5; gr++) x.fillRect(230, -94 + gr * 12, 14, 4);
    x.fillStyle = '#e6eaed'; x.fillRect(150, -36, 110, 10);
    x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(240, -110, 8, 0, 7); x.fill();
    /* the windscreen */
    x.fillStyle = '#a9c4cf'; x.beginPath(); x.moveTo(132, -146); x.lineTo(170, -146); x.lineTo(196, -112); x.lineTo(132, -112); x.closePath(); x.fill();
    /* the roof, overhanging both ends, a rack on it */
    x.fillStyle = '#eef1f3'; x.fillRect(-276, -172, 470, 22);
    x.fillStyle = '#b8c0c6'; for (var rk = 0; rk < 9; rk++) x.fillRect(-260 + rk * 52, -184, 4, 12);
    x.fillRect(-264, -186, 440, 4);
    /* open side windows, passengers' heads in some */
    x.fillStyle = '#1b2830';
    for (var w = 0; w < 6; w++) x.fillRect(-236 + w * 58, -140, 46, 36);
    x.fillStyle = '#0b1318';
    [0, 2, 3, 5].forEach(function (w) { x.beginPath(); x.arc(-213 + w * 58, -116, 9, 0, 7); x.fill(); });
    /* the open back */
    x.fillStyle = '#0e171c'; x.fillRect(-250, -140, 18, 104);
    /* stripes, the way they are painted */
    x.fillStyle = '#f2c230'; x.fillRect(-250, -92, 470, 8);
    x.fillStyle = '#c8302c'; x.fillRect(-250, -80, 470, 5);
    x.fillStyle = '#ffffff'; x.fillRect(-250, -72, 380, 3);
    /* the route board on the roof's front edge */
    x.fillStyle = '#f7f3e6'; x.fillRect(40, -204, 120, 22);
    x.fillStyle = '#1b2830'; x.font = '600 17px "Plex Sans Condensed", sans-serif'; x.textAlign = 'center';
    x.save(); if (face < 0) { x.scale(-1, 1); x.fillText('CENTRO', -100, -188); } else x.fillText('CENTRO', 100, -188); x.restore();
    /* the hood ornament: a small chrome horse, as a mark */
    x.fillStyle = '#e6eaed'; x.beginPath(); x.moveTo(212, -104); x.lineTo(222, -126); x.lineTo(228, -104); x.fill();
    /* wheels */
    [[-150, 0], [170, 0]].forEach(function (wh) {
      x.fillStyle = '#111'; x.beginPath(); x.arc(wh[0], -16, 32, 0, 7); x.fill();
      x.fillStyle = '#c8ced2'; x.beginPath(); x.arc(wh[0], -16, 13, 0, 7); x.fill();
    });
    x.restore();
  }
  K.register('terminal', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#4f9fe0'], [0.6, '#a9d6f0'], [1, '#f2f0e0']]);
        K.glow(x, 1200, 80, 260, '255,252,230', 0.9);
      });
      K.layer(g, W, H, cam, 0.1, function (x) { volcano(x, 400, 520, 560, 250, '#7f9bb8', null); });
      K.layer(g, W, H, cam, 0.25, function (x) {
        /* the overpass */
        x.fillStyle = '#b8b2a4'; x.fillRect(-400, 330, DW + 800, 40);
        x.fillStyle = '#a19b8e'; x.fillRect(-400, 370, DW + 800, 14);
        for (var c = 0; c < 6; c++) x.fillRect(80 + c * 300, 384, 40, 200);
        x.fillStyle = '#8c8676';
        for (c = 0; c < 40; c++) x.fillRect(-400 + c * 60, 316, 4, 16);
        x.fillRect(-400, 312, DW + 800, 4);
      });
      K.layer(g, W, H, cam, 0.45, function (x) {
        x.fillStyle = lin(x, 0, 560, 0, 900, [[0, '#7a7570'], [1, '#55514c']]);
        x.fillRect(-400, 560, DW + 800, 400);
        x.fillStyle = '#e9e2c8'; for (var l = 0; l < 6; l++) x.fillRect(100 + l * 260, 700, 120, 8);
        jeepney(x, 260, 640, 0.75, '#2a6fb0', 1);
        jeepney(x, 1340, 650, 0.8, '#c8302c', -1);
        jeepney(x, 820, 600, 0.5, '#2e8a5a', 1);
      });
      /* heat shimmer over the road */
      K.layer(g, W, H, cam, 0.5, function (x) {
        x.save(); x.globalCompositeOperation = 'lighter';
        for (var i = 0; i < 6; i++) {
          x.fillStyle = 'rgba(255,255,240,' + (0.03 + 0.02 * Math.sin(t * 3 + i)) + ')';
          x.fillRect(-200, 600 + i * 8 + Math.sin(t * 4 + i) * 2, DW + 400, 3);
        }
        x.restore();
      });
      K.layer(g, W, H, cam, 0.65, function (x) {
        if (p.split) {
          device(x, 300, 720, 0.8, 'lit', t);
          K.student(x, 420, 800, 0.95, 'stand', { face: 1, rim: 'rgba(255,250,230,.8)', bag: true });
          K.student(x, 1300, 790, 0.75, 'phone', { face: -1, rim: 'rgba(255,250,230,.8)', skirt: true });
          x.fillStyle = '#7a2d27'; x.fillRect(1260, 720, 34, 44);
          /* their voices across the gap */
          x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(140,230,250,.55)'; x.lineWidth = 3;
          for (var a = 0; a < 3; a++) {
            var ph = ((t * 0.8 + a / 3) % 1);
            x.globalAlpha = 1 - ph;
            x.beginPath(); x.arc(1300, 590, 30 + ph * 200, Math.PI * 0.9, Math.PI * 1.25); x.stroke();
            x.beginPath(); x.arc(420, 590, 30 + ph * 200, -Math.PI * 0.25, Math.PI * 0.1); x.stroke();
          }
          x.restore();
        } else {
          /* walking back to each other */
          var k = Math.min(1, t / 8);
          K.student(x, 300 + 360 * k, 830, 0.95, 'walk', { face: 1, rim: 'rgba(255,250,230,.8)', bag: true, t: t });
          K.student(x, 1320 - 380 * k, 830, 0.92, 'walk', { face: -1, rim: 'rgba(255,250,230,.8)', skirt: true, t: t + 0.4 });
        }
      });
    }
  });

  /* ---- the basketball court in a storm, power out ------------------------ */
  K.register('court', {
    prepare: function (W, H, p, lite) { return { lite: lite }; },
    draw: function (g, t, cam, st, W, H, p) {
      var storm = p.storm === undefined ? 1 : p.storm;
      /* lightning: two cracks at fixed marks, scaled by FLASHES */
      var bolt = 0;
      [[1.2, 1], [5.5, 0.7], [9.3, 0.8]].forEach(function (b) {
        var d = t - b[0];
        if (d > 0 && d < 0.5) bolt = Math.max(bolt, b[1] * storm * (d < 0.08 ? 1 : d < 0.16 ? 0.3 : d < 0.22 ? 0.8 : 1 - d * 2));
      });
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#0b0f18'], [0.6, '#1a2230'], [1, '#262e3a']]);
        if (bolt > 0) {
          x.save(); x.globalAlpha = Math.min(1, bolt * (D.cine.flashK ? D.cine.flashK() : 1));
          x.strokeStyle = '#e8f0ff'; x.lineWidth = 4;
          x.beginPath(); x.moveTo(1100, -100); x.lineTo(1060, 80); x.lineTo(1120, 140); x.lineTo(1050, 330); x.stroke();
          x.restore();
        }
      });
      K.layer(g, W, H, cam, 0.15, function (x) {
        volcano(x, 1100, 560, 600, 260, '#151b26', null);
        roofs(x, 470, 31, '#0b0f16', 'rgba(150,170,200,.15)', null);
      });
      K.layer(g, W, H, cam, 0.4, function (x) {
        /* the court: wet concrete, lines, a puddle holding the light */
        x.fillStyle = lin(x, 0, 560, 0, 900, [[0, '#2a3038'], [1, '#14181e']]);
        x.fillRect(-400, 560, DW + 800, 400);
        x.strokeStyle = 'rgba(220,220,200,.35)'; x.lineWidth = 4;
        ell(x, 800, 700, 260, 60); x.stroke();
        x.beginPath(); x.moveTo(-200, 640); x.lineTo(DW + 200, 640); x.stroke();
        /* the hoop */
        x.fillStyle = '#10141a'; x.fillRect(1360, 260, 18, 380);
        x.fillStyle = '#d8dde2'; x.fillRect(1250, 250, 180, 110);
        x.strokeStyle = '#10141a'; x.lineWidth = 5; x.strokeRect(1250, 250, 180, 110); x.strokeRect(1310, 300, 60, 46);
        x.strokeStyle = '#d4602c'; x.lineWidth = 5; ell(x, 1340, 366, 34, 8); x.stroke();
        x.strokeStyle = 'rgba(230,230,230,.5)'; x.lineWidth = 1.5;
        for (var n = 0; n < 7; n++) { x.beginPath(); x.moveTo(1310 + n * 10, 368); x.lineTo(1318 + n * 6, 410); x.stroke(); }
        /* a bench with the device on it */
        x.fillStyle = '#3a2a20'; x.fillRect(560, 690, 380, 20); x.fillRect(580, 710, 16, 60); x.fillRect(900, 710, 16, 60);
        device(x, 750, 672, 0.85, p.after ? 'dark' : 'lit', t);
      });
      /* the two of them, lit only by their phones */
      K.layer(g, W, H, cam, 0.55, function (x) {
        K.student(x, 470, 840, 0.95, 'phone', { face: 1, rim: 'rgba(200,230,255,.6)', bag: true });
        K.student(x, 1060, 850, 0.95, 'binder', { face: -1, rim: 'rgba(200,230,255,.6)', skirt: true });
        /* torch beams onto the device and onto the binder */
        x.save(); x.globalCompositeOperation = 'lighter';
        [[505, 560, 760, 660, 1], [1030, 580, 1000, 760, 0.8]].forEach(function (b) {
          var gx = lin(x, b[0], b[1], b[2], b[3], [[0, 'rgba(220,235,255,.55)'], [1, 'rgba(220,235,255,0)']]);
          x.fillStyle = gx;
          var dx = b[2] - b[0], dy = b[3] - b[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
          x.beginPath(); x.moveTo(b[0], b[1]);
          x.lineTo(b[2] + nx * 90, b[3] + ny * 90); x.lineTo(b[2] - nx * 90, b[3] - ny * 90); x.closePath(); x.fill();
          K.glow(x, b[2], b[3], 120, '220,235,255', 0.25 * b[4]);
        });
        x.restore();
        /* puddles throwing it back */
        x.fillStyle = 'rgba(160,190,220,.12)'; ell(x, 760, 790, 160, 14); x.fill();
      });
      K.layer(g, W, H, cam, 0.9, function (x) { K.rain(x, t, storm, 0.18, st.lite); });
      K.layer(g, W, H, cam, 0, function (x) { if (bolt > 0) K.flash(x, bolt * 0.35); });
    }
  });

  /* ---- the bridge over the river ----------------------------------------
     params: night + saucer (before the last device), or sunrise + sitting
     (the finale) */
  K.register('bridge', {
    prepare: function (W, H, p, lite) {
      return {
        stars: K.stars(W, H, lite ? 200 : 400, 61, 460, false),
        city: skyline(W, H, 21, { lit: p.night ? 0.75 : 0.08, fill: p.night ? '#0b1424' : '#3a3550', tall: 240 }),
        lite: lite
      };
    },
    draw: function (g, t, cam, st, W, H, p) {
      var night = !!p.night;
      K.layer(g, W, H, cam, 0, function (x) {
        if (night) K.sky(x, [[0, '#040814'], [0.6, '#0f1d3c'], [1, '#253463']]);
        else K.sky(x, [[0, '#3c4f8a'], [0.4, '#c98aa2'], [0.65, '#f7b27a'], [0.85, '#ffd9a0'], [1, '#fff0c8']]);
        if (!night) {
          var rise = Math.min(1, t / 14);
          K.glow(x, 520, 520 - 60 * rise, 380, '255,220,160', 0.85);
          x.fillStyle = '#fff4d6'; x.beginPath(); x.arc(520, 520 - 60 * rise, 46, 0, 7); x.fill();
        }
      });
      if (night) K.layer(g, W, H, cam, 0.04, function (x) { K.starsAt(x, st.stars); });
      K.layer(g, W, H, cam, 0.1, function (x) {
        volcano(x, 560, 560, 720, 330, night ? '#141d3a' : '#5a4e74', night ? 'rgba(150,170,230,.3)' : 'rgba(255,210,170,.5)');
      });
      /* the saucer over the city, its beam reaching the bridge */
      if (p.saucer) {
        K.layer(g, W, H, cam, 0.2, function (x) {
          var k = Math.min(1, t / 3);
          x.save(); x.translate(560, 200 + Math.sin(t * 1.2) * 4); x.scale(0.34, 0.34);
          x.globalAlpha = k; K.saucer(x, t); x.restore();
        });
      }
      K.layer(g, W, H, cam, 0.25, function (x) {
        K.stamp(x, st.city, -300, 160);
        palm(x, 200, 580, 180, 26, night ? '#070d18' : '#3a2f44');
        palm(x, 1460, 580, 220, -30, night ? '#070d18' : '#3a2f44');
      });
      /* the river: sky and lights in it */
      K.layer(g, W, H, cam, 0.4, function (x) {
        x.fillStyle = night ? lin(x, 0, 580, 0, 900, [[0, '#0c1834'], [1, '#050a16']])
                            : lin(x, 0, 580, 0, 900, [[0, '#f0b48a'], [0.5, '#a07a94'], [1, '#3a3f66']]);
        x.fillRect(-400, 580, DW + 800, 400);
        var r = rng(9);
        for (var i = 0; i < 90; i++) {
          var rx = r() * DW, ry = 590 + r() * 220, w2 = 10 + r() * 60;
          x.fillStyle = night ? 'rgba(255,200,120,' + (0.12 + 0.18 * Math.sin(t * 2 + i)) + ')'
                              : 'rgba(255,240,210,' + (0.15 + 0.2 * Math.sin(t * 2 + i)) + ')';
          x.fillRect(rx + Math.sin(t + i) * 5, ry, w2, 2);
        }
      });
      /* the beam comes down in front of the skyline, onto the bridge */
      if (p.saucer) {
        K.layer(g, W, H, cam, 0.45, function (x) {
          K.beam(x, 560, 250, 760, 40, 170, Math.max(0, (t - 1.2) / 1.6), t, st.lite);
        });
      }
      /* the bridge itself: deck, rail, lamps */
      K.layer(g, W, H, cam, 0.7, function (x) {
        var deck = 760;
        x.fillStyle = night ? '#141a22' : '#4a3c4a';
        x.fillRect(-400, deck, DW + 800, 60);
        x.fillStyle = night ? '#0b0f15' : '#33293a'; x.fillRect(-400, deck + 60, DW + 800, 200);
        for (var a = -1; a < 5; a++) { x.beginPath(); x.arc(a * 420 + 210, deck + 260, 200, Math.PI, 0); x.fillStyle = night ? '#0c1834' : '#7a6080'; x.fill(); }
        x.fillStyle = night ? '#1f2833' : '#5d4c5c';
        x.fillRect(-400, deck - 70, DW + 800, 8);
        for (var b = -400; b < DW + 400; b += 26) x.fillRect(b, deck - 66, 6, 66);
        for (var l = 0; l < 5; l++) {
          var lx = 60 + l * 380;
          x.fillRect(lx, deck - 250, 8, 250); x.fillRect(lx - 30, deck - 252, 38, 8);
          if (night) { K.glow(x, lx - 26, deck - 238, 90, '255,210,140', 0.7); x.fillStyle = '#fff1c8'; x.beginPath(); x.arc(lx - 26, deck - 240, 7, 0, 7); x.fill(); x.fillStyle = '#1f2833'; }
        }
        if (p.sitting) {
          K.student(x, 720, deck - 66, 0.62, 'sit', { face: 1, rim: 'rgba(255,220,170,.9)', bag: true });
          K.student(x, 860, deck - 66, 0.62, 'sit', { face: -1, rim: 'rgba(255,220,170,.9)', skirt: true });
          x.fillStyle = '#7a2d27'; x.fillRect(782, deck - 108, 26, 34);
        } else if (p.saucer) {
          device(x, 560, deck - 18, 0.55, 'lit', t);
          K.student(x, 450, deck, 0.6, 'stand', { face: 1, rim: 'rgba(160,240,255,.8)', bag: true });
          K.student(x, 680, deck, 0.6, 'binder', { face: -1, rim: 'rgba(160,240,255,.8)', skirt: true });
        }
      });
    }
  });
})(DEFUSAL);
