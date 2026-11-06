'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Swatches = require('../swatches.js');
const Brand = require('../brand.js');
const palette = require('../palette.js');

const groups = Swatches.groups(Brand.COLORS, palette.primitiveGroups, palette.semanticGroups);

test('vzorník: stejné skupiny jako stránka Barvy – logo, Primitives, Semantics', () => {
  assert.deepEqual(groups.filter((g) => g.section).map((g) => g.section), ['Logo', 'Primitives', 'Semantics']);
  assert.deepEqual(groups.map((g) => g.name), ['',
    'Green', 'Grey', 'Beige', 'Neutral', 'Orange', 'Yellow', 'Blue',
    'Text · Neutral', 'Text · Brand', 'Text · Inverse', 'Ikony', 'Pozadí', 'Ohraničení', 'Akce', 'Gradienty']);
  assert.deepEqual(groups[0].colors.map((c) => c.hex), Brand.COLORS);
});

test('vzorník obsahuje každou barvu loga, každé primitivum i každou sémantickou barvu', () => {
  const all = groups.flatMap((g) => g.colors);
  for (const hex of Brand.COLORS) assert.ok(all.some((c) => c.hex === hex), hex);
  for (const c of [...palette.primitives, ...palette.semantics]) assert.ok(all.some((x) => x.name === c.name && x.hex === c.hex), c.name);
  assert.equal(all.length, Brand.COLORS.length + palette.primitives.length + palette.semantics.length);
});

test('nameOf: názvy z palety, u barev loga a cizích barev prázdný název', () => {
  assert.equal(Swatches.nameOf('#00A86B', groups), 'green/500');
  assert.equal(Swatches.nameOf('#00a86b', groups), 'green/500', 'nezáleží na velikosti písmen');
  assert.equal(Swatches.nameOf('#FFFFFF', groups), 'neutral/0', 'bílá je v logu i v paletě, přednost má název z palety');
  assert.equal(Swatches.nameOf('#00633F', groups), 'green/600', 'u stejné hodnoty vyhraje primitivum před sémantickou barvou');
  assert.equal(Swatches.nameOf('#004B32', groups), 'green/800', 'tmavá zelená loga je i v paletě');
  assert.equal(Swatches.nameOf('#000000', groups), '');
  assert.equal(Swatches.nameOf('#123456', groups), '');
});

test('norm: sjednotí zápis HEX a neplatné hodnoty vrátí prázdné', () => {
  assert.equal(Swatches.norm('#abc'), '#AABBCC');
  assert.equal(Swatches.norm(' #a5e5b2 '), '#A5E5B2');
  assert.equal(Swatches.norm('zelená'), '');
  assert.equal(Swatches.norm(undefined), '');
});
