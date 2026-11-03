(function () {
  'use strict';

  var D = ShapeGen.DEFAULTS;
  var MAX_POINTS = ShapeGen.MAX_GLOW_POINTS;
  var NEW_COLORS = ShapeGen.NEW_GLOW_COLORS;
  var NEW_SIZE = 0.5;

  function $(id) { return document.getElementById(id); }
  function all(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round(v) { return Math.round(v * 10) / 10; }

  var el = {
    stage: document.querySelector('.stage'),
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
    glowArt: $('glow-art'),
    glowHandles: $('glow-handles'),
    glowChips: $('glow-chips'),
    glowAdd: $('glow-add'),
    glowColor: $('glow-color'),
    glowSize: $('glow-size'),
    glowRemove: $('glow-remove')
  };

  var out = {
    depth: $('depth-out'),
    size: $('size-out'),
    cutWidth: $('cutWidth-out'),
    radius: $('radius-out'),
    offset: $('offset-out'),
    glowSize: $('glow-size-out')
  };

  // mode: 'solid' (jednobarevný tvar) nebo 'glow' (maska se září z bodů)
  var state = { mode: 'solid', points: [], selected: 0 };
  var current = { svg: '', width: 0, height: 0 };

  function setDefaults() {
    el.depth.value = Math.round(D.depth * 100);
    el.size.value = D.height;
    el.color.value = D.color;
    el.cutWidth.value = D.cutWidth;
    el.radius.value = D.radius * 100;
    el.offset.value = D.offset * 100;
    state.points = ShapeGen.DEFAULT_GLOW.map(function (p) { return Object.assign({}, p); });
    state.selected = 0;
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

  function render() {
    var params = read();
    // Hloubku omezuje to, aby se výřezy nesrazily – táhlo se tomu přizpůsobí.
    var maxDepth = Math.max(+el.depth.min, Math.floor(ShapeGen.maxDepth(params) * 100));
    el.depth.max = maxDepth;
    if (+el.depth.value > maxDepth) el.depth.value = maxDepth;
    params.depth = el.depth.value / 100;

    var o = ShapeGen.outline(params);
    if (state.mode === 'glow') {
      current.svg = ShapeGen.glowSvg(params, state.points);
      el.glowArt.innerHTML = current.svg;
    } else {
      current.svg = ShapeGen.svg(params);
      el.shape.innerHTML = current.svg;
    }
    current.width = o.width;
    current.height = o.height;

    out.depth.textContent = el.depth.value + ' %';
    out.size.textContent = el.size.value + ' px';
    out.cutWidth.textContent = round(params.cutWidth) + ' px';
    out.radius.textContent = round(params.radius * 100) + ' % (' + round(params.radius * params.height) + ' px)';
    out.offset.textContent = round(params.offset * 100) + ' %';
    el.dims.textContent = Math.round(o.width) + ' × ' + Math.round(o.height) + ' px';
  }

  /* ───────────── Body záře ───────────── */

  // Barva a číslo na bodu a na čipu; číslo musí být čitelné i na světlé barvě.
  function paint(node, point) {
    node.style.setProperty('--c', point.color);
    node.style.setProperty('--on', Brand.isLight(point.color) ? '#1b2420' : '#fff');
  }

  function place(handle, point) {
    handle.style.left = point.x * 100 + '%';
    handle.style.top = point.y * 100 + '%';
  }

  function makeChip(point, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.i = i;
    b.textContent = i + 1;
    b.setAttribute('aria-label', 'Bod záře ' + (i + 1));
    paint(b, point);
    return b;
  }

  function makeHandle(point, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'glow-handle';
    b.dataset.i = i;
    b.textContent = i + 1;
    b.title = 'Přetáhni myší nebo posuň šipkami, Delete bod odebere';
    b.setAttribute('aria-label', 'Bod záře ' + (i + 1));
    paint(b, point);
    place(b, point);
    return b;
  }

  // Označený bod: zvýraznění v náhledu i v seznamu a jeho ovládací prvky v panelu.
  function syncSelection() {
    var p = state.points[state.selected];
    all('.chip, .glow-handle').forEach(function (n) {
      n.setAttribute('aria-pressed', String(+n.dataset.i === state.selected));
    });
    el.glowColor.value = p.color;
    el.glowSize.value = Math.round(p.size * 100);
    out.glowSize.textContent = Math.round(p.size * 100) + ' %';
  }

  // Přestaví všechny body (po přidání nebo odebrání).
  function renderPoints() {
    el.glowChips.replaceChildren.apply(el.glowChips, state.points.map(makeChip));
    el.glowHandles.replaceChildren.apply(el.glowHandles, state.points.map(makeHandle));
    el.glowRemove.disabled = state.points.length <= 1;
    el.glowAdd.disabled = state.points.length >= MAX_POINTS;
    syncSelection();
    render();
  }

  function select(i) {
    state.selected = i;
    syncSelection();
  }

  function move(i, x, y) {
    var p = state.points[i];
    p.x = clamp(x, 0, 1);
    p.y = clamp(y, 0, 1);
    place(el.glowHandles.children[i], p);
    render();
  }

  // Nejvolnější místo ve tvaru (nejdál od existujících bodů).
  function emptySpot() {
    var best = [0.5, 0.5];
    var bestDist = -1;
    for (var gx = 1; gx <= 5; gx++) {
      for (var gy = 1; gy <= 5; gy++) {
        var x = gx / 6;
        var y = gy / 6;
        var d = Math.min.apply(null, state.points.map(function (p) { return Math.hypot(p.x - x, p.y - y); }));
        if (d > bestDist) { bestDist = d; best = [x, y]; }
      }
    }
    return best;
  }

  function addPoint(x, y) {
    if (state.points.length >= MAX_POINTS) return;
    var spot = x === undefined ? emptySpot() : [x, y];
    state.points.push({
      x: clamp(spot[0], 0, 1),
      y: clamp(spot[1], 0, 1),
      color: NEW_COLORS[state.points.length % NEW_COLORS.length],
      size: NEW_SIZE
    });
    state.selected = state.points.length - 1;
    renderPoints();
  }

  function removePoint(i) {
    if (state.points.length <= 1) return;
    state.points.splice(i, 1);
    state.selected = Math.min(state.selected, state.points.length - 1);
    renderPoints();
  }

  // Poloha ukazatele jako podíl šířky a výšky tvaru.
  function pointerPos(e) {
    var r = el.glowHandles.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  var drag = null;

  el.glowHandles.addEventListener('pointerdown', function (e) {
    var h = e.target.closest('.glow-handle');
    if (!h || e.button > 0) return;
    e.preventDefault();
    h.focus();
    var i = +h.dataset.i;
    select(i);
    var pos = pointerPos(e);
    // Bod se drží tam, kde ho ukazatel chytil, a nepřeskočí středem pod ukazatel.
    drag = { id: e.pointerId, i: i, dx: state.points[i].x - pos[0], dy: state.points[i].y - pos[1] };
    h.setPointerCapture(e.pointerId);
  });

  el.glowHandles.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var pos = pointerPos(e);
    move(drag.i, pos[0] + drag.dx, pos[1] + drag.dy);
  });

  function endDrag(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }
  el.glowHandles.addEventListener('pointerup', endDrag);
  el.glowHandles.addEventListener('pointercancel', endDrag);

  // Dvojklik do prázdného místa přidá bod.
  el.glowHandles.addEventListener('dblclick', function (e) {
    if (e.target !== el.glowHandles) return;
    var pos = pointerPos(e);
    addPoint(pos[0], pos[1]);
  });

  el.glowHandles.addEventListener('keydown', function (e) {
    var h = e.target.closest('.glow-handle');
    if (!h) return;
    var i = +h.dataset.i;
    var p = state.points[i];
    var step = e.shiftKey ? 0.05 : 0.01;
    if (e.key === 'ArrowLeft') move(i, p.x - step, p.y);
    else if (e.key === 'ArrowRight') move(i, p.x + step, p.y);
    else if (e.key === 'ArrowUp') move(i, p.x, p.y - step);
    else if (e.key === 'ArrowDown') move(i, p.x, p.y + step);
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      removePoint(i);
      el.glowHandles.children[state.selected].focus();
    } else return;
    e.preventDefault();
  });

  el.glowChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) select(+chip.dataset.i);
  });

  el.glowAdd.addEventListener('click', function () { addPoint(); });
  el.glowRemove.addEventListener('click', function () { removePoint(state.selected); });

  el.glowColor.addEventListener('input', function () {
    var p = state.points[state.selected];
    p.color = el.glowColor.value;
    paint(el.glowChips.children[state.selected], p);
    paint(el.glowHandles.children[state.selected], p);
    render();
  });

  el.glowSize.addEventListener('input', function () {
    state.points[state.selected].size = el.glowSize.value / 100;
    out.glowSize.textContent = el.glowSize.value + ' %';
    render();
  });

  /* ───────────── Druh tvaru, kopírování, stahování ───────────── */

  function setMode(mode) {
    state.mode = mode;
    all('.mode').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    all('[data-only]').forEach(function (n) { n.hidden = n.dataset.only !== mode; });
    el.stage.classList.toggle('is-glow', mode === 'glow');
    try {
      history.replaceState(null, '', mode === 'glow' ? '#zare' : location.pathname + location.search);
    } catch (e) { /* např. file:// v některých prohlížečích */ }
    render();
  }

  function copySvg() {
    SiteUtil.copyWithToast(current.svg, 'SVG zkopírováno do schránky');
  }

  function downloadSvg() {
    var name = (state.mode === 'glow' ? 'shape-glow-' : 'shape-') +
      Math.round(current.width) + 'x' + Math.round(current.height) + '.svg';
    SiteUtil.downloadText(name, current.svg, 'image/svg+xml');
    SiteUtil.toast('SVG staženo');
  }

  ['depth', 'size', 'color', 'cutWidth', 'radius', 'offset'].forEach(function (k) {
    el[k].addEventListener('input', render);
  });
  all('.mode').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  el.shape.addEventListener('click', copySvg);
  el.copy.addEventListener('click', copySvg);
  el.download.addEventListener('click', downloadSvg);
  el.reset.addEventListener('click', function () {
    setDefaults();
    renderPoints();
  });

  setDefaults();
  renderPoints();
  setMode(location.hash === '#zare' ? 'glow' : 'solid');
})();
