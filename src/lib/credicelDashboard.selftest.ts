import assert from 'node:assert/strict';
import { canOpenModule } from './roles.ts';
import {
  applyDashSelection,
  dashDocForCloud,
  dashDocSnippet,
  emptyDashDoc,
  isDashDocEmpty,
  metadataAttachments,
  sanitizeDashHtml,
  sortDashDocs,
  stripDashHtml,
  toggleDashItem
} from './credicelDashboard.ts';

const items = [
  { id: 'a', text: 'Revisar corte', checked: false, struck: false },
  { id: 'b', text: 'Subir factura', checked: false, struck: false }
];

const checked = toggleDashItem(items, 'a', 'checked');
assert.equal(checked[0].checked, true);
assert.equal(checked[1].checked, false);

const struck = applyDashSelection(checked, ['b'], 'strike');
assert.equal(struck[1].struck, true);

const removed = applyDashSelection(struck, ['a'], 'remove');
assert.equal(removed.length, 1);
assert.equal(removed[0].id, 'b');

assert.equal(isDashDocEmpty(emptyDashDoc()), true);
assert.equal(isDashDocEmpty(emptyDashDoc({ title: 'Contrato' })), false);

const html = sanitizeDashHtml('<p>Hola <script>alert(1)</script><s>viejo</s></p>');
assert.equal(html.includes('script'), false);
assert.equal(stripDashHtml('<p>Nota&nbsp;<br>corta</p>').includes('Nota'), true);

const cloud = dashDocForCloud(
  emptyDashDoc({
    id: 'd1',
    title: '  Guía  ',
    bodyHtml: '<p>Texto</p>',
    attachments: [
      {
        id: 'f1',
        title: 'Póliza',
        fileName: 'poliza.pdf',
        mimeType: 'application/pdf',
        size: 1200,
        hasLocal: true
      }
    ]
  })
);
assert.equal(cloud.title, 'Guía');
assert.equal(metadataAttachments(cloud.attachments)[0].fileName, 'poliza.pdf');
assert.equal(dashDocSnippet(cloud).startsWith('Texto'), true);

const pinnedFirst = sortDashDocs([
  emptyDashDoc({ id: 'later', pinned: false, updatedAt: '2026-09-02T00:00:00.000Z' }),
  emptyDashDoc({ id: 'fixed', pinned: true, updatedAt: '2026-09-01T00:00:00.000Z' })
]);
assert.equal(pinnedFirst[0].id, 'fixed');
assert.equal(pinnedFirst[1].id, 'later');

assert.equal(canOpenModule('admin', 'credicelDashboard'), true);
assert.equal(canOpenModule('manager', 'credicelDashboard'), true);
assert.equal(canOpenModule('cashier', 'credicelDashboard'), false);

console.log('credicelDashboard self-test ok');
