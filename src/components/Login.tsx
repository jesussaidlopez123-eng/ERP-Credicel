import React, { useState } from 'react';
import { 
  Store, User, Lock, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { Branch, Operator } from '../types';
import Logo from './Logo';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { ADMIN_WORKSPACE, ALL_BRANCHES, getBranchDisplayName, normalizeBranchId } from '../data/initialBranches';
import { normalizeRole, roleLabel } from '../lib/roles';
import { isAfterCashClose } from '../lib/shiftHours';

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

  const isAdminUser = normalizeRole(selectedOperator?.role) === 'admin';

  // Cajero y encargado entran a su sucursal. Administración no se ata a una caja.
  const assignedBranch: Branch = React.useMemo(() => {
    if (!selectedOperator) return safeBranches[0];
    if (normalizeRole(selectedOperator.role) === 'admin') return ADMIN_WORKSPACE;
    const allowed = (selectedOperator.branchIds || [])
      .map((id) => normalizeBranchId(id))
      .filter((id) => id && id !== 'all');
    const preferred = selectedBranchId && allowed.includes(normalizeBranchId(selectedBranchId))
      ? normalizeBranchId(selectedBranchId)
      : (allowed[0] || safeBranches[0]?.id);
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

    onLogin(
      normalizeRole(operator.role) === 'admin' ? ADMIN_WORKSPACE : assignedBranch,
      operator
    );
  };

  const getRoleBadge = (role: string) => {
    switch (normalizeRole(role)) {
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
        
        <div className="bg-[#0b3a6e] px-5 py-5 text-center text-white">
          <div className="flex flex-col items-center space-y-2">
            <div className="px-3 py-1.5 bg-white rounded-lg">
              <Logo size="md" theme="light" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight">CREDI CEL</h1>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {isAfterCashClose() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
              Caja cerrada · 11:00 p.m.
            </div>
          )}
          
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
                  className="block w-full pl-10 pr-8 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm bg-white cursor-pointer"
                >
                  {safeOperators.map((op) => {
                    const isAdminOp = normalizeRole(op.role) === 'admin';
                    const opBranch = safeBranches.find((b) => op.branchIds?.includes(b.id)) || safeBranches[0];
                    return (
                      <option key={op.id} value={op.id}>
                        {op.name} ({roleLabel(op.role)})
                        {isAdminOp ? ' — Administración' : ` — ${getBranchDisplayName(opBranch?.id)}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Automatically Display Assigned Branch */}
            {selectedOperator && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-slate-400" />
                    {isAdminUser ? 'Administración' : 'Sucursal'}
                  </span>
                  {getRoleBadge(selectedOperator.role)}
                </div>

                {isAdminUser ? (
                  <p className="text-sm font-semibold text-slate-900">Administración</p>
                ) : (selectedOperator.branchIds || []).length > 1 ? (
                  <select
                    value={assignedBranch?.id || ''}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-blue-950"
                  >
                    {(selectedOperator.branchIds || []).map((id) => (
                        <option key={id} value={id}>
                          {getBranchDisplayName(id)}
                        </option>
                    ))}
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
                  <span>Contraseña</span>
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
                  className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm bg-white placeholder:font-normal placeholder:text-slate-400"
                />
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
              className="w-full flex items-center justify-center gap-2 bg-[#0047AB] hover:bg-[#003d93] text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer mt-1"
            >
              <span>Ingresar</span>
              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[11px] text-slate-400 text-center">
          Matriz · Navojoa · Huatabampo
        </div>

      </div>
    </div>
  );
}
