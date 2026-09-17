/* ==========================================================================
   THE MANUAL — rendering

   Shared by the standalone manual page and by the game's Solo overlay, so
   there is exactly one implementation of "what the manual looks like". It
   reads MANUAL_RULES, which tools/extract-manual.py generates from the printed
   .docx: nothing here is retyped and the two cannot drift.

   Live examples are mounted with the real module code, deliberately inert —
   solve, strike and progress are no-ops and the module is told it is never
   solved — so the manual can never change what the game does.
   ========================================================================== */

var MANUAL_RENDER = (function () {
  'use strict';

  var TINT = { easy: '#6cc48a', medium: '#e0b552', hard: '#e0766c' };

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function mountExample(stage, def, seed) {
    var D = window.DEFUSAL;
    var rng = D.makeRng(seed);
    var serial = D.makeSerial(rng);
    var ctx = { serial: serial, serialInfo: D.serialInfo(serial) };
    var bay = el('div', 'bay module' + (def.wide ? ' wide' : ''), null);
    bay.style.width = (def.wide ? 612 : 300) + 'px';
    bay.style.height = '300px';
    bay.style.margin = '0 auto';
    var body = el('div', 'body', bay);
    var puzzle = def.generate(rng, ctx);
    def.mount(body, {
      puzzle: puzzle, solution: def.solve(puzzle, ctx), ctx: ctx,
      isSolved: function () { return false; },
      solve: function () {}, strike: function () {}, progress: function () {},
      onSolved: null, cleanup: null
    });
    stage.innerHTML = '';
    stage.appendChild(bay);
    return serial;
  }

  function runsInto(node, runs, fallback) {
    if (!runs || !runs.length) { node.textContent = fallback || ''; return; }
    runs.forEach(function (r) {
      if (r[1]) el('b', null, node, r[0]);
      else node.appendChild(document.createTextNode(r[0]));
    });
  }

  function isHeading(b) {
    return /^Step \d|^Diagram \d/.test(b.text) ||
           (b.style || '').toLowerCase().indexOf('heading') === 0;
  }

  function renderBlocks(host, blocks) {
    var list = null;
    blocks.forEach(function (b) {
      if (b.kind === 'table') {
        list = null;
        var rows = b.rows.filter(function (r) {
          return r.some(function (c) { return c !== ''; });
        });
        if (!rows.length) return;
        var tb = el('table', null, el('div', 'tablewrap', host));
        var hr = el('tr', null, el('thead', null, tb));
        rows[0].forEach(function (c) { el('th', null, hr, c); });
        var body = el('tbody', null, tb);
        var headTail = rows[0].slice(1).join('');
        rows.slice(1).forEach(function (r) {
          var tr = el('tr', null, body);
          /* Word keeps the metric and American unit charts in ONE table with a
             second header row part-way down. A row whose tail repeats the
             header's is that second header, not data. */
          var sub = r.length === rows[0].length &&
                    r.slice(1).join('') === headTail;
          if (sub) tr.className = 'subhead';
          r.forEach(function (c) { el(sub ? 'th' : 'td', null, tr, c); });
        });
        return;
      }
      if (b.kind === 'list') {
        if (!list) list = el('ul', null, host);
        runsInto(el('li', null, list), b.runs, b.text);
        return;
      }
      list = null;
      /* Attention! is tested BEFORE the heading rule: Word gives it a heading
         style too, and it would otherwise lose its warning colour. */
      var cls = b.text === 'Attention!' ? 'attn' : (isHeading(b) ? 'h' : '');
      runsInto(el('p', cls, host), b.runs, b.text);
    });
  }

  /* ---- public ------------------------------------------------------------ */

  function build(host, opts) {
    opts = opts || {};
    var D = window.DEFUSAL, R = window.MANUAL_RULES, sections = [];

    R.modules.forEach(function (m, i) {
      var def = D && D.byId[m.id];
      var sec = el('section', 'mod', host);
      sec.id = (opts.idPrefix || '') + m.id;
      sec.dataset.name = m.name.toLowerCase();
      sec.dataset.module = m.id;

      var head = el('div', 'mod-head', sec);
      el('h2', null, head, m.name);
      el('span', 'badge ' + m.difficulty, head, m.difficulty);
      el('p', 'tagline', sec, m.tagline || '');

      if (def && opts.examples) {
        var ex = el('div', 'example', sec);
        var exHead = el('div', 'example-head', ex);
        el('span', null, exHead, 'Example');
        var chip = el('span', 'serial-chip', exHead);
        var btn = el('button', null, exHead, 'Another example');
        btn.type = 'button';
        var stage = el('div', 'stage', ex);
        var seed = 1000 + i * 37;
        function draw() { chip.textContent = 'SERIAL ' + mountExample(stage, def, seed); }
        btn.addEventListener('click', function () { seed += 101; draw(); });
        draw();
        el('p', 'note', ex,
          'A real round, drawn by the game. The serial shown belongs to this ' +
          'example — in play, read the serial off the device itself.');
      }

      renderBlocks(el('div', 'rules', sec), m.blocks);
      sections.push(sec);
    });
    return sections;
  }

  function toc(host, prefix) {
    var R = window.MANUAL_RULES;
    R.modules.forEach(function (m) {
      var link = el('a', null, host);
      link.href = '#' + (prefix || '') + m.id;
      el('span', 'dot', link).style.background = TINT[m.difficulty] || '#888';
      link.appendChild(document.createTextNode(m.name));
    });
  }

  /* ---- search ------------------------------------------------------------
     Highlighting walks text nodes rather than touching innerHTML, so the
     tables and the live SVG artwork survive a search unharmed. */

  function clearMarks(root) {
    var marks = root.querySelectorAll('mark'), i;
    for (i = 0; i < marks.length; i++) {
      var m = marks[i];
      m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
    }
    root.normalize();
  }

  function markAll(root, needle) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.closest('.stage, mark')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.toLowerCase().indexOf(needle) >= 0
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var hits = [], n;
    while ((n = walker.nextNode())) hits.push(n);
    hits.forEach(function (node) {
      var text = node.nodeValue, low = text.toLowerCase(), at = 0, idx;
      var frag = document.createDocumentFragment();
      while ((idx = low.indexOf(needle, at)) >= 0) {
        if (idx > at) frag.appendChild(document.createTextNode(text.slice(at, idx)));
        el('mark', null, frag, text.slice(idx, idx + needle.length));
        at = idx + needle.length;
      }
      if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
      node.parentNode.replaceChild(frag, node);
    });
    return hits.length;
  }

  function search(sections, raw) {
    var needle = (raw || '').trim().toLowerCase(), shown = 0;
    sections.forEach(function (sec) {
      clearMarks(sec);
      if (!needle) { sec.hidden = false; shown++; return; }
      var hit = sec.dataset.name.indexOf(needle) >= 0;
      if (markAll(sec.querySelector('.rules'), needle) > 0) hit = true;
      sec.hidden = !hit;
      if (hit) shown++;
    });
    return shown;
  }

  return { build: build, toc: toc, search: search, TINT: TINT, el: el };
})();
