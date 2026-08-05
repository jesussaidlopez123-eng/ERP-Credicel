import React, { useState } from 'react';
import { Smartphone, DollarSign, User, Phone, X, CheckCircle2, Hash, CreditCard, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Product, CartItemMetadata, Branch } from '../types';

interface CreditDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products?: Product[];
  currentBranch?: Branch | null;
  onConfirm: (product: Product, amount: number, metadata: CartItemMetadata) => void;
}

export default function CreditDeviceModal({
  isOpen,
  onClose,
  product,
  products = [],
  currentBranch,
  onConfirm
}: CreditDeviceModalProps) {
  const [platform, setPlatform] = useState('PayJoy');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');
  const [fullPriceInput, setFullPriceInput] = useState<string>('');
  const [downPayment, setDownPayment] = useState<string>('500');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const activeBranchId = currentBranch?.id || 'b-bodega';
  const availableEquipos = products.filter(
    (p) => (p.inventoryType === 'equipo' || p.category === 'equipo_credito' || p.category === 'telefonia') && p.id !== 'prod-equipo-credito-gen'
  );

  const selectedEquipment = availableEquipos.find((p) => p.id === selectedProdId);

  // Helper function to check IMEI in system
  const checkImeiInSystem = (cleanImei: string) => {
    if (!cleanImei || cleanImei.length < 10) return { found: false, product: null, otherBranch: null };

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

  // When model selected from dropdown, automatically update model name and price
  const handleSelectModelChange = (prodId: string) => {
    setSelectedProdId(prodId);
    setValidationError(null);
    const eq = availableEquipos.find((p) => p.id === prodId);
    if (eq) {
      setDeviceModel(eq.name);
      setFullPriceInput(eq.price ? eq.price.toString() : '0');
    } else {
      setDeviceModel('');
      setFullPriceInput('');
    }
  };

  // Handle IMEI input change with auto-corroboration
  const handleImeiChange = (value: string) => {
    const cleanVal = value.toUpperCase().trim();
    setImei(cleanVal);
    setValidationError(null);

    if (cleanVal.length >= 10) {
      const res = checkImeiInSystem(cleanVal);
      if (res.found && res.product) {
        setSelectedProdId(res.product.id);
        setDeviceModel(res.product.name);
        setFullPriceInput(res.product.price ? res.product.price.toString() : '0');
      }
    }
  };

  const parsedFullPrice = parseFloat(fullPriceInput) || (selectedEquipment?.price || 0);
  const parsedDownPayment = parseFloat(downPayment) || 0;
  const calculatedRemainingBalance = Math.max(0, parsedFullPrice - parsedDownPayment);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanImei = imei.trim().toUpperCase();
    const engancheAmount = parseFloat(downPayment) || 0;

    if (!platform.trim()) {
      alert('Por favor especifica la plataforma de financiamiento.');
      return;
    }
    if (!clientName.trim()) {
      alert('Por favor ingresa el nombre del cliente.');
      return;
    }
    if (!deviceModel.trim()) {
      alert('Por favor ingresa el modelo del equipo.');
      return;
    }
    if (!cleanImei || cleanImei.length < 10) {
      setValidationError('Por favor ingresa un número de IMEI válido de al menos 10 o 15 dígitos.');
      return;
    }
    if (engancheAmount <= 0) {
      alert('Por favor ingresa un monto de enganche válido.');
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
          `❌ VENTA BLOQUEADA: El IMEI '${cleanImei}' NO existe en el sistema. Debe registrar el equipo en el inventario del Módulo 2 antes de poder venderlo.`
        );
      }
      return;
    }

    const foundValidProduct = check.product;
    const totalEquipmentPrice = parseFloat(fullPriceInput) || foundValidProduct.price || 0;
    const financedBalance = Math.max(0, totalEquipmentPrice - engancheAmount);

    onConfirm(
      {
        ...foundValidProduct,
        name: `Enganche ${deviceModel} (${platform.trim()})`,
        price: engancheAmount,
      },
      engancheAmount,
      {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deviceModel: deviceModel.trim(),
        imei: cleanImei,
        downPayment: engancheAmount,
        fullPrice: totalEquipmentPrice,
        remainingBalance: financedBalance,
        financingPlatform: platform.trim(),
      }
    );

    // Reset
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-900 text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-300" />
            <div>
              <h3 className="font-bold text-base">Venta de Equipo a Crédito</h3>
              <p className="text-[11px] text-indigo-200">Registro de Enganche y Datos de Financiamiento</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Validation Banner if IMEI invalid */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 font-semibold animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-rose-950">Validación de Inventario Fallida</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug">{validationError}</p>
              </div>
            </div>
          )}

          {/* Quick Select Available Model from Active Inventory */}
          {availableEquipos.length > 0 && (
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200">
              <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-700" />
                  Seleccionar Modelo del Inventario ({currentBranch?.name || 'Sucursal'})
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-mono font-bold">
                  {availableEquipos.length} modelos
                </span>
              </label>
              <select
                value={selectedProdId}
                onChange={(e) => handleSelectModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="">-- Escoger del inventario activo --</option>
                {availableEquipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} - ${eq.price ? eq.price.toFixed(2) : '0.00'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Manual Platform Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              Plataforma / Empresa de Financiamiento
            </label>
            <input
              type="text"
              required
              placeholder="Ej. PayJoy, Macropay, CrediCel, Paguitos, DMI, etc."
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Nombre del Cliente
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Roberto Sánchez"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Ej. 5588776655"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Device & IMEI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                Modelo del Equipo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Samsung Galaxy A15 128GB"
                value={deviceModel}
                onChange={(e) => {
                  setDeviceModel(e.target.value);
                  setValidationError(null);
                  // Auto-lookup price if model name matches an inventory item
                  const matched = availableEquipos.find(
                    (p) => p.name.toLowerCase().trim() === e.target.value.toLowerCase().trim()
                  );
                  if (matched && matched.price) {
                    setFullPriceInput(matched.price.toString());
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-indigo-600" />
                Escanear / Ingresar IMEI *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                placeholder="351234567890123"
                value={imei}
                onChange={(e) => handleImeiChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:outline-none ${
                  cleanImeiInput.length >= 10
                    ? imeiCheckResult.found
                      ? 'border-emerald-500 bg-emerald-50/50 focus:ring-emerald-500'
                      : 'border-rose-500 bg-rose-50/50 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-indigo-600'
                }`}
              />
            </div>
          </div>

          {/* System IMEI Verification Feedback */}
          {cleanImeiInput.length >= 10 && (
            <div>
              {imeiCheckResult.found && imeiCheckResult.product ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ✓ IMEI Corroborado en Sistema: <span className="underline">{imeiCheckResult.product.name}</span> (${imeiCheckResult.product.price.toFixed(2)})
                  </span>
                </div>
              ) : imeiCheckResult.otherBranch ? (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    ⚠️ Pertenece a sucursal {imeiCheckResult.otherBranch}. Se requiere traspaso a {currentBranch?.name || 'sucursal actual'}.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-xs text-rose-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    ❌ IMEI NO ENCONTRADO EN SISTEMA: Este IMEI no existe registrado en el inventario.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Prices & Financing Balance Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-slate-600" />
                  Precio Venta Total
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Automático
                </span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={fullPriceInput}
                onChange={(e) => setFullPriceInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Precio completo de lista asignado al modelo.</p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-amber-900 mb-1 flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-amber-700" />
                Enganche Recibido en Caja ($) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="Ej. 600"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                className="w-full px-3 py-2 bg-amber-50/80 border border-amber-300 rounded-xl text-sm font-black text-amber-950 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <p className="text-[10px] text-amber-700 mt-1">Pago inicial a cobrar en caja.</p>
            </div>
          </div>


          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Registrar Enganche
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
