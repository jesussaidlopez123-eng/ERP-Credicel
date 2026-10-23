/** ESC/POS para térmica 58 mm: 32 columnas, CP850 (ñ, acentos). */

export const ESC_POS_COLS = 32;

const CP850: Record<string, number> = {
  Á: 0xb5,
  É: 0x90,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  Ü: 0x9a,
  Ñ: 0xa5,
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ü: 0x81,
  ñ: 0xa4,
  '¡': 0xad,
  '¿': 0xa8,
  º: 0xa7,
  '°': 0xf8,
  '×': 0x9e,
};

export function encodeCp850(text: string): number[] {
  const out: number[] = [];
  for (const ch of String(text || '')) {
    const code = ch.codePointAt(0) || 0;
    if (code === 10) {
      out.push(0x0a);
      continue;
    }
    if (code < 128) {
      out.push(code);
      continue;
    }
    out.push(CP850[ch] ?? 0x3f);
  }
  return out;
}

export function wrapLine(text: string, cols = ESC_POS_COLS): string[] {
  const t = String(text || '');
  if (!t) return [''];
  const lines: string[] = [];
  let rest = t;
  while (rest.length > cols) {
    lines.push(rest.slice(0, cols));
    rest = rest.slice(cols);
  }
  lines.push(rest);
  return lines;
}

export function pairLine(left: string, right: string, cols = ESC_POS_COLS): string {
  const r = String(right || '');
  const maxLeft = Math.max(0, cols - r.length);
  let l = String(left || '');
  if (l.length > maxLeft) l = l.slice(0, maxLeft);
  const gap = cols - l.length - r.length;
  return `${l}${' '.repeat(Math.max(0, gap))}${r}`;
}

export function dashedLine(cols = ESC_POS_COLS): string {
  return '-'.repeat(cols);
}

const CODE39 = /^[0-9A-Z .$%+\-/]+$/;

export function isCode39Safe(value: string): boolean {
  return CODE39.test(String(value || '').toUpperCase());
}

export class EscPosBuilder {
  private bytes: number[] = [];

  init(): this {
    this.bytes.push(0x1b, 0x40);
    return this;
  }

  align(side: 'left' | 'center' | 'right'): this {
    const n = side === 'center' ? 1 : side === 'right' ? 2 : 0;
    this.bytes.push(0x1b, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.bytes.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  double(on: boolean): this {
    this.bytes.push(0x1d, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  /** Solo alto ×2: 32 columnas y letra que se lee en 58 mm. */
  doubleHeight(on: boolean): this {
    this.bytes.push(0x1d, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  codePage850(): this {
    this.bytes.push(0x1b, 0x74, 0x02);
    return this;
  }

  normal(): this {
    this.bytes.push(0x1d, 0x21, 0x00);
    this.bytes.push(0x1b, 0x45, 0);
    this.bytes.push(0x1b, 0x61, 0);
    return this;
  }

  text(value: string): this {
    this.bytes.push(...encodeCp850(value));
    return this;
  }

  line(value = ''): this {
    this.text(`${value}\n`);
    return this;
  }

  wrapped(value: string): this {
    for (const part of wrapLine(value)) this.line(part);
    return this;
  }

  pair(left: string, right: string): this {
    this.line(pairLine(left, right));
    return this;
  }

  dash(): this {
    this.line(dashedLine());
    return this;
  }

  code39(data: string): this {
    const payload = String(data || '')
      .toUpperCase()
      .replace(/[^0-9A-Z .$%+\-/]/g, '');
    if (!payload || !isCode39Safe(payload)) return this;
    this.bytes.push(0x1d, 0x68, 50);
    this.bytes.push(0x1d, 0x77, 2);
    this.bytes.push(0x1d, 0x48, 2);
    this.bytes.push(0x1d, 0x6b, 0x04);
    for (let i = 0; i < payload.length; i++) this.bytes.push(payload.charCodeAt(i));
    this.bytes.push(0x00);
    this.line();
    return this;
  }

  feed(lines = 2): this {
    this.bytes.push(0x1b, 0x64, Math.max(0, Math.min(4, lines)));
    return this;
  }

  /** Corte parcial sin avance extra. Si no hay cuchilla, no empuja el rollo. */
  cut(): this {
    this.bytes.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(String(text || '')));
}

export function centerLine(text: string, cols = ESC_POS_COLS): string {
  const t = String(text || '');
  if (t.length >= cols) return t.slice(0, cols);
  return `${' '.repeat(Math.floor((cols - t.length) / 2))}${t}`;
}

type DraftLine =
  | { kind: 'center'; text: string }
  | { kind: 'left'; text: string }
  | { kind: 'pair'; left: string; right: string }
  | { kind: 'dash' };

const TOTAL_LABEL = /^(TOTAL|TOTAL VENTAS|TOTAL CAJA|SALIDA|UTILIDAD)\b/i;
const BRAND_LINE = /^CREDI CEL$/i;
const TITLE_LINE = /^(CORTE DE CAJA|VALE DE SALIDA|FIN DE CORTE)/i;

export class TicketDraft {
  private lines: DraftLine[] = [];

  center(value: string): this {
    this.lines.push({ kind: 'center', text: String(value || '') });
    return this;
  }

  left(value: string): this {
    this.lines.push({ kind: 'left', text: String(value || '') });
    return this;
  }

  wrapped(value: string): this {
    for (const part of wrapLine(value)) this.left(part);
    return this;
  }

  pair(left: string, right: string): this {
    this.lines.push({ kind: 'pair', left: String(left || ''), right: String(right || '') });
    return this;
  }

  dash(): this {
    this.lines.push({ kind: 'dash' });
    return this;
  }

  toPlainText(): string {
    const out: string[] = [];
    for (const line of this.lines) {
      if (line.kind === 'center') out.push(centerLine(line.text));
      else if (line.kind === 'left') out.push(line.text);
      else if (line.kind === 'pair') out.push(pairLine(line.left, line.right));
      else out.push(dashedLine());
    }
    return `${out.join('\n')}\n\n`;
  }

  toEscPos(): Uint8Array {
    const esc = new EscPosBuilder().init().codePage850();
    for (const line of this.lines) {
      if (line.kind === 'center') {
        esc.align('center');
        if (BRAND_LINE.test(line.text)) esc.double(true).bold(true);
        else if (TITLE_LINE.test(line.text)) esc.doubleHeight(true).bold(true);
        else esc.doubleHeight(true).bold(false);
        esc.line(line.text);
        esc.double(false).bold(false);
        continue;
      }
      esc.align('left').doubleHeight(true);
      if (line.kind === 'pair') {
        if (TOTAL_LABEL.test(line.left)) esc.bold(true);
        esc.line(pairLine(line.left, line.right));
        esc.bold(false);
      } else if (line.kind === 'left') {
        esc.line(line.text);
      } else {
        esc.line(dashedLine());
      }
    }
    esc.normal().feed(2).cut();
    return esc.toBytes();
  }
}
