/** Minimal uncompressed .xlsx writer. Excel, LibreOffice and Sheets open it. */

export type ExcelCell = string | number | null | undefined;

export type ExcelSheet = {
  name: string;
  rows: ExcelCell[][];
};

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encodeUtf8(file.name);
    const crc = crc32(file.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data
    ]);
    locals.push(local);
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name
      ])
    );
    offset += local.length;
  }

  const central = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);
  return concat([...locals, central, eocd]);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(index: number): string {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

function sheetXml(rows: ExcelCell[][]): string {
  const cells: string[] = [];
  rows.forEach((row, r) => {
    const parts: string[] = [];
    row.forEach((value, c) => {
      if (value === null || value === undefined || value === '') return;
      const ref = `${colLetter(c)}${r + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        parts.push(`<c r="${ref}"><v>${value}</v></c>`);
      } else {
        parts.push(`<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(value))}</t></is></c>`);
      }
    });
    if (parts.length) cells.push(`<row r="${r + 1}">${parts.join('')}</row>`);
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${cells.join('')}</sheetData></worksheet>`
  );
}

function safeSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let candidate = cleaned;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function buildXlsxBytes(sheets: ExcelSheet[]): Uint8Array {
  if (!sheets.length) throw new Error('El archivo de Excel no tiene hojas.');
  const used = new Set<string>();
  const named = sheets.map((sheet) => ({ ...sheet, name: safeSheetName(sheet.name, used) }));

  const files: { name: string; data: Uint8Array }[] = [
    {
      name: '[Content_Types].xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          named
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
            )
            .join('') +
          '</Types>'
      )
    },
    {
      name: '_rels/.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>'
      )
    },
    {
      name: 'xl/workbook.xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets>' +
          named
            .map(
              (sheet, i) =>
                `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
            )
            .join('') +
          '</sheets></workbook>'
      )
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          named
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
            )
            .join('') +
          '</Relationships>'
      )
    }
  ];

  named.forEach((sheet, i) => {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: encodeUtf8(sheetXml(sheet.rows))
    });
  });

  return zipStore(files);
}

export function downloadXlsx(filename: string, sheets: ExcelSheet[]): void {
  const bytes = buildXlsxBytes(sheets);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
