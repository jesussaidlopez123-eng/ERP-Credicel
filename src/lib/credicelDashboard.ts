import { CredicelDashAttachment, CredicelDashCheckItem, CredicelDashDoc } from '../types';
import { safeDateIsoKey, todayCashDateKey, tryParseDate } from './dateUtils';
import { CASH_TIME_ZONE } from './shiftHours';

export const KEEP_NOTE_COLORS = [
  '#ffffff',
  '#f28b82',
  '#fbbc04',
  '#fff475',
  '#ccff90',
  '#a7ffeb',
  '#cbf0f8',
  '#aecbfa',
  '#d7aefb',
  '#fdcfe8',
  '#e6c9a8',
  '#e8eaed'
];
export const DASH_VIEW_KEY = 'erp_credicel_dash_view';
export const DASH_CACHE_KEY = 'erp_credicel_dash_docs_v1';
export const MAX_DASH_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_INLINE_BLOB_BYTES = 500 * 1024;

const DASH_DB = 'credicel_dashboard_v1';
const DASH_STORE = 'files';

export function emptyDashDoc(partial: Partial<CredicelDashDoc> = {}): CredicelDashDoc {
  const now = new Date().toISOString();
  return {
    id: partial.id || '',
    title: partial.title || '',
    bodyHtml: partial.bodyHtml || '',
    items: Array.isArray(partial.items) ? partial.items : [],
    attachments: Array.isArray(partial.attachments) ? partial.attachments : [],
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    authorName: partial.authorName || '',
    authorId: partial.authorId,
    color: partial.color || '#ffffff',
    pinned: Boolean(partial.pinned),
    checklist: Boolean(partial.checklist)
  };
}

export function normalizeDashDoc(raw: unknown): CredicelDashDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<CredicelDashDoc> & { id?: string };
  if (!row.id) return null;
  return emptyDashDoc({
    id: String(row.id),
    title: String(row.title || ''),
    bodyHtml: String(row.bodyHtml || ''),
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          id: String(item.id || ''),
          text: String(item.text || ''),
          checked: Boolean(item.checked),
          struck: Boolean(item.struck),
          createdAt: item.createdAt ? String(item.createdAt) : undefined
        }))
      : [],
    attachments: Array.isArray(row.attachments)
      ? row.attachments.map((att) => ({
          id: String(att.id || ''),
          title: String(att.title || att.fileName || 'Archivo'),
          fileName: String(att.fileName || 'archivo'),
          mimeType: String(att.mimeType || 'application/octet-stream'),
          size: Number(att.size) || 0,
          storagePath: att.storagePath,
          downloadUrl: att.downloadUrl,
          hasLocal: Boolean(att.hasLocal),
          hasCloudBlob: Boolean(att.hasCloudBlob)
        }))
      : [],
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || ''),
    authorName: String(row.authorName || ''),
    authorId: row.authorId,
    color: String(row.color || '#ffffff'),
    pinned: Boolean(row.pinned),
    checklist: Boolean(row.checklist) || (Array.isArray(row.items) && row.items.length > 0)
  });
}

export function dashDocSnippet(doc: CredicelDashDoc, max = 90): string {
  if (doc.checklist || doc.items.length > 0) {
    const first = sortCheckedItemsLast(doc.items).find((item) => item.text.trim());
    if (first) {
      const text = first.text.trim();
      return text.length > max ? `${text.slice(0, max)}…` : text;
    }
  }
  const text = stripDashHtml(doc.bodyHtml).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function stripDashHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_TAGS = new Set(['B', 'I', 'S', 'STRIKE', 'U', 'BR', 'DIV', 'P', 'SPAN', 'STRONG', 'EM']);

export function sanitizeDashHtml(html: string): string {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return raw.replace(/<(?!\/?(?:b|i|s|strike|u|br|div|p|span|strong|em)\b)[^>]*>/gi, '');
  }
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  const walk = (node: Node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = child as HTMLElement;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) continue;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      [...el.attributes].forEach((attr) => {
        if (attr.name === 'data-at' || attr.name === 'data-date') return;
        if (attr.name === 'class' && /\bdash-note-line\b/.test(attr.value)) {
          el.className = 'dash-note-line';
          return;
        }
        el.removeAttribute(attr.name);
      });
      walk(el);
    }
  };
  walk(parsed.body);
  return parsed.body.innerHTML;
}

export function isDashDocEmpty(doc: Pick<CredicelDashDoc, 'title' | 'bodyHtml' | 'items' | 'attachments'>): boolean {
  if (doc.title.trim()) return false;
  if (stripDashHtml(doc.bodyHtml)) return false;
  if (doc.items.some((item) => item.text.trim())) return false;
  if (doc.attachments.length > 0) return false;
  return true;
}

export function sortDashDocs(docs: CredicelDashDoc[]): CredicelDashDoc[] {
  return [...docs].sort((a, b) => {
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export function fileKindOf(mime: string, name: string): 'image' | 'pdf' | 'file' {
  if ((mime || '').startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || (name || '').toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function fileExtOf(name: string): string {
  const match = String(name || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : 'ARCHIVO';
}

/** Fecha corta por renglón: "22 sep". Incluye año si no es el actual. */
export function formatNoteLineDate(iso?: string | null): string {
  const d = tryParseDate(iso);
  if (!d) return '';
  const key = safeDateIsoKey(iso);
  const includeYear = Boolean(key) && key.slice(0, 4) !== todayCashDateKey().slice(0, 4);
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CASH_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: '2-digit' } : {})
  })
    .format(d)
    .replace(/\./g, '');
}

function attrFromTag(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

export function dashHtmlLines(
  html: string,
  fallbackIso?: string
): Array<{ text: string; at: string }> {
  const raw = String(html || '');
  if (!raw.trim()) return [];
  const blocks = [...raw.matchAll(/<(div|p)([^>]*)>([\s\S]*?)<\/\1>/gi)];
  const fallback = fallbackIso || '';
  if (blocks.length) {
    return blocks
      .map((block) => {
        const text = stripDashHtml(block[3] || '');
        const at = attrFromTag(block[2] || '', 'data-at') || fallback;
        return { text, at };
      })
      .filter((row) => row.text);
  }
  const text = stripDashHtml(raw);
  return text ? [{ text, at: fallback }] : [];
}

export function stampDashHtmlLines(html: string, fallbackIso?: string): string {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  const fallback = fallbackIso || new Date().toISOString();
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    const children = [...parsed.body.childNodes];
    for (const node of children) {
      if (node.nodeType === 3 && (node.textContent || '').trim()) {
        const wrap = parsed.createElement('div');
        node.parentNode?.insertBefore(wrap, node);
        wrap.appendChild(node);
      }
    }
    const blocks = [...parsed.body.children].filter(
      (el) => el.tagName === 'DIV' || el.tagName === 'P'
    ) as HTMLElement[];
    if (!blocks.length && parsed.body.textContent?.trim()) {
      const wrap = parsed.createElement('div');
      wrap.innerHTML = parsed.body.innerHTML;
      parsed.body.innerHTML = '';
      parsed.body.appendChild(wrap);
      blocks.push(wrap);
    }
    for (const el of [...parsed.body.children] as HTMLElement[]) {
      if (el.tagName !== 'DIV' && el.tagName !== 'P') continue;
      const hasText = (el.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
      if (!el.getAttribute('data-at')) {
        el.setAttribute('data-at', hasText ? fallback : new Date().toISOString());
      }
      const at = el.getAttribute('data-at') || fallback;
      el.setAttribute('data-date', formatNoteLineDate(at));
      el.classList.add('dash-note-line');
    }
    return parsed.body.innerHTML;
  }
  if (/<(div|p)\b/i.test(raw)) {
    return raw.replace(/<(div|p)(\b[^>]*)>/gi, (full, tag: string, attrs: string) => {
      if (/data-at=/i.test(attrs)) {
        const at = attrFromTag(attrs, 'data-at') || fallback;
        const withDate = /data-date=/i.test(attrs)
          ? attrs
          : `${attrs} data-date="${formatNoteLineDate(at)}"`;
        const withClass = /\bclass=/i.test(withDate)
          ? withDate.replace(/class="([^"]*)"/i, (_m, cls) =>
              cls.includes('dash-note-line') ? `class="${cls}"` : `class="${cls} dash-note-line"`
            )
          : `${withDate} class="dash-note-line"`;
        return `<${tag}${withClass}>`;
      }
      return `<${tag}${attrs} data-at="${fallback}" data-date="${formatNoteLineDate(fallback)}" class="dash-note-line">`;
    });
  }
  const text = stripDashHtml(raw);
  if (!text) return '';
  return `<div data-at="${fallback}" data-date="${formatNoteLineDate(fallback)}" class="dash-note-line">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</div>`;
}

export function stampLiveNoteBody(root: HTMLElement, fallbackIso?: string): void {
  const fallback = fallbackIso || new Date().toISOString();
  const nodes = [...root.childNodes];
  for (const node of nodes) {
    if (node.nodeType === 3 && (node.textContent || '').trim()) {
      const wrap = root.ownerDocument.createElement('div');
      root.insertBefore(wrap, node);
      wrap.appendChild(node);
    }
  }
  for (const el of [...root.children] as HTMLElement[]) {
    if (el.tagName !== 'DIV' && el.tagName !== 'P') continue;
    const hasText = (el.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
    if (!el.getAttribute('data-at')) {
      el.setAttribute('data-at', hasText ? fallback : new Date().toISOString());
    }
    const at = el.getAttribute('data-at') || fallback;
    el.setAttribute('data-date', formatNoteLineDate(at));
    el.classList.add('dash-note-line');
  }
}

export function emptyCheckItem(id: string, text = '', createdAt?: string): CredicelDashCheckItem {
  return {
    id,
    text,
    checked: false,
    struck: false,
    createdAt: createdAt || (text.trim() ? new Date().toISOString() : undefined)
  };
}

export function sortCheckedItemsLast(items: CredicelDashCheckItem[]): CredicelDashCheckItem[] {
  const open = items.filter((item) => !item.checked);
  const done = items.filter((item) => item.checked);
  return [...open, ...done];
}

export function bodyHtmlToCheckItems(html: string, makeId: () => string): CredicelDashCheckItem[] {
  const structured = dashHtmlLines(html);
  if (structured.length) {
    return structured.map((row) => emptyCheckItem(makeId(), row.text, row.at || undefined));
  }
  const text = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [emptyCheckItem(makeId())];
  return lines.map((line) => emptyCheckItem(makeId(), line));
}

export function checkItemsToBodyHtml(items: CredicelDashCheckItem[]): string {
  return items
    .filter((item) => item.text.trim())
    .map((item) => {
      const text = item.text
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const at = item.createdAt || '';
      const stamp = at
        ? ` data-at="${at}" data-date="${formatNoteLineDate(at)}" class="dash-note-line"`
        : '';
      return item.checked || item.struck
        ? `<div${stamp}><s>${text}</s></div>`
        : `<div${stamp}>${text}</div>`;
    })
    .join('');
}

export function toggleDashItem(
  items: CredicelDashCheckItem[],
  id: string,
  field: 'checked' | 'struck'
): CredicelDashCheckItem[] {
  const next = items.map((item) => (item.id === id ? { ...item, [field]: !item[field] } : item));
  if (field === 'checked') return sortCheckedItemsLast(next);
  return next;
}

export function applyDashSelection(
  items: CredicelDashCheckItem[],
  selectedIds: string[],
  action: 'check' | 'uncheck' | 'strike' | 'unstrike' | 'remove'
): CredicelDashCheckItem[] {
  const selected = new Set(selectedIds);
  if (action === 'remove') return items.filter((item) => !selected.has(item.id));
  return items.map((item) => {
    if (!selected.has(item.id)) return item;
    if (action === 'check') return { ...item, checked: true };
    if (action === 'uncheck') return { ...item, checked: false };
    if (action === 'strike') return { ...item, struck: true };
    return { ...item, struck: false };
  });
}

export function metadataAttachments(attachments: CredicelDashAttachment[]): CredicelDashAttachment[] {
  return attachments.map((att) => ({
    id: att.id,
    title: att.title,
    fileName: att.fileName,
    mimeType: att.mimeType,
    size: att.size,
    storagePath: att.storagePath,
    downloadUrl: att.downloadUrl,
    hasLocal: Boolean(att.hasLocal),
    hasCloudBlob: Boolean(att.hasCloudBlob)
  }));
}

export function dashDocForCloud(doc: CredicelDashDoc): CredicelDashDoc {
  return {
    ...doc,
    title: doc.title.trim(),
    bodyHtml: sanitizeDashHtml(doc.bodyHtml),
    items: doc.items.filter((item) => item.id),
    checklist: Boolean(doc.checklist) || doc.items.some((item) => item.id),
    attachments: metadataAttachments(doc.attachments)
  };
}

export function formatDashFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

let dashDbPromise: Promise<IDBDatabase> | null = null;
let dashDbBroken = false;
const memoryFiles = new Map<string, Blob>();

function openDashDb(): Promise<IDBDatabase> {
  if (dashDbPromise) return dashDbPromise;
  dashDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DASH_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DASH_STORE)) {
        req.result.createObjectStore(DASH_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir el archivo local'));
  });
  return dashDbPromise;
}

export async function putDashFile(id: string, blob: Blob): Promise<void> {
  memoryFiles.set(id, blob);
  if (dashDbBroken) return;
  try {
    const db = await openDashDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DASH_STORE, 'readwrite');
      tx.objectStore(DASH_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    dashDbBroken = true;
  }
}

export async function getDashFile(id: string): Promise<Blob | null> {
  if (memoryFiles.has(id)) return memoryFiles.get(id) || null;
  if (dashDbBroken) return null;
  try {
    const db = await openDashDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DASH_STORE, 'readonly');
      const req = tx.objectStore(DASH_STORE).get(id);
      req.onsuccess = () => {
        const blob = (req.result as Blob | undefined) || null;
        if (blob) memoryFiles.set(id, blob);
        resolve(blob);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    dashDbBroken = true;
    return null;
  }
}

export async function deleteDashFile(id: string): Promise<void> {
  memoryFiles.delete(id);
  if (dashDbBroken) return;
  try {
    const db = await openDashDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DASH_STORE, 'readwrite');
      tx.objectStore(DASH_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    dashDbBroken = true;
  }
}

export function loadCachedDashDocs(): CredicelDashDoc[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DASH_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeDashDoc).filter((row): row is CredicelDashDoc => Boolean(row));
  } catch {
    return [];
  }
}

export function saveCachedDashDocs(docs: CredicelDashDoc[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DASH_CACHE_KEY, JSON.stringify(docs.slice(0, 200).map(dashDocForCloud)));
  } catch {
    // quota / private mode
  }
}

export function loadDashView(): 'grid' | 'list' {
  try {
    return localStorage.getItem(DASH_VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function saveDashView(view: 'grid' | 'list'): void {
  try {
    localStorage.setItem(DASH_VIEW_KEY, view);
  } catch {
    // ignore
  }
}
