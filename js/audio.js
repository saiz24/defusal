/* ==========================================================================
   DEFUSAL — sound.
   Every noise is synthesised at runtime with the Web Audio API: oscillators,
   filtered noise and envelopes. No audio files, nothing to download, still
   works from file://.

   Browsers refuse to start audio before a gesture, so the context is created
   and resumed on the first pointer press. Everything is a no-op when there is
   no Web Audio (the headless test harness, for one).
   ========================================================================== */

(function (D) {
  'use strict';

  var AC = (typeof window !== 'undefined') &&
           (window.AudioContext || window.webkitAudioContext);

  var ctx = null, master = null, noiseBuf = null;
  var pending = [];        /* beeps queued on the audio clock */
  var enabled = true;

  try { enabled = window.localStorage.getItem('defusal.sound') !== 'off'; }
  catch (e) { /* file:// may refuse storage; default to on */ }

  function remember() {
    try { window.localStorage.setItem('defusal.sound', enabled ? 'on' : 'off'); }
    catch (e) {}
  }

  function unlock() {
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1.6;

      /* A limiter after the master, so the level can be pushed this hard
         without overlapping sounds summing past 1.0 and clipping — several
         of these fire at once (a beep under a solve under a relay). It sits
         mostly idle and only catches peaks. */
      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.14;

      master.connect(limiter);
      limiter.connect(ctx.destination);
      var n = ctx.sampleRate * 1.2, i;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    /* the intro can ask for music before a gesture has let audio run */
    if (musWanted && !mus) startMusic();
  }

  /* Scheduling while the context is still resuming is fine: its clock is
     paused, so anything queued plays the moment the browser lets it. */
  function live() { return enabled && !!ctx && ctx.state !== 'closed'; }
  function now() { return ctx.currentTime; }

  /* ---- the cutscene bed -------------------------------------------------
     A drone with a few slow notes over it, all from one pentatonic set so it
     can never land on a chord that sounds like a warning. It sits well under
     the voice, and it is synthesised like everything else — there is no file
     to download. */

  var BELL = [440, 523.25, 587.33, 659.25, 783.99];   /* A minor pentatonic */
  var ARP  = [220, 261.63, 293.66, 329.63, 293.66, 261.63];
  var STEP = 0.30;                                   /* ~100bpm in sixteenths */
  var mus = null, musWanted = false;

  function bell(at) {
    var f = BELL[Math.floor(Math.random() * BELL.length)];
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
    o.connect(g); g.connect(mus.out);
    o.start(at); o.stop(at + 2.9);
  }

  /* the pulse underneath: a soft low thump, not a drum */
  function thump(at, peak) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(46, at + 0.2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    o.connect(g); g.connect(mus.out);
    o.start(at); o.stop(at + 0.45);
  }

  /* the line that actually moves */
  function pluck(at, f, peak) {
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, at);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.52);
    var bq = ctx.createBiquadFilter();
    bq.type = 'lowpass';
    bq.frequency.setValueAtTime(2800, at);
    bq.frequency.exponentialRampToValueAtTime(760, at + 0.5);
    o.connect(g); g.connect(bq); bq.connect(mus.out);
    o.start(at); o.stop(at + 0.58);
  }

  /* One step of the sequence. It is a grid rather than a scatter of notes,
     which is what gives it a pulse to follow, and it lifts over the first
     four bars so the opening builds instead of just sitting there. */
  function musicStep(i, at) {
    var bar = (i / 16) | 0;
    var beat = i % 16;
    var lift = Math.min(1, 0.68 + bar * 0.11);

    if (beat % 4 === 0) thump(at, (beat === 0 ? 0.085 : 0.05) * lift);

    /* the line runs from the first bar: holding it back left the opening as
       one thump every 1.2s, which is the sparseness this was meant to fix */
    if (beat % 2 === 1) pluck(at, ARP[((i / 2) | 0) % ARP.length], 0.030 * lift);

    /* an octave above on the off-beats, from the second bar, so it opens out */
    if (bar > 0 && beat % 4 === 2) {
      pluck(at, ARP[((i / 4) | 0) % ARP.length] * 2, 0.017 * lift);
    }
    if (beat === 11 && bar % 2 === 1) bell(at);
  }

  /* queued ahead on the audio clock, same as the countdown beeps */
  function scheduleBed() {
    if (!mus || !live()) return;
    var t = now(), horizon = t + 1.2, n = 0;
    while (mus.next < horizon && n++ < 24) {
      musicStep(mus.step++, mus.next);
      mus.next += STEP;
    }
  }

  function startMusic() {
    if (!live() || mus) return;
    var t = now();

    var out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 2.2);     /* never just arrives */
    out.connect(master);

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.Q.value = 0.6;
    lp.connect(out);

    var osc = [];
    [[55, 'triangle', 0.05], [55.3, 'triangle', 0.05], [82.5, 'sine', 0.03]]
      .forEach(function (d) {
        var o = ctx.createOscillator();
        o.type = d[1];
        o.frequency.setValueAtTime(d[0], t);
        var g = ctx.createGain();
        g.gain.value = d[2];
        o.connect(g); g.connect(lp);
        o.start(t);
        osc.push(o);
      });

    mus = { out: out, osc: osc, next: t + 0.4, step: 0, timer: 0 };
    mus.timer = setInterval(scheduleBed, 250);
    scheduleBed();
  }

  function stopMusic() {
    if (!mus) return;
    var m = mus; mus = null;
    clearInterval(m.timer);
    if (!ctx) return;
    var t = now();
    try {
      m.out.gain.cancelScheduledValues(t);
      m.out.gain.setValueAtTime(m.out.gain.value, t);
      m.out.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    } catch (e) {}
    m.osc.forEach(function (o) { try { o.stop(t + 1.4); } catch (e) {} });
  }

  /* one enveloped oscillator */
  function tone(o) {
    var t = (o.at === undefined ? now() : o.at);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to !== undefined) {
      if (o.glide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
      else osc.frequency.linearRampToValueAtTime(o.to, t + o.dur);
    }
    var peak = o.gain === undefined ? 0.2 : o.gain;
    var atk = o.attack === undefined ? 0.004 : o.attack;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    var tail = g;
    if (o.filter) {
      var bq = ctx.createBiquadFilter();
      bq.type = o.filter;
      bq.frequency.setValueAtTime(o.cutoff || 1200, t);
      if (o.cutoffTo) bq.frequency.exponentialRampToValueAtTime(o.cutoffTo, t + o.dur);
      bq.Q.value = o.q || 1;
      g.connect(bq); tail = bq;
    }
    osc.connect(g);
    tail.connect(master);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  /* one enveloped burst of filtered noise */
  function hiss(o) {
    var t = (o.at === undefined ? now() : o.at);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var bq = ctx.createBiquadFilter();
    bq.type = o.filter || 'bandpass';
    bq.frequency.setValueAtTime(o.cutoff || 1800, t);
    if (o.cutoffTo) bq.frequency.exponentialRampToValueAtTime(Math.max(20, o.cutoffTo), t + o.dur);
    bq.Q.value = o.q || 1;
    var g = ctx.createGain();
    var peak = o.gain === undefined ? 0.12 : o.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(bq); bq.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + o.dur + 0.02);
  }

  /* --- the kit ----------------------------------------------------------- */

  var tock = false;

  var A = {
    unlock: unlock,

    /* the cutscene bed, on or off */
    music: function (on) {
      musWanted = !!on;
      if (on) startMusic(); else stopMusic();
    },

    /* the case losing power when the round is abandoned */
    powerdown: function () {
      if (!live()) return;
      tone({ f: 340, to: 62, dur: 0.52, type: 'sawtooth', gain: 0.09,
             glide: 'exp', filter: 'lowpass', cutoff: 1700, cutoffTo: 240 });
      tone({ f: 170, to: 42, dur: 0.62, type: 'triangle', gain: 0.07,
             glide: 'exp' });
    },


    isOn: function () { return enabled; },
    toggle: function () {
      enabled = !enabled;
      remember();
      if (enabled) { unlock(); A.click(); }
      return enabled;
    },

    /* soft UI click */
    click: function () {
      if (!live()) return;
      hiss({ dur: 0.035, gain: 0.09, filter: 'bandpass', cutoff: 2400, q: 1.4 });
      tone({ f: 760, to: 520, dur: 0.05, type: 'triangle', gain: 0.06 });
    },

    /* a key on a module: a small plastic snap */
    press: function () {
      if (!live()) return;
      hiss({ dur: 0.028, gain: 0.07, filter: 'bandpass', cutoff: 3200, q: 2 });
      tone({ f: 480, to: 320, dur: 0.06, type: 'square', gain: 0.045 });
    },

    /* the relay behind a panel changing state */
    relay: function () {
      if (!live()) return;
      hiss({ dur: 0.02, gain: 0.035, filter: 'highpass', cutoff: 2600 });
    },

    /* A beep, not a tick. It climbs in pitch and shortens as the clock runs
       down, so urgency is audible without anything getting louder. */
    /* The clock read time on the audio hardware, not the JS timer: this is
       the only clock accurate enough for an even pulse. */
    now: function () { return ctx ? ctx.currentTime : 0; },

    /* A timer beep is a piezo buzzer, not a musical note: a hard-gated square
       wave. The gate matters more than the pitch — a soft attack reads as a
       chime, an instant one reads as digital. `at` is an absolute time on the
       audio clock, so the caller can queue beeps ahead of the JS timer. */
    beep: function (urgency, at) {
      if (!live()) return;
      var u = Math.max(0, Math.min(1, urgency || 0));
      var t = now();
      if (at !== undefined && at > t) t = at;

      var f = 1000 + u * 760;
      var dur = 0.075 - u * 0.028;
      var peak = 0.07 + u * 0.05;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.0015);  /* instant, no click */
      g.gain.setValueAtTime(peak, t + dur - 0.005);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);

      /* take the very top off the square so it is sharp, not harsh */
      var bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.setValueAtTime(6200, t);
      bq.Q.value = 0.4;

      var a = ctx.createOscillator();
      a.type = 'square';
      a.frequency.setValueAtTime(f, t);

      var b = ctx.createOscillator();          /* a little bite on top */
      b.type = 'square';
      b.frequency.setValueAtTime(f * 2.01, t);
      var bg = ctx.createGain();
      bg.gain.value = 0.16;

      a.connect(g);
      b.connect(bg); bg.connect(g);
      g.connect(bq); bq.connect(master);
      a.start(t); b.start(t);
      a.stop(t + dur + 0.01); b.stop(t + dur + 0.01);

      pending.push({ g: g, until: t + dur });
      for (var i = pending.length - 1; i >= 0; i--) {
        if (pending[i].until < t - 0.5) pending.splice(i, 1);
      }
    },

    /* the round is over: silence anything already queued ahead */
    stopBeeps: function () {
      if (!ctx) { pending.length = 0; return; }
      var t = now();
      pending.forEach(function (b) {
        try {
          b.g.gain.cancelScheduledValues(t);
          b.g.gain.setValueAtTime(0.0001, t);
        } catch (e) {}
      });
      pending.length = 0;
    },

    /* the opening: one long low tone */
    intro: function () {
      if (!live()) return;
      var t = now();
      tone({ f: 46, dur: 3.4, type: 'sine', gain: 0.16, at: t, attack: 0.6 });
      tone({ f: 69, dur: 3.0, type: 'sine', gain: 0.07, at: t + 0.2, attack: 0.8 });
      hiss({ dur: 2.6, gain: 0.022, filter: 'lowpass', cutoff: 260, at: t,
             attack: 0.9 });
    },

    /* a line of the opening finishing */
    line: function () {
      if (!live()) return;
      hiss({ dur: 0.03, gain: 0.03, filter: 'bandpass', cutoff: 1900, q: 3 });
    },

    /* turning the case over: a swing and a settle */
    flip: function (toBack) {
      if (!live()) return;
      var t = now();
      hiss({ dur: 0.34, gain: 0.06, filter: 'bandpass',
             cutoff: toBack ? 900 : 400, cutoffTo: toBack ? 400 : 900, q: 0.9, at: t });
      tone({ f: toBack ? 200 : 150, to: toBack ? 130 : 190, dur: 0.3,
             type: 'sine', gain: 0.07, at: t });
      hiss({ dur: 0.05, gain: 0.09, filter: 'lowpass', cutoff: 700, at: t + 0.42 });
    },

    /* leaning in on a module, or pulling back out */
    zoom: function (inward) {
      if (!live()) return;
      hiss({ dur: 0.20, gain: 0.05, filter: 'bandpass',
             cutoff: inward ? 500 : 1700, cutoffTo: inward ? 1700 : 500, q: 1.1 });
      tone({ f: inward ? 320 : 520, to: inward ? 520 : 320, dur: 0.16,
             type: 'sine', gain: 0.05 });
    },

    /* the camera closing on the case */
    push: function () {
      if (!live()) return;
      var t = now();
      hiss({ dur: 1.0, gain: 0.05, filter: 'lowpass', cutoff: 300,
             cutoffTo: 1500, at: t, attack: 0.3 });
      tone({ f: 70, to: 150, dur: 1.0, type: 'sine', gain: 0.10, at: t,
             attack: 0.25, glide: 'exp' });
    },

    /* the bomb waking up: rising hum plus a run of relay clicks */
    boot: function (bayDelays, panelDelay) {
      if (!live()) return;
      var t = now();
      tone({ f: 38, to: 92, dur: 0.85, type: 'sawtooth', gain: 0.10, at: t,
             filter: 'lowpass', cutoff: 180, cutoffTo: 620, glide: 'exp' });
      hiss({ dur: 0.5, gain: 0.05, filter: 'lowpass', cutoff: 300,
             cutoffTo: 1600, at: t });
      (bayDelays || []).forEach(function (ms) {
        hiss({ dur: 0.022, gain: 0.05, filter: 'bandpass', cutoff: 2900, q: 2,
               at: t + ms / 1000 + 0.28 });
      });
      /* the control strip coming up last */
      var pd = (panelDelay === undefined ? 950 : panelDelay) / 1000;
      tone({ f: 330, to: 880, dur: 0.28, type: 'triangle', gain: 0.09, at: t + pd });
      tone({ f: 660, to: 1320, dur: 0.34, type: 'sine', gain: 0.06, at: t + pd + 0.06 });
      hiss({ dur: 0.16, gain: 0.05, filter: 'highpass', cutoff: 2600, at: t + pd });
    },

    /* a module accepted its answer */
    solve: function () {
      if (!live()) return;
      var t = now();
      [784, 1047, 1319].forEach(function (f, i) {
        tone({ f: f, dur: 0.30, type: 'triangle', gain: 0.10, at: t + i * 0.07 });
      });
      hiss({ dur: 0.10, gain: 0.04, filter: 'highpass', cutoff: 4000, at: t });
    },

    /* a mistake: buzzer, thud, and the case ringing */
    strike: function () {
      if (!live()) return;
      var t = now();
      tone({ f: 220, to: 74, dur: 0.34, type: 'sawtooth', gain: 0.20, at: t,
             filter: 'lowpass', cutoff: 1400, cutoffTo: 300, glide: 'exp' });
      tone({ f: 58, dur: 0.30, type: 'sine', gain: 0.30, at: t });
      hiss({ dur: 0.22, gain: 0.16, filter: 'bandpass', cutoff: 1400,
             cutoffTo: 300, q: 0.8, at: t });
    },

    /* every module down */
    defused: function () {
      if (!live()) return;
      var t = now();
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ f: f, dur: 0.7 - i * 0.06, type: 'triangle', gain: 0.13,
               at: t + i * 0.10 });
      });
      tone({ f: 131, dur: 1.1, type: 'sine', gain: 0.10, at: t });
      hiss({ dur: 0.5, gain: 0.03, filter: 'highpass', cutoff: 3000, at: t });
    },

    /* it went off */
    exploded: function () {
      if (!live()) return;
      var t = now();
      hiss({ dur: 1.5, gain: 0.42, filter: 'lowpass', cutoff: 5200,
             cutoffTo: 90, q: 0.6, attack: 0.006, at: t });
      tone({ f: 90, to: 26, dur: 1.4, type: 'sine', gain: 0.45, at: t,
             glide: 'exp' });
      tone({ f: 140, to: 40, dur: 0.6, type: 'sawtooth', gain: 0.16, at: t,
             filter: 'lowpass', cutoff: 900, cutoffTo: 120, glide: 'exp' });
      hiss({ dur: 1.9, gain: 0.10, filter: 'lowpass', cutoff: 700,
             cutoffTo: 60, at: t + 0.16 });
    }
  };

  D.audio = A;
})(DEFUSAL);
