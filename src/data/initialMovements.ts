import { InventoryMovement } from '../types';

export function getInitialInventoryMovements(): InventoryMovement[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'mov-init-1',
      timestamp: new Date(now - 1 * dayMs + 3600000).toISOString(),
      type: 'ingreso',
      productId: 'prod-fun-01',
      productCode: 'FUN-01',
      productName: 'Funda TPU Transparente Reforzada',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: 50,
      targetBranchId: 'b-bodega',
      targetBranchName: 'Bodega Central',
      operatorName: 'Said (Admin)',
      details: 'Ingreso de 50 pieza(s) a Bodega Central de proveedor Distribuidora Celular MX'
    },
    {
      id: 'mov-init-2',
      timestamp: new Date(now - 2 * dayMs + 7200000).toISOString(),
      type: 'traspaso',
      productId: 'prod-fun-01',
      productCode: 'FUN-01',
      productName: 'Funda TPU Transparente Reforzada',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: 15,
      sourceBranchId: 'b-bodega',
      sourceBranchName: 'Bodega Central',
      targetBranchId: 'b-navojoa',
      targetBranchName: 'Sucursal Navojoa',
      operatorName: 'Said (Admin)',
      details: 'Traspaso de 15 pieza(s) de Bodega Central a Sucursal Navojoa para surtido de mostrador'
    },
    {
      id: 'mov-init-3',
      timestamp: new Date(now - 3 * dayMs + 5400000).toISOString(),
      type: 'ingreso',
      productId: 'prod-eq-xia-note13',
      productCode: 'EQ-XIA-N13',
      productName: 'Xiaomi Redmi Note 13 256GB',
      category: 'equipo_credito',
      inventoryType: 'equipo',
      quantity: 3,
      targetBranchId: 'b-navojoa',
      targetBranchName: 'Sucursal Navojoa',
      operatorName: 'Said (Admin)',
      imeis: ['864920194820193', '864920194820194', '864920194820195'],
      details: 'Alta e ingreso de 3 equipos con captura de IMEIs en Sucursal Navojoa'
    },
    {
      id: 'mov-init-4',
      timestamp: new Date(now - 4 * dayMs + 1800000).toISOString(),
      type: 'ajuste',
      productId: 'prod-ca-01',
      productCode: 'CA-01',
      productName: 'Cargador Carga Rápida 20W Type-C',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: -1,
      targetBranchId: 'b-navojoa',
      targetBranchName: 'Sucursal Navojoa',
      operatorName: 'Said (Admin)',
      reason: 'Empaque roto y conector defectuoso en exhibición',
      details: 'Ajuste (Merma / Baja): -1 pza(s) en Sucursal Navojoa. Motivo: Empaque roto y conector defectuoso en exhibición'
    },
    {
      id: 'mov-init-5',
      timestamp: new Date(now - 6 * dayMs + 9000000).toISOString(),
      type: 'precio',
      productId: 'prod-ca-01',
      productCode: 'CA-01',
      productName: 'Cargador Carga Rápida 20W Type-C',
      category: 'accesorio',
      inventoryType: 'accesorio',
      quantity: 0,
      operatorName: 'Said (Admin)',
      oldCostPrice: 75,
      newCostPrice: 85,
      oldPrice: 199,
      newPrice: 229,
      details: 'Actualización de Precios: Costo $75.00 ➔ $85.00 | Venta $199.00 ➔ $229.00'
    }
  ];
}
