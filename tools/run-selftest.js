/* headless runner: node tools/run-selftest.js [roundsPerModule] */
var fs = require('fs'), path = require('path'), vm = require('vm');
var root = path.join(__dirname, '..');
var files = [
  'js/core.js', 'js/audio.js', 'js/svg.js',
  'js/modules/cards.js', 'js/modules/sequences.js', 'js/modules/mutex.js',
  'js/modules/rationality.js', 'js/modules/parallel.js', 'js/modules/venn.js',
  'js/modules/triangles.js', 'js/modules/angles.js', 'js/modules/units.js',
  'js/modules/units-render.js', 'js/selftest.js'
];
var ctx = vm.createContext({
  console: console, Math: Math, Number: Number, String: String, Object: Object,
  Array: Array, JSON: JSON, Date: Date,
  document: { createElementNS: function () { return {}; } },
  module: undefined
});
files.forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
var rounds = Number(process.argv[2] || 500);
var report = vm.runInContext('DEFUSAL.selfTest(' + rounds + ', 20260831, function(m){console.log(m)})', ctx);
console.log('');
Object.keys(report.modules).forEach(function (id) {
  var m = report.modules[id];
  if (m.notes) console.log(id + ' notes:', JSON.stringify(m.notes));
});
console.log('');
if (report.ok) {
  console.log('SELF-TEST PASSED — ' + report.total + ' rounds');
} else {
  console.log('SELF-TEST FAILED');
  report.failures.slice(0, 30).forEach(function (f) { console.log('  ' + f); });
  process.exitCode = 1;
}
