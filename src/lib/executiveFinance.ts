import { money } from './ids';
import { normalizeBranchId } from '../data/initialBranches';
import { emptyExecutiveCats, type ExecutiveCatTotals } from './saleClassification';

/** Comisión por celular vendido (contado o crédito). El cobro del equipo no es utilidad. */
export const PHONE_COMMISSION_BY_BRANCH: Record<string, number> = {
  'b-matriz': 1000,
  'b-navojoa': 1000,
  'b-huatabampo': 350
};

export function phoneCommissionRate(branchId?: string): number {
  const id = normalizeBranchId(branchId);
  return PHONE_COMMISSION_BY_BRANCH[id] || 0;
}

export function phoneCommissionAmount(branchId: string | undefined, phonesSold: number): number {
  return money(Math.max(0, phonesSold) * phoneCommissionRate(branchId));
}

/** Accesorios y taller sí son ingreso de Credicel. */
export function executiveOwnIncome(cats: ExecutiveCatTotals): number {
  return money((cats.accesorios || 0) + (cats.reparaciones || 0));
}

/** Abonos, enganches/equipos cobrados y recargas se regresan a otras compañías. */
export function executivePassThrough(cats: ExecutiveCatTotals): number {
  return money((cats.abonos || 0) + (cats.equipos || 0) + (cats.recargas || 0));
}

export type ExecutiveFinanceTotals = {
  ingresosPropios: number;
  comisiones: number;
  dineroPaso: number;
  gastos: number;
  /** Compra de refacciones del taller (inversión, no gasto de caja). */
  inversion: number;
  /** Costo interno del taller en la semana (refacción + mano de obra + otro). */
  tallerCostos: number;
  /** Accesorios + margen de taller. No incluye comisiones: esas no pasan por caja. */
  utilidad: number;
  /** Utilidad de caja menos gastos de caja. Las comisiones no entran. */
  resultado: number;
};

export function emptyExecutiveFinance(): ExecutiveFinanceTotals {
  return {
    ingresosPropios: 0,
    comisiones: 0,
    dineroPaso: 0,
    gastos: 0,
    inversion: 0,
    tallerCostos: 0,
    utilidad: 0,
    resultado: 0
  };
}

export function buildExecutiveFinance(input: {
  branchId: string;
  cats: ExecutiveCatTotals;
  gastos: number;
  phonesSold: number;
  tallerCostos?: number;
  inversion?: number;
}): ExecutiveFinanceTotals {
  const ingresosPropios = executiveOwnIncome(input.cats);
  const comisiones = phoneCommissionAmount(input.branchId, input.phonesSold);
  const dineroPaso = executivePassThrough(input.cats);
  const gastos = money(Math.max(0, input.gastos || 0));
  const tallerCostos = money(Math.max(0, input.tallerCostos || 0));
  const inversion = money(Math.max(0, input.inversion || 0));
  const utilidad = money(ingresosPropios - tallerCostos);
  return {
    ingresosPropios,
    comisiones,
    dineroPaso,
    gastos,
    inversion,
    tallerCostos,
    utilidad,
    resultado: money(utilidad - gastos)
  };
}

export function addExecutiveFinance(
  acc: ExecutiveFinanceTotals,
  next: ExecutiveFinanceTotals
): ExecutiveFinanceTotals {
  return {
    ingresosPropios: money(acc.ingresosPropios + next.ingresosPropios),
    comisiones: money(acc.comisiones + next.comisiones),
    dineroPaso: money(acc.dineroPaso + next.dineroPaso),
    gastos: money(acc.gastos + next.gastos),
    inversion: money(acc.inversion + next.inversion),
    tallerCostos: money(acc.tallerCostos + next.tallerCostos),
    utilidad: money(acc.utilidad + next.utilidad),
    resultado: money(acc.resultado + next.resultado)
  };
}

export function financeFromCats(
  branchId: string,
  cats: ExecutiveCatTotals = emptyExecutiveCats(),
  gastos = 0,
  phonesSold = 0
): ExecutiveFinanceTotals {
  return buildExecutiveFinance({ branchId, cats, gastos, phonesSold });
}
