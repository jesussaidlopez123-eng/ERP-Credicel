import type { Operator } from '../types';

/** Contraseña de autorización: la misma del operador que está en sesión. */
export function authorizeWithOperatorPassword(
  typed: string,
  operator: Operator | null | undefined
): string | null {
  const given = String(typed ?? '').trim();
  const expected = String(operator?.password ?? '').trim();
  if (!given) return 'Por favor ingresa la contraseña para autorizar la operación.';
  if (!expected) return 'Tu usuario no tiene contraseña configurada. Pide al administrador que la asigne.';
  if (given !== expected) return 'Contraseña incorrecta. No se aplicó ningún cambio.';
  return null;
}
