/* node tools/check-shell.js
   The way into the game and back out of it: the splash, the prologue on a
   first visit only, the title, PRESS ANY KEY, the main menu with the
   keyboard, each of its doors and the way back from them, settings
   returning where they were opened from, and the pause: Esc stops the
   clock and covers the device, RESUME runs it again, RESTART deals the same
   device, QUIT goes to the menu. Run with CDP_GL=1 for the 3D desk. */
'use strict';
const cdp = require('./cdp.js'), path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}
(async () => {
  const p = await cdp.open(URL, { settle: 400, w: 1440, h: 900 });
  const ev = e => p.eval(e);
  const key = async (k, code) => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: code || k }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code || k }); };
  const at = () => ev('DEFUSAL.screenNow()');
  /* wait for a screen rather than a fixed time: software WebGL is slow */
  const waitFor = async (name, ms) => { for (let t = 0; t < (ms || 9000); t += 200) { if ((await at()) === name) return true; await cdp.sleep(200); } return false; };

  check('a plain address opens on the splash', !(await ev("document.getElementById('splash').hidden")));
  await cdp.sleep(3200);
  check('first visit: the prologue plays', await ev('DEFUSAL.cutscene.isActive()'));
  await ev('DEFUSAL.cutscene.skip()');
  await cdp.sleep(1500);
  check('...and hands over the mode screen', (await at()) === 'mode');

  /* a returning player: reload, splash, title */
  await p.send('Page.reload'); await cdp.sleep(1500);
  check('a returning player lands on the title', (await waitFor('title')) && !(await ev('DEFUSAL.cutscene.isActive()')));
  check('3D desk behind the title when WebGL is there', (await ev("!document.getElementById('shell-bg').hidden")) === !!process.env.CDP_GL);
  await cdp.sleep(1000);
  await cdp.sleep(1000);
  await key('Escape', 'Escape'); await cdp.sleep(800);
  check('Esc is not "any key" on the title', (await at()) === 'title');
  await key('Enter', 'Enter');
  check('PRESS ANY KEY opens the main menu', await waitFor('main'));
  await key('Escape', 'Escape');
  check('Esc on the main menu goes back to the title', await waitFor('title'));
  await cdp.sleep(1000); await key('Enter', 'Enter'); await waitFor('main');
  check('QUIT only in the desktop app', await ev("document.getElementById('mm-quit').hidden"));
  check('PRACTICE locked before device 1', await ev("document.getElementById('mm-practice').classList.contains('locked')"));
  await key('ArrowDown', 'ArrowDown');
  check('arrow keys move the selection', await ev("document.querySelectorAll('#main-menu .mm-item')[1].classList.contains('sel')"));
  await key('ArrowUp', 'ArrowUp');
  await key('Enter', 'Enter'); await waitFor('menu');
  check('CAMPAIGN opens the device carousel', (await at()) === 'menu' && !(await ev("document.getElementById('menu-back').hidden")));
  await key('Escape', 'Escape');
  check('Esc on the carousel goes back to the main menu', await waitFor('main'));
  await ev("document.querySelector('[data-go=code]').click()"); await cdp.sleep(1300);
  check('ENTER CODE opens the carousel on the code page', (await at()) === 'menu' && await ev("document.querySelectorAll('#sel-track .card')[DEFUSAL.menuPage('seed')].classList.contains('focused-page')"));
  await ev("document.getElementById('menu-back').click()"); await cdp.sleep(1300);
  await waitFor('main');
  await ev("document.querySelector('[data-go=settings]').click()");
  check('SETTINGS opens', await waitFor('settings'));
  await ev("document.getElementById('settings-back').click()");
  check('...and DONE returns to the main menu', await waitFor('main'));
  await ev("document.querySelector('[data-go=mode]').click()");
  check('MODE opens the mode screen', await waitFor('mode'));

  await ev("document.getElementById('mode-confirm').click()");
  check('...and CONTINUE returns to the main menu', await waitFor('main'));

  /* the pause, on a real device: CAMPAIGN, then ENGAGE on device 1 */
  await ev("document.querySelector('[data-go=campaign]').click()"); await cdp.sleep(1400);
  await ev("document.querySelectorAll('#sel-track .card')[0].querySelector('.key.go, button.go, .go').click()"); await cdp.sleep(2500);
  if (await ev('DEFUSAL.cutscene.isActive()')) { await ev('DEFUSAL.cutscene.skip()'); }
  check('ENGAGE opens the briefing first', await waitFor('brief'));
  await key('Escape', 'Escape');
  check('Esc on the briefing goes back to the carousel', await waitFor('menu'));
  await ev("document.querySelectorAll('#sel-track .card')[0].querySelector('.key.go, button.go, .go').click()");
  await waitFor('brief'); await cdp.sleep(700);
  await key('Enter', 'Enter');
  await cdp.sleep(5500);
  check('a device is armed', (await at()) === 'game');
  const clock = () => ev("document.querySelector('.face.front .lcd').textContent");
  await key('Escape', 'Escape'); await cdp.sleep(300);
  check('Esc pauses', await ev('DEFUSAL.isPaused()') && !(await ev("document.getElementById('pause').hidden")));
  const c0 = await clock(); await cdp.sleep(2600); const c1 = await clock();
  check('the clock is stopped while paused', c0 === c1, c0 + ' / ' + c1);
  await key('Escape', 'Escape'); await cdp.sleep(2300);
  check('Esc again resumes, and the clock runs', !(await ev('DEFUSAL.isPaused()')) && (await clock()) !== c1);
  await ev("document.getElementById('pause-btn').click()"); await cdp.sleep(300);
  check('the pause button pauses too', await ev('DEFUSAL.isPaused()'));
  const serial0 = await ev("document.querySelector('.face.front .plate').textContent");
  await ev("document.getElementById('pause-restart').click()"); await cdp.sleep(6500);
  check('RESTART deals the same device again', (await ev("document.querySelector('.face.front .plate').textContent")) === serial0 && !(await ev('DEFUSAL.isPaused()')));
  await ev("document.getElementById('pause-btn').click()"); await cdp.sleep(300);
  await ev("document.getElementById('pause-quit').click()"); await cdp.sleep(2000);
  check('QUIT TO MENU leaves the round', (await at()) === 'menu' && !(await ev("document.body.classList.contains('paused')")));

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();
  console.log(fails ? `\n${fails} FAILED` : '\nSHELL CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
