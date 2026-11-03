# Onkorádce Assets

Statický web s logem a navigací se čtyřmi záložkami. Bez závislostí a bez buildu – čisté HTML, CSS a JavaScript.

| Záložka | Cesta | Co to je |
|---|---|---|
| Generátor tvarů | `/` ([`index.html`](index.html)) | Webový generátor SVG tvarů se šesti výřezy v poměru 10 : 9. Má dvě varianty: **Jednobarevný** (kliknutím na tvar se SVG zkopíruje) a **Maska se září** (`/#zare`), kde je tvar jen maska a barvy do ní prosvítají z bodů. SVG se zkopíruje do schránky nebo stáhne jako soubor. Rozměry jdou přepnout mezi **px** a **mm**. |
| Animace | `/animace/` ([`animace/`](animace/)) | Knihovna `<leaf-anim>` a ukázka animací lístečku, popis je v [`animace/README.md`](animace/README.md). |
| Barvy | `/barvy/` ([`barvy/`](barvy/)) | Barvy loga a palety Primitives a Semantics z `.clr` souborů. Kliknutím se zkopíruje HEX nebo `rgb()`. |
| Assety ke stažení | `/assety/` ([`assety/`](assety/)) | Tabulka assetů: ukázka, použité barvy a tlačítka Stáhnout SVG a Kopírovat SVG. |

## Společný kód

- [`site.css`](site.css) – barvy, rozestupy, základ stránky, tlačítka, hlavička.
- [`site.js`](site.js) – element `<site-header current="…" base="…">` s logem a navigací (jediné místo, kde jsou záložky vyjmenované) a `SiteUtil` pro kopírování, stahování a hlášky.
- [`swatches.js`](swatches.js) – element `<swatch-picker>`: výběr barvy ze vzorníku, který nahrazuje `<input type="color">` (generátor, Animace). Nabízí barvy loga a paletu Primitives. Chová se jako input (`.value` v HEX, události `input` a `change`). Hodnota mimo vzorník (třeba výplň nahraného SVG) se zobrazí, ale nic není vybrané. Skript musí být načtený před kódem, který do prvku zapisuje hodnotu. Má testy v `test/swatches.test.js`.
- [`brand.js`](brand.js) – barvy loga, seznam assetů a přebarvení SVG. Má testy v `test/brand.test.js`.
- [`palette.js`](palette.js) – barvy z palet `Onkoradce RGB Color Primitives.clr` a `Onkoradce RGB Color Semantics.clr`. **Je generovaný**, needituje se ručně.

## Barevné palety (.clr)

Zdrojem barev jsou macOS palety v kořeni projektu. Web je za běhu nečte, používá hotový `palette.js`. Po změně palety ho vygeneruj znovu:

```bash
node scripts/build-palette.js
```

[`scripts/clr.js`](scripts/clr.js) umí číst formát `.clr` bez závislostí. Hodnoty bere jako sRGB a zaokrouhluje na 8 bitů. U sémantických barev skript dohledá primitivum se stejnou hodnotou a uloží odkaz na něj (např. `text/brand/strong` → `green/900`). Test `test/clr.test.js` hlídá, aby `palette.js` odpovídal aktuálním `.clr` souborům, proto musí být v repozitáři i ony.

## Jak přidat asset nebo barvu

- **Barva loga:** přidej HEX do `COLORS` v [`brand.js`](brand.js). Objeví se v záložce Barvy, jako další varianta loga i ve vzorníku.
- **Barva z palety:** změň `.clr` a spusť `node scripts/build-palette.js`. Nová barva se objeví i ve vzorníku.
- **Výchozí barvy** (jednobarevný tvar, body záře, Animace) mají být z palety, aby šly ve vzorníku vybrat. Test `test/shape.test.js` to hlídá.
- **Asset:** nahraj SVG do [`assets/`](assets/) a doplň ho do `ASSETS` v [`brand.js`](brand.js) (`id`, `name`, `file`, `variants`). Varianty vznikají přebarvením všech výplní, takže to funguje pro jednobarevné SVG.
- **Záložka:** vytvoř podsložku s `index.html` (podle `barvy/index.html`) a přidej ji do `NAV` v [`site.js`](site.js). Záložka s `disabled: true` je zatím neaktivní.

## Spuštění

Generátor tvarů stačí otevřít z `index.html`. Animace potřebují server (prohlížeč z disku nenačte moduly), proto spusť v kořeni projektu lokální server. Doporučený je ten v repozitáři, který posílá `Cache-Control: no-store`:

```bash
node scripts/serve.js
```

Server poslouchá na IPv4 i IPv6 a když je port obsazený, řekne to a nespustí se (prohlížeč zkouší `localhost` nejdřív na IPv6, takže by ho jinak mohl zastínit starší server, který tam ještě běží; poznáš ho příkazem `lsof -nP -iTCP:8765 -sTCP:LISTEN`). Po úpravě kódu se tak nikdy nenačte starý skript (běžný `python3 -m http.server` nechává prohlížeč soubory cachovat a v Safari pak obnovení stránky načte nové HTML se starým `app.js`). Jde to i jakýmkoli jiným statickým serverem, třeba:

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

Při nasazení workflow přidá k CSS, JS, faviconě a logu v HTML razítko `?v=<SHA commitu>`. GitHub Pages posílá soubory s `max-age=600`, takže by si návštěvník po nasazení jinak mohl načíst nové HTML se starým CSS. Ve zdrojových souborech razítko není, lokálně se nic nemění.

## Jak je tvar postavený

Geometrie je v [`shape.js`](shape.js) (čistá funkce bez DOM).

- Tvar je obdélník 10 : 9 (9 = výška), výška se nastavuje posuvníkem *Velikost* (výchozí 750 px). Náhled „100 %“ má být stejně velký jako 100% zobrazení v Affinity. Jak velký je dokument v Affinity při 100 %, nezávisí na DPI dokumentu, ale na displeji, a prohlížeč displej nezná (CSS počítá 96 px na palec, což není skutečný palec). Proto je v „Dalším nastavení“ **Měřítko 100 % v Affinity**: kolikrát větší než v CSS je tvar v Affinity (výchozí 159 %, tedy 100 mm = 600 px displeje, ověřeno na tvarech 100 až 122 mm; 100 % by byla skutečná velikost, ne Affinity). Nastavení se pamatuje v prohlížeči i s přiblížením stránky, při jeho změně se přepočítá. Na jiném displeji ho případně uprav. Když se tvar do plochy nevejde, plocha se posouvá do strany. Tlačítko „Přizpůsobit oknu“ ho zmenší na šířku plochy, a to v jednom měřítku pro všechny velikosti (největší tvar se vejde, menší jsou úměrně menší). Skutečné měřítko je pod náhledem („náhled 100 %“). Šířka stránky je 1320 px, aby se výchozí tvar vešel ve 100 %.
- Šest výřezů: svislý nahoře a dole (na ose x vycentrované), vodorovný vlevo a vpravo (posunuté od diagonálního výřezu) a dva protilehlé diagonální pod 45° z rohů vlevo nahoře a vpravo dole.
- **Šířka výřezu** se zadává pro výšku 1000 px (nejvíc 25 px). Při poloviční výšce má výřez 75 % zadané šířky, při čtvrtinové 0,75² atd., mezi tím plynule (`šířka · (výška / 1000)^0,415`, funkce `cutWidthAt` v [`shape.js`](shape.js)). Vedle posuvníku je vidět i skutečná šířka při aktuální velikosti.
- **Jednotky (zatím jen mm, přepínač px/mm je v `index.html` zakomentovaný):** přepínač v panelu mění zobrazení a posuvníky Velikost a Šířka výřezu a také export. Počítá se pořád v px (CSS px, 96 na palec, 1 mm = 3,7795 px) a rozměry se drží v px, takže přepnutí tam a zpět nic nezmění. Soubor v mm má `width` a `height` s příponou `mm` (např. `width="111.111mm" height="100mm"`) a souřadnice ve `viewBox` jsou v mm, takže 1 jednotka = 1 mm. V px soubor příponu nemá. Zvolená jednotka se pamatuje v prohlížeči. Výchozí šířka výřezu (pro plnou výšku 1000 px) je 23 px, v mm 5 mm. Dokud šířku výřezu neměníš, přepnutí jednotek přepne i na výchozí hodnotu druhé jednotky, potom už se jen přepočítá zobrazení.
- **Hloubka** je jedna hodnota pro všech šest výřezů: špičky výřezů končí ve stejné vzdálenosti od středu. Táhlo se samo zastaví dřív, než by se výřezy srazily.
- Zaoblení: konce výřezů jsou půlkruh, hlavní rohy bez diagonálního výřezu mají poloměr X, ostatní vnější rohy (ústí výřezů) 2·X. X je podíl výšky, takže se zaoblení s velikostí škáluje.
- Obrys je jedna uzavřená cesta (`<path>`) s oblouky, výplň je jednobarevná a výřezy jsou průhledné.

### Maska se září

Varianta, kde tvar nemá vlastní barvu a slouží jen jako maska (`ShapeGen.glowSvg`).

- Každý bod záře je kruh s radiálním přechodem, který se od plné barvy uprostřed vytrácí do průhledna. Všechny kruhy jsou ořezané obrysem tvaru (`<clipPath>`). Je to čisté SVG bez filtrů a bez rastru. Střed a poloměr každého přechodu jsou zapsané výslovně (`gradientUnits="userSpaceOnUse"`): bez nich Affinity při vložení kreslí tvrdé kruhy. Vložení do Affinity jsem ověřil, přechody se vykreslí hladce.
- Bod má polohu (podíl šířky a výšky tvaru), poloměr záře (podíl výšky) a barvu. Díky podílům se záře při změně velikosti tvaru zmenšuje a zvětšuje spolu s ním.
- Později přidaný bod se kreslí přes dřívější, takže barvy se na sebe vrství (zelená je podklad, žlutá a modrá ho přebarvují, bílá zesvětluje).
- Body se v náhledu tahají myší. Označený bod se dá posouvat šipkami (Shift = větší krok) a Delete ho odebere. Dvojklik do tvaru nebo tlačítko přidá další bod, nejvýš 12. Barva a velikost záře se mění v panelu.
- Ovládací body jsou jen v náhledu, v exportovaném SVG nejsou.
