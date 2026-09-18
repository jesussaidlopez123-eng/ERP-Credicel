export type LabelSizeId = 'roll58' | 'in35x25';

export interface LabelSize {
  id: LabelSizeId;
  title: string;
  hint: string;
  page: string;
  width: string;
  height: string;
  stacked: boolean;
}

export const LABEL_SIZE_KEY = 'erp_inventory_label_size_v1';

export const LABEL_SIZES: Record<LabelSizeId, LabelSize> = {
  roll58: {
    id: 'roll58',
    title: '58 mm',
    hint: 'Rollo térmico, una pegada a la otra',
    page: '58mm auto',
    width: '58mm',
    height: 'auto',
    stacked: true
  },
  in35x25: {
    id: 'in35x25',
    title: '3.5 × 2.5 in',
    hint: 'Etiqueta 3.5 de ancho × 2.5 de alto (no 4 × 6)',
    page: '3.5in 2.5in',
    width: '3.5in',
    height: '2.5in',
    stacked: false
  }
};

export const LABEL_SIZE_OPTIONS: LabelSize[] = [LABEL_SIZES.roll58, LABEL_SIZES.in35x25];

export function isLabelSizeId(value: string): value is LabelSizeId {
  return value === 'roll58' || value === 'in35x25';
}

export function loadLabelSize(): LabelSizeId {
  try {
    const raw = localStorage.getItem(LABEL_SIZE_KEY) || '';
    if (isLabelSizeId(raw)) return raw;
  } catch {
    // private mode
  }
  return 'in35x25';
}

export function saveLabelSize(id: LabelSizeId): void {
  try {
    localStorage.setItem(LABEL_SIZE_KEY, id);
  } catch {
    // ignore
  }
}

export function labelPrintCss(sizeId: LabelSizeId): string {
  const size = LABEL_SIZES[sizeId] || LABEL_SIZES.in35x25;
  const breakAfter = size.stacked ? 'auto' : 'page';
  const stickerHeight = size.stacked
    ? `min-height: 0;
        height: auto;
        padding: 1.6mm 2mm;`
    : `height: ${size.height};
        max-height: ${size.height};
        padding: 0.12in 0.14in;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;`;
  const typeScale = size.stacked
    ? `.store { font-size: 8px; font-weight: 800; letter-spacing: 0.12em; }
      .code { font-size: 10px; font-family: 'Courier New', monospace; font-weight: 700; margin-top: 0.6mm; }
      .name { font-size: 11px; font-weight: 700; line-height: 1.15; margin: 0.6mm 0; }
      .barcode { width: 52mm; height: 14mm; object-fit: contain; }
      .price { font-size: 15px; font-weight: 800; margin-top: 0.4mm; }`
    : `.store { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; }
      .code { font-size: 13px; font-family: 'Courier New', monospace; font-weight: 700; margin-top: 0.06in; }
      .name { font-size: 15px; font-weight: 700; line-height: 1.15; margin: 0.05in 0; max-height: 0.42in; overflow: hidden; }
      .barcode { width: 3.1in; height: 0.72in; object-fit: contain; }
      .price { font-size: 22px; font-weight: 800; margin-top: 0.04in; }`;

  return `
      @page { size: ${size.page}; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${size.width};
        background: #fff;
        color: #000;
      }
      .sticker {
        width: ${size.width};
        ${stickerHeight}
        margin: 0;
        text-align: center;
        font-family: Arial, Helvetica, sans-serif;
        overflow: hidden;
        page-break-after: ${breakAfter};
        break-after: ${breakAfter};
        page-break-inside: avoid;
        break-inside: avoid;
        ${size.stacked ? 'border-bottom: 1px dashed #000;' : ''}
      }
      .sticker:last-child { page-break-after: auto; break-after: auto; border-bottom: none; }
      ${typeScale}
    `;
}
