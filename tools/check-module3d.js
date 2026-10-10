/* CDP_GL=1 node tools/check-module3d.js [module...]
   Every module rebuilt in 3D, played with real input in headless Chrome
   (software WebGL). For each: deal a device that carries it, turn the case
   over if it is on the back, check the 3D version is the one mounted and
   that it is drawn, lean in on it, give one wrong answer (it must strike),
   then the right one — real clicks on its 3D keys, real typing in its boxes
   — and it must solve. A close-up of each goes to tools/shots/m3d-<id>.png.
   M3D_REST=1 does the same without leaning in, on the angled case. */
'use strict';
process.env.CDP_GL = process.env.CDP_GL || '1';
const cdp = require('./cdp.js'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'shots');
let fails = 0;
function check(name, ok, info) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : ''));
  if (!ok) fails++;
}
const ALL = ['rationality', 'triangles', 'parallel', 'venn', 'angles', 'sequences', 'mutex', 'units'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const p = await cdp.open('file://' + ROOT + '/index.html?intro=0&debug=1', { settle: 2500, w: 1440, h: 900 });
  const ev = e => p.eval(e);
  check('3D modules available', await ev('DEFUSAL.module3d.available()'));

  const click = async (xy, what) => {
    if (!xy) { check('found ' + what, false); return; }
    await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: xy[0], y: xy[1] });
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: xy[0], y: xy[1], button: 'left', buttons: 1, clickCount: 1 });
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: xy[0], y: xy[1], button: 'left', clickCount: 1 });
    await cdp.sleep(240);
  };
  const key = async (token) => click(await ev(`__bay.querySelector('canvas.m3d').__keys(${JSON.stringify(token)})`), 'key ' + token);
  const type = async (values) => {
    for (let i = 0; i < values.length; i++) {
      const xy = await ev(`(function(){var b=__bay.querySelector('canvas.m3d').__inputs[${i}].getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
      await click(xy, 'input ' + i);
      await ev(`__bay.querySelector('canvas.m3d').__inputs[${i}].value=''`);
      await p.send('Input.insertText', { text: String(values[i]) });
    }
    await key('enter');
  };
  const strikes = () => ev("document.querySelectorAll('.face.front .strike-row i.lit').length");

  /* the right answer, and one wrong one, for each module, from its solution */
  const PLAY = {
    rationality: { win: async (s) => { for (const c of s.sequence) await key(c); },
                   lose: async (s, p2) => key(p2.arrangement.find(c => c !== s.sequence[0])) },
    triangles:   { win: async (s) => { for (const t of s.presses) await key(t); },
                   lose: async (s, p2) => key(p2.order.find(c => c !== s.presses[0])) },
    parallel:    { win: async (s) => { for (const n of s.order) await key(n); },
                   lose: async (s) => key([1, 2, 3, 4, 5, 6, 7, 8].find(n => n !== s.order[0])) },
    venn:        { win: async (s) => { if (s.empty) await key('null'); else for (const n of s.target) await key(n); },
                   lose: async (s, p2) => { if (s.empty) { const any = Object.keys(p2.regions).map(r => p2.regions[r]).flat()[0]; await key(any); } else await key('null'); } },
    angles:      { win: async (s) => pressAngles(s, true), lose: async (s) => pressAngles(s, false) },
    sequences:   { win: async (s) => type([s.missing, s.boxTwo]), lose: async (s) => type([s.missing + 1, s.boxTwo]) },
    mutex:       { win: async (s) => type([s.value]), lose: async (s) => type([(s.value + 1) % 16]) },
    units:       { win: async (s) => type([s.answer]), lose: async (s) => type([s.answer + 1]) }
  };
  async function pressAngles(s, wantWin) {
    for (let i = 0; i < 40; i++) {
      const shown = await ev("__bay.querySelector('.m3d-src .swatch-word').textContent");
      if ((shown === s.color.toUpperCase()) === wantWin) { await key('press'); return; }
      await cdp.sleep(500);
    }
    check('angles reached the ' + (wantWin ? 'target' : 'other') + ' colour', false);
  }

  for (const id of want) {
    console.log('\n' + id);
    let found = false;
    for (let seed = 1; seed < 120 && !found; seed++) {
      await ev(`DEFUSAL.startRound({difficulty:'insane',count:8,seconds:600,seed:${seed}})`);
      await cdp.sleep(200);
      found = await ev(`(function(){var b=[].filter.call(document.querySelectorAll('.bay.module'),function(b){return b.__instance&&b.__instance.id===${JSON.stringify(id)}})[0]; if(!b) return false; window.__bay=b; return true;})()`);
    }
    check(id + ': found on a device', found);
    if (!found) continue;
    await cdp.sleep(4500);
    if (await ev("!!__bay.closest('.face.back')")) { await ev("document.querySelector('[data-flip]').click()"); await cdp.sleep(1400); }
    check(id + ': 3D version mounted', await ev("!!__bay.querySelector('canvas.m3d')"));
    /* the 2D view shows until the 3D one is built and its shaders compiled
       in the background — slow on software WebGL, so wait for it */
    for (let i = 0; i < 60 && await ev("!!__bay.querySelector('.m3d-pending')"); i++) await cdp.sleep(200);
    await cdp.sleep(300);
    const drawn = await ev(`(function(){var c=__bay.querySelector('canvas.m3d'); if(!c) return 0; var x=c.getContext('2d').getImageData(0,0,c.width,c.height).data,n=0;for(var i=3;i<x.length;i+=16)if(x[i]>0)n++;return n;})()`);
    check(id + ': drawn', drawn > 1000, drawn + ' samples');
    /* M3D_REST=1 plays it where it sits, on the case turned and tipped at
       rest: every click goes through the module's off-axis camera */
    if (!process.env.M3D_REST) { await ev("__bay.querySelector('.zoom').click()"); await cdp.sleep(1000); }
    else await cdp.sleep(900);
    await p.shot(path.join(OUT, 'm3d-' + id + (process.env.M3D_REST ? '-rest' : '') + '.png'));
    const s = await ev('__bay.__instance.solution'), pz = await ev('__bay.__instance.puzzle');
    const s0 = await strikes();
    await PLAY[id].lose(s, pz);
    await cdp.sleep(400);
    check(id + ': a wrong answer strikes', (await strikes()) === s0 + 1);
    await PLAY[id].win(s, pz);
    await cdp.sleep(500);
    check(id + ': the right answer solves', await ev("__bay.classList.contains('solved')"));
  }

  const ex = p.logs.filter(l => /EXCEPTION|module3d /.test(l));
  check('no exceptions', ex.length === 0, ex.slice(0, 3).join(' | '));
  await p.close();
  console.log(fails ? `\n${fails} FAILED` : '\nMODULE 3D CHECK PASSED');
  process.exit(fails ? 1 : 0);
})();
