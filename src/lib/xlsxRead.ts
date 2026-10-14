/** Lee la primera hoja de un .xlsx (Excel) o un CSV/TSV. */

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { inflateRawSync } = await import('node:zlib');
  return inflateRawSync(data);
}

type ZipEntry = { name: string; data: Uint8Array };

async function unzip(bytes: Uint8Array): Promise<ZipEntry[]> {
  let eocd = -1;
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('El archivo de Excel no se pudo leer (ZIP).');
  const count = u16(bytes, eocd + 10);
  let offset = u32(bytes, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(bytes, offset) !== 0x02014b50) throw new Error('El Excel está dañado.');
    const method = u16(bytes, offset + 10);
    const compSize = u32(bytes, offset + 20);
    const nameLen = u16(bytes, offset + 28);
    const extraLen = u16(bytes, offset + 30);
    const commentLen = u16(bytes, offset + 32);
    const localOff = u32(bytes, offset + 42);
    const name = new TextDecoder('utf-8').decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    const localNameLen = u16(bytes, localOff + 26);
    const localExtraLen = u16(bytes, localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : compressed;
    entries.push({ name, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) {
    n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  }
  return Math.max(0, n - 1);
}

function rowIndex(ref: string): number {
  const m = ref.match(/\d+/);
  return m ? Math.max(0, Number(m[0]) - 1) : 0;
}

function xmlText(block: string): string {
  return block
    .replace(/<t[^>]*>/g, '')
    .replace(/<\/t>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((hit) => xmlText(hit[1]));
    out.push(texts.join(''));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1] || ''))) {
      const attrs = cellMatch[1] || cellMatch[3] || '';
      const inner = cellMatch[2] || '';
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1] || '';
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      const col = colIndex(ref);
      const row = rowIndex(ref);
      while (rows.length <= row) rows.push([]);
      let value = '';
      if (type === 's') {
        const idx = Number((inner.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1] || '');
        value = Number.isFinite(idx) ? shared[idx] || '' : '';
      } else if (type === 'inlineStr') {
        value = xmlText(inner);
      } else {
        value = xmlText((inner.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1] || '');
      }
      while (rows[row].length <= col) rows[row].push('');
      rows[row][col] = value;
    }
  }
  return rows.filter((row) => row.some((cell) => String(cell || '').trim()));
}

export function parseDelimitedText(text: string): string[][] {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  if (!raw.trim()) return [];
  const firstLine = raw.split(/\r?\n/, 1)[0] || '';
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ';'
      : ',';
  if (delimiter === '\t') {
    return raw
      .split(/\r?\n/)
      .map((line) => line.split('\t').map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell));
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch !== '\r') cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export async function parseSpreadsheetTable(bytes: Uint8Array, filename = ''): Promise<string[][]> {
  const name = filename.toLowerCase();
  const looksZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (looksZip || name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const files = await unzip(bytes);
    const byName = new Map(files.map((f) => [f.name.replace(/\\/g, '/'), f]));
    const sharedXml = byName.get('xl/sharedStrings.xml');
    const shared = sharedXml ? parseSharedStrings(decodeXml(sharedXml.data)) : [];
    const sheet =
      byName.get('xl/worksheets/sheet1.xml') ||
      files.find((f) => /xl\/worksheets\/sheet\d+\.xml$/i.test(f.name));
    if (!sheet) throw new Error('El Excel no trae una hoja de datos.');
    const rows = parseSheet(decodeXml(sheet.data), shared);
    if (!rows.length) throw new Error('La hoja de Excel está vacía.');
    return rows;
  }
  const text = new TextDecoder('utf-8').decode(bytes);
  const rows = parseDelimitedText(text);
  if (!rows.length) throw new Error('El archivo no tiene filas.');
  return rows;
}
