import React, { useState } from 'react';
import { Wrench, User, Phone, Smartphone, DollarSign, FileText, CheckCircle2, Search, X, Lock, Clock, PackageCheck, AlertCircle } from 'lucide-react';
import { RepairRecord, Product, CartItemMetadata, Branch, Operator } from '../types';

interface RepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  repairRecords: RepairRecord[];
  onAddRepairRecord: (record: RepairRecord) => void;
  onUpdateRepairRecord: (record: RepairRecord) => void;
  onAddToCart: (product: Product, amount: number, metadata?: CartItemMetadata) => void;
  currentBranch: Branch;
  currentOperator: Operator;
}

export default function RepairModal({
  isOpen,
  onClose,
  repairRecords,
  onAddRepairRecord,
  onUpdateRepairRecord,
  onAddToCart,
  currentBranch,
  currentOperator
}: RepairModalProps) {
  // Active Tab: 'recepcion' (Dejar Celular) or 'entrega' (Entregar Celular)
  const [activeTab, setActiveTab] = useState<'recepcion' | 'entrega'>('recepcion');

  // FORM FIELDS FOR RECEPCION (Dejar Celular)
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [passcodePattern, setPasscodePattern] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [totalCost, setTotalCost] = useState<string>('');
  const [advancePayment, setAdvancePayment] = useState<string>('');

  // SEARCH FILTER FOR ENTREGA
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  // Handle Reception Submit (Dejar Celular)
  const handleRecepcionSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      alert('Por favor ingresa el nombre del cliente.');
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, '').length < 10) {
      alert('Por favor ingresa un teléfono de contacto válido de 10 dígitos.');
      return;
    }
    if (!deviceModel.trim()) {
      alert('Por favor ingresa el modelo o marca del equipo.');
      return;
    }
    if (!issueDescription.trim()) {
      alert('Por favor describe la falla o reparación a realizar.');
      return;
    }

    const numTotal = parseFloat(totalCost) || 0;
    const numAdvance = parseFloat(advancePayment) || 0;

    if (numAdvance > numTotal) {
      alert('El anticipo no puede ser mayor que el costo total de la reparación.');
      return;
    }

    const folioId = `REP-${Math.floor(1000 + Math.random() * 9000)}`;
    const pendingBalance = Math.max(0, numTotal - numAdvance);

    const newRepair: RepairRecord = {
      id: folioId,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      deviceModel: deviceModel.trim(),
      passcodePattern: passcodePattern.trim() || 'Sin contraseña / Desbloqueado',
      issueDescription: issueDescription.trim(),
      totalCost: numTotal,
      advancePayment: numAdvance,
      pendingBalance,
      status: 'en_taller',
      receivedAt: new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      operatorName: currentOperator.name,
      branchId: currentBranch.id
    };

    onAddRepairRecord(newRepair);

    // If an advance payment was made, add it to POS cart
    if (numAdvance > 0) {
      const repairProduct: Product = {
        id: `prod-rep-${Date.now()}`,
        code: folioId,
        name: `Anticipo Reparación (${folioId}) - ${deviceModel.trim()}`,
        category: 'servicio',
        price: numAdvance,
        stock: 1
      };

      onAddToCart(repairProduct, numAdvance, {
        repairId: folioId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deviceModel: deviceModel.trim(),
        issueDescription: issueDescription.trim(),
        repairType: 'anticipo',
        advancePayment: numAdvance,
        totalRepairCost: numTotal
      });
      alert(`✅ Equipo recibido con éxito (Folio ${folioId}). Se agregó el anticipo de $${numAdvance} MXN al ticket del POS.`);
    } else {
      alert(`✅ Equipo recibido con éxito (Folio ${folioId}) sin anticipo. Se guardó el registro en taller.`);
    }

    // Reset Form
    setClientName('');
    setClientPhone('');
    setDeviceModel('');
    setPasscodePattern('');
    setIssueDescription('');
    setTotalCost('');
    setAdvancePayment('');
    onClose();
  };

  // Handle Deliver Equipment (Cobrar Saldo y Entregar)
  const handleDeliverEquipment = (record: RepairRecord) => {
    const amountToCharge = record.pendingBalance;

    if (amountToCharge <= 0) {
      // Mark as delivered without charging
      const updatedRecord: RepairRecord = {
        ...record,
        status: 'entregado',
        pendingBalance: 0,
        deliveredAt: new Date().toLocaleString()
      };
      onUpdateRepairRecord(updatedRecord);
      alert(`✅ El equipo ${record.deviceModel} (Folio ${record.id}) ha sido marcado como Entregado.`);
      return;
    }

    // Add remaining balance to POS cart
    const repairProduct: Product = {
      id: `prod-rep-deliv-${Date.now()}`,
      code: record.id,
      name: `Saldo Final Reparación (${record.id}) - ${record.deviceModel}`,
      category: 'servicio',
      price: amountToCharge,
      stock: 1
    };

    onAddToCart(repairProduct, amountToCharge, {
      repairId: record.id,
      clientName: record.clientName,
      clientPhone: record.clientPhone,
      deviceModel: record.deviceModel,
      issueDescription: record.issueDescription,
      repairType: 'saldo_final',
      advancePayment: record.advancePayment,
      totalRepairCost: record.totalCost
    });

    // Update record status
    const updatedRecord: RepairRecord = {
      ...record,
      status: 'entregado',
      pendingBalance: 0,
      deliveredAt: new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    onUpdateRepairRecord(updatedRecord);

    alert(`✅ Se agregó el saldo pendiente de $${amountToCharge} MXN al ticket del POS y el equipo fue marcado como Entregado.`);
    onClose();
  };

  // Pending repairs in shop
  const pendingRepairs = repairRecords.filter((r) => {
    if (r.status === 'entregado') return false;
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      r.deviceModel.toLowerCase().includes(q) ||
      r.clientPhone.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-amber-600 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-amber-200" />
            <div>
              <h3 className="font-bold text-base">Servicio Técnico & Reparaciones</h3>
              <p className="text-[11px] text-amber-100">Recepción y Entrega de Equipos de Clientes</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-amber-100 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('recepcion')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'recepcion'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4" />
            1. Recepción / Dejar Celular
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('entrega')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'entrega'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            2. Entrega de Equipo ({repairRecords.filter(r => r.status !== 'entregado').length})
          </button>
        </div>

        {/* TAB 1: RECEPCION DE EQUIPO */}
        {activeTab === 'recepcion' && (
          <form onSubmit={handleRecepcionSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            
            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900 font-medium">
              Completa la información del cliente y del celular para registrar la recepción en el taller.
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. María Elena Torres"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  Teléfono de Contacto (10 dígitos)
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Ej. 5511223344"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Device Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  Modelo / Marca del Equipo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. iPhone 12 Pro Max 128GB"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Contraseña / Patrón de Desbloqueo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. PIN 1234 o Patrón Z"
                  value={passcodePattern}
                  onChange={(e) => setPasscodePattern(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Issue Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Falla Reportada o Servicio a Realizar
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ej. Pantalla estrellada, no da imagen. Cambio de display OLED y revisión de lógica."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Costs & Advance Payment */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  Costo Total Estimado ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Anticipo Dejado ($ MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={advancePayment}
                  onChange={(e) => setAdvancePayment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Registrar Recepción de Equipo
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: ENTREGA DE EQUIPO */}
        {activeTab === 'entrega' && (
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            
            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Folio, Cliente o Modelo de Celular..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* List of pending repairs */}
            {pendingRepairs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                <PackageCheck className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No hay equipos pendientes de entrega.</p>
                <p className="text-[11px] text-slate-400">
                  Todos los celulares han sido entregados o no hay coincidencias en la búsqueda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRepairs.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-amber-400 transition-all space-y-3"
                  >
                    
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-extrabold text-xs rounded-lg">
                          {record.id}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {record.deviceModel}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {record.receivedAt}
                      </span>
                    </div>

                    {/* Client & Issue Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                      <div>
                        <p className="text-slate-500 font-medium">Cliente:</p>
                        <p className="font-bold text-slate-900">{record.clientName} ({record.clientPhone})</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Falla / Servicio:</p>
                        <p className="font-bold text-slate-800 line-clamp-1">{record.issueDescription}</p>
                      </div>
                    </div>

                    {/* Financial Balance */}
                    <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Costo Total:</span>{' '}
                          <span className="font-bold text-slate-900">${record.totalCost.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Anticipo:</span>{' '}
                          <span className="font-bold text-emerald-700">${record.advancePayment.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Saldo Restante:</span>{' '}
                          <span className="font-black text-amber-700 text-sm">${record.pendingBalance.toFixed(2)} MXN</span>
                        </div>
                      </div>

                      {/* Deliver Action */}
                      <button
                        type="button"
                        onClick={() => handleDeliverEquipment(record)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Cobrar Saldo (${record.pendingBalance}) y Entregar
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
