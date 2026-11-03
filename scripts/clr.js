/*
 * Čtečka macOS barevných palet (.clr, NSColorList) pro Node bez závislostí.
 *
 * Soubor je ve starém formátu typedstream. Důležité vlastnosti:
 *   – čísla jsou buď jeden bajt (< 0x80), nebo značka 0x81 (int16) / 0x82 (int32),
 *     čísla s plovoucí řádovou čárkou mají značku 0x83 + float32,
 *   – 0x84 = nová položka, 0x85 = nil, 0x86 = konec objektu, hodnoty ≥ 0x92 jsou odkazy,
 *   – odkazy se čtou ze dvou oddělených tabulek číslovaných od 0x92: řetězce
 *     (typové kódy a názvy tříd) a objekty (instance i třídy).
 *
 * Obsah je [1, nil, N, (NSColor, NSString) × N]: barva a její název.
 */
'use strict';

class ClrError extends Error {}

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.i = 0;
    this.strings = [];
    this.objects = [];
  }

  byte() {
    if (this.i >= this.buf.length) throw new ClrError('Neočekávaný konec souboru');
    return this.buf[this.i++];
  }

  peek() {
    return this.i < this.buf.length ? this.buf[this.i] : null;
  }

  int() {
    const b = this.byte();
    if (b < 0x80) return b;
    if (b === 0x81) { const v = this.buf.readInt16LE(this.i); this.i += 2; return v; }
    if (b === 0x82) { const v = this.buf.readInt32LE(this.i); this.i += 4; return v; }
    throw new ClrError(`Neplatná značka čísla 0x${b.toString(16)} na pozici ${this.i - 1}`);
  }

  float() {
    const b = this.byte();
    if (b === 0x83) { const v = this.buf.readFloatLE(this.i); this.i += 4; return v; }
    if (b < 0x80) return b;
    throw new ClrError(`Neplatná značka floatu 0x${b.toString(16)} na pozici ${this.i - 1}`);
  }

  rawString() {
    const n = this.int();
    const end = this.i + n;
    if (end > this.buf.length) throw new ClrError('Řetězec přesahuje konec souboru');
    const s = this.buf.toString('utf8', this.i, end);
    this.i = end;
    return s;
  }

  sharedString() {
    const b = this.byte();
    if (b === 0x84) { const s = this.rawString(); this.strings.push(s); return s; }
    if (b === 0x85) return null;
    const s = this.strings[b - 0x92];
    if (b < 0x92 || s === undefined) throw new ClrError(`Neplatný odkaz na řetězec 0x${b.toString(16)}`);
    return s;
  }

  cls() {
    const b = this.byte();
    if (b === 0x84) {
      const slot = this.objects.length;
      this.objects.push(null);
      const name = this.sharedString();
      this.int();   // verze třídy
      this.cls();   // nadřazená třída
      this.objects[slot] = { kind: 'class', name };
      return name;
    }
    if (b === 0x85) return null;
    const o = this.objects[b - 0x92];
    if (b < 0x92 || !o || o.kind !== 'class') throw new ClrError(`Neplatný odkaz na třídu 0x${b.toString(16)}`);
    return o.name;
  }

  object() {
    const b = this.byte();
    if (b === 0x84) {
      const slot = this.objects.length;
      this.objects.push(null);
      const cls = this.cls();
      const values = [];
      while (this.peek() !== 0x86) values.push(...this.group());
      this.byte();
      this.objects[slot] = { kind: 'object', cls, values };
      return this.objects[slot];
    }
    if (b === 0x85) return null;
    const o = this.objects[b - 0x92];
    if (b < 0x92 || !o || o.kind !== 'object') throw new ClrError(`Neplatný odkaz na objekt 0x${b.toString(16)}`);
    return o;
  }

  group() {
    const encoding = this.sharedString();
    const out = [];
    for (const ch of encoding) {
      if ('cCsSiIlLqQ'.includes(ch)) out.push(this.int());
      else if (ch === 'f') out.push(this.float());
      else if (ch === '@') out.push(this.object());
      else if (ch === '+') out.push(this.rawString());
      else throw new ClrError(`Neznámý typ "${ch}"`);
    }
    return out;
  }

  parse() {
    if (this.byte() !== 4 || this.rawString() !== 'streamtyped') throw new ClrError('Není typedstream');
    this.int();   // verze systému
    const items = [];
    while (this.i < this.buf.length) items.push(...this.group());
    return items;
  }
}

/**
 * @param {Buffer} buf obsah .clr souboru
 * @returns {{name: string, space: number, rgba: number[]}[]} barvy v pořadí v souboru;
 *   složky rgba jsou 0–1 (float32), space 1 = kalibrované RGB
 */
function parseClr(buf) {
  const items = new Reader(buf).parse();
  const count = items[2];
  const pairs = items.slice(3);
  if (pairs.length !== count * 2) {
    throw new ClrError(`Hlavička říká ${count} barev, v souboru je ${pairs.length / 2}`);
  }
  const colors = [];
  for (let k = 0; k < pairs.length; k += 2) {
    const color = pairs[k];
    const name = pairs[k + 1];
    if (!color || color.cls !== 'NSColor' || !name || name.cls !== 'NSString') {
      throw new ClrError(`Položka ${k / 2 + 1} není dvojice NSColor + NSString`);
    }
    const [space, r, g, b, a] = color.values;
    colors.push({ name: name.values[0], space, rgba: [r, g, b, a] });
  }
  return colors;
}

module.exports = { parseClr, ClrError };
