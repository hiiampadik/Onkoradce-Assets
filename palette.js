/*
 * Barvy webu podle Figmy (soubor „Onkorádce – Koncept“, vzorník „Variables /
 * Color Swatches“ 132:1503, stav po auditu barev z 3. 11. 2026): 34 Primitives
 * a 25 Semantics. Pořadí, skupiny a jejich názvy jsou jako ve vzorníku.
 *
 * Píše se ručně: po změně proměnných ve Figmě uprav hodnoty tady.
 * Ve Figmě mají blue/100 a gradient/blue výplň #C4F2FF, ale popisek #DCEFF4.
 * Tady je hodnota proměnné (#C4F2FF).
 *
 * primitiveGroups a semanticGroups jsou skupiny pro stránku Barvy, primitives
 * a semantics totéž jako plochý seznam { name, hex } (u sémantických barev
 * i primitive = primitivum se stejnou hodnotou).
 */
(function (root) {
  'use strict';

  var groups = {
    primitiveGroups: [
      { group: 'Green', colors: [
        ['green/50', '#D3F8DF'], ['green/100', '#B9F1CC'], ['green/200', '#91E7AD'],
        ['green/300', '#5BDA88'], ['green/400', '#2ECF7D'], ['green/500', '#00A86B'],
        ['green/600', '#00633F'], ['green/800', '#004B32'], ['green/900', '#003F2B']
      ] },
      { group: 'Grey', colors: [
        ['grey/50', '#F7F7F7'], ['grey/100', '#EEEEEE'], ['grey/200', '#E0E0E0'],
        ['grey/300', '#C6C6C6'], ['grey/500', '#8A8A8A'], ['grey/600', '#6F6F6F'],
        ['grey/700', '#525252'], ['grey/800', '#393939'], ['grey/900', '#242424']
      ] },
      { group: 'Beige', colors: [
        ['beige/50', '#FBFAF8'], ['beige/100', '#F5F3EF'], ['beige/200', '#E8E3DA'], ['beige/300', '#D8D0C4']
      ] },
      { group: 'Neutral', colors: [['neutral/0', '#FFFFFF']] },
      { group: 'Orange', colors: [['orange/50', '#FFF7ED'], ['orange/100', '#FFEDD5'], ['orange/500', '#F97316']] },
      { group: 'Yellow', colors: [
        ['yellow/100', '#FAF7C1'], ['yellow/200', '#F4EE82'], ['yellow/300', '#E9DE55'],
        ['yellow/600', '#756700'], ['yellow/900', '#373000']
      ] },
      { group: 'Blue', colors: [['blue/100', '#C4F2FF'], ['blue/600', '#004E63'], ['blue/700', '#004457']] }
    ],
    semanticGroups: [
      { category: 'Text', group: 'Neutral', colors: [
        ['text/neutral/primary', '#242424'], ['text/neutral/secondary', '#6F6F6F'], ['text/neutral/tertiary', '#8A8A8A']
      ] },
      { category: 'Text', group: 'Brand', colors: [
        ['text/brand/strong', '#003F2B'], ['text/brand/default', '#004B32'],
        ['text/brand/accent', '#00633F'], ['text/brand/highlight', '#00A86B']
      ] },
      { category: 'Text', group: 'Inverse', colors: [['text/inverse/default', '#FFFFFF']] },
      { group: 'Ikony', colors: [['icon/primary', '#004B32'], ['icon/brand', '#00A86B'], ['icon/inverse', '#FFFFFF']] },
      { group: 'Pozadí', colors: [
        ['background/default', '#FFFFFF'], ['background/beige', '#F5F3EF'],
        ['background/brand-subtle', '#B9F1CC'], ['background/brand', '#00A86B']
      ] },
      { group: 'Ohraničení', colors: [['border/subtle', '#B9F1CC']] },
      { group: 'Akce', colors: [
        ['action/primary', '#00633F'], ['action/primary-hover', '#004B32'],
        ['action/secondary', '#393939'], ['action/secondary-hover', '#242424'],
        ['action/secondary-small', '#525252'], ['action/secondary-small-hover', '#393939']
      ] },
      { group: 'Gradienty', colors: [['gradient/yellow', '#F4EE82'], ['gradient/blue', '#C4F2FF'], ['gradient/green-light', '#91E7AD']] }
    ]
  };

  function flat(list) {
    return list.reduce(function (all, g) {
      return all.concat(g.colors.map(function (c) { return { name: c[0], hex: c[1] }; }));
    }, []);
  }

  var primitives = flat(groups.primitiveGroups);
  var semantics = flat(groups.semanticGroups).map(function (s) {
    var p = primitives.find(function (q) { return q.hex === s.hex; });
    return p ? { name: s.name, hex: s.hex, primitive: p.name } : s;
  });

  var palette = {
    primitiveGroups: groups.primitiveGroups,
    semanticGroups: groups.semanticGroups,
    primitives: primitives,
    semantics: semantics
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = palette;
  else root.Palette = palette;
})(typeof window !== 'undefined' ? window : this);
