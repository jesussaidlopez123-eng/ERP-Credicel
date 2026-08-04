import React, { useState } from 'react';
import { X, Megaphone, AlertTriangle, Send, Store, User, ShieldCheck, PackagePlus, ShoppingCart } from 'lucide-react';
import { AppNotification, NoticeUrgency, Branch, Operator } from '../types';

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  currentOperator: Operator;
  currentBranch: Branch;
  branches: Branch[];
  operators: Operator[];
}

export default function CreateNoticeModal({
  isOpen,
  onClose,
  onAddNotification,
  currentOperator,
  currentBranch,
  branches,
  operators
}: CreateNoticeModalProps) {
  const [noticeType, setNoticeType] = useState<'aviso' | 'pedido_stock'>('aviso');
  const [urgency, setUrgency] = useState<NoticeUrgency>('normal');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetBranchId, setTargetBranchId] = useState<string>('all');
  const [targetOperatorId, setTargetOperatorId] = useState<string>('all');

  // Specific state for Stock Request
  const [reqProductName, setReqProductName] = useState('');
  const [reqQty, setReqQty] = useState<string>('1');
  const [reqCurrentStock, setReqCurrentStock] = useState<string>('0');

  if (!isOpen) return null;

  const isAdmin = currentOperator.role === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (noticeType === 'aviso') {
      if (!isAdmin) return;
      if (!title.trim() || !message.trim()) return;

      const targetOp = operators.find((op) => op.id === targetOperatorId);

      onAddNotification({
        urgency,
        title: title.trim(),
        message: message.trim(),
        authorName: currentOperator.name,
        branchId: targetBranchId,
        targetOperatorId,
        targetOperatorName: targetOp ? targetOp.name : undefined,
        type: 'aviso'
      });
    } else {
      // Pedido de Surtido / Stock Bajo (Cualquier operador puede emitirlo)
      if (!reqProductName.trim()) return;

      const qty = parseInt(reqQty, 10) || 1;
      const stock = parseInt(reqCurrentStock, 10) || 0;

      onAddNotification({
        urgency,
        title: `SOLICITUD DE SURTIDO: ${reqProductName.trim()} (${currentBranch.name})`,
        message: `La sucursal ${currentBranch.name} solicita ${qty} unidad(es) de "${reqProductName.trim()}". Stock actual: ${stock} pzs. ${message ? `Notas: ${message.trim()}` : ''}`,
        authorName: currentOperator.name,
        branchId: currentBranch.id,
        targetOperatorId: 'all',
        type: 'pedido_stock',
        requestDetails: {
          productName: reqProductName.trim(),
          requestedQty: qty,
          currentStock: stock,
          status: 'pendiente'
        }
      });
    }

    // Reset form
    setTitle('');
    setMessage('');
    setReqProductName('');
    setReqQty('1');
    setReqCurrentStock('0');
    setUrgency('normal');
    setTargetBranchId('all');
    setTargetOperatorId('all');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            {noticeType === 'aviso' ? (
              <Megaphone className="w-5 h-5 text-yellow-400" />
            ) : (
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <h3 className="font-bold text-base">
                {noticeType === 'aviso' ? 'Crear Nuevo Aviso Institucional' : 'Solicitar Surtido / Stock Bajo'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {noticeType === 'aviso' ? 'Difusión general a operadores' : `Sucursal emisora: ${currentBranch.name}`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Type Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setNoticeType('aviso')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              noticeType === 'aviso'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
            Aviso Institucional
          </button>

          <button
            type="button"
            onClick={() => setNoticeType('pedido_stock')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              noticeType === 'pedido_stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5 text-amber-200" />
            Pedir Surtido / Stock Bajo
          </button>
        </div>

        {noticeType === 'aviso' && !isAdmin ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Permisos Insuficientes para Avisos</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Sólo el Administrador Principal puede publicar avisos institucionales. Puedes cambiar a la pestaña <b>"Pedir Surtido / Stock Bajo"</b> para solicitar productos para tu sucursal.
            </p>
            <button
              onClick={() => setNoticeType('pedido_stock')}
              className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Ir a Pedir Surtido
            </button>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Urgency Selector */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Nivel de Prioridad / Alerta
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUrgency('normal')}
                  className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-extrabold gap-2 transition-all cursor-pointer ${
                    urgency === 'normal'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Megaphone className="w-4 h-4 text-blue-600" />
                  Prioridad Normal
                </button>

                <button
                  type="button"
                  onClick={() => setUrgency('urgente')}
                  className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-extrabold gap-2 transition-all cursor-pointer ${
                    urgency === 'urgente'
                      ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100 shadow-xs animate-pulse'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Urgente / Stock Crítico
                </button>
              </div>
            </div>

            {noticeType === 'aviso' ? (
              <>
                {/* Target Selectors: Branch & Operator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      Dirigido a Sucursal:
                    </label>
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    >
                      <option value="all">Todas las Sucursales</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Solo {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      Dirigido a Operador:
                    </label>
                    <select
                      value={targetOperatorId}
                      onChange={(e) => setTargetOperatorId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    >
                      <option value="all">Todos los Operadores</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          Solo {op.name} ({op.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Título del Aviso / Alerta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Arqueo de caja a las 15:00 hrs"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </>
            ) : (
              /* Pedido de Surtido Fields */
              <div className="space-y-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1">
                    Producto o Insumo Solicitado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Mica de Cristal Templado iPhone 13 / Cargador V8"
                    value={reqProductName}
                    onChange={(e) => setReqProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-extrabold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Stock Actual en Sucursal:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={reqCurrentStock}
                      onChange={(e) => setReqCurrentStock(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Cantidad Requerida:
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={reqQty}
                      onChange={(e) => setReqQty(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Message / Content */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {noticeType === 'aviso' ? 'Mensaje o Instrucciones *' : 'Notas o Detalles Adicionales'}
              </label>
              <textarea
                required={noticeType === 'aviso'}
                rows={3}
                placeholder={
                  noticeType === 'aviso'
                    ? 'Escribe las instrucciones directas para la sucursal u operador...'
                    : 'Ej. Nos quedan pocos modelos en exhibición, requerimos surtido rápido.'
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
              />
            </div>

            {/* Emisor info */}
            <div className="text-[11px] text-slate-600 bg-slate-100 px-3 py-2 rounded-lg flex items-center justify-between border border-slate-200">
              <span className="flex items-center gap-1 text-slate-800 font-extrabold">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Emisor: {currentOperator.name} ({currentBranch.name})
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm cursor-pointer ${
                  noticeType === 'aviso' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {noticeType === 'aviso' ? 'Publicar Aviso' : 'Enviar Solicitud de Surtido'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
