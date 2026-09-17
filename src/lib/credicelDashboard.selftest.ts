import assert from 'node:assert/strict';
import { canOpenModule } from './roles.ts';
import {
  applyDashSelection,
  bodyHtmlToCheckItems,
  checkItemsToBodyHtml,
  dashDocForCloud,
  dashDocSnippet,
  emptyCheckItem,
  emptyDashDoc,
  fileExtOf,
  fileKindOf,
  isDashDocEmpty,
  metadataAttachments,
  sanitizeDashHtml,
  sortCheckedItemsLast,
  sortDashDocs,
  stripDashHtml,
  toggleDashItem
} from './credicelDashboard.ts';

const items = [
  { id: 'a', text: 'Revisar corte', checked: false, struck: false },
  { id: 'b', text: 'Subir factura', checked: false, struck: false }
];

const checked = toggleDashItem(items, 'a', 'checked');
assert.equal(checked[0].id, 'b');
assert.equal(checked[0].checked, false);
assert.equal(checked[1].id, 'a');
assert.equal(checked[1].checked, true);

const struck = applyDashSelection(checked, ['b'], 'strike');
assert.equal(struck.find((item) => item.id === 'b')?.struck, true);

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
assert.equal(fileKindOf('image/png', 'foto.png'), 'image');
assert.equal(fileKindOf('application/pdf', 'guia.pdf'), 'pdf');
assert.equal(fileExtOf('poliza.pdf'), 'PDF');
assert.equal(fileExtOf('foto.jpeg'), 'JPEG');
assert.equal(fileExtOf('sin-extension'), 'ARCHIVO');

assert.equal(canOpenModule('admin', 'credicelDashboard'), true);
assert.equal(canOpenModule('manager', 'credicelDashboard'), true);
assert.equal(canOpenModule('cashier', 'credicelDashboard'), false);

let checkId = 0;
const fromHtml = bodyHtmlToCheckItems('<div>Cortar</div><div>Cobrar</div>', () => `id-${checkId++}`);
assert.equal(fromHtml.map((item) => item.text).join(','), 'Cortar,Cobrar');
const back = checkItemsToBodyHtml([
  emptyCheckItem('1', 'Cortar'),
  { id: '2', text: 'Cobrar', checked: true, struck: false }
]);
assert.equal(back.includes('Cortar'), true);
assert.equal(back.includes('<s>Cobrar</s>'), true);
assert.equal(sortCheckedItemsLast([
  { id: 'done', text: 'Ya', checked: true, struck: false },
  { id: 'open', text: 'Pendiente', checked: false, struck: false }
])[0].id, 'open');

console.log('credicelDashboard self-test ok');
