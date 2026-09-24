/* ==========================================================================
   DEFUSAL — the manual, inside the game.

   There is nowhere in the game that tells a player to open a file, follow a
   link or set up a second page. The manual is a view the game mounts: in Solo
   it is one half of a split screen, and in two-device mode it is what the
   second screen IS.

   It is typeset for the screen it is on, rather than embedded as a document.
   A PDF in a frame is somebody else's viewer inside ours — its own scrollbar,
   its own zoom, its own idea of a page, a sheet of white margin before a word
   is read, and on iOS only ever the first page. `manual/manual.pdf` is still
   built, because PRINTED mode needs something to print; it is simply not what
   a screen shows.

   Every word comes from MANUAL_RULES, which tools/extract-manual.py generates
   from the printed .docx, so the two cannot drift. There are no illustrations
   anywhere in it: the Expert never sees the device, and a drawing of a module
   invites them to match one by eye instead of asking the Defuser to describe
   it, which is the whole competency.

   There is no search, deliberately. The contents are how you find a module by
   name; a search box turns the manual into a lookup table — type the word the
   Defuser just said, read back the one line that matched — and the Expert is
   supposed to read the section.
   ========================================================================== */

(function (D) {
  'use strict';

  var uid = 0;

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function mount(host, opts) {
    opts = opts || {};
    host.innerHTML = '';
    var prefix = 'mv' + (++uid) + '-';

    var view = el('div', 'manual-view', host);

    var bar = el('div', 'mv-bar', view);
    el('span', 'mv-brand', bar, opts.title || 'MANUAL');
    if (opts.onBar) opts.onBar(bar);

    var slot = el('div', 'mv-slot', view);
    var paper = el('div', 'mv-paper', slot);

    if (!window.MANUAL_RENDER || !window.MANUAL_RULES) {
      el('p', 'mv-missing', paper,
        'The manual could not be loaded on this screen.');
      return { node: view, bar: bar };
    }

    var sheet = el('div', 'mv-sheet', paper);
    el('h1', 'mv-sheet-title', sheet, 'THE MANUAL');
    el('p', 'mv-sheet-sub', sheet,
      'You hold this. The Defuser holds the device and may not read it; you ' +
      'may not look at the device. Modules are not named on the device — ' +
      'find yours by what the Defuser describes.');

    var nav = el('nav', 'mv-toc', sheet);
    MANUAL_RENDER.toc(nav, prefix);
    /* the contents arrive one chip at a time; --i is the only thing the
       stagger needs and it costs one custom property per link */
    [].forEach.call(nav.children, function (a, i) {
      a.style.setProperty('--i', i);
    });

    var body = el('div', 'mv-body', sheet);
    var sections = MANUAL_RENDER.build(body, { examples: false,
                                               idPrefix: prefix });
    /* a long document arrives as it is scrolled to, not all at once */
    if (D.fx) D.fx.reveal(sections);

    zoomable(bar, paper, sheet);

    return { node: view, bar: bar };
  }

  /* ---- reading size --------------------------------------------------
     The manual zooms the way a document does: the text gets bigger and the
     lines re-wrap to the pane, so there is never a sideways scroll. CSS
     `zoom` rather than a transform, because a transform scales the page as
     a picture and leaves the line lengths where they were.

     A plain wheel still scrolls — this is something read top to bottom.
     Ctrl/Cmd + wheel, a trackpad pinch, two fingers, or the - and + in the
     bar change the size. One size for every manual pane, remembered. */
  var ZMIN = 0.7, ZMAX = 2.2, zoomNow = 1;
  var panes = [];
  try {
    var saved = Number(window.localStorage.getItem('defusal.manualZoom'));
    if (saved >= ZMIN && saved <= ZMAX) zoomNow = saved;
  } catch (e) {}

  function paint(p) {
    p.sheet.style.zoom = String(zoomNow);
    p.readout.textContent = Math.round(zoomNow * 100) + '%';
    p.minus.disabled = zoomNow <= ZMIN + 1e-3;
    p.plus.disabled = zoomNow >= ZMAX - 1e-3;
  }

  /* Scale about a point in the pane, so the line under the cursor or the
     fingers stays under them instead of the page jumping somewhere else.
     The text re-wraps as it grows, so positions do not simply scale; the
     block under the point is found first and put back under it after. */
  function blockAt(p, x, y) {
    var n = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    while (n && n !== p.sheet && n.parentNode) {
      if (/^(P|LI|H1|H2|H3|TR|NAV)$/.test(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  }

  function setZoom(p, next, clientX, clientY) {
    next = Math.max(ZMIN, Math.min(ZMAX, next));
    if (Math.abs(next - zoomNow) < 1e-4) return;
    var r = p.paper.getBoundingClientRect();
    if (clientY == null) { clientX = r.left + r.width / 2; clientY = r.top + r.height / 2; }
    var anchor = blockAt(p, clientX, clientY), frac = 0;
    if (anchor) {
      var a = anchor.getBoundingClientRect();
      frac = a.height ? (clientY - a.top) / a.height : 0;
    }
    var docY = (p.paper.scrollTop + clientY - r.top) / zoomNow;

    zoomNow = next;
    panes.forEach(paint);

    if (anchor && anchor.isConnected !== false) {
      var b = anchor.getBoundingClientRect();
      p.paper.scrollTop += (b.top + frac * b.height) - clientY;
    } else {
      p.paper.scrollTop = docY * zoomNow - (clientY - r.top);
    }
    try { window.localStorage.setItem('defusal.manualZoom', String(zoomNow)); }
    catch (e) {}
  }

  function zoomable(bar, paper, sheet) {
    var box = el('div', 'mv-zoom', bar);
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'text size');
    var minus = el('button', 'mv-zbtn', box, '\u2212');
    var readout = el('button', 'mv-zval', box, '100%');
    var plus = el('button', 'mv-zbtn', box, '+');
    [minus, readout, plus].forEach(function (b) { b.type = 'button'; });
    minus.setAttribute('aria-label', 'smaller text');
    plus.setAttribute('aria-label', 'larger text');
    readout.title = 'back to 100%';

    var p = { paper: paper, sheet: sheet, readout: readout,
              minus: minus, plus: plus };
    panes = panes.filter(function (q) { return q.paper.isConnected !== false; });
    panes.push(p);
    paint(p);

    minus.addEventListener('click', function () {
      setZoom(p, Math.round((zoomNow - 0.1) * 10) / 10);
      if (D.audio) D.audio.click();
    });
    plus.addEventListener('click', function () {
      setZoom(p, Math.round((zoomNow + 0.1) * 10) / 10);
      if (D.audio) D.audio.click();
    });
    readout.addEventListener('click', function () {
      setZoom(p, 1);
      if (D.audio) D.audio.click();
    });

    if (D.zoomGesture) {
      D.zoomGesture.attach(paper, {
        plainWheel: false,
        zoom: function (f, x, y) { setZoom(p, zoomNow * f, x, y); }
      });
    }
  }

  D.manualView = { mount: mount };
})(DEFUSAL);
