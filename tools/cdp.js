/* A small headless-Chrome driver over the DevTools protocol, for checks the
   one-shot --screenshot/--dump-dom flags cannot do: anything that has to wait
   on real time (offline audio rendering), or drive input (wheel, pinch).
   No dependencies — Node's own fetch and WebSocket.

     const cdp = require('./cdp.js');
     const page = await cdp.open('file:///.../index.html?start=easy', {w, h});
     await page.eval('1 + 1');            // → 2
     await page.send('Input.dispatchMouseEvent', {...});
     await page.shot('/tmp/x.png');
     await page.close();                                                    */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function open(url, opts) {
  opts = opts || {};
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(process.env.CDP_TMP || os.tmpdir(), 'cdp-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
    '--remote-debugging-port=' + port, '--user-data-dir=' + dir,
    '--window-size=' + (opts.w || 1440) + ',' + (opts.h || 900), 'about:blank'
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = list.find(t => t.type === 'page');
    } catch (e) {}
  }
  if (!target) { proc.kill(); throw new Error('chrome did not come up'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0; const wait = new Map(); const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) {
      const w = wait.get(m.id); wait.delete(m.id);
      m.error ? w.bad(new Error(m.error.message)) : w.ok(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(m.params.args.map(a => a.value).join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION ' + m.params.exceptionDetails.exception?.description);
    }
  };
  function send(method, params) {
    return new Promise((ok, bad) => {
      const n = ++id; wait.set(n, { ok, bad });
      ws.send(JSON.stringify({ id: n, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: opts.w || 1440, height: opts.h || 900,
    deviceScaleFactor: opts.dpr || 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(opts.settle === undefined ? 1500 : opts.settle);

  return {
    send, logs, sleep,
    async eval(expr) {
      const r = await send('Runtime.evaluate',
        { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    },
    async shot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async close() {
      try { ws.close(); } catch (e) {}
      proc.kill();
      await sleep(200);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    }
  };
}

module.exports = { open, sleep };
