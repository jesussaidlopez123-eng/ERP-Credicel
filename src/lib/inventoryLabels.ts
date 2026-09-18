import { jsPDF } from 'jspdf';

export type LabelSizeId = 'roll58' | 'cm35x25';

export interface LabelSize {
  id: LabelSizeId;
  title: string;
  hint: string;
  page: string;
  width: string;
  height: string;
  stacked: boolean;
}

export interface LabelPrintItem {
  code: string;
  name: string;
  price: string;
  barcodeDataUrl: string;
}

export const LABEL_SIZE_KEY = 'erp_inventory_label_size_v1';

/** 3.5 cm × 2.5 cm — no pulgadas. */
export const STICKER_WIDTH_MM = 35;
export const STICKER_HEIGHT_MM = 25;

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
  cm35x25: {
    id: 'cm35x25',
    title: '3.5 × 2.5 cm',
    hint: 'Ribetec RT420BE: 3.5 cm de ancho × 2.5 cm de alto, horizontal',
    page: '35mm 25mm',
    width: '35mm',
    height: '25mm',
    stacked: false
  }
};

export const LABEL_SIZE_OPTIONS: LabelSize[] = [LABEL_SIZES.roll58, LABEL_SIZES.cm35x25];

/** Cómo debe quedar el cuadro de impresión / driver de la RT420BE. */
export const RT420BE_PRINT_SETTINGS: { label: string; value: string }[] = [
  { label: 'Impresora', value: 'Ribetec RT420BE' },
  { label: 'Tamaño de papel', value: '35 × 25 mm' },
  { label: 'Orientación', value: 'Horizontal' },
  { label: 'Escala', value: '100% (no ajustar)' },
  { label: 'Márgenes', value: 'Ninguno' },
  { label: 'Páginas por hoja', value: '1' },
  { label: 'No usar', value: 'Carta ni 4 × 6' }
];

export function isLabelSizeId(value: string): value is LabelSizeId {
  return value === 'roll58' || value === 'cm35x25';
}

export function labelPageMm(sizeId: LabelSizeId): { widthMm: number; heightMm: number } {
  if (sizeId === 'cm35x25') return { widthMm: STICKER_WIDTH_MM, heightMm: STICKER_HEIGHT_MM };
  return { widthMm: 58, heightMm: 28 };
}

export function loadLabelSize(): LabelSizeId {
  try {
    const raw = localStorage.getItem(LABEL_SIZE_KEY) || '';
    if (raw === 'in35x25') return 'cm35x25';
    if (isLabelSizeId(raw)) return raw;
  } catch {
    // private mode
  }
  return 'cm35x25';
}

export function saveLabelSize(id: LabelSizeId): void {
  try {
    localStorage.setItem(LABEL_SIZE_KEY, id);
  } catch {
    // ignore
  }
}

export function labelPrintCss(sizeId: LabelSizeId): string {
  const size = LABEL_SIZES[sizeId] || LABEL_SIZES.cm35x25;
  const breakAfter = size.stacked ? 'auto' : 'page';
  // Ancho × alto en mm. No poner "landscape": Chrome lo voltea a vertical.
  const pageSize = size.page;
  const stickerHeight = size.stacked
    ? `min-height: 0;
        height: auto;
        padding: 1.6mm 2mm;`
    : `height: ${size.height};
        max-height: ${size.height};
        padding: 0.8mm 1.2mm;
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
    : `.store { font-size: 6px; font-weight: 800; letter-spacing: 0.1em; }
      .code { font-size: 7px; font-family: 'Courier New', monospace; font-weight: 700; margin-top: 0.3mm; }
      .name { font-size: 7px; font-weight: 700; line-height: 1.05; margin: 0.2mm 0; max-height: 4.2mm; overflow: hidden; }
      .barcode { width: 32mm; height: 8mm; object-fit: contain; }
      .price { font-size: 10px; font-weight: 800; margin-top: 0.2mm; }`;

  return `
      @page { size: ${pageSize}; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${size.width};
        height: ${size.stacked ? 'auto' : size.height};
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

export function createInventoryLabelPdf(items: LabelPrintItem[]): ArrayBuffer {
  const widthMm = STICKER_WIDTH_MM;
  const heightMm = STICKER_HEIGHT_MM;
  const doc = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: 'landscape',
    compress: true
  });
  doc.setProperties({
    title: 'Etiquetas CREDI CEL 3.5x2.5 cm',
    subject: '35mm x 25mm, una etiqueta por pagina'
  });
  doc.viewerPreferences({
    PrintScaling: 'None',
    PickTrayByPDFSize: true,
    PrintArea: 'MediaBox',
    Duplex: 'Simplex',
    NumCopies: 1
  });

  items.forEach((item, index) => {
    if (index > 0) doc.addPage([widthMm, heightMm], 'landscape');
    drawLabelPage(doc, item, widthMm, heightMm);
  });

  return doc.output('arraybuffer');
}

/** Caja de página del PDF en puntos (72 pt = 1 in). 35×25 mm ≈ 99.21×70.87 pt. */
export function pdfMediaBoxPoints(pdf: ArrayBuffer): { widthPt: number; heightPt: number } {
  const text = new TextDecoder('latin1').decode(pdf);
  const match = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  if (!match) {
    throw new Error('PDF sin MediaBox');
  }
  return {
    widthPt: Number(match[3]) - Number(match[1]),
    heightPt: Number(match[4]) - Number(match[2])
  };
}

function drawLabelPage(
  doc: jsPDF,
  item: LabelPrintItem,
  widthMm: number,
  heightMm: number
): void {
  const cx = widthMm / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, widthMm, heightMm, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('CREDI CEL', cx, 3.1, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.text(item.code || '', cx, 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const nameLines = doc.splitTextToSize(item.name || '', 32);
  doc.text(nameLines.slice(0, 1), cx, 8.6, { align: 'center' });

  if (item.barcodeDataUrl) {
    try {
      doc.addImage(item.barcodeDataUrl, 'PNG', 1.5, 10.2, 32, 8.2);
    } catch {
      // barcode opcional
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`$${item.price}`, cx, 22.6, { align: 'center' });
}
