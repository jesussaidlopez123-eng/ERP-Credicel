import type { SaleTicket } from '../types';
import { isCancelledSaleTicket } from './imeiInventory';

const DELETED_SALE_IDS_KEY = 'credicel_deleted_sale_ids';

export function loadDeletedSaleIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_SALE_IDS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function persistDeletedSaleIds(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
  localStorage.setItem(DELETED_SALE_IDS_KEY, JSON.stringify(unique.slice(-5000)));
}

export function rememberDeletedSaleIds(existing: Iterable<string>, extra: Iterable<string>): string[] {
  const next = Array.from(
    new Set(
      [...existing, ...extra]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
  persistDeletedSaleIds(next);
  return next;
}

export function excludeDeletedSales(
  tickets: SaleTicket[] | undefined,
  deletedIds: Iterable<string>
): SaleTicket[] {
  const skip = deletedIds instanceof Set ? deletedIds : new Set(
    [...deletedIds].map((id) => String(id || '').trim()).filter(Boolean)
  );
  return (tickets || []).filter((row) => row?.id && !skip.has(row.id) && !isCancelledSaleTicket(row));
}
