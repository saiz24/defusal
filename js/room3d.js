/* ==========================================================================
   DEFUSAL — the room: the case as a real object on a desk.

   The case has always been a true CSS 3D object — two faces at ±half its
   depth, inside a 2200px perspective — and every module, every press, the
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
  var running = false, raf = 0, W = 0, H = 0, quality = 'off', built = '';
  var tmpA = null, tmpB = null, tmpF = null, lastKey = '';

  var PERSPECTIVE = 2200, ORIGIN_Y = 0.46;   /* .deck in style.css */

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
  function buildRoom(cw, chh, depth) {
    if (room) scene.remove(room);
    room = new T.Group();
    var deskY = -chh / 2 - 2;

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

    lampLight = new T.SpotLight('#ffd8a0', 3.6, 0, 0.8, 0.8, 0);
    lampLight.position.copy(lamp.position).add(new T.Vector3(30, -60, 0));
    lampLight.target.position.set(cw * 0.05, deskY + chh * 0.3, 0);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(quality === 'lite' ? 1024 : 2048, quality === 'lite' ? 1024 : 2048);
    lampLight.shadow.bias = -0.0005;
    lampLight.shadow.radius = 6;
    lampLight.shadow.camera.near = 200; lampLight.shadow.camera.far = cw * 5;
    room.add(lampLight); room.add(lampLight.target);

    var hemi = new T.HemisphereLight('#9fb4c6', '#3a2618', 1.6);
    room.add(hemi);
    fillLight = new T.DirectionalLight('#dfeeff', 0.5);
    fillLight.position.set(0, chh * 0.4, cw * 2);
    room.add(fillLight);

    /* the case's own solid body, under the CSS faces: the rims you see as
       it turns, the thickness, and the shadow it throws */
    caseGroup = new T.Group();
    body = shadowed(new T.Mesh(new T.RoundedBoxGeometry(cw, chh, depth, 4, 26), toon('#2c383e')));
    caseGroup.add(body);
    /* four leads along each rim, as the CSS rims had */
    ['#d0574f', '#ddb63f', '#4180ae', '#4f9d5d'].forEach(function (c, i) {
      var lead = new T.Mesh(new T.BoxGeometry(cw * 1.002, 8, 8), toon(c));
      lead.position.set(0, chh / 2 + 1, -depth * 0.35 + i * depth * 0.23);
      caseGroup.add(lead);
      var lead2 = lead.clone(); lead2.position.y = -chh / 2 - 1; caseGroup.add(lead2);
    });
    scene.add(room);
    scene.add(caseGroup);
    scene.fog = new T.Fog('#26313b', cw * 2.0, cw * 5.2);
    scene.background = new T.Color('#0d1217');
  }

  /* ---- the camera, matched to the CSS perspective ----------------------
     CSS: perspective 2200px from a point at (50%, 46%) of the deck. Three:
     a camera 2200 units in front of that point, with the picture's centre
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
    if (key !== built) { buildRoom(bw, bh, D.caseDepth || 150); built = key; }
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
    var key = getComputedStyle(bombEl).transform + '|' + getComputedStyle(flipEl).transform + '|' +
              W + 'x' + H + '|' + bombEl.offsetWidth + 'x' + bombEl.offsetHeight;
    if (key === lastKey) return;
    lastKey = key;
    place();
    if (composer) composer.render(); else renderer.render(scene, camera);
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
    composer = null; scene = null; room = null; built = ''; W = H = 0; lastKey = '';
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
  }

  D.room3d = {
    init: function () {
      if (typeof document === 'undefined' || !document.getElementById) return;
      apply();
      if (D.prefs) D.prefs.onChange(function (key) { if (key === 'room' || key === '*') apply(); });
    },
    quality: function () { return quality; },
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
