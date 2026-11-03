(function () {
  'use strict';

  var body = document.getElementById('assets-body');
  var errorBox = document.getElementById('assets-error');

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { e.append(c); });
    return e;
  }

  function cell(label, content) {
    return el('td', { 'data-label': label }, content);
  }

  function row(asset, hex, svg) {
    var colored = Brand.recolor(svg, hex);
    var file = Brand.fileName(asset.id, hex);
    var previewUrl = URL.createObjectURL(new Blob([colored], { type: 'image/svg+xml' }));

    var preview = el('div', { 'class': 'preview' + (Brand.isLight(hex) ? ' is-dark' : '') }, [
      el('img', { src: previewUrl, alt: asset.name + ' ' + hex })
    ]);

    var colors = el('div', { 'class': 'colors' }, Brand.usedColors(colored).map(function (c) {
      var swatch = el('i', {});
      swatch.style.setProperty('--c', c);
      return el('span', { 'class': 'color-chip' }, [swatch, c]);
    }));

    var download = el('button', { type: 'button', 'class': 'btn' });
    download.textContent = 'Stáhnout SVG';
    download.addEventListener('click', function () {
      SiteUtil.downloadText(file, colored, 'image/svg+xml');
      SiteUtil.toast('Staženo: ' + file);
    });

    var copy = el('button', { type: 'button', 'class': 'btn' });
    copy.textContent = 'Kopírovat SVG';
    copy.addEventListener('click', function () {
      SiteUtil.copyWithToast(Brand.stripProlog(colored), 'SVG zkopírováno do schránky');
    });

    var name = el('div', { 'class': 'asset-name' });
    name.textContent = asset.name;
    var fileName = el('div', { 'class': 'asset-file' });
    fileName.textContent = file;

    return el('tr', {}, [
      cell('Ukázka', [preview]),
      cell('Asset', [name, fileName]),
      cell('Použité barvy', [colors]),
      el('td', { 'class': 'col-actions' }, [el('div', { 'class': 'actions' }, [download, copy])])
    ]);
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  Promise.all(Brand.ASSETS.map(function (asset) {
    return fetch('../assets/' + asset.file, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (svg) {
        asset.variants.forEach(function (hex) { body.append(row(asset, hex, svg)); });
      });
  })).catch(function () {
    showError(location.protocol === 'file:'
      ? 'Stránka je otevřená přímo ze souboru, prohlížeč v tom případě nenačte SVG. V kořenové složce projektu spusť python3 -m http.server 8765 a otevři http://localhost:8765/assety/.'
      : 'Assety se nepodařilo načíst.');
  });
})();
