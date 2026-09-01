import { Branch } from '../types';

export const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

export const COMMERCIAL_BRANCHES: Branch[] = [
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' }
];

/** Vista de administración: ve todo, no abre caja ni se ata a una sucursal. */
export const ADMIN_WORKSPACE: Branch = { id: 'all', name: 'Administración' };

export function isAdminWorkspace(id?: string): boolean {
  const clean = String(id || '')
    .toLowerCase()
    .trim();
  return clean === 'all' || clean === 'b-admin' || clean === 'admin' || clean === 'administracion';
}

/** Navojoa y Huatabampo cobran. Bodega y Administración no abren turno. */
export function hasCashTill(id?: string): boolean {
  const norm = normalizeBranchId(id);
  return norm === 'b-navojoa' || norm === 'b-huatabampo';
}

export function normalizeBranchId(id?: string): string {
  if (!id) return 'b-navojoa';
  const clean = id.toLowerCase().trim();
  if (isAdminWorkspace(clean)) return 'all';
  if (clean.includes('bodega') || clean.includes('bdg')) return 'b-bodega';
  if (clean.includes('huatabampo') || clean.includes('hpo') || clean.includes('hua')) return 'b-huatabampo';
  if (clean.includes('navojoa') || clean.includes('nav')) return 'b-navojoa';
  return id;
}

export function compareBranchIds(idA?: string, idB?: string): number {
  const normA = normalizeBranchId(idA);
  const normB = normalizeBranchId(idB);
  const rank: Record<string, number> = {
    'b-navojoa': 1,
    'b-huatabampo': 2,
    'b-bodega': 3
  };
  const pA = rank[normA] ?? 99;
  const pB = rank[normB] ?? 99;
  if (pA !== pB) return pA - pB;
  return normA.localeCompare(normB);
}

export const getBranchById = (id?: string): Branch => {
  if (isAdminWorkspace(id)) return ADMIN_WORKSPACE;
  if (!id) return ALL_BRANCHES[1]; // Default to Navojoa
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
  if (norm === 'b-bodega') return 'BDG';
  return 'NAV';
}
