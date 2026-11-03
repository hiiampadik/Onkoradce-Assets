'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../shape.js');

// Obrys → polyline (oblouky rozdělené na úsečky).
function flatten(o) {
  const pts = [];
  for (const c of o.corners) {
    if (c.r === 0) { pts.push([c.t1.x, c.t1.y]); continue; }
    const a1 = Math.atan2(c.t1.y - c.c.y, c.t1.x - c.c.x);
    const a2 = Math.atan2(c.t2.y - c.c.y, c.t2.x - c.c.x);
    let d = a2 - a1;
    if (c.sweep && d < 0) d += 2 * Math.PI;
    if (!c.sweep && d > 0) d -= 2 * Math.PI;
    const n = 24;
    for (let k = 0; k <= n; k++) {
      const a = a1 + (d * k) / n;
      pts.push([c.c.x + c.r * Math.cos(a), c.c.y + c.r * Math.sin(a)]);
    }
  }
  return pts;
}

function crosses(p1, p2, p3, p4) {
  const d = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

function selfIntersects(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

function rowCrossings(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
      xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
  }
  return xs.sort((p, q) => p - q);
}

test('obrys má 26 rohů a cesta je uzavřená a bez NaN', () => {
  const o = S.outline();
  assert.equal(o.corners.length, 26);
  const d = S.pathData(o);
  assert.ok(d.startsWith('M') && d.endsWith('Z'));
  assert.ok(!/NaN|Infinity/.test(d));
});

test('tvar má poměr 10:9 a obrys vyplňuje celý obdélník', () => {
  for (const height of [100, 400, 1000]) {
    const o = S.outline({ height });
    assert.ok(Math.abs(o.width / o.height - 10 / 9) < 1e-9);
    const pts = flatten(o);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...xs)) < 1e-6);
    assert.ok(Math.abs(Math.min(...ys)) < 1e-6);
    assert.ok(Math.abs(Math.max(...xs) - o.width) < 1e-6);
    assert.ok(Math.abs(Math.max(...ys) - o.height) < 1e-6);
  }
});

// Skutečná šířka horního svislého výřezu v obrysu (v polovině jeho hloubky).
function measuredCutWidth(params) {
  const o = S.outline(params);
  const y = o.params.depth * o.height / 2 / 2;
  const xs = rowCrossings(flatten(o), y);
  const cx = o.width / 2;
  const left = Math.max(...xs.filter((x) => x < cx));
  const right = Math.min(...xs.filter((x) => x > cx));
  return right - left;
}

test('šířka výřezu: při 1000 px je zadaná, při poloviční výšce 75 %, při čtvrtinové 0,75² atd.', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  for (const [height, factor] of [[1000, 1], [500, 0.75], [250, 0.75 ** 2], [125, 0.75 ** 3], [2000, 1 / 0.75]]) {
    assert.ok(near(S.cutWidthAt(height, 25), 25 * factor), `cutWidthAt(${height})`);
    assert.ok(near(measuredCutWidth({ height, cutWidth: 25 }), 25 * factor), `obrys při ${height} px`);
  }
});

test('šířka výřezu: mezi poloviční a plnou výškou roste plynule a 25 px je povolených', () => {
  const widths = [500, 600, 700, 800, 900, 1000].map((height) => S.outline({ height, cutWidth: 25 }).params.cutWidth);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] > widths[i - 1]);
  assert.equal(widths[widths.length - 1], 25);
  assert.equal(S.outline({ cutWidth: 25 }).params.cutWidth, 25, 'výchozí výška je 1000 px');
});

test('výchozí velikost je 1000 px', () => {
  assert.equal(S.DEFAULTS.height, 1000);
  assert.equal(S.outline().height, 1000);
});

test('konce výřezů jsou půlkruh (poloměr = polovina šířky)', () => {
  const o = S.outline({ cutWidth: 9 });
  const tips = o.corners.filter((c) => Math.abs(c.r - 4.5) < 1e-9);
  assert.equal(tips.length, 12);
});

test('hlavní rohy mají X a ústí výřezů 2·X', () => {
  const o = S.outline({ height: 400, radius: 0.05, cutWidth: 4 });
  const radii = o.corners.map((c) => c.r);
  assert.equal(radii.filter((r) => Math.abs(r - 20) < 1e-9).length, 2); // vpravo nahoře, vlevo dole
  assert.equal(radii.filter((r) => Math.abs(r - 40) < 1e-9).length, 12);
});

test('obrys je středově souměrný (otočení o 180°)', () => {
  const o = S.outline();
  const n = o.corners.length;
  for (let i = 0; i < n; i++) {
    const a = o.corners[i];
    const b = o.corners[(i + n / 2) % n];
    assert.ok(Math.abs(a.t1.x - (o.width - b.t1.x)) < 1e-6);
    assert.ok(Math.abs(a.t1.y - (o.height - b.t1.y)) < 1e-6);
    assert.ok(Math.abs(a.r - b.r) < 1e-6);
  }
});

test('oblouky jsou konzistentní (vzdálenost od středu = poloměr)', () => {
  for (const c of S.outline().corners) {
    if (c.r === 0) continue;
    assert.ok(Math.abs(Math.hypot(c.t1.x - c.c.x, c.t1.y - c.c.y) - c.r) < 1e-6);
    assert.ok(Math.abs(Math.hypot(c.t2.x - c.c.x, c.t2.y - c.c.y) - c.r) < 1e-6);
  }
});

test('hlubší výřez zasahuje blíž ke středu', () => {
  const tipY = (depth) => {
    const o = S.outline({ depth });
    return Math.max(...flatten(o).filter((p) => Math.abs(p[0] - o.width / 2) < 1e-6 && p[1] < o.height / 2).map((p) => p[1]));
  };
  assert.ok(tipY(0.7) > tipY(0.5));
});

test('obrys se nikdy nekříží – celý rozsah táhel a velikostí', () => {
  const grid = [];
  for (const depth of [0.05, 0.3, 0.62, 0.88, 0.92])
    for (const radius of [0, 0.05, 0.1])
      for (const offset of [0, 0.075, 0.12])
        for (const height of [100, 400, 1000])
          for (const cutWidth of [4, 9, 20, 25])
            grid.push({ depth, radius, offset, height, cutWidth });
  for (const params of grid) {
    const o = S.outline(params);
    assert.ok(!/NaN/.test(S.pathData(o)), JSON.stringify(params));
    assert.ok(!selfIntersects(flatten(o)), 'kříží se: ' + JSON.stringify(params));
  }
});

test('svg() vrací platný dokument s barvou a rozměry', () => {
  const svg = S.svg({ height: 400, color: '#ff0000' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="444\.44" height="400" viewBox="0 0 444\.44 400">/);
  assert.match(svg, /fill="#ff0000"/);
});

/* ───────────── maska se září ───────────── */

const palette = require('../palette.js');
const paletteHexes = new Set(palette.primitives.map((c) => c.hex));

function glowParts(svg) {
  return {
    clipPath: (svg.match(/<clipPath id="([^"]+)"><path d="([^"]+)"\/><\/clipPath>/) || []),
    gradients: [...svg.matchAll(/<radialGradient id="([^"]+)"([^>]*)>(.*?)<\/radialGradient>/g)],
    circles: [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)" fill="url\(#([^)]+)\)"\/>/g)]
  };
}

test('glowSvg: obrys tvaru je ořez a každý bod je kruh s vlastním přechodem', () => {
  const params = { height: 400 };
  const svg = S.glowSvg(params, S.DEFAULT_GLOW);
  const parts = glowParts(svg);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="444\.44" height="400" viewBox="0 0 444\.44 400">/);
  assert.equal(parts.clipPath[2], S.pathData(S.outline(params)), 'ořez má stejný obrys jako plný tvar');
  assert.ok(svg.includes(`clip-path="url(#${parts.clipPath[1]})"`));
  assert.equal(parts.circles.length, S.DEFAULT_GLOW.length);
  assert.equal(parts.gradients.length, S.DEFAULT_GLOW.length);
  assert.ok(!/NaN|undefined/.test(svg));
});

test('glowSvg: id jsou jedinečná a každý kruh odkazuje na existující přechod', () => {
  const svg = S.glowSvg({}, S.DEFAULT_GLOW);
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  const { circles } = glowParts(svg);
  for (const c of circles) assert.ok(ids.includes(c[4]), c[4]);
});

test('glowSvg: jiný obsah dostane jiná id (víc SVG na jedné stránce se nepřebije)', () => {
  const a = S.glowSvg({}, S.DEFAULT_GLOW);
  const b = S.glowSvg({}, S.DEFAULT_GLOW.map((p, i) => (i ? p : { ...p, x: p.x + 0.1 })));
  assert.notEqual(glowParts(a).clipPath[1], glowParts(b).clipPath[1]);
  assert.equal(glowParts(a).clipPath[1], glowParts(S.glowSvg({}, S.DEFAULT_GLOW)).clipPath[1]);
});

test('glowSvg: přechod má střed a poloměr zapsané výslovně a shodné s kruhem (Affinity jinak kreslí tvrdé kruhy)', () => {
  const { gradients, circles } = glowParts(S.glowSvg({ height: 300 }, S.DEFAULT_GLOW));
  assert.equal(gradients.length, circles.length);
  gradients.forEach((g, i) => {
    const attr = (name) => (g[2].match(new RegExp(' ' + name + '="([^"]+)"')) || [])[1];
    assert.equal(attr('gradientUnits'), 'userSpaceOnUse');
    assert.equal(attr('cx'), circles[i][1]);
    assert.equal(attr('cy'), circles[i][2]);
    assert.equal(attr('r'), circles[i][3]);
    assert.equal(circles[i][4], g[1]);
    assert.ok(/<stop [^>]*stop-opacity="1"/.test(g[3]) && /<stop [^>]*stop-opacity="0"\/>$/.test(g[3]), 'průhlednost je u každého zlomu zapsaná');
  });
});

test('glowSvg: poloha a velikost se počítají z rozměrů tvaru, takže se škálují s výškou', () => {
  const pt = [{ x: 0.5, y: 0.25, color: '#ffffff', size: 0.5 }];
  for (const height of [200, 400, 800]) {
    const o = S.outline({ height });
    const [c] = glowParts(S.glowSvg({ height }, pt)).circles;
    assert.ok(Math.abs(+c[1] - o.width / 2) < 0.01);
    assert.ok(Math.abs(+c[2] - height / 4) < 0.01);
    assert.ok(Math.abs(+c[3] - height / 2) < 0.01);
  }
});

test('normalizeGlow: ořízne polohu a velikost, opraví barvu a omezí počet bodů', () => {
  const [p] = S.normalizeGlow([{ x: -3, y: 9, color: 'abc', size: 99 }]);
  assert.deepEqual(p, { x: 0, y: 1, color: '#FFFFFF', size: S.GLOW_SIZE.max });
  assert.equal(S.normalizeGlow([{ x: 0.5, y: 0.5, color: '#a5e5b2', size: 0.001 }])[0].color, '#A5E5B2');
  assert.equal(S.normalizeGlow([{ x: 0.5, y: 0.5, color: '#a5e5b2', size: 0.001 }])[0].size, S.GLOW_SIZE.min);
  const many = Array.from({ length: S.MAX_GLOW_POINTS + 5 }, () => ({ x: 0.5, y: 0.5, color: '#fff', size: 0.5 }));
  assert.equal(S.normalizeGlow(many).length, S.MAX_GLOW_POINTS);
});

test('glowSvg: přechod ubývá od plné barvy do průhledna, přesně do poloměru', () => {
  const [g] = glowParts(S.glowSvg({}, [{ x: 0.5, y: 0.5, color: '#ADF0C1', size: 0.5 }])).gradients;
  const stops = [...g[3].matchAll(/<stop offset="([^"]+)" stop-color="([^"]+)"(?: stop-opacity="([^"]+)")?\/>/g)]
    .map((m) => ({ offset: +m[1], color: m[2], opacity: m[3] === undefined ? 1 : +m[3] }));
  assert.equal(stops[0].offset, 0);
  assert.equal(stops[0].opacity, 1);
  assert.equal(stops[stops.length - 1].offset, 1);
  assert.equal(stops[stops.length - 1].opacity, 0);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].opacity <= stops[i - 1].opacity);
  assert.ok(stops.every((s) => s.color === '#ADF0C1'));
});

test('všechny výchozí barvy jsou ve vzorníku (paleta Primitives)', () => {
  assert.ok(paletteHexes.has(S.DEFAULTS.color), 'barva jednobarevného tvaru');
  for (const p of S.DEFAULT_GLOW) assert.ok(paletteHexes.has(p.color), 'výchozí bod ' + p.color);
  for (const c of S.NEW_GLOW_COLORS) assert.ok(paletteHexes.has(c), 'barva nového bodu ' + c);
});

test('výchozí body leží uvnitř tvaru a je jich v rozsahu povoleného počtu', () => {
  assert.ok(S.DEFAULT_GLOW.length >= 1 && S.DEFAULT_GLOW.length <= S.MAX_GLOW_POINTS);
  for (const p of S.DEFAULT_GLOW) {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    assert.ok(p.size >= S.GLOW_SIZE.min && p.size <= S.GLOW_SIZE.max);
  }
});
