/* CDP_GL=1 node tools/check-case3d.js
   The case as a 3D object (test shot B): with the room on it rests turned
   and tipped on the desk; the serial is painted on its two sides and gone
   from its faces; a drag on bare case turns it (the room stays put) and it
   settles back when let go; a drag that starts on a module does not; the
   hint about turning goes once the case has been turned; leaning in on a
   module or zooming squares it up; the room's body lines up with the CSS
   face. With the room off the case is square and none of this applies. */
'use strict';
process.env.CDP_GL = process.env.CDP_GL || '1';
const cdp = require('./cdp.js'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}
(async () => {
  const p = await cdp.open('file://' + ROOT + '/index.html?intro=0&debug=1', { settle: 2500, w: 1440, h: 900 });
  const ev = e => p.eval(e);
  const mouse = (type, x, y, extra) => p.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }, extra || {}));
  await ev("localStorage.removeItem('defusal.turned')");
  await ev("DEFUSAL.startRound({ difficulty: 'insane', count: 8, seconds: 600, seed: 7 })");
  await cdp.sleep(9000);

  check('the room is on', await ev("document.body.classList.contains('room3d')"));
  const pose = await ev('DEFUSAL.casePose()');
  check('at rest the case is turned and tipped', pose.y > 15 && pose.x < -12, JSON.stringify(pose));
  const serial = await ev("document.getElementById('serial').textContent");
  check('the serial is painted on its sides', (await ev('DEFUSAL.room3d.debugSerial()')) === serial && serial.length === 6, serial);
  check('...and is not on the face', await ev("getComputedStyle(document.getElementById('serial')).display === 'none'"));
  check('...nor on the back', await ev("[].every.call(document.querySelectorAll('.strip.plate-only'), function (n) { return getComputedStyle(n).display === 'none'; })"));
  check('a hint says how to read it', await ev("!document.getElementById('turn-hint').hidden"));

  /* the body the room draws lines up with the CSS face */
  const corners = await ev('JSON.stringify(DEFUSAL.room3d.debugCorners())');
  check('the 3D body has a face where the CSS face is', !!corners && corners !== 'null', corners && corners.slice(0, 60));

  /* a drag on bare case, beside the control strip */
  const bare = JSON.parse(await ev(`(function(){ var r = document.querySelector('.face.front .panel').getBoundingClientRect(); return JSON.stringify([r.left + r.width * 0.12, r.top + r.height * 0.5]); })()`));
  await mouse('mouseMoved', bare[0], bare[1], { buttons: 0 });
  await mouse('mousePressed', bare[0], bare[1]);
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', bare[0] + i * 22, bare[1] - i * 4); await cdp.sleep(30); }
  const mid = await ev('DEFUSAL.casePose()');
  check('a drag on the case turns it', mid.turnY > 30, JSON.stringify(mid));
  /* the view leans a few degrees with the cursor (it always has); beyond that
     it must not follow the drag */
  check('...the case only: the view does not turn with it', Math.abs(mid.y - pose.y) <= 6, mid.y + ' vs ' + pose.y);
  await mouse('mouseReleased', bare[0] + 220, bare[1] - 40);
  await cdp.sleep(900);
  const settled = await ev('DEFUSAL.casePose()');
  check('let go, it settles back', settled.turnX === 0 && settled.turnY === 0, JSON.stringify(settled));
  check('turning it put the hint away', await ev("document.getElementById('turn-hint').hidden"));
  check('...for good', (await ev("localStorage.getItem('defusal.turned')")) === '1');

  /* a drag that starts on a module is the module's */
  const mod = JSON.parse(await ev(`(function(){ var r = document.querySelector('.face.front .bay.module canvas.m3d').getBoundingClientRect(); return JSON.stringify([r.left + r.width / 2, r.top + r.height / 2]); })()`));
  await mouse('mousePressed', mod[0], mod[1]);
  for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', mod[0] + i * 20, mod[1]); await cdp.sleep(30); }
  check('a drag on a module does not turn the case', (await ev('DEFUSAL.casePose()')).turnY === 0);
  await mouse('mouseReleased', mod[0] + 160, mod[1]);
  await cdp.sleep(400);

  /* leaning in and zooming square it up */
  await ev("document.querySelector('.face.front .bay.module .zoom').click()"); await cdp.sleep(900);
  const lean = await ev('DEFUSAL.casePose()');
  check('leaning in on a module squares the case up', Math.abs(lean.x) < 6 && Math.abs(lean.y) < 6, JSON.stringify(lean));
  await ev("document.querySelector('.face.front .bay.module .zoom').click()"); await cdp.sleep(900);
  check('...and leaning back out turns it back', (await ev('DEFUSAL.casePose()')).y > 15);

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();

  /* with the room off, a plain square case */
  const q = await cdp.open('file://' + ROOT + '/index.html?intro=0&debug=1', { settle: 2500, w: 1440, h: 900 });
  await q.eval("localStorage.setItem('defusal.pref.room', JSON.stringify('off'))");
  await q.send('Page.reload'); await cdp.sleep(3000);
  await q.eval("DEFUSAL.startRound({ difficulty: 'insane', count: 8, seconds: 600, seed: 7 })");
  await cdp.sleep(6000);
  const flat = await q.eval('DEFUSAL.casePose()');
  check('room off: the case rests square', Math.abs(flat.x) < 6 && Math.abs(flat.y) < 6, JSON.stringify(flat));
  check('room off: the serial is on the face', await q.eval("getComputedStyle(document.getElementById('serial')).display !== 'none'"));
  check('room off: no turning hint', await q.eval("document.getElementById('turn-hint').hidden"));
  await q.close();

  console.log(fails ? `\n${fails} FAILED` : '\nCASE 3D CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
