/* node tools/measure-audio.js [volume]
   Renders every sound offline in headless Chrome and prints its peak and its
   loudest 100ms. See tools/measure-audio.html. */
const cdp = require('./cdp.js'), path = require('path');
(async () => {
  const vol = process.argv[2] || '1';
  const url = 'file://' + path.join(__dirname, 'measure-audio.html') + '?vol=' + vol;
  const p = await cdp.open(url, { settle: 500 });
  let out = '';
  for (let i = 0; i < 120; i++) {
    out = await p.eval("document.getElementById('out').textContent");
    if (/^vol=/.test(out) || /ERR/.test(out)) break;
    await cdp.sleep(250);
  }
  console.log(out.replace(/^running\n(rendering .*\n?)*/, ''));
  await p.close();
})();
