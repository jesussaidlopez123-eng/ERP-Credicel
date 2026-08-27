import React from 'react';
import { 
  Bell, 
  Megaphone, 
  AlertTriangle, 
  Plus, 
  X, 
  Store,
  Clock,
  User,
  CheckCircle2
} from 'lucide-react';
import { AppNotification, Branch, Operator } from '../types';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onDismissNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onOpenCreateModal: () => void;
  currentBranch: Branch;
  currentOperator: Operator;
}

export default function NotificationsPopover({
  isOpen,
  onClose,
  notifications,
  onDismissNotification,
  onClearAllNotifications,
  onOpenCreateModal,
  currentBranch,
  currentOperator
}: NotificationsPopoverProps) {
  if (!isOpen) return null;

  const isAdmin = currentOperator.role === 'admin';

  // Filter notifications for current branch AND current operator
  const visibleNotifications = notifications.filter((n) => {
    const matchesBranch = !n.branchId || n.branchId === 'all' || n.branchId === currentBranch.id;
    const matchesOperator = !n.targetOperatorId || n.targetOperatorId === 'all' || n.targetOperatorId === currentOperator.id;
    return matchesBranch && matchesOperator;
  });

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
      />

      {/* Popover Card */}
      <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-2 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-yellow-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Avisos y Alertas</h3>
              <p className="text-[11px] text-slate-400">
                {visibleNotifications.length > 0 
                  ? `${visibleNotifications.length} alerta${visibleNotifications.length > 1 ? 's' : ''} pendiente${visibleNotifications.length > 1 ? 's' : ''}`
                  : 'Sin avisos pendientes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botón para abrir modal de avisos o solicitudes de surtido */}
            <button
              onClick={onOpenCreateModal}
              title={isAdmin ? "Crear nuevo aviso o solicitar surtido" : "Pedir surtido / Alerta de stock bajo"}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs px-2.5 py-1.5 rounded-xl font-extrabold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAdmin ? "Nuevo" : "Pedir Surtido"}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick hint & Clear all bar */}
        {visibleNotifications.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Haz clic en un aviso para confirmarlo y quitarlo.</span>
            <button
              onClick={onClearAllNotifications}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              Quitar todos
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-[160px]">
          {visibleNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80 stroke-1" />
              <p className="text-xs font-semibold text-slate-700">¡Todo al día!</p>
              <p className="text-[11px] text-slate-400">No tienes alertas ni avisos pendientes para tu usuario.</p>
            </div>
          ) : (
            visibleNotifications.map((n) => {
              const isUrgente = n.urgency === 'urgente';

              return (
                <div
                  key={n.id}
                  onClick={() => onDismissNotification(n.id)}
                  title="Haz clic para marcar como leído y quitar aviso"
                  className={`p-3.5 transition-all cursor-pointer relative group ${
                    isUrgente 
                      ? 'bg-red-50/50 hover:bg-red-50 border-l-4 border-l-red-600' 
                      : 'bg-blue-50/30 hover:bg-blue-50 border-l-4 border-l-blue-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isUrgente ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {isUrgente ? (
                        <AlertTriangle className="w-4 h-4 animate-bounce" />
                      ) : (
                        <Megaphone className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-bold ${isUrgente ? 'text-red-950' : 'text-slate-900'}`}>
                          {n.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isUrgente 
                            ? 'bg-red-100 text-red-700 border border-red-200' 
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {isUrgente ? 'Urgente' : 'Normal'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed">
                        {n.message}
                      </p>

                      {/* Targeted Info Footer */}
                      <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100/80 gap-1">
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <Store className="w-3 h-3 text-slate-400" />
                          {n.branchId === 'all' ? 'Todas las sucursales' : currentBranch.name}
                        </span>

                        {n.targetOperatorName && n.targetOperatorId !== 'all' && (
                          <span className="flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            <User className="w-3 h-3" />
                            {n.targetOperatorName}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {n.createdAt}
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            CrediCel ERP • Avisos Directos de Administración
          </p>
        </div>

      </div>
    </>
  );
}
