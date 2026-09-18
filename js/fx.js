/* ==========================================================================
   DEFUSAL — the motion layer.

   Everything here is presentation and nothing here is allowed to matter. Game
   state always changes synchronously; if every animation in this file failed
   to run, the same rounds would be dealt, the same answers accepted and the
   same clock would expire. That is the rule the rest of the game is written
   to, and this file exists to make it look like something without breaking it.

   THE BUDGET
   ----------
   The game runs on a phone, scaled inside one transform, next to a ticking
   clock and a Web Audio graph. So:

   * transform and opacity only. Those two are handed to the compositor and
     cost no layout and no repaint. Anything that animates width, top, filter
     or box-shadow in a loop re-rasterises its layer every frame and is not
     worth what it buys.
   * one listener, not two hundred. Presses are delegated at the document, so
     adding a button anywhere in the game gets the press feedback for free and
     costs nothing.
   * nodes created for an effect delete themselves when it ends. A ripple
     lives about 550ms and then is gone.
   * `will-change` is set when an effect starts and cleared when it finishes.
     Left on, it pins a layer per element for the life of the page.
   * every rAF loop here is short and self-cancelling: nothing in this file
     is left ticking after the effect it belongs to has finished.
   * `prefers-reduced-motion` turns the lot off — not "runs it faster", off.
     Callbacks still fire, immediately, so nothing waits on an animation that
     is never going to play.
   ========================================================================== */

(function (D) {
  'use strict';

  /* Is there anything here that can animate at all? The headless harness
     drives the real game against a minimal DOM with no layout, no rAF and no
     media queries — it must take the same path as a player who has asked for
     no motion, which is: the effect does not run, and whatever the effect was
     supposed to hand over to happens immediately. An animation that never
     finishes would otherwise hold the game behind it. */
  function canAnimate() {
    return !!(typeof document !== 'undefined' && document.body &&
              window.requestAnimationFrame && window.matchMedia);
  }

  function reduced() {
    if (!canAnimate()) return true;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function raf(fn) {
    return window.requestAnimationFrame
      ? window.requestAnimationFrame(fn)
      : setTimeout(fn, 16);
  }

  /* ---------- press ripples ------------------------------------------------
     One delegated listener for the whole game. A ripple is a single absolutely
     positioned node inside the control, scaled from the point that was pressed
     out past the far corner, and removed when its animation ends. */

  /* Controls ON THE CASE are deliberately absent. The case is laid out at a
     fixed design size and scaled to the viewport in one transform, so a
     button's box on screen and its box in its own coordinate space are two
     different sizes — a ripple measured from getBoundingClientRect and then
     positioned in the element's own space lands in the wrong place at the
     wrong size, and the error grows as the case gets smaller. The case has
     its own press feedback: a key press sound and an :active scale. */
  var RIPPLE_SEL = '.key, .sound, .nav, .opt-btn, .lay-btn, .mode-key, ' +
                   '.mv-toc a, .cs-begin, .cs-skip, .reader-back';

  function closestRipple(node) {
    while (node && node !== document) {
      if (node.matches) {
        /* nothing inside the case ripples, whatever it is */
        if (node.id === 'bomb') return null;
        if (node.matches(RIPPLE_SEL)) return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function ripple(host, x, y) {
    if (!host || reduced()) return;
    var r = host.getBoundingClientRect();
    if (!r.width) return;
    /* far enough to clear the furthest corner from where the finger landed */
    var dx = Math.max(x - r.left, r.right - x);
    var dy = Math.max(y - r.top, r.bottom - y);
    var size = Math.ceil(Math.sqrt(dx * dx + dy * dy) * 2);

    var n = document.createElement('span');
    n.className = 'fx-ripple';
    n.style.width = n.style.height = size + 'px';
    n.style.left = (x - r.left - size / 2) + 'px';
    n.style.top = (y - r.top - size / 2) + 'px';

    /* The ripple is positioned against its host, so the host has to be a
       containing block — but only if it is not one ALREADY. Forcing
       `position: relative` on everything took SKIP and BEGIN, which are
       absolutely placed, out of their positions the instant they were
       pressed: the button jumped out from under the cursor and the click
       landed on nothing. A control that is already positioned is left alone. */
    var anchored = true;
    try {
      anchored = window.getComputedStyle(host).position !== 'static';
    } catch (e) {}
    host.classList.add('fx-clip');
    if (!anchored) host.classList.add('fx-anchor');
    host.appendChild(n);

    n.addEventListener('animationend', function () {
      if (n.parentNode) n.parentNode.removeChild(n);
      if (!host.querySelector('.fx-ripple')) {
        host.classList.remove('fx-clip', 'fx-anchor');
      }
    });
  }

  /* ---------- the iris -----------------------------------------------------
     A disc that opens from the point you pressed until it covers the screen,
     hands over, and then opens away again on the other side. It is how the
     game cuts between two places that are not the same place: the opening
     into the mode screen, the mode screen into a device.

     One node, one transform. A clip-path circle would repaint the layer every
     frame; a scaled div is composited and costs the same at any size. */

  var irisNode = null, irisBusy = false;

  function irisEl() {
    if (!irisNode) {
      irisNode = document.createElement('div');
      irisNode.className = 'fx-iris';
      irisNode.setAttribute('aria-hidden', 'true');
      document.body.appendChild(irisNode);
    }
    return irisNode;
  }

  /* opts: { x, y, color, hold } — hold is called at full cover */
  function iris(opts) {
    opts = opts || {};
    var hold = opts.hold || function () {};
    var done = opts.done || function () {};
    if (reduced() || irisBusy) { hold(); done(); return; }

    var w = window.innerWidth || 1280, h = window.innerHeight || 720;
    var x = (opts.x === undefined) ? w / 2 : opts.x;
    var y = (opts.y === undefined) ? h / 2 : opts.y;
    /* the disc has to reach the furthest corner from where it starts */
    var dx = Math.max(x, w - x), dy = Math.max(y, h - y);
    var size = Math.ceil(Math.sqrt(dx * dx + dy * dy) * 2) + 40;

    var n = irisEl();
    irisBusy = true;
    n.style.width = n.style.height = size + 'px';
    n.style.left = (x - size / 2) + 'px';
    n.style.top = (y - size / 2) + 'px';
    n.style.background = opts.color || '#070d11';
    n.style.willChange = 'transform';
    n.hidden = false;
    n.classList.remove('close', 'open');
    void n.offsetWidth;
    n.classList.add('close');

    var covered = false, ended = false, t1 = 0, t2 = 0;

    function cover() {
      if (covered) return;
      covered = true;
      hold();
      n.classList.remove('close');
      void n.offsetWidth;
      n.classList.add('open');
    }

    /* Every exit goes through here, exactly once, and it takes the listener
       and both guards with it. Adding a listener per call and only removing
       it on the happy path left one behind for every cut of the session, and
       an old one firing would re-run the transition it had closed over. */
    function end() {
      if (ended) return;
      ended = true;
      n.removeEventListener('animationend', onEnd);
      clearTimeout(t1);
      clearTimeout(t2);
      n.classList.remove('close', 'open');
      n.hidden = true;
      n.style.willChange = '';
      irisBusy = false;
      done();
    }

    function onEnd(e) {
      if (e.animationName === 'fxIrisClose') cover();
      else if (e.animationName === 'fxIrisOpen') end();
    }
    n.addEventListener('animationend', onEnd);

    /* a stalled animation must never strand the player behind a black disc */
    t1 = setTimeout(cover, 1400);
    t2 = setTimeout(end, 3200);
  }

  /* ---------- numbers that arrive rather than appear -----------------------
     The result screen's figures roll up to their value. One rAF for about
     half a second, then it stops; there is no interval left running. */

  function countUp(node, to, opts) {
    opts = opts || {};
    var fmt = opts.format || String;
    if (reduced() || !node) { node.textContent = fmt(to); return; }
    var from = opts.from || 0;
    var dur = opts.duration || 620;
    var t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      /* ease-out: it should look like it is settling, not braking */
      var e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) raf(step); else node.textContent = fmt(to);
    }
    raf(step);
  }

  /* ---------- reveal on scroll ---------------------------------------------
     The manual is long. Its sections arrive as they are scrolled to rather
     than all being painted at full strength at once. One observer for the
     whole document, and each section stops being watched the moment it has
     been seen — an observer that keeps watching everything forever is the
     usual way this ends up costing something. */

  var seen = null;

  function revealObserver() {
    if (seen || !window.IntersectionObserver) return seen;
    seen = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('fx-seen');
        seen.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
    return seen;
  }

  function reveal(nodes) {
    if (!nodes || !nodes.length) return;
    if (reduced() || !window.IntersectionObserver) {
      [].forEach.call(nodes, function (n) { n.classList.add('fx-seen'); });
      return;
    }
    var io = revealObserver();
    [].forEach.call(nodes, function (n) {
      n.classList.add('fx-reveal');
      io.observe(n);
    });
    /* Insurance. A section that starts life inside a hidden pane, or in a
       scroller the observer never gets a callback for, must not stay at
       opacity 0 — the manual being invisible is a far worse failure than the
       manual arriving without its animation. */
    setTimeout(function () {
      [].forEach.call(nodes, function (n) { n.classList.add('fx-seen'); });
    }, 3000);
  }

  /* ---------- things that have to MOVE when the layout changes -------------
     A screen that swaps a line of copy for a longer one, or grows a row of
     options it did not have a moment ago, shoves everything under it down by
     however many pixels it grew. Snapping is the thing that reads as broken.

     FLIP: measure where everything is, let the change happen, measure again,
     put everything back where it was with a transform, and then release it.
     Two rect reads and one composited transform per element — the layout work
     happens once, in the middle, not on every frame. */

  function flip(nodes, mutate, opts) {
    opts = opts || {};
    nodes = [].slice.call(nodes || []);
    if (reduced() || !nodes.length) { mutate(); return; }

    var dur = opts.duration || 480;
    var first = nodes.map(function (n) { return n.getBoundingClientRect(); });
    mutate();
    var last = nodes.map(function (n) { return n.getBoundingClientRect(); });

    var moved = [];
    nodes.forEach(function (n, i) {
      var dx = first[i].left - last[i].left;
      var dy = first[i].top - last[i].top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      n.style.transition = 'none';
      n.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' +
                          dy.toFixed(1) + 'px,0)';
      moved.push(n);
    });
    if (!moved.length) return;

    /* one reflow for the whole set, not one per element */
    void moved[0].offsetWidth;
    moved.forEach(function (n) {
      n.style.transition = 'transform ' + dur + 'ms cubic-bezier(.2,.9,.25,1)';
      n.style.transform = '';
    });
    setTimeout(function () {
      moved.forEach(function (n) { n.style.transition = ''; n.style.transform = ''; });
    }, dur + 80);
  }

  /* ---------- a one-shot class ---------------------------------------------
     Restart an animation that may already be on the element, and take the
     class back off when it finishes so it can be played again. */

  function play(node, cls, ms) {
    if (!node || reduced()) return;
    /* a space-separated list is allowed: classList takes one token per
       argument and throws on a string containing a space */
    var list = String(cls).split(/\s+/).filter(Boolean);
    if (!list.length) return;
    list.forEach(function (c) { node.classList.remove(c); });
    void node.offsetWidth;
    list.forEach(function (c) { node.classList.add(c); });
    setTimeout(function () {
      list.forEach(function (c) { node.classList.remove(c); });
    }, ms || 700);
  }

  /* The menus used to lean towards the cursor. It is gone: a whole-screen
     layer that answers every pointer move is a cost paid on every frame the
     mouse is in motion, for an effect nobody asked for and which read as the
     screen being loose. The sky already drifts on its own.
     ------------------------------------------------------------------------ */

  /* ---------- wiring -------------------------------------------------------- */

  function init() {
    /* Presses, for every control in the game, from one listener. pointerdown
       rather than click: the ripple should start under the finger, not after
       it lifts. */
    document.addEventListener('pointerdown', function (e) {
      var host = closestRipple(e.target);
      if (host && !host.disabled) ripple(host, e.clientX, e.clientY);
    }, { passive: true });

    /* Keyboard operators get the same feedback, centred. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var host = closestRipple(document.activeElement);
      if (!host || host.disabled) return;
      var r = host.getBoundingClientRect();
      ripple(host, r.left + r.width / 2, r.top + r.height / 2);
    });

  }

  D.fx = {
    init: init,
    reduced: reduced,
    ripple: ripple,
    iris: iris,
    countUp: countUp,
    reveal: reveal,
    flip: flip,
    play: play
  };
})(DEFUSAL);
