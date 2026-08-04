import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Users, 
  Settings, 
  LogOut,
  Store,
  ShoppingBag,
  Building2
} from 'lucide-react';
import { ModuleId, Branch, Operator } from '../types';
import Logo from './Logo';

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (module: ModuleId) => void;
  onLogout: () => void;
  currentBranch: Branch;
  currentOperator: Operator;
}

export default function Sidebar({ 
  activeModule, 
  onModuleChange, 
  onLogout,
  currentBranch,
  currentOperator
}: SidebarProps) {
  
  const isAdmin = currentOperator.role === 'admin';

  const allMenuItems: { id: ModuleId; label: string; icon: React.ReactNode }[] = [
    { id: 'pos', label: 'Punto de Venta', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventario', icon: <Package className="w-5 h-5" /> },
    { id: 'purchases', label: 'Compras', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'sales', label: 'Ventas y Reportes', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'executive', label: 'Dirección General', icon: <Building2 className="w-5 h-5" /> },
    { id: 'users', label: 'Usuarios', icon: <Users className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuración', icon: <Settings className="w-5 h-5" /> },
  ];

  // Operators (non-admins) only have access to Punto de Venta (POS)
  const menuItems = isAdmin ? allMenuItems : allMenuItems.filter((item) => item.id === 'pos');

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-800">
      
      {/* Brand & Branch Info */}
      <div className="p-6 border-b border-slate-800">
        <div className="mb-6 flex justify-center">
          <Logo theme="dark" size="sm" />
        </div>
        
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
            <Store className="w-4 h-4 text-blue-400" />
            {currentBranch.name}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
            <span className="truncate">{currentOperator.name}</span>
            <span className="ml-auto bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded capitalize">{currentOperator.role}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto dark-sidebar-scroll">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
          Módulos Principales
        </div>
        
        {menuItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-yellow-400 rounded-r-full"></div>
              )}
              <span className={isActive ? 'text-white' : 'text-slate-500'}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 hover:text-red-400 transition-colors group"
        >
          <LogOut className="w-5 h-5 text-slate-500 group-hover:text-red-400" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
