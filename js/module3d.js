/* ==========================================================================
   DEFUSAL — modules as 3D objects.

   A module rebuilt in 3D still lives in its bay. It renders into a small
   canvas mounted inside the bay's body, so it rides along with everything
   the case does — the tilt, turning it over, the zoom, leaning in on a
   module, the arming — and the case face never has to know. A click on that
   canvas is turned back into a ray and tested against the module's parts.

   One WebGL renderer, shared by every 3D module on the case, draws each one
   in turn and copies the picture into its canvas. It only draws a module
   when something about it changed — a press springing back, the pointer
   moving over a key, the case zooming in close enough to need sharper
   pixels — so a module nobody is touching costs nothing.

   The look is the same as test shot B and the room: three flat bands of
   light, a dark outline round every part (the shell trick: the same mesh,
   slightly larger, back faces only, drawn black), glow only on things that
   light up.

   A module is ported by giving its definition a `mount3d(host, inst)`; the
   game uses it when 3D is available (WebGL, and Settings → 3D ROOM not OFF)
   and the plain `mount` otherwise. The rules, the generator, the solver and
   the manual never change.
   ========================================================================== */

(function (D) {
  'use strict';

  var T = null, renderer = null, views = [], raf = 0, BUF = { w: 0, h: 0 };
  var INK = '#1a2429';

  function ok() {
    if (typeof window === 'undefined' || !window.THREE || !document.createElement) return false;
    if (D.prefs && D.prefs.get('room') === 'off') return false;
    if (renderer) return true;
    try {
      T = window.THREE;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      /* reading back each shader's log makes every compile synchronous;
         only a debug run needs it */
      renderer.debug.checkShaderErrors = /[?&]debug=1/.test(location.search);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = T.NoToneMapping;
      prewarm();
      return true;
    } catch (e) { renderer = null; return false; }
  }

  var ramp = null;
  function toon(colour, extra) {
    if (!ramp) {
      var d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
      ramp = new T.DataTexture(d, 3, 1, T.RGBAFormat);
      ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
    }
    var m = new T.MeshToonMaterial({ color: colour, gradientMap: ramp });
    if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
    return m;
  }

  /* the outline: the same shape again, a little bigger, inside out, black */
  var inkMat = null;
  function outline(mesh, px) {
    if (!inkMat) inkMat = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });
    mesh.geometry.computeBoundingSphere();
    var r = mesh.geometry.boundingSphere.radius || 1;
    var o = new T.Mesh(mesh.geometry, inkMat);
    o.scale.setScalar(1 + (px || 3) / r);
    o.raycast = function () {};
    mesh.add(o);
    return o;
  }

  /* text on a plate: a canvas texture, crisp at the sizes it is shown */
  function textTexture(text, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 160;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = opts.color || INK;
    x.font = opts.font || '500 104px "Plex Sans", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + (opts.dy || 6));
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  /* Compile the shaders every module uses once, when the game has loaded,
     rather than the first time a device arms — compiling them then was part
     of a 130 ms stall as eight modules appeared at once. */
  function prewarm() {
    var go = function () {
      if (!renderer) return;
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(20, 1, 1, 100);
      cam.position.z = 50;
      sc.add(new T.DirectionalLight('#ffffff', 1)); sc.add(new T.HemisphereLight('#fff', '#000', 1));
      var g = new T.BoxGeometry(1, 1, 1), tex = new T.CanvasTexture(document.createElement('canvas'));
      [toon('#888888'), toon('#888888', { map: tex }), new T.MeshBasicMaterial({ color: '#000', side: T.BackSide }),
       new T.MeshBasicMaterial({ map: tex, transparent: true }), new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }),
       new T.MeshBasicMaterial({ map: tex }), new T.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5 }),
       new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false })]
        .forEach(function (m) { sc.add(new T.Mesh(g, m)); });
      /* The shared buffer is made the size a module needs drawn at up to
         twice its size, once, here: grown on the first draws instead, it was
         reallocated several times while a device armed. It can run after
         modules have drawn (it waits for an idle moment), so the size it
         leaves is recorded, or each draw would copy from the wrong place. */
      var bw = Math.max(BUF.w, 1200), bh = Math.max(BUF.h, 600);
      renderer.setPixelRatio(1);
      renderer.setSize(bw, bh, false);
      BUF.w = bw; BUF.h = bh;
      renderer.setViewport(0, 0, 8, 8);
      renderer.compile(sc, cam);
      renderer.render(sc, cam);
      views.forEach(function (v) { v.dirty = true; });
      kick();
    };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 500);
  }

  /* Work that can wait a frame: building a module's 3D view. A device arms
     with up to eight of them, and building them all in one frame stalls the
     arming animation; one per frame, under it, is invisible. */
  var later = [], laterRaf = 0;
  function defer(fn) {
    later.push(fn);
    if (!laterRaf) laterRaf = window.requestAnimationFrame(runLater);
  }
  var lastTick = 0;
  function runLater(ts) {
    laterRaf = 0;
    /* only after a calm frame: the round's own start-up is one long frame,
       and a build landing right behind it made that frame longer still */
    var calm = lastTick && ts - lastTick < 24;
    lastTick = ts;
    if (!calm) { laterRaf = window.requestAnimationFrame(runLater); return; }
    var fn = later.shift(), t0 = performance.now();
    if (fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } }
    prof('build', t0);
    if (later.length) laterRaf = window.requestAnimationFrame(runLater);
    else lastTick = 0;
  }

  /* ---- a view: one module's scene, camera and canvas -------------------- */

  /* `w` x `h` is the canvas's size in the bay, in CSS pixels. The camera
     looks straight at the bay with a long lens, so the module's face plane
     (z = 0) maps exactly onto the canvas, x right and y DOWN as in the page,
     and anything raised off the face is seen with a little depth. */
  function stage(host, w, h, deferred) {
    if (!ok()) return null;
    /* Until the 3D view is built and drawn, the bay shows the module's 2D
       view instead of an empty hole: a device arms with up to eight modules
       and they are built one per frame, so they used to pop in one by one
       out of blank bays. The 3D view fades in over the 2D one when ready. */
    host.classList.add('m3d-host', 'm3d-pending');
    var canvas = document.createElement('canvas');
    canvas.className = 'm3d';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    host.appendChild(canvas);
    var scene = new T.Scene();
    var fov = 14, dist = (h / 2) / Math.tan(fov * Math.PI / 360);
    var camera = new T.PerspectiveCamera(fov, w / h, 10, dist * 3);
    camera.position.set(w / 2, -h / 2, dist);
    camera.lookAt(w / 2, -h / 2, 0);
    var key = new T.DirectionalLight('#fff6e8', 1.6); key.position.set(-0.6 * w, 0.8 * h, dist);
    key.target.position.set(w / 2, -h / 2, 0);
    scene.add(key); scene.add(key.target);
    scene.add(new T.HemisphereLight('#dfe9f0', '#6b5a4a', 1.4));
    var root = new T.Group(); scene.add(root);

    var view = {
      canvas: canvas, scene: scene, camera: camera, root: root, w: w, h: h, host: host, built: false,
      /* The module says when its parts are in. Its shaders are then compiled
         in the background (the GPU's parallel compile, where there is one)
         and only then is it drawn and shown: compiling them on first draw
         was ~100 ms of stall while a device armed. Until then the bay keeps
         its 2D view. */
      ready: function () {
        var done = function () { view.built = true; view.invalidate(); };
        if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(done, done);
        else done();
      },
      dirty: true, animating: 0, scale: 0, hits: [], hover: null,
      /* place a part at page-style coordinates (x right, y down) */
      at: function (obj, x, y, z) { obj.position.set(x, -y, z || 0); root.add(obj); return obj; },
      /* register a pressable part and what a press does */
      hit: function (obj, onPress, data) { obj.userData.press = onPress; obj.userData.data = data; view.hits.push(obj); return obj; },
      invalidate: function () { view.dirty = true; kick(); },
      /* keep drawing for `ms`, for something that is moving */
      animate: function (ms) { view.animating = Math.max(view.animating, performance.now() + ms); kick(); },
      pick: function (ox, oy) {
        var ray = new T.Raycaster();
        ray.setFromCamera(new T.Vector2(ox / w * 2 - 1, -(oy / h) * 2 + 1), camera);
        var hit = ray.intersectObjects(view.hits, true)[0];
        if (!hit) return null;
        var o = hit.object;
        while (o && !o.userData.press) o = o.parent;
        return o;
      },
      /* where a part is on the page, for the tests: the canvas at rest maps
         linearly onto its bounding box */
      screenOf: function (obj) {
        var v = new T.Vector3(); obj.getWorldPosition(v); v.project(camera);
        if (view.toDeck) {
          /* the point on the canvas, then the canvas onto the screen */
          var cx = (v.x + 1) / 2 * w, cy = (1 - v.y) / 2 * h;
          var d = view.toDeck.transformPoint(new DOMPoint(cx, cy, 0, 1));
          var dx = d.x / d.w, dy = d.y / d.w, dz = d.z / d.w, ey = view.eye;
          var f = ey.z / (ey.z - dz);
          var deck = canvas.closest('#screen-game').getBoundingClientRect();
          return [deck.left + ey.x + (dx - ey.x) * f, deck.top + ey.y + (dy - ey.y) * f];
        }
        var r = canvas.getBoundingClientRect();
        return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
      },
      destroy: function () { views = views.filter(function (x) { return x !== view; }); canvas.remove(); host.classList.remove('m3d-pending'); }
    };

    /* Pointer: offsetX/Y are in the canvas's own coordinates even when the
       case around it is tilted and turned, which is all a ray needs. */
    canvas.addEventListener('click', function (e) {
      var o = view.pick(e.offsetX * w / canvas.offsetWidth, e.offsetY * h / canvas.offsetHeight);
      if (o) { e.stopPropagation(); o.userData.press(o.userData.data, o); }
    });
    canvas.addEventListener('mousemove', function (e) {
      var o = view.pick(e.offsetX * w / canvas.offsetWidth, e.offsetY * h / canvas.offsetHeight);
      if (o !== view.hover) {
        view.hover = o;
        canvas.style.cursor = o ? 'pointer' : '';
        if (view.onHover) view.onHover(o);
        view.invalidate();
      }
    });
    canvas.addEventListener('mouseleave', function () {
      if (view.hover) { view.hover = null; canvas.style.cursor = ''; if (view.onHover) view.onHover(null); view.invalidate(); }
    });
    views.push(view);
    kick();
    return view;
  }

  /* ---- seen from where the player is -------------------------------------
     The case rests turned and tipped on the desk, and the player can turn it
     further. A module drawn by a camera square-on to its bay and then laid on
     that turned bay is a flat picture of a 3D thing: its keys have no depth.
     So each module is drawn as a window: the camera is put where the
     player's eye actually is, in the bay's own frame, looking through the
     bay's rectangle (an off-axis frustum). What lands on each point of the
     canvas is what the eye would see through it, so after the page lays the
     canvas on the bay the parallax is exactly right. A press needs nothing
     new: the ray through a point of the canvas is the same ray it was drawn
     with. */
  /* The chain from a canvas to the deck is long, and every link is a style
     read. Most of it never moves: from the canvas up to its face is layout
     and the bay's own transform (which changes only when it is leaned in on).
     That part is kept per view; the three links that do move — the face, the
     flipper, the case — are read once a frame for each face and shared. */
  var sceneKey = '', frameFaces = null, frameEye = null, frameDeck = null;
  function portal(view) {
    var deck = view.canvas.closest('#screen-game');
    if (!deck) return false;
    var bay = view.canvas.closest('.bay'), face = view.canvas.closest('.face');
    if (!face) return false;
    var bayKey = bay ? getComputedStyle(bay).transform + bay.offsetLeft + ',' + bay.offsetTop : '';
    var key = sceneKey + '|' + bayKey;
    if (key === view.portalKey) return false;
    view.portalKey = key;
    if (view.innerKey !== bayKey || !view.inner) { view.inner = D.cssChain(view.canvas, face); view.innerKey = bayKey; }
    if (frameDeck !== deck) { frameDeck = deck; frameFaces = new Map(); frameEye = D.cssEye(deck); }
    var outer = frameFaces.get(face);
    if (outer === undefined) { outer = D.cssChain(face, deck); frameFaces.set(face, outer); }
    var eye = frameEye;
    if (!view.inner || !outer || !eye) return false;
    var m = outer.multiply(view.inner);
    view.toDeck = m; view.eye = eye;
    var e = m.inverse().transformPoint(new DOMPoint(eye.x, eye.y, eye.z, 1));
    if (!e.w) return false;
    var ex = e.x / e.w, ey = e.y / e.w, ez = e.z / e.w;
    if (!(ez > 20)) return false;              /* edge-on, or turned away */
    var cam = view.camera, w = view.w, h = view.h;
    cam.position.set(ex, -ey, ez);
    cam.quaternion.identity();
    cam.updateMatrixWorld(true);
    var near = 1, far = ez + 4000, k = near / ez;
    cam.projectionMatrix.makePerspective((0 - ex) * k, (w - ex) * k, (0 + ey) * k, (-h + ey) * k, near, far);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    return true;
  }

  /* ---- drawing ---------------------------------------------------------- */

  /* How sharp to draw: the canvas's on-screen size over its own, times the
     screen's pixel ratio, in quarter steps. Measured on its HEIGHT, which a
     turn about the vertical axis does not change — measured on its width,
     turning the case over swept it to nothing and back and redrew the module
     at every step of the turn (a 99 ms frame, in the desktop app). It goes up
     at once, for a zoom, and down only when it is well past, so nothing
     redraws for a small wobble. */
  function wantScale(view) {
    var r = view.canvas.getBoundingClientRect();
    if (!r.height) return view.scale;
    var k = r.height / view.h * (window.devicePixelRatio || 1);
    return Math.min(3, Math.max(0.75, Math.ceil(k * 4) / 4));
  }

  /* timings, only when a test asks for them: window.__m3dProf = [] */
  function prof(what, t0) { if (window.__m3dProf) window.__m3dProf.push([what, Math.round((performance.now() - t0) * 10) / 10, Math.round(t0)]); }

  function draw(view) {
    var t0 = performance.now();
    var k = wantScale(view);
    if (!view.scale || k > view.scale || k < view.scale - 0.5) view.scale = k;
    k = view.scale;
    var pw = Math.round(view.w * k), ph = Math.round(view.h * k);
    if (view.canvas.width !== pw || view.canvas.height !== ph) { view.canvas.width = pw; view.canvas.height = ph; }
    /* One drawing buffer, only ever grown: wide and square modules take
       turns, and resizing it for each was a reallocation on every draw. The
       module is rendered into its bottom-left corner and copied from there. */
    var bw = Math.max(BUF.w, pw), bh = Math.max(BUF.h, ph);
    if (bw !== BUF.w || bh !== BUF.h) { renderer.setPixelRatio(1); renderer.setSize(bw, bh, false); BUF.w = bw; BUF.h = bh; }
    renderer.setViewport(0, 0, pw, ph);
    renderer.setScissor(0, 0, pw, ph); renderer.setScissorTest(true);
    if (view.beforeDraw) view.beforeDraw(performance.now());
    renderer.clear();
    renderer.render(view.scene, view.camera);
    var x = view.canvas.getContext('2d');
    x.clearRect(0, 0, pw, ph);
    x.drawImage(renderer.domElement, 0, BUF.h - ph, pw, ph, 0, 0, pw, ph);
    view.dirty = false;
    prof('draw' + (view.drawn ? '' : '-first'), t0);
    view.drawn = true;
    if (view.built && !view.shown) { view.shown = true; view.host.classList.remove('m3d-pending'); }
  }

  /* Each frame draws only what fits in a few milliseconds. A zoom asks
     every module on the case to redraw sharper at once — eight renders in
     one frame was a 117 ms stall in the desktop app — so the work is spread:
     whatever is moving or under the pointer first, then the rest, a few per
     frame. Meanwhile the browser simply scales the picture it already has. */
  var BUDGET_MS = 6;
  function loop() {
    raf = 0;
    var now = performance.now(), more = false;
    views = views.filter(function (v) { return v.canvas.isConnected; });
    /* while the case is arming it grows on screen every frame; sharpening
       the modules at each step of that is work nobody can see, so it waits
       for the arming to finish (first drawings still happen) */
    var arming = !!document.querySelector('.bomb.arming-zoom, .casing.arming');
    var bomb = document.getElementById('bomb'), flipper = document.getElementById('flipper');
    sceneKey = bomb && flipper ? getComputedStyle(bomb).transform + '|' + getComputedStyle(flipper).transform : '';
    frameDeck = null;            /* the shared outer links are read afresh each frame */
    views.forEach(function (v) {
      if (portal(v)) { v.dirty = true; more = true; }
      var want = wantScale(v);
      if ((want > v.scale || want < v.scale - 0.5) && (!arming || !v.drawn)) v.dirty = true;
      if (v.animating > now) { v.dirty = true; more = true; }
    });
    var queue = views.filter(function (v) { return v.dirty; });
    queue.sort(function (a, b) { return urgency(b, now) - urgency(a, now); });
    var t0 = performance.now();
    for (var i = 0; i < queue.length; i++) {
      if (i > 0 && performance.now() - t0 > BUDGET_MS) { more = true; break; }
      draw(queue[i]);
    }
    if (more || views.length) raf = window.requestAnimationFrame(loop);
  }
  function urgency(v, now) { return (v.animating > now ? 2 : 0) + (v.hover ? 1 : 0); }
  function kick() { if (!raf && typeof window !== 'undefined') raf = window.requestAnimationFrame(loop); }

  /* ---- parts ------------------------------------------------------------ */

  /* A domed key: a dark collar set into the face and a coloured dome on it,
     each outlined. Pressing sinks it and lets it spring back. */
  function domeKey(colour, radius) {
    var g = new T.Group();
    var collar = new T.Mesh(new T.CylinderGeometry(radius * 1.12, radius * 1.18, radius * 0.32, 40), toon('#2b3439'));
    collar.rotation.x = Math.PI / 2; collar.position.z = radius * 0.16;
    outline(collar, 2.5);
    g.add(collar);
    var cap = new T.Group();
    var dome = new T.Mesh(new T.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), toon(colour));
    dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.62, 1);
    outline(dome, 3);
    cap.add(dome);
    /* a highlight: one flat sliver, upper left, the way the 2D keys had it */
    var shine = new T.Mesh(new T.CircleGeometry(radius * 0.22, 20), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    shine.position.set(-radius * 0.34, radius * 0.34, radius * 0.5);
    shine.scale.set(1.3, 0.8, 1);
    cap.add(shine);
    cap.position.z = radius * 0.3;
    g.add(cap);
    g.userData.cap = cap; g.userData.rest = cap.position.z; g.userData.dome = dome;
    return g;
  }

  /* how far a key is pressed in, 0..1, `age` ms after the press */
  function pressDepth(age) {
    if (age < 0 || age > 260) return 0;
    if (age < 70) return age / 70;
    var k = (age - 70) / 190;
    return Math.max(0, (1 - k) * Math.cos(k * Math.PI * 1.5));   /* a little overshoot */
  }

  function plate(w, h, d, colour, radius) {
    var m = new T.Mesh(new T.RoundedBoxGeometry(w, h, d, 4, Math.min(radius || 10, d / 2 - 0.01)), toon(colour));
    outline(m, 3);
    return m;
  }

  /* a flat inked line on the face, slightly raised so it is never under it */
  function line(points, width, colour) {
    var g = new T.Group();
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var bar = new T.Mesh(new T.BoxGeometry(len + width, width, 2), new T.MeshBasicMaterial({ color: colour || INK }));
      bar.position.set((a[0] + b[0]) / 2, -(a[1] + b[1]) / 2, 1);
      bar.rotation.z = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.add(bar);
    }
    return g;
  }

  D.module3d = {
    available: function () { return ok(); },
    defer: defer,
    stage: stage,
    parts: { toon: toon, outline: outline, textTexture: textTexture, domeKey: domeKey,
             pressDepth: pressDepth, plate: plate, line: line },
    THREE: function () { return T; }
  };
})(DEFUSAL);
