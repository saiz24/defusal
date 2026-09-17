/* ==========================================================================
   DEFUSAL — how the two halves are held apart

   The game rests on one rule: the person who can see the device and the person
   who can read the rules are not the same person. Every mode keeps that rule;
   they differ only in where the manual lives and what it costs to read it.

     printed    the manual is on paper. The original, and still the best:
                nothing to set up, nothing to charge.
     twodevice  the manual is manual/index.html, open on a SECOND device. Same
                game, no printer. The Defuser's screen is still the only place
                the device can be seen.
     solo       one player, one screen. The manual is reachable from inside the
                round, but opening it hides the device and the clock does not
                stop. The information gap becomes a memory-and-retrieval
                problem instead of a communication one — a different exercise,
                honestly a lesser one, and the reason it is not the default.

   Stored with the same guarded localStorage the rest of the game uses: if
   storage is unavailable the mode simply resets to printed each session,
   which breaks nothing.
   ========================================================================== */

(function (D) {
  'use strict';

  var KEY = 'defusal.mode';
  var MODES = ['printed', 'twodevice', 'solo'];

  var META = {
    printed:   { label: 'PRINTED',    blurb: 'Two players. The Expert holds the printed manual.' },
    twodevice: { label: 'TWO DEVICE', blurb: 'Two players. The Expert opens the manual on a second phone.' },
    solo:      { label: 'SOLO',       blurb: 'One player. The manual is on this screen, and reading it costs time.' }
  };

  var current = 'printed';
  try {
    var saved = window.localStorage.getItem(KEY);
    if (MODES.indexOf(saved) >= 0) current = saved;
  } catch (e) {}

  D.mode = {
    MODES: MODES,
    META: META,
    get: function () { return current; },
    is: function (m) { return current === m; },
    set: function (m) {
      if (MODES.indexOf(m) < 0) return current;
      current = m;
      try { window.localStorage.setItem(KEY, m); } catch (e) {}
      document.body.setAttribute('data-mode', m);
      return current;
    },
    apply: function () { document.body.setAttribute('data-mode', current); }
  };
})(DEFUSAL);
