#!/usr/bin/env python3
"""
Assert the PRINTED MANUAL agrees with the CODE.

The manual is the expert's only source of truth, so a number that drifts
between the two is not a typo — it is a module the players cannot solve. This
happened once already: the metric charts for length and volume were written in
metres and litres while the American charts beside them were in centimetres
and millilitres, which put every cross-system conversion out by 100x or 1000x
and went unnoticed because same-system rounds cancel the error.

Run:  python3 tools/check-manual.py [path/to/DEFUSAL.docx]
"""
import json, os, re, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DOCX = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(ROOT), 'DEFUSAL.docx')

fails = []
def check(label, got, want):
    if got == want:
        print('  ok   %s' % label)
    else:
        print('  FAIL %s\n         manual: %r\n         code:   %r' % (label, got, want))
        fails.append(label)

def manual_text(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf8')
    xml = re.sub(r'</w:p>', '\n', xml)
    txt = re.sub(r'<[^>]+>', '', xml)
    # word uses assorted spaces inside grouped numbers
    return txt.replace(' ', ' ').replace(' ', ' ').replace(' ', ' ')

def num_after(txt, word):
    """The number in the parentheses following `word`, e.g. 'metre (100)' -> 100.0.
    The lookbehind matters: without it 'metre' finds 'centimetre', 'gram' finds
    'milligram' and 'litre' finds 'millilitre', and the check silently reads the
    wrong row."""
    m = re.search(r'(?<![A-Za-z])' + re.escape(word) + r'\s*\(\s*([0-9][0-9\s.,]*)\)', txt)
    if not m:
        return None
    return float(re.sub(r'[\s,]', '', m.group(1)))


def section(txt, module):
    """Just one module's text. 'Right' means something different in the Angles
    type table and in the Triangles direction diagrams."""
    parts = re.split(r'\nModule Difficulty: \w+\n', txt)
    for part in parts:
        if part.lstrip().startswith(module):
            return part
    return ''

def code_units():
    out = subprocess.check_output(['node', '-e', """
        global.DEFUSAL = require('./js/core.js');
        eval(require('fs').readFileSync('js/modules/units.js','utf8'));
        console.log(JSON.stringify(DEFUSAL.byId.units._internals.CATS));
    """], cwd=ROOT)
    return json.loads(out.decode('utf8'))

def code_const(module, name):
    src = open(os.path.join(ROOT, 'js', 'modules', module), encoding='utf8').read()
    m = re.search(r'var\s+' + name + r'\s*=\s*\{(.*?)\}\s*;', src, re.S)
    if not m:
        return {}
    body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
    out = {}
    for k, v in re.findall(r"([A-Za-z_]+)\s*:\s*([0-9]+)", body):
        out[k] = int(v)
    return out

txt = manual_text(DOCX)
print('checking %s\n' % os.path.basename(DOCX))

# ---------------------------------------------------------------- unit charts
print('UNIT CONVERSIONS — unit charts')
CATS = code_units()
NAMES = {
    'length': {'metric': ['centimetre', 'metre', 'kilometre'],
               'us': ['inch', 'foot', 'yard']},
    'mass':   {'metric': ['milligram', 'gram', 'kilogram'],
               'us': ['ounce', 'pound', 'ton']},
    'volume': {'metric': ['millilitre', 'litre', 'kilolitre'],
               'us': ['cup', 'quart', 'gallon']},
}
for cat in ('length', 'mass', 'volume'):
    for system in ('metric', 'us'):
        for size, word in zip(('small', 'middle', 'large'), NAMES[cat][system]):
            check('%s %s %s' % (cat, system, word),
                  num_after(txt, word), float(CATS[cat][system][size]))

# the base-unit sentence must name the unit whose value is 1
print('\nUNIT CONVERSIONS — base units')
for cat, word in (('length', 'centimetre'), ('mass', 'gram'), ('volume', 'millilitre')):
    check('%s base unit is %s' % (cat, word), 1.0, float(CATS[cat]['metric'][
        [k for k, v in CATS[cat]['metric'].items() if v == 1][0]]))
    if not re.search(word + r'[^.]{0,80}for ' + cat, txt) and \
       not re.search(r'the ' + word, txt):
        fails.append('%s base-unit sentence missing %s' % (cat, word))

# ------------------------------------------------------------- angle digits
print('\nANGLES — digit table')
DIGIT = code_const('angles.js', 'DIGIT')
angles = section(txt, 'Angles')
for name, digit in sorted(DIGIT.items()):
    m = re.search(r'\n' + name.capitalize() + r'\n[^\n]*\n(\d)\n', angles)
    check('%s' % name, int(m.group(1)) if m else None, digit)

# -------------------------------------------------------- mutex place values
print('\nMUTUALLY EXCLUSIVE EVENTS — place values')
pv = re.search(r'Place value\n8\n4\n2\n1\n', txt)
check('place values 8 4 2 1', bool(pv), True)

# ----------------------------------------------------------- unique taglines
print('\nMANUAL — taglines are distinct')
tags = re.findall(r'\nModule Difficulty: \w+\n([^\n]+)\n([^\n]+)\n', txt)
seen, dupes = {}, []
for name, line in tags:
    if line in seen:
        dupes.append('%s shares its tagline with %s' % (name, seen[line]))
    seen[line] = name
check('8 modules found', len(tags), 8)
check('no duplicate taglines', dupes, [])

print('')
if fails:
    print('MANUAL CHECK FAILED — %d problem(s)' % len(fails))
    sys.exit(1)
print('MANUAL CHECK PASSED')
