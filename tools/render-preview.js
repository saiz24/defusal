/* Renders one round of every module to a standalone SVG so the artwork can be
   eyeballed without a browser:  node tools/render-preview.js [seed] */
var fs = require('fs'), path = require('path'), vm = require('vm');
var shim = require('./dom-shim.js');
var root = path.join(__dirname, '..');
var out = path.join(root, 'tools', 'preview');
fs.mkdirSync(out, { recursive: true });

var FILES = ['js/core.js', 'js/audio.js', 'js/svg.js', 'js/modules/cards.js',
  'js/modules/sequences.js', 'js/modules/mutex.js', 'js/modules/rationality.js',
  'js/modules/parallel.js', 'js/modules/venn.js', 'js/modules/triangles.js',
  'js/modules/angles.js', 'js/modules/units.js', 'js/modules/units-render.js'];

var doc = shim.makeDocument('');
var ctx = vm.createContext({
  console: console, Math: Math, Number: Number, String: String, Object: Object,
  Array: Array, JSON: JSON, RegExp: RegExp, Date: { now: function () { return 0; } },
  document: doc, setInterval: function () { return 0; }, clearInterval: function () {},
  setTimeout: function () { return 0; }
});
FILES.forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
var D = vm.runInContext('DEFUSAL', ctx);

var seed = Number(process.argv[2] || 5);
var rng = D.makeRng(seed);
var serial = D.makeSerial(rng);
var mctx = { serial: serial, serialInfo: D.serialInfo(serial) };
console.log('serial', serial, 'seed', seed);

var css = 'text{font-family:ui-monospace,Menlo,monospace}';

D.modules.forEach(function (def) {
  var puzzle = def.generate(rng, mctx);
  var solution = def.solve(puzzle, mctx);
  var host = doc.createElement('div');
  var inst = {
    puzzle: puzzle, solution: solution, ctx: mctx, solved: false,
    isSolved: function () { return false; }, solve: function () {},
    strike: function () {}, onSolved: null, cleanup: null
  };
  def.mount(host, inst);
  if (inst.cleanup) inst.cleanup();

  var svgs = host.querySelectorAll('svg');
  svgs.forEach(function (svg, i) {
    var vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    var body = svg.childNodes.map(shim.serialize).join('');
    /* square canvas: qlmanage rasterises to a square and crops otherwise */
    var side = Math.max(vb[2], vb[3]);
    var pad = [vb[0] - (side - vb[2]) / 2, vb[1] - (side - vb[3]) / 2, side, side];
    var doc2 = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="' + (side * 2) + '" height="' + (side * 2) + '" viewBox="' +
      pad.join(' ') + '"><style>' + css + '</style>' +
      '<rect x="' + pad[0] + '" y="' + pad[1] + '" width="' + side + '" height="' +
      side + '" fill="#0b0e10"/>' +
      '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' +
      vb[3] + '" fill="#171d20"/>' + body + '</svg>';
    var name = def.id + (svgs.length > 1 ? '-' + (i + 1) : '') + '.svg';
    fs.writeFileSync(path.join(out, name), doc2);
  });
  console.log(def.id.padEnd(12), def.debugText(puzzle, solution, mctx));
});
console.log('\nwrote', fs.readdirSync(out).length, 'files to tools/preview');
