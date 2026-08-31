import React, { useMemo, useState } from 'react';
import {
  Wrench,
  User,
  Phone,
  Smartphone,
  DollarSign,
  FileText,
  CheckCircle2,
  Search,
  X,
  Lock,
  Clock,
  PackageCheck,
  History,
  Ban,
  ShieldCheck
} from 'lucide-react';
import { RepairRecord, Product, CartItemMetadata, Branch, Operator, SaleTicket } from '../types';
import { allocateRepairFolio } from '../lib/folioAllocator';
import { trustedIso } from '../lib/clockGuard';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import { formatMoney, money } from '../lib/ids';
import { stampRepairLabel } from '../lib/repairUtils';
import RepairHistoryPanel from './RepairHistoryPanel';

interface RepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  repairRecords: RepairRecord[];
  onAddRepairRecord: (record: RepairRecord) => void | Promise<void>;
  onUpdateRepairRecord: (record: RepairRecord) => void | Promise<void>;
  onCancelRepairRecord?: (record: RepairRecord, reason: string) => void | Promise<void>;
  onAddToCart: (product: Product, amount: number, metadata?: CartItemMetadata) => void;
  currentBranch: Branch;
  currentOperator: Operator;
  onEmitDirectTicket?: (ticket: SaleTicket) => void | Promise<void>;
  isAdmin?: boolean;
}

type TabId = 'recepcion' | 'entrega' | 'historial';

export default function RepairModal({
  isOpen,
  onClose,
  repairRecords,
  onAddRepairRecord,
  onUpdateRepairRecord,
  onCancelRepairRecord,
  onAddToCart,
  currentBranch,
  currentOperator,
  onEmitDirectTicket,
  isAdmin = false
}: RepairModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('recepcion');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [passcodePattern, setPasscodePattern] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [totalCost, setTotalCost] = useState<string>('');
  const [advancePayment, setAdvancePayment] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [cancelTarget, setCancelTarget] = useState<RepairRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const pendingRepairs = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return repairRecords
      .filter((r) => r.status !== 'entregado' && r.status !== 'cancelado')
      .filter((r) => {
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.deviceModel.toLowerCase().includes(q) ||
          r.clientPhone.includes(q)
        );
      })
      .sort((a, b) =>
        String(b.receivedAtIso || b.receivedAt || '').localeCompare(
          String(a.receivedAtIso || a.receivedAt || '')
        )
      );
  }, [repairRecords, searchFilter]);

  if (!isOpen) return null;

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setDeviceModel('');
    setPasscodePattern('');
    setIssueDescription('');
    setTotalCost('');
    setAdvancePayment('');
    setFormError(null);
  };

  const handleRecepcionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    if (!clientName.trim()) {
      setFormError('Falta el nombre del cliente.');
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, '').length < 10) {
      setFormError('El teléfono de contacto debe traer 10 dígitos.');
      return;
    }
    if (!deviceModel.trim()) {
      setFormError('Falta el modelo o marca del equipo.');
      return;
    }
    if (!issueDescription.trim()) {
      setFormError('Falta describir la falla o el servicio.');
      return;
    }

    const numTotal = money(parseFloat(totalCost) || 0);
    const numAdvance = money(parseFloat(advancePayment) || 0);

    if (numAdvance > numTotal) {
      setFormError('El anticipo no puede ser mayor que el costo total.');
      return;
    }

    setSaving(true);
    try {
      const receivedIso = trustedIso();
      const folioId = await allocateRepairFolio(currentBranch.id, receivedIso);
      const pendingBalance = money(Math.max(0, numTotal - numAdvance));

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
        receivedAt: `${safeFormatDate(receivedIso)} ${safeFormatTime(receivedIso)}`,
        receivedAtIso: receivedIso,
        operatorName: currentOperator.name,
        branchId: currentBranch.id
      };

      // El registro se guarda antes de cobrar: si el cobro se cancela, el
      // equipo del cliente ya quedó anotado en el taller.
      await onAddRepairRecord(newRepair);

      if (numAdvance > 0) {
        const repairProduct: Product = {
          id: `prod-rep-${folioId}`,
          code: folioId,
          name: `Recepción Taller (${folioId}) - ${deviceModel.trim()}`,
          category: 'servicio',
          price: numAdvance,
          stock: 1
        };

        onAddToCart(repairProduct, numAdvance, {
          repairId: folioId,
          clientName: newRepair.clientName,
          clientPhone: newRepair.clientPhone,
          deviceModel: newRepair.deviceModel,
          issueDescription: newRepair.issueDescription,
          passcodePattern: newRepair.passcodePattern,
          repairType: 'anticipo',
          advancePayment: numAdvance,
          totalRepairCost: numTotal,
          pendingBalance,
          receivedAt: newRepair.receivedAt
        });
      } else if (onEmitDirectTicket) {
        await onEmitDirectTicket({
          id: `TCK-REC-${folioId}`,
          folio: `REC-${folioId.replace('REP-', '')}`,
          timestamp: receivedIso,
          branchId: currentBranch.id,
          operatorName: currentOperator.name,
          items: [
            {
              cartItemId: `item-rep-rec-${folioId}`,
              product: {
                id: `prod-rep-${folioId}`,
                code: folioId,
                name: `Recepción a Taller (${folioId}) - ${deviceModel.trim()}`,
                category: 'servicio',
                price: 0,
                stock: 1
              },
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              metadata: {
                repairId: folioId,
                clientName: newRepair.clientName,
                clientPhone: newRepair.clientPhone,
                deviceModel: newRepair.deviceModel,
                issueDescription: newRepair.issueDescription,
                passcodePattern: newRepair.passcodePattern,
                repairType: 'anticipo',
                advancePayment: 0,
                totalRepairCost: numTotal,
                pendingBalance: numTotal,
                receivedAt: newRepair.receivedAt
              }
            }
          ],
          total: 0,
          paymentMethod: 'Efectivo',
          cashReceived: 0,
          change: 0
        });
      }

      resetForm();
      onClose();
    } catch (err) {
      console.error('Error registrando la recepción del equipo:', err);
      setFormError(
        'No se pudo registrar la recepción en este equipo. No entregues el celular sin folio; inténtalo de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Con saldo pendiente el equipo NO se marca entregado aquí: se manda a cobro
   * y la entrega se registra cuando el ticket queda pagado. Así un cobro
   * cancelado no deja el celular como entregado y sin saldo.
   */
  const handleDeliverEquipment = async (record: RepairRecord) => {
    const amountToCharge = money(record.pendingBalance);
    const nowIso = trustedIso();

    if (amountToCharge <= 0) {
      const updatedRecord: RepairRecord = {
        ...record,
        status: 'entregado',
        pendingBalance: 0,
        deliveredAt: `${safeFormatDate(nowIso)} ${safeFormatTime(nowIso)}`,
        deliveredAtIso: nowIso,
        deliveredByName: currentOperator.name
      };
      await onUpdateRepairRecord(updatedRecord);

      if (onEmitDirectTicket) {
        await onEmitDirectTicket({
          id: `TCK-ENT-${record.id}`,
          folio: `ENT-${record.id.replace('REP-', '')}`,
          timestamp: nowIso,
          branchId: currentBranch.id,
          operatorName: currentOperator.name,
          items: [
            {
              cartItemId: `item-rep-deliv-${record.id}`,
              product: {
                id: `prod-rep-deliv-${record.id}`,
                code: record.id,
                name: `Entrega de Equipo (${record.id}) - ${record.deviceModel}`,
                category: 'servicio',
                price: 0,
                stock: 1
              },
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              metadata: {
                repairId: record.id,
                clientName: record.clientName,
                clientPhone: record.clientPhone,
                deviceModel: record.deviceModel,
                issueDescription: record.issueDescription,
                passcodePattern: record.passcodePattern,
                repairType: 'saldo_final',
                advancePayment: record.advancePayment,
                totalRepairCost: record.totalCost,
                pendingBalance: 0,
                deliveredAt: updatedRecord.deliveredAt
              }
            }
          ],
          total: 0,
          paymentMethod: 'Efectivo',
          cashReceived: 0,
          change: 0
        });
      }
      onClose();
      return;
    }

    onAddToCart(
      {
        id: `prod-rep-deliv-${record.id}`,
        code: record.id,
        name: `Saldo Liquidación (${record.id}) - ${record.deviceModel}`,
        category: 'servicio',
        price: amountToCharge,
        stock: 1
      },
      amountToCharge,
      {
        repairId: record.id,
        clientName: record.clientName,
        clientPhone: record.clientPhone,
        deviceModel: record.deviceModel,
        issueDescription: record.issueDescription,
        passcodePattern: record.passcodePattern,
        repairType: 'saldo_final',
        advancePayment: record.advancePayment,
        totalRepairCost: record.totalCost,
        pendingBalance: 0
      }
    );
    onClose();
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !onCancelRepairRecord) return;
    await onCancelRepairRecord(cancelTarget, cancelReason);
    setCancelTarget(null);
    setCancelReason('');
  };

  const tabButton = (id: TabId, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
        activeTab === id
          ? 'bg-amber-600 text-white shadow-sm'
          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col my-auto max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-amber-600 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-amber-200" />
            <div>
              <h3 className="font-bold text-base">Servicio Técnico & Reparaciones</h3>
              <p className="text-[11px] text-amber-100">
                Recepción, entrega e historial de equipos de clientes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-amber-100 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 shrink-0">
          {tabButton('recepcion', <Wrench className="w-4 h-4" />, 'Recepción')}
          {tabButton(
            'entrega',
            <PackageCheck className="w-4 h-4" />,
            `En taller (${repairRecords.filter((r) => r.status !== 'entregado' && r.status !== 'cancelado').length})`
          )}
          {tabButton('historial', <History className="w-4 h-4" />, 'Historial')}
        </div>

        {activeTab === 'recepcion' && (
          <form onSubmit={handleRecepcionSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900 font-medium">
              El equipo queda registrado con folio en cuanto guardas, aunque no haya internet.
              El anticipo se cobra después, en el punto de venta.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Nombre del cliente
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
                  Teléfono de contacto (10 dígitos)
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Ej. 6441234567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  Modelo / marca del equipo
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
                  Contraseña / patrón (opcional)
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Falla reportada o servicio a realizar
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ej. Pantalla estrellada, no da imagen. Cambio de display y revisión."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  Costo total estimado
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
                  Anticipo dejado
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

            {formError && (
              <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}

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
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Guardando…' : 'Registrar recepción del equipo'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'entrega' && (
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por folio, cliente, teléfono o modelo…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {pendingRepairs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                <PackageCheck className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No hay equipos en taller.</p>
                <p className="text-[11px] text-slate-400">
                  Los equipos ya entregados están en la pestaña Historial.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRepairs.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-amber-400 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-extrabold text-xs rounded-lg">
                          {record.id}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">{record.deviceModel}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {stampRepairLabel(record.receivedAtIso, record.receivedAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                      <div>
                        <p className="text-slate-500 font-medium">Cliente</p>
                        <p className="font-bold text-slate-900">
                          {record.clientName} ({record.clientPhone})
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Falla / servicio</p>
                        <p className="font-bold text-slate-800">{record.issueDescription}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Contraseña / patrón</p>
                        <p className="font-bold text-slate-800">{record.passcodePattern}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Recibió</p>
                        <p className="font-bold text-slate-800">{record.operatorName}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Costo:</span>{' '}
                          <span className="font-bold text-slate-900">${formatMoney(record.totalCost)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Anticipo:</span>{' '}
                          <span className="font-bold text-emerald-700">
                            ${formatMoney(record.advancePayment)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Saldo:</span>{' '}
                          <span className="font-black text-amber-700 text-sm">
                            ${formatMoney(record.pendingBalance)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {onCancelRepairRecord && isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(record);
                              setCancelReason('');
                            }}
                            className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                            title="Dar de baja este registro"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Dar de baja
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeliverEquipment(record)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {record.pendingBalance > 0
                            ? `Cobrar $${formatMoney(record.pendingBalance)} y entregar`
                            : 'Entregar equipo'}
                        </button>
                      </div>
                    </div>

                    {record.pendingBalance > 0 && (
                      <p className="text-[10.5px] text-slate-500">
                        El equipo se marca entregado cuando el cobro quede completado en el punto de venta.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="p-6 overflow-y-auto flex-1">
            <RepairHistoryPanel
              records={repairRecords}
              exportLabel={`taller-${currentBranch.name.toLowerCase()}`}
              isAdmin={isAdmin}
              onCancelRepairRecord={onCancelRepairRecord}
            />
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <h4 className="text-sm font-black text-slate-900">Dar de baja {cancelTarget.id}</h4>
            </div>
            <p className="text-xs text-slate-600">
              El registro no se borra: queda en el historial como dado de baja, con tu nombre y el motivo.
              Equipo de {cancelTarget.clientName} ({cancelTarget.deviceModel}).
            </p>
            <textarea
              rows={2}
              autoFocus
              placeholder="Motivo (ej. captura equivocada, el cliente ya no dejó el equipo)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Dar de baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
