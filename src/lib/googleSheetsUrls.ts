export type GoogleSheetRef = { id: string; gid: string };

export const DEFAULT_REPAIR_PRICE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1xaIQBbZNFCaFBXCRPJoHF8sTj7HfE9NfwMKXWFYdqYQ/edit?gid=1066474966#gid=1066474966';

export const SHEET_PRIVATE_ERROR =
  'Google pide inicio de sesión: esa hoja está privada. En Google Sheets: Compartir → Acceso general → Cualquiera con el enlace (Lector). Si no quieres abrirla, copia las filas (Modelo y Precio) y pégalas en Pegar tabla.';

export function parseGoogleSheetsUrl(raw: string): GoogleSheetRef {
  const s = String(raw || '').trim();
  if (!s) throw new Error('Pega el enlace de Google Sheets.');
  const idMatch = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const bareId = /^[a-zA-Z0-9-_]{30,}$/.test(s) ? s : '';
  const id = idMatch?.[1] || bareId;
  if (!id) throw new Error('El enlace de Google Sheets no es válido.');
  const gidMatch = s.match(/[?&#]gid=([0-9]+)/);
  return { id, gid: gidMatch?.[1] || '0' };
}

export function googleSheetCsvExportUrl(ref: GoogleSheetRef): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(ref.id)}/export?format=csv&gid=${encodeURIComponent(ref.gid)}`;
}

export function googleSheetGvizUrl(ref: GoogleSheetRef, responseHandler = ''): string {
  const tqx = responseHandler
    ? `out:json;responseHandler:${encodeURIComponent(responseHandler)}`
    : 'out:json';
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(ref.id)}/gviz/tq?tqx=${tqx}&gid=${encodeURIComponent(ref.gid)}`;
}

export function looksLikeGoogleLoginHtml(text: string): boolean {
  const t = String(text || '').slice(0, 2500).toLowerCase();
  return (
    t.includes('<!doctype html') ||
    t.includes('<html') ||
    t.includes('servicelogin') ||
    t.includes('accounts.google.com') ||
    t.includes('sign in')
  );
}
