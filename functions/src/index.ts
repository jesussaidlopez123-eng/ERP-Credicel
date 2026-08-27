import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

admin.initializeApp();

const NAMED_DB = 'ai-studio-erpposmultisucur-e55719b2-0519-4116-8707-50042acb7fc7';

function resolveDb(): FirebaseFirestore.Firestore {
  try {
    return getFirestore(admin.app(), NAMED_DB);
  } catch {
    return admin.firestore();
  }
}

function hermosilloDateKey(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Hermosillo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(iso));
    const g = (t: string) => parts.find((p) => p.type === t)?.value || '0';
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch {
    return '';
  }
}

function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 23:05 hora Sonora. Cierra turnos ABIERTA con corte real (tickets marcados).
 * No usa CERRADA_SISTEMA_NOCTURNO: eso dejaba ventas sin corte.
 */
export const scheduledMidnightCleanup = functions.pubsub
  .schedule('5 23 * * *')
  .timeZone('America/Hermosillo')
  .onRun(async () => {
    const db = resolveDb();

    const snapshot = await db.collection('sesiones_caja').where('estado', '==', 'ABIERTA').get();
    if (snapshot.empty) {
      console.log('[Cloud Function] No hay sesiones ABIERTA.');
      return null;
    }

    const closeIsoNow = new Date().toISOString();

    for (const docSnap of snapshot.docs) {
      const sesion = docSnap.data();
      const branchId = String(sesion.sucursal_id || '');
      if (!branchId || branchId === 'b-bodega') continue;

      const openKey = hermosilloDateKey(sesion.fecha_apertura || '');
      const fechaCierre = openKey ? `${openKey}T23:00:00-07:00` : closeIsoNow;
      const dateStr = openKey
        ? `${openKey.slice(8, 10)}/${openKey.slice(5, 7)}/${openKey.slice(0, 4)}`
        : '';

      const salesSnap = await db.collection('sales').where('sesion_caja_id', '==', docSnap.id).get();
      const tickets = salesSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((t) => !t.corteXId || t.corteXId === docSnap.id);

      const expSnap = await db.collection('expenses').where('sesion_caja_id', '==', docSnap.id).get();
      const expenses = expSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((e) => !e.corteXId || e.corteXId === docSnap.id);

      const cashSales = money(
        tickets
          .filter((t) => String(t.paymentMethod || '') === 'Efectivo')
          .reduce((s, t) => s + Number(t.total || 0), 0)
      );
      const cardSales = money(
        tickets
          .filter((t) => String(t.paymentMethod || '') === 'Tarjeta')
          .reduce((s, t) => s + Number(t.total || 0), 0)
      );
      const transferSales = money(
        tickets
          .filter((t) => String(t.paymentMethod || '') === 'Transferencia')
          .reduce((s, t) => s + Number(t.total || 0), 0)
      );
      const totalSales = money(cashSales + cardSales + transferSales);
      const totalExpenses = money(expenses.reduce((s, e) => s + Number(e.amount || 0), 0));
      const initialFund = money(Number(sesion.monto_inicial_efectivo || 0));
      const expected = money(initialFund + cashSales - totalExpenses);

      const batch = db.batch();
      batch.set(
        docSnap.ref,
        {
          estado: 'CERRADA',
          fecha_cierre: fechaCierre,
          operador_cierre: { uid: 'sistema-23', nombre: 'Cierre automático 23:00' },
          totales_calculados: {
            ventas_total: totalSales,
            ventas_efectivo: cashSales,
            ventas_tarjeta: cardSales,
            ventas_transferencia: transferSales,
            gastos_efectivo: totalExpenses,
            efectivo_esperado_cajon: expected,
            conteo_transacciones: { tickets_venta: tickets.length, gastos: expenses.length }
          },
          arqueo_cierre: {
            efectivo_contado_declarado: expected,
            diferencia_sobrante_faltante: 0,
            fondo_dejado_siguiente_turno: initialFund,
            efectivo_retirado_entregar: money(Math.max(0, expected - initialFund)),
            notas_observaciones:
              'Cierre automático 23:00 (hora Sonora). Efectivo contado = esperado porque no hubo arqueo en mostrador.'
          },
          auditoria: { version: 'v3.1-cierre-23' }
        },
        { merge: true }
      );

      batch.set(db.collection('corteXRecords').doc(docSnap.id), {
        id: docSnap.id,
        timestamp: fechaCierre,
        dateStr,
        timeStr: '11:00 p.m.',
        branchId,
        sucursal_id: branchId,
        sesion_caja_id: docSnap.id,
        branchName: sesion.sucursal_nombre || branchId,
        operatorName: 'Cierre automático 23:00',
        initialCashFund: initialFund,
        cashFundLeftForNextShift: initialFund,
        cashWithdrawn: money(Math.max(0, expected - initialFund)),
        closingNotes:
          'Cierre automático 23:00 (hora Sonora). Efectivo contado = esperado porque no hubo arqueo en mostrador.',
        cashSales,
        cardSales,
        transferSales,
        totalSales,
        totalExpenses,
        netIncome: money(totalSales - totalExpenses),
        expectedCashInDrawer: expected,
        countedCash: expected,
        cashDifference: 0,
        ticketIds: tickets.map((t) => t.id),
        expenseIds: expenses.map((e) => e.id)
      });

      batch.set(
        db.collection('branchOpenSessions').doc(branchId),
        { branchId, openSessionId: null, fundAmount: initialFund, updatedAt: fechaCierre },
        { merge: true }
      );

      const stamp = {
        sesion_caja_id: docSnap.id,
        corteXId: docSnap.id,
        corteXClosedAt: fechaCierre,
        sucursal_id: branchId
      };
      tickets.forEach((t) => {
        batch.set(db.collection('sales').doc(t.id), stamp, { merge: true });
        batch.set(db.collection('ventas').doc(t.id), stamp, { merge: true });
      });
      expenses.forEach((e) => {
        batch.set(db.collection('expenses').doc(e.id), stamp, { merge: true });
        batch.set(db.collection('gastos').doc(e.id), stamp, { merge: true });
      });

      await batch.commit();
      console.log(`[Cloud Function] Corte automático ${docSnap.id} (${tickets.length} tickets)`);
    }

    return null;
  });
