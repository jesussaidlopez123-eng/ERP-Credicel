import JsBarcode from 'jsbarcode';

export function barcodePngDataUrl(value: string): string {
  const text = (value || '').trim() || 'SIN-CODIGO';
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: 46,
      displayValue: true,
      fontSize: 12,
      margin: 2,
      background: '#ffffff',
      lineColor: '#000000'
    });
  } catch {
    const safe = text.replace(/[^A-Za-z0-9\-_.]/g, '').slice(0, 22) || 'CREDICEL';
    JsBarcode(canvas, safe, {
      format: 'CODE128',
      width: 2,
      height: 46,
      displayValue: true,
      fontSize: 12,
      margin: 2,
      background: '#ffffff',
      lineColor: '#000000'
    });
  }
  return canvas.toDataURL('image/png');
}
