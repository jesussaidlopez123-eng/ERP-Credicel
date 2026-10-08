import type { Product } from '../types';

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
