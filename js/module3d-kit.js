/* ==========================================================================
   DEFUSAL — the kit every 3D module is built from.

   A 3D module does not re-implement its puzzle. It mounts the module's own
   2D view, hidden, inside its bay, and keeps it as the single source of
   truth: the counters, the strikes, the solve, the timers, what is disabled.
   The 3D layer only presents it:

     printed figures   (a triangle, two angles, a Venn diagram, playing cards,
                        a ruler) become texture-printed panels — the SVG the
                        2D view drew, minus its buttons
     keys and domes    become real 3D parts that forward a press to the
                        original control, so its own handler runs
     text boxes        keep the original <input> — the keyboard still works
                        — set into a recessed 3D slot

   so the rules can never drift between the two views: there is only one.
   ========================================================================== */

(function (D) {
  'use strict';

  var M = D.module3d;
  if (!M) return;
  var T = null;

  function three() { return T || (T = M.THREE()); }

  /* ---- the hidden 2D source ---------------------------------------------- */

  function source(host, def, inst) {
    var box = document.createElement('div');
    box.className = 'm3d-src';
    host.appendChild(box);
    def.mount(box, inst);
    return box;
  }

  /* ---- SVG figures as printed panels -------------------------------------- */

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* Draw an SVG into a texture. `crop` is a viewBox rectangle; `drop` is a
     selector for parts to leave out (the buttons, which become 3D). Returns
     the texture at once — blank — and fills it when the image has loaded. */
  function svgTexture(svg, opts, onReady) {
    opts = opts || {};
    var THREE = three();
    var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number);
    var crop = opts.crop || vb;
    var clone = svg.cloneNode(true);
    if (opts.drop) [].forEach.call(clone.querySelectorAll(opts.drop), function (n) { n.remove(); });
    clone.setAttribute('xmlns', SVGNS);
    clone.setAttribute('viewBox', crop.join(' '));
    /* sharp enough for a close lean-in, never more than 2048 px a side:
       a bigger sheet is a slower first draw for nothing the eye can see */
    var k = Math.min(opts.scale || 3, 2048 / Math.max(crop[2], crop[3]));
    var pw = Math.round(crop[2] * k), ph = Math.round(crop[3] * k);
    clone.setAttribute('width', pw); clone.setAttribute('height', ph);
    clone.removeAttribute('class');
    var style = document.createElementNS(SVGNS, 'style');
    style.textContent = (D.plexEmbed || '') + 'text{font-family:"PlexFig","Plex Sans Condensed",sans-serif;font-weight:700}';
    clone.insertBefore(style, clone.firstChild);
    var canvas = document.createElement('canvas'); canvas.width = pw; canvas.height = ph;
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    var img = new Image();
    img.onload = function () {
      var x = canvas.getContext('2d');
      if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, pw, ph); }
      x.drawImage(img, 0, 0, pw, ph);
      tex.needsUpdate = true;
      if (onReady) onReady();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    return tex;
  }

  /* A printed panel: the figure on a flat face, on a plate a little larger
     than it, raised off the module. `rect` is where it goes on the canvas
     (x, y, w, h); returns a function mapping the figure's own coordinates
     (its viewBox) to the canvas. */
  function panel(view, svg, rect, opts) {
    opts = opts || {};
    var THREE = three(), P = M.parts;
    var vb = opts.crop || (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number);
    var tex = svgTexture(svg, { crop: vb, drop: opts.drop, bg: opts.paper || '#f4f1e8', scale: opts.scale }, function () { view.invalidate(); });
    var lift = opts.lift === undefined ? 4 : opts.lift;
    if (opts.plate !== false) {
      view.at(P.plate(rect[2] + 10, rect[3] + 10, 6, opts.plateColour || '#d9d3c4', 8), rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, lift - 3);
    }
    var face = new THREE.Mesh(new THREE.PlaneGeometry(rect[2], rect[3]), new THREE.MeshBasicMaterial({ map: tex }));
    view.at(face, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, lift + 0.2);
    return function (x, y) {
      return [rect[0] + (x - vb[0]) / vb[2] * rect[2], rect[1] + (y - vb[1]) / vb[3] * rect[3]];
    };
  }

  /* where an SVG button group sits, in the figure's coordinates: the centre
     and size of its shapes (domes are circles, keys are rects) */
  function shapeBox(g) {
    var xs = [], ys = [];
    [].forEach.call(g.querySelectorAll('circle'), function (c) {
      var cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), r = +c.getAttribute('r');
      if (!r) return;
      xs.push(cx - r, cx + r); ys.push(cy - r, cy + r);
    });
    [].forEach.call(g.querySelectorAll('rect'), function (rc) {
      var x = +rc.getAttribute('x'), y = +rc.getAttribute('y'), w = +rc.getAttribute('width'), h = +rc.getAttribute('height');
      if (!w) return;
      xs.push(x, x + w); ys.push(y, y + h);
    });
    if (!xs.length) return null;
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    /* a dome's top circle sits above its shadow: the cap is the TOP of the
       stack, so the centre is taken from the highest circle */
    var circles = [].slice.call(g.querySelectorAll('circle')).filter(function (c) { return +c.getAttribute('r'); });
    if (circles.length) {
      var top = circles.reduce(function (a, b) { return +b.getAttribute('cy') < +a.getAttribute('cy') ? b : a; });
      return { cx: +top.getAttribute('cx'), cy: +top.getAttribute('cy'), r: +top.getAttribute('r'), w: x1 - x0, h: y1 - y0 };
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }

  /* ---- keys ------------------------------------------------------------------ */

  /* Fire the original control: a DOM click, which bubbles to the bay like
     any press, so the press sound and every handler run exactly as before. */
  function fire(el) {
    if (!el) return;
    if (typeof el.click === 'function' && el.tagName !== 'g') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function track(view) {
    if (view.__kit) return view.__kit;
    var kit = view.__kit = { keys: [], tokens: {}, extra: [] };
    view.beforeDraw = function (now) {
      var cb = document.body && document.body.classList.contains('cb');
      kit.keys.forEach(function (k) {
        var d = M.parts.pressDepth(now - (k.userData.pressedAt || -1e9));
        if (k.userData.cap) k.userData.cap.position.z = k.userData.rest - d * k.userData.travel;
        var lit = view.hover === k ? 0.13 : 0;
        (k.userData.paint || []).forEach(function (m) { if (m.emissive) m.emissive.setRGB(lit, lit, lit); });
        if (k.userData.tag) k.userData.tag.visible = cb;
        if (k.userData.sync) k.userData.sync();
      });
      kit.extra.forEach(function (f) { f(now); });
    };
    view.canvas.__keys = function (token) { var k = kit.tokens[token]; return k ? view.screenOf(k) : null; };
    return kit;
  }

  function press(view, key, target) {
    return function () {
      key.userData.pressedAt = performance.now();
      view.animate(320);
      fire(target);
      view.invalidate();
    };
  }

  /* A rounded keycap with a printed label. opts: x, y (centre), w, h,
     colour, label, ink, font, token, target (the control it fires), tag
     (a COLOUR LABELS letter) */
  function key(view, opts) {
    var THREE = three(), P = M.parts, kit = track(view);
    var g = new THREE.Group();
    var well = new THREE.Mesh(new THREE.RoundedBoxGeometry(opts.w + 8, opts.h + 8, 6, 3, 5), P.toon('#2b3439'));
    well.position.z = 3; g.add(well);
    var cap = new THREE.Group();
    var body = new THREE.Mesh(new THREE.RoundedBoxGeometry(opts.w, opts.h, 14, 4, Math.min(10, opts.h / 4)), P.toon(opts.colour || '#e6dcc6'));
    P.outline(body, 2.5); cap.add(body);
    if (opts.label) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(opts.w - 6, opts.h - 6), new THREE.MeshBasicMaterial({
        map: P.textTexture(opts.label, { w: 512, h: Math.round(512 * (opts.h - 6) / (opts.w - 6)), color: opts.ink || '#1a2429',
          font: opts.font || ('700 ' + Math.round(300 * (opts.h - 6) / (opts.w - 6) * 0.55) + 'px "Plex Sans Condensed", sans-serif') }),
        transparent: true }));
      face.position.z = 7.2; cap.add(face);
    }
    if (opts.tag) {
      var tag = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(opts.w, opts.h) * 0.6, Math.min(opts.w, opts.h) * 0.6), new THREE.MeshBasicMaterial({
        map: P.textTexture(opts.tag, { w: 128, h: 128, color: '#ffffff', font: '700 96px "Plex Sans Condensed", sans-serif', dy: 4 }),
        transparent: true, depthTest: false }));
      tag.position.z = 7.4; cap.add(tag); g.userData.tag = tag;
    }
    cap.position.z = 13; g.add(cap);
    g.userData.cap = cap; g.userData.rest = 13; g.userData.travel = 6; g.userData.paint = [body.material];
    view.at(g, opts.x, opts.y, 0);
    view.hit(g, press(view, g, opts.target));
    kit.keys.push(g);
    if (opts.token !== undefined) kit.tokens[opts.token] = g;
    return g;
  }

  /* A domed key, as the 2D view had them, with an optional printed label
     (a number, or a number over a measure) */
  function dome(view, opts) {
    var THREE = three(), P = M.parts, kit = track(view);
    var g = P.domeKey(opts.colour || '#f3efe4', opts.r);
    if (opts.label) {
      var lines = String(opts.label).split('\n');
      var face = new THREE.Mesh(new THREE.PlaneGeometry(opts.r * 1.8, opts.r * 1.8), new THREE.MeshBasicMaterial({
        map: labelTexture(lines, opts.ink), transparent: true, depthTest: false }));
      face.position.z = opts.r * 0.75; g.userData.cap.add(face);
    }
    g.userData.travel = opts.r * 0.24;
    g.userData.paint = [g.userData.dome.material];
    view.at(g, opts.x, opts.y, 0);
    view.hit(g, press(view, g, opts.target));
    kit.keys.push(g);
    if (opts.token !== undefined) kit.tokens[opts.token] = g;
    return g;
  }

  function labelTexture(lines, ink) {
    var THREE = three();
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (lines.length === 1) {
      x.fillStyle = ink || '#1a2429'; x.font = '700 130px "Plex Sans Condensed", sans-serif';
      x.fillText(lines[0], 128, 136);
    } else {
      x.fillStyle = ink || '#1a2429'; x.font = '700 110px "Plex Sans Condensed", sans-serif';
      x.fillText(lines[0], 128, 92);
      x.fillStyle = '#1f6aa5'; x.font = '700 78px "Plex Sans Condensed", sans-serif';
      x.fillText(lines[1], 128, 184);
    }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  /* ---- a raised plate carrying text ------------------------------------------ */

  function textPlate(view, text, rect, opts) {
    opts = opts || {};
    var THREE = three(), P = M.parts;
    var pl = view.at(P.plate(rect[2], rect[3], 10, opts.colour || '#f6f0e2', 10), rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 5);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(rect[2] - 12, rect[3] - 10), new THREE.MeshBasicMaterial({ transparent: true }));
    face.position.z = 5.2; pl.add(face);
    function print(t) {
      if (face.material.map) face.material.map.dispose();
      var hpx = 160, wpx = Math.round(hpx * (rect[2] - 12) / (rect[3] - 10));
      face.material.map = P.textTexture(t, { w: wpx, h: hpx, color: opts.ink || '#1a2429',
        font: opts.font || ('600 ' + (opts.px || 92) + 'px "Plex Sans Condensed", "Plex Sans", sans-serif'), dy: 6 });
      face.material.needsUpdate = true; view.invalidate();
    }
    print(text);
    if (document.fonts && document.fonts.load) document.fonts.load('600 92px "Plex Sans Condensed"').then(function () { print(text); }, function () {});
    return { mesh: pl, print: print };
  }

  /* ---- an entry slot: the original input, set into the module ---------------- */

  function slot(view, input, rect) {
    var THREE = three(), P = M.parts, kit = track(view);
    var well = new THREE.Mesh(new THREE.RoundedBoxGeometry(rect[2] + 10, rect[3] + 10, 8, 3, 8), P.toon('#2b3439'));
    view.at(well, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 2);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(rect[2], rect[3]), new THREE.MeshBasicMaterial({ color: '#0a1114' }));
    view.at(glass, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 6.2);
    var host = view.canvas.parentNode;
    host.classList.add('m3d-host');
    input.classList.add('m3d-input');
    input.style.left = rect[0] + 'px'; input.style.top = rect[1] + 'px';
    input.style.width = rect[2] + 'px'; input.style.height = rect[3] + 'px';
    var layer = host.querySelector('.m3d-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'm3d-layer'; host.appendChild(layer); }
    layer.appendChild(input);
    function place() {
      layer.style.left = view.canvas.offsetLeft + 'px';
      layer.style.top = view.canvas.offsetTop + 'px';
      layer.style.width = view.w + 'px'; layer.style.height = view.h + 'px';
    }
    place();
    kit.extra.push(place);
    (view.canvas.__inputs = view.canvas.__inputs || []).push(input);
    return input;
  }

  /* ---- a lamp that shows a colour, lit ------------------------------------- */

  function lamp(view, rect, colourOf) {
    var THREE = three(), P = M.parts, kit = track(view);
    var housing = view.at(P.plate(rect[2] + 12, rect[3] + 12, 10, '#2b3439', 10), rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 3);
    var glassMat = new THREE.MeshBasicMaterial({ color: '#cccccc' });
    var glass = new THREE.Mesh(new THREE.RoundedBoxGeometry(rect[2], rect[3], 6, 3, 8), glassMat);
    view.at(glass, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 9);
    var halo = new THREE.Mesh(new THREE.PlaneGeometry(rect[2] + 70, rect[3] + 70), new THREE.MeshBasicMaterial({
      map: haloTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    view.at(halo, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 1);
    kit.extra.push(function () {
      var c = colourOf();
      if (c) { glassMat.color.set(c); halo.material.color.set(c); halo.visible = true; }
      else { glassMat.color.set('#3a464d'); halo.visible = false; }
    });
    return glass;
  }
  var halo = null;
  function haloTexture() {
    if (halo) return halo;
    var THREE = three(), c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    halo = new THREE.CanvasTexture(c);
    return halo;
  }

  /* redraw when the hidden source changes on its own (a timer, a class) */
  function watch(view, node, opts) {
    if (!window.MutationObserver) return;
    new MutationObserver(function () { view.invalidate(); })
      .observe(node, opts || { attributes: true, subtree: true, childList: true, characterData: true });
  }

  /* a canvas the size of a bay's body: 268 square, or 580 wide */
  function stageFor(host, def) {
    return M.stage(host, def.wide ? 580 : 268, 268, true);
  }

  D.module3dKit = { source: source, panel: panel, svgTexture: svgTexture, shapeBox: shapeBox,
                    key: key, dome: dome, textPlate: textPlate, slot: slot, lamp: lamp,
                    watch: watch, fire: fire, track: track, stageFor: stageFor };
})(DEFUSAL);
