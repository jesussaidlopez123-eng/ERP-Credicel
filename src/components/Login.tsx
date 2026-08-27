import React, { useState } from 'react';
import { 
  Store, User, Lock, ArrowRight, Eye, EyeOff, ShieldCheck
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
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const safeOperators = Array.isArray(operators) && operators.length > 0 ? operators : INITIAL_OPERATORS;
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : ALL_BRANCHES;

  React.useEffect(() => {
    if (!selectedOperatorId && safeOperators.length > 0) {
      setSelectedOperatorId(safeOperators[0].id);
    }
  }, [safeOperators, selectedOperatorId]);

  // Selected operator object
  const selectedOperator = safeOperators.find((o) => o.id === selectedOperatorId) || safeOperators[0];

  // Automatically resolve the branch assigned to this operator in Administration
  const assignedBranch: Branch = React.useMemo(() => {
    if (!selectedOperator) return safeBranches[0];
    const allowed = (selectedOperator.branchIds || []).filter(Boolean);
    const preferred = selectedBranchId && allowed.includes(selectedBranchId)
      ? selectedBranchId
      : (allowed.find((id) => id !== 'b-bodega') || allowed[0] || safeBranches[0]?.id);
    return safeBranches.find((b) => b.id === preferred) || safeBranches[0];
  }, [selectedOperator, safeBranches, selectedBranchId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedOperatorId) {
      setError('Por favor, selecciona tu usuario de operador.');
      return;
    }

    if (!password || !password.trim()) {
      setError('Por favor, ingresa tu contraseña de acceso para iniciar sesión.');
      return;
    }

    const operator = safeOperators.find((o) => o.id === selectedOperatorId);

    if (!operator) {
      setError('Usuario u operador no encontrado en el sistema.');
      return;
    }

    // Strict Password Validation against configured operator password
    const expectedPassword = operator.password;

    if (!expectedPassword) {
      setError('Este operador no tiene contraseña configurada. Pide al administrador que la asigne.');
      return;
    }

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
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-3 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="bg-[#0b3a6e] px-6 sm:px-8 py-8 text-center text-white">
          <div className="flex flex-col items-center space-y-3">
            <div className="px-4 py-2 bg-white rounded-xl">
              <Logo size="md" theme="light" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              Punto de venta CREDI CEL
            </h1>
            <p className="text-xs text-blue-100">
              Navojoa · Huatabampo · Bodega
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-7 space-y-5">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Operator Selection - Desplegable (Dropdown) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
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
                    setSelectedBranchId('');
                    setPassword('');
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
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    Sucursal de trabajo:
                  </span>
                  {getRoleBadge(selectedOperator.role)}
                </div>

                {(selectedOperator.branchIds || []).length > 1 ? (
                  <select
                    value={assignedBranch?.id || ''}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-blue-950"
                  >
                    {(selectedOperator.branchIds || []).map((id) => {
                      const b = safeBranches.find((br) => br.id === id);
                      return (
                        <option key={id} value={id}>
                          {b?.name || id}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-sm font-semibold text-blue-950">
                      {assignedBranch?.name || 'Sucursal Asignada'}
                    </span>
                    <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-lg">
                      {assignedBranch?.id || 'SUCURSAL'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Contraseña de Acceso</span>
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
                  autoFocus
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Contraseña"
                  className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm bg-white shadow-xs placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
              
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1 text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Acceso con usuario y contraseña
                </span>
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
              className="w-full flex items-center justify-center gap-2 bg-[#0047AB] hover:bg-[#003d93] text-white py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer mt-2"
            >
              <span>Ingresar al Sistema</span>
              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>CREDI CEL · Multi-sucursal</span>
          <span>Uso interno</span>
        </div>

      </div>
    </div>
  );
}
