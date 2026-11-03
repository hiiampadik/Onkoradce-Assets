(function () {
  'use strict';

  var host = document.getElementById('sections');

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

  // Jedna barva: vzorek (kopíruje HEX), volitelně název a odkaz na primitivum, HEX a RGB.
  function tile(color) {
    var rgb = 'rgb(' + Brand.hexToRgb(color.hex).join(', ') + ')';

    var swatch = el('button', { type: 'button', 'class': 'tile-swatch', 'aria-label': 'Zkopírovat ' + color.hex, title: color.name || color.hex });
    swatch.style.setProperty('--c', color.hex);
    swatch.addEventListener('click', function () { copy(color.hex); });

    var hex = text('button', 'chip', color.hex);
    hex.type = 'button';
    hex.addEventListener('click', function () { copy(color.hex); });

    var rgbButton = text('button', 'chip is-secondary', rgb);
    rgbButton.type = 'button';
    rgbButton.addEventListener('click', function () { copy(rgb); });

    var meta = el('div', { 'class': 'tile-meta' });
    if (color.label) meta.append(text('span', 'tile-name', color.label));
    if (color.primitive) meta.append(text('span', 'tile-ref', '= ' + color.primitive));
    meta.append(hex, rgbButton);

    return el('div', { 'class': 'tile' }, [swatch, meta]);
  }

  // Názvy typu "green/500" nebo "text/brand/strong": první část je skupina, zbytek název barvy.
  function groupByPrefix(colors) {
    var groups = [];
    var index = {};
    colors.forEach(function (c) {
      var parts = c.name.split('/');
      var key = parts[0];
      if (!(key in index)) { index[key] = groups.length; groups.push({ name: key, colors: [] }); }
      groups[index[key]].colors.push(Object.assign({}, c, { label: parts.slice(1).join('/') }));
    });
    return groups;
  }

  function section(title, note, groups) {
    var node = el('section', { 'class': 'surface color-section', 'aria-label': title });
    node.append(text('h2', '', title));
    if (note) node.append(text('p', 'section-note', note));
    groups.forEach(function (g) {
      var group = el('div', { 'class': 'color-group' });
      if (g.name) group.append(text('h3', 'group-label', g.name));
      group.append(el('div', { 'class': 'tiles' }, g.colors.map(tile)));
      node.append(group);
    });
    return node;
  }

  host.append(
    section('Logo', 'Barvy, ve kterých je logo ke stažení.', [
      { name: '', colors: Brand.COLORS.map(function (hex) { return { hex: hex }; }) }
    ]),
    section('Primitives', 'Základní škála barev. Čísla 50 až 900 jdou od nejsvětlejšího odstínu po nejtmavší.', groupByPrefix(Palette.primitives)),
    section('Semantics', 'Barvy podle významu. U každé je vidět, na kterou základní barvu odkazuje.', groupByPrefix(Palette.semantics))
  );
})();
