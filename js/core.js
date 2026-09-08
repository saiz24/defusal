/* ==========================================================================
   DEFUSAL — core
   Namespace, seeded RNG, module registry, serial-number helpers.
   No DOM access at load time: this file must be evaluable in plain Node so
   the self-test can run headless.
   ========================================================================== */

var DEFUSAL = (function () {
  var D = {};

  /* ---------- seeded RNG (mulberry32) ------------------------------------ */

  D.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  D.rint = function (rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };

  D.pick = function (rng, arr) { return arr[D.rint(rng, 0, arr.length - 1)]; };

  D.shuffle = function (rng, arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = D.rint(rng, 0, i);
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* ---------- serial number ---------------------------------------------- */

  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* Six characters, mixed letters and digits, at least one of each. */
  D.makeSerial = function (rng) {
    var s, i;
    do {
      s = '';
      for (i = 0; i < 6; i++) {
        s += (rng() < 0.5)
          ? LETTERS.charAt(D.rint(rng, 0, 25))
          : String(D.rint(rng, 0, 9));
      }
    } while (!/[A-Z]/.test(s) || !/[0-9]/.test(s));
    return s;
  };

  /* Facts about the serial that modules read. */
  D.serialInfo = function (serial) {
    var digits = [], i, c;
    for (i = 0; i < serial.length; i++) {
      c = serial.charAt(i);
      if (c >= '0' && c <= '9') digits.push(c.charCodeAt(0) - 48);
    }
    var last = serial.charAt(serial.length - 1);
    var lastIsDigit = last >= '0' && last <= '9';
    return {
      serial: serial,
      digits: digits,
      hasVowel: /[AEIOU]/.test(serial),
      hasHighDigit: digits.some(function (d) { return d >= 7; }),
      hasLowDigit: digits.some(function (d) { return d <= 3; }),
      lastChar: last,
      lastIsEvenDigit: lastIsDigit && ((last.charCodeAt(0) - 48) % 2 === 0),
      lastIsOddDigit: lastIsDigit && ((last.charCodeAt(0) - 48) % 2 === 1)
    };
  };

  /* ---------- module registry -------------------------------------------- */

  D.modules = [];
  D.byId = {};

  /* def = { id, name, rating, generate(rng, ctx), solve(puzzle, ctx),
             debugText(puzzle, solution, ctx), mount(host, inst),
             validate(puzzle, solution, ctx)  // used by the self-test } */
  D.register = function (def) {
    D.modules.push(def);
    D.byId[def.id] = def;
    return def;
  };

  D.modulesByRating = function (rating) {
    return D.modules.filter(function (m) { return m.rating === rating; });
  };

  /* ---------- misc -------------------------------------------------------- */

  D.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  /* Exact-ish decimal formatting for instrument labels / readings. */
  D.fmt = function (n) {
    var s = (Math.round(n * 1e6) / 1e6).toString();
    return s;
  };

  /* lighten (f > 0) or darken (f < 0) a #rrggbb toward white or black */
  D.shade = function (hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, a = Math.abs(f);
    r = Math.round(r + (t - r) * a);
    g = Math.round(g + (t - g) * a);
    b = Math.round(b + (t - b) * a);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  D.gcd = function (a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  };

  return D;
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = DEFUSAL; }
