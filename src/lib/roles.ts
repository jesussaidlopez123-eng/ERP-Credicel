import { ModuleId } from '../types';

export type AppRole = 'admin' | 'manager' | 'cashier';

export function normalizeRole(role?: string): AppRole {
  const value = String(role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (value === 'admin' || value.includes('admin')) return 'admin';
  if (value === 'manager' || value.includes('encargado') || value.includes('gerente')) return 'manager';
  return 'cashier';
}

export function roleLabel(role?: string): string {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return 'Administrador';
  if (normalized === 'manager') return 'Encargado';
  return 'Cajero';
}

const MANAGER_MODULES: ModuleId[] = ['pos', 'inventory', 'sales'];
const ADMIN_ONLY_MODULES: ModuleId[] = ['repairs', 'purchases', 'executive', 'settings'];

export function canOpenModule(role: string | undefined, moduleId: ModuleId): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return true;
  if (ADMIN_ONLY_MODULES.includes(moduleId)) return false;
  if (normalized === 'manager') return MANAGER_MODULES.includes(moduleId);
  return moduleId === 'pos';
}

export function defaultModuleForRole(role?: string): ModuleId {
  return normalizeRole(role) === 'admin' ? 'sales' : 'pos';
}
