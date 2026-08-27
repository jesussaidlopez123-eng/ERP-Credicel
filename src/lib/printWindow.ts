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
  }
  .sheet {
    width: 54mm;
    margin: 0 auto;
    padding: 1.5mm 1mm 10mm 1mm;
    font-size: 10px;
    line-height: 1.25;
    color: #000;
  }
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
