'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Brand = require('../brand.js');

const logo = fs.readFileSync(path.join(__dirname, '..', 'assets', 'Logo.svg'), 'utf8');

test('barvy: normalizace, převod na RGB a zpět', () => {
  assert.equal(Brand.normalizeHex('#00a86b'), '#00A86B');
  assert.equal(Brand.normalizeHex('fff'), '#FFFFFF');
  assert.deepEqual(Brand.hexToRgb('#004B32'), [0, 75, 50]);
  assert.equal(Brand.rgbToHex(0, 149, 78), '#00954E');
  assert.throws(() => Brand.normalizeHex('#12345'));
});

test('světlá loga se kreslí na tmavém podkladu, tmavá a zelená ne', () => {
  assert.equal(Brand.isLight('#FFFFFF'), true);
  assert.equal(Brand.isLight('#000000'), false);
  assert.equal(Brand.isLight('#004B32'), false);
  assert.equal(Brand.isLight('#00A86B'), false);
});

test('usedColors přečte výplň z původního loga', () => {
  assert.deepEqual(Brand.usedColors(logo), ['#00954E']);
});

test('recolor přebarví každou výplň loga a nic jiného nezmění', () => {
  const fills = (logo.match(/fill:/g) || []).length;
  assert.ok(fills > 1, 'logo má víc cest');
  for (const hex of Brand.COLORS) {
    const out = Brand.recolor(logo, hex);
    assert.deepEqual(Brand.usedColors(out), [hex]);
    assert.equal((out.match(/fill:/g) || []).length, fills);
    assert.equal(out.replace(new RegExp(hex, 'g'), '#00954E').length, logo.replace(/fill:rgb\(0,149,78\)/g, 'fill:#00954E').length);
    assert.ok(out.includes('fill-rule:nonzero'));
  }
});

test('recolor nechává fill="none" a přebarví i atribut fill', () => {
  const svg = '<svg><path fill="none"/><path fill="#112233"/><path style="fill:rgb(1,2,3)"/></svg>';
  const out = Brand.recolor(svg, '#ffffff');
  assert.ok(out.includes('fill="none"'));
  assert.deepEqual(Brand.usedColors(out), ['#FFFFFF']);
});

test('stripProlog odřízne <?xml?> a DOCTYPE, ale zachová celé <svg>', () => {
  const out = Brand.stripProlog(logo);
  assert.ok(out.startsWith('<svg'));
  assert.ok(out.trimEnd().endsWith('</svg>'));
  assert.ok(!out.includes('<!DOCTYPE'));
});

test('název souboru vychází z assetu a barvy', () => {
  assert.equal(Brand.fileName('logo', '#004B32'), 'onkoradce-logo-004b32.svg');
});

test('logo má přesně požadované varianty', () => {
  assert.deepEqual(Brand.COLORS, ['#004B32', '#000000', '#FFFFFF', '#00A86B']);
  const asset = Brand.ASSETS.find((a) => a.id === 'logo');
  assert.deepEqual(asset.variants, Brand.COLORS);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', asset.file)));
});
