# Onkorádce Assets

Statický web s logem a navigací se dvěma záložkami. Bez závislostí a bez buildu – čisté HTML, CSS a JavaScript.

| Záložka | Cesta | Co to je |
|---|---|---|
| Generátor tvarů | `/` ([`index.html`](index.html)) | Webový generátor SVG tvarů se šesti výřezy v poměru 10 : 9. Kliknutím na tvar se SVG zkopíruje do schránky, tlačítkem se stáhne jako soubor. |
| Animace | `/animace/` ([`animace/`](animace/)) | Knihovna `<leaf-anim>` a ukázka animací lístečku, popis je v [`animace/README.md`](animace/README.md). |

Logo je v [`assets/Logo.svg`](assets/Logo.svg). Hlavička a navigace jsou na obou stránkách stejné, styl je ve [`site.css`](site.css). Záložky *Barvy* a *Assety ke stažení* jsou zatím neaktivní (v navigaci jsou jako `<span class="is-disabled">`). Aktivní záložku přidáš tak, že vytvoříš podsložku s `index.html`, zkopíruješ do ní hlavičku a v navigaci na všech stránkách nahradíš `<span>` odkazem `<a>`.

## Spuštění

Generátor tvarů stačí otevřít z `index.html`. Animace potřebují server (prohlížeč z disku nenačte moduly), proto spusť v kořeni projektu jakýkoli statický server:

```bash
python3 -m http.server 8765
```

a otevři `http://localhost:8765/`.

## Testy geometrie

```bash
node --test
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
