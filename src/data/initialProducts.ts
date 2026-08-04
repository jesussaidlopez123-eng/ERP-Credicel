import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  // Special POS Action Buttons
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
    color: 'bg-indigo-600 text-white'
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
    id: 'prod-equipo-credito-gen',
    code: 'EQ-CRED',
    name: 'Venta Equipo a Crédito',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 0,
    price: 0,
    stock: 99,
    branchStock: { 'b-bodega': 99, 'b-navojoa': 99, 'b-huatabampo': 99 },
    color: 'bg-indigo-600 text-white'
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
  },

  // ACCESORIOS
  {
    id: 'prod-1',
    code: 'CARG-20W',
    name: 'Cargador Carga Rápida 20W Tipo-C',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 110.00,
    price: 250.00,
    stock: 35,
    branchStock: { 'b-bodega': 20, 'b-navojoa': 10, 'b-huatabampo': 5 },
    color: 'bg-slate-800 text-white'
  },
  {
    id: 'prod-2',
    code: 'AUDI-BT',
    name: 'Audífonos Bluetooth Inalámbricos Pro',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 180.00,
    price: 380.00,
    stock: 18,
    branchStock: { 'b-bodega': 10, 'b-navojoa': 5, 'b-huatabampo': 3 },
    color: 'bg-slate-800 text-white'
  },
  {
    id: 'prod-3',
    code: 'CRIS-9D',
    name: 'Cristal Templado 9D Curvo Antigolpes',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 35.00,
    price: 120.00,
    stock: 85,
    branchStock: { 'b-bodega': 50, 'b-navojoa': 20, 'b-huatabampo': 15 },
    color: 'bg-slate-800 text-white'
  },
  {
    id: 'prod-4',
    code: 'CAB-TIPC',
    name: 'Cable Reforzado Tipo-C a Tipo-C 1m',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 38.00,
    price: 95.00,
    stock: 55,
    branchStock: { 'b-bodega': 30, 'b-navojoa': 15, 'b-huatabampo': 10 },
    color: 'bg-slate-800 text-white'
  },
  {
    id: 'prod-5',
    code: 'POWER-10K',
    name: 'Power Bank 10,000 mAh Carga Rápida',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 220.00,
    price: 450.00,
    stock: 14,
    branchStock: { 'b-bodega': 8, 'b-navojoa': 4, 'b-huatabampo': 2 },
    color: 'bg-slate-800 text-white'
  },
  {
    id: 'prod-6',
    code: 'FUND-USAG',
    name: 'Funda Acrigel Anti-Caídas con Anillo',
    category: 'accesorio',
    inventoryType: 'accesorio',
    costPrice: 50.00,
    price: 150.00,
    stock: 42,
    branchStock: { 'b-bodega': 20, 'b-navojoa': 12, 'b-huatabampo': 10 },
    color: 'bg-slate-800 text-white'
  },

  // EQUIPOS
  {
    id: 'prod-eq-1',
    code: 'EQ-SAM-A54',
    name: 'Samsung Galaxy A54 5G 128GB',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 4200.00,
    price: 5999.00,
    stock: 9,
    branchStock: { 'b-bodega': 5, 'b-navojoa': 2, 'b-huatabampo': 2 },
    branchImeiMap: {
      'b-bodega': ['354890123456701', '354890123456702', '354890123456703', '354890123456704', '354890123456705'],
      'b-navojoa': ['354890123456706', '354890123456707'],
      'b-huatabampo': ['354890123456708', '354890123456709']
    },
    imeiList: [
      '354890123456701', '354890123456702', '354890123456703', '354890123456704', '354890123456705',
      '354890123456706', '354890123456707', '354890123456708', '354890123456709'
    ],
    imei: '354890123456701',
    supplier: 'Samsung México',
    color: 'bg-blue-800 text-white'
  },
  {
    id: 'prod-eq-2',
    code: 'EQ-MOT-G84',
    name: 'Motorola Moto G84 5G 256GB',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 3100.00,
    price: 4499.00,
    stock: 12,
    branchStock: { 'b-bodega': 6, 'b-navojoa': 4, 'b-huatabampo': 2 },
    branchImeiMap: {
      'b-bodega': ['359123456789001', '359123456789002', '359123456789003', '359123456789004', '359123456789005', '359123456789006'],
      'b-navojoa': ['359123456789007', '359123456789008', '359123456789009', '359123456789010'],
      'b-huatabampo': ['359123456789011', '359123456789012']
    },
    imeiList: [
      '359123456789001', '359123456789002', '359123456789003', '359123456789004', '359123456789005', '359123456789006',
      '359123456789007', '359123456789008', '359123456789009', '359123456789010', '359123456789011', '359123456789012'
    ],
    imei: '359123456789001',
    supplier: 'Motorola Direct',
    color: 'bg-blue-800 text-white'
  },
  {
    id: 'prod-eq-3',
    code: 'EQ-XIA-RN13',
    name: 'Xiaomi Redmi Note 13 256GB',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 2800.00,
    price: 3999.00,
    stock: 15,
    branchStock: { 'b-bodega': 8, 'b-navojoa': 4, 'b-huatabampo': 3 },
    branchImeiMap: {
      'b-bodega': ['861234567890101', '861234567890102', '861234567890103', '861234567890104', '861234567890105', '861234567890106', '861234567890107', '861234567890108'],
      'b-navojoa': ['861234567890109', '861234567890110', '861234567890111', '861234567890112'],
      'b-huatabampo': ['861234567890113', '861234567890114', '861234567890115']
    },
    imeiList: [
      '861234567890101', '861234567890102', '861234567890103', '861234567890104', '861234567890105', '861234567890106', '861234567890107', '861234567890108',
      '861234567890109', '861234567890110', '861234567890111', '861234567890112', '861234567890113', '861234567890114', '861234567890115'
    ],
    imei: '861234567890101',
    supplier: 'Xiaomi LATAM',
    color: 'bg-blue-800 text-white'
  },
  {
    id: 'prod-eq-4',
    code: 'EQ-HON-M5L',
    name: 'Honor Magic 5 Lite 128GB',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 3400.00,
    price: 4899.00,
    stock: 7,
    branchStock: { 'b-bodega': 4, 'b-navojoa': 2, 'b-huatabampo': 1 },
    branchImeiMap: {
      'b-bodega': ['357890123456801', '357890123456802', '357890123456803', '357890123456804'],
      'b-navojoa': ['357890123456805', '357890123456806'],
      'b-huatabampo': ['357890123456807']
    },
    imeiList: [
      '357890123456801', '357890123456802', '357890123456803', '357890123456804', '357890123456805', '357890123456806', '357890123456807'
    ],
    imei: '357890123456801',
    supplier: 'Honor Distribución',
    color: 'bg-blue-800 text-white'
  },
  {
    id: 'prod-eq-5',
    code: 'EQ-IPH-13',
    name: 'Apple iPhone 13 128GB Seminuevo A+',
    category: 'equipo_credito',
    inventoryType: 'equipo',
    costPrice: 7800.00,
    price: 10499.00,
    stock: 5,
    branchStock: { 'b-bodega': 3, 'b-navojoa': 1, 'b-huatabampo': 1 },
    branchImeiMap: {
      'b-bodega': ['353990123456901', '353990123456902', '353990123456903'],
      'b-navojoa': ['353990123456904'],
      'b-huatabampo': ['353990123456905']
    },
    imeiList: [
      '353990123456901', '353990123456902', '353990123456903', '353990123456904', '353990123456905'
    ],
    imei: '353990123456901',
    supplier: 'Apple Reconditioned',
    color: 'bg-blue-800 text-white'
  }
];

