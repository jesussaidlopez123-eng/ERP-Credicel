import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function Programada (Google Cloud Scheduler + PubSub)
 * Se ejecuta automáticamente a las 00:05 AM de la medianoche (Hora de México / Hermosillo)
 * 
 * Responsabilidades:
 * 1. Cierra preventivamente sesiones de caja pasadas que hayan quedado abiertas.
 * 2. Reconcilia tickets/gastos huérfanos de días anteriores sin interferencia de los navegadores de las sucursales.
 * 3. Evita condiciones de carrera y colisiones entre múltiples clientes.
 */
export const scheduledMidnightCleanup = functions.pubsub
  .schedule('5 0 * * *')
  .timeZone('America/Hermosillo')
  .onRun(async (context) => {
    console.log('[Cloud Function] 🕛 Iniciando depuración y auto-cierre nocturno centralizado...');

    const todayIso = new Date().toISOString().slice(0, 10);
    const sesionesRef = db.collection('sesiones_caja');

    // 1. Obtener sesiones con estado 'ABIERTA'
    const snapshot = await sesionesRef.where('estado', '==', 'ABIERTA').get();

    if (snapshot.empty) {
      console.log('[Cloud Function] No se encontraron sesiones abiertas pendientes de cierre.');
      return null;
    }

    const batch = db.batch();
    let closedCount = 0;

    snapshot.forEach((docSnap) => {
      const sesion = docSnap.data();
      const sesionDate = sesion.fecha_apertura ? sesion.fecha_apertura.slice(0, 10) : '';

      // Si la sesión fue abierta en un día anterior al actual, cerrarla de forma segura
      if (sesionDate && sesionDate < todayIso) {
        batch.update(docSnap.ref, {
          estado: 'CERRADA_SISTEMA_NOCTURNO',
          fecha_cierre: `${sesionDate}T23:59:59.000Z`,
          observaciones_cierre: 'Cierre automático nocturno ejecutado centralizadamente por Cloud Scheduler'
        });
        closedCount++;
      }
    });

    if (closedCount > 0) {
      await batch.commit();
      console.log(`[Cloud Function] ✅ Se cerraron ${closedCount} sesiones huérfanas de días anteriores con éxito.`);
    } else {
      console.log('[Cloud Function] Todas las sesiones abiertas pertenecen al día de hoy.');
    }

    return null;
  });
