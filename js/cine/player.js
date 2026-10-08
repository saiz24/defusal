/* ==========================================================================
   DEFUSAL — the cutscene player.

   One canvas for the picture and a thin layer of HTML over it for the words:
   subtitles, title cards, the skip ring, BEGIN, the credits. A sequence is
   data (js/cine/script.js); each shot names a painter (js/cine/kit.js), a
   camera move, its lines and its sounds, and this file turns that into time.

   Timing is decided before anything plays. A shot's length is its opening
   beat, then each line for as long as it takes to say AND to read, then a
   hold. The voice is synthesised to roughly the same length as the estimate
   used here, so the pictures never wait on audio — and with the sound off,
   or no audio at all, the scenes run exactly the same.

   Input follows what players expect from games rather than from a slideshow:
   a tap completes the line being spoken, a second tap moves on, and holding
   for a second skips the whole scene. The skip ring only appears once a
   press has started; showing it all the time invites skipping.

   The old opening (js/cutscene.js) is gone; this keeps its interface —
   DEFUSAL.cutscene.play / has / isActive / skip / maybePlay / init — so the
   rest of the game did not have to change.
   ========================================================================== */

(function (D) {
  'use strict';

  var cine = D.cine = D.cine || {};
  var HOLD_MS = 1000;          /* press-and-hold to skip */
  var RING_AFTER = 160;        /* a tap never flashes the ring */
  var CARD_S = 3.0;            /* a title card's time on screen */
  var DISSOLVE_S = 1.1, BLACK_S = 0.9;
  var LINE_GAP = 0.45;         /* breath between two lines */

  /* ---- timing -------------------------------------------------------- */

  function readTime(text) { return text.length / 15 + 0.35; }   /* ~15 chars/s */
  function sayTime(text) { return cine.voice ? cine.voice.estimate(text) : readTime(text); }
  function lineTime(text) { return Math.max(readTime(text), sayTime(text)) + LINE_GAP; }

  /* Expand a shot as written into one with times: when each line starts and
     how long the shot lasts. Done once per sequence, so playback, the tests
     and the debug view all agree. */
  function expand(shot) {
    var wait = shot.wait === undefined ? 1.1 : shot.wait;
    var t = wait, at = [];
    (shot.lines || []).forEach(function (l) { at.push(t); t += lineTime(l); });
    var hold = shot.hold === undefined ? 0.6 : shot.hold;
    var dur = shot.dur || (t + hold);
    var out = {};
    for (var k in shot) if (Object.prototype.hasOwnProperty.call(shot, k)) out[k] = shot[k];
    out.lines = shot.lines || [];
    out.at = at;
    out.dur = Math.max(dur, 1);
    out.trans = shot.trans || 'dissolve';
    return out;
  }

  function sequence(name) {
    var s = cine.SEQ && cine.SEQ[name];
    if (!s) return null;
    if (!s._shots) s._shots = s.shots.map(expand);
    return s;
  }

  /* ---- settings ------------------------------------------------------ */

  function reduced() { return D.prefs ? D.prefs.reducedMotion() : false; }
  function lite() {
    try {
      return window.matchMedia('(pointer: coarse)').matches ||
             Math.min(window.innerWidth, window.innerHeight) < 500;
    } catch (e) { return false; }
  }
  /* FLASHES scales anything a painter calls a flash */
  cine.flashK = function () { return D.prefs ? D.prefs.get('flash') : 1; };
  cine.reduced = reduced;

  /* ---- state --------------------------------------------------------- */

  var node = {}, g = null, W = 0, H = 0, DPR = 1;
  var buf = null, bg = null;   /* the outgoing shot, still moving, painted here */
  var active = false, name = '', seq = null, shots = null, idx = 0;
  var phase = 'shot';          /* 'shot' | 'begin' | 'credits' */
  var t = 0, last = 0, raf = 0, paused = false, frozen = false;
  var line = -1, lineEnd = 0, sfxDone = {};
  var states = {}, prepQueue = [];
  var out = null;              /* { i, t } the shot being left, while it fades */
  var lead = 0, kind = 'black', cardOn = false;
  var onDone = null;
  var hold = null;             /* { at } while a press is held */

  var OUT_S = 0.7;             /* a shot fading to black before a card or a fade */
  var IN_S = 0.9;              /* a shot rising out of black */

  function resize() {
    if (!node.canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, lite() ? 1.25 : 2);
    cine.dpr = DPR;
    W = node.canvas.clientWidth || window.innerWidth || 1280;
    H = node.canvas.clientHeight || window.innerHeight || 720;
    node.canvas.width = Math.round(W * DPR);
    node.canvas.height = Math.round(H * DPR);
    states = {};               /* painted layers were for the old size */
    if (!buf) { buf = document.createElement('canvas'); bg = buf.getContext('2d'); }
    buf.width = node.canvas.width; buf.height = node.canvas.height;
  }

  function stateFor(i) {
    if (states[i]) return states[i];
    var s = shots[i], p = cine.kit.get(s.paint);
    states[i] = p && p.prepare ? (p.prepare(W, H, s.params || {}, lite()) || {}) : {};
    return states[i];
  }

  /* Prepare what is still unprepared, one shot per frame, only where it
     cannot be seen: while the screen is black or a title card is up.
     Painting the next scene's sheets in the middle of a moving shot is what
     made the cuts hitch (measured in the desktop app: 80-870 ms frames). */
  function prepareSome(onlyIfHidden) {
    if (!prepQueue.length) return;
    if (onlyIfHidden && !(t < -0.25)) return;
    var i = prepQueue.shift();
    if (shots && shots[i]) stateFor(i);
  }

  /* The camera moves at a constant speed through a shot. Easing every shot
     in and out made the picture stop dead at every cut and start again from
     rest; moving steadily, one shot hands its motion to the next. */
  function camera(s, tt) {
    var from = (s.cam && s.cam.from) || [0, 0, 1];
    var to = (s.cam && s.cam.to) || [from[0], from[1], from[2] * 1.05];
    if (reduced()) return { x: from[0], y: from[1], z: from[2] };
    var k = Math.min(1.15, Math.max(0, tt / s.dur));
    return {
      x: from[0] + (to[0] - from[0]) * k + Math.sin(tt * 0.7) * 0.0022,
      y: from[1] + (to[1] - from[1]) * k + Math.sin(tt * 0.53 + 1) * 0.0022,
      z: from[2] + (to[2] - from[2]) * k
    };
  }

  function paintInto(x, i, tt) {
    var s = shots[i], p = cine.kit.get(s.paint);
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (!p) return;
    x.save();
    try { p.draw(x, Math.max(0, tt), camera(s, Math.max(0, tt)), stateFor(i), W, H, s.params || {}); }
    catch (e) { if (window.console) console.error('cine paint ' + s.paint, e); }
    x.restore();
  }
  function paint(i, tt) { paintInto(g, i, tt); }

  function smooth(k) { k = Math.max(0, Math.min(1, k)); return k * k * k * (k * (k * 6 - 15) + 10); }

  function black(a) {
    if (a <= 0.001) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = Math.min(1, a);
    g.fillStyle = '#000'; g.fillRect(0, 0, node.canvas.width, node.canvas.height);
    g.globalAlpha = 1;
  }

  /* One frame of picture. Before a shot starts (t < 0) the outgoing shot, if
     any, keeps moving while it fades to black; then black, with a title card
     over it if the shot has one; then the shot rises out of black. A
     dissolve paints the outgoing shot live into a second canvas and lays it
     over the incoming one, so both keep moving through the change. */
  function render(dt) {
    var reducedNow = reduced();
    if (out) out.t += dt;
    if (t < 0) {
      var since = t + lead;                  /* seconds since the change began */
      if (out && since < OUT_S) {
        paint(out.i, out.t);
        black(smooth(since / OUT_S));
      } else {
        out = null;
        black(1);
      }
      return;
    }
    paint(idx, t);
    if (kind === 'dissolve' && out) {
      var span = reducedNow ? 0.35 : DISSOLVE_S;
      if (t < span) {
        paintInto(bg, out.i, out.t);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1 - smooth(t / span);
        g.drawImage(buf, 0, 0);
        g.globalAlpha = 1;
      } else out = null;
    } else if (kind !== 'cut' && t < IN_S) {
      black(1 - smooth(t / IN_S));
    }
  }

  /* ---- words ----------------------------------------------------------- */

  var revealTimers = [];
  function clearReveal() { revealTimers.forEach(clearTimeout); revealTimers = []; }

  function say(text, speak) {
    clearReveal();
    var dur = speak && cine.voice ? cine.voice.speak(text) : sayTime(text);
    var words = text.split(' ');
    node.sub.innerHTML = '';
    var spans = words.map(function (w) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      node.sub.appendChild(s);
      node.sub.appendChild(document.createTextNode(' '));
      return s;
    });
    node.sub.classList.add('on');
    if (reduced() || !speak) { spans.forEach(function (s) { s.classList.add('on'); }); return; }
    spans.forEach(function (s, i) {
      revealTimers.push(setTimeout(function () { s.classList.add('on'); },
        (i / words.length) * dur * 920));
    });
  }
  function revealAll() {
    clearReveal();
    [].forEach.call(node.sub.querySelectorAll('.w'), function (s) { s.classList.add('on'); });
  }
  function unsay() { clearReveal(); node.sub.classList.remove('on'); }

  function card(on, c) {
    if (on) {
      node.cardSmall.textContent = c[0] || '';
      node.cardBig.textContent = c[1] || '';
    }
    node.card.classList.toggle('on', !!on);
  }

  /* ---- the clock -------------------------------------------------------- */

  function enterShot(i, how) {
    var sh = shots[i];
    if (shots[idx] && active && phase === 'shot' && i !== idx) out = { i: idx, t: t };
    else if (i === 0) out = null;
    idx = i; line = -1; lineEnd = 0; sfxDone = {};
    kind = how || sh.trans;
    /* how long before the shot itself starts */
    lead = sh.card ? OUT_S + CARD_S : (kind === 'black' ? (out ? OUT_S : 0) + 0.25 : 0);
    if (!out && sh.card) lead = CARD_S + 0.3;
    t = -lead;
    cardOn = false;
    if (sh.card) unsay();
    phase = 'shot';
    if (sh.score !== undefined && cine.voice) cine.voice.score(sh.score);
  }

  function step(dt) {
    if (phase === 'credits') { t += dt; if (t > creditsLength()) finish(); return; }
    var s = shots[idx];
    t += dt;
    /* Nothing is painted while a picture is moving. If shots are still
       unprepared when the lead-in runs out, the screen stays black a few
       frames longer instead: a black hold is invisible, a painting mid-shot
       is a visible hitch. */
    if (t > -0.3 && t - dt <= -0.3 && prepQueue.length) t = -0.3;
    /* the title card, over black, between the fade out and the fade in */
    if (s.card) {
      var showFrom = -lead + (out || lead > CARD_S + 0.5 ? OUT_S : 0.3), hideAt = -0.95;
      var want = t >= showFrom && t < hideAt;
      if (want !== cardOn) {
        cardOn = want; card(want, s.card);
        if (want && cine.voice) cine.voice.cue('sting');
      }
    }
    if (t < 0) return;
    (s.sfx || []).forEach(function (c, k) {
      if (!sfxDone[k] && t >= c[0]) { sfxDone[k] = true; if (cine.voice) cine.voice.cue(c[1]); }
    });
    var next = line + 1;
    if (next < s.lines.length && t >= s.at[next]) {
      line = next;
      say(s.lines[line], true);
      lineEnd = s.at[line] + lineTime(s.lines[line]) - LINE_GAP;
    }
    if (line === s.lines.length - 1 && t > lineEnd + 0.25 && node.sub.classList.contains('on')) unsay();
    if (phase === 'begin') return;      /* the picture keeps living under BEGIN */
    if (t >= s.dur) {
      if (idx + 1 < shots.length) { enterShot(idx + 1); return; }
      endOfSequence();
    }
  }

  function endOfSequence() {
    unsay();
    if (seq.end === 'begin') {
      phase = 'begin';
      node.begin.hidden = false;
      node.begin.classList.add('in');
      return;
    }
    if (seq.end === 'credits') { startCredits(); return; }
    finish();
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (!active || frozen) return;
    var dt = Math.min(1 / 20, (now - (last || now)) / 1000);
    last = now;
    if (paused) return;
    prepareSome(true);
    step(dt);
    if (!active) return;
    render(phase === 'credits' ? 0 : dt);
    paintHold(now);
  }

  /* ---- credits ---------------------------------------------------------- */

  function creditsLength() { return 16; }
  function startCredits() {
    phase = 'credits'; t = 0;
    node.credits.classList.remove('roll');
    void node.credits.offsetWidth;
    node.credits.classList.add('roll');
    if (cine.voice) cine.voice.score('resolve');
  }

  /* ---- input: tap to move on, hold to skip ------------------------------ */

  function tap() {
    if (!active || phase === 'begin') return;
    if (t < 0) { t = -0.001; out = null; if (cardOn) { cardOn = false; card(false); } return; }
    if (phase === 'credits') { finish(); return; }
    var s = shots[idx];
    /* a line still arriving is completed first */
    if (line >= 0 && t < lineEnd && node.sub.querySelector('.w:not(.on)')) { revealAll(); return; }
    var next = line + 1;
    if (next < s.lines.length) { t = Math.max(t, s.at[next]); return; }
    t = s.dur;
  }

  function pressStart() {
    if (!active || hold) return;
    hold = { at: performance.now() };
  }
  function pressEnd() {
    if (!hold) return;
    var held = performance.now() - hold.at;
    hold = null;
    node.skip.classList.remove('on');
    node.ring.style.strokeDashoffset = '100';
    if (held < HOLD_MS) tap();
  }
  function paintHold(now) {
    if (!hold) return;
    var held = now - hold.at;
    if (held < RING_AFTER) return;
    node.skip.classList.add('on');
    node.ring.style.strokeDashoffset = String(100 - Math.min(100, held / HOLD_MS * 100));
    if (held >= HOLD_MS) { hold = null; node.skip.classList.remove('on'); finish(true); }
  }

  /* ---- start and stop ---------------------------------------------------- */

  function seenKey(n) { return 'defusal.cine.' + n; }
  function markSeen(n) { try { window.localStorage.setItem(seenKey(n), '1'); } catch (e) {} }
  function seen(n) {
    try {
      if (window.localStorage.getItem(seenKey(n)) === '1') return true;
      return n === 'intro' && window.localStorage.getItem('defusal.intro') === 'done';
    } catch (e) { return false; }
  }

  function canPlay() {
    return !!(node.canvas && g && cine.kit && cine.SEQ);
  }

  function play(n, done) {
    n = n || 'intro';
    var s = sequence(n);
    if (!s || !canPlay()) { if (done) done(); else if (D.showMenu) D.showMenu(); return; }
    if (active) finish(true, true);
    name = n; seq = s; shots = s._shots; onDone = done || null;
    markSeen(n);
    active = true; frozen = false; paused = false; last = 0; hold = null;
    phase = 'shot';
    node.root.hidden = false;
    node.begin.hidden = true; node.begin.classList.remove('in');
    node.credits.classList.remove('roll');
    document.body.classList.add('cutscene-open');
    resize();
    void node.root.offsetWidth;
    node.root.classList.add('open');
    if (D.audio) { D.audio.unlock(); D.audio.music(false); }
    var at = /[?&]scene=(\d+)/.exec(location.search);
    var first = at ? Math.min(Number(at[1]), shots.length - 1) : 0;
    states = {}; out = null; idx = first;
    prepQueue = shots.map(function (x, k) { return k; });
    prepQueue.splice(prepQueue.indexOf(first), 1);
    prepQueue.unshift(first);
    enterShot(first, 'black');
    if (!shots[first].card) { lead = 0.6; t = -lead; }
    /* the rest are painted one per frame during the black lead-in */
    if (!raf) raf = window.requestAnimationFrame(frame);
  }

  function finish(skipped, quiet) {
    if (!active) return;
    active = false; hold = null;
    unsay(); card(false);
    node.skip.classList.remove('on');
    node.begin.hidden = true; node.begin.classList.remove('in');
    node.credits.classList.remove('roll');
    node.root.classList.remove('open');
    node.root.hidden = true;
    document.body.classList.remove('cutscene-open');
    if (cine.voice) cine.voice.hush();
    states = {};
    if (quiet) return;
    var cb = onDone; onDone = null;
    /* The prologue's own exit is BEGIN. Skipping it lands where BEGIN would
       have, so the first device is still handed over rather than a menu. */
    if (name === 'intro' && seq && seq.end === 'begin' && !cb) {
      if (D.showModeSelect) D.showModeSelect(D.startFirstDevice);
      else if (D.showMenu) D.showMenu();
      return;
    }
    if (cb) cb();
    else if (D.showMenu) D.showMenu();
  }

  /* ---- debug: what the tests and the contact sheet use ------------------ */

  /* Is the canvas showing a picture, or nothing? Shrinks the frame to a few
     pixels and looks for any spread in brightness. */
  function nonBlank() {
    var c = document.createElement('canvas'); c.width = 32; c.height = 18;
    var x = c.getContext('2d');
    x.drawImage(node.canvas, 0, 0, 32, 18);
    var d = x.getImageData(0, 0, 32, 18).data, lo = 255, hi = 0, sum = 0;
    for (var i = 0; i < d.length; i += 4) {
      var v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v;
    }
    return hi - lo > 12 && sum / (d.length / 4) > 3;
  }

  var debug = {
    names: function () { return Object.keys(cine.SEQ || {}); },
    shots: function (n) {
      var s = sequence(n);
      return s ? s._shots.map(function (x) { return { paint: x.paint, dur: x.dur, lines: x.lines }; }) : [];
    },
    freeze: function (n, i, tt) {
      var s = sequence(n);
      if (!s || !canPlay()) return false;
      if (name !== n || !frozen) states = {};
      name = n; seq = s; shots = s._shots; idx = i; t = tt;
      active = true; frozen = true; phase = 'shot';
      node.root.hidden = false; node.root.classList.add('open');
      document.body.classList.add('cutscene-open');
      if (!W) resize();
      paint(i, tt);
      var sh = shots[i], li = -1;
      sh.at.forEach(function (a, k) { if (tt >= a) li = k; });
      if (li >= 0) say(sh.lines[li], false); else unsay();
      card(false);
      return nonBlank();
    },
    release: function () {
      frozen = false; active = false;
      node.root.classList.remove('open'); node.root.hidden = true;
      document.body.classList.remove('cutscene-open');
      unsay(); states = {};
    },
    state: function () { return { seq: name, shot: idx, line: line, phase: phase, t: Math.round(t * 10) / 10 }; },
    duration: function (n) {
      var s = sequence(n);
      return s ? s._shots.reduce(function (a, x) { return a + x.dur; }, 0) : 0;
    }
  };

  /* ---- wiring ------------------------------------------------------------ */

  D.cutscene = {
    isActive: function () { return active && !frozen; },
    play: play,
    /* a scene that belongs to a place in the story plays the first time only */
    playOnce: function (n, done) {
      if (!sequence(n) || seen(n)) { if (done) done(); return; }
      play(n, done);
    },
    has: function (n) { return !!(cine.SEQ && cine.SEQ[n]); },
    skip: function () { finish(true); },
    debug: debug,

    init: function () {
      node.root = document.getElementById('cutscene');
      node.canvas = document.getElementById('cine-canvas');
      node.sub = document.getElementById('cine-sub');
      node.card = document.getElementById('cine-card');
      node.cardSmall = node.card && node.card.querySelector('small');
      node.cardBig = node.card && node.card.querySelector('b');
      node.skip = document.getElementById('cine-skip');
      node.ring = document.getElementById('cine-ring');
      node.begin = document.getElementById('cs-begin');
      node.credits = document.getElementById('cine-credits');
      if (!node.root || !node.canvas || !node.canvas.getContext) return;
      g = node.canvas.getContext('2d');
      if (!g) return;
      window.addEventListener('resize', function () { if (active) resize(); });

      node.begin.addEventListener('click', function (e) {
        e.stopPropagation();
        D.audio.click();
        var hand = function () {
          finish(false, true);
          if (D.showModeSelect) D.showModeSelect(D.startFirstDevice);
          else if (D.startFirstDevice) D.startFirstDevice();
        };
        if (!D.fx) { hand(); return; }
        D.audio.whoosh();
        D.fx.iris({ x: e.clientX, y: e.clientY, color: '#0a1318', hold: hand });
      });

      node.root.addEventListener('pointerdown', function (e) {
        if (e.target === node.begin) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pressStart();
      });
      window.addEventListener('pointerup', function () { if (active) pressEnd(); });
      window.addEventListener('pointercancel', function () { hold = null; if (node.skip) node.skip.classList.remove('on'); });
      document.addEventListener('keydown', function (e) {
        if (!active || frozen) return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (phase === 'begin' && e.key === 'Enter') { node.begin.click(); return; }
          if (!e.repeat) pressStart();
        }
      });
      document.addEventListener('keyup', function (e) {
        if (!active || frozen) return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); pressEnd(); }
      });
      /* a scene does not play on to an empty room */
      document.addEventListener('visibilitychange', function () { paused = document.hidden; last = 0; });
      window.addEventListener('blur', function () { paused = true; });
      window.addEventListener('focus', function () { paused = false; last = 0; });
    },

    maybePlay: function () {
      if (/[?&]start=/.test(location.search)) return;
      if (/[?&]intro=0/.test(location.search)) return;
      var want = /[?&]cs=([\w-]+)/.exec(location.search);
      if (want && sequence(want[1])) { play(want[1]); return; }
      if (/[?&]intro=1/.test(location.search)) { play('intro'); return; }
      if (seen('intro')) return;
      play('intro');
    }
  };
})(DEFUSAL);
