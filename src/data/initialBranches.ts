import { Branch } from '../types';

export const BRANCH_IDS = ['b-matriz', 'b-navojoa', 'b-huatabampo'] as const;
export type BranchId = (typeof BRANCH_IDS)[number];

export const ALL_BRANCHES: Branch[] = [
  { id: 'b-matriz', name: 'Matriz' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' }
];

/** Las tres sucursales cobran, hacen corte y salen en reportes. */
export const COMMERCIAL_BRANCHES: Branch[] = ALL_BRANCHES;

/** Vista de administración: ve todo, no abre caja ni se ata a una sucursal. */
export const ADMIN_WORKSPACE: Branch = { id: 'all', name: 'Administración' };

export function isAdminWorkspace(id?: string): boolean {
  const clean = String(id || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return clean === 'all' || clean === 'b-admin' || clean === 'admin' || clean === 'administracion';
}

export function hasCashTill(id?: string): boolean {
  const norm = normalizeBranchId(id);
  return norm === 'b-matriz' || norm === 'b-navojoa' || norm === 'b-huatabampo';
}

export function normalizeBranchId(id?: string): string {
  if (!id) return 'b-navojoa';
  const clean = id
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (isAdminWorkspace(clean)) return 'all';
  if (
    clean.includes('matriz') ||
    clean.includes('mtz') ||
    clean.includes('bodega') ||
    clean.includes('bdg') ||
    clean === 'b-bodega'
  ) {
    return 'b-matriz';
  }
  if (clean.includes('huatabampo') || clean.includes('hpo') || clean.includes('hua')) return 'b-huatabampo';
  if (clean.includes('navojoa') || clean.includes('nav')) return 'b-navojoa';
  return id;
}

export function compareBranchIds(idA?: string, idB?: string): number {
  const normA = normalizeBranchId(idA);
  const normB = normalizeBranchId(idB);
  const rank: Record<string, number> = {
    'b-matriz': 1,
    'b-navojoa': 2,
    'b-huatabampo': 3
  };
  const pA = rank[normA] ?? 99;
  const pB = rank[normB] ?? 99;
  if (pA !== pB) return pA - pB;
  return normA.localeCompare(normB);
}

export const getBranchById = (id?: string): Branch => {
  if (isAdminWorkspace(id)) return ADMIN_WORKSPACE;
  if (!id) return ALL_BRANCHES[1];
  const norm = normalizeBranchId(id);
  return ALL_BRANCHES.find((b) => b.id === norm) || ALL_BRANCHES.find((b) => b.id === id) || { id: norm, name: norm };
};

export function getBranchDisplayName(id?: string): string {
  const found = getBranchById(id);
  return found.name || id || 'Sucursal';
}

export function branchFolioCode(id?: string): string {
  const norm = normalizeBranchId(id);
  if (norm === 'b-huatabampo') return 'HUA';
  if (norm === 'b-matriz') return 'MTZ';
  return 'NAV';
}

export function emptyBranchQty(): Record<BranchId, number> {
  return { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0 };
}
