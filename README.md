# Shape Generator

Webový generátor SVG tvarů se šesti výřezy v poměru 10 : 9. Kliknutím na tvar se SVG zkopíruje do schránky, tlačítkem se stáhne jako soubor.

Bez závislostí a bez buildu – čisté HTML, CSS a JavaScript.

## Spuštění

Stačí otevřít `index.html`, nebo spustit jakýkoli statický server:

```bash
python3 -m http.server 8765
```

## Testy geometrie

```bash
node --test test/
```

## Nasazení na GitHub Pages

1. Nahraj repozitář na GitHub (větev `main`).
2. V repozitáři otevři *Settings → Pages* a jako *Source* zvol **GitHub Actions**.
3. Každý push do `main` spustí [workflow](.github/workflows/pages.yml): nejdřív testy, pak nasazení.

## Jak je tvar postavený

Geometrie je v [`shape.js`](shape.js) (čistá funkce bez DOM).

- Tvar je obdélník 10 : 9 (9 = výška), výška se nastavuje posuvníkem *Velikost*.
- Šest výřezů: svislý nahoře a dole (na ose x vycentrované), vodorovný vlevo a vpravo (posunuté od diagonálního výřezu) a dva protilehlé diagonální pod 45° z rohů vlevo nahoře a vpravo dole.
- **Šířka výřezu je absolutní** – při zvětšení nebo zmenšení tvaru se nemění.
- **Hloubka** je jedna hodnota pro všech šest výřezů: špičky výřezů končí ve stejné vzdálenosti od středu. Táhlo se samo zastaví dřív, než by se výřezy srazily.
- Zaoblení: konce výřezů jsou půlkruh, hlavní rohy bez diagonálního výřezu mají poloměr X, ostatní vnější rohy (ústí výřezů) 2·X. X je podíl výšky, takže se zaoblení s velikostí škáluje.
- Obrys je jedna uzavřená cesta (`<path>`) s oblouky, výplň je jednobarevná a výřezy jsou průhledné.
