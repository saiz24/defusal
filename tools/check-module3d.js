/* CDP_GL=1 node tools/check-module3d.js
   The modules rebuilt in 3D, played with real mouse clicks in headless
   Chrome (software WebGL): the 3D version is the one mounted, a wrong key
   strikes, the right order solves, and the picture is drawn. Writes
   tools/shots/m3d-*.png to look at. */
'use strict';
process.env.CDP_GL = process.env.CDP_GL || '1';
const cdp = require('./cdp.js'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'shots');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const p = await cdp.open('file://' + ROOT + '/index.html?intro=0&debug=1', { settle: 2500, w: 1440, h: 900 });
  const ev = e => p.eval(e);
  check('3D modules available', await ev('DEFUSAL.module3d.available()'));

  /* deal devices until one carries the module */
  let found = false;
  for (let seed = 1; seed < 60 && !found; seed++) {
    await ev(`DEFUSAL.startRound({difficulty:'insane',count:8,seconds:600,seed:${seed}})`);
    await cdp.sleep(300);
    found = await ev(`(function(){var b=[].filter.call(document.querySelectorAll('.face.front .bay.module'),function(b){return b.__instance&&b.__instance.id==='rationality'})[0]; if(!b) return false; window.__bay=b; return true;})()`);
  }
  check('found a device with Rationality on its front', found);
  if (!found) { await p.close(); process.exit(1); }
  await cdp.sleep(5000);           /* let the arming finish */

  check('the 3D version is mounted', await ev("!!__bay.querySelector('canvas.m3d') && !__bay.querySelector('.body svg.art')"));
  const drawn = await ev(`(function(){var c=__bay.querySelector('canvas.m3d'),x=c.getContext('2d').getImageData(0,0,c.width,c.height).data,n=0;for(var i=3;i<x.length;i+=16)if(x[i]>0)n++;return n;})()`);
  check('the module is drawn', drawn > 1000, drawn + ' opaque samples');
  await p.shot(path.join(OUT, 'm3d-case.png'));

  const seq = await ev('__bay.__instance.solution.sequence');
  const arr = await ev('__bay.__instance.puzzle.arrangement');
  const click = async (xy) => {
    await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: xy[0], y: xy[1] });
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: xy[0], y: xy[1], button: 'left', buttons: 1, clickCount: 1 });
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: xy[0], y: xy[1], button: 'left', clickCount: 1 });
    await cdp.sleep(260);
  };
  const keyAt = c => ev(`__bay.querySelector('canvas.m3d').__keys('${c}')`);
  const strikes0 = await ev("document.querySelectorAll('.face.front .strike-row i.lit').length");
  const wrong = arr.find(c => c !== seq[0]);
  await click(await keyAt(wrong));
  await cdp.sleep(300);
  check('a wrong key strikes', (await ev("document.querySelectorAll('.face.front .strike-row i.lit').length")) === strikes0 + 1);

  /* lean in on it and play the right order there, the way a player would */
  await ev("__bay.querySelector('.zoom').click()");
  await cdp.sleep(900);
  await p.shot(path.join(OUT, 'm3d-focused.png'));
  for (const c of seq) await click(await keyAt(c));
  await cdp.sleep(400);
  check('the right order solves it', await ev("__bay.classList.contains('solved')"), seq.join(' '));

  const ex = p.logs.filter(l => /EXCEPTION/.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();
  console.log(fails ? `\n${fails} FAILED` : '\nMODULE 3D CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
