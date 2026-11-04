'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const palette = require('../palette.js');

test('paleta z Figmy: 34 Primitives a 25 Semantics', () => {
  assert.equal(palette.primitives.length, 34);
  assert.equal(palette.semantics.length, 25);
  assert.deepEqual(palette.primitiveGroups.map((g) => g.group), ['Green', 'Grey', 'Beige', 'Neutral', 'Orange', 'Yellow', 'Blue']);
  assert.equal(palette.primitives.find((c) => c.name === 'green/500').hex, '#00A86B');
});

test('názvy jsou jedinečné a HEX ve tvaru #RRGGBB', () => {
  for (const list of [palette.primitives, palette.semantics]) {
    assert.equal(new Set(list.map((c) => c.name)).size, list.length);
    for (const c of list) assert.match(c.hex, /^#[0-9A-F]{6}$/, c.name);
  }
});

test('každá sémantická barva má hodnotu některého primitiva', () => {
  for (const s of palette.semantics) {
    assert.ok(s.primitive, s.name);
    assert.equal(palette.primitives.find((p) => p.name === s.primitive).hex, s.hex, s.name);
  }
});

test('skupiny a plochý seznam obsahují totéž', () => {
  const names = (groups) => groups.flatMap((g) => g.colors.map((c) => c[0]));
  assert.deepEqual(names(palette.primitiveGroups), palette.primitives.map((c) => c.name));
  assert.deepEqual(names(palette.semanticGroups), palette.semantics.map((c) => c.name));
});
