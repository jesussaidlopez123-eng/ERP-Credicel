import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  // Special POS Action Items
  {
    id: 'prod-equipo-credito-gen',
    code: 'EQ-VENTA',
    name: 'Venta de Celular / Equipo (Contado o Crédito)',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 0,
    price: 0,
    stock: 999,
    branchStock: { 'b-bodega': 999, 'b-navojoa': 999, 'b-huatabampo': 999 },
    color: 'bg-indigo-600 text-white'
  },
  {
    id: 'prod-abono-gen',
    code: 'ABO-CRED',
    name: 'Cobrar Abono a Crédito',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 0,
    price: 0,
    stock: 999,
    branchStock: { 'b-bodega': 999, 'b-navojoa': 999, 'b-huatabampo': 999 },
    color: 'bg-blue-600 text-white'
  },
  {
    id: 'prod-recarga-gen',
    code: 'REC-01',
    name: 'Recarga Tiempo Aire',
    category: 'recarga',
    inventoryType: 'accesorio',
    costPrice: 0,
    price: 0,
    stock: 9999,
    branchStock: { 'b-bodega': 9999, 'b-navojoa': 9999, 'b-huatabampo': 9999 },
    color: 'bg-emerald-600 text-white'
  },
  {
    id: 'prod-reparacion-gen',
    code: 'REP-01',
    name: 'Servicio Técnico / Reparación',
    category: 'servicio',
    inventoryType: 'accesorio',
    costPrice: 0,
    price: 0,
    stock: 999,
    branchStock: { 'b-bodega': 999, 'b-navojoa': 999, 'b-huatabampo': 999 },
    color: 'bg-amber-600 text-white'
  }
];
