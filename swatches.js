/*
 * Výběr barvy ze vzorníku – náhrada za <input type="color">.
 *
 *   <swatch-picker id="color" value="#00A86B" label="Barva"></swatch-picker>
 *
 * Chová se jako input: čte a nastavuje se přes .value (HEX) a při výběru vyvolá
 * události input a change. Nabízí stejný vzorník jako stránka Barvy: logo
 * (Brand.COLORS) a skupiny Primitives a Semantics z palety (palette.js). Hodnota mimo vzorník (např. výplň nahraného
 * SVG) se zobrazí, ale ve vzorníku není nic vybrané.
 *
 * Funkce groups() a nameOf() jsou čisté, testují se v Node.
 */
(function (root) {
  'use strict';

  function norm(hex) {
    var s = String(hex || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : '';
  }

  // Skupiny pro vzorník, stejné jako na stránce Barvy: logo, pak skupiny Primitives
  // a Semantics z palety (Palette.primitiveGroups / semanticGroups, barvy jako [název, HEX]).
  // section je nadpis kolekce, vykreslí se u první skupiny kolekce.
  function groups(brandColors, primitiveGroups, semanticGroups) {
    var out = [];
    if (brandColors && brandColors.length) {
      out.push({ section: 'Logo', name: '', colors: brandColors.map(function (hex) { return { hex: norm(hex), name: '' }; }) });
    }
    function add(section, list) {
      (list || []).forEach(function (g, i) {
        out.push({
          section: i === 0 ? section : '',
          name: g.category ? g.category + ' · ' + g.group : g.group,
          colors: g.colors.map(function (c) { return { hex: norm(c[1]), name: c[0] }; })
        });
      });
    }
    add('Primitives', primitiveGroups);
    add('Semantics', semanticGroups);
    return out;
  }

  // Název barvy z palety (např. "green/500"), nebo '' když barva název nemá.
  // Primitives jsou před Semantics, takže u stejné hodnoty vyhraje název primitiva.
  function nameOf(hex, grps) {
    var h = norm(hex);
    for (var i = 0; i < grps.length; i++) {
      for (var j = 0; j < grps[i].colors.length; j++) {
        var c = grps[i].colors[j];
        if (c.name && c.hex === h) return c.name;
      }
    }
    return '';
  }

  var api = { groups: groups, nameOf: nameOf, norm: norm };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Swatches = api;

  if (typeof customElements === 'undefined' || customElements.get('swatch-picker')) return;

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  var openPicker = null;

  customElements.define('swatch-picker', class extends HTMLElement {
    static get observedAttributes() { return ['value', 'label']; }

    constructor() {
      super();
      this._value = '';
      this._onPointerDown = this._onPointerDown.bind(this);
    }

    connectedCallback() {
      if (this._trigger) return;
      this.classList.add('swatch-picker');
      var palette = root.Palette || {};
      this._grps = groups(root.Brand && root.Brand.COLORS, palette.primitiveGroups, palette.semanticGroups);

      this._trigger = el('button', 'swatch-trigger', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
      this._dot = el('span', 'swatch-dot', { 'aria-hidden': 'true' });
      this._text = el('span', 'swatch-text');
      this._trigger.append(this._dot, this._text, el('span', 'swatch-caret', { 'aria-hidden': 'true' }));
      this._trigger.addEventListener('click', () => (this._pop && !this._pop.hidden ? this.close(true) : this.open()));

      this.replaceChildren(this._trigger);
      if (!this._value) this._value = norm(this.getAttribute('value'));
      this._sync();
    }

    disconnectedCallback() { this.close(false); }

    attributeChangedCallback(name, _old, value) {
      if (name === 'value') {
        this._value = norm(value);
        this._sync();
      } else if (name === 'label') {
        this._sync();
      }
    }

    get value() { return this._value; }
    set value(v) {
      this._value = norm(v);
      this._sync();
    }

    _sync() {
      if (!this._trigger) return;
      var name = nameOf(this._value, this._grps);
      var label = this.getAttribute('label') || 'Barva';
      this._dot.style.setProperty('--c', this._value || 'transparent');
      this._text.textContent = (name ? name + ' · ' : '') + (this._value || '—');
      this._trigger.setAttribute('aria-label', label + ': ' + (name ? name + ', ' : '') + this._value);
      if (this._pop) {
        this._swatches.forEach((s) => {
          var on = s.dataset.hex === this._value;
          s.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
    }

    _build() {
      this._pop = el('div', 'swatch-pop', { role: 'dialog', 'aria-label': 'Vzorník barev', hidden: '' });
      this._swatches = [];
      this._grps.forEach((g) => {
        if (g.section) {
          var heading = el('p', 'swatch-section');
          heading.textContent = g.section;
          this._pop.append(heading);
        }
        var section = el('div', 'swatch-group');
        var title = el('p', 'swatch-group-name');
        title.textContent = g.name;
        var grid = el('div', 'swatch-grid');
        g.colors.forEach((c) => {
          var label = (c.name ? c.name + ' · ' : '') + c.hex;
          var b = el('button', 'swatch', { type: 'button', title: label, 'aria-label': label, tabindex: '-1' });
          b.dataset.hex = c.hex;
          b.style.setProperty('--c', c.hex);
          b.addEventListener('click', () => this._choose(c.hex));
          this._swatches.push(b);
          grid.append(b);
        });
        if (g.name) section.append(title);
        section.append(grid);
        this._pop.append(section);
      });
      this._pop.addEventListener('keydown', (e) => this._onKey(e));
      this.append(this._pop);
    }

    open() {
      if (!this._pop) this._build();
      if (openPicker && openPicker !== this) openPicker.close(false);
      openPicker = this;
      this._sync();
      this._place();
      this._pop.hidden = false;
      this._trigger.setAttribute('aria-expanded', 'true');
      var start = this._swatches.filter((s) => s.dataset.hex === this._value)[0] || this._swatches[0];
      this._focusSwatch(start);
      document.addEventListener('pointerdown', this._onPointerDown, true);
    }

    close(refocus) {
      if (!this._pop || this._pop.hidden) return;
      this._pop.hidden = true;
      this._trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', this._onPointerDown, true);
      if (openPicker === this) openPicker = null;
      if (refocus) this._trigger.focus();
    }

    // Vzorník otevřený pod tlačítkem (nebo nad ním, když dole není místo),
    // posunutý do viditelné části okna. Nastavuje se ještě skrytý a měří se jen tlačítko:
    // kdyby byl vzorník na chvíli vidět v jiné velikosti, poskočila by stránka.
    _place() {
      var t = this._trigger.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var below = document.documentElement.clientHeight - t.bottom - 14;
      var above = t.top - 14;
      var up = below < 300 && above > below;
      var width = Math.min(304, vw - 16);
      var shift = Math.max(Math.min(0, vw - 8 - (t.left + width)), 8 - t.left);
      this._pop.style.cssText = 'left:' + shift + 'px;max-height:' + Math.min(460, Math.max(160, up ? above : below)) +
        'px;' + (up ? 'top:auto;bottom:calc(100% + 6px);' : '');
    }

    _onPointerDown(e) {
      if (!this.contains(e.target)) this.close(false);
    }

    _choose(hex) {
      var changed = hex !== this._value;
      this._value = hex;
      this._sync();
      this.close(true);
      if (changed) {
        this.dispatchEvent(new Event('input', { bubbles: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Jen jedna barva je v tabulátoru (roving tabindex), mezi barvami se chodí šipkami.
    _focusSwatch(s) {
      this._swatches.forEach((x) => x.setAttribute('tabindex', x === s ? '0' : '-1'));
      // Bez preventScroll by prohlížeč při zaostření poskočil celou stránkou, posouvá se jen vzorník.
      s.focus({ preventScroll: true });
      var pop = this._pop;
      var top = s.offsetTop;
      var bottom = top + s.offsetHeight;
      if (top < pop.scrollTop + 28) pop.scrollTop = Math.max(0, top - 28);
      else if (bottom > pop.scrollTop + pop.clientHeight - 8) pop.scrollTop = bottom - pop.clientHeight + 8;
    }

    _onKey(e) {
      var key = e.key;
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close(true);
        return;
      }
      if (key === 'Tab') {
        this.close(true);
        return;
      }
      var i = this._swatches.indexOf(document.activeElement);
      if (i < 0) return;
      var target;
      if (key === 'ArrowRight') target = this._swatches[i + 1];
      else if (key === 'ArrowLeft') target = this._swatches[i - 1];
      else if (key === 'ArrowDown' || key === 'ArrowUp') target = this._neighbourRow(this._swatches[i], key === 'ArrowDown' ? 1 : -1);
      else if (key === 'Home') target = this._swatches[0];
      else if (key === 'End') target = this._swatches[this._swatches.length - 1];
      else return;
      e.preventDefault();
      if (target) this._focusSwatch(target);
    }

    // Barva v nejbližším řádku nahoře / dole, co nejblíž ve vodorovném směru.
    _neighbourRow(from, dir) {
      var fr = from.getBoundingClientRect();
      var best = null;
      var bestRow = Infinity;
      var bestDx = Infinity;
      this._swatches.forEach((s) => {
        var r = s.getBoundingClientRect();
        var dy = (r.top - fr.top) * dir;
        if (dy < fr.height / 2) return;
        var dx = Math.abs(r.left - fr.left);
        if (dy < bestRow - 1 || (Math.abs(dy - bestRow) <= 1 && dx < bestDx)) {
          best = s;
          bestRow = dy;
          bestDx = dx;
        }
      });
      return best;
    }
  });
})(typeof window !== 'undefined' ? window : this);
