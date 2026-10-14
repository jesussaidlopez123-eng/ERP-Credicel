import { parseDelimitedText } from './xlsxRead';
import { repairPricesFromRows } from './repairPriceCatalog';
import type { RepairPriceItem } from '../types';
import {
  googleSheetGvizUrl,
  looksLikeGoogleLoginHtml,
  parseGoogleSheetsUrl,
  SHEET_PRIVATE_ERROR,
  type GoogleSheetRef
} from './googleSheetsUrls';

export {
  DEFAULT_REPAIR_PRICE_SHEET_URL,
  googleSheetCsvExportUrl,
  googleSheetGvizUrl,
  looksLikeGoogleLoginHtml,
  parseGoogleSheetsUrl,
  SHEET_PRIVATE_ERROR
} from './googleSheetsUrls';
export type { GoogleSheetRef } from './googleSheetsUrls';

export function parseGvizText(text: string): unknown {
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('Google no devolvió la tabla de precios.');
  if (looksLikeGoogleLoginHtml(trimmed)) throw new Error(SHEET_PRIVATE_ERROR);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Google no devolvió la tabla de precios.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

type GvizCol = { id?: string; label?: string };
type GvizCell = { v?: unknown; f?: string } | null;
type GvizPayload = {
  status?: string;
  errors?: Array<{ reason?: string; message?: string }>;
  table?: { cols?: GvizCol[]; rows?: Array<{ c?: GvizCell[] }> };
};

export function gvizTableToRows(payload: unknown): string[][] {
  const data = (payload || {}) as GvizPayload;
  if (String(data.status || '').toLowerCase() === 'error') {
    const reason = String(data.errors?.[0]?.reason || '').toLowerCase();
    if (reason === 'access_denied' || reason === 'not_found' || reason === 'permission_denied') {
      throw new Error(SHEET_PRIVATE_ERROR);
    }
    throw new Error(data.errors?.[0]?.message || 'No se pudo leer la hoja de Google.');
  }
  const cols = data.table?.cols || [];
  const header = cols.map((col) => String(col.label || col.id || '').trim());
  const body = (data.table?.rows || []).map((row) =>
    (row.c || []).map((cell) => {
      if (!cell) return '';
      if (cell.f != null && String(cell.f) !== '') return String(cell.f);
      if (cell.v == null) return '';
      return String(cell.v);
    })
  );
  const rows = [header, ...body].filter((row) => row.some((cell) => String(cell || '').trim()));
  if (!rows.length) throw new Error('La hoja de Google está vacía.');
  return rows;
}

export function repairPricesFromPastedText(text: string): RepairPriceItem[] {
  const rows = parseDelimitedText(text);
  if (!rows.length) throw new Error('No hay filas pegadas. Copia Modelo y Precio desde Excel o Google Sheets.');
  return repairPricesFromRows(rows);
}

function assertCsvBody(text: string, finalUrl = ''): string {
  if (looksLikeGoogleLoginHtml(text) || /accounts\.google\.com/i.test(finalUrl)) {
    throw new Error(SHEET_PRIVATE_ERROR);
  }
  const rows = parseDelimitedText(text);
  if (!rows.length) throw new Error('La hoja de Google está vacía.');
  return text;
}

async function fetchCsvViaProxy(ref: GoogleSheetRef): Promise<string[][] | null> {
  if (typeof fetch !== 'function') return null;
  const proxy = `/api/google-sheet-csv?id=${encodeURIComponent(ref.id)}&gid=${encodeURIComponent(ref.gid)}`;
  try {
    const res = await fetch(proxy, { redirect: 'follow' });
    if (res.status === 401 || res.status === 403) throw new Error(SHEET_PRIVATE_ERROR);
    if (!res.ok) return null;
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (!contentType.includes('csv') && !contentType.includes('text/plain')) return null;
    return parseDelimitedText(assertCsvBody(text, res.url));
  } catch (err) {
    if (err instanceof Error && err.message === SHEET_PRIVATE_ERROR) throw err;
    return null;
  }
}

function fetchGvizViaJsonp(ref: GoogleSheetRef): Promise<string[][]> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('JSONP solo está disponible en el navegador.'));
  }
  return new Promise((resolve, reject) => {
    const cb = `__gvizRepairPrices_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Google tardó demasiado en responder. Revisa el enlace o pega la tabla.'));
    }, 18000);
    const cleanup = () => {
      window.clearTimeout(timer);
      script.remove();
      try {
        delete (window as unknown as Record<string, unknown>)[cb];
      } catch {
        (window as unknown as Record<string, unknown>)[cb] = undefined;
      }
    };
    (window as unknown as Record<string, unknown>)[cb] = (payload: unknown) => {
      try {
        resolve(gvizTableToRows(payload));
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };
    script.onerror = () => {
      cleanup();
      reject(new Error(SHEET_PRIVATE_ERROR));
    };
    script.src = googleSheetGvizUrl(ref, cb);
    document.body.appendChild(script);
  });
}

async function fetchGvizDirect(ref: GoogleSheetRef): Promise<string[][]> {
  const res = await fetch(googleSheetGvizUrl(ref), { redirect: 'follow' });
  const text = await res.text();
  if (!res.ok || looksLikeGoogleLoginHtml(text) || /accounts\.google\.com/i.test(res.url)) {
    throw new Error(SHEET_PRIVATE_ERROR);
  }
  return gvizTableToRows(parseGvizText(text));
}

export async function repairPricesFromGoogleSheetUrl(url: string): Promise<RepairPriceItem[]> {
  const ref = parseGoogleSheetsUrl(url);
  const fromProxy = await fetchCsvViaProxy(ref);
  if (fromProxy) return repairPricesFromRows(fromProxy);
  if (typeof document !== 'undefined') {
    return repairPricesFromRows(await fetchGvizViaJsonp(ref));
  }
  return repairPricesFromRows(await fetchGvizDirect(ref));
}
