import { ModuleId } from '../types';

export function roleLabel(role?: string): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'manager') return 'Encargado';
  return 'Cajero';
}

export function canOpenModule(role: string | undefined, moduleId: ModuleId): boolean {
  if (role === 'admin') return true;
  if (role === 'manager') {
    return moduleId === 'pos' || moduleId === 'inventory' || moduleId === 'sales' || moduleId === 'repairs';
  }
  return moduleId === 'pos';
}
