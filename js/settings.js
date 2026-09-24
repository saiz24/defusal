/* ==========================================================================
   DEFUSAL — the player's settings.

   One store for every preference that is not a sound level (those live with
   the mixer in audio.js). Each is read once at load, applied to the page as a
   class or a custom property on <html>/<body>, and written back on change:

     motion      'auto' | 'on' | 'off'   reduce motion. AUTO follows the
                                         system setting; ON and OFF override it
     shake       true | false            the case kicking on a strike
     flash       0 .. 1                  how hard the screen flashes
     text        0.9 | 1 | 1.15 | 1.3    size of interface and manual text
     colorblind  true | false            letters on every colour-coded key
     scale       0.8 .. 1.2              size of the case at rest in its pane

   Loaded straight after core.js, so fx, the opening and the game can all ask
   it whether to move before they draw anything.
   ========================================================================== */

(function (D) {
  'use strict';

  var DEFAULTS = {
    motion: 'auto', shake: true, flash: 1, text: 1,
    colorblind: false, scale: 1
  };
  var TEXT_STEPS = [0.9, 1, 1.15, 1.3];

  var prefs = {}, listeners = [];

  function load(key) {
    try {
      var raw = window.localStorage.getItem('defusal.pref.' + key);
      if (raw === null) return DEFAULTS[key];
      var v = JSON.parse(raw);
      return valid(key, v) ? v : DEFAULTS[key];
    } catch (e) { return DEFAULTS[key]; }
  }

  function valid(key, v) {
    switch (key) {
      case 'motion': return v === 'auto' || v === 'on' || v === 'off';
      case 'shake': case 'colorblind': return v === true || v === false;
      case 'flash': return typeof v === 'number' && v >= 0 && v <= 1;
      case 'text': return TEXT_STEPS.indexOf(v) >= 0;
      case 'scale': return typeof v === 'number' && v >= 0.8 && v <= 1.2;
    }
    return false;
  }

  function save(key) {
    try { window.localStorage.setItem('defusal.pref.' + key, JSON.stringify(prefs[key])); }
    catch (e) {}
  }

  Object.keys(DEFAULTS).forEach(function (k) { prefs[k] = load(k); });

  function systemReduced() {
    try {
      return !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function reducedMotion() {
    if (prefs.motion === 'on') return true;
    if (prefs.motion === 'off') return false;
    return systemReduced();
  }

  /* Everything visual is driven from here: CSS reads the classes and the two
     custom properties, and nothing else has to know a setting exists. */
  function apply() {
    var root = document.documentElement, body = document.body;
    if (root && root.style && root.style.setProperty) {
      root.style.setProperty('--ui-text', String(prefs.text));
      root.style.setProperty('--flash-k', String(prefs.flash));
    }
    var host = body || root;
    if (!host || !host.classList) return;
    host.classList.toggle('rm', reducedMotion());
    host.classList.toggle('no-shake', !prefs.shake);
    host.classList.toggle('no-flash', prefs.flash <= 0.001);
    host.classList.toggle('cb', !!prefs.colorblind);
  }

  function notify(key) {
    listeners.slice().forEach(function (fn) {
      try { fn(key, prefs[key]); } catch (e) {}
    });
  }

  var P = {
    DEFAULTS: DEFAULTS,
    TEXT_STEPS: TEXT_STEPS,
    get: function (key) { return prefs[key]; },
    set: function (key, v) {
      if (!valid(key, v)) return false;
      prefs[key] = v;
      save(key);
      apply();
      notify(key);
      return true;
    },
    reducedMotion: reducedMotion,
    onChange: function (fn) { listeners.push(fn); },

    /* Every setting back to how it shipped — including the sound levels and
       the manual's size, which are stored elsewhere. Progress is not a
       setting and is left alone. */
    reset: function () {
      Object.keys(DEFAULTS).forEach(function (k) {
        prefs[k] = DEFAULTS[k];
        try { window.localStorage.removeItem('defusal.pref.' + k); } catch (e) {}
      });
      apply();
      notify('*');
    },
    apply: apply
  };

  /* ---- the settings screen ------------------------------------------------
     Wired here rather than in game.js so a setting is one file: its default,
     its storage, its effect and its control. game.js hands over the few
     things only it can do (repaint the sound rows, a click sound). */
  function initUI(hooks) {
    hooks = hooks || {};
    var q = function (id) { return document.getElementById(id); };
    var click = hooks.click || function () {};
    if (!q('set-tabs')) return;

    /* tabs: the pill slides; the pages swap without moving anything below */
    var tabBar = q('set-tabs');
    var tabs = [].slice.call(tabBar.querySelectorAll('.seg-btn'));
    var pages = [].slice.call(document.querySelectorAll('.set-list[data-page]'));
    tabBar.style.setProperty('--n', tabs.length);
    function showTab(name) {
      var at = 0;
      tabs.forEach(function (t, i) {
        var on = t.dataset.tab === name;
        if (on) at = i;
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      tabBar.querySelector('.seg-pill').style.transform = 'translateX(' + (at * 100) + '%)';
      pages.forEach(function (pg) { pg.hidden = pg.dataset.page !== name; });
      try { window.sessionStorage.setItem('defusal.setTab', name); } catch (e) {}
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { click(); showTab(t.dataset.tab); });
    });
    var firstTab = 'sound';
    try { firstTab = window.sessionStorage.getItem('defusal.setTab') || 'sound'; } catch (e) {}
    showTab(firstTab);

    /* a segmented choice bound to one setting */
    function seg(id, key, items) {
      var host = q(id);
      if (!host) return function () {};
      var pill = host.querySelector('.seg-pill');
      var btns = items.map(function (it) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'seg-btn'; b.textContent = it.label;
        b.addEventListener('click', function () {
          if (P.get(key) === it.value) return;
          click(); P.set(key, it.value);
        });
        host.appendChild(b);
        return b;
      });
      return function paint() {
        var at = 0;
        items.forEach(function (it, i) { if (P.get(key) === it.value) at = i; });
        pill.style.transform = 'translateX(' + (at * 100) + '%)';
        btns.forEach(function (b, i) { b.classList.toggle('on', i === at); });
      };
    }

    /* an ON/OFF key bound to one setting */
    function toggle(id, key) {
      var b = q(id);
      if (!b) return function () {};
      b.addEventListener('click', function () { click(); P.set(key, !P.get(key)); });
      return function paint() {
        var on = !!P.get(key);
        b.textContent = on ? 'ON' : 'OFF';
        b.classList.toggle('on', on);
      };
    }

    /* a slider bound to one setting, shown as a whole-number percentage */
    function slider(id, key) {
      var el = q(id), out = q(id.replace('pref-', 'val-'));
      if (!el) return function () {};
      el.addEventListener('input', function () { P.set(key, Number(el.value) / 100); });
      el.addEventListener('change', function () { click(); });
      return function paint() {
        var v = Math.round(P.get(key) * 100);
        el.value = v;
        var lo = Number(el.min), hi = Number(el.max);
        el.style.setProperty('--fill', ((v - lo) / (hi - lo) * 100) + '%');
        if (out) out.textContent = String(v);
      };
    }

    var painters = [
      seg('pref-text', 'text', [
        { value: 0.9, label: 'S' }, { value: 1, label: 'M' },
        { value: 1.15, label: 'L' }, { value: 1.3, label: 'XL' }
      ]),
      seg('pref-motion', 'motion', [
        { value: 'auto', label: 'AUTO' }, { value: 'on', label: 'ON' },
        { value: 'off', label: 'OFF' }
      ]),
      toggle('pref-shake', 'shake'),
      toggle('pref-colorblind', 'colorblind'),
      slider('pref-flash', 'flash'),
      slider('pref-scale', 'scale'),
      function () {
        var note = q('motion-note');
        if (note) {
          note.textContent = P.get('motion') === 'auto'
            ? 'AUTO follows your system: ' + (systemReduced() ? 'reduced' : 'full motion')
            : (P.get('motion') === 'on' ? 'animations kept to a minimum' : 'full motion, whatever the system says');
        }
      }
    ];
    function paintAll() { painters.forEach(function (f) { f(); }); }
    P.onChange(paintAll);
    paintAll();

    /* FULLSCREEN is a state of the window, not a stored preference: it is
       read back from the document every time it changes, including when the
       player leaves it with Esc. Hidden where the browser has no fullscreen
       (an iPhone), rather than offered and then refused. */
    var fsRow = q('row-fullscreen'), fsBtn = q('pref-fullscreen');
    var de = document.documentElement;
    var canFs = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function paintFs() {
      var on = !!fsEl();
      fsBtn.textContent = on ? 'ON' : 'OFF';
      fsBtn.classList.toggle('on', on);
    }
    if (fsRow) fsRow.hidden = !canFs;
    if (fsBtn && canFs) {
      fsBtn.addEventListener('click', function () {
        click();
        try {
          if (fsEl()) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          } else {
            var r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
            if (r && r.catch) r.catch(function () {});
          }
        } catch (e) {}
      });
      document.addEventListener('fullscreenchange', paintFs);
      document.addEventListener('webkitfullscreenchange', paintFs);
      paintFs();
    }

    var resetBtn = q('reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        click();
        P.reset();
        if (hooks.resetSound) hooks.resetSound();
        resetBtn.textContent = 'DONE';
        setTimeout(function () { resetBtn.textContent = 'RESET'; }, 1400);
      });
    }
  }

  P.initUI = initUI;

  /* The system setting can change while the game is open; AUTO follows it. */
  try {
    var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq) {
      var onSys = function () { if (prefs.motion === 'auto') { apply(); notify('motion'); } };
      if (mq.addEventListener) mq.addEventListener('change', onSys);
      else if (mq.addListener) mq.addListener(onSys);
    }
  } catch (e) {}

  /* The <html> properties can go on now; the body classes as soon as there
     is a body, which is before anything animates. */
  apply();
  if (typeof document !== 'undefined' && document.addEventListener && !document.body) {
    document.addEventListener('DOMContentLoaded', apply);
  }

  D.prefs = P;
})(DEFUSAL);
