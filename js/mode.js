/* ==========================================================================
   DEFUSAL — how the two halves are held apart

   The game rests on one rule: the person who can see the device and the person
   who can read the rules are not the same person. Every mode keeps that rule;
   they differ only in where the manual lives and what it costs to read it.

     printed    the manual is on paper. The original, and still the best:
                nothing to set up, nothing to charge.
     twodevice  two players, two screens. Each screen is told what it is —
                the device or the manual — and shows only that. The manual is
                the manual itself, inside the game, not a link to a file.
     solo       one player, one screen, split: the device on one side and the
                manual on the other. Either half can be pushed to full screen
                and the split can be turned; it starts vertical.

   Stored with the same guarded localStorage the rest of the game uses: if
   storage is unavailable every setting simply resets each session, which
   breaks nothing.
   ========================================================================== */

(function (D) {
  'use strict';

  var KEY = 'defusal.mode';
  var ROLE_KEY = 'defusal.role';
  var SPLIT_KEY = 'defusal.split';
  var RATIO_KEY = 'defusal.splitat.';

  var MODES = ['printed', 'twodevice', 'solo'];
  var ROLES = ['bomb', 'manual'];
  var SPLITS = ['vertical', 'horizontal'];

  var META = {
    printed:   { label: 'PRINTED',   players: '2 PLAYERS' },
    twodevice: { label: '2 DEVICES', players: '2 PLAYERS' },
    solo:      { label: 'SOLO',      players: '1 PLAYER' }
  };

  function read(key, allowed, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      if (allowed.indexOf(v) >= 0) return v;
    } catch (e) {}
    return fallback;
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }

  /* The headless harness runs this file against a minimal DOM that has no
     style objects, and a mode is not worth crashing a test run over. */
  function paintRatio(pct) {
    try {
      document.documentElement.style.setProperty(
        '--split-at', pct.toFixed(2) + '%');
    } catch (e) {}
  }

  var current = read(KEY, MODES, 'printed');
  var role = read(ROLE_KEY, ROLES, 'bomb');
  var split = read(SPLIT_KEY, SPLITS, 'vertical');

  /* Where the divider sits, per orientation and as a percentage. A player who
     wants the device on two thirds of the glass and the rules on one third is
     not asking for a different mode, and 50/50 is only ever a starting guess:
     which half needs the room depends on the device in front of them. */
  var MIN_AT = 20, MAX_AT = 80;
  var ratio = { vertical: 50, horizontal: 50 };

  SPLITS.forEach(function (k) {
    try {
      var v = parseFloat(window.localStorage.getItem(RATIO_KEY + k));
      if (isFinite(v) && v >= MIN_AT && v <= MAX_AT) ratio[k] = v;
    } catch (e) {}
  });

  /* Which half of a Solo split is showing. Deliberately NOT stored: it is a
     view, changed several times a round, and a player who left it on MANUAL
     should still be handed the device when they come back. */
  var pane = 'both';        /* both | bomb | manual */

  function applyBody() {
    var b = document.body;
    b.setAttribute('data-mode', current);
    b.setAttribute('data-role', current === 'twodevice' ? role : 'bomb');
    b.classList.toggle('split-v', current === 'solo' && split === 'vertical');
    b.classList.toggle('split-h', current === 'solo' && split === 'horizontal');
    b.classList.toggle('pane-bomb', current === 'solo' && pane === 'bomb');
    b.classList.toggle('pane-manual', current === 'solo' && pane === 'manual');
    paintRatio(ratio[split]);
  }

  D.mode = {
    MODES: MODES,
    META: META,

    get: function () { return current; },
    is: function (m) { return current === m; },
    set: function (m) {
      if (MODES.indexOf(m) < 0) return current;
      current = m;
      write(KEY, m);
      applyBody();
      return current;
    },

    /* two-device only: is this screen the device or the manual? */
    getRole: function () { return current === 'twodevice' ? role : 'bomb'; },
    setRole: function (r) {
      if (ROLES.indexOf(r) < 0) return role;
      role = r;
      write(ROLE_KEY, r);
      applyBody();
      return role;
    },

    /* solo only: which way the split runs, and which half is showing */
    getSplit: function () { return split; },
    setSplit: function (s) {
      if (SPLITS.indexOf(s) < 0) return split;
      split = s;
      write(SPLIT_KEY, s);
      applyBody();
      return split;
    },
    toggleSplit: function () {
      return D.mode.setSplit(split === 'vertical' ? 'horizontal' : 'vertical');
    },

    /* where the divider sits in the CURRENT orientation, 20..80 */
    MIN_AT: MIN_AT,
    MAX_AT: MAX_AT,
    getRatio: function () { return ratio[split]; },
    setRatio: function (pct) {
      if (!isFinite(pct)) return ratio[split];
      pct = Math.max(MIN_AT, Math.min(MAX_AT, pct));
      ratio[split] = pct;
      write(RATIO_KEY + split, String(pct));
      paintRatio(pct);
      return pct;
    },
    resetRatio: function () { return D.mode.setRatio(50); },

    getPane: function () { return pane; },
    setPane: function (p) {
      pane = (p === 'bomb' || p === 'manual') ? p : 'both';
      applyBody();
      return pane;
    },

    /* does this screen draw a bomb at all? */
    showsBomb: function () {
      return !(current === 'twodevice' && role === 'manual');
    },
    /* does this screen carry the manual inside the round? */
    showsManual: function () {
      return current === 'solo' ||
             (current === 'twodevice' && role === 'manual');
    },

    apply: applyBody
  };
})(DEFUSAL);
