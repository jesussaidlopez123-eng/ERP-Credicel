/**
 * Blindaje contra el reloj del equipo.
 *
 * Una caja con la fecha mal puesta puede mandar ventas al día equivocado o
 * "viajar al pasado" y romper el orden del corte. Guardamos la marca de tiempo
 * más alta que hemos visto y nunca dejamos que el sistema retroceda.
 */

import { getHermosilloClock } from './shiftHours';

const HIGH_WATER_KEY = 'erp_clock_high_water_v1';
const DRIFT_TOLERANCE_MS = 5 * 60 * 1000;

let cachedHighWater = 0;

function readHighWater(): number {
  if (cachedHighWater > 0) return cachedHighWater;
  try {
    const raw = localStorage.getItem(HIGH_WATER_KEY);
    cachedHighWater = raw ? Number(raw) || 0 : 0;
  } catch {
    cachedHighWater = 0;
  }
  return cachedHighWater;
}

function writeHighWater(ms: number): void {
  cachedHighWater = ms;
  try {
    localStorage.setItem(HIGH_WATER_KEY, String(ms));
  } catch {
    // ignore
  }
}

/** Marca de tiempo confiable: nunca menor que la última que ya usamos. */
export function trustedNow(): Date {
  const deviceMs = Date.now();
  const highWater = readHighWater();
  if (deviceMs > highWater) {
    writeHighWater(deviceMs);
    return new Date(deviceMs);
  }
  if (deviceMs >= highWater - DRIFT_TOLERANCE_MS) {
    return new Date(deviceMs);
  }
  return new Date(highWater);
}

export function trustedIso(): string {
  return trustedNow().toISOString();
}

export function trustedDateKey(): string {
  return getHermosilloClock(trustedNow()).dateKey;
}

/** Cuánto se atrasó el reloj respecto de lo ya registrado. 0 = sano. */
export function clockDriftMs(): number {
  const drift = readHighWater() - Date.now();
  return drift > DRIFT_TOLERANCE_MS ? drift : 0;
}

export function clockLooksWrong(): boolean {
  return clockDriftMs() > 0;
}

/** Registra una marca vista en la nube para que el equipo no retroceda. */
export function observeTrustedIso(iso: string | undefined): void {
  if (!iso) return;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return;
  if (ms > readHighWater()) writeHighWater(ms);
}
