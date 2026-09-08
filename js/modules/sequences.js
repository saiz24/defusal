/* ==========================================================================
   MODULE: SEQUENCES  (rating: Easy)

   Manual rule implemented here
   ----------------------------
   Five terms of an arithmetic or geometric sequence are shown, written in
   letters A-J, with one term blank.
     * If the serial contains a vowel, A-J = 1,2,3,4,5,6,7,8,9,0.
     * Otherwise                       A-J = 0,1,2,3,4,5,6,7,8,9.
   Box 1: the missing term, in digits.
   Box 2: the sum of all five terms; if that sum is 100 or more, only its
          last two digits are entered (143 -> 43, 100 -> 00).
   Submitting with either box wrong is a strike.

   Generation constraints: every term is a non-negative integer of at most two
   digits with no leading zero; the blank may sit at any of the five positions;
   the visible terms must admit exactly one completion.
   ========================================================================== */

(function (D) {
  'use strict';

  /* ---- the complete space of legal sequences --------------------------- */

  function buildSpace() {
    var out = [], a, d, i, terms, ok;

    /* arithmetic, d != 0, every term in 0..99 */
    for (d = -24; d <= 24; d++) {
      if (d === 0) continue;
      for (a = 0; a <= 99; a++) {
        terms = []; ok = true;
        for (i = 0; i < 5; i++) {
          var t = a + i * d;
          if (t < 0 || t > 99) { ok = false; break; }
          terms.push(t);
        }
        if (ok) out.push({ kind: 'arithmetic', terms: terms });
      }
    }

    /* geometric with every term an integer in 1..99, plus the reverses */
    var geo = [];
    [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [16, 1.5]]
      .forEach(function (pair) {
        var t0 = pair[0], r = pair[1], ts = [t0], k, v = t0, good = true;
        for (k = 1; k < 5; k++) {
          v = v * r;
          if (Math.abs(v - Math.round(v)) > 1e-9) { good = false; break; }
          v = Math.round(v);
          if (v < 0 || v > 99) { good = false; break; }
          ts.push(v);
        }
        if (good) geo.push(ts);
      });
    geo.forEach(function (ts) {
      out.push({ kind: 'geometric', terms: ts.slice() });
      out.push({ kind: 'geometric', terms: ts.slice().reverse() });
    });

    return out;
  }

  var SPACE = null;
  function space() { if (!SPACE) SPACE = buildSpace(); return SPACE; }

  /* ---- letter encoding -------------------------------------------------- */

  var ALPHA = 'ABCDEFGHIJ';

  function digitToLetter(digit, hasVowel) {
    /* vowel present: 1->A .. 9->I, 0->J.   no vowel: 0->A .. 9->J */
    var idx = hasVowel ? (digit + 9) % 10 : digit;
    return ALPHA.charAt(idx);
  }

  function termToLetters(term, hasVowel) {
    var s = String(term), out = '', i;
    for (i = 0; i < s.length; i++) {
      out += digitToLetter(s.charCodeAt(i) - 48, hasVowel);
    }
    return out;
  }

  /* ---- generation ------------------------------------------------------- */

  function matchesVisible(terms, seqTerms, blank) {
    for (var i = 0; i < 5; i++) {
      if (i === blank) continue;
      if (terms[i] !== seqTerms[i]) return false;
    }
    return true;
  }

  function uniqueCompletion(terms, blank) {
    var all = space(), seen = {}, n = 0, i;
    for (i = 0; i < all.length; i++) {
      if (!matchesVisible(terms, all[i].terms, blank)) continue;
      var t = all[i].terms;
      var sum = t[0] + t[1] + t[2] + t[3] + t[4];
      var key = t[blank] + '/' + sum;
      if (!seen[key]) { seen[key] = true; n++; if (n > 1) return false; }
    }
    return n === 1;
  }

  function generate(rng, ctx) {
    var all = space(), tries = 0;
    var arith = all.filter(function (q) { return q.kind === 'arithmetic'; });
    var geo = all.filter(function (q) { return q.kind === 'geometric'; });
    while (tries++ < 500) {
      /* arithmetic outnumbers geometric ~150:1 in the raw space, so pick the
         kind first to keep both showing up */
      var pool = rng() < 0.3 ? geo : arith;
      var seq = D.pick(rng, pool);
      var blank = D.rint(rng, 0, 4);
      if (!uniqueCompletion(seq.terms, blank)) continue;
      return {
        kind: seq.kind,
        terms: seq.terms.slice(),
        blank: blank,
        hasVowel: ctx.serialInfo.hasVowel
      };
    }
    /* unreachable in practice; fall back to a known-good round */
    return { kind: 'arithmetic', terms: [2, 5, 8, 11, 14], blank: 2,
             hasVowel: ctx.serialInfo.hasVowel };
  }

  /* ---- solution --------------------------------------------------------- */

  function solve(p) {
    var sum = p.terms.reduce(function (a, b) { return a + b; }, 0);
    var boxTwo = sum >= 100 ? sum % 100 : sum;
    return {
      missing: p.terms[p.blank],
      total: sum,
      boxTwo: boxTwo,
      boxTwoText: sum >= 100 ? String(boxTwo).replace(/^(\d)$/, '0$1')
                                             .padStart(2, '0')
                             : String(boxTwo)
    };
  }

  function debugText(p, s) {
    return 'box1 ' + s.missing + '   box2 ' + s.boxTwoText +
           '  (sum ' + s.total + ', ' + p.kind + ')';
  }

  /* ---- self-test checks ------------------------------------------------- */

  function validate(p, s, ctx, fail) {
    p.terms.forEach(function (t, i) {
      if (!(Number.isInteger(t) && t >= 0 && t <= 99)) {
        fail('term ' + i + ' out of range: ' + t);
      }
      if (String(t).length > 2) fail('term has more than two digits: ' + t);
      if (String(t).length > 1 && String(t).charAt(0) === '0') {
        fail('term has a leading zero: ' + t);
      }
    });
    if (!uniqueCompletion(p.terms, p.blank)) fail('completion is not unique');
    if (s.missing !== p.terms[p.blank]) fail('missing term mismatch');
    if (s.boxTwo !== (s.total >= 100 ? s.total % 100 : s.total)) {
      fail('box two mismatch');
    }
    if (p.hasVowel !== ctx.serialInfo.hasVowel) fail('vowel flag mismatch');
  }

  /* ---- rendering -------------------------------------------------------- */

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution;

    var strip = document.createElement('div');
    strip.className = 'strip';
    var row = document.createElement('div');
    row.className = 'terms';
    p.terms.forEach(function (t, i) {
      var cell = document.createElement('div');
      if (i === p.blank) cell.className = 'gap';
      cell.textContent = (i === p.blank) ? '?' : termToLetters(t, p.hasVowel);
      row.appendChild(cell);
    });
    strip.appendChild(row);
    host.appendChild(strip);

    var form = document.createElement('div');
    form.className = 'answer';
    form.innerHTML =
      '<input type="text" class="narrow" maxlength="4" inputmode="numeric" ' +
      'autocomplete="off" spellcheck="false">' +
      '<input type="text" class="narrow" maxlength="4" inputmode="numeric" ' +
      'autocomplete="off" spellcheck="false">' +
      '<button type="button" class="go-btn">ENTER</button>';
    host.appendChild(form);

    var boxes = form.querySelectorAll('input');
    var btn = form.querySelector('button');

    function attempt() {
      if (inst.isSolved()) return;
      var a = boxes[0].value.trim(), b = boxes[1].value.trim();
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) { inst.strike(); return; }
      if (Number(a) === s.missing && Number(b) === s.boxTwo) inst.solve();
      else inst.strike();
    }

    btn.addEventListener('click', attempt);
    [].forEach.call(boxes, function (bx) {
      bx.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); attempt(); }
      });
    });

    inst.onSolved = function () {
      [].forEach.call(boxes, function (bx) { bx.disabled = true; });
      btn.disabled = true;
    };
  }

  D.register({
    id: 'sequences',
    name: 'SEQUENCES',
    rating: 'easy',
    wide: true,
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
