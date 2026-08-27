import { Operator } from '../types';

export const INITIAL_OPERATORS: Operator[] = [
  { 
    id: 'o1', 
    name: 'Admin Principal', 
    username: 'admin', 
    password: '123', 
    branchIds: ['b-bodega', 'b-navojoa', 'b-huatabampo'], 
    role: 'admin',
    isMainAdmin: true,
    createdAt: '2026-01-01'
  },
  { 
    id: 'o2', 
    name: 'Juan Pérez', 
    username: 'juan', 
    password: '123', 
    branchIds: ['b-navojoa'], 
    role: 'manager',
    isMainAdmin: false,
    createdAt: '2026-01-15'
  },
  { 
    id: 'o3', 
    name: 'María García', 
    username: 'maria', 
    password: '123', 
    branchIds: ['b-huatabampo'], 
    role: 'cashier',
    isMainAdmin: false,
    createdAt: '2026-02-01'
  },
  { 
    id: 'o4', 
    name: 'Carlos López', 
    username: 'carlos', 
    password: '123', 
    branchIds: ['b-bodega'], 
    role: 'cashier',
    isMainAdmin: false,
    createdAt: '2026-02-10'
  },
];

const STORAGE_KEY = 'erp_system_operators_v1';

export function getStoredOperators(): Operator[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading operators from localStorage', e);
  }
  return INITIAL_OPERATORS;
}

export function saveStoredOperators(operators: Operator[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(operators));
  } catch (e) {
    console.error('Error saving operators to localStorage', e);
  }
}
