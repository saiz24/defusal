/* ==========================================================================
   DEFUSAL — the title scene: the device on a desk, under a lamp, at night.

   What a player sees before anything else, and behind the main menu: the
   same room the case is played in, with a modelled case on the desk — its
   clock lit and running down, its keys and plates catching the lamp — and a
   camera that never quite stops moving. Built from the same flat toon look
   as the room and the modules.

   Two framings: TITLE (the case centred, the camera drifting in slowly) and
   MAIN (the camera eased round so the case sits on the right and the menu
   has the left of the screen). It only renders while one of those screens
   is up. Without WebGL, or with 3D ROOM off, the shell shows its 2D sky
   instead and this does nothing.
   ========================================================================== */

(function (D) {
  'use strict';

  var T = null, renderer = null, scene = null, camera = null, composer = null;
  var canvas = null, raf = 0, running = false, t0 = 0, framing = 'title';
  var clockTex = null, clockCtx = null, bulb = null, keys = [];
  var camFrom = null, camTo = null, camAt = 0;

  function ok() {
    if (!window.THREE) return false;
    if (D.prefs && D.prefs.get('room') === 'off') return false;
    return true;
  }

  var ramp = null;
  function toon(colour, extra) {
    if (!ramp) {
      var d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
      ramp = new T.DataTexture(d, 3, 1, T.RGBAFormat);
      ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
    }
    var m = new T.MeshToonMaterial({ color: colour, gradientMap: ramp });
    if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
    return m;
  }
  var ink = null;
  function outline(mesh, k) {
    if (!ink) ink = new T.MeshBasicMaterial({ color: '#0b1014', side: T.BackSide });
    var o = new T.Mesh(mesh.geometry, ink); o.scale.setScalar(1 + (k || 0.02)); mesh.add(o); return o;
  }
  function shade(m) { m.castShadow = true; m.receiveShadow = true; return m; }

  function drawClock() {
    var x = clockCtx, w = 512, h = 160;
    x.fillStyle = '#05090b'; x.fillRect(0, 0, w, h);
    var left = Math.max(0, 600 - Math.floor((performance.now() - t0) / 1000));
    var txt = ('0' + Math.floor(left / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2);
    x.font = '128px "Seven Segment", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,200,97,.1)'; x.fillText('88:88', w / 2, h / 2 + 6);
    x.shadowColor = 'rgba(255,190,80,.9)'; x.shadowBlur = 18;
    x.fillStyle = '#ffc861'; x.fillText(txt, w / 2, h / 2 + 6);
    x.shadowBlur = 0;
    clockTex.needsUpdate = true;
    return txt;
  }

  function build() {
    T = window.THREE;
    canvas = document.createElement('canvas');
    canvas.className = 'title3d';
    canvas.setAttribute('aria-hidden', 'true');
    document.getElementById('shell-bg').appendChild(canvas);
    var lite = D.prefs && D.prefs.get('room') === 'lite';
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !lite });
    renderer.debug.checkShaderErrors = /[?&]debug=1/.test(location.search);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = lite ? T.PCFShadowMap : T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.75));
    scene = new T.Scene();
    scene.background = new T.Color('#0d1217');
    scene.fog = new T.Fog('#141c24', 18, 46);
    camera = new T.PerspectiveCamera(32, 1, 0.1, 200);

    /* the room */
    var desk = shade(new T.Mesh(new T.BoxGeometry(40, 0.8, 20), toon('#9a6a44')));
    desk.position.set(0, -2.4, -2); scene.add(desk);
    for (var p = -4; p <= 4; p++) {
      var seam = new T.Mesh(new T.BoxGeometry(40, 0.02, 0.06), new T.MeshBasicMaterial({ color: '#6b4a30' }));
      seam.position.set(0, -1.99, p * 2.1); scene.add(seam);
    }
    var wall = new T.Mesh(new T.PlaneGeometry(80, 40), toon('#43535f'));
    wall.position.set(0, 8, -11); wall.receiveShadow = true; scene.add(wall);

    /* the case: body, control strip, clock, bays with keys and plates */
    var cs = new T.Group(); scene.add(cs);
    var body = shade(new T.Mesh(new T.RoundedBoxGeometry(7.6, 4.3, 1.5, 6, 0.3), toon('#2c383e')));
    outline(body, 0.012); cs.add(body);
    var strip = shade(new T.Mesh(new T.RoundedBoxGeometry(4.4, 0.95, 0.3, 4, 0.1), toon('#16222a')));
    strip.position.set(0, 1.45, 0.8); cs.add(strip);
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; clockCtx = cv.getContext('2d');
    clockTex = new T.CanvasTexture(cv); clockTex.colorSpace = T.SRGBColorSpace;
    var clock = new T.Mesh(new T.PlaneGeometry(1.7, 0.53), new T.MeshBasicMaterial({ map: clockTex, toneMapped: false }));
    clock.position.set(-1.1, 1.45, 0.96); cs.add(clock);
    var glow = new T.Mesh(new T.PlaneGeometry(1.9, 0.7), new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.0, 0.3), transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.set(-1.1, 1.45, 0.97); cs.add(glow);
    for (var s = 0; s < 3; s++) {
      var led = new T.Mesh(new T.SphereGeometry(0.1, 16, 10), new T.MeshBasicMaterial({ color: s === 0 ? new T.Color(2.6, 0.4, 0.3) : '#2a1414' }));
      led.position.set(0.5 + s * 0.3, 1.45, 0.97); cs.add(led);
    }
    var COL = ['#d0574f', '#ddb63f', '#4f9d5d', '#4180ae'];
    [-2.45, 0, 2.45].forEach(function (bx, i) {
      var bay = shade(new T.Mesh(new T.RoundedBoxGeometry(2.25, 2.2, 0.2, 4, 0.08), toon('#dfe4e6')));
      bay.position.set(bx, -0.45, 0.78); outline(bay, 0.012); cs.add(bay);
      if (i === 0) {
        [[0, 0.5], [-0.5, 0], [0.5, 0], [0, -0.5]].forEach(function (q, k) {
          var dome = shade(new T.Mesh(new T.SphereGeometry(0.24, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(COL[k])));
          dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.62, 1);
          dome.position.set(bx + q[0], -0.45 + q[1], 0.9); outline(dome, 0.07); cs.add(dome); keys.push(dome);
        });
      } else if (i === 1) {
        for (var t = 0; t < 4; t++) {
          var tile = shade(new T.Mesh(new T.RoundedBoxGeometry(0.42, 0.8, 0.12, 3, 0.05), toon(t === 2 ? '#dceaf3' : '#f4f1e8')));
          tile.position.set(bx - 0.75 + t * 0.5, -0.25, 0.92); outline(tile, 0.03); cs.add(tile);
        }
        var go = shade(new T.Mesh(new T.RoundedBoxGeometry(0.8, 0.36, 0.14, 3, 0.06), toon('#8fc79a')));
        go.position.set(bx + 0.45, -1.05, 0.92); outline(go, 0.03); cs.add(go);
      } else {
        ['#d0574f', '#4f9d5d', '#4180ae'].forEach(function (c, k) {
          var key = shade(new T.Mesh(new T.RoundedBoxGeometry(0.46, 0.46, 0.14, 3, 0.07), toon(c)));
          key.position.set(bx - 0.55 + k * 0.55, 0.15, 0.92); outline(key, 0.03); cs.add(key);
        });
        [[0, -0.55], [-0.4, -0.95], [0.4, -0.95], [0, -1.3]].forEach(function (q) {
          var d = shade(new T.Mesh(new T.RoundedBoxGeometry(0.34, 0.3, 0.12, 3, 0.05), toon('#e6dcc6')));
          d.position.set(bx + q[0], q[1] + 0.05, 0.92); outline(d, 0.03); cs.add(d);
        });
      }
    });
    cs.position.set(0, 0.05, 0); cs.rotation.y = -0.18;

    /* props: the rules in a red binder, a mug, a pencil */
    var binder = shade(new T.Mesh(new T.BoxGeometry(3.6, 0.5, 4.6), toon('#8a2f2a')));
    binder.position.set(-7.6, -1.75, 2.4); binder.rotation.y = 0.32; outline(binder, 0.01); scene.add(binder);
    var pages = new T.Mesh(new T.BoxGeometry(3.3, 0.36, 4.4), toon('#ece5d4'));
    pages.position.set(-7.6, -1.7, 2.45); pages.rotation.y = 0.32; scene.add(pages);
    var mug = shade(new T.Mesh(new T.CylinderGeometry(0.55, 0.5, 1.1, 32), toon('#c9c2b0')));
    mug.position.set(6.4, -1.45, -2.2); outline(mug, 0.03); scene.add(mug);
    var pencil = shade(new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3, 8), toon('#f2c230')));
    pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.5; pencil.position.set(4.6, -1.92, 2.6); scene.add(pencil);

    /* the lamp and its light */
    var lamp = new T.Group();
    var shadeM = new T.Mesh(new T.ConeGeometry(1.3, 1.4, 40, 1, true), toon('#2e6b5a', { side: T.DoubleSide }));
    lamp.add(shadeM);
    bulb = new T.Mesh(new T.SphereGeometry(0.42, 24, 16), new T.MeshBasicMaterial({ color: new T.Color(3, 2.4, 1.5) }));
    bulb.position.y = -0.55; lamp.add(bulb);
    var arm = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6, 12), toon('#24302f'));
    arm.position.set(0.4, 3, 0); arm.rotation.z = -0.15; lamp.add(arm);
    lamp.position.set(-6.6, 5, -2.8); lamp.rotation.z = 0.55; scene.add(lamp);
    var spot = new T.SpotLight('#ffd8a0', 120, 40, 0.8, 0.75, 1.4);
    spot.position.set(-6.2, 4.7, -2.5); spot.target.position.set(0.5, -1.5, 0.5);
    spot.castShadow = true; spot.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048); spot.shadow.bias = -0.0004;
    scene.add(spot); scene.add(spot.target);
    scene.add(new T.HemisphereLight('#7f97ad', '#2a1a10', 1.0));
    var rim = new T.DirectionalLight('#6fd7e8', 0.6); rim.position.set(7, 3, -6); scene.add(rim);

    if (!lite) {
      composer = new T.EffectComposer(renderer);
      composer.addPass(new T.RenderPass(scene, camera));
      /* threshold above anything the lamp lights, so only what glows by
         itself (clock, LED) blooms — at 1.0 the bay edge facing the lamp
         flared into a white bar */
      composer.addPass(new T.UnrealBloomPass(new T.Vector2(512, 512), 0.55, 0.4, 1.35));
      composer.addPass(new T.OutputPass());
    }
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  /* where the camera wants to be for each framing: [x, y, z, lookX, lookY] */
  /* keyed by the shell's screen names; the title sits the case a little low
     so the name and its line clear the lid */
  var FRAMES = { title: [-0.8, 3.4, 16.4, 0, 0.6], main: [-6.8, 2.8, 19.5, -4.6, 0.1] };
  function smooth(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }

  function frame(now) {
    raf = running ? window.requestAnimationFrame(frame) : 0;
    if (!running || document.hidden) return;
    var t = (now - t0) / 1000;
    drawClockIfChanged();
    var k = smooth((now - camAt) / 1600), a = camFrom, b = camTo;
    var p = [0, 1, 2, 3, 4].map(function (i) { return a[i] + (b[i] - a[i]) * k; });
    var still = D.prefs && D.prefs.reducedMotion();
    var drift = still ? 0 : 1;
    camera.position.set(p[0] + Math.sin(t * 0.11) * 0.6 * drift, p[1] + Math.sin(t * 0.07) * 0.25 * drift,
                        p[2] - (framing === 'title' && !still ? Math.min(1.6, t * 0.05) : 0));
    camera.lookAt(p[3], p[4], 0);
    keys.forEach(function (d, i) { d.material.emissive.setScalar(Math.max(0, Math.sin(t * 1.6 - i)) * 0.08); });
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  var lastClock = '';
  function drawClockIfChanged() {
    var left = Math.floor((performance.now() - t0) / 1000);
    if (left !== lastClock) { lastClock = left; drawClock(); }
  }

  D.title3d = {
    available: ok,
    /* show the scene in a framing; builds it the first time */
    show: function (which) {
      if (!ok()) return false;
      if (!renderer) { try { build(); } catch (e) { renderer = null; return false; } }
      var target = FRAMES[which] || FRAMES.title;
      var now = performance.now();
      if (!running) { t0 = now; camFrom = target.slice(); camTo = target.slice(); camAt = now; }
      else {
        /* start the move from where the camera is now */
        var k = smooth((now - camAt) / 1600);
        camFrom = camFrom.map(function (v, i) { return v + (camTo[i] - v) * k; });
        camTo = target.slice(); camAt = now;
      }
      framing = which;
      canvas.style.display = 'block';
      running = true;
      if (!raf) raf = window.requestAnimationFrame(frame);
      return true;
    },
    hide: function () { running = false; if (canvas) canvas.style.display = 'none'; },
    isRunning: function () { return running; }
  };
})(DEFUSAL);
