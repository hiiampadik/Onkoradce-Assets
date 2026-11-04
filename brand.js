/*
 * Barvy značky a assety ke stažení – čistá data a funkce bez DOM,
 * používá je stránka Barvy i stránka Assety ke stažení.
 */
(function (root) {
  'use strict';

  // Barvy značky. Stejné varianty má logo.
  var COLORS = ['#004B32', '#000000', '#FFFFFF', '#00A86B'];

  // Barvy pro tisk ze vzorníku: CMYK v procentech, Pantone jen tam, kde ho vzorník uvádí.
  // preview je barva vzorku
  // na obrazovce v sRGB, odečtená ze screenshotu vzorníku (Display P3 převedené do sRGB).
  // Prostý přepočet z CMYK vychází výrazně jinak.
  var PRINT_COLORS = [
    { cmyk: [8, 8, 10, 0], preview: '#EFEAE6' },
    { cmyk: [30, 0, 0, 0], pantone: '2905', preview: '#BCE3FA' },
    { cmyk: [0, 0, 60, 0], pantone: '393 U', preview: '#FFF381' },
    { cmyk: [100, 0, 90, 0], pantone: '3405', preview: '#00964E' },
    { cmyk: [100, 60, 90, 0], preview: '#005C42' },
    { cmyk: [40, 0, 30, 0], preview: '#A6D5C2' }
  ];

  // Assety ke stažení. Soubor leží v assets/. Logo je jednobarevné, varianta
  // vznikne přebarvením všech výplní, proto stačí vyjmenovat barvy.
  var ASSETS = [
    { id: 'logo', name: 'Logo', file: 'Logo.svg', variants: COLORS }
  ];

  var FILL_STYLE = /fill:\s*(?:rgb\([^)]*\)|#[0-9a-f]{3,8})/gi;
  var FILL_ATTR = /fill="(?:rgb\([^)]*\)|#[0-9a-f]{3,8})"/gi;

  function normalizeHex(hex) {
    var h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('Neplatná barva: ' + hex);
    return '#' + h.toUpperCase();
  }

  function hexToRgb(hex) {
    var h = normalizeHex(hex).slice(1);
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }

  // Zápis jako ve vzorníku: "C8 M8 Y10 K0".
  function cmykLabel(cmyk) {
    return ['C', 'M', 'Y', 'K'].map(function (k, i) { return k + cmyk[i]; }).join(' ');
  }

  // Relativní jas podle WCAG (0 = černá, 1 = bílá).
  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  // Světlé logo se v ukázce musí kreslit na tmavém podkladu.
  function isLight(hex) {
    return luminance(hex) > 0.7;
  }

  function parseColor(value) {
    var rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value);
    return rgb ? rgbToHex(+rgb[1], +rgb[2], +rgb[3]) : normalizeHex(value);
  }

  // Přebarví všechny výplně (style="fill:…" i atribut fill="…"). fill="none" zůstává.
  function recolor(svg, hex) {
    var color = normalizeHex(hex);
    return svg
      .replace(FILL_STYLE, 'fill:' + color)
      .replace(FILL_ATTR, 'fill="' + color + '"');
  }

  // Barvy výplní použité v SVG jako HEX, bez duplicit, v pořadí výskytu.
  function usedColors(svg) {
    var found = [];
    [FILL_STYLE, FILL_ATTR].forEach(function (re) {
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(svg))) {
        var value = m[0].replace(/^fill(?::\s*|=")/i, '').replace(/"$/, '');
        var hex = parseColor(value);
        if (found.indexOf(hex) === -1) found.push(hex);
      }
    });
    return found;
  }

  // Pro vložení do HTML nebo návrhového nástroje stačí samotný <svg>, bez <?xml?> a DOCTYPE.
  function stripProlog(svg) {
    var i = svg.indexOf('<svg');
    return i > 0 ? svg.slice(i) : svg;
  }

  function fileName(assetId, hex) {
    return 'onkoradce-' + assetId + '-' + normalizeHex(hex).slice(1).toLowerCase() + '.svg';
  }

  var api = {
    COLORS: COLORS,
    PRINT_COLORS: PRINT_COLORS,
    ASSETS: ASSETS,
    normalizeHex: normalizeHex,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    cmykLabel: cmykLabel,
    luminance: luminance,
    isLight: isLight,
    recolor: recolor,
    usedColors: usedColors,
    stripProlog: stripProlog,
    fileName: fileName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Brand = api;
})(typeof window !== 'undefined' ? window : this);
