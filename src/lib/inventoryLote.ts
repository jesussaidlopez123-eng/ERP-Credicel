import type { InventoryMovement, Product, SaleTicket } from '../types';
import { getBranchDisplayName } from '../data/initialBranches';
import {
  addAccessoryStock,
  accessoryStockAt
} from './accessoryInventory';
import {
  addImeisToProduct,
  canonicalImei,
  findImeiOnCatalog,
  findSoldImeiTicket,
  imeiDigits,
  imeisEqual,
  isEquipmentProduct,
  listHasImei,
  normalizeImei,
  toInventoryBranchId
} from './imeiInventory';
import { isVirtualPosProduct } from './inventoryRules';
import { newUniqueId } from './ids';

export type AccessoryLoteLine = {
  key: string;
  productId: string;
  isNew?: boolean;
  code: string;
  name: string;
  costPrice: number;
  price: number;
  supplier: string;
  qty: number;
};

export type EquipmentLoteLine = {
  key: string;
  productId: string;
  isNew?: boolean;
  code: string;
  name: string;
  costPrice: number;
  price: number;
  supplier: string;
  imeis: string[];
};

export type LoteError = {
  lineKey?: string;
  message: string;
};

export type LoteApplyOk = {
  ok: true;
  created: Product[];
  updated: Product[];
  movements: Array<Omit<InventoryMovement, 'id' | 'timestamp'>>;
  destBranchId: string;
  destBranchName: string;
  pieceCount: number;
  lineCount: number;
};

export type LoteApplyResult = LoteApplyOk | { ok: false; errors: LoteError[] };

export function newLoteLineKey(): string {
  return newUniqueId('ln');
}

export function emptyAccessoryLine(): AccessoryLoteLine {
  return {
    key: newLoteLineKey(),
    productId: '',
    code: '',
    name: '',
    costPrice: 0,
    price: 0,
    supplier: '',
    qty: 1
  };
}

export function emptyEquipmentLine(): EquipmentLoteLine {
  return {
    key: newLoteLineKey(),
    productId: '',
    code: '',
    name: '',
    costPrice: 0,
    price: 0,
    supplier: '',
    imeis: []
  };
}

export function catalogForLote(products: Product[], kind: 'accesorio' | 'equipo'): Product[] {
  return (products || []).filter((p) => {
    if (isVirtualPosProduct(p)) return false;
    const type = p.inventoryType || (p.category === 'equipo_credito' ? 'equipo' : 'accesorio');
    return type === kind;
  });
}

export function nextEquipmentCode(products: Product[], name: string, extraCodes: string[] = []): string {
  const base = (name || 'EQ')
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'EQ';
  const taken = new Set(
    [...(products || []).map((p) => (p.code || '').trim().toUpperCase()), ...extraCodes.map((c) => c.trim().toUpperCase())].filter(
      Boolean
    )
  );
  let n = 100;
  let code = `EQ-${base}-${n}`;
  while (taken.has(code)) {
    n += 1;
    code = `EQ-${base}-${n}`;
  }
  return code;
}

export function loteImeiCanonical(raw: string): string {
  return canonicalImei(raw) || normalizeImei(raw);
}

export function loteImeiFormatError(raw: string): string | null {
  const digits = imeiDigits(raw);
  if (!String(raw || '').trim() && !digits) return 'Falta el IMEI.';
  if (!digits) return 'El IMEI solo puede llevar números.';
  const clean = loteImeiCanonical(raw);
  const cleanDigits = imeiDigits(clean);
  if (cleanDigits.length === 15) return null;
  if (cleanDigits.length < 15) return `El IMEI tiene ${cleanDigits.length} dígitos; se necesitan 15.`;
  return `No se leyó un IMEI de 15 dígitos (${cleanDigits.length}). Vuelva a escanear.`;
}

function codeTaken(
  products: Product[],
  code: string,
  extra: string[],
  excludeProductId?: string
): Product | string | undefined {
  const clean = code.trim().toUpperCase();
  if (!clean) return undefined;
  const hit = (products || []).find(
    (p) => p.code.trim().toUpperCase() === clean && (!excludeProductId || p.id !== excludeProductId)
  );
  if (hit) return hit;
  if (extra.filter((c) => c.trim().toUpperCase() === clean).length > 1) return clean;
  return undefined;
}

export function validateAccessoryLote(products: Product[], lines: AccessoryLoteLine[]): LoteError[] {
  const errors: LoteError[] = [];
  const usable = (lines || []).filter((line) => line.productId || line.code.trim() || line.name.trim());
  if (usable.length === 0) {
    return [{ message: 'Agregue al menos un accesorio al paquete.' }];
  }

  const newCodes: string[] = [];
  for (const line of usable) {
    const qty = Math.round(Number(line.qty) || 0);
    if (qty <= 0) {
      errors.push({ lineKey: line.key, message: 'Cada renglón necesita una cantidad mayor a 0.' });
      continue;
    }
    if (line.productId) {
      const prod = (products || []).find((p) => p.id === line.productId);
      if (!prod) {
        errors.push({ lineKey: line.key, message: 'Ese accesorio ya no está en el catálogo.' });
        continue;
      }
      if (isEquipmentProduct(prod) || isVirtualPosProduct(prod)) {
        errors.push({ lineKey: line.key, message: `“${prod.name}” no es un accesorio.` });
      }
      continue;
    }
    const code = line.code.trim().toUpperCase();
    const name = line.name.trim();
    if (!code) errors.push({ lineKey: line.key, message: 'El accesorio nuevo necesita código.' });
    if (!name) errors.push({ lineKey: line.key, message: 'El accesorio nuevo necesita nombre.' });
    if (code) newCodes.push(code);
    if (code) {
      const taken = codeTaken(products, code, newCodes);
      if (taken && typeof taken !== 'string') {
        errors.push({
          lineKey: line.key,
          message: `El código ${code} ya pertenece a “${taken.name}”.`
        });
      } else if (newCodes.filter((c) => c === code).length > 1) {
        errors.push({ lineKey: line.key, message: `El código ${code} está repetido en este paquete.` });
      }
    }
  }
  return errors;
}

export function validateEquipmentLote(
  products: Product[],
  tickets: SaleTicket[] | undefined,
  lines: EquipmentLoteLine[]
): LoteError[] {
  const errors: LoteError[] = [];
  const usable = (lines || []).filter(
    (line) => line.productId || line.name.trim() || line.code.trim() || line.imeis.some((im) => im.trim())
  );
  if (usable.length === 0) {
    return [{ message: 'Agregue al menos un modelo con IMEI al paquete.' }];
  }

  const seen: string[] = [];
  const newCodes: string[] = [];

  for (const line of usable) {
    const rawImeis = (line.imeis || []).map((im) => im.trim()).filter(Boolean);
    if (rawImeis.length === 0) {
      errors.push({ lineKey: line.key, message: `“${line.name || 'Modelo'}” no tiene IMEI. Cada celular del paquete lleva el suyo.` });
    }
    for (const raw of rawImeis) {
      const format = loteImeiFormatError(raw);
      if (format) {
        errors.push({ lineKey: line.key, message: format });
        continue;
      }
      const n = loteImeiCanonical(raw);
      if (listHasImei(seen, n)) {
        errors.push({ lineKey: line.key, message: `El IMEI ${n} está repetido en este paquete.` });
        continue;
      }
      seen.push(n);
      const catalogHit = findImeiOnCatalog(products, n);
      if (catalogHit) {
        errors.push({
          lineKey: line.key,
          message: `El IMEI ${n} ya está en inventario (“${catalogHit.product.name}”).`
        });
        continue;
      }
      const sold = findSoldImeiTicket(tickets, n);
      if (sold) {
        errors.push({
          lineKey: line.key,
          message: `El IMEI ${n} ya se vendió en el ticket ${sold.folio || sold.id}.`
        });
      }
    }

    if (line.productId) {
      const prod = (products || []).find((p) => p.id === line.productId);
      if (!prod) {
        errors.push({ lineKey: line.key, message: 'Ese modelo ya no está en el catálogo.' });
        continue;
      }
      if (!isEquipmentProduct(prod) || isVirtualPosProduct(prod)) {
        errors.push({ lineKey: line.key, message: `“${prod.name}” no es un equipo celular.` });
      }
      continue;
    }

    if (!line.name.trim()) {
      errors.push({ lineKey: line.key, message: 'El modelo nuevo necesita nombre.' });
    }
    const code = line.code.trim().toUpperCase();
    if (code) {
      newCodes.push(code);
      const taken = codeTaken(products, code, newCodes);
      if (taken && typeof taken !== 'string') {
        errors.push({ lineKey: line.key, message: `El código ${code} ya pertenece a “${taken.name}”.` });
      } else if (newCodes.filter((c) => c === code).length > 1) {
        errors.push({ lineKey: line.key, message: `El código ${code} está repetido en este paquete.` });
      }
    }
  }

  return errors;
}

function movementBase(params: {
  product: Product;
  destBranchId: string;
  destBranchName: string;
  operatorName: string;
  operatorId?: string;
  quantity: number;
  type: 'ingreso' | 'creacion';
  details: string;
  imeis?: string[];
  unitPrice?: number;
  costPrice?: number;
}): Omit<InventoryMovement, 'id' | 'timestamp'> {
  return {
    type: params.type,
    productId: params.product.id,
    productCode: params.product.code,
    productName: params.product.name,
    category: params.product.category,
    inventoryType: params.product.inventoryType,
    quantity: params.quantity,
    targetBranchId: params.destBranchId,
    targetBranchName: params.destBranchName,
    operatorName: params.operatorName,
    operatorId: params.operatorId,
    details: params.details,
    imeis: params.imeis,
    unitPrice: params.unitPrice,
    costPrice: params.costPrice
  };
}

export function applyAccessoryLote(params: {
  products: Product[];
  lines: AccessoryLoteLine[];
  destBranchId: string;
  operatorName: string;
  operatorId?: string;
  newProductId?: () => string;
}): LoteApplyResult {
  if (!String(params.destBranchId || '').trim()) {
    return { ok: false, errors: [{ message: 'Elija la sucursal que recibe el paquete.' }] };
  }
  const errors = validateAccessoryLote(params.products, params.lines);
  if (errors.length) return { ok: false, errors };

  const dest = toInventoryBranchId(params.destBranchId);
  const destBranchName = getBranchDisplayName(dest);
  const usable = params.lines.filter((line) => line.productId || line.code.trim() || line.name.trim());
  const qtyById = new Map<string, number>();
  const newLines: AccessoryLoteLine[] = [];

  for (const line of usable) {
    const qty = Math.round(Number(line.qty) || 0);
    if (line.productId) {
      qtyById.set(line.productId, (qtyById.get(line.productId) || 0) + qty);
    } else {
      newLines.push({ ...line, qty, code: line.code.trim().toUpperCase(), name: line.name.trim() });
    }
  }

  const updated: Product[] = [];
  const created: Product[] = [];
  const movements: LoteApplyOk['movements'] = [];
  let pieceCount = 0;

  for (const [id, qty] of qtyById) {
    const prod = params.products.find((p) => p.id === id);
    if (!prod) continue;
    const next = addAccessoryStock(prod, dest, qty);
    updated.push(next);
    pieceCount += qty;
    movements.push(
      movementBase({
        product: next,
        destBranchId: dest,
        destBranchName,
        operatorName: params.operatorName,
        operatorId: params.operatorId,
        quantity: qty,
        type: 'ingreso',
        details: `Paquete de ingreso: +${qty} pza(s) de ${next.name} en ${destBranchName} (quedan ${accessoryStockAt(next, dest)})`
      })
    );
  }

  for (const line of newLines) {
    const id = params.newProductId?.() || newUniqueId('prod');
    const next = addAccessoryStock(
      {
        id,
        code: line.code,
        name: line.name,
        category: 'accesorio',
        inventoryType: 'accesorio',
        supplier: line.supplier.trim(),
        costPrice: line.costPrice || 0,
        price: line.price || 0,
        stock: 0,
        color: 'bg-slate-800 text-white'
      },
      dest,
      line.qty
    );
    created.push(next);
    pieceCount += line.qty;
    movements.push(
      movementBase({
        product: next,
        destBranchId: dest,
        destBranchName,
        operatorName: params.operatorName,
        operatorId: params.operatorId,
        quantity: line.qty,
        type: 'creacion',
        details: `Paquete de ingreso: alta de ${next.name} e ingreso de ${line.qty} pza(s) en ${destBranchName}`,
        unitPrice: line.price || 0,
        costPrice: line.costPrice || 0
      })
    );
  }

  return {
    ok: true,
    created,
    updated,
    movements,
    destBranchId: dest,
    destBranchName,
    pieceCount,
    lineCount: qtyById.size + newLines.length
  };
}

export function applyEquipmentLote(params: {
  products: Product[];
  tickets?: SaleTicket[];
  lines: EquipmentLoteLine[];
  destBranchId: string;
  operatorName: string;
  operatorId?: string;
  newProductId?: () => string;
}): LoteApplyResult {
  if (!String(params.destBranchId || '').trim()) {
    return { ok: false, errors: [{ message: 'Elija la sucursal que recibe el paquete.' }] };
  }
  const errors = validateEquipmentLote(params.products, params.tickets, params.lines);
  if (errors.length) return { ok: false, errors };

  const dest = toInventoryBranchId(params.destBranchId);
  const destBranchName = getBranchDisplayName(dest);
  const usable = params.lines.filter(
    (line) => line.productId || line.name.trim() || (line.imeis || []).some((im) => im.trim())
  );

  const imeisById = new Map<string, string[]>();
  const newLines: EquipmentLoteLine[] = [];
  const extraCodes: string[] = [];

  for (const line of usable) {
    const imeis = (line.imeis || []).map(loteImeiCanonical).filter(Boolean);
    if (line.productId) {
      const prev = imeisById.get(line.productId) || [];
      for (const im of imeis) {
        if (!listHasImei(prev, im)) prev.push(im);
      }
      imeisById.set(line.productId, prev);
    } else {
      const code = line.code.trim().toUpperCase();
      if (code) extraCodes.push(code);
      newLines.push({ ...line, imeis, code, name: line.name.trim() });
    }
  }

  const updated: Product[] = [];
  const created: Product[] = [];
  const movements: LoteApplyOk['movements'] = [];
  let pieceCount = 0;

  for (const [id, imeis] of imeisById) {
    const prod = params.products.find((p) => p.id === id);
    if (!prod) continue;
    const next = addImeisToProduct(prod, dest, imeis);
    updated.push(next);
    pieceCount += imeis.length;
    movements.push(
      movementBase({
        product: next,
        destBranchId: dest,
        destBranchName,
        operatorName: params.operatorName,
        operatorId: params.operatorId,
        quantity: imeis.length,
        type: 'ingreso',
        details: `Paquete de ingreso: ${imeis.length} equipo(s) de ${next.name} con IMEI en ${destBranchName}`,
        imeis
      })
    );
  }

  for (const line of newLines) {
    const id = params.newProductId?.() || newUniqueId('prod');
    const code = line.code || nextEquipmentCode(params.products, line.name, extraCodes);
    extraCodes.push(code);
    const next = addImeisToProduct(
      {
        id,
        code,
        name: line.name,
        category: 'equipo_credito',
        inventoryType: 'equipo',
        supplier: line.supplier.trim(),
        costPrice: line.costPrice || 0,
        price: line.price || 0,
        stock: 0,
        color: 'bg-blue-800 text-white'
      },
      dest,
      line.imeis
    );
    created.push(next);
    pieceCount += line.imeis.length;
    movements.push(
      movementBase({
        product: next,
        destBranchId: dest,
        destBranchName,
        operatorName: params.operatorName,
        operatorId: params.operatorId,
        quantity: line.imeis.length,
        type: 'creacion',
        details: `Paquete de ingreso: alta de ${next.name} e ingreso de ${line.imeis.length} equipo(s) con IMEI en ${destBranchName}`,
        imeis: line.imeis,
        unitPrice: line.price || 0,
        costPrice: line.costPrice || 0
      })
    );
  }

  return {
    ok: true,
    created,
    updated,
    movements,
    destBranchId: dest,
    destBranchName,
    pieceCount,
    lineCount: imeisById.size + newLines.length
  };
}
