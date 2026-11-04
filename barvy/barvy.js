(function () {
  'use strict';

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { e.append(c); });
    return e;
  }

  function text(tag, className, content) {
    var e = el(tag, className ? { 'class': className } : {});
    e.textContent = content;
    return e;
  }

  function copy(value) {
    SiteUtil.copyWithToast(value, value + ' zkopírováno do schránky');
  }

  // "1 barva", "3 barvy", "9 barev"
  function countLabel(n) {
    return n + (n === 1 ? ' barva' : n >= 2 && n <= 4 ? ' barvy' : ' barev');
  }

  // Na světlém vzorku tmavé písmo, na tmavém bílé (práh odpovídá vzorníku ve Figmě).
  function inkFor(hex) {
    return Brand.luminance(hex) > 0.18 ? 'is-dark-ink' : 'is-light-ink';
  }

  // Část vzorku: barevná plocha s textem, kliknutím zkopíruje value.
  function face(hex, lines, value, title) {
    var b = el('button', { type: 'button', 'class': 'swatch-face ' + inkFor(hex), title: title || ('Zkopírovat ' + value) });
    b.style.setProperty('--c', hex);
    lines.forEach(function (line, i) { b.append(text('span', i === 0 ? 'swatch-name' : 'swatch-value', line)); });
    b.addEventListener('click', function () { copy(value); });
    return b;
  }

  function swatch(faces) {
    return el('div', { 'class': 'swatch' }, faces);
  }

  // Barva z palety: číslo nebo název (část za poslední „/“) a HEX.
  function paletteSwatch(color) {
    return swatch([face(color[1], [color[0].split('/').pop(), color[1]], color[1], color[0] + ' ' + color[1])]);
  }

  // Řádek skupiny: vlevo název a počet, vpravo vzorky.
  function row(name, swatches, wide) {
    return el('div', { 'class': 'swatch-row' }, [
      el('div', { 'class': 'swatch-row-label' }, [
        text('span', 'swatch-row-name', name),
        text('span', 'swatch-row-count', countLabel(swatches.length))
      ]),
      el('div', { 'class': 'swatch-list' + (wide ? ' is-wide' : '') }, swatches)
    ]);
  }

  function collection(title, count, note, children) {
    var head = el('div', { 'class': 'collection-head' }, [text('h2', '', title)]);
    if (count != null) head.append(text('span', 'collection-count', countLabel(count)));
    var node = el('section', { 'class': 'collection', 'aria-label': title }, [head]);
    if (note) node.append(text('p', 'collection-note', note));
    children.forEach(function (c) { node.append(c); });
    return node;
  }

  function total(groups) {
    return groups.reduce(function (n, g) { return n + g.colors.length; }, 0);
  }

  /* RGB */

  var semanticRows = [];
  var lastCategory = null;
  Palette.semanticGroups.forEach(function (g) {
    if (g.category && g.category !== lastCategory) semanticRows.push(text('h3', 'collection-category', g.category));
    lastCategory = g.category || null;
    semanticRows.push(row(g.group, g.colors.map(paletteSwatch), true));
  });

  document.getElementById('sections-rgb').append(
    collection('Logo', null, 'Barvy, ve kterých je logo ke stažení.', [
      row('Logo', Brand.COLORS.map(function (hex) { return swatch([face(hex, [hex, Brand.hexToRgb(hex).join(', ')], hex)]); }))
    ]),
    collection('DS / Color Primitives', total(Palette.primitiveGroups), null,
      Palette.primitiveGroups.map(function (g) { return row(g.group, g.colors.map(paletteSwatch)); })),
    collection('DS / Color Semantics', total(Palette.semanticGroups), null, semanticRows)
  );

  /* CMYK + Pantone: vzorek je náhled ze vzorníku, kopíruje se CMYK nebo Pantone. */

  function printSwatch(color) {
    var cmyk = Brand.cmykLabel(color.cmyk);
    var body = el('div', { 'class': 'swatch-face ' + inkFor(color.preview) });
    body.style.setProperty('--c', color.preview);

    var cmykButton = text('button', 'swatch-name', cmyk);
    cmykButton.type = 'button';
    cmykButton.title = 'Zkopírovat ' + cmyk;
    cmykButton.addEventListener('click', function () { copy(cmyk); });
    body.append(cmykButton);

    if (color.pantone) {
      var pantone = 'Pantone ' + color.pantone;
      var pantoneButton = text('button', 'swatch-value', pantone);
      pantoneButton.type = 'button';
      pantoneButton.title = 'Zkopírovat ' + pantone;
      pantoneButton.addEventListener('click', function () { copy(pantone); });
      body.append(pantoneButton);
    } else {
      body.append(text('span', 'swatch-value is-muted', 'bez Pantone'));
    }
    return swatch([body]);
  }

  document.getElementById('sections-tisk').append(
    collection('Tisk', Brand.PRINT_COLORS.length,
      'Barvy pro tisk ze vzorníku. Vzorek na obrazovce je orientační, pro tisk platí hodnoty CMYK a Pantone.',
      [row('CMYK', Brand.PRINT_COLORS.map(printSwatch), true)])
  );

  // Podtaby RGB a CMYK + Pantone. Tisk má adresu #tisk, aby šel poslat odkazem.
  function setTab(tab) {
    document.querySelectorAll('.subtab').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
    });
    document.querySelectorAll('[data-tab-panel]').forEach(function (p) {
      p.hidden = p.dataset.tabPanel !== tab;
    });
    try {
      history.replaceState(null, '', tab === 'tisk' ? '#tisk' : location.pathname + location.search);
    } catch (e) { /* např. file:// v některých prohlížečích */ }
  }

  document.querySelectorAll('.subtab').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });
  setTab(location.hash === '#tisk' ? 'tisk' : 'rgb');
})();
