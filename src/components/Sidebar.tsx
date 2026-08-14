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
  
  const isAdmin = currentOperator.role === 'admin';

  const allMenuItems: { id: ModuleId; label: string; icon: React.ReactNode }[] = [
    { id: 'pos', label: 'Punto de Venta', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventario', icon: <Package className="w-5 h-5" /> },
    { id: 'purchases', label: 'Compras', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'sales', label: 'Ventas y Reportes', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'executive', label: 'Dirección General', icon: <Building2 className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuración y Usuarios', icon: <Settings className="w-5 h-5" /> },
  ];

  // Operators (non-admins) only have access to Punto de Venta (POS)
  const menuItems = isAdmin ? allMenuItems : allMenuItems.filter((item) => item.id === 'pos');

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-950 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-800
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Brand & Branch Info */}
        <div className="p-5 sm:p-6 border-b border-slate-800 relative">
          {/* Close button on mobile */}
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile}
              className="md:hidden absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="mb-4 sm:mb-6 flex justify-center">
            <Logo theme="dark" size="sm" />
          </div>
          
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
              <Store className="w-4 h-4 text-blue-400" />
              <span className="truncate">{currentBranch.name}</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
              <span className="truncate font-semibold text-slate-200">{currentOperator.name}</span>
              <span className="ml-auto bg-slate-800 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                {currentOperator.role}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto dark-sidebar-scroll">
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 px-2">
            Módulos del Sistema
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 relative cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-yellow-400 rounded-r-full"></div>
                )}
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 hover:text-red-400 transition-colors group cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
