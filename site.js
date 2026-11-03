/*
 * Společný kód všech stránek:
 *   – <site-header current="…" base="…"> vykreslí hlavičku s logem a navigací
 *     (jediné místo, kde se záložky definují),
 *   – SiteUtil: kopírování do schránky, stahování souboru a hláška (toast).
 *
 * Skript se načítá v <head>, takže se hlavička vykreslí hned při parsování
 * a stránka po načtení neposkočí.
 */
(function (root) {
  'use strict';

  // href je relativně ke kořeni webu. Záložka s disabled: true není odkaz.
  var NAV = [
    { id: 'generator', label: 'Generátor tvarů', href: '' },
    { id: 'animace', label: 'Animace', href: 'animace/' },
    { id: 'barvy', label: 'Barvy', href: 'barvy/' },
    { id: 'assety', label: 'Assety ke stažení', href: 'assety/' }
  ];

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { e.append(c); });
    return e;
  }

  function renderHeader(host) {
    var base = host.getAttribute('base') || '';   // cesta z aktuální stránky ke kořeni, např. "../"
    var current = host.getAttribute('current');

    var logo = el('a', { 'class': 'site-logo', href: base || './', 'aria-label': 'Onkorádce – úvod' }, [
      el('img', { src: base + 'assets/Logo.svg', alt: 'Onkorádce' })
    ]);

    var nav = el('nav', { 'class': 'site-nav', 'aria-label': 'Hlavní navigace' });
    NAV.forEach(function (item) {
      var node;
      if (item.disabled) {
        node = el('span', { 'class': 'is-disabled', 'aria-disabled': 'true', title: 'Připravujeme' });
      } else {
        node = el('a', { href: base + item.href || './' });
        if (item.id === current) node.setAttribute('aria-current', 'page');
      }
      node.textContent = item.label;
      nav.append(node);
    });

    var header = el('header', { 'class': 'site-header' }, [
      el('div', { 'class': 'site-header-inner' }, [logo, nav])
    ]);
    host.replaceChildren(header);
  }

  if (root.customElements && !root.customElements.get('site-header')) {
    root.customElements.define('site-header', class extends HTMLElement {
      connectedCallback() { renderHeader(this); }
    });
  }

  var toastEl;
  var toastTimer;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.getElementById('toast');
      if (!toastEl) {
        toastEl = el('div', { id: 'toast', 'class': 'toast', role: 'status', 'aria-live': 'polite' });
        document.body.append(toastEl);
      }
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  // Záloha pro prostředí bez Clipboard API (např. stránka otevřená z file://).
  function legacyCopy(text) {
    var ta = el('textarea', { readonly: '' });
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function copyText(text) {
    if (root.navigator.clipboard && root.isSecureContext) {
      return root.navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  // Zkopíruje text a ukáže hlášku podle výsledku.
  function copyWithToast(text, okMessage) {
    return copyText(text).then(function (ok) {
      toast(ok ? okMessage : 'Kopírování se nepovedlo');
      return ok;
    });
  }

  function downloadText(filename, text, mime) {
    var url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    var a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  root.SiteUtil = { toast: toast, copyText: copyText, copyWithToast: copyWithToast, downloadText: downloadText };
})(window);
