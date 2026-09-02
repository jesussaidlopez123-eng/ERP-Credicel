export function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

const THERMAL_PAGE_CSS = `
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0;
    padding: 0;
    width: 58mm;
    background: #fff;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: 8px;
    line-height: 1.1;
  }
  .sheet {
    width: 54mm;
    margin: 0 auto;
    padding: 0.5mm 0.4mm 5mm 0.4mm;
    font-size: 8px;
    line-height: 1.1;
    color: #000;
  }
  .sheet, .sheet * {
    font-size: 8px;
    line-height: 1.1;
    margin: 0;
    padding: 0;
  }
  .sheet h1, .sheet h2, .sheet h3 {
    font-size: 10px !important;
    font-weight: 800;
    line-height: 1.05;
    text-align: center;
    letter-spacing: 0;
  }
  .sheet p { font-size: 8px !important; }
  .sheet svg {
    display: block;
    width: 100%;
    max-width: 46mm;
    height: 10px !important;
    margin: 1px auto 0 auto;
  }
  /* Tailwind no viaja al iframe de impresión: recrear lo mínimo. */
  .sheet .flex {
    display: flex !important;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2px;
  }
  .sheet .text-center { text-align: center; }
  .sheet .text-right { text-align: right; }
  .sheet .font-black, .sheet .font-extrabold, .sheet .font-bold, .sheet .font-semibold {
    font-weight: 800;
  }
  .sheet .inline-block {
    display: inline-block;
    padding: 0 3px;
    background: #000;
    color: #fff;
    font-weight: 800;
  }
  .sheet .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sheet .shrink-0 { flex-shrink: 0; }
  .sheet .border-b { border-bottom: 1px dashed #000; padding-bottom: 1px; margin-bottom: 1px; }
  .sheet .border-t { border-top: 1px dashed #000; padding-top: 1px; margin-top: 1px; }
  .sheet .border-b-2, .sheet .border-double { border-bottom: 1px solid #000; }
  .sheet .space-y-1 > * + *, .sheet .space-y-0\\.5 > * + *, .sheet .space-y-3 > * + * {
    margin-top: 1px;
  }
  .sheet .h-5, .sheet .h-8, .sheet .no-screen { height: 6px !important; }
`;

export function printHtmlDocument(innerBody: string, title: string, extraCss = ''): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${extraCss}</style>
  </head>
  <body>${innerBody}</body>
</html>`);
  doc.close();

  const win = iframe.contentWindow;
  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 800);
  };
  win?.addEventListener('afterprint', cleanup);
  window.setTimeout(() => {
    try {
      win?.focus();
      win?.print();
    } catch (err) {
      console.error('Error al imprimir:', err);
      iframe.remove();
    }
  }, 280);
}

export function printThermalFromElement(elementId: string, title = 'Ticket CREDI CEL'): void {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }
  printHtmlDocument(`<div class="sheet">${el.innerHTML}</div>`, title, THERMAL_PAGE_CSS);
}
