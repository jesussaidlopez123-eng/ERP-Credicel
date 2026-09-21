/**
 * Pruebas de cotidianidad de inventario.
 *
 * Recorre el día real de una sucursal: alta, traspaso con lector, venta,
 * snapshot viejo de la nube y accesorios. Si alguna de estas rutas infla
 * o resucita stock, el inventario deja de cuadrar con lo que hay en anaquel.
 */
import assert from 'node:assert/strict';
import type { Product, SaleTicket } from '../types';
import {
  accessoryStockAt,
  addAccessoryStock,
  moveAccessoryStock,
  removeAccessoryStock
} from './accessoryInventory.ts';
import {
  addImeisToProduct,
  collectProductImeis,
  collectSoldImeis,
  findImeiOnCatalog,
  imeisAtBranch,
  moveImeisOnProduct,
  removeImeisFromProduct
} from './imeiInventory.ts';
import { findImeiInInventory, getBranchStockQty } from './inventoryRules.ts';
import {
  applyLiveCatalog,
  applyInventoryWrite,
  pendingProductWritesFromOutboxPayload,
  snapshotInventory
} from './inventoryMerge.ts';

const IMEI_NAV = '351299123456789';
const IMEI_SCAN = ']A351299123456789';
const IMEI_HUA = '352088111111111';

const phone = (over: Partial<Product> = {}): Product => ({
  id: 'eq-a16',
  code: 'EQ-A16',
  name: 'Samsung A16',
  category: 'equipo_credito',
  inventoryType: 'equipo',
  price: 4200,
  stock: 0,
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] },
  branchStock: { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0 },
  imeiList: [],
  ...over
});

const mica = (over: Partial<Product> = {}): Product => ({
  id: 'acc-mica',
  code: 'CA01',
  name: 'Mica 15D',
  category: 'accesorio',
  inventoryType: 'accesorio',
  price: 50,
  stock: 0,
  branchStock: { 'b-matriz': 0, 'b-navojoa': 0, 'b-huatabampo': 0 },
  ...over
});

function saleTicket(imei: string, branchId: string, product: Product): SaleTicket {
  return {
    id: `TCK-${imei.slice(-4)}`,
    folio: `NAV-1809-001`,
    timestamp: '2026-09-18T18:10:00-07:00',
    branchId,
    operatorName: 'Jesus Villa',
    items: [
      {
        product,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        metadata: { saleType: 'contado', imei, stockBranchId: branchId }
      }
    ],
    total: product.price,
    paymentMethod: 'Efectivo'
  } as unknown as SaleTicket;
}

const hallazgos: string[] = [];
function revisar(ok: boolean, msg: string): void {
  if (!ok) hallazgos.push(msg);
  assert.equal(ok, true, msg);
}

console.log('\n── 09:00 Alta de un A16 en Navojoa');
let catalog = addImeisToProduct(phone(), 'b-navojoa', [IMEI_NAV]);
revisar(imeisAtBranch(catalog, 'b-navojoa').length === 1, 'El alta debía dejar 1 IMEI en Navojoa');
revisar(catalog.stock === 1, 'El stock del modelo debía ser 1');
revisar(
  findImeiInInventory([catalog], IMEI_NAV, 'b-navojoa').status === 'found',
  'Navojoa debía poder vender el IMEI recién ingresado'
);
revisar(
  findImeiInInventory([catalog], IMEI_NAV, 'b-huatabampo').status === 'other_branch',
  'Huatabampo no debía vender un equipo que está en Navojoa'
);

console.log('── 11:00 Traspaso a Huatabampo escaneando con prefijo de lector');
catalog = moveImeisOnProduct(catalog, 'b-navojoa', 'b-huatabampo', [IMEI_SCAN]);
revisar(catalog.stock === 1, `Traspaso con lector no debe inflar stock (quedó ${catalog.stock})`);
revisar(
  imeisAtBranch(catalog, 'b-navojoa').length === 0,
  'El IMEI debía salir de Navojoa aunque el lector haya mandado caracteres de más'
);
revisar(
  imeisAtBranch(catalog, 'b-huatabampo').length === 1,
  'El IMEI debía quedar solo en Huatabampo'
);
revisar(
  findImeiInInventory([catalog], IMEI_SCAN, 'b-huatabampo').status === 'found',
  'Huatabampo debía reconocer el IMEI aunque el ticket lleve el prefijo del lector'
);

console.log('── 11:05 Reingreso del mismo IMEI (otro formato) no duplica');
const duplicated = addImeisToProduct(catalog, 'b-navojoa', [IMEI_SCAN]);
revisar(duplicated.stock === 1, `Reingresar el mismo IMEI no debe crear un segundo equipo (stock ${duplicated.stock})`);
revisar(
  imeisAtBranch(duplicated, 'b-navojoa').length === 1,
  'Si se vuelve a capturar, el IMEI se mueve, no se copia'
);
revisar(imeisAtBranch(duplicated, 'b-huatabampo').length === 0, 'No debía quedar el mismo IMEI en dos sucursales');
catalog = duplicated;

console.log('── 13:00 Venta en Navojoa con el lector');
const beforeSale = catalog;
const lookup = findImeiInInventory([catalog], IMEI_SCAN, 'b-navojoa');
revisar(lookup.status === 'found', 'El PDV de Navojoa debía hallar el IMEI al escanear');
const stored = collectProductImeis(catalog).find((im) => im === IMEI_NAV) || IMEI_NAV;
catalog = removeImeisFromProduct(catalog, [IMEI_SCAN]);
revisar(catalog.stock === 0, 'Después de la venta el modelo debía quedar en 0');
revisar(
  collectProductImeis(catalog).length === 0,
  'El IMEI vendido no debía seguir listado aunque el lector haya diferido'
);

console.log('── 13:01 La nube todavía no confirma: el snapshot viejo no resucita el equipo');
const ticket = saleTicket(stored, 'b-navojoa', beforeSale);
const liveAfterSale = applyLiveCatalog({
  cloud: [beforeSale],
  pendingWrites: [{ incoming: catalog, base: snapshotInventory(beforeSale) }],
  tickets: [ticket]
});
revisar(
  collectProductImeis(liveAfterSale[0]).length === 0,
  'Un snapshot viejo + la venta pendiente no debía devolver el IMEI al anaquel'
);

const liveOnlyTickets = applyLiveCatalog({
  cloud: [beforeSale],
  tickets: [ticket]
});
revisar(
  collectProductImeis(liveOnlyTickets[0]).length === 0,
  'Aunque falle la cola, el ticket de venta debe bajar el IMEI del catálogo local'
);

console.log('── 13:02 Doble clic: segunda baja del mismo IMEI no deja stock negativo');
const twice = removeImeisFromProduct(catalog, [IMEI_SCAN]);
revisar(twice.stock === 0, 'Un segundo cobro del mismo IMEI no debe alterar el stock ya en 0');

console.log('── 16:00 Accesorios: ingreso Matriz, traspaso a Navojoa, venta');
let acc = addAccessoryStock(mica(), 'b-matriz', 40);
acc = moveAccessoryStock(acc, 'b-matriz', 'b-navojoa', 10);
acc = addAccessoryStock(acc, 'b-huatabampo', 8);
const accBase = snapshotInventory(acc);
const accAfterNavSale = removeAccessoryStock(acc, 'b-navojoa', 3);
revisar(accessoryStockAt(accAfterNavSale, 'b-navojoa') === 7, 'Navojoa debía quedar en 7 micas');
revisar(accessoryStockAt(accAfterNavSale, 'b-huatabampo') === 8, 'La venta de Navojoa no debía tocar Huatabampo');
revisar(accessoryStockAt(accAfterNavSale, 'b-matriz') === 30, 'Matriz debía conservar las 30 que no se traspasaron');

const staleCloudAcc = acc;
const liveAcc = applyLiveCatalog({
  cloud: [staleCloudAcc],
  pendingWrites: [{ incoming: accAfterNavSale, base: accBase }]
});
revisar(
  accessoryStockAt(liveAcc[0], 'b-navojoa') === 7,
  `La nube vieja no debía devolver las 3 micas vendidas (quedó ${accessoryStockAt(liveAcc[0], 'b-navojoa')})`
);
revisar(
  accessoryStockAt(liveAcc[0], 'b-huatabampo') === 8,
  'El overlay de la cola no debía mover el stock de la otra sucursal'
);

console.log('── 16:30 IMEI suelto (solo lista, sin sucursal) se vende en Navojoa y desaparece');
const loose = phone({
  stock: 1,
  imeiList: [IMEI_HUA],
  imeis: [IMEI_HUA],
  branchImeiMap: { 'b-matriz': [], 'b-navojoa': [], 'b-huatabampo': [] }
});
revisar(
  findImeiInInventory([loose], IMEI_HUA, 'b-navojoa').status === 'found',
  'Un IMEI sin sucursal asignada debía poder venderse en el PDV que lo escanea'
);
const soldLoose = removeImeisFromProduct(loose, [IMEI_HUA]);
revisar(soldLoose.stock === 0, 'Vender el IMEI suelto debía dejar stock 0');
revisar(collectProductImeis(soldLoose).length === 0, 'El IMEI suelto no debía quedar escondido en otra lista');

console.log('── 17:00 Merge sin foto previa: formatos distintos del mismo IMEI no se suman');
const mergedFormats = applyInventoryWrite(
  phone({
    stock: 1,
    imeiList: [IMEI_NAV],
    branchImeiMap: { 'b-navojoa': [IMEI_NAV], 'b-huatabampo': [], 'b-matriz': [] }
  }),
  phone({
    stock: 1,
    imeiList: [IMEI_SCAN],
    branchImeiMap: { 'b-navojoa': [IMEI_SCAN], 'b-huatabampo': [], 'b-matriz': [] }
  }),
  null
);
revisar(mergedFormats.stock === 1, `El merge no debía contar dos veces el mismo celular (stock ${mergedFormats.stock})`);

console.log('── 17:30 Cola de envío: extraer escrituras de producto y aplicarlas');
const payload = {
  writes: [
    {
      collection: 'products',
      id: 'acc-mica',
      data: accAfterNavSale,
      inventoryBase: accBase
    },
    { collection: 'ventas', id: 'TCK-1', data: { id: 'TCK-1' } }
  ]
};
const extracted = pendingProductWritesFromOutboxPayload(payload);
revisar(extracted.length === 1, 'De la cola solo debían tomarse las escrituras de products');
revisar(extracted[0]?.incoming.id === 'acc-mica', 'El overlay debía apuntar al accesorio vendido');

console.log('── 18:00 Stock por sucursal del mostrador');
const twoPhones = addImeisToProduct(addImeisToProduct(phone(), 'b-navojoa', [IMEI_NAV]), 'b-huatabampo', [IMEI_HUA]);
revisar(getBranchStockQty(twoPhones, 'b-navojoa') === 1, 'Navojoa debía ver 1 equipo');
revisar(getBranchStockQty(twoPhones, 'b-huatabampo') === 1, 'Huatabampo debía ver 1 equipo');
revisar(getBranchStockQty(twoPhones, 'all') === 2, 'Administración debía ver los 2 equipos');
revisar(findImeiOnCatalog([twoPhones], IMEI_SCAN)?.branchId === 'b-navojoa', 'El catálogo debía ubicar el IMEI de Navojoa con el scan sucio');

console.log('── 18:30 Venta de accesorio sin stock en la sucursal no toma piezas de otra');
const blocked = removeAccessoryStock(
  mica({
    stock: 8,
    branchStock: { 'b-matriz': 8, 'b-navojoa': 0, 'b-huatabampo': 0 }
  }),
  'b-navojoa',
  2
);
revisar(accessoryStockAt(blocked, 'b-navojoa') === 0, 'Navojoa no debía quedar en negativo');
revisar(
  accessoryStockAt(blocked, 'b-matriz') === 8,
  'Una venta en Navojoa no debe descontar micas que están en Matriz'
);

const soldImeis = collectSoldImeis([ticket]);
revisar(soldImeis.has(IMEI_NAV), 'El ticket con IMEI canónico debía marcar el equipo como vendido');

console.log('\n════════════════════════════════════');
if (hallazgos.length === 0) {
  console.log('COTIDIANIDAD DE INVENTARIO: sin fallas detectadas.');
} else {
  console.log(`COTIDIANIDAD DE INVENTARIO: ${hallazgos.length} falla(s):`);
  hallazgos.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
}
console.log('════════════════════════════════════');
