/*
 * Geometrie tvaru – čistá funkce bez závislosti na DOM.
 *
 * Tvar je obdélník 10:9 (9 = výška) se šesti výřezy:
 *   – svislý nahoře a dole (vycentrované na ose x),
 *   – vodorovný vlevo a vpravo (posunuté od diagonálního výřezu),
 *   – dva protilehlé diagonální (pod 45° z rohů vlevo nahoře a vpravo dole).
 *
 * Obrys se nejdřív sestaví jako polygon s ostrými rohy a pak se každý roh
 * zaoblí obloukem:
 *   – konce výřezů: poloměr = polovina šířky výřezu (půlkruh),
 *   – hlavní rohy bez diagonálního výřezu (vpravo nahoře, vlevo dole): X,
 *   – všechny ostatní vnější rohy (ústí výřezů): 2·X.
 */
(function (root) {
  'use strict';

  var SQRT2 = Math.SQRT2;
  var EPS = 1e-9;

  var DEFAULTS = {
    height: 400,      // px; šířka = height · aspect
    aspect: 10 / 9,
    depth: 0.62,      // 0–1: do jaké části vzdálenosti okraj→střed výřezy zasahují
    cutWidth: 9,      // px; absolutní, nezávisí na velikosti tvaru
    radius: 0.05,     // X jako podíl výšky
    offset: 0.075,    // posun vodorovných výřezů od středu jako podíl výšky
    color: '#009355'
  };

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function normalize(input) {
    var p = {};
    var k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    for (k in (input || {})) if (input[k] !== undefined) p[k] = input[k];
    p.height = clamp(+p.height, 20, 20000);
    p.depth = clamp(+p.depth, 0.05, 0.92);
    p.cutWidth = clamp(+p.cutWidth, 0.5, p.height / 10);
    p.radius = clamp(+p.radius, 0, 0.2);
    p.offset = clamp(+p.offset, 0, 0.2);
    return p;
  }

  /*
   * Středy půlkruhových špiček šesti výřezů vůči středu tvaru, pokud špičky
   * (měřeno podél osy výřezu) leží ve vzdálenosti R od středu.
   */
  function tipCenters(p, R) {
    var H = p.height;
    var h = p.cutWidth / 2;
    var off = p.offset * H;
    var g = (H * p.aspect - H) / 4;
    var r = R - h;
    var d = (R + h) / SQRT2;
    return [
      [0, -r], [0, r],                  // svislé
      [-r, off], [r, -off],             // vodorovné
      [-g - d, g - d], [g + d, -g + d]  // diagonální
    ];
  }

  function distToSegment(pt, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var t = clamp(((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
  }

  // Nejmenší vzdálenost osy kteréhokoli výřezu od špičky jiného výřezu (vůči středu tvaru).
  function tipClearance(p, R) {
    var H = p.height;
    var W = H * p.aspect;
    var off = p.offset * H;
    var tips = tipCenters(p, R);
    var mouths = [
      [0, -H / 2], [0, H / 2], [-W / 2, off], [W / 2, -off], [-W / 2, -H / 2], [W / 2, H / 2]
    ];
    var min = Infinity;
    for (var i = 0; i < tips.length; i++) {
      for (var j = 0; j < tips.length; j++) {
        if (i !== j) min = Math.min(min, distToSegment(tips[j], mouths[i], tips[i]));
      }
    }
    return min;
  }

  /*
   * Nejmenší vzdálenost špiček od středu, při které mezi sousedními výřezy
   * zůstane aspoň jedna šířka výřezu materiálu (jinak by se výřezy srazily).
   */
  function minReach(p) {
    var h = p.cutWidth / 2;
    var need = 4 * h;
    var lo = h;
    var hi = p.height / 2 - 2 * h;
    if (tipClearance(p, lo) >= need) return lo;
    if (tipClearance(p, hi) < need) return hi;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      if (tipClearance(p, mid) >= need) hi = mid; else lo = mid;
    }
    return hi;
  }

  // Největší hloubka (0–1), při které se tvar při daných ostatních parametrech ještě nerozpadne.
  function maxDepth(input) {
    var p = normalize(input);
    return clamp(1 - minReach(p) / (p.height / 2), 0, 0.92);
  }

  /*
   * Vrcholy obrysu po směru hodinových ručiček (osa y míří dolů).
   * Každý vrchol: x, y, r (požadovaný poloměr), fixed (konec výřezu – poloměr
   * se při nedostatku místa nezmenšuje).
   */
  function vertices(p) {
    var H = p.height;
    var W = H * p.aspect;
    var h = p.cutWidth / 2;
    var X = p.radius * H;
    var X2 = 2 * X;
    var cx = W / 2;
    var cy = H / 2;
    var off = p.offset * H;

    // Špičky výřezů jsou ve stejné vzdálenosti R od středu (měřeno podél osy výřezu).
    // Hloubka je omezená zdola (výřez se vejde i s půlkruhovým koncem) i shora (výřezy se nesrazí).
    var R = Math.min(Math.max((1 - p.depth) * H / 2, minReach(p)), H / 2 - 2 * h);
    var dV = H / 2 - R;
    var dH = W / 2 - R;
    var dD = (cx + cy) / SQRT2 - R;

    var v = [];
    function add(x, y, r, fixed) {
      v.push({ x: x, y: y, r: r, fixed: !!fixed });
    }

    var hs = h * SQRT2;
    var a = dD / SQRT2;   // průmět hrotu diagonály na osu x i y
    var q = h / SQRT2;

    // horní hrana, zleva doprava
    add(hs, 0, X2);                         // diag TL – horní stěna
    add(cx - h, 0, X2);                     // svislý nahoře – levá stěna
    add(cx - h, dV, h, true);
    add(cx + h, dV, h, true);
    add(cx + h, 0, X2);                     // svislý nahoře – pravá stěna
    add(W, 0, X);                           // hlavní roh vpravo nahoře
    // pravá hrana, shora dolů
    add(W, cy - off - h, X2);               // vodorovný vpravo – horní stěna
    add(W - dH, cy - off - h, h, true);
    add(W - dH, cy - off + h, h, true);
    add(W, cy - off + h, X2);               // vodorovný vpravo – dolní stěna
    add(W, H - hs, X2);                     // diag BR – horní stěna
    add(W - a + q, H - a - q, h, true);
    add(W - a - q, H - a + q, h, true);
    add(W - hs, H, X2);                     // diag BR – dolní stěna
    // dolní hrana, zprava doleva
    add(cx + h, H, X2);                     // svislý dole – pravá stěna
    add(cx + h, H - dV, h, true);
    add(cx - h, H - dV, h, true);
    add(cx - h, H, X2);                     // svislý dole – levá stěna
    add(0, H, X);                           // hlavní roh vlevo dole
    // levá hrana, zdola nahoru
    add(0, cy + off + h, X2);               // vodorovný vlevo – dolní stěna
    add(dH, cy + off + h, h, true);
    add(dH, cy + off - h, h, true);
    add(0, cy + off - h, X2);               // vodorovný vlevo – horní stěna
    add(0, hs, X2);                         // diag TL – dolní stěna
    add(a - q, a + q, h, true);
    add(a + q, a - q, h, true);

    return { vertices: v, width: W, height: H };
  }

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function unit(a) { var l = len(a); return { x: a.x / l, y: a.y / l }; }

  // Úhel mezi hranami ve vrcholu i (0–π) a délky sousedních hran.
  function corner(vs, i) {
    var n = vs.length;
    var P = vs[(i + n - 1) % n];
    var V = vs[i];
    var N = vs[(i + 1) % n];
    var u1 = unit(sub(P, V));
    var u2 = unit(sub(N, V));
    var cos = clamp(u1.x * u2.x + u1.y * u2.y, -1, 1);
    return { u1: u1, u2: u2, theta: Math.acos(cos), P: P, N: N };
  }

  function tangent(r, theta) {
    return r / Math.tan(theta / 2);
  }

  /*
   * Poloměry nesmí přesáhnout dostupné místo na hraně: součet tangent obou
   * koncových vrcholů musí být ≤ délka hrany. Poloměry se jen zmenšují, takže
   * stačí jeden průchod.
   */
  function fitRadii(vs) {
    var n = vs.length;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var ci = corner(vs, i);
      var cj = corner(vs, j);
      var L = len(sub(vs[j], vs[i]));
      var ti = tangent(vs[i].r, ci.theta);
      var tj = tangent(vs[j].r, cj.theta);
      if (ti + tj <= L + EPS) continue;
      if (vs[i].fixed && !vs[j].fixed) {
        vs[j].r = Math.max(0, (L - ti)) * Math.tan(cj.theta / 2);
      } else if (vs[j].fixed && !vs[i].fixed) {
        vs[i].r = Math.max(0, (L - tj)) * Math.tan(ci.theta / 2);
      } else if (!vs[i].fixed && !vs[j].fixed) {
        var k = L / (ti + tj);
        vs[i].r *= k;
        vs[j].r *= k;
      }
    }
  }

  /*
   * Obrys jako seznam zaoblených rohů:
   *   { t1, t2, r, sweep, c }  – body dotyku na příchozí / odchozí hraně,
   *   poloměr, směr oblouku (SVG sweep-flag) a střed oblouku.
   * Pro r = 0 je t1 = t2 = vrchol.
   */
  function outline(input) {
    var p = normalize(input);
    var g = vertices(p);
    var vs = g.vertices;
    fitRadii(vs);

    var n = vs.length;
    var corners = [];
    for (var i = 0; i < n; i++) {
      var V = vs[i];
      var c = corner(vs, i);
      var r = V.r;
      if (r < 1e-6) {
        corners.push({ t1: { x: V.x, y: V.y }, t2: { x: V.x, y: V.y }, r: 0, sweep: 0, c: { x: V.x, y: V.y } });
        continue;
      }
      var t = tangent(r, c.theta);
      var bis = unit({ x: c.u1.x + c.u2.x, y: c.u1.y + c.u2.y });
      var dc = r / Math.sin(c.theta / 2);
      var d1 = sub(V, c.P);
      var d2 = sub(c.N, V);
      var cross = d1.x * d2.y - d1.y * d2.x;
      corners.push({
        t1: { x: V.x + c.u1.x * t, y: V.y + c.u1.y * t },
        t2: { x: V.x + c.u2.x * t, y: V.y + c.u2.y * t },
        r: r,
        sweep: cross > 0 ? 1 : 0,
        c: { x: V.x + bis.x * dc, y: V.y + bis.y * dc }
      });
    }
    return { corners: corners, width: g.width, height: g.height, params: p };
  }

  function fmt(v) {
    var s = (Math.round(v * 100) / 100).toString();
    return s === '-0' ? '0' : s;
  }

  function pathData(o) {
    var cs = o.corners;
    var d = 'M' + fmt(cs[0].t2.x) + ' ' + fmt(cs[0].t2.y);
    for (var i = 1; i <= cs.length; i++) {
      var c = cs[i % cs.length];
      d += 'L' + fmt(c.t1.x) + ' ' + fmt(c.t1.y);
      if (c.r > 0) {
        d += 'A' + fmt(c.r) + ' ' + fmt(c.r) + ' 0 0 ' + c.sweep + ' ' + fmt(c.t2.x) + ' ' + fmt(c.t2.y);
      }
    }
    return d + 'Z';
  }

  function svg(input) {
    var o = outline(input);
    var w = fmt(o.width);
    var h = fmt(o.height);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<path fill="' + o.params.color + '" d="' + pathData(o) + '"/></svg>';
  }

  var api = {
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    maxDepth: maxDepth,
    outline: outline,
    pathData: pathData,
    svg: svg
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShapeGen = api;
})(typeof window !== 'undefined' ? window : this);
