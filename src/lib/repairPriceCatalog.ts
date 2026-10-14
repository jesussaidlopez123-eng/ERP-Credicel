import type { RepairPriceItem } from '../types';
import { money, newUniqueId } from './ids';
import { downloadXlsx } from './xlsxMinimal';
import { parseSpreadsheetTable } from './xlsxRead';

const PRICE_HEADERS = new Set([
  'precio',
  'price',
  'costo',
  'pvp',
  'importe',
  'tarifa',
  'venta',
  'publico',
  'preciopantalla',
  'preciolcd',
  'preciooled',
  'precioventa',
  'precioventax27',
  'preciodeventa',
  'lcd',
  'oled',
  'original',
  'generica'
]);
const MODEL_HEADERS = new Set([
  'modelo',
  'model',
  'equipo',
  'celular',
  'pantalla',
  'dispositivo',
  'referencia',
  'nombre',
  'producto'
]);
const BRAND_HEADERS = new Set(['marca', 'brand']);
const SERVICE_HEADERS = new Set([
  'servicio',
  'service',
  'descripcion',
  'descripción',
  'falla',
  'trabajo',
  'detalle'
]);
const CATEGORY_HEADERS = new Set(['categoria', 'categoría', 'category', 'tipo']);

export function normalizeRepairPriceQuery(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function repairPriceHaystack(item: Pick<RepairPriceItem, 'brand' | 'model' | 'serviceName' | 'notes'>): string {
  return normalizeRepairPriceQuery(`${item.brand || ''} ${item.model || ''} ${item.serviceName || ''} ${item.notes || ''}`);
}

export function repairPriceFingerprint(
  item: Pick<RepairPriceItem, 'brand' | 'model' | 'serviceName'>
): string {
  return normalizeRepairPriceQuery(`${item.brand || ''} ${item.model || ''} ${item.serviceName || ''}`);
}

export function stableRepairPriceId(fp: string): string {
  const key = String(fp || '').trim() || 'item';
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56);
  return `pant-${(hash >>> 0).toString(36)}-${slug}`.slice(0, 120);
}

export function parseRepairPriceAmount(raw: unknown): number | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/[$\s]/g, '').replace(/mxn/gi, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return money(n);
}

export function inferRepairBrand(model: string, brand = ''): string {
  const given = String(brand || '').trim();
  if (given) return given;
  const hay = ` ${normalizeRepairPriceQuery(model)} `;
  if (hay.includes(' iphone ') || hay.includes(' ipad ') || hay.includes(' apple ')) return 'Apple';
  if (hay.includes(' samsung ') || hay.includes(' galaxy ') || / sam [a-z0-9]/.test(hay) || hay.includes(' sam note ') || hay.includes(' sam s')) {
    return 'Samsung';
  }
  if (hay.includes(' motorola ') || hay.includes(' moto ')) return 'Motorola';
  if (
    hay.includes(' xiaomi ') ||
    hay.includes(' xiao ') ||
    hay.includes(' redmi ') ||
    hay.includes(' poco ')
  ) {
    return 'Xiaomi';
  }
  if (hay.includes(' honor ')) return 'Honor';
  if (hay.includes(' huawei ')) return 'Huawei';
  if (hay.includes(' google ') || hay.includes(' pixel ')) return 'Google';
  if (hay.includes(' cubot ')) return 'Cubot';
  if (hay.includes(' hisense ')) return 'Hisense';
  if (hay.includes(' oneplus ') || hay.includes(' one plus ')) return 'OnePlus';
  if (hay.includes(' oppo ')) return 'Oppo';
  if (hay.includes(' realme ')) return 'Realme';
  if (hay.includes(' vivo ')) return 'Vivo';
  if (hay.includes(' nokia ')) return 'Nokia';
  if (hay.includes(' zte ') || hay.includes(' nubia ') || hay.includes(' axon ') || hay.includes(' vsmart ')) {
    return 'ZTE';
  }
  if (hay.includes(' lg ')) return 'LG';
  if (hay.includes(' blue ')) return 'Blue';
  return 'Multimarca';
}

export function inferRepairCategory(service: string, category = ''): RepairPriceItem['category'] {
  const given = String(category || '').trim();
  if (given) return given;
  const hay = normalizeRepairPriceQuery(service);
  if (hay.includes('bateria') || hay.includes('battery')) return 'Batería';
  if (hay.includes('carga') || hay.includes('pin') || hay.includes('flex') || hay.includes('tipo c')) {
    return 'Centro de Carga';
  }
  if (hay.includes('desbloqueo') || hay.includes('frp') || hay.includes('bypass')) return 'Desbloqueo';
  if (hay.includes('pantalla') || hay.includes('display') || hay.includes('oled') || hay.includes('lcd')) {
    return 'Pantalla';
  }
  return 'Pantalla';
}

function headerKey(cell: string): string {
  return normalizeRepairPriceQuery(cell).replace(/\s+/g, '');
}

function mapHeaders(row: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  row.forEach((cell, idx) => {
    const key = headerKey(cell);
    if (BRAND_HEADERS.has(key)) map.brand = idx;
    else if (MODEL_HEADERS.has(key)) map.model = idx;
    else if (SERVICE_HEADERS.has(key)) map.service = idx;
    else if (CATEGORY_HEADERS.has(key)) map.category = idx;
    else if (PRICE_HEADERS.has(key) || key.startsWith('precioventa') || (key.startsWith('precio') && key.includes('venta'))) {
      map.price = idx;
    }
  });
  return map;
}

function pickHeaderRow(rows: string[][]): { index: number; map: Record<string, number>; score: number } {
  let best = { index: 0, map: mapHeaders(rows[0] || []), score: 0 };
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const map = mapHeaders(rows[i] || []);
    const score =
      (map.model !== undefined ? 2 : 0) +
      (map.price !== undefined ? 2 : 0) +
      (map.brand !== undefined ? 1 : 0) +
      (map.service !== undefined ? 1 : 0) +
      (map.category !== undefined ? 1 : 0);
    if (score > best.score) best = { index: i, map, score };
  }
  return best;
}

export function repairPricesFromTable(rows: string[][]): RepairPriceItem[] {
  if (!rows.length) return [];
  const picked = pickHeaderRow(rows);
  const headerMap = picked.map;
  const hasHeader = picked.score > 0;
  const start = hasHeader ? picked.index + 1 : 0;
  const modelIdx = headerMap.model ?? 0;
  const priceIdx = headerMap.price ?? (hasHeader ? modelIdx + 1 : 1);
  const brandIdx = headerMap.brand;
  const serviceIdx = headerMap.service;
  const categoryIdx = headerMap.category;
  const seen = new Map<string, RepairPriceItem>();

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] || [];
    const model = String(row[modelIdx] || '').trim();
    const price = parseRepairPriceAmount(row[priceIdx]);
    if (!model || price === null) continue;
    const brand = inferRepairBrand(model, brandIdx !== undefined ? String(row[brandIdx] || '') : '');
    const service =
      serviceIdx !== undefined && String(row[serviceIdx] || '').trim()
        ? String(row[serviceIdx]).trim()
        : 'Cambio de pantalla';
    const category = inferRepairCategory(
      service,
      categoryIdx !== undefined ? String(row[categoryIdx] || '') : ''
    );
    const item: RepairPriceItem = {
      id: '',
      brand,
      model,
      serviceName: service,
      category,
      price
    };
    let fp = repairPriceFingerprint(item);
    if (!fp) continue;
    const prev = seen.get(fp);
    if (prev && prev.price !== price) {
      item.serviceName = `${item.serviceName} · $${price.toFixed(2)}`;
      fp = repairPriceFingerprint(item);
    } else if (prev) {
      seen.set(fp, { ...item, id: prev.id });
      continue;
    }
    seen.set(fp, {
      ...item,
      id: stableRepairPriceId(fp)
    });
  }
  return [...seen.values()];
}

export function mergeRepairPriceCatalog(
  existing: RepairPriceItem[],
  incoming: RepairPriceItem[]
): { next: RepairPriceItem[]; added: number; updated: number } {
  const byFp = new Map<string, RepairPriceItem>();
  for (const item of existing || []) {
    byFp.set(repairPriceFingerprint(item) || item.id, item);
  }
  let added = 0;
  let updated = 0;
  for (const item of incoming || []) {
    const fp = repairPriceFingerprint(item);
    if (!fp) continue;
    const prev = byFp.get(fp);
    if (prev) {
      byFp.set(fp, {
        ...prev,
        ...item,
        id: prev.id,
        price: item.price,
        brand: item.brand || prev.brand,
        model: item.model || prev.model,
        serviceName: item.serviceName || prev.serviceName,
        category: item.category || prev.category
      });
      updated += 1;
    } else {
      byFp.set(fp, { ...item, id: item.id || newUniqueId('rep-price') });
      added += 1;
    }
  }
  return { next: [...byFp.values()], added, updated };
}

export function searchRepairPrices(prices: RepairPriceItem[], query: string, limit = 20): RepairPriceItem[] {
  const q = normalizeRepairPriceQuery(query);
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  if (!tokens.length) return [];
  const ranked = (prices || [])
    .map((item) => {
      const hay = repairPriceHaystack(item);
      if (!tokens.every((token) => hay.includes(token))) return null;
      const model = normalizeRepairPriceQuery(item.model);
      const phrase = hay.includes(q) ? 6 : 0;
      const starts = model.startsWith(q) ? 4 : model.includes(` ${q} `) || model.includes(q) ? 2 : 0;
      const tight = Math.max(0, 8 - Math.abs(model.length - q.length) / 6);
      const pant = String(item.category || '').toLowerCase() === 'pantalla' ? 1 : 0;
      return { item, score: phrase + starts + tight + pant };
    })
    .filter((row): row is { item: RepairPriceItem; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score || a.item.model.localeCompare(b.item.model, 'es'));
  return ranked.slice(0, limit).map((row) => row.item);
}

export function screenModelLabel(model: string): string {
  return String(model || '')
    .replace(/^pantalla\s+/i, '')
    .trim();
}

export function repairPricePickLabel(item: RepairPriceItem): string {
  const brand = String(item.brand || '').trim();
  const model = screenModelLabel(item.model);
  const service = String(item.serviceName || '').trim();
  const who = brand && !model.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${model}` : model;
  if (!service || /^cambio de pantalla/i.test(normalizeRepairPriceQuery(service))) return who;
  return `${who} · ${service}`;
}

export function applyRepairPriceToReception(item: RepairPriceItem): {
  deviceModel: string;
  issueDescription: string;
  totalCost: string;
} {
  const brand = String(item.brand || '').trim();
  const model = screenModelLabel(item.model);
  const deviceModel =
    brand && brand !== 'Multimarca' && !model.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${model}`
      : model;
  const issue = String(item.serviceName || '').trim();
  return {
    deviceModel,
    issueDescription: !issue || /^cambio de pantalla/i.test(normalizeRepairPriceQuery(issue))
      ? `Cambio de pantalla · ${model}`
      : issue,
    totalCost: money(item.price).toFixed(2)
  };
}

export const REPAIR_PRICE_TEMPLATE_HEADERS = ['Marca', 'Modelo', 'Servicio', 'Categoria', 'Precio'];

export function repairPriceTemplateRows(): Array<Array<string | number>> {
  return [
    REPAIR_PRICE_TEMPLATE_HEADERS,
    ['Apple', 'iPhone 11', 'Cambio de pantalla', 'Pantalla', 850],
    ['Samsung', 'Galaxy A54', 'Cambio de pantalla', 'Pantalla', 1450],
    ['Motorola', 'Moto G54', 'Cambio de pantalla', 'Pantalla', 780]
  ];
}

export function downloadRepairPriceTemplate(): void {
  downloadXlsx('precios-pantallas-taller', [
    {
      name: 'Precios',
      rows: repairPriceTemplateRows()
    }
  ]);
}

export function downloadRepairPriceCatalog(prices: RepairPriceItem[]): void {
  downloadXlsx('lista-precios-taller', [
    {
      name: 'Precios',
      rows: [
        REPAIR_PRICE_TEMPLATE_HEADERS,
        ...(prices || []).map((item) => [
          item.brand,
          item.model,
          item.serviceName,
          item.category || 'Pantalla',
          item.price
        ])
      ]
    }
  ]);
}

export async function repairPricesFromSpreadsheet(bytes: Uint8Array, filename = ''): Promise<RepairPriceItem[]> {
  const rows = await parseSpreadsheetTable(bytes, filename);
  return repairPricesFromRows(rows);
}

export function repairPricesFromRows(rows: string[][]): RepairPriceItem[] {
  const items = repairPricesFromTable(rows);
  if (!items.length) {
    throw new Error('No se leyeron precios. Usa columnas Modelo y Precio (Marca y Servicio son opcionales).');
  }
  return items;
}
