/* ==========================================================================
   DEFUSAL — the cutscene kit: the device, the desk, the two apart.
   ========================================================================== */

(function (D) {
  'use strict';

  var K = D.cine.kit, DW = K.DW, DH = K.DH;
  var rng = K.rng, ell = K.ell, lin = K.lin, rad = K.rad;

  function rr(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py); x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py); x.closePath();
  }

  /* The device, close: the same object the defuser holds in the game — a
     dark case, a clock, bays — waking up one light at a time. */
  K.register('device', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H, p) {
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#04070c'], [1, '#0b1218']]);
        K.glow(x, 800, 470, 700, '60,120,150', 0.25);
      });
      K.layer(g, W, H, cam, 0.5, function (x) {
        var on = function (d) { return p.wake ? Math.max(0, Math.min(1, (t - d) / 0.4)) : 1; };
        /* a surface under it, catching its light */
        x.fillStyle = lin(x, 0, 650, 0, 900, [[0, '#121a20'], [1, '#05080b']]);
        x.fillRect(-400, 650, DW + 800, 400);
        x.fillStyle = 'rgba(0,0,0,.6)'; ell(x, 800, 690, 520, 40); x.fill();
        /* the case */
        rr(x, 330, 230, 940, 450, 34);
        x.fillStyle = lin(x, 0, 230, 0, 680, [[0, '#44565e'], [0.5, '#2c383e'], [1, '#182128']]);
        x.fill(); x.lineWidth = 8; x.strokeStyle = '#06090b'; x.stroke();
        rr(x, 330, 230, 940, 450, 34); x.save(); x.clip();
        x.lineWidth = 6; x.strokeStyle = 'rgba(180,230,240,.25)'; x.stroke(); x.restore();
        /* control strip */
        rr(x, 520, 260, 560, 110, 18); x.fillStyle = '#16222a'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#06090b'; x.stroke();
        rr(x, 548, 280, 260, 70, 10); x.fillStyle = '#04080a'; x.fill();
        var c = on(0.6);
        if (c > 0) {
          x.save();
          x.font = '64px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillStyle = 'rgba(255,200,97,.08)'; x.fillText('88:88', 678, 318);
          x.shadowColor = 'rgba(255,190,80,.95)'; x.shadowBlur = 26;
          x.fillStyle = 'rgba(255,200,97,' + c + ')';
          var sec = Math.max(0, 599 - Math.floor(Math.max(0, t - 1)));
          x.fillText(('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2), 678, 318);
          x.restore();
          K.glow(x, 678, 318, 220, '255,190,90', 0.25 * c);
        }
        /* strike lamps and serial */
        for (var s = 0; s < 3; s++) { x.fillStyle = '#20130f'; x.beginPath(); x.arc(850 + s * 34, 300, 11, 0, 7); x.fill(); }
        rr(x, 832, 322, 220, 34, 6); x.fillStyle = '#071014'; x.fill();
        var sc = on(1.0);
        if (sc > 0) {
          x.save(); x.font = '30px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.shadowColor = 'rgba(111,215,232,.9)'; x.shadowBlur = 14; x.fillStyle = 'rgba(111,215,232,' + sc + ')';
          x.fillText('252KP7', 942, 340); x.restore();
        }
        /* the bays, lighting up in turn */
        for (var b = 0; b < 6; b++) {
          var bx = 360 + (b % 3) * 300, by = 390 + Math.floor(b / 3) * 140;
          if (b === 1 || b === 4) bx += 0;
          var k = on(1.3 + b * 0.25);
          rr(x, bx + 10, by, 270, 124, 14);
          x.fillStyle = 'rgb(' + Math.round(40 + 196 * k) + ',' + Math.round(48 + 191 * k) + ',' + Math.round(54 + 186 * k) + ')';
          x.fill(); x.lineWidth = 5; x.strokeStyle = '#06090b'; x.stroke();
          if (k > 0) {
            rr(x, bx + 10, by, 270, 124, 14); x.save(); x.globalCompositeOperation = 'lighter';
            x.lineWidth = 4; x.strokeStyle = 'rgba(140,220,236,' + 0.5 * k + ')'; x.stroke(); x.restore();
            /* each bay a different puzzle's silhouette */
            x.globalAlpha = k;
            x.fillStyle = '#333b3f'; x.strokeStyle = '#333b3f'; x.lineWidth = 4;
            var mx = bx + 145, my = by + 62;
            if (b === 0) { x.beginPath(); x.moveTo(mx - 50, my + 34); x.lineTo(mx + 50, my + 34); x.lineTo(mx, my - 40); x.closePath(); x.stroke(); }
            if (b === 1) { [[0, -34, '#d0574f'], [-34, 0, '#4180ae'], [34, 0, '#ddb63f'], [0, 34, '#4f9d5d']].forEach(function (q) { x.fillStyle = q[2]; x.beginPath(); x.arc(mx + q[0], my + q[1], 16, 0, 7); x.fill(); }); }
            if (b === 2) { x.beginPath(); x.arc(mx - 22, my, 36, 0, 7); x.stroke(); x.beginPath(); x.arc(mx + 22, my, 36, 0, 7); x.stroke(); }
            if (b === 3) { for (var q = 0; q < 4; q++) { x.strokeRect(mx - 100 + q * 52, my - 34, 42, 68); } }
            if (b === 4) { x.beginPath(); x.moveTo(mx - 70, my + 30); x.lineTo(mx + 70, my - 30); x.moveTo(mx - 80, my - 10); x.lineTo(mx + 80, my - 10); x.stroke(); }
            if (b === 5) { x.fillStyle = '#e9dcb2'; x.fillRect(mx - 100, my - 16, 200, 32); x.strokeRect(mx - 100, my - 16, 200, 32); }
            x.globalAlpha = 1;
          }
          /* the status lamp in its corner */
          x.fillStyle = '#ddd6c7'; x.beginPath(); x.arc(bx + 262, by + 18, 8, 0, 7); x.fill();
        }
      });
    }
  });

  /* A desk under a lamp: a ruler, a protractor, a measuring cylinder, two
     playing cards, a pencil — the conventions the questions are built from. */
  K.register('desk', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H) {
      K.layer(g, W, H, cam, 0, function (x) {
        x.fillStyle = lin(x, 0, 0, 0, DH, [[0, '#3d2a1c'], [1, '#2a1c12']]);
        x.fillRect(-400, -300, DW + 800, DH + 600);
        var r = rng(4);
        x.strokeStyle = 'rgba(20,12,6,.35)'; x.lineWidth = 2;
        for (var i = 0; i < 40; i++) {
          var y = -100 + i * 28 + r() * 8;
          x.beginPath(); x.moveTo(-400, y); x.bezierCurveTo(300, y + r() * 20 - 10, 900, y + r() * 20 - 10, DW + 400, y); x.stroke();
        }
        x.save(); x.globalCompositeOperation = 'lighter';
        x.fillStyle = rad(x, 820, 380, 0, 760, [[0, 'rgba(255,214,150,.35)'], [0.6, 'rgba(255,190,120,.1)'], [1, 'rgba(255,190,120,0)']]);
        x.fillRect(-400, -300, DW + 800, DH + 600);
        x.restore();
      });
      K.layer(g, W, H, cam, 0.5, function (x) {
        function shadow(fn) { x.save(); x.translate(10, 14); x.fillStyle = 'rgba(0,0,0,.35)'; fn(true); x.restore(); }
        /* graph paper */
        shadow(function () { x.fillRect(560, 160, 520, 380); });
        x.save(); x.translate(560, 160); x.rotate(-0.03);
        x.fillStyle = '#f2efe4'; x.fillRect(0, 0, 520, 380);
        x.strokeStyle = 'rgba(80,140,180,.3)'; x.lineWidth = 1;
        for (var gx = 0; gx <= 520; gx += 20) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 380); x.stroke(); }
        for (var gy = 0; gy <= 380; gy += 20) { x.beginPath(); x.moveTo(0, gy); x.lineTo(520, gy); x.stroke(); }
        x.strokeStyle = '#2a4f7a'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(60, 320); x.lineTo(300, 320); x.lineTo(60, 120); x.closePath(); x.stroke();
        x.restore();
        /* the ruler */
        shadow(function () { x.fillRect(180, 600, 640, 70); });
        x.save(); x.translate(180, 600); x.rotate(0.04);
        x.fillStyle = '#e9cf73'; x.fillRect(0, 0, 640, 70);
        x.strokeStyle = '#3a2f12'; x.lineWidth = 2;
        for (var tk = 0; tk <= 60; tk++) { x.beginPath(); x.moveTo(10 + tk * 10.3, 0); x.lineTo(10 + tk * 10.3, tk % 10 === 0 ? 30 : tk % 5 === 0 ? 22 : 12); x.stroke(); }
        x.fillStyle = '#3a2f12'; x.font = '600 16px "Plex Mono", monospace';
        for (var nb = 0; nb <= 6; nb++) x.fillText(String(nb), 6 + nb * 103, 50);
        x.restore();
        /* the protractor */
        x.save(); x.translate(1180, 520);
        shadow(function () { x.beginPath(); x.arc(0, 0, 170, Math.PI, 0); x.fill(); });
        x.beginPath(); x.arc(0, 0, 170, Math.PI, 0); x.closePath();
        x.fillStyle = 'rgba(200,235,240,.55)'; x.fill(); x.strokeStyle = '#2a4f5a'; x.lineWidth = 3; x.stroke();
        for (var d2 = 0; d2 <= 180; d2 += 10) {
          var a = Math.PI + d2 * Math.PI / 180;
          x.beginPath(); x.moveTo(Math.cos(a) * 170, Math.sin(a) * 170); x.lineTo(Math.cos(a) * (d2 % 30 ? 156 : 140), Math.sin(a) * (d2 % 30 ? 156 : 140)); x.stroke();
        }
        x.beginPath(); x.arc(0, 0, 70, Math.PI, 0); x.stroke();
        x.restore();
        /* the measuring cylinder with water in it */
        x.save(); x.translate(380, 210);
        shadow(function () { x.fillRect(-40, 0, 80, 300); });
        x.fillStyle = 'rgba(70,150,200,.55)'; x.fillRect(-36, 140, 72, 156);
        x.fillStyle = 'rgba(200,235,250,.25)'; x.fillRect(-40, 0, 80, 300);
        x.strokeStyle = '#cfe8f2'; x.lineWidth = 3; x.strokeRect(-40, 0, 80, 300);
        for (var m = 0; m < 12; m++) { x.beginPath(); x.moveTo(-40, 20 + m * 24); x.lineTo(m % 2 ? -26 : -16, 20 + m * 24); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(22, 10, 8, 280);
        x.restore();
        /* two playing cards */
        [[1240, 160, 0.18, '♥', '#c8302c', 'A'], [1320, 190, 0.32, '♠', '#1a1a1a', '7']].forEach(function (cd) {
          x.save(); x.translate(cd[0], cd[1]); x.rotate(cd[2]);
          shadow(function () { x.fillRect(0, 0, 150, 210); });
          x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, 150, 210);
          x.strokeStyle = '#c9c2b0'; x.lineWidth = 2; x.strokeRect(0, 0, 150, 210);
          x.fillStyle = cd[4]; x.font = '700 34px "Plex Serif", serif'; x.fillText(cd[5], 12, 42);
          x.font = '90px serif'; x.textAlign = 'center'; x.fillText(cd[3], 75, 140);
          x.restore();
        });
        /* a pencil */
        x.save(); x.translate(980, 690); x.rotate(-0.22);
        shadow(function () { x.fillRect(0, 0, 360, 22); });
        x.fillStyle = '#f2c230'; x.fillRect(0, 0, 340, 22);
        x.fillStyle = '#e8c9a0'; x.beginPath(); x.moveTo(340, 0); x.lineTo(380, 11); x.lineTo(340, 22); x.fill();
        x.fillStyle = '#333'; x.beginPath(); x.moveTo(370, 7); x.lineTo(380, 11); x.lineTo(370, 15); x.fill();
        x.fillStyle = '#d88a9a'; x.fillRect(-30, 0, 30, 22); x.fillStyle = '#b9b9b9'; x.fillRect(-6, 0, 12, 22);
        x.restore();
      });
    }
  });

  /* The two of them, apart: one with the device, one with the rules, a
     dotted line of distance between them that only words can cross. */
  K.register('apart', {
    prepare: function () { return {}; },
    draw: function (g, t, cam, st, W, H) {
      K.layer(g, W, H, cam, 0, function (x) {
        K.sky(x, [[0, '#05080d'], [1, '#0c141b']]);
      });
      K.layer(g, W, H, cam, 0.3, function (x) {
        /* two pools of light from above */
        [[420, '111,215,232'], [1180, '255,214,140']].forEach(function (s) {
          x.save(); x.globalCompositeOperation = 'lighter';
          x.fillStyle = lin(x, s[0], 0, s[0], 840, [[0, 'rgba(' + s[1] + ',.0)'], [0.4, 'rgba(' + s[1] + ',.08)'], [1, 'rgba(' + s[1] + ',.2)']]);
          x.beginPath(); x.moveTo(s[0] - 60, -100); x.lineTo(s[0] + 60, -100); x.lineTo(s[0] + 260, 840); x.lineTo(s[0] - 260, 840); x.fill();
          x.fillStyle = 'rgba(' + s[1] + ',.22)'; ell(x, s[0], 836, 260, 30); x.fill();
          x.restore();
        });
        x.fillStyle = '#05080c'; x.fillRect(-400, 836, DW + 800, 200);
      });
      K.layer(g, W, H, cam, 0.5, function (x) {
        K.student(x, 400, 836, 1.25, 'device', { face: 1, rim: 'rgba(140,230,250,.9)', bag: true });
        K.student(x, 1200, 836, 1.25, 'binder', { face: -1, rim: 'rgba(255,220,150,.9)', skirt: true });
        /* the distance, drawn: a dashed line that crawls across */
        x.save(); x.setLineDash([6, 18]); x.lineDashOffset = -t * 30;
        x.strokeStyle = 'rgba(200,220,230,' + Math.min(0.6, t / 2) + ')'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(520, 560); x.lineTo(1080, 560); x.stroke();
        x.restore();
      });
    }
  });
})(DEFUSAL);
