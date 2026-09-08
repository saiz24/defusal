/* ==========================================================================
   MODULE: MUTUALLY EXCLUSIVE EVENTS  (rating: Medium)

   Manual rule implemented here
   ----------------------------
   Two playing cards are drawn from two INDEPENDENT decks, so they may be
   identical. Build four binary digits, left to right:
     1. 1 if the two suits differ, else 0
     2. 1 if the two colours differ, else 0
     3. 1 if the two ranks differ, else 0
     4. 1 if the two card values sum to 13 or more, else 0
   Card values: Ace 1, Jack 11, Queen 12, King 13, others face value.
   If the LAST character of the serial is an ODD DIGIT, reverse the four
   digits first. Convert with place values 8, 4, 2, 1 and type the decimal.
   ========================================================================== */

(function (D) {
  'use strict';

  function generate(rng, ctx) {
    var a = D.cards.draw(rng), b = D.cards.draw(rng);
    return {
      a: { suit: a.suit.id, rank: a.rank.id },
      b: { suit: b.suit.id, rank: b.rank.id },
      reversed: ctx.serialInfo.lastIsOddDigit
    };
  }

  function suitOf(id) {
    return D.cards.SUITS.filter(function (s) { return s.id === id; })[0];
  }
  function rankOf(id) {
    return D.cards.RANKS.filter(function (r) { return r.id === id; })[0];
  }

  function solve(p) {
    var sa = suitOf(p.a.suit), sb = suitOf(p.b.suit);
    var ra = rankOf(p.a.rank), rb = rankOf(p.b.rank);

    var digits = [
      sa.id !== sb.id ? 1 : 0,
      sa.color !== sb.color ? 1 : 0,
      ra.id !== rb.id ? 1 : 0,
      (ra.value + rb.value) >= 13 ? 1 : 0
    ];

    var used = p.reversed ? digits.slice().reverse() : digits.slice();
    var value = used[0] * 8 + used[1] * 4 + used[2] * 2 + used[3] * 1;

    return { digits: digits, used: used, value: value,
             sum: ra.value + rb.value };
  }

  function debugText(p, s) {
    return s.digits.join('') + (p.reversed ? ' -> reversed ' + s.used.join('') : '') +
           '  =  ' + s.value;
  }

  function validate(p, s, ctx, fail) {
    if (s.value < 0 || s.value > 15) fail('value out of range: ' + s.value);
    if (s.digits[1] === 1 && s.digits[0] !== 1) {
      fail('colours differ but suits do not');
    }
    if (p.reversed !== ctx.serialInfo.lastIsOddDigit) fail('reverse flag wrong');
    var recomputed = s.used[0] * 8 + s.used[1] * 4 + s.used[2] * 2 + s.used[3];
    if (recomputed !== s.value) fail('place-value conversion wrong');
  }

  function mount(host, inst) {
    var p = inst.puzzle, s = inst.solution;
    var S = D.svg;

    var svg = S.root(0, 0, 316, 214, 'art');
    var cw = 140, ch = 200;
    /* the deal animation goes on a wrapper: a CSS transform on the card group
       itself would override its own translate attribute */
    var slotA = S.el('g', { class: 'deal deal-1' }, svg);
    var slotB = S.el('g', { class: 'deal deal-2' }, svg);
    D.cards.drawCard(slotA, 14, 7, cw, ch,
      { suit: suitOf(p.a.suit), rank: rankOf(p.a.rank) });
    D.cards.drawCard(slotB, 162, 7, cw, ch,
      { suit: suitOf(p.b.suit), rank: rankOf(p.b.rank) });
    host.appendChild(svg);

    var form = document.createElement('div');
    form.className = 'answer';
    form.innerHTML =
      '<input type="text" maxlength="3" inputmode="numeric" ' +
      'autocomplete="off" spellcheck="false">' +
      '<button type="button" class="go-btn">ENTER</button>';
    host.appendChild(form);

    var box = form.querySelector('input');
    var btn = form.querySelector('button');

    function attempt() {
      if (inst.isSolved()) return;
      var v = box.value.trim();
      if (!/^\d+$/.test(v)) { inst.strike(); return; }
      if (Number(v) === s.value) inst.solve(); else inst.strike();
    }

    btn.addEventListener('click', attempt);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); attempt(); }
    });

    inst.onSolved = function () { box.disabled = true; btn.disabled = true; };
  }

  D.register({
    id: 'mutex',
    name: 'MUTUALLY EXCLUSIVE EVENTS',
    rating: 'medium',
    generate: generate,
    solve: solve,
    debugText: debugText,
    validate: validate,
    mount: mount
  });
})(DEFUSAL);
