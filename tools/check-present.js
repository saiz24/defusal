/* node tools/check-present.js
   The presentation around a device: the briefing before a campaign device
   (and not before a retry or a typed code), and the rank stamped on the
   result — the thresholds, the letter only on a win, NEW BEST only when it
   beats the record, and the record shown on the device's carousel card. */
'use strict';
const cdp = require('./cdp.js'), path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?debug=1&intro=0';
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}
(async () => {
  const p = await cdp.open(URL, { settle: 2500, w: 1440, h: 900 });
  const ev = e => p.eval(e);
  const at = () => ev('DEFUSAL.screenNow()');
  const waitFor = async (name, ms) => { for (let t = 0; t < (ms || 9000); t += 200) { if ((await at()) === name) return true; await cdp.sleep(200); } return false; };
  const key = async k => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k }); };

  /* thresholds: points = % of clock left - 20 per strike; S needs no strikes */
  const R = (l, t, s) => ev(`DEFUSAL.rankOf(${l}, ${t}, ${s})`);
  check('half the clock, clean: S', (await R(150, 300, 0)) === 'S');
  check('half the clock, one strike: A', (await R(150, 300, 1)) === 'A');
  check('just under half, clean: A', (await R(149, 300, 0)) === 'A');
  check('30% left: A', (await R(90, 300, 0)) === 'A');
  check('20% left: B', (await R(60, 300, 0)) === 'B');
  check('12% left: B', (await R(36, 300, 0)) === 'B');
  check('10% left: C', (await R(30, 300, 0)) === 'C');
  check('90% left, two strikes: A', (await R(270, 300, 2)) === 'A');
  check('40% left, two strikes: C', (await R(120, 300, 2)) === 'C');

  /* the briefing comes before a campaign device and not before a typed code */
  await ev("localStorage.setItem('defusal.stage','1'); localStorage.removeItem('defusal.stats')");
  await ev("DEFUSAL.startStage({ difficulty: 'easy', count: 4, seconds: 330, stage: 2 })");
  /* device 2 is not cleared yet, so its scene plays first */
  for (let i = 0; i < 20 && !(await ev('DEFUSAL.cutscene.isActive()')); i++) await cdp.sleep(150);
  if (await ev('DEFUSAL.cutscene.isActive()')) await ev('DEFUSAL.cutscene.skip()');
  check('a campaign device opens on its briefing', await waitFor('brief'));
  check('...naming the device', (await ev("document.getElementById('brief-idx').textContent")) === 'DEVICE 2 / 5' &&
        (await ev("document.getElementById('brief-name').textContent")) === 'ELEMENTARY');
  check('...with its modules and time', (await ev("document.getElementById('brief-mod').textContent")) === '4' &&
        (await ev("document.getElementById('brief-time').textContent")) === '05:30');
  check('...and no best yet', (await ev("document.getElementById('brief-best').textContent")) === 'NONE YET');
  await cdp.sleep(600);
  await key('Enter');
  check('Enter arms it', await waitFor('game'));
  await cdp.sleep(3500);

  /* a win with half the clock left and no strikes: S, a new best */
  await ev('DEFUSAL.debugFinish(true, 200, 0)');
  check('the result is up', await waitFor('result'));
  check('the rank is hidden until the figures have counted', !(await ev("document.getElementById('result-rank').classList.contains('on')")));
  await cdp.sleep(1800);
  check('then it is stamped on', await ev("document.getElementById('result-rank').classList.contains('on')"));
  check('S for a clean run with most of the clock', (await ev("document.getElementById('result-rank-letter').textContent")) === 'S');
  check('NEW BEST the first time', !(await ev("document.getElementById('result-rank-new').hidden")));
  check('the record keeps it', (await ev("JSON.parse(localStorage.getItem('defusal.stats'))['2'].rank")) === 'S');
  check('the carousel card shows it', /^S · /.test(await ev("document.querySelectorAll('#sel-track .card')[1].querySelectorAll('.fact b')[2].textContent")),
        await ev("document.querySelectorAll('#sel-track .card')[1].querySelectorAll('.fact b')[2].textContent"));

  /* TRY AGAIN goes straight to the case, no briefing */
  await ev("document.getElementById('result-replay').click()");
  check('TRY AGAIN skips the briefing', await waitFor('game'));
  await cdp.sleep(3500);
  await ev('DEFUSAL.debugFinish(true, 40, 1)');
  await waitFor('result'); await cdp.sleep(1800);
  check('a worse run: C', (await ev("document.getElementById('result-rank-letter').textContent")) === 'C');
  check('...and no NEW BEST', await ev("document.getElementById('result-rank-new').hidden"));
  check('...and the record stays S', (await ev("JSON.parse(localStorage.getItem('defusal.stats'))['2'].rank")) === 'S');

  /* a loss has no letter */
  await ev("document.getElementById('result-replay').click()");
  await waitFor('game'); await cdp.sleep(3500);
  await ev("DEFUSAL.debugFinish(false, 0, 3)");
  await waitFor('result'); await cdp.sleep(1800);
  check('no rank on a loss', await ev("document.getElementById('result-rank').hidden"));

  /* a typed code: no briefing */
  await ev("document.getElementById('result-menu').click()"); await waitFor('menu');
  await ev("DEFUSAL.startStage(Object.assign(DEFUSAL.parseCode('S2-K7A2XQ')))");
  check('a typed code skips the briefing', await waitFor('game'));

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();
  console.log(fails ? `\n${fails} FAILED` : '\nPRESENT CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
