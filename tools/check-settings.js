/* node tools/check-settings.js — every player setting, driven through the
   real settings screen in headless Chrome, checked for its effect, for
   surviving a reload, and for RESET putting it back. */
const cdp = require('./cdp.js'), path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}
(async () => {
  const p = await cdp.open(URL + '?intro=0&mode=solo&start=hard&seed=99', { settle: 6000 });
  const ev = e => p.eval(e);
  const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const slide = (id, v) => ev(`(function(){var e=document.getElementById('${id}');e.value=${v};e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))})()`);
  const has = c => ev(`document.body.classList.contains('${c}')`);
  const scaleOf = async () => Number(/scale\(([\d.]+)\)/.exec(await ev("document.getElementById('bomb').style.transform"))[1]);

  /* REDUCE MOTION */
  check('motion AUTO follows system (full here)', !(await has('rm')));
  await click('#pref-motion .seg-btn:nth-of-type(2)');
  check('motion ON sets body.rm', await has('rm'));
  check('motion ON reaches fx', await ev('DEFUSAL.fx.reduced()'));
  const dur = await ev("getComputedStyle(document.querySelector('.fuse i')).transitionDuration");
  check('motion ON kills transitions', /^1e-0|^0\.00/.test(dur) || dur === '0s', dur);
  /* Media-query change events go out on a rendering step, and two flips
     inside one frame cancel out — so let a frame pass after each. */
  const frame = () => ev('new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 50); }); })');
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await frame();
  await click('#pref-motion .seg-btn:nth-of-type(3)');
  check('motion OFF overrides a reduce system', !(await has('rm')) && !(await ev('DEFUSAL.fx.reduced()')));
  await click('#pref-motion .seg-btn:nth-of-type(1)');
  check('motion AUTO picks up reduce system', await has('rm'));
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  for (let i = 0; i < 30 && (await has('rm')); i++) await frame();
  check('motion AUTO follows the system changing live', !(await has('rm')),
    await ev("matchMedia('(prefers-reduced-motion: reduce)').matches + ' ' + DEFUSAL.prefs.get('motion')"));

  /* SCREEN SHAKE */
  await click('#pref-shake');
  check('shake OFF sets body.no-shake', await has('no-shake'));
  await ev("document.querySelector('.face.front .casing').classList.add('shake')");
  check('shake OFF: casing does not animate',
    (await ev("getComputedStyle(document.querySelector('.face.front .casing')).animationName")) === 'none');
  await ev("document.querySelector('.face.front .casing').classList.remove('shake')");

  /* FLASHES */
  await slide('pref-flash', 40);
  check('flash 40% scales the wash', (await ev("getComputedStyle(document.getElementById('flash')).filter")) === 'opacity(0.4)',
    await ev("getComputedStyle(document.getElementById('flash')).filter"));
  await slide('pref-flash', 0);
  check('flash 0 removes the wash', (await ev("getComputedStyle(document.getElementById('flash')).display")) === 'none');
  await ev("document.querySelector('.face.front .lcd').classList.add('urgent')");
  check('flash 0 stops the clock blinking',
    (await ev("getComputedStyle(document.querySelector('.face.front .lcd')).animationName")) === 'none');
  await ev("document.querySelector('.face.front .lcd').classList.remove('urgent')");

  /* TEXT SIZE */
  const mz0 = Number(await ev("document.querySelector('#play-manual .mv-sheet').style.zoom"));
  await click('#pref-text .seg-btn:nth-of-type(4)');
  check('text XL sets --ui-text 1.3', (await ev("getComputedStyle(document.documentElement).getPropertyValue('--ui-text')")).trim() === '1.3');
  const mz1 = Number(await ev("document.querySelector('#play-manual .mv-sheet').style.zoom"));
  check('text XL enlarges the manual', Math.abs(mz1 - mz0 * 1.3) < 1e-6, mz0 + ' -> ' + mz1);
  check('manual own readout stays 100%', (await ev("document.querySelector('#play-manual .mv-zval').textContent")) === '100%');
  check('text XL reaches the split bar', Number(await ev("getComputedStyle(document.querySelector('.layout-bar')).zoom")) === 1.3);

  /* COLOUR LABELS */
  check('labels hidden by default', (await ev("Array.from(document.querySelectorAll('.cb-tag')).filter(function(t){return getComputedStyle(t).display!=='none'}).length")) === 0);
  await click('#pref-colorblind');
  const shown = await ev("Array.from(document.querySelectorAll('.face .cb-tag')).filter(function(t){return getComputedStyle(t).display!=='none'}).map(function(t){return t.textContent}).join(',')");
  check('labels shown on colour keys', shown.length > 0, shown);

  /* DEVICE SIZE */
  const s0 = await scaleOf();
  await slide('pref-scale', 120);
  await cdp.sleep(100);
  const s1 = await scaleOf();
  check('device size 120% enlarges case', Math.abs(s1 / s0 - 1.2) < 0.002, s0 + ' -> ' + s1);

  /* FULLSCREEN */
  const fsVisible = !(await ev("document.getElementById('row-fullscreen').hidden"));
  check('fullscreen offered where supported', fsVisible === (await ev('!!document.fullscreenEnabled')));

  /* persistence */
  await p.send('Page.reload'); await cdp.sleep(6000);
  check('settings survive reload',
    (await has('no-shake')) && (await has('no-flash')) && (await has('cb')) &&
    (await ev("DEFUSAL.prefs.get('text')")) === 1.3 && (await ev("DEFUSAL.prefs.get('scale')")) === 1.2);
  check('reloaded controls show stored values',
    (await ev("document.getElementById('pref-shake').textContent")) === 'OFF' &&
    (await ev("document.getElementById('val-scale').textContent")) === '120');

  /* RESET SETTINGS */
  await ev("DEFUSAL.audio.setLevel('music', 0.2)");
  await ev("localStorage.setItem('defusal.manualZoom','1.6')");
  await click('#reset-settings');
  await cdp.sleep(100);
  const d = await ev("JSON.stringify(['motion','shake','flash','text','colorblind','scale'].map(function(k){return DEFUSAL.prefs.get(k)}))");
  check('reset: every setting default', d === JSON.stringify(['auto', true, 1, 1, false, 1]), d);
  check('reset: body classes cleared', !(await has('no-shake')) && !(await has('no-flash')) && !(await has('cb')));
  check('reset: sound levels default', (await ev("DEFUSAL.audio.level('music')")) === 0.7 &&
    (await ev("document.getElementById('val-music').textContent")) === '70');
  check('reset: manual size forgotten', (await ev("localStorage.getItem('defusal.manualZoom')")) === null);
  check('reset: case back to fitted size', Math.abs((await scaleOf()) - s0) < 0.002);
  check('reset: progress untouched', (await ev("document.getElementById('set-progress').textContent")).length > 0);

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.join(' | '));
  await p.close();
  console.log(fails ? fails + ' FAILED' : 'SETTINGS CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
