import { getBranchDisplayName } from '../data/initialBranches';
import { stampRepairLabel } from './repairUtils';
import { REPAIR_COST_KIND_LABEL, type RepairRangeRegister } from './repairFinance';
import { downloadXlsx, type ExcelSheet } from './xlsxMinimal';

export function buildRepairExcelSheets(register: RepairRangeRegister): ExcelSheet[] {
  const resumen: ExcelSheet = {
    name: 'Resumen',
    rows: [
      ['CREDI CEL — Taller'],
      ['Resumen de operaciones'],
      ['Periodo', register.label || `${register.from} a ${register.to}`],
      ['Desde', register.from],
      ['Hasta', register.to],
      [],
      ['Concepto', 'Cantidad'],
      ['Equipos entregados', register.equipos],
      ['Cobrado (precio al cliente)', register.cobrado],
      ['Gastos de reparación', register.gastos],
      ['Utilidad', register.utilidad],
      ['Dados de baja', register.cancelados.length],
      [],
      ['El efectivo de anticipos y liquidaciones sigue en caja. Este archivo es el libro del taller.']
    ]
  };

  const operaciones: ExcelSheet = {
    name: 'Operaciones',
    rows: [
      [
        'Folio',
        'Sucursal',
        'Cliente',
        'Telefono',
        'Equipo',
        'Falla',
        'Precio cliente',
        'Gastos',
        'Utilidad',
        'Recibido',
        'Entregado',
        'Recibio',
        'Entrego'
      ],
      ...register.items.map((row) => [
        row.repair.id,
        getBranchDisplayName(row.repair.branchId),
        row.repair.clientName,
        row.repair.clientPhone,
        row.repair.deviceModel,
        row.repair.issueDescription || '',
        row.cobrado,
        row.gastos,
        row.utilidad,
        stampRepairLabel(row.repair.receivedAtIso, row.repair.receivedAt),
        stampRepairLabel(row.repair.deliveredAtIso, row.repair.deliveredAt),
        row.repair.operatorName || '',
        row.repair.deliveredByName || ''
      ]),
      [],
      ['TOTAL', '', '', '', '', '', register.cobrado, register.gastos, register.utilidad]
    ]
  };

  const gastoRows = register.items.flatMap((row) =>
    (row.repair.costLines || []).map((line) => [
      row.repair.id,
      getBranchDisplayName(row.repair.branchId),
      REPAIR_COST_KIND_LABEL[line.kind],
      line.concept,
      line.amount,
      stampRepairLabel(line.at, undefined),
      line.by || ''
    ])
  );

  const gastos: ExcelSheet = {
    name: 'Gastos',
    rows: [
      ['Folio', 'Sucursal', 'Tipo', 'Concepto', 'Monto', 'Fecha', 'Capturo'],
      ...(gastoRows.length ? gastoRows : [['Sin gastos capturados en el periodo']]),
      [],
      ['TOTAL', '', '', '', register.gastos]
    ]
  };

  const bajas: ExcelSheet = {
    name: 'Bajas',
    rows: [
      ['Folio', 'Sucursal', 'Cliente', 'Equipo', 'Motivo', 'Fecha', 'Dio de baja'],
      ...(register.cancelados.length
        ? register.cancelados.map((repair) => [
            repair.id,
            getBranchDisplayName(repair.branchId),
            repair.clientName,
            repair.deviceModel,
            repair.cancelReason || '',
            stampRepairLabel(repair.cancelledAt, undefined),
            repair.cancelledByName || ''
          ])
        : [['Sin bajas en el periodo']])
    ]
  };

  return [resumen, operaciones, gastos, bajas];
}

export function downloadRepairRangeExcel(register: RepairRangeRegister): void {
  downloadXlsx(`taller-${register.from}-a-${register.to}`, buildRepairExcelSheets(register));
}
