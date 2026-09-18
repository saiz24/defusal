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

    return { node: view, bar: bar };
  }

  D.manualView = { mount: mount };
})(DEFUSAL);
