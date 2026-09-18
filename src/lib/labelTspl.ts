import { LabelPrintItem, STICKER_HEIGHT_MM, STICKER_WIDTH_MM } from './inventoryLabels';

const BAT_MARK = '__CREDICEL_PS1_B64__';

function tsplSafe(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ñÑ]/g, 'n')
    .replace(/["`]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupLabels(items: LabelPrintItem[]): { item: LabelPrintItem; count: number }[] {
  const groups: { item: LabelPrintItem; count: number }[] = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.item.code === item.code &&
      last.item.name === item.name &&
      last.item.price === item.price
    ) {
      last.count += 1;
      return;
    }
    groups.push({ item, count: 1 });
  });
  return groups;
}

function oneLabelTspl(item: LabelPrintItem, copies: number): string {
  const code = tsplSafe(item.code || 'SIN-CODIGO').slice(0, 24) || 'SIN-CODIGO';
  const name = tsplSafe(item.name || '').slice(0, 26);
  const price = tsplSafe(`$${item.price}`);
  const qty = Math.max(1, Math.floor(copies));
  return [
    `SIZE ${STICKER_WIDTH_MM} mm,${STICKER_HEIGHT_MM} mm`,
    'GAP 2 mm,0',
    'SPEED 4',
    'DENSITY 8',
    'DIRECTION 0',
    'REFERENCE 0,0',
    'CLS',
    'TEXT 86,8,"2",0,1,1,"CREDI CEL"',
    `TEXT 16,32,"1",0,1,1,"${code}"`,
    `TEXT 16,50,"1",0,1,1,"${name}"`,
    `BARCODE 18,70,"128",52,1,0,1,2,"${code}"`,
    `TEXT 70,162,"3",0,1,1,"${price}"`,
    `PRINT ${qty}`,
    ''
  ].join('\r\n');
}

/** Comandos TSPL: 35×25 mm, una etiqueta tras otra. No usa hoja Carta ni 4×6. */
export function createInventoryLabelTspl(items: LabelPrintItem[]): string {
  const groups = groupLabels(items);
  const body = groups.map(({ item, count }) => oneLabelTspl(item, count)).join('');
  return `CLS\r\n${body}`;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function createRawPrintScript(tspl: string, copies: number): string {
  const safeTspl = tspl.replace(/'@/g, "' @");
  return [
    '$ErrorActionPreference = "Stop"',
    'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
    "$tspl = @'",
    safeTspl.replace(/\s+$/, ''),
    "'@",
    '$prn = Join-Path $env:TEMP "credicel-rt420.prn"',
    '[IO.File]::WriteAllText($prn, $tspl, [Text.Encoding]::ASCII)',
    '$printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -match "RT420|Ribetec|Godex|TSC|TTP" } | Select-Object -First 1',
    'if (-not $printer) { $printer = Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1 }',
    'if (-not $printer) { [System.Windows.Forms.MessageBox]::Show("No se encontro la Ribetec RT420BE. Conectala e intentalo de nuevo.","CREDI CEL"); exit 1 }',
    'Add-Type -TypeDefinition @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class CredicelRawPrint {',
    '  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]',
    '  public class DOCINFOA {',
    '    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;',
    '    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;',
    '    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;',
    '  }',
    '  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]',
    '  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);',
    '  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);',
    '  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]',
    '  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);',
    '  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);',
    '  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);',
    '  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);',
    '  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);',
    '  public static bool Send(string printer, byte[] data) {',
    '    IntPtr h;',
    '    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;',
    '    var di = new DOCINFOA(); di.pDocName = "CREDI CEL 35x25mm"; di.pDataType = "RAW";',
    '    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }',
    '    StartPagePrinter(h);',
    '    IntPtr p = Marshal.AllocHGlobal(data.Length);',
    '    Marshal.Copy(data, 0, p, data.Length);',
    '    int written; WritePrinter(h, p, data.Length, out written);',
    '    Marshal.FreeHGlobal(p);',
    '    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);',
    '    return written == data.Length;',
    '  }',
    '}',
    '"@',
    '$bytes = [IO.File]::ReadAllBytes($prn)',
    'if ([CredicelRawPrint]::Send($printer.Name, $bytes)) {',
    `  [System.Windows.Forms.MessageBox]::Show("Se enviaron ${copies} etiqueta(s) a " + $printer.Name + ". Medida 35 x 25 mm, una tras otra.","CREDI CEL")`,
    '} else {',
    '  [System.Windows.Forms.MessageBox]::Show("Windows no acepto el envio RAW a " + $printer.Name + ". En Preferencias de impresion escribe Ancho 35 mm y Alto 25 mm (no busques esa medida en Chrome).","CREDI CEL")',
    '  exit 1',
    '}'
  ].join('\n');
}

/** .bat de Windows: manda TSPL en RAW a la RT420BE, sin el papel de Chrome. */
export function createRt420PrintBat(items: LabelPrintItem[]): string {
  const tspl = createInventoryLabelTspl(items);
  const script = createRawPrintScript(tspl, items.length);
  const b64 = utf8ToBase64(script).replace(/(.{120})/g, '$1\r\n');
  return [
    '@echo off',
    'setlocal',
    'chcp 65001 >nul',
    'set "SELF=%~f0"',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-Content -LiteralPath $env:SELF -Raw; $m=\'__CREDICEL_\' + \'PS1_B64__\'; $i=$c.IndexOf($m); if($i -lt 0){ throw \'archivo incompleto\' }; $b64=($c.Substring($i+$m.Length) -replace \'\\s\',\'\'); $ps=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)); $ps1=Join-Path $env:TEMP \'credicel-rt420.ps1\'; [IO.File]::WriteAllText($ps1,$ps,[Text.UTF8Encoding]::new($false)); & $ps1"',
    'if errorlevel 1 pause',
    'exit /b %ERRORLEVEL%',
    BAT_MARK,
    b64,
    ''
  ].join('\r\n');
}
