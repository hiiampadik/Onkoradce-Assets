(function () {
  'use strict';

  var D = ShapeGen.DEFAULTS;

  function $(id) { return document.getElementById(id); }

  var el = {
    shape: $('shape'),
    dims: $('dims'),
    depth: $('depth'),
    size: $('size'),
    color: $('color'),
    cutWidth: $('cutWidth'),
    radius: $('radius'),
    offset: $('offset'),
    copy: $('copy'),
    download: $('download'),
    reset: $('reset'),
    toast: $('toast')
  };

  var out = {
    depth: $('depth-out'),
    size: $('size-out'),
    color: $('color-out'),
    cutWidth: $('cutWidth-out'),
    radius: $('radius-out'),
    offset: $('offset-out')
  };

  var current = { svg: '', width: 0, height: 0 };

  function setDefaults() {
    el.depth.value = Math.round(D.depth * 100);
    el.size.value = D.height;
    el.color.value = D.color;
    el.cutWidth.value = D.cutWidth;
    el.radius.value = D.radius * 100;
    el.offset.value = D.offset * 100;
  }

  function read() {
    return {
      depth: el.depth.value / 100,
      height: +el.size.value,
      color: el.color.value,
      cutWidth: +el.cutWidth.value,
      radius: el.radius.value / 100,
      offset: el.offset.value / 100
    };
  }

  function round(v) { return Math.round(v * 10) / 10; }

  function render() {
    var params = read();
    // Hloubku omezuje to, aby se výřezy nesrazily – táhlo se tomu přizpůsobí.
    var maxDepth = Math.max(+el.depth.min, Math.floor(ShapeGen.maxDepth(params) * 100));
    el.depth.max = maxDepth;
    if (+el.depth.value > maxDepth) el.depth.value = maxDepth;
    params.depth = el.depth.value / 100;

    var o = ShapeGen.outline(params);
    current.svg = ShapeGen.svg(params);
    current.width = o.width;
    current.height = o.height;
    el.shape.innerHTML = current.svg;

    out.depth.textContent = el.depth.value + ' %';
    out.size.textContent = el.size.value + ' px';
    out.color.textContent = el.color.value;
    out.cutWidth.textContent = round(params.cutWidth) + ' px';
    out.radius.textContent = round(params.radius * 100) + ' % (' + round(params.radius * params.height) + ' px)';
    out.offset.textContent = round(params.offset * 100) + ' %';
    el.dims.textContent = Math.round(o.width) + ' × ' + Math.round(o.height) + ' px';
  }

  var toastTimer;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1800);
  }

  // Záloha pro prostředí bez Clipboard API (např. otevřené z file://).
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copySvg() {
    var text = current.svg;
    var done = function (ok) {
      toast(ok ? 'SVG zkopírováno do schránky' : 'Kopírování se nepovedlo');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(legacyCopy(text)); }
      );
    } else {
      done(legacyCopy(text));
    }
  }

  function downloadSvg() {
    var blob = new Blob([current.svg], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'shape-' + Math.round(current.width) + 'x' + Math.round(current.height) + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('SVG staženo');
  }

  ['depth', 'size', 'color', 'cutWidth', 'radius', 'offset'].forEach(function (k) {
    el[k].addEventListener('input', render);
  });
  el.shape.addEventListener('click', copySvg);
  el.copy.addEventListener('click', copySvg);
  el.download.addEventListener('click', downloadSvg);
  el.reset.addEventListener('click', function () { setDefaults(); render(); });

  setDefaults();
  render();
})();
