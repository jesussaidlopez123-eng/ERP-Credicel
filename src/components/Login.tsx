import React, { useState } from 'react';
import { 
  Store, User, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, 
  Cloud, KeyRound
} from 'lucide-react';
import { Branch, Operator } from '../types';
import Logo from './Logo';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { ALL_BRANCHES } from '../data/initialBranches';

interface LoginProps {
  onLogin: (branch: Branch, operator: Operator) => void;
  operators?: Operator[];
  branches?: Branch[];
}

export default function Login({ 
  onLogin, 
  operators = INITIAL_OPERATORS, 
  branches = ALL_BRANCHES 
}: LoginProps) {
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('o1');
  const [password, setPassword] = useState<string>('123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const safeOperators = Array.isArray(operators) && operators.length > 0 ? operators : INITIAL_OPERATORS;
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : ALL_BRANCHES;

  // Selected operator object
  const selectedOperator = safeOperators.find((o) => o.id === selectedOperatorId) || safeOperators[0];

  // Automatically resolve the branch assigned to this operator in Administration
  const assignedBranch: Branch = React.useMemo(() => {
    if (!selectedOperator) return safeBranches[0];
    const assignedBranchId = selectedOperator.branchIds && selectedOperator.branchIds.length > 0 
      ? selectedOperator.branchIds[0] 
      : safeBranches[0]?.id;
    return safeBranches.find((b) => b.id === assignedBranchId) || safeBranches[0];
  }, [selectedOperator, safeBranches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedOperatorId) {
      setError('Por favor, selecciona tu usuario de operador.');
      return;
    }

    if (!password) {
      setError('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    const operator = safeOperators.find((o) => o.id === selectedOperatorId);

    if (!operator) {
      setError('Usuario u operador no encontrado en el sistema.');
      return;
    }

    // Strict Password Validation against configured operator password
    const expectedPassword = operator.password !== undefined ? operator.password : '123';

    if (password !== expectedPassword) {
      setError(`❌ Contraseña incorrecta para '${operator.name}'. Verifique sus credenciales.`);
      return;
    }

    // Automatic direct login to the branch assigned to this operator in Administration
    onLogin(assignedBranch, operator);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="bg-amber-500/20 text-amber-800 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Administrador</span>;
      case 'manager':
        return <span className="bg-indigo-500/20 text-indigo-800 border border-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Encargado</span>;
      default:
        return <span className="bg-blue-500/20 text-blue-800 border border-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Cajero POS</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn">
        
        {/* Colorful Branded Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 sm:px-8 py-7 text-center relative overflow-hidden text-white">
          <div className="relative z-10 flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-white rounded-2xl shadow-lg border border-white/40 mb-1">
              <Logo size="md" theme="light" />
            </div>

            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Sistema ERP & Punto de Venta
            </h1>
            
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-100">
              <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full border border-white/20 backdrop-blur-xs">
                <Cloud className="w-3.5 h-3.5 text-emerald-300" />
                Sincronización en la Nube Firestore
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-7 space-y-5">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Operator Selection - Desplegable (Dropdown) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                Usuario / Operador
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <select
                  value={selectedOperatorId}
                  onChange={(e) => {
                    setSelectedOperatorId(e.target.value);
                    const selected = safeOperators.find((op) => op.id === e.target.value);
                    if (selected) {
                      setPassword(selected.password !== undefined ? selected.password : '123');
                    }
                    setError('');
                  }}
                  className="block w-full pl-10 pr-8 py-3 border border-slate-300 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm bg-white cursor-pointer shadow-xs"
                >
                  {safeOperators.map((op) => {
                    const opBranch = safeBranches.find((b) => op.branchIds?.includes(b.id)) || safeBranches[0];
                    return (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.role.toUpperCase()}) — {opBranch?.name || 'Sucursal'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Automatically Display Assigned Branch */}
            {selectedOperator && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    Sucursal Asignada:
                  </span>
                  {getRoleBadge(selectedOperator.role)}
                </div>
                
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-sm font-black text-blue-950">
                    {assignedBranch?.name || 'Sucursal Asignada'}
                  </span>
                  <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-lg">
                    {assignedBranch?.id || 'SUCURSAL'}
                  </span>
                </div>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl text-slate-900 font-black focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm tracking-wider bg-white transition-all shadow-xs"
                />
              </div>
              
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-slate-400" />
                  Contraseña por defecto: <strong className="text-slate-800">123</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setPassword('123')}
                  className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                >
                  Autocompletar 123
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-700 text-xs font-bold bg-red-50 py-2.5 px-3 rounded-xl border border-red-200 animate-in fade-in flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 px-4 rounded-2xl text-sm font-black transition-all shadow-md hover:shadow-lg cursor-pointer mt-2"
            >
              <span>Ingresar al Sistema</span>
              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Acceso Seguro Multi-Sucursal
          </span>
          <span>Versión 2.5 Cloud</span>
        </div>

      </div>
    </div>
  );
}
