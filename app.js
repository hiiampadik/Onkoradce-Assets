(function () {
  'use strict';

  // Kdyby se načetl nový app.js se starým shape.js (nebo naopak), nechybělo by nic viditelného, jen by se
  // velikost náhledu tiše spočítala špatně. Proto se ověří, že shape.js umí všechno, co app.js potřebuje.
  var missing = ['REF_HEIGHT', 'MM_PER_PX', 'DEFAULT_CUT_MM', 'DEFAULT_AFFINITY_ZOOM', 'affinityScale', 'glowSvg']
    .filter(function (k) { return ShapeGen[k] === undefined; });
  if (missing.length) {
    var banner = document.createElement('p');
    banner.className = 'stale-banner';
    banner.textContent = 'Načetla se zastaralá verze souborů (v shape.js chybí: ' + missing.join(', ') +
      '). Obnov stránku bez cache: Safari ⌥⌘R, Chrome ⇧⌘R.';
    document.querySelector('main').before(banner);
    return;
  }

  var D = ShapeGen.DEFAULTS;
  var MAX_POINTS = ShapeGen.MAX_GLOW_POINTS;
  var NEW_COLORS = ShapeGen.NEW_GLOW_COLORS;
  var NEW_SIZE = 0.5;
  var MM_PER_PX = ShapeGen.MM_PER_PX;
  var SIZE_MAX_PX = 1000; // největší tvar na posuvníku Velikost, podle něj se škáluje náhled
  var UNIT_KEY = 'onkoradce-unit';
  var ZOOM_KEY = 'onkoradce-affinity-zoom';
  // Výchozí šířka výřezu (pro výšku 1000 px) je v každé jednotce jiná: 23 px, nebo 5 mm.
  var DEFAULT_CUT_PX = { px: D.cutWidth, mm: ShapeGen.DEFAULT_CUT_MM / MM_PER_PX };
  // Rozsahy posuvníků Velikost a Šířka výřezu v obou jednotkách: [min, max, krok].
  var RANGES = {
    px: { size: [100, 1000, 10], cut: [4, 25, 0.5] },
    mm: { size: [25, 265, 0.5], cut: [1, 6.7, 0.1] }
  };

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
    fit: $('fit'),
    affZoom: $('affZoom'),
    glow: $('glow'),
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
    affZoom: $('affZoom-out'),
    glowSize: $('glow-size-out')
  };

  // mode: 'solid' (jednobarevný tvar) nebo 'glow' (maska se září z bodů)
  // Rozměry se drží v px, i když se zobrazují v mm: posuvník v mm má hrubší krok, a kdyby se hodnota
  // četla z něj, měnila by se při každém přepnutí jednotek.
  // view: 'actual' (náhled ve skutečné velikosti, 1 px tvaru = 1 CSS px) nebo 'fit' (zmenšený na šířku okna)
  // cutIsDefault: šířku výřezu uživatel zatím neměnil, takže se při přepnutí jednotek přepne na výchozí hodnotu
  // té druhé jednotky. Jakmile ji změní, přepnutí jednotek jen přepočítá zobrazení a tvar se nemění.
  var state = { mode: 'solid', unit: 'mm', view: 'actual', affZoom: ShapeGen.DEFAULT_AFFINITY_ZOOM, affDpr: window.devicePixelRatio || 1, heightPx: D.height, cutPx: D.cutWidth, cutIsDefault: true, points: [], selected: 0 };
  var current = { svg: '', width: 0, height: 0 };
  var availWidth = 0; // šířka, kterou má náhled ve stagi k dispozici

  function toPx(v) { return state.unit === 'mm' ? v / MM_PER_PX : v; }
  function fromPx(px) { return state.unit === 'mm' ? px * MM_PER_PX : px; }
  // Číslo v aktuální jednotce (px celé, mm na desetiny) a s jednotkou.
  function num(px) { return state.unit === 'mm' ? round(px * MM_PER_PX) : Math.round(px); }
  function len(px) { return num(px) + ' ' + state.unit; }

  function setRange(input, range) {
    input.min = range[0];
    input.max = range[1];
    input.step = range[2];
  }

  // Posuvníky Velikost a Šířka výřezu a texty u nich podle zvolené jednotky.
  function applyUnit() {
    var r = RANGES[state.unit];
    setRange(el.size, r.size);
    setRange(el.cutWidth, r.cut);
    el.size.value = fromPx(state.heightPx);
    el.cutWidth.value = fromPx(state.cutPx);
    $('cut-note').textContent = 'Platí pro výšku ' + len(ShapeGen.REF_HEIGHT) +
      '. Při poloviční výšce je výřez 75 % široký, při čtvrtinové 56 % atd.';
    all('.unit').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit));
    });
  }

  function setUnit(unit) {
    state.unit = unit;
    if (state.cutIsDefault) state.cutPx = DEFAULT_CUT_PX[unit];
    try { localStorage.setItem(UNIT_KEY, unit); } catch (e) { /* soukromý režim */ }
    applyUnit();
    render();
  }

  function setDefaults() {
    el.depth.value = Math.round(D.depth * 100);
    state.heightPx = D.height;
    state.cutPx = DEFAULT_CUT_PX[state.unit];
    state.cutIsDefault = true;
    applyUnit();
    el.color.value = D.color;
    el.radius.value = D.radius * 100;
    el.offset.value = D.offset * 100;
    state.points = ShapeGen.DEFAULT_GLOW.map(function (p) { return Object.assign({}, p); });
    state.selected = 0;
  }

  function read() {
    return {
      depth: el.depth.value / 100,
      height: state.heightPx,
      color: el.color.value,
      cutWidth: state.cutPx,
      radius: el.radius.value / 100,
      offset: el.offset.value / 100
    };
  }

  function measureStage() {
    var cs = getComputedStyle(el.stage);
    availWidth = el.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  // Kolik CSS px zabere 1 px tvaru při 100 % podle Affinity (kalibrace měřítka, viz shape.js).
  function affinityScale() {
    return ShapeGen.affinityScale(state.affZoom, window.devicePixelRatio, state.affDpr);
  }

  // Zvětšení náhledu vůči 100% zobrazení v Affinity. Výchozí je 100 %. V režimu „přizpůsobit“ se
  // zmenšuje v jednom měřítku pro všechny velikosti: největší tvar (konec posuvníku Velikost) se vejde
  // na šířku stagi a menší jsou úměrně menší. Kdyby se každý tvar vtěsnával do stagi zvlášť, vypadaly
  // by všechny velké velikosti stejně.
  function previewZoom() {
    if (state.view === 'actual') return 1;
    if (availWidth <= 0) return 1; // stránka ještě nemá rozměry (skrytý panel), dopočítá se při změně velikosti
    return Math.min(1, availWidth / (SIZE_MAX_PX * D.aspect * affinityScale()));
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
      current.svg = ShapeGen.glowSvg(params, state.points, state.unit);
      el.glowArt.innerHTML = current.svg;
    } else {
      current.svg = ShapeGen.svg(params, state.unit);
      el.shape.innerHTML = current.svg;
    }
    current.width = o.width;
    current.height = o.height;

    var zoom = previewZoom();
    el.shape.style.width = el.glow.style.width = o.width * affinityScale() * zoom + 'px';

    out.depth.textContent = el.depth.value + ' %';
    out.size.textContent = len(state.heightPx);
    out.cutWidth.textContent = len(state.cutPx) + ' · teď ' + len(o.params.cutWidth);
    out.radius.textContent = round(params.radius * 100) + ' % (' + len(params.radius * params.height) + ')';
    out.offset.textContent = round(params.offset * 100) + ' %';
    el.dims.textContent = num(o.width) + ' × ' + num(o.height) + ' ' + state.unit + ' · náhled ' + Math.round(zoom * 100) + ' %' +
      (zoom === 1 ? ' jako v Affinity' : ' (100 % = jako v Affinity)');
    el.fit.textContent = state.view === 'actual' ? 'Přizpůsobit oknu' : 'Zobrazit ve 100 %';
    // Co se právě používá: výsledné zvětšení a pixelový poměr displeje (pomůže při hledání rozdílu proti Affinity).
    out.affZoom.textContent = Math.round(affinityScale() * 100) + ' % · dpr ' + round(window.devicePixelRatio || 1);
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
      num(current.width) + 'x' + num(current.height) + (state.unit === 'mm' ? 'mm' : '') + '.svg';
    SiteUtil.downloadText(name, current.svg, 'image/svg+xml');
    SiteUtil.toast('SVG staženo');
  }

  ['depth', 'color', 'radius', 'offset'].forEach(function (k) {
    el[k].addEventListener('input', render);
  });
  el.size.addEventListener('input', function () {
    state.heightPx = toPx(+el.size.value);
    render();
  });
  el.cutWidth.addEventListener('input', function () {
    state.cutPx = toPx(+el.cutWidth.value);
    state.cutIsDefault = false;
    render();
  });
  all('.unit').forEach(function (b) {
    b.addEventListener('click', function () { setUnit(b.dataset.unit); });
  });
  all('.mode').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  el.affZoom.addEventListener('input', function () {
    var v = parseFloat(el.affZoom.value);
    if (!(v >= 20 && v <= 1000)) return; // rozepsané nebo neplatné číslo se ignoruje
    state.affZoom = v / 100;
    state.affDpr = window.devicePixelRatio || 1;
    try {
      // Výchozí hodnotu není třeba si pamatovat, jinak by zůstala uložená i po změně výchozí v kódu.
      if (Math.abs(state.affZoom - ShapeGen.DEFAULT_AFFINITY_ZOOM) < 0.005) localStorage.removeItem(ZOOM_KEY);
      else localStorage.setItem(ZOOM_KEY, JSON.stringify({ zoom: state.affZoom, dpr: state.affDpr }));
    } catch (e) { /* soukromý režim */ }
    render();
  });
  // Při změně přiblížení stránky nebo přesunu na jiný displej se změní devicePixelRatio.
  window.addEventListener('resize', render);
  el.fit.addEventListener('click', function () {
    state.view = state.view === 'actual' ? 'fit' : 'actual';
    render();
  });
  el.shape.addEventListener('click', copySvg);
  el.copy.addEventListener('click', copySvg);
  el.download.addEventListener('click', downloadSvg);
  el.reset.addEventListener('click', function () {
    // Kalibrace náhledu se vrací také, jinak by špatně zadané číslo zůstalo uložené v prohlížeči.
    state.affZoom = ShapeGen.DEFAULT_AFFINITY_ZOOM;
    state.affDpr = window.devicePixelRatio || 1;
    el.affZoom.value = Math.round(state.affZoom * 100);
    try { localStorage.removeItem(ZOOM_KEY); } catch (e) { /* soukromý režim */ }
    setDefaults();
    renderPoints();
  });

  // Při změně šířky okna se náhled přepočítá (jen šířka, ať se to nezacyklí s výškou stagi).
  var lastStageWidth = 0;
  new ResizeObserver(function () {
    if (el.stage.clientWidth === lastStageWidth) return;
    lastStageWidth = el.stage.clientWidth;
    measureStage();
    render();
  }).observe(el.stage);

  // px jsou zatím vypnuté: přepínač jednotek je v index.html zakomentovaný a počítá se jen v mm.
  // Pro návrat px odkomentuj přepínač a tento řádek:
  // try { state.unit = localStorage.getItem(UNIT_KEY) === 'mm' ? 'mm' : 'px'; } catch (e) { /* zůstane mm */ }
  try {
    var saved = JSON.parse(localStorage.getItem(ZOOM_KEY));
    if (saved && saved.zoom >= 0.2 && saved.zoom <= 10 && saved.dpr > 0) {
      state.affZoom = saved.zoom;
      state.affDpr = saved.dpr;
    }
  } catch (e) { /* zůstane výchozí měřítko */ }
  el.affZoom.value = Math.round(state.affZoom * 100);
  measureStage();
  setDefaults();
  renderPoints();
  setMode(location.hash === '#zare' ? 'glow' : 'solid');
})();
