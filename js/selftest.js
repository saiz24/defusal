/* ==========================================================================
   DEFUSAL — self-test.
   Generates many rounds per module and asserts that a solution exists, is
   unique and satisfies that module's constraints. Runs in the browser console
   at startup when debug mode is on, and headless under Node from
   tools/run-selftest.js.
   ========================================================================== */

(function (D) {
  'use strict';

  function hash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* per-module aggregate checks run once over all generated rounds */
  var AGGREGATE = {
    venn: function (rounds, fail) {
      var empty = 0;
      rounds.forEach(function (r) { if (r.s.empty) empty++; });
      var frac = empty / rounds.length;
      if (frac > 0.25) fail('empty target set in ' + (frac * 100).toFixed(1) +
        '% of rounds — more than occasional');
      return { emptyTargetRate: +(frac * 100).toFixed(1) + '%' };
    },
    sequences: function (rounds) {
      var kinds = {};
      rounds.forEach(function (r) { kinds[r.p.kind] = (kinds[r.p.kind] || 0) + 1; });
      return kinds;
    },
    rationality: function (rounds, fail) {
      var cats = {};
      rounds.forEach(function (r) { cats[r.p.category] = (cats[r.p.category] || 0) + 1; });
      ['nonreal', 'irrational', 'rational', 'negint', 'zero', 'natural']
        .forEach(function (c) { if (!cats[c]) fail('category never generated: ' + c); });
      return cats;
    },
    triangles: function (rounds, fail) {
      var seen = {};
      rounds.forEach(function (r) {
        seen[r.s.sideClass + '/' + r.s.angleClass] = true;
      });
      ['equilateral/acute', 'isosceles/acute', 'isosceles/right',
       'isosceles/obtuse', 'scalene/acute', 'scalene/right', 'scalene/obtuse']
        .forEach(function (k) { if (!seen[k]) fail('classification never generated: ' + k); });
      return Object.keys(seen).sort();
    },
    angles: function (rounds, fail) {
      var types = {}, colors = {}, configs = {};
      rounds.forEach(function (r) {
        types[r.s.t1] = true; types[r.s.t2] = true;
        colors[r.s.color] = (colors[r.s.color] || 0) + 1;
        configs[r.p.config] = (configs[r.p.config] || 0) + 1;
      });
      ['zero', 'acute', 'right', 'obtuse', 'straight', 'reflex', 'complete']
        .forEach(function (t) { if (!types[t]) fail('angle type never generated: ' + t); });
      ['vertical', 'complementary', 'linear', 'unrelated']
        .forEach(function (c) { if (!configs[c]) fail('configuration never generated: ' + c); });
      return { colors: colors, configs: configs };
    },
    units: function (rounds, fail) {
      var layouts = {}, lights = {}, cats = {};
      rounds.forEach(function (r) {
        layouts[r.p.layout] = (layouts[r.p.layout] || 0) + 1;
        lights[r.p.lights] = (lights[r.p.lights] || 0) + 1;
        cats[r.p.category] = (cats[r.p.category] || 0) + 1;
      });
      ['A', 'B', 'C', 'D'].forEach(function (L) {
        if (!layouts[L]) fail('layout never generated: ' + L);
      });
      if (lights['13']) fail('forbidden 1st+3rd light pattern was generated');
      rounds.forEach(function (r) {
        if (!Number.isInteger(r.p.answer)) fail('non-integer answer');
      });
      return { layouts: layouts, lights: lights, categories: cats };
    },
    parallel: function (rounds, fail) {
      var starts = {};
      rounds.forEach(function (r) { starts[r.s.s] = (starts[r.s.s] || 0) + 1; });
      [1, 2, 4, 6, 7].forEach(function (k) {
        if (!starts[k]) fail('starting angle never generated: ' + k);
      });
      return starts;
    },
    mutex: function (rounds) {
      var vals = {};
      rounds.forEach(function (r) { vals[r.s.value] = (vals[r.s.value] || 0) + 1; });
      return { distinctValues: Object.keys(vals).length };
    }
  };

  D.selfTest = function (roundsPerModule, seed, log) {
    roundsPerModule = roundsPerModule || 400;
    seed = (seed === undefined) ? 20260831 : seed;
    log = log || function () {};

    var report = { ok: true, total: 0, failures: [], modules: {} };

    D.modules.forEach(function (def) {
      var rng = D.makeRng((seed ^ hash(def.id)) >>> 0);
      var rounds = [], failures = [], i;

      function fail(msg) {
        failures.push(msg);
        report.failures.push(def.id + ': ' + msg);
        report.ok = false;
      }

      for (i = 0; i < roundsPerModule; i++) {
        var serial = D.makeSerial(rng);
        var ctx = { serial: serial, serialInfo: D.serialInfo(serial) };
        var p, s;
        try {
          p = def.generate(rng, ctx);
          s = def.solve(p, ctx);
        } catch (e) {
          fail('threw while generating: ' + (e && e.message));
          continue;
        }
        if (!p || !s) { fail('generate/solve returned nothing'); continue; }
        try {
          def.validate(p, s, ctx, fail);
        } catch (e2) {
          fail('threw while validating: ' + (e2 && e2.message));
        }
        rounds.push({ p: p, s: s, ctx: ctx });
        report.total++;
      }

      var notes = null;
      if (AGGREGATE[def.id]) {
        try { notes = AGGREGATE[def.id](rounds, fail); }
        catch (e3) { fail('aggregate check threw: ' + (e3 && e3.message)); }
      }

      report.modules[def.id] = {
        rounds: rounds.length,
        failures: failures.length,
        sampleFailures: failures.slice(0, 5),
        notes: notes
      };
      log((failures.length ? 'FAIL ' : 'ok   ') + def.id.padEnd(12) +
          rounds.length + ' rounds' +
          (failures.length ? '  ' + failures.length + ' failures' : ''));
    });

    /* serial number invariants */
    var srng = D.makeRng((seed ^ 0x5EA1) >>> 0);
    for (var k = 0; k < 2000; k++) {
      var sn = D.makeSerial(srng);
      if (sn.length !== 6 || !/[A-Z]/.test(sn) || !/[0-9]/.test(sn) ||
          !/^[A-Z0-9]{6}$/.test(sn)) {
        report.ok = false;
        report.failures.push('serial: bad serial generated: ' + sn);
        break;
      }
    }

    return report;
  };
})(DEFUSAL);
