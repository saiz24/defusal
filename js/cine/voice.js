/* ==========================================================================
   DEFUSAL — the cutscenes' sound: the narrator's voice and the score.

   The narrator is not given words. It is a voice-shaped sound in step with
   the subtitle: each syllable a buzz pushed through vowel formants, ring-
   modulated so it is never quite a person, with a quieter octave beneath it
   and a long room behind. The subtitle carries the meaning; the voice
   carries the fact that something is speaking.

   The score is a few slow pads, one per mood, crossfaded as scenes change,
   and a handful of one-shot cues — a boom on a cut, the sweep of something
   passing, the hum of the beam, rain, thunder.

   Everything goes through the buses audio.js owns (VOICE, MUSIC, EFFECTS)
   and their shared reverb, so every level in settings applies, and SOUND
   OFF silences all of it. With no audio at all — sound off, no gesture yet,
   or the headless test harness — `speak` still returns how long the line
   would take, so the pictures keep the same timing.
   ========================================================================== */

(function (D) {
  'use strict';

  D.cine = D.cine || {};

  function graph() { return D.audio && D.audio.graph ? D.audio.graph() : null; }

  function syllables(text) {
    var m = String(text).toLowerCase().match(/[aeiouy]+/g);
    return Math.max(1, m ? m.length : 1);
  }

  /* how long a line takes when nothing is actually played: the same average
     the synthesised voice comes out at, so timing never depends on sound */
  function estimate(text) { return syllables(text) * 0.155 + 0.3; }

  var VOWELS = [[800, 1200, 2500], [400, 2200, 2900], [300, 2700, 3300],
                [450, 800, 2600], [325, 700, 2500], [600, 1700, 2600]];

  /* A small seeded generator per line, so the same line always sounds the
     same — a voice that babbles differently on every replay reads as noise. */
  function rngFor(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    var r = (h >>> 0) % 2147483646 + 1;
    return function () { r = (r * 16807) % 2147483647; return r / 2147483647; };
  }

  function speak(text) {
    var G = graph();
    if (!G) return estimate(text);
    var ctx = G.ctx, rnd = rngFor(String(text));
    var t = ctx.currentTime + 0.04, start = t, n = syllables(text), base = 116;
    var out = ctx.createGain(); out.gain.value = 0.5;
    out.connect(G.voice);
    var send = ctx.createGain(); send.gain.value = 0.6;
    out.connect(send); send.connect(G.verb);

    for (var s = 0; s < n; s++) {
      var last = s === n - 1;
      var dur = (0.1 + rnd() * 0.07) * (last ? 1.9 : 1);
      /* the sentence's tune: it lifts through the middle and falls to rest */
      var f0 = base + Math.sin((s / n) * Math.PI) * 18 - (last ? 24 : 0) + (rnd() * 14 - 7);
      var v = VOWELS[(rnd() * VOWELS.length) | 0];

      var a = ctx.createOscillator(); a.type = 'sawtooth';
      a.frequency.setValueAtTime(f0, t);
      a.frequency.linearRampToValueAtTime(f0 * (last ? 0.82 : 1.04), t + dur);
      var b = ctx.createOscillator(); b.type = 'square';
      b.frequency.setValueAtTime(f0 * 0.5, t);
      var bg = ctx.createGain(); bg.gain.value = 0.32;

      var ring = ctx.createGain(); ring.gain.value = 0;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 46 + rnd() * 7;
      lfo.connect(ring.gain);

      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.018);
      env.gain.setValueAtTime(1, t + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      a.connect(ring); b.connect(bg); bg.connect(ring);
      for (var k = 0; k < 3; k++) {
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = v[k]; bp.Q.value = 9 - k * 2;
        var fg = ctx.createGain(); fg.gain.value = [1, 0.55, 0.25][k];
        ring.connect(bp); bp.connect(fg); fg.connect(env);
      }
      env.connect(out);

      if (rnd() < 0.55 && G.noise) {
        var ns = ctx.createBufferSource(); ns.buffer = G.noise;
        var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
        var ng = ctx.createGain();
        ng.gain.setValueAtTime(0.16, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        ns.connect(hp); hp.connect(ng); ng.connect(out);
        ns.start(t, rnd() * 0.5); ns.stop(t + 0.06);
      }
      a.start(t); b.start(t); lfo.start(t);
      a.stop(t + dur + 0.02); b.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
      t += dur + 0.025 + (rnd() < 0.15 ? 0.06 : 0);
    }
    return Math.max(0.4, t - start);
  }

  /* ---- the score ----------------------------------------------------- */

  /* Each mood is a chord voiced low and wide, through a slowly moving
     filter. None of them resolve, on purpose: the story is a test whose
     answer is never announced. */
  var MOODS = {
    space:   { notes: [55, 82.4, 110, 164.8, 246.9], cutoff: 700,  lfo: 0.06, gain: 0.15 },
    city:    { notes: [73.4, 110, 146.8, 185, 277.2], cutoff: 1100, lfo: 0.08, gain: 0.13 },
    tension: { notes: [49, 51.9, 98, 146.8, 155.6],  cutoff: 520,  lfo: 0.18, gain: 0.16, pulse: 1.05 },
    resolve: { notes: [65.4, 98, 130.8, 164.8, 196, 329.6], cutoff: 1500, lfo: 0.05, gain: 0.14 }
  };
  var pad = null, padName = null;

  function stopPad(fade) {
    var G = graph();
    if (!pad) return;
    var p = pad; pad = null; padName = null;
    if (!G) return;
    var t = G.ctx.currentTime, f = fade === undefined ? 2.4 : fade;
    try {
      p.g.gain.cancelScheduledValues(t);
      p.g.gain.setValueAtTime(p.g.gain.value, t);
      p.g.gain.linearRampToValueAtTime(0.0001, t + f);
    } catch (e) {}
    p.nodes.forEach(function (o) { try { o.stop(t + f + 0.1); } catch (e) {} });
    if (p.timer) clearInterval(p.timer);
  }

  function score(name) {
    if (name === padName) return;
    stopPad();
    var G = graph(), m = MOODS[name];
    if (!G || !m) return;
    var ctx = G.ctx, t = ctx.currentTime;
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(m.gain, t + 3);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = m.cutoff; lp.Q.value = 0.7;
    var lfo = ctx.createOscillator(); lfo.frequency.value = m.lfo;
    var lg = ctx.createGain(); lg.gain.value = m.cutoff * 0.45;
    lfo.connect(lg); lg.connect(lp.frequency);
    var nodes = [lfo];
    m.notes.forEach(function (f, i) {
      [0, 1].forEach(function (d) {
        var o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = f * (d ? 1.004 : 0.996);
        var og = ctx.createGain(); og.gain.value = (i < 2 ? 0.4 : 0.22) / 2;
        o.connect(og); og.connect(lp); o.start(t); nodes.push(o);
      });
    });
    lfo.start(t);
    lp.connect(g); g.connect(G.music);
    var send = ctx.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(G.verb);
    pad = { g: g, nodes: nodes, timer: 0 };
    padName = name;
    /* tension carries a slow heartbeat under it */
    if (m.pulse) {
      var beat = function () {
        var G2 = graph(); if (!G2 || padName !== name) return;
        thump(G2, G2.ctx.currentTime + 0.02, 0.22);
        thump(G2, G2.ctx.currentTime + 0.3, 0.14);
      };
      pad.timer = setInterval(beat, m.pulse * 1000);
    }
  }

  function thump(G, at, peak) {
    var o = G.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.25);
    var g = G.ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    o.connect(g); g.connect(G.music); o.start(at); o.stop(at + 0.45);
  }

  /* ---- one-shot cues ------------------------------------------------- */

  function noiseThrough(G, type, f0, f1, dur, peak, q, bus) {
    var ctx = G.ctx, t = ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = G.noise; s.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = type; bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t);
    if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(bus || G.sfx); g.connect(G.verb);
    s.start(t); s.stop(t + dur);
  }

  var hum = null, rain = null;

  var CUES = {
    boom: function (G) {
      var ctx = G.ctx, t = ctx.currentTime;
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.8);
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g); g.connect(G.sfx); g.connect(G.verb); o.start(t); o.stop(t + 2.5);
    },
    whoosh: function (G) { noiseThrough(G, 'bandpass', 180, 1500, 3.2, 0.08, 1.4); },
    sting: function (G) {
      /* a glassy swell that lands on a chord: something has been noticed */
      var ctx = G.ctx, t = ctx.currentTime;
      [659.3, 830.6, 987.8, 1318.5].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03, t + 1.1 + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
        o.connect(g); g.connect(G.music); g.connect(G.verb); o.start(t); o.stop(t + 4.1);
      });
      noiseThrough(G, 'highpass', 5000, 9000, 1.3, 0.025, 0.7);
    },
    thunder: function (G) {
      noiseThrough(G, 'lowpass', 900, 70, 3.6, 0.28, 0.8);
      CUES.boom(G);
    },
    'hum-on': function (G) {
      if (hum) return;
      var ctx = G.ctx, t = ctx.currentTime;
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 98;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 196.6;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 1.4);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(G.sfx); g.connect(G.verb);
      o.start(t); o2.start(t);
      hum = { g: g, o: [o, o2] };
    },
    'hum-off': function (G) {
      if (!hum) return;
      var h = hum, t = G.ctx.currentTime;
      hum = null;
      h.g.gain.setValueAtTime(h.g.gain.value, t);
      h.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      h.o.forEach(function (x) { try { x.stop(t + 1.3); } catch (e) {} });
    },
    'rain-on': function (G) {
      if (rain) return;
      var ctx = G.ctx, t = ctx.currentTime;
      var s = ctx.createBufferSource(); s.buffer = G.noise; s.loop = true;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2);
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(G.sfx);
      s.start(t);
      rain = { g: g, s: s };
    },
    'rain-off': function (G) {
      if (!rain) return;
      var r = rain; rain = null; var t = G.ctx.currentTime;
      r.g.gain.setValueAtTime(r.g.gain.value, t);
      r.g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
      try { r.s.stop(t + 2.1); } catch (e) {}
    }
  };

  function cue(name) {
    var G = graph();
    if (!G || !CUES[name]) return;
    try { CUES[name](G); } catch (e) {}
  }

  /* everything the cutscenes started, stopped: a skip must leave silence */
  function hush() {
    stopPad(1.2);
    var G = graph();
    if (G) { CUES['hum-off'](G); CUES['rain-off'](G); }
    else { hum = null; rain = null; }
  }

  D.cine.voice = { speak: speak, estimate: estimate, score: score, cue: cue, hush: hush };
})(DEFUSAL);
