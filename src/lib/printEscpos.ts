import { utf8ToBase64 } from './escpos';
import { isAndroidPrintHost, isRestrictedPrintHost } from './printWindow';

const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';

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
  return `intent:${encodeURIComponent(String(text || ''))}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end`;
}

function openHref(url: string): boolean {
  if (typeof document === 'undefined') return false;
  if (!url || url.length > 70000) return false;
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function openRawBtText(text: string): boolean {
  const body = String(text || '');
  if (!body.trim()) return false;
  if (openHref(buildRawBtTextUrl(body))) return true;
  if (openHref(buildRawBtPlainDataUrl(body))) return true;
  return openHref(buildRawBtIntentUrl(body));
}

export async function printThermalTicket(
  plainText: string,
  imageFallback?: () => void
): Promise<ThermalPrintChannel> {
  if (typeof window === 'undefined') return 'image';

  if (prefersEscPosText() && openRawBtText(plainText)) {
    return 'rawbt';
  }

  imageFallback?.();
  return 'image';
}
