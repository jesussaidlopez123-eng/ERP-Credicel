import { Branch } from '../types';

export const ALL_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

export const getBranchById = (id?: string): Branch => {
  if (!id) return ALL_BRANCHES[0];
  return ALL_BRANCHES.find((b) => b.id === id) || ALL_BRANCHES[0];
};
