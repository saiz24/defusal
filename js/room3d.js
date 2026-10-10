/* ==========================================================================
   DEFUSAL — the room: the case as a real object on a desk.

   The case has always been a true CSS 3D object — two faces at ±half its
   depth, inside a 1700px perspective — and every module, every press, the
   turn, the lean-in, the zoom and the arming all work on it and are tested.
   So this does not replace it. It draws everything AROUND it in WebGL — the
   desk it stands on, the wall, the lamp, the solid body of the case with
   real thickness, the shadows — through a camera built to match the CSS
   perspective exactly, and each frame it reads the case's live transform
   from the page. Whatever the CSS is doing, the room agrees with it.

   The look follows the cutscenes' rules: flat toon tones, colour fading to
   the room's haze with distance, glow only on the lamp and the device.

   Quality (Settings → DISPLAY → 3D ROOM): HIGH, LITE (phones, weak GPUs:
   lower resolution, softer shadows, no bloom), OFF. With no WebGL at all it
   is OFF and the game looks exactly as it did.
   ========================================================================== */

(function (D) {
  'use strict';

  var T = null, renderer = null, composer = null, scene = null, camera = null;
  var canvas = null, deck = null, bombEl = null, flipEl = null;
  var room = null, caseGroup = null, body = null, lampLight = null, bulb = null, fillLight = null;
  var shades = [];
  var serialPlates = [], serialCanvas = null, serialTex = null, drawnSerial = '';

  /* The serial, lit: cyan segments on a dark window, as on the control
     strip it used to sit in. One canvas, shared by both sides. */
  function serialTexture() {
    if (!serialTex) {
      serialCanvas = document.createElement('canvas');
      serialCanvas.width = 512; serialCanvas.height = 288;
      serialTex = new T.CanvasTexture(serialCanvas);
      serialTex.colorSpace = T.SRGBColorSpace; serialTex.anisotropy = 8;
    }
    return serialTex;
  }
  function paintSerial(text) {
    var g = serialCanvas.getContext('2d'), w = serialCanvas.width, h = serialCanvas.height;
    g.fillStyle = '#0a1115'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2b3d46'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#8fa6b0'; g.font = '700 34px "Plex Sans Condensed", "Plex Sans", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('S E R I A L', w / 2, 58);
    /* not the segment face: the serial runs A-Z and 0-9, and segments
       cannot tell G from 6, S from 5, B from 8 or Z from 2 */
    g.font = '600 104px "Plex Mono", ui-monospace, monospace';
    g.shadowColor = 'rgba(111,215,232,.85)'; g.shadowBlur = 22;
    g.fillStyle = '#9fe9f5';
    g.fillText(text, w / 2, 178);
    g.shadowBlur = 0;
    serialTex.needsUpdate = true;
  }
  function serialNow() {
    var n = document.getElementById('serial');
    return (n && n.textContent) || '';
  }
  var running = false, raf = 0, W = 0, H = 0, quality = 'off', built = '';
  var tmpA = null, tmpB = null, tmpF = null, lastKey = '';

  var PERSPECTIVE = 1700, ORIGIN_Y = 0.46;   /* .deck in style.css */

  function webgl() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function wanted() {
    var q = D.prefs ? D.prefs.get('room') : 'high';
    if (!window.THREE || !webgl()) return 'off';
    return q || 'high';
  }

  /* ---- toon look: three flat bands of light, no gradients ------------- */
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
  function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

  /* ---- the room ---------------------------------------------------------
     Built in the case's own units (CSS pixels of the face, origin at its
     centre, y up), so it scales and turns with the view exactly as the
     case does. The case stands on the desk; its bottom edge is the desk. */
  /* the body is a little bigger than the CSS face, so the face sits in a
     frame of solid case; feet lift it off the desk */
  var RIM = 34, FEET = 16;

  function buildRoom(cw, chh, depth) {
    if (room) scene.remove(room);
    if (caseGroup) scene.remove(caseGroup);
    room = new T.Group();
    var deskY = -chh / 2 - RIM - FEET;

    /* the desk: a long top and a front edge, wood in two flat tones */
    var top = shadowed(new T.Mesh(new T.BoxGeometry(cw * 4, 40, cw * 1.6), toon('#9a6a44')));
    top.position.set(0, deskY - 20, -cw * 0.3);
    room.add(top);
    var lip = new T.Mesh(new T.BoxGeometry(cw * 4, 120, 30), toon('#6a4630'));
    lip.position.set(0, deskY - 100, cw * 0.5);
    room.add(lip);

    /* the wall behind, far enough back that the haze takes it */
    var wall = new T.Mesh(new T.PlaneGeometry(cw * 8, cw * 4), toon('#43535f'));
    wall.position.set(0, deskY + cw * 1.2, -cw * 1.1);
    wall.receiveShadow = true;
    room.add(wall);

    /* props, so somebody works here: a mug, the rules in a red binder */
    var mug = shadowed(new T.Mesh(new T.CylinderGeometry(70, 64, 150, 32), toon('#c9c2b0')));
    mug.position.set(cw * 0.66, deskY + 75, -depth * 1.2);
    room.add(mug);
    var binder = shadowed(new T.Mesh(new T.BoxGeometry(520, 70, 680), toon('#8a2f2a')));
    binder.position.set(-cw * 0.78, deskY + 35, cw * 0.05);
    binder.rotation.y = 0.32;
    room.add(binder);

    /* the lamp: a shade, a visible bulb, the warm light it throws */
    var lamp = new T.Group();
    var shade = new T.Mesh(new T.ConeGeometry(170, 190, 40, 1, true), toon('#2e6b5a', { side: T.DoubleSide }));
    lamp.add(shade);
    bulb = new T.Mesh(new T.SphereGeometry(52, 24, 16), new T.MeshBasicMaterial({ color: new T.Color(3, 2.4, 1.5) }));
    bulb.position.y = -78;
    lamp.add(bulb);
    var arm = new T.Mesh(new T.CylinderGeometry(10, 10, 760, 12), toon('#24302f'));
    arm.position.set(60, 380, 0); arm.rotation.z = -0.15;
    lamp.add(arm);
    lamp.position.set(-cw * 0.56, deskY + chh * 1.02, -depth * 0.2);
    lamp.rotation.z = 0.5;
    room.add(lamp);

    lampLight = new T.SpotLight('#ffd8a0', 7, 0, 0.8, 0.8, 0);
    lampLight.position.copy(lamp.position).add(new T.Vector3(30, -60, 0));
    lampLight.target.position.set(cw * 0.05, deskY + chh * 0.3, 0);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(quality === 'lite' ? 1024 : 2048, quality === 'lite' ? 1024 : 2048);
    lampLight.shadow.bias = -0.0005;
    lampLight.shadow.radius = 6;
    lampLight.shadow.camera.near = 200; lampLight.shadow.camera.far = cw * 5;
    room.add(lampLight); room.add(lampLight.target);

    var hemi = new T.HemisphereLight('#7f9bb0', '#2a1a10', 1.2);
    room.add(hemi);
    /* a cool rim from behind and to the right, so the case's edges separate
       from the dark wall */
    var rim = new T.DirectionalLight('#6fd7e8', 0.9);
    rim.position.set(cw * 1.5, chh, -cw * 1.5);
    room.add(rim);
    /* a fill that rides with the camera, not the room: however the case is
       turned, the face toward the player is never left in the dark (test
       shot B's rule) */
    if (fillLight) scene.remove(fillLight);
    fillLight = new T.DirectionalLight('#dfeeff', 1.0);
    fillLight.position.set(PERSPECTIVE * 0.25, PERSPECTIVE * 0.6, PERSPECTIVE);
    fillLight.target.position.set(0, 0, 0);
    scene.add(fillLight); scene.add(fillLight.target);

    /* The case's own solid body, under the CSS faces: a rounded box with a
       frame round each face, the thickness you see from the angle it rests
       at, a carrying handle and a red button on top, rubber feet, and the
       serial on both sides — where a player turns the case to read it. */
    caseGroup = new T.Group();
    var bw = cw + RIM * 2, bh = chh + RIM * 2;
    body = shadowed(new T.Mesh(new T.RoundedBoxGeometry(bw, bh, depth, 6, 46), toon('#38474f')));
    caseGroup.add(body);
    var dark = toon('#1b2428');
    /* a seam round the middle of the body, where the two halves meet */
    var seam = new T.Mesh(new T.BoxGeometry(bw + 2, bh + 2, 8), dark);
    caseGroup.add(seam);
    /* the handle: two posts and a bar, along the top */
    var top = bh / 2;
    [-1, 1].forEach(function (sx) {
      var post = shadowed(new T.Mesh(new T.BoxGeometry(40, 70, 46), dark));
      post.position.set(sx * cw * 0.17, top + 30, 0);
      caseGroup.add(post);
    });
    var bar = shadowed(new T.Mesh(new T.CylinderGeometry(22, 22, cw * 0.34 + 40, 20), toon('#3a4a52')));
    bar.rotation.z = Math.PI / 2; bar.position.set(0, top + 72, 0);
    caseGroup.add(bar);
    /* the red button, the one thing on the case nobody should press */
    var collar = shadowed(new T.Mesh(new T.CylinderGeometry(58, 64, 22, 32), dark));
    collar.position.set(cw * 0.36, top + 10, 0);
    caseGroup.add(collar);
    var cap = shadowed(new T.Mesh(new T.SphereGeometry(48, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon('#d0574f')));
    cap.scale.y = 0.6; cap.position.set(cw * 0.36, top + 20, 0);
    caseGroup.add(cap);
    /* rubber feet at the four bottom corners */
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) {
      var foot = shadowed(new T.Mesh(new T.CylinderGeometry(34, 38, FEET + 6, 20), toon('#141a1d')));
      foot.position.set(q[0] * (bw / 2 - 80), -bh / 2 - FEET / 2 + 2, q[1] * (depth / 2 - 60));
      caseGroup.add(foot);
    });
    /* the serial plates, one each side */
    serialPlates = [];
    [-1, 1].forEach(function (sx) {
      var plate = new T.Mesh(new T.BoxGeometry(10, 150, Math.min(260, depth - 40)), dark);
      plate.position.set(sx * (bw / 2 + 3), chh * 0.12, 0);
      caseGroup.add(plate);
      var face = new T.Mesh(new T.PlaneGeometry(Math.min(250, depth - 50), 140),
        new T.MeshBasicMaterial({ map: serialTexture(), toneMapped: false }));
      face.position.set(sx * (bw / 2 + 9), chh * 0.12, 0);
      face.rotation.y = sx * Math.PI / 2;
      caseGroup.add(face);
      serialPlates.push(face);
    });
    drawnSerial = '';
    scene.add(room);
    scene.add(caseGroup);
    scene.fog = new T.Fog('#26313b', cw * 2.0, cw * 5.2);
    scene.background = new T.Color('#0d1217');
  }

  /* ---- the camera, matched to the CSS perspective ----------------------
     CSS: perspective 1700px from a point at (50%, 46%) of the deck. Three:
     a camera 1700 units in front of that point, with the picture's centre
     shifted so its principal point lands at the same place. One unit is one
     CSS pixel, so everything measured in the page lines up. */
  function fitCamera() {
    var oy = H * ORIGIN_Y, fullH = 2 * Math.max(oy, H - oy);
    camera.fov = 2 * Math.atan((fullH / 2) / PERSPECTIVE) * 180 / Math.PI;
    camera.aspect = W / fullH;
    camera.position.set(0, 0, PERSPECTIVE);
    camera.near = 50; camera.far = PERSPECTIVE * 6;
    camera.setViewOffset(W, fullH, 0, (fullH / 2) - oy, W, H);
    camera.updateProjectionMatrix();
  }

  function resize() {
    if (!renderer) return;
    var w = deck.clientWidth || window.innerWidth, h = deck.clientHeight || window.innerHeight;
    if (w === W && h === H) return;
    W = w; H = h;
    var dpr = Math.min(window.devicePixelRatio || 1, quality === 'lite' ? 1 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) composer.setSize(W, H);
    fitCamera();
  }

  /* CSS matrix (y down) -> three matrix (y up): F * M * F */
  function cssMatrix(el, out) {
    var m = new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
    out.fromArray(m.toFloat64Array ? Array.prototype.slice.call(m.toFloat64Array()) : [m.m11, m.m12, m.m13, m.m14, m.m21, m.m22, m.m23, m.m24, m.m31, m.m32, m.m33, m.m34, m.m41, m.m42, m.m43, m.m44]);
    return out.premultiply(tmpF).multiply(tmpF);
  }

  function place() {
    var bw = bombEl.offsetWidth, bh = bombEl.offsetHeight;
    var key = bw + 'x' + bh;
    if (key !== built) {
      var t0 = performance.now();
      buildRoom(bw, bh, D.caseDepth || 150); built = key;
      if (window.__m3dProf) window.__m3dProf.push(['room build', Math.round(performance.now() - t0), Math.round(t0)]);
    }
    /* where the bomb's transform origin sits, in camera space */
    var ox = W / 2 + bw / 2 - W / 2, oy = -(H / 2 + bh / 2 - H * ORIGIN_Y);
    var base = new T.Matrix4().makeTranslation(ox, oy, 0);
    cssMatrix(bombEl, tmpA);
    base.multiply(tmpA);
    room.matrixAutoUpdate = false; room.matrix.copy(base); room.matrixWorldNeedsUpdate = true;
    cssMatrix(flipEl, tmpB);
    caseGroup.matrixAutoUpdate = false; caseGroup.matrix.copy(base).multiply(tmpB); caseGroup.matrixWorldNeedsUpdate = true;
    /* light the CSS faces the way the room lights the body: a face turned
       away from the lamp darkens, flat, in one step */
    var n = new T.Vector3(0, 0, 1).applyMatrix4(new T.Matrix4().extractRotation(caseGroup.matrix)).normalize();
    var toLamp = new T.Vector3(-0.55, 0.45, 0.7).normalize();
    var lit = Math.max(0, n.dot(toLamp));
    var dark = 0.32 * (1 - Math.min(1, lit * 1.5));
    if (shades[0]) shades[0].style.opacity = String(dark);
    var nb = n.clone().negate();
    if (shades[1]) shades[1].style.opacity = String(0.32 * (1 - Math.min(1, Math.max(0, nb.dot(toLamp)) * 1.5)));
  }

  function frame() {
    raf = window.requestAnimationFrame(frame);
    if (!running || document.hidden) return;
    if (!bombEl || deck.hidden || !document.body.classList.contains('room3d')) return;
    resize();
    /* Draw only when something has moved: the case's transform, its turn,
       the window. A still case on a still desk costs nothing, which is most
       of the time a player spends reading a module. */
    var serial = serialNow();
    if (serial !== drawnSerial && serialTex) {
      /* the segment face may still be loading the first time; paint now and
         again once it is there */
      paintSerial(serial); drawnSerial = serial;
      if (document.fonts && document.fonts.load) document.fonts.load('600 104px "Plex Mono"').then(function () { paintSerial(serial); lastKey = ''; });
    }
    var key = serial + '|' + getComputedStyle(bombEl).transform + '|' + getComputedStyle(flipEl).transform + '|' +
              W + 'x' + H + '|' + bombEl.offsetWidth + 'x' + bombEl.offsetHeight;
    if (key === lastKey) return;
    lastKey = key;
    place();
    var r0 = performance.now();
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (window.__m3dProf && performance.now() - r0 > 8) window.__m3dProf.push(['room render', Math.round(performance.now() - r0), Math.round(r0)]);
  }

  function setup() {
    T = window.THREE;
    deck = document.getElementById('screen-game');
    bombEl = document.getElementById('bomb');
    flipEl = document.getElementById('flipper');
    if (!deck || !bombEl || !flipEl) return false;
    canvas = document.createElement('canvas');
    canvas.className = 'room3d';
    canvas.setAttribute('aria-hidden', 'true');
    deck.insertBefore(canvas, deck.firstChild);
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: quality !== 'lite', powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); return false; }
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = quality === 'lite' ? T.PCFShadowMap : T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(30, 1, 50, 20000);
    tmpA = new T.Matrix4(); tmpB = new T.Matrix4(); tmpF = new T.Matrix4().makeScale(1, -1, 1);
    if (quality === 'high') {
      composer = new T.EffectComposer(renderer);
      composer.addPass(new T.RenderPass(scene, camera));
      /* only true light sources bloom: the threshold is above white */
      composer.addPass(new T.UnrealBloomPass(new T.Vector2(512, 512), 0.5, 0.4, 1.0));
      composer.addPass(new T.OutputPass());
    }
    /* a shade layer on each CSS face, for the lamp's light */
    [].forEach.call(document.querySelectorAll('#bomb .casing'), function (c) {
      var s = document.createElement('div'); s.className = 'room-shade'; c.appendChild(s); shades.push(s);
    });
    return true;
  }

  function teardownGL() {
    running = false;
    document.body.classList.remove('room3d');
    if (renderer) { renderer.dispose(); renderer = null; }
    if (canvas) { canvas.remove(); canvas = null; }
    composer = null; scene = null; room = null; caseGroup = null; fillLight = null; built = ''; W = H = 0; lastKey = '';
    serialTex = null; serialCanvas = null; serialPlates = []; drawnSerial = '';
    shades.forEach(function (s) { s.remove(); }); shades = [];
  }

  function apply() {
    var q = wanted();
    var refit = function () { if (D.refit) D.refit(); };
    if (q === quality && (q === 'off' || renderer)) return;
    teardownGL();
    quality = q;
    if (q === 'off') { refit(); return; }
    if (!setup()) { quality = 'off'; return; }
    document.body.classList.add('room3d');
    running = true;
    refit();
    if (!raf) raf = window.requestAnimationFrame(frame);
    warm();
  }

  /* Build the room once, at the case's usual size, while the game is idle
     at its menus, and draw it once, so its shaders are compiled before a
     device ever arms. The first draw of a freshly built room was a ~70 ms
     frame in the middle of the arming otherwise. The real size rebuilds the
     shapes on arming, which is cheap; the programs are kept. */
  function warm() {
    var go = function () {
      if (!renderer || built) return;
      var t0 = performance.now();
      W = window.innerWidth || 1280; H = window.innerHeight || 720;
      renderer.setSize(W, H, false);
      fitCamera();
      buildRoom(1724, 938, D.caseDepth || 300);
      paintSerial('');
      if (composer) composer.render(); else renderer.render(scene, camera);
      W = H = 0; built = ''; lastKey = '';
      if (window.__m3dProf) window.__m3dProf.push(['room warm', Math.round(performance.now() - t0), Math.round(t0)]);
    };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1200);
  }

  D.room3d = {
    init: function () {
      if (typeof document === 'undefined' || !document.getElementById) return;
      apply();
      if (D.prefs) D.prefs.onChange(function (key) { if (key === 'room' || key === '*') apply(); });
    },
    quality: function () { return quality; },
    /* for tests: the serial painted on the case's two sides */
    debugSerial: function () { return drawnSerial; },
    /* for tests: the case body's front face corners projected to the
       screen, to compare with where the CSS face actually is */
    debugCorners: function () {
      if (!renderer || !caseGroup) return null;
      place();
      var bw = bombEl.offsetWidth, bh = bombEl.offsetHeight, d = (D.caseDepth || 150) / 2;
      caseGroup.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      var r = canvas.getBoundingClientRect();
      return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(function (c) {
        var v = new T.Vector3(c[0] * bw / 2, c[1] * bh / 2, d).applyMatrix4(caseGroup.matrixWorld).project(camera);
        return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
      });
    }
  };
})(DEFUSAL);
