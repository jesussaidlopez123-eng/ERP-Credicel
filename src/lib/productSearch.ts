import type { Product } from '../types';
import { imeiDigits } from './imeiInventory';

export function normalizeProductQuery(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function productSearchHaystack(product: Pick<Product, 'code' | 'name'>): string {
  return normalizeProductQuery(`${product.code || ''} ${product.name || ''}`);
}

export function productMatchesQuery(product: Pick<Product, 'code' | 'name'>, query: string): boolean {
  const q = normalizeProductQuery(query);
  if (!q) return true;
  const hay = productSearchHaystack(product);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function filterProductsByQuery<T extends Pick<Product, 'code' | 'name'>>(products: T[], query: string): T[] {
  return (products || []).filter((product) => productMatchesQuery(product, query));
}

export function productPickLabel(product: Pick<Product, 'code' | 'name'>): string {
  const code = String(product.code || '').trim();
  const name = String(product.name || '').trim();
  if (code && name) return `[${code}] ${name}`;
  return name || code || '';
}

export function normalizeScanCode(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

/** Código de barras de la caja (UPC/EAN), no el IMEI del celular. */
export function findProductByScanCode<T extends Pick<Product, 'id' | 'code'>>(
  products: T[],
  raw: string
): T | undefined {
  const scan = normalizeScanCode(raw);
  if (!scan) return undefined;
  const exact = (products || []).find(
    (product) => normalizeScanCode(product.code || '') === scan || normalizeScanCode(product.id || '') === scan
  );
  if (exact) return exact;
  const scanDigits = imeiDigits(scan);
  if (scanDigits.length < 8) return undefined;
  const byDigits = (products || []).find((product) => imeiDigits(product.code || '') === scanDigits);
  if (byDigits) return byDigits;
  if (scanDigits.length >= 11) {
    const stripped = scanDigits.replace(/^0+/, '');
    return (products || []).find((product) => {
      const codeDigits = imeiDigits(product.code || '').replace(/^0+/, '');
      return codeDigits.length >= 11 && codeDigits === stripped;
    });
  }
  return undefined;
}
