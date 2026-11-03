# Lísteček — animace

| Soubor | K čemu je |
|---|---|
| `Curve.svg` | zdrojový tvar (beze změny, tak jak přišel z Affinity) |
| `leaf-anim.js` | knihovna + webová komponenta `<leaf-anim>`, bez závislostí |
| `index.html` | ukázka všech animací, posuvníky parametrů, export snímků, kontrola nového SVG; nahoře jdou oba soubory pro web stáhnout nebo zkopírovat |

## Ukázka

Prohlížeč z disku (`file://`) moduly nenačte, ukázku je proto potřeba otevřít přes lokální server. V kořenové složce projektu:

```bash
python3 -m http.server 8765
```

a pak otevřít `http://localhost:8765/animace/`.

## Animace

| `animation` | Co dělá | Parametry (výchozí) |
|---|---|---|
| `grow-pop` | ze zaobleného čtverce (ve výchozím nastavení kruhu) vyrůstají lístečky, každý o kousek později, přerostou a usadí se; čtverec se mezitím stáhne do středu; po výdrži se vše přehraje pozpátku zpět do čtverce | `duration` 1000 ms, `stagger` 50 ms, `overshoot` 0.17, `melt` 840 ms, `square` 1, `roundness` 1, `hold` 2000 ms, `reverse` true |
| `grow-squish` | jako pop, jen lísteček nepřeroste: narazí do neviditelného boxu a zmenší se mu zaoblení rohů | `duration` 1000 ms, `stagger` 50 ms, `impact` 0.12, `squish` 0.55, `melt` 1010 ms, `square` 1, `roundness` 0.9, `hold` 2000 ms, `reverse` true |
| `loader` | vlna růstu obíhá po směru hodinových ručiček, smyčka | `period` 1000 ms, `min` 0.58, `max` 1, `sharpness` 1.3, `intro` 400 ms |
| `pairs` | zvětší se protilehlé lístečky, pak se zcvrknou a zvětší se sousedé po směru hodin, smyčka | `step` 490 ms, `transition` 810 ms, `base` 0.6, `peak` 1, `intro` 400 ms |
| `spin` | čtverec stojí, výřezy v něm se otáčejí po směru hodin vždy o 90° a pak chvíli stojí; při pootočení se vodorovné a svislé výřezy náhodně posunou; zaoblení je stálé (ústí 2X, volné rohy X), tvar je pořád středově souměrný; smyčka | `turn` 650 ms, `pause` 550 ms, `shift` 0.5, `radius` 1, `seed` 1, `intro` 400 ms |

Při růstu (`grow-*`) je na začátku vidět jen zaoblený čtverec uprostřed. Lístečky jsou pod ním schované
v nejmenší velikosti, od samého začátku rostou (každý o `stagger` později) a vyrůstají z něj ven. Čtverec se
mezitím během `melt` stáhne do středu a schová se ve tvaru. `square` zvětší čtverec na začátku (1 = právě
zakryje nejmenší lístečky), `roundness` je poloměr jeho rohů vůči polovině strany (1 = kruh).
Kreslí se sjednocení čtverce a tvaru s lístečky: rovné hrany mají pořád jen směry jako v SVG (po 45°) a tam,
kde se obrysy potkají, je vyduté zaoblení s poloměrem jako konce výřezů. Žádný roh tak není ostrý.

U `pairs` se přechod delší než krok zkrátí na délku kroku, takže se páry střídají plynule bez výdrže.

`spin` kreslí vlastní čtverec, ne lísteček z SVG. Ze SVG si bere výřezy (šířku, hloubku a posun) a zaoblení
X = nejmenší vnější roh v SVG (u `Curve.svg` 29,6). Šikmé výřezy vedou v klidu přesně do rohů čtverce. Čtverec
se nehýbe, otáčí se jen soustava výřezů kolem středu. Zaoblení je stálé: ústí výřezů mají poloměr 2X, volné rohy
čtverce X. Když ústí přejíždí přes roh, roh se plynule zaoblí až na 2X a splyne se zaoblením ústí, takže nic
neposkočí. `radius` násobí X (víc než 1 nejde, 2X by se mezi výřezy nevešlo). `shift` je největší posun
vodorovných a svislých výřezů do strany (v šířkách výřezu); u hodnot nad 1 se ve výjimečných polohách ústí
o pár procent zmenší, aby se vešlo. Výřezy jsou ve dvojicích naproti sobě, takže tvar je vždy středově
souměrný. Náhoda je daná číslem `seed` a po osmi krocích (dvou otočkách) se opakuje, takže jde přesně
zopakovat i vyexportovat.

Velikosti (`min`, `max`, `base`, `peak`) jsou délka lístečku vůči finální podobě. Lísteček neroste od středu
celého tvaru, ale od své „kotvy“, tedy od průsečíku hran svých dvou výřezů. Konce výřezů se proto nikdy nepohnou.
Zaoblení rohů zůstává stejné. Zmenší se jen tehdy, když se roh na zkrácený lísteček už nevejde (stejně jako
`border-radius` v CSS). Pod 0,3 už lístečky narážejí na konce výřezů a dál se nezmenší.

Lístečky jsou očíslované po směru hodinových ručiček od 12 hodin (v ukázce je vidět po zapnutí „Ukázat rozřezání“).

## Na webu

```html
<script type="module" src="/cesta/leaf-anim.js"></script>

<leaf-anim src="/cesta/Curve.svg" animation="grow-squish" style="width: 240px"></leaf-anim>
<leaf-anim src="/cesta/Curve.svg" animation="loader" params='{"period":1200}' style="width: 48px"></leaf-anim>
```

Atributy: `animation`, `params` (JSON, přepíše jen uvedené hodnoty), `color`, `speed`,
`start="visible|load|manual"`. Výchozí `visible` spustí růst, až je prvek ze čtvrtiny vidět.
Růst se po 2 s zase zcvrkne; vypnout jde přes `params='{"reverse":false}'`.
Smyčky se mimo obrazovku samy zastaví. Z JS: `el.play()`, `el.pause()`, `el.restart()`.
Uživatelé se zapnutým omezením animací uvidí růst rovnou v hotové podobě.

U varianty pop lístečky při přerostení přesahují rámeček prvku. Okolo je potřeba nechat trochu místa.

Bez webové komponenty:

```js
import { loadLeafSvg, LeafAnimation } from './leaf-anim.js';

const geometry = await loadLeafSvg('Curve.svg');
const anim = new LeafAnimation(document.querySelector('#logo'), geometry, {
  animation: 'pairs',
  params: { peak: 1.15 },
});
```

## Export videa s průhledným pozadím

V ukázce má každá animace tlačítko **⇩ Export PNG**. Stáhne ZIP s průhlednými PNG snímky s aktuálním nastavením,
barvou a velikostí a fps z horní lišty. Snímky se počítají přesně podle času, žádný nevypadne. U růstu je v ZIPu
celá animace, u smyček jedna celá otočka, kterou jde přehrávat dokola bez švu. V ZIPu je i `prevod.txt`
s příkazy pro ffmpeg:

| Formát | Kde funguje |
|---|---|
| ProRes 4444 (`.mov`) | DaVinci Resolve, Final Cut, Premiere, After Effects, Keynote |
| WebM VP9 (`.webm`) | Chrome, Firefox, Edge |
| HEVC s průhledností (`.mov`, vyrobí jen Mac) | Safari, iPhone |

Na web patří WebM i HEVC zároveň, prohlížeč si vybere, co umí. Z JS vrátí úsek k exportu `anim.clip()`.

## Výměna SVG

Stačí přepsat `Curve.svg`, kód se neupravuje. Knihovna si z cesty při načtení sama najde:

- **rohy** – každý zaoblený roh si pamatuje svůj ostrý vrchol. Když lísteček mění velikost, posouvá se jen vrchol a tvar rohu kolem něj zůstává (stálé zaoblení). Při „zmáčknutí“ se roh stahuje k vrcholu, rovné hrany zůstávají na místě.
- **výřezy** – zářez, ve kterém obrys otočí o 180° (zaoblený nebo rovný konec). Konce výřezů se při animaci nehýbou.
- **lístečky** – část obrysu mezi dvěma sousedními výřezy a její kotva (průsečík hran obou výřezů). Celý tvar se v každém snímku kreslí jako jedna cesta, takže mezi lístečky nejsou švy ani zuby.

Nové SVG nejdřív vyzkoušej v ukázce: tlačítko „Vyzkoušet jiné SVG…“ nebo přetažení souboru do okna, pak zapnout „Ukázat rozřezání“.

Podmínky pro SVG:

- jedna vyplněná cesta s výřezy; pokud je cest víc, bere se každá jako jeden lísteček,
- bez oblouků (příkaz `A` v cestě). Affinity je neexportuje, jinde stačí tvar převést na křivky,
- transformace (`matrix`, `translate`, `scale`, `rotate`…) na skupinách nevadí.
