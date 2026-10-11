import type { SaleTicket } from '../types';

export const HUA_OPEN_SESSION_20261011 = 'SES-HUA-20261011-MV42E656';
export const FALSE_MTZ_SESSION_20261011 = 'SES-MTZ-20261011-MV40TO74';
export const MISPLACED_GERALDIN_TICKET_IDS_20261011 = [
  'TCK-MV41I6SP-0G9CWI',
  'TCK-MV41XDD0-2MMFLJ',
  'TCK-MV42CSLB-P9KFWO'
] as const;

/** Pasa un ticket al turno abierto de otra sucursal y lo saca del corte equivocado. */
export function retargetOpenShiftTicket(
  ticket: SaleTicket,
  dest: { branchId: string; sessionId: string }
): SaleTicket {
  const items = (ticket.items || []).map((item) => ({
    ...item,
    metadata: {
      ...(item.metadata || {}),
      stockBranchId: dest.branchId
    }
  }));
  const next: SaleTicket = {
    ...ticket,
    branchId: dest.branchId,
    sucursal_id: dest.branchId,
    sesion_caja_id: dest.sessionId,
    items
  };
  delete next.corteXId;
  delete next.corteXClosedAt;
  return next;
}

export function ticketNeedsHuatabampoRetarget(ticket: Pick<SaleTicket, 'id' | 'branchId' | 'sesion_caja_id'>): boolean {
  if (!MISPLACED_GERALDIN_TICKET_IDS_20261011.includes(ticket.id as (typeof MISPLACED_GERALDIN_TICKET_IDS_20261011)[number])) {
    return false;
  }
  return ticket.branchId !== 'b-huatabampo' || ticket.sesion_caja_id !== HUA_OPEN_SESSION_20261011;
}
