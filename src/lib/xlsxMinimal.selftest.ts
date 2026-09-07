import { buildXlsxBytes } from './xlsxMinimal';
import { buildRepairExcelSheets } from './repairExcel';
import type { RepairRangeRegister } from './repairFinance';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const bytes = buildXlsxBytes([
  { name: 'Resumen', rows: [['Hola'], ['Total', 1200]] },
  { name: 'Operaciones', rows: [['Folio', 'Utilidad'], ['REP-1', 100]] }
]);

assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'el archivo es un ZIP (xlsx)');
assert(bytes.length > 200, 'el xlsx no está vacío');

const register: RepairRangeRegister = {
  from: '2026-09-01',
  to: '2026-09-07',
  label: '1 – 7 sep 2026',
  equipos: 1,
  cobrado: 1200,
  gastos: 400,
  utilidad: 800,
  items: [
    {
      cobrado: 1200,
      gastos: 400,
      utilidad: 800,
      repair: {
        id: 'REP-1',
        clientName: 'Ana',
        clientPhone: '644',
        deviceModel: 'A54',
        issueDescription: 'Pantalla',
        totalCost: 1200,
        advancePayment: 200,
        pendingBalance: 0,
        status: 'entregado',
        receivedAt: '01/09/2026',
        operatorName: 'Juan',
        branchId: 'b-navojoa',
        costLines: [
          {
            id: 'c1',
            kind: 'refaccion',
            concept: 'Display',
            amount: 400,
            at: '2026-09-02T18:00:00.000Z',
            by: 'Admin'
          }
        ]
      }
    }
  ],
  cancelados: []
};

const sheets = buildRepairExcelSheets(register);
assert(sheets.length === 4, 'cuatro hojas');
assert(sheets[0].name === 'Resumen', 'hoja resumen');
assert(sheets[1].rows.some((row) => row[0] === 'REP-1'), 'la operación está en el detalle');
assert(sheets[2].rows.some((row) => row[3] === 'Display'), 'el gasto va en su hoja');

const full = buildXlsxBytes(sheets);
assert(full[0] === 0x50 && full[1] === 0x4b, 'el resumen del taller también es xlsx');

console.log('xlsxMinimal.selftest ok');
