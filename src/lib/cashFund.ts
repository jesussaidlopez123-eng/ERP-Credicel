import { normalizeBranchId } from '../data/initialBranches';
import { money } from './ids';

const LOCAL_FUND_PREFIX = 'erp_branch_fund_';

export function parseCashFundAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return money(n);
}

export function lookupBranchFund(
  funds: Record<string, number> | undefined,
  branchId: string
): number | null {
  if (!funds) return null;
  const raw = String(branchId || '');
  const norm = normalizeBranchId(branchId);
  const direct = parseCashFundAmount(funds[raw] ?? funds[norm]);
  if (direct !== null) return direct;
  for (const [key, value] of Object.entries(funds)) {
    if (normalizeBranchId(key) === norm) {
      const parsed = parseCashFundAmount(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

export function readLocalBranchFund(branchId: string): number | null {
  const norm = normalizeBranchId(branchId);
  const keys = Array.from(new Set([`${LOCAL_FUND_PREFIX}${norm}`, `${LOCAL_FUND_PREFIX}${branchId}`]));
  for (const key of keys) {
    try {
      const parsed = parseCashFundAmount(localStorage.getItem(key));
      if (parsed !== null) return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

export function persistLocalBranchFund(branchId: string, amount: number): void {
  const n = parseCashFundAmount(amount) ?? 0;
  const norm = normalizeBranchId(branchId);
  try {
    localStorage.setItem(`${LOCAL_FUND_PREFIX}${norm}`, String(n));
  } catch {
    // ignore
  }
}

/** Fondo de apertura: lo que dejó el cajero. Nunca inventar $1000. */
export function openingFundForBranch(branchId: string, funds: Record<string, number> = {}): number {
  const fromMap = lookupBranchFund(funds, branchId);
  const local = readLocalBranchFund(branchId);
  if (fromMap !== null && fromMap > 0) return fromMap;
  if (local !== null && local > 0) return local;
  return fromMap ?? local ?? 0;
}

export function leftoverFromLatestCorte(
  cortes: Array<{
    branchId?: string;
    timestamp?: string;
    cashFundLeftForNextShift?: unknown;
    reverted?: boolean;
  }>,
  branchId: string
): number | null {
  const norm = normalizeBranchId(branchId);
  let latestTs = '';
  let latest: number | null = null;
  for (const corte of cortes) {
    if (!corte || corte.reverted) continue;
    if (normalizeBranchId(corte.branchId) !== norm) continue;
    const leftover = parseCashFundAmount(corte.cashFundLeftForNextShift);
    if (leftover === null) continue;
    const ts = String(corte.timestamp || '');
    if (!latestTs || ts >= latestTs) {
      latestTs = ts;
      latest = leftover;
    }
  }
  return latest;
}

/**
 * Fondo con el que abre el turno: sesión abierta, nube, local o último corte.
 * Si la sesión nació en 0 por un desfase, se usa el fondo guardado.
 */
export function resolveOpeningCashFund(params: {
  branchId: string;
  funds?: Record<string, number>;
  sessionInitial?: unknown;
  cortes?: Array<{
    branchId?: string;
    timestamp?: string;
    cashFundLeftForNextShift?: unknown;
    reverted?: boolean;
  }>;
}): number {
  const fromSession = parseCashFundAmount(params.sessionInitial);
  if (fromSession !== null && fromSession > 0) return fromSession;
  const stored = openingFundForBranch(params.branchId, params.funds || {});
  if (stored > 0) return stored;
  const fromCorte = leftoverFromLatestCorte(params.cortes || [], params.branchId);
  if (fromCorte !== null && fromCorte > 0) return fromCorte;
  return fromSession ?? stored ?? fromCorte ?? 0;
}

export function mapBranchFundsSnapshot(
  docs: Array<{ id: string; data?: Record<string, unknown> | null }>
): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const entry of docs) {
    const amount = parseCashFundAmount(entry.data?.fundAmount);
    if (amount === null) continue;
    const rawId = String(entry.data?.branchId || entry.id || '');
    const norm = normalizeBranchId(rawId || entry.id);
    funds[norm] = amount;
    if (entry.id) funds[entry.id] = amount;
    if (rawId && rawId !== norm) funds[rawId] = amount;
  }
  return funds;
}

/** Por omisión se deja el mismo fondo con el que abrió, sin vaciar la caja a $0. */
export function suggestedLeftoverFund(openingFund: number, countedCash?: number): number {
  const open = parseCashFundAmount(openingFund) ?? 0;
  const counted = parseCashFundAmount(countedCash);
  if (counted !== null) return money(Math.min(open, counted));
  return open;
}

export function expectedCashWithFund(openingFund: number, cashSales: number, cashOut: number): number {
  return money((parseCashFundAmount(openingFund) ?? 0) + (Number(cashSales) || 0) - (Number(cashOut) || 0));
}
