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

  // Šířka výřezu se zadává pro tvar vysoký REF_HEIGHT. Při poloviční výšce má výřez
  // 75 % zadané šířky, při čtvrtinové 0,75² atd. (viz cutWidthAt).
  var REF_HEIGHT = 1000;
  var CUT_SCALE_PER_HALVING = 0.75;

  // Výchozí šířka výřezu při zobrazení v mm (pro výšku REF_HEIGHT), v px je to DEFAULTS.cutWidth.
  var DEFAULT_CUT_MM = 5;

  var DEFAULTS = {
    height: 750,      // px; šířka = height · aspect
    aspect: 10 / 9,
    depth: 0.7,        // 0–1: do jaké části vzdálenosti okraj→střed výřezy zasahují
    cutWidth: 23,     // px při výšce REF_HEIGHT; při jiné výšce se přepočte (cutWidthAt)
    radius: 0.05,     // X jako podíl výšky
    offset: 0.075,    // posun vodorovných výřezů od středu jako podíl výšky
    color: '#149B58'  // green/500 z palety, aby šla barva vybrat ve vzorníku
  };

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  // Šířka výřezu při dané výšce tvaru: refWidth platí pro REF_HEIGHT, při každém
  // zmenšení výšky na polovinu klesne na 75 % (mocninná funkce, plynule i mezi tím).
  function cutWidthAt(height, refWidth) {
    return refWidth * Math.pow(height / REF_HEIGHT, Math.log(CUT_SCALE_PER_HALVING) / Math.log(0.5));
  }

  // Očekává „surové“ vstupy. cutWidth na vstupu je šířka pro REF_HEIGHT, ve výstupu
  // je to už šířka v px pro zadanou výšku, proto se výstup nesmí normalizovat znovu.
  function normalize(input) {
    var p = {};
    var k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    for (k in (input || {})) if (input[k] !== undefined) p[k] = input[k];
    p.height = clamp(+p.height, 20, 20000);
    p.depth = clamp(+p.depth, 0.05, 0.92);
    p.cutWidth = clamp(cutWidthAt(p.height, +p.cutWidth), 0.5, p.height / 10);
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

  // Počet desetinných míst ve výstupu (výchozí 2).
  function fmt(v, digits) {
    var f = Math.pow(10, digits === undefined ? 2 : digits);
    var s = (Math.round(v * f) / f).toString();
    return s === '-0' ? '0' : s;
  }

  function pathData(o, digits) {
    var cs = o.corners;
    var d = 'M' + fmt(cs[0].t2.x, digits) + ' ' + fmt(cs[0].t2.y, digits);
    for (var i = 1; i <= cs.length; i++) {
      var c = cs[i % cs.length];
      d += 'L' + fmt(c.t1.x, digits) + ' ' + fmt(c.t1.y, digits);
      if (c.r > 0) {
        d += 'A' + fmt(c.r, digits) + ' ' + fmt(c.r, digits) + ' 0 0 ' + c.sweep + ' ' +
          fmt(c.t2.x, digits) + ' ' + fmt(c.t2.y, digits);
      }
    }
    return d + 'Z';
  }

  /*
   * Jednotky exportu. Tvar se počítá v px (CSS px, 96 na palec), do milimetrů se
   * přepočte až na výstupu. V režimu mm je jedna jednotka souřadnic SVG 1 mm a
   * width/height nesou příponu mm, takže se soubor otevře ve skutečné velikosti.
   */
  var MM_PER_PX = 25.4 / 96;

  /*
   * Velikost náhledu „100 %“ podle Affinity. Velikost dokumentu na displeji při 100 % nezávisí na DPI
   * dokumentu, ale na displeji, a prohlížeč ji nezná (CSS počítá 96 px na palec, což není skutečný palec).
   * Proto je to kalibrace: zoom říká, kolikrát větší než v CSS je tvar v Affinity při 100 %. Naměřeno
   * ze screenshotů s vloženými tvary (122, 111, 110 a 100,5 mm: v Affinity 1,578× až 1,584× větší než v CSS) a z údaje uživatele „100 mm = 600 px na obrazovce“ (1,5875×), pak se dá upravit ručně.
   * Zoom platí pro displej s dpr calibDpr; při jiném dpr (přiblížení stránky) se přepočte, aby tvar
   * zůstal na displeji stejně velký jako v Affinity.
   */
  var DEFAULT_AFFINITY_ZOOM = 6 * 25.4 / 96; // 1,5875: 100 mm je v Affinity při 100 % 600 px displeje

  function affinityScale(zoom, dpr, calibDpr) {
    var now = dpr || 1;
    return zoom * (calibDpr || now) / now;
  }

  function unitInfo(unit) {
    return unit === 'mm' ? { k: MM_PER_PX, suffix: 'mm', digits: 3 } : { k: 1, suffix: '', digits: 2 };
  }

  // Obrys v jiné jednotce (k = nová jednotka na px): souřadnice i poloměry.
  function scaleOutline(o, k) {
    function pt(p) { return { x: p.x * k, y: p.y * k }; }
    return {
      corners: o.corners.map(function (c) {
        return { t1: pt(c.t1), t2: pt(c.t2), r: c.r * k, sweep: c.sweep, c: pt(c.c) };
      }),
      width: o.width * k,
      height: o.height * k,
      params: o.params
    };
  }

  function svg(input, unit) {
    var u = unitInfo(unit);
    var o = scaleOutline(outline(input), u.k);
    var w = fmt(o.width, u.digits);
    var h = fmt(o.height, u.digits);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + u.suffix + '" height="' + h + u.suffix +
      '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<path fill="' + o.params.color + '" d="' + pathData(o, u.digits) + '"/></svg>';
  }

  /*
   * Varianta „maska se září“: tvar nemá vlastní barvu, je to jen okno, kterým
   * prosvítá záře z bodů. Každý bod je kruh s radiálním přechodem (barva se
   * k okraji vytrácí do průhledna) a celek je ořezaný obrysem tvaru.
   *
   * Bod: x, y = poloha jako podíl šířky a výšky tvaru (0–1),
   *      size = poloměr záře jako podíl výšky, color = HEX.
   */
  var MAX_GLOW_POINTS = 12;
  var GLOW_SIZE = { min: 0.1, max: 1.5 };

  // Přechod jako [offset, průhlednost]. Blíží se Gaussovce, takže záře nemá viditelný okraj.
  var GLOW_STOPS = [[0, 1], [0.3, 1], [0.55, 0.78], [0.8, 0.28], [1, 0]];

  // Barvy jsou z palety (primitives), aby šly vybrat ve vzorníku. Později uvedený bod
  // se kreslí přes dřívější: zelená tvoří podklad, žlutá a modrá ji přebarvují a bílá zesvětluje.
  var DEFAULT_GLOW = [
    { x: 0.24, y: 0.78, color: '#ADF0C1', size: 1.1 },
    { x: 0.86, y: 0.17, color: '#F1ED6F', size: 0.75 },
    { x: 0.78, y: 0.92, color: '#D4EBF1', size: 0.65 },
    { x: 0.03, y: 0.3, color: '#FFFFFF', size: 0.42 }
  ];

  // Barvy, které dostávají nově přidané body (střídají se).
  var NEW_GLOW_COLORS = ['#ADF0C1', '#F9F7B4', '#D4EBF1', '#FFFFFF', '#FDCE9A', '#ACD9E2'];

  function glowColor(c) {
    var s = String(c).trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
    return '#FFFFFF';
  }

  function normalizeGlow(points) {
    return (points || []).slice(0, MAX_GLOW_POINTS).map(function (p) {
      return {
        x: clamp(+p.x || 0, 0, 1),
        y: clamp(+p.y || 0, 0, 1),
        color: glowColor(p.color),
        size: clamp(+p.size || GLOW_SIZE.min, GLOW_SIZE.min, GLOW_SIZE.max)
      };
    });
  }

  // Krátký otisk obsahu: id v SVG se tak neshodují, když jich je na stránce víc.
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function glowSvg(input, points, unit) {
    var u = unitInfo(unit);
    var o = scaleOutline(outline(input), u.k);
    var pts = normalizeGlow(points);
    var d = pathData(o, u.digits);
    var id = hash(d + JSON.stringify(pts));
    var w = fmt(o.width, u.digits);
    var h = fmt(o.height, u.digits);

    var defs = '<clipPath id="shape-' + id + '"><path d="' + d + '"/></clipPath>';
    var circles = '';
    pts.forEach(function (p, i) {
      var gid = 'glow-' + id + '-' + i;
      var cx = fmt(p.x * o.width, u.digits);
      var cy = fmt(p.y * o.height, u.digits);
      var r = fmt(p.size * o.height, u.digits);
      // Střed a poloměr přechodu jsou zapsané výslovně v souřadnicích SVG. Affinity při
      // vložení nezná výchozí hodnoty (50 % obdélníku kruhu) a vykreslí tvrdé kruhy.
      defs += '<radialGradient id="' + gid + '" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy +
        '" r="' + r + '">' + GLOW_STOPS.map(function (s) {
          return '<stop offset="' + s[0] + '" stop-color="' + p.color + '" stop-opacity="' + s[1] + '"/>';
        }).join('') + '</radialGradient>';
      circles += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + gid + ')"/>';
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + u.suffix + '" height="' + h + u.suffix +
      '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs>' + defs + '</defs>' +
      '<g clip-path="url(#shape-' + id + ')">' + circles + '</g></svg>';
  }

  var api = {
    DEFAULTS: DEFAULTS,
    REF_HEIGHT: REF_HEIGHT,
    DEFAULT_CUT_MM: DEFAULT_CUT_MM,
    DEFAULT_AFFINITY_ZOOM: DEFAULT_AFFINITY_ZOOM,
    affinityScale: affinityScale,
    MM_PER_PX: MM_PER_PX,
    cutWidthAt: cutWidthAt,
    DEFAULT_GLOW: DEFAULT_GLOW,
    NEW_GLOW_COLORS: NEW_GLOW_COLORS,
    MAX_GLOW_POINTS: MAX_GLOW_POINTS,
    GLOW_SIZE: GLOW_SIZE,
    normalize: normalize,
    normalizeGlow: normalizeGlow,
    maxDepth: maxDepth,
    outline: outline,
    pathData: pathData,
    svg: svg,
    glowSvg: glowSvg
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShapeGen = api;
})(typeof window !== 'undefined' ? window : this);
