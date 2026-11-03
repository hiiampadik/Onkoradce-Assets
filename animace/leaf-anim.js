/**
 * leaf-anim.js — animace lístečku (Onkorádce)
 *
 * Vstupem je obyčejné SVG s jednou cestou: obdélník s výřezy a zaoblenými rohy.
 * Knihovna si z cesty sama odvodí
 *   • rohy     – každý zaoblený roh = ostrý vrchol + křivka kolem něj,
 *   • výřezy   – zářezy s kulatým koncem; konce výřezů zůstávají vždy na místě,
 *   • lístečky – část obrysu mezi dvěma sousedními výřezy. Lísteček má „kotvu“ (průsečík
 *                hran obou svých výřezů) a mění velikost vůči ní. Hrany výřezů proto
 *                zůstávají na svých přímkách a u konců výřezů nevzniká žádný zub.
 * Celý tvar se v každém snímku kreslí jako jedna cesta. Rohy se při změně velikosti jen
 * posouvají (stálý poloměr zaoblení); menší jsou, jen když se už nevejdou (jako border-radius).
 * Při změně tvaru tedy stačí vyměnit SVG soubor.
 *
 * Použití:
 *   <script type="module" src="leaf-anim.js"></script>
 *   <leaf-anim src="Curve.svg" animation="grow-squish"></leaf-anim>
 *
 * Animace: grow-pop | grow-squish | loader | pairs  (viz ANIMATIONS níže)
 */

// ───────────────────────────── vektory a Bézierovy křivky ─────────────────────────────

const DEG = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => { const l = len(a); return l ? [a[0] / l, a[1] / l] : [0, 0]; };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Znaménkový úhel otočení ze směru a do směru b (rad). */
const turn = (a, b) => Math.atan2(cross(a, b), dot(a, b));

function bezPoint(c, t) {
  const m = 1 - t, a = m * m * m, b = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t;
  return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]];
}

function bezTangent(c, t) {
  const m = 1 - t;
  let d = [0, 1].map((i) => 3 * m * m * (c[1][i] - c[0][i]) + 6 * m * t * (c[2][i] - c[1][i]) + 3 * t * t * (c[3][i] - c[2][i]));
  if (len(d) < 1e-9) {
    // řídicí bod splývá s koncovým – směr vezmeme z blízkého okolí
    const h = 1e-4;
    d = t < 0.5 ? sub(bezPoint(c, t + h), bezPoint(c, t)) : sub(bezPoint(c, t), bezPoint(c, t - h));
  }
  return unit(d);
}

function bezSplit(c, t) {
  const a = lerp2(c[0], c[1], t), b = lerp2(c[1], c[2], t), e = lerp2(c[2], c[3], t);
  const f = lerp2(a, b, t), g = lerp2(b, e, t), m = lerp2(f, g, t);
  return [[c[0], a, f, m], [m, g, e, c[3]]];
}

function lineIntersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(sub(q, p), e) / den;
  return [p[0] + d[0] * s, p[1] + d[1] * s];
}

// ───────────────────────────── čtení SVG ─────────────────────────────

/** Násobení afinních matic [a b c d e f]: výsledek = A·B (nejdřív B, pak A). */
function mmul(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
const mapPt = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0];
  if (!str) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (let hit; (hit = re.exec(str));) {
    const v = hit[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t;
    switch (hit[1]) {
      case 'matrix': t = v; break;
      case 'translate': t = [1, 0, 0, 1, v[0], v[1] || 0]; break;
      case 'scale': t = [v[0], 0, 0, v[1] ?? v[0], 0, 0]; break;
      case 'rotate': {
        const a = v[0] * DEG, co = Math.cos(a), si = Math.sin(a);
        t = [co, si, -si, co, 0, 0];
        if (v.length > 2) t = mmul(mmul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case 'skewX': t = [1, 0, Math.tan(v[0] * DEG), 1, 0, 0]; break;
      case 'skewY': t = [1, Math.tan(v[0] * DEG), 0, 1, 0, 0]; break;
    }
    m = mmul(m, t);
  }
  return m;
}

/**
 * Data cesty → uzavřené obrysy složené z úseček [p0, p1] a kubických křivek [p0, p1, p2, p3].
 * Kvadratické křivky se převádějí na kubické. Oblouky (A) podporované nejsou.
 */
function parsePathData(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const subpaths = [];
  let i = 0, cmd = '', cur = [0, 0], start = [0, 0], sp = null, lastCtrl = null, lastType = '';
  const seg = (pts) => {
    if (!sp) { sp = { segs: [] }; subpaths.push(sp); start = cur; }
    sp.segs.push(pts);
    cur = pts[pts.length - 1];
  };
  const quad = (p0, q, p) => [p0, lerp2(p0, q, 2 / 3), lerp2(p, q, 2 / 3), p];

  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error('Neplatná data cesty (číslo bez příkazu).');
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const num = () => {
      const v = parseFloat(tokens[i++]);
      if (!Number.isFinite(v)) throw new Error('Neplatná data cesty u příkazu ' + cmd + '.');
      return v;
    };
    const pt = () => { const x = num(), y = num(); return rel ? [cur[0] + x, cur[1] + y] : [x, y]; };
    const p0 = cur;
    let ctrl = null;

    switch (C) {
      case 'M':
        cur = start = pt();
        sp = { segs: [] };
        subpaths.push(sp);
        cmd = rel ? 'l' : 'L'; // další dvojice čísel jsou implicitní lineto
        break;
      case 'Z':
        if (sp && (cur[0] !== start[0] || cur[1] !== start[1])) seg([cur, start]);
        sp = null;
        cur = start;
        cmd = ''; // po Z musí následovat příkaz
        break;
      case 'L': seg([p0, pt()]); break;
      case 'H': { const x = num(); seg([p0, [rel ? p0[0] + x : x, p0[1]]]); break; }
      case 'V': { const y = num(); seg([p0, [p0[0], rel ? p0[1] + y : y]]); break; }
      case 'C': { const a = pt(), b = pt(), p = pt(); seg([p0, a, b, p]); ctrl = b; break; }
      case 'S': {
        const a = lastType === 'C' ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
        const b = pt(), p = pt();
        seg([p0, a, b, p]); ctrl = b; break;
      }
      case 'Q': { const q = pt(), p = pt(); seg(quad(p0, q, p)); ctrl = q; break; }
      case 'T': {
        const q = lastType === 'Q' ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
        seg(quad(p0, q, pt())); ctrl = q; break;
      }
      case 'A': throw new Error('Oblouky (příkaz A) nejsou podporované – v grafickém editoru převeď tvar na křivky.');
      default: throw new Error('Neznámý příkaz cesty: ' + cmd);
    }
    lastType = C === 'S' ? 'C' : C === 'T' ? 'Q' : C;
    lastCtrl = ctrl;
  }
  return subpaths.filter((s) => s.segs.length).map((s) => s.segs);
}

// ───────────────────────────── analýza tvaru ─────────────────────────────
//
// Obrys se převede na seznam „položek“ (items). Úsečky mezi nimi jsou implicitní.
// Každá položka má začátek S, konec E, vztažný bod V a směry tečen dIn / dOut:
//   { type: 'corner', V, curves, theta, convex }  zaoblený roh; V = ostrý vrchol, kolem
//                                                   kterého je roh postavený
//   { type: 'point', P }                          ostrý vrchol bez zaoblení
//   { type: 'curve', curves }                     téměř rovná křivka (V = její začátek)

const MAX_CORNER_TURN = 150 * DEG; // větší otočení (např. půlkruhový konec výřezu) se dělí na víc rohů
const MIN_CORNER_TURN = 3 * DEG; // menší protisměrné zákmity se připojí k sousednímu rohu

/** Souvislý řetězec hladce navazujících křivek → jeden či více rohů. */
function runToItems(run, orient) {
  const N = 24;
  const S = []; // vzorky: parametr u (index křivky + t), směr tečny, kumulované otočení
  let cum = 0, prev = null;
  run.forEach((c, si) => {
    for (let j = si ? 1 : 0; j <= N; j++) {
      const dir = bezTangent(c, j / N);
      if (prev) cum += turn(prev, dir);
      S.push({ u: si + j / N, dir, cum });
      prev = dir;
    }
  });
  const tangentAt = (u) => {
    const si = Math.min(run.length - 1, Math.floor(u));
    return bezTangent(run[si], u - si);
  };

  // 1) inflexní body – roh musí zatáčet jedním směrem
  const bounds = [0];
  let sgn = 0;
  for (let j = 1; j < S.length; j++) {
    const dth = S[j].cum - S[j - 1].cum;
    if (Math.abs(dth) < 1e-5) continue;
    if (sgn && Math.sign(dth) !== sgn) bounds.push(j - 1);
    sgn = Math.sign(dth);
  }
  bounds.push(S.length - 1);
  // drobné zákmity nejsou samostatný roh
  for (let b = 0; bounds.length > 2 && b < bounds.length - 1;) {
    if (Math.abs(S[bounds[b + 1]].cum - S[bounds[b]].cum) < MIN_CORNER_TURN) {
      bounds.splice(b + 1 < bounds.length - 1 ? b + 1 : b, 1);
      b = 0;
    } else b++;
  }

  // 2) velká otočení (půlkruh apod.) rozdělit rovnoměrně podle úhlu
  const cuts = [];
  for (let b = 0; b < bounds.length - 1; b++) {
    const a = bounds[b], z = bounds[b + 1];
    if (b > 0) cuts.push(S[a].u);
    const total = S[z].cum - S[a].cum;
    const parts = Math.max(1, Math.ceil(Math.abs(total) / MAX_CORNER_TURN - 1e-9));
    for (let q = 1; q < parts; q++) {
      const target = S[a].cum + (total * q) / parts;
      for (let j = a + 1; j <= z; j++) {
        if ((S[j - 1].cum - target) * (S[j].cum - target) > 0) continue;
        let lo = S[j - 1].u, hi = S[j].u;
        const f = (u) => S[j - 1].cum + turn(S[j - 1].dir, tangentAt(u)) - target;
        const flo = f(lo);
        for (let it = 0; it < 40; it++) {
          const mid = (lo + hi) / 2;
          if (f(mid) * flo > 0) lo = mid; else hi = mid;
        }
        cuts.push((lo + hi) / 2);
        break;
      }
    }
  }

  // 3) rozřezat řetězec v bodech řezu
  const snapped = [...new Set(cuts.map((u) => (Math.abs(u - Math.round(u)) < 1e-6 ? Math.round(u) : u)))]
    .filter((u) => u > 0 && u < run.length)
    .sort((x, y) => x - y);
  const chains = [[]];
  run.forEach((c, si) => {
    let seg = c, t0 = 0;
    for (const u of snapped) {
      if (u <= si || u >= si + 1) continue;
      const t = u - si;
      const [l, r] = bezSplit(seg, (t - t0) / (1 - t0));
      chains[chains.length - 1].push(l);
      chains.push([]);
      seg = r; t0 = t;
    }
    chains[chains.length - 1].push(seg);
    if (si < run.length - 1 && snapped.includes(si + 1)) chains.push([]);
  });

  // 4) každý kus → roh s ostrým vrcholem V
  return chains.filter((ch) => ch.length).map((curves) => {
    const S0 = curves[0][0], E0 = curves[curves.length - 1][3];
    const dIn = bezTangent(curves[0], 0), dOut = bezTangent(curves[curves.length - 1], 1);
    const theta = turn(dIn, dOut);
    const V = Math.abs(theta) > 0.5 * DEG ? lineIntersect(S0, dIn, E0, dOut) : null;
    if (!V) return { type: 'curve', curves, S: S0, E: E0, V: S0, dIn, dOut };
    return { type: 'corner', curves, S: S0, E: E0, V, dIn, dOut, theta, convex: Math.sign(theta) === orient };
  });
}

function analyzeContour(raw, tol) {
  // úklid: nulové úseky pryč, rovné křivky → úsečky, konce na sebe navázat
  let segs = [];
  for (const s of raw) {
    const p0 = s[0], p3 = s[s.length - 1], L = len(sub(p3, p0));
    if (s.length === 4) {
      const dir = unit(sub(p3, p0));
      const dev = L > tol
        ? Math.max(Math.abs(cross(dir, sub(s[1], p0))), Math.abs(cross(dir, sub(s[2], p0))))
        : Math.max(len(sub(s[1], p0)), len(sub(s[2], p0)));
      if (dev <= tol) { if (L > tol) segs.push([p0, p3]); continue; }
      segs.push(s);
    } else if (L > tol) segs.push(s);
  }
  if (segs.length < 2) throw new Error('Obrys je příliš jednoduchý.');
  const last = segs[segs.length - 1];
  if (len(sub(last[last.length - 1], segs[0][0])) > tol) segs.push([last[last.length - 1], segs[0][0]]);
  segs = segs.map((s, i) => {
    const prev = i ? segs[i - 1] : segs[segs.length - 1];
    return [prev[prev.length - 1], ...s.slice(1)];
  });

  // orientace obrysu (v souřadnicích SVG: kladná plocha = po směru hodinových ručiček)
  const poly = segs.flatMap((s) => (s.length === 2 ? [s[0]] : [0, 0.25, 0.5, 0.75].map((t) => bezPoint(s, t))));
  const orient = polyArea(poly) >= 0 ? 1 : -1;

  const tStart = (s) => (s.length === 2 ? unit(sub(s[1], s[0])) : bezTangent(s, 0));
  const tEnd = (s) => (s.length === 2 ? unit(sub(s[1], s[0])) : bezTangent(s, 1));
  const smooth = (a, b) => Math.abs(turn(tEnd(a), tStart(b))) < 2 * DEG;

  // začít na místě, kde nenavazují dvě hladké křivky (jinak by se roh rozpůlil)
  const n = segs.length;
  let first = segs.findIndex((s, b) => {
    const a = segs[(b - 1 + n) % n];
    return a.length === 2 || s.length === 2 || !smooth(a, s);
  });
  if (first < 0) first = 0;
  const order = [...segs.slice(first), ...segs.slice(0, first)];

  const items = [];
  let run = [];
  const flush = () => { if (run.length) items.push(...runToItems(run, orient)); run = []; };
  order.forEach((s, j) => {
    const prev = order[(j - 1 + n) % n];
    const kink = !smooth(prev, s);
    if (s.length === 2 || kink || prev.length === 2) flush();
    if (kink) items.push({ type: 'point', P: s[0], S: s[0], E: s[0], V: s[0], dIn: tEnd(prev), dOut: tStart(s) });
    if (s.length === 4) run.push(s);
  });
  flush();
  return { items, orient };
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function polyCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-9) return pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * Výřez = dva po sobě jdoucí vnitřní (konkávní) rohy, které dohromady otočí obrys o ~180°.
 * a = roh, kterým obrys do výřezu vstupuje, b = roh, kterým z něj vychází.
 */
function findSlits(items) {
  const n = items.length, slits = [];
  for (let i = 0; i < n; i++) {
    const a = items[i], b = items[(i + 1) % n];
    if (a.type !== 'corner' || b.type !== 'corner' || a.convex || b.convex) continue;
    if (Math.abs(Math.abs(a.theta + b.theta) - Math.PI) > 30 * DEG) continue;
    slits.push({ a: i, b: (i + 1) % n, tip: lerp2(a.E, b.S, 0.5) });
    i++;
  }
  return slits;
}

function itemPoints(item, steps = 8) {
  if (item.type === 'point') return [item.P];
  const pts = [];
  for (const c of item.curves) for (let j = 0; j < steps; j++) pts.push(bezPoint(c, j / steps));
  return pts;
}

/**
 * Hlavní analýza. `shapes` = [{ d, matrix }] v souřadnicích SVG.
 * Volby: viewBox [x y w h], center [x y] (jinak průměr špiček výřezů),
 *        startAngle – kde začíná pořadí lístečků (stupně, −90 = 12 hodin).
 */
export function buildLeafGeometry(shapes, opts = {}) {
  const raw = [];
  for (const sh of shapes) {
    for (const segs of parsePathData(sh.d)) raw.push(segs.map((s) => s.map((p) => mapPt(sh.matrix || [1, 0, 0, 1, 0, 0], p))));
  }
  if (!raw.length) throw new Error('V SVG jsem nenašel žádnou vyplněnou cestu.');

  const all = raw.flat().flatMap((s) => (s.length === 2 ? s : [0, 0.25, 0.5, 0.75, 1].map((t) => bezPoint(s, t))));
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const size = Math.hypot(bbox[2], bbox[3]);
  const tol = size * 1e-4;
  const contours = raw.map((c) => {
    const { items, orient } = analyzeContour(c, tol);
    return { items, orient, owner: new Array(items.length).fill(null) };
  });

  let slits = [], petals, center = opts.center;
  if (contours.length === 1 && (slits = findSlits(contours[0].items)).length >= 2) {
    // jeden obrys s výřezy: lísteček = vše mezi koncem jednoho výřezu a začátkem dalšího
    const { items, owner } = contours[0], n = items.length;
    center ||= slits.reduce((s, x) => [s[0] + x.tip[0] / slits.length, s[1] + x.tip[1] / slits.length], [0, 0]);
    petals = slits.map((s, j) => {
      const next = slits[(j + 1) % slits.length];
      const out = items[s.b], inn = items[next.a];
      // kotva = průsečík hrany, kterou se vychází z výřezu, a hrany, kterou se vstupuje do dalšího
      let anchor = lineIntersect(out.E, out.dOut, inn.S, inn.dIn);
      if (!anchor || len(sub(anchor, center)) > size / 2) anchor = center;
      const petal = { anchor, members: [], sMin: 0 };
      for (let i = (s.b + 1) % n; i !== next.a; i = (i + 1) % n) {
        owner[i] = petal;
        petal.members.push(items[i]);
      }
      petal.centroid = polyCentroid([anchor, ...petal.members.flatMap((it) => itemPoints(it))]);
      return petal;
    });
  } else {
    // víc samostatných cest/obrysů (nebo tvar bez výřezů) → každý obrys je jeden lísteček
    slits = [];
    center ||= [bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2];
    petals = contours.map((c) => {
      const petal = { anchor: center, members: c.items, sMin: 0 };
      c.owner.fill(petal);
      petal.centroid = polyCentroid(c.items.flatMap((it) => itemPoints(it)));
      return petal;
    });
  }

  // hrany mezi položkami: směr a kolik z nich zabírají sousední rohy
  for (const c of contours) {
    const it = c.items, n = it.length;
    c.edges = it.map((a, i) => {
      const b = it[(i + 1) % n];
      const gap = sub(b.S, a.E);
      const u = len(gap) > tol ? unit(gap) : a.dOut;
      return { u, ta: Math.max(0, dot(u, sub(a.E, a.V))), tb: Math.max(0, -dot(u, sub(b.S, b.V))) };
    });
  }

  // nejmenší velikost lístečku, při které se ještě nekříží s pevnými konci výřezů
  const margin = size * 0.002;
  for (const c of contours) {
    c.edges.forEach((e, i) => {
      const j = (i + 1) % c.items.length, pa = c.owner[i], pb = c.owner[j];
      if (pa === pb || (pa && pb)) return;
      const pet = pa || pb;
      const term = (idx, p) => (p ? [p.anchor, sub(c.items[idx].V, p.anchor)] : [c.items[idx].V, [0, 0]]);
      const [A0, A1] = term(i, pa), [B0, B1] = term(j, pb);
      const D0 = dot(e.u, sub(B0, A0)), D1 = dot(e.u, sub(B1, A1));
      const fixed = (pa ? 0 : e.ta) + (pb ? 0 : e.tb);
      if (D1 > 1e-9) pet.sMin = Math.min(0.95, Math.max(pet.sMin, (fixed + margin - D0) / D1));
    });
  }

  // pořadí po směru hodinových ručiček od 12 hodin
  const start = (opts.startAngle ?? -90) * DEG;
  const wrap = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  for (const p of petals) p.angle = Math.atan2(p.centroid[1] - center[1], p.centroid[0] - center[0]);
  petals.sort((a, b) => wrap(a.angle - start) - wrap(b.angle - start));
  petals.forEach((p, i) => { p.index = i; });

  // poloměr vnitřních (vydutých) rohů, typicky konců výřezů
  const inner = contours.flatMap((c) => c.items).filter((it) => it.type === 'corner' && !it.convex)
    .map((it) => Math.min(len(sub(it.S, it.V)), len(sub(it.E, it.V))) / Math.tan(Math.abs(it.theta) / 2));
  const innerRadius = inner.length ? inner.reduce((a, b) => a + b, 0) / inner.length : size * 0.02;

  return { viewBox: opts.viewBox || bbox, bbox, size, center, petals, slits, contours, innerRadius, fill: opts.fill || null };
}

// ───────────────────────────── vykreslení ─────────────────────────────

const fmt = (v) => Math.round(v * 100) / 100;
const P = (p) => fmt(p[0]) + ' ' + fmt(p[1]);

/**
 * Ostré vrcholy obrysu pro daný stav lístečků (viz layoutContour): pos – kam se posunul
 * vrchol každé položky, m – požadované zmenšení jejího rohu, shrink – jestli se roh smí
 * zmenšit, když se nevejde. Vrací null, když je obrys skrytý.
 */
function contourVertices(c, states) {
  const it = c.items, n = it.length;
  const pos = new Array(n), m = new Array(n).fill(1), shrink = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const pet = c.owner[i];
    if (!pet) { pos[i] = it[i].V; continue; }
    const st = states[pet.index] || {};
    const s = Math.max(st.s ?? 1, pet.sMin);
    if (s < 1e-3) return null;
    // vrchol se posouvá od kotvy, tvar rohu kolem něj zůstává → stálé zaoblení
    pos[i] = [pet.anchor[0] + s * (it[i].V[0] - pet.anchor[0]), pet.anchor[1] + s * (it[i].V[1] - pet.anchor[1])];
    if (it[i].type === 'corner') { shrink[i] = true; m[i] = Math.min(1, Math.max(0, st.k ?? 1)); }
  }
  return { pos, m, shrink };
}

/**
 * Rozloží jeden obrys pro daný stav lístečků. Vrací pro každou položku, kam se posunul
 * její vrchol (Q) a jak je zmenšený tvar rohu kolem něj (k), nebo null, když je obrys skrytý.
 * states[i] = { s, k } pro lísteček i (po směru hodin od 12 hodin):
 *   s – velikost lístečku vůči jeho kotvě (1 = jako v SVG),
 *   k – násobek zaoblení jeho rohů (1 = jako v SVG, 0 = ostré rohy).
 */
function layoutContour(c, states) {
  const v = contourVertices(c, states);
  if (!v) return null;
  const { pos, m, shrink } = v, it = c.items, n = it.length;

  // rohy, které se na zkrácenou hranu nevejdou, zmenšit (jako border-radius v CSS)
  const f = new Array(n).fill(1);
  c.edges.forEach((e, i) => {
    const j = (i + 1) % n;
    const room = dot(e.u, sub(pos[j], pos[i])) - (shrink[i] ? 0 : e.ta) - (shrink[j] ? 0 : e.tb);
    const need = (shrink[i] ? e.ta * m[i] : 0) + (shrink[j] ? e.tb * m[j] : 0);
    if (need > room + 1e-6) {
      const ff = Math.max(0, room) / need;
      if (shrink[i]) f[i] = Math.min(f[i], ff);
      if (shrink[j]) f[j] = Math.min(f[j], ff);
    }
  });
  return it.map((item, i) => ({ item, Q: pos[i], k: shrink[i] ? m[i] * f[i] : 1 }));
}

/** Bod položky p přenesený do rozložení L (posun vrcholu + zmenšení rohu). */
const placeAt = (L, p) => [L.Q[0] + (p[0] - L.item.V[0]) * L.k, L.Q[1] + (p[1] - L.item.V[1]) * L.k];
const layoutStart = (L) => (L.item.type === 'point' ? L.Q : placeAt(L, L.item.curves[0][0]));
const layoutEnd = (L) => (L.item.type === 'point' ? L.Q : placeAt(L, L.item.curves[L.item.curves.length - 1][3]));

/**
 * Vykreslí celý tvar jako jednu cestu (atribut d).
 * Bez states (nebo se samými jedničkami) vznikne přesně původní tvar.
 */
export function geometryPath(geo, states = []) {
  let d = '';
  for (const c of geo.contours) {
    const lay = layoutContour(c, states);
    if (!lay) continue;
    let part = '';
    for (const L of lay) {
      part += (part ? 'L' : 'M') + P(layoutStart(L));
      if (L.item.type === 'point') continue;
      for (const cv of L.item.curves) part += 'C' + P(placeAt(L, cv[1])) + ' ' + P(placeAt(L, cv[2])) + ' ' + P(placeAt(L, cv[3]));
    }
    d += part + 'Z';
  }
  return d;
}

// ───────────────────────────── růst ze čtverce ─────────────────────────────
//
// Na začátku je vidět jen zaoblený čtverec. Tvar s lístečky je zmenšený pod ním, lístečky
// z něj vyrůstají a čtverec se mezitím stahuje do středu, kde zmizí.
// Kreslí se sjednocení zaobleného čtverce a tvaru s lístečky (ten se kreslí úplně stejně
// jako jindy). Tam, kde se obrysy protnou, se doplní vyduté zaoblení s poloměrem jako
// konce výřezů. Rovné hrany tak mají pořád jen směry jako v SVG (po 45°), žádný roh není
// ostrý a protože jsou oba obrysy hladké, mění se sjednocení plynule, bez skoků.

/** Kruhový oblouk se středem O z bodu A o úhel phi (rad, se znaménkem) → kubické křivky [c1, c2, p]. */
function arcCurves(O, A, phi) {
  const R = len(sub(A, O));
  const parts = Math.max(1, Math.ceil(Math.abs(phi) / (Math.PI / 2) - 1e-9));
  const step = phi / parts, h = (4 / 3) * Math.tan(step / 4) * R;
  let a = Math.atan2(A[1] - O[1], A[0] - O[0]);
  const out = [];
  for (let i = 0; i < parts; i++) {
    const b = a + step;
    const p0 = [O[0] + R * Math.cos(a), O[1] + R * Math.sin(a)];
    const p3 = [O[0] + R * Math.cos(b), O[1] + R * Math.sin(b)];
    out.push([[p0[0] - h * Math.sin(a), p0[1] + h * Math.cos(a)], [p3[0] + h * Math.sin(b), p3[1] - h * Math.cos(b)], p3]);
    a = b;
  }
  return out;
}

const C = (c1, c2, p) => 'C' + P(c1) + ' ' + P(c2) + ' ' + P(p);

/** Uzavřený obrys z úseček a kubických křivek s délkovým parametrem s ∈ [0, total). */
function makeLoop(segs) {
  const N = 16, starts = [], tables = [];
  let total = 0;
  for (const sg of segs) {
    starts.push(total);
    const tb = [0];
    if (sg.length === 2) tb.push(len(sub(sg[1], sg[0])));
    else for (let j = 1; j <= N; j++) tb.push(tb[j - 1] + len(sub(bezPoint(sg, j / N), bezPoint(sg, (j - 1) / N))));
    tables.push(tb);
    total += tb[tb.length - 1];
  }
  const wrap = (s) => ((s % total) + total) % total;
  /** Parametr u na úseku i ve vzdálenosti d od jeho začátku. */
  const uAt = (i, d) => {
    const tb = tables[i], n = tb.length - 1;
    let j = 0;
    while (j < n - 1 && tb[j + 1] < d) j++;
    const span = tb[j + 1] - tb[j];
    return clamp01((j + (span > 0 ? (d - tb[j]) / span : 0)) / n);
  };
  const locate = (s) => {
    s = wrap(s);
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= s) lo = mid; else hi = mid - 1; }
    return [lo, uAt(lo, s - starts[lo])];
  };
  const paramOf = (i, u) => {
    const tb = tables[i], n = tb.length - 1, x = u * n, j = Math.min(n - 1, Math.floor(x));
    return starts[i] + tb[j] + (tb[j + 1] - tb[j]) * (x - j);
  };
  const point = (i, u) => (segs[i].length === 2 ? lerp2(segs[i][0], segs[i][1], u) : bezPoint(segs[i], u));
  const tangent = (i, u) => (segs[i].length === 2 ? unit(sub(segs[i][1], segs[i][0])) : bezTangent(segs[i], u));
  /** Data cesty od s0 dál po obrysu o délku l (bez úvodního M). */
  const emit = (s0, l) => {
    let d = '', [i, u] = locate(s0), left = l;
    for (let guard = 0; left > 1e-9 && guard <= segs.length + 1; guard++) {
      const from = paramOf(i, u) - starts[i], room = tables[i][tables[i].length - 1] - from;
      const u1 = room > left ? uAt(i, from + left) : 1;
      const sg = segs[i];
      if (sg.length === 2) d += 'L' + P(lerp2(sg[0], sg[1], u1));
      else {
        const part = bezSplit(bezSplit(sg, u1)[0], u1 > 0 ? u / u1 : 0)[1];
        d += C(part[1], part[2], part[3]);
      }
      left -= Math.min(room, left);
      i = (i + 1) % segs.length; u = 0;
    }
    return d;
  };
  return { segs, total, wrap, locate, paramOf, point, tangent, emit, at: (s) => point(...locate(s)), dir: (s) => tangent(...locate(s)) };
}

/**
 * Zaoblený čtverec jako obrys (makeLoop) + znaménková vzdálenost od něj.
 * r = poloměr rohů, buď jeden, nebo [vpravo nahoře, vpravo dole, vlevo dole, vlevo nahoře].
 */
function makeSquare(center, h, r, orient) {
  const rs = (Array.isArray(r) ? r : [r, r, r, r]).map((x) => Math.max(0, Math.min(x, h)));
  const [cx, cy] = center;
  const rot = ([x, y], q) => { for (let i = 0; i < q; i++) [x, y] = [-y, x]; return [cx + x, cy + y]; };
  let pieces = [];
  for (let q = 0; q < 4; q++) {
    // po směru hodinových ručiček: hrana, pak roh (na obrazovce, osa y míří dolů)
    const r0 = rs[(q + 3) % 4], r1 = rs[q];
    if (2 * h - r0 - r1 > 0) pieces.push({ L: [rot([-h + r0, -h], q), rot([h - r1, -h], q)] });
    if (r1 > 0) pieces.push({ O: rot([h - r1, -h + r1], q), r: r1, a0: (q - 1) * Math.PI / 2, da: Math.PI / 2 });
  }
  if (orient < 0) pieces = pieces.reverse().map((p) => (p.L ? { L: [p.L[1], p.L[0]] } : { ...p, a0: p.a0 + p.da, da: -p.da }));
  const segs = pieces.flatMap((p) => {
    if (p.L) return [p.L];
    const A = [p.O[0] + p.r * Math.cos(p.a0), p.O[1] + p.r * Math.sin(p.a0)];
    let prev = A;
    return arcCurves(p.O, A, p.da).map(([c1, c2, q]) => { const s = [prev, c1, c2, q]; prev = q; return s; });
  });
  const loop = makeLoop(segs);
  loop.sd = (X) => {
    const dx = X[0] - cx, dy = X[1] - cy;
    const rr = dx > 0 ? (dy > 0 ? rs[1] : rs[0]) : (dy > 0 ? rs[2] : rs[3]); // poloměr rohu v té čtvrtině
    const qx = Math.abs(dx) - (h - rr), qy = Math.abs(dy) - (h - rr);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  };
  // parametr bodu na obrysu: nejbližší místo
  loop.param = (X) => {
    let best = 0, bd = Infinity;
    loop.segs.forEach((sg, i) => {
      let u;
      if (sg.length === 2) { const d = sub(sg[1], sg[0]); u = clamp01(dot(sub(X, sg[0]), d) / (dot(d, d) || 1)); }
      else {
        const dist = (t) => len(sub(bezPoint(sg, t), X));
        u = 0;
        for (let j = 1, m = dist(0); j <= 32; j++) { const e = dist(j / 32); if (e < m) { m = e; u = j / 32; } }
        let lo = Math.max(0, u - 1 / 32), hi = Math.min(1, u + 1 / 32);
        for (let k = 0; k < 30; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (dist(m1) < dist(m2)) hi = m2; else lo = m1; }
        u = (lo + hi) / 2;
      }
      const e = len(sub(loop.point(i, u), X));
      if (e < bd) { bd = e; best = loop.paramOf(i, u); }
    });
    return best;
  };
  return loop;
}

/** Kde obrys (makeLoop) prochází hranicí čtverce: [{ s, inward }] seřazené podle s. */
function squareCrossings(loop, sq) {
  const out = [];
  const root = (f, a, b) => { const fa = f(a) >= 0; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if ((f(m) >= 0) === fa) a = m; else b = m; } return (a + b) / 2; };
  loop.segs.forEach((sg, i) => {
    const f = (u) => sq.sd(loop.point(i, u));
    const add = (a, b) => { const u = root(f, a, b); out.push({ s: loop.paramOf(i, u), i, u, inward: f(a) >= 0 }); };
    if (sg.length === 2) {
      // vzdálenost od konvexního čtverce je podél úsečky konvexní → nejvýš dva průchody
      let lo = 0, hi = 1;
      for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
      const um = (lo + hi) / 2, f0 = f(0) >= 0, f1 = f(1) >= 0;
      if (f0 !== f1) add(0, 1);
      else if (f0 && f(um) < 0) { add(0, um); add(um, 1); }
    } else {
      const S = 24;
      for (let j = 0; j < S; j++) if ((f(j / S) >= 0) !== (f((j + 1) / S) >= 0)) add(j / S, (j + 1) / S);
    }
  });
  return out.sort((a, b) => a.s - b.s);
}

/** Vyduté zaoblení z bodu P0 (směr u0) do P3 (směr u1) jako kruhový oblouk. */
function filletCurve(P0, u0, P3, u1) {
  const c = len(sub(P3, P0));
  if (c < 1e-9) return '';
  const phi = Math.abs(turn(u0, u1));
  const h = phi < 1e-4 ? c / 3 : (4 / 3) * Math.tan(phi / 4) * (c / (2 * Math.sin(phi / 2)));
  return C([P0[0] + h * u0[0], P0[1] + h * u0[1]], [P3[0] - h * u1[0], P3[1] - h * u1[1]], P3);
}

/** Úsečky a křivky obrysu tvaru s lístečky (stejné jako geometryPath). */
function shapeSegments(c, states) {
  const lay = layoutContour(c, states);
  if (!lay) return null;
  const segs = [];
  let prev = layoutEnd(lay[lay.length - 1]);
  for (const L of lay) {
    const st = layoutStart(L);
    if (len(sub(st, prev)) > 1e-9) segs.push([prev, st]);
    if (L.item.type !== 'point') {
      for (const cv of L.item.curves) {
        const q = cv.map((p) => placeAt(L, p));
        if (len(sub(q[3], q[0])) > 1e-9 || len(sub(q[1], q[0])) > 1e-9) segs.push(q);
      }
    }
    prev = layoutEnd(L);
  }
  return segs;
}

/**
 * Cesta sjednocení zaobleného čtverce a tvaru s lístečky ve stavu states.
 * Čtverec má střed geo.center, polovinu strany half a poloměr rohů radius.
 * Funguje pro SVG s jedním obrysem; jinak (nebo bez čtverce) vrátí obyčejný tvar.
 */
export function squarePath(geo, states, half, radius) {
  if (geo.contours.length !== 1 || !(half > 0)) return geometryPath(geo, states);
  const c = geo.contours[0], o = c.orient;
  const sq = makeSquare(geo.center, half, radius, o);
  const whole = (lp) => 'M' + P(lp.at(0)) + lp.emit(0, lp.total) + 'Z';
  const segs = shapeSegments(c, states);
  if (!segs) return whole(sq);
  const g = makeLoop(segs);
  const ev = squareCrossings(g, sq);
  if (!ev.length) return sq.sd(g.at(0)) < 0 ? whole(sq) : geometryPath(geo, states);
  const m = ev.length;
  if (ev.some((e, j) => e.inward === ev[(j + 1) % m].inward)) return geometryPath(geo, states) + whole(sq);
  for (const e of ev) e.k = sq.param(g.point(e.i, e.u));

  // obejít sjednocení: po tvaru až ke vstupu do čtverce, po čtverci k dalšímu výstupu
  const outs = ev.filter((e) => !e.inward);
  const parts = []; // [výstup, vstup, další výstup]
  let e = outs[0];
  for (let guard = 0; ; guard++) {
    if (guard > outs.length) return geometryPath(geo, states) + whole(sq);
    const nx = ev[(ev.indexOf(e) + 1) % m];
    let best = null, bd = Infinity;
    for (const x of outs) { const dd = sq.wrap(x.k - nx.k); if (dd < bd) { bd = dd; best = x; } }
    parts.push({ out: e, inn: nx, next: best, lg: g.wrap(nx.s - e.s) || g.total, lk: bd });
    e = best;
    if (e === outs[0]) break;
  }

  // poloměr zaoblení na stycích; na krátké úseky se zmenší
  const inner = geo.innerRadius;
  const want = (u0, u1) => { const th = turn(u0, u1) * -o; return th > 0 ? inner * Math.tan(Math.min(th, 3.1) / 2) : 0; };
  parts.forEach((pt, j) => {
    const prev = parts[(j + parts.length - 1) % parts.length];
    pt.tin = Math.min(want(g.dir(pt.inn.s), sq.dir(pt.inn.k)), pt.lg / 2, pt.lk / 2);
    pt.tout = Math.min(want(sq.dir(pt.out.k), g.dir(pt.out.s)), pt.lg / 2, prev.lk / 2);
  });
  parts.forEach((pt, j) => { pt.tnext = parts[(j + 1) % parts.length].tout; });

  let d = 'M' + P(g.at(parts[0].out.s + parts[0].tout));
  for (const pt of parts) {
    const gs = pt.out.s + pt.tout, ge = pt.inn.s - pt.tin;
    d += g.emit(gs, pt.lg - pt.tout - pt.tin);
    const ks = pt.inn.k + pt.tin, ke = pt.next.k - pt.tnext;
    d += filletCurve(g.at(ge), g.dir(ge), sq.at(ks), sq.dir(ks));
    d += sq.emit(ks, pt.lk - pt.tin - pt.tnext);
    const back = pt.next.s + pt.tnext;
    d += filletCurve(sq.at(ke), sq.dir(ke), g.at(back), g.dir(back));
  }
  return d + 'Z';
}

/**
 * Velikost čtverce pro růst (polovina strany, střed je geo.center) při daném zaoblení rohů:
 * start = nejmenší čtverec, který zakryje tvar se všemi lístečky co nejmenšími,
 * hidden = největší čtverec, který se do takového tvaru celý schová. Bez výřezů null.
 */
export function squareSizes(geo, roundness) {
  geo._square ||= new Map();
  if (geo._square.has(roundness)) return geo._square.get(roundness);
  let res = null;
  if (geo.contours.length === 1 && geo.slits.length) {
    const c = geo.contours[0];
    const g = makeLoop(shapeSegments(c, geo.petals.map(() => ({ s: 0 }))));
    const samples = Array.from({ length: 400 }, (_, j) => g.at((j / 400) * g.total));
    const covers = (h) => { const sq = makeSquare(geo.center, h, roundness * h, c.orient); return samples.every((p) => sq.sd(p) < 0); };
    const hidden = (h) => { const sq = makeSquare(geo.center, h, roundness * h, c.orient); return !squareCrossings(g, sq).length && sq.sd(g.at(0)) >= 0; };
    const search = (ok, lo, hi, wantLow) => {
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ok(mid) === wantLow) hi = mid; else lo = mid; }
      return wantLow ? hi : lo;
    };
    res = { start: search(covers, 0, geo.size, true) + geo.innerRadius * 0.25, hidden: search(hidden, 0, geo.size, false) * 0.98 };
  }
  geo._square.set(roundness, res);
  return res;
}

// ───────────────────────────── čtverec s výřezy (otáčení) ─────────────────────────────
//
// Čtverec se stejnými výřezy jako lísteček: stejně široké a stejně hluboké, šikmé výřezy
// ale vedou přesně do rohů. Čtverec stojí, otáčí se jen soustava výřezů uvnitř něj.
// Tvar je vždy středově souměrný – výřezy jsou ve dvojicích naproti sobě.

/**
 * Popis čtverce odvozený z tvaru: polovina strany H a výřezy – z každé dvojice protilehlých
 * jen jeden { d (směr ven), a (vzdálenost konce od středu), l (posun do strany), w (polovina šířky), diag }.
 */
function spinSpec(geo) {
  if (geo._spin) return geo._spin;
  const H = Math.min(geo.bbox[2], geo.bbox[3]) / 2;
  const c = geo.contours[0];
  const raw = geo.contours.length === 1 ? geo.slits.map((s) => {
    const A = c.items[s.a], B = c.items[s.b];
    const d = [-A.dIn[0], -A.dIn[1]], rel = sub(s.tip, geo.center);
    return { d, a: dot(d, rel), l: cross(d, rel), w: len(sub(A.V, B.V)) / 2 };
  }) : [];
  const reps = [], used = new Set();
  raw.forEach((s, i) => {
    if (used.has(i)) return;
    used.add(i);
    const j = raw.findIndex((q, k) => !used.has(k) && dot(q.d, s.d) < -0.99);
    let rep = { ...s };
    if (j >= 0) { used.add(j); const q = raw[j]; rep = { d: s.d, a: (s.a + q.a) / 2, l: (s.l + q.l) / 2, w: (s.w + q.w) / 2 }; }
    // směry přesně po 45°; šikmý výřez míří přímo do rohu
    rep.diag = Math.abs(rep.d[0]) > 0.3 && Math.abs(rep.d[1]) > 0.3;
    if (rep.diag) { rep.d = [Math.sign(rep.d[0]) * Math.SQRT1_2, Math.sign(rep.d[1]) * Math.SQRT1_2]; rep.l = 0; }
    else rep.d = Math.abs(rep.d[0]) > Math.abs(rep.d[1]) ? [Math.sign(rep.d[0]), 0] : [0, Math.sign(rep.d[1])];
    rep.a = Math.min(rep.a, 0.8 * H);
    reps.push(rep);
  });
  if (!reps.length) {
    // SVG bez výřezů: rozložení jako u lístečku
    const w = 0.053 * H;
    reps.push({ d: [1, 0], a: 0.23 * H, l: -0.15 * H, w }, { d: [0, -1], a: 0.27 * H, l: 0, w },
      { d: [Math.SQRT1_2, Math.SQRT1_2], a: 0.26 * H, l: 0, w, diag: true });
  }
  // X = nejmenší zaoblení vnějšího rohu v SVG (roh bez výřezu)
  const outer = geo.contours.flatMap((q) => q.items).filter((it) => it.type === 'corner' && it.convex && Math.abs(Math.abs(it.theta) - Math.PI / 2) < 0.05)
    .map((it) => Math.min(len(sub(it.S, it.V)), len(sub(it.E, it.V))));
  const X = outer.length ? Math.min(...outer) : 0.12 * H;
  geo._spin = { H, reps, X, center: geo.center };
  return geo._spin;
}

/**
 * Cesta čtverce s výřezy. Čtverec stojí, soustava výřezů je pootočená o angle (stupně, po směru
 * hodin) kolem středu; l[j] = posun dvojice výřezů do strany.
 * Zaoblení je stálé: ústí výřezů mají poloměr 2X, volné rohy čtverce X. Zaoblení ústí je kruh
 * o poloměru 2X, který se dotýká stěny výřezu a hrany čtverce. Když se ústí přiblíží k rohu,
 * roh se plynule zaoblí až na 2X a ve chvíli, kdy ho výřez pohltí, splyne se zaoblením ústí.
 */
function spinPath(spec, l, X, angle) {
  const { H, reps, center } = spec, per = 8 * H;
  const wrap = (x) => ((x % per) + per) % per;
  const ca = Math.cos(angle * DEG), sa = Math.sin(angle * DEG);
  const rotv = ([x, y]) => [ca * x - sa * y, sa * x + ca * y];
  const at = (p, d, k) => [p[0] + k * d[0], p[1] + k * d[1]];
  // rohy a hrany po směru hodin: hrana k vede z rohu K[k] do K[k+1], N[k] je její vnější normála
  const K = [[-H, -H], [H, -H], [H, H], [-H, H]], N = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const U = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const param = (k, p) => 2 * H * k + dot(sub(p, K[k]), U[k]);

  /** Výřezy a zaoblení jejich ústí pro poloměr R; null, když se zaoblení nevejdou. */
  const layout = (R) => {
  const Hi = H - R, bands = [];
  reps.forEach((rep, j) => {
    for (const sgn of [1, -1]) { // výřez a jeho protějšek naproti přes střed
      const d0 = [sgn * rep.d[0], sgn * rep.d[1]], n0 = [-d0[1], d0[0]];
      const d = rotv(d0), n = rotv(n0), T = rotv([rep.a * d0[0] + l[j] * n0[0], rep.a * d0[1] + l[j] * n0[1]]);
      const cap = at(T, d, rep.w); // střed půlkruhového konce
      const walls = [1, -1].map((side) => {
        const start = at(cap, n, side * rep.w), m = [side * n[0], side * n[1]]; // m míří od výřezu do tvaru
        // střed zaoblení ústí: na přímce ve vzdálenosti R od stěny, kde opouští vnitřní čtverec (H − R)
        const q = at(start, m, R);
        let lam = Infinity, k = 0;
        for (const [ax, ks] of [[0, [3, 1]], [1, [0, 2]]]) {
          if (Math.abs(d[ax]) < 1e-12) continue;
          const t = ((d[ax] > 0 ? Hi : -Hi) - q[ax]) / d[ax];
          if (t < lam) { lam = t; k = d[ax] > 0 ? ks[1] : ks[0]; }
        }
        const O = at(q, d, lam), Te = at(O, N[k], R);
        return { start, O, Tw: at(start, d, lam), Te, k, p: param(k, Te) };
      });
      // po směru hodin se nejdřív narazí na stěnu, za kterou je výřez
      const first = wrap(walls[1].p - walls[0].p) < per / 2 ? 0 : 1;
      bands.push({ d, cap, entry: walls[first], exit: walls[1 - first] });
    }
  });
  bands.sort((a, b) => a.entry.p - b.entry.p);
  // zaoblení musí začínat za koncem výřezu a sousední ústí se nesmějí překrývat
  const ok = bands.every((b, i) => {
    const next = bands[(i + 1) % bands.length];
    return [b.entry, b.exit].every((w) => dot(sub(w.Tw, w.start), b.d) >= 0)
      && wrap(next.entry.p - b.entry.p) >= wrap(b.exit.p - b.entry.p);
  });
  return ok ? bands : null;
  };
  // ústí mají poloměr 2X; kde by se nevešel, zmenší se jen na největší, který se vejde
  let R = 2 * X, bands = layout(R);
  if (!bands) {
    let lo = 0, hi = R;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (layout(mid)) lo = mid; else hi = mid; }
    R = lo;
    bands = layout(R);
  }
  X = Math.min(X, R);

  // rohy: pohlcené výřezem vynechat, u ostatních poloměr X, u blízkého ústí plynule až 2X
  const ends = bands.flatMap((b) => [b.entry.p, b.exit.p]);
  const radius = K.map((_, k) => {
    const pk = 2 * H * k;
    if (bands.some((b) => wrap(pk - b.entry.p) < wrap(b.exit.p - b.entry.p))) return null;
    const near = Math.min(...ends.map((p) => Math.min(wrap(p - pk), wrap(pk - p))));
    const x = clamp01((R + X - near) / X);
    return X + (R - X) * x * x * (3 - 2 * x);
  });

  const abs = (p) => [center[0] + p[0], center[1] + p[1]];
  const arc = (O, A, phi) => arcCurves(abs(O), abs(A), phi).map((cv) => C(cv[0], cv[1], cv[2])).join('');
  /** Hrana čtverce z parametru p0 do p1 po směru hodin, včetně rohů mezi nimi. */
  const edge = (p0, p1) => {
    let out = '';
    const span = wrap(p1 - p0);
    for (let q = 1; q <= 4; q++) {
      const k = (Math.floor(p0 / (2 * H)) + q) % 4, dk = wrap(2 * H * k - p0);
      if (dk >= span) break;
      const r = radius[k] ?? 0, kin = (k + 3) % 4;
      const O = [K[k][0] - r * (N[kin][0] + N[k][0]), K[k][1] - r * (N[kin][1] + N[k][1])];
      out += 'L' + P(abs(at(K[k], U[kin], -r))) + (r > 0 ? arc(O, at(K[k], U[kin], -r), Math.PI / 2) : '');
    }
    return out;
  };

  let out = 'M' + P(abs(bands[0].exit.Te));
  bands.forEach((b, i) => {
    const nb = bands[(i + 1) % bands.length], en = nb.entry, ex = nb.exit;
    out += edge(b.exit.p, en.p) + 'L' + P(abs(en.Te));
    out += arc(en.O, en.Te, turn(U[en.k], [-nb.d[0], -nb.d[1]])) + 'L' + P(abs(en.start));
    out += arc(nb.cap, en.start, -Math.PI) + 'L' + P(abs(ex.Tw));
    out += arc(ex.O, ex.Tw, turn(nb.d, U[ex.k]));
  });
  return out + 'Z';
}

/** Pseudonáhodné číslo 0…1 určené semínkem a dvěma celými čísly (stejný vstup = stejný výsledek). */
function rand01(seed, a, b) {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(a | 0, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// po tolika krocích (dvou celých otočkách) se náhodná řada opakuje → video jde přehrávat dokola bez švu
const SPIN_STEPS = 8;

/** Posuny vodorovných a svislých výřezů pro krok i (dvojice naproti sobě se posouvají stejně → středová souměrnost). */
function spinState(spec, p, i) {
  return spec.reps.map((rep, j) => (rep.diag ? rep.l : rep.l + p.shift * 2 * rep.w * (2 * rand01(p.seed, i, j) - 1)));
}

/**
 * Otáčení výřezů: pauza, pak se výřezy uvnitř čtverce pootočí o 90° po směru hodin (čtverec stojí);
 * během pootočení se vodorovné a svislé výřezy zároveň posunou.
 */
function spinDraw(t, p, geo) {
  const spec = spinSpec(geo);
  const T = Math.max(1, p.turn + p.pause), k = Math.floor(t / T);
  const e = easeInOutCubic(clamp01((t - k * T - p.pause) / Math.max(1, p.turn)));
  const A = spinState(spec, p, k % SPIN_STEPS), B = spinState(spec, p, (k + 1) % SPIN_STEPS);
  return { d: spinPath(spec, A.map((v, j) => v + (B[j] - v) * e), spec.X * p.radius, 90 * ((k % 4) + e)) };
}

// ───────────────────────────── časování ─────────────────────────────

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * Průběh růstu 0 → 1 během x ∈ [0, 1] s přerostením: náběh, vrchol 1 + overshoot,
 * mírný zákmit pod 1 a klid. Hladká křivka (Hermite) přes klíčové body [x, hodnota, sklon].
 */
export function popCurve(x, overshoot) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const o = overshoot;
  const K = [[0, 0, 2.2 * (1 + o) / 0.42], [0.42, 1 + o, 0], [0.7, 1 - o * 0.22, 0], [1, 1, 0]];
  let i = 0;
  while (x > K[i + 1][0]) i++;
  const [x0, p0, m0] = K[i], [x1, p1, m1] = K[i + 1];
  const h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
}

// Růst ze čtverce: na začátku je vidět jen zaoblený čtverec, pod kterým jsou schované
// lístečky v nejmenší velikosti. Lístečky rostou od samého začátku, každý o `stagger`
// později, a vyrůstají ze čtverce ven; čtverec se mezitím (`melt`) stáhne do středu
// a schová se. Po výdrži `hold` se celé přehraje pozpátku zpět do čtverce.
function growTiming(p, n) {
  const grow = Math.max(p.melt, (n - 1) * p.stagger + p.duration);
  return { grow, total: p.reverse ? 2 * grow + p.hold : grow };
}
function growClock(t, p, n) {
  const { grow } = growTiming(p, n);
  if (t <= grow) return t;
  if (!p.reverse || t <= grow + p.hold) return grow;
  return Math.max(0, 2 * grow + p.hold - t);
}
const growMelt = (t, p, n) => (p.melt > 0 ? easeInOutCubic(clamp01(growClock(t, p, n) / p.melt)) : 1);
const growProgress = (t, i, n, p) => (growClock(t, p, n) - i * p.stagger) / p.duration;
const introScale = (t, p) => (p.intro > 0 ? easeOutCubic(clamp01(t / p.intro)) : 1);
// Parametry růstu: melt = jak dlouho se čtverec stahuje do středu; square = velikost čtverce
// na začátku (1 = právě zakryje nejmenší lístečky); roundness = poloměr rohů čtverce vůči
// polovině strany (1 = kruh).

/**
 * Každá animace vrací pro čas t (ms) a lísteček i z n:
 *   s – velikost lístečku vůči jeho kotvě (1 = finální podoba)
 *   k – násobek zaoblení rohů (1 = jako v SVG)
 * a volitelně scale(t) – zvětšení celého tvaru od středu (objevení / zmizení),
 * square(t) – jak daleko je stažení čtverce, ze kterého lístečky vyrůstají (0 = celý, 1 = schovaný).
 * Animace s vlastním tvarem mají místo frame draw(t) → { d, angle } (cesta a pootočení celého tvaru ve stupních).
 * Smyčky mají cycle – délku jedné otočky, po které se vše opakuje – a settle – jak dlouho trvá nástup.
 * Lístečky jsou očíslované po směru hodinových ručiček od 12 hodin.
 */
export const ANIMATIONS = {
  'grow-pop': {
    label: 'Růst – pop',
    loop: false,
    // overshoot = o kolik lísteček přeroste
    params: { duration: 1000, stagger: 50, overshoot: 0.17, melt: 840, square: 1, roundness: 1, hold: 2000, reverse: true },
    total: (p, n) => growTiming(p, n).total,
    square: growMelt,
    frame(t, i, n, p) {
      return { s: popCurve(growProgress(t, i, n, p), p.overshoot), k: 1 };
    },
  },

  'grow-squish': {
    label: 'Růst – zmáčknutí',
    loop: false,
    // impact = jak moc by lísteček „přestřelil“, kdyby ho nezastavil neviditelný box;
    // squish = o kolik se při plném nárazu zmenší zaoblení rohů (0.55 = o 55 %)
    params: { duration: 1000, stagger: 50, impact: 0.12, squish: 0.55, melt: 1010, square: 1, roundness: 0.9, hold: 2000, reverse: true },
    total: (p, n) => growTiming(p, n).total,
    square: growMelt,
    frame(t, i, n, p) {
      const v = popCurve(growProgress(t, i, n, p), p.impact);
      const press = p.impact > 0 ? clamp01((v - 1) / p.impact) : 0;
      return { s: Math.min(v, 1), k: 1 - p.squish * press };
    },
  },

  loader: {
    label: 'Načítání',
    loop: true,
    // vlna obíhá po směru hodinových ručiček; sharpness > 1 = užší vlna
    params: { period: 1000, min: 0.58, max: 1, sharpness: 1.3, intro: 400 },
    scale: introScale,
    cycle: (p) => p.period,
    settle: (p) => p.intro,
    frame(t, i, n, p) {
      const x = (((t / p.period - i / n) % 1) + 1) % 1;
      const w = Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * x), p.sharpness);
      return { s: p.min + (p.max - p.min) * w, k: 1 };
    },
  },

  pairs: {
    label: 'Protilehlé páry',
    loop: true,
    // step = jak dlouho trvá jeden krok (přechod + výdrž), transition = délka přechodu
    // (delší přechod než krok se zkrátí na délku kroku – páry se pak bez výdrže plynule střídají)
    params: { step: 490, transition: 810, base: 0.6, peak: 1, intro: 400 },
    scale: introScale,
    cycle: (p, n) => (n % 2 === 0 ? n / 2 : n) * p.step,
    settle: (p) => Math.max(p.intro, p.transition),
    frame(t, i, n, p) {
      // páry protilehlých lístečků: (0, n/2), (1, n/2+1)…; při lichém počtu jde každý zvlášť
      const G = n % 2 === 0 ? n / 2 : n;
      const g = i % G;
      const r = Math.min(1, Math.max(0.01, p.transition / p.step));
      const u = (((t / p.step - r - g) % G) + G) % G; // posun o r: na začátku pár 0 teprve roste
      let a;
      if (G === 1) a = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / p.step));
      else if (u < 1 - r) a = 1;
      else if (u < 1) a = 1 - easeInOutCubic((u - (1 - r)) / r);
      else if (u >= G - r) a = easeInOutCubic((u - (G - r)) / r);
      else a = 0;
      if (G > 1 && g === G - 1 && t < p.transition) a = 0; // poslední pár na začátku nesmršťujeme
      return { s: p.base + (p.peak - p.base) * a, k: 1 };
    },
  },

  spin: {
    label: 'Otáčení výřezů',
    loop: true,
    // turn = jak dlouho trvá pootočení o 90°, pause = jak dlouho pak výřezy stojí;
    // shift = jak daleko se můžou posunout vodorovné a svislé výřezy (v šířkách výřezu);
    // radius = zaoblení X jako násobek nejmenšího vnějšího rohu v SVG (rohy X, ústí výřezů 2X);
    // seed = jiné číslo dá jinou náhodnou řadu posunů
    params: { turn: 650, pause: 550, shift: 0.5, radius: 1, seed: 1, intro: 400 },
    scale: introScale,
    cycle: (p) => SPIN_STEPS * (Math.max(1, p.turn + p.pause)),
    settle: (p) => p.intro,
    draw: spinDraw,
  },
};

// ───────────────────────────── přehrávač ─────────────────────────────

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export class LeafAnimation {
  /**
   * @param {Element} container  kam se vloží <svg>
   * @param {object} geometry    výsledek parseLeafSvg / loadLeafSvg
   * @param {object} [options]
   *   animation  'grow-pop' | 'grow-squish' | 'loader' | 'pairs' | 'spin'
   *   params     přepsání výchozích parametrů animace
   *   color      barva výplně (výchozí = barva z SVG; 'currentColor' = podle CSS)
   *   speed      násobek rychlosti (0.5 = zpomaleně)
   *   start      'visible' (výchozí – až se prvek objeví na obrazovce) | 'load' | 'manual'
   *   debug      ukázat, jak se tvar rozřezal
   */
  constructor(container, geometry, options = {}) {
    this.container = container;
    this.geometry = geometry;
    this.options = options;
    this.speed = options.speed ?? 1;
    this.time = 0;
    this._running = false;
    this._wantPlay = false;
    this._visible = true;
    this._build();
    this.setColor(options.color ?? geometry.fill ?? 'currentColor');
    if (options.debug) this.setDebug(true);
    this.setAnimation(options.animation || 'grow-pop', options.params);

    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = options.start || 'visible';
    if (reduce && !this.def.loop) { this.seek(this._restTime()); return; }
    if (start === 'manual') return;

    if (typeof IntersectionObserver === 'function') {
      // smyčky se mimo obrazovku zastaví; růst se spustí, až když je vidět
      this._visible = start !== 'visible';
      this._io = new IntersectionObserver(([entry]) => {
        this._visible = entry.isIntersecting;
        if (this._visible && this._wantPlay) this._start();
        else if (!this._visible && this.def.loop) this._stop();
      }, { threshold: 0.25 });
      this._io.observe(container);
    }
    this.play();
  }

  _build() {
    const g = this.geometry;
    this.svg = el('svg', { viewBox: g.viewBox.join(' '), 'aria-hidden': 'true', focusable: 'false' });
    this.svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible';
    this.group = el('g', { fill: 'currentColor' });
    this.path = el('path', { d: geometryPath(g) });
    this.group.append(this.path);
    this.svg.append(this.group);
    this.container.append(this.svg);
  }

  setAnimation(name, params) {
    const def = ANIMATIONS[name];
    if (!def) throw new Error('Neznámá animace: ' + name);
    this.name = name;
    this.def = def;
    this.params = { ...def.params, ...params };
    this.time = 0;
    if (this._debugOn) this.setDebug(true);
    this.render(0);
  }

  setParams(params) {
    Object.assign(this.params, params);
    if (!this.def.loop) this.time = 0;
    this.render(this.time);
  }

  setColor(color) {
    this.group.style.color = color === 'currentColor' ? '' : color;
  }

  setSpeed(speed) { this.speed = speed; }

  get duration() {
    return this.def.loop ? Infinity : this.def.total(this.params, this.geometry.petals.length);
  }

  /**
   * Úsek k exportu videa: u růstu celá animace, u smyček jedna celá otočka po nástupu
   * (video z ní jde přehrávat dokola bez švu).
   */
  clip() {
    if (!this.def.loop) return { start: 0, duration: this.duration, loop: false };
    const cycle = this.def.cycle(this.params, this.geometry.petals.length);
    const settle = this.def.settle ? this.def.settle(this.params) : 0;
    return { start: Math.ceil(settle / cycle - 1e-9) * cycle, duration: cycle, loop: true };
  }

  /** Okamžik, kdy je tvar celý (konec růstu, před případným zcvrknutím). */
  _restTime() {
    return this.def.loop ? 0 : growTiming(this.params, this.geometry.petals.length).grow;
  }

  play() {
    this._wantPlay = true;
    if (!this.def.loop && this.time >= this.duration) this.time = 0;
    if (this._visible) this._start();
  }

  pause() {
    this._wantPlay = false;
    this._stop();
  }

  restart() {
    this.time = 0;
    this.render(0);
    this.play();
  }

  seek(t) {
    this.time = t;
    this.render(t);
  }

  /** Právě se přehrává (false i tehdy, když je smyčka jen dočasně mimo obrazovku). */
  get playing() { return this._running; }

  /** Pozastaveno uživatelem nebo dokončeno. */
  get paused() { return !this._wantPlay; }

  _start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  _stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  _tick = (now) => {
    if (!this._running) return;
    this.time += Math.min(now - this._last, 250) * this.speed; // po přepnutí záložky neskákat
    this._last = now;
    if (this.time >= this.duration) {
      this.seek(this.duration);
      this._running = false;
      this._wantPlay = false;
      this.container.dispatchEvent(new CustomEvent('leaf-finish', { bubbles: true }));
      return;
    }
    this.render(this.time);
    this._raf = requestAnimationFrame(this._tick);
  };

  /** Vykreslí stav v čase t (ms). */
  render(t) {
    const n = this.geometry.petals.length;
    let g = this.def.scale ? Math.max(0, this.def.scale(t, this.params, n)) : 1;
    let d, angle = 0, states = [];
    if (this.def.draw) ({ d, angle = 0 } = this.def.draw(t, this.params, this.geometry));
    else for (let i = 0; i < n; i++) states.push(this.def.frame(t, i, n, this.params));
    if (this.def.square) {
      const melt = this.def.square(t, this.params, n), sq = squareSizes(this.geometry, this.params.roundness);
      if (sq && melt < 1) {
        const half = sq.start * this.params.square + (sq.hidden - sq.start * this.params.square) * melt;
        d = squarePath(this.geometry, states, half, half * this.params.roundness);
      } else if (!sq) g = melt; // SVG bez výřezů: tvar jen vyroste ze středu
    }
    this.path.setAttribute('d', d || geometryPath(this.geometry, states));

    const key = g + ' ' + angle;
    if (key !== this._transform) {
      this._transform = key;
      const [cx, cy] = this.geometry.center;
      if (g < 1e-3) this.group.setAttribute('visibility', 'hidden');
      else this.group.removeAttribute('visibility');
      if ((g === 1 && !angle) || g < 1e-3) this.group.removeAttribute('transform');
      else {
        // zvětšení g a pootočení o angle (po směru hodin) kolem středu tvaru
        const c = g * Math.cos(angle * DEG), s = g * Math.sin(angle * DEG);
        this.group.setAttribute('transform', `matrix(${c} ${s} ${-s} ${c} ${cx - c * cx + s * cy} ${cy - s * cx - c * cy})`);
      }
    }
  }

  /** Překryv ukazující, jak se tvar rozřezal na lístečky (pro kontrolu nového SVG). */
  setDebug(on) {
    this._debugOn = on;
    this._debug?.remove();
    this._debug = null;
    if (!on || this.def?.draw) return; // vlastní tvar (otáčení čtverce) se z lístečků neskládá
    const g = this.geometry, size = g.size;
    const layer = el('g', { 'pointer-events': 'none' });
    g.petals.forEach((p, i) => {
      const hue = (i * 360) / g.petals.length;
      // lísteček jako mnohoúhelník: kotva + ostré vrcholy jeho rohů
      const pts = [p.anchor, ...p.members.map((it) => it.V)];
      layer.append(el('path', {
        d: 'M' + pts.map(P).join('L') + 'Z', fill: `hsla(${hue},90%,55%,0.2)`, stroke: `hsl(${hue},90%,45%)`,
        'stroke-width': fmt(size * 0.003), 'stroke-dasharray': `${fmt(size * 0.012)} ${fmt(size * 0.008)}`,
      }));
      layer.append(el('circle', { cx: fmt(p.anchor[0]), cy: fmt(p.anchor[1]), r: fmt(size * 0.007), fill: `hsl(${hue},90%,45%)`, stroke: '#fff', 'stroke-width': fmt(size * 0.002) }));
      const label = el('text', {
        x: fmt(p.centroid[0]), y: fmt(p.centroid[1]), 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': fmt(size * 0.05), 'font-family': 'system-ui, sans-serif', 'font-weight': '700', fill: '#fff',
      });
      label.textContent = String(i + 1);
      layer.append(label);
    });
    for (const s of g.slits) layer.append(el('circle', { cx: fmt(s.tip[0]), cy: fmt(s.tip[1]), r: fmt(size * 0.006), fill: '#ff3b6b' }));
    this.svg.append(layer);
    this._debug = layer;
  }

  destroy() {
    this._stop();
    this._io?.disconnect();
    this.svg.remove();
  }
}

// ───────────────────────────── načtení SVG ─────────────────────────────

function fillOf(node) {
  for (let n = node; n && n.getAttribute; n = n.parentNode) {
    const m = (n.getAttribute('style') || '').match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);
    if (m) return m[1].trim();
    const a = n.getAttribute('fill');
    if (a) return a.trim();
  }
  return null;
}

/** Načte geometrii ze zdrojového textu SVG nebo z <svg> elementu. */
export function parseLeafSvg(source, opts = {}) {
  let svg = source;
  if (typeof source === 'string') {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Soubor nejde přečíst jako SVG.');
    svg = doc.documentElement;
  }
  if (!svg || svg.localName !== 'svg') throw new Error('Chybí element <svg>.');
  const shapes = [];
  let fill = null;
  for (const path of svg.querySelectorAll('path')) {
    const f = fillOf(path);
    if (f === 'none') continue;
    let m = [1, 0, 0, 1, 0, 0];
    for (let n = path; n && n !== svg; n = n.parentNode) m = mmul(parseTransform(n.getAttribute('transform')), m);
    shapes.push({ d: path.getAttribute('d') || '', matrix: m });
    fill ||= f;
  }
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  return buildLeafGeometry(shapes, {
    viewBox: vb.length === 4 && vb.every(Number.isFinite) ? vb : null,
    fill,
    ...opts,
  });
}

const cache = new Map();
/** Stáhne SVG ze zadané adresy a vrátí geometrii (výsledek se pro stejnou adresu sdílí). */
export function loadLeafSvg(url, opts) {
  const key = url + '|' + JSON.stringify(opts || {});
  if (!cache.has(key)) {
    cache.set(key, fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`Nepodařilo se stáhnout ${url} (${r.status}).`); return r.text(); })
      .then((text) => parseLeafSvg(text, opts)));
  }
  return cache.get(key);
}

// ───────────────────────────── <leaf-anim> ─────────────────────────────
//
// <leaf-anim src="Curve.svg" animation="loader" params='{"period":1200}' color="#004C3A"
//            speed="1" start="visible|load|manual"></leaf-anim>
// Místo src lze dovnitř vložit přímo <svg>. Velikost se řídí CSS (width), výchozí 160 px.

if (typeof window !== 'undefined' && window.customElements && !customElements.get('leaf-anim')) {
  const style = document.createElement('style');
  style.textContent = ':where(leaf-anim){display:inline-block;width:160px;line-height:0;vertical-align:middle}';
  document.head.prepend(style);

  customElements.define('leaf-anim', class extends HTMLElement {
    static get observedAttributes() { return ['animation', 'params', 'color', 'speed']; }

    async connectedCallback() {
      if (this.animation || this._pending) return;
      this._pending = true;
      try {
        if (!this._geometry) {
          const src = this.getAttribute('src');
          const inline = this.querySelector('svg');
          this._geometry = src ? await loadLeafSvg(src) : parseLeafSvg(inline);
          inline?.remove();
        }
        if (!this.isConnected) return;
        this.animation = new LeafAnimation(this, this._geometry, {
          animation: this.getAttribute('animation') || 'grow-pop',
          params: this._params(),
          color: this.getAttribute('color') || undefined,
          speed: Number(this.getAttribute('speed')) || 1,
          start: this.getAttribute('start') || 'visible',
        });
      } catch (err) {
        console.error('[leaf-anim]', err);
      } finally {
        this._pending = false;
      }
    }

    disconnectedCallback() {
      this.animation?.destroy();
      this.animation = null;
    }

    attributeChangedCallback(name) {
      const a = this.animation;
      if (!a) return;
      if (name === 'animation') { a.setAnimation(this.getAttribute('animation'), this._params()); a.play(); }
      if (name === 'params') a.setParams(this._params());
      if (name === 'color') a.setColor(this.getAttribute('color') || this._geometry.fill || 'currentColor');
      if (name === 'speed') a.setSpeed(Number(this.getAttribute('speed')) || 1);
    }

    _params() {
      try { return JSON.parse(this.getAttribute('params') || '{}'); } catch { return {}; }
    }

    play() { this.animation?.play(); }
    pause() { this.animation?.pause(); }
    restart() { this.animation?.restart(); }
  });
}
