/**
 * Restaura existencias de Navojoa según el kardex.
 * Uso: npx tsx scripts/restore-navojoa-inventory.ts [--apply]
 */
import { collection, getDocs } from 'firebase/firestore';
import {
  db,
  PRODUCTS_COLLECTION,
  SALES_COLLECTION,
  VENTAS_COLLECTION,
  saveInventoryMovementToFirestore,
  saveProductToFirestore
} from '../src/lib/firebase';
import { accessoryStockAt, addAccessoryStock } from '../src/lib/accessoryInventory';
import {
  addImeisToProduct,
  collectProductImeis,
  collectSoldImeis,
  isEquipmentProduct,
  locateImeiOnProduct,
  normalizeImei,
  toInventoryBranchId
} from '../src/lib/imeiInventory';
import { snapshotInventory } from '../src/lib/inventoryMerge';
import type { InventoryMovement, Product, SaleTicket } from '../src/types';
import { isVirtualPosProduct } from '../src/lib/inventoryRules';

const NAV = 'b-navojoa';
const apply = process.argv.includes('--apply');

function destOf(m: InventoryMovement): string {
  return m.targetBranchId ? toInventoryBranchId(m.targetBranchId) : '';
}

function originOf(m: InventoryMovement): string {
  return m.sourceBranchId ? toInventoryBranchId(m.sourceBranchId) : '';
}

async function main() {
  const [prodSnap, movSnap, salesSnap, ventasSnap] = await Promise.all([
    getDocs(collection(db, PRODUCTS_COLLECTION)),
    getDocs(collection(db, 'inventoryMovements')),
    getDocs(collection(db, SALES_COLLECTION)),
    getDocs(collection(db, VENTAS_COLLECTION)),
  ]);

  const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
  const movements = (movSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryMovement[]).sort((a, b) =>
    String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
  );
  const ticketsMap = new Map<string, SaleTicket>();
  for (const d of [...salesSnap.docs, ...ventasSnap.docs]) {
    ticketsMap.set(d.id, { id: d.id, ...d.data() } as SaleTicket);
  }
  const soldImeis = collectSoldImeis([...ticketsMap.values()]);

  const replayAcc = new Map<string, { nav: number; hua: number; bod: number }>();
  const replayImei = new Map<string, string>();

  for (const m of movements) {
    if (m.id?.startsWith('mov-rest-nav-') || String(m.details || '').includes('Restauración de')) continue;
    const dest = destOf(m);
    const origin = originOf(m);
    const qty = Number(m.quantity) || 0;
    const catalog =
      products.find((p) => p.id && p.id === m.productId) ||
      products.find((p) => p.code && p.code === m.productCode);
    if (!catalog) continue;
    if (!replayAcc.has(catalog.id)) replayAcc.set(catalog.id, { nav: 0, hua: 0, bod: 0 });
    const row = replayAcc.get(catalog.id)!;
    const add = (branch: string, n: number) => {
      if (branch === NAV) row.nav = Math.max(0, row.nav + n);
      else if (branch === 'b-huatabampo') row.hua = Math.max(0, row.hua + n);
      else if (branch === 'b-bodega') row.bod = Math.max(0, row.bod + n);
    };

    if (m.type === 'traspaso') {
      if (origin) add(origin, -Math.abs(qty));
      if (dest) add(dest, Math.abs(qty));
    } else if (m.type === 'venta') {
      if (dest) add(dest, -Math.abs(qty));
    } else if (m.type === 'ajuste') {
      if (dest) add(dest, qty);
    } else if (m.type === 'ingreso' || m.type === 'creacion' || m.type === 'ENTRADA') {
      if (dest) add(dest, Math.abs(qty));
    }

    for (const raw of m.imeis || []) {
      const imei = normalizeImei(raw);
      if (!imei) continue;
      if (m.type === 'venta' || (m.type === 'ajuste' && qty < 0)) {
        replayImei.delete(imei);
      } else if (dest) {
        replayImei.set(imei, dest);
      }
    }
  }

  const plan: Array<{ code: string; name: string; kind: string; detail: string }> = [];

  for (const product of products) {
    if (isVirtualPosProduct(product)) continue;
    if (product.code === 'REC-01' || product.code === 'REP-01') continue;

    if (isEquipmentProduct(product)) {
      const inboundImeis = movements
        .filter(
          (m) =>
            (m.productId === product.id || m.productCode === product.code) &&
            destOf(m) === NAV &&
            (m.type === 'ingreso' || m.type === 'creacion' || m.type === 'traspaso')
        )
        .flatMap((m) => (m.imeis || []).map(normalizeImei).filter(Boolean));

      const missing: string[] = [];
      for (const imei of inboundImeis) {
        if (soldImeis.has(imei)) continue;
        if (replayImei.get(imei) && replayImei.get(imei) !== NAV) continue;
        const loc = products.map((p) => locateImeiOnProduct(p, imei)).find(Boolean);
        if (loc) continue;
        if (collectProductImeis(product).includes(imei)) continue;
        if (!missing.includes(imei)) missing.push(imei);
      }

      if (missing.length === 0) continue;
      plan.push({
        code: product.code,
        name: product.name,
        kind: 'equipo',
        detail: `devolver ${missing.length} IMEI a Navojoa: ${missing.join(', ')}`
      });

      if (apply) {
        const base = snapshotInventory(product);
        const updated = addImeisToProduct(product, NAV, missing);
        await saveProductToFirestore(updated, base);
        await saveInventoryMovementToFirestore({
          id: `mov-rest-nav-${product.id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'ajuste',
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          category: product.category,
          inventoryType: 'equipo',
          quantity: missing.length,
          targetBranchId: NAV,
          targetBranchName: 'Navojoa',
          operatorName: 'Sistema',
          details: `Restauración de IMEI de Navojoa que se perdieron al pisarse el inventario: ${missing.join(', ')}`,
          imeis: missing
        });
      }
      continue;
    }

    const replay = replayAcc.get(product.id) || { nav: 0, hua: 0, bod: 0 };
    const current = accessoryStockAt(product, NAV);
    const missingQty = Math.round((replay.nav - current) * 100) / 100;
    if (missingQty <= 0) continue;

    plan.push({
      code: product.code,
      name: product.name,
      kind: 'accesorio',
      detail: `Navojoa kardex ${replay.nav} · actual ${current} · devolver ${missingQty}`
    });

    if (apply) {
      const base = snapshotInventory(product);
      const updated = addAccessoryStock(product, NAV, missingQty);
      await saveProductToFirestore(updated, base);
      await saveInventoryMovementToFirestore({
        id: `mov-rest-nav-${product.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'ajuste',
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        category: product.category,
        inventoryType: 'accesorio',
        quantity: missingQty,
        targetBranchId: NAV,
        targetBranchName: 'Navojoa',
        operatorName: 'Sistema',
        details: `Restauración de stock de Navojoa según kardex (se había perdido al pisarse el inventario). Kardex ${replay.nav}, había ${current}.`
      });
    }
  }

  console.log(JSON.stringify({ apply, count: plan.length, plan }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
