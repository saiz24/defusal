/* ==========================================================================
   DEFUSAL — the shell: how the game opens, and its main menu.

     splash      the name, lit, for a moment (a click skips it)
     opening     the prologue, on the very first visit only
     title       the desk at night, the device on it, PRESS ANY KEY
     main        CAMPAIGN · PRACTICE · ENTER CODE · MODE · SETTINGS · QUIT

   CAMPAIGN is the device carousel the game always had (it is still where a
   round returns to); PRACTICE and ENTER CODE open it on those pages. The
   3D desk (js/title3d.js) is behind the title and the main menu; without
   WebGL, or with 3D ROOM off, the 2D sky is.

   Any address that asks for something specific — ?intro=0, ?start=, ?cs=,
   ?modes=, ?page=, a mode or a role — goes straight there as before, so the
   tests and anybody's bookmark of a layout still land where they did.
   ========================================================================== */

(function (D) {
  'use strict';

  var node = {}, items = [], sel = 0, active = false;
  var ELECTRON = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);

  function wanted() {
    if (typeof location === 'undefined') return false;
    return !/[?&](intro|start|cs|modes|page|mode|role|split|scene|seed|debug)=/.test(location.search);
  }

  function q(id) { return document.getElementById(id); }

  /* ---- the backdrop behind title and menu ------------------------------ */
  function backdrop(which) {
    var on = which === 'title' || which === 'main';
    var used3d = on && D.title3d && D.title3d.show(which);
    if (!on && D.title3d) D.title3d.hide();
    node.bg.hidden = !used3d;
    document.body.classList.toggle('shell-3d', !!used3d);
  }

  /* ---- the main menu ---------------------------------------------------- */
  function paintMain() {
    var pr = D.progress ? D.progress() : { cleared: 0, total: 5 };
    var done = pr.cleared >= pr.total;
    node.campaignSub.textContent = done ? 'ALL ' + pr.total + ' ANSWERED' :
      (pr.cleared ? 'CONTINUE · DEVICE ' + (pr.cleared + 1) + ' / ' + pr.total : 'BEGIN · DEVICE 1 / ' + pr.total);
    var practiceLocked = pr.cleared < 1;
    node.practice.classList.toggle('locked', practiceLocked);
    node.practiceSub.textContent = practiceLocked ? 'OPENS AFTER DEVICE 1' : 'ANY NUMBER OF MODULES, ANY TIME';
    node.modeSub.textContent = (q('mode-now') && q('mode-now').textContent) || '';
    node.quit.hidden = !ELECTRON;
    items = [].filter.call(node.menu.querySelectorAll('.mm-item'), function (b) { return !b.hidden; });
    select(Math.min(sel, items.length - 1), true);
  }

  function select(i, quiet) {
    if (!items.length) return;
    sel = (i + items.length) % items.length;
    items.forEach(function (b, k) { b.classList.toggle('sel', k === sel); });
    if (!quiet && D.audio) D.audio.click();
  }

  function openCarousel(kind, e) {
    D.showMenu(e);
    if (kind) setTimeout(function () {
      var i = D.menuPage(kind);
      if (i >= 0) D.gotoPage(i);
    }, 0);
  }

  var ACTIONS = {
    campaign: function (e) { openCarousel(null, e); },
    practice: function (e) {
      if (node.practice.classList.contains('locked')) { if (D.fx) D.fx.play(node.practice, 'fx-shake', 460); return; }
      openCarousel('sandbox', e);
    },
    code: function (e) { openCarousel('seed', e); },
    mode: function (e) { D.showModeSelect(null, e); },
    settings: function (e) { D.openSettings(e); },
    quit: function () { if (D.audio) D.audio.powerdown(); setTimeout(function () { window.close(); }, 500); }
  };

  function choose(i, e) {
    var b = items[i]; if (!b) return;
    select(i, true);
    if (D.audio) D.audio.click();
    ACTIONS[b.dataset.go](e);
  }

  /* ---- title ------------------------------------------------------------ */
  var titleReady = false;
  function leaveTitle(e) {
    if (!titleReady || D.screenNow() !== 'title') return;
    titleReady = false;
    if (D.audio) { D.audio.unlock(); D.audio.whoosh(); }
    D.goTo('main', e);
  }

  /* ---- splash, then the way in ----------------------------------------- */
  function splash(next) {
    var reduced = D.prefs && D.prefs.reducedMotion();
    var gone = false;
    node.splash.hidden = false;
    void node.splash.offsetWidth;
    node.splash.classList.add('on');
    function done() {
      if (gone) return; gone = true;
      node.splash.classList.remove('on');
      node.splash.classList.add('off');
      setTimeout(function () { node.splash.hidden = true; node.splash.classList.remove('off'); }, 700);
      next();
    }
    node.splash.addEventListener('click', done);
    setTimeout(done, reduced ? 600 : 2200);
  }

  function start() {
    active = true;
    splash(function () {
      var seen = false;
      try { seen = window.localStorage.getItem('defusal.intro') === 'done' ||
                   window.localStorage.getItem('defusal.cine.intro') === '1'; } catch (e) {}
      if (!seen && D.cutscene) D.cutscene.play('intro');   /* it hands over the first device */
      else showTitle();
    });
  }

  function showTitle() {
    titleReady = false;
    D.goTo('title');
    setTimeout(function () { titleReady = true; }, 900);
  }

  D.shell = {
    wanted: wanted,
    active: function () { return active; },
    start: start,
    showTitle: showTitle,
    /* every screen change passes through here */
    onScreen: function (screen) {
      if (!node.bg) return;
      backdrop(screen);
      if (screen === 'main') paintMain();
      if (screen === 'menu') node.carouselBack.hidden = !active;
    },

    init: function () {
      node.bg = q('shell-bg');
      node.splash = q('splash');
      node.menu = q('main-menu');
      node.campaignSub = q('mm-campaign-sub');
      node.practice = q('mm-practice');
      node.practiceSub = q('mm-practice-sub');
      node.modeSub = q('mm-mode-sub');
      node.quit = q('mm-quit');
      node.carouselBack = q('menu-back');
      if (!node.menu) return;
      node.version = q('shell-version');
      if (node.version) node.version.textContent = 'v' + (D.VERSION || '1.2');

      [].forEach.call(node.menu.querySelectorAll('.mm-item'), function (b) {
        b.addEventListener('mouseenter', function () { var i = items.indexOf(b); if (i >= 0 && i !== sel) select(i); });
        b.addEventListener('click', function (e) { choose(items.indexOf(b), e); });
      });
      node.carouselBack.addEventListener('click', function (e) { if (D.audio) D.audio.click(); D.goTo('main', e); });

      q('screen-title').addEventListener('pointerdown', function (e) { leaveTitle(e); });
      document.addEventListener('keydown', function (e) {
        /* a key something else already acted on (Esc that just brought us
           here from the carousel) is not ours to act on again */
        if (e.defaultPrevented) return;
        var at = D.screenNow && D.screenNow();
        if (at === 'title') { if (!e.metaKey && !e.ctrlKey && e.key !== 'Escape') { e.preventDefault(); leaveTitle(); } return; }
        if (at !== 'main') return;
        if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); select(sel + 1); }
        else if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); select(sel - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(sel); }
        else if (e.key === 'Escape') { e.preventDefault(); showTitle(); }
      });
      if (D.prefs) D.prefs.onChange(function (k) {
        if ((k === 'room' || k === '*') && D.screenNow && (D.screenNow() === 'title' || D.screenNow() === 'main')) backdrop(D.screenNow());
      });
    }
  };
})(DEFUSAL);
