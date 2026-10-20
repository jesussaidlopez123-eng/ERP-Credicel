import { normalizeBranchId } from '../data/initialBranches';
import { addCashDays, listCashDays } from './dateUtils';
import { hermosilloDateKey } from './shiftHours';

/** Ventana ISO para preguntar tickets de un día de caja (Sonora UTC−7). */
export function cashDayQueryBounds(dateKey: string): { start: string; end: string } {
  const next = addCashDays(dateKey, 1);
  return {
    start: `${dateKey}T00:00:00.000Z`,
    end: `${next}T12:00:00.000Z`
  };
}

/** Ventana ISO de varios días de caja (el último día usa el mismo margen que un día suelto). */
export function cajaRangeQueryBounds(fromKey: string, toKey: string): { start: string; end: string } {
  const days = listCashDays(fromKey, toKey);
  if (days.length === 0) return cashDayQueryBounds(fromKey || toKey);
  return {
    start: cashDayQueryBounds(days[0]).start,
    end: cashDayQueryBounds(days[days.length - 1]).end
  };
}

export type ShiftDoc = {
  branchId?: string;
  sucursal_id?: string;
  timestamp?: string;
  date?: string;
  sesion_caja_id?: string;
  corteXId?: string;
  estado?: string;
};

/**
 * Ticket o gasto del turno abierto: misma sucursal y día, sin corte de otro turno.
 * Si nació sin sesion_caja_id (nube caída), igual entra al cierre de hoy.
 */
export function docBelongsToOpenShift(
  row: ShiftDoc,
  session: { id: string; branchId: string; dateKey: string }
): boolean {
  if (!row || String(row.estado || '').toUpperCase() === 'CANCELADA') return false;
  const branch = normalizeBranchId(row.branchId || row.sucursal_id || '');
  if (branch !== normalizeBranchId(session.branchId)) return false;
  if (row.corteXId && row.corteXId !== session.id) return false;
  if (row.sesion_caja_id && row.sesion_caja_id !== session.id) return false;
  if (row.sesion_caja_id === session.id) return true;
  const day = hermosilloDateKey(row.timestamp || row.date);
  return !day || day === session.dateKey;
}
