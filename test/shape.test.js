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

test('šířka výřezu se se zvětšením tvaru nemění', () => {
  for (const height of [200, 400, 800]) {
    const o = S.outline({ height, cutWidth: 9 });
    const pts = flatten(o);
    const y = o.params.depth * o.height / 2 / 2; // v polovině hloubky horního svislého výřezu
    const xs = rowCrossings(pts, y);
    const cx = o.width / 2;
    const left = Math.max(...xs.filter((x) => x < cx));
    const right = Math.min(...xs.filter((x) => x > cx));
    assert.ok(Math.abs(right - left - 9) < 1e-6, `výška ${height}: ${right - left}`);
  }
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
          for (const cutWidth of [4, 9, 20])
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
