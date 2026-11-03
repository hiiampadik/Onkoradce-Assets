#!/usr/bin/env node
/*
 * Vygeneruje palette.js z barevných palet (.clr) v kořeni projektu:
 *
 *   node scripts/build-palette.js
 *
 * Web .clr za běhu nečte, používá hotový palette.js. Po změně palety v .clr
 * stačí skript pustit znovu (test hlídá, aby palette.js nezestárl).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseClr } = require('./clr.js');

const ROOT = path.join(__dirname, '..');
const SOURCES = {
  primitives: 'Onkoradce RGB Color Primitives.clr',
  semantics: 'Onkoradce RGB Color Semantics.clr'
};

const hex = (rgba) => '#' + rgba.slice(0, 3)
  .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
  .join('')
  .toUpperCase();

function load(file) {
  const colors = parseClr(fs.readFileSync(path.join(ROOT, file)));
  for (const c of colors) {
    if (c.space !== 1) throw new Error(`${file}: barva ${c.name} není v kalibrovaném RGB (prostor ${c.space})`);
    if (c.rgba[3] !== 1) throw new Error(`${file}: barva ${c.name} není plně krycí (alfa ${c.rgba[3]})`);
  }
  return colors;
}

function build() {
  const primitives = load(SOURCES.primitives);
  const semantics = load(SOURCES.semantics);

  // Sémantická barva odkazuje na primitivum, které má přesně stejnou hodnotu.
  const sameColor = (a, b) => a.rgba.every((v, i) => v === b.rgba[i]);

  const rows = (list, extra) => list.map((c) => '      ' + JSON.stringify({ name: c.name, hex: hex(c.rgba), ...extra(c) }));
  const primitiveRows = rows(primitives, () => ({}));
  const semanticRows = rows(semantics, (c) => {
    const p = primitives.find((q) => sameColor(c, q));
    return p ? { primitive: p.name } : {};
  });

  return `/*
 * Barvy z palet ${Object.values(SOURCES).map((s) => `„${s}“`).join(' a ')}.
 * Generováno: node scripts/build-palette.js. Needituj ručně, změň .clr a spusť skript znovu.
 */
(function (root) {
  'use strict';

  var palette = {
    primitives: [
${primitiveRows.join(',\n')}
    ],
    semantics: [
${semanticRows.join(',\n')}
    ]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = palette;
  else root.Palette = palette;
})(typeof window !== 'undefined' ? window : this);
`;
}

module.exports = { build, hex, SOURCES };

if (require.main === module) {
  const out = path.join(ROOT, 'palette.js');
  fs.writeFileSync(out, build());
  console.log('Zapsáno ' + path.relative(process.cwd(), out));
}
