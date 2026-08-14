import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  DollarSign, 
  User, 
  Phone, 
  X, 
  CheckCircle2, 
  Hash, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  Banknote,
  ShieldCheck,
  Zap,
  Building2
} from 'lucide-react';
import { Product, CartItemMetadata, Branch } from '../types';

interface CreditDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products?: Product[];
  currentBranch?: Branch | null;
  onConfirm: (product: Product, amount: number, metadata: CartItemMetadata) => void;
}

const COMMON_PLATFORMS = ['PayJoy', 'Macropay', 'CrediCel', 'Paguitos', 'DMI', 'Platita', 'Krediti'];

export default function CreditDeviceModal({
  isOpen,
  onClose,
  product,
  products = [],
  currentBranch,
  onConfirm
}: CreditDeviceModalProps) {
  // Mode: 'credito' vs 'contado'
  const [saleMode, setSaleMode] = useState<'credito' | 'contado'>('credito');
  const [platform, setPlatform] = useState('PayJoy');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');
  const [fullPriceInput, setFullPriceInput] = useState<string>('');
  const [downPayment, setDownPayment] = useState<string>('500');
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeBranchId = currentBranch?.id || 'b-bodega';

  // Filter real equipment products from inventory (excluding generic action buttons)
  const availableEquipos = products.filter(
    (p) => 
      (p.inventoryType === 'equipo' || p.category === 'equipo_credito' || p.category === 'telefonia') && 
      p.id !== 'prod-equipo-credito-gen' &&
      p.id !== 'prod-abono-gen'
  );

  const selectedEquipment = availableEquipos.find((p) => p.id === selectedProdId);

  // Helper function to check IMEI in system
  const checkImeiInSystem = (cleanImei: string) => {
    if (!cleanImei || cleanImei.length < 8) return { found: false, product: null, otherBranch: null };

    let foundProduct: Product | null = null;
    let otherBranchName: string | null = null;

    for (const p of products) {
      if (p.inventoryType === 'equipo' || p.category === 'equipo_credito' || p.category === 'telefonia') {
        const branchImeis = p.branchImeiMap?.[activeBranchId] || [];
        const allImeis = p.imeiList || (p.imei ? [p.imei] : []);

        if (branchImeis.some((im) => im.toUpperCase() === cleanImei)) {
          foundProduct = p;
          break;
        }

        // Check in other branches
        if (p.branchImeiMap) {
          for (const [bId, imList] of Object.entries(p.branchImeiMap)) {
            if (imList.some((im) => im.toUpperCase() === cleanImei)) {
              otherBranchName = bId === 'b-bodega' ? 'Bodega' : bId === 'b-navojoa' ? 'Navojoa' : 'Huatabampo';
            }
          }
        } else if (allImeis.some((im) => im.toUpperCase() === cleanImei)) {
          foundProduct = p;
        }
      }
    }

    return { found: !!foundProduct, product: foundProduct, otherBranch: otherBranchName };
  };

  const cleanImeiInput = imei.trim().toUpperCase();
  const imeiCheckResult = checkImeiInSystem(cleanImeiInput);

  // Auto-fill full price when model changes or mode switches
  const handleSelectModelChange = (prodId: string) => {
    setSelectedProdId(prodId);
    setValidationError(null);
    const eq = availableEquipos.find((p) => p.id === prodId);
    if (eq) {
      setDeviceModel(eq.name);
      const priceStr = eq.price ? eq.price.toString() : '0';
      setFullPriceInput(priceStr);
      if (saleMode === 'contado') {
        setDownPayment(priceStr);
      }
    } else {
      setDeviceModel('');
      setFullPriceInput('');
    }
  };

  // Switch between Contado and Crédito
  const handleSwitchSaleMode = (mode: 'credito' | 'contado') => {
    setSaleMode(mode);
    setValidationError(null);
    const currentPrice = parseFloat(fullPriceInput) || selectedEquipment?.price || 0;
    if (mode === 'contado') {
      setPlatform('Contado');
      if (currentPrice > 0) {
        setDownPayment(currentPrice.toString());
      }
    } else {
      if (platform === 'Contado') {
        setPlatform('PayJoy');
      }
      setDownPayment('500');
    }
  };

  // Handle IMEI input change with auto-corroboration
  const handleImeiChange = (value: string) => {
    const cleanVal = value.toUpperCase().trim();
    setImei(cleanVal);
    setValidationError(null);

    if (cleanVal.length >= 8) {
      const res = checkImeiInSystem(cleanVal);
      if (res.found && res.product) {
        setSelectedProdId(res.product.id);
        setDeviceModel(res.product.name);
        const priceStr = res.product.price ? res.product.price.toString() : '0';
        setFullPriceInput(priceStr);
        if (saleMode === 'contado') {
          setDownPayment(priceStr);
        }
      }
    }
  };

  const parsedFullPrice = parseFloat(fullPriceInput) || (selectedEquipment?.price || 0);
  const parsedDownPayment = parseFloat(downPayment) || 0;
  const calculatedRemainingBalance = saleMode === 'contado' ? 0 : Math.max(0, parsedFullPrice - parsedDownPayment);

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanImei = imei.trim().toUpperCase();
    const totalEquipmentPrice = parseFloat(fullPriceInput) || (selectedEquipment?.price || 0);
    const engancheAmount = saleMode === 'contado' ? totalEquipmentPrice : (parseFloat(downPayment) || 0);

    if (saleMode === 'credito' && !platform.trim()) {
      alert('Por favor especifica la plataforma de financiamiento.');
      return;
    }
    if (!clientName.trim()) {
      alert('Por favor ingresa el nombre del cliente para la garantía o contrato.');
      return;
    }
    if (!deviceModel.trim()) {
      alert('Por favor ingresa o selecciona el modelo del equipo.');
      return;
    }
    if (!cleanImei || cleanImei.length < 8) {
      setValidationError('Por favor ingresa un número de IMEI válido (mínimo 8-15 dígitos).');
      return;
    }
    if (engancheAmount <= 0) {
      alert('Por favor ingresa un monto válido a cobrar en caja.');
      return;
    }

    // STRICT SYSTEM CHECK: IMEI MUST EXIST IN SYSTEM TO SELL IT
    const check = checkImeiInSystem(cleanImei);
    if (!check.found || !check.product) {
      if (check.otherBranch) {
        setValidationError(
          `❌ VENTA BLOQUEADA: El IMEI '${cleanImei}' pertenece a la sucursal ${check.otherBranch}. Se requiere realizar un traspaso formal a ${currentBranch?.name || activeBranchId} antes de realizar la venta.`
        );
      } else {
        setValidationError(
          `❌ VENTA BLOQUEADA: El IMEI '${cleanImei}' NO existe en el inventario activo. Debe registrar el equipo en el inventario del Módulo 2 antes de poder venderlo.`
        );
      }
      return;
    }

    const foundValidProduct = check.product;
    const finalPlatform = saleMode === 'contado' ? 'Contado' : platform.trim();
    const financedBalance = saleMode === 'contado' ? 0 : Math.max(0, totalEquipmentPrice - engancheAmount);

    const itemName = saleMode === 'contado' 
      ? `${deviceModel} (Contado)` 
      : `Enganche ${deviceModel} (${finalPlatform})`;

    onConfirm(
      {
        ...foundValidProduct,
        name: itemName,
        price: engancheAmount,
      },
      engancheAmount,
      {
        saleType: saleMode,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deviceModel: deviceModel.trim(),
        imei: cleanImei,
        downPayment: engancheAmount,
        fullPrice: totalEquipmentPrice,
        remainingBalance: financedBalance,
        financingPlatform: finalPlatform,
      }
    );

    // Reset Form
    setClientName('');
    setClientPhone('');
    setDeviceModel('');
    setImei('');
    setFullPriceInput('');
    setSelectedProdId('');
    setDownPayment('500');
    setValidationError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 text-white ${saleMode === 'contado' ? 'bg-emerald-800' : 'bg-indigo-900'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">
                Venta de Equipo Celular
              </h3>
              <p className="text-[11px] text-white/80">
                {saleMode === 'contado' ? 'Modalidad: Pago de Contado (100%)' : 'Modalidad: Crédito / Enganche + Financiera'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (Contado vs Crédito) */}
        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Tipo de Venta de Equipo
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleSwitchSaleMode('credito')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                saleMode === 'credito'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>A Crédito (Financiera)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSaleMode('contado')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                saleMode === 'contado'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>De Contado (100% Pago)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Validation Banner if IMEI invalid */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 font-semibold animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-rose-950">Validación de Inventario Bloqueada</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug">{validationError}</p>
              </div>
            </div>
          )}

          {/* Quick Select Available Model from Active Inventory */}
          {availableEquipos.length > 0 ? (
            <div className={`p-3 rounded-xl border ${saleMode === 'contado' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-indigo-50/70 border-indigo-200'}`}>
              <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-700" />
                  Seleccionar Equipo del Inventario ({currentBranch?.name || 'Sucursal'})
                </span>
                <span className="text-[10px] text-slate-700 bg-white px-2 py-0.5 rounded-md font-mono font-bold border border-slate-200">
                  {availableEquipos.length} modelos en stock
                </span>
              </label>
              <select
                value={selectedProdId}
                onChange={(e) => handleSelectModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-600 focus:outline-none"
              >
                <option value="">-- Seleccionar modelo disponible en inventario --</option>
                {availableEquipos.map((eq) => {
                  const bStock = eq.branchStock?.[activeBranchId] ?? eq.stock ?? 0;
                  return (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} - ${eq.price ? eq.price.toFixed(2) : '0.00'} (Stock: {bStock})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>No hay celulares surtidos en esta sucursal. Registre o surta equipos en el <strong>Módulo 2 (Inventario)</strong>.</span>
            </div>
          )}

          {/* If Crédito: Platform Picker / Chips */}
          {saleMode === 'credito' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Empresa / Financiera de Crédito *
              </label>
              
              {/* Quick Chip Selector */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {COMMON_PLATFORMS.map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setPlatform(plat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      platform === plat
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                required
                placeholder="O escribe otra financiera (Ej. PayJoy, Macropay, etc.)"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          )}

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600" />
                Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez García"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-600" />
                Teléfono del Cliente
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Ej. 6421234567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Device Model & Scan IMEI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                Modelo del Celular *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Samsung Galaxy A15"
                value={deviceModel}
                onChange={(e) => {
                  setDeviceModel(e.target.value);
                  setValidationError(null);
                  const matched = availableEquipos.find(
                    (p) => p.name.toLowerCase().trim() === e.target.value.toLowerCase().trim()
                  );
                  if (matched && matched.price) {
                    const priceStr = matched.price.toString();
                    setFullPriceInput(priceStr);
                    if (saleMode === 'contado') {
                      setDownPayment(priceStr);
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-600" />
                Escanear / Ingresar IMEI *
              </label>
              <input
                type="text"
                required
                maxLength={18}
                placeholder="Escanee o teclee IMEI"
                value={imei}
                onChange={(e) => handleImeiChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:outline-none ${
                  cleanImeiInput.length >= 8
                    ? imeiCheckResult.found
                      ? 'border-emerald-500 bg-emerald-50/50 focus:ring-emerald-500'
                      : 'border-rose-500 bg-rose-50/50 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-slate-600'
                }`}
              />
            </div>
          </div>

          {/* IMEI Verification Status */}
          {cleanImeiInput.length >= 8 && (
            <div>
              {imeiCheckResult.found && imeiCheckResult.product ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-950 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ✓ IMEI Verificado en {currentBranch?.name || 'Sucursal'}: <strong className="underline">{imeiCheckResult.product.name}</strong> (${imeiCheckResult.product.price.toFixed(2)})
                  </span>
                </div>
              ) : imeiCheckResult.otherBranch ? (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-950 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    ⚠️ IMEI registrado en {imeiCheckResult.otherBranch}. Se requiere traspaso a {currentBranch?.name || 'sucursal actual'}.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-xs text-rose-950 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    ❌ IMEI NO EXISTE EN INVENTARIO: Registre el equipo en el Módulo 2 (Inventario) primero.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pricing & Enganche / Contado Breakdown */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Precio Total del Equipo ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={fullPriceInput}
                    onChange={(e) => {
                      setFullPriceInput(e.target.value);
                      if (saleMode === 'contado') {
                        setDownPayment(e.target.value);
                      }
                    }}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-black mb-1 ${saleMode === 'contado' ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {saleMode === 'contado' ? 'Monto a Cobrar de Contado ($)' : 'Enganche Recibido en Caja ($) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                    className={`w-full pl-7 pr-3 py-2 border rounded-xl text-sm font-black focus:outline-none ${
                      saleMode === 'contado'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                        : 'bg-amber-50 border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Live Financial Summary */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
              <div className="text-slate-600 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Modalidad: <strong className="uppercase text-slate-900">{saleMode}</strong></span>
              </div>
              
              {saleMode === 'credito' ? (
                <div className="text-right">
                  <span className="text-slate-500 text-[11px]">Saldo Financiado ({platform}): </span>
                  <span className="font-mono font-black text-indigo-700 text-sm">
                    ${calculatedRemainingBalance.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="text-right text-emerald-700 font-bold text-xs">
                  ✓ Equipo Liquidado al 100%
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all ${
                saleMode === 'contado'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {saleMode === 'contado' ? 'Cobrar Celular de Contado' : 'Registrar Enganche de Crédito'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
