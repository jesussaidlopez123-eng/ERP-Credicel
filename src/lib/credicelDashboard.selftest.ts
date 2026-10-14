import assert from 'node:assert/strict';
import { canOpenModule, defaultModuleForRole } from './roles.ts';
import {
  applyDashSelection,
  bodyHtmlToCheckItems,
  checkItemsToBodyHtml,
  dashDocForCloud,
  dashDocSnippet,
  dashHtmlLines,
  emptyCheckItem,
  emptyDashDoc,
  fileExtOf,
  fileKindOf,
  formatNoteLineDate,
  isDashDocEmpty,
  mergeDashDocsFromCloud,
  metadataAttachments,
  sanitizeDashHtml,
  sortCheckedItemsLast,
  sortDashDocs,
  stampDashHtmlLines,
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
assert.equal(canOpenModule('manager', 'repairs'), true);
assert.equal(canOpenModule('cashier', 'credicelDashboard'), false);
assert.equal(canOpenModule('cashier', 'repairs'), false);
assert.equal(defaultModuleForRole('admin'), 'credicelDashboard');
assert.equal(defaultModuleForRole('manager'), 'credicelDashboard');
assert.equal(defaultModuleForRole('cashier'), 'pos');

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

const stampedAt = '2026-09-22T10:15:00-07:00';
const stamped = stampDashHtmlLines('<div>Pedir refacción</div><div>Avisar a Navojoa</div>', stampedAt);
assert.match(stamped, /data-at="2026-09-22T10:15:00-07:00"/);
assert.match(stamped, /dash-note-line/);
const kept = sanitizeDashHtml(stamped);
assert.match(kept, /data-at="2026-09-22T10:15:00-07:00"/);
const lines = dashHtmlLines(stamped, stampedAt);
assert.equal(lines.length, 2);
assert.equal(lines[0].text, 'Pedir refacción');
assert.equal(lines[0].at, stampedAt);
assert.match(formatNoteLineDate(stampedAt), /22/);
const datedItems = bodyHtmlToCheckItems(stamped, () => `id-${checkId++}`);
assert.equal(datedItems[0].createdAt, stampedAt);
const backDated = checkItemsToBodyHtml(datedItems);
assert.match(backDated, /data-at="2026-09-22T10:15:00-07:00"/);

{
  const local = [
    emptyDashDoc({ id: 'n1', title: 'ERP MEJORAS', updatedAt: '2026-10-14T10:00:00-07:00' }),
    emptyDashDoc({ id: 'n2', title: 'REPARACIONES', updatedAt: '2026-10-14T11:00:00-07:00' })
  ];
  const kept = mergeDashDocsFromCloud(local, []);
  assert.equal(kept.length, 2, 'nube vacía no borra las notas de este equipo');
  assert.equal(kept[0].title === 'ERP MEJORAS' || kept[1].title === 'ERP MEJORAS', true);
  const newer = emptyDashDoc({
    id: 'n1',
    title: 'ERP MEJORAS v2',
    updatedAt: '2026-10-14T12:00:00-07:00'
  });
  const merged = mergeDashDocsFromCloud(local, [newer]);
  assert.equal(merged.find((d) => d.id === 'n1')?.title, 'ERP MEJORAS v2');
  assert.equal(merged.some((d) => d.id === 'n2'), true, 'se conservan las notas que la nube no mandó');
}

console.log('credicelDashboard self-test ok');
