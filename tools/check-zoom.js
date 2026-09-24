/* node tools/check-zoom.js — drives real wheel, drag, key and Ctrl+wheel
   input through headless Chrome and checks the case and manual zoom. */
const cdp = require('./cdp.js');
const OUT = process.env.OUT;
function scaleOf(t){ const m=/scale\(([\d.]+)\)/.exec(t); return m?Number(m[1]):NaN; }
function panOf(t){ const m=/translate\(calc\(-50% ([+-]) ([\d.]+)px\), calc\(-50% ([+-]) ([\d.]+)px\)\)/.exec(t); if(m) return [(m[1]==='-'?-1:1)*Number(m[2]),(m[3]==='-'?-1:1)*Number(m[4])]; if(/translate\(-50%, -50%\)/.test(t)) return [0,0]; return null; }
let fails=0; function check(name, ok, info){ console.log((ok?'ok   ':'FAIL ')+name+(info?'  '+info:'')); if(!ok) fails++; }
(async () => {
  const p = await cdp.open('file://' + require('path').join(__dirname, '..', 'index.html') + '?intro=0&mode=solo&start=hard&seed=99', { settle: 6000 });
  const T = () => p.eval("document.getElementById('bomb').style.transform");
  const wheel = (x,y,dy,mods) => p.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:dy,modifiers:mods||0});
  // bomb pane centre
  const r = JSON.parse(await p.eval("JSON.stringify(document.getElementById('screen-game').getBoundingClientRect())"));
  const cx = r.x + r.width/2, cy = r.y + r.height/2;
  const t0 = await T(); const s0 = scaleOf(t0);
  // point under cursor: find bay module element rect before
  const probe = async (x,y) => p.eval(`(function(){var bs=document.querySelectorAll('.face.front .bay');for(var i=0;i<bs.length;i++){var r=bs[i].getBoundingClientRect();if(${x}>=r.left&&${x}<=r.right&&${y}>=r.top&&${y}<=r.bottom)return i+'@'+((${x}-r.left)/r.width).toFixed(2)+','+((${y}-r.top)/r.height).toFixed(2);}return 'none'})()`);
  const px = cx + 60, py = cy + 40;
  const before = await probe(px,py);
  for (let i=0;i<4;i++){ await wheel(px,py,-100); await cdp.sleep(60); }
  await cdp.sleep(300);
  const t1 = await T(); const s1 = scaleOf(t1); 
  check('plain wheel zooms case in', s1 > s0*1.5, s0.toFixed(3)+' -> '+s1.toFixed(3));
  const after = await probe(px,py);
  const fr = t => t.split('@'); const [b0,f0]=fr(before), [b1,f1]=fr(after);
  const d = f0&&f1 ? Math.max(...f0.split(',').map((v,i)=>Math.abs(Number(v)-Number(f1.split(',')[i])))) : 1;
  check('point under cursor stays put (same bay, <4% drift)', b0===b1 && b0!=='none' && d<0.04, before+' / '+after);
  check('zoom button shows reset state', await p.eval("document.getElementById('wide-btn').classList.contains('on')"));
  // drag pan
  const pan0 = panOf(t1);
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:cx-200,y:cy-150,button:'left',clickCount:1});
  for (let i=1;i<=6;i++){ await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:cx-200+i*15,y:cy-150+i*8,button:'left',buttons:1}); await cdp.sleep(20); }
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:cx-110,y:cy-102,button:'left',clickCount:1});
  await cdp.sleep(200);
  const pan1 = panOf(await T());
  check('drag pans zoomed case', pan1 && pan0 && Math.abs(pan1[0]-pan0[0]-90)<2 && Math.abs(pan1[1]-pan0[1]-48)<2, JSON.stringify(pan0)+' -> '+JSON.stringify(pan1));
  if (OUT) await p.shot(OUT+'/zoomed.png');
  // zoom out beyond min clamps
  for (let i=0;i<30;i++){ await wheel(cx,cy,300); }
  await cdp.sleep(300);
  const s2 = scaleOf(await T());
  check('zoom out clamps at 0.5x of fit', Math.abs(s2 - s0*0.5) < 0.01, s2.toFixed(3));
  const pan2 = panOf(await T());
  check('pulled back view recentres', pan2 && pan2[0]===0 && pan2[1]===0, JSON.stringify(pan2));
  // key 0 resets
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',text:'0'});
  await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',code:'Digit0'});
  await cdp.sleep(700);
  check('key 0 resets view', Math.abs(scaleOf(await T())-s0)<0.001);
  // + key
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'+',code:'Equal',text:'+'});
  await cdp.sleep(200);
  check('+ key zooms in', scaleOf(await T())>s0*1.1);
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',text:'0'}); await cdp.sleep(600);
  // ctrl-wheel = pinch path
  await wheel(cx,cy,-20,2); await cdp.sleep(200);
  check('ctrl+wheel (trackpad pinch) zooms case', scaleOf(await T())>s0*1.1);
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',code:'Digit0',text:'0'}); await cdp.sleep(600);
  // a plain click on a module button still works (no pan eats it)
  const clicked = await p.eval(`(function(){var b=document.querySelector('.face.front .bay.module button, .face.front .bay.module .hit');if(!b)return 'none';var r=b.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
  if (clicked!=='none'){ const [bx,by]=JSON.parse(clicked);
    await p.eval("window.__clicks=0;document.addEventListener('click',function(){window.__clicks++},true)");
    await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:bx,y:by,button:'left',clickCount:1});
    await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:bx,y:by,button:'left',clickCount:1});
    await cdp.sleep(150);
    check('click on module control still delivered', (await p.eval('window.__clicks'))===1);
  }
  // manual: plain wheel scrolls, ctrl-wheel zooms
  const mr = JSON.parse(await p.eval("JSON.stringify(document.querySelector('#play-manual .mv-paper').getBoundingClientRect())"));
  const mx = mr.x+mr.width/2, my = mr.y+mr.height/2;
  const st0 = await p.eval("document.querySelector('#play-manual .mv-paper').scrollTop");
  await wheel(mx,my,300); await cdp.sleep(400);
  const st1 = await p.eval("document.querySelector('#play-manual .mv-paper').scrollTop");
  check('plain wheel scrolls manual', st1>st0, st0+' -> '+st1);
  check('plain wheel leaves manual size alone', (await p.eval("document.querySelector('#play-manual .mv-sheet').style.zoom"))==='1');
  const word = async () => p.eval(`(function(){var r=document.caretRangeFromPoint(${mx},${my});return r?r.startContainer.textContent.slice(0,30):''})()`);
  const w0 = await word();
  for (let i=0;i<5;i++){ await wheel(mx,my,-30,2); await cdp.sleep(40); }
  await cdp.sleep(300);
  const z = Number(await p.eval("document.querySelector('#play-manual .mv-sheet').style.zoom"));
  check('ctrl+wheel zooms manual text', z>1.3, 'zoom '+z);
  const w1 = await word();
  check('text under cursor stays put', w0===w1, JSON.stringify(w0)+' / '+JSON.stringify(w1));
  const sw = await p.eval("(function(){var e=document.querySelector('#play-manual .mv-paper');return e.scrollWidth<=e.clientWidth+1})()");
  check('manual reflows (no sideways scroll)', sw);
  check('readout shows %', /%$/.test(await p.eval("document.querySelector('#play-manual .mv-zval').textContent")));
  check('size remembered', Number(await p.eval("localStorage.getItem('defusal.manualZoom')"))===z);
  if (OUT) await p.shot(OUT+'/manual-zoomed.png');
  await p.eval("document.querySelector('#play-manual .mv-zval').click()"); await cdp.sleep(200);
  check('readout click resets to 100%', (await p.eval("document.querySelector('#play-manual .mv-sheet').style.zoom"))==='1');
  const ex = p.logs.filter(l=>/EXCEPTION/.test(l));
  check('no exceptions', ex.length===0, ex.join(' | '));
  await p.close();
  console.log(fails? fails+' FAILED':'ZOOM CHECK PASSED');
  process.exit(fails?1:0);
})();
