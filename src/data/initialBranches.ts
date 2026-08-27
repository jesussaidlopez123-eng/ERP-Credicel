import { Branch } from '../types';

export const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

export const COMMERCIAL_BRANCHES: Branch[] = [
  { id: 'b-navojoa', name: 'Sucursal Navojoa Centro' },
  { id: 'b-huatabampo', name: 'Sucursal Huatabampo' }
];

export function normalizeBranchId(id?: string): string {
  if (!id) return 'b-navojoa';
  const clean = id.toLowerCase().trim();
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
  if (!id) return ALL_BRANCHES[1]; // Default to Navojoa
  const norm = normalizeBranchId(id);
  return ALL_BRANCHES.find((b) => b.id === norm) || ALL_BRANCHES.find((b) => b.id === id) || { id: norm, name: norm };
};

export function getBranchDisplayName(id?: string): string {
  const norm = normalizeBranchId(id);
  if (norm === 'b-navojoa') return 'Sucursal Navojoa Centro';
  if (norm === 'b-huatabampo') return 'Sucursal Huatabampo';
  if (norm === 'b-bodega') return 'Bodega Central';
  return id || 'Sucursal';
}
