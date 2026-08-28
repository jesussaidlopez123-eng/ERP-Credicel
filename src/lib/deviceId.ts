/**
 * Identidad estable del equipo (caja). Sirve para folios únicos sin internet
 * y para saber de qué máquina salió cada registro.
 */

const DEVICE_KEY = 'erp_device_id_v1';
const DEVICE_LABEL_KEY = 'erp_device_label_v1';

function randomId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEV-${time}-${rand}`;
}

export function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && saved.trim()) return saved.trim();
    const fresh = randomId();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return 'DEV-SIN-ALMACEN';
  }
}

/** Tres caracteres estables para meterlos en un folio sin alargarlo. */
export function getDeviceCode(): string {
  const id = getDeviceId();
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  let n = hash;
  for (let i = 0; i < 3; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return out;
}

export function getDeviceLabel(): string {
  try {
    return localStorage.getItem(DEVICE_LABEL_KEY) || `Caja ${getDeviceCode()}`;
  } catch {
    return `Caja ${getDeviceCode()}`;
  }
}

export function setDeviceLabel(label: string): void {
  try {
    localStorage.setItem(DEVICE_LABEL_KEY, label.trim());
  } catch {
    // ignore
  }
}
