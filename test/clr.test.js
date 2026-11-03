'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseClr, ClrError } = require('../scripts/clr.js');
const { build, hex, SOURCES } = require('../scripts/build-palette.js');
const palette = require('../palette.js');

const ROOT = path.join(__dirname, '..');
const read = (file) => parseClr(fs.readFileSync(path.join(ROOT, file)));
const primitives = read(SOURCES.primitives);
const semantics = read(SOURCES.semantics);
const byName = (list, name) => list.find((c) => c.name === name);

test('primitives: 54 barev ve známých rodinách', () => {
  assert.equal(primitives.length, 54);
  const families = [...new Set(primitives.map((c) => c.name.split('/')[0]))];
  assert.deepEqual(families, ['green', 'blue', 'grey', 'beige', 'yellow', 'orange', 'neutral']);
  assert.equal(hex(byName(primitives, 'green/900').rgba), '#053120');
  assert.equal(hex(byName(primitives, 'neutral/0').rgba), '#FFFFFF');
});

test('semantics: 31 barev a každá odkazuje na přesně stejné primitivum', () => {
  assert.equal(semantics.length, 31);
  for (const s of semantics) {
    const match = primitives.find((p) => p.rgba.every((v, i) => v === s.rgba[i]));
    assert.ok(match, `${s.name} nemá odpovídající primitivum`);
  }
  assert.deepEqual(byName(semantics, 'text/brand/strong').rgba, byName(primitives, 'green/900').rgba);
});

test('názvy barev jsou v každé paletě jedinečné a barvy plně krycí v kalibrovaném RGB', () => {
  for (const list of [primitives, semantics]) {
    assert.equal(new Set(list.map((c) => c.name)).size, list.length);
    for (const c of list) {
      assert.equal(c.space, 1, c.name);
      assert.equal(c.rgba[3], 1, c.name);
      assert.ok(c.rgba.every((v) => v >= 0 && v <= 1), c.name);
    }
  }
});

test('parser odmítne soubor, který není typedstream', () => {
  assert.throws(() => parseClr(Buffer.from('nesmysl')), ClrError);
  const cut = fs.readFileSync(path.join(ROOT, SOURCES.semantics)).subarray(0, 200);
  assert.throws(() => parseClr(cut));
});

test('palette.js odpovídá .clr souborům (po změně palety spusť node scripts/build-palette.js)', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'palette.js'), 'utf8'), build());
});

test('palette.js: HEX hodnoty a odkazy sedí', () => {
  assert.equal(palette.primitives.length, 54);
  assert.equal(palette.semantics.length, 31);
  for (const c of [...palette.primitives, ...palette.semantics]) assert.match(c.hex, /^#[0-9A-F]{6}$/);
  const hexOf = (name) => palette.primitives.find((p) => p.name === name).hex;
  for (const s of palette.semantics) assert.equal(hexOf(s.primitive), s.hex, s.name);
});
