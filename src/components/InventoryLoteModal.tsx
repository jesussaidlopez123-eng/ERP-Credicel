import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  Package,
  Plus,
  ScanLine,
  Smartphone,
  Trash2,
  X
} from 'lucide-react';
import { InventoryMovement, Product, SaleTicket } from '../types';
import { ALL_BRANCHES, getBranchDisplayName } from '../data/initialBranches';
import ProductSearchSelect from './ProductSearchSelect';
import { accessoryStockAt } from '../lib/accessoryInventory';
import { imeisAtBranch } from '../lib/imeiInventory';
import {
  AccessoryLoteLine,
  EquipmentLoteLine,
  applyAccessoryLote,
  applyEquipmentLote,
  catalogForLote,
  emptyAccessoryLine,
  emptyEquipmentLine,
  loteImeiCanonical,
  loteImeiFormatError
} from '../lib/inventoryLote';

type Kind = 'accesorio' | 'equipo';

interface InventoryLoteModalProps {
  kind: Kind;
  products: Product[];
  salesTickets?: SaleTicket[];
  operatorName?: string;
  operatorId?: string;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onRecordMovement?: (movement: Omit<InventoryMovement, 'id' | 'timestamp'> | InventoryMovement) => void;
}

export default function InventoryLoteModal({
  kind,
  products,
  salesTickets = [],
  operatorName = 'Admin',
  operatorId,
  onClose,
  onAddProduct,
  onUpdateProduct,
  onRecordMovement
}: InventoryLoteModalProps) {
  const isEquipo = kind === 'equipo';
  const catalog = useMemo(() => catalogForLote(products, kind), [products, kind]);
  const [branchId, setBranchId] = useState('');
  const [accLines, setAccLines] = useState<AccessoryLoteLine[]>([emptyAccessoryLine()]);
  const [eqLines, setEqLines] = useState<EquipmentLoteLine[]>([emptyEquipmentLine()]);
  const [scanByLine, setScanByLine] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const scanRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const piecePreview = isEquipo
    ? eqLines.reduce((n, line) => n + line.imeis.filter(Boolean).length, 0)
    : accLines.reduce((n, line) => n + (Math.round(Number(line.qty) || 0) > 0 ? Math.round(Number(line.qty) || 0) : 0), 0);

  const fillExistingAcc = (key: string, productId: string) => {
    const prod = catalog.find((p) => p.id === productId);
    setAccLines((prev) =>
      prev.map((line) =>
        line.key !== key
          ? line
          : prod
            ? {
                ...line,
                productId,
                isNew: false,
                code: prod.code,
                name: prod.name,
                costPrice: prod.costPrice || 0,
                price: prod.price || 0,
                supplier: prod.supplier || ''
              }
            : { ...line, productId: '', isNew: false, code: '', name: '' }
      )
    );
    setErrors([]);
  };

  const fillExistingEq = (key: string, productId: string) => {
    const prod = catalog.find((p) => p.id === productId);
    setEqLines((prev) =>
      prev.map((line) =>
        line.key !== key
          ? line
          : prod
            ? {
                ...line,
                productId,
                isNew: false,
                code: prod.code,
                name: prod.name,
                costPrice: prod.costPrice || 0,
                price: prod.price || 0,
                supplier: prod.supplier || ''
              }
            : { ...line, productId: '', isNew: false, code: '', name: '' }
      )
    );
    setErrors([]);
  };

  const pushScannedImei = (key: string, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const format = loteImeiFormatError(value);
    if (format) {
      setErrors([format]);
      return;
    }
    const n = loteImeiCanonical(value);
    setEqLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        if (line.imeis.some((im) => loteImeiCanonical(im) === n)) return line;
        return { ...line, imeis: [...line.imeis, n] };
      })
    );
    setScanByLine((prev) => ({ ...prev, [key]: '' }));
    setErrors([]);
    requestAnimationFrame(() => scanRefs.current[key]?.focus());
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    const result = isEquipo
      ? applyEquipmentLote({
          products,
          tickets: salesTickets,
          lines: eqLines,
          destBranchId: branchId,
          operatorName,
          operatorId
        })
      : applyAccessoryLote({
          products,
          lines: accLines,
          destBranchId: branchId,
          operatorName,
          operatorId
        });

    if (result.ok === false) {
      setErrors(result.errors.map((err) => err.message));
      return;
    }

    for (const product of result.updated) onUpdateProduct(product);
    for (const product of result.created) onAddProduct(product);
    for (const movement of result.movements) onRecordMovement?.(movement);

    const extra = result.created.length
      ? ` · ${result.created.length} modelo${result.created.length === 1 ? '' : 's'} nuevo${result.created.length === 1 ? '' : 's'}`
      : '';
    setDone(
      `Entraron ${result.pieceCount} ${isEquipo ? 'equipo' : 'pieza'}${result.pieceCount === 1 ? '' : 's'} a ${result.destBranchName} en ${result.lineCount} renglón${result.lineCount === 1 ? '' : 'es'}${extra}.`
    );
    setAccLines([emptyAccessoryLine()]);
    setEqLines([emptyEquipmentLine()]);
    setScanByLine({});
    setErrors([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-visible animate-in fade-in zoom-in-95 duration-150 my-4">
        <div className={`flex items-center justify-between px-5 py-4 text-white rounded-t-2xl ${isEquipo ? 'bg-blue-900' : 'bg-emerald-800'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-5 h-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h3 className="font-extrabold text-base truncate">
                Paquete de ingreso · {isEquipo ? 'Equipos' : 'Accesorios'}
              </h3>
              <p className="text-[11px] text-white/80">
                Varios renglones a una sola sucursal. {isEquipo ? 'Cada celular lleva su IMEI.' : 'Las piezas se suman al stock de esa tienda.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Sucursal que recibe *</label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setErrors([]);
                  setDone(null);
                }}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
              >
                <option value="">Seleccionar sucursal…</option>
                {ALL_BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${isEquipo ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
              {isEquipo ? <Smartphone className="w-4 h-4 text-blue-800" /> : <Headphones className="w-4 h-4 text-emerald-800" />}
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-500">En este paquete</p>
                <p className="text-sm font-black text-slate-900">
                  {piecePreview} {isEquipo ? 'IMEI' : 'pieza'}{piecePreview === 1 ? '' : 's'}
                  {branchId ? ` → ${getBranchDisplayName(branchId)}` : ''}
                </p>
              </div>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 space-y-1">
              <p className="font-extrabold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                No se ingresó el paquete
              </p>
              {errors.slice(0, 6).map((message, idx) => (
                <p key={`${idx}-${message}`} className="text-[11px] font-medium">
                  • {message}
                </p>
              ))}
            </div>
          )}

          {done && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 font-bold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{done} Puede armar otro paquete o cerrar.</span>
            </div>
          )}

          <div className="space-y-3 max-h-[50vh] overflow-y-auto overflow-x-hidden pr-1">
            {isEquipo
              ? eqLines.map((line, idx) => {
                  const prod = catalog.find((p) => p.id === line.productId);
                  const atBranch = prod && branchId ? imeisAtBranch(prod, branchId).length : 0;
                  return (
                    <div key={line.key} className="border border-blue-200 rounded-2xl p-3 bg-blue-50/40 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-blue-900">Renglón {idx + 1}</p>
                        {eqLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEqLines((prev) => prev.filter((row) => row.key !== line.key))}
                            className="text-[10px] font-extrabold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Quitar
                          </button>
                        )}
                      </div>
                      <ProductSearchSelect
                        products={catalog}
                        value={line.isNew ? '__nuevo__' : line.productId}
                        autoFocus={idx === 0}
                        onChange={(id) => {
                          if (id === '__nuevo__') {
                            setEqLines((prev) =>
                              prev.map((row) =>
                                row.key === line.key
                                  ? {
                                      ...row,
                                      productId: '',
                                      isNew: true,
                                      code: '',
                                      name: '',
                                      costPrice: 0,
                                      price: 0,
                                      supplier: ''
                                    }
                                  : row
                              )
                            );
                            return;
                          }
                          fillExistingEq(line.key, id);
                        }}
                        placeholder="Escribe el modelo o unas letras…"
                        emptyLabel="No hay modelos de equipo"
                        getLabel={(p) =>
                          `[${p.code}] ${p.name}${branchId ? ` · ${getBranchDisplayName(branchId)} ${imeisAtBranch(p, branchId).length}` : ''}`
                        }
                        extraOptions={[{ id: '__nuevo__', label: '+ Registrar modelo nuevo en este renglón' }]}
                      />
                      {line.isNew && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={line.name}
                            onChange={(e) =>
                              setEqLines((prev) => prev.map((row) => (row.key === line.key ? { ...row, name: e.target.value } : row)))
                            }
                            placeholder="Modelo *  Ej. Samsung A16 128GB"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                          <input
                            value={line.code}
                            onChange={(e) =>
                              setEqLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, code: e.target.value.toUpperCase() } : row))
                              )
                            }
                            placeholder="Código (opcional)"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold uppercase"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={line.costPrice || ''}
                            onChange={(e) =>
                              setEqLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, costPrice: parseFloat(e.target.value) || 0 } : row))
                              )
                            }
                            placeholder="Costo"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={line.price || ''}
                            onChange={(e) =>
                              setEqLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, price: parseFloat(e.target.value) || 0 } : row))
                              )
                            }
                            placeholder="Precio de venta"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                      )}
                      {prod && branchId && (
                        <p className="text-[10px] font-bold text-slate-500">
                          Hoy en {getBranchDisplayName(branchId)}: {atBranch} IMEI{atBranch === 1 ? '' : 's'}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {line.imeis.length === 0 && (
                          <span className="text-[11px] italic text-slate-400">Sin IMEI en este renglón.</span>
                        )}
                        {line.imeis.map((imei) => (
                          <span
                            key={imei}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-blue-200 font-mono text-[10px] font-bold text-blue-950"
                          >
                            {imei}
                            <button
                              type="button"
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              onClick={() =>
                                setEqLines((prev) =>
                                  prev.map((row) =>
                                    row.key === line.key ? { ...row, imeis: row.imeis.filter((im) => im !== imei) } : row
                                  )
                                )
                              }
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="relative">
                        <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={(el) => {
                            scanRefs.current[line.key] = el;
                          }}
                          value={scanByLine[line.key] || ''}
                          onChange={(e) => setScanByLine((prev) => ({ ...prev, [line.key]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            pushScannedImei(line.key, scanByLine[line.key] || '');
                          }}
                          placeholder="Escanee o escriba IMEI y pulse Enter"
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                      <p className="text-[10px] font-extrabold text-blue-900">
                        {line.imeis.length} equipo{line.imeis.length === 1 ? '' : 's'} en este renglón
                      </p>
                    </div>
                  );
                })
              : accLines.map((line, idx) => {
                  const prod = catalog.find((p) => p.id === line.productId);
                  const atBranch = prod && branchId ? accessoryStockAt(prod, branchId) : 0;
                  return (
                    <div key={line.key} className="border border-emerald-200 rounded-2xl p-3 bg-emerald-50/40 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-900">Renglón {idx + 1}</p>
                        {accLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setAccLines((prev) => prev.filter((row) => row.key !== line.key))}
                            className="text-[10px] font-extrabold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Quitar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-2">
                        <ProductSearchSelect
                          products={catalog}
                          value={line.isNew ? '__nuevo__' : line.productId}
                          onChange={(id) => {
                            if (id === '__nuevo__') {
                              setAccLines((prev) =>
                                prev.map((row) =>
                                  row.key === line.key
                                    ? {
                                        ...row,
                                        productId: '',
                                        isNew: true,
                                        code: '',
                                        name: '',
                                        costPrice: 0,
                                        price: 0,
                                        supplier: ''
                                      }
                                    : row
                                )
                              );
                              return;
                            }
                            fillExistingAcc(line.key, id);
                          }}
                          placeholder="Escribe el accesorio o elige de la lista…"
                          emptyLabel="No hay accesorios"
                          getLabel={(p) =>
                            `[${p.code}] ${p.name}${branchId ? ` · ${getBranchDisplayName(branchId)} ${accessoryStockAt(p, branchId)}` : ''}`
                          }
                          extraOptions={[{ id: '__nuevo__', label: '+ Registrar accesorio nuevo en este renglón' }]}
                        />
                        <input
                          type="number"
                          min={1}
                          value={line.qty || ''}
                          onChange={(e) =>
                            setAccLines((prev) =>
                              prev.map((row) => (row.key === line.key ? { ...row, qty: parseInt(e.target.value, 10) || 0 } : row))
                            )
                          }
                          placeholder="Cant."
                          className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-center"
                        />
                      </div>
                      {line.isNew && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={line.code}
                            onChange={(e) =>
                              setAccLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, code: e.target.value.toUpperCase() } : row))
                              )
                            }
                            placeholder="Código *"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold uppercase"
                          />
                          <input
                            value={line.name}
                            onChange={(e) =>
                              setAccLines((prev) => prev.map((row) => (row.key === line.key ? { ...row, name: e.target.value } : row)))
                            }
                            placeholder="Nombre *"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={line.costPrice || ''}
                            onChange={(e) =>
                              setAccLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, costPrice: parseFloat(e.target.value) || 0 } : row))
                              )
                            }
                            placeholder="Costo"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={line.price || ''}
                            onChange={(e) =>
                              setAccLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, price: parseFloat(e.target.value) || 0 } : row))
                              )
                            }
                            placeholder="Precio de venta"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                      )}
                      {prod && branchId && (
                        <p className="text-[10px] font-bold text-slate-500">
                          Hoy en {getBranchDisplayName(branchId)}: {atBranch} pza{atBranch === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  );
                })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isEquipo) setEqLines((prev) => [...prev, emptyEquipmentLine()]);
              else setAccLines((prev) => [...prev, emptyAccessoryLine()]);
            }}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
              isEquipo
                ? 'border-blue-300 text-blue-900 bg-blue-50 hover:bg-blue-100'
                : 'border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar renglón
          </button>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer ${
                isEquipo ? 'bg-blue-800 hover:bg-blue-900' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              Ingresar paquete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
