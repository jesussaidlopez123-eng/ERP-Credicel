import React from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  Store,
  ShoppingBag,
  Building2,
  X
} from 'lucide-react';
import { ModuleId, Branch, Operator } from '../types';
import { canOpenModule, roleLabel } from '../lib/roles';
import Logo from './Logo';

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (module: ModuleId) => void;
  onLogout: () => void;
  currentBranch: Branch;
  currentOperator: Operator;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeModule,
  onModuleChange,
  onLogout,
  currentBranch,
  currentOperator,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const allMenuItems: { id: ModuleId; label: string; icon: React.ReactNode }[] = [
    { id: 'sales', label: 'Ventas y cortes', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'purchases', label: 'Compras', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'executive', label: 'Dirección', icon: <Building2 className="w-4 h-4" /> },
    { id: 'pos', label: 'Punto de venta', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'settings', label: 'Usuarios', icon: <Settings className="w-4 h-4" /> },
  ];

  const menuItems = allMenuItems.filter((item) => canOpenModule(currentOperator.role, item.id));
  const roleText = roleLabel(currentOperator.role);

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-60 bg-white text-slate-700 flex flex-col h-full shrink-0 border-r border-slate-200
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-200 relative">
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="mb-4 flex justify-start">
            <Logo theme="light" size="sm" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-slate-900 text-sm font-semibold">
              <Store className="w-4 h-4 text-[#0047AB]" />
              <span className="truncate">{currentBranch.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="truncate">{currentOperator.name}</span>
              <span className="ml-auto rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                {roleText}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
            Menú
          </div>

          {menuItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onModuleChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0047AB] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
