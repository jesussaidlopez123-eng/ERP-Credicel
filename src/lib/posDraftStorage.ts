import { CartItem } from '../types';

const PREFIX = 'erp_pos_draft_v1';

interface PosDraft {
  sessionId: string;
  branchId: string;
  operatorId: string;
  cart: CartItem[];
  savedAt: string;
}

function storageKey(branchId: string, operatorId: string): string {
  return `${PREFIX}_${branchId}_${operatorId}`;
}

export function loadPosDraft(
  branchId: string,
  operatorId: string,
  sessionId: string
): CartItem[] {
  if (!branchId || !operatorId || !sessionId) return [];
  try {
    const raw = localStorage.getItem(storageKey(branchId, operatorId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PosDraft;
    if (!parsed || !Array.isArray(parsed.cart)) return [];
    if (parsed.sessionId !== sessionId || parsed.branchId !== branchId) {
      localStorage.removeItem(storageKey(branchId, operatorId));
      return [];
    }
    return parsed.cart;
  } catch {
    return [];
  }
}

export function savePosDraft(
  branchId: string,
  operatorId: string,
  sessionId: string,
  cart: CartItem[]
): void {
  if (!branchId || !operatorId || !sessionId) return;
  try {
    if (!cart.length) {
      localStorage.removeItem(storageKey(branchId, operatorId));
      return;
    }
    const draft: PosDraft = {
      sessionId,
      branchId,
      operatorId,
      cart,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(storageKey(branchId, operatorId), JSON.stringify(draft));
  } catch {
    // quota / private mode
  }
}

export function clearPosDraft(branchId: string, operatorId: string): void {
  try {
    localStorage.removeItem(storageKey(branchId, operatorId));
  } catch {
    // ignore
  }
}
