import { ADMIN_WORKSPACE, ALL_BRANCHES, normalizeBranchId } from '../data/initialBranches';
import { Branch, ModuleId, Operator } from '../types';

export type AppRole = 'admin' | 'manager' | 'cashier';

export const ALL_MODULE_IDS: ModuleId[] = [
  'credicelDashboard',
  'executive',
  'sales',
  'repairs',
  'inventory',
  'purchases',
  'pos',
  'settings'
];

export const MODULE_OPTIONS: { id: ModuleId; label: string }[] = [
  { id: 'credicelDashboard', label: 'Notas' },
  { id: 'executive', label: 'Dirección' },
  { id: 'sales', label: 'Ventas y cortes' },
  { id: 'repairs', label: 'Reparaciones' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'purchases', label: 'Compras' },
  { id: 'pos', label: 'Punto de venta' },
  { id: 'settings', label: 'Usuarios' }
];

const MANAGER_MODULES: ModuleId[] = ['pos', 'inventory', 'sales', 'repairs', 'credicelDashboard'];
const ADMIN_ONLY_MODULES: ModuleId[] = ['purchases', 'executive', 'settings'];

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

export function moduleLabel(moduleId: ModuleId): string {
  return MODULE_OPTIONS.find((item) => item.id === moduleId)?.label || moduleId;
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (ALL_MODULE_IDS as string[]).includes(value);
}

export function defaultModulesForRole(role?: string): ModuleId[] {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return [...ALL_MODULE_IDS];
  if (normalized === 'manager') return [...MANAGER_MODULES];
  return ['pos'];
}

export function sanitizeModuleIds(moduleIds: unknown, role?: string): ModuleId[] {
  const listed = Array.isArray(moduleIds) ? moduleIds.filter(isModuleId) : [];
  const unique = [...new Set(listed)];
  if (normalizeRole(role) !== 'admin') {
    return unique.filter((id) => id !== 'settings');
  }
  return unique;
}

export function resolvedModuleIds(
  operator?: Pick<Operator, 'role' | 'moduleIds'> | null
): ModuleId[] {
  if (!operator) return ['pos'];
  const listed = sanitizeModuleIds(operator.moduleIds, operator.role);
  if (listed.length > 0) return listed;
  return defaultModulesForRole(operator.role);
}

export function canOpenModule(
  operatorOrRole: Operator | string | undefined,
  moduleId: ModuleId
): boolean {
  if (typeof operatorOrRole === 'object' && operatorOrRole) {
    if (moduleId === 'settings' && normalizeRole(operatorOrRole.role) !== 'admin') {
      return false;
    }
    return resolvedModuleIds(operatorOrRole).includes(moduleId);
  }
  const normalized = normalizeRole(typeof operatorOrRole === 'string' ? operatorOrRole : undefined);
  if (normalized === 'admin') return true;
  if (ADMIN_ONLY_MODULES.includes(moduleId)) return false;
  if (normalized === 'manager') return MANAGER_MODULES.includes(moduleId);
  return moduleId === 'pos';
}

export function defaultModuleForRole(role?: string): ModuleId {
  const normalized = normalizeRole(role);
  if (normalized === 'cashier') return 'pos';
  return 'credicelDashboard';
}

export function defaultModuleForOperator(operator?: Operator | string | null): ModuleId {
  if (operator && typeof operator === 'object') {
    const ids = resolvedModuleIds(operator);
    if (ids.includes('credicelDashboard')) return 'credicelDashboard';
    if (ids.includes('pos')) return 'pos';
    return ids[0] || 'pos';
  }
  return defaultModuleForRole(typeof operator === 'string' ? operator : undefined);
}

export function resolveOperatorWorkspace(
  operator: Operator,
  currentBranch?: Branch | null,
  branches: Branch[] = ALL_BRANCHES
): Branch {
  if (normalizeRole(operator.role) === 'admin') return ADMIN_WORKSPACE;
  const allowed = (operator.branchIds || [])
    .map((id) => normalizeBranchId(id))
    .filter((id) => id && id !== 'all');
  const currentId = currentBranch ? normalizeBranchId(currentBranch.id) : '';
  if (currentId && allowed.includes(currentId)) {
    return branches.find((b) => b.id === currentId) || currentBranch || branches[0];
  }
  const first = allowed[0];
  return branches.find((b) => b.id === first) || branches[0] || ADMIN_WORKSPACE;
}
