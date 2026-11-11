import { bytesToBase64, utf8ToBase64 } from './escpos';
import { isAndroidPrintHost, isRestrictedPrintHost } from './printWindow';

const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';
const INTENT_TAIL = `#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;

export type ThermalPrintChannel = 'rawbt' | 'image';

export function prefersEscPosText(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0
): boolean {
  return isAndroidPrintHost(ua) && isRestrictedPrintHost(ua, maxTouchPoints);
}

export function buildRawBtTextUrl(text: string): string {
  return `rawbt:${encodeURIComponent(String(text || ''))}`;
}

export function buildRawBtPlainDataUrl(text: string): string {
  return `rawbt:data:text/plain;base64,${utf8ToBase64(String(text || ''))}`;
}

export function buildRawBtIntentUrl(text: string): string {
  return `intent:${encodeURIComponent(String(text || ''))}${INTENT_TAIL}`;
}

/** RawBT recibe bytes ESC/POS; no rasteriza una hoja en blanco. */
export function buildRawBtEscPosUrl(bytes: Uint8Array): string {
  return `rawbt:base64,${bytesToBase64(bytes)}`;
}

export function buildRawBtEscPosDataUrl(bytes: Uint8Array): string {
  return `rawbt:data:application/vnd.escpos;base64,${bytesToBase64(bytes)}`;
}

/** Chrome en tablet no abre rawbt: solo; hay que usar el esquema intent. */
export function buildRawBtEscPosIntentUrl(bytes: Uint8Array): string {
  return `intent:base64,${bytesToBase64(bytes)}${INTENT_TAIL}`;
}

function launchRawBtUrl(url: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!url || url.length > 500000) return false;
  try {
    if (url.startsWith('intent:') || url.startsWith('rawbt:')) {
      window.location.href = url;
      return true;
    }
  } catch {
    /* sigue con <a> */
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_self';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function openRawBtEscPos(bytes: Uint8Array): boolean {
  if (!bytes?.length) return false;
  const intent = buildRawBtEscPosIntentUrl(bytes);
  if (intent.length <= 180000 && launchRawBtUrl(intent)) return true;
  if (launchRawBtUrl(buildRawBtEscPosUrl(bytes))) return true;
  return launchRawBtUrl(buildRawBtEscPosDataUrl(bytes));
}

export function openRawBtText(text: string): boolean {
  const body = String(text || '');
  if (!body.trim()) return false;
  if (launchRawBtUrl(buildRawBtIntentUrl(body))) return true;
  if (launchRawBtUrl(buildRawBtTextUrl(body))) return true;
  return launchRawBtUrl(buildRawBtPlainDataUrl(body));
}

export async function printThermalTicket(
  plainText: string,
  imageFallback?: () => void,
  escPos?: Uint8Array
): Promise<ThermalPrintChannel> {
  if (typeof window === 'undefined') return 'image';

  if (prefersEscPosText()) {
    if (escPos && escPos.length && openRawBtEscPos(escPos)) return 'rawbt';
    if (openRawBtText(plainText)) return 'rawbt';
  }

  imageFallback?.();
  return 'image';
}
