/* ==========================================================================
   Headless play-through harness.
   Mounts every module for real and drives both the winning interaction and a
   losing one, then boots the whole bomb and plays a full game to a defusal,
   a three-strike loss and a time-out.
       node tools/run-play.js [roundsPerModule]
   ========================================================================== */

var fs = require('fs'), path = require('path'), vm = require('vm');
var shim = require('./dom-shim.js');
var root = path.join(__dirname, '..');

var FILES = [
  'js/core.js', 'js/audio.js', 'js/svg.js',
  'js/modules/cards.js', 'js/modules/sequences.js', 'js/modules/mutex.js',
  'js/modules/rationality.js', 'js/modules/parallel.js', 'js/modules/venn.js',
  'js/modules/triangles.js', 'js/modules/angles.js', 'js/modules/units.js',
  'js/modules/units-render.js', 'js/cutscene.js', 'js/selftest.js', 'js/game.js'
];

function boot(opts) {
  opts = opts || {};
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var doc = shim.makeDocument(html);
  var clock = { t: 1700000000000 };
  var intervals = [], timeouts = [];

  var sandbox = {
    console: console, Math: Math, Number: Number, String: String,
    Object: Object, Array: Array, JSON: JSON, RegExp: RegExp,
    Boolean: Boolean, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    Error: Error,
    Date: { now: function () { return clock.t; } },
    document: doc,
    location: { search: opts.search || '' },
    window: {
      innerWidth: 1440, innerHeight: 900, addEventListener: function () {},
      localStorage: (function () {
        var m = {};
        return {
          getItem: function (k) { return m.hasOwnProperty(k) ? m[k] : null; },
          setItem: function (k, v) { m[k] = String(v); },
          removeItem: function (k) { delete m[k]; },
          _all: m
        };
      })()
    },
    setInterval: function (fn, ms) { intervals.push({ fn: fn, ms: ms, dead: false }); return intervals.length - 1; },
    clearInterval: function (id) { if (intervals[id]) intervals[id].dead = true; },
    setTimeout: function (fn, ms) { timeouts.push({ fn: fn, ms: ms }); return timeouts.length - 1; },
    clearTimeout: function () {}
  };
  var ctx = vm.createContext(sandbox);
  FILES.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  });
  var D = vm.runInContext('DEFUSAL', ctx);
  return {
    D: D, doc: doc, clock: clock, intervals: intervals, timeouts: timeouts,
    store: sandbox.window.localStorage,
    tick: function () {
      intervals.forEach(function (i) { if (!i.dead) i.fn(); });
    }
  };
}

var failures = [];
function check(cond, msg) { if (!cond) failures.push(msg); }

/* ---------------- element finders --------------------------------------- */

function groupsWithAttr(host, tag, attr, value) {
  return host.querySelectorAll('g').filter(function (g) {
    return g.querySelectorAll(tag).some(function (n) {
      return n.getAttribute(attr) === value;
    });
  });
}

function textOf(el) { return el.textContent.trim(); }

/* ---------------- per-module drivers ------------------------------------ */


function typeAnswer(host, values) {
  var inputs = host.querySelectorAll('input');
  values.forEach(function (v, i) { inputs[i].value = String(v); });
  host.querySelector('button').dispatch('click');
}

var DRIVERS = {
  sequences: {
    win: function (h, p, s) { typeAnswer(h, [s.missing, s.boxTwo]); },
    lose: function (h, p, s) { typeAnswer(h, [s.missing + 1, s.boxTwo]); }
  },
  mutex: {
    win: function (h, p, s) { typeAnswer(h, [s.value]); },
    lose: function (h, p, s) { typeAnswer(h, [(s.value + 1) % 16]); }
  },
  units: {
    win: function (h, p, s) { typeAnswer(h, [s.answer]); },
    lose: function (h, p, s) { typeAnswer(h, [s.answer + 1]); }
  },
  rationality: {
    win: function (h, p, s) {
      s.sequence.forEach(function (c) { colorBtn(h, c, p).dispatch('click'); });
    },
    lose: function (h, p, s) {
      var wrong = p.arrangement.filter(function (c) { return c !== s.sequence[0]; })[0];
      colorBtn(h, wrong, p).dispatch('click');
    }
  },
  triangles: {
    win: function (h, p, s) {
      s.presses.forEach(function (t) { triBtn(h, t, p).dispatch('click'); });
    },
    lose: function (h, p, s) {
      var wrong = p.order.filter(function (c) { return c !== s.presses[0]; })[0];
      triBtn(h, wrong, p).dispatch('click');
    }
  },
  venn: {
    win: function (h, p, s) {
      if (s.empty) { h.querySelector('.null-btn').dispatch('click'); return; }
      s.target.forEach(function (n) { vennBtn(h, n).dispatch('click'); });
    },
    lose: function (h, p, s) {
      if (s.empty) {
        var any = h.querySelectorAll('.venn-num')[0];
        if (any) any.dispatch('click'); else h.querySelector('.null-btn').dispatch('click');
      } else {
        h.querySelector('.null-btn').dispatch('click');
      }
    }
  },
  parallel: {
    win: function (h, p, s) {
      s.order.forEach(function (n) { angleBtn(h, n).dispatch('click'); });
    },
    lose: function (h, p, s) {
      var wrong = [1, 2, 3, 4, 5, 6, 7, 8].filter(function (n) { return n !== s.order[0]; })[0];
      angleBtn(h, wrong).dispatch('click');
    }
  },
  angles: {
    win: function (h, p, s, harness, inst) { pressAngles(h, p, s, harness, true, inst); },
    lose: function (h, p, s, harness, inst) { pressAngles(h, p, s, harness, false, inst); }
  }
};

/* Buttons are located through the puzzle's own arrangement rather than by
   colour, so a repaint cannot silently break the harness. */
function colorBtn(host, color, p) {
  return host.querySelectorAll('g.hit')[p.arrangement.indexOf(color)];
}
/* three colour keys in the round's left-to-right order, then the D-pad in the
   order the module builds it */
var DPAD_ORDER = ['up', 'down', 'left', 'right'];
function triBtn(host, token, p) {
  var keys = host.querySelectorAll('g.hit');
  var i = p.order.indexOf(token);
  if (i >= 0) return keys[i];
  return keys[3 + DPAD_ORDER.indexOf(token)];
}
function vennBtn(host, value) {
  return host.querySelectorAll('.venn-num').filter(function (g) {
    return textOf(g) === String(value);
  })[0];
}
function angleBtn(host, n) {
  return host.querySelectorAll('.angle-btn').filter(function (g) {
    return textOf(g).indexOf(String(n)) === 0;
  })[0];
}
/* mirror the module's own cycle position rather than reading pixels, so a
   repaint cannot break the harness */
function pressAngles(host, p, s, harness, wantWin, inst) {
  var btn = host.querySelector('.press-btn');
  var idx = p.phase, i;
  for (i = 0; i < 12; i++) {
    if ((p.cycle[idx] === s.color) === wantWin) { btn.dispatch('click'); return; }
    harness.tick();
    idx = (idx + 1) % p.cycle.length;
  }
  /* a solved module freezes its cycle on purpose; pressing is then a no-op */
  if (inst && inst.solved) { btn.dispatch('click'); return; }
  failures.push('angles: colour cycle never reached the ' +
    (wantWin ? 'target' : 'off-target') + ' state');
}

/* ---------------- part 1: every module, driven for real ------------------ */

var ROUNDS = Number(process.argv[2] || 60);
var h = boot();
var D = h.D;

/* ---------------- part 0: no dangling calls into the sound kit ------------ */
(function () {
  var src = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8') +
            fs.readFileSync(path.join(root, 'js/cutscene.js'), 'utf8');
  var wanted = {}, m, re = /D\.audio\.([A-Za-z]+)/g;
  while ((m = re.exec(src)) !== null) wanted[m[1]] = true;
  var kit = h.D.audio;
  Object.keys(wanted).forEach(function (k) {
    if (typeof kit[k] !== 'function') {
      failures.push('audio: D.audio.' + k + ' is called but does not exist');
    }
  });
  console.log('  audio kit   ' + Object.keys(wanted).length + ' calls resolve');
})();


D.modules.forEach(function (def) {
  var rng = D.makeRng(90210 + def.id.length * 7);
  var driver = DRIVERS[def.id];
  if (!driver) { failures.push('no driver for ' + def.id); return; }
  var wins = 0, strikes = 0;

  for (var i = 0; i < ROUNDS; i++) {
    ['win', 'lose'].forEach(function (mode) {
      var serial = D.makeSerial(rng);
      var ctx = { serial: serial, serialInfo: D.serialInfo(serial) };
      var puzzle = def.generate(rng, ctx);
      var solution = def.solve(puzzle, ctx);
      var host = h.doc.createElement('div');
      var inst = {
        puzzle: puzzle, solution: solution, ctx: ctx, solved: false, strikes: 0,
        onSolved: null, cleanup: null,
        isSolved: function () { return inst.solved; },
        solve: function () {
          if (inst.solved) return;
          inst.solved = true;
          if (inst.onSolved) inst.onSolved();
          if (inst.cleanup) { inst.cleanup(); inst.cleanup = null; }
        },
        strike: function () { inst.strikes++; },
        progress: function () {}
      };
      def.mount(host, inst);
      driver[mode](host, puzzle, solution, h, inst);
      if (inst.cleanup) inst.cleanup();

      if (mode === 'win') {
        if (!inst.solved) failures.push(def.id + ': correct input did not solve — ' +
          def.debugText(puzzle, solution, ctx));
        else wins++;
        if (inst.strikes) failures.push(def.id + ': correct input caused ' +
          inst.strikes + ' strike(s)');
      } else {
        if (inst.solved) failures.push(def.id + ': wrong input solved the module');
        else if (inst.strikes !== 1) failures.push(def.id +
          ': wrong input gave ' + inst.strikes + ' strikes, expected 1');
        else strikes++;
      }
    });
  }
  console.log('  ' + def.id.padEnd(12) + ' ' + wins + '/' + ROUNDS + ' solved, ' +
    strikes + '/' + ROUNDS + ' struck');
});

/* ---------------- the beep must keep an even pulse ----------------------- */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  startGame(g, 'insane');                    /* 600s on the clock */

  /* a stand-in audio clock, advancing exactly with the harness clock */
  var audioT = 100, beeps = [];
  g.D.audio.now = function () { return audioT; };
  g.D.audio.beep = function (u, at) { beeps.push(at === undefined ? audioT : at); };

  /* let the arming sequence finish */
  for (var i = 0; i < 60; i++) { g.clock.t += 100; audioT += 0.1; g.tick(); }
  beeps.length = 0;
  var base = audioT;

  /* deliberately uneven JS ticks — this is what a busy frame looks like */
  var jitter = [100, 180, 60, 140, 90, 200, 70, 110];
  for (i = 0; i < 120; i++) {
    var ms = jitter[i % jitter.length];
    g.clock.t += ms; audioT += ms / 1000;
    g.tick();
  }

  check(beeps.length > 8, 'no beeps were scheduled (' + beeps.length + ')');

  var gaps = [], worst = 0;
  for (i = 1; i < beeps.length; i++) {
    var gap = beeps[i] - beeps[i - 1];
    gaps.push(gap);
    worst = Math.max(worst, Math.abs(gap - 1.0));   /* 600s left => 1.0s apart */
  }
  check(worst < 0.001,
    'beep spacing drifts by ' + worst.toFixed(3) + 's under timer jitter');
  check(beeps[0] >= base - 0.001, 'a beep was scheduled in the past');
  console.log('  beep pulse  ' + gaps.length + ' gaps, worst error ' +
    (worst * 1000).toFixed(2) + 'ms under uneven ticks');
})();

/* ---------------- reset must clear the record too ------------------------ */
(function () {
  var g = boot({ search: '' });
  g.D.selfTest = null;
  g.D.boot();

  g.store.setItem('defusal.stage', '3');
  g.store.setItem('defusal.stats',
    JSON.stringify({ '1': { a: 7, best: 210 }, '3': { a: 2, best: 44 } }));

  var btn = g.doc.getElementById('reset-progress');
  check(!!btn, 'no reset-progress button');
  btn.dispatch('click', { type: 'click', target: btn,
    preventDefault: function () {} });

  check(g.store.getItem('defusal.stage') === '0', 'stage progress not cleared');
  var stats = JSON.parse(g.store.getItem('defusal.stats') || '{}');
  check(Object.keys(stats).length === 0,
    'the per-device record survived reset: ' + JSON.stringify(stats));
  console.log('  reset       clears both progress and the per-device record');
})();

/* ---------------- press feedback must not reach a container -------------- */
(function () {
  var css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  /* the containers: the explicit shell classes, plus whatever sits on a
     <section>. .stage got here by being on <section id="screen-game">. */
  var containers = {};
  ['bomb', 'casing', 'bays', 'bay', 'face', 'flipper', 'panel', 'deck',
   'screen', 'stage', 'cs-stage', 'select', 'viewport', 'track']
    .forEach(function (c) { containers[c] = 1; });
  (html.match(/<section[^>]*class="[^"]*"/g) || []).forEach(function (m) {
    m.slice(m.indexOf('class="') + 7, -1).split(/\s+/)
      .forEach(function (c) { if (c) containers[c] = 1; });
  });

  /* :active matches every ancestor too, so a rule that can reach a container
     makes the whole case flash on any click. This is how .stage did it. */
  var bad = [];
  (css.match(/[^{}]+\{/g) || []).forEach(function (block) {
    var sel = block.slice(0, -1);
    if (sel.indexOf(':active') < 0) return;
    sel.split(',').forEach(function (one) {
      one = one.trim();
      if (one.indexOf(':active') < 0) return;
      var cls = one.replace(/:active|:hover|:not\([^)]*\)|::?[a-z-]+/g, '')
                   .trim().split(/[\s>+~]/).pop();
      if (cls.charAt(0) !== '.') return;
      var name = cls.slice(1).split('.')[0];
      if (containers[name]) bad.push(one + '  reaches container .' + name);
    });
  });
  check(bad.length === 0, 'press feedback reaches a container:\n    ' +
    bad.join('\n    '));
  if (bad.length) return;

  /* and the case must not be sweepable as text */
  check(/\.bomb\s*\{[^}]*user-select:\s*none/.test(css),
    'the case is still text-selectable');
  console.log('  press scope  no :active rule reaches a container');
})();

/* ---------------- bare panel must not answer a click --------------------- */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  var presses = 0;
  var realPress = g.D.audio.press;
  g.D.audio.press = function () { presses++; if (realPress) realPress(); };
  g.D.boot();
  startGame(g, 'insane');

  var bay = panelsOf(g)[0];
  bay.dispatch('click', { type: 'click', target: bay,
    preventDefault: function () {} });
  check(presses === 0, 'a click on bare panel played a key press');

  var body = bay.querySelector('.body');
  var control = body.querySelectorAll('.hit')[0] || body.querySelector('button');
  if (control) {
    bay.dispatch('click', { type: 'click', target: control,
      preventDefault: function () {} });
    check(presses === 1, 'a click on a control did not play a key press');
  }
  console.log('  click scope  bare panel silent, control answers');
})();

/* ---------------- part 2: the bomb shell -------------------------------- */

function panelsOf(g) { return g.doc.querySelectorAll('.bay.module'); }

function startGame(g, diff) {
  g.doc.querySelectorAll('[data-diff]').filter(function (b) {
    return b.getAttribute('data-diff') === diff;
  })[0].dispatch('click');
}

console.log('');
['easy', 'medium', 'hard', 'insane'].forEach(function (diff) {
  var counts = { easy: 3, medium: 5, hard: 6, insane: 8 };
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;                     /* skip the console self-test here */
  g.D.boot();
  var okHard = true, okCount = true;
  for (var trial = 0; trial < 40; trial++) {
    startGame(g, diff);
    var panels = panelsOf(g);
    if (panels.length !== counts[diff]) okCount = false;
    var hard = panels.filter(function (p) {
      return g.D.byId[p.getAttribute('data-id')].rating === 'hard';
    }).length;
    if (diff === 'easy' && hard > 1) okHard = false;
    if (diff === 'medium' && hard < 1) okHard = false;
    if (diff === 'hard' && hard !== 2) okHard = false;
    var ids = panels.map(function (p) { return p.getAttribute('data-id'); });
    if (new Set(ids).size !== ids.length) failures.push(diff + ': duplicated module');
  }
  check(okCount, diff + ': wrong module count');
  /* every module authored for a 2:1 slot must actually get one */
  for (var t2 = 0; t2 < 60; t2++) {
    startGame(g, diff);
    panelsOf(g).forEach(function (p) {
      var def = g.D.byId[p.getAttribute('data-id')];
      var span = /span (\d)/.exec(p.style.gridColumn || '');
      var got = span ? Number(span[1]) : 1;
      if ((def.wide ? 2 : 1) !== got) {
        failures.push(diff + ': ' + def.id + ' wanted span ' +
          (def.wide ? 2 : 1) + ', got ' + got);
      }
    });
  }
  check(okHard, diff + ': hard-module selection rule violated');
  var serial = g.doc.getElementById('serial').textContent;
  check(/^[A-Z0-9]{6}$/.test(serial) && /[A-Z]/.test(serial) && /[0-9]/.test(serial),
    diff + ': bad serial ' + serial);
  console.log('  ' + diff.padEnd(7) + ' selection rules ok, serial ' + serial);
});

/* practice */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  g.doc.getElementById('practice-modules').value = '7';
  g.doc.getElementById('practice-minutes').value = '3';
  g.doc.getElementById('practice-start').dispatch('click');
  check(panelsOf(g).length === 7, 'practice: expected 7 modules');
  check(g.doc.getElementById('timer').textContent === '03:00',
    'practice: expected 03:00, got ' + g.doc.getElementById('timer').textContent);
  console.log('  practice 7 modules / 03:00 ok');
})();

/* full defusal */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  startGame(g, 'insane');
  var panels = panelsOf(g);
  check(panels.length === 8, 'insane: expected 8 modules');
  panels.forEach(function (panel) {
    var inst = panel.__instance;
    if (!inst) { failures.push('no debug instance on panel'); return; }
    var host = panel.querySelector('.body');
    DRIVERS[inst.id].win(host, inst.puzzle, inst.solution, g, inst);
    if (!inst.solved) failures.push('insane run: ' + inst.id + ' did not solve');
  });
  check(g.doc.getElementById('screen-result').hidden === false, 'result screen did not show');
  check(g.doc.getElementById('result-title').textContent === 'DEFUSED',
    'expected DEFUSED, got ' + g.doc.getElementById('result-title').textContent);
  check(g.doc.getElementById('modcount').textContent === '8/8', 'module count wrong');
  console.log('  full defusal: ' + g.doc.getElementById('result-title').textContent +
    ' — ' + g.doc.getElementById('result-seed').textContent);
})();

/* three strikes */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  startGame(g, 'easy');
  var panels = panelsOf(g);
  var lit = 0;
  for (var k = 0; k < 3; k++) {
    var panel = panels[k % panels.length];
    var inst = panel.__instance;
    DRIVERS[inst.id].lose(panel.querySelector('.body'), inst.puzzle, inst.solution, g, inst);
  }
  lit = g.doc.getElementById('strikes').children.filter(function (i) {
    return i.className === 'lit';
  }).length;
  check(lit === 3, 'expected 3 lit strike indicators, got ' + lit);
  check(g.doc.getElementById('result-title').textContent === 'EXPLODED',
    'expected EXPLODED after three strikes');
  check(g.doc.getElementById('result-cause').textContent === 'three strikes',
    'wrong cause: ' + g.doc.getElementById('result-cause').textContent);
  console.log('  three strikes: EXPLODED (' + g.doc.getElementById('result-cause').textContent + ')');
})();

/* time out */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  startGame(g, 'easy');
  check(g.doc.getElementById('timer').textContent === '05:00',
    'easy should start at 05:00, got ' + g.doc.getElementById('timer').textContent);
  g.clock.t += 10000; g.tick();
  check(g.doc.getElementById('timer').textContent === '04:50',
    'after 10s expected 04:50, got ' + g.doc.getElementById('timer').textContent);
  g.clock.t += 300000; g.tick();
  check(g.doc.getElementById('result-title').textContent === 'EXPLODED',
    'expected EXPLODED on time out');
  check(g.doc.getElementById('result-cause').textContent === 'the clock ran out',
    'wrong cause: ' + g.doc.getElementById('result-cause').textContent);
  console.log('  time out: EXPLODED (' + g.doc.getElementById('result-cause').textContent + ')');
})();

/* a solved module must ignore further input, and modules must not interfere */
(function () {
  var g = boot({ search: '?debug=1' });
  g.D.selfTest = null;
  g.D.boot();
  startGame(g, 'insane');
  var panels = panelsOf(g);
  var first = panels[0], inst = first.__instance;
  DRIVERS[inst.id].win(first.querySelector('.body'), inst.puzzle, inst.solution, g, inst);
  check(inst.solved, 'first module did not solve');
  DRIVERS[inst.id].lose(first.querySelector('.body'), inst.puzzle, inst.solution, g, inst);
  var lit = g.doc.getElementById('strikes').children.filter(function (i) {
    return i.className === 'lit';
  }).length;
  check(lit === 0, 'a solved module still registered a strike');
  var others = panels.slice(1).filter(function (p) { return p.__instance.solved; });
  check(others.length === 0, 'solving one module solved another');
  check(g.doc.getElementById('modcount').textContent === '1/8', 'module count wrong after one solve');
  console.log('  isolation: solved module inert, neighbours untouched');
})();

console.log('');
if (failures.length) {
  console.log('PLAY-THROUGH FAILED');
  failures.slice(0, 40).forEach(function (f) { console.log('  ' + f); });
  process.exitCode = 1;
} else {
  console.log('PLAY-THROUGH PASSED');
}
