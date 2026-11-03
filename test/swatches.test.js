'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Swatches = require('../swatches.js');
const Brand = require('../brand.js');
const palette = require('../palette.js');

const groups = Swatches.groups(Brand.COLORS, palette.primitives);

test('vzorník: nejdřív logo, pak rodiny z palety v pořadí souboru', () => {
  assert.deepEqual(groups.map((g) => g.name), ['Logo', 'green', 'blue', 'grey', 'beige', 'yellow', 'orange', 'neutral']);
  assert.deepEqual(groups[0].colors.map((c) => c.hex), Brand.COLORS);
});

test('vzorník obsahuje každou barvu loga i každé primitivum', () => {
  const hexes = groups.flatMap((g) => g.colors.map((c) => c.hex));
  for (const hex of Brand.COLORS) assert.ok(hexes.includes(hex), hex);
  for (const c of palette.primitives) assert.ok(groups.some((g) => g.colors.some((x) => x.name === c.name && x.hex === c.hex)), c.name);
  assert.equal(hexes.length, Brand.COLORS.length + palette.primitives.length);
});

test('nameOf: názvy z palety, u barev loga a cizích barev prázdný název', () => {
  assert.equal(Swatches.nameOf('#149B58', groups), 'green/500');
  assert.equal(Swatches.nameOf('#149b58', groups), 'green/500', 'nezáleží na velikosti písmen');
  assert.equal(Swatches.nameOf('#FFFFFF', groups), 'neutral/0', 'bílá je v logu i v paletě, přednost má název z palety');
  assert.equal(Swatches.nameOf('#004B32', groups), '');
  assert.equal(Swatches.nameOf('#123456', groups), '');
});

test('norm: sjednotí zápis HEX a neplatné hodnoty vrátí prázdné', () => {
  assert.equal(Swatches.norm('#abc'), '#AABBCC');
  assert.equal(Swatches.norm(' #a5e5b2 '), '#A5E5B2');
  assert.equal(Swatches.norm('zelená'), '');
  assert.equal(Swatches.norm(undefined), '');
});
