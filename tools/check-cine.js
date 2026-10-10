/* node tools/check-cine.js [sequence...]
   Every cutscene, checked in headless Chrome:
     - every shot draws a picture (not a blank canvas) at its start, middle
       and end;
     - every line is a real sentence, and every shot has a length;
     - a tap moves the scene on, a held press skips it, and the caller is
       told it finished exactly once;
     - nothing throws.
   It also prints each sequence's running time and writes one frame per shot
   to tools/shots/cine/<sequence>-<shot>.png — a contact sheet to look at. */
'use strict';
const cdp = require('./cdp.js'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'cine');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv.slice(2);
  const p = await cdp.open('file://' + ROOT + '/index.html?intro=0', { settle: 2500, w: 1280, h: 720 });
  const ev = e => p.eval(e);

  const hasDebug = await ev('!!(DEFUSAL.cutscene && DEFUSAL.cutscene.debug)');
  check('cutscene debug interface present', hasDebug);
  if (!hasDebug) { await p.close(); console.log('1 FAILED'); process.exit(1); }

  const names = (await ev('DEFUSAL.cutscene.debug.names()')).filter(n => !want.length || want.includes(n));
  let total = 0;
  for (const name of names) {
    const shots = await ev(`DEFUSAL.cutscene.debug.shots(${JSON.stringify(name)})`);
    const dur = shots.reduce((a, s) => a + s.dur, 0);
    total += dur;
    console.log(`\n${name}: ${shots.length} shots, ${dur.toFixed(1)} s`);
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      check(`${name}[${i}] ${s.paint} has a length`, s.dur > 0.5, s.dur.toFixed(1) + ' s');
      const badLine = s.lines.find(l => typeof l !== 'string' || l.trim().length < 2);
      check(`${name}[${i}] lines are sentences`, badLine === undefined);
      for (const t of [0.3, s.dur / 2, Math.max(0.3, s.dur - 0.3)]) {
        const ok = await ev(`DEFUSAL.cutscene.debug.freeze(${JSON.stringify(name)}, ${i}, ${t})`);
        if (!ok) check(`${name}[${i}] draws at ${t.toFixed(1)} s`, false);
      }
      await ev(`DEFUSAL.cutscene.debug.freeze(${JSON.stringify(name)}, ${i}, ${s.dur / 2})`);
      await cdp.sleep(120);
      await p.shot(path.join(OUT, `${name}-${String(i).padStart(2, '0')}.png`));
    }
    await ev('DEFUSAL.cutscene.debug.release()');
  }
  console.log(`\nall sequences: ${(total / 60).toFixed(1)} min`);

  /* playback: a tap moves on, a hold skips, done fires once */
  if (!want.length || want.includes('pre1')) {
    await ev("window.__done = 0; DEFUSAL.cutscene.play('pre1', function () { window.__done++; })");
    await cdp.sleep(1500);
    const before = await ev('JSON.stringify(DEFUSAL.cutscene.debug.state())');
    const key = (type) => p.send('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', text: type === 'keyDown' ? ' ' : undefined });
    for (let k = 0; k < 3; k++) { await key('keyDown'); await key('keyUp'); await cdp.sleep(350); }
    const after = await ev('JSON.stringify(DEFUSAL.cutscene.debug.state())');
    check('taps move the scene on', before !== after, before + ' -> ' + after);
    await key('keyDown');
    await cdp.sleep(1400);
    await key('keyUp');
    await cdp.sleep(600);
    check('holding skips the scene', !(await ev('DEFUSAL.cutscene.isActive()')));
    check('done is called exactly once', (await ev('window.__done')) === 1, await ev('window.__done'));
  }

  /* the whole first-run flow: prologue, mode screen, the first device's
     scene, then the device itself */
  if (!want.length) {
    const f = await cdp.open('file://' + ROOT + '/index.html', { settle: 2500, w: 1280, h: 720 });
    const fe = e => f.eval(e);
    const hold = async () => {
      await f.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ' });
      await cdp.sleep(1400);
      await f.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
      await cdp.sleep(1500);
    };
    check('first visit opens on the prologue', (await fe("DEFUSAL.cutscene.debug.state().seq")) === 'intro' && await fe('DEFUSAL.cutscene.isActive()'));
    await hold();
    check('skipping the prologue hands over the mode screen', !(await fe("document.getElementById('screen-mode').hidden")));
    await fe("document.getElementById('mode-confirm').click()");
    await cdp.sleep(2500);
    check('the first device is introduced by its scene', (await fe("DEFUSAL.cutscene.debug.state().seq")) === 'pre1' && await fe('DEFUSAL.cutscene.isActive()'));
    await hold();
    check('then its briefing', (await fe('DEFUSAL.screenNow()')) === 'brief');
    await cdp.sleep(600);
    await f.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
    await f.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    await cdp.sleep(1800);
    check('then the device arms', !(await fe("document.getElementById('screen-game').hidden")));
    await f.send('Page.reload'); await cdp.sleep(3000);
    check('the prologue does not play twice', !(await fe('DEFUSAL.cutscene.isActive()')));
    const fx = f.logs.filter(l => /EXCEPTION/.test(l));
    check('no exceptions in the flow', fx.length === 0, fx.slice(0, 3).join(' | '));
    await f.close();
  }

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();
  console.log(fails ? `\n${fails} FAILED` : '\nCINE CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
