/* ==========================================================================
   MODULE: UNIT CONVERSIONS  (rating: Hard)

   Manual rule implemented here
   ----------------------------
   A top panel and a bottom panel, three indicator squares to their left, an
   answer box and a submit button. One panel shows an everyday object; the
   other shows it on a measuring instrument. Sometimes both share one panel
   and the other panel is dark.

   Instruments: ruler (length), dial weighing scale (mass), graduated cylinder
   (volume). Their scales carry NUMBERS ONLY - never unit labels.

   Layouts        Top                Bottom     Direction
     A            Object             Instrument Metric   -> American
     B            Instrument         Object     American -> Metric
     C            Object+instrument  Dark       American -> American
     D            Dark               Object+instrument   Metric -> Metric

   Lights (only these six patterns are ever generated)
     Lit        Layouts A & B        Layouts C & D
     1st        middle -> middle     middle -> large
     2nd        middle -> large      large  -> middle
     3rd        middle -> small      middle -> small
     1st+2nd    small  -> middle     small  -> middle
     2nd+3rd    small  -> large      large  -> small
     all three  small  -> small      small  -> large
   Layout A reads the pair as written (metric source). Layout B reads it
   BACKWARDS (American source). C and D read as written.

   Unit values in the category's base unit (centimetre / gram / millilitre):
                    small           middle          large
     Length metric  centimetre 1    metre 100       kilometre 100000
     Mass   metric  milligram 0.001 gram 1          kilogram 1000
     Volume metric  millilitre 1    litre 1000      kilolitre 1000000
     Length US      inch 2.54       foot 30.48      yard 91.44
     Mass   US      ounce 28.35     pound 453.6     ton 907200
     Volume US      cup 236.6       quart 946.4     gallon 3785.6

     answer = reading x sourceValue / targetValue

   Rounds are generated BACKWARDS: layout, lights, category, instrument scale
   and a whole-number answer are chosen first and the reading is derived, so
   the reading always lands exactly on a gradation.
   ========================================================================== */

(function (D) {
  'use strict';

  var CATS = {
    length: {
      instrument: 'ruler',
      metric: { small: 1, middle: 100, large: 100000 },
      us:     { small: 2.54, middle: 30.48, large: 91.44 }
    },
    mass: {
      instrument: 'dial',
      metric: { small: 0.001, middle: 1, large: 1000 },
      us:     { small: 28.35, middle: 453.6, large: 907200 }
    },
    volume: {
      instrument: 'cylinder',
      metric: { small: 1, middle: 1000, large: 1000000 },
      us:     { small: 236.6, middle: 946.4, large: 3785.6 }
    }
  };

  var LIGHT_KEYS = ['1', '2', '3', '12', '23', '123'];
  var LIT = { '1': [1, 0, 0], '2': [0, 1, 0], '3': [0, 0, 1],
              '12': [1, 1, 0], '23': [0, 1, 1], '123': [1, 1, 1] };

  var TABLE_AB = {
    '1':   ['middle', 'middle'], '2':  ['middle', 'large'],
    '3':   ['middle', 'small'],  '12': ['small', 'middle'],
    '23':  ['small', 'large'],   '123': ['small', 'small']
  };
  var TABLE_CD = {
    '1':   ['middle', 'large'],  '2':  ['large', 'middle'],
    '3':   ['middle', 'small'],  '12': ['small', 'middle'],
    '23':  ['large', 'small'],   '123': ['small', 'large']
  };

  function pairFor(layout, key) {
    var p;
    if (layout === 'A') {
      p = TABLE_AB[key];
      return { srcSystem: 'metric', srcSize: p[0], tgtSystem: 'us', tgtSize: p[1] };
    }
    if (layout === 'B') {
      p = TABLE_AB[key];               /* read backwards: American source */
      return { srcSystem: 'us', srcSize: p[1], tgtSystem: 'metric', tgtSize: p[0] };
    }
    p = TABLE_CD[key];
    var sys = (layout === 'C') ? 'us' : 'metric';
    return { srcSystem: sys, srcSize: p[0], tgtSystem: sys, tgtSize: p[1] };
  }

  /* ---- instrument scales ------------------------------------------------- */

  var STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200,
               250, 500, 1000];
  var TICK_COUNTS = [20, 24, 25, 30, 32, 36, 40, 48, 50, 60, 64, 72, 80, 100,
                     120, 125, 150, 200, 250];
  /* The ruler is drawn as a close-up window around the reading, so it can carry
     a fine scale; the dial and the cylinder are drawn whole and so must stay
     coarse enough to count at bay size. */
  var TICK_LIMIT = { ruler: 250, dial: 60, cylinder: 28 };
  var SCALE_LIMIT = { ruler: 500, dial: 10000, cylinder: 5000 };

  function buildGrids(instrument) {
    var out = [], seen = {};
    STEPS.forEach(function (step) {
      TICK_COUNTS.forEach(function (n) {
        if (n > TICK_LIMIT[instrument]) return;
        var max = Math.round(step * n * 1e6) / 1e6;
        if (max > SCALE_LIMIT[instrument]) return;
        var key = max + '/' + step;
        if (seen[key]) return;
        seen[key] = true;
        out.push({ max: max, step: step, ticks: n, labelStep: labelStepFor(max, step) });
      });
    });
    return out;
  }

  function labelStepFor(max, step) {
    var mult = [5, 10, 20, 25, 50, 100], i;
    for (i = 0; i < mult.length; i++) {
      if (max / (step * mult[i]) <= 15) return Math.round(step * mult[i] * 1e6) / 1e6;
    }
    return Math.round(step * 100 * 1e6) / 1e6;
  }

  var GRIDS = null;
  function grids(instrument) {
    if (!GRIDS) {
      GRIDS = { ruler: buildGrids('ruler'), dial: buildGrids('dial'),
                cylinder: buildGrids('cylinder') };
    }
    return GRIDS[instrument];
  }

  /* ---- feasible-round table (built once, exact integer arithmetic) ------- */

  var MAX_ANSWER = 99999;
  var TABLE = null;

  function buildTable() {
    var byLayout = {};
    ['A', 'B', 'C', 'D'].forEach(function (layout) {
      var byLights = {};
      LIGHT_KEYS.forEach(function (key) {
        var options = [];
        Object.keys(CATS).forEach(function (cat) {
          var C = CATS[cat], pf = pairFor(layout, key);
          /* work in thousandths of the base unit so everything is integral */
          var SV = Math.round(C[pf.srcSystem][pf.srcSize] * 1000);
          var TV = Math.round(C[pf.tgtSystem][pf.tgtSize] * 1000);
          var g0 = D.gcd(SV, TV), p = SV / g0, q = TV / g0;
          grids(C.instrument).forEach(function (grid) {
            var stepInt = Math.round(grid.step * 1000);
            var g1 = D.gcd(stepInt, 1000), s1 = stepInt / g1, s2 = 1000 / g1;
            var den = s2 * q, t;
            /* keep the reading far enough up the scale to be legible */
            var minTick = Math.max(1, Math.ceil(grid.ticks * 0.05));
            for (t = minTick; t <= grid.ticks; t++) {
              var num = t * s1 * p;
              if (num % den !== 0) continue;
              var answer = num / den;
              if (answer < 1 || answer > MAX_ANSWER) continue;
              options.push({
                category: cat, grid: grid, tick: t,
                reading: Math.round(t * grid.step * 1e6) / 1e6,
                answer: answer,
                srcSystem: pf.srcSystem, srcSize: pf.srcSize,
                tgtSystem: pf.tgtSystem, tgtSize: pf.tgtSize
              });
            }
          });
        });
        if (options.length) byLights[key] = options;
      });
      byLayout[layout] = byLights;
    });
    return byLayout;
  }

  function table() { if (!TABLE) TABLE = buildTable(); return TABLE; }

  /* ---- generation -------------------------------------------------------- */

  /* cosmetic only — the object never affects the reading or the answer */
  var OBJECTS = {
    length: ['pencil', 'key', 'screw', 'marker', 'brush'],
    mass: ['apple', 'sack', 'can', 'book'],
    volume: ['bottle', 'mug', 'carton', 'jug']
  };

  function generate(rng, ctx) {
    var T = table();

    /* weight layouts so the sparse ones still turn up without dominating */
    var layouts = ['A', 'B', 'C', 'D'].filter(function (L) {
      return Object.keys(T[L]).length > 0;
    });
    var weights = layouts.map(function (L) {
      var n = 0;
      Object.keys(T[L]).forEach(function (k) { n += T[L][k].length; });
      return Math.min(n, 80);
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = rng() * total, layout = layouts[0], i;
    for (i = 0; i < layouts.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { layout = layouts[i]; break; }
    }

    var keys = Object.keys(T[layout]);
    var lights = D.pick(rng, keys);
    var opt = D.pick(rng, T[layout][lights]);

    return {
      layout: layout,
      lights: lights,
      lit: LIT[lights],
      category: opt.category,
      instrument: CATS[opt.category].instrument,
      grid: opt.grid,
      reading: opt.reading,
      answer: opt.answer,
      srcSystem: opt.srcSystem, srcSize: opt.srcSize,
      tgtSystem: opt.tgtSystem, tgtSize: opt.tgtSize,
      object: D.pick(rng, OBJECTS[opt.category])
    };
  }

  function solve(p) { return { answer: p.answer }; }

  function debugText(p) {
    return p.answer + '   [' + p.layout + ' ' + p.lights + ' ' + p.category +
      ' read ' + D.fmt(p.reading) + ']';
  }

  function validate(p, s, ctx, fail) {
    if (!Number.isInteger(p.answer)) fail('answer is not a whole number');
    if (p.answer < 1 || p.answer > MAX_ANSWER) fail('answer out of range');
    if (LIGHT_KEYS.indexOf(p.lights) < 0) fail('illegal light pattern');
    if (p.lights === '13') fail('forbidden 1st+3rd light pattern');
    if (p.lit[0] + p.lit[1] + p.lit[2] === 0) fail('all lights dark');
    if (p.lit[0] === 1 && p.lit[1] === 0 && p.lit[2] === 1) {
      fail('forbidden 1st+3rd light pattern');
    }
    /* reading must sit exactly on a gradation of the drawn scale */
    var ticks = p.reading / p.grid.step;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-9) fail('reading is off-gradation');
    if (Math.round(ticks) < 1) fail('reading below the first gradation');
    if (p.reading > p.grid.max + 1e-9) fail('reading past the end of the scale');
    /* answer must equal reading * source / target */
    var C = CATS[p.category];
    var sv = C[p.srcSystem][p.srcSize], tv = C[p.tgtSystem][p.tgtSize];
    var want = p.reading * sv / tv;
    if (Math.abs(want - p.answer) > 1e-6 * Math.max(1, p.answer)) {
      fail('answer does not match reading x source / target');
    }
    /* the source/target pair must be the one the layout + lights dictate */
    var pf = pairFor(p.layout, p.lights);
    if (pf.srcSystem !== p.srcSystem || pf.srcSize !== p.srcSize ||
        pf.tgtSystem !== p.tgtSystem || pf.tgtSize !== p.tgtSize) {
      fail('unit pair does not match the layout/lights table');
    }
    if (C.instrument !== p.instrument) fail('wrong instrument for category');
  }

  D.register({
    id: 'units',
    name: 'UNIT CONVERSIONS',
    rating: 'hard',
    wide: true,
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: function (host, inst) { D.unitsRender(host, inst); },
    _internals: { table: table, CATS: CATS, pairFor: pairFor, LIGHT_KEYS: LIGHT_KEYS }
  });
})(DEFUSAL);
