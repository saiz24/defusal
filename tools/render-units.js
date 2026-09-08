/* Render one Unit Conversions round per instrument type (and a thin triangle)
   so the instrument artwork can be checked:  node tools/render-units.js */
var fs = require('fs'), path = require('path'), vm = require('vm');
var shim = require('./dom-shim.js');
var root = path.join(__dirname, '..');
var out = path.join(root, 'tools', 'preview');
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

function write(name, svg) {
  var vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  var side = Math.max(vb[2], vb[3]);
  var pad = [vb[0] - (side - vb[2]) / 2, vb[1] - (side - vb[3]) / 2, side, side];
  var body = svg.childNodes.map(shim.serialize).join('');
  fs.writeFileSync(path.join(out, name),
    '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' +
    (side * 2) + '" height="' + (side * 2) + '" viewBox="' + pad.join(' ') +
    '"><style>text{font-family:ui-monospace,Menlo,monospace}</style>' +
    '<rect x="' + pad[0] + '" y="' + pad[1] + '" width="' + side + '" height="' +
    side + '" fill="#0f1416"/>' + body + '</svg>');
}

function mount(def, puzzle, mctx) {
  var solution = def.solve(puzzle, mctx);
  var host = doc.createElement('div');
  var inst = { puzzle: puzzle, solution: solution, ctx: mctx, solved: false,
    isSolved: function () { return false; }, solve: function () {},
    strike: function () {}, onSolved: null, cleanup: null };
  def.mount(host, inst);
  if (inst.cleanup) inst.cleanup();
  return { host: host, solution: solution };
}

var units = D.byId.units, rng = D.makeRng(1234);
var serial = D.makeSerial(rng);
var mctx = { serial: serial, serialInfo: D.serialInfo(serial) };
var want = { dial: 'C', cylinder: 'D', ruler: 'B' }, done = {};
for (var i = 0; i < 40000 && Object.keys(done).length < 3; i++) {
  var p = units.generate(rng, mctx);
  if (done[p.instrument] || want[p.instrument] !== p.layout) continue;
  done[p.instrument] = true;
  var r = mount(units, p, mctx);
  r.host.querySelectorAll('svg').forEach(function (svg, k) {
    write('inst-' + p.instrument + '-' + (k + 1) + '.svg', svg);
  });
  console.log(p.instrument, units.debugText(p), 'grid', p.grid.max + '/' + p.grid.step);
}

/* a deliberately thin triangle, the worst case for label placement */
var tri = D.byId.triangles;
var thin = { angles: [10, 90, 80], order: ['blue', 'red', 'green'] };
write('triangles-thin.svg', mount(tri, thin, mctx).host.querySelector('svg'));
var wide = { angles: [60, 60, 60], order: ['red', 'green', 'blue'] };
write('triangles-equi.svg', mount(tri, wide, mctx).host.querySelector('svg'));
console.log('done');
