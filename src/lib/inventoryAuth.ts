import type { Operator } from '../types';
import { normalizeRole } from './roles';

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

/** Solo un administrador puede autorizar (p. ej. borrar una venta). */
export function authorizeWithAdminPassword(
  typed: string,
  operators: Operator[] | undefined,
  fallbackAdmin?: Operator | null
): string | null {
  const given = String(typed ?? '').trim();
  if (!given) return 'Escribe la contraseña del administrador.';

  const list = [...(operators || [])];
  if (fallbackAdmin && !list.some((op) => op.id === fallbackAdmin.id)) {
    list.push(fallbackAdmin);
  }

  const admins = list.filter(
    (op) => normalizeRole(op.role) === 'admin' && String(op.password || '').trim()
  );
  if (admins.length === 0) {
    return 'No hay un administrador con contraseña configurada.';
  }
  if (admins.some((op) => String(op.password || '').trim() === given)) return null;
  return 'Contraseña de administrador incorrecta. No se eliminó la venta.';
}
